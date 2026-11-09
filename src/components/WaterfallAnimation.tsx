import React from 'react';

interface WaterfallAnimationProps {
  fullScreen?: boolean;
}

export const WaterfallAnimation: React.FC<WaterfallAnimationProps> = ({ fullScreen = false }) => {
  return (
    <div
      className={`${
        fullScreen ? 'fixed inset-0' : 'absolute inset-0'
      } pointer-events-none overflow-hidden z-0`}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#040D33]/40 via-[#0077B6]/20 to-[#00B4D8]/30" />
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-blue-500/15 blur-3xl" />
    </div>
  );
};
