import React, { useEffect, useRef } from 'react';

interface FireRingCanvasProps {
  active: boolean;
  size?: number;
  children: React.ReactNode;
}

/**
 * 3D Rotating Water Circle Vortex Animation (`<canvas>`)
 * Renders a glossy 3D aqua-cyan rotating water ring with orbital 3D specular water droplets
 * around the active navigation icon.
 */
export const FireRingCanvas: React.FC<FireRingCanvasProps> = ({
  active,
  size = 42,
  children,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let angle = 0;

    // 3D Orbiting Water Droplets / Pearls
    const droplets = Array.from({ length: 14 }, (_, i) => ({
      baseAngle: (i * Math.PI * 2) / 14,
      speed: 2.2 + (i % 3) * 0.35,
      radiusOffset: (i % 2 === 0 ? 1 : -1) * 1.4,
      size: 1.9 + (i % 3) * 0.65,
      phase: i * 0.7,
    }));

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
        canvas.width = size * dpr;
        canvas.height = size * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const baseR = size / 2 - 4.5;

      angle += 0.055;

      // 1. 3D Deep Aqua Ambient Halo Glow
      const outerGlow = ctx.createRadialGradient(cx, cy, baseR - 6, cx, cy, baseR + 5);
      outerGlow.addColorStop(0, 'rgba(0, 245, 212, 0.05)');
      outerGlow.addColorStop(0.55, 'rgba(0, 187, 249, 0.38)');
      outerGlow.addColorStop(0.85, 'rgba(0, 119, 182, 0.55)');
      outerGlow.addColorStop(1, 'rgba(3, 4, 94, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, baseR + 4.5, 0, Math.PI * 2);
      ctx.fillStyle = outerGlow;
      ctx.fill();

      // 2. 3D Rotating Liquid Water Wave Ribbons (Dual Counter-Rotating Harmonics)
      for (let layer = 0; layer < 2; layer++) {
        ctx.beginPath();
        const steps = 64;
        for (let s = 0; s <= steps; s++) {
          const theta = (s / steps) * Math.PI * 2;
          const wave =
            Math.sin(theta * 4 + angle * (layer === 0 ? 1.6 : -1.3)) * 1.35 +
            Math.cos(theta * 3 - angle * 1.2) * 0.85;
          const r = baseR + wave + (layer === 0 ? -0.4 : 0.6);
          const x = cx + Math.cos(theta) * r;
          const y = cy + Math.sin(theta) * r;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        const gradX1 = cx + Math.cos(angle) * baseR;
        const gradY1 = cy + Math.sin(angle) * baseR;
        const gradX2 = cx - Math.cos(angle) * baseR;
        const gradY2 = cy - Math.sin(angle) * baseR;
        const waterGrad = ctx.createLinearGradient(gradX1, gradY1, gradX2, gradY2);
        if (layer === 0) {
          waterGrad.addColorStop(0, '#00F5D4');
          waterGrad.addColorStop(0.35, '#00BBF9');
          waterGrad.addColorStop(0.7, '#0077B6');
          waterGrad.addColorStop(1, '#90E0EF');
        } else {
          waterGrad.addColorStop(0, 'rgba(202, 240, 248, 0.95)');
          waterGrad.addColorStop(0.5, 'rgba(0, 180, 216, 0.75)');
          waterGrad.addColorStop(1, 'rgba(2, 62, 138, 0.85)');
        }

        ctx.strokeStyle = waterGrad;
        ctx.lineWidth = layer === 0 ? 3.2 : 1.8;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // 3. 3D Specular Glossy Water Droplets Orbiting in a Circle
      for (const p of droplets) {
        const curAngle = p.baseAngle + angle * (p.speed * 0.45);
        const waveShift = Math.sin(angle * 2.4 + p.phase) * 1.5;
        const r = baseR + p.radiusOffset * 0.5 + waveShift;
        const px = cx + Math.cos(curAngle) * r;
        const py = cy + Math.sin(curAngle) * r;

        // 3D Water Sphere Shading
        const dropGrad = ctx.createRadialGradient(
          px - p.size * 0.3,
          py - p.size * 0.3,
          0.2,
          px,
          py,
          p.size * 1.35
        );
        dropGrad.addColorStop(0, '#FFFFFF');
        dropGrad.addColorStop(0.35, '#90E0EF');
        dropGrad.addColorStop(0.75, '#0096C7');
        dropGrad.addColorStop(1, 'rgba(3, 4, 94, 0)');

        ctx.beginPath();
        ctx.arc(px, py, p.size * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = dropGrad;
        ctx.fill();
      }

      // 4. Inner 3D Glassy Water Cushion Highlight
      const innerGloss = ctx.createLinearGradient(cx, cy - baseR, cx, cy + baseR);
      innerGloss.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      innerGloss.addColorStop(0.5, 'rgba(0, 187, 249, 0.12)');
      innerGloss.addColorStop(1, 'rgba(0, 119, 182, 0.28)');
      ctx.beginPath();
      ctx.arc(cx, cy, baseR - 2.5, 0, Math.PI * 2);
      ctx.fillStyle = innerGloss;
      ctx.fill();

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [active, size]);

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {active && (
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size }}
          className="absolute inset-0 pointer-events-none"
        />
      )}
      <div
        className={`relative z-10 flex items-center justify-center transition-transform duration-300 ${
          active ? 'scale-110 text-[#0077B6] drop-shadow-[0_2px_6px_rgba(0,187,249,0.55)]' : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
};
