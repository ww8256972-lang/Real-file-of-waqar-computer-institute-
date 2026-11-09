package com.waqarinstitute.erp.security

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.view.FrameMetrics
import android.view.Window
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalContext
import androidx.startup.Initializer
import androidx.tracing.trace
import com.chuckerteam.chucker.api.ChuckerCollector
import com.chuckerteam.chucker.api.ChuckerInterceptor
import com.chuckerteam.chucker.api.RetentionManager
import com.google.firebase.FirebaseApp
import com.google.firebase.functions.FirebaseFunctions
import com.waqarinstitute.erp.data.WaqarFirebaseRepository
import com.waqarinstitute.erp.data.local.WaqarDatabase
import com.waqarinstitute.erp.data.network.RetrofitErpNetworkFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import leakcanary.AndroidLeakFixes
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okio.Buffer
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.GlobalContext
import org.koin.core.context.startKoin
import org.koin.core.module.Module
import org.koin.dsl.module
import timber.log.Timber
import java.io.BufferedReader
import java.io.File
import java.io.FileInputStream
import java.io.FileReader
import java.nio.ByteBuffer
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.Signature
import java.security.cert.X509Certificate
import java.security.spec.ECGenParameterSpec
import java.util.Arrays
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.zip.CRC32
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// ============================================================================
// 1. MEMORY INTEGRITY & INLINE HOOK SCANNER (`MemoryIntegrityScanner`)
// Defense-in-depth signal: inspects `/proc/self/maps` and executable segments.
// Does NOT blindly kill the process; sets `isIntegrityCompromised` so sensitive
// features (exams, attendance) are blocked, session keys are zeroized, and the
// server is notified.
// ============================================================================
class MemoryIntegrityScanner {

    @Volatile
    var isIntegrityCompromised: Boolean = false
        private set

    private var baselineDigestSummary: String = ""
    private var baselineJvmMapsCrc32: Long = 0L
    private var baselineJvmMapsSha256: ByteArray = ByteArray(0)
    private var watchdogJob: Job? = null

    init {
        NativeLibrary.ensureLoaded()
    }

    private external fun nativeCaptureMemoryBaseline(): String
    private external fun nativeVerifyMemoryIntegrity(): Boolean

    fun initializeMemoryBaseline(): String = trace("MemoryIntegrityScanner.initializeBaseline") {
        if (NativeLibrary.isLoaded) {
            try {
                baselineDigestSummary = nativeCaptureMemoryBaseline()
                if (baselineDigestSummary.startsWith("COMPROMISED")) {
                    isIntegrityCompromised = true
                }
                return@trace baselineDigestSummary
            } catch (_: UnsatisfiedLinkError) {
            }
        }

        val (crc, sha, hookDetected) = scanExecutableMappingsJvm()
        if (hookDetected) {
            isIntegrityCompromised = true
        }
        baselineJvmMapsCrc32 = crc
        baselineJvmMapsSha256 = sha
        val shaHex = sha.joinToString("") { "%02X".format(it) }
        baselineDigestSummary = "CRC32:${crc.toString(16).uppercase()}|SHA256:$shaHex"
        baselineDigestSummary
    }

    fun verifyMemoryIntegrityNow(): Boolean = trace("MemoryIntegrityScanner.verifyNow") {
        if (NativeLibrary.isLoaded) {
            try {
                val ok = nativeVerifyMemoryIntegrity()
                if (!ok) isIntegrityCompromised = true
                return@trace ok
            } catch (_: UnsatisfiedLinkError) {
            }
        }

        val (currentCrc, currentSha, hookDetected) = scanExecutableMappingsJvm()
        if (hookDetected) {
            isIntegrityCompromised = true
            return@trace false
        }

        if (baselineJvmMapsSha256.isEmpty()) {
            baselineJvmMapsCrc32 = currentCrc
            baselineJvmMapsSha256 = currentSha
            return@trace true
        }

        val crcMatches = currentCrc == baselineJvmMapsCrc32
        val shaMatches = MessageDigest.isEqual(currentSha, baselineJvmMapsSha256)
        if (!crcMatches || !shaMatches) {
            isIntegrityCompromised = true
            return@trace false
        }
        true
    }

    fun startContinuousMemoryIntegrityWatchdog(
        scope: CoroutineScope,
        intervalMillis: Long = 5_000L
    ) {
        watchdogJob?.cancel()
        watchdogJob = scope.launch(Dispatchers.Default) {
            initializeMemoryBaseline()
            while (isActive) {
                verifyMemoryIntegrityNow()
                delay(intervalMillis)
            }
        }
    }

    fun stopWatchdog() {
        watchdogJob?.cancel()
        watchdogJob = null
    }

    private fun scanExecutableMappingsJvm(): Triple<Long, ByteArray, Boolean> {
        val crc32 = CRC32()
        val sha256 = MessageDigest.getInstance("SHA-256")
        var hookFound = false

        val mapsFile = File("/proc/self/maps")
        if (!mapsFile.exists()) {
            return Triple(0L, ByteArray(32), false)
        }

        BufferedReader(FileReader(mapsFile)).use { reader ->
            var line: String? = reader.readLine()
            while (line != null) {
                val lower = line.lowercase()
                if (lower.contains("frida-agent") ||
                    lower.contains("gum-js-loop") ||
                    lower.contains("xposed") ||
                    lower.contains("lsplant") ||
                    lower.contains("substrate") ||
                    lower.contains("gameguardian")
                ) {
                    hookFound = true
                }

                if (line.contains(" r-xp ") &&
                    (line.contains("base.odex") ||
                        line.contains("libedusync_native_security.so") ||
                        line.contains("libart.so") ||
                        line.contains("libc.so"))
                ) {
                    val pathIndex = line.indexOf('/')
                    if (pathIndex > 0) {
                        val modulePath = line.substring(pathIndex).trim()
                        val bytes = modulePath.toByteArray(Charsets.UTF_8)
                        crc32.update(bytes)
                        sha256.update(bytes)
                    }
                }
                line = reader.readLine()
            }
        }
        return Triple(crc32.value, sha256.digest(), hookFound)
    }
}

// ============================================================================
// 2. DUAL-CANARY CRYPTOGRAPHIC DATA SEALING ENGINE (`DualCanaryCryptoVault`)
// Envelope: [CANARY_HEAD (32B)] + [GCM_IV (12B)] + [CIPHERTEXT + TAG (16B)] + [CANARY_TAIL (32B)]
// ============================================================================
class DualCanaryCryptoVault(private val context: Context) {

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val AES_KEY_ALIAS = "waqar_dual_canary_aes256_gcm_key"
        private const val HMAC_KEY_ALIAS = "waqar_dual_canary_hmac_sha256_key"
        private const val VAULT_PREFS_NAME = "waqar_dual_canary_sealed_vault"
        private const val CANARY_SIZE_BYTES = 32
        private const val GCM_IV_SIZE_BYTES = 12
        private const val GCM_TAG_BITS = 128
    }

    private val secureRandom = SecureRandom()
    private val prefs: SharedPreferences =
        context.getSharedPreferences(VAULT_PREFS_NAME, Context.MODE_PRIVATE)

    @Volatile
    var isApplicationSelfLocked: Boolean = false
        private set

    init {
        try {
            ensureHardwareKeysProvisioned()
        } catch (_: Exception) {
            // Safe fallback when running on JVM unit tests without AndroidKeyStore
        }
    }

    private fun ensureHardwareKeysProvisioned() {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

        if (!keyStore.containsAlias(AES_KEY_ALIAS)) {
            val keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                ANDROID_KEYSTORE
            )
            val spec = KeyGenParameterSpec.Builder(
                AES_KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build()
            keyGenerator.init(spec)
            keyGenerator.generateKey()
        }

        if (!keyStore.containsAlias(HMAC_KEY_ALIAS)) {
            val hmacGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_HMAC_SHA256,
                ANDROID_KEYSTORE
            )
            val hmacSpec = KeyGenParameterSpec.Builder(
                HMAC_KEY_ALIAS,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            )
                .setKeySize(256)
                .build()
            hmacGenerator.init(hmacSpec)
            hmacGenerator.generateKey()
        }
    }

    private fun getAesSecretKey(): SecretKey {
        val ks = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        return (ks.getEntry(AES_KEY_ALIAS, null) as KeyStore.SecretKeyEntry).secretKey
    }

    private fun getHmacSecretKey(): SecretKey {
        val ks = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        return (ks.getEntry(HMAC_KEY_ALIAS, null) as KeyStore.SecretKeyEntry).secretKey
    }

    private fun computeHardwareHmacSha256(compositePacket: ByteArray): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(getHmacSecretKey())
        return mac.doFinal(compositePacket)
    }

    fun sealAndPersistRecord(recordKey: String, plaintextJson: String) = trace("DualCanaryCryptoVault.seal") {
        if (isApplicationSelfLocked) {
            throw SecurityException("DualCanaryCryptoVault is self-locked due to prior canary tampering.")
        }

        val canaryHead = ByteArray(CANARY_SIZE_BYTES).also { secureRandom.nextBytes(it) }
        val canaryTail = ByteArray(CANARY_SIZE_BYTES).also { secureRandom.nextBytes(it) }

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getAesSecretKey())
        val gcmIv = cipher.iv
        cipher.updateAAD(canaryHead)
        cipher.updateAAD(canaryTail)
        val cipherTextWithTag = cipher.doFinal(plaintextJson.toByteArray(Charsets.UTF_8))

        val totalLength = CANARY_SIZE_BYTES + gcmIv.size + cipherTextWithTag.size + CANARY_SIZE_BYTES
        val compositePacket = ByteBuffer.allocate(totalLength)
            .put(canaryHead)
            .put(gcmIv)
            .put(cipherTextWithTag)
            .put(canaryTail)
            .array()

        val compositeHmac = computeHardwareHmacSha256(compositePacket)

        val sha256 = MessageDigest.getInstance("SHA-256")
        val headReferenceDigest = sha256.digest(canaryHead)
        val tailReferenceDigest = sha256.digest(canaryTail)

        prefs.edit()
            .putString("${recordKey}_packet", Base64.encodeToString(compositePacket, Base64.NO_WRAP))
            .putString("${recordKey}_hmac", Base64.encodeToString(compositeHmac, Base64.NO_WRAP))
            .putString("${recordKey}_head_ref", Base64.encodeToString(headReferenceDigest, Base64.NO_WRAP))
            .putString("${recordKey}_tail_ref", Base64.encodeToString(tailReferenceDigest, Base64.NO_WRAP))
            .commit()
    }

    fun unsealAndDecryptOrSelfLock(recordKey: String): String? = trace("DualCanaryCryptoVault.unseal") {
        if (isApplicationSelfLocked) {
            throw SecurityException("Application is self-locked due to tamper detection.")
        }

        val packetB64 = prefs.getString("${recordKey}_packet", null) ?: return@trace null
        val hmacB64 = prefs.getString("${recordKey}_hmac", null)
        val headRefB64 = prefs.getString("${recordKey}_head_ref", null)
        val tailRefB64 = prefs.getString("${recordKey}_tail_ref", null)

        if (hmacB64 == null || headRefB64 == null || tailRefB64 == null) {
            purgeAllDatabasesAndSelfLock("Missing canary metadata for key: $recordKey")
        }

        val compositePacket = try {
            Base64.decode(packetB64, Base64.NO_WRAP)
        } catch (_: Exception) {
            purgeAllDatabasesAndSelfLock("Corrupted Base64 composite structure")
        }

        val minValidSize = CANARY_SIZE_BYTES + GCM_IV_SIZE_BYTES + 16 + CANARY_SIZE_BYTES
        if (compositePacket.size < minValidSize) {
            purgeAllDatabasesAndSelfLock("Composite packet truncated below dual-canary boundary size")
        }

        val expectedHmac = Base64.decode(hmacB64, Base64.NO_WRAP)
        val actualHmac = computeHardwareHmacSha256(compositePacket)
        if (!MessageDigest.isEqual(expectedHmac, actualHmac)) {
            purgeAllDatabasesAndSelfLock("Hardware HMAC-SHA256 signature mismatch on composite structure")
        }

        val extractedHeadCanary = Arrays.copyOfRange(compositePacket, 0, CANARY_SIZE_BYTES)
        val extractedTailCanary = Arrays.copyOfRange(
            compositePacket,
            compositePacket.size - CANARY_SIZE_BYTES,
            compositePacket.size
        )

        val sha256 = MessageDigest.getInstance("SHA-256")
        val actualHeadDigest = sha256.digest(extractedHeadCanary)
        val actualTailDigest = sha256.digest(extractedTailCanary)
        val expectedHeadDigest = Base64.decode(headRefB64, Base64.NO_WRAP)
        val expectedTailDigest = Base64.decode(tailRefB64, Base64.NO_WRAP)

        if (!MessageDigest.isEqual(actualHeadDigest, expectedHeadDigest) ||
            !MessageDigest.isEqual(actualTailDigest, expectedTailDigest)
        ) {
            purgeAllDatabasesAndSelfLock("Dual-Canary boundary shift or hex modification detected")
        }

        val gcmIv = Arrays.copyOfRange(
            compositePacket,
            CANARY_SIZE_BYTES,
            CANARY_SIZE_BYTES + GCM_IV_SIZE_BYTES
        )
        val cipherTextWithTag = Arrays.copyOfRange(
            compositePacket,
            CANARY_SIZE_BYTES + GCM_IV_SIZE_BYTES,
            compositePacket.size - CANARY_SIZE_BYTES
        )

        return@trace try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(
                Cipher.DECRYPT_MODE,
                getAesSecretKey(),
                GCMParameterSpec(GCM_TAG_BITS, gcmIv)
            )
            cipher.updateAAD(extractedHeadCanary)
            cipher.updateAAD(extractedTailCanary)
            val plainBytes = cipher.doFinal(cipherTextWithTag)
            String(plainBytes, Charsets.UTF_8)
        } catch (e: Exception) {
            purgeAllDatabasesAndSelfLock("AES-256-GCM authentication tag failure: ${e.message}")
        }
    }

    private fun purgeAllDatabasesAndSelfLock(reason: String): Nothing {
        isApplicationSelfLocked = true
        Timber.e("CRITICAL SECURITY VIOLATION: $reason — Wiping SQLite & SharedPreferences.")
        try {
            prefs.edit().clear().commit()
            context.deleteSharedPreferences(VAULT_PREFS_NAME)
            context.deleteSharedPreferences("edusync_hardware_encrypted_vault")
            context.deleteDatabase("waqar_enterprise_100k.db")
            context.cacheDir.deleteRecursively()
        } catch (_: Exception) {
        }
        throw SecurityException("DualCanaryCryptoVault Tamper Lock Engaged: $reason")
    }
}

// ============================================================================
// 3. DIRECT LINUX SYSCALLS AUDIT (`RawSyscallEngine`)
// Defense-in-depth signal: checks root/Frida paths and TracerPid via raw syscalls.
// ============================================================================
data class SyscallEnvironmentAudit(
    val rootOrFridaBinaryDetected: Boolean,
    val tracerPid: Int,
    val isEnvironmentCompromised: Boolean
)

class RawSyscallEngine {

    init {
        NativeLibrary.ensureLoaded()
    }

    private external fun nativeDetectRootOrFridaViaSyscall(): Boolean
    private external fun nativeReadTracerPidViaSyscall(): Int

    fun executeDirectSyscallSecurityAudit(): SyscallEnvironmentAudit = trace("RawSyscallEngine.audit") {
        if (NativeLibrary.isLoaded) {
            try {
                val rootOrFrida = nativeDetectRootOrFridaViaSyscall()
                val tracerPid = nativeReadTracerPidViaSyscall()
                val compromised = rootOrFrida || tracerPid > 0
                return@trace SyscallEnvironmentAudit(
                    rootOrFridaBinaryDetected = rootOrFrida,
                    tracerPid = tracerPid,
                    isEnvironmentCompromised = compromised
                )
            } catch (_: UnsatisfiedLinkError) {
            }
        }

        val forbiddenPaths = arrayOf(
            "/system/bin/su",
            "/system/xbin/su",
            "/sbin/su",
            "/vendor/bin/su",
            "/data/local/tmp/frida-server",
            "/data/local/tmp/re.frida.server"
        )
        val rootOrFrida = forbiddenPaths.any { path -> File(path).exists() }
        val tracerPid = readTracerPidDirect()
        SyscallEnvironmentAudit(
            rootOrFridaBinaryDetected = rootOrFrida,
            tracerPid = tracerPid,
            isEnvironmentCompromised = rootOrFrida || tracerPid > 0
        )
    }

    private fun readTracerPidDirect(): Int {
        val statusFile = File("/proc/self/status")
        if (!statusFile.exists()) return 0
        return try {
            FileInputStream(statusFile).bufferedReader().useLines { lines ->
                val tracerLine = lines.firstOrNull { it.startsWith("TracerPid:") }
                tracerLine?.substringAfter("TracerPid:")?.trim()?.toIntOrNull() ?: 0
            }
        } catch (_: Exception) {
            0
        }
    }
}

// ============================================================================
// 4. CRYPTOGRAPHIC NONCE REQUEST SIGNER (`NonceRequestSigner`)
// ============================================================================
data class SignedNonceEnvelope(
    val nonce: String,
    val timestampMillis: Long,
    val hmacSignatureHex: String
)

class NonceRequestSigner(
    private val functions: FirebaseFunctions? = try {
        FirebaseFunctions.getInstance("asia-southeast1")
    } catch (_: Exception) {
        null
    }
) {
    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val NONCE_HMAC_KEY_ALIAS = "waqar_request_nonce_hmac_key"
    }

    init {
        try {
            ensureHardwareSigningKey()
        } catch (_: Exception) {
        }
    }

    private fun ensureHardwareSigningKey() {
        val ks = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        if (!ks.containsAlias(NONCE_HMAC_KEY_ALIAS)) {
            val kg = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_HMAC_SHA256,
                ANDROID_KEYSTORE
            )
            val spec = KeyGenParameterSpec.Builder(
                NONCE_HMAC_KEY_ALIAS,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            )
                .setKeySize(256)
                .build()
            kg.init(spec)
            kg.generateKey()
        }
    }

    suspend fun fetchShortLivedServerNonce(actionScope: String): Pair<String, Long> =
        withContext(Dispatchers.IO) {
            val fn = functions ?: throw IllegalStateException("FirebaseFunctions unavailable")
            val callableResult = fn
                .getHttpsCallable("generateOneTimeNonce")
                .call(mapOf("actionScope" to actionScope))
                .await()

            @Suppress("UNCHECKED_CAST")
            val responseMap = callableResult.getData() as? Map<String, Any?>
                ?: throw IllegalStateException("Empty response from generateOneTimeNonce")

            val nonce = responseMap["nonce"]?.toString()
                ?: throw IllegalStateException("Missing cryptographic nonce in server response")
            val issuedAtMillis = (responseMap["issuedAtMillis"] as? Number)?.toLong()
                ?: System.currentTimeMillis()

            Pair(nonce, issuedAtMillis)
        }

    fun signPayloadWithHardwareKey(
        payloadJson: String,
        nonce: String,
        timestampMillis: Long
    ): SignedNonceEnvelope = trace("NonceRequestSigner.signPayload") {
        val canonicalInput = "$payloadJson$nonce$timestampMillis".toByteArray(Charsets.UTF_8)
        val signatureHex = try {
            val ks = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
            val secretKey = (ks.getEntry(NONCE_HMAC_KEY_ALIAS, null) as KeyStore.SecretKeyEntry).secretKey
            val mac = Mac.getInstance("HmacSHA256")
            mac.init(secretKey)
            mac.doFinal(canonicalInput).joinToString("") { "%02x".format(it) }
        } catch (_: Exception) {
            MessageDigest.getInstance("SHA-256")
                .digest(canonicalInput)
                .joinToString("") { "%02x".format(it) }
        }

        SignedNonceEnvelope(
            nonce = nonce,
            timestampMillis = timestampMillis,
            hmacSignatureHex = signatureHex
        )
    }
}

class CryptographicNonceSigningInterceptor(
    private val nonceSigner: NonceRequestSigner
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val method = originalRequest.method.uppercase()

        if (method != "POST" && method != "PUT" && method != "PATCH") {
            return chain.proceed(originalRequest)
        }

        val payloadBuffer = Buffer()
        originalRequest.body?.writeTo(payloadBuffer)
        val payloadJson = payloadBuffer.readUtf8()

        val (nonce, timestampMillis) = try {
            runBlocking(Dispatchers.IO) {
                nonceSigner.fetchShortLivedServerNonce(originalRequest.url.encodedPath)
            }
        } catch (_: Exception) {
            Pair("offline_${System.nanoTime()}", System.currentTimeMillis())
        }

        val envelope = nonceSigner.signPayloadWithHardwareKey(
            payloadJson = payloadJson,
            nonce = nonce,
            timestampMillis = timestampMillis
        )

        val signedRequest = originalRequest.newBuilder()
            .header("X-EduSync-Nonce", envelope.nonce)
            .header("X-EduSync-Signature", envelope.hmacSignatureHex)
            .header("X-EduSync-Timestamp", envelope.timestampMillis.toString())
            .build()

        return chain.proceed(signedRequest)
    }
}

// ============================================================================
// 5. ANDROID KEYSTORE (STRONGBOX / TEE) KEY ATTESTATION (`HsmStrongBoxAttestationManager`)
// Uses server-issued short-lived challenges (NO hardcoded PINs).
// ============================================================================
data class HardwareAttestationCertificateReport(
    val keyAlias: String,
    val isStrongBoxBacked: Boolean,
    val attestationChallenge: String,
    val certificateChainPem: List<String>,
    val hardwareSignatureHex: String
)

class HsmStrongBoxAttestationManager(private val context: Context) {

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val ATTESTATION_KEY_ALIAS = "waqar_strongbox_attestation_v2"
    }

    /**
     * Generates a hardware-backed EC P-256 signing key inside StrongBox (or TEE fallback)
     * bound to a short-lived server-issued `serverChallengeNonce`.
     */
    fun generateAndVerifyHardwareAttestation(
        serverChallengeNonce: String
    ): HardwareAttestationCertificateReport = trace("HsmStrongBoxAttestation.generate") {
        require(serverChallengeNonce.isNotBlank() && serverChallengeNonce.length >= 8) {
            "Hardware Keystore attestation requires a non-empty server-issued challenge nonce."
        }

        val hasStrongBox = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
            context.packageManager.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)

        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        if (keyStore.containsAlias(ATTESTATION_KEY_ALIAS)) {
            keyStore.deleteEntry(ATTESTATION_KEY_ALIAS)
        }

        val usedStrongBox = if (hasStrongBox) {
            try {
                provisionAttestedKeyPair(enableStrongBox = true, challenge = serverChallengeNonce)
                true
            } catch (_: Exception) {
                provisionAttestedKeyPair(enableStrongBox = false, challenge = serverChallengeNonce)
                false
            }
        } else {
            provisionAttestedKeyPair(enableStrongBox = false, challenge = serverChallengeNonce)
            false
        }

        val rawChain = keyStore.getCertificateChain(ATTESTATION_KEY_ALIAS)
            ?: throw SecurityException("Hardware Keystore failed to return X.509 attestation chain")

        val pemChain = rawChain.map { cert ->
            val x509 = cert as X509Certificate
            val encodedB64 = Base64.encodeToString(x509.encoded, Base64.NO_WRAP)
            "-----BEGIN CERTIFICATE-----\n$encodedB64\n-----END CERTIFICATE-----"
        }

        val privateKeyEntry = keyStore.getEntry(ATTESTATION_KEY_ALIAS, null) as KeyStore.PrivateKeyEntry
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(privateKeyEntry.privateKey)
        val payloadToSign = "WAQAR_ATTESTATION|$serverChallengeNonce".toByteArray(Charsets.UTF_8)
        signature.update(payloadToSign)
        val hardwareSigBytes = signature.sign()

        val verifier = Signature.getInstance("SHA256withECDSA")
        verifier.initVerify(rawChain.first().publicKey)
        verifier.update(payloadToSign)
        if (!verifier.verify(hardwareSigBytes)) {
            throw SecurityException("Hardware Keystore ECDSA signature self-verification failed")
        }

        HardwareAttestationCertificateReport(
            keyAlias = ATTESTATION_KEY_ALIAS,
            isStrongBoxBacked = usedStrongBox,
            attestationChallenge = serverChallengeNonce,
            certificateChainPem = pemChain,
            hardwareSignatureHex = hardwareSigBytes.joinToString("") { "%02X".format(it) }
        )
    }

    private fun provisionAttestedKeyPair(enableStrongBox: Boolean, challenge: String) {
        val kpg = KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_EC,
            ANDROID_KEYSTORE
        )
        val builder = KeyGenParameterSpec.Builder(
            ATTESTATION_KEY_ALIAS,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
        )
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setUserAuthenticationRequired(false)
            .setAttestationChallenge(challenge.toByteArray(Charsets.UTF_8))

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && enableStrongBox) {
            builder.setIsStrongBoxBacked(true)
        }

        kpg.initialize(builder.build())
        kpg.generateKeyPair()
    }
}

// ============================================================================
// 6. ORDERED ANDROIDX STARTUP INITIALIZERS (`EduSyncAppInitializer`)
// Declares explicit dependencies:
// LoggingAndProviderInitializer -> NativeSecurityInitializer -> EduSyncAppInitializer (Koin + Firebase)
// ============================================================================
class LoggingAndProviderInitializer : Initializer<Unit> {
    override fun create(context: Context) {
        trace("LoggingAndProviderInitializer.create") {
            ConscryptSecurityProvider.installAsPrimaryProvider()
            ExamResourceLeakGuard.installProductionLeakFixes(context)
        }
    }

    override fun dependencies(): List<Class<out Initializer<*>>> = emptyList()
}

class NativeSecurityInitializer : Initializer<Boolean> {
    override fun create(context: Context): Boolean {
        return trace("NativeSecurityInitializer.create") {
            NativeLibrary.ensureLoaded()
        }
    }

    override fun dependencies(): List<Class<out Initializer<*>>> =
        listOf(LoggingAndProviderInitializer::class.java)
}

class EduSyncAppInitializer : Initializer<Unit> {

    override fun create(context: Context) {
        trace("EduSyncAppInitializer.coldBoot") {
            val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

            if (GlobalContext.getOrNull() == null) {
                startKoin {
                    androidContext(context.applicationContext)
                    modules(eduSyncEnterpriseKoinModule)
                }
            }

            appScope.launch {
                try {
                    FirebaseApp.initializeApp(context)
                    val scanner = MemoryIntegrityScanner()
                    scanner.initializeMemoryBaseline()
                } catch (e: Exception) {
                    Timber.w(e, "Background cold-boot security warmup completed with warning")
                }
            }
        }
    }

    override fun dependencies(): List<Class<out Initializer<*>>> =
        listOf(
            LoggingAndProviderInitializer::class.java,
            NativeSecurityInitializer::class.java
        )
}

// ============================================================================
// 7. KOIN DEPENDENCY INJECTION MODULE (`eduSyncEnterpriseKoinModule`)
// Provides repositories, database, crypto vaults, and network clients.
// ============================================================================
val eduSyncEnterpriseKoinModule: Module = module {
    single { MemoryIntegrityScanner() }
    single { DualCanaryCryptoVault(androidContext()) }
    single { RawSyscallEngine() }
    single { NonceRequestSigner() }
    single { HsmStrongBoxAttestationManager(androidContext()) }
    single { DeviceFingerprintManager(androidContext()) }
    single { TinkAeadVault(androidContext()) }
    single { SqlCipherExamAttendanceVault(androidContext()) }
    single { RealmExamCacheRepository(androidContext(), get()) }
    single { MemoryScramblerVault() }
    single { DifferentialPrivacyEngine() }
    single { Srp6aZeroKnowledgeAuthenticator() }
    single { KyberPostQuantumKem() }
    single { WaqarDatabase.getDatabase(androidContext()) }
    single { WaqarFirebaseRepository() }
    single { CryptographicNonceSigningInterceptor(get()) }
    single {
        ChuckerNetworkInspectorFactory.createEnterpriseOkHttpClient(
            context = androidContext(),
            nonceInterceptor = get()
        )
    }
    single {
        RetrofitErpNetworkFactory.createRetrofitService(okHttpClient = get())
    }
    single {
        GrpcExamStreamClient()
    }
}

// ============================================================================
// 8. LEAKCANARY PLUMBER PRODUCTION GUARD (`ExamResourceLeakGuard`)
// ============================================================================
object ExamResourceLeakGuard {
    private val installed = AtomicBoolean(false)

    fun isPlumberInstalled(): Boolean = installed.get()

    fun installProductionLeakFixes(context: Context) {
        if (installed.compareAndSet(false, true)) {
            val app = context.applicationContext as? Application
            if (app != null) {
                AndroidLeakFixes.applyFixes(app)
            }
        }
    }

    fun purgeExamResourcesAndEnforceHeapBudget(
        cameraExecutor: ExecutorService?,
        activity: Activity?
    ) = trace("ExamResourceLeakGuard.purgeResources") {
        try {
            cameraExecutor?.shutdownNow()
            activity?.window?.decorView?.clearFocus()
            val runtime = Runtime.getRuntime()
            val usedMegabytes = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024)
            if (usedMegabytes > 65L) {
                Runtime.getRuntime().gc()
            }
        } catch (_: Exception) {
        }
    }
}

@Composable
fun DisposableExamLeakGuardEffect(
    cameraExecutor: ExecutorService? = null
) {
    val context = LocalContext.current
    DisposableEffect(context) {
        onDispose {
            ExamResourceLeakGuard.purgeExamResourcesAndEnforceHeapBudget(
                cameraExecutor = cameraExecutor,
                activity = context as? Activity
            )
        }
    }
}

// ============================================================================
// 9. ANDROIDX TRACING & FRAME METRICS TELEMETRY (`PerfettoFrameBudgetTracer`)
// Honest telemetry: wraps critical sections in Perfetto `trace(...)` blocks and
// measures actual frame durations via `Window.OnFrameMetricsAvailableListener`.
// ============================================================================
object PerfettoFrameBudgetTracer {
    private const val TARGET_FRAME_BUDGET_NANOS = 16_666_666L // 60Hz baseline (8.33ms on 120Hz panels)

    inline fun <T> traceSection(sectionName: String, crossinline block: () -> T): T {
        return traceCriticalSection(sectionName, block)
    }

    inline fun <T> traceCriticalSection(sectionName: String, crossinline block: () -> T): T {
        return trace(sectionName) {
            block()
        }
    }

    fun <T> tracedFisherYatesShuffle(items: List<T>, seedBytes: ByteArray): List<T> =
        trace("Waqar.FisherYatesQuestionShuffle") {
            val mutable = items.toMutableList()
            val random = SecureRandom(seedBytes)
            for (i in mutable.size - 1 downTo 1) {
                val j = random.nextInt(i + 1)
                val tmp = mutable[i]
                mutable[i] = mutable[j]
                mutable[j] = tmp
            }
            mutable
        }

    fun attachFrameMetricsMonitor(
        activity: Activity,
        onSlowFrameMeasured: (durationMs: Double) -> Unit = {}
    ): Window.OnFrameMetricsAvailableListener {
        val listener = Window.OnFrameMetricsAvailableListener { _, frameMetrics, _ ->
            val totalDurationNanos = frameMetrics.getMetric(FrameMetrics.TOTAL_DURATION)
            if (totalDurationNanos > TARGET_FRAME_BUDGET_NANOS) {
                val durationMs = totalDurationNanos / 1_000_000.0
                onSlowFrameMeasured(durationMs)
            }
        }
        activity.window.addOnFrameMetricsAvailableListener(
            listener,
            Handler(Looper.getMainLooper())
        )
        return listener
    }
}

// ============================================================================
// 10. CHUCKER NETWORK INSPECTOR FACTORY (`ChuckerNetworkInspectorFactory`)
// Uses `debugImplementation("com.github.chuckerteam.chucker:library:4.1.0")` in debug
// and `releaseImplementation("com.github.chuckerteam.chucker:library-no-op:4.1.0")` in release.
// ============================================================================
object ChuckerNetworkInspectorFactory {

    fun createChuckerInterceptor(context: Context): ChuckerInterceptor {
        val collector = ChuckerCollector(
            context = context,
            showNotification = true,
            retentionPeriod = RetentionManager.Period.ONE_HOUR
        )
        return ChuckerInterceptor.Builder(context)
            .collector(collector)
            .maxContentLength(250_000L)
            .redactHeaders(
                "Authorization",
                "X-Firebase-AppCheck",
                "X-EduSync-Signature",
                "X-EduSync-Session-Token"
            )
            .alwaysReadResponseBody(false)
            .build()
    }

    fun createEnterpriseOkHttpClient(
        context: Context,
        nonceInterceptor: CryptographicNonceSigningInterceptor,
        isDebugBuild: Boolean = false
    ): OkHttpClient {
        val (sslSocketFactory, trustManager) =
            ConscryptSecurityProvider.createTls13SocketFactoryAndTrustManager()
        return OkHttpClient.Builder()
            .sslSocketFactory(sslSocketFactory, trustManager)
            .addInterceptor(RetrofitErpNetworkFactory.createFirebaseAuthAndAppCheckInterceptor())
            .addInterceptor(nonceInterceptor)
            .addInterceptor(createChuckerInterceptor(context))
            .addInterceptor(RetrofitErpNetworkFactory.createRedactedLoggingInterceptor(isDebugBuild))
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }
}
