import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Crown, Skull } from 'lucide-react';
import { PlayerSession } from '../../types/game';

interface GameOverCinematicProps {
  isOpen: boolean;
  winnerResult: any;
  players: Record<string, PlayerSession>;
  currentUserId: string;
  onClose?: () => void;
}

export const GameOverCinematic: React.FC<GameOverCinematicProps> = ({
  isOpen,
  winnerResult,
  players,
  currentUserId,
  onClose,
}) => {
  if (!isOpen || !winnerResult) return null;

  const isTownVictory = winnerResult.kind === 'TOWN_VICTORY';
  const isMafiaVictory = winnerResult.kind === 'MAFIA_MAJORITY' || winnerResult.kind === 'YAKUZA_MAJORITY';
  const isNeutralVictory =
    winnerResult.kind === 'NEUTRAL_VICTORY' ||
    winnerResult.kind === 'NEUTRAL_KILLER_SOLO' ||
    winnerResult.kind === 'JESTER_LUCIFER_SHADOW' ||
    winnerResult.kind === 'VOID_CULT_ASCENSION';
  
  const winnerIds = winnerResult.winnerPlayerIds || [];
  const iAmWinner = winnerIds.includes(currentUserId);

  const victorySubtitle = isTownVictory
    ? "ŞƏHƏR QAZANDI"
    : isMafiaVictory
    ? "MAFİYA QAZANDI"
    : winnerResult.kind === 'JESTER_LUCIFER_SHADOW'
    ? "TƏLXƏK ŞƏHƏRİ ƏLƏ KEÇİRDİ"
    : winnerResult.kind === 'NEUTRAL_KILLER_SOLO'
    ? "SERİYALI QATİL TƏK QALİB GƏLDİ"
    : winnerResult.kind === 'VOID_CULT_ASCENSION'
    ? "QARANLIQ KULT YÜKSƏLDİ"
    : "BİTƏRƏF QAZANDI";

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl overflow-hidden"
      >
        {/* Confetti or Blood Particles */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          {isTownVictory && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.3)_0%,_transparent_70%)] blur-3xl animate-pulse" />}
          {isMafiaVictory && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(220,38,38,0.3)_0%,_transparent_70%)] blur-3xl animate-pulse" />}
          {isNeutralVictory && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(168,85,247,0.3)_0%,_transparent_70%)] blur-3xl animate-pulse" />}
        </div>

        <motion.div
          initial={{ scale: 0.5, y: 100, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100, delay: 0.2 }}
          className="relative z-10 flex flex-col items-center max-w-4xl w-full p-8 text-center"
        >
          <motion.div
            animate={{ rotateY: [0, 360] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className={`w-32 h-32 rounded-full flex items-center justify-center mb-8 shadow-[0_0_100px_rgba(255,255,255,0.2)] ${
              isTownVictory ? 'bg-emerald-500/20 text-emerald-400' :
              isMafiaVictory ? 'bg-red-500/20 text-red-400' :
              'bg-purple-500/20 text-purple-400'
            }`}
          >
            {isTownVictory ? <Trophy className="w-16 h-16" /> : isMafiaVictory ? <Skull className="w-16 h-16" /> : <Crown className="w-16 h-16" />}
          </motion.div>

          <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500 uppercase tracking-tighter mb-4 drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)]">
            {iAmWinner ? "QƏLƏBƏ!" : "MƏĞLUBİYYƏT"}
          </h1>

          <h2 className={`text-2xl md:text-4xl font-bold uppercase tracking-widest ${
              isTownVictory ? 'text-emerald-400' :
              isMafiaVictory ? 'text-red-400' :
              'text-purple-400'
          }`}>
            {victorySubtitle}
          </h2>

          {winnerResult.reason && (
            <p className="text-sm md:text-base text-zinc-400 mt-3 mb-8 max-w-xl mx-auto font-medium leading-relaxed">
              {winnerResult.reason}
            </p>
          )}

          <div className="w-full bg-zinc-900/80 border border-zinc-700 p-6 rounded-2xl">
            <h3 className="text-zinc-400 text-sm font-bold uppercase tracking-widest mb-6">Qaliblər Lövhəsi</h3>
            <div className="flex flex-wrap justify-center gap-4">
              {winnerIds.map((id: string, idx: number) => {
                const p = players[id];
                if (!p) return null;
                return (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1 + idx * 0.1 }}
                    key={id} 
                    className={`flex items-center gap-3 px-6 py-3 rounded-xl border ${
                      isTownVictory ? 'bg-emerald-950/50 border-emerald-500/30' :
                      isMafiaVictory ? 'bg-red-950/50 border-red-500/30' :
                      'bg-purple-950/50 border-purple-500/30'
                    }`}
                  >
                    <div className="text-white font-bold text-lg">{p.username}</div>
                    <div className="text-xs font-mono text-zinc-400 border-l border-zinc-700 pl-3">
                      {p.displayRole?.localizedRoleName || p.displayRole?.originalRoleName || 'Bilinmir'}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
          
          {onClose && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.0 }}
              onClick={onClose}
              className="mt-8 px-8 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xl backdrop-blur-md"
            >
              Tam Nəticələri Gör ➔
            </motion.button>
          )}

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5 }}
            className="mt-6 text-zinc-500 text-xs tracking-widest uppercase font-mono"
          >
            Lobbyə qayıtmaq üçün yuxarıdan menyunu istifadə edin...
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
