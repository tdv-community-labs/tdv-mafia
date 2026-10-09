/**
 * Asymmetric Minigames Engine — Dedicated Lifecycle Managers
 *
 * Provides phase-event processors for all 5 minigames:
 *   1. Dante's Inferno  — 9-circle Day/Night bifurcated descent
 *   2. The Day the Earth Stood Still — Doomsday clock, Klaatu freeze, Gort wipe
 *   3. Operation Valkyrie — Briefcase hot-potato, fuse countdown, blast
 *   4. Stanford Prison  — Revolt meter, guard sanctions, secret assassin strike
 *   5. Catenaccio       — Defensive wall armor tokens vs. solo Sniper pierce
 *
 * Terminology note: All user-facing text uses inclusive labels.
 *   Block roles → "Disrupter". Deception roles → "Gözbağlayıcı / Illusionist".
 *
 * Enterprise Mafia / Social Deduction Platform - Phase 3
 */

import {
  CatenaccioState,
  DanteCircle,
  DantesInfernoState,
  EarthStoodStillState,
  HeresyLeakedClue,
  MinigameSubStates,
  StanfordPrisonState,
  ValkyrieState,
} from '../../types/minigames';
import { GamePhase, LobbyState, NightActionBufferItem, NightActionPriority, PlayerSession } from '../../types/game';
import { CoreFaction, AllInDistrict } from '../../types/roles';
import { NightDeathRecord } from '../../types/engine';
import { DANTE_CIRCLES_ORDER, DANTE_CIRCLE_DEFINITIONS } from '../../config/minigames.config';
import { inMemoryLobbyStore } from '../state/memory';

// ─── Shared Helpers ────────────────────────────────────────────────────────────

function getAlivePlayers(players: Readonly<Record<string, PlayerSession>>): PlayerSession[] {
  return Object.values(players).filter(p => p.isAlive);
}

function getPlayerFaction(p: PlayerSession): CoreFaction {
  return p.allInIdentity?.layer1Faction ?? 'TOWN';
}

/** Deterministically pick a random player ID from a list (non-empty guard included) */
function pickRandom(ids: readonly string[]): string | null {
  if (ids.length === 0) return null;
  return ids[Math.floor(Math.random() * ids.length)] ?? null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. DANTE'S INFERNO ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface DantesInfernoEngineInput {
  readonly currentState: DantesInfernoState;
  readonly phase: GamePhase;
  readonly roundNumber: number;
  readonly publicDeaths: readonly NightDeathRecord[];
  readonly players: Readonly<Record<string, PlayerSession>>;
  /** Greed: player IDs who used a night ability this cycle */
  readonly greedAbilityUsers: readonly string[];
  /** Treachery: player ID that was lynched (for Jester / Lucifer's Shadow check) */
  readonly lynchedPlayerId: string | null;
}

export interface DantesInfernoEngineOutput {
  readonly updatedState: DantesInfernoState;
  /** New circle entered this transition (null if same circle) */
  readonly newCircleEntered: DanteCircle | null;
  /** Heresy: clue text to broadcast publicly */
  readonly heresyBroadcastClue: HeresyLeakedClue | null;
  /** Circle rule description for the new circle (for UI banner) */
  readonly circleRuleDescription: string | null;
  /** Jester victory triggered this round? */
  readonly jesterVictoryTriggered: boolean;
  readonly luciferShadowWinnerUserId: string | null;
}

/**
 * Advance the Dante's Inferno circle state.
 *
 * Circle progression is bifurcated by Day/Night:
 *   Day  circles: 1 (Limbo), 3 (Gluttony), 5 (Wrath), 7 (Violence), 9 (Treachery)
 *   Night circles: 2 (Lust), 4 (Greed), 6 (Heresy), 8 (Fraud)
 *
 * Each phase transition advances to the next circle in the canonical sequence.
 */
export function advanceDantesInfernoCircle(input: DantesInfernoEngineInput): DantesInfernoEngineOutput {
  const { currentState, phase, roundNumber, publicDeaths, players, greedAbilityUsers, lynchedPlayerId } = input;

  const currentConfig = DANTE_CIRCLE_DEFINITIONS[currentState.currentCircle];
  const isNightPhase = phase === 'NIGHT_BUFFER';
  const isDayPhase = !isNightPhase && phase !== 'LOBBY' && phase !== 'ENDED';

  // Only advance across the Day <-> Night boundary:
  // e.g. currently in DAY circle and entering NIGHT, or currently in NIGHT circle and entering DAY
  const shouldAdvance =
    (currentConfig.activePhaseType === 'DAY' && isNightPhase) ||
    (currentConfig.activePhaseType === 'NIGHT' && isDayPhase);

  const currentIndex = DANTE_CIRCLES_ORDER.indexOf(currentState.currentCircle);
  const nextIndex = shouldAdvance ? currentIndex + 1 : currentIndex;
  const nextCircle: DanteCircle | null =
    nextIndex < DANTE_CIRCLES_ORDER.length ? (DANTE_CIRCLES_ORDER[nextIndex] ?? null) : null;

  // If no next circle, game has traversed all 9 — remain at Treachery
  const activeCircle: DanteCircle = nextCircle ?? currentState.currentCircle;
  const isNewCircle = activeCircle !== currentState.currentCircle;

  const circleConfig = DANTE_CIRCLE_DEFINITIONS[activeCircle];

  // Track greed debts (players who used abilities owe their next vote)
  // When entering Night after Day voting, fulfilled debts from the previous round are cleared
  let updatedGreedDebts: Record<string, boolean> = { ...currentState.greedVoteCostDebts };
  if (isNightPhase && currentState.currentCircle !== 'CIRCLE_4_GREED') {
    updatedGreedDebts = {};
  }
  for (const userId of greedAbilityUsers) {
    updatedGreedDebts[userId] = true;
  }

  // HERESY clue generation (Circle 6, Night phase)
  let heresyBroadcastClue: HeresyLeakedClue | null = null;
  const updatedHeresyClues = [...currentState.heresyLeakedClues];
  if (activeCircle === 'CIRCLE_6_HERESY' && phase === 'NIGHT_BUFFER') {
    const deadPlayers = Object.values(players).filter(p => !p.isAlive);
    if (deadPlayers.length > 0) {
      const chosen = deadPlayers[Math.floor(Math.random() * deadPlayers.length)]!;
      const faction = getPlayerFaction(chosen);
      const newClue: HeresyLeakedClue = {
        clueId:        `heresy-${roundNumber}-${chosen.userId}`,
        deadPlayerId:  chosen.userId,
        clueText:      `A cryptic scroll materialises: "${chosen.username}" belonged to the ${faction}.`,
        leakedAtRound: roundNumber,
      };
      updatedHeresyClues.push(newClue);
      heresyBroadcastClue = newClue;
    }
  }

  // VIOLENCE cleaned victim list (Circle 7 — add all deaths this round)
  const updatedViolenceCleaned = [
    ...currentState.violenceCleanedVictimIds,
    ...(activeCircle === 'CIRCLE_7_VIOLENCE' ? publicDeaths.map(d => d.victimPlayerId) : []),
  ];

  // TREACHERY: Jester / Lucifer's Shadow victory check (Circle 9)
  let jesterVictoryTriggered = false;
  let luciferShadowWinnerUserId: string | null = currentState.luciferShadowWinnerUserId;
  if (
    activeCircle === 'CIRCLE_9_TREACHERY' &&
    currentState.jesterLuciferShadowActive &&
    lynchedPlayerId
  ) {
    const lynchedPlayer = players[lynchedPlayerId];
    if (lynchedPlayer) {
      const faction = getPlayerFaction(lynchedPlayer);
      // Jester / Lucifer's Shadow is modeled as NEUTRAL_EVIL
      if (faction === 'NEUTRAL_EVIL') {
        jesterVictoryTriggered = true;
        luciferShadowWinnerUserId = lynchedPlayerId;
      }
    }
  }

  const updatedState: DantesInfernoState = {
    currentCircle:            activeCircle,
    completedCircles:         isNewCircle
                                ? [...currentState.completedCircles, currentState.currentCircle]
                                : currentState.completedCircles,
    deflectionRate:           activeCircle === 'CIRCLE_2_LUST' ? 0.2 : 0,
    slowModeCharLimit:        activeCircle === 'CIRCLE_3_GLUTTONY' ? 80 : 280,
    greedVoteCostDebts:       updatedGreedDebts,
    wrathNoAbstainEnforced:   activeCircle === 'CIRCLE_5_WRATH',
    heresyLeakedClues:        updatedHeresyClues,
    violenceCleanedVictimIds: updatedViolenceCleaned,
    fraudBlurActive:          activeCircle === 'CIRCLE_8_FRAUD',
    treacherySecretVotingActive: activeCircle === 'CIRCLE_9_TREACHERY',
    jesterLuciferShadowActive: activeCircle === 'CIRCLE_9_TREACHERY',
    luciferShadowWinnerUserId,
  };

  return {
    updatedState,
    newCircleEntered:          isNewCircle ? activeCircle : null,
    heresyBroadcastClue,
    circleRuleDescription:     isNewCircle ? circleConfig.ruleDescription : null,
    jesterVictoryTriggered,
    luciferShadowWinnerUserId,
  };
}

/**
 * Enforce Greed vote-debt deduction:
 * Players in greedVoteCostDebts lose their vote for this round's DAY_VOTING phase.
 * Returns the set of ineligible voter IDs.
 */
export function resolveGreedVoteDebts(state: DantesInfernoState): readonly string[] {
  return Object.entries(state.greedVoteCostDebts)
    .filter(([, owed]) => owed)
    .map(([id]) => id);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. THE DAY THE EARTH STOOD STILL ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DOOMSDAY_WIPE_THRESHOLD = 12;

export interface EarthStoodStillEngineInput {
  readonly currentState: EarthStoodStillState;
  /** IDs of Town-aligned players lynched without confirmed guilt this round */
  readonly innocentsLynchedThisRound: readonly string[];
  /** True if Klaatu's player submitted the world-freeze ability this night */
  readonly klaatuFreezeActivated: boolean;
  /** Optional: Gort selects a vaporisation target (set by host/game engine) */
  readonly gortVapourisationTargetId: string | null;
}

export interface EarthStoodStillEngineOutput {
  readonly updatedState: EarthStoodStillState;
  /** True when the doomsday clock reaches 12 and triggers the planetary wipe */
  readonly planetaryWipeTriggered: boolean;
  /** IDs of all players eliminated by the planetary wipe (everyone alive) */
  readonly wipeVictimIds: readonly string[];
  readonly worldFreezeApplied: boolean;
}

/**
 * Tick the Doomsday Clock and handle Klaatu freeze / Gort vaporisation.
 *
 * Clock advances:
 *   +1 for each unjustified innocent lynched (no confirmed guilty result).
 *   At 12: Gort triggers planetary wipe — all players are eliminated simultaneously.
 *
 * Klaatu's single-use world freeze suspends ALL night kills for one cycle.
 */
export function tickEarthStoodStill(
  input: EarthStoodStillEngineInput,
  players: Readonly<Record<string, PlayerSession>>
): EarthStoodStillEngineOutput {
  const { currentState, innocentsLynchedThisRound, klaatuFreezeActivated, gortVapourisationTargetId } = input;

  const clockAdvance = innocentsLynchedThisRound.length;
  const newClockHours = Math.min(currentState.doomsdayClockHours + clockAdvance, DOOMSDAY_WIPE_THRESHOLD);

  const shouldWipe = newClockHours >= DOOMSDAY_WIPE_THRESHOLD && !currentState.planetaryWipeTriggered;
  const wipeVictimIds: string[] = shouldWipe ? getAlivePlayers(players).map(p => p.userId) : [];

  // Klaatu freeze: single-use, locks out night kills for 1 cycle
  const freezeApplicable = klaatuFreezeActivated && !currentState.worldFrozenUsed;

  const updatedState: EarthStoodStillState = {
    doomsdayClockHours:    newClockHours,
    planetaryWipeTriggered: shouldWipe,
    worldFrozenActive:     freezeApplicable,
    worldFrozenUsed:       currentState.worldFrozenUsed || freezeApplicable,
    klaatuPlayerId:        currentState.klaatuPlayerId,
    gortTargetPlayerId:    gortVapourisationTargetId ?? currentState.gortTargetPlayerId,
  };

  return {
    updatedState,
    planetaryWipeTriggered: shouldWipe,
    wipeVictimIds,
    worldFreezeApplied: freezeApplicable,
  };
}

/**
 * Enforce the world freeze: if worldFrozenActive is true, strip all KILL
 * actions from the night action buffer for this cycle.
 * Returns the filtered buffer.
 */
export function applyWorldFreeze(
  bufferedActions: readonly NightActionBufferItem[],
  state: EarthStoodStillState
): readonly NightActionBufferItem[] {
  if (!state.worldFrozenActive) return bufferedActions;
  return bufferedActions.filter(a => a.actionType !== 'KILL');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. OPERATION VALKYRIE ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ValkyrieEngineInput {
  readonly currentState: ValkyrieState;
  /** Player ID the current briefcase holder passes the briefcase to (null = no pass this round) */
  readonly briefcasePassTargetId: string | null;
  /** Is the current phase a Day phase? (briefcase can only be passed during Day) */
  readonly isDayPhase: boolean;
}

export interface ValkyrieEngineOutput {
  readonly updatedState: ValkyrieState;
  /** True when the briefcase detonated this round */
  readonly detonated: boolean;
  /** ID of the player eliminated by detonation (Dictator if targeted, or holder) */
  readonly detonationVictimId: string | null;
  /** New fuse days remaining (for UI countdown) */
  readonly fuseTimerDaysRemaining: number;
}

/**
 * Hot-Potato Briefcase Transfer:
 *   - Briefcase can only be transferred during Day phases.
 *   - Each Day that passes decrements the fuse timer.
 *   - At 0 days remaining: briefcase detonates.
 *
 * Blast resolution:
 *   - If the holder is a conspirator AND the Dictator is in the same lobby room
 *     (phase = DAY_CENTRAL_ASSEMBLY): Dictator is assassinated.
 *   - Otherwise: the current holder is eliminated by the blast.
 */
export function processValkyrieRound(
  input: ValkyrieEngineInput,
  players?: Readonly<Record<string, PlayerSession>>
): ValkyrieEngineOutput {
  const { currentState, briefcasePassTargetId, isDayPhase } = input;

  if (currentState.briefcaseDetonated || currentState.dictatorAssassinated) {
    // Already resolved — idempotent return
    return {
      updatedState:            currentState,
      detonated:               currentState.briefcaseDetonated,
      detonationVictimId:      null,
      fuseTimerDaysRemaining:  currentState.fuseTimerDaysRemaining,
    };
  }

  // Transfer briefcase if valid pass submitted during Day to an alive player
  let newHolderId = currentState.briefcaseLocationPlayerId;
  if (isDayPhase && briefcasePassTargetId) {
    const isTargetAlive = players ? (players[briefcasePassTargetId]?.isAlive ?? true) : true;
    const isValidTransfer =
      isTargetAlive &&
      (currentState.conspiratorPlayerIds.includes(briefcasePassTargetId) ||
       briefcasePassTargetId === currentState.dictatorPlayerId); // forced hand-off
    if (isValidTransfer) {
      newHolderId = briefcasePassTargetId;
    }
  }

  // If current holder died, automatically transfer briefcase to the first alive conspirator
  if (players && newHolderId && !players[newHolderId]?.isAlive) {
    const aliveConspirators = currentState.conspiratorPlayerIds.filter(id => players[id]?.isAlive);
    newHolderId = aliveConspirators[0] ?? null;
  }

  // Decrement fuse on Day phase ticks
  const newFuse = isDayPhase
    ? Math.max(0, currentState.fuseTimerDaysRemaining - 1)
    : currentState.fuseTimerDaysRemaining;

  const detonates = newFuse === 0;

  let victimId: string | null = null;
  let dictatorAssassinated: boolean = currentState.dictatorAssassinated;

  if (detonates && newHolderId) {
    // Conspirator holds it near Dictator → successful assassination
    const holderIsConspirator = currentState.conspiratorPlayerIds.includes(newHolderId);
    if (holderIsConspirator) {
      victimId = currentState.dictatorPlayerId; // Dictator eliminated
      dictatorAssassinated = true;
    } else {
      // Briefcase holder takes the blast
      victimId = newHolderId;
    }
  }

  const updatedState: ValkyrieState = {
    briefcaseLocationPlayerId: detonates ? null : newHolderId,
    fuseTimerDaysRemaining:    newFuse,
    dictatorPlayerId:          currentState.dictatorPlayerId,
    conspiratorPlayerIds:      currentState.conspiratorPlayerIds,
    briefcaseDetonated:        detonates,
    dictatorAssassinated,
  };

  return {
    updatedState,
    detonated:              detonates,
    detonationVictimId:     victimId,
    fuseTimerDaysRemaining: newFuse,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. STANFORD PRISON ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const REVOLT_THRESHOLD = 100;
const REVOLT_METER_SANCTION_INCREASE  = 15;  // Each Guard sanction
const REVOLT_METER_APPEASEMENT_REDUCE = 10;  // Each Warden appeasement
const REVOLT_METER_LYNCH_INCREASE     = 20;  // Unjust inmate lynch
const REVOLT_METER_SOLITARY_REDUCE    = 5;   // Inmate placed in solitary

export interface StanfordPrisonEngineInput {
  readonly currentState: StanfordPrisonState;
  /** IDs of guards who issued sanctions this round */
  readonly guardSanctionIds: readonly string[];
  /** IDs of inmates the Warden appeased this round */
  readonly wardenAppeasedInmateIds: readonly string[];
  /** IDs of inmates unjustly lynched this round */
  readonly inmatesLynchedIds: readonly string[];
  /** IDs of inmates placed into solitary this round */
  readonly inmatesPlacedInSolitary: readonly string[];
  /** Did the secret assassin attempt a strike this night? */
  readonly secretAssassinStrike: boolean;
  /** Target of the assassin strike (null if no strike) */
  readonly assassinStrikeTargetId: string | null;
}

export interface StanfordPrisonEngineOutput {
  readonly updatedState: StanfordPrisonState;
  /** True when revolt meter reaches 100 */
  readonly riotTriggered: boolean;
  /** If secret assassin strike succeeds, the eliminated guard ID */
  readonly assassinatedGuardId: string | null;
  readonly currentRevoltMeter: number;
}

/**
 * Track the Stanford Prison revolt meter.
 *
 * Meter increases:
 *   +15 per Guard sanction (heavy-handed control)
 *   +20 per unjust inmate lynch
 *
 * Meter decreases:
 *   -10 per Warden appeasement action
 *   -5 per inmate placed in solitary (reduces active agitators)
 *
 * At 100: RIOT_TRIGGERED — all guards eliminated, warden loses authority.
 * Secret assassin: if the hidden assassin inmate strikes, a random non-Warden guard is eliminated.
 */
export function processStanfordPrisonRound(input: StanfordPrisonEngineInput): StanfordPrisonEngineOutput {
  const {
    currentState,
    guardSanctionIds,
    wardenAppeasedInmateIds,
    inmatesLynchedIds,
    inmatesPlacedInSolitary,
    secretAssassinStrike,
    assassinStrikeTargetId,
  } = input;

  // Compute meter delta
  const increaseFromSanctions   = guardSanctionIds.length   * REVOLT_METER_SANCTION_INCREASE;
  const increaseFromLynches     = inmatesLynchedIds.length   * REVOLT_METER_LYNCH_INCREASE;
  const decreaseFromAppeasement = wardenAppeasedInmateIds.length * REVOLT_METER_APPEASEMENT_REDUCE;
  const decreaseFromSolitary    = inmatesPlacedInSolitary.length * REVOLT_METER_SOLITARY_REDUCE;

  const newMeter = Math.min(
    REVOLT_THRESHOLD,
    Math.max(0, currentState.revoltMeter + increaseFromSanctions + increaseFromLynches - decreaseFromAppeasement - decreaseFromSolitary)
  );

  const riotTriggered = newMeter >= REVOLT_THRESHOLD && !currentState.riotTriggered;

  // Secret assassin strike resolution
  let assassinatedGuardId: string | null = null;
  let updatedGuardIds = [...currentState.guardPlayerIds];

  if (secretAssassinStrike && currentState.secretAssassinInmateId) {
    // Validate target is a non-Warden guard
    const validTarget =
      assassinStrikeTargetId &&
      currentState.guardPlayerIds.includes(assassinStrikeTargetId) &&
      assassinStrikeTargetId !== currentState.wardenPlayerId;

    if (validTarget && assassinStrikeTargetId) {
      assassinatedGuardId = assassinStrikeTargetId;
      updatedGuardIds = updatedGuardIds.filter(id => id !== assassinStrikeTargetId);
    } else {
      // Missed or no target — pick a random eligible guard
      const eligibleGuards = currentState.guardPlayerIds.filter(
        id => id !== currentState.wardenPlayerId
      );
      const randomTarget = pickRandom(eligibleGuards);
      if (randomTarget) {
        assassinatedGuardId = randomTarget;
        updatedGuardIds = updatedGuardIds.filter(id => id !== randomTarget);
      }
    }
  }

  // Update solitary list (add new, remove if lynched)
  const newSolitary = [
    ...currentState.solitaryConfinementPlayerIds.filter(id => !inmatesLynchedIds.includes(id)),
    ...inmatesPlacedInSolitary.filter(id => !currentState.solitaryConfinementPlayerIds.includes(id)),
  ];

  const updatedState: StanfordPrisonState = {
    guardPlayerIds:               updatedGuardIds,
    inmatePlayerIds:              currentState.inmatePlayerIds.filter(id => !inmatesLynchedIds.includes(id)),
    revoltMeter:                  newMeter,
    wardenPlayerId:               currentState.wardenPlayerId,
    secretAssassinInmateId:       currentState.secretAssassinInmateId,
    solitaryConfinementPlayerIds: newSolitary,
    riotTriggered:                riotTriggered || currentState.riotTriggered,
  };

  return {
    updatedState,
    riotTriggered,
    assassinatedGuardId,
    currentRevoltMeter: newMeter,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. CATENACCIO ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CatenaccioEngineInput {
  readonly currentState: CatenaccioState;
  /** Target player ID of the Sniper's shot (null if no shot this round) */
  readonly sniperShotTargetId: string | null;
  /** IDs of players attacking the wall this round (standard attacks) */
  readonly wallAttackerIds: readonly string[];
}

export interface CatenaccioEngineOutput {
  readonly updatedState: CatenaccioState;
  /** Player ID eliminated by the Sniper's piercing shot (null if blocked) */
  readonly sniperVictimId: string | null;
  /** IDs of wall players whose armor was depleted this round */
  readonly armorDepletedPlayerIds: readonly string[];
  /** True when the wall's collective armor has fully collapsed */
  readonly wallBreached: boolean;
}

/**
 * Defensive Wall vs. Solo Sniper:
 *
 * Standard attacks: absorbed by wall armor tokens (1 charge per attack).
 * Sniper pierce: bypasses wall entirely — hits target directly if on a wall player,
 *   or the specific target if off-wall.
 *   Exception: a wall player with > 0 armor charges absorbs the sniper shot IF
 *   the sniper is NOT using SILENCER_ATTACHMENT (modeled by sniperPierces=true flag).
 *
 * Wall breach: triggered when ALL wall players reach 0 armor charges.
 */
export function processCatenaccioRound(input: CatenaccioEngineInput): CatenaccioEngineOutput {
  const { currentState, sniperShotTargetId, wallAttackerIds } = input;

  const updatedCharges: Record<string, number> = { ...currentState.armorCharges };
  const depletedIds: string[] = [];

  // Standard attacks hit the wall's collective armor
  for (const attackerId of wallAttackerIds) {
    // Each attack reduces a random wall player's armor by 1
    const wallWithCharges = currentState.defensiveWallPlayerIds.filter(
      id => (updatedCharges[id] ?? 0) > 0
    );
    const absorbingWallId = pickRandom(wallWithCharges);
    if (absorbingWallId) {
      const prev = updatedCharges[absorbingWallId] ?? 0;
      updatedCharges[absorbingWallId] = Math.max(0, prev - 1);
      if (updatedCharges[absorbingWallId] === 0) {
        depletedIds.push(absorbingWallId);
      }
    }
    // If no wall member has charges left, attack passes through (wall already breached)
  }

  // Sniper piercing shot: bypasses armor on wall members
  let sniperVictimId: string | null = null;
  if (sniperShotTargetId && currentState.sniperPlayerId) {
    // Sniper shot pierces — target is eliminated regardless of armor
    // Exception: if target is not in the wall, standard kill
    // The Sniper's piercing nature means armor does NOT absorb this shot
    sniperVictimId = sniperShotTargetId;
  }

  // Wall breach check: all wall players at 0 charges
  const allDepleted = currentState.defensiveWallPlayerIds.every(
    id => (updatedCharges[id] ?? 0) === 0
  );
  const wallBreached: boolean = allDepleted && currentState.defensiveWallPlayerIds.length > 0;

  const updatedState: CatenaccioState = {
    defensiveWallPlayerIds: currentState.defensiveWallPlayerIds,
    sniperPlayerId:         currentState.sniperPlayerId,
    armorCharges:           updatedCharges,
    wallBreached:           wallBreached || currentState.wallBreached,
  };

  return {
    updatedState,
    sniperVictimId,
    armorDepletedPlayerIds: depletedIds,
    wallBreached,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MINIGAME DISPATCH ROUTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MinigamePhaseEventInput {
  readonly lobbyId: string;
  // Dante inputs
  readonly danteGreedAbilityUsers: readonly string[];
  readonly danteLynchedPlayerId: string | null;
  // Earth inputs
  readonly earthInnocentsLynched: readonly string[];
  readonly earthKlaatuFreezeActivated: boolean;
  readonly earthGortTarget: string | null;
  // Valkyrie inputs
  readonly valkyrieBriefcasePassTarget: string | null;
  // Prison inputs
  readonly prisonGuardSanctions: readonly string[];
  readonly prisonWardenAppeased: readonly string[];
  readonly prisonInmatesLynched: readonly string[];
  readonly prisonSolitary: readonly string[];
  readonly prisonAssassinStrike: boolean;
  readonly prisonAssassinTarget: string | null;
  // Catenaccio inputs
  readonly catenaccioSniperTarget: string | null;
  readonly catenaccioWallAttackers: readonly string[];
  // Common
  readonly publicDeaths: readonly NightDeathRecord[];
}

export interface MinigamePhaseEventOutput {
  readonly updatedSubStates: MinigameSubStates;
  readonly danteResult: DantesInfernoEngineOutput | null;
  readonly earthResult: EarthStoodStillEngineOutput | null;
  readonly valkyrieResult: ValkyrieEngineOutput | null;
  readonly prisonResult: StanfordPrisonEngineOutput | null;
  readonly catenaccioResult: CatenaccioEngineOutput | null;
}

/**
 * Unified minigame phase-event dispatcher.
 * Reads current lobby substate, runs the appropriate engine(s), returns updated substates.
 */
export function dispatchMinigamePhaseEvent(input: MinigamePhaseEventInput): MinigamePhaseEventOutput {
  const lobby = inMemoryLobbyStore.getLobby(input.lobbyId);
  if (!lobby) {
    return {
      updatedSubStates: {},
      danteResult:      null,
      earthResult:      null,
      valkyrieResult:   null,
      prisonResult:     null,
      catenaccioResult: null,
    };
  }

  const { minigameSubStates, phase, roundNumber, players } = lobby;
  const isDayPhase =
    phase === 'DAY_REGIONAL_CAUCUS' ||
    phase === 'DAY_CENTRAL_ASSEMBLY' ||
    phase === 'DAY_VOTING';

  // ── Dante's Inferno ──────────────────────────────────────────────────────
  let danteResult: DantesInfernoEngineOutput | null = null;
  let updatedDante = minigameSubStates.dantesInferno;

  if (minigameSubStates.dantesInferno) {
    danteResult = advanceDantesInfernoCircle({
      currentState:       minigameSubStates.dantesInferno,
      phase,
      roundNumber,
      publicDeaths:       input.publicDeaths,
      players,
      greedAbilityUsers:  input.danteGreedAbilityUsers,
      lynchedPlayerId:    input.danteLynchedPlayerId,
    });
    updatedDante = danteResult.updatedState;
  }

  // ── Earth Stood Still ────────────────────────────────────────────────────
  let earthResult: EarthStoodStillEngineOutput | null = null;
  let updatedEarth = minigameSubStates.earthStoodStill;

  if (minigameSubStates.earthStoodStill) {
    earthResult = tickEarthStoodStill({
      currentState:            minigameSubStates.earthStoodStill,
      innocentsLynchedThisRound: input.earthInnocentsLynched,
      klaatuFreezeActivated:   input.earthKlaatuFreezeActivated,
      gortVapourisationTargetId: input.earthGortTarget,
    }, players);
    updatedEarth = earthResult.updatedState;
  }

  // ── Operation Valkyrie ───────────────────────────────────────────────────
  let valkyrieResult: ValkyrieEngineOutput | null = null;
  let updatedValkyrie = minigameSubStates.valkyrie;

  if (minigameSubStates.valkyrie) {
    valkyrieResult = processValkyrieRound({
      currentState:            minigameSubStates.valkyrie,
      briefcasePassTargetId:   input.valkyrieBriefcasePassTarget,
      isDayPhase,
    }, players);
    updatedValkyrie = valkyrieResult.updatedState;
  }

  // ── Stanford Prison ──────────────────────────────────────────────────────
  let prisonResult: StanfordPrisonEngineOutput | null = null;
  let updatedPrison = minigameSubStates.stanfordPrison;

  if (minigameSubStates.stanfordPrison) {
    prisonResult = processStanfordPrisonRound({
      currentState:             minigameSubStates.stanfordPrison,
      guardSanctionIds:         input.prisonGuardSanctions,
      wardenAppeasedInmateIds:  input.prisonWardenAppeased,
      inmatesLynchedIds:        input.prisonInmatesLynched,
      inmatesPlacedInSolitary:  input.prisonSolitary,
      secretAssassinStrike:     input.prisonAssassinStrike,
      assassinStrikeTargetId:   input.prisonAssassinTarget,
    });
    updatedPrison = prisonResult.updatedState;
  }

  // ── Catenaccio ───────────────────────────────────────────────────────────
  let catenaccioResult: CatenaccioEngineOutput | null = null;
  let updatedCatenaccio = minigameSubStates.catenaccio;

  if (minigameSubStates.catenaccio) {
    catenaccioResult = processCatenaccioRound({
      currentState:       minigameSubStates.catenaccio,
      sniperShotTargetId: input.catenaccioSniperTarget,
      wallAttackerIds:    input.catenaccioWallAttackers,
    });
    updatedCatenaccio = catenaccioResult.updatedState;
  }

  const updatedSubStates: MinigameSubStates = {
    dantesInferno:  updatedDante,
    earthStoodStill: updatedEarth,
    valkyrie:        updatedValkyrie,
    stanfordPrison:  updatedPrison,
    catenaccio:      updatedCatenaccio,
  };

  return {
    updatedSubStates,
    danteResult,
    earthResult,
    valkyrieResult,
    prisonResult,
    catenaccioResult,
  };
}
