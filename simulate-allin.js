/**
 * TDV Mafia — ALL-IN Game Simulator (3 consecutive games)
 * Tests: engine logic, AI bot decisions, win-condition detection, night resolver, voting engine
 * Requires: Node.js 18+ (native fetch), no external npm packages needed beyond project
 *
 * API keys are loaded from .env.local (never committed). Set:
 *   GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3
 */

'use strict';

// ─── Load .env.local ──────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
try {
  const envFile = path.join(__dirname, '.env.local');
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const line of lines) {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    }
  }
} catch { /* env load is best-effort */ }

// ─── API Keys (from environment, never hardcoded) ─────────────────────────────
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean);

if (GEMINI_KEYS.length === 0) {
  console.warn('⚠️  No GEMINI_API_KEY_* env vars found — simulation will run heuristic-only mode.');
}

const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-2.5-flash'];

let _activeKeyIdx = 0;
const bugs = [];
const simLog = [];

function log(msg) { simLog.push(msg); console.log(msg); }
function bug(title, details) { bugs.push({ title, details }); console.error(`  ❌ BUG: ${title}`, details || ''); }
function ok(msg) { console.log(`  ✅ ${msg}`); }

// ─── Gemini Call with Cascade Fallback ───────────────────────────────────────
async function callGemini(prompt, systemInstruction = '') {
  for (let ki = 0; ki < GEMINI_KEYS.length; ki++) {
    const key = GEMINI_KEYS[(_activeKeyIdx + ki) % GEMINI_KEYS.length];
    for (const model of GEMINI_MODELS) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `HTTP ${res.status}`;
          const isTemp = res.status === 503 || res.status === 404 || /overload|demand|unavailable|unsupported/i.test(errMsg);
          if (isTemp) continue;
          break;
        }
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
        if (text) {
          _activeKeyIdx = (_activeKeyIdx + ki) % GEMINI_KEYS.length;
          return { text, model, key: key.slice(-6) };
        }
      } catch (e) {
        if (/demand|unavailable|overload/i.test(e.message)) continue;
        break;
      }
    }
  }
  return null;
}

// ─── Role Definitions for All-In ─────────────────────────────────────────────
const FACTIONS = ['TOWN', 'MAFIA', 'YAKUZA', 'VOID_CULT', 'NEUTRAL_KILLER', 'NEUTRAL_BENIGN', 'NEUTRAL_EVIL'];
const OFFICES = [
  'MAYOR', 'CHIEF_PROSECUTOR', 'CHIEF_JUSTICE', 'CENTRAL_BANKER', 'MEDIA_MOGUL',
  'PRISON_WARDEN', 'POLICE_COMMISSIONER', 'CITY_SURGEON', 'LABOR_UNION_BOSS',
  'DISTRICT_ARCHITECT', 'CHIEF_FIRE_MARSHAL', 'BLACK_MARKET_BROKER',
  'PORT_AUTHORITY_DIRECTOR', 'PUBLIC_DEFENDER', 'CITY_INVESTIGATOR', 'CORONER'
];
const TRAITS = [
  'BULLETPROOF_VEST', 'PHANTOM_STEP', 'RETALIATION_FUSE', 'SILENCER_ATTACHMENT',
  'INSIDER_ACCESS', 'SURGICAL_RESILIENCE', 'CONTRABAND_POCKET', 'SHADOW_COMMUNICATION',
  'FALSE_DOCUMENTATION', 'MARTYR_RESOLVE', 'COLD_BLOODED', 'POISON_IMMUNITY'
];
const DISTRICTS = ['ELITE', 'COMMERCIAL', 'INDUSTRIAL'];
const NIGHT_ACTION_TYPES = ['KILL', 'PROTECT', 'INVESTIGATE', 'BLOCK', 'MISDIRECT', 'FRAME'];
const ACTION_PRIORITY = { BLOCK: 1, MISDIRECT: 2, PROTECT: 3, KILL: 4, FRAME: 5, INVESTIGATE: 6 };
// Faction -> what night action they typically do
const FACTION_CAPABILITY = {
  MAFIA: 'KILL', YAKUZA: 'KILL', VOID_CULT: 'KILL', NEUTRAL_KILLER: 'KILL',
  TOWN: 'INVESTIGATE', NEUTRAL_BENIGN: null, NEUTRAL_EVIL: 'FRAME',
};
// Office-based overrides
const OFFICE_CAPABILITY = {
  CITY_SURGEON: 'PROTECT', CHIEF_FIRE_MARSHAL: 'BLOCK',
  CITY_INVESTIGATOR: 'INVESTIGATE', CORONER: 'INVESTIGATE',
  PORT_AUTHORITY_DIRECTOR: 'MISDIRECT', MEDIA_MOGUL: 'FRAME',
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

// ─── Player Factory ───────────────────────────────────────────────────────────
function makePlayer(i, factionOverride) {
  const faction = factionOverride || pick(FACTIONS);
  const office = pick(OFFICES);
  const trait = pick(TRAITS);
  const district = pick(DISTRICTS);
  const capability = OFFICE_CAPABILITY[office] || FACTION_CAPABILITY[faction] || 'INVESTIGATE';
  return {
    userId: `player-${i}`,
    username: `P${i}`,
    isAlive: true,
    isAiBotControlled: true,
    allInIdentity: { layer1Faction: faction, layer2Office: office, layer3Trait: trait, district },
    nightCapability: capability,
    // voting weight
    voteWeight: ['MAYOR', 'CHIEF_PROSECUTOR', 'CHIEF_JUSTICE', 'POLICE_COMMISSIONER', 'LABOR_UNION_BOSS', 'CITY_INVESTIGATOR'].includes(office) ? 2 : 1,
  };
}

// ─── ALL-IN Game Factory (40 players with realistic faction distribution) ─────
function buildAllInGame(gameIdx) {
  // Realistic All-In composition: 10 Mafia, 4 Yakuza, 2 VoidCult, 1 NK, 1 NE, 2 NB, 20 Town
  const factions = [
    ...Array(10).fill('MAFIA'),
    ...Array(4).fill('YAKUZA'),
    ...Array(2).fill('VOID_CULT'),
    ...Array(1).fill('NEUTRAL_KILLER'),
    ...Array(1).fill('NEUTRAL_EVIL'),
    ...Array(2).fill('NEUTRAL_BENIGN'),
    ...Array(20).fill('TOWN'),
  ];
  const shuffled = shuffle(factions);
  const players = {};
  for (let i = 0; i < 40; i++) {
    const p = makePlayer(i + 1, shuffled[i]);
    players[p.userId] = p;
  }
  return {
    lobbyId: `sim-lobby-${gameIdx}`,
    mode: 'ALL_IN',
    phase: 'DAY_CENTRAL_ASSEMBLY',
    players,
    globalNightKillCap: 3,
    roundNumber: 1,
    lastLynchedUserId: null,
    liveVotes: {},
    bufferedNightActions: [],
    winnerResult: null,
  };
}

// ─── Win Condition Evaluator ──────────────────────────────────────────────────
function evaluateWin(game) {
  const alive = Object.values(game.players).filter(p => p.isAlive);
  const aliveCount = alive.length;
  if (aliveCount === 0) return { kind: 'TOWN_VICTORY', winningFaction: 'TOWN', reason: 'All eliminated.' };

  const byFaction = {};
  for (const p of alive) {
    const f = p.allInIdentity.layer1Faction;
    if (!byFaction[f]) byFaction[f] = [];
    byFaction[f].push(p.userId);
  }

  const mafia = byFaction['MAFIA'] || [];
  const yakuza = byFaction['YAKUZA'] || [];
  const voidCult = byFaction['VOID_CULT'] || [];
  const nk = byFaction['NEUTRAL_KILLER'] || [];
  const town = byFaction['TOWN'] || [];

  // NK solo win
  if (nk.length > 0 && mafia.length === 0 && yakuza.length === 0 && voidCult.length === 0) {
    if (nk.length >= town.length) return { kind: 'NEUTRAL_KILLER_SOLO', winningFaction: 'NEUTRAL_KILLER', reason: 'NK solo dominance.' };
  }
  // Void majority
  if (voidCult.length * 2 >= aliveCount) return { kind: 'VOID_CULT_ASCENSION', winningFaction: 'VOID_CULT', reason: 'Void Cult majority.' };
  // Yakuza majority
  if (yakuza.length * 2 >= aliveCount) return { kind: 'YAKUZA_MAJORITY', winningFaction: 'YAKUZA', reason: 'Yakuza majority.' };
  // Mafia majority
  if (mafia.length * 2 >= aliveCount) return { kind: 'MAFIA_MAJORITY', winningFaction: 'MAFIA', reason: 'Mafia majority.' };
  // Town victory
  const killers = [...mafia, ...yakuza, ...voidCult, ...nk];
  if (killers.length === 0) return { kind: 'TOWN_VICTORY', winningFaction: 'TOWN', reason: 'All kill threats eliminated.' };

  return { kind: 'GAME_CONTINUES', winningFaction: null };
}

// ─── Night Action Resolver (mirrors engine logic) ─────────────────────────────
function resolveNight(game, nightActions) {
  const players = { ...game.players };
  const deaths = [];
  let killCount = 0;
  const cap = game.globalNightKillCap;

  // Sort by priority
  const sorted = [...nightActions].sort((a, b) => a.priority - b.priority);

  // Build per-player flags
  const flags = {};
  for (const [id, p] of Object.entries(players)) {
    const vestRemaining = p.vestChargesRemaining !== undefined
      ? p.vestChargesRemaining
      : (p.allInIdentity.layer3Trait === 'BULLETPROOF_VEST' ? 1 :
         p.allInIdentity.layer3Trait === 'SURGICAL_RESILIENCE' ? 2 : 0);

    flags[id] = {
      isBlocked: false,
      isProtected: false,
      hasDoctorProtection: false,
      vestCharges: vestRemaining,
      isFramed: false,
      isColdBlooded: p.allInIdentity.layer3Trait === 'COLD_BLOODED',
    };
  }

  // P1: BLOCK
  for (const a of sorted.filter(a => a.actionType === 'BLOCK')) {
    const tf = flags[a.targetPlayerId];
    if (tf && !tf.isColdBlooded) tf.isBlocked = true;
  }

  // P2: MISDIRECT — store redirect
  const redirects = {};
  for (const a of sorted.filter(a => a.actionType === 'MISDIRECT')) {
    if (flags[a.actorPlayerId]?.isBlocked) continue;
    redirects[a.targetPlayerId] = a.actorPlayerId;
  }

  function resolveTarget(tId, depth = 0) {
    if (depth > 5) return tId;
    const redir = redirects[tId];
    if (!redir || redir === tId) return tId;
    return resolveTarget(redir, depth + 1);
  }

  // P3: PROTECT
  for (const a of sorted.filter(a => a.actionType === 'PROTECT')) {
    if (flags[a.actorPlayerId]?.isBlocked) continue;
    const ef = resolveTarget(a.targetPlayerId);
    if (flags[ef]) {
      flags[ef].isProtected = true;
      flags[ef].hasDoctorProtection = true;
    }
  }
  // Vest self-protect
  for (const [id, f] of Object.entries(flags)) {
    if (f.vestCharges > 0) f.isProtected = true;
  }

  // P4: KILL
  for (const a of sorted.filter(a => a.actionType === 'KILL')) {
    if (flags[a.actorPlayerId]?.isBlocked) continue;
    if (killCount >= cap) break;
    const actor = players[a.actorPlayerId];
    if (!actor || !actor.isAlive) continue;
    const ef = resolveTarget(a.targetPlayerId);
    const target = players[ef];
    if (!target || !target.isAlive) continue;
    const tf = flags[ef];
    const hasSilencer = actor.allInIdentity.layer3Trait === 'SILENCER_ATTACHMENT';
    if (tf?.isProtected && !hasSilencer) {
      if (!tf.hasDoctorProtection && tf.vestCharges > 0) {
        tf.vestCharges--;
        players[ef] = { ...target, vestChargesRemaining: tf.vestCharges };
        if (tf.vestCharges === 0) tf.isProtected = false;
      }
      continue;
    }
    players[ef] = { ...target, isAlive: false };
    deaths.push({ victimPlayerId: ef, cause: `${actor.allInIdentity.layer1Faction}_KILL`, killerFaction: actor.allInIdentity.layer1Faction });
    killCount++;
  }

  // P5: FRAME — not critical to simulate deeply
  // P6: INVESTIGATE — produce intel reports
  const intel = [];
  for (const a of sorted.filter(a => a.actionType === 'INVESTIGATE')) {
    if (flags[a.actorPlayerId]?.isBlocked) continue;
    const ef = resolveTarget(a.targetPlayerId);
    const target = players[ef];
    if (!target) continue;
    const revealedFaction = flags[ef]?.isFramed ? 'MAFIA' : target.allInIdentity.layer1Faction;
    intel.push({ investigatorId: a.actorPlayerId, targetId: ef, revealedFaction });
  }

  return { players, deaths, killCount, intel };
}

// ─── Voting Phase: Lynch resolution ──────────────────────────────────────────
function resolveLynch(game) {
  const alive = Object.values(game.players).filter(p => p.isAlive);
  if (alive.length === 0) return { lynchedId: null, tally: {} };

  // Tally weighted votes
  const tally = {};
  for (const voter of alive) {
    const candidates = alive.filter(p => p.userId !== voter.userId);
    if (candidates.length === 0) continue;
    const target = pick(candidates);
    if (!tally[target.userId]) tally[target.userId] = 0;
    tally[target.userId] += voter.voteWeight;
  }

  // Find highest voted
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return { lynchedId: null, tally };
  const [lynchedId, highVotes] = sorted[0];
  // Tie check
  const ties = sorted.filter(([, v]) => v === highVotes);
  const finalId = ties.length > 1 ? null : lynchedId; // No lynch on tie

  return { lynchedId: finalId, tally };
}

// ─── Bot Night Action Decision (Heuristic + AI where available) ───────────────
async function getBotNightAction(player, game, useAI = true) {
  const alive = Object.values(game.players).filter(p => p.isAlive && p.userId !== player.userId);
  if (alive.length === 0) return null;

  const capability = player.nightCapability;
  if (!capability) return null;

  const priority = ACTION_PRIORITY[capability] || 6;
  let targetId = null;
  let actionSource = 'HEURISTIC';

  if (useAI) {
    // Use Gemini to pick a strategic target
    const aliveList = alive.map(p => `- ${p.userId} (${p.username}, faction-hidden)`).join('\n');
    const prompt = `You are bot "${player.username}" in faction "${player.allInIdentity.layer1Faction}". Round ${game.roundNumber}.
Your night action capability: ${capability}.
Alive targets:
${aliveList}

Respond ONLY with: { "targetPlayerId": "player-X", "rationale": "brief reason" }`;
    const sysInst = `You are an All-In mafia game bot. Pick the most strategically optimal target. Always respond in valid JSON only.`;

    try {
      const result = await callGemini(prompt, sysInst);
      if (result?.text) {
        const raw = result.text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
        if (parsed.targetPlayerId && game.players[parsed.targetPlayerId]) {
          targetId = parsed.targetPlayerId;
          actionSource = `AI(${result.model})`;
        }
      }
    } catch (e) {
      // Fall through to heuristic
    }
  }

  if (!targetId) {
    // Heuristic: killer factions target town, town investigates randomly
    const faction = player.allInIdentity.layer1Faction;
    if (['MAFIA', 'YAKUZA', 'VOID_CULT', 'NEUTRAL_KILLER'].includes(faction)) {
      const townTargets = alive.filter(p => p.allInIdentity.layer1Faction === 'TOWN');
      targetId = townTargets.length > 0 ? pick(townTargets).userId : pick(alive).userId;
    } else {
      targetId = pick(alive).userId;
    }
  }

  return { actorPlayerId: player.userId, targetPlayerId: targetId, actionType: capability, priority, actionSource };
}

// ─── MAIN SIMULATION ──────────────────────────────────────────────────────────
async function runGame(gameIdx) {
  log(`\n${'═'.repeat(60)}`);
  log(`🎮 GAME ${gameIdx} — ALL-IN MODE SIMULATION`);
  log(`${'═'.repeat(60)}`);

  const game = buildAllInGame(gameIdx);

  // ── Validation 1: Player count
  const playerCount = Object.keys(game.players).length;
  if (playerCount !== 40) {
    bug('Player count mismatch', `Expected 40, got ${playerCount}`);
  } else {
    ok(`Player count: ${playerCount} ✓`);
  }

  // ── Validation 2: Faction distribution
  const factionCounts = {};
  for (const p of Object.values(game.players)) {
    const f = p.allInIdentity.layer1Faction;
    factionCounts[f] = (factionCounts[f] || 0) + 1;
  }
  log(`  Faction distribution: ${JSON.stringify(factionCounts)}`);

  // Killer factions must be < 50% at start
  const killerCount = (factionCounts.MAFIA || 0) + (factionCounts.YAKUZA || 0) + (factionCounts.VOID_CULT || 0) + (factionCounts.NEUTRAL_KILLER || 0);
  if (killerCount >= playerCount / 2) {
    bug('Game starts with killer majority — game would end immediately', `Killers: ${killerCount}/${playerCount}`);
  } else {
    ok(`Initial killer/town balance: ${killerCount} killers vs ${playerCount - killerCount} non-killers ✓`);
  }

  // ── Game loop
  let round = 0;
  const maxRounds = 20;
  let winner = null;
  const roundResults = [];

  while (round < maxRounds) {
    round++;
    game.roundNumber = round;
    log(`\n  --- Round ${round} ---`);

    // ── Day Phase: Voting (Lynch)
    const { lynchedId, tally } = resolveLynch(game);
    if (lynchedId) {
      const victim = game.players[lynchedId];
      if (!victim) {
        bug('Lynch target is null/undefined', `targetId=${lynchedId}`);
      } else if (!victim.isAlive) {
        bug('Lynch attempted on dead player', `victim=${victim.username}`);
      } else {
        game.players[lynchedId] = { ...victim, isAlive: false };
        game.lastLynchedUserId = lynchedId;
        log(`  ⚖️  Lynched: ${victim.username} (${victim.allInIdentity.layer1Faction})`);
        // Validate: lynched player is now dead
        if (game.players[lynchedId].isAlive) {
          bug('Lynched player still shows as alive', `victim=${victim.username}`);
        }
      }
    } else {
      log(`  ⚖️  No lynch this round (tie or no votes)`);
    }

    // ── Win check after day
    const dayWin = evaluateWin(game);
    if (dayWin.kind !== 'GAME_CONTINUES') {
      log(`  🏆 Game ended after day voting! Winner: ${dayWin.winningFaction} — ${dayWin.reason}`);
      winner = dayWin;
      break;
    }

    // ── Night Phase: Bot Actions
    log(`  🌙 Night phase...`);
    const alive = Object.values(game.players).filter(p => p.isAlive);
    const nightActions = [];

    // Get night actions from each alive player (in parallel batches of 5 to avoid rate limits)
    const batches = [];
    for (let i = 0; i < alive.length; i += 5) {
      batches.push(alive.slice(i, i + 5));
    }

    let aiCallCount = 0;
    let heuristicCount = 0;

    for (const batch of batches) {
      const batchActions = await Promise.all(
        batch.map(p => getBotNightAction(p, game, aiCallCount < 3)) // Limit AI calls per round
      );
      for (const action of batchActions) {
        if (!action) continue;
        if (action.actionSource.startsWith('AI')) aiCallCount++;
        else heuristicCount++;
        nightActions.push(action);
      }
      // Small delay between batches
      await new Promise(r => setTimeout(r, 200));
    }
    log(`  🤖 Night actions: ${nightActions.length} total (${aiCallCount} AI, ${heuristicCount} heuristic)`);

    // ── Validation 3: Night action types match capabilities
    for (const a of nightActions) {
      const actor = game.players[a.actorPlayerId];
      if (!actor) {
        bug('Night action from unknown player', `actorId=${a.actorPlayerId}`);
        continue;
      }
      if (!actor.isAlive) {
        bug('Dead player submitted night action', `actor=${actor.username}`);
      }
      if (!NIGHT_ACTION_TYPES.includes(a.actionType)) {
        bug('Invalid night action type', `type=${a.actionType}, actor=${actor.username}`);
      }
      // Priority must match action type
      const expectedPriority = ACTION_PRIORITY[a.actionType];
      if (a.priority !== expectedPriority) {
        bug('Night action priority mismatch', `type=${a.actionType} expected priority ${expectedPriority} got ${a.priority}`);
      }
    }

    // ── Kill cap: only KILL actions matter for cap validation
    const killActions = nightActions.filter(a => a.actionType === 'KILL');
    if (killActions.length > 20) {
      bug('Excessive kill actions submitted', `count=${killActions.length} in round ${round}`);
    }

    // ── Run resolver
    const { players: updatedPlayers, deaths, killCount, intel } = resolveNight(game, nightActions);

    // ── Validation 4: Kill cap enforced
    if (killCount > game.globalNightKillCap) {
      bug('Night kill cap violated', `killCount=${killCount}, cap=${game.globalNightKillCap}, round=${round}`);
    } else {
      ok(`Kill cap enforced: ${killCount}/${game.globalNightKillCap} kills ✓`);
    }

    // ── Validation 5: Dead players cannot be killed again
    for (const death of deaths) {
      const wasAlive = game.players[death.victimPlayerId]?.isAlive;
      if (!wasAlive) {
        bug('Already-dead player killed again in night resolver', `victim=${death.victimPlayerId}, round=${round}`);
      }
    }

    game.players = updatedPlayers;
    const nightDeaths = deaths.map(d => {
      const v = game.players[d.victimPlayerId];
      return `${v?.username ?? d.victimPlayerId} (${d.cause})`;
    });
    log(`  💀 Night deaths: ${nightDeaths.length > 0 ? nightDeaths.join(', ') : 'none'}`);

    // ── Validation 6: Intel only reveals actual factions (no hallucinated factions)
    for (const inv of intel) {
      if (!FACTIONS.includes(inv.revealedFaction)) {
        bug('Investigation revealed unknown faction', `faction=${inv.revealedFaction}`);
      }
    }

    // ── Infinite loop guard: game must progress
    const aliveAfterNight = Object.values(game.players).filter(p => p.isAlive).length;
    if (aliveAfterNight === Object.keys(game.players).length && deaths.length === 0 && !lynchedId) {
      if (round > 3) {
        bug('Game stalled — no deaths in round', `round=${round}, aliveCount=${aliveAfterNight}`);
      }
    }

    // ── Win check after night
    const nightWin = evaluateWin(game);
    roundResults.push({
      round,
      aliveCount: aliveAfterNight,
      kills: deaths.length,
      lynch: lynchedId ? 1 : 0,
      winCheck: nightWin.kind,
    });

    if (nightWin.kind !== 'GAME_CONTINUES') {
      log(`  🏆 Game ended after night! Winner: ${nightWin.winningFaction} — ${nightWin.reason}`);
      winner = nightWin;
      break;
    }

    log(`  👥 Alive: ${aliveAfterNight} players remaining`);

    if (aliveAfterNight <= 2) {
      log(`  ⚠️  Only ${aliveAfterNight} players left — forcing ENDED`);
      winner = evaluateWin(game);
      if (winner.kind === 'GAME_CONTINUES') winner = { kind: 'TOWN_VICTORY', winningFaction: 'TOWN', reason: 'Too few players.' };
      break;
    }
  }

  if (!winner) {
    bug('Game never ended within max rounds', `rounds=${round}`);
    winner = { kind: 'TIMEOUT', winningFaction: null };
  }

  // ── Game-level validations
  const finalAlive = Object.values(game.players).filter(p => p.isAlive);
  const finalDead = Object.values(game.players).filter(p => !p.isAlive);
  log(`\n  Final state: ${finalAlive.length} alive, ${finalDead.length} dead, ${round} rounds`);
  log(`  Result: ${winner.kind} — ${winner.winningFaction || 'N/A'}`);

  // Validate: isAlive is always boolean
  for (const [id, p] of Object.entries(game.players)) {
    if (typeof p.isAlive !== 'boolean') {
      bug('Player isAlive is not boolean', `player=${id}, value=${p.isAlive}`);
    }
  }

  // Validate: if MAFIA_MAJORITY, mafia must indeed be majority
  if (winner.kind === 'MAFIA_MAJORITY') {
    const mafiaAlive = finalAlive.filter(p => p.allInIdentity.layer1Faction === 'MAFIA').length;
    if (mafiaAlive * 2 < finalAlive.length) {
      bug('MAFIA_MAJORITY declared incorrectly', `mafiaAlive=${mafiaAlive}, totalAlive=${finalAlive.length}`);
    }
  }
  // Validate: if TOWN_VICTORY, no killers should be alive
  if (winner.kind === 'TOWN_VICTORY') {
    const killerAlive = finalAlive.filter(p => ['MAFIA','YAKUZA','VOID_CULT','NEUTRAL_KILLER'].includes(p.allInIdentity.layer1Faction));
    if (killerAlive.length > 0) {
      bug('TOWN_VICTORY declared but killers still alive', `killers=${killerAlive.map(p=>p.username).join(',')}`);
    }
  }

  return { gameIdx, winner, rounds: round, roundResults, finalAlive: finalAlive.length, finalDead: finalDead.length };
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
(async () => {
  log('🚀 TDV Mafia All-In Simulator — 3 Consecutive Games');
  log('==================================================');

  const gameResults = [];
  for (let g = 1; g <= 3; g++) {
    try {
      const result = await runGame(g);
      gameResults.push(result);
    } catch (e) {
      bug(`Game ${g} crashed unexpectedly`, e.message);
      console.error(e);
    }
    // Brief pause between games
    if (g < 3) await new Promise(r => setTimeout(r, 1000));
  }

  // ── FINAL REPORT ──────────────────────────────────────────────────────────
  log('\n');
  log('╔══════════════════════════════════════════════════════════╗');
  log('║             SIMULATION COMPLETE — FINAL REPORT           ║');
  log('╚══════════════════════════════════════════════════════════╝');

  for (const r of gameResults) {
    log(`\n  Game ${r.gameIdx}: ${r.winner.kind} (${r.winner.winningFaction || 'N/A'}) — ${r.rounds} rounds, ${r.finalAlive} alive, ${r.finalDead} dead`);
  }

  log(`\n🐛 BUGS FOUND: ${bugs.length}`);
  if (bugs.length === 0) {
    log('  ✅ No bugs detected across 3 full All-In simulations!');
  } else {
    bugs.forEach((b, i) => {
      log(`  ${i + 1}. ❌ ${b.title}: ${typeof b.details === 'string' ? b.details : JSON.stringify(b.details)}`);
    });
  }

  // Export bugs as JSON for the fix phase
  const fs = require('fs');
  fs.writeFileSync('simulation-bugs.json', JSON.stringify({ bugs, gameResults }, null, 2));
  log('\n📋 Bug report saved to simulation-bugs.json');

  process.exit(bugs.length > 0 ? 1 : 0);
})();
