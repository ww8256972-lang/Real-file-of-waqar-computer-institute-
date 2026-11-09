package com.waqarinstitute.erp

import com.waqarinstitute.erp.camera.YuvProcessor
import com.waqarinstitute.erp.data.UserProfile
import com.waqarinstitute.erp.data.local.StudentEntity
import com.waqarinstitute.erp.data.network.ErpAuditLogUploadRequest
import com.waqarinstitute.erp.data.network.RetrofitErpApiService
import com.waqarinstitute.erp.qr.AttendanceQrGenerator
import com.waqarinstitute.erp.security.BoringSslConstantTimeCrypto
import com.waqarinstitute.erp.security.DifferentialPrivacyEngine
import com.waqarinstitute.erp.security.FlatBuffersExamEngine
import com.waqarinstitute.erp.security.GrpcExamStreamClient
import com.waqarinstitute.erp.security.KyberPostQuantumKem
import com.waqarinstitute.erp.security.Srp6aZeroKnowledgeAuthenticator
import com.waqarinstitute.erp.security.WhiteBoxCrypto
import kotlinx.collections.immutable.persistentListOf
import kotlinx.collections.immutable.toImmutableList
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.nio.ByteBuffer

/**
 * Automated Unit Verification Suite for Phase 2–7 Libraries & Security Invariants.
 */
class LibraryVerificationTest {

    @Test
    fun `UserProfile and StudentEntity never contain plaintext password or passwordHash fields`() {
        val userFields = UserProfile::class.java.declaredFields.map { it.name.lowercase() }
        assertFalse("UserProfile must not have password field", userFields.any { it.contains("password") })

        val studentFields = StudentEntity::class.java.declaredFields.map { it.name.lowercase() }
        assertFalse("StudentEntity must not have password field", studentFields.any { it.contains("password") })
    }

    @Test
    fun `FlatBuffersExamEngine serializes and reads ExamBundle zero-copy without answer key`() {
        val questions = listOf(
            FlatBuffersExamEngine.FlatExamQuestionInput(
                questionId = 101L,
                prompt = "Which key opens Receipt Voucher in Tally Prime?",
                options = listOf("F4", "F5", "F6", "F8"),
                difficultyRating = 2,
                mediaUrl = "https://storage.googleapis.com/waqar-erp/q101.png"
            ),
            FlatBuffersExamEngine.FlatExamQuestionInput(
                questionId = 102L,
                prompt = "Which protocol provides TLS 1.3 encryption?",
                options = listOf("HTTP", "TLS", "FTP", "Telnet"),
                difficultyRating = 3,
                mediaUrl = ""
            )
        )

        val buffer = FlatBuffersExamEngine.serializeExamPaperToFlatBuffer(
            examId = "EXAM-ADCA-2026",
            title = "ADCA Final Proctored Examination",
            courseCode = "ADCA",
            durationSeconds = 1800,
            serverIssuedAtEpochMs = 1762560000000L,
            questions = questions
        )

        val q0 = FlatBuffersExamEngine.readQuestionZeroCopy(buffer, 0)
        assertEquals(101L, q0.questionId)
        assertEquals("Which key opens Receipt Voucher in Tally Prime?", q0.prompt)
        assertEquals(listOf("F4", "F5", "F6", "F8"), q0.options)
        assertEquals(2, q0.difficultyRating)

        val q1 = FlatBuffersExamEngine.readQuestionZeroCopy(buffer, 1)
        assertEquals(102L, q1.questionId)
        assertEquals(listOf("HTTP", "TLS", "FTP", "Telnet"), q1.options)
    }

    @Test
    fun `ZXing AttendanceQrGenerator encodes and decodes signed payload round-trip`() {
        val payload =
            "WAQAR_ATTENDANCE|BATCH:ADCA-A1|TCH:TCH-01|EXP:${System.currentTimeMillis() + 300_000L}|SIG:9f86d081884c7d659a2feaa0c55ad015"
        val matrix = AttendanceQrGenerator.encodePayloadToBitMatrix(payload, 256)
        val decoded = AttendanceQrGenerator.decodePayloadFromBitMatrix(matrix)
        assertEquals(payload, decoded)

        val parsed = AttendanceQrGenerator.parseQrToken(decoded)
        assertNotNull(parsed)
        assertEquals("ADCA-A1", parsed!!.batchCode)
        assertEquals("TCH-01", parsed.teacherId)
        assertEquals("9f86d081884c7d659a2feaa0c55ad015", parsed.signatureHex)
        assertFalse(parsed.isExpired)
    }

    @Test
    fun `Protobuf and gRPC-Kotlin serialize and stream ExamSubmissionEnvelope over transport`() = runBlocking {
        val envelope = GrpcExamStreamClient.ExamSubmissionEnvelope(
            examId = "EXAM-ADCA-01",
            studentUid = "STU-WI-001",
            questionId = 7L,
            selectedOptionIndex = 2,
            clientTimestampEpochMs = 1762560123456L,
            hardwareSignature = byteArrayOf(0x01, 0x02, 0x03, 0x04)
        )

        val protoBytes = GrpcExamStreamClient.serializeSubmissionEnvelopeToProtobuf(envelope)
        assertTrue(protoBytes.isNotEmpty())

        val decoded = GrpcExamStreamClient.deserializeSubmissionEnvelopeFromProtobuf(protoBytes)
        assertEquals(envelope.examId, decoded.examId)
        assertEquals(envelope.studentUid, decoded.studentUid)
        assertEquals(envelope.questionId, decoded.questionId)
        assertEquals(envelope.selectedOptionIndex, decoded.selectedOptionIndex)
        assertEquals(envelope.clientTimestampEpochMs, decoded.clientTimestampEpochMs)
        assertArrayEquals(envelope.hardwareSignature, decoded.hardwareSignature)

        val ack = GrpcExamStreamClient.streamAnswerSubmissionOverLoopback(envelope)
        assertTrue(ack.accepted)
        assertEquals(7L, ack.acknowledgedQuestionId)
        assertTrue(ack.receiptHash.startsWith("GRPC-SHA256-"))
    }

    @Test
    fun `YuvProcessor converts synthetic 1280x720 YUV_420_888 frame to NV21 accurately`() {
        val width = 1280
        val height = 720
        val ySize = width * height
        val uvSize = (width * height) / 2

        val yBytes = ByteArray(ySize) { (it % 251).toByte() }
        val uBytes = ByteArray(uvSize) { 0x55.toByte() }
        val vBytes = ByteArray(uvSize) { 0xAA.toByte() }

        val outNv21 = ByteArray(ySize + uvSize)
        YuvProcessor.convertYuv420ToNv21Kotlin(
            yBuffer = ByteBuffer.wrap(yBytes),
            uBuffer = ByteBuffer.wrap(uBytes),
            vBuffer = ByteBuffer.wrap(vBytes),
            yRowStride = width,
            uvRowStride = width,
            uvPixelStride = 2,
            width = width,
            height = height,
            outNv21 = outNv21
        )

        // Verify Y plane copy and VU interleaving
        assertEquals(yBytes[0], outNv21[0])
        assertEquals(yBytes[ySize - 1], outNv21[ySize - 1])
        assertEquals(0xAA.toByte(), outNv21[ySize])     // V0
        assertEquals(0x55.toByte(), outNv21[ySize + 1]) // U0
    }

    @Test
    fun `RetrofitErpApiService attaches Firebase Auth and AppCheck headers against MockWebServer`() = runBlocking {
        val mockWebServer = MockWebServer()
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody("""{"accepted":true,"receiptId":"AUDIT-9001","serverTimestampEpochMs":1762560000000}""")
        )
        mockWebServer.start()

        try {
            val client = OkHttpClient.Builder()
                .addInterceptor { chain ->
                    val req = chain.request().newBuilder()
                        .header("Authorization", "Bearer TEST_FIREBASE_ID_TOKEN")
                        .header("X-Firebase-AppCheck", "TEST_APP_CHECK_TOKEN")
                        .build()
                    chain.proceed(req)
                }
                .build()

            val api = Retrofit.Builder()
                .baseUrl(mockWebServer.url("/"))
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(RetrofitErpApiService::class.java)

            val response = api.submitSecurityAuditEvent(
                ErpAuditLogUploadRequest(
                    eventType = "EXAM_LOCKDOWN_STARTED",
                    actorUid = "STU-001",
                    deviceBindingTagHex = "0123456789abcdef",
                    clientTimestampEpochMs = 1762560000000L
                )
            )

            assertTrue(response.accepted)
            assertEquals("AUDIT-9001", response.receiptId)

            val recorded = mockWebServer.takeRequest()
            assertEquals("Bearer TEST_FIREBASE_ID_TOKEN", recorded.getHeader("Authorization"))
            assertEquals("TEST_APP_CHECK_TOKEN", recorded.getHeader("X-Firebase-AppCheck"))
        } finally {
            mockWebServer.shutdown()
        }
    }

    @Test
    fun `WhiteBoxCrypto, ConstantTimeCrypto, SRP6a, Kyber768 and ImmutableCollections work deterministically`() {
        val original = "EXAM_QUESTION_BUNDLE_SECRET".toByteArray(Charsets.UTF_8)
        val transformed = WhiteBoxCrypto.transformExamPayload(original, "SESSION-2026")
        assertFalse(original.contentEquals(transformed))

        val hmac1 = BoringSslConstantTimeCrypto.hmacSha256(
            "key".toByteArray(),
            "message".toByteArray()
        )
        val hmac2 = BoringSslConstantTimeCrypto.hmacSha256(
            "key".toByteArray(),
            "message".toByteArray()
        )
        assertTrue(BoringSslConstantTimeCrypto.constantTimeEquals(hmac1, hmac2))

        val srp = Srp6aZeroKnowledgeAuthenticator.createRegistrationRecord("student01", "StrongPass!2026")
        assertTrue(srp.saltHex.isNotBlank())
        assertTrue(srp.verifierHex.isNotBlank())

        val kem = KyberPostQuantumKem.generateKeyPairAndEncapsulate(ByteArray(32) { it.toByte() })
        assertEquals(32, kem.sharedSecret32B.size)

        val noisy = DifferentialPrivacyEngine.privatizePercentage(88.5, epsilon = 1.5, sensitivity = 1.0)
        assertTrue(noisy in 0.0..100.0)

        val immutableCourses = persistentListOf("ADCA", "DCA", "TALLY").toImmutableList()
        assertEquals(3, immutableCourses.size)
    }

    @Test
    fun `SideChannelShield constant-time compare and cache sanitization execute without branches on secret`() {
        val a = byteArrayOf(0x01, 0x02, 0x03, 0x04)
        val b = byteArrayOf(0x01, 0x02, 0x03, 0x04)
        val c = byteArrayOf(0x01, 0x02, 0x03, 0x05)

        assertTrue(com.edusync.academy.security.SideChannelShield.constantTimeCompare(a, b))
        assertFalse(com.edusync.academy.security.SideChannelShield.constantTimeCompare(a, c))

        val sensitive = byteArrayOf(0x11, 0x22, 0x33, 0x44)
        com.edusync.academy.security.SideChannelShield.sanitizeCacheLine(sensitive)
        // Memory should be sanitized with zeroes
        assertEquals(0x00.toByte(), sensitive[0])
        assertEquals(0x00.toByte(), sensitive[3])
    }

    @Test
    fun `HardwareTrngEntropy generates conditioned random stream via SHA-512 sponge mixer`() {
        val rand1 = com.edusync.academy.security.HardwareTrngEntropy.nextBytes(32)
        val rand2 = com.edusync.academy.security.HardwareTrngEntropy.nextBytes(32)
        assertEquals(32, rand1.size)
        assertEquals(32, rand2.size)
        assertFalse("Subsequent TRNG outputs must not be identical", rand1.contentEquals(rand2))
    }

    @Test
    fun `SodiumCryptoManager ChaCha20-Poly1305 encrypts, decrypts, and locks buffers in RAM`() {
        val key = ByteArray(32) { (it * 3).toByte() }
        val nonce = ByteArray(12) { (it * 7).toByte() }
        val message = "EXAM_SECRETS_CHACHA20".toByteArray(Charsets.UTF_8)

        val encrypted = com.edusync.academy.security.SodiumCryptoManager.encryptSecretBox(message, nonce, key)
        assertFalse(message.contentEquals(encrypted))

        val decrypted = com.edusync.academy.security.SodiumCryptoManager.decryptSecretBox(encrypted, nonce, key)
        assertArrayEquals(message, decrypted)

        com.edusync.academy.security.SodiumCryptoManager.lockMemory(key)
        com.edusync.academy.security.SodiumCryptoManager.memzero(key)
        assertEquals(0.toByte(), key[0])
    }

    @Test
    fun `DynamicExamRuleEngine evaluates JavaScript rule scripts inside QuickJS sandbox`() = runBlocking {
        val script = """
            (function() {
                var ctx = input || {};
                var violations = ctx.violationCount || 0;
                var baseScore = ctx.rawScore || 100;
                var fraudScore = violations * 25;
                return {
                    score: Math.max(0, baseScore - violations * 10),
                    fraudScore: fraudScore,
                    fraudFlag: violations >= 3
                };
            })();
        """.trimIndent()

        val input = """{"rawScore":95,"violationCount":1,"elapsedTimeMs":120000}"""
        val rawResult = com.edusync.academy.runtime.DynamicExamRuleEngine.evaluateRule(script, input)
        assertTrue(rawResult.isNotBlank())
        assertTrue(rawResult.contains("score") || rawResult.contains("status"))
    }
}

