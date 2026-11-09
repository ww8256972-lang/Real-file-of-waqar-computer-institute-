import React from 'react';

interface EmblemProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  lightText?: boolean;
}

export const WaqarCrestLogo: React.FC<EmblemProps> = ({
  size = 'md',
  showSubtitle = true,
  lightText = true,
}) => {
  const dimensions = {
    sm: { box: 'w-12 h-12', title: 'text-base', sub: 'text-[10px]' },
    md: { box: 'w-24 h-24', title: 'text-2xl', sub: 'text-xs' },
    lg: { box: 'w-32 h-32', title: 'text-3xl', sub: 'text-sm' },
    xl: { box: 'w-44 h-44', title: 'text-4xl', sub: 'text-base' },
  }[size];

  return (
    <div className="flex flex-col items-center select-none">
      <div className={`relative ${dimensions.box} flex items-center justify-center`}>
        {/* Outer royal glow */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-blue-500/40 via-cyan-400/35 to-amber-300/40 blur-md" />
        <div className="relative z-10 w-full h-full rounded-3xl bg-white p-2 shadow-[0_12px_30px_rgba(30,64,175,0.55)] border-2 border-cyan-200/80 flex items-center justify-center overflow-hidden">
          <img
            src="/waqar_logo.png"
            alt="Waqar Computer Institute Official Logo"
            className="w-full h-full object-contain"
          />
        </div>
      </div>
      <div className="text-center mt-2">
        <div
          className={`font-display font-extrabold tracking-wider uppercase leading-tight ${dimensions.title} ${
            lightText
              ? 'text-white drop-shadow-[0_2px_10px_rgba(59,130,246,0.6)]'
              : 'text-[#0A184E]'
          }`}
        >
          WAQAR COMPUTER INSTITUTE
        </div>
        {showSubtitle && (
          <div
            className={`font-medium tracking-widest mt-0.5 ${dimensions.sub} ${
              lightText ? 'text-blue-200' : 'text-blue-700'
            }`}
          >
            Learn • Practice • Excel
          </div>
        )}
      </div>
    </div>
  );
};

export const CircularProgressRing: React.FC<{
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
}> = ({
  percentage,
  size = 76,
  strokeWidth = 8,
  color = '#FBBF24',
  trackColor = 'rgba(255,255,255,0.2)',
  label,
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-bold text-sm tabular-nums">{label ?? `${clamped}%`}</span>
      </div>
    </div>
  );
};
