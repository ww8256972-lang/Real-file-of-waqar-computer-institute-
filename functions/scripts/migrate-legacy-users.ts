/**
 * One-Time Legacy User Migration Script (`functions/scripts/migrate-legacy-users.ts`)
 * Reads legacy `users` documents, creates corresponding FirebaseAuth accounts,
 * sets custom role claims, deletes plaintext `password`/`passwordHash` fields,
 * and deletes the legacy `admins` collection.
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth, UserRecord } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";

initializeApp();
const db = getFirestore();
const auth = getAuth();

async function migrateLegacyUsers(): Promise<void> {
  const usersSnap = await db.collection("users").get();

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const rawUsername = (data.username as string) || doc.id;
    const email =
      (data.email as string) ||
      `${rawUsername.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}@waqarinstitute.edu`;
    const role = (data.role as string) || "student";
    const tempPassword =
      typeof data.password === "string" && data.password.length >= 6
        ? data.password
        : crypto.randomBytes(12).toString("base64url");

    let userRecord: UserRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch {
      userRecord = await auth.createUser({
        uid: doc.id,
        email,
        password: tempPassword,
        displayName: (data.displayName as string) || rawUsername,
      });
    }

    await auth.setCustomUserClaims(userRecord.uid, { role });

    // Remove plaintext password / passwordHash fields from Firestore
    await doc.ref.update({
      uid: userRecord.uid,
      email,
      password: FieldValue.delete(),
      passwordHash: FieldValue.delete(),
      migratedToFirebaseAuthAt: FieldValue.serverTimestamp(),
    });
  }

  // Delete legacy `admins` collection
  const adminsSnap = await db.collection("admins").get();
  for (const adminDoc of adminsSnap.docs) {
    await adminDoc.ref.delete();
  }

  console.log(`Migrated ${usersSnap.size} users and deleted ${adminsSnap.size} legacy admin docs.`);
}

migrateLegacyUsers().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
