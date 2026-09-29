'use client';

import React, { useState } from 'react';
import { Settings, Play, Pause, Search, Sliders, Shield, Terminal } from 'lucide-react';
import { GamePhase, LobbyState } from '../../types/game';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { AZ_PHASES } from '../../config/i18n/az';

export interface ArchitectConsoleProps {
  readonly lobbyState: LobbyState;
  readonly isTimerPaused?: boolean;
  readonly onOverridePhase: (phase: GamePhase, durationSeconds: number) => void;
  readonly onToggleTimerPause?: () => void;
  readonly onConfigureJitter?: (jitterSeconds: number) => void;
}

const PHASES_LIST: readonly GamePhase[] = [
  'DAY_REGIONAL_CAUCUS',
  'DAY_CENTRAL_ASSEMBLY',
  'DAY_VOTING',
  'NIGHT_BUFFER',
  'ENDED',
];

export const ArchitectConsole: React.FC<ArchitectConsoleProps> = ({
  lobbyState,
  isTimerPaused = false,
  onOverridePhase,
  onToggleTimerPause,
  onConfigureJitter,
}) => {
  const [selectedPhase, setSelectedPhase] = useState<GamePhase>('DAY_CENTRAL_ASSEMBLY');
  const [durationSec, setDurationSec] = useState<number>(300);
  const [jitterSec, setJitterSec] = useState<number>(lobbyState.nightJitterDelaySeconds);
  const [showSnapshot, setShowSnapshot] = useState<boolean>(false);

  return (
    <div className="p-5 sm:p-6 rounded-[16px] border border-amber-500/30 bg-zinc-950 text-zinc-300 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] flex flex-col gap-4 transition-colors duration-200 font-mono tabular-nums tracking-tight">
      {/* Console Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-5 h-5 text-amber-500" />
            <h3 className="font-extrabold text-base text-white font-mono uppercase tracking-widest tabular-nums tracking-tight">
              Memar Konsolu (The Architect Console)
            </h3>
            <Badge tone="amber">Platform Admin</Badge>
          </div>
          <p className="text-xs text-zinc-400 font-mono text-[10px] uppercase tabular-nums">
            Mərhələlərin səlahiyyətli dəyişdirilməsi, taymer idarəsi və sistem snapshot tənzimləmələri.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onToggleTimerPause && (
            <Button
              variant={isTimerPaused ? 'primary' : 'warning'}
              size="sm" className="btn-spring font-mono tracking-wider tabular-nums"
              onClick={onToggleTimerPause}
              icon={isTimerPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            >
              {isTimerPaused ? 'Davam Etdir' : 'Pauza'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm" className="btn-spring font-mono tracking-wider tabular-nums"
            onClick={() => setShowSnapshot(!showSnapshot)}
            icon={<Terminal className="w-3.5 h-3.5" />}
          >
            {showSnapshot ? 'Gizlət' : 'Snapshot'}
          </Button>
        </div>
      </div>

      {/* Phase Override Controls */}
      <div className="p-2.5 rounded-[8px] border border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20 backdrop-blur-md flex flex-col gap-3 min-h-[44px]">
        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider tabular-nums tracking-tight">
          Mərhələni Müstəqil Dəyişdir (Phase Override)
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedPhase}
            onChange={(e) => setSelectedPhase(e.target.value as GamePhase)}
            className="p-2.5 rounded-[8px] border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-100 font-mono uppercase tracking-wide text-xs focus:ring-1 focus:ring-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 cursor-pointer min-h-[44px] tabular-nums tracking-tight"
          >
            {PHASES_LIST.map((p) => (
              <option key={p} value={p}>
                {AZ_PHASES[p]} ({p})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-mono text-[10px] uppercase tabular-nums">Müddət:</span>
            <input
              type="number"
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
              className="w-20 px-2.5 py-1.5 rounded-[8px] border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-100 font-mono uppercase tracking-wide text-xs focus:ring-1 focus:ring-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 min-h-[44px] tabular-nums tracking-tight"
            />
            <span className="text-xs text-zinc-400 font-mono text-[10px] uppercase tabular-nums">san</span>
          </div>

          <Button
            variant="primary"
            size="sm" className="btn-spring font-mono tracking-wider tabular-nums"
            onClick={() => onOverridePhase(selectedPhase, durationSec)}
          >
            Dərhal Tətbiq Et
          </Button>
        </div>
      </div>

      {/* Jitter Delay Configuration */}
      {onConfigureJitter && (
        <div className="p-2.5 rounded-[8px] border border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20 backdrop-blur-md flex flex-col gap-2 min-h-[44px]">
          <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider tabular-nums tracking-tight">
            Gecə Anti-Deduksiya Jitter Tənzimləməsi (3–7 saniyə)
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="range"
              min={3}
              max={7}
              step={1}
              value={jitterSec}
              onChange={(e) => {
                const val = Number(e.target.value);
                setJitterSec(val);
                onConfigureJitter(val);
              }}
              className="w-44 accent-amber-500 cursor-pointer"
            />
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums tracking-tight">
              {jitterSec} saniyə
            </span>
            <span className="text-[11px] text-zinc-400 font-mono text-[10px] uppercase tabular-nums">
              (AI botları ilə insan oyunçuların reaksiya vaxtını maskalayır)
            </span>
          </div>
        </div>
      )}

      {/* State Snapshot Inspector */}
      {showSnapshot && (
        <div className="p-2.5 rounded-[8px] border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 font-mono text-xs max-h-60 overflow-y-auto min-h-[44px] tabular-nums tracking-tight">
          <div className="text-[10px] text-zinc-400 font-mono text-[10px] uppercase tabular-nums uppercase tracking-wider mb-2 font-bold">
            Canlı Otaq Vəziyyəti JSON
          </div>
          <pre className="text-blue-600 dark:text-blue-400 text-xs tabular-nums tracking-tight">
            {JSON.stringify(
              {
                lobbyId: lobbyState.lobbyId,
                phase: lobbyState.phase,
                roundNumber: lobbyState.roundNumber,
                playersCount: Object.keys(lobbyState.players).length,
                liveVotes: lobbyState.liveVotes,
                bufferedNightActionsCount: lobbyState.bufferedNightActions.length,
                adminUnlock: lobbyState.adminMasterUnlock,
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
};
