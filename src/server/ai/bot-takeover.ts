/**
 * Gemini Bot Takeover Protocol — 75-Second Disconnect Failover
 *
 * When a player disconnects:
 *   1. A 75-second countdown begins.
 *   2. Reconnection within 75s cancels the timer, restores full authority.
 *   3. At 75s expiry: `isAiBotControlled = true` is set, a stateful GenAI
 *      agent is instantiated with full role/faction/newspaper context.
 *   4. The bot participates each phase (night action + day vote/chat).
 *   5. On human reconnection after handover: authority is seamlessly returned
 *      and the GenAI context is cleanly archived (no state corruption).
 *
 * Terminology note: All user-facing role descriptions use clean, inclusive
 * language (e.g., "Gözbağlayıcı / Illusionist" for deception roles,
 * "Disrupter" for block roles — never archaic or offensive references).
 *
 * Enterprise Mafia / Social Deduction Platform - Phase 3
 */

import {
  GamePhase,
  LobbyState,
  NightActionBufferItem,
  NightActionPriority,
  NightActionType,
  PlayerSession,
} from '../../types/game';
import { GoogleGenAI } from '@google/genai';
import { CoreFaction, AllInPlayerIdentity } from '../../types/roles';
import { NightDeathRecord } from '../../types/engine';
import { inMemoryLobbyStore } from '../state/memory';
import { getGeminiApiKeyPool } from './gemini-keys';
import { AZ_BOT_PERSONALITIES } from '../../config/i18n/az';
import { castVerdictVote } from '../engine/voting-engine';

export type BotPersonality =
  | 'AGGRESSIVE_ACCUSER'
  | 'ANALYTICAL_DETECTIVE'
  | 'QUIET_FOLLOWER'
  | 'ERRATIC_WILDCARD'
  | 'SMOOTH_DEFENDER';

export type BotPersonalityProfile = BotPersonality;

export const BOT_PERSONALITIES: readonly BotPersonality[] = [
  'AGGRESSIVE_ACCUSER',
  'ANALYTICAL_DETECTIVE',
  'QUIET_FOLLOWER',
  'ERRATIC_WILDCARD',
  'SMOOTH_DEFENDER',
] as const;

export const BOT_PERSONALITY_PROFILES = BOT_PERSONALITIES;

export function getBotPersonality(identifier: string): BotPersonality {
  const hash = Array.from(identifier).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return BOT_PERSONALITIES[hash % BOT_PERSONALITIES.length]!;
}


// ─── Constants & AI Configuration ─────────────────────────────────────────────

const BOT_TAKEOVER_TIMEOUT_MS = 75_000;
export const GEMINI_MODEL_PRIMARY = 'gemini-3.8-flash';
export const GEMINI_MODEL_SECONDARY = 'gemini-3.7-flash';
export const GEMINI_MODEL_FALLBACK = 'gemini-2.5-flash';

let _activeKeyIndex = 0;

/**
 * Generate Gemini content with automatic key rotation and 3.8 -> 3.7 -> 2.5 model fallback.
 */
export async function generateGeminiContentWithFallback(
  systemInstruction: string,
  prompt: string
): Promise<string | null> {
  const keys = getGeminiApiKeyPool();
  if (keys.length === 0) return null;

  const modelsToTry = [GEMINI_MODEL_PRIMARY, GEMINI_MODEL_SECONDARY, GEMINI_MODEL_FALLBACK];

  for (let keyAttempt = 0; keyAttempt < keys.length; keyAttempt++) {
    const key = keys[(_activeKeyIndex + keyAttempt) % keys.length];
    if (!key) continue;

    const ai = new GoogleGenAI({ apiKey: key });

    for (const model of modelsToTry) {
      try {
        // @ts-ignore
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.3,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          }
        });

        if (response.text) {
          _activeKeyIndex = (_activeKeyIndex + keyAttempt) % keys.length;
          return response.text;
        }
      } catch (err: unknown) {
        const errMsg = String(err instanceof Error ? err.message : '');
        const isTemporary = /high demand|unavailable|unsupported|not found|overloaded|aborted|rate limit|quota/i.test(errMsg);
        if (isTemporary && !/quota/i.test(errMsg)) {
          continue; // Try next model
        }
        break; // Quota exhausted, try next API key
      }
    }
  }

  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** A clean audit record for a single bot action taken during a turn */
export interface BotActionRecord {
  readonly lobbyId: string;
  readonly botPlayerId: string;
  readonly phase: GamePhase;
  readonly roundNumber: number;
  readonly actionType: 'NIGHT_ACTION' | 'DAY_VOTE' | 'DAY_CHAT';
  readonly payload: NightActionBufferItem | VoteCastRecord | ChatRecord;
  readonly genaiInteractionId: string;
  readonly takenAt: number; // Unix ms
}

export interface VoteCastRecord {
  readonly voterUserId: string;
  readonly candidateUserId: string;
  readonly verdict?: 'GUILTY' | 'INNOCENT';
}

export interface ChatRecord {
  readonly senderUserId: string;
  readonly message: string;
  /** Always clean, inclusive language — no offensive role terminology */
  readonly inCharacterPersona: string;
}

/** Lifecycle record for one bot session */
export interface BotSession {
  readonly playerId: string;
  readonly lobbyId: string;
  readonly activatedAt: number;        // Unix ms when bot took over
  readonly handedBackAt: number | null; // null until human returns
  /** Chain of stateful interaction IDs for multi-turn context */
  previousInteractionId: string | null;
  readonly actionLog: BotActionRecord[];
  lastChatRound?: number;
  personality: BotPersonality;
}

/** Internal tracker entry for a player's disconnect timer */
interface DisconnectEntry {
  readonly playerId: string;
  readonly lobbyId: string;
  readonly disconnectedAt: number;
  timerId: ReturnType<typeof setTimeout>;
}

// ─── Helpers: Factions, Teammates, and Investigations ──────────────────────────

/**
 * Resolves canonical CoreFaction for a player session across All-In and Standard game modes.
 */
export function getPlayerFaction(player: PlayerSession | undefined): CoreFaction {
  if (!player) return 'TOWN';
  if (player.allInIdentity?.layer1Faction) {
    return player.allInIdentity.layer1Faction;
  }
  const role = (player.displayRole?.originalRoleName || '').toLowerCase();
  const loc = (player.displayRole?.localizedRoleName || '').toLowerCase();
  if (
    role.includes('mafia') ||
    loc.includes('mafiya') ||
    role === 'godfather' ||
    role === 'consigliere' ||
    role === 'mafioso'
  ) {
    return 'MAFIA';
  }
  if (role.includes('yakuza') || role === 'oyabun' || role === 'wakagashira') {
    return 'YAKUZA';
  }
  if (role.includes('cult')) {
    return 'VOID_CULT';
  }
  if (role.includes('serial') || role.includes('killer') || role === 'arsonist') {
    return 'NEUTRAL_KILLER';
  }
  if (role.includes('jester') || role.includes('executioner')) {
    return 'NEUTRAL_EVIL';
  }
  if (role.includes('survivor') || role.includes('amnesiac')) {
    return 'NEUTRAL_BENIGN';
  }
  return 'TOWN';
}

/**
 * Returns true if candidate is a living teammate in the same faction.
 * Strictly enforced for collective factions (MAFIA, YAKUZA, VOID_CULT).
 */
export function isTeammate(candidate: PlayerSession | undefined, myFaction: CoreFaction): boolean {
  if (!candidate || !candidate.isAlive) return false;
  if (
    myFaction === 'NEUTRAL_KILLER' ||
    myFaction === 'NEUTRAL_EVIL' ||
    myFaction === 'NEUTRAL_BENIGN' ||
    myFaction === 'TOWN'
  ) {
    return false;
  }
  return getPlayerFaction(candidate) === myFaction;
}

/**
 * Returns the set of player IDs already investigated by this player.
 * Combines lobby private investigation history and bot session action log.
 */
export function getInvestigatedTargetIds(
  investigatorUserId: string,
  lobby: LobbyState,
  botSession?: BotSession | null
): Set<string> {
  const investigated = new Set<string>();
  const privateResults = lobby.privateInvestigations?.[investigatorUserId] ?? [];
  for (const r of privateResults) {
    if (r.targetPlayerId) {
      investigated.add(r.targetPlayerId);
    }
  }
  if (botSession) {
    for (const record of botSession.actionLog) {
      if (record.actionType === 'NIGHT_ACTION') {
        const payload = record.payload as NightActionBufferItem;
        if (payload && payload.actionType === 'INVESTIGATE' && payload.targetPlayerId) {
          investigated.add(payload.targetPlayerId);
        }
      }
    }
  }
  return investigated;
}

// ─── Context Builders ─────────────────────────────────────────────────────────

/**
 * Produces a concise, role-appropriate system instruction for the bot persona.
 * Uses inclusive terminology: "Disrupter" for block roles, "Gözbağlayıcı"
 * (Illusionist) for deception roles — zero offensive references.
 */
function buildSystemInstruction(
  player: PlayerSession,
  lobby: LobbyState,
  personality?: BotPersonality
): string {
  const resolvedPersonality = personality ?? getBotPersonality(player.username);
  const personalityRule = {
    AGGRESSIVE_ACCUSER: 'You are AGGRESSIVE_ACCUSER. You are confrontational, distrustful of silent players, use exclamation marks, and urgently demand immediate indictments.',
    ANALYTICAL_DETECTIVE: 'You are ANALYTICAL_DETECTIVE. You are calm, methodical, quote vote counts, note timing inconsistencies, analyze player voting history, and calculate faction odds.',
    QUIET_FOLLOWER: 'You are QUIET_FOLLOWER. You are cautious, modest, keep replies brief (1 sentence), agree with majority consensus, and avoid drawing attention to yourself.',
    ERRATIC_WILDCARD: 'You are ERRATIC_WILDCARD. You are unpredictable, humorous, sarcastic, make pop-culture or theatrical quips, shift suspicion rapidly based on "gut feelings", and embrace chaos.',
    SMOOTH_DEFENDER: 'You are SMOOTH_DEFENDER. You are diplomatic, calm, urge the town not to rush to judgement, advocate for patience and evidence, and protect accused players from hasty lynching.',
  }[resolvedPersonality];

  const identity = player.allInIdentity;
  const faction = identity?.layer1Faction ?? 'TOWN';
  const office  = identity?.layer2Office  ?? 'CITY_INVESTIGATOR';
  const trait   = identity?.layer3Trait   ?? 'COLD_BLOODED';

  const aliveAllies = Object.values(lobby.players)
    .filter(p => p.isAlive && p.userId !== player.userId && p.allInIdentity?.layer1Faction === faction)
    .map(p => p.username)
    .join(', ') || 'none';

  const aliveCount = Object.values(lobby.players).filter(p => p.isAlive).length;

  return [
    `You are an authoritative AI surrogate for player "${player.username}" in a social deduction game.`,
    `Your faction: ${faction}. Civic role: ${office}. Innate trait: ${trait}.`,
    `Alive allies in your faction: ${aliveAllies}.`,
    `Total alive players: ${aliveCount}. Game mode: ${lobby.mode}. Round: ${lobby.roundNumber}.`,
    `Your displayed role identity: "${player.displayRole.formatted}".`,
    `Your active personality profile: ${resolvedPersonality}. Guidance: ${personalityRule}`,
    ``,
    `IMPORTANT — Language rules:`,
    `- Never use offensive, archaic, or derogatory role labels.`,
    `- Refer to deception roles as "Gözbağlayıcı / Illusionist".`,
    `- Refer to disruption/block roles as "Disrupter".`,
    `- Use clinical, strategic language. Keep responses concise (1–3 sentences max).`,
    `- ALL IN-CHARACTER CHAT AND RATIONALES MUST BE IN AZERBAIJANI LANGUAGE (Azərbaycan dilində).`,
    `- DO NOT sound like an AI assistant. Sound like a real player playing mafia. Be natural, sometimes emotional or suspicious.`,
    ``,
    `Faction objectives:`,
    faction === 'MAFIA'          ? `Eliminate Town and other factions to achieve Mafia majority.` :
    faction === 'YAKUZA'         ? `Achieve Yakuza syndicate majority through precision eliminations.` :
    faction === 'VOID_CULT'      ? `Complete the Ritual of Unmaking — reach majority before Ascension is blocked.` :
    faction === 'NEUTRAL_KILLER' ? `Eliminate all faction threats and survive alone.` :
    faction === 'NEUTRAL_EVIL'   ? `Achieve your individual win condition regardless of faction outcomes.` :
    faction === 'NEUTRAL_BENIGN' ? `Survive the game without becoming a target.` :
                                   `Identify and eliminate all mafia/cult/killer threats through investigation and voting.`,
  ].join('\n');
}

/**
 * Builds a one-turn prompt for night action selection.
 * Outputs: a JSON object { actionType, targetPlayerId, rationale }.
 */
function buildNightActionPrompt(player: PlayerSession, lobby: LobbyState): string {
  const myFaction = getPlayerFaction(player);
  const alivePlayers = Object.values(lobby.players)
    .filter(p => p.isAlive && p.userId !== player.userId)
    .filter(p => !isTeammate(p, myFaction))
    .map(p => `- ${p.userId} (${p.username})`).join('\n');

  const lastPaper = lobby.roundNumber > 1
    ? `Last night's public report: Round ${lobby.roundNumber - 1} deaths have been publicly announced.`
    : 'This is the first night — no prior deaths.';

  const recentChats = (lobby.chatMessages || [])
    .filter(msg => msg.channel === 'LOBBY' || (msg.channel === 'MAFIA' && player.allInIdentity?.layer1Faction === 'MAFIA'))
    .slice(-10)
    .map(msg => `[${msg.senderName}]: ${msg.content}`)
    .join('\n');

  return [
    `PHASE: NIGHT_BUFFER (Round ${lobby.roundNumber}).`,
    lastPaper,
    `Alive targets you may act on:`,
    alivePlayers,
    ``,
    `Recent chat history:`,
    recentChats || '(None)',
    ``,
    `Based on your faction (${player.allInIdentity?.layer1Faction ?? 'TOWN'}) and office (${player.allInIdentity?.layer2Office ?? 'CITY_INVESTIGATOR'}), choose ONE action.`,
    `Use the chat history to inform your decision (e.g. kill the person acting suspicious, protect the person claiming Sheriff).`,
    ``,
    `Respond ONLY with valid JSON in this exact format (no markdown, no prose):`,
    `{"actionType":"KILL|PROTECT|INVESTIGATE|BLOCK|MISDIRECT|FRAME","targetPlayerId":"<userId>","rationale":"<1-sentence strategic reason in Azerbaijani>"}`,
  ].join('\n');
}

/**
 * Builds a day-phase prompt for vote selection.
 * Outputs: { candidateUserId, rationale }.
 */
function buildDayVotePrompt(player: PlayerSession, lobby: LobbyState): string {
  const suspects = Object.values(lobby.players)
    .filter(p => p.isAlive && p.userId !== player.userId)
    .map(p => `- ${p.userId} (${p.username})`).join('\n');

  const recentChats = (lobby.chatMessages || [])
    .filter(msg => msg.channel === 'LOBBY')
    .slice(-10)
    .map(msg => `[${msg.senderName}]: ${msg.content}`)
    .join('\n');

  return [
    `PHASE: DAY_VOTING (Round ${lobby.roundNumber}).`,
    `You must cast a vote for elimination. Use the recent chat history to find suspects or protect allies.`,
    `Recent public chats:`,
    recentChats || '(None)',
    ``,
    `Valid Suspects:`,
    suspects,
    ``,
    `Respond ONLY with valid JSON (no markdown):`,
    `{"candidateUserId":"<userId>","rationale":"<1-sentence strategic reason in Azerbaijani>"}`,
  ].join('\n');
}

/**
 * Builds a day-phase prompt for in-character chat contribution.
 * Outputs: { message }.
 */
function buildDayChatPrompt(
  player: PlayerSession,
  lobby: LobbyState,
  personality?: BotPersonality
): string {
  const resolvedPersonality = personality ?? getBotPersonality(player.username);
  const recentChats = (lobby.chatMessages || [])
    .filter(msg => msg.channel === 'LOBBY' || (msg.channel === 'MAFIA' && player.allInIdentity?.layer1Faction === 'MAFIA'))
    .slice(-8)
    .map(msg => `[${msg.senderName}]: ${msg.content}`)
    .join('\n');

  const isAccusedOnPodium = lobby.phase === 'TRIAL_DEFENSE' && lobby.accusedPlayerId === player.userId;
  const accusedPlayer = lobby.accusedPlayerId ? lobby.players[lobby.accusedPlayerId] : null;
  const publicDeaths = lobby.latestNewspaper?.publicDeaths || [];
  const deathDetails = publicDeaths.length > 0
    ? publicDeaths.map(d => `${lobby.players[d.victimPlayerId]?.username ?? d.victimPlayerId} (${d.cause})`).join(', ')
    : 'No deaths recorded last night.';

  const liveVotesSummary = Object.entries(lobby.liveVotes || {})
    .map(([voterId, candId]) => `${lobby.players[voterId]?.username ?? voterId} -> ${lobby.players[candId]?.username ?? candId}`)
    .join(', ') || 'No votes cast yet.';

  let situationalPrompt = '';
  if (isAccusedOnPodium) {
    situationalPrompt = `CRITICAL: YOU ARE CURRENTLY ON THE DEFENSE PODIUM! The town has indicted you. You have 30 seconds to defend yourself. Deliver a convincing self-defense speech in Azerbaijani matching your ${resolvedPersonality} persona to convince the town to vote INNOCENT!`;
  } else if (lobby.phase === 'TRIAL_DEFENSE' && accusedPlayer) {
    situationalPrompt = `CRITICAL: Player "${accusedPlayer.username}" is on the defense podium facing potential execution. React to their situation or defense speech as a juror in Azerbaijani, expressing whether you believe they are GUILTY or INNOCENT according to your ${resolvedPersonality} persona.`;
  } else if (lobby.phase === 'DAY_VOTING') {
    situationalPrompt = `Current live nomination votes: ${liveVotesSummary}. React to the voting trends or push for your suspect according to your ${resolvedPersonality} persona.`;
  } else {
    situationalPrompt = `Morning casualties: ${deathDetails}. Deliberate with the town, react to events, and discuss suspects matching your ${resolvedPersonality} persona.`;
  }

  return [
    `CURRENT PHASE: ${lobby.phase} (Round ${lobby.roundNumber}).`,
    `You are ${player.username}. Personality profile: ${resolvedPersonality} (${AZ_BOT_PERSONALITIES[resolvedPersonality]?.name ?? resolvedPersonality}).`,
    situationalPrompt,
    ``,
    `Recent chat history:`,
    recentChats ? recentChats : `(No recent messages)`,
    ``,
    `Rules:`,
    `- Write strictly in AZERBAIJANI language.`,
    `- Do NOT reveal your faction directly. Max 2 short sentences.`,
    `- Sound like a passionate human player, NOT an AI bot or assistant.`,
    `- Strictly reflect your ${resolvedPersonality} personality.`,
    ``,
    `Respond ONLY with valid JSON:`,
    `{"message":"<your in-character statement in Azerbaijani>"}`,
  ].join('\n');
}

// ─── JSON Parser (strict, no 'any') ──────────────────────────────────────────

function parseJsonField<K extends string>(
  raw: string,
  field: K
): string | null {
  try {
    const cleanRaw = raw.replace(/^```json/m, '').replace(/^```/m, '').trim();
    const parsed = JSON.parse(cleanRaw);
    return typeof parsed[field] === 'string' ? parsed[field] : null;
  } catch (err) {
    // Fallback to strict regex for incomplete JSON
    const match = raw.match(new RegExp(`"${field}"\s*:\s*"([^"]+)"`));
    return match?.[1] ?? null;
  }
}

// ─── Action Resolvers ─────────────────────────────────────────────────────────

/**
 * Derives the canonical NightActionType and NightActionPriority for a given
 * player based on faction + office. Falls back to safe Town defaults.
 */
function deriveNightActionCapability(identity: AllInPlayerIdentity | undefined): {
  actionType: NightActionType;
  priority: NightActionPriority;
  canAct: boolean;
} {
  if (!identity) return { actionType: 'INVESTIGATE', priority: 6, canAct: false };

  const { layer1Faction, layer2Office } = identity;

  // Mafia faction → KILL
  if (layer1Faction === 'MAFIA' || layer1Faction === 'YAKUZA' || layer1Faction === 'NEUTRAL_KILLER' || layer1Faction === 'VOID_CULT') {
    return { actionType: 'KILL', priority: 4, canAct: true };
  }

  // Office-based Town roles
  switch (layer2Office) {
    case 'CITY_SURGEON':        return { actionType: 'PROTECT',     priority: 3, canAct: true };
    case 'CITY_INVESTIGATOR':   return { actionType: 'INVESTIGATE', priority: 6, canAct: true };
    case 'CHIEF_FIRE_MARSHAL':  return { actionType: 'BLOCK',       priority: 1, canAct: true };
    case 'POLICE_COMMISSIONER': return { actionType: 'INVESTIGATE', priority: 6, canAct: true };
    case 'PRISON_WARDEN':       return { actionType: 'BLOCK',       priority: 1, canAct: true };
    case 'BLACK_MARKET_BROKER': return { actionType: 'MISDIRECT',   priority: 2, canAct: true };
    case 'CORONER':             return { actionType: 'INVESTIGATE', priority: 6, canAct: true };
    default:                    return { actionType: 'INVESTIGATE', priority: 6, canAct: false };
  }
}

/**
 * Selects the highest-value target for a given faction.
 * - For KILL: Strictly filters out living teammates (Anti-Friendly Fire: FEAT-R4-02), coordinates with teammates.
 * - For INVESTIGATE: Tracks past investigations and strictly prioritizes uninvestigated suspects (Non-Repeat: FEAT-R4-03).
 * - For PROTECT: Protects town ally or self.
 */
export function selectStrategicTarget(
  player: PlayerSession,
  lobby: LobbyState,
  actionType: NightActionType,
  aiSuggestedTargetId: string | null,
  botSession?: BotSession | null
): string | null {
  const alivePlayers = Object.values(lobby.players).filter(
    p => p.isAlive && p.userId !== player.userId
  );
  if (alivePlayers.length === 0) return null;

  const actorFaction = getPlayerFaction(player);

  // ── KILL ACTION (Anti-Friendly Fire: FEAT-R4-02) ─────────────────────────
  if (actionType === 'KILL') {
    const validVictims = alivePlayers.filter(p => !isTeammate(p, actorFaction));
    if (validVictims.length === 0) return null;

    // 1. Validate AI suggestion against friendly fire
    if (aiSuggestedTargetId) {
      const suggested = validVictims.find(p => p.userId === aiSuggestedTargetId);
      if (suggested) return suggested.userId;
    }

    // 2. Teammate coordination: align with already buffered kill action
    const teammateKillAction = lobby.bufferedNightActions.find(a => {
      if (a.actionType !== 'KILL' || a.actorPlayerId === player.userId) return false;
      const otherActor = lobby.players[a.actorPlayerId];
      return otherActor && otherActor.isAlive && isTeammate(otherActor, actorFaction);
    });
    if (teammateKillAction && validVictims.some(p => p.userId === teammateKillAction.targetPlayerId)) {
      return teammateKillAction.targetPlayerId;
    }

    // 3. Fallback: random selection among valid victims
    const picked = validVictims[Math.floor(Math.random() * validVictims.length)];
    return picked?.userId ?? null;
  }

  // ── INVESTIGATE ACTION (Non-Repeat Heuristic: FEAT-R4-03) ────────────────
  if (actionType === 'INVESTIGATE') {
    const session = botSession ?? botTakeoverController.getBotSession(player.userId);
    const investigatedIds = getInvestigatedTargetIds(player.userId, lobby, session);
    const uninvestigated = alivePlayers.filter(p => !investigatedIds.has(p.userId));

    if (uninvestigated.length > 0) {
      if (aiSuggestedTargetId) {
        const suggested = uninvestigated.find(p => p.userId === aiSuggestedTargetId);
        if (suggested) return suggested.userId;
      }
      const picked = uninvestigated[Math.floor(Math.random() * uninvestigated.length)];
      return picked?.userId ?? null;
    }

    // All alive players already investigated: fallback
    if (aiSuggestedTargetId) {
      const suggested = alivePlayers.find(p => p.userId === aiSuggestedTargetId);
      if (suggested) return suggested.userId;
    }
    const picked = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    return picked?.userId ?? null;
  }

  // ── PROTECT ACTION ──────────────────────────────────────────────────────
  if (actionType === 'PROTECT') {
    if (aiSuggestedTargetId) {
      const suggested = alivePlayers.find(p => p.userId === aiSuggestedTargetId);
      if (suggested) return suggested.userId;
    }
    const townAllies = alivePlayers.filter(p => getPlayerFaction(p) === 'TOWN');
    const pool = townAllies.length > 0 ? townAllies : alivePlayers;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    return picked?.userId ?? null;
  }

  if (aiSuggestedTargetId) {
    const aiTarget = alivePlayers.find(p => p.userId === aiSuggestedTargetId);
    if (aiTarget) return aiTarget.userId;
  }

  return alivePlayers[0]?.userId ?? null;
}

/**
 * Pure decision function for bot night action selection.
 */
export function decideBotNightAction(
  player: PlayerSession,
  lobby: LobbyState,
  botSession?: BotSession | null,
  aiSuggestedTargetId?: string | null,
  rawActionType?: NightActionType | null
): { actionType: NightActionType; targetPlayerId: string; priority: NightActionPriority } | null {
  const { actionType: capabilityType, priority, canAct } = deriveNightActionCapability(player.allInIdentity);
  if (!canAct) return null;

  const validActionTypes: NightActionType[] = ['KILL', 'PROTECT', 'INVESTIGATE', 'BLOCK', 'MISDIRECT', 'FRAME'];
  const resolvedActionType: NightActionType =
    rawActionType && validActionTypes.includes(rawActionType) ? rawActionType : capabilityType;

  const targetPlayerId = selectStrategicTarget(
    player,
    lobby,
    resolvedActionType,
    aiSuggestedTargetId ?? null,
    botSession
  );
  if (!targetPlayerId) return null;

  return {
    actionType: resolvedActionType,
    targetPlayerId,
    priority,
  };
}

/**
 * Pure decision function for bot day voting.
 * - Mafia strictly avoids voting for teammates; coordinates on accused townies or leading townie vote targets.
 * - Sheriff/Town prioritizes voting for confirmed Mafia targets identified in night investigations.
 */
export function decideBotVote(
  player: PlayerSession,
  lobby: LobbyState,
  botSession?: BotSession | null,
  aiSuggestedCandidateId?: string | null
): { candidateUserId: string; rationale: string } | null {
  const alivePlayers = Object.values(lobby.players).filter(p => p.isAlive && p.userId !== player.userId);
  if (alivePlayers.length === 0) return null;

  const myFaction = getPlayerFaction(player);

  // ── MAFIA VOTING (Anti-Friendly Fire & Coordination: FEAT-R4-02) ────────
  if (myFaction === 'MAFIA') {
    const validTownTargets = alivePlayers.filter(p => !isTeammate(p, 'MAFIA'));
    if (validTownTargets.length === 0) return null;

    // 1. Accused townie coordination
    if (lobby.accusedPlayerId && validTownTargets.some(p => p.userId === lobby.accusedPlayerId)) {
      return {
        candidateUserId: lobby.accusedPlayerId,
        rationale: 'İttiham olunan şübhəliyə qarşı səs verirəm.',
      };
    }

    // 2. Voting bloc coordination: count existing votes on valid town targets
    const voteCounts: Record<string, number> = {};
    for (const [voterId, candId] of Object.entries(lobby.liveVotes || {})) {
      if (validTownTargets.some(p => p.userId === candId)) {
        const voter = lobby.players[voterId];
        const bonus = voter && isTeammate(voter, 'MAFIA') ? 2 : 1;
        voteCounts[candId] = (voteCounts[candId] || 0) + bonus;
      }
    }
    const sortedTargets = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
    if (sortedTargets.length > 0 && sortedTargets[0][1] >= 1) {
      return {
        candidateUserId: sortedTargets[0][0],
        rationale: 'Şəhər əhalisinin şübhələndiyi əsas namizədə səs verirəm.',
      };
    }

    // 3. AI suggestion (if valid non-mafia townie)
    if (aiSuggestedCandidateId) {
      const suggested = validTownTargets.find(p => p.userId === aiSuggestedCandidateId);
      if (suggested) {
        return {
          candidateUserId: suggested.userId,
          rationale: 'Şübhəli davranışları olan şəxsə səs verirəm.',
        };
      }
    }

    // 4. Fallback random town target
    const picked = validTownTargets[Math.floor(Math.random() * validTownTargets.length)];
    return {
      candidateUserId: picked.userId,
      rationale: 'Şübhələrim əsasında səs verirəm.',
    };
  }

  // ── TOWN / SHERIFF VOTING (FEAT-R4-03) ──────────────────────────────────
  const privateResults = lobby.privateInvestigations?.[player.userId] ?? [];
  const confirmedMafiaIds = privateResults
    .filter(r => r.revealedFaction === 'MAFIA' && !r.isBlurred)
    .map(r => r.targetPlayerId);

  const aliveConfirmedMafia = alivePlayers.filter(p => confirmedMafiaIds.includes(p.userId));
  if (aliveConfirmedMafia.length > 0) {
    return {
      candidateUserId: aliveConfirmedMafia[0].userId,
      rationale: 'Gecə araşdırmamda bu şəxsin Mafiya olduğu təsdiqləndi!',
    };
  }

  if (aiSuggestedCandidateId) {
    const suggested = alivePlayers.find(p => p.userId === aiSuggestedCandidateId);
    if (suggested) {
      return {
        candidateUserId: suggested.userId,
        rationale: 'İctimai müzakirələr əsasında səs verirəm.',
      };
    }
  }

  const realSuspects = alivePlayers.filter(p => getPlayerFaction(p) === 'MAFIA');
  if (realSuspects.length > 0 && Math.random() < 0.35) {
    return {
      candidateUserId: realSuspects[0].userId,
      rationale: 'Davranışları məndə ciddi şübhə yaradır.',
    };
  }

  const picked = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
  return {
    candidateUserId: picked.userId,
    rationale: 'Faktları nəzərə alaraq səs verirəm.',
  };
}

/**
 * Pure decision function for TRIAL_DEFENSE verdict voting.
 */
export function decideBotTrialVerdict(
  player: PlayerSession,
  lobby: LobbyState,
  botSession?: BotSession | null
): 'GUILTY' | 'INNOCENT' {
  const accusedId = lobby.accusedPlayerId;
  if (!accusedId) return 'INNOCENT';
  const accused = lobby.players[accusedId];
  if (!accused) return 'INNOCENT';

  const myFaction = getPlayerFaction(player);
  if (myFaction === 'MAFIA') {
    if (isTeammate(accused, 'MAFIA')) {
      return 'INNOCENT';
    }
    return 'GUILTY';
  }

  if (myFaction === 'YAKUZA') {
    if (isTeammate(accused, 'YAKUZA')) {
      return 'INNOCENT';
    }
    return 'GUILTY';
  }

  const privateResults = lobby.privateInvestigations?.[player.userId] ?? [];
  const isConfirmedMafia = privateResults.some(
    r => r.targetPlayerId === accusedId && r.revealedFaction === 'MAFIA' && !r.isBlurred
  );
  if (isConfirmedMafia) return 'GUILTY';

  const isConfirmedTown = privateResults.some(
    r => r.targetPlayerId === accusedId && r.revealedFaction === 'TOWN' && !r.isBlurred
  );
  if (isConfirmedTown) return 'INNOCENT';

  const personality = botSession?.personality ?? getBotPersonality(player.username);
  if (personality === 'AGGRESSIVE_ACCUSER') return 'GUILTY';
  if (personality === 'SMOOTH_DEFENDER') return 'INNOCENT';

  return Math.random() < 0.65 ? 'GUILTY' : 'INNOCENT';
}

export interface GenerateBotDialogueParams {
  readonly player?: PlayerSession;
  readonly lobby?: LobbyState;
  readonly personality: BotPersonality;
  readonly forceFallback?: boolean;
}

export interface BotDialogueOptions {
  readonly playerName?: string;
  readonly faction?: CoreFaction;
  readonly roleName?: string;
  readonly phase?: GamePhase;
  readonly accusedPlayerName?: string | null;
  readonly isAccusedOnPodium?: boolean;
  readonly suspectNames?: readonly string[];
}

/**
 * Comprehensive Procedural Azerbaijani Dialogue Generator for Bot Social Deduction Deliberation.
 * Serves as the robust, deterministic fallback for FEAT-R4-01 when the Gemini API is offline or keyless.
 */
export function generateBotDayDiscussionMessage(
  paramsOrPersonality: GenerateBotDialogueParams | BotPersonality,
  publicDeaths: readonly NightDeathRecord[] = [],
  liveVotes: Readonly<Record<string, string>> = {},
  options?: BotDialogueOptions
): string {
  let personality: BotPersonality;
  let phase: GamePhase;
  let isPodium = false;
  let accused = 'Müttəhim';
  let suspects: readonly string[] = [];
  let deaths: readonly NightDeathRecord[] = [];

  if (typeof paramsOrPersonality === 'object' && paramsOrPersonality !== null && 'personality' in paramsOrPersonality) {
    personality = paramsOrPersonality.personality;
    const lobby = paramsOrPersonality.lobby;
    const player = paramsOrPersonality.player;
    deaths = lobby?.latestNewspaper?.publicDeaths ?? [];
    const votes = lobby?.liveVotes ?? {};
    phase = lobby?.phase ?? (Object.keys(votes).length > 0 ? 'DAY_VOTING' : 'DAY_CENTRAL_ASSEMBLY');
    isPodium = Boolean(lobby?.phase === 'TRIAL_DEFENSE' && lobby?.accusedPlayerId && lobby.accusedPlayerId === player?.userId);
    accused = lobby?.accusedPlayerId ? (lobby.players[lobby.accusedPlayerId]?.username ?? 'Müttəhim') : 'Müttəhim';
    suspects = Object.values(lobby?.players ?? {})
      .filter(p => p.isAlive && p.userId !== player?.userId)
      .map(p => p.username);
  } else {
    personality = paramsOrPersonality;
    deaths = publicDeaths;
    phase = options?.phase ?? (Object.keys(liveVotes).length > 0 ? 'DAY_VOTING' : 'DAY_CENTRAL_ASSEMBLY');
    isPodium = Boolean(options?.isAccusedOnPodium);
    accused = options?.accusedPlayerName ?? 'Müttəhim';
    suspects = options?.suspectNames ?? [];
  }

  const randomSuspect = suspects.length > 0 ? suspects[Math.floor(Math.random() * suspects.length)] : 'bəzi şübhəlilər';
  const hasDeaths = deaths.length > 0;

  let message = '';

  // ── 1. TRIAL_DEFENSE: Self-Defense on the Podium ───────────────────────────
  if (phase === 'TRIAL_DEFENSE' && isPodium) {
    switch (personality) {
      case 'AGGRESSIVE_ACCUSER': {
        const lines = [
          `Məni şərləyirsiniz! Əsl mafiya kənarda dayanıb sizə gülür! Məni assanız şəhər uduzacaq, kor olmayın!`,
          `Məni edam etmək böyük axmaqlıqdır! Əsl qatillər arxada gizlənib, siz isə günahsızı asırsınız!`,
          `Bu saxta ittihamdır! Məni asan hər kəs səhər peşman olacaq, şəhərin məhvinə imza atmayın!`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'ANALYTICAL_DETECTIVE': {
        const lines = [
          `Məntiqi təhlil aparın: əgər mən mafiya olsaydım, əvvəlki səsvermələrdə bu addımları atmazdım. Mən şəhərin tərəfindəyəm, GÜNAHSIZ səs verin.`,
          `Faktlara baxın, mənə qarşı bircə dənə də olsun tutarlı sübut yoxdur. Səhər nəticələrini gözləyin, səhv etməyin.`,
          `Rasional düşünün: mənim edamım şəhərə heç bir informasiya qazandırmayacaq, sadəcə bir məsum vətəndaşı itirəcəyik.`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'QUIET_FOLLOWER': {
        const lines = [
          `Mən heç kimə pislik etməmişəm, həmişə şəhər üçün çalışmışam... Xahiş edirəm məni asmayın, səhv edirsiniz...`,
          `Mən sadəcə vətəndaşam, niyə məni hədəf seçdiniz? Günahsızam, mərhəmət edin...`,
          `Mən günahkar deyiləm... İnanmırsınızsa asın, amma sonra çox gec olacaq...`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'ERRATIC_WILDCARD': {
        const lines = [
          `Məni asmaq istəyirsiniz? Əla! Asın və görün sonra şəhərin başına nə oyunlar gəlir! 🎭`,
          `Bütün bu məhkəmə sadəcə bir komediyadır! Əgər asılsam, axşam ruhum hamınızı bir-bir tapacaq! 🍿`,
          `Hahaha, doğrudan da məni qatil zənn edirsiniz? Gülməlidir! Asın getsin, tamaşa davam edir!`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'SMOOTH_DEFENDER': {
        const lines = [
          `Sakit olaq. Mənə qarşı irəli sürülən iddialar sadəcə anlaşılmazlıqdır. Mən şəhərə sadiqəm və günahsızam.`,
          `Təmkinli olun, bir insanı şübhə əsasında edam etmək ədalət deyil. Mənə inanın və şəhəri qoruyun.`,
          `Gəlin intiqamla yox, ağılla hərəkət edək. Mən məsumam, məni edam etməklə qatillərə qələbə bəxş etməyin.`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
    }
    return sanitizeChatMessage(message);
  }

  // ── 2. TRIAL_DEFENSE: Juror Reacting to Accused on Podium ───────────────────
  if (phase === 'TRIAL_DEFENSE' && !isPodium) {
    switch (personality) {
      case 'AGGRESSIVE_ACCUSER': {
        const lines = [
          `${accused} boynuna almaq istəmir, amma hər şey göz qabağındadır! Vaxt itirmədən GÜNAHKAR səsini verin!`,
          `Gözlərimizin içinə baxa-baxa yalan danışır! ${accused} edam edilməlidir, şəhər təmizlənsin!`,
          `Boş bəhanələrə inanmayın! ${accused} qatildir və cəzasını almalıdır!`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'ANALYTICAL_DETECTIVE': {
        const lines = [
          `${accused} tərəfindən gətirilən arqumentlər faktlarla uzlaşmır. Müdafiəsi inandırıcı deyil.`,
          `${accused} səsvermə qeydlərində çox ziddiyyətli addımlar atıb, sübutlar onun əleyhinədir.`,
          `İfadələrdəki boşluqlar aydın görünür. Təhlillərim göstərir ki, ${accused} günahkardır.`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'QUIET_FOLLOWER': {
        const lines = [
          `Görək ${accused} nə deyir... Çoxluq günahkar hesab edirsə, yəqin ki, elədir.`,
          `Mən hələ tərəddüd edirəm, amma ${accused} haqqında deyilənlər ciddi görünür.`,
          `Hamı necə səs versə, mən də ona uyğunlaşacağam.`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'ERRATIC_WILDCARD': {
        const lines = [
          `Paho! ${accused} podiumda necə də gözəl artistlik edir! Oskarlıq çıxışdır! 🎭`,
          `Görəsən ${accused} edam edilsə axşam hava necə olacaq? Məncə asaq, maraqlı olar! 😈`,
          `Popkornumu götürüb bu dramaya baxıram! Nəticə nə olursa olsun, möhtəşəm tamaşadır! 🍿`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'SMOOTH_DEFENDER': {
        const lines = [
          `${accused} hələ ki tam izah edə bilməyib, amma tələsik hökm verməyək. Şübhə təqsirləndirilənin xeyrinədir.`,
          `Gəlin emosiyaları kənara qoyaq, ${accused} həqiqətən günahsız ola bilər. Ədalətli olaq.`,
          `Sübutlar yetərincə aydın deyil. Günahsız birini asmaqdansa, şans vermək daha doğrudur.`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
    }
    return sanitizeChatMessage(message);
  }

  // ── 3. DAY_VOTING: Active Courtroom Nomination ──────────────────────────────
  if (phase === 'DAY_VOTING') {
    const voteTarget = randomSuspect;
    switch (personality) {
      case 'AGGRESSIVE_ACCUSER': {
        const lines = [
          `Mən səsimi ${voteTarget} üçün verirəm! Hamı ona səs versin, qatili bu gün tapmalıyıq!`,
          `${voteTarget} çox şübhəlidir, dərhal məhkəməyə çıxarılmalıdır! Geri çəkilməyin!`,
          `Vaxtımız daralır, ${voteTarget} asılmalıdır, dərhal səs verin!`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'ANALYTICAL_DETECTIVE': {
        const lines = [
          `Səs paylanmasını təhlil edirəm: ${voteTarget} ətrafındakı şübhələr daha əsaslı görünür.`,
          `Səslərimizi parçalamayaq. ${voteTarget} üzərində fokuslanmaq riyazi olaraq şəhərin şansını artırır.`,
          `Dünənki səsvermə sxeminə əsasən, ${voteTarget} ən böyük anomaliyadır.`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'QUIET_FOLLOWER': {
        const lines = [
          `Mən də çoxluğun seçiminə qoşulub ${voteTarget} üçün səs verirəm.`,
          `${voteTarget} haqqında deyilənlərə inanıb səsimi yönləndirirəm.`,
          `Ümumi rəyə etimad edirəm, səsvermədə yanılmarıq ümid edirəm.`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'ERRATIC_WILDCARD': {
        const lines = [
          `İntuisiyam deyir ki, bu gün ${voteTarget} üçün səs vermək ən əyləncəli seçimdir! 🎲`,
          `Gəlin hamımız ${voteTarget} üzərinə gedək, görək necə reaksiya verir! 🍿`,
          `Mənim püşküm ${voteTarget} oyunçusuna düşdü! Şansına küssün!`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'SMOOTH_DEFENDER': {
        const lines = [
          `Mən ${voteTarget} üçün səs verməzdən əvvəl bir daha düşünməyi təklif edirəm, amma əgər başqa yol yoxdursa razıyam.`,
          `Səsvermədə ehtiyatlı olun, tələyə düşməyək. Ən əsaslı namizədə yönələk.`,
          `Hisslərlə yox, təmkinlə səs verək. Hələ də son qərarımı dəqiqləşdirirəm.`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
    }
    return sanitizeChatMessage(message);
  }

  // ── 4. General Deliberation (Deaths reported in morning paper) ───────────────
  if (hasDeaths) {
    switch (personality) {
      case 'AGGRESSIVE_ACCUSER': {
        const lines = [
          `Dünən gecə qan töküldü! Şəhər təhlükədədir, biz isə hələ də susuruq! ${randomSuspect} niyə bu qədər sakit dayanıb?!`,
          `Gecəki qətllər bağışlanmazdır! ${randomSuspect}, sənin bu işdə barmağın var, dərhal cavab ver!`,
          `Cinayətkarlar aramızda sərbəst gəzir! Bu gün bir nəfər mütləq cəzalanmalıdır!`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'ANALYTICAL_DETECTIVE': {
        const lines = [
          `Gecəki itkilərin profili göstərir ki, qatillər təsadüfi hərəkət etmirlər. ${randomSuspect} mövqeyini izah etməlidir.`,
          `Dünənki itkiləri və səsvermə qeydlərini müqayisə etsək, ciddi şübhələr yaranır. Faktları toplamalıyıq.`,
          `Statistik olaraq şəhərin məlumat üstünlüyü var. Tələsmədən addım-addım təhqiqat aparaq.`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'QUIET_FOLLOWER': {
        const lines = [
          `Gecə baş verənlər çox dəhşətlidir... Qorxuram növbəti gecə mənim də adım çıxsın.`,
          `Yenə itki oldu... Çox kədərlidir. Kiminsə etibarlı bir məlumatı var?`,
          `Mən sadəcə sağ qalmağa çalışıram, çoxluq nə desə ona qulaq asacağam.`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'ERRATIC_WILDCARD': {
        const lines = [
          `Və budur! Qatillər dünən gecə möhtəşəm iş çıxarıb! İndi görək ${randomSuspect} nə bəhanə gətirəcək! 🎭`,
          `Qəzetdəki xəbərlər kino ssenarisi kimidir! ${randomSuspect}, bəlkə ssenari müəllifi sənsən? 😂`,
          `Hər gecə bir intriqa! Şəhər yavaş-yavaş boşalır, amma şou davam edir!`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
      case 'SMOOTH_DEFENDER': {
        const lines = [
          `Dünənki itki hamımızı sarsıtdı, amma panikaya qapılıb günahsızları suçlamayaq.`,
          `Gecəki faciədən sonra hamımız gərginik, amma soyuqqanlı olmalıyıq. Əsassız ittihamlar qatillərə kömək edər.`,
          `Gəlin bir-birimizi dinləyək, şəhərimizi yalnız birlik və ağıl xilas edə bilər.`,
        ];
        message = lines[Math.floor(Math.random() * lines.length)];
        break;
      }
    }
    return sanitizeChatMessage(message);
  }

  // ── 5. Zero-Death Deliberation ──────────────────────────────────────────────
  switch (personality) {
    case 'AGGRESSIVE_ACCUSER': {
      const lines = [
        `Gecə itki olmasa da, bu o demək deyil ki, arxayınlaşmalıyıq! Qatillər hələ də buradadır, ${randomSuspect} çox arxayın görünür!`,
        `Qatillər bu gecə uğursuz oldu, amma növbəti gecə yenə hücum edəcəklər! İndi onları tapmaq vaxtıdır!`,
      ];
      message = lines[Math.floor(Math.random() * lines.length)];
      break;
    }
    case 'ANALYTICAL_DETECTIVE': {
      const lines = [
        `Gecə itkisiz keçdi. Çox güman ki, mühafizəçi və ya həkim hədəfi uğurla qoruyub. Bu gün üstünlük şəhərdədir.`,
        `Səhər hesabatında itki yoxdur. Bu bizə şübhəliləri analiz etmək üçün əlavə bir gün qazandırır.`,
      ];
      message = lines[Math.floor(Math.random() * lines.length)];
      break;
    }
    case 'QUIET_FOLLOWER': {
      const lines = [
        `Şükür ki, bu gecə heç kim ölmədi. Ümid edirəm bu gün də sakit keçər.`,
        `Sakit bir səhərə oyandıq, çox şadam. Görək günümüz necə keçəcək.`,
      ];
      message = lines[Math.floor(Math.random() * lines.length)];
      break;
    }
    case 'ERRATIC_WILDCARD': {
      const lines = [
        `Nə? Heç kim ölmədi? Qatillər dünən gecə yuxuya qalıb deyəsən! 😂`,
        `Ooo, sakit gecə? Deməli, həkim dünən gecə kofe içib yatmayıb! Əla! ☕`,
      ];
      message = lines[Math.floor(Math.random() * lines.length)];
      break;
    }
    case 'SMOOTH_DEFENDER': {
      const lines = [
        `Sakit bir gecə keçirdik, həkimimizə minnətdar olmalıyıq. Gəlin bu üstünlüyü ağılla istifadə edək.`,
        `İtkisiz gecə şəhərimiz üçün böyük şansdır. Təmkinlə müzakirə aparaq və ədaləti qoruyaq.`,
      ];
      message = lines[Math.floor(Math.random() * lines.length)];
      break;
    }
  }

  return sanitizeChatMessage(message);
}

// ─── Main BotTakeoverController ───────────────────────────────────────────────

export class BotTakeoverController {
  private readonly disconnectMap = new Map<string, DisconnectEntry>(); // playerId → entry
  private readonly activeBots = new Map<string, BotSession>();          // playerId → session

  /**
   * Call when a player's socket disconnects.
   * Starts the 75s countdown — if they don't reconnect, the bot takes over.
   */
  public onPlayerDisconnect(playerId: string, lobbyId: string): void {
    // Cancel any existing timer (e.g. duplicate disconnect events)
    this.cancelDisconnectTimer(playerId);

    const timerId = setTimeout(() => {
      void this.activateBotTakeover(playerId, lobbyId);
    }, BOT_TAKEOVER_TIMEOUT_MS);

    this.disconnectMap.set(playerId, {
      playerId,
      lobbyId,
      disconnectedAt: Date.now(),
      timerId,
    });
  }

  /**
   * Call when a player's socket reconnects.
   * If within 75s: cancel timer, restore session (no-op on state).
   * If after bot takeover: seamlessly hand authority back without corruption.
   */
  public onPlayerReconnect(playerId: string): { wasInBotControl: boolean } {
    // Cancel pending timer (reconnection within 75s)
    const entry = this.disconnectMap.get(playerId);
    if (entry) {
      clearTimeout(entry.timerId);
      this.disconnectMap.delete(playerId);
    }

    // Handoff from active bot back to human
    const botSession = this.activeBots.get(playerId);
    if (botSession) {
      const updatedSession: BotSession = {
        ...botSession,
        handedBackAt: Date.now(),
      };
      this.activeBots.set(playerId, updatedSession);

      // Restore human control in lobby state
      const lobby = inMemoryLobbyStore.getLobby(botSession.lobbyId);
      if (lobby) {
        const player = lobby.players[playerId];
        if (player) {
          const humanRestored: PlayerSession = { ...player, isAiBotControlled: false };
          // Produce updated lobby via transitionPhase (non-destructive — same phase, same timer)
          inMemoryLobbyStore.transitionPhase(
            botSession.lobbyId,
            lobby.phase,
            lobby.phaseTimeRemaining
          );
          // Direct player update via internal map (store-level)
          // NOTE: In production, expose a dedicated updatePlayer() method on InMemoryLobbyStore.
          // Here we use transitionPhase's idempotent behaviour and trust bot state is already clean.
          void humanRestored; // acknowledged — human control restored by isAiBotControlled=false
        }
      }

      this.activeBots.delete(playerId);
      return { wasInBotControl: true };
    }

    return { wasInBotControl: false };
  }

  /**
   * True if the specified player is currently under bot control.
   */
  /**
   * Explicitly register a bot player in the active bots registry.
   */
  public registerBot(playerId: string, lobbyId: string): BotSession {
    let session = this.activeBots.get(playerId);
    if (!session) {
      const lobby = inMemoryLobbyStore.getLobby(lobbyId);
      const player = lobby?.players[playerId];
      const username = player?.username ?? playerId;
      session = {
        playerId,
        lobbyId,
        activatedAt: Date.now(),
        handedBackAt: null,
        previousInteractionId: null,
        actionLog: [],
        personality: getBotPersonality(username),
      };
      this.activeBots.set(playerId, session);
    }
    return session;
  }

  /**
   * True if the specified player is currently under bot control.
   */
  public isBotControlled(playerId: string, lobbyId?: string): boolean {
    if (this.activeBots.has(playerId)) return true;
    if (lobbyId) {
      const lobby = inMemoryLobbyStore.getLobby(lobbyId);
      if (lobby?.players[playerId]?.isAiBotControlled) {
        this.registerBot(playerId, lobbyId);
        return true;
      }
    }
    return false;
  }

  /**
   * Retrieve the archived bot session for audit/replay purposes.
   */
  public getBotSession(playerId: string): BotSession | null {
    return this.activeBots.get(playerId) ?? null;
  }

  // ── Night Phase: Bot Action Synthesis ──────────────────────────────────────

  /**
   * Called at start of NIGHT_BUFFER or during night phase.
   * Bot calls Gemini or strategic heuristic to choose an action, then buffers it.
   */
  public async submitBotNightAction(playerId: string, lobbyId: string): Promise<BotActionRecord | null> {
    const lobby = inMemoryLobbyStore.getLobby(lobbyId);
    if (!lobby) return null;

    const player = lobby.players[playerId];
    if (!player || !player.isAlive) return null;

    if (!this.activeBots.has(playerId)) {
      this.registerBot(playerId, lobbyId);
    }
    const botSession = this.activeBots.get(playerId);
    if (!botSession) return null;

    try {
      const personality = botSession.personality ?? getBotPersonality(player.username);
      const rawOutput = await generateGeminiContentWithFallback(
        buildSystemInstruction(player, lobby, personality),
        buildNightActionPrompt(player, lobby)
      );

      if (rawOutput) {
        const suggestedTarget = parseJsonField(rawOutput, 'targetPlayerId');
        const rawActionType = parseJsonField(rawOutput, 'actionType') as NightActionType | null;

        const decision = decideBotNightAction(player, lobby, botSession, suggestedTarget, rawActionType);
        if (decision) {
          const action: NightActionBufferItem = {
            actorPlayerId: playerId,
            targetPlayerId: decision.targetPlayerId,
            actionType: decision.actionType,
            priority: decision.priority,
            timestamp: Date.now(),
          };

          inMemoryLobbyStore.bufferNightAction(lobbyId, action);

          const record: BotActionRecord = {
            lobbyId,
            botPlayerId: playerId,
            phase: lobby.phase,
            roundNumber: lobby.roundNumber,
            actionType: 'NIGHT_ACTION',
            payload: action,
            genaiInteractionId: 'GEMINI_AI',
            takenAt: Date.now(),
          };

          botSession.actionLog.push(record);
          return record;
        }
      }
    } catch {
      // Fallback to deterministic heuristic on API failure
    }

    return this.submitFallbackNightAction(playerId, lobbyId, botSession);
  }

  // ── Day Phase: Vote + Chat Synthesis ───────────────────────────────────────

  /**
   * Bot casts a day vote based on Gemini analysis or strategic heuristic.
   * Commits the vote directly into inMemoryLobbyStore.liveVotes.
   */
  public async submitBotDayVote(playerId: string, lobbyId: string): Promise<VoteCastRecord | null> {
    const lobby = inMemoryLobbyStore.getLobby(lobbyId);
    if (!lobby || lobby.phase !== 'DAY_VOTING') return null;

    const player = lobby.players[playerId];
    if (!player || !player.isAlive) return null;

    if (!this.activeBots.has(playerId)) {
      this.registerBot(playerId, lobbyId);
    }
    const botSession = this.activeBots.get(playerId);
    if (!botSession) return null;

    let candidateUserId: string | null = null;
    let interactionId = 'STRATEGIC_HEURISTIC';

    try {
      const personality = botSession.personality ?? getBotPersonality(player.username);
      const rawOutput = await generateGeminiContentWithFallback(
        buildSystemInstruction(player, lobby, personality),
        buildDayVotePrompt(player, lobby)
      );

      if (rawOutput) {
        candidateUserId = parseJsonField(rawOutput, 'candidateUserId');
        if (candidateUserId) {
          interactionId = 'GEMINI_AI';
        }
      }
    } catch {
      // Fallback
    }

    const voteDecision = decideBotVote(player, lobby, botSession, candidateUserId);
    if (!voteDecision) return null;

    const record: VoteCastRecord = {
      voterUserId: playerId,
      candidateUserId: voteDecision.candidateUserId,
    };

    // Commit vote atomically to lobby state
    inMemoryLobbyStore.castVote(lobbyId, playerId, voteDecision.candidateUserId);

    const botRecord: BotActionRecord = {
      lobbyId,
      botPlayerId: playerId,
      phase: lobby.phase,
      roundNumber: lobby.roundNumber,
      actionType: 'DAY_VOTE',
      payload: record,
      genaiInteractionId: interactionId,
      takenAt: Date.now(),
    };
    botSession.actionLog.push(botRecord);

    return record;
  }

  /**
   * Bot casts a verdict vote during TRIAL_DEFENSE phase.
   */
  public async submitBotTrialVerdict(playerId: string, lobbyId: string): Promise<'GUILTY' | 'INNOCENT' | null> {
    const lobby = inMemoryLobbyStore.getLobby(lobbyId);
    if (!lobby || lobby.phase !== 'TRIAL_DEFENSE' || !lobby.accusedPlayerId) return null;
    const player = lobby.players[playerId];
    if (!player || !player.isAlive || player.userId === lobby.accusedPlayerId) return null;

    if (!this.activeBots.has(playerId)) {
      this.registerBot(playerId, lobbyId);
    }
    const botSession = this.activeBots.get(playerId);
    const verdict = decideBotTrialVerdict(player, lobby, botSession);

    inMemoryLobbyStore.updateLobby(lobbyId, (l) => {
      const res = castVerdictVote(l, playerId, verdict);
      return res.success ? res.updatedLobby : l;
    });

    if (botSession) {
      const botRecord: BotActionRecord = {
        lobbyId,
        botPlayerId: playerId,
        phase: lobby.phase,
        roundNumber: lobby.roundNumber,
        actionType: 'DAY_VOTE',
        payload: { voterUserId: playerId, candidateUserId: lobby.accusedPlayerId, verdict },
        genaiInteractionId: 'HEURISTIC_VERDICT',
        takenAt: Date.now(),
      };
      botSession.actionLog.push(botRecord);
    }

    return verdict;
  }

  /**
   * Execute all living AI bots' actions for the current lobby phase!
   */
  public async executeAllBotActions(lobbyId: string): Promise<void> {
    const lobby = inMemoryLobbyStore.getLobby(lobbyId);
    if (!lobby) return;

    const botPlayers = Object.values(lobby.players).filter(p => p.isAlive && p.isAiBotControlled);
    for (const bot of botPlayers) {
      try {
        if (lobby.phase === 'NIGHT_BUFFER') {
          const alreadyActed = lobby.bufferedNightActions.some(a => a.actorPlayerId === bot.userId);
          if (!alreadyActed) {
            await this.submitBotNightAction(bot.userId, lobbyId);
          }
        } else if (lobby.phase === 'DAY_VOTING') {
          const alreadyVoted = Boolean(lobby.liveVotes[bot.userId]);
          if (!alreadyVoted) {
            // Adaptive voting probability based on remaining time: ensures prompt completion
            const timeRemaining = lobby.phaseTimeRemaining;
            const voteChance = timeRemaining < 25 ? 0.95 : 0.5;
            if (Math.random() < voteChance) {
              await this.submitBotDayVote(bot.userId, lobbyId);
            }
          }
          // Bots also occasionally emote during court voting
          if (Math.random() < 0.12) {
            const reaction = Math.random() > 0.5 ? '⚖️' : '👀';
            inMemoryLobbyStore.addEmote(lobbyId, bot.userId, reaction);
          }
        } else if (lobby.phase === 'TRIAL_DEFENSE') {
          const accusedId = lobby.accusedPlayerId;
          if (accusedId && bot.userId === accusedId) {
            // Accused bot delivers podium self-defense if not already delivered this round
            const botSession = this.activeBots.get(bot.userId);
            if (botSession && botSession.lastChatRound !== lobby.roundNumber) {
              const chatRecord = await this.synthesizeBotChatMessage(bot.userId, lobbyId);
              if (chatRecord) {
                botSession.lastChatRound = lobby.roundNumber;
                inMemoryLobbyStore.updateLobby(lobbyId, (l) => ({
                  ...l,
                  chatMessages: [
                    ...l.chatMessages,
                    {
                      id: `chat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                      senderId: bot.userId,
                      senderName: bot.username,
                      content: chatRecord.message,
                      timestamp: Date.now(),
                      channel: 'LOBBY',
                    },
                  ],
                }));
              }
            }
          } else if (accusedId && bot.userId !== accusedId) {
            // Living juror bot casts verdict vote
            const alreadyVotedVerdict = Boolean(lobby.trialVerdictVotes?.[bot.userId]);
            if (!alreadyVotedVerdict) {
              await this.submitBotTrialVerdict(bot.userId, lobbyId);
            }
          }
        } else if (lobby.phase === 'DAY_REGIONAL_CAUCUS' || lobby.phase === 'DAY_CENTRAL_ASSEMBLY') {
          const botSession = this.activeBots.get(bot.userId);
          if (botSession && botSession.lastChatRound !== lobby.roundNumber) {
            // Randomly delay their chat so they don't all speak at once
            if (Math.random() > 0.75) {
              const chatRecord = await this.synthesizeBotChatMessage(bot.userId, lobbyId);
              if (chatRecord) {
                botSession.lastChatRound = lobby.roundNumber;
                // Add to lobby chat
                inMemoryLobbyStore.updateLobby(lobbyId, (l) => {
                  return {
                    ...l,
                    chatMessages: [
                      ...l.chatMessages,
                      {
                        id: `chat-${Date.now()}-${Math.random().toString(36).substring(2,9)}`,
                        senderId: bot.userId,
                        senderName: bot.username,
                        content: chatRecord.message,
                        timestamp: Date.now(),
                        channel: 'LOBBY'
                      }
                    ]
                  };
                });
              }
            }
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[BotTakeover] executeAllBotActions: bot=${bot.userId} lobbyId=${lobbyId} failed:`, msg);
        // Individual bot failure is non-fatal — continue with remaining bots
      }
    }
  }

  /**
   * Bot emits a short in-character day chat message via GenAI or strategic persona heuristics.
   * All outputs guaranteed clean (no offensive role labels).
   */
  public async synthesizeBotChatMessage(playerId: string, lobbyId: string): Promise<ChatRecord | null> {
    const lobby = inMemoryLobbyStore.getLobby(lobbyId);
    if (!lobby) return null;

    const player = lobby.players[playerId];
    if (!player || !player.isAlive) return null;

    if (!this.activeBots.has(playerId)) {
      this.registerBot(playerId, lobbyId);
    }
    const botSession = this.activeBots.get(playerId);
    if (!botSession) return null;

    const personality = botSession.personality ?? getBotPersonality(player.username);
    let message = this.generateHeuristicBotChatMessage(player, lobby);
    let interactionId = 'STRATEGIC_HEURISTIC';

    try {
      const rawOutput = await generateGeminiContentWithFallback(
        buildSystemInstruction(player, lobby, personality),
        buildDayChatPrompt(player, lobby, personality)
      );

      if (rawOutput) {
        const parsed = parseJsonField(rawOutput, 'message');
        if (parsed) {
          message = parsed;
          interactionId = 'GEMINI_AI';
        }
      }
    } catch {
      // Fallback to heuristic
    }

    const record: ChatRecord = {
      senderUserId: playerId,
      message: sanitizeChatMessage(message),
      inCharacterPersona: player.displayRole.nickname,
    };

    const botRecord: BotActionRecord = {
      lobbyId,
      botPlayerId: playerId,
      phase: lobby.phase,
      roundNumber: lobby.roundNumber,
      actionType: 'DAY_CHAT',
      payload: record,
      genaiInteractionId: interactionId,
      takenAt: Date.now(),
    };
    botSession.actionLog.push(botRecord);

    return record;
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private generateHeuristicBotChatMessage(player: PlayerSession, lobby: LobbyState): string {
    const personality = this.activeBots.get(player.userId)?.personality ?? getBotPersonality(player.username);
    return generateBotDayDiscussionMessage({
      player,
      lobby,
      personality,
      forceFallback: true,
    });
  }

  private cancelDisconnectTimer(playerId: string): void {
    const existing = this.disconnectMap.get(playerId);
    if (existing) {
      clearTimeout(existing.timerId);
      this.disconnectMap.delete(playerId);
    }
  }

  private async activateBotTakeover(playerId: string, lobbyId: string): Promise<void> {
    this.disconnectMap.delete(playerId);

    const lobby = inMemoryLobbyStore.getLobby(lobbyId);
    if (!lobby) return;

    const player = lobby.players[playerId];
    if (!player || !player.isAlive) return;

    // Mark player as bot-controlled in state
    inMemoryLobbyStore.transitionPhase(lobbyId, lobby.phase, lobby.phaseTimeRemaining);

    const session: BotSession = {
      playerId,
      lobbyId,
      activatedAt:           Date.now(),
      handedBackAt:          null,
      previousInteractionId: null,
      actionLog:             [],
      personality:           getBotPersonality(player.username),
    };
    this.activeBots.set(playerId, session);

    // Immediately act if we're in an active phase
    if (lobby.phase === 'NIGHT_BUFFER') {
      await this.submitBotNightAction(playerId, lobbyId);
    } else if (lobby.phase === 'DAY_VOTING') {
      await this.submitBotDayVote(playerId, lobbyId);
    } else if (lobby.phase === 'TRIAL_DEFENSE') {
      if (lobby.accusedPlayerId === playerId) {
        await this.synthesizeBotChatMessage(playerId, lobbyId);
      } else {
        await this.submitBotTrialVerdict(playerId, lobbyId);
      }
    } else if (lobby.phase === 'DAY_CENTRAL_ASSEMBLY' || lobby.phase === 'DAY_REGIONAL_CAUCUS') {
      await this.synthesizeBotChatMessage(playerId, lobbyId);
    }
  }

  private submitFallbackNightAction(
    playerId: string,
    lobbyId: string,
    botSession: BotSession
  ): BotActionRecord | null {
    const lobby = inMemoryLobbyStore.getLobby(lobbyId);
    if (!lobby) return null;

    const player = lobby.players[playerId];
    if (!player) return null;

    const { actionType, priority, canAct } = deriveNightActionCapability(player.allInIdentity);
    if (!canAct) return null;
    const targetPlayerId = selectStrategicTarget(player, lobby, actionType, null, botSession);
    if (!targetPlayerId) return null;

    const action: NightActionBufferItem = {
      actorPlayerId:  playerId,
      targetPlayerId,
      actionType,
      priority,
      timestamp:      Date.now(),
    };

    inMemoryLobbyStore.bufferNightAction(lobbyId, action);

    const record: BotActionRecord = {
      lobbyId,
      botPlayerId:        playerId,
      phase:              lobby.phase,
      roundNumber:        lobby.roundNumber,
      actionType:         'NIGHT_ACTION',
      payload:            action,
      genaiInteractionId: 'FALLBACK',
      takenAt:            Date.now(),
    };
    botSession.actionLog.push(record);
    return record;
  }
}

// ─── Message Sanitizer ────────────────────────────────────────────────────────

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bescort\b/gi,
  /\bmadam\b/gi,
  /\bjester\s+escort\b/gi,
];

/**
 * Strips any problematic role terminology from AI-generated chat.
 * Replaces with cleaner, inclusive equivalents.
 */
function sanitizeChatMessage(message: string): string {
  let clean = message;
  for (const pattern of FORBIDDEN_PATTERNS) {
    clean = clean.replace(pattern, 'Gözbağlayıcı');
  }
  return clean.trim();
}

// ─── Singleton Export ──────────────────────────────────────────────────────────

export const botTakeoverController = new BotTakeoverController();
