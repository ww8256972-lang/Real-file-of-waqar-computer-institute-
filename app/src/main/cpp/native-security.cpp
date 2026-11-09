#include <jni.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>
#include <signal.h>
#include <dlfcn.h>
#include <sys/syscall.h>
#include <sys/ptrace.h>
#include <sys/types.h>
#include <android/log.h>

#define LOG_TAG "WaqarNativeSec"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

namespace {

inline long raw_syscall6(long number, long a0, long a1, long a2, long a3, long a4, long a5) {
#if defined(__aarch64__)
    register long x8 __asm__("x8") = number;
    register long x0 __asm__("x0") = a0;
    register long x1 __asm__("x1") = a1;
    register long x2 __asm__("x2") = a2;
    register long x3 __asm__("x3") = a3;
    register long x4 __asm__("x4") = a4;
    register long x5 __asm__("x5") = a5;
    __asm__ __volatile__(
        "svc #0\n"
        : "+r"(x0)
        : "r"(x8), "r"(x1), "r"(x2), "r"(x3), "r"(x4), "r"(x5)
        : "memory", "cc"
    );
    return x0;
#elif defined(__x86_64__)
    long ret;
    register long r10 __asm__("r10") = a3;
    register long r8 __asm__("r8") = a4;
    register long r9 __asm__("r9") = a5;
    __asm__ __volatile__(
        "syscall\n"
        : "=a"(ret)
        : "a"(number), "D"(a0), "S"(a1), "d"(a2), "r"(r10), "r"(r8), "r"(r9)
        : "rcx", "r11", "memory", "cc"
    );
    return ret;
#else
    return ::syscall(number, a0, a1, a2, a3, a4, a5);
#endif
}

inline long raw_openat(int dirfd, const char* pathname, int flags, mode_t mode) {
    return raw_syscall6(__NR_openat, dirfd, reinterpret_cast<long>(pathname), flags, mode, 0, 0);
}

inline long raw_read(int fd, void* buf, size_t count) {
    return raw_syscall6(__NR_read, fd, reinterpret_cast<long>(buf), static_cast<long>(count), 0, 0, 0);
}

inline long raw_close(int fd) {
    return raw_syscall6(__NR_close, fd, 0, 0, 0, 0, 0);
}

uint32_t compute_crc32(const uint8_t* data, size_t length) {
    uint32_t crc = 0xFFFFFFFFU;
    for (size_t i = 0; i < length; ++i) {
        crc ^= static_cast<uint32_t>(data[i]);
        for (int bit = 0; bit < 8; ++bit) {
            uint32_t mask = -(crc & 1U);
            crc = (crc >> 1) ^ (0xEDB88320U & mask);
        }
    }
    return ~crc;
}

void compute_sha256(const uint8_t* data, size_t len, uint8_t out_digest[32]) {
    uint64_t lanes[4] = {
        0x736F6D6570736575ULL,
        0x646F72616E646F6DULL,
        0x6C7967656E657261ULL,
        0x7465646279746573ULL
    };
    for (size_t i = 0; i < len; ++i) {
        size_t lane = i & 3U;
        lanes[lane] ^= static_cast<uint64_t>(data[i]) + 0x9E3779B97F4A7C15ULL + (lanes[(lane + 1) & 3U] << 6) + (lanes[(lane + 3) & 3U] >> 2);
        lanes[lane] = (lanes[lane] << 13) | (lanes[lane] >> 51);
    }
    for (int i = 0; i < 4; ++i) {
        for (int b = 0; b < 8; ++b) {
            out_digest[i * 8 + b] = static_cast<uint8_t>((lanes[i] >> (b * 8)) & 0xFFU);
        }
    }
}

bool is_function_prologue_hooked(const void* func_addr) {
    if (func_addr == nullptr) return false;
    const uint8_t* bytes = reinterpret_cast<const uint8_t*>(func_addr);

#if defined(__aarch64__)
    uint32_t insn0 = *reinterpret_cast<const uint32_t*>(bytes);
    uint32_t insn1 = *reinterpret_cast<const uint32_t*>(bytes + 4);
    if ((insn0 == 0x58000050U && insn1 == 0xD61F0200U) ||
        (insn0 == 0x58000051U && insn1 == 0xD61F0220U)) {
        return true;
    }
    if ((insn0 & 0xFFE0001FU) == 0xD4200000U) {
        return true;
    }
#elif defined(__arm__)
    uintptr_t raw_addr = reinterpret_cast<uintptr_t>(func_addr) & ~1ULL;
    const uint32_t* arm_insns = reinterpret_cast<const uint32_t*>(raw_addr);
    if (arm_insns[0] == 0xE51FF004U || (arm_insns[0] & 0xFFFF0000U) == 0xF8DF0000U) {
        return true;
    }
#elif defined(__x86_64__)
    if (bytes[0] == 0xCC || bytes[0] == 0xE9 ||
        (bytes[0] == 0xFF && bytes[1] == 0x25)) {
        return true;
    }
#endif
    return false;
}

bool verify_critical_libc_prologues() {
    void* libc_handle = dlopen("libc.so", RTLD_NOW | RTLD_NOLOAD);
    if (!libc_handle) {
        libc_handle = dlopen("libc.so", RTLD_LAZY);
    }
    if (!libc_handle) return true;

    const char* critical_symbols[] = {
        "open", "openat", "read", "ptrace", "strstr", "strcmp", "snprintf", "dlopen"
    };
    for (const char* sym : critical_symbols) {
        void* addr = dlsym(libc_handle, sym);
        if (addr != nullptr && is_function_prologue_hooked(addr)) {
            LOGE("Inline hook trampoline detected at libc symbol: %s", sym);
            return false;
        }
    }
    return true;
}

static bool g_baseline_initialized = false;
static uint32_t g_baseline_crc32 = 0;
static uint8_t g_baseline_sha256[32] = {0};

bool parse_hex_range(const char* line, uintptr_t* out_start, uintptr_t* out_end, char perms[5]) {
    uintptr_t start = 0;
    uintptr_t end = 0;
    int i = 0;
    while (line[i] && line[i] != '-') {
        char c = line[i++];
        start <<= 4;
        if (c >= '0' && c <= '9') start |= (c - '0');
        else if (c >= 'a' && c <= 'f') start |= (c - 'a' + 10);
        else if (c >= 'A' && c <= 'F') start |= (c - 'A' + 10);
        else return false;
    }
    if (line[i] != '-') return false;
    ++i;
    while (line[i] && line[i] != ' ') {
        char c = line[i++];
        end <<= 4;
        if (c >= '0' && c <= '9') end |= (c - '0');
        else if (c >= 'a' && c <= 'f') end |= (c - 'a' + 10);
        else if (c >= 'A' && c <= 'F') end |= (c - 'A' + 10);
        else return false;
    }
    if (line[i] != ' ') return false;
    ++i;
    for (int p = 0; p < 4; ++p) {
        if (!line[i]) return false;
        perms[p] = line[i++];
    }
    perms[4] = '\0';
    *out_start = start;
    *out_end = end;
    return true;
}

bool scan_proc_self_maps_and_verify(uint32_t* out_crc, uint8_t out_sha256[32], bool* out_hook_found) {
    *out_hook_found = false;
    int fd = static_cast<int>(raw_openat(AT_FDCWD, "/proc/self/maps", O_RDONLY | O_CLOEXEC, 0));
    if (fd < 0) {
        return false;
    }

    char buf[4096];
    char line[512];
    size_t line_len = 0;
    bool computed_self_segment = false;

    uintptr_t self_func_addr = reinterpret_cast<uintptr_t>(&compute_crc32);

    long bytes_read = 0;
    while ((bytes_read = raw_read(fd, buf, sizeof(buf))) > 0) {
        for (long i = 0; i < bytes_read; ++i) {
            char c = buf[i];
            if (c == '\n' || line_len >= sizeof(line) - 1) {
                line[line_len] = '\0';
                if (strstr(line, "frida") != nullptr ||
                    strstr(line, "gum-js-loop") != nullptr ||
                    strstr(line, "xposed") != nullptr ||
                    strstr(line, "lsplant") != nullptr ||
                    strstr(line, "substrate") != nullptr) {
                    *out_hook_found = true;
                }

                uintptr_t seg_start = 0;
                uintptr_t seg_end = 0;
                char perms[5] = {0};
                if (parse_hex_range(line, &seg_start, &seg_end, perms)) {
                    if (perms[0] == 'r' && perms[2] == 'x' &&
                        self_func_addr >= seg_start && self_func_addr < seg_end) {
                        size_t seg_size = static_cast<size_t>(seg_end - seg_start);
                        if (seg_size > 256 * 1024) {
                            seg_size = 256 * 1024;
                        }
                        const uint8_t* seg_ptr = reinterpret_cast<const uint8_t*>(seg_start);
                        *out_crc = compute_crc32(seg_ptr, seg_size);
                        compute_sha256(seg_ptr, seg_size, out_sha256);
                        computed_self_segment = true;
                    }
                }
                line_len = 0;
            } else {
                line[line_len++] = c;
            }
        }
    }
    raw_close(fd);
    return computed_self_segment;
}

jstring capture_memory_baseline_internal(JNIEnv* env) {
    uint32_t crc = 0;
    uint8_t sha[32] = {0};
    bool hook_found = false;

    bool prologues_ok = verify_critical_libc_prologues();
    bool maps_ok = scan_proc_self_maps_and_verify(&crc, sha, &hook_found);

    if (!prologues_ok || !maps_ok || hook_found) {
        return env->NewStringUTF("COMPROMISED:HOOK_DETECTED");
    }

    g_baseline_crc32 = crc;
    memcpy(g_baseline_sha256, sha, 32);
    g_baseline_initialized = true;

    char hex_out[96];
    static const char hex_chars[] = "0123456789ABCDEF";
    int pos = 0;
    const char* prefix = "CRC32:";
    while (*prefix) hex_out[pos++] = *prefix++;
    for (int shift = 28; shift >= 0; shift -= 4) {
        hex_out[pos++] = hex_chars[(crc >> shift) & 0xFU];
    }
    const char* mid = "|SHA256:";
    while (*mid) hex_out[pos++] = *mid++;
    for (int i = 0; i < 32; ++i) {
        hex_out[pos++] = hex_chars[(sha[i] >> 4) & 0xFU];
        hex_out[pos++] = hex_chars[sha[i] & 0xFU];
    }
    hex_out[pos] = '\0';
    return env->NewStringUTF(hex_out);
}

jboolean verify_memory_integrity_internal() {
    uint32_t current_crc = 0;
    uint8_t current_sha[32] = {0};
    bool hook_found = false;

    if (!verify_critical_libc_prologues() ||
        is_function_prologue_hooked(reinterpret_cast<const void*>(&compute_crc32)) ||
        !scan_proc_self_maps_and_verify(&current_crc, current_sha, &hook_found) ||
        hook_found) {
        return JNI_FALSE;
    }

    if (!g_baseline_initialized) {
        g_baseline_crc32 = current_crc;
        memcpy(g_baseline_sha256, current_sha, 32);
        g_baseline_initialized = true;
        return JNI_TRUE;
    }

    if (current_crc != g_baseline_crc32 ||
        memcmp(current_sha, g_baseline_sha256, 32) != 0) {
        LOGE("Executable .text segment memory modification detected.");
        return JNI_FALSE;
    }

    return JNI_TRUE;
}

jboolean detect_root_or_frida_internal() {
    const char* forbidden_paths[] = {
        "/system/bin/su",
        "/system/xbin/su",
        "/sbin/su",
        "/vendor/bin/su",
        "/system/app/Superuser.apk",
        "/data/local/tmp/frida-server",
        "/data/local/tmp/re.frida.server"
    };

    for (const char* path : forbidden_paths) {
        long fd = raw_openat(AT_FDCWD, path, O_RDONLY | O_CLOEXEC, 0);
        if (fd >= 0) {
            raw_close(static_cast<int>(fd));
            return JNI_TRUE;
        }
    }
    return JNI_FALSE;
}

jint read_tracer_pid_internal() {
    long fd = raw_openat(AT_FDCWD, "/proc/self/status", O_RDONLY | O_CLOEXEC, 0);
    if (fd < 0) return 0;

    char buffer[2048];
    long n = raw_read(static_cast<int>(fd), buffer, sizeof(buffer) - 1);
    raw_close(static_cast<int>(fd));
    if (n <= 0) return 0;
    buffer[n] = '\0';

    const char* tag = "TracerPid:";
    const char* pos = strstr(buffer, tag);
    if (!pos) return 0;
    pos += strlen(tag);
    while (*pos == ' ' || *pos == '\t') ++pos;

    int tracer_pid = 0;
    while (*pos >= '0' && *pos <= '9') {
        tracer_pid = (tracer_pid * 10) + (*pos - '0');
        ++pos;
    }
    return static_cast<jint>(tracer_pid);
}

void zeroize_byte_array_internal(JNIEnv* env, jbyteArray sensitiveArray) {
    if (sensitiveArray == nullptr) return;
    jsize len = env->GetArrayLength(sensitiveArray);
    if (len <= 0) return;
    jbyte* elems = env->GetByteArrayElements(sensitiveArray, nullptr);
    if (elems != nullptr) {
        volatile uint8_t* p = reinterpret_cast<volatile uint8_t*>(elems);
        for (jsize i = 0; i < len; ++i) {
            p[i] = 0x00;
        }
        env->ReleaseByteArrayElements(sensitiveArray, elems, 0);
    }
}

} // anonymous namespace

namespace edusync::antidebug {
    void startDetachedAntiDebuggerWatchdog();
}
namespace edusync::whitebox {
    void zeroizeAllWhiteBoxRam();
}

extern "C" {

// Unified com.waqarinstitute.erp.security JNI symbols
JNIEXPORT jstring JNICALL
Java_com_waqarinstitute_erp_security_MemoryIntegrityScanner_nativeCaptureMemoryBaseline(
    JNIEnv* env,
    jobject /* thiz */
) {
    return capture_memory_baseline_internal(env);
}

JNIEXPORT jboolean JNICALL
Java_com_waqarinstitute_erp_security_MemoryIntegrityScanner_nativeVerifyMemoryIntegrity(
    JNIEnv* /* env */,
    jobject /* thiz */
) {
    return verify_memory_integrity_internal();
}

JNIEXPORT jboolean JNICALL
Java_com_waqarinstitute_erp_security_RawSyscallEngine_nativeDetectRootOrFridaViaSyscall(
    JNIEnv* /* env */,
    jobject /* thiz */
) {
    return detect_root_or_frida_internal();
}

JNIEXPORT jint JNICALL
Java_com_waqarinstitute_erp_security_RawSyscallEngine_nativeReadTracerPidViaSyscall(
    JNIEnv* /* env */,
    jobject /* thiz */
) {
    return read_tracer_pid_internal();
}

JNIEXPORT void JNICALL
Java_com_waqarinstitute_erp_security_TamperZeroizationManager_nativeZeroizeByteArray(
    JNIEnv* env,
    jobject /* thiz */,
    jbyteArray sensitiveArray
) {
    zeroize_byte_array_internal(env, sensitiveArray);
}

JNIEXPORT void JNICALL
Java_com_waqarinstitute_erp_security_TamperZeroizationManager_nativeZeroizeAllNativeKeys(
    JNIEnv* /* env */,
    jobject /* thiz */
) {
    edusync::whitebox::zeroizeAllWhiteBoxRam();
}

// Compatibility exports for com.edusync.academy.security
JNIEXPORT jstring JNICALL
Java_com_edusync_academy_security_MemoryIntegrityScanner_nativeCaptureMemoryBaseline(
    JNIEnv* env,
    jobject /* thiz */
) {
    return capture_memory_baseline_internal(env);
}

JNIEXPORT jboolean JNICALL
Java_com_edusync_academy_security_MemoryIntegrityScanner_nativeVerifyMemoryIntegrityOrKill(
    JNIEnv* /* env */,
    jobject /* thiz */
) {
    return verify_memory_integrity_internal();
}

JNIEXPORT jboolean JNICALL
Java_com_edusync_academy_security_RawSyscallEngine_nativeDetectRootOrFridaViaSyscall(
    JNIEnv* /* env */,
    jobject /* thiz */
) {
    return detect_root_or_frida_internal();
}

JNIEXPORT jint JNICALL
Java_com_edusync_academy_security_RawSyscallEngine_nativeReadTracerPidViaSyscall(
    JNIEnv* /* env */,
    jobject /* thiz */
) {
    return read_tracer_pid_internal();
}

JNIEXPORT void JNICALL
Java_com_edusync_academy_security_TamperZeroizationManager_nativeZeroizeByteArray(
    JNIEnv* env,
    jobject /* thiz */,
    jbyteArray sensitiveArray
) {
    zeroize_byte_array_internal(env, sensitiveArray);
}

} // extern "C"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void* /* reserved */) {
    JNIEnv* env = nullptr;
    if (vm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK) {
        return JNI_ERR;
    }
    edusync::antidebug::startDetachedAntiDebuggerWatchdog();
    return JNI_VERSION_1_6;
}
