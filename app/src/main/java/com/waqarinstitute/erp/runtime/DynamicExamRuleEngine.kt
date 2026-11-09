package com.waqarinstitute.erp.runtime

import com.edusync.academy.runtime.DynamicExamRuleEngine as LegacyDynamicExamRuleEngine

object DynamicExamRuleEngine {
    fun evaluateRule(jsBytecodeScript: String, inputJson: String): String =
        LegacyDynamicExamRuleEngine.evaluateRule(jsBytecodeScript, inputJson)

    suspend fun fetchAndEvaluateExamRule(
        ruleId: String,
        examContextJson: String,
        decryptionKey: ByteArray,
        nonce: ByteArray
    ) = LegacyDynamicExamRuleEngine.fetchAndEvaluateExamRule(
        ruleId, examContextJson, decryptionKey, nonce
    )
}
