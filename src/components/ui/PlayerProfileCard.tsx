'use client';

import React, { useEffect, useState } from 'react';
import { Trophy, Swords, Shield, Skull, Medal, TrendingUp, Star } from 'lucide-react';
import { PlayerStats, getPlayerStats, getTitleForLevel } from '../../utils/stats';

interface PlayerProfileCardProps {
  userId: string;
  username: string;
}

export const PlayerProfileCard: React.FC<PlayerProfileCardProps> = ({ userId, username }) => {
  const [stats, setStats] = useState<PlayerStats | null>(null);

  useEffect(() => {
    setStats(getPlayerStats(userId));
  }, [userId]);

  if (!stats) return null;

  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
  const currentLevelXp = Math.pow(stats.level - 1, 2) * 100;
  const nextLevelXp = Math.pow(stats.level, 2) * 100;
  const progressPercent = Math.max(0, Math.min(100, ((stats.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100));

  const title = getTitleForLevel(stats.level);

  return (
    <div className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-[24px] p-6 shadow-2xl backdrop-blur-md relative overflow-hidden group hover:border-amber-500/30 transition-colors">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Trophy className="w-32 h-32 text-amber-500" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start">
        {/* Avatar & Level */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full border-4 border-amber-500/20 bg-zinc-800 flex items-center justify-center relative shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            <span className="text-4xl font-black text-amber-500">{username.charAt(0).toUpperCase()}</span>
            <div className="absolute -bottom-3 bg-amber-600 text-white text-xs font-black px-3 py-1 rounded-full border-2 border-zinc-900 shadow-md">
              LVL {stats.level}
            </div>
          </div>
          <div className="text-center mt-2">
            <h2 className="text-xl font-black text-white">{username}</h2>
            <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mt-0.5 flex items-center justify-center gap-1">
              <Medal className="w-3 h-3" /> {title}
            </div>
          </div>
        </div>

        {/* Stats & Progress */}
        <div className="flex-1 w-full flex flex-col justify-center gap-6">
          
          <div className="flex flex-col sm:flex-row gap-4">
            {/* ELO Rating Badge */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-amber-950 to-zinc-950 border border-amber-900/50 rounded-xl px-4 py-2 shadow-lg">
              <Star className="w-6 h-6 text-amber-500" />
              <div className="flex flex-col">
                <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">ELO Reytinq</span>
                <span className="text-xl font-black text-white">{stats.elo || 1200}</span>
              </div>
            </div>
            
            {/* XP Bar */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex justify-between text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
                <span>Təcrübə (XP)</span>
                <span>{stats.xp} / {nextLevelXp} XP</span>
              </div>
              <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                <div 
                  className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 rounded-full transition-all duration-1000 relative"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800/50 flex flex-col gap-1 items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-500 mb-1" />
              <span className="text-2xl font-black text-white">{winRate}%</span>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest text-center">Qələbə Reyti</span>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800/50 flex flex-col gap-1 items-center justify-center">
              <Swords className="w-4 h-4 text-blue-400 mb-1" />
              <span className="text-2xl font-black text-white">{stats.gamesPlayed}</span>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest text-center">Oyun Sayı</span>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800/50 flex flex-col gap-1 items-center justify-center">
              <Skull className="w-4 h-4 text-red-500 mb-1" />
              <span className="text-2xl font-black text-white">{stats.mafiaWins}</span>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest text-center">Mafiya Qələbəsi</span>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800/50 flex flex-col gap-1 items-center justify-center">
              <Shield className="w-4 h-4 text-emerald-400 mb-1" />
              <span className="text-2xl font-black text-white">{stats.townWins}</span>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest text-center">Şəhər Qələbəsi</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
