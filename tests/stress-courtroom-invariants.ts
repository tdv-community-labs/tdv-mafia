/**
 * Empirical Stress Harness & Invariant Challenge Suite: Courtroom & Voting Engine
 *
 * Authored by: challenger_m2_2 (Milestone 2 Invariant Challenger)
 * Scope:
 *   1. Accused disconnect during TRIAL_DEFENSE
 *   2. Trial acquittal transitions & absence of dangling accused state
 *   3. Jester conviction victory trigger & immediate transition to ENDED
 *   4. Mayor reveal idempotency across multiple invocations, arrays, and game modes
 *   5. Multi-round courtroom state machine fuzzing (100 randomized rounds)
 */

import assert from 'node:assert';
import {
  getVoterWeight,
  runVotingEngine,
  determineVerdictOutcome,
  executeMayorReveal,
  castVerdictVote,
  isMayor,
} from '../src/server/engine/voting-engine';
import {
  nextPhaseAfter,
  computePhaseDuration,
  evaluateWinCondition,
  executePhaseTransition,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  disconnectedAt?: number | null;
  isAiBotControlled?: boolean;
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
    disconnectedAt: opts.disconnectedAt ?? null,
    isAiBotControlled: opts.isAiBotControlled ?? false,
  };
}

function makeLobby(
  lobbyId: string,
  players: Record<string, PlayerSession>,
  opts?: {
    mode?: 'BLITZ' | 'ALL_IN' | 'STANFORD_PRISON' | 'DANTES_INFERNO';
    phase?: GamePhase;
    liveVotes?: Record<string, string>;
    trialVerdictVotes?: Record<string, 'GUILTY' | 'INNOCENT'>;
    accusedPlayerId?: string | null;
    mayorRevealedUserIds?: readonly string[];
    solitaryConfinementPlayerIds?: readonly string[];
    roundNumber?: number;
    lastLynchedUserId?: string | null;
  }
): LobbyState {
  const hostId = Object.keys(players)[0] ?? 'p1';
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
    },
    roundNumber: opts?.roundNumber ?? 1,
    lastLynchedUserId: opts?.lastLynchedUserId ?? null,
    globalNightKillCap: 5,
    chatMessages: [],
  };
}

// ============================================================================
// SUITE 1: ACCUSED DISCONNECT DURING TRIAL_DEFENSE
// ============================================================================

function testAccusedDisconnectScenarios(): void {
  console.log('--- [Suite 1] Accused Disconnect During TRIAL_DEFENSE ---');

  // Test 1.1: Accused disconnects before verdict; jurors vote GUILTY -> Conviction, elimination, clean night transition
  {
    console.log('▶ Test 1.1: Accused disconnects before verdict; jurors convict GUILTY');
    const accused = makePlayer({
      id: 'accused-dc',
      username: 'DisconnectedSuspect',
      roleName: 'Mafia',
      faction: 'MAFIA',
      disconnectedAt: Date.now() - 5000,
    });
    const j1 = makePlayer({ id: 'j1', username: 'Juror1', roleName: 'Citizen' });
    const j2 = makePlayer({ id: 'j2', username: 'Juror2', roleName: 'Citizen' });
    const j3 = makePlayer({ id: 'j3', username: 'Juror3', roleName: 'Citizen' });
    const j4 = makePlayer({ id: 'j4', username: 'Juror4', roleName: 'Citizen' });
    const m2 = makePlayer({ id: 'm2', username: 'MafiaPartner', roleName: 'Mafia', faction: 'MAFIA' });

    // 6 players total (4 Town, 2 Mafia). Quorum for guilt: j1, j2, j3 vote GUILTY.
    const lobby = makeLobby('lobby-dc-1', { 'accused-dc': accused, j1, j2, j3, j4, m2 }, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'accused-dc',
      trialVerdictVotes: { j1: 'GUILTY', j2: 'GUILTY', j3: 'GUILTY' },
    });

    // 1. Verdict evaluation handles disconnected accused cleanly
    const verdict = determineVerdictOutcome(lobby);
    assert.strictEqual(verdict.verdict, 'GUILTY');
    assert.strictEqual(verdict.convictedPlayerId, 'accused-dc');

    // 2. State transition via inMemoryLobbyStore executes conviction and cleans up
    (inMemoryLobbyStore as any).lobbies.set('lobby-dc-1', lobby);
    const transitionRes = executePhaseTransition({ lobbyId: 'lobby-dc-1' });
    assert.ok(transitionRes, 'Transition must succeed');
    assert.strictEqual(transitionRes.toPhase, 'NIGHT_BUFFER');

    const updatedLobby = inMemoryLobbyStore.getLobby('lobby-dc-1');
    assert.ok(updatedLobby);
    assert.strictEqual(updatedLobby.players['accused-dc'].isAlive, false, 'Convicted disconnected accused must be dead');
    assert.strictEqual(updatedLobby.accusedPlayerId, null, 'accusedPlayerId must be null after conviction');
    assert.deepStrictEqual(updatedLobby.trialVerdictVotes, {}, 'trialVerdictVotes must be empty');
    assert.strictEqual(updatedLobby.lastLynchedUserId, 'accused-dc');
    console.log('  ✔ Test 1.1 Passed');
  }

  // Test 1.2: Accused disconnects before verdict; jurors vote INNOCENT -> Acquittal, survives, clean night transition
  {
    console.log('▶ Test 1.2: Accused disconnects before verdict; jurors acquit INNOCENT');
    const accused = makePlayer({
      id: 'accused-dc',
      username: 'DisconnectedSuspect',
      roleName: 'Citizen',
      faction: 'TOWN',
      disconnectedAt: Date.now() - 10000,
    });
    const j1 = makePlayer({ id: 'j1', username: 'Juror1', roleName: 'Citizen' });
    const j2 = makePlayer({ id: 'j2', username: 'Juror2', roleName: 'Citizen' });
    const m1 = makePlayer({ id: 'm1', username: 'Mafia1', roleName: 'Mafia', faction: 'MAFIA' });

    const lobby = makeLobby('lobby-dc-2', { 'accused-dc': accused, j1, j2, m1 }, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'accused-dc',
      trialVerdictVotes: { j1: 'INNOCENT', j2: 'INNOCENT' },
    });

    const verdict = determineVerdictOutcome(lobby);
    assert.strictEqual(verdict.verdict, 'INNOCENT');
    assert.strictEqual(verdict.convictedPlayerId, null);

    (inMemoryLobbyStore as any).lobbies.set('lobby-dc-2', lobby);
    const transitionRes = executePhaseTransition({ lobbyId: 'lobby-dc-2' });
    assert.ok(transitionRes);
    assert.strictEqual(transitionRes.toPhase, 'NIGHT_BUFFER');

    const updatedLobby = inMemoryLobbyStore.getLobby('lobby-dc-2');
    assert.ok(updatedLobby);
    assert.strictEqual(updatedLobby.players['accused-dc'].isAlive, true, 'Acquitted disconnected accused must remain ALIVE');
    assert.strictEqual(updatedLobby.accusedPlayerId, null, 'accusedPlayerId must be cleared');
    assert.deepStrictEqual(updatedLobby.trialVerdictVotes, {}, 'trialVerdictVotes must be cleared');
    assert.strictEqual(updatedLobby.lastLynchedUserId, null, 'lastLynchedUserId must be null');
    console.log('  ✔ Test 1.2 Passed');
  }

  // Test 1.3: Accused attempts to vote on podium (whether connected or disconnected) -> REJECTED
  {
    console.log('▶ Test 1.3: Accused attempts to cast verdict vote on self -> Rejected');
    const accused = makePlayer({ id: 'accused-1', username: 'Suspect', roleName: 'Citizen' });
    const lobby = makeLobby('lobby-dc-3', { 'accused-1': accused }, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'accused-1',
    });

    const voteRes = castVerdictVote(lobby, 'accused-1', 'INNOCENT');
    assert.strictEqual(voteRes.success, false);
    assert.strictEqual(voteRes.error, 'ACCUSED_CANNOT_VOTE');
    assert.deepStrictEqual(voteRes.updatedLobby.trialVerdictVotes, {});
    console.log('  ✔ Test 1.3 Passed');
  }

  // Test 1.4: Accused disconnects, jurors deadlock (TIE 1 vs 1) -> Presumption of innocence acquits accused
  {
    console.log('▶ Test 1.4: Accused disconnects, jurors deadlock on tie -> Acquitted by presumption of innocence');
    const accused = makePlayer({
      id: 'accused-dc',
      username: 'Suspect',
      roleName: 'Citizen',
      disconnectedAt: Date.now() - 3000,
    });
    const j1 = makePlayer({ id: 'j1', username: 'Juror1', roleName: 'Citizen' });
    const j2 = makePlayer({ id: 'j2', username: 'Juror2', roleName: 'Citizen' });
    const m1 = makePlayer({ id: 'm1', username: 'Mafia1', roleName: 'Mafia', faction: 'MAFIA' });

    const lobby = makeLobby('lobby-dc-4', { 'accused-dc': accused, j1, j2, m1 }, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'accused-dc',
      trialVerdictVotes: { j1: 'GUILTY', j2: 'INNOCENT' },
    });

    const verdict = determineVerdictOutcome(lobby);
    assert.strictEqual(verdict.verdict, 'INNOCENT', 'Tie verdict must be INNOCENT');
    assert.strictEqual(verdict.reason, 'TIE');

    (inMemoryLobbyStore as any).lobbies.set('lobby-dc-4', lobby);
    const transitionRes = executePhaseTransition({ lobbyId: 'lobby-dc-4' });
    assert.ok(transitionRes);
    assert.strictEqual(transitionRes.toPhase, 'NIGHT_BUFFER');

    const updatedLobby = inMemoryLobbyStore.getLobby('lobby-dc-4');
    assert.ok(updatedLobby);
    assert.strictEqual(updatedLobby.players['accused-dc'].isAlive, true);
    assert.strictEqual(updatedLobby.accusedPlayerId, null);
    console.log('  ✔ Test 1.4 Passed');
  }

  // Test 1.5: 0 votes cast before 30s timer expiry -> NO_VOTES -> Acquittal
  {
    console.log('▶ Test 1.5: Zero votes cast during defense -> Acquittal by NO_VOTES');
    const accused = makePlayer({ id: 'accused-dc', username: 'Suspect', roleName: 'Citizen' });
    const j1 = makePlayer({ id: 'j1', username: 'Juror1', roleName: 'Citizen' });
    const m1 = makePlayer({ id: 'm1', username: 'Mafia1', roleName: 'Mafia', faction: 'MAFIA' });

    const lobby = makeLobby('lobby-dc-5', { 'accused-dc': accused, j1, m1 }, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'accused-dc',
      trialVerdictVotes: {},
    });

    const verdict = determineVerdictOutcome(lobby);
    assert.strictEqual(verdict.verdict, 'INNOCENT');
    assert.strictEqual(verdict.reason, 'NO_VOTES');
    assert.strictEqual(verdict.convictedPlayerId, null);

    (inMemoryLobbyStore as any).lobbies.set('lobby-dc-5', lobby);
    const transitionRes = executePhaseTransition({ lobbyId: 'lobby-dc-5' });
    assert.ok(transitionRes);
    assert.strictEqual(transitionRes.toPhase, 'NIGHT_BUFFER');

    const updatedLobby = inMemoryLobbyStore.getLobby('lobby-dc-5');
    assert.ok(updatedLobby);
    assert.strictEqual(updatedLobby.players['accused-dc'].isAlive, true);
    assert.strictEqual(updatedLobby.accusedPlayerId, null);
    console.log('  ✔ Test 1.5 Passed');
  }
}

// ============================================================================
// SUITE 2: ACQUITTAL TRANSITIONS & DANGLING STATE VERIFICATION
// ============================================================================

function testAcquittalTransitions(): void {
  console.log('--- [Suite 2] Acquittal Transitions & Dangling State Verification ---');

  // Test 2.1: Explicit field check after acquittal
  {
    console.log('▶ Test 2.1: Acquittal clears accusedPlayerId, trialVerdictVotes, and lastLynchedUserId');
    const accused = makePlayer({ id: 'accused-1', username: 'AccusedOne', roleName: 'Citizen' });
    const j1 = makePlayer({ id: 'j1', username: 'Juror1', roleName: 'Citizen' });
    const m1 = makePlayer({ id: 'm1', username: 'Mafia1', roleName: 'Mafia', faction: 'MAFIA' });

    const lobby = makeLobby('lobby-acq-1', { 'accused-1': accused, j1, m1 }, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'accused-1',
      trialVerdictVotes: { j1: 'INNOCENT' },
    });

    (inMemoryLobbyStore as any).lobbies.set('lobby-acq-1', lobby);
    const transitionRes = executePhaseTransition({ lobbyId: 'lobby-acq-1' });
    assert.ok(transitionRes);
    assert.strictEqual(transitionRes.toPhase, 'NIGHT_BUFFER');

    const updated = inMemoryLobbyStore.getLobby('lobby-acq-1');
    assert.ok(updated);
    assert.strictEqual(updated.accusedPlayerId, null, 'accusedPlayerId must be null');
    assert.deepStrictEqual(updated.trialVerdictVotes, {}, 'trialVerdictVotes must be empty object');
    assert.strictEqual(updated.lastLynchedUserId, null, 'lastLynchedUserId must be null');
    assert.strictEqual(updated.players['accused-1'].isAlive, true, 'Accused remains alive');
    console.log('  ✔ Test 2.1 Passed');
  }

  // Test 2.2: Full cycle through store: Day 1 Nomination -> Defense -> Acquittal -> Night -> Day 2
  {
    console.log('▶ Test 2.2: Full multi-phase cycle: Nomination -> Defense -> Acquittal -> Night -> Day 2');
    const p1 = makePlayer({ id: 'p1', username: 'Alice', roleName: 'Citizen' });
    const p2 = makePlayer({ id: 'p2', username: 'Bob', roleName: 'Citizen' });
    const p3 = makePlayer({ id: 'p3', username: 'Charlie', roleName: 'Citizen' });
    const m1 = makePlayer({ id: 'm1', username: 'MafiaBoss', roleName: 'Mafia', faction: 'MAFIA' });

    // Step 1: Day Voting with majority for p2
    const lobby = makeLobby('lobby-cycle-1', { p1, p2, p3, m1 }, {
      phase: 'DAY_VOTING',
      liveVotes: { p1: 'p2', p3: 'p2', m1: 'p2' }, // 3 votes for p2 (majority of 4 is 3)
    });
    (inMemoryLobbyStore as any).lobbies.set('lobby-cycle-1', lobby);

    // Transition 1: DAY_VOTING -> TRIAL_DEFENSE
    const toDefense = executePhaseTransition({ lobbyId: 'lobby-cycle-1' });
    assert.ok(toDefense);
    assert.strictEqual(toDefense.toPhase, 'TRIAL_DEFENSE');

    let cur = inMemoryLobbyStore.getLobby('lobby-cycle-1')!;
    assert.strictEqual(cur.accusedPlayerId, 'p2', 'Accused must be set to p2');
    assert.strictEqual(cur.players['p2'].isAlive, true, 'p2 still alive on podium');

    // Jurors cast acquittal votes
    const v1 = castVerdictVote(cur, 'p1', 'INNOCENT');
    const v2 = castVerdictVote(v1.updatedLobby, 'p3', 'INNOCENT');
    inMemoryLobbyStore.updateLobby('lobby-cycle-1', () => v2.updatedLobby);
    cur = inMemoryLobbyStore.getLobby('lobby-cycle-1')!;

    // Transition 2: TRIAL_DEFENSE -> NIGHT_BUFFER (Acquittal)
    const toNight = executePhaseTransition({ lobbyId: 'lobby-cycle-1' });
    assert.ok(toNight);
    assert.strictEqual(toNight.toPhase, 'NIGHT_BUFFER');

    cur = inMemoryLobbyStore.getLobby('lobby-cycle-1')!;
    assert.strictEqual(cur.accusedPlayerId, null, 'accusedPlayerId must be null');
    assert.strictEqual(cur.lastLynchedUserId, null, 'No lynched user recorded');
    assert.strictEqual(cur.players['p2'].isAlive, true, 'p2 survived trial');

    // Transition 3: NIGHT_BUFFER -> DAY_CENTRAL_ASSEMBLY (Day 2)
    const toDay2 = executePhaseTransition({ lobbyId: 'lobby-cycle-1' });
    assert.ok(toDay2);
    assert.strictEqual(toDay2.toPhase, 'DAY_CENTRAL_ASSEMBLY');

    cur = inMemoryLobbyStore.getLobby('lobby-cycle-1')!;
    assert.strictEqual(cur.accusedPlayerId, null, 'accusedPlayerId remains null on Day 2');
    assert.deepStrictEqual(cur.trialVerdictVotes, {}, 'trialVerdictVotes remains empty on Day 2');

    console.log('  ✔ Test 2.2 Passed');
  }

  // Test 2.3: Re-nomination invariant: Player acquitted on Day 1 can be re-indicted on Day 2
  {
    console.log('▶ Test 2.3: Re-nomination invariant: Acquitted player can be re-indicted on Day 2');
    const p1 = makePlayer({ id: 'p1', username: 'Alice', roleName: 'Citizen' });
    const p2 = makePlayer({ id: 'p2', username: 'Bob', roleName: 'Citizen' });
    const p3 = makePlayer({ id: 'p3', username: 'Charlie', roleName: 'Citizen' });
    const p4 = makePlayer({ id: 'p4', username: 'David', roleName: 'Citizen' });
    const m1 = makePlayer({ id: 'm1', username: 'MafiaBoss', roleName: 'Mafia', faction: 'MAFIA' });

    // 5 players (4 Town, 1 Mafia). Start Day 2 Voting where p2 is nominated AGAIN
    const lobby = makeLobby('lobby-cycle-2', { p1, p2, p3, p4, m1 }, {
      phase: 'DAY_VOTING',
      liveVotes: { p1: 'p2', p3: 'p2', m1: 'p2' },
      roundNumber: 2,
    });
    (inMemoryLobbyStore as any).lobbies.set('lobby-cycle-2', lobby);

    const toDefense2 = executePhaseTransition({ lobbyId: 'lobby-cycle-2' });
    assert.ok(toDefense2);
    assert.strictEqual(toDefense2.toPhase, 'TRIAL_DEFENSE');

    let cur = inMemoryLobbyStore.getLobby('lobby-cycle-2')!;
    assert.strictEqual(cur.accusedPlayerId, 'p2', 'p2 successfully re-indicted');

    // This time jurors vote GUILTY
    const g1 = castVerdictVote(cur, 'p1', 'GUILTY');
    const g2 = castVerdictVote(g1.updatedLobby, 'p3', 'GUILTY');
    inMemoryLobbyStore.updateLobby('lobby-cycle-2', () => g2.updatedLobby);

    const toNight2 = executePhaseTransition({ lobbyId: 'lobby-cycle-2' });
    assert.ok(toNight2);
    assert.strictEqual(toNight2.toPhase, 'NIGHT_BUFFER');

    cur = inMemoryLobbyStore.getLobby('lobby-cycle-2')!;
    assert.strictEqual(cur.players['p2'].isAlive, false, 'p2 convicted and eliminated on Day 2');
    assert.strictEqual(cur.lastLynchedUserId, 'p2');
    assert.strictEqual(cur.accusedPlayerId, null);
    console.log('  ✔ Test 2.3 Passed');
  }
}

// ============================================================================
// SUITE 3: JESTER CONVICTION & IMMEDIATE GAME ENDED INVARIANT
// ============================================================================

function testJesterConvictionScenarios(): void {
  console.log('--- [Suite 3] Jester Conviction & Immediate Game ENDED Invariant ---');

  // Test 3.1: Jester convicted by GUILTY verdict -> Triggers JESTER_LUCIFER_SHADOW and immediate ENDED phase
  {
    console.log('▶ Test 3.1: Jester convicted by GUILTY verdict -> ENDED phase with Jester victory');
    const jester = makePlayer({
      id: 'jester-1',
      username: 'Jester',
      roleName: 'Jester',
      localizedRoleName: 'Dəli (Jester)',
      faction: 'NEUTRAL_EVIL',
    });
    const c1 = makePlayer({ id: 'c1', username: 'Citizen1', roleName: 'Citizen' });
    const c2 = makePlayer({ id: 'c2', username: 'Citizen2', roleName: 'Citizen' });
    const m1 = makePlayer({ id: 'm1', username: 'Mafia1', roleName: 'Mafia', faction: 'MAFIA' });

    const lobby = makeLobby('lobby-jester-1', { 'jester-1': jester, c1, c2, m1 }, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'jester-1',
      trialVerdictVotes: { c1: 'GUILTY', c2: 'GUILTY' },
    });
    (inMemoryLobbyStore as any).lobbies.set('lobby-jester-1', lobby);

    const transitionRes = executePhaseTransition({ lobbyId: 'lobby-jester-1' });
    assert.ok(transitionRes);
    assert.strictEqual(transitionRes.toPhase, 'ENDED', 'Jester conviction must immediately end game');
    assert.strictEqual(transitionRes.winCondition?.kind, 'JESTER_LUCIFER_SHADOW');
    assert.deepStrictEqual(transitionRes.winCondition?.winnerPlayerIds, ['jester-1']);

    const finalLobby = inMemoryLobbyStore.getLobby('lobby-jester-1')!;
    assert.strictEqual(finalLobby.phase, 'ENDED');
    assert.strictEqual(finalLobby.players['jester-1'].isAlive, false, 'Jester is dead (lynched)');
    assert.strictEqual(finalLobby.lastLynchedUserId, 'jester-1');
    console.log('  ✔ Test 3.1 Passed');
  }

  // Test 3.2: Jester acquitted by INNOCENT verdict -> Game does NOT end, moves to NIGHT_BUFFER
  {
    console.log('▶ Test 3.2: Jester acquitted by INNOCENT verdict -> Game continues to NIGHT_BUFFER');
    const jester = makePlayer({
      id: 'jester-1',
      username: 'Jester',
      roleName: 'Jester',
      localizedRoleName: 'Dəli (Jester)',
      faction: 'NEUTRAL_EVIL',
    });
    const c1 = makePlayer({ id: 'c1', username: 'Citizen1', roleName: 'Citizen' });
    const c2 = makePlayer({ id: 'c2', username: 'Citizen2', roleName: 'Citizen' });
    const m1 = makePlayer({ id: 'm1', username: 'Mafia1', roleName: 'Mafia', faction: 'MAFIA' });

    const lobby = makeLobby('lobby-jester-2', { 'jester-1': jester, c1, c2, m1 }, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'jester-1',
      trialVerdictVotes: { c1: 'INNOCENT', c2: 'INNOCENT' },
    });
    (inMemoryLobbyStore as any).lobbies.set('lobby-jester-2', lobby);

    const transitionRes = executePhaseTransition({ lobbyId: 'lobby-jester-2' });
    assert.ok(transitionRes);
    assert.strictEqual(transitionRes.toPhase, 'NIGHT_BUFFER', 'Acquitted Jester does NOT end game');
    assert.strictEqual(transitionRes.winCondition?.kind, 'GAME_CONTINUES');

    const finalLobby = inMemoryLobbyStore.getLobby('lobby-jester-2')!;
    assert.strictEqual(finalLobby.players['jester-1'].isAlive, true, 'Jester is still alive');
    assert.strictEqual(finalLobby.lastLynchedUserId, null);
    console.log('  ✔ Test 3.2 Passed');
  }

  // Test 3.3: Jester tied verdict -> Presumption of innocence -> Acquittal -> NIGHT_BUFFER (no win)
  {
    console.log('▶ Test 3.3: Jester tied verdict -> Acquittal -> NIGHT_BUFFER');
    const jester = makePlayer({
      id: 'jester-1',
      username: 'Jester',
      roleName: 'Jester',
      faction: 'NEUTRAL_EVIL',
    });
    const c1 = makePlayer({ id: 'c1', username: 'Citizen1', roleName: 'Citizen' });
    const c2 = makePlayer({ id: 'c2', username: 'Citizen2', roleName: 'Citizen' });
    const m1 = makePlayer({ id: 'm1', username: 'Mafia1', roleName: 'Mafia', faction: 'MAFIA' });

    const lobby = makeLobby('lobby-jester-3', { 'jester-1': jester, c1, c2, m1 }, {
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'jester-1',
      trialVerdictVotes: { c1: 'GUILTY', c2: 'INNOCENT' },
    });
    (inMemoryLobbyStore as any).lobbies.set('lobby-jester-3', lobby);

    const transitionRes = executePhaseTransition({ lobbyId: 'lobby-jester-3' });
    assert.ok(transitionRes);
    assert.strictEqual(transitionRes.toPhase, 'NIGHT_BUFFER', 'Tied Jester trial acquits without win');

    const finalLobby = inMemoryLobbyStore.getLobby('lobby-jester-3')!;
    assert.strictEqual(finalLobby.players['jester-1'].isAlive, true);
    console.log('  ✔ Test 3.3 Passed');
  }

  // Test 3.4: Jester convicted in Dante CIRCLE_9_TREACHERY -> Lucifer's Shadow victory
  {
    console.log('▶ Test 3.4: Jester convicted in Dante Treachery circle -> Lucifer Shadow victory');
    const jester = makePlayer({
      id: 'jester-dante',
      username: 'DanteJester',
      roleName: 'Jester',
      faction: 'NEUTRAL_EVIL',
    });
    const c1 = makePlayer({ id: 'c1', username: 'Citizen1', roleName: 'Citizen' });
    const c2 = makePlayer({ id: 'c2', username: 'Citizen2', roleName: 'Citizen' });
    const m1 = makePlayer({ id: 'm1', username: 'Mafia1', roleName: 'Mafia', faction: 'MAFIA' });

    const lobby = makeLobby('lobby-jester-4', { 'jester-dante': jester, c1, c2, m1 }, {
      mode: 'DANTES_INFERNO',
      phase: 'TRIAL_DEFENSE',
      accusedPlayerId: 'jester-dante',
      trialVerdictVotes: { c1: 'GUILTY', c2: 'GUILTY' },
    });
    (inMemoryLobbyStore as any).lobbies.set('lobby-jester-4', lobby);

    const transitionRes = executePhaseTransition({ lobbyId: 'lobby-jester-4' });
    assert.ok(transitionRes);
    assert.strictEqual(transitionRes.toPhase, 'ENDED');
    assert.strictEqual(transitionRes.winCondition?.kind, 'JESTER_LUCIFER_SHADOW');
    console.log('  ✔ Test 3.4 Passed');
  }
}

// ============================================================================
// SUITE 4: MAYOR REVEAL IDEMPOTENCY & WEIGHT ROBUSTNESS
// ============================================================================

function testMayorRevealIdempotency(): void {
  console.log('--- [Suite 4] Mayor Reveal Idempotency & Weight Robustness ---');

  // Test 4.1: Repeated executeMayorReveal is completely idempotent
  {
    console.log('▶ Test 4.1: Repeated executeMayorReveal is strictly idempotent');
    const mayor = makePlayer({
      id: 'mayor-1',
      username: 'RealMayor',
      roleName: 'Mayor',
      localizedRoleName: 'Bələdiyyə Sədri',
      office: 'MAYOR',
    });
    const lobby = makeLobby('lobby-mayor-1', { 'mayor-1': mayor });

    // Call 1: First reveal succeeds
    const res1 = executeMayorReveal(lobby, 'mayor-1');
    assert.strictEqual(res1.success, true);
    assert.deepStrictEqual(res1.updatedLobby.mayorRevealedUserIds, ['mayor-1']);

    // Call 2: Second reveal fails cleanly with ALREADY_REVEALED, does not mutate array
    const res2 = executeMayorReveal(res1.updatedLobby, 'mayor-1');
    assert.strictEqual(res2.success, false);
    assert.strictEqual(res2.error, 'ALREADY_REVEALED');
    assert.deepStrictEqual(res2.updatedLobby.mayorRevealedUserIds, ['mayor-1'], 'Array must not have duplicates');

    // Call 3: Third reveal fails identically
    const res3 = executeMayorReveal(res2.updatedLobby, 'mayor-1');
    assert.strictEqual(res3.success, false);
    assert.strictEqual(res3.error, 'ALREADY_REVEALED');
    assert.deepStrictEqual(res3.updatedLobby.mayorRevealedUserIds, ['mayor-1']);
    console.log('  ✔ Test 4.1 Passed');
  }

  // Test 4.2: Adversarial input: Array containing 10 duplicate Mayor IDs passed to getVoterWeight
  {
    console.log('▶ Test 4.2: Array with 10 duplicate IDs passed to getVoterWeight -> strictly 3x, not 3^10');
    const mayor = makePlayer({
      id: 'mayor-1',
      username: 'RealMayor',
      roleName: 'Mayor',
      office: 'MAYOR',
    });

    const adversarialDuplicates = Array(10).fill('mayor-1');
    const weightStandard = getVoterWeight(mayor, false, adversarialDuplicates);
    assert.strictEqual(weightStandard, 3, 'Standard weight must strictly be 3 (not 30 or 3^10)');

    const weightAllIn = getVoterWeight(mayor, true, adversarialDuplicates);
    assert.strictEqual(weightAllIn, 9, 'All-In weight must strictly be 9 ((1+2)*3, not exponential)');
    console.log('  ✔ Test 4.2 Passed');
  }

  // Test 4.3: Impostor username with "Mayor" substring cannot reveal or gain 3x weight
  {
    console.log('▶ Test 4.3: Impostor with "Mayor" in username cannot reveal or gain weight');
    const impostor = makePlayer({
      id: 'fake-mayor',
      username: 'MayorOfBaku',
      roleName: 'Citizen',
      localizedRoleName: 'Vətəndaş',
      office: 'PUBLIC_DEFENDER',
    });
    const lobby = makeLobby('lobby-mayor-fake', { 'fake-mayor': impostor });

    assert.strictEqual(isMayor(impostor), false, 'isMayor must check role/office, NOT username');

    const revealRes = executeMayorReveal(lobby, 'fake-mayor');
    assert.strictEqual(revealRes.success, false);
    assert.strictEqual(revealRes.error, 'NOT_A_MAYOR');

    // Even if maliciously injected into mayorRevealedUserIds
    const maliciousWeight = getVoterWeight(impostor, false, ['fake-mayor']);
    assert.strictEqual(maliciousWeight, 1, 'Injected fake mayor ID must NOT gain 3x multiplier');
    console.log('  ✔ Test 4.3 Passed');
  }

  // Test 4.4: Dead Mayor cannot reveal or vote (weight 0)
  {
    console.log('▶ Test 4.4: Dead Mayor reveal fails and vote weight is 0');
    const deadMayor = makePlayer({
      id: 'dead-mayor',
      username: 'LateMayor',
      roleName: 'Mayor',
      office: 'MAYOR',
      isAlive: false,
    });
    const lobby = makeLobby('lobby-mayor-dead', { 'dead-mayor': deadMayor });

    const revealRes = executeMayorReveal(lobby, 'dead-mayor');
    assert.strictEqual(revealRes.success, false);
    assert.strictEqual(revealRes.error, 'PLAYER_NOT_ALIVE');

    const weight = getVoterWeight(deadMayor, false, ['dead-mayor']);
    assert.strictEqual(weight, 0, 'Dead player weight is strictly 0');
    console.log('  ✔ Test 4.4 Passed');
  }

  // Test 4.5: Multiple distinct Mayors reveal independently without collision
  {
    console.log('▶ Test 4.5: Multiple distinct Mayors reveal independently');
    const m1 = makePlayer({ id: 'm1', username: 'Mayor1', roleName: 'Mayor', office: 'MAYOR' });
    const m2 = makePlayer({ id: 'm2', username: 'Mayor2', roleName: 'Mayor', office: 'MAYOR' });
    let lobby = makeLobby('lobby-multi-mayor', { m1, m2 });

    const res1 = executeMayorReveal(lobby, 'm1');
    assert.strictEqual(res1.success, true);
    lobby = res1.updatedLobby;

    const res2 = executeMayorReveal(lobby, 'm2');
    assert.strictEqual(res2.success, true);
    lobby = res2.updatedLobby;

    assert.deepStrictEqual(lobby.mayorRevealedUserIds, ['m1', 'm2']);
    assert.strictEqual(getVoterWeight(m1, false, lobby.mayorRevealedUserIds), 3);
    assert.strictEqual(getVoterWeight(m2, false, lobby.mayorRevealedUserIds), 3);
    console.log('  ✔ Test 4.5 Passed');
  }
}

// ============================================================================
// SUITE 5: MULTI-ROUND COURTROOM STATE MACHINE FUZZING HARNESS
// ============================================================================

function testMultiRoundCourtroomFuzzing(): void {
  console.log('--- [Suite 5] Multi-Round Courtroom State Machine Fuzzing (100 Iterations) ---');

  for (let iter = 1; iter <= 100; iter++) {
    const lobbyId = `fuzz-lobby-${iter}`;

    // Create 6-8 players: 1 mafia, 1 jester, rest citizens
    const pCount = 6 + (iter % 3); // 6 to 8
    const players: Record<string, PlayerSession> = {};
    for (let i = 1; i <= pCount; i++) {
      const pid = `p${i}`;
      let faction: CoreFaction = 'TOWN';
      let roleName = 'Citizen';
      if (i === 1) { faction = 'MAFIA'; roleName = 'Mafia'; }
      else if (i === 2) { faction = 'NEUTRAL_EVIL'; roleName = 'Jester'; }

      players[pid] = makePlayer({
        id: pid,
        username: `Player_${i}`,
        roleName,
        faction,
      });
    }

    // Step 1: In DAY_VOTING, choose random candidate
    const living = Object.values(players).filter(p => p.isAlive);
    const candidate = living[iter % living.length]!.userId;

    // Simulate voting: either majority votes for candidate, or tie, or no votes
    const scenario = iter % 3; // 0: majority, 1: tie, 2: no quorum
    const liveVotes: Record<string, string> = {};

    if (scenario === 0) {
      // Majority for candidate
      for (const p of living) {
        liveVotes[p.userId] = candidate;
      }
    } else if (scenario === 1) {
      // Guaranteed exact 2 vs 2 tie between candidate and candidate 2
      const cand2 = living[(iter + 1) % living.length]!.userId;
      liveVotes[living[0]!.userId] = candidate;
      liveVotes[living[1]!.userId] = candidate;
      liveVotes[living[2]!.userId] = cand2;
      liveVotes[living[3]!.userId] = cand2;
    } // else scenario === 2: no votes

    const lobby = makeLobby(lobbyId, players, {
      phase: 'DAY_VOTING',
      liveVotes,
      roundNumber: iter,
    });
    (inMemoryLobbyStore as any).lobbies.set(lobbyId, lobby);

    // Transition from DAY_VOTING
    const trans1 = executePhaseTransition({ lobbyId });
    assert.ok(trans1);

    if (scenario === 0) {
      // Must enter TRIAL_DEFENSE
      assert.strictEqual(trans1.toPhase, 'TRIAL_DEFENSE', `Iter ${iter}: Majority must transition to TRIAL_DEFENSE`);
      const afterNom = inMemoryLobbyStore.getLobby(lobbyId)!;
      assert.strictEqual(afterNom.accusedPlayerId, candidate, `Iter ${iter}: accusedPlayerId must match nominee`);

      // Now in TRIAL_DEFENSE: decide verdict (GUILTY or INNOCENT)
      const verdictChoice = iter % 2 === 0 ? 'GUILTY' : 'INNOCENT';
      const jurors = living.filter(p => p.userId !== candidate);
      let curDef = afterNom;
      for (const j of jurors) {
        const vRes = castVerdictVote(curDef, j.userId, verdictChoice);
        if (vRes.success) curDef = vRes.updatedLobby;
      }
      inMemoryLobbyStore.updateLobby(lobbyId, () => curDef);

      // Transition from TRIAL_DEFENSE
      const trans2 = executePhaseTransition({ lobbyId });
      assert.ok(trans2);

      const afterDefense = inMemoryLobbyStore.getLobby(lobbyId)!;
      // Invariant checks after TRIAL_DEFENSE:
      assert.strictEqual(afterDefense.accusedPlayerId, null, `Iter ${iter}: accusedPlayerId MUST be null after trial`);
      assert.deepStrictEqual(afterDefense.trialVerdictVotes, {}, `Iter ${iter}: trialVerdictVotes MUST be empty after trial`);

      if (verdictChoice === 'GUILTY') {
        assert.strictEqual(afterDefense.players[candidate].isAlive, false, `Iter ${iter}: Convicted candidate must be dead`);
        assert.strictEqual(afterDefense.lastLynchedUserId, candidate);

        if (candidate === 'p2') {
          // Jester was convicted!
          assert.strictEqual(trans2.toPhase, 'ENDED', `Iter ${iter}: Jester conviction must end game`);
          assert.strictEqual(trans2.winCondition?.kind, 'JESTER_LUCIFER_SHADOW');
        } else if (candidate === 'p1') {
          // Only mafia was killed -> Town victory!
          assert.strictEqual(trans2.toPhase, 'ENDED', `Iter ${iter}: Last killer eliminated must end game with Town victory`);
          assert.strictEqual(trans2.winCondition?.kind, 'TOWN_VICTORY');
        } else {
          // Innocent citizen killed -> Game continues
          assert.strictEqual(trans2.toPhase, 'NIGHT_BUFFER');
        }
      } else {
        // Acquittal
        assert.strictEqual(afterDefense.players[candidate].isAlive, true, `Iter ${iter}: Acquitted candidate must be ALIVE`);
        assert.strictEqual(afterDefense.lastLynchedUserId, null, `Iter ${iter}: lastLynchedUserId must be null on acquittal`);
        assert.strictEqual(trans2.toPhase, 'NIGHT_BUFFER');
      }
    } else {
      // Scenario 1 or 2: No majority -> Must go directly to NIGHT_BUFFER
      assert.strictEqual(trans1.toPhase, 'NIGHT_BUFFER', `Iter ${iter}: Tie or no-quorum must transition to NIGHT_BUFFER`);
      const afterVote = inMemoryLobbyStore.getLobby(lobbyId)!;
      assert.strictEqual(afterVote.accusedPlayerId, null);
      assert.strictEqual(afterVote.lastLynchedUserId, null);
    }
  }

  console.log('  ✔ All 100 Multi-Round Fuzzing Iterations Passed With 100% Invariant Compliance');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

export function runAllEmpiricalStressTests(): void {
  console.log('================================================================');
  console.log('STARTING EMPIRICAL INVARIANT STRESS TEST HARNESS (CHALLENGER M2)');
  console.log('================================================================\n');

  testAccusedDisconnectScenarios();
  testAcquittalTransitions();
  testJesterConvictionScenarios();
  testMayorRevealIdempotency();
  testMultiRoundCourtroomFuzzing();

  console.log('\n================================================================');
  console.log('🎯 ALL 5 EMPIRICAL INVARIANT STRESS SUITES COMPLETED AND PASSED');
  console.log('================================================================');
}

runAllEmpiricalStressTests();
