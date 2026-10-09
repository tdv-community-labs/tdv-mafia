'use client';

import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Award,
  Shield,
  User,
  X,
  Info,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { UserSessionState } from './AuthModal';
import { getPlayerStats, PlayerStats } from '../../utils/stats';

export interface LeaderboardModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface LeaderboardEntry {
  userId: string;
  username: string;
  elo: number;
  level: number;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ isOpen, onClose }) => {
  const [currentUser, setCurrentUser] = useState<UserSessionState | null>(null);
  const [userStats, setUserStats] = useState<PlayerStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    try {
      let currentUserId = '';
      let resolvedUsername = '';

      const ecoRaw = localStorage.getItem('tdv_ecosystem_session_v1');
      if (ecoRaw) {
        try {
          const eco = JSON.parse(ecoRaw);
          if (eco?.fullName || eco?.username) {
            resolvedUsername = eco.fullName || eco.username;
            currentUserId = eco.id || `usr-${resolvedUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            setCurrentUser({
              userId: currentUserId,
              username: resolvedUsername,
              tier: 'TIER_1',
              roleTitle: 'Klub Oyunçusu',
              gamesPlayed: 0,
              winRate: 0,
            });
            setUserStats(getPlayerStats(currentUserId));
          }
        } catch {}
      }

      if (!currentUserId) {
        const storedUser = localStorage.getItem('tdv_mafia_user');
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            setCurrentUser(user);
            currentUserId = user.userId;
            setUserStats(getPlayerStats(user.userId));
          } catch {}
        }
      }

      // Build leaderboard from local storage
      const entries: LeaderboardEntry[] = [];
      
      // Add fake/mock players so it's never empty
      entries.push({ userId: 'bot-1', username: 'Anar (Şərif)', elo: 1845, level: 75 });
      entries.push({ userId: 'bot-2', username: 'Kamran_M', elo: 1720, level: 50 });
      entries.push({ userId: 'bot-3', username: 'Elvin', elo: 1690, level: 35 });

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mafia_stats_')) {
          const uId = key.replace('mafia_stats_', '');
          const rawStats = localStorage.getItem(key);
          if (rawStats) {
            const parsed: PlayerStats = JSON.parse(rawStats);
            // Try to find the username
            let username = uId === currentUserId ? currentUser?.username || 'Siz' : 'Oyunçu ' + uId.substring(0,4);
            
            // We can also try to look up usernames from stored users if we had them, 
            // but for now this works. If it's the current user, we use their real name.
            
            // Avoid duplicate pushing if current user is already in there
            const existing = entries.find(e => e.userId === uId);
            if (!existing) {
              entries.push({
                userId: uId,
                username: username,
                elo: parsed.elo ?? 1200,
                level: parsed.level ?? 1
              });
            } else if (uId === currentUserId && currentUser) {
               existing.username = currentUser.username;
               existing.elo = parsed.elo ?? 1200;
               existing.level = parsed.level ?? 1;
            }
          }
        }
      }

      // Sort by ELO descending
      entries.sort((a, b) => b.elo - a.elo);
      setLeaderboard(entries.slice(0, 50)); // Top 50

    } catch (e) {
      console.error(e);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-zinc-950/80 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white/95 dark:bg-zinc-950/80 backdrop-blur-3xl border border-zinc-200 dark:border-white/10 rounded-[24px] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5 flex flex-col max-h-[85vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 p-2 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Header */}
        <div className="px-6 pt-10 pb-6 text-center border-b border-zinc-100 dark:border-zinc-800/50 bg-gradient-to-b from-blue-50 to-white dark:from-zinc-900 dark:to-zinc-900 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] dark:opacity-[0.02] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
          
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border-4 border-white dark:border-zinc-900 shadow-xl">
              <Trophy className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Qlobal Reytinq Cədvəli
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-md font-medium">
              Şəhərin ən güclü oyunçuları. Qələbə qazanaraq ELO xalınızı artırın.
            </p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-8 bg-zinc-50/50 dark:bg-zinc-950/30">
          
          {/* Current User Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[16px] p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                <User className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  {currentUser ? currentUser.username : 'Qonaq Oyunçu'}
                  {currentUser && (
                    <Badge tone="purple">Siz</Badge>
                  )}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {currentUser ? (userStats ? `LVL ${userStats.level}` : 'Yüklənir...') : 'Sistemə daxil olmayıb'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 mb-0.5">Sizin ELO</div>
                <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 justify-end">
                  <TrendingUp className="w-4 h-4" />
                  {currentUser && userStats ? userStats.elo : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[16px] overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider">
              <span>İştirakçı</span>
              <span>ELO Reytinq</span>
            </div>
            
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {leaderboard.map((player, idx) => {
                const rank = idx + 1;
                const isTop = rank <= 3;
                const isMe = player.userId === currentUser?.userId;
                let colorClass = 'text-zinc-400 dark:text-zinc-600';
                if (rank === 1) colorClass = 'text-amber-500';
                else if (rank === 2) colorClass = 'text-zinc-400';
                else if (rank === 3) colorClass = 'text-amber-700';

                return (
                  <div key={player.userId} className={`px-5 py-4 flex items-center justify-between transition-colors ${isMe ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/20'}`}>
                    <div className="flex items-center gap-4">
                      <span className={`font-black w-6 text-center ${isTop ? colorClass : 'text-zinc-400 dark:text-zinc-600'}`}>
                        #{rank}
                      </span>
                      <span className={`font-bold ${isMe ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {player.username}
                        {isMe && <span className="ml-2 text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded">Siz</span>}
                      </span>
                    </div>
                    <span className="font-black text-zinc-700 dark:text-zinc-300">
                      {player.elo}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};