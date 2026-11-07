/**
 * TDV BTL MAFIA - Player Stats & Progression Bridge
 * Maintained for backward compatibility, internally powered by the unified ProgressionManager.
 */

import {
  getPlayerProgression,
  recordMatchProgression,
  calculateLevelFromXp,
  RANK_TIERS,
} from './progression';

export interface PlayerStats {
  xp: number;
  level: number;
  elo: number; // Elo rating
  gamesPlayed: number;
  wins: number;
  losses: number;
  mafiaWins: number;
  townWins: number;
  neutralWins: number;
  playedLobbies: string[]; // To prevent duplicate rewards
}

export const TITLES = [
  { maxLevel: 5, name: 'Novice Sleuth' },
  { maxLevel: 10, name: 'Citizen' },
  { maxLevel: 20, name: 'Deputy Inquisitor' },
  { maxLevel: 35, name: 'High Magistrate' },
  { maxLevel: 50, name: 'Syndicate Enforcer' },
  { maxLevel: 75, name: 'Underboss' },
  { maxLevel: 99, name: 'Syndicate Don' },
  { maxLevel: 999, name: 'Supreme Godfather' },
];

export const getPlayerStats = (userId: string): PlayerStats => {
  const profile = getPlayerProgression(userId);
  return {
    xp: profile.xp,
    level: profile.level,
    elo: profile.elo,
    gamesPlayed: profile.gamesPlayed,
    wins: profile.wins,
    losses: profile.losses,
    mafiaWins: profile.mafiaWins,
    townWins: profile.townWins,
    neutralWins: profile.neutralWins,
    playedLobbies: [...profile.playedLobbies],
  };
};

export const calculateLevel = (xp: number) => {
  return calculateLevelFromXp(xp);
};

export const getTitleForLevel = (level: number) => {
  return TITLES.find((t) => level <= t.maxLevel)?.name || 'Supreme Godfather';
};

export const getRankTitleForElo = (elo: number) => {
  const profile = getPlayerProgression('temp_check');
  return RANK_TIERS[profile.rankTier]?.nameAz || 'Novice Sleuth';
};

export const recordGameResult = (
  userId: string,
  lobbyId: string,
  isWin: boolean,
  faction: string
): PlayerStats | null => {
  if (typeof window === 'undefined') return null;

  const { profile } = recordMatchProgression(userId, lobbyId, isWin, faction);
  return {
    xp: profile.xp,
    level: profile.level,
    elo: profile.elo,
    gamesPlayed: profile.gamesPlayed,
    wins: profile.wins,
    losses: profile.losses,
    mafiaWins: profile.mafiaWins,
    townWins: profile.townWins,
    neutralWins: profile.neutralWins,
    playedLobbies: [...profile.playedLobbies],
  };
};
