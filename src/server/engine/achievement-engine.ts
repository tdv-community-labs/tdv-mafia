/**
 * Advanced Achievement Engine (Milestone 9)
 *
 * Evaluates in-game achievement triggers across all 5 milestones:
 * - M1: Bodyguard noble sacrifice, Iron Will armor shatter, Phantom Step bypass, Night Vision intel.
 * - M2: Mayor 3x triple hammer, Accused flawless trial defense acquittal.
 * - M3: Stanford Prison 100% revolt, Chernobyl radiation decontamination.
 * - M7: Dead Chat graveyard transition (Spirit Realm).
 * - M8: WebRTC voice chat active orator.
 * - Win Conditions: Flawless Town, Clean Sweep Mafia, Yakuza Clan, Void Cult, All-In Grand Finish.
 */

import { LobbyState, PlayerSession } from '../../types/game';
import { WinConditionResult, NightDeathRecord } from '../../types/engine';

/**
 * Pure utility to merge newly unlocked achievements into an existing record,
 * enforcing strict set deduplication per user.
 */
export function mergeUnlockedAchievements(
  existing: Readonly<Record<string, readonly string[]>> | Readonly<Record<string, string[]>> | undefined,
  newUnlocks: Readonly<Record<string, readonly string[]>> | Record<string, string[]>
): Record<string, string[]> {
  const merged: Record<string, string[]> = {};

  // Copy existing
  if (existing) {
    for (const [userId, ids] of Object.entries(existing)) {
      merged[userId] = [...ids];
    }
  }

  // Merge new
  for (const [userId, ids] of Object.entries(newUnlocks)) {
    const currentList = merged[userId] || [];
    const set = new Set(currentList);
    for (const id of ids) {
      set.add(id);
    }
    merged[userId] = Array.from(set);
  }

  return merged;
}

/**
 * Evaluates achievements triggered by night phase action resolutions (M1).
 */
export function evaluateNightAchievements(
  lobby: LobbyState,
  nightResult: {
    deaths?: readonly NightDeathRecord[];
    protectedIds?: readonly string[];
    armorBrokenPlayerIds?: readonly string[];
    updatedFlags?: Record<string, any>;
    achievementsJustUnlocked?: Readonly<Record<string, readonly string[]>> | Record<string, string[]>;
  }
): Record<string, string[]> {
  const unlocks: Record<string, string[]> = {};

  const award = (userId: string, achievementId: string) => {
    if (!userId) return;
    if (!unlocks[userId]) unlocks[userId] = [];
    if (!unlocks[userId].includes(achievementId)) {
      unlocks[userId].push(achievementId);
    }
  };

  // 1. Inherit any achievements already marked by night resolver (e.g. bodyguard noble sacrifice)
  if (nightResult.achievementsJustUnlocked) {
    for (const [userId, ids] of Object.entries(nightResult.achievementsJustUnlocked)) {
      for (const id of ids) award(userId, id);
    }
  }

  // 2. Iron Will Resilience: survived lethal hit with armor shatter
  for (const victimId of nightResult.armorBrokenPlayerIds || []) {
    award(victimId, 'trait_iron_will_resilience');
  }

  // 3. Phantom Step Bypass: Player carried PHANTOM_STEP during blocked night actions
  for (const action of lobby.bufferedNightActions) {
    const actor = lobby.players[action.actorPlayerId];
    if (actor && actor.allInIdentity?.layer3Trait === 'PHANTOM_STEP') {
      award(actor.userId, 'trait_phantom_step_bypass');
    }
  }

  // 4. Night Vision Intel: Player carried NIGHT_VISION and acted
  for (const action of lobby.bufferedNightActions) {
    const actor = lobby.players[action.actorPlayerId];
    if (actor && actor.allInIdentity?.layer3Trait === 'NIGHT_VISION') {
      award(actor.userId, 'trait_night_vision_intel');
    }
  }

  // 5. Doctor Miracle Save: Protected player was actively targeted by a KILL action
  const killTargets = lobby.bufferedNightActions
    .filter(a => a.actionType === 'KILL')
    .map(a => a.targetPlayerId);

  const protectActions = lobby.bufferedNightActions.filter(a => a.actionType === 'PROTECT');
  for (const pAction of protectActions) {
    if (killTargets.includes(pAction.targetPlayerId)) {
      award(pAction.actorPlayerId, 'town_doctor_miracle_save');
    }
  }

  // 6. Sheriff First Bust: Sheriff investigated and caught a Mafia member on Round 1
  if (lobby.roundNumber <= 1) {
    const investActions = lobby.bufferedNightActions.filter(a => a.actionType === 'INVESTIGATE');
    for (const iAction of investActions) {
      const target = lobby.players[iAction.targetPlayerId];
      if (
        target &&
        (target.allInIdentity?.layer1Faction === 'MAFIA' ||
          target.displayRole.originalRoleName?.toLowerCase().includes('mafia'))
      ) {
        award(iAction.actorPlayerId, 'town_sheriff_first_bust');
      }
    }
  }

  return unlocks;
}

/**
 * Evaluates achievements triggered during courtroom voting and trial defense (M2).
 */
export function evaluateCourtAchievements(
  lobby: LobbyState,
  verdictResult: {
    outcome: 'LYNCHED' | 'NO_LYNCH' | 'TRIAL_DEFENSE' | 'TIE';
    lynchedPlayerId?: string | null;
    accusedPlayerId?: string | null;
    guiltyCount?: number;
    innocentCount?: number;
    achievementsJustUnlocked?: Record<string, string[]>;
  }
): Record<string, string[]> {
  const unlocks: Record<string, string[]> = {};

  const award = (userId: string, achievementId: string) => {
    if (!userId) return;
    if (!unlocks[userId]) unlocks[userId] = [];
    if (!unlocks[userId].includes(achievementId)) {
      unlocks[userId].push(achievementId);
    }
  };

  // 1. Inherit existing unlocks from verdictResult
  if (verdictResult.achievementsJustUnlocked) {
    for (const [userId, ids] of Object.entries(verdictResult.achievementsJustUnlocked)) {
      for (const id of ids) award(userId, id);
    }
  }

  // 2. Accused Acquittal / Flawless Defense Speech: Accused survived TRIAL_DEFENSE with acquittal
  if (verdictResult.accusedPlayerId && verdictResult.outcome === 'NO_LYNCH') {
    if ((verdictResult.innocentCount ?? 0) >= (verdictResult.guiltyCount ?? 0)) {
      award(verdictResult.accusedPlayerId, 'mastery_flawless_defense_speech');
    }
  }

  // 3. Mayor Triple Hammer: Mayor revealed and lynched an accused player
  if (verdictResult.outcome === 'LYNCHED' && verdictResult.lynchedPlayerId) {
    const revealedMayors = lobby.mayorRevealedUserIds || [];
    for (const mayorId of revealedMayors) {
      if (lobby.trialVerdictVotes?.[mayorId] === 'GUILTY') {
        award(mayorId, 'town_mayor_triple_hammer');
      }
    }
  }

  return unlocks;
}

/**
 * Evaluates achievements triggered by minigame substate events (M3).
 */
export function evaluateMinigameAchievements(lobby: LobbyState): Record<string, string[]> {
  const unlocks: Record<string, string[]> = {};

  const award = (userId: string, achievementId: string) => {
    if (!userId) return;
    if (!unlocks[userId]) unlocks[userId] = [];
    if (!unlocks[userId].includes(achievementId)) {
      unlocks[userId].push(achievementId);
    }
  };

  // 1. Stanford Prison 100% Revolt
  const stanford = lobby.minigameSubStates?.stanfordPrison;
  if (stanford && stanford.revoltMeter >= 100) {
    for (const [pId, p] of Object.entries(lobby.players)) {
      if (p.isAlive && p.allInIdentity?.layer1Faction === 'TOWN') {
        award(pId, 'mode_stanford_revolt_maximum');
      }
    }
  }

  // 2. Chernobyl Exclusion Zone: Decontamination shelter
  const chernobyl = lobby.minigameSubStates?.chernobyl;
  if (chernobyl && chernobyl.shelteredPlayerIds) {
    for (const shelteredId of chernobyl.shelteredPlayerIds) {
      award(shelteredId, 'mode_chernobyl_decontamination');
    }
  }

  return unlocks;
}

/**
 * Evaluates achievements awarded at the conclusion of a match (M1-M10).
 */
export function evaluateGameEndAchievements(
  lobby: LobbyState,
  winResult: WinConditionResult
): Record<string, string[]> {
  const unlocks: Record<string, string[]> = {};

  const award = (userId: string, achievementId: string) => {
    if (!userId) return;
    if (!unlocks[userId]) unlocks[userId] = [];
    if (!unlocks[userId].includes(achievementId)) {
      unlocks[userId].push(achievementId);
    }
  };

  const players = Object.values(lobby.players);

  // 1. Town Victory
  if (winResult.winningFaction === 'TOWN') {
    const deadTownCount = players.filter(
      p => !p.isAlive && p.allInIdentity?.layer1Faction === 'TOWN'
    ).length;
    for (const p of players) {
      if (p.allInIdentity?.layer1Faction === 'TOWN') {
        if (deadTownCount === 0) {
          award(p.userId, 'town_flawless_victory');
        }
      }
    }
  }

  // 2. Mafia Clean Sweep
  if (winResult.winningFaction === 'MAFIA') {
    const deadMafiaCount = players.filter(
      p => !p.isAlive && p.allInIdentity?.layer1Faction === 'MAFIA'
    ).length;
    for (const p of players) {
      if (p.allInIdentity?.layer1Faction === 'MAFIA') {
        if (deadMafiaCount === 0) {
          award(p.userId, 'mafia_clean_sweep');
        }
      }
    }
  }

  // 3. Yakuza Clan Victory
  if (winResult.winningFaction === 'YAKUZA') {
    for (const p of players) {
      if (p.allInIdentity?.layer1Faction === 'YAKUZA') {
        award(p.userId, 'neutral_yakuza_clan_victory');
      }
    }
  }

  // 4. Void Cult Ritual Victory
  if (winResult.winningFaction === 'VOID_CULT') {
    for (const p of players) {
      if (p.allInIdentity?.layer1Faction === 'VOID_CULT') {
        award(p.userId, 'neutral_void_cult_ritual');
      }
    }
  }

  // 5. All-In Grand Finish
  if (lobby.mode === 'ALL_IN') {
    for (const p of players) {
      if (p.isAlive) {
        award(p.userId, 'mode_all_in_grand_finish');
      }
    }
  }

  return unlocks;
}

/**
 * Explicitly records an individual achievement for a player and registers it in lobby state.
 */
export function recordPlayerAchievement(
  lobby: LobbyState,
  userId: string,
  achievementId: string
): LobbyState {
  const player = lobby.players[userId];
  if (!player) return lobby;

  const currentUnlocked = player.achievements || [];
  if (currentUnlocked.includes(achievementId)) {
    return lobby; // Already unlocked
  }

  const updatedPlayer: PlayerSession = {
    ...player,
    achievements: [...currentUnlocked, achievementId],
  };

  const newUnlocksForUser = [
    ...(lobby.achievementsJustUnlocked?.[userId] || []),
    achievementId,
  ];

  return {
    ...lobby,
    players: {
      ...lobby.players,
      [userId]: updatedPlayer,
    },
    achievementsJustUnlocked: {
      ...(lobby.achievementsJustUnlocked || {}),
      [userId]: newUnlocksForUser,
    },
  };
}
