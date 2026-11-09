#include <jni.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/system_properties.h>
#include <android/log.h>

#define LOG_TAG "WaqarDeviceFingerprint"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

namespace {

// ============================================================================
// CONSTANT-TIME SHA-512 ENGINE (FIPS 180-4)
// No secret-dependent branches or table lookups.
// ============================================================================
static const uint64_t kSha512K[80] = {
    0x428a2f98d728ae22ULL, 0x7137449123ef65cdULL, 0xb5c0fbcfec4d3b2fULL, 0xe9b5dba58189dbbcULL,
    0x3956c25bf348b538ULL, 0x59f111f1b605d019ULL, 0x923f82a4af194f9bULL, 0xab1c5ed5da6d8118ULL,
    0xd807aa98a3030242ULL, 0x12835b0145706fbeULL, 0x243185be4ee4b28cULL, 0x550c7dc3d5ffb4e2ULL,
    0x72be5d74f27b896fULL, 0x80deb1fe3b1696b1ULL, 0x9bdc06a725c71235ULL, 0xc19bf174cf692694ULL,
    0xe49b69c19ef14ad2ULL, 0xefbe4786384f25e3ULL, 0x0fc19dc68b8cd5b5ULL, 0x240ca1cc77ac9c65ULL,
    0x2de92c6f592b0275ULL, 0x4a7484aa6ea6e483ULL, 0x5cb0a9dcbd41fbd4ULL, 0x76f988da831153b5ULL,
    0x983e5152ee66dfabULL, 0xa831c66d2db43210ULL, 0xb00327c898fb213fULL, 0xbf597fc7beef0ee4ULL,
    0xc6e00bf33da88fc2ULL, 0xd5a79147930aa725ULL, 0x06ca6351e003826fULL, 0x142929670a0e6e70ULL,
    0x27b70a8546d22ffcULL, 0x2e1b21385c26c926ULL, 0x4d2c6dfc5ac42aedULL, 0x53380d139d95b3dfULL,
    0x650a73548baf63deULL, 0x766a0abb3c77b2a8ULL, 0x81c2c92e47edaee6ULL, 0x92722c851482353bULL,
    0xa2bfe8a14cf10364ULL, 0xa81a664bbc423001ULL, 0xc24b8b70d0f89791ULL, 0xc76c51a30654be30ULL,
    0xd192e819d6ef5218ULL, 0xd69906245565a910ULL, 0xf40e35855771202aULL, 0x106aa07032bbd1b8ULL,
    0x19a4c116b8d2d0c8ULL, 0x1e376c085141ab53ULL, 0x2748774cdf8eeb99ULL, 0x34b0bcb5e19b48a8ULL,
    0x391c0cb3c5c95a63ULL, 0x4ed8aa4ae3418acbULL, 0x5b9cca4f7763e373ULL, 0x682e6ff3d6b2b8a3ULL,
    0x748f82ee5defb2fcULL, 0x78a5636f43172f60ULL, 0x84c87814a1f0ab72ULL, 0x8cc702081a6439ecULL,
    0x90befffa23631e28ULL, 0xa4506cebde82bde9ULL, 0xbef9a3f7b2c67915ULL, 0xc67178f2e372532bULL,
    0xca273eceea26619cULL, 0xd186b8c721c0c207ULL, 0xeada7dd6cde0eb1eULL, 0xf57d4f7fee6ed178ULL,
    0x06f067aa72176fbaULL, 0x0a637dc5a2c898a6ULL, 0x113f9804bef90daeULL, 0x1b710b35131c471bULL,
    0x28db77f523047d84ULL, 0x32caab7b40c72493ULL, 0x3c9ebe0a15c9bebcULL, 0x431d67c49c100d4cULL,
    0x4cc5d4becb3e42b6ULL, 0x597f299cfc657e2aULL, 0x5fcb6fab3ad6faecULL, 0x6c44198c4a475817ULL
};

static inline uint64_t rotr64(uint64_t x, unsigned int n) noexcept {
    return (x >> n) | (x << (64U - n));
}

static void sha512_compute(const uint8_t* data, size_t len, uint8_t outDigest[64]) noexcept {
    uint64_t h[8] = {
        0x6a09e667f3bcc908ULL, 0xbb67ae8584caa73bULL,
        0x3c6ef372fe94f82bULL, 0xa54ff53a5f1d36f1ULL,
        0x510e527fade682d1ULL, 0x9b05688c2b3e6c1fULL,
        0x1f83d9abfb41bd6bULL, 0x5be0cd19137e2179ULL
    };

    size_t paddedLen = ((len + 17 + 127) / 128) * 128;
    uint8_t* padded = static_cast<uint8_t*>(calloc(paddedLen, 1));
    if (!padded) return;

    memcpy(padded, data, len);
    padded[len] = 0x80U;
    uint64_t bitLen = static_cast<uint64_t>(len) * 8ULL;
    for (int i = 0; i < 8; ++i) {
        padded[paddedLen - 1 - i] = static_cast<uint8_t>((bitLen >> (i * 8)) & 0xFFU);
    }

    for (size_t offset = 0; offset < paddedLen; offset += 128) {
        uint64_t w[80];
        for (int i = 0; i < 16; ++i) {
            uint64_t word = 0;
            for (int b = 0; b < 8; ++b) {
                word = (word << 8) | padded[offset + i * 8 + b];
            }
            w[i] = word;
        }
        for (int i = 16; i < 80; ++i) {
            uint64_t s0 = rotr64(w[i - 15], 1) ^ rotr64(w[i - 15], 8) ^ (w[i - 15] >> 7);
            uint64_t s1 = rotr64(w[i - 2], 19) ^ rotr64(w[i - 2], 61) ^ (w[i - 2] >> 6);
            w[i] = w[i - 16] + s0 + w[i - 7] + s1;
        }

        uint64_t a = h[0], b = h[1], c = h[2], d = h[3];
        uint64_t e = h[4], f = h[5], g = h[6], hh = h[7];

        for (int i = 0; i < 80; ++i) {
            uint64_t S1 = rotr64(e, 14) ^ rotr64(e, 18) ^ rotr64(e, 41);
            uint64_t ch = (e & f) ^ ((~e) & g);
            uint64_t temp1 = hh + S1 + ch + kSha512K[i] + w[i];
            uint64_t S0 = rotr64(a, 28) ^ rotr64(a, 34) ^ rotr64(a, 39);
            uint64_t maj = (a & b) ^ (a & c) ^ (b & c);
            uint64_t temp2 = S0 + maj;

            hh = g;
            g = f;
            f = e;
            e = d + temp1;
            d = c;
            c = b;
            b = a;
            a = temp1 + temp2;
        }

        h[0] += a; h[1] += b; h[2] += c; h[3] += d;
        h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
    }

    for (int i = 0; i < 8; ++i) {
        for (int b = 0; b < 8; ++b) {
            outDigest[i * 8 + b] = static_cast<uint8_t>((h[i] >> (56 - b * 8)) & 0xFFU);
        }
    }

    free(padded);
}

/**
 * Honest Device Fingerprint Derivation:
 * Combines stable Android hardware build/system properties (ro.soc.model, ro.board.platform,
 * ro.hardware, ro.product.board) with the Keystore attestation certificate chain digest
 * and a server-issued short-lived challenge nonce.
 * NOTE: This is NOT a physical SRAM PUF; unprivileged Android apps cannot read uninitialized SRAM.
 * Its purpose is deterministic device-binding combined with Android Keystore key attestation.
 */
static void collect_device_fingerprint_material(
    const char* serverChallengeAndCertDigest,
    uint8_t outMaterial[512]
) noexcept {
    memset(outMaterial, 0, 512);

    char socModel[PROP_VALUE_MAX] = {0};
    char boardPlatform[PROP_VALUE_MAX] = {0};
    char hardwareName[PROP_VALUE_MAX] = {0};
    char productBoard[PROP_VALUE_MAX] = {0};

    __system_property_get("ro.soc.model", socModel);
    __system_property_get("ro.board.platform", boardPlatform);
    __system_property_get("ro.hardware", hardwareName);
    __system_property_get("ro.product.board", productBoard);

    snprintf(
        reinterpret_cast<char*>(outMaterial),
        512,
        "WAQAR-DEVICE-FP-V2|CHALLENGE_CERT:%s|SOC:%s|PLATFORM:%s|HW:%s|BOARD:%s",
        serverChallengeAndCertDigest ? serverChallengeAndCertDigest : "UNBOUND",
        socModel,
        boardPlatform,
        hardwareName,
        productBoard
    );
}

static jstring derive_fingerprint_hex_internal(JNIEnv* env, jstring challengeAndCertDigest) {
    const char* inputChars = challengeAndCertDigest != nullptr
        ? env->GetStringUTFChars(challengeAndCertDigest, nullptr)
        : "UNBOUND";

    uint8_t rawMaterial[512];
    collect_device_fingerprint_material(inputChars, rawMaterial);

    if (challengeAndCertDigest != nullptr && inputChars != nullptr) {
        env->ReleaseStringUTFChars(challengeAndCertDigest, inputChars);
    }

    uint8_t sha512Digest[64];
    sha512_compute(rawMaterial, strlen(reinterpret_cast<const char*>(rawMaterial)), sha512Digest);

    char hexOutput[129];
    static const char kHexDigits[] = "0123456789abcdef";
    for (int i = 0; i < 64; ++i) {
        hexOutput[i * 2]     = kHexDigits[(sha512Digest[i] >> 4) & 0x0F];
        hexOutput[i * 2 + 1] = kHexDigits[sha512Digest[i] & 0x0F];
    }
    hexOutput[128] = '\0';

    return env->NewStringUTF(hexOutput);
}

static jbyteArray sha512_digest_internal(JNIEnv* env, jbyteArray inputBytes) {
    if (inputBytes == nullptr) return nullptr;
    jsize len = env->GetArrayLength(inputBytes);
    jbyte* ptr = env->GetByteArrayElements(inputBytes, nullptr);
    if (ptr == nullptr) return nullptr;

    uint8_t digest[64];
    sha512_compute(reinterpret_cast<const uint8_t*>(ptr), static_cast<size_t>(len), digest);
    env->ReleaseByteArrayElements(inputBytes, ptr, JNI_ABORT);

    jbyteArray out = env->NewByteArray(64);
    if (out != nullptr) {
        env->SetByteArrayRegion(out, 0, 64, reinterpret_cast<const jbyte*>(digest));
    }
    return out;
}

static jboolean constant_time_equals_internal(JNIEnv* env, jbyteArray a, jbyteArray b) {
    if (a == nullptr || b == nullptr) return JNI_FALSE;
    jsize lenA = env->GetArrayLength(a);
    jsize lenB = env->GetArrayLength(b);
    if (lenA != lenB) return JNI_FALSE;

    jbyte* ptrA = env->GetByteArrayElements(a, nullptr);
    jbyte* ptrB = env->GetByteArrayElements(b, nullptr);
    if (ptrA == nullptr || ptrB == nullptr) {
        if (ptrA) env->ReleaseByteArrayElements(a, ptrA, JNI_ABORT);
        if (ptrB) env->ReleaseByteArrayElements(b, ptrB, JNI_ABORT);
        return JNI_FALSE;
    }

    volatile uint8_t diff = 0U;
    for (jsize i = 0; i < lenA; ++i) {
        diff |= static_cast<uint8_t>(ptrA[i] ^ ptrB[i]);
    }

    env->ReleaseByteArrayElements(a, ptrA, JNI_ABORT);
    env->ReleaseByteArrayElements(b, ptrB, JNI_ABORT);
    return (diff == 0U) ? JNI_TRUE : JNI_FALSE;
}

} // anonymous namespace

extern "C" {

// Unified com.waqarinstitute.erp.security JNI symbols
JNIEXPORT jstring JNICALL
Java_com_waqarinstitute_erp_security_DeviceFingerprintManager_nativeDeriveDeviceFingerprintSha512Hex(
        JNIEnv* env,
        jobject /* thiz */,
        jstring challengeAndCertDigest) {
    return derive_fingerprint_hex_internal(env, challengeAndCertDigest);
}

JNIEXPORT jbyteArray JNICALL
Java_com_waqarinstitute_erp_security_BoringSslConstantTimeCrypto_nativeSha512Digest(
        JNIEnv* env,
        jobject /* thiz */,
        jbyteArray inputBytes) {
    return sha512_digest_internal(env, inputBytes);
}

JNIEXPORT jboolean JNICALL
Java_com_waqarinstitute_erp_security_BoringSslConstantTimeCrypto_nativeConstantTimeEquals(
        JNIEnv* env,
        jobject /* thiz */,
        jbyteArray a,
        jbyteArray b) {
    return constant_time_equals_internal(env, a, b);
}

// Legacy compatibility JNI exports
JNIEXPORT jstring JNICALL
Java_com_edusync_academy_security_DeviceFingerprintManager_nativeDeriveDeviceFingerprintSha512Hex(
        JNIEnv* env,
        jobject /* thiz */,
        jstring challengeAndCertDigest) {
    return derive_fingerprint_hex_internal(env, challengeAndCertDigest);
}

JNIEXPORT jbyteArray JNICALL
Java_com_edusync_academy_security_BoringSslConstantTimeCrypto_nativeSha512Digest(
        JNIEnv* env,
        jobject /* thiz */,
        jbyteArray inputBytes) {
    return sha512_digest_internal(env, inputBytes);
}

JNIEXPORT jboolean JNICALL
Java_com_edusync_academy_security_BoringSslConstantTimeCrypto_nativeConstantTimeEquals(
        JNIEnv* env,
        jobject /* thiz */,
        jbyteArray a,
        jbyteArray b) {
    return constant_time_equals_internal(env, a, b);
}

} // extern "C"
