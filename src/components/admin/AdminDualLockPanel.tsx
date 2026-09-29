'use client';

import React, { useState } from 'react';
import { Lock, Unlock, Key, Shield, UserCheck, AlertCircle } from 'lucide-react';
import { AdminRole } from '../../types/access';
import { AdminMasterUnlockState, PlayerSession } from '../../types/game';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AZ_UI } from '../../config/i18n/az';

export interface AdminDualLockPanelProps {
  readonly unlockState: AdminMasterUnlockState;
  readonly currentUserRole: AdminRole;
  readonly currentUserId: string;
  readonly isHost?: boolean;
  readonly hostReady?: boolean;
  readonly assignedArchitectId: string | null;
  readonly assignedBailiffId: string | null;
  readonly eligibleWaiverPlayers?: readonly PlayerSession[];
  readonly onUnlockSubmit: (role: 'THE_ARCHITECT' | 'THE_BAILIFF') => void;
  readonly onHostReadyToggle?: (ready: boolean) => void;
  readonly onGrantWaiver?: (targetUserId: string, reason: string) => void;
}

export const AdminDualLockPanel: React.FC<AdminDualLockPanelProps> = ({
  unlockState,
  currentUserRole,
  currentUserId,
  isHost = false,
  hostReady = false,
  assignedArchitectId,
  assignedBailiffId,
  eligibleWaiverPlayers = [],
  onUnlockSubmit,
  onHostReadyToggle,
  onGrantWaiver,
}) => {
  const [selectedWaiverTarget, setSelectedWaiverTarget] = useState<string>('');
  const [waiverReason, setWaiverReason] = useState<string>('Tier 1 İcazəli Güzəşt');

  const isArchitect = currentUserRole === 'THE_ARCHITECT';
  const isBailiff = currentUserRole === 'THE_BAILIFF';
  const canArchitectUnlock = isArchitect && !unlockState.architectUnlocked;
  const canBailiffUnlock = isBailiff && !unlockState.bailiffUnlocked;

  return (
    <div className="p-5 sm:p-6 rounded-2xl border border-purple-500/20 dark:border-purple-500/10 bg-white/50 dark:bg-zinc-950/80 backdrop-blur-xl shadow-[0_0_30px_rgba(168,85,247,0.15)] flex flex-col gap-5 transition-colors duration-200">
      {/* Header & Lock State */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-extrabold text-base text-white font-mono uppercase tracking-widest tabular-nums tracking-tight">
              Cüt Açarlı Platforma Admin İcazəsi (All-In 40–50)
            </h3>
            {isHost && (
              <Badge tone={hostReady ? 'emerald' : 'amber'}>
                Host: {hostReady ? 'HAZIRDIR' : 'GÖZLƏNİLİR'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-zinc-400 font-mono text-[10px] uppercase tabular-nums">
            All-In metropolitan rejimini başlatmaq üçün həm Memar, həm də Məhkəmə İcraçısının müstəqil açarları tələb olunur.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isHost && onHostReadyToggle && (
            <Button
              size="sm" className="btn-spring font-mono tracking-wider tabular-nums"
              variant={hostReady ? 'outline' : 'primary'}
              onClick={() => onHostReadyToggle(!hostReady)}
            >
              {hostReady ? 'Hazırlığı Geri Götür' : 'Host Hazırdır'}
            </Button>
          )}

          <Badge tone={unlockState.dualLockVerified ? 'emerald' : 'red'}>
            {unlockState.dualLockVerified ? AZ_UI.dualLockVerified : AZ_UI.dualLockRequired}
          </Badge>
        </div>
      </div>

      {/* Dual Key Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Key 1: The Architect */}
        <div className="p-2.5 rounded-[8px] border border-amber-500/25 bg-amber-500/5 dark:bg-amber-950/20 flex flex-col justify-between gap-3 min-h-[44px]">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-sm text-amber-900 dark:text-amber-200 flex items-center gap-1.5 tabular-nums tracking-tight">
                <Key className="w-4 h-4 text-amber-500" />
                <span>Açar 1: {AZ_UI.architect}</span>
              </span>
              <Badge tone={unlockState.architectUnlocked ? 'emerald' : 'amber'}>
                {unlockState.architectUnlocked ? AZ_UI.turned : AZ_UI.awaitingTurn}
              </Badge>
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums tracking-tight">
              Təyin edilib: <strong className="text-zinc-100 font-mono uppercase tracking-wide tabular-nums tracking-tight">{assignedArchitectId ?? 'Otaqda yoxdur'}</strong>
            </div>
          </div>

          <Button
            size="sm" className="btn-spring font-mono tracking-wider tabular-nums"
            variant="warning"
            disabled={!canArchitectUnlock}
            onClick={() => onUnlockSubmit('THE_ARCHITECT')}
            fullWidth
          >
            {unlockState.architectUnlocked ? 'Memar Təsdiqləndi' : AZ_UI.authorizeAsArchitect}
          </Button>
        </div>

        {/* Key 2: The Bailiff */}
        <div className="p-2.5 rounded-[8px] border border-rose-500/25 bg-rose-500/5 dark:bg-rose-950/20 flex flex-col justify-between gap-3 min-h-[44px]">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-sm text-rose-900 dark:text-rose-200 flex items-center gap-1.5 tabular-nums tracking-tight">
                <Key className="w-4 h-4 text-rose-500" />
                <span>Açar 2: {AZ_UI.bailiff}</span>
              </span>
              <Badge tone={unlockState.bailiffUnlocked ? 'emerald' : 'amber'}>
                {unlockState.bailiffUnlocked ? AZ_UI.turned : AZ_UI.awaitingTurn}
              </Badge>
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums tracking-tight">
              Təyin edilib: <strong className="text-zinc-100 font-mono uppercase tracking-wide tabular-nums tracking-tight">{assignedBailiffId ?? 'Otaqda yoxdur'}</strong>
            </div>
          </div>

          <Button
            size="sm" className="btn-spring font-mono tracking-wider tabular-nums"
            variant="danger"
            disabled={!canBailiffUnlock}
            onClick={() => onUnlockSubmit('THE_BAILIFF')}
            fullWidth
          >
            {unlockState.bailiffUnlocked ? 'İcraçı Təsdiqləndi' : AZ_UI.authorizeAsBailiff}
          </Button>
        </div>
      </div>
    </div>
  );
};
