'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  Skull,
  Newspaper,
  Shield,
  Zap,
  Flame,
  AlertTriangle,
  Building,
  Target,
  Sparkles,
  Volume2,
  VolumeX,
  Trophy,
  RotateCcw,
  X,
  ScrollText,
  Send,
  PenTool,
  Check,
  Link as LinkIcon,
  Bot, Play, Sliders, ChevronUp, ChevronDown, Eye,
  BookOpen, User
} from 'lucide-react';
import { AdminDualLockPanel } from '../../../components/admin/AdminDualLockPanel';
import { ArchitectConsole } from '../../../components/admin/ArchitectConsole';
import { BailiffConsole } from '../../../components/admin/BailiffConsole';
import { GameBoard } from '../../../components/game/GameBoard';
import { PhaseTransitionOverlay } from '../../../components/game/PhaseTransitionOverlay';
import { RoleRevealOverlay } from '../../../components/game/RoleRevealOverlay';
import { CinematicVignette } from '../../../components/ui/CinematicVignette';
import confetti from 'canvas-confetti';
import { ExecutionOverlay } from '../../../components/game/ExecutionOverlay';
import { FactionChat } from '../../../components/game/FactionChat';
import { GhostChat } from '../../../components/game/GhostChat';
import { AchievementToastSystem, unlockAchievement } from '../../../components/ui/AchievementToast';
import { AchievementShowcaseModal } from '../../../components/modals/AchievementShowcaseModal';
import { ProfileModal } from '../../../components/modals/ProfileModal';
import { RulesModal } from '../../../components/modals/RulesModal';
import { ArchiveModal } from '../../../components/modals/ArchiveModal';
import { AmbientWeather } from '../../../components/game/AmbientWeather';
import { GameIntroOverlay } from '../../../components/game/GameIntroOverlay';
import { DetectiveNotebook } from '../../../components/game/DetectiveNotebook';
import { LastWillModal } from '../../../components/modals/LastWillModal';
import { GraveyardModal } from '../../../components/modals/GraveyardModal';
import { MorningNewspaperModal } from '../../../components/game/MorningNewspaperModal';
import { PlayerCard } from '../../../components/game/PlayerCard';
import { PlayerProfileCard } from '../../../components/ui/PlayerProfileCard';
import { recordGameResult } from '../../../utils/stats';
import { VoiceChat } from '../../../components/voice/VoiceChat';
import { ChatBox } from '../../../components/game/ChatBox';
import { formatRoleDisplay } from '../../../types/roles';
import { GamePhase, LobbyState, NightActionType, PlayerSession } from '../../../types/game';
import { MorningNewspaper } from '../../../types/engine';
import { AZ_PHASES, AZ_UI } from '../../../config/i18n/az';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { PACKS_CONFIG } from '../../../config/packs.config';
import { getTheme } from '../../../config/themes.config';
import { playCard, playElimination, playDay, playNight, isSoundMuted, toggleSound, subscribeSound, startAmbient, stopAmbient } from '../../../utils/sfx';

interface LobbyPageProps {
  readonly params: {
    readonly lobbyId: string;
  };
}

export default function LobbyPage({ params }: LobbyPageProps) {
  const { lobbyId } = params;

  // Persistent user identity from localStorage
  const [currentUserId, setCurrentUserId] = useState<string>('usr-guest');
  const [currentUsername, setCurrentUsername] = useState<string>('Oyunçu');
  const [currentUserTier, setCurrentUserTier] = useState<string>('TIER_1');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showAdminTools, setShowAdminTools] = useState<boolean>(false);
  const [isReadyLocal, setIsReadyLocal] = useState<boolean>(false);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set());

  // Toast notifications
  const [toast, setToast] = useState<{
    message: string;
    tone: 'info' | 'success' | 'warning' | 'danger';
  } | null>(null);

  const showToast = useCallback(
    (message: string, tone: 'info' | 'success' | 'warning' | 'danger' = 'info') => {
      setToast({ message, tone });
    },
    []
  );

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Initialize lobby state in clean waiting room phase
  const [lobbyState, setLobbyState] = useState<LobbyState>(() => {
    const isAllIn = lobbyId.toUpperCase().includes('ALL_IN');
    const isInferno = lobbyId.toUpperCase().includes('INFERNO');
    const mode = isAllIn ? 'ALL_IN' : isInferno ? 'DANTES_INFERNO' : 'BLITZ';

    return {
      lobbyId,
      chatMessages: [],
      hostUserId: 'usr-host-initial',
      mode,
      phase: 'LOBBY',
      players: {},
      hostReady: false,
      adminMasterUnlock: {
        architectUnlocked: false,
        bailiffUnlocked: false,
        dualLockVerified: !isAllIn,
        unlockedAt: isAllIn ? null : Date.now(),
      },
      assignedArchitectId: null,
      assignedBailiffId: null,
      phaseDurationSeconds: 300,
      phaseTimeRemaining: 300,
      nightJitterDelaySeconds: 4,
      liveVotes: {},
      speakerQueue: [],
      bufferedNightActions: [],
      minigameSubStates: {
        dantesInferno: {
          currentCircle: 'CIRCLE_1_LIMBO',
          completedCircles: [],
          deflectionRate: 0.2,
          slowModeCharLimit: 80,
          greedVoteCostDebts: {},
          wrathNoAbstainEnforced: false,
          heresyLeakedClues: [],
          violenceCleanedVictimIds: [],
          fraudBlurActive: false,
          treacherySecretVotingActive: false,
          jesterLuciferShadowActive: false,
          luciferShadowWinnerUserId: null,
        },
      },
      roundNumber: 1,
      lastLynchedUserId: null,
      globalNightKillCap: isAllIn ? 3 : 99,
    };
  });

  // Track sound
  useEffect(() => {
    setSoundMuted(isSoundMuted());
    const unsub = subscribeSound((muted) => setSoundMuted(muted));
    return () => unsub();
  }, []);

  // Load user session & join lobby via server API
  useEffect(() => {
    let resolvedId = 'usr-anon';
    let resolvedName = 'Anonim Qonaq';
    let resolvedTier = 'TIER_1';

    try {
      const ecoRaw = localStorage.getItem('tdv_ecosystem_session_v1');
      if (ecoRaw) {
        const parsedEco = JSON.parse(ecoRaw);
        if (parsedEco?.username || parsedEco?.fullName) {
          resolvedName = parsedEco.fullName || parsedEco.username;
          resolvedId = `usr-${(parsedEco.username || parsedEco.fullName).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
          resolvedTier = parsedEco.tier || 'TIER_1';
        }
      } else {
        const saved = localStorage.getItem('tdv_mafia_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.username) {
            resolvedName = parsed.username;
            resolvedId = `usr-${parsed.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            resolvedTier = parsed.tier || 'TIER_1';
          }
        } else {
          const guestId = `usr-guest-${Math.random().toString(36).substring(2, 7)}`;
          resolvedId = guestId;
          resolvedName = `Qonaq_${guestId.substring(10)}`;
        }
      }
    } catch {
      // Ignore
    }

    setCurrentUserId(resolvedId);
    setCurrentUsername(resolvedName);
    setCurrentUserTier(resolvedTier);

    // Join room on server
    const joinLobby = async () => {
      try {
        const res = await fetch(`/api/lobby/${lobbyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'JOIN',
            userId: resolvedId,
            username: resolvedName,
            tier: resolvedTier,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.rawLobby) {
            setLobbyState((prev) => {
              if (JSON.stringify(prev) === JSON.stringify(data.rawLobby)) return prev;
              return data.rawLobby;
            });
          }
        }
      } catch {
        // Fallback: create local session if network unavailable
        setLobbyState((prev) => {
          if (prev.players[resolvedId]) return prev;
          const hostSession: PlayerSession = {
            socketId: `sock-${resolvedId}`,
            userId: resolvedId,
            username: resolvedName,
            tier: resolvedTier as any,
            adminRole: prev.mode === 'ALL_IN' ? 'THE_ARCHITECT' : 'NONE',
            isHost: Object.keys(prev.players).length === 0,
            isAlive: true,
            hasHostWaiver: true,
            hasAdminWaiver: true,
            displayRole: formatRoleDisplay(resolvedName, 'Citizen', 'Vətəndaş'),
            currentDistrict: 'COMMERCIAL',
            disconnectedAt: null,
            isAiBotControlled: false,
          };
          return {
            ...prev,
            hostUserId: prev.hostUserId === 'usr-host-initial' ? resolvedId : prev.hostUserId,
            players: {
              ...prev.players,
              [resolvedId]: hostSession,
            },
          };
        });
      }
    };

    joinLobby();

    // Poll lobby state every 2.5s to sync other players
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/lobby/${lobbyId}?userId=${resolvedId}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.rawLobby) {
            setLobbyState((prev) => {
              if (JSON.stringify(prev) === JSON.stringify(data.rawLobby)) return prev;
              return data.rawLobby;
            });
          }
        }
      } catch {
        // Ignore
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [lobbyId]);

  // Dispatch action to server
  const dispatchAction = useCallback(
    async (payload: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/lobby/${lobbyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            username: currentUsername,
            ...payload,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.rawLobby) {
            setLobbyState((prev) => {
              if (JSON.stringify(prev) === JSON.stringify(data.rawLobby)) return prev;
              return data.rawLobby;
            });
          }
        }
      } catch {
        // Network fail
      }
    },
    [lobbyId, currentUserId, currentUsername]
  );

  // Copy Room Link to Clipboard with vibrant green toast feedback
  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      playCard();
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  // Start Game Trigger (Only for Host)
  const handleStartGame = () => {
    if (totalPlayersCount < 3) {
      showToast(
        'Mafiya oyununa başlamaq üçün ən azı 3-4 oyunçu lazımdır. "⚡ İştirakçıya Tamamla" düyməsinə klikləyərək AI botları masaya əlavə edə bilərsiniz!',
        'warning'
      );
      return;
    }
    const nextPhase: GamePhase =
      lobbyState.mode === 'ALL_IN' ? 'DAY_REGIONAL_CAUCUS' : 'NIGHT_BUFFER';
    const duration = lobbyState.mode === 'ALL_IN' ? 180 : 90;
    playNight();
    dispatchAction({ action: 'START_GAME', nextPhase, durationSeconds: duration });
  };

  // Toggle Ready status
  const handleToggleReady = () => {
    playCard();
    const nextVal = !isReadyLocal;
    setIsReadyLocal(nextVal);
    dispatchAction({ action: 'READY', ready: nextVal });
  };

  // Add bots handlers
  const handleAddBot = () => {
    playCard();
    dispatchAction({ action: 'ADD_BOT' });
  };

  const handleFillBots = () => {
    playCard();
    dispatchAction({ action: 'FILL_BOTS', targetCount: 5 });
  };

  // Governance & Admin Handlers
  const handleDualUnlock = (role: 'THE_ARCHITECT' | 'THE_BAILIFF') => {
    dispatchAction({ action: 'DUAL_UNLOCK', role });
  };

  const handleOverridePhase = (nextPhase: GamePhase, durationSeconds: number) => {
    dispatchAction({ action: 'OVERRIDE_PHASE', nextPhase, durationSeconds });
  };

  const handleCastVote = (candidateId: string) => {
    dispatchAction({ action: 'VOTE', candidateId });
  };

  const handleKickPlayer = (targetId: string) => {
    dispatchAction({ action: 'KICK_PLAYER', targetUserId: targetId });
  };

  const handleRetractVote = () => {
    dispatchAction({ action: 'RETRACT_VOTE' });
  };

  const handleTriggerAction = (actionType: NightActionType, targetPlayerId: string) => {
    playCard();
    dispatchAction({ action: 'NIGHT_ACTION', actionType, targetPlayerId });
    const targetName = lobbyState.players[targetPlayerId]?.username || targetPlayerId;
    const actionNames: Record<NightActionType, string> = {
      KILL: 'Qətl əmri',
      PROTECT: 'Mühafizə əmri',
      INVESTIGATE: 'Təhqiqat sorğusu',
      BLOCK: 'Bloklama əmri',
      MISDIRECT: 'Yönləndirmə əmri',
      FRAME: 'Şər atma əmri',
    };
    showToast(
      `Əmr qeydə alındı: ${actionNames[actionType] || actionType} ➔ ${targetName}`,
      'success'
    );
  };

  const isHost =
    lobbyState.hostUserId === currentUserId ||
    (lobbyState.players[currentUserId]?.isHost ?? false) ||
    Object.keys(lobbyState.players).length <= 1;
  const isLobbyPhase = lobbyState.phase === 'LOBBY';
  const playersList = Object.values(lobbyState.players);
  const totalPlayersCount = playersList.length;
  const currentPack = PACKS_CONFIG[lobbyState.mode];
  const theme = getTheme(lobbyState.mode);

  // Derive my faction for voice phase gating
  const myPlayerSession = lobbyState.players[currentUserId];
  const myFaction: string | null = myPlayerSession
    ? myPlayerSession.allInIdentity?.layer1Faction || 'TOWN'
    : null;

  // Voice-chat peers
  const voicePeers = playersList
    .filter((p) => p.userId !== currentUserId && !p.isAiBotControlled)
    .map((p) => ({
      userId: p.userId,
      isAlive: p.isAlive,
    }));

  
  const [isLastWillOpen, setIsLastWillOpen] = useState<boolean>(false);
  const [isNotebookOpen, setIsNotebookOpen] = useState<boolean>(false);
  const [isShowcaseOpen, setIsShowcaseOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isCompactView, setIsCompactView] = useState<boolean>(false);
  const [isGameOverDismissed, setIsGameOverDismissed] = useState<boolean>(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);
  const [isGraveyardOpen, setIsGraveyardOpen] = useState<boolean>(false);
  
  const submitLastWill = (text: string) => {
    dispatchAction({ action: 'SUBMIT_LAST_WILL', text });
  };

  const lastWills = Object.values(lobbyState.players).reduce((acc, p) => { 
    if (p.lastWill) acc[p.userId] = p.lastWill; 
    return acc; 
  }, {} as Record<string, string>);

  const [isRoleRevealed, setIsRoleRevealed] = useState<boolean>(false);
  const [isNewspaperOpen, setIsNewspaperOpen] = useState<boolean>(false);

  // Auto-progression countdown timer
  const autoProgressTriggeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (lobbyState.phase === 'LOBBY' || lobbyState.phase === 'ENDED') return;

    const timer = setInterval(() => {
      setLobbyState((prev) => {
        if (prev.phase === 'LOBBY' || prev.phase === 'ENDED') return prev;

        let remaining = prev.phaseTimeRemaining;
        if (prev.phaseEndsAt) {
          remaining = Math.max(0, Math.ceil((prev.phaseEndsAt - Date.now()) / 1000));
        } else {
          remaining = Math.max(0, prev.phaseTimeRemaining - 1);
        }

        const phaseKey = `${prev.phase}-${prev.roundNumber}`;
        if (remaining === 0 && autoProgressTriggeredRef.current !== phaseKey) {
          const isUserHost =
            prev.hostUserId === currentUserId ||
            (prev.players[currentUserId]?.isHost ?? false) ||
            Object.keys(prev.players).length <= 1;
          if (isUserHost) {
            autoProgressTriggeredRef.current = phaseKey;
            dispatchAction({ action: 'PROGRESS_PHASE' });
          }
        }

        return {
          ...prev,
          phaseTimeRemaining: remaining,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lobbyState.phase, currentUserId, dispatchAction]);

  // Phase transition detector (audio cues and dawn newspaper auto-popup)
  const prevPhaseRef = useRef<GamePhase>(lobbyState.phase);

  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    const currentPhase = lobbyState.phase;

    if (prevPhase !== currentPhase) {
      prevPhaseRef.current = currentPhase;
      autoProgressTriggeredRef.current = null;

      if (currentPhase === 'NIGHT_BUFFER') {
        playNight();
      } else if (
        currentPhase === 'DAY_VOTING' ||
        currentPhase === 'DAY_CENTRAL_ASSEMBLY' ||
        currentPhase === 'DAY_REGIONAL_CAUCUS'
      ) {
        if (prevPhase === 'NIGHT_BUFFER') {
          const deaths = lobbyState.latestNewspaper?.publicDeaths?.length || 0;
          if (deaths > 0) {
            playElimination();
            const flash = document.createElement('div');
            flash.className = 'fixed inset-0 z-[200] bg-red-600 pointer-events-none transition-opacity duration-1000 mix-blend-overlay';
            flash.style.opacity = '0.8';
            document.body.appendChild(flash);
            setTimeout(() => { flash.style.opacity = '0'; }, 50);
            setTimeout(() => { flash.remove(); }, 1050);
          } else {
            playDay();
          }
          setIsNewspaperOpen(true);
        } else {
          playDay();
        }
      }
    }
  }, [lobbyState.phase]);


  const eloRecordedRef = React.useRef(false);
  useEffect(() => {
    if (lobbyState.phase === 'ENDED' && lobbyState.winnerResult && !eloRecordedRef.current && currentUserId) {
      eloRecordedRef.current = true;
      const me = lobbyState.players[currentUserId];
      const isWinner = lobbyState.winnerResult.winnerPlayerIds.includes(currentUserId);
      const isMafia = me?.allInIdentity?.layer1Faction === 'MAFIA';
      const isJester = me?.allInIdentity?.layer1Faction === 'NEUTRAL_EVIL';
      const isSK = me?.allInIdentity?.layer1Faction === 'NEUTRAL_KILLER';

      recordGameResult(
        currentUserId,
        lobbyId,
        isWinner,
        me?.allInIdentity?.layer1Faction || 'TOWN'
      );

      if (isWinner) {
        setTimeout(() => {
          unlockAchievement({
            id: 'first_win_' + Date.now(),
            title: "İlk Qələbə!",
            description: "Mafiya oyununda uğurla qalib gəldin.",
            category: 'MASTERY',
            tier: 'BRONZE',
            icon: 'fa-trophy',
            xp: 50,
            coinReward: 20
          });
        }, 1500); // Slight delay for dramatic effect
      }
    }
  }, [lobbyState.phase, lobbyState.winnerResult, currentUserId]);

  // Derived state for Newspaper, Investigations, and Winner Modal
  const fallbackNewspaper: MorningNewspaper = {
    publicDeaths: [],
    privateInvestigationResults: [],
    heresyClue: null,
    jitterAppliedMs: 4000,
  };
  const activeNewspaper = lobbyState.latestNewspaper || fallbackNewspaper;

  const playerNames: Record<string, string> = Object.fromEntries(
    Object.values(lobbyState.players).map((p) => [p.userId, p.username])
  );
  const lastLynchedName = lobbyState.lastLynchedUserId
    ? lobbyState.players[lobbyState.lastLynchedUserId]?.username || lobbyState.lastLynchedUserId
    : null;
  const lastLynchedRole = lobbyState.lastLynchedUserId
    ? lobbyState.players[lobbyState.lastLynchedUserId]?.displayRole?.localizedRoleName || lobbyState.players[lobbyState.lastLynchedUserId]?.displayRole?.originalRoleName
    : null;
  const myPrivateInvestigations = lobbyState.privateInvestigations?.[currentUserId] || [];

  const isGameOver =
    lobbyState.phase === 'ENDED' ||
    Boolean(
      lobbyState.winnerResult?.kind && lobbyState.winnerResult.kind !== 'GAME_CONTINUES'
    );
  const winnerKind = lobbyState.winnerResult?.kind;
  const isTownVictory = winnerKind === 'TOWN_VICTORY';
  const isMafiaVictory =
    winnerKind === 'MAFIA_MAJORITY' || winnerKind === 'YAKUZA_MAJORITY';
  const winnerIds = lobbyState.winnerResult?.winnerPlayerIds || [];
  const winnerNames = winnerIds.map((id) => lobbyState.players[id]?.username || id);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 transition-colors duration-200">
      {/* Global Phase Timer Bar */}
      {lobbyState.phase !== 'LOBBY' && lobbyState.phase !== 'ENDED' && lobbyState.phaseDurationSeconds > 0 && (
        <div 
          className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000 ease-linear z-[200] shadow-[0_0_15px_rgba(16,185,129,0.6)]" 
          style={{ width: `${Math.max(0, Math.min(100, (lobbyState.phaseTimeRemaining / Math.max(1, lobbyState.phaseDurationSeconds)) * 100))}%` }} 
        />
      )}
      {/* ─── LOBBY HEADER BAR ───────────────────────────────────────── */}
      <div className="p-6 rounded-[24px] border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all duration-200">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isLobbyPhase ? 'bg-blue-500 ring-2 ring-blue-500/20' : 'bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse'
              }`}
            />
            <h1 className="text-xl sm:text-2xl font-black text-zinc-950 dark:text-white tracking-tight">
              {isLobbyPhase ? 'Gözləmə Otağı (Lobby)' : AZ_PHASES[lobbyState.phase] ?? lobbyState.phase}{' '}
              <span className="text-sm font-semibold text-zinc-400 font-mono">— {lobbyId}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5 mt-2 flex-wrap text-xs text-zinc-600 dark:text-zinc-400">
            <Badge tone="purple">{currentPack?.name || lobbyState.mode.replace(/_/g, ' ')}</Badge>
            <span>•</span>
            <span>
              Masada:{' '}
              <strong className="text-zinc-900 dark:text-zinc-100">{totalPlayersCount} Oyunçu</strong>
            </span>
            <span>•</span>
            <span>
              Siz:{' '}
              <strong className="text-zinc-900 dark:text-zinc-100">{currentUsername}</strong>{' '}
              {isHost && <span className="text-amber-600 dark:text-amber-400 font-bold">(Host)</span>}
            </span>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant={copiedLink ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleCopyLink}
            icon={copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <LinkIcon className="w-4 h-4" />}
          >
            {copiedLink ? 'Link Kopyalandı' : 'Dəvət Linkini Kopyala'}
          </Button>

          {/* Sound Toggle in Lobby */}
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

          {isLobbyPhase && (
            <Button
              variant={isReadyLocal ? 'secondary' : 'warning'}
              size="sm"
              onClick={handleToggleReady}
              icon={isReadyLocal ? <Check className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4" />}
            >
              {isReadyLocal ? 'Mən Hazıram' : 'Hazır Ol'}
            </Button>
          )}

          {isLobbyPhase && isHost && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddBot}
                icon={<Bot className="w-4 h-4" />}
              >
                +1 AI Bot
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleFillBots}
                icon={<Zap className="w-4 h-4 text-amber-500" />}
              >
                5 Botla Doldur
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartGame}
                icon={<Play className="w-4 h-4" />}
              >
                Oyunu Başlat
              </Button>
            </>
          )}

          {!isLobbyPhase && isHost && lobbyState.phase !== 'ENDED' && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                playDay();
                dispatchAction({ action: 'PROGRESS_PHASE' });
              }}
            >
              {lobbyState.phase === 'NIGHT_BUFFER' ? '🌅 Gecəni Bitir → Səhər' : '⚖️ Səsləri Hesabla'}
            </Button>
          )}
        </div>
      </div>

      {/* ─── GREEN TOAST FEEDBACK FOR COPIED LINK ───────────────────── */}
      {copiedLink && (
        <div className="p-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 text-sm font-bold flex items-center justify-between shadow-lg shadow-emerald-500/10 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 stroke-[3]" />
            </span>
            <span>
              <strong>Dəvət Linki Panoya Kopyalandı!</strong> Dostlarınıza göndərin — daxil olduqda dərhal bu masada görünəcəklər.
            </span>
          </div>
          <span className="text-xs bg-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
            URL Hazırdır
          </span>
        </div>
      )}

      {/* ─── 1. LOBBY PHASE ─────────────────────────────────────────── */}
      {isLobbyPhase ? (
        <div className="flex flex-col gap-6">
          {/* Table Configuration & Rules Summary Card */}
          <div className={`p-5 sm:p-6 flex flex-col gap-4 ${theme.lobbyContainer}`}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-red-500" />
                <h3 className="font-extrabold text-sm sm:text-base text-zinc-950 dark:text-white">
                  Masa Konfiqurasiyası və Qaydalar Xülasəsi
                </h3>
              </div>
              <Badge tone="purple">{currentPack?.minTier || 'TIER_1'}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Oyun Rejimi
                </span>
                <span className="font-extrabold text-zinc-900 dark:text-zinc-100 text-sm">
                  {currentPack?.name || lobbyState.mode.replace(/_/g, ' ')}
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                  {currentPack?.isMinigame ? 'Xüsusi Mini-oyun Formatı' : 'Klassik Sosial Deduksiya'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Oyunçu Limiti
                </span>
                <span className="font-extrabold text-zinc-900 dark:text-zinc-100 text-sm">
                  {currentPack?.minPlayers ?? 5} - {currentPack?.maxPlayers ?? 7} İştirakçı
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                  Hazırda: <strong>{totalPlayersCount} oyunçu</strong> qoşulub
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Fazaların Müddəti
                </span>
                <span className="font-extrabold text-zinc-900 dark:text-zinc-100 text-sm">
                  Gündüz: {currentPack?.defaultTimings.dayCentralAssemblySeconds ?? 180}s | Gecə: {currentPack?.defaultTimings.nightBufferSeconds ?? 45}s
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                  Səsvermə: {currentPack?.defaultTimings.dayVotingSeconds ?? 60}s
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Mühafizə & Audio
                </span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" />
                  Anti-AFK Gemini 3.8
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                  WebRTC P2P Canlı Səsli Rabitə
                </span>
              </div>
            </div>

            {currentPack?.roleBreakdown && (
              <div className="p-3.5 rounded-xl bg-red-500/10 dark:bg-red-950/30 border border-red-500/25 flex items-start gap-2.5 text-xs text-red-900 dark:text-red-200">
                <Sparkles className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-black text-red-600 dark:text-red-400 uppercase tracking-wide">
                    Bu Masanın Rol Bölgüsü:
                  </strong>
                  <p className="mt-0.5 font-medium leading-relaxed">
                    {currentPack.roleBreakdown}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Connected Players Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-zinc-950 dark:text-white">
                  Masadakı Oyunçular
                </h2>
                <Badge tone="neutral">{totalPlayersCount}</Badge>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Dostlarınız linklə daxil olduqca avtomatik bura əlavə olunurlar
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {playersList.map((p, index) => (
                <PlayerCard isCompact={isCompactView}
                      style={{ animationDelay: `${index * 30}ms` }}
                  key={p.userId}
                  player={p}
                  isLobbyPhase={true}
                  isSelf={p.userId === currentUserId}
                  isReady={p.isHost || isReadyLocal}
                />
              ))}
            </div>
          </div>

          {/* Lobby Footer Action Box */}
          <div className="p-6 rounded-[24px] border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                {isHost ? 'Siz bu masanın rəhbərisiniz (Host)' : 'Masa Rəhbərinin oyunu başlatması gözlənilir'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {isHost
                  ? 'Bütün dostlarınız masaya toplaşdıqdan sonra oyunu başlada bilərsiniz.'
                  : 'Hazır olduğunuzu bildirmək üçün "Hazır Ol" düyməsinə klikləyin.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isHost ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleStartGame}
                  icon={<Play className="w-4 h-4" />}
                >
                  Oyunu İndi Başlat
                </Button>
              ) : (
                <Button
                  variant={isReadyLocal ? 'secondary' : 'warning'}
                  size="md"
                  onClick={handleToggleReady}
                  icon={isReadyLocal ? <Check className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4" />}
                >
                  {isReadyLocal ? 'Mən Hazıram' : 'Hazır Ol'}
                </Button>
              )}
            </div>
          </div>

          {/* Collapsible Admin Drawer for Host */}
          {isHost && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdminTools(!showAdminTools)}
                className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {showAdminTools ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{showAdminTools ? 'İnzibati Alətləri Gizlət' : 'Qabaqcıl İnzibati Alətlər (Admin Paneli)'}</span>
              </button>

              {showAdminTools && (
                <div className="mt-4 flex flex-col gap-4 animate-fadeIn">
                  {lobbyState.mode === 'ALL_IN' && (
                    <AdminDualLockPanel
                      unlockState={lobbyState.adminMasterUnlock}
                      currentUserRole="THE_ARCHITECT"
                      currentUserId={currentUserId}
                      isHost={isHost}
                      hostReady={lobbyState.hostReady}
                      assignedArchitectId={lobbyState.assignedArchitectId}
                      assignedBailiffId={lobbyState.assignedBailiffId}
                      eligibleWaiverPlayers={[]}
                      onUnlockSubmit={handleDualUnlock}
                      onHostReadyToggle={(ready) => dispatchAction({ action: 'READY', ready })}
                      onGrantWaiver={() => {}}
                    />
                  )}

                  <ArchitectConsole
                    lobbyState={lobbyState}
                    onOverridePhase={handleOverridePhase}
                    onConfigureJitter={(val) =>
                      setLobbyState((prev) => ({ ...prev, nightJitterDelaySeconds: val }))
                    }
                  />

                  <BailiffConsole
                    lobbyState={lobbyState}
                    onNextSpeaker={() => {}}
                    onAddSpeaker={() => {}}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ─── 2. ACTIVE GAME PHASE ───────────────────────────────────── */
        <div className="flex flex-col gap-6">
          {/* Secret Role Card with Dynamic Faction Glow */}
          {(() => {
            const roleStr = lobbyState.players[currentUserId]?.displayRole.formatted ?? '';
            const isMafia = roleStr.toLowerCase().includes('mafiya') || roleStr.toLowerCase().includes('mafia') || roleStr.toLowerCase().includes('don');
            const isNeutral = roleStr.toLowerCase().includes('qatil') || roleStr.toLowerCase().includes('yandırıcı') || roleStr.toLowerCase().includes('təlxək');
            
            let containerBg = 'bg-gradient-to-r from-emerald-500/15 via-emerald-600/10 to-emerald-500/15';
            let borderColor = 'border-emerald-500/40';
            let shadowColor = 'shadow-[0_0_25px_rgba(16,185,129,0.25)]';
            let iconBg = 'bg-gradient-to-tr from-emerald-600 to-teal-500';
            let iconShadow = 'shadow-emerald-500/30';
            let textTop = 'text-emerald-700 dark:text-emerald-300';
            let badgeBg = 'bg-emerald-600';
            let badgeShadow = 'shadow-emerald-600/30';
            let RoleIcon = Shield;

            if (!isRoleRevealed) {
              containerBg = 'bg-zinc-100 dark:bg-zinc-900';
              borderColor = 'border-zinc-300 dark:border-zinc-700';
              shadowColor = 'shadow-none';
              iconBg = 'bg-zinc-300 dark:bg-zinc-800';
              iconShadow = 'shadow-none';
              textTop = 'text-zinc-500 dark:text-zinc-400';
              badgeBg = 'bg-zinc-500';
              badgeShadow = 'shadow-none';
              RoleIcon = Eye;
            } else if (isMafia) {
              containerBg = 'bg-gradient-to-r from-red-500/15 via-red-600/10 to-red-500/15';
              borderColor = 'border-red-500/40';
              shadowColor = 'shadow-[0_0_25px_rgba(239,68,68,0.25)]';
              iconBg = 'bg-gradient-to-tr from-red-600 to-orange-600';
              iconShadow = 'shadow-red-500/30';
              textTop = 'text-red-700 dark:text-red-300';
              badgeBg = 'bg-red-600';
              badgeShadow = 'shadow-red-600/30';
              RoleIcon = Target;
            } else if (isNeutral) {
              containerBg = 'bg-gradient-to-r from-purple-500/15 via-purple-600/10 to-purple-500/15';
              borderColor = 'border-purple-500/40';
              shadowColor = 'shadow-[0_0_25px_rgba(168,85,247,0.25)]';
              iconBg = 'bg-gradient-to-tr from-purple-600 to-fuchsia-600';
              iconShadow = 'shadow-purple-500/30';
              textTop = 'text-purple-700 dark:text-purple-300';
              badgeBg = 'bg-purple-600';
              badgeShadow = 'shadow-purple-600/30';
              RoleIcon = Eye;
            }

            return (
              <div 
                onClick={() => setIsRoleRevealed(!isRoleRevealed)}
                className={`p-5 rounded-2xl border ${borderColor} ${containerBg} ${shadowColor} flex items-center justify-between gap-4 transition-all duration-300 cursor-pointer hover:-translate-y-0.5 active:translate-y-0`}
                title="Rolunuzu görmək/gizlətmək üçün klikləyin"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${iconBg} text-white flex items-center justify-center shadow-lg ${iconShadow} transition-colors duration-300`}>
                    <RoleIcon className={`w-6 h-6 ${!isRoleRevealed ? 'opacity-50' : ''}`} strokeWidth={2.5} />
                  </div>
                  <div>
                    <span className={`text-[11px] font-extrabold uppercase tracking-[0.2em] block ${textTop} transition-colors duration-300`}>
                      ${isRoleRevealed ? 'SİZİN GİZLİ KİMLİYİNİZ' : 'MƏXFİ DOSYE (Gizlidir)'}
                    </span>
                    <div className={`text-2xl font-black tracking-tight mt-0.5 transition-colors duration-300 ${!isRoleRevealed ? 'text-zinc-400 dark:text-zinc-600 select-none blur-[4px]' : 'text-zinc-950 dark:text-white'}`}>
                      {roleStr || `${currentUsername} (Vətəndaş)`}
                    </div>
                  </div>
                </div>

                <div className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-md ${badgeBg} ${badgeShadow} hidden sm:flex items-center gap-2 transition-colors duration-300`}>
                  {isRoleRevealed ? 'GİZLƏT' : 'GÖSTƏR'}
                </div>
              </div>
            );
          })()}

          <CinematicVignette phase={lobbyState.phase} />
          <PhaseTransitionOverlay phase={lobbyState.phase} />
          <ExecutionOverlay lynchedPlayerName={lastLynchedName} lynchedRole={lastLynchedRole} />

          {/* Interactive Game Board */}
          <GameBoard
            lobbyState={lobbyState}
            currentUserId={currentUserId}
            onOpenNewspaper={() => setIsNewspaperOpen(true)}
            onCastVote={handleCastVote}
            onRetractVote={handleRetractVote}
            onTriggerAction={handleTriggerAction}
            onKickPlayer={handleKickPlayer}
            speakingIds={speakingIds}
          />

          {/* Voice Chat */}
          <VoiceChat
            lobbyId={lobbyId}
            myUserId={currentUserId}
            myFaction={myFaction}
            phase={lobbyState.phase}
            peers={voicePeers}
            onSpeakingChange={setSpeakingIds}
          />


          {/* Morning Newspaper Modal */}
          <MorningNewspaperModal
            isOpen={isNewspaperOpen}
            newspaper={activeNewspaper}
            roundNumber={lobbyState.roundNumber}
            minigameSubStates={lobbyState.minigameSubStates}
            lastLynchedPlayerName={lastLynchedName}
            playerNames={playerNames}
            privateInvestigations={myPrivateInvestigations}
            hasMutinyOccurred={lobbyState.mafiaMutinyActive ?? false}
            lastWills={lastWills}
            onClose={() => setIsNewspaperOpen(false)}
          />
        </div>
      )}

      {/* RE-OPEN GAME OVER BUTTON */}
      {isGameOver && isGameOverDismissed && (
        <button
          onClick={() => setIsGameOverDismissed(false)}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/90 hover:bg-zinc-800 text-white px-4 py-2 rounded-full shadow-lg border border-zinc-700 font-bold tracking-widest text-xs uppercase animate-bounce"
        >
          YEKUN NƏTİCƏNİ GÖSTƏR
        </button>
      )}
      {/* ─── GAME OVER / VICTORY MODAL ───────────────────────────────── */}
      {isGameOver && !isGameOverDismissed && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn transition-colors duration-1000 ${isTownVictory ? 'bg-emerald-950/80' : isMafiaVictory ? 'bg-red-950/80' : 'bg-black/85'} backdrop-blur-sm`}>
          <div className={`w-full max-w-2xl rounded-[32px] border ${isTownVictory ? 'border-emerald-500/40' : isMafiaVictory ? 'border-red-500/40' : 'border-purple-500/40'} bg-white/5 dark:bg-zinc-950/80  text-zinc-950 dark:text-white p-8 sm:p-12 shadow-2xl flex flex-col items-center text-center gap-8 relative`}>
            <button 
              onClick={() => setIsGameOverDismissed(true)} 
              className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-50 text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="relative">
              
              
              
              
              <div className={`relative z-10 w-32 h-32 rounded-[40px] flex items-center justify-center shadow-2xl ${isTownVictory ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-emerald-500/40' : isMafiaVictory ? 'bg-gradient-to-tr from-red-600 to-orange-500 shadow-red-500/40' : 'bg-gradient-to-tr from-purple-600 to-amber-500 shadow-purple-500/40'}`}>
                {isTownVictory ? <Shield className="w-16 h-16 text-white" /> : isMafiaVictory ? <Target className="w-16 h-16 text-white" /> : <Skull className="w-16 h-16 text-white" />}
              </div>
            </div>

            <div>
              <span className={`text-sm font-black uppercase tracking-[0.3em] ${isTownVictory ? 'text-emerald-400' : isMafiaVictory ? 'text-red-400' : 'text-purple-400'}`}>
                YEKUN NƏTİCƏ
              </span>
              <h2 className="text-4xl sm:text-5xl font-black mt-3 tracking-tight drop-shadow-md">
                {isTownVictory
                  ? 'ŞƏHƏR QALİB GƏLDİ!'
                  : isMafiaVictory
                  ? 'MAFİYA ŞƏHƏRİ ƏLƏ KEÇİRDİ!'
                  : 'OYUN BAŞA ÇATDI!'}
              </h2>
              <p className="text-base text-zinc-600 dark:text-zinc-300 mt-4 max-w-lg mx-auto font-medium leading-relaxed opacity-80">
                {lobbyState.winnerResult?.reason ||
                  'Bütün rəqiblər aradan qaldırıldı və qələbə şərti tam təmin olundu.'}
              </p>
            </div>

            {winnerNames.length > 0 && (
              <div className={`w-full p-6 rounded-[20px] bg-black/20 border ${isTownVictory ? 'border-emerald-500/20' : isMafiaVictory ? 'border-red-500/20' : 'border-purple-500/20'} text-left`}>
                <div className={`text-xs font-black uppercase tracking-[0.2em] mb-4 ${isTownVictory ? 'text-emerald-500' : isMafiaVictory ? 'text-red-500' : 'text-purple-500'}`}>
                  QALİB HEYƏT:
                </div>
                <div className="flex flex-wrap gap-3">
                  {winnerNames.map((name, i) => (
                    <div key={i} className={`px-4 py-2 rounded-xl text-sm font-bold shadow-md ${isTownVictory ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : isMafiaVictory ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'}`}>
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Post-Game True Roles Reveal Table */}
            <div className="w-full mt-2 mb-2 p-1">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mb-3 ml-2">
                Tam İfşa (Bütün Rollar)
              </div>
              <div className="flex flex-col gap-2 max-h-[35vh] overflow-y-auto custom-scrollbar pr-2">
                {Object.values(lobbyState.players).map(p => {
                  const pFaction = p.allInIdentity?.layer1Faction || 'TOWN';
                  const isPMafia = pFaction === 'MAFIA' || pFaction === 'YAKUZA' || pFaction === 'VOID_CULT' || pFaction === 'NEUTRAL_KILLER';
                  return (
                    <div key={p.userId} className={`flex items-center justify-between p-3 rounded-xl border ${isPMafia ? 'bg-red-950/20 border-red-900/30' : pFaction.includes('NEUTRAL') ? 'bg-purple-950/20 border-purple-900/30' : 'bg-emerald-950/20 border-emerald-900/30'}`}>
                      <div className="flex flex-col">
                        <span className={`font-bold ${!p.isAlive ? 'line-through opacity-50' : ''}`}>
                          {p.username} {p.userId === currentUserId ? '(Siz)' : ''}
                        </span>
                        <span className={`text-xs font-black uppercase tracking-wider ${isPMafia ? 'text-red-400' : pFaction.includes('NEUTRAL') ? 'text-purple-400' : 'text-emerald-400'}`}>
                          {p.displayRole.localizedRoleName || p.displayRole.originalRoleName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.isAlive ? (
                          <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-wider">Sağdır</span>
                        ) : (
                          <span className="px-2 py-1 rounded bg-zinc-500/20 text-zinc-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><Skull className="w-3 h-3"/> Ölü</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="w-full mt-4">
              <Button
                variant="primary"
                size="lg"
                className={`w-full h-14 text-lg font-black tracking-widest uppercase transition-all duration-300 hover:scale-[1.02] active:scale-95 ${isTownVictory ? 'bg-emerald-600 hover:bg-emerald-500 ring-emerald-500/30 border-none' : isMafiaVictory ? 'bg-red-600 hover:bg-red-500 ring-red-500/30 border-none' : ''}`}
                onClick={() => {
                  playCard();
                  dispatchAction({ action: 'RESTART_GAME' });
                }}
                icon={<RotateCcw className="w-5 h-5 mr-2" />}
              >
                YENİDƏN BAŞLA
              </Button>
            </div>
          </div>
        </div>
      )}

      <AmbientWeather phase={lobbyState.phase} />
      
      {/* ─── DETECTIVE NOTEBOOK ────────────────────────────────────── */}
      {!isGameOver && lobbyState.phase !== 'LOBBY' && (
        <>
          <button
            onClick={() => setIsNotebookOpen(true)}
            title="Detektiv Qeydləri"
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl bg-indigo-900/90 text-indigo-100 shadow-[0_0_20px_rgba(49,46,129,0.5)] flex items-center justify-center hover:bg-indigo-800 hover:scale-105 active:scale-95 transition-all border border-indigo-500/30"
          >
            <PenTool className="w-6 h-6" />
          </button>
          
          <DetectiveNotebook
            isOpen={isNotebookOpen}
            onClose={() => setIsNotebookOpen(false)}
            userId={currentUserId}
          />
        </>
      )}

{/* ─── CHATS ─────────────────────────────────────────────────── */}
      {!isGameOver && myPlayerSession && !myPlayerSession.isAlive && lobbyState.phase !== 'LOBBY' && (
        <GhostChat
          currentUserId={currentUserId}
          currentUsername={currentUsername}
          isAlive={myPlayerSession.isAlive}
          lobbyId={lobbyId}
          phase={lobbyState.phase}
          deadPlayerNames={Object.values(lobbyState.players)
            .filter(p => !p.isAlive)
            .map(p => ({ userId: p.userId, username: p.username }))}
          messages={lobbyState.chatMessages?.filter(m => m.channel === 'DEAD') || []}
          onSendMessage={(content) => dispatchAction({ action: 'SEND_MESSAGE', content, channel: 'DEAD' })}
        />
      )}

      {!isGameOver && myPlayerSession && myPlayerSession.isAlive && myFaction === 'MAFIA' && lobbyState.phase !== 'LOBBY' && (
        <FactionChat
          currentUserId={currentUserId}
          currentUsername={currentUsername}
          faction="MAFIA"
          lobbyId={lobbyId}
          phase={lobbyState.phase}
          factionMates={Object.values(lobbyState.players)
            .filter(p => p.isAlive && (
              p.displayRole?.formatted?.toLowerCase().includes('mafiya') ||
              p.displayRole?.formatted?.toLowerCase().includes('mafia')
            ))
            .map(p => ({ userId: p.userId, username: p.username }))}
          messages={lobbyState.chatMessages?.filter(m => m.channel === 'MAFIA') || []}
          onSendMessage={(content) => dispatchAction({ action: 'SEND_MESSAGE', content, channel: 'MAFIA' })}
        />
      )}

      
      
      {/* ─── CINEMATIC GAME INTRO ──────────────────────────────────── */}
      {myPlayerSession && (
        <GameIntroOverlay 
          phase={lobbyState.phase} 
          roleName={myPlayerSession.displayRole?.localizedRoleName || myPlayerSession.displayRole?.originalRoleName || 'Vətəndaş'}
          roleFaction={myFaction === 'MAFIA' ? 'MAFIA' : myFaction === 'NEUTRAL' ? 'NEUTRAL' : 'TOWN'}
        />
      )}
      <AchievementShowcaseModal 
        isOpen={isShowcaseOpen}
        onClose={() => setIsShowcaseOpen(false)}
        userId={currentUserId}
      />
            <ProfileModal 
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUsername={currentUsername}
        onUpdateUsername={(name) => {
          setCurrentUsername(name);
          localStorage.setItem('mafia_username', name);
          // Only updates local state, to update server requires a socket event.
        }}
        tier={currentUserTier}
        totalXp={0}
      />
      {/* ─── ACHIEVEMENT TOAST SYSTEM ──────────────────────────────── */}
      <AchievementToastSystem />

      {/* ─── FLOATING TOAST NOTIFICATION ─────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl border shadow-2xl flex items-center gap-3 transition-all animate-bounceIn max-w-md ${
            toast.tone === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/95 text-emerald-100 shadow-emerald-500/20'
              : toast.tone === 'warning'
              ? 'border-amber-500/40 bg-amber-950/95 text-amber-100 shadow-amber-500/20'
              : toast.tone === 'danger'
              ? 'border-red-500/40 bg-red-950/95 text-red-100 shadow-red-500/20'
              : 'border-purple-500/40 bg-purple-950/95 text-purple-100 shadow-purple-500/20'
          }`}
        >
          <span className="text-base shrink-0">
            {toast.tone === 'success'
              ? '✅'
              : toast.tone === 'warning'
              ? '⚠️'
              : toast.tone === 'danger'
              ? '⛔'
              : 'ℹ️'}
          </span>
          <span className="text-xs sm:text-sm font-semibold leading-snug">
            {toast.message}
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-auto p-1 text-xs opacity-70 hover:opacity-100 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Son Vəsiyyət Button */}
      {myPlayerSession && myPlayerSession.isAlive && lobbyState.phase !== 'ENDED' && (
        <button
          onClick={() => setIsLastWillOpen(true)}
          title="Son Vəsiyyət"
          className="fixed bottom-6 left-6 z-40 p-3 rounded-full bg-amber-900/90 hover:bg-amber-800 text-amber-100 shadow-[0_0_20px_rgba(120,53,15,0.5)] border border-amber-500/30 transition-transform hover:scale-110 active:scale-95"
        >
          <PenTool className="w-5 h-5" />
        </button>
      )}

      {/* Qəzet Arxivi Button */}
      {myPlayerSession && lobbyState.pastNewspapers && lobbyState.pastNewspapers.length > 0 && (
        <button
          onClick={() => setIsArchiveOpen(true)}
          title="Qəzet Arxivi"
          className="fixed bottom-6 left-24 z-40 p-3 rounded-full bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_20px_rgba(217,119,6,0.5)] border border-amber-500/30 transition-transform hover:scale-110 active:scale-95"
        >
          <BookOpen className="w-5 h-5" />
        </button>
      )}

      <LastWillModal
        isOpen={isLastWillOpen}
        initialText={myPlayerSession?.lastWill || localStorage.getItem(`mafia_lastwill_${currentUserId}_${lobbyId}`) || ''}
        isDead={!myPlayerSession?.isAlive}
        onClose={() => setIsLastWillOpen(false)}
        onSave={(text) => {
          localStorage.setItem(`mafia_lastwill_${currentUserId}_${lobbyId}`, text);
          dispatchAction({ action: 'SUBMIT_LAST_WILL', text: text });
          setIsLastWillOpen(false);
          showToast('Son Vəsiyyət qeydə alındı.', 'success');
        }}
      />

      <ArchiveModal 
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        pastNewspapers={lobbyState.pastNewspapers || []}
        playerNames={playerNames}
      />

    </div>
  );
}