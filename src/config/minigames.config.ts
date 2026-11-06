/**
 * Minigame Configurations, Circle Sequences, and Initializer Factories
 * Enterprise Mafia / Social Deduction Platform - Phase 1 Foundation
 */

import {
  BermudaTriangleState,
  BermudaWeather,
  CatenaccioState,
  ChernobylState,
  CyberpunkNeoBakuState,
  DanteCircle,
  DantesInfernoCircleConfig,
  DantesInfernoState,
  EarthStoodStillState,
  StanfordPrisonState,
  ValkyrieState,
} from '../types/minigames';

// === DANTE'S INFERNO CIRCLE PROGRESSION ===

export const DANTE_CIRCLES_ORDER: readonly DanteCircle[] = [
  'CIRCLE_1_LIMBO',
  'CIRCLE_2_LUST',
  'CIRCLE_3_GLUTTONY',
  'CIRCLE_4_GREED',
  'CIRCLE_5_WRATH',
  'CIRCLE_6_HERESY',
  'CIRCLE_7_VIOLENCE',
  'CIRCLE_8_FRAUD',
  'CIRCLE_9_TREACHERY',
] as const;

export const DANTE_CIRCLE_DEFINITIONS: Readonly<Record<DanteCircle, DantesInfernoCircleConfig>> = {
  CIRCLE_1_LIMBO: {
    circle: 'CIRCLE_1_LIMBO',
    stepNumber: 1,
    name: '1-ci Dairə: Limbo',
    activePhaseType: 'DAY',
    ruleDescription: '1-ci Gündüz: Məhdudiyyətsiz açıq müzakirə. Cəhənnəmə enişdən əvvəlki son sükut.',
  },
  CIRCLE_2_LUST: {
    circle: 'CIRCLE_2_LUST',
    stepNumber: 2,
    name: '2-ci Dairə: Şəhvət',
    activePhaseType: 'NIGHT',
    ruleDescription: '1-ci Gecə: 20% yayınma ehtimalı. Gecə hərəkətlərinin 1/5 şansla qonşu oyunçuya yayınma riski var.',
  },
  CIRCLE_3_GLUTTONY: {
    circle: 'CIRCLE_3_GLUTTONY',
    stepNumber: 3,
    name: '3-cü Dairə: Tamahkarlıq',
    activePhaseType: 'DAY',
    ruleDescription: '2-ci Gündüz: Yavaş çatı rejimi. Hər mesaj maksimum 80 simvol və 15 saniyəlik gecikmə ilə məhdudlaşır.',
  },
  CIRCLE_4_GREED: {
    circle: 'CIRCLE_4_GREED',
    stepNumber: 4,
    name: '4-cü Dairə: Xəsislik',
    activePhaseType: 'NIGHT',
    ruleDescription: '2-ci Gecə: Qabiliyyətlər səs hüququ bahasına başa gəlir. Gecə gücünü işlədən sabah səsvermə hüququnu itirir.',
  },
  CIRCLE_5_WRATH: {
    circle: 'CIRCLE_5_WRATH',
    stepNumber: 5,
    name: '5-ci Dairə: Qəzəb',
    activePhaseType: 'DAY',
    ruleDescription: '3-cü Gündüz: Bitərəf qalmaq və Buraxmaq qadağandır. Edam mütləqdir; bərabərlik qəfil ölüm mərhələsi açır.',
  },
  CIRCLE_6_HERESY: {
    circle: 'CIRCLE_6_HERESY',
    stepNumber: 6,
    name: '6-cı Dairə: Küfr',
    activePhaseType: 'NIGHT',
    ruleDescription: '3-cü Gecə: Ölənin rol ipucu sızması. Məzar açılır və həlak olmuş ruhun rol ipucu hər kəsə faş olur.',
  },
  CIRCLE_7_VIOLENCE: {
    circle: 'CIRCLE_7_VIOLENCE',
    stepNumber: 7,
    name: '7-ci Dairə: Zorakılıq',
    activePhaseType: 'DAY',
    ruleDescription: '4-cü Gündüz: Təmizlənmiş edam. Asılan oyunçunun rolu və fraksiya kartı öləndə hamıdan gizlədilir.',
  },
  CIRCLE_8_FRAUD: {
    circle: 'CIRCLE_8_FRAUD',
    stepNumber: 8,
    name: '8-ci Dairə: Fırıldaqçılıq',
    activePhaseType: 'NIGHT',
    ruleDescription: '4-cü Gecə: 50/50 dumanlı istintaq. Bütün şərif yoxlamaları iki mümkün fraksiya göstərir.',
  },
  CIRCLE_9_TREACHERY: {
    circle: 'CIRCLE_9_TREACHERY',
    stepNumber: 9,
    name: '9-cu Dairə: Xəyanət',
    activePhaseType: 'DAY',
    ruleDescription: '5-ci Gündüz: Gizli səsvermə. Səslər anonimdir; Dəli Lusiferin Kölgəsinə çevrilir və edam edilərsə tək qalib gəlir.',
  },
};

// === INITIAL STATE FACTORIES ===

export function createInitialDantesInfernoState(): DantesInfernoState {
  return {
    currentCircle: 'CIRCLE_1_LIMBO',
    completedCircles: [],
    deflectionRate: 0.2, // 20% in Circle 2
    slowModeCharLimit: 80, // Circle 3 text limit
    greedVoteCostDebts: {},
    wrathNoAbstainEnforced: false,
    heresyLeakedClues: [],
    violenceCleanedVictimIds: [],
    fraudBlurActive: false,
    treacherySecretVotingActive: false,
    jesterLuciferShadowActive: false,
    luciferShadowWinnerUserId: null,
  };
}

export function createInitialEarthStoodStillState(klaatuPlayerId: string | null = null): EarthStoodStillState {
  return {
    doomsdayClockHours: 0,
    planetaryWipeTriggered: false,
    worldFrozenActive: false,
    worldFrozenUsed: false,
    klaatuPlayerId,
    gortTargetPlayerId: null,
  };
}

export function createInitialValkyrieState(
  dictatorPlayerId: string,
  conspiratorPlayerIds: readonly string[],
  initialBriefcaseHolderId: string | null = null
): ValkyrieState {
  return {
    briefcaseLocationPlayerId: initialBriefcaseHolderId,
    fuseTimerDaysRemaining: 3,
    dictatorPlayerId,
    conspiratorPlayerIds,
    briefcaseDetonated: false,
    dictatorAssassinated: false,
  };
}

export function createInitialStanfordPrisonState(
  wardenPlayerId: string,
  guardPlayerIds: readonly string[],
  inmatePlayerIds: readonly string[],
  secretAssassinInmateId: string | null = null,
  initialSanctions = 3
): StanfordPrisonState {
  return {
    guardPlayerIds,
    inmatePlayerIds,
    revoltMeter: 0,
    wardenPlayerId,
    secretAssassinInmateId,
    solitaryConfinementPlayerIds: [],
    riotTriggered: false,
    guardSanctionsRemaining: initialSanctions,
  };
}

export function createInitialCatenaccioState(
  defensiveWallPlayerIds: readonly string[],
  sniperPlayerId: string | null,
  initialCharges = 2
): CatenaccioState {
  const armorCharges: Record<string, number> = {};
  for (const playerId of defensiveWallPlayerIds) {
    armorCharges[playerId] = initialCharges;
  }

  return {
    defensiveWallPlayerIds,
    sniperPlayerId,
    armorCharges,
    wallBreached: false,
  };
}

// === CHERNOBYL EXCLUSION ZONE DEFAULTS & FACTORY ===

export const CHERNOBYL_DEFAULTS = {
  INITIAL_ZONE_CONTAMINATION: 15, // Ambient radiation mSv added per round
  DEFAULT_BUNKER_CAPACITY: 2,     // Standard fallout shelter capacity
  LETHAL_THRESHOLD: 100,          // Fatal radiation dosage (100 mSv)
  DECONTAMINATION_HEAL_MSV: 50,  // Dosage removed per decontamination treatment
  ZONE_CONTAMINATION_INCREMENT: 15, // Rate at which zone contamination increases each round
} as const;

export interface ChernobylStateOptions {
  readonly bunkerCapacity?: number;
  readonly contaminationRate?: number;
  readonly initialContamination?: number;
  readonly lethalThreshold?: number;
  readonly liquidatorPlayerId?: string | null;
}

export function createInitialChernobylState(
  playerIds: readonly string[] = [],
  bunkerCapacityOrOpts: number | ChernobylStateOptions = CHERNOBYL_DEFAULTS.DEFAULT_BUNKER_CAPACITY,
  initialContamination: number = CHERNOBYL_DEFAULTS.INITIAL_ZONE_CONTAMINATION,
  lethalThreshold: number = CHERNOBYL_DEFAULTS.LETHAL_THRESHOLD,
  liquidatorPlayerId: string | null = null
): ChernobylState {
  let capacity: number = CHERNOBYL_DEFAULTS.DEFAULT_BUNKER_CAPACITY;
  let contamination: number = initialContamination;
  let threshold: number = lethalThreshold;
  let liquidator: string | null = liquidatorPlayerId;

  if (typeof bunkerCapacityOrOpts === 'object' && bunkerCapacityOrOpts !== null) {
    capacity = bunkerCapacityOrOpts.bunkerCapacity ?? CHERNOBYL_DEFAULTS.DEFAULT_BUNKER_CAPACITY;
    contamination =
      bunkerCapacityOrOpts.initialContamination ??
      bunkerCapacityOrOpts.contaminationRate ??
      initialContamination;
    threshold = bunkerCapacityOrOpts.lethalThreshold ?? lethalThreshold;
    liquidator = bunkerCapacityOrOpts.liquidatorPlayerId ?? liquidatorPlayerId;
  } else if (typeof bunkerCapacityOrOpts === 'number') {
    capacity = bunkerCapacityOrOpts;
  }

  const radiationDosage: Record<string, number> = {};
  for (const id of playerIds) {
    radiationDosage[id] = 0;
  }

  return {
    radiationDosage,
    shelteredPlayerIds: [],
    bunkerCapacity: capacity,
    zoneContaminationLevel: contamination,
    decontaminatedPlayerIds: [],
    radiationCasualties: [],
    lethalThreshold: threshold,
    liquidatorPlayerId: liquidator,
  };
}

// === CYBERPUNK 2077: NEO-BAKU DEFAULTS & FACTORY (M11) ===

export const CYBERPUNK_DEFAULTS = {
  INITIAL_GRID_INTEGRITY: 100,
  OVERDRIVE_THRESHOLD: 30,
  DESTABILIZED_THRESHOLD: 69,
  BLACKOUT_THRESHOLD: 0,
  GLITCH_PROBABILITY_DESTABILIZED: 0.15,
  GLITCH_PROBABILITY_OVERDRIVE: 0.40,
  OVERDRIVE_NIGHT_BUFFER_SECONDS: 15,
  DECAY_INNOCENT_LYNCH: 15,
  DECAY_CORPO_ASSASSINATION: 10,
  DECAY_NETRUNNER_OVERLOAD: 20,
  RECOVERY_CORPO_PATCH: 15,
  RECOVERY_CORPO_ELIMINATION: 20,
} as const;

export function createInitialCyberpunkState(initialGridIntegrity: number = CYBERPUNK_DEFAULTS.INITIAL_GRID_INTEGRITY): CyberpunkNeoBakuState {
  const integrity = Math.max(0, Math.min(100, initialGridIntegrity));
  return {
    gridIntegrity: integrity,
    isCyberOverdriveActive: integrity <= CYBERPUNK_DEFAULTS.OVERDRIVE_THRESHOLD && integrity > 0,
    isSystemBlackout: integrity === 0,
    activeGlitchEvent: 'NONE',
    glitchRoundsRemaining: 0,
    hackedPlayerVoteOverrides: {},
    cyberwareInventory: {},
    nodeSpoofPairs: {},
    corpoBribedPlayerIds: [],
    gridIntegrityHistory: [integrity],
  };
}

// === BERMUDA TRIANGLE DEFAULTS & FACTORY (M12) ===

export const BERMUDA_DEFAULTS = {
  INITIAL_HULL_INTEGRITY: 100,
  BASE_ANOMALY_FACTOR: 0.35,
  ROGUE_WAVE_HULL_DAMAGE: 15,
  CORSAIR_SABOTAGE_DAMAGE: 10,
  VANISHED_MASK_DURATION_ROUNDS: 2,
  NAUTICAL_DICTIONARY: [
    'KÖLGƏ',
    'KAPİTAN',
    'ŞİMAL',
    'QÜTB',
    'BURĞAN',
    'SİRENA',
    'QƏZA',
    'DUMAN',
    'FIRTINA',
    'QULDUR',
    'DƏRİNLİK',
    'MAYAQ',
  ] as const,
} as const;

export function createInitialBermudaState(initialHullIntegrity: number = BERMUDA_DEFAULTS.INITIAL_HULL_INTEGRITY): BermudaTriangleState {
  const hull = Math.max(0, Math.min(100, initialHullIntegrity));
  return {
    currentWeather: 'CALM_SEA',
    weatherRoundsRemaining: 1,
    shipHullIntegrity: hull,
    vanishedPlayerIds: [],
    revealedWreckageIds: [],
    cursedDrowningPlayerIds: [],
    stunnedPlayerIds: [],
    ghostTelegramClues: [],
    compassScrambleRate: 0.0,
  };
}
