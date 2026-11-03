/**
 * Empirical Adversarial Challenger Suite: Chernobyl Invariants & Decontamination Lifecycle
 * Author: challenger_m3_4 (Milestone 3 Invariant Challenger)
 *
 * Verifies:
 * 1. Strict empty array invariant on updatedState.decontaminatedPlayerIds across all paths
 * 2. Exact mathematical delta: dosageDelta === updatedDosage - previousDosage
 * 3. Exact deduction accounting: actualDeduction === Math.min(previousDosage, 50)
 * 4. Zero double-counting under duplicate IDs, multi-round progression, and route enqueuing
 * 5. Full Phase Gating matrix across all lobby phases
 * 6. 10,000-iteration Monte Carlo Stress Fuzzing harness
 */

import assert from 'node:assert';
import {
  processChernobylRound,
  applyChernobylShelter,
  applyChernobylDecontamination,
  dispatchMinigamePhaseEvent,
} from '../src/server/engine/minigames-engine';
import { createInitialChernobylState } from '../src/config/minigames.config';
import { inMemoryLobbyStore } from '../src/server/state/memory';
import { ChernobylState, PlayerSession } from '../src/types/game';

function createMockPlayer(id: string, name: string, isAlive = true): PlayerSession {
  return {
    socketId: `sock-${id}`,
    userId: id,
    username: name,
    tier: 'TIER_1',
    adminRole: 'NONE',
    isHost: false,
    isAlive,
    hasHostWaiver: false,
    hasAdminWaiver: false,
    displayRole: {
      userId: id,
      username: name,
      roleName: 'Citizen',
      localizedRoleName: 'Vətəndaş',
      faction: 'TOWN',
      color: '#10B981',
      description: 'Mock',
    },
    allInIdentity: {
      layer1Faction: 'TOWN',
      layer2Office: 'CITY_INVESTIGATOR',
      layer3Trait: 'CONTRABAND_POCKET',
      district: 'COMMERCIAL',
    },
    currentDistrict: 'COMMERCIAL',
    disconnectedAt: null,
    isAiBotControlled: false,
  };
}

console.log('🧪 Starting Empirical Adversarial Challenger Suite: Chernobyl Lifecycle Invariants...\n');

// ============================================================================
// SUITE 1: Strict Empty Invariant for decontaminatedPlayerIds
// ============================================================================
console.log('▶ Suite 1: Strict Empty Invariant (updatedState.decontaminatedPlayerIds === [])');
{
  const players: Record<string, PlayerSession> = {
    p1: createMockPlayer('p1', 'Player 1'),
    p2: createMockPlayer('p2', 'Player 2'),
    p3: createMockPlayer('p3', 'Player 3'),
  };

  const baseState: ChernobylState = {
    radiationDosage: { p1: 50, p2: 50, p3: 50 },
    shelteredPlayerIds: [],
    bunkerCapacity: 2,
    zoneContaminationLevel: 20,
    decontaminatedPlayerIds: ['p1', 'p2', 'p3', 'lingering_ghost'], // tainted initial state
    radiationCasualties: [],
    lethalThreshold: 100,
    liquidatorPlayerId: 'p1',
  };

  // Case 1.1: Explicit decontaminations provided
  const out1 = processChernobylRound({
    currentState: baseState,
    decontaminatedPlayerIds: ['p1', 'p2'],
  }, players);
  assert.deepStrictEqual(out1.updatedState.decontaminatedPlayerIds, [], 'Must reset to empty array when decontaminations provided');

  // Case 1.2: input.decontaminatedPlayerIds is undefined / omitted
  const out2 = processChernobylRound({
    currentState: baseState,
  }, players);
  assert.deepStrictEqual(out2.updatedState.decontaminatedPlayerIds, [], 'Must reset to empty array when input.decontaminatedPlayerIds omitted');

  // Case 1.3: input.decontaminatedPlayerIds is empty array
  const out3 = processChernobylRound({
    currentState: baseState,
    decontaminatedPlayerIds: [],
  }, players);
  assert.deepStrictEqual(out3.updatedState.decontaminatedPlayerIds, [], 'Must reset to empty array when empty array passed');

  // Case 1.4: input.decontaminatedPlayerIds contains dead / non-existent IDs
  const out4 = processChernobylRound({
    currentState: baseState,
    decontaminatedPlayerIds: ['dead1', 'ghost', 'unknown'],
  }, players);
  assert.deepStrictEqual(out4.updatedState.decontaminatedPlayerIds, [], 'Must reset to empty array when invalid IDs passed');

  console.log('  ✔ Suite 1 Passed: decontaminatedPlayerIds strictly empty [] under all input variations.');
}

// ============================================================================
// SUITE 2: Mathematical Radiation Delta Exactness & Non-Double-Counting
// ============================================================================
console.log('▶ Suite 2: Mathematical Radiation Delta Exactness & Deduction Accounting');
{
  const playerIds = ['p_zero', 'p_partial', 'p_exact', 'p_over', 'p_lethal'];
  const players: Record<string, PlayerSession> = {};
  for (const id of playerIds) {
    players[id] = createMockPlayer(id, id);
  }

  // Test different baseline dosage values
  const initialDosages: Record<string, number> = {
    p_zero: 0,
    p_partial: 30,
    p_exact: 50,
    p_over: 80,
    p_lethal: 120,
  };

  const state: ChernobylState = {
    radiationDosage: { ...initialDosages },
    shelteredPlayerIds: ['p_zero', 'p_partial'], // sheltered: 0 ambient damage
    bunkerCapacity: 2,
    zoneContaminationLevel: 25, // unsheltered take +25 mSv
    decontaminatedPlayerIds: [],
    radiationCasualties: [],
    lethalThreshold: 100,
    liquidatorPlayerId: 'p_exact',
  };

  // Decontaminate ALL 5 players
  const out = processChernobylRound({
    currentState: state,
    shelteredPlayerIds: ['p_zero', 'p_partial'],
    decontaminatedPlayerIds: [...playerIds],
  }, players);

  for (const id of playerIds) {
    const prev = initialDosages[id];
    const updated = out.updatedState.radiationDosage[id];
    const reportedDelta = out.dosageDeltas[id];
    const isSheltered = id === 'p_zero' || id === 'p_partial';

    // 1. Math oracle for deduction
    const expectedDeduction = Math.min(prev, 50);
    const expectedAmbient = isSheltered ? 0 : 25;
    const expectedNewDose = Math.max(0, prev - 50) + expectedAmbient;
    const expectedDelta = updated - prev;

    assert.strictEqual(updated, expectedNewDose, `Player ${id} dosage must equal expected oracle dose`);
    assert.strictEqual(reportedDelta, expectedDelta, `Player ${id} reportedDelta must match updated - prev`);
    assert.strictEqual(reportedDelta, expectedAmbient - expectedDeduction, `Player ${id} reportedDelta must match ambient - deduction`);
  }

  console.log('  ✔ Suite 2 Passed: Mathematical deltas and deductions match oracle with 100% precision.');
}

// ============================================================================
// SUITE 3: Adversarial Double-Counting Stress Scenarios
// ============================================================================
console.log('▶ Suite 3: Adversarial Double-Counting Stress Scenarios');
{
  const players: Record<string, PlayerSession> = {
    p1: createMockPlayer('p1', 'Player 1'),
    p2: createMockPlayer('p2', 'Player 2'),
  };

  const state: ChernobylState = {
    radiationDosage: { p1: 100, p2: 100 },
    shelteredPlayerIds: ['p1', 'p2'],
    bunkerCapacity: 2,
    zoneContaminationLevel: 20,
    decontaminatedPlayerIds: [],
    radiationCasualties: [],
    lethalThreshold: 100,
    liquidatorPlayerId: 'p1',
  };

  // 3.1: Heavy duplicate bombardment in single round
  const duplicateBombardment = processChernobylRound({
    currentState: state,
    shelteredPlayerIds: ['p1', 'p2'],
    decontaminatedPlayerIds: ['p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1', 'p1'],
  }, players);

  // Even with 8 duplicate submissions, p1 must only be healed 50 mSv ONCE (100 -> 50, NOT 100 -> 0)
  assert.strictEqual(
    duplicateBombardment.updatedState.radiationDosage['p1'],
    50,
    'Duplicate bombardment must not heal more than single 50 mSv reduction'
  );
  assert.strictEqual(duplicateBombardment.dosageDeltas['p1'], -50, 'Delta must strictly be -50 mSv');

  // 3.2: Multi-Round consecutive persistence stress
  // Round 1: p1 treated (-50 mSv)
  const r1 = processChernobylRound({
    currentState: state,
    shelteredPlayerIds: ['p1', 'p2'],
    decontaminatedPlayerIds: ['p1'],
  }, players);
  assert.strictEqual(r1.updatedState.radiationDosage['p1'], 50);

  // Round 2: No treatment specified, p1 is unsheltered
  const r2 = processChernobylRound({
    currentState: r1.updatedState,
    shelteredPlayerIds: ['p2'], // only p2 sheltered
  }, players);
  // Zone contamination in r1 was 20 -> increments to 35 for r2
  // p1 was 50 mSv -> takes +35 mSv ambient = 85 mSv. Must NOT take any phantom -50 mSv.
  assert.strictEqual(
    r2.updatedState.radiationDosage['p1'],
    85,
    'Round 2 must take full ambient 35 mSv without phantom healing'
  );
  assert.strictEqual(r2.dosageDeltas['p1'], 35, 'Round 2 delta must strictly be +35 mSv');
  assert.deepStrictEqual(r2.updatedState.decontaminatedPlayerIds, [], 'Queue must remain empty in Round 2');

  // Round 3: No treatment specified, p1 sheltered
  const r3 = processChernobylRound({
    currentState: r2.updatedState,
    shelteredPlayerIds: ['p1'],
  }, players);
  assert.strictEqual(r3.updatedState.radiationDosage['p1'], 85, 'Round 3 sheltered dose must remain exactly 85 mSv');
  assert.strictEqual(r3.dosageDeltas['p1'], 0, 'Round 3 sheltered delta must be exactly 0 mSv');

  console.log('  ✔ Suite 3 Passed: Zero double-counting across duplicate arrays and sequential rounds.');
}

// ============================================================================
// SUITE 4: Lobby Store & Phase-Gating Matrix
// ============================================================================
console.log('▶ Suite 4: Lobby Store & Phase-Gating Invariants');
{
  const lobbyId = 'test-phase-matrix-lobby';
  const host = createMockPlayer('host', 'Host');
  inMemoryLobbyStore.createLobby(lobbyId, 'Host', host, 'STANDARD');

  const initialState: ChernobylState = {
    radiationDosage: { host: 60 },
    shelteredPlayerIds: [],
    bunkerCapacity: 2,
    zoneContaminationLevel: 20,
    decontaminatedPlayerIds: ['host'], // enqueued treatment
    radiationCasualties: [],
    lethalThreshold: 100,
    liquidatorPlayerId: 'host',
  };

  const nonMorningPhases = [
    'DAY_VOTING',
    'TRIAL_DEFENSE',
    'ROLE_REVEAL',
    'NIGHT_START',
    'MAFIA_CHAT',
    'GAME_OVER',
  ];

  for (const phase of nonMorningPhases) {
    inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
      ...l,
      mode: 'CHERNOBYL_EXCLUSION_ZONE',
      phase: phase as any,
      minigameSubStates: { chernobyl: { ...initialState } },
    }));

    const result = dispatchMinigamePhaseEvent({
      lobbyId,
      isMorningArrival: false,
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
    });

    assert.strictEqual(result.chernobylResult, null, `Chernobyl must NOT tick during phase ${phase}`);
    assert.strictEqual(
      result.updatedSubStates.chernobyl?.zoneContaminationLevel,
      20,
      `Contamination level must NOT increment during phase ${phase}`
    );
    assert.strictEqual(
      result.updatedSubStates.chernobyl?.radiationDosage['host'],
      60,
      `Dosage must NOT change during phase ${phase}`
    );
  }

  // Morning phase transition: MUST execute and clear decontaminatedPlayerIds
  inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
    ...l,
    mode: 'CHERNOBYL_EXCLUSION_ZONE',
    phase: 'NIGHT_BUFFER',
    minigameSubStates: { chernobyl: { ...initialState } },
  }));

  const morningResult = dispatchMinigamePhaseEvent({
    lobbyId,
    isMorningArrival: true,
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
  });

  assert.notStrictEqual(morningResult.chernobylResult, null, 'Chernobyl MUST tick at morning arrival');
  assert.deepStrictEqual(
    morningResult.updatedSubStates.chernobyl?.decontaminatedPlayerIds,
    [],
    'decontaminatedPlayerIds must be reset to [] at morning arrival'
  );
  assert.strictEqual(
    morningResult.updatedSubStates.chernobyl?.zoneContaminationLevel,
    35,
    'Zone contamination level must increment by +15 mSv'
  );
  // Host unsheltered: 60 - 50 (decontam) + 20 (ambient) = 30 mSv
  assert.strictEqual(
    morningResult.updatedSubStates.chernobyl?.radiationDosage['host'],
    30,
    'Host dose must be 60 - 50 + 20 = 30 mSv'
  );

  console.log('  ✔ Suite 4 Passed: Full phase gating matrix and lobby store dispatch verified.');
}

// ============================================================================
// SUITE 5: 10,000-Iteration Monte Carlo Invariant Stress Fuzzer
// ============================================================================
console.log('▶ Suite 5: Monte Carlo Invariant Stress Fuzzer (10,000 Iterations)...');
{
  const ITERATIONS = 10000;
  let totalEvaluations = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const playerCount = Math.floor(Math.random() * 8) + 3; // 3 to 10 players
    const allIds = Array.from({ length: playerCount }, (_, idx) => `fuzz_p${idx}`);
    const aliveMask = allIds.map(() => Math.random() > 0.15); // ~85% alive
    const aliveIds = allIds.filter((_, idx) => aliveMask[idx]);
    if (aliveIds.length === 0) continue;

    const players: Record<string, PlayerSession> = {};
    const initialDosages: Record<string, number> = {};
    for (let j = 0; j < allIds.length; j++) {
      const id = allIds[j];
      players[id] = createMockPlayer(id, id, aliveMask[j]);
      initialDosages[id] = Math.floor(Math.random() * 150); // 0 to 149 mSv
    }

    const bunkerCapacity = Math.floor(Math.random() * 5); // 0 to 4
    const zoneContamination = Math.floor(Math.random() * 50) + 10; // 10 to 59 mSv

    // Random shelter applicants (may contain dead, duplicates, excess)
    const shelterApplicants = Array.from(
      { length: Math.floor(Math.random() * 12) },
      () => allIds[Math.floor(Math.random() * allIds.length)]
    );

    // Random decontaminations (may contain dead, duplicates)
    const decontamApplicants = Array.from(
      { length: Math.floor(Math.random() * 8) },
      () => allIds[Math.floor(Math.random() * allIds.length)]
    );

    const currentState: ChernobylState = {
      radiationDosage: { ...initialDosages },
      shelteredPlayerIds: [],
      bunkerCapacity,
      zoneContaminationLevel: zoneContamination,
      decontaminatedPlayerIds: ['lingering_prev_round'],
      radiationCasualties: [],
      lethalThreshold: 100,
      liquidatorPlayerId: allIds[0],
    };

    const out = processChernobylRound({
      currentState,
      shelteredPlayerIds: shelterApplicants,
      decontaminatedPlayerIds: decontamApplicants,
    }, players);

    // Invariant A: decontaminatedPlayerIds strictly empty []
    assert.deepStrictEqual(
      out.updatedState.decontaminatedPlayerIds,
      [],
      `Iteration ${i}: decontaminatedPlayerIds must be strictly empty []`
    );

    // Invariant B: Bunker capacity constraint
    assert(
      out.updatedState.shelteredPlayerIds.length <= bunkerCapacity,
      `Iteration ${i}: sheltered count must not exceed capacity`
    );

    const shelteredSet = new Set(out.updatedState.shelteredPlayerIds);
    const decontamSet = new Set(decontamApplicants.filter(id => aliveIds.includes(id)));

    // Invariant C: Mathematical delta exactness for every alive player
    for (const id of aliveIds) {
      const prevDose = initialDosages[id];
      const updatedDose = out.updatedState.radiationDosage[id];
      const delta = out.dosageDeltas[id];

      // Delta must equal difference
      assert.strictEqual(
        delta,
        updatedDose - prevDose,
        `Iteration ${i}: delta must strictly match updated - prev for player ${id}`
      );

      // Dose cannot be negative
      assert(updatedDose >= 0, `Iteration ${i}: dosage cannot be negative for player ${id}`);

      // Oracle verification
      const isDecontaminated = decontamSet.has(id);
      const isSheltered = shelteredSet.has(id);

      const expectedDeduction = isDecontaminated ? Math.min(prevDose, 50) : 0;
      const expectedAmbient = isSheltered ? 0 : zoneContamination;
      const expectedDose = (isDecontaminated ? Math.max(0, prevDose - 50) : prevDose) + expectedAmbient;

      assert.strictEqual(
        updatedDose,
        expectedDose,
        `Iteration ${i}: updatedDose must match oracle calculation for player ${id}`
      );

      // Lethal casualty invariant
      if (updatedDose >= 100) {
        assert(
          out.updatedState.radiationCasualties.includes(id),
          `Iteration ${i}: player ${id} with dose ${updatedDose} must be casualty`
        );
      }

      totalEvaluations++;
    }
  }

  console.log(`  ✔ Suite 5 Passed: 10,000 iterations completed with ${totalEvaluations} individual evaluations. Zero failures.`);
}

console.log('\n🎉 ALL ADVERSARIAL CHALLENGER INVARIANT TESTS PASSED WITH 100% SUCCESS!');
