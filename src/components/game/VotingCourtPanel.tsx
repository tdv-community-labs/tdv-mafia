'use client';

import React from 'react';
import { Gavel, AlertCircle,
  Scale, EyeOff, Users, ArrowRight } from 'lucide-react';
import { LobbyState, PlayerSession } from '../../types/game';
import { AllInDistrict } from '../../types/roles';
import { AZ_DISTRICTS, AZ_UI } from '../../config/i18n/az';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getTheme } from '../../config/themes.config';
import { motion, AnimatePresence } from 'framer-motion';

export interface VotingCourtPanelProps {
  readonly lobbyState: LobbyState;
  readonly currentUserId: string;
  readonly selectedCandidateId: string | null;
  readonly districtFinalists?: readonly string[];
  readonly onCastVote: (candidateId: string) => void;
  readonly onRetractVote: () => void;
  readonly onSkipVote?: () => void;
  readonly voteCounts?: Record<string, number>;
  readonly canSeeVotes?: boolean;
}

export const VotingCourtPanel: React.FC<VotingCourtPanelProps> = ({
  lobbyState,
  currentUserId,
  selectedCandidateId,
  districtFinalists = [],
  onCastVote,
  onRetractVote,
  onSkipVote,
  voteCounts = {},
  canSeeVotes = true,
}) => {
  const dante = lobbyState.minigameSubStates.dantesInferno;
  const isWrath = dante?.wrathNoAbstainEnforced === true;
  const isTreacheryBlind = dante?.treacherySecretVotingActive === true;
  const isAllIn = lobbyState.mode === 'ALL_IN';
  const theme = getTheme(lobbyState.mode);

  const currentUser = lobbyState.players[currentUserId];
  const isAlive = currentUser?.isAlive ?? false;
  const currentVotedCandidateId = lobbyState.liveVotes[currentUserId];

  const alivePlayers = Object.values(lobbyState.players).filter((p) => p.isAlive);
  const majorityThreshold = Math.floor(alivePlayers.length / 2) + 1;
  const topSuspects = React.useMemo(() => {
    return Object.entries(voteCounts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => ({ id, count, player: lobbyState.players[id] }));
  }, [voteCounts, lobbyState.players]);


  return (
    <div className={`p-4 sm:p-6 flex flex-col gap-4 transition-colors duration-200 ${isAllIn ? 'bg-zinc-950 border border-red-500/30 rounded-[12px] shadow-[0_0_30px_rgba(239,68,68,0.1)] relative overflow-hidden ring-1 ring-red-500/10' : theme.courtContainer}`}>
      {/* Court Header */}
      {isAllIn && <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none" />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${isAllIn ? 'rounded-full bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.6)] text-white' : theme.courtGavel}`}>
            <Gavel className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
              {isAllIn ? AZ_UI.districtPlebiscite : AZ_UI.currentPhase}
            </span>
            <h3 className={`font-extrabold leading-tight ${isAllIn ? 'text-2xl text-red-500 tracking-widest uppercase font-mono drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]' : theme.courtTitle}`}>
              {AZ_UI.accuse} & {AZ_UI.vote} Məclisi
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone="neutral">
            Tələb: {majorityThreshold} / {alivePlayers.length} səs
          </Badge>

          {isWrath && (
            <Badge tone="red">
              {AZ_UI.mandatoryVoting} (V Dairə)
            </Badge>
          )}

          {isTreacheryBlind && (
            <Badge tone="purple" icon={<EyeOff className="w-3 h-3" />}>
              {AZ_UI.blindVoting} (IX Dairə)
            </Badge>
          )}
        </div>
      </div>

      {/* Dante Special Mode Notices */}
      {isWrath && (
        <div className="p-3.5 rounded-[8px] border border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>
            <strong>Dantenin V Dairəsi (Qəzəb):</strong> Bitərəf qalmaq qadağandır! Hər bir canlı vətəndaş hökm verməlidir.
          </span>
        </div>
      )}

      {isTreacheryBlind && (
        <div className="p-3.5 rounded-[8px] border border-purple-500/30 bg-purple-500/10 text-purple-800 dark:text-purple-300 text-xs flex items-center gap-2">
          <EyeOff className="w-4 h-4 shrink-0 text-purple-600" />
          <span>
            <strong>Dantenin IX Dairəsi (Xəyanət / Kokit):</strong> {AZ_UI.blindVotingDesc}
          </span>
        </div>
      )}

      {/* All-In District Finalists */}
      {isAllIn && districtFinalists.length > 0 && (
        <div className="p-4 rounded-[8px] border border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/20">
          <div className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-2">
            {AZ_UI.districtFinalists} (3 Kvartal Finalisti)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {districtFinalists.map((finalistId, index) => {
              const p = lobbyState.players[finalistId];
              const distName = p?.currentDistrict
                ? AZ_DISTRICTS[p.currentDistrict]
                : `Rayon #${index + 1}`;
              return (
                <div
                  key={finalistId}
                  className="p-3 rounded-xl border border-blue-500/20 bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md border-l-4 border-l-blue-500 shadow-md transition-transform hover:scale-105"
                >
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">{distName}</div>
                  <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {p?.username ?? finalistId}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      
      {/* Dynamic Top Suspects Leaderboard */}

      {canSeeVotes && topSuspects.length > 0 && !isTreacheryBlind && (
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/5 bg-white/50 dark:bg-zinc-950/30 backdrop-blur-md shadow-inner">
          <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Scale className="w-3 h-3 text-red-500" />
            Cari Məhkəmə Liderləri (Ən çox səs toplayanlar)
          </div>
          <div className="flex flex-col gap-2">
            {topSuspects.map((suspect, idx) => {
              const percentage = Math.min(100, (suspect.count / majorityThreshold) * 100);
              const isDanger = suspect.count >= majorityThreshold - 1;
              
              // Find who voted for this suspect
              const voters = Object.entries(lobbyState.liveVotes || {})
                .filter(([voterId, targetId]) => targetId === suspect.id)
                .map(([voterId]) => lobbyState.players[voterId]);
              
              return (
                <div key={suspect.id} className="flex flex-col gap-1.5 relative">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <span className="text-zinc-400 font-mono text-xs">#{idx + 1}</span>
                      {suspect.player?.username ?? suspect.id}
                    </span>
                    <div className="flex items-center gap-3">
                      {/* Voters Avatars */}
                      {voters.length > 0 && (
                        <div className="flex -space-x-2">
                          {voters.slice(0, 5).map(v => (
                            <div key={v.userId} title={v.username} className="w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-800 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[8px] font-bold text-zinc-600 dark:text-zinc-300 shadow-sm z-10 hover:z-20 relative hover:scale-125 transition-transform">
                              {v.username.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {voters.length > 5 && (
                            <div className="w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-800 bg-zinc-300 dark:bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-600 dark:text-zinc-400 shadow-sm z-10">
                              +{voters.length - 5}
                            </div>
                          )}
                        </div>
                      )}
                      <span className={`font-black font-mono ${isDanger ? 'text-red-500 animate-pulse' : 'text-zinc-500'}`}>
                        {suspect.count} / {majorityThreshold}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ease-out ${isDanger ? 'bg-red-500' : 'bg-zinc-500'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Selection & Action Controls */}
      <div className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 ${isAllIn ? 'rounded-none border-l-4 border-l-red-500 bg-zinc-900 border-y border-r border-zinc-800' : theme.courtActiveBox}`}>
        <div>
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isAllIn ? 'text-red-400 font-mono tracking-widest' : 'text-zinc-500 dark:text-zinc-400'}`}>
            Seçilmiş İttiham Hədəfi:
          </span>
          <div className={`font-extrabold ${isAllIn ? 'text-2xl text-white font-mono tracking-wider' : 'text-sm text-zinc-900 dark:text-zinc-100'}`}>
            {selectedCandidateId
              ? lobbyState.players[selectedCandidateId]?.username ?? selectedCandidateId
              : 'Heç bir oyunçu seçilməyib (kartlardan birinə toxunun)'}
          </div>
          {currentVotedCandidateId && (
            <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
              Sizin cari səsiniz:{' '}
              {lobbyState.players[currentVotedCandidateId]?.username ??
                currentVotedCandidateId}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {currentVotedCandidateId && (
            <button
              className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
              onClick={onRetractVote} disabled={!isAlive}
            >
              {AZ_UI.retractVote}
            </button>
          )}

          {!isWrath && onSkipVote && (
            <button
              className="px-6 py-2.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white border-2 border-zinc-300 dark:border-zinc-700 font-black uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
              onClick={onSkipVote} disabled={!isAlive}
            >
              {AZ_UI.skipOrAbstain}
            </button>
          )}

          <button
            className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest rounded-xl shadow-[0_4px_14px_0_rgba(220,38,38,0.39)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none"
            disabled={
              !isAlive || !selectedCandidateId || currentVotedCandidateId === selectedCandidateId
            }
            onClick={() => selectedCandidateId && onCastVote(selectedCandidateId)}
          >
            {AZ_UI.vote}
          </button>
        </div>
      </div>
    </div>
  );
};
