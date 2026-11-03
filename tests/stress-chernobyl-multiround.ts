/**
 * Empirical Stress Harness & Monte Carlo Multi-Round Verification Suite:
 * Chernobyl Exclusion Zone Phase Gating & Decontamination Non-Recurrence
 *
 * Authored by: challenger_m3_3 (Milestone 3 Empirical Challenger)
 * Scope:
 *   Suite 1: Deterministic Phase-Gating Invariants (TRIAL_DEFENSE vs NIGHT_BUFFER morning transitions).
 *   Suite 2: Decontamination Lifecycle & Non-Recurrence Empirical Verification.
 *   Suite 3: 500+ Monte Carlo Round Cycles Simulation Harness (alternating Day & Night).
 *   Suite 4: Boundary & Adversarial Stress Edge Cases.
 */

import assert from 'node:assert';
import {
  processChernobylRound,
  applyChernobylShelter,
  applyChernobylDecontamination,
  dispatchMinigamePhaseEvent,
} from '../src/server/engine/minigames-engine';
import {
  createInitialChernobylState,
  CHERNOBYL_DEFAULTS,
} from '../src/config/minigames.config';
import { inMemoryLobbyStore } from '../src/server/state/memory';
import { ChernobylState } from '../src/types/minigames';
import { GamePhase, LobbyState, PlayerSession } from '../src/types/game';
import { formatRoleDisplay } from '../src/types/roles';

// ─── Helpers & Fixtures ───────────────────────────────────────────────────────

class DeterministicRNG {
  private state: number;
  constructor(seed: number = 8675309) {
    this.state = seed || 1;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }
  sample<T>(arr: readonly T[], count: number): T[] {
    const copy = [...arr];
    const picked: T[] = [];
    const n = Math.min(count, copy.length);
    for (let i = 0; i < n; i++) {
      const idx = this.nextInt(0, copy.length - 1);
      picked.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return picked;
  }
}

function makePlayer(opts: {
  id: string;
  username: string;
  roleName?: string;
  isAlive?: boolean;
}): PlayerSession {
  return {
    socketId: `sock-${opts.id}`,
    userId: opts.id,
    username: opts.username,
    tier: 'TIER_1',
    adminRole: 'NONE',
    isHost: false,
    isAlive: opts.isAlive ?? true,
    hasHostWaiver: false,
    hasAdminWaiver: false,
    displayRole: formatRoleDisplay(
      opts.username,
      opts.roleName ?? 'Citizen',
      opts.roleName ?? 'Citizen'
    ),
    allInIdentity: {
      layer1Faction: 'TOWN',
      layer2Office: 'PUBLIC_DEFENDER',
      layer3Trait: 'CONTRABAND_POCKET',
      district: 'COMMERCIAL',
    },
    currentDistrict: 'COMMERCIAL',
    disconnectedAt: null,
    isAiBotControlled: false,
  };
}

function createTestLobby(
  lobbyId: string,
  players: Record<string, PlayerSession>,
  chernobyl: ChernobylState,
  phase: GamePhase = 'DAY_VOTING',
  roundNumber: number = 1
): LobbyState {
  const hostId = Object.keys(players)[0] ?? 'p1';
  return {
    lobbyId,
    hostUserId: hostId,
    mode: 'CHERNOBYL_EXCLUSION_ZONE',
    phase,
    players,
    hostReady: true,
    adminMasterUnlock: {
      architectUnlocked: false,
      bailiffUnlocked: false,
      dualLockVerified: false,
      unlockedAt: null,
    },
    assignedArchitectId: null,
    assignedBailiffId: null,
    phaseDurationSeconds: 60,
    phaseTimeRemaining: 60,
    nightJitterDelaySeconds: 4,
    liveVotes: {},
    trialVerdictVotes: {},
    accusedPlayerId: null,
    mayorRevealedUserIds: [],
    speakerQueue: [],
    bufferedNightActions: [],
    minigameSubStates: {
      chernobyl,
    },
    roundNumber,
    lastLynchedUserId: null,
    globalNightKillCap: 5,
    chatMessages: [],
  };
}

function buildEmptyDispatchInputs(lobbyId: string, isMorningArrival?: boolean, phase?: string) {
  return {
    lobbyId,
    isMorningArrival,
    phase,
    danteGreedAbilityUsers: [],
    danteLynchedPlayerId: null,
    earthInnocentsLynched: [],
    earthKlaatuFreezeActivated: false,
    earthGortTarget: null,
    valkyrieBriefcasePassTarget: null,
    prisonGuardSanctions: [],
    prisonWardenAppeased: [],
    prisonInmatesLynched: [],
    prisonSolitary: [],
    prisonAssassinStrike: false,
    prisonAssassinTarget: null,
    catenaccioSniperTarget: null,
    catenaccioWallAttackers: [],
    publicDeaths: [],
  };
}

// ============================================================================
// SUITE 1: DETERMINISTIC PHASE-GATING INVARIANTS
// ============================================================================

function testSuite1PhaseGatingInvariants(): void {
  console.log('--- [Suite 1] Deterministic Phase-Gating Invariants ---');

  // Test 1.1: TRIAL_DEFENSE phase (isMorningArrival: false) strictly halts Chernobyl radiation
  {
    console.log('▶ Test 1.1: TRIAL_DEFENSE dispatch with isMorningArrival: false skips Chernobyl execution');
    const lobbyId = 'lobby-phase-gate-trial';
    const playerIds = ['p1', 'p2', 'p3', 'p4'];
    const players: Record<string, PlayerSession> = {};
    for (const id of playerIds) {
      players[id] = makePlayer({ id, username: id });
    }

    const state = createInitialChernobylState(playerIds, {
      initialContamination: 30,
      bunkerCapacity: 2,
    });
    // Give p1 initial dosage of 40 mSv
    const stateWithDose: ChernobylState = {
      ...state,
      radiationDosage: { p1: 40, p2: 0, p3: 0, p4: 0 },
      decontaminatedPlayerIds: ['p1'], // pending decontamination in queue
    };

    inMemoryLobbyStore.createLobby(lobbyId, 'p1', players['p1'], 'STANDARD');
    inMemoryLobbyStore.updateLobby(lobbyId, (l) =>
      createTestLobby(lobbyId, players, stateWithDose, 'TRIAL_DEFENSE', 1)
    );

    const dispatchRes = dispatchMinigamePhaseEvent({
      ...buildEmptyDispatchInputs(lobbyId, false),
    });

    // Invariant: chernobylResult must be null
    assert.strictEqual(
      dispatchRes.chernobylResult,
      null,
      'Chernobyl must NOT execute during TRIAL_DEFENSE transition'
    );

    // Invariant: substate must be unchanged
    const chernobylAfter = dispatchRes.updatedSubStates.chernobyl!;
    assert.strictEqual(
      chernobylAfter.zoneContaminationLevel,
      30,
      'Zone contamination must remain strictly at 30 mSv'
    );
    assert.strictEqual(
      chernobylAfter.radiationDosage['p1'],
      40,
      'Player dosage must remain strictly unchanged at 40 mSv'
    );
    assert.deepStrictEqual(
      chernobylAfter.decontaminatedPlayerIds,
      ['p1'],
      'Pending decontamination queue must NOT be cleared during trial defense transition'
    );
    assert.deepStrictEqual(
      chernobylAfter.radiationCasualties,
      [],
      'Casualties must remain empty'
    );
    console.log('  ✔ TRIAL_DEFENSE transition bypassed Chernobyl without mutating state.');
  }

  // Test 1.2: Morning Arrival (isMorningArrival: true) executes Chernobyl and increments zone contamination
  {
    console.log('▶ Test 1.2: Morning Arrival transition executes Chernobyl, increments zone, and clears queue');
    const lobbyId = 'lobby-phase-gate-morning';
    const playerIds = ['p1', 'p2', 'p3', 'p4'];
    const players: Record<string, PlayerSession> = {};
    for (const id of playerIds) {
      players[id] = makePlayer({ id, username: id });
    }

    const state: ChernobylState = {
      radiationDosage: { p1: 40, p2: 10, p3: 0, p4: 0 },
      shelteredPlayerIds: ['p2'],
      bunkerCapacity: 2,
      zoneContaminationLevel: 30,
      decontaminatedPlayerIds: ['p1'],
      radiationCasualties: [],
      lethalThreshold: 100,
      liquidatorPlayerId: null,
    };

    inMemoryLobbyStore.createLobby(lobbyId, 'p1', players['p1'], 'STANDARD');
    inMemoryLobbyStore.updateLobby(lobbyId, (l) =>
      createTestLobby(lobbyId, players, state, 'NIGHT_BUFFER', 1)
    );

    const dispatchRes = dispatchMinigamePhaseEvent({
      ...buildEmptyDispatchInputs(lobbyId, true),
      chernobylShelteredPlayerIds: ['p2'],
    });

    assert.notStrictEqual(
      dispatchRes.chernobylResult,
      null,
      'Chernobyl MUST execute during morning arrival'
    );

    const result = dispatchRes.chernobylResult!;
    // p1: 40 - 50 (decontam) = 0 + 30 (unsheltered) = 30 mSv
    assert.strictEqual(
      result.updatedState.radiationDosage['p1'],
      30,
      'p1 receives -50 decontam and +30 unsheltered = 30 mSv'
    );
    // p2: sheltered -> 10 + 0 = 10 mSv
    assert.strictEqual(
      result.updatedState.radiationDosage['p2'],
      10,
      'p2 is sheltered -> remains 10 mSv'
    );
    // p3: unsheltered -> 0 + 30 = 30 mSv
    assert.strictEqual(
      result.updatedState.radiationDosage['p3'],
      30,
      'p3 is unsheltered -> 0 + 30 = 30 mSv'
    );
    // Zone contamination increments 30 -> 45 mSv
    assert.strictEqual(
      result.updatedState.zoneContaminationLevel,
      45,
      'Zone contamination must increment to 45 mSv'
    );
    // Decontamination queue strictly resets to []
    assert.deepStrictEqual(
      result.updatedState.decontaminatedPlayerIds,
      [],
      'decontaminatedPlayerIds queue must be reset to empty array'
    );
    console.log('  ✔ Morning arrival transition executed cleanly with expected accruals and queue reset.');
  }

  // Test 1.3: Default phase fallback when isMorningArrival is omitted
  {
    console.log('▶ Test 1.3: Phase fallback when isMorningArrival is omitted');
    const lobbyId = 'lobby-phase-fallback';
    const playerIds = ['p1', 'p2'];
    const players: Record<string, PlayerSession> = {
      p1: makePlayer({ id: 'p1', username: 'p1' }),
      p2: makePlayer({ id: 'p2', username: 'p2' }),
    };
    const state = createInitialChernobylState(playerIds, { initialContamination: 20 });

    inMemoryLobbyStore.createLobby(lobbyId, 'p1', players['p1'], 'STANDARD');

    // Case A: lobby in TRIAL_DEFENSE -> should evaluate to false
    inMemoryLobbyStore.updateLobby(lobbyId, (l) =>
      createTestLobby(lobbyId, players, state, 'TRIAL_DEFENSE', 1)
    );
    const trialRes = dispatchMinigamePhaseEvent({
      ...buildEmptyDispatchInputs(lobbyId, undefined),
    });
    assert.strictEqual(trialRes.chernobylResult, null, 'Fallback must skip for TRIAL_DEFENSE');

    // Case B: lobby in NIGHT_BUFFER -> should evaluate to true
    inMemoryLobbyStore.updateLobby(lobbyId, (l) =>
      createTestLobby(lobbyId, players, state, 'NIGHT_BUFFER', 1)
    );
    const nightRes = dispatchMinigamePhaseEvent({
      ...buildEmptyDispatchInputs(lobbyId, undefined),
    });
    assert.notStrictEqual(nightRes.chernobylResult, null, 'Fallback must execute for NIGHT_BUFFER');
    console.log('  ✔ Fallback evaluation strictly adheres to phase gating rules.');
  }
}

// ============================================================================
// SUITE 2: DECONTAMINATION LIFECYCLE & NON-RECURRENCE EMPIRICAL VERIFICATION
// ============================================================================

function testSuite2DecontaminationNonRecurrence(): void {
  console.log('--- [Suite 2] Decontamination Lifecycle & Non-Recurrence Invariants ---');

  // Test 2.1: 5-round lifecycle of a single player under alternating decontamination
  {
    console.log('▶ Test 2.1: 5-round tracking of single subject across treat / un-treat cycles');
    const playerIds = ['subject', 'bystander'];
    const players: Record<string, PlayerSession> = {
      subject: makePlayer({ id: 'subject', username: 'subject' }),
      bystander: makePlayer({ id: 'bystander', username: 'bystander' }),
    };

    let currentState: ChernobylState = {
      radiationDosage: { subject: 60, bystander: 20 },
      shelteredPlayerIds: [],
      bunkerCapacity: 1,
      zoneContaminationLevel: 25,
      decontaminatedPlayerIds: [],
      radiationCasualties: [],
      lethalThreshold: 150,
      liquidatorPlayerId: null,
    };

    // Round 1: Subject is decontaminated, unsheltered.
    // Treatment: -50 mSv. Ambient: +25 mSv. Net delta: -25 mSv. Dosage: 60 - 50 + 25 = 35 mSv.
    const r1 = processChernobylRound({
      currentState,
      shelteredPlayerIds: [],
      decontaminatedPlayerIds: ['subject'],
    }, players);

    assert.strictEqual(r1.updatedState.radiationDosage['subject'], 35, 'R1: 60 - 50 + 25 = 35 mSv');
    assert.strictEqual(r1.dosageDeltas['subject'], -25, 'R1 delta: -25 mSv');
    assert.deepStrictEqual(r1.updatedState.decontaminatedPlayerIds, [], 'R1: queue reset to []');
    assert.strictEqual(r1.updatedState.zoneContaminationLevel, 40, 'Zone increments 25 -> 40 mSv');

    // Round 2: Subject is NOT scheduled for decontamination, unsheltered.
    // CRUCIAL INVARIANT: No phantom -50 mSv! Subject must take ambient +40 mSv.
    // Dosage: 35 + 40 = 75 mSv. Delta: +40 mSv.
    const r2 = processChernobylRound({
      currentState: r1.updatedState,
      shelteredPlayerIds: [],
      // decontaminatedPlayerIds omitted!
    }, players);

    assert.strictEqual(
      r2.updatedState.radiationDosage['subject'],
      75,
      'R2 INVARIANT: Subject must accrue full ambient +40 mSv without recurring -50 mSv deduction (35 + 40 = 75)'
    );
    assert.strictEqual(r2.dosageDeltas['subject'], 40, 'R2 delta: strictly +40 mSv');
    assert.deepStrictEqual(r2.updatedState.decontaminatedPlayerIds, [], 'R2: queue remains []');
    assert.strictEqual(r2.updatedState.zoneContaminationLevel, 55, 'Zone increments 40 -> 55 mSv');

    // Round 3: Subject is sheltered in bunker, NOT decontaminated.
    // Dosage: 75 + 0 = 75 mSv. Delta: 0 mSv.
    const r3 = processChernobylRound({
      currentState: r2.updatedState,
      shelteredPlayerIds: ['subject'],
      decontaminatedPlayerIds: [],
    }, players);

    assert.strictEqual(r3.updatedState.radiationDosage['subject'], 75, 'R3: Sheltered subject remains at 75 mSv');
    assert.strictEqual(r3.dosageDeltas['subject'], 0, 'R3 delta: strictly 0');
    assert.strictEqual(r3.updatedState.zoneContaminationLevel, 70, 'Zone increments 55 -> 70 mSv');

    // Round 4: Subject is unsheltered and decontaminated AGAIN explicitly.
    // Dosage: 75 - 50 + 70 = 95 mSv. Delta: +20 mSv.
    const r4 = processChernobylRound({
      currentState: r3.updatedState,
      shelteredPlayerIds: [],
      decontaminatedPlayerIds: ['subject'],
    }, players);

    assert.strictEqual(r4.updatedState.radiationDosage['subject'], 95, 'R4: 75 - 50 + 70 = 95 mSv');
    assert.strictEqual(r4.dosageDeltas['subject'], 20, 'R4 delta: 70 - 50 = +20 mSv');
    assert.deepStrictEqual(r4.updatedState.decontaminatedPlayerIds, [], 'R4: queue reset to []');
    assert.strictEqual(r4.updatedState.zoneContaminationLevel, 85, 'Zone increments 70 -> 85 mSv');

    // Round 5: Subject is sheltered and decontaminated.
    // Dosage: 95 - 50 + 0 = 45 mSv. Delta: -50 mSv.
    const r5 = processChernobylRound({
      currentState: r4.updatedState,
      shelteredPlayerIds: ['subject'],
      decontaminatedPlayerIds: ['subject'],
    }, players);

    assert.strictEqual(r5.updatedState.radiationDosage['subject'], 45, 'R5: 95 - 50 + 0 = 45 mSv');
    assert.strictEqual(r5.dosageDeltas['subject'], -50, 'R5 delta: -50 mSv');
    assert.deepStrictEqual(r5.updatedState.decontaminatedPlayerIds, [], 'R5: queue reset to []');

    console.log('  ✔ 5-round lifecycle proved non-recurrence and explicit rescheduling semantics.');
  }

  // Test 2.2: Clamp to 0 mSv lower bound does not cause negative delta leaks
  {
    console.log('▶ Test 2.2: Decontamination lower bound clamp (0 mSv) across multi-round sequence');
    const playerIds = ['p1'];
    const players: Record<string, PlayerSession> = {
      p1: makePlayer({ id: 'p1', username: 'p1' }),
    };

    const state: ChernobylState = {
      radiationDosage: { p1: 15 },
      shelteredPlayerIds: ['p1'],
      bunkerCapacity: 1,
      zoneContaminationLevel: 30,
      decontaminatedPlayerIds: [],
      radiationCasualties: [],
      lethalThreshold: 100,
      liquidatorPlayerId: null,
    };

    // Round 1: 15 mSv, sheltered, decontaminated (-50 mSv) -> clamped to 0
    const out1 = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['p1'],
      decontaminatedPlayerIds: ['p1'],
    }, players);

    assert.strictEqual(out1.updatedState.radiationDosage['p1'], 0, 'Dosage clamped to 0');
    assert.strictEqual(out1.dosageDeltas['p1'], -15, 'Delta clamped to -15 (not -50)');

    // Round 2: Unsheltered, NOT decontaminated
    const out2 = processChernobylRound({
      currentState: out1.updatedState,
      shelteredPlayerIds: [],
    }, players);

    assert.strictEqual(out2.updatedState.radiationDosage['p1'], 45, 'Accrues full 45 mSv from 0');
    assert.strictEqual(out2.dosageDeltas['p1'], 45, 'Delta is +45 mSv');
    console.log('  ✔ Lower bound clamping cleanly resolved without math underflow.');
  }
}

// ============================================================================
// SUITE 3: 500+ MONTE CARLO MULTI-ROUND SIMULATION HARNESS
// ============================================================================

interface MonteCarloStats {
  totalDayTransitionsTested: number;
  totalMorningTransitionsTested: number;
  totalRoundCyclesCompleted: number;
  totalDecontaminationsRequested: number;
  totalDecontaminationsExecuted: number;
  totalUnscheduledRoundsVerified: number;
  totalShelterEvents: number;
  totalBunkerOverflowsRejected: number;
  totalCasualtiesRecorded: number;
  totalInvariantsChecked: number;
}

function testSuite3MonteCarloSimulationHarness(): void {
  console.log('--- [Suite 3] 500+ Monte Carlo Round Cycles Simulation Harness ---');

  const rng = new DeterministicRNG(424242);
  const stats: MonteCarloStats = {
    totalDayTransitionsTested: 0,
    totalMorningTransitionsTested: 0,
    totalRoundCyclesCompleted: 0,
    totalDecontaminationsRequested: 0,
    totalDecontaminationsExecuted: 0,
    totalUnscheduledRoundsVerified: 0,
    totalShelterEvents: 0,
    totalBunkerOverflowsRejected: 0,
    totalCasualtiesRecorded: 0,
    totalInvariantsChecked: 0,
  };

  const TARGET_ROUND_CYCLES = 550; // Exceeds 500+ round cycles

  console.log(
    `Executing at least ${TARGET_ROUND_CYCLES} total Monte Carlo round cycles across dynamic multi-round sessions...`
  );

  let sessionIdx = 0;
  while (stats.totalRoundCyclesCompleted < TARGET_ROUND_CYCLES) {
    sessionIdx++;
    const lobbyId = `mc-lobby-${sessionIdx}`;
    const playerCount = rng.nextInt(6, 12);
    const bunkerCapacity = rng.nextInt(1, 3);
    const lethalThreshold = rng.nextInt(90, 150);
    const initialContamination = rng.nextInt(15, 30);
    const contaminationIncrement = 15;
    const maxRoundsThisSession = rng.nextInt(15, 25);


    const playerIds: string[] = [];
    const players: Record<string, PlayerSession> = {};
    for (let i = 0; i < playerCount; i++) {
      const id = `p_${sessionIdx}_${i}`;
      playerIds.push(id);
      players[id] = makePlayer({ id, username: `Player_${i}` });
    }

    let chernobylState = createInitialChernobylState(playerIds, {
      bunkerCapacity,
      initialContamination,
      lethalThreshold,
    });

    inMemoryLobbyStore.createLobby(lobbyId, playerIds[0], players[playerIds[0]], 'STANDARD');
    inMemoryLobbyStore.updateLobby(lobbyId, (l) =>
      createTestLobby(lobbyId, players, chernobylState, 'DAY_VOTING', 1)
    );

    // Track historical decontaminations per player: playerId -> round last decontaminated
    const lastDecontaminatedInRound: Record<string, number> = {};

    for (let round = 1; round <= maxRoundsThisSession; round++) {
      const currentAlivePlayerIds = playerIds.filter(id => players[id].isAlive);

      // If all or almost all players died from radiation sickness, replenish or end session
      if (currentAlivePlayerIds.length <= 1) {
        break;
      }

      // ──────────────────────────────────────────────────────────────────────
      // STEP 1: DAY PHASE TRANSITIONS (TRIAL_DEFENSE & DAY_VOTING)
      // ──────────────────────────────────────────────────────────────────────

      // 1A. Transition into TRIAL_DEFENSE
      inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
        ...l,
        phase: 'TRIAL_DEFENSE',
        accusedPlayerId: rng.pick(currentAlivePlayerIds),
      }));

      const dayDispatch = dispatchMinigamePhaseEvent({
        ...buildEmptyDispatchInputs(lobbyId, false, 'TRIAL_DEFENSE'),
      });
      stats.totalDayTransitionsTested++;

      // INVARIANT 1: Chernobyl must NOT tick on daytime transition (isMorningArrival: false)
      assert.strictEqual(
        dayDispatch.chernobylResult,
        null,
        `[Session ${sessionIdx} Round ${round}] Chernobyl must NOT execute during TRIAL_DEFENSE (isMorningArrival: false)`
      );
      stats.totalInvariantsChecked++;

      // INVARIANT 2: State must not be mutated by day transition
      assert.strictEqual(
        dayDispatch.updatedSubStates.chernobyl?.zoneContaminationLevel,
        chernobylState.zoneContaminationLevel,
        `[Session ${sessionIdx} Round ${round}] Zone contamination must NOT increment during day phase`
      );
      stats.totalInvariantsChecked++;

      for (const pid of currentAlivePlayerIds) {
        assert.strictEqual(
          dayDispatch.updatedSubStates.chernobyl?.radiationDosage[pid],
          chernobylState.radiationDosage[pid],
          `[Session ${sessionIdx} Round ${round}] Player ${pid} dosage must not mutate during day phase`
        );
        stats.totalInvariantsChecked++;
      }

      // ──────────────────────────────────────────────────────────────────────
      // STEP 2: NIGHT PHASE DECISIONS (BUNKER ENTRY & DECONTAMINATION ACTIONS)
      // ──────────────────────────────────────────────────────────────────────

      // 2A. Random players request bunker shelter (often exceeding bunkerCapacity)
      const shelterCandidates = rng.sample(
        currentAlivePlayerIds,
        rng.nextInt(0, currentAlivePlayerIds.length)
      );
      if (shelterCandidates.length > bunkerCapacity) {
        stats.totalBunkerOverflowsRejected += shelterCandidates.length - bunkerCapacity;
      }
      stats.totalShelterEvents += shelterCandidates.length;

      // 2B. Liquidator targets player for decontamination (with 50% probability)
      const scheduledDeconThisRound: string[] = [];
      const shouldDecontaminate = rng.next() < 0.5;
      if (shouldDecontaminate && currentAlivePlayerIds.length > 0) {
        // Pick an alive player (biased towards players with higher dosage)
        const target = rng.pick(currentAlivePlayerIds);
        scheduledDeconThisRound.push(target);
        stats.totalDecontaminationsRequested++;
      }

      // Enqueue scheduled decontamination into lobby substate (simulating route.ts action)
      inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
        ...l,
        phase: 'NIGHT_BUFFER',
        minigameSubStates: {
          chernobyl: {
            ...l.minigameSubStates.chernobyl!,
            shelteredPlayerIds: shelterCandidates,
            decontaminatedPlayerIds: scheduledDeconThisRound,
          },
        },
      }));

      // Snapshot state prior to morning transition
      const preMorningZone = chernobylState.zoneContaminationLevel;
      const preMorningDosages: Record<string, number> = { ...chernobylState.radiationDosage };
      const preMorningCasualties = new Set(chernobylState.radiationCasualties);

      // ──────────────────────────────────────────────────────────────────────
      // STEP 3: MORNING ARRIVAL TRANSITION (isMorningArrival: true)
      // ──────────────────────────────────────────────────────────────────────

      const morningDispatch = dispatchMinigamePhaseEvent({
        ...buildEmptyDispatchInputs(lobbyId, true, 'NIGHT_BUFFER'),
        chernobylShelteredPlayerIds: shelterCandidates,
        chernobylDecontaminatePlayerIds: scheduledDeconThisRound,
      });
      stats.totalMorningTransitionsTested++;

      // INVARIANT 3: Chernobyl MUST execute on morning arrival
      assert.notStrictEqual(
        morningDispatch.chernobylResult,
        null,
        `[Session ${sessionIdx} Round ${round}] Chernobyl MUST execute during morning arrival`
      );
      stats.totalInvariantsChecked++;

      const chResult = morningDispatch.chernobylResult!;
      chernobylState = chResult.updatedState;

      // INVARIANT 4: Zone contamination must increment by exactly contaminationIncrement (+15 mSv)
      assert.strictEqual(
        chernobylState.zoneContaminationLevel,
        preMorningZone + contaminationIncrement,
        `[Session ${sessionIdx} Round ${round}] Zone contamination must increment by +15 mSv`
      );
      stats.totalInvariantsChecked++;

      // INVARIANT 5: Bunker capacity limit strictly enforced
      const effectiveSheltered = shelterCandidates.slice(0, bunkerCapacity);
      assert.strictEqual(
        chernobylState.shelteredPlayerIds.length,
        effectiveSheltered.length,
        `[Session ${sessionIdx} Round ${round}] Sheltered count cannot exceed bunkerCapacity (${bunkerCapacity})`
      );
      stats.totalInvariantsChecked++;

      const shelteredSet = new Set(chernobylState.shelteredPlayerIds);

      // INVARIANT 6: Decontaminated queue in updated state strictly resets to []
      assert.deepStrictEqual(
        chernobylState.decontaminatedPlayerIds,
        [],
        `[Session ${sessionIdx} Round ${round}] decontaminatedPlayerIds MUST be empty array after morning resolution`
      );
      stats.totalInvariantsChecked++;

      // INVARIANT 7: Player dosage calculations & DECONTAMINATION NON-RECURRENCE
      for (const pid of currentAlivePlayerIds) {
        const prevDose = preMorningDosages[pid] ?? 0;
        const wasScheduledDecon = scheduledDeconThisRound.includes(pid);
        const wasSheltered = shelteredSet.has(pid);

        // Verification of Non-Recurrence:
        // If player was treated in round N-1, but NOT scheduled in round N, they must NOT receive healing!
        if (lastDecontaminatedInRound[pid] === round - 1 && !wasScheduledDecon) {
          stats.totalUnscheduledRoundsVerified++;
          // Must receive ZERO decontamination reduction
        }

        const expectedReduction = wasScheduledDecon ? Math.min(prevDose, 50) : 0;
        const expectedDoseAfterHeal = Math.max(0, prevDose - expectedReduction);
        const expectedAmbient = wasSheltered ? 0 : preMorningZone;
        const expectedFinalDose = expectedDoseAfterHeal + expectedAmbient;
        const expectedDelta = expectedFinalDose - prevDose;

        const actualDose = chernobylState.radiationDosage[pid];
        const actualDelta = chResult.dosageDeltas[pid];

        // Strict assertion: Actual dosage matches mathematical expectation exactly
        assert.strictEqual(
          actualDose,
          expectedFinalDose,
          `[Session ${sessionIdx} Round ${round} Player ${pid}] Dosage mismatch: expected ${expectedFinalDose}, got ${actualDose}. ` +
            `(prev=${prevDose}, decon=${wasScheduledDecon}, sheltered=${wasSheltered}, zone=${preMorningZone})`
        );
        stats.totalInvariantsChecked++;

        // Strict assertion: Net delta matches mathematical expectation exactly
        assert.strictEqual(
          actualDelta,
          expectedDelta,
          `[Session ${sessionIdx} Round ${round} Player ${pid}] Delta mismatch: expected ${expectedDelta}, got ${actualDelta}`
        );
        stats.totalInvariantsChecked++;

        // Strict assertion: Lower bound clamp (>= 0)
        assert.ok(
          actualDose >= 0,
          `[Session ${sessionIdx} Round ${round} Player ${pid}] Dosage ${actualDose} must be non-negative`
        );
        stats.totalInvariantsChecked++;

        // Track decontamination execution
        if (wasScheduledDecon) {
          stats.totalDecontaminationsExecuted++;
          lastDecontaminatedInRound[pid] = round;
        }

        // INVARIANT 8: Lethal Threshold and Casualties
        if (expectedFinalDose >= lethalThreshold && !preMorningCasualties.has(pid)) {
          assert.ok(
            chResult.newCasualtyPlayerIds.includes(pid),
            `[Session ${sessionIdx} Round ${round} Player ${pid}] Must be in newCasualtyPlayerIds (dose=${expectedFinalDose} >= ${lethalThreshold})`
          );
          assert.ok(
            chernobylState.radiationCasualties.includes(pid),
            `[Session ${sessionIdx} Round ${round} Player ${pid}] Must be recorded in radiationCasualties`
          );
          const deathRec = chResult.radiationDeaths.find(d => d.victimPlayerId === pid);
          assert.ok(deathRec, `Death record for ${pid} must exist`);
          assert.strictEqual(
            deathRec.cause,
            'RADIATION_SICKNESS',
            `Death record cause must strictly be 'RADIATION_SICKNESS'`
          );
          stats.totalCasualtiesRecorded++;
          stats.totalInvariantsChecked += 4;

          // Update player session alive status to reflect route.ts behavior
          players[pid] = { ...players[pid], isAlive: false };
        } else if (expectedFinalDose < lethalThreshold) {
          assert.ok(
            !chResult.newCasualtyPlayerIds.includes(pid),
            `[Session ${sessionIdx} Round ${round} Player ${pid}] Sub-lethal dose must not be casualty`
          );
          stats.totalInvariantsChecked++;
        }
      }

      // Update inMemoryLobbyStore with morning output
      inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
        ...l,
        players: { ...players },
        minigameSubStates: morningDispatch.updatedSubStates,
        roundNumber: round + 1,
      }));

      stats.totalRoundCyclesCompleted++;
    }
  }

  console.log('  ✔ Monte Carlo Simulation completed with 100% invariant adherence.');
  console.log('  📊 Simulation Statistics:');
  console.log(`     - Total Round Cycles Completed: ${stats.totalRoundCyclesCompleted}`);
  console.log(`     - Total Day Transitions Tested: ${stats.totalDayTransitionsTested}`);
  console.log(`     - Total Morning Transitions Tested: ${stats.totalMorningTransitionsTested}`);
  console.log(`     - Total Invariant Checks Verified: ${stats.totalInvariantsChecked}`);
  console.log(`     - Total Decontaminations Requested & Executed: ${stats.totalDecontaminationsExecuted}`);
  console.log(`     - Total Consecutive Unscheduled Rounds Verified: ${stats.totalUnscheduledRoundsVerified}`);
  console.log(`     - Total Bunker Overflow Attempts Prevented: ${stats.totalBunkerOverflowsRejected}`);
  console.log(`     - Total Lethal Casualties Handled: ${stats.totalCasualtiesRecorded}`);

  assert.ok(
    stats.totalRoundCyclesCompleted >= 500,
    `Must execute at least 500 round cycles (executed: ${stats.totalRoundCyclesCompleted})`
  );
}

// ============================================================================
// SUITE 4: BOUNDARY & ADVERSARIAL STRESS EDGE CASES
// ============================================================================

function testSuite4BoundaryAndAdversarialEdgeCases(): void {
  console.log('--- [Suite 4] Boundary & Adversarial Stress Edge Cases ---');

  // Test 4.1: Bunker capacity 0 (complete shelter failure)
  {
    console.log('▶ Test 4.1: Bunker capacity 0 exposes all players to radiation');
    const playerIds = ['p1', 'p2', 'p3'];
    const players: Record<string, PlayerSession> = {};
    for (const id of playerIds) {
      players[id] = makePlayer({ id, username: id });
    }

    const state = createInitialChernobylState(playerIds, {
      bunkerCapacity: 0,
      initialContamination: 25,
    });

    const res = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['p1', 'p2'], // players attempt to shelter in 0-capacity bunker
    }, players);

    assert.strictEqual(res.updatedState.shelteredPlayerIds.length, 0);
    assert.strictEqual(res.updatedState.radiationDosage['p1'], 25);
    assert.strictEqual(res.updatedState.radiationDosage['p2'], 25);
    assert.strictEqual(res.updatedState.radiationDosage['p3'], 25);
    console.log('  ✔ Bunker capacity 0 correctly exposed all entrants.');
  }

  // Test 4.2: Dead player requested in decontamination or shelter queue
  {
    console.log('▶ Test 4.2: Dead players in decontamination and shelter requests are safely ignored');
    const playerIds = ['alive1', 'dead1'];
    const players: Record<string, PlayerSession> = {
      alive1: makePlayer({ id: 'alive1', username: 'alive1', isAlive: true }),
      dead1: makePlayer({ id: 'dead1', username: 'dead1', isAlive: false }),
    };

    const state: ChernobylState = {
      radiationDosage: { alive1: 20, dead1: 90 },
      shelteredPlayerIds: [],
      bunkerCapacity: 1,
      zoneContaminationLevel: 20,
      decontaminatedPlayerIds: [],
      radiationCasualties: ['dead1'],
      lethalThreshold: 100,
      liquidatorPlayerId: null,
    };

    const res = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['dead1', 'alive1'], // dead1 attempts to consume shelter
      decontaminatedPlayerIds: ['dead1'],       // dead1 scheduled for decontam
    }, players);

    // dead1 should not be sheltered; alive1 should receive the 1 available bunker slot
    assert.deepStrictEqual(res.updatedState.shelteredPlayerIds, ['alive1']);
    assert.strictEqual(res.updatedState.radiationDosage['alive1'], 20); // took 0 ambient
    assert.strictEqual(res.updatedState.radiationDosage['dead1'], 90); // unchanged
    assert.deepStrictEqual(res.newCasualtyPlayerIds, []);
    console.log('  ✔ Dead players in queues did not consume slots or receive healing.');
  }

  // Test 4.3: Duplicate entries in decontaminatedPlayerIds array
  {
    console.log('▶ Test 4.3: Duplicate entries in decontaminatedPlayerIds deduplicate cleanly');
    const playerIds = ['p1'];
    const players: Record<string, PlayerSession> = {
      p1: makePlayer({ id: 'p1', username: 'p1' }),
    };

    const state: ChernobylState = {
      radiationDosage: { p1: 80 },
      shelteredPlayerIds: ['p1'],
      bunkerCapacity: 1,
      zoneContaminationLevel: 20,
      decontaminatedPlayerIds: [],
      radiationCasualties: [],
      lethalThreshold: 100,
      liquidatorPlayerId: null,
    };

    // p1 entered twice in decontaminatedPlayerIds array
    const res = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['p1'],
      decontaminatedPlayerIds: ['p1', 'p1', 'p1'],
    }, players);

    // Should only be reduced once (-50 mSv), resulting in 80 - 50 = 30 mSv (not 80 - 150 = 0)
    assert.strictEqual(
      res.updatedState.radiationDosage['p1'],
      30,
      'Duplicate decontamination requests must only heal once (80 - 50 = 30 mSv)'
    );
    assert.strictEqual(res.dosageDeltas['p1'], -50);
    console.log('  ✔ Duplicate decontamination entries deduplicated via Set semantics.');
  }

  // Test 4.4: All alive players dead (apocalyptic scenario)
  {
    console.log('▶ Test 4.4: Apocalyptic round with zero alive players');
    const state: ChernobylState = {
      radiationDosage: { p1: 100, p2: 105 },
      shelteredPlayerIds: [],
      bunkerCapacity: 2,
      zoneContaminationLevel: 50,
      decontaminatedPlayerIds: [],
      radiationCasualties: ['p1', 'p2'],
      lethalThreshold: 100,
      liquidatorPlayerId: null,
    };

    const res = processChernobylRound({
      currentState: state,
      alivePlayerIds: [],
    });

    assert.strictEqual(res.newCasualtyPlayerIds.length, 0);
    assert.strictEqual(res.updatedState.zoneContaminationLevel, 65);
    console.log('  ✔ Zero-alive player round completed gracefully without errors.');
  }

  // Test 4.5: Combined Decontamination Healing and Lethal Boundary Survival
  {
    console.log('▶ Test 4.5: Decontamination saves player from lethal threshold within same round');
    const playerIds = ['p1'];
    const players: Record<string, PlayerSession> = {
      p1: makePlayer({ id: 'p1', username: 'p1' }),
    };

    // Player at 85 mSv, ambient is 30 mSv (without decontam: 85 + 30 = 115 mSv -> DIES)
    // With decontam: 85 - 50 + 30 = 65 mSv -> SURVIVES
    const state: ChernobylState = {
      radiationDosage: { p1: 85 },
      shelteredPlayerIds: [],
      bunkerCapacity: 0,
      zoneContaminationLevel: 30,
      decontaminatedPlayerIds: [],
      radiationCasualties: [],
      lethalThreshold: 100,
      liquidatorPlayerId: null,
    };

    const res = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: [],
      decontaminatedPlayerIds: ['p1'],
    }, players);

    assert.strictEqual(res.updatedState.radiationDosage['p1'], 65);
    assert.strictEqual(res.dosageDeltas['p1'], -20); // net -20
    assert.strictEqual(res.newCasualtyPlayerIds.length, 0, 'Player survives thanks to decontamination');
    assert.strictEqual(res.radiationDeaths.length, 0);
    console.log('  ✔ Same-round decontamination healing prevented lethal casualty.');
  }
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function runAllMultiRoundStressTests(): Promise<void> {
  console.log('================================================================');
  console.log('STARTING CHERNOBYL MULTI-ROUND & PHASE-GATING EMPIRICAL HARNESS');
  console.log('================================================================\n');

  testSuite1PhaseGatingInvariants();
  console.log('');
  testSuite2DecontaminationNonRecurrence();
  console.log('');
  testSuite3MonteCarloSimulationHarness();
  console.log('');
  testSuite4BoundaryAndAdversarialEdgeCases();

  console.log('\n================================================================');
  console.log('🎉 ALL MULTI-ROUND CHERNOBYL & PHASE GATING INVARIANTS VERIFIED 100%');
  console.log('================================================================');
}

runAllMultiRoundStressTests().catch((err) => {
  console.error('❌ Multi-Round Stress Suite Failed with Error:', err);
  process.exit(1);
});
