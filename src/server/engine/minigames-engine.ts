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
  BermudaTriangleState,
  BermudaWeather,
  CatenaccioState,
  ChernobylState,
  CyberpunkGlitchEvent,
  CyberpunkNeoBakuState,
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
import {
  BERMUDA_DEFAULTS,
  CYBERPUNK_DEFAULTS,
  DANTE_CIRCLES_ORDER,
  DANTE_CIRCLE_DEFINITIONS,
} from '../../config/minigames.config';
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
    guardSanctionsRemaining:      Math.max(0, (currentState.guardSanctionsRemaining ?? 3) - guardSanctionIds.length),
  };

  return {
    updatedState,
    riotTriggered,
    assassinatedGuardId,
    currentRevoltMeter: newMeter,
  };
}

export interface PrisonActionResult {
  readonly success: boolean;
  readonly error?: string;
  readonly updatedLobby: LobbyState;
  readonly riotTriggered?: boolean;
}

/**
 * Executes a Guard sanction against an Inmate.
 * - Guard authorization check
 * - Inmate target check
 * - Decrements guardSanctionsRemaining (-1)
 * - Increments revoltMeter (+15), clamped to 100
 * - Triggers riot when meter reaches 100
 */
export function executePrisonSanction(
  lobby: LobbyState,
  actorUserId: string,
  targetInmateId: string
): PrisonActionResult {
  if (lobby.phase === 'LOBBY' || lobby.phase === 'ENDED') {
    return { success: false, error: 'INVALID_PHASE', updatedLobby: lobby };
  }
  const prison = lobby.minigameSubStates?.stanfordPrison;
  if (!prison) {
    return { success: false, error: 'NOT_STANFORD_PRISON_MODE', updatedLobby: lobby };
  }
  if (prison.riotTriggered) {
    return { success: false, error: 'RIOT_ALREADY_TRIGGERED', updatedLobby: lobby };
  }
  const actor = lobby.players[actorUserId];
  if (!actor || !actor.isAlive) {
    return { success: false, error: 'ACTOR_NOT_ALIVE', updatedLobby: lobby };
  }
  if (!prison.guardPlayerIds.includes(actorUserId)) {
    return { success: false, error: 'NOT_A_GUARD', updatedLobby: lobby };
  }
  const sanctionsRemaining = prison.guardSanctionsRemaining ?? 3;
  if (sanctionsRemaining <= 0) {
    return { success: false, error: 'NO_SANCTIONS_REMAINING', updatedLobby: lobby };
  }
  const target = lobby.players[targetInmateId];
  if (!target || !target.isAlive) {
    return { success: false, error: 'TARGET_NOT_ALIVE', updatedLobby: lobby };
  }
  if (!prison.inmatePlayerIds.includes(targetInmateId)) {
    return { success: false, error: 'TARGET_NOT_AN_INMATE', updatedLobby: lobby };
  }

  const newMeter = Math.min(100, Math.max(0, prison.revoltMeter + 15));
  const riotTriggered = newMeter >= 100 || prison.riotTriggered;

  const updatedPrison: StanfordPrisonState = {
    ...prison,
    revoltMeter: newMeter,
    guardSanctionsRemaining: Math.max(0, sanctionsRemaining - 1),
    riotTriggered,
  };

  const updatedLobby: LobbyState = {
    ...lobby,
    minigameSubStates: {
      ...lobby.minigameSubStates,
      stanfordPrison: updatedPrison,
    },
  };

  return { success: true, updatedLobby, riotTriggered };
}

/**
 * Places an Inmate in Solitary Confinement.
 * - Guard or Warden authorization check
 * - Inmate target check
 * - Duplicate solitary check
 * - Appends target to solitaryConfinementPlayerIds
 * - Decrements revoltMeter (-5), clamped to 0
 * - Purges active votes in flight
 */
export function executePrisonSolitary(
  lobby: LobbyState,
  actorUserId: string,
  targetInmateId: string
): PrisonActionResult {
  if (lobby.phase === 'LOBBY' || lobby.phase === 'ENDED') {
    return { success: false, error: 'INVALID_PHASE', updatedLobby: lobby };
  }
  const prison = lobby.minigameSubStates?.stanfordPrison;
  if (!prison) {
    return { success: false, error: 'NOT_STANFORD_PRISON_MODE', updatedLobby: lobby };
  }
  if (prison.riotTriggered) {
    return { success: false, error: 'RIOT_ALREADY_TRIGGERED', updatedLobby: lobby };
  }
  const actor = lobby.players[actorUserId];
  if (!actor || !actor.isAlive) {
    return { success: false, error: 'ACTOR_NOT_ALIVE', updatedLobby: lobby };
  }
  const isGuardOrWarden = prison.guardPlayerIds.includes(actorUserId) || prison.wardenPlayerId === actorUserId;
  if (!isGuardOrWarden) {
    return { success: false, error: 'NOT_A_GUARD_OR_WARDEN', updatedLobby: lobby };
  }
  const target = lobby.players[targetInmateId];
  if (!target || !target.isAlive) {
    return { success: false, error: 'TARGET_NOT_ALIVE', updatedLobby: lobby };
  }
  if (!prison.inmatePlayerIds.includes(targetInmateId)) {
    return { success: false, error: 'TARGET_NOT_AN_INMATE', updatedLobby: lobby };
  }
  if (prison.solitaryConfinementPlayerIds.includes(targetInmateId)) {
    return { success: false, error: 'ALREADY_IN_SOLITARY', updatedLobby: lobby };
  }

  const newMeter = Math.min(100, Math.max(0, prison.revoltMeter - 5));
  const updatedSolitary = [...prison.solitaryConfinementPlayerIds, targetInmateId];

  const updatedLiveVotes = { ...(lobby.liveVotes ?? {}) };
  delete updatedLiveVotes[targetInmateId];

  const updatedVerdictVotes = { ...(lobby.trialVerdictVotes ?? {}) };
  delete updatedVerdictVotes[targetInmateId];

  const updatedPrison: StanfordPrisonState = {
    ...prison,
    revoltMeter: newMeter,
    solitaryConfinementPlayerIds: updatedSolitary,
  };

  const updatedLobby: LobbyState = {
    ...lobby,
    liveVotes: updatedLiveVotes,
    trialVerdictVotes: updatedVerdictVotes,
    minigameSubStates: {
      ...lobby.minigameSubStates,
      stanfordPrison: updatedPrison,
    },
  };

  return { success: true, updatedLobby, riotTriggered: prison.riotTriggered };
}

/**
 * State-level helper: applies a Guard sanction directly to StanfordPrisonState.
 */
export function applyPrisonSanction(
  currentState: StanfordPrisonState,
  actorUserId: string,
  targetInmateId: string
): { success: boolean; error?: string; updatedState: StanfordPrisonState } {
  if (currentState.riotTriggered) {
    return { success: false, error: 'RIOT_ALREADY_TRIGGERED', updatedState: currentState };
  }
  if (!currentState.guardPlayerIds.includes(actorUserId)) {
    return { success: false, error: 'GUARD_ONLY_ACTION', updatedState: currentState };
  }
  if (!currentState.inmatePlayerIds.includes(targetInmateId)) {
    return { success: false, error: 'INVALID_INMATE_TARGET', updatedState: currentState };
  }
  const sanctionsRemaining = currentState.guardSanctionsRemaining ?? 3;
  if (sanctionsRemaining <= 0) {
    return { success: false, error: 'NO_SANCTIONS_REMAINING', updatedState: currentState };
  }

  const newMeter = Math.min(100, Math.max(0, currentState.revoltMeter + 15));
  const riotTriggered = newMeter >= 100 || currentState.riotTriggered;

  const updatedState: StanfordPrisonState = {
    ...currentState,
    revoltMeter: newMeter,
    guardSanctionsRemaining: Math.max(0, sanctionsRemaining - 1),
    riotTriggered,
  };

  return { success: true, updatedState };
}

/**
 * State-level helper: places an Inmate into solitary confinement directly on StanfordPrisonState.
 */
export function applyPrisonSolitary(
  currentState: StanfordPrisonState,
  actorUserId: string,
  targetInmateId: string
): { success: boolean; error?: string; updatedState: StanfordPrisonState } {
  if (currentState.riotTriggered) {
    return { success: false, error: 'RIOT_ALREADY_TRIGGERED', updatedState: currentState };
  }
  const isGuardOrWarden =
    currentState.guardPlayerIds.includes(actorUserId) ||
    currentState.wardenPlayerId === actorUserId;
  if (!isGuardOrWarden) {
    return { success: false, error: 'NOT_A_GUARD_OR_WARDEN', updatedState: currentState };
  }
  if (!currentState.inmatePlayerIds.includes(targetInmateId)) {
    return { success: false, error: 'INVALID_INMATE_TARGET', updatedState: currentState };
  }
  if (currentState.solitaryConfinementPlayerIds.includes(targetInmateId)) {
    return { success: false, error: 'ALREADY_IN_SOLITARY', updatedState: currentState };
  }

  const newMeter = Math.min(100, Math.max(0, currentState.revoltMeter - 5));

  const updatedState: StanfordPrisonState = {
    ...currentState,
    revoltMeter: newMeter,
    solitaryConfinementPlayerIds: [...currentState.solitaryConfinementPlayerIds, targetInmateId],
  };

  return { success: true, updatedState };
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
// 6. CHERNOBYL EXCLUSION ZONE RADIATION ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ChernobylEngineInput {
  readonly currentState: ChernobylState;
  /** Player IDs currently alive in the game (optional if players record passed as 2nd param) */
  readonly alivePlayerIds?: readonly string[];
  /** Optional override for sheltered players this round; defaults to currentState.shelteredPlayerIds */
  readonly shelteredPlayerIds?: readonly string[];
  /** Optional override for decontaminated players this round; defaults to currentState.decontaminatedPlayerIds */
  readonly decontaminatedPlayerIds?: readonly string[];
  /** Amount to increment zone contamination by (defaults to 15 mSv) */
  readonly contaminationIncrement?: number;
}

export interface ChernobylEngineOutput {
  readonly updatedState: ChernobylState;
  /** Player IDs newly eliminated this round due to reaching lethal radiation dosage */
  readonly newCasualtyPlayerIds: readonly string[];
  /** Alias for newCasualtyPlayerIds */
  readonly newRadiationVictims: readonly string[];
  /** Generated NightDeathRecord objects for casualties with cause 'RADIATION_SICKNESS' */
  readonly radiationDeaths: readonly NightDeathRecord[];
  /** Alias for radiationDeaths */
  readonly deathRecords: readonly NightDeathRecord[];
  /** Current active zone contamination level after round tick */
  readonly currentZoneContamination: number;
  /** Detailed mapping of dosage deltas applied this round: playerId -> delta */
  readonly dosageDeltas: Readonly<Record<string, number>>;
}

/**
 * Process one round of Chernobyl Exclusion Zone radiation dynamics:
 *  - Enforces bunker capacity limit (only first bunkerCapacity valid alive players in shelteredPlayerIds are sheltered).
 *  - Applies decontamination healing (-50 mSv, clamped to 0) to designated players.
 *  - Applies ambient zone contamination to all unsheltered alive players. Sheltered players take 0 damage.
 *  - Eliminates players whose cumulative radiation reaches or exceeds lethalThreshold (100 mSv) with 'RADIATION_SICKNESS'.
 *  - Increments ambient zone contamination by +15 mSv for subsequent rounds.
 */
export function processChernobylRound(
  input: ChernobylEngineInput,
  players?: Readonly<Record<string, PlayerSession>>
): ChernobylEngineOutput {
  const {
    currentState,
    contaminationIncrement = 15,
  } = input;

  let aliveIds: readonly string[];
  if (input.alivePlayerIds && input.alivePlayerIds.length > 0) {
    aliveIds = input.alivePlayerIds;
  } else if (players) {
    aliveIds = Object.values(players).filter(p => p.isAlive).map(p => p.userId);
  } else {
    aliveIds = Object.keys(currentState.radiationDosage).filter(
      id => !currentState.radiationCasualties.includes(id)
    );
  }

  // 1. Determine sheltered players respecting bunker capacity limit
  const requestedSheltered = input.shelteredPlayerIds ?? currentState.shelteredPlayerIds;
  const validSheltered = requestedSheltered.filter(id => aliveIds.includes(id));
  const effectiveSheltered = validSheltered.slice(0, currentState.bunkerCapacity);
  const shelteredSet = new Set(effectiveSheltered);

  // 2. Determine decontaminated players
  const requestedDecontaminated = input.decontaminatedPlayerIds ?? [];
  const effectiveDecontaminated = requestedDecontaminated.filter(id => aliveIds.includes(id));
  const decontaminateSet = new Set(effectiveDecontaminated);

  // 3. Current ambient zone dosage to apply this round
  const currentDosageToApply = currentState.zoneContaminationLevel;

  // 4. Update radiation dosage for all alive players
  const updatedDosage: Record<string, number> = { ...currentState.radiationDosage };
  const dosageDeltas: Record<string, number> = {};
  const newCasualties: string[] = [];
  const radiationDeaths: NightDeathRecord[] = [];
  const existingCasualtiesSet = new Set(currentState.radiationCasualties);

  for (const playerId of aliveIds) {
    let currentDose = updatedDosage[playerId] ?? 0;
    let netDelta = 0;

    // Apply decontamination healing (-50 mSv, clamped at 0)
    if (decontaminateSet.has(playerId)) {
      const reduction = Math.min(currentDose, 50);
      currentDose = Math.max(0, currentDose - 50);
      netDelta -= reduction;
    }

    // Sheltered players take 0 damage. Unsheltered take zone dosage.
    if (!shelteredSet.has(playerId)) {
      currentDose += currentDosageToApply;
      netDelta += currentDosageToApply;
    }

    updatedDosage[playerId] = currentDose;
    dosageDeltas[playerId] = netDelta;

    // Check lethal threshold (100 mSv)
    if (currentDose >= currentState.lethalThreshold && !existingCasualtiesSet.has(playerId)) {
      newCasualties.push(playerId);
      radiationDeaths.push({
        victimPlayerId: playerId,
        cause: 'RADIATION_SICKNESS',
        killerFaction: null,
        isCleaned: false,
      });
    }
  }

  // 5. Increment zone contamination level for future rounds (+15 mSv)
  const nextZoneContamination = currentState.zoneContaminationLevel + contaminationIncrement;

  // 6. Assemble updated state
  const updatedState: ChernobylState = {
    radiationDosage: updatedDosage,
    shelteredPlayerIds: effectiveSheltered,
    bunkerCapacity: currentState.bunkerCapacity,
    zoneContaminationLevel: nextZoneContamination,
    decontaminatedPlayerIds: [],
    radiationCasualties: [...currentState.radiationCasualties, ...newCasualties],
    lethalThreshold: currentState.lethalThreshold,
    liquidatorPlayerId: currentState.liquidatorPlayerId ?? null,
  };

  return {
    updatedState,
    newCasualtyPlayerIds: newCasualties,
    newRadiationVictims: newCasualties,
    radiationDeaths,
    deathRecords: radiationDeaths,
    currentZoneContamination: nextZoneContamination,
    dosageDeltas,
  };
}

/**
 * State-level helper: manages entering/leaving the fallout bunker on ChernobylState.
 */
export function applyChernobylShelter(
  state: ChernobylState,
  playerId: string,
  leave: boolean = false
): { success: boolean; error?: string; updatedState: ChernobylState } {
  const current = state.shelteredPlayerIds || [];
  if (leave) {
    return {
      success: true,
      updatedState: {
        ...state,
        shelteredPlayerIds: current.filter(id => id !== playerId),
      },
    };
  }
  if (current.includes(playerId)) {
    return { success: true, updatedState: state };
  }
  if (current.length >= state.bunkerCapacity) {
    return {
      success: false,
      error: 'BUNKER_CAPACITY_EXCEEDED',
      updatedState: state,
    };
  }
  return {
    success: true,
    updatedState: {
      ...state,
      shelteredPlayerIds: [...current, playerId],
    },
  };
}

/**
 * State-level helper: administers decontamination healing directly to ChernobylState.
 */
export function applyChernobylDecontamination(
  state: ChernobylState,
  targetPlayerId: string,
  reductionAmount: number = 50
): { success: boolean; error?: string; updatedState: ChernobylState } {
  const currentDose = state.radiationDosage[targetPlayerId] ?? 0;
  const newDose = Math.max(0, currentDose - reductionAmount);

  return {
    success: true,
    updatedState: {
      ...state,
      radiationDosage: {
        ...state.radiationDosage,
        [targetPlayerId]: newDose,
      },
      decontaminatedPlayerIds: state.decontaminatedPlayerIds || [],
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. CYBERPUNK 2077: NEO-BAKU ENGINE (M11)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CyberpunkEngineInput {
  readonly currentState: CyberpunkNeoBakuState;
  readonly innocentsLynchedCount?: number;
  readonly corpoAssassinationsCount?: number;
  readonly netrunnerOverloadsCount?: number;
  readonly corpoPatchesCount?: number;
  readonly corpoExecutivesEliminatedCount?: number;
  readonly hackedVoteCommands?: readonly { victimId: string; forcedTargetId: string }[];
  readonly cyberwareDistributions?: readonly { recipientId: string; augment: 'SUBDERMAL' | 'REFLEX' | 'EMP' }[];
  readonly nodeSpoofPairs?: readonly { infiltratorId: string; spoofTargetId: string }[];
  readonly corpoBribes?: readonly { targetPlayerId: string }[];
  readonly isMorningArrival?: boolean;
  readonly rollRandom?: () => number;
}

export interface CyberpunkEngineOutput {
  readonly updatedState: CyberpunkNeoBakuState;
  readonly integrityDelta: number;
  readonly glitchTriggered: CyberpunkGlitchEvent | null;
  readonly overdriveEntered: boolean;
  readonly blackoutEntered: boolean;
  readonly anarchistVictoryTriggered: boolean;
  readonly corpoHegemonyTriggered: boolean;
  readonly netrunnerLiberationTriggered: boolean;
}

export function processCyberpunkRound(
  input: CyberpunkEngineInput,
  players: Readonly<Record<string, PlayerSession>>
): CyberpunkEngineOutput {
  const { currentState, isMorningArrival = false, rollRandom = Math.random } = input;

  // 1. Calculate integrity delta
  let integrityDelta = 0;
  if (input.innocentsLynchedCount) {
    integrityDelta -= input.innocentsLynchedCount * CYBERPUNK_DEFAULTS.DECAY_INNOCENT_LYNCH;
  }
  if (input.corpoAssassinationsCount) {
    integrityDelta -= input.corpoAssassinationsCount * CYBERPUNK_DEFAULTS.DECAY_CORPO_ASSASSINATION;
  }
  if (input.netrunnerOverloadsCount) {
    integrityDelta -= input.netrunnerOverloadsCount * CYBERPUNK_DEFAULTS.DECAY_NETRUNNER_OVERLOAD;
  }
  if (input.corpoPatchesCount) {
    integrityDelta += input.corpoPatchesCount * CYBERPUNK_DEFAULTS.RECOVERY_CORPO_PATCH;
  }
  if (input.corpoExecutivesEliminatedCount) {
    integrityDelta += input.corpoExecutivesEliminatedCount * CYBERPUNK_DEFAULTS.RECOVERY_CORPO_ELIMINATION;
  }

  const rawIntegrity = currentState.gridIntegrity + integrityDelta;
  const newIntegrity = Math.max(0, Math.min(100, rawIntegrity));

  const overdriveEntered =
    currentState.gridIntegrity > CYBERPUNK_DEFAULTS.OVERDRIVE_THRESHOLD &&
    newIntegrity <= CYBERPUNK_DEFAULTS.OVERDRIVE_THRESHOLD &&
    newIntegrity > 0;
  const isCyberOverdriveActive = newIntegrity <= CYBERPUNK_DEFAULTS.OVERDRIVE_THRESHOLD && newIntegrity > 0;

  const blackoutEntered = currentState.gridIntegrity > 0 && newIntegrity === 0;
  const isSystemBlackout = newIntegrity === 0;

  // 2. Net-Glitch Events handling
  let activeGlitchEvent: CyberpunkGlitchEvent = currentState.activeGlitchEvent;
  let glitchRoundsRemaining = currentState.glitchRoundsRemaining;
  let glitchTriggered: CyberpunkGlitchEvent | null = null;

  if (glitchRoundsRemaining > 1) {
    glitchRoundsRemaining -= 1;
  } else if (isMorningArrival && newIntegrity < 70) {
    const glitchChance = isCyberOverdriveActive
      ? CYBERPUNK_DEFAULTS.GLITCH_PROBABILITY_OVERDRIVE
      : CYBERPUNK_DEFAULTS.GLITCH_PROBABILITY_DESTABILIZED;
    const roll = rollRandom();
    if (roll < glitchChance) {
      const glitchChoices: CyberpunkGlitchEvent[] = ['SIGNAL_SCRAMBLE', 'FIREWALL_BREACH', 'BLACKOUT_CYCLE'];
      const chosen = glitchChoices[Math.floor(rollRandom() * glitchChoices.length)] ?? 'SIGNAL_SCRAMBLE';
      activeGlitchEvent = chosen;
      glitchRoundsRemaining = 1;
      glitchTriggered = chosen;
    } else {
      activeGlitchEvent = 'NONE';
      glitchRoundsRemaining = 0;
    }
  } else {
    activeGlitchEvent = 'NONE';
    glitchRoundsRemaining = 0;
  }

  // 3. Merging abilities
  const updatedHackedVotes = { ...currentState.hackedPlayerVoteOverrides };
  if (input.hackedVoteCommands) {
    for (const cmd of input.hackedVoteCommands) {
      updatedHackedVotes[cmd.victimId] = cmd.forcedTargetId;
    }
  }

  const updatedCyberware = { ...currentState.cyberwareInventory };
  if (input.cyberwareDistributions) {
    for (const dist of input.cyberwareDistributions) {
      updatedCyberware[dist.recipientId] = dist.augment;
    }
  }

  const updatedNodeSpoof = { ...currentState.nodeSpoofPairs };
  if (input.nodeSpoofPairs) {
    for (const pair of input.nodeSpoofPairs) {
      updatedNodeSpoof[pair.infiltratorId] = pair.spoofTargetId;
    }
  }

  const updatedBribed = new Set(currentState.corpoBribedPlayerIds);
  if (input.corpoBribes) {
    for (const b of input.corpoBribes) {
      updatedBribed.add(b.targetPlayerId);
    }
  }

  const history = [...currentState.gridIntegrityHistory, newIntegrity];

  // 4. Win condition checks
  const aliveList = getAlivePlayers(players);
  const aliveCorpo = aliveList.filter(p => getPlayerFaction(p) === 'MAFIA' || p.displayRole?.originalRoleName?.includes('Corpo') || p.displayRole?.originalRoleName?.includes('Infiltrator'));
  const aliveTown = aliveList.filter(p => getPlayerFaction(p) === 'TOWN' || p.allInIdentity?.layer1Faction === 'TOWN');

  // Anarchist victory: 0% grid integrity maintained for 2 consecutive cycles
  const anarchistVictoryTriggered =
    history.length >= 2 &&
    history[history.length - 1] === 0 &&
    history[history.length - 2] === 0;

  // Corpo hegemony: Netrunner/Syndicate killers eliminated, corpo >= town, grid >= 40%
  const corpoHegemonyTriggered =
    newIntegrity >= 40 &&
    aliveCorpo.length > 0 &&
    aliveCorpo.length >= aliveTown.length;

  // Netrunner liberation: All corpo eliminated, town alive
  const netrunnerLiberationTriggered = aliveCorpo.length === 0 && aliveTown.length > 0;

  const updatedState: CyberpunkNeoBakuState = {
    gridIntegrity: newIntegrity,
    isCyberOverdriveActive,
    isSystemBlackout,
    activeGlitchEvent,
    glitchRoundsRemaining,
    hackedPlayerVoteOverrides: updatedHackedVotes,
    cyberwareInventory: updatedCyberware,
    nodeSpoofPairs: updatedNodeSpoof,
    corpoBribedPlayerIds: Array.from(updatedBribed),
    gridIntegrityHistory: history,
  };

  return {
    updatedState,
    integrityDelta,
    glitchTriggered,
    overdriveEntered,
    blackoutEntered,
    anarchistVictoryTriggered,
    corpoHegemonyTriggered,
    netrunnerLiberationTriggered,
  };
}

export function applyCyberwareDrop(
  state: CyberpunkNeoBakuState,
  recipientId: string,
  augment: 'SUBDERMAL' | 'REFLEX' | 'EMP'
): CyberpunkNeoBakuState {
  return {
    ...state,
    cyberwareInventory: {
      ...state.cyberwareInventory,
      [recipientId]: augment,
    },
  };
}

export function applyCorpoBribe(
  state: CyberpunkNeoBakuState,
  targetId: string
): CyberpunkNeoBakuState {
  const bribedSet = new Set(state.corpoBribedPlayerIds);
  bribedSet.add(targetId);
  return {
    ...state,
    corpoBribedPlayerIds: Array.from(bribedSet),
  };
}

export function applyNetrunnerHack(
  state: CyberpunkNeoBakuState,
  victimId: string,
  forcedTargetId: string
): CyberpunkNeoBakuState {
  return {
    ...state,
    hackedPlayerVoteOverrides: {
      ...state.hackedPlayerVoteOverrides,
      [victimId]: forcedTargetId,
    },
  };
}

export function applyNodeSpoof(
  state: CyberpunkNeoBakuState,
  infiltratorId: string,
  spoofTargetId: string
): CyberpunkNeoBakuState {
  return {
    ...state,
    nodeSpoofPairs: {
      ...state.nodeSpoofPairs,
      [infiltratorId]: spoofTargetId,
    },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. BERMUDA TRIANGLE ENGINE (M12)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface BermudaEngineInput {
  readonly currentState: BermudaTriangleState;
  readonly roundNumber: number;
  readonly publicDeaths?: readonly NightDeathRecord[];
  readonly salvagedPlayerIds?: readonly string[];
  readonly curedDrowningPlayerIds?: readonly string[];
  readonly newSirenCursedPlayerIds?: readonly string[];
  readonly corsairSabotageCount?: number;
  readonly ghostTelegramSubmitted?: readonly string[];
  readonly isMorningArrival?: boolean;
  readonly rollRandom?: () => number;
}

export interface BermudaEngineOutput {
  readonly updatedState: BermudaTriangleState;
  readonly weatherChanged: boolean;
  readonly newWeather: BermudaWeather;
  readonly hullDelta: number;
  readonly lifeboatProtocolActive: boolean;
  readonly drowningCasualties: readonly string[];
  readonly crewSurvivalTriggered: boolean;
  readonly abyssalClaimTriggered: boolean;
  readonly shipwreckTriggered: boolean;
}

export function processBermudaRound(
  input: BermudaEngineInput,
  players: Readonly<Record<string, PlayerSession>>
): BermudaEngineOutput {
  const { currentState, roundNumber, isMorningArrival = false, rollRandom = Math.random } = input;

  let currentWeather = currentState.currentWeather;
  let weatherRoundsRemaining = currentState.weatherRoundsRemaining;
  let weatherChanged = false;

  // 1. Weather transition curve: P(Anomaly) = 1 - e^(-0.35 * roundNumber)
  if (isMorningArrival) {
    if (weatherRoundsRemaining <= 1) {
      const pAnomaly = 1 - Math.exp(-BERMUDA_DEFAULTS.BASE_ANOMALY_FACTOR * roundNumber);
      const roll = rollRandom();

      let nextWeather: BermudaWeather = 'CALM_SEA';
      if (roll < pAnomaly) {
        // Severe weather escalation
        const weatherRoll = rollRandom();
        if (roundNumber >= 3 && weatherRoll < 0.35) {
          nextWeather = 'ROGUE_WAVE';
        } else if (weatherRoll < 0.65) {
          nextWeather = 'ELECTROMAGNETIC_STORM';
        } else {
          nextWeather = 'FOG_OF_THE_VOID';
        }
      } else {
        nextWeather = 'CALM_SEA';
      }

      weatherChanged = nextWeather !== currentWeather;
      currentWeather = nextWeather;
      weatherRoundsRemaining = 1;
    } else {
      weatherRoundsRemaining -= 1;
    }
  }

  // 2. Hull damage & Rogue Wave stun
  let hullDelta = 0;
  let stunnedPlayerIds = [...currentState.stunnedPlayerIds];

  if (isMorningArrival && currentWeather === 'ROGUE_WAVE' && weatherChanged) {
    hullDelta -= BERMUDA_DEFAULTS.ROGUE_WAVE_HULL_DAMAGE;
    const living = getAlivePlayers(players);
    if (living.length > 0) {
      const chosenIdx = Math.floor(rollRandom() * living.length);
      const stunned = living[chosenIdx];
      if (stunned) {
        stunnedPlayerIds = [stunned.userId];
      }
    }
  } else if (isMorningArrival && currentWeather !== 'ROGUE_WAVE') {
    stunnedPlayerIds = []; // Stun clears after 1 round
  }

  if (input.corsairSabotageCount) {
    hullDelta -= input.corsairSabotageCount * BERMUDA_DEFAULTS.CORSAIR_SABOTAGE_DAMAGE;
  }

  const rawHull = currentState.shipHullIntegrity + hullDelta;
  const newHull = Math.max(0, Math.min(100, rawHull));
  const lifeboatProtocolActive = newHull === 0;

  // 3. Vanished at Sea (Masked Deaths)
  const vanishedSet = new Set(currentState.vanishedPlayerIds);
  const revealedSet = new Set(currentState.revealedWreckageIds);

  if (input.publicDeaths) {
    for (const death of input.publicDeaths) {
      if (!revealedSet.has(death.victimPlayerId)) {
        vanishedSet.add(death.victimPlayerId);
      }
    }
  }

  if (input.salvagedPlayerIds) {
    for (const id of input.salvagedPlayerIds) {
      vanishedSet.delete(id);
      revealedSet.add(id);
    }
  }

  // 4. Abyssal Siren Drowning Curse
  const drowningCasualties: string[] = [];
  const cursedSet = new Set(currentState.cursedDrowningPlayerIds);

  // Cured players
  if (input.curedDrowningPlayerIds) {
    for (const id of input.curedDrowningPlayerIds) {
      cursedSet.delete(id);
    }
  }

  // Morning arrival resolves pending drownings
  if (isMorningArrival) {
    for (const id of Array.from(cursedSet)) {
      if (!input.curedDrowningPlayerIds?.includes(id)) {
        drowningCasualties.push(id);
        cursedSet.delete(id);
      }
    }
  }

  // Add newly cursed players
  if (input.newSirenCursedPlayerIds) {
    for (const id of input.newSirenCursedPlayerIds) {
      cursedSet.add(id);
    }
  }

  // 5. Ghost Telegram (3 words)
  let ghostTelegramClues = currentState.ghostTelegramClues;
  if (input.ghostTelegramSubmitted && input.ghostTelegramSubmitted.length === 3) {
    ghostTelegramClues = [...input.ghostTelegramSubmitted];
  }

  // 6. Compass Scramble Rate
  let compassScrambleRate = 0.0;
  switch (currentWeather) {
    case 'CALM_SEA':
      compassScrambleRate = 0.0;
      break;
    case 'FOG_OF_THE_VOID':
      compassScrambleRate = 0.3;
      break;
    case 'ELECTROMAGNETIC_STORM':
      compassScrambleRate = 0.85;
      break;
    case 'ROGUE_WAVE':
      compassScrambleRate = 0.5;
      break;
  }

  // 7. Win conditions
  const aliveList = getAlivePlayers(players).filter(p => !drowningCasualties.includes(p.userId));
  const aliveCorsairs = aliveList.filter(p => getPlayerFaction(p) === 'MAFIA' || p.displayRole?.originalRoleName?.includes('Corsair') || p.displayRole?.originalRoleName?.includes('Siren'));
  const aliveCrew = aliveList.filter(p => getPlayerFaction(p) === 'TOWN' || p.allInIdentity?.layer1Faction === 'TOWN');

  const crewSurvivalTriggered = aliveCorsairs.length === 0 && aliveCrew.length > 0 && newHull > 0;
  const abyssalClaimTriggered = aliveCorsairs.length > 0 && aliveCorsairs.length >= aliveCrew.length;
  const shipwreckTriggered = newHull === 0 && aliveList.length === 0;

  const updatedState: BermudaTriangleState = {
    currentWeather,
    weatherRoundsRemaining,
    shipHullIntegrity: newHull,
    vanishedPlayerIds: Array.from(vanishedSet),
    revealedWreckageIds: Array.from(revealedSet),
    cursedDrowningPlayerIds: Array.from(cursedSet),
    stunnedPlayerIds,
    ghostTelegramClues,
    compassScrambleRate,
  };

  return {
    updatedState,
    weatherChanged,
    newWeather: currentWeather,
    hullDelta,
    lifeboatProtocolActive,
    drowningCasualties,
    crewSurvivalTriggered,
    abyssalClaimTriggered,
    shipwreckTriggered,
  };
}

export function applySalvageLogbook(
  state: BermudaTriangleState,
  victimId: string
): BermudaTriangleState {
  const vanished = new Set(state.vanishedPlayerIds);
  vanished.delete(victimId);
  const revealed = new Set(state.revealedWreckageIds);
  revealed.add(victimId);

  return {
    ...state,
    vanishedPlayerIds: Array.from(vanished),
    revealedWreckageIds: Array.from(revealed),
  };
}

export function applyOxygenTreatment(
  state: BermudaTriangleState,
  curedPlayerId: string
): BermudaTriangleState {
  const cursed = new Set(state.cursedDrowningPlayerIds);
  cursed.delete(curedPlayerId);
  return {
    ...state,
    cursedDrowningPlayerIds: Array.from(cursed),
  };
}

export function applySirenCurse(
  state: BermudaTriangleState,
  victimId: string
): BermudaTriangleState {
  const cursed = new Set(state.cursedDrowningPlayerIds);
  cursed.add(victimId);
  return {
    ...state,
    cursedDrowningPlayerIds: Array.from(cursed),
  };
}

export function submitGhostTelegram(
  state: BermudaTriangleState,
  words: readonly string[]
): BermudaTriangleState {
  if (words.length !== 3) return state;
  return {
    ...state,
    ghostTelegramClues: [...words],
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
  // Chernobyl inputs
  readonly chernobylShelteredPlayerIds?: readonly string[];
  readonly chernobylDecontaminatePlayerIds?: readonly string[];
  // Cyberpunk inputs (M11)
  readonly cyberpunkInputs?: Partial<CyberpunkEngineInput>;
  // Bermuda inputs (M12)
  readonly bermudaInputs?: Partial<BermudaEngineInput>;
  /** Whether this dispatch represents the morning arrival transition (resolving night effects) */
  readonly isMorningArrival?: boolean;
  readonly phase?: string;
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
  readonly chernobylResult: ChernobylEngineOutput | null;
  readonly cyberpunkResult: CyberpunkEngineOutput | null;
  readonly bermudaResult: BermudaEngineOutput | null;
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
      chernobylResult:  null,
      cyberpunkResult:  null,
      bermudaResult:    null,
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

  // ── Chernobyl Exclusion Zone ─────────────────────────────────────────────
  let chernobylResult: ChernobylEngineOutput | null = null;
  let updatedChernobyl = minigameSubStates.chernobyl;

  // Chernobyl radiation accumulation strictly resolves overnight
  // and ticks only once per 24-hour cycle upon morning arrival.
  const isMorningTransition = input.isMorningArrival ?? ((input.phase ?? phase) === 'NIGHT_BUFFER');

  if (minigameSubStates.chernobyl && isMorningTransition) {
    const alivePlayerIds = Object.values(players)
      .filter(p => p.isAlive)
      .map(p => p.userId);

    chernobylResult = processChernobylRound({
      currentState: minigameSubStates.chernobyl,
      alivePlayerIds,
      shelteredPlayerIds: input.chernobylShelteredPlayerIds,
      decontaminatedPlayerIds: input.chernobylDecontaminatePlayerIds ?? minigameSubStates.chernobyl.decontaminatedPlayerIds,
    }, players);
    updatedChernobyl = chernobylResult.updatedState;
  }

  // ── Cyberpunk 2077: Neo-Baku ──────────────────────────────────────────
  let cyberpunkResult: CyberpunkEngineOutput | null = null;
  let updatedCyberpunk = minigameSubStates.cyberpunkNeoBaku;

  if (minigameSubStates.cyberpunkNeoBaku) {
    cyberpunkResult = processCyberpunkRound({
      currentState: minigameSubStates.cyberpunkNeoBaku,
      isMorningArrival: isMorningTransition,
      ...(input.cyberpunkInputs ?? {}),
    }, players);
    updatedCyberpunk = cyberpunkResult.updatedState;
  }

  // ── Bermuda Triangle: Ghost Fleet ──────────────────────────────────────
  let bermudaResult: BermudaEngineOutput | null = null;
  let updatedBermuda = minigameSubStates.bermudaTriangle;

  if (minigameSubStates.bermudaTriangle) {
    bermudaResult = processBermudaRound({
      currentState: minigameSubStates.bermudaTriangle,
      roundNumber,
      publicDeaths: input.publicDeaths,
      isMorningArrival: isMorningTransition,
      ...(input.bermudaInputs ?? {}),
    }, players);
    updatedBermuda = bermudaResult.updatedState;
  }

  const updatedSubStates: MinigameSubStates = {
    dantesInferno:  updatedDante,
    earthStoodStill: updatedEarth,
    valkyrie:        updatedValkyrie,
    stanfordPrison:  updatedPrison,
    catenaccio:      updatedCatenaccio,
    chernobyl:       updatedChernobyl,
    cyberpunkNeoBaku: updatedCyberpunk,
    bermudaTriangle: updatedBermuda,
  };

  return {
    updatedSubStates,
    danteResult,
    earthResult,
    valkyrieResult,
    prisonResult,
    catenaccioResult,
    chernobylResult,
    cyberpunkResult,
    bermudaResult,
  };
}

