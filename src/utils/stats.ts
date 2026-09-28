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
  { maxLevel: 5, name: 'Təcrübəsiz (Çaylak)' },
  { maxLevel: 10, name: 'Sakin' },
  { maxLevel: 20, name: 'Xəfiyyə' },
  { maxLevel: 35, name: 'Təhlükəli' },
  { maxLevel: 50, name: 'Sindikat Üzvü' },
  { maxLevel: 75, name: 'Kaporegim' },
  { maxLevel: 99, name: 'Don (Xaçatası)' },
  { maxLevel: 999, name: 'Əfsanə' }
];

export const getPlayerStats = (userId: string): PlayerStats => {
  if (typeof window === 'undefined') {
    return { xp: 0, level: 1, elo: 1200, gamesPlayed: 0, wins: 0, losses: 0, mafiaWins: 0, townWins: 0, neutralWins: 0, playedLobbies: [] };
  }
  
  const raw = localStorage.getItem(`mafia_stats_${userId}`);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // Ensure backward compatibility with older stats objects
      return {
        ...parsed,
        elo: parsed.elo ?? 1200
      };
    } catch {
      // ignore
    }
  }
  return { xp: 0, level: 1, elo: 1200, gamesPlayed: 0, wins: 0, losses: 0, mafiaWins: 0, townWins: 0, neutralWins: 0, playedLobbies: [] };
};

const calculateLevel = (xp: number) => {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
};

export const getTitleForLevel = (level: number) => {
  return TITLES.find(t => level <= t.maxLevel)?.name || 'Əfsanə';
};

export const recordGameResult = (userId: string, lobbyId: string, isWin: boolean, faction: string) => {
  if (typeof window === 'undefined') return null;

  const stats = getPlayerStats(userId);
  if (stats.playedLobbies.includes(lobbyId)) {
    return stats; // Already rewarded for this game
  }

  // Calculate XP
  let xpGained = 0;
  let eloChange = 0;
  
  if (isWin) {
    xpGained = faction === 'MAFIA' || faction === 'YAKUZA' ? 250 : 200; 
    eloChange = faction === 'MAFIA' || faction === 'YAKUZA' ? 30 : 25; // Harder roles give more ELO
  } else {
    xpGained = 50; // Participation award
    eloChange = -15; 
  }

  const newStats: PlayerStats = {
    ...stats,
    xp: stats.xp + xpGained,
    level: calculateLevel(stats.xp + xpGained),
    elo: Math.max(0, stats.elo + eloChange),
    gamesPlayed: stats.gamesPlayed + 1,
    wins: stats.wins + (isWin ? 1 : 0),
    losses: stats.losses + (isWin ? 0 : 1),
    mafiaWins: stats.mafiaWins + (isWin && (faction === 'MAFIA' || faction === 'YAKUZA') ? 1 : 0),
    townWins: stats.townWins + (isWin && faction === 'TOWN' ? 1 : 0),
    neutralWins: stats.neutralWins + (isWin && faction.includes('NEUTRAL') ? 1 : 0),
    playedLobbies: [...stats.playedLobbies, lobbyId]
  };

  localStorage.setItem(`mafia_stats_${userId}`, JSON.stringify(newStats));
  return newStats;
};
