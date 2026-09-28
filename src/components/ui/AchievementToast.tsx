'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Star, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Achievement, AchievementTier } from '../../types/achievements';

interface AchievementToast {
  readonly achievement: Achievement;
  readonly id: string;
}

const TIER_STYLES: Record<AchievementTier, {
  bg: string;
  border: string;
  glow: string;
  badge: string;
  icon: string;
}> = {
  BRONZE: {
    bg: 'from-amber-950/95 to-amber-900/95',
    border: 'border-amber-700/60',
    glow: 'shadow-[0_0_30px_rgba(180,83,9,0.5)]',
    badge: 'bg-amber-700 text-amber-100',
    icon: 'text-amber-400',
  },
  SILVER: {
    bg: 'from-slate-900/95 to-slate-800/95',
    border: 'border-slate-500/60',
    glow: 'shadow-[0_0_30px_rgba(148,163,184,0.4)]',
    badge: 'bg-slate-600 text-slate-100',
    icon: 'text-slate-300',
  },
  GOLD: {
    bg: 'from-yellow-950/95 to-amber-900/95',
    border: 'border-yellow-500/60',
    glow: 'shadow-[0_0_35px_rgba(234,179,8,0.5)]',
    badge: 'bg-yellow-600 text-yellow-100',
    icon: 'text-yellow-400',
  },
  PLATINUM: {
    bg: 'from-cyan-950/95 to-teal-900/95',
    border: 'border-cyan-500/60',
    glow: 'shadow-[0_0_40px_rgba(6,182,212,0.6)]',
    badge: 'bg-cyan-600 text-cyan-100',
    icon: 'text-cyan-300',
  },
  LEGENDARY: {
    bg: 'from-purple-950/95 via-fuchsia-950/95 to-purple-950/95',
    border: 'border-fuchsia-500/60',
    glow: 'shadow-[0_0_50px_rgba(217,70,239,0.7)]',
    badge: 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white',
    icon: 'text-fuchsia-400',
  },
};

const TIER_LABELS: Record<AchievementTier, string> = {
  BRONZE: 'Bürünc',
  SILVER: 'Gümüş',
  GOLD: 'Qızıl',
  PLATINUM: 'Platin',
  LEGENDARY: 'Əfsanəvi',
};

// Global achievement unlock queue
type UnlockHandler = (achievement: Achievement) => void;
let globalUnlockHandler: UnlockHandler | null = null;

export function unlockAchievement(achievement: Achievement): void {
  if (globalUnlockHandler) {
    globalUnlockHandler(achievement);
  }
}

export const AchievementToastSystem: React.FC = () => {
  const [queue, setQueue] = useState<AchievementToast[]>([]);
  const [current, setCurrent] = useState<AchievementToast | null>(null);
  const [visible, setVisible] = useState(false);

  const showNext = useCallback((toastQueue: AchievementToast[]) => {
    if (toastQueue.length === 0) {
      setCurrent(null);
      setVisible(false);
      return;
    }
    const [next, ...rest] = toastQueue;
    setCurrent(next!);
    setVisible(true);
    setQueue(rest);

    // Auto-dismiss after 5s
    setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setQueue(q => {
          showNext(q);
          return q;
        });
      }, 400);
    }, 5000);
  }, []);

  useEffect(() => {
    globalUnlockHandler = (achievement: Achievement) => {
      const toast: AchievementToast = {
        achievement,
        id: `${achievement.id}_${Date.now()}`,
      };
      setQueue(q => {
        const newQueue = [...q, toast];
        if (!current && !visible) {
          showNext(newQueue);
          return [];
        }
        return newQueue;
      });
    };
    return () => { globalUnlockHandler = null; };
  }, [current, visible, showNext]);

  if (!current) return null;

  const styles = TIER_STYLES[current.achievement.tier];
  const isLegendary = current.achievement.tier === 'LEGENDARY';

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] pointer-events-none transition-all duration-400 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'
      }`}
    >
      <div
        className={`flex items-center gap-4 px-5 py-4 rounded-2xl border bg-gradient-to-r ${styles.bg} ${styles.border} ${styles.glow} backdrop-blur-xl min-w-[320px] max-w-[480px] ${isLegendary ? 'animate-pulse' : ''}`}
      >
        {/* Icon */}
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-black/30 border ${styles.border}`}>
          {isLegendary ? (
            <Star className={`w-8 h-8 ${styles.icon} drop-shadow-[0_0_10px_currentColor]`} />
          ) : current.achievement.tier === 'PLATINUM' ? (
            <Zap className={`w-8 h-8 ${styles.icon}`} />
          ) : (
            <Trophy className={`w-8 h-8 ${styles.icon}`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase ${styles.badge}`}>
              {TIER_LABELS[current.achievement.tier]}
            </span>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              +{current.achievement.xp} XP
            </span>
          </div>
          <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-0.5">
            NAİLİYYƏT AÇILDI
          </div>
          <div className="text-sm font-black text-white leading-tight truncate">
            {current.achievement.title}
          </div>
          <div className="text-xs text-zinc-400 mt-0.5 line-clamp-1">
            {current.achievement.description}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .duration-400 { transition-duration: 400ms; }
      `}} />
    </div>
  );
};
