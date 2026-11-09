import React, { useEffect, useRef } from 'react';

interface WaterfallAnimationProps {
  height?: string;
  fullScreen?: boolean;
}

/**
 * High-performance HTML5 <canvas> + SVG 3D Waterfall, Glowing Particles & Swimming Fish Animation.
 * Supports full-screen viewport mode (`fullScreen={true}`) where fish and 3D light particles animate across the screen.
 */
export const WaterfallAnimation: React.FC<WaterfallAnimationProps> = ({
  height = 'h-52',
  fullScreen = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const resize = () => {
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 38 }, (_, i) => ({
      x: Math.random() * 1200,
      y: Math.random() * 800,
      r: 1.5 + (i % 4) * 1.1,
      vy: 0.7 + (i % 5) * 0.35,
      vx: (Math.random() - 0.5) * 0.4,
      alpha: 0.25 + (i % 5) * 0.12,
    }));

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.y += p.vy;
        p.x += p.vx;
        if (p.y > h) {
          p.y = -10;
          p.x = Math.random() * w;
        }
        if (p.x > w) p.x = 0;
        if (p.x < 0) p.x = w;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(190, 242, 255, ${p.alpha})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const containerClass = fullScreen
    ? 'fixed inset-0 w-screen h-screen overflow-hidden select-none pointer-events-none z-0'
    : `relative w-full ${height} overflow-hidden rounded-3xl select-none pointer-events-none`;

  const swimRightClass = fullScreen ? 'animate-swim-screen-right' : 'animate-swim-right';
  const swimLeftClass = fullScreen ? 'animate-swim-screen-left' : 'animate-swim-left';

  return (
    <div className={containerClass}>
      {/* Interactive HTML5 Canvas for 3D Shimmering Particles & Waterfall Droplets */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Waterfall Background Curtain */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0096C7]/20 via-[#48CAE4]/15 to-[#CAF0F8]/35" />

      {/* Cascading Falling Waterfall Streams Across the Screen */}
      <div className="absolute inset-x-0 top-0 h-full flex justify-around opacity-45">
        <div
          className="w-1.5 h-48 bg-gradient-to-b from-white via-cyan-200 to-transparent rounded-full animate-waterfall-drop"
          style={{ animationDelay: '0s', animationDuration: '3.2s' }}
        />
        <div
          className="w-2 h-64 bg-gradient-to-b from-white via-blue-100 to-transparent rounded-full animate-waterfall-drop"
          style={{ animationDelay: '1.1s', animationDuration: '2.9s' }}
        />
        <div
          className="w-1.5 h-44 bg-gradient-to-b from-white via-cyan-100 to-transparent rounded-full animate-waterfall-drop"
          style={{ animationDelay: '2.1s', animationDuration: '3.6s' }}
        />
        <div
          className="w-2.5 h-72 bg-gradient-to-b from-white via-blue-200 to-transparent rounded-full animate-waterfall-drop"
          style={{ animationDelay: '0.5s', animationDuration: '3.1s' }}
        />
        <div
          className="w-1.5 h-56 bg-gradient-to-b from-white via-cyan-100 to-transparent rounded-full animate-waterfall-drop"
          style={{ animationDelay: '1.7s', animationDuration: '3.4s' }}
        />
        <div
          className="w-2 h-52 bg-gradient-to-b from-white via-blue-100 to-transparent rounded-full animate-waterfall-drop"
          style={{ animationDelay: '2.5s', animationDuration: '2.8s' }}
        />
      </div>

      {/* Swimming Golden-Orange Koi Fish #1 */}
      <div className={`absolute top-[14%] left-0 ${swimRightClass}`} style={{ animationDelay: '0s' }}>
        <svg viewBox="0 0 64 32" className="w-16 h-8 drop-shadow-lg">
          <defs>
            <linearGradient id="fishGrad1" x1="0" y1="0" x2="64" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF6B00" />
              <stop offset="60%" stopColor="#FFAA00" />
              <stop offset="100%" stopColor="#FFF3B0" />
            </linearGradient>
          </defs>
          <path d="M12 16 C 18 7, 38 7, 48 16 C 38 25, 18 25, 12 16 Z" fill="url(#fishGrad1)" />
          <polygon points="12,16 1,7 6,16 1,25" fill="#FF4800" />
          <path d="M25 10 Q 32 2 39 10 Z" fill="#FF8800" />
          <circle cx="44" cy="14" r="1.8" fill="#03045E" />
          <circle cx="44.4" cy="13.6" r="0.6" fill="#FFFFFF" />
        </svg>
      </div>

      {/* Swimming Royal Cyan Koi Fish #2 */}
      <div className={`absolute top-[34%] left-0 ${swimLeftClass}`} style={{ animationDelay: '-4s' }}>
        <svg viewBox="0 0 64 32" className="w-14 h-7 drop-shadow-lg">
          <defs>
            <linearGradient id="fishGrad2" x1="0" y1="0" x2="64" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#023E8A" />
              <stop offset="65%" stopColor="#0096C7" />
              <stop offset="100%" stopColor="#CAF0F8" />
            </linearGradient>
          </defs>
          <path d="M12 16 C 18 8, 38 8, 48 16 C 38 24, 18 24, 12 16 Z" fill="url(#fishGrad2)" />
          <polygon points="12,16 2,8 6,16 2,24" fill="#03045E" />
          <path d="M26 10 Q 32 3 38 10 Z" fill="#00B4D8" />
          <circle cx="44" cy="14" r="1.6" fill="#FFFFFF" />
        </svg>
      </div>

      {/* Swimming Ruby-Gold Koi Fish #3 */}
      <div className={`absolute top-[56%] left-0 ${swimRightClass}`} style={{ animationDelay: '-9s' }}>
        <svg viewBox="0 0 64 32" className="w-16 h-8 drop-shadow-lg">
          <defs>
            <linearGradient id="fishGrad3" x1="0" y1="0" x2="64" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E63946" />
              <stop offset="55%" stopColor="#FF9F1C" />
              <stop offset="100%" stopColor="#FFFFFF" />
            </linearGradient>
          </defs>
          <path d="M12 16 C 18 8, 38 8, 48 16 C 38 24, 18 24, 12 16 Z" fill="url(#fishGrad3)" />
          <polygon points="12,16 2,8 6,16 2,24" fill="#D62828" />
          <path d="M26 10 Q 32 3 38 10 Z" fill="#F77F00" />
          <circle cx="44" cy="14" r="1.7" fill="#03045E" />
        </svg>
      </div>

      {/* Swimming Emerald-Teal Koi Fish #4 */}
      <div className={`absolute bottom-[14%] left-0 ${swimLeftClass}`} style={{ animationDelay: '-6s' }}>
        <svg viewBox="0 0 64 32" className="w-14 h-7 drop-shadow-lg">
          <defs>
            <linearGradient id="fishGrad5" x1="0" y1="0" x2="64" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0077B6" />
              <stop offset="60%" stopColor="#00F5D4" />
              <stop offset="100%" stopColor="#FFFFFF" />
            </linearGradient>
          </defs>
          <path d="M12 16 C 18 8, 38 8, 48 16 C 38 24, 18 24, 12 16 Z" fill="url(#fishGrad5)" />
          <polygon points="12,16 2,8 6,16 2,24" fill="#0096C7" />
          <path d="M26 10 Q 32 3 38 10 Z" fill="#00BBF9" />
          <circle cx="44" cy="14" r="1.6" fill="#03045E" />
        </svg>
      </div>
    </div>
  );
};
