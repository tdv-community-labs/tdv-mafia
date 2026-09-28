'use client';

import React from 'react';
import { Newspaper, X, Skull, AlertTriangle, Flame, Clock, Search, Mail, Shield, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MorningNewspaper, InvestigationResult } from '../../types/engine';
import { MinigameSubStates } from '../../types/minigames';
import { AZ_DEATH_CAUSES, AZ_UI, AZ_DANTE_CIRCLES } from '../../config/i18n/az';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getTheme } from '../../config/themes.config';

export interface MorningNewspaperModalProps {
  readonly isOpen: boolean;
  readonly newspaper: MorningNewspaper | null;
  readonly roundNumber: number;
  readonly minigameSubStates?: MinigameSubStates;
  readonly lastLynchedPlayerName?: string | null;
  readonly playerNames?: Record<string, string>;
  readonly privateInvestigations?: readonly InvestigationResult[];
  readonly onClose: () => void;
  readonly isAllIn?: boolean;
  readonly hasMutinyOccurred?: boolean;
  readonly packId?: string;
  /** Last Will messages from dead players (keyed by userId), read from localStorage */
  readonly lastWills?: Record<string, string>;
}

const MorningNewspaperModalComponent: React.FC<MorningNewspaperModalProps> = ({
  isOpen,
  newspaper,
  roundNumber,
  minigameSubStates,
  lastLynchedPlayerName,
  playerNames = {},
  privateInvestigations = [],
  onClose,
  isAllIn = false,
  packId = '',
  hasMutinyOccurred = false,
  lastWills = {},
}) => {
  if (!isOpen || !newspaper) return null;

  const theme = getTheme(packId);

  const dante = minigameSubStates?.dantesInferno;
  const earth = minigameSubStates?.earthStoodStill;
  const valkyrie = minigameSubStates?.valkyrie;
  const prison = minigameSubStates?.stanfordPrison;
  const catenaccio = minigameSubStates?.catenaccio;

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/80  flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-4xl p-6 sm:p-10 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto relative ${isAllIn ? 'bg-zinc-950/95 border-2 border-cyan-500/50 ring-4 ring-cyan-500/20 text-cyan-50 font-mono rounded-[8px]' : theme.newspaperContainer}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Newspaper Masthead */}
        <div className={`py-6 text-center mb-4 flex flex-col gap-2 ${isAllIn ? 'border-y-2 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : theme.newspaperMasthead}`}>
          <div className="text-[11px] tracking-widest uppercase text-stone-600 dark:text-stone-400 font-sans font-bold">
            TDV MAFIA • Səhər Xüsusi Buraxılışı
          </div>
          <h1 className="text-5xl sm:text-6xl font-black uppercase tracking-tighter my-2 text-zinc-900 dark:text-zinc-100 font-serif">
            {AZ_UI.morningBulletin}
          </h1>
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-500/20 pt-3 mt-2 font-mono uppercase tabular-nums font-bold tracking-widest">
            <span>Raund #{roundNumber}</span>
            <span>Gecə Əməliyyatlarının Nəticələri</span>
            <span>Jitter: {(newspaper.jitterAppliedMs / 1000).toFixed(1)}s</span>
          </div>
        </div>

        {/* Yesterday's Lynch Headline */}
        {lastLynchedPlayerName && (
          <div className="p-4 rounded-[8px] border border-rose-300 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 font-sans">
            <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 mb-1">
              Məhkəmə İttihamı Nəticəsi
            </div>
            <div className="text-sm text-stone-800 dark:text-stone-200">
              Vətəndaşların səs çoxluğu ilə ittiham olunan{' '}
              <strong className="text-rose-600 dark:text-rose-400">{lastLynchedPlayerName}</strong>{' '}
              edam edildi.
            </div>
          </div>
        )}

        {/* Saved Victims Section */}
        {newspaper.protectedIds && newspaper.protectedIds.length > 0 && (
          <div className="mb-6 font-sans">
            <div className="flex items-center gap-2 border-b border-emerald-300/50 dark:border-emerald-800/50 pb-2 mb-3">
              <Shield className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-extrabold uppercase tracking-wide text-emerald-800 dark:text-emerald-500">
                Gecə İnsidentləri
              </h2>
            </div>
            <div className="flex flex-col gap-2">
              {newspaper.protectedIds.map((id, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-emerald-200 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                    <Heart className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  </div>
                  <div className="text-sm text-emerald-900 dark:text-emerald-300 leading-relaxed">
                    <strong className="font-bold">{playerNames[id] || 'Kimsə'}</strong> gecə amansız hücuma məruz qaldı, lakin son anda <span className="font-bold underline decoration-emerald-500/50 underline-offset-2">Mühafizəçi</span> tərəfindən ölümdən xilas edildi!
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Night Casualties Section */}
        <div className="font-sans">
          <div className="flex items-center gap-2 border-b border-stone-300 dark:border-stone-800 pb-2 mb-3">
            <Skull className="w-5 h-5 text-rose-600" />
            <h2 className="text-base font-extrabold uppercase tracking-wide text-stone-900 dark:text-stone-100">
              {AZ_UI.newspaperHeadlineDeaths} ({newspaper.publicDeaths.length})
            </h2>
          </div>

          {newspaper.publicDeaths.length === 0 ? (
            <p className="text-sm italic text-stone-600 dark:text-stone-400 py-2">
              {AZ_UI.newspaperNoDeaths} Şəhər bu gecə sakit qaldı.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {newspaper.publicDeaths.map((death) => {
                const lastWill = lastWills[death.victimPlayerId] ?? newspaper.lastWills?.[death.victimPlayerId];
                return (
                  <div
                    key={death.victimPlayerId}
                    className="p-3.5 rounded-[8px] border-l-4 border-l-rose-600 border border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-stone-950/50 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                        Qurban: {playerNames[death.victimPlayerId] ?? death.victimPlayerId}
                      </span>
                      <Badge tone="red">{AZ_DEATH_CAUSES[death.cause] ?? death.cause}</Badge>
                    </div>

                    {death.isCleaned ? (
                      <div className="text-xs text-rose-600 dark:text-rose-400 italic bg-rose-500/10 p-1.5 rounded">
                        {AZ_UI.cleanedBodyDescription}
                      </div>
                    ) : (
                      <div className="text-xs text-stone-600 dark:text-stone-400">
                        Ölüm Səbəbi: {AZ_DEATH_CAUSES[death.cause] ?? death.cause}
                        {death.killerFaction && ` (${death.killerFaction})`}
                      </div>
                    )}

                    {/* Son Vasiyət — Last Will */}
                    {lastWill && (
                      <div className="mt-2 p-2.5 rounded-md border border-amber-300/60 dark:border-amber-700/50 bg-amber-50/80 dark:bg-amber-950/30 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">
                          <Mail className="w-3 h-3 shrink-0" />
                          Son Vasiyət
                        </div>
                        <p className="text-xs italic text-amber-900 dark:text-amber-200 leading-relaxed">
                          &ldquo;{lastWill}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Private Investigation Results for the Investigator */}
        {privateInvestigations.length > 0 && (
          <div className="p-4 rounded-[8px] border border-blue-400/50 dark:border-blue-700/60 bg-blue-50/90 dark:bg-blue-950/40 font-sans flex flex-col gap-2.5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-black text-blue-900 dark:text-blue-300 uppercase tracking-wider">
              <Search className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Şəxsi Gecə İstintaq Nəticəniz (Yalnız Sizə Görünür)</span>
            </div>
            {privateInvestigations.map((inv, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800/80 flex items-center justify-between gap-3 text-xs sm:text-sm"
              >
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">Şübhəli Hədəf:</span>{' '}
                  <strong className="text-zinc-900 dark:text-zinc-100 font-bold">
                    {playerNames[inv.targetPlayerId] ?? inv.targetPlayerId}
                  </strong>
                </div>
                <Badge tone={inv.revealedFaction === 'MAFIA' ? 'red' : 'emerald'}>
                  {inv.revealedFaction === 'MAFIA' ? 'MAFİYA ŞÜBHƏLİSİ' : 'MƏSUM VƏTƏNDAŞ'}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Heresy Clue Leaked */}
        {newspaper.heresyClue && (
          <div className="p-4 rounded-[8px] border border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 font-sans">
            <div className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 mb-1">
              {AZ_UI.heresyLeakedHeader}
            </div>
            <p className="text-sm italic text-purple-900 dark:text-purple-200">
              {newspaper.heresyClue}
            </p>
          </div>
        )}

        {/* Syndicate Internal Tension Alert */}
        {hasMutinyOccurred && (
          <div className="p-4 rounded-[8px] border border-orange-400/60 dark:border-orange-600/50 bg-gradient-to-r from-orange-50 dark:from-orange-950/30 to-amber-50 dark:to-amber-950/20 font-sans">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg">⚡</span>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-orange-700 dark:text-orange-400">
                Xüsusi Kəşfiyyat Xəbəri
              </div>
            </div>
            <div className="text-sm font-bold text-orange-900 dark:text-orange-200">
              Gecə ərzində şəhərin alt dünyasında daxili bir ixtilaf qeydə alındı.
            </div>
            <div className="text-xs text-orange-700 dark:text-orange-300 mt-1 opacity-80 italic">
              Mənbə məxfi saxlanılır. Kəşfiyyatçılar yuxarı idarəyə hesabat verdi.
            </div>
          </div>
        )}

        {/* Minigame Event Announcements */}
        {dante && (
          <div className="p-3.5 rounded-[8px] border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/20 font-sans">
            <div className="text-xs font-bold text-red-700 dark:text-red-400">
              Dante Cəhənnəmi: {AZ_DANTE_CIRCLES[dante.currentCircle]?.name ?? dante.currentCircle}
            </div>
            <div className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
              {AZ_DANTE_CIRCLES[dante.currentCircle]?.rule}
            </div>
          </div>
        )}

        {/* Footer Dismiss Button */}
        <div className="pt-2 font-sans">
          <Button variant="secondary" size="md" onClick={onClose} fullWidth>
            Oxundu &amp; Məhkəməyə Qayıt
          </Button>
        </div>
      </div>
    </div>
  );
};

export const MorningNewspaperModal = React.memo(MorningNewspaperModalComponent, (prev, next) => {
  return prev.isOpen === next.isOpen && prev.lastLynchedPlayerName === next.lastLynchedPlayerName && prev.newspaper?.roundNumber === next.newspaper?.roundNumber;
});
