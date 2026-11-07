'use client';

import React from 'react';

export type ActionReticleType = 'KILL' | 'PROTECT' | 'INVESTIGATE' | 'BLOCK' | 'MISDIRECT';

export interface RoleActionReticleProps {
  readonly actionType: ActionReticleType;
  readonly isSelected?: boolean;
  readonly isTargetable?: boolean;
  readonly isCompact?: boolean;
}

export const RoleActionReticle: React.FC<RoleActionReticleProps> = ({
  actionType,
  isSelected = false,
  isTargetable = false,
  isCompact = false,
}) => {
  // If not selected and not targetable, do not render overlay
  if (!isSelected && !isTargetable) return null;

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-[20px] flex items-center justify-center transition-all duration-300 ${
        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-75'
      }`}
    >
      {/* 360° Animated Sweeping Radar Beam */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-full h-full max-w-[120px] max-h-[120px] rounded-full overflow-hidden animate-radar-sweep opacity-25 pointer-events-none">
          <div className="w-full h-full bg-[conic-gradient(from_0deg,_transparent_0deg,_transparent_270deg,_rgba(255,255,255,0.5)_360deg)]" />
        </div>
      </div>

      {/* ─── 1. KILL RETICLE (Tactical Red Crosshairs) ────────────────────── */}
      {actionType === 'KILL' && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_35%,_rgba(239,68,68,0.22)_100%)] flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className={`${isCompact ? 'w-20 h-20' : 'w-28 h-28'} text-red-500 select-none overflow-visible`}
          >
            {/* Outer segmented rotating ring */}
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="16 8 8 8"
              className="motion-safe:animate-[spin_12s_linear_infinite] origin-center opacity-75"
            />
            {/* Inner counter-rotating ring */}
            <circle
              cx="50"
              cy="50"
              r="28"
              fill="none"
              stroke="#f87171"
              strokeWidth="1"
              strokeDasharray="6 6"
              className="motion-safe:animate-[spin_10s_linear_infinite_reverse] origin-center opacity-60"
            />
            {/* Bullseye ping aura */}
            <circle
              cx="50"
              cy="50"
              r="16"
              fill="rgba(239, 68, 68, 0.15)"
              stroke="currentColor"
              strokeWidth="2"
              className="motion-safe:animate-ping opacity-30 origin-center"
            />
            {/* Core solid circle & bullseye dot */}
            <circle
              cx="50"
              cy="50"
              r="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="opacity-90 drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]"
            />
            <circle cx="50" cy="50" r="3" fill="currentColor" className="drop-shadow-[0_0_6px_rgba(239,68,68,1)]" />

            {/* Crosshair Cardinal Lines */}
            <line x1="50" y1="6" x2="50" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="50" y1="70" x2="50" y2="94" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="6" y1="50" x2="30" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="70" y1="50" x2="94" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

            {/* Hash Ticks */}
            <line x1="46" y1="18" x2="54" y2="18" stroke="currentColor" strokeWidth="1.5" />
            <line x1="46" y1="82" x2="54" y2="82" stroke="currentColor" strokeWidth="1.5" />
            <line x1="18" y1="46" x2="18" y2="54" stroke="currentColor" strokeWidth="1.5" />
            <line x1="82" y1="46" x2="82" y2="54" stroke="currentColor" strokeWidth="1.5" />

            {/* Corner Framing Brackets */}
            <path d="M 12 24 L 12 12 L 24 12" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M 88 24 L 88 12 L 76 12" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M 12 76 L 12 88 L 24 88" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M 88 76 L 88 88 L 76 88" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
          {isSelected && !isCompact && (
            <span className="absolute bottom-2 text-center text-[9px] font-mono font-black tracking-[0.25em] text-red-400 uppercase bg-zinc-950/85 px-2 py-0.5 rounded border border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.6)]">
              LETHAL LOCK-ON
            </span>
          )}
        </div>
      )}

      {/* ─── 2. PROTECT RETICLE (Glowing Blue Guardian Shield) ──────────── */}
      {actionType === 'PROTECT' && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_35%,_rgba(59,130,246,0.22)_100%)] flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className={`${isCompact ? 'w-20 h-20' : 'w-28 h-28'} text-blue-500 select-none overflow-visible`}
          >
            {/* Outer rotating aura ring */}
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.5"
              strokeDasharray="8 6"
              className="motion-safe:animate-[spin_20s_linear_infinite] origin-center opacity-60"
            />
            {/* Expanding protection wave */}
            <circle
              cx="50"
              cy="50"
              r="28"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="1.5"
              className="motion-safe:animate-ping opacity-25 origin-center"
            />
            {/* Heraldic Guardian Shield */}
            <path
              d="M50 16 L76 26 C76 54 50 78 50 84 C50 78 24 54 24 26 Z"
              fill="rgba(59, 130, 246, 0.18)"
              stroke="#60a5fa"
              strokeWidth="2.5"
              className="drop-shadow-[0_0_12px_rgba(59,130,246,0.8)]"
            />
            {/* Inner Shield Inset */}
            <path
              d="M50 22 L70 30 C70 51 50 71 50 76 C50 71 30 51 30 30 Z"
              fill="none"
              stroke="#93c5fd"
              strokeWidth="1.2"
              strokeDasharray="4 3"
              className="opacity-75"
            />
            {/* Shield Cross Emblem */}
            <line x1="50" y1="34" x2="50" y2="62" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="40" y1="44" x2="60" y2="44" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="50" cy="44" r="3.5" fill="#60a5fa" className="drop-shadow-[0_0_8px_rgba(255,255,255,1)]" />

            {/* Corner Aegis Arc Runes */}
            <path d="M 14 26 C 14 18 18 14 26 14" stroke="#3b82f6" strokeWidth="2" fill="none" />
            <path d="M 86 26 C 86 18 82 14 74 14" stroke="#3b82f6" strokeWidth="2" fill="none" />
            <path d="M 14 74 C 14 82 18 86 26 86" stroke="#3b82f6" strokeWidth="2" fill="none" />
            <path d="M 86 74 C 86 82 82 86 74 86" stroke="#3b82f6" strokeWidth="2" fill="none" />
          </svg>
          {isSelected && !isCompact && (
            <span className="absolute bottom-2 text-center text-[9px] font-mono font-black tracking-[0.25em] text-blue-300 uppercase bg-zinc-950/85 px-2 py-0.5 rounded border border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.6)]">
              AEGIS GUARDIAN
            </span>
          )}
        </div>
      )}

      {/* ─── 3. INVESTIGATE RETICLE (Green Pulsating Search Lens) ───────── */}
      {actionType === 'INVESTIGATE' && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_35%,_rgba(16,185,129,0.22)_100%)] flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className={`${isCompact ? 'w-20 h-20' : 'w-28 h-28'} text-emerald-500 select-none overflow-visible`}
          >
            {/* Outer Compass Dial (Radar Circumference) */}
            <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="3 9" className="opacity-60" />
            {/* Concentric Sonar Rings */}
            <circle cx="50" cy="50" r="30" fill="none" stroke="#059669" strokeWidth="1" strokeDasharray="4 4" className="opacity-50" />
            <circle
              cx="50"
              cy="50"
              r="20"
              fill="none"
              stroke="#34d399"
              strokeWidth="1.5"
              className="motion-safe:animate-ping opacity-30 origin-center"
            />
            {/* 360° Radar Sweep Line */}
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="12"
              stroke="#34d399"
              strokeWidth="2"
              strokeLinecap="round"
              className="motion-safe:animate-[spin_4s_linear_infinite] origin-center drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]"
            />
            {/* Search Lens / Forensic Magnifier Overlay */}
            <circle
              cx="48"
              cy="46"
              r="16"
              fill="rgba(16, 185, 129, 0.15)"
              stroke="#34d399"
              strokeWidth="2.5"
              className="drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]"
            />
            <line x1="59" y1="57" x2="72" y2="70" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" />
            {/* Internal Focal Reticle */}
            <line x1="48" y1="36" x2="48" y2="56" stroke="#a7f3d0" strokeWidth="1.2" strokeDasharray="2 2" />
            <line x1="38" y1="46" x2="58" y2="46" stroke="#a7f3d0" strokeWidth="1.2" strokeDasharray="2 2" />
            <circle cx="48" cy="46" r="2.5" fill="#a7f3d0" />

            {/* Horizontal Phosphor Scanlines */}
            <line x1="16" y1="32" x2="84" y2="32" stroke="#10b981" strokeWidth="0.5" strokeDasharray="2 6" className="opacity-30" />
            <line x1="16" y1="64" x2="84" y2="64" stroke="#10b981" strokeWidth="0.5" strokeDasharray="2 6" className="opacity-30" />
          </svg>
          {isSelected && !isCompact && (
            <span className="absolute bottom-2 text-center text-[9px] font-mono font-black tracking-[0.25em] text-emerald-300 uppercase bg-zinc-950/85 px-2 py-0.5 rounded border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.6)]">
              SONAR SCAN
            </span>
          )}
        </div>
      )}

      {/* ─── 4. BLOCK RETICLE (Amber/Orange Warning Padlock) ─────────────── */}
      {actionType === 'BLOCK' && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_35%,_rgba(245,158,11,0.22)_100%)] flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className={`${isCompact ? 'w-20 h-20' : 'w-28 h-28'} text-amber-500 select-none overflow-visible`}
          >
            {/* Octagonal Containment Barrier */}
            <polygon
              points="50,12 77,23 88,50 77,77 50,88 23,77 12,50 23,23"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.8"
              strokeDasharray="8 6"
              className="motion-safe:animate-[spin_16s_linear_infinite] origin-center opacity-70"
            />
            {/* Interdiction Warning Ring */}
            <circle
              cx="50"
              cy="50"
              r="28"
              fill="rgba(245, 158, 11, 0.12)"
              stroke="#f97316"
              strokeWidth="1.5"
              className="motion-safe:animate-pulse opacity-60"
            />
            {/* Heavy Security Suppression Padlock */}
            <path
              d="M38 42 V28 C38 21 62 21 62 28 V42"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="4"
              strokeLinecap="round"
              className="drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]"
            />
            <rect
              x="30"
              y="42"
              width="40"
              height="32"
              rx="6"
              fill="rgba(245, 158, 11, 0.25)"
              stroke="#f59e0b"
              strokeWidth="2.5"
              className="drop-shadow-[0_0_12px_rgba(245,158,11,0.7)]"
            />
            {/* Keyhole */}
            <circle cx="50" cy="54" r="3.5" fill="#fef3c7" />
            <polygon points="48,55 52,55 54,64 46,64" fill="#fef3c7" />

            {/* Hazard Corner Chevrons (Stripes) */}
            <line x1="12" y1="20" x2="20" y2="12" stroke="#f59e0b" strokeWidth="3" />
            <line x1="16" y1="24" x2="24" y2="16" stroke="#f59e0b" strokeWidth="2" opacity="0.6" />
            <line x1="88" y1="20" x2="80" y2="12" stroke="#f59e0b" strokeWidth="3" />
            <line x1="84" y1="24" x2="76" y2="16" stroke="#f59e0b" strokeWidth="2" opacity="0.6" />
            <line x1="12" y1="80" x2="20" y2="88" stroke="#f59e0b" strokeWidth="3" />
            <line x1="16" y1="76" x2="24" y2="84" stroke="#f59e0b" strokeWidth="2" opacity="0.6" />
            <line x1="88" y1="80" x2="80" y2="88" stroke="#f59e0b" strokeWidth="3" />
            <line x1="84" y1="76" x2="76" y2="84" stroke="#f59e0b" strokeWidth="2" opacity="0.6" />
          </svg>
          {isSelected && !isCompact && (
            <span className="absolute bottom-2 text-center text-[9px] font-mono font-black tracking-[0.25em] text-amber-300 uppercase bg-zinc-950/85 px-2 py-0.5 rounded border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.6)]">
              INTERDICTION
            </span>
          )}
        </div>
      )}

      {/* ─── 5. MISDIRECT RETICLE (Purple Distortion Vortex) ────────────── */}
      {actionType === 'MISDIRECT' && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_35%,_rgba(168,85,247,0.22)_100%)] flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className={`${isCompact ? 'w-20 h-20' : 'w-28 h-28'} text-purple-500 select-none overflow-visible`}
          >
            {/* Spiral Swirling Outer Ring */}
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke="#a855f7"
              strokeWidth="1.5"
              strokeDasharray="12 6"
              className="motion-safe:animate-[spin_8s_linear_infinite] origin-center opacity-70"
            />
            {/* Counter Swirl Ring */}
            <circle
              cx="50"
              cy="50"
              r="26"
              fill="none"
              stroke="#c084fc"
              strokeWidth="2"
              strokeDasharray="6 6"
              className="motion-safe:animate-[spin_6s_linear_infinite_reverse] origin-center opacity-65"
            />
            {/* Distortion Center Ring & Pulse */}
            <circle
              cx="50"
              cy="50"
              r="14"
              fill="rgba(168, 85, 247, 0.2)"
              stroke="#e9d5ff"
              strokeWidth="2"
              className="motion-safe:animate-ping opacity-35 origin-center"
            />
            <circle cx="50" cy="50" r="10" fill="none" stroke="#d8b4fe" strokeWidth="2" className="opacity-90" />
            <circle cx="50" cy="50" r="3" fill="#ffffff" className="drop-shadow-[0_0_8px_rgba(168,85,247,1)]" />

            {/* Corner Rift Brackets */}
            <path d="M 16 16 L 24 24" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
            <path d="M 84 16 L 76 24" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
            <path d="M 16 84 L 24 76" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
            <path d="M 84 84 L 76 76" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {isSelected && !isCompact && (
            <span className="absolute bottom-2 text-center text-[9px] font-mono font-black tracking-[0.25em] text-purple-300 uppercase bg-zinc-950/85 px-2 py-0.5 rounded border border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.6)]">
              MISDIRECT LOCK
            </span>
          )}
        </div>
      )}
    </div>
  );
};
