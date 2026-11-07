'use client';

import React, { useState, useEffect } from 'react';
import {
  Ghost,
  Coins,
  Flame,
  TrendingUp,
  Skull,
  Eye,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { LobbyState, PlayerSession } from '../../types/game';
import { ScrubbedPlayerView } from '../../types/engine';
import { getPlayerProgression, placeGhostBet } from '../../utils/progression';
import { playMourningBell, playMicroClick } from '../../utils/sfx';
import { Button } from '../ui/Button';

export interface GhostRealmPanelProps {
  readonly lobbyState: LobbyState;
  readonly currentUserId: string;
  readonly isSpectatorOrDead: boolean;
}

export const GhostRealmPanel: React.FC<GhostRealmPanelProps> = ({
  lobbyState,
  currentUserId,
  isSpectatorOrDead,
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [wagerAmount, setWagerAmount] = useState<number>(25);
  const [betSuccessMessage, setBetSuccessMessage] = useState<string | null>(null);
  const [ghostBarometerTargetId, setGhostBarometerTargetId] = useState<string | null>(null);

  const profile = React.useMemo(() => {
    return getPlayerProgression(currentUserId);
  }, [currentUserId, betSuccessMessage]);

  useEffect(() => {
    if (isSpectatorOrDead) {
      // Acoustic subtle spiritual chime
      playMourningBell();
    }
  }, [isSpectatorOrDead]);

  if (!isSpectatorOrDead) return null;

  // Filter living players as candidate targets for betting
  const livingPlayers = Object.values(lobbyState.players).filter((p) => p.isAlive);

  const handlePlaceLynchBet = () => {
    if (!selectedTargetId) return;
    playMicroClick();

    const targetPlayer = lobbyState.players[selectedTargetId];
    const targetName = targetPlayer ? targetPlayer.username : 'Oyunçu';

    const result = placeGhostBet(currentUserId, lobbyState.lobbyId, {
      spectatorId: currentUserId,
      spectatorName: profile.username,
      targetPlayerId: selectedTargetId,
      betType: 'NEXT_LYNCH',
      wagerAmount,
      oddsMultiplier: 2.5,
      round: lobbyState.roundNumber,
    });

    if (result.success) {
      setBetSuccessMessage(
        `🔮 ${wagerAmount} Ruh Cövhəri ${targetName} üzərinə qoyuldu! (Uduş: ${Math.round(
          wagerAmount * 2.5
        )} Cövhər)`
      );
      setSelectedTargetId('');
      setTimeout(() => setBetSuccessMessage(null), 4000);
    }
  };

  const handleCastGhostSuspicion = (targetId: string) => {
    playMicroClick();
    setGhostBarometerTargetId(targetId);
  };

  return (
    <div
      data-testid="ghost-realm-panel"
      className="relative w-full rounded-2xl bg-gradient-to-b from-indigo-950/70 via-purple-950/60 to-zinc-950/90 border border-purple-500/40 p-4 shadow-[0_0_30px_rgba(168,85,247,0.25)] backdrop-blur-md overflow-hidden text-zinc-100 mb-4"
    >
      {/* Ethereal Ambient Spectral Fog Background Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
        <div className="absolute -inset-[100%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-600/30 via-indigo-900/10 to-transparent animate-pulse" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-900/60 border border-purple-400/50 flex items-center justify-center text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
            <Ghost className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white tracking-wide flex items-center gap-1.5">
                Kabuslar Aləmi (Ghost Realm)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-500/25 text-purple-300 border border-purple-500/40">
                Zero-Knowledge
              </span>
            </div>
            <p className="text-[11px] text-purple-200/80">
              Canlı oyunçular sənin proqnozlarını və şübhələrini görə bilməz.
            </p>
          </div>
        </div>

        {/* Spirit Essence HUD */}
        <div className="flex items-center gap-2 bg-purple-950/90 border border-purple-500/40 px-3 py-1.5 rounded-xl shadow-inner">
          <Sparkles className="w-4 h-4 text-purple-300 animate-spin" />
          <span className="text-xs font-bold text-purple-200">Ruh Cövhəri:</span>
          <span className="text-sm font-black text-amber-300">
            {profile.spiritEssence}
          </span>
        </div>
      </div>

      {/* Prediction Betting Controls */}
      <div className="relative z-10 mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Box 1: Next Lynch Prediction Bet */}
        <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Skull className="w-3.5 h-3.5 text-purple-400" />
                Növbəti Edam Proqnozu (2.5x Əmsal)
              </span>
              <span className="text-[10px] font-black text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                2.5x Uduş
              </span>
            </div>

            <p className="text-[11px] text-zinc-300 mb-2.5">
              Məhkəmədə hansı oyunçunun edam olunacağını təxmin et:
            </p>

            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="w-full bg-zinc-900/90 border border-purple-500/40 rounded-lg p-2 text-xs text-white outline-none focus:ring-1 focus:ring-purple-400 mb-3"
            >
              <option value="">Hədəf oyunçunu seç...</option>
              {livingPlayers.map((lp) => (
                <option key={lp.userId} value={lp.userId}>
                  {lp.username} ({lp.displayRole?.localizedRoleName || 'Vətəndaş'})
                </option>
              ))}
            </select>

            {/* Wager Selector */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Mərc:</span>
              {[10, 25, 50].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setWagerAmount(amt)}
                  className={`px-2.5 py-1 rounded-md text-xs font-black transition-all ${
                    wagerAmount === amt
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40 border border-purple-400'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-white border border-zinc-700'
                  }`}
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handlePlaceLynchBet}
            disabled={!selectedTargetId || profile.spiritEssence < wagerAmount}
            size="sm"
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md border border-purple-400/40"
          >
            Mərc Et ({wagerAmount} Cövhər)
          </Button>

          {betSuccessMessage && (
            <p className="text-[11px] font-bold text-emerald-400 mt-2 flex items-center gap-1 animate-pulse">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {betSuccessMessage}
            </p>
          )}
        </div>

        {/* Box 2: Spectral Suspicion Barometer */}
        <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                Kabus Şübhə Barometri
              </span>
              <span className="text-[10px] font-black text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded border border-indigo-500/30">
                Ölülər Konsensusu
              </span>
            </div>

            <p className="text-[11px] text-zinc-300 mb-2">
              Səncə aralarında kim cinayətkardır? Reytinqə səs ver:
            </p>

            <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
              {livingPlayers.map((lp) => {
                const isSelected = ghostBarometerTargetId === lp.userId;
                return (
                  <button
                    key={lp.userId}
                    onClick={() => handleCastGhostSuspicion(lp.userId)}
                    className={`w-full p-1.5 px-2.5 rounded-lg text-left text-xs flex items-center justify-between transition-all border ${
                      isSelected
                        ? 'bg-rose-950/60 border-rose-500/70 text-rose-200'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-purple-500/40'
                    }`}
                  >
                    <span className="font-bold truncate">{lp.username}</span>
                    <span className="text-[10px] text-zinc-500 uppercase">
                      {isSelected ? 'Şübhəlisən!' : 'İttiham et'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2 text-[10px] text-purple-300/70 text-center font-medium">
            Ölülərin pıçıltısı yalnız bu pəncərədə qalır.
          </div>
        </div>
      </div>
    </div>
  );
};
