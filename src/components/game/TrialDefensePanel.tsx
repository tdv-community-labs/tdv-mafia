'use client';

import React from 'react';
import { Gavel, Shield, Crown, AlertTriangle, Clock, Check, X, Scale, UserCheck, Mic } from 'lucide-react';
import { LobbyState, PlayerSession } from '../../types/game';
import { ScrubbedPlayerView } from '../../types/engine';
import { EN_DISTRICTS } from '../../config/i18n/en';
import { Badge } from '../ui/Badge';
import { playCard, triggerHaptic, playMicroClick, playMayoralFanfare } from '../../utils/sfx';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export interface TrialDefensePanelProps {
  readonly lobbyState: LobbyState;
  readonly currentUserId: string;
  readonly onCastVerdictVote?: (verdict: 'GUILTY' | 'INNOCENT') => void;
  readonly onMayorReveal?: () => void;
  /** Set of userIds currently speaking over WebRTC */
  readonly speakingIds?: ReadonlySet<string>;
  /** Voice RMS amplitude (0.0 to 1.0) */
  readonly speakerVolume?: number;
}

function isFullSession(p: PlayerSession | ScrubbedPlayerView): p is PlayerSession {
  return 'displayRole' in p;
}

export const TrialDefensePanel: React.FC<TrialDefensePanelProps> = ({
  lobbyState,
  currentUserId,
  onCastVerdictVote,
  onMayorReveal,
  speakingIds,
  speakerVolume,
}) => {
  const accusedId = lobbyState.accusedPlayerId;
  const accusedPlayer = accusedId ? lobbyState.players[accusedId] : null;
  const currentUser = lobbyState.players[currentUserId];

  const isAlive = currentUser?.isAlive ?? false;
  const isAccused = currentUserId === accusedId;

  // Stanford Prison Solitary Disenfranchisement
  const prison = lobbyState.minigameSubStates.stanfordPrison;
  const isInSolitary = Boolean(prison?.solitaryConfinementPlayerIds?.includes(currentUserId));

  // Mayor Status & Reveal Eligibility
  const isMayor = Boolean(
    currentUser &&
      isFullSession(currentUser) &&
      (currentUser.allInIdentity?.layer2Office === 'MAYOR' ||
        currentUser.displayRole?.originalRoleName?.toLowerCase() === 'mayor')
  );

  const isMayorRevealed = Boolean(lobbyState.mayorRevealedUserIds?.includes(currentUserId));
  const canRevealMayor = isMayor && !isMayorRevealed && isAlive;

  // Verdict Tallies
  const verdictVotes = lobbyState.trialVerdictVotes || {};
  const myVote = verdictVotes[currentUserId];

  let guiltyCount = 0;
  let innocentCount = 0;
  Object.values(verdictVotes).forEach((v) => {
    if (v === 'GUILTY') guiltyCount += 1;
    if (v === 'INNOCENT') innocentCount += 1;
  });
  const totalVerdictVotes = guiltyCount + innocentCount;

  // Count living eligible jurors (excluding accused and solitary inmates)
  const livingPlayers = Object.values(lobbyState.players).filter((p) => p.isAlive);
  const eligibleJurors = livingPlayers.filter(
    (p) => p.userId !== accusedId && !prison?.solitaryConfinementPlayerIds?.includes(p.userId)
  );
  const eligibleVoterCount = Math.max(1, eligibleJurors.length);

  // Timer HUD Calculations
  const timeRemaining = lobbyState.phaseTimeRemaining;
  const duration = Math.max(1, lobbyState.phaseDurationSeconds || 30);
  const isUrgent = timeRemaining <= 5 && timeRemaining > 0;
  const progressPercent = Math.max(0, Math.min(100, (timeRemaining / duration) * 100));

  const guiltyPercent = totalVerdictVotes > 0 ? (guiltyCount / totalVerdictVotes) * 100 : 50;
  const innocentPercent = totalVerdictVotes > 0 ? (innocentCount / totalVerdictVotes) * 100 : 50;

  const district = accusedPlayer?.currentDistrict;
  const shouldReduceMotion = useReducedMotion();
  const [showMayorStamp, setShowMayorStamp] = React.useState(false);
  const isAccusedSpeaking = Boolean(accusedId && speakingIds?.has(accusedId));
  const isFinalClimax = timeRemaining <= 3 && timeRemaining > 0;

  // Haptic alert on podium
  React.useEffect(() => {
    if (isAccused) {
      triggerHaptic('accused');
    }
  }, [isAccused]);

  const handleMayorRevealClick = () => {
    setShowMayorStamp(true);
    playMayoralFanfare();
    triggerHaptic('victory');
    onMayorReveal?.();
    setTimeout(() => {
      setShowMayorStamp(false);
    }, 2200);
  };

  return (
    <div className="relative rounded-3xl bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 border border-amber-500/40 p-5 sm:p-6 shadow-[0_0_50px_rgba(245,158,11,0.2)] overflow-hidden flex flex-col gap-5">
      {/* ─── AMBIENT COURTROOM LIGHTING & VOICE-REACTIVE BEAM ──────── */}
      <motion.div
        animate={isAccusedSpeaking && !shouldReduceMotion ? {
          scaleX: [1.0, 1.4, 1.15, 1.45, 1.0],
          opacity: [0.35, 0.75, 0.5, 0.85, 0.35],
        } : { scaleX: 1.0, opacity: 0.25 }}
        transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[32rem] h-72 bg-gradient-to-b from-amber-400/35 via-amber-500/15 to-transparent blur-3xl pointer-events-none"
      />
      <div className={`absolute -top-12 left-1/4 w-48 h-56 bg-gradient-to-b from-amber-400/25 via-amber-500/5 to-transparent blur-xl transform -rotate-12 pointer-events-none transition-all duration-300 ${isAccusedSpeaking ? 'opacity-80 scale-110' : 'opacity-40'}`} />
      <div className={`absolute -top-12 right-1/4 w-48 h-56 bg-gradient-to-b from-amber-400/25 via-amber-500/5 to-transparent blur-xl transform rotate-12 pointer-events-none transition-all duration-300 ${isAccusedSpeaking ? 'opacity-80 scale-110' : 'opacity-40'}`} />
      {/* Volumetric dust particles */}
      <div className="absolute top-6 left-1/3 w-1.5 h-1.5 rounded-full bg-amber-300/40 animate-dust-float pointer-events-none" />
      <div className="absolute top-12 right-1/3 w-2 h-2 rounded-full bg-amber-400/30 animate-dust-float [animation-delay:1.5s] pointer-events-none" />
      <div className="absolute top-20 left-1/2 w-1 h-1 rounded-full bg-amber-200/50 animate-dust-float [animation-delay:0.7s] pointer-events-none" />

      {/* ─── HEADER: TITLE & 30S COUNTDOWN TIMER ──────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Scale className="w-3 h-3 text-amber-400" />
              HIGH COURT TRIAL
            </span>
            <span className="text-xs text-zinc-400 font-bold">Round {lobbyState.roundNumber}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-amber-100 tracking-tight flex items-center gap-2">
            <span>High Court: Podium Defense</span>
          </h2>
        </div>

        {/* Circular SVG Progress Ring Countdown HUD */}
        <div
          data-testid="courtroom-timer-hud"
          className={`relative px-4 py-2.5 rounded-2xl border transition-all duration-300 flex items-center gap-4 shrink-0 ${
            isFinalClimax
              ? 'bg-red-950/95 border-red-500 ring-4 ring-red-500 text-red-300 animate-pulse shadow-[0_0_40px_rgba(239,68,68,0.9)]'
              : isUrgent
              ? 'bg-red-950/90 border-red-500 ring-4 ring-red-500/60 text-red-400 animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.6)]'
              : timeRemaining <= 15
              ? 'bg-zinc-900/90 border-orange-500/50 text-orange-300 shadow-[0_0_20px_rgba(249,115,22,0.3)]'
              : 'bg-zinc-900/90 border-amber-500/40 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
          }`}
        >
          {/* Circular SVG Ring */}
          <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
            <svg className="w-14 h-14 -rotate-90 transform" viewBox="0 0 56 56">
              {/* Background Ring Track */}
              <circle
                cx="28"
                cy="28"
                r="22"
                className="stroke-zinc-800"
                strokeWidth="4"
                fill="none"
              />
              {/* Animated Progress Ring */}
              <circle
                cx="28"
                cy="28"
                r="22"
                stroke={isFinalClimax || isUrgent ? '#ef4444' : timeRemaining <= 15 ? '#f97316' : '#f59e0b'}
                strokeWidth="4"
                strokeDasharray={138.23}
                strokeDashoffset={138.23 - (progressPercent / 100) * 138.23}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-300 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-black tabular-nums tracking-tight">
                {timeRemaining}
              </span>
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 flex items-center gap-1">
              <Clock className={`w-3 h-3 ${isUrgent ? 'text-red-400 animate-spin' : 'text-amber-400'}`} />
              {isFinalClimax ? '⚠️ FINAL VERDICT!' : isUrgent ? 'URGENT DECISION!' : 'Defense Window'}
            </span>
            <span className="text-xs font-semibold text-zinc-400">
              {isFinalClimax ? 'Jurors are casting final ballots...' : `${timeRemaining}s remaining`}
            </span>
          </div>
        </div>
      </div>
      
      {/* ─── ACCUSED SHOWCASE PODIUM HERO CARD ─────────────────────── */}
      <div className="relative z-10 rounded-2xl bg-gradient-to-r from-amber-950/40 via-zinc-900/80 to-amber-950/40 border border-amber-500/40 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
        <div className="flex items-center gap-3.5">
          {/* Spotlight Avatar */}
          <div className="relative shrink-0">
            {isAccusedSpeaking && (
              <div className="absolute -inset-1.5 rounded-2xl ring-4 ring-amber-400/60 animate-ping pointer-events-none" />
            )}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 font-black text-xl flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.6)] ring-4 ring-amber-400/40 relative z-10">
              {accusedPlayer ? accusedPlayer.username.charAt(0).toUpperCase() : '?'}
            </div>
            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-zinc-950 text-[9px] font-black uppercase tracking-wider border border-zinc-950 z-20">
              PODIUM
            </span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-black text-white">
                {accusedPlayer?.username ?? 'Unassigned'}
              </span>
              {district && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {EN_DISTRICTS[district]}
                </span>
              )}
              {isAccused && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-zinc-950 uppercase tracking-widest shadow-sm">
                  YOU
                </span>
              )}
              {isAccusedSpeaking && (
                <span className="inline-flex items-center gap-1.5 text-[10px] bg-amber-500/25 text-amber-200 border border-amber-400/40 px-2 py-0.5 rounded-full font-black animate-pulse">
                  <Mic className="w-3 h-3 text-amber-400" />
                  <div className="flex items-end gap-0.5 h-2.5">
                    <span className="w-0.5 bg-amber-400 rounded-full animate-[bounce_0.6s_ease-in-out_infinite]" />
                    <span className="w-0.5 bg-amber-400 rounded-full animate-[bounce_0.4s_ease-in-out_infinite]" />
                    <span className="w-0.5 bg-amber-400 rounded-full animate-[bounce_0.5s_ease-in-out_infinite]" />
                  </div>
                  <span>TESTIFYING ON PODIUM</span>
                </span>
              )}
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5">
              {isAccused
                ? 'You stand accused on the podium! The town is deciding your fate.'
                : 'The accused is presenting their final defense. The jury must cast their verdict.'}
            </p>
          </div>
        </div>

        {/* Status Chip */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <Badge tone="amber" className="text-xs px-3 py-1 font-black">
            ⚖️ Accused on Trial
          </Badge>
        </div>
      </div>

      {/* ─── LIVE VERDICT VOTE TALLY & DUEL GAUGE ─────────────────── */}
      <div className="relative z-10 flex flex-col gap-2 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
        <div className="flex items-center justify-between text-xs font-bold text-zinc-300 flex-wrap gap-2">
          <span className="flex items-center gap-1.5 text-red-400 font-extrabold">
            <X className="w-4 h-4 text-red-500" />
            GUILTY: {guiltyCount} votes
          </span>
          <span className="text-zinc-500 text-[11px]">
            Total Ballots: {totalVerdictVotes} / {eligibleVoterCount}
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-extrabold">
            <Check className="w-4 h-4 text-emerald-500" />
            NOT GUILTY: {innocentCount} votes
          </span>
        </div>

        {/* Animated Scales of Justice Duel Indicator */}
        <div data-testid="courtroom-scales-of-justice" className="flex items-center justify-center gap-3 py-1">
          <div
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/90 border border-amber-500/30 text-amber-300 text-[11px] font-bold shadow-md transition-transform duration-500"
            style={{ transform: `rotate(${totalVerdictVotes > 0 ? Math.max(-15, Math.min(15, (guiltyCount - innocentCount) * 3)) : 0}deg)` }}
          >
            <Scale className={`w-4 h-4 ${guiltyCount > innocentCount ? 'text-red-400' : innocentCount > guiltyCount ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span>Scales of Justice: {guiltyCount > innocentCount ? 'Conviction Favored' : innocentCount > guiltyCount ? 'Acquittal Favored' : 'Deadlock in Balance'}</span>
          </div>
        </div>

        {/* Dual Ratio Gauge */}
        <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden flex shadow-inner">
          <div
            className="bg-red-600 transition-all duration-300 h-full flex items-center justify-start pl-2 text-[9px] font-black text-white"
            style={{ width: `${totalVerdictVotes === 0 ? 50 : guiltyPercent}%` }}
          >
            {totalVerdictVotes > 0 && guiltyCount > 0 && `${Math.round(guiltyPercent)}%`}
          </div>
          <div
            className="bg-emerald-600 transition-all duration-300 h-full flex items-center justify-end pr-2 text-[9px] font-black text-white"
            style={{ width: `${totalVerdictVotes === 0 ? 50 : innocentPercent}%` }}
          >
            {totalVerdictVotes > 0 && innocentCount > 0 && `${Math.round(innocentPercent)}%`}
          </div>
        </div>
      </div>

      {/* ─── JUROR ACTION CONTROLS ─────────────────────────────────── */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        {/* State Notice Messages */}
        <div className="flex-1 text-xs">
          {isAccused ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>You are on the podium! Plead your defense to the town in 30 seconds.</span>
            </div>
          ) : isInSolitary ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 font-bold">
              <AlertTriangle className="w-4 h-4 text-zinc-500 shrink-0" />
              <span>Solitary Confinement: Voting privileges suspended under Stanford Protocol.</span>
            </div>
          ) : !isAlive ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400">
              <UserCheck className="w-4 h-4 text-zinc-500 shrink-0" />
              <span>Spectator Mode: Only living jurors may cast verdict ballots.</span>
            </div>
          ) : (
            <span className="text-zinc-400 font-medium">
              Cast your verdict with conscience. A tied ballot upholds the presumption of innocence.
            </span>
          )}
        </div>

        {/* Voting Buttons for Eligible Jurors */}
        {isAlive && !isAccused && !isInSolitary && (
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {/* GUILTY Button */}
            <button
              type="button"
              onClick={() => {
                playCard();
                triggerHaptic('click');
                onCastVerdictVote?.('GUILTY');
              }}
              className={`px-5 py-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 transition-all duration-200 cursor-pointer shadow-lg active:scale-95 ${
                myVote === 'GUILTY'
                  ? 'bg-red-600 text-white ring-4 ring-red-400/70 shadow-[0_0_20px_rgba(239,68,68,0.7)]'
                  : 'bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-500/50 hover:border-red-400'
              }`}
            >
              <Gavel className="w-4 h-4 text-red-400" />
              <span>GUILTY</span>
              {myVote === 'GUILTY' && <Check className="w-4 h-4 text-white" />}
            </button>

            {/* INNOCENT Button */}
            <button
              type="button"
              onClick={() => {
                playCard();
                triggerHaptic('click');
                onCastVerdictVote?.('INNOCENT');
              }}
              className={`px-5 py-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 transition-all duration-200 cursor-pointer shadow-lg active:scale-95 ${
                myVote === 'INNOCENT'
                  ? 'bg-emerald-600 text-white ring-4 ring-emerald-400/70 shadow-[0_0_20px_rgba(16,185,129,0.7)]'
                  : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/50 hover:border-emerald-400'
              }`}
            >
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>NOT GUILTY</span>
              {myVote === 'INNOCENT' && <Check className="w-4 h-4 text-white" />}
            </button>
          </div>
        )}
      </div>

      {/* ─── MAYOR REVEAL MULTIPLIER ACTION ────────────────────────── */}
      {canRevealMayor && onMayorReveal && (
        <div className="relative z-10 pt-2 border-t border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-950/30 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4">
          <div className="flex items-center gap-2.5">
            <Crown className="w-5 h-5 text-amber-400 animate-bounce" />
            <div>
              <span className="text-xs font-black text-amber-200 uppercase tracking-wider block">
                Mayoral Authority
              </span>
              <span className="text-[11px] text-purple-200/80">
                Reveal your identity to amplify your courtroom vote weight to 3x.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleMayorRevealClick}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-purple-500/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <Crown className="w-4 h-4 text-amber-300" />
            <span>REVEAL MAYOR IDENTITY (3X VOTE)</span>
          </button>
        </div>
      )}

      {isMayorRevealed && (
        <div className="relative z-10 py-1.5 px-3 rounded-xl bg-purple-900/30 border border-purple-500/40 text-purple-200 text-xs font-black flex items-center gap-2 w-fit">
          <Crown className="w-4 h-4 text-amber-400" />
          <span>👑 MAYOR REVEALED: 3X VOTE WEIGHT ACTIVE</span>
        </div>
      )}

      {/* ─── MAYOR ROYAL SEAL PROCLAMATION STAMP MODAL ───────────── */}
      <AnimatePresence>
        {showMayorStamp && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { scale: 3.0, opacity: 0, rotate: -20 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
            className="fixed inset-0 z-[250] flex items-center justify-center pointer-events-none bg-black/60 backdrop-blur-xs"
          >
            <div className="p-8 sm:p-10 rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 border-4 border-amber-200 shadow-[0_0_80px_rgba(251,191,36,0.9)] flex flex-col items-center text-center max-w-sm ring-8 ring-amber-400/30">
              <Crown className="w-16 h-16 text-zinc-950 mb-2 drop-shadow-md animate-bounce" />
              <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 font-serif tracking-widest uppercase">
                THE MAYOR
              </h2>
              <div className="h-0.5 w-32 bg-zinc-950/60 my-2" />
              <span className="text-xs sm:text-sm font-black text-amber-950 tracking-wider uppercase">
                👑 3X VERDICT AUTHORITY PROCLAIMED!
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
