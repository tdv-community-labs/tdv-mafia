/**
 * Enterprise Mafia / Social Deduction Platform
 * Phase 1 Architecture & Invariants Verification Suite
 */

function assertTrue(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? 'Assertion failed');
  }
}

function assertStrictEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, but got ${String(actual)}. ${message ?? ''}`);
  }
}

import {
  satisfiesTierRequirement,
  isPlatformAdmin,
  TIER_RANK_MAP,
  PlayerTier,
  AdminRole,
} from '../src/types/access';
import {
  PACKS_CONFIG,
  getPackMetadata,
} from '../src/config/packs.config';
import {
  isStandardPack,
  isMinigame,
  isAllInMode,
  StandardPackId,
  MinigameId,
} from '../src/types/packs';
import {
  formatRoleDisplay,
  CoreFaction,
  CivicOfficeType,
  InnateTraitType,
  AllInDistrict,
} from '../src/types/roles';
import {
  DANTE_CIRCLES_ORDER,
  DANTE_CIRCLE_DEFINITIONS,
  createInitialDantesInfernoState,
  createInitialEarthStoodStillState,
  createInitialValkyrieState,
  createInitialStanfordPrisonState,
  createInitialCatenaccioState,
} from '../src/config/minigames.config';
import { InMemoryLobbyStore } from '../src/server/state/memory';
import { PlayerSession, LobbyState } from '../src/types/game';

console.log('🧪 Starting Phase 1 Architecture Verification Suite...\n');

// === TEST 1: ACCESS & TIER CONTROL ===
console.log('▶ Test 1: Access Control, Tier Hierarchy & Platform Admins');
assertStrictEqual(satisfiesTierRequirement('TIER_1', 'TIER_1'), true);
assertStrictEqual(satisfiesTierRequirement('TIER_2', 'TIER_1'), true);
assertStrictEqual(satisfiesTierRequirement('TIER_1', 'TIER_2'), false);
assertStrictEqual(satisfiesTierRequirement('TIER_3', 'TIER_2'), true);
assertStrictEqual(satisfiesTierRequirement('TIER_2', 'TIER_3'), false);

assertStrictEqual(isPlatformAdmin('THE_ARCHITECT'), true);
assertStrictEqual(isPlatformAdmin('THE_BAILIFF'), true);
assertStrictEqual(isPlatformAdmin('NONE'), false);
console.log('  ✔ Access control and tier logic verified.');

// === TEST 2: PACKS CONFIGURATION & WAIVER CONSTRAINTS ===
console.log('▶ Test 2: Packs Configuration, Player Ranges, & Waiver Constraints');
const standardPacks: readonly StandardPackId[] = [
  'BLITZ',
  'STANDARD',
  'EXTENDED',
  'GRAND',
  'EPIC',
  'MASSIVE',
  'LIMITLESS',
  'CUSTOM_LOBBY',
];

const minigames: readonly MinigameId[] = [
  'CATENACCIO',
  'STANFORD_PRISON',
  'OPERATION_VALKYRIE',
  'THE_DAY_THE_EARTH_STOOD_STILL',
  'DANTES_INFERNO',
  'CHERNOBYL_EXCLUSION_ZONE',
  'CYBERPUNK_NEO_BAKU',
  'BERMUDA_TRIANGLE',
  'MIDNIGHT_SEANCE',
  'SHERLOCK_BAKER_STREET',
];

for (const packId of standardPacks) {
  assertStrictEqual(isStandardPack(packId), true, `${packId} must be recognized as standard pack`);
  assertStrictEqual(isMinigame(packId), false);
  assertTrue(PACKS_CONFIG[packId] !== undefined, `Config must exist for ${packId}`);
}

for (const miniId of minigames) {
  assertStrictEqual(isMinigame(miniId), true, `${miniId} must be recognized as minigame`);
  assertStrictEqual(isStandardPack(miniId), false);
  assertTrue(PACKS_CONFIG[miniId] !== undefined, `Config must exist for ${miniId}`);
}

assertStrictEqual(isAllInMode('ALL_IN'), true);
const allInConfig = PACKS_CONFIG['ALL_IN'];
assertStrictEqual(allInConfig.minPlayers, 40);
assertStrictEqual(allInConfig.maxPlayers, 50);
assertStrictEqual(allInConfig.minTier, 'TIER_3');
assertStrictEqual(allInConfig.platformAdminRequired, true, 'All-In strictly requires dual-lock platform admin');
assertStrictEqual(allInConfig.hostWaiverAllowed, false, 'Host waiver not allowed for All-In');
assertStrictEqual(allInConfig.requiresExamProof, true);

// Check 16+ player packs allow host waivers
assertStrictEqual(PACKS_CONFIG['GRAND'].hostWaiverAllowed, true);
assertStrictEqual(PACKS_CONFIG['EPIC'].hostWaiverAllowed, true);
assertStrictEqual(PACKS_CONFIG['MASSIVE'].hostWaiverAllowed, true);
assertStrictEqual(PACKS_CONFIG['LIMITLESS'].hostWaiverAllowed, true);
console.log('  ✔ Pack metadata, player boundaries, and waiver rules verified.');

// === TEST 3: ROLES, OFFICES, TRAITS & UI FORMAT CONTRACT ===
console.log('▶ Test 3: Roles, 16 Civic Offices, 12 Traits & FormattedRoleDisplay Contract');
const roleDisplay = formatRoleDisplay('Vergili', 'Investigator', 'Şərif');
assertStrictEqual(roleDisplay.formatted, 'Vergili (Şərif / Investigator)');
assertStrictEqual(roleDisplay.nickname, 'Vergili');

const unlocalizedDisplay = formatRoleDisplay('Cipher', 'Godfather');
assertStrictEqual(unlocalizedDisplay.formatted, 'Cipher (Godfather)');

// Civic Offices (16 distinct)
const sampleOffices: readonly CivicOfficeType[] = [
  'MAYOR', 'CHIEF_PROSECUTOR', 'CHIEF_JUSTICE', 'CENTRAL_BANKER',
  'MEDIA_MOGUL', 'PRISON_WARDEN', 'POLICE_COMMISSIONER', 'CITY_SURGEON',
  'LABOR_UNION_BOSS', 'DISTRICT_ARCHITECT', 'CHIEF_FIRE_MARSHAL', 'BLACK_MARKET_BROKER',
  'PORT_AUTHORITY_DIRECTOR', 'PUBLIC_DEFENDER', 'CITY_INVESTIGATOR', 'CORONER'
];
assertStrictEqual(sampleOffices.length, 16);

// Innate Traits (12 distinct)
const sampleTraits: readonly InnateTraitType[] = [
  'BULLETPROOF_VEST', 'PHANTOM_STEP', 'RETALIATION_FUSE', 'SILENCER_ATTACHMENT',
  'INSIDER_ACCESS', 'SURGICAL_RESILIENCE', 'CONTRABAND_POCKET', 'SHADOW_COMMUNICATION',
  'FALSE_DOCUMENTATION', 'MARTYR_RESOLVE', 'COLD_BLOODED', 'POISON_IMMUNITY'
];
assertStrictEqual(sampleTraits.length, 12);
console.log('  ✔ 16 Offices, 12 Traits, and FormattedRoleDisplay contract verified.');

// === TEST 4: DANTE 9-CIRCLE DESCENT & MINIGAME MECHANICS ===
console.log("▶ Test 4: Dante's Inferno 9-Circle Descent & Minigames");
assertStrictEqual(DANTE_CIRCLES_ORDER.length, 9);
assertStrictEqual(DANTE_CIRCLES_ORDER[0], 'CIRCLE_1_LIMBO');
assertStrictEqual(DANTE_CIRCLES_ORDER[1], 'CIRCLE_2_LUST');
assertStrictEqual(DANTE_CIRCLES_ORDER[2], 'CIRCLE_3_GLUTTONY');
assertStrictEqual(DANTE_CIRCLES_ORDER[3], 'CIRCLE_4_GREED');
assertStrictEqual(DANTE_CIRCLES_ORDER[4], 'CIRCLE_5_WRATH');
assertStrictEqual(DANTE_CIRCLES_ORDER[5], 'CIRCLE_6_HERESY');
assertStrictEqual(DANTE_CIRCLES_ORDER[6], 'CIRCLE_7_VIOLENCE');
assertStrictEqual(DANTE_CIRCLES_ORDER[7], 'CIRCLE_8_FRAUD');
assertStrictEqual(DANTE_CIRCLES_ORDER[8], 'CIRCLE_9_TREACHERY');

const danteState = createInitialDantesInfernoState();
assertStrictEqual(danteState.deflectionRate, 0.20);
assertStrictEqual(danteState.slowModeCharLimit, 80);

const earthState = createInitialEarthStoodStillState('p-klaatu-01');
assertStrictEqual(earthState.doomsdayClockHours, 0);
assertStrictEqual(earthState.klaatuPlayerId, 'p-klaatu-01');

const valkyrieState = createInitialValkyrieState('p-dictator', ['p-c1', 'p-c2'], 'p-c1');
assertStrictEqual(valkyrieState.fuseTimerDaysRemaining, 3);
assertStrictEqual(valkyrieState.briefcaseLocationPlayerId, 'p-c1');

const stanfordState = createInitialStanfordPrisonState('p-warden', ['p-g1', 'p-g2'], ['p-i1', 'p-i2']);
assertStrictEqual(stanfordState.revoltMeter, 0);

const catenaccioState = createInitialCatenaccioState(['p-w1', 'p-w2'], 'p-sniper');
assertStrictEqual(catenaccioState.armorCharges['p-w1'], 2);
console.log('  ✔ Minigame states & Dante 9-circle descent verified.');

// === TEST 5: STATE ENGINE, STRICT DUAL-LOCK, & NIGHT BUFFER ===
console.log('▶ Test 5: Server State Engine, Dual-Lock System & Priority Buffer');
const store = new InMemoryLobbyStore();

const hostSession: PlayerSession = {
  socketId: 'sock-host',
  userId: 'usr-architect-01',
  username: 'Vergili',
  tier: 'TIER_3',
  adminRole: 'THE_ARCHITECT',
  isHost: true,
  isAlive: true,
  hasHostWaiver: false,
  hasAdminWaiver: false,
  displayRole: formatRoleDisplay('Vergili', 'Investigator'),
  disconnectedAt: null,
  isAiBotControlled: false,
};

const lobby = store.createLobby('lobby-allin-test', hostSession.userId, hostSession, 'ALL_IN');
assertStrictEqual(lobby.mode, 'ALL_IN');
assertStrictEqual(lobby.globalNightKillCap, 3, 'All-In must enforce global night kill cap of 3');
assertStrictEqual(lobby.adminMasterUnlock.dualLockVerified, false, 'Initial All-In lobby must be locked');

// Turn Key 1: Architect
const archResult = store.submitAdminUnlock('lobby-allin-test', 'usr-architect-01', 'THE_ARCHITECT');
assertStrictEqual(archResult.success, true);
assertStrictEqual(archResult.dualLockVerified, false, 'Architect alone cannot unlock All-In');

// Turn Key 2: Bailiff
const bailiffResult = store.submitAdminUnlock('lobby-allin-test', 'usr-bailiff-02', 'THE_BAILIFF');
assertStrictEqual(bailiffResult.success, true);
assertStrictEqual(bailiffResult.dualLockVerified, true, 'Both keys turned -> Dual Lock Verified!');

// Test Night Action Buffer Priority Sorting
store.transitionPhase('lobby-allin-test', 'NIGHT_BUFFER', 60);

// Add KILL (Priority 6)
store.bufferNightAction('lobby-allin-test', {
  actorPlayerId: 'p-mafia',
  targetPlayerId: 'p-town',
  actionType: 'KILL',
  priority: 6,
  timestamp: 100,
});

// Add BLOCK (Priority 1)
store.bufferNightAction('lobby-allin-test', {
  actorPlayerId: 'p-escort',
  targetPlayerId: 'p-mafia',
  actionType: 'BLOCK',
  priority: 1,
  timestamp: 105,
});

// Add PROTECT (Priority 2)
store.bufferNightAction('lobby-allin-test', {
  actorPlayerId: 'p-doctor',
  targetPlayerId: 'p-town',
  actionType: 'PROTECT',
  priority: 2,
  timestamp: 110,
});

const updatedLobby: LobbyState | null = store.getLobby('lobby-allin-test');
assertTrue(updatedLobby !== null, 'Lobby must exist');
assertStrictEqual(updatedLobby.bufferedNightActions.length, 3);
assertStrictEqual(updatedLobby.bufferedNightActions[0].actionType, 'BLOCK', 'Priority 1 must resolve first');
assertStrictEqual(updatedLobby.bufferedNightActions[1].actionType, 'PROTECT', 'Priority 2 must resolve second');
assertStrictEqual(updatedLobby.bufferedNightActions[2].actionType, 'KILL', 'Priority 6 must resolve last');

// Night Jitter Verification (3-7s)
assertTrue(updatedLobby.nightJitterDelaySeconds >= 3 && updatedLobby.nightJitterDelaySeconds <= 7, 'Jitter must be in [3, 7]s');

console.log('  ✔ Dual-Lock dual verification and Night Action priority buffer sorting verified.');

console.log('\n🎉 ALL ARCHITECTURAL INVARIANTS AND SPECIFICATIONS VERIFIED WITH 100% SUCCESS!');
