'use client';

import React, { useEffect, useState } from 'react';
import { GamePhase } from '../../types/game';
import { Sun, Moon, Scale, Skull } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { playNight, playDay, playGavel } from '../../utils/sfx';

interface PhaseTransitionOverlayProps {
  phase: GamePhase;
}

const PhaseTransitionOverlayComponent: React.FC<PhaseTransitionOverlayProps> = ({ phase }) => {
  const [show, setShow] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<GamePhase | null>(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    if (show) setIsRendered(true);
    else {
      const t = setTimeout(() => setIsRendered(false), 500);
      return () => clearTimeout(t);
    }
  }, [show]);

  useEffect(() => {
    if (phase === 'LOBBY') {
      setCurrentPhase(null);
      setShow(false);
      return;
    }

    if (
      phase !== currentPhase &&
      ['DAY_DISCUSSION', 'DAY_CENTRAL_ASSEMBLY', 'DAY_REGIONAL_CAUCUS', 'DAY_VOTING', 'NIGHT_ACTION', 'NIGHT_BUFFER'].includes(phase)
    ) {
      setCurrentPhase(phase);
      setShow(true);
      
      if (phase.includes('NIGHT')) {
        playNight();
      } else if (phase.includes('VOTING')) {
        playGavel();
      } else if (phase.includes('DAY')) {
        playDay();
      }
    }
  }, [phase, currentPhase]);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setShow(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!isRendered) return null;

  let Icon = Sun;
  let title = 'Yeni Gün';
  let subtitle = '';
  let bgClass = 'bg-amber-500/10';
  let textClass = 'text-amber-500';

  if (phase.includes('DAY_DISCUSSION') || phase.includes('DAY_CENTRAL_ASSEMBLY') || phase.includes('DAY_REGIONAL_CAUCUS')) {
    Icon = Sun;
    title = phase === 'DAY_REGIONAL_CAUCUS' ? 'Regional Kvartal Toplantısı' : 'Səhər Açılır';
    subtitle = phase === 'DAY_REGIONAL_CAUCUS' ? 'Kvartal sakinləri toplaşır və finalçıları müəyyənləşdirir.' : 'Şəhər oyanır. Hadisələri müzakirə etmək vaxtıdır.';
    bgClass = 'bg-amber-500/10';
    textClass = 'text-amber-500';
  } else if (phase.includes('DAY_VOTING')) {
    Icon = Scale;
    title = 'Məhkəmə Başlayır';
    subtitle = 'Günahkarları mühakimə etmək üçün son şansınızdır.';
    bgClass = 'bg-zinc-500/20';
    textClass = 'text-zinc-200';
  } else if (phase.includes('NIGHT_ACTION') || phase.includes('NIGHT_BUFFER')) {
    Icon = Moon;
    title = 'Gecə Çökür';
    subtitle = 'Məsumlar yatır, cinayətkarlar və müdafiəçilər hərəkətə keçir.';
    bgClass = 'bg-blue-950/40';
    textClass = 'text-blue-400';
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8 } }}
          className={`fixed inset-0 z-[100] flex items-center justify-center pointer-events-none ${bgClass} backdrop-blur-sm`}
        >
          <motion.div 
            initial={{ scale: 1.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0, transition: { type: 'spring', damping: 20, stiffness: 100 } }}
            exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.5 } }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div 
              initial={{ rotate: -180, scale: 0 }}
              animate={{ rotate: 0, scale: 1, transition: { type: 'spring', delay: 0.2, damping: 15 } }}
              className={`p-6 rounded-full bg-black/30 border border-white/10 shadow-2xl ${textClass}`}
            >
              <Icon className="w-24 h-24" />
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }}
              className={`text-5xl md:text-7xl font-black ${textClass} drop-shadow-xl uppercase tracking-widest text-center`}
            >
              {title}
            </motion.h1>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const PhaseTransitionOverlay = React.memo(PhaseTransitionOverlayComponent);
