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
  { maxLevel: 5, name: 'Acemi Xəfiyyə' },
  { maxLevel: 10, name: 'Sakin' },
  { maxLevel: 20, name: 'Müstəntiq Köməkçisi' },
  { maxLevel: 35, name: 'Ali Hakim' },
  { maxLevel: 50, name: 'Sindikat Cəzaçısı' },
  { maxLevel: 75, name: 'Vitse-Don' },
  { maxLevel: 99, name: 'Sindikat Donu' },
  { maxLevel: 999, name: 'Ali Xaçatası' },
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
  return TITLES.find((t) => level <= t.maxLevel)?.name || 'Ali Xaçatası';
};

export const getRankTitleForElo = (elo: number) => {
  const profile = getPlayerProgression('temp_check');
  return RANK_TIERS[profile.rankTier]?.nameAz || 'Acemi Xəfiyyə';
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
