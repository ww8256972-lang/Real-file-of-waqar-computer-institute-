# CHANGELOG-FIX — Waqar Computer Institute ERP (`com.waqarinstitute.erp`)

This changelog documents the complete Phase 1–9 architectural unification, security hardening, library wiring, C++20 NDK fixes, and GitHub Actions CI/CD repair executed per `fix_prompt_waqar_erp_v2.md`.

---

## Phase 1 — Project Structure & Unification
1. **Single Unified Package (`com.waqarinstitute.erp`)**:
   - Unified `namespace` and `applicationId` to `com.waqarinstitute.erp` in `app/build.gradle.kts`, `AndroidManifest.xml`, ProGuard rules (`proguard-rules.pro`), Kotlin sources (`src/main/java/com/waqarinstitute/erp/**`), and all C++ JNI function exports (`Java_com_waqarinstitute_erp_*`).
   - Removed the duplicate `/android-kotlin/.gradle` build cache and synchronized the root Android project (`app/`, `build.gradle.kts`, `settings.gradle.kts`, `gradle.properties`) with `android-kotlin/`.
   - Added `.gitignore` excluding `.gradle/`, `build/`, `*.jks`, `*.keystore`, `local.properties`, `.env*`, and `node_modules/`.
2. **Manifest & Resource Hardening**:
   - Removed `android.permission.REQUEST_INSTALL_PACKAGES` from `AndroidManifest.xml`.
   - Set `android:icon="@drawable/institute_logo"` and `android:roundIcon="@drawable/institute_logo"`.
   - Added `android:dataExtractionRules="@xml/data_extraction_rules"` and localized `res/values/strings.xml` (English) + `res/values-hi/strings.xml` (Hindi).
   - Updated `res/xml/network_security_config.xml` with real SPKI SHA-256 certificate pins for Google Trust Services (`GTS Root R1`, `GTS Root R2`) and `DigiCert Global Root G2`.
3. **Gradle & R8 Configuration**:
   - Removed debug keystore fallback and hardcoded `"android"` keystore passwords on release builds.
   - Enabled `isMinifyEnabled = true` and `isShrinkResources = true` for release builds with targeted `proguard-rules.pro` rules (removing blanket `-keep class com.waqarinstitute.erp.** { *; }`).
   - Split Chucker into `debugImplementation("com.github.chuckerteam.chucker:library:4.0.0")` and `releaseImplementation("com.github.chuckerteam.chucker:library-no-op:4.0.0")`.
   - Split LeakCanary into `debugImplementation("com.squareup.leakcanary:leakcanary-android:2.14")` and `implementation("com.squareup.leakcanary:plumber-android:2.14")`.
   - Changed `io.realm.kotlin:library-base:2.0.0` from `compileOnly` to `implementation`.

---

## Phase 2 — Authentication, Firestore Rules, Storage Rules & Cloud Functions
1. **Firebase Authentication (`FirebaseAuth`)**:
   - Replaced plaintext Firestore password comparison in `WaqarFirebaseRepository.kt` with `FirebaseAuth.signInWithEmailAndPassword` and custom role claims (`student` | `teacher` | `parent` | `admin`).
   - Removed `password` and `passwordHash` fields from `UserProfile`, `StudentEntity`, SQLite tables, and UI state.
   - Removed hardcoded `waqar/waqar` and `Rashid/student123` credentials and replaced the DOB password reset flow with `FirebaseAuth.sendPasswordResetEmail` and the admin-only `adminResetUserPassword` Cloud Function.
   - Added `functions/scripts/bootstrap-super-admin.ts` and `functions/scripts/migrate-legacy-users.ts`.
2. **Custom Keystore-Attested Firebase App Check (`CustomKeystoreAppCheckProvider.kt`)**:
   - Implemented a custom `AppCheckProvider` & `AppCheckProviderFactory` backed by Android Keystore ECDSA P-256 key attestation and verified by `exchangeKeyAttestationForAppCheckToken` in `functions/src/index.ts`.
3. **Firestore & Storage Security Rules (`firestore.rules`, `storage.rules`, `firestore.rules.test.ts`)**:
   - Removed `allow get: if true;` on `users/{uid}`, removed `isSessionOrAuth()`, and removed the legacy `admins` collection.
   - Enforced `allow write: if false;` on `attendance`, `results`, `audit_logs`, `studentSessions`, and `privateSessionKeys`.
   - Added automated rules unit tests in `firestore.rules.test.ts`.
4. **Cloud Functions & Cloud Run gRPC Service**:
   - Added `aiTutor` (Gemini proxy using `GEMINI_API_KEY` from Secret Manager with per-UID rate limiting), `createInstituteUser`, `adminResetUserPassword`, `exchangeKeyAttestationForAppCheckToken`, `generateAgoraRtcToken`, `generateDynamicAttendanceQr`, `verifyAndSubmitDynamicAttendance`, and `gradeSubmittedExam` in `functions/src/index.ts`.
   - Added `cloud-run-exam-stream/server.ts` implementing the HTTP/2 gRPC `ExamStreamService` defined in `edusync_exam_stream.proto`.

---

## Phase 3–7 — Complete Library & C++20 NDK Wiring Table (Deliverable Section 9)

| # | Library / Native Module | Dependency Coordinate / Source File | Production Call Site (File + Function) | Unit / Instrumented Test |
|---|---|---|---|---|
| 1 | **Google Tink (`1.15.0`)** | `com.google.crypto.tink:tink-android:1.15.0` | `VeteranSystemsSecuritySuite.kt` (`TinkAeadVault.encrypt` / `decrypt`) & `EduSyncSecuritySuite.kt` (`SecureLocalVault`) | `NativeAndInstrumentedLibraryTest.verifyTinkAeadEncryptDecryptAndTamperRejection` |
| 2 | **Conscrypt (`2.5.3`)** | `org.conscrypt:conscrypt-android:2.5.3` | `ConscryptSecurityProvider.kt` (`ConscryptSecurityProvider.install`) & `VeteranSystemsSecuritySuite.kt` (`MutualTlsSessionManager.buildHardenedOkHttpClient`) | `NativeAndInstrumentedLibraryTest.verifyConscryptTls13ProviderInstalled` |
| 3 | **SQLCipher (`4.5.4`)** | `net.zetetic:android-database-sqlcipher:4.5.4` | `VeteranSystemsSecuritySuite.kt` (`SqlCipherExamAttendanceVault.openEncryptedAttendanceDatabase` & `createRoomSupportOpenHelperFactory`) | `NativeAndInstrumentedLibraryTest.verifySqlCipherEncryptedDatabaseAndRealmCache` |
| 4 | **Realm Kotlin (`2.0.0`)** | `io.realm.kotlin:library-base:2.0.0` | `EnterpriseSecurityAndPerformanceSuite.kt` (`RealmExamCacheRepository.cacheEncryptedExamChunk` / `getCachedExamChunks`) | `NativeAndInstrumentedLibraryTest.verifySqlCipherEncryptedDatabaseAndRealmCache` |
| 5 | **FlatBuffers (`24.3.25`)** | `com.google.flatbuffers:flatbuffers-java:24.3.25` + `src/main/flatbuffers/exam_schema.fbs` | `VeteranSystemsSecuritySuite.kt` (`FlatBuffersExamEngine.serializeExamPaperToFlatBuffer` & `readQuestionZeroCopy`) | `LibraryVerificationTest.FlatBuffersExamEngine serializes and reads ExamBundle zero-copy without answer key` |
| 6 | **Protobuf (`4.28.3`)** | `com.google.protobuf:protobuf-javalite:4.28.3`, `protobuf-kotlin-lite:4.28.3` + `src/main/proto/edusync_exam_stream.proto` | `EnterpriseSecurityAndPerformanceSuite.kt` (`GrpcExamStreamClient.serializeSubmissionEnvelopeToProtobuf` / `deserializeSubmissionEnvelopeFromProtobuf`) | `LibraryVerificationTest.Protobuf and gRPC-Kotlin serialize and stream ExamSubmissionEnvelope over transport` |
| 7 | **gRPC-Kotlin / OkHttp (`1.68.1` / `1.4.1`)** | `io.grpc:grpc-okhttp:1.68.1`, `grpc-protobuf-lite:1.68.1`, `grpc-stub:1.68.1`, `grpc-kotlin-stub:1.4.1` | `EnterpriseSecurityAndPerformanceSuite.kt` (`GrpcExamStreamClient.streamAnswerSubmissionOverLoopback` / `createCloudRunChannel`) | `LibraryVerificationTest.Protobuf and gRPC-Kotlin serialize and stream ExamSubmissionEnvelope over transport` |
| 8 | **Koin (`3.5.6`)** | `io.insert-koin:koin-android:3.5.6`, `koin-androidx-compose:3.5.6` | `LowLevelSystemsArchitecture.kt` (`eduSyncEnterpriseKoinModule`) & `WaqarApplication.kt` (`startKoin`) | `NativeAndInstrumentedLibraryTest` + Koin module verification |
| 9 | **AndroidX Startup (`1.2.0`)** | `androidx.startup:startup-runtime:1.2.0` | `LowLevelSystemsArchitecture.kt` (`LoggingAndProviderInitializer` -> `NativeSecurityInitializer` -> `EduSyncAppInitializer`) | Verified via `InitializationProvider` in `AndroidManifest.xml` |
| 10 | **Paging 3 (`3.3.2`)** | `androidx.paging:paging-runtime-ktx:3.3.2`, `paging-compose:3.3.2` | `WaqarDatabase.kt` (`StudentDao.getStudentsPaged`) & `EduSyncSecuritySuite.kt` (`FirestoreStudentPagingSource`) | Verified via `getRefreshKey` and `PagingSource.load` |
| 11 | **WorkManager (`2.9.1`)** | `androidx.work:work-runtime-ktx:2.9.1` | `StudentSyncWorker.kt` (`StudentSyncWorker`, `AttendanceUploadWorker`, `CrashReportUploadWorker`) | Enqueued in `WaqarApplication.onCreate` & `NativeCrashHarvester.initialize` |
| 12 | **CameraX (`1.4.0`)** | `androidx.camera:camera-core`, `camera-camera2`, `camera-lifecycle`, `camera-view:1.4.0` | `EduSyncSecuritySuite.kt` (`DynamicQrAttendanceCameraScanner`) | Bound to lifecycle with `PreviewView`, `ImageAnalysis`, and Torch toggle |
| 13 | **ML Kit Barcode Scanning (`17.3.0`)** | `com.google.mlkit:barcode-scanning:17.3.0` | `EduSyncSecuritySuite.kt` (`DynamicQrAttendanceCameraScanner` -> `BarcodeScanning.getClient`) | Processes `InputImage.IMAGE_FORMAT_NV21` produced by `YuvProcessor` |
| 14 | **ZXing Core (`3.5.3`)** | `com.google.zxing:core:3.5.3` | `AttendanceQrGenerator.kt` (`encodePayloadToBitMatrix`, `decodePayloadFromBitMatrix`, `generateQrBitmap`) | `LibraryVerificationTest.ZXing AttendanceQrGenerator encodes and decodes signed payload round-trip` |
| 15 | **Play Services Location (`21.3.0`)** | `com.google.android.gms:play-services-location:21.3.0` | `EduSyncSecuritySuite.kt` (`MockLocationGuard.fetchFreshCoordinatesForServerVerification`) | Enforces 10s timeout, mock provider check, and `accuracy <= 50m` |
| 16 | **OkHttp (`4.12.0`) & Logging Interceptor** | `com.squareup.okhttp3:okhttp:4.12.0`, `logging-interceptor:4.12.0` | `VeteranSystemsSecuritySuite.kt` (`MutualTlsSessionManager.buildHardenedOkHttpClient`) & `RetrofitErpApiService.kt` (`buildRedactedLoggingInterceptor`) | `LibraryVerificationTest.RetrofitErpApiService attaches Firebase Auth and AppCheck headers against MockWebServer` |
| 17 | **Retrofit (`2.11.0`) & Gson Converter** | `com.squareup.retrofit2:retrofit:2.11.0`, `converter-gson:2.11.0` | `RetrofitErpApiService.kt` (`RetrofitErpApiClient.create`) & `WaqarApplication.kt` | `LibraryVerificationTest.RetrofitErpApiService attaches Firebase Auth and AppCheck headers against MockWebServer` |
| 18 | **Timber (`5.0.1`)** | `com.jakewharton.timber:timber:5.0.1` | `LowLevelSystemsArchitecture.kt` (`LoggingAndProviderInitializer`) & `WaqarApplication.kt` | Planted once at startup with debug/release tree |
| 19 | **Coil (`2.7.0`)** | `io.coil-kt:coil-compose:2.7.0` | `WaqarApplication.kt` (`newImageLoader` sharing hardened `okHttpClient`) & `NativeSharedComponents.kt` (`StudentProfilePhotoAvatar`) | Configured with 25% memory cache & 100 MB disk cache |
| 20 | **kotlinx-collections-immutable (`0.3.8`)** | `org.jetbrains.kotlinx:kotlinx-collections-immutable:0.3.8` | `LibraryVerificationTest.kt` & immutable Compose state lists | `LibraryVerificationTest.WhiteBoxCrypto, ConstantTimeCrypto, SRP6a, Kyber768 and ImmutableCollections work deterministically` |
| 21 | **DataStore Preferences (`1.1.1`) & Security Crypto** | `androidx.datastore:datastore-preferences:1.1.1`, `androidx.security:security-crypto:1.1.0-alpha06` | `EduSyncSecuritySuite.kt` (`SecureLocalVault` with `EncryptedSharedPreferences` -> `DataStore` + `Tink` migration) | Tested via `SecureLocalVault` session & migration flow |
| 22 | **AndroidX Tracing (`1.2.0`)** | `androidx.tracing:tracing-ktx:1.2.0` | `LowLevelSystemsArchitecture.kt` (`PerfettoFrameBudgetTracer.traceSection`) & `MainActivity.kt` | Wraps cold startup, YUV conversion, and FlatBuffers deserialization |
| 23 | **AndroidX ProfileInstaller (`1.4.1`)** | `androidx.profileinstaller:profileinstaller:1.4.1` | `EduSyncSecuritySuite.kt` (`BaselineProfileInitializer.warmUpAheadOfTimeCompilation`) | Invoked asynchronously during `MainActivity.onCreate` |
| 24 | **Chucker (`4.0.0`)** | `com.github.chuckerteam.chucker:library:4.0.0` (debug) / `library-no-op:4.0.0` (release) | `VeteranSystemsSecuritySuite.kt` (`MutualTlsSessionManager.buildHardenedOkHttpClient`) | Attached to `OkHttpClient` in debug builds; zero-op in release |
| 25 | **LeakCanary & Plumber (`2.14`)** | `com.squareup.leakcanary:leakcanary-android:2.14` (debug) / `plumber-android:2.14` (release) | `LowLevelSystemsArchitecture.kt` (`ExamResourceLeakGuard`) | Fixes Android framework view/input-method leaks in release |
| 26 | **C++ Module 1: `AntiDebuggerGuard.cpp`** | `src/main/cpp/AntiDebuggerGuard.cpp` | `TamperZeroizationManager.startKernelAntiTamperWatchdog` & `isDeviceTampered` | `NativeAndInstrumentedLibraryTest.verifyNativeJniModulesLoadedAndFunctional` |
| 27 | **C++ Module 2: `native-security.cpp`** | `src/main/cpp/native-security.cpp` | `AppSignatureVerifier.verifySideloadedApkIntegrity` & `ZeroDiskMemoryPdfEngine.renderEncryptedPdfPageFromRam` | `NativeAndInstrumentedLibraryTest.verifyNativeJniModulesLoadedAndFunctional` |
| 28 | **C++ Module 3: `PacBtiProtection.cpp`** | `src/main/cpp/PacBtiProtection.cpp` | `PacBtiControlFlowGuard.verifyAndEnforceControlFlowIntegrity` | `NativeAndInstrumentedLibraryTest.verifyNativeJniModulesLoadedAndFunctional` |
| 29 | **C++ Module 4: `MemoryScrambler.cpp`** | `src/main/cpp/MemoryScrambler.cpp` | `MemoryScramblerVault.sealSecretInScrambledRam` / `unscrambleAndRead` / `wipeVaultSlot` | `NativeAndInstrumentedLibraryTest.verifyNativeJniModulesLoadedAndFunctional` |
| 30 | **C++ Module 5: `DeviceFingerprint.cpp`** | `src/main/cpp/DeviceFingerprint.cpp` (renamed from `SiliconPufFingerprintManager.cpp`; fixed `jbyteArray` typo; removed PIN `8055`) | `DeviceFingerprintManager.deriveHardwareDeviceBindingTag` | `NativeAndInstrumentedLibraryTest.verifyNativeJniModulesLoadedAndFunctional` |
| 31 | **C++ Module 6: `WhiteBoxCryptoEngine.cpp`** | `src/main/cpp/WhiteBoxCryptoEngine.cpp` | `WhiteBoxCrypto.transformExamPayload` & `generateCanaryDecoyToken` | `LibraryVerificationTest` & `NativeAndInstrumentedLibraryTest` |
| 32 | **C++ Module 7: `YuvProcessor.cpp`** | `src/main/cpp/YuvProcessor.cpp` | `YuvProcessor.convertYuv420ToNv21` inside `DynamicQrAttendanceCameraScanner` | `LibraryVerificationTest.YuvProcessor converts synthetic 1280x720 YUV_420_888 frame to NV21 accurately` |
| 33 | **C++ Module 8: `mimalloc-override.cpp`** | `src/main/cpp/mimalloc-override.cpp` | `MimallocNativeAllocator.nativeInitializeMimallocHeap` | `NativeAndInstrumentedLibraryTest.verifyNativeJniModulesLoadedAndFunctional` |
| 34 | **C++ Module 9: `native-crash-handler.cpp`** | `src/main/cpp/native-crash-handler.cpp` | `NativeCrashHarvester.initialize` -> `CrashReportUploadWorker` | `NativeAndInstrumentedLibraryTest.verifyNativeJniModulesLoadedAndFunctional` |

---

## Phase 8 — GitHub Actions `Unexpected HTTP response: 504` Fix
- **Root Cause**: `gradle/actions/setup-gradle@v3` attempted an un-retried HTTP request to `services.gradle.org` to provision Gradle 8.9, which failed with `Error: Unexpected HTTP response: 504` whenever `services.gradle.org` experienced a gateway timeout.
- **Fix Applied in `.github/workflows/android.yml` & `.github/workflows/build-apk.yml`**:
  1. Added `actions/cache@v4` caching `/opt/gradle/gradle-8.9`, `~/.gradle/caches`, and `~/.gradle/wrapper`.
  2. Replaced `gradle/actions/setup-gradle@v3` with a multi-mirror `curl --fail --location --retry 8 --retry-delay 5 --retry-all-errors` provisioning step (`downloads.gradle-dn.com` -> `services.gradle.org` -> `repo.huaweicloud.com`) with `unzip -tq` integrity verification.
  3. Removed the CI step that overwrote `app/proguard-rules.pro`.
  4. Added unit test execution (`testDebugUnitTest`) alongside `assembleRelease` and `assembleDebug` and verified both APK artifacts before upload.
