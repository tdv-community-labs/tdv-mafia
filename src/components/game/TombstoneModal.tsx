'use client';

import React from 'react';
import { Skull, Scroll, X, Shield, Target } from 'lucide-react';
import { PlayerSession } from '../../types/game';

interface TombstoneModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly deadPlayer: PlayerSession | null;
  readonly lastWill: string | null;
}

export const TombstoneModal: React.FC<TombstoneModalProps> = ({ isOpen, onClose, deadPlayer, lastWill }) => {
  if (!isOpen || !deadPlayer) return null;

  const faction = deadPlayer.allInIdentity?.layer1Faction || 'TOWN';
  const isMafia = faction === 'MAFIA' || faction === 'YAKUZA' || faction === 'VOID_CULT';
  const isNeutral = faction.includes('NEUTRAL');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden animate-[slideInUp_0.3s_ease-out]">
        
        {/* Header */}
        <div className="bg-zinc-800/80 p-4 border-b border-zinc-700/50 flex justify-between items-center relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10">
             <Skull className="w-24 h-24" />
          </div>
          <h2 className="text-lg font-black text-white tracking-wide flex items-center gap-2 relative z-10">
            <Skull className="w-5 h-5 text-zinc-400" />
            MƏZAR DAŞI
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors relative z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-6">
          <div className="text-center">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Mərhum Oyunçu</div>
            <div className="text-2xl font-black text-white">{deadPlayer.username}</div>
          </div>

          <div className="flex flex-col items-center p-4 rounded-xl bg-zinc-950/50 border border-zinc-800">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Əsl Rolu İfşa Edildi</div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${isMafia ? 'bg-red-500/20 text-red-400 border border-red-500/30' : isNeutral ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
              {isMafia ? <Target className="w-4 h-4" /> : isNeutral ? <Skull className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              {deadPlayer.displayRole.localizedRoleName || deadPlayer.displayRole.originalRoleName}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold text-amber-500/70 uppercase tracking-wider flex items-center gap-1.5">
              <Scroll className="w-4 h-4" />
              Son Vəsiyyət
            </div>
            {lastWill ? (
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/30 text-amber-200/90 text-sm italic leading-relaxed" style={{ fontFamily: 'Georgia, serif' }}>
                "{lastWill}"
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 text-zinc-600 text-sm italic text-center">
                Mərhum heç bir vəsiyyət qoymayıb.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
