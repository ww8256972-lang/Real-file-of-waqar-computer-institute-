export type UserRole = 'admin' | 'teacher' | 'student' | 'parent' | 'accountant' | 'receptionist';

export type ErpModuleType =
  | 'student'
  | 'teacher'
  | 'parent'
  | 'admission'
  | 'attendance'
  | 'exam'
  | 'exam_attempt'
  | 'result'
  | 'fee'
  | 'certificate'
  | 'material'
  | 'assignment'
  | 'timetable'
  | 'library'
  | 'staff'
  | 'notification'
  | 'message'
  | 'ticket'
  | 'event'
  | 'audit';

export interface UserProfileDoc {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  password?: string;
  role: UserRole;
  linkedEntityId: string;
  branchId: string;
  status: 'active' | 'pending' | 'suspended';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BranchDoc {
  id: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  managerName: string;
  status: 'active' | 'inactive' | 'archived';
  ownerUid: string;
  visibility: 'institute';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CourseDoc {
  id: string;
  code: string;
  name: string;
  category: string;
  duration: string;
  fee: number;
  syllabus: string;
  description: string;
  branchId: string;
  status: 'active' | 'inactive' | 'archived';
  ownerUid: string;
  visibility: 'institute';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BatchDoc {
  id: string;
  code: string;
  name: string;
  courseId: string;
  courseName: string;
  teacherId: string;
  teacherName: string;
  branchId: string;
  timing: string;
  capacity: number;
  startDate: string;
  status: 'active' | 'completed' | 'archived';
  ownerUid: string;
  visibility: 'institute';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ErpRecordDoc {
  id: string;
  module: ErpModuleType;
  code: string;
  title: string;
  subtitle: string;
  category: string;
  status: string;
  branchId: string;
  courseId: string;
  batchId: string;
  targetUserId: string;
  numericValue: number;
  secondaryNumericValue: number;
  dateStr: string;
  notes: string;
  extra1: string;
  extra2: string;
  extra3: string;
  extra4: string;
  ownerUid: string;
  visibility: 'institute' | 'private';
  createdAt?: unknown;
  updatedAt?: unknown;
}

// Validation constants synchronized verbatim with firebase-blueprint.json & firestore.rules
export const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export function sanitizeId(input: string, maxLen = 64): string {
  const cleaned = input.trim().replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : `WI-${Date.now()}`;
}

export function sanitizeText(input: string, maxLen: number, fallback = ''): string {
  const cleaned = (input ?? '').trim().slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function calculateGrade(percentage: number): { grade: string; passed: boolean } {
  if (percentage >= 90) return { grade: 'A+', passed: true };
  if (percentage >= 80) return { grade: 'A', passed: true };
  if (percentage >= 70) return { grade: 'B+', passed: true };
  if (percentage >= 60) return { grade: 'B', passed: true };
  if (percentage >= 40) return { grade: 'C', passed: true };
  return { grade: 'F', passed: false };
}
