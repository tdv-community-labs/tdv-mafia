/**
 * Engine Output Types — Shared across resolver, voting, and phase manager
 * Enterprise Mafia / Social Deduction Platform - Phase 2
 */

import { CoreFaction, AllInDistrict } from './roles';
import { GamePhase, NightActionType, PlayerSession } from './game';
import { DanteCircle } from './minigames';

// ─── Night Resolver Output ──────────────────────────────────────────────────

/** Per-player transient flags built during a single night resolution pass */
export interface NightResolutionFlags {
  readonly isBlocked: boolean;
  readonly isProtected: boolean;
  /** Charges remaining on BULLETPROOF_VEST / SURGICAL_RESILIENCE trait */
  readonly vestChargesRemaining: number;
  /** Target was misdirected; actual action resolves against redirectedTargetId */
  readonly redirectedTargetId: string | null;
  /** Target appears guilty/mafia to investigators (FRAME effect) */
  readonly isFramed: boolean;
  /** FALSE_DOCUMENTATION: appear as a different faction to investigators */
  readonly factionMaskOverride: CoreFaction | null;
  /** RETALIATION_FUSE: killer dies on successful kill attempt */
  readonly retaliationFuseActive: boolean;
  /** COLD_BLOODED: immune to BLOCK actions */
  readonly coldBloodedImmune: boolean;
  /** POISON_IMMUNITY: immune to non-direct kill vectors */
  readonly poisonImmune: boolean;
}

export type DeathCause =
  | 'MAFIA_KILL'
  | 'YAKUZA_KILL'
  | 'VOID_CULT_SACRIFICE'
  | 'NEUTRAL_KILLER_KILL'
  | 'RETALIATION_FUSE_COUNTER'
  | 'BRIEFCASE_DETONATION'
  | 'GORT_VAPORISATION'
  | 'JESTER_REVENGE'
  | 'CROSSFIRE'
  | 'LYNCH';

export interface NightDeathRecord {
  readonly victimPlayerId: string;
  readonly cause: DeathCause;
  readonly killerFaction: CoreFaction | null;
  /** True when the VIOLENCE circle cleaning applies (role card masked) */
  readonly isCleaned: boolean;
}

export interface InvestigationResult {
  readonly investigatorPlayerId: string;
  readonly targetPlayerId: string;
  /** Faction shown after FRAME/FALSE_DOCUMENTATION override */
  readonly revealedFaction: CoreFaction;
  readonly isBlurred: boolean; // CIRCLE_8_FRAUD: result is 50/50 guess
  readonly alternateBlurredFaction: CoreFaction | null;
}

export interface MorningNewspaper {
  /** Deaths visible in the public morning report */
  readonly roundNumber?: number;
  readonly headline?: string;
  readonly publicDeaths: readonly NightDeathRecord[];
  /** Private per-investigator clues (only sent to owning socket) */
  readonly privateInvestigationResults: readonly InvestigationResult[];
  /** Heresy circle: a leaked role clue for a previously dead player */
  readonly heresyClue: string | null;
  /** Night jitter delay that was applied before resolver ran (ms) */
  readonly jitterAppliedMs: number;
  /** Last Will messages written by dead players (keyed by userId). Populated from localStorage on the client. */
  readonly lastWills?: Readonly<Record<string, string>>;
  /** IDs of players who were attacked but saved by a protector */
  readonly protectedIds?: readonly string[];
}

export interface NightResolutionOutput {
  readonly newspaper: MorningNewspaper;
  /**
   * Updated player map (isAlive toggled for killed players).
   * Also includes players whose vest trait was fully spent this night
   * so their allInIdentity.layer3Trait is reset to avoid infinite re-protection.
   */
  readonly updatedPlayers: Readonly<Record<string, PlayerSession>>;
  /** Kill count this night (enforced ≤ globalNightKillCap for ALL_IN) */
  readonly killCount: number;
  /**
   * Player IDs whose BULLETPROOF_VEST / SURGICAL_RESILIENCE charges reached 0
   * this night (whether or not a kill was attempted). Callers must persist
   * the trait depletion into LobbyState so next night they are not re-protected.
   */
  readonly vestSpentPlayerIds: readonly string[];
  readonly mutinyActive?: boolean;
  readonly mutineerIds?: readonly string[];
}

// ─── Voting Engine Output ────────────────────────────────────────────────────

export interface VoteTally {
  readonly candidateId: string;
  /** Raw vote count in standard mode, weighted in All-In district */
  readonly voteCount: number;
  readonly voteWeight: number;
  readonly voterIds: readonly string[];
}

export type LynchOutcome =
  | { readonly kind: 'LYNCHED'; readonly victimId: string; readonly isCleaned: boolean }
  | { readonly kind: 'TIE'; readonly tiedCandidateIds: readonly string[] }
  | { readonly kind: 'NO_LYNCH'; readonly reason: 'ABSTAIN' | 'QUORUM_NOT_MET' };

export interface DistrictVoteResult {
  readonly district: AllInDistrict;
  readonly tallies: readonly VoteTally[];
  readonly districtFinalist: string | null;
}

export interface VotingEngineOutput {
  readonly tallies: readonly VoteTally[];
  readonly outcome: LynchOutcome;
  /** Only populated in ALL_IN mode with district plebiscite */
  readonly districtResults: readonly DistrictVoteResult[];
  /** Secret ballot map; null until Treachery phase lock reveals it */
  readonly blindBallotReveal: Readonly<Record<string, string>> | null;
}

// ─── Phase Manager Output ───────────────────────────────────────────────────

export type WinConditionKind =
  | 'TOWN_VICTORY'
  | 'MAFIA_MAJORITY'
  | 'YAKUZA_MAJORITY'
  | 'VOID_CULT_ASCENSION'
  | 'NEUTRAL_KILLER_SOLO'
  | 'JESTER_LUCIFER_SHADOW'
  | 'GAME_CONTINUES';

export interface WinConditionResult {
  readonly kind: WinConditionKind;
  readonly winningFaction: CoreFaction | 'JESTER' | null;
  readonly winnerPlayerIds: readonly string[];
  /** Diagnostic description for logging / replay */
  readonly reason: string;
}

export interface PhaseTransitionResult {
  readonly lobbyId: string;
  readonly fromPhase: GamePhase;
  readonly toPhase: GamePhase;
  readonly durationSeconds: number;
  readonly jitterMs: number;
  readonly roundNumber: number;
  readonly winCondition: WinConditionResult;
  /** District room assignments emitted during DAY_REGIONAL_CAUCUS */
  readonly districtRoomAssignments: Readonly<Record<AllInDistrict, readonly string[]>> | null;
}

// ─── Zero-Knowledge Scrubbed Payload ────────────────────────────────────────

/**
 * Scrubbed lobby view emitted to a given socket.
 * All secret fields (bufferedNightActions, private roles, innate traits) are stripped.
 */
export interface ScrubbedLobbyView {
  readonly lobbyId: string;
  readonly phase: GamePhase;
  readonly roundNumber: number;
  readonly phaseTimeRemaining: number;
  readonly mode: string;
  /** Public player list — secret role info is nulled out except for the requesting socket's own player */
  readonly publicPlayers: readonly ScrubbedPlayerView[];
  readonly liveVotes: Readonly<Record<string, string>> | null; // null during CIRCLE_9_TREACHERY blind
  readonly speakerQueue: readonly string[];
  readonly globalNightKillCap: number;
}

export interface ScrubbedPlayerView {
  readonly userId: string;
  readonly username: string;
  readonly isAlive: boolean;
  readonly isHost: boolean;
  readonly currentDistrict: AllInDistrict | null;
  /** Role visible only if this is the requesting player themselves */
  readonly ownRoleDisplay: string | null;
  /** All-In civic office visible only to self */
  readonly ownOffice: string | null;
  /** All-In innate trait — NEVER revealed to any other player */
  readonly ownTrait: string | null;
}
