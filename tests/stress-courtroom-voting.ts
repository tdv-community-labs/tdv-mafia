/**
 * Empirical Adversarial Stress Test Suite: Milestone 2 (R2) Courtroom Voting Engine & Phase Manager
 * Author: challenger_m2_1 (Milestone 2 Empirical Challenger)
 *
 * MISSION INVARIANTS:
 * 1. No suspect is lynched during DAY_VOTING without a TRIAL_DEFENSE phase when quorum is met.
 * 2. Suspect on the podium remains alive until conviction.
 * 3. Accused is acquitted whenever INNOCENT >= GUILTY.
 * 4. Mayor 3x multiplier accurately weights votes in both nomination and verdict phases.
 * 5. Mayor in solitary confinement never casts a vote or contributes weight.
 *
 * STRESS SPECTRUM:
 * - Jury sizes 3 to 40 players across both Standard/Blitz and All-In game modes.
 * - Split verdicts, full abstentions, deadlock ties, revealed Mayors, and Stanford solitary confinement.
 * - 1,000+ randomized Monte Carlo scenarios exercising property-based verification.
 */

import assert from 'node:assert';
import {
  getVoterWeight,
  runVotingEngine,
  determineVerdictOutcome,
  castVerdictVote,
  executeMayorReveal,
  isMayor,
} from '../src/server/engine/voting-engine';
import {
  nextPhaseAfter,
  computePhaseDuration,
  executePhaseTransition,
  evaluateWinCondition,
} from '../src/server/engine/phase-manager';
import { inMemoryLobbyStore } from '../src/server/state/memory';
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

// ============================================================================
// FIXTURE FACTORIES
// ============================================================================

interface MockPlayerOpts {
  readonly id: string;
  readonly username: string;
  readonly roleName?: string;
  readonly localizedRoleName?: string;
  readonly faction?: CoreFaction;
  readonly office?: CivicOfficeType;
  readonly trait?: InnateTraitType;
  readonly district?: AllInDistrict;
  readonly isAlive?: boolean;
}

function createPlayer(opts: MockPlayerOpts): PlayerSession {
  const role = opts.roleName ?? 'Citizen';
  return {
    socketId: `sock-${opts.id}`,
    userId: opts.id,
    username: opts.username,
    tier: 'TIER_1',
    adminRole: 'NONE',
    isHost: opts.id === 'p1',
    isAlive: opts.isAlive ?? true,
    hasHostWaiver: false,
    hasAdminWaiver: false,
    displayRole: formatRoleDisplay(
      opts.username,
      role,
      opts.localizedRoleName ?? role
    ),
    allInIdentity: {
      layer1Faction: opts.faction ?? 'TOWN',
      layer2Office: opts.office ?? (role.toLowerCase().includes('mayor') ? 'MAYOR' : 'PUBLIC_DEFENDER'),
      layer3Trait: opts.trait ?? 'CONTRABAND_POCKET',
      district: opts.district ?? 'COMMERCIAL',
    },
    currentDistrict: opts.district ?? 'COMMERCIAL',
    disconnectedAt: null,
    isAiBotControlled: false,
  };
}

interface MockLobbyOpts {
  readonly lobbyId?: string;
  readonly mode?: 'BLITZ' | 'ALL_IN' | 'STANFORD_PRISON' | 'DANTES_INFERNO';
  readonly phase?: GamePhase;
  readonly liveVotes?: Record<string, string>;
  readonly trialVerdictVotes?: Record<string, 'GUILTY' | 'INNOCENT'>;
  readonly accusedPlayerId?: string | null;
  readonly mayorRevealedUserIds?: readonly string[];
  readonly solitaryConfinementPlayerIds?: readonly string[];
  readonly wrathNoAbstainEnforced?: boolean;
  readonly roundNumber?: number;
}

function createLobby(
  players: Record<string, PlayerSession>,
  opts?: MockLobbyOpts
): LobbyState {
  const hostId = Object.keys(players)[0] ?? 'p1';
  const lobbyId = opts?.lobbyId ?? `test-lobby-${Math.random().toString(36).slice(2, 8)}`;
  return {
    lobbyId,
    hostUserId: hostId,
    mode: opts?.mode ?? 'BLITZ',
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
      stanfordPrison: opts?.solitaryConfinementPlayerIds
        ? {
            wardenPlayerId: 'warden-1',
            guardPlayerIds: ['guard-1'],
            inmatePlayerIds: ['inmate-1'],
            secretAssassinInmateId: null,
            revoltMeter: 20,
            riotTriggered: false,
            guardSanctionsRemaining: 3,
            solitaryConfinementPlayerIds: [...opts.solitaryConfinementPlayerIds],
          }
        : undefined,
      dantesInferno: opts?.wrathNoAbstainEnforced
        ? {
            currentCircle: 5,
            circleName: 'CIRCLE_5_WRATH',
            circleNumber: 5,
            direction: 'DESCENT',
            wrathNoAbstainEnforced: true,
            greedVoteCostDebts: {},
            disCityGateArmed: false,
            fraudImpostorDisguises: {},
            treacherySecretVotingActive: false,
            luciferShadowWinnerUserId: null,
          }
        : undefined,
    },
    roundNumber: opts?.roundNumber ?? 1,
    lastLynchedUserId: null,
    globalNightKillCap: 5,
    chatMessages: [],
  };
}

// ============================================================================
// SUITE 1: INVARIANT 1 — NO LYNCH IN DAY_VOTING WITHOUT TRIAL_DEFENSE
// ============================================================================

export function testInvariant1_NominationToPodium(): void {
  console.log('\n--- [Invariant 1] No Suspect Lynched During DAY_VOTING Without TRIAL_DEFENSE ---');

  // Test across every jury size from 3 to 40 players
  for (let size = 3; size <= 40; size++) {
    const players: Record<string, PlayerSession> = {};
    for (let i = 1; i <= size; i++) {
      players[`p${i}`] = createPlayer({
        id: `p${i}`,
        username: `Player_${i}`,
        faction: i === 1 ? 'MAFIA' : 'TOWN', // ensure mafia exists so game doesn't end immediately on win condition
      });
    }

    const quorum = Math.floor(size / 2) + 1;
    const targetSuspect = `p${size}`; // pick last player as suspect

    // 1.1 Strict quorum votes for suspect
    const liveVotes: Record<string, string> = {};
    for (let i = 1; i <= quorum; i++) {
      liveVotes[`p${i}`] = targetSuspect;
    }

    const lobby = createLobby(players, { phase: 'DAY_VOTING', liveVotes });
    const output = runVotingEngine({ lobby });

    assert.strictEqual(
      output.outcome.kind,
      'LYNCHED',
      `Size ${size}: Quorum of ${quorum}/${size} votes must trigger indictment`
    );
    assert.strictEqual(
      output.accusedCandidateId,
      targetSuspect,
      `Size ${size}: Accused candidate must be ${targetSuspect}`
    );

    // Assert suspect has NOT been eliminated in voting engine
    assert.strictEqual(
      lobby.players[targetSuspect].isAlive,
      true,
      `Size ${size}: Suspect MUST remain alive during nomination resolution`
    );

    // Assert phase transition target is TRIAL_DEFENSE
    const nextPhase = nextPhaseAfter('DAY_VOTING', lobby);
    assert.strictEqual(
      nextPhase,
      'TRIAL_DEFENSE',
      `Size ${size}: Next phase must be TRIAL_DEFENSE when quorum met`
    );

    // Assert TRIAL_DEFENSE duration is exactly 30s
    const duration = computePhaseDuration('TRIAL_DEFENSE', lobby);
    assert.strictEqual(
      duration.durationSeconds,
      30,
      `Size ${size}: TRIAL_DEFENSE phase duration must be strictly 30s`
    );

    // 1.2 State transition execution in inMemoryLobbyStore
    const lobbyId = `inv1-lobby-${size}`;
    inMemoryLobbyStore.createLobby(lobbyId, 'p1', players['p1'], lobby.mode);
    inMemoryLobbyStore.updateLobby(lobbyId, () => lobby);

    const transitionResult = executePhaseTransition({ lobbyId });
    assert.ok(transitionResult, `Size ${size}: executePhaseTransition must return result`);
    assert.strictEqual(
      transitionResult.toPhase,
      'TRIAL_DEFENSE',
      `Size ${size}: State machine must transition to TRIAL_DEFENSE`
    );

    const updatedLobby = inMemoryLobbyStore.getLobby(lobbyId)!;
    assert.strictEqual(
      updatedLobby.accusedPlayerId,
      targetSuspect,
      `Size ${size}: accusedPlayerId must be recorded on lobby state`
    );
    assert.strictEqual(
      updatedLobby.players[targetSuspect].isAlive,
      true,
      `Size ${size}: accused player MUST be alive on the defense podium`
    );
    assert.strictEqual(
      updatedLobby.lastLynchedUserId,
      null,
      `Size ${size}: lastLynchedUserId must be null before verdict`
    );

    // 1.3 Sub-quorum votes must bypass TRIAL_DEFENSE directly to NIGHT_BUFFER
    const subQuorumVotes: Record<string, string> = {};
    for (let i = 1; i <= quorum - 1; i++) {
      subQuorumVotes[`p${i}`] = targetSuspect;
    }
    const subLobby = createLobby(players, { phase: 'DAY_VOTING', liveVotes: subQuorumVotes });
    const subOutput = runVotingEngine({ lobby: subLobby });
    assert.strictEqual(
      subOutput.outcome.kind,
      'NO_LYNCH',
      `Size ${size}: Sub-quorum (${quorum - 1}/${size}) must yield NO_LYNCH`
    );
    const subNextPhase = nextPhaseAfter('DAY_VOTING', subLobby);
    assert.strictEqual(
      subNextPhase,
      'NIGHT_BUFFER',
      `Size ${size}: Sub-quorum must transition to NIGHT_BUFFER without podium defense`
    );
  }

  console.log('  ✔ Invariant 1 verified for all player sizes 3 to 40 (Quorum, Sub-Quorum, and Podium Transition)');
}

// ============================================================================
// SUITE 2: INVARIANT 2 — SUSPECT REMAINS ALIVE UNTIL CONVICTION
// ============================================================================

export function testInvariant2_PodiumLivenessAndSelfVoteProhibition(): void {
  console.log('\n--- [Invariant 2] Suspect on Podium Remains Alive Until Conviction ---');

  for (let size = 3; size <= 40; size += 5) {
    const players: Record<string, PlayerSession> = {};
    for (let i = 1; i <= size; i++) {
      players[`p${i}`] = createPlayer({
        id: `p${i}`,
        username: `Player_${i}`,
        faction: i === 1 ? 'MAFIA' : 'TOWN',
      });
    }

    const accusedId = `p${size}`;
    const lobby = createLobby(players, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: accusedId,
      trialVerdictVotes: {},
    });

    // 2.1 Accused cannot vote on their own verdict
    const selfVoteRes = castVerdictVote(lobby, accusedId, 'INNOCENT');
    assert.strictEqual(
      selfVoteRes.success,
      false,
      `Size ${size}: Accused must be barred from voting on self`
    );
    assert.strictEqual(
      selfVoteRes.error,
      'ACCUSED_CANNOT_VOTE',
      `Size ${size}: Expected error ACCUSED_CANNOT_VOTE`
    );

    // 2.2 Even if accused's vote is forcibly present in trialVerdictVotes, engine must ignore it
    const taintedLobby: LobbyState = {
      ...lobby,
      trialVerdictVotes: {
        [accusedId]: 'INNOCENT',
        p1: 'GUILTY',
      },
    };
    const outcome = determineVerdictOutcome(taintedLobby);
    assert.strictEqual(
      outcome.innocentCount,
      0,
      `Size ${size}: Accused's injected self-vote must not count`
    );
    assert.strictEqual(
      outcome.innocentWeight,
      0,
      `Size ${size}: Accused's injected self-vote must contribute 0 weight`
    );

    // 2.3 Accused survives until execution of GUILTY verdict transition
    assert.strictEqual(
      lobby.players[accusedId].isAlive,
      true,
      `Size ${size}: Accused must be alive while on podium`
    );

    // 2.4 Transitioning with ACQUITTAL leaves accused alive
    const acquitLobby = createLobby(players, {
      lobbyId: `inv2-acquit-${size}`,
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: accusedId,
      trialVerdictVotes: { p1: 'INNOCENT', p2: 'INNOCENT' },
    });
    inMemoryLobbyStore.createLobby(acquitLobby.lobbyId, 'p1', players['p1'], acquitLobby.mode);
    inMemoryLobbyStore.updateLobby(acquitLobby.lobbyId, () => acquitLobby);

    const acquitTransition = executePhaseTransition({ lobbyId: acquitLobby.lobbyId });
    assert.ok(acquitTransition);
    const postAcquitLobby = inMemoryLobbyStore.getLobby(acquitLobby.lobbyId)!;
    assert.strictEqual(
      postAcquitLobby.players[accusedId].isAlive,
      true,
      `Size ${size}: Acquittal must leave accused alive`
    );
    assert.strictEqual(
      postAcquitLobby.lastLynchedUserId,
      null,
      `Size ${size}: Acquittal must have lastLynchedUserId = null`
    );

    // 2.5 Transitioning with CONVICTION eliminates accused
    const convictLobby = createLobby(players, {
      lobbyId: `inv2-convict-${size}`,
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: accusedId,
      trialVerdictVotes: { p1: 'GUILTY', p2: 'GUILTY' },
    });
    inMemoryLobbyStore.createLobby(convictLobby.lobbyId, 'p1', players['p1'], convictLobby.mode);
    inMemoryLobbyStore.updateLobby(convictLobby.lobbyId, () => convictLobby);

    const convictTransition = executePhaseTransition({ lobbyId: convictLobby.lobbyId });
    assert.ok(convictTransition);
    const postConvictLobby = inMemoryLobbyStore.getLobby(convictLobby.lobbyId)!;
    assert.strictEqual(
      postConvictLobby.players[accusedId].isAlive,
      false,
      `Size ${size}: Conviction must eliminate accused`
    );
    assert.strictEqual(
      postConvictLobby.lastLynchedUserId,
      accusedId,
      `Size ${size}: lastLynchedUserId must record convicted accused`
    );
  }

  console.log('  ✔ Invariant 2 verified: Accused self-vote blocked, liveness preserved through acquittal, killed only on conviction');
}

// ============================================================================
// SUITE 3: INVARIANT 3 — ACQUITTAL WHEN INNOCENT >= GUILTY
// ============================================================================

export function testInvariant3_PresumptionOfInnocence(): void {
  console.log('\n--- [Invariant 3] Accused is Acquitted Whenever INNOCENT >= GUILTY ---');

  const testCases: Array<{
    name: string;
    guiltyCount: number;
    innocentCount: number;
    expectedVerdict: 'INNOCENT' | 'GUILTY';
    wrathMode?: boolean;
  }> = [
    { name: '1 vs 1 Tie', guiltyCount: 1, innocentCount: 1, expectedVerdict: 'INNOCENT' },
    { name: '5 vs 5 Tie', guiltyCount: 5, innocentCount: 5, expectedVerdict: 'INNOCENT' },
    { name: '19 vs 19 Tie', guiltyCount: 19, innocentCount: 19, expectedVerdict: 'INNOCENT' },
    { name: '0 vs 0 Full Abstention', guiltyCount: 0, innocentCount: 0, expectedVerdict: 'INNOCENT' },
    { name: '1 vs 2 Innocent Majority', guiltyCount: 1, innocentCount: 2, expectedVerdict: 'INNOCENT' },
    { name: '0 vs 10 Unanimous Innocent', guiltyCount: 0, innocentCount: 10, expectedVerdict: 'INNOCENT' },
    { name: '10 vs 9 Guilty Edge', guiltyCount: 10, innocentCount: 9, expectedVerdict: 'GUILTY' },
    { name: '1 vs 0 Single Guilty', guiltyCount: 1, innocentCount: 0, expectedVerdict: 'GUILTY' },
    // Dante Wrath Circle exception:
    { name: 'Dante Wrath 5 vs 5 Tie Forces Conviction', guiltyCount: 5, innocentCount: 5, expectedVerdict: 'GUILTY', wrathMode: true },
    { name: 'Dante Wrath 5 vs 6 Innocent Majority still Acquits', guiltyCount: 5, innocentCount: 6, expectedVerdict: 'INNOCENT', wrathMode: true },
  ];

  for (const tc of testCases) {
    const totalVoters = tc.guiltyCount + tc.innocentCount + 1; // + 1 for accused
    const size = Math.max(totalVoters, 5);
    const players: Record<string, PlayerSession> = {};
    for (let i = 1; i <= size; i++) {
      players[`p${i}`] = createPlayer({
        id: `p${i}`,
        username: `Player_${i}`,
        faction: i === 1 ? 'MAFIA' : 'TOWN',
      });
    }

    const accusedId = `p${size}`;
    const trialVerdictVotes: Record<string, 'GUILTY' | 'INNOCENT'> = {};

    let voterIdx = 1;
    for (let g = 0; g < tc.guiltyCount; g++) {
      trialVerdictVotes[`p${voterIdx}`] = 'GUILTY';
      voterIdx++;
    }
    for (let inn = 0; inn < tc.innocentCount; inn++) {
      trialVerdictVotes[`p${voterIdx}`] = 'INNOCENT';
      voterIdx++;
    }

    const lobby = createLobby(players, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: accusedId,
      trialVerdictVotes,
      wrathNoAbstainEnforced: tc.wrathMode,
    });

    const result = determineVerdictOutcome(lobby);
    assert.strictEqual(
      result.verdict,
      tc.expectedVerdict,
      `Case '${tc.name}': Expected verdict ${tc.expectedVerdict}, got ${result.verdict}`
    );

    if (tc.expectedVerdict === 'INNOCENT') {
      assert.strictEqual(result.convictedPlayerId, null, `Case '${tc.name}': convictedPlayerId must be null`);
      assert.strictEqual(result.outcome.kind, 'NO_LYNCH', `Case '${tc.name}': outcome.kind must be NO_LYNCH`);
      // Accused awarded mastery_flawless_defense_speech
      assert.ok(
        result.achievementsJustUnlocked?.[accusedId]?.includes('mastery_flawless_defense_speech'),
        `Case '${tc.name}': Accused should unlock defense speech achievement on acquittal`
      );
    } else {
      assert.strictEqual(result.convictedPlayerId, accusedId, `Case '${tc.name}': convictedPlayerId must be accused`);
      assert.strictEqual(result.outcome.kind, 'LYNCHED', `Case '${tc.name}': outcome.kind must be LYNCHED`);
    }
  }

  console.log('  ✔ Invariant 3 verified: Presumption of innocence upheld in all standard ties and splits');
}

// ============================================================================
// SUITE 4: INVARIANT 4 — MAYOR 3x MULTIPLIER ACCURACY
// ============================================================================

export function testInvariant4_Mayor3xMultiplier(): void {
  console.log('\n--- [Invariant 4] Mayor 3x Multiplier in Nomination & Verdict Phases ---');

  // 4.1 Weight calculations
  const mayorStandard = createPlayer({ id: 'm1', username: 'MayorJane', roleName: 'Mayor' });
  const mayorAllIn = createPlayer({ id: 'm2', username: 'MayorAllIn', roleName: 'Mayor', office: 'MAYOR' });
  const citizen = createPlayer({ id: 'c1', username: 'CitizenJohn', roleName: 'Citizen' });

  // Unrevealed weights
  assert.strictEqual(getVoterWeight(mayorStandard, false, []), 1, 'Unrevealed standard Mayor weight = 1');
  assert.strictEqual(getVoterWeight(mayorAllIn, true, []), 3, 'Unrevealed All-In Mayor weight = 1 + 2 = 3');
  assert.strictEqual(getVoterWeight(citizen, false, []), 1, 'Citizen weight = 1');
  assert.strictEqual(getVoterWeight(citizen, true, []), 1, 'Citizen All-In base weight = 1');

  // Revealed weights (3x multiplier applied)
  assert.strictEqual(getVoterWeight(mayorStandard, false, ['m1']), 3, 'Revealed standard Mayor weight = 1 * 3 = 3');
  assert.strictEqual(getVoterWeight(mayorAllIn, true, ['m2']), 9, 'Revealed All-In Mayor weight = 3 * 3 = 9');
  assert.strictEqual(getVoterWeight(citizen, false, ['c1']), 1, 'Non-Mayor does not gain multiplier even if in array');

  // 4.2 Mayor 3x in Nomination Phase (Standard Mode)
  {
    const m = createPlayer({ id: 'm', username: 'Mayor', roleName: 'Mayor' });
    const c1 = createPlayer({ id: 'c1', username: 'Citizen1', roleName: 'Citizen' });
    const c2 = createPlayer({ id: 'c2', username: 'Citizen2', roleName: 'Citizen' });
    const targetA = createPlayer({ id: 'targetA', username: 'SuspectA', roleName: 'Citizen' });
    const targetB = createPlayer({ id: 'targetB', username: 'SuspectB', roleName: 'Citizen' });

    const players = { m, c1, c2, targetA, targetB };

    // Without reveal: m votes targetA (weight 1), c1 and c2 vote targetB (weight 2).
    // Quorum for 5 players is floor(5/2) + 1 = 3. Neither reaches quorum (2 < 3 and 1 < 3) -> NO_LYNCH!
    const unrevealedLobby = createLobby(players, {
      phase: 'DAY_VOTING',
      liveVotes: { m: 'targetA', c1: 'targetB', c2: 'targetB' },
      mayorRevealedUserIds: [],
    });
    const unrevealedOutput = runVotingEngine({ lobby: unrevealedLobby });
    assert.strictEqual(unrevealedOutput.outcome.kind, 'NO_LYNCH', 'Neither candidate reaches quorum 3 without reveal');
    assert.strictEqual(unrevealedOutput.accusedCandidateId, null, 'No accused set when quorum not met');

    // With reveal: m votes targetA (weight 3 >= quorum 3), c1 and c2 vote targetB (weight 2).
    // Mayor's 3x weight satisfies quorum of 3 and indicts targetA!
    const revealedLobby = createLobby(players, {
      phase: 'DAY_VOTING',
      liveVotes: { m: 'targetA', c1: 'targetB', c2: 'targetB' },
      mayorRevealedUserIds: ['m'],
    });
    const revealedOutput = runVotingEngine({ lobby: revealedLobby });
    assert.strictEqual(revealedOutput.accusedCandidateId, 'targetA', 'Revealed Mayor weight 3 satisfies quorum 3 and indicts targetA');
  }

  // 4.3 Mayor 3x in Verdict Phase (Standard Mode)
  {
    const m = createPlayer({ id: 'm', username: 'Mayor', roleName: 'Mayor' });
    const c1 = createPlayer({ id: 'c1', username: 'Citizen1', roleName: 'Citizen' });
    const c2 = createPlayer({ id: 'c2', username: 'Citizen2', roleName: 'Citizen' });
    const accused = createPlayer({ id: 'accused', username: 'Accused', roleName: 'Citizen' });

    const players = { m, c1, c2, accused };

    // Revealed Mayor votes GUILTY (weight 3), 2 citizens vote INNOCENT (weight 2)
    // 3 vs 2 -> GUILTY verdict!
    const lobbyGuilty = createLobby(players, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'accused',
      trialVerdictVotes: { m: 'GUILTY', c1: 'INNOCENT', c2: 'INNOCENT' },
      mayorRevealedUserIds: ['m'],
    });
    const guiltyOutcome = determineVerdictOutcome(lobbyGuilty);
    assert.strictEqual(guiltyOutcome.verdict, 'GUILTY');
    assert.strictEqual(guiltyOutcome.guiltyWeight, 3);
    assert.strictEqual(guiltyOutcome.innocentWeight, 2);
    assert.ok(
      guiltyOutcome.achievementsJustUnlocked?.['m']?.includes('town_mayor_triple_hammer'),
      'Mayor unlocks triple hammer on guilty conviction'
    );

    // Revealed Mayor votes INNOCENT (weight 3), 2 citizens vote GUILTY (weight 2)
    // 2 vs 3 -> INNOCENT verdict!
    const lobbyInnocent = createLobby(players, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'accused',
      trialVerdictVotes: { m: 'INNOCENT', c1: 'GUILTY', c2: 'GUILTY' },
      mayorRevealedUserIds: ['m'],
    });
    const innocentOutcome = determineVerdictOutcome(lobbyInnocent);
    assert.strictEqual(innocentOutcome.verdict, 'INNOCENT');
    assert.strictEqual(innocentOutcome.guiltyWeight, 2);
    assert.strictEqual(innocentOutcome.innocentWeight, 3);
  }

  // 4.4 Mayor 3x in All-In Mode (Weight 9 vs 8 Citizens)
  {
    const m = createPlayer({ id: 'm', username: 'Mayor', roleName: 'Mayor', office: 'MAYOR' });
    const accused = createPlayer({ id: 'accused', username: 'Accused', roleName: 'Citizen' });
    const players: Record<string, PlayerSession> = { m, accused };
    const votes: Record<string, 'GUILTY' | 'INNOCENT'> = { m: 'GUILTY' };

    // 8 citizens vote INNOCENT (weight 1 each = 8)
    for (let i = 1; i <= 8; i++) {
      const cid = `c${i}`;
      players[cid] = createPlayer({ id: cid, username: `Citizen_${i}`, roleName: 'Citizen' });
      votes[cid] = 'INNOCENT';
    }

    const allInLobby = createLobby(players, {
      mode: 'ALL_IN',
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'accused',
      trialVerdictVotes: votes,
      mayorRevealedUserIds: ['m'],
    });

    const outcome = determineVerdictOutcome(allInLobby);
    assert.strictEqual(outcome.guiltyWeight, 9, 'All-In revealed Mayor weight must be 9');
    assert.strictEqual(outcome.innocentWeight, 8, '8 Citizens weight must be 8');
    assert.strictEqual(outcome.verdict, 'GUILTY', 'All-In revealed Mayor (weight 9) convicts against 8 citizens (weight 8)');
  }

  console.log('  ✔ Invariant 4 verified: Mayor 3x multiplier accurately computes to 3 in Standard and 9 in All-In across nomination and verdict');
}

// ============================================================================
// SUITE 5: INVARIANT 5 — MAYOR IN SOLITARY CONFINEMENT DISENFRANCHISED
// ============================================================================

export function testInvariant5_MayorSolitaryDisenfranchisement(): void {
  console.log('\n--- [Invariant 5] Mayor in Solitary Confinement Never Contributes Weight ---');

  const mayor = createPlayer({ id: 'm', username: 'MayorJane', roleName: 'Mayor' });
  const citizen1 = createPlayer({ id: 'c1', username: 'Citizen1', roleName: 'Citizen' });
  const citizen2 = createPlayer({ id: 'c2', username: 'Citizen2', roleName: 'Citizen' });
  const targetA = createPlayer({ id: 'targetA', username: 'TargetA', roleName: 'Citizen' });
  const targetB = createPlayer({ id: 'targetB', username: 'TargetB', roleName: 'Citizen' });
  const players = { m: mayor, c1: citizen1, c2: citizen2, targetA, targetB };

  // 5.1 Nomination Phase: Revealed Mayor in solitary casts vote
  const nomLobby = createLobby(players, {
    mode: 'STANFORD_PRISON',
    phase: 'DAY_VOTING',
    liveVotes: {
      m: 'targetA', // Mayor votes for targetA
      c1: 'targetB', // Citizen votes for targetB
    },
    mayorRevealedUserIds: ['m'],
    solitaryConfinementPlayerIds: ['m'], // Mayor is in solitary confinement!
  });

  const nomOutput = runVotingEngine({ lobby: nomLobby });
  const tallyA = nomOutput.tallies.find(t => t.candidateId === 'targetA');
  const tallyB = nomOutput.tallies.find(t => t.candidateId === 'targetB');

  assert.strictEqual(
    tallyA?.voteWeight ?? 0,
    0,
    'Mayor in solitary must contribute 0 vote weight in nomination'
  );
  assert.strictEqual(
    tallyA?.voteCount ?? 0,
    0,
    'Mayor in solitary must contribute 0 vote count in nomination'
  );
  assert.strictEqual(
    tallyB?.voteWeight ?? 0,
    1,
    'Free citizen vote must be preserved'
  );

  // 5.2 Verdict Phase: Revealed Mayor in solitary votes GUILTY against innocent votes
  const verdictLobby = createLobby(players, {
    mode: 'STANFORD_PRISON',
    phase: 'TRIAL_DEFENSE',
    accusedPlayerId: 'targetA',
    trialVerdictVotes: {
      m: 'GUILTY', // Mayor votes GUILTY (weight would be 3 if free)
      c1: 'INNOCENT', // 1 Citizen votes INNOCENT (weight 1)
    },
    mayorRevealedUserIds: ['m'],
    solitaryConfinementPlayerIds: ['m'], // Mayor in solitary!
  });

  const verdictOutput = determineVerdictOutcome(verdictLobby);
  assert.strictEqual(
    verdictOutput.guiltyWeight,
    0,
    'Mayor in solitary must contribute 0 guilty weight'
  );
  assert.strictEqual(
    verdictOutput.guiltyCount,
    0,
    'Mayor in solitary must contribute 0 guilty count'
  );
  assert.strictEqual(
    verdictOutput.innocentWeight,
    1,
    'Free citizen innocent weight = 1'
  );
  assert.strictEqual(
    verdictOutput.verdict,
    'INNOCENT',
    'Accused acquitted because solitary Mayor vote is nullified (0 vs 1)'
  );

  // 5.3 All-In Mode: Solitary Mayor with base weight 3 / revealed 9 must still contribute 0
  const allInMayor = createPlayer({ id: 'm', username: 'MayorJane', roleName: 'Mayor', office: 'MAYOR' });
  const allInPlayers = { m: allInMayor, c1: citizen1, c2: citizen2, targetA, targetB };
  const allInVerdictLobby = createLobby(allInPlayers, {
    mode: 'ALL_IN',
    phase: 'TRIAL_DEFENSE',
    accusedPlayerId: 'targetA',
    trialVerdictVotes: { m: 'GUILTY' },
    mayorRevealedUserIds: ['m'],
    solitaryConfinementPlayerIds: ['m'],
  });

  const allInVerdictOutput = determineVerdictOutcome(allInVerdictLobby);
  assert.strictEqual(
    allInVerdictOutput.guiltyWeight,
    0,
    'All-In solitary Mayor must contribute 0 weight despite office bonus and reveal'
  );

  console.log('  ✔ Invariant 5 verified: Solitary confinement completely disenfranchises revealed Mayors across both modes');
}

// ============================================================================
// SUITE 6: MASSIVE RANDOMIZED MONTE CARLO STRESS HARNESS (1,000+ ITERATIONS)
// ============================================================================

export function runRandomizedMonteCarloStress(iterations = 1000): void {
  console.log(`\n--- [Suite 6] Randomized Monte Carlo Stress Harness (${iterations} Iterations) ---`);

  let nominationQuorumCount = 0;
  let nominationNoLynchCount = 0;
  let trialGuiltyCount = 0;
  let trialInnocentCount = 0;
  let solitaryMayorBlockedCount = 0;
  let mayorMultipliersVerified = 0;

  for (let it = 1; it <= iterations; it++) {
    // Random player count between 3 and 40
    const playerCount = Math.floor(Math.random() * 38) + 3; // 3..40
    const mode = Math.random() < 0.3 ? 'ALL_IN' : (Math.random() < 0.2 ? 'STANFORD_PRISON' : 'BLITZ');
    const isAllIn = mode === 'ALL_IN';
    const isStanford = mode === 'STANFORD_PRISON';
    const wrathMode = Math.random() < 0.05; // 5% Dante Wrath

    // Generate players
    const players: Record<string, PlayerSession> = {};
    const playerIds: string[] = [];
    let mayorId: string | null = null;

    for (let i = 1; i <= playerCount; i++) {
      const pid = `p${i}`;
      playerIds.push(pid);
      const isMayorPlayer = i === 1 && Math.random() < 0.7; // 70% chance of a Mayor
      if (isMayorPlayer) mayorId = pid;

      players[pid] = createPlayer({
        id: pid,
        username: `User_${i}`,
        roleName: isMayorPlayer ? 'Mayor' : (i === 2 ? 'Godfather' : 'Citizen'),
        faction: i === 2 ? 'MAFIA' : 'TOWN',
        office: isMayorPlayer ? 'MAYOR' : 'PUBLIC_DEFENDER',
      });
    }

    const isMayorRevealed = mayorId !== null && Math.random() < 0.6;
    const mayorRevealedUserIds = isMayorRevealed && mayorId ? [mayorId] : [];

    // Solitary confinement assignment
    const solitaryPlayerIds: string[] = [];
    if (isStanford) {
      if (mayorId && Math.random() < 0.5) {
        solitaryPlayerIds.push(mayorId);
      }
      if (Math.random() < 0.3) {
        solitaryPlayerIds.push(playerIds[1]!);
      }
    }

    // ── Phase A: Randomized Nomination Phase ──
    const liveVotes: Record<string, string> = {};
    for (const pid of playerIds) {
      // 20% chance of abstaining
      if (Math.random() < 0.2) continue;
      // Pick random target
      const target = playerIds[Math.floor(Math.random() * playerIds.length)]!;
      liveVotes[pid] = target;
    }

    const nomLobby = createLobby(players, {
      mode,
      phase: 'DAY_VOTING',
      liveVotes,
      mayorRevealedUserIds,
      solitaryConfinementPlayerIds: solitaryPlayerIds,
      wrathNoAbstainEnforced: wrathMode,
    });

    const nomOutput = runVotingEngine({ lobby: nomLobby });

    // Assert Invariant: Every tally must have non-negative finite integer numbers
    for (const tally of nomOutput.tallies) {
      assert.ok(Number.isInteger(tally.voteCount) && tally.voteCount >= 0);
      assert.ok(Number.isFinite(tally.voteWeight) && tally.voteWeight >= 0);
    }

    if (nomOutput.outcome.kind === 'LYNCHED') {
      nominationQuorumCount++;
      const accused = nomOutput.outcome.victimId;
      assert.ok(players[accused], 'Indicted victim must be valid player');
      assert.strictEqual(players[accused].isAlive, true, 'Indicted player must remain alive during nomination');

      // State machine transition check
      const nextPhase = nextPhaseAfter('DAY_VOTING', nomLobby);
      assert.strictEqual(nextPhase, 'TRIAL_DEFENSE', 'Must transition to TRIAL_DEFENSE when quorum reached');
    } else {
      nominationNoLynchCount++;
      const nextPhase = nextPhaseAfter('DAY_VOTING', nomLobby);
      assert.strictEqual(nextPhase, 'NIGHT_BUFFER', 'Must transition to NIGHT_BUFFER when no majority');
    }

    // ── Phase B: Randomized Verdict Phase ──
    const accusedId = playerIds[playerIds.length - 1]!; // last player on podium
    const trialVerdictVotes: Record<string, 'GUILTY' | 'INNOCENT'> = {};

    for (const pid of playerIds) {
      if (pid === accusedId) continue; // accused on podium
      const roll = Math.random();
      if (roll < 0.4) {
        trialVerdictVotes[pid] = 'GUILTY';
      } else if (roll < 0.8) {
        trialVerdictVotes[pid] = 'INNOCENT';
      }
      // remaining 20% abstain
    }

    const trialLobby = createLobby(players, {
      mode,
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: accusedId,
      trialVerdictVotes,
      mayorRevealedUserIds,
      solitaryConfinementPlayerIds: solitaryPlayerIds,
      wrathNoAbstainEnforced: wrathMode,
    });

    const verdictResult = determineVerdictOutcome(trialLobby);

    // Verify Invariant 4: Mayor multiplier check
    if (mayorId && mayorId !== accusedId && !solitaryPlayerIds.includes(mayorId) && trialVerdictVotes[mayorId]) {
      const vote = trialVerdictVotes[mayorId];
      const expectedWeight = isAllIn ? (isMayorRevealed ? 9 : 3) : (isMayorRevealed ? 3 : 1);
      if (vote === 'GUILTY') {
        assert.ok(verdictResult.guiltyWeight >= expectedWeight);
      } else {
        assert.ok(verdictResult.innocentWeight >= expectedWeight);
      }
      mayorMultipliersVerified++;
    }

    // Verify Invariant 5: Solitary Mayor weight check
    if (mayorId && mayorId !== accusedId && solitaryPlayerIds.includes(mayorId) && trialVerdictVotes[mayorId]) {
      solitaryMayorBlockedCount++;
      // Calculate weight without Mayor
      const strippedVotes = { ...trialVerdictVotes };
      delete strippedVotes[mayorId];
      const controlLobby = createLobby(players, {
        mode,
        phase: 'TRIAL_DEFENSE',
        accusedPlayerId: accusedId,
        trialVerdictVotes: strippedVotes,
        mayorRevealedUserIds,
        solitaryConfinementPlayerIds: solitaryPlayerIds,
        wrathNoAbstainEnforced: wrathMode,
      });
      const controlResult = determineVerdictOutcome(controlLobby);
      assert.strictEqual(
        verdictResult.guiltyWeight,
        controlResult.guiltyWeight,
        'Solitary Mayor must add 0 guilty weight'
      );
      assert.strictEqual(
        verdictResult.innocentWeight,
        controlResult.innocentWeight,
        'Solitary Mayor must add 0 innocent weight'
      );
    }

    // Verify Invariant 3: Verdict logic
    if (verdictResult.innocentWeight >= verdictResult.guiltyWeight && !wrathMode) {
      assert.strictEqual(
        verdictResult.verdict,
        'INNOCENT',
        `Iteration ${it}: innocentWeight (${verdictResult.innocentWeight}) >= guiltyWeight (${verdictResult.guiltyWeight}) must acquit`
      );
      assert.strictEqual(verdictResult.convictedPlayerId, null);
      trialInnocentCount++;
    } else if (verdictResult.guiltyWeight > verdictResult.innocentWeight) {
      assert.strictEqual(
        verdictResult.verdict,
        'GUILTY',
        `Iteration ${it}: guiltyWeight (${verdictResult.guiltyWeight}) > innocentWeight (${verdictResult.innocentWeight}) must convict`
      );
      assert.strictEqual(verdictResult.convictedPlayerId, accusedId);
      trialGuiltyCount++;
    }
  }

  console.log(`  ✔ Completed ${iterations} randomized Monte Carlo scenarios with 100% invariant assertion coverage:`);
  console.log(`    - Indictments to podium: ${nominationQuorumCount}`);
  console.log(`    - Non-indictment skips:  ${nominationNoLynchCount}`);
  console.log(`    - Trial convictions:     ${trialGuiltyCount}`);
  console.log(`    - Trial acquittals:      ${trialInnocentCount}`);
  console.log(`    - Solitary Mayors blocked: ${solitaryMayorBlockedCount}`);
  console.log(`    - Mayors weighted & validated: ${mayorMultipliersVerified}`);
}

// ============================================================================
// SUITE 7: API ROUTE PROTOCOL & CONTRACT STRESS (POST /api/lobby/[lobbyId])
// ============================================================================

import { POST as handleLobbyPost } from '../src/app/api/lobby/[lobbyId]/route';

export async function testSuite7_ApiRouteProtocolStress(): Promise<void> {
  console.log('\n--- [Suite 7] API Route Protocol & Contract Stress (POST /api/lobby/[lobbyId]) ---');

  const lobbyId = 'api-test-courtroom-1';
  const mayor = createPlayer({ id: 'm1', username: 'MayorJane', roleName: 'Mayor' });
  const citizen1 = createPlayer({ id: 'c1', username: 'Citizen1', roleName: 'Citizen' });
  const citizen2 = createPlayer({ id: 'c2', username: 'Citizen2', roleName: 'Citizen' });
  const accused = createPlayer({ id: 'accused1', username: 'Accused1', roleName: 'Citizen' });
  const deadMayor = createPlayer({ id: 'm_dead', username: 'DeadMayor', roleName: 'Mayor', isAlive: false });

  const players = {
    m1: mayor,
    c1: citizen1,
    c2: citizen2,
    accused1: accused,
    m_dead: deadMayor,
  };

  const initialLobby = createLobby(players, {
    lobbyId,
    phase: 'DAY_VOTING',
    accusedPlayerId: null,
    mayorRevealedUserIds: [],
  });

  inMemoryLobbyStore.createLobby(lobbyId, 'm1', mayor, 'BLITZ');
  inMemoryLobbyStore.updateLobby(lobbyId, () => initialLobby);

  const makeReq = (body: any) =>
    new Request(`http://localhost:3000/api/lobby/${lobbyId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const ctx = { params: { lobbyId } };

  // 7.1 Non-Mayor attempts MAYOR_REVEAL -> 403 NOT_A_MAYOR
  {
    const res = await handleLobbyPost(makeReq({ action: 'MAYOR_REVEAL', userId: 'c1' }), ctx);
    assert.strictEqual(res.status, 403, 'Non-Mayor reveal must return 403');
    const data = await res.json();
    assert.strictEqual(data.error, 'NOT_A_MAYOR');
  }

  // 7.2 Dead Mayor attempts MAYOR_REVEAL -> 400 PLAYER_NOT_ALIVE_OR_FOUND
  {
    const res = await handleLobbyPost(makeReq({ action: 'MAYOR_REVEAL', userId: 'm_dead' }), ctx);
    assert.strictEqual(res.status, 400, 'Dead Mayor reveal must return 400');
    const data = await res.json();
    assert.strictEqual(data.error, 'PLAYER_NOT_ALIVE_OR_FOUND');
  }

  // 7.3 Valid living Mayor attempts MAYOR_REVEAL -> 200 SUCCESS
  {
    const res = await handleLobbyPost(makeReq({ action: 'MAYOR_REVEAL', userId: 'm1' }), ctx);
    assert.strictEqual(res.status, 200, 'Living Mayor reveal must return 200');
    const updated = inMemoryLobbyStore.getLobby(lobbyId)!;
    assert.ok(updated.mayorRevealedUserIds.includes('m1'), 'm1 must be in mayorRevealedUserIds');
  }

  // 7.4 Duplicate MAYOR_REVEAL -> 400 ALREADY_REVEALED
  {
    const res = await handleLobbyPost(makeReq({ action: 'MAYOR_REVEAL', userId: 'm1' }), ctx);
    assert.strictEqual(res.status, 400, 'Duplicate Mayor reveal must return 400');
    const data = await res.json();
    assert.strictEqual(data.error, 'ALREADY_REVEALED');
  }

  // 7.5 CAST_VERDICT_VOTE during DAY_VOTING -> 400 INVALID_PHASE
  {
    const res = await handleLobbyPost(makeReq({ action: 'CAST_VERDICT_VOTE', userId: 'c1', verdict: 'GUILTY' }), ctx);
    assert.strictEqual(res.status, 400, 'Verdict vote during DAY_VOTING must return 400');
    const data = await res.json();
    assert.strictEqual(data.error, 'INVALID_PHASE');
  }

  // 7.6 Setup TRIAL_DEFENSE phase
  inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
    ...l,
    phase: 'TRIAL_DEFENSE',
    accusedPlayerId: 'accused1',
    trialVerdictVotes: {},
  }));

  // 7.7 Accused player attempts CAST_VERDICT_VOTE on self -> 400 ACCUSED_CANNOT_VOTE
  {
    const res = await handleLobbyPost(makeReq({ action: 'CAST_VERDICT_VOTE', userId: 'accused1', verdict: 'INNOCENT' }), ctx);
    assert.strictEqual(res.status, 400, 'Accused player voting must return 400');
    const data = await res.json();
    assert.strictEqual(data.error, 'ACCUSED_CANNOT_VOTE');
  }

  // 7.8 Invalid verdict string -> 400 INVALID_VERDICT_VALUE
  {
    const res = await handleLobbyPost(makeReq({ action: 'CAST_VERDICT_VOTE', userId: 'c1', verdict: 'MAYBE' }), ctx);
    assert.strictEqual(res.status, 400, 'Invalid verdict string must return 400');
    const data = await res.json();
    assert.strictEqual(data.error, 'INVALID_VERDICT_VALUE');
  }

  // 7.9 Valid juror votes -> 200 SUCCESS and records in trialVerdictVotes
  {
    const res = await handleLobbyPost(makeReq({ action: 'CAST_VERDICT_VOTE', userId: 'c1', verdict: 'GUILTY' }), ctx);
    assert.strictEqual(res.status, 200, 'Valid verdict vote must return 200');
    const updated = inMemoryLobbyStore.getLobby(lobbyId)!;
    assert.strictEqual(updated.trialVerdictVotes['c1'], 'GUILTY');
  }

  console.log('  ✔ Suite 7 verified: API route enforces role validation, phase security, and input sanitation');
}

// ============================================================================
// SUITE 8: COURTROOM VICTORY CONDITION COLLISIONS (JESTER ON PODIUM)
// ============================================================================

export function testSuite8_JesterPodiumVictoryCollisions(): void {
  console.log('\n--- [Suite 8] Courtroom Victory Condition Collisions (Jester On Podium) ---');

  const jester = createPlayer({
    id: 'jester1',
    username: 'Jester',
    roleName: 'Jester',
    faction: 'NEUTRAL_EVIL',
  });
  const mafia = createPlayer({ id: 'm1', username: 'MafiaDon', roleName: 'Killer', faction: 'MAFIA' });
  const town1 = createPlayer({ id: 't1', username: 'Town1', roleName: 'Citizen', faction: 'TOWN' });
  const town2 = createPlayer({ id: 't2', username: 'Town2', roleName: 'Citizen', faction: 'TOWN' });

  const players = { jester1: jester, m1: mafia, t1: town1, t2: town2 };

  // 8.1 Jester Conviction on Podium triggers JESTER_LUCIFER_SHADOW victory
  {
    const lobbyId = 'jester-convict-lobby';
    const lobby = createLobby(players, {
      lobbyId,
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'jester1',
      trialVerdictVotes: { t1: 'GUILTY', t2: 'GUILTY', m1: 'GUILTY' },
    });

    inMemoryLobbyStore.createLobby(lobbyId, 't1', town1, lobby.mode);
    inMemoryLobbyStore.updateLobby(lobbyId, () => lobby);

    const transition = executePhaseTransition({ lobbyId });
    assert.ok(transition);
    assert.strictEqual(transition.toPhase, 'ENDED', 'Convicting Jester must end the game');
    assert.strictEqual(
      transition.winCondition.kind,
      'JESTER_LUCIFER_SHADOW',
      'Jester conviction must trigger Jester victory condition'
    );
    assert.deepStrictEqual(
      transition.winCondition.winnerPlayerIds,
      ['jester1'],
      'Winner must be jester1'
    );
  }

  // 8.2 Jester Acquittal on Podium keeps game going (no Jester victory!)
  {
    const lobbyId = 'jester-acquit-lobby';
    const lobby = createLobby(players, {
      lobbyId,
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'jester1',
      trialVerdictVotes: { t1: 'INNOCENT', t2: 'INNOCENT', m1: 'GUILTY' },
    });

    inMemoryLobbyStore.createLobby(lobbyId, 't1', town1, lobby.mode);
    inMemoryLobbyStore.updateLobby(lobbyId, () => lobby);

    const transition = executePhaseTransition({ lobbyId });
    assert.ok(transition);
    assert.strictEqual(transition.toPhase, 'NIGHT_BUFFER', 'Acquitting Jester transitions to NIGHT_BUFFER');
    assert.strictEqual(
      transition.winCondition.kind,
      'GAME_CONTINUES',
      'Acquitting Jester allows game to continue'
    );
    const updated = inMemoryLobbyStore.getLobby(lobbyId)!;
    assert.strictEqual(updated.players['jester1'].isAlive, true, 'Acquitted Jester survives');
  }

  console.log('  ✔ Suite 8 verified: Jester victory triggered on podium conviction, prevented on acquittal');
}

// ============================================================================
// SUITE 9: DEADLOCK TIE & MULTI-CANDIDATE BOUNDARY STRESS
// ============================================================================

export function testSuite9_DeadlockTieAndMultiCandidateBoundary(): void {
  console.log('\n--- [Suite 9] Deadlock Tie & Multi-Candidate Boundary Stress ---');

  // 9.1 3-way nomination tie (e.g., 3 candidates each have 2 votes)
  {
    const p1 = createPlayer({ id: 'p1', username: 'P1' });
    const p2 = createPlayer({ id: 'p2', username: 'P2' });
    const p3 = createPlayer({ id: 'p3', username: 'P3' });
    const p4 = createPlayer({ id: 'p4', username: 'P4' });
    const p5 = createPlayer({ id: 'p5', username: 'P5' });
    const p6 = createPlayer({ id: 'p6', username: 'P6' });

    const players = { p1, p2, p3, p4, p5, p6 };
    // p1, p2 vote p4; p3, p4 vote p5; p5, p6 vote p6
    const liveVotes = { p1: 'p4', p2: 'p4', p3: 'p5', p4: 'p5', p5: 'p6', p6: 'p6' };
    const lobby = createLobby(players, { phase: 'DAY_VOTING', liveVotes });

    const output = runVotingEngine({ lobby });
    assert.strictEqual(output.outcome.kind, 'TIE', '3-way equal vote must result in TIE');
    if (output.outcome.kind === 'TIE') {
      assert.strictEqual(output.outcome.tiedCandidateIds.length, 3, 'Must identify all 3 tied candidates');
    }

    const nextPhase = nextPhaseAfter('DAY_VOTING', lobby);
    assert.strictEqual(nextPhase, 'NIGHT_BUFFER', 'Tied nomination transitions to NIGHT_BUFFER (no lynch)');
  }

  // 9.2 100% Abstention in nomination -> NO_LYNCH (ABSTAIN)
  {
    const players: Record<string, PlayerSession> = {};
    for (let i = 1; i <= 10; i++) {
      players[`p${i}`] = createPlayer({ id: `p${i}`, username: `P${i}` });
    }
    const lobby = createLobby(players, { phase: 'DAY_VOTING', liveVotes: {} });
    const output = runVotingEngine({ lobby });
    assert.strictEqual(output.outcome.kind, 'NO_LYNCH');
    assert.strictEqual((output.outcome as any).reason, 'ABSTAIN');
  }

  console.log('  ✔ Suite 9 verified: Multi-candidate ties and full abstentions handled deterministically');
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function runAllEmpiricalStressTests(): Promise<void> {
  console.log('================================================================');
  console.log('STARTING EMPIRICAL ADVERSARIAL STRESS TEST: MILESTONE 2 (R2)');
  console.log('================================================================');

  testInvariant1_NominationToPodium();
  testInvariant2_PodiumLivenessAndSelfVoteProhibition();
  testInvariant3_PresumptionOfInnocence();
  testInvariant4_Mayor3xMultiplier();
  testInvariant5_MayorSolitaryDisenfranchisement();
  runRandomizedMonteCarloStress(1000);
  await testSuite7_ApiRouteProtocolStress();
  testSuite8_JesterPodiumVictoryCollisions();
  testSuite9_DeadlockTieAndMultiCandidateBoundary();

  console.log('\n================================================================');
  console.log('✅ ALL 9 EMPIRICAL CHALLENGE SUITES PASSED WITH 100% SUCCESS');
  console.log('================================================================');
}

runAllEmpiricalStressTests().catch((err) => {
  console.error('Fatal stress test failure:', err);
  process.exit(1);
});

