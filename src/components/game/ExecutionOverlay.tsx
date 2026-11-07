'use client';

import React, { useEffect, useState } from 'react';
import { Gavel, Skull, Scale, Sparkles, AlertTriangle } from 'lucide-react';
import { playElimination, playMayoralFanfare, playMourningBell, playCyberGlitch } from '../../utils/sfx';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export type ExecutionMoralBranch = 'MAFIA' | 'TOWN' | 'JESTER';

export function getExecutionMoralBranch(
  lynchedRole?: string | null,
  lynchedFaction?: string | null
): ExecutionMoralBranch {
  const roleLower = (lynchedRole ?? '').toLowerCase();
  const factionUpper = (lynchedFaction ?? '').toUpperCase();

  if (
    factionUpper === 'MAFIA' ||
    factionUpper === 'YAKUZA' ||
    roleLower.includes('mafia') ||
    roleLower.includes('mafiya') ||
    roleLower.includes('godfather') ||
    roleLower.includes('don') ||
    roleLower.includes('yakuza') ||
    roleLower.includes('consigliere') ||
    roleLower.includes('qatil')
  ) {
    return 'MAFIA';
  }

  if (
    factionUpper === 'NEUTRAL_EVIL' ||
    roleLower.includes('jester') ||
    roleLower.includes('təlxək')
  ) {
    return 'JESTER';
  }

  return 'TOWN';
}

export interface ExecutionOverlayProps {
  readonly lynchedPlayerName: string | null;
  readonly lynchedRole?: string | null;
  readonly lynchedFaction?: 'MAFIA' | 'TOWN' | 'NEUTRAL_EVIL' | 'NEUTRAL_KILLER' | string | null;
}

const ExecutionOverlayComponent: React.FC<ExecutionOverlayProps> = ({
  lynchedPlayerName,
  lynchedRole,
  lynchedFaction,
}) => {
  const [show, setShow] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const moralBranch = getExecutionMoralBranch(lynchedRole, lynchedFaction);
  const isMafia = moralBranch === 'MAFIA';
  const isJester = moralBranch === 'JESTER';
  const isInnocent = moralBranch === 'TOWN';

  useEffect(() => {
    if (!lynchedPlayerName) {
      setCurrentPlayer(null);
      setShow(false);
      return;
    }
    if (lynchedPlayerName && lynchedPlayerName !== currentPlayer) {
      setCurrentPlayer(lynchedPlayerName);
      setShow(true);

      // Moral Audio Branching
      if (isMafia) {
        playMayoralFanfare();
      } else if (isInnocent) {
        playMourningBell();
      } else if (isJester) {
        playCyberGlitch();
        playElimination();
      } else {
        playElimination();
      }
    }
  }, [lynchedPlayerName, currentPlayer, isMafia, isInnocent, isJester]);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setShow(false), 5500);
      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 1 } }}
          className={`fixed inset-0 z-[200] flex items-center justify-center pointer-events-none overflow-hidden select-none ${
            isInnocent
              ? 'bg-black/95 backdrop-grayscale contrast-125'
              : isMafia
              ? 'bg-gradient-to-b from-emerald-950/90 via-zinc-950/95 to-amber-950/90 backdrop-blur-sm'
              : 'bg-gradient-to-b from-purple-950/90 via-zinc-950/95 to-fuchsia-950/90 backdrop-blur-sm'
          }`}
        >
          {/* Weeping Ash / Falling Rain Motes for Innocent Town Lynx */}
          {isInnocent && (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.08)_0%,_transparent_70%)] pointer-events-none" />
          )}

          {/* Righteous Golden Flare for Mafia Don Execution */}
          {isMafia && (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.15)_0%,_transparent_60%)] animate-pulse pointer-events-none" />
          )}

          {/* GUILLOTINE BLADE DROP (Accessible with prefers-reduced-motion) */}
          <motion.div
            initial={
              shouldReduceMotion
                ? { opacity: 0, y: '20vh' }
                : { y: '-100vh', rotate: -5 }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1, y: '20vh' }
                : { y: '20vh', rotate: 0 }
            }
            transition={{ type: 'spring', damping: 10, stiffness: 50, delay: 0.5 }}
            className={`absolute top-0 w-[120vw] h-[80vh] shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-b-8 z-10 flex items-end justify-center ${
              isMafia
                ? 'bg-gradient-to-b from-zinc-700 via-amber-200 to-amber-400 border-amber-300 shadow-amber-500/20'
                : isInnocent
                ? 'bg-gradient-to-b from-zinc-900 to-zinc-400 border-zinc-500'
                : 'bg-gradient-to-b from-purple-900 to-fuchsia-400 border-fuchsia-300'
            }`}
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 80%, 0 100%)' }}
          >
            {/* Blood / Flare Splash on Blade */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className={`w-full h-32 ${
                isMafia
                  ? 'bg-gradient-to-t from-amber-500/80 to-transparent'
                  : 'bg-gradient-to-t from-red-700/80 to-transparent'
              }`}
            />
          </motion.div>

          {/* Blood / Radiant Splatter on Screen */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0] }}
            transition={{ delay: 0.7, duration: 1.5 }}
            className="absolute inset-0 z-20 flex items-center justify-center"
          >
            <div
              className={`w-[80vw] h-[80vh] blur-2xl rounded-full ${
                isMafia
                  ? 'bg-[radial-gradient(ellipse_at_center,_rgba(251,191,36,0.6)_0%,_transparent_70%)]'
                  : isInnocent
                  ? 'bg-[radial-gradient(ellipse_at_center,_rgba(161,161,170,0.4)_0%,_transparent_70%)]'
                  : 'bg-[radial-gradient(ellipse_at_center,_rgba(220,38,38,0.8)_0%,_transparent_70%)]'
              }`}
            />
          </motion.div>

          {/* Moral Banner Container */}
          <motion.div
            initial={{ y: 50, scale: 0.9, opacity: 0 }}
            animate={{
              y: 0,
              scale: 1,
              opacity: 1,
              transition: { type: 'spring', damping: 20, stiffness: 100, delay: 1 },
            }}
            exit={{ y: 20, opacity: 0 }}
            className={`relative z-30 p-8 sm:p-10 border-t border-b shadow-2xl flex flex-col items-center justify-center w-full backdrop-blur-md ${
              isMafia
                ? 'bg-zinc-950/90 border-amber-500/60 shadow-amber-900/40'
                : isInnocent
                ? 'bg-zinc-950/95 border-zinc-600/60 shadow-black'
                : 'bg-zinc-950/90 border-purple-500/60 shadow-purple-900/40'
            }`}
          >
            {/* Center Moral Icon */}
            <motion.div
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1, transition: { type: 'spring', delay: 1.2 } }}
              className={`p-4 rounded-full mb-4 shadow-lg border ${
                isMafia
                  ? 'bg-amber-900/40 border-amber-500/50 text-amber-400 shadow-amber-500/30'
                  : isInnocent
                  ? 'bg-zinc-800/60 border-zinc-500/50 text-zinc-300 shadow-black'
                  : 'bg-purple-900/40 border-purple-500/50 text-purple-400 shadow-purple-500/30'
              }`}
            >
              {isMafia ? (
                <Sparkles className="w-14 h-14" />
              ) : isInnocent ? (
                <Scale className="w-14 h-14" />
              ) : (
                <Gavel className="w-14 h-14" />
              )}
            </motion.div>

            {/* Proclamation Header */}
            <h2
              className={`text-sm sm:text-base font-extrabold uppercase tracking-[0.3em] mb-2 font-serif text-center ${
                isMafia
                  ? 'text-amber-400'
                  : isInnocent
                  ? 'text-zinc-400'
                  : 'text-purple-400'
              }`}
            >
              {isMafia
                ? '★ ƏDALƏTİN TƏNTƏNƏSİ ★'
                : isInnocent
                ? '🖤 ŞƏHƏRİN FACİƏSİ & PEŞMANÇILIQ 🖤'
                : '🃏 TƏLXƏK TƏLƏSİ 🃏'}
            </h2>

            {/* Executed Player Name */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] mb-3 text-center font-serif">
              {currentPlayer}{' '}
              <span
                className={`px-3 py-1 rounded border text-2xl sm:text-4xl align-middle font-sans font-black ${
                  isMafia
                    ? 'text-amber-300 bg-amber-950/70 border-amber-500/50'
                    : isInnocent
                    ? 'text-zinc-300 bg-zinc-900/80 border-zinc-600/50'
                    : 'text-purple-300 bg-purple-950/70 border-purple-500/50'
                }`}
              >
                EDAM EDİLDİ
              </span>
            </h1>

            {/* Subtitle Lore */}
            <p className="text-xs sm:text-sm font-semibold max-w-xl text-center mb-2 text-zinc-300">
              {isMafia
                ? 'Şəhər bir qatildən xilas oldu! Mafiya şəbəkəsinə ağır zərbə endirildi.'
                : isInnocent
                ? 'Şəhər səhv etdi! Məsum vətəndaşın qanı töküldü, hamı peşmançılıq içində başını aşağı salır...'
                : 'Şəhər qurban verdiyini zənn etdi, amma əslində tələyə düşdü! Təlxək qalib gəldi!'}
            </p>

            {/* True Role Reveal */}
            {lynchedRole && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 2, duration: 1 } }}
                className={`mt-4 flex flex-col items-center bg-black/70 px-8 py-4 rounded-2xl border ${
                  isMafia
                    ? 'border-amber-500/50'
                    : isInnocent
                    ? 'border-zinc-700/60'
                    : 'border-purple-500/50'
                }`}
              >
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                  <Skull className="w-4 h-4 text-zinc-400" />
                  Gerçək Rolu Məlum Oldu
                </div>
                <div
                  className={`text-2xl sm:text-3xl font-black font-mono tracking-wider drop-shadow-lg ${
                    isMafia
                      ? 'text-amber-400'
                      : isInnocent
                      ? 'text-zinc-200'
                      : 'text-purple-400'
                  }`}
                >
                  {lynchedRole}
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const ExecutionOverlay = React.memo(ExecutionOverlayComponent);
