/**
 * In-Memory Lobby State Store & Atomic State Engine
 * Enterprise Mafia / Social Deduction Platform - Phase 1 Foundation
 */

import { AdminRole, satisfiesTierRequirement, WaiverRecord } from '../../types/access';
import {
  AdminMasterUnlockState,
  GamePhase,
  LobbyState,
  NightActionBufferItem,
  PlayerSession,
} from '../../types/game';
import { GameMode } from '../../types/packs';
import { PACKS_CONFIG } from '../../config/packs.config';

import { ChatMessage } from '../../types/game';

export class InMemoryLobbyStore {
  private lobbies: Map<string, LobbyState> = new Map();
  private waivers: Map<string, WaiverRecord[]> = new Map(); // lobbyId -> waivers

  /** Retrieve current lobby state or null */
  
  public addChatMessage(lobbyId: string, message: ChatMessage): LobbyState | null {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;
    
    // Keep only last 100 messages to prevent memory leak
    const newMessages = [...lobby.chatMessages, message].slice(-100);
    
    const updated = { ...lobby, chatMessages: newMessages };
    this.lobbies.set(lobbyId, updated);
    return updated;
  }

  public getLobby(lobbyId: string): LobbyState | null {
    return this.lobbies.get(lobbyId) || null;
  }

  /** Initialize a new lobby with strict default configurations */
  public createLobby(
    lobbyId: string,
    hostUserId: string,
    hostSession: PlayerSession,
    mode: GameMode
  ): LobbyState {
    const metadata = PACKS_CONFIG[mode] || PACKS_CONFIG['BLITZ'];
    const initialUnlock: AdminMasterUnlockState = {
      architectUnlocked: false,
      bailiffUnlocked: false,
      dualLockVerified: !metadata.platformAdminRequired, // Non-All-In lobbies do not require dual-lock
      unlockedAt: metadata.platformAdminRequired ? null : Date.now(),
    };

    const initialLobby: LobbyState = {
      lobbyId,
      hostUserId,
      mode,
      phase: 'LOBBY',
      players: { [hostSession.userId]: hostSession },
      hostReady: false,
      adminMasterUnlock: initialUnlock,
      assignedArchitectId: null,
      assignedBailiffId: null,
      phaseDurationSeconds: metadata.defaultTimings.dayCentralAssemblySeconds,
      phaseTimeRemaining: metadata.defaultTimings.dayCentralAssemblySeconds,
      phaseEndsAt: null,
      nightJitterDelaySeconds: this.computeNightJitter(),
      activeEmotes: {},
      liveVotes: {},
      speakerQueue: [],
      bufferedNightActions: [],
      chatMessages: [],
      minigameSubStates: {},
      roundNumber: 0,
      lastLynchedUserId: null,
      globalNightKillCap: mode === 'ALL_IN' ? 3 : 99,
      latestNewspaper: null,
      privateInvestigations: {},
      winnerResult: null,
      stateVersion: 0,
    };

    this.lobbies.set(lobbyId, initialLobby);
    this.waivers.set(lobbyId, []);
    return initialLobby;
  }

  /** Validate access and join a player to the lobby session */
  public joinPlayer(lobbyId: string, player: PlayerSession): { success: boolean; error?: string; lobby?: LobbyState } {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      return { success: false, error: 'LOBBY_NOT_FOUND' };
    }

    if (lobby.phase !== 'LOBBY') {
      return { success: false, error: 'GAME_ALREADY_IN_PROGRESS' };
    }

    const metadata = PACKS_CONFIG[lobby.mode] || PACKS_CONFIG['BLITZ'];
    const currentCount = Object.keys(lobby.players).length;

    if (currentCount >= metadata.maxPlayers) {
      return { success: false, error: 'LOBBY_CAPACITY_EXCEEDED' };
    }

    // Check tier qualifications & waiver status
    const tierSufficient = satisfiesTierRequirement(player.tier, metadata.minTier);
    const waiverExempt = player.hasHostWaiver || player.hasAdminWaiver;

    if (!tierSufficient && !waiverExempt) {
      return { success: false, error: 'INSUFFICIENT_TIER_NO_WAIVER' };
    }

    if (metadata.requiresExamProof && !player.hasAdminWaiver && !tierSufficient) {
      return { success: false, error: 'EXAM_CERTIFICATION_REQUIRED' };
    }

    // Assign admin role positions if relevant
    let assignedArchitectId = lobby.assignedArchitectId;
    let assignedBailiffId = lobby.assignedBailiffId;

    if (player.adminRole === 'THE_ARCHITECT' && !assignedArchitectId) {
      assignedArchitectId = player.userId;
    } else if (player.adminRole === 'THE_BAILIFF' && !assignedBailiffId) {
      assignedBailiffId = player.userId;
    }

    const updatedLobby: LobbyState = {
      ...lobby,
      assignedArchitectId,
      assignedBailiffId,
      players: {
        ...lobby.players,
        [player.userId]: player,
      },
    };

    this.lobbies.set(lobbyId, updatedLobby);
    return { success: true, lobby: updatedLobby };
  }

  /**
   * Dual-Lock Platform Admin Authorization:
   * In ALL_IN mode (40-50 players), both THE_ARCHITECT and THE_BAILIFF must independently unlock.
   */
  public submitAdminUnlock(
    lobbyId: string,
    adminUserId: string,
    role: AdminRole
  ): { success: boolean; error?: string; dualLockVerified: boolean; lobby?: LobbyState } {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      return { success: false, error: 'LOBBY_NOT_FOUND', dualLockVerified: false };
    }

    if (role !== 'THE_ARCHITECT' && role !== 'THE_BAILIFF') {
      return { success: false, error: 'UNAUTHORIZED_ADMIN_ROLE', dualLockVerified: false };
    }

    const currentLock = lobby.adminMasterUnlock;
    const isArchitect = role === 'THE_ARCHITECT';
    const isBailiff = role === 'THE_BAILIFF';

    const architectUnlocked = isArchitect ? true : currentLock.architectUnlocked;
    const bailiffUnlocked = isBailiff ? true : currentLock.bailiffUnlocked;
    const dualLockVerified = architectUnlocked && bailiffUnlocked;

    const updatedLock: AdminMasterUnlockState = {
      architectUnlocked,
      bailiffUnlocked,
      dualLockVerified,
      unlockedAt: dualLockVerified ? Date.now() : currentLock.unlockedAt,
    };

    const updatedLobby: LobbyState = {
      ...lobby,
      adminMasterUnlock: updatedLock,
      assignedArchitectId: isArchitect ? adminUserId : lobby.assignedArchitectId,
      assignedBailiffId: isBailiff ? adminUserId : lobby.assignedBailiffId,
    };

    this.lobbies.set(lobbyId, updatedLobby);
    return { success: true, dualLockVerified, lobby: updatedLobby };
  }

  /** Record a granted waiver */
  public recordWaiver(lobbyId: string, record: WaiverRecord): boolean {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return false;

    const list = this.waivers.get(lobbyId) ?? [];
    list.push(record);
    this.waivers.set(lobbyId, list);

    // Update target player session if present in lobby
    const player = lobby.players[record.grantedToUserId];
    if (player) {
      const isHostGrant = record.grantedByRole === 'HOST';
      const updatedPlayer: PlayerSession = {
        ...player,
        hasHostWaiver: isHostGrant ? true : player.hasHostWaiver,
        hasAdminWaiver: !isHostGrant ? true : player.hasAdminWaiver,
      };

      this.lobbies.set(lobbyId, {
        ...lobby,
        players: {
          ...lobby.players,
          [player.userId]: updatedPlayer,
        },
      });
    }

    return true;
  }

  /**
   * Buffer a night action for delayed priority resolution.
   * Actions are sorted strictly by priority (1: BLOCK, 2: PROTECT, 3: MISDIRECT, 4: FRAME, 5: INVESTIGATE, 6: KILL).
   */
  public bufferNightAction(lobbyId: string, action: NightActionBufferItem): { success: boolean; queueLength: number } {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { success: false, queueLength: 0 };

    if (lobby.phase !== 'NIGHT_BUFFER') {
      return { success: false, queueLength: lobby.bufferedNightActions.length };
    }

    // Insert and sort by ascending priority number (1 highest, 6 lowest)
    const updatedActions = [...lobby.bufferedNightActions, action].sort((a, b) => a.priority - b.priority);

    this.lobbies.set(lobbyId, {
      ...lobby,
      bufferedNightActions: updatedActions,
    });

    return { success: true, queueLength: updatedActions.length };
  }

  /** Transition lobby to next phase with night jitter computation */
  public transitionPhase(lobbyId: string, nextPhase: GamePhase, durationSeconds: number): LobbyState | null {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;

    const updatedLobby: LobbyState = {
      ...lobby,
      phase: nextPhase,
      phaseDurationSeconds: durationSeconds,
      phaseTimeRemaining: durationSeconds,
      phaseEndsAt: nextPhase === 'ENDED' || nextPhase === 'LOBBY' ? null : Date.now() + durationSeconds * 1000,
      nightJitterDelaySeconds: nextPhase === 'NIGHT_BUFFER' ? this.computeNightJitter() : lobby.nightJitterDelaySeconds,
      liveVotes: nextPhase === 'DAY_VOTING' ? {} : lobby.liveVotes,
      bufferedNightActions: nextPhase === 'NIGHT_BUFFER' ? [] : lobby.bufferedNightActions,
      roundNumber: nextPhase === 'DAY_REGIONAL_CAUCUS' || nextPhase === 'DAY_CENTRAL_ASSEMBLY' ? lobby.roundNumber + 1 : lobby.roundNumber,
    };

    this.lobbies.set(lobbyId, updatedLobby);
    return updatedLobby;
  }

  /** Synchronize remaining seconds based on authoritative phaseEndsAt */
  public syncCountdown(lobbyId: string): LobbyState | null {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;
    if (!lobby.phaseEndsAt || lobby.phase === 'LOBBY' || lobby.phase === 'ENDED') {
      return lobby;
    }
    const remaining = Math.max(0, Math.ceil((lobby.phaseEndsAt - Date.now()) / 1000));
    if (remaining !== lobby.phaseTimeRemaining) {
      const updated = { ...lobby, phaseTimeRemaining: remaining };
      this.lobbies.set(lobbyId, updated);
      return updated;
    }
    return lobby;
  }

  /** Compute 3-7s jitter delay to prevent timing deduction */
  private computeNightJitter(): number {
    return Math.floor(Math.random() * 5) + 3; // 3, 4, 5, 6, 7
  }

  /** Update lobby with an updater function — increments stateVersion for optimistic locking */
  public updateLobby(lobbyId: string, updater: (lobby: LobbyState) => LobbyState): LobbyState | null {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;
    const updated = { ...updater(lobby), stateVersion: (lobby.stateVersion ?? 0) + 1 };
    this.lobbies.set(lobbyId, updated);
    return updated;
  }

  /** Cast a vote atomically */
  public castVote(lobbyId: string, voterId: string, candidateId: string): LobbyState | null {
    return this.updateLobby(lobbyId, (lobby) => ({
      ...lobby,
      liveVotes: {
        ...lobby.liveVotes,
        [voterId]: candidateId,
      },
    }));
  }

  /** Retract vote atomically */
  public addEmote(lobbyId: string, userId: string, emote: string): LobbyState | null {
    return this.updateLobby(lobbyId, (lobby) => {
      const activeEmotes = { ...(lobby.activeEmotes || {}) };
      activeEmotes[userId] = { emote, expiresAt: Date.now() + 3000 };
      
      // Cleanup expired emotes
      const now = Date.now();
      Object.keys(activeEmotes).forEach(id => {
        if (activeEmotes[id].expiresAt < now) {
          delete activeEmotes[id];
        }
      });
      
      return {
        ...lobby,
        activeEmotes
      };
    });
  }

  public retractVote(lobbyId: string, voterId: string): LobbyState | null {
    return this.updateLobby(lobbyId, (lobby) => {
      const votes = { ...lobby.liveVotes };
      delete votes[voterId];
      return {
        ...lobby,
        liveVotes: votes,
      };
    });
  }

  /** Remove a player from the lobby (e.g. remove bot) */
  public removePlayer(lobbyId: string, userId: string): LobbyState | null {
    return this.updateLobby(lobbyId, (lobby) => {
      const players = { ...lobby.players };
      delete players[userId];
      const votes = { ...lobby.liveVotes };
      delete votes[userId];
      return {
        ...lobby,
        players,
        liveVotes: votes,
      };
    });
  }

  /** Clear all lobbies (testing and teardown) */
  public clear(): void {
    this.lobbies.clear();
    this.waivers.clear();
  }
}

const globalLobbyStore = globalThis as unknown as {
  __tdv_lobby_store?: InMemoryLobbyStore;
};

export const inMemoryLobbyStore =
  globalLobbyStore.__tdv_lobby_store ?? (globalLobbyStore.__tdv_lobby_store = new InMemoryLobbyStore());
