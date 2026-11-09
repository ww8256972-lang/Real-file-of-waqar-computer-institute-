import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type PortalRole = 'admin' | 'student' | 'teacher' | 'parent';

interface Waqar3DLoginPortalProps {
  onAuthenticateWithCredentials: (
    username: string,
    password: string,
    selectedPortal?: PortalRole
  ) => Promise<void>;
  onSendPasswordResetEmail?: (usernameOrEmail: string) => Promise<string>;
  authLoading: boolean;
  authError: string | null;
}

interface RoleConfig {
  role: PortalRole;
  name: string;
  a: string;
  b: string;
  tag: string;
  title: string;
  titleHighlight: string;
  subtitle: string;
  userLabel: string;
  placeholder: string;
  iconPath: string;
}

const ROLES: RoleConfig[] = [
  {
    role: 'admin',
    name: 'Admin',
    a: '#a970ff',
    b: '#ff4ecd',
    tag: 'CONTROL CENTER',
    title: 'Admin ',
    titleHighlight: 'Portal',
    subtitle: 'Institute management: branches, courses, faculty, students & finances.',
    userLabel: 'Admin ID or Username',
    placeholder: 'Enter Admin Username',
    iconPath: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  },
  {
    role: 'student',
    name: 'Student',
    a: '#00e1ff',
    b: '#4d7cff',
    tag: 'LEARNING HUB',
    title: 'Student ',
    titleHighlight: 'Portal',
    subtitle: 'Courses, assignments, live exams, attendance & verified certificates.',
    userLabel: 'Student Roll No / ID',
    placeholder: 'Enter Student Roll No / ID',
    iconPath: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
  },
  {
    role: 'teacher',
    name: 'Teacher',
    a: '#2dff9b',
    b: '#d6ff3d',
    tag: 'FACULTY DESK',
    title: 'Teacher ',
    titleHighlight: 'Portal',
    subtitle: 'Classroom attendance, grading, batches, and student evaluations.',
    userLabel: 'Faculty ID or Email',
    placeholder: 'Enter Faculty ID / Email',
    iconPath: '<path d="M3 4h18v11H3z"/><path d="M12 15v5M8 20h8"/>',
  },
  {
    role: 'parent',
    name: 'Parent',
    a: '#ffb02e',
    b: '#ff4d6d',
    tag: 'GUARDIAN ACCESS',
    title: 'Parent ',
    titleHighlight: 'Portal',
    subtitle: 'Track student attendance, monthly tests, fee dues & report cards.',
    userLabel: 'Registered Mobile / ID',
    placeholder: 'Enter Registered Mobile / ID',
    iconPath:
      '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 15c2.5 0 4 1.7 4 4"/>',
  },
];

export const Waqar3DLoginPortal: React.FC<Waqar3DLoginPortalProps> = ({
  onAuthenticateWithCredentials,
  onSendPasswordResetEmail,
  authLoading,
  authError,
}) => {
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const currentRole = ROLES[currentIdx];

  // INPUTS ALWAYS START EMPTY (NO DEMO PREFILL)
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  const [localMsg, setLocalMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotUser, setForgotUser] = useState<string>('');
  const [forgotMsg, setForgotMsg] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cardRef = useRef<HTMLFormElement | null>(null);
  const pulseTriggerRef = useRef<((s: number) => void) | null>(null);
  const targetColorsRef = useRef<{ a: THREE.Color; b: THREE.Color }>({
    a: new THREE.Color(ROLES[0].a),
    b: new THREE.Color(ROLES[0].b),
  });

  const handleSelectRole = (idx: number) => {
    setCurrentIdx(idx);
    const r = ROLES[idx];
    setUsername('');
    setPassword('');
    setLocalMsg(null);

    targetColorsRef.current.a.set(r.a);
    targetColorsRef.current.b.set(r.b);

    if (pulseTriggerRef.current) {
      pulseTriggerRef.current(1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalMsg(null);

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser || !trimmedPass) {
      setLocalMsg({ text: 'Please enter your ID/Username and Password.', isError: true });
      triggerCardShake();
      return;
    }

    try {
      if (pulseTriggerRef.current) {
        pulseTriggerRef.current(1.8);
      }
      await onAuthenticateWithCredentials(trimmedUser, trimmedPass, currentRole.role);
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : 'Invalid credentials. Access Denied.';
      setLocalMsg({ text: errorText, isError: true });
      triggerCardShake();
    }
  };

  const triggerCardShake = () => {
    if (!cardRef.current) return;
    cardRef.current.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-9px)' },
        { transform: 'translateX(9px)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 420 }
    );
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSendPasswordResetEmail) return;
    try {
      const msg = await onSendPasswordResetEmail(forgotUser);
      setForgotMsg(msg);
      setTimeout(() => setShowForgotModal(false), 2400);
    } catch (err: unknown) {
      setForgotMsg(err instanceof Error ? err.message : 'Password reset request failed.');
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;
    let renderer: THREE.WebGLRenderer;
    let scene: THREE.Scene;
    let cam: THREE.PerspectiveCamera;
    const clock = new THREE.Clock();
    let mx = 0,
      my = 0,
      mxs = 0,
      mys = 0;
    let pulseT = -1,
      boost = 0,
      mouseP = 0;

    const mob = window.innerWidth < 700;
    const N = mob ? 90 : 150;
    const SP = mob ? 1.15 : 0.78;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      scene = new THREE.Scene();
      cam = new THREE.PerspectiveCamera(60, 1, 0.1, 400);

      const pos = new Float32Array(N * N * 3);
      const sz = new Float32Array(N * N);
      let k = 0;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          pos[k * 3] = (i - N / 2) * SP;
          pos[k * 3 + 1] = 0;
          pos[k * 3 + 2] = (j - N * 0.72) * SP;
          sz[k] = 0.6 + Math.random() * 0.9;
          k++;
        }
      }

      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aS', new THREE.BufferAttribute(sz, 1));

      const U = {
        uTime: { value: 0 },
        uAmp: { value: 1 },
        uRing: { value: 0 },
        uRingA: { value: 0 },
        uSize: { value: renderer.getPixelRatio() },
        uMouse: { value: new THREE.Vector2(0, 99) },
        uMouseP: { value: 0 },
        uC: { value: new THREE.Color(ROLES[0].a) },
        uC2: { value: new THREE.Color(ROLES[0].b) },
      };

      const m = new THREE.ShaderMaterial({
        uniforms: U,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          uniform float uTime, uAmp, uRing, uRingA, uSize, uMouseP;
          uniform vec2 uMouse;
          attribute float aS;
          varying float vH, vF;
          void main() {
            vec3 p = position;
            float w = sin(p.x * 0.22 + uTime * 0.8) * 1.4 + cos(p.z * 0.18 + uTime * 0.6) * 1.6 + sin((p.x + p.z) * 0.12 + uTime * 1.1) * 1.1;
            float d = distance(p.xz, uMouse);
            w += exp(-d * d * 0.012) * uMouseP * sin(d * 0.9 - uTime * 5.0) * 2.4;
            float r = length(p.xz - vec2(0.0, -8.0));
            w += exp(-pow(r - uRing, 2.0) * 0.025) * uRingA * 7.0;
            p.y = w * uAmp;
            vH = w;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = uSize * aS * (1.0 + clamp(w * 0.16, 0.0, 1.4)) * (34.0 / -mv.z);
            vF = 1.0 - smoothstep(45.0, 115.0, -mv.z);
          }
        `,
        fragmentShader: `
          uniform vec3 uC, uC2;
          varying float vH, vF;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c);
            if (d > 0.5) discard;
            float a = pow(1.0 - d * 2.0, 1.5);
            vec3 col = mix(uC, uC2, clamp(vH * 0.16 + 0.5, 0.0, 1.0));
            gl_FragColor = vec4(col * (1.0 + max(vH, 0.0) * 0.2), a * vF);
          }
        `,
      });

      scene.add(new THREE.Points(g, m));

      const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const rc = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const hit = new THREE.Vector3();

      pulseTriggerRef.current = (s = 1) => {
        pulseT = 0;
        boost = 0.7 * s;
      };

      const fit = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h, false);
        cam.aspect = w / h;
        const p = h > w;
        cam.fov = p ? 68 : 56;
        cam.position.set(0, p ? 16 : 13, p ? 28 : 24);
        cam.updateProjectionMatrix();
        U.uSize.value = renderer.getPixelRatio() * (w < 600 ? 1.15 : 1);
      };
      fit();
      window.addEventListener('resize', fit);

      const handlePointerMove = (e: PointerEvent) => {
        mx = (e.clientX / window.innerWidth) * 2 - 1;
        my = -(e.clientY / window.innerHeight) * 2 + 1;
        ndc.set(mx, my);
        rc.setFromCamera(ndc, cam);
        if (rc.ray.intersectPlane(pl, hit)) {
          U.uMouse.value.set(hit.x, hit.z);
        }
        mouseP = 1;
      };
      window.addEventListener('pointermove', handlePointerMove, { passive: true });

      const loop = () => {
        animationFrameId = requestAnimationFrame(loop);
        const dt = Math.min(clock.getDelta(), 0.05);
        U.uTime.value += dt * (1 + boost * 1.4);
        boost = Math.max(0, boost - dt * 1.1);
        mouseP = Math.max(0, mouseP - dt * 0.5);
        U.uMouseP.value += (mouseP - U.uMouseP.value) * 0.1;
        U.uAmp.value = 1 + boost * 0.8;

        if (pulseT >= 0) {
          pulseT += dt * 42;
          U.uRing.value = pulseT;
          U.uRingA.value = Math.max(0, 1 - pulseT / 75);
          if (pulseT > 75) pulseT = -1;
        }

        U.uC.value.lerp(targetColorsRef.current.a, 0.06);
        U.uC2.value.lerp(targetColorsRef.current.b, 0.06);

        mxs += (mx - mxs) * 0.05;
        mys += (my - mys) * 0.05;
        cam.position.x = mxs * 3.5;
        cam.position.y = (window.innerHeight > window.innerWidth ? 16 : 13) + mys * 1.6;
        cam.lookAt(0, -2, -14);

        renderer.render(scene, cam);
      };
      loop();

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', fit);
        window.removeEventListener('pointermove', handlePointerMove);
        g.dispose();
        m.dispose();
        renderer.dispose();
      };
    } catch {
      return;
    }
  }, []);

  const handleCardPointerMove = (e: React.MouseEvent<HTMLFormElement>) => {
    const nativeEvt = e.nativeEvent as unknown as { pointerType?: string };
    if (nativeEvt.pointerType === 'touch' || !cardRef.current) return;
    const b = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width - 0.5;
    const y = (e.clientY - b.top) / b.height - 0.5;
    cardRef.current.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
    cardRef.current.style.setProperty('--mx', `${(x + 0.5) * 100}%`);
    cardRef.current.style.setProperty('--my', `${(y + 0.5) * 100}%`);
  };

  const handleCardPointerLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = '';
  };

  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden flex flex-col justify-between bg-[#05060f] text-[#f3f6ff] select-none"
      style={
        {
          '--a': currentRole.a,
          '--b': currentRole.b,
        } as React.CSSProperties
      }
    >
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full z-0 pointer-events-none" />

      <div
        className="fixed inset-0 z-10 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 12%, rgba(80,120,255,.12), transparent 55%), radial-gradient(circle at 50% 100%, rgba(5,6,15,.92) 10%, rgba(5,6,15,.25) 65%, rgba(5,6,15,.85) 100%)',
        }}
      />

      {/* Top Header Branding — Waqar Computer Institute */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-7 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-lg border border-white/25"
            style={{
              boxShadow: `0 0 24px -4px ${currentRole.a}`,
            }}
          >
            <img
              src="/waqar_logo.png"
              alt="Waqar Computer Institute Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold tracking-tight leading-tight text-white">
              Waqar Computer Institute
            </h2>
            <small className="block text-[10px] text-[#8d97c2] tracking-[1.6px] uppercase font-semibold">
              INSTITUTE ERP PORTAL
            </small>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#8d97c2] px-3 py-1.5 rounded-full bg-white/5 border border-white/15 backdrop-blur-md">
          <span
            className="w-2 h-2 rounded-full bg-[#2dff9b] animate-pulse"
            style={{ boxShadow: '0 0 10px #2dff9b' }}
          />
          <span>Cloud Live</span>
        </div>
      </header>

      {/* Main Centered Glassmorphic Card */}
      <main className="relative z-20 flex-1 flex items-center justify-center px-4 py-3">
        <div className="w-full max-w-[460px]">
          <form
            ref={cardRef}
            onSubmit={handleSubmit}
            onMouseMove={handleCardPointerMove}
            onMouseLeave={handleCardPointerLeave}
            autoComplete="off"
            className="relative rounded-[26px] p-5 sm:p-7 backdrop-blur-2xl border border-white/15 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)] transition-transform duration-150 overflow-hidden"
            style={{
              background: 'rgba(12, 15, 32, 0.66)',
            }}
          >
            {/* Top Role Switcher Pills (Admin, Student, Teacher, Parent) */}
            <div
              role="tablist"
              aria-label="Select Role"
              className="grid grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-black/45 border border-white/15 mb-5"
            >
              {ROLES.map((r, i) => {
                const isActive = i === currentIdx;
                return (
                  <button
                    key={r.role}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleSelectRole(i)}
                    className={`relative flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl text-[11px] font-bold tracking-wide transition-all cursor-pointer ${
                      isActive ? 'text-white -translate-y-0.5' : 'text-[#8d97c2] hover:text-white'
                    }`}
                    style={
                      isActive
                        ? {
                            background: `linear-gradient(135deg, ${r.a}35, ${r.b}25)`,
                            boxShadow: `0 8px 22px -6px ${r.a}`,
                            border: `1px solid ${r.a}80`,
                          }
                        : { border: '1px solid transparent' }
                    }
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-[18px] h-[18px] stroke-current fill-none stroke-[1.9]"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={
                        isActive ? { color: r.a, filter: `drop-shadow(0 0 6px ${r.a})` } : undefined
                      }
                      dangerouslySetInnerHTML={{ __html: r.iconPath }}
                    />
                    <span>{r.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Role Header & Badge */}
            <div className="text-center mb-5">
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1.6px] px-3 py-1 rounded-full border mb-2"
                style={{
                  color: currentRole.a,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderColor: 'rgba(255,255,255,0.14)',
                }}
              >
                ● {currentRole.tag}
              </span>
              <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight leading-tight text-white">
                {currentRole.title}
                <span
                  style={{
                    background: `linear-gradient(135deg, #fff 20%, ${currentRole.a} 65%, ${currentRole.b})`,
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  {currentRole.titleHighlight}
                </span>
              </h1>
              <p className="text-xs text-[#8d97c2] mt-1 leading-relaxed">{currentRole.subtitle}</p>
            </div>

            {/* Username / ID Input */}
            <div className="mb-3.5">
              <div className="flex justify-between text-xs font-semibold text-[#cbd3f5] mb-1.5">
                <label htmlFor="waqar-uid">{currentRole.userLabel}</label>
              </div>
              <div className="relative flex items-center">
                <svg
                  className="absolute left-3.5 w-[18px] h-[18px] text-[#8d97c2] pointer-events-none stroke-current fill-none stroke-[1.9]"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c1.8-4 14.2-4 16 0" />
                </svg>
                <input
                  id="waqar-uid"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={currentRole.placeholder}
                  autoComplete="off"
                  required
                  className="w-full h-12 pl-11 pr-4 rounded-[14px] border border-white/15 bg-[#060816]/75 text-white text-sm outline-none transition-all placeholder:text-[#7882af]/60 focus:bg-[#080b1e]/95"
                  style={{
                    borderColor: username ? currentRole.a : 'rgba(255,255,255,0.14)',
                  }}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="mb-3.5">
              <div className="flex justify-between text-xs font-semibold text-[#cbd3f5] mb-1.5">
                <label htmlFor="waqar-pwd">Password / Security PIN</label>
              </div>
              <div className="relative flex items-center">
                <svg
                  className="absolute left-3.5 w-[18px] h-[18px] text-[#8d97c2] pointer-events-none stroke-current fill-none stroke-[1.9]"
                  viewBox="0 0 24 24"
                >
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                <input
                  id="waqar-pwd"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="off"
                  required
                  className="w-full h-12 pl-11 pr-11 rounded-[14px] border border-white/15 bg-[#060816]/75 text-white text-sm outline-none transition-all placeholder:text-[#7882af]/60 focus:bg-[#080b1e]/95"
                  style={{
                    borderColor: password ? currentRole.a : 'rgba(255,255,255,0.14)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                  className="absolute right-2.5 w-8 h-8 rounded-lg flex items-center justify-center text-[#8d97c2] hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-[18px] h-[18px] stroke-current fill-none stroke-[1.9]"
                  >
                    {showPassword ? (
                      <>
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-4 5.2" />
                        <path d="M6.2 6.2C3.6 8 2 12 2 12a18 18 0 0 0 9.8 7c1.6 0 3.1-.4 4.4-1" />
                      </>
                    ) : (
                      <>
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* Remember & Forgot Password Row */}
            <div className="flex items-center justify-between text-xs text-[#8d97c2] my-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: currentRole.a }}
                />
                <span>Keep me signed in</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotMsg('');
                  setShowForgotModal(true);
                }}
                className="font-semibold hover:underline cursor-pointer"
                style={{ color: currentRole.a }}
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full h-[50px] rounded-[14px] font-bold text-[15px] tracking-wide text-[#060812] cursor-pointer relative overflow-hidden transition-all active:scale-[0.99] disabled:opacity-60"
              style={{
                background: `linear-gradient(135deg, ${currentRole.a}, ${currentRole.b})`,
                boxShadow: `0 12px 30px -8px ${currentRole.a}`,
              }}
            >
              {authLoading ? 'Verifying Credentials...' : `Login as ${currentRole.name} →`}
            </button>

            {/* Error or Status Message */}
            {localMsg || authError ? (
              <div
                className="min-h-[20px] mt-2.5 text-center text-xs font-semibold"
                style={{
                  color: '#ff6b8b',
                }}
              >
                {localMsg ? localMsg.text : authError}
              </div>
            ) : null}

            {/* Security Chips */}
            <div className="flex justify-center gap-3.5 mt-3 text-[11px] text-[#8d97c2] tracking-wider font-semibold">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: currentRole.a, boxShadow: `0 0 8px ${currentRole.a}` }}
                />
                AES-256 SQLCipher
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: currentRole.a, boxShadow: `0 0 8px ${currentRole.a}` }}
                />
                Zero-Trust
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: currentRole.a, boxShadow: `0 0 8px ${currentRole.a}` }}
                />
                Play Integrity
              </span>
            </div>
          </form>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="relative z-20 pb-4 text-center text-[11px] text-[#64748b]">
        WAQAR COMPUTER INSTITUTE • SECURE CLOUD GATEWAY
      </footer>

      {/* Forgot Password Reset Modal via Firebase Auth */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#0e122a] border border-white/15 text-white shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>
            <h3 className="text-xl font-bold mb-1">Reset Password</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter your registered Username or Institute Email to receive a Firebase Authentication password reset link.
            </p>

            <form onSubmit={handleResetSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Username / Email</label>
                <input
                  type="text"
                  required
                  placeholder="Enter your registered ID or email"
                  value={forgotUser}
                  onChange={(e) => setForgotUser(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-black/40 border border-white/20 text-white text-sm outline-none focus:border-indigo-400"
                />
              </div>

              {forgotMsg && (
                <div className="text-xs text-amber-300 text-center font-medium py-1">{forgotMsg}</div>
              )}

              <button
                type="submit"
                className="w-full h-12 mt-2 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-500 to-pink-500 text-white cursor-pointer shadow-lg hover:opacity-90 transition-opacity"
              >
                Send Password Reset Email
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
