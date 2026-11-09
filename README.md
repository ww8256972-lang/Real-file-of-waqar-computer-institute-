# Waqar Computer Institute ERP (`com.waqarinstitute.erp`)

100% Native Jetpack Compose (Kotlin + C++20 NDK) Enterprise Institute & Examination ERP for **Waqar Computer Institute**, backed by Firebase Authentication, Cloud Firestore, Cloud Storage, Cloud Functions v2, and Cloud Run HTTP/2 gRPC.

---

## 1. Project Architecture & Unified Layout
- **Application ID & Namespace**: `com.waqarinstitute.erp`
- **Target / Compile SDK**: Android 15 (`compileSdk = 35`, `targetSdk = 35`, `minSdk = 26`)
- **Primary Android Source Tree**: `app/` (synchronized with `android-kotlin/app/`)
  - `app/src/main/java/com/waqarinstitute/erp/` — Unified Kotlin Compose UI, Firebase repository, Room/SQLCipher local storage, Retrofit API client, WorkManager workers, ZXing QR generator, and Enterprise Security Suite.
  - `app/src/main/cpp/` — 9 C++20 NDK modules (`CMakeLists.txt`) compiled into `libedusync_native_security.so`.
  - `app/src/main/flatbuffers/exam_schema.fbs` — Zero-copy FlatBuffers exam schema (without answer keys on the client).
  - `app/src/main/proto/edusync_exam_stream.proto` — Protobuf & gRPC-Kotlin exam submission schema.
- **Firebase & Cloud Run Backend**:
  - `firestore.rules` & `firestore.rules.test.ts` — Default-deny Firestore security rules and `@firebase/rules-unit-testing` suite.
  - `storage.rules` — Authenticated Cloud Storage rules with size & MIME enforcement.
  - `functions/src/index.ts` — Cloud Functions v2 (`createInstituteUser`, `adminResetUserPassword`, `exchangeKeyAttestationForAppCheckToken`, `aiTutor`, `generateDynamicAttendanceQr`, `verifyAndSubmitDynamicAttendance`, `generateAgoraRtcToken`, `gradeSubmittedExam`).
  - `cloud-run-exam-stream/server.ts` — Cloud Run HTTP/2 gRPC server for real-time exam answer streaming.

---

## 2. Building & Testing Locally

### Run Unit Tests & Assemble Debug APK
```bash
cd android-kotlin
./gradlew testDebugUnitTest assembleDebug
```

### Assemble R8-Minified Signed Release APK
Provide a valid release keystore via environment variables (release builds refuse to fall back to the debug keystore):
```bash
export KEYSTORE_FILE=/path/to/waqar-release.jks
export KEYSTORE_PASSWORD="your-keystore-password"
export KEY_ALIAS="your-key-alias"
export KEY_PASSWORD="your-key-password"
cd android-kotlin
./gradlew assembleRelease
```

### Run Firestore Security Rules Unit Tests
```bash
npx firebase emulators:exec --only firestore "npx jest firestore.rules.test.ts"
```

---

## 3. Provisioning the First Super-Admin & Migrating Legacy Users

No default passwords (`waqar/waqar` or `student123`) are shipped in the APK.
1. **Bootstrap the First Super-Admin**:
   ```bash
   SUPER_ADMIN_EMAIL="admin@waqarinstitute.edu" \
   SUPER_ADMIN_PASSWORD="<strong-12+-char-password>" \
   npx ts-node functions/scripts/bootstrap-super-admin.ts
   ```
2. **Migrate Legacy Firestore Users to Firebase Authentication**:
   ```bash
   npx ts-node functions/scripts/migrate-legacy-users.ts
   ```

---

## 4. GitHub Actions CI/CD (`HTTP 504` Gradle 8.9 Fix)
Both `.github/workflows/android.yml` and `.github/workflows/build-apk.yml` use a multi-mirror `curl --retry 8 --retry-all-errors` downloader (`downloads.gradle-dn.com`, `services.gradle.org`, `repo.huaweicloud.com`) with `actions/cache@v4` so transient `504 Gateway Timeout` errors from `services.gradle.org` never break CI builds.
