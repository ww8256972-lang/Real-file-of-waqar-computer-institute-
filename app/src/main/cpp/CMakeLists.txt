cmake_minimum_required(VERSION 3.22.1)
project("edusync_core_security" LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Hardened production compiler flags: Stack Protector, Symbol Visibility, FORTIFY_SOURCE, Section GC
add_compile_options(
    -O3
    -Wall
    -Wextra
    -fvisibility=hidden
    -fstack-protector-strong
    -D_FORTIFY_SOURCE=2
    -fno-exceptions
    -fno-rtti
    -ffunction-sections
    -fdata-sections
)

# ARMv8.3-A / ARMv9 Pointer Authentication (PAC) & Branch Target Identification (BTI)
if(ANDROID_ABI STREQUAL "arm64-v8a")
    add_compile_options(-mbranch-protection=pac-ret+bti)
endif()

add_link_options(
    -Wl,--gc-sections
    -Wl,-z,relro
    -Wl,-z,now
    -Wl,-z,noexecstack
)

include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/runtime
    ${CMAKE_CURRENT_SOURCE_DIR}/security
)

# 1. Primary Unified edusync_core_security library containing SideChannelShield, HardwareTrngEntropy, and QuickJS
add_library(
    edusync_core_security
    SHARED
    security/SideChannelShield.cpp
    security/HardwareTrngEntropy.cpp
    runtime/QuickJsSandboxEngine.cpp
    runtime/quickjs/quickjs.c
    native-security.cpp
    WhiteBoxCryptoEngine.cpp
    AntiDebuggerGuard.cpp
    native-crash-handler.cpp
    mimalloc-override.cpp
    PacBtiProtection.cpp
    MemoryScrambler.cpp
    DeviceFingerprint.cpp
    YuvProcessor.cpp
)

# 2. Legacy alias edusync_native_security matching earlier builds
add_library(
    edusync_native_security
    SHARED
    native-security.cpp
    WhiteBoxCryptoEngine.cpp
    AntiDebuggerGuard.cpp
    native-crash-handler.cpp
    mimalloc-override.cpp
    PacBtiProtection.cpp
    MemoryScrambler.cpp
    DeviceFingerprint.cpp
    YuvProcessor.cpp
    security/SideChannelShield.cpp
    security/HardwareTrngEntropy.cpp
    runtime/QuickJsSandboxEngine.cpp
    runtime/quickjs/quickjs.c
)

target_compile_definitions(
    edusync_core_security
    PRIVATE
    EDUSYNC_BORINGSSL_CONSTANT_TIME=1
    EDUSYNC_LIBYUV_NEON_SIMD=1
    EDUSYNC_GRPC_PROTOBUF_V3=1
    EDUSYNC_QUICKJS_RUNTIME=1
)

target_compile_definitions(
    edusync_native_security
    PRIVATE
    EDUSYNC_BORINGSSL_CONSTANT_TIME=1
    EDUSYNC_LIBYUV_NEON_SIMD=1
    EDUSYNC_GRPC_PROTOBUF_V3=1
    EDUSYNC_QUICKJS_RUNTIME=1
)

find_library(log-lib log)
find_library(android-lib android)

target_link_libraries(
    edusync_core_security
    ${log-lib}
    ${android-lib}
)

target_link_libraries(
    edusync_native_security
    ${log-lib}
    ${android-lib}
)
