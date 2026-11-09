package com.waqarinstitute.erp

import com.waqarinstitute.erp.data.calculateGrade
import com.waqarinstitute.erp.data.computeSaltedSha256Verifier
import com.waqarinstitute.erp.data.generate50McqQuestionBank
import com.waqarinstitute.erp.data.generateRandomSaltHex
import com.waqarinstitute.erp.data.normalizeForFirebaseAuthPassword
import com.waqarinstitute.erp.data.normalizeUsernameToEmail
import com.waqarinstitute.erp.data.sanitizeId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ErpCoreLogicUnitTest {

    @Test
    fun sanitizeId_removesSpecialCharactersAndPreservesAlphanumeric() {
        assertEquals("STU-2026-01", sanitizeId("  STU-2026-01  "))
        assertEquals("BATCH-A1_MAIN", sanitizeId("BATCH-A1_MAIN"))
        assertEquals("WI-ADMIN-01", sanitizeId("WI/ADMIN@01"))
    }

    @Test
    fun normalizeUsernameToEmail_formatsShortIdIntoInstituteEmail() {
        assertEquals("stu-101@waqarinstitute.edu", normalizeUsernameToEmail("STU-101"))
        assertEquals("waqar@waqarinstitute.edu", normalizeUsernameToEmail("waqar"))
        assertEquals("director@waqarinstitute.edu", normalizeUsernameToEmail("director@waqarinstitute.edu"))
    }

    @Test
    fun saltedSha256Verifier_verifiesAdminAndUpdatedPasswordsDeterministically() {
        val salt = generateRandomSaltHex()
        assertEquals(32, salt.length)

        val initialWaqarHash = computeSaltedSha256Verifier("waqar", salt)
        assertEquals(initialWaqarHash, computeSaltedSha256Verifier("waqar", salt))

        val updatedPasswordHash = computeSaltedSha256Verifier("NewSecurePass2026", salt)
        assertNotEquals(initialWaqarHash, updatedPasswordHash)
        assertEquals("waqar#WI2026", normalizeForFirebaseAuthPassword("waqar"))
    }

    @Test
    fun calculateGrade_computesAccurateGradesAndPassStatus() {
        val (gradeAPlus, passedAPlus) = calculateGrade(94.5)
        assertEquals("A+", gradeAPlus)
        assertTrue(passedAPlus)

        val (gradeB, passedB) = calculateGrade(65.0)
        assertEquals("B", gradeB)
        assertTrue(passedB)

        val (gradeF, passedF) = calculateGrade(32.0)
        assertEquals("F", gradeF)
        assertFalse(passedF)
    }

    @Test
    fun generate50McqQuestionBank_createsExactly50Questions() {
        val bank = generate50McqQuestionBank("ADCA")
        assertEquals(50, bank.size)
        assertEquals(1, bank.first().id)
        assertEquals(50, bank.last().id)
        assertTrue(bank.all { it.marks == 2 && it.correctOption in listOf("A", "B", "C", "D") })
    }
}
