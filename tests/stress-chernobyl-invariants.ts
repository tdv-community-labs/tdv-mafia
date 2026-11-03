/**
 * Empirical Stress Harness & Invariant Challenge Suite: Chernobyl Exclusion Zone & Solitary Voting
 *
 * Authored by: challenger_m3_2 (Milestone 3 Invariant Challenger)
 * Scope:
 *   Invariant 1: Bunker capacity constraint (no more than bunkerCapacity alive players receive 0 damage).
 *   Invariant 2: Unsheltered alive players always receive ambient dosage.
 *   Invariant 3: Decontamination never causes dosage < 0.
 *   Invariant 4: Lethal threshold (>=100 mSv) strictly yields casualty records with cause 'RADIATION_SICKNESS'.
 *   Invariant 5: Solitary inmates cannot contribute to vote tallies or majority outcomes.
 *   Suite 6: Monte Carlo Property-Based Fuzzing Harness (1,000 randomized state scenarios).
 */

import assert from 'node:assert';
import {
  processChernobylRound,
  applyChernobylShelter,
  applyChernobylDecontamination,
  dispatchMinigamePhaseEvent,
  executePrisonSanction,
  executePrisonSolitary,
  applyPrisonSanction,
  applyPrisonSolitary,
  processStanfordPrisonRound,
} from '../src/server/engine/minigames-engine';
import {
  createInitialChernobylState,
  createInitialStanfordPrisonState,
  CHERNOBYL_DEFAULTS,
} from '../src/config/minigames.config';
import {
  runVotingEngine,
  determineVerdictOutcome,
  castVerdictVote,
  getVoterWeight,
  executeMayorReveal,
} from '../src/server/engine/voting-engine';
import { inMemoryLobbyStore } from '../src/server/state/memory';
import {
  ChernobylState,
  StanfordPrisonState,
  MinigameSubStates,
} from '../src/types/minigames';
import {
  LobbyState,
  PlayerSession,
  GamePhase,
} from '../src/types/game';
import {
  CoreFaction,
  CivicOfficeType,
  InnateTraitType,
  AllInDistrict,
  formatRoleDisplay,
} from '../src/types/roles';

// ─── Helpers & Fixtures ───────────────────────────────────────────────────────

function makePlayer(opts: {
  id: string;
  username: string;
  roleName: string;
  localizedRoleName?: string;
  faction?: CoreFaction;
  office?: CivicOfficeType;
  trait?: InnateTraitType;
  district?: AllInDistrict;
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
      opts.roleName,
      opts.localizedRoleName ?? opts.roleName
    ),
    allInIdentity: {
      layer1Faction: opts.faction ?? 'TOWN',
      layer2Office: opts.office ?? 'PUBLIC_DEFENDER',
      layer3Trait: opts.trait ?? 'CONTRABAND_POCKET',
      district: opts.district ?? 'COMMERCIAL',
    },
    currentDistrict: opts.district ?? 'COMMERCIAL',
    disconnectedAt: null,
    isAiBotControlled: false,
  };
}

function makeLobby(
  lobbyId: string,
  players: Record<string, PlayerSession>,
  opts?: {
    mode?: 'BLITZ' | 'ALL_IN' | 'STANFORD_PRISON' | 'CHERNOBYL_EXCLUSION_ZONE';
    phase?: GamePhase;
    liveVotes?: Record<string, string>;
    trialVerdictVotes?: Record<string, 'GUILTY' | 'INNOCENT'>;
    accusedPlayerId?: string | null;
    mayorRevealedUserIds?: readonly string[];
    chernobyl?: ChernobylState;
    stanfordPrison?: StanfordPrisonState;
    roundNumber?: number;
  }
): LobbyState {
  const hostId = Object.keys(players)[0] ?? 'p1';
  return {
    lobbyId,
    hostUserId: hostId,
    mode: opts?.mode ?? 'CHERNOBYL_EXCLUSION_ZONE',
    phase: opts?.phase ?? 'DAY_VOTING',
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
    phaseDurationSeconds: opts?.phase === 'TRIAL_DEFENSE' ? 30 : 60,
    phaseTimeRemaining: opts?.phase === 'TRIAL_DEFENSE' ? 30 : 60,
    nightJitterDelaySeconds: 4,
    liveVotes: opts?.liveVotes ?? {},
    trialVerdictVotes: opts?.trialVerdictVotes ?? {},
    accusedPlayerId: opts?.accusedPlayerId ?? null,
    mayorRevealedUserIds: opts?.mayorRevealedUserIds ?? [],
    speakerQueue: [],
    bufferedNightActions: [],
    minigameSubStates: {
      chernobyl: opts?.chernobyl,
      stanfordPrison: opts?.stanfordPrison,
    },
    roundNumber: opts?.roundNumber ?? 1,
    lastLynchedUserId: null,
    globalNightKillCap: 5,
    chatMessages: [],
  };
}

// Pseudo-Random Number Generator (xorshift32) for deterministic, reproducible property testing
class DeterministicRNG {
  private state: number;
  constructor(seed: number = 133742) {
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
  shuffle<T>(arr: readonly T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}

// ============================================================================
// SUITE 1: INVARIANT 1 — BUNKER CAPACITY CONSTRAINT
// "No more than bunkerCapacity alive players receive 0 damage."
// ============================================================================

function testSuite1BunkerCapacityConstraint(): void {
  console.log('--- [Suite 1] Invariant 1: Bunker Capacity Constraint ---');

  // Test 1.1: 5 alive players request shelter with bunkerCapacity = 2
  {
    console.log('▶ Test 1.1: 5 alive players request shelter with bunkerCapacity = 2 -> Exactly 2 sheltered');
    const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5'];
    const players: Record<string, PlayerSession> = {};
    for (const id of playerIds) {
      players[id] = makePlayer({ id, username: id, roleName: 'Citizen' });
    }

    const state = createInitialChernobylState(playerIds, {
      bunkerCapacity: 2,
      initialContamination: 25,
      lethalThreshold: 100,
    });

    const output = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
    }, players);

    // Exactly 2 players must be in updated shelteredPlayerIds
    assert.strictEqual(
      output.updatedState.shelteredPlayerIds.length,
      2,
      'Effective sheltered count must strictly equal bunkerCapacity (2)'
    );

    // Count alive players who received 0 environmental dosage
    const zeroDamageAlive = playerIds.filter(
      id => output.updatedState.radiationDosage[id] === 0
    );
    assert.strictEqual(
      zeroDamageAlive.length,
      2,
      'Exactly bunkerCapacity (2) alive players receive 0 damage'
    );
    assert.ok(
      zeroDamageAlive.length <= state.bunkerCapacity,
      'Invariant 1 violated: more than bunkerCapacity alive players received 0 damage'
    );

    // Unsheltered players take full ambient contamination (25 mSv)
    assert.strictEqual(output.updatedState.radiationDosage['p1'], 0);
    assert.strictEqual(output.updatedState.radiationDosage['p2'], 0);
    assert.strictEqual(output.updatedState.radiationDosage['p3'], 25);
    assert.strictEqual(output.updatedState.radiationDosage['p4'], 25);
    assert.strictEqual(output.updatedState.radiationDosage['p5'], 25);
    console.log('  ✔ Test 1.1 Passed: Capacity 2 strictly honored among 5 applicants');
  }

  // Test 1.2: Zero bunker capacity (bunkerCapacity = 0)
  {
    console.log('▶ Test 1.2: Zero bunker capacity (bunkerCapacity = 0) -> 0 players sheltered');
    const playerIds = ['p1', 'p2', 'p3'];
    const players: Record<string, PlayerSession> = {};
    for (const id of playerIds) {
      players[id] = makePlayer({ id, username: id, roleName: 'Citizen' });
    }

    const state = createInitialChernobylState(playerIds, {
      bunkerCapacity: 0,
      initialContamination: 20,
    });

    const output = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['p1', 'p2', 'p3'],
    }, players);

    assert.strictEqual(output.updatedState.shelteredPlayerIds.length, 0);
    const zeroDamageAlive = playerIds.filter(
      id => output.updatedState.radiationDosage[id] === 0
    );
    assert.strictEqual(zeroDamageAlive.length, 0, 'No alive player receives 0 damage when capacity is 0');
    assert.ok(zeroDamageAlive.length <= 0);
    for (const id of playerIds) {
      assert.strictEqual(output.updatedState.radiationDosage[id], 20);
    }
    console.log('  ✔ Test 1.2 Passed: Zero capacity bunker rejects all sheltering');
  }

  // Test 1.3: Dead players in shelter request list do NOT consume capacity
  {
    console.log('▶ Test 1.3: Dead players in shelter request list do NOT usurp bunker slots');
    const playerIds = ['alive1', 'alive2', 'alive3', 'dead1', 'dead2'];
    const players: Record<string, PlayerSession> = {
      alive1: makePlayer({ id: 'alive1', username: 'alive1', roleName: 'Citizen', isAlive: true }),
      alive2: makePlayer({ id: 'alive2', username: 'alive2', roleName: 'Citizen', isAlive: true }),
      alive3: makePlayer({ id: 'alive3', username: 'alive3', roleName: 'Citizen', isAlive: true }),
      dead1: makePlayer({ id: 'dead1', username: 'dead1', roleName: 'Citizen', isAlive: false }),
      dead2: makePlayer({ id: 'dead2', username: 'dead2', roleName: 'Citizen', isAlive: false }),
    };

    const state = createInitialChernobylState(playerIds, {
      bunkerCapacity: 2,
      initialContamination: 15,
    });

    // Shelter list places dead players first
    const output = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['dead1', 'dead2', 'alive1', 'alive2', 'alive3'],
    }, players);

    // Dead players must be filtered out, allowing alive1 and alive2 into the 2 slots
    assert.deepStrictEqual(
      [...output.updatedState.shelteredPlayerIds].sort(),
      ['alive1', 'alive2'].sort(),
      'Dead players must be pruned so valid living players obtain bunker slots'
    );
    assert.strictEqual(output.updatedState.radiationDosage['alive1'], 0);
    assert.strictEqual(output.updatedState.radiationDosage['alive2'], 0);
    assert.strictEqual(output.updatedState.radiationDosage['alive3'], 15);
    console.log('  ✔ Test 1.3 Passed: Dead player filtration preserves bunker slots for alive players');
  }

  // Test 1.4: Duplicate entries in shelter request list cannot bypass capacity
  {
    console.log('▶ Test 1.4: Duplicate entries in shelter request list cannot bypass capacity');
    const playerIds = ['p1', 'p2', 'p3'];
    const players: Record<string, PlayerSession> = {};
    for (const id of playerIds) {
      players[id] = makePlayer({ id, username: id, roleName: 'Citizen' });
    }

    const state = createInitialChernobylState(playerIds, {
      bunkerCapacity: 2,
      initialContamination: 30,
    });

    // Duplicate 'p1' multiple times in request
    const output = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['p1', 'p1', 'p1', 'p2', 'p3'],
    }, players);

    // Even if duplicates are in slice, shelteredSet has unique players <= bunkerCapacity
    const uniqueSheltered = new Set(output.updatedState.shelteredPlayerIds);
    assert.ok(
      uniqueSheltered.size <= state.bunkerCapacity,
      'Distinct sheltered alive players must not exceed bunkerCapacity'
    );
    console.log('  ✔ Test 1.4 Passed: Duplicates in shelter request safely contained');
  }

  // Test 1.5: Helper applyChernobylShelter boundary enforcement
  {
    console.log('▶ Test 1.5: applyChernobylShelter helper rejects entrance when bunker full');
    const state = createInitialChernobylState(['p1', 'p2', 'p3'], 1);

    const step1 = applyChernobylShelter(state, 'p1');
    assert.strictEqual(step1.success, true);
    assert.deepStrictEqual(step1.updatedState.shelteredPlayerIds, ['p1']);

    // Attempting to add second player to capacity 1 bunker
    const step2 = applyChernobylShelter(step1.updatedState, 'p2');
    assert.strictEqual(step2.success, false);
    assert.strictEqual(step2.error, 'BUNKER_CAPACITY_EXCEEDED');
    assert.deepStrictEqual(step2.updatedState.shelteredPlayerIds, ['p1']);

    // Player 1 leaves bunker
    const step3 = applyChernobylShelter(step2.updatedState, 'p1', true);
    assert.strictEqual(step3.success, true);
    assert.deepStrictEqual(step3.updatedState.shelteredPlayerIds, []);

    // Player 2 can now enter vacated bunker
    const step4 = applyChernobylShelter(step3.updatedState, 'p2');
    assert.strictEqual(step4.success, true);
    assert.deepStrictEqual(step4.updatedState.shelteredPlayerIds, ['p2']);
    console.log('  ✔ Test 1.5 Passed: Helper transitions enforce capacity boundaries strictly');
  }
}

// ============================================================================
// SUITE 2: INVARIANT 2 — UNSHELTERED ALIVE PLAYERS ALWAYS RECEIVE AMBIENT DOSAGE
// ============================================================================

function testSuite2UnshelteredAccrual(): void {
  console.log('--- [Suite 2] Invariant 2: Unsheltered Accrual Invariant ---');

  // Test 2.1: Multi-round ambient zone contamination progression
  {
    console.log('▶ Test 2.1: Ambient zone contamination accrual & per-round rate increment (+15 mSv)');
    const playerIds = ['sheltered', 'exposed1', 'exposed2'];
    const players: Record<string, PlayerSession> = {};
    for (const id of playerIds) {
      players[id] = makePlayer({ id, username: id, roleName: 'Citizen' });
    }

    let state = createInitialChernobylState(playerIds, {
      bunkerCapacity: 1,
      initialContamination: 15,
      lethalThreshold: 100,
    });

    // Round 1: Ambient contamination = 15 mSv
    const round1 = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['sheltered'],
    }, players);

    assert.strictEqual(round1.updatedState.radiationDosage['sheltered'], 0, 'Sheltered receives 0 mSv');
    assert.strictEqual(round1.updatedState.radiationDosage['exposed1'], 15, 'Exposed receives 15 mSv');
    assert.strictEqual(round1.updatedState.radiationDosage['exposed2'], 15, 'Exposed receives 15 mSv');
    assert.strictEqual(round1.currentZoneContamination, 30, 'Next round contamination = 15 + 15 = 30 mSv');
    assert.strictEqual(round1.dosageDeltas['exposed1'], 15);
    state = round1.updatedState;

    // Round 2: Ambient contamination = 30 mSv
    const round2 = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['sheltered'],
    }, players);

    assert.strictEqual(round2.updatedState.radiationDosage['sheltered'], 0);
    assert.strictEqual(round2.updatedState.radiationDosage['exposed1'], 45, '15 + 30 = 45 mSv');
    assert.strictEqual(round2.updatedState.radiationDosage['exposed2'], 45, '15 + 30 = 45 mSv');
    assert.strictEqual(round2.currentZoneContamination, 45, 'Next round contamination = 30 + 15 = 45 mSv');
    assert.strictEqual(round2.dosageDeltas['exposed1'], 30);
    state = round2.updatedState;

    // Round 3: Swap shelter: exposed1 enters shelter; sheltered exits
    const round3 = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['exposed1'],
    }, players);

    assert.strictEqual(round3.updatedState.radiationDosage['exposed1'], 45, 'Now sheltered: stays at 45 mSv');
    assert.strictEqual(round3.updatedState.radiationDosage['sheltered'], 45, 'Now exposed: accrued 45 mSv in round 3');
    assert.strictEqual(round3.updatedState.radiationDosage['exposed2'], 90, '45 + 45 = 90 mSv');
    console.log('  ✔ Test 2.1 Passed: Multi-round progression correctly applies ambient dosage to unsheltered');
  }

  // Test 2.2: Dead players never accrue radiation dosage
  {
    console.log('▶ Test 2.2: Dead players do not accrue dosage or alter existing records');
    const players: Record<string, PlayerSession> = {
      alive: makePlayer({ id: 'alive', username: 'alive', roleName: 'Citizen', isAlive: true }),
      dead: makePlayer({ id: 'dead', username: 'dead', roleName: 'Citizen', isAlive: false }),
    };

    const state: ChernobylState = {
      radiationDosage: { alive: 20, dead: 60 },
      shelteredPlayerIds: [],
      bunkerCapacity: 1,
      zoneContaminationLevel: 25,
      decontaminatedPlayerIds: [],
      radiationCasualties: [],
      lethalThreshold: 100,
      liquidatorPlayerId: null,
    };

    const output = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: [],
    }, players);

    assert.strictEqual(output.updatedState.radiationDosage['alive'], 45, 'Alive unsheltered takes 20 + 25 = 45 mSv');
    assert.strictEqual(output.updatedState.radiationDosage['dead'], 60, 'Dead player dosage remains unchanged at 60 mSv');
    assert.strictEqual(output.dosageDeltas['dead'], undefined, 'No delta recorded for dead player');
    console.log('  ✔ Test 2.2 Passed: Dead players quarantined from ambient dosage');
  }
}

// ============================================================================
// SUITE 3: INVARIANT 3 — DECONTAMINATION NEVER CAUSES DOSAGE < 0
// ============================================================================

function testSuite3DecontaminationClamping(): void {
  console.log('--- [Suite 3] Invariant 3: Decontamination Non-Negativity Invariant ---');

  // Test 3.1: Zero initial dosage decontaminated
  {
    console.log('▶ Test 3.1: Zero initial dosage (0 mSv) decontaminated -> Strictly 0 mSv');
    const players: Record<string, PlayerSession> = {
      patient: makePlayer({ id: 'patient', username: 'patient', roleName: 'Citizen' }),
    };

    const state = createInitialChernobylState(['patient'], {
      initialContamination: 20,
    });
    assert.strictEqual(state.radiationDosage['patient'], 0);

    // Decontaminate sheltered patient (no ambient radiation to isolate healing)
    const output = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['patient'],
      decontaminatedPlayerIds: ['patient'],
    }, players);

    assert.strictEqual(
      output.updatedState.radiationDosage['patient'],
      0,
      'Dosage must clamp to 0, never negative'
    );
    assert.ok(output.updatedState.radiationDosage['patient'] >= 0);
    console.log('  ✔ Test 3.1 Passed: 0 mSv - 50 mSv clamps strictly to 0');
  }

  // Test 3.2: Partial dosages (10 mSv, 25 mSv, 49 mSv) decontaminated
  {
    console.log('▶ Test 3.2: Partial dosages (10, 25, 49 mSv) clamp cleanly to 0 mSv');
    const testCases = [1, 10, 25, 49];
    for (const initialDose of testCases) {
      const state: ChernobylState = {
        radiationDosage: { p: initialDose },
        shelteredPlayerIds: ['p'],
        bunkerCapacity: 2,
        zoneContaminationLevel: 15,
        decontaminatedPlayerIds: [],
        radiationCasualties: [],
        lethalThreshold: 100,
        liquidatorPlayerId: null,
      };

      const res = processChernobylRound({
        currentState: state,
        shelteredPlayerIds: ['p'],
        decontaminatedPlayerIds: ['p'],
      });

      assert.strictEqual(
        res.updatedState.radiationDosage['p'],
        0,
        `Initial dose ${initialDose} - 50 must clamp to 0`
      );
    }
    console.log('  ✔ Test 3.2 Passed: All sub-50 dosages clamp to 0');
  }

  // Test 3.3: Consecutive multi-round decontamination stress
  {
    console.log('▶ Test 3.3: 5 consecutive decontaminations on same player never yield negative dose');
    let state: ChernobylState = {
      radiationDosage: { target: 30 },
      shelteredPlayerIds: ['target'],
      bunkerCapacity: 1,
      zoneContaminationLevel: 15,
      decontaminatedPlayerIds: [],
      radiationCasualties: [],
      lethalThreshold: 100,
      liquidatorPlayerId: null,
    };

    for (let round = 1; round <= 5; round++) {
      const res = processChernobylRound({
        currentState: state,
        shelteredPlayerIds: ['target'],
        decontaminatedPlayerIds: ['target'],
      });
      assert.ok(
        res.updatedState.radiationDosage['target'] >= 0,
        `Round ${round}: dosage was negative: ${res.updatedState.radiationDosage['target']}`
      );
      assert.strictEqual(res.updatedState.radiationDosage['target'], 0);
      state = res.updatedState;
    }
    console.log('  ✔ Test 3.3 Passed: Repeated decontamination invariant holds');
  }

  // Test 3.4: Helper applyChernobylDecontamination with extreme reduction parameter
  {
    console.log('▶ Test 3.4: applyChernobylDecontamination helper with extreme reduction (99,999 mSv)');
    const state: ChernobylState = {
      radiationDosage: { victim: 15 },
      shelteredPlayerIds: [],
      bunkerCapacity: 1,
      zoneContaminationLevel: 15,
      decontaminatedPlayerIds: [],
      radiationCasualties: [],
      lethalThreshold: 100,
      liquidatorPlayerId: null,
    };

    const res = applyChernobylDecontamination(state, 'victim', 99999);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.updatedState.radiationDosage['victim'], 0);
    assert.ok(res.updatedState.radiationDosage['victim'] >= 0);
    console.log('  ✔ Test 3.4 Passed: Extreme reduction parameter clamps at 0');
  }
}

// ============================================================================
// SUITE 4: INVARIANT 4 — LETHAL THRESHOLD & 'RADIATION_SICKNESS' CASUALTY RECORD
// ============================================================================

function testSuite4LethalThresholdCasualties(): void {
  console.log('--- [Suite 4] Invariant 4: Lethal Threshold & Casualty Records ---');

  // Test 4.1: Sub-lethal boundary (99 mSv) vs Exact lethal boundary (100 mSv)
  {
    console.log('▶ Test 4.1: Sub-lethal (99 mSv) survives; Exact boundary (100 mSv) eliminates');
    const state: ChernobylState = {
      radiationDosage: {
        survivor: 79, // +20 = 99 mSv (< 100)
        casualty: 80, // +20 = 100 mSv (>= 100)
      },
      shelteredPlayerIds: [],
      bunkerCapacity: 0,
      zoneContaminationLevel: 20,
      decontaminatedPlayerIds: [],
      radiationCasualties: [],
      lethalThreshold: 100,
      liquidatorPlayerId: null,
    };

    const res = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: [],
    });

    assert.strictEqual(res.updatedState.radiationDosage['survivor'], 99);
    assert.strictEqual(res.updatedState.radiationDosage['casualty'], 100);

    // Only casualty is eliminated
    assert.deepStrictEqual(res.newCasualtyPlayerIds, ['casualty']);
    assert.deepStrictEqual(res.updatedState.radiationCasualties, ['casualty']);

    // Casualty death record verification
    assert.strictEqual(res.radiationDeaths.length, 1);
    const death = res.radiationDeaths[0];
    assert.strictEqual(death.victimPlayerId, 'casualty');
    assert.strictEqual(death.cause, 'RADIATION_SICKNESS', 'Death cause MUST be RADIATION_SICKNESS');
    assert.strictEqual(death.killerFaction, null, 'Radiation killerFaction must be null');
    assert.strictEqual(death.isCleaned, false, 'Radiation sickness is not cleaned');
    console.log('  ✔ Test 4.1 Passed: 99 mSv survives; 100 mSv eliminated with RADIATION_SICKNESS');
  }

  // Test 4.2: Casualty non-recurrence (Idempotency) in subsequent rounds
  {
    console.log('▶ Test 4.2: Casualty non-recurrence across multi-round progression');
    const state: ChernobylState = {
      radiationDosage: { victim: 100 },
      shelteredPlayerIds: [],
      bunkerCapacity: 0,
      zoneContaminationLevel: 15,
      decontaminatedPlayerIds: [],
      radiationCasualties: ['victim'], // Already recognized as casualty
      lethalThreshold: 100,
      liquidatorPlayerId: null,
    };

    const res = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: [],
    });

    // In subsequent round, victim must NOT be re-emitted in newCasualtyPlayerIds or radiationDeaths
    assert.strictEqual(res.newCasualtyPlayerIds.length, 0, 'No duplicate casualty announcement');
    assert.strictEqual(res.radiationDeaths.length, 0, 'No duplicate death records emitted');
    assert.deepStrictEqual(res.updatedState.radiationCasualties, ['victim']);
    console.log('  ✔ Test 4.2 Passed: Eliminated casualties never re-emit casualty records');
  }

  // Test 4.3: Simultaneous multi-casualty elimination
  {
    console.log('▶ Test 4.3: Simultaneous multi-casualty resolution (4 players hit >=100 mSv at once)');
    const state: ChernobylState = {
      radiationDosage: {
        p1: 90, // +30 = 120
        p2: 85, // +30 = 115
        p3: 75, // +30 = 105
        p4: 70, // +30 = 100
        safe: 30, // +30 = 60
      },
      shelteredPlayerIds: [],
      bunkerCapacity: 0,
      zoneContaminationLevel: 30,
      decontaminatedPlayerIds: [],
      radiationCasualties: [],
      lethalThreshold: 100,
      liquidatorPlayerId: null,
    };

    const res = processChernobylRound({ currentState: state });

    assert.strictEqual(res.newCasualtyPlayerIds.length, 4);
    assert.deepStrictEqual(res.newCasualtyPlayerIds.sort(), ['p1', 'p2', 'p3', 'p4'].sort());
    assert.strictEqual(res.radiationDeaths.length, 4);
    for (const death of res.radiationDeaths) {
      assert.strictEqual(death.cause, 'RADIATION_SICKNESS');
      assert.strictEqual(death.killerFaction, null);
    }
    console.log('  ✔ Test 4.3 Passed: Simultaneous multi-casualty records verified');
  }
}

// ============================================================================
// SUITE 5: INVARIANT 5 — SOLITARY INMATES VOTING DISENFRANCHISEMENT
// ============================================================================

function testSuite5SolitaryDisenfranchisement(): void {
  console.log('--- [Suite 5] Invariant 5: Solitary Voting Disenfranchisement ---');

  // Test 5.1: Solitary inmate cannot contribute vote count or weight in standard day voting
  {
    console.log('▶ Test 5.1: Solitary inmate vote stripped from candidate tally in runVotingEngine');
    const players: Record<string, PlayerSession> = {
      guard1: makePlayer({ id: 'guard1', username: 'Guard_Alpha', roleName: 'Guard' }),
      inmateFree: makePlayer({ id: 'inmateFree', username: 'Inmate_Free', roleName: 'Inmate' }),
      inmateSolitary: makePlayer({ id: 'inmateSolitary', username: 'Inmate_Solitary', roleName: 'Inmate' }),
      targetA: makePlayer({ id: 'targetA', username: 'Target_A', roleName: 'Inmate' }),
      targetB: makePlayer({ id: 'targetB', username: 'Target_B', roleName: 'Inmate' }),
    };

    const stanford: StanfordPrisonState = {
      guardPlayerIds: ['guard1'],
      inmatePlayerIds: ['inmateFree', 'inmateSolitary', 'targetA', 'targetB'],
      revoltMeter: 20,
      wardenPlayerId: 'guard1',
      secretAssassinInmateId: null,
      solitaryConfinementPlayerIds: ['inmateSolitary'],
      riotTriggered: false,
      guardSanctionsRemaining: 3,
    };

    const lobby = makeLobby('prison-lobby', players, {
      mode: 'STANFORD_PRISON',
      phase: 'DAY_VOTING',
      stanfordPrison: stanford,
      liveVotes: {
        guard1: 'targetA',
        inmateFree: 'targetB',
        inmateSolitary: 'targetB', // Solitary inmate attempts to vote for targetB
      },
    });

    const engineOut = runVotingEngine({ lobby });

    // Target B tally should ONLY have 1 vote (from inmateFree); inmateSolitary vote must be absent
    const tallyB = engineOut.tallies.find(t => t.candidateId === 'targetB');
    assert.ok(tallyB, 'Tally for targetB must exist');
    assert.strictEqual(tallyB.voteCount, 1, 'Solitary inmate vote count must be 0');
    assert.strictEqual(tallyB.voteWeight, 1, 'Solitary inmate vote weight must be 0');
    assert.deepStrictEqual(tallyB.voterIds, ['inmateFree'], 'voterIds must exclude solitary inmate');
    assert.ok(!tallyB.voterIds.includes('inmateSolitary'), 'Solitary inmate must NOT appear in voterIds');

    // Target A has 1 vote from guard1
    const tallyA = engineOut.tallies.find(t => t.candidateId === 'targetA');
    assert.strictEqual(tallyA?.voteCount, 1);

    // Result should be TIE (1 vote vs 1 vote), NOT a lynch for Target B!
    // If solitary vote counted, Target B would have 2 votes vs 1 and be lynched!
    assert.strictEqual(engineOut.outcome.kind, 'TIE', 'Solitary inmate must not manufacture a majority outcome');
    console.log('  ✔ Test 5.1 Passed: Solitary vote stripped; prevented illegal majority lynch');
  }

  // Test 5.2: Solitary inmate who is revealed Mayor (3x weight) has all 3x weight nullified
  {
    console.log('▶ Test 5.2: Revealed Mayor in solitary confinement contributes 0x weight');
    const players: Record<string, PlayerSession> = {
      mayorInSolitary: makePlayer({
        id: 'mayorInSolitary',
        username: 'CorruptMayor',
        roleName: 'Mayor',
        localizedRoleName: 'Bələdiyyə Sədri',
        office: 'MAYOR',
      }),
      voter1: makePlayer({ id: 'voter1', username: 'Voter1', roleName: 'Citizen' }),
      suspect: makePlayer({ id: 'suspect', username: 'Suspect', roleName: 'Citizen' }),
    };

    const stanford: StanfordPrisonState = {
      guardPlayerIds: ['guard1'],
      inmatePlayerIds: ['mayorInSolitary', 'voter1', 'suspect'],
      revoltMeter: 20,
      wardenPlayerId: 'guard1',
      secretAssassinInmateId: null,
      solitaryConfinementPlayerIds: ['mayorInSolitary'],
      riotTriggered: false,
      guardSanctionsRemaining: 3,
    };

    const lobby = makeLobby('mayor-prison-lobby', players, {
      mode: 'STANFORD_PRISON',
      phase: 'DAY_VOTING',
      stanfordPrison: stanford,
      mayorRevealedUserIds: ['mayorInSolitary'], // Revealed Mayor
      liveVotes: {
        mayorInSolitary: 'suspect', // 3x weight vote attempted
      },
    });

    const engineOut = runVotingEngine({ lobby });
    const suspectTally = engineOut.tallies.find(t => t.candidateId === 'suspect');

    assert.strictEqual(suspectTally?.voteCount, 0, 'Mayor in solitary cannot contribute vote count');
    assert.strictEqual(suspectTally?.voteWeight, 0, 'Mayor in solitary cannot contribute 3x weight');
    assert.strictEqual(engineOut.outcome.kind, 'NO_LYNCH');
    console.log('  ✔ Test 5.2 Passed: 3x Mayor voting weight strictly nullified in solitary');
  }

  // Test 5.3: Solitary inmate cannot influence two-tier trial verdict voting (determineVerdictOutcome)
  {
    console.log('▶ Test 5.3: Solitary inmate cannot alter trial verdict outcome (GUILTY / INNOCENT)');
    const players: Record<string, PlayerSession> = {
      accused: makePlayer({ id: 'accused', username: 'AccusedPerson', roleName: 'Citizen' }),
      jurorHonest: makePlayer({ id: 'jurorHonest', username: 'JurorHonest', roleName: 'Citizen' }),
      solitaryInmate1: makePlayer({ id: 'solitaryInmate1', username: 'Solitary1', roleName: 'Inmate' }),
      solitaryInmate2: makePlayer({ id: 'solitaryInmate2', username: 'Solitary2', roleName: 'Inmate' }),
    };

    const stanford: StanfordPrisonState = {
      guardPlayerIds: ['guard1'],
      inmatePlayerIds: ['solitaryInmate1', 'solitaryInmate2'],
      revoltMeter: 10,
      wardenPlayerId: 'guard1',
      secretAssassinInmateId: null,
      solitaryConfinementPlayerIds: ['solitaryInmate1', 'solitaryInmate2'],
      riotTriggered: false,
      guardSanctionsRemaining: 3,
    };

    // Honest juror votes INNOCENT; 2 solitary inmates vote GUILTY
    // If solitary votes counted: GUILTY 2 > INNOCENT 1 -> CONVICTION
    // Because solitary votes stripped: GUILTY 0 < INNOCENT 1 -> ACQUITTAL
    const lobby = makeLobby('verdict-lobby', players, {
      mode: 'STANFORD_PRISON',
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'accused',
      stanfordPrison: stanford,
      trialVerdictVotes: {
        jurorHonest: 'INNOCENT',
        solitaryInmate1: 'GUILTY',
        solitaryInmate2: 'GUILTY',
      },
    });

    const verdictOut = determineVerdictOutcome(lobby);

    assert.strictEqual(verdictOut.guiltyWeight, 0, 'Guilty weight must be 0 from solitary voters');
    assert.strictEqual(verdictOut.guiltyCount, 0, 'Guilty count must be 0 from solitary voters');
    assert.strictEqual(verdictOut.innocentWeight, 1, 'Innocent weight is 1 from honest juror');
    assert.strictEqual(verdictOut.innocentCount, 1);
    assert.strictEqual(verdictOut.verdict, 'INNOCENT', 'Accused must be acquitted; solitary votes rejected');
    assert.strictEqual(verdictOut.convictedPlayerId, null);
    console.log('  ✔ Test 5.3 Passed: Solitary verdict votes ignored; illegal conviction prevented');
  }

  // Test 5.4: executePrisonSolitary actively purges in-flight votes
  {
    console.log('▶ Test 5.4: executePrisonSolitary immediately purges active votes in flight');
    const players: Record<string, PlayerSession> = {
      guard: makePlayer({ id: 'guard', username: 'Guard', roleName: 'Guard' }),
      inmate: makePlayer({ id: 'inmate', username: 'Inmate', roleName: 'Inmate' }),
      victim: makePlayer({ id: 'victim', username: 'Victim', roleName: 'Citizen' }),
    };

    const stanford: StanfordPrisonState = {
      guardPlayerIds: ['guard'],
      inmatePlayerIds: ['inmate'],
      revoltMeter: 25,
      wardenPlayerId: 'guard',
      secretAssassinInmateId: null,
      solitaryConfinementPlayerIds: [],
      riotTriggered: false,
      guardSanctionsRemaining: 3,
    };

    const lobby = makeLobby('purge-lobby', players, {
      mode: 'STANFORD_PRISON',
      phase: 'DAY_VOTING',
      stanfordPrison: stanford,
      liveVotes: {
        inmate: 'victim', // In-flight vote
      },
      trialVerdictVotes: {
        inmate: 'GUILTY', // In-flight verdict vote
      },
    });

    const res = executePrisonSolitary(lobby, 'guard', 'inmate');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.updatedLobby.liveVotes['inmate'], undefined, 'In-flight live vote purged');
    assert.strictEqual(res.updatedLobby.trialVerdictVotes['inmate'], undefined, 'In-flight verdict vote purged');
    assert.deepStrictEqual(
      res.updatedLobby.minigameSubStates.stanfordPrison?.solitaryConfinementPlayerIds,
      ['inmate']
    );
    console.log('  ✔ Test 5.4 Passed: In-flight votes successfully purged upon solitary execution');
  }
}

// ============================================================================
// SUITE 6: MONTE CARLO PROPERTY-BASED FUZZING HARNESS (1,000 SCENARIOS)
// ============================================================================

function testSuite6MonteCarloPropertyHarness(): void {
  console.log('--- [Suite 6] Monte Carlo Property-Based Fuzzing Harness (1,000 Scenarios) ---');

  const rng = new DeterministicRNG(421337);
  const ITERATIONS = 1000;

  let totalAlivePlayersChecked = 0;
  let totalBunkerInvariantsChecked = 0;
  let totalDeconInvariantsChecked = 0;
  let totalLethalInvariantsChecked = 0;
  let totalSolitaryInvariantsChecked = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const playerCount = rng.nextInt(4, 16);
    const playerIds: string[] = [];
    const players: Record<string, PlayerSession> = {};

    for (let p = 0; p < playerCount; p++) {
      const pid = `u_${p}`;
      playerIds.push(pid);
      const isAlive = rng.next() > 0.15; // 85% alive
      players[pid] = makePlayer({
        id: pid,
        username: `Player_${p}`,
        roleName: p % 2 === 0 ? 'Citizen' : 'Inmate',
        isAlive,
      });
    }

    const aliveIds = playerIds.filter(id => players[id].isAlive);
    if (aliveIds.length === 0) continue;

    // Random initial state configuration
    const bunkerCapacity = rng.nextInt(0, 5);
    const initialContamination = rng.nextInt(10, 40);
    const lethalThreshold = rng.nextInt(80, 120);

    const initialDosages: Record<string, number> = {};
    for (const pid of playerIds) {
      initialDosages[pid] = rng.nextInt(0, 110);
    }

    // Existing casualties
    const existingCasualties = playerIds.filter(
      id => initialDosages[id] >= lethalThreshold && !players[id].isAlive
    );

    // Random shelter requests (may contain duplicates, dead players, and excess applicants)
    const shuffledForShelter = rng.shuffle(playerIds);
    const shelterRequestCount = rng.nextInt(0, playerCount);
    const requestedSheltered = shuffledForShelter.slice(0, shelterRequestCount);
    // Occasionally inject duplicate
    if (requestedSheltered.length > 0 && rng.next() > 0.5) {
      requestedSheltered.push(requestedSheltered[0]);
    }

    // Random decontamination requests
    const shuffledForDecon = rng.shuffle(aliveIds);
    const deconCount = rng.nextInt(0, Math.min(3, aliveIds.length));
    const requestedDecon = shuffledForDecon.slice(0, deconCount);

    const state: ChernobylState = {
      radiationDosage: initialDosages,
      shelteredPlayerIds: [],
      bunkerCapacity,
      zoneContaminationLevel: initialContamination,
      decontaminatedPlayerIds: [],
      radiationCasualties: existingCasualties,
      lethalThreshold,
      liquidatorPlayerId: null,
    };

    // Execute round tick
    const output = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: requestedSheltered,
      decontaminatedPlayerIds: requestedDecon,
    }, players);

    // ──────────────────────────────────────────────────────────────────────────
    // Invariant 1 Verification: Bunker Capacity Constraint
    // No more than bunkerCapacity alive players receive 0 damage (unless already 0 and decontaminated)
    // ──────────────────────────────────────────────────────────────────────────
    const effectiveSheltered = output.updatedState.shelteredPlayerIds;
    assert.ok(
      effectiveSheltered.length <= bunkerCapacity,
      `[Iter ${i}] Effective sheltered count (${effectiveSheltered.length}) exceeds bunkerCapacity (${bunkerCapacity})`
    );
    const shelteredSet = new Set(effectiveSheltered);
    for (const sId of effectiveSheltered) {
      assert.ok(
        players[sId]?.isAlive,
        `[Iter ${i}] Sheltered player ${sId} was dead; dead players must not consume bunker slots`
      );
    }
    totalBunkerInvariantsChecked++;

    // ──────────────────────────────────────────────────────────────────────────
    // Invariant 2 Verification: Unsheltered Alive Players Always Receive Ambient Dosage
    // ──────────────────────────────────────────────────────────────────────────
    for (const pid of aliveIds) {
      totalAlivePlayersChecked++;
      const isSheltered = shelteredSet.has(pid);
      const isDecon = requestedDecon.includes(pid);
      const initialDose = initialDosages[pid] ?? 0;
      const finalDose = output.updatedState.radiationDosage[pid];

      if (!isSheltered) {
        // Unsheltered player must have ambient contamination factored into their final dose
        if (!isDecon) {
          assert.strictEqual(
            finalDose,
            initialDose + initialContamination,
            `[Iter ${i}] Unsheltered non-decontaminated player ${pid} did not receive ambient contamination`
          );
        } else {
          const expected = Math.max(0, initialDose - 50) + initialContamination;
          assert.strictEqual(
            finalDose,
            expected,
            `[Iter ${i}] Unsheltered decontaminated player ${pid} math mismatch`
          );
        }
      } else {
        // Sheltered player receives 0 ambient contamination
        if (!isDecon) {
          assert.strictEqual(
            finalDose,
            initialDose,
            `[Iter ${i}] Sheltered player ${pid} accrued unexpected damage`
          );
        } else {
          assert.strictEqual(
            finalDose,
            Math.max(0, initialDose - 50),
            `[Iter ${i}] Sheltered decontaminated player ${pid} math mismatch`
          );
        }
      }

      // ────────────────────────────────────────────────────────────────────────
      // Invariant 3 Verification: Decontamination Never Causes Dosage < 0
      // ────────────────────────────────────────────────────────────────────────
      assert.ok(
        finalDose >= 0,
        `[Iter ${i}] Player ${pid} radiation dosage became negative: ${finalDose}`
      );
    }
    totalDeconInvariantsChecked++;

    // ──────────────────────────────────────────────────────────────────────────
    // Invariant 4 Verification: Lethal Threshold & Casualty Records
    // ──────────────────────────────────────────────────────────────────────────
    for (const pid of aliveIds) {
      const finalDose = output.updatedState.radiationDosage[pid];
      const isExistingCasualty = existingCasualties.includes(pid);

      if (finalDose >= lethalThreshold && !isExistingCasualty) {
        // Must be in newCasualtyPlayerIds
        assert.ok(
          output.newCasualtyPlayerIds.includes(pid),
          `[Iter ${i}] Player ${pid} dose ${finalDose} >= ${lethalThreshold} but missing from newCasualtyPlayerIds`
        );
        // Must be in updatedState.radiationCasualties
        assert.ok(
          output.updatedState.radiationCasualties.includes(pid),
          `[Iter ${i}] Player ${pid} missing from updatedState.radiationCasualties`
        );
        // Must have casualty record with 'RADIATION_SICKNESS'
        const deathRec = output.radiationDeaths.find(d => d.victimPlayerId === pid);
        assert.ok(deathRec, `[Iter ${i}] Missing death record for casualty ${pid}`);
        assert.strictEqual(deathRec.cause, 'RADIATION_SICKNESS');
        assert.strictEqual(deathRec.killerFaction, null);
      } else if (finalDose < lethalThreshold) {
        assert.ok(
          !output.newCasualtyPlayerIds.includes(pid),
          `[Iter ${i}] Sub-lethal player ${pid} (dose ${finalDose}) incorrectly recorded as casualty`
        );
      }
    }
    totalLethalInvariantsChecked++;

    // ──────────────────────────────────────────────────────────────────────────
    // Invariant 5 Verification: Solitary Disenfranchisement in Voting Engine
    // ──────────────────────────────────────────────────────────────────────────
    if (aliveIds.length >= 3) {
      // Pick 1 or 2 solitary inmates
      const solitaryCandidateIds = aliveIds.slice(0, rng.nextInt(1, 2));
      const freeAliveIds = aliveIds.filter(id => !solitaryCandidateIds.includes(id));
      const targetCandidate = rng.pick(aliveIds);

      // Construct live votes where solitary inmates vote for targetCandidate
      const liveVotes: Record<string, string> = {};
      for (const sId of solitaryCandidateIds) {
        liveVotes[sId] = targetCandidate;
      }
      // Free voters vote for someone else or target
      for (const fId of freeAliveIds) {
        liveVotes[fId] = rng.pick(aliveIds);
      }

      const stanford: StanfordPrisonState = {
        guardPlayerIds: [aliveIds[0]],
        inmatePlayerIds: aliveIds.slice(1),
        revoltMeter: 20,
        wardenPlayerId: aliveIds[0],
        secretAssassinInmateId: null,
        solitaryConfinementPlayerIds: solitaryCandidateIds,
        riotTriggered: false,
        guardSanctionsRemaining: 3,
      };

      const votingLobby = makeLobby(`fuzz-vote-${i}`, players, {
        mode: 'STANFORD_PRISON',
        phase: 'DAY_VOTING',
        stanfordPrison: stanford,
        liveVotes,
      });

      const voteOutput = runVotingEngine({ lobby: votingLobby });

      // Invariant: None of the solitary inmates can appear in any candidate's voterIds
      for (const tally of voteOutput.tallies) {
        for (const sId of solitaryCandidateIds) {
          assert.ok(
            !tally.voterIds.includes(sId),
            `[Iter ${i}] Solitary inmate ${sId} found in tally voterIds for candidate ${tally.candidateId}`
          );
        }
      }

      // Check verdict voting too
      const verdictVotes: Record<string, 'GUILTY' | 'INNOCENT'> = {};
      for (const sId of solitaryCandidateIds) {
        verdictVotes[sId] = 'GUILTY';
      }
      const verdictLobby = makeLobby(`fuzz-verdict-${i}`, players, {
        mode: 'STANFORD_PRISON',
        phase: 'TRIAL_DEFENSE',
        accusedPlayerId: freeAliveIds[0] ?? aliveIds[0],
        stanfordPrison: stanford,
        trialVerdictVotes: verdictVotes,
      });

      const verdictOut = determineVerdictOutcome(verdictLobby);
      assert.strictEqual(
        verdictOut.guiltyCount,
        0,
        `[Iter ${i}] Solitary verdict votes leaked into guiltyCount`
      );
      assert.strictEqual(
        verdictOut.guiltyWeight,
        0,
        `[Iter ${i}] Solitary verdict votes leaked into guiltyWeight`
      );
      totalSolitaryInvariantsChecked++;
    }
  }

  console.log(`  ✔ Checked ${ITERATIONS} randomized property scenarios:`);
  console.log(`    - Bunker capacity constraint evaluations: ${totalBunkerInvariantsChecked}`);
  console.log(`    - Alive player dosage & non-negativity checks: ${totalAlivePlayersChecked}`);
  console.log(`    - Decontamination clamping evaluations: ${totalDeconInvariantsChecked}`);
  console.log(`    - Lethal threshold & casualty validations: ${totalLethalInvariantsChecked}`);
  console.log(`    - Solitary disenfranchisement voting tests: ${totalSolitaryInvariantsChecked}`);
  console.log('  ✔ 1,000 Monte Carlo property fuzzing iterations completed with 100% invariant compliance!');
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

function runAllChernobylInvariantTests(): void {
  console.log('================================================================');
  console.log('STARTING CHERNOBYL & SOLITARY INVARIANT STRESS SUITE (M3-2)');
  console.log('================================================================\n');

  testSuite1BunkerCapacityConstraint();
  testSuite2UnshelteredAccrual();
  testSuite3DecontaminationClamping();
  testSuite4LethalThresholdCasualties();
  testSuite5SolitaryDisenfranchisement();
  testSuite6MonteCarloPropertyHarness();

  console.log('\n================================================================');
  console.log('🎯 ALL 5 INVARIANTS & 1,000 FUZZING ITERATIONS VERIFIED: 100% PASS');
  console.log('================================================================');
}

runAllChernobylInvariantTests();
