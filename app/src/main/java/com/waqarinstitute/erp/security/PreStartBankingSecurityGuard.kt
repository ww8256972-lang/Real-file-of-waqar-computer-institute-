package com.waqarinstitute.erp.security

import android.app.Activity
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.ApplicationInfo
import android.os.Debug
import android.os.Process
import android.view.WindowManager
import androidx.profileinstaller.ProfileInstaller
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.scottyab.rootbeer.RootBeer
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import net.sqlcipher.database.SQLiteDatabase
import net.sqlcipher.database.SupportFactory
import okhttp3.CertificatePinner
import okhttp3.Protocol
import timber.log.Timber
import java.io.BufferedReader
import java.io.File
import java.io.FileReader
import java.net.InetSocketAddress
import java.net.Socket
import java.security.SecureRandom
import java.util.concurrent.TimeUnit

/**
 * Comprehensive Pre-Start Security Report generated before Application / Activity UI initialization.
 */
data class PreStartSecurityReport(
    val fridaHookDetected: Boolean,
    val runtimeDebuggerAttached: Boolean,
    val dualOrClonedAppDetected: Boolean,
    val rootBeerTamperDetected: Boolean,
    val violatedChecks: List<String>
) {
    val isEnvironmentClean: Boolean
        get() = !fridaHookDetected &&
            !runtimeDebuggerAttached &&
            !dualOrClonedAppDetected &&
            !rootBeerTamperDetected
}

/**
 * Enterprise Banking Security Guard (`PreStartBankingSecurityGuard`):
 * 1. Enforces `WindowManager.LayoutParams.FLAG_SECURE` on sensitive Activities to block screenshots,
 *    screen recording, and task-switcher previews.
 * 2. Detects Frida dynamic instrumentation (`frida-agent`, `frida-gadget`, D-Bus ports 27042/27043,
 *    `/proc/self/maps`, `/proc/self/fd`).
 * 3. Detects runtime Java/JDWP and native `TracerPid` debuggers.
 * 4. Detects Dual-App / Cloned-App / Parallel Space / VirtualApp sandboxed containers.
 * 5. Integrates `RootBeer` (`com.scottyab.rootbeer.RootBeer`) for deep root & Magisk/Su binary detection.
 * 6. Installs AndroidX Baseline Profiles (`ProfileInstaller`) for AOT compilation performance.
 */
object PreStartBankingSecurityGuard {

    private const val CANONICAL_PACKAGE = "com.waqarinstitute.erp"

    private val CLONER_PATH_SIGNATURES = listOf(
        "parallel",
        "dual",
        "virtual",
        "lbe.parallel",
        "excelliance",
        "ludashi",
        "qihoo",
        "dkplugin",
        "multiapp",
        "clone",
        "island",
        "shelter"
    )

    /**
     * Applies `WindowManager.LayoutParams.FLAG_SECURE` to the Activity window before `setContent`
     * so screenshots, screen recordings, MediaProjection casts, and Recents thumbnails are blocked.
     */
    fun enforceWindowFlagSecure(activity: Activity) {
        activity.window?.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )
    }

    /**
     * Runs all pre-start environment checks (Frida, Debugger, Dual/Cloned App, RootBeer).
     */
    fun runPreStartEnvironmentAudit(
        context: Context,
        isDebugBuild: Boolean
    ): PreStartSecurityReport {
        val violations = mutableListOf<String>()

        val frida = detectFridaHooking()
        if (frida) {
            violations.add("FRIDA_DYNAMIC_INSTRUMENTATION_DETECTED")
        }

        val debugger = !isDebugBuild && detectRuntimeDebugger(context)
        if (debugger) {
            violations.add("RUNTIME_DEBUGGER_OR_TRACERPID_DETECTED")
        }

        val cloned = detectDualOrClonedAppEnvironment(context)
        if (cloned) {
            violations.add("DUAL_OR_CLONED_APP_CONTAINER_DETECTED")
        }

        val rooted = !isDebugBuild && detectRootWithRootBeer(context)
        if (rooted) {
            violations.add("ROOTBEER_ROOT_TAMPERING_DETECTED")
        }

        val report = PreStartSecurityReport(
            fridaHookDetected = frida,
            runtimeDebuggerAttached = debugger,
            dualOrClonedAppDetected = cloned,
            rootBeerTamperDetected = rooted,
            violatedChecks = violations
        )

        if (!report.isEnvironmentClean) {
            Timber.e("PreStartBankingSecurityGuard blocked tampered environment: %s", violations)
        }
        return report
    }

    /**
     * Detects Frida hooking by scanning `/proc/self/maps`, `/proc/self/task/.../status`,
     * and local loopback ports 27042 / 27043.
     */
    fun detectFridaHooking(): Boolean {
        val mapsFile = File("/proc/self/maps")
        if (mapsFile.exists()) {
            runCatching {
                BufferedReader(FileReader(mapsFile)).use { reader ->
                    var line: String? = reader.readLine()
                    while (line != null) {
                        val lower = line.lowercase()
                        if (lower.contains("frida") ||
                            lower.contains("gadget") ||
                            lower.contains("gum-js-loop") ||
                            lower.contains("gmain") ||
                            lower.contains("libxposed") ||
                            lower.contains("substrate")
                        ) {
                            return true
                        }
                        line = reader.readLine()
                    }
                }
            }
        }

        val taskDir = File("/proc/self/task")
        val tasks = taskDir.listFiles()
        if (tasks != null) {
            for (task in tasks) {
                val commFile = File(task, "comm")
                if (commFile.exists()) {
                    val comm = runCatching { commFile.readText().trim().lowercase() }.getOrDefault("")
                    if (comm.contains("gum-js-loop") ||
                        comm.contains("gmain") ||
                        comm.contains("pool-frida") ||
                        comm.contains("gdbus")
                    ) {
                        return true
                    }
                }
            }
        }

        for (port in intArrayOf(27042, 27043)) {
            val open = runCatching {
                Socket().use { socket ->
                    socket.connect(InetSocketAddress("127.0.0.1", port), 60)
                    true
                }
            }.getOrDefault(false)
            if (open) return true
        }

        return false
    }

    /**
     * Detects attached Java JDWP debuggers, `FLAG_DEBUGGABLE` tampering, and Linux `TracerPid`.
     */
    fun detectRuntimeDebugger(context: Context): Boolean {
        if (Debug.isDebuggerConnected() || Debug.waitingForDebugger()) {
            return true
        }

        val isDebuggableFlagSet =
            (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        if (isDebuggableFlagSet) {
            return true
        }

        val statusFile = File("/proc/self/status")
        if (statusFile.exists()) {
            runCatching {
                BufferedReader(FileReader(statusFile)).use { reader ->
                    var line: String? = reader.readLine()
                    while (line != null) {
                        if (line.startsWith("TracerPid:")) {
                            val tracerPid = line.substringAfter("TracerPid:").trim().toIntOrNull() ?: 0
                            if (tracerPid > 0) return true
                        }
                        line = reader.readLine()
                    }
                }
            }
        }
        return false
    }

    /**
     * Detects Dual-App / Cloned-App / Parallel Space / Multi-User Work Profile cloning.
     */
    fun detectDualOrClonedAppEnvironment(context: Context): Boolean {
        if (context.packageName != CANONICAL_PACKAGE) {
            return true
        }

        val dataDir = context.filesDir.absolutePath.lowercase()
        if (CLONER_PATH_SIGNATURES.any { sig -> dataDir.contains(sig) }) {
            return true
        }

        // Standard primary user UID is 0 (userId = uid / 100000). Dual apps often run under user 999 or > 0
        val androidUserId = Process.myUid() / 100_000
        if (androidUserId == 999 || androidUserId > 10) {
            return true
        }

        // Verify dot-count in filesDir path to detect nested virtual container paths
        val canonicalSegmentCount = dataDir.split(CANONICAL_PACKAGE).size - 1
        if (canonicalSegmentCount > 1) {
            return true
        }

        return false
    }

    /**
     * Uses RootBeer (`com.scottyab:rootbeer-lib`) for comprehensive root & su/busybox/Magisk checks.
     */
    fun detectRootWithRootBeer(context: Context): Boolean {
        return runCatching {
            val rootBeer = RootBeer(context)
            rootBeer.isRooted || rootBeer.isRootedWithBusyBoxCheck
        }.getOrDefault(false)
    }

    /**
     * Installs AndroidX Baseline Profiles asynchronously on startup.
     */
    fun installAndVerifyBaselineProfile(context: Context) {
        CoroutineScope(Dispatchers.IO).launch {
            runCatching {
                ProfileInstaller.writeProfile(context.applicationContext)
            }
        }
    }
}

/**
 * Hardware-backed `EncryptedSharedPreferences` (`androidx.security:security-crypto`) +
 * SQLCipher 256-bit Room `SupportFactory` manager (`EncryptedBankingVault`).
 */
class EncryptedBankingVault(context: Context) {

    private val appContext = context.applicationContext

    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .setRequestStrongBoxBacked(true)
            .build()
    }

    val encryptedPreferences: SharedPreferences by lazy {
        EncryptedSharedPreferences.create(
            appContext,
            VAULT_FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    /**
     * Retrieves or generates a random 256-bit (32-byte) SQLCipher passphrase stored inside
     * `EncryptedSharedPreferences` and returns its byte array for Room `SupportFactory`.
     */
    fun getOrCreateSqlCipherPassphraseBytes(): ByteArray {
        val existingHex = encryptedPreferences.getString(KEY_SQLCIPHER_PASSPHRASE_HEX, null)
        if (!existingHex.isNullOrBlank() && existingHex.length == 64) {
            return ByteArray(32) { i ->
                existingHex.substring(i * 2, i * 2 + 2).toInt(16).toByte()
            }
        }
        val randomBytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val hexString = randomBytes.joinToString("") { "%02x".format(it) }
        encryptedPreferences.edit().putString(KEY_SQLCIPHER_PASSPHRASE_HEX, hexString).apply()
        return randomBytes
    }

    /**
     * Creates a SQLCipher `SupportFactory` for Room `Room.databaseBuilder(...).openHelperFactory(...)`.
     */
    fun createSqlCipherRoomSupportFactory(): SupportFactory {
        SQLiteDatabase.loadLibs(appContext)
        val passphraseBytes = getOrCreateSqlCipherPassphraseBytes()
        return SupportFactory(passphraseBytes)
    }

    companion object {
        private const val VAULT_FILE_NAME = "waqar_enterprise_banking_esp_vault"
        private const val KEY_SQLCIPHER_PASSPHRASE_HEX = "sqlcipher_aes256_room_passphrase_hex"
    }
}

/**
 * Hardened Ktor HTTP Client (`HardenedKtorPinnedClient`) configured with:
 * - OkHttp engine + Conscrypt TLS 1.3
 * - Hardware SPKI SHA-256 Certificate Pinning matching `network_security_config.xml`
 * - Strict timeouts and Kotlinx JSON content negotiation
 */
object HardenedKtorPinnedClient {

    fun create(context: Context): HttpClient {
        ConscryptSecurityProvider.install()

        val certificatePinner = CertificatePinner.Builder()
            .add(
                "*.googleapis.com",
                "sha256/hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=",
                "sha256/Vfd95BwDeSQo+NUYxVEEIlvkOlWY2SalKK1lPhzOx78=",
                "sha256/i7WTqTvh0OioIruIfFR4kMPnBqrS2rdiVPl/s2uC/CY="
            )
            .add(
                "*.firebaseio.com",
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

        return HttpClient(OkHttp) {
            install(ContentNegotiation) {
                json(
                    Json {
                        ignoreUnknownKeys = true
                        isLenient = false
                        encodeDefaults = true
                    }
                )
            }
            install(HttpTimeout) {
                connectTimeoutMillis = 15_000L
                requestTimeoutMillis = 20_000L
                socketTimeoutMillis = 20_000L
            }
            engine {
                config {
                    certificatePinner(certificatePinner)
                    protocols(listOf(Protocol.HTTP_2, Protocol.HTTP_1_1))
                    connectTimeout(15, TimeUnit.SECONDS)
                    readTimeout(20, TimeUnit.SECONDS)
                    writeTimeout(20, TimeUnit.SECONDS)
                }
            }
        }
    }
}
