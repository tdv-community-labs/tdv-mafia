'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Skull,
  Newspaper,
  Shield, Ghost,
  Zap,
  Flame,
  AlertTriangle,
  Building,
  Target,
  Sparkles,
  Volume2,
  VolumeX,
  PenTool,
} from 'lucide-react';
import { LobbyState, NightActionType, PlayerSession } from '../../types/game';
import { ScrubbedPlayerView } from '../../types/engine';
import { AllInDistrict } from '../../types/roles';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { PlayerCard } from './PlayerCard';
import { getTheme } from '../../config/themes.config';
import { VotingCourtPanel } from './VotingCourtPanel';
import { DetectiveNotebook } from './DetectiveNotebook';
import {
  AZ_DANTE_CIRCLES,
  AZ_DISTRICTS,
  AZ_PHASES,
  AZ_UI,
} from '../../config/i18n/az';
import {
  playNight,
  playDay,
  playGavel,
  playCard,
  playElimination,
  isSoundMuted,
  toggleSound,
  subscribeSound,
} from '../../utils/sfx';

export interface GameBoardProps {
  readonly lobbyState: LobbyState;
  readonly currentUserId: string;
  readonly onSelectPlayer?: (player: PlayerSession) => void;
  readonly onOpenNewspaper?: () => void;
  readonly onCastVote?: (candidateId: string) => void;
  readonly onRetractVote?: () => void;
  readonly onTriggerAction?: (actionType: NightActionType, targetPlayerId: string) => void;
  readonly onTriggerKlaatuFreeze?: () => void;
  readonly districtFinalists?: readonly string[];
  /** Set of player IDs currently speaking via voice chat */
  readonly speakingIds?: ReadonlySet<string>;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  lobbyState,
  currentUserId,
  onSelectPlayer,
  onOpenNewspaper,
  onCastVote,
  onRetractVote,
  onTriggerAction,
  onTriggerKlaatuFreeze,
  districtFinalists = [],
  speakingIds,
}) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [activeDistrictTab, setActiveDistrictTab] = useState<AllInDistrict | 'ALL'>('ALL');
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [isNotebookOpen, setIsNotebookOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRoleReveal, setShowRoleReveal] = useState<boolean>(true);
  const [inspectedDeadPlayer, setInspectedDeadPlayer] = useState<any>(null);
  const [inspectedLastWill, setInspectedLastWill] = useState<string | null>(null);
  const [inspectedProfileId, setInspectedProfileId] = useState<string | null>(null);
  
  useEffect(() => {
    if (showRoleReveal) {
      const timer = setTimeout(() => setShowRoleReveal(false), 4500);
      return () => clearTimeout(timer);
    }
  }, [showRoleReveal]);

  const currentUser = lobbyState.players[currentUserId];
  const isAlive = currentUser?.isAlive ?? false;
  const isAllIn = lobbyState.mode === 'ALL_IN';
  const theme = getTheme(lobbyState.mode);
  const phase = lobbyState.phase;

  // Track sound status
  useEffect(() => {
    setSoundMuted(isSoundMuted());
    const unsub = subscribeSound((muted) => setSoundMuted(muted));
    return () => unsub();
  }, []);

  // Audio Phase Engine: Detect phase transitions & trigger zero-latency audio
  const prevPhaseRef = useRef<string>(lobbyState.phase);
  const prevAliveCountRef = useRef<number>(
    Object.values(lobbyState.players).filter((p) => p.isAlive).length
  );

  useEffect(() => {
    const curPhase = lobbyState.phase;
    const prevPhase = prevPhaseRef.current;

    if (curPhase !== prevPhase) {
      if (curPhase === 'NIGHT_BUFFER') {
        playNight();
      } else if (curPhase === 'DAY_VOTING') {
        playGavel();
      } else if (
        curPhase === 'DAY_CENTRAL_ASSEMBLY' ||
        curPhase === 'DAY_REGIONAL_CAUCUS'
      ) {
        playDay();
      }
      prevPhaseRef.current = curPhase;
    }

    const curAliveCount = Object.values(lobbyState.players).filter((p) => p.isAlive).length;
    if (curAliveCount < prevAliveCountRef.current) {
      playElimination();
    }
    prevAliveCountRef.current = curAliveCount;
  }, [lobbyState.phase, lobbyState.players]);

  const dante = lobbyState.minigameSubStates.dantesInferno;
  const earth = lobbyState.minigameSubStates.earthStoodStill;
  const valkyrie = lobbyState.minigameSubStates.valkyrie;
  const prison = lobbyState.minigameSubStates.stanfordPrison;
  const catenaccio = lobbyState.minigameSubStates.catenaccio;

  const handleCardClick = (player: PlayerSession | ScrubbedPlayerView) => {
    playCard();
    setSelectedPlayerId(player.userId);
    if ('socketId' in player) {
      onSelectPlayer?.(player);
    }
  };

  const allPlayers = Object.values(lobbyState.players);
  const displayedPlayers = allPlayers.filter((p) => {
    if (!isAllIn || activeDistrictTab === 'ALL') return true;
    return p.currentDistrict === activeDistrictTab;
  });

  const office = currentUser?.allInIdentity?.layer2Office;
  const faction = currentUser?.allInIdentity?.layer1Faction ?? 'TOWN';
  const roleName = currentUser?.displayRole?.originalRoleName?.toLowerCase() || '';
  const localizedRole = currentUser?.displayRole?.localizedRoleName?.toLowerCase() || '';

  const isMafia =
    faction === 'MAFIA' ||
    faction === 'YAKUZA' ||
    faction === 'VOID_CULT' ||
    faction === 'NEUTRAL_KILLER' ||
    roleName.includes('killer') ||
    roleName.includes('mafia') ||
    localizedRole.includes('mafiya');

  const isDoctor =
    office === 'CITY_SURGEON' ||
    roleName.includes('doctor') ||
    localizedRole.includes('həkim');

  const isSheriff =
    office === 'CITY_INVESTIGATOR' ||
    office === 'POLICE_COMMISSIONER' ||
    roleName.includes('investigator') ||
    roleName.includes('sheriff') ||
    localizedRole.includes('şərif');

  const isDisrupter =
    office === 'CHIEF_FIRE_MARSHAL' ||
    office === 'PRISON_WARDEN';

  const isMisdirector = office === 'BLACK_MARKET_BROKER';

  let primaryActionLabel: string = AZ_UI.investigate;
  let primaryActionType: NightActionType = 'INVESTIGATE';
  let canActAtNight = false;

  if (isMafia) {
    primaryActionLabel = AZ_UI.strike;
    primaryActionType = 'KILL';
    canActAtNight = true;
  } else if (isDoctor) {
    primaryActionLabel = AZ_UI.protect;
    primaryActionType = 'PROTECT';
    canActAtNight = true;
  } else if (isSheriff) {
    primaryActionLabel = AZ_UI.investigate;
    primaryActionType = 'INVESTIGATE';
    canActAtNight = true;
  } else if (isDisrupter) {
    primaryActionLabel = AZ_UI.disrupt;
    primaryActionType = 'BLOCK';
    canActAtNight = true;
  } else if (isMisdirector) {
    primaryActionLabel = AZ_UI.misdirect;
    primaryActionType = 'MISDIRECT';
    canActAtNight = true;
  }

  // Calculate vote counts and leading candidate for court / voting phase
  const voteCounts: Record<string, number> = {};
  Object.values(lobbyState.liveVotes).forEach((candId) => {
    voteCounts[candId] = (voteCounts[candId] || 0) + 1;
  });
  const leadingCandidateId = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  
  const totalPlayers = Object.keys(lobbyState.players).length;
  const alivePlayersCount = Object.values(lobbyState.players).filter(p => p.isAlive).length;
  const deadPlayersCount = totalPlayers - alivePlayersCount;
  const progressPercentage = Math.max(0, Math.min(100, (lobbyState.phaseTimeRemaining / Math.max(1, lobbyState.phaseDurationSeconds)) * 100));

  const isNightPhase = phase === 'NIGHT_BUFFER';
  const isVotingPhase = phase === 'DAY_VOTING';
  const hasCastVote = Boolean(lobbyState.liveVotes[currentUserId]);
  const canSeeVotes = true;
  const isDayDiscussion =
    phase === 'DAY_CENTRAL_ASSEMBLY' ||
    phase === 'DAY_REGIONAL_CAUCUS';

  return (
    <div
      className={`flex flex-col gap-6 rounded-3xl transition-colors duration-1000 ease-in-out ${
          isNightPhase
            ? 'bg-zinc-950/20 p-2 sm:p-4 border border-zinc-900/30'
            : isVotingPhase
            ? 'bg-red-950/20 p-2 sm:p-4 rounded-3xl border border-red-900/30'
            : isDayDiscussion
            ? 'bg-amber-50/40 dark:bg-amber-900/10 p-2 sm:p-4 rounded-3xl border border-amber-500/10'
            : ''
        }`}
    >
      {/* ─── NIGHT PULSING WARNING BANNER ─────────────────────────── */}
      {isNightPhase && (
        <div className="w-full py-3 px-4 rounded-[20px] bg-gradient-to-r from-red-950/90 via-purple-950/90 to-red-950/90 border border-red-500/40 shadow-[0_0_35px_rgba(239,68,68,0.3)] flex items-center justify-center gap-3 animate-pulse select-none">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span className="text-xs sm:text-sm font-black tracking-widest text-red-200 uppercase drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] text-center">
            🌑 ŞƏHƏR YATIR, QATİLLƏR OYANIR 🌑
          </span>
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
        </div>
      )}

      {/* ─── TOP PHASE HUD ─────────────────────────────────────────── */}
      <div className="p-5 sm:p-6 rounded-[20px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors duration-200">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {AZ_UI.currentPhase}
            </span>
            <Badge tone="purple">{lobbyState.mode.replace(/_/g, ' ')}</Badge>
            <Badge tone="neutral">
              {AZ_UI.round} {lobbyState.roundNumber}
            </Badge>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white tracking-tight">
            {AZ_PHASES[lobbyState.phase] ?? lobbyState.phase}
          </h2>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isAllIn && (
            <Badge tone="purple">
              {AZ_UI.maxKillsPerNight}: {lobbyState.globalNightKillCap}
            </Badge>
          )}

          {phase === 'NIGHT_BUFFER' && (
            <Badge tone="amber">
              {AZ_UI.nightJitter}: {lobbyState.nightJitterDelaySeconds}s
            </Badge>
          )}

          {onOpenNewspaper && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenNewspaper}
              icon={<Newspaper className="w-4 h-4 text-blue-500" />}
            >
              {AZ_UI.morningNewspaper}
            </Button>
          )}

          {/* Sound Toggle in GameBoard */}
          <button
            type="button"
            onClick={() => {
              const next = toggleSound();
              setSoundMuted(next);
              if (!next) playCard();
            }}
            title={soundMuted ? 'Səsi Aç' : 'Səsi Bağla'}
            className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer ${
              soundMuted
                ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-zinc-400'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Timer Display */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
            <Clock className="w-4 h-4 text-zinc-400" />
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block leading-none">
                {AZ_UI.timeRemaining}
              </span>
              <span
                className={`text-base font-black leading-tight ${
                  lobbyState.phaseTimeRemaining <= 10
                      ? 'text-red-600 animate-pulse'
                      : 'text-zinc-900 dark:text-zinc-100'
                  } tabular-nums`}
              >
                {lobbyState.phaseTimeRemaining}s
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── DYNAMIC MINIGAME BANNERS ───────────────────────────────── */}
      {/* 1. Dante's Inferno */}
      {dante && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-950 dark:text-red-200 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-500" />
              <span>{AZ_UI.danteCircle}: {AZ_DANTE_CIRCLES[dante.currentCircle]?.name ?? dante.currentCircle}</span>
            </span>
            <Badge tone="red">{dante.completedCircles.length + 1} / 9 Dairə</Badge>
          </div>
          <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed">
            {AZ_DANTE_CIRCLES[dante.currentCircle]?.rule}
          </p>
        </div>
      )}

      {/* 2. The Day The Earth Stood Still */}
      {earth && (
        <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-blue-700 dark:text-blue-300">
                {AZ_UI.doomsdayClock}: {earth.doomsdayClockHours} / 12 Saat
              </span>
              <Badge tone={earth.doomsdayClockHours >= 10 ? 'red' : 'blue'}>
                {earth.doomsdayClockHours >= 12 ? 'PLANETAR MƏHV' : 'QORT AKTİV'}
              </Badge>
            </div>
            <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
              Hər günahsız vətəndaş edamı saatı 1 pillə irəli aparır.
            </p>
          </div>

          {!earth.worldFrozenUsed && onTriggerKlaatuFreeze && (
            <Button variant="warning" size="sm" onClick={onTriggerKlaatuFreeze}>
              {AZ_UI.freezeWorld}
            </Button>
          )}
        </div>
      )}

      {/* 3. Operation Valkyrie */}
      {valkyrie && valkyrie.briefcaseLocationPlayerId && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-3">
          <div>
            <span className="font-bold text-sm text-amber-800 dark:text-amber-300">
              {AZ_UI.briefcaseLocation}: {valkyrie.briefcaseLocationPlayerId}
            </span>
            <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              {AZ_UI.fuseCountdown}: {valkyrie.fuseTimerDaysRemaining} gün qalır.
            </div>
          </div>
          <Badge tone="amber">{valkyrie.fuseTimerDaysRemaining} GÜN</Badge>
        </div>
      )}

      {/* 4. Stanford Prison */}
      {prison && (
        <div className="p-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/60 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-zinc-800 dark:text-zinc-200">
              ⛓️ {AZ_UI.revoltMeter}: {prison.revoltMeter}%
            </span>
            <Badge tone={prison.revoltMeter >= 80 ? 'red' : 'neutral'}>
              {prison.riotTriggered ? 'QİYAM BAŞLADI' : 'NƏZARƏT ALTINDA'}
            </Badge>
          </div>
          <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                prison.revoltMeter >= 75 ? 'bg-red-600' : 'bg-amber-500'
              }`}
              style={{ width: `${prison.revoltMeter}%` }}
            />
          </div>
        </div>
      )}

      {/* 5. Catenaccio */}
      {catenaccio && (
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between">
          <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>{AZ_UI.defensiveWall} ({catenaccio.defensiveWallPlayerIds.length} Qalxan)</span>
          </span>
          <Badge tone={catenaccio.wallBreached ? 'red' : 'emerald'}>
            {catenaccio.wallBreached ? AZ_UI.wallBreachedAlert : 'SƏDD BÖLÜNMƏZ'}
          </Badge>
        </div>
      )}

      
      {/* ─── OBJECTIVE BANNER ────────────────────────────────────────── */}
      {currentUser && (
        <div className={`p-4 rounded-xl border ${
          currentUser.allInIdentity?.layer1Faction === 'MAFIA' ? 'bg-red-950/20 border-red-900/30' :
          currentUser.allInIdentity?.layer1Faction === 'NEUTRAL_EVIL' ? 'bg-fuchsia-950/20 border-fuchsia-900/30' :
          currentUser.allInIdentity?.layer1Faction === 'NEUTRAL_KILLER' ? 'bg-purple-950/20 border-purple-900/30' :
          'bg-emerald-950/20 border-emerald-900/30'
        } flex flex-col gap-2 relative overflow-hidden`}>
          <div className="flex items-center gap-2 relative z-10">
            <span className="font-black text-xs uppercase tracking-[0.2em] opacity-60">MƏQSƏD</span>
          </div>
          <p className="text-sm font-bold relative z-10">
            {currentUser.displayRole?.originalRoleName === 'Jester'
              ? "Özünü hər kəsə qatil kimi göstər və Gündüz Səsverməsində (Məhkəmədə) özünü asdır!"
              : currentUser.allInIdentity?.layer1Faction === 'NEUTRAL_KILLER'
              ? "Gecələr hər kəsi qətlə yetir və şəhərdə sağ qalan ən sonuncu şəxs ol."
              : currentUser.allInIdentity?.layer1Faction === 'MAFIA'
              ? "Şəhər əhalisini aradan qaldır və Mafiya üçün səs çoxluğunu ələ keçir."
              : "Şəhərə sızmış bütün Mafiya və Təhlükəli qüvvələri tapıb edam et."}
          </p>
          <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none w-32 flex items-center justify-end pr-4">
             {currentUser.allInIdentity?.layer1Faction === 'MAFIA' ? <Skull className="w-16 h-16 text-red-500" /> :
              currentUser.allInIdentity?.layer1Faction?.includes('NEUTRAL') ? <Ghost className="w-16 h-16 text-fuchsia-500" /> :
              <Shield className="w-16 h-16 text-emerald-500" />}
          </div>
        </div>
      )}

      {/* ─── VOTING COURT PANEL (WHEN IN DAY_VOTING) ────────────────── */}
      {phase === 'DAY_VOTING' && onCastVote && onRetractVote && (
        <VotingCourtPanel
          lobbyState={lobbyState}
          currentUserId={currentUserId}
          selectedCandidateId={selectedPlayerId}
          districtFinalists={districtFinalists}
          voteCounts={voteCounts}
          canSeeVotes={canSeeVotes}
          onCastVote={onCastVote}
          onRetractVote={onRetractVote}
        />
      )}

      {/* ─── ALL-IN DISTRICT TABS ───────────────────────────────────── */}
      {isAllIn && (
        <div className="flex items-center gap-2 pb-3 overflow-x-auto border-b-2 border-purple-500/30">
          <Button variant={activeDistrictTab === 'ALL' ? 'primary' : 'outline'} size="sm" className={isAllIn ? (activeDistrictTab === 'ALL' ? 'ring-2 ring-purple-500 bg-purple-500/20 text-purple-200 font-mono tracking-wider' : 'bg-black/50 text-purple-400 border-purple-500/30 font-mono tracking-wider hover:bg-purple-500/10') : ''}
            onClick={() => setActiveDistrictTab('ALL')}
          >
            Bütün Kvartallar ({allPlayers.length})
          </Button>
          {(['ELITE', 'COMMERCIAL', 'INDUSTRIAL'] as AllInDistrict[]).map((dist) => {
            const count = allPlayers.filter((p) => p.currentDistrict === dist).length;
            return (
              <Button key={dist} variant={activeDistrictTab === dist ? 'primary' : 'outline'} size="sm" className={isAllIn ? (activeDistrictTab === dist ? 'ring-2 ring-purple-500 bg-purple-500/20 text-purple-200 font-mono tracking-wider' : 'bg-black/50 text-purple-400 border-purple-500/30 font-mono tracking-wider hover:bg-purple-500/10') : ''}
                onClick={() => setActiveDistrictTab(dist)}
              >
                {AZ_DISTRICTS[dist]} ({count})
              </Button>
            );
          })}
        </div>
      )}

      {/* ─── SPEAKER QUEUE BANNER ──────────────────────────────────── */}
      {isDayDiscussion && lobbyState.speakerQueue.length > 0 && (
        <div className="rounded-[16px] border border-amber-500/30 bg-amber-950/20 px-4 py-3 flex items-center gap-3 overflow-hidden">
          {/* Now Speaking */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.7)]">
                <span className="text-black font-black text-sm">
                  {(lobbyState.players[lobbyState.speakerQueue[0]] as PlayerSession)?.username?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-zinc-900 animate-pulse" />
            </div>
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500">İNDİ DANIŞIR</div>
              <div className="text-sm font-black text-amber-200 leading-tight">
                {(lobbyState.players[lobbyState.speakerQueue[0]] as PlayerSession)?.username ?? '—'}
                {lobbyState.speakerQueue[0] === currentUserId && (
                  <span className="ml-1.5 text-[9px] bg-amber-500 text-black px-1.5 py-0.5 rounded-full font-black">SƏN</span>
                )}
              </div>
            </div>
          </div>

          {/* Queue divider */}
          {lobbyState.speakerQueue.length > 1 && (
            <>
              <div className="h-8 w-px bg-amber-700/30 mx-1 shrink-0" />
              {/* Next up */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider shrink-0">Növbə:</span>
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {lobbyState.speakerQueue.slice(1, 5).map((uid, i) => {
                    const p = lobbyState.players[uid] as PlayerSession | undefined;
                    return (
                      <div
                        key={uid}
                        className="flex items-center gap-1 bg-zinc-900/60 border border-amber-700/20 rounded-lg px-2 py-0.5 shrink-0"
                        style={{ opacity: 1 - i * 0.2 }}
                      >
                        <span className="w-4 h-4 rounded-full bg-zinc-700 flex items-center justify-center text-[9px] font-black text-zinc-300">
                          {i + 2}
                        </span>
                        <span className="text-xs font-bold text-zinc-400 truncate max-w-[60px]">
                          {p?.username ?? uid}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── ACTIVE PLAYERS GRID ────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-zinc-950 dark:text-white">
              {AZ_UI.activeParticipants}
            </h3>
            <Badge tone="neutral">{displayedPlayers.length}</Badge>
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Hədəf seçmək üçün oyunçu kartına klikləyin
          </span>
        </div>

        <div className={`grid ${isAllIn ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2' : theme.gridContainer}`}>
          {displayedPlayers.map((player, index) => (
            <PlayerCard
              key={player.userId}
              style={{ animationDelay: `${index * 30}ms` }}
              player={player}
              isSelf={player.userId === currentUserId}
              isSelected={selectedPlayerId === player.userId}
              targetIntent={selectedPlayerId === player.userId ? primaryActionType : undefined}
              isAccused={
                canSeeVotes &&
                isVotingPhase &&
                Boolean(leadingCandidateId) &&
                player.userId === leadingCandidateId &&
                (voteCounts[player.userId] ?? 0) > 0
              }
              isCurrentTurn={lobbyState.speakerQueue[0] === player.userId}
              hasVoteOnTarget={lobbyState.liveVotes[currentUserId] === player.userId}
              voteCount={canSeeVotes ? (voteCounts[player.userId] ?? 0) : 0}
              voterUsernames={canSeeVotes ? Object.entries(lobbyState.liveVotes || {}).filter(([voterId, targetId]) => targetId === player.userId).map(([voterId]) => lobbyState.players[voterId]?.username || voterId) : []}
              isSpeaking={speakingIds?.has(player.userId) ?? false}
              isViewerMafia={isMafia}
              activeEmote={lobbyState.activeEmotes?.[player.userId]?.emote}
              isGameOver={lobbyState.phase === 'ENDED'}
              isLobbyPhase={lobbyState.phase === 'LOBBY'}
              onSelect={handleCardClick}
            />
          ))}
        </div>

        {displayedPlayers.some(p => !p.isAlive) && (
          <div className="mt-12 mb-4 animate-fadeIn">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent flex-1"></div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center">
                  <Skull className="w-4 h-4 text-zinc-500" />
                </div>
                <span className="text-[10px] font-black tracking-[0.3em] text-zinc-500 uppercase">
                  Qəbiristanlıq
                </span>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent flex-1"></div>
            </div>
            
            <div className={`grid ${isAllIn ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2' : theme.gridContainer} opacity-60 hover:opacity-100 transition-opacity duration-500`}>
              {displayedPlayers.filter(p => !p.isAlive).map((player, index) => (
                <PlayerCard
                  key={player.userId}
                  player={player}
                  isSelf={player.userId === currentUserId}
                  isSelected={false}
                  targetIntent={undefined}
                  isAccused={false}
                  isCurrentTurn={false}
                  hasVoteOnTarget={false}
                  voteCount={0}
                  isSpeaking={speakingIds?.has(player.userId) ?? false}
                  isViewerMafia={isMafia}
                  isGameOver={lobbyState.phase === 'ENDED'}
              isLobbyPhase={lobbyState.phase === 'LOBBY'}
                  onSelect={() => {}}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── STICKY BOTTOM ACTION BAR ───────────────────────────────── */}
      {!isAlive ? (
        <div className="sticky bottom-0 sm:bottom-4 z-50 p-4 sm:p-5 rounded-t-[24px] sm:rounded-[24px] border border-red-500/30 bg-zinc-950/95 backdrop-blur-[32px] shadow-[0_-10px_40px_rgba(220,38,38,0.1)] sm:shadow-[0_12px_40px_rgba(220,38,38,0.1)] flex items-center justify-center gap-4 transition-all duration-300 w-full mb-0 sm:mb-4">
            <span className="text-red-400 font-mono uppercase tracking-widest text-sm flex items-center gap-2">
               <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
               MÜŞAHİDƏÇİ REJİMİ AKTİVDİR (Səsvermə və əmrlər deaktivdir)
            </span>
        </div>
      ) : (
        <div className="sticky bottom-0 sm:bottom-4 z-50 p-4 sm:p-5 rounded-t-[24px] sm:rounded-[24px] border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] sm:shadow-[0_12px_40px_rgba(0,0,0,0.1)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 w-full mb-0 sm:mb-4 border-b-0 sm:border-b">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            isNightPhase
              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
              : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
          }`}>
            <Target className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
              {isNightPhase
                ? `${AZ_UI.nightOrder} & Əməliyyat Paneli`
                : isVotingPhase
                ? 'Gündüz Məhkəməsi & İttiham Səsverməsi'
                : 'Müzakirə Fazası'}
            </span>
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {isNightPhase && !canActAtNight
                ? 'Siz Məsum Vətəndaşsınız. Şəhər yatır... Səhəri gözləyin.'
                : selectedPlayerId
                ? `Seçilmiş Hədəf: ${
                    lobbyState.players[selectedPlayerId]?.username ?? selectedPlayerId
                  }`
                : isNightPhase
                ? 'Əmr icra etmək üçün yuxarıdakı kartlardan hədəf seçin'
                : isVotingPhase
                ? 'Səs vermək üçün yuxarıdakı kartlardan namizəd seçin'
                : 'Müzakirə davam edir, söz hüququndan istifadə edin'}
            </div>
          </div>
        </div>

        {isNightPhase ? (
          canActAtNight ? (
            <Button
              variant="purple"
              size="md"
              disabled={
                !isAlive ||
                !selectedPlayerId ||
                (primaryActionType !== 'PROTECT' && selectedPlayerId === currentUserId)
              }
              onClick={() => {
                if (selectedPlayerId && onTriggerAction) {
                  onTriggerAction(primaryActionType, selectedPlayerId);
                }
              }}
              icon={<Zap className="w-4 h-4" />}
              className="shrink-0"
            >
              {primaryActionLabel}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="md"
              disabled
              className="shrink-0 opacity-70"
            >
              💤 Şəhər Yatır
            </Button>
          )
        ) : isVotingPhase ? (
          <Button
            variant="danger"
            size="md"
            disabled={!isAlive || !selectedPlayerId || selectedPlayerId === currentUserId}
            onClick={() => {
              if (selectedPlayerId && onCastVote) {
                onCastVote(selectedPlayerId);
              }
            }}
            className="shrink-0"
          >
            Səs Ver
          </Button>
        ) : null}
      </div>
      )}
    </div>
  );
};
