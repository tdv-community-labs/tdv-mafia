/**
 * TDV BTL MAFIA - Player Progression, Ranks & Cosmetics Types
 * Defines the 7-Tier Ranked Ladder, 1-100+ Level Curve, Itemized XP Breakdown,
 * and Battleground Prestige Cosmetics.
 */

export type RankTier =
  | 'NOVICE_DETECTIVE'     // 0 - 1099 ELO: "Novice Sleuth"
  | 'DEPUTY_INQUISITOR'    // 1100 - 1299 ELO: "Deputy Inquisitor"
  | 'HIGH_MAGISTRATE'      // 1300 - 1499 ELO: "High Magistrate"
  | 'SYNDICATE_ENFORCER'   // 1500 - 1699 ELO: "Syndicate Enforcer"
  | 'UNDERBOSS'            // 1700 - 1899 ELO: "Underboss"
  | 'SYNDICATE_DON'        // 1900 - 2199 ELO: "Syndicate Don"
  | 'SUPREME_GODFATHER';   // 2200+ ELO: "Supreme Godfather"

export interface RankTierDefinition {
  readonly tier: RankTier;
  readonly name?: string;
  readonly nameEn?: string;
  readonly nameAz: string;
  readonly minElo: number;
  readonly maxElo: number;
  readonly badgeIcon: string;
  readonly borderStyle: string;
  readonly badgeBg: string;
  readonly textColor: string;
  readonly shadowGlow: string;
}

export interface CosmeticBorder {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly requiredRank?: RankTier;
  readonly requiredLevel?: number;
  readonly cssClass: string;
  readonly glowStyle: string;
  readonly rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';
}

export interface CosmeticTitle {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly requiredRank?: RankTier;
  readonly requiredLevel?: number;
  readonly achievementId?: string;
  readonly textColor: string;
  readonly badgeBg: string;
}

export interface EquippedCosmetics {
  readonly borderId: string;
  readonly titleId: string;
  readonly badgeId?: string;
}

export type XPGainReason =
  | 'WIN_MAFIA_YAKUZA'      // +250 XP
  | 'WIN_TOWN'              // +200 XP
  | 'WIN_NEUTRAL'           // +225 XP
  | 'PARTICIPATION'         // +50 XP
  | 'CLUTCH_DOCTOR_SAVE'    // +100 XP
  | 'SHERIFF_BUST'          // +75 XP
  | 'ACQUITTAL_DEFENSE'     // +75 XP
  | 'SURVIVED_EXECUTION'    // +60 XP
  | 'MAYOR_REVEAL_WIN'      // +80 XP
  | 'FIRST_BLOOD'           // +40 XP
  | 'PERFECT_VOTING'        // +90 XP
  | 'ACHIEVEMENT_UNLOCKED'; // variable XP

export interface XPGainEvent {
  readonly reason: XPGainReason;
  readonly xp: number;
  readonly labelAz: string;
}

export interface LevelProgress {
  readonly level: number;
  readonly currentLevelXp: number;
  readonly nextLevelXp: number;
  readonly progressPercentage: number;
  readonly totalXp: number;
}

export interface PlayerProgressionProfile {
  readonly userId: string;
  readonly username: string;
  readonly xp: number;
  readonly level: number;
  readonly elo: number;
  readonly rankTier: RankTier;
  readonly demotionShieldActive: boolean;
  readonly losingStreak: number;
  readonly unlockedAchievements: readonly string[];
  readonly equippedCosmetics: EquippedCosmetics;
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly mafiaWins: number;
  readonly townWins: number;
  readonly neutralWins: number;
  readonly playedLobbies: readonly string[];
  readonly spiritEssence: number; // Spectator prediction tokens
}

export interface GhostPredictionBet {
  readonly id: string;
  readonly spectatorId: string;
  readonly spectatorName: string;
  readonly targetPlayerId?: string;
  readonly predictedFaction?: string;
  readonly betType: 'NEXT_LYNCH' | 'WINNING_FACTION';
  readonly wagerAmount: number;
  readonly oddsMultiplier: number;
  readonly round: number;
  readonly resolved: boolean;
  readonly won?: boolean;
}

export interface MatchMVPScore {
  readonly playerId: string;
  readonly playerName: string;
  readonly roleId: string;
  readonly faction: string;
  readonly totalScore: number;
  readonly breakdown: {
    readonly victoryBonus: number;
    readonly survivalBonus: number;
    readonly votingAccuracyPoints: number;
    readonly actionImpactPoints: number;
    readonly defenseAcquittalPoints: number;
  };
  readonly clutchHighlights: readonly string[];
}

export interface MatchTurningPoint {
  readonly round: number;
  readonly phase: 'NIGHT' | 'DAY_VOTING' | 'TRIAL_DEFENSE';
  readonly titleAz: string;
  readonly descriptionAz: string;
  readonly impactLevel: 'HIGH' | 'CRITICAL' | 'GAME_CHANGING';
  readonly involvedPlayerIds: readonly string[];
}

export interface MatchRecap {
  readonly lobbyId: string;
  readonly winningFaction: string;
  readonly totalRounds: number;
  readonly durationSeconds: number;
  readonly mvp: MatchMVPScore;
  readonly scores: readonly MatchMVPScore[];
  readonly turningPoints: readonly MatchTurningPoint[];
  readonly publicCasualties: readonly {
    readonly playerId: string;
    readonly playerName: string;
    readonly roleName: string;
    readonly round: number;
    readonly cause: string;
  }[];
  readonly shareableSummaryText: string;
}
