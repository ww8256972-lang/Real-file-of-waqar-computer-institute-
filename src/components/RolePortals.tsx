import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  FileText,
  GraduationCap,
  LogOut,
  QrCode,
  Sparkles,
  UserCheck,
  Wallet,
} from 'lucide-react';
import {
  BatchDoc,
  BranchDoc,
  CourseDoc,
  ErpRecordDoc,
  UserProfileDoc,
  UserRole,
  calculateGrade,
} from '../types/erp';
import {
  generate50McqQuestionBank,
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
  onUpdateErpRecordStatus: (id: string, newStatus: string) => Promise<void>;
  onUpdateUserProfile: (updates: Partial<UserProfileDoc>) => Promise<void>;
  onSaveCloudCredential: (payload: {
    username: string;
    password: string;
    displayName: string;
    role: UserRole;
    branchId?: string;
    linkedEntityId?: string;
  }) => Promise<void>;
  onLinkStudentToParent: (studentUsername: string, parentUsername: string) => Promise<void>;
  onLogout: () => void;
}

export const RolePortals: React.FC<RolePortalsProps> = ({
  activePortal,
  userProfile,
  courses,
  batches,
  erpRecords,
  onCreateErpRecord,
  onLogout,
}) => {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'exam' | 'attendance' | 'fees' | 'ai_tutor'>('overview');
  const [examCourseCode, setExamCourseCode] = useState('ADCA');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D'>>({});
  const [submittedResult, setSubmittedResult] = useState<{
    score: number;
    grade: string;
    passed: boolean;
  } | null>(null);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  const targetId = (userProfile.linkedEntityId || userProfile.username || '').toUpperCase();
  const myAttendance = erpRecords.filter(
    (r) =>
      r.module === 'attendance' &&
      (r.code.toUpperCase() === targetId ||
        r.targetUserId.toUpperCase() === targetId ||
        activePortal === 'teacher')
  );
  const myResults = erpRecords.filter(
    (r) =>
      r.module === 'result' &&
      (r.targetUserId.toUpperCase() === targetId ||
        r.title.toUpperCase().includes(targetId) ||
        activePortal === 'teacher')
  );
  const myFees = erpRecords.filter(
    (r) =>
      r.module === 'fee' &&
      (r.code.toUpperCase() === targetId ||
        r.targetUserId.toUpperCase() === targetId ||
        activePortal === 'teacher')
  );

  const questions = generate50McqQuestionBank(examCourseCode);

  const handleSubmitExam = async () => {
    let score = 0;
    for (const q of questions) {
      if (selectedAnswers[q.id] === q.correctOption) {
        score += q.marks;
      }
    }
    const { grade, passed } = calculateGrade(score);
    setSubmittedResult({ score, grade, passed });
    if (passed) {
      triggerCelebrationConfetti();
    }

    await onCreateErpRecord({
      module: 'result',
      code: `RES-${examCourseCode}-${userProfile.username}`,
      title: `${userProfile.displayName} (${userProfile.username})`,
      subtitle: `${examCourseCode} 50-MCQ Exam • Score: ${score}/100 • Grade: ${grade}`,
      category: examCourseCode,
      status: passed ? 'PASS' : 'FAIL',
      branchId: userProfile.branchId || 'MAIN-BRANCH',
      courseId: examCourseCode,
      batchId: 'BATCH-A1',
      targetUserId: userProfile.username,
      numericValue: score,
      secondaryNumericValue: 100,
      dateStr: new Date().toISOString().split('T')[0],
      notes: `Completed 50-MCQ Exam (${Object.keys(selectedAnswers).length}/50 answered)`,
      extra1: grade,
      extra2: String(score),
      extra3: '',
      extra4: '',
      visibility: 'institute',
    });
  };

  const handleAskTutor = async () => {
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    try {
      const res = await fetch('/api/ai-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          courseContext: examCourseCode,
          studentName: userProfile.displayName,
          userId: userProfile.uid,
        }),
      });
      const data = await res.json();
      setAiReply(data.reply || 'Practice this concept in your computer lab session.');
    } catch {
      setAiReply('Offline Syllabus Guide: Practice this command in your batch lab session.');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#040D33] via-[#0A2170] to-[#0077B6] text-white">
      <header className="bg-[#040D33]/95 border-b border-cyan-400/25 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white p-1.5 flex items-center justify-center">
            <img
              src="/waqar_logo.png"
              alt="Waqar Computer Institute"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="font-extrabold text-base sm:text-lg uppercase">
              WAQAR COMPUTER INSTITUTE — {activePortal} PORTAL
            </h1>
            <p className="text-xs text-cyan-200 font-semibold">
              Welcome, {userProfile.displayName} ({userProfile.username})
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Logout</span>
        </button>
      </header>

      <div className="bg-[#061547]/90 border-b border-cyan-400/20 px-4 py-2 flex gap-2 overflow-x-auto">
        {[
          { key: 'overview', label: 'Dashboard Overview', icon: <GraduationCap className="w-4 h-4" /> },
          { key: 'exam', label: '50-MCQ Online Exam', icon: <FileText className="w-4 h-4" /> },
          { key: 'attendance', label: 'Attendance Log', icon: <QrCode className="w-4 h-4" /> },
          { key: 'fees', label: 'Fee & Results', icon: <Wallet className="w-4 h-4" /> },
          { key: 'ai_tutor', label: 'AI Academic Tutor', icon: <Sparkles className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedTab(tab.key as typeof selectedTab)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              selectedTab === tab.key
                ? 'bg-cyan-400 text-[#040D33]'
                : 'bg-white/10 text-cyan-100 hover:bg-white/20'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {selectedTab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white/10 border border-cyan-300/25">
                <p className="text-xs text-cyan-200">Attendance</p>
                <p className="text-2xl font-extrabold mt-1">{myAttendance.length} Days</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/10 border border-cyan-300/25">
                <p className="text-xs text-cyan-200">Graded Exams</p>
                <p className="text-2xl font-extrabold mt-1">{myResults.length}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/10 border border-cyan-300/25">
                <p className="text-xs text-cyan-200">Active Courses</p>
                <p className="text-2xl font-extrabold mt-1">{courses.length || 1}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/10 border border-cyan-300/25">
                <p className="text-xs text-cyan-200">Active Batches</p>
                <p className="text-2xl font-extrabold mt-1">{batches.length || 1}</p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-3">
              <h2 className="text-lg font-extrabold">Recent Exam Results & Certificates</h2>
              {myResults.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No exam results yet. Open the 50-MCQ Online Exam tab to take your course test.
                </p>
              ) : (
                myResults.map((res) => (
                  <div
                    key={res.id}
                    className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-sm">{res.title}</p>
                      <p className="text-xs text-slate-600">{res.subtitle}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                      {res.status} ({res.numericValue}/100)
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {selectedTab === 'exam' && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">50-MCQ Online Examination (100 Marks)</h2>
                <p className="text-xs text-slate-600">
                  Each question carries 2 marks. Instant cloud grading & certificate verification.
                </p>
              </div>
              <select
                value={examCourseCode}
                onChange={(e) => {
                  setExamCourseCode(e.target.value);
                  setSelectedAnswers({});
                  setSubmittedResult(null);
                }}
                className="h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold"
              >
                <option value="ADCA">ADCA</option>
                <option value="TALLY-PRIME">TALLY PRIME</option>
                <option value="DCA">DCA</option>
                <option value="CCC">CCC</option>
                <option value="PYTHON">PYTHON</option>
              </select>
            </div>

            {submittedResult && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  <div>
                    <p className="font-extrabold text-sm text-emerald-900">
                      Exam Graded! Score: {submittedResult.score}/100 • Grade: {submittedResult.grade}
                    </p>
                    <p className="text-xs text-emerald-700">
                      Result synced to Waqar Computer Institute Cloud Firestore.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 max-h-[540px] overflow-y-auto pr-1">
              {questions.map((q) => (
                <div key={q.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <p className="font-bold text-sm">
                    Q{q.id}. {q.question}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {(
                      [
                        ['A', q.optionA],
                        ['B', q.optionB],
                        ['C', q.optionC],
                        ['D', q.optionD],
                      ] as const
                    ).map(([optKey, optLabel]) => {
                      const chosen = selectedAnswers[q.id] === optKey;
                      return (
                        <button
                          key={optKey}
                          type="button"
                          onClick={() =>
                            setSelectedAnswers({
                              ...selectedAnswers,
                              [q.id]: optKey,
                            })
                          }
                          className={`p-2.5 rounded-xl text-left text-xs font-semibold border transition-all cursor-pointer ${
                            chosen
                              ? 'bg-[#0077B6] text-white border-[#0077B6]'
                              : 'bg-white text-slate-800 border-slate-300 hover:bg-sky-50'
                          }`}
                        >
                          <span className="font-extrabold mr-1.5">{optKey}.</span> {optLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleSubmitExam}
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm cursor-pointer"
            >
              Submit 50-MCQ Examination & Sync Result
            </button>
          </div>
        )}

        {selectedTab === 'attendance' && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-3">
            <h2 className="text-lg font-extrabold">Verified Attendance Records</h2>
            {myAttendance.length === 0 ? (
              <p className="text-xs text-slate-500">No attendance records logged yet.</p>
            ) : (
              myAttendance.map((att) => (
                <div
                  key={att.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-sm">{att.title}</p>
                    <p className="text-xs text-slate-600">
                      {att.subtitle} • {att.dateStr}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    {att.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {selectedTab === 'fees' && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-3">
            <h2 className="text-lg font-extrabold">Fee Receipts & Academic Ledger</h2>
            {myFees.length === 0 ? (
              <p className="text-xs text-slate-500">No fee receipts found for your ID.</p>
            ) : (
              myFees.map((fee) => (
                <div
                  key={fee.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-sm">{fee.title}</p>
                    <p className="text-xs text-slate-600">
                      {fee.subtitle} • {fee.dateStr}
                    </p>
                  </div>
                  <span className="font-extrabold text-sm text-[#0077B6]">
                    ₹{fee.numericValue}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {selectedTab === 'ai_tutor' && (
          <div className="p-6 rounded-3xl bg-white text-[#03045E] shadow-xl space-y-4">
            <h2 className="text-lg font-extrabold">Instant AI Academic Tutor</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ask about Tally Prime, MS Excel formulas, Python, HTML..."
                className="flex-1 h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <button
                onClick={handleAskTutor}
                disabled={aiBusy}
                className="px-5 h-11 rounded-xl bg-[#0077B6] text-white font-bold text-xs cursor-pointer"
              >
                {aiBusy ? 'Thinking...' : 'Ask AI'}
              </button>
            </div>
            {aiReply && (
              <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-sm whitespace-pre-wrap">
                {aiReply}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
