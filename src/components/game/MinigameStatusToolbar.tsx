'use client';

import React, { useState } from 'react';
import {
  Flame,
  Clock,
  Briefcase,
  Shield,
  Biohazard,
  Info,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { MinigameSubStates } from '../../types/minigames';
import { PlayerSession } from '../../types/game';
import { ScrubbedPlayerView } from '../../types/engine';
import { AZ_DANTE_CIRCLES, AZ_UI } from '../../config/i18n/az';
import { playCard } from '../../utils/sfx';

export interface MinigameStatusToolbarProps {
  readonly minigames: MinigameSubStates;
  readonly players: Readonly<Record<string, PlayerSession | ScrubbedPlayerView>>;
  readonly currentUserId: string;
  readonly onTriggerKlaatuFreeze?: () => void;
  readonly onShelterChernobyl?: () => void;
}

export const MinigameStatusToolbar: React.FC<MinigameStatusToolbarProps> = ({
  minigames,
  players,
  currentUserId,
  onTriggerKlaatuFreeze,
  onShelterChernobyl,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const { dante, earth, valkyrie, prison, catenaccio, chernobyl } = {
    dante: minigames.dantesInferno,
    earth: minigames.earthStoodStill,
    valkyrie: minigames.valkyrie,
    prison: minigames.stanfordPrison,
    catenaccio: minigames.catenaccio,
    chernobyl: minigames.chernobyl,
  };

  const hasAnyMinigame = Boolean(dante || earth || valkyrie || prison || catenaccio || chernobyl);
  if (!hasAnyMinigame) return null;

  // Chernobyl data
  const myDosage = chernobyl?.radiationDosage?.[currentUserId] ?? 0;
  const lethalThreshold = chernobyl?.lethalThreshold ?? 100;
  const isSheltered = Boolean(chernobyl?.shelteredPlayerIds?.includes(currentUserId));
  const bunkerOccupants = chernobyl?.shelteredPlayerIds?.length ?? 0;
  const bunkerCapacity = chernobyl?.bunkerCapacity ?? 5;
  const bunkerHasSpace = bunkerOccupants < bunkerCapacity;

  // Valkyrie holder
  const valkyrieHolder = valkyrie?.briefcaseLocationPlayerId
    ? players[valkyrie.briefcaseLocationPlayerId]?.username ?? valkyrie.briefcaseLocationPlayerId
    : null;

  return (
    <div className="flex flex-col gap-2 w-full transition-all duration-300">
      {/* ─── COMPACT HORIZONTAL STATUS CHIP DOCK ────────────────────── */}
      <div className="flex items-center justify-between gap-2 p-2 sm:p-2.5 rounded-2xl bg-zinc-950/85 backdrop-blur-xl border border-zinc-800/90 shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {/* 1. CHERNOBYL EXCLUSION ZONE CHIP */}
          {chernobyl && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
                chernobyl.zoneContaminationLevel >= 80
                  ? 'bg-red-950/60 text-red-300 border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                  : chernobyl.zoneContaminationLevel >= 50
                  ? 'bg-amber-950/60 text-amber-300 border-amber-500/50'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
              }`}
            >
              <Biohazard className="w-3.5 h-3.5 shrink-0 animate-pulse text-amber-400" />
              <span>Çernobıl: {chernobyl.zoneContaminationLevel} mSv</span>
              <span className="opacity-50">|</span>
              <span className={myDosage >= 80 ? 'text-red-400 font-extrabold animate-pulse' : ''}>
                Dozanız: {myDosage}/{lethalThreshold} mSv
              </span>
              <span className="opacity-50">|</span>
              <span>
                Bunker: {bunkerOccupants}/{bunkerCapacity}
              </span>

              {/* Shelter Button */}
              {!isSheltered && bunkerHasSpace && onShelterChernobyl && (
                <button
                  type="button"
                  onClick={() => {
                    playCard();
                    onShelterChernobyl();
                  }}
                  className="ml-1 px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-[10px] uppercase tracking-wider transition-transform active:scale-95 cursor-pointer shadow-sm"
                >
                  Sığınacağa Gir
                </button>
              )}
              {isSheltered && (
                <span className="ml-1 px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/40">
                  🛡️ Bunkerdəsiniz
                </span>
              )}
            </div>
          )}

          {/* 2. DOOMSDAY CLOCK (Earth Stood Still) CHIP */}
          {earth && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                earth.doomsdayClockHours >= 10
                  ? 'bg-red-950/60 text-red-300 border-red-500/50 animate-pulse'
                  : 'bg-blue-950/60 text-blue-300 border-blue-500/40'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0 text-blue-400" />
              <span>Qiyamət Saatı: {earth.doomsdayClockHours}/12 Saat</span>
              {earth.doomsdayClockHours >= 12 && (
                <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.2 rounded font-black">
                  PLANETAR MƏHV
                </span>
              )}

              {!earth.worldFrozenUsed && onTriggerKlaatuFreeze && (
                <button
                  type="button"
                  onClick={() => {
                    playCard();
                    onTriggerKlaatuFreeze();
                  }}
                  className="ml-1 px-2 py-0.5 rounded-md bg-blue-500 hover:bg-blue-400 text-white font-black text-[10px] uppercase tracking-wider transition-transform active:scale-95 cursor-pointer shadow-sm"
                >
                  Dondur
                </button>
              )}
            </div>
          )}

          {/* 3. OPERATION VALKYRIE CHIP */}
          {valkyrie && valkyrie.briefcaseLocationPlayerId && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                valkyrie.briefcaseDetonated
                  ? 'bg-red-950/70 text-red-300 border-red-500'
                  : 'bg-amber-950/60 text-amber-300 border-amber-500/40'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Valkiriya: {valkyrieHolder}</span>
              <span className="opacity-50">|</span>
              <span className="font-mono">
                {valkyrie.briefcaseDetonated ? '💥 PARTLADI' : `${valkyrie.fuseTimerDaysRemaining} Gün`}
              </span>
            </div>
          )}

          {/* 4. STANFORD PRISON CHIP */}
          {prison && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                prison.revoltMeter >= 75
                  ? 'bg-red-950/60 text-red-300 border-red-500/50'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-700'
              }`}
            >
              <span className="text-zinc-400">⛓️ Qiyam Riski:</span>
              <div className="w-10 h-2 bg-zinc-800 rounded-full overflow-hidden shrink-0">
                <div
                  className={`h-full ${prison.revoltMeter >= 75 ? 'bg-red-500' : 'bg-amber-500'}`}
                  style={{ width: `${prison.revoltMeter}%` }}
                />
              </div>
              <span>{prison.revoltMeter}%</span>
              {prison.riotTriggered && (
                <span className="text-[10px] bg-red-600 text-white px-1 py-0.2 rounded font-black">
                  QİYAM
                </span>
              )}
            </div>
          )}

          {/* 5. DANTE'S INFERNO CHIP */}
          {dante && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border bg-red-950/40 text-red-300 border-red-500/40">
              <Flame className="w-3.5 h-3.5 shrink-0 text-red-500" />
              <span>
                Dante: {AZ_DANTE_CIRCLES[dante.currentCircle]?.name ?? dante.currentCircle}
              </span>
              <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.2 rounded font-bold">
                {dante.completedCircles.length + 1}/9
              </span>
            </div>
          )}

          {/* 6. CATENACCIO CHIP */}
          {catenaccio && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border bg-zinc-900 text-zinc-300 border-zinc-700">
              <Shield className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span>Sədd: {catenaccio.defensiveWallPlayerIds.length} Qalxan</span>
              {catenaccio.wallBreached ? (
                <span className="text-[10px] bg-red-500/20 text-red-400 px-1 py-0.2 rounded font-black">
                  YARILDI
                </span>
              ) : (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded font-bold">
                  BÖLÜNMƏZ
                </span>
              )}
            </div>
          )}
        </div>

        {/* Expand / Collapse Rules Toggle */}
        <button
          type="button"
          onClick={() => {
            playCard();
            setIsExpanded((prev) => !prev);
          }}
          className="px-2 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700/60 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          title="Mini-oyun qaydaları və ətraflı məlumat"
        >
          <Info className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Qaydalar</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ─── EXPANDABLE FULL RULES & TELEMETRY ACCORDION ─────────────── */}
      {isExpanded && (
        <div className="p-4 rounded-2xl bg-zinc-950/95 border border-zinc-800/80 shadow-2xl flex flex-col gap-3 text-xs animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
            <span>Aktiv Mini-Oyun Təlimatları</span>
            <span>TDV Mafia Battleground Engine</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {chernobyl && (
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-amber-500/30 flex flex-col gap-1.5">
                <span className="font-black text-amber-300 flex items-center gap-1.5">
                  <Biohazard className="w-4 h-4 text-amber-400" />
                  Çernobıl Təcrid Zonası
                </span>
                <p className="text-zinc-400 leading-relaxed">
                  Hər raund şəhərə {chernobyl.zoneContaminationLevel} mSv radiasiya sızır. 100 mSv-ə çatan vətəndaş
                  həlak olur. Bunker {chernobyl.bunkerCapacity} nəfər tutur və radiasiyadan tam qoruyur.
                </p>
                <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-300 pt-1">
                  <span>Şəxsi Dozanız: {myDosage} mSv</span>
                  <span>•</span>
                  <span>Ölümcül Hədd: {lethalThreshold} mSv</span>
                </div>
              </div>
            )}

            {earth && (
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-blue-500/30 flex flex-col gap-1.5">
                <span className="font-black text-blue-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-400" />
                  Qiyamət Saatı (The Day The Earth Stood Still)
                </span>
                <p className="text-zinc-400 leading-relaxed">
                  Məhkəmədə edam edilən hər günahsız vətəndaş üçün saat 1 pillə irəliləyir. 12-ci saatda yadplanetli
                  Qort şəhəri planetar olaraq məhv edir.
                </p>
              </div>
            )}

            {valkyrie && (
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-amber-500/30 flex flex-col gap-1.5">
                <span className="font-black text-amber-300 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-amber-400" />
                  Valkiriya Əməliyyatı
                </span>
                <p className="text-zinc-400 leading-relaxed">
                  Qara çanta hər gecə ötürülür. Müddət başa çatdıqda çanta partlayır və daşıyıcı ilə yanaşı
                  qonşuları aradan qaldırır.
                </p>
              </div>
            )}

            {prison && (
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-700/60 flex flex-col gap-1.5">
                <span className="font-black text-zinc-200 flex items-center gap-1.5">
                  <span>⛓️</span>
                  Stanford Həbsxana Eksperimenti
                </span>
                <p className="text-zinc-400 leading-relaxed">
                  Hər ədalətsiz edam və ya sərt cəza qiyam riskini artırır. Qiyam sayğacı 100%-ə çatdıqda dustaqlar
                  nəzarəti ələ keçirir.
                </p>
              </div>
            )}

            {dante && (
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-red-500/30 flex flex-col gap-1.5">
                <span className="font-black text-red-300 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-red-500" />
                  Dante Cəhənnəmi (9 Dairə)
                </span>
                <p className="text-zinc-400 leading-relaxed">
                  {AZ_DANTE_CIRCLES[dante.currentCircle]?.rule ?? 'Cəhənnəm qanunları qüvvədədir.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
