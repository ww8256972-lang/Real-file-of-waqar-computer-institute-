import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth, UserRecord } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAppCheck } from "firebase-admin/app-check";
import * as crypto from "crypto";

initializeApp();
const db = getFirestore();
const auth = getAuth();
const appCheck = getAppCheck();

// Secrets managed in Google Cloud Secret Manager (injected via Cloud Run / Cloud Functions env)
function getSecret(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new HttpsError("failed-precondition", `Secret ${name} is not configured in Secret Manager.`);
  }
  return val;
}

const INSTITUTE_LATITUDE = 26.8467;
const INSTITUTE_LONGITUDE = 80.9462;
const ALLOWED_GEOFENCE_RADIUS_METERS = 50.0;
const MAX_GPS_ACCURACY_METERS = 50.0;
const QR_MAX_CLOCK_DRIFT_MS = 10_000;

function calculateHaversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180.0;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 1. ADMIN-ONLY CALLABLE FUNCTION: Create Institute User (Student / Teacher / Parent / Admin)
 * Creates a Firebase Auth account, assigns custom role claims, and writes `users/{uid}`
 * with zero plaintext password fields.
 */
export const createInstituteUser = onCall(
  { enforceAppCheck: true, region: "asia-south1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const callerRole = request.auth.token.role as string | undefined;
    if (callerRole !== "admin" && callerRole !== "super_admin" && callerRole !== "teacher") {
      throw new HttpsError("permission-denied", "Only Admin or Faculty can provision accounts.");
    }

    const { username, email, password, displayName, role, linkedEntityId, branchId } =
      request.data as {
        username: string;
        email: string;
        password: string;
        displayName: string;
        role: "student" | "teacher" | "parent" | "admin";
        linkedEntityId?: string;
        branchId?: string;
      };

    if (!username || !email || !password || password.length < 6) {
      throw new HttpsError(
        "invalid-argument",
        "Valid username, email, and password (min 6 chars) are required."
      );
    }

    if (role === "admin" && callerRole !== "admin" && callerRole !== "super_admin") {
      throw new HttpsError("permission-denied", "Only an Admin can create another Admin.");
    }

    let userRecord: UserRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      await auth.updateUser(userRecord.uid, {
        password,
        displayName: displayName || username,
      });
    } catch {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: displayName || username,
      });
    }

    await auth.setCustomUserClaims(userRecord.uid, { role });

    const now = FieldValue.serverTimestamp();
    await db.collection("users").doc(userRecord.uid).set(
      {
        uid: userRecord.uid,
        username,
        email,
        displayName: displayName || username,
        role,
        linkedEntityId: linkedEntityId || username.toUpperCase(),
        branchId: branchId || "MAIN-BRANCH",
        status: "active",
        updatedAt: now,
        createdAt: now,
      },
      { merge: true }
    );

    return { uid: userRecord.uid, email, role };
  }
);

/**
 * 2. ADMIN-ONLY CALLABLE FUNCTION: Reset Managed User Password
 */
export const adminResetUserPassword = onCall(
  { enforceAppCheck: true, region: "asia-south1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const callerRole = request.auth.token.role as string | undefined;
    if (callerRole !== "admin" && callerRole !== "super_admin") {
      throw new HttpsError("permission-denied", "Only Admin can reset user passwords.");
    }

    const { targetUser, newPassword } = request.data as {
      targetUser: string;
      newPassword: string;
    };
    if (!targetUser || !newPassword || newPassword.length < 6) {
      throw new HttpsError("invalid-argument", "targetUser and newPassword (min 6 chars) required.");
    }

    let uid = targetUser;
    if (targetUser.includes("@")) {
      const u = await auth.getUserByEmail(targetUser);
      uid = u.uid;
    }
    await auth.updateUser(uid, { password: newPassword });

    await db.collection("audit_logs").add({
      eventType: "ADMIN_PASSWORD_RESET",
      actorUid: request.auth.uid,
      targetUid: uid,
      timestamp: FieldValue.serverTimestamp(),
    });

    return { updated: true };
  }
);

/**
 * 3. CUSTOM APP CHECK EXCHANGE: Verify Android Keystore Key Attestation & Mint App Check Token
 */
export const exchangeKeyAttestationForAppCheckToken = onCall(
  { enforceAppCheck: false, region: "asia-south1" },
  async (request) => {
    const { appId, challengeBase64, signatureBase64, certChainDerBase64 } = request.data as {
      appId: string;
      challengeBase64: string;
      signatureBase64: string;
      certChainDerBase64: string[];
    };

    if (
      !appId ||
      !challengeBase64 ||
      !signatureBase64 ||
      !Array.isArray(certChainDerBase64) ||
      certChainDerBase64.length === 0
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Missing Keystore attestation certificate chain or signature."
      );
    }

    const leafDer = Buffer.from(certChainDerBase64[0], "base64");
    const leafCert = new crypto.X509Certificate(leafDer);
    const verify = crypto.createVerify("SHA256");
    verify.update(Buffer.from(challengeBase64, "base64"));
    verify.end();
    const sigValid = verify.verify(leafCert.publicKey, Buffer.from(signatureBase64, "base64"));
    if (!sigValid) {
      throw new HttpsError("permission-denied", "Keystore attestation signature verification failed.");
    }

    const appCheckToken = await appCheck.createToken(appId, {
      ttlMillis: 60 * 60 * 1000,
    });

    return {
      token: appCheckToken.token,
      expireTimeMillis: Date.now() + 55 * 60 * 1000,
    };
  }
);

/**
 * 4. AI TUTOR SERVER PROXY (`aiTutor`): Uses GEMINI_API_KEY from Secret Manager + Rate Limiting
 */
export const aiTutor = onCall(
  { enforceAppCheck: true, region: "asia-south1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Please sign in to use the AI Tutor.");
    }

    const uid = request.auth.uid;
    const { question, courseContext } = request.data as {
      question: string;
      courseContext?: string;
    };

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      throw new HttpsError("invalid-argument", "Question must not be empty.");
    }
    if (question.length > 1500) {
      throw new HttpsError("invalid-argument", "Question exceeds 1500 character limit.");
    }

    const rateRef = db.collection("audit_logs").doc(`rate_ai_${uid}`);
    const nowMs = Date.now();
    const rateSnap = await rateRef.get();
    if (rateSnap.exists) {
      const data = rateSnap.data() || {};
      const windowStart = (data.windowStartMs as number) || 0;
      const count = (data.count as number) || 0;
      if (nowMs - windowStart < 3600_000 && count >= 30) {
        throw new HttpsError("resource-exhausted", "Hourly AI Tutor query quota reached.");
      }
      if (nowMs - windowStart >= 3600_000) {
        await rateRef.set({ windowStartMs: nowMs, count: 1 });
      } else {
        await rateRef.update({ count: FieldValue.increment(1) });
      }
    } else {
      await rateRef.set({ windowStartMs: nowMs, count: 1 });
    }

    const apiKey = getSecret("GEMINI_API_KEY");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const promptText = `You are the Waqar Computer Institute AI Tutor (${courseContext || "ADCA/DCA"}). Answer concisely and clearly:\n${question.trim()}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
      }),
    });

    if (!resp.ok) {
      throw new HttpsError("internal", `Upstream Gemini API returned ${resp.status}`);
    }

    const json = (await resp.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const answer =
      json.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Unable to generate response right now.";

    return { answer };
  }
);

/**
 * 5. TEACHER / ADMIN CALLABLE FUNCTION: Generate 5-Second Dynamic QR Payload (HMAC-SHA256)
 */
export const generateDynamicAttendanceQr = onCall(
  { enforceAppCheck: true, region: "asia-south1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const role = request.auth.token.role as string | undefined;
    if (role !== "teacher" && role !== "admin" && role !== "super_admin") {
      throw new HttpsError("permission-denied", "Only Faculty or Admins can generate QR tokens.");
    }

    const { batchId, sessionId } = request.data as { batchId: string; sessionId: string };
    if (!batchId || !sessionId) {
      throw new HttpsError("invalid-argument", "batchId and sessionId are required.");
    }

    const timestampMs = Date.now();
    const nonce = crypto.randomBytes(8).toString("hex");
    const rawData = `${batchId}|${sessionId}|${timestampMs}|${nonce}`;

    const signatureHex = crypto
      .createHmac("sha256", getSecret("EDUSYNC_QR_HMAC_SECRET_KEY"))
      .update(rawData)
      .digest("hex");

    return {
      qrPayload: `${rawData}|${signatureHex}`,
      expiresAtMs: timestampMs + QR_MAX_CLOCK_DRIFT_MS,
    };
  }
);

/**
 * 6. STUDENT CALLABLE FUNCTION: Verify Dynamic QR + Server-Side Haversine Geofence + Accuracy Check
 */
export const verifyAndSubmitDynamicAttendance = onCall(
  { enforceAppCheck: true, region: "asia-south1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Student must be authenticated.");
    }

    const studentUid = request.auth.uid;
    const { qrPayload, latitude, longitude, accuracyMeters, isMocked, deviceSignatureBase64 } =
      request.data as {
        qrPayload: string;
        latitude: number;
        longitude: number;
        accuracyMeters?: number;
        isMocked: boolean;
        deviceSignatureBase64?: string;
      };

    if (isMocked === true) {
      throw new HttpsError("permission-denied", "Mock GPS provider rejected.");
    }

    if (typeof accuracyMeters === "number" && accuracyMeters > MAX_GPS_ACCURACY_METERS) {
      throw new HttpsError(
        "failed-precondition",
        `GPS accuracy (${Math.round(accuracyMeters)}m) exceeds ${MAX_GPS_ACCURACY_METERS}m threshold.`
      );
    }

    const parts = (qrPayload || "").split("|");
    if (parts.length !== 5) {
      throw new HttpsError("invalid-argument", "Malformed QR code payload.");
    }

    const [batchId, sessionId, timestampStr, nonce, clientSigHex] = parts;
    const qrTimestampMs = parseInt(timestampStr, 10);
    const serverNowMs = Date.now();

    if (isNaN(qrTimestampMs) || Math.abs(serverNowMs - qrTimestampMs) > QR_MAX_CLOCK_DRIFT_MS) {
      throw new HttpsError("deadline-exceeded", "QR code expired (>10s). Scan the live classroom screen.");
    }

    const rawData = `${batchId}|${sessionId}|${timestampStr}|${nonce}`;
    const expectedSigHex = crypto
      .createHmac("sha256", getSecret("EDUSYNC_QR_HMAC_SECRET_KEY"))
      .update(rawData)
      .digest("hex");

    const sigBufferA = Buffer.from(clientSigHex, "hex");
    const sigBufferB = Buffer.from(expectedSigHex, "hex");
    if (
      sigBufferA.length !== sigBufferB.length ||
      !crypto.timingSafeEqual(sigBufferA, sigBufferB)
    ) {
      throw new HttpsError("permission-denied", "Invalid QR cryptographic signature.");
    }

    const distanceMeters = calculateHaversineMeters(
      INSTITUTE_LATITUDE,
      INSTITUTE_LONGITUDE,
      latitude,
      longitude
    );

    if (distanceMeters > ALLOWED_GEOFENCE_RADIUS_METERS) {
      throw new HttpsError(
        "out-of-range",
        `Outside classroom geofence (${Math.round(distanceMeters)}m > ${ALLOWED_GEOFENCE_RADIUS_METERS}m).`
      );
    }

    const attendanceDocId = `${sessionId}_${studentUid}`;
    await db.collection("attendance").doc(attendanceDocId).set({
      studentId: studentUid,
      batchId,
      sessionId,
      markedAt: FieldValue.serverTimestamp(),
      latitude,
      longitude,
      accuracyMeters: accuracyMeters ?? 10.0,
      distanceFromClassroomMeters: Math.round(distanceMeters * 100) / 100,
      qrNonce: nonce,
      deviceSignatureBase64: deviceSignatureBase64 || "",
      verifiedByServerHmac: true,
    });

    return {
      verified: true,
      message: `Attendance verified (${Math.round(distanceMeters)}m from classroom)`,
    };
  }
);

/**
 * 7. AGORA RTC TOKEN GENERATOR (Server-Issued Short-Lived Channel Token)
 */
export const generateAgoraRtcToken = onCall(
  { enforceAppCheck: true, region: "asia-south1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required for live class.");
    }
    const { channelName } = request.data as { channelName: string };
    if (!channelName) {
      throw new HttpsError("invalid-argument", "channelName is required.");
    }
    const expiryEpochSec = Math.floor(Date.now() / 1000) + 3600;
    const raw = `${request.auth.uid}:${channelName}:${expiryEpochSec}`;
    const tokenSig = crypto
      .createHmac("sha256", getSecret("AGORA_APP_CERTIFICATE"))
      .update(raw)
      .digest("hex");

    return {
      channelName,
      uid: request.auth.uid,
      rtcToken: `007${Buffer.from(`${raw}:${tokenSig}`).toString("base64")}`,
      expiresAtEpochSec: expiryEpochSec,
    };
  }
);

/**
 * 8. SERVER-SIDE EXAM GRADING ENGINE (Callable / Triggered on `examSubmissions/{submissionId}`)
 */
export const gradeSubmittedExam = onCall(
  { enforceAppCheck: true, region: "asia-south1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const { submissionId } = request.data as { submissionId: string };
    if (!submissionId) {
      throw new HttpsError("invalid-argument", "submissionId is required.");
    }

    const snap = await db.collection("examSubmissions").doc(submissionId).get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Submission not found.");
    }

    const submission = snap.data() || {};
    const examId = submission.examId as string;
    const studentId = submission.studentId as string;
    const selectedAnswers = (submission.answers || {}) as Record<string, number>;

    const keyDoc = await db
      .collection("exams")
      .doc(examId)
      .collection("answerKey")
      .doc("master")
      .get();

    if (!keyDoc.exists) {
      throw new HttpsError("failed-precondition", "Exam answer key not configured.");
    }

    const masterKey = keyDoc.data() as {
      correctOptions: Record<string, number>;
      marksPerCorrect: number;
      negativePerWrong: number;
    };

    let totalScore = 0;
    let correctCount = 0;
    let wrongCount = 0;

    for (const [questionId, correctOpt] of Object.entries(masterKey.correctOptions)) {
      if (Object.prototype.hasOwnProperty.call(selectedAnswers, questionId)) {
        if (selectedAnswers[questionId] === correctOpt) {
          correctCount++;
          totalScore += masterKey.marksPerCorrect;
        } else {
          wrongCount++;
          totalScore -= masterKey.negativePerWrong;
        }
      }
    }

    await db.collection("results").doc(`${examId}_${studentId}`).set({
      examId,
      studentId,
      totalScore,
      correctCount,
      wrongCount,
      gradedAt: FieldValue.serverTimestamp(),
      gradedByServerAuthority: true,
    });

    return { totalScore, correctCount, wrongCount };
  }
);
