import React, { useState, useEffect } from 'react';
import {
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  Home,
  Award,
  Wallet,
  PlayCircle,
  Search,
  Sparkles,
  Trophy,
  User,
  Users,
  QrCode,
  Plus,
  Printer,
  MessageSquare,
  Check,
  X,
  ArrowRight,
  Shield,
  Camera,
  AlertTriangle,
  RefreshCw,
  Send,
  CheckCircle,
  ShieldAlert,
  Link2,
  Lock,
  Download,
  Upload,
  KeyRound,
  Image as ImageIcon,
  Video,
  Unlock,
  UserPlus,
} from 'lucide-react';
import {
  BatchDoc,
  BranchDoc,
  CourseDoc,
  ErpRecordDoc,
  UserProfileDoc,
  UserRole,
  calculateGrade,
  sanitizeId,
} from '../types/erp';
import { CircularProgressRing, WaqarCrestLogo } from './WaqarBranding';
import { EduSyncAiTutor } from './EduSyncAiTutor';
import { QrScannerModal } from './QrScannerModal';
import { RealQrGenerator } from './RealQrGenerator';
import { GoogleWorkspaceHub } from './GoogleWorkspaceHub';
import { FireRingCanvas } from './FireRingCanvas';
import { AgoraLiveClassRoom } from './AgoraLiveClassRoom';
import {
  McqQuestionItem,
  compressImageFileToDataUrl,
  downloadOfficialFeeReceiptPdf,
  generate50McqQuestionBank,
  getExamMcqQuestions,
  getMediaAttachment,
  isWithin24HourSchedule,
  saveCustomMcqBank,
  saveMediaAttachment,
  triggerCelebrationConfetti,
} from '../utils/mcqBank';

interface RolePortalsProps {
  activePortal: 'student' | 'teacher' | 'parent';
  userProfile: UserProfileDoc;
  branches: BranchDoc[];
  courses: CourseDoc[];
  batches: BatchDoc[];
  erpRecords: ErpRecordDoc[];
  onCreateErpRecord: (
    payload: Omit<ErpRecordDoc, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateErpRecordStatus?: (id: string, newStatus: string) => Promise<void>;
  onUpdateUserProfile: (updates: Partial<UserProfileDoc>) => Promise<void>;
  onSaveCloudCredential?: (payload: {
    username: string;
    password: string;
    displayName: string;
    role: UserRole;
    branchId?: string;
    linkedEntityId?: string;
  }) => Promise<void>;
  onLinkStudentToParent?: (studentUsername: string, parentUsername: string) => Promise<void>;
  onLogout: () => void;
}

export const RolePortals: React.FC<RolePortalsProps> = ({
  activePortal,
  userProfile,
  branches,
  courses,
  batches,
  erpRecords,
  onCreateErpRecord,
  onUpdateErpRecordStatus,
  onUpdateUserProfile,
  onSaveCloudCredential,
  onLinkStudentToParent,
  onLogout,
}) => {
  // Bottom Nav State
  const [studentTab, setStudentTab] = useState<
    'home' | 'courses' | 'exams' | 'attendance' | 'ai_tutor' | 'profile'
  >('home');
  const [studentSubScreen, setStudentSubScreen] = useState<
    | null
    | 'results'
    | 'fees'
    | 'materials'
    | 'certificates'
    | 'idcard'
    | 'ai_tutor'
    | 'live_class'
    | 'notifications'
    | 'messages'
  >(null);

  const [teacherTab, setTeacherTab] = useState<
    'home' | 'classes' | 'attendance' | 'exams' | 'ai_tutor' | 'enroll_id' | 'profile'
  >('home');
  const [teacherAttSubTab, setTeacherAttSubTab] = useState<'sheet' | 'qr' | 'manage'>('sheet');

  const [parentTab, setParentTab] = useState<
    'home' | 'student' | 'results' | 'messages' | 'ai_tutor' | 'profile'
  >('home');

  // Notification Bell Seen Counter (Resets unread badge to 0 immediately upon viewing)
  const [seenNotifCount, setSeenNotifCount] = useState<number>(0);

  // Student Portal Dark Mode State
  const [studentDarkMode, setStudentDarkMode] = useState<boolean>(false);

  // Teacher Draft Batch Attendance Map + Save Button State
  const [draftTeacherAttendance, setDraftTeacherAttendance] = useState<
    Record<string, 'Present' | 'Absent'>
  >({});
  const [savingTeacherBatchAtt, setSavingTeacherBatchAtt] = useState(false);
  const [teacherBatchAttSavedMsg, setTeacherBatchAttSavedMsg] = useState<string | null>(null);

  // Exam Filter & Live Online 50-MCQ Exam Runner State
  const [examFilter, setExamFilter] = useState<'upcoming' | 'completed' | 'results'>('upcoming');
  const [activeExam, setActiveExam] = useState<ErpRecordDoc | null>(null);
  const [activeExamQuestions, setActiveExamQuestions] = useState<McqQuestionItem[]>([]);
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [examSecondsLeft, setExamSecondsLeft] = useState(1800);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [submittingExam, setSubmittingExam] = useState(false);

  // Live 1-second clock for 2-minute automatic result reveal & 24-hour exam schedule check
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Student Fee Payment State
  const [studentFeeAmount, setStudentFeeAmount] = useState('2500');
  const [studentFeeMode, setStudentFeeMode] = useState<'UPI' | 'Cash' | 'Bank Transfer'>('UPI');
  const [payingFee, setPayingFee] = useState(false);
  const [feePaidBanner, setFeePaidBanner] = useState<string | null>(null);

  // Student QR Selected Batch
  const [studentQrBatch, setStudentQrBatch] = useState<string>(batches[0]?.code || 'ADCA-A1');

  // Course Search (Click-to-open search input)
  const [courseSearch, setCourseSearch] = useState('');
  const [showCourseSearch, setShowCourseSearch] = useState(false);

  // Teacher Quick Entry States
  const [attStudentId, setAttStudentId] = useState('');
  const [attStudentName, setAttStudentName] = useState('');
  const [attStatus, setAttStatus] = useState<'Present' | 'Absent' | 'Late' | 'Leave'>('Present');
  const [attBatchCode, setAttBatchCode] = useState('');

  // Teacher Create Student (with Gallery Photo & Bottom Username/Password)
  const [tStuName, setTStuName] = useState('');
  const [tStuGuardian, setTStuGuardian] = useState('');
  const [tStuCourse, setTStuCourse] = useState('ADCA');
  const [tStuUsername, setTStuUsername] = useState('');
  const [tStuPassword, setTStuPassword] = useState('');
  const [tStuPhotoDataUrl, setTStuPhotoDataUrl] = useState('');
  const [tStuPhotoName, setTStuPhotoName] = useState('');
  const [tStuSavedBanner, setTStuSavedBanner] = useState<string | null>(null);

  // Teacher 50-MCQ Exam Builder + 24h Schedule
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamCourse, setNewExamCourse] = useState('ADCA');
  const [newExamDate, setNewExamDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newExamStart24h, setNewExamStart24h] = useState('10:00');
  const [newExamEnd24h, setNewExamEnd24h] = useState('10:30');
  const [newExamQuestion, setNewExamQuestion] = useState('');
  const [newExamOptA, setNewExamOptA] = useState('');
  const [newExamOptB, setNewExamOptB] = useState('');
  const [newExamOptC, setNewExamOptC] = useState('');
  const [newExamOptD, setNewExamOptD] = useState('');
  const [newExamCorrect, setNewExamCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [teacherMcqBank, setTeacherMcqBank] = useState<McqQuestionItem[]>([]);
  const [teacherExamSavedBanner, setTeacherExamSavedBanner] = useState<string | null>(null);

  // Scanner & Anti-Cheat States
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerToast, setScannerToast] = useState<string | null>(null);
  const [antiCheatViolations, setAntiCheatViolations] = useState(0);
  const [antiCheatWarningModal, setAntiCheatWarningModal] = useState<string | null>(null);

  // Teacher 5-Minute Expiring QR & Batch Attendance States
  const [teacherQrSeconds, setTeacherQrSeconds] = useState(300);
  const [teacherSelectedBatch, setTeacherSelectedBatch] = useState<string>(
    batches[0]?.code || 'ADCA-A1'
  );

  // Study Material & Assignment Gallery Upload Form States
  const [materialType, setMaterialType] = useState<'assignment' | 'material'>('assignment');
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialCourse, setMaterialCourse] = useState('ADCA');
  const [materialLink, setMaterialLink] = useState('');
  const [materialNotes, setMaterialNotes] = useState('');
  const [materialFileDataUrl, setMaterialFileDataUrl] = useState('');
  const [materialFileName, setMaterialFileName] = useState('');
  const [sendingMaterial, setSendingMaterial] = useState(false);
  const [materialSentBanner, setMaterialSentBanner] = useState<string | null>(null);

  // Parent Child Link Input & Teacher Student-Parent Linker
  const [childLinkInput, setChildLinkInput] = useState(userProfile.linkedEntityId || '');
  const [teacherLinkStudentId, setTeacherLinkStudentId] = useState('');
  const [teacherLinkParentId, setTeacherLinkParentId] = useState('');
  const [teacherLinkMsg, setTeacherLinkMsg] = useState<string | null>(null);

  // Message Input
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');

  // Timer effect for active exam
  useEffect(() => {
    if (!activeExam) return;
    const timer = setInterval(() => {
      setExamSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeExam]);

  // Anti-Cheat Window Blur & Visibility Guard during Active Exam
  useEffect(() => {
    if (!activeExam) {
      setAntiCheatViolations(0);
      setAntiCheatWarningModal(null);
      return;
    }

    const handleVisibility = () => {
      if (document.hidden) {
        setAntiCheatViolations((prev) => {
          const next = prev + 1;
          if (next >= 2) {
            setAntiCheatWarningModal(
              'Cheating Security Triggered: Tab switch violation detected. Exam automatically submitted.'
            );
            handleSubmitExamAttempt(true);
          } else {
            setAntiCheatWarningModal(
              'Anti-Cheat Warning 1/2: Tab switching detected! Switching tabs again will immediately auto-submit your exam.'
            );
          }
          return next;
        });
      }
    };

    const handleBlur = () => {
      setAntiCheatViolations((prev) => {
        const next = prev + 1;
        if (next >= 2) {
          setAntiCheatWarningModal(
            'Cheating Security Triggered: Window focus lost. Exam automatically submitted.'
          );
          handleSubmitExamAttempt(true);
        } else {
          setAntiCheatWarningModal(
            'Anti-Cheat Warning: Window focus lost. Split-screen and background recording are prohibited.'
          );
        }
        return next;
      });
    };

    const handleResize = () => {
      const availW = window.screen?.availWidth || 800;
      if (window.innerWidth < 420 || window.innerWidth < availW * 0.55) {
        setAntiCheatWarningModal(
          'Split-Screen Blocked: Split-screen multitasking is strictly prohibited during live examinations.'
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('resize', handleResize);
    };
  }, [activeExam]);

  // 5-Minute Auto-Expiring QR Code Countdown for Teacher Portal
  useEffect(() => {
    if (activePortal !== 'teacher') return;
    const interval = setInterval(() => {
      setTeacherQrSeconds((prev) => {
        if (prev <= 1) return 300; // auto-refresh after 5 mins
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activePortal]);

  // Derived Real Data from Firestore (Strictly Zero Dummy Data)
  const attendanceRecords = erpRecords.filter((r) => r.module === 'attendance');
  const activeTargetId =
    activePortal === 'parent' && userProfile.linkedEntityId
      ? userProfile.linkedEntityId
      : userProfile.username;

  const myAttendanceRecords = attendanceRecords.filter((r) => {
    const tId = (r.targetUserId || '').toLowerCase();
    const cId = (r.code || '').toLowerCase();
    const uName = (userProfile.username || '').toLowerCase();
    const uUid = (userProfile.uid || '').toLowerCase();
    const linked = (activeTargetId || '').toLowerCase();
    return (
      tId === uName ||
      tId === uUid ||
      cId === uName ||
      cId === uUid ||
      (linked && (tId === linked || cId === linked))
    );
  });
  const presentCount = myAttendanceRecords.filter(
    (r) => r.status.toLowerCase() === 'present' || r.status.toLowerCase() === 'late'
  ).length;
  const attendancePercentage =
    myAttendanceRecords.length > 0
      ? Math.round((presentCount / myAttendanceRecords.length) * 100)
      : 0;

  const examRecords = erpRecords.filter((r) => r.module === 'exam');
  const resultRecords = erpRecords.filter((r) => r.module === 'result');
  // Student/Parent only sees Official Fee Receipts marked as Paid by Admin for this specific Student
  const feeRecords = erpRecords.filter((r) => {
    if (r.module !== 'fee') return false;
    if ((r.status || '').toLowerCase() !== 'paid') return false;
    const uName = (userProfile.username || '').trim().toLowerCase();
    const dName = (userProfile.displayName || '').trim().toLowerCase();
    const linked = (activeTargetId || userProfile.linkedEntityId || '').trim().toLowerCase();
    const tUser = (r.targetUserId || '').trim().toLowerCase();
    const rTitle = (r.title || '').trim().toLowerCase();
    const rExtra2 = (r.extra2 || '').trim().toLowerCase();
    const rCode = (r.code || '').trim().toLowerCase();
    return (
      (uName && (tUser === uName || rExtra2 === uName || rCode === uName || rTitle.includes(uName))) ||
      (dName && (tUser === dName || rTitle === dName || rTitle.includes(dName))) ||
      (linked && (tUser === linked || rExtra2 === linked || rCode === linked || rTitle.includes(linked)))
    );
  });
  const certificateRecords = erpRecords.filter((r) => r.module === 'certificate');
  const materialRecords = erpRecords.filter(
    (r) => r.module === 'material' || r.module === 'assignment'
  );
  const assignmentRecords = erpRecords.filter((r) => r.module === 'assignment');
  const notificationRecords = erpRecords.filter((r) => r.module === 'notification');
  const unreadNotifCount = Math.max(0, notificationRecords.length - seenNotifCount);
  const messageRecords = erpRecords.filter((r) => r.module === 'message');
  const studentRecords = erpRecords.filter((r) => r.module === 'student');
  const timetableRecords = erpRecords.filter((r) => r.module === 'timetable');

  // Resolve Student Profile Photo attached by Admin/Teacher (matches by code, name e.g. Rashid, or linkedEntityId)
  const matchedStudentRecord =
    studentRecords.find((s) => {
      const uName = (userProfile.username || '').trim().toLowerCase();
      const dName = (userProfile.displayName || '').trim().toLowerCase();
      const linked = (userProfile.linkedEntityId || '').trim().toLowerCase();
      const sCode = (s.code || '').trim().toLowerCase();
      const sTitle = (s.title || '').trim().toLowerCase();
      const sTarget = (s.targetUserId || '').trim().toLowerCase();
      return (
        (uName && (sCode === uName || sTitle === uName || sTarget === uName || sTitle.includes(uName))) ||
        (dName && (sTitle === dName || sCode === dName || sTitle.includes(dName))) ||
        (linked && (sCode === linked || sTitle === linked || sTarget === linked))
      );
    }) || studentRecords[0];

  const activeStudentPhotoUrl =
    getMediaAttachment(
      userProfile.username,
      matchedStudentRecord?.extra4,
      userProfile.displayName
    ) ||
    getMediaAttachment(
      matchedStudentRecord?.code,
      matchedStudentRecord?.extra4,
      matchedStudentRecord?.title
    ) ||
    (() => {
      for (const sr of studentRecords) {
        const found = getMediaAttachment(sr.code, sr.extra4, sr.title);
        if (found) return found;
      }
      return '';
    })();

  // Filter out any legacy default course IDs so ONLY Admin-created courses are displayed
  const adminCreatedCourses = courses.filter(
    (c) => !['ADCA', 'DCA', 'TALLY-PRIME', 'MS-OFFICE'].includes(c.id)
  );

  // Restrict Teacher Portal to ONLY the batch assigned to this Teacher by Admin
  const teacherMatchedBatches = batches.filter((b) => {
    const linked = (userProfile.linkedEntityId || '').toLowerCase();
    const uName = (userProfile.username || '').toLowerCase();
    const dName = (userProfile.displayName || '').toLowerCase();
    return (
      (linked && b.code.toLowerCase() === linked) ||
      b.teacherId.toLowerCase() === uName ||
      b.teacherName.toLowerCase().includes(dName)
    );
  });
  const teacherAssignedBatches =
    teacherMatchedBatches.length > 0 ? teacherMatchedBatches : batches.slice(0, 1);
  const teacherLockedBatchCode =
    teacherAssignedBatches[0]?.code || userProfile.linkedEntityId || batches[0]?.code || 'ADCA-A1';

  // Filter results that have passed the 2-minute auto-publish timer
  const publishedResultRecords = resultRecords.filter((r) => {
    const pubMs = Number(r.extra3);
    if (!pubMs || Number.isNaN(pubMs)) return true;
    return nowMs >= pubMs;
  });

  const overallResultPercentage =
    publishedResultRecords.length > 0
      ? publishedResultRecords.reduce((acc, r) => acc + (Number(r.numericValue) || 0), 0) /
        publishedResultRecords.length
      : 0;

  const totalFeePaid = feeRecords
    .filter((f) => f.status.toLowerCase() === 'paid')
    .reduce((acc, f) => acc + (Number(f.numericValue) || 0), 0);

  const totalFeePending = feeRecords
    .filter((f) => f.status.toLowerCase() === 'pending')
    .reduce((acc, f) => acc + (Number(f.numericValue) || 0), 0);

  const primaryBranchName =
    branches.find((b) => b.code === userProfile.branchId || b.id === userProfile.branchId)?.name ||
    branches[0]?.name ||
    userProfile.branchId ||
    'Main Branch';

  const primaryBatch = batches[0];

  // In-App Camera QR Scanner Success Handler
  const handleQrScanSuccess = async (scannedToken: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const batchMatch = scannedToken.match(/BATCH:([^|]+)/);
      const matchedBatch = batchMatch ? batchMatch[1] : primaryBatch?.code || 'ADCA-A1';

      await onCreateErpRecord({
        module: 'attendance',
        code: userProfile.username,
        title: userProfile.displayName,
        subtitle: `Class Batch: ${matchedBatch}`,
        category: 'Live Class Attendance',
        status: 'Present',
        branchId: userProfile.branchId || 'MAIN',
        courseId: 'COURSE',
        batchId: matchedBatch,
        targetUserId: userProfile.uid,
        numericValue: 100,
        secondaryNumericValue: 1,
        dateStr: today,
        notes: `Verified via In-App Camera QR Scanner at ${new Date().toLocaleTimeString()}`,
        extra1: userProfile.username,
        extra2: 'Present',
        extra3: scannedToken.slice(0, 60),
        extra4: 'CAMERA_QR_VERIFIED',
        visibility: 'institute',
      });

      setScannerOpen(false);
      setScannerToast(`Attendance marked Present for ${matchedBatch} via Camera QR Scanner!`);
      setTimeout(() => setScannerToast(null), 5000);
    } catch (err) {
      console.error('Failed to record QR attendance:', err);
    }
  };

  const handleStartStudentExam = (ex: ErpRecordDoc) => {
    const bank = getExamMcqQuestions({
      examCode: ex.code,
      courseName: ex.courseId || ex.category || 'ADCA',
      notes: ex.notes,
      extra3: ex.extra3,
      extra4: ex.extra4,
    });
    setActiveExam(ex);
    setActiveExamQuestions(bank);
    setCurrentMcqIndex(0);
    setSelectedAnswers({});
    setExamSecondsLeft((Number(ex.numericValue) || 30) * 60);
  };

  const handleSubmitExamAttempt = async (isFlagged = false) => {
    if (!activeExam || submittingExam) return;
    setSubmittingExam(true);
    try {
      const questions =
        activeExamQuestions.length > 0
          ? activeExamQuestions
          : generate50McqQuestionBank(activeExam.courseId || 'ADCA');

      let correctCount = 0;
      questions.forEach((q, idx) => {
        const chosen = selectedAnswers[idx];
        if (chosen && chosen === q.correctOption) {
          correctCount += 1;
        }
      });

      const scoredPercentage = isFlagged
        ? 0
        : Math.round((correctCount / Math.max(1, questions.length)) * 100);
      const { grade, passed } = calculateGrade(scoredPercentage);
      const today = new Date().toISOString().split('T')[0];

      // Automatic Result Reveal scheduled exactly 2 Minutes (120,000 ms) after Exam Submission
      const publishAtMs = Date.now() + 2 * 60 * 1000;

      await onCreateErpRecord({
        module: 'exam_attempt',
        code: `ATT-${Date.now()}`,
        title: activeExam.title,
        subtitle: `Student: ${userProfile.displayName} (${userProfile.username})`,
        category: activeExam.category || 'Course Exam',
        status: isFlagged ? 'flagged_submitted' : 'submitted',
        branchId: userProfile.branchId || 'MAIN',
        courseId: activeExam.courseId || 'COURSE',
        batchId: activeExam.batchId || 'BATCH',
        targetUserId: userProfile.username,
        numericValue: scoredPercentage,
        secondaryNumericValue: questions.length,
        dateStr: today,
        notes: isFlagged
          ? 'Auto-submitted: Flagged for Anti-Cheat Tab Switching/Split-screen'
          : `Answered ${Object.keys(selectedAnswers).length}/${questions.length} MCQs • Correct: ${correctCount}`,
        extra1: grade,
        extra2: passed ? 'PASS' : 'FAIL',
        extra3: String(publishAtMs),
        extra4: `${correctCount}/${questions.length}`,
        visibility: 'institute',
      });

      await onCreateErpRecord({
        module: 'result',
        code: `RES-${Date.now()}`,
        title: activeExam.category || activeExam.title,
        subtitle: `${userProfile.displayName} (${userProfile.username})`,
        category: activeExam.title,
        status: passed ? 'Pass' : 'Fail',
        branchId: userProfile.branchId || 'MAIN',
        courseId: activeExam.courseId || 'COURSE',
        batchId: activeExam.batchId || 'BATCH',
        targetUserId: userProfile.username,
        numericValue: scoredPercentage,
        secondaryNumericValue: questions.length,
        dateStr: today,
        notes: isFlagged
          ? 'Automated evaluation with anti-cheat flag'
          : `50-MCQ Evaluation: ${correctCount}/${questions.length} Correct`,
        extra1: grade,
        extra2: passed ? 'PASS' : 'FAIL',
        extra3: String(publishAtMs),
        extra4: `${correctCount}/${questions.length}`,
        visibility: 'institute',
      });

      setActiveExam(null);
      setActiveExamQuestions([]);
      setSelectedAnswers({});
      setExamFilter('results');
      triggerCelebrationConfetti();
    } finally {
      setSubmittingExam(false);
    }
  };

  const handleStudentPayFee = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(studentFeeAmount);
    if (!amt || amt <= 0 || payingFee) return;
    setPayingFee(true);
    try {
      const receiptCode = `RCP-${Date.now().toString().slice(-6)}`;
      const todayStr = new Date().toISOString().split('T')[0];
      const courseLabel = primaryBatch?.courseName || courses[0]?.code || 'ADCA';

      await onCreateErpRecord({
        module: 'fee',
        code: receiptCode,
        title: `${userProfile.displayName} (${userProfile.username})`,
        subtitle: `${courseLabel} • Paid via ${studentFeeMode}`,
        category: courseLabel,
        status: 'Paid',
        branchId: userProfile.branchId || 'MAIN-BRANCH',
        courseId: courseLabel,
        batchId: primaryBatch?.code || 'ADCA-A1',
        targetUserId: userProfile.username,
        numericValue: amt,
        secondaryNumericValue: 0,
        dateStr: todayStr,
        notes: `Online Student Fee Payment via ${studentFeeMode}`,
        extra1: studentFeeMode,
        extra2: userProfile.username,
        extra3: 'VERIFIED_RECEIPT',
        extra4: '',
        visibility: 'institute',
      });

      triggerCelebrationConfetti();
      setFeePaidBanner(
        `✓ Fee Payment of ₹${amt.toLocaleString('en-IN')} Successful! Receipt #${receiptCode} is ready to download below.`
      );
      setTimeout(() => setFeePaidBanner(null), 6000);
    } finally {
      setPayingFee(false);
    }
  };

  const handleTeacherMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attStudentId.trim() || !attStudentName.trim()) return;
    const today = new Date().toISOString().split('T')[0];
    await onCreateErpRecord({
      module: 'attendance',
      code: `ATD-${Date.now()}`,
      title: attStudentName.trim(),
      subtitle: `Batch: ${attBatchCode.trim() || primaryBatch?.code || 'General'}`,
      category: 'Daily Attendance',
      status: attStatus,
      branchId: userProfile.branchId || 'MAIN',
      courseId: primaryBatch?.courseId || 'COURSE',
      batchId: attBatchCode.trim() || primaryBatch?.code || 'BATCH',
      targetUserId: attStudentId.trim(),
      numericValue: attStatus === 'Present' || attStatus === 'Late' ? 100 : 0,
      secondaryNumericValue: 1,
      dateStr: today,
      notes: `Marked by ${userProfile.displayName}`,
      extra1: attStudentId.trim(),
      extra2: attStatus,
      extra3: '',
      extra4: '',
      visibility: 'institute',
    });
    setAttStudentId('');
    setAttStudentName('');
  };

  const handleTeacherCreateStudentWithBottomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tStuName.trim() || !tStuUsername.trim() || !tStuPassword.trim()) return;
    const cleanStuCode = sanitizeId(tStuUsername.trim(), 64);
    const today = new Date().toISOString().split('T')[0];

    if (tStuPhotoDataUrl) {
      saveMediaAttachment(cleanStuCode, tStuPhotoDataUrl, [
        tStuName.trim(),
        tStuUsername.trim(),
      ]);
    }

    await onCreateErpRecord({
      module: 'student',
      code: cleanStuCode,
      title: tStuName.trim(),
      subtitle: tStuGuardian.trim() || `Course: ${tStuCourse}`,
      category: tStuCourse,
      status: 'Active',
      branchId: userProfile.branchId || 'MAIN-BRANCH',
      courseId: tStuCourse,
      batchId: teacherSelectedBatch,
      targetUserId: cleanStuCode,
      numericValue: 0,
      secondaryNumericValue: 100,
      dateStr: today,
      notes: `Enrolled by Teacher ${userProfile.displayName}`,
      extra1: cleanStuCode,
      extra2: tStuPassword.trim(),
      extra3: tStuPhotoName ? `FILE:${tStuPhotoName}` : '',
      extra4: '',
      visibility: 'institute',
    });

    if (onSaveCloudCredential) {
      await onSaveCloudCredential({
        username: cleanStuCode,
        password: tStuPassword.trim(),
        displayName: tStuName.trim(),
        role: 'student',
        branchId: userProfile.branchId || 'MAIN-BRANCH',
        linkedEntityId: cleanStuCode,
      });
    }

    // Also create Locked Certificate for the student until course duration completes
    await onCreateErpRecord({
      module: 'certificate',
      code: sanitizeId(`CERT-${cleanStuCode}`, 64),
      title: `Diploma in ${tStuCourse}`,
      subtitle: `Awarded to ${tStuName.trim()} (${cleanStuCode})`,
      category: tStuCourse,
      status: 'Locked',
      branchId: userProfile.branchId || 'MAIN-BRANCH',
      courseId: tStuCourse,
      batchId: teacherSelectedBatch,
      targetUserId: cleanStuCode,
      numericValue: 0,
      secondaryNumericValue: 100,
      dateStr: today,
      notes: `Certificate Locked until ${tStuCourse} Course Duration Completes`,
      extra1: 'Pending Course Completion',
      extra2: 'Main Campus',
      extra3: '12 Months (Locked until Course Duration Completes)',
      extra4: 'LOCKED_UNTIL_COMPLETION',
      visibility: 'institute',
    });

    triggerCelebrationConfetti();
    setTStuSavedBanner(
      `✓ Student "${tStuName.trim()}" Created! Login Username "${cleanStuCode}" & Password "${tStuPassword.trim()}" saved in Cloud.`
    );
    setTStuName('');
    setTStuGuardian('');
    setTStuUsername('');
    setTStuPassword('');
    setTStuPhotoDataUrl('');
    setTStuPhotoName('');
    setTimeout(() => setTStuSavedBanner(null), 6000);
  };

  const handleTeacherStudentPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTStuPhotoName(file.name);
    const dataUrl = await compressImageFileToDataUrl(file);
    setTStuPhotoDataUrl(dataUrl);
  };

  const handleTeacherMaterialFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMaterialFileName(file.name);
    const dataUrl = await compressImageFileToDataUrl(file);
    setMaterialFileDataUrl(dataUrl);
  };

  const handleSendMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialTitle.trim()) return;
    setSendingMaterial(true);
    try {
      const code = sanitizeId(
        `${materialType === 'assignment' ? 'ASN' : 'MAT'}-${Date.now().toString().slice(-6)}`,
        64
      );
      if (materialFileDataUrl) {
        saveMediaAttachment(code, materialFileDataUrl);
      }

      await onCreateErpRecord({
        module: materialType,
        code,
        title: materialTitle.trim(),
        subtitle: `Course: ${materialCourse} • Batch: ${teacherSelectedBatch}`,
        category: materialCourse,
        status: 'Active',
        branchId: userProfile.branchId || 'MAIN',
        courseId: materialCourse,
        batchId: teacherSelectedBatch,
        targetUserId: 'ALL',
        numericValue: 1,
        secondaryNumericValue: 0,
        dateStr: new Date().toISOString().split('T')[0],
        notes: materialNotes.trim() || 'Assignment & study material uploaded from Gallery/Files',
        extra1: materialLink.trim() || '',
        extra2: userProfile.displayName,
        extra3: materialFileName ? `FILE:${materialFileName}` : teacherSelectedBatch,
        extra4: '',
        visibility: 'institute',
      });
      setMaterialTitle('');
      setMaterialLink('');
      setMaterialNotes('');
      setMaterialFileDataUrl('');
      setMaterialFileName('');
      triggerCelebrationConfetti();
      setMaterialSentBanner(
        `✓ ${materialType.toUpperCase()} broadcasted to Student Portal & saved in Firebase Cloud!`
      );
      setTimeout(() => setMaterialSentBanner(null), 5000);
    } finally {
      setSendingMaterial(false);
    }
  };

  const handleToggleBatchStudentAttendance = async (
    studentId: string,
    studentName: string,
    batchCode: string,
    targetStatus: 'Present' | 'Absent'
  ) => {
    const today = new Date().toISOString().split('T')[0];
    await onCreateErpRecord({
      module: 'attendance',
      code: `ATD-${Date.now()}`,
      title: studentName,
      subtitle: `Batch: ${batchCode}`,
      category: 'Batch-wise Register',
      status: targetStatus,
      branchId: userProfile.branchId || 'MAIN',
      courseId: primaryBatch?.courseId || 'COURSE',
      batchId: batchCode,
      targetUserId: studentId,
      numericValue: targetStatus === 'Present' ? 100 : 0,
      secondaryNumericValue: 1,
      dateStr: today,
      notes: `Batch attendance marked by ${userProfile.displayName}`,
      extra1: studentId,
      extra2: targetStatus,
      extra3: 'BATCH_TOGGLE',
      extra4: '',
      visibility: 'institute',
    });
  };

  const handleMarkAllBatchPresent = async (batchCode: string) => {
    const enrolled = studentRecords.filter(
      (s) => !s.batchId || s.batchId === batchCode || studentRecords.length > 0
    );
    if (enrolled.length === 0) return;
    setSavingTeacherBatchAtt(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      for (const student of enrolled) {
        const chosenStatus = draftTeacherAttendance[student.code] || 'Present';
        await onCreateErpRecord({
          module: 'attendance',
          code: `ATD-${student.code}-${Date.now().toString().slice(-4)}`,
          title: student.title,
          subtitle: `Batch: ${batchCode} • Full Batch Cloud Sync`,
          category: 'Batch Attendance',
          status: chosenStatus,
          branchId: userProfile.branchId || 'MAIN-BRANCH',
          courseId: student.courseId || primaryBatch?.courseId || 'ADCA',
          batchId: batchCode,
          targetUserId: student.code,
          numericValue: chosenStatus === 'Present' ? 100 : 0,
          secondaryNumericValue: 1,
          dateStr: today,
          notes: `Direct Batch Attendance submitted by ${userProfile.displayName} to Firestore Cloud`,
          extra1: student.code,
          extra2: chosenStatus,
          extra3: 'BATCH_CLOUD_SUBMIT',
          extra4: '',
          visibility: 'institute',
        });
      }
      triggerCelebrationConfetti();
      setTeacherBatchAttSavedMsg(
        `✓ Submitted Attendance for all ${enrolled.length} students in Batch ${batchCode} directly to Firebase Cloud Firestore!`
      );
      setTimeout(() => setTeacherBatchAttSavedMsg(null), 6000);
    } finally {
      setSavingTeacherBatchAtt(false);
    }
  };

  const handleTeacherAddSingleMcq = () => {
    if (!newExamQuestion.trim() || teacherMcqBank.length >= 50) return;
    setTeacherMcqBank((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        question: newExamQuestion.trim(),
        optionA: newExamOptA.trim() || 'Option A',
        optionB: newExamOptB.trim() || 'Option B',
        optionC: newExamOptC.trim() || 'Option C',
        optionD: newExamOptD.trim() || 'Option D',
        correctOption: newExamCorrect,
      },
    ]);
    setNewExamQuestion('');
    setNewExamOptA('');
    setNewExamOptB('');
    setNewExamOptC('');
    setNewExamOptD('');
  };

  const handleTeacherAutoInject50Mcqs = () => {
    const courseLabel = newExamCourse.trim() || 'ADCA';
    const bank50 = generate50McqQuestionBank(courseLabel);
    setTeacherMcqBank(bank50);
    triggerCelebrationConfetti();
  };

  const handleTeacherCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamTitle.trim() || !newExamCourse.trim()) return;
    const examCode = sanitizeId(`EXM-${Date.now().toString().slice(-6)}`, 64);
    const finalBank =
      teacherMcqBank.length > 0
        ? teacherMcqBank
        : newExamQuestion.trim()
        ? [
            {
              id: 1,
              question: newExamQuestion.trim(),
              optionA: newExamOptA.trim() || 'Option A',
              optionB: newExamOptB.trim() || 'Option B',
              optionC: newExamOptC.trim() || 'Option C',
              optionD: newExamOptD.trim() || 'Option D',
              correctOption: newExamCorrect,
            },
          ]
        : generate50McqQuestionBank(newExamCourse.trim());

    saveCustomMcqBank(examCode, finalBank);

    await onCreateErpRecord({
      module: 'exam',
      code: examCode,
      title: newExamTitle.trim(),
      subtitle: `${newExamCourse.trim()} Course • ${finalBank.length} MCQs`,
      category: newExamCourse.trim(),
      status: 'Upcoming',
      branchId: userProfile.branchId || 'MAIN',
      courseId: newExamCourse.trim(),
      batchId: primaryBatch?.code || 'ADCA-A1',
      targetUserId: 'ALL',
      numericValue: 30,
      secondaryNumericValue: 100,
      dateStr: newExamDate.trim() || new Date().toISOString().split('T')[0],
      notes: `50_MCQ_BANK • 24h Schedule: ${newExamStart24h} to ${newExamEnd24h}`,
      extra1: newExamStart24h || '10:00',
      extra2: newExamEnd24h || '10:30',
      extra3: `${finalBank.length} MCQs`,
      extra4: 'AUTO_50_MCQ',
      visibility: 'institute',
    });
    setNewExamTitle('');
    setNewExamQuestion('');
    setTeacherMcqBank([]);
    triggerCelebrationConfetti();
    setTeacherExamSavedBanner(
      `✓ Published "${newExamTitle.trim()}" (${finalBank.length} MCQs) scheduled for ${newExamStart24h} - ${newExamEnd24h} (24h)!`
    );
    setTimeout(() => setTeacherExamSavedBanner(null), 6000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgTitle.trim() || !msgBody.trim()) return;
    await onCreateErpRecord({
      module: 'message',
      code: `MSG-${Date.now()}`,
      title: msgTitle.trim(),
      subtitle: `From: ${userProfile.displayName} (${userProfile.role.toUpperCase()})`,
      category: 'Institute Communication',
      status: 'Unread',
      branchId: userProfile.branchId || 'MAIN',
      courseId: 'ALL',
      batchId: 'ALL',
      targetUserId: 'INSTITUTE',
      numericValue: 1,
      secondaryNumericValue: 0,
      dateStr: new Date().toLocaleString(),
      notes: msgBody.trim(),
      extra1: userProfile.username,
      extra2: userProfile.role,
      extra3: '',
      extra4: '',
      visibility: 'institute',
    });
    setMsgTitle('');
    setMsgBody('');
  };

  // Course color palette helper matching Screenshot 2 ("Our Courses")
  const getCourseCardStyle = (index: number) => {
    const styles = [
      {
        card: 'bg-gradient-to-br from-rose-50 to-orange-100/90 border-rose-200',
        iconBg: 'bg-gradient-to-br from-red-500 to-orange-500 text-white',
      },
      {
        card: 'bg-gradient-to-br from-emerald-50 to-teal-100/90 border-emerald-200',
        iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
      },
      {
        card: 'bg-gradient-to-br from-teal-50 to-cyan-100/90 border-teal-200',
        iconBg: 'bg-gradient-to-br from-emerald-600 to-amber-500 text-white',
      },
      {
        card: 'bg-gradient-to-br from-amber-50 to-orange-100/90 border-amber-200',
        iconBg: 'bg-gradient-to-br from-amber-500 to-purple-600 text-white',
      },
    ];
    return styles[index % styles.length];
  };

  // ============================================================================
  // RENDER STUDENT PORTAL (Native Android Mobile App Shell)
  // ============================================================================
  if (activePortal === 'student') {
    return (
      <div className="min-h-screen flex items-center justify-center py-3 px-2 sm:px-4">
        <div
          className={`w-full max-w-[440px] mx-auto rounded-[42px] shadow-[0_25px_70px_rgba(2,6,23,0.85)] border-[6px] border-[#1D3B9E]/60 overflow-hidden flex flex-col h-[860px] max-h-[94vh] relative transition-colors ${
            studentDarkMode
              ? 'bg-gradient-to-b from-[#040B29] via-[#0B1536] to-[#0F172A] text-white'
              : 'bg-gradient-to-b from-[#0A1E6E] via-[#EEF4FF] to-[#F8FAFC]'
          }`}
        >
          {/* Top Native Android Status Bar + Punch-Hole Camera */}
          <div className="flex items-center justify-between px-6 pt-3 pb-1.5 text-xs font-semibold text-blue-100 bg-[#0A1E6E] shrink-0">
            <span>9:41</span>
            <div className="w-20 h-4 bg-black/80 rounded-full mx-auto flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-slate-800 border border-slate-600" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono">5G</span>
              <span className="text-[10px] font-mono">100%</span>
            </div>
          </div>

          {/* Student Portal Sub-Bar: All Branches + QR Code Scanner + Dark Mode */}
          <div className="px-4 py-2 bg-[#081754] border-b border-blue-400/20 flex items-center justify-between gap-2 shrink-0">
            <div className="px-3 py-1 rounded-full bg-white/15 border border-blue-300/30 text-[11px] font-display font-bold text-cyan-100 flex items-center gap-1.5">
              <span>All Branches ({String(Math.max(branches.length, 1)).padStart(2, '0')})</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 text-[#04103B] text-[11px] font-display font-extrabold flex items-center gap-1 shadow cursor-pointer hover:brightness-110 transition-all"
                title="Scan Attendance QR Code"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR Code</span>
              </button>

              <button
                type="button"
                onClick={() => setStudentDarkMode((prev) => !prev)}
                className={`px-3 py-1 rounded-full text-[11px] font-display font-extrabold flex items-center gap-1 border transition-all cursor-pointer ${
                  studentDarkMode
                    ? 'bg-amber-400 text-[#05113B] border-amber-300 shadow'
                    : 'bg-[#040D33] text-blue-100 border-blue-400/30 hover:bg-white/10'
                }`}
                title="Toggle Dark Mode"
              >
                <span>{studentDarkMode ? '☀ Light' : '🌙 Dark Mode'}</span>
              </button>
            </div>
          </div>

          {/* Scrollable Middle Area (Keeps Bottom Navigation Bar Permanently Visible!) */}
          <div className="flex-1 overflow-y-auto">
            {studentSubScreen === 'ai_tutor' || (!studentSubScreen && studentTab === 'ai_tutor') ? (
              <div className="p-3">
                <EduSyncAiTutor
                  studentName={userProfile.displayName}
                  onBack={() => {
                    setStudentSubScreen(null);
                    setStudentTab('home');
                  }}
                />
              </div>
            ) : studentSubScreen === 'live_class' ? (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-extrabold text-sm text-white bg-[#0A184E] px-3.5 py-1.5 rounded-full">
                    Agora Live Online Classroom
                  </h2>
                  <button
                    onClick={() => setStudentSubScreen(null)}
                    className="px-3 py-1 rounded-full bg-white text-[#0A184E] text-xs font-bold shadow cursor-pointer"
                  >
                    ← Back
                  </button>
                </div>
                <AgoraLiveClassRoom
                  userRole="student"
                  userName={userProfile.displayName}
                  userId={userProfile.username}
                  batches={batches}
                  selectedBatchCode={primaryBatch?.code}
                  erpRecords={erpRecords}
                  onCreateErpRecord={onCreateErpRecord}
                  onUpdateErpRecordStatus={onUpdateErpRecordStatus}
                />
              </div>
            ) : (
              <>
                {/* Royal Blue Curved Header */}
                <div className="px-6 pt-3 pb-6 bg-gradient-to-b from-[#0B1E6E] to-[#1739A6] text-white rounded-b-[32px] shadow-lg">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-300 to-blue-400 p-0.5 shadow-md shrink-0 overflow-hidden">
                        {activeStudentPhotoUrl && activeStudentPhotoUrl.startsWith('data:image') ? (
                          <img
                            src={activeStudentPhotoUrl}
                            alt={userProfile.displayName}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-[#0A184E] flex items-center justify-center font-display font-bold text-xl text-white">
                            {userProfile.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-blue-200 font-medium">Welcome Back,</p>
                        <h1 className="font-display font-extrabold text-xl leading-tight">
                          {userProfile.displayName}
                        </h1>
                        <p className="text-xs text-blue-200 font-mono mt-0.5">
                          Student ID: {userProfile.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSeenNotifCount(notificationRecords.length);
                          setStudentSubScreen('notifications');
                        }}
                        className="relative w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors cursor-pointer"
                        title="Notifications (Click to view & reset count to 0)"
                      >
                        <Bell className="w-5 h-5 text-white" />
                        <span
                          className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${
                            unreadNotifCount > 0 ? 'bg-red-500' : 'bg-emerald-500'
                          }`}
                        >
                          {unreadNotifCount}
                        </span>
                      </button>
                    </div>
                  </div>

                    {/* Batch & Branch Bar matching Screenshot 2 */}
                    <button
                      onClick={() => {
                        setStudentSubScreen(null);
                        setStudentTab('courses');
                      }}
                      className="mt-4 w-full px-4 py-2.5 rounded-2xl bg-white/90 text-[#0A184E] flex items-center justify-between shadow-md"
                    >
                      <div className="flex items-center gap-3 text-left">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-display font-bold text-sm">
                            {primaryBatch
                              ? `${primaryBatch.courseName} - ${primaryBatch.name}`
                              : courses[0]
                              ? courses[0].name
                              : 'No Batch Assigned Yet'}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Branch: {primaryBranchName}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-blue-700" />
                    </button>
                  </div>

                  {/* Body Area */}
                  <div className="p-5 space-y-5">
                    {/* SUB-SCREENS */}
                    {studentSubScreen === 'results' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="font-display font-bold text-lg text-[#0A184E]">
                            My Results
                          </h2>
                          <button
                            onClick={() => setStudentSubScreen(null)}
                            className="text-xs font-semibold text-blue-700 hover:underline"
                          >
                            Back to Home
                          </button>
                        </div>

                        {/* Overall Percentage Trophy Card matching Screenshot 2 */}
                        <div className="rounded-3xl bg-white p-5 shadow-md border border-blue-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
                                <Trophy className="w-8 h-8" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-slate-500">
                                  Overall Percentage
                                </div>
                                <div className="font-mono font-extrabold text-3xl text-[#0A184E] tabular-nums">
                                  {overallResultPercentage.toFixed(2)}%
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => window.print()}
                              className="p-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100"
                              title="Print Result"
                            >
                              <Printer className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Course-wise Result List (With 2-Minute Delayed Automatic Reveal) */}
                          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
                            {resultRecords.length === 0 ? (
                              <p className="text-xs text-slate-500 text-center py-4">
                                No published examination results in Firestore yet. Complete a 50-MCQ exam to view your automated result after 2 minutes.
                              </p>
                            ) : (
                              resultRecords.map((res) => {
                                const pubMs = Number(res.extra3);
                                const isPending2Min = pubMs > 0 && nowMs < pubMs;
                                const waitSec = isPending2Min
                                  ? Math.max(0, Math.ceil((pubMs - nowMs) / 1000))
                                  : 0;
                                return (
                                  <div
                                    key={res.id}
                                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/70"
                                  >
                                    <div>
                                      <div className="font-display font-bold text-sm text-[#0A184E]">
                                        {res.title}
                                      </div>
                                      <div className="text-[11px] text-slate-500">
                                        {res.category} • {res.dateStr}
                                      </div>
                                    </div>
                                    {isPending2Min ? (
                                      <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs font-mono font-bold">
                                        ⏳ Result in {Math.floor(waitSec / 60)}:
                                        {String(waitSec % 60).padStart(2, '0')}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-3">
                                        <span className="font-mono font-bold text-sm text-slate-800 tabular-nums">
                                          {Number(res.numericValue).toFixed(2)}%
                                        </span>
                                        <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800">
                                          {res.extra1 ||
                                            calculateGrade(Number(res.numericValue)).grade}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {studentSubScreen === 'fees' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="font-display font-bold text-lg text-[#0A184E]">
                            Official Fee Receipts (Issued by Admin)
                          </h2>
                          <button
                            onClick={() => setStudentSubScreen(null)}
                            className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                          >
                            Back to Home
                          </button>
                        </div>

                        {/* Total Paid & Pending Summary */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-3xl bg-white p-4 shadow-md border border-blue-100 flex items-center justify-between">
                            <div>
                              <div className="text-xs text-slate-500 font-medium">Total Paid</div>
                              <div className="font-mono font-extrabold text-xl text-[#0A184E] tabular-nums">
                                ₹ {totalFeePaid.toLocaleString('en-IN')}
                              </div>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                              <Check className="w-4 h-4" />
                            </div>
                          </div>

                          <div className="rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-md border border-amber-200 flex items-center justify-between">
                            <div>
                              <div className="text-xs text-amber-900 font-medium">Pending Fee</div>
                              <div className="font-mono font-extrabold text-xl text-red-600 tabular-nums">
                                ₹ {totalFeePending.toLocaleString('en-IN')}
                              </div>
                            </div>
                            <Clock className="w-6 h-6 text-amber-600" />
                          </div>
                        </div>

                        {/* Admin-Only Notice Banner */}
                        <div className="rounded-2xl bg-blue-50/90 border border-blue-200 p-3.5 text-xs text-[#0A184E] font-medium">
                          Fee payments and official receipts are generated exclusively from the Institute Admin Portal. Once the Admin marks your fee as <span className="font-extrabold text-emerald-700">Paid</span>, your verified PDF receipt appears below for download.
                        </div>

                        {/* Fee Receipts List with PDF Download */}
                        <div className="rounded-3xl bg-white p-4 shadow-md border border-blue-100 space-y-3">
                          <div className="font-display font-bold text-sm text-[#0A184E]">
                            Official Fee Receipts (Download PDF)
                          </div>
                          {feeRecords.length === 0 ? (
                            <p className="text-xs text-slate-500 py-4 text-center">
                              No fee receipts issued yet. Your official receipt will appear here automatically once the Admin records your fee payment as Paid.
                            </p>
                          ) : (
                            feeRecords.map((fee) => (
                              <div
                                key={fee.id}
                                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/70 gap-2"
                              >
                                <div>
                                  <div className="font-display font-bold text-sm text-slate-900">
                                    Receipt #{fee.code} • ₹
                                    {Number(fee.numericValue).toLocaleString('en-IN')}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Date: {fee.dateStr} • Mode: {fee.extra1 || 'UPI'} •{' '}
                                    <span className="font-bold text-emerald-700">{fee.status}</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    downloadOfficialFeeReceiptPdf({
                                      receiptNo: fee.code,
                                      studentName: userProfile.displayName,
                                      studentId: userProfile.username,
                                      courseName: fee.category || 'ADCA',
                                      amount: Number(fee.numericValue) || 0,
                                      dateStr: fee.dateStr,
                                      paymentMode: fee.extra1 || 'UPI',
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Receipt PDF</span>
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {studentSubScreen === 'materials' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="font-display font-bold text-lg text-[#0A184E]">
                            Assignments &amp; Study Materials
                          </h2>
                          <button
                            onClick={() => setStudentSubScreen(null)}
                            className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                          >
                            Back to Home
                          </button>
                        </div>

                        {materialRecords.length === 0 ? (
                          <div className="rounded-3xl bg-white p-6 text-center border border-blue-100 shadow-sm">
                            <PlayCircle className="w-10 h-10 text-blue-600 mx-auto mb-2" />
                            <h3 className="font-display font-bold text-sm text-slate-800">
                              No Assignments or Study Materials Yet
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                              Assignments and gallery/file attachments sent by Admin or Teacher appear here immediately.
                            </p>
                          </div>
                        ) : (
                          materialRecords.map((mat) => {
                            const attachedFile = getMediaAttachment(mat.code, mat.extra4);
                            return (
                              <div
                                key={mat.id}
                                className="rounded-2xl bg-white p-4 shadow-sm border border-blue-100 space-y-2.5"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase mb-1">
                                      {mat.module}
                                    </span>
                                    <div className="font-display font-bold text-sm text-[#0A184E]">
                                      {mat.title}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {mat.category} • {mat.subtitle}
                                    </div>
                                    {mat.notes && (
                                      <p className="text-xs text-slate-700 mt-1.5">{mat.notes}</p>
                                    )}
                                  </div>
                                  <span className="text-xs font-mono text-blue-700 font-semibold shrink-0">
                                    {mat.dateStr}
                                  </span>
                                </div>

                                {attachedFile && attachedFile.startsWith('data:image') && (
                                  <div className="pt-1">
                                    <img
                                      src={attachedFile}
                                      alt={mat.title}
                                      className="w-full max-h-56 object-contain rounded-xl border border-slate-200 bg-slate-50"
                                    />
                                  </div>
                                )}

                                {attachedFile && (
                                  <a
                                    href={attachedFile}
                                    download={
                                      mat.extra3?.replace('FILE:', '') || `${mat.code}-attachment`
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download Attached Assignment File</span>
                                  </a>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {studentSubScreen === 'certificates' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="font-display font-bold text-lg text-[#0A184E]">
                            Official Course Certificate
                          </h2>
                          <button
                            onClick={() => setStudentSubScreen(null)}
                            className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                          >
                            Back to Home
                          </button>
                        </div>

                        {/* Certificate Card (Generated for every student, Locked until Course Duration completes) */}
                        {(certificateRecords.length > 0
                          ? certificateRecords
                          : [
                              {
                                id: 'CERT-DEFAULT-LOCKED',
                                code: `CERT-${userProfile.username}`,
                                title: 'Diploma in Computer Application (ADCA)',
                                subtitle: `Awarded to ${userProfile.displayName}`,
                                category: 'ADCA',
                                status: 'Locked',
                                dateStr: new Date().toISOString().split('T')[0],
                                notes: 'Locked until 12 Months Course Duration Completes',
                                extra1: 'Pending Course Completion',
                                extra2: 'Main Campus',
                                extra3: '12 Months (Locked until Course Duration Completes)',
                                extra4: 'LOCKED_UNTIL_COMPLETION',
                              },
                            ]
                        ).map((cert) => {
                          const isCertLocked =
                            cert.status.toLowerCase() === 'locked' ||
                            cert.extra4 === 'LOCKED_UNTIL_COMPLETION';
                          return (
                            <div
                              key={cert.id}
                              className="rounded-3xl bg-gradient-to-br from-[#060F33] via-[#09184D] to-[#0A184E] text-white p-6 shadow-2xl border-4 border-amber-400/80 relative overflow-hidden"
                            >
                              {/* Locked Overlay until Course Duration Completes */}
                              {isCertLocked && (
                                <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/20 border-2 border-amber-300/70 flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-amber-400 text-[#060F33] flex items-center justify-center shrink-0 shadow">
                                    <Lock className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <div className="font-display font-extrabold text-xs sm:text-sm text-amber-200">
                                      🔒 Certificate Locked Until Course Duration Completes
                                    </div>
                                    <div className="text-[11px] text-blue-100 mt-0.5">
                                      Your certificate is generated and reserved in Cloud, and will automatically unlock once your course duration ({cert.extra3 || '12 Months'}) is completed.
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Top Golden Header */}
                              <div className="flex items-center justify-between border-b border-amber-400/30 pb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-amber-400 text-[#060F33] flex items-center justify-center font-display font-black text-sm shadow">
                                    WI
                                  </div>
                                  <div>
                                    <h3 className="font-display font-black text-base tracking-widest text-amber-300 uppercase">
                                      WAQAR INSTITUTE
                                    </h3>
                                    <span className="text-[10px] text-blue-200 uppercase tracking-wider block">
                                      Autonomous Computer Training &amp; Skill Development
                                    </span>
                                  </div>
                                </div>
                                <Award className="w-8 h-8 text-amber-400 shrink-0" />
                              </div>

                              {/* Center Certificate Body */}
                              <div
                                className={`my-5 text-center space-y-2 ${
                                  isCertLocked ? 'opacity-75' : ''
                                }`}
                              >
                                <div className="text-[11px] uppercase tracking-widest text-blue-200">
                                  This is to certify that
                                </div>
                                <div className="font-display font-extrabold text-2xl text-amber-200 tracking-wide">
                                  {userProfile.displayName}
                                </div>
                                <div className="text-xs text-blue-200 font-mono">
                                  Student ID: {userProfile.username}
                                </div>
                                <div className="font-display font-extrabold text-lg text-white pt-1">
                                  {cert.title}
                                </div>
                                <div className="text-xs text-amber-300 font-semibold">
                                  Course Duration: {cert.extra3 || '12 Months'}
                                </div>
                              </div>

                              {isCertLocked ? (
                                <button
                                  type="button"
                                  disabled
                                  className="mt-4 w-full py-3 rounded-xl bg-white/10 border border-amber-300/40 text-amber-200 font-display font-extrabold text-xs flex items-center justify-center gap-2 opacity-90 cursor-not-allowed"
                                >
                                  <Lock className="w-4 h-4" />
                                  <span>Locked Until Course Duration Completes</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => window.print()}
                                  className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#060F33] font-display font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                                >
                                  <Printer className="w-4 h-4" />
                                  <span>Print / Download Unlocked Certificate PDF</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {studentSubScreen === 'idcard' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="font-display font-bold text-lg text-[#0A184E]">
                            Digital Student ID Card
                          </h2>
                          <button
                            onClick={() => setStudentSubScreen(null)}
                            className="text-xs font-semibold text-blue-700 hover:underline"
                          >
                            Back to Home
                          </button>
                        </div>

                        <div className="rounded-3xl bg-gradient-to-b from-[#0A184E] via-[#153194] to-[#0A184E] text-white p-6 shadow-2xl border-2 border-blue-300/40 text-center">
                          <WaqarCrestLogo size="sm" showSubtitle={true} lightText={true} />
                          {activeStudentPhotoUrl && activeStudentPhotoUrl.startsWith('data:image') ? (
                            <img
                              src={activeStudentPhotoUrl}
                              alt={userProfile.displayName}
                              className="w-20 h-20 rounded-full object-cover mx-auto mt-4 border-4 border-amber-400 shadow-lg"
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-full bg-white text-[#0A184E] font-display font-extrabold text-3xl flex items-center justify-center mx-auto mt-4 border-4 border-amber-400 shadow-lg">
                              {userProfile.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <h3 className="font-display font-extrabold text-xl mt-3">
                            {userProfile.displayName}
                          </h3>
                          <p className="font-mono text-xs text-amber-300 mt-0.5">
                            ID: {userProfile.username}
                          </p>
                          <div className="mt-4 bg-white/10 rounded-2xl p-3 text-xs text-blue-100 space-y-1 text-left">
                            <div>Role: <strong className="text-white uppercase">{userProfile.role}</strong></div>
                            <div>Branch: <strong className="text-white">{primaryBranchName}</strong></div>
                            <div>Email: <strong className="text-white">{userProfile.email}</strong></div>
                          </div>
                          <div className="mt-4 inline-flex flex-col items-center bg-white p-3 rounded-2xl text-[#0A184E]">
                            <QrCode className="w-16 h-16" />
                            <span className="font-mono text-[10px] font-bold mt-1">
                              {userProfile.username}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {studentSubScreen === 'notifications' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="font-display font-bold text-lg text-[#0A184E]">
                            Institute Notifications
                          </h2>
                          <button
                            onClick={() => setStudentSubScreen(null)}
                            className="text-xs font-semibold text-blue-700 hover:underline"
                          >
                            Back to Home
                          </button>
                        </div>
                        {notificationRecords.length === 0 ? (
                          <div className="rounded-3xl bg-white p-6 text-center border border-blue-100">
                            <p className="text-xs text-slate-500">
                              No notifications published in Firestore yet.
                            </p>
                          </div>
                        ) : (
                          notificationRecords.map((n) => (
                            <div
                              key={n.id}
                              className="rounded-2xl bg-white p-4 border border-blue-100 shadow-sm"
                            >
                              <div className="font-display font-bold text-sm text-[#0A184E]">
                                {n.title}
                              </div>
                              <p className="text-xs text-slate-600 mt-1">{n.notes || n.subtitle}</p>
                              <div className="text-[10px] text-slate-400 font-mono mt-1.5">
                                {n.dateStr}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* MAIN BOTTOM-TAB VIEWS WHEN NO SUB-SCREEN IS ACTIVE */}
                    {!studentSubScreen && studentTab === 'home' && (
                      <>
                        {/* Attendance Circular Ring Card matching Screenshot 2 */}
                        <div className="rounded-3xl bg-gradient-to-r from-[#1A3CE0] via-[#3A5BF6] to-[#6D4AFF] text-white p-5 shadow-lg flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <CircularProgressRing
                              percentage={attendancePercentage}
                              size={74}
                              strokeWidth={8}
                              color="#FBBF24"
                            />
                            <div>
                              <div className="text-xs text-blue-100 font-medium">Attendance</div>
                              <div className="font-mono font-extrabold text-3xl tabular-nums">
                                {attendancePercentage}%
                              </div>
                              <div className="text-[11px] text-blue-200 mt-0.5">
                                {presentCount} / {myAttendanceRecords.length} Classes Recorded
                              </div>
                            </div>
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-white" />
                          </div>
                        </div>

                        {/* 6 Colorful Grid Tiles matching Screenshot 2 */}
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            {
                              label: 'My Courses',
                              icon: BookOpen,
                              bg: 'from-blue-50 to-indigo-100/80 border-blue-200',
                              iconBg: 'bg-blue-600 text-white',
                              onClick: () => setStudentTab('courses'),
                            },
                            {
                              label: 'My Exams',
                              icon: FileText,
                              bg: 'from-cyan-50 to-blue-100/80 border-cyan-200',
                              iconBg: 'bg-indigo-600 text-white',
                              onClick: () => setStudentTab('exams'),
                            },
                            {
                              label: 'Results',
                              icon: Trophy,
                              bg: 'from-amber-50 to-orange-100/80 border-amber-200',
                              iconBg: 'bg-amber-500 text-white',
                              onClick: () => setStudentSubScreen('results'),
                            },
                            {
                              label: 'Study Material',
                              icon: PlayCircle,
                              bg: 'from-purple-50 to-fuchsia-100/80 border-purple-200',
                              iconBg: 'bg-purple-600 text-white',
                              onClick: () => setStudentSubScreen('materials'),
                            },
                            {
                              label: 'Fee Records',
                              icon: Wallet,
                              bg: 'from-emerald-50 to-teal-100/80 border-emerald-200',
                              iconBg: 'bg-emerald-600 text-white',
                              onClick: () => setStudentSubScreen('fees'),
                            },
                            {
                              label: 'Certificates',
                              icon: Award,
                              bg: 'from-yellow-50 to-amber-100/80 border-amber-200',
                              iconBg: 'bg-amber-600 text-white',
                              onClick: () => setStudentSubScreen('certificates'),
                            },
                          ].map((tile) => {
                            const IconComp = tile.icon;
                            return (
                              <button
                                key={tile.label}
                                onClick={tile.onClick}
                                className={`p-3.5 rounded-2xl bg-gradient-to-b ${tile.bg} border shadow-sm hover:shadow-md flex flex-col items-center justify-center gap-2 transition-transform active:scale-95`}
                              >
                                <div
                                  className={`w-11 h-11 rounded-2xl ${tile.iconBg} flex items-center justify-center shadow`}
                                >
                                  <IconComp className="w-5 h-5" />
                                </div>
                                <span className="font-display font-bold text-xs text-[#0A184E] whitespace-nowrap">
                                  {tile.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Live Online Class Banner (Join When Teacher Unlocks) */}
                        <button
                          type="button"
                          onClick={() => setStudentSubScreen('live_class')}
                          className="w-full p-4 rounded-3xl bg-gradient-to-r from-[#07164E] via-[#1E3A8A] to-[#3B27BA] text-white shadow-md flex items-center justify-between border border-cyan-300/40 cursor-pointer"
                        >
                          <div className="flex items-center gap-3 text-left">
                            <div className="w-11 h-11 rounded-2xl bg-rose-500/25 border border-rose-300/40 flex items-center justify-center">
                              <Video className="w-5 h-5 text-rose-300" />
                            </div>
                            <div>
                              <div className="font-display font-extrabold text-sm">
                                Join Agora Live Online Class
                              </div>
                              <div className="text-[11px] text-cyan-200">
                                Live Video, Audio &amp; Two-Way Doubt Chat with Teacher
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-cyan-200" />
                        </button>

                        {/* Today's Schedule Section matching Screenshot 2 */}
                        <div>
                          <div className="flex items-center justify-between mb-2.5">
                            <h3 className="font-display font-bold text-sm text-[#0A184E]">
                              Today&apos;s Schedule
                            </h3>
                            <button
                              onClick={() => setStudentTab('courses')}
                              className="text-xs font-semibold text-blue-700 flex items-center gap-1"
                            >
                              <span>View All</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {batches.length === 0 && timetableRecords.length === 0 ? (
                            <div className="rounded-2xl bg-white p-4 border border-blue-100 shadow-sm text-xs text-slate-500">
                              No scheduled classes found in Firestore yet. Classes scheduled by Admin/Teacher appear here automatically.
                            </div>
                          ) : (
                            (batches.length > 0 ? batches.slice(0, 2) : []).map((b) => (
                              <div
                                key={b.id}
                                className="rounded-2xl bg-white p-3.5 border border-blue-100 shadow-sm flex items-center gap-3 mb-2"
                              >
                                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                  <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="font-display font-bold text-sm text-[#0A184E]">
                                    {b.courseName} ({b.name})
                                  </div>
                                  <div className="text-xs text-slate-500 font-mono">{b.timing}</div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}

                    {/* TAB 2: ADMIN-CREATED COURSES ONLY (With Duration Time Prominently Set & Displayed) */}
                    {!studentSubScreen && studentTab === 'courses' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h2 className="font-display font-extrabold text-lg text-[#0A184E]">
                              Institute Courses
                            </h2>
                            <p className="text-[11px] text-slate-500">
                              Showing only official courses created by the Admin with set Duration Time
                            </p>
                          </div>
                          {showCourseSearch ? (
                            <div className="relative flex-1 max-w-[180px] flex items-center gap-1">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                value={courseSearch}
                                onChange={(e) => setCourseSearch(e.target.value)}
                                placeholder="Search course..."
                                autoFocus
                                className="w-full pl-8 pr-7 py-1.5 rounded-full bg-white border border-blue-300 text-xs focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setCourseSearch('');
                                  setShowCourseSearch(false);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                                title="Close Search"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowCourseSearch(true)}
                              className="px-3 py-1.5 rounded-full bg-white border border-blue-200 text-xs font-bold text-[#0A184E] flex items-center gap-1.5 shadow-sm cursor-pointer"
                              title="Search Course"
                            >
                              <Search className="w-3.5 h-3.5 text-blue-600" />
                              <span>Search</span>
                            </button>
                          )}
                        </div>

                        {adminCreatedCourses.length === 0 ? (
                          <div className="rounded-3xl bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 text-center border border-blue-200 shadow-sm space-y-2">
                            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow">
                              <BookOpen className="w-6 h-6" />
                            </div>
                            <h3 className="font-display font-extrabold text-sm text-[#0A184E]">
                              Official Institute Curriculum &amp; Duration Schedule
                            </h3>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Your enrolled courses and their official Duration Time appear here automatically as soon as they are published from the protected Admin Portal.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {adminCreatedCourses
                              .filter(
                                (c) =>
                                  c.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
                                  c.code.toLowerCase().includes(courseSearch.toLowerCase())
                              )
                              .map((course, idx) => {
                                const st = getCourseCardStyle(idx);
                                return (
                                  <div
                                    key={course.id}
                                    className={`rounded-3xl p-4 border shadow-sm flex flex-col items-center text-center ${st.card}`}
                                  >
                                    <div
                                      className={`w-12 h-12 rounded-2xl ${st.iconBg} flex items-center justify-center font-display font-extrabold text-sm shadow-md mb-2.5`}
                                    >
                                      {course.code.slice(0, 4)}
                                    </div>
                                    <h3 className="font-display font-extrabold text-base text-[#0A184E]">
                                      {course.code}
                                    </h3>
                                    <p className="text-xs text-slate-700 font-semibold line-clamp-2 mt-0.5">
                                      {course.name}
                                    </p>
                                    {/* Prominent Course Duration Badge */}
                                    <div className="mt-2.5 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-mono font-extrabold flex items-center gap-1 shadow-xs">
                                      <Clock className="w-3 h-3" />
                                      <span>Duration: {course.duration || '12 Months'}</span>
                                    </div>
                                    <div className="mt-1.5 text-[11px] font-mono font-bold text-slate-700">
                                      Course Fee: ₹{course.fee.toLocaleString('en-IN')}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 3: EXAMINATIONS (Matches "Examinations" screen in Screenshot 2) */}
                    {!studentSubScreen && studentTab === 'exams' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="font-display font-extrabold text-lg text-[#0A184E]">
                            Examinations
                          </h2>
                        </div>

                        {/* Segmented Tabs: Upcoming | Completed | Results */}
                        <div className="flex items-center bg-white p-1 rounded-full border border-blue-200 shadow-sm">
                          {(['upcoming', 'completed', 'results'] as const).map((tabKey) => (
                            <button
                              key={tabKey}
                              onClick={() => setExamFilter(tabKey)}
                              className={`flex-1 py-2 rounded-full text-xs font-display font-bold capitalize transition-colors ${
                                examFilter === tabKey
                                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow'
                                  : 'text-slate-600 hover:text-[#0A184E]'
                              }`}
                            >
                              {tabKey}
                            </button>
                          ))}
                        </div>

                        {/* Live 50-MCQ Exam Runner if student clicked Start Exam */}
                        {activeExam ? (
                          <div className="rounded-3xl bg-white p-5 border-2 border-blue-500 shadow-xl space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <div>
                                <span className="text-[10px] font-bold uppercase text-blue-600">
                                  Live 50-MCQ Examination • Anti-Split-Screen Active
                                </span>
                                <h3 className="font-display font-extrabold text-base text-[#0A184E]">
                                  {activeExam.title}
                                </h3>
                              </div>
                              <div className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 font-mono font-bold text-xs tabular-nums">
                                {Math.floor(examSecondsLeft / 60)}:
                                {String(examSecondsLeft % 60).padStart(2, '0')}
                              </div>
                            </div>

                            {(() => {
                              const questions =
                                activeExamQuestions.length > 0
                                  ? activeExamQuestions
                                  : generate50McqQuestionBank(activeExam.courseId || 'ADCA');
                              const currentQ = questions[currentMcqIndex] || questions[0];
                              const answeredCount = Object.keys(selectedAnswers).length;

                              return (
                                <>
                                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                                    <span>
                                      Question {currentMcqIndex + 1} of {questions.length}
                                    </span>
                                    <span className="font-mono text-blue-700">
                                      Answered: {answeredCount} / {questions.length}
                                    </span>
                                  </div>

                                  {/* Quick Question Number Selector Strip */}
                                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                                    {questions.map((qItem, idx) => {
                                      const isAnswered = Boolean(selectedAnswers[idx]);
                                      const isCurrent = idx === currentMcqIndex;
                                      return (
                                        <button
                                          key={qItem.id}
                                          type="button"
                                          onClick={() => setCurrentMcqIndex(idx)}
                                          className={`w-7 h-7 rounded-lg font-mono text-[11px] font-bold shrink-0 cursor-pointer ${
                                            isCurrent
                                              ? 'bg-blue-600 text-white shadow'
                                              : isAnswered
                                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                              : 'bg-slate-100 text-slate-600'
                                          }`}
                                        >
                                          {idx + 1}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                                    <div className="font-display font-bold text-sm text-slate-900">
                                      Q{currentMcqIndex + 1}. {currentQ.question}
                                    </div>
                                    <div className="mt-3 space-y-2">
                                      {(
                                        [
                                          { key: 'A', label: currentQ.optionA },
                                          { key: 'B', label: currentQ.optionB },
                                          { key: 'C', label: currentQ.optionC },
                                          { key: 'D', label: currentQ.optionD },
                                        ] as const
                                      ).map((opt) => (
                                        <button
                                          key={opt.key}
                                          type="button"
                                          onClick={() =>
                                            setSelectedAnswers((prev) => ({
                                              ...prev,
                                              [currentMcqIndex]: opt.key,
                                            }))
                                          }
                                          className={`w-full text-left px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                                            selectedAnswers[currentMcqIndex] === opt.key
                                              ? 'bg-blue-600 text-white border-blue-600'
                                              : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50'
                                          }`}
                                        >
                                          <span>
                                            {opt.key}. {opt.label}
                                          </span>
                                          {selectedAnswers[currentMcqIndex] === opt.key && (
                                            <Check className="w-4 h-4" />
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-2">
                                    <button
                                      type="button"
                                      disabled={currentMcqIndex === 0}
                                      onClick={() =>
                                        setCurrentMcqIndex((prev) => Math.max(0, prev - 1))
                                      }
                                      className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
                                    >
                                      Previous
                                    </button>
                                    {currentMcqIndex < questions.length - 1 ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCurrentMcqIndex((prev) =>
                                            Math.min(questions.length - 1, prev + 1)
                                          )
                                        }
                                        className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
                                      >
                                        Next Question -&gt;
                                      </button>
                                    ) : null}
                                  </div>
                                </>
                              );
                            })()}

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                              <button
                                onClick={() => handleSubmitExamAttempt(false)}
                                disabled={submittingExam}
                                className="flex-1 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-display font-extrabold text-xs shadow-md cursor-pointer"
                              >
                                {submittingExam
                                  ? 'Submitting Answer Sheet...'
                                  : 'Finish & Submit Exam (Result Auto-Publishes in 2 Mins)'}
                              </button>
                              <button
                                onClick={() => setActiveExam(null)}
                                className="px-4 py-3 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold cursor-pointer"
                              >
                                Exit
                              </button>
                            </div>
                          </div>
                        ) : examFilter === 'results' ? (
                          <div className="space-y-3">
                            {resultRecords.length === 0 ? (
                              <div className="rounded-3xl bg-white p-6 text-center border border-blue-100 text-xs text-slate-500">
                                No exam results recorded yet. Complete a 50-MCQ exam and your result will appear here automatically after 2 minutes.
                              </div>
                            ) : (
                              resultRecords.map((r) => {
                                const pubMs = Number(r.extra3);
                                const isWaiting2Min = pubMs > 0 && nowMs < pubMs;
                                const waitSeconds = isWaiting2Min
                                  ? Math.max(0, Math.ceil((pubMs - nowMs) / 1000))
                                  : 0;
                                return (
                                  <div
                                    key={r.id}
                                    className="rounded-2xl bg-white p-4 border border-blue-100 shadow-sm flex items-center justify-between"
                                  >
                                    <div>
                                      <div className="font-display font-bold text-sm text-[#0A184E]">
                                        {r.title}
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        {r.dateStr} • {r.notes}
                                      </div>
                                    </div>
                                    {isWaiting2Min ? (
                                      <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 font-mono font-bold text-xs">
                                        ⏳ Auto-Result in {Math.floor(waitSeconds / 60)}:
                                        {String(waitSeconds % 60).padStart(2, '0')}
                                      </div>
                                    ) : (
                                      <div className="font-mono font-bold text-base text-blue-700 tabular-nums">
                                        {Number(r.numericValue).toFixed(1)}% ({r.extra1 || 'A'})
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        ) : (
                          <>
                            {examRecords.length === 0 ? (
                              <div className="rounded-3xl bg-white p-6 text-center border border-blue-100 shadow-sm">
                                <FileText className="w-10 h-10 text-blue-600 mx-auto mb-2" />
                                <h3 className="font-display font-bold text-sm text-[#0A184E]">
                                  No Scheduled Examinations in Firestore
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                  50-MCQ Exams scheduled by your Teacher or Admin in 24-hour time appear here automatically.
                                </p>
                              </div>
                            ) : (
                              examRecords.map((ex) => {
                                const withinSchedule = isWithin24HourSchedule(ex.extra1, ex.extra2);
                                return (
                                  <div
                                    key={ex.id}
                                    className="rounded-3xl bg-white p-5 border border-blue-100 shadow-md space-y-3"
                                  >
                                    <div className="flex items-start gap-4">
                                      <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                        <FileText className="w-7 h-7" />
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                          <h3 className="font-display font-extrabold text-base text-[#0A184E]">
                                            {ex.title}
                                          </h3>
                                          <span
                                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                              withinSchedule
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-amber-100 text-amber-800'
                                            }`}
                                          >
                                            {withinSchedule ? '24h Window Open' : 'Scheduled Window'}
                                          </span>
                                        </div>
                                        <p className="text-xs text-blue-700 font-semibold">
                                          {ex.subtitle}
                                        </p>
                                        <div className="text-xs text-slate-600 font-mono mt-1.5 space-y-0.5">
                                          <div>Date: {ex.dateStr}</div>
                                          <div>
                                            24-Hour Schedule: {ex.extra1 || '10:00'} to{' '}
                                            {ex.extra2 || '10:30'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {withinSchedule ? (
                                      <button
                                        onClick={() => handleStartStudentExam(ex)}
                                        className="w-full py-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-display font-bold text-xs shadow flex items-center justify-center gap-1.5 cursor-pointer"
                                      >
                                        <span>Start 50-MCQ Exam Now</span>
                                        <ArrowRight className="w-4 h-4" />
                                      </button>
                                    ) : (
                                      <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold text-center">
                                        Scheduled for {ex.extra1} to {ex.extra2} (24-Hour Time). Exam opens automatically during the scheduled time window.
                                      </div>
                                    )}

                                    <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                                      <div className="font-display font-bold text-[#0A184E]">
                                        Exam Security &amp; Result Rules
                                      </div>
                                      <p>1. 50 Multiple Choice Questions (4 Options each)</p>
                                      <p>2. Anti-Split-Screen &amp; Tab-Switch Protection Active</p>
                                      <p>3. Result publishes automatically 2 minutes after submission</p>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* TAB 4: ATTENDANCE (Student Portal ONLY has Scan Attendance QR Code — No QR Generator) */}
                    {!studentSubScreen && studentTab === 'attendance' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="font-display font-extrabold text-lg text-[#0A184E]">
                            My Attendance &amp; Scan QR
                          </h2>
                          <button
                            onClick={() => setScannerOpen(true)}
                            className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-95"
                          >
                            <Camera className="w-4 h-4" />
                            <span>Scan Attendance QR</span>
                          </button>
                        </div>

                        {/* Dedicated Student QR Scanner Launch Card (QR Generation is restricted to Admin & Teacher Portals) */}
                        <div className="rounded-3xl bg-white p-5 border-2 border-blue-200 shadow-md space-y-3 text-center">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center mx-auto shadow-md">
                            <QrCode className="w-7 h-7" />
                          </div>
                          <div>
                            <h3 className="font-display font-extrabold text-base text-[#0A184E]">
                              Scan Teacher / Admin Attendance QR Code
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                              Scan the 5-minute live QR code displayed by your Teacher or Admin to immediately mark your attendance Present in Cloud Firestore.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setScannerOpen(true)}
                            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-display font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Camera className="w-4 h-4" />
                            <span>Open Camera to Scan Attendance QR Code</span>
                          </button>
                        </div>

                        {/* Scanner Success Toast Notification */}
                        {scannerToast && (
                          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>{scannerToast}</span>
                            </div>
                            <button
                              onClick={() => setScannerToast(null)}
                              className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Attendance Summary Banner */}
                        <div className="rounded-3xl bg-gradient-to-r from-[#0077B6] via-[#0096C7] to-[#00B4D8] text-white p-5 shadow-md flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200">
                              Verified Attendance Rate
                            </span>
                            <div className="text-3xl font-display font-black mt-0.5">
                              {attendancePercentage}%
                            </div>
                            <div className="text-xs text-cyan-100 mt-1">
                              {presentCount} of {myAttendanceRecords.length} sessions attended
                            </div>
                          </div>
                          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center">
                            <Camera className="w-7 h-7 text-white" />
                          </div>
                        </div>

                        <div className="rounded-3xl bg-white p-4 border border-blue-100 shadow-sm space-y-2.5">
                          <div className="text-xs font-bold text-[#0A184E] px-1 pb-1 border-b border-slate-100 flex items-center justify-between">
                            <span>Recent Class Sessions</span>
                            <span className="font-mono text-slate-500">
                              {myAttendanceRecords.length} Records
                            </span>
                          </div>
                          {myAttendanceRecords.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-6">
                              No attendance entries recorded in Firestore yet. Generate or Scan your QR Code above during live lectures.
                            </p>
                          ) : (
                            myAttendanceRecords.map((att) => (
                              <div
                                key={att.id}
                                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/70"
                              >
                                <div>
                                  <div className="font-display font-bold text-sm text-[#0A184E]">
                                    {att.dateStr} • {att.subtitle}
                                  </div>
                                  <div className="text-xs text-slate-500">{att.notes}</div>
                                </div>
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    att.status.toLowerCase() === 'present'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : att.status.toLowerCase() === 'absent'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {att.status}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Camera QR Scanner Modal */}
                    {scannerOpen && (
                      <QrScannerModal
                        onScanSuccess={handleQrScanSuccess}
                        onClose={() => setScannerOpen(false)}
                      />
                    )}

                    {/* Anti-Cheat Alert Modal */}
                    {antiCheatWarningModal && (
                      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="waterfall-card rounded-3xl max-w-sm w-full p-6 text-[#03045E] shadow-2xl border-2 border-red-400">
                          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                            <ShieldAlert className="w-6 h-6" />
                          </div>
                          <h3 className="font-display font-extrabold text-base text-center text-red-700">
                            Anti-Cheat Security Warning
                          </h3>
                          <p className="text-xs text-slate-700 text-center mt-2 leading-relaxed font-medium">
                            {antiCheatWarningModal}
                          </p>
                          <button
                            onClick={() => setAntiCheatWarningModal(null)}
                            className="mt-5 w-full py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer"
                          >
                            I Understand &amp; Return to Exam
                          </button>
                        </div>
                      </div>
                    )}

                    {/* TAB 5: STRICT READ-ONLY STUDENT PROFILE (Student cannot edit anything; only view Attendance, Pay Fee & Download Receipt) */}
                    {!studentSubScreen && studentTab === 'profile' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="font-display font-extrabold text-lg text-[#0A184E]">
                            Verified Student Profile (Read-Only)
                          </h2>
                          <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>Admin Locked</span>
                          </span>
                        </div>

                        {(() => {
                          const stuPhoto = activeStudentPhotoUrl;
                          return (
                            <div className="rounded-3xl bg-white p-5 border border-blue-100 shadow-sm space-y-3">
                              <div className="flex items-center gap-4 border-b border-slate-100 pb-3">
                                {stuPhoto && stuPhoto.startsWith('data:image') ? (
                                  <img
                                    src={stuPhoto}
                                    alt={userProfile.displayName}
                                    className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-400 shadow"
                                  />
                                ) : (
                                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-display font-black text-2xl flex items-center justify-center shadow">
                                    {userProfile.displayName.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="font-display font-extrabold text-base text-[#0A184E]">
                                    {userProfile.displayName}
                                  </div>
                                  <div className="text-xs font-mono font-bold text-blue-700">
                                    Student ID: {userProfile.username}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    Branch: {primaryBranchName}
                                  </div>
                                </div>
                              </div>

                              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
                                Profile details are managed strictly by the Institute Administrator and cannot be edited by students. You can view your Attendance and download your Admin-issued Fee Receipts below.
                              </div>
                            </div>
                          );
                        })()}

                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            onClick={() => setStudentTab('attendance')}
                            className="p-3.5 rounded-2xl bg-white border border-blue-100 text-xs font-bold text-[#0A184E] flex items-center gap-2 shadow-sm cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                            <span>View Attendance</span>
                          </button>
                          <button
                            onClick={() => setStudentSubScreen('fees')}
                            className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-extrabold text-emerald-900 flex items-center gap-2 shadow-sm cursor-pointer"
                          >
                            <Wallet className="w-4 h-4 text-emerald-600" />
                            <span>Fee Receipts</span>
                          </button>
                          <button
                            onClick={() => setStudentSubScreen('certificates')}
                            className="p-3.5 rounded-2xl bg-white border border-blue-100 text-xs font-bold text-[#0A184E] flex items-center gap-2 shadow-sm cursor-pointer"
                          >
                            <Award className="w-4 h-4 text-amber-500" />
                            <span>Course Certificate</span>
                          </button>
                          <button
                            onClick={onLogout}
                            className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 flex items-center gap-2 shadow-sm cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
          </div>

          {/* 6-Tab Permanently Visible Student Bottom Navigation Bar + Spinning Fire Ring Canvas */}
          <div className="bg-white border-t border-blue-100 px-2 pt-1.5 pb-2 shrink-0">
            <div className="grid grid-cols-6 items-center">
              {(
                [
                  { id: 'home', label: 'Home', icon: Home },
                  { id: 'courses', label: 'Courses', icon: BookOpen },
                  { id: 'exams', label: 'Exams', icon: FileText },
                  { id: 'attendance', label: 'Attendance', icon: CheckCircle2 },
                  { id: 'ai_tutor', label: 'AI Tutor', icon: Sparkles },
                  { id: 'profile', label: 'Profile', icon: User },
                ] as const
              ).map((nav) => {
                const NavIcon = nav.icon;
                const active =
                  (nav.id === 'ai_tutor' && studentSubScreen === 'ai_tutor') ||
                  (!studentSubScreen && studentTab === nav.id);
                return (
                  <button
                    key={nav.id}
                    onClick={() => {
                      setStudentSubScreen(null);
                      setStudentTab(nav.id);
                    }}
                    className={`flex flex-col items-center justify-center py-0.5 rounded-xl transition-colors cursor-pointer ${
                      active ? 'text-cyan-600 font-extrabold' : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <FireRingCanvas active={active} size={34}>
                      <NavIcon className="w-4 h-4" />
                    </FireRingCanvas>
                    <span className="text-[10px] mt-0.5">{nav.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="w-32 h-1.5 rounded-full bg-slate-300 mx-auto mt-1.5" />
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER TEACHER PORTAL (Native Android Mobile App Shell)
  // ============================================================================
  if (activePortal === 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center py-3 px-2 sm:px-4">
        <div className="w-full max-w-[440px] mx-auto bg-gradient-to-b from-[#0A1E6E] via-[#EEF4FF] to-[#F8FAFC] rounded-[42px] shadow-[0_25px_70px_rgba(2,6,23,0.85)] border-[6px] border-[#1D3B9E]/60 overflow-hidden flex flex-col h-[860px] max-h-[94vh] relative">
          <div className="flex items-center justify-between px-6 pt-3 pb-1.5 text-xs font-semibold text-blue-100 bg-[#0A1E6E] shrink-0">
            <span>9:41</span>
            <div className="w-20 h-4 bg-black/80 rounded-full mx-auto flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-slate-800 border border-slate-600" />
            </div>
            <span className="text-[10px] font-mono">5G • 100%</span>
          </div>

          <div className="flex-1 overflow-y-auto">

              {/* Teacher Header */}
              <div className="px-6 pt-3 pb-6 bg-gradient-to-b from-[#0B1E6E] to-[#1739A6] text-white rounded-b-[32px] shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-300 to-blue-500 p-0.5 shadow-md">
                      <div className="w-full h-full rounded-full bg-[#0A184E] flex items-center justify-center font-display font-bold text-xl">
                        {userProfile.displayName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                      <div>
                        <p className="text-xs text-blue-200">Welcome</p>
                        <h1 className="font-display font-extrabold text-xl">
                          {userProfile.displayName}
                        </h1>
                        <p className="text-xs text-blue-200 font-mono">
                          Teacher ID: {userProfile.username} • Assigned Batch:{' '}
                          <strong className="text-amber-300">{teacherLockedBatchCode}</strong>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSeenNotifCount(notificationRecords.length)}
                      className="relative w-10 h-10 rounded-full bg-white/15 flex items-center justify-center cursor-pointer"
                      title="Notifications (Click to reset badge to 0)"
                    >
                      <Bell className="w-5 h-5 text-white" />
                      <span
                        className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${
                          unreadNotifCount > 0 ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                      >
                        {unreadNotifCount}
                      </span>
                    </button>
                  </div>

                  {/* "Your Assigned Batch" Banner (Teacher is restricted strictly to their assigned batch) */}
                  <div className="mt-4 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-4 shadow-lg border border-white/20 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-blue-100 font-medium">
                        Assigned Batch Access Only
                      </div>
                      <div className="font-display font-extrabold text-lg text-white mt-0.5">
                        {teacherAssignedBatches[0]
                          ? `${teacherAssignedBatches[0].name} (${teacherAssignedBatches[0].code})`
                          : `Batch ${teacherLockedBatchCode}`}
                      </div>
                      <div className="text-[11px] text-amber-200 font-mono">
                        {teacherAssignedBatches[0]?.timing || '24h Scheduled Batch'}
                      </div>
                    </div>
                    <button
                      onClick={() => setTeacherTab('classes')}
                      className="px-4 py-2 rounded-full bg-white text-[#0A184E] font-display font-bold text-xs flex items-center gap-1 shadow cursor-pointer"
                    >
                      <span>Live Class</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Teacher Body */}
                <div className="p-5 space-y-5">
                  {teacherTab === 'home' && (
                    <>
                      {/* 6 Grid Tiles matching Screenshot 2 */}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Live Class', icon: Video, tab: 'classes' as const, color: 'bg-rose-600' },
                          { label: 'Attendance', icon: CheckCircle2, tab: 'attendance' as const, color: 'bg-emerald-600' },
                          { label: 'Exams', icon: Award, tab: 'exams' as const, color: 'bg-amber-500' },
                          { label: 'Assignments', icon: PlayCircle, tab: 'classes' as const, color: 'bg-indigo-600' },
                          { label: 'AI Tutor', icon: Sparkles, tab: 'ai_tutor' as const, color: 'bg-purple-600' },
                          { label: 'Enroll ID', icon: UserPlus, tab: 'enroll_id' as const, color: 'bg-teal-600' },
                        ].map((t) => {
                          const IconComp = t.icon;
                          return (
                            <button
                              key={t.label}
                              onClick={() => setTeacherTab(t.tab)}
                              className="p-3.5 rounded-2xl bg-white border border-blue-100 shadow-sm hover:shadow-md flex flex-col items-center gap-2 cursor-pointer"
                            >
                              <div
                                className={`w-11 h-11 rounded-2xl ${t.color} text-white flex items-center justify-center shadow`}
                              >
                                <IconComp className="w-5 h-5" />
                              </div>
                              <span className="font-display font-bold text-xs text-[#0A184E]">
                                {t.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Assigned Batch Only Section */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-display font-bold text-sm text-[#0A184E]">
                            My Assigned Batch (Restricted Access)
                          </h3>
                          <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                            Batch: {teacherLockedBatchCode}
                          </span>
                        </div>
                        {teacherAssignedBatches.length === 0 ? (
                          <div className="rounded-2xl bg-white p-4 border border-blue-100 text-xs text-slate-500">
                            No batch assigned yet. Admin assigns your batch when creating your Teacher ID.
                          </div>
                        ) : (
                          teacherAssignedBatches.map((b) => (
                            <div
                              key={b.id}
                              className="rounded-2xl bg-white p-3.5 border border-blue-100 shadow-sm flex items-center justify-between gap-3 mb-2"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                                  <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="font-display font-bold text-sm text-[#0A184E]">
                                    {b.courseName} - {b.name} ({b.code})
                                  </div>
                                  <div className="text-xs text-slate-500 font-mono">{b.timing}</div>
                                </div>
                              </div>
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                                Assigned
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}

                  {/* TEACHER TAB: AGORA LIVE CLASSROOM (WITH TEACHER UNLOCK/LOCK) & ASSIGNMENT SENDER */}
                  {teacherTab === 'classes' && (
                    <div className="space-y-4">
                      <AgoraLiveClassRoom
                        userRole="teacher"
                        userName={userProfile.displayName}
                        userId={userProfile.username}
                        batches={teacherAssignedBatches}
                        selectedBatchCode={teacherLockedBatchCode}
                        erpRecords={erpRecords}
                        onCreateErpRecord={onCreateErpRecord}
                        onUpdateErpRecordStatus={onUpdateErpRecordStatus}
                      />
                    <div className="rounded-3xl bg-white p-5 border border-blue-100 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="font-display font-bold text-base text-[#0A184E] flex items-center gap-2">
                          <Send className="w-4 h-4 text-blue-600" />
                          <span>Send Assignment / Study Material</span>
                        </div>
                        <span className="text-[11px] font-bold text-blue-600 uppercase">Instant Student Sync</span>
                      </div>

                      {materialSentBanner && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                          {materialSentBanner}
                        </div>
                      )}

                      <form onSubmit={handleSendMaterial} className="space-y-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setMaterialType('assignment')}
                            className={`flex-1 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                              materialType === 'assignment'
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            Assignment (With Gallery / File)
                          </button>
                          <button
                            type="button"
                            onClick={() => setMaterialType('material')}
                            className={`flex-1 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                              materialType === 'material'
                                ? 'bg-blue-600 text-white border-blue-600 shadow'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            Study Material
                          </button>
                        </div>

                        <input
                          type="text"
                          value={materialTitle}
                          onChange={(e) => setMaterialTitle(e.target.value)}
                          placeholder="Assignment / Material Title (e.g. ADCA Lab Assignment 1)"
                          required
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={materialCourse}
                            onChange={(e) => setMaterialCourse(e.target.value)}
                            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                          >
                            <option value="ADCA">ADCA</option>
                            <option value="DCA">DCA</option>
                            <option value="Tally Prime">Tally Prime</option>
                            <option value="MS Office">MS Office</option>
                            <option value="Python & AI">Python & AI</option>
                          </select>
                          <select
                            value={teacherSelectedBatch}
                            onChange={(e) => setTeacherSelectedBatch(e.target.value)}
                            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
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

                        {/* Gallery Photo or File Manager Picker */}
                        <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-1.5">
                          <label className="block text-[11px] font-bold text-indigo-950 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Attach Photo from Gallery or File from File Manager</span>
                          </label>
                          <input
                            type="file"
                            accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                            onChange={handleTeacherMaterialFileUpload}
                            className="w-full text-[11px] text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-indigo-600 file:text-white cursor-pointer"
                          />
                          {materialFileName && (
                            <div className="text-[11px] font-bold text-emerald-700">
                              ✓ Attached: {materialFileName}
                            </div>
                          )}
                        </div>

                        <input
                          type="url"
                          value={materialLink}
                          onChange={(e) => setMaterialLink(e.target.value)}
                          placeholder="Study Drive / Download URL (optional)"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        />
                        <textarea
                          value={materialNotes}
                          onChange={(e) => setMaterialNotes(e.target.value)}
                          placeholder="Assignment instructions or lecture keynotes..."
                          rows={2}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                        />
                        <button
                          type="submit"
                          disabled={sendingMaterial}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-display font-bold text-xs shadow cursor-pointer disabled:opacity-50"
                        >
                          {sendingMaterial
                            ? 'Sending to Cloud & Student Portal...'
                            : `Send ${materialType === 'assignment' ? 'Assignment' : 'Study Material'} to Student Portal`}
                        </button>
                      </form>
                    </div>

                    <div className="space-y-2.5">
                      <h3 className="font-display font-bold text-sm text-[#0A184E]">
                        Assigned Batches ({batches.length})
                      </h3>
                      {batches.length === 0 ? (
                        <div className="rounded-2xl bg-white p-5 text-center text-xs text-slate-500 border border-blue-100">
                          No batches registered yet in Firestore.
                        </div>
                      ) : (
                        batches.map((b) => (
                          <div
                            key={b.id}
                            className="rounded-2xl bg-white p-4 border border-blue-100 shadow-sm flex items-center justify-between"
                          >
                            <div>
                              <div className="font-display font-bold text-sm text-[#0A184E]">
                                {b.name} ({b.code})
                              </div>
                              <div className="text-xs text-slate-600 mt-0.5">
                                Course: {b.courseName} • Timing: {b.timing} • Cap: {b.capacity}
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                              Active
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* TEACHER TAB: ATTENDANCE QR CODE & DIRECT FULL-BATCH CLOUD ATTENDANCE SUBMISSION ONLY */}
                {teacherTab === 'attendance' && (
                  <div className="space-y-4">
                    {/* SECTION 1: ON-DEMAND REAL `qrcode` LIBRARY QR GENERATOR */}
                    <RealQrGenerator
                      issuerName={userProfile.displayName}
                      issuerRole="TEACHER"
                      batches={batches}
                      students={studentRecords}
                      selectedBatch={teacherSelectedBatch}
                      onSelectBatch={setTeacherSelectedBatch}
                      onOpenScanner={() => setScannerOpen(true)}
                    />

                    {/* SECTION 2: DIRECT ONE-CLICK FULL BATCH ATTENDANCE SUBMIT TO FIRESTORE CLOUD */}
                    <div className="rounded-3xl bg-white p-5 border border-blue-100 shadow-sm space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="font-display font-extrabold text-sm text-[#0A184E]">
                            Direct Batch Attendance Register (Firestore Cloud Sync)
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            Submit attendance for the entire batch at once directly to Firebase Cloud Firestore
                          </p>
                        </div>
                        <select
                          value={teacherSelectedBatch}
                          onChange={(e) => setTeacherSelectedBatch(e.target.value)}
                          className="px-3 py-1.5 rounded-xl border border-blue-200 text-xs font-extrabold text-[#0A184E] bg-[#EEF4FF]"
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

                      {teacherBatchAttSavedMsg && (
                        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-extrabold">
                          {teacherBatchAttSavedMsg}
                        </div>
                      )}

                      {studentRecords.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-500">
                          No students registered in Firestore yet. Open the &quot;Enroll ID&quot; tab next to Profile to enroll students.
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {studentRecords.map((stu) => {
                              const todayStr = new Date().toISOString().split('T')[0];
                              const todayRecord = attendanceRecords.find(
                                (r) =>
                                  (r.targetUserId === stu.code || r.code === stu.code) &&
                                  r.dateStr === todayStr
                              );
                              const currentStatus =
                                draftTeacherAttendance[stu.code] ||
                                (todayRecord?.status === 'Absent' ? 'Absent' : 'Present');

                              return (
                                <div
                                  key={stu.id}
                                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3"
                                >
                                  <div>
                                    <div className="font-display font-bold text-xs text-[#0A184E]">
                                      {stu.title}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono">
                                      ID: {stu.code} • Batch: {teacherSelectedBatch}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDraftTeacherAttendance((prev) => ({
                                          ...prev,
                                          [stu.code]: 'Present',
                                        }));
                                        handleToggleBatchStudentAttendance(
                                          stu.code,
                                          stu.title,
                                          teacherSelectedBatch,
                                          'Present'
                                        );
                                      }}
                                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                        currentStatus === 'Present'
                                          ? 'bg-emerald-600 text-white shadow'
                                          : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50'
                                      }`}
                                    >
                                      ✓ Present
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDraftTeacherAttendance((prev) => ({
                                          ...prev,
                                          [stu.code]: 'Absent',
                                        }));
                                        handleToggleBatchStudentAttendance(
                                          stu.code,
                                          stu.title,
                                          teacherSelectedBatch,
                                          'Absent'
                                        );
                                      }}
                                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                        currentStatus === 'Absent'
                                          ? 'bg-red-600 text-white shadow'
                                          : 'bg-white text-red-700 border border-red-300 hover:bg-red-50'
                                      }`}
                                    >
                                      ✗ Absent
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* DIRECT 1-CLICK SUBMIT ALL BATCH STUDENTS ATTENDANCE TO FIRESTORE CLOUD */}
                          <button
                            type="button"
                            disabled={savingTeacherBatchAtt}
                            onClick={() => handleMarkAllBatchPresent(teacherSelectedBatch)}
                            className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#0077B6] via-[#0096C7] to-emerald-600 hover:from-[#023E8A] hover:to-emerald-700 text-white font-display font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>
                              {savingTeacherBatchAtt
                                ? 'Submitting Full Batch Attendance to Firestore Cloud...'
                                : `⚡ Submit All Batch (${teacherSelectedBatch}) Students Attendance to Cloud`}
                            </span>
                          </button>
                        </>
                      )}
                    </div>

                    {/* SECTION 3: MANUAL SINGLE STUDENT ATTENDANCE ENTRY */}
                    <details className="rounded-2xl bg-white p-3.5 border border-slate-200 text-xs">
                      <summary className="font-bold text-slate-700 cursor-pointer">
                        Record Single Student Attendance by ID
                      </summary>
                      <form onSubmit={handleTeacherMarkAttendance} className="mt-3 space-y-2.5">
                        <input
                          type="text"
                          value={attStudentId}
                          onChange={(e) => setAttStudentId(e.target.value)}
                          placeholder="Student ID (e.g. WI2026001)"
                          required
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={attStudentName}
                          onChange={(e) => setAttStudentName(e.target.value)}
                          placeholder="Student Full Name"
                          required
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                        />
                        <button
                          type="submit"
                          className="w-full py-2 rounded-xl bg-[#0077B6] text-white font-bold text-xs cursor-pointer"
                        >
                          Save Real Attendance in Firestore
                        </button>
                      </form>
                    </details>

                    {scannerOpen && (
                      <QrScannerModal
                        scannerTitle="Teacher Portal — Real QR Attendance Scanner"
                        onScanSuccess={handleQrScanSuccess}
                        onClose={() => setScannerOpen(false)}
                      />
                    )}
                  </div>
                )}

                {/* NEW SECTION NEXT TO PROFILE: ENROLL ID (Create Student with Gallery Photo + Bottom Login ID & Password + Connect Parent ID) */}
                {teacherTab === 'enroll_id' && (
                  <div className="space-y-4">
                    <div className="rounded-3xl bg-white p-5 border border-blue-100 shadow-sm space-y-3">
                      <div className="border-b border-slate-100 pb-2">
                        <h3 className="font-display font-extrabold text-sm text-[#0A184E]">
                          Enroll Student &amp; Cloud Login ID Hub
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Upload Gallery Photo &amp; create Student Portal Login ID &amp; Password saved directly in Firebase Cloud
                        </p>
                      </div>

                      {tStuSavedBanner && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                          {tStuSavedBanner}
                        </div>
                      )}

                      <form onSubmit={handleTeacherCreateStudentWithBottomLogin} className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={tStuName}
                            onChange={(e) => setTStuName(e.target.value)}
                            placeholder="Student Full Name"
                            required
                            className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                          />
                          <input
                            type="text"
                            value={tStuGuardian}
                            onChange={(e) => setTStuGuardian(e.target.value)}
                            placeholder="Father / Guardian Name"
                            className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={tStuCourse}
                            onChange={(e) => setTStuCourse(e.target.value)}
                            placeholder="Course (e.g. ADCA)"
                            className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                          />
                          <select
                            value={teacherSelectedBatch}
                            onChange={(e) => setTeacherSelectedBatch(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                          >
                            {batches.length > 0 ? (
                              batches.map((b) => (
                                <option key={b.id} value={b.code}>
                                  {b.name}
                                </option>
                              ))
                            ) : (
                              <option value="ADCA-A1">Batch ADCA-A1</option>
                            )}
                          </select>
                        </div>

                        {/* Gallery Student Photo */}
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                          {tStuPhotoDataUrl ? (
                            <img
                              src={tStuPhotoDataUrl}
                              alt="Preview"
                              className="w-10 h-10 rounded-xl object-cover border border-blue-300"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="text-[11px] font-bold text-[#0A184E]">
                              Upload Student Photo from Gallery
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleTeacherStudentPhotoUpload}
                              className="w-full text-[10px] text-slate-600 mt-0.5"
                            />
                          </div>
                        </div>

                        {/* Bottom Student Portal Username & Password */}
                        <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-2">
                          <div className="text-[11px] font-extrabold text-[#0A184E]">
                            Student Portal Login Username &amp; Password (Saved in Cloud Database)
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={tStuUsername}
                              onChange={(e) => setTStuUsername(e.target.value)}
                              placeholder="Login Username / ID"
                              required
                              className="px-3 py-2 rounded-xl border border-blue-200 bg-white text-xs font-mono"
                            />
                            <input
                              type="text"
                              value={tStuPassword}
                              onChange={(e) => setTStuPassword(e.target.value)}
                              placeholder="Login Password"
                              required
                              className="px-3 py-2 rounded-xl border border-blue-200 bg-white text-xs font-mono"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-display font-bold text-xs shadow cursor-pointer"
                        >
                          Save Student &amp; Cloud Login Credentials
                        </button>
                      </form>
                    </div>

                    {/* CONNECT STUDENT ID WITH PARENT ID */}
                    <div className="rounded-3xl bg-white p-5 border border-blue-100 shadow-sm space-y-3">
                      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow">
                          <Link2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-display font-extrabold text-sm text-[#0A184E]">
                            Connect Student ID with Parent ID
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            Link any Student ID to their Parent&apos;s ID in Firebase Cloud
                          </p>
                        </div>
                      </div>

                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (
                            !teacherLinkStudentId.trim() ||
                            !teacherLinkParentId.trim() ||
                            !onLinkStudentToParent
                          )
                            return;
                          await onLinkStudentToParent(
                            teacherLinkStudentId.trim(),
                            teacherLinkParentId.trim()
                          );
                          setTeacherLinkMsg(
                            `✓ Connected Student "${teacherLinkStudentId.trim()}" with Parent "${teacherLinkParentId.trim()}" in Cloud!`
                          );
                          setTeacherLinkStudentId('');
                          setTeacherLinkParentId('');
                          setTimeout(() => setTeacherLinkMsg(null), 5000);
                        }}
                        className="space-y-2.5"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={teacherLinkStudentId}
                            onChange={(e) => setTeacherLinkStudentId(e.target.value)}
                            placeholder="Student ID (e.g. WI2026001)"
                            required
                            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                          />
                          <input
                            type="text"
                            value={teacherLinkParentId}
                            onChange={(e) => setTeacherLinkParentId(e.target.value)}
                            placeholder="Parent ID (e.g. WI-PRN-001)"
                            required
                            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                          />
                        </div>
                        {teacherLinkMsg && (
                          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                            {teacherLinkMsg}
                          </div>
                        )}
                        <button
                          type="submit"
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-display font-bold text-xs shadow cursor-pointer"
                        >
                          Connect Student &amp; Parent ID in Cloud
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* TEACHER TAB: CREATE 50-MCQ EXAMINATION WITH 24-HOUR TIME SCHEDULE */}
                {teacherTab === 'exams' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-display font-bold text-base text-[#0A184E]">
                          Create 50-MCQ Exam (24-Hour Schedule)
                        </h2>
                        <p className="text-[11px] text-slate-500">
                          Auto-inject 50 MCQs • Anti-Split-Screen • 2-Minute Delayed Student Result
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleTeacherAutoInject50Mcqs}
                        className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-display font-bold text-[11px] shadow flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>⚡ Auto-Inject 50 MCQs</span>
                      </button>
                    </div>

                    {teacherExamSavedBanner && (
                      <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                        {teacherExamSavedBanner}
                      </div>
                    )}

                    <form
                      onSubmit={handleTeacherCreateExam}
                      className="rounded-3xl bg-white p-5 border border-blue-100 shadow-sm space-y-3"
                    >
                      <input
                        type="text"
                        value={newExamTitle}
                        onChange={(e) => setNewExamTitle(e.target.value)}
                        placeholder="Exam Title (e.g. ADCA Semester 1 Final Exam)"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newExamCourse}
                          onChange={(e) => setNewExamCourse(e.target.value)}
                          placeholder="Course (e.g. ADCA)"
                          required
                          className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                        />
                        <input
                          type="date"
                          value={newExamDate}
                          onChange={(e) => setNewExamDate(e.target.value)}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                        />
                      </div>

                      {/* 24-Hour Exam Time Schedule */}
                      <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-2">
                        <div className="text-[11px] font-extrabold text-[#0A184E] flex items-center justify-between">
                          <span>24-Hour Exam Window (e.g. 10:00 to 10:30)</span>
                          <span className="text-blue-700 font-mono">
                            {newExamStart24h} – {newExamEnd24h}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                              Start Time (24h HH:mm)
                            </label>
                            <input
                              type="time"
                              value={newExamStart24h}
                              onChange={(e) => setNewExamStart24h(e.target.value)}
                              required
                              className="w-full px-3 py-1.5 rounded-xl border border-blue-200 bg-white text-xs font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                              End Time (24h HH:mm)
                            </label>
                            <input
                              type="time"
                              value={newExamEnd24h}
                              onChange={(e) => setNewExamEnd24h(e.target.value)}
                              required
                              className="w-full px-3 py-1.5 rounded-xl border border-blue-200 bg-white text-xs font-mono font-bold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* MCQ Builder Box (1 Question + 4 Options + 1 Correct Option, up to 50 MCQs) */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-[#0A184E]">
                            MCQ Bank ({teacherMcqBank.length} / 50 Questions Ready)
                          </span>
                          <button
                            type="button"
                            onClick={handleTeacherAddSingleMcq}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold cursor-pointer"
                          >
                            + Add Question ({teacherMcqBank.length}/50)
                          </button>
                        </div>

                        <input
                          type="text"
                          value={newExamQuestion}
                          onChange={(e) => setNewExamQuestion(e.target.value)}
                          placeholder="MCQ Question Prompt (or click Auto-Inject 50 MCQs above)"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium"
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={newExamOptA}
                            onChange={(e) => setNewExamOptA(e.target.value)}
                            placeholder="Option A"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs"
                          />
                          <input
                            type="text"
                            value={newExamOptB}
                            onChange={(e) => setNewExamOptB(e.target.value)}
                            placeholder="Option B"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs"
                          />
                          <input
                            type="text"
                            value={newExamOptC}
                            onChange={(e) => setNewExamOptC(e.target.value)}
                            placeholder="Option C"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs"
                          />
                          <input
                            type="text"
                            value={newExamOptD}
                            onChange={(e) => setNewExamOptD(e.target.value)}
                            placeholder="Option D"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs"
                          />
                        </div>

                        {/* Hidden Correct Answer Selection */}
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                          <div className="font-bold text-amber-900 mb-1">
                            Correct Option (1 Sahi Jawab):
                          </div>
                          <div className="flex gap-3">
                            {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                              <label
                                key={opt}
                                className="flex items-center gap-1 font-bold text-[#0A184E] cursor-pointer"
                              >
                                <input
                                  type="radio"
                                  name="correctOpt"
                                  value={opt}
                                  checked={newExamCorrect === opt}
                                  onChange={() => setNewExamCorrect(opt)}
                                  className="text-blue-600"
                                />
                                <span>Option {opt}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-display font-bold text-xs shadow cursor-pointer"
                      >
                        Publish 50-MCQ Exam ({newExamStart24h}–{newExamEnd24h} 24h Window)
                      </button>
                    </form>
                  </div>
                )}

                {teacherTab === 'ai_tutor' && (
                  <EduSyncAiTutor
                    studentName={userProfile.displayName}
                    onBack={() => setTeacherTab('home')}
                  />
                )}

                {teacherTab === 'profile' && (
                  <div className="space-y-4">
                    <div className="rounded-3xl bg-white p-5 border border-blue-100 space-y-3">
                      <div className="flex items-center gap-3.5">
                        {(() => {
                          const tRec = erpRecords.find(
                            (r) =>
                              r.module === 'teacher' &&
                              r.code.toLowerCase() === userProfile.username.toLowerCase()
                          );
                          const tPhoto = getMediaAttachment(userProfile.username, tRec?.extra4);
                          return tPhoto && tPhoto.startsWith('data:image') ? (
                            <img
                              src={tPhoto}
                              alt={userProfile.displayName}
                              className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-400 shadow"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-display font-black text-xl flex items-center justify-center shadow">
                              {userProfile.displayName.charAt(0).toUpperCase()}
                            </div>
                          );
                        })()}
                        <div>
                          <div className="font-display font-bold text-base text-[#0A184E]">
                            {userProfile.displayName}
                          </div>
                          <div className="text-xs text-slate-600 font-mono">
                            Teacher ID: {userProfile.username}
                          </div>
                          <div className="text-[11px] font-bold text-blue-700">
                            Assigned Batch: {teacherLockedBatchCode} (Restricted Access)
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={onLogout}
                        className="w-full py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs cursor-pointer"
                      >
                        Logout Teacher Account
                      </button>
                    </div>
                    {/* Google Workspace Hub is shown in Teacher & Admin Portals */}
                    <GoogleWorkspaceHub roleLabel="Teacher Portal" />
                  </div>
                )}
              </div>
          </div>

          {/* 7-Tab Permanently Visible Teacher Bottom Nav (with Enroll ID section right next to Profile) + 3D Rotating Water Ring Canvas */}
          <div className="bg-white border-t border-blue-100 px-1.5 pt-1.5 pb-2 shrink-0">
            <div className="grid grid-cols-7 items-center">
              {(
                [
                  { id: 'home', label: 'Home', icon: Home },
                  { id: 'classes', label: 'Classes', icon: BookOpen },
                  { id: 'attendance', label: 'Attendance', icon: CheckCircle2 },
                  { id: 'exams', label: 'Exams', icon: FileText },
                  { id: 'ai_tutor', label: 'AI Tutor', icon: Sparkles },
                  { id: 'enroll_id', label: 'Enroll ID', icon: UserPlus },
                  { id: 'profile', label: 'Profile', icon: User },
                ] as const
              ).map((nav) => {
                const NavIcon = nav.icon;
                const active = teacherTab === nav.id;
                return (
                  <button
                    key={nav.id}
                    onClick={() => setTeacherTab(nav.id)}
                    className={`flex flex-col items-center justify-center py-0.5 rounded-xl cursor-pointer ${
                      active ? 'text-cyan-600 font-extrabold' : 'text-slate-400'
                    }`}
                  >
                    <FireRingCanvas active={active} size={32}>
                      <NavIcon className="w-3.5 h-3.5" />
                    </FireRingCanvas>
                    <span className="text-[9px] mt-0.5 whitespace-nowrap">{nav.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="w-32 h-1.5 rounded-full bg-slate-300 mx-auto mt-1.5" />
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER PARENT PORTAL (Native Android Mobile App Shell)
  // ============================================================================
  return (
    <div className="min-h-screen flex items-center justify-center py-3 px-2 sm:px-4">
      <div className="w-full max-w-[440px] mx-auto bg-gradient-to-b from-[#0A1E6E] via-[#EEF4FF] to-[#F8FAFC] rounded-[42px] shadow-[0_25px_70px_rgba(2,6,23,0.85)] border-[6px] border-[#1D3B9E]/60 overflow-hidden flex flex-col h-[860px] max-h-[94vh] relative">
        <div className="flex items-center justify-between px-6 pt-3 pb-1.5 text-xs font-semibold text-blue-100 bg-[#0A1E6E] shrink-0">
          <span>9:41</span>
          <div className="w-20 h-4 bg-black/80 rounded-full mx-auto flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-slate-800 border border-slate-600" />
          </div>
          <span className="text-[10px] font-mono">5G • 100%</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Parent Header */}
          <div className="px-6 pt-3 pb-6 bg-gradient-to-b from-[#0B1E6E] to-[#1739A6] text-white rounded-b-[32px] shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-pink-300 to-blue-400 p-0.5 shadow-md">
                  <div className="w-full h-full rounded-full bg-[#0A184E] flex items-center justify-center font-display font-bold text-xl">
                    {userProfile.displayName.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-blue-200">Welcome</p>
                  <h1 className="font-display font-extrabold text-xl">
                    {userProfile.displayName}
                  </h1>
                  <p className="text-xs text-blue-200 font-mono">
                    Parent ID: {userProfile.username}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSeenNotifCount(notificationRecords.length)}
                className="relative w-10 h-10 rounded-full bg-white/15 flex items-center justify-center cursor-pointer"
                title="Notifications (Click to reset count to 0)"
              >
                <Bell className="w-5 h-5 text-white" />
                <span
                  className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${
                    unreadNotifCount > 0 ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                >
                  {unreadNotifCount}
                </span>
              </button>
            </div>

            {/* Linked Child Card matching Screenshot 2 */}
            <div className="mt-4 rounded-3xl bg-white/95 text-[#0A184E] p-4 shadow-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-800 font-display font-bold text-lg flex items-center justify-center">
                  S
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Your Child</div>
                  <div className="font-display font-extrabold text-base text-[#0A184E]">
                    {userProfile.linkedEntityId
                      ? `Linked Student: ${userProfile.linkedEntityId}`
                      : studentRecords[0]?.title || 'No Student Linked Yet'}
                  </div>
                  <div className="text-xs text-blue-700 font-semibold">
                    {primaryBatch
                      ? `${primaryBatch.courseName} - ${primaryBatch.name}`
                      : 'Connected via Admin / Teacher'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {parentTab === 'home' && (
              <>
                {/* 4 Parent Action Tiles */}
                <div className="grid grid-cols-2 gap-3.5">
                  {[
                    { label: 'Attendance', icon: CheckCircle2, tab: 'student' as const, color: 'bg-blue-600' },
                    { label: 'Results', icon: Trophy, tab: 'results' as const, color: 'bg-amber-500' },
                    { label: 'Live Class & Meet', icon: Video, tab: 'messages' as const, color: 'bg-rose-600' },
                    { label: 'Fee Records', icon: Wallet, tab: 'student' as const, color: 'bg-emerald-600' },
                  ].map((tile) => {
                    const IconComp = tile.icon;
                    return (
                      <button
                        key={tile.label}
                        onClick={() => setParentTab(tile.tab)}
                        className="p-4 rounded-3xl bg-white border border-blue-100 shadow-sm flex flex-col items-center gap-2 cursor-pointer"
                      >
                        <div
                          className={`w-12 h-12 rounded-2xl ${tile.color} text-white flex items-center justify-center shadow`}
                        >
                          <IconComp className="w-6 h-6" />
                        </div>
                        <span className="font-display font-bold text-sm text-[#0A184E]">
                          {tile.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Child Performance Ring Card */}
                <div className="rounded-3xl bg-white p-5 border border-blue-100 shadow-md">
                  <div className="font-display font-bold text-sm text-[#0A184E] mb-3">
                    Child Performance
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <CircularProgressRing
                      percentage={overallResultPercentage || attendancePercentage}
                      size={78}
                      strokeWidth={8}
                      color="#16A34A"
                      trackColor="#E2E8F0"
                    />
                    <div className="flex-1">
                      <div className="font-display font-extrabold text-lg text-[#0A184E]">
                        {resultRecords.length > 0 ? 'Verified Performance' : 'Awaiting Exam Records'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Attendance: {attendancePercentage}% • Exams: {resultRecords.length}
                      </div>
                      <button
                        onClick={() => setParentTab('results')}
                        className="mt-2.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold cursor-pointer"
                      >
                        View Detailed Report -&gt;
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {parentTab === 'student' && (
              <div className="space-y-4">
                <h3 className="font-display font-bold text-base text-[#0A184E]">
                  Link Child Student ID &amp; View Fee / Attendance
                </h3>
                <div className="rounded-3xl bg-white p-4 border border-blue-100 space-y-3">
                  <input
                    type="text"
                    value={childLinkInput}
                    onChange={(e) => setChildLinkInput(e.target.value)}
                    placeholder="Enter Child Student ID (e.g. WI2026001)"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                  <button
                    onClick={() => onUpdateUserProfile({ linkedEntityId: childLinkInput.trim() })}
                    className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs cursor-pointer"
                  >
                    Link Child Student ID
                  </button>
                </div>

                <div className="rounded-3xl bg-white p-4 border border-blue-100 space-y-2">
                  <div className="font-display font-bold text-sm text-[#0A184E]">
                    Child Attendance ({attendancePercentage}%) &amp; Fee Summary
                  </div>
                  <div className="text-xs text-slate-600">
                    Total Paid: ₹{totalFeePaid.toLocaleString('en-IN')} • Pending: ₹
                    {totalFeePending.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            )}

            {parentTab === 'results' && (
              <div className="space-y-3">
                <h3 className="font-display font-bold text-base text-[#0A184E]">
                  Child Examination Results
                </h3>
                {resultRecords.length === 0 ? (
                  <div className="rounded-2xl bg-white p-5 text-center text-xs text-slate-500 border border-blue-100">
                    No exam results published yet.
                  </div>
                ) : (
                  resultRecords.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl bg-white p-4 border border-blue-100 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-display font-bold text-sm text-[#0A184E]">
                          {r.title}
                        </div>
                        <div className="text-xs text-slate-500">{r.dateStr}</div>
                      </div>
                      <span className="font-mono font-bold text-sm text-blue-700">
                        {Number(r.numericValue).toFixed(1)}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {parentTab === 'messages' && (
              <div className="space-y-4">
                <AgoraLiveClassRoom
                  userRole="parent"
                  userName={userProfile.displayName}
                  userId={userProfile.username}
                  batches={batches}
                  selectedBatchCode={primaryBatch?.code}
                  erpRecords={erpRecords}
                  onCreateErpRecord={onCreateErpRecord}
                  onUpdateErpRecordStatus={onUpdateErpRecordStatus}
                />

                <h3 className="font-display font-bold text-base text-[#0A184E]">
                  Message Institute Administration / Teacher
                </h3>
                <form
                  onSubmit={handleSendMessage}
                  className="rounded-3xl bg-white p-4 border border-blue-100 space-y-2.5"
                >
                  <input
                    type="text"
                    value={msgTitle}
                    onChange={(e) => setMsgTitle(e.target.value)}
                    placeholder="Subject"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <textarea
                    value={msgBody}
                    onChange={(e) => setMsgBody(e.target.value)}
                    placeholder="Write your message to the branch or teacher..."
                    rows={3}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs cursor-pointer"
                  >
                    Send Message
                  </button>
                </form>
              </div>
            )}

            {parentTab === 'ai_tutor' && (
              <EduSyncAiTutor
                studentName={userProfile.displayName}
                onBack={() => setParentTab('home')}
              />
            )}

            {parentTab === 'profile' && (
              <div className="space-y-4">
                <div className="rounded-3xl bg-white p-5 border border-blue-100 space-y-3">
                  <div className="font-display font-bold text-base text-[#0A184E]">
                    {userProfile.displayName}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Parent ID: {userProfile.username}
                  </div>
                  <div className="text-xs text-blue-700 font-semibold">
                    Connected Child ID: {userProfile.linkedEntityId || 'Not Linked Yet'}
                  </div>
                  <button
                    onClick={onLogout}
                    className="w-full py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 6-Tab Permanently Visible Parent Bottom Navigation + Spinning Fire Ring Canvas */}
        <div className="bg-white border-t border-blue-100 px-2 pt-1.5 pb-2 shrink-0">
          <div className="grid grid-cols-6 items-center">
            {(
              [
                { id: 'home', label: 'Home', icon: Home },
                { id: 'student', label: 'Student', icon: Users },
                { id: 'results', label: 'Results', icon: FileText },
                { id: 'messages', label: 'Live Meet', icon: Video },
                { id: 'ai_tutor', label: 'AI Tutor', icon: Sparkles },
                { id: 'profile', label: 'Profile', icon: User },
              ] as const
            ).map((nav) => {
              const NavIcon = nav.icon;
              const active = parentTab === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => setParentTab(nav.id)}
                  className={`flex flex-col items-center justify-center py-0.5 rounded-xl cursor-pointer ${
                    active ? 'text-cyan-600 font-extrabold' : 'text-slate-400'
                  }`}
                >
                  <FireRingCanvas active={active} size={34}>
                    <NavIcon className="w-4 h-4" />
                  </FireRingCanvas>
                  <span className="text-[10px] mt-0.5">{nav.label}</span>
                </button>
              );
            })}
          </div>
          <div className="w-32 h-1.5 rounded-full bg-slate-300 mx-auto mt-1.5" />
        </div>
      </div>
    </div>
  );
};
