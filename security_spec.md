# Waqar Computer Institute ERP (`com.waqarinstitute.erp`) — Production Security & Systems Specification

## 1. Honest Threat Model & Server-Authoritative Architecture
All authorization, authentication, attendance geofence calculation, and examination grading decisions are enforced server-side by **Firebase Authentication**, **Firestore Security Rules** (`firestore.rules`), **Storage Security Rules** (`storage.rules`), **Cloud Functions v2** (`functions/src/index.ts`), and **Cloud Run HTTP/2 gRPC** (`cloud-run-exam-stream/server.ts`). Client-side Android & C++20 NDK mechanisms provide defense-in-depth against local tampering, memory inspection, and screen capture.

### Key Architectural Guarantees
1. **Zero Plaintext Passwords or Static PINs**:
   - `FirebaseAuth.signInWithEmailAndPassword` handles all authentication.
   - `UserProfile` and `StudentEntity` contain zero `password` or `passwordHash` fields.
   - No hardcoded admin passwords (`waqar/waqar`), student passwords (`Rashid/student123`), or static hardware PINs (`8055`) exist anywhere in Kotlin, C++, or Gradle files.
2. **Hardware Keystore Attestation & Custom Firebase App Check**:
   - `HardwareSecurityModuleVault` generates an ECDSA P-256 key pair in StrongBox (with automatic TEE fallback) and signs a fresh server-issued challenge nonce.
   - `CustomKeystoreAppCheckProvider` exchanges the Android Keystore X.509 attestation certificate chain with the `exchangeKeyAttestationForAppCheckToken` Cloud Function to mint short-lived Firebase App Check tokens for sideloaded APK distribution.
3. **Server-Enforced Dynamic QR & Geofenced Attendance**:
   - `generateDynamicAttendanceQr` mints a 10-second HMAC-SHA256-signed QR token using `EDUSYNC_QR_HMAC_SECRET_KEY` from Google Cloud Secret Manager.
   - `MockLocationGuard.fetchFreshCoordinatesForServerVerification` obtains a fresh high-accuracy GPS fix (`Priority.PRIORITY_HIGH_ACCURACY`, 10s timeout, `accuracy <= 50m`) and rejects mock location providers.
   - `verifyAndSubmitDynamicAttendance` verifies the HMAC with `crypto.timingSafeEqual`, computes the Haversine distance on the server, and writes `attendance/{id}` via the Admin SDK.
4. **Zero-Answer-Key Exam Delivery & Server-Side Grading**:
   - Client exam bundles (`src/main/flatbuffers/exam_schema.fbs`) exclude `correct_option_index`.
   - `gradeSubmittedExam` grades `examSubmissions/{submissionId}` server-side against `exams/{examId}/answerKey/master` and writes `results/{resultId}`.
5. **Non-Crashing Native Tamper Detection & Zeroization**:
   - `AntiDebuggerGuard.cpp` monitors `/proc/self/status` (`TracerPid`), `/proc/self/maps` (Frida/Xposed artifacts), and `/proc/self/wchan`.
   - On detection, it sets an atomic tamper flag (`nativeIsTamperDetected()`), overwrites sensitive vault files with `0x00`, and allows the Kotlin UI (`TamperZeroizationManager`) to block exam/attendance actions cleanly without blind `SIGKILL` crashes.
6. **Hardware-Bound Device Fingerprinting (`DeviceFingerprint.cpp`)**:
   - Combines `/sys/devices/soc0/serial_number` (when readable), `ro.boot.vbmeta.digest`, `ro.build.fingerprint`, and `Settings.Secure.ANDROID_ID` with a server-issued challenge nonce via HMAC-SHA256 to produce a 32-byte (64-hex-char) device-binding tag.

---

## 2. Complete Library & Native C++20 Module Verification Table

See [`CHANGELOG-FIX.md`](./CHANGELOG-FIX.md) Section "Phase 3–7 — Complete Library & C++20 NDK Wiring Table" for the full 34-row mapping of every Gradle dependency and C++20 NDK module to its production call site and automated test.
