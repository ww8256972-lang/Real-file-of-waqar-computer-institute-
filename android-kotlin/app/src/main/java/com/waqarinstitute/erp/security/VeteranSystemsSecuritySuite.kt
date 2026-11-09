package com.waqarinstitute.erp.security

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import androidx.sqlite.db.SupportSQLiteOpenHelper
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.google.crypto.tink.Aead
import com.google.crypto.tink.KeyTemplates
import com.google.crypto.tink.RegistryConfiguration
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.integration.android.AndroidKeysetManager
import com.google.flatbuffers.FlatBufferBuilder
import com.waqarinstitute.erp.worker.CrashReportUploadWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import net.sqlcipher.database.SQLiteDatabase
import net.sqlcipher.database.SupportFactory
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient
import timber.log.Timber
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

/**
 * =========================================================================================
 * WAQAR COMPUTER INSTITUTE ERP & EDUSYNC ACADEMY
 * VETERAN SYSTEMS SECURITY & PERFORMANCE SUITE (Android 8.0 API 26 to Android 15 API 35)
 * =========================================================================================
 * All security primitives use unified package `com.waqarinstitute.erp.security` and
 * load the single native library via `NativeLibrary.ensureLoaded()`.
 */

// =========================================================================================
// 1. TAMPER DETECTION & NON-CRASHING ZEROIZATION MANAGER
// =========================================================================================
object TamperZeroizationManager {
    init {
        NativeLibrary.ensureLoaded()
    }

    private val localTamperFlag = AtomicBoolean(false)

    @JvmStatic
    external fun nativeStartAntiDebuggerWatchdog(vaultDirPath: String)

    @JvmStatic
    external fun nativeTriggerEmergencyZeroize(vaultDirPath: String)

    @JvmStatic
    external fun nativeIsTamperDetected(): Boolean

    fun startKernelAntiTamperWatchdog(context: Context) {
        if (!NativeLibrary.isAvailable()) return
        val vaultDir = File(context.filesDir, "edusync_secure_vault").apply { mkdirs() }
        nativeStartAntiDebuggerWatchdog(vaultDir.absolutePath)
    }

    fun isDeviceTampered(): Boolean {
        if (localTamperFlag.get()) return true
        return if (NativeLibrary.isAvailable()) {
            runCatching { nativeIsTamperDetected() }.getOrDefault(false)
        } else {
            false
        }
    }

    /**
     * Zeroizes in-memory keys and sensitive cache files and sets the tamper flag so the UI
     * blocks sensitive operations (exam start, attendance check-in) with a clear error banner
     * rather than blind SIGKILL termination.
     */
    fun triggerZeroizationAndBlockSensitiveActions(context: Context, reason: String) {
        Timber.w("Tamper detected (%s) — zeroizing ephemeral caches and blocking sensitive flows", reason)
        localTamperFlag.set(true)
        val vaultDir = File(context.filesDir, "edusync_secure_vault")
        if (NativeLibrary.isAvailable() && vaultDir.exists()) {
            runCatching { nativeTriggerEmergencyZeroize(vaultDir.absolutePath) }
        }
    }
}

// =========================================================================================
// 2. NATIVE WHITE-BOX CRYPTOGRAPHY (WBC) ENGINE
// =========================================================================================
object WhiteBoxCrypto {
    init {
        NativeLibrary.ensureLoaded()
    }

    @JvmStatic
    external fun nativeWhiteBoxTransform(payload: ByteArray, contextSalt: ByteArray): ByteArray

    @JvmStatic
    external fun nativeDeriveDecoyToken(seed: ByteArray): String

    fun transformExamPayload(payload: ByteArray, examSessionId: String): ByteArray {
        val salt = examSessionId.toByteArray(Charsets.UTF_8)
        if (!NativeLibrary.isAvailable()) {
            // Deterministic XOR fallback for pure JVM tests where native .so is not loaded
            return ByteArray(payload.size) { idx ->
                (payload[idx].toInt() xor salt[idx % salt.size].toInt()).toByte()
            }
        }
        return nativeWhiteBoxTransform(payload, salt)
    }

    fun generateCanaryDecoyToken(sessionId: String): String {
        val seed = sessionId.toByteArray(Charsets.UTF_8)
        if (!NativeLibrary.isAvailable()) {
            val digest = MessageDigest.getInstance("SHA-256").digest(seed)
            return "WBC-JVM-" + digest.take(8).joinToString("") { "%02x".format(it) }
        }
        return nativeDeriveDecoyToken(seed)
    }
}

// =========================================================================================
// 3. HARDWARE SECURITY MODULE (STRONGBOX / TEE KEYSTORE) + SERVER CHALLENGE ATTESTATION
// =========================================================================================
class HardwareSecurityModuleVault {
    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val HSM_ATTESTATION_KEY_ALIAS = "waqar_erp_hsm_ecdsa_p256_v2"
    }

    data class AttestationStatement(
        val keyAlias: String,
        val signatureBase64: String,
        val certChainCount: Int,
        val isStrongBoxBacked: Boolean
    )

    /**
     * Generates an ECDSA P-256 key pair in StrongBox (with automatic TEE fallback) and
     * signs a server-issued challenge nonce. No static PIN is ever compiled into the APK.
     */
    fun generateAttestedKeyAndSignChallenge(serverChallengeNonce: ByteArray): AttestationStatement {
        require(serverChallengeNonce.size >= 16) {
            "Server challenge nonce must be at least 16 bytes"
        }

        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        var strongBoxUsed = false

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                generateEcdsaKeyPair(
                    useStrongBox = true,
                    attestationChallenge = serverChallengeNonce
                )
                strongBoxUsed = true
            } catch (e: StrongBoxUnavailableException) {
                generateEcdsaKeyPair(
                    useStrongBox = false,
                    attestationChallenge = serverChallengeNonce
                )
                strongBoxUsed = false
            } catch (e: Exception) {
                generateEcdsaKeyPair(
                    useStrongBox = false,
                    attestationChallenge = serverChallengeNonce
                )
                strongBoxUsed = false
            }
        } else {
            generateEcdsaKeyPair(
                useStrongBox = false,
                attestationChallenge = serverChallengeNonce
            )
        }

        val privateKeyEntry = keyStore.getEntry(HSM_ATTESTATION_KEY_ALIAS, null) as KeyStore.PrivateKeyEntry
        val signature = Signature.getInstance("SHA256withECDSA").apply {
            initSign(privateKeyEntry.privateKey)
            update(serverChallengeNonce)
        }.sign()

        val certChain = keyStore.getCertificateChain(HSM_ATTESTATION_KEY_ALIAS) ?: emptyArray()

        return AttestationStatement(
            keyAlias = HSM_ATTESTATION_KEY_ALIAS,
            signatureBase64 = android.util.Base64.encodeToString(signature, android.util.Base64.NO_WRAP),
            certChainCount = certChain.size,
            isStrongBoxBacked = strongBoxUsed
        )
    }

    private fun generateEcdsaKeyPair(useStrongBox: Boolean, attestationChallenge: ByteArray) {
        val kpg = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, ANDROID_KEYSTORE)
        val builder = KeyGenParameterSpec.Builder(
            HSM_ATTESTATION_KEY_ALIAS,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
        )
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setAttestationChallenge(attestationChallenge)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && useStrongBox) {
            builder.setIsStrongBoxBacked(true)
        }

        kpg.initialize(builder.build())
        kpg.generateKeyPair()
    }
}

// =========================================================================================
// 4. TLS 1.3 + CONSCRYPT + CERTIFICATE PINNING + OPTIONAL HARDWARE-BACKED mTLS
// =========================================================================================
object MutualTlsSessionManager {
    private const val MTLS_CLIENT_KEY_ALIAS = "waqar_erp_mtls_client_ecdsa_key"

    /**
     * Real intermediate/root SPKI SHA-256 pins for Google Trust Services (`*.googleapis.com`,
     * `*.cloudfunctions.net`) matching `network_security_config.xml`:
     * - GTS Root R1: `hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=`
     * - GTS Root R2: `Vfd95BwDeSQo+NUYxVEEIlvkOlWY2SalKK1lPhzOx78=`
     * - DigiCert Global Root G2: `i7WTqTvh0OioIruIfFR4kMPnBqrS2rdiVPl/s2uC/CY=`
     */
    fun buildHardenedOkHttpClient(context: Context, enableChuckerInDebug: Boolean = true): OkHttpClient {
        ConscryptSecurityProvider.install()

        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val keyManagerFactory = runCatching {
            KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm()).apply {
                init(keyStore, null)
            }
        }.getOrNull()

        val trustManagerFactory = TrustManagerFactory.getInstance(
            TrustManagerFactory.getDefaultAlgorithm()
        ).apply {
            init(null as KeyStore?)
        }
        val trustManager = trustManagerFactory.trustManagers
            .filterIsInstance<X509TrustManager>()
            .first()

        val sslContext = runCatching {
            SSLContext.getInstance("TLSv1.3", "Conscrypt")
        }.getOrElse {
            SSLContext.getInstance("TLSv1.3")
        }.apply {
            init(keyManagerFactory?.keyManagers, arrayOf(trustManager), java.security.SecureRandom())
        }

        val certificatePinner = CertificatePinner.Builder()
            .add(
                "*.googleapis.com",
                "sha256/hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=",
                "sha256/Vfd95BwDeSQo+NUYxVEEIlvkOlWY2SalKK1lPhzOx78=",
                "sha256/i7WTqTvh0OioIruIfFR4kMPnBqrS2rdiVPl/s2uC/CY="
            )
            .add(
                "*.cloudfunctions.net",
                "sha256/hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=",
                "sha256/Vfd95BwDeSQo+NUYxVEEIlvkOlWY2SalKK1lPhzOx78=",
                "sha256/i7WTqTvh0OioIruIfFR4kMPnBqrS2rdiVPl/s2uC/CY="
            )
            .build()

        val builder = OkHttpClient.Builder()
            .sslSocketFactory(sslContext.socketFactory, trustManager)
            .certificatePinner(certificatePinner)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)

        if (enableChuckerInDebug) {
            runCatching {
                builder.addInterceptor(com.chuckerteam.chucker.api.ChuckerInterceptor.Builder(context).build())
            }
        }

        return builder.build()
    }
}

// =========================================================================================
// 5. GOOGLE TINK AEAD CRYPTOGRAPHIC VAULT (AES256_GCM WITH ASSOCIATED DATA)
// =========================================================================================
class TinkAeadVault(context: Context) {
    private val aead: Aead

    init {
        AeadConfig.register()
        val keysetHandle = AndroidKeysetManager.Builder()
            .withSharedPref(
                context.applicationContext,
                "waqar_erp_tink_keyset",
                "waqar_erp_tink_keyset_prefs"
            )
            .withKeyTemplate(KeyTemplates.get("AES256_GCM"))
            .withMasterKeyUri("android-keystore://waqar_erp_tink_master_key_v2")
            .build()
            .keysetHandle
        aead = keysetHandle.getPrimitive(RegistryConfiguration.get(), Aead::class.java)
    }

    fun encrypt(plaintext: ByteArray, associatedData: ByteArray): ByteArray {
        return aead.encrypt(plaintext, associatedData)
    }

    fun decrypt(ciphertext: ByteArray, associatedData: ByteArray): ByteArray {
        return aead.decrypt(ciphertext, associatedData)
    }
}

// =========================================================================================
// 6. SQLCIPHER 256-BIT ENCRYPTED DATABASE VAULT (DIRECT + ROOM SUPPORT FACTORY)
// =========================================================================================
class SqlCipherExamAttendanceVault(
    private val context: Context,
    private val tinkAeadVault: TinkAeadVault
) {
    companion object {
        private const val PREF_FILE = "waqar_sqlcipher_key_store"
        private const val KEY_WRAPPED_PASSPHRASE = "wrapped_sqlcipher_passphrase_v2"
        private const val PASSPHRASE_AAD = "waqar_sqlcipher_passphrase_aad_v2"
    }

    init {
        runCatching { SQLiteDatabase.loadLibs(context.applicationContext) }
    }

    /**
     * Retrieves or generates a random 32-byte passphrase wrapped by `TinkAeadVault`
     * (backed by Android Keystore) so the database key is never derived from a static string.
     */
    fun getOrCreateDatabasePassphrase(): ByteArray {
        val prefs = context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)
        val existingBase64 = prefs.getString(KEY_WRAPPED_PASSPHRASE, null)
        val aadBytes = PASSPHRASE_AAD.toByteArray(Charsets.UTF_8)

        if (!existingBase64.isNullOrBlank()) {
            runCatching {
                val wrapped = android.util.Base64.decode(existingBase64, android.util.Base64.NO_WRAP)
                return tinkAeadVault.decrypt(wrapped, aadBytes)
            }
        }

        val randomPassphrase = ByteArray(32).also { java.security.SecureRandom().nextBytes(it) }
        val wrapped = tinkAeadVault.encrypt(randomPassphrase, aadBytes)
        prefs.edit()
            .putString(
                KEY_WRAPPED_PASSPHRASE,
                android.util.Base64.encodeToString(wrapped, android.util.Base64.NO_WRAP)
            )
            .apply()
        return randomPassphrase
    }

    /**
     * Builds the `SupportFactory` required by `Room.databaseBuilder(...).openHelperFactory(...)`
     * so `WaqarDatabase` is encrypted on disk with SQLCipher AES-256.
     */
    fun createRoomSupportOpenHelperFactory(): SupportSQLiteOpenHelper.Factory {
        val passphraseBytes = getOrCreateDatabasePassphrase()
        return SupportFactory(passphraseBytes)
    }

    suspend fun openEncryptedAttendanceDatabase(): SQLiteDatabase = withContext(Dispatchers.IO) {
        val dbFile = context.getDatabasePath("waqar_attendance_sqlcipher.db")
        dbFile.parentFile?.mkdirs()
        val passphraseChars = getOrCreateDatabasePassphrase()
            .joinToString("") { "%02x".format(it) }
            .toCharArray()
        try {
            val db = SQLiteDatabase.openOrCreateDatabase(dbFile, passphraseChars, null)
            db.rawExecSQL("PRAGMA cipher_memory_security = ON;")
            db.rawExecSQL("PRAGMA journal_mode = WAL;")
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS secure_attendance_ledger (
                    record_id TEXT PRIMARY KEY NOT NULL,
                    student_id TEXT NOT NULL,
                    qr_nonce TEXT NOT NULL,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    accuracy_meters REAL NOT NULL,
                    recorded_at_ms INTEGER NOT NULL,
                    synced INTEGER NOT NULL DEFAULT 0
                );
                """.trimIndent()
            )
            db
        } finally {
            passphraseChars.fill('\u0000')
        }
    }
}

// =========================================================================================
// 7. ZERO-COPY FLATBUFFERS EXAM ENGINE (MATCHING `exam_schema.fbs`, NO ANSWER KEY ON CLIENT)
// =========================================================================================
object FlatBuffersExamEngine {
    data class FlatExamQuestionInput(
        val questionId: Long,
        val prompt: String,
        val options: List<String>,
        val difficultyRating: Int = 2,
        val mediaUrl: String = ""
    )

    data class FlatExamQuestionView(
        val questionId: Long,
        val prompt: String,
        val options: List<String>,
        val difficultyRating: Int,
        val mediaUrl: String
    )

    /**
     * Serializes an exam bundle using `FlatBufferBuilder` matching `src/main/flatbuffers/exam_schema.fbs`.
     * Note: `correctOptionIndex` is NEVER included in client exam bundles; grading happens on the server.
     */
    fun serializeExamPaperToFlatBuffer(
        examId: String,
        title: String,
        courseCode: String,
        durationSeconds: Int,
        serverIssuedAtEpochMs: Long,
        questions: List<FlatExamQuestionInput>
    ): ByteBuffer {
        val builder = FlatBufferBuilder(4096)

        val questionOffsets = IntArray(questions.size)
        for (i in questions.indices) {
            val q = questions[i]
            val promptOffset = builder.createString(q.prompt)
            val mediaOffset = builder.createString(q.mediaUrl)
            val optOffsets = IntArray(q.options.size) { idx ->
                builder.createString(q.options[idx])
            }
            val optionsVector = builder.createVectorOfTables(optOffsets)

            // Table Question { question_id:ulong(0), prompt:string(1), options:[string](2), difficulty:ubyte(3), media_url:string(4) }
            builder.startTable(5)
            builder.addLong(0, q.questionId, 0L)
            builder.addOffset(1, promptOffset, 0)
            builder.addOffset(2, optionsVector, 0)
            builder.addByte(3, q.difficultyRating.toByte(), 1)
            builder.addOffset(4, mediaOffset, 0)
            questionOffsets[i] = builder.endTable()
        }

        val questionsVector = builder.createVectorOfTables(questionOffsets)
        val examIdOffset = builder.createString(examId)
        val titleOffset = builder.createString(title)
        val courseCodeOffset = builder.createString(courseCode)

        // Table ExamBundle { exam_id(0), title(1), course_code(2), duration_seconds(3), server_issued_at_epoch_ms(4), questions(5) }
        builder.startTable(6)
        builder.addOffset(0, examIdOffset, 0)
        builder.addOffset(1, titleOffset, 0)
        builder.addOffset(2, courseCodeOffset, 0)
        builder.addInt(3, durationSeconds, 0)
        builder.addLong(4, serverIssuedAtEpochMs, 0L)
        builder.addOffset(5, questionsVector, 0)
        val rootTable = builder.endTable()
        builder.finish(rootTable, "WEDU")

        return builder.dataBuffer()
    }

    /**
     * Reads a Question directly from a FlatBuffers `ByteBuffer` without intermediate JSON parsing.
     */
    fun readQuestionZeroCopy(buffer: ByteBuffer, questionIndex: Int): FlatExamQuestionView {
        val bb = buffer.duplicate().order(ByteOrder.LITTLE_ENDIAN)
        val rootPos = bb.getInt(bb.position()) + bb.position()
        val vtablePos = rootPos - bb.getInt(rootPos)

        // Field 5 in ExamBundle is `questions:[Question]` (vtable offset = 4 + 2 * 5 = 14)
        val vtableSize = bb.getShort(vtablePos).toInt()
        val questionsFieldOffset = if (14 < vtableSize) bb.getShort(vtablePos + 14).toInt() else 0
        require(questionsFieldOffset != 0) { "No questions vector in ExamBundle FlatBuffer" }

        val vectorIndirect = rootPos + questionsFieldOffset
        val vectorStart = vectorIndirect + bb.getInt(vectorIndirect) + 4
        val elemIndirect = vectorStart + questionIndex * 4
        val qTablePos = elemIndirect + bb.getInt(elemIndirect)
        val qVtablePos = qTablePos - bb.getInt(qTablePos)
        val qVtableSize = bb.getShort(qVtablePos).toInt()

        fun fieldOffset(fieldIdx: Int): Int {
            val slot = 4 + fieldIdx * 2
            return if (slot < qVtableSize) bb.getShort(qVtablePos + slot).toInt() else 0
        }

        fun readStringField(fieldIdx: Int): String {
            val fOff = fieldOffset(fieldIdx)
            if (fOff == 0) return ""
            val strIndirect = qTablePos + fOff
            val strPos = strIndirect + bb.getInt(strIndirect)
            val len = bb.getInt(strPos)
            val bytes = ByteArray(len)
            val prevPos = bb.position()
            bb.position(strPos + 4)
            bb.get(bytes)
            bb.position(prevPos)
            return String(bytes, Charsets.UTF_8)
        }

        val idOff = fieldOffset(0)
        val questionId = if (idOff != 0) bb.getLong(qTablePos + idOff) else 0L
        val prompt = readStringField(1)

        val options = mutableListOf<String>()
        val optsOff = fieldOffset(2)
        if (optsOff != 0) {
            val optsIndirect = qTablePos + optsOff
            val optsVecPos = optsIndirect + bb.getInt(optsIndirect)
            val optsLen = bb.getInt(optsVecPos)
            val optsStart = optsVecPos + 4
            for (i in 0 until optsLen) {
                val strElemIndirect = optsStart + i * 4
                val strPos = strElemIndirect + bb.getInt(strElemIndirect)
                val len = bb.getInt(strPos)
                val bytes = ByteArray(len)
                val prevPos = bb.position()
                bb.position(strPos + 4)
                bb.get(bytes)
                bb.position(prevPos)
                options.add(String(bytes, Charsets.UTF_8))
            }
        }

        val diffOff = fieldOffset(3)
        val difficulty = if (diffOff != 0) bb.get(qTablePos + diffOff).toInt() else 1
        val mediaUrl = readStringField(4)

        return FlatExamQuestionView(
            questionId = questionId,
            prompt = prompt,
            options = options,
            difficultyRating = difficulty,
            mediaUrl = mediaUrl
        )
    }
}

// =========================================================================================
// 8. NATIVE CRASH HARVESTER + WORKMANAGER UPLOAD SCHEDULER
// =========================================================================================
object NativeCrashHarvester {
    init {
        NativeLibrary.ensureLoaded()
    }

    @JvmStatic
    external fun nativeInstallSignalHandlers(crashDumpDirPath: String)

    fun initialize(context: Context) {
        val crashDir = File(context.filesDir, "edusync_native_crashes").apply { mkdirs() }
        if (NativeLibrary.isAvailable()) {
            runCatching { nativeInstallSignalHandlers(crashDir.absolutePath) }
        }
        // If previous session left a native crash dump, enqueue CrashReportUploadWorker
        val pendingDumps = crashDir.listFiles { file -> file.name.endsWith(".dmp") } ?: emptyArray()
        if (pendingDumps.isNotEmpty()) {
            Timber.w("Found %d native crash dump(s) from prior run; scheduling upload worker", pendingDumps.size)
            val uploadRequest = OneTimeWorkRequestBuilder<CrashReportUploadWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                "waqar_native_crash_upload",
                ExistingWorkPolicy.KEEP,
                uploadRequest
            )
        }
    }
}

// =========================================================================================
// 9. NATIVE MIMALLOC-STYLE ARENA ALLOCATOR BRIDGE
// =========================================================================================
object MimallocNativeAllocator {
    init {
        NativeLibrary.ensureLoaded()
    }

    @JvmStatic
    external fun nativeInitializeMimallocHeap(): Long

    @JvmStatic
    external fun nativeAllocateAlignedArena(sizeBytes: Int): Long
}
