# ============================================================================
# WAQAR COMPUTER INSTITUTE ERP (EDUSYNC ACADEMY) — TARGETED R8 / PROGUARD RULES
# R8 obfuscates and shrinks internal application logic while preserving JNI
# entry points, Firestore/Retrofit DTOs, Tink, SQLCipher, FlatBuffers, Protobuf/gRPC,
# Conscrypt, Realm, and AndroidX Startup Initializers.
# ============================================================================

-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-keepattributes Signature, InnerClasses, EnclosingMethod, RuntimeVisibleAnnotations, AnnotationDefault

# 1. Preserve JNI Native Methods & Classes with `external fun`
-keepclasseswithmembernames,includedescriptorclasses class * {
    native <methods>;
}

-keep class com.waqarinstitute.erp.security.TamperZeroizationManager {
    public static native <methods>;
}
-keep class com.waqarinstitute.erp.security.WhiteBoxCrypto {
    public static native <methods>;
}
-keep class com.waqarinstitute.erp.security.AppSignatureVerifier {
    public static native <methods>;
}
-keep class com.waqarinstitute.erp.security.ZeroDiskMemoryPdfEngine {
    private static native <methods>;
}
-keep class com.waqarinstitute.erp.security.NativeCrashHarvester {
    public static native <methods>;
}
-keep class com.waqarinstitute.erp.security.MimallocNativeAllocator {
    public static native <methods>;
}
-keep class com.waqarinstitute.erp.security.PacBtiControlFlowGuard {
    public static native <methods>;
}
-keep class com.waqarinstitute.erp.security.MemoryScramblerVault {
    public static native <methods>;
}
-keep class com.waqarinstitute.erp.security.DeviceFingerprintManager {
    public static native <methods>;
}
-keep class com.waqarinstitute.erp.camera.YuvProcessor {
    public static native <methods>;
}

# 2. Preserve Firestore & Retrofit Data Transfer Objects (DTOs)
-keep class com.waqarinstitute.erp.data.UserProfile { *; }
-keep class com.waqarinstitute.erp.data.BranchDoc { *; }
-keep class com.waqarinstitute.erp.data.CourseDoc { *; }
-keep class com.waqarinstitute.erp.data.BatchDoc { *; }
-keep class com.waqarinstitute.erp.data.ErpRecord { *; }
-keep class com.waqarinstitute.erp.data.network.** { *; }

# 3. Preserve AndroidX Startup Initializers registered in AndroidManifest.xml
-keep class * implements androidx.startup.Initializer {
    public <init>();
    public *;
}

# 4. Google Tink Cryptographic Engine (com.google.crypto.tink:tink-android:1.15.0)
-keep class com.google.crypto.tink.** { *; }
-dontwarn com.google.crypto.tink.**
-dontwarn com.google.errorprone.annotations.**

# 5. Conscrypt TLS 1.3 JCA Provider (org.conscrypt:conscrypt-android:2.5.3)
-keep class org.conscrypt.** { *; }
-dontwarn org.conscrypt.**

# 6. SQLCipher 256-Bit Encrypted Database (net.zetetic:android-database-sqlcipher:4.5.4)
-keep class net.sqlcipher.** { *; }
-keep class net.sqlcipher.database.** { *; }
-keep interface net.sqlcipher.database.** { *; }
-dontwarn net.sqlcipher.**

# 7. FlatBuffers Zero-Copy Serialization (com.google.flatbuffers:flatbuffers-java:24.3.25)
-keep class com.google.flatbuffers.** { *; }
-keep class * extends com.google.flatbuffers.Table { *; }
-keep class * extends com.google.flatbuffers.Struct { *; }

# 8. Protobuf & gRPC-Kotlin / OkHttp Transport
-keep class * extends com.google.protobuf.GeneratedMessageLite { *; }
-keep class io.grpc.** { *; }
-dontwarn io.grpc.**
-dontwarn javax.annotation.**
-dontwarn org.codehaus.mojo.animal_sniffer.**

# 9. Realm Kotlin SDK
-keep class io.realm.kotlin.** { *; }
-dontwarn io.realm.kotlin.**

# 10. Koin, LeakCanary Plumber, Chucker, Retrofit, OkHttp & Firebase
-keep class org.koin.** { *; }
-dontwarn org.koin.**
-keep class leakcanary.** { *; }
-keep class shark.** { *; }
-dontwarn leakcanary.**
-dontwarn shark.**
-keep class com.chuckerteam.chucker.** { *; }
-dontwarn com.chuckerteam.chucker.**
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
