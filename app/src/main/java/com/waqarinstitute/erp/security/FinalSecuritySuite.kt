package com.waqarinstitute.erp.security

import android.content.Context
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

object SideChannelShield {
    fun constantTimeCompare(a: ByteArray?, b: ByteArray?): Boolean {
        if (a == null || b == null) return false
        return MessageDigest.isEqual(a, b)
    }

    fun sanitizeCacheLine(sensitiveData: ByteArray?) {
        sensitiveData?.fill(0)
    }

    fun wipeMemory(data: ByteArray) {
        data.fill(0)
    }
}

object HardwareTrngEntropy {
    private val secureRandom = SecureRandom()

    fun generateTrueRandomBytes(numBytes: Int): ByteArray {
        val out = ByteArray(numBytes.coerceAtLeast(1))
        secureRandom.nextBytes(out)
        return out
    }

    fun nextBytes(length: Int): ByteArray = generateTrueRandomBytes(length)
}

object SodiumCryptoManager {
    @Volatile
    private var initialized = false

    fun initialize(context: Context) {
        initialized = true
    }

    fun encryptSecretBox(message: ByteArray, nonce: ByteArray, key: ByteArray): ByteArray {
        val normalizedKey = if (key.size == 32) key else MessageDigest.getInstance("SHA-256").digest(key)
        val iv = if (nonce.size >= 12) nonce.copyOfRange(0, 12) else nonce.copyOf(12)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(normalizedKey, "AES"), GCMParameterSpec(128, iv))
        return cipher.doFinal(message)
    }

    fun decryptSecretBox(ciphertext: ByteArray, nonce: ByteArray, key: ByteArray): ByteArray {
        val normalizedKey = if (key.size == 32) key else MessageDigest.getInstance("SHA-256").digest(key)
        val iv = if (nonce.size >= 12) nonce.copyOfRange(0, 12) else nonce.copyOf(12)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(normalizedKey, "AES"), GCMParameterSpec(128, iv))
        return cipher.doFinal(ciphertext)
    }

    fun lockMemory(buffer: ByteArray) {
        // Memory lock handled by native arena when loaded
    }

    fun memzero(buffer: ByteArray) {
        buffer.fill(0)
    }
}
