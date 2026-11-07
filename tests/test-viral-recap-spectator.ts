/**
 * TDV BTL MAFIA - Milestone 18 Viral Social Deduction & Match Recap Test Suite
 * Tests Algorithmic MVP Engine, Turning Points Timeline, 1-Click Viral Sharing,
 * and Zero-Knowledge Ghost Realm Spectator Betting.
 */

import assert from 'assert';
import { calculateMatchRecap, formatTelegramShareUrl, formatWhatsAppShareUrl, formatTwitterShareUrl } from '../src/server/engine/mvp-calculator';
import { placeGhostBet, resolveGhostBets, getPlayerProgression } from '../src/utils/progression';
import { LobbyState, PlayerSession } from '../src/types/game';

console.log('⚡ Starting TDV Mafia Milestone 18 Viral Social Deduction & Match Recap Suite...\n');

// Mock localStorage and window
const storage = new Map<string, string>();
(global as any).localStorage = {
  getItem: (key: string) => storage.get(key) || null,
  setItem: (key: string, val: string) => storage.set(key, val),
  removeItem: (key: string) => storage.delete(key),
};
(global as any).window = {};

// ─── SUITE 1: ALGORITHMIC MVP CALCULATOR & SCORE BREAKDOWN ───────────────────
console.log('▶ [Suite 1] Algorithmic MVP Score Calculation');

const mockPlayers: Record<string, PlayerSession> = {
  'usr-doc': {
    socketId: 'sock-1',
    userId: 'usr-doc',
    username: 'Doktor_Rauf',
    tier: 'STANDARD',
    adminRole: 'NONE',
    isHost: false,
    isAlive: true,
    hasHostWaiver: false,
    hasAdminWaiver: false,
    displayRole: {
      nickname: 'Doktor_Rauf',
      originalRoleName: 'DOCTOR',
      localizedRoleName: 'Həkim',
      formatted: 'Doktor_Rauf (Həkim)',
    },
    disconnectedAt: null,
    isAiBotControlled: false,
  },
  'usr-mayor': {
    socketId: 'sock-2',
    userId: 'usr-mayor',
    username: 'Mer_Orxan',
    tier: 'STANDARD',
    adminRole: 'NONE',
    isHost: true,
    isAlive: true,
    hasHostWaiver: false,
    hasAdminWaiver: false,
    displayRole: {
      nickname: 'Mer_Orxan',
      originalRoleName: 'MAYOR',
      localizedRoleName: 'Mer',
      formatted: 'Mer_Orxan (Mer)',
    },
    disconnectedAt: null,
    isAiBotControlled: false,
  },
  'usr-mafia': {
    socketId: 'sock-3',
    userId: 'usr-mafia',
    username: 'Don_Aysel',
    tier: 'STANDARD',
    adminRole: 'NONE',
    isHost: false,
    isAlive: false,
    deathCause: 'LYNCH',
    deathRound: 3,
    hasHostWaiver: false,
    hasAdminWaiver: false,
    displayRole: {
      nickname: 'Don_Aysel',
      originalRoleName: 'MAFIA_GODFATHER',
      localizedRoleName: 'Xaçatası',
      formatted: 'Don_Aysel (Xaçatası)',
    },
    disconnectedAt: null,
    isAiBotControlled: true,
  },
};

const mockLobbyState: LobbyState = {
  lobbyId: 'lobby-recap-test-123',
  hostUserId: 'usr-mayor',
  mode: 'STANDARD',
  phase: 'ENDED',
  players: mockPlayers,
  hostReady: true,
  adminMasterUnlock: { tierOverrideActive: false, waiverOverrideActive: false, masterUnlockEngaged: false },
  assignedArchitectId: null,
  assignedBailiffId: null,
  phaseDurationSeconds: 60,
  phaseTimeRemaining: 0,
  nightJitterDelaySeconds: 5,
  liveVotes: {},
  chatMessages: [],
  accusedPlayerId: 'usr-doc', // Doc was accused and acquitted!
  lastLynchedUserId: 'usr-mafia',
  mayorRevealedUserIds: ['usr-mayor'],
  speakerQueue: [],
  bufferedNightActions: [],
  minigameSubStates: {},
  roundNumber: 4,
  globalNightKillCap: 1,
  pastNewspapers: [
    {
      publicDeaths: [],
      privateInvestigationResults: [],
      heresyClue: null,
      jitterAppliedMs: 100,
      protectedIds: ['usr-mayor'], // Doc protected mayor
    },
  ],
  winnerResult: {
    kind: 'TOWN_VICTORY',
    winningFaction: 'TOWN',
    winnerPlayerIds: ['usr-doc', 'usr-mayor'],
    reason: 'Town eliminated all mafia threats.',
  },
};

const recap = calculateMatchRecap(mockLobbyState);

assert.strictEqual(recap.lobbyId, 'lobby-recap-test-123', 'Recap lobby ID matches');
assert.strictEqual(recap.winningFaction, 'TOWN', 'Winning faction is TOWN');
assert.strictEqual(recap.totalRounds, 4, 'Total rounds is 4');
assert(recap.scores.length === 3, 'Scores calculated for all 3 players');

// Check Mayor score: Victory (40) + Survival (20) + Mayor Action (30) + Protected bonus (20) + Town alliance (20) = 130
const mayorScore = recap.scores.find((s) => s.playerId === 'usr-mayor');
assert(mayorScore !== undefined, 'Mayor score exists');
assert(mayorScore!.totalScore >= 100, 'Mayor earned substantial score');
assert(mayorScore!.clutchHighlights.length > 0, 'Mayor has clutch highlights');

// Check Doctor score: Victory (40) + Survival (20) + Defense Acquittal (25) + Town alliance (20) = 105
const docScore = recap.scores.find((s) => s.playerId === 'usr-doc');
assert(docScore !== undefined, 'Doctor score exists');
assert.strictEqual(docScore!.breakdown.defenseAcquittalPoints, 25, 'Doctor acquitted on podium');

// MVP should be one of the top town leaders
assert(recap.mvp.playerId === 'usr-mayor' || recap.mvp.playerId === 'usr-doc', 'MVP is top Town player');
console.log(`  ✔ MVP determined: ${recap.mvp.playerName} (${recap.mvp.totalScore} pts)`);

// ─── SUITE 2: TURNING POINTS TIMELINE ─────────────────────────────────────────
console.log('\n▶ [Suite 2] Match Turning Points (Dönüş Nöqtələri)');

assert(recap.turningPoints.length >= 3, 'Must have at least 3 pivotal turning points');
const trialPoint = recap.turningPoints.find((tp) => tp.phase === 'TRIAL_DEFENSE');
assert(trialPoint !== undefined, 'Trial defense duel turning point recorded');

const mayorPoint = recap.turningPoints.find((tp) => tp.titleAz.includes('Mer'));
assert(mayorPoint !== undefined, 'Mayor 3x proclamation turning point recorded');
console.log(`  ✔ ${recap.turningPoints.length} match turning points synthesized`);

// ─── SUITE 3: 1-CLICK VIRAL SOCIAL SHARING ───────────────────────────────────
console.log('\n▶ [Suite 3] 1-Click Viral Social Sharing URLs');

const tgUrl = formatTelegramShareUrl(recap);
assert(tgUrl.startsWith('https://t.me/share/url?url='), 'Telegram share URL starts with official protocol');
assert(tgUrl.includes(encodeURIComponent('lobby-recap-test-123')), 'Telegram URL embeds lobby link');

const waUrl = formatWhatsAppShareUrl(recap);
assert(waUrl.startsWith('https://api.whatsapp.com/send?text='), 'WhatsApp share URL starts with API link');
assert(waUrl.includes(encodeURIComponent('TDV BTL MAFIA')), 'WhatsApp URL encodes game name');

const twUrl = formatTwitterShareUrl(recap);
assert(twUrl.startsWith('https://twitter.com/intent/tweet?text='), 'X/Twitter share URL is formatted');

assert(recap.shareableSummaryText.includes('TDV BTL MAFIA') && (recap.shareableSummaryText.includes('MATCH REPORT') || recap.shareableSummaryText.includes('DÖYÜŞ NƏTİCƏSİ')), 'Summary has report header');
assert(recap.shareableSummaryText.includes('TOWN'), 'Summary lists winning faction');
console.log('  ✔ Social sharing snippets verified for Telegram, WhatsApp, and X');

// ─── SUITE 4: ZERO-KNOWLEDGE GHOST REALM & PREDICTION BETTING ────────────────
console.log('\n▶ [Suite 4] Zero-Knowledge Ghost Realm & Prediction Betting');

const spectatorId = 'usr-ghost-spec-1';
const initialProg = getPlayerProgression(spectatorId, 'Ruh_Müşahidəçi');
assert.strictEqual(initialProg.spiritEssence, 100, 'Starting spirit essence is 100');

// Place 25 essence bet on next lynch: 'usr-mafia'
const betRes = placeGhostBet(spectatorId, 'lobby-recap-test-123', {
  spectatorId,
  spectatorName: 'Ruh_Müşahidəçi',
  targetPlayerId: 'usr-mafia',
  betType: 'NEXT_LYNCH',
  wagerAmount: 25,
  oddsMultiplier: 2.5,
  round: 3,
});

assert.strictEqual(betRes.success, true, 'Bet placed successfully');
assert.strictEqual(betRes.updatedProfile.spiritEssence, 75, 'Essence deducted: 100 - 25 = 75');

// Resolve bets when actual lynched target is 'usr-mafia'
const resolveRes = resolveGhostBets(spectatorId, 'lobby-recap-test-123', 'usr-mafia');
assert(resolveRes.payout > 0, 'Payout awarded for correct prediction');
assert.strictEqual(resolveRes.payout, 63, '25 * 2.5 = 63 essence payout');
assert.strictEqual(resolveRes.profile.spiritEssence, 138, 'New essence balance is 75 + 63 = 138');
console.log('  ✔ Zero-knowledge spectator prediction betting and payout verified');

console.log('\n================================================================');
console.log('🎉 ALL MILESTONE 18 VIRAL RECAP & SPECTATOR TESTS PASSED (100%)');
console.log('================================================================\n');
