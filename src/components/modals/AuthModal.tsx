'use client';

import React, { useState } from 'react';
import {
  User,
  Shield,
  Key,
  X,
  CheckCircle,
  AlertCircle,
  Trophy,
  Gamepad2,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { PlayerTier } from '../../types/access';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface UserSessionState {
  readonly userId: string;
  readonly username: string;
  readonly tier: PlayerTier;
  readonly roleTitle: string;
  readonly gamesPlayed: number;
  readonly winRate: number;
}

export interface AuthModalProps {
  readonly isOpen: boolean;
  readonly currentUser: UserSessionState | null;
  readonly initialTab?: 'login' | 'register';
  readonly onClose: () => void;
  readonly onLogin: (user: UserSessionState) => void;
  readonly onLogout?: () => void;
}

const TIER_TITLES: Record<PlayerTier, string> = {
  TIER_1: 'Əsgər (Soldier) — Başlanğıc',
  TIER_2: 'Kapo (Caporegime) — Təcrübəli',
  TIER_3: 'Don (Consigliere) — Elit Usta',
};

function dispatchSSOBrokerState(session: any, users: any) {
  try {
    const BROKER_URL = 'https://tdv-community-hubs.vercel.app/sso-broker.html';
    let iframe = document.getElementById('tdv_sso_broker_bridge') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'tdv_sso_broker_bridge';
      iframe.src = BROKER_URL;
      iframe.style.display = 'none';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.onload = function() {
        try {
          iframe.contentWindow?.postMessage({ type: 'TDV_SSO_SET', session, users }, '*');
        } catch (err) {}
      };
      document.body.appendChild(iframe);
    } else {
      iframe.contentWindow?.postMessage({ type: 'TDV_SSO_SET', session, users }, '*');
    }
  } catch (e) {}
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  currentUser,
  initialTab = 'login',
  onClose,
  onLogin,
  onLogout,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Login inputs
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [loginPin, setLoginPin] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<PlayerTier>('TIER_1');

  // Register inputs
  const [regFullName, setRegFullName] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regGrade, setRegGrade] = useState<number>(10);
  const [regTier, setRegTier] = useState<PlayerTier>('TIER_1');
  const [regPin, setRegPin] = useState<string>('');
  const [regConfirmPin, setRegConfirmPin] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  if (!isOpen) return null;

  const DEFAULT_SEEDED = [
    { username: 'orxan', fullName: 'Orxan Əliyev', pin: '1000', tier: 'TIER_1' as PlayerTier, roleTitle: 'Əsgər', grade: 10, schoolClass: '10A' },
    { username: 'murad', fullName: 'Murad Məmmədov', pin: '1100', tier: 'TIER_2' as PlayerTier, roleTitle: 'Kapo', grade: 11, schoolClass: '11B' },
    { username: 'elvin_coach', fullName: 'Elvin Müəllim', pin: '2026', tier: 'TIER_3' as PlayerTier, roleTitle: 'Don', grade: 0, schoolClass: 'Məşqçi' },
    { username: 'admin', fullName: 'TDV İnzibatçı', pin: 'admin2026', tier: 'TIER_3' as PlayerTier, roleTitle: 'Don', grade: 0, schoolClass: 'Rəhbərlik' },
  ];

  const getRegisteredList = () => {
    try {
      const raw = localStorage.getItem('tdv_registered_users_v1');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch {}
    try {
      localStorage.setItem('tdv_registered_users_v1', JSON.stringify(DEFAULT_SEEDED));
    } catch {}
    return DEFAULT_SEEDED;
  };

  const handleLoginSubmit = () => {
    setErrorMsg('');
    setSuccessMsg('');
    const cleanUser = usernameInput.trim();
    if (!cleanUser) {
      setErrorMsg('Zəhmət olmasa istifadəçi adınızı və ya ləqəbinizi daxil edin.');
      return;
    }

    const registeredList = getRegisteredList();
    const matched = registeredList.find(
      (u: any) =>
        (u.username && u.username.toLowerCase() === cleanUser.toLowerCase()) ||
        (u.fullName && u.fullName.toLowerCase() === cleanUser.toLowerCase())
    );

    if (!matched) {
      setErrorMsg(`<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><circle cx="12" cy="12" r="10"/></svg></span> '${cleanUser}' istifadəçi adı ilə qeydiyyat tapılmadı! Yalnız qeydiyyatdan keçmiş istifadəçilər daxil ola bilər.`);
      return;
    }

    if (matched.pin && String(matched.pin).trim() !== '') {
      if (!loginPin.trim() || loginPin.trim() !== String(matched.pin).trim()) {
        setErrorMsg('Daxil edilmiş PIN kod və ya şifrə yanlışdır!');
        return;
      }
    }

    const effectiveTier = (matched.tier as PlayerTier) || selectedTier;
    const effectiveTitle = matched.roleTitle || (effectiveTier === 'TIER_3' ? 'Don' : effectiveTier === 'TIER_2' ? 'Kapo' : 'Əsgər');

    const user: UserSessionState = { userId: "tdv-usr-" + Date.now().toString(36),
      username: matched.username || cleanUser,
      tier: effectiveTier,
      roleTitle: effectiveTitle,
      gamesPlayed: matched.gamesPlayed || 14,
      winRate: matched.winRate || 68.4,
    };

    // Save active ecosystem session for cross-portal sync
    const ecoSession = {
      userId: matched.userId || 'tdv-usr-' + Date.now().toString(36),
      username: matched.username || cleanUser,
      fullName: matched.fullName || matched.username || cleanUser,
      grade: matched.grade || 10,
      schoolClass: matched.schoolClass || '10A',
      role: matched.role || 'player',
      avatar: matched.avatar || '<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><path d="M2 10s1.5-2 4-2 4 2 4 2"/><path d="M14 10s1.5-2 4-2 4 2 4 2"/><path d="M2 14c0 3 4 5 10 5s10-2 10-5"/><path d="M7 14v1"/><path d="M17 14v1"/></svg></span>',
      ecosystem: {
        eschool: { active: true, grade: matched.grade || 10 },
        sports: { team: matched.schoolClass || '10A', role: 'player' },
        games: { nickname: matched.username || cleanUser },
        mafia: { tier: effectiveTier, roleTitle: effectiveTitle }
      },
      token: 'tdv_token_' + Math.random().toString(36).substring(2) + Date.now().toString(36),
      createdAt: Date.now(),
      expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
    };
    try {
      localStorage.setItem('tdv_ecosystem_session_v1', JSON.stringify(ecoSession));
      dispatchSSOBrokerState(ecoSession, registeredList);
    } catch {}

    setSuccessMsg('Uğurla daxil oldunuz! Masaya qoşulur...');
    setTimeout(() => {
      onLogin(user);
      onClose();
    }, 350);
  };

  const handleRegisterSubmit = () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!regFullName.trim()) {
      setErrorMsg('Zəhmət olmasa ad və soyadınızı daxil edin.');
      return;
    }
    if (!regUsername.trim()) {
      setErrorMsg('Zəhmət olmasa oyunçu ləqəbi / istifadəçi adı daxil edin.');
      return;
    }
    if (!regPin.trim()) {
      setErrorMsg('Zəhmət olmasa 4 rəqəmli PIN kod və ya şifrə təyin edin.');
      return;
    }
    if (regPin && regConfirmPin && regPin !== regConfirmPin) {
      setErrorMsg('Daxil edilən şifrələr bir-birinə uyğun gəlmir.');
      return;
    }

    const regUsers = getRegisteredList();
    const alreadyTaken = regUsers.some(
      (u: any) => u.username && u.username.toLowerCase() === regUsername.trim().toLowerCase()
    );
    if (alreadyTaken) {
      setErrorMsg(`<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><circle cx="12" cy="12" r="10"/></svg></span> '${regUsername.trim()}' ləqəbi artıq qeydiyyatdan keçib! Zəhmət olmasa başqa ləqəb seçin.`);
      return;
    }

    const roleTitle = regTier === 'TIER_3' ? 'Don' : regTier === 'TIER_2' ? 'Kapo' : 'Əsgər';
    const newUser = {
      userId: 'tdv-usr-' + Date.now().toString(36),
      fullName: regFullName.trim(),
      username: regUsername.trim(),
      roleTitle: roleTitle,
      tier: regTier,
      grade: regGrade,
      schoolClass: regGrade > 0 ? `${regGrade}A` : 'Müəllim',
      pin: regPin.trim(),
      avatar: '<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><path d="M2 10s1.5-2 4-2 4 2 4 2"/><path d="M14 10s1.5-2 4-2 4 2 4 2"/><path d="M2 14c0 3 4 5 10 5s10-2 10-5"/><path d="M7 14v1"/><path d="M17 14v1"/></svg></span>',
      createdAt: Date.now(),
      gamesPlayed: 0,
      winRate: 100,
    };
    regUsers.push(newUser);

    try {
      localStorage.setItem('tdv_registered_users_v1', JSON.stringify(regUsers));
      const ecoSession = {
        userId: newUser.userId,
        username: newUser.username,
        fullName: newUser.fullName,
        grade: newUser.grade,
        schoolClass: newUser.schoolClass,
        role: 'player',
        avatar: '<span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><path d="M2 10s1.5-2 4-2 4 2 4 2"/><path d="M14 10s1.5-2 4-2 4 2 4 2"/><path d="M2 14c0 3 4 5 10 5s10-2 10-5"/><path d="M7 14v1"/><path d="M17 14v1"/></svg></span>',
        ecosystem: {
          eschool: { active: true, grade: newUser.grade },
          sports: { team: newUser.schoolClass, role: 'player' },
          games: { nickname: newUser.username },
          mafia: { tier: regTier, roleTitle: roleTitle }
        },
        token: 'tdv_token_' + Math.random().toString(36).substring(2) + Date.now().toString(36),
        createdAt: Date.now(),
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
      };
      localStorage.setItem('tdv_ecosystem_session_v1', JSON.stringify(ecoSession));
      dispatchSSOBrokerState(ecoSession, regUsers);
    } catch {}

    const user: UserSessionState = { userId: "tdv-usr-" + Date.now().toString(36),
      username: regUsername.trim(),
      tier: regTier,
      roleTitle: roleTitle,
      gamesPlayed: 0,
      winRate: 100,
    };

    setSuccessMsg('Vahid profiliniz yaradıldı! Masaya qoşulur...');
    setTimeout(() => {
      onLogin(user);
      onClose();
    }, 450);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-5 bg-zinc-950/70 backdrop-blur-[16px] animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[20px] ring-1 ring-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-zinc-950/80 backdrop-blur-3xl p-6 sm:p-8 flex flex-col gap-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-950 dark:text-white leading-tight">
                {currentUser ? 'Oyunçu Profili' : 'TDV Vahid Giriş Portalı'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {currentUser
                  ? 'Profilinizin cari statusu və dərəcəniz'
                  : 'Tək vahid profil bütün platforma üçün bəs edir.'}
              </p>
            </div>
          </div>

          <button type="button" onClick={onClose} className="w-8 h-8 rounded-[8px] flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
    </button>
        </div>

        {/* Logged in view */}
        {currentUser ? (
          <div className="flex flex-col gap-5">
            <div className="p-4 rounded-[8px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-red-600 text-white font-bold tabular-nums text-sm flex items-center justify-center">
                    {currentUser.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-zinc-950 dark:text-white">
                      {currentUser.username}
                    </h3>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                      Titul: {currentUser.roleTitle}
                    </p>
                  </div>
                </div>
                <Badge tone="purple">{currentUser.tier}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <div className="p-3 rounded-[8px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mb-1">
                    <Gamepad2 className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Oyunlar</span>
                  </div>
                  <div className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                    {currentUser.gamesPlayed} Masa
                  </div>
                </div>

                <div className="p-3 rounded-[8px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mb-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>Qələbə</span>
                  </div>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {currentUser.winRate}%
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button variant="secondary" size="md" onClick={onClose}>
                Bağla
              </Button>
              {onLogout && (
                <Button
                  variant="danger"
                  size="md"
                  onClick={onLogout}
                  icon={<LogOut className="w-4 h-4" />}
                >
                  Hesabdan Çıx
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Not logged in: Tabbed Interface */
          <div className="flex flex-col gap-4">
            {/* Segmented Switcher */}
            <div className="grid grid-cols-2 p-1 rounded-[8px] bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`py-2 text-xs font-bold rounded-[8px] transition-all ${
                  tab === 'login'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Daxil Ol
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`py-2 text-xs font-bold rounded-[8px] transition-all ${
                  tab === 'register'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Qeydiyyatdan Keç
              </button>
            </div>

            {/* Error / Success Notifications */}
            {errorMsg && (
              <div className="p-3 rounded-[8px] bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-medium flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span dangerouslySetInnerHTML={{ __html: errorMsg }}></span>
                </div>
                {errorMsg.includes('qeydiyyat tapılmadı') && (
                  <button
                    type="button"
                    onClick={() => {
                      setRegUsername(usernameInput.trim());
                      setRegFullName(usernameInput.trim());
                      setTab('register');
                      setErrorMsg('');
                    }}
                    className="self-start text-[11px] font-bold text-red-600 dark:text-red-400 underline hover:opacity-80 transition-opacity"
                  >
                    <span className="inline-block align-middle mr-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-80"><circle cx="12" cy="12" r="10"/></svg></span> &apos;{usernameInput.trim()}&apos; kimi indi qeydiyyatdan keçin
                  </button>
                )}
              </div>
            )}
            {successMsg && (
              <div className="p-3 rounded-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* TAB 1: LOGIN */}
            {tab === 'login' ? (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Oyunçu Ləqəbi (Ad) *
                  </label>
                  <input
                    type="text"
                    placeholder="Məs: orxan, murad, elvin_coach..."
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    autoFocus
                    className="w-full px-3.5 py-2.5 rounded-[8px] border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    PIN Kod / Şifrə *
                  </label>
                  <input
                    type="password"
                    placeholder="Məs: 1000"
                    value={loginPin}
                    onChange={(e) => setLoginPin(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[8px] border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all font-mono"
                  />
                </div>

                {/* Quick seed selection pills */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    Sürətli Test Girişi:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_SEEDED.map((s) => (
                      <button
                        key={s.username}
                        type="button"
                        onClick={() => {
                          setUsernameInput(s.username);
                          setLoginPin(s.pin);
                          setSelectedTier(s.tier);
                          setErrorMsg('');
                        }}
                        className="px-2 py-1 text-[11px] font-semibold rounded-[8px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 border border-zinc-200 dark:border-zinc-700 transition-colors"
                      >
                        {s.username} ({s.pin})
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Dərəcə (Tier) Seçimi
                  </label>
                  <select
                    value={selectedTier}
                    onChange={(e) => setSelectedTier(e.target.value as PlayerTier)}
                    className="w-full px-3.5 py-2.5 rounded-[8px] border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all cursor-pointer"
                  >
                    <option value="TIER_1">{TIER_TITLES.TIER_1}</option>
                    <option value="TIER_2">{TIER_TITLES.TIER_2}</option>
                    <option value="TIER_3">{TIER_TITLES.TIER_3}</option>
                  </select>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 block">
                    Dərəcəniz hansı paket və masalara daxil ola biləcəyinizi müəyyən edir.
                  </span>
                </div>

                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    disabled={!usernameInput.trim()}
                    onClick={handleLoginSubmit}
                  >
                    Dərhal Daxil Ol & Masaya Başla
                  </Button>
                </div>
              </div>
            ) : (
              /* TAB 2: REGISTER */
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Ad və Soyad *
                  </label>
                  <input
                    type="text"
                    placeholder="Məs: Elmir Qasımov"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="w-full px-3 py-2 rounded-[8px] border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Oyunçu Ləqəbi (Username) *
                  </label>
                  <input
                    type="text"
                    placeholder="Məs: Don_Elmir"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-[8px] border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      Sinif / Status
                    </label>
                    <select
                      value={regGrade}
                      onChange={(e) => setRegGrade(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-[8px] border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                    >
                      <option value={10}>10-cu Sinif</option>
                      <option value={11}>11-ci Sinif</option>
                      <option value={9}>9-cu Sinif</option>
                      <option value={8}>8-ci Sinif</option>
                      <option value={7}>7-ci Sinif</option>
                      <option value={6}>6-cı Sinif</option>
                      <option value={0}>Fənn Müəllimi</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      Başlanğıc Dərəcə
                    </label>
                    <select
                      value={regTier}
                      onChange={(e) => setRegTier(e.target.value as PlayerTier)}
                      className="w-full px-3 py-2 rounded-[8px] border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                    >
                      <option value="TIER_1">Əsgər (Tier 1)</option>
                      <option value="TIER_2">Kapo (Tier 2)</option>
                      <option value="TIER_3">Don (Tier 3)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      Şifrə / PİN
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value)}
                      className="w-full px-3 py-2 rounded-[8px] border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      Təkrarı
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={regConfirmPin}
                      onChange={(e) => setRegConfirmPin(e.target.value)}
                      className="w-full px-3 py-2 rounded-[8px] border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    onClick={handleRegisterSubmit}
                  >
                    Vahid Profil Yarat & Masaya Başla
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
