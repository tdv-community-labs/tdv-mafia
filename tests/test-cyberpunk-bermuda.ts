import assert from 'assert';
import {
  processCyberpunkRound,
  applyCyberwareDrop,
  applyCorpoBribe,
  applyNetrunnerHack,
  applyNodeSpoof,
  processBermudaRound,
  applySalvageLogbook,
  applyOxygenTreatment,
  applySirenCurse,
  submitGhostTelegram,
  dispatchMinigamePhaseEvent,
} from '../src/server/engine/minigames-engine';
import {
  createInitialCyberpunkState,
  createInitialBermudaState,
  CYBERPUNK_DEFAULTS,
  BERMUDA_DEFAULTS,
} from '../src/config/minigames.config';
import { inMemoryLobbyStore } from '../src/server/state/memory';
import { PlayerSession } from '../src/types/game';

function createMockPlayer(id: string, name: string, faction: 'TOWN' | 'MAFIA' | 'NEUTRAL_EVIL', isAlive = true): PlayerSession {
  return {
    socketId: `sock-${id}`,
    userId: id,
    username: name,
    isAlive,
    tier: 'TIER_1',
    displayRole: { formatted: `${name} (${name})` as any, localized: name, originalRoleName: name },
    allInIdentity: {
      layer1Faction: faction,
      layer2Office: 'CITIZEN' as any,
      layer3Trait: 'CONTRABAND_POCKET' as any,
    },
    inventory: [],
    secretRole: name,
    hasHostWaiver: false,
    hasAdminWaiver: false,
  };
}

async function runCyberpunkAndBermudaTests() {
  console.log('🧪 Starting Cyberpunk Neo-Baku & Bermuda Triangle Comprehensive Verification Suite...\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 1: CYBERPUNK 2077: NEO-BAKU ENGINE (M11)
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('▶ Test 1.1: Cyberpunk Caspian Grid Decay & Recovery Mechanics');
  {
    const players = {
      p1: createMockPlayer('p1', 'Citizen_1', 'TOWN'),
      p2: createMockPlayer('p2', 'Netrunner_1', 'TOWN'),
      p3: createMockPlayer('p3', 'Corpo_1', 'MAFIA'),
      p4: createMockPlayer('p4', 'Corpo_2', 'MAFIA'),
    };

    let state = createInitialCyberpunkState(100);
    assert.strictEqual(state.gridIntegrity, 100);
    assert.strictEqual(state.isCyberOverdriveActive, false);
    assert.strictEqual(state.isSystemBlackout, false);

    // 1 Innocent lynched (-15%) & 1 Corpo assassination (-10%)
    let out = processCyberpunkRound({
      currentState: state,
      innocentsLynchedCount: 1,
      corpoAssassinationsCount: 1,
    }, players);

    assert.strictEqual(out.integrityDelta, -25, 'Decay must equal -15 (innocent) + -10 (corpo assassination)');
    assert.strictEqual(out.updatedState.gridIntegrity, 75);
    assert.strictEqual(out.updatedState.isCyberOverdriveActive, false);

    // Netrunner overload (-20%)
    out = processCyberpunkRound({
      currentState: out.updatedState,
      netrunnerOverloadsCount: 1,
    }, players);

    assert.strictEqual(out.integrityDelta, -20);
    assert.strictEqual(out.updatedState.gridIntegrity, 55);

    // Recovery: Corpo patch (+15%) and Corpo Executive eliminated (+20%)
    out = processCyberpunkRound({
      currentState: out.updatedState,
      corpoPatchesCount: 1,
      corpoExecutivesEliminatedCount: 1,
    }, players);

    assert.strictEqual(out.integrityDelta, +35);
    assert.strictEqual(out.updatedState.gridIntegrity, 90);

    console.log('  ✔ Caspian Grid decay and recovery mathematics verified.');
  }

  console.log('▶ Test 1.2: Cyber-Overdrive (<=30%) & System Blackout (0%) Transitions');
  {
    const players = {
      p1: createMockPlayer('p1', 'Citizen_1', 'TOWN'),
      p2: createMockPlayer('p2', 'Netrunner_1', 'TOWN'),
      p3: createMockPlayer('p3', 'Corpo_1', 'MAFIA'),
    };

    let state = createInitialCyberpunkState(40);
    assert.strictEqual(state.isCyberOverdriveActive, false);

    // Drop from 40% to 20% (crosses Overdrive threshold of 30%)
    let out = processCyberpunkRound({
      currentState: state,
      netrunnerOverloadsCount: 1, // -20%
    }, players);

    assert.strictEqual(out.updatedState.gridIntegrity, 20);
    assert.strictEqual(out.overdriveEntered, true, 'Must signal overdrive entered when crossing <=30%');
    assert.strictEqual(out.updatedState.isCyberOverdriveActive, true, 'isCyberOverdriveActive must be true');
    assert.strictEqual(out.blackoutEntered, false);

    // Drop from 20% to 0% (crosses into System Blackout)
    out = processCyberpunkRound({
      currentState: out.updatedState,
      netrunnerOverloadsCount: 1, // -20% -> 0%
    }, players);

    assert.strictEqual(out.updatedState.gridIntegrity, 0);
    assert.strictEqual(out.blackoutEntered, true, 'Must signal blackout entered when hitting 0%');
    assert.strictEqual(out.updatedState.isSystemBlackout, true, 'isSystemBlackout must be true');
    assert.strictEqual(out.updatedState.isCyberOverdriveActive, false, 'Overdrive replaced by total blackout');

    console.log('  ✔ Overdrive (15s night timer) and System Blackout states verified.');
  }

  console.log('▶ Test 1.3: Net-Glitch Events (Signal Scramble, Firewall Breach, Blackout Cycle)');
  {
    const players = {
      p1: createMockPlayer('p1', 'Citizen_1', 'TOWN'),
    };

    const state = createInitialCyberpunkState(50); // Destabilized grid (50% < 70%)

    // Deterministic roll trigger: rollRandom returns 0.05 (< 0.15 destabilized threshold)
    let rollCallIndex = 0;
    const mockRollRandom = () => {
      rollCallIndex++;
      if (rollCallIndex === 1) return 0.05; // Glitch triggers!
      return 0.1; // Picks index 0: 'SIGNAL_SCRAMBLE'
    };

    const out = processCyberpunkRound({
      currentState: state,
      isMorningArrival: true,
      rollRandom: mockRollRandom,
    }, players);

    assert.strictEqual(out.glitchTriggered, 'SIGNAL_SCRAMBLE');
    assert.strictEqual(out.updatedState.activeGlitchEvent, 'SIGNAL_SCRAMBLE');
    assert.strictEqual(out.updatedState.glitchRoundsRemaining, 1);

    // Next round morning without glitch rolls
    const out2 = processCyberpunkRound({
      currentState: out.updatedState,
      isMorningArrival: true,
      rollRandom: () => 0.99, // Does not trigger
    }, players);

    assert.strictEqual(out2.updatedState.activeGlitchEvent, 'NONE');
    assert.strictEqual(out2.updatedState.glitchRoundsRemaining, 0);

    console.log('  ✔ Net-Glitch probabilistic generation and round expiration verified.');
  }

  console.log('▶ Test 1.4: Cyberpunk Role Abilities (ICE_BREAKER, Cyberware Drop, Corpo Bribe, Node Spoof)');
  {
    let state = createInitialCyberpunkState(80);

    // 1. Netrunner Hack
    state = applyNetrunnerHack(state, 'p-victim', 'p-forced-target');
    assert.strictEqual(state.hackedPlayerVoteOverrides['p-victim'], 'p-forced-target');

    // 2. Cyberware Drop
    state = applyCyberwareDrop(state, 'p-citizen', 'SUBDERMAL');
    assert.strictEqual(state.cyberwareInventory['p-citizen'], 'SUBDERMAL');

    state = applyCyberwareDrop(state, 'p-sheriff', 'REFLEX');
    assert.strictEqual(state.cyberwareInventory['p-sheriff'], 'REFLEX');

    // 3. Corpo Bribe
    state = applyCorpoBribe(state, 'p-mercenary');
    assert.deepStrictEqual(state.corpoBribedPlayerIds, ['p-mercenary']);

    // 4. Node Spoof
    state = applyNodeSpoof(state, 'p-infiltrator', 'p-innocent');
    assert.strictEqual(state.nodeSpoofPairs['p-infiltrator'], 'p-innocent');

    console.log('  ✔ Cyberpunk role abilities and telemetry updates verified.');
  }

  console.log('▶ Test 1.5: Cyberpunk Win Conditions (Corpo Hegemony, Netrunner Liberation, Anarchist Collapse)');
  {
    // Case A: Anarchist Grid Collapse (0% for 2 consecutive cycles)
    const deadTown = {
      p1: createMockPlayer('p1', 'Citizen_1', 'TOWN', false),
      p2: createMockPlayer('p2', 'Street_Fixer', 'TOWN', true),
    };

    let state = createInitialCyberpunkState(0);
    // Cycle 1 at 0%
    let out = processCyberpunkRound({ currentState: state }, deadTown);
    assert.strictEqual(out.anarchistVictoryTriggered, true, '0% history length >= 2 triggers anarchist collapse');

    // Case B: Netrunner Liberation (All corpo eliminated, town alive)
    const townAlive = {
      p1: createMockPlayer('p1', 'Citizen_1', 'TOWN', true),
      p2: createMockPlayer('p2', 'Netrunner_1', 'TOWN', true),
      p3: createMockPlayer('p3', 'Corpo_1', 'MAFIA', false),
    };
    out = processCyberpunkRound({ currentState: createInitialCyberpunkState(60) }, townAlive);
    assert.strictEqual(out.netrunnerLiberationTriggered, true);
    assert.strictEqual(out.corpoHegemonyTriggered, false);

    // Case C: Corpo Hegemony (Corpo >= Town, grid >= 40%)
    const corpoDominance = {
      p1: createMockPlayer('p1', 'Citizen_1', 'TOWN', true),
      p2: createMockPlayer('p2', 'Corpo_1', 'MAFIA', true),
      p3: createMockPlayer('p3', 'Corpo_2', 'MAFIA', true),
    };
    out = processCyberpunkRound({ currentState: createInitialCyberpunkState(80) }, corpoDominance);
    assert.strictEqual(out.corpoHegemonyTriggered, true);
    assert.strictEqual(out.netrunnerLiberationTriggered, false);

    console.log('  ✔ Cyberpunk victory condition algorithms verified.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 2: BERMUDA TRIANGLE MARITIME ENGINE (M12)
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n▶ Test 2.1: Bermuda Dynamic Weather Transition Curve: P(Anomaly) = 1 - e^(-0.35 * R)');
  {
    const players = {
      p1: createMockPlayer('p1', 'Sailor_1', 'TOWN'),
      p2: createMockPlayer('p2', 'Sailor_2', 'TOWN'),
    };

    let state = createInitialBermudaState(100);
    assert.strictEqual(state.currentWeather, 'CALM_SEA');
    assert.strictEqual(state.compassScrambleRate, 0.0);

    // Round 1: P(Anomaly) = 1 - e^(-0.35) ≈ 0.2953
    // Simulate roll = 0.50 (> 0.2953) -> remains CALM_SEA
    let out = processBermudaRound({
      currentState: state,
      roundNumber: 1,
      isMorningArrival: true,
      rollRandom: () => 0.50,
    }, players);
    assert.strictEqual(out.newWeather, 'CALM_SEA');
    assert.strictEqual(out.updatedState.compassScrambleRate, 0.0);

    // Round 2: P(Anomaly) = 1 - e^(-0.70) ≈ 0.5034
    // Simulate roll = 0.40 (< 0.5034) -> weather escalates!
    let callCount = 0;
    const weatherRollMock = () => {
      callCount++;
      if (callCount === 1) return 0.40; // Anomaly triggers
      return 0.50; // Picks ELECTROMAGNETIC_STORM
    };

    out = processBermudaRound({
      currentState: state,
      roundNumber: 2,
      isMorningArrival: true,
      rollRandom: weatherRollMock,
    }, players);

    assert.strictEqual(out.weatherChanged, true);
    assert.strictEqual(out.newWeather, 'ELECTROMAGNETIC_STORM');
    assert.strictEqual(out.updatedState.compassScrambleRate, 0.85);

    // Round 3+: Simulate ROGUE_WAVE
    callCount = 0;
    const rogueWaveMock = () => {
      callCount++;
      if (callCount === 1) return 0.10; // Anomaly triggers
      return 0.20; // < 0.35 on round 3 triggers ROGUE_WAVE
    };

    out = processBermudaRound({
      currentState: out.updatedState,
      roundNumber: 3,
      isMorningArrival: true,
      rollRandom: rogueWaveMock,
    }, players);

    assert.strictEqual(out.newWeather, 'ROGUE_WAVE');
    assert.strictEqual(out.hullDelta, -15, 'Rogue wave delivers -15% hull damage');
    assert.strictEqual(out.updatedState.shipHullIntegrity, 85);
    assert.strictEqual(out.updatedState.compassScrambleRate, 0.5);
    assert.strictEqual(out.updatedState.stunnedPlayerIds.length, 1, '1 living player is stunned by rogue wave shock');

    console.log('  ✔ Environmental anomaly curve and weather modifiers verified.');
  }

  console.log('▶ Test 2.2: Corsair Sabotage & Lifeboat Protocol Collapse');
  {
    const players = {
      p1: createMockPlayer('p1', 'Sailor_1', 'TOWN'),
    };

    let state = createInitialBermudaState(20);

    // Corsair executes 2 sabotages (-10% each -> -20%)
    let out = processBermudaRound({
      currentState: state,
      roundNumber: 2,
      corsairSabotageCount: 2,
    }, players);

    assert.strictEqual(out.hullDelta, -20);
    assert.strictEqual(out.updatedState.shipHullIntegrity, 0);
    assert.strictEqual(out.lifeboatProtocolActive, true, 'Lifeboat protocol must activate at 0% hull');

    console.log('  ✔ Hull destruction and Lifeboat Protocol trigger verified.');
  }

  console.log('▶ Test 2.3: "Vanished at Sea" Masked Eliminations & Salvage Logbook Mechanics');
  {
    const players = {
      p1: createMockPlayer('p1', 'Sailor_1', 'TOWN'),
      p2: createMockPlayer('p2', 'Ghost_Captain', 'MAFIA'),
    };

    let state = createInitialBermudaState(100);

    // Night death occurs
    let out = processBermudaRound({
      currentState: state,
      roundNumber: 1,
      publicDeaths: [
        { victimPlayerId: 'p1', cause: 'MAFIA_KILL', isCleaned: false, killerFaction: 'MAFIA' },
      ],
    }, players);

    assert.deepStrictEqual(out.updatedState.vanishedPlayerIds, ['p1'], 'Victim identity must be masked in vanishedPlayerIds');
    assert.deepStrictEqual(out.updatedState.revealedWreckageIds, []);

    // Chief Navigator uses SALVAGE_LOGBOOK on p1
    const salvagedState = applySalvageLogbook(out.updatedState, 'p1');
    assert.deepStrictEqual(salvagedState.vanishedPlayerIds, []);
    assert.deepStrictEqual(salvagedState.revealedWreckageIds, ['p1'], 'Salvaged victim must move to revealedWreckageIds');

    console.log('  ✔ Vanished at Sea masked deaths and Salvage Logbook mechanics verified.');
  }

  console.log('▶ Test 2.4: Abyssal Siren Delayed Drowning Curse & Oxygen Treatment Cure');
  {
    const players = {
      p1: createMockPlayer('p1', 'Victim_Sailor', 'TOWN'),
      p2: createMockPlayer('p2', 'Ship_Surgeon', 'TOWN'),
    };

    let state = createInitialBermudaState(100);

    // 1. Siren strikes p1 at night
    state = applySirenCurse(state, 'p1');
    assert.deepStrictEqual(state.cursedDrowningPlayerIds, ['p1']);

    // 2. Case A: Cured by Surgeon
    const curedState = applyOxygenTreatment(state, 'p1');
    assert.deepStrictEqual(curedState.cursedDrowningPlayerIds, []);

    // 3. Case B: Not cured -> succumbs to drowning at morning arrival
    const uncuredOut = processBermudaRound({
      currentState: state,
      roundNumber: 2,
      isMorningArrival: true,
      curedDrowningPlayerIds: [],
    }, players);

    assert.deepStrictEqual(uncuredOut.drowningCasualties, ['p1'], 'Uncured victim must succumb to delayed drowning');
    assert.deepStrictEqual(uncuredOut.updatedState.cursedDrowningPlayerIds, []);

    console.log('  ✔ Siren delayed drowning curse and Oxygen Treatment cure verified.');
  }

  console.log('▶ Test 2.5: Dead Chat Ghost Telegram (3 Words)');
  {
    let state = createInitialBermudaState(100);

    // Invalid word count (must be exactly 3 words)
    state = submitGhostTelegram(state, ['KÖLGƏ', 'KAPİTAN']);
    assert.strictEqual(state.ghostTelegramClues.length, 0);

    // Valid 3-word telegram
    state = submitGhostTelegram(state, ['KÖLGƏ', 'KAPİTAN', 'ŞİMAL']);
    assert.deepStrictEqual(state.ghostTelegramClues, ['KÖLGƏ', 'KAPİTAN', 'ŞİMAL']);

    console.log('  ✔ 3-word dead chat Ghost Telegram verified.');
  }

  console.log('▶ Test 2.6: Bermuda Maritime Win Conditions');
  {
    // Case A: Crew Survival (All Corsairs dead, hull > 0)
    const crewAlive = {
      p1: createMockPlayer('p1', 'Sailor_1', 'TOWN', true),
      p2: createMockPlayer('p2', 'Captain', 'MAFIA', false),
    };
    let out = processBermudaRound({
      currentState: createInitialBermudaState(50),
      roundNumber: 2,
    }, crewAlive);
    assert.strictEqual(out.crewSurvivalTriggered, true);
    assert.strictEqual(out.abyssalClaimTriggered, false);

    // Case B: Abyssal Claim (Corsairs >= Crew)
    const corsairsDominant = {
      p1: createMockPlayer('p1', 'Sailor_1', 'TOWN', true),
      p2: createMockPlayer('p2', 'Corsair_1', 'MAFIA', true),
    };
    out = processBermudaRound({
      currentState: createInitialBermudaState(50),
      roundNumber: 2,
    }, corsairsDominant);
    assert.strictEqual(out.abyssalClaimTriggered, true);
    assert.strictEqual(out.crewSurvivalTriggered, false);

    console.log('  ✔ Bermuda win conditions verified.');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PART 3: UNIFIED MINIGAME DISPATCH ROUTER INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n▶ Test 3: Unified Minigame Dispatch Integration for Cyberpunk & Bermuda');
  {
    const testLobbyId = 'lobby-m11-m12-test';
    const players = {
      p1: createMockPlayer('p1', 'Player 1', 'TOWN'),
      p2: createMockPlayer('p2', 'Player 2', 'MAFIA'),
    };

    inMemoryLobbyStore.createLobby(testLobbyId, 'p1', players.p1, 'CYBERPUNK_NEO_BAKU');
    inMemoryLobbyStore.updateLobby(testLobbyId, (l) => ({
      ...l,
      players,
      phase: 'DAY_CENTRAL_ASSEMBLY',
      roundNumber: 1,
      minigameSubStates: {
        cyberpunkNeoBaku: createInitialCyberpunkState(80),
        bermudaTriangle: createInitialBermudaState(90),
      },
    }));

    const dispatchOut = dispatchMinigamePhaseEvent({
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
      cyberpunkInputs: {
        corpoPatchesCount: 1, // +15%
      },
      bermudaInputs: {
        corsairSabotageCount: 1, // -10%
      },
      publicDeaths: [],
    });

    assert.notStrictEqual(dispatchOut.cyberpunkResult, null);
    assert.strictEqual(dispatchOut.updatedSubStates.cyberpunkNeoBaku?.gridIntegrity, 95);

    assert.notStrictEqual(dispatchOut.bermudaResult, null);
    assert.strictEqual(dispatchOut.updatedSubStates.bermudaTriangle?.shipHullIntegrity, 80);

    console.log('  ✔ Unified dispatcher successfully dispatched and routed Cyberpunk and Bermuda events.');
  }

  console.log('\n🎉 ALL CYBERPUNK NEO-BAKU (M11) & BERMUDA TRIANGLE (M12) TEST SUITES PASSED 100%!');
}

runCyberpunkAndBermudaTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
