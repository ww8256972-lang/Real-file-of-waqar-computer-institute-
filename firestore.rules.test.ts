import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';

/**
 * Comprehensive Firestore Security Rules Unit Test Suite (`firestore.rules.test.ts`).
 * Verifies every role boundary and security invariant defined in Phase 2.4.
 */
describe('Waqar Computer Institute ERP — Firestore Security Rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'waqar-institute-erp-test',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await adminDb.collection('users').doc('student_1').set({
        uid: 'student_1',
        username: 'student_1',
        email: 'student_1@waqarinstitute.edu',
        role: 'student',
        branchId: 'MAIN-BRANCH',
        linkedEntityId: 'WI-001',
        status: 'active',
      });
      await adminDb.collection('users').doc('student_2').set({
        uid: 'student_2',
        username: 'student_2',
        email: 'student_2@waqarinstitute.edu',
        role: 'student',
        branchId: 'MAIN-BRANCH',
        linkedEntityId: 'WI-002',
        status: 'active',
      });
    });
  });

  test('1. Unauthenticated client cannot get or list users/{uid}', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthDb.collection('users').doc('student_1').get());
    await assertFails(unauthDb.collection('users').get());
  });

  test('2. Student can read own users/{uid} document but NOT another student document', async () => {
    const student1Db = testEnv
      .authenticatedContext('student_1', { role: 'student' })
      .firestore();

    await assertSucceeds(student1Db.collection('users').doc('student_1').get());
    await assertFails(student1Db.collection('users').doc('student_2').get());
  });

  test('3. Student cannot escalate own role to admin on users/{uid}', async () => {
    const student1Db = testEnv
      .authenticatedContext('student_1', { role: 'student' })
      .firestore();

    await assertFails(
      student1Db.collection('users').doc('student_1').update({
        role: 'admin',
      })
    );

    await assertSucceeds(
      student1Db.collection('users').doc('student_1').update({
        displayName: 'Updated Student Name',
      })
    );
  });

  test('4. Admin cannot write a document containing password or passwordHash field', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_1', { role: 'admin' })
      .firestore();

    await assertFails(
      adminDb.collection('users').doc('student_3').set({
        uid: 'student_3',
        username: 'student_3',
        password: 'plaintext_password',
        role: 'student',
      })
    );

    await assertSucceeds(
      adminDb.collection('users').doc('student_3').set({
        uid: 'student_3',
        username: 'student_3',
        email: 'student_3@waqarinstitute.edu',
        role: 'student',
        branchId: 'MAIN-BRANCH',
        status: 'active',
      })
    );
  });

  test('5. Direct client writes to attendance, results, audit_logs, studentSessions, and privateSessionKeys are denied', async () => {
    const adminDb = testEnv
      .authenticatedContext('admin_1', { role: 'admin' })
      .firestore();

    await assertFails(
      adminDb.collection('attendance').doc('att_1').set({ studentId: 'student_1' })
    );
    await assertFails(
      adminDb.collection('results').doc('res_1').set({ studentId: 'student_1', score: 98 })
    );
    await assertFails(
      adminDb.collection('audit_logs').doc('log_1').set({ event: 'TAMPER' })
    );
    await assertFails(
      adminDb.collection('studentSessions').doc('student_1').set({ activeSessionId: 's1' })
    );
    await assertFails(
      adminDb.collection('privateSessionKeys').doc('k1').set({ secret: '123' })
    );
  });
});
