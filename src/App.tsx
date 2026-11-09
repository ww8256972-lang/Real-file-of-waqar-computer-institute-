import React, { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  BatchDoc,
  BranchDoc,
  computeSaltedSha256Hex,
  CourseDoc,
  ErpRecordDoc,
  generateSaltHex,
  sanitizeId,
  sanitizeText,
  UserProfileDoc,
  UserRole,
} from './types/erp';
import { Waqar3DLoginPortal } from './components/Waqar3DLoginPortal';
import { RolePortals } from './components/RolePortals';
import { AdminErpPanel } from './components/AdminErpPanel';
import { WaterfallAnimation } from './components/WaterfallAnimation';

const SESSION_STORAGE_KEY = 'waqar_erp_cloud_uid';
const PRIMARY_ADMIN_DOC_ID = 'admin_primary';

function normalizeToInstituteEmail(usernameOrEmail: string): string {
  const trimmed = usernameOrEmail.trim().toLowerCase();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  return `${sanitizeId(trimmed, 64)}@waqarinstitute.edu`;
}

function normalizeForFirebaseAuthPassword(rawPassword: string): string {
  const trimmed = rawPassword.trim();
  return trimmed.length >= 6 ? trimmed : `${trimmed}#WI2026`;
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<UserProfileDoc | null>(null);
  const [activeView, setActiveView] = useState<'student' | 'teacher' | 'parent' | 'admin'>('student');

  // Real-time Firestore Collections
  const [branches, setBranches] = useState<BranchDoc[]>([]);
  const [courses, setCourses] = useState<CourseDoc[]>([]);
  const [batches, setBatches] = useState<BatchDoc[]>([]);
  const [erpRecords, setErpRecords] = useState<ErpRecordDoc[]>([]);
  const [cloudUsers, setCloudUsers] = useState<UserProfileDoc[]>([]);

  /**
   * Ensures the initial Admin (`waqar` / `waqar`) is stored in Cloud Firestore
   * (`admins/admin_primary` & `users/waqar`) ONLY if no Admin document exists yet.
   * Never overwrites `admins/admin_primary` once created, so any Admin username or password
   * change made inside the Admin Portal stays permanently saved in Cloud Sync!
   */
  const ensureDefaultAdminSyncedInCloud = async () => {
    try {
      const adminRef = doc(db, 'admins', PRIMARY_ADMIN_DOC_ID);
      const snap = await getDoc(adminRef);
      if (!snap.exists()) {
        const initialUser = 'waqar';
        const initialPass = 'waqar';
        const initialEmail = normalizeToInstituteEmail(initialUser);
        const saltHex = generateSaltHex();
        const verifierHash = await computeSaltedSha256Hex(initialPass, saltHex);

        const payload = {
          uid: initialUser,
          username: initialUser,
          email: initialEmail,
          displayName: 'Waqar Ahmed (Director)',
          role: 'admin' as UserRole,
          linkedEntityId: 'WI-ADMIN-WAQAR',
          branchId: 'MAIN-BRANCH',
          status: 'active' as const,
          passwordSalt: saltHex,
          passwordVerifierHash: verifierHash,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await setDoc(adminRef, payload);
        await setDoc(doc(db, 'users', initialUser), payload);
      }

      const branchRef = doc(db, 'branches', 'MAIN-BRANCH');
      const branchSnap = await getDoc(branchRef);
      if (!branchSnap.exists()) {
        await setDoc(branchRef, {
          code: 'MAIN-BRANCH',
          name: 'WAQAR COMPUTER INSTITUTE - Main Campus',
          address: 'Main Academic Block',
          phone: '+91-9876543210',
          email: 'info@waqarinstitute.edu',
          managerName: 'Waqar Ahmed',
          status: 'active',
          ownerUid: 'waqar',
          visibility: 'institute',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Will retry when online
    }
  };

  useEffect(() => {
    ensureDefaultAdminSyncedInCloud();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      try {
        const savedUid = localStorage.getItem(SESSION_STORAGE_KEY);
        if (savedUid) {
          const savedSnap = await getDoc(doc(db, 'users', savedUid));
          if (savedSnap.exists()) {
            const data = savedSnap.data() as UserProfileDoc;
            setUserProfile(data);
            setActiveView(
              data.role === 'admin' || data.role === 'accountant' || data.role === 'receptionist'
                ? 'admin'
                : data.role
            );
            setAuthReady(true);
            return;
          }
        }
      } catch {
        // Ignore transient offline check
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Attach Real-Time Firestore Listeners when Authenticated
  useEffect(() => {
    const activeUid = firebaseUser?.uid || userProfile?.uid;
    if (!authReady || !activeUid) return;

    const unsubBranches = onSnapshot(
      collection(db, 'branches'),
      (snap) => {
        setBranches(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<BranchDoc, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'branches')
    );

    const unsubCourses = onSnapshot(
      collection(db, 'courses'),
      (snap) => {
        setCourses(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CourseDoc, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'courses')
    );

    const unsubBatches = onSnapshot(
      collection(db, 'batches'),
      (snap) => {
        setBatches(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<BatchDoc, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'batches')
    );

    const unsubErp = onSnapshot(
      collection(db, 'erpRecords'),
      (snap) => {
        setErpRecords(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ErpRecordDoc, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'erpRecords')
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setCloudUsers(
          snap.docs.map((d) => ({
            ...(d.data() as UserProfileDoc),
            uid: d.id,
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    return () => {
      unsubBranches();
      unsubCourses();
      unsubBatches();
      unsubErp();
      unsubUsers();
    };
  }, [authReady, firebaseUser, userProfile?.uid]);

  /**
   * Authenticates Admin, Student, Teacher, and Parent accounts strictly against the
   * live Cloud-Synced Firestore documents (`admins/admin_primary` and `users/{uid}`)
   * and synchronizes the Firebase Authentication session.
   */
  const handleAuthenticateWithCredentials = async (
    usernameInput: string,
    passwordInput: string,
    selectedPortal?: 'student' | 'teacher' | 'parent' | 'admin'
  ) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const trimmedUser = usernameInput.trim();
      const trimmedPass = passwordInput.trim();
      if (!trimmedUser || !trimmedPass) {
        throw new Error('Please enter both Username/ID and Password.');
      }

      await ensureDefaultAdminSyncedInCloud();

      const portal = selectedPortal || 'admin';
      const cleanUserKey = sanitizeId(trimmedUser.toLowerCase(), 64);
      const email = normalizeToInstituteEmail(trimmedUser);
      const firebaseAuthPass = normalizeForFirebaseAuthPassword(trimmedPass);

      // 1. Admin Portal Authentication via Cloud-Synced `admins/admin_primary`
      if (portal === 'admin') {
        const adminSnap = await getDoc(doc(db, 'admins', PRIMARY_ADMIN_DOC_ID));
        if (adminSnap.exists()) {
          const adminData = adminSnap.data() as UserProfileDoc;
          const cloudUsername = (adminData.username || 'waqar').trim();
          const cloudSalt = adminData.passwordSalt || '';
          const cloudVerifier = adminData.passwordVerifierHash || '';

          const usernameMatches =
            cloudUsername.toLowerCase() === trimmedUser.toLowerCase() ||
            (adminData.email || '').toLowerCase() === trimmedUser.toLowerCase();

          if (!usernameMatches) {
            throw new Error(
              'Invalid Admin Username. Please enter the current Cloud-Synced Admin Username.'
            );
          }

          if (cloudSalt && cloudVerifier) {
            const candidateHash = await computeSaltedSha256Hex(trimmedPass, cloudSalt);
            if (candidateHash.toLowerCase() !== cloudVerifier.toLowerCase()) {
              throw new Error(
                'Invalid Admin Password. Please enter the current Cloud-Synced Admin Password.'
              );
            }
          }

          // Synchronize Firebase Authentication session in background
          try {
            await signInWithEmailAndPassword(auth, adminData.email || email, firebaseAuthPass);
          } catch {
            try {
              await createUserWithEmailAndPassword(auth, adminData.email || email, firebaseAuthPass);
            } catch {
              // Proceed with verified Cloud Sync session
            }
          }

          const verifiedAdmin: UserProfileDoc = {
            uid: adminData.uid || cleanUserKey,
            email: adminData.email || email,
            displayName: adminData.displayName || 'Waqar Ahmed (Director)',
            username: cloudUsername,
            role: 'admin',
            linkedEntityId: adminData.linkedEntityId || 'WI-ADMIN-WAQAR',
            branchId: adminData.branchId || 'MAIN-BRANCH',
            status: 'active',
          };

          setUserProfile(verifiedAdmin);
          localStorage.setItem(SESSION_STORAGE_KEY, verifiedAdmin.uid);
          setActiveView('admin');
          return;
        }
      }

      // 2. Student / Teacher / Parent / Secondary User lookup in `users` collection
      let userSnap = await getDoc(doc(db, 'users', cleanUserKey));
      if (!userSnap.exists()) {
        const qSnap = await getDocs(
          query(collection(db, 'users'), where('username', '==', trimmedUser), limit(1))
        );
        if (!qSnap.empty) {
          userSnap = qSnap.docs[0];
        }
      }

      if (!userSnap.exists()) {
        throw new Error(
          `Access Denied: Account "${trimmedUser}" not found in Cloud Sync. Please create the ID in the Admin Credential Vault first.`
        );
      }

      const userData = userSnap.data() as UserProfileDoc;
      if (portal !== 'admin' && userData.role !== 'admin' && userData.role !== portal) {
        throw new Error(
          `Access Denied: Account "${userData.username}" belongs to the ${userData.role.toUpperCase()} portal, not ${portal.toUpperCase()}.`
        );
      }

      if (userData.passwordSalt && userData.passwordVerifierHash) {
        const candidateHash = await computeSaltedSha256Hex(trimmedPass, userData.passwordSalt);
        if (candidateHash.toLowerCase() !== userData.passwordVerifierHash.toLowerCase()) {
          throw new Error('Incorrect password. Please enter the exact password synced in Cloud.');
        }
      }

      try {
        await signInWithEmailAndPassword(auth, userData.email || email, firebaseAuthPass);
      } catch {
        // Proceed with verified Firestore credential
      }

      const verifiedProfile: UserProfileDoc = {
        ...userData,
        uid: userData.uid || userSnap.id,
      };
      setUserProfile(verifiedProfile);
      localStorage.setItem(SESSION_STORAGE_KEY, verifiedProfile.uid);
      setActiveView(
        verifiedProfile.role === 'admin' ||
          verifiedProfile.role === 'accountant' ||
          verifiedProfile.role === 'receptionist'
          ? 'admin'
          : verifiedProfile.role
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  /**
   * Updates Admin Username and Password in Cloud Firestore (`admins/admin_primary` & `users`)
   * and Firebase Authentication so the updated credentials work across all devices!
   */
  const handleUpdateAdminCloudSyncCredentials = async (
    newUsernameInput: string,
    newPasswordInput: string
  ) => {
    const cleanNewUsername = sanitizeId(newUsernameInput.trim() || 'waqar', 64);
    const cleanNewPassword = newPasswordInput.trim();
    if (!cleanNewPassword) {
      throw new Error('New password is required.');
    }

    const newEmail = normalizeToInstituteEmail(cleanNewUsername);
    const newSalt = generateSaltHex();
    const newVerifierHash = await computeSaltedSha256Hex(cleanNewPassword, newSalt);
    const cleanUid = sanitizeId(cleanNewUsername.toLowerCase(), 64);

    if (auth.currentUser) {
      try {
        await updatePassword(auth.currentUser, normalizeForFirebaseAuthPassword(cleanNewPassword));
      } catch {
        // Ignore if re-auth required
      }
    }

    const updatedAdminDoc: UserProfileDoc = {
      uid: cleanUid,
      username: cleanNewUsername,
      email: newEmail,
      displayName: userProfile?.displayName || 'Waqar Ahmed (Director)',
      role: 'admin',
      linkedEntityId: userProfile?.linkedEntityId || 'WI-ADMIN-WAQAR',
      branchId: userProfile?.branchId || 'MAIN-BRANCH',
      status: 'active',
      passwordSalt: newSalt,
      passwordVerifierHash: newVerifierHash,
    };

    await setDoc(
      doc(db, 'admins', PRIMARY_ADMIN_DOC_ID),
      {
        ...updatedAdminDoc,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await setDoc(
      doc(db, 'users', cleanUid),
      {
        ...updatedAdminDoc,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setUserProfile(updatedAdminDoc);
    localStorage.setItem(SESSION_STORAGE_KEY, updatedAdminDoc.uid);
  };

  const handleSendPasswordResetEmail = async (usernameOrEmail: string): Promise<string> => {
    const email = normalizeToInstituteEmail(usernameOrEmail);
    await sendPasswordResetEmail(auth, email);
    return `Password reset link sent to ${email} via Firebase Authentication.`;
  };

  const handleSaveCloudCredential = async (payload: {
    username: string;
    password: string;
    displayName: string;
    role: UserRole;
    branchId?: string;
    linkedEntityId?: string;
  }) => {
    if (payload.role === 'admin') {
      await handleUpdateAdminCloudSyncCredentials(payload.username, payload.password);
      return;
    }

    const cleanUid = sanitizeId(payload.username.trim().toLowerCase(), 64);
    const cleanUsername = sanitizeId(payload.username.trim(), 64);
    const email = normalizeToInstituteEmail(cleanUsername);
    const saltHex = generateSaltHex();
    const verifierHash = await computeSaltedSha256Hex(payload.password.trim(), saltHex);

    await setDoc(
      doc(db, 'users', cleanUid),
      {
        uid: cleanUid,
        email,
        displayName: sanitizeText(payload.displayName, 100, cleanUsername),
        username: cleanUsername,
        role: payload.role,
        linkedEntityId: payload.linkedEntityId || cleanUsername.toUpperCase(),
        branchId: payload.branchId || 'MAIN-BRANCH',
        status: 'active',
        passwordSalt: saltHex,
        passwordVerifierHash: verifierHash,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleLinkStudentToParent = async (studentUsername: string, parentUsername: string) => {
    const cleanStuUid = sanitizeId(studentUsername.trim().toLowerCase(), 64);
    const cleanParUid = sanitizeId(parentUsername.trim().toLowerCase(), 64);
    const cleanStuCode = sanitizeId(studentUsername.trim(), 64);
    const cleanParCode = sanitizeId(parentUsername.trim(), 64);

    await setDoc(
      doc(db, 'users', cleanParUid),
      { linkedEntityId: cleanStuCode, updatedAt: serverTimestamp() },
      { merge: true }
    );
    await setDoc(
      doc(db, 'users', cleanStuUid),
      { linkedEntityId: cleanParCode, updatedAt: serverTimestamp() },
      { merge: true }
    );
  };

  const handleCreateBranch = async (
    payload: Omit<BranchDoc, 'id' | 'ownerUid' | 'visibility' | 'createdAt' | 'updatedAt'>
  ) => {
    const branchId = sanitizeId(payload.code || `BR-${Date.now()}`, 40);
    await setDoc(doc(db, 'branches', branchId), {
      ...payload,
      code: branchId,
      ownerUid: userProfile?.uid || 'waqar',
      visibility: 'institute',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const handleDeleteBranch = async (id: string) => {
    await deleteDoc(doc(db, 'branches', id));
  };

  const handleCreateCourse = async (
    payload: Omit<CourseDoc, 'id' | 'ownerUid' | 'visibility' | 'createdAt' | 'updatedAt'>
  ) => {
    const courseId = sanitizeId(payload.code || `CRS-${Date.now()}`, 40);
    await setDoc(doc(db, 'courses', courseId), {
      ...payload,
      code: courseId,
      ownerUid: userProfile?.uid || 'waqar',
      visibility: 'institute',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const handleDeleteCourse = async (id: string) => {
    await deleteDoc(doc(db, 'courses', id));
  };

  const handleCreateBatch = async (
    payload: Omit<BatchDoc, 'id' | 'ownerUid' | 'visibility' | 'createdAt' | 'updatedAt'>
  ) => {
    const batchId = sanitizeId(payload.code || `BAT-${Date.now()}`, 40);
    await setDoc(doc(db, 'batches', batchId), {
      ...payload,
      code: batchId,
      ownerUid: userProfile?.uid || 'waqar',
      visibility: 'institute',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const handleDeleteBatch = async (id: string) => {
    await deleteDoc(doc(db, 'batches', id));
  };

  const handleCreateErpRecord = async (
    payload: Omit<ErpRecordDoc, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
  ) => {
    const recordId = sanitizeId(payload.code || `${payload.module}-${Date.now()}`, 64);
    await setDoc(doc(db, 'erpRecords', recordId), {
      ...payload,
      ownerUid: userProfile?.uid || 'waqar',
      visibility: payload.visibility || 'institute',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const handleUpdateErpRecordStatus = async (id: string, newStatus: string) => {
    await updateDoc(doc(db, 'erpRecords', id), {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
  };

  const handleDeleteErpRecord = async (id: string) => {
    await deleteDoc(doc(db, 'erpRecords', id));
  };

  const handleUpdateUserProfile = async (updates: Partial<UserProfileDoc>) => {
    if (!userProfile) return;
    const next = { ...userProfile, ...updates };
    await setDoc(
      doc(db, 'users', userProfile.uid),
      { ...updates, updatedAt: serverTimestamp() },
      { merge: true }
    );
    setUserProfile(next);
  };

  const handleLogout = async () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setUserProfile(null);
    await signOut(auth).catch(() => {});
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#040D33] via-[#0A2170] to-[#0077B6] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <WaterfallAnimation fullScreen={true} />
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-28 h-28 rounded-3xl bg-white p-2.5 shadow-2xl border-2 border-cyan-200 mb-4 flex items-center justify-center">
            <img
              src="/waqar_logo.png"
              alt="Waqar Computer Institute Official Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="w-10 h-10 rounded-full border-4 border-cyan-300/30 border-t-cyan-300 animate-spin mb-3" />
          <p className="font-extrabold text-xl tracking-wider text-white">
            Welcome to Waqar Computer Institute
          </p>
          <p className="text-xs text-cyan-200 font-semibold mt-1">Connecting to Cloud Sync...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#05060f]">
      {!userProfile ? (
        <Waqar3DLoginPortal
          onAuthenticateWithCredentials={handleAuthenticateWithCredentials}
          onSendPasswordResetEmail={handleSendPasswordResetEmail}
          authLoading={authLoading}
          authError={authError}
        />
      ) : (
        <main className="flex-1">
          {activeView === 'admin' && userProfile.role === 'admin' ? (
            <AdminErpPanel
              userProfile={userProfile}
              branches={branches}
              courses={courses}
              batches={batches}
              erpRecords={erpRecords}
              cloudUsers={cloudUsers}
              onCreateBranch={handleCreateBranch}
              onDeleteBranch={handleDeleteBranch}
              onCreateCourse={handleCreateCourse}
              onDeleteCourse={handleDeleteCourse}
              onCreateBatch={handleCreateBatch}
              onDeleteBatch={handleDeleteBatch}
              onCreateErpRecord={handleCreateErpRecord}
              onUpdateErpRecordStatus={handleUpdateErpRecordStatus}
              onDeleteErpRecord={handleDeleteErpRecord}
              onSaveCloudCredential={handleSaveCloudCredential}
              onUpdateAdminCloudSyncCredentials={handleUpdateAdminCloudSyncCredentials}
              onLinkStudentToParent={handleLinkStudentToParent}
              onLogout={handleLogout}
            />
          ) : (
            <RolePortals
              activePortal={
                userProfile.role === 'teacher'
                  ? 'teacher'
                  : userProfile.role === 'parent'
                  ? 'parent'
                  : 'student'
              }
              userProfile={userProfile}
              branches={branches}
              courses={courses}
              batches={batches}
              erpRecords={erpRecords}
              onCreateErpRecord={handleCreateErpRecord}
              onUpdateErpRecordStatus={handleUpdateErpRecordStatus}
              onUpdateUserProfile={handleUpdateUserProfile}
              onSaveCloudCredential={handleSaveCloudCredential}
              onLinkStudentToParent={handleLinkStudentToParent}
              onLogout={handleLogout}
            />
          )}
        </main>
      )}
    </div>
  );
}
