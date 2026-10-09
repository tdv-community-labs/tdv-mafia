'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Dices,
  Key,
  BookOpen,
  Layers,
  Users,
  ArrowRight,
  Shield,
  Clock,
  Trophy,
  X,
  Sparkles,
  Award,
} from 'lucide-react';
import { GameMode } from '../types/packs';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { CreateRoomModal } from '../components/modals/CreateRoomModal';
import { RulesModal } from '../components/modals/RulesModal';
import { LeaderboardModal } from '../components/modals/LeaderboardModal';
import { AchievementsModal } from '../components/modals/AchievementsModal';
import { GameModesCatalogModal } from '../components/modals/GameModesCatalogModal';
import { PublicRoomSummary } from '../types/rooms';

import { motion } from 'framer-motion';

export default function HomePage() {
  const router = useRouter();
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState<boolean>(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [selectedPackForModal, setSelectedPackForModal] = useState<GameMode>('BLITZ');

  // Join by room code
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [isJoinByCodeOpen, setIsJoinByCodeOpen] = useState<boolean>(false);

  // Live state tracking
  const [activeRooms, setActiveRooms] = useState<PublicRoomSummary[]>([]);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch('/api/rooms');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.rooms)) {
            setActiveRooms(data.rooms);
          }
        }
      } catch {
        // Network resilience
      }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, []);

  const openCreateModal = (mode?: GameMode) => {
    if (mode) setSelectedPackForModal(mode);
    setIsCreateRoomOpen(true);
  };

  const handleJoinByCode = () => {
    const code = roomCodeInput.trim();
    if (!code) return;
    router.push(`/lobby/${encodeURIComponent(code)}`);
  };

  return (
    <div className="flex flex-col gap-8 pb-16 max-w-7xl mx-auto px-4 sm:px-6 pt-6 transition-colors duration-200">
      {/* ─── HERO BANNER ─────────────────────────────────────────────── */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="relative overflow-hidden rounded-[2rem] border border-black/5 dark:border-white/5 bg-white/80 dark:bg-zinc-950/40 backdrop-blur-3xl shadow-2xl p-6 sm:p-10 lg:p-12 group">
        {/* Subtle Ambient Glows */}
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-purple-600/10 dark:bg-purple-600/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-80 h-80 rounded-full bg-red-600/10 dark:bg-red-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl flex flex-col items-start gap-4">
          {/* Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-900 dark:text-purple-200 text-xs font-bold tracking-wide">
            <img
              src="/assets/tdv-logo.png"
              alt="TDV Logo"
              className="w-4 h-4 rounded-full border border-purple-400 object-cover"
            />
            <span>TDV Community Labs • Mafia Klubu</span>
            <span className="opacity-40">•</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Mövsüm #1
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-950 dark:text-white leading-[1.1]">
            TDV BTL <span className="text-red-600 dark:text-red-500">MAFIA</span>
          </h1>

          {/* Subtitle description (WCAG AA compliant contrast) */}
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 max-w-2xl leading-relaxed">
            Kölgələrin idarə etdiyi şəhərdə həqiqət ən təhlükəli silahdır. Masa yarat, linki dostlarına göndər və intellektual psixoloji mübarizəyə dərhal başla.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => openCreateModal()}
              icon={<Dices className="w-5 h-5" />}
            >
              Masa Yarat
            </Button>

            <Button
              variant="secondary"
              size="lg"
              onClick={() => setIsJoinByCodeOpen(true)}
              icon={<Key className="w-5 h-5" />}
            >
              Kodu Daxil Et
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsRulesOpen(true)}
              icon={<BookOpen className="w-4 h-4 text-red-500" />}
            >
              24 Rol Ensiklopediyası
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsAchievementsOpen(true)}
              icon={<Award className="w-4 h-4 text-amber-500" />}
            >
              72 Nailiyyət & XP
            </Button>

            <Button
              variant="ghost"
              size="lg"
              onClick={() => setIsCatalogOpen(true)}
              icon={<Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
            >
              15 Rejim Kataloqu
            </Button>
          </div>
        </div>

        {/* Highlight Feature Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-8 pt-8 border-t border-zinc-200/80 dark:border-zinc-800/80">
          <div
            onClick={() => setIsCatalogOpen(true)}
            className="flex items-center gap-3 p-3.5 rounded-[8px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">15 Oyun Formatı</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Kataloqa bax ➔</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-[8px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/50">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">75s Canlı Faza</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Dinamik Anti-AFK rejimi</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-[8px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/50">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Sıfır-Məlumat Mühafizəsi</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Şifrəli rol idarəetməsi</div>
            </div>
          </div>

          <div
            onClick={() => setIsLeaderboardOpen(true)}
            className="flex items-center gap-3 p-3.5 rounded-[8px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Reytinq Cədvəli</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Liderlərə bax ➔</div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ─── TDV UNIFIED SSO ECOSYSTEM ACCESS BANNER ─────────────────── */}
      <section className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-900/15 via-zinc-900/50 to-purple-950/20 p-5 sm:p-6 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 text-2xl shadow-inner">
            🛡️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-zinc-950 dark:text-white">
                TDV Vahid Giriş & Ekosistem Profili
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] font-black uppercase tracking-wider">
                SSO v1
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 max-w-xl">
              1 vahid hesabla TDV Mafia, TDV Games, TDV Hub və Lisey Futbol Turnirinə dərhal qoşulun. Qeydiyyatınız bütün portallarda avtomatik tanınır.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 cursor-pointer"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('open-tdv-auth', { detail: { tab: 'login' } }));
              }
            }}
          >
            Daxil Ol
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="flex-1 sm:flex-none bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-bold cursor-pointer"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('open-tdv-auth', { detail: { tab: 'register' } }));
              }
            }}
          >
            Vahid Qeydiyyat
          </Button>
        </div>
      </section>

      {/* ─── LIVE ACTIVE ROOMS SECTION ───────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="border-l-4 border-red-600 pl-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
              Açıq Canlı Masalar
            </h2>
            <Badge tone="red" className="text-xs font-bold">
              {activeRooms.length}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Aktiv masalardan birinə qoşulun və ya dostlarınız üçün yeni masa başladın.
          </p>
        </div>

        {activeRooms.length > 0 ? (
          <motion.div 
              initial="hidden"
              animate="visible"
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeRooms.map((room) => (
              <motion.div
                  key={room.lobbyId}
                  variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                  whileHover={{ scale: 1.02 }}
                className="flex flex-col justify-between gap-4 p-5 rounded-[24px] border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/60 shadow-sm hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5 group backdrop-blur-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold text-base text-zinc-900 dark:text-zinc-100 line-clamp-1">
                      {room.name}
                    </h4>
                    <Badge tone="red" className="shrink-0">
                      {room.mode.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Host: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{room.hostUsername}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                    <Users className="w-3.5 h-3.5" />
                    {room.playerCount} / {room.maxPlayers} Oyunçu
                  </span>
                  <Link
                    href={`/lobby/${room.lobbyId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <span>Qoşul</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <EmptyState
            icon={Dices}
            title="Hazırda heç bir aktiv masa yoxdur"
            description="İlk masanı yaradaraq dostlarınızı dəvət edin və ya formatlar kataloqundan xüsusi ssenari seçin."
            actionLabel="İlk Masanı Yarat"
            onAction={() => openCreateModal()}
          />
        )}
      </section>

      {/* ─── CATALOG PROMO STRIP ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm dark:shadow-none transition-colors duration-200">
        <div className="flex items-start sm:items-center gap-4 max-w-2xl">
          <div className="w-12 h-12 rounded-[8px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-extrabold text-lg text-zinc-900 dark:text-zinc-100">
                Oyun Formatları & 24 Rol Kataloqu
              </h3>
              <Badge tone="red">15 Rejim</Badge>
            </div>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Dante&apos;s Inferno (9 Dairə Əzabları), Çernobıl, Cyberpunk, Baker Street, Stanford Prison və 40–50 nəfərlik All-In rejimi daxil olmaqla bütün 24 rolu və xüsusi qabiliyyətləri araşdırın.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsCatalogOpen(true)}
          iconRight={<ArrowRight className="w-4 h-4" />}
          className="shrink-0"
        >
          Kataloqa Bax
        </Button>
      </section>

      {/* ─── JOIN BY CODE MODAL ──────────────────────────────────────── */}
      {isJoinByCodeOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setIsJoinByCodeOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                  Otaq Kodu ilə Qoşul
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsJoinByCodeOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Dostunuzun və ya təşkilatçının paylaşdığı masa kodunu və ya identifikatorunu daxil edin:
            </p>

            <input
              type="text"
              placeholder="Məs: se7en-deadly-sins-baku-1234"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJoinByCode();
              }}
              className="w-full px-4 py-2.5 rounded-[8px] border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="md" onClick={() => setIsJoinByCodeOpen(false)}>
                Bağla
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={!roomCodeInput.trim()}
                onClick={handleJoinByCode}
                iconRight={<ArrowRight className="w-4 h-4" />}
              >
                Masaya Gir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Global Modals */}
      <CreateRoomModal
        isOpen={isCreateRoomOpen}
        defaultMode={selectedPackForModal}
        onClose={() => setIsCreateRoomOpen(false)}
      />

      <GameModesCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        onSelectMode={(mode) => {
          setSelectedPackForModal(mode);
          setIsCreateRoomOpen(true);
        }}
      />

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      <LeaderboardModal isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} />

      <AchievementsModal
        isOpen={isAchievementsOpen}
        onClose={() => setIsAchievementsOpen(false)}
      />
    </div>
  );
}

