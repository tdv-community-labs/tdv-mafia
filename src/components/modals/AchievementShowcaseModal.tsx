'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Star, Zap, Lock, Crown, CheckCircle } from 'lucide-react';
import { Achievement, AchievementCategory, AchievementTier } from '../../types/achievements';
import { ACHIEVEMENTS_REGISTRY } from '../../config/achievements.config';
import { Badge } from '../ui/Badge';

interface AchievementShowcaseProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly userId: string;
}

const TIER_COLORS: Record<AchievementTier, string> = {
  BRONZE: 'from-amber-700 to-amber-900 border-amber-800 text-amber-500',
  SILVER: 'from-slate-400 to-slate-600 border-slate-500 text-slate-300',
  GOLD: 'from-yellow-400 to-amber-600 border-yellow-500 text-yellow-400',
  PLATINUM: 'from-cyan-300 to-teal-500 border-cyan-400 text-cyan-300',
  LEGENDARY: 'from-fuchsia-500 to-purple-700 border-fuchsia-500 text-fuchsia-400',
};

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  ALL: 'Bütün',
  TOWN: 'Şəhər',
  MAFIA: 'Mafiya',
  NEUTRAL: 'Neytral',
  MODES: 'Rejimlər',
  MASTERY: 'Ustalığ',
};

export const AchievementShowcaseModal: React.FC<AchievementShowcaseProps> = ({ isOpen, onClose, userId }) => {
  const [activeTab, setActiveTab] = useState<AchievementCategory>('ALL');
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    try {
      const stored = localStorage.getItem(`mafia_unlocked_achievements_${userId}`);
      if (stored) {
        setUnlockedIds(new Set(JSON.parse(stored)));
      }
    } catch {
      // ignore
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = ACHIEVEMENTS_REGISTRY.filter(a => activeTab === 'ALL' || a.category === activeTab);
  
  const totalXp = Array.from(unlockedIds).reduce((acc, id) => {
    const a = ACHIEVEMENTS_REGISTRY.find(x => x.id === id);
    return acc + (a?.xp || 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-zinc-950/95 backdrop-blur-3xl p-4 sm:p-8 overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.3)]">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Şöhrət Zalı</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-zinc-400 font-medium">{unlockedIds.size} / {ACHIEVEMENTS_REGISTRY.length} Açılıb</span>
              <span className="text-zinc-700">•</span>
              <span className="text-amber-400 font-bold flex items-center gap-1"><Star className="w-4 h-4" /> {totalXp} XP</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors border border-white/10"
        >
          X
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 max-w-7xl mx-auto w-full overflow-x-auto custom-scrollbar pb-2">
        {(Object.keys(CATEGORY_LABELS) as AchievementCategory[]).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`px-5 py-2.5 rounded-full font-bold whitespace-nowrap transition-all ${
              activeTab === cat 
                ? 'bg-white text-zinc-950 shadow-lg' 
                : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white border border-white/5'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(ach => {
            const isUnlocked = unlockedIds.has(ach.id);
            return (
              <div 
                key={ach.id} 
                className={`relative p-5 rounded-2xl border transition-all duration-300 ${
                  isUnlocked 
                    ? 'bg-zinc-900/80 border-zinc-700 hover:border-zinc-500 hover:scale-[1.02]' 
                    : 'bg-zinc-900/30 border-zinc-800/50 grayscale-[80%] opacity-60'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${TIER_COLORS[ach.tier]} flex items-center justify-center shadow-lg`}>
                    {isUnlocked ? <Crown className="w-6 h-6 text-white" /> : <Lock className="w-6 h-6 text-white/50" />}
                  </div>
                  <Badge tone={isUnlocked ? 'emerald' : 'neutral'}>
                    {ach.tier}
                  </Badge>
                </div>
                
                <h3 className="text-white font-bold text-lg leading-tight mb-2 pr-2">{ach.title}</h3>
                
                {(!ach.isSecret || isUnlocked) ? (
                  <p className="text-sm text-zinc-400 font-medium leading-relaxed">
                    {ach.description}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-500 italic font-medium">
                    Məxfi nailiyyət. Kəşf etmək üçün oynamağa davam et.
                  </p>
                )}
                
                {isUnlocked && (
                  <div className="absolute top-4 right-4 flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/50 px-2 py-1 rounded-md border border-emerald-500/20">
                    <CheckCircle className="w-3 h-3" /> Açıldı
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
