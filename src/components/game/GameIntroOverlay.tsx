'use client';

import React, { useEffect, useState } from 'react';
import { GamePhase } from '../../types/game';
import { playGavel } from '../../utils/sfx';

interface GameIntroOverlayProps {
  readonly phase: GamePhase;
  readonly roleName: string;
  readonly roleFaction: 'MAFIA' | 'TOWN' | 'NEUTRAL';
}

const GameIntroOverlayComponent: React.FC<GameIntroOverlayProps> = ({ phase, roleName, roleFaction }) => {
  const [show, setShow] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (phase === 'LOBBY') {
      setHasShown(false);
      setShow(false);
      setIsFlipped(false);
      return;
    }

    if (phase !== 'ENDED' && !hasShown) {
      setHasShown(true);
      setShow(true);
      
      playGavel();
      
      // Auto flip after 2 seconds if user doesn't click
      const autoFlip = setTimeout(() => {
        setIsFlipped(true);
        playGavel(); // second gavel on reveal
      }, 2000);

      // Auto close after 7 seconds
      const autoClose = setTimeout(() => {
        setShow(false);
      }, 7000);

      return () => {
        clearTimeout(autoFlip);
        clearTimeout(autoClose);
      };
    }
  }, [phase, hasShown]);

  if (!show) return null;

  const factionTheme = {
    TOWN: {
      bg: 'from-emerald-950 via-teal-900 to-black',
      border: 'border-emerald-500/50',
      shadow: 'shadow-[0_0_50px_rgba(16,185,129,0.3)]',
      text: 'text-emerald-400',
      icon: 'fa-shield-alt',
      pattern: 'bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),transparent_70%)]'
    },
    MAFIA: {
      bg: 'from-red-950 via-rose-950 to-black',
      border: 'border-red-600/50',
      shadow: 'shadow-[0_0_50px_rgba(220,38,38,0.3)]',
      text: 'text-red-500',
      icon: 'fa-skull',
      pattern: 'bg-[linear-gradient(45deg,rgba(220,38,38,0.05)_25%,transparent_25%,transparent_75%,rgba(220,38,38,0.05)_75%,rgba(220,38,38,0.05)),linear-gradient(45deg,rgba(220,38,38,0.05)_25%,transparent_25%,transparent_75%,rgba(220,38,38,0.05)_75%,rgba(220,38,38,0.05))] bg-[length:20px_20px]'
    },
    NEUTRAL: {
      bg: 'from-purple-950 via-fuchsia-950 to-black',
      border: 'border-purple-500/50',
      shadow: 'shadow-[0_0_50px_rgba(168,85,247,0.3)]',
      text: 'text-purple-400',
      icon: 'fa-mask',
      pattern: 'bg-[linear-gradient(rgba(168,85,247,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.1)_1px,transparent_1px)] bg-[size:10px_10px]'
    }
  };

  const theme = factionTheme[roleFaction];

  return (
    <div 
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl transition-opacity duration-1000 cursor-pointer overflow-hidden perspective-[2000px]"
      onClick={() => {
        if (!isFlipped) {
          setIsFlipped(true);
          playGavel();
        } else {
          setShow(false);
        }
      }}
    >
      
      {/* Background ambient light */}
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.bg} opacity-50 mix-blend-overlay transition-opacity duration-1000 ${isFlipped ? 'opacity-50' : 'opacity-0'}`} />
      
      {/* The 3D Card */}
      <div 
        className={`relative w-64 h-96 sm:w-80 sm:h-[28rem] transition-all duration-1000 transform-gpu preserve-3d animate-[slideUp_0.8s_ease-out_forwards] ${isFlipped ? 'rotate-y-180 scale-110' : 'hover:scale-105'}`}
      >
        {/* Card Back (Unknown) */}
        <div className={`absolute inset-0 backface-hidden rounded-3xl border border-zinc-700/50 bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center shadow-2xl overflow-hidden`}>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-zinc-800/80 flex items-center justify-center bg-black/50 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]">
             <i className="fas fa-question text-5xl text-zinc-700"></i>
          </div>
          <span className="absolute bottom-8 text-xs font-mono text-zinc-600 tracking-[0.3em] uppercase">Gzl Kmlk</span>
        </div>

        {/* Card Front (Revealed Role) */}
        <div className={`absolute inset-0 backface-hidden rotate-y-180 rounded-3xl border ${theme.border} bg-gradient-to-b ${theme.bg} flex flex-col items-center p-6 ${theme.shadow} overflow-hidden`}>
           <div className={`absolute inset-0 ${theme.pattern} opacity-30 pointer-events-none`}></div>
           
           <div className="absolute top-0 left-[-100%] w-full h-[200%] bg-gradient-to-r from-transparent via-white/10 to-transparent -rotate-45 animate-[shine_3s_infinite_ease-in-out]"></div>
           
           <div className="flex-1 flex flex-col items-center justify-center w-full relative z-10">
              <i className={`fas ${theme.icon} text-6xl sm:text-7xl ${theme.text} drop-shadow-[0_0_15px_currentColor] mb-6 transform hover:scale-110 transition-transform duration-500`}></i>
              <span className="text-[10px] font-black tracking-[0.5em] text-white/50 uppercase mb-2">Szn Rolunuz</span>
              <h1 className={`text-3xl sm:text-4xl font-black uppercase tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] text-center leading-none`}>
                {roleName}
              </h1>
              <div className={`mt-6 px-4 py-1.5 rounded-full border ${theme.border} bg-black/50 backdrop-blur-md`}>
                 <span className={`text-[10px] font-black tracking-widest ${theme.text} uppercase`}>
                   {roleFaction === 'MAFIA' ? 'MAFİYA FRAKSİYASI' : roleFaction === 'TOWN' ? 'ŞƏHƏR ƏHALİSİ' : 'BİTƏRƏF'}
                 </span>
              </div>
           </div>
        </div>
      </div>

      <span className="fixed bottom-12 text-[10px] text-white/40 uppercase tracking-[0.3em] animate-pulse">
        {isFlipped ? 'Davam etmk n toxunun' : 'Rolunuzu grmk n toxunun'}
      </span>
      
      <style dangerouslySetInnerHTML={{__html: `
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        @keyframes slideUp {
          0% { transform: translateY(100px) scale(0.8); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes shine {
          0% { left: -100%; }
          20% { left: 200%; }
          100% { left: 200%; }
        }
      `}} />
    </div>
  );
};

export const GameIntroOverlay = React.memo(GameIntroOverlayComponent);
