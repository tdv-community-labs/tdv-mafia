/**
 * Authoritative Phase Manager & State Transition Loop
 *
 * Controls:
 *   • Phase tick loop: LOBBY → DAY_REGIONAL_CAUCUS → DAY_CENTRAL_ASSEMBLY
 *                      → DAY_VOTING → NIGHT_BUFFER → (loop or ENDED)
 *   • Anti-meta jitter: crypto-random 3–7s added to base 20s night buffer
 *   • Win-condition evaluator after every phase
 *   • All-In district room assignment during DAY_REGIONAL_CAUCUS
 *
 * Enterprise Mafia / Social Deduction Platform - Phase 2
 */

import { GamePhase, LobbyState, PlayerSession } from '../../types/game';
import { CoreFaction, AllInDistrict } from '../../types/roles';
import { PACKS_CONFIG } from '../../config/packs.config';
import {
  PhaseTransitionResult,
  WinConditionKind,
  WinConditionResult,
} from '../../types/engine';
import { computeCryptoJitterMs } from './night-action-resolver';
import { inMemoryLobbyStore } from '../state/memory';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_NIGHT_BUFFER_SECONDS = 20;

// ─── Win-Condition Evaluator ─────────────────────────────────────────────────

function countFactionAlive(
  players: Readonly<Record<string, PlayerSession>>,
  faction: CoreFaction
): string[] {
  return Object.values(players)
    .filter(p => p.isAlive && p.allInIdentity?.layer1Faction === faction)
    .map(p => p.userId);
}

function countAllAlive(players: Readonly<Record<string, PlayerSession>>): string[] {
  return Object.values(players).filter(p => p.isAlive).map(p => p.userId);
}

/**
 * Deterministic win-condition checker.
 * Evaluated after every phase transition and lynch resolution.
 *
 * Priority order:
 *  1. Jester Lucifer's Shadow (Dante CIRCLE_9_TREACHERY freeze)
 *  2. Neutral Killer solo
 *  3. Void Cult ascension (≥ majority)
 *  4. Yakuza majority
 *  5. Mafia majority
 *  6. Town victory (all threats eliminated)
 *  7. Game continues
 */
export function evaluateWinCondition(lobby: LobbyState): WinConditionResult {
  const { players, minigameSubStates } = lobby;
  const dante = minigameSubStates.dantesInferno;

  // ── 1. Jester Lucifer's Shadow (or Standard Jester) ──────────────────────
  if (dante?.luciferShadowWinnerUserId) {
    const jesterId = dante.luciferShadowWinnerUserId;
    return {
      kind:            'JESTER_LUCIFER_SHADOW',
      winningFaction:  'JESTER',
      winnerPlayerIds: [jesterId],
      reason:          'Jester was lynched during CIRCLE_9_TREACHERY and claimed Lucifer\'s Shadow victory.',
    };
  }
  
  if (lobby.lastLynchedUserId && players[lobby.lastLynchedUserId]?.allInIdentity?.layer1Faction === 'NEUTRAL_EVIL') {
    return {
      kind:            'JESTER_LUCIFER_SHADOW',
      winningFaction:  'JESTER',
      winnerPlayerIds: [lobby.lastLynchedUserId],
      reason:          'Təlxək (Jester) səsvermə ilə edam edildi və oyunu qazandı!',
    };
  }

  const aliveIds = countAllAlive(players);
  const aliveCount = aliveIds.length;
  if (aliveCount === 0) {
    // Mutual elimination — Town wins by default
    return {
      kind:            'TOWN_VICTORY',
      winningFaction:  'TOWN',
      winnerPlayerIds: Object.values(players).filter(p => p.allInIdentity?.layer1Faction === 'TOWN').map(p => p.userId),
      reason:          'All players eliminated simultaneously. Town declared victor.',
    };
  }

  // ── 2. Neutral Killer solo ──────────────────────────────────────────────────
  const nkAlive = countFactionAlive(players, 'NEUTRAL_KILLER');
  if (nkAlive.length > 0) {
    const threats = countFactionAlive(players, 'MAFIA')
      .concat(countFactionAlive(players, 'YAKUZA'))
      .concat(countFactionAlive(players, 'VOID_CULT'));
    const townAlive = countFactionAlive(players, 'TOWN');
    // NK wins when they can outgun remaining threats or are last standing non-benign
    if (nkAlive.length >= aliveCount - nkAlive.length && threats.length === 0 && townAlive.length <= nkAlive.length) {
      return {
        kind:            'NEUTRAL_KILLER_SOLO',
        winningFaction:  'NEUTRAL_KILLER',
        winnerPlayerIds: nkAlive,
        reason:          'Neutral Killer achieved dominance — no remaining faction can oppose them.',
      };
    }
  }

  // ── 3. Void Cult ascension (strict majority ≥ 50%) ──────────────────────────
  const voidAlive = countFactionAlive(players, 'VOID_CULT');
  if (voidAlive.length * 2 >= aliveCount) {
    return {
      kind:            'VOID_CULT_ASCENSION',
      winningFaction:  'VOID_CULT',
      winnerPlayerIds: voidAlive,
      reason:          'The Void Cult achieved majority. The Ritual of Unmaking is complete.',
    };
  }

  // ── 4. Yakuza majority ────────────────────────────────────────────────────
  const yakuzaAlive = countFactionAlive(players, 'YAKUZA');
  if (yakuzaAlive.length * 2 >= aliveCount) {
    return {
      kind:            'YAKUZA_MAJORITY',
      winningFaction:  'YAKUZA',
      winnerPlayerIds: yakuzaAlive,
      reason:          'The Yakuza Syndicate holds majority and cannot be stopped.',
    };
  }

  // ── 5. Mafia majority ────────────────────────────────────────────────────
  const mafiaAlive = countFactionAlive(players, 'MAFIA');
  if (mafiaAlive.length * 2 >= aliveCount) {
    return {
      kind:            'MAFIA_MAJORITY',
      winningFaction:  'MAFIA',
      winnerPlayerIds: mafiaAlive,
      reason:          'The Mafia holds majority. The city falls to organised crime.',
    };
  }

  // ── 6. Town victory: all kill-capable threats gone ──────────────────────────
  const killers = mafiaAlive.concat(yakuzaAlive, voidAlive, nkAlive);
  if (killers.length === 0) {
    const townWinners = Object.values(players)
      .filter(p => p.allInIdentity?.layer1Faction === 'TOWN' || p.allInIdentity?.layer1Faction === 'NEUTRAL_BENIGN')
      .map(p => p.userId);
    return {
      kind:            'TOWN_VICTORY',
      winningFaction:  'TOWN',
      winnerPlayerIds: townWinners,
      reason:          'All kill-capable threats have been eliminated. Town is victorious.',
    };
  }

  // ── 7. Game continues ─────────────────────────────────────────────────────
  return {
    kind:            'GAME_CONTINUES',
    winningFaction:  null,
    winnerPlayerIds: [],
    reason:          'No victory condition met. Game continues.',
  };
}

// ─── District Room Assignments (All-In) ──────────────────────────────────────

export function buildDistrictRoomAssignments(
  players: Readonly<Record<string, PlayerSession>>
): Readonly<Record<AllInDistrict, readonly string[]>> {
  const assignments: Record<AllInDistrict, string[]> = {
    ELITE:       [],
    COMMERCIAL:  [],
    INDUSTRIAL:  [],
  };

  for (const p of Object.values(players)) {
    if (!p.isAlive) continue;
    const district = p.currentDistrict;
    if (district) {
      assignments[district].push(p.userId);
    }
  }

  return assignments;
}

// ─── Phase Timer & Transition Logic ──────────────────────────────────────────

/**
 * Returns the authoritative duration for the requested phase given the current lobby config.
 * Night buffer duration = base 20s + crypto jitter 3–7s.
 */
export function computePhaseDuration(
  phase: GamePhase,
  lobby: LobbyState
): { durationSeconds: number; jitterMs: number } {
  const metadata = PACKS_CONFIG[lobby.mode];
  const timings   = metadata.defaultTimings;

  switch (phase) {
    case 'DAY_REGIONAL_CAUCUS':
      return { durationSeconds: timings.dayRegionalCaucusSeconds ?? 90, jitterMs: 0 };
    case 'DAY_CENTRAL_ASSEMBLY':
      return { durationSeconds: timings.dayCentralAssemblySeconds, jitterMs: 0 };
    case 'DAY_VOTING':
      return { durationSeconds: timings.dayVotingSeconds, jitterMs: 0 };
    case 'NIGHT_BUFFER': {
      const jitterMs = computeCryptoJitterMs(3, 7);
      const jitterS  = Math.ceil(jitterMs / 1000);
      return { durationSeconds: (timings.nightBufferSeconds || BASE_NIGHT_BUFFER_SECONDS) + jitterS, jitterMs };
    }
    default:
      return { durationSeconds: 60, jitterMs: 0 };
  }
}

/**
 * Returns the next logical phase given the current phase and lobby mode.
 */
export function nextPhaseAfter(current: GamePhase, lobby: LobbyState): GamePhase {
  const isAllIn = lobby.mode === 'ALL_IN';

  switch (current) {
    case 'LOBBY':
      return isAllIn ? 'DAY_REGIONAL_CAUCUS' : 'DAY_CENTRAL_ASSEMBLY';
    case 'DAY_REGIONAL_CAUCUS':
      return 'DAY_CENTRAL_ASSEMBLY';
    case 'DAY_CENTRAL_ASSEMBLY':
      return 'DAY_VOTING';
    case 'DAY_VOTING':
      return 'NIGHT_BUFFER';
    case 'NIGHT_BUFFER': {
      // Re-enter day cycle unless win condition already triggered
      const win = evaluateWinCondition(lobby);
      return win.kind === 'GAME_CONTINUES'
        ? (isAllIn ? 'DAY_REGIONAL_CAUCUS' : 'DAY_CENTRAL_ASSEMBLY')
        : 'ENDED';
    }
    case 'ENDED':
      return 'ENDED';
  }
}

// ─── Main Phase Transition Handler ───────────────────────────────────────────

export interface PhaseManagerInput {
  readonly lobbyId: string;
  /** Override the auto-computed next phase (e.g. forced ENDED on win condition) */
  readonly forceToPhase?: GamePhase;
}

export function executePhaseTransition(input: PhaseManagerInput): PhaseTransitionResult | null {
  const { lobbyId, forceToPhase } = input;

  const lobby = inMemoryLobbyStore.getLobby(lobbyId);
  if (!lobby) return null;

  const fromPhase = lobby.phase;
  const winCondition = evaluateWinCondition(lobby);

  // Hard stop — already won
  if (winCondition.kind !== 'GAME_CONTINUES' && !forceToPhase) {
    const ended = inMemoryLobbyStore.transitionPhase(lobbyId, 'ENDED', 0);
    if (!ended) return null;
    return {
      lobbyId,
      fromPhase,
      toPhase:        'ENDED',
      durationSeconds: 0,
      jitterMs:        0,
      roundNumber:     ended.roundNumber,
      winCondition,
      districtRoomAssignments: null,
    };
  }

  const toPhase = forceToPhase ?? nextPhaseAfter(fromPhase, lobby);
  const { durationSeconds, jitterMs } = computePhaseDuration(toPhase, lobby);

  const updatedLobby = inMemoryLobbyStore.transitionPhase(lobbyId, toPhase, durationSeconds);
  if (!updatedLobby) return null;

  // Build district room assignments when entering DAY_REGIONAL_CAUCUS (All-In only)
  const districtRoomAssignments =
    toPhase === 'DAY_REGIONAL_CAUCUS' && lobby.mode === 'ALL_IN'
      ? buildDistrictRoomAssignments(updatedLobby.players)
      : null;

  const postTransitionWin = evaluateWinCondition(updatedLobby);

  return {
    lobbyId,
    fromPhase,
    toPhase,
    durationSeconds,
    jitterMs,
    roundNumber:     updatedLobby.roundNumber,
    winCondition:    postTransitionWin,
    districtRoomAssignments,
  };
}
