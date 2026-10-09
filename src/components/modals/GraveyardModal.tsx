'use client';

import React from 'react';
import { Skull, X, Ghost } from 'lucide-react';
import { PlayerSession } from '../../types/game';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '../ui/Badge';

interface GraveyardModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Record<string, PlayerSession>;
  onInspectPlayer?: (player: PlayerSession) => void;
}

export const GraveyardModal: React.FC<GraveyardModalProps> = ({ isOpen, onClose, players, onInspectPlayer }) => {


  const deadPlayers = Object.values(players).filter(p => !p.isAlive && !p.userId.startsWith('temp-'));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 p-2 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 text-center bg-zinc-950/50 border-b border-zinc-800/50 relative overflow-hidden">
          <Ghost className="w-48 h-48 text-zinc-800/30 absolute -top-10 -right-10 transform rotate-12" />
          <div className="relative z-10">
            <h2 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-3">
              <Skull className="w-8 h-8 text-red-500" />
              Qəbiristanlıq
            </h2>
            <p className="text-sm text-zinc-400 font-medium mt-2">
              Ölülər danışmır, ancaq sirləri qalır.
            </p>
          </div>
        </div>

        <div className="p-6 max-h-[50vh] overflow-y-auto">
          {deadPlayers.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center opacity-50">
              <Ghost className="w-12 h-12 text-zinc-500 mb-3" />
              <p className="text-sm text-zinc-400 font-bold uppercase tracking-wider">Hələlik heç kim ölməyib</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {deadPlayers.map((p) => {
                const roleName =
                  p.displayRole?.originalRoleName !== 'Secret' && p.displayRole?.originalRoleName !== 'Pending'
                    ? p.displayRole?.localizedRoleName || p.displayRole?.originalRoleName
                    : 'Bilinməyən Rol';

                return (
                  <React.Fragment key={p.userId}>
                    <div
                      onClick={() => onInspectPlayer?.(p)}
                      className={`flex items-center justify-between bg-zinc-950/50 border border-zinc-800/50 ${p.lastWill ? 'rounded-t-xl border-b-0' : 'rounded-xl'} p-4 hover:border-red-500/40 hover:bg-zinc-900/60 transition-all group cursor-pointer`}
                      title="Məzar daşını və ətraflı məlumatı aç"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center text-zinc-500 font-black group-hover:border-red-500/50 group-hover:text-red-400 transition-colors">
                          {p.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-zinc-300 line-through decoration-red-500/50 group-hover:text-white transition-colors">{p.username}</span>
                          <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">{roleName}</span>
                        </div>
                      </div>
                    {p.lastWill && (
                      <Badge tone="purple" className="shrink-0">
                        Vəsiyyəti Var
                      </Badge>
                    )}
                  </div>
                  {p.lastWill && (
                    <div className="bg-amber-950/20 border-x border-b border-amber-900/30 rounded-b-xl px-4 py-3 -mt-2 mb-2">
                      <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        Son Vəsiyyət
                      </div>
                      <p className="text-xs text-amber-200/80 italic font-serif leading-relaxed">
                        &ldquo;{p.lastWill}&rdquo;
                      </p>
                    </div>
                  )}
                </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
