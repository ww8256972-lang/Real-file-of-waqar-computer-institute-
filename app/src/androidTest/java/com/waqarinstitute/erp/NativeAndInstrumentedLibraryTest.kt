package com.waqarinstitute.erp

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.waqarinstitute.erp.security.ConscryptSecurityProvider
import com.waqarinstitute.erp.security.DeviceFingerprintManager
import com.waqarinstitute.erp.security.MemoryScramblerVault
import com.waqarinstitute.erp.security.MimallocNativeAllocator
import com.waqarinstitute.erp.security.NativeLibrary
import com.waqarinstitute.erp.security.PacBtiControlFlowGuard
import com.waqarinstitute.erp.security.RealmExamCacheRepository
import com.waqarinstitute.erp.security.SqlCipherExamAttendanceVault
import com.waqarinstitute.erp.security.TinkAeadVault
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.security.GeneralSecurityException
import javax.net.ssl.SSLContext

/**
 * Instrumented Android & Native NDK Verification Test Suite.
 * Verifies Google Tink Keystore AEAD, Conscrypt TLS 1.3 Provider, SQLCipher AES-256 Database,
 * Realm Exam Cache, and all Native C++20 JNI modules on an Android device/emulator.
 */
@RunWith(AndroidJUnit4::class)
class NativeAndInstrumentedLibraryTest {

    @Test
    fun verifyConscryptTls13ProviderInstalled() {
        ConscryptSecurityProvider.install()
        val sslContext = SSLContext.getInstance("TLSv1.3", "Conscrypt")
        assertNotNull(sslContext)
        assertEquals("Conscrypt", sslContext.provider.name)
    }

    @Test
    fun verifyTinkAeadEncryptDecryptAndTamperRejection() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val vault = TinkAeadVault(context)
        val plaintext = "WAQAR_SECRET_EXAM_KEY_2026".toByteArray(Charsets.UTF_8)
        val aad = "exam_id:ADCA-2026".toByteArray(Charsets.UTF_8)

        val ciphertext = vault.encrypt(plaintext, aad)
        val decrypted = vault.decrypt(ciphertext, aad)
        assertArrayEquals(plaintext, decrypted)

        var threwOnWrongAad = false
        try {
            vault.decrypt(ciphertext, "exam_id:TAMPERED".toByteArray(Charsets.UTF_8))
        } catch (_: GeneralSecurityException) {
            threwOnWrongAad = true
        }
        assertTrue("Tink AEAD must reject tampered associated data", threwOnWrongAad)
    }

    @Test
    fun verifySqlCipherEncryptedDatabaseAndRealmCache() = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val tink = TinkAeadVault(context)
        val sqlCipherVault = SqlCipherExamAttendanceVault(context, tink)
        val db = sqlCipherVault.openEncryptedAttendanceDatabase()

        db.execSQL(
            "INSERT OR REPLACE INTO secure_attendance_ledger (record_id, student_id, qr_nonce, latitude, longitude, accuracy_meters, recorded_at_ms, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            arrayOf("REC-1", "STU-1", "NONCE-1", 26.8467, 80.9462, 8.5, System.currentTimeMillis(), 0)
        )
        val cursor = db.rawQuery("SELECT student_id FROM secure_attendance_ledger WHERE record_id = ?", arrayOf("REC-1"))
        assertTrue(cursor.moveToFirst())
        assertEquals("STU-1", cursor.getString(0))
        cursor.close()
        db.close()

        RealmExamCacheRepository.cacheEncryptedExamChunk(
            examId = "EXAM-REALM-01",
            questionIndex = 0,
            encryptedPayloadHex = "deadbeefcafe",
            integrityMacHex = "01020304"
        )
        val cached = RealmExamCacheRepository.getCachedExamChunks("EXAM-REALM-01")
        assertTrue(cached.isNotEmpty())
    }

    @Test
    fun verifyNativeJniModulesLoadedAndFunctional() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        assertTrue("libedusync_native_security.so must load", NativeLibrary.ensureLoaded())

        val arenaHandle = MimallocNativeAllocator.nativeInitializeMimallocHeap()
        assertTrue(arenaHandle != 0L)

        val status = PacBtiControlFlowGuard.verifyAndEnforceControlFlowIntegrity()
        assertNotNull(status)

        val secret = "EPHEMERAL_EXAM_TOKEN".toByteArray(Charsets.UTF_8)
        val handle = MemoryScramblerVault.sealSecretInScrambledRam(secret)
        val unsealed = MemoryScramblerVault.unscrambleAndRead(handle)
        assertEquals("EPHEMERAL_EXAM_TOKEN", String(unsealed, Charsets.UTF_8))
        MemoryScramblerVault.wipeVaultSlot(handle)

        val challenge = ByteArray(32) { (it + 1).toByte() }
        val tag1 = DeviceFingerprintManager.deriveHardwareDeviceBindingTag(context, challenge)
        val tag2 = DeviceFingerprintManager.deriveHardwareDeviceBindingTag(context, challenge)
        assertEquals(64, tag1.length)
        assertEquals(tag1, tag2)
    }
}
