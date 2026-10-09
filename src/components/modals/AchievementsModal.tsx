'use client';

import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Medal,
  Sparkles,
  Search,
  X,
  Lock,
  CheckCircle2,
  Coins,
  Flame,
  Shield,
  Crosshair,
  Sliders,
  Crown,
  Gem,
  Award,
  CircleDot,
} from 'lucide-react';
import { ACHIEVEMENTS_REGISTRY } from '../../config/achievements.config';
import { Achievement, AchievementCategory, AchievementTier } from '../../types/achievements';
import { Button } from '../ui/Button';
import { playCard } from '../../utils/sfx';

export interface AchievementsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface TierVisualTheme {
  readonly label: string;
  readonly emoji: string;
  readonly pillActive: string;
  readonly pillInactive: string;
  readonly cardBorderUnlocked: string;
  readonly cardBorderLocked: string;
  readonly cardBgUnlocked: string;
  readonly cardBgLocked: string;
  readonly badgeBg: string;
  readonly badgeText: string;
  readonly badgeBorder: string;
  readonly iconBoxUnlocked: string;
  readonly iconBoxLocked: string;
  readonly glowShadow: string;
}

const TIER_THEMES: Record<AchievementTier, TierVisualTheme> = {
  BRONZE: {
    label: 'Bürünc',
    emoji: '<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M10 10h4"/><path d="M10 14h4"/></svg></span>',
    pillActive: 'bg-gradient-to-r from-amber-700 to-amber-800 text-white shadow-md shadow-amber-900/30 border border-amber-600/60',
    pillInactive: 'text-amber-800 dark:text-amber-300 hover:bg-amber-500/10 border border-amber-600/25',
    cardBorderUnlocked: 'border-amber-600/40 dark:border-amber-600/45 hover:border-amber-500 dark:hover:border-amber-400',
    cardBorderLocked: 'border-amber-700/20 dark:border-amber-800/30 hover:border-amber-700/40',
    cardBgUnlocked: 'bg-gradient-to-br from-amber-50/70 via-white to-amber-100/25 dark:from-amber-950/25 dark:via-zinc-900 dark:to-zinc-950',
    cardBgLocked: 'bg-zinc-50/80 dark:bg-zinc-950/70',
    badgeBg: 'bg-amber-600/15 dark:bg-amber-500/15',
    badgeText: 'text-amber-800 dark:text-amber-300',
    badgeBorder: 'border-amber-600/30 dark:border-amber-500/35',
    iconBoxUnlocked: 'bg-amber-600/15 text-amber-700 dark:text-amber-300 border-amber-600/30 shadow-sm',
    iconBoxLocked: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 border-zinc-300 dark:border-zinc-700',
    glowShadow: 'shadow-[0_0_14px_rgba(217,119,6,0.08)]',
  },
  SILVER: {
    label: 'Gümüş',
    emoji: '<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M10 10h4"/><path d="M10 14h4"/></svg></span>',
    pillActive: 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-md shadow-slate-800/30 border border-slate-400/60',
    pillInactive: 'text-slate-700 dark:text-slate-300 hover:bg-slate-500/10 border border-slate-400/30',
    cardBorderUnlocked: 'border-slate-300 dark:border-slate-600/60 hover:border-slate-400 dark:hover:border-slate-400',
    cardBorderLocked: 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700',
    cardBgUnlocked: 'bg-gradient-to-br from-slate-50/80 via-white to-slate-100/30 dark:from-slate-900/30 dark:via-zinc-900 dark:to-zinc-950',
    cardBgLocked: 'bg-zinc-50/80 dark:bg-zinc-950/70',
    badgeBg: 'bg-slate-500/15 dark:bg-slate-400/15',
    badgeText: 'text-slate-700 dark:text-slate-200',
    badgeBorder: 'border-slate-400/35 dark:border-slate-400/35',
    iconBoxUnlocked: 'bg-slate-500/15 text-slate-700 dark:text-slate-200 border-slate-400/35 shadow-sm',
    iconBoxLocked: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 border-zinc-300 dark:border-zinc-700',
    glowShadow: 'shadow-[0_0_14px_rgba(148,163,184,0.10)]',
  },
  GOLD: {
    label: 'Qızıl',
    emoji: '<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M10 10h4"/><path d="M10 14h4"/></svg></span>',
    pillActive: 'bg-gradient-to-r from-yellow-500 to-amber-600 text-zinc-950 font-black shadow-md shadow-yellow-500/30 border border-yellow-400/70',
    pillInactive: 'text-yellow-800 dark:text-yellow-400 hover:bg-yellow-500/10 border border-yellow-500/30',
    cardBorderUnlocked: 'border-yellow-500/50 dark:border-yellow-500/55 hover:border-yellow-400 dark:hover:border-yellow-300',
    cardBorderLocked: 'border-yellow-600/20 dark:border-yellow-700/25 hover:border-yellow-600/35',
    cardBgUnlocked: 'bg-gradient-to-br from-yellow-50/75 via-white to-amber-100/25 dark:from-yellow-950/30 dark:via-zinc-900 dark:to-amber-950/15',
    cardBgLocked: 'bg-zinc-50/80 dark:bg-zinc-950/70',
    badgeBg: 'bg-yellow-500/15 dark:bg-yellow-500/20',
    badgeText: 'text-yellow-800 dark:text-yellow-300 font-extrabold',
    badgeBorder: 'border-yellow-500/40 dark:border-yellow-400/45',
    iconBoxUnlocked: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/35 shadow-sm',
    iconBoxLocked: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 border-zinc-300 dark:border-zinc-700',
    glowShadow: 'shadow-[0_0_18px_rgba(234,179,8,0.12)]',
  },
  PLATINUM: {
    label: 'Platin',
    emoji: '<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13"/><path d="M13 3l3 6-4 13"/></svg></span>',
    pillActive: 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-md shadow-cyan-500/30 border border-cyan-400/60',
    pillInactive: 'text-cyan-800 dark:text-cyan-300 hover:bg-cyan-500/10 border border-cyan-500/30',
    cardBorderUnlocked: 'border-cyan-500/50 dark:border-cyan-500/60 hover:border-cyan-400 dark:hover:border-cyan-300',
    cardBorderLocked: 'border-cyan-600/20 dark:border-cyan-700/25 hover:border-cyan-600/35',
    cardBgUnlocked: 'bg-gradient-to-br from-cyan-50/75 via-white to-teal-100/25 dark:from-cyan-950/35 dark:via-zinc-900 dark:to-teal-950/20',
    cardBgLocked: 'bg-zinc-50/80 dark:bg-zinc-950/70',
    badgeBg: 'bg-cyan-500/15 dark:bg-cyan-500/20',
    badgeText: 'text-cyan-800 dark:text-cyan-300 font-extrabold',
    badgeBorder: 'border-cyan-500/40 dark:border-cyan-400/45',
    iconBoxUnlocked: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/35 shadow-sm',
    iconBoxLocked: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 border-zinc-300 dark:border-zinc-700',
    glowShadow: 'shadow-[0_0_22px_rgba(6,182,212,0.15)]',
  },
  LEGENDARY: {
    label: 'Əfsanəvi',
    emoji: '<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.518l4.276 3.664a1 1 0 0 0 1.516-.294z"/></svg></span>',
    pillActive: 'bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white shadow-md shadow-purple-600/35 border border-purple-400/60',
    pillInactive: 'text-purple-800 dark:text-purple-300 hover:bg-purple-500/10 border border-purple-500/30',
    cardBorderUnlocked: 'border-purple-500/60 dark:border-purple-500/70 hover:border-rose-400 ring-1 ring-purple-500/25',
    cardBorderLocked: 'border-purple-600/20 dark:border-purple-800/30 hover:border-purple-600/35',
    cardBgUnlocked: 'bg-gradient-to-br from-purple-50/80 via-white to-rose-100/30 dark:from-purple-950/40 dark:via-zinc-900 dark:to-rose-950/25',
    cardBgLocked: 'bg-zinc-50/80 dark:bg-zinc-950/70',
    badgeBg: 'bg-gradient-to-r from-purple-600/20 via-pink-600/15 to-rose-600/20 dark:from-purple-500/25 dark:via-pink-500/20 dark:to-rose-500/25',
    badgeText: 'text-purple-900 dark:text-purple-200 font-black tracking-wide',
    badgeBorder: 'border-purple-500/45 dark:border-purple-400/50',
    iconBoxUnlocked: 'bg-gradient-to-br from-purple-500/20 to-rose-500/20 text-purple-700 dark:text-purple-300 border-purple-500/40 shadow-sm',
    iconBoxLocked: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 border-zinc-300 dark:border-zinc-700',
    glowShadow: 'shadow-[0_0_28px_rgba(168,85,247,0.22)]',
  },
};

const CATEGORIES: readonly { id: AchievementCategory; label: string; count: number; icon: React.FC<{ className?: string }> }[] = [
  { id: 'ALL', label: 'Hamısı', count: 72, icon: Award },
  { id: 'TOWN', label: 'Şəhər', count: 15, icon: Shield },
  { id: 'MAFIA', label: 'Mafiya', count: 15, icon: Crosshair },
  { id: 'NEUTRAL', label: 'Neytral', count: 12, icon: Sparkles },
  { id: 'MODES', label: 'Rejimlər', count: 16, icon: Sliders },
  { id: 'MASTERY', label: 'Usta & Deduksiya', count: 14, icon: Flame },
];

const TIERS: readonly { id: AchievementTier | 'ALL'; label: string; count: number; emoji: string }[] = [
  { id: 'ALL', label: 'Bütün Tiers', count: 72, emoji: '<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><circle cx="12" cy="12" r="10"/></svg></span>' },
  { id: 'BRONZE', label: 'Bürünc', count: 8, emoji: '<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M10 10h4"/><path d="M10 14h4"/></svg></span>' },
  { id: 'SILVER', label: 'Gümüş', count: 22, emoji: '<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M10 10h4"/><path d="M10 14h4"/></svg></span>' },
  { id: 'GOLD', label: 'Qızıl', count: 21, emoji: '<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M10 10h4"/><path d="M10 14h4"/></svg></span>' },
  { id: 'PLATINUM', label: 'Platin', count: 12, emoji: '<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13"/><path d="M13 3l3 6-4 13"/></svg></span>' },
  { id: 'LEGENDARY', label: 'Əfsanəvi', count: 9, emoji: '<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.518l4.276 3.664a1 1 0 0 0 1.516-.294z"/></svg></span>' },
];

export const AchievementsModal: React.FC<AchievementsModalProps> = ({ isOpen, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<AchievementCategory>('ALL');
  const [selectedTier, setSelectedTier] = useState<AchievementTier | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Stored unlocked IDs in localStorage or default initial sample
  const unlockedIds = useMemo<Set<string>>(() => {
    if (typeof window === 'undefined') {
      return new Set(['town_sheriff_first_bust', 'mafia_first_blood', 'town_citizen_decisive_vote', 'mastery_first_blood']);
    }
    try {
      const stored = localStorage.getItem('tdv_mafia_unlocked_achievements');
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch {
      // Fallback
    }
    return new Set(['town_sheriff_first_bust', 'mafia_first_blood', 'town_citizen_decisive_vote', 'mastery_first_blood']);
  }, [isOpen]);

  const filteredAchievements = useMemo(() => {
    let list = ACHIEVEMENTS_REGISTRY;
    if (activeCategory !== 'ALL') {
      list = list.filter((a) => a.category === activeCategory);
    }
    if (selectedTier !== 'ALL') {
      list = list.filter((a) => a.tier === selectedTier);
    }
    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
    );
  }, [activeCategory, selectedTier, searchQuery]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalCount = ACHIEVEMENTS_REGISTRY.length;
  const unlockedCount = unlockedIds.size;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);

  const handleCategoryChange = (cat: AchievementCategory) => {
    playCard();
    setActiveCategory(cat);
  };

  const handleTierChange = (tier: AchievementTier | 'ALL') => {
    playCard();
    setSelectedTier(tier);
  };

  const clearFilters = () => {
    playCard();
    setActiveCategory('ALL');
    setSelectedTier('ALL');
    setSearchQuery('');
  };

  const hasActiveFilters = activeCategory !== 'ALL' || selectedTier !== 'ALL' || searchQuery.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-5 bg-zinc-950/70 backdrop-blur-[16px] animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-[20px] ring-1 ring-white/10 shadow-2xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/80 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col ring-1 ring-white/5 h-[92vh] max-h-[880px] overflow-hidden transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── FIXED TOP HEADER ──────────────────────────────────────── */}
        <div className="shrink-0 bg-zinc-50/50 dark:bg-zinc-900/40 border-b border-zinc-200 dark:border-white/5">
          
          {/* Row 1: Title, Progress Stats & Close */}
          <div className="p-4 sm:px-6 sm:py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-[20px] bg-gradient-to-br from-amber-500/20 via-yellow-500/15 to-purple-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm">
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-zinc-950 dark:text-white leading-tight truncate">
                    TDV MAFIA — Nailiyyətlər & Titullar
                  </h2>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/35">
                    72 Mexaniki Tapşırıq
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                  5-Səviyyəli (Bürünc, Gümüş, Qızıl, Platin, Əfsanəvi) dəqiq oyun mühərriki məqsədləri
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Progress Summary Pill */}
              <div className="hidden sm:flex flex-col items-end">
                <div className="text-xs font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>{unlockedCount} / {totalCount} Tamamlandı</span>
                  <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">({progressPercent}%)</span>
                </div>
                <div className="w-32 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-purple-500 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <button type="button" onClick={onClose} className="w-8 h-8 rounded-[8px] flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
    </button>
            </div>
          </div>

          {/* Row 2: Category Tabs & Search Bar */}
          <div className="px-4 sm:px-6 py-2.5 bg-zinc-50 dark:bg-zinc-950/80 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Category Tabs */}
            <div className="inline-flex items-center p-1 rounded-[20px] bg-zinc-200/80 dark:bg-zinc-800/90 border border-zinc-300/60 dark:border-zinc-700/60 gap-1 overflow-x-auto max-w-full no-scrollbar">
              {CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-black transition-all shrink-0 cursor-pointer select-none leading-none ${
                      isActive
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                        : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-white/60 dark:hover:bg-zinc-700/60'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{cat.label} ({cat.count})</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full lg:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Nailiyyət axtar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 rounded-[8px] border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Axtarışı təmizlə"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Row 3: Tier Filter Bar (Bronze, Silver, Gold, Platinum, Legendary) */}
          <div className="px-4 sm:px-6 py-2 bg-zinc-100/80 dark:bg-zinc-950/50 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mr-1 flex items-center gap-1">
                <CircleDot className="w-3 h-3 text-amber-500" />
                Səviyyə:
              </span>

              {TIERS.map((tier) => {
                const isSelected = selectedTier === tier.id;
                let activeClass = 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm';
                let inactiveClass = 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60';

                if (tier.id !== 'ALL') {
                  const theme = TIER_THEMES[tier.id];
                  activeClass = theme.pillActive;
                  inactiveClass = theme.pillInactive;
                }

                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => handleTierChange(tier.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11px] font-bold transition-all shrink-0 cursor-pointer select-none leading-none ${
                      isSelected ? activeClass : inactiveClass
                    }`}
                  >
                    <span dangerouslySetInnerHTML={{ __html: tier.emoji }} />
                    <span>{tier.label}</span>
                    <span className="opacity-75 font-mono text-[10px]">({tier.count})</span>
                  </button>
                );
              })}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline shrink-0 ml-auto cursor-pointer"
              >
                Filtrləri sıfırla
              </button>
            )}
          </div>
        </div>

        {/* ─── SCROLLABLE ACHIEVEMENTS GRID ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-50/40 dark:bg-zinc-900/40">
          {filteredAchievements.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6">
              <div className="w-12 h-12 rounded-[20px] bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100 mb-1">
                Heç bir nailiyyət tapılmadı
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mb-4">
                Seçilmiş filter meyarlarına uyğun gələn nailiyyət yoxdur. Axtarış sözünü dəyişin və ya filtrləri sıfırlayın.
              </p>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Bütün Nailiyyətləri Göstər
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredAchievements.map((item) => {
                const isUnlocked = unlockedIds.has(item.id);
                const theme = TIER_THEMES[item.tier];

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-[20px] border transition-all duration-200 flex flex-col justify-between gap-3 relative overflow-hidden select-none ${
                      isUnlocked
                        ? `${theme.cardBgUnlocked} ${theme.cardBorderUnlocked} ${theme.glowShadow} hover:-translate-y-0.5`
                        : `${theme.cardBgLocked} ${theme.cardBorderLocked} opacity-80 hover:opacity-100`
                    }`}
                  >
                    <div>
                      {/* Header: Icon, Title & Tier Badge */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-[8px] flex items-center justify-center font-bold text-sm shrink-0 border ${
                              isUnlocked ? theme.iconBoxUnlocked : theme.iconBoxLocked
                            }`}
                          >
                            <i className={`fa-solid ${item.icon}`} />
                          </div>

                          <div className="min-w-0">
                            <h4 className="font-extrabold text-sm text-zinc-950 dark:text-white leading-tight truncate">
                              {item.title}
                            </h4>
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block font-mono">
                              ID: {item.id}
                            </span>
                          </div>
                        </div>

                        {/* Tier Badge */}
                        <div
                          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
                        >
                          <span dangerouslySetInnerHTML={{ __html: theme.emoji }} />
                          <span>{theme.label}</span>
                        </div>
                      </div>

                      {/* Precise Objective Description */}
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    {/* Footer: XP, Gold Coins & Unlocked Status */}
                    <div className="pt-2.5 border-t border-zinc-200/60 dark:border-zinc-800/80 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Coins className="w-3 h-3" />
                          +{item.coinReward} <span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M10 10h4"/><path d="M10 14h4"/></svg></span>
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                        <span className="font-bold text-purple-600 dark:text-purple-400">
                          +{item.xp} XP
                        </span>
                      </div>

                      <div>
                        {isUnlocked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25">
                            <CheckCircle2 className="w-3 h-3" />
                            AÇIQDIR
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 bg-zinc-200/50 dark:bg-zinc-800/60 px-2 py-0.5 rounded-full border border-zinc-300/60 dark:border-zinc-700/60">
                            <Lock className="w-3 h-3" />
                            KİLİDLİ
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── FIXED FOOTER ──────────────────────────────────────────── */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold">Toplam 72 Nailiyyət</span>
            <span>•</span>
            <span className="hidden sm:inline">5 Səviyyə üzrə balanslaşdırılmış tərəqqi sistemi</span>
          </div>
          <Button variant="primary" size="sm" onClick={onClose}>
            Başa Düşdüm
          </Button>
        </div>
      </div>
    </div>
  );
};
