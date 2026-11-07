'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dices,
  Lock,
  Unlock,
  X,
  ArrowRight,
  Users,
  Shield,
  Layers,
} from 'lucide-react';
import { PACKS_CONFIG } from '../../config/packs.config';
import { GameMode } from '../../types/packs';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface CreateRoomModalProps {
  readonly isOpen: boolean;
  readonly defaultMode?: GameMode;
  readonly onClose: () => void;
  readonly onRoomCreated?: (roomUrl: string) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  defaultMode = 'BLITZ',
  onClose,
  onRoomCreated,
}) => {
  const router = useRouter();
  const [roomName, setRoomName] = useState<string>('Midnight Tribunal #1');
  const [selectedMode, setSelectedMode] = useState<GameMode>(defaultMode);
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [roomPassword, setRoomPassword] = useState<string>('');

  useEffect(() => {
    if (defaultMode) {
      setSelectedMode(defaultMode);
    }
  }, [defaultMode]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentPack = PACKS_CONFIG[selectedMode];

  const handleLaunch = async () => {
    const slug =
      roomName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'tdv-room';

    const lobbyId = `${selectedMode.toLowerCase()}-${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    const targetUrl = `/lobby/${lobbyId}`;

    let hostName = 'Host';
    try {
      const customName = localStorage.getItem('mafia_username');
      if (customName && customName.trim()) {
        hostName = customName.trim();
      } else {
        const ecoRaw = localStorage.getItem('tdv_ecosystem_session_v1');
        if (ecoRaw) {
          const parsedEco = JSON.parse(ecoRaw);
          if (parsedEco?.fullName || parsedEco?.username) {
            hostName = parsedEco.fullName || parsedEco.username;
          }
        } else {
          const saved = localStorage.getItem('tdv_mafia_user');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.username) hostName = parsed.username;
          }
        }
      }
    } catch {
      // Ignore
    }

    try {
      await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyId,
          name: roomName.trim() || 'New Mafia Session',
          mode: selectedMode,
          hostUsername: hostName,
          isPrivate,
          maxPlayers: currentPack?.maxPlayers || 12,
        }),
      });
    } catch {
      // Continue even if network fail
    }

    if (onRoomCreated) {
      onRoomCreated(targetUrl);
    } else {
      router.push(targetUrl);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-5 bg-zinc-950/70 backdrop-blur-[16px] animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[20px] ring-1 ring-white/10 shadow-2xl border border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-zinc-950/80 backdrop-blur-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center shrink-0">
              <Dices className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-950 dark:text-white leading-tight">
                Create Multiplayer Room
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Configure gameplay modes and parameters to launch an active multiplayer session.
              </p>
            </div>
          </div>

          <button type="button" onClick={onClose} className="w-8 h-8 rounded-[8px] flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
    </button>
        </div>

        {/* Form Fields */}
        <div className="flex flex-col gap-4">
          {/* Room Name */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Room Name *
            </label>
            <input data-testid="input-room-name"
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLaunch();
              }}
              placeholder="e.g. Midnight Tribunal #1"
              className="w-full px-3.5 py-2.5 rounded-[8px] border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
            />
          </div>

          {/* Game Mode Selection */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Game Mode
            </label>
            <select data-testid="select-game-mode"
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value as GameMode)}
              className="w-full px-3.5 py-2.5 rounded-[8px] border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all cursor-pointer"
            >
              <optgroup label="Classic Packs">
                <option value="BLITZ">Blitz (5–7 Players)</option>
                <option value="STANDARD">Standard (8–11 Players)</option>
                <option value="EXTENDED">Extended (12–15 Players)</option>
                <option value="GRAND">Grand (16–20 Players)</option>
                <option value="EPIC">Epic (21–24 Players)</option>
                <option value="MASSIVE">Massive (25–30 Players)</option>
                <option value="LIMITLESS">Limitless (30–39 Players)</option>
                <option value="CUSTOM_LOBBY">Custom Room (5–50 Players)</option>
              </optgroup>
              <optgroup label="Asymmetric Minigame Modes">
                <option value="CATENACCIO">Catenaccio (10–12 Players)</option>
                <option value="STANFORD_PRISON">Stanford Prison (12–16 Players)</option>
                <option value="OPERATION_VALKYRIE">Operation Valkyrie (10–14 Players)</option>
                <option value="THE_DAY_THE_EARTH_STOOD_STILL">The Day the Earth Stood Still (12–16 Players)</option>
                <option value="DANTES_INFERNO">Dante&apos;s Inferno (11–13 Players)</option>
                <option value="CHERNOBYL_EXCLUSION_ZONE">Chernobyl: Exclusion Zone (10–14 Players)</option>
                <option value="CYBERPUNK_NEO_BAKU">Cyberpunk 2077: Neo-City (12–16 Players)</option>
                <option value="BERMUDA_TRIANGLE">Bermuda Triangle: Ghost Fleet (10–14 Players)</option>
                <option value="MIDNIGHT_SEANCE">Midnight Séance: Bloody Mary (11–15 Players)</option>
                <option value="SHERLOCK_BAKER_STREET">Baker Street: Holmes vs Moriarty (8–12 Players)</option>
              </optgroup>
              <optgroup label="Metropolitan Arena">
                <option value="ALL_IN">All-In Metropolis (40–50 Players)</option>
              </optgroup>
            </select>
          </div>

          {/* Selected Pack Info Snapshot */}
          {currentPack && (
            <div className="p-4 rounded-[8px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  {currentPack.name}
                </span>
                <Badge tone={currentPack.isAllIn ? 'purple' : currentPack.isMinigame ? 'amber' : 'blue'}>
                  {currentPack.minPlayers}–{currentPack.maxPlayers} Players
                </Badge>
              </div>
              <div className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span><strong>Roles:</strong> {currentPack.roleBreakdown}</span>
              </div>
            </div>
          )}

          {/* Privacy Switch */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="privateToggle"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4 rounded text-red-600 focus:ring-red-500 accent-red-600 cursor-pointer"
            />
            <label htmlFor="privateToggle" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer flex items-center gap-1.5">
              {isPrivate ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5 text-zinc-400" />}
              <span>Private Room (Password Protected)</span>
            </label>
          </div>

          {isPrivate && (
            <div>
              <input
                type="password"
                placeholder="Set room password..."
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[8px] border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button data-testid="btn-create-room-submit"
            variant="primary"
            size="md"
            onClick={handleLaunch}
            iconRight={<ArrowRight className="w-4 h-4" />}
          >
            Enter Lobby
          </Button>
        </div>
      </div>
    </div>
  );
};
