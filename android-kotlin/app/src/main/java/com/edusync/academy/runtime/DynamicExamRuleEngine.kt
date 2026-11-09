package com.edusync.academy.runtime

import com.edusync.academy.security.SodiumCryptoManager
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject
import timber.log.Timber

/**
 * DynamicExamRuleEngine
 * Kotlin Orchestrator for Library 2: QuickJS Embedded C Native Engine.
 * Fetches dynamic grading and proctoring rule scripts from Firestore (`app_config/exam_rules`),
 * decrypts them via libsodium, and evaluates them inside the sandboxed QuickJS native engine.
 */
object DynamicExamRuleEngine {

    init {
        try {
            System.loadLibrary("edusync_core_security")
        } catch (e: UnsatisfiedLinkError) {
            try {
                System.loadLibrary("edusync_native_security")
            } catch (err: UnsatisfiedLinkError) {
                Timber.w("Native engine library not loaded yet: ${err.message}")
            }
        }
    }

    @JvmStatic
    external fun evaluateRule(jsBytecodeScript: String, inputJson: String): String

    data class RuleEvaluationResult(
        val success: Boolean,
        val scoreAdjustment: Double,
        val fraudFlag: Boolean,
        val rawJson: String,
        val error: String? = null
    )

    /**
     * Downloads encrypted JS rule snippet from Firestore app_config/exam_rules,
     * decrypts via libsodium, and executes inside QuickJS sandbox.
     */
    suspend fun fetchAndEvaluateExamRule(
        ruleId: String,
        examContextJson: String,
        decryptionKey: ByteArray,
        nonce: ByteArray
    ): RuleEvaluationResult = withContext(Dispatchers.IO) {
        try {
            val firestore = FirebaseFirestore.getInstance()
            val ruleDoc = firestore.collection("app_config")
                .document("exam_rules")
                .collection("rules")
                .document(ruleId)
                .get()
                .await()

            val scriptToExecute: String = if (ruleDoc.exists() && ruleDoc.contains("encryptedScript")) {
                val encryptedB64 = ruleDoc.getString("encryptedScript").orEmpty()
                val encryptedBytes = android.util.Base64.decode(encryptedB64, android.util.Base64.NO_WRAP)
                val decryptedBytes = SodiumCryptoManager.decryptSecretBox(encryptedBytes, nonce, decryptionKey)
                String(decryptedBytes, Charsets.UTF_8)
            } else {
                // Built-in fallback rule if offline or initial setup
                """
                (function() {
                    var ctx = input || {};
                    var elapsedMs = ctx.elapsedTimeMs || 0;
                    var violations = ctx.violationCount || 0;
                    var baseScore = ctx.rawScore || 100;
                    
                    var fraudFlag = violations >= 3;
                    var penalty = violations * 5;
                    var finalScore = Math.max(0, baseScore - penalty);
                    
                    return {
                        score: finalScore,
                        fraudFlag: fraudFlag,
                        ruleVersion: "default-v2.0"
                    };
                })();
                """.trimIndent()
            }

            val resultJsonStr = evaluateRule(scriptToExecute, examContextJson)
            val json = JSONObject(resultJsonStr)

            if (json.has("error")) {
                return@withContext RuleEvaluationResult(
                    success = false,
                    scoreAdjustment = 0.0,
                    fraudFlag = false,
                    rawJson = resultJsonStr,
                    error = json.optString("error")
                )
            }

            RuleEvaluationResult(
                success = true,
                scoreAdjustment = json.optDouble("score", 0.0),
                fraudFlag = json.optBoolean("fraudFlag", false),
                rawJson = resultJsonStr,
                error = null
            )
        } catch (e: Exception) {
            Timber.e(e, "QuickJS Rule evaluation failed")
            RuleEvaluationResult(
                success = false,
                scoreAdjustment = 0.0,
                fraudFlag = false,
                rawJson = "{}",
                error = e.localizedMessage ?: "Unknown execution exception"
            )
        }
    }
}
