/**
 * Pure English (en) Comprehensive Localization Dictionary
 * Enterprise Mafia / Social Deduction Platform - Milestone 20 Vocabulary Overhaul
 */

import { GamePhase } from '../../types/game';
import { CoreFaction, AllInDistrict, CivicOfficeType, InnateTraitType, FormattedRoleDisplay, formatRoleDisplay } from '../../types/roles';
import { DanteCircle } from '../../types/minigames';
import { DeathCause } from '../../types/engine';

// === PHASE TRANSLATIONS ===
export const EN_PHASES: Readonly<Record<GamePhase, string>> = {
  LOBBY: 'Lobby',
  DAY_REGIONAL_CAUCUS: 'Day Discussion',
  DAY_CENTRAL_ASSEMBLY: 'Assembly Deliberation',
  DAY_VOTING: 'Trial Voting',
  TRIAL_DEFENSE: 'Defense Plea',
  NIGHT_BUFFER: 'Night Operations',
  ENDED: 'Game Over',
} as const;

// === FACTION TRANSLATIONS ===
export const EN_FACTIONS: Readonly<Record<CoreFaction, string>> = {
  TOWN: 'Town (Innocents)',
  MAFIA: 'Mafia Family',
  YAKUZA: 'Yakuza Syndicate',
  VOID_CULT: 'The Cult',
  NEUTRAL_KILLER: 'Neutral Killing',
  NEUTRAL_BENIGN: 'Neutral Benign',
  NEUTRAL_EVIL: 'Neutral Evil',
} as const;

// === DISTRICT TRANSLATIONS ===
export const EN_DISTRICTS: Readonly<Record<AllInDistrict, string>> = {
  ELITE: 'Elite Quarter',
  COMMERCIAL: 'Commercial Wharf',
  INDUSTRIAL: 'Industrial Zone',
} as const;

// === CIVIC OFFICE TRANSLATIONS ===
export const EN_CIVIC_OFFICES: Readonly<Record<CivicOfficeType, string>> = {
  MAYOR: 'City Mayor',
  CHIEF_PROSECUTOR: 'Chief Prosecutor',
  CHIEF_JUSTICE: 'High Court Judge',
  CENTRAL_BANKER: 'Central Banker',
  MEDIA_MOGUL: 'Media Mogul',
  PRISON_WARDEN: 'Prison Warden',
  POLICE_COMMISSIONER: 'Police Commissioner',
  CITY_SURGEON: 'City Surgeon',
  LABOR_UNION_BOSS: 'Labor Union Boss',
  DISTRICT_ARCHITECT: 'District Architect',
  CHIEF_FIRE_MARSHAL: 'Chief Fire Marshal',
  BLACK_MARKET_BROKER: 'Black Market Broker',
  PORT_AUTHORITY_DIRECTOR: 'Port Authority Director',
  PUBLIC_DEFENDER: 'Public Defender',
  CITY_INVESTIGATOR: 'City Investigator',
  CORONER: 'Chief Coroner',
  CHRONOS_DIRECTOR: 'Chronos Director',
  NECRO_BIOLOGIST: 'Necro Biologist',
} as const;

// === INNATE TRAIT TRANSLATIONS ===
export const EN_INNATE_TRAITS: Readonly<Record<InnateTraitType, string>> = {
  BULLETPROOF_VEST: 'Kevlar Vest (Bulletproof)',
  IRON_WILL: 'Iron Will',
  PHANTOM_STEP: 'Phantom Step',
  NIGHT_VISION: 'Night Vision',
  RETALIATION_FUSE: 'Retaliation Fuse',
  SILENCER_ATTACHMENT: 'Silencer Attachment',
  INSIDER_ACCESS: 'Insider Access',
  SURGICAL_RESILIENCE: 'Surgical Resilience',
  CONTRABAND_POCKET: 'Contraband Pocket',
  SHADOW_COMMUNICATION: 'Shadow Communication',
  FALSE_DOCUMENTATION: 'False Documentation',
  MARTYR_RESOLVE: 'Martyr Resolve',
  COLD_BLOODED: 'Cold Blooded',
  POISON_IMMUNITY: 'Poison Immunity',
  TIME_WARP_CORE: 'Time Warp Core',
  DEATH_DEFIANCE: 'Death Defiance',
} as const;

// === DANTE'S CIRCLES TRANSLATIONS ===
export const EN_DANTE_CIRCLES: Readonly<Record<DanteCircle, { name: string; rule: string }>> = {
  CIRCLE_1_LIMBO: {
    name: 'Circle 1: Limbo',
    rule: 'Open deliberation. No penalties apply. The calm before the inevitable storm.',
  },
  CIRCLE_2_LUST: {
    name: 'Circle 2: Lust',
    rule: '20% deflection rate. Night orders may randomly drift toward an adjacent player.',
  },
  CIRCLE_3_GLUTTONY: {
    name: 'Circle 3: Gluttony',
    rule: 'Slow-mode deliberation active. Chat messages are restricted to a maximum of 80 characters.',
  },
  CIRCLE_4_GREED: {
    name: 'Circle 4: Greed',
    rule: 'Night abilities cost day voting rights. Anyone executing an action forfeits their vote tomorrow.',
  },
  CIRCLE_5_WRATH: {
    name: 'Circle 5: Wrath',
    rule: 'Abstentions and skips are abolished! Verdicts are mandatory; ties trigger sudden-death execution.',
  },
  CIRCLE_6_HERESY: {
    name: 'Circle 6: Heresy',
    rule: 'Secrets of the dead leak out. An ethereal role clue from the graveyard is whispered to the town.',
  },
  CIRCLE_7_VIOLENCE: {
    name: 'Circle 7: Violence',
    rule: 'Purged execution. The condemned player’s role card is submerged in Phlegethon’s river of boiling blood.',
  },
  CIRCLE_8_FRAUD: {
    name: 'Circle 8: Fraud',
    rule: '50/50 clouded inquiry. Investigators are presented with two contradictory faction probabilities.',
  },
  CIRCLE_9_TREACHERY: {
    name: 'Circle 9: Treachery',
    rule: 'Blind voting on the frozen lake of Cocytus. The Jester ascends as Lucifer’s Shadow — hanging them yields instant solo victory!',
  },
} as const;

// === CAUSE OF DEATH TRANSLATIONS ===
export const EN_DEATH_CAUSES: Readonly<Record<DeathCause, string>> = {
  MAFIA_KILL: 'Assassinated in cold blood by the Mafia',
  YAKUZA_KILL: 'Executed in a ruthless Yakuza vendetta',
  VOID_CULT_SACRIFICE: 'Sacrificed in a dark Void Cult ritual',
  NEUTRAL_KILLER_KILL: 'Savagely eliminated by the Neutral Killer',
  RETALIATION_FUSE_COUNTER: 'Felled by a lethal Retaliation Fuse counterstrike',
  BODYGUARD_SACRIFICE: 'Noble Bodyguard sacrifice defending a citizen',
  BODYGUARD_COUNTER: 'Struck down by Bodyguard retaliation',
  RADIATION_SICKNESS: 'Succumbed to acute radiation poisoning',
  BRIEFCASE_DETONATION: 'Torn apart by briefcase bomb fragmentation',
  GORT_VAPORISATION: 'Disintegrated by Gort’s planetary laser beam',
  JESTER_REVENGE: 'Consumed by the haunting curse of Lucifer’s Shadow',
  CROSSFIRE: 'Caught in fatal crossfire between factions',
  LYNCH: 'Hanged at dawn by public Town verdict',
} as const;

// === ROLE NICKNAME & BASE ROLES (STRICT CONTRACT COMPLIANCE) ===
export const EN_STANDARD_ROLES: Readonly<Record<string, FormattedRoleDisplay>> = {
  INVESTIGATOR: formatRoleDisplay('Vergil', 'Investigator', 'Sheriff'),
  DOCTOR: formatRoleDisplay('Angel of Mercy', 'Doctor', 'Physician'),
  KILLER: formatRoleDisplay('Malebranche Devil', 'Killer', 'Mafia Hitman'),
  JESTER: formatRoleDisplay('Shadow of Lucifer', 'Jester', 'Madman'),
  ROLEBLOCKER: formatRoleDisplay('Illusionist', 'Roleblocker', 'Mesmerist'),
  BLACKMAILER: formatRoleDisplay('Blackmailer', 'Blackmailer', 'Extortionist'),
  PUPPETEER: formatRoleDisplay('Puppeteer', 'Puppeteer', 'Syndicate Accomplice'),
  MARTYR: formatRoleDisplay('Martyr', 'Martyr', 'Devout Soul'),
  CORONER: formatRoleDisplay('Pathologist', 'Coroner', 'Medical Examiner'),
  AMNESIAC: formatRoleDisplay('Amnesiac', 'Amnesiac', 'Identity Seeker'),
  VANILLA_TOWN: formatRoleDisplay('Innocent Soul', 'Vanilla Town', 'Civilian'),
  BODYGUARD: formatRoleDisplay('Bodyguard', 'Bodyguard', 'Protector'),
  DETECTIVE: formatRoleDisplay('Detective', 'Detective', 'Tracker'),
  VETERAN: formatRoleDisplay('Veteran', 'Veteran', 'Hardened Soldier'),
  FRAMER: formatRoleDisplay('Framer', 'Framer', 'Conspirator'),
  FORGER: formatRoleDisplay('Forger', 'Forger', 'Will Manipulator'),
  ARSONIST: formatRoleDisplay('Arsonist', 'Arsonist', 'Pyromaniac'),
  WITCH: formatRoleDisplay('Witch', 'Witch', 'Occult Controller'),
} as const;

// === GENERAL UI LABELS ===
export const EN_UI = {
  // Navigation & Header
  appTitle: 'TDV MAFIA',
  subtitle: 'Elite Online Mafia & Social Deduction Platform',
  gameModeDirectory: 'Game Modes & Role Packs Catalog',
  gameModeDescription: 'Select game modes adhering to platform tiers, waiver entitlements, and dual-key administrative authorizations.',
  launchLobby: 'Launch Lobby Instance',
  activeParticipants: 'Active Participants',
  currentPhase: 'Current Phase',
  round: 'Round',
  timeRemaining: 'Time Remaining',
  nightJitter: 'Anti-Deduction Timing Jitter',
  maxKillsPerNight: 'Night Kill Cap',
  disconnectedWarning: 'Warning: Player disconnected! 75-second AI takeover countdown initiated.',
  reconnectedNotice: 'Player reconnected. Authority seamlessly restored.',
  botControlledNotice: 'This seat is currently piloted by an AI Agent.',

  // Actions & Buttons
  vote: 'Cast Vote',
  retractVote: 'Retract Vote',
  accuse: 'Indict Suspect',
  defendSelf: 'Plead Defense',
  morningNewspaper: 'Morning Gazette',
  morningBulletin: 'MORNING BULLETIN',
  nightOrder: 'Night Order',
  confirm: 'Confirm',
  reject: 'Reject',
  skipOrAbstain: 'Abstain / Skip',
  mandatoryVoting: 'Mandatory Voting Enforced',
  blindVoting: 'Blind Voting (Cocytus Protocol)',
  blindVotingDesc: 'Votes remain completely concealed until the round concludes.',
  protect: 'Protect Target',
  investigate: 'Investigate',
  disrupt: 'Block / Disrupt',
  strike: 'Execute Strike',
  misdirect: 'Misdirect Action',
  frame: 'Frame Target',
  cooldownRemaining: 'Cooldown Remaining',

  // Statuses & Tones
  alive: 'Alive',
  eliminated: 'Eliminated',
  host: 'Host',
  hostWaiver: 'Host Waiver',
  adminWaiver: 'Admin Waiver',
  architect: 'The Architect',
  bailiff: 'The Bailiff',
  dualLockVerified: 'Dual-Lock Verified',
  dualLockRequired: 'Dual-Key Authorization Required',
  awaitingTurn: 'Awaiting Key Turn',
  turned: 'Key Turned',
  authorizeAsArchitect: 'Authorize as Architect',
  authorizeAsBailiff: 'Authorize as Bailiff',

  // Minigame terms
  briefcaseLocation: 'Briefcase Location',
  fuseCountdown: 'Fuse Countdown',
  revoltMeter: 'Revolt Index',
  doomsdayClock: 'Doomsday Clock',
  danteCircle: 'Circle of Hell',
  freezeWorld: 'Freeze the World (Klaatu Protocol)',
  worldFrozenActive: 'World Frozen! All night kills have been suspended tonight.',
  planetaryWipeWarning: 'DANGER: Planetary wipe triggered by Gort upon reaching 12 o’clock!',
  defensiveWall: 'Defensive Perimeter Armor',
  sniperAlert: 'Sniper In Position: Armor-piercing round incoming!',
  wallBreachedAlert: 'CRITICAL: Defensive Perimeter Fully Breached!',

  // Newspaper Headlines & Cleaned Status
  newspaperHeadlineDeaths: 'Casualties of the Midnight Fog',
  newspaperNoDeaths: 'Quiet night across the city: No casualties recorded.',
  cleanedBodyDescription: 'Body submerged in Phlegethon’s boiling waters; identity concealed.',
  heresyLeakedHeader: 'Circle VI: Whispers of Heresy',

  // All-In District Titles
  districtPlebiscite: 'District Caucus Primary',
  districtFinalists: 'Central Assembly Nominees',
  centralAssemblyVote: 'Central Assembly Final Verdict',
} as const;

// === BOT PERSONALITY TRANSLATIONS ===
export const EN_BOT_PERSONALITIES = {
  AGGRESSIVE_ACCUSER: {
    name: 'Aggressive Prosecutor',
    description: 'Relentlessly interrogates suspects, speaks with urgency and exclamation points, pushing immediate indictments.',
  },
  ANALYTICAL_DETECTIVE: {
    name: 'Cold Analytical Sleuth',
    description: 'Calm and methodical, quotes voting records, tracks timestamps, and calculates exact faction probabilities.',
  },
  QUIET_FOLLOWER: {
    name: 'Reserved Observer',
    description: 'Speaks sparingly, avoids drawing crosshairs, and cautiously aligns with majority consensus.',
  },
  ERRATIC_WILDCARD: {
    name: 'Erratic Wildcard',
    description: 'Unpredictable and dramatic, offers sarcastic quips, changes targets on gut feelings, and embraces chaos.',
  },
  SMOOTH_DEFENDER: {
    name: 'Loyal Defender',
    description: 'Diplomatic and de-escalating, shields the accused from hasty lynch mobs, insisting on concrete proof.',
  },
} as const;

// Helper to get localized role name safely
export function getLocalizedRoleDisplay(roleKey: keyof typeof EN_STANDARD_ROLES): FormattedRoleDisplay {
  return EN_STANDARD_ROLES[roleKey];
}
