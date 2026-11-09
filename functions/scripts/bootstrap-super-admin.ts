/**
 * One-Time Super-Admin Bootstrap Script (`functions/scripts/bootstrap-super-admin.ts`)
 * Run once by an operator with Admin SDK service account credentials:
 *   SUPER_ADMIN_EMAIL="admin@waqarinstitute.edu" \
 *   SUPER_ADMIN_PASSWORD="<strong-random-password>" \
 *   npx ts-node functions/scripts/bootstrap-super-admin.ts
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth, UserRecord } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();
const auth = getAuth();

async function bootstrapSuperAdmin(): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const displayName = process.env.SUPER_ADMIN_NAME || "Waqar Ahmed (Super Admin)";

  if (!email || !password || password.length < 12) {
    throw new Error(
      "Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD (min 12 chars) environment variables."
    );
  }

  let user: UserRecord;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password, displayName });
  } catch {
    user = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });
  }

  await auth.setCustomUserClaims(user.uid, { role: "admin" });

  const now = FieldValue.serverTimestamp();
  await db.collection("users").doc(user.uid).set(
    {
      uid: user.uid,
      email,
      username: email.split("@")[0],
      displayName,
      role: "admin",
      branchId: "MAIN-BRANCH",
      status: "active",
      updatedAt: now,
      createdAt: now,
    },
    { merge: true }
  );

  console.log(`Successfully provisioned Super Admin: uid=${user.uid}, email=${email}`);
}

bootstrapSuperAdmin().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
