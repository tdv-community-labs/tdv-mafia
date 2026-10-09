'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Trophy,
  Layers,
  Plus,
  User as UserIcon,
  Gamepad2,
  GraduationCap,
  Home,
  ShieldCheck,
  Activity,
  Volume2,
  VolumeX,
  ChevronDown,
  ExternalLink,
  Coins,
  Medal,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ThemeToggle } from '../theme/ThemeToggle';
import { AuthModal, UserSessionState } from '../modals/AuthModal';
import { RulesModal } from '../modals/RulesModal';
import { LeaderboardModal } from '../modals/LeaderboardModal';
import { AchievementsModal } from '../modals/AchievementsModal';
import { GameModesCatalogModal } from '../modals/GameModesCatalogModal';
import { CreateRoomModal } from '../modals/CreateRoomModal';
import { ProfileModal } from '../modals/ProfileModal';
import { GameMode } from '../../types/packs';
import { isSoundMuted, toggleSound, subscribeSound, playCard } from '../../utils/sfx';
import { getPlayerStats, TITLES } from '../../utils/stats';

export const Navbar: React.FC = () => {
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [authInitialTab, setAuthInitialTab] = useState<'login' | 'register'>('login');
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState<boolean>(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState<boolean>(false);
  const [catalogSelectedMode, setCatalogSelectedMode] = useState<GameMode>('BLITZ');

  const [isEcoDropdownOpen, setIsEcoDropdownOpen] = useState<boolean>(false);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserSessionState | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Listen for open-tdv-auth custom events
  useEffect(() => {
    const handleOpenAuth = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: 'login' | 'register' }>;
      const tab = customEvent.detail?.tab || 'login';
      setAuthInitialTab(tab);
      setIsAuthOpen(true);
    };
    window.addEventListener('open-tdv-auth', handleOpenAuth);
    return () => window.removeEventListener('open-tdv-auth', handleOpenAuth);
  }, []);

  // Initialize sound mute state & subscribe to changes
  useEffect(() => {
    setSoundMuted(isSoundMuted());
    const unsubscribe = subscribeSound((muted) => {
      setSoundMuted(muted);
    });
    return () => unsubscribe();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsEcoDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // User session sync
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const ssoTicket = urlParams.get('sso_ticket');
        if (ssoTicket) {
          const decoded = JSON.parse(decodeURIComponent(escape(atob(ssoTicket))));
          if (decoded && (decoded.fullName || decoded.username)) {
            localStorage.setItem('tdv_ecosystem_session_v1', JSON.stringify(decoded));
            setCurrentUser({
              userId: decoded.id || "usr-anon",
              username: decoded.fullName || decoded.username,
              tier: 'TIER_1',
              roleTitle:
                decoded.role === 'teacher'
                  ? 'Müəllim'
                  : decoded.schoolClass
                  ? `${decoded.schoolClass} Oyunçusu`
                  : 'Klub Oyunçusu',
              gamesPlayed: 14,
              winRate: 75,
            });
            urlParams.delete('sso_ticket');
            const newSearch = urlParams.toString();
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash
            );
            return;
          }
        }
      }

      const ecoRaw = localStorage.getItem('tdv_ecosystem_session_v1');
      if (ecoRaw) {
        const ecoSess = JSON.parse(ecoRaw);
        if (ecoSess && (ecoSess.fullName || ecoSess.username)) {
          // Check if user is registered in tdv_registered_users_v1
          const regRaw = localStorage.getItem('tdv_registered_users_v1');
          if (regRaw) {
            try {
              const regList = JSON.parse(regRaw);
              const exists = Array.isArray(regList) && regList.some((u: any) =>
                u.username?.toLowerCase() === (ecoSess.username || '').toLowerCase()
              );
              if (!exists) {
                console.warn('[SSO] Ghost session detected in Mafia, clearing...');
                localStorage.removeItem('tdv_ecosystem_session_v1');
                localStorage.removeItem('tdv_mafia_user');
                setCurrentUser(null);
                return;
              }
            } catch(e) {}
          }

          setCurrentUser({
            userId: ecoSess.id || "usr-anon",
            username: ecoSess.fullName || ecoSess.username,
            tier: 'TIER_1',
            roleTitle:
              ecoSess.role === 'teacher'
                ? 'Müəllim'
                : ecoSess.schoolClass
                ? `${ecoSess.schoolClass} Oyunçusu`
                : 'Klub Oyunçusu',
            gamesPlayed: 14,
            winRate: 75,
          });
          return;
        }
      }
    } catch {
      // Storage unavailable
    }
  }, []);

  const handleLogin = (user: UserSessionState) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('tdv_mafia_user', JSON.stringify(user));
      localStorage.setItem(
        'tdv_ecosystem_session_v1',
        JSON.stringify({
          userId: 'tdv-usr-' + Date.now().toString(36),
          username: user.username,
          fullName: user.username,
          role: 'player',
          grade: 10,
          avatar: '🕵️',
          token: 'sec_' + Math.random().toString(36).substring(2),
          createdAt: Date.now(),
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        })
      );
    } catch {
      // Storage unavailable
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('tdv_mafia_user');
      localStorage.removeItem('tdv_ecosystem_session_v1');
      const BROKER_URL = 'https://tdv-community-labs.github.io/tdv-hub/sso-broker.html';
      let iframe = document.getElementById('tdv_sso_broker_bridge') as HTMLIFrameElement;
      const registeredList = JSON.parse(localStorage.getItem('tdv_registered_users_v1') || '[]');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'TDV_SSO_SET', session: null, users: registeredList }, '*');
      }
    } catch {
      // Storage unavailable
    }
    setIsAuthOpen(false);
  };

  const handleSoundToggle = () => {
    const nextMuted = toggleSound();
    setSoundMuted(nextMuted);
    if (!nextMuted) {
      playCard();
    }
  };

  const getEcoLink = (url: string) => {
    try {
      const raw = localStorage.getItem('tdv_ecosystem_session_v1');
      if (raw) {
        const sess = JSON.parse(raw);
        if (sess && (sess.fullName || sess.username)) {
          const ticket = btoa(unescape(encodeURIComponent(JSON.stringify(sess))));
          const separator = url.includes('?') ? '&' : '?';
          return `${url}${separator}sso_ticket=${encodeURIComponent(ticket)}`;
        }
      }
    } catch {}
    return url;
  };

  return (
    <header className="sticky top-4 z-[100] w-full max-w-[85rem] mx-auto px-4 sm:px-6 transition-colors duration-200 pointer-events-none">
      {/* ─── MAIN AAA NAVBAR ─────────────────────────────────────────── */}
      <nav className="w-full pointer-events-auto bg-white/70 dark:bg-zinc-950/60 backdrop-blur-3xl border border-white/20 dark:border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(168,85,247,0.15)] rounded-[24px]">
        
        {/* ─── LEFT: BRAND & LIVE NODE INDICATORS ──────────────────── */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <a href="/" className="flex items-center gap-2.5 group select-none">
            <div className="relative">
              <img
                src="/assets/tdv-logo.png"
                alt="TDV Logo"
                className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-600/50 group-hover:ring-purple-500 shadow-md shadow-purple-600/25 transition-all duration-200 group-hover:scale-105"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-purple-600 rounded-full border-2 border-white dark:border-zinc-950 animate-pulse" />
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base sm:text-lg tracking-tight text-zinc-950 dark:text-white leading-tight">
                  <span className="hidden sm:inline">TDV BTL </span><span className="text-red-600 dark:text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">MAFIA</span>
                </span>
                <span className="hidden xs:inline-flex text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-600/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30">
                  PRO
                </span>
              </div>
              <span className="text-[10px] font-extrabold tracking-widest text-amber-600 dark:text-amber-400 uppercase hidden min-[400px]:inline">
                Bakı Türk Liseyi
              </span>
            </div>
          </a>

          {/* Live Node Indicators */}
          <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-zinc-200 dark:border-zinc-800 text-xs">
            <div
              title="Bakı Server Klasteri Gecikməsi"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 font-semibold text-[11px]"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Activity className="w-3 h-3 text-emerald-500" />
              <span>Bakı Node-01</span>
              <span className="text-[10px] opacity-75 font-mono">(16ms)</span>
            </div>

            <div
              title="Anti-AFK və Ağıllı Bot Mühafizəsi"
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 font-semibold text-[11px]"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Anti-AFK Gemini 3.8</span>
            </div>
          </div>
        </div>

        {/* ─── CENTER: MAFIA NAVIGATION & ECOSYSTEM DROPDOWN ─────────── */}
        <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
          {/* Formats Button */}
          <button
            type="button"
            onClick={() => {
              playCard();
              setIsCatalogOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-all duration-150 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Formatlar</span>
            <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-purple-600/15 text-purple-700 dark:text-purple-300 border border-purple-500/25">
              15 Rejim
            </span>
          </button>

          {/* Rules Button */}
          <button
            type="button"
            onClick={() => {
              playCard();
              setIsRulesOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-all duration-150 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-red-500" />
            <span>Qaydalar</span>
            <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20">
              24 Rol
            </span>
          </button>

          {/* Leaderboard Button */}
          <button
            type="button"
            onClick={() => {
              playCard();
              setIsLeaderboardOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-all duration-150 cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>Canlı Reytinq</span>
          </button>

          {/* Achievements Button */}
          <button
            type="button"
            onClick={() => {
              playCard();
              setIsAchievementsOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-all duration-150 cursor-pointer"
          >
            <Medal className="w-3.5 h-3.5 text-amber-500" />
            <span>Nailiyyətlər</span>
            <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              72
            </span>
          </button>

          {/* TDV Ekosistemi Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsEcoDropdownOpen(!isEcoDropdownOpen)}
              onMouseEnter={() => setIsEcoDropdownOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150 cursor-pointer ${
                isEcoDropdownOpen
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white border-zinc-300 dark:border-zinc-700'
                  : 'bg-transparent text-zinc-700 dark:text-zinc-300 border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              }`}
            >
              <span>TDV Ekosistemi</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isEcoDropdownOpen ? 'rotate-180 text-red-500' : 'text-zinc-400'
                }`}
              />
            </button>

            {/* Dropdown Menu Card */}
            {isEcoDropdownOpen && (
              <div
                onMouseLeave={() => setIsEcoDropdownOpen(false)}
                className="absolute top-full left-0 mt-2 w-72 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl z-50 animate-fadeIn flex flex-col gap-1"
              >
                <div className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800/80 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                  Bakı Türk Liseyi Portalları
                </div>

                {/* Hub */}
                <a
                  href={getEcoLink("https://tdv-community-labs.github.io/tdv-hub/")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-600/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20 group-hover:scale-105 transition-transform">
                    <Home className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        TDV Mərkəz
                      </span>
                      <ExternalLink className="w-3 h-3 text-zinc-400 group-hover:text-purple-500 opacity-60" />
                    </div>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                      Bütün lisey tətbiqləri və SSO vahid profil
                    </span>
                  </div>
                </a>

                {/* E-School */}
                <a
                  href={getEcoLink("https://tdv-e-school.vercel.app/")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        E-School
                      </span>
                      <ExternalLink className="w-3 h-3 text-zinc-400 group-hover:text-emerald-500 opacity-60" />
                    </div>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                      Şagird & Müəllim elektron təhsil portalı
                    </span>
                  </div>
                </a>

                {/* Sports */}
                <a
                  href={getEcoLink("https://school-minifootball-tournament.vercel.app/")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 group-hover:scale-105 transition-transform">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        Sports Arena
                      </span>
                      <ExternalLink className="w-3 h-3 text-zinc-400 group-hover:text-amber-500 opacity-60" />
                    </div>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                      Lisey çempionatları & futbol turnirləri
                    </span>
                  </div>
                </a>

                {/* Games */}
                <a
                  href={getEcoLink("https://tdv-games.vercel.app/")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-500/20 group-hover:scale-105 transition-transform">
                    <Gamepad2 className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                        TDV Games
                      </span>
                      <span className="text-[9px] font-black bg-purple-600 text-white px-1 rounded">
                        Portal
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                      Lisey intellektual oyun mərkəzi
                    </span>
                  </div>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: CTA, SOUND, THEME & USER AUTH ─────────────────── */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          
          {/* Red Glowing CTA "+ Masa Yarat" */}
          <button
            type="button"
            onClick={() => {
              playCard();
              setIsCreateRoomOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 shadow-md shadow-red-600/30 hover:shadow-red-600/50 hover:shadow-lg transition-all duration-200 active:scale-95 cursor-pointer border border-red-400/30"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span className="tracking-wide hidden xs:inline">Masa Yarat</span>
          </button>

          {/* Sound Toggle (Web Audio API) */}
          <button
            type="button"
            onClick={handleSoundToggle}
            title={soundMuted ? 'Səsi Aç (Web Audio SFX)' : 'Səsi Bağla'}
            aria-label={soundMuted ? 'Səsi Aç' : 'Səsi Bağla'}
            className={`hidden sm:inline-flex p-2 rounded-xl border transition-all duration-200 cursor-pointer ${
              soundMuted
                ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-zinc-400 hover:text-red-500'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 shadow-sm'
            }`}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Dual Theme Toggle */}
          <ThemeToggle />

          {/* User Profile / Auth Button */}
          {currentUser ? (
            <div
              onClick={() => setIsAuthOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/90 dark:bg-zinc-900/90 hover:bg-zinc-200 dark:hover:bg-zinc-800/80 cursor-pointer transition-all duration-200 select-none shadow-sm"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                {currentUser.username.charAt(0).toUpperCase()}
              </div>

              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-none truncate max-w-[100px]">
                  {currentUser.username}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight flex items-center gap-1 mt-0.5">
                  <Coins className="w-2.5 h-2.5 text-amber-500" />
                  1,250 🪙
                </span>
              </div>

              <Badge
                tone={
                  currentUser.tier === 'TIER_3'
                    ? 'purple'
                    : currentUser.tier === 'TIER_2'
                    ? 'amber'
                    : 'neutral'
                }
                className="hidden md:inline-flex text-[10px] px-1.5 py-0"
              >
                {currentUser.tier}
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setAuthInitialTab('login');
                  setIsAuthOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all duration-150 cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5 text-zinc-500" />
                <span className="hidden xs:inline">Daxil Ol</span>
                <span className="xs:hidden text-xs">Giriş</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthInitialTab('register');
                  setIsAuthOpen(true);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-all duration-150 cursor-pointer"
              >
                <span>Qeydiyyat</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Global Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        initialTab={authInitialTab}
        currentUser={currentUser}
        onClose={() => setIsAuthOpen(false)}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      <LeaderboardModal isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} />

      <AchievementsModal
        isOpen={isAchievementsOpen}
        onClose={() => setIsAchievementsOpen(false)}
      />

      <GameModesCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        onSelectMode={(mode) => {
          setCatalogSelectedMode(mode);
          setIsCreateRoomOpen(true);
        }}
      />


      <ProfileModal 
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUsername={currentUser?.username || ''}
        onUpdateUsername={(name) => {
          if (currentUser) {
            setCurrentUser({ ...currentUser, username: name });
            localStorage.setItem('mafia_username', name);
            window.dispatchEvent(new CustomEvent('update_username', { detail: name }));
          }
        }}
        tier={currentUser?.tier || 'TIER_1'}
        totalXp={0}
        userId={currentUser?.userId}
      />
      <CreateRoomModal
        isOpen={isCreateRoomOpen}
        defaultMode={catalogSelectedMode}
        onClose={() => setIsCreateRoomOpen(false)}
      />
    </header>
  );
};