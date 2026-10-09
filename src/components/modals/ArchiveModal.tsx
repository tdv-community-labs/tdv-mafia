'use client';

import React from 'react';
import { BookOpen, X, Skull, AlertTriangle } from 'lucide-react';
import { MorningNewspaper } from '../../types/engine';
import { AZ_DEATH_CAUSES } from '../../config/i18n/az';

interface ArchiveModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly pastNewspapers: readonly MorningNewspaper[];
  readonly playerNames: Record<string, string>;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({ isOpen, onClose, pastNewspapers, playerNames }) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 animate-fadeIn">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-black text-white">Qəzet Arxivi (Oyun Tarixçəsi)</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-8">
          {pastNewspapers.length === 0 ? (
            <div className="text-center text-zinc-500 py-10 italic">Hələ ki heç bir hadisə baş verməyib.</div>
          ) : (
            pastNewspapers.map((np, idx) => (
              <div key={idx} className="relative pl-6 border-l-2 border-zinc-800">
                <div className="absolute w-4 h-4 rounded-full bg-zinc-900 border-2 border-amber-500 -left-[9px] top-0" />
                <h3 className="text-lg font-bold text-amber-400 mb-3 -mt-1">
                  Raund {np.roundNumber} - {np.headline}
                </h3>
                
                {np.publicDeaths.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {np.publicDeaths.map((cas, i) => (
                      <div key={i} className="p-4 rounded-xl border border-red-500/20 bg-red-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-red-900/50 flex items-center justify-center shrink-0">
                            <Skull className="w-5 h-5 text-red-400" />
                          </div>
                          <div>
                            <div className="font-bold text-red-100 text-sm sm:text-base">
                              {playerNames[cas.victimPlayerId] || cas.victimPlayerId}
                            </div>
                            <div className="text-xs text-red-400/80 uppercase font-bold tracking-wider mt-0.5">
                              {AZ_DEATH_CAUSES[cas.cause]}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-900/50 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="font-bold text-emerald-100 text-sm">
                      Bu gecə şəhərdə heç kim ölmədi. Sükut hökm sürür.
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
