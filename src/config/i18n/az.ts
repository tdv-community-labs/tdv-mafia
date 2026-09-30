/**
 * Pure Azerbaijani (az) Comprehensive Localization Dictionary
 * Enterprise Mafia / Social Deduction Platform - Phase 4
 */

import { GamePhase } from '../../types/game';
import { CoreFaction, AllInDistrict, CivicOfficeType, InnateTraitType, FormattedRoleDisplay, formatRoleDisplay } from '../../types/roles';
import { DanteCircle } from '../../types/minigames';
import { DeathCause } from '../../types/engine';
import { GameMode } from '../../types/packs';

// === PHASE TRANSLATIONS ===
export const AZ_PHASES: Readonly<Record<GamePhase, string>> = {
  LOBBY: 'Gözləmə Otağı',
  DAY_REGIONAL_CAUCUS: 'Regional Məclis (Rayon Palatası)',
  DAY_CENTRAL_ASSEMBLY: 'Mərkəzi Parlament İclası',
  DAY_VOTING: 'Ümumşəhər Məhkəməsi & Səsvermə',
  NIGHT_BUFFER: 'Qaranlıq Gecə (Gizli Əməliyyatlar)',
  ENDED: 'Oyun Başa Çatdı',
} as const;

// === FACTION TRANSLATIONS ===
export const AZ_FACTIONS: Readonly<Record<CoreFaction, string>> = {
  TOWN: 'Şəhər İttifaqı',
  MAFIA: 'Mafiya',
  YAKUZA: 'Yakuza',
  VOID_CULT: 'Boşluq Təriqəti',
  NEUTRAL_KILLER: 'Müstəqil Qatil',
  NEUTRAL_BENIGN: 'Zərərsiz Neytral',
  NEUTRAL_EVIL: 'Xaos Tərəfdarı',
} as const;

// === DISTRICT TRANSLATIONS ===
export const AZ_DISTRICTS: Readonly<Record<AllInDistrict, string>> = {
  ELITE: 'Zadəgan Kvartalı',
  COMMERCIAL: 'Ticarət Limanı',
  INDUSTRIAL: 'Sənaye Zonası',
} as const;

// === CIVIC OFFICE TRANSLATIONS ===
export const AZ_CIVIC_OFFICES: Readonly<Record<CivicOfficeType, string>> = {
  MAYOR: 'Bələdiyyə Sədri',
  CHIEF_PROSECUTOR: 'Baş Prokuror',
  CHIEF_JUSTICE: 'Ali Hakim',
  CENTRAL_BANKER: 'Mərkəzi Bankir',
  MEDIA_MOGUL: 'Media Maqnatı',
  PRISON_WARDEN: 'Həbsxana Rəisi',
  POLICE_COMMISSIONER: 'Polis Komissarı',
  CITY_SURGEON: 'Şəhər Cərrahı',
  LABOR_UNION_BOSS: 'Həmkarlar İttifaqı Rəhbəri',
  DISTRICT_ARCHITECT: 'Kvartal Memarı',
  CHIEF_FIRE_MARSHAL: 'Baş Yanğınsöndürən',
  BLACK_MARKET_BROKER: 'Qara Bazar Dəllalı',
  PORT_AUTHORITY_DIRECTOR: 'Liman Rəisi',
  PUBLIC_DEFENDER: 'İctimai Vəkil',
  CITY_INVESTIGATOR: 'Şəhər Müstəntiqi',
  CORONER: 'Məhkəmə Eksperti',
  CHRONOS_DIRECTOR: 'Zaman Səyyahı',
  NECRO_BIOLOGIST: 'Nekromant Alim',
} as const;

// === INNATE TRAIT TRANSLATIONS ===
export const AZ_INNATE_TRAITS: Readonly<Record<InnateTraitType, string>> = {
  BULLETPROOF_VEST: 'Gülləkeçirməz Jilet',
  PHANTOM_STEP: 'Kabus Addımı',
  RETALIATION_FUSE: 'Qisas Qoruyucusu',
  SILENCER_ATTACHMENT: 'Səsboğucu Qurğu',
  INSIDER_ACCESS: 'Daxili Giriş İcazəsi',
  SURGICAL_RESILIENCE: 'Cərrahi Dözümlülük',
  CONTRABAND_POCKET: 'Qaçaqmal Cibi',
  SHADOW_COMMUNICATION: 'Kölgə Əlaqəsi',
  FALSE_DOCUMENTATION: 'Saxta Sənədlər',
  MARTYR_RESOLVE: 'Şəhid Əzmi',
  COLD_BLOODED: 'Soyuqqanlı',
  POISON_IMMUNITY: 'Zəhər İmmuniteti',
  TIME_WARP_CORE: 'Zaman Nüvəsi',
  DEATH_DEFIANCE: 'Ölümə Meydan Oxuyan',
} as const;

// === DANTE'S CIRCLES TRANSLATIONS ===
export const AZ_DANTE_CIRCLES: Readonly<Record<DanteCircle, { name: string; rule: string }>> = {
  CIRCLE_1_LIMBO: {
    name: 'I Dairə: Limbo',
    rule: 'Açıq müzakirə. Heç bir əlavə qadağa yoxdur. Fırtına öncəsi sakitlik.',
  },
  CIRCLE_2_LUST: {
    name: 'II Dairə: Şəhvət',
    rule: '20% yayınma dərəcəsi. Gecə hədəflənən əmrlərin qonşu oyunçuya yayınma ehtimalı var.',
  },
  CIRCLE_3_GLUTTONY: {
    name: 'III Dairə: Tamahkarlıq',
    rule: 'Yavaş rejimli söhbət məhdudiyyəti. Mesajlar maksimum 80 simvolla məhdudlaşdırılır.',
  },
  CIRCLE_4_GREED: {
    name: 'IV Dairə: Xəsislik',
    rule: 'Gecə bacarığı gündüz səsi bahasına başa gəlir. Bacarıq istifadə edənlər növbəti gün səs hüququnu itirir.',
  },
  CIRCLE_5_WRATH: {
    name: 'V Dairə: Qəzəb',
    rule: 'Bitərəf və Keç ləğv edilir! Hökm məcburidir; bərabərlik halında qəfil ölüm mərhələsi başlayır.',
  },
  CIRCLE_6_HERESY: {
    name: 'VI Dairə: Küfr',
    rule: 'Ölülərin sirri açılır. Məzarlıqdan vəfat etmiş ruhun gizli rol ipucu şəhərə sızır.',
  },
  CIRCLE_7_VIOLENCE: {
    name: 'VII Dairə: Zorakılıq',
    rule: 'Təmizlənmiş edam. Edam edilən şəxsin rol kartı gizlədilir ("Cəsəd Flageleton qan çayında batırıldı").',
  },
  CIRCLE_8_FRAUD: {
    name: 'VIII Dairə: Fırıldaq',
    rule: '50/50 dumanlı təhqiqat. Müstəntiqlərə iki ziddiyyətli fraksiya ehtimalı təqdim edilir.',
  },
  CIRCLE_9_TREACHERY: {
    name: 'IX Dairə: Xəyanət',
    rule: 'Gizli səsvermə (Kokit gölü). Dəli Lusiferin Kölgəsi olaraq yüksəlir; edam edilsə təkbaşına qalib gəlir!',
  },
} as const;

// === CAUSE OF DEATH TRANSLATIONS ===
export const AZ_DEATH_CAUSES: Readonly<Record<DeathCause, string>> = {
  MAFIA_KILL: 'Mafiya Sui-qəsdi',
  YAKUZA_KILL: 'Yakuza Qisası',
  VOID_CULT_SACRIFICE: 'Boşluq Təriqətinin Qurbanı',
  NEUTRAL_KILLER_KILL: 'Müstəqil Qatil Zərbəsi',
  RETALIATION_FUSE_COUNTER: 'Qisas Qoruyucusunun Əks-zərbəsi',
  BRIEFCASE_DETONATION: 'Partlayıcı Çantanın Qəlpələnməsi',
  GORT_VAPORISATION: 'Qortun Planetar Lazer Buxarlandırması',
  JESTER_REVENGE: 'Lusiferin Kölgəsinin Lənəti',
  CROSSFIRE: 'Çarpaz Atəş Qurbanı',
  LYNCH: 'Xalq İttihamı ilə Edam',
} as const;

// === ROLE NICKNAME & BASE ROLES (STRICT CONTRACT COMPLIANCE) ===
export const AZ_STANDARD_ROLES: Readonly<Record<string, FormattedRoleDisplay>> = {
  INVESTIGATOR: formatRoleDisplay('Vergili', 'Investigator', 'Şərif'),
  DOCTOR: formatRoleDisplay('Mərhəmət Mələyi', 'Doctor', 'Həkim'),
  KILLER: formatRoleDisplay('Malebranche İblisi', 'Killer', 'Mafiya'),
  JESTER: formatRoleDisplay('Lusiferin Kölgəsi', 'Jester', 'Dəli'),
  ROLEBLOCKER: formatRoleDisplay('Gözbağlayıcı', 'Roleblocker', 'İllüziyaçı'),
  BLACKMAILER: formatRoleDisplay('Şantajçı', 'Blackmailer', 'Paparassi'),
  PUPPETEER: formatRoleDisplay('Kuklaçı', 'Puppeteer', 'Qatil Əməkdaşı'),
  MARTYR: formatRoleDisplay('Fədai', 'Martyr', 'Məsum Şəhid'),
  CORONER: formatRoleDisplay('Pataloqanatom', 'Coroner', 'Məhkəmə Eksperti'),
  AMNESIAC: formatRoleDisplay('Yaddaşsız', 'Amnesiac', 'Kimlik Axtaran'),
  VANILLA_TOWN: formatRoleDisplay('Günahkar Ruh', 'Vanilla Town', 'Sıravi Vətəndaş'),
  BODYGUARD: formatRoleDisplay('Cangüdən', 'Bodyguard', 'Mühafizəçi'),
  DETECTIVE: formatRoleDisplay('Xəfiyyə', 'Detective', 'İzləyici'),
  VETERAN: formatRoleDisplay('Qazi', 'Veteran', 'Qisasçı Əsgər'),
  FRAMER: formatRoleDisplay('Şər Atan', 'Framer', 'Tələquran'),
  FORGER: formatRoleDisplay('Saxtakar', 'Forger', 'Vəsiyyət Dəyişən'),
  ARSONIST: formatRoleDisplay('Yandırıcı', 'Arsonist', 'Pirotexnik'),
  WITCH: formatRoleDisplay('Cadugər', 'Witch', 'Ruh İdarəçisi'),
} as const;

// === GENERAL UI LABELS ===
export const AZ_UI = {
  // Navigation & Header
  appTitle: 'TDV MAFIA',
  subtitle: 'Elit Onlayn Mafiya & Sosial Deduksiya Platforması',
  gameModeDirectory: 'Oyun Rejimləri & Paket Kataloqu',
  gameModeDescription: 'Platforma dərəcələrinə, güzəşt icazələrinə və cüt açarlı inzibati təsdiqlərə uyğun oyun rejimi seçin.',
  launchLobby: 'Otaq İnstansiyasını Başlat',
  activeParticipants: 'Aktiv İştirakçılar',
  currentPhase: 'Cari Mərhələ',
  round: 'Raund',
  timeRemaining: 'Qalan Vaxt',
  nightJitter: 'Anti-Deduksiya Gecikməsi (Jitter)',
  maxKillsPerNight: 'Maksimum Qətl Həddi',
  disconnectedWarning: 'Diqqət: Oyunçu bağlantısı kəsildi! 75 saniyəlik süni intellekt təhvil taymeri işə düşdü.',
  reconnectedNotice: 'Oyunçu yenidən qoşuldu. Səlahiyyət bərpa edildi.',
  botControlledNotice: 'Bu oyunçu hazırda Gemini Bot tərəfindən idarə olunur.',

  // Actions & Buttons
  vote: 'Səs Ver',
  retractVote: 'Səsi Geri Götür',
  accuse: 'İttiham Et',
  defendSelf: 'Özünü Müdafiə',
  morningNewspaper: 'Səhər Qəzeti',
  morningBulletin: 'SƏHƏR BÜLLETENİ',
  nightOrder: 'Gecə Əmri',
  confirm: 'Qəbul Et',
  reject: 'Rədd Et',
  skipOrAbstain: 'Bitərəf / Keç',
  mandatoryVoting: 'Məcburi Səsvermə Aktivdir',
  blindVoting: 'Gizli Səsvermə (Kokit Rejimi)',
  blindVotingDesc: 'Səslər mərhələ bağlanana qədər gizli saxlanılır.',
  protect: 'Mühafizə Et',
  investigate: 'Təhqiqat Apar',
  disrupt: 'Zərərsizləşdir (Gözbağla)',
  strike: 'Qəsd Et',
  misdirect: 'Yayınma Yarat',
  frame: 'Tələ Qur (Şər At)',
  cooldownRemaining: 'Yenidən yüklənmə',

  // Statuses & Tones
  alive: 'Canlı',
  eliminated: 'Qətlə Yetirilib',
  host: 'Host',
  hostWaiver: 'Host Güzəşti',
  adminWaiver: 'Admin Güzəşti',
  architect: 'Memar (The Architect)',
  bailiff: 'Məhkəmə İcraçısı (The Bailiff)',
  dualLockVerified: 'Cüt Kilid Təsdiqləndi',
  dualLockRequired: 'Cüt Açarlı Təsdiq Tələb Olunur',
  awaitingTurn: 'Dönüş Gözlənilir',
  turned: 'Açar Açıldı',
  authorizeAsArchitect: 'Memar Kimi Təsdiq Et',
  authorizeAsBailiff: 'İcraçı Kimi Təsdiq Et',

  // Minigame terms
  briefcaseLocation: 'Çantanın Yeri',
  fuseCountdown: 'Partlayıcı Fitili',
  revoltMeter: 'Qiyam Göstəricisi',
  doomsdayClock: 'Qiyamət Saatı',
  danteCircle: 'Dantenin Dairəsi',
  freezeWorld: 'Dünyanı Dondur (Klaatu Bacarığı)',
  worldFrozenActive: 'Dünya Dondurulub! Bu gecə bütün qətllər dayandırılıb.',
  planetaryWipeWarning: 'TƏHLÜKƏ: Qiyamət saatı 12-yə çatdıqda Qort planetar məhvi işə salacaq!',
  defensiveWall: 'Müdafiə Səddi Zirehi',
  sniperAlert: 'Snayper Qapıda: Zirehkeçirən atəş gözlənilir!',
  wallBreachedAlert: 'DİQQƏT: Müdafiə Səddi Tamamilə Yarıldı!',

  // Newspaper Headlines & Cleaned Status
  newspaperHeadlineDeaths: 'Qaranlıq Gecənin İtkiləri',
  newspaperNoDeaths: 'Şəhərdə sakit gecə: Heç bir itki qeydə alınmadı.',
  cleanedBodyDescription: 'Cəsəd Flageleton qan çayında batırıldı, kimliyi naməlumdur.',
  heresyLeakedHeader: 'VI Dairə: Küfrün Səsi',

  // All-In District Titles
  districtPlebiscite: 'Kvartal İlkin Səsverməsi',
  districtFinalists: 'Mərkəzi Parlamentə Yüksələn Namizədlər',
  centralAssemblyVote: 'Mərkəzi Parlament Yekun Hökmü',
} as const;

// Helper to get localized role name safely
export function getLocalizedRoleDisplay(roleKey: keyof typeof AZ_STANDARD_ROLES): FormattedRoleDisplay {
  return AZ_STANDARD_ROLES[roleKey];
}
