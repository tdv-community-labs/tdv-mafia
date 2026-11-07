'use client';

import React, { useState } from 'react';
import {
  Trophy,
  Crown,
  Share2,
  Copy,
  Check,
  Flame,
  Shield,
  Clock,
  Sparkles,
  X,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Skull,
} from 'lucide-react';
import { LobbyState } from '../../types/game';
import { calculateMatchRecap, formatTelegramShareUrl, formatWhatsAppShareUrl, formatTwitterShareUrl } from '../../server/engine/mvp-calculator';
import { MatchRecap, MatchMVPScore } from '../../types/progression';
import { Button } from '../ui/Button';

export interface MatchRecapModalProps {
  readonly isOpen: boolean;
  readonly lobbyState: LobbyState;
  readonly currentUserId: string;
  readonly onClose: () => void;
}

export const MatchRecapModal: React.FC<MatchRecapModalProps> = ({
  isOpen,
  lobbyState,
  currentUserId,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'MVP' | 'TIMELINE' | 'LEADERBOARD'>('MVP');

  const recap: MatchRecap = React.useMemo(() => {
    return calculateMatchRecap(lobbyState);
  }, [lobbyState]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recap.shareableSummaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const isUserMvp = recap.mvp.playerId === currentUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div
        data-testid="match-recap-modal"
        className="relative w-full max-w-3xl max-h-[90vh] bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border border-amber-500/40 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.25)] flex flex-col overflow-hidden text-zinc-100"
      >
        {/* Top Banner: Faction Victory */}
        <div className="relative p-6 pb-4 border-b border-zinc-800/80 bg-gradient-to-r from-amber-950/40 via-zinc-900/60 to-purple-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-zinc-950 shadow-[0_0_20px_rgba(251,191,36,0.5)]">
              <Trophy className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                  Matçın Nəticəsi • Raund {recap.totalRounds}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {recap.winningFaction} Qələbəsi
                </span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                TDV BTL Arena Döyüş İcmalı
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-zinc-800/60 bg-zinc-950/40">
          <button
            onClick={() => setActiveTab('MVP')}
            className={`px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'MVP'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            MVP & Qəhrəman
          </button>
          <button
            onClick={() => setActiveTab('TIMELINE')}
            className={`px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'TIMELINE'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Dönüş Nöqtələri ({recap.turningPoints.length})
          </button>
          <button
            onClick={() => setActiveTab('LEADERBOARD')}
            className={`px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'LEADERBOARD'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Xal Cədvəli ({recap.scores.length})
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 max-h-[50vh]">
          {activeTab === 'MVP' && (
            <div className="space-y-6">
              {/* MVP Hero Card */}
              <div className="relative p-6 rounded-2xl bg-gradient-to-br from-amber-950/40 via-zinc-900 to-amber-950/20 border-2 border-amber-400/60 shadow-[0_0_30px_rgba(251,191,36,0.2)] overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <Crown className="w-36 h-36 text-amber-300" />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-zinc-950 text-2xl font-black shadow-[0_0_25px_rgba(251,191,36,0.6)] border-2 border-amber-200">
                      <Crown className="w-9 h-9 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400 text-zinc-950 shadow-sm">
                          MATÇIN MVP-Sİ
                        </span>
                        {isUserMvp && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500 text-white">
                            BU SƏNSƏN!
                          </span>
                        )}
                      </div>
                      <h3 className="text-2xl font-black text-white mt-1">
                        {recap.mvp.playerName}
                      </h3>
                      <p className="text-xs font-semibold text-amber-300/90 flex items-center gap-2">
                        <span>Rol: {recap.mvp.roleId}</span>
                        <span>•</span>
                        <span>Fraksiya: {recap.mvp.faction}</span>
                      </p>
                    </div>
                  </div>

                  <div className="bg-zinc-950/80 p-3.5 rounded-xl border border-amber-500/30 text-right min-w-[130px]">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                      MVP Performans Xalı
                    </span>
                    <span className="text-3xl font-black text-amber-400">
                      {recap.mvp.totalScore}
                    </span>
                  </div>
                </div>

                {/* Score Breakdown Bars */}
                <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-amber-500/20 text-xs">
                  <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">Qələbə Bonusu</span>
                    <span className="font-black text-emerald-400 text-sm">+{recap.mvp.breakdown.victoryBonus}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">Sağ Qalma</span>
                    <span className="font-black text-cyan-400 text-sm">+{recap.mvp.breakdown.survivalBonus}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">Hərəkət Təsiri</span>
                    <span className="font-black text-amber-400 text-sm">+{recap.mvp.breakdown.actionImpactPoints}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">Məhkəmə Bəraəti</span>
                    <span className="font-black text-purple-400 text-sm">+{recap.mvp.breakdown.defenseAcquittalPoints}</span>
                  </div>
                </div>

                {/* Clutch Highlights */}
                {recap.mvp.clutchHighlights.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {recap.mvp.clutchHighlights.map((hl, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        {hl}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'TIMELINE' && (
            <div className="space-y-3">
              {recap.turningPoints.map((tp, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-start gap-3.5 hover:border-zinc-700 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700 text-amber-400 font-black text-sm">
                    R{tp.round}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-white">{tp.titleAz}</span>
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          tp.impactLevel === 'GAME_CHANGING'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : tp.impactLevel === 'CRITICAL'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {tp.impactLevel}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 mt-1">{tp.descriptionAz}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'LEADERBOARD' && (
            <div className="space-y-2">
              {recap.scores.map((score, idx) => (
                <div
                  key={score.playerId}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    idx === 0
                      ? 'bg-amber-950/30 border-amber-500/50'
                      : score.playerId === currentUserId
                      ? 'bg-purple-950/30 border-purple-500/50'
                      : 'bg-zinc-900/60 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-black text-sm text-zinc-400">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">
                          {score.playerName}
                        </span>
                        {idx === 0 && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                        {score.playerId === currentUserId && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-purple-600 text-white">
                            SƏN
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        {score.roleId} • {score.faction}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="font-black text-base text-amber-400">
                        {score.totalScore}
                      </span>
                      <span className="text-[10px] text-zinc-500 block uppercase">xal</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 1-Click Viral Sharing Footer */}
        <div className="p-4 px-6 border-t border-zinc-800 bg-zinc-950/90 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Share2 className="w-4 h-4 text-amber-400" />
            <span className="font-semibold">Nəticəni dostlarınla paylaş:</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Telegram Share */}
            <a
              href={formatTelegramShareUrl(recap)}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              Telegram
            </a>

            {/* WhatsApp Share */}
            <a
              href={formatWhatsAppShareUrl(recap)}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              WhatsApp
            </a>

            {/* X / Twitter Share */}
            <a
              href={formatTwitterShareUrl(recap)}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors border border-zinc-700"
            >
              X (Twitter)
            </a>

            {/* Copy Text Button */}
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="border-amber-500/50 text-amber-300 hover:bg-amber-500/10 font-bold text-xs flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Kopyalandı!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Mətni Kopyala
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
