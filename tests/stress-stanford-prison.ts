/**
 * Empirical Adversarial Stress Test Suite: Milestone 3 Stanford Prison Mechanics
 * Author: challenger_m3_1 (Milestone 3 Empirical Challenger)
 *
 * MISSION INVARIANTS:
 * 1. Revolt meter strictly clamped: 0 <= revoltMeter <= 100 at all times across all action paths.
 * 2. Sanctions quota non-negativity: guardSanctionsRemaining >= 0 under all usage, spam, and exhaustion.
 * 3. Riot trigger reliability: revoltMeter >= 100 reliably triggers riotTriggered = true immediately.
 * 4. Win condition invariant: riotTriggered === true guarantees TOWN_VICTORY for living Inmates.
 * 5. Action lockout: Once riot triggers, further sanctions and solitary actions are rejected (RIOT_ALREADY_TRIGGERED).
 * 6. Solitary confinement integrity: No duplicate solitary entries, live votes purged, electoral disenfranchisement.
 * 7. Authorization integrity: Only guards can sanction; only guards/warden can isolate; dead actors/targets rejected.
 * 8. Assassin strike safety: Warden is immune to assassin strike; non-Warden guards targeted or fallback.
 *
 * MONTE CARLO STRESS:
 * - 1,500+ independent randomized Monte Carlo game iterations.
 * - Thousands of arbitrary random action sequences, round ticks, and voting collisions.
 */

import assert from 'node:assert';
import {
  processStanfordPrisonRound,
  executePrisonSanction,
  executePrisonSolitary,
  applyPrisonSanction,
  applyPrisonSolitary,
  dispatchMinigamePhaseEvent,
  StanfordPrisonEngineInput,
} from '../src/server/engine/minigames-engine';
import {
  createInitialStanfordPrisonState,
} from '../src/config/minigames.config';
import { StanfordPrisonState } from '../src/types/minigames';
import { runVotingEngine, determineVerdictOutcome } from '../src/server/engine/voting-engine';
import { evaluateWinCondition } from '../src/server/engine/phase-manager';
import { PlayerSession, LobbyState } from '../src/types/game';

// ============================================================================
// FIXTURE FACTORIES
// ============================================================================

function createMockPlayer(
  id: string,
  name: string,
  faction: 'TOWN' | 'MAFIA' | 'NEUTRAL_EVIL',
  isAlive = true
): PlayerSession {
  return {
    socketId: `sock-${id}`,
    userId: id,
    username: name,
    isAlive,
    tier: 'TIER_1',
    displayRole: { formatted: name, localized: name },
    allInIdentity: {
      layer1Faction: faction,
      layer2Office: 'CITIZEN',
      layer3Trait: 'CONTRABAND_POCKET',
    },
    inventory: [],
    secretRole: name,
    hasHostWaiver: false,
    hasAdminWaiver: false,
  };
}

function createMockPrisonLobby(
  prisonState: StanfordPrisonState,
  players: Record<string, PlayerSession>,
  phase: LobbyState['phase'] = 'DAY_CENTRAL_ASSEMBLY'
): LobbyState {
  return {
    lobbyId: 'stress-prison-lobby',
    mode: 'STANFORD_PRISON',
    phase,
    players,
    hostReady: true,
    adminMasterUnlock: false,
    assignedArchitectId: null,
    assignedBailiffId: null,
    phaseDurationSeconds: 60,
    phaseTimeRemaining: 60,
    phaseEndsAt: null,
    nightJitterDelaySeconds: 5,
    activeEmotes: {},
    liveVotes: {},
    speakerQueue: [],
    bufferedNightActions: [],
    chatMessages: [],
    minigameSubStates: { stanfordPrison: prisonState },
    roundNumber: 1,
    lastLynchedUserId: null,
    globalNightKillCap: 99,
    latestNewspaper: null,
    privateInvestigations: {},
    winnerResult: null,
    stateVersion: 1,
  };
}

// Pseudo-random number generator with deterministic seed support
class SeededRandom {
  private seed: number;
  constructor(seed = 42) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  int(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min + 1));
  }
  choice<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  sample<T>(arr: readonly T[], count: number): T[] {
    const copy = [...arr];
    const result: T[] = [];
    const n = Math.min(count, copy.length);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(this.next() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }
}

// ============================================================================
// VERIFICATION HARNESS
// ============================================================================

let totalAssertionsChecked = 0;

function assertInvariant(condition: boolean, message: string) {
  totalAssertionsChecked++;
  assert.ok(condition, message);
}

function verifyStanfordPrisonInvariants(
  state: StanfordPrisonState,
  context: string,
  lobby?: LobbyState
) {
  // Invariant 1: Meter bounds
  assertInvariant(
    typeof state.revoltMeter === 'number' && !Number.isNaN(state.revoltMeter),
    `[${context}] Revolt meter must be a valid number, got ${state.revoltMeter}`
  );
  assertInvariant(
    state.revoltMeter >= 0,
    `[${context}] Revolt meter must never be negative, got ${state.revoltMeter}`
  );
  assertInvariant(
    state.revoltMeter <= 100,
    `[${context}] Revolt meter must never exceed 100, got ${state.revoltMeter}`
  );

  // Invariant 2: Quota bounds
  if (state.guardSanctionsRemaining !== undefined) {
    assertInvariant(
      typeof state.guardSanctionsRemaining === 'number' && !Number.isNaN(state.guardSanctionsRemaining),
      `[${context}] Sanctions remaining must be a valid number`
    );
    assertInvariant(
      state.guardSanctionsRemaining >= 0,
      `[${context}] Sanctions remaining must never be negative, got ${state.guardSanctionsRemaining}`
    );
  }

  // Invariant 3: Riot trigger consistency
  if (state.revoltMeter >= 100) {
    assertInvariant(
      state.riotTriggered === true,
      `[${context}] Riot must be triggered when meter reaches 100%`
    );
  }

  // Invariant 4: Town victory on riot
  if (state.riotTriggered && lobby) {
    const updatedLobby: LobbyState = {
      ...lobby,
      minigameSubStates: {
        ...lobby.minigameSubStates,
        stanfordPrison: state,
      },
    };
    const win = evaluateWinCondition(updatedLobby);
    assertInvariant(
      win.kind === 'TOWN_VICTORY',
      `[${context}] Riot must trigger TOWN_VICTORY, got ${win.kind}`
    );
    assertInvariant(
      win.winningFaction === 'TOWN',
      `[${context}] Winning faction must be TOWN on riot`
    );
    if (state.inmatePlayerIds.length > 0) {
      assertInvariant(
        win.winnerPlayerIds.length > 0,
        `[${context}] Winners list must not be empty on riot when inmates exist`
      );
    }
  }

  // Invariant 5: Solitary list uniqueness
  const solitarySet = new Set(state.solitaryConfinementPlayerIds);
  assertInvariant(
    solitarySet.size === state.solitaryConfinementPlayerIds.length,
    `[${context}] Solitary confinement list contains duplicates: ${state.solitaryConfinementPlayerIds}`
  );
}

// ============================================================================
// PART 1: DETERMINISTIC ADVERSARIAL BOUNDARY SUITES
// ============================================================================

function runAdversarialBoundarySuites() {
  console.log('▶ Part 1: Deterministic Adversarial Boundary Suites');

  // Suite 1.1: Meter Clamping Boundaries (Underflow & Overflow)
  console.log('  ▶ Suite 1.1: Meter Clamping Boundaries (0 underflow, 100 overflow, exact hit)');
  {
    // Underflow at 0
    const zeroState = createInitialStanfordPrisonState('warden', ['g1'], ['i1', 'i2', 'i3'], null, 3);
    const solitaryRes = applyPrisonSolitary(zeroState, 'warden', 'i1');
    assertInvariant(solitaryRes.success, 'Solitary from 0 should succeed');
    assertInvariant(solitaryRes.updatedState.revoltMeter === 0, 'Meter must clamp at 0');

    // Round with mass appeasement from 0
    const roundUnderflow = processStanfordPrisonRound({
      currentState: zeroState,
      guardSanctionIds: [],
      wardenAppeasedInmateIds: ['i1', 'i2', 'i3'],
      inmatesLynchedIds: [],
      inmatesPlacedInSolitary: ['i1'],
      secretAssassinStrike: false,
      assassinStrikeTargetId: null,
    });
    assertInvariant(roundUnderflow.updatedState.revoltMeter === 0, 'Round appeasement must clamp at 0');
    assertInvariant(roundUnderflow.riotTriggered === false, 'No riot on underflow');

    // Overflow from 95
    const nearMaxState: StanfordPrisonState = {
      ...zeroState,
      revoltMeter: 95,
      guardSanctionsRemaining: 2,
    };
    const sanctionOverflow = applyPrisonSanction(nearMaxState, 'g1', 'i2');
    assertInvariant(sanctionOverflow.success, 'Sanction from 95 should succeed');
    assertInvariant(sanctionOverflow.updatedState.revoltMeter === 100, 'Meter must strictly clamp at 100');
    assertInvariant(sanctionOverflow.updatedState.riotTriggered === true, 'Riot must trigger at 100');

    // Round with massive sanction + lynch from 85 (+15*2 + 20*2 = +70 => 155 => 100)
    const massOverflowRound = processStanfordPrisonRound({
      currentState: { ...zeroState, revoltMeter: 85 },
      guardSanctionIds: ['g1', 'g1'],
      wardenAppeasedInmateIds: [],
      inmatesLynchedIds: ['i1', 'i2'],
      inmatesPlacedInSolitary: [],
      secretAssassinStrike: false,
      assassinStrikeTargetId: null,
    });
    assertInvariant(massOverflowRound.updatedState.revoltMeter === 100, 'Mass round increase must clamp at 100');
    assertInvariant(massOverflowRound.riotTriggered === true, 'Riot triggered on mass overflow');
    console.log('    ✔ Underflow and overflow clamping to [0, 100] verified.');
  }

  // Suite 1.2: Quota Exhaustion & Non-Negativity
  console.log('  ▶ Suite 1.2: Sanctions Quota Exhaustion & Non-Negativity');
  {
    const prisonState = createInitialStanfordPrisonState('warden', ['g1'], ['i1', 'i2'], null, 2);
    assertInvariant(prisonState.guardSanctionsRemaining === 2, 'Initial sanctions should be 2');

    // Use 1
    const s1 = applyPrisonSanction(prisonState, 'g1', 'i1');
    assertInvariant(s1.success && s1.updatedState.guardSanctionsRemaining === 1, 'Sanctions decrement to 1');

    // Use 2 (quota exhausted)
    const s2 = applyPrisonSanction(s1.updatedState, 'g1', 'i2');
    assertInvariant(s2.success && s2.updatedState.guardSanctionsRemaining === 0, 'Sanctions decrement to 0');

    // Spam 15 sanction attempts with exhausted quota
    let currentState = s2.updatedState;
    for (let i = 0; i < 15; i++) {
      const exhausted = applyPrisonSanction(currentState, 'g1', 'i1');
      assertInvariant(!exhausted.success, `Exhausted sanction attempt ${i} must fail`);
      assertInvariant(exhausted.error === 'NO_SANCTIONS_REMAINING', 'Error must be NO_SANCTIONS_REMAINING');
      assertInvariant(exhausted.updatedState.guardSanctionsRemaining === 0, 'Quota must remain strictly 0');
      assertInvariant(exhausted.updatedState.revoltMeter === currentState.revoltMeter, 'Meter unchanged');
      currentState = exhausted.updatedState;
    }

    // Process round with 5 sanction IDs when quota is 0
    const roundExhausted = processStanfordPrisonRound({
      currentState,
      guardSanctionIds: ['g1', 'g1', 'g1', 'g1', 'g1'],
      wardenAppeasedInmateIds: [],
      inmatesLynchedIds: [],
      inmatesPlacedInSolitary: [],
      secretAssassinStrike: false,
      assassinStrikeTargetId: null,
    });
    assertInvariant(
      roundExhausted.updatedState.guardSanctionsRemaining === 0,
      'Round quota decrement must not go below 0'
    );
    console.log('    ✔ Sanctions quota exhaustion and non-negativity verified.');
  }

  // Suite 1.3: Riot Sticky State & Action Lockout
  console.log('  ▶ Suite 1.3: Riot Trigger Sticky State & Post-Riot Action Lockout');
  {
    const players = {
      'warden': createMockPlayer('warden', 'Warden', 'MAFIA'),
      'g1': createMockPlayer('g1', 'Guard 1', 'MAFIA'),
      'i1': createMockPlayer('i1', 'Inmate 1', 'TOWN'),
      'i2': createMockPlayer('i2', 'Inmate 2', 'TOWN'),
    };

    const riotState: StanfordPrisonState = {
      wardenPlayerId: 'warden',
      guardPlayerIds: ['g1'],
      inmatePlayerIds: ['i1', 'i2'],
      revoltMeter: 100,
      solitaryConfinementPlayerIds: [],
      riotTriggered: true,
      guardSanctionsRemaining: 3,
      secretAssassinInmateId: null,
    };
    const riotLobby = createMockPrisonLobby(riotState, players);

    // executePrisonSanction locked out
    const sanctionAttempt = executePrisonSanction(riotLobby, 'g1', 'i1');
    assertInvariant(!sanctionAttempt.success, 'Sanction post-riot must fail');
    assertInvariant(sanctionAttempt.error === 'RIOT_ALREADY_TRIGGERED', 'Error must be RIOT_ALREADY_TRIGGERED');

    // applyPrisonSanction locked out
    const directSanction = applyPrisonSanction(riotState, 'g1', 'i1');
    assertInvariant(!directSanction.success && directSanction.error === 'RIOT_ALREADY_TRIGGERED', 'Direct sanction locked');

    // executePrisonSolitary locked out
    const solitaryAttempt = executePrisonSolitary(riotLobby, 'g1', 'i1');
    assertInvariant(!solitaryAttempt.success, 'Solitary post-riot must fail');
    assertInvariant(solitaryAttempt.error === 'RIOT_ALREADY_TRIGGERED', 'Error must be RIOT_ALREADY_TRIGGERED');

    // applyPrisonSolitary locked out
    const directSolitary = applyPrisonSolitary(riotState, 'g1', 'i1');
    assertInvariant(!directSolitary.success && directSolitary.error === 'RIOT_ALREADY_TRIGGERED', 'Direct solitary locked');

    // Round processing retains riotTriggered: true even if placation reduces meter
    const roundPlacated = processStanfordPrisonRound({
      currentState: riotState,
      guardSanctionIds: [],
      wardenAppeasedInmateIds: ['i1'],
      inmatesLynchedIds: [],
      inmatesPlacedInSolitary: ['i1'],
      secretAssassinStrike: false,
      assassinStrikeTargetId: null,
    });
    assertInvariant(
      roundPlacated.updatedState.riotTriggered === true,
      'riotTriggered must remain true once triggered (sticky state)'
    );

    // Verify Town victory
    const win = evaluateWinCondition({ ...riotLobby, minigameSubStates: { stanfordPrison: roundPlacated.updatedState } });
    assertInvariant(win.kind === 'TOWN_VICTORY', 'Town victory preserved');
    console.log('    ✔ Post-riot action lockout and sticky riot victory verified.');
  }

  // Suite 1.4: Solitary Confinement Vote Purge & Electoral Disenfranchisement
  console.log('  ▶ Suite 1.4: Solitary Confinement Vote Purge & Disenfranchisement');
  {
    const players = {
      'warden': createMockPlayer('warden', 'Warden', 'MAFIA'),
      'g1': createMockPlayer('g1', 'Guard 1', 'MAFIA'),
      'i1': createMockPlayer('i1', 'Inmate 1', 'TOWN'),
      'i2': createMockPlayer('i2', 'Inmate 2', 'TOWN'),
      'i3': createMockPlayer('i3', 'Inmate 3', 'TOWN'),
    };
    const prisonState = createInitialStanfordPrisonState('warden', ['g1'], ['i1', 'i2', 'i3'], null, 3);
    const lobby = createMockPrisonLobby(prisonState, players, 'DAY_VOTING');

    // Inmates cast live votes and trial verdict votes
    lobby.liveVotes = {
      'i1': 'warden',
      'i2': 'warden',
      'i3': 'warden',
    };
    lobby.trialVerdictVotes = {
      'i1': 'GUILTY',
      'i2': 'GUILTY',
    };

    // Place i1 in solitary
    const solitaryRes = executePrisonSolitary(lobby, 'warden', 'i1');
    assertInvariant(solitaryRes.success, 'Solitary execution succeeds');

    // Live votes and verdict votes by i1 must be purged immediately
    assertInvariant(solitaryRes.updatedLobby.liveVotes?.['i1'] === undefined, 'i1 live vote must be purged');
    assertInvariant(solitaryRes.updatedLobby.trialVerdictVotes?.['i1'] === undefined, 'i1 verdict vote must be purged');
    assertInvariant(solitaryRes.updatedLobby.liveVotes?.['i2'] === 'warden', 'i2 live vote intact');

    // Duplicate solitary placement rejected
    const duplicateRes = executePrisonSolitary(solitaryRes.updatedLobby, 'g1', 'i1');
    assertInvariant(!duplicateRes.success, 'Duplicate solitary rejected');
    assertInvariant(duplicateRes.error === 'ALREADY_IN_SOLITARY', 'Error is ALREADY_IN_SOLITARY');

    // Run voting engine on lobby with solitary inmate having a vote (e.g. manually injected)
    const injectedLobby = {
      ...solitaryRes.updatedLobby,
      liveVotes: { 'i1': 'warden', 'i2': 'warden' },
    };
    const nominationOut = runVotingEngine({ lobby: injectedLobby });
    const wardenTally = nominationOut.tallies.find(t => t.candidateId === 'warden');
    assertInvariant(wardenTally?.voteCount === 1, 'Only i2 counted; i1 stripped by solitary filter');
    assertInvariant(wardenTally?.voterIds.includes('i1') === false, 'i1 excluded from voterIds');

    // Trial verdict voting
    const verdictLobby = {
      ...solitaryRes.updatedLobby,
      phase: 'TRIAL_DEFENSE' as const,
      trialVerdictVotes: { 'i1': 'GUILTY' as const, 'i2': 'INNOCENT' as const },
    };
    const verdictOut = determineVerdictOutcome(verdictLobby, 'warden');
    assertInvariant(verdictOut.guiltyCount === 0, 'Solitary inmate guilty vote stripped');
    assertInvariant(verdictOut.innocentCount === 1, 'Free inmate innocent vote counted');
    console.log('    ✔ In-flight vote purging and solitary disenfranchisement verified.');
  }

  // Suite 1.5: Authorization & Role Integrity
  console.log('  ▶ Suite 1.5: Authorization & Role Integrity');
  {
    const players = {
      'warden': createMockPlayer('warden', 'Warden', 'MAFIA'),
      'g1': createMockPlayer('g1', 'Guard 1', 'MAFIA'),
      'i1': createMockPlayer('i1', 'Inmate 1', 'TOWN'),
      'deadGuard': createMockPlayer('deadGuard', 'Dead Guard', 'MAFIA', false),
      'deadInmate': createMockPlayer('deadInmate', 'Dead Inmate', 'TOWN', false),
    };
    const prisonState = createInitialStanfordPrisonState('warden', ['g1', 'deadGuard'], ['i1', 'deadInmate'], null, 3);
    const lobby = createMockPrisonLobby(prisonState, players);

    // Inmate attempts sanction
    assertInvariant(executePrisonSanction(lobby, 'i1', 'i1').error === 'NOT_A_GUARD', 'Inmate cannot sanction');
    assertInvariant(applyPrisonSanction(prisonState, 'i1', 'i1').error === 'GUARD_ONLY_ACTION', 'Inmate cannot sanction');

    // Dead guard attempts sanction
    assertInvariant(executePrisonSanction(lobby, 'deadGuard', 'i1').error === 'ACTOR_NOT_ALIVE', 'Dead guard rejected');

    // Guard sanctions dead target (dead inmate or dead guard)
    assertInvariant(executePrisonSanction(lobby, 'g1', 'deadInmate').error === 'TARGET_NOT_ALIVE', 'Dead target rejected');
    assertInvariant(executePrisonSanction(lobby, 'g1', 'deadGuard').error === 'TARGET_NOT_ALIVE', 'Dead target rejected');

    // Guard sanctions living non-inmate (warden)
    assertInvariant(executePrisonSanction(lobby, 'g1', 'warden').error === 'TARGET_NOT_AN_INMATE', 'Non-inmate target rejected');
    assertInvariant(applyPrisonSanction(prisonState, 'g1', 'warden').error === 'INVALID_INMATE_TARGET', 'Non-inmate target rejected');

    // Inmate attempts solitary
    assertInvariant(executePrisonSolitary(lobby, 'i1', 'deadInmate').error === 'NOT_A_GUARD_OR_WARDEN', 'Inmate cannot solitary');
    assertInvariant(applyPrisonSolitary(prisonState, 'i1', 'deadInmate').error === 'NOT_A_GUARD_OR_WARDEN', 'Inmate cannot solitary');

    // LOBBY phase rejection
    const lobbyPhaseLobby = createMockPrisonLobby(prisonState, players, 'LOBBY');
    assertInvariant(executePrisonSanction(lobbyPhaseLobby, 'g1', 'i1').error === 'INVALID_PHASE', 'LOBBY phase sanction rejected');
    assertInvariant(executePrisonSolitary(lobbyPhaseLobby, 'g1', 'i1').error === 'INVALID_PHASE', 'LOBBY phase solitary rejected');

    // ENDED phase rejection
    const endedPhaseLobby = createMockPrisonLobby(prisonState, players, 'ENDED');
    assertInvariant(executePrisonSanction(endedPhaseLobby, 'g1', 'i1').error === 'INVALID_PHASE', 'ENDED phase sanction rejected');
    assertInvariant(executePrisonSolitary(endedPhaseLobby, 'g1', 'i1').error === 'INVALID_PHASE', 'ENDED phase solitary rejected');
    console.log('    ✔ Authorization, alive checks, target validation, and phase guards verified.');
  }

  // Suite 1.6: Secret Assassin Strike Edge Cases
  console.log('  ▶ Suite 1.6: Secret Assassin Strike Edge Cases');
  {
    const prisonState = createInitialStanfordPrisonState('warden', ['g1', 'g2'], ['i1', 'i2'], 'i1', 3);

    // Direct strike against valid non-Warden guard
    const directStrike = processStanfordPrisonRound({
      currentState: prisonState,
      guardSanctionIds: [],
      wardenAppeasedInmateIds: [],
      inmatesLynchedIds: [],
      inmatesPlacedInSolitary: [],
      secretAssassinStrike: true,
      assassinStrikeTargetId: 'g1',
    });
    assertInvariant(directStrike.assassinatedGuardId === 'g1', 'Target guard g1 assassinated');
    assertInvariant(!directStrike.updatedState.guardPlayerIds.includes('g1'), 'g1 removed from guardPlayerIds');
    assertInvariant(directStrike.updatedState.guardPlayerIds.includes('g2'), 'g2 remains');

    // Assassin attempts to target Warden -> Warden immune, falls back to non-Warden guard
    const wardenStrike = processStanfordPrisonRound({
      currentState: prisonState,
      guardSanctionIds: [],
      wardenAppeasedInmateIds: [],
      inmatesLynchedIds: [],
      inmatesPlacedInSolitary: [],
      secretAssassinStrike: true,
      assassinStrikeTargetId: 'warden',
    });
    assertInvariant(wardenStrike.assassinatedGuardId !== 'warden', 'Warden cannot be assassinated');
    assertInvariant(wardenStrike.updatedState.wardenPlayerId === 'warden', 'Warden remains untouched');
    assertInvariant(['g1', 'g2'].includes(wardenStrike.assassinatedGuardId!), 'Fell back to an eligible guard');

    // Assassin strike when NO eligible non-Warden guards exist
    const onlyWardenState = createInitialStanfordPrisonState('warden', [], ['i1'], 'i1', 3);
    const noGuardsStrike = processStanfordPrisonRound({
      currentState: onlyWardenState,
      guardSanctionIds: [],
      wardenAppeasedInmateIds: [],
      inmatesLynchedIds: [],
      inmatesPlacedInSolitary: [],
      secretAssassinStrike: true,
      assassinStrikeTargetId: null,
    });
    assertInvariant(noGuardsStrike.assassinatedGuardId === null, 'No guard assassinated when list empty');
    assertInvariant(noGuardsStrike.updatedState.wardenPlayerId === 'warden', 'Warden remains alive');
    console.log('    ✔ Secret assassin strike invariants and Warden immunity verified.');
  }
}

// ============================================================================
// PART 2: MONTE CARLO RANDOM FUZZING ENGINE (1,500+ ITERATIONS)
// ============================================================================

interface FuzzStats {
  totalIterations: number;
  totalEventsProcessed: number;
  totalSanctionsExecuted: number;
  totalSolitaryExecuted: number;
  totalRoundsProcessed: number;
  totalVotingChecks: number;
  totalRiotsTriggered: number;
}

function runMonteCarloFuzzing(iterations = 1500) {
  console.log(`\n▶ Part 2: Monte Carlo Fuzzing Engine (${iterations} Randomized Iterations)`);
  const rng = new SeededRandom(20261103);
  const stats: FuzzStats = {
    totalIterations: iterations,
    totalEventsProcessed: 0,
    totalSanctionsExecuted: 0,
    totalSolitaryExecuted: 0,
    totalRoundsProcessed: 0,
    totalVotingChecks: 0,
    totalRiotsTriggered: 0,
  };

  for (let iter = 1; iter <= iterations; iter++) {
    // 1. Generate randomized room topology
    const guardCount = rng.int(1, 4);
    const inmateCount = rng.int(3, 10);
    const initialSanctions = rng.int(0, 5);
    const initialMeter = rng.int(0, 90);

    const wardenId = 'warden';
    const guardIds: string[] = [];
    for (let g = 1; g <= guardCount; g++) guardIds.push(`g${g}`);
    const inmateIds: string[] = [];
    for (let i = 1; i <= inmateCount; i++) inmateIds.push(`i${i}`);

    const hasAssassin = rng.next() > 0.3;
    const assassinId = hasAssassin ? rng.choice(inmateIds) : null;

    const players: Record<string, PlayerSession> = {
      [wardenId]: createMockPlayer(wardenId, 'Warden', 'MAFIA'),
    };
    for (const gid of guardIds) {
      players[gid] = createMockPlayer(gid, `Guard_${gid}`, 'MAFIA');
    }
    for (const iid of inmateIds) {
      players[iid] = createMockPlayer(iid, `Inmate_${iid}`, 'TOWN');
    }

    let prisonState: StanfordPrisonState = {
      wardenPlayerId: wardenId,
      guardPlayerIds: [...guardIds],
      inmatePlayerIds: [...inmateIds],
      revoltMeter: initialMeter,
      guardSanctionsRemaining: initialSanctions,
      solitaryConfinementPlayerIds: [],
      riotTriggered: initialMeter >= 100,
      secretAssassinInmateId: assassinId,
    };

    let lobby = createMockPrisonLobby(prisonState, players);

    // Initial invariant check
    verifyStanfordPrisonInvariants(prisonState, `Iter ${iter} init`, lobby);

    // 2. Run randomized event timeline (15 to 30 events per game)
    const eventCount = rng.int(15, 30);
    for (let step = 0; step < eventCount; step++) {
      stats.totalEventsProcessed++;
      const eventType = rng.int(1, 5);

      switch (eventType) {
        // Event 1: Interactive Guard Sanction
        case 1: {
          const allPlayerIds = Object.keys(players);
          // Pick actor (could be guard, inmate, warden, or invalid)
          const actorId = rng.next() < 0.7 ? rng.choice(guardIds) : rng.choice(allPlayerIds);
          // Pick target (could be inmate, guard, or invalid)
          const targetId = rng.next() < 0.7 ? rng.choice(inmateIds) : rng.choice(allPlayerIds);

          const priorMeter = prisonState.revoltMeter;
          const priorQuota = prisonState.guardSanctionsRemaining ?? 3;
          const priorRiot = prisonState.riotTriggered;

          // Test both executePrisonSanction and applyPrisonSanction
          const executeResult = executePrisonSanction(lobby, actorId, targetId);
          const applyResult = applyPrisonSanction(prisonState, actorId, targetId);

          // Behavioral consistency between lobby and state helpers
          if (!priorRiot && players[actorId]?.isAlive && players[targetId]?.isAlive) {
            assertInvariant(
              executeResult.success === applyResult.success,
              `Iter ${iter} Step ${step}: Consistency between execute and apply sanction (${executeResult.error} vs ${applyResult.error})`
            );
          }

          if (executeResult.success) {
            stats.totalSanctionsExecuted++;
            lobby = executeResult.updatedLobby;
            prisonState = lobby.minigameSubStates!.stanfordPrison!;
            assertInvariant(
              prisonState.guardSanctionsRemaining === priorQuota - 1,
              `Sanctions quota must decrement by 1`
            );
            assertInvariant(
              prisonState.revoltMeter === Math.min(100, priorMeter + 15),
              `Revolt meter must increase by +15 clamped to 100`
            );
            if (prisonState.revoltMeter >= 100) {
              stats.totalRiotsTriggered++;
              assertInvariant(prisonState.riotTriggered, 'Riot triggered at 100');
            }
          } else {
            // Failure invariants
            if (priorRiot) {
              assertInvariant(
                executeResult.error === 'RIOT_ALREADY_TRIGGERED',
                `Must reject with RIOT_ALREADY_TRIGGERED`
              );
            } else if (
              priorQuota <= 0 &&
              prisonState.guardPlayerIds.includes(actorId) &&
              players[actorId]?.isAlive
            ) {
              assertInvariant(
                executeResult.error === 'NO_SANCTIONS_REMAINING',
                `Must reject with NO_SANCTIONS_REMAINING, got ${executeResult.error}`
              );
            }
          }
          break;
        }

        // Event 2: Interactive Solitary Confinement
        case 2: {
          const allPlayerIds = Object.keys(players);
          const actorId = rng.next() < 0.7
            ? rng.choice([...prisonState.guardPlayerIds, prisonState.wardenPlayerId])
            : rng.choice(allPlayerIds);
          const targetId = rng.choice(allPlayerIds);

          const priorMeter = prisonState.revoltMeter;
          const priorRiot = prisonState.riotTriggered;
          const wasAlreadyInSolitary = prisonState.solitaryConfinementPlayerIds.includes(targetId);
          const isActorGuardOrWarden =
            prisonState.guardPlayerIds.includes(actorId) ||
            prisonState.wardenPlayerId === actorId;
          const isTargetAliveInmate =
            players[targetId]?.isAlive &&
            prisonState.inmatePlayerIds.includes(targetId);

          const executeResult = executePrisonSolitary(lobby, actorId, targetId);
          const applyResult = applyPrisonSolitary(prisonState, actorId, targetId);

          if (!priorRiot && players[actorId]?.isAlive && players[targetId]?.isAlive) {
            assertInvariant(
              executeResult.success === applyResult.success,
              `Iter ${iter} Step ${step}: Consistency between execute and apply solitary`
            );
          }

          if (executeResult.success) {
            stats.totalSolitaryExecuted++;
            lobby = executeResult.updatedLobby;
            prisonState = lobby.minigameSubStates!.stanfordPrison!;
            assertInvariant(
              prisonState.revoltMeter === Math.max(0, priorMeter - 5),
              `Meter must decrement by -5 clamped at 0`
            );
            assertInvariant(
              prisonState.solitaryConfinementPlayerIds.includes(targetId),
              `Target must be in solitaryConfinementPlayerIds`
            );
            assertInvariant(
              !lobby.liveVotes?.[targetId],
              `Target's live vote must be purged`
            );
            assertInvariant(
              !lobby.trialVerdictVotes?.[targetId],
              `Target's verdict vote must be purged`
            );
          } else {
            if (priorRiot) {
              assertInvariant(
                executeResult.error === 'RIOT_ALREADY_TRIGGERED',
                'Solitary rejected post-riot'
              );
            } else if (
              wasAlreadyInSolitary &&
              players[actorId]?.isAlive &&
              isActorGuardOrWarden &&
              isTargetAliveInmate
            ) {
              assertInvariant(
                executeResult.error === 'ALREADY_IN_SOLITARY',
                'Duplicate solitary rejected'
              );
            }
          }
          break;
        }

        // Event 3: Round Tick (`processStanfordPrisonRound`)
        case 3: {
          stats.totalRoundsProcessed++;
          const sampledGuards = rng.sample(prisonState.guardPlayerIds, rng.int(0, 2));
          const appeasedInmates = rng.sample(prisonState.inmatePlayerIds, rng.int(0, 2));
          const lynchedInmates = rng.sample(prisonState.inmatePlayerIds, rng.int(0, 1));
          const solitaryInmates = rng.sample(prisonState.inmatePlayerIds, rng.int(0, 2));
          const assassinStrike = hasAssassin && rng.next() > 0.5;
          const assassinTarget = assassinStrike ? rng.choice([...prisonState.guardPlayerIds, wardenId, 'non-existent']) : null;

          const priorRiot = prisonState.riotTriggered;

          const roundOut = processStanfordPrisonRound({
            currentState: prisonState,
            guardSanctionIds: sampledGuards,
            wardenAppeasedInmateIds: appeasedInmates,
            inmatesLynchedIds: lynchedInmates,
            inmatesPlacedInSolitary: solitaryInmates,
            secretAssassinStrike: assassinStrike,
            assassinStrikeTargetId: assassinTarget,
          });

          // Sync player alive status if assassinated or lynched
          if (roundOut.assassinatedGuardId && players[roundOut.assassinatedGuardId]) {
            players[roundOut.assassinatedGuardId] = {
              ...players[roundOut.assassinatedGuardId],
              isAlive: false,
            };
          }
          for (const lid of lynchedInmates) {
            if (players[lid]) {
              players[lid] = { ...players[lid], isAlive: false };
            }
          }

          prisonState = roundOut.updatedState;
          lobby = {
            ...lobby,
            minigameSubStates: {
              ...lobby.minigameSubStates,
              stanfordPrison: prisonState,
            },
          };

          if (priorRiot) {
            assertInvariant(
              prisonState.riotTriggered === true,
              `riotTriggered must remain true once triggered`
            );
          }
          if (prisonState.revoltMeter >= 100) {
            stats.totalRiotsTriggered++;
            assertInvariant(prisonState.riotTriggered, 'Riot triggered at 100 in round');
          }
          break;
        }

        // Event 4: Live Voting Invariant Check (Solitary Disenfranchisement)
        case 4: {
          stats.totalVotingChecks++;
          // Randomize live votes from all living players
          const testVotes: Record<string, string> = {};
          const livingInmates = inmateIds.filter(id => players[id].isAlive);
          for (const iid of livingInmates) {
            testVotes[iid] = wardenId;
          }
          lobby = {
            ...lobby,
            liveVotes: testVotes,
            minigameSubStates: {
              ...lobby.minigameSubStates,
              stanfordPrison: prisonState,
            },
          };

          const votingOut = runVotingEngine({ lobby });
          const solitarySet = new Set(prisonState.solitaryConfinementPlayerIds);
          const wardenTally = votingOut.tallies.find(t => t.candidateId === wardenId);

          if (wardenTally) {
            for (const voterId of wardenTally.voterIds) {
              assertInvariant(
                !solitarySet.has(voterId),
                `Solitary inmate ${voterId} must NEVER be included in voting tally voterIds`
              );
            }
          }
          break;
        }

        // Event 5: Dispatch Minigame Phase Event
        case 5: {
          const dispatchOut = dispatchMinigamePhaseEvent({
            lobby,
            isDayPhase: rng.next() > 0.5,
            roundNumber: step + 1,
            prisonGuardSanctions: rng.sample(guardIds, rng.int(0, 1)),
            prisonWardenAppeased: [],
            prisonInmatesLynched: [],
            prisonSolitary: [],
            prisonAssassinStrike: false,
            prisonAssassinTarget: null,
          });
          if (dispatchOut.updatedSubStates?.stanfordPrison) {
            prisonState = dispatchOut.updatedSubStates.stanfordPrison;
            lobby = {
              ...lobby,
              minigameSubStates: {
                ...lobby.minigameSubStates,
                stanfordPrison: prisonState,
              },
            };
          }
          break;
        }
      }

      // Continuous invariant evaluation after EVERY single event
      verifyStanfordPrisonInvariants(
        prisonState,
        `Iter ${iter} Step ${step} (event ${eventType})`,
        lobby
      );
    }
  }

  console.log(`  ✔ Monte Carlo stress fuzzing completed successfully!`);
  console.log(`    - Total Iterations: ${stats.totalIterations}`);
  console.log(`    - Total Action Events: ${stats.totalEventsProcessed}`);
  console.log(`    - Sanctions Executed: ${stats.totalSanctionsExecuted}`);
  console.log(`    - Solitary Confinements Executed: ${stats.totalSolitaryExecuted}`);
  console.log(`    - Rounds Processed: ${stats.totalRoundsProcessed}`);
  console.log(`    - Voting Integrity Checks: ${stats.totalVotingChecks}`);
  console.log(`    - Riots Triggered & Verified: ${stats.totalRiotsTriggered}`);
  console.log(`    - Total Invariant Assertions Evaluated: ${totalAssertionsChecked}`);
}

// ============================================================================
// MAIN EXECUTION ENTRYPOINT
// ============================================================================

async function main() {
  console.log('🧪 Starting Empirical Stanford Prison Stress Fuzzing Suite...\n');
  const startTime = Date.now();

  runAdversarialBoundarySuites();
  runMonteCarloFuzzing(3000);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 ALL STANFORD PRISON STRESS & INVARIANT TESTS PASSED WITH 100% SUCCESS (${duration}s)!`);
}

main().catch(err => {
  console.error('\n❌ EMPIRICAL STRESS FUZZING FAILED:');
  console.error(err);
  process.exit(1);
});
