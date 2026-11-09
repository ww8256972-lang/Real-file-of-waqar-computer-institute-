import React, { useState } from 'react';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  FileText,
  FolderKanban,
  GraduationCap,
  Home,
  KeyRound,
  Link2,
  LogOut,
  Mail,
  Plus,
  QrCode,
  Search,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Video,
  Wallet,
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
import {
  compressImageFileToDataUrl,
  generate50McqQuestionBank,
  triggerCelebrationConfetti,
} from '../utils/mcqBank';

type AdminSection =
  | 'dashboard'
  | 'students'
  | 'id_vault'
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
  | 'live_class'
  | 'ai_tutor'
  | 'settings';

interface AdminErpPanelProps {
  userProfile: UserProfileDoc;
  branches: BranchDoc[];
  courses: CourseDoc[];
  batches: BatchDoc[];
  erpRecords: ErpRecordDoc[];
  cloudUsers: UserProfileDoc[];
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
  onUpdateAdminCloudSyncCredentials: (
    newUsername: string,
    newPassword: string
  ) => Promise<void>;
  onLinkStudentToParent: (studentUsername: string, parentUsername: string) => Promise<void>;
  onLogout: () => void;
}

export const AdminErpPanel: React.FC<AdminErpPanelProps> = ({
  userProfile,
  branches,
  courses,
  batches,
  erpRecords,
  cloudUsers,
  onCreateBranch,
  onDeleteBranch,
  onCreateCourse,
  onDeleteCourse,
  onCreateBatch,
  onDeleteBatch,
  onCreateErpRecord,
  onDeleteErpRecord,
  onSaveCloudCredential,
  onUpdateAdminCloudSyncCredentials,
  onLinkStudentToParent,
  onLogout,
}) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Student form state
  const [stuCode, setStuCode] = useState('');
  const [stuName, setStuName] = useState('');
  const [stuGuardian, setStuGuardian] = useState('');
  const [stuCourse, setStuCourse] = useState('ADCA');
  const [stuBatch, setStuBatch] = useState('BATCH-A1');
  const [stuPhotoDataUrl, setStuPhotoDataUrl] = useState('');

  // Credential Vault state
  const [vaultUser, setVaultUser] = useState('');
  const [vaultPass, setVaultPass] = useState('');
  const [vaultDisplay, setVaultDisplay] = useState('');
  const [vaultRole, setVaultRole] = useState<UserRole>('student');
  const [vaultLinked, setVaultLinked] = useState('');

  // Course form state
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseDuration, setCourseDuration] = useState('12 Months');
  const [courseFee, setCourseFee] = useState('6500');
  const [courseSyllabus, setCourseSyllabus] = useState('');

  // Batch form state
  const [batchCode, setBatchCode] = useState('');
  const [batchName, setBatchName] = useState('');
  const [batchCourse, setBatchCourse] = useState('ADCA');
  const [batchTeacher, setBatchTeacher] = useState('');
  const [batchTiming, setBatchTiming] = useState('10:00 AM - 11:00 AM');

  // Branch form state
  const [branchCode, setBranchCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');

  // Generic ERP Record form state
  const [recCode, setRecCode] = useState('');
  const [recTitle, setRecTitle] = useState('');
  const [recSubtitle, setRecSubtitle] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recNotes, setRecNotes] = useState('');

  // Settings / Admin Cloud Sync credential update state
  const [adminNewUsername, setAdminNewUsername] = useState(userProfile.username || 'waqar');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [linkStudentId, setLinkStudentId] = useState('');
  const [linkParentId, setLinkParentId] = useState('');

  // AI Tutor state
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiCourseContext, setAiCourseContext] = useState('ADCA & Tally Prime');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Batch Attendance state
  const [selectedAttBatch, setSelectedAttBatch] = useState('BATCH-A1');
  const [attStatusMap, setAttStatusMap] = useState<Record<string, 'Present' | 'Absent'>>({});

  const studentRecords = erpRecords.filter((r) => r.module === 'student');
  const examRecords = erpRecords.filter((r) => r.module === 'exam');
  const resultRecords = erpRecords.filter((r) => r.module === 'result');
  const feeRecords = erpRecords.filter((r) => r.module === 'fee');
  const attendanceRecords = erpRecords.filter((r) => r.module === 'attendance');

  const navItems: { key: AdminSection; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <Home className="w-4 h-4" /> },
    { key: 'students', label: 'Students & Photo', icon: <GraduationCap className="w-4 h-4" /> },
    { key: 'id_vault', label: 'Credential Vault', icon: <KeyRound className="w-4 h-4" /> },
    { key: 'courses', label: 'Courses', icon: <BookOpen className="w-4 h-4" /> },
    { key: 'batches', label: 'Batches', icon: <FolderKanban className="w-4 h-4" /> },
    { key: 'attendance', label: 'Batch & QR Attendance', icon: <QrCode className="w-4 h-4" /> },
    { key: 'examinations', label: '50-MCQ Exams', icon: <FileText className="w-4 h-4" /> },
    { key: 'results', label: 'Results', icon: <Award className="w-4 h-4" /> },
    { key: 'fees', label: 'Fees', icon: <Wallet className="w-4 h-4" /> },
    { key: 'live_class', label: 'Agora Live Class', icon: <Video className="w-4 h-4" /> },
    { key: 'ai_tutor', label: 'Instant AI Tutor', icon: <Sparkles className="w-4 h-4" /> },
    { key: 'teachers', label: 'Teachers', icon: <UserCheck className="w-4 h-4" /> },
    { key: 'admissions', label: 'Admissions', icon: <UserPlus className="w-4 h-4" /> },
    { key: 'certificates', label: 'Certificates', icon: <Award className="w-4 h-4" /> },
    { key: 'branches', label: 'Branches', icon: <Building2 className="w-4 h-4" /> },
    { key: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { key: 'messages', label: 'Messages', icon: <Mail className="w-4 h-4" /> },
    { key: 'settings', label: 'Admin Cloud Sync & Security', icon: <Settings className="w-4 h-4" /> },
  ];

  const notify = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageFileToDataUrl(file);
    setStuPhotoDataUrl(compressed);
  };

  const handleAskAiTutor = async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiQuestion.trim(),
          courseContext: aiCourseContext,
          studentName: userProfile.displayName,
          userId: userProfile.uid,
        }),
      });
      const data = await res.json();
      setAiAnswer(data.reply || data.error || 'No response received.');
    } catch {
      setAiAnswer('Offline Syllabus Guide: Practice the shortcut keys and lab exercises in your batch manual.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#040D33] via-[#0A2170] to-[#0077B6] text-white">
      {/* Top Institute Bar */}
      <header className="sticky top-0 z-30 bg-[#040D33]/95 backdrop-blur-xl border-b border-cyan-400/25 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center">
            <img
              src="/waqar_logo.png"
              alt="Waqar Computer Institute"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-lg tracking-wide text-white">
              WAQAR COMPUTER INSTITUTE
            </h1>
            <p className="text-[11px] text-cyan-200 font-semibold">
              Admin Control Center • Cloud Synced ({userProfile.username})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative hidden sm:block">
            <Search className="w-4 h-4 text-cyan-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search students, courses, records..."
              className="pl-9 pr-3 py-1.5 rounded-xl bg-white/10 border border-cyan-300/30 text-xs text-white placeholder:text-cyan-200/60 outline-none focus:border-cyan-300"
            />
          </div>

          <button
            onClick={() => setActiveSection('settings')}
            className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-300/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-300" />
            <span>Admin Security</span>
          </button>

          <button
            onClick={onLogout}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Horizontal Module Navigation Bar */}
      <div className="bg-[#061547]/90 border-b border-cyan-400/20 px-4 py-2 overflow-x-auto flex items-center gap-2">
        {navItems.map((item) => {
          const active = activeSection === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                active
                  ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-[#040D33] shadow-lg'
                  : 'bg-white/10 text-cyan-100 hover:bg-white/20'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {statusBanner && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-400 text-emerald-100 text-xs font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              {statusBanner}
            </span>
            <button onClick={() => setStatusBanner(null)} className="text-emerald-200 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* 1. DASHBOARD */}
        {activeSection === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-cyan-300/25">
                <p className="text-xs text-cyan-200 font-semibold">Total Students</p>
                <p className="text-3xl font-extrabold mt-1">{studentRecords.length}</p>
                <p className="text-[11px] text-amber-300 font-bold mt-1">
                  Cloud + SQLCipher Room Synced
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-cyan-300/25">
                <p className="text-xs text-cyan-200 font-semibold">Courses & Batches</p>
                <p className="text-3xl font-extrabold mt-1">{courses.length}</p>
                <p className="text-[11px] text-amber-300 font-bold mt-1">
                  {batches.length} Active Classroom Batches
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-cyan-300/25">
                <p className="text-xs text-cyan-200 font-semibold">50-MCQ Exams & Results</p>
                <p className="text-3xl font-extrabold mt-1">{examRecords.length}</p>
                <p className="text-[11px] text-amber-300 font-bold mt-1">
                  {resultRecords.length} Graded Attempts
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-cyan-300/25">
                <p className="text-xs text-cyan-200 font-semibold">Fee Collection</p>
                <p className="text-3xl font-extrabold mt-1">
                  ₹{feeRecords.reduce((acc, r) => acc + (Number(r.numericValue) || 0), 0)}
                </p>
                <p className="text-[11px] text-amber-300 font-bold mt-1">
                  {attendanceRecords.length} Verified Attendance Logs
                </p>
              </div>
            </div>

            {/* All 19 Modules Quick Grid */}
            <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-extrabold">All 19 Enterprise ERP Modules</h2>
                  <p className="text-xs text-slate-600">
                    Synchronized in real time with Firebase Cloud Firestore & Native Android Jetpack Compose
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  Cloud Sync Active
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {navItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActiveSection(item.key)}
                    className="p-3.5 rounded-2xl bg-[#0077B6] hover:bg-[#023E8A] text-white font-bold text-xs flex items-center gap-2.5 shadow transition-all cursor-pointer"
                  >
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. STUDENTS & GALLERY PHOTO */}
        {activeSection === 'students' && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-4">
            <h2 className="text-lg font-extrabold">Create Student Profile with Gallery Photo</h2>
            <p className="text-xs text-slate-600">
              Student profiles sync automatically with the Native Android Room SQLCipher database and Cloud Firestore.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={stuCode}
                onChange={(e) => setStuCode(e.target.value)}
                placeholder="Student Roll / ID (e.g. WI2026001)"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={stuName}
                onChange={(e) => setStuName(e.target.value)}
                placeholder="Student Full Name"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={stuGuardian}
                onChange={(e) => setStuGuardian(e.target.value)}
                placeholder="Father / Guardian Name"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={stuCourse}
                  onChange={(e) => setStuCourse(e.target.value)}
                  placeholder="Course (e.g. ADCA)"
                  className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
                />
                <input
                  type="text"
                  value={stuBatch}
                  onChange={(e) => setStuBatch(e.target.value)}
                  placeholder="Batch (e.g. BATCH-A1)"
                  className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold cursor-pointer">
                {stuPhotoDataUrl ? 'Photo Attached ✓' : 'Select Student Gallery Photo'}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
              {stuPhotoDataUrl && (
                <img
                  src={stuPhotoDataUrl}
                  alt="Preview"
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#0077B6]"
                />
              )}
            </div>

            <button
              onClick={async () => {
                if (!stuName.trim()) return;
                const finalCode = sanitizeId(stuCode.trim() || `WI-${Date.now().toString().slice(-5)}`);
                await onCreateErpRecord({
                  module: 'student',
                  code: finalCode,
                  title: stuName.trim(),
                  subtitle: `Guardian: ${stuGuardian.trim() || 'N/A'}`,
                  category: stuCourse.trim(),
                  status: 'Active',
                  branchId: 'MAIN-BRANCH',
                  courseId: stuCourse.trim(),
                  batchId: stuBatch.trim(),
                  targetUserId: finalCode,
                  numericValue: 100,
                  secondaryNumericValue: 0,
                  dateStr: new Date().toISOString().split('T')[0],
                  notes: 'Enrolled Student Profile',
                  extra1: stuPhotoDataUrl,
                  extra2: stuGuardian.trim(),
                  extra3: '',
                  extra4: '',
                  visibility: 'institute',
                });
                notify(`Student "${stuName.trim()}" (${finalCode}) saved to Cloud Firestore!`);
                setStuCode('');
                setStuName('');
                setStuGuardian('');
                setStuPhotoDataUrl('');
              }}
              className="w-full h-11 rounded-xl bg-[#0077B6] hover:bg-[#023E8A] text-white font-bold text-sm cursor-pointer"
            >
              Save Student Profile to Cloud Firestore
            </button>

            <div className="divide-y divide-slate-200 pt-3">
              {studentRecords.map((st) => (
                <div key={st.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {st.extra1 ? (
                      <img
                        src={st.extra1}
                        alt={st.title}
                        className="w-10 h-10 rounded-full object-cover border border-[#0077B6]"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-sky-100 text-[#0077B6] font-bold flex items-center justify-center">
                        {st.title.slice(0, 1)}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-sm">
                        {st.title} <span className="text-xs text-[#0077B6]">({st.code})</span>
                      </p>
                      <p className="text-xs text-slate-600">
                        {st.courseId} • {st.batchId} • {st.subtitle}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteErpRecord(st.id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. CREDENTIAL VAULT */}
        {activeSection === 'id_vault' && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-4">
            <h2 className="text-lg font-extrabold">
              Cloud Credential Vault (Create Student / Teacher / Parent / Admin Login)
            </h2>
            <p className="text-xs text-slate-600">
              Accounts created here are stored with salted SHA-256 verifiers in Cloud Firestore and synced with Firebase Authentication.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={vaultUser}
                onChange={(e) => setVaultUser(e.target.value)}
                placeholder="Login Username / Roll ID (e.g. STU101)"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={vaultPass}
                onChange={(e) => setVaultPass(e.target.value)}
                placeholder="Password"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={vaultDisplay}
                onChange={(e) => setVaultDisplay(e.target.value)}
                placeholder="Full Display Name"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={vaultRole}
                  onChange={(e) => setVaultRole(e.target.value as UserRole)}
                  className="h-11 px-3 rounded-xl border border-slate-300 text-sm font-semibold"
                >
                  <option value="student">Student Portal</option>
                  <option value="teacher">Teacher Portal</option>
                  <option value="parent">Parent Portal</option>
                  <option value="admin">Admin Portal</option>
                </select>
                <input
                  type="text"
                  value={vaultLinked}
                  onChange={(e) => setVaultLinked(e.target.value)}
                  placeholder="Linked ID (Optional)"
                  className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <button
              onClick={async () => {
                if (!vaultUser.trim() || !vaultPass.trim()) return;
                await onSaveCloudCredential({
                  username: vaultUser.trim(),
                  password: vaultPass.trim(),
                  displayName: vaultDisplay.trim() || vaultUser.trim(),
                  role: vaultRole,
                  linkedEntityId: vaultLinked.trim() || vaultUser.trim().toUpperCase(),
                });
                notify(`Cloud Login Credential saved for "${vaultUser.trim()}" (${vaultRole.toUpperCase()})!`);
                setVaultUser('');
                setVaultPass('');
                setVaultDisplay('');
                setVaultLinked('');
              }}
              className="w-full h-11 rounded-xl bg-[#0077B6] hover:bg-[#023E8A] text-white font-bold text-sm cursor-pointer"
            >
              Provision & Sync Account in Firebase Cloud
            </button>

            <div className="divide-y divide-slate-200 pt-3">
              {cloudUsers.map((u) => (
                <div key={u.uid} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-bold">{u.displayName}</span>{' '}
                    <span className="text-xs text-[#0077B6] font-bold">(@{u.username})</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-sky-100 text-[#0077B6] text-xs font-extrabold uppercase">
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. COURSES */}
        {activeSection === 'courses' && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-4">
            <h2 className="text-lg font-extrabold">Institute Courses Management</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="Course Code (e.g. ADCA, TALLY-PRIME, PYTHON)"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="Course Full Title"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={courseDuration}
                onChange={(e) => setCourseDuration(e.target.value)}
                placeholder="Duration (e.g. 12 Months)"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="number"
                value={courseFee}
                onChange={(e) => setCourseFee(e.target.value)}
                placeholder="Course Fee (₹)"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <textarea
              value={courseSyllabus}
              onChange={(e) => setCourseSyllabus(e.target.value)}
              placeholder="Syllabus topics..."
              className="w-full p-3.5 rounded-xl border border-slate-300 text-sm"
              rows={2}
            />
            <button
              onClick={async () => {
                if (!courseCode.trim() || !courseName.trim()) return;
                await onCreateCourse({
                  code: courseCode.trim().toUpperCase(),
                  name: courseName.trim(),
                  category: 'Diploma',
                  duration: courseDuration.trim(),
                  fee: Number(courseFee) || 0,
                  syllabus: courseSyllabus.trim(),
                  description: courseName.trim(),
                  branchId: 'MAIN-BRANCH',
                  status: 'active',
                });
                notify(`Course "${courseName.trim()}" added to Cloud Firestore!`);
                setCourseCode('');
                setCourseName('');
                setCourseSyllabus('');
              }}
              className="w-full h-11 rounded-xl bg-[#0077B6] hover:bg-[#023E8A] text-white font-bold text-sm cursor-pointer"
            >
              Add Course
            </button>

            <div className="divide-y divide-slate-200">
              {courses.map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">
                      {c.code} — {c.name}
                    </p>
                    <p className="text-xs text-slate-600">
                      {c.duration} • ₹{c.fee} • {c.syllabus}
                    </p>
                  </div>
                  <button
                    onClick={() => onDeleteCourse(c.id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. BATCHES */}
        {activeSection === 'batches' && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-4">
            <h2 className="text-lg font-extrabold">Classroom Batches Management</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                placeholder="Batch Code (e.g. BATCH-A1)"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Batch Name"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={batchCourse}
                onChange={(e) => setBatchCourse(e.target.value)}
                placeholder="Course Code (e.g. ADCA)"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={batchTiming}
                onChange={(e) => setBatchTiming(e.target.value)}
                placeholder="Timing (e.g. 10:00 AM - 11:00 AM)"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <button
              onClick={async () => {
                if (!batchCode.trim() || !batchName.trim()) return;
                await onCreateBatch({
                  code: batchCode.trim().toUpperCase(),
                  name: batchName.trim(),
                  courseId: batchCourse.trim().toUpperCase(),
                  courseName: batchCourse.trim().toUpperCase(),
                  teacherId: 'FACULTY-01',
                  teacherName: batchTeacher.trim() || userProfile.displayName,
                  branchId: 'MAIN-BRANCH',
                  timing: batchTiming.trim(),
                  capacity: 30,
                  startDate: new Date().toISOString().split('T')[0],
                  status: 'active',
                });
                notify(`Batch "${batchName.trim()}" created!`);
                setBatchCode('');
                setBatchName('');
              }}
              className="w-full h-11 rounded-xl bg-[#0077B6] hover:bg-[#023E8A] text-white font-bold text-sm cursor-pointer"
            >
              Create Batch
            </button>

            <div className="divide-y divide-slate-200">
              {batches.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">
                      {b.code} — {b.name} ({b.courseName})
                    </p>
                    <p className="text-xs text-slate-600">{b.timing}</p>
                  </div>
                  <button
                    onClick={() => onDeleteBatch(b.id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. BATCH & QR ATTENDANCE */}
        {activeSection === 'attendance' && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-4">
            <h2 className="text-lg font-extrabold">Whole-Batch Direct Sync & Dynamic QR Attendance</h2>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={selectedAttBatch}
                onChange={(e) => setSelectedAttBatch(e.target.value)}
                placeholder="Batch Code (e.g. BATCH-A1)"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <button
                onClick={async () => {
                  const today = new Date().toISOString().split('T')[0];
                  for (const stu of studentRecords) {
                    const st = attStatusMap[stu.code] || 'Present';
                    await onCreateErpRecord({
                      module: 'attendance',
                      code: stu.code,
                      title: stu.title,
                      subtitle: `Batch ${selectedAttBatch} • ${today}`,
                      category: 'Batch Direct Sync',
                      status: st,
                      branchId: 'MAIN-BRANCH',
                      courseId: stu.courseId || 'ADCA',
                      batchId: selectedAttBatch,
                      targetUserId: stu.code,
                      numericValue: st === 'Present' ? 100 : 0,
                      secondaryNumericValue: 100,
                      dateStr: today,
                      notes: 'Synced Batch Attendance',
                      extra1: selectedAttBatch,
                      extra2: st,
                      extra3: '',
                      extra4: '',
                      visibility: 'institute',
                    });
                  }
                  notify(`Attendance synced to Cloud Firestore for ${studentRecords.length} students!`);
                }}
                className="px-5 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
              >
                Submit Whole-Batch Attendance
              </button>
            </div>

            <div className="divide-y divide-slate-200">
              {studentRecords.map((stu) => {
                const current = attStatusMap[stu.code] || 'Present';
                return (
                  <div key={stu.id} className="py-2.5 flex items-center justify-between">
                    <span className="font-bold text-sm">
                      {stu.title} ({stu.code})
                    </span>
                    <button
                      onClick={() =>
                        setAttStatusMap({
                          ...attStatusMap,
                          [stu.code]: current === 'Present' ? 'Absent' : 'Present',
                        })
                      }
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        current === 'Present'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {current}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 7. 50-MCQ EXAMINATIONS */}
        {activeSection === 'examinations' && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-4">
            <h2 className="text-lg font-extrabold">Publish 50-MCQ Online Examination</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={recCode}
                onChange={(e) => setRecCode(e.target.value)}
                placeholder="Course Code (e.g. ADCA)"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={recTitle}
                onChange={(e) => setRecTitle(e.target.value)}
                placeholder="Exam Title (e.g. ADCA Final 50-MCQ Exam)"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <button
              onClick={async () => {
                const cCode = (recCode.trim() || 'ADCA').toUpperCase();
                const eTitle = recTitle.trim() || `${cCode} 50-MCQ Examination`;
                const bank = generate50McqQuestionBank(cCode);
                await onCreateErpRecord({
                  module: 'exam',
                  code: `EXAM-${cCode}-${Date.now().toString().slice(-4)}`,
                  title: eTitle,
                  subtitle: `${bank.length} MCQ Questions • 100 Marks • 60 Mins`,
                  category: cCode,
                  status: 'Published',
                  branchId: 'MAIN-BRANCH',
                  courseId: cCode,
                  batchId: 'ALL',
                  targetUserId: 'ALL',
                  numericValue: 100,
                  secondaryNumericValue: 50,
                  dateStr: new Date().toISOString().split('T')[0],
                  notes: '50-MCQ Online Examination',
                  extra1: cCode,
                  extra2: '50',
                  extra3: '',
                  extra4: '',
                  visibility: 'institute',
                });
                notify(`Published 50-MCQ Exam "${eTitle}" to Student Portal!`);
                setRecCode('');
                setRecTitle('');
              }}
              className="w-full h-11 rounded-xl bg-[#0077B6] hover:bg-[#023E8A] text-white font-bold text-sm cursor-pointer"
            >
              Publish 50-MCQ Examination
            </button>

            <div className="divide-y divide-slate-200">
              {examRecords.map((ex) => (
                <div key={ex.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">{ex.title}</p>
                    <p className="text-xs text-slate-600">{ex.subtitle}</p>
                  </div>
                  <button
                    onClick={() => onDeleteErpRecord(ex.id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. RESULTS */}
        {activeSection === 'results' && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-4">
            <h2 className="text-lg font-extrabold">Examination Results & Grading</h2>
            <div className="divide-y divide-slate-200">
              {resultRecords.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No graded exam submissions yet.</p>
              ) : (
                resultRecords.map((r) => {
                  const { grade, passed } = calculateGrade(Number(r.numericValue) || 0);
                  return (
                    <div key={r.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm">{r.title}</p>
                        <p className="text-xs text-slate-600">
                          {r.subtitle} • Grade: {grade} ({passed ? 'PASS' : 'FAIL'})
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                          passed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {r.numericValue}/100 ({grade})
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 9. BRANCHES */}
        {activeSection === 'branches' && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-4">
            <h2 className="text-lg font-extrabold">Institute Branches</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                placeholder="Branch Code (e.g. MAIN-BRANCH)"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="Branch Name"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={branchAddress}
                onChange={(e) => setBranchAddress(e.target.value)}
                placeholder="Campus Address"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={branchPhone}
                onChange={(e) => setBranchPhone(e.target.value)}
                placeholder="Phone Number"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <button
              onClick={async () => {
                if (!branchCode.trim() || !branchName.trim()) return;
                await onCreateBranch({
                  code: branchCode.trim().toUpperCase(),
                  name: branchName.trim(),
                  address: branchAddress.trim(),
                  phone: branchPhone.trim(),
                  email: 'info@waqarinstitute.edu',
                  managerName: userProfile.displayName,
                  status: 'active',
                });
                notify(`Branch "${branchName.trim()}" created!`);
                setBranchCode('');
                setBranchName('');
              }}
              className="w-full h-11 rounded-xl bg-[#0077B6] hover:bg-[#023E8A] text-white font-bold text-sm cursor-pointer"
            >
              Add Branch
            </button>
            <div className="divide-y divide-slate-200">
              {branches.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">
                      {b.code} — {b.name}
                    </p>
                    <p className="text-xs text-slate-600">
                      {b.address} • {b.phone}
                    </p>
                  </div>
                  <button
                    onClick={() => onDeleteBranch(b.id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 10. AGORA LIVE CLASS */}
        {activeSection === 'live_class' && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-4">
            <h2 className="text-lg font-extrabold">Agora Live Classroom Broadcast</h2>
            <p className="text-xs text-slate-600">
              Start an HMAC-SHA256 token-authenticated live video session for active batches.
            </p>
            <button
              onClick={async () => {
                await onCreateErpRecord({
                  module: 'event',
                  code: `LIVE-${Date.now().toString().slice(-4)}`,
                  title: 'Live Interactive Classroom Session',
                  subtitle: `Host: ${userProfile.displayName} • Channel: WAQAR-LIVE-MAIN`,
                  category: 'Agora Live Class',
                  status: 'LIVE',
                  branchId: 'MAIN-BRANCH',
                  courseId: 'ADCA',
                  batchId: 'BATCH-A1',
                  targetUserId: 'ALL',
                  numericValue: 1,
                  secondaryNumericValue: 1,
                  dateStr: new Date().toISOString().split('T')[0],
                  notes: 'Agora RTC Live Broadcast Active',
                  extra1: 'WAQAR-LIVE-MAIN',
                  extra2: '',
                  extra3: '',
                  extra4: '',
                  visibility: 'institute',
                });
                triggerCelebrationConfetti();
                notify('Live Class Broadcast notified to all Students & Teachers!');
              }}
              className="px-5 h-11 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm cursor-pointer"
            >
              Launch Live Class Broadcast
            </button>
          </div>
        )}

        {/* 11. INSTANT AI TUTOR */}
        {activeSection === 'ai_tutor' && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-4">
            <h2 className="text-lg font-extrabold">Waqar Institute AI Academic Tutor</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={aiCourseContext}
                onChange={(e) => setAiCourseContext(e.target.value)}
                placeholder="Course Context (e.g. ADCA / Tally Prime)"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                placeholder="Ask any computer course question or shortcut key..."
                className="sm:col-span-2 h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <button
              onClick={handleAskAiTutor}
              disabled={aiLoading}
              className="px-6 h-11 rounded-xl bg-[#0077B6] hover:bg-[#023E8A] text-white font-bold text-sm cursor-pointer"
            >
              {aiLoading ? 'Generating Answer...' : 'Ask AI Tutor'}
            </button>
            {aiAnswer && (
              <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sm whitespace-pre-wrap leading-relaxed">
                {aiAnswer}
              </div>
            )}
          </div>
        )}

        {/* 12. SETTINGS & ADMIN CLOUD SYNC CREDENTIAL UPDATER */}
        {activeSection === 'settings' && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-extrabold">
                Admin Cloud Sync Credentials & Enterprise Banking Security
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Default Admin is initialized in Cloud Firestore as <b>waqar</b> / <b>waqar</b>. Updating your Admin Username or Password below immediately saves the new credentials to Firebase Cloud Sync (<code>admins/admin_primary</code> &amp; <code>users</code>) across Web &amp; Native Android!
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  New Admin Username
                </label>
                <input
                  type="text"
                  value={adminNewUsername}
                  onChange={(e) => setAdminNewUsername(e.target.value)}
                  placeholder="Enter Admin Username (e.g. waqar)"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  New Admin Password
                </label>
                <input
                  type="password"
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  placeholder="Enter new Admin Password"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <button
              onClick={async () => {
                if (!adminNewPassword.trim()) {
                  notify('Please enter a new password to update in Cloud Sync.');
                  return;
                }
                await onUpdateAdminCloudSyncCredentials(
                  adminNewUsername.trim() || userProfile.username || 'waqar',
                  adminNewPassword.trim()
                );
                setAdminNewPassword('');
                notify(
                  `Admin credentials updated in Firebase Cloud Sync! New Admin Username: "${
                    adminNewUsername.trim() || 'waqar'
                  }"`
                );
              }}
              className="w-full h-11 rounded-xl bg-[#0077B6] hover:bg-[#023E8A] text-white font-bold text-sm cursor-pointer"
            >
              Update Admin Username & Password in Firebase Cloud Sync
            </button>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <h3 className="text-sm font-extrabold flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#0077B6]" />
                Link Student ID to Parent Account
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={linkStudentId}
                  onChange={(e) => setLinkStudentId(e.target.value)}
                  placeholder="Student Roll ID (e.g. WI2026001)"
                  className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
                />
                <input
                  type="text"
                  value={linkParentId}
                  onChange={(e) => setLinkParentId(e.target.value)}
                  placeholder="Parent Login ID"
                  className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <button
                onClick={async () => {
                  if (!linkStudentId.trim() || !linkParentId.trim()) return;
                  await onLinkStudentToParent(linkStudentId.trim(), linkParentId.trim());
                  notify(`Linked Student "${linkStudentId.trim()}" with Parent "${linkParentId.trim()}"!`);
                  setLinkStudentId('');
                  setLinkParentId('');
                }}
                className="px-5 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
              >
                Connect Student & Parent in Cloud
              </button>
            </div>
          </div>
        )}

        {/* 13. UNIFIED MODULE MANAGER FOR FEES, TEACHERS, ADMISSIONS, CERTIFICATES, REPORTS, NOTIFICATIONS, MESSAGES */}
        {['fees', 'teachers', 'admissions', 'certificates', 'reports', 'notifications', 'messages'].includes(
          activeSection
        ) && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-4">
            <h2 className="text-lg font-extrabold capitalize">Manage {activeSection}</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={recCode}
                onChange={(e) => setRecCode(e.target.value)}
                placeholder="Record ID / Student Roll No"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={recTitle}
                onChange={(e) => setRecTitle(e.target.value)}
                placeholder="Title / Full Name"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={recSubtitle}
                onChange={(e) => setRecSubtitle(e.target.value)}
                placeholder="Subtitle / Course / Details"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="number"
                value={recAmount}
                onChange={(e) => setRecAmount(e.target.value)}
                placeholder="Amount ₹ / Score (Optional)"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <textarea
              value={recNotes}
              onChange={(e) => setRecNotes(e.target.value)}
              placeholder="Additional notes..."
              className="w-full p-3.5 rounded-xl border border-slate-300 text-sm"
              rows={2}
            />
            <button
              onClick={async () => {
                if (!recTitle.trim()) return;
                const moduleMap: Record<string, ErpModuleType> = {
                  fees: 'fee',
                  teachers: 'teacher',
                  admissions: 'admission',
                  certificates: 'certificate',
                  reports: 'audit',
                  notifications: 'notification',
                  messages: 'message',
                };
                const mod = moduleMap[activeSection] || 'notification';
                const cleanCode = sanitizeId(
                  recCode.trim() || `${mod.toUpperCase()}-${Date.now().toString().slice(-4)}`
                );
                await onCreateErpRecord({
                  module: mod,
                  code: cleanCode,
                  title: recTitle.trim(),
                  subtitle: recSubtitle.trim() || '-',
                  category: activeSection,
                  status: 'Active',
                  branchId: 'MAIN-BRANCH',
                  courseId: 'ADCA',
                  batchId: 'BATCH-A1',
                  targetUserId: cleanCode,
                  numericValue: Number(recAmount) || 0,
                  secondaryNumericValue: 100,
                  dateStr: new Date().toISOString().split('T')[0],
                  notes: recNotes.trim(),
                  extra1: '',
                  extra2: '',
                  extra3: '',
                  extra4: '',
                  visibility: 'institute',
                });
                notify(`Saved ${activeSection} record "${recTitle.trim()}" to Cloud Firestore!`);
                setRecCode('');
                setRecTitle('');
                setRecSubtitle('');
                setRecAmount('');
                setRecNotes('');
              }}
              className="w-full h-11 rounded-xl bg-[#0077B6] hover:bg-[#023E8A] text-white font-bold text-sm cursor-pointer"
            >
              Save Record to Cloud Firestore
            </button>

            <div className="divide-y divide-slate-200 pt-2">
              {erpRecords
                .filter((r) => {
                  const moduleMap: Record<string, ErpModuleType> = {
                    fees: 'fee',
                    teachers: 'teacher',
                    admissions: 'admission',
                    certificates: 'certificate',
                    reports: 'audit',
                    notifications: 'notification',
                    messages: 'message',
                  };
                  return r.module === (moduleMap[activeSection] || 'notification');
                })
                .map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">
                        {item.title} <span className="text-xs text-[#0077B6]">({item.code})</span>
                      </p>
                      <p className="text-xs text-slate-600">
                        {item.subtitle}{' '}
                        {item.numericValue > 0 ? `• ₹${item.numericValue}` : ''} • {item.dateStr}
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteErpRecord(item.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
