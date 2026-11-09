#include <jni.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <pthread.h>
#include <sys/random.h>
#include <sys/mman.h>
#include <unistd.h>
#include <android/log.h>

#define LOG_TAG "WaqarMemoryScrambler"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

struct ScrambledMemorySlot {
    uint8_t* ciphertextBuffer;
    size_t byteLength;
    uint64_t activeXorKey64;
    uint64_t lastMutationMonotonicMs;
    uint64_t mutationCounter;
    pthread_mutex_t lock;
};

static constexpr size_t kMaxSlots = 32;
static ScrambledMemorySlot g_slots[kMaxSlots];
static pthread_mutex_t g_registry_mutex = PTHREAD_MUTEX_INITIALIZER;
static volatile int g_scrambler_initialized = 0;

static uint64_t current_monotonic_ms() noexcept {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return static_cast<uint64_t>(ts.tv_sec) * 1000ULL +
           static_cast<uint64_t>(ts.tv_nsec / 1000000L);
}

static uint64_t draw_hardware_prng_u64() noexcept {
    uint64_t val = 0;
    if (getrandom(&val, sizeof(val), 0) != sizeof(val)) {
        struct timespec ts;
        clock_gettime(CLOCK_MONOTONIC, &ts);
        val = (static_cast<uint64_t>(ts.tv_nsec) * 0x9E3779B97F4A7C15ULL) ^
              static_cast<uint64_t>(getpid());
    }
    if (val == 0ULL) {
        val = 0xA5A55A5AA5A55A5AULL;
    }
    return val;
}

static void xor_buffer_with_key64(uint8_t* buf, size_t len, uint64_t key64) noexcept {
    for (size_t i = 0; i < len; ++i) {
        uint64_t streamWord = key64 ^ ((static_cast<uint64_t>(i >> 3) + 1ULL) * 0x9E3779B97F4A7C15ULL);
        uint8_t keyByte = static_cast<uint8_t>((streamWord >> ((i & 7) * 8)) & 0xFFU);
        buf[i] ^= keyByte;
    }
}

static void mutate_slot_key_locked(ScrambledMemorySlot* slot) noexcept {
    if (slot == nullptr || slot->ciphertextBuffer == nullptr || slot->byteLength == 0) {
        return;
    }
    uint64_t nextKey64 = draw_hardware_prng_u64();
    uint64_t deltaKey64 = slot->activeXorKey64 ^ nextKey64;
    xor_buffer_with_key64(slot->ciphertextBuffer, slot->byteLength, deltaKey64);
    slot->activeXorKey64 = nextKey64;
    slot->lastMutationMonotonicMs = current_monotonic_ms();
    slot->mutationCounter += 1ULL;
}

static void ensure_initialized() noexcept {
    pthread_mutex_lock(&g_registry_mutex);
    if (!g_scrambler_initialized) {
        memset(g_slots, 0, sizeof(g_slots));
        for (size_t i = 0; i < kMaxSlots; ++i) {
            pthread_mutex_init(&g_slots[i].lock, nullptr);
        }
        g_scrambler_initialized = 1;
    }
    pthread_mutex_unlock(&g_registry_mutex);
}

static jint allocate_slot_internal(JNIEnv* env, jbyteArray plaintextBytes) {
    ensure_initialized();
    if (plaintextBytes == nullptr) return -1;
    jsize len = env->GetArrayLength(plaintextBytes);
    if (len <= 0 || len > 1048576) return -1;

    jbyte* rawInput = env->GetByteArrayElements(plaintextBytes, nullptr);
    if (rawInput == nullptr) return -1;

    int allocatedHandle = -1;
    pthread_mutex_lock(&g_registry_mutex);
    for (size_t i = 0; i < kMaxSlots; ++i) {
        if (g_slots[i].ciphertextBuffer == nullptr) {
            allocatedHandle = static_cast<int>(i);
            break;
        }
    }

    if (allocatedHandle >= 0) {
        ScrambledMemorySlot* slot = &g_slots[allocatedHandle];
        pthread_mutex_lock(&slot->lock);
        slot->ciphertextBuffer = static_cast<uint8_t*>(malloc(static_cast<size_t>(len)));
        if (slot->ciphertextBuffer != nullptr) {
            mlock(slot->ciphertextBuffer, static_cast<size_t>(len));
            memcpy(slot->ciphertextBuffer, rawInput, static_cast<size_t>(len));
            slot->byteLength = static_cast<size_t>(len);
            slot->activeXorKey64 = draw_hardware_prng_u64();
            xor_buffer_with_key64(slot->ciphertextBuffer, slot->byteLength, slot->activeXorKey64);
            slot->lastMutationMonotonicMs = current_monotonic_ms();
            slot->mutationCounter = 1ULL;
        } else {
            allocatedHandle = -1;
        }
        pthread_mutex_unlock(&slot->lock);
    }
    pthread_mutex_unlock(&g_registry_mutex);

    memset(rawInput, 0, static_cast<size_t>(len));
    env->ReleaseByteArrayElements(plaintextBytes, rawInput, JNI_ABORT);
    return allocatedHandle;
}

static jbyteArray unscramble_slot_internal(JNIEnv* env, jint slotHandle) {
    ensure_initialized();
    if (slotHandle < 0 || static_cast<size_t>(slotHandle) >= kMaxSlots) {
        return nullptr;
    }

    ScrambledMemorySlot* slot = &g_slots[slotHandle];
    pthread_mutex_lock(&slot->lock);
    if (slot->ciphertextBuffer == nullptr || slot->byteLength == 0) {
        pthread_mutex_unlock(&slot->lock);
        return nullptr;
    }

    uint64_t nowMs = current_monotonic_ms();
    if (nowMs - slot->lastMutationMonotonicMs >= 1000ULL) {
        mutate_slot_key_locked(slot);
    }

    size_t len = slot->byteLength;
    jbyteArray outArray = env->NewByteArray(static_cast<jsize>(len));
    if (outArray != nullptr) {
        uint8_t* tempPlain = static_cast<uint8_t*>(malloc(len));
        if (tempPlain != nullptr) {
            memcpy(tempPlain, slot->ciphertextBuffer, len);
            xor_buffer_with_key64(tempPlain, len, slot->activeXorKey64);
            env->SetByteArrayRegion(outArray, 0, static_cast<jsize>(len), reinterpret_cast<const jbyte*>(tempPlain));
            for (volatile size_t k = 0; k < len; ++k) {
                tempPlain[k] = 0;
            }
            free(tempPlain);
        }
    }

    mutate_slot_key_locked(slot);
    pthread_mutex_unlock(&slot->lock);
    return outArray;
}

static jlong tick_mutation_internal() {
    ensure_initialized();
    uint64_t totalMutations = 0ULL;
    for (size_t i = 0; i < kMaxSlots; ++i) {
        ScrambledMemorySlot* slot = &g_slots[i];
        pthread_mutex_lock(&slot->lock);
        if (slot->ciphertextBuffer != nullptr && slot->byteLength > 0) {
            mutate_slot_key_locked(slot);
            totalMutations += slot->mutationCounter;
        }
        pthread_mutex_unlock(&slot->lock);
    }
    return static_cast<jlong>(totalMutations);
}

static void zeroize_slot_internal(jint slotHandle) {
    ensure_initialized();
    if (slotHandle < 0 || static_cast<size_t>(slotHandle) >= kMaxSlots) {
        return;
    }

    ScrambledMemorySlot* slot = &g_slots[slotHandle];
    pthread_mutex_lock(&slot->lock);
    if (slot->ciphertextBuffer != nullptr) {
        volatile uint8_t* p = slot->ciphertextBuffer;
        for (size_t i = 0; i < slot->byteLength; ++i) {
            p[i] = 0U;
        }
        munlock(slot->ciphertextBuffer, slot->byteLength);
        free(slot->ciphertextBuffer);
        slot->ciphertextBuffer = nullptr;
        slot->byteLength = 0;
        slot->activeXorKey64 = 0ULL;
        slot->mutationCounter = 0ULL;
    }
    pthread_mutex_unlock(&slot->lock);
}

} // anonymous namespace

extern "C" {

JNIEXPORT jint JNICALL
Java_com_waqarinstitute_erp_security_MemoryScramblerVault_nativeAllocateScrambledSlot(
        JNIEnv* env, jobject /* thiz */, jbyteArray plaintextBytes) {
    return allocate_slot_internal(env, plaintextBytes);
}

JNIEXPORT jbyteArray JNICALL
Java_com_waqarinstitute_erp_security_MemoryScramblerVault_nativeUnscrambleAndRotateSlot(
        JNIEnv* env, jobject /* thiz */, jint slotHandle) {
    return unscramble_slot_internal(env, slotHandle);
}

JNIEXPORT jlong JNICALL
Java_com_waqarinstitute_erp_security_MemoryScramblerVault_nativeTick1000msKeyMutation(
        JNIEnv* /* env */, jobject /* thiz */) {
    return tick_mutation_internal();
}

JNIEXPORT void JNICALL
Java_com_waqarinstitute_erp_security_MemoryScramblerVault_nativeZeroizeAndReleaseSlot(
        JNIEnv* /* env */, jobject /* thiz */, jint slotHandle) {
    zeroize_slot_internal(slotHandle);
}

// Legacy compatibility exports
JNIEXPORT jint JNICALL
Java_com_edusync_academy_security_MemoryScramblerVault_nativeAllocateScrambledSlot(
        JNIEnv* env, jobject /* thiz */, jbyteArray plaintextBytes) {
    return allocate_slot_internal(env, plaintextBytes);
}

JNIEXPORT jbyteArray JNICALL
Java_com_edusync_academy_security_MemoryScramblerVault_nativeUnscrambleAndRotateSlot(
        JNIEnv* env, jobject /* thiz */, jint slotHandle) {
    return unscramble_slot_internal(env, slotHandle);
}

JNIEXPORT jlong JNICALL
Java_com_edusync_academy_security_MemoryScramblerVault_nativeTick1000msKeyMutation(
        JNIEnv* /* env */, jobject /* thiz */) {
    return tick_mutation_internal();
}

JNIEXPORT void JNICALL
Java_com_edusync_academy_security_MemoryScramblerVault_nativeZeroizeAndReleaseSlot(
        JNIEnv* /* env */, jobject /* thiz */, jint slotHandle) {
    zeroize_slot_internal(slotHandle);
}

} // extern "C"
