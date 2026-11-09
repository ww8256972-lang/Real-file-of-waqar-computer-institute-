package com.waqarinstitute.erp.qr

import android.graphics.Bitmap
import android.graphics.Color
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.MultiFormatReader
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.BitMatrix
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * QR Code Generator & Decoder for WAQAR COMPUTER INSTITUTE Teacher Portal.
 * Renders rotating server-issued HMAC-signed QR payloads (`generateDynamicAttendanceQr`)
 * via ZXing `QRCodeWriter` and provides deterministic `BitMatrix` / `QRCodeReader` verification.
 */
object AttendanceQrGenerator {

    fun encodePayloadToBitMatrix(payload: String, size: Int = 512): BitMatrix {
        return QRCodeWriter().encode(payload, BarcodeFormat.QR_CODE, size, size)
    }

    fun decodePayloadFromBitMatrix(bitMatrix: BitMatrix): String {
        val width = bitMatrix.width
        val height = bitMatrix.height
        val pixels = IntArray(width * height)
        for (y in 0 until height) {
            val offset = y * width
            for (x in 0 until width) {
                pixels[offset + x] = if (bitMatrix[x, y]) Color.BLACK else Color.WHITE
            }
        }
        val source = RGBLuminanceSource(width, height, pixels)
        val binaryBitmap = BinaryBitmap(HybridBinarizer(source))
        return QRCodeReader().decode(binaryBitmap).text
    }

    suspend fun generateQrBitmapFromSignedPayload(
        signedPayload: String,
        size: Int = 512
    ): Bitmap = withContext(Dispatchers.Default) {
        val bitMatrix = encodePayloadToBitMatrix(signedPayload, size)
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
        for (x in 0 until size) {
            for (y in 0 until size) {
                bitmap.setPixel(x, y, if (bitMatrix[x, y]) Color.BLACK else Color.WHITE)
            }
        }
        bitmap
    }

    suspend fun generateQrBitmap(
        batchCode: String,
        teacherId: String,
        serverSignatureHex: String = "SERVER_HMAC_PENDING",
        validityMinutes: Int = 5
    ): Bitmap = withContext(Dispatchers.Default) {
        val expiryTime = System.currentTimeMillis() + (validityMinutes * 60 * 1000L)
        val qrPayload =
            "WAQAR_ATTENDANCE|BATCH:$batchCode|TCH:$teacherId|EXP:$expiryTime|SIG:$serverSignatureHex"
        generateQrBitmapFromSignedPayload(qrPayload)
    }

    fun parseQrToken(token: String): QrAttendanceData? {
        if (!token.startsWith("WAQAR_ATTENDANCE|")) return null
        val parts = token.split("|")
        var batchCode = ""
        var teacherId = ""
        var expiryTime = 0L
        var signatureHex = ""

        for (part in parts) {
            when {
                part.startsWith("BATCH:") -> batchCode = part.removePrefix("BATCH:")
                part.startsWith("TCH:") -> teacherId = part.removePrefix("TCH:")
                part.startsWith("EXP:") -> expiryTime = part.removePrefix("EXP:").toLongOrNull() ?: 0L
                part.startsWith("SIG:") -> signatureHex = part.removePrefix("SIG:")
            }
        }

        val isExpired = System.currentTimeMillis() > expiryTime
        return QrAttendanceData(
            batchCode = batchCode,
            teacherId = teacherId,
            expiryTime = expiryTime,
            signatureHex = signatureHex,
            isExpired = isExpired
        )
    }
}

data class QrAttendanceData(
    val batchCode: String,
    val teacherId: String,
    val expiryTime: Long,
    val signatureHex: String = "",
    val isExpired: Boolean
)
