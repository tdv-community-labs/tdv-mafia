/**
 * TDV BTL MAFIA - Unified Progression & Retention Manager
 * Orchestrates 1-100+ Level Curve, 7-Tier Ranked Ladder with Demotion Shields,
 * Real-time Achievement Sync, and Battleground Prestige Cosmetics.
 */

import {
  RankTier,
  RankTierDefinition,
  CosmeticBorder,
  CosmeticTitle,
  XPGainEvent,
  LevelProgress,
  PlayerProgressionProfile,
  GhostPredictionBet,
} from '../types/progression';

// ─────────────────────────────────────────────────────────────────────────────
// 1. RANK TIER DEFINITIONS (7 TIERS)
// ─────────────────────────────────────────────────────────────────────────────

export const RANK_TIERS: Record<RankTier, RankTierDefinition> = {
  NOVICE_DETECTIVE: {
    tier: 'NOVICE_DETECTIVE',
    nameAz: 'Acemi Xəfiyyə',
    minElo: 0,
    maxElo: 1099,
    badgeIcon: 'fa-shield-halved',
    borderStyle: 'border-zinc-500/60 shadow-[0_0_8px_rgba(113,113,122,0.3)]',
    badgeBg: 'bg-zinc-800/80 border-zinc-600/50',
    textColor: 'text-zinc-300',
    shadowGlow: 'rgba(113,113,122,0.4)',
  },
  DEPUTY_INQUISITOR: {
    tier: 'DEPUTY_INQUISITOR',
    nameAz: 'Müstəntiq Köməkçisi',
    minElo: 1100,
    maxElo: 1299,
    badgeIcon: 'fa-magnifying-glass',
    borderStyle: 'border-cyan-500/70 shadow-[0_0_10px_rgba(6,182,212,0.4)]',
    badgeBg: 'bg-cyan-950/80 border-cyan-500/60',
    textColor: 'text-cyan-300',
    shadowGlow: 'rgba(6,182,212,0.5)',
  },
  HIGH_MAGISTRATE: {
    tier: 'HIGH_MAGISTRATE',
    nameAz: 'Ali Hakim',
    minElo: 1300,
    maxElo: 1499,
    badgeIcon: 'fa-scale-balanced',
    borderStyle: 'border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.5)]',
    badgeBg: 'bg-amber-950/80 border-amber-500/60',
    textColor: 'text-amber-300',
    shadowGlow: 'rgba(245,158,11,0.6)',
  },
  SYNDICATE_ENFORCER: {
    tier: 'SYNDICATE_ENFORCER',
    nameAz: 'Sindikat Cəzaçısı',
    minElo: 1500,
    maxElo: 1699,
    badgeIcon: 'fa-crosshairs',
    borderStyle: 'border-rose-600/80 shadow-[0_0_14px_rgba(225,29,72,0.5)]',
    badgeBg: 'bg-rose-950/80 border-rose-600/60',
    textColor: 'text-rose-300',
    shadowGlow: 'rgba(225,29,72,0.6)',
  },
  UNDERBOSS: {
    tier: 'UNDERBOSS',
    nameAz: 'Vitse-Don',
    minElo: 1700,
    maxElo: 1899,
    badgeIcon: 'fa-chess-knight',
    borderStyle: 'border-purple-500/85 shadow-[0_0_16px_rgba(168,85,247,0.6)]',
    badgeBg: 'bg-purple-950/80 border-purple-500/60',
    textColor: 'text-purple-300',
    shadowGlow: 'rgba(168,85,247,0.7)',
  },
  SYNDICATE_DON: {
    tier: 'SYNDICATE_DON',
    nameAz: 'Sindikat Donu',
    minElo: 1900,
    maxElo: 2199,
    badgeIcon: 'fa-crown',
    borderStyle: 'border-emerald-500/90 shadow-[0_0_18px_rgba(16,185,129,0.7)]',
    badgeBg: 'bg-emerald-950/80 border-emerald-500/70',
    textColor: 'text-emerald-300',
    shadowGlow: 'rgba(16,185,129,0.8)',
  },
  SUPREME_GODFATHER: {
    tier: 'SUPREME_GODFATHER',
    nameAz: 'Ali Xaçatası',
    minElo: 2200,
    maxElo: 9999,
    badgeIcon: 'fa-fire-flame-curved',
    borderStyle: 'border-gradient-gold animate-pulse border-amber-300 shadow-[0_0_24px_rgba(252,211,77,0.9)]',
    badgeBg: 'bg-gradient-to-r from-amber-900/90 via-rose-950/90 to-amber-900/90 border-amber-400/80',
    textColor: 'text-amber-200 font-black',
    shadowGlow: 'rgba(252,211,77,1)',
  },
};

export const RANK_ORDER: readonly RankTier[] = [
  'NOVICE_DETECTIVE',
  'DEPUTY_INQUISITOR',
  'HIGH_MAGISTRATE',
  'SYNDICATE_ENFORCER',
  'UNDERBOSS',
  'SYNDICATE_DON',
  'SUPREME_GODFATHER',
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. COSMETIC BORDERS & TITLES REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export const COSMETIC_BORDERS: readonly CosmeticBorder[] = [
  {
    id: 'border_default',
    name: 'Klassik Metal',
    description: 'Sadə və etibarlı xəfiyyə çərçivəsi',
    cssClass: 'border-zinc-600/50 shadow-none',
    glowStyle: 'rgba(113,113,122,0.2)',
    rarity: 'COMMON',
  },
  {
    id: 'border_bronze',
    name: 'Bürünc Qalxan',
    description: 'Acemi Xəfiyyələr üçün möhkəmləndirilmiş çərçivə',
    requiredRank: 'NOVICE_DETECTIVE',
    cssClass: 'border-amber-800/80 shadow-[0_0_10px_rgba(180,83,9,0.4)]',
    glowStyle: 'rgba(180,83,9,0.4)',
    rarity: 'COMMON',
  },
  {
    id: 'border_cyan_neon',
    name: 'Kiber Neon',
    description: 'Neo-Bakı küçələrindən gələn mavi spektr',
    requiredRank: 'DEPUTY_INQUISITOR',
    cssClass: 'border-cyan-400/90 shadow-[0_0_14px_rgba(6,182,212,0.6)] ring-1 ring-cyan-400/50',
    glowStyle: 'rgba(6,182,212,0.6)',
    rarity: 'RARE',
  },
  {
    id: 'border_golden_law',
    name: 'Qanunun Qızıl Qılıncı',
    description: 'Ali Məhkəmənin ədalət şüası',
    requiredRank: 'HIGH_MAGISTRATE',
    cssClass: 'border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.7)] ring-1 ring-amber-300/60',
    glowStyle: 'rgba(251,191,36,0.7)',
    rarity: 'EPIC',
  },
  {
    id: 'border_blood_syndicate',
    name: 'Qanlı Sindikat Aurası',
    description: 'Düşmənlərə qorxu saçan qırmızı qırpınma',
    requiredRank: 'SYNDICATE_ENFORCER',
    cssClass: 'border-rose-600 shadow-[0_0_20px_rgba(225,29,72,0.8)] ring-2 ring-rose-500/60',
    glowStyle: 'rgba(225,29,72,0.8)',
    rarity: 'EPIC',
  },
  {
    id: 'border_underboss_amethyst',
    name: 'Ametist Hökmranlığı',
    description: 'Vitse-Donların elit sirli aurası',
    requiredRank: 'UNDERBOSS',
    cssClass: 'border-purple-400 shadow-[0_0_22px_rgba(192,132,252,0.85)] ring-2 ring-purple-300/70',
    glowStyle: 'rgba(192,132,252,0.85)',
    rarity: 'LEGENDARY',
  },
  {
    id: 'border_emerald_don',
    name: 'Zümrüd Don Tacı',
    description: 'Yeraltı dünyanın rəhbəri üçün zümrüd parıltısı',
    requiredRank: 'SYNDICATE_DON',
    cssClass: 'border-emerald-400 shadow-[0_0_26px_rgba(52,211,153,0.9)] ring-2 ring-emerald-300/80 animate-pulse',
    glowStyle: 'rgba(52,211,153,0.9)',
    rarity: 'LEGENDARY',
  },
  {
    id: 'border_godfather_chromatic',
    name: 'Xaçatası Əbədi Xromatik Alovu',
    description: 'Mütləq hegemonluğun simvolu olan xromatik alov',
    requiredRank: 'SUPREME_GODFATHER',
    cssClass: 'border-amber-300 shadow-[0_0_32px_rgba(252,211,77,1)] ring-2 ring-amber-200 animate-pulse',
    glowStyle: 'rgba(252,211,77,1)',
    rarity: 'MYTHIC',
  },
];

export const COSMETIC_TITLES: readonly CosmeticTitle[] = [
  {
    id: 'title_novice',
    name: 'Acemi Xəfiyyə',
    description: 'Araşdırmaya yeni başlayan şəhərli',
    textColor: 'text-zinc-300',
    badgeBg: 'bg-zinc-800/80 border border-zinc-600/50',
  },
  {
    id: 'title_detective',
    name: 'Şəhər Xəfiyyəsi',
    description: 'İzləri təqib edən ayıq detektiv',
    requiredRank: 'DEPUTY_INQUISITOR',
    textColor: 'text-cyan-300',
    badgeBg: 'bg-cyan-950/80 border border-cyan-500/60',
  },
  {
    id: 'title_inquisitor',
    name: 'Ali Hakim',
    description: 'Məhkəmə zalında hökm oxuyan hakim',
    requiredRank: 'HIGH_MAGISTRATE',
    textColor: 'text-amber-300',
    badgeBg: 'bg-amber-950/80 border border-amber-500/60',
  },
  {
    id: 'title_enforcer',
    name: 'Sindikat Cəzaçısı',
    description: 'Səssiz və dəqiq qatil',
    requiredRank: 'SYNDICATE_ENFORCER',
    textColor: 'text-rose-300',
    badgeBg: 'bg-rose-950/80 border border-rose-500/60',
  },
  {
    id: 'title_underboss',
    name: 'Vitse-Don',
    description: 'Donun ən etibarlı sağ qolu',
    requiredRank: 'UNDERBOSS',
    textColor: 'text-purple-300',
    badgeBg: 'bg-purple-950/80 border border-purple-500/60',
  },
  {
    id: 'title_don',
    name: 'Sindikat Donu',
    description: 'Yeraltı şəhərin gizli ağası',
    requiredRank: 'SYNDICATE_DON',
    textColor: 'text-emerald-300',
    badgeBg: 'bg-emerald-950/80 border border-emerald-500/60',
  },
  {
    id: 'title_godfather',
    name: 'Ali Xaçatası',
    description: 'TDV Mafia əfsanəsi',
    requiredRank: 'SUPREME_GODFATHER',
    textColor: 'text-amber-200 font-bold',
    badgeBg: 'bg-gradient-to-r from-amber-900 via-rose-900 to-amber-900 border border-amber-300/80',
  },
  {
    id: 'title_doctor_miracle',
    name: 'Möcüzə Həkimi',
    description: 'Ölümün pəncəsindən xilas edən',
    achievementId: 'town_doctor_miracle_save',
    textColor: 'text-teal-300',
    badgeBg: 'bg-teal-950/80 border border-teal-500/60',
  },
  {
    id: 'title_ghost_whisperer',
    name: 'Kabus Fısıltısı',
    description: 'Məzarlıqdan gələcəyi görən',
    textColor: 'text-indigo-300',
    badgeBg: 'bg-indigo-950/80 border border-indigo-500/60',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. LEVEL CURVE FORMULA: XP_needed(L) = floor(100 * L^1.5)
// ─────────────────────────────────────────────────────────────────────────────

export function getXpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += Math.floor(100 * Math.pow(l, 1.5));
  }
  return total;
}

export function calculateLevelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  let level = 1;
  let accumulated = 0;
  while (true) {
    const costForNext = Math.floor(100 * Math.pow(level, 1.5));
    if (accumulated + costForNext > xp) {
      break;
    }
    accumulated += costForNext;
    level++;
    if (level >= 999) break;
  }
  return level;
}

export function getLevelProgress(totalXp: number): LevelProgress {
  const level = calculateLevelFromXp(totalXp);
  const currentLevelFloorXp = getXpForLevel(level);
  const nextLevelCeilXp = getXpForLevel(level + 1);
  const neededForLevel = Math.max(1, nextLevelCeilXp - currentLevelFloorXp);
  const earnedInLevel = Math.max(0, totalXp - currentLevelFloorXp);
  const progressPercentage = Math.min(100, Math.max(0, (earnedInLevel / neededForLevel) * 100));

  return {
    level,
    currentLevelXp: earnedInLevel,
    nextLevelXp: neededForLevel,
    progressPercentage: Math.round(progressPercentage * 10) / 10,
    totalXp,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. RANK TIER CALCULATION & DEMOTION SHIELD
// ─────────────────────────────────────────────────────────────────────────────

export function calculateRankTierFromElo(elo: number): RankTier {
  for (let i = RANK_ORDER.length - 1; i >= 0; i--) {
    const tier = RANK_ORDER[i];
    if (elo >= RANK_TIERS[tier].minElo) {
      return tier;
    }
  }
  return 'NOVICE_DETECTIVE';
}

export function applyEloAdjustment(
  currentElo: number,
  currentTier: RankTier,
  eloDelta: number,
  currentLosingStreak: number
): {
  newElo: number;
  newTier: RankTier;
  demotionShieldActive: boolean;
  newLosingStreak: number;
} {
  const newElo = Math.max(0, currentElo + eloDelta);
  const rawTier = calculateRankTierFromElo(newElo);
  const rawTierIndex = RANK_ORDER.indexOf(rawTier);
  const currentTierIndex = RANK_ORDER.indexOf(currentTier);

  const isLoss = eloDelta < 0;
  const newLosingStreak = isLoss ? currentLosingStreak + 1 : 0;

  // Demotion shield evaluation:
  // If player would demote (rawTierIndex < currentTierIndex):
  // Check if they are within 25 ELO of current tier's minElo AND losing streak < 3
  if (rawTierIndex < currentTierIndex) {
    const tierMinElo = RANK_TIERS[currentTier].minElo;
    const isWithinShieldThreshold = newElo >= tierMinElo - 35;
    if (isWithinShieldThreshold && newLosingStreak < 3) {
      // Shield saves the tier!
      return {
        newElo,
        newTier: currentTier,
        demotionShieldActive: true,
        newLosingStreak,
      };
    }
  }

  return {
    newElo,
    newTier: rawTier,
    demotionShieldActive: false,
    newLosingStreak,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. UNIFIED STORAGE & MIGRATION (Resolves Achievement Loss Bug)
// ─────────────────────────────────────────────────────────────────────────────

const PROGRESSION_STORAGE_PREFIX = 'tdv_mafia_progression_';
const OLD_STATS_PREFIX = 'mafia_stats_';
const OLD_ACHIEVEMENTS_KEY = 'tdv_mafia_unlocked_achievements';

const listeners = new Set<(profile: PlayerProgressionProfile) => void>();

export function subscribeToProgression(callback: (profile: PlayerProgressionProfile) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners(profile: PlayerProgressionProfile) {
  listeners.forEach((cb) => {
    try {
      cb(profile);
    } catch (err) {
      console.error('[ProgressionManager] Listener error:', err);
    }
  });
}

export function getPlayerProgression(userId: string, defaultUsername: string = 'Oyunçu'): PlayerProgressionProfile {
  const defaultProfile: PlayerProgressionProfile = {
    userId,
    username: defaultUsername,
    xp: 0,
    level: 1,
    elo: 1200,
    rankTier: 'DEPUTY_INQUISITOR',
    demotionShieldActive: false,
    losingStreak: 0,
    unlockedAchievements: [],
    equippedCosmetics: {
      borderId: 'border_default',
      titleId: 'title_novice',
    },
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    mafiaWins: 0,
    townWins: 0,
    neutralWins: 0,
    playedLobbies: [],
    spiritEssence: 100, // Starting essence for spectator prediction bets
  };

  if (typeof window === 'undefined') {
    return defaultProfile;
  }

  // 1. Check unified storage
  const rawUnified = localStorage.getItem(`${PROGRESSION_STORAGE_PREFIX}${userId}`);
  if (rawUnified) {
    try {
      const parsed = JSON.parse(rawUnified);
      return {
        ...defaultProfile,
        ...parsed,
        level: calculateLevelFromXp(parsed.xp ?? 0),
        rankTier: calculateRankTierFromElo(parsed.elo ?? 1200),
        spiritEssence: parsed.spiritEssence ?? 100,
      };
    } catch {
      // ignore
    }
  }

  // 2. Migration from legacy stats and achievements
  const rawOldStats = localStorage.getItem(`${OLD_STATS_PREFIX}${userId}`);
  let oldStats: Record<string, unknown> = {};
  if (rawOldStats) {
    try {
      oldStats = JSON.parse(rawOldStats);
    } catch {
      // ignore
    }
  }

  const rawOldAch = localStorage.getItem(OLD_ACHIEVEMENTS_KEY);
  let oldAchievements: string[] = [];
  if (rawOldAch) {
    try {
      const parsed = JSON.parse(rawOldAch);
      if (Array.isArray(parsed)) {
        oldAchievements = parsed;
      }
    } catch {
      // ignore
    }
  }

  const migratedXp = Number(oldStats.xp ?? 0);
  const migratedElo = Number(oldStats.elo ?? 1200);

  const migratedProfile: PlayerProgressionProfile = {
    ...defaultProfile,
    xp: migratedXp,
    level: calculateLevelFromXp(migratedXp),
    elo: migratedElo,
    rankTier: calculateRankTierFromElo(migratedElo),
    gamesPlayed: Number(oldStats.gamesPlayed ?? 0),
    wins: Number(oldStats.wins ?? 0),
    losses: Number(oldStats.losses ?? 0),
    mafiaWins: Number(oldStats.mafiaWins ?? 0),
    townWins: Number(oldStats.townWins ?? 0),
    neutralWins: Number(oldStats.neutralWins ?? 0),
    playedLobbies: Array.isArray(oldStats.playedLobbies) ? (oldStats.playedLobbies as string[]) : [],
    unlockedAchievements: oldAchievements,
  };

  // Persist migrated profile
  savePlayerProgression(migratedProfile);
  return migratedProfile;
}

export function savePlayerProgression(profile: PlayerProgressionProfile): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(`${PROGRESSION_STORAGE_PREFIX}${profile.userId}`, JSON.stringify(profile));
    // Backward compatibility sync for legacy code
    localStorage.setItem(
      `${OLD_STATS_PREFIX}${profile.userId}`,
      JSON.stringify({
        xp: profile.xp,
        level: profile.level,
        elo: profile.elo,
        gamesPlayed: profile.gamesPlayed,
        wins: profile.wins,
        losses: profile.losses,
        mafiaWins: profile.mafiaWins,
        townWins: profile.townWins,
        neutralWins: profile.neutralWins,
        playedLobbies: profile.playedLobbies,
      })
    );
    localStorage.setItem(OLD_ACHIEVEMENTS_KEY, JSON.stringify(profile.unlockedAchievements));
  } catch (err) {
    console.error('[ProgressionManager] Failed to persist profile:', err);
  }

  notifyListeners(profile);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. RECORDING MATCH RESULTS & CLUTCH XP GAINS
// ─────────────────────────────────────────────────────────────────────────────

export function recordMatchProgression(
  userId: string,
  lobbyId: string,
  isWin: boolean,
  faction: string,
  clutchEvents: readonly XPGainEvent[] = []
): {
  profile: PlayerProgressionProfile;
  xpGained: number;
  eloChange: number;
  newAchievementsUnlocked: string[];
} {
  const profile = getPlayerProgression(userId);

  // If already rewarded for this lobby, return current state
  if (profile.playedLobbies.includes(lobbyId)) {
    return {
      profile,
      xpGained: 0,
      eloChange: 0,
      newAchievementsUnlocked: [],
    };
  }

  // Base Victory / Defeat rewards
  let baseXp = 0;
  let baseEloDelta = 0;

  if (isWin) {
    if (faction === 'MAFIA' || faction === 'YAKUZA') {
      baseXp = 250;
      baseEloDelta = 30;
    } else if (faction === 'TOWN') {
      baseXp = 200;
      baseEloDelta = 25;
    } else {
      baseXp = 225;
      baseEloDelta = 28;
    }
  } else {
    baseXp = 50; // Participation reward
    baseEloDelta = -15;
  }

  // Add Clutch in-game XP bonuses
  const clutchXp = clutchEvents.reduce((acc, event) => acc + event.xp, 0);
  const totalXpGained = baseXp + clutchXp;

  // Calculate ELO adjustment with demotion shield protection
  const { newElo, newTier, demotionShieldActive, newLosingStreak } = applyEloAdjustment(
    profile.elo,
    profile.rankTier,
    baseEloDelta,
    profile.losingStreak
  );

  const newTotalXp = profile.xp + totalXpGained;
  const newLevel = calculateLevelFromXp(newTotalXp);

  // Evaluate newly unlocked achievements based on game counters
  const unlockedAch = [...profile.unlockedAchievements];
  const newlyUnlocked: string[] = [];

  const checkUnlock = (id: string, condition: boolean) => {
    if (condition && !unlockedAch.includes(id)) {
      unlockedAch.push(id);
      newlyUnlocked.push(id);
    }
  };

  // Generic milestone achievements
  checkUnlock('general_first_match', profile.gamesPlayed + 1 >= 1);
  checkUnlock('general_ten_matches', profile.gamesPlayed + 1 >= 10);
  checkUnlock('general_fifty_matches', profile.gamesPlayed + 1 >= 50);
  checkUnlock('general_first_win', isWin && profile.wins + 1 >= 1);
  checkUnlock('town_first_win', isWin && faction === 'TOWN');
  checkUnlock('mafia_first_win', isWin && (faction === 'MAFIA' || faction === 'YAKUZA'));

  const updatedProfile: PlayerProgressionProfile = {
    ...profile,
    xp: newTotalXp,
    level: newLevel,
    elo: newElo,
    rankTier: newTier,
    demotionShieldActive,
    losingStreak: newLosingStreak,
    gamesPlayed: profile.gamesPlayed + 1,
    wins: profile.wins + (isWin ? 1 : 0),
    losses: profile.losses + (isWin ? 0 : 1),
    mafiaWins: profile.mafiaWins + (isWin && (faction === 'MAFIA' || faction === 'YAKUZA') ? 1 : 0),
    townWins: profile.townWins + (isWin && faction === 'TOWN' ? 1 : 0),
    neutralWins: profile.neutralWins + (isWin && faction.includes('NEUTRAL') ? 1 : 0),
    playedLobbies: [...profile.playedLobbies, lobbyId],
    unlockedAchievements: unlockedAch,
  };

  savePlayerProgression(updatedProfile);

  return {
    profile: updatedProfile,
    xpGained: totalXpGained,
    eloChange: baseEloDelta,
    newAchievementsUnlocked: newlyUnlocked,
  };
}

export function equipCosmeticItem(
  userId: string,
  type: 'BORDER' | 'TITLE',
  itemId: string
): PlayerProgressionProfile {
  const profile = getPlayerProgression(userId);

  const updatedEquipped = {
    ...profile.equippedCosmetics,
    ...(type === 'BORDER' ? { borderId: itemId } : { titleId: itemId }),
  };

  const updatedProfile: PlayerProgressionProfile = {
    ...profile,
    equippedCosmetics: updatedEquipped,
  };

  savePlayerProgression(updatedProfile);
  return updatedProfile;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. GHOST PREDICTION BETTING & SPIRIT ESSENCE
// ─────────────────────────────────────────────────────────────────────────────

const GHOST_BETS_STORAGE_KEY = 'tdv_mafia_ghost_bets_';

export function placeGhostBet(
  userId: string,
  lobbyId: string,
  bet: Omit<GhostPredictionBet, 'id' | 'resolved' | 'won'>
): { success: boolean; updatedProfile: PlayerProgressionProfile; betId?: string } {
  const profile = getPlayerProgression(userId);

  if (profile.spiritEssence < bet.wagerAmount) {
    return { success: false, updatedProfile: profile };
  }

  const betId = `bet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fullBet: GhostPredictionBet = {
    ...bet,
    id: betId,
    resolved: false,
  };

  // Deduct essence
  const updatedProfile: PlayerProgressionProfile = {
    ...profile,
    spiritEssence: profile.spiritEssence - bet.wagerAmount,
  };

  savePlayerProgression(updatedProfile);

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(`${GHOST_BETS_STORAGE_KEY}${lobbyId}`);
    const bets: GhostPredictionBet[] = raw ? JSON.parse(raw) : [];
    bets.push(fullBet);
    localStorage.setItem(`${GHOST_BETS_STORAGE_KEY}${lobbyId}`, JSON.stringify(bets));
  }

  return { success: true, updatedProfile, betId };
}

export function resolveGhostBets(
  userId: string,
  lobbyId: string,
  actualLynchedId?: string,
  actualWinningFaction?: string
): { profile: PlayerProgressionProfile; payout: number } {
  const profile = getPlayerProgression(userId);
  if (typeof window === 'undefined') return { profile, payout: 0 };

  const raw = localStorage.getItem(`${GHOST_BETS_STORAGE_KEY}${lobbyId}`);
  if (!raw) return { profile, payout: 0 };

  let bets: GhostPredictionBet[] = JSON.parse(raw);
  let totalPayout = 0;

  bets = bets.map((b) => {
    if (b.resolved || b.spectatorId !== userId) return b;

    let won = false;
    if (b.betType === 'NEXT_LYNCH' && actualLynchedId && b.targetPlayerId === actualLynchedId) {
      won = true;
    } else if (b.betType === 'WINNING_FACTION' && actualWinningFaction && b.predictedFaction === actualWinningFaction) {
      won = true;
    }

    if (won) {
      const winnings = Math.round(b.wagerAmount * b.oddsMultiplier);
      totalPayout += winnings;
    }

    return { ...b, resolved: true, won };
  });

  localStorage.setItem(`${GHOST_BETS_STORAGE_KEY}${lobbyId}`, JSON.stringify(bets));

  if (totalPayout > 0) {
    const updatedProfile: PlayerProgressionProfile = {
      ...profile,
      spiritEssence: profile.spiritEssence + totalPayout,
    };
    savePlayerProgression(updatedProfile);
    return { profile: updatedProfile, payout: totalPayout };
  }

  return { profile, payout: 0 };
}
