import { pgTable, serial, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  username: text('username').notNull().unique(),
  password: text('password').notNull().default('waqar'),
  displayName: text('display_name').notNull(),
  email: text('email'),
  role: text('role').notNull().default('student'),
  branchId: text('branch_id').default('MAIN-BRANCH'),
  linkedEntityId: text('linked_entity_id'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  role: text('role').notNull().default('admin'),
  email: text('email'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  managerName: text('manager_name'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  category: text('category').default('Diploma'),
  durationMonths: integer('duration_months').notNull().default(12),
  feeAmount: integer('fee_amount').notNull().default(0),
  syllabus: text('syllabus'),
  branchId: text('branch_id').default('MAIN-BRANCH'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const batches = pgTable('batches', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  courseId: text('course_id').notNull(),
  courseName: text('course_name').notNull(),
  teacherId: text('teacher_id'),
  teacherName: text('teacher_name'),
  branchId: text('branch_id').default('MAIN-BRANCH'),
  timing: text('timing'),
  capacity: integer('capacity').default(30),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const erpRecords = pgTable('erp_records', {
  id: serial('id').primaryKey(),
  recordId: text('record_id').unique(),
  module: text('module').notNull(),
  code: text('code'),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  category: text('category'),
  targetUserId: text('target_user_id'),
  branchId: text('branch_id').default('MAIN-BRANCH'),
  courseId: text('course_id'),
  batchId: text('batch_id'),
  status: text('status'),
  amount: integer('amount'),
  score: integer('score'),
  dateStr: text('date_str'),
  notes: text('notes'),
  isSynced: boolean('is_synced').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
