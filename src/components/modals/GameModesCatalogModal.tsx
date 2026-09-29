'use client';

import React, { useState } from 'react';
import {
  Layers,
  Sparkles,
  Crown,
  X,
  Dices,
  Shield,
  Zap,
  Building,
  Users,
} from 'lucide-react';
import { PACKS_CONFIG } from '../../config/packs.config';
import { GameMode } from '../../types/packs';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AZ_CIVIC_OFFICES, AZ_INNATE_TRAITS } from '../../config/i18n/az';

export interface GameModesCatalogModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSelectMode?: (mode: GameMode) => void;
}

type ShowcaseTab = 'CLASSIC' | 'MINIGAMES' | 'ALL_IN';

// Helper to style each individual role token into a distinct colored chip
const getRoleChipClass = (roleText: string) => {
  const r = roleText.toLowerCase();

  // Mafia / Assassin / Dictator / Killer
  if (
    r.includes('mafiya') ||
    r.includes('xaç atası') ||
    r.includes('don') ||
    r.includes('qatil') ||
    r.includes('qəsdçi') ||
    r.includes('diktator') ||
    r.includes('snayper') ||
    r.includes('malebranche') ||
    r.includes('terrorçu') ||
    r.includes('killer') ||
    r.includes('mutant') ||
    r.includes('moriarti') ||
    r.includes('quldur') ||
    r.includes('kölgə') ||
    r.includes('şəbəkə')
  ) {
    return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25 dark:border-red-500/30';
  }

  // Doctor / Medic / Healer / Surgeon
  if (
    r.includes('həkim') ||
    r.includes('mələk') ||
    r.includes('cərrah') ||
    r.includes('sağaldıcı') ||
    r.includes('doctor') ||
    r.includes('likvidator') ||
    r.includes('vatson') ||
    r.includes('ekzorsist')
  ) {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25 dark:border-emerald-500/30';
  }

  // Law & Investigation
  if (
    r.includes('şərif') ||
    r.includes('vergili') ||
    r.includes('prokuror') ||
    r.includes('vəkil') ||
    r.includes('müstəntiq') ||
    r.includes('hakim') ||
    r.includes('nəzarətçi') ||
    r.includes('komissar') ||
    r.includes('inkvizitor') ||
    r.includes('mühafizəçi') ||
    r.includes('sheriff') ||
    r.includes('dozimetrist') ||
    r.includes('holms') ||
    r.includes('şerlok') ||
    r.includes('şturman') ||
    r.includes('naviqator') ||
    r.includes('medium')
  ) {
    return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25 dark:border-blue-500/30';
  }

  // Jester / Lucifer / Cult / Shadow
  if (
    r.includes('lusifer') ||
    r.includes('dəli') ||
    r.includes('jester') ||
    r.includes('kult') ||
    r.includes('iblis') ||
    r.includes('ruhani') ||
    r.includes('poltergeyst') ||
    r.includes('ruh')
  ) {
    return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25 dark:border-purple-500/30';
  }

  // Tactical Specialists
  if (
    r.includes('gözbağlayıcı') ||
    r.includes('şantajçı') ||
    r.includes('pataloqanatom') ||
    r.includes('pataloanatom') ||
    r.includes('kuklaçı') ||
    r.includes('fədai') ||
    r.includes('zaman') ||
    r.includes('illüziyaçı') ||
    r.includes('klaatu') ||
    r.includes('donduran') ||
    r.includes('zireh') ||
    r.includes('yadplanetli') ||
    r.includes('casus') ||
    r.includes('qort') ||
    r.includes('netrunner') ||
    r.includes('xaker') ||
    r.includes('kəşfiyyatçı') ||
    r.includes('neyro') ||
    r.includes('adler') ||
    r.includes('tədqiqatçı')
  ) {
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25 dark:border-amber-500/30';
  }

  // Town / Citizens
  return 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20 dark:border-zinc-700';
};

const PACK_SPECIAL_FEATURES: Record<string, { label: string; icon: string }[]> = {
  BLITZ: [
    { label: 'Gözbağlama (Əngəl)', icon: 'fa-wand-magic-sparkles' },
    { label: 'Lusifer Qələbəsi (Tək)', icon: 'fa-masks-theater' },
    { label: 'Müstəntiq Təhqiqatı', icon: 'fa-magnifying-glass' },
  ],
  STANDARD: [
    { label: 'Pataloqanatom Otopsiyası', icon: 'fa-microscope' },
    { label: 'Gözbağlayıcı İllüziyası', icon: 'fa-wand-magic-sparkles' },
    { label: 'Gizli Sui-qəsd', icon: 'fa-crosshairs' },
  ],
  EXTENDED: [
    { label: 'Prokuror Sərt İttihamı', icon: 'fa-scale-balanced' },
    { label: 'Vəkil Bəraəti', icon: 'fa-file-shield' },
    { label: 'Şantaj (Səssizlik Təzyiqi)', icon: 'fa-comment-slash' },
    { label: 'Pataloqanatom Otopsiyası', icon: 'fa-microscope' },
  ],
  GRAND: [
    { label: 'Zaman Səyahəti (Döngə)', icon: 'fa-clock-rotate-left' },
    { label: 'Gözbağlayıcı Əngəli', icon: 'fa-wand-magic-sparkles' },
    { label: 'İllüziya Tələsi', icon: 'fa-eye' },
  ],
  EPIC: [
    { label: 'İnkvizitor Təmizlənməsi', icon: 'fa-fire' },
    { label: 'Kuklaçı İdarəetməsi', icon: 'fa-hands' },
    { label: 'Regional Palata Səsverməsi', icon: 'fa-landmark' },
  ],
  MASSIVE: [
    { label: 'Fədai Qurbanı', icon: 'fa-shield-heart' },
    { label: 'Casus Məlumatı', icon: 'fa-user-secret' },
    { label: 'Cüt Müstəqil Qatil', icon: 'fa-skull' },
  ],
  LIMITLESS: [
    { label: 'Xaç Atası Toxunulmazlığı', icon: 'fa-crown' },
    { label: 'Kuklaçı & Şantajçı Şəbəkəsi', icon: 'fa-network-wired' },
    { label: '3-lü Şərif & Həkim Alyansı', icon: 'fa-shield-halved' },
  ],
  CUSTOM_LOBBY: [
    { label: 'Sərbəst Rol Konstruktoru', icon: 'fa-sliders' },
    { label: 'Bütün Xüsusi Qabiliyyətlər Açıq', icon: 'fa-unlock' },
  ],
  CATENACCIO: [
    { label: 'Tək Snayper (Zirehkeçirən)', icon: 'fa-crosshairs' },
    { label: '3 Səviyyəli Müdafiə Səddi', icon: 'fa-shield-halved' },
    { label: 'Sədd Aşma Mexanikası', icon: 'fa-hammer' },
  ],
  STANFORD_PRISON: [
    { label: 'Baş Nəzarətçi İntizamı', icon: 'fa-person-military-rifle' },
    { label: 'Qatil Məhbus Qisası', icon: 'fa-handcuffs' },
    { label: 'Qiyam Göstəricisi (Revolt Meter)', icon: 'fa-fire-flame-curved' },
  ],
  OPERATION_VALKYRIE: [
    { label: 'Partlayıcı Çanta (Briefcase)', icon: 'fa-briefcase' },
    { label: 'Partlayış Fitil Sayğacı', icon: 'fa-bomb' },
    { label: 'Diktator & Qəsdçilər Savaşı', icon: 'fa-crown' },
  ],
  THE_DAY_THE_EARTH_STOOD_STILL: [
    { label: 'Klaatu: Dünyanı Dondur', icon: 'fa-snowflake' },
    { label: 'Qort Lazer Buxarlandırması', icon: 'fa-bolt-lightning' },
    { label: 'Qiyamət Saatı 12:00', icon: 'fa-hourglass-end' },
  ],
  DANTES_INFERNO: [
    { label: 'Malebranche İblisləri', icon: 'fa-skull-crossbones' },
    { label: 'Vergili Bələdçiliyi', icon: 'fa-compass' },
    { label: '9 Dairə Əzabları', icon: 'fa-dungeon' },
    { label: 'Kokit Gizli Səsverməsi', icon: 'fa-user-secret' },
  ],
  CHERNOBYL_EXCLUSION_ZONE: [
    { label: 'Radiasiya Sızması (Zonaya Eniş)', icon: 'fa-radiation' },
    { label: 'Dozimetr Skaneri (Gizli Rol)', icon: 'fa-gauge-high' },
    { label: 'Bioloji Mutasiya Təhlükəsi', icon: 'fa-biohazard' },
  ],
  CYBERPUNK_NEO_BAKU: [
    { label: 'Qara Şəbəkə Firewall Hücumu', icon: 'fa-terminal' },
    { label: 'Neyro-İmplant Bloklama', icon: 'fa-microchip' },
    { label: 'Siber Kəşfiyyat & Verilənlər Sızması', icon: 'fa-satellite-dish' },
  ],
  BERMUDA_TRIANGLE: [
    { label: 'Maqnit Anomaliyası (Səslər Sönür)', icon: 'fa-compass' },
    { label: 'Kabus Gəmisi Qəfil Hücumu', icon: 'fa-skull-crossbones' },
    { label: 'Tilsimli Dəniz Qoruyucusu', icon: 'fa-water' },
  ],
  MIDNIGHT_SEANCE: [
    { label: 'Ruhlarla Əlaqə (Məzar Danışır)', icon: 'fa-ghost' },
    { label: 'Ekzorsizm Qoruyucu Şamı', icon: 'fa-fire' },
    { label: 'Qanlı Meri Aynası & Poltergeyst', icon: 'fa-mask' },
  ],
  SHERLOCK_BAKER_STREET: [
    { label: 'Deduktiv Zəka Döyüşü', icon: 'fa-magnifying-glass' },
    { label: 'Moriarti Şahmat Həmləsi', icon: 'fa-chess-knight' },
    { label: 'İren Adler Gizli Şifrəsi', icon: 'fa-envelope-open-text' },
  ],
};

export const GameModesCatalogModal: React.FC<GameModesCatalogModalProps> = ({
  isOpen,
  onClose,
  onSelectMode,
}) => {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('CLASSIC');

  if (!isOpen) return null;

  const packs = Object.values(PACKS_CONFIG);
  const classicPacks = packs.filter((p) => !p.isMinigame && !p.isAllIn);
  const minigamePacks = packs.filter((p) => p.isMinigame);
  const allInPack = packs.find((p) => p.isAllIn);

  const civicOfficesList = Object.values(AZ_CIVIC_OFFICES);
  const innateTraitsList = Object.values(AZ_INNATE_TRAITS);

  const handleLaunchMode = (mode: GameMode) => {
    onClose();
    if (onSelectMode) {
      onSelectMode(mode);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-5 bg-zinc-950/70 backdrop-blur-[16px] animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-[20px] ring-1 ring-white/10 shadow-2xl border border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-zinc-950/80 backdrop-blur-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-950 dark:text-white leading-tight">
                Oyun Formatları & Rollar Kataloqu
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                15 klub rejimi, xüsusi qabiliyyətlər, 16 ictimai vəzifə və 12 gizli istedad.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Segmented Switcher */}
            <div className="flex items-center p-1 rounded-[8px] bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60">
              <button
                type="button"
                onClick={() => setActiveTab('CLASSIC')}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-bold transition-all ${
                  activeTab === 'CLASSIC'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                <span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><path d="M4 4h16"/><path d="M4 20h16"/><path d="M8 4v16"/><path d="M16 4v16"/><path d="M12 4v16"/></svg></span> Klassik ({classicPacks.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('MINIGAMES')}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-bold transition-all ${
                  activeTab === 'MINIGAMES'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                <span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><path d="M2 10s1.5-2 4-2 4 2 4 2"/><path d="M14 10s1.5-2 4-2 4 2 4 2"/><path d="M2 14c0 3 4 5 10 5s10-2 10-5"/><path d="M7 14v1"/><path d="M17 14v1"/></svg></span> Xüsusi ({minigamePacks.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ALL_IN')}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-bold transition-all ${
                  activeTab === 'ALL_IN'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                <span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.518l4.276 3.664a1 1 0 0 0 1.516-.294z"/></svg></span> All-In
              </button>
            </div>

            <button type="button" onClick={onClose} className="w-8 h-8 rounded-[8px] flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
    </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Classic & Minigames Grid */}
          {(activeTab === 'CLASSIC' || activeTab === 'MINIGAMES') && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(activeTab === 'CLASSIC' ? classicPacks : minigamePacks).map((pack) => {
                const rolesList = pack.roleBreakdown
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                const features = PACK_SPECIAL_FEATURES[pack.id] || [];

                return (
                  <div
                    key={pack.id}
                    className="p-5 rounded-[8px] border border-zinc-200 dark:border-white/5 bg-zinc-50/70 dark:bg-white/5 flex flex-col justify-between gap-4 shadow-sm hover:border-zinc-300 dark:hover:border-purple-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-purple-500/20"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 leading-tight">
                          {pack.name}
                        </h3>
                        <Badge tone={pack.isMinigame ? 'amber' : 'blue'} className="shrink-0">
                          {pack.minPlayers}–{pack.maxPlayers} nəfər
                        </Badge>
                      </div>

                      {/* Roles */}
                      <div>
                        <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                          Rol Tərkibi:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {rolesList.map((role, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-0.5 rounded-[8px] text-[11px] font-semibold border ${getRoleChipClass(
                                role
                              )}`}
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Special Features */}
                      {features.length > 0 && (
                        <div className="p-2.5 rounded-[8px] border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-black/40">
                          <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                            Xüsusi Mexanika:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {features.map((feat, fIdx) => (
                              <span
                                key={fIdx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-medium text-zinc-700 dark:text-zinc-300"
                              >
                                <Zap className="w-2.5 h-2.5 text-red-500 shrink-0" />
                                {feat.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80">
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        onClick={() => handleLaunchMode(pack.id as GameMode)}
                        icon={<Dices className="w-4 h-4" />}
                      >
                        Bu Rejimdə Masa Yarat
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* All-In Tab */}
          {activeTab === 'ALL_IN' && allInPack && (
            <div className="p-6 rounded-[20px] border border-purple-500/30 bg-purple-500/5 dark:bg-purple-500/10 flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl xl tabular-nums text-zinc-950 dark:text-white">
                      {allInPack.name} (40–50 Nəfərlik Şəhər Kütləvi Döyüşü)
                    </h3>
                    <Badge tone="purple">{allInPack.minPlayers}–{allInPack.maxPlayers} nəfər</Badge>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Bütün sinif və klub üzvlərinin eyni arenada toqquşduğu ən möhtəşəm turnir formatı.
                  </p>
                </div>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleLaunchMode('ALL_IN')}
                  icon={<Crown className="w-4 h-4" />}
                >
                  All-In Masası Yarat
                </Button>
              </div>

              {/* Roster */}
              <div>
                <div className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-2">
                  Şəhər Bölgüsü (3 Laylı Kimlik):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allInPack.roleBreakdown.split(',').map((role, idx) => {
                    const trimmed = role.trim();
                    if (!trimmed) return null;
                    return (
                      <span
                        key={idx}
                        className={`px-2.5 py-1 rounded-[8px] text-xs font-semibold border ${getRoleChipClass(
                          trimmed
                        )}`}
                      >
                        {trimmed}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Civic Offices */}
              <div className="p-4 rounded-[8px] border border-blue-500/25 bg-blue-500/5 dark:bg-blue-500/10">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                  <Building className="w-4 h-4 text-blue-500" />
                  <span>16 İctimai Vəzifə (Kvartal Səlahiyyətləri & Bonus Səslər):</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {civicOfficesList.map((office, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-[8px] bg-white dark:bg-zinc-800 border border-blue-500/20 text-xs font-medium text-blue-900 dark:text-blue-200"
                    >
                      {office}
                    </span>
                  ))}
                </div>
              </div>

              {/* Traits */}
              <div className="p-4 rounded-[8px] border border-purple-500/25 bg-purple-500/5 dark:bg-purple-500/10">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-purple-700 dark:text-purple-300">
                  <Zap className="w-4 h-4 text-purple-500" />
                  <span>12 Gizli İstedad (Gecə Passiv & Aktiv Qabiliyyətləri):</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {innateTraitsList.map((trait, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-[8px] bg-white dark:bg-zinc-800 border border-purple-500/20 text-xs font-medium text-purple-900 dark:text-purple-200"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
