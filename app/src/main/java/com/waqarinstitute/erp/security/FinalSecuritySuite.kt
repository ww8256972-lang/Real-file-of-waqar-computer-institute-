package com.waqarinstitute.erp.security

import com.edusync.academy.security.SideChannelShield as LegacySideChannelShield
import com.edusync.academy.security.HardwareTrngEntropy as LegacyHardwareTrngEntropy
import com.edusync.academy.security.SodiumCryptoManager as LegacySodiumCryptoManager

object SideChannelShield {
    fun constantTimeCompare(a: ByteArray?, b: ByteArray?): Boolean =
        LegacySideChannelShield.constantTimeCompare(a, b)

    fun sanitizeCacheLine(sensitiveData: ByteArray?) =
        LegacySideChannelShield.sanitizeCacheLine(sensitiveData)

    fun wipeMemory(data: ByteArray) =
        LegacySideChannelShield.wipeMemory(data)
}

object HardwareTrngEntropy {
    fun generateTrueRandomBytes(numBytes: Int): ByteArray? =
        LegacyHardwareTrngEntropy.generateTrueRandomBytes(numBytes)

    fun nextBytes(length: Int): ByteArray =
        LegacyHardwareTrngEntropy.nextBytes(length)
}

object SodiumCryptoManager {
    fun initialize(context: android.content.Context) =
        LegacySodiumCryptoManager.initialize(context)

    fun encryptSecretBox(message: ByteArray, nonce: ByteArray, key: ByteArray): ByteArray =
        LegacySodiumCryptoManager.encryptSecretBox(message, nonce, key)

    fun decryptSecretBox(ciphertext: ByteArray, nonce: ByteArray, key: ByteArray): ByteArray =
        LegacySodiumCryptoManager.decryptSecretBox(ciphertext, nonce, key)

    fun lockMemory(buffer: ByteArray) =
        LegacySodiumCryptoManager.lockMemory(buffer)

    fun memzero(buffer: ByteArray) =
        LegacySodiumCryptoManager.memzero(buffer)
}
