/**
 * Role Loadout Balancer & Preset Engine (Milestone 9)
 *
 * Enforces mathematical balance invariants:
 * - Killer Factions: MAFIA, YAKUZA, VOID_CULT, NEUTRAL_KILLER
 * - Strict Invariant: Killer Ratio <= 35% (0.35) across all presets and scales.
 * - Supported Presets: STANDARD, ASYMMETRIC, CHAOS, ALL_IN_40P.
 * - Complete 3-Layer Composite Identities for All-In (Faction + Civic Office + Innate Trait + District).
 */

import {
  CoreFaction,
  CivicOfficeType,
  InnateTraitType,
  AllInDistrict,
  AllInPlayerIdentity,
  formatRoleDisplay,
} from '../../types/roles';
import { LobbyState, PlayerSession } from '../../types/game';

export type LoadoutPresetId = 'STANDARD' | 'ASYMMETRIC' | 'CHAOS' | 'ALL_IN_40P';

export const MAX_KILLER_RATIO = 0.35; // Maximum allowed killer ratio: <= 35%

/** All 16 Civic Offices defined in Phase 1 Architecture */
export const ALL_CIVIC_OFFICES: readonly CivicOfficeType[] = [
  'MAYOR',
  'CHIEF_PROSECUTOR',
  'CHIEF_JUSTICE',
  'CENTRAL_BANKER',
  'MEDIA_MOGUL',
  'PRISON_WARDEN',
  'POLICE_COMMISSIONER',
  'CITY_SURGEON',
  'LABOR_UNION_BOSS',
  'DISTRICT_ARCHITECT',
  'CHIEF_FIRE_MARSHAL',
  'BLACK_MARKET_BROKER',
  'PORT_AUTHORITY_DIRECTOR',
  'PUBLIC_DEFENDER',
  'CITY_INVESTIGATOR',
  'CORONER',
];

/** 12 Innate Traits defined in Phase 1 Architecture */
export const ALL_INNATE_TRAITS: readonly InnateTraitType[] = [
  'BULLETPROOF_VEST',
  'IRON_WILL',
  'PHANTOM_STEP',
  'NIGHT_VISION',
  'RETALIATION_FUSE',
  'SILENCER_ATTACHMENT',
  'INSIDER_ACCESS',
  'SURGICAL_RESILIENCE',
  'CONTRABAND_POCKET',
  'SHADOW_COMMUNICATION',
  'FALSE_DOCUMENTATION',
  'MARTYR_RESOLVE',
];

export const ALL_DISTRICTS: readonly AllInDistrict[] = ['ELITE', 'COMMERCIAL', 'INDUSTRIAL'];

export interface RoleDeckCard {
  readonly nickname: string;
  readonly baseRoleName: string;
  readonly localizedRoleName: string;
  readonly faction: CoreFaction;
  readonly office: CivicOfficeType;
  readonly trait: InnateTraitType;
}

export interface KillerRatioValidation {
  readonly valid: boolean;
  readonly killerRatio: number;
  readonly killerCount: number;
  readonly nonKillerCount: number;
  readonly totalCount: number;
  readonly maxAllowedKillers: number;
  readonly reason?: string;
}

/** Determines if a faction possesses lethal night kill capabilities */
export function isKillerFaction(faction: CoreFaction): boolean {
  return (
    faction === 'MAFIA' ||
    faction === 'YAKUZA' ||
    faction === 'VOID_CULT' ||
    faction === 'NEUTRAL_KILLER'
  );
}

/**
 * Validates that the killer ratio does not exceed the 35% cap.
 * Uses a small epsilon for floating-point tolerance (35.001%).
 */
export function validateKillerRatio(factions: CoreFaction[]): KillerRatioValidation {
  const totalCount = factions.length;
  if (totalCount === 0) {
    return {
      valid: true,
      killerRatio: 0,
      killerCount: 0,
      nonKillerCount: 0,
      totalCount: 0,
      maxAllowedKillers: 0,
    };
  }

  const killerCount = factions.filter(isKillerFaction).length;
  const nonKillerCount = totalCount - killerCount;
  const killerRatio = killerCount / totalCount;
  const maxAllowedKillers = Math.floor(totalCount * MAX_KILLER_RATIO);
  const valid = killerRatio <= MAX_KILLER_RATIO + 0.0001;

  return {
    valid,
    killerRatio,
    killerCount,
    nonKillerCount,
    totalCount,
    maxAllowedKillers,
    reason: valid
      ? undefined
      : `Killer ratio ${(killerRatio * 100).toFixed(1)}% exceeds maximum permitted threshold of 35.0% (${killerCount}/${totalCount} killers, max allowed is ${maxAllowedKillers})`,
  };
}

/**
 * Generates a balanced deck of roles based on the requested preset and player count.
 * Uses exact two-pool construction (killerBudget + nonKillerBudget = playerCount)
 * to guarantee that killer ratio <= 35% holds without clipping or over-allocation.
 */
export function generateBalancedDeck(
  presetId: LoadoutPresetId,
  playerCount: number
): RoleDeckCard[] {
  if (playerCount <= 0) return [];

  // Mathematical invariant: killerBudget = floor(playerCount * 0.35)
  // For standard social deduction games, ensure at least 1 killer if playerCount >= 3
  const killerBudget = Math.min(
    Math.floor(playerCount * MAX_KILLER_RATIO),
    Math.max(1, Math.floor(playerCount * MAX_KILLER_RATIO))
  );
  const nonKillerBudget = playerCount - killerBudget;

  const killerCards: RoleDeckCard[] = [];
  const nonKillerCards: RoleDeckCard[] = [];

  const createCard = (
    nickname: string,
    base: string,
    az: string,
    faction: CoreFaction,
    office: CivicOfficeType = 'PUBLIC_DEFENDER',
    trait: InnateTraitType = 'PHANTOM_STEP'
  ): RoleDeckCard => ({
    nickname,
    baseRoleName: base,
    localizedRoleName: az,
    faction,
    office,
    trait,
  });

  if (presetId === 'ALL_IN_40P' || playerCount >= 35) {
    // 40-Player All-In Composition: Exactly 14 Killers (35.0%) and 26 Non-Killers (65.0%)
    // 14 Killers: 8 Mafia, 3 Yakuza, 2 Void Cult, 1 Neutral Killer
    // 26 Non-Killers: 20 Town, 2 Neutral Benign, 4 Neutral Evil

    // 1. Mafia (8 killers)
    killerCards.push(createCard('Don Corleone', 'Godfather', 'Don (Mafiya Rəhbəri)', 'MAFIA', 'CHIEF_PROSECUTOR', 'SHADOW_COMMUNICATION'));
    killerCards.push(createCard('Silvio', 'Mafioso', 'İcraçı Qatil', 'MAFIA', 'PUBLIC_DEFENDER', 'SILENCER_ATTACHMENT'));
    killerCards.push(createCard('Paulie', 'Framer', 'Şərr Atan', 'MAFIA', 'MEDIA_MOGUL', 'FALSE_DOCUMENTATION'));
    killerCards.push(createCard('Luigi', 'Consort', 'Gözbağlayıcı', 'MAFIA', 'BLACK_MARKET_BROKER', 'INSIDER_ACCESS'));
    killerCards.push(createCard('Vito', 'Enforcer', 'Quldur', 'MAFIA', 'PRISON_WARDEN', 'COLD_BLOODED' as any));
    killerCards.push(createCard('Sal', 'Blackmailer', 'Şantajçı', 'MAFIA', 'MEDIA_MOGUL', 'CONTRABAND_POCKET'));
    killerCards.push(createCard('Sonny', 'Hitman', 'Muzdlu Qatil', 'MAFIA', 'PORT_AUTHORITY_DIRECTOR', 'RETALIATION_FUSE'));
    killerCards.push(createCard('Fredo', 'Underboss', 'Kölgə Əməkdaşı', 'MAFIA', 'CENTRAL_BANKER', 'PHANTOM_STEP'));

    // 2. Yakuza (3 killers)
    killerCards.push(createCard('Kumicho', 'Yakuza_Boss', 'Yakuza Lideri', 'YAKUZA', 'LABOR_UNION_BOSS', 'IRON_WILL'));
    killerCards.push(createCard('Wakagashira', 'Yakuza_Enforcer', 'Yakuza İcraçısı', 'YAKUZA', 'PORT_AUTHORITY_DIRECTOR', 'MARTYR_RESOLVE'));
    killerCards.push(createCard('Shatei', 'Yakuza_Assassin', 'Yakuza Qatili', 'YAKUZA', 'PUBLIC_DEFENDER', 'SILENCER_ATTACHMENT'));

    // 3. Void Cult (2 killers)
    killerCards.push(createCard('Void Prophet', 'Void_Cultist', 'Zülmət Peyğəmbəri', 'VOID_CULT', 'DISTRICT_ARCHITECT', 'TIME_WARP_CORE' as any));
    killerCards.push(createCard('Abyssal Shade', 'Void_Acolyte', 'Qaranlıq Mürid', 'VOID_CULT', 'PUBLIC_DEFENDER', 'PHANTOM_STEP'));

    // 4. Neutral Killer (1 killer)
    killerCards.push(createCard('Shadow Reaper', 'SerialKiller', 'Manyak (Serial Killer)', 'NEUTRAL_KILLER', 'CORONER', 'DEATH_DEFIANCE' as any));

    // Non-Killers: Neutrals (6 non-killers)
    nonKillerCards.push(createCard('The Fool', 'Jester', 'Dəli (Jester)', 'NEUTRAL_EVIL', 'PUBLIC_DEFENDER', 'RETALIATION_FUSE'));
    nonKillerCards.push(createCard('Shadow Witch', 'Witch', 'Cadugər', 'NEUTRAL_EVIL', 'BLACK_MARKET_BROKER', 'INSIDER_ACCESS'));
    nonKillerCards.push(createCard('Bounty Hunter', 'Executioner', 'Cəllad', 'NEUTRAL_EVIL', 'CHIEF_JUSTICE', 'IRON_WILL'));
    nonKillerCards.push(createCard('Doomsayer', 'Doomsayer', 'Məşum Falçı', 'NEUTRAL_EVIL', 'MEDIA_MOGUL', 'FALSE_DOCUMENTATION'));
    nonKillerCards.push(createCard('Wandering Ghost', 'Amnesiac', 'Yaddaşını İtirən', 'NEUTRAL_BENIGN', 'PUBLIC_DEFENDER', 'PHANTOM_STEP'));
    nonKillerCards.push(createCard('Iron Hermit', 'Survivor', 'Sağ Qalan', 'NEUTRAL_BENIGN', 'PUBLIC_DEFENDER', 'BULLETPROOF_VEST'));

    // Town Vanguard & Officers (14 initial Town non-killers)
    nonKillerCards.push(createCard('Bələdiyyə Sədri', 'Mayor', 'Bələdiyyə Sədri', 'TOWN', 'MAYOR', 'IRON_WILL'));
    nonKillerCards.push(createCard('Baş Hakim', 'Chief_Justice', 'Baş Hakim', 'TOWN', 'CHIEF_JUSTICE', 'INSIDER_ACCESS'));
    nonKillerCards.push(createCard('Baş Müstəntiq', 'Investigator', 'Baş Müstəntiq', 'TOWN', 'CITY_INVESTIGATOR', 'NIGHT_VISION'));
    nonKillerCards.push(createCard('Şərif', 'Sheriff', 'Şərif', 'TOWN', 'POLICE_COMMISSIONER', 'NIGHT_VISION'));
    nonKillerCards.push(createCard('Həkim Cərrah', 'Doctor', 'Baş Cərrah', 'TOWN', 'CITY_SURGEON', 'SURGICAL_RESILIENCE'));
    nonKillerCards.push(createCard('Cangüdən', 'Bodyguard', 'Cangüdən', 'TOWN', 'PUBLIC_DEFENDER', 'MARTYR_RESOLVE'));
    nonKillerCards.push(createCard('Yanğın Rəisi', 'Fire_Marshal', 'Yanğın Rəisi', 'TOWN', 'CHIEF_FIRE_MARSHAL', 'PHANTOM_STEP'));
    nonKillerCards.push(createCard('Məhkəmə Eksperti', 'Coroner', 'Pataloqanatom', 'TOWN', 'CORONER', 'INSIDER_ACCESS'));
    nonKillerCards.push(createCard('Bankir', 'Banker', 'Mərkəzi Bankir', 'TOWN', 'CENTRAL_BANKER', 'CONTRABAND_POCKET'));
    nonKillerCards.push(createCard('Həmkarlar Sədri', 'Union_Leader', 'Həmkarlar Lideri', 'TOWN', 'LABOR_UNION_BOSS', 'IRON_WILL'));
    nonKillerCards.push(createCard('Memar', 'Architect', 'Şəhər Memarı', 'TOWN', 'DISTRICT_ARCHITECT', 'FALSE_DOCUMENTATION'));
    nonKillerCards.push(createCard('Qazi Mühafizəçi', 'Veteran', 'Qazi', 'TOWN', 'PRISON_WARDEN', 'RETALIATION_FUSE'));
    nonKillerCards.push(createCard('Nəzarətçi', 'Lookout', 'Gözətçi', 'TOWN', 'PORT_AUTHORITY_DIRECTOR', 'NIGHT_VISION'));
    nonKillerCards.push(createCard('Detektiv', 'Detective', 'Xəfiyyə', 'TOWN', 'CITY_INVESTIGATOR', 'NIGHT_VISION'));

    // Remaining Town Citizens up to nonKillerBudget
    while (nonKillerCards.length < nonKillerBudget) {
      const idx = nonKillerCards.length + 1;
      nonKillerCards.push(
        createCard(
          `Vətəndaş ${idx}`,
          'Citizen',
          'Məsum Vətəndaş',
          'TOWN',
          ALL_CIVIC_OFFICES[idx % ALL_CIVIC_OFFICES.length],
          ALL_INNATE_TRAITS[idx % ALL_INNATE_TRAITS.length]
        )
      );
    }
  } else if (presetId === 'ASYMMETRIC') {
    // Multi-faction competition (Mafia vs Yakuza) bounded by killerBudget
    const mafiaCount = Math.max(1, Math.ceil(killerBudget * 0.6));
    const yakuzaCount = Math.max(0, killerBudget - mafiaCount);

    for (let i = 0; i < mafiaCount; i++) {
      killerCards.push(
        createCard(`Mafiya ${i + 1}`, 'Mafioso', 'İcraçı Qatil', 'MAFIA', 'CHIEF_PROSECUTOR', 'SHADOW_COMMUNICATION')
      );
    }
    for (let i = 0; i < yakuzaCount; i++) {
      killerCards.push(
        createCard(`Yakuza ${i + 1}`, 'Yakuza_Boss', 'Yakuza İcraçısı', 'YAKUZA', 'LABOR_UNION_BOSS', 'IRON_WILL')
      );
    }

    // Non-Killers Pool
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Şərif', 'Investigator', 'Şərif', 'TOWN', 'CITY_INVESTIGATOR', 'NIGHT_VISION'));
    }
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Həkim', 'Doctor', 'Həkim', 'TOWN', 'CITY_SURGEON', 'SURGICAL_RESILIENCE'));
    }
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Gözbağlayıcı', 'Blocker', 'Sirena / Gözbağlayıcı', 'TOWN', 'CHIEF_FIRE_MARSHAL', 'PHANTOM_STEP'));
    }
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Bələdiyyə Sədri', 'Mayor', 'Bələdiyyə Sədri', 'TOWN', 'MAYOR', 'IRON_WILL'));
    }
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Cangüdən', 'Bodyguard', 'Cangüdən', 'TOWN', 'PUBLIC_DEFENDER', 'MARTYR_RESOLVE'));
    }
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Dəli', 'Jester', 'Dəli (Jester)', 'NEUTRAL_EVIL', 'PUBLIC_DEFENDER', 'RETALIATION_FUSE'));
    }

    while (nonKillerCards.length < nonKillerBudget) {
      const idx = nonKillerCards.length + 1;
      nonKillerCards.push(createCard(`Vətəndaş ${idx}`, 'Citizen', 'Məsum Vətəndaş', 'TOWN', 'PUBLIC_DEFENDER', 'BULLETPROOF_VEST'));
    }
  } else if (presetId === 'CHAOS') {
    // Chaos: Serial Killer + Mafia
    if (killerBudget === 1) {
      killerCards.push(createCard('Manyak', 'SerialKiller', 'Manyak', 'NEUTRAL_KILLER', 'CORONER', 'DEATH_DEFIANCE' as any));
    } else {
      const mafiaCount = killerBudget - 1;
      for (let i = 0; i < mafiaCount; i++) {
        killerCards.push(createCard(`Mafiya ${i + 1}`, 'Mafioso', 'İcraçı Qatil', 'MAFIA', 'MEDIA_MOGUL', 'SILENCER_ATTACHMENT'));
      }
      killerCards.push(createCard('Manyak', 'SerialKiller', 'Manyak', 'NEUTRAL_KILLER', 'CORONER', 'DEATH_DEFIANCE' as any));
    }

    // Non-Killers Pool
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Dəli', 'Jester', 'Dəli (Jester)', 'NEUTRAL_EVIL', 'PUBLIC_DEFENDER', 'RETALIATION_FUSE'));
    }
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Cadugər', 'Witch', 'Cadugər', 'NEUTRAL_EVIL', 'BLACK_MARKET_BROKER', 'INSIDER_ACCESS'));
    }
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Şərif', 'Investigator', 'Şərif', 'TOWN', 'CITY_INVESTIGATOR', 'NIGHT_VISION'));
    }
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Həkim', 'Doctor', 'Həkim', 'TOWN', 'CITY_SURGEON', 'SURGICAL_RESILIENCE'));
    }
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Qazi', 'Veteran', 'Qazi', 'TOWN', 'PRISON_WARDEN', 'RETALIATION_FUSE'));
    }

    while (nonKillerCards.length < nonKillerBudget) {
      const idx = nonKillerCards.length + 1;
      nonKillerCards.push(createCard(`Vətəndaş ${idx}`, 'Citizen', 'Məsum Vətəndaş', 'TOWN', 'PUBLIC_DEFENDER', 'PHANTOM_STEP'));
    }
  } else {
    // STANDARD Preset: Classic social deduction (Mafia vs Town)
    for (let i = 0; i < killerBudget; i++) {
      const isDon = i === 0;
      killerCards.push(
        createCard(
          isDon ? 'Don' : `Mafiya ${i + 1}`,
          isDon ? 'Godfather' : 'Mafioso',
          isDon ? 'Mafiya Rəhbəri' : 'İcraçı Qatil',
          'MAFIA',
          'PUBLIC_DEFENDER',
          'SHADOW_COMMUNICATION'
        )
      );
    }

    // Non-Killers Pool
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Şərif', 'Investigator', 'Şərif', 'TOWN', 'CITY_INVESTIGATOR', 'NIGHT_VISION'));
    }
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Həkim', 'Doctor', 'Həkim', 'TOWN', 'CITY_SURGEON', 'SURGICAL_RESILIENCE'));
    }
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Sirena', 'Blocker', 'Gözbağlayıcı', 'TOWN', 'CHIEF_FIRE_MARSHAL', 'PHANTOM_STEP'));
    }
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Dəli', 'Jester', 'Dəli (Jester)', 'NEUTRAL_EVIL', 'PUBLIC_DEFENDER', 'RETALIATION_FUSE'));
    }
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Bələdiyyə Sədri', 'Mayor', 'Bələdiyyə Sədri', 'TOWN', 'MAYOR', 'IRON_WILL'));
    }
    if (nonKillerCards.length < nonKillerBudget) {
      nonKillerCards.push(createCard('Cangüdən', 'Bodyguard', 'Cangüdən', 'TOWN', 'PUBLIC_DEFENDER', 'MARTYR_RESOLVE'));
    }

    while (nonKillerCards.length < nonKillerBudget) {
      const idx = nonKillerCards.length + 1;
      nonKillerCards.push(createCard(`Vətəndaş ${idx}`, 'Citizen', 'Məsum Vətəndaş', 'TOWN', 'PUBLIC_DEFENDER', 'PHANTOM_STEP'));
    }
  }

  // Combine exact card counts: exactly killerBudget + nonKillerBudget = playerCount
  const deck = [...killerCards.slice(0, killerBudget), ...nonKillerCards.slice(0, nonKillerBudget)];

  // Shuffle deck
  const shuffled = deck.sort(() => Math.random() - 0.5);

  // Assert invariant
  const validation = validateKillerRatio(shuffled.map(c => c.faction));
  if (!validation.valid) {
    throw new Error(`Balanced loadout generation failed invariant: ${validation.reason}`);
  }

  return shuffled;
}

/**
 * Distributes roles to lobby players using the balanced loadout preset engine.
 */
export function distributeBalancedRoles(
  lobby: LobbyState,
  requestedPreset?: LoadoutPresetId
): LobbyState {
  const playerList = Object.values(lobby.players);
  const count = playerList.length;
  if (count === 0) return lobby;

  // Determine preset from lobby mode if not explicitly specified
  let presetId: LoadoutPresetId = requestedPreset ?? 'STANDARD';
  if (!requestedPreset) {
    if (lobby.mode === 'ALL_IN' || count >= 30) {
      presetId = 'ALL_IN_40P';
    } else if (lobby.mode === 'GRAND' || lobby.mode === 'EPIC' || lobby.mode === 'MASSIVE') {
      presetId = 'ASYMMETRIC';
    } else if (lobby.mode === 'STANFORD_PRISON' || lobby.mode === 'CHERNOBYL_EXCLUSION_ZONE') {
      presetId = 'ASYMMETRIC';
    }
  }

  const deck = generateBalancedDeck(presetId, count);

  // Shuffle player list
  const shuffledPlayers = [...playerList].sort(() => Math.random() - 0.5);

  const updatedPlayers: Record<string, PlayerSession> = {};
  for (let i = 0; i < count; i++) {
    const p = shuffledPlayers[i];
    const card = deck[i];
    const district: AllInDistrict = ALL_DISTRICTS[i % ALL_DISTRICTS.length];

    const identity: AllInPlayerIdentity = {
      layer1Faction: card.faction,
      layer2Office: card.office,
      layer3Trait: card.trait,
      district,
    };

    updatedPlayers[p.userId] = {
      ...p,
      displayRole: formatRoleDisplay(p.username, card.baseRoleName, card.localizedRoleName),
      allInIdentity: identity,
      currentDistrict: district,
    };
  }

  return {
    ...lobby,
    players: updatedPlayers,
  };
}
