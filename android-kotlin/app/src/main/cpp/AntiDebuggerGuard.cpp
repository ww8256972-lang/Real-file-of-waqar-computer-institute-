#include <jni.h>
#include <pthread.h>
#include <sys/ptrace.h>
#include <sys/types.h>
#include <unistd.h>
#include <fcntl.h>
#include <signal.h>
#include <cstdlib>
#include <cstring>
#include <cerrno>
#include <atomic>
#include <android/log.h>

#define GUARD_TAG "WaqarAntiDebug"

namespace edusync::whitebox {
    void zeroizeAllWhiteBoxRam();
}

namespace edusync::antidebug {

static std::atomic<bool> g_watchdogRunning{false};
static std::atomic<int> g_lastDetectedTracerPid{0};
static std::atomic<bool> g_tamperFlagged{false};

static int readCurrentTracerPid() {
    int fd = ::open("/proc/self/status", O_RDONLY | O_CLOEXEC);
    if (fd < 0) return 0;

    char buf[2048];
    ssize_t n = ::read(fd, buf, sizeof(buf) - 1);
    ::close(fd);
    if (n <= 0) return 0;
    buf[n] = '\0';

    const char* key = "TracerPid:";
    const char* pos = std::strstr(buf, key);
    if (pos == nullptr) return 0;

    pos += std::strlen(key);
    while (*pos == ' ' || *pos == '\t') {
        ++pos;
    }
    return std::atoi(pos);
}

static bool inspectWchanForBreakpointTrap() {
    int fd = ::open("/proc/self/wchan", O_RDONLY | O_CLOEXEC);
    if (fd < 0) return false;

    char buf[128];
    ssize_t n = ::read(fd, buf, sizeof(buf) - 1);
    ::close(fd);
    if (n <= 0) return false;
    buf[n] = '\0';

    if (std::strstr(buf, "ptrace_stop") != nullptr ||
        std::strstr(buf, "do_signal_stop") != nullptr ||
        std::strstr(buf, "utrace_stop") != nullptr) {
        return true;
    }
    return false;
}

static bool inspectMapsForFridaOrXposed() {
    int fd = ::open("/proc/self/maps", O_RDONLY | O_CLOEXEC);
    if (fd < 0) return false;

    char buf[4096];
    ssize_t n = 0;
    bool compromised = false;
    while ((n = ::read(fd, buf, sizeof(buf) - 1)) > 0) {
        buf[n] = '\0';
        if (std::strstr(buf, "frida-agent") != nullptr ||
            std::strstr(buf, "frida-gadget") != nullptr ||
            std::strstr(buf, "libxposed_art.so") != nullptr ||
            std::strstr(buf, "libsubstrate.so") != nullptr) {
            compromised = true;
            break;
        }
    }
    ::close(fd);
    return compromised;
}

static void* posixAntiDebuggerWatchdogMain(void* /* arg */) {
    // Continuous 1000ms inspection loop over /proc/self/status, /proc/self/wchan, and /proc/self/maps.
    // Does not blindly abort() so honest users are never crashed by false positives; instead
    // zeroizes sensitive WhiteBox tables and sets g_tamperFlagged so Kotlin blocks exams/attendance
    // and reports the signal to the server.
    while (g_watchdogRunning.load(std::memory_order_relaxed)) {
        int tracerPid = readCurrentTracerPid();
        g_lastDetectedTracerPid.store(tracerPid, std::memory_order_relaxed);

        bool wchanTrapped = inspectWchanForBreakpointTrap();
        bool mapsInjected = inspectMapsForFridaOrXposed();

        if ((tracerPid > 0 && tracerPid != static_cast<int>(::getppid())) ||
            wchanTrapped ||
            mapsInjected) {
            __android_log_print(
                ANDROID_LOG_WARN,
                GUARD_TAG,
                "Debugger or hook signal detected (TracerPid=%d, wchan=%d, maps=%d). Zeroizing session keys.",
                tracerPid,
                wchanTrapped ? 1 : 0,
                mapsInjected ? 1 : 0
            );
            g_tamperFlagged.store(true, std::memory_order_relaxed);
            edusync::whitebox::zeroizeAllWhiteBoxRam();
        }

        ::usleep(1000000);
    }
    return nullptr;
}

void startDetachedAntiDebuggerWatchdog() {
    bool expected = false;
    if (!g_watchdogRunning.compare_exchange_strong(expected, true)) {
        return;
    }

    pthread_t watchdogThread;
    pthread_attr_t attr;
    pthread_attr_init(&attr);
    pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);

    int rc = pthread_create(&watchdogThread, &attr, posixAntiDebuggerWatchdogMain, nullptr);
    pthread_attr_destroy(&attr);
    if (rc != 0) {
        g_watchdogRunning.store(false);
    }
}

bool isDebuggerOrHookCurrentlyDetected() {
    if (g_tamperFlagged.load(std::memory_order_relaxed)) {
        return true;
    }
    int tracer = readCurrentTracerPid();
    if (tracer > 0 && tracer != static_cast<int>(::getppid())) {
        g_tamperFlagged.store(true, std::memory_order_relaxed);
        return true;
    }
    if (inspectWchanForBreakpointTrap() || inspectMapsForFridaOrXposed()) {
        g_tamperFlagged.store(true, std::memory_order_relaxed);
        return true;
    }
    return false;
}

} // namespace edusync::antidebug

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_waqarinstitute_erp_security_TamperZeroizationManager_nativeDetectTamperOrDebugger(
    JNIEnv* /* env */,
    jobject /* thiz */
) {
    return edusync::antidebug::isDebuggerOrHookCurrentlyDetected() ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT jboolean JNICALL
Java_com_edusync_academy_security_TamperZeroizationManager_nativeDetectTamperOrDebugger(
    JNIEnv* /* env */,
    jobject /* thiz */
) {
    return edusync::antidebug::isDebuggerOrHookCurrentlyDetected() ? JNI_TRUE : JNI_FALSE;
}

} // extern "C"
