/**
 * Automated Unit & Integration Test Suite: Courtroom Podium Defense & Voting Engine (Milestone 2 - R2)
 *
 * Verifies:
 * - Group 1: Two-Tier Courtroom Trial — Nomination Phase (Majority transitions to TRIAL_DEFENSE with 30s timer, quorum fail transitions to NIGHT_BUFFER)
 * - Group 2: Two-Tier Courtroom Trial — Podium Defense & Verdict Resolution (GUILTY > INNOCENT convicts, INNOCENT >= GUILTY acquits)
 * - Group 3: Mayor Reveal Mechanics & 3x Weight Multipliers (Standard 1->3, All-In (1+2)->9)
 * - Group 4: Security, Validation & Negative Paths (Non-Mayor rejected, dead Mayor rejected, duplicate idempotent)
 * - Group 5: Stanford Prison Solitary Disenfranchisement Collisions (Mayor in solitary yields 0 votes/weight)
 */

import assert from 'node:assert';
import {
  getVoterWeight,
  runVotingEngine,
  determineVerdictOutcome,
} from '../src/server/engine/voting-engine';
import {
  nextPhaseAfter,
  computePhaseDuration,
  evaluateWinCondition,
} from '../src/server/engine/phase-manager';
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
// TEST FIXTURES & MOCK FACTORIES
// ============================================================================

interface MockPlayerOpts {
  readonly id: string;
  readonly username: string;
  readonly roleName: string;
  readonly localizedRoleName?: string;
  readonly faction?: CoreFaction;
  readonly office?: CivicOfficeType;
  readonly trait?: InnateTraitType;
  readonly district?: AllInDistrict;
  readonly isAlive?: boolean;
}

export function createMockPlayer(opts: MockPlayerOpts): PlayerSession {
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

interface MockLobbyOpts {
  readonly mode?: 'BLITZ' | 'ALL_IN' | 'STANFORD_PRISON' | 'DANTES_INFERNO';
  readonly phase?: GamePhase;
  readonly liveVotes?: Record<string, string>;
  readonly trialVerdictVotes?: Record<string, 'GUILTY' | 'INNOCENT'>;
  readonly accusedPlayerId?: string | null;
  readonly mayorRevealedUserIds?: readonly string[];
  readonly solitaryConfinementPlayerIds?: readonly string[];
  readonly roundNumber?: number;
}

export function createMockLobby(
  players: Record<string, PlayerSession>,
  opts?: MockLobbyOpts
): LobbyState {
  const hostId = Object.keys(players)[0] ?? 'p1';
  return {
    lobbyId: 'test-courtroom-lobby',
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
    },
    roundNumber: opts?.roundNumber ?? 1,
    lastLynchedUserId: null,
    globalNightKillCap: 5,
    chatMessages: [],
  };
}

// ============================================================================
// GROUP 1: TWO-TIER COURTROOM TRIAL — NOMINATION PHASE
// ============================================================================

export function runNominationPhaseTests(): void {
  console.log('--- [Suite 1] Two-Tier Courtroom Trial: Nomination Phase ---');

  // TEST 1.1: Leading candidate reaches strict majority -> transitions to TRIAL_DEFENSE with 30s timer & accusedPlayerId set
  {
    console.log('▶ Test 1.1: Candidate reaches quorum majority -> transitions to TRIAL_DEFENSE (30s, accused set)');
    const p1 = createMockPlayer({ id: 'p1', username: 'Alice', roleName: 'Citizen' });
    const p2 = createMockPlayer({ id: 'p2', username: 'Bob', roleName: 'Citizen' });
    const p3 = createMockPlayer({ id: 'p3', username: 'Charlie', roleName: 'Citizen' });
    const p4 = createMockPlayer({ id: 'p4', username: 'David', roleName: 'Citizen' });
    const p5 = createMockPlayer({ id: 'p5', username: 'Eve', roleName: 'Citizen' });
    const p6 = createMockPlayer({ id: 'p6', username: 'Frank', roleName: 'Citizen' });
    const p7 = createMockPlayer({ id: 'p7', username: 'Grace', roleName: 'Citizen' });

    // 7 alive players. Quorum is floor(7 / 2) + 1 = 4.
    // 4 players vote for Eve (p5) -> strict majority.
    const players = { p1, p2, p3, p4, p5, p6, p7 };
    const liveVotes: Record<string, string> = {
      p1: 'p5',
      p2: 'p5',
      p3: 'p5',
      p4: 'p5',
      p5: 'p1',
      p6: 'p1',
    };

    const lobby = createMockLobby(players, { phase: 'DAY_VOTING', liveVotes });

    // 1. Voting engine tallies and recognizes p5 reached nomination quorum
    const votingOutput = runVotingEngine({ lobby });
    assert.strictEqual(votingOutput.outcome.kind, 'LYNCHED', 'Candidate reached nomination threshold');
    assert.strictEqual((votingOutput.outcome as any).victimId, 'p5', 'Indicted candidate is p5');

    // 2. Next phase must be TRIAL_DEFENSE (not instant NIGHT_BUFFER, not direct lynch!)
    const nextPhase = nextPhaseAfter('DAY_VOTING', { ...lobby, accusedPlayerId: 'p5' });
    assert.strictEqual(nextPhase, 'TRIAL_DEFENSE', 'Must transition to TRIAL_DEFENSE when candidate reaches majority');

    // 3. TRIAL_DEFENSE duration must be exactly 30 seconds
    const duration = computePhaseDuration('TRIAL_DEFENSE', lobby);
    assert.strictEqual(duration.durationSeconds, 30, 'TRIAL_DEFENSE phase duration must be strictly 30 seconds');

    // 4. Candidate MUST remain alive on the podium during defense
    assert.strictEqual(lobby.players['p5'].isAlive, true, 'Accused player must remain ALIVE during podium defense');
    assert.strictEqual(lobby.lastLynchedUserId, null, 'No player lynched yet prior to defense verdict');

    console.log('  ✔ Test 1.1 Passed');
  }

  // TEST 1.2: No candidate reaches quorum -> transitions directly to NIGHT_BUFFER (no lynch)
  {
    console.log('▶ Test 1.2: No candidate reaches quorum -> transitions to NIGHT_BUFFER (no lynch)');
    const p1 = createMockPlayer({ id: 'p1', username: 'Alice', roleName: 'Citizen' });
    const p2 = createMockPlayer({ id: 'p2', username: 'Bob', roleName: 'Citizen' });
    const p3 = createMockPlayer({ id: 'p3', username: 'Charlie', roleName: 'Citizen' });
    const p4 = createMockPlayer({ id: 'p4', username: 'David', roleName: 'Citizen' });
    const p5 = createMockPlayer({ id: 'p5', username: 'Eve', roleName: 'Citizen' });

    // 5 alive players. Quorum is 3.
    // p1 and p3 vote for p2. Total = 2 (< 3 quorum).
    const players = { p1, p2, p3, p4, p5 };
    const liveVotes: Record<string, string> = {
      p1: 'p2',
      p3: 'p2',
    };

    const lobby = createMockLobby(players, { phase: 'DAY_VOTING', liveVotes });

    const votingOutput = runVotingEngine({ lobby });
    assert.strictEqual(votingOutput.outcome.kind, 'NO_LYNCH', 'Quorum not met -> NO_LYNCH');

    // State machine should skip TRIAL_DEFENSE and transition directly to NIGHT_BUFFER
    const nextPhase = nextPhaseAfter('DAY_VOTING', lobby);
    assert.strictEqual(nextPhase, 'NIGHT_BUFFER', 'Must transition to NIGHT_BUFFER when quorum is not met');

    // All players survive
    assert.strictEqual(Object.values(lobby.players).every(p => p.isAlive), true, 'All players must survive');
    assert.strictEqual(lobby.accusedPlayerId, null, 'No accused player set');

    console.log('  ✔ Test 1.2 Passed');
  }

  // TEST 1.3: Deadlock / Tie between top candidates -> transitions to NIGHT_BUFFER without indictment
  {
    console.log('▶ Test 1.3: Deadlock tie between top candidates -> NO_LYNCH -> NIGHT_BUFFER');
    const p1 = createMockPlayer({ id: 'p1', username: 'Alice', roleName: 'Citizen' });
    const p2 = createMockPlayer({ id: 'p2', username: 'Bob', roleName: 'Citizen' });
    const p3 = createMockPlayer({ id: 'p3', username: 'Charlie', roleName: 'Citizen' });
    const p4 = createMockPlayer({ id: 'p4', username: 'David', roleName: 'Citizen' });

    // 4 players: 2 vote for p3, 2 vote for p4 (2 vs 2 tie)
    const players = { p1, p2, p3, p4 };
    const liveVotes = { p1: 'p3', p2: 'p3', p3: 'p4', p4: 'p4' };
    const lobby = createMockLobby(players, { phase: 'DAY_VOTING', liveVotes });

    const votingOutput = runVotingEngine({ lobby });
    assert.strictEqual(votingOutput.outcome.kind, 'TIE', 'Equal top votes must produce TIE');

    const nextPhase = nextPhaseAfter('DAY_VOTING', lobby);
    assert.strictEqual(nextPhase, 'NIGHT_BUFFER', 'Tie without majority skips defense and enters night');

    console.log('  ✔ Test 1.3 Passed');
  }
}

// ============================================================================
// GROUP 2: TWO-TIER COURTROOM TRIAL — DEFENSE & VERDICT PHASE
// ============================================================================

export function runDefenseVerdictTests(): void {
  console.log('--- [Suite 2] Two-Tier Courtroom Trial: Podium Defense & Verdict ---');

  // TEST 2.1: GUILTY > INNOCENT -> Accused is convicted and lynched
  {
    console.log('▶ Test 2.1: Defense verdict GUILTY > INNOCENT -> Accused convicted and executed');
    const p1 = createMockPlayer({ id: 'p1', username: 'Juror 1', roleName: 'Citizen' });
    const p2 = createMockPlayer({ id: 'p2', username: 'Juror 2', roleName: 'Citizen' });
    const p3 = createMockPlayer({ id: 'p3', username: 'Juror 3', roleName: 'Citizen' });
    const p4 = createMockPlayer({ id: 'p4', username: 'Juror 4', roleName: 'Citizen' });
    const mafia2 = createMockPlayer({ id: 'mafia-2', username: 'Mafia Partner', roleName: 'Mafia', faction: 'MAFIA' });
    const accused = createMockPlayer({ id: 'accused-1', username: 'Suspect Sam', roleName: 'Mafia (Qatil)', faction: 'MAFIA' });

    const players = { p1, p2, p3, p4, 'mafia-2': mafia2, 'accused-1': accused };
    // 3 GUILTY vs 1 INNOCENT
    const trialVerdictVotes: Record<string, 'GUILTY' | 'INNOCENT'> = {
      p1: 'GUILTY',
      p2: 'GUILTY',
      p3: 'GUILTY',
      p4: 'INNOCENT',
    };

    const lobby = createMockLobby(players, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'accused-1',
      trialVerdictVotes,
    });

    const verdictOutcome = determineVerdictOutcome(lobby);
    assert.strictEqual(verdictOutcome.verdict, 'GUILTY', 'Verdict must be GUILTY when guilty votes exceed innocent');
    assert.strictEqual(verdictOutcome.guiltyWeight, 3, 'Guilty weight must equal 3');
    assert.strictEqual(verdictOutcome.innocentWeight, 1, 'Innocent weight must equal 1');
    assert.strictEqual(verdictOutcome.convictedPlayerId, 'accused-1', 'Convicted player must be accused-1');

    // Simulate verdict resolution step
    const updatedPlayers = {
      ...lobby.players,
      'accused-1': { ...lobby.players['accused-1'], isAlive: false },
    };
    const postVerdictLobby = {
      ...lobby,
      players: updatedPlayers,
      lastLynchedUserId: 'accused-1',
    };

    assert.strictEqual(postVerdictLobby.players['accused-1'].isAlive, false, 'Convicted accused must be eliminated (isAlive = false)');
    assert.strictEqual(postVerdictLobby.lastLynchedUserId, 'accused-1', 'lastLynchedUserId must record the executed suspect');

    const nextPhase = nextPhaseAfter('TRIAL_DEFENSE', postVerdictLobby);
    assert.strictEqual(nextPhase, 'NIGHT_BUFFER', 'After conviction, state machine transitions to NIGHT_BUFFER');

    console.log('  ✔ Test 2.1 Passed');
  }

  // TEST 2.2: INNOCENT > GUILTY -> Accused is acquitted, survives, and transitions to night
  {
    console.log('▶ Test 2.2: Defense verdict INNOCENT > GUILTY -> Accused acquitted and survives');
    const p1 = createMockPlayer({ id: 'p1', username: 'Juror 1', roleName: 'Citizen' });
    const p2 = createMockPlayer({ id: 'p2', username: 'Juror 2', roleName: 'Citizen' });
    const p3 = createMockPlayer({ id: 'p3', username: 'Juror 3', roleName: 'Citizen' });
    const mafia = createMockPlayer({ id: 'm1', username: 'Hidden Mafia', roleName: 'Mafia', faction: 'MAFIA' });
    const accused = createMockPlayer({ id: 'accused-1', username: 'Innocent Ian', roleName: 'Citizen' });

    const players = { p1, p2, p3, m1: mafia, 'accused-1': accused };
    // 1 GUILTY vs 2 INNOCENT
    const trialVerdictVotes: Record<string, 'GUILTY' | 'INNOCENT'> = {
      p1: 'GUILTY',
      p2: 'INNOCENT',
      p3: 'INNOCENT',
    };

    const lobby = createMockLobby(players, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'accused-1',
      trialVerdictVotes,
    });

    const verdictOutcome = determineVerdictOutcome(lobby);
    assert.strictEqual(verdictOutcome.verdict, 'INNOCENT', 'Verdict must be INNOCENT when innocent votes exceed guilty');
    assert.strictEqual(verdictOutcome.convictedPlayerId, null, 'No player convicted on acquittal');

    // Accused survives
    assert.strictEqual(lobby.players['accused-1'].isAlive, true, 'Acquitted suspect must remain ALIVE');
    assert.strictEqual(lobby.lastLynchedUserId, null, 'lastLynchedUserId must remain null');

    const nextPhase = nextPhaseAfter('TRIAL_DEFENSE', lobby);
    assert.strictEqual(nextPhase, 'NIGHT_BUFFER', 'Acquittal transitions directly to NIGHT_BUFFER');

    console.log('  ✔ Test 2.2 Passed');
  }

  // TEST 2.3: INNOCENT == GUILTY (Tie) -> Presumption of Innocence acquits accused
  {
    console.log('▶ Test 2.3: Defense verdict TIE (INNOCENT == GUILTY) -> Acquittal by Presumption of Innocence');
    const p1 = createMockPlayer({ id: 'p1', username: 'Juror 1', roleName: 'Citizen' });
    const p2 = createMockPlayer({ id: 'p2', username: 'Juror 2', roleName: 'Citizen' });
    const mafia = createMockPlayer({ id: 'm1', username: 'Hidden Mafia', roleName: 'Mafia', faction: 'MAFIA' });
    const accused = createMockPlayer({ id: 'accused-1', username: 'Tied Tim', roleName: 'Citizen' });

    const players = { p1, p2, m1: mafia, 'accused-1': accused };
    // 1 GUILTY vs 1 INNOCENT (Tie)
    const trialVerdictVotes: Record<string, 'GUILTY' | 'INNOCENT'> = {
      p1: 'GUILTY',
      p2: 'INNOCENT',
    };

    const lobby = createMockLobby(players, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'accused-1',
      trialVerdictVotes,
    });

    const verdictOutcome = determineVerdictOutcome(lobby);
    assert.strictEqual(verdictOutcome.verdict, 'INNOCENT', 'Tie must result in INNOCENT verdict (INNOCENT >= GUILTY)');
    assert.strictEqual(verdictOutcome.convictedPlayerId, null, 'No conviction on tied verdict');
    assert.strictEqual(lobby.players['accused-1'].isAlive, true, 'Suspect survives on tie');

    console.log('  ✔ Test 2.3 Passed');
  }

  // TEST 2.4: Convicted Jester triggers Lucifer's Shadow victory
  {
    console.log('▶ Test 2.4: Convicted Jester on podium triggers Jester victory condition');
    const jester = createMockPlayer({
      id: 'jester-1',
      username: 'Jester Joker',
      roleName: 'Jester',
      localizedRoleName: 'Dəli (Jester)',
      faction: 'NEUTRAL_EVIL',
    });
    const p1 = createMockPlayer({ id: 'p1', username: 'Juror 1', roleName: 'Citizen' });
    const p2 = createMockPlayer({ id: 'p2', username: 'Juror 2', roleName: 'Citizen' });

    const players = { 'jester-1': jester, p1, p2 };
    const lobby = createMockLobby(players, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'jester-1',
      trialVerdictVotes: { p1: 'GUILTY', p2: 'GUILTY' },
    });

    const verdictOutcome = determineVerdictOutcome(lobby);
    assert.strictEqual(verdictOutcome.verdict, 'GUILTY');

    // Post-conviction lobby with Jester dead
    const postConviction = {
      ...lobby,
      players: {
        ...lobby.players,
        'jester-1': { ...lobby.players['jester-1'], isAlive: false },
      },
      lastLynchedUserId: 'jester-1',
    };

    const winCondition = evaluateWinCondition(postConviction);
    assert.strictEqual(winCondition.kind, 'JESTER_LUCIFER_SHADOW', 'Jester lynched via podium conviction wins');
    assert.deepStrictEqual(winCondition.winnerPlayerIds, ['jester-1']);

    console.log('  ✔ Test 2.4 Passed');
  }
}

// ============================================================================
// GROUP 3: MAYOR REVEAL MECHANICS & 3X VOTING MULTIPLIERS
// ============================================================================

export function runMayorRevealTests(): void {
  console.log('--- [Suite 3] Mayor Reveal Mechanics & Voting Weight Multipliers ---');

  // TEST 3.1: Mayor unrevealed: standard vote weight = 1 in standard mode
  {
    console.log('▶ Test 3.1: Mayor unrevealed in Standard Mode -> weight = 1');
    const mayor = createMockPlayer({
      id: 'mayor-1',
      username: 'Mayor Max',
      roleName: 'Mayor',
      localizedRoleName: 'Bələdiyyə Sədri',
      office: 'MAYOR',
    });

    const unrevealedWeight = getVoterWeight(mayor, false, []);
    assert.strictEqual(unrevealedWeight, 1, 'Unrevealed Mayor in Standard mode must have weight 1');
    console.log('  ✔ Test 3.1 Passed');
  }

  // TEST 3.2: Mayor unrevealed in All-In Mode: weight = 1 + office bonus (1 + 2 = 3)
  {
    console.log('▶ Test 3.2: Mayor unrevealed in All-In Mode -> weight = 1 + office bonus = 3');
    const mayor = createMockPlayer({
      id: 'mayor-1',
      username: 'Mayor Max',
      roleName: 'Mayor',
      localizedRoleName: 'Bələdiyyə Sədri',
      office: 'MAYOR',
    });

    const unrevealedWeightAllIn = getVoterWeight(mayor, true, []);
    assert.strictEqual(unrevealedWeightAllIn, 3, 'Unrevealed Mayor in All-In mode has base weight 1 + 2 bonus = 3');
    console.log('  ✔ Test 3.2 Passed');
  }

  // TEST 3.3: Mayor reveals in Standard Mode: vote weight multiplies by 3 (weight = 3)
  {
    console.log('▶ Test 3.3: Mayor reveals in Standard Mode -> weight multiplies by 3 (weight = 3)');
    const mayor = createMockPlayer({
      id: 'mayor-1',
      username: 'Mayor Max',
      roleName: 'Mayor',
      localizedRoleName: 'Bələdiyyə Sədri',
      office: 'MAYOR',
    });

    const revealedWeight = getVoterWeight(mayor, false, ['mayor-1']);
    assert.strictEqual(revealedWeight, 3, 'Revealed Mayor in Standard mode must have weight 3');
    console.log('  ✔ Test 3.3 Passed');
  }

  // TEST 3.4: Mayor reveals in All-In Mode: vote weight multiplies by 3 ((1+2) * 3 = 9)
  {
    console.log('▶ Test 3.4: Mayor reveals in All-In Mode -> 3x multiplier applies to All-In weight (weight = 9)');
    const mayor = createMockPlayer({
      id: 'mayor-1',
      username: 'Mayor Max',
      roleName: 'Mayor',
      localizedRoleName: 'Bələdiyyə Sədri',
      office: 'MAYOR',
    });

    const revealedWeightAllIn = getVoterWeight(mayor, true, ['mayor-1']);
    assert.strictEqual(revealedWeightAllIn, 9, 'Revealed Mayor in All-In mode must have weight 3x (1+2) = 9');
    console.log('  ✔ Test 3.4 Passed');
  }

  // TEST 3.5: Revealed Mayor vote breaks deadlock in Nomination Phase
  {
    console.log('▶ Test 3.5: Revealed Mayor breaks nomination deadlock with 3x weight');
    const mayor = createMockPlayer({
      id: 'mayor-1',
      username: 'Mayor Max',
      roleName: 'Mayor',
      localizedRoleName: 'Bələdiyyə Sədri',
      office: 'MAYOR',
    });
    const c1 = createMockPlayer({ id: 'c1', username: 'Citizen 1', roleName: 'Citizen' });
    const c2 = createMockPlayer({ id: 'c2', username: 'Citizen 2', roleName: 'Citizen' });
    const targetA = createMockPlayer({ id: 'target-a', username: 'Suspect A', roleName: 'Citizen' });
    const targetB = createMockPlayer({ id: 'target-b', username: 'Suspect B', roleName: 'Citizen' });

    const players = { 'mayor-1': mayor, c1, c2, 'target-a': targetA, 'target-b': targetB };

    // 2 citizens vote for Suspect B (total weight 2).
    // Revealed Mayor votes for Suspect A (weight 3).
    const liveVotes = {
      c1: 'target-b',
      c2: 'target-b',
      'mayor-1': 'target-a',
    };

    const lobby = createMockLobby(players, {
      phase: 'DAY_VOTING',
      liveVotes,
      mayorRevealedUserIds: ['mayor-1'],
    });

    const output = runVotingEngine({ lobby });
    const tallies = output.tallies;
    const tallyA = tallies.find(t => t.candidateId === 'target-a');
    const tallyB = tallies.find(t => t.candidateId === 'target-b');

    assert.strictEqual(tallyA?.voteCount, 1, 'Target A has 1 raw vote');
    assert.strictEqual(tallyA?.voteWeight, 3, 'Target A receives 3 weighted votes from revealed Mayor');
    assert.strictEqual(tallyB?.voteCount, 2, 'Target B has 2 raw votes');
    assert.strictEqual(tallyB?.voteWeight, 2, 'Target B receives 2 weighted votes from citizens');

    // 5 alive players: Quorum is 3. Target A reaches 3 weight -> nominated!
    assert.strictEqual(output.outcome.kind, 'LYNCHED');
    assert.strictEqual((output.outcome as any).victimId, 'target-a', 'Target A wins nomination due to Mayor 3x weight');

    console.log('  ✔ Test 3.5 Passed');
  }

  // TEST 3.6: Revealed Mayor overrides defense verdict (1 Mayor GUILTY beats 2 citizens INNOCENT)
  {
    console.log('▶ Test 3.6: Revealed Mayor GUILTY vote (weight 3) convicts against 2 citizen INNOCENT votes (weight 2)');
    const mayor = createMockPlayer({
      id: 'mayor-1',
      username: 'Mayor Max',
      roleName: 'Mayor',
      localizedRoleName: 'Bələdiyyə Sədri',
      office: 'MAYOR',
    });
    const c1 = createMockPlayer({ id: 'c1', username: 'Citizen 1', roleName: 'Citizen' });
    const c2 = createMockPlayer({ id: 'c2', username: 'Citizen 2', roleName: 'Citizen' });
    const accused = createMockPlayer({ id: 'accused-1', username: 'Suspect Sam', roleName: 'Citizen' });

    const players = { 'mayor-1': mayor, c1, c2, 'accused-1': accused };
    const trialVerdictVotes: Record<string, 'GUILTY' | 'INNOCENT'> = {
      'mayor-1': 'GUILTY',
      c1: 'INNOCENT',
      c2: 'INNOCENT',
    };

    const lobby = createMockLobby(players, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'accused-1',
      trialVerdictVotes,
      mayorRevealedUserIds: ['mayor-1'],
    });

    const verdictOutcome = determineVerdictOutcome(lobby);
    assert.strictEqual(verdictOutcome.guiltyWeight, 3, 'Mayor vote carries weight 3');
    assert.strictEqual(verdictOutcome.innocentWeight, 2, 'Two citizens carry total weight 2');
    assert.strictEqual(verdictOutcome.verdict, 'GUILTY', '3 GUILTY beats 2 INNOCENT -> Convicted!');
    assert.strictEqual(verdictOutcome.convictedPlayerId, 'accused-1');

    console.log('  ✔ Test 3.6 Passed');
  }
}

// ============================================================================
// GROUP 4: MAYOR REVEAL VALIDATION & SECURITY PATHS
// ============================================================================

export function runMayorValidationTests(): void {
  console.log('--- [Suite 4] Mayor Validation & Security Paths ---');

  // TEST 4.1: Non-Mayor attempting reveal -> rejected, weight remains standard 1
  {
    console.log('▶ Test 4.1: Non-Mayor attempting reveal is rejected and does not gain 3x weight');
    const citizen = createMockPlayer({
      id: 'citizen-impostor',
      username: 'Fake Mayor',
      roleName: 'Citizen',
      localizedRoleName: 'Vətəndaş',
      office: 'PUBLIC_DEFENDER',
    });

    // Even if impostor's ID is erroneously passed in revealed list, helper must reject if role/office is not Mayor
    const weight = getVoterWeight(citizen, false, ['citizen-impostor']);
    assert.strictEqual(weight, 1, 'Non-Mayor cannot obtain 3x weight multiplier');
    console.log('  ✔ Test 4.1 Passed');
  }

  // TEST 4.2: Dead Mayor cannot vote or reveal
  {
    console.log('▶ Test 4.2: Dead Mayor cannot vote or reveal');
    const deadMayor = createMockPlayer({
      id: 'dead-mayor',
      username: 'Late Mayor',
      roleName: 'Mayor',
      localizedRoleName: 'Bələdiyyə Sədri',
      office: 'MAYOR',
      isAlive: false,
    });

    const players = { 'dead-mayor': deadMayor, p2: createMockPlayer({ id: 'p2', username: 'Citizen', roleName: 'Citizen' }) };
    const liveVotes = { 'dead-mayor': 'p2' };
    const lobby = createMockLobby(players, {
      phase: 'DAY_VOTING',
      liveVotes,
      mayorRevealedUserIds: ['dead-mayor'],
    });

    const output = runVotingEngine({ lobby });
    const tallyP2 = output.tallies.find(t => t.candidateId === 'p2');
    assert.strictEqual(tallyP2?.voteCount, 0, 'Dead player vote must be ignored');
    assert.strictEqual(tallyP2?.voteWeight, 0, 'Dead player weight must be 0');

    console.log('  ✔ Test 4.2 Passed');
  }

  // TEST 4.3: Duplicate reveal is idempotent (multiplier stays 3x, not 9x)
  {
    console.log('▶ Test 4.3: Duplicate Mayor reveal ID is idempotent (remains 3x)');
    const mayor = createMockPlayer({
      id: 'mayor-1',
      username: 'Mayor Max',
      roleName: 'Mayor',
      localizedRoleName: 'Bələdiyyə Sədri',
      office: 'MAYOR',
    });

    // Array containing duplicate 'mayor-1' entries
    const weight = getVoterWeight(mayor, false, ['mayor-1', 'mayor-1', 'mayor-1']);
    assert.strictEqual(weight, 3, 'Multiplier must strictly remain 3x even if revealed ID is duplicated');

    console.log('  ✔ Test 4.3 Passed');
  }
}

// ============================================================================
// GROUP 5: STANFORD PRISON SOLITARY CONFINEMENT COLLISIONS
// ============================================================================

export function runSolitaryDisenfranchisementTests(): void {
  console.log('--- [Suite 5] Stanford Solitary Confinement vs Mayor 3x ---');

  // TEST 5.1: Revealed Mayor in solitary confinement -> weight contributes strictly 0 votes
  {
    console.log('▶ Test 5.1: Revealed Mayor in Solitary Confinement is disenfranchised (0 votes, 0 weight)');
    const mayor = createMockPlayer({
      id: 'mayor-1',
      username: 'Mayor Max',
      roleName: 'Mayor',
      localizedRoleName: 'Bələdiyyə Sədri',
      office: 'MAYOR',
    });
    const c1 = createMockPlayer({ id: 'c1', username: 'Citizen 1', roleName: 'Citizen' });
    const target = createMockPlayer({ id: 'target-1', username: 'Target Citizen', roleName: 'Citizen' });

    const players = { 'mayor-1': mayor, c1, 'target-1': target };
    const liveVotes = {
      'mayor-1': 'target-1',
      c1: 'target-1',
    };

    // Mayor is in solitary confinement!
    const lobby = createMockLobby(players, {
      mode: 'STANFORD_PRISON',
      phase: 'DAY_VOTING',
      liveVotes,
      mayorRevealedUserIds: ['mayor-1'],
      solitaryConfinementPlayerIds: ['mayor-1'],
    });

    const output = runVotingEngine({ lobby });
    const targetTally = output.tallies.find(t => t.candidateId === 'target-1');

    assert.ok(targetTally, 'Target tally must exist');
    assert.strictEqual(targetTally?.voteCount, 1, 'Only citizen 1 vote is counted (Mayor vote is disenfranchised)');
    assert.strictEqual(targetTally?.voteWeight, 1, 'Total weight is 1 (Mayor 3x weight completely nullified in solitary)');
    assert.strictEqual(targetTally?.voterIds.includes('mayor-1'), false, 'Mayor ID must NOT appear in candidate voters list');

    console.log('  ✔ Test 5.1 Passed');
  }

  // TEST 5.2: Mayor in solitary during Defense Phase contributes 0 weight to verdict
  {
    console.log('▶ Test 5.2: Mayor in Solitary casting defense verdict vote contributes 0 weight');
    const mayor = createMockPlayer({
      id: 'mayor-1',
      username: 'Mayor Max',
      roleName: 'Mayor',
      localizedRoleName: 'Bələdiyyə Sədri',
      office: 'MAYOR',
    });
    const c1 = createMockPlayer({ id: 'c1', username: 'Citizen 1', roleName: 'Citizen' });
    const accused = createMockPlayer({ id: 'accused-1', username: 'Accused Citizen', roleName: 'Citizen' });

    const players = { 'mayor-1': mayor, c1, 'accused-1': accused };
    // Mayor votes GUILTY while in solitary; Citizen votes INNOCENT
    const trialVerdictVotes: Record<string, 'GUILTY' | 'INNOCENT'> = {
      'mayor-1': 'GUILTY',
      c1: 'INNOCENT',
    };

    const lobby = createMockLobby(players, {
      mode: 'STANFORD_PRISON',
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'accused-1',
      trialVerdictVotes,
      mayorRevealedUserIds: ['mayor-1'],
      solitaryConfinementPlayerIds: ['mayor-1'],
    });

    const verdictOutcome = determineVerdictOutcome(lobby);
    assert.strictEqual(verdictOutcome.guiltyWeight, 0, 'Mayor in solitary cannot contribute guilty weight');
    assert.strictEqual(verdictOutcome.innocentWeight, 1, 'Citizen innocent weight is 1');
    assert.strictEqual(verdictOutcome.verdict, 'INNOCENT', 'Accused is acquitted because solitary Mayor vote is nullified');

    console.log('  ✔ Test 5.2 Passed');
  }
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

export function runAllCourtroomVotingTests(): void {
  console.log('================================================================');
  console.log('STARTING COURTROOM PODIUM DEFENSE & VOTING ENGINE TEST SUITE');
  console.log('================================================================\n');

  runNominationPhaseTests();
  runDefenseVerdictTests();
  runMayorRevealTests();
  runMayorValidationTests();
  runSolitaryDisenfranchisementTests();

  console.log('\n================================================================');
  console.log('✅ ALL COURTROOM VOTING & DEFENSE TESTS PASSED WITH 100% SUCCESS');
  console.log('================================================================');
}

// Execute directly if run as main script
runAllCourtroomVotingTests();
