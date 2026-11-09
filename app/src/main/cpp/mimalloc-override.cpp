#include <jni.h>
#include <cstdlib>
#include <cstring>
#include <cstdint>
#include <atomic>
#include <new>

namespace edusync::mimalloc {

static std::atomic<uint64_t> g_activeAllocations{0};
static std::atomic<uint64_t> g_totalBytesAllocated{0};
static std::atomic<uint64_t> g_secureZeroedFrees{0};

struct AlignedAllocationHeader {
    uint64_t magic;
    size_t payloadSize;
    void* rawBasePtr;
    uint64_t reserved;
};

static constexpr uint64_t kMimallocHeaderMagic = 0x4D494D414C4C4F43ULL; // "MIMALLOC"
static constexpr size_t kCacheLineAlignment = 64;

void* mi_aligned_alloc(size_t size) noexcept {
    const size_t safeSize = (size == 0) ? 16 : size;
    const size_t totalRequired = safeSize + sizeof(AlignedAllocationHeader) + kCacheLineAlignment;
    void* raw = std::malloc(totalRequired);
    if (raw == nullptr) {
        return nullptr;
    }

    uintptr_t rawAddr = reinterpret_cast<uintptr_t>(raw) + sizeof(AlignedAllocationHeader);
    uintptr_t alignedAddr = (rawAddr + (kCacheLineAlignment - 1)) & ~(kCacheLineAlignment - 1);

    auto* hdr = reinterpret_cast<AlignedAllocationHeader*>(alignedAddr - sizeof(AlignedAllocationHeader));
    hdr->magic = kMimallocHeaderMagic;
    hdr->payloadSize = safeSize;
    hdr->rawBasePtr = raw;
    hdr->reserved = 0;

    g_activeAllocations.fetch_add(1, std::memory_order_relaxed);
    g_totalBytesAllocated.fetch_add(safeSize, std::memory_order_relaxed);
    return reinterpret_cast<void*>(alignedAddr);
}

void mi_aligned_free_zero(void* ptr) noexcept {
    if (ptr == nullptr) return;
    uintptr_t alignedAddr = reinterpret_cast<uintptr_t>(ptr);
    auto* hdr = reinterpret_cast<AlignedAllocationHeader*>(alignedAddr - sizeof(AlignedAllocationHeader));

    if (hdr->magic == kMimallocHeaderMagic && hdr->rawBasePtr != nullptr) {
        volatile uint8_t* p = reinterpret_cast<volatile uint8_t*>(ptr);
        for (size_t i = 0; i < hdr->payloadSize; ++i) {
            p[i] = 0x00;
        }
        void* rawBase = hdr->rawBasePtr;
        hdr->magic = 0;
        g_activeAllocations.fetch_sub(1, std::memory_order_relaxed);
        g_secureZeroedFrees.fetch_add(1, std::memory_order_relaxed);
        std::free(rawBase);
    } else {
        std::free(ptr);
    }
}

static jlongArray query_stats_internal(JNIEnv* env) {
    jlong stats[3];
    stats[0] = static_cast<jlong>(g_activeAllocations.load(std::memory_order_relaxed));
    stats[1] = static_cast<jlong>(g_totalBytesAllocated.load(std::memory_order_relaxed));
    stats[2] = static_cast<jlong>(g_secureZeroedFrees.load(std::memory_order_relaxed));

    jlongArray out = env->NewLongArray(3);
    if (out != nullptr) {
        env->SetLongArrayRegion(out, 0, 3, stats);
    }
    return out;
}

} // namespace edusync::mimalloc

void* operator new(std::size_t size) {
    void* p = edusync::mimalloc::mi_aligned_alloc(size);
    if (p == nullptr) {
        std::abort();
    }
    return p;
}

void* operator new[](std::size_t size) {
    void* p = edusync::mimalloc::mi_aligned_alloc(size);
    if (p == nullptr) {
        std::abort();
    }
    return p;
}

void operator delete(void* ptr) noexcept {
    edusync::mimalloc::mi_aligned_free_zero(ptr);
}

void operator delete[](void* ptr) noexcept {
    edusync::mimalloc::mi_aligned_free_zero(ptr);
}

void operator delete(void* ptr, std::size_t /* size */) noexcept {
    edusync::mimalloc::mi_aligned_free_zero(ptr);
}

void operator delete[](void* ptr, std::size_t /* size */) noexcept {
    edusync::mimalloc::mi_aligned_free_zero(ptr);
}

extern "C" {

JNIEXPORT jlongArray JNICALL
Java_com_waqarinstitute_erp_security_MimallocNativeAllocator_nativeGetArenaStats(
    JNIEnv* env, jobject /* thiz */
) {
    return edusync::mimalloc::query_stats_internal(env);
}

JNIEXPORT jlongArray JNICALL
Java_com_edusync_academy_security_MimallocNativeAllocator_nativeGetArenaStats(
    JNIEnv* env, jobject /* thiz */
) {
    return edusync::mimalloc::query_stats_internal(env);
}

} // extern "C"
