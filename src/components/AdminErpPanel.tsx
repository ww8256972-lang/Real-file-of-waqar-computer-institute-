import React, { useState } from 'react';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  CloudUpload,
  Download,
  FileText,
  FolderKanban,
  GraduationCap,
  Home,
  KeyRound,
  Link2,
  LogOut,
  Mail,
  Menu,
  Moon,
  MoreHorizontal,
  PieChart,
  Play,
  Plus,
  Printer,
  QrCode,
  Search,
  Settings,
  Shield,
  Sun,
  Trash2,
  Trophy,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
  Lock,
  Unlock,
  Sparkles,
  Image as ImageIcon,
  Video,
  Clock,
  Check,
} from 'lucide-react';
import {
  BatchDoc,
  BranchDoc,
  CourseDoc,
  ErpModuleType,
  ErpRecordDoc,
  UserProfileDoc,
  UserRole,
  calculateGrade,
  sanitizeId,
} from '../types/erp';
import { GoogleWorkspaceHub } from './GoogleWorkspaceHub';
import { RealQrGenerator } from './RealQrGenerator';
import { QrScannerModal } from './QrScannerModal';
import { FireRingCanvas } from './FireRingCanvas';
import { AgoraLiveClassRoom } from './AgoraLiveClassRoom';
import { EduSyncAiTutor } from './EduSyncAiTutor';
import {
  McqQuestionItem,
  compressImageFileToDataUrl,
  generate50McqQuestionBank,
  getMediaAttachment,
  saveCustomMcqBank,
  saveMediaAttachment,
  triggerCelebrationConfetti,
} from '../utils/mcqBank';

type AdminSection =
  | 'dashboard'
  | 'students'
  | 'admissions'
  | 'teachers'
  | 'courses'
  | 'batches'
  | 'attendance'
  | 'examinations'
  | 'results'
  | 'fees'
  | 'certificates'
  | 'branches'
  | 'reports'
  | 'notifications'
  | 'messages'
  | 'staff'
  | 'live_class'
  | 'ai_tutor'
  | 'settings';

interface AdminErpPanelProps {
  userProfile: UserProfileDoc;
  branches: BranchDoc[];
  courses: CourseDoc[];
  batches: BatchDoc[];
  erpRecords: ErpRecordDoc[];
  onCreateBranch: (
    payload: Omit<BranchDoc, 'id' | 'ownerUid' | 'visibility' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteBranch: (id: string) => Promise<void>;
  onCreateCourse: (
    payload: Omit<CourseDoc, 'id' | 'ownerUid' | 'visibility' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteCourse: (id: string) => Promise<void>;
  onCreateBatch: (
    payload: Omit<BatchDoc, 'id' | 'ownerUid' | 'visibility' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteBatch: (id: string) => Promise<void>;
  onCreateErpRecord: (
    payload: Omit<ErpRecordDoc, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateErpRecordStatus: (id: string, newStatus: string) => Promise<void>;
  onDeleteErpRecord: (id: string) => Promise<void>;
  onSaveCloudCredential: (payload: {
    username: string;
    password: string;
    displayName: string;
    role: UserRole;
    branchId?: string;
    linkedEntityId?: string;
  }) => Promise<void>;
  onLinkStudentToParent: (studentUsername: string, parentUsername: string) => Promise<void>;
  onOpenKotlinModal: () => void;
  onLogout: () => void;
}

export const AdminErpPanel: React.FC<AdminErpPanelProps> = ({
  userProfile,
  branches,
  courses,
  batches,
  erpRecords,
  onCreateBranch,
  onDeleteBranch,
  onCreateCourse,
  onDeleteCourse,
  onCreateBatch,
  onDeleteBatch,
  onCreateErpRecord,
  onUpdateErpRecordStatus,
  onDeleteErpRecord,
  onSaveCloudCredential,
  onLinkStudentToParent,
  onOpenKotlinModal,
  onLogout,
}) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [showAdminSearch, setShowAdminSearch] = useState(false);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [darkMode, setDarkMode] = useState(false);

  // Sub-tab for Staff & Additional Operations
  const [opsSubModule, setOpsSubModule] = useState<ErpModuleType>('staff');

  // Form states for Branch creation
  const [branchCode, setBranchCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchEmail, setBranchEmail] = useState('');
  const [branchManager, setBranchManager] = useState('');

  // Form states for Course creation
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseCategory, setCourseCategory] = useState('Diploma');
  const [courseDuration, setCourseDuration] = useState('12 Months');
  const [courseFee, setCourseFee] = useState('');
  const [courseSyllabus, setCourseSyllabus] = useState('');
  const [courseDesc, setCourseDesc] = useState('');

  // Form states for Batch creation (24-Hour Time + Add Students + Batch Admin)
  const [batchCode, setBatchCode] = useState('');
  const [batchName, setBatchName] = useState('');
  const [batchCourseId, setBatchCourseId] = useState('');
  const [batchTeacherName, setBatchTeacherName] = useState('');
  const [batchStart24h, setBatchStart24h] = useState('10:00');
  const [batchEnd24h, setBatchEnd24h] = useState('11:00');
  const [batchTiming, setBatchTiming] = useState('10:00 - 11:00 (24h)');
  const [batchCapacity, setBatchCapacity] = useState('30');
  const [batchStartDate, setBatchStartDate] = useState('');
  const [batchAdminName, setBatchAdminName] = useState('');
  const [batchSelectedStudents, setBatchSelectedStudents] = useState<string[]>([]);
  const [batchSavedBanner, setBatchSavedBanner] = useState<string | null>(null);

  // Teacher Assigned Batch State (Restricts Teacher to only their assigned batch)
  const [teacherAssignedBatch, setTeacherAssignedBatch] = useState<string>(
    batches[0]?.code || 'ADCA-A1'
  );

  // Notification Bell Seen Counter (Immediately resets badge to 0 on click)
  const [seenNotifCount, setSeenNotifCount] = useState<number>(0);

  // Generic ERP Record Form State
  const [recCode, setRecCode] = useState('');
  const [recTitle, setRecTitle] = useState('');
  const [recSubtitle, setRecSubtitle] = useState('');
  const [recCategory, setRecCategory] = useState('');
  const [recStatus, setRecStatus] = useState('Active');
  const [recNumeric, setRecNumeric] = useState('');
  const [recSecondaryNumeric, setRecSecondaryNumeric] = useState('100');
  const [recDate, setRecDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [recNotes, setRecNotes] = useState('');
  const [recExtra1, setRecExtra1] = useState('');
  const [recExtra2, setRecExtra2] = useState('');
  const [recTargetUser, setRecTargetUser] = useState('');
  const [submittingForm, setSubmittingForm] = useState(false);

  // Admin Own Username & Password Update in Settings
  const [adminNewUsername, setAdminNewUsername] = useState(userProfile.username || 'Waqar');
  const [adminNewPassword, setAdminNewPassword] = useState('waqar');
  const [adminCredSavedMsg, setAdminCredSavedMsg] = useState<string | null>(null);

  // Firebase Cloud Credential Form State (Admin creates Student, Teacher, Parent logins)
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [credDisplayName, setCredDisplayName] = useState('');
  const [credRole, setCredRole] = useState<UserRole>('student');
  const [credLinkedId, setCredLinkedId] = useState('');
  const [credSavedMsg, setCredSavedMsg] = useState<string | null>(null);

  // Student-to-Parent ID Linker State (Located in Settings)
  const [linkStudentId, setLinkStudentId] = useState('');
  const [linkParentId, setLinkParentId] = useState('');
  const [linkSuccessMsg, setLinkSuccessMsg] = useState<string | null>(null);

  // Real QR Code Generator, Scanner & Batch Attendance Save State in Admin Portal
  const [adminQrBatch, setAdminQrBatch] = useState<string>(batches[0]?.code || 'ADCA-A1');
  const [adminScannerOpen, setAdminScannerOpen] = useState(false);
  const [adminQrScanBanner, setAdminQrScanBanner] = useState<string | null>(null);
  const [draftAdminAttendance, setDraftAdminAttendance] = useState<
    Record<string, 'Present' | 'Absent'>
  >({});
  const [savingAdminBatchAtt, setSavingAdminBatchAtt] = useState(false);
  const [adminBatchAttSavedMsg, setAdminBatchAttSavedMsg] = useState<string | null>(null);

  // Gallery Photo & File Manager Upload State (Student Photo / Assignment File)
  const [uploadedFileDataUrl, setUploadedFileDataUrl] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [formSavedBanner, setFormSavedBanner] = useState<string | null>(null);

  // 50-MCQ Builder & 24-Hour Time Schedule State for Examinations
  const [examStartTime24h, setExamStartTime24h] = useState('10:00');
  const [examEndTime24h, setExamEndTime24h] = useState('10:30');
  const [adminMcqBank, setAdminMcqBank] = useState<McqQuestionItem[]>([]);
  const [mcqQuestionText, setMcqQuestionText] = useState('');
  const [mcqOptionA, setMcqOptionA] = useState('');
  const [mcqOptionB, setMcqOptionB] = useState('');
  const [mcqOptionC, setMcqOptionC] = useState('');
  const [mcqOptionD, setMcqOptionD] = useState('');
  const [mcqCorrectOption, setMcqCorrectOption] = useState<'A' | 'B' | 'C' | 'D'>('A');

  // Filtered Counts from Real Firestore Documents
  const filterByBranchAndSearch = <
    T extends { branchId?: string; name?: string; title?: string; code?: string }
  >(
    list: T[]
  ): T[] => {
    return list.filter((item) => {
      const branchOk =
        selectedBranchFilter === 'ALL' || !item.branchId || item.branchId === selectedBranchFilter;
      const q = globalSearch.trim().toLowerCase();
      if (!q) return branchOk;
      const text = `${item.name ?? ''} ${item.title ?? ''} ${item.code ?? ''}`.toLowerCase();
      return branchOk && text.includes(q);
    });
  };

  const students = filterByBranchAndSearch(erpRecords.filter((r) => r.module === 'student'));
  const admissions = filterByBranchAndSearch(erpRecords.filter((r) => r.module === 'admission'));
  const teachers = filterByBranchAndSearch(erpRecords.filter((r) => r.module === 'teacher'));
  const parents = filterByBranchAndSearch(erpRecords.filter((r) => r.module === 'parent'));
  const attendances = filterByBranchAndSearch(erpRecords.filter((r) => r.module === 'attendance'));
  const examinations = filterByBranchAndSearch(erpRecords.filter((r) => r.module === 'exam'));
  const results = filterByBranchAndSearch(erpRecords.filter((r) => r.module === 'result'));
  const fees = filterByBranchAndSearch(erpRecords.filter((r) => r.module === 'fee'));
  const certificates = filterByBranchAndSearch(
    erpRecords.filter((r) => r.module === 'certificate')
  );
  const notifications = filterByBranchAndSearch(
    erpRecords.filter((r) => r.module === 'notification')
  );
  const messages = filterByBranchAndSearch(erpRecords.filter((r) => r.module === 'message'));

  const unreadNotifCount = Math.max(0, notifications.length - seenNotifCount);

  const handleOpenNotifications = () => {
    setSeenNotifCount(notifications.length);
    setActiveSection('notifications');
  };

  const totalFeeCollected = fees
    .filter((f) => f.status.toLowerCase() === 'paid')
    .reduce((sum, f) => sum + (Number(f.numericValue) || 0), 0);

  const totalFeePending = fees
    .filter((f) => f.status.toLowerCase() === 'pending')
    .reduce((sum, f) => sum + (Number(f.numericValue) || 0), 0);

  // Handle Admin QR Scan -> Immediately Marks Real Student Attendance in Firestore
  const handleAdminQrScanSuccess = async (scannedToken: string) => {
    const today = new Date().toISOString().split('T')[0];
    const batchMatch = scannedToken.match(/BATCH:([^|]+)/);
    const studentMatch = scannedToken.match(/STUDENT:([^|]+)/);
    const nameMatch = scannedToken.match(/NAME:([^|]+)/);

    const matchedBatch = batchMatch ? batchMatch[1] : adminQrBatch || 'ADCA-A1';
    const matchedStudentId =
      studentMatch && studentMatch[1] !== 'ALL'
        ? studentMatch[1]
        : students[0]?.code || 'WI-STU-VERIFIED';
    const matchedStudentName =
      nameMatch && nameMatch[1] !== 'Batch Session'
        ? nameMatch[1]
        : students.find((s) => s.code === matchedStudentId)?.title ||
          `Student (${matchedStudentId})`;

    await onCreateErpRecord({
      module: 'attendance',
      code: matchedStudentId,
      title: matchedStudentName,
      subtitle: `Batch: ${matchedBatch} • Scanned by Admin`,
      category: 'Real QR Attendance',
      status: 'Present',
      branchId:
        selectedBranchFilter === 'ALL'
          ? branches[0]?.code || 'MAIN-BRANCH'
          : selectedBranchFilter,
      courseId: courses[0]?.code || 'ADCA',
      batchId: matchedBatch,
      targetUserId: matchedStudentId,
      numericValue: 100,
      secondaryNumericValue: 1,
      dateStr: today,
      notes: `Real QR Scanned in Admin Portal at ${new Date().toLocaleTimeString()}`,
      extra1: matchedStudentId,
      extra2: 'Present',
      extra3: scannedToken.slice(0, 80),
      extra4: 'ADMIN_QR_SCANNER_VERIFIED',
      visibility: 'institute',
    });

    setAdminScannerOpen(false);
    setAdminQrScanBanner(
      `✓ Real Attendance Marked PRESENT for ${matchedStudentName} (${matchedStudentId}) in Batch ${matchedBatch}!`
    );
    setTimeout(() => setAdminQrScanBanner(null), 6000);
  };

  // Export CSV Helper
  const handleExportCsv = (filename: string, rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sidebarItems: {
    id: AdminSection;
    label: string;
    icon: React.ElementType;
    count?: number;
    badgeColor?: string;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'students', label: 'Students', icon: Users, count: students.length, badgeColor: 'bg-blue-500' },
    { id: 'admissions', label: 'Admissions', icon: UserPlus, count: admissions.length },
    { id: 'teachers', label: 'Teachers', icon: UserCheck, count: teachers.length },
    { id: 'courses', label: 'Courses', icon: BookOpen, count: courses.length },
    { id: 'batches', label: 'Batches', icon: FolderKanban, count: batches.length },
    { id: 'attendance', label: 'Attendance', icon: CheckCircle2, count: attendances.length },
    { id: 'examinations', label: 'Examinations', icon: FileText, count: examinations.length },
    { id: 'results', label: 'Results', icon: Trophy, count: results.length },
    { id: 'fees', label: 'Fees', icon: Wallet, count: fees.length },
    { id: 'certificates', label: 'Certificates', icon: Award, count: certificates.length },
    { id: 'branches', label: 'Branches', icon: Building2, count: branches.length },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      count: unreadNotifCount,
      badgeColor: 'bg-rose-500',
    },
    { id: 'messages', label: 'Messages', icon: Mail, count: messages.length },
    { id: 'live_class', label: 'Agora Live Class', icon: Video },
    { id: 'ai_tutor', label: 'EduSense AI Tutor', icon: Sparkles },
    { id: 'staff', label: 'Staff & HR', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleGalleryOrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 220);
      setUploadedFileDataUrl(dataUrl);
    } catch {
      setUploadedFileDataUrl('');
    }
  };

  const handleAddSingleMcqToAdminBank = () => {
    if (!mcqQuestionText.trim() || adminMcqBank.length >= 50) return;
    const nextItem: McqQuestionItem = {
      id: adminMcqBank.length + 1,
      question: mcqQuestionText.trim(),
      optionA: mcqOptionA.trim() || 'Option A',
      optionB: mcqOptionB.trim() || 'Option B',
      optionC: mcqOptionC.trim() || 'Option C',
      optionD: mcqOptionD.trim() || 'Option D',
      correctOption: mcqCorrectOption,
    };
    setAdminMcqBank((prev) => [...prev, nextItem]);
    setMcqQuestionText('');
    setMcqOptionA('');
    setMcqOptionB('');
    setMcqOptionC('');
    setMcqOptionD('');
  };

  const handleAutoInject50McqsAdmin = () => {
    const courseLabel = recCategory.trim() || courses[0]?.code || 'ADCA';
    const bank50 = generate50McqQuestionBank(courseLabel);
    setAdminMcqBank(bank50);
    setRecNotes(`50_MCQ_BANK (${courseLabel} - 50 Verified Multiple Choice Questions)`);
    if (!recNumeric) setRecNumeric('30');
    triggerCelebrationConfetti();
  };

  const handleGenericRecordSubmit = async (e: React.FormEvent, targetModule: ErpModuleType) => {
    e.preventDefault();
    if (!recTitle.trim() || submittingForm) return;
    setSubmittingForm(true);
    try {
      const prefix = targetModule.slice(0, 3).toUpperCase();
      const finalCode = sanitizeId(
        recCode.trim() || `${prefix}-${Date.now().toString().slice(-6)}`
      );
      const numVal = Number(recNumeric) || (targetModule === 'exam' ? 30 : 0);
      const secVal = Number(recSecondaryNumeric) || 100;

      let computedExtra1 = recExtra1.trim();
      let computedExtra2 = recExtra2.trim();
      let computedExtra3 = uploadedFileName ? `FILE:${uploadedFileName}` : '';
      let computedExtra4 = '';
      let computedStatus = recStatus.trim() || 'Active';
      let computedNotes = recNotes.trim();

      if (targetModule === 'result') {
        const g = calculateGrade(numVal);
        computedExtra1 = computedExtra1 || g.grade;
        computedStatus = g.passed ? 'Pass' : 'Fail';
      }

      if (targetModule === 'exam') {
        computedExtra1 = examStartTime24h || '10:00';
        computedExtra2 = examEndTime24h || '10:30';
        const finalMcqList =
          adminMcqBank.length > 0
            ? adminMcqBank
            : mcqQuestionText.trim()
            ? [
                {
                  id: 1,
                  question: mcqQuestionText.trim(),
                  optionA: mcqOptionA.trim() || 'Option A',
                  optionB: mcqOptionB.trim() || 'Option B',
                  optionC: mcqOptionC.trim() || 'Option C',
                  optionD: mcqOptionD.trim() || 'Option D',
                  correctOption: mcqCorrectOption,
                },
              ]
            : generate50McqQuestionBank(recCategory.trim() || 'ADCA');

        saveCustomMcqBank(finalCode, finalMcqList);
        computedExtra3 = `${finalMcqList.length} MCQs`;
        computedExtra4 = 'AUTO_50_MCQ';
        computedNotes =
          computedNotes ||
          `50_MCQ_BANK • Scheduled ${computedExtra1} to ${computedExtra2} (24h Format)`;
      }

      if (targetModule === 'certificate') {
        computedStatus = recStatus === 'Completed' ? 'Completed' : 'Locked';
        computedExtra3 =
          computedStatus === 'Locked'
            ? 'Locked until Course Duration Completes'
            : 'Course Duration Completed — Unlocked';
      }

      if (uploadedFileDataUrl) {
        saveMediaAttachment(finalCode, uploadedFileDataUrl, [
          recTitle.trim(),
          recTargetUser.trim(),
          recExtra1.trim(),
        ]);
      }

      const assignedBatchForRecord =
        targetModule === 'teacher'
          ? teacherAssignedBatch || batches[0]?.code || 'ADCA-A1'
          : batches[0]?.code || 'ADCA-A1';

      if (targetModule === 'teacher') {
        computedExtra1 = assignedBatchForRecord;
        computedNotes = computedNotes
          ? `${computedNotes} • Assigned Batch: ${assignedBatchForRecord}`
          : `Assigned Batch: ${assignedBatchForRecord}`;
      }

      await onCreateErpRecord({
        module: targetModule,
        code: finalCode,
        title: recTitle.trim(),
        subtitle:
          recSubtitle.trim() ||
          (targetModule === 'teacher'
            ? `Batch Teacher (${assignedBatchForRecord})`
            : 'WAQAR INSTITUTE Official Record'),
        category: recCategory.trim() || courses[0]?.code || targetModule.toUpperCase(),
        status: computedStatus,
        branchId:
          selectedBranchFilter === 'ALL'
            ? branches[0]?.code || 'MAIN-BRANCH'
            : selectedBranchFilter,
        courseId: recCategory.trim() || courses[0]?.code || 'ADCA',
        batchId: assignedBatchForRecord,
        targetUserId: recTargetUser.trim() || finalCode,
        numericValue: numVal,
        secondaryNumericValue: secVal,
        dateStr: recDate || new Date().toISOString().split('T')[0],
        notes: computedNotes,
        extra1: computedExtra1,
        extra2: computedExtra2,
        extra3: computedExtra3,
        extra4: computedExtra4,
        visibility: 'institute',
      });

      // Automatically save Login Credentials in Firebase Cloud when Admin adds a Student, Teacher, or Parent
      if (targetModule === 'student' || targetModule === 'teacher' || targetModule === 'parent') {
        const assignedPassword = recExtra2.trim() || 'waqar123';
        const linkedEntity =
          targetModule === 'teacher'
            ? assignedBatchForRecord
            : recExtra1.trim() || finalCode;
        await onSaveCloudCredential({
          username: finalCode,
          password: assignedPassword,
          displayName: recTitle.trim(),
          role: targetModule,
          branchId:
            selectedBranchFilter === 'ALL'
              ? branches[0]?.code || 'MAIN-BRANCH'
              : selectedBranchFilter,
          linkedEntityId: linkedEntity,
        });

        // When creating a Student, also generate their Certificate in Locked state until course duration completes
        if (targetModule === 'student') {
          const selectedCourseCode = recCategory.trim() || courses[0]?.code || 'ADCA';
          const matchedCourse = courses.find((c) => c.code === selectedCourseCode);
          const durationLabel = matchedCourse?.duration || '12 Months';
          await onCreateErpRecord({
            module: 'certificate',
            code: sanitizeId(`CERT-${finalCode}`, 64),
            title: matchedCourse?.name || `Diploma in ${selectedCourseCode}`,
            subtitle: `Awarded to ${recTitle.trim()} (${finalCode})`,
            category: selectedCourseCode,
            status: 'Locked',
            branchId:
              selectedBranchFilter === 'ALL'
                ? branches[0]?.code || 'MAIN-BRANCH'
                : selectedBranchFilter,
            courseId: selectedCourseCode,
            batchId: batches[0]?.code || 'ADCA-A1',
            targetUserId: finalCode,
            numericValue: 0,
            secondaryNumericValue: 100,
            dateStr: new Date().toISOString().split('T')[0],
            notes: `Certificate Locked until ${durationLabel} Course Duration Completes`,
            extra1: 'Pending Course Completion',
            extra2: 'Main Campus',
            extra3: `${durationLabel} (Locked until Course Duration Completes)`,
            extra4: 'LOCKED_UNTIL_COMPLETION',
            visibility: 'institute',
          });
        }

        setFormSavedBanner(
          `✓ Saved ${targetModule.toUpperCase()} "${recTitle.trim()}" with Cloud Username "${finalCode}" & Password "${assignedPassword}" in Firebase Cloud!`
        );
      } else {
        setFormSavedBanner(`✓ Saved ${targetModule.toUpperCase()} record "${recTitle.trim()}" to Firebase Cloud!`);
      }

      triggerCelebrationConfetti();
      setTimeout(() => setFormSavedBanner(null), 6000);

      setRecCode('');
      setRecTitle('');
      setRecSubtitle('');
      setRecCategory('');
      setRecNumeric('');
      setRecNotes('');
      setRecExtra1('');
      setRecExtra2('');
      setUploadedFileDataUrl('');
      setUploadedFileName('');
      setAdminMcqBank([]);
      setMcqQuestionText('');
    } finally {
      setSubmittingForm(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-3 px-2 sm:px-4">
      {/* ===================================================================
          NATIVE ANDROID MOBILE APP SHELL FOR ADMIN PORTAL
         =================================================================== */}
      <div
        className={`w-full max-w-[460px] mx-auto rounded-[42px] shadow-[0_25px_70px_rgba(2,6,23,0.85)] border-[6px] border-[#1D3B9E]/70 overflow-hidden flex flex-col h-[860px] max-h-[94vh] relative ${
          darkMode
            ? 'bg-gradient-to-br from-[#060F30] via-[#0B194C] to-[#081238] text-white'
            : 'bg-gradient-to-br from-[#DCE8FF] via-[#EAF1FF] to-[#D5E4FF] text-[#07164E]'
        }`}
      >
        {/* Top Native Android 14 Status Bar + Punch-Hole Camera */}
        <div className="bg-[#04145C] text-blue-100 px-6 pt-2.5 pb-1.5 flex items-center justify-between text-xs font-semibold shrink-0">
          <span>9:41</span>
          <div className="w-20 h-4 bg-black/90 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-slate-800 border border-slate-600" />
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span>5G</span>
            <span>VoLTE</span>
            <span>100%</span>
          </div>
        </div>

        {/* ===================================================================
            SLIDE-OVER NATIVE ANDROID 3D ROYAL BLUE DRAWER
           =================================================================== */}
        {sidebarOpen && (
          <div className="absolute inset-0 z-50 flex">
            <aside className="w-72 h-full bg-gradient-to-b from-[#04145C] via-[#08228B] to-[#030E42] text-white flex flex-col justify-between border-r-2 border-cyan-300/40 shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-cyan-400/20 to-transparent pointer-events-none" />

              <div className="relative z-10 flex-1 overflow-y-auto">
                {/* Glowing 3D WI Orb Logo Header */}
                <div className="pt-5 pb-3 px-4 flex items-center justify-between border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-b from-[#38BDF8] via-[#1D4ED8] to-[#061445] p-0.5 shadow-[0_0_20px_rgba(56,189,248,0.75)] border border-cyan-200 flex items-center justify-center shrink-0">
                      <div className="w-full h-full rounded-full bg-gradient-to-b from-[#0A2472] to-[#040D33] flex flex-col items-center justify-center">
                        <GraduationCap className="w-3.5 h-3.5 text-amber-300 -mb-0.5" />
                        <span className="font-display font-black text-sm tracking-tight text-white">
                          WI
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="font-display font-black text-xs tracking-wider text-white">
                        WAQAR INSTITUTE
                      </div>
                      <div className="text-[9px] text-cyan-200 font-semibold">
                        Welcome to Waqar Computer Institute
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 17 Main Navigation Pills */}
                <nav className="p-2.5 space-y-1">
                  {sidebarItems.map((item) => {
                    const IconComp = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (item.id === 'notifications') {
                            setSeenNotifCount(notifications.length);
                          }
                          setActiveSection(item.id);
                          setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-[#0EA5E9] via-[#2563EB] to-[#3B82F6] text-white shadow-[0_6px_18px_rgba(37,99,235,0.75)] border border-cyan-200/60'
                            : 'text-blue-100/85 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                              isActive ? 'bg-white/25 text-white' : 'text-cyan-300'
                            }`}
                          >
                            <IconComp className="w-4 h-4 shrink-0" />
                          </div>
                          <span className="whitespace-nowrap">{item.label}</span>
                        </div>
                        {isActive && <ChevronRight className="w-4 h-4 text-white" />}
                        {!isActive && typeof item.count === 'number' && item.count > 0 && (
                          <span
                            className={`font-mono text-[10px] px-2 py-0.5 rounded-full text-white font-extrabold tabular-nums ${
                              item.badgeColor || 'bg-blue-500/40'
                            }`}
                          >
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Bottom Logout Button (Android Kotlin & APK button removed per request) */}
              <div className="relative z-10 p-3 border-t border-white/10">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold bg-red-500/20 hover:bg-red-500/35 text-red-200 border border-red-400/30 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            </aside>
            <div
              onClick={() => setSidebarOpen(false)}
              className="flex-1 bg-black/50 backdrop-blur-xs"
            />
          </div>
        )}

        {/* ===================================================================
            MAIN SCROLLABLE ANDROID APP WORKSPACE
           =================================================================== */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Top Compact Mobile App Header Bar */}
          <header
            className={`rounded-3xl ${
              darkMode
                ? 'bg-[#0C1D5E]/90 border-blue-800 text-white'
                : 'bg-white/95 border-white text-[#07164E]'
            } backdrop-blur-md border-2 px-3.5 py-2.5 shadow-md space-y-2.5`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="w-9 h-9 rounded-2xl bg-blue-50 hover:bg-blue-100 text-[#07164E] flex items-center justify-center shadow-sm cursor-pointer shrink-0"
                  title="Open Android Drawer"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div>
                  <div className="font-display font-black text-sm tracking-wide text-[#07164E] dark:text-white leading-none">
                    WAQAR INSTITUTE
                  </div>
                  <div className="text-[10px] font-semibold italic text-blue-700 dark:text-cyan-300 mt-0.5">
                    Welcome to Waqar Computer Institute
                  </div>
                </div>
              </div>

              {/* Right Notification Bell (Resets immediately to 0 on click), Settings Icon & Admin Avatar */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleOpenNotifications}
                  className="relative w-9 h-9 rounded-full bg-[#EEF4FF] hover:bg-blue-100 text-[#07164E] flex items-center justify-center shadow-sm cursor-pointer"
                  title="Notifications (Click to mark all seen & reset to 0)"
                >
                  <Bell className="w-4 h-4 text-blue-800" />
                  <span
                    className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[9px] font-extrabold flex items-center justify-center shadow ${
                      unreadNotifCount > 0 ? 'bg-rose-500' : 'bg-emerald-600'
                    }`}
                  >
                    {unreadNotifCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAdminSearch((prev) => !prev)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors cursor-pointer ${
                    showAdminSearch
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-[#EEF4FF] text-blue-800 border-blue-200 hover:bg-blue-100'
                  }`}
                  title="Search Student ID, Course, Receipt"
                >
                  <Search className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setActiveSection('settings')}
                  className="relative rounded-full bg-[#EEF4FF] hover:bg-blue-100 text-[#07164E] flex items-center justify-center shadow-sm cursor-pointer"
                  title="Admin Settings (Credentials & Connect Student-Parent ID)"
                >
                  <FireRingCanvas active={activeSection === 'settings'} size={36}>
                    <Settings className="w-4 h-4 text-blue-800" />
                  </FireRingCanvas>
                </button>

                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#1D4ED8] to-[#38BDF8] p-0.5 shadow-md">
                  <div className="w-full h-full rounded-full bg-[#07164E] text-white font-display font-extrabold text-xs flex items-center justify-center">
                    {userProfile.displayName.charAt(0).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            {/* Click-to-Open Search Bar (Only expands when Search icon is clicked) */}
            {showAdminSearch && (
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Search Student ID, Course, Receipt..."
                  autoFocus
                  className="w-full pl-9 pr-8 py-1.5 rounded-full bg-[#EEF4FF] border border-blue-200 text-xs text-[#07164E] placeholder-slate-500 focus:outline-none focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    setGlobalSearch('');
                    setShowAdminSearch(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Close Search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </header>

        {/* Sub-Bar: All Branches Pill + Scan QR Attendance Button + Dark Mode Pill */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-white/90 border-2 border-white rounded-full px-4 py-1.5 shadow-md">
              <Building2 className="w-4 h-4 text-blue-700" />
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="bg-transparent text-xs font-extrabold text-[#07164E] focus:outline-none cursor-pointer"
              >
                <option value="ALL">
                  All Branches ({String(branches.length || 1).padStart(2, '0')})
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.code}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Instant Real QR Attendance Scanner Trigger in Admin Portal */}
            <button
              type="button"
              onClick={() => setAdminScannerOpen(true)}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-extrabold shadow-md flex items-center gap-1.5 cursor-pointer border border-emerald-200"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Scan Attendance QR Code</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[#0F1E56] to-[#1E3A8A] text-white text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer border border-blue-300/40"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-cyan-200" />}
            <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>

        {/* Real QR Scan Toast Notification */}
        {adminQrScanBanner && (
          <div className="p-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-extrabold shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{adminQrScanBanner}</span>
            </div>
            <button onClick={() => setAdminQrScanBanner(null)} className="text-white/80 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ===================================================================
            SECTION 1: 3D EXECUTIVE DASHBOARD (Matching Uploaded Image 1)
           =================================================================== */}
        {activeSection === 'dashboard' && (
          <div className="space-y-4">
            {/* 3D HERO BANNER WITH CAMPUS + GRADUATION CAP & DIPLOMA + CUSTOM HEADING */}
            <div className="relative rounded-[28px] overflow-hidden bg-gradient-to-r from-[#0D329E] via-[#1B4DE4] to-[#3B27BA] text-white shadow-[0_18px_40px_rgba(27,77,228,0.45)] border-2 border-white/80 min-h-[168px] flex flex-col md:flex-row items-center justify-between px-6 py-5 gap-4">
              {/* Left Campus Architectural Visual */}
              <div className="flex items-center gap-4 z-10">
                <div className="hidden sm:flex w-44 h-28 rounded-2xl bg-gradient-to-b from-sky-300 via-sky-100 to-emerald-100 p-2 shadow-inner border-2 border-white/70 items-end justify-center relative overflow-hidden shrink-0">
                  <svg viewBox="0 0 200 120" className="w-full h-full">
                    {/* Sky & Sun */}
                    <circle cx="35" cy="24" r="12" fill="#FDE047" opacity="0.9" />
                    {/* Campus Main Building */}
                    <rect x="28" y="34" width="144" height="72" rx="4" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
                    <rect x="68" y="20" width="64" height="86" rx="4" fill="#F8FAFC" stroke="#64748B" strokeWidth="2" />
                    {/* Blue Glass Windows */}
                    <rect x="38" y="44" width="20" height="16" rx="2" fill="#0284C7" />
                    <rect x="38" y="66" width="20" height="16" rx="2" fill="#0284C7" />
                    <rect x="80" y="32" width="16" height="16" rx="2" fill="#0369A1" />
                    <rect x="104" y="32" width="16" height="16" rx="2" fill="#0369A1" />
                    <rect x="80" y="54" width="16" height="16" rx="2" fill="#0369A1" />
                    <rect x="104" y="54" width="16" height="16" rx="2" fill="#0369A1" />
                    <rect x="142" y="44" width="20" height="16" rx="2" fill="#0284C7" />
                    <rect x="142" y="66" width="20" height="16" rx="2" fill="#0284C7" />
                    {/* Entrance Arch */}
                    <rect x="88" y="78" width="24" height="28" rx="3" fill="#1E3A8A" />
                    {/* Green Campus Lawn */}
                    <rect x="0" y="104" width="200" height="16" fill="#16A34A" />
                  </svg>
                </div>

                {/* Center Custom Welcome Heading requested by user */}
                <div className="text-center md:text-left">
                  <span className="inline-block px-3 py-0.5 rounded-full bg-white/15 border border-cyan-300/40 text-[10px] font-extrabold uppercase tracking-widest text-cyan-200 mb-1">
                    WAQAR INSTITUTE
                  </span>
                  <h1 className="font-display font-black text-2xl sm:text-3xl tracking-wide text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.35)]">
                    Welcome to Waqar Computer Institute
                  </h1>
                  <p className="font-display font-extrabold text-base sm:text-lg text-amber-300 mt-0.5 drop-shadow">
                    Enjoy Your Journey
                  </p>
                  <p className="text-xs text-blue-100 font-medium mt-0.5">
                    Smart Education • Better Future
                  </p>

                  {/* Carousel Dots */}
                  <div className="flex items-center justify-center md:justify-start gap-1.5 mt-2.5">
                    <span className="w-2 h-2 rounded-full bg-white/50" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_#fff]" />
                    <span className="w-2 h-2 rounded-full bg-white/50" />
                    <span className="w-2 h-2 rounded-full bg-white/50" />
                  </div>
                </div>
              </div>

              {/* Right 3D Graduation Cap & Diploma Scroll Illustration */}
              <div className="z-10 shrink-0">
                <svg viewBox="0 0 180 120" className="w-40 h-28 drop-shadow-[0_14px_20px_rgba(0,0,0,0.45)]">
                  {/* 3D Graduation Cap */}
                  <polygon points="90,14 156,38 90,62 24,38" fill="#1E1B4B" stroke="#818CF8" strokeWidth="2" />
                  <path d="M54,49 L54,74 C54,84 126,84 126,74 L126,49" fill="#312E81" stroke="#6366F1" strokeWidth="1.5" />
                  <path d="M90,38 L138,52 L138,82" stroke="#FBBF24" strokeWidth="3.5" fill="none" strokeLinecap="round" />
                  <circle cx="138" cy="84" r="4.5" fill="#F59E0B" />
                  {/* Rolled Golden Diploma Scroll with Red Ribbon */}
                  <rect x="42" y="78" width="88" height="22" rx="11" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" transform="rotate(-8 86 89)" />
                  <rect x="78" y="76" width="14" height="24" rx="3" fill="#EF4444" transform="rotate(-8 86 89)" />
                </svg>
              </div>
            </div>

            {/* 4 GLOSSY 3D GRADIENT ACTION BUTTONS (Matching Uploaded Image 1) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <button
                onClick={() => setActiveSection('students')}
                className="group p-4 rounded-[24px] bg-gradient-to-b from-[#3B82F6] via-[#2563EB] to-[#1D4ED8] text-white shadow-[0_12px_25px_rgba(37,99,235,0.45),inset_0_2px_4px_rgba(255,255,255,0.55)] border-2 border-blue-300/80 flex items-center gap-3.5 transition-transform hover:scale-[1.01] active:scale-98 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/40 flex items-center justify-center shadow-inner">
                  <UserPlus className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-display font-extrabold text-sm sm:text-base leading-tight">
                    + Add Student
                  </div>
                  <div className="text-[11px] text-blue-100">Create ID &amp; Password</div>
                </div>
              </button>

              <button
                onClick={() => setActiveSection('courses')}
                className="group p-4 rounded-[24px] bg-gradient-to-b from-[#A855F7] via-[#9333EA] to-[#6B21A8] text-white shadow-[0_12px_25px_rgba(147,51,234,0.45),inset_0_2px_4px_rgba(255,255,255,0.55)] border-2 border-purple-300/80 flex items-center gap-3.5 transition-transform hover:scale-[1.01] active:scale-98 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/40 flex items-center justify-center shadow-inner">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-display font-extrabold text-sm sm:text-base leading-tight">
                    + Create Course
                  </div>
                  <div className="text-[11px] text-purple-100">ADCA, DCA, Tally</div>
                </div>
              </button>

              <button
                onClick={() => setActiveSection('batches')}
                className="group p-4 rounded-[24px] bg-gradient-to-b from-[#22C55E] via-[#16A34A] to-[#15803D] text-white shadow-[0_12px_25px_rgba(22,163,74,0.45),inset_0_2px_4px_rgba(255,255,255,0.55)] border-2 border-emerald-300/80 flex items-center gap-3.5 transition-transform hover:scale-[1.01] active:scale-98 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/40 flex items-center justify-center shadow-inner">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-display font-extrabold text-sm sm:text-base leading-tight">
                    + Create Batch
                  </div>
                  <div className="text-[11px] text-emerald-100">Schedule Timings</div>
                </div>
              </button>

              <button
                onClick={() => setActiveSection('fees')}
                className="group p-4 rounded-[24px] bg-gradient-to-b from-[#FBBF24] via-[#F59E0B] to-[#D97706] text-white shadow-[0_12px_25px_rgba(245,158,11,0.45),inset_0_2px_4px_rgba(255,255,255,0.65)] border-2 border-amber-200/90 flex items-center gap-3.5 transition-transform hover:scale-[1.01] active:scale-98 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/25 border border-white/50 flex items-center justify-center shadow-inner">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-display font-extrabold text-sm sm:text-base leading-tight">
                    + Record Fee Receipt
                  </div>
                  <div className="text-[11px] text-amber-50">Cash / UPI / Bank</div>
                </div>
              </button>
            </div>

            {/* 9 GLOSSY 3D KPI CARDS WITH CIRCULAR ICONS & WAVE ACCENTS (3x3 Grid Matching Image 1) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  label: 'Total Students',
                  value: students.length,
                  target: 'students' as AdminSection,
                  icon: Users,
                  orbGrad: 'from-blue-400 via-blue-600 to-indigo-700',
                  waveColor: 'from-blue-500 to-cyan-400',
                },
                {
                  label: 'Active Courses',
                  value: courses.length,
                  target: 'courses' as AdminSection,
                  icon: Play,
                  orbGrad: 'from-emerald-400 via-emerald-600 to-teal-700',
                  waveColor: 'from-emerald-500 to-teal-400',
                },
                {
                  label: 'Running Batches',
                  value: batches.length,
                  target: 'batches' as AdminSection,
                  icon: FolderKanban,
                  orbGrad: 'from-purple-400 via-purple-600 to-indigo-700',
                  waveColor: 'from-purple-500 to-indigo-400',
                },
                {
                  label: 'Total Teachers',
                  value: teachers.length,
                  target: 'teachers' as AdminSection,
                  icon: UserCheck,
                  orbGrad: 'from-amber-400 via-orange-500 to-EA580C',
                  waveColor: 'from-orange-500 to-amber-400',
                },
                {
                  label: 'New Admissions',
                  value: admissions.length,
                  target: 'admissions' as AdminSection,
                  icon: Building2,
                  orbGrad: 'from-cyan-400 via-sky-500 to-blue-600',
                  waveColor: 'from-sky-500 to-cyan-400',
                },
                {
                  label: 'Examinations',
                  value: examinations.length,
                  target: 'examinations' as AdminSection,
                  icon: FileText,
                  orbGrad: 'from-pink-400 via-rose-500 to-red-600',
                  waveColor: 'from-rose-500 to-pink-400',
                },
                {
                  label: 'Fee Collected',
                  value: `₹${totalFeeCollected.toLocaleString('en-IN')}`,
                  target: 'fees' as AdminSection,
                  icon: Wallet,
                  orbGrad: 'from-emerald-400 via-green-600 to-emerald-800',
                  waveColor: 'from-emerald-600 to-green-400',
                },
                {
                  label: 'Active Branches',
                  value: branches.length,
                  target: 'branches' as AdminSection,
                  icon: CheckCircle2,
                  orbGrad: 'from-violet-400 via-purple-600 to-indigo-800',
                  waveColor: 'from-purple-600 to-violet-400',
                },
                {
                  label: 'Certificates Issued',
                  value: certificates.length,
                  target: 'certificates' as AdminSection,
                  icon: Award,
                  orbGrad: 'from-sky-400 via-blue-600 to-indigo-700',
                  waveColor: 'from-blue-600 to-sky-400',
                },
              ].map((kpi) => {
                const KpiIcon = kpi.icon;
                return (
                  <button
                    key={kpi.label}
                    onClick={() => setActiveSection(kpi.target)}
                    className={`relative overflow-hidden text-left rounded-[26px] ${
                      darkMode
                        ? 'bg-[#0F236B]/90 border-blue-700/70 text-white'
                        : 'bg-gradient-to-b from-white via-[#F8FAFF] to-[#EEF4FF] border-white text-[#07164E]'
                    } border-2 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.08),inset_0_2px_4px_rgba(255,255,255,0.9)] hover:scale-[1.01] transition-all cursor-pointer flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-4 z-10">
                      <div
                        className={`w-14 h-14 rounded-full bg-gradient-to-br ${kpi.orbGrad} text-white flex items-center justify-center shadow-[0_8px_18px_rgba(0,0,0,0.22),inset_0_2px_4px_rgba(255,255,255,0.5)] border-2 border-white/80 shrink-0`}
                      >
                        <KpiIcon className="w-7 h-7" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-slate-600 dark:text-blue-200 leading-tight">
                          {kpi.label}
                        </div>
                        <div className="font-mono font-black text-2xl sm:text-3xl mt-1 tabular-nums">
                          {kpi.value}
                        </div>
                      </div>
                    </div>

                    <div className="z-10 self-end">
                      <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        ↑ +0%
                      </span>
                    </div>

                    {/* Glossy Bottom Wave Accent Bar */}
                    <div
                      className={`absolute bottom-0 inset-x-0 h-2 bg-gradient-to-r ${kpi.waveColor}`}
                    />
                  </button>
                );
              })}
            </div>

            {/* ===================================================================
                QUICK NAVIGATION STRIP WITH FIRE RING ACTIVE ANIMATION
                (Settings contains Admin ID/Password + Connect Student & Parent ID;
                 Attendance contains Real QR Code Generator & Batch Attendance)
               =================================================================== */}
            <div
              className={`rounded-[26px] ${
                darkMode ? 'bg-[#0F236B]/90 border-blue-700' : 'bg-white border-white'
              } border-2 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] grid grid-cols-2 sm:grid-cols-4 gap-3`}
            >
              <button
                type="button"
                onClick={() => setActiveSection('live_class')}
                className="p-3 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[#07164E] flex items-center gap-2.5 cursor-pointer text-left"
              >
                <Video className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <div className="font-display font-extrabold text-xs">Agora Live Class</div>
                  <div className="text-[10px] text-slate-500">Video/Audio &amp; Chat</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('attendance')}
                className="p-3 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#07164E] flex items-center gap-2.5 cursor-pointer text-left"
              >
                <QrCode className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <div className="font-display font-extrabold text-xs">QR &amp; Attendance</div>
                  <div className="text-[10px] text-slate-500">Generate 5m QR + Save</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('ai_tutor')}
                className="p-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[#07164E] flex items-center gap-2.5 cursor-pointer text-left"
              >
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <div className="font-display font-extrabold text-xs">AI Tutor</div>
                  <div className="text-[10px] text-slate-500">3.8 Flash &amp; File Solver</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('settings')}
                className="p-3 rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[#07164E] flex items-center gap-2.5 cursor-pointer text-left"
              >
                <Settings className="w-5 h-5 text-purple-600 shrink-0" />
                <div>
                  <div className="font-display font-extrabold text-xs">Admin Settings</div>
                  <div className="text-[10px] text-slate-500">Admin ID &amp; Link Parent</div>
                </div>
              </button>
            </div>

            {/* BOTTOM SPLIT: RECENT REAL FIRESTORE OPERATIONS & QUICK TOOLS 6-TILE GRID (Matching Image 1) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left 7 Cols: Recent Real Firestore Operations */}
              <div
                className={`lg:col-span-7 rounded-[26px] ${
                  darkMode ? 'bg-[#0F236B]/90 border-blue-700' : 'bg-white border-white'
                } border-2 overflow-hidden shadow-[0_12px_28px_rgba(15,23,42,0.08)]`}
              >
                <div className="px-5 py-3.5 bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#818CF8] text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-200" />
                    <h2 className="font-display font-extrabold text-sm">
                      Recent Real Firestore Operations ({erpRecords.length})
                    </h2>
                  </div>
                  <button
                    onClick={() => setActiveSection('reports')}
                    className="px-3 py-1 rounded-full bg-white text-[#1E1B4B] text-[11px] font-extrabold flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <span>View All</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-4 space-y-2.5 max-h-72 overflow-y-auto">
                  {erpRecords.length === 0 ? (
                    <div className="py-10 text-center text-slate-500 text-xs">
                      No operational records in Firestore yet. Create a Student, Course, Batch, or scan a QR code above.
                    </div>
                  ) : (
                    erpRecords.slice(0, 8).map((rec) => (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-[#F4F7FF] border border-blue-100 text-[#07164E]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-700 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-display font-extrabold text-xs text-[#07164E]">
                              [{rec.module.toUpperCase()}] {rec.title} ({rec.code})
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {rec.subtitle} • {rec.dateStr}
                            </div>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-[11px] font-extrabold">
                          {rec.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right 5 Cols: Quick Tools 6-Tile 3D Grid matching Image 1 */}
              <div
                className={`lg:col-span-5 rounded-[26px] ${
                  darkMode ? 'bg-[#0F236B]/90 border-blue-700' : 'bg-white border-white'
                } border-2 overflow-hidden shadow-[0_12px_28px_rgba(15,23,42,0.08)] flex flex-col`}
              >
                <div className="px-5 py-3.5 bg-gradient-to-r from-[#1E3A8A] via-[#2563EB] to-[#60A5FA] text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-cyan-200" />
                    <h2 className="font-display font-extrabold text-sm">Quick Tools</h2>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/80" />
                </div>

                <div className="p-4 grid grid-cols-3 gap-3 flex-1 items-center">
                  {[
                    {
                      label: 'Reports',
                      icon: BarChart3,
                      grad: 'from-emerald-400 via-emerald-500 to-green-600',
                      onClick: () => setActiveSection('reports'),
                    },
                    {
                      label: 'Analytics',
                      icon: PieChart,
                      grad: 'from-sky-400 via-blue-500 to-indigo-600',
                      onClick: () => setActiveSection('reports'),
                    },
                    {
                      label: 'Backup',
                      icon: CloudUpload,
                      grad: 'from-purple-400 via-purple-600 to-indigo-700',
                      onClick: () =>
                        handleExportCsv(
                          'waqar-cloud-backup',
                          erpRecords as unknown as Record<string, unknown>[]
                        ),
                    },
                    {
                      label: 'Scan QR',
                      icon: Camera,
                      grad: 'from-amber-400 via-orange-500 to-amber-600',
                      onClick: () => setAdminScannerOpen(true),
                    },
                    {
                      label: 'Export',
                      icon: Upload,
                      grad: 'from-cyan-400 via-teal-500 to-emerald-600',
                      onClick: () =>
                        handleExportCsv(
                          'waqar-erp-export',
                          erpRecords as unknown as Record<string, unknown>[]
                        ),
                    },
                    {
                      label: 'More',
                      icon: MoreHorizontal,
                      grad: 'from-pink-400 via-rose-500 to-red-600',
                      onClick: () => setActiveSection('settings'),
                    },
                  ].map((tool) => {
                    const ToolIcon = tool.icon;
                    return (
                      <button
                        key={tool.label}
                        type="button"
                        onClick={tool.onClick}
                        className={`p-3.5 rounded-2xl bg-gradient-to-b ${tool.grad} text-white shadow-[0_8px_18px_rgba(0,0,0,0.18),inset_0_2px_3px_rgba(255,255,255,0.5)] border border-white/60 flex flex-col items-center justify-center gap-1.5 hover:scale-105 transition-transform cursor-pointer`}
                      >
                        <ToolIcon className="w-6 h-6" />
                        <span className="font-display font-extrabold text-xs">{tool.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            SECTION: BRANCHES
           =================================================================== */}
        {activeSection === 'branches' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-blue-100 shadow-md text-[#07164E]">
              <h2 className="font-display font-bold text-base mb-4">Create Institute Branch</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!branchCode.trim() || !branchName.trim()) return;
                  await onCreateBranch({
                    code: sanitizeId(branchCode),
                    name: branchName.trim(),
                    address: branchAddress.trim() || 'Main Campus Road',
                    phone: branchPhone.trim() || '+91-0000000000',
                    email: branchEmail.trim() || userProfile.email,
                    managerName: branchManager.trim() || userProfile.displayName,
                    status: 'active',
                  });
                  setBranchCode('');
                  setBranchName('');
                  setBranchAddress('');
                }}
                className="space-y-3"
              >
                <input
                  type="text"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  placeholder="Branch Code (e.g. MAIN-BRANCH or BR-01)"
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="Branch Name (e.g. WAQAR INSTITUTE Main Campus)"
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                />
                <input
                  type="text"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  placeholder="Branch Full Address"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={branchPhone}
                    onChange={(e) => setBranchPhone(e.target.value)}
                    placeholder="Contact Number"
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <input
                    type="text"
                    value={branchManager}
                    onChange={(e) => setBranchManager(e.target.value)}
                    placeholder="Branch Manager Name"
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-bold text-xs cursor-pointer"
                >
                  Save Branch to Firestore
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 bg-white p-5 rounded-3xl border border-blue-100 shadow-md text-[#07164E]">
              <h2 className="font-display font-bold text-base mb-4">
                Registered Institute Branches ({branches.length})
              </h2>
              <div className="space-y-3">
                {branches.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-display font-bold text-sm">
                        {b.name} ({b.code})
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Address: {b.address} • Manager: {b.managerName} • Phone: {b.phone}
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteBranch(b.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            SECTION: COURSES
           =================================================================== */}
        {activeSection === 'courses' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-blue-100 shadow-md text-[#07164E]">
              <h2 className="font-display font-bold text-base mb-4">
                Create Course (ADCA, DCA, Tally Prime, MS Office...)
              </h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!courseCode.trim() || !courseName.trim()) return;
                  await onCreateCourse({
                    code: sanitizeId(courseCode),
                    name: courseName.trim(),
                    category: courseCategory.trim() || 'Diploma',
                    duration: courseDuration.trim() || '12 Months',
                    fee: Number(courseFee) || 0,
                    syllabus:
                      courseSyllabus.trim() ||
                      'Computer Fundamentals, MS Office, Tally Prime, Practical Project',
                    description: courseDesc.trim() || courseName.trim(),
                    branchId: branches[0]?.code || 'MAIN-BRANCH',
                    status: 'active',
                  });
                  setCourseCode('');
                  setCourseName('');
                  setCourseFee('');
                  setCourseSyllabus('');
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="Course Code (e.g. ADCA)"
                    required
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={courseDuration}
                    onChange={(e) => setCourseDuration(e.target.value)}
                    placeholder="Duration (e.g. 12 Months)"
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <input
                  type="text"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="Full Course Title"
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={courseFee}
                    onChange={(e) => setCourseFee(e.target.value)}
                    placeholder="Total Course Fee (₹)"
                    required
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={courseCategory}
                    onChange={(e) => setCourseCategory(e.target.value)}
                    placeholder="Category (Diploma / Accounting)"
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <textarea
                  value={courseSyllabus}
                  onChange={(e) => setCourseSyllabus(e.target.value)}
                  placeholder="Syllabus Modules & Practical Topics"
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-display font-bold text-xs cursor-pointer"
                >
                  Publish Course to Firestore
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 bg-white p-5 rounded-3xl border border-blue-100 shadow-md text-[#07164E]">
              <h2 className="font-display font-bold text-base mb-4">
                Active Institute Courses ({courses.length})
              </h2>
              <div className="space-y-3">
                {courses.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-display font-bold text-sm">
                        {c.code} — {c.name}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Duration: {c.duration} • Fee: ₹{c.fee.toLocaleString('en-IN')} • Category:{' '}
                        {c.category}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">{c.syllabus}</div>
                    </div>
                    <button
                      onClick={() => onDeleteCourse(c.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            SECTION: BATCHES (24-Hour Time Schedule + Add Students + Batch Admin)
           =================================================================== */}
        {activeSection === 'batches' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-blue-100 shadow-md text-[#07164E]">
              <h2 className="font-display font-bold text-base mb-1">
                Create Class Batch (24-Hour Time &amp; Student Selection)
              </h2>
              <p className="text-[11px] text-slate-500 mb-3">
                Schedule batch timing anywhere in 24 hours, assign a Batch Admin / Teacher, and add students directly into the batch.
              </p>

              {batchSavedBanner && (
                <div className="mb-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold">
                  {batchSavedBanner}
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!batchCode.trim() || !batchName.trim()) return;
                  const cleanBatchCode = sanitizeId(batchCode);
                  const matchedCourse = courses.find(
                    (c) => c.code === batchCourseId || c.id === batchCourseId
                  );
                  const formatted24hTiming = `${batchStart24h || '10:00'} - ${
                    batchEnd24h || '11:00'
                  } (24h)${batchAdminName.trim() ? ` • Batch Admin: ${batchAdminName.trim()}` : ''}`;

                  await onCreateBatch({
                    code: cleanBatchCode,
                    name: batchName.trim(),
                    courseId: matchedCourse?.code || batchCourseId.trim() || courses[0]?.code || 'COURSE',
                    courseName:
                      matchedCourse?.name || batchCourseId.trim() || courses[0]?.name || 'Computer Course',
                    teacherId: batchAdminName.trim() || 'WI-TCH-01',
                    teacherName: batchTeacherName.trim() || userProfile.displayName,
                    branchId: branches[0]?.code || 'MAIN-BRANCH',
                    timing: formatted24hTiming,
                    capacity: Number(batchCapacity) || 30,
                    startDate: batchStartDate || new Date().toISOString().split('T')[0],
                    status: 'active',
                  });

                  // Also save batch student assignment record if students were selected
                  if (batchSelectedStudents.length > 0) {
                    await onCreateErpRecord({
                      module: 'timetable',
                      code: sanitizeId(`BCH-STU-${cleanBatchCode}`, 64),
                      title: `Batch ${batchName.trim()} (${cleanBatchCode}) Roster`,
                      subtitle: `Batch Admin: ${batchAdminName.trim() || batchTeacherName.trim() || userProfile.displayName}`,
                      category: matchedCourse?.code || batchCourseId.trim() || 'BATCH',
                      status: 'Active',
                      branchId: branches[0]?.code || 'MAIN-BRANCH',
                      courseId: matchedCourse?.code || batchCourseId.trim() || 'COURSE',
                      batchId: cleanBatchCode,
                      targetUserId: batchSelectedStudents.join(','),
                      numericValue: batchSelectedStudents.length,
                      secondaryNumericValue: Number(batchCapacity) || 30,
                      dateStr: new Date().toISOString().split('T')[0],
                      notes: `Students in Batch: ${batchSelectedStudents.join(', ')} • 24h Time: ${batchStart24h}-${batchEnd24h}`,
                      extra1: batchStart24h,
                      extra2: batchEnd24h,
                      extra3: batchAdminName.trim() || batchTeacherName.trim(),
                      extra4: batchSelectedStudents.join(','),
                      visibility: 'institute',
                    });
                  }

                  triggerCelebrationConfetti();
                  setBatchSavedBanner(
                    `✓ Created Batch "${batchName.trim()} (${cleanBatchCode})" for ${batchStart24h}–${batchEnd24h} (24h) with ${batchSelectedStudents.length} assigned students!`
                  );
                  setBatchCode('');
                  setBatchName('');
                  setBatchSelectedStudents([]);
                  setTimeout(() => setBatchSavedBanner(null), 6000);
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={batchCode}
                    onChange={(e) => setBatchCode(e.target.value)}
                    placeholder="Batch Code (e.g. BATCH-A1)"
                    required
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="Batch Name (e.g. Morning A1)"
                    required
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={batchCourseId}
                    onChange={(e) => setBatchCourseId(e.target.value)}
                    placeholder="Course Code / Name"
                    list="batch-courses-datalist"
                    required
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <datalist id="batch-courses-datalist">
                    {courses.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.name} ({c.duration})
                      </option>
                    ))}
                  </datalist>

                  <input
                    type="text"
                    value={batchTeacherName}
                    onChange={(e) => setBatchTeacherName(e.target.value)}
                    placeholder="Assigned Teacher Name / ID"
                    list="batch-teachers-datalist"
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <datalist id="batch-teachers-datalist">
                    {teachers.map((t) => (
                      <option key={t.id} value={t.title}>
                        {t.code}
                      </option>
                    ))}
                  </datalist>
                </div>

                {/* 24-Hour Batch Timing Selector */}
                <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-[#07164E]">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-700" />
                      <span>24-Hour Batch Time Window</span>
                    </span>
                    <span className="font-mono text-[11px] text-emerald-800">
                      {batchStart24h} – {batchEnd24h} (24h)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Start Time (24h)
                      </label>
                      <input
                        type="time"
                        value={batchStart24h}
                        onChange={(e) => {
                          setBatchStart24h(e.target.value);
                          setBatchTiming(`${e.target.value} - ${batchEnd24h} (24h)`);
                        }}
                        required
                        className="w-full px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        End Time (24h)
                      </label>
                      <input
                        type="time"
                        value={batchEnd24h}
                        onChange={(e) => {
                          setBatchEnd24h(e.target.value);
                          setBatchTiming(`${batchStart24h} - ${e.target.value} (24h)`);
                        }}
                        required
                        className="w-full px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Batch Admin Selection */}
                <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-1.5">
                  <label className="block text-xs font-extrabold text-[#07164E]">
                    Assign Batch Admin (Handles All Students of This Batch Together)
                  </label>
                  <input
                    type="text"
                    value={batchAdminName}
                    onChange={(e) => setBatchAdminName(e.target.value)}
                    placeholder="Batch Admin / Coordinator Name or ID"
                    list="batch-admin-candidates"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-blue-200 text-xs"
                  />
                  <datalist id="batch-admin-candidates">
                    {teachers.map((t) => (
                      <option key={t.id} value={`${t.title} (${t.code})`} />
                    ))}
                    {students.map((s) => (
                      <option key={s.id} value={`${s.title} (${s.code})`} />
                    ))}
                  </datalist>
                </div>

                {/* Select & Add Students to Batch */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#07164E]">
                      Add Students to Batch ({batchSelectedStudents.length} Selected)
                    </span>
                    {students.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setBatchSelectedStudents(
                            batchSelectedStudents.length === students.length
                              ? []
                              : students.map((s) => s.code)
                          )
                        }
                        className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer"
                      >
                        {batchSelectedStudents.length === students.length
                          ? 'Clear All'
                          : 'Select All Students'}
                      </button>
                    )}
                  </div>
                  {students.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      No students created yet. Add students in the Students tab first.
                    </p>
                  ) : (
                    <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                      {students.map((stu) => {
                        const checked = batchSelectedStudents.includes(stu.code);
                        return (
                          <label
                            key={stu.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs cursor-pointer hover:bg-blue-50/50"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setBatchSelectedStudents((prev) =>
                                    checked
                                      ? prev.filter((id) => id !== stu.code)
                                      : [...prev, stu.code]
                                  )
                                }
                              />
                              <span className="font-bold text-[#07164E]">{stu.title}</span>
                            </div>
                            <span className="font-mono text-[10px] text-blue-700">{stu.code}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-bold text-xs cursor-pointer shadow"
                >
                  Create 24h Batch &amp; Save Student Roster in Firestore
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 bg-white p-5 rounded-3xl border border-blue-100 shadow-md text-[#07164E]">
              <h2 className="font-display font-bold text-base mb-4">
                Running Batches ({batches.length})
              </h2>
              <div className="space-y-3">
                {batches.map((b) => {
                  const rosterRec = erpRecords.find(
                    (r) => r.module === 'timetable' && r.batchId === b.code
                  );
                  return (
                    <div
                      key={b.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-display font-bold text-sm">
                          {b.name} ({b.code}) — {b.courseName}
                        </div>
                        <div className="text-xs text-slate-600">
                          24h Timing: <strong className="font-mono">{b.timing}</strong> • Teacher:{' '}
                          {b.teacherName} • Capacity: {b.capacity}
                        </div>
                        {rosterRec && (
                          <div className="text-[11px] text-emerald-700 font-bold mt-1">
                            ✓ {rosterRec.notes}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => onDeleteBatch(b.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            OPERATIONAL MODULE SECTIONS (Students, Admissions, Teachers, Attendance, Examinations, Results, Fees, Certificates, Notifications, Messages, Staff)
           =================================================================== */}
        {(
          [
            'students',
            'admissions',
            'teachers',
            'attendance',
            'examinations',
            'results',
            'fees',
            'certificates',
            'notifications',
            'messages',
            'staff',
          ] as const
        ).includes(activeSection as never) && (
          <div className="space-y-4">
            {/* When in Attendance section, show Real 5-Min QR Code Generator, Instant QR Camera Scanner & Batch-Wise Save Attendance */}
            {activeSection === 'attendance' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-6">
                    <RealQrGenerator
                      issuerName={userProfile.displayName}
                      issuerRole="ADMIN"
                      batches={batches}
                      students={students}
                      selectedBatch={adminQrBatch}
                      onSelectBatch={setAdminQrBatch}
                      onOpenScanner={() => setAdminScannerOpen(true)}
                    />
                  </div>
                  <div className="lg:col-span-6 bg-white rounded-3xl p-5 border border-blue-100 shadow-md text-[#07164E] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow">
                          <Camera className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-display font-extrabold text-base">
                            Admin Instant QR Attendance Scanner
                          </h3>
                          <p className="text-xs text-slate-500">
                            Scan any 5-minute QR Code to immediately mark real Student Attendance in Firebase Cloud Firestore.
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs space-y-1.5">
                        <div className="font-bold text-blue-900">
                          • Real `qrcode` + `jsQR` Verification (Valid for 5 Minutes)
                        </div>
                        <div className="text-slate-600">
                          • Zero fake or dummy attendance: Only real scanned or verified student logs are stored in Firestore.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdminScannerOpen(true)}
                      className="mt-4 w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-display font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Launch Admin QR Code Scanner Now</span>
                    </button>
                  </div>
                </div>

                {/* Batch-Wise Attendance Sheet with Present/Absent Toggles + SAVE ATTENDANCE Button */}
                <div className="bg-white rounded-3xl p-5 border border-blue-100 shadow-md text-[#07164E] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-display font-extrabold text-sm sm:text-base">
                        Batch Student Attendance Register (Select Present / Absent &amp; Save)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Select Present or Absent for each student and click Save Attendance to update Admin, Student &amp; Parent Portals.
                      </p>
                    </div>
                    <select
                      value={adminQrBatch}
                      onChange={(e) => setAdminQrBatch(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-[#EEF4FF] border border-blue-200 text-xs font-extrabold text-[#07164E]"
                    >
                      {batches.length > 0 ? (
                        batches.map((b) => (
                          <option key={b.id} value={b.code}>
                            {b.name} ({b.code})
                          </option>
                        ))
                      ) : (
                        <option value="ADCA-A1">Batch ADCA-A1</option>
                      )}
                    </select>
                  </div>

                  {adminBatchAttSavedMsg && (
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-extrabold">
                      {adminBatchAttSavedMsg}
                    </div>
                  )}

                  {students.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-500">
                      No students registered yet. Add students in the Students section first.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {students.map((stu) => {
                          const todayStr = new Date().toISOString().split('T')[0];
                          const existingToday = attendances.find(
                            (a) =>
                              (a.targetUserId === stu.code || a.code === stu.code) &&
                              a.dateStr === todayStr
                          );
                          const currentSel =
                            draftAdminAttendance[stu.code] ||
                            (existingToday?.status === 'Absent' ? 'Absent' : 'Present');
                          return (
                            <div
                              key={stu.id}
                              className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                            >
                              <div>
                                <div className="font-display font-bold text-xs text-[#07164E]">
                                  {stu.title}
                                </div>
                                <div className="text-[10px] font-mono text-slate-500">
                                  ID: {stu.code} • Batch: {adminQrBatch}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftAdminAttendance((prev) => ({
                                      ...prev,
                                      [stu.code]: 'Present',
                                    }))
                                  }
                                  className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer ${
                                    currentSel === 'Present'
                                      ? 'bg-emerald-600 text-white shadow'
                                      : 'bg-white text-emerald-700 border border-emerald-300'
                                  }`}
                                >
                                  ✓ Present
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftAdminAttendance((prev) => ({
                                      ...prev,
                                      [stu.code]: 'Absent',
                                    }))
                                  }
                                  className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer ${
                                    currentSel === 'Absent'
                                      ? 'bg-rose-600 text-white shadow'
                                      : 'bg-white text-rose-700 border border-rose-300'
                                  }`}
                                >
                                  ✗ Absent
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        disabled={savingAdminBatchAtt}
                        onClick={async () => {
                          setSavingAdminBatchAtt(true);
                          try {
                            const todayStr = new Date().toISOString().split('T')[0];
                            for (const stu of students) {
                              const statusChoice = draftAdminAttendance[stu.code] || 'Present';
                              await onCreateErpRecord({
                                module: 'attendance',
                                code: stu.code,
                                title: stu.title,
                                subtitle: `Batch: ${adminQrBatch} • Saved by Admin`,
                                category: 'Batch Attendance',
                                status: statusChoice,
                                branchId:
                                  selectedBranchFilter === 'ALL'
                                    ? branches[0]?.code || 'MAIN-BRANCH'
                                    : selectedBranchFilter,
                                courseId: stu.courseId || courses[0]?.code || 'COURSE',
                                batchId: adminQrBatch,
                                targetUserId: stu.code,
                                numericValue: statusChoice === 'Present' ? 100 : 0,
                                secondaryNumericValue: 1,
                                dateStr: todayStr,
                                notes: `Saved by Admin (${userProfile.displayName}) at ${new Date().toLocaleTimeString()}`,
                                extra1: stu.code,
                                extra2: statusChoice,
                                extra3: 'BATCH_SAVED',
                                extra4: '',
                                visibility: 'institute',
                              });
                            }
                            triggerCelebrationConfetti();
                            setAdminBatchAttSavedMsg(
                              `✓ Saved Attendance for all ${students.length} students in Batch ${adminQrBatch} to Cloud Firestore! Updated in Student & Parent Portals.`
                            );
                            setTimeout(() => setAdminBatchAttSavedMsg(null), 6000);
                          } finally {
                            setSavingAdminBatchAtt(false);
                          }
                        }}
                        className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-display font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>
                          {savingAdminBatchAtt
                            ? 'Submitting Full Batch Attendance to Firestore Cloud...'
                            : `⚡ Direct Submit All Batch (${adminQrBatch}) Attendance to Firestore Cloud`}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'staff' && (
              <div className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-2xl border border-slate-200">
                {(
                  [
                    { id: 'staff', label: 'Staff & HR' },
                    { id: 'parent', label: 'Parents Directory' },
                    { id: 'material', label: 'Study Materials' },
                    { id: 'assignment', label: 'Assignments' },
                    { id: 'timetable', label: 'Timetable' },
                    { id: 'library', label: 'Library Books' },
                    { id: 'event', label: 'Academic Calendar' },
                    { id: 'ticket', label: 'Support Tickets' },
                    { id: 'audit', label: 'Audit Logs' },
                  ] as { id: ErpModuleType; label: string }[]
                ).map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setOpsSubModule(sub.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      opsSubModule === sub.id
                        ? 'bg-[#07164E] text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}

            {(() => {
              const moduleMap: Record<
                string,
                {
                  mod: ErpModuleType;
                  title: string;
                  codeLabel: string;
                  titleLabel: string;
                  subLabel: string;
                  numLabel?: string;
                  showPasswordInput?: boolean;
                }
              > = {
                students: {
                  mod: 'student',
                  title: 'Add Student & Create Student Portal Login Password',
                  codeLabel: 'Student Username / ID (e.g. WI2026001)',
                  titleLabel: 'Student Full Name',
                  subLabel: 'Guardian Name & Mobile Number',
                  showPasswordInput: true,
                },
                admissions: {
                  mod: 'admission',
                  title: 'Admission & Enquiry Management',
                  codeLabel: 'Admission / Enquiry No (e.g. ADM-2026-01)',
                  titleLabel: 'Applicant Full Name',
                  subLabel: 'Selected Course & Batch',
                  numLabel: 'Admission Fee Paid (₹)',
                },
                teachers: {
                  mod: 'teacher',
                  title: 'Add Teacher & Create Teacher Portal Login Password',
                  codeLabel: 'Teacher Username / ID (e.g. WI-TCH-120)',
                  titleLabel: 'Teacher Full Name',
                  subLabel: 'Qualification & Assigned Courses',
                  showPasswordInput: true,
                },
                attendance: {
                  mod: 'attendance',
                  title: 'Real Attendance Register (Firestore Verified)',
                  codeLabel: 'Student ID (e.g. WI2026001)',
                  titleLabel: 'Student / Teacher Full Name',
                  subLabel: 'Batch & Course Code',
                },
                examinations: {
                  mod: 'exam',
                  title: 'Examination & Question Bank Management',
                  codeLabel: 'Exam Code (e.g. EXM-ADCA-01)',
                  titleLabel: 'Examination Title (e.g. Final Exam)',
                  subLabel: 'Course & Batch (e.g. ADCA Course)',
                  numLabel: 'Duration (Minutes)',
                },
                results: {
                  mod: 'result',
                  title: 'Result Processing & Merit List',
                  codeLabel: 'Result ID',
                  titleLabel: 'Course / Exam Name (e.g. ADCA)',
                  subLabel: 'Student Name & Student ID',
                  numLabel: 'Percentage Scored (0 - 100)',
                },
                fees: {
                  mod: 'fee',
                  title: 'Fee Receipt & Collection Register (Cash / UPI / Bank / Cheque)',
                  codeLabel: 'Receipt Number (e.g. RCP-2026-001)',
                  titleLabel: 'Student Name & ID',
                  subLabel: 'Course & Payment Mode (Cash / UPI / Bank)',
                  numLabel: 'Fee Amount (₹)',
                },
                certificates: {
                  mod: 'certificate',
                  title: 'Certificate Generation & QR Verification',
                  codeLabel: 'Certificate Number (e.g. CERT-WI-001)',
                  titleLabel: 'Student Full Name',
                  subLabel: 'Completed Course & Duration',
                },
                notifications: {
                  mod: 'notification',
                  title: 'Institute & Branch Notification Broadcast',
                  codeLabel: 'Notice ID',
                  titleLabel: 'Notification Headline',
                  subLabel: 'Target Audience (All / Students / Teachers)',
                },
                messages: {
                  mod: 'message',
                  title: 'Institute Messaging & Communication Center',
                  codeLabel: 'Message ID',
                  titleLabel: 'Subject / Recipient Name',
                  subLabel: 'Role / Branch',
                },
                staff: {
                  mod: opsSubModule,
                  title: `Operational Module: ${opsSubModule.toUpperCase()}`,
                  codeLabel: 'Record Code / Login ID',
                  titleLabel: 'Primary Title / Full Name',
                  subLabel: 'Department / Course / Subtitle',
                  showPasswordInput: opsSubModule === 'parent',
                },
              };

              const cfg = moduleMap[activeSection] || moduleMap.students;
              const moduleList = filterByBranchAndSearch(
                erpRecords.filter((r) => r.module === cfg.mod)
              );

              return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Create Form */}
                  <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-blue-100 shadow-md text-[#07164E]">
                    <h2 className="font-display font-bold text-base mb-4">{cfg.title}</h2>

                    {formSavedBanner && (
                      <div className="mb-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-extrabold">
                        {formSavedBanner}
                      </div>
                    )}

                    <form
                      onSubmit={(e) => handleGenericRecordSubmit(e, cfg.mod)}
                      className="space-y-3"
                    >
                      {/* Gallery Photo Upload for Student / Teacher Creation OR Gallery/File Manager Upload for Assignments/Materials */}
                      {(cfg.mod === 'student' ||
                        cfg.mod === 'teacher' ||
                        cfg.mod === 'assignment' ||
                        cfg.mod === 'material') && (
                        <div className="p-3.5 rounded-2xl bg-[#EEF4FF] border border-blue-200 space-y-2">
                          <label className="text-xs font-extrabold text-[#07164E] flex items-center gap-2 cursor-pointer">
                            <ImageIcon className="w-4 h-4 text-blue-600" />
                            <span>
                              {cfg.mod === 'student'
                                ? 'Select Student Photo from Gallery'
                                : cfg.mod === 'teacher'
                                ? 'Select Teacher Photo from Gallery'
                                : 'Attach Assignment / Study File from Gallery or File Manager'}
                            </span>
                          </label>
                          <input
                            type="file"
                            accept={
                              cfg.mod === 'student' || cfg.mod === 'teacher'
                                ? 'image/*'
                                : 'image/*,.pdf,.doc,.docx,.txt,.ppt,.pptx'
                            }
                            onChange={handleGalleryOrFileChange}
                            className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                          />
                          {uploadedFileDataUrl && (
                            <div className="flex items-center gap-3 pt-1">
                              {uploadedFileDataUrl.startsWith('data:image') && (
                                <img
                                  src={uploadedFileDataUrl}
                                  alt="Uploaded preview"
                                  className="w-12 h-12 rounded-xl object-cover border border-blue-300 shadow-sm"
                                />
                              )}
                              <div className="text-[11px] font-bold text-emerald-700 truncate">
                                ✓ Attached: {uploadedFileName || 'Gallery Photo'}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* When creating a Teacher, assign a specific Batch so the Teacher only manages their assigned Batch */}
                      {cfg.mod === 'teacher' && (
                        <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-1.5">
                          <label className="block text-xs font-extrabold text-[#07164E]">
                            Assign Batch to Teacher (Teacher Can Only Handle Assigned Batch)
                          </label>
                          <select
                            value={teacherAssignedBatch}
                            onChange={(e) => setTeacherAssignedBatch(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-300 text-xs font-bold text-[#07164E]"
                          >
                            {batches.length > 0 ? (
                              batches.map((b) => (
                                <option key={b.id} value={b.code}>
                                  {b.name} ({b.code}) — {b.timing}
                                </option>
                              ))
                            ) : (
                              <option value="ADCA-A1">Batch ADCA-A1</option>
                            )}
                          </select>
                        </div>
                      )}

                      {/* Admin Fee Collection & Official Student Receipt Issuer (Only Admin can issue fee receipts to Students) */}
                      {cfg.mod === 'fee' && (
                        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-emerald-950">
                              Select Student to Issue Official Fee Receipt
                            </span>
                            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                              Syncs to Student Portal
                            </span>
                          </div>
                          <select
                            value={recTargetUser}
                            onChange={(e) => {
                              const chosenCode = e.target.value;
                              setRecTargetUser(chosenCode);
                              const stu = erpRecords.find(
                                (r) => r.module === 'student' && r.code === chosenCode
                              );
                              if (stu) {
                                setRecTitle(`${stu.title} (${stu.code})`);
                                setRecCategory(stu.category || 'ADCA');
                                setRecSubtitle(`${stu.category || 'ADCA'} • Paid via ${recExtra1 || 'UPI'}`);
                                setRecStatus('Paid');
                              }
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-300 text-xs font-bold text-[#07164E]"
                          >
                            <option value="">-- Choose Enrolled Student (or enter below) --</option>
                            {erpRecords
                              .filter((r) => r.module === 'student')
                              .map((stu) => (
                                <option key={stu.id} value={stu.code}>
                                  {stu.title} (ID: {stu.code}) — {stu.category}
                                </option>
                              ))}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={recTargetUser}
                              onChange={(e) => setRecTargetUser(e.target.value)}
                              placeholder="Student Login ID (e.g. RASHID)"
                              className="px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-xs font-mono"
                            />
                            <select
                              value={recExtra1 || 'UPI'}
                              onChange={(e) => {
                                setRecExtra1(e.target.value);
                                setRecSubtitle(`${recCategory || 'Course'} • Paid via ${e.target.value}`);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-xs font-bold text-[#07164E]"
                            >
                              <option value="UPI">UPI Payment</option>
                              <option value="Cash">Cash Deposit</option>
                              <option value="Bank Transfer">Bank Transfer</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Primary Record Title / Full Name */}
                      <input
                        type="text"
                        value={recTitle}
                        onChange={(e) => setRecTitle(e.target.value)}
                        placeholder={cfg.titleLabel}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                      />

                      {/* If NOT a credential module (Student/Teacher/Parent), show standard Record Code at top */}
                      {!cfg.showPasswordInput && (
                        <input
                          type="text"
                          value={recCode}
                          onChange={(e) => setRecCode(e.target.value)}
                          placeholder={cfg.codeLabel}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        />
                      )}

                      <input
                        type="text"
                        value={recSubtitle}
                        onChange={(e) => setRecSubtitle(e.target.value)}
                        placeholder={cfg.subLabel}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={recCategory}
                          onChange={(e) => setRecCategory(e.target.value)}
                          placeholder="Course / Category (e.g. ADCA)"
                          className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                        />
                        <select
                          value={recStatus}
                          onChange={(e) => setRecStatus(e.target.value)}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                        >
                          {cfg.mod === 'attendance' ? (
                            <>
                              <option value="Present">Present</option>
                              <option value="Absent">Absent</option>
                              <option value="Late">Late</option>
                              <option value="Leave">Leave</option>
                            </>
                          ) : cfg.mod === 'fee' ? (
                            <>
                              <option value="Paid">Paid</option>
                              <option value="Pending">Pending</option>
                            </>
                          ) : cfg.mod === 'certificate' ? (
                            <>
                              <option value="Locked">Locked (Course Running)</option>
                              <option value="Completed">Unlocked (Course Completed)</option>
                            </>
                          ) : cfg.mod === 'admission' ? (
                            <>
                              <option value="Confirmed">Confirmed</option>
                              <option value="Pending">Pending Enquiry</option>
                            </>
                          ) : (
                            <>
                              <option value="Active">Active</option>
                              <option value="Upcoming">Upcoming</option>
                              <option value="Completed">Completed</option>
                            </>
                          )}
                        </select>
                      </div>

                      {cfg.numLabel && (
                        <input
                          type="number"
                          value={recNumeric}
                          onChange={(e) => setRecNumeric(e.target.value)}
                          placeholder={cfg.numLabel}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        />
                      )}

                      <input
                        type="date"
                        value={recDate}
                        onChange={(e) => setRecDate(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                      />

                      {/* 50-MCQ QUESTION BUILDER + 1-CLICK AUTO-INJECT + 24-HOUR TIME SCHEDULE FOR EXAMINATIONS */}
                      {cfg.mod === 'exam' && (
                        <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-[#07164E]">
                              24-Hour Exam Schedule (e.g. 10:00 to 10:30)
                            </span>
                            <span className="text-[10px] font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                              24h Live Window
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-1">
                                Start Time (24h)
                              </label>
                              <input
                                type="time"
                                value={examStartTime24h}
                                onChange={(e) => setExamStartTime24h(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 block mb-1">
                                End Time (24h)
                              </label>
                              <input
                                type="time"
                                value={examEndTime24h}
                                onChange={(e) => setExamEndTime24h(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs font-mono font-bold"
                              />
                            </div>
                          </div>

                          <div className="border-t border-indigo-200/70 pt-2.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold text-[#07164E]">
                                Question Bank ({adminMcqBank.length} / 50 MCQs)
                              </span>
                              <button
                                type="button"
                                onClick={handleAutoInject50McqsAdmin}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-[11px] font-extrabold shadow flex items-center gap-1 cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>⚡ Auto-Inject 50 MCQs</span>
                              </button>
                            </div>

                            <input
                              type="text"
                              value={mcqQuestionText}
                              onChange={(e) => setMcqQuestionText(e.target.value)}
                              placeholder="Enter 1 Question (or click Auto-Inject 50 MCQs above)"
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs"
                            />
                            <div className="grid grid-cols-2 gap-1.5">
                              <input
                                type="text"
                                value={mcqOptionA}
                                onChange={(e) => setMcqOptionA(e.target.value)}
                                placeholder="Option A"
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs"
                              />
                              <input
                                type="text"
                                value={mcqOptionB}
                                onChange={(e) => setMcqOptionB(e.target.value)}
                                placeholder="Option B"
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs"
                              />
                              <input
                                type="text"
                                value={mcqOptionC}
                                onChange={(e) => setMcqOptionC(e.target.value)}
                                placeholder="Option C"
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs"
                              />
                              <input
                                type="text"
                                value={mcqOptionD}
                                onChange={(e) => setMcqOptionD(e.target.value)}
                                placeholder="Option D"
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs"
                              />
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-2 text-xs font-bold">
                                <span className="text-slate-600">Correct Option:</span>
                                {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                                  <label key={opt} className="flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="adminMcqCorrect"
                                      checked={mcqCorrectOption === opt}
                                      onChange={() => setMcqCorrectOption(opt)}
                                    />
                                    <span>{opt}</span>
                                  </label>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={handleAddSingleMcqToAdminBank}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold cursor-pointer"
                              >
                                + Add MCQ ({adminMcqBank.length}/50)
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <textarea
                        value={recNotes}
                        onChange={(e) => setRecNotes(e.target.value)}
                        placeholder="Details, Address, Assignment Instructions, or Remarks..."
                        rows={2}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                      />

                      {/* BOTTOM CREDENTIAL SECTION: When creating a Student, Teacher, or Parent, their Username & Password are created right here at the bottom and saved to Firebase Cloud */}
                      {cfg.showPasswordInput && (
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#EEF4FF] to-[#E0EAFF] border-2 border-blue-300 space-y-2.5 shadow-inner">
                          <div className="flex items-center gap-2 text-xs font-extrabold text-[#07164E]">
                            <KeyRound className="w-4 h-4 text-blue-700" />
                            <span>
                              Create {cfg.mod.toUpperCase()} Portal Username &amp; Password (Cloud Saved)
                            </span>
                          </div>
                          <input
                            type="text"
                            value={recCode}
                            onChange={(e) => setRecCode(e.target.value)}
                            placeholder={cfg.codeLabel}
                            required
                            className="w-full px-3.5 py-2 rounded-xl bg-white border border-blue-300 text-xs font-mono font-bold text-[#07164E]"
                          />
                          <input
                            type="text"
                            value={recExtra2}
                            onChange={(e) => setRecExtra2(e.target.value)}
                            placeholder="Create Portal Login Password (e.g. pass123)"
                            required
                            className="w-full px-3.5 py-2 rounded-xl bg-white border border-blue-300 text-xs font-mono font-bold text-[#07164E]"
                          />
                          <input
                            type="text"
                            value={recExtra1}
                            onChange={(e) => setRecExtra1(e.target.value)}
                            placeholder="Optional: Connect Parent ID / Student ID"
                            className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono"
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={submittingForm}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-display font-extrabold text-xs shadow-md cursor-pointer"
                      >
                        {submittingForm
                          ? 'Saving to Cloud Firestore...'
                          : cfg.showPasswordInput
                          ? `Create ${cfg.mod.toUpperCase()} & Save Username/Password in Cloud`
                          : 'Save Record to Firestore'}
                      </button>
                    </form>
                  </div>

                  {/* Records List */}
                  <div className="lg:col-span-7 bg-white p-5 rounded-3xl border border-blue-100 shadow-md text-[#07164E]">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-display font-bold text-base">
                        Firestore Records ({moduleList.length})
                      </h2>
                      {moduleList.length > 0 && (
                        <button
                          onClick={() =>
                            handleExportCsv(
                              `waqar-${cfg.mod}`,
                              moduleList as unknown as Record<string, unknown>[]
                            )
                          }
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export CSV</span>
                        </button>
                      )}
                    </div>

                    {moduleList.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        No {cfg.mod} records exist in Firestore yet. Create a real record using the form on the left.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {moduleList.map((item) => {
                          const attachedMedia = getMediaAttachment(
                            item.code,
                            item.extra4,
                            item.title
                          );
                          return (
                            <div
                              key={item.id}
                              className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4"
                            >
                              <div className="flex items-center gap-3">
                                {attachedMedia && attachedMedia.startsWith('data:image') && (
                                  <img
                                    src={attachedMedia}
                                    alt={item.title}
                                    className="w-12 h-12 rounded-2xl object-cover border border-blue-200 shadow-sm shrink-0"
                                  />
                                )}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-blue-700">
                                      {item.code}
                                    </span>
                                    <span className="font-display font-bold text-sm">{item.title}</span>
                                  </div>
                                  <div className="text-xs text-slate-600 mt-0.5">
                                    {item.subtitle} • {item.category} • {item.dateStr}
                                  </div>
                                  {item.extra1 && (
                                    <div className="text-[11px] font-mono text-purple-700 font-bold mt-0.5">
                                      {cfg.mod === 'exam'
                                        ? `24h Schedule: ${item.extra1} to ${item.extra2 || '10:30'} (${item.extra3 || '50 MCQs'})`
                                        : `Info: ${item.extra1}`}
                                    </div>
                                  )}
                                  {item.numericValue > 0 && (
                                    <div className="text-xs font-mono font-bold text-emerald-700 mt-0.5 tabular-nums">
                                      Value: {item.numericValue}
                                    </div>
                                  )}
                                  {item.notes && (
                                    <div className="text-[11px] text-slate-500 mt-1">{item.notes}</div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {cfg.mod === 'certificate' ? (
                                  <button
                                    onClick={() =>
                                      onUpdateErpRecordStatus(
                                        item.id,
                                        item.status === 'Locked' ? 'Completed' : 'Locked'
                                      )
                                    }
                                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1 cursor-pointer ${
                                      item.status === 'Locked'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    }`}
                                    title="Toggle Course Completion Certificate Lock"
                                  >
                                    {item.status === 'Locked' ? (
                                      <>
                                        <Lock className="w-3.5 h-3.5" />
                                        <span>Locked (Unlock Now)</span>
                                      </>
                                    ) : (
                                      <>
                                        <Unlock className="w-3.5 h-3.5" />
                                        <span>Unlocked</span>
                                      </>
                                    )}
                                  </button>
                                ) : cfg.mod === 'fee' ? (
                                  <button
                                    onClick={() =>
                                      onUpdateErpRecordStatus(
                                        item.id,
                                        item.status === 'Paid' ? 'Pending' : 'Paid'
                                      )
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer ${
                                      item.status === 'Paid'
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                                    }`}
                                    title="Toggle Paid / Pending (Only Paid receipts appear in Student Portal)"
                                  >
                                    {item.status === 'Paid' ? '✓ Paid (In Student Portal)' : 'Pending (Mark Paid)'}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      onUpdateErpRecordStatus(
                                        item.id,
                                        item.status === 'Active' ? 'Completed' : 'Active'
                                      )
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 text-xs font-bold cursor-pointer"
                                  >
                                    {item.status}
                                  </button>
                                )}
                                <button
                                  onClick={() => window.print()}
                                  className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg cursor-pointer"
                                  title="Print Record / Receipt"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => onDeleteErpRecord(item.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ===================================================================
            SECTION: REPORTS & ANALYTICS
           =================================================================== */}
        {activeSection === 'reports' && (
          <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-md space-y-6 text-[#07164E]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-lg">
                  Institute Reports &amp; Multi-Branch Analytics
                </h2>
                <p className="text-xs text-slate-500">
                  All figures are calculated directly from live Cloud Firestore documents.
                </p>
              </div>
              <button
                onClick={() =>
                  handleExportCsv(
                    'waqar-institute-full-report',
                    erpRecords as unknown as Record<string, unknown>[]
                  )
                }
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export Full ERP CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500">Total Firestore Records</div>
                <div className="font-mono font-bold text-2xl mt-1 tabular-nums">
                  {erpRecords.length + courses.length + batches.length + branches.length}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500">Paid Fee Collection</div>
                <div className="font-mono font-bold text-2xl text-emerald-700 mt-1 tabular-nums">
                  ₹{totalFeeCollected.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500">Pending Fee Dues</div>
                <div className="font-mono font-bold text-2xl text-red-600 mt-1 tabular-nums">
                  ₹{totalFeePending.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500">Issued Certificates</div>
                <div className="font-mono font-bold text-2xl text-amber-600 mt-1 tabular-nums">
                  {certificates.length}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            SECTION: AGORA LIVE ONLINE CLASSROOM (Admin, Teacher, Student, Parent)
           =================================================================== */}
        {activeSection === 'live_class' && (
          <AgoraLiveClassRoom
            userRole="admin"
            userName={userProfile.displayName}
            userId={userProfile.username}
            batches={batches}
            erpRecords={erpRecords}
            onCreateErpRecord={onCreateErpRecord}
            onUpdateErpRecordStatus={onUpdateErpRecordStatus}
          />
        )}

        {/* ===================================================================
            SECTION: EDUSENSE AI TUTOR IN ADMIN PORTAL
           =================================================================== */}
        {activeSection === 'ai_tutor' && (
          <EduSyncAiTutor
            studentName={userProfile.displayName}
            onBack={() => setActiveSection('dashboard')}
          />
        )}

        {/* ===================================================================
            SECTION: SETTINGS (Admin Username & Password + Connect Student ID with Parent ID + Google Workspace)
           =================================================================== */}
        {activeSection === 'settings' && (
          <div className="space-y-4 text-[#07164E]">
            {/* 1. Admin Username & Password Configuration Card */}
            <div className="bg-white p-5 rounded-3xl border border-blue-100 shadow-md space-y-3">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display font-extrabold text-base">
                    Admin Username &amp; Password Settings
                  </h2>
                  <p className="text-xs text-slate-500">
                    Update or configure Admin Portal login credentials in Firebase Cloud Firestore.
                  </p>
                </div>
              </div>

              {adminCredSavedMsg && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold">
                  {adminCredSavedMsg}
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!adminNewUsername.trim() || !adminNewPassword.trim()) return;
                  await onSaveCloudCredential({
                    username: adminNewUsername.trim(),
                    password: adminNewPassword.trim(),
                    displayName: userProfile.displayName || 'Waqar Institute Admin',
                    role: 'admin',
                    branchId: branches[0]?.code || 'MAIN-BRANCH',
                    linkedEntityId: 'ADMIN-MASTER',
                  });
                  triggerCelebrationConfetti();
                  setAdminCredSavedMsg(
                    `✓ Admin Username "${adminNewUsername.trim()}" & Password saved in Firebase Cloud!`
                  );
                  setTimeout(() => setAdminCredSavedMsg(null), 5000);
                }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
              >
                <input
                  type="text"
                  value={adminNewUsername}
                  onChange={(e) => setAdminNewUsername(e.target.value)}
                  placeholder="Admin Username (e.g. Waqar)"
                  required
                  className="px-3.5 py-2.5 rounded-xl bg-[#EEF4FF] border border-blue-200 text-xs font-mono font-bold text-[#07164E]"
                />
                <input
                  type="text"
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  placeholder="Admin Password (e.g. waqar)"
                  required
                  className="px-3.5 py-2.5 rounded-xl bg-[#EEF4FF] border border-blue-200 text-xs font-mono font-bold text-[#07164E]"
                />
                <button
                  type="submit"
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-display font-extrabold text-xs shadow-md cursor-pointer"
                >
                  Save Admin Credentials
                </button>
              </form>
            </div>

            {/* 2. Connect Student ID with Parent ID Card (Moved into Settings as requested) */}
            <div className="bg-white p-5 rounded-3xl border border-blue-100 shadow-md space-y-3">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 text-white flex items-center justify-center shadow">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base">
                    Connect Student ID with Parent ID
                  </h3>
                  <p className="text-xs text-slate-500">
                    Link any Student ID to their Parent&apos;s ID so the Parent Portal displays live attendance, fees &amp; exam results.
                  </p>
                </div>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!linkStudentId.trim() || !linkParentId.trim()) return;
                  await onLinkStudentToParent(linkStudentId.trim(), linkParentId.trim());
                  triggerCelebrationConfetti();
                  setLinkSuccessMsg(
                    `✓ Connected Student ID "${linkStudentId.trim()}" with Parent ID "${linkParentId.trim()}" in Firebase Cloud!`
                  );
                  setLinkStudentId('');
                  setLinkParentId('');
                  setTimeout(() => setLinkSuccessMsg(null), 5000);
                }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
              >
                <input
                  type="text"
                  value={linkStudentId}
                  onChange={(e) => setLinkStudentId(e.target.value)}
                  placeholder="Student ID (e.g. WI2026001)"
                  list="settings-students-list"
                  required
                  className="px-3.5 py-2.5 rounded-xl bg-[#EEF4FF] border border-blue-200 text-xs font-mono text-[#07164E]"
                />
                <datalist id="settings-students-list">
                  {students.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.title}
                    </option>
                  ))}
                </datalist>

                <input
                  type="text"
                  value={linkParentId}
                  onChange={(e) => setLinkParentId(e.target.value)}
                  placeholder="Parent ID (e.g. WI-PRN-001)"
                  list="settings-parents-list"
                  required
                  className="px-3.5 py-2.5 rounded-xl bg-[#EEF4FF] border border-blue-200 text-xs font-mono text-[#07164E]"
                />
                <datalist id="settings-parents-list">
                  {parents.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.title}
                    </option>
                  ))}
                </datalist>

                <button
                  type="submit"
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-display font-extrabold text-xs shadow-md cursor-pointer"
                >
                  Connect Student &amp; Parent ID
                </button>
              </form>

              {linkSuccessMsg && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  {linkSuccessMsg}
                </div>
              )}
            </div>

            {/* 3. Create / Reset Any Portal Login Credentials in Cloud */}
            <div className="bg-white p-5 rounded-3xl border border-blue-100 shadow-md space-y-3">
              <h3 className="font-display font-extrabold text-sm">
                Quick Cloud Credential Provisioning (Student / Teacher / Parent)
              </h3>
              {credSavedMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  {credSavedMsg}
                </div>
              )}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!credUsername.trim() || !credPassword.trim() || !credDisplayName.trim()) return;
                  await onSaveCloudCredential({
                    username: credUsername.trim(),
                    password: credPassword.trim(),
                    displayName: credDisplayName.trim(),
                    role: credRole,
                    branchId: branches[0]?.code || 'MAIN-BRANCH',
                    linkedEntityId: credLinkedId.trim() || credUsername.trim(),
                  });
                  setCredSavedMsg(
                    `✓ Saved ${credRole.toUpperCase()} Login "${credUsername.trim()}" in Firebase Cloud!`
                  );
                  setCredUsername('');
                  setCredPassword('');
                  setCredDisplayName('');
                  setTimeout(() => setCredSavedMsg(null), 5000);
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2"
              >
                <input
                  type="text"
                  value={credDisplayName}
                  onChange={(e) => setCredDisplayName(e.target.value)}
                  placeholder="Full Name"
                  required
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
                <select
                  value={credRole}
                  onChange={(e) => setCredRole(e.target.value as UserRole)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                >
                  <option value="student">Student Portal</option>
                  <option value="teacher">Teacher Portal</option>
                  <option value="parent">Parent Portal</option>
                </select>
                <input
                  type="text"
                  value={credUsername}
                  onChange={(e) => setCredUsername(e.target.value)}
                  placeholder="Username / ID"
                  required
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
                <input
                  type="text"
                  value={credPassword}
                  onChange={(e) => setCredPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
                <input
                  type="text"
                  value={credLinkedId}
                  onChange={(e) => setCredLinkedId(e.target.value)}
                  placeholder="Assigned Batch Code (for Teacher) or Student ID (for Parent)"
                  className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
                <button
                  type="submit"
                  className="sm:col-span-2 py-2.5 rounded-xl bg-[#07164E] text-white font-display font-bold text-xs cursor-pointer"
                >
                  Save Portal Login to Cloud
                </button>
              </form>
            </div>

            {/* 4. Google Workspace Hub (Shown Only in Admin & Teacher Portals) */}
            <GoogleWorkspaceHub roleLabel="Administrator" />
          </div>
        )}
        </div>

        {/* ===================================================================
            6-TAB NATIVE ANDROID ADMIN BOTTOM NAVIGATION BAR + FIRE RING CANVAS
           =================================================================== */}
        <div className="bg-white border-t border-blue-200 px-1.5 pt-1.5 pb-2 shrink-0">
          <div className="grid grid-cols-6 items-center">
            {(
              [
                { id: 'dashboard', label: 'Home', icon: Home },
                { id: 'students', label: 'Students', icon: Users },
                { id: 'attendance', label: 'Attendance', icon: CheckCircle2 },
                { id: 'ai_tutor', label: 'AI Tutor', icon: Sparkles },
                { id: 'settings', label: 'Settings', icon: Settings },
              ] as const
            ).map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`flex flex-col items-center justify-center py-0.5 rounded-xl cursor-pointer ${
                    isActive ? 'text-cyan-600 font-extrabold' : 'text-slate-400'
                  }`}
                >
                  <FireRingCanvas active={isActive} size={34}>
                    <TabIcon className="w-4 h-4" />
                  </FireRingCanvas>
                  <span className="text-[9px] mt-0.5">{tab.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => setSidebarOpen(true)}
              className={`flex flex-col items-center justify-center py-0.5 rounded-xl cursor-pointer ${
                sidebarOpen ? 'text-cyan-600 font-extrabold' : 'text-slate-500 hover:text-blue-600'
              }`}
            >
              <FireRingCanvas active={sidebarOpen} size={34}>
                <Menu className="w-4 h-4" />
              </FireRingCanvas>
              <span className="text-[9px] mt-0.5">All Modules</span>
            </button>
          </div>
          <div className="w-32 h-1.5 rounded-full bg-slate-300 mx-auto mt-1" />
        </div>
      </div>

      {/* Real Camera + Image QR Scanner Modal for Admin Portal */}
      {adminScannerOpen && (
        <QrScannerModal
          scannerTitle="Admin Portal — Real Attendance QR Scanner"
          onScanSuccess={handleAdminQrScanSuccess}
          onClose={() => setAdminScannerOpen(false)}
        />
      )}
    </div>
  );
};
