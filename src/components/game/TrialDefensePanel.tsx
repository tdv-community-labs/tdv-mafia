'use client';

import React from 'react';
import { Gavel, Shield, Crown, AlertTriangle, Clock, Check, X, Scale, UserCheck } from 'lucide-react';
import { LobbyState, PlayerSession } from '../../types/game';
import { ScrubbedPlayerView } from '../../types/engine';
import { AZ_DISTRICTS } from '../../config/i18n/az';
import { Badge } from '../ui/Badge';
import { playCard } from '../../utils/sfx';

export interface TrialDefensePanelProps {
  readonly lobbyState: LobbyState;
  readonly currentUserId: string;
  readonly onCastVerdictVote?: (verdict: 'GUILTY' | 'INNOCENT') => void;
  readonly onMayorReveal?: () => void;
}

function isFullSession(p: PlayerSession | ScrubbedPlayerView): p is PlayerSession {
  return 'displayRole' in p;
}

export const TrialDefensePanel: React.FC<TrialDefensePanelProps> = ({
  lobbyState,
  currentUserId,
  onCastVerdictVote,
  onMayorReveal,
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

  return (
    <div className="relative rounded-3xl bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 border border-amber-500/40 p-5 sm:p-6 shadow-[0_0_50px_rgba(245,158,11,0.2)] overflow-hidden flex flex-col gap-5">
      {/* ─── AMBIENT COURTROOM LIGHTING ──────────────────────────── */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-64 bg-amber-500/15 blur-3xl pointer-events-none" />
      <div className="absolute -top-12 left-1/4 w-48 h-56 bg-gradient-to-b from-amber-400/25 via-amber-500/5 to-transparent blur-xl transform -rotate-12 pointer-events-none" />
      <div className="absolute -top-12 right-1/4 w-48 h-56 bg-gradient-to-b from-amber-400/25 via-amber-500/5 to-transparent blur-xl transform rotate-12 pointer-events-none" />

      {/* ─── HEADER: TITLE & 30S COUNTDOWN TIMER ──────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Scale className="w-3 h-3 text-amber-400" />
              MƏHKƏMƏ HÖKMÜ PROSESİ
            </span>
            <span className="text-xs text-zinc-400 font-bold">Raund {lobbyState.roundNumber}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-amber-100 tracking-tight flex items-center gap-2">
            <span>Şəhər Məhkəməsi: Müdafiə Kürsüsü</span>
          </h2>
        </div>

        {/* 30s Countdown Timer HUD */}
        <div
          className={`px-4 py-2 rounded-2xl border transition-all duration-300 flex items-center gap-3 shrink-0 ${
            isUrgent
              ? 'bg-red-950/80 border-red-500 ring-4 ring-red-500/60 text-red-400 animate-pulse shadow-[0_0_25px_rgba(239,68,68,0.5)]'
              : 'bg-zinc-900/90 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
          }`}
        >
          <Clock className={`w-5 h-5 ${isUrgent ? 'text-red-400 animate-spin' : 'text-amber-400'}`} />
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                {isUrgent ? '⚠️ HÖKM ANI!' : 'Müdafiə Vaxtı'}
              </span>
            </div>
            <span className="text-2xl font-black tabular-nums tracking-tight leading-none">
              {timeRemaining}s
            </span>
          </div>
        </div>
      </div>

      {/* Timer Progress Bar */}
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden relative z-10">
        <div
          className={`h-full transition-all duration-300 ${
            isUrgent ? 'bg-gradient-to-r from-red-600 to-amber-500' : 'bg-gradient-to-r from-amber-500 to-yellow-400'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* ─── ACCUSED SHOWCASE PODIUM HERO CARD ─────────────────────── */}
      <div className="relative z-10 rounded-2xl bg-gradient-to-r from-amber-950/40 via-zinc-900/80 to-amber-950/40 border border-amber-500/40 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
        <div className="flex items-center gap-3.5">
          {/* Spotlight Avatar */}
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 font-black text-xl flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.6)] ring-4 ring-amber-400/40">
              {accusedPlayer ? accusedPlayer.username.charAt(0).toUpperCase() : '?'}
            </div>
            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-zinc-950 text-[9px] font-black uppercase tracking-wider border border-zinc-950">
              KÜRSÜ
            </span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-black text-white">
                {accusedPlayer?.username ?? 'Təyin Edilməyib'}
              </span>
              {district && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {AZ_DISTRICTS[district]}
                </span>
              )}
              {isAccused && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-zinc-950 uppercase tracking-widest shadow-sm">
                  SƏN
                </span>
              )}
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5">
              {isAccused
                ? 'Siz hazırda kürsüdəsiniz! Şəhər sakinləri lehinizə və ya əleyhinizə hökm çıxarır.'
                : 'İttiham olunan vətəndaş son sözünü deyir. Andçılar heyəti hökm qəbul etməlidir.'}
            </p>
          </div>
        </div>

        {/* Status Chip */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <Badge tone="amber" className="text-xs px-3 py-1 font-black">
            ⚖️ İttiham Olunan
          </Badge>
        </div>
      </div>

      {/* ─── LIVE VERDICT VOTE TALLY & DUEL GAUGE ─────────────────── */}
      <div className="relative z-10 flex flex-col gap-2 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
        <div className="flex items-center justify-between text-xs font-bold text-zinc-300 flex-wrap gap-2">
          <span className="flex items-center gap-1.5 text-red-400 font-extrabold">
            <X className="w-4 h-4 text-red-500" />
            GÜNAHKARDIR: {guiltyCount} səs
          </span>
          <span className="text-zinc-500 text-[11px]">
            Cəmi Hökm: {totalVerdictVotes} / {eligibleVoterCount}
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-extrabold">
            <Check className="w-4 h-4 text-emerald-500" />
            TƏQSİRSİZDİR: {innocentCount} səs
          </span>
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
              <span>Siz kürsüdəsiniz! Özünüzə səs verə bilməzsiniz. Son 30 saniyədə şəhəri inandırın.</span>
            </div>
          ) : isInSolitary ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 font-bold">
              <AlertTriangle className="w-4 h-4 text-zinc-500 shrink-0" />
              <span>Təkadamlıq kameradasınız: Stanford Qaydasınca səsvermə hüququnuz dondurulub.</span>
            </div>
          ) : !isAlive ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400">
              <UserCheck className="w-4 h-4 text-zinc-500 shrink-0" />
              <span>Müşahidəçi rejimindəsiniz: Yalnız canlı andçılar məhkəmə hökmü verə bilər.</span>
            </div>
          ) : (
            <span className="text-zinc-400 font-medium">
              Andçı kimi vicdanınıza uyğun seçim edin. Hökm bərabər olduqda təqsirsizlik prezumpsiyası keçərlidir.
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
                onCastVerdictVote?.('GUILTY');
              }}
              className={`px-5 py-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 transition-all duration-200 cursor-pointer shadow-lg active:scale-95 ${
                myVote === 'GUILTY'
                  ? 'bg-red-600 text-white ring-4 ring-red-400/70 shadow-[0_0_20px_rgba(239,68,68,0.7)]'
                  : 'bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-500/50 hover:border-red-400'
              }`}
            >
              <Gavel className="w-4 h-4 text-red-400" />
              <span>GÜNAHKARDIR</span>
              {myVote === 'GUILTY' && <Check className="w-4 h-4 text-white" />}
            </button>

            {/* INNOCENT Button */}
            <button
              type="button"
              onClick={() => {
                playCard();
                onCastVerdictVote?.('INNOCENT');
              }}
              className={`px-5 py-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 transition-all duration-200 cursor-pointer shadow-lg active:scale-95 ${
                myVote === 'INNOCENT'
                  ? 'bg-emerald-600 text-white ring-4 ring-emerald-400/70 shadow-[0_0_20px_rgba(16,185,129,0.7)]'
                  : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/50 hover:border-emerald-400'
              }`}
            >
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>TƏQSİRSİZDİR</span>
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
                Şəhər Meri İxtiyarı
              </span>
              <span className="text-[11px] text-purple-200/80">
                Kimliyinizi açıqlayaraq məhkəmədə səs çəkinizi 3x artıra bilərsiniz.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playCard();
              onMayorReveal();
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-purple-500/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <Crown className="w-4 h-4 text-amber-300" />
            <span>3X ŞƏHƏR MERİ KİMLİYİNİ AÇIQLA</span>
          </button>
        </div>
      )}

      {isMayorRevealed && (
        <div className="relative z-10 py-1.5 px-3 rounded-xl bg-purple-900/30 border border-purple-500/40 text-purple-200 text-xs font-black flex items-center gap-2 w-fit">
          <Crown className="w-4 h-4 text-amber-400" />
          <span>👑 ŞƏHƏR MERİ: 3X SƏS GÜCÜ AKTİVDİR</span>
        </div>
      )}
    </div>
  );
};
