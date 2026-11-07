import { NextResponse } from 'next/server';

export interface LeaderboardSeasonInfo {
  readonly season: string;
  readonly status: string;
  readonly minimumMatchesForRank: number;
  readonly updatedAt: number;
}

export interface LeaderboardPlayerEntry {
  readonly rank: number;
  readonly userId: string;
  readonly username: string;
  readonly elo: number;
  readonly level: number;
  readonly gamesPlayed: number;
  readonly winRate: number;
  readonly roleTitle: string;
}

const CANONICAL_LEADERBOARD: readonly LeaderboardPlayerEntry[] = [
  { rank: 1, userId: 'usr-anar', username: 'Anar (Sheriff)', elo: 1845, level: 75, gamesPlayed: 84, winRate: 72, roleTitle: 'Chief Investigator' },
  { rank: 2, userId: 'usr-kamran', username: 'Kamran_M (Don)', elo: 1720, level: 50, gamesPlayed: 65, winRate: 68, roleTitle: 'Syndicate Don' },
  { rank: 3, userId: 'usr-leyla', username: 'Leyla_Dr (Doctor)', elo: 1690, level: 42, gamesPlayed: 54, winRate: 65, roleTitle: 'Chief Surgeon' },
  { rank: 4, userId: 'usr-elvin', username: 'Elvin (Detective)', elo: 1640, level: 38, gamesPlayed: 48, winRate: 62, roleTitle: 'Senior Detective' },
  { rank: 5, userId: 'usr-nigar', username: 'Nigar_B', elo: 1580, level: 30, gamesPlayed: 40, winRate: 58, roleTitle: 'Innocent Civilian' },
  { rank: 6, userId: 'usr-murad', username: 'Murad_K (Capo)', elo: 1530, level: 26, gamesPlayed: 35, winRate: 56, roleTitle: 'Caporegime' },
  { rank: 7, userId: 'usr-rauf', username: 'Rauf_Agent', elo: 1490, level: 22, gamesPlayed: 28, winRate: 54, roleTitle: 'Undercover Agent' },
  { rank: 8, userId: 'usr-aysel', username: 'Aysel (Angel)', elo: 1450, level: 19, gamesPlayed: 24, winRate: 52, roleTitle: 'Guardian Angel' },
];

export async function GET() {
  const seasonInfo: LeaderboardSeasonInfo = {
    season: 'Season #1 (TDV Deduction Championship)',
    status: 'ACTIVE_INITIAL_QUALIFICATION',
    minimumMatchesForRank: 3,
    updatedAt: Date.now(),
  };

  return NextResponse.json({
    success: true,
    seasonInfo,
    leaderboard: CANONICAL_LEADERBOARD,
    message: 'Ranked matches are live. Join tables with your profile to earn XP and climb the ladder.',
  });
}