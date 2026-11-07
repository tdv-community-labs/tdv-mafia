/**
 * TDV BTL MAFIA - Milestone 17 Progression, Retention & Prestige Cosmetics Test Suite
 * Tests Level Curve Math (1-100+), 7-Tier Ranked Ladder, Demotion Shield Protection,
 * Unified ProgressionManager Persistence, and Cosmetic Equipping.
 */

import assert from 'assert';
import {
  calculateLevelFromXp,
  getXpForLevel,
  getLevelProgress,
  calculateRankTierFromElo,
  applyEloAdjustment,
  getPlayerProgression,
  savePlayerProgression,
  recordMatchProgression,
  equipCosmeticItem,
  RANK_TIERS,
  RANK_ORDER,
  COSMETIC_BORDERS,
  COSMETIC_TITLES,
} from '../src/utils/progression';

console.log('🏆 Starting TDV Mafia Milestone 17 Progression & Retention Suite...\n');

// ─── SUITE 1: LEVEL CURVE MATH & PROGRESS PERCENTAGES ────────────────────────
console.log('▶ [Suite 1] Level Curve Math (1-100+) & Progress Percentages');

// Level 1 starts at 0 XP
assert.strictEqual(calculateLevelFromXp(0), 1, '0 XP should be Level 1');
assert.strictEqual(calculateLevelFromXp(50), 1, '50 XP should still be Level 1');

// Level 2 requires floor(100 * 1^1.5) = 100 XP
assert.strictEqual(getXpForLevel(2), 100, 'Level 2 requires 100 XP');
assert.strictEqual(calculateLevelFromXp(100), 2, '100 XP should reach Level 2');
assert.strictEqual(calculateLevelFromXp(250), 2, '250 XP should be Level 2');

// Level 3 requires 100 + floor(100 * 2^1.5) = 100 + 282 = 382 XP
const lvl3Floor = getXpForLevel(3);
assert.strictEqual(lvl3Floor, 382, 'Level 3 requires 382 total XP');
assert.strictEqual(calculateLevelFromXp(382), 3, '382 XP should reach Level 3');

// Level Progress percentages
const prog1 = getLevelProgress(191); // halfway through level 2
assert.strictEqual(prog1.level, 2, 'Level should be 2');
assert.strictEqual(prog1.currentLevelXp, 91, 'Current level earned XP should be 91');
assert(prog1.progressPercentage > 30 && prog1.progressPercentage < 35, 'Progress percentage should be ~32%');

// Level 50 and Level 100 monotonic growth
const lvl50Xp = getXpForLevel(50);
const lvl100Xp = getXpForLevel(100);
assert(lvl50Xp > 0 && lvl100Xp > lvl50Xp, 'Level curve must strictly increase monotonically');
console.log(`  ✔ Level curve calibrated: Lvl 1=0 XP, Lvl 2=100 XP, Lvl 3=382 XP, Lvl 50=${lvl50Xp} XP, Lvl 100=${lvl100Xp} XP`);

// ─── SUITE 2: 7-TIER RANKED LADDER & DEMOTION SHIELD ────────────────────────
console.log('\n▶ [Suite 2] 7-Tier Ranked Ladder & Demotion Shield Protection');

assert.strictEqual(RANK_ORDER.length, 7, 'There must be exactly 7 rank tiers');
assert.strictEqual(calculateRankTierFromElo(800), 'NOVICE_DETECTIVE', '800 ELO -> NOVICE_DETECTIVE');
assert.strictEqual(calculateRankTierFromElo(1150), 'DEPUTY_INQUISITOR', '1150 ELO -> DEPUTY_INQUISITOR');
assert.strictEqual(calculateRankTierFromElo(1350), 'HIGH_MAGISTRATE', '1350 ELO -> HIGH_MAGISTRATE');
assert.strictEqual(calculateRankTierFromElo(1550), 'SYNDICATE_ENFORCER', '1550 ELO -> SYNDICATE_ENFORCER');
assert.strictEqual(calculateRankTierFromElo(1750), 'UNDERBOSS', '1750 ELO -> UNDERBOSS');
assert.strictEqual(calculateRankTierFromElo(1950), 'SYNDICATE_DON', '1950 ELO -> SYNDICATE_DON');
assert.strictEqual(calculateRankTierFromElo(2300), 'SUPREME_GODFATHER', '2300 ELO -> SUPREME_GODFATHER');

// Demotion Shield: Player at 1310 (HIGH_MAGISTRATE, threshold 1300) loses 20 ELO -> 1290 ELO
// Within 35 ELO threshold and streak 1 -> shield protects tier!
const adj1 = applyEloAdjustment(1310, 'HIGH_MAGISTRATE', -20, 0);
assert.strictEqual(adj1.newElo, 1290, 'ELO drops to 1290');
assert.strictEqual(adj1.newTier, 'HIGH_MAGISTRATE', 'Tier remains HIGH_MAGISTRATE via Demotion Shield');
assert.strictEqual(adj1.demotionShieldActive, true, 'Demotion shield should be active');
assert.strictEqual(adj1.newLosingStreak, 1, 'Losing streak is 1');

// Second loss: 1290 - 10 = 1280 ELO (streak 2 -> still shielded)
const adj2 = applyEloAdjustment(1290, 'HIGH_MAGISTRATE', -10, 1);
assert.strictEqual(adj2.demotionShieldActive, true, 'Demotion shield continues on streak 2');

// Third consecutive loss: streak reaches 3 -> shield breaks and demotes!
const adj3 = applyEloAdjustment(1280, 'HIGH_MAGISTRATE', -15, 2);
assert.strictEqual(adj3.newTier, 'DEPUTY_INQUISITOR', 'Shield breaks on 3rd loss and player demotes');
assert.strictEqual(adj3.demotionShieldActive, false, 'Demotion shield deactivated');
console.log('  ✔ 7-Tier boundaries and demotion shield protection verified');

// ─── SUITE 3: COSMETIC BORDERS & TITLES REGISTRY ─────────────────────────────
console.log('\n▶ [Suite 3] Battleground Prestige Cosmetics Registry');

assert(COSMETIC_BORDERS.length >= 7, 'Must have at least 7 cosmetic borders');
assert(COSMETIC_TITLES.length >= 7, 'Must have at least 7 cosmetic titles');

const godfatherBorder = COSMETIC_BORDERS.find((b) => b.id === 'border_godfather_chromatic');
assert(godfatherBorder !== undefined, 'Chromatic godfather border must exist');
assert.strictEqual(godfatherBorder?.rarity, 'MYTHIC', 'Godfather border rarity is MYTHIC');

const miracleTitle = COSMETIC_TITLES.find((t) => t.id === 'title_doctor_miracle');
assert(miracleTitle !== undefined, 'Miracle Doctor title must exist');
assert.strictEqual(miracleTitle?.achievementId, 'town_doctor_miracle_save', 'Linked to doctor save achievement');
console.log('  ✔ Prestige borders and title definitions verified');

// ─── SUITE 4: MATCH PROGRESSION & CLUTCH XP GAINS ───────────────────────────
console.log('\n▶ [Suite 4] Match Progression & Itemized Clutch Rewards');

// Mock localStorage for node environment
const storage = new Map<string, string>();
(global as any).localStorage = {
  getItem: (key: string) => storage.get(key) || null,
  setItem: (key: string, val: string) => storage.set(key, val),
  removeItem: (key: string) => storage.delete(key),
};
(global as any).window = {};

const testUserId = 'test_usr_prog_01';
const initialProfile = getPlayerProgression(testUserId, 'Əli_Xəfiyyə');
assert.strictEqual(initialProfile.xp, 0, 'Initial XP should be 0');
assert.strictEqual(initialProfile.level, 1, 'Initial Level should be 1');

// Record a Town Win (+200 base XP) with a clutch Doctor Save (+100 XP)
const outcome1 = recordMatchProgression(testUserId, 'lobby_round_01', true, 'TOWN', [
  { reason: 'CLUTCH_DOCTOR_SAVE', xp: 100, labelAz: 'Möcüzəvi Həkim Xilasetməsi' },
]);

assert.strictEqual(outcome1.xpGained, 300, '300 total XP earned (200 base + 100 clutch)');
assert.strictEqual(outcome1.profile.xp, 300, 'Profile total XP is 300');
assert.strictEqual(outcome1.profile.wins, 1, 'Profile wins is 1');
assert.strictEqual(outcome1.profile.townWins, 1, 'Town wins is 1');
assert(outcome1.profile.playedLobbies.includes('lobby_round_01'), 'Lobby recorded in playedLobbies');

// Duplicate lobby protection
const dupOutcome = recordMatchProgression(testUserId, 'lobby_round_01', true, 'TOWN');
assert.strictEqual(dupOutcome.xpGained, 0, 'Duplicate match yields 0 XP');

// Equip cosmetic border and title
const updatedProfile = equipCosmeticItem(testUserId, 'BORDER', 'border_blood_syndicate');
assert.strictEqual(updatedProfile.equippedCosmetics.borderId, 'border_blood_syndicate', 'Border successfully equipped');

const titleProfile = equipCosmeticItem(testUserId, 'TITLE', 'title_doctor_miracle');
assert.strictEqual(titleProfile.equippedCosmetics.titleId, 'title_doctor_miracle', 'Title successfully equipped');

console.log('  ✔ Match progression, clutch XP calculation and cosmetic equipping verified');

console.log('\n================================================================');
console.log('🎉 ALL MILESTONE 17 PROGRESSION & RETENTION TESTS PASSED (100%)');
console.log('================================================================\n');
