#include <jni.h>
#include <sys/auxv.h>
#include <signal.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <android/log.h>

#define LOG_TAG "WaqarPacBtiEngine"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

#ifndef HWCAP_PACA
#define HWCAP_PACA (1UL << 30)
#endif
#ifndef HWCAP_PACG
#define HWCAP_PACG (1UL << 31)
#endif
#ifndef HWCAP2_BTI
#define HWCAP2_BTI (1UL << 17)
#endif

namespace {

static jint query_pac_bti_capabilities_internal() {
    jint statusMask = 0;
#if defined(__aarch64__)
    unsigned long hwcap = getauxval(AT_HWCAP);
    unsigned long hwcap2 = getauxval(AT_HWCAP2);

    if ((hwcap & HWCAP_PACA) != 0UL) {
        statusMask |= 0x02;
    }
    if ((hwcap & HWCAP_PACG) != 0UL) {
        statusMask |= 0x04;
    }
    if ((hwcap2 & HWCAP2_BTI) != 0UL) {
        statusMask |= 0x08;
    }
#if defined(__ARM_FEATURE_PAC_DEFAULT) || defined(__ARM_FEATURE_BTI_DEFAULT)
    statusMask |= 0x10;
#endif
    LOGI("ARM64 PAC/BTI capability query: mask=0x%02x (hwcap=0x%lx, hwcap2=0x%lx)",
         statusMask, hwcap, hwcap2);
#else
    // Non-arm64 devices honestly report 0 (unsupported)
    LOGI("Non-ARM64 architecture: PAC/BTI hardware features unsupported (mask=0x00)");
#endif
    return statusMask;
}

static jboolean verify_authenticated_pointer_internal(jlong contextModifier) {
#if defined(__aarch64__)
    unsigned long hwcap = getauxval(AT_HWCAP);
    if ((hwcap & HWCAP_PACA) == 0UL) {
        // Honest reporting: CPU does not support hardware PAC instructions
        return JNI_FALSE;
    }
    uintptr_t probePtr = reinterpret_cast<uintptr_t>(&query_pac_bti_capabilities_internal);
    uintptr_t modifier = static_cast<uintptr_t>(contextModifier);
    uintptr_t signedPtr = probePtr;
    uintptr_t verifiedPtr = 0;

    register uintptr_t x17 __asm__("x17") = signedPtr;
    register uintptr_t x16 __asm__("x16") = modifier;
    __asm__ volatile(
        "hint #0x08\n\t" // PACIA1716
        "mov %0, x17\n\t"
        "hint #0x0c\n\t" // AUTIA1716
        "mov %1, x17\n\t"
        : "=r"(signedPtr), "=r"(verifiedPtr), "+r"(x17)
        : "r"(x16)
        : "memory"
    );
    return (verifiedPtr == probePtr) ? JNI_TRUE : JNI_FALSE;
#else
    (void)contextModifier;
    return JNI_FALSE;
#endif
}

} // anonymous namespace

extern "C" {

JNIEXPORT jint JNICALL
Java_com_waqarinstitute_erp_security_PacBtiControlFlowGuard_nativeInitializePacBtiGuard(
        JNIEnv* /* env */,
        jobject /* thiz */) {
    return query_pac_bti_capabilities_internal();
}

JNIEXPORT jboolean JNICALL
Java_com_waqarinstitute_erp_security_PacBtiControlFlowGuard_nativeVerifyAuthenticatedReturnPointer(
        JNIEnv* /* env */,
        jobject /* thiz */,
        jlong contextModifier) {
    return verify_authenticated_pointer_internal(contextModifier);
}

JNIEXPORT jint JNICALL
Java_com_edusync_academy_security_PacBtiControlFlowGuard_nativeInitializePacBtiGuard(
        JNIEnv* /* env */,
        jobject /* thiz */) {
    return query_pac_bti_capabilities_internal();
}

JNIEXPORT jboolean JNICALL
Java_com_edusync_academy_security_PacBtiControlFlowGuard_nativeVerifyAuthenticatedReturnPointer(
        JNIEnv* /* env */,
        jobject /* thiz */,
        jlong contextModifier) {
    return verify_authenticated_pointer_internal(contextModifier);
}

} // extern "C"
