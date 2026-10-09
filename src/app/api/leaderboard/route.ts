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
  { rank: 1, userId: 'usr-anar', username: 'Anar (Şərif)', elo: 1845, level: 75, gamesPlayed: 84, winRate: 72, roleTitle: 'Ali Müstəntiq' },
  { rank: 2, userId: 'usr-kamran', username: 'Kamran_M (Don)', elo: 1720, level: 50, gamesPlayed: 65, winRate: 68, roleTitle: 'Sindikat Rəhbəri' },
  { rank: 3, userId: 'usr-leyla', username: 'Leyla_Dr (Həkim)', elo: 1690, level: 42, gamesPlayed: 54, winRate: 65, roleTitle: 'Baş Həkim' },
  { rank: 4, userId: 'usr-elvin', username: 'Elvin (Deduktiv)', elo: 1640, level: 38, gamesPlayed: 48, winRate: 62, roleTitle: 'Xəfiyyə' },
  { rank: 5, userId: 'usr-nigar', username: 'Nigar_B', elo: 1580, level: 30, gamesPlayed: 40, winRate: 58, roleTitle: 'Məsum Vətəndaş' },
  { rank: 6, userId: 'usr-murad', username: 'Murad_K (Kapo)', elo: 1530, level: 26, gamesPlayed: 35, winRate: 56, roleTitle: 'Kapo' },
  { rank: 7, userId: 'usr-rauf', username: 'Rauf_Agent', elo: 1490, level: 22, gamesPlayed: 28, winRate: 54, roleTitle: 'Casus' },
  { rank: 8, userId: 'usr-aysel', username: 'Aysel (Mələk)', elo: 1450, level: 19, gamesPlayed: 24, winRate: 52, roleTitle: 'Qoruyucu Mələk' },
];

export async function GET() {
  const seasonInfo: LeaderboardSeasonInfo = {
    season: 'Mövsüm #1 (TDV Məktəb Deduksiya Liqası)',
    status: 'ACTIVE_INITIAL_QUALIFICATION',
    minimumMatchesForRank: 3,
    updatedAt: Date.now(),
  };

  return NextResponse.json({
    success: true,
    seasonInfo,
    leaderboard: CANONICAL_LEADERBOARD,
    message: 'Klub masalarda ilk matçlar davam edir. Şəxsi hesabınızla masalara qoşulub xal toplayın.',
  });
}