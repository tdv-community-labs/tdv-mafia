/**
 * Adversarial Stress Test Suite: AI Bot Social Deduction & Heuristics (Milestone 4)
 * Target: tests/stress-bot-social-deduction.ts
 */

import assert from 'node:assert';
import {
  selectStrategicTarget,
  decideBotNightAction,
  decideBotVote,
  decideBotTrialVerdict,
  generateBotDayDiscussionMessage,
  getBotPersonality,
  BOT_PERSONALITY_PROFILES,
  BotSession,
} from '../src/server/ai/bot-takeover';
import { PlayerSession, LobbyState } from '../src/types/game';
import { CoreFaction, formatRoleDisplay } from '../src/types/roles';
import { InvestigationResult } from '../src/types/engine';

function makePlayer(
  id: string,
  username: string,
  roleName: string,
  faction: CoreFaction,
  isAlive = true
): PlayerSession {
  return {
    socketId: `sock-${id}`,
    userId: id,
    username,
    tier: 'TIER_1',
    adminRole: 'NONE',
    isHost: false,
    isAlive,
    hasHostWaiver: true,
    hasAdminWaiver: false,
    displayRole: formatRoleDisplay(username, roleName, roleName),
    allInIdentity: {
      layer1Faction: faction,
      layer2Office: 'PUBLIC_DEFENDER',
      layer3Trait: 'CONTRABAND_POCKET',
      district: 'COMMERCIAL',
    },
    currentDistrict: 'COMMERCIAL',
    disconnectedAt: null,
    isAiBotControlled: true,
  };
}

function makeLobby(players: Record<string, PlayerSession>, extra?: Partial<LobbyState>): LobbyState {
  const hostId = Object.keys(players)[0] ?? 'host';
  return {
    lobbyId: `stress-lobby-${Date.now()}`,
    hostUserId: hostId,
    mode: 'ALL_IN',
    phase: 'NIGHT_BUFFER',
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
    phaseDurationSeconds: 45,
    phaseTimeRemaining: 45,
    nightJitterDelaySeconds: 4,
    liveVotes: {},
    trialVerdictVotes: {},
    accusedPlayerId: null,
    mayorRevealedUserIds: [],
    speakerQueue: [],
    bufferedNightActions: [],
    minigameSubStates: {},
    roundNumber: 1,
    lastLynchedUserId: null,
    globalNightKillCap: 5,
    latestNewspaper: null,
    pastNewspapers: [],
    privateInvestigations: {},
    chatMessages: [],
    ...extra,
  };
}

async function runAdversarialStressSuite() {
  console.log('================================================================');
  console.log('STARTING ADVERSARIAL STRESS TEST: AI BOT SOCIAL DEDUCTION (M4)');
  console.log('================================================================');

  // ─── STRESS 1: Mixed Large Faction Monte Carlo (1000 trials) ───────────────
  console.log('\n▶ Stress 1: Large Multi-Faction Lobby (5 Mafia, 2 Yakuza, 1 SK, 1 Cult, 10 Town)');
  {
    const players: Record<string, PlayerSession> = {};
    const mafiaIds = new Set<string>();
    const yakuzaIds = new Set<string>();
    const cultIds = new Set<string>();

    for (let i = 1; i <= 5; i++) {
      const id = `mafia-${i}`;
      players[id] = makePlayer(id, `Mafia_${i}`, 'Mafioso', 'MAFIA');
      mafiaIds.add(id);
    }
    for (let i = 1; i <= 2; i++) {
      const id = `yakuza-${i}`;
      players[id] = makePlayer(id, `Yakuza_${i}`, 'Oyabun', 'YAKUZA');
      yakuzaIds.add(id);
    }
    players['sk-1'] = makePlayer('sk-1', 'SerialKiller', 'Serial Killer', 'NEUTRAL_KILLER');
    players['cult-1'] = makePlayer('cult-1', 'Cultist', 'Cult Acolyte', 'VOID_CULT');
    cultIds.add('cult-1');

    for (let i = 1; i <= 10; i++) {
      const id = `town-${i}`;
      players[id] = makePlayer(id, `Townie_${i}`, 'Citizen', 'TOWN');
    }

    const lobby = makeLobby(players);

    for (let t = 0; t < 1000; t++) {
      // Pick random Mafia actor
      const mActorId = `mafia-${(t % 5) + 1}`;
      const mActor = players[mActorId]!;
      const mTarget = selectStrategicTarget(mActor, lobby, 'KILL', null);
      assert.ok(mTarget !== null, `Trial ${t}: Target must not be null`);
      assert.ok(!mafiaIds.has(mTarget), `Trial ${t}: Mafia friendly fire on ${mTarget}!`);
      assert.ok(mTarget !== mActorId, `Trial ${t}: Mafia targeted self!`);
      assert.ok(players[mTarget]?.isAlive, `Trial ${t}: Target must be alive!`);

      // Pick random Yakuza actor
      const yActorId = `yakuza-${(t % 2) + 1}`;
      const yActor = players[yActorId]!;
      const yTarget = selectStrategicTarget(yActor, lobby, 'KILL', null);
      assert.ok(yTarget !== null, `Trial ${t}: Yakuza target must not be null`);
      assert.ok(!yakuzaIds.has(yTarget), `Trial ${t}: Yakuza friendly fire on ${yTarget}!`);
      assert.ok(yTarget !== yActorId, `Trial ${t}: Yakuza targeted self!`);

      // Adversarial test: AI suggests fellow teammate
      const advTeammate = `mafia-${((t + 1) % 5) + 1}`;
      const poisonedTarget = selectStrategicTarget(mActor, lobby, 'KILL', advTeammate);
      assert.ok(!mafiaIds.has(poisonedTarget!), `Trial ${t}: Poisoned AI suggestion triggered friendly fire!`);
    }
    console.log('  ✔ 1,000 mixed Monte Carlo trials passed with 100% zero friendly fire.');
  }

  // ─── STRESS 2: End-Game Exhaustion Dynamics ─────────────────────────────────
  console.log('\n▶ Stress 2: End-Game Exhaustion Dynamics');
  {
    // Subcase 2A: Only 3 Mafia and 1 SK alive
    const playersA: Record<string, PlayerSession> = {
      'm-1': makePlayer('m-1', 'Mafia1', 'Mafia', 'MAFIA'),
      'm-2': makePlayer('m-2', 'Mafia2', 'Mafia', 'MAFIA'),
      'm-3': makePlayer('m-3', 'Mafia3', 'Mafia', 'MAFIA'),
      'sk-1': makePlayer('sk-1', 'SK', 'Serial Killer', 'NEUTRAL_KILLER'),
      't-dead': makePlayer('t-dead', 'DeadTownie', 'Citizen', 'TOWN', false),
    };
    const lobbyA = makeLobby(playersA);
    for (let i = 0; i < 50; i++) {
      const target = selectStrategicTarget(playersA['m-1']!, lobbyA, 'KILL', null);
      assert.strictEqual(target, 'sk-1', 'Mafia must strictly focus on the only remaining enemy (SK)!');
    }
    console.log('  ✔ Subcase 2A passed: Mafia strictly targets lone hostile SK when town is dead.');

    // Subcase 2B: Only 3 Mafia alive
    const playersB: Record<string, PlayerSession> = {
      'm-1': makePlayer('m-1', 'Mafia1', 'Mafia', 'MAFIA'),
      'm-2': makePlayer('m-2', 'Mafia2', 'Mafia', 'MAFIA'),
      'm-3': makePlayer('m-3', 'Mafia3', 'Mafia', 'MAFIA'),
    };
    const lobbyB = makeLobby(playersB);
    const targetB = selectStrategicTarget(playersB['m-1']!, lobbyB, 'KILL', null);
    assert.strictEqual(targetB, null, 'When only teammates remain alive, target must be NULL (zero friendly fire)');
    console.log('  ✔ Subcase 2B passed: Mafia returns null when no enemies remain alive.');
  }

  // ─── STRESS 3: Sheriff 10-Round Exhaustion & History Invariants ─────────────
  console.log('\n▶ Stress 3: Sheriff 10-Round Consecutive Investigation Invariants');
  {
    const sheriff = makePlayer('sheriff', 'Sheriff_Aziz', 'Sheriff', 'TOWN');
    const suspects: Record<string, PlayerSession> = { sheriff };
    for (let i = 1; i <= 10; i++) {
      const id = `suspect-${i}`;
      suspects[id] = makePlayer(id, `Suspect_${i}`, 'Citizen', 'TOWN');
    }

    const investigatedHistory: InvestigationResult[] = [];
    const investigatedOrder: string[] = [];

    // Simulate 10 nights
    for (let round = 1; round <= 10; round++) {
      const lobby = makeLobby(suspects, {
        roundNumber: round,
        privateInvestigations: { sheriff: [...investigatedHistory] },
      });

      const target = selectStrategicTarget(sheriff, lobby, 'INVESTIGATE', null);
      assert.ok(target !== null, `Round ${round}: Sheriff target should not be null`);
      assert.strictEqual(target !== 'sheriff', true, `Round ${round}: Sheriff cannot investigate self`);
      assert.strictEqual(
        investigatedOrder.includes(target),
        false,
        `Round ${round}: Duplicate investigation on ${target}!`
      );

      investigatedOrder.push(target);
      investigatedHistory.push({
        investigatorPlayerId: 'sheriff',
        targetPlayerId: target,
        revealedFaction: 'TOWN',
        isBlurred: round % 3 === 0, // 1/3 of results are blurred by Illusionist
        alternateBlurredFaction: null,
      });
    }

    assert.strictEqual(investigatedOrder.length, 10, 'Sheriff must have checked all 10 suspects');
    assert.strictEqual(new Set(investigatedOrder).size, 10, 'All 10 investigations must be completely unique');
    console.log(`  ✔ 10 rounds executed with 0 duplicate investigations (${investigatedOrder.join(' -> ')})`);

    // Round 11: All suspects investigated
    const lobby11 = makeLobby(suspects, {
      roundNumber: 11,
      privateInvestigations: { sheriff: [...investigatedHistory] },
    });
    const target11 = selectStrategicTarget(sheriff, lobby11, 'INVESTIGATE', null);
    assert.ok(target11 !== null && target11 !== 'sheriff', 'Handles post-exhaustion gracefully');
    console.log('  ✔ Round 11 (full exhaustion) handled gracefully without uncaught exceptions.');
  }

  // ─── STRESS 4: Day Court & Defense Voting Coordination ──────────────────────
  console.log('\n▶ Stress 4: Day Court & Defense Voting Invariants');
  {
    const m1 = makePlayer('m-1', 'Mafia_Leader', 'Godfather', 'MAFIA');
    const m2 = makePlayer('m-2', 'Mafia_Soldier', 'Mafioso', 'MAFIA');
    const tAccused = makePlayer('t-accused', 'Accused_Citizen', 'Citizen', 'TOWN');
    const tAlly = makePlayer('t-ally', 'Doctor_Ally', 'Doctor', 'TOWN');

    // Case 4A: Teammate on podium
    const lobbyPodiumMafia = makeLobby(
      { 'm-1': m1, 'm-2': m2, 't-accused': tAccused, 't-ally': tAlly },
      { phase: 'TRIAL_DEFENSE', accusedPlayerId: 'm-2' }
    );
    const verdictM1OnM2 = decideBotTrialVerdict(m1, lobbyPodiumMafia);
    assert.strictEqual(verdictM1OnM2, 'INNOCENT', 'Mafia MUST vote INNOCENT to defend living teammate on podium');

    // Case 4B: Townie on podium
    const lobbyPodiumTown = makeLobby(
      { 'm-1': m1, 'm-2': m2, 't-accused': tAccused, 't-ally': tAlly },
      { phase: 'TRIAL_DEFENSE', accusedPlayerId: 't-accused' }
    );
    const verdictM1OnTown = decideBotTrialVerdict(m1, lobbyPodiumTown);
    assert.strictEqual(verdictM1OnTown, 'GUILTY', 'Mafia MUST vote GUILTY to execute townie on podium');

    // Case 4C: Mafia Day Voting coordination (votes for leading townie, never teammate)
    const lobbyDayVoting = makeLobby(
      { 'm-1': m1, 'm-2': m2, 't-accused': tAccused, 't-ally': tAlly },
      {
        phase: 'DAY_VOTING',
        liveVotes: { 't-ally': 't-accused' }, // Townie started voting for t-accused
      }
    );
    const m1DayVote = decideBotVote(m1, lobbyDayVoting);
    assert.strictEqual(m1DayVote?.candidateUserId, 't-accused', 'Mafia must coordinate on leading townie candidate');

    console.log('  ✔ Courtroom verdict and day voting coordination verified.');
  }

  // ─── STRESS 5: Procedural Azerbaijani Dialogue Quality & Sanitization ──────
  console.log('\n▶ Stress 5: Procedural Azerbaijani Dialogue Synthesis (500 iterations)');
  {
    const p = makePlayer('p-bot', 'Bot_Vurgun', 'Citizen', 'TOWN');
    const pAccused = makePlayer('p-accused', 'Bot_Taleh', 'Citizen', 'TOWN');
    const lobby = makeLobby({ 'p-bot': p, 'p-accused': pAccused });

    const forbiddenRegex = /\bescort\b|\bmadam\b/i;
    let totalGenerated = 0;

    for (const profile of BOT_PERSONALITY_PROFILES) {
      for (const phase of ['DAY_CENTRAL_ASSEMBLY', 'DAY_VOTING', 'TRIAL_DEFENSE'] as const) {
        for (let run = 0; run < 35; run++) {
          const isPodium = phase === 'TRIAL_DEFENSE' && run % 2 === 0;
          const msg = generateBotDayDiscussionMessage({
            player: isPodium ? pAccused : p,
            lobby: {
              ...lobby,
              phase,
              accusedPlayerId: 'p-accused',
              latestNewspaper: run % 2 === 0 ? {
                publicDeaths: [{ victimPlayerId: 'p-accused', cause: 'MAFIA_KILL', killerFaction: 'MAFIA', isCleaned: false }],
                privateInvestigationResults: [],
                heresyClue: null,
                jitterAppliedMs: 0,
              } : null,
            },
            personality: profile,
            forceFallback: true,
          });

          assert.ok(typeof msg === 'string', 'Generated message must be string');
          assert.ok(msg.length >= 15, `Message too short (${msg.length}): "${msg}"`);
          assert.strictEqual(forbiddenRegex.test(msg), false, `Forbidden word leaked: "${msg}"`);
          totalGenerated++;
        }
      }
    }
    console.log(`  ✔ ${totalGenerated} Azerbaijani dialogues generated across all profiles and phases with zero violations.`);
  }

  console.log('\n================================================================');
  console.log('✅ ALL ADVERSARIAL STRESS INVARIANTS CONFIRMED CLEAN');
  console.log('================================================================\n');
}

runAdversarialStressSuite().catch(err => {
  console.error('❌ STRESS TEST FAILURE:', err);
  process.exit(1);
});
