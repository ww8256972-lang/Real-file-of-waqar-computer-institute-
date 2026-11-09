#include <jni.h>
#include <cstdint>
#include <cstring>
#include <vector>
#include <mutex>

// ============================================================================
// WHITE-BOX CRYPTOGRAPHY & DYNAMIC KEY WHITENING ENGINE (C++20 NDK)
// Second at-rest encryption layer for downloaded exam bundles on top of Tink/Keystore.
// Honest Security Note: White-Box lookup tables raise reverse-engineering effort against
// naive memory dumps, but are NOT unbreakable against differential computation analysis (DCA).
// Therefore correct answers are NEVER included in client exam bundles.
// ============================================================================

namespace edusync::whitebox {

struct WhiteBoxLutContext {
    uint8_t forwardTBox[16][256];
    uint8_t inverseTBox[16][256];
    uint32_t roundWhiteningMasks[16];
    bool initialized = false;
};

static WhiteBoxLutContext g_wbContext;
static std::mutex g_wbMutex;

static inline uint8_t affineTransformByte(uint8_t x, uint8_t roundIdx, uint32_t salt) {
    uint8_t s = x ^ static_cast<uint8_t>((salt >> ((roundIdx & 3) * 8)) & 0xFF);
    uint8_t rotated = static_cast<uint8_t>((s << 1) | (s >> 7)) ^
                      static_cast<uint8_t>((s << 3) | (s >> 5)) ^
                      static_cast<uint8_t>(0x63U + roundIdx * 0x1DU);
    return rotated;
}

static void initializeDynamicWhiteBoxTablesLocked(uint32_t dynamicSeed) {
    const uint32_t maskSeeds[4] = {
        0x9E3779B9U ^ dynamicSeed,
        0x7F4A7C15U ^ (dynamicSeed << 5),
        0xF39CC060U ^ (dynamicSeed >> 3),
        0x5CEDC834U ^ (dynamicSeed * 0x45D9F3BU)
    };

    for (uint8_t r = 0; r < 16; ++r) {
        uint32_t whitened = maskSeeds[r & 3] ^ (0xA5A5F00DU + (static_cast<uint32_t>(r) * 0x045D9F3BU));
        g_wbContext.roundWhiteningMasks[r] = whitened;

        uint8_t used[256];
        std::memset(used, 0, sizeof(used));

        for (int i = 0; i < 256; ++i) {
            uint8_t candidate = affineTransformByte(static_cast<uint8_t>(i), r, whitened);
            while (used[candidate] != 0) {
                candidate = static_cast<uint8_t>(candidate + 1U);
            }
            used[candidate] = 1;
            g_wbContext.forwardTBox[r][i] = candidate;
            g_wbContext.inverseTBox[r][candidate] = static_cast<uint8_t>(i);
        }
    }
    g_wbContext.initialized = true;
}

static void ensureTablesInitializedLocked() {
    if (!g_wbContext.initialized) {
        initializeDynamicWhiteBoxTablesLocked(0x7A4B9C2DU);
    }
}

static void secureVolatileZeroize(void* ptr, size_t len) {
    volatile uint8_t* p = reinterpret_cast<volatile uint8_t*>(ptr);
    while (len--) {
        *p++ = 0x00;
    }
}

void zeroizeAllWhiteBoxRam() {
    std::lock_guard<std::mutex> lock(g_wbMutex);
    secureVolatileZeroize(&g_wbContext, sizeof(WhiteBoxLutContext));
    g_wbContext.initialized = false;
}

std::vector<uint8_t> whiteBoxEncryptBuffer(
    const uint8_t* plaintext,
    size_t length,
    const uint8_t* associatedContext,
    size_t contextLen
) {
    std::lock_guard<std::mutex> lock(g_wbMutex);
    ensureTablesInitializedLocked();

    uint32_t iv = 0x811C9DC5U;
    for (size_t i = 0; i < contextLen; ++i) {
        iv ^= associatedContext[i];
        iv *= 0x01000193U;
    }
    iv ^= static_cast<uint32_t>(length * 0x9E3779B9U);

    std::vector<uint8_t> out(length + 8, 0);
    out[0] = static_cast<uint8_t>((iv >> 24) & 0xFF);
    out[1] = static_cast<uint8_t>((iv >> 16) & 0xFF);
    out[2] = static_cast<uint8_t>((iv >> 8) & 0xFF);
    out[3] = static_cast<uint8_t>(iv & 0xFF);

    uint32_t runningTag = iv ^ g_wbContext.roundWhiteningMasks[0];
    uint8_t prevCipher = static_cast<uint8_t>(iv & 0xFF);

    for (size_t idx = 0; idx < length; ++idx) {
        uint8_t blockPos = static_cast<uint8_t>(idx & 0x0F);
        uint8_t maskByte = static_cast<uint8_t>(
            (g_wbContext.roundWhiteningMasks[blockPos] >> ((idx & 3) * 8)) & 0xFF
        );

        uint8_t state = plaintext[idx] ^ prevCipher ^ maskByte;
        state = g_wbContext.forwardTBox[blockPos][state];
        state = g_wbContext.forwardTBox[(blockPos + 5) & 0x0F][state];
        state = g_wbContext.forwardTBox[(blockPos + 11) & 0x0F][state];

        out[4 + idx] = state;
        prevCipher = state;

        runningTag = ((runningTag << 5) | (runningTag >> 27)) ^
                     (static_cast<uint32_t>(state) * 0x45D9F3BU);
    }

    out[4 + length] = static_cast<uint8_t>((runningTag >> 24) & 0xFF);
    out[5 + length] = static_cast<uint8_t>((runningTag >> 16) & 0xFF);
    out[6 + length] = static_cast<uint8_t>((runningTag >> 8) & 0xFF);
    out[7 + length] = static_cast<uint8_t>(runningTag & 0xFF);

    return out;
}

bool whiteBoxDecryptBuffer(
    const uint8_t* ciphertext,
    size_t length,
    const uint8_t* associatedContext,
    size_t contextLen,
    std::vector<uint8_t>& plaintextOut
) {
    if (length < 8) {
        return false;
    }

    std::lock_guard<std::mutex> lock(g_wbMutex);
    ensureTablesInitializedLocked();

    const size_t payloadLen = length - 8;
    uint32_t iv = (static_cast<uint32_t>(ciphertext[0]) << 24) |
                  (static_cast<uint32_t>(ciphertext[1]) << 16) |
                  (static_cast<uint32_t>(ciphertext[2]) << 8) |
                  static_cast<uint32_t>(ciphertext[3]);

    uint32_t expectedIv = 0x811C9DC5U;
    for (size_t i = 0; i < contextLen; ++i) {
        expectedIv ^= associatedContext[i];
        expectedIv *= 0x01000193U;
    }
    expectedIv ^= static_cast<uint32_t>(payloadLen * 0x9E3779B9U);
    if (iv != expectedIv) {
        return false;
    }

    uint32_t computedTag = iv ^ g_wbContext.roundWhiteningMasks[0];
    plaintextOut.resize(payloadLen);
    uint8_t prevCipher = static_cast<uint8_t>(iv & 0xFF);

    for (size_t idx = 0; idx < payloadLen; ++idx) {
        uint8_t cByte = ciphertext[4 + idx];
        computedTag = ((computedTag << 5) | (computedTag >> 27)) ^
                      (static_cast<uint32_t>(cByte) * 0x45D9F3BU);

        uint8_t blockPos = static_cast<uint8_t>(idx & 0x0F);
        uint8_t maskByte = static_cast<uint8_t>(
            (g_wbContext.roundWhiteningMasks[blockPos] >> ((idx & 3) * 8)) & 0xFF
        );

        uint8_t state = g_wbContext.inverseTBox[(blockPos + 11) & 0x0F][cByte];
        state = g_wbContext.inverseTBox[(blockPos + 5) & 0x0F][state];
        state = g_wbContext.inverseTBox[blockPos][state];

        plaintextOut[idx] = state ^ prevCipher ^ maskByte;
        prevCipher = cByte;
    }

    uint32_t receivedTag = (static_cast<uint32_t>(ciphertext[4 + payloadLen]) << 24) |
                           (static_cast<uint32_t>(ciphertext[5 + payloadLen]) << 16) |
                           (static_cast<uint32_t>(ciphertext[6 + payloadLen]) << 8) |
                           static_cast<uint32_t>(ciphertext[7 + payloadLen]);

    if (computedTag != receivedTag) {
        secureVolatileZeroize(plaintextOut.data(), plaintextOut.size());
        plaintextOut.clear();
        return false;
    }
    return true;
}

static jbyteArray encrypt_jni_internal(JNIEnv* env, jbyteArray plaintextBytes, jbyteArray contextBytes) {
    if (plaintextBytes == nullptr) return nullptr;

    jsize plainLen = env->GetArrayLength(plaintextBytes);
    jbyte* plainPtr = env->GetByteArrayElements(plaintextBytes, nullptr);

    jsize ctxLen = (contextBytes != nullptr) ? env->GetArrayLength(contextBytes) : 0;
    jbyte* ctxPtr = (contextBytes != nullptr) ? env->GetByteArrayElements(contextBytes, nullptr) : nullptr;

    std::vector<uint8_t> encrypted = whiteBoxEncryptBuffer(
        reinterpret_cast<const uint8_t*>(plainPtr),
        static_cast<size_t>(plainLen),
        reinterpret_cast<const uint8_t*>(ctxPtr),
        static_cast<size_t>(ctxLen)
    );

    if (plainPtr != nullptr) {
        env->ReleaseByteArrayElements(plaintextBytes, plainPtr, JNI_ABORT);
    }
    if (ctxPtr != nullptr && contextBytes != nullptr) {
        env->ReleaseByteArrayElements(contextBytes, ctxPtr, JNI_ABORT);
    }

    jbyteArray result = env->NewByteArray(static_cast<jsize>(encrypted.size()));
    if (result != nullptr && !encrypted.empty()) {
        env->SetByteArrayRegion(
            result,
            0,
            static_cast<jsize>(encrypted.size()),
            reinterpret_cast<const jbyte*>(encrypted.data())
        );
    }
    return result;
}

static jbyteArray decrypt_jni_internal(JNIEnv* env, jbyteArray ciphertextBytes, jbyteArray contextBytes) {
    if (ciphertextBytes == nullptr) return nullptr;

    jsize cipherLen = env->GetArrayLength(ciphertextBytes);
    jbyte* cipherPtr = env->GetByteArrayElements(ciphertextBytes, nullptr);

    jsize ctxLen = (contextBytes != nullptr) ? env->GetArrayLength(contextBytes) : 0;
    jbyte* ctxPtr = (contextBytes != nullptr) ? env->GetByteArrayElements(contextBytes, nullptr) : nullptr;

    std::vector<uint8_t> decrypted;
    bool ok = whiteBoxDecryptBuffer(
        reinterpret_cast<const uint8_t*>(cipherPtr),
        static_cast<size_t>(cipherLen),
        reinterpret_cast<const uint8_t*>(ctxPtr),
        static_cast<size_t>(ctxLen),
        decrypted
    );

    if (cipherPtr != nullptr) {
        env->ReleaseByteArrayElements(ciphertextBytes, cipherPtr, JNI_ABORT);
    }
    if (ctxPtr != nullptr && contextBytes != nullptr) {
        env->ReleaseByteArrayElements(contextBytes, ctxPtr, JNI_ABORT);
    }

    if (!ok) {
        return nullptr;
    }

    jbyteArray result = env->NewByteArray(static_cast<jsize>(decrypted.size()));
    if (result != nullptr && !decrypted.empty()) {
        env->SetByteArrayRegion(
            result,
            0,
            static_cast<jsize>(decrypted.size()),
            reinterpret_cast<const jbyte*>(decrypted.data())
        );
    }
    return result;
}

} // namespace edusync::whitebox

extern "C" {

JNIEXPORT jbyteArray JNICALL
Java_com_waqarinstitute_erp_security_WhiteBoxCrypto_encryptPayload(
    JNIEnv* env, jobject /* thiz */, jbyteArray plaintextBytes, jbyteArray contextBytes) {
    return edusync::whitebox::encrypt_jni_internal(env, plaintextBytes, contextBytes);
}

JNIEXPORT jbyteArray JNICALL
Java_com_waqarinstitute_erp_security_WhiteBoxCrypto_decryptPayload(
    JNIEnv* env, jobject /* thiz */, jbyteArray ciphertextBytes, jbyteArray contextBytes) {
    return edusync::whitebox::decrypt_jni_internal(env, ciphertextBytes, contextBytes);
}

JNIEXPORT void JNICALL
Java_com_waqarinstitute_erp_security_WhiteBoxCrypto_zeroizeNativeTables(
    JNIEnv* /* env */, jobject /* thiz */) {
    edusync::whitebox::zeroizeAllWhiteBoxRam();
}

// Legacy compatibility exports
JNIEXPORT jbyteArray JNICALL
Java_com_edusync_academy_security_WhiteBoxCrypto_encryptPayload(
    JNIEnv* env, jobject /* thiz */, jbyteArray plaintextBytes, jbyteArray contextBytes) {
    return edusync::whitebox::encrypt_jni_internal(env, plaintextBytes, contextBytes);
}

JNIEXPORT jbyteArray JNICALL
Java_com_edusync_academy_security_WhiteBoxCrypto_decryptPayload(
    JNIEnv* env, jobject /* thiz */, jbyteArray ciphertextBytes, jbyteArray contextBytes) {
    return edusync::whitebox::decrypt_jni_internal(env, ciphertextBytes, contextBytes);
}

JNIEXPORT void JNICALL
Java_com_edusync_academy_security_WhiteBoxCrypto_zeroizeNativeTables(
    JNIEnv* /* env */, jobject /* thiz */) {
    edusync::whitebox::zeroizeAllWhiteBoxRam();
}

} // extern "C"
