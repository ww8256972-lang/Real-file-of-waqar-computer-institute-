import React, { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
  CourseDoc,
  ErpRecordDoc,
  sanitizeId,
  sanitizeText,
  UserProfileDoc,
  UserRole,
} from './types/erp';
import { Waqar3DLoginPortal } from './components/Waqar3DLoginPortal';
import { AndroidDeviceFrame } from './components/AndroidDeviceFrame';
import { RolePortals } from './components/RolePortals';
import { AdminErpPanel } from './components/AdminErpPanel';
import { KotlinCiModal } from './components/KotlinCiModal';
import { WaterfallAnimation } from './components/WaterfallAnimation';

const SESSION_STORAGE_KEY = 'waqar_erp_cloud_uid';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<UserProfileDoc | null>(null);
  const [activeView, setActiveView] = useState<'student' | 'teacher' | 'parent' | 'admin'>('student');
  const [kotlinModalOpen, setKotlinModalOpen] = useState(false);

  // Real-time Firestore Collections (Zero Fake Data)
  const [branches, setBranches] = useState<BranchDoc[]>([]);
  const [courses, setCourses] = useState<CourseDoc[]>([]);
  const [batches, setBatches] = useState<BatchDoc[]>([]);
  const [erpRecords, setErpRecords] = useState<ErpRecordDoc[]>([]);

  // Ensure default Admin ("Waqar" / "waqar") and core Institute tables are always saved in Firebase Cloud Firestore
  useEffect(() => {
    async function ensureWaqarAdminAndCoreTablesInCloud() {
      try {
        const waqarRef = doc(db, 'users', 'waqar');
        const snap = await getDoc(waqarRef);
        if (!snap.exists()) {
          await setDoc(doc(db, 'admins', 'waqar'), {
            uid: 'waqar',
            username: 'Waqar',
            password: 'waqar',
            role: 'admin',
            email: 'waqar@waqarinstitute.edu',
            updatedAt: serverTimestamp(),
          });
          await setDoc(waqarRef, {
            uid: 'waqar',
            email: 'waqar@waqarinstitute.edu',
            displayName: 'Waqar Ahmed (Administrator)',
            username: 'Waqar',
            password: 'waqar',
            role: 'admin',
            linkedEntityId: 'WI-ADMIN-WAQAR',
            branchId: 'MAIN-BRANCH',
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        // Ensure Main Branch exists in Firestore
        const branchRef = doc(db, 'branches', 'MAIN-BRANCH');
        const branchSnap = await getDoc(branchRef);
        if (!branchSnap.exists()) {
          await setDoc(branchRef, {
            code: 'MAIN-BRANCH',
            name: 'WAQAR INSTITUTE - Main Campus',
            address: 'Main Campus Road',
            phone: '+91-9800000000',
            email: 'info@waqarinstitute.edu',
            managerName: 'Waqar Ahmed',
            status: 'active',
            ownerUid: 'waqar',
            visibility: 'institute',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        // Remove any legacy auto-seeded default courses so ONLY Admin-created courses appear
        for (const legacyId of ['ADCA', 'DCA', 'TALLY-PRIME', 'MS-OFFICE']) {
          deleteDoc(doc(db, 'courses', legacyId)).catch(() => {});
        }

        // Ensure default Batch A1 exists in Firestore
        const batchRef = doc(db, 'batches', 'ADCA-A1');
        const batchSnap = await getDoc(batchRef);
        if (!batchSnap.exists()) {
          await setDoc(batchRef, {
            code: 'ADCA-A1',
            name: 'Batch A1',
            courseId: 'ADCA',
            courseName: 'ADCA',
            teacherId: 'WI-TCH-120',
            teacherName: 'Mr. Waqar Ahmed',
            branchId: 'MAIN-BRANCH',
            timing: '10:00 AM - 11:00 AM',
            capacity: 30,
            startDate: new Date().toISOString().split('T')[0],
            status: 'active',
            ownerUid: 'waqar',
            visibility: 'institute',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        // Cloud bootstrap will retry when session is active
      }
    }
    ensureWaqarAdminAndCoreTablesInCloud();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      try {
        if (user) {
          const userRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data() as UserProfileDoc;
            setUserProfile(data);
            localStorage.setItem(SESSION_STORAGE_KEY, data.uid);
            setActiveView(
              data.role === 'admin' || data.role === 'accountant' || data.role === 'receptionist'
                ? 'admin'
                : data.role
            );
            setAuthReady(true);
            return;
          }
        }

        // Check if there is a persisted Firestore Cloud session
        const savedUid = localStorage.getItem(SESSION_STORAGE_KEY);
        if (savedUid) {
          const savedRef = doc(db, 'users', savedUid);
          const savedSnap = await getDoc(savedRef);
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
          } else {
            localStorage.removeItem(SESSION_STORAGE_KEY);
          }
        }

        setUserProfile(null);
        setBranches([]);
        setCourses([]);
        setBatches([]);
        setErpRecords([]);
      } catch {
        // Ignore transient offline check during initial boot
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

    const branchesQuery = query(
      collection(db, 'branches'),
      where('visibility', '==', 'institute')
    );
    const unsubBranches = onSnapshot(
      branchesQuery,
      (snap) => {
        const list: BranchDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<BranchDoc, 'id'>),
        }));
        setBranches(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'branches')
    );

    const coursesQuery = query(
      collection(db, 'courses'),
      where('visibility', '==', 'institute')
    );
    const unsubCourses = onSnapshot(
      coursesQuery,
      (snap) => {
        const legacyDefaults = new Set(['ADCA', 'DCA', 'TALLY-PRIME', 'MS-OFFICE']);
        const list: CourseDoc[] = snap.docs
          .filter((d) => !legacyDefaults.has(d.id))
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CourseDoc, 'id'>),
          }));
        setCourses(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'courses')
    );

    const batchesQuery = query(
      collection(db, 'batches'),
      where('visibility', '==', 'institute')
    );
    const unsubBatches = onSnapshot(
      batchesQuery,
      (snap) => {
        const list: BatchDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<BatchDoc, 'id'>),
        }));
        setBatches(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'batches')
    );

    const erpQuery = query(
      collection(db, 'erpRecords'),
      where('visibility', '==', 'institute')
    );
    const unsubErp = onSnapshot(
      erpQuery,
      (snap) => {
        const list: ErpRecordDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ErpRecordDoc, 'id'>),
        }));
        setErpRecords(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'erpRecords')
    );

    return () => {
      unsubBranches();
      unsubCourses();
      unsubBatches();
      unsubErp();
    };
  }, [authReady, firebaseUser, userProfile?.uid]);

  const handleAuthenticateWithCredentials = async (
    usernameInput: string,
    passwordInput: string,
    selectedPortal?: 'student' | 'teacher' | 'parent' | 'admin'
  ) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const trimmedUsername = usernameInput.trim();
      const trimmedPassword = passwordInput.trim();
      const cleanUser = sanitizeId(trimmedUsername.toLowerCase(), 64);
      const upperUser = sanitizeId(trimmedUsername.toUpperCase(), 64);
      const email = `${cleanUser}@waqarinstitute.edu`;
      const firebaseAuthPassword =
        trimmedPassword.length < 6 ? `${trimmedPassword}#WI2026` : trimmedPassword;

      // Check Firestore Cloud `users` collection first (both lowercase and uppercase keys)
      const userRef = doc(db, 'users', cleanUser);
      let existingSnap = await getDoc(userRef);
      if (!existingSnap.exists() && upperUser !== cleanUser) {
        const upperSnap = await getDoc(doc(db, 'users', upperUser));
        if (upperSnap.exists()) {
          existingSnap = upperSnap;
        }
      }

      // Master Admin ("Waqar" / "waqar") bootstrap check
      const isMasterWaqar = cleanUser === 'waqar';
      if (isMasterWaqar) {
        if (trimmedPassword.toLowerCase() !== 'waqar') {
          throw new Error('Invalid Admin password for Waqar. Please enter the correct admin password.');
        }
      }

      if (existingSnap.exists()) {
        const existingData = existingSnap.data() as UserProfileDoc;
        const storedPassword = existingData.password || 'waqar';

        const passwordMatches =
          storedPassword === trimmedPassword ||
          (cleanUser === 'waqar' && trimmedPassword.toLowerCase() === storedPassword.toLowerCase());

        if (!passwordMatches) {
          throw new Error('Incorrect password. Please enter the exact password created by the Administrator.');
        }

        // Strict Role Portal Security: Student, Teacher, and Parent can only log into their assigned portal
        if (
          selectedPortal &&
          selectedPortal !== 'admin' &&
          existingData.role !== 'admin' &&
          existingData.role !== selectedPortal
        ) {
          throw new Error(
            `Access Denied: Account "${existingData.username}" is registered as ${existingData.role.toUpperCase()}, not ${selectedPortal.toUpperCase()}.`
          );
        }

        if (selectedPortal === 'admin' && existingData.role !== 'admin') {
          throw new Error('Access Denied: Only Administrator accounts can access the Admin Portal.');
        }

        setUserProfile(existingData);
        localStorage.setItem(SESSION_STORAGE_KEY, existingData.uid);
        if (selectedPortal && (existingData.role === 'admin' || existingData.role === selectedPortal)) {
          setActiveView(selectedPortal);
        } else if (
          existingData.role === 'admin' ||
          existingData.role === 'accountant' ||
          existingData.role === 'receptionist'
        ) {
          setActiveView('admin');
        } else {
          setActiveView(existingData.role);
        }
        return;
      }

      // STRICT SECURITY FOR STUDENT, TEACHER, AND PARENT PORTALS:
      // If the account does NOT exist in Firestore `users` and is not Master Admin `Waqar`, block login!
      if (!isMasterWaqar) {
        throw new Error(
          'Access Denied: Only Username & Password created by the Admin in the Admin Portal can log in. Please ask the Admin to create your ID & Password.'
        );
      }

      // Master Admin `Waqar` fallback creation if Firestore was empty
      const authUid = 'waqar';

      const newProfile: UserProfileDoc = {
        uid: 'waqar',
        email: sanitizeText(email, 120, email),
        displayName: 'Waqar Ahmed (Administrator)',
        username: 'Waqar',
        password: 'waqar',
        role: 'admin',
        linkedEntityId: 'WI-ADMIN-WAQAR',
        branchId: 'MAIN-BRANCH',
        status: 'active',
      };

      await setDoc(doc(db, 'admins', 'waqar'), {
        uid: 'waqar',
        username: newProfile.username,
        password: newProfile.password,
        role: 'admin',
        email: newProfile.email,
        updatedAt: serverTimestamp(),
      });

      await setDoc(userRef, {
        ...newProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (authUid !== 'waqar') {
        await setDoc(doc(db, 'users', authUid), {
          ...newProfile,
          uid: authUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setUserProfile(newProfile);
      localStorage.setItem(SESSION_STORAGE_KEY, newProfile.uid);
      setActiveView('admin');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Allow Admin to create or update any Student, Teacher, Parent, or Admin username & password in Firebase Cloud Firestore
  const handleSaveCloudCredential = async (payload: {
    username: string;
    password: string;
    displayName: string;
    role: UserRole;
    branchId?: string;
    linkedEntityId?: string;
  }) => {
    const cleanUid = sanitizeId(payload.username.trim().toLowerCase(), 64);
    const cleanUsername = sanitizeId(payload.username.trim(), 64);
    const cleanPassword = sanitizeText(payload.password.trim(), 128, 'waqar');
    const email = `${cleanUid}@waqarinstitute.edu`;
    const path = `users/${cleanUid}`;

    try {
      const userRef = doc(db, 'users', cleanUid);
      const existing = await getDoc(userRef);

      if (payload.role === 'admin') {
        await setDoc(doc(db, 'admins', cleanUid), {
          uid: cleanUid,
          username: cleanUsername,
          password: cleanPassword,
          role: 'admin',
          email,
          updatedAt: serverTimestamp(),
        });
      }

      const linkedVal = payload.linkedEntityId
        ? sanitizeId(payload.linkedEntityId.trim(), 64)
        : existing.exists()
        ? existing.data().linkedEntityId || cleanUsername
        : cleanUsername;

      const userDocData = {
        uid: cleanUid,
        email,
        displayName: sanitizeText(
          payload.displayName,
          100,
          existing.exists() ? existing.data().displayName : cleanUsername
        ),
        username: cleanUsername,
        password: cleanPassword,
        role: payload.role,
        linkedEntityId: linkedVal,
        branchId: sanitizeText(payload.branchId || 'MAIN-BRANCH', 128, 'MAIN-BRANCH'),
        status: 'active',
        createdAt: existing.exists() ? existing.data().createdAt || serverTimestamp() : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(userRef, userDocData);

      // Mirror credential to Cloud SQL as well
      fetch('/api/cloudsql/sync-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: payload.role,
          title: userDocData.displayName,
          subtitle: `Login ID: ${cleanUsername} | Linked: ${linkedVal}`,
          targetUserId: cleanUsername,
          status: 'Active',
          amount: 0,
          score: 0,
        }),
      }).catch(() => {});
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Connect a Student ID with a Parent ID in Firebase Cloud Firestore (callable by Admin & Teacher)
  const handleLinkStudentToParent = async (studentUsername: string, parentUsername: string) => {
    const cleanStuUid = sanitizeId(studentUsername.trim().toLowerCase(), 64);
    const cleanParUid = sanitizeId(parentUsername.trim().toLowerCase(), 64);
    const cleanStuCode = sanitizeId(studentUsername.trim(), 64);
    const cleanParCode = sanitizeId(parentUsername.trim(), 64);
    const path = `users/${cleanParUid}`;

    try {
      const parentRef = doc(db, 'users', cleanParUid);
      const parentSnap = await getDoc(parentRef);
      if (parentSnap.exists()) {
        await updateDoc(parentRef, {
          linkedEntityId: cleanStuCode,
          updatedAt: serverTimestamp(),
        });
      }

      const studentRef = doc(db, 'users', cleanStuUid);
      const studentSnap = await getDoc(studentRef);
      if (studentSnap.exists()) {
        await updateDoc(studentRef, {
          linkedEntityId: cleanParCode,
          updatedAt: serverTimestamp(),
        });
      }

      // Also record/update the Parent-Student connection in erpRecords so all portals reflect it immediately
      const linkRecordId = sanitizeId(`LINK-${cleanStuCode}-${cleanParCode}`, 64);
      const activeUid = firebaseUser?.uid || userProfile?.uid || 'waqar';
      await setDoc(doc(db, 'erpRecords', linkRecordId), {
        module: 'parent',
        code: cleanParCode,
        title: `Parent (${cleanParCode}) ⇄ Student (${cleanStuCode})`,
        subtitle: `Connected Student ID: ${cleanStuCode}`,
        category: 'Parent-Student Link',
        status: 'Connected',
        branchId: 'MAIN-BRANCH',
        courseId: 'ADCA',
        batchId: 'ADCA-A1',
        targetUserId: cleanStuCode,
        numericValue: 1,
        secondaryNumericValue: 1,
        dateStr: new Date().toISOString().split('T')[0],
        notes: `Student ID ${cleanStuCode} connected with Parent ID ${cleanParCode} in Firebase Cloud`,
        extra1: cleanStuCode,
        extra2: cleanParCode,
        extra3: 'CONNECTED',
        extra4: '',
        ownerUid: sanitizeId(activeUid, 128),
        visibility: 'institute',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  // Strict Schema-Validated Firestore Mutations
  const handleCreateBranch = async (
    payload: Omit<BranchDoc, 'id' | 'ownerUid' | 'visibility' | 'createdAt' | 'updatedAt'>
  ) => {
    const activeUid = firebaseUser?.uid || userProfile?.uid;
    if (!activeUid) return;
    const branchId = sanitizeId(payload.code || `BR-${Date.now()}`, 40);
    const path = `branches/${branchId}`;
    try {
      await setDoc(doc(db, 'branches', branchId), {
        code: branchId,
        name: sanitizeText(payload.name, 120, 'Main Branch'),
        address: sanitizeText(payload.address, 250, 'Campus Road'),
        phone: sanitizeText(payload.phone, 40, '+91-0000000000'),
        email: sanitizeText(payload.email, 120, userProfile?.email || 'branch@waqarinstitute.edu'),
        managerName: sanitizeText(payload.managerName, 100, userProfile?.displayName || 'Manager'),
        status: payload.status || 'active',
        ownerUid: sanitizeId(activeUid, 128),
        visibility: 'institute',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleDeleteBranch = async (id: string) => {
    const path = `branches/${id}`;
    try {
      await deleteDoc(doc(db, 'branches', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleCreateCourse = async (
    payload: Omit<CourseDoc, 'id' | 'ownerUid' | 'visibility' | 'createdAt' | 'updatedAt'>
  ) => {
    const activeUid = firebaseUser?.uid || userProfile?.uid;
    if (!activeUid) return;
    const courseId = sanitizeId(`${payload.code}-${Date.now().toString().slice(-4)}`, 40);
    const path = `courses/${courseId}`;
    try {
      await setDoc(doc(db, 'courses', courseId), {
        code: sanitizeId(payload.code, 40),
        name: sanitizeText(payload.name, 120, 'Computer Course'),
        category: sanitizeText(payload.category, 80, 'Diploma'),
        duration: sanitizeText(payload.duration, 60, '12 Months'),
        fee: Math.max(0, Math.min(10000000, Number(payload.fee) || 0)),
        syllabus: sanitizeText(payload.syllabus, 1000, 'Core Modules'),
        description: sanitizeText(payload.description, 1000, payload.name),
        branchId: sanitizeText(payload.branchId, 128, 'MAIN-BRANCH'),
        status: payload.status || 'active',
        ownerUid: sanitizeId(activeUid, 128),
        visibility: 'institute',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    const path = `courses/${id}`;
    try {
      await deleteDoc(doc(db, 'courses', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleCreateBatch = async (
    payload: Omit<BatchDoc, 'id' | 'ownerUid' | 'visibility' | 'createdAt' | 'updatedAt'>
  ) => {
    const activeUid = firebaseUser?.uid || userProfile?.uid;
    if (!activeUid) return;
    const batchId = sanitizeId(`${payload.code}-${Date.now().toString().slice(-4)}`, 40);
    const path = `batches/${batchId}`;
    try {
      await setDoc(doc(db, 'batches', batchId), {
        code: sanitizeId(payload.code, 40),
        name: sanitizeText(payload.name, 120, 'Batch A1'),
        courseId: sanitizeText(payload.courseId, 128, 'ADCA'),
        courseName: sanitizeText(payload.courseName, 120, 'ADCA'),
        teacherId: sanitizeText(payload.teacherId, 128, 'WI-TCH-01'),
        teacherName: sanitizeText(payload.teacherName, 100, userProfile?.displayName || 'Faculty'),
        branchId: sanitizeText(payload.branchId, 128, 'MAIN-BRANCH'),
        timing: sanitizeText(payload.timing, 80, '10:00 AM - 11:00 AM'),
        capacity: Math.max(1, Math.min(10000, Number(payload.capacity) || 30)),
        startDate: sanitizeText(payload.startDate, 40, new Date().toISOString().split('T')[0]),
        status: payload.status || 'active',
        ownerUid: sanitizeId(activeUid, 128),
        visibility: 'institute',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleDeleteBatch = async (id: string) => {
    const path = `batches/${id}`;
    try {
      await deleteDoc(doc(db, 'batches', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleCreateErpRecord = async (
    payload: Omit<ErpRecordDoc, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
  ) => {
    const activeUid = firebaseUser?.uid || userProfile?.uid;
    if (!activeUid) return;
    const recordId = sanitizeId(`${payload.module}-${Date.now()}`, 64);
    const path = `erpRecords/${recordId}`;
    try {
      await setDoc(doc(db, 'erpRecords', recordId), {
        module: payload.module,
        code: sanitizeId(payload.code, 64),
        title: sanitizeText(payload.title, 160, 'Institute Record'),
        subtitle: sanitizeText(payload.subtitle, 200, '-'),
        category: sanitizeText(payload.category, 100, 'General'),
        status: sanitizeText(payload.status, 40, 'Active'),
        branchId: sanitizeText(payload.branchId, 128, 'MAIN-BRANCH'),
        courseId: sanitizeText(payload.courseId, 128, 'ADCA'),
        batchId: sanitizeText(payload.batchId, 128, 'BATCH-A1'),
        targetUserId: sanitizeText(payload.targetUserId, 128, activeUid),
        numericValue: Number(payload.numericValue) || 0,
        secondaryNumericValue: Number(payload.secondaryNumericValue) || 0,
        dateStr: sanitizeText(payload.dateStr, 60, new Date().toISOString().split('T')[0]),
        notes: sanitizeText(payload.notes, 2000, ''),
        extra1: sanitizeText(payload.extra1, 500, ''),
        extra2: sanitizeText(payload.extra2, 500, ''),
        extra3: sanitizeText(payload.extra3, 500, ''),
        extra4: sanitizeText(payload.extra4, 500, ''),
        ownerUid: sanitizeId(activeUid, 128),
        visibility: payload.visibility || 'institute',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Mirror record to Cloud SQL PostgreSQL as well
      fetch('/api/cloudsql/sync-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: payload.module,
          title: payload.title,
          subtitle: payload.subtitle,
          targetUserId: payload.targetUserId || activeUid,
          status: payload.status || 'Active',
          amount: Number(payload.numericValue) || 0,
          score: Number(payload.secondaryNumericValue) || 0,
        }),
      }).catch(() => {});
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleUpdateErpRecordStatus = async (id: string, newStatus: string) => {
    const path = `erpRecords/${id}`;
    try {
      await updateDoc(doc(db, 'erpRecords', id), {
        status: sanitizeText(newStatus, 40, 'Active'),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteErpRecord = async (id: string) => {
    const path = `erpRecords/${id}`;
    try {
      await deleteDoc(doc(db, 'erpRecords', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleUpdateUserProfile = async (updates: Partial<UserProfileDoc>) => {
    const activeUid = firebaseUser?.uid || userProfile?.uid;
    if (!activeUid || !userProfile) return;
    const path = `users/${activeUid}`;
    try {
      const nextDisplayName = updates.displayName
        ? sanitizeText(updates.displayName, 100, userProfile.displayName)
        : userProfile.displayName;
      const nextUsername = updates.username
        ? sanitizeId(updates.username, 64)
        : userProfile.username;
      const nextLinked =
        updates.linkedEntityId !== undefined
          ? sanitizeText(updates.linkedEntityId, 128, '')
          : userProfile.linkedEntityId;

      await updateDoc(doc(db, 'users', activeUid), {
        displayName: nextDisplayName,
        username: nextUsername,
        linkedEntityId: nextLinked,
        branchId: userProfile.branchId,
        updatedAt: serverTimestamp(),
      });

      setUserProfile({
        ...userProfile,
        displayName: nextDisplayName,
        username: nextUsername,
        linkedEntityId: nextLinked,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setUserProfile(null);
    await signOut(auth).catch(() => {});
  };

  // Reset Admin Password verified by Date of Birth in Firebase Cloud Firestore
  const handleResetPasswordWithDob = async (
    usernameInput: string,
    dobInput: string,
    newPasswordInput: string
  ): Promise<void> => {
    const cleanDob = dobInput.trim().toLowerCase().replace(/\s+/g, ' ');
    const isValidDob =
      cleanDob === '1 january 2012' ||
      cleanDob === '01 january 2012' ||
      cleanDob === '1 jan 2012' ||
      cleanDob === '2012-01-01' ||
      cleanDob === '01/01/2012' ||
      cleanDob === '1/1/2012' ||
      cleanDob === '01-01-2012' ||
      cleanDob === '1-1-2012' ||
      cleanDob === '4 january 2024' ||
      cleanDob === '04 january 2024' ||
      cleanDob === '4 jan 2024' ||
      cleanDob === '2024-01-04' ||
      cleanDob === '04/01/2024' ||
      cleanDob === '4/1/2024' ||
      cleanDob === '04-01-2024' ||
      cleanDob === '4-1-2024';

    if (!isValidDob) {
      throw new Error('Verification failed: Date of Birth does not match Admin records.');
    }

    const cleanUid = sanitizeId(usernameInput.trim().toLowerCase(), 64);
    const cleanUsername = sanitizeId(usernameInput.trim(), 64);
    const cleanPassword = sanitizeText(newPasswordInput.trim(), 128, 'waqar123');
    const userRef = doc(db, 'users', cleanUid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      await updateDoc(userRef, {
        password: cleanPassword,
        updatedAt: serverTimestamp(),
      });
      if (snap.data().role === 'admin' || cleanUid === 'waqar') {
        await setDoc(
          doc(db, 'admins', cleanUid),
          {
            uid: cleanUid,
            username: snap.data().username || cleanUsername,
            password: cleanPassword,
            role: 'admin',
            email: snap.data().email || `${cleanUid}@waqarinstitute.edu`,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } else {
      await handleSaveCloudCredential({
        username: cleanUsername,
        password: cleanPassword,
        displayName: cleanUsername,
        role: cleanUid === 'waqar' ? 'admin' : 'student',
      });
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#040D33] via-[#0A2170] to-[#0077B6] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <WaterfallAnimation fullScreen={true} />
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-28 h-28 rounded-3xl bg-white p-2.5 shadow-[0_14px_34px_rgba(0,0,0,0.5)] border-2 border-cyan-200 mb-4 flex items-center justify-center">
            <img
              src="/waqar_logo.png"
              alt="Waqar Computer Institute Official Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="w-10 h-10 rounded-full border-4 border-cyan-300/30 border-t-cyan-300 animate-spin mb-3" />
          <p className="font-display font-extrabold text-xl tracking-wider text-white">
            Welcome to Waqar Computer Institute
          </p>
          <p className="text-xs text-cyan-200 font-semibold mt-1">Enjoy Your Journey</p>
        </div>
      </div>
    );
  }

  return (
    <AndroidDeviceFrame onOpenCiModal={() => setKotlinModalOpen(true)}>
      {!userProfile ? (
        <Waqar3DLoginPortal
          onAuthenticateWithCredentials={handleAuthenticateWithCredentials}
          onResetPasswordWithDob={handleResetPasswordWithDob}
          authLoading={authLoading}
          authError={authError}
        />
      ) : (
        <div className="min-h-full flex-1 flex flex-col waterfall-gradient text-[#03045E]">
          {/* Active Native Android Portal Viewport */}
          <main className="flex-1">
            {activeView === 'admin' && userProfile.role === 'admin' ? (
              <AdminErpPanel
                userProfile={userProfile}
                branches={branches}
                courses={courses}
                batches={batches}
                erpRecords={erpRecords}
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
                onLinkStudentToParent={handleLinkStudentToParent}
                onOpenKotlinModal={() => setKotlinModalOpen(true)}
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
        </div>
      )}

      {kotlinModalOpen && <KotlinCiModal onClose={() => setKotlinModalOpen(false)} />}
    </AndroidDeviceFrame>
  );
}
