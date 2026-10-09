import assert from 'assert';
import {
  advanceDantesInfernoCircle,
  tickEarthStoodStill,
  applyWorldFreeze,
  processValkyrieRound,
  processStanfordPrisonRound,
  processCatenaccioRound,
  dispatchMinigamePhaseEvent,
} from '../src/server/engine/minigames-engine';
import {
  createInitialDantesInfernoState,
  createInitialEarthStoodStillState,
  createInitialValkyrieState,
  createInitialStanfordPrisonState,
  createInitialCatenaccioState,
} from '../src/config/minigames.config';
import { generateProceduralStory, generateMorningNewspaperStory } from '../src/server/ai/ai-narrator';
import { runVotingEngine } from '../src/server/engine/voting-engine';
import { evaluateWinCondition } from '../src/server/engine/phase-manager';
import { inMemoryLobbyStore } from '../src/server/state/memory';
import { PlayerSession, LobbyState } from '../src/types/game';
import { NightActionBufferItem } from '../src/types/game';

function createMockPlayer(id: string, name: string, faction: 'TOWN' | 'MAFIA' | 'NEUTRAL_EVIL', isAlive = true): PlayerSession {
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

async function runAllMinigamesTests() {
  console.log('🧪 Starting Minigames & AI Narrator Comprehensive Verification Suite...\n');

  // ─── TEST 1: DANTE'S INFERNO BIFURCATED CIRCLE PROGRESSION & GREED ──────────
  console.log('▶ Test 1: Dante\'s Inferno Bifurcated Progression & Greed Debts');
{
  const players = {
    'p1': createMockPlayer('p1', 'Player 1', 'TOWN'),
    'p2': createMockPlayer('p2', 'Player 2', 'TOWN'),
    'p3': createMockPlayer('p3', 'Player 3', 'MAFIA'),
  };

  let state = createInitialDantesInfernoState();
  assert.strictEqual(state.currentCircle, 'CIRCLE_1_LIMBO');

  // Intra-day phase transition: Limbo (Day) -> DAY_VOTING (Day) should NOT advance to Lust
  let out = advanceDantesInfernoCircle({
    currentState: state,
    phase: 'DAY_VOTING',
    roundNumber: 1,
    publicDeaths: [],
    players,
    greedAbilityUsers: [],
    lynchedPlayerId: null,
  });
  assert.strictEqual(out.updatedState.currentCircle, 'CIRCLE_1_LIMBO', 'Limbo must not advance within Day phases');

  // Day -> Night transition: Limbo (Day) -> NIGHT_BUFFER advances to Circle 2 Lust (Night)
  out = advanceDantesInfernoCircle({
    currentState: state,
    phase: 'NIGHT_BUFFER',
    roundNumber: 1,
    publicDeaths: [],
    players,
    greedAbilityUsers: [],
    lynchedPlayerId: null,
  });
  assert.strictEqual(out.updatedState.currentCircle, 'CIRCLE_2_LUST', 'Must advance to Circle 2 Lust on Night entry');
  assert.strictEqual(out.updatedState.deflectionRate, 0.2, 'Circle 2 Lust has 20% deflection rate');

  // Fast forward to Circle 4 Greed (Night)
  state = {
    ...out.updatedState,
    currentCircle: 'CIRCLE_4_GREED',
  };

  // Player 1 uses a night ability during Greed night
  out = advanceDantesInfernoCircle({
    currentState: state,
    phase: 'NIGHT_BUFFER',
    roundNumber: 2,
    publicDeaths: [],
    players,
    greedAbilityUsers: ['p1'],
    lynchedPlayerId: null,
  });
  assert.strictEqual(out.updatedState.greedVoteCostDebts['p1'], true, 'p1 owes vote debt');

  // Circle 5 Wrath (Day): p1 attempts to vote but is debt-blocked in voting engine
  state = {
    ...out.updatedState,
    currentCircle: 'CIRCLE_5_WRATH',
    wrathNoAbstainEnforced: true,
  };

  const testLobby: LobbyState = {
    lobbyId: 'dante-test-lobby',
    mode: 'BLITZ',
    phase: 'DAY_VOTING',
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
    liveVotes: { 'p1': 'p3', 'p2': 'p3' },
    speakerQueue: [],
    bufferedNightActions: [],
    chatMessages: [],
    minigameSubStates: { dantesInferno: state },
    roundNumber: 3,
    lastLynchedUserId: null,
    globalNightKillCap: 99,
    latestNewspaper: null,
    privateInvestigations: {},
    winnerResult: null,
    stateVersion: 1,
  };

  const votingOut = runVotingEngine({ lobby: testLobby });
  // p1's vote was excluded due to greed debt; only p2's vote counted for p3
  const p3Tally = votingOut.tallies.find(t => t.candidateId === 'p3');
  assert.strictEqual(p3Tally?.voteCount, 1, 'Only 1 vote counted (p1 debt-blocked)');
  assert.deepStrictEqual(p3Tally?.voterIds, ['p2'], 'p1 must be excluded from voters');

  // Once entering Night again, fulfilled greed debts are cleared
  out = advanceDantesInfernoCircle({
    currentState: state,
    phase: 'NIGHT_BUFFER',
    roundNumber: 3,
    publicDeaths: [],
    players,
    greedAbilityUsers: [],
    lynchedPlayerId: null,
  });
  assert.strictEqual(out.updatedState.greedVoteCostDebts['p1'], undefined, 'Fulfilled debt must be cleared on Night entry');
  console.log('  ✔ Dante\'s Inferno bifurcated circle progression & Greed voting debt verified.');
}

// ─── TEST 2: THE DAY THE EARTH STOOD STILL ──────────────────────────────────
console.log('▶ Test 2: The Day The Earth Stood Still (Doomsday Clock, Freeze & Gort)');
{
  const players = {
    'p1': createMockPlayer('p1', 'Player 1', 'TOWN'),
    'p2': createMockPlayer('p2', 'Player 2', 'TOWN'),
    'p3': createMockPlayer('p3', 'Player 3', 'MAFIA'),
  };

  const earthState = createInitialEarthStoodStillState('p1');
  assert.strictEqual(earthState.doomsdayClockHours, 0);

  // Lynching an innocent town player advances doomsday clock +1
  const tickOut = tickEarthStoodStill({
    currentState: earthState,
    innocentsLynchedThisRound: ['p2'],
    klaatuFreezeActivated: false,
    gortVapourisationTargetId: null,
  }, players);

  assert.strictEqual(tickOut.updatedState.doomsdayClockHours, 1, 'Clock must advance to 1 hour');
  assert.strictEqual(tickOut.planetaryWipeTriggered, false);

  // Klaatu world freeze: suspends all night kills
  const freezeOut = tickEarthStoodStill({
    currentState: tickOut.updatedState,
    innocentsLynchedThisRound: [],
    klaatuFreezeActivated: true,
    gortVapourisationTargetId: null,
  }, players);

  assert.strictEqual(freezeOut.updatedState.worldFrozenActive, true, 'World freeze active');

  const rawActions: NightActionBufferItem[] = [
    { actorPlayerId: 'p3', targetPlayerId: 'p1', actionType: 'KILL', priority: 4, timestamp: 1 },
    { actorPlayerId: 'p2', targetPlayerId: 'p1', actionType: 'PROTECT', priority: 3, timestamp: 2 },
  ];
  const filteredActions = applyWorldFreeze(rawActions, freezeOut.updatedState);
  assert.strictEqual(filteredActions.length, 1, 'KILL action must be filtered out during world freeze');
  assert.strictEqual(filteredActions[0]!.actionType, 'PROTECT');

  // Clock reaches 12 hours -> planetary wipe triggered
  const wipeState = { ...freezeOut.updatedState, doomsdayClockHours: 11 };
  const wipeOut = tickEarthStoodStill({
    currentState: wipeState,
    innocentsLynchedThisRound: ['p1'],
    klaatuFreezeActivated: false,
    gortVapourisationTargetId: null,
  }, players);

  assert.strictEqual(wipeOut.updatedState.doomsdayClockHours, 12);
  assert.strictEqual(wipeOut.planetaryWipeTriggered, true, 'Planetary wipe must trigger at 12 hours');
  assert.strictEqual(wipeOut.wipeVictimIds.length, 3, 'All alive players wiped');
  console.log('  ✔ Doomsday Clock ticks, Klaatu freeze, and planetary wipe verified.');
}

// ─── TEST 3: OPERATION VALKYRIE (BRIEFCASE & ASSASSINATION) ──────────────────
console.log('▶ Test 3: Operation Valkyrie Briefcase Passing & Blast Resolution');
{
  const players = {
    'dictator': createMockPlayer('dictator', 'Diktator', 'MAFIA'),
    'c1': createMockPlayer('c1', 'Conspirator 1', 'TOWN'),
    'c2': createMockPlayer('c2', 'Conspirator 2', 'TOWN'),
  };

  const valkyrieState = createInitialValkyrieState('dictator', ['c1', 'c2'], 'c1');
  assert.strictEqual(valkyrieState.fuseTimerDaysRemaining, 3);
  assert.strictEqual(valkyrieState.briefcaseLocationPlayerId, 'c1');

  // Pass briefcase from c1 to c2 during Day
  let out = processValkyrieRound({
    currentState: valkyrieState,
    briefcasePassTargetId: 'c2',
    isDayPhase: true,
  }, players);

  assert.strictEqual(out.updatedState.briefcaseLocationPlayerId, 'c2', 'Briefcase passed to c2');
  assert.strictEqual(out.updatedState.fuseTimerDaysRemaining, 2, 'Fuse decremented to 2');
  assert.strictEqual(out.detonated, false);

  // Fast forward fuse to 1 day
  const nearBlastState = { ...out.updatedState, fuseTimerDaysRemaining: 1 };

  // Next Day tick triggers detonation while held by conspirator c2
  out = processValkyrieRound({
    currentState: nearBlastState,
    briefcasePassTargetId: null,
    isDayPhase: true,
  }, players);

  assert.strictEqual(out.detonated, true, 'Briefcase must detonate at 0 days');
  assert.strictEqual(out.updatedState.dictatorAssassinated, true, 'Dictator assassinated');
  assert.strictEqual(out.detonationVictimId, 'dictator');

  // Check phase manager win condition for Valkyrie
  const valkyrieLobby: LobbyState = {
    lobbyId: 'valkyrie-test-lobby',
    mode: 'BLITZ',
    phase: 'DAY_CENTRAL_ASSEMBLY',
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
    minigameSubStates: { valkyrie: out.updatedState },
    roundNumber: 4,
    lastLynchedUserId: null,
    globalNightKillCap: 99,
    latestNewspaper: null,
    privateInvestigations: {},
    winnerResult: null,
    stateVersion: 1,
  };

  const win = evaluateWinCondition(valkyrieLobby);
  assert.strictEqual(win.kind, 'TOWN_VICTORY', 'Conspirators claim victory on Dictator assassination');
  assert.deepStrictEqual(win.winnerPlayerIds, ['c1', 'c2']);
  console.log('  ✔ Valkyrie briefcase passing, detonation, and Conspirators victory verified.');
}

// ─── TEST 4: STANFORD PRISON (REVOLT METER & RIOT WIN) ───────────────────────
console.log('▶ Test 4: Stanford Prison (Sanctions, Revolt Meter & Riot Win)');
{
  const players = {
    'warden': createMockPlayer('warden', 'Rəis', 'MAFIA'),
    'g1': createMockPlayer('g1', 'Guard 1', 'MAFIA'),
    'i1': createMockPlayer('i1', 'Inmate 1', 'TOWN'),
    'i2': createMockPlayer('i2', 'Inmate 2', 'TOWN'),
  };

  const prisonState = createInitialStanfordPrisonState('warden', ['g1'], ['i1', 'i2'], 'i1');
  assert.strictEqual(prisonState.revoltMeter, 0);

  // Guards sanction inmates (+15 each) and 1 inmate is unjustly lynched (+20)
  const round1 = processStanfordPrisonRound({
    currentState: prisonState,
    guardSanctionIds: ['g1'],
    wardenAppeasedInmateIds: [],
    inmatesLynchedIds: ['i2'],
    inmatesPlacedInSolitary: [],
    secretAssassinStrike: false,
    assassinStrikeTargetId: null,
  });

  assert.strictEqual(round1.currentRevoltMeter, 35, 'Meter must be 15 + 20 = 35');
  assert.strictEqual(round1.riotTriggered, false);

  // Escalate to 100 -> riot triggered
  const highPrisonState = { ...round1.updatedState, revoltMeter: 90 };
  const round2 = processStanfordPrisonRound({
    currentState: highPrisonState,
    guardSanctionIds: ['g1'],
    wardenAppeasedInmateIds: [],
    inmatesLynchedIds: [],
    inmatesPlacedInSolitary: [],
    secretAssassinStrike: true,
    assassinStrikeTargetId: 'g1',
  });

  assert.strictEqual(round2.currentRevoltMeter, 100, 'Meter must cap at 100');
  assert.strictEqual(round2.riotTriggered, true, 'Riot triggered at 100%');
  assert.strictEqual(round2.assassinatedGuardId, 'g1', 'Secret assassin struck guard');

  const prisonLobby: LobbyState = {
    lobbyId: 'prison-test-lobby',
    mode: 'BLITZ',
    phase: 'DAY_CENTRAL_ASSEMBLY',
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
    minigameSubStates: { stanfordPrison: round2.updatedState },
    roundNumber: 3,
    lastLynchedUserId: null,
    globalNightKillCap: 99,
    latestNewspaper: null,
    privateInvestigations: {},
    winnerResult: null,
    stateVersion: 1,
  };

  const win = evaluateWinCondition(prisonLobby);
  assert.strictEqual(win.kind, 'TOWN_VICTORY', 'Inmates win upon prison riot');
  console.log('  ✔ Stanford Prison revolt meter, guard assassination, and riot victory verified.');
}

// ─── TEST 5: CATENACCIO DEFENSIVE WALL & SNIPER PIERCE ──────────────────────
console.log('▶ Test 5: Catenaccio Defensive Wall & Sniper Piercing');
{
  const catenaccioState = createInitialCatenaccioState(['wall1', 'wall2'], 'sniper', 2);
  assert.strictEqual(catenaccioState.armorCharges['wall1'], 2);
  assert.strictEqual(catenaccioState.armorCharges['wall2'], 2);
  assert.strictEqual(catenaccioState.wallBreached, false);

  // 3 standard attacks on wall
  const round1 = processCatenaccioRound({
    currentState: catenaccioState,
    sniperShotTargetId: null,
    wallAttackerIds: ['att1', 'att2', 'att3'],
  });

  const totalCharges = (round1.updatedState.armorCharges['wall1'] ?? 0) + (round1.updatedState.armorCharges['wall2'] ?? 0);
  assert.strictEqual(totalCharges, 1, '4 total charges - 3 attacks = 1 charge remaining');
  assert.strictEqual(round1.wallBreached, false);

  // Sniper shot pierces target directly
  const round2 = processCatenaccioRound({
    currentState: round1.updatedState,
    sniperShotTargetId: 'wall1',
    wallAttackerIds: ['att4'], // Depletes the last charge
  });

  assert.strictEqual(round2.sniperVictimId, 'wall1', 'Sniper pierces directly');
  assert.strictEqual(round2.wallBreached, true, 'Wall must be breached when all charges depleted');
  console.log('  ✔ Catenaccio armor charge absorption and Sniper piercing shot verified.');
}

// ─── TEST 6: AI NARRATOR & PROCEDURAL AZERBAIJANI STORY ──────────────────────
console.log('▶ Test 6: AI Narrator & Procedural Azerbaijani Story Engine');
{
  const players = {
    'p1': createMockPlayer('p1', 'Nəriman', 'TOWN'),
    'p2': createMockPlayer('p2', 'Aysel', 'TOWN'),
  };

  // Zero-death morning report
  const peacefulStory = generateProceduralStory(1, [], players, ['p1']);
  assert.ok(peacefulStory.headline.length > 5, 'Headline must be populated');
  assert.ok(peacefulStory.story.includes('Nəriman'), 'Story must mention saved player Nəriman');

  // Casualty report
  const casualtyStory = generateProceduralStory(2, [
    { victimPlayerId: 'p2', cause: 'MAFIA_KILL', killerFaction: 'MAFIA', isCleaned: false },
  ], players);
  assert.ok(casualtyStory.headline.includes('Qanlı') || casualtyStory.headline.includes('Terror') || casualtyStory.headline.includes('Qurban') || casualtyStory.headline.includes('İtki'));
  assert.ok(casualtyStory.story.includes('Aysel'), 'Story must mention victim Aysel');

  // Async wrapper with offline resilience
  const asyncStory = await generateMorningNewspaperStory(3, [], players);
  assert.ok(asyncStory.headline.length > 0);
  assert.ok(asyncStory.story.length > 0);
  console.log('  ✔ Procedural Azerbaijani news generation and offline resilience verified.');
}

  console.log('\n🎉 ALL 5 MINIGAMES & AI NARRATOR SUITES VERIFIED WITH 100% SUCCESS!');
}

runAllMinigamesTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
