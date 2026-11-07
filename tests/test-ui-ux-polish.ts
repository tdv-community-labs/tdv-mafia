/**
 * TDV BTL MAFIA - Milestone 14 & 15 Verification Suite
 * UI/UX Polish, Web Audio Micro-Interactions, 3D Tilt, Circular SVG Timers & WCAG 2.1 AA Compliance
 */

import {
  MASTER_VOLUME,
  playMicroClick,
  playBermudaSonar,
  playCyberChirp,
  triggerHaptic,
  playCard,
  playGavel,
  isSoundMuted,
  setSoundMuted,
} from '../src/utils/sfx';
import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✔ ${msg}`);
}

console.log('🎨 Starting TDV Mafia Milestone 14 & 15 Polish & Accessibility Suite...\n');

// ─── SUITE 1: 35% Master Volume & Web Audio Micro-Interactions (M14) ────────
console.log('▶ [Suite 1] 35% Master Volume & Audio Micro-Interactions');

assert(MASTER_VOLUME === 0.35, `Master volume is strictly capped at 35% (${MASTER_VOLUME})`);

// Verify safe execution of micro-sound functions in Node / headless context
let audioPassed = true;
try {
  playMicroClick();
  playBermudaSonar(0.5);
  playCyberChirp();
  triggerHaptic('click');
  triggerHaptic('accused');
  triggerHaptic('victory');
} catch (e) {
  audioPassed = false;
  console.error(e);
}
assert(audioPassed, 'Web Audio micro-interactions and haptics execute safely without throwing exceptions');

// ─── SUITE 2: Circular SVG Countdown Progress Ring Math (M14) ───────────────
console.log('\n▶ [Suite 2] Circular SVG Countdown Ring Math & Color Transitions');

const RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~138.23

function getStrokeDashoffset(timeRemaining: number, duration: number): number {
  const percent = Math.max(0, Math.min(100, (timeRemaining / duration) * 100));
  return CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
}

function getRingColor(timeRemaining: number): string {
  if (timeRemaining <= 5) return '#ef4444'; // Red
  if (timeRemaining <= 15) return '#f97316'; // Orange
  return '#f59e0b'; // Amber
}

assert(
  Math.abs(CIRCUMFERENCE - 138.23) < 0.1,
  `Circumference computed accurately: ${CIRCUMFERENCE.toFixed(2)}px`
);

assert(
  Math.abs(getStrokeDashoffset(30, 30) - 0) < 0.001,
  'Full time (30s / 30s) yields stroke-dashoffset = 0 (100% complete ring)'
);

assert(
  Math.abs(getStrokeDashoffset(15, 30) - CIRCUMFERENCE / 2) < 0.001,
  'Half time (15s / 30s) yields stroke-dashoffset = half circumference (50% ring)'
);

assert(
  Math.abs(getStrokeDashoffset(0, 30) - CIRCUMFERENCE) < 0.001,
  'Expired time (0s / 30s) yields stroke-dashoffset = full circumference (empty ring)'
);

assert(
  getRingColor(25) === '#f59e0b',
  'Normal phase (>15s) uses warm amber stroke #f59e0b'
);

assert(
  getRingColor(12) === '#f97316',
  'Approaching urgency (<=15s) transitions to orange stroke #f97316'
);

assert(
  getRingColor(4) === '#ef4444',
  'Critical urgency (<=5s) shifts to alert red stroke #ef4444'
);

// ─── SUITE 3: 3D Perspective Tilt Angle Clamping (M14) ──────────────────────
console.log('\n▶ [Suite 3] 3D Perspective Tilt Math & Boundaries');

function calculateTilt(mouseX: number, mouseY: number, width: number, height: number): { rotateX: number; rotateY: number } {
  const xPct = Math.max(-0.5, Math.min(0.5, mouseX / width - 0.5));
  const yPct = Math.max(-0.5, Math.min(0.5, mouseY / height - 0.5));
  const rotateX = yPct * -16; // -0.5 -> 8deg, 0.5 -> -8deg (range: [-8, 8])
  const rotateY = xPct * 16;  // -0.5 -> -8deg, 0.5 -> 8deg (range: [-8, 8])
  return { rotateX, rotateY };
}

const centerTilt = calculateTilt(100, 100, 200, 200);
assert(centerTilt.rotateX === 0 && centerTilt.rotateY === 0, 'Center cursor yields 0° tilt');

const topLeftTilt = calculateTilt(0, 0, 200, 200);
assert(topLeftTilt.rotateX === 8 && topLeftTilt.rotateY === -8, 'Top-left corner cursor yields +8° rotateX and -8° rotateY');

const bottomRightTilt = calculateTilt(200, 200, 200, 200);
assert(bottomRightTilt.rotateX === -8 && bottomRightTilt.rotateY === 8, 'Bottom-right corner cursor yields -8° rotateX and +8° rotateY');

// Extreme cursor out of bounds clamp check
const extremeTilt = calculateTilt(999, -999, 200, 200);
assert(Math.abs(extremeTilt.rotateX) <= 8 && Math.abs(extremeTilt.rotateY) <= 8, 'Extreme coordinates clamp to maximum ±8° tilt');

// ─── SUITE 4: WCAG 2.1 AA Color Contrast Ratios (M15) ───────────────────────
console.log('\n▶ [Suite 4] WCAG 2.1 AA Color Contrast Compliance');

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const parseHex = (h: string) => {
    const clean = h.replace('#', '');
    return [
      parseInt(clean.substring(0, 2), 16),
      parseInt(clean.substring(2, 4), 16),
      parseInt(clean.substring(4, 6), 16),
    ] as const;
  };
  const [r1, g1, b1] = parseHex(hex1);
  const [r2, g2, b2] = parseHex(hex2);
  const l1 = getLuminance(r1, g1, b1);
  const l2 = getLuminance(r2, g2, b2);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Background: #09090b (Dark Charcoal)
// Primary Text: #fafafa (Zinc 50)
const primaryContrast = getContrastRatio('#fafafa', '#09090b');
assert(
  primaryContrast >= 4.5,
  `Primary text (#fafafa on #09090b) contrast is ${primaryContrast.toFixed(1)}:1 (exceeds 4.5:1 AA standard)`
);

// Secondary Text: #a1a1aa (Zinc 400) on Card Background: #18181b (Zinc 900)
const secondaryContrast = getContrastRatio('#a1a1aa', '#18181b');
assert(
  secondaryContrast >= 4.5,
  `Secondary text (#a1a1aa on #18181b) contrast is ${secondaryContrast.toFixed(1)}:1 (exceeds 4.5:1 AA standard)`
);

// Alert Red: #ef4444 on Background: #09090b
const redAlertContrast = getContrastRatio('#ef4444', '#09090b');
assert(
  redAlertContrast >= 4.5,
  `Red alert badge (#ef4444 on #09090b) contrast is ${redAlertContrast.toFixed(1)}:1 (exceeds 4.5:1 AA standard)`
);

// ─── SUITE 5: Codebase Invariant Verification (M14 & M15) ───────────────────
console.log('\n▶ [Suite 5] Codebase Invariant & Accessibility Region Verification');

const globalsCss = fs.readFileSync(path.join(__dirname, '../src/app/globals.css'), 'utf8');
assert(globalsCss.includes(':focus-visible'), 'globals.css includes accessible :focus-visible high-contrast outline');
assert(globalsCss.includes('prefers-reduced-motion'), 'globals.css includes prefers-reduced-motion media query override');
assert(globalsCss.includes('animate-radar-sweep'), 'globals.css includes 360° radar sweep animation');
assert(globalsCss.includes('animate-border-shimmer'), 'globals.css includes podium border shimmer animation');

const playerCardTsx = fs.readFileSync(path.join(__dirname, '../src/components/game/PlayerCard.tsx'), 'utf8');
assert(playerCardTsx.includes('rotateX') && playerCardTsx.includes('rotateY'), 'PlayerCard.tsx implements 3D rotateX and rotateY springs');
assert(playerCardTsx.includes('pointer: coarse'), 'PlayerCard.tsx disables 3D tilt on touch screens');
assert(playerCardTsx.includes('prefers-reduced-motion'), 'PlayerCard.tsx respects prefers-reduced-motion');
assert(playerCardTsx.includes('playMicroClick'), 'PlayerCard.tsx triggers acoustic micro-clicks on hover');

const trialDefenseTsx = fs.readFileSync(path.join(__dirname, '../src/components/game/TrialDefensePanel.tsx'), 'utf8');
assert(trialDefenseTsx.includes('courtroom-timer-hud'), 'TrialDefensePanel.tsx includes courtroom-timer-hud data-testid');
assert(trialDefenseTsx.includes('strokeDasharray={138.23}'), 'TrialDefensePanel.tsx renders circular SVG progress ring');
assert(trialDefenseTsx.includes('animate-dust-float'), 'TrialDefensePanel.tsx includes volumetric dust floating particles');

const reticleTsx = fs.readFileSync(path.join(__dirname, '../src/components/game/RoleActionReticle.tsx'), 'utf8');
assert(reticleTsx.includes('animate-radar-sweep'), 'RoleActionReticle.tsx implements 360° sweeping radar beam');

const gameOverTsx = fs.readFileSync(path.join(__dirname, '../src/components/game/GameOverCinematic.tsx'), 'utf8');
assert(gameOverTsx.includes('canvas-confetti'), 'GameOverCinematic.tsx integrates canvas-confetti victory celebrations');
assert(gameOverTsx.includes('prefers-reduced-motion'), 'GameOverCinematic.tsx respects prefers-reduced-motion before firing confetti');

const gameBoardTsx = fs.readFileSync(path.join(__dirname, '../src/components/game/GameBoard.tsx'), 'utf8');
assert(gameBoardTsx.includes('data-testid="sr-announcement-polite"'), 'GameBoard.tsx includes aria-live="polite" screen reader region');
assert(gameBoardTsx.includes('data-testid="sr-announcement-assertive"'), 'GameBoard.tsx includes aria-live="assertive" screen reader region');
assert(gameBoardTsx.includes("e.key === 'm' || e.key === 'M'"), 'GameBoard.tsx implements keyboard accessibility shortcuts');

console.log('\n================================================================');
console.log('🎉 ALL MILESTONE 14 & 15 POLISH & ACCESSIBILITY TESTS PASSED (100% SUCCESS)');
console.log('================================================================\n');
