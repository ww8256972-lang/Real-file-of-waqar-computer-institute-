import React, { useEffect, useState } from 'react';
import { Smartphone, Maximize2, Minimize2, Download, ShieldCheck, Cpu } from 'lucide-react';

interface AndroidDeviceFrameProps {
  children: React.ReactNode;
  onOpenCiModal: () => void;
}

export const AndroidDeviceFrame: React.FC<AndroidDeviceFrameProps> = ({
  children,
  onOpenCiModal,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('09:41');
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'fullscreen'>('mobile');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#030612] flex flex-col items-center justify-start text-slate-100">
      {/* Studio Top Control Bar */}
      <header className="w-full bg-[#0a0f24] border-b border-white/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-bold text-emerald-400">
            <Cpu className="w-3.5 h-3.5" />
            <span>WAQAR INSTITUTE NATIVE ANDROID ENGINE (API 34)</span>
          </div>
          <span className="text-xs text-slate-400 hidden md:inline">
            Jetpack Compose • Room SQLCipher • libsodium • Play Integrity
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Device Frame Viewport Toggle */}
          <button
            type="button"
            onClick={() => setDeviceMode(deviceMode === 'mobile' ? 'fullscreen' : 'mobile')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200 border border-white/10 transition-colors"
            title="Toggle between Android Smartphone Frame and Fullscreen"
          >
            {deviceMode === 'mobile' ? (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Expanded View</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Android Phone Frame</span>
              </>
            )}
          </button>

          {/* GitHub Actions / APK Build Modal */}
          <button
            type="button"
            onClick={onOpenCiModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg transition-transform active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Build & Download Native APK</span>
          </button>
        </div>
      </header>

      {/* Main Preview Area */}
      <div className={`w-full flex-1 flex items-center justify-center ${deviceMode === 'mobile' ? 'p-3 sm:p-6 md:p-8' : 'p-0'}`}>
        {deviceMode === 'mobile' ? (
          /* Realistic Android Smartphone Frame */
          <div className="relative w-full max-w-[420px] h-[860px] max-h-[92vh] bg-black rounded-[48px] p-3 shadow-[0_0_80px_rgba(0,0,0,0.9),0_0_0_12px_#1e293b,0_0_0_14px_rgba(255,255,255,0.15)] flex flex-col overflow-hidden border border-white/10">
            {/* Top Speaker & Punch Hole Camera */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
              <div className="w-12 h-1 bg-slate-800 rounded-full" />
            </div>

            {/* Android 15 Status Bar */}
            <div className="relative z-30 w-full h-8 px-6 flex items-center justify-between text-white text-[11px] font-semibold tracking-wide select-none bg-black/40 backdrop-blur-sm">
              {/* Left: Clock */}
              <span>{currentTime}</span>

              {/* Center: Punch-hole camera */}
              <div className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-slate-700/60 shadow-inner flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-950" />
              </div>

              {/* Right: Network & Battery Icons */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[9px] font-bold tracking-tighter text-emerald-400">5G</span>
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L12 22l7.03-4.39C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9z" opacity="0.3"/>
                  <path d="M12 7c-2.76 0-5 2.24-5 5 0 1.34.53 2.56 1.39 3.46L12 18l3.61-2.54c.86-.9 1.39-2.12 1.39-3.46 0-2.76-2.24-5-5-5z"/>
                </svg>
                {/* Battery */}
                <div className="w-4 h-2.5 border border-white/80 rounded-sm p-0.5 flex items-center">
                  <div className="w-full h-full bg-emerald-400 rounded-2xs" />
                </div>
              </div>
            </div>

            {/* Inner App Container with Smooth Native Scrolling */}
            <div className="relative flex-1 w-full bg-[#05060f] overflow-y-auto overflow-x-hidden rounded-[38px] flex flex-col">
              {children}
            </div>

            {/* Bottom Android Gesture Pill Bar */}
            <div className="relative z-30 w-full h-6 flex items-center justify-center bg-black/40 backdrop-blur-sm select-none">
              <div className="w-32 h-1 bg-white/70 rounded-full" />
            </div>
          </div>
        ) : (
          /* Fullscreen Mode */
          <div className="w-full h-full min-h-screen flex flex-col">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};
