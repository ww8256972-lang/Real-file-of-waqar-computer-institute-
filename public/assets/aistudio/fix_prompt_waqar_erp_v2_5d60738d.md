# Waqar Institute ERP: Master Prompt v2

यह फाइल दो हिस्सों में है।
**हिस्सा A (हिंदी):** प्रॉम्प्ट क्या करता है, आपको समझाने के लिए।
**हिस्सा B (English):** असली प्रॉम्प्ट, इसे कोडिंग AI में पेस्ट करें।

---

# हिस्सा A: प्रॉम्प्ट का विस्तार से मतलब

## बुनियादी सोच
1. **कोई लाइब्रेरी नहीं हटेगी।** आपने जो भी लाइब्रेरी और नेटिव मॉड्यूल जोड़े हैं (Tink, Conscrypt, SQLCipher, Realm, FlatBuffers, Protobuf, gRPC, Koin, Chucker, LeakCanary, Tracing, C++ मॉड्यूल वगैरह), सब रहेंगे। हर एक को **असली फाइल में असली काम से जोड़ा जाएगा।**
2. **"असली" की परिभाषा:** हर लाइब्रेरी के लिए (a) कोड में असली कॉल, (b) एक टेस्ट जो साबित करे कि वह चल रही है, (c) एक टेबल में एंट्री। "सिर्फ build.gradle में लिखी है" को असली नहीं माना जाएगा।
3. **सुरक्षा का सिद्धांत:** फोन के अंदर की सिक्योरिटी (anti-debug, root detection, memory scramble) सिर्फ एक अतिरिक्त परत है, क्योंकि रूटेड फोन पर कोई भी क्लाइंट-साइड जाँच बायपास हो सकती है। असली फैसला **हमेशा server (Cloud Functions / rules) पर** होता है।
4. **ईमानदार नाम:** कुछ क्लास के नाम उनके काम से बड़े हैं (जैसे "Silicon PUF", "EliteL9"). उनका काम **बना रहेगा**, पर नाम और कमेंट सही किए जाएंगे ताकि कोई झूठा दावा न रहे।

## पिछली सारी माँगें भी इसमें हैं
- वेब ऐप की सारी फाइलें हटेंगी, सिर्फ एक नेटिव Kotlin + Jetpack Compose प्रोजेक्ट बचेगा (React Native नहीं)।
- लॉगिन Firebase Authentication से होगा, पासवर्ड Firestore में नहीं रहेंगे।
- Firestore/Storage rules नए सिरे से, बिना लॉगिन के कुछ नहीं पढ़ा जा सकेगा।
- Gemini API सिर्फ Cloud Function के पीछे, ऐप में key नहीं।
- डुप्लिकेट `app/` फोल्डर, hardcoded पासवर्ड/PIN, debug-key signing, Chucker release में, आदि सब ठीक होंगे।

## आपकी लाइब्रेरी कैसे "असली" बनेंगी (छोटा सार)
| लाइब्रेरी | असली काम |
|---|---|
| SQLCipher + Room | एन्क्रिप्टेड ऑफलाइन डेटाबेस, key Android Keystore से |
| Realm | परीक्षा के दौरान का लाइव सेशन स्टोर (एन्क्रिप्टेड) |
| Tink + Security-crypto | सारे लोकल एन्क्रिप्शन और keys की wrapping |
| Conscrypt | TLS provider, OkHttp/gRPC में |
| Protobuf + gRPC | परीक्षा का असली लाइव स्ट्रीम (Cloud Run पर gRPC सर्वर) |
| FlatBuffers | प्रश्नों का तेज़, zero-copy बंडल |
| Koin | पूरे ऐप की dependency injection |
| Paging + Room | स्टूडेंट लिस्ट, ऑफलाइन-फर्स्ट |
| WorkManager | बैकग्राउंड सिंक और crash रिपोर्ट अपलोड |
| CameraX + ML Kit + ZXing + YUV(C++) | QR स्कैन और QR जनरेशन |
| Chucker / LeakCanary | debug में पूरा, release में no-op/plumber (लाइब्रेरी रहती है) |
| C++ मॉड्यूल | एक लाइब्रेरी नाम, एक loader, गलती पर साफ़ error, असली कॉल |

## आख़िर में आपको क्या मिलेगा
साफ़ रिपॉज़िटरी, लाइब्रेरी टेबल, असली build/test लॉग, और एक रिपोर्ट कि क्या **नहीं** टेस्ट हो सका (जैसे असली फोन पर)।

---

# हिस्सा B: THE PROMPT (copy from here)

You are a senior Android + Firebase + C++ (NDK) engineer. I will give you my full repository: a native Android app (Kotlin + Jetpack Compose), custom C++ native modules, Firebase backend files, and a legacy React/Vite web app. Produce ONE clean, secure, production-grade **pure native Android project** (Kotlin + Jetpack Compose; NOT React Native, NOT a WebView wrapper), with a secure Firebase/Cloud backend.

## 0. Non-negotiable rules

1. **Nothing gets removed from the library list.** Every dependency in `build.gradle.kts` and every custom module (Kotlin and C++) STAYS. My job is not to delete my work; yours is to make each piece genuinely functional, wired into real features, built, loaded, called and tested.
2. **"Real" has a precise meaning.** For every library/module you must provide: (a) a real call site in production code, (b) a test (unit, instrumented, or emulator) that fails if the library is not actually being used, (c) a row in the final table (section 9). A dependency that is only declared is a bug.
3. **No fake behavior.** No `delay()` that pretends to work, no functions that always `return true`, no hardcoded demo users or credentials, no placeholder IDs, no swallowed errors. If something fails, it fails loudly (log + block the sensitive feature + report to the server).
4. **Honest naming.** If a class/comment claims more than the code does (for example "Silicon PUF", "EliteL9", "120 FPS", "unbreakable"), keep the functionality but rename it and fix its comments to describe exactly what it does and its limits. Update `security_spec.md` so every claim matches the code.
5. **Server is the authority.** Client-side checks (anti-debug, root/Frida detection, memory scrambling, mock-location flag) are defense-in-depth signals only. Every security decision (login, role, attendance validity, exam access, scoring) is enforced by Firestore rules and Cloud Functions/Cloud Run.
6. **Never put secrets in code, BuildConfig, workflows or git.** No passwords, PINs, API keys, keystore passwords.
7. **Never claim success without proof.** After each phase run the build and tests and paste real output. Clearly list what you could NOT verify (e.g. behavior on physical devices, real certificates, real Agora/Gemini accounts).
8. If something is ambiguous or impossible, STOP and ask me ONE precise question. Do not guess and do not fake.

## 1. Project structure: remove the web app, keep one Android project

**Delete (web app and leftovers):** `src/`, `public/`, `index.html`, `vite.config.ts`, root `package.json`, `bun.lock`, root `tsconfig.json`, `eslint.config.mjs`, `server.ts`, `src/db/*` (drizzle), `.aistudio/`, `firebase-applet-config.json`, `firebase-blueprint.json`, `.env.example` (replace with a documented one for `functions/` only), all web-only components (`KotlinCiModal`, `AdminErpPanel`, `RolePortals`, and the rest), unused PDFs/screenshots, and the committed `android-kotlin/.gradle/` cache.

**Keep:** `android-kotlin/` (the complete version, with `ui/` and `edusync/`), `functions/`, `firestore.rules`, `firestore.rules.test.ts`, `storage.rules`, `.github/workflows/` (rewritten), `security_spec.md` (rewritten honestly).

**Remove the stale duplicate:** the root-level `app/`, `build.gradle.kts`, `settings.gradle.kts`, `gradle.properties` (older copy without `ui/`). Before deleting, diff `app/` vs `android-kotlin/app/` and port anything only present in the older copy. Then move `android-kotlin/*` to the repo root: a single Gradle project.

**Unify naming:** today `namespace = com.waqarinstitute.erp`, `applicationId = com.edusync.academy`, code is split across `com.waqarinstitute.erp` and `com.edusync.academy`. Pick one root package and one applicationId; move all code; fix imports, manifest, ProGuard rules, and JNI function names.

Add a correct `.gitignore` (Gradle caches, `build/`, `*.jks`, `local.properties`, `.env*`, `node_modules`).

## 2. Authentication (critical)

Current problems: plain-text passwords in Firestore (`users.password`, `admins.password`) compared on the client; unauthenticated `get` on `users/{id}`; default admin `waqar/waqar`; seeded `Rashid/student123`.

1. Use **Firebase Authentication** (email/password; map `username` to `username@<institute-domain>` internally). Remove every `password`/`passwordHash` field from Firestore, Room entities, models and UI state.
2. Remove the hardcoded admin and the seeded dummy student. No default credentials anywhere.
3. **Admin-only account creation** through a callable Cloud Function (Admin SDK): creates the Auth user, sets custom claims (`role`: admin|teacher|student|parent|accountant|receptionist, plus `branchId`), writes the profile doc (no password), returns a one-time temporary password shown once; the user must change it at first login.
4. First super-admin: one documented local bootstrap script (Admin SDK) that generates a strong random password, then is disabled.
5. Password reset via `sendPasswordResetEmail` or an admin-triggered function. Remove the "reset using date of birth" flow.
6. Authorization uses verified token claims (`request.auth.token.role`), never client-editable fields.
7. Migration script: for existing users create Auth accounts, then delete the `password` fields. Treat all old passwords as compromised; force a reset.
8. **Firebase App Check** on Firestore, Storage and Functions. The app is sideloaded (no Play Store), so Play Integrity is not available: implement a **custom App Check provider** backed by an Android Keystore key-attestation check verified by a Cloud Function; use the debug provider only in debug builds.

## 3. Firestore and Storage rules

Rewrite with default-deny:
- `users/{uid}`: owner, admin, or an assigned teacher only. **No unauthenticated `get` or `list`.** Clients can never write `role`, `status`, `branchId`, `password`.
- Remove the `admins` collection (admin = custom claim).
- `branches`, `courses`, `batches`, `erpRecords`, `app_config`: sign-in required; writes only for authorized roles; keep field validation.
- `attendance`, `results`, `audit_logs`, `studentSessions`, `privateSessionKeys`: client writes are `false` (Cloud Functions only).
- Remove every `isSessionOrAuth(...)`-style fallback that accepts non-authenticated "sessions".
- Extend `firestore.rules.test.ts` using the Firebase emulator: anonymous read denied, student cannot read another student, student cannot self-promote, teacher scope, admin scope. All must pass in CI.

## 4. Cloud Functions and Cloud Run

1. **Gemini proxy:** callable `aiTutor`; `GEMINI_API_KEY` stored as a Firebase secret (Secret Manager); auth required; per-user rate limit and input size limit. Remove the key from `BuildConfig` and the app entirely.
2. **Attendance (`submitAttendance`):** verify QR HMAC, nonce uniqueness, expiry window, batch membership; **compute geofence distance on the server** using submitted coordinates and accuracy; verify the payload signature from the device-bound Keystore key (public key registered at enrollment). `isMockLocation` from the client is only an extra signal that is logged.
3. **Exams:** question delivery, session keys and scoring on the server; correct answers never reach the client before submission.
4. **Exam stream gRPC service (Cloud Run):** implement the server for `edusync_exam_stream.proto` (Cloud Functions cannot do bidirectional streaming; Cloud Run supports gRPC). Verify the Firebase ID token and App Check token in call metadata.
5. Input validation (zod or equivalent), structured errors, audit logging to `audit_logs`, emulator-based tests. Remove leftover mock/demo branches.

## 5. Make EVERY library real (do not remove any)

Go through each dependency. Wire it as described; if my description is not sufficient, implement the closest real use. All of the following STAY.

**Firebase (Auth, Firestore, Functions, Storage) + `kotlinx-coroutines-play-services`:** core data layer; wrap `Task` with `await()`; repository pattern behind interfaces.

**Tink (`tink-android`):** AEAD for field/file encryption; keyset wrapped by an Android Keystore master key. Use it to wrap the SQLCipher passphrase and the Realm key.

**`androidx.security:security-crypto`:** migrate any existing preferences to `EncryptedSharedPreferences` with a `MasterKey`, with a migration path to DataStore + Tink. Note it is deprecated; document that and keep it only as the migration layer.

**Conscrypt:** install as the first security provider at app start (`Security.insertProviderAt(Conscrypt.newProvider(), 1)`), and use its SSL socket factory/trust manager in OkHttp and the gRPC channel, together with the network-security-config pins. Add a test asserting the active provider and a TLS handshake.

**SQLCipher (`sqlcipher-android`) + `androidx.sqlite-ktx` + Room:** the persistent encrypted ERP cache (students, attendance queue, fees). Passphrase generated once, wrapped by Tink/Keystore; never hardcoded. Room opens through the SQLCipher `SupportOpenHelperFactory`. Test: the DB file is not readable without the key.

**Realm Kotlin (`io.realm.kotlin`):** currently `compileOnly`, so it cannot run. Move to `implementation`, apply the Realm Gradle plugin, and give it a bounded, real role: the live **exam session store** (answers, timers, MVCC reads while the UI observes), encrypted with a 64-byte key wrapped by Keystore/Tink and deleted at session end. First verify the library's current maintenance status and compatibility with the Kotlin/AGP versions in use; if there is a problem, tell me before changing anything.

**Protobuf (`protobuf-javalite`) + gRPC (`grpc-okhttp`, `grpc-protobuf-lite`, `grpc-stub`):** apply the protobuf Gradle plugin to generate lite classes from `edusync_exam_stream.proto`; implement a real `ExamStreamClient` (ManagedChannel over OkHttp transport, token interceptor, Conscrypt TLS, pinned certs, backoff and reconnect). Align versions with the gRPC that Firestore already bundles (use constraints or a BOM) and add a dependency-conflict check.

**FlatBuffers:** compile `exam_schema.fbs` with `flatc` in a Gradle task; the server returns question bundles as FlatBuffers; the client reads them zero-copy and stores the encrypted blob. Test round-trip and a size/time comparison against JSON.

**Koin:** real DI: `startKoin` in `Application`, modules for repositories, database, network, ViewModels (`koinViewModel` in Compose). Remove manual singletons. Add `checkModules`/verify test.

**AndroidX Startup:** the existing `EduSyncAppInitializer` runs real, ordered init (logging, providers, native loader, Koin), with dependencies declared between initializers. Remove duplicate `ContentProvider`s.

**Paging 3 (`paging-runtime-ktx`, `paging-compose`):** `Pager` + Room `PagingSource`, and `RemoteMediator` fetching from Firestore; Compose `LazyColumn` with `collectAsLazyPagingItems`. Fix `StudentPagingSource` so it actually pages.

**WorkManager:** real periodic and one-time workers with constraints and backoff: student sync, queued attendance upload, crash-report upload. Unique work names; tests with `TestListenableWorkerBuilder`.

**CameraX (`camera-core`, `camera-camera2`, `camera-lifecycle`, `camera-view`) + `concurrent-futures-ktx` + Guava + ML Kit barcode + ZXing:** real QR scanner screen (`ImageAnalysis` → ML Kit), runtime permission flow with rationale, torch toggle, lifecycle-safe binding using `ListenableFuture` helpers. ZXing generates the rotating attendance QR (HMAC payload from the server). Test QR generate → decode round trip.

**YuvProcessor (C++/JNI):** use it in the `ImageAnalysis` path (NV21 → RGB565) when needed, with a Kotlin fallback and a benchmark test showing it is actually faster. Otherwise state the measured result.

**Play Services Location:** real location fetch with accuracy threshold, timeouts and permission handling, feeding attendance.

**OkHttp + Retrofit + logging-interceptor:** Retrofit service for the HTTPS endpoints (fee receipts, ebook signed URLs, etc.) with an interceptor adding the Firebase ID token and App Check token. Logging interceptor only at `NONE` in release; redact auth headers in debug.

**Timber:** `DebugTree` in debug; in release a tree that only forwards non-PII errors to the crash pipeline.

**Coil + coil-compose:** avatars, logo and course images with caching, placeholders and error states.

**`kotlinx-collections-immutable`:** UI state uses `ImmutableList`/`PersistentList` so Compose can skip recompositions; add a compose-compiler stability report check.

**DataStore Preferences:** app settings (language, theme, last branch). Real read/write flows.

**AndroidX Tracing (`tracing-ktx`):** `trace("...")` sections around exam load, QR decode, sync; remove the "120 FPS guaranteed" claims and instead record real numbers with Macrobenchmark.

**Profile Installer:** add a Baseline Profile module and generate it with Macrobenchmark; verify startup improvement with measurements.

**Chucker:** `debugImplementation` the real library and `releaseImplementation` the `-no-op` artifact (library stays, inspector is not shipped to users).

**LeakCanary Plumber (`plumber-android`, `plumber-android-core`):** keep in release (it is designed for that) and add `debugImplementation` of `leakcanary-android`. Verify plumber is active.

**Compose/AndroidX core (Compose BOM, Material3, material-icons-extended, Navigation Compose, lifecycle, activity-compose):** real navigation graph with typed routes, ViewModel + `StateFlow`, loading/error/empty states, accessibility labels, `strings.xml` in English and Hindi. Use the icons library only for icons actually shown (R8 will strip the rest).

**Agora (if present in the code/UI):** integrate the real SDK with tokens generated by a Cloud Function; remove the placeholder `WAQAR_AGORA_APP_ID` default.

### 5.1 Native (C++/NDK) modules: all stay, all become real

Modules: `AntiDebuggerGuard`, `WhiteBoxCryptoEngine`, `native-crash-handler`, `YuvProcessor`, `native-security`, `MemoryScrambler`, `SiliconPufFingerprintManager`, `PacBtiProtection`, `mimalloc-override`.

Current state: the NDK build is off by default (`enableNativeNdk=false`) and CI never enables it; `loadLibrary` errors are swallowed; two library names exist (`edusync_native_sec`, `edusync_native_security`); only `TamperZeroizationManager` is actually called.

Required:
1. **One library name, one loader.** A single `NativeLibrary` object calls `System.loadLibrary` once and exposes status. NDK is ON in the normal build (`arm64-v8a`, `armeabi-v7a`, `x86_64`). JNI function names must match the final package (add a test that calls every `external fun`).
2. **Fail loudly:** in release, if the library fails to load, block exams and attendance, report to the server, and show a clear message. Never a silent `catch`.
3. **Wire each module into a real flow:**
   - *Anti-debug / root / Frida / tamper* → runs at startup and before login, exam start and attendance. On detection: set a flag, zeroize session keys, report to the server, block sensitive actions. Do NOT blindly `abort()` (false positives would crash honest users); do not run `PTRACE_TRACEME` in debug builds.
   - *MemoryScrambler* → holds the exam session key and the attendance HMAC secret in scrambled slots with the 1-second key rotation; zeroize on logout/exam end.
   - *WhiteBox crypto* → a second at-rest encryption layer for downloaded exam bundles, on top of Tink/Keystore. Document honestly that white-box tables raise attacker effort but are not unbreakable.
   - *"SiliconPuf"* → rename to `DeviceFingerprint`; derive it from the Keystore attestation certificate chain plus stable hardware properties; send to the server for device binding. It is not a physical PUF and the code/comments must say so. Remove the hardcoded PIN `8055` (three copies); challenges come from the server, short-lived.
   - *PAC/BTI* → enabled only on arm64 devices that report support (HWCAP); on other devices report "unsupported" honestly. Compile flags stay.
   - *mimalloc-override* → linked for the native module, arena stats shown in a debug-only diagnostics screen; add a benchmark.
   - *native-crash-handler* → installs signal handlers, writes a minimal crash file (no PII) to private storage, uploaded by WorkManager on next launch.
   - *YuvProcessor* → see CameraX above.
4. Instrumented tests (emulator + at least arm64) for each native function.

## 6. Other Android fixes

- **Signing:** release build must FAIL if no keystore is supplied; remove the debug-key fallback and every default keystore password (Gradle and workflows).
- **R8:** `isMinifyEnabled = true`, `isShrinkResources = true`; write correct keep rules for Firebase, Tink, Realm, ML Kit, Room/SQLCipher, Koin, protobuf, gRPC, FlatBuffers, JNI (`native` methods). Release must run correctly after shrinking. Remove `-Xskip-metadata-version-check`; set lint `abortOnError = true` for release and fix warnings.
- **Manifest:** remove unused `REQUEST_INSTALL_PACKAGES`; request each permission at runtime with rationale; `exported` only where required; add a real adaptive launcher icon from the Waqar logo; `allowBackup=false` plus data-extraction rules.
- **Certificate pinning:** verify pins against the real certificates, keep a backup pin and a rotation note; remove hosts that are not used (e.g. `api.edusyncacademy.in`) unless they really exist.
- Replace every fake `delay()`/`Thread.sleep()` used to "simulate progress" with real progress.
- Compose: business logic in ViewModels, not composables.

## 7. CI/CD (one workflow)

checkout → JDK 17 → Gradle cache → `lintRelease testDebugUnitTest` → Firebase emulator tests (rules + functions) → instrumented tests on an emulator (`connectedDebugAndroidTest`) → signed `assembleRelease` using secrets (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`) → upload APK artifact. No default passwords, no `|| fallback` that hides failures. Add gitleaks secret scanning and a dependency-vulnerability check.

## 8. Security hygiene and standards

Target **OWASP MASVS** (L1 fully, L2 where feasible: storage, crypto, auth, network, platform, code, resilience). Rotate everything that was ever in the repo (Gemini key, Agora credentials, a NEW keystore, admin passwords); restrict the Firebase API key to the Android package and certificate SHA-256; purge secrets from git history (`git filter-repo`). Document the threat model in `security_spec.md`, including what client-side protections cannot prevent.

## 9. Deliverables

1. The cleaned repository (single native Android project, `functions/`, Cloud Run exam service, rules).
2. **Library table** covering EVERY dependency and native module: `Name | File(s) where used | Feature it powers | Test that proves it | Status (working / partially / blocked, with reason)`. No library may be missing from the table, and none may be removed.
3. `CHANGELOG-FIX.md`: deleted web files, renamed classes (old to new name and why), migrated modules, and anything left open.
4. Real logs: `assembleDebug`, `assembleRelease`, unit tests, instrumented tests, rules tests, benchmark results.
5. A list of what could NOT be verified and why.
6. README: Firebase setup, secrets, creating the first admin, building the signed APK.

Work phase by phase in this order: (1) structure cleanup, (2) auth + rules + functions, (3) DI/startup/data layer (Koin, Room+SQLCipher, Tink, Conscrypt), (4) native build and modules, (5) camera/QR/location, (6) exam stack (Realm, FlatBuffers, Protobuf, gRPC), (7) performance and tooling (Tracing, Baseline Profile, Chucker, LeakCanary), (8) CI and hardening. After each phase: build, test, show output, then continue.
