import assert from 'assert';
import {
  advanceDantesInfernoCircle,
  tickEarthStoodStill,
  applyWorldFreeze,
  processValkyrieRound,
  processStanfordPrisonRound,
  executePrisonSanction,
  executePrisonSolitary,
  applyPrisonSanction,
  applyPrisonSolitary,
  processChernobylRound,
  applyChernobylShelter,
  applyChernobylDecontamination,
  processCatenaccioRound,
  dispatchMinigamePhaseEvent,
} from '../src/server/engine/minigames-engine';
import {
  createInitialDantesInfernoState,
  createInitialEarthStoodStillState,
  createInitialValkyrieState,
  createInitialStanfordPrisonState,
  createInitialChernobylState,
  createInitialCatenaccioState,
  CHERNOBYL_DEFAULTS,
} from '../src/config/minigames.config';
import { ChernobylState, StanfordPrisonState } from '../src/types/minigames';
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

// ─── TEST 4: STANFORD PRISON (SANCTIONS, SOLITARY, & RIOT ENGINE) ────────────
console.log('▶ Test 4: Stanford Prison Interactive Controls & Voting Collisions');
{
  const players: Record<string, PlayerSession> = {
    'warden': createMockPlayer('warden', 'Rəis', 'MAFIA'),
    'g1': createMockPlayer('g1', 'Guard 1', 'MAFIA'),
    'g2': createMockPlayer('g2', 'Guard 2', 'MAFIA'),
    'i1': createMockPlayer('i1', 'Inmate 1', 'TOWN'),
    'i2': createMockPlayer('i2', 'Inmate 2', 'TOWN'),
    'i3': createMockPlayer('i3', 'Inmate 3', 'TOWN'),
  };

  // Subtest 4.1: Guard Issues PRISON_SANCTION -> Revolt Meter (+15), Quota Decrement (3 -> 2 -> 1 -> 0)
  console.log('  ▶ Subtest 4.1: Guard Issues PRISON_SANCTION & quota exhaustion');
  {
    const prisonState = createInitialStanfordPrisonState('warden', ['g1', 'g2'], ['i1', 'i2', 'i3'], 'i1');
    assert.strictEqual(prisonState.revoltMeter, 0, 'Initial revolt meter must be 0');
    assert.strictEqual(prisonState.guardSanctionsRemaining, 3, 'Must start with 3 sanctions');

    // 1st sanction
    const res1 = applyPrisonSanction(prisonState, 'g1', 'i1');
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.updatedState.revoltMeter, 15, 'Revolt meter must increase by +15');
    assert.strictEqual(res1.updatedState.guardSanctionsRemaining, 2, 'Sanctions must decrement to 2');
    assert.strictEqual(res1.updatedState.riotTriggered, false);

    // 2nd sanction
    const res2 = applyPrisonSanction(res1.updatedState, 'g2', 'i2');
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.updatedState.revoltMeter, 30);
    assert.strictEqual(res2.updatedState.guardSanctionsRemaining, 1);

    // 3rd sanction
    const res3 = applyPrisonSanction(res2.updatedState, 'g1', 'i3');
    assert.strictEqual(res3.success, true);
    assert.strictEqual(res3.updatedState.revoltMeter, 45);
    assert.strictEqual(res3.updatedState.guardSanctionsRemaining, 0);

    // 4th sanction attempt with exhausted quota
    const exhaustedRes = applyPrisonSanction(res3.updatedState, 'g1', 'i1');
    assert.strictEqual(exhaustedRes.success, false);
    assert.strictEqual(exhaustedRes.error, 'NO_SANCTIONS_REMAINING');
    assert.strictEqual(exhaustedRes.updatedState.revoltMeter, 45, 'Meter unchanged when quota exhausted');
    console.log('    ✔ Guard sanction execution, quota decrement, and exhaustion verified.');
  }

  // Subtest 4.2: Non-guard attempts sanction -> authorization rejection
  console.log('  ▶ Subtest 4.2: Non-guard attempts sanction -> authorization rejection');
  {
    const prisonState = createInitialStanfordPrisonState('warden', ['g1', 'g2'], ['i1', 'i2', 'i3'], 'i1');

    // Inmate attempts to sanction another inmate
    const inmateSanction = applyPrisonSanction(prisonState, 'i1', 'i2');
    assert.strictEqual(inmateSanction.success, false);
    assert.strictEqual(inmateSanction.error, 'GUARD_ONLY_ACTION');
    assert.strictEqual(inmateSanction.updatedState.revoltMeter, 0);

    // Guard attempts to sanction a non-inmate (fellow guard)
    const invalidTarget = applyPrisonSanction(prisonState, 'g1', 'g2');
    assert.strictEqual(invalidTarget.success, false);
    assert.strictEqual(invalidTarget.error, 'INVALID_INMATE_TARGET');

    // Verify executePrisonSanction with lobby authorization
    const lobby: LobbyState = {
      lobbyId: 'prison-auth-test',
      mode: 'STANFORD_PRISON',
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
      minigameSubStates: { stanfordPrison: prisonState },
      roundNumber: 1,
      lastLynchedUserId: null,
      globalNightKillCap: 99,
      latestNewspaper: null,
      privateInvestigations: {},
      winnerResult: null,
      stateVersion: 1,
    };

    const routeInmateSanction = executePrisonSanction(lobby, 'i1', 'i2');
    assert.strictEqual(routeInmateSanction.success, false);
    assert.strictEqual(routeInmateSanction.error, 'NOT_A_GUARD');

    const routeGuardValidSanction = executePrisonSanction(lobby, 'g1', 'i1');
    assert.strictEqual(routeGuardValidSanction.success, true);
    assert.strictEqual(routeGuardValidSanction.updatedLobby.minigameSubStates?.stanfordPrison?.revoltMeter, 15);
    console.log('    ✔ Non-guard sanction rejection and target verification verified.');
  }

  // Subtest 4.3: Revolt meter reaches 100 -> Riot triggers & inmates win
  console.log('  ▶ Subtest 4.3: Revolt meter reaches 100 -> Riot triggers & inmates win');
  {
    const highPrisonState: StanfordPrisonState = {
      guardPlayerIds: ['g1', 'g2'],
      inmatePlayerIds: ['i1', 'i2', 'i3'],
      revoltMeter: 90,
      wardenPlayerId: 'warden',
      secretAssassinInmateId: 'i1',
      solitaryConfinementPlayerIds: [],
      riotTriggered: false,
      guardSanctionsRemaining: 1,
    };

    const riotResult = applyPrisonSanction(highPrisonState, 'g1', 'i1');
    assert.strictEqual(riotResult.success, true);
    assert.strictEqual(riotResult.updatedState.revoltMeter, 100, 'Revolt meter must clamp to 100%');
    assert.strictEqual(riotResult.updatedState.riotTriggered, true, 'riotTriggered must be true at 100%');

    const riotLobby: LobbyState = {
      lobbyId: 'prison-riot-lobby',
      mode: 'STANFORD_PRISON',
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
      minigameSubStates: { stanfordPrison: riotResult.updatedState },
      roundNumber: 2,
      lastLynchedUserId: null,
      globalNightKillCap: 99,
      latestNewspaper: null,
      privateInvestigations: {},
      winnerResult: null,
      stateVersion: 1,
    };

    const win = evaluateWinCondition(riotLobby);
    assert.strictEqual(win.kind, 'TOWN_VICTORY', 'Inmates must win upon prison riot trigger');
    assert.strictEqual(win.winningFaction, 'TOWN');
    assert.deepStrictEqual(win.winnerPlayerIds.sort(), ['i1', 'i2', 'i3'].sort());
    console.log('    ✔ 100% revolt meter riot trigger and Town victory verified.');
  }

  // Subtest 4.4: Solitary confinement placation & meter reduction (-5)
  console.log('  ▶ Subtest 4.4: Solitary confinement placation & meter reduction');
  {
    const state: StanfordPrisonState = {
      guardPlayerIds: ['g1', 'g2'],
      inmatePlayerIds: ['i1', 'i2', 'i3'],
      revoltMeter: 20,
      wardenPlayerId: 'warden',
      secretAssassinInmateId: 'i1',
      solitaryConfinementPlayerIds: [],
      riotTriggered: false,
      guardSanctionsRemaining: 2,
    };

    // Guard places inmate in solitary
    const solitaryRes = applyPrisonSolitary(state, 'g1', 'i1');
    assert.strictEqual(solitaryRes.success, true);
    assert.strictEqual(solitaryRes.updatedState.revoltMeter, 15, 'Revolt meter must decrease by -5 (20 -> 15)');
    assert.deepStrictEqual(solitaryRes.updatedState.solitaryConfinementPlayerIds, ['i1']);

    // Duplicate solitary placement rejected
    const duplicateRes = applyPrisonSolitary(solitaryRes.updatedState, 'g2', 'i1');
    assert.strictEqual(duplicateRes.success, false);
    assert.strictEqual(duplicateRes.error, 'ALREADY_IN_SOLITARY');
    assert.strictEqual(duplicateRes.updatedState.revoltMeter, 15);

    // Clamping to 0
    const lowState = { ...solitaryRes.updatedState, revoltMeter: 3 };
    const clampedRes = applyPrisonSolitary(lowState, 'warden', 'i2');
    assert.strictEqual(clampedRes.success, true);
    assert.strictEqual(clampedRes.updatedState.revoltMeter, 0, 'Revolt meter clamps to 0');
    assert.deepStrictEqual(clampedRes.updatedState.solitaryConfinementPlayerIds.sort(), ['i1', 'i2'].sort());
    console.log('    ✔ Solitary placement, -5 meter decrement, duplicate guard, and clamping verified.');
  }

  // Subtest 4.5: Solitary inmate voting in court -> vote stripped, 0 weight contributed
  console.log('  ▶ Subtest 4.5: Solitary inmate voting in court -> vote stripped, 0 weight');
  {
    const prisonState: StanfordPrisonState = {
      guardPlayerIds: ['g1', 'g2'],
      inmatePlayerIds: ['i1', 'i2', 'i3'],
      revoltMeter: 15,
      wardenPlayerId: 'warden',
      secretAssassinInmateId: 'i1',
      solitaryConfinementPlayerIds: ['i1'], // i1 is in solitary
      riotTriggered: false,
      guardSanctionsRemaining: 2,
    };

    const votingLobby: LobbyState = {
      lobbyId: 'prison-court-lobby',
      mode: 'STANFORD_PRISON',
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
      liveVotes: {
        'i1': 'warden', // Solitary inmate votes for warden
        'i2': 'warden', // Free inmate votes for warden
        'warden': 'i2', // Warden votes for i2
      },
      speakerQueue: [],
      bufferedNightActions: [],
      chatMessages: [],
      minigameSubStates: { stanfordPrison: prisonState },
      roundNumber: 2,
      lastLynchedUserId: null,
      globalNightKillCap: 99,
      latestNewspaper: null,
      privateInvestigations: {},
      winnerResult: null,
      stateVersion: 1,
    };

    const votingOut = runVotingEngine({ lobby: votingLobby });

    // Tally for candidate warden: only i2's vote counted, i1 stripped
    const wardenTally = votingOut.tallies.find(t => t.candidateId === 'warden');
    assert.ok(wardenTally, 'Candidate warden tally must exist');
    assert.strictEqual(wardenTally?.voteCount, 1, 'Only 1 vote counted for warden (i1 stripped by solitary confinement)');
    assert.strictEqual(wardenTally?.voteWeight, 1, 'Only 1 weight contributed for warden');
    assert.deepStrictEqual(wardenTally?.voterIds, ['i2'], 'i1 must be completely excluded from voterIds');

    // Tally for candidate i2: warden vote counted
    const i2Tally = votingOut.tallies.find(t => t.candidateId === 'i2');
    assert.strictEqual(i2Tally?.voteCount, 1);
    console.log('    ✔ Solitary disenfranchisement in courtroom voting verified.');
  }

  // Subtest 4.6: Round processing with secret assassin strike
  console.log('  ▶ Subtest 4.6: Round processor processStanfordPrisonRound');
  {
    const prisonState = createInitialStanfordPrisonState('warden', ['g1'], ['i1', 'i2'], 'i1');
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
    assert.strictEqual(round1.updatedState.guardSanctionsRemaining, 2);

    const highState = { ...round1.updatedState, revoltMeter: 90 };
    const round2 = processStanfordPrisonRound({
      currentState: highState,
      guardSanctionIds: ['g1'],
      wardenAppeasedInmateIds: [],
      inmatesLynchedIds: [],
      inmatesPlacedInSolitary: [],
      secretAssassinStrike: true,
      assassinStrikeTargetId: 'g1',
    });
    assert.strictEqual(round2.currentRevoltMeter, 100);
    assert.strictEqual(round2.riotTriggered, true);
    assert.strictEqual(round2.assassinatedGuardId, 'g1');
    console.log('    ✔ Round processor sanctions, unjust lynch, and assassin strike verified.');
  }

  console.log('  ✔ All Stanford Prison interactive specifications verified.');
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

// ─── TEST 7: CHERNOBYL EXCLUSION ZONE RADIATION ENGINE ───────────────────────
console.log('▶ Test 7: Chernobyl Exclusion Zone Radiation Engine & Bunker Dynamics');
{
  const players: Record<string, PlayerSession> = {
    'dozim':  createMockPlayer('dozim', 'Dozimetrist', 'TOWN'),
    'likvid': createMockPlayer('likvid', 'Likvidator', 'TOWN'),
    'mutant': createMockPlayer('mutant', 'Mutant', 'MAFIA'),
    'cit1':   createMockPlayer('cit1', 'Citizen 1', 'TOWN'),
    'cit2':   createMockPlayer('cit2', 'Citizen 2', 'TOWN'),
  };
  const allPlayerIds = Object.keys(players);

  // Subtest 7.1: Initial State Factory Invariants
  console.log('  ▶ Subtest 7.1: Initial state factory invariants');
  {
    const state = createInitialChernobylState(allPlayerIds, {
      bunkerCapacity: 2,
      contaminationRate: 20,
      lethalThreshold: 100,
    });

    assert.strictEqual(state.bunkerCapacity, 2, 'Bunker capacity must equal 2');
    assert.strictEqual(state.zoneContaminationLevel, 20, 'Zone contamination rate must be 20 mSv/round');
    assert.strictEqual(state.lethalThreshold, 100, 'Lethal threshold must be 100 mSv');
    assert.deepStrictEqual(state.shelteredPlayerIds, [], 'No players sheltered initially');
    assert.deepStrictEqual(state.decontaminatedPlayerIds, [], 'No players decontaminated initially');
    assert.deepStrictEqual(state.radiationCasualties, [], 'No casualties initially');

    for (const pId of allPlayerIds) {
      assert.strictEqual(state.radiationDosage[pId], 0, `Player ${pId} must start at 0 mSv dosage`);
    }

    // Positional arguments factory check
    const statePositional = createInitialChernobylState(allPlayerIds, 3, 15, 100, 'likvid');
    assert.strictEqual(statePositional.bunkerCapacity, 3);
    assert.strictEqual(statePositional.zoneContaminationLevel, 15);
    assert.strictEqual(statePositional.liquidatorPlayerId, 'likvid');
    console.log('    ✔ Initial factory state invariants verified.');
  }

  // Subtest 7.2: Contamination Accrual (Sheltered vs Unsheltered)
  console.log('  ▶ Subtest 7.2: Round tick contamination accrual (sheltered vs unsheltered)');
  {
    const initialState = createInitialChernobylState(allPlayerIds, {
      bunkerCapacity: 2,
      contaminationRate: 25,
      lethalThreshold: 100,
    });

    // Shelter 'dozim' and 'likvid'; leave others exposed
    const round1 = processChernobylRound({
      currentState: initialState,
      shelteredPlayerIds: ['dozim', 'likvid'],
      decontaminatedPlayerIds: [],
    }, players);

    // Sheltered players take 0 mSv
    assert.strictEqual(round1.updatedState.radiationDosage['dozim'], 0, 'Sheltered dozim takes 0 mSv');
    assert.strictEqual(round1.updatedState.radiationDosage['likvid'], 0, 'Sheltered likvid takes 0 mSv');

    // Unsheltered players accrue 25 mSv
    assert.strictEqual(round1.updatedState.radiationDosage['mutant'], 25, 'Unsheltered mutant takes 25 mSv');
    assert.strictEqual(round1.updatedState.radiationDosage['cit1'], 25, 'Unsheltered cit1 takes 25 mSv');
    assert.strictEqual(round1.updatedState.radiationDosage['cit2'], 25, 'Unsheltered cit2 takes 25 mSv');
    assert.strictEqual(round1.newRadiationVictims.length, 0, 'No deaths at 25 mSv');

    // Round 2 tick: swap shelter: mutant enters shelter; dozim leaves shelter
    const round2 = processChernobylRound({
      currentState: round1.updatedState,
      shelteredPlayerIds: ['mutant'],
      decontaminatedPlayerIds: [],
    }, players);

    // Mutant was sheltered in round 2: stays at 25 mSv (no increase)
    assert.strictEqual(round2.updatedState.radiationDosage['mutant'], 25, 'Sheltered mutant dosage remains 25 mSv');
    // Ambient contamination increased from 25 to 40 in round 2; exposed dozim accrues 40 mSv
    assert.strictEqual(round2.updatedState.radiationDosage['dozim'], 40, 'Exposed dozim accrues round 2 contamination (40 mSv)');
    assert.strictEqual(round2.updatedState.radiationDosage['cit1'], 65, 'cit1 accrued 25 + 40 = 65 mSv');
    console.log('    ✔ Sheltered immunity (0 mSv) & unsheltered accrual verified.');
  }

  // Subtest 7.3: Decontamination Healing (-50 mSv) and Clamping
  console.log('  ▶ Subtest 7.3: Decontamination healing (-50 mSv) and lower-bound clamping');
  {
    const state: ChernobylState = {
      radiationDosage: {
        'dozim': 10,
        'likvid': 0,
        'mutant': 75,
        'cit1': 30,
        'cit2': 80,
      },
      shelteredPlayerIds: ['mutant', 'cit1'], // sheltered this round to isolate decontam
      bunkerCapacity: 2,
      zoneContaminationLevel: 20,
      decontaminatedPlayerIds: [],
      radiationCasualties: [],
      lethalThreshold: 100,
      liquidatorPlayerId: 'likvid',
    };

    // Likvidator decontaminates mutant (-50 mSv) and cit1 (-50 mSv with lower bound clamp)
    const decontamResult = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['mutant', 'cit1'],
      decontaminatedPlayerIds: ['mutant', 'cit1'],
    }, players);

    // mutant: 75 mSv - 50 mSv = 25 mSv
    assert.strictEqual(
      decontamResult.updatedState.radiationDosage['mutant'],
      25,
      'Mutant dosage must heal by -50 mSv from 75 to 25'
    );

    // cit1: 30 mSv - 50 mSv = -20 mSv -> clamped to 0 mSv
    assert.strictEqual(
      decontamResult.updatedState.radiationDosage['cit1'],
      0,
      'cit1 dosage must clamp at lower bound 0 mSv (30 - 50 = 0)'
    );

    assert.deepStrictEqual(
      decontamResult.updatedState.decontaminatedPlayerIds,
      [],
      'decontaminatedPlayerIds must be reset to empty array after round processing to prevent perpetual recurrence'
    );

    // Also verify applyChernobylDecontamination helper
    const helperRes = applyChernobylDecontamination(state, 'mutant', 50);
    assert.strictEqual(helperRes.success, true);
    assert.strictEqual(helperRes.updatedState.radiationDosage['mutant'], 25);
    console.log('    ✔ Decontamination (-50 mSv) & clamping to 0 mSv verified.');
  }

  // Subtest 7.4: Lethal Threshold Elimination (Cause: 'RADIATION_SICKNESS')
  console.log('  ▶ Subtest 7.4: Lethal threshold elimination (cause: RADIATION_SICKNESS)');
  {
    const state: ChernobylState = {
      radiationDosage: {
        'dozim': 20,
        'likvid': 20,
        'mutant': 90, // at 90 mSv, about to hit lethal threshold
        'cit1': 10,
        'cit2': 40,
      },
      shelteredPlayerIds: ['dozim', 'likvid'],
      bunkerCapacity: 2,
      zoneContaminationLevel: 20, // +20 mSv will push mutant to 110 mSv >= 100
      decontaminatedPlayerIds: [],
      radiationCasualties: [],
      lethalThreshold: 100,
      liquidatorPlayerId: 'likvid',
    };

    const lethalRound = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['dozim', 'likvid'],
      decontaminatedPlayerIds: [],
    }, players);

    // Mutant reached 110 mSv -> lethal threshold reached
    assert.strictEqual(lethalRound.updatedState.radiationDosage['mutant'], 110);
    assert.deepStrictEqual(lethalRound.newCasualtyPlayerIds, ['mutant']);
    assert.deepStrictEqual(lethalRound.newRadiationVictims, ['mutant']);
    assert.deepStrictEqual(lethalRound.updatedState.radiationCasualties, ['mutant']);

    // Verify death record contract
    assert.strictEqual(lethalRound.radiationDeaths.length, 1);
    assert.strictEqual(lethalRound.radiationDeaths[0]?.victimPlayerId, 'mutant');
    assert.strictEqual(
      lethalRound.radiationDeaths[0]?.cause,
      'RADIATION_SICKNESS',
      'Death cause must strictly be RADIATION_SICKNESS'
    );
    assert.strictEqual(lethalRound.deathRecords[0]?.cause, 'RADIATION_SICKNESS');
    console.log('    ✔ Lethal threshold (>=100 mSv) elimination with RADIATION_SICKNESS verified.');
  }

  // Subtest 7.5: Bunker Capacity Overflow Enforcement
  console.log('  ▶ Subtest 7.5: Bunker capacity overflow enforcement');
  {
    const state = createInitialChernobylState(allPlayerIds, {
      bunkerCapacity: 2,
      contaminationRate: 20,
      lethalThreshold: 100,
    });

    // 1st entry: dozim
    const res1 = applyChernobylShelter(state, 'dozim');
    assert.strictEqual(res1.success, true);
    assert.deepStrictEqual(res1.updatedState.shelteredPlayerIds, ['dozim']);

    // 2nd entry: likvid
    const res2 = applyChernobylShelter(res1.updatedState, 'likvid');
    assert.strictEqual(res2.success, true);
    assert.deepStrictEqual(res2.updatedState.shelteredPlayerIds, ['dozim', 'likvid']);

    // 3rd entry: mutant attempts to enter full bunker (capacity 2)
    const overflowRes = applyChernobylShelter(res2.updatedState, 'mutant');
    assert.strictEqual(overflowRes.success, false, 'Excess shelter entrant must be rejected');
    assert.strictEqual(overflowRes.error, 'BUNKER_CAPACITY_EXCEEDED');
    assert.strictEqual(overflowRes.updatedState.shelteredPlayerIds.length, 2);
    assert.strictEqual(overflowRes.updatedState.shelteredPlayerIds.includes('mutant'), false);

    // Engine fail-safe check: if oversized list is passed directly to processChernobylRound
    const forcedRound = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['dozim', 'likvid', 'mutant'], // 3 players for capacity 2
      decontaminatedPlayerIds: [],
    }, players);

    // Only first 2 are sheltered; mutant remains unsheltered and takes 20 mSv
    assert.strictEqual(forcedRound.updatedState.shelteredPlayerIds.length, 2, 'Engine must clamp sheltered to capacity');
    assert.strictEqual(forcedRound.updatedState.radiationDosage['dozim'], 0, 'Sheltered dozim takes 0');
    assert.strictEqual(forcedRound.updatedState.radiationDosage['likvid'], 0, 'Sheltered likvid takes 0');
    assert.strictEqual(forcedRound.updatedState.radiationDosage['mutant'], 20, 'Overflow entrant mutant takes unsheltered 20 mSv');
    console.log('    ✔ Bunker capacity overflow rejection and fail-safe truncation verified.');
  }

  // Subtest 7.6: Multi-Round Decontamination Non-Recurrence & Morning Phase-Gating
  console.log('  ▶ Subtest 7.6: Multi-round decontamination non-recurrence & morning phase-gating');
  {
    const state: ChernobylState = {
      radiationDosage: {
        'dozim': 0,
        'likvid': 0,
        'mutant': 60,
        'cit1': 30,
        'cit2': 0,
      },
      shelteredPlayerIds: ['mutant', 'cit1'], // Sheltered in Round 1 to isolate decontam
      bunkerCapacity: 2,
      zoneContaminationLevel: 20,
      decontaminatedPlayerIds: [],
      radiationCasualties: [],
      lethalThreshold: 100,
      liquidatorPlayerId: 'likvid',
    };

    // Round 1: Likvidator decontaminates mutant (-50 mSv). cit1 is not treated.
    const round1 = processChernobylRound({
      currentState: state,
      shelteredPlayerIds: ['mutant', 'cit1'],
      decontaminatedPlayerIds: ['mutant'],
    }, players);

    // Mutant heals 60 - 50 = 10 mSv; cit1 remains 30 mSv
    assert.strictEqual(round1.updatedState.radiationDosage['mutant'], 10, 'Mutant dosage must heal 60 - 50 = 10 mSv in Round 1');
    assert.strictEqual(round1.updatedState.radiationDosage['cit1'], 30, 'cit1 dosage must remain 30 mSv');
    assert.strictEqual(round1.dosageDeltas['mutant'], -50, 'Mutant dosage delta must be -50 mSv in Round 1');
    assert.deepStrictEqual(round1.updatedState.decontaminatedPlayerIds, [], 'decontaminatedPlayerIds must be reset to empty array');
    assert.strictEqual(round1.updatedState.zoneContaminationLevel, 35, 'Zone contamination increments 20 + 15 = 35 mSv');

    // Round 2: Follow-up round where mutant is unsheltered and NO decontamination is scheduled.
    // Omit decontaminatedPlayerIds to verify Round 1 treatment does NOT carry over.
    const round2 = processChernobylRound({
      currentState: round1.updatedState,
      shelteredPlayerIds: ['cit1'], // Only cit1 is sheltered; mutant is unsheltered
    }, players);

    // INVARIANT: Mutant must take ambient +35 mSv without phantom healing (10 + 35 = 45 mSv).
    // If recurrence bug were present, mutant would heal -50 again (resulting in 0 + 35 = 35 or 0).
    assert.strictEqual(
      round2.updatedState.radiationDosage['mutant'],
      45,
      'Mutant must take ambient +35 mSv without phantom healing (10 + 35 = 45 mSv)'
    );
    assert.strictEqual(
      round2.dosageDeltas['mutant'],
      35,
      'Mutant dosage delta in Round 2 must strictly be +35 mSv'
    );
    assert.deepStrictEqual(
      round2.updatedState.decontaminatedPlayerIds,
      [],
      'decontaminatedPlayerIds must remain empty array in Round 2'
    );

    // Phase Gating Invariant with dispatchMinigamePhaseEvent:
    const testLobbyId = 'test-chernobyl-phase-gate-lobby';
    inMemoryLobbyStore.createLobby(testLobbyId, 'Host', createMockPlayer('Host', 'Host', 'TOWN'), 'STANDARD');
    inMemoryLobbyStore.updateLobby(testLobbyId, (l) => ({
      ...l,
      mode: 'CHERNOBYL_EXCLUSION_ZONE',
      phase: 'TRIAL_DEFENSE',
      minigameSubStates: { chernobyl: state },
    }));

    // Dispatch at TRIAL_DEFENSE (isMorningArrival: false)
    const lynchDispatch = dispatchMinigamePhaseEvent({
      lobbyId: testLobbyId,
      isMorningArrival: false,
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

    assert.strictEqual(lynchDispatch.chernobylResult, null, 'Chernobyl must NOT tick at trial defense (isMorningArrival: false)');
    assert.strictEqual(
      lynchDispatch.updatedSubStates.chernobyl?.zoneContaminationLevel,
      state.zoneContaminationLevel,
      'Zone contamination must NOT increment during trial defense'
    );

    // Dispatch at Morning Arrival (isMorningArrival: true)
    inMemoryLobbyStore.updateLobby(testLobbyId, (l) => ({
      ...l,
      phase: 'NIGHT_BUFFER',
      minigameSubStates: lynchDispatch.updatedSubStates,
    }));
    const morningDispatch = dispatchMinigamePhaseEvent({
      lobbyId: testLobbyId,
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

    assert.notStrictEqual(morningDispatch.chernobylResult, null, 'Chernobyl MUST tick at morning arrival (isMorningArrival: true)');
    assert.strictEqual(
      morningDispatch.updatedSubStates.chernobyl?.zoneContaminationLevel,
      state.zoneContaminationLevel + 15,
      'Zone contamination increments by +15 mSv at morning arrival'
    );

    console.log('    ✔ Multi-round decontamination non-recurrence & morning phase-gating verified.');
  }

  console.log('  ✔ All Chernobyl Exclusion Zone radiation engine specifications verified.');
}

  console.log('\n🎉 ALL 6 MINIGAMES & AI NARRATOR SUITES VERIFIED WITH 100% SUCCESS!');
}

runAllMinigamesTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
