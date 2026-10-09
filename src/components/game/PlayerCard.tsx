'use client';

import React from 'react';
import {  Crown, Bot, Check, Clock, Mic, Shield, Sparkles, Target, Gavel , WifiOff, Ghost, X } from 'lucide-react';
import { PlayerSession } from '../../types/game';
import { ScrubbedPlayerView } from '../../types/engine';
import { AllInDistrict, CivicOfficeType } from '../../types/roles';
import { Badge, BadgeTone } from '../ui/Badge';
import { AZ_CIVIC_OFFICES, AZ_DISTRICTS, AZ_UI } from '../../config/i18n/az';
import { motion } from 'framer-motion';
import { playCard } from '../../utils/sfx';

export interface PlayerCardProps {
  readonly player: PlayerSession | ScrubbedPlayerView;
  readonly isLobbyPhase?: boolean;
  readonly isSelf?: boolean;
  readonly isCurrentTurn?: boolean;
  readonly hasVoteOnTarget?: boolean;
  readonly isSelected?: boolean;
  readonly isAccused?: boolean;
  readonly voteCount?: number;
  readonly voterUsernames?: readonly string[];
  readonly isReady?: boolean;
  readonly isSpeaking?: boolean;
  readonly isViewerMafia?: boolean;
  readonly isGameOver?: boolean;
  readonly onSelect?: (player: PlayerSession | ScrubbedPlayerView) => void;
  readonly onKick?: () => void;
    readonly targetIntent?: 'KILL' | 'PROTECT' | 'INVESTIGATE' | 'BLOCK' | 'MISDIRECT';
  readonly teammateIntents?: readonly { actorName: string; type: string }[];
  readonly isCompact?: boolean;
  readonly activeEmote?: string;
  readonly style?: React.CSSProperties;
}

function isFullSession(p: PlayerSession | ScrubbedPlayerView): p is PlayerSession {
  return 'displayRole' in p;
}

const DISTRICT_TONES: Record<AllInDistrict, BadgeTone> = {
  ELITE: 'purple',
  COMMERCIAL: 'blue',
  INDUSTRIAL: 'amber',
};

const PlayerCardComponent: React.FC<PlayerCardProps> = ({
  player,
  isLobbyPhase = false,
  isSelf = false,
  isCurrentTurn = false,
  hasVoteOnTarget = false,
  isSelected = false,
  isAccused = false,
  voteCount = 0,
  voterUsernames = [],
  isReady = false,
  isSpeaking = false,
  isViewerMafia = false,
  isGameOver = false,
  onSelect,
  targetIntent,
  onKick,
  isCompact = false,
  activeEmote,
  style,
}) => {
  const isAlive = player.isAlive;
  const isHost = player.isHost;
  const isBot = isFullSession(player) ? player.isAiBotControlled : false;
  const isAfk = !isBot && isFullSession(player) && player.lastSeenAt && (Date.now() - player.lastSeenAt > 15000);

  let roleTitle = player.username;
  let roleSubtitle = isLobbyPhase
    ? isHost
      ? 'Masa Rəhbəri (Host)'
      : isBot
      ? 'Gemini 3.8 Ağıllı Bot'
      : isReady
      ? 'Oyuna Hazırdır'
      : 'Gözləyir'
    : isSelf
    ? isFullSession(player)
      ? `Siz: ${player.displayRole.formatted}`
      : `Siz: ${player.ownRoleDisplay ?? 'Gizli Rol'}`
    : isGameOver
    ? isFullSession(player) && player.displayRole?.originalRoleName !== 'Secret' && player.displayRole?.originalRoleName !== 'Pending'
      ? player.displayRole.localizedRoleName || player.displayRole.originalRoleName
      : ''
    : !isAlive
    ? isFullSession(player) && player.displayRole?.originalRoleName !== 'Secret' && player.displayRole?.originalRoleName !== 'Pending'
      ? player.displayRole.localizedRoleName || player.displayRole.originalRoleName
      : '✝️ Ələnmiş İştirakçı'
    : isViewerMafia && isFullSession(player) && player.allInIdentity?.layer1Faction === 'MAFIA'
    ? '🕶️ Mafiya Ortağı'
    : '';

  const district = !isLobbyPhase ? player.currentDistrict : null;
  const officeRaw = !isLobbyPhase && (isSelf || !isAlive || isGameOver)
    ? isFullSession(player)
      ? player.allInIdentity?.layer2Office
      : (player.ownOffice as CivicOfficeType | null)
    : null;

  const handleClick = () => {
    playCard();
    onSelect?.(player);
  };

  // Determine card border and glow styling
  let containerClasses = 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm';

  if (!isAlive && !isLobbyPhase) {
    containerClasses = 'bg-zinc-100/60 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800/60 opacity-60 grayscale-[40%]';
  } else if (isAccused) {
    containerClasses = 'bg-red-500/10 dark:bg-red-950/40 border-red-500 border border-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.4)]';
  } else if (isSelected) {
    containerClasses = 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]/40 shadow-lg shadow-blue-500/20';
  } else if (isSpeaking) {
    containerClasses = 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/20';
  } else if (isCurrentTurn) {
    containerClasses = 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/40 shadow-lg shadow-amber-500/20';
  } else if (hasVoteOnTarget) {
    containerClasses = 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-500 ring-2 ring-rose-500/25';
  } else if (isSelf) {
    // Radiant holographic glow border for player's own card
    containerClasses = 'bg-gradient-to-br from-purple-50/90 via-white to-purple-100/80 dark:from-purple-950/40 dark:via-zinc-900 dark:to-purple-950/30 border-purple-400 dark:border-purple-500 ring-2 ring-purple-500/50 shadow-[0_0_20px_rgba(147,51,234,0.35)]';
  }

  return (
    <div
      onClick={handleClick}
      className={`group relative rounded-[20px] ${isCompact ? "p-2 min-h-[60px]" : "p-4 min-h-[120px]"} border transition-all duration-300 flex flex-col justify-between gap-3 overflow-hidden select-none ${
        onSelect ? 'cursor-pointer hover:' : 'cursor-default'
      } ${containerClasses}`}
    >
      


      {/* Floating Active Emote Badge */}
      {activeEmote && (
        <div className="absolute top-2 left-2 z-30 px-2.5 py-1 rounded-full bg-zinc-950/90 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.5)] text-sm font-black flex items-center gap-1 backdrop-blur-md animate-bounce pointer-events-none">
          <span>{activeEmote}</span>
        </div>
      )}

      {/* Bloody Scratch Overlay for Dead Players */}
      {!isLobbyPhase && !isAlive && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-[20px] mix-blend-multiply dark:mix-blend-overlay opacity-60">
           <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full text-red-700/80 fill-current">
              <path d="M 10 20 L 40 80 L 30 90 L 0 30 Z" />
              <path d="M 40 10 L 80 90 L 70 100 L 30 20 Z" />
              <path d="M 70 0 L 100 70 L 90 80 L 60 10 Z" />
           </svg>
        </div>
      )}

      {/* Kick Button for Host */}
      {isLobbyPhase && onKick && !isSelf && (
        <button 
          onClick={(e) => { e.stopPropagation(); onKick(); }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors z-20"
          title="Oyuncunu Masadan Çıxar"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      {/* Eliminated Stamp */}
      {!isLobbyPhase && !isAlive && (
        <div className="absolute top-3 right-[-10px] rotate-12 bg-red-600 text-white px-5 py-0.5 text-[10px] font-black tracking-widest uppercase border border-red-400 shadow-lg z-10 pointer-events-none">
          <div className="flex items-center gap-1"><Gavel className="w-3 h-3"/> {AZ_UI.eliminated}</div>
        </div>
      )}

      
      {/* Target Intent Reticle */}
      {isSelected && targetIntent && (
         <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-[20px]">
            {targetIntent === 'KILL' && (
               <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(239,68,68,0.2)_100%)] flex items-center justify-center">
                  <Target className="w-24 h-24 text-red-500/30 absolute animate-ping" />
                  <Target className="w-24 h-24 text-red-500/60 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
               </div>
            )}
            {targetIntent === 'PROTECT' && (
               <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(16,185,129,0.2)_100%)] flex items-center justify-center">
                  <Shield className="w-24 h-24 text-emerald-500/30 absolute animate-ping" />
                  <Shield className="w-24 h-24 text-emerald-500/60 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
               </div>
            )}
         </div>
      )}
      
      {/* Cinematic Death Watermark & Blood Overlay */}
      {!isAlive && !isLobbyPhase && (
        <div className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden pointer-events-none rounded-[12px] group-hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute inset-0 bg-red-950/20 backdrop-grayscale-[40%] transition-all"></div>
          
          {/* Blood splatters (CSS only) */}
          
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-1 bg-red-600 shadow-[0_0_10px_red] -rotate-[25deg] opacity-70"></div>
          
          <div className="transform -rotate-[15deg] bg-red-700/90 text-red-50 font-black text-[10px] tracking-[0.4em] uppercase px-14 py-2 shadow-[0_0_30px_rgba(220,38,38,0.8)] whitespace-nowrap border-y border-red-400/80 z-10">
            MƏHV EDİLİB
          </div>
        </div>
      )}
      
      {/* Header: Avatar, Name & Badges */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar Circle */}
          <div
            className={`w-10 h-10 rounded-[8px] flex items-center justify-center font-black text-sm shrink-0 border shadow-sm transition-transform duration-200 ${
              isHost
                ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white border-amber-400/50 shadow-amber-500/20'
                : isSelf
                ? 'bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white border-purple-400/50 shadow-purple-500/30'
                : isBot
                ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white border-purple-400/50'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
            }`}
          >
            {!isAlive ? <Ghost className="w-5 h-5 opacity-70" /> : isBot ? <Bot className="w-5 h-5" /> : player.username.charAt(0).toUpperCase()}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-sm text-zinc-950 dark:text-white truncate">
                {roleTitle}
              </span>

              {/* Bold "SƏN" Badge */}
              {isSelf && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black px-2 py-0.2 rounded-full tracking-wider uppercase shadow-sm shadow-purple-500/30 shrink-0">
                  <Sparkles className="w-2.5 h-2.5" />
                  SƏN
                </span>
              )}

              {/* Refined 🤖 Gemini AI Badge */}
              {isBot && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-purple-500/15 dark:bg-purple-500/25 text-purple-700 dark:text-purple-300 font-extrabold px-1.5 py-0.2 rounded-md border border-purple-500/30 shrink-0">
                  🤖 Gemini AI
                </span>
              )}

              {isSpeaking && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.2 rounded-full font-bold border border-emerald-500/30 animate-pulse shrink-0">
                  <Mic className="w-2.5 h-2.5" />
                  Danışır
                </span>
              )}
            </div>

            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {roleSubtitle}
            </span>
          </div>
        </div>

        {/* Right Status Badges */}
        <div className="flex items-center gap-1 shrink-0">
          {isLobbyPhase ? (
            isHost ? (
              <Badge tone="amber" icon={<Crown className="w-3 h-3" />}>
                HOST
              </Badge>
            ) : isReady ? (
              <Badge tone="emerald" icon={<Check className="w-3 h-3" />}>
                HAZIR
              </Badge>
            ) : (
              <Badge tone="neutral" icon={<Clock className="w-3 h-3" />}>
                GÖZLƏYİR
              </Badge>
            )
          ) : (
            <>
              {voteCount > 0 && (
                <div className="relative group/tooltip">
                  <Badge tone="red" className="text-xs font-black px-2 py-0.5 shadow-sm cursor-help hover:scale-105 transition-transform">
                    {voteCount} səs
                  </Badge>
                  
                  {/* Custom Voter Tooltip */}
                  {voterUsernames && voterUsernames.length > 0 && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-zinc-900 text-white text-[10px] font-bold tracking-widest uppercase rounded-lg shadow-2xl border border-zinc-700 pointer-events-none opacity-0 group-hover/tooltip:opacity-100 transition-opacity z-50">
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 border-b border-r border-zinc-700 rotate-45" />
                      SƏS VERƏNLƏR: {voterUsernames.join(', ')}
                    </div>
                  )}
                </div>
              )}
              <Badge tone={isAlive ? 'emerald' : 'red'}>
                {isAlive ? AZ_UI.alive : AZ_UI.eliminated}
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Badges Bar (District or Host) */}
      {!isLobbyPhase && (
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
          {district && (
            <Badge tone={DISTRICT_TONES[district] ?? 'blue'}>
              {AZ_DISTRICTS[district]}
            </Badge>
          )}
          {isHost && <Badge tone="amber">{AZ_UI.host}</Badge>}
        </div>
      )}

      {/* Office (Visible only during active game if applicable) */}
      {!isLobbyPhase && officeRaw && (
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 pt-1.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <span>Vəzifə:</span>
          <strong className="text-blue-600 dark:text-blue-400 font-bold">
            {AZ_CIVIC_OFFICES[officeRaw] ?? officeRaw}
          </strong>
        </div>
      )}
    </div>
  );
};

// Deep compare function to prevent useless re-renders of heavy cards on mobile
export const PlayerCard = React.memo(PlayerCardComponent, (prev, next) => {
  return (
    prev.isLobbyPhase === next.isLobbyPhase &&
    prev.isSelf === next.isSelf &&
    prev.isCurrentTurn === next.isCurrentTurn &&
    prev.hasVoteOnTarget === next.hasVoteOnTarget &&
    prev.isSelected === next.isSelected &&
    prev.isAccused === next.isAccused &&
    prev.voteCount === next.voteCount &&
    prev.isReady === next.isReady &&
    prev.isSpeaking === next.isSpeaking &&
    prev.isViewerMafia === next.isViewerMafia &&
    prev.isGameOver === next.isGameOver &&
    prev.targetIntent === next.targetIntent &&
    prev.activeEmote === next.activeEmote &&
    JSON.stringify(prev.voterUsernames) === JSON.stringify(next.voterUsernames) &&
    JSON.stringify(prev.player) === JSON.stringify(next.player)
  );
});