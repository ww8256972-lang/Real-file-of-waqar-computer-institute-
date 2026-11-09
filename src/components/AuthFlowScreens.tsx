import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Eye,
  EyeOff,
  GraduationCap,
  HelpCircle,
  Lock,
  Shield,
  User,
  UserCheck,
  Users,
  AlertCircle,
  CheckCircle2,
  Wifi,
  BatteryCharging,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { WaqarCrestLogo } from './WaqarBranding';
import { WaterfallAnimation } from './WaterfallAnimation';

export type PortalLoginOption = 'student' | 'teacher' | 'parent' | 'admin';

interface AuthFlowScreensProps {
  onAuthenticateWithCredentials: (
    username: string,
    password: string,
    selectedPortal?: PortalLoginOption
  ) => Promise<void>;
  onResetPasswordWithDob?: (
    username: string,
    dobInput: string,
    newPassword: string
  ) => Promise<void>;
  onOpenKotlinModal?: () => void;
  authLoading: boolean;
  authError: string | null;
}

const PORTAL_CARDS: {
  id: PortalLoginOption;
  title: string;
  subtitle: string;
  placeholder: string;
  badge: string;
  icon: React.FC<{ className?: string }>;
  gradient: string;
}[] = [
  {
    id: 'student',
    title: 'Student Login',
    subtitle: 'Continue with Student Account',
    placeholder: 'Username / Student ID (e.g. WI2026001)',
    badge: 'Student Portal',
    icon: GraduationCap,
    gradient: 'from-blue-600 via-indigo-600 to-blue-800',
  },
  {
    id: 'teacher',
    title: 'Teacher Login',
    subtitle: 'Continue with Teacher Account',
    placeholder: 'Username / Teacher ID (e.g. WI-TCH-120)',
    badge: 'Teacher Portal',
    icon: UserCheck,
    gradient: 'from-indigo-600 via-blue-700 to-cyan-700',
  },
  {
    id: 'parent',
    title: 'Parent Login',
    subtitle: 'Continue with Parent Account',
    placeholder: 'Username / Parent ID (e.g. WI-PRN-001)',
    badge: 'Parent Portal',
    icon: Users,
    gradient: 'from-blue-700 via-purple-700 to-indigo-800',
  },
  {
    id: 'admin',
    title: 'Admin Login',
    subtitle: 'Continue with Admin Account',
    placeholder: 'Admin Username',
    badge: 'Admin Portal',
    icon: Shield,
    gradient: 'from-[#061445] via-[#0E2A8A] to-[#1D4ED8]',
  },
];

export const AuthFlowScreens: React.FC<AuthFlowScreensProps> = ({
  onAuthenticateWithCredentials,
  onResetPasswordWithDob,
  authLoading,
  authError,
}) => {
  const [step, setStep] = useState<'splash' | 'welcome' | 'portal_select' | 'login'>('welcome');
  const [selectedPortal, setSelectedPortal] = useState<PortalLoginOption>('student');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [localValidationMsg, setLocalValidationMsg] = useState<string | null>(null);

  // Blank Forgot Password Modal State (Verified by Date of Birth: 1 January 2012)
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotDob, setForgotDob] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotStatusMsg, setForgotStatusMsg] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const activePortalMeta =
    PORTAL_CARDS.find((p) => p.id === selectedPortal) || PORTAL_CARDS[0];

  const handleSelectPortalCard = (portalId: PortalLoginOption) => {
    setSelectedPortal(portalId);
    setLocalValidationMsg(null);
    setStep('login');
  };

  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalValidationMsg(null);
    const trimmedUser = usernameInput.trim();
    if (!trimmedUser) {
      setLocalValidationMsg('Please enter your Institute Username / ID.');
      return;
    }
    if (!/^[a-zA-Z0-9_\-]+$/.test(trimmedUser)) {
      setLocalValidationMsg('Username / ID must only contain letters, numbers, hyphens, or underscores.');
      return;
    }
    if (passwordInput.trim().length < 3) {
      setLocalValidationMsg('Please enter your Admin-assigned password.');
      return;
    }
    await onAuthenticateWithCredentials(trimmedUser, passwordInput.trim(), selectedPortal);
  };

  const openBlankForgotModal = () => {
    if (selectedPortal !== 'admin') return;
    setForgotUsername('');
    setForgotDob('');
    setForgotNewPassword('');
    setForgotStatusMsg(null);
    setForgotModalOpen(true);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPortal !== 'admin') return;
    setForgotStatusMsg(null);

    const cleanUser = forgotUsername.trim();
    const cleanDob = forgotDob.trim().toLowerCase();
    const cleanNewPass = forgotNewPassword.trim();

    if (!cleanUser || !cleanDob || !cleanNewPass) {
      setForgotStatusMsg({
        type: 'error',
        text: 'Please fill in Admin Username, Date of Birth, and New Password.',
      });
      return;
    }

    const normalizedDob = cleanDob.replace(/\s+/g, ' ');
    const isValidDob =
      normalizedDob === '1 january 2012' ||
      normalizedDob === '01 january 2012' ||
      normalizedDob === '1 jan 2012' ||
      normalizedDob === '01/01/2012' ||
      normalizedDob === '1/1/2012' ||
      normalizedDob === '01-01-2012' ||
      normalizedDob === '1-1-2012' ||
      normalizedDob === '2012-01-01' ||
      normalizedDob === '4 january 2024' ||
      normalizedDob === '04 january 2024' ||
      normalizedDob === '4 jan 2024' ||
      normalizedDob === '04/01/2024' ||
      normalizedDob === '4/1/2024' ||
      normalizedDob === '04-01-2024' ||
      normalizedDob === '4-1-2024' ||
      normalizedDob === '2024-01-04';

    if (!isValidDob) {
      setForgotStatusMsg({
        type: 'error',
        text: 'Invalid Date of Birth. Please enter your registered Admin Date of Birth.',
      });
      return;
    }

    if (cleanNewPass.length < 3) {
      setForgotStatusMsg({
        type: 'error',
        text: 'New password must be at least 3 characters.',
      });
      return;
    }

    setForgotSubmitting(true);
    try {
      if (onResetPasswordWithDob) {
        await onResetPasswordWithDob(cleanUser, cleanDob, cleanNewPass);
      }
      setForgotStatusMsg({
        type: 'success',
        text: `Password updated successfully for "${cleanUser}"! You can now log in.`,
      });
      setUsernameInput(cleanUser);
      setPasswordInput(cleanNewPass);
    } catch (err: unknown) {
      setForgotStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to reset password.',
      });
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#040D33] via-[#0A2170] to-[#0077B6] text-white flex flex-col items-center justify-center p-2 sm:p-4 relative overflow-hidden select-none">
      {/* FULL-SCREEN HTML5 Canvas + Waterfall + Swimming Fish Animation */}
      <WaterfallAnimation fullScreen={true} />

      {/* NATIVE ANDROID MOBILE APP SCREEN (No Top Web Switcher Bar) */}
      <main className="relative z-10 w-full flex items-center justify-center">
        <div className="w-full max-w-[420px] min-h-[770px] rounded-[48px] p-3 bg-gradient-to-b from-[#3B82F6] via-[#1D4ED8] to-[#061445] shadow-[0_30px_90px_rgba(0,0,0,0.75),0_0_40px_rgba(59,130,246,0.45)] border-[3px] border-cyan-200/70 flex flex-col">
          {/* Inner 3D Glossy Royal Blue Android Display */}
          <div className="w-full flex-1 min-h-[742px] rounded-[38px] overflow-hidden relative flex flex-col justify-between bg-gradient-to-b from-[#061556] via-[#0B2788] to-[#051040] border border-white/30 shadow-inner">
            {/* Internal Canvas & Waterfall Animation */}
            <div className="absolute inset-0 pointer-events-none opacity-65">
              <WaterfallAnimation height="h-full" />
            </div>

            {/* Ambient 3D Glow Orbs */}
            <div className="absolute top-16 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-blue-400/25 blur-3xl pointer-events-none" />
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-72 h-44 rounded-full bg-purple-500/25 blur-3xl pointer-events-none" />

            {/* Android Status Bar */}
            <div className="relative z-20 flex items-center justify-between px-6 pt-3 pb-2 text-xs font-bold text-white">
              <span>9:41</span>
              <div className="w-16 h-4 rounded-full bg-black/60 border border-white/15 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-cyan-400/80" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-extrabold text-cyan-200">5G</span>
                <Wifi className="w-3.5 h-3.5" />
                <BatteryCharging className="w-4 h-4 text-emerald-300" />
              </div>
            </div>

            {/* SCREEN 1: 3D SPLASH SCREEN */}
            {step === 'splash' && (
              <div className="relative z-10 flex-1 flex flex-col items-center justify-between p-6 text-center">
                <div className="mt-4 flex flex-col items-center">
                  <WaqarCrestLogo size="xl" showSubtitle={true} lightText={true} />
                </div>

                <div className="w-full flex flex-col items-center my-2">
                  <div className="relative w-64 h-28 flex items-center justify-center">
                    <div className="absolute -top-6 w-28 h-28 bg-cyan-300/30 rounded-full blur-2xl animate-pulse" />
                    <div className="absolute top-6 w-52 h-10 rounded-[100%] bg-gradient-to-r from-[#1E3A8A] via-[#60A5FA] to-[#1E3A8A] border-2 border-cyan-200 shadow-[0_0_25px_rgba(96,165,250,0.8)]" />
                    <div className="absolute top-12 w-64 h-12 rounded-[100%] bg-gradient-to-r from-[#0F172A] via-[#3B82F6] to-[#0F172A] border-2 border-purple-300/80 shadow-[0_12px_35px_rgba(147,51,234,0.75)]" />
                  </div>

                  <button
                    onClick={() => setStep('welcome')}
                    className="mt-4 flex flex-col items-center gap-2.5 cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-full border-4 border-cyan-300/30 border-t-cyan-300 animate-spin shadow-[0_0_15px_rgba(34,211,238,0.6)]" />
                    <span className="text-xs font-display font-bold text-cyan-100 tracking-wide group-hover:text-white">
                      Welcome to Waqar Computer Institute
                    </span>
                    <span className="text-[11px] text-cyan-300/90">Tap to Enter</span>
                  </button>
                </div>
              </div>
            )}

            {/* SCREEN 2: 3D WELCOME SCREEN WITH OFFICIAL WAQAR COMPUTER INSTITUTE LOGO */}
            {step === 'welcome' && (
              <div className="relative z-10 flex-1 flex flex-col items-center justify-between p-6 text-center">
                <div className="w-full flex flex-col items-center mt-1">
                  <div className="relative w-52 h-52 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/40 via-cyan-300/35 to-amber-400/35 blur-2xl animate-pulse" />
                    <div className="relative z-10 w-44 h-44 rounded-3xl bg-white p-3 shadow-[0_18px_38px_rgba(0,0,0,0.55)] border-2 border-cyan-200 flex items-center justify-center overflow-hidden">
                      <img
                        src="/waqar_logo.png"
                        alt="Waqar Computer Institute Official Logo"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  <div className="mt-2 px-2">
                    <p className="text-sm font-display font-bold text-cyan-200 tracking-wide">
                      Welcome to
                    </p>
                    <h1 className="font-display font-black text-2xl sm:text-3xl tracking-wider text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                      WAQAR COMPUTER INSTITUTE
                    </h1>
                    <p className="text-xs font-semibold text-amber-300 mt-1">
                      Welcome to Waqar Computer Institute
                    </p>
                    <p className="text-xs text-blue-100/90 font-medium mt-1">
                      Your Learning Journey Starts Here • Enjoy Your Journey
                    </p>

                    <div className="flex items-center justify-center gap-2 mt-4">
                      <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_#fff]" />
                      <span className="w-2 h-2 rounded-full bg-white/40" />
                      <span className="w-2 h-2 rounded-full bg-white/40" />
                    </div>
                  </div>
                </div>

                <div className="w-full space-y-3 mb-2">
                  <button
                    onClick={() => setStep('portal_select')}
                    className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#7C3AED] hover:from-[#1D4ED8] hover:to-[#6D28D9] text-white font-display font-extrabold text-sm shadow-[0_10px_25px_rgba(79,70,229,0.65),inset_0_2px_4px_rgba(255,255,255,0.45)] border border-cyan-200/60 flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setStep('portal_select')}
                    className="w-full py-3 px-6 rounded-full bg-[#091E6A]/80 hover:bg-[#0D2B94] text-white font-display font-bold text-sm border border-cyan-300/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.25)] transition-colors cursor-pointer"
                  >
                    Login
                  </button>
                </div>
              </div>
            )}

            {/* SCREEN 3: 4 PORTALS SELECTION SCREEN */}
            {step === 'portal_select' && (
              <div className="relative z-10 flex-1 flex flex-col justify-between p-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => setStep('welcome')}
                      className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center border border-white/25 cursor-pointer"
                      title="Back to Welcome"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] uppercase font-bold text-cyan-200 tracking-wider bg-white/10 border border-cyan-300/30 px-3 py-1 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>Admin Verified Cloud Security</span>
                    </span>
                  </div>

                  <div className="text-center my-2 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-white p-1.5 shadow-lg border border-cyan-200 mb-1.5 flex items-center justify-center">
                      <img
                        src="/waqar_logo.png"
                        alt="Waqar Computer Institute"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="text-xs font-display font-bold text-blue-200">Login to</p>
                    <h2 className="font-display font-black text-xl text-white tracking-wide drop-shadow">
                      WAQAR COMPUTER INSTITUTE
                    </h2>
                    <p className="text-xs text-cyan-200 font-medium mt-0.5">
                      Admin Verified Cloud Security
                    </p>
                  </div>

                  <div className="space-y-3.5 mt-4">
                    {PORTAL_CARDS.map((card) => {
                      const IconComponent = card.icon;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => handleSelectPortalCard(card.id)}
                          className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-[#DCEBFF] via-[#EAF2FF] to-[#CFE2FF] hover:from-white hover:to-[#E0EDFF] border-2 border-white/90 shadow-[0_10px_25px_rgba(0,0,0,0.35),inset_0_2px_4px_rgba(255,255,255,0.9)] flex items-center justify-between gap-3 transition-all hover:scale-[1.01] active:scale-98 cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-3.5">
                            <div
                              className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.gradient} text-white flex items-center justify-center shadow-[0_6px_14px_rgba(29,78,216,0.45)] border border-white/40`}
                            >
                              <IconComponent className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="font-display font-extrabold text-base text-[#061445]">
                                {card.title}
                              </div>
                              <div className="text-xs text-[#1E3A8A] font-semibold">
                                {card.subtitle}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-[#1D4ED8]" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="text-center text-[11px] text-cyan-200 font-semibold pt-2">
                  <span>Only admin provide ID and password can access profile portal.</span>
                </div>
              </div>
            )}

            {/* SCREEN 4: 3D CREDENTIALS LOGIN SCREEN */}
            {step === 'login' && (
              <div className="relative z-10 flex-1 flex flex-col justify-between p-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => setStep('portal_select')}
                      className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center border border-white/25 cursor-pointer"
                      title="Back to Portal Selection"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    {selectedPortal === 'admin' && (
                      <button
                        type="button"
                        onClick={openBlankForgotModal}
                        className="text-xs font-bold text-white bg-white/15 border border-white/25 px-3 py-1 rounded-full flex items-center gap-1 cursor-pointer"
                      >
                        <span>Forgot Password</span>
                        <HelpCircle className="w-3.5 h-3.5 text-cyan-300" />
                      </button>
                    )}
                  </div>

                  <div className="text-center my-1">
                    <WaqarCrestLogo size="sm" showSubtitle={false} lightText={true} />
                  </div>

                  <div className="mt-2 rounded-[28px] bg-gradient-to-b from-[#EEF4FF]/95 via-[#E2ECFF]/95 to-[#D8E5FF]/95 p-5 text-[#061445] shadow-[0_18px_40px_rgba(0,0,0,0.45),inset_0_2px_4px_rgba(255,255,255,0.95)] border-2 border-white">
                    <div className="text-center mb-3">
                      <h2 className="font-display font-extrabold text-xl text-[#061445]">
                        {activePortalMeta.title}
                      </h2>
                      <p className="text-xs text-[#1E3A8A] font-semibold">
                        Admin Verified Cloud Security
                      </p>
                    </div>

                    {/* Quick Portal Switcher */}
                    <div className="grid grid-cols-4 gap-1 bg-[#CFE0FF] p-1 rounded-xl border border-blue-200 mb-3">
                      {PORTAL_CARDS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPortal(p.id);
                            if (p.id !== 'admin') setForgotModalOpen(false);
                          }}
                          className={`py-1 rounded-lg text-[10px] font-bold capitalize transition-colors cursor-pointer ${
                            selectedPortal === p.id
                              ? 'bg-gradient-to-r from-[#1D4ED8] to-[#4F46E5] text-white shadow'
                              : 'text-[#061445] hover:bg-white/60'
                          }`}
                        >
                          {p.id}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleCredentialSubmit} className="space-y-3">
                      <div className="relative">
                        <User className="w-4 h-4 text-[#1D4ED8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={usernameInput}
                          onChange={(e) => setUsernameInput(e.target.value)}
                          placeholder={activePortalMeta.placeholder}
                          maxLength={64}
                          required
                          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-blue-200 text-sm text-[#061445] placeholder-slate-400 shadow-inner focus:outline-none focus:border-[#1D4ED8]"
                        />
                      </div>

                      <div className="relative">
                        <Lock className="w-4 h-4 text-[#1D4ED8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="Enter your password"
                          required
                          className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white border border-blue-200 text-sm text-[#061445] placeholder-slate-400 shadow-inner focus:outline-none focus:border-[#1D4ED8]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#1D4ED8] cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs px-1">
                        <label className="flex items-center gap-1.5 text-[#061445] font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="rounded border-blue-300 text-[#1D4ED8] focus:ring-[#1D4ED8]"
                          />
                          <span>Remember Me</span>
                        </label>
                        {selectedPortal === 'admin' ? (
                          <button
                            type="button"
                            onClick={openBlankForgotModal}
                            className="text-[#1D4ED8] font-bold hover:underline cursor-pointer"
                          >
                            Forgot Password?
                          </button>
                        ) : (
                          <span className="text-slate-500 font-semibold">Enter your password</span>
                        )}
                      </div>

                      {(localValidationMsg || authError) && (
                        <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{localValidationMsg || authError}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#7C3AED] hover:from-[#1D4ED8] hover:to-[#6D28D9] text-white font-display font-extrabold text-sm shadow-[0_8px_20px_rgba(79,70,229,0.5),inset_0_2px_3px_rgba(255,255,255,0.4)] transition-transform active:scale-98 disabled:opacity-50 cursor-pointer"
                      >
                        {authLoading ? 'Verifying in Firebase Cloud...' : 'Login'}
                      </button>
                    </form>
                  </div>
                </div>

                <div className="text-center text-[11px] text-cyan-200 font-semibold pt-2">
                  <span>Only admin provide ID and password can access profile portal CAB</span>
                </div>
              </div>
            )}

            {/* Android Bottom System Navigation Bar */}
            <div className="relative z-20 flex items-center justify-around py-2.5 px-12 bg-black/30 backdrop-blur-md border-t border-white/15">
              <button
                type="button"
                onClick={() => {
                  if (step === 'login') setStep('portal_select');
                  else if (step === 'portal_select') setStep('welcome');
                  else if (step === 'welcome') setStep('splash');
                }}
                className="text-cyan-200 hover:text-white font-bold text-sm cursor-pointer px-3 py-0.5"
                title="Android Back"
              >
                ◁
              </button>
              <button
                type="button"
                onClick={() => setStep('welcome')}
                className="text-cyan-200 hover:text-white font-bold text-sm cursor-pointer px-3 py-0.5"
                title="Android Home"
              >
                ○
              </button>
              <button
                type="button"
                onClick={() => setStep('portal_select')}
                className="text-cyan-200 hover:text-white font-bold text-sm cursor-pointer px-3 py-0.5"
                title="Android App Switcher"
              >
                □
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Admin-Only Forgot Password Modal (Reset via Date of Birth — no date hint shown) */}
      {forgotModalOpen && selectedPortal === 'admin' && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-[#061445] shadow-2xl border-2 border-blue-200">
            <h3 className="font-display font-extrabold text-lg text-[#061445]">
              Admin Forgot Password
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Enter your Admin Username and Date of Birth to reset your password.
            </p>

            <form onSubmit={handleForgotPasswordSubmit} className="mt-4 space-y-3">
              <div className="relative">
                <User className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={forgotUsername}
                  onChange={(e) => setForgotUsername(e.target.value)}
                  placeholder="Enter Admin Username"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-[#061445] focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="relative">
                <Calendar className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={forgotDob}
                  onChange={(e) => setForgotDob(e.target.value)}
                  placeholder="Enter Date of Birth"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-[#061445] focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="relative">
                <Lock className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  placeholder="Enter New Password"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-[#061445] focus:outline-none focus:border-blue-600"
                />
              </div>

              {forgotStatusMsg && (
                <div
                  className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                    forgotStatusMsg.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {forgotStatusMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{forgotStatusMsg.text}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#061445] font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-[#1D4ED8] to-[#4F46E5] text-white font-bold text-xs cursor-pointer"
                >
                  {forgotSubmitting ? 'Updating...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
