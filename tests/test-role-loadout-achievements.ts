/**
 * Test Suite: Role Loadout Balancing & Advanced Achievements System (Milestone 9)
 *
 * Verifies:
 * 1. Strict Killer Ratio Cap Invariant (<= 35%) across all presets (STANDARD, ASYMMETRIC, CHAOS, ALL_IN_40P) and scales.
 * 2. Complete 3-Layer Composite Identities for All-In (Faction, Office, Trait, District).
 * 3. M1 Night Action achievement triggers (Iron Will, Phantom Step, Night Vision, Doctor Save, Sheriff Bust).
 * 4. M2 Courtroom & M3 Minigame achievement triggers (Flawless defense, Mayor triple hammer, Stanford 100% revolt, Chernobyl bunker).
 * 5. Dead chat spectator achievement & Game win achievements.
 * 6. Achievement set deduplication and idempotency.
 */

import {
  generateBalancedDeck,
  validateKillerRatio,
  isKillerFaction,
  distributeBalancedRoles,
  LoadoutPresetId,
  MAX_KILLER_RATIO,
} from '../src/server/engine/role-loadout-balancer';
import {
  evaluateNightAchievements,
  evaluateCourtAchievements,
  evaluateMinigameAchievements,
  evaluateGameEndAchievements,
  mergeUnlockedAchievements,
  recordPlayerAchievement,
} from '../src/server/engine/achievement-engine';
import { ACHIEVEMENTS_REGISTRY } from '../src/config/achievements.config';
import { CoreFaction, formatRoleDisplay } from '../src/types/roles';
import { LobbyState, PlayerSession } from '../src/types/game';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

function createMockPlayer(id: string, name: string, faction: CoreFaction, office: any = 'PUBLIC_DEFENDER', trait: any = 'PHANTOM_STEP'): PlayerSession {
  return {
    socketId: `sock-${id}`,
    userId: id,
    username: name,
    tier: 'TIER_1',
    adminRole: 'NONE',
    isHost: false,
    isAlive: true,
    hasHostWaiver: true,
    hasAdminWaiver: true,
    displayRole: formatRoleDisplay(name, 'Citizen', 'Vətəndaş'),
    allInIdentity: {
      layer1Faction: faction,
      layer2Office: office,
      layer3Trait: trait,
      district: 'COMMERCIAL',
    },
    currentDistrict: 'COMMERCIAL',
    disconnectedAt: null,
    isAiBotControlled: false,
  };
}

function createMockLobby(players: Record<string, PlayerSession>, mode: any = 'STANDARD'): LobbyState {
  return {
    lobbyId: 'test-ach-lobby',
    hostUserId: 'host-1',
    mode,
    phase: 'NIGHT_BUFFER',
    players,
    hostReady: true,
    adminMasterUnlock: {
      architectUnlocked: true,
      bailiffUnlocked: true,
      dualLockVerified: true,
      unlockedAt: Date.now(),
    },
    assignedArchitectId: null,
    assignedBailiffId: null,
    phaseDurationSeconds: 60,
    phaseTimeRemaining: 60,
    nightJitterDelaySeconds: 4,
    liveVotes: {},
    speakerQueue: [],
    bufferedNightActions: [],
    roundNumber: 1,
    lastLynchedUserId: null,
    globalNightKillCap: 3,
    chatMessages: [],
    minigameSubStates: {},
  };
}

async function runTests() {
  console.log('================================================================');
  console.log('STARTING ROLE LOADOUT BALANCING & ACHIEVEMENTS TEST SUITE (M9)');
  console.log('================================================================\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 1: Killer Ratio Cap (<= 35%) Invariant Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ [Suite 1] Killer Ratio Cap Invariant (<= 35%) Across All Presets');

  const presets: LoadoutPresetId[] = ['STANDARD', 'ASYMMETRIC', 'CHAOS', 'ALL_IN_40P'];
  const testScales = [5, 6, 7, 8, 10, 12, 15, 18, 20, 24, 30, 40];

  for (const preset of presets) {
    for (const scale of testScales) {
      if (preset === 'ALL_IN_40P' && scale !== 40) continue;
      const deck = generateBalancedDeck(preset, scale);
      assert(deck.length === scale, `${preset} deck size must equal ${scale}, got ${deck.length}`);

      const factions = deck.map(c => c.faction);
      const validation = validateKillerRatio(factions);

      assert(
        validation.valid,
        `${preset} at ${scale}p must satisfy <= 35% killer cap, got ${(validation.killerRatio * 100).toFixed(1)}%`
      );
      assert(
        validation.killerRatio <= MAX_KILLER_RATIO + 0.0001,
        `Killer ratio must not exceed 0.35, got ${validation.killerRatio}`
      );
    }
  }
  console.log('  ✔ 1.1: All presets strictly satisfy killer ratio <= 35% across player scales (5p to 40p)');

  // 1.2: Explicit rejection of illegal deck
  const illegalDeck: CoreFaction[] = ['MAFIA', 'MAFIA', 'MAFIA', 'MAFIA', 'TOWN']; // 4 killers out of 5 = 80%
  const illegalValidation = validateKillerRatio(illegalDeck);
  assert(!illegalValidation.valid, 'validateKillerRatio must flag 80% killer deck as invalid');
  assert(illegalValidation.killerCount === 4, 'Killer count must be 4');
  console.log('  ✔ 1.2: validateKillerRatio correctly rejects over-capped distributions (>35%)\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 2: All-In 40-Player Complete 3-Layer Identities
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ [Suite 2] 40-Player All-In 3-Layer Composite Identities');

  const allInDeck = generateBalancedDeck('ALL_IN_40P', 40);
  assert(allInDeck.length === 40, 'All-In deck must have exactly 40 cards');

  const killerCount = allInDeck.filter(c => isKillerFaction(c.faction)).length;
  assert(killerCount === 14, `All-In 40p must have exactly 14 killers (35.0%), got ${killerCount}`);
  assert(40 - killerCount === 26, `All-In 40p must have exactly 26 non-killers, got ${40 - killerCount}`);

  // Test full lobby distribution
  const players40: Record<string, PlayerSession> = {};
  for (let i = 1; i <= 40; i++) {
    players40[`p-${i}`] = createMockPlayer(`p-${i}`, `Player_${i}`, 'TOWN');
  }
  const lobby40 = createMockLobby(players40, 'ALL_IN');
  const distributedLobby = distributeBalancedRoles(lobby40, 'ALL_IN_40P');

  // Verify all 40 players have complete 3-layer identities
  for (const p of Object.values(distributedLobby.players)) {
    assert(Boolean(p.allInIdentity), `Player ${p.username} must have allInIdentity defined`);
    assert(Boolean(p.allInIdentity?.layer1Faction), `Player ${p.username} must have layer1Faction`);
    assert(Boolean(p.allInIdentity?.layer2Office), `Player ${p.username} must have layer2Office`);
    assert(Boolean(p.allInIdentity?.layer3Trait), `Player ${p.username} must have layer3Trait`);
    assert(Boolean(p.allInIdentity?.district), `Player ${p.username} must have district`);
  }
  console.log('  ✔ 2.1: 40/40 players assigned complete 3-layer identities (Faction, Office, Trait, District)');
  console.log('  ✔ 2.2: Exactly 14 killers (35.0%) vs 26 non-killers (65.0%) cleanly distributed\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 3: M1 Night Action Achievements Triggers
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ [Suite 3] M1 Night Action Achievement Triggers');

  const pDoc = createMockPlayer('doc-1', 'Doctor', 'TOWN', 'CITY_SURGEON');
  const pSheriff = createMockPlayer('sheriff-1', 'Sheriff', 'TOWN', 'CITY_INVESTIGATOR');
  const pMafia = createMockPlayer('maf-1', 'Mafioso', 'MAFIA');
  const pVictim = createMockPlayer('vic-1', 'Victim', 'TOWN', 'PUBLIC_DEFENDER', 'IRON_WILL');
  const pPhantom = createMockPlayer('ph-1', 'Phantom', 'TOWN', 'PUBLIC_DEFENDER', 'PHANTOM_STEP');
  const pVision = createMockPlayer('vis-1', 'Observer', 'TOWN', 'PUBLIC_DEFENDER', 'NIGHT_VISION');

  const testLobbyM1 = createMockLobby({
    'doc-1': pDoc,
    'sheriff-1': pSheriff,
    'maf-1': pMafia,
    'vic-1': pVictim,
    'ph-1': pPhantom,
    'vis-1': pVision,
  });

  // Inject buffered night actions
  testLobbyM1.bufferedNightActions = [
    { actorPlayerId: 'maf-1', targetPlayerId: 'vic-1', actionType: 'KILL', priority: 6, timestamp: Date.now() },
    { actorPlayerId: 'doc-1', targetPlayerId: 'vic-1', actionType: 'PROTECT', priority: 2, timestamp: Date.now() },
    { actorPlayerId: 'sheriff-1', targetPlayerId: 'maf-1', actionType: 'INVESTIGATE', priority: 5, timestamp: Date.now() },
    { actorPlayerId: 'ph-1', targetPlayerId: 'maf-1', actionType: 'INVESTIGATE', priority: 5, timestamp: Date.now() },
    { actorPlayerId: 'vis-1', targetPlayerId: 'vic-1', actionType: 'INVESTIGATE', priority: 5, timestamp: Date.now() },
  ];

  const nightResult = {
    deaths: [],
    protectedIds: ['vic-1'],
    armorBrokenPlayerIds: ['vic-1'], // Iron will absorbed lethal strike
    updatedFlags: {},
    achievementsJustUnlocked: {
      'bg-1': ['town_bodyguard_noble_sacrifice'],
    },
  };

  const nightUnlocks = evaluateNightAchievements(testLobbyM1, nightResult);

  assert(nightUnlocks['vic-1']?.includes('trait_iron_will_resilience'), 'Victim must unlock trait_iron_will_resilience');
  assert(nightUnlocks['doc-1']?.includes('town_doctor_miracle_save'), 'Doctor must unlock town_doctor_miracle_save');
  assert(nightUnlocks['sheriff-1']?.includes('town_sheriff_first_bust'), 'Sheriff must unlock town_sheriff_first_bust in Round 1');
  assert(nightUnlocks['ph-1']?.includes('trait_phantom_step_bypass'), 'Actor with PHANTOM_STEP must unlock trait_phantom_step_bypass');
  assert(nightUnlocks['vis-1']?.includes('trait_night_vision_intel'), 'Observer with NIGHT_VISION must unlock trait_night_vision_intel');
  assert(nightUnlocks['bg-1']?.includes('town_bodyguard_noble_sacrifice'), 'Bodyguard noble sacrifice preserved');

  console.log('  ✔ 3.1: trait_iron_will_resilience awarded on armor shatter');
  console.log('  ✔ 3.2: town_doctor_miracle_save awarded on lethal attack deflection');
  console.log('  ✔ 3.3: town_sheriff_first_bust awarded on round 1 Mafia investigation');
  console.log('  ✔ 3.4: trait_phantom_step_bypass and trait_night_vision_intel awarded to trait holders\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 4: M2 Courtroom & M3 Minigame Achievements
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ [Suite 4] M2 Courtroom & M3 Minigame Achievement Triggers');

  const pMayor = createMockPlayer('mayor-1', 'Mayor', 'TOWN', 'MAYOR');
  const pAccused = createMockPlayer('accused-1', 'Accused', 'TOWN');

  const testLobbyM2: LobbyState = {
    ...createMockLobby({ 'mayor-1': pMayor, 'accused-1': pAccused }),
    mayorRevealedUserIds: ['mayor-1'],
    trialVerdictVotes: {
      'mayor-1': 'GUILTY',
    },
  };

  // 4.1: Mayor Triple Hammer on Guilty Lynch
  const courtUnlocksLynch = evaluateCourtAchievements(testLobbyM2, {
    outcome: 'LYNCHED',
    lynchedPlayerId: 'accused-1',
    guiltyCount: 5,
    innocentCount: 1,
  });
  assert(courtUnlocksLynch['mayor-1']?.includes('town_mayor_triple_hammer'), 'Mayor must unlock town_mayor_triple_hammer on guilty lynch');
  console.log('  ✔ 4.1: town_mayor_triple_hammer awarded to revealed Mayor');

  // 4.2: Accused Acquittal Defense Speech
  const courtUnlocksAcquit = evaluateCourtAchievements(testLobbyM2, {
    outcome: 'NO_LYNCH',
    accusedPlayerId: 'accused-1',
    guiltyCount: 2,
    innocentCount: 4,
  });
  assert(
    courtUnlocksAcquit['accused-1']?.includes('mastery_flawless_defense_speech'),
    'Accused must unlock mastery_flawless_defense_speech on acquittal'
  );
  console.log('  ✔ 4.2: mastery_flawless_defense_speech awarded to acquitted accused');

  // 4.3: Stanford Prison 100% Revolt
  const testLobbyStanford: LobbyState = {
    ...testLobbyM2,
    minigameSubStates: {
      stanfordPrison: {
        revoltMeter: 100,
        guardSanctionQuotas: {},
        solitaryInmates: [],
        riotTriggered: true,
      },
    },
  };
  const stanfordUnlocks = evaluateMinigameAchievements(testLobbyStanford);
  assert(stanfordUnlocks['accused-1']?.includes('mode_stanford_revolt_maximum'), 'Town inmates must unlock mode_stanford_revolt_maximum');
  console.log('  ✔ 4.3: mode_stanford_revolt_maximum awarded when Stanford revolt reaches 100%');

  // 4.4: Chernobyl Shelter Decontamination
  const testLobbyChernobyl: LobbyState = {
    ...testLobbyM2,
    minigameSubStates: {
      chernobyl: {
        shelteredPlayerIds: ['mayor-1'],
        radiationDosages: { 'mayor-1': 20 },
        zoneContaminationLevel: 60,
        bunkerCapacityRemaining: 3,
        lethalThreshold: 100,
      },
    },
  };
  const chernobylUnlocks = evaluateMinigameAchievements(testLobbyChernobyl);
  assert(chernobylUnlocks['mayor-1']?.includes('mode_chernobyl_decontamination'), 'Sheltered player must unlock mode_chernobyl_decontamination');
  console.log('  ✔ 4.4: mode_chernobyl_decontamination awarded to sheltered player\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 5: Spectator Mode & Win Condition Achievements
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ [Suite 5] Spectator Dead Chat & Victory Achievements');

  // 5.1: Spectator transition
  const lobbyWithSpec = recordPlayerAchievement(testLobbyM2, 'accused-1', 'spectator_first_graveyard_visit');
  assert(
    lobbyWithSpec.players['accused-1'].achievements?.includes('spectator_first_graveyard_visit') === true,
    'Player session must record spectator_first_graveyard_visit'
  );
  assert(
    lobbyWithSpec.achievementsJustUnlocked?.['accused-1']?.includes('spectator_first_graveyard_visit') === true,
    'Lobby achievementsJustUnlocked must record spectator_first_graveyard_visit'
  );
  console.log('  ✔ 5.1: spectator_first_graveyard_visit recorded upon entering dead chat');

  // 5.2: Flawless Town Victory
  const endUnlocks = evaluateGameEndAchievements(testLobbyM2, {
    kind: 'TOWN_VICTORY',
    winningFaction: 'TOWN',
    reason: 'All threats eliminated with zero casualties.',
  });
  assert(endUnlocks['mayor-1']?.includes('town_flawless_victory'), 'Town player must unlock town_flawless_victory');
  console.log('  ✔ 5.2: town_flawless_victory awarded upon zero-casualty Town win\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 6: Set Deduplication & Idempotency
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ [Suite 6] Deduplication & Idempotency');

  const existingUnlocks = {
    'user-1': ['town_doctor_miracle_save', 'mastery_first_time_host'],
  };
  const incomingUnlocks = {
    'user-1': ['town_doctor_miracle_save', 'town_mayor_triple_hammer'],
  };
  const merged = mergeUnlockedAchievements(existingUnlocks, incomingUnlocks);
  assert(merged['user-1'].length === 3, `Expected 3 unique achievements, got ${merged['user-1'].length}`);
  assert(
    merged['user-1'].filter(id => id === 'town_doctor_miracle_save').length === 1,
    'town_doctor_miracle_save must not be duplicated'
  );
  console.log('  ✔ 6.1: mergeUnlockedAchievements strictly enforces unique set deduplication');

  // Verify all 82 cataloged achievements exist and have valid fields
  assert(ACHIEVEMENTS_REGISTRY.length >= 80, `Expected at least 80 achievements, got ${ACHIEVEMENTS_REGISTRY.length}`);
  for (const ach of ACHIEVEMENTS_REGISTRY) {
    assert(Boolean(ach.id), `Achievement must have id`);
    assert(Boolean(ach.title), `Achievement ${ach.id} must have title`);
    assert(Boolean(ach.description), `Achievement ${ach.id} must have description`);
    assert(Boolean(ach.tier), `Achievement ${ach.id} must have tier`);
    assert(ach.xp > 0, `Achievement ${ach.id} must have positive XP`);
  }
  console.log(`  ✔ 6.2: All ${ACHIEVEMENTS_REGISTRY.length} achievements in registry are fully compliant\n`);

  console.log('================================================================');
  console.log('🎉 ALL ROLE LOADOUT BALANCING & ACHIEVEMENTS TESTS PASSED (100%)');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
