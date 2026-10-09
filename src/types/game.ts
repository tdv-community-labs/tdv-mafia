/**
 * Core Game Engine, Phase State, and Session Types
 * Enterprise Mafia / Social Deduction Platform - Phase 1 Foundation
 */

import { AdminRole, PlayerTier } from './access';
import { MinigameSubStates } from './minigames';
import { GameMode } from './packs';
import { AllInDistrict, AllInPlayerIdentity, FormattedRoleDisplay } from './roles';

export type GamePhase =
  | 'LOBBY'
  | 'DAY_REGIONAL_CAUCUS'
  | 'DAY_CENTRAL_ASSEMBLY'
  | 'DAY_VOTING'
  | 'NIGHT_BUFFER'
  | 'ENDED';

export interface PlayerSession {
  readonly socketId: string;
  readonly userId: string;
  readonly username: string;
  readonly tier: PlayerTier;
  readonly adminRole: AdminRole;
  readonly isHost: boolean;
  readonly isAlive: boolean;
  readonly hasHostWaiver: boolean;
  readonly hasAdminWaiver: boolean;
  readonly displayRole: FormattedRoleDisplay;
  readonly allInIdentity?: AllInPlayerIdentity;
  readonly currentDistrict?: AllInDistrict;
  readonly disconnectedAt: number | null;
  readonly lastSeenAt?: number; // Unix timestamp in ms or null
  readonly isAiBotControlled: boolean;
  readonly isReady?: boolean;
  readonly lastWill?: string;
}

export type NightActionType =
  | 'TIME_WARP'    // Priority 0: Reverses time, nullifying all subsequent actions
  | 'BLOCK'        // Priority 1: Prevents target from executing their night action
  | 'PROTECT'      // Priority 2: Prevents kill actions on target
  | 'MISDIRECT'    // Priority 3: Redirects actions aimed at target to another
  | 'FRAME'        // Priority 4: Causes target to register as guilty/mafia
  | 'INVESTIGATE'  // Priority 5: Discovers faction/identity information
  | 'KILL'         // Priority 6: Eliminates target (bounded by kill cap)
  | 'RESURRECT';   // Priority 7: Brings a dead player back to life

export type NightActionPriority = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface NightActionBufferItem {
  readonly actorPlayerId: string;
  readonly targetPlayerId: string;
  readonly actionType: NightActionType;
  readonly priority: NightActionPriority;
  readonly timestamp: number; // Unix timestamp in ms
  readonly signature?: string;
}

/** Dual-lock system state required strictly for All-In 40–50 lobbies */
export interface AdminMasterUnlockState {
  readonly architectUnlocked: boolean;
  readonly bailiffUnlocked: boolean;
  readonly dualLockVerified: boolean;
  readonly unlockedAt: number | null; // Unix timestamp in ms or null
}

import type { MorningNewspaper, InvestigationResult, WinConditionResult } from './engine';

export type ChatChannel = 'LOBBY' | 'MAFIA' | 'DEAD';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  channel: ChatChannel;
  timestamp: number;
}

export interface LobbyState {
  chatMessages: ChatMessage[];
  readonly lobbyId: string;
  readonly hostUserId: string;
  readonly mode: GameMode;
  readonly phase: GamePhase;
  readonly players: Readonly<Record<string, PlayerSession>>;
  readonly hostReady: boolean;
  readonly adminMasterUnlock: AdminMasterUnlockState;
  readonly assignedArchitectId: string | null;
  readonly assignedBailiffId: string | null;
  readonly phaseDurationSeconds: number;
  readonly phaseTimeRemaining: number;
  /** Unix timestamp in ms when the current phase is scheduled to end */
  readonly phaseEndsAt?: number | null;
  /** Random jitter delay between 3-7s applied at dawn to disguise bot vs human responses */
  readonly nightJitterDelaySeconds: number;
  /** Voter player ID -> Nominated / Target player ID */
  readonly activeEmotes?: Record<string, { emote: string; expiresAt: number }>;
  readonly liveVotes: Readonly<Record<string, string>>;
  /** Ordered player IDs with current or upcoming speaking floor */
  readonly speakerQueue: readonly string[];
  readonly bufferedNightActions: readonly NightActionBufferItem[];
  readonly mafiaMutinyActive?: boolean;
  readonly achievementsJustUnlocked?: Readonly<Record<string, string[]>>;
  readonly mutineerIds?: readonly string[];
  readonly minigameSubStates: MinigameSubStates;
  readonly roundNumber: number;
  readonly lastLynchedUserId: string | null;
  /** Strict global kill cap per night (strictly enforced <= 3 in All-In) */
  readonly globalNightKillCap: number;
  /** Latest morning newspaper generated after night resolution */
  readonly latestNewspaper?: MorningNewspaper | null;
  readonly pastNewspapers?: readonly MorningNewspaper[];
  /** Private investigation intel keyed by investigator user ID */
  readonly privateInvestigations?: Readonly<Record<string, readonly InvestigationResult[]>>;
  /** Declared winner outcome when phase reaches ENDED */
  readonly winnerResult?: WinConditionResult | null;
  /** Monotonically incremented on every mutation — used for optimistic concurrency control */
  readonly stateVersion?: number;
}
