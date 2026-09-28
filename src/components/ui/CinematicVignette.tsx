'use client';

import React from 'react';
import { GamePhase } from '../../types/game';

interface CinematicVignetteProps {
  readonly phase: GamePhase;
}

export const CinematicVignette: React.FC<CinematicVignetteProps> = ({ phase }) => {
  const isNight = phase === 'NIGHT_BUFFER';
  const isVoting = phase === 'DAY_VOTING';
  const isExecution = false;

  return (
    <>
      {/* 1. Edges Vignette */}
      <div 
        className="pointer-events-none fixed inset-0 z-10 transition-all duration-1000 ease-in-out mix-blend-multiply dark:mix-blend-overlay"
        style={{
          background: isNight
            ? 'radial-gradient(circle at center, transparent 30%, rgba(0, 0, 10, 0.95) 100%)'
            : isVoting
            ? 'radial-gradient(circle at center, transparent 50%, rgba(150, 0, 0, 0.2) 100%)'
            : isExecution
            ? 'radial-gradient(circle at center, transparent 40%, rgba(200, 0, 0, 0.4) 100%)'
            : 'radial-gradient(circle at center, transparent 70%, rgba(0, 0, 0, 0.3) 100%)'
        }}
      />

      {/* 2. Cinematic Letterbox (Black Bars for Night Phase) */}
      <div className={`pointer-events-none fixed top-0 left-0 right-0 bg-black z-[100] transition-all duration-[1500ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${isNight ? 'h-12 sm:h-16 opacity-100' : 'h-0 opacity-0'}`} />
      <div className={`pointer-events-none fixed bottom-0 left-0 right-0 bg-black z-[100] transition-all duration-[1500ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${isNight ? 'h-12 sm:h-16 opacity-100' : 'h-0 opacity-0'}`} />

      {/* 3. Global Ambient Overlay (Glows/Tints) */}
      <div className={`pointer-events-none fixed inset-0 z-0 transition-opacity duration-1000 ${isNight ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-0 bg-blue-900/10 mix-blend-screen" />
      </div>
      
      <div className={`pointer-events-none fixed inset-0 z-0 transition-opacity duration-1000 ${isVoting ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-0 bg-red-900/5 mix-blend-overlay animate-pulse" />
      </div>
    </>
  );
};
