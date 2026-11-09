#include <jni.h>
#include <signal.h>
#include <ucontext.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <ctime>
#include <cstdint>
#include <cstring>
#include <cstdlib>

namespace edusync::crashpad {

static constexpr size_t kAltStackSize = 64 * 1024;
static uint8_t g_altSignalStackMemory[kAltStackSize];
static char g_crashDumpDirPath[512] = {0};
static struct sigaction g_previousActions[32];
static bool g_handlersInstalled = false;

#pragma pack(push, 1)
struct MinidumpHeader {
    uint32_t signature;       // 'MDMP' = 0x504D444D
    uint32_t version;         // 0x0000A793
    uint32_t streamCount;
    uint32_t streamDirectoryRva;
    uint32_t checksum;
    uint32_t timeDateStamp;
    uint64_t flags;
};

struct CrashExceptionRecord {
    int32_t signalNumber;
    int32_t signalCode;
    uint64_t faultAddress;
    uint64_t programCounter;
    uint64_t stackPointer;
    int32_t processId;
    int32_t threadId;
};
#pragma pack(pop)

static void formatIntDecimal(char* dest, size_t maxLen, uint64_t val) {
    if (maxLen == 0) return;
    char tmp[32];
    int pos = 0;
    if (val == 0) {
        tmp[pos++] = '0';
    } else {
        while (val > 0 && pos < 30) {
            tmp[pos++] = static_cast<char>('0' + (val % 10));
            val /= 10;
        }
    }
    size_t outIdx = 0;
    while (pos > 0 && outIdx + 1 < maxLen) {
        dest[outIdx++] = tmp[--pos];
    }
    dest[outIdx] = '\0';
}

static void extractPcAndSpFromUContext(const ucontext_t* uc, uint64_t& pcOut, uint64_t& spOut) {
    pcOut = 0;
    spOut = 0;
    if (uc == nullptr) return;
#if defined(__aarch64__)
    pcOut = static_cast<uint64_t>(uc->uc_mcontext.pc);
    spOut = static_cast<uint64_t>(uc->uc_mcontext.sp);
#elif defined(__arm__)
    pcOut = static_cast<uint64_t>(uc->uc_mcontext.arm_pc);
    spOut = static_cast<uint64_t>(uc->uc_mcontext.arm_sp);
#elif defined(__x86_64__)
    pcOut = static_cast<uint64_t>(uc->uc_mcontext.gregs[REG_RIP]);
    spOut = static_cast<uint64_t>(uc->uc_mcontext.gregs[REG_RSP]);
#elif defined(__i386__)
    pcOut = static_cast<uint64_t>(uc->uc_mcontext.gregs[REG_EIP]);
    spOut = static_cast<uint64_t>(uc->uc_mcontext.gregs[REG_ESP]);
#endif
}

static void nativeBreakpadSignalHandler(int sig, siginfo_t* info, void* ucontextPtr) {
    if (g_crashDumpDirPath[0] != '\0') {
        char filePath[640];
        std::memset(filePath, 0, sizeof(filePath));
        std::strncpy(filePath, g_crashDumpDirPath, sizeof(filePath) - 80);
        std::strcat(filePath, "/waqar_crash_");

        char tsBuf[32];
        formatIntDecimal(tsBuf, sizeof(tsBuf), static_cast<uint64_t>(::time(nullptr)));
        std::strcat(filePath, tsBuf);
        std::strcat(filePath, "_sig");

        char sigBuf[12];
        formatIntDecimal(sigBuf, sizeof(sigBuf), static_cast<uint64_t>(sig));
        std::strcat(filePath, sigBuf);
        std::strcat(filePath, ".dmp");

        int fd = ::open(filePath, O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0600);
        if (fd >= 0) {
            MinidumpHeader hdr{};
            hdr.signature = 0x504D444DU;
            hdr.version = 0x0000A793U;
            hdr.streamCount = 1;
            hdr.streamDirectoryRva = sizeof(MinidumpHeader);
            hdr.checksum = 0;
            hdr.timeDateStamp = static_cast<uint32_t>(::time(nullptr));
            hdr.flags = 0x00000002ULL;

            uint64_t pc = 0;
            uint64_t sp = 0;
            extractPcAndSpFromUContext(reinterpret_cast<const ucontext_t*>(ucontextPtr), pc, sp);

            // Minimal non-PII crash record (no stack memory or user strings written)
            CrashExceptionRecord rec{};
            rec.signalNumber = sig;
            rec.signalCode = (info != nullptr) ? info->si_code : 0;
            rec.faultAddress = (info != nullptr) ? reinterpret_cast<uintptr_t>(info->si_addr) : 0ULL;
            rec.programCounter = pc;
            rec.stackPointer = sp;
            rec.processId = static_cast<int32_t>(::getpid());
            rec.threadId = static_cast<int32_t>(::gettid());

            (void)::write(fd, &hdr, sizeof(hdr));
            (void)::write(fd, &rec, sizeof(rec));
            ::fsync(fd);
            ::close(fd);
        }
    }

    if (sig >= 0 && sig < 32) {
        const struct sigaction& prev = g_previousActions[sig];
        if ((prev.sa_flags & SA_SIGINFO) && prev.sa_sigaction != nullptr) {
            prev.sa_sigaction(sig, info, ucontextPtr);
            return;
        }
        if (prev.sa_handler != SIG_DFL && prev.sa_handler != SIG_IGN && prev.sa_handler != nullptr) {
            prev.sa_handler(sig);
            return;
        }
    }
    ::signal(sig, SIG_DFL);
    ::raise(sig);
}

bool installSignalHandlers(const char* dumpDirectoryPath) {
    if (dumpDirectoryPath == nullptr || dumpDirectoryPath[0] == '\0') {
        return false;
    }
    std::strncpy(g_crashDumpDirPath, dumpDirectoryPath, sizeof(g_crashDumpDirPath) - 1);
    g_crashDumpDirPath[sizeof(g_crashDumpDirPath) - 1] = '\0';
    ::mkdir(g_crashDumpDirPath, 0700);

    if (g_handlersInstalled) {
        return true;
    }

    stack_t altStack{};
    altStack.ss_sp = g_altSignalStackMemory;
    altStack.ss_size = kAltStackSize;
    altStack.ss_flags = 0;
    (void)::sigaltstack(&altStack, nullptr);

    const int targetSignals[4] = {SIGSEGV, SIGBUS, SIGFPE, SIGILL};
    struct sigaction sa{};
    std::memset(&sa, 0, sizeof(sa));
    sigemptyset(&sa.sa_mask);
    sa.sa_sigaction = nativeBreakpadSignalHandler;
    sa.sa_flags = SA_SIGINFO | SA_ONSTACK;

    for (int sig : targetSignals) {
        ::sigaction(sig, &sa, &g_previousActions[sig]);
    }
    g_handlersInstalled = true;
    return true;
}

} // namespace edusync::crashpad

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_waqarinstitute_erp_security_NativeCrashHarvester_nativeInstallBreakpadSignalHandlers(
    JNIEnv* env, jobject /* thiz */, jstring dumpDirJString
) {
    if (dumpDirJString == nullptr) return JNI_FALSE;
    const char* pathChars = env->GetStringUTFChars(dumpDirJString, nullptr);
    if (pathChars == nullptr) return JNI_FALSE;
    bool ok = edusync::crashpad::installSignalHandlers(pathChars);
    env->ReleaseStringUTFChars(dumpDirJString, pathChars);
    return ok ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT jboolean JNICALL
Java_com_edusync_academy_security_NativeCrashHarvester_nativeInstallBreakpadSignalHandlers(
    JNIEnv* env, jobject /* thiz */, jstring dumpDirJString
) {
    if (dumpDirJString == nullptr) return JNI_FALSE;
    const char* pathChars = env->GetStringUTFChars(dumpDirJString, nullptr);
    if (pathChars == nullptr) return JNI_FALSE;
    bool ok = edusync::crashpad::installSignalHandlers(pathChars);
    env->ReleaseStringUTFChars(dumpDirJString, pathChars);
    return ok ? JNI_TRUE : JNI_FALSE;
}

} // extern "C"
