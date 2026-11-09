package com.waqarinstitute.erp.camera

import androidx.tracing.trace
import com.waqarinstitute.erp.security.NativeLibrary
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Hardware-accelerated NV21 (YUV420SP) to RGB565 frame converter backed by C++ ARM NEON SIMD
 * (`YuvProcessor.cpp`) with a deterministic Kotlin scalar fallback when running on JVM unit tests.
 */
object YuvProcessor {

    init {
        NativeLibrary.ensureLoaded()
    }

    external fun convertNv21ToRgb565(
        nv21DirectBuffer: ByteBuffer,
        rgb565DirectBuffer: ByteBuffer,
        width: Int,
        height: Int
    ): Int

    data class YuvBenchmarkResult(
        val width: Int,
        val height: Int,
        val nativeDurationMicros: Long,
        val kotlinFallbackDurationMicros: Long,
        val usedNativeSimd: Boolean
    )

    fun processNv21FrameToRgb565(
        nv21DirectBuffer: ByteBuffer,
        rgb565DirectBuffer: ByteBuffer,
        width: Int,
        height: Int
    ): Int = trace("YuvProcessor.processNv21FrameToRgb565") {
        require(nv21DirectBuffer.isDirect && rgb565DirectBuffer.isDirect) {
            "YuvProcessor requires DirectByteBuffers for zero-copy frame conversion."
        }
        if (NativeLibrary.isLoaded) {
            try {
                return@trace convertNv21ToRgb565(nv21DirectBuffer, rgb565DirectBuffer, width, height)
            } catch (_: UnsatisfiedLinkError) {
                // Fall through to Kotlin fallback
            }
        }
        convertNv21ToRgb565KotlinFallback(nv21DirectBuffer, rgb565DirectBuffer, width, height)
    }

    fun convertNv21ToRgb565KotlinFallback(
        nv21Buffer: ByteBuffer,
        rgb565Buffer: ByteBuffer,
        width: Int,
        height: Int
    ): Int {
        if (width <= 0 || height <= 0) return -1
        val expectedY = width * height
        val expectedNv21 = expectedY + (expectedY / 2)
        if (nv21Buffer.capacity() < expectedNv21 || rgb565Buffer.capacity() < expectedY * 2) {
            return -2
        }

        rgb565Buffer.order(ByteOrder.LITTLE_ENDIAN)
        for (y in 0 until height) {
            val yRowOffset = y * width
            val vuRowOffset = expectedY + (y shr 1) * width
            for (x in 0 until width) {
                val yVal = ((nv21Buffer.get(yRowOffset + x).toInt() and 0xFF) - 16).coerceAtLeast(0)
                val vuIndex = vuRowOffset + (x and 1.inv())
                val vVal = (nv21Buffer.get(vuIndex).toInt() and 0xFF) - 128
                val uVal = (nv21Buffer.get(vuIndex + 1).toInt() and 0xFF) - 128

                val yScaled = yVal * 74
                val r = ((yScaled + 102 * vVal) shr 6).coerceIn(0, 255)
                val g = ((yScaled - 52 * vVal - 25 * uVal) shr 6).coerceIn(0, 255)
                val b = ((yScaled + 129 * uVal) shr 6).coerceIn(0, 255)

                val pixel565 = (((r shr 3) and 0x1F) shl 11) or
                    (((g shr 2) and 0x3F) shl 5) or
                    ((b shr 3) and 0x1F)
                rgb565Buffer.putShort((yRowOffset + x) * 2, pixel565.toShort())
            }
        }
        return 0
    }

    fun benchmarkConversion(width: Int = 640, height: Int = 360): YuvBenchmarkResult {
        val ySize = width * height
        val nv21 = ByteBuffer.allocateDirect(ySize + ySize / 2)
        val rgbOut = ByteBuffer.allocateDirect(ySize * 2)

        for (i in 0 until nv21.capacity()) {
            nv21.put(i, ((i * 37) and 0xFF).toByte())
        }

        val t0 = System.nanoTime()
        convertNv21ToRgb565KotlinFallback(nv21, rgbOut, width, height)
        val kotlinMicros = (System.nanoTime() - t0) / 1_000L

        val t1 = System.nanoTime()
        val rc = processNv21FrameToRgb565(nv21, rgbOut, width, height)
        val nativeMicros = if (rc == 0) (System.nanoTime() - t1) / 1_000L else kotlinMicros

        return YuvBenchmarkResult(
            width = width,
            height = height,
            nativeDurationMicros = nativeMicros,
            kotlinFallbackDurationMicros = kotlinMicros,
            usedNativeSimd = NativeLibrary.isLoaded
        )
    }

    fun convertYuv420ToNv21(
        yBuffer: ByteBuffer,
        uBuffer: ByteBuffer,
        vBuffer: ByteBuffer,
        yRowStride: Int,
        uvRowStride: Int,
        uvPixelStride: Int,
        width: Int,
        height: Int,
        outNv21: ByteArray
    ) {
        var pos = 0
        val yDup = yBuffer.duplicate()
        for (row in 0 until height) {
            yDup.position(row * yRowStride)
            yDup.get(outNv21, pos, width)
            pos += width
        }

        val uDup = uBuffer.duplicate()
        val vDup = vBuffer.duplicate()
        val uvHeight = height / 2
        val uvWidth = width / 2
        for (row in 0 until uvHeight) {
            val rowOffset = row * uvRowStride
            for (col in 0 until uvWidth) {
                val uvIdx = rowOffset + col * uvPixelStride
                if (pos + 1 < outNv21.size && uvIdx < vDup.limit() && uvIdx < uDup.limit()) {
                    outNv21[pos++] = vDup.get(uvIdx)
                    outNv21[pos++] = uDup.get(uvIdx)
                }
            }
        }
    }
}
