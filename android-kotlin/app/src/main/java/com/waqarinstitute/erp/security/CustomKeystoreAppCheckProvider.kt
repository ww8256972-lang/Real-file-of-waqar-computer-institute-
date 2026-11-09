package com.waqarinstitute.erp.security

import android.content.Context
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.AppCheckProvider
import com.google.firebase.appcheck.AppCheckProviderFactory
import com.google.firebase.appcheck.AppCheckToken
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory
import com.google.firebase.functions.FirebaseFunctions
import java.util.concurrent.Executors

/**
 * Custom Firebase App Check Provider for direct sideloaded APKs (no Google Play Store / Play Integrity).
 *
 * Uses Android Hardware Keystore key-attestation certificates signed by device silicon and verified
 * by the `exchangeKeyAttestationForAppCheckToken` Cloud Function, which mints a custom App Check token
 * via Firebase Admin SDK (`admin.appCheck().createToken(appId)`).
 * Debug builds use `DebugAppCheckProviderFactory` as required by Section 2.8.
 */
class CustomKeystoreAppCheckToken(
    private val rawToken: String,
    private val expireTimeMillis: Long
) : AppCheckToken() {
    override fun getToken(): String = rawToken
    override fun getExpireTimeMillis(): Long = expireTimeMillis
}

class CustomKeystoreAppCheckProvider(
    private val context: Context,
    private val functions: FirebaseFunctions = FirebaseFunctions.getInstance("asia-southeast1")
) : AppCheckProvider {

    private val backgroundExecutor = Executors.newSingleThreadExecutor()

    override fun getToken(): Task<AppCheckToken> {
        return Tasks.call(backgroundExecutor) {
            val challengeCallable = functions
                .getHttpsCallable("generateOneTimeNonce")
                .call(mapOf("actionScope" to "app_check_attestation"))
            val challengeResult = Tasks.await(challengeCallable)
            @Suppress("UNCHECKED_CAST")
            val challengeMap = challengeResult.getData() as? Map<String, Any?>
            val serverChallenge = challengeMap?.get("nonce")?.toString()
                ?: throw SecurityException("Failed to obtain server challenge for App Check attestation")

            val attestationManager = HsmStrongBoxAttestationManager(context)
            val report = attestationManager.generateAndVerifyHardwareAttestation(serverChallenge)

            val exchangeCallable = functions
                .getHttpsCallable("exchangeKeyAttestationForAppCheckToken")
                .call(
                    mapOf(
                        "challenge" to serverChallenge,
                        "certificateChainPem" to report.certificateChainPem,
                        "signatureHex" to report.hardwareSignatureHex,
                        "isStrongBoxBacked" to report.isStrongBoxBacked
                    )
                )
            val exchangeResult = Tasks.await(exchangeCallable)
            @Suppress("UNCHECKED_CAST")
            val tokenMap = exchangeResult.getData() as? Map<String, Any?>
                ?: throw SecurityException("Empty response from exchangeKeyAttestationForAppCheckToken")

            val tokenStr = tokenMap["token"]?.toString()
                ?: throw SecurityException("Missing App Check token in server response")
            val ttlMillis = (tokenMap["ttlMillis"] as? Number)?.toLong() ?: (60L * 60L * 1000L)

            CustomKeystoreAppCheckToken(
                rawToken = tokenStr,
                expireTimeMillis = System.currentTimeMillis() + ttlMillis
            )
        }
    }
}

class KeystoreAttestationAppCheckProviderFactory(
    private val context: Context
) : AppCheckProviderFactory {
    override fun create(firebaseApp: FirebaseApp): AppCheckProvider {
        return CustomKeystoreAppCheckProvider(context.applicationContext)
    }
}

object WaqarAppCheckInstaller {
    fun installAppCheck(context: Context, isDebugBuild: Boolean) {
        try {
            val firebaseAppCheck = FirebaseAppCheck.getInstance()
            if (isDebugBuild) {
                firebaseAppCheck.installAppCheckProviderFactory(
                    DebugAppCheckProviderFactory.getInstance()
                )
            } else {
                firebaseAppCheck.installAppCheckProviderFactory(
                    KeystoreAttestationAppCheckProviderFactory(context.applicationContext)
                )
            }
        } catch (_: Exception) {
            // Safe guard during unit tests without FirebaseApp initialization
        }
    }
}
