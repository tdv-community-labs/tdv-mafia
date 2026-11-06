/**
 * Minigame Custom States & Mechanic Definitions
 * Enterprise Mafia / Social Deduction Platform - Phase 1 Foundation
 */

export type DanteCircle =
  | 'CIRCLE_1_LIMBO'      // Day 1: open deliberation
  | 'CIRCLE_2_LUST'       // Night 1: 20% deflection
  | 'CIRCLE_3_GLUTTONY'   // Day 2: slow-mode text limits
  | 'CIRCLE_4_GREED'      // Night 2: abilities cost next vote
  | 'CIRCLE_5_WRATH'      // Day 3: no abstain/skip
  | 'CIRCLE_6_HERESY'     // Night 3: dead role clue leak
  | 'CIRCLE_7_VIOLENCE'   // Day 4: cleaned lynch, hidden card
  | 'CIRCLE_8_FRAUD'      // Night 4: 50/50 blurred investigation results
  | 'CIRCLE_9_TREACHERY'; // Day 5: secret voting; Jester as Lucifer's Shadow victory condition

export interface HeresyLeakedClue {
  readonly clueId: string;
  readonly deadPlayerId: string;
  readonly clueText: string;
  readonly leakedAtRound: number;
}

export interface DantesInfernoCircleConfig {
  readonly circle: DanteCircle;
  readonly stepNumber: number; // 1 to 9
  readonly name: string;
  readonly activePhaseType: 'DAY' | 'NIGHT';
  readonly ruleDescription: string;
}

export interface DantesInfernoState {
  readonly currentCircle: DanteCircle;
  readonly completedCircles: readonly DanteCircle[];
  /** Lust circle: chance (0.0 - 1.0) that a night action deflects to an adjacent target */
  readonly deflectionRate: number;
  /** Gluttony circle: maximum characters allowed per message */
  readonly slowModeCharLimit: number;
  /** Greed circle: player IDs who expended their Day vote by using a Night ability */
  readonly greedVoteCostDebts: Readonly<Record<string, boolean>>;
  /** Wrath circle: abstain / skip button is disabled */
  readonly wrathNoAbstainEnforced: boolean;
  /** Heresy circle: accumulated dead player clue leaks */
  readonly heresyLeakedClues: readonly HeresyLeakedClue[];
  /** Violence circle: whether the lynched card was cleaned / masked */
  readonly violenceCleanedVictimIds: readonly string[];
  /** Fraud circle: whether investigation outcomes are blurred 50/50 */
  readonly fraudBlurActive: boolean;
  /** Treachery circle: secret ballot voting enabled */
  readonly treacherySecretVotingActive: boolean;
  /** Treachery circle: Jester becomes Lucifer's Shadow */
  readonly jesterLuciferShadowActive: boolean;
  readonly luciferShadowWinnerUserId: string | null;
}

export interface EarthStoodStillState {
  /** 0 to 12. Gort triggers planetary wipe at 12 */
  readonly doomsdayClockHours: number;
  /** True if Gort activated planetary wipe */
  readonly planetaryWipeTriggered: boolean;
  /** World freeze active: speech and actions paused */
  readonly worldFrozenActive: boolean;
  /** Whether Klaatu has already expended the single-use world freeze */
  readonly worldFrozenUsed: boolean;
  /** Player ID assigned as Klaatu */
  readonly klaatuPlayerId: string | null;
  /** Target selected by Gort for laser vaporisation */
  readonly gortTargetPlayerId: string | null;
}

export interface ValkyrieState {
  /** Current player holding the explosive briefcase */
  readonly briefcaseLocationPlayerId: string | null;
  /** Countdown timer before briefcase detonation */
  readonly fuseTimerDaysRemaining: number;
  /** Player ID of the Dictator target */
  readonly dictatorPlayerId: string;
  /** List of player IDs in the anti-regime conspiracy */
  readonly conspiratorPlayerIds: readonly string[];
  /** Whether the briefcase detonated */
  readonly briefcaseDetonated: boolean;
  /** Whether the Dictator was successfully assassinated */
  readonly dictatorAssassinated: boolean;
}

export interface StanfordPrisonState {
  /** Player IDs assigned to the Guard detachment */
  readonly guardPlayerIds: readonly string[];
  /** Player IDs assigned as Inmates */
  readonly inmatePlayerIds: readonly string[];
  /** 0 to 100: Reaches 100 triggers full prison riot */
  readonly revoltMeter: number;
  /** Player ID of the Warden */
  readonly wardenPlayerId: string;
  /** Undercover assassin hidden within the inmate population */
  readonly secretAssassinInmateId: string | null;
  /** Inmates currently placed in solitary confinement */
  readonly solitaryConfinementPlayerIds: readonly string[];
  readonly riotTriggered: boolean;
  /** Remaining sanctions guards can issue across the game (default 3) */
  readonly guardSanctionsRemaining: number;
}

export interface CatenaccioState {
  /** Defensive wall players who redirect or absorb incoming attacks */
  readonly defensiveWallPlayerIds: readonly string[];
  /** Secret sniper player ID capable of piercing defensive walls */
  readonly sniperPlayerId: string | null;
  /** Mapping of player IDs to remaining physical armor charges */
  readonly armorCharges: Readonly<Record<string, number>>;
  /** True if wall defense threshold has collapsed */
  readonly wallBreached: boolean;
}

export interface ChernobylState {
  /** Radiation dosage per player in mSv (userId -> accumulated mSv) */
  readonly radiationDosage: Readonly<Record<string, number>>;
  /** Player IDs currently occupying the fallout bunker (immune to ambient radiation) */
  readonly shelteredPlayerIds: readonly string[];
  /** Maximum number of simultaneous occupants permitted inside the bunker */
  readonly bunkerCapacity: number;
  /** Current ambient radiation output of the Exclusion Zone per round (e.g. 15 mSv) */
  readonly zoneContaminationLevel: number;
  /** Player IDs scheduled/cleansed by decontamination treatment (-50 mSv) */
  readonly decontaminatedPlayerIds: readonly string[];
  /** Player IDs who have accumulated >= lethalThreshold mSv and succumbed */
  readonly radiationCasualties: readonly string[];
  /** Lethal radiation threshold in mSv (defaults to 100) */
  readonly lethalThreshold: number;
  /** Player ID assigned as Likvidator / Dozimetrist */
  readonly liquidatorPlayerId?: string | null;
}

// === CYBERPUNK 2077: NEO-BAKU TYPES (M11) ===

export type CyberpunkGlitchEvent = 'NONE' | 'SIGNAL_SCRAMBLE' | 'FIREWALL_BREACH' | 'BLACKOUT_CYCLE';

export interface CyberpunkNeoBakuState {
  readonly gridIntegrity: number; // 0 to 100
  readonly isCyberOverdriveActive: boolean;
  readonly isSystemBlackout: boolean;
  readonly activeGlitchEvent: CyberpunkGlitchEvent;
  readonly glitchRoundsRemaining: number;
  readonly hackedPlayerVoteOverrides: Readonly<Record<string, string>>; // victimId -> forcedTargetId
  readonly cyberwareInventory: Readonly<Record<string, 'SUBDERMAL' | 'REFLEX' | 'EMP'>>;
  readonly nodeSpoofPairs: Readonly<Record<string, string>>; // infiltratorId -> spoofTargetId
  readonly corpoBribedPlayerIds: readonly string[];
  readonly gridIntegrityHistory: readonly number[];
}

// === BERMUDA TRIANGLE: GHOST FLEET TYPES (M12) ===

export type BermudaWeather = 'CALM_SEA' | 'FOG_OF_THE_VOID' | 'ELECTROMAGNETIC_STORM' | 'ROGUE_WAVE';

export interface BermudaTriangleState {
  readonly currentWeather: BermudaWeather;
  readonly weatherRoundsRemaining: number;
  readonly shipHullIntegrity: number; // 0 to 100
  readonly vanishedPlayerIds: readonly string[]; // unrevealed deaths (Vanished into the Mist)
  readonly revealedWreckageIds: readonly string[]; // salvaged deaths (Salvage Logbook)
  readonly cursedDrowningPlayerIds: readonly string[]; // pending delayed death from Abyssal Siren
  readonly stunnedPlayerIds: readonly string[]; // cannot vote due to Rogue Wave shock
  readonly ghostTelegramClues: readonly string[]; // 3-word telegram from dead chat
  readonly compassScrambleRate: number; // 0.0 to 1.0
}

export interface MinigameSubStates {
  readonly dantesInferno?: DantesInfernoState;
  readonly earthStoodStill?: EarthStoodStillState;
  readonly valkyrie?: ValkyrieState;
  readonly stanfordPrison?: StanfordPrisonState;
  readonly catenaccio?: CatenaccioState;
  readonly chernobyl?: ChernobylState;
  readonly cyberpunkNeoBaku?: CyberpunkNeoBakuState;
  readonly bermudaTriangle?: BermudaTriangleState;
}
