/**
 * Roles, Factions, Civic Offices, and Innate Traits
 * Enterprise Mafia / Social Deduction Platform - Phase 1 Foundation
 */

export type CoreFaction =
  | 'TOWN'
  | 'MAFIA'
  | 'YAKUZA'
  | 'VOID_CULT'
  | 'NEUTRAL_KILLER'
  | 'NEUTRAL_BENIGN'
  | 'NEUTRAL_EVIL';

export type AllInDistrict = 'ELITE' | 'COMMERCIAL' | 'INDUSTRIAL';

export type CivicOfficeType =
  | 'MAYOR'
  | 'CHIEF_PROSECUTOR'
  | 'CHIEF_JUSTICE'
  | 'CENTRAL_BANKER'
  | 'MEDIA_MOGUL'
  | 'PRISON_WARDEN'
  | 'POLICE_COMMISSIONER'
  | 'CITY_SURGEON'
  | 'LABOR_UNION_BOSS'
  | 'DISTRICT_ARCHITECT'
  | 'CHIEF_FIRE_MARSHAL'
  | 'BLACK_MARKET_BROKER'
  | 'PORT_AUTHORITY_DIRECTOR'
  | 'PUBLIC_DEFENDER'
  | 'CITY_INVESTIGATOR'
  | 'CORONER'
  | 'CHRONOS_DIRECTOR'
  | 'NECRO_BIOLOGIST';

export type InnateTraitType =
  | 'BULLETPROOF_VEST'
  | 'PHANTOM_STEP'
  | 'RETALIATION_FUSE'
  | 'SILENCER_ATTACHMENT'
  | 'INSIDER_ACCESS'
  | 'SURGICAL_RESILIENCE'
  | 'CONTRABAND_POCKET'
  | 'SHADOW_COMMUNICATION'
  | 'FALSE_DOCUMENTATION'
  | 'MARTYR_RESOLVE'
  | 'COLD_BLOODED'
  | 'POISON_IMMUNITY'
  | 'TIME_WARP_CORE'
  | 'DEATH_DEFIANCE';

/** 3-Layer composite identity for All-In (40–50 players) */
export interface AllInPlayerIdentity {
  readonly layer1Faction: CoreFaction;
  readonly layer2Office: CivicOfficeType;
  readonly layer3Trait: InnateTraitType;
  readonly district: AllInDistrict;
}

/** Enforced template literal type matching "Nickname (Original Role)" */
export type FormattedRoleString = `${string} (${string})`;

/** Enforced UI contract for role presentation across lobbies and game tables */
export interface FormattedRoleDisplay {
  readonly nickname: string;
  readonly originalRoleName: string;
  readonly localizedRoleName?: string;
  readonly formatted: FormattedRoleString;
}

/** Factory function enforcing the exact formatted UI contract */
export function formatRoleDisplay(
  nickname: string,
  originalRoleName: string,
  localizedRoleName?: string
): FormattedRoleDisplay {
  const roleDescription = localizedRoleName
    ? `${localizedRoleName} / ${originalRoleName}`
    : originalRoleName;
  const formatted: FormattedRoleString = `${nickname} (${roleDescription})`;

  return {
    nickname,
    originalRoleName,
    localizedRoleName,
    formatted,
  };
}

/** Metadata structure for Civic Offices */
export interface CivicOfficeMetadata {
  readonly office: CivicOfficeType;
  readonly title: string;
  readonly defaultDistrict: AllInDistrict;
  readonly votingWeightBonus: number;
  readonly executivePrivilegeDescription: string;
}

/** Metadata structure for Innate Traits */
export interface InnateTraitMetadata {
  readonly trait: InnateTraitType;
  readonly name: string;
  readonly passiveEffect: string;
  readonly nightPriorityModifier: number;
}
