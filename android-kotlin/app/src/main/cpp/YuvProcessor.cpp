#include <jni.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>

#if defined(__ARM_NEON) || defined(__aarch64__)
#include <arm_neon.h>
#endif

namespace {

static inline uint8_t clamp_u8(int32_t v) noexcept {
    return static_cast<uint8_t>(v < 0 ? 0 : (v > 255 ? 255 : v));
}

static void libyuv_nv21_to_rgb565_neon(
        const uint8_t* __restrict srcY,
        const uint8_t* __restrict srcVU,
        uint16_t* __restrict dstRgb565,
        int width,
        int height) noexcept {
    for (int y = 0; y < height; ++y) {
        const uint8_t* yRow = srcY + (y * width);
        const uint8_t* vuRow = srcVU + ((y >> 1) * width);
        uint16_t* outRow = dstRgb565 + (y * width);

        int x = 0;
#if defined(__ARM_NEON) || defined(__aarch64__)
        for (; x + 7 < width; x += 8) {
            uint8x8_t yVec = vld1_u8(yRow + x);
            uint8x8_t vuRaw = vld1_u8(vuRow + (x & ~1));

            int16x8_t y16 = vreinterpretq_s16_u16(vmovl_u8(yVec));
            y16 = vsubq_s16(y16, vdupq_n_s16(16));
            y16 = vmulq_n_s16(y16, 74);

            int16_t vVals[8];
            int16_t uVals[8];
            uint8_t vuBuf[8];
            vst1_u8(vuBuf, vuRaw);
            for (int k = 0; k < 8; ++k) {
                int pairIdx = (k & ~1);
                vVals[k] = static_cast<int16_t>(vuBuf[pairIdx]) - 128;
                uVals[k] = static_cast<int16_t>(vuBuf[pairIdx + 1]) - 128;
            }
            int16x8_t v16 = vld1q_s16(vVals);
            int16x8_t u16 = vld1q_s16(uVals);

            int16x8_t r16 = vaddq_s16(y16, vmulq_n_s16(v16, 102));
            int16x8_t g16 = vsubq_s16(y16, vaddq_s16(vmulq_n_s16(v16, 52), vmulq_n_s16(u16, 25)));
            int16x8_t b16 = vaddq_s16(y16, vmulq_n_s16(u16, 129));

            r16 = vshrq_n_s16(r16, 6);
            g16 = vshrq_n_s16(g16, 6);
            b16 = vshrq_n_s16(b16, 6);

            uint8x8_t r8 = vqmovun_s16(r16);
            uint8x8_t g8 = vqmovun_s16(g16);
            uint8x8_t b8 = vqmovun_s16(b16);

            uint16x8_t rgb565 = vsliq_n_u16(
                vsliq_n_u16(
                    vshrq_n_u16(vmovl_u8(b8), 3),
                    vshrq_n_u16(vmovl_u8(g8), 2),
                    5
                ),
                vshrq_n_u16(vmovl_u8(r8), 3),
                11
            );
            vst1q_u16(outRow + x, rgb565);
        }
#endif
        for (; x < width; ++x) {
            int32_t Y = static_cast<int32_t>(yRow[x]) - 16;
            if (Y < 0) Y = 0;
            int32_t V = static_cast<int32_t>(vuRow[x & ~1]) - 128;
            int32_t U = static_cast<int32_t>(vuRow[(x & ~1) + 1]) - 128;

            int32_t yScaled = Y * 74;
            uint8_t r = clamp_u8((yScaled + 102 * V) >> 6);
            uint8_t g = clamp_u8((yScaled - 52 * V - 25 * U) >> 6);
            uint8_t b = clamp_u8((yScaled + 129 * U) >> 6);

            outRow[x] = static_cast<uint16_t>(
                ((static_cast<uint16_t>(r >> 3) & 0x1FU) << 11) |
                ((static_cast<uint16_t>(g >> 2) & 0x3FU) << 5) |
                (static_cast<uint16_t>(b >> 3) & 0x1FU)
            );
        }
    }
}

static jint convert_nv21_internal(
        JNIEnv* env,
        jobject nv21DirectBuffer,
        jobject rgb565DirectBuffer,
        jint width,
        jint height) {
    if (nv21DirectBuffer == nullptr || rgb565DirectBuffer == nullptr || width <= 0 || height <= 0) {
        return -1;
    }

    const uint8_t* srcBase = static_cast<const uint8_t*>(env->GetDirectBufferAddress(nv21DirectBuffer));
    uint16_t* dstBase = static_cast<uint16_t*>(env->GetDirectBufferAddress(rgb565DirectBuffer));
    jlong srcCap = env->GetDirectBufferCapacity(nv21DirectBuffer);
    jlong dstCap = env->GetDirectBufferCapacity(rgb565DirectBuffer);

    jlong expectedYSize = static_cast<jlong>(width) * static_cast<jlong>(height);
    jlong expectedNv21Size = expectedYSize + (expectedYSize / 2);
    jlong expectedRgb565Bytes = expectedYSize * 2;

    if (srcBase == nullptr || dstBase == nullptr || srcCap < expectedNv21Size || dstCap < expectedRgb565Bytes) {
        return -2;
    }

    const uint8_t* srcY = srcBase;
    const uint8_t* srcVU = srcBase + expectedYSize;
    libyuv_nv21_to_rgb565_neon(srcY, srcVU, dstBase, static_cast<int>(width), static_cast<int>(height));
    return 0;
}

} // anonymous namespace

extern "C" {

JNIEXPORT jint JNICALL
Java_com_waqarinstitute_erp_camera_YuvProcessor_convertNv21ToRgb565(
        JNIEnv* env,
        jobject /* thiz */,
        jobject nv21DirectBuffer,
        jobject rgb565DirectBuffer,
        jint width,
        jint height) {
    return convert_nv21_internal(env, nv21DirectBuffer, rgb565DirectBuffer, width, height);
}

JNIEXPORT jint JNICALL
Java_com_edusync_academy_camera_YuvProcessor_convertNv21ToRgb565(
        JNIEnv* env,
        jobject /* thiz */,
        jobject nv21DirectBuffer,
        jobject rgb565DirectBuffer,
        jint width,
        jint height) {
    return convert_nv21_internal(env, nv21DirectBuffer, rgb565DirectBuffer, width, height);
}

} // extern "C"
