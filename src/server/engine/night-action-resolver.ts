/**
 * Deterministic Night Action Resolver
 * Processes buffered actions in strict priority order 1–6 with trait modifiers.
 *
 * Phase 2 Priority Map (as specified):
 *   1 — BLOCK / Disruption
 *   2 — MISDIRECT / Redirection
 *   3 — PROTECT (Doctor heal + vest charge)
 *   4 — KILL & Crossfire (bounded by globalNightKillCap)
 *   5 — FRAME / Deception
 *   6 — INVESTIGATE / Intel
 *
 * Enterprise Mafia / Social Deduction Platform - Phase 2
 */

import {
  LobbyState,
  NightActionBufferItem,
  NightActionPriority,
  NightActionType,
  PlayerSession,
} from '../../types/game';
import { CoreFaction, InnateTraitType } from '../../types/roles';
import { DantesInfernoState } from '../../types/minigames';
import {
  DeathCause,
  InvestigationResult,
  MorningNewspaper,
  NightDeathRecord,
  NightResolutionFlags,
  NightResolutionOutput,
} from '../../types/engine';

// ─── Trait Helpers ──────────────────────────────────────────────────────────

function hasTrait(player: PlayerSession, trait: InnateTraitType): boolean {
  return player.allInIdentity?.layer3Trait === trait;
}

function getFaction(player: PlayerSession): CoreFaction {
  return player.allInIdentity?.layer1Faction ?? 'TOWN';
}

function isKillerFaction(faction: CoreFaction): boolean {
  return (
    faction === 'MAFIA' ||
    faction === 'YAKUZA' ||
    faction === 'VOID_CULT' ||
    faction === 'NEUTRAL_KILLER'
  );
}

function deathCauseForFaction(faction: CoreFaction): DeathCause {
  switch (faction) {
    case 'MAFIA':           return 'MAFIA_KILL';
    case 'YAKUZA':          return 'YAKUZA_KILL';
    case 'VOID_CULT':       return 'VOID_CULT_SACRIFICE';
    case 'NEUTRAL_KILLER':  return 'NEUTRAL_KILLER_KILL';
    default:                return 'CROSSFIRE';
  }
}

// ─── Crypto-quality jitter (no crypto module needed; uses Date precision + XOR) ──

/**
 * Returns a deterministic-looking 3–7 second jitter in milliseconds
 * using timestamp XOR for entropy (avoids requiring node:crypto in the module).
 */
export function computeCryptoJitterMs(minS = 3, maxS = 7): number {
  const nowBits = Date.now();
  const xored = (nowBits ^ (nowBits >>> 13) ^ (nowBits >>> 7));
  const rangeMs = (maxS - minS) * 1000;
  return minS * 1000 + (Math.abs(xored) % rangeMs);
}

// ─── Per-player flag builder ─────────────────────────────────────────────────

function buildInitialFlags(players: Readonly<Record<string, PlayerSession>>): Record<string, NightResolutionFlags> {
  const flags: Record<string, NightResolutionFlags> = {};
  for (const [id, p] of Object.entries(players)) {
    flags[id] = {
      isTimeWarped:          false,
      isTimeWarped:          false,
      isBlocked:             false,
      isProtected:           false,
      vestChargesRemaining:  hasTrait(p, 'BULLETPROOF_VEST') ? 1 : hasTrait(p, 'SURGICAL_RESILIENCE') ? 2 : 0,
      redirectedTargetId:    null,
      isFramed:              false,
      factionMaskOverride:   hasTrait(p, 'FALSE_DOCUMENTATION') ? ('TOWN' as CoreFaction) : null,
      retaliationFuseActive: hasTrait(p, 'RETALIATION_FUSE'),
      coldBloodedImmune:     hasTrait(p, 'COLD_BLOODED'),
      poisonImmune:          hasTrait(p, 'POISON_IMMUNITY'),
    };
  }
  return flags;
}

// ─── Priority 1: BLOCK ───────────────────────────────────────────────────────

/**
 * Marks actors as blocked. COLD_BLOODED players ignore blocks.
 * A blocked actor's actions are voided at all subsequent priorities.
 */

// ─── Priority 0: TIME_WARP ─────────────────────────────────────────────────────────────

function applyTimeWarps(
  actions: readonly NightActionBufferItem[],
  flags: Record<string, NightResolutionFlags>,
  players: Readonly<Record<string, PlayerSession>>
): void {
  for (const action of actions) {
    if (action.priority !== 0) continue;
    if (action.actionType !== 'TIME_WARP') continue;
    const target = action.targetPlayerId;
    if (players[target]) {
      flags[target] = { ...(flags[target] as NightResolutionFlags), isTimeWarped: true };
    }
  }
}

function applyBlocks(
  actions: readonly NightActionBufferItem[],
  flags: Record<string, NightResolutionFlags>,
  players: Readonly<Record<string, PlayerSession>>
): void {
  for (const action of actions) {
    if (action.priority !== 1) continue;
    if (action.actionType !== 'BLOCK') continue;

    const actor = action.actorPlayerId;
    const targetActor = action.targetPlayerId;
    const targetPlayer = players[targetActor];
    if (flags[actor]?.isTimeWarped || flags[targetActor]?.isTimeWarped) continue;
    if (!targetPlayer) continue;

    // COLD_BLOODED trait: immune to BLOCK
    if (flags[targetActor]?.coldBloodedImmune) continue;

    flags[targetActor] = { ...(flags[targetActor] as NightResolutionFlags), isBlocked: true };
  }
}

// ─── Priority 2: MISDIRECT ──────────────────────────────────────────────────

/**
 * Reroutes subsequent actions that target `targetPlayerId` to `redirectedTargetId` instead.
 * Actors with PHANTOM_STEP can misdirect without being tracked.
 */
function applyMisdirections(
  actions: readonly NightActionBufferItem[],
  flags: Record<string, NightResolutionFlags>,
  players: Readonly<Record<string, PlayerSession>>
): void {
  for (const action of actions) {
    if (action.priority !== 2) continue;
    if (action.actionType !== 'MISDIRECT') continue;
    if (flags[action.actorPlayerId]?.isBlocked) continue; // blocked misdirector

    const targetPlayer = players[action.targetPlayerId];
    if (!targetPlayer) continue;

    // The misdirection target gets the redirect stored
    flags[action.targetPlayerId] = {
      ...(flags[action.targetPlayerId] as NightResolutionFlags),
      redirectedTargetId: action.actorPlayerId, // misdirector routes their own target's attention
    };
  }
}

/** Resolve the effective target for an action, following misdirection chains (loop-safe) */
function resolveEffectiveTarget(
  originalTarget: string,
  flags: Record<string, NightResolutionFlags>,
  depth = 0
): string {
  if (depth > 5) return originalTarget; // loop guard
  const redirect = flags[originalTarget]?.redirectedTargetId;
  if (!redirect || redirect === originalTarget) return originalTarget;
  return resolveEffectiveTarget(redirect, flags, depth + 1);
}

// ─── Priority 3: PROTECT ────────────────────────────────────────────────────

/**
 * Doctor / CITY_SURGEON grants protection flag.
 * SURGICAL_RESILIENCE holders self-protect for 2 nights.
 */
function applyProtections(
  actions: readonly NightActionBufferItem[],
  flags: Record<string, NightResolutionFlags>
): void {
  for (const action of actions) {
    if (action.priority !== 3) continue;
    if (action.actionType !== 'PROTECT') continue;
    if (flags[action.actorPlayerId]?.isBlocked) continue;

    const effectiveTarget = resolveEffectiveTarget(action.targetPlayerId, flags);
    if (!flags[effectiveTarget]) continue;

    flags[effectiveTarget] = { ...(flags[effectiveTarget] as NightResolutionFlags), isProtected: true };
  }

  // Self-vest: players with vestChargesRemaining > 0 are implicitly protected
  for (const [id, f] of Object.entries(flags)) {
    if (f.vestChargesRemaining > 0) {
      flags[id] = { ...f, isProtected: true };
    }
  }
}

// ─── Priority 4: KILL & Crossfire ───────────────────────────────────────────

interface KillAttempt {
  readonly actorId: string;
  readonly effectiveTargetId: string;
  readonly killerFaction: CoreFaction;
  readonly pierceProtection: boolean; // SILENCER_ATTACHMENT bypasses protection once
  readonly signature?: string;
}

function applyKills(
  actions: readonly NightActionBufferItem[],
  flags: Record<string, NightResolutionFlags>,
  players: Readonly<Record<string, PlayerSession>>,
  globalNightKillCap: number,
  danteState: DantesInfernoState | undefined,
  roundNumber: number
): { deaths: NightDeathRecord[]; updatedPlayers: Record<string, PlayerSession>; updatedFlags: Record<string, NightResolutionFlags>; mutinyActive?: boolean; mutineerIds?: string[]; protectedIds: string[] } {
  // Mutiny tracking
  let overallMutinyActive = false;
  let allMutineerIds: string[] = [];

  const deaths: NightDeathRecord[] = [];
  const protectedIds: string[] = [];
  const playerMap: Record<string, PlayerSession> = { ...players };
  let killsThisNight = 0;

  // Collect all kill attempts
  let rawAttempts: KillAttempt[] = [];
  for (const action of actions) {
    if (action.priority !== 4) continue;
    if (action.actionType !== 'KILL') continue;
    if (flags[action.actorPlayerId]?.isBlocked) continue;

    const actor = players[action.actorPlayerId];
    if (!actor || !actor.isAlive) continue;

    const effectiveTarget = resolveEffectiveTarget(action.targetPlayerId, flags);
    const killerFaction = getFaction(actor);
    const pierceProtection = hasTrait(actor, 'SILENCER_ATTACHMENT');

    rawAttempts.push({ actorId: action.actorPlayerId, effectiveTargetId: effectiveTarget, killerFaction, pierceProtection, signature: action.signature });
  }

  // --- SYNDICATE CONSENSUS LOGIC (Probability-based Kill) ---
  const attempts: KillAttempt[] = [];
  
  // Add SOLO Killers first
  const soloKillers = rawAttempts.filter(a => a.killerFaction === 'NEUTRAL_KILLER' || a.killerFaction === 'VOID_CULT');
  soloKillers.forEach(sk => attempts.push(sk));

  for (const faction of ['MAFIA', 'YAKUZA'] as CoreFaction[]) {
    const factionAttempts = rawAttempts.filter(a => a.killerFaction === faction);
    if (factionAttempts.length === 0) continue;
    
    const aliveSyndicateMembers = Object.values(players).filter(p => p.isAlive && getFaction(p) === faction);
    const n = aliveSyndicateMembers.length;
    
    // Find if there's a Godfather/Don who voted
    let godfatherTarget = null;
    let godfatherActor = null;
    let pierce = false;
    
    for (const att of factionAttempts) {
      const p = players[att.actorId];
      if (p && (p.displayRole.formatted?.toLowerCase().includes('don') || p.displayRole.formatted?.toLowerCase().includes('godfather'))) {
        godfatherTarget = att.effectiveTargetId;
        godfatherActor = att.actorId;
      }
      if (att.pierceProtection) pierce = true;
    }
    
    // Determine Consensus Target
    let consensusTarget = godfatherTarget;
    if (!consensusTarget) {
      const targetCounts: Record<string, number> = {};
      for (const att of factionAttempts) {
        targetCounts[att.effectiveTargetId] = (targetCounts[att.effectiveTargetId] || 0) + 1;
      }
      // Max votes
      consensusTarget = Object.keys(targetCounts).reduce((a, b) => targetCounts[a] > targetCounts[b] ? a : b);
    }
    
    // Calculate consensus ratio
    let votesForConsensus = factionAttempts.filter(a => a.effectiveTargetId === consensusTarget).length;
    const ratio = n > 0 ? (votesForConsensus / n) : 1;
    
    // Mutiny check: If ratio < 0.3, dissenting members steal the kill!
    let mutinyActive = false;
    let mutineerIds: string[] = [];
    if (ratio < 0.3) {
      mutinyActive = true;
      const dissentingAttempts = factionAttempts.filter(a => a.effectiveTargetId !== consensusTarget);
      
      const dissentingCounts: Record<string, number> = {};
      for (const att of dissentingAttempts) {
        dissentingCounts[att.effectiveTargetId] = (dissentingCounts[att.effectiveTargetId] || 0) + 1;
        mutineerIds.push(att.actorId);
      }
      
      if (Object.keys(dissentingCounts).length > 0) {
        consensusTarget = Object.keys(dissentingCounts).reduce((a, b) => dissentingCounts[a] > dissentingCounts[b] ? a : b);
        votesForConsensus = dissentingAttempts.filter(a => a.effectiveTargetId === consensusTarget).length;
        console.log(`[${faction} MUTINY] Faction revolted! New target: ${consensusTarget}`);
      }
    }
    
    // Probability threshold based on final unified vote vs total
    const mutinyAdjustedRatio = n > 0 ? (votesForConsensus / n) : 1;
    let probability = 1.0;
    if (mutinyAdjustedRatio < 0.5) probability = 0.3;
    else if (mutinyAdjustedRatio < 0.8) probability = 0.7;
    else if (mutinyAdjustedRatio < 1.0) probability = 0.9;
    
    // Roll the dice!
    if (Math.random() <= probability) {
      const leadActor = factionAttempts.find(a => a.effectiveTargetId === consensusTarget)?.actorId || factionAttempts[0].actorId;
      attempts.push({
        actorId: leadActor,
        effectiveTargetId: consensusTarget,
        killerFaction: faction,
        pierceProtection: pierce
      });
    } else {
      console.log(`[${faction} KIL FAIL] Rolled against ${probability}. Kill fizzled!`);
    }
    
    if (mutinyActive) {
      overallMutinyActive = true;
      allMutineerIds.push(...mutineerIds);
    }
  }

  // Add all other non-syndicate kills (Neutral Killers, Void Cult, etc.)
  for (const att of rawAttempts) {
    if (att.killerFaction !== 'MAFIA' && att.killerFaction !== 'YAKUZA') {
      attempts.push(att);
    }
  }

  // ─── GODFATHER PUNISHMENT ──────────────────────────────────────────────────
  // If mutiny happened last night AND the Godfather is alive AND did NOT submit
  // a kill action this night, the engine automatically adds a punishment kill
  // targeting a random mutineer (only those still alive).
  for (const faction of ['MAFIA', 'YAKUZA'] as CoreFaction[]) {
    const prevMutineerIds = (players as Record<string, PlayerSession & { _punishPending?: string[] }>);
    // Check LobbyState-persisted mutineerIds via the players map special field
    // We rely on the dispatcher having written mutineerIds into lobby state.
    // At resolve time we only have 'players' — so we check a special encoded trait or
    // use roundNumber-based logic: if overallMutinyActive was set THIS night, schedule
    // punishment for NEXT night by storing into a buffered action.
    // 
    // PUNISHMENT path: If this faction had a mutiny THIS night, the Godfather/Don 
    // auto-targets one random alive mutineer with a buffered KILL for NEXT night.
    if (overallMutinyActive && allMutineerIds.length > 0) {
      const godfatherPlayer = Object.values(players).find(p =>
        p.isAlive &&
        getFaction(p) === faction &&
        (p.displayRole.formatted?.toLowerCase().includes('don') ||
         p.displayRole.formatted?.toLowerCase().includes('godfather'))
      );
      
      if (godfatherPlayer) {
        // Pick a random alive mutineer to punish next night
        const aliveMutineers = allMutineerIds.filter(id => {
          const mp = playerMap[id];
          return mp && mp.isAlive;
        });
        
        if (aliveMutineers.length > 0) {
          const punishTarget = aliveMutineers[Math.floor(Math.random() * aliveMutineers.length)]!;
          // Auto-inject a KILL attempt from the Godfather against the mutineer
          attempts.push({
            actorId: godfatherPlayer.userId,
            effectiveTargetId: punishTarget,
            killerFaction: faction,
            pierceProtection: false,
          });
          console.log(`[GODFATHER PUNISHMENT] ${godfatherPlayer.username} auto-punishes mutineer ${punishTarget}`);
        }
      }
    }
  }

  // Group attempts by effective target (crossfire resolution)
  const byTarget: Record<string, KillAttempt[]> = {};
  for (const att of attempts) {
    if (!byTarget[att.effectiveTargetId]) byTarget[att.effectiveTargetId] = [];
    (byTarget[att.effectiveTargetId] as KillAttempt[]).push(att);
  }

  for (const [targetId, targetAttempts] of Object.entries(byTarget)) {
    if (killsThisNight >= globalNightKillCap) break;

    const targetPlayer = playerMap[targetId];
    if (!targetPlayer || !targetPlayer.isAlive) continue;

    const targetFlags = flags[targetId] as NightResolutionFlags;
    const piercePresent = targetAttempts.some(a => a.pierceProtection);

    // Protected and not pierced → no kill
    if (targetFlags.isProtected && !piercePresent) {
      if (!protectedIds.includes(targetId)) protectedIds.push(targetId);
      // Vest charge deduction when protection came from vest
      if (targetFlags.vestChargesRemaining > 0) {
        flags[targetId] = {
          ...targetFlags,
          vestChargesRemaining: targetFlags.vestChargesRemaining - 1,
          isProtected: targetFlags.vestChargesRemaining - 1 > 0,
        };
      }
      // RETALIATION_FUSE: attacker(s) die when attack is absorbed
      for (const att of targetAttempts) {
        if (targetFlags.retaliationFuseActive && killsThisNight < globalNightKillCap) {
          const attacker = playerMap[att.actorId];
          if (attacker && attacker.isAlive) {
            playerMap[att.actorId] = { ...attacker, isAlive: false };
            deaths.push({
              victimPlayerId: att.actorId,
              cause: 'RETALIATION_FUSE_COUNTER',
              killerFaction: null,
              isCleaned: false,
            });
            killsThisNight++;
          }
        }
      }
      continue;
    }

    // POISON_IMMUNITY: immune to indirect/cult-vector kills (not direct faction kill)
    if (targetFlags.poisonImmune) {
      const directKill = targetAttempts.filter(a => a.killerFaction === 'MAFIA' || a.killerFaction === 'YAKUZA');
      if (directKill.length === 0) continue;
    }

    // Determine cause: if multiple factions hit the same target → CROSSFIRE
    const factions = new Set(targetAttempts.map(a => a.killerFaction));
    const cause: DeathCause = factions.size > 1
      ? 'CROSSFIRE'
      : deathCauseForFaction(targetAttempts[0]!.killerFaction);

    // VIOLENCE circle: cleaned lynch applies to day — night deaths are cleaned only if Coroner active
    const isCleaned = false; // Night deaths uncleaned; cleaning handled in day phase

    playerMap[targetId] = { ...targetPlayer, isAlive: false };
    deaths.push({ victimPlayerId: targetId, cause, killerFaction: factions.size === 1 ? targetAttempts[0]!.killerFaction : null, isCleaned, signature: targetAttempts[0]?.signature });
    killsThisNight++;

    // RETALIATION_FUSE: non-protected target, attacker still dies (kamikaze on hit)
    for (const att of targetAttempts) {
      const attacker = playerMap[att.actorId];
      if (attacker && attacker.isAlive && flags[att.actorId]?.retaliationFuseActive) {
        if (killsThisNight < globalNightKillCap) {
          playerMap[att.actorId] = { ...attacker, isAlive: false };
          deaths.push({ victimPlayerId: att.actorId, cause: 'RETALIATION_FUSE_COUNTER', killerFaction: null, isCleaned: false });
          killsThisNight++;
        }
      }
    }
  }

  return { deaths, updatedPlayers: playerMap, updatedFlags: flags, mutinyActive: overallMutinyActive, mutineerIds: allMutineerIds, protectedIds };
}

// ─── Priority 5: FRAME / Deception ──────────────────────────────────────────

/**
 * Marks players as framed so subsequent investigations see false guilt.
 * Does not apply if actor was blocked.
 */
function applyFrames(
  actions: readonly NightActionBufferItem[],
  flags: Record<string, NightResolutionFlags>
): void {
  for (const action of actions) {
    if (action.priority !== 5) continue;
    if (action.actionType !== 'FRAME') continue;
    if (flags[action.actorPlayerId]?.isBlocked) continue;

    const effectiveTarget = resolveEffectiveTarget(action.targetPlayerId, flags);
    if (!flags[effectiveTarget]) continue;

    flags[effectiveTarget] = { ...(flags[effectiveTarget] as NightResolutionFlags), isFramed: true, factionMaskOverride: 'MAFIA' };
  }
}

// ─── Priority 6: INVESTIGATE / Intel ─────────────────────────────────────────

/**
 * Produces private InvestigationResult records.
 * CIRCLE_8_FRAUD: 50% chance result is blurred (random alternate faction).
 * INSIDER_ACCESS trait: reveals true faction bypassing FRAME.
 */
const FACTION_POOL: readonly CoreFaction[] = ['TOWN', 'MAFIA', 'YAKUZA', 'VOID_CULT', 'NEUTRAL_EVIL'];

function pickAlternateFaction(trueFaction: CoreFaction): CoreFaction {
  const others = FACTION_POOL.filter(f => f !== trueFaction);
  return others[Math.floor(Math.random() * others.length)] ?? 'TOWN';
}


// ─── Priority 7: RESURRECT ─────────────────────────────────────────────────────────────

function applyResurrections(
  actions: readonly NightActionBufferItem[],
  flags: Record<string, NightResolutionFlags>,
  players: Record<string, PlayerSession>,
  publicDeaths: NightDeathRecord[]
): void {
  for (const action of actions) {
    if (action.priority !== 7) continue;
    if (action.actionType !== 'RESURRECT') continue;

    const actor = action.actorPlayerId;
    if (flags[actor]?.isTimeWarped || flags[actor]?.isBlocked) continue;

    const target = action.targetPlayerId;
    const targetPlayer = players[target];
    if (!targetPlayer) continue;

    // Revive them!
    players[target] = { ...targetPlayer, isAlive: true };
    
    // Remove from publicDeaths if they were killed tonight
    const deathIdx = publicDeaths.findIndex(d => d.playerId === target);
    if (deathIdx !== -1) {
      publicDeaths.splice(deathIdx, 1);
    }
  }
}

function applyInvestigations(
  actions: readonly NightActionBufferItem[],
  flags: Record<string, NightResolutionFlags>,
  players: Readonly<Record<string, PlayerSession>>,
  fraudBlurActive: boolean
): InvestigationResult[] {
  const results: InvestigationResult[] = [];

  for (const action of actions) {
    if (action.priority !== 6) continue;
    if (action.actionType !== 'INVESTIGATE') continue;
    if (flags[action.actorPlayerId]?.isBlocked) continue;

    const investigator = players[action.actorPlayerId];
    if (!investigator || !investigator.isAlive) continue;

    const effectiveTarget = resolveEffectiveTarget(action.targetPlayerId, flags);
    const target = players[effectiveTarget];
    if (!target) continue;

    const targetFlags = flags[effectiveTarget] as NightResolutionFlags;
    const hasInsiderAccess = hasTrait(investigator, 'INSIDER_ACCESS');

    // Determine revealed faction
    let revealedFaction: CoreFaction;
    if (hasInsiderAccess) {
      // INSIDER_ACCESS: bypass all masking
      revealedFaction = getFaction(target);
    } else if (targetFlags.factionMaskOverride !== null) {
      revealedFaction = targetFlags.factionMaskOverride;
    } else if (targetFlags.isFramed) {
      revealedFaction = 'MAFIA';
    } else {
      revealedFaction = getFaction(target);
    }

    // CIRCLE_8_FRAUD: blur 50/50
    const isBlurred = fraudBlurActive && Math.random() < 0.5;
    const alternateBlurredFaction: CoreFaction | null = isBlurred ? pickAlternateFaction(revealedFaction) : null;

    results.push({
      investigatorPlayerId: action.actorPlayerId,
      targetPlayerId: effectiveTarget,
      revealedFaction,
      isBlurred,
      alternateBlurredFaction,
    });
  }

  return results;
}

// ─── Heresy Clue Generator ────────────────────────────────────────────────────

function generateHeresyClue(
  players: Readonly<Record<string, PlayerSession>>,
  roundNumber: number
): string | null {
  const deadPlayers = Object.values(players).filter(p => !p.isAlive);
  if (deadPlayers.length === 0) return null;

  const chosen = deadPlayers[Math.floor(Math.random() * deadPlayers.length)]!;
  const faction = getFaction(chosen);
  return `A whisper from Limbo: ${chosen.username} walked among the ${faction}.`;
}

// ─── Main Resolver ────────────────────────────────────────────────────────────

export interface NightResolverInput {
  readonly lobby: LobbyState;
}

export function resolveNightActions(input: NightResolverInput): NightResolutionOutput {
  const { lobby } = input;
  const { bufferedNightActions, players, globalNightKillCap, roundNumber, minigameSubStates } = lobby;

  const danteState = minigameSubStates.dantesInferno;
  const fraudBlurActive = danteState?.fraudBlurActive ?? false;
  const heresyActive = danteState?.currentCircle === 'CIRCLE_6_HERESY';
  const violenceCleaningActive = danteState?.currentCircle === 'CIRCLE_7_VIOLENCE';

  const jitterMs = computeCryptoJitterMs(3, 7);

  // Build mutable flags per player
  let flags = buildInitialFlags(players);

  // Dante CIRCLE_2_LUST: 20% deflection on all targeted actions
  const deflectionRate = danteState?.deflectionRate ?? 0;
  let actions = bufferedNightActions;
  if (deflectionRate > 0) {
    const playerIds = Object.keys(players);
    actions = actions.map(a => {
      if (Math.random() < deflectionRate) {
        const adjacent = playerIds.filter(id => id !== a.targetPlayerId);
        const deflectTo = adjacent[Math.floor(Math.random() * adjacent.length)] ?? a.targetPlayerId;
        return { ...a, targetPlayerId: deflectTo };
      }
      return a;
    });
  }

  // P0: Time Warp
  applyTimeWarps(actions, flags, players);

  // P1: Block
  applyBlocks(actions, flags, players);

  // P2: Misdirect
  applyMisdirections(actions, flags, players);

  // P3: Protect
  applyProtections(actions, flags);

  // P4: Kill & Crossfire
  const killResult = applyKills(actions, flags, players, globalNightKillCap, danteState, roundNumber);
  flags = killResult.updatedFlags;
  const killedPlayers = killResult.updatedPlayers;
  const protectedIds = killResult.protectedIds;
  const publicDeaths: NightDeathRecord[] = killResult.deaths.map(d => ({
    ...d,
    isCleaned: violenceCleaningActive ? true : d.isCleaned,
  }));

  // P5: Frame
  applyFrames(actions, flags);

  // P6: Investigate
  const investigationResults = applyInvestigations(actions, flags, players, fraudBlurActive);

  // Heresy clue
  const heresyClue = heresyActive ? generateHeresyClue(players, roundNumber) : null;

  // Compile updated player map (combine alive status changes)
  const updatedPlayers: Record<string, PlayerSession> = { ...players };
  for (const [id, p] of Object.entries(killedPlayers)) {
    updatedPlayers[id] = p;
  }

  // ── Vest-depletion persistence fix ─────────────────────────────────────────
  // The flags struct is transient — it is rebuilt from PlayerSession each night.
  // Without persisting vest exhaustion into PlayerSession, every night restores
  // the BULLETPROOF_VEST / SURGICAL_RESILIENCE protection (game-stall bug).
  //
  // When vestChargesRemaining hits 0 in the final flags, we overwrite the
  // player's layer3Trait with a neutral trait ('CONTRABAND_POCKET') so that
  // next night buildInitialFlags() assigns vestChargesRemaining = 0 for them.
  const vestSpentPlayerIds: string[] = [];
  for (const [id, f] of Object.entries(flags)) {
    const player = updatedPlayers[id];
    if (!player || !player.isAlive) continue;
    if (!player.allInIdentity) continue;
    const hadVest =
      player.allInIdentity.layer3Trait === 'BULLETPROOF_VEST' ||
      player.allInIdentity.layer3Trait === 'SURGICAL_RESILIENCE';
    if (hadVest && f.vestChargesRemaining === 0) {
      vestSpentPlayerIds.push(id);
      updatedPlayers[id] = {
        ...player,
        allInIdentity: {
          ...player.allInIdentity,
          // Swap to a neutral trait with no defensive passive effect
          layer3Trait: 'CONTRABAND_POCKET',
        },
      };
    }
  }

  const newspaper: MorningNewspaper = {
    publicDeaths,
    privateInvestigationResults: investigationResults,
    heresyClue,
    jitterAppliedMs: jitterMs,
  };

  return {
    newspaper,
    updatedPlayers,
    killCount: publicDeaths.filter(d => d.cause !== 'RETALIATION_FUSE_COUNTER').length,
    vestSpentPlayerIds,
    mutinyActive: killResult.mutinyActive,
    mutineerIds: killResult.mutineerIds,
  };
}

