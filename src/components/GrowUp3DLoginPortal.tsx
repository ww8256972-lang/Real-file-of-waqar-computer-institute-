import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type PortalRole = 'admin' | 'student' | 'teacher' | 'parent';

interface GrowUp3DLoginPortalProps {
  onAuthenticateWithCredentials: (
    username: string,
    password: string,
    selectedPortal?: PortalRole
  ) => Promise<void>;
  onResetPasswordWithDob?: (
    username: string,
    dobInput: string,
    newPassword: string
  ) => Promise<void>;
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
  defaultUser: string;
  defaultPass: string;
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
    subtitle: 'Poora institute manage karo: students, staff, fees aur reports.',
    userLabel: 'Admin ID or Email',
    defaultUser: 'waqar',
    defaultPass: 'waqar',
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
    subtitle: 'Courses, notes, results aur certificates ek jagah.',
    userLabel: 'Student ID or Roll No.',
    defaultUser: 'WI2026001',
    defaultPass: 'student123',
    iconPath: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
  },
  {
    role: 'teacher',
    name: 'Teacher',
    a: '#2dff9b',
    b: '#d6ff3d',
    tag: 'CLASSROOM',
    title: 'Teacher ',
    titleHighlight: 'Portal',
    subtitle: 'Attendance, marks aur batches ko asaani se sambhalo.',
    userLabel: 'Teacher ID or Email',
    defaultUser: 'WI-TCH-120',
    defaultPass: 'teacher123',
    iconPath: '<path d="M3 4h18v11H3z"/><path d="M12 15v5M8 20h8"/>',
  },
  {
    role: 'parent',
    name: 'Parent',
    a: '#ffb02e',
    b: '#ff4d6d',
    tag: 'FAMILY VIEW',
    title: 'Parent ',
    titleHighlight: 'Portal',
    subtitle: 'Bachche ki progress, attendance aur fees track karo.',
    userLabel: 'Mobile No. or Parent ID',
    defaultUser: 'WI2026001',
    defaultPass: 'parent123',
    iconPath: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 15c2.5 0 4 1.7 4 4"/>',
  },
];

export const GrowUp3DLoginPortal: React.FC<GrowUp3DLoginPortalProps> = ({
  onAuthenticateWithCredentials,
  onResetPasswordWithDob,
  authLoading,
  authError,
}) => {
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const currentRole = ROLES[currentIdx];

  const [username, setUsername] = useState<string>(currentRole.defaultUser);
  const [password, setPassword] = useState<string>(currentRole.defaultPass);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  const [localMsg, setLocalMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotUser, setForgotUser] = useState<string>('');
  const [forgotDob, setForgotDob] = useState<string>('');
  const [forgotNewPass, setForgotNewPass] = useState<string>('');
  const [forgotMsg, setForgotMsg] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cardRef = useRef<HTMLFormElement | null>(null);
  const pulseTriggerRef = useRef<((s: number) => void) | null>(null);
  const targetColorsRef = useRef<{ a: THREE.Color; b: THREE.Color }>({
    a: new THREE.Color(ROLES[0].a),
    b: new THREE.Color(ROLES[0].b),
  });

  // Switch Role
  const handleSelectRole = (idx: number) => {
    setCurrentIdx(idx);
    const r = ROLES[idx];
    setUsername(r.defaultUser);
    setPassword(r.defaultPass);
    setLocalMsg(null);

    targetColorsRef.current.a.set(r.a);
    targetColorsRef.current.b.set(r.b);

    if (pulseTriggerRef.current) {
      pulseTriggerRef.current(1);
    }
  };

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalMsg(null);

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser || !trimmedPass) {
      setLocalMsg({ text: 'ID aur Password dono bharein.', isError: true });
      triggerCardShake();
      return;
    }

    try {
      if (pulseTriggerRef.current) {
        pulseTriggerRef.current(1.8);
      }
      await onAuthenticateWithCredentials(trimmedUser, trimmedPass, currentRole.role);
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : 'Invalid credentials';
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

  // Handle Forgot Password
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onResetPasswordWithDob) return;
    try {
      await onResetPasswordWithDob(forgotUser, forgotDob, forgotNewPass);
      setForgotMsg('Password successfully reset! Login with your new password.');
      setTimeout(() => setShowForgotModal(false), 2000);
    } catch (err: unknown) {
      setForgotMsg(err instanceof Error ? err.message : 'Reset failed. Verify details.');
    }
  };

  // Three.js Particle Wave Setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;
    let renderer: THREE.WebGLRenderer;
    let scene: THREE.Scene;
    let cam: THREE.PerspectiveCamera;
    let clock = new THREE.Clock();
    let mx = 0, my = 0, mxs = 0, mys = 0;
    let pulseT = -1, boost = 0, mouseP = 0;

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
      const v2 = new THREE.Vector2();
      const hit = new THREE.Vector3();

      const handleResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h, false);
        cam.aspect = w / h;
        cam.position.z = w / h < 0.8 ? 30 : 24;
        cam.updateProjectionMatrix();
      };
      handleResize();
      window.addEventListener('resize', handleResize);

      const handlePointerMove = (e: PointerEvent) => {
        mx = (e.clientX / window.innerWidth) * 2 - 1;
        my = (e.clientY / window.innerHeight) * 2 - 1;
        v2.set(mx, -my);
        rc.setFromCamera(v2, cam);
        if (rc.ray.intersectPlane(pl, hit)) {
          U.uMouse.value.set(hit.x, hit.z);
          mouseP = 1;
        }
      };
      window.addEventListener('pointermove', handlePointerMove);

      pulseTriggerRef.current = (s: number) => {
        pulseT = 0;
        boost = Math.max(boost, s > 1 ? 1.6 : 0);
      };

      const calm = window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 0.25 : 1;

      const loop = () => {
        animationFrameId = requestAnimationFrame(loop);
        const dt = Math.min(clock.getDelta(), 0.05);
        U.uTime.value += dt * calm;

        mxs += (mx - mxs) * 0.04;
        mys += (my - mys) * 0.04;
        cam.position.x = mxs * 5;
        cam.position.y = 11 + mys * -2.5;
        cam.lookAt(0, 1, -14);

        U.uC.value.lerp(targetColorsRef.current.a, 0.06);
        U.uC2.value.lerp(targetColorsRef.current.b, 0.06);

        mouseP += (0 - mouseP) * 0.012;
        U.uMouseP.value = mouseP;

        if (pulseT >= 0) {
          pulseT += dt / 1.5;
          U.uRing.value = pulseT * 95;
          U.uRingA.value = Math.max(0, 1 - pulseT) * (1 + boost);
          if (pulseT > 1) {
            pulseT = -1;
            U.uRingA.value = 0;
          }
        }
        U.uAmp.value += (1 + boost * 0.6 - U.uAmp.value) * 0.06;
        boost *= 0.985;

        renderer.render(scene, cam);
      };
      loop();

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('pointermove', handlePointerMove);
        renderer.dispose();
      };
    } catch {
      // Fallback takes over
    }
  }, []);

  // 3D Card Tilt
  const handleCardMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const nativeEvt = e.nativeEvent as unknown as { pointerType?: string };
    if (nativeEvt.pointerType === 'touch') return;
    const b = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width - 0.5;
    const y = (e.clientY - b.top) / b.height - 0.5;
    cardRef.current.style.transform = `rotateY(${x * 7}deg) rotateX(${-y * 7}deg)`;
  };

  const handleCardMouseLeave = () => {
    if (cardRef.current) {
      cardRef.current.style.transform = '';
    }
  };

  return (
    <div
      className="grow-up-portal-container relative min-h-screen w-full bg-[#05060f] text-[#eef1ff] overflow-x-hidden font-sans select-none"
      style={
        {
          '--a': currentRole.a,
          '--b': currentRole.b,
          '--text': '#eef1ff',
          '--muted': '#8d97c2',
          '--line': 'rgba(255,255,255,.12)',
          '--glass': 'rgba(14,18,42,.46)',
        } as React.CSSProperties
      }
    >
      <style>{`
        @property --ang { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
        @keyframes spinConic { to { --ang: 360deg; } }
        @keyframes shimmerBtn { to { transform: translateX(120%); } }
        @keyframes rotateSpinner { to { transform: rotate(360deg); } }
        @keyframes fadeInCard {
          from { opacity: 0; transform: translateY(40px) rotateX(18deg) scale(.96); }
          to { opacity: 1; transform: translateY(0) rotateX(0deg) scale(1); }
        }

        .portal-card-element {
          animation: fadeInCard 1s cubic-bezier(.2,.9,.2,1) both;
        }

        .portal-card-element::before {
          content: "";
          position: absolute;
          inset: -1.5px;
          border-radius: 29px;
          padding: 1.5px;
          background: conic-gradient(from var(--ang), transparent 0 60%, var(--a), var(--b), transparent);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: spinConic 5s linear infinite;
          pointer-events: none;
        }

        .go-button-shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.55) 50%, transparent 70%);
          transform: translateX(-120%);
          animation: shimmerBtn 3.2s infinite;
        }

        .spinner-icon {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2.5px solid #05060f;
          border-top-color: transparent;
          border-radius: 50%;
          animation: rotateSpinner .7s linear infinite;
          vertical-align: -3px;
          margin-right: 8px;
        }
      `}</style>

      {/* Radial Gradient Fallback */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `radial-gradient(700px 500px at 50% 80%, color-mix(in srgb, ${currentRole.a} 35%, transparent), transparent), #05060f`,
        }}
      />

      {/* Three.js Canvas */}
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full block z-0" />

      {/* Vignette Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 35%, rgba(5,6,15,.85))',
        }}
      />

      {/* Top Header Logo */}
      <div className="fixed top-5 left-5 md:top-7 md:left-8 flex items-center gap-2.5 font-extrabold tracking-wide z-20">
        <div
          className="w-9 h-9 rounded-xl grid place-items-center font-bold text-lg text-[#05060f] transition-all duration-700"
          style={{
            background: `linear-gradient(135deg, ${currentRole.a}, ${currentRole.b})`,
            boxShadow: `0 0 22px ${currentRole.a}`,
          }}
        >
          G
        </div>
        <div>
          <div className="text-white text-sm md:text-base font-extrabold tracking-tight">GROW UP</div>
          <small className="block text-[10px] font-semibold tracking-widest text-[#8d97c2]">
            COMPUTER SKILL
          </small>
        </div>
      </div>

      {/* Centered Main Card Container */}
      <main className="relative z-10 min-h-screen grid place-items-center px-3.5 py-20">
        <div
          className="w-full max-w-[420px]"
          style={{ perspective: '1100px' }}
          onMouseMove={handleCardMouseMove}
          onMouseLeave={handleCardMouseLeave}
        >
          <form
            ref={cardRef}
            onSubmit={handleSubmit}
            autoComplete="off"
            className="portal-card-element relative p-5 md:p-6 rounded-[28px] border border-white/10 backdrop-blur-[22px] transition-transform duration-200 ease-out"
            style={{
              background: 'rgba(14,18,42,.55)',
              boxShadow: `0 0 0 1px rgba(255,255,255,.04) inset, 0 40px 80px -30px #000, 0 0 90px -30px ${currentRole.a}`,
            }}
          >
            {/* 4-Role Switcher Tabs */}
            <div className="relative grid grid-cols-4 p-1 rounded-[18px] bg-black/40 border border-white/10" role="tablist">
              <div
                className="absolute top-1 bottom-1 left-1 rounded-[13px] transition-transform duration-500 ease-[cubic-bezier(.5,1.5,.5,1)]"
                style={{
                  width: 'calc(25% - 2px)',
                  transform: `translateX(${currentIdx * 100}%)`,
                  background: `linear-gradient(135deg, color-mix(in srgb, ${currentRole.a} 85%, #000), color-mix(in srgb, ${currentRole.b} 85%, #000))`,
                  boxShadow: `0 0 22px -2px ${currentRole.a}`,
                }}
              />

              {ROLES.map((r, idx) => {
                const isSelected = idx === currentIdx;
                return (
                  <button
                    key={r.role}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleSelectRole(idx)}
                    className={`relative z-10 border-0 bg-transparent py-2.5 px-0 text-[11px] font-semibold tracking-wider cursor-pointer flex flex-col items-center gap-1 transition-colors duration-300 ${
                      isSelected ? 'text-white' : 'text-[#8d97c2] hover:text-white/80'
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5 fill-none stroke-current stroke-[1.8] stroke-linecap-round stroke-linejoin-round transition-transform duration-300"
                      style={{
                        transform: isSelected ? 'scale(1.18)' : 'scale(1)',
                      }}
                      dangerouslySetInnerHTML={{ __html: r.iconPath }}
                    />
                    <span>{r.name.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>

            {/* Role Header Info */}
            <div className="mt-5">
              <span
                className="inline-block text-[10px] font-bold tracking-[.18em] transition-colors duration-500"
                style={{
                  color: currentRole.a,
                  textShadow: `0 0 12px ${currentRole.a}`,
                }}
              >
                {currentRole.tag}
              </span>

              <h1 className="my-1.5 text-2xl md:text-[27px] font-extrabold tracking-tight leading-tight">
                {currentRole.title}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: `linear-gradient(90deg, ${currentRole.a}, ${currentRole.b})`,
                  }}
                >
                  {currentRole.titleHighlight}
                </span>
              </h1>

              <p className="mb-2 text-[#8d97c2] text-xs md:text-sm leading-relaxed">
                {currentRole.subtitle}
              </p>

              {/* Identifier Input */}
              <div className="relative mt-3.5">
                <input
                  id="portal-uid"
                  type="text"
                  placeholder=" "
                  autoComplete="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="peer w-full h-14 px-4 pt-5 pb-1 rounded-2xl border border-white/15 bg-black/35 text-white text-base outline-none transition-all duration-300 focus:border-[var(--a)] focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--a)_22%,transparent),0_0_24px_-4px_var(--a)]"
                  style={{ '--a': currentRole.a } as React.CSSProperties}
                />
                <label
                  htmlFor="portal-uid"
                  className="absolute left-4 top-4 text-sm text-[#8d97c2] pointer-events-none transition-all duration-200 peer-focus:top-2 peer-focus:text-[11px] peer-focus:tracking-wider peer-focus:text-[var(--a)] peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:tracking-wider"
                  style={{ '--a': currentRole.a } as React.CSSProperties}
                >
                  {currentRole.userLabel}
                </label>
              </div>

              {/* Password Input */}
              <div className="relative mt-3.5">
                <input
                  id="portal-pw"
                  type={showPassword ? 'text' : 'password'}
                  placeholder=" "
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="peer w-full h-14 pl-4 pr-12 pt-5 pb-1 rounded-2xl border border-white/15 bg-black/35 text-white text-base outline-none transition-all duration-300 focus:border-[var(--a)] focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--a)_22%,transparent),0_0_24px_-4px_var(--a)]"
                  style={{ '--a': currentRole.a } as React.CSSProperties}
                />
                <label
                  htmlFor="portal-pw"
                  className="absolute left-4 top-4 text-sm text-[#8d97c2] pointer-events-none transition-all duration-200 peer-focus:top-2 peer-focus:text-[11px] peer-focus:tracking-wider peer-focus:text-[var(--a)] peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:tracking-wider"
                  style={{ '--a': currentRole.a } as React.CSSProperties}
                >
                  Password
                </label>

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-2.5 w-9 h-9 rounded-xl border-0 bg-transparent text-[#8d97c2] hover:text-white cursor-pointer grid place-items-center transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current stroke-[1.8] stroke-linecap-round">
                    {showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>

              {/* Aux Controls: Remember Me + Forgot Password */}
              <div className="flex justify-between items-center my-3.5 text-xs text-[#8d97c2]">
                <label className="flex gap-2 items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="accent-[var(--a)] rounded w-3.5 h-3.5 cursor-pointer"
                    style={{ '--a': currentRole.a } as React.CSSProperties}
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotUser(username);
                    setShowForgotModal(true);
                  }}
                  className="bg-transparent border-none p-0 font-semibold cursor-pointer text-[var(--a)] hover:underline"
                  style={{ '--a': currentRole.a } as React.CSSProperties}
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={authLoading}
                className="go-button-shimmer relative overflow-hidden w-full h-[54px] mt-3.5 rounded-2xl border-0 text-[#05060f] font-extrabold text-[15px] tracking-wider cursor-pointer transition-all duration-200 active:scale-95 disabled:cursor-wait"
                style={{
                  background: `linear-gradient(110deg, ${currentRole.a}, ${currentRole.b})`,
                  boxShadow: `0 10px 40px -8px ${currentRole.a}`,
                }}
              >
                {authLoading ? (
                  <span>
                    <span className="spinner-icon"></span>
                    VERIFYING...
                  </span>
                ) : (
                  `LOGIN AS ${currentRole.name.toUpperCase()}`
                )}
              </button>
            </div>

            {/* Feedback / Error Message Display */}
            <div
              className="min-h-[20px] mt-3 text-center text-xs font-medium"
              style={{
                color: localMsg?.isError
                  ? '#ff6b8b'
                  : authError
                  ? '#ff6b8b'
                  : currentRole.a,
              }}
            >
              {localMsg ? localMsg.text : authError ? authError : 'Demo: koi bhi ID + 4+ letters ka password'}
            </div>

            {/* Chips row */}
            <div className="flex justify-center gap-3.5 mt-2 text-[11px] text-[#8d97c2] tracking-wider font-semibold">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: currentRole.a, boxShadow: `0 0 8px ${currentRole.a}` }}
                />
                Encrypted
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: currentRole.a, boxShadow: `0 0 8px ${currentRole.a}` }}
                />
                Secure
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: currentRole.a, boxShadow: `0 0 8px ${currentRole.a}` }}
                />
                24/7
              </span>
            </div>
          </form>
        </div>
      </main>

      {/* Forgot Password Reset Modal */}
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
              Enter your Username/ID and Date of Birth to set a new password.
            </p>

            <form onSubmit={handleResetSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Username / ID</label>
                <input
                  type="text"
                  required
                  value={forgotUser}
                  onChange={(e) => setForgotUser(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-black/40 border border-white/20 text-white text-sm outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Date of Birth (YYYY-MM-DD)</label>
                <input
                  type="date"
                  required
                  value={forgotDob}
                  onChange={(e) => setForgotDob(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-black/40 border border-white/20 text-white text-sm outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={forgotNewPass}
                  onChange={(e) => setForgotNewPass(e.target.value)}
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
                Confirm Password Reset
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
