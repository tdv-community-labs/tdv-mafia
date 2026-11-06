/**
 * Spatial Audio & Coordinate Utilities for TDV Mafia
 * Handles calculation of stereo pan (-1.0 to +1.0), 3D sound coordinates,
 * voice activity detection (VAD) RMS computation, and phase-based microphone permissions.
 */

import { GamePhase } from '../types/game';

export const VAD_HANGOVER_MS = 350;
export const DEFAULT_SPEAKING_THRESHOLD = 20;

/**
 * Calculates stereo pan (-1.0 hard left to +1.0 hard right) for a player.
 * Supports both virtual circular table seating and responsive grid column layouts.
 *
 * @param playerIndex Index of the target player
 * @param totalPlayers Total number of players in the session
 * @param myIndex Index of the local listening player (default 0)
 * @param mode 'TABLE' for circular layout (default) or 'GRID' for column layout
 * @param gridColumns Total number of columns in grid layout (default 4)
 * @returns Pan scalar clamped between -1.0 and +1.0 rounded to 2 decimal places
 */
export function calculatePlayerPan(
  playerIndex: number,
  totalPlayers: number,
  myIndex: number = 0,
  mode: 'GRID' | 'TABLE' = 'TABLE',
  gridColumns: number = 4
): number {
  if (totalPlayers <= 1) return 0.0;

  if (mode === 'GRID') {
    if (gridColumns <= 1) return 0.0;
    // Map column index to normalized [-1.0, 1.0] range
    const col = ((playerIndex % gridColumns) + gridColumns) % gridColumns;
    const pan = (2 * col) / (gridColumns - 1) - 1.0;
    return Math.round(Math.max(-1.0, Math.min(1.0, pan)) * 100) / 100;
  }

  // Circular table relative angular offset
  const angle = (2 * Math.PI * (playerIndex - myIndex)) / totalPlayers;
  // Sine mapping: right (+1.0), left (-1.0), self & opposite (0.0)
  const pan = Math.sin(angle);
  const rounded = Math.round(Math.max(-1.0, Math.min(1.0, pan)) * 100) / 100;

  // Normalize -0 to 0
  return Object.is(rounded, -0) ? 0.0 : rounded;
}

/**
 * Calculates 3D Cartesian coordinates [X, Y, Z] in meters for binaural HRTF PannerNode.
 * Listener is assumed at [0, 0, 0] looking toward negative Z axis [0, 0, -1].
 *
 * @param playerIndex Index of the target player
 * @param totalPlayers Total number of players in the session
 * @param myIndex Index of the local listening player (default 0)
 * @param radius Radius of virtual circular table in meters (default 2.5m)
 * @returns 3D tuple [x, y, z]
 */
export function calculate3DPosition(
  playerIndex: number,
  totalPlayers: number,
  myIndex: number = 0,
  radius: number = 2.5
): [number, number, number] {
  const safeTotal = Math.max(1, totalPlayers);
  const angle = (2 * Math.PI * (playerIndex - myIndex)) / safeTotal;
  const rawX = radius * Math.sin(angle);
  const rawZ = -radius * Math.cos(angle);

  const x = Object.is(Math.round(rawX * 100) / 100, -0) ? 0.0 : Math.round(rawX * 100) / 100;
  const z = Object.is(Math.round(rawZ * 100) / 100, -0) ? 0.0 : Math.round(rawZ * 100) / 100;

  return [x, 0, z];
}

/**
 * Evaluates whether microphone broadcast is permitted for a player in the current game phase.
 *
 * Phase Rules:
 *  - LOBBY / ENDED: Never permitted (lobby text-only or finished game).
 *  - Dead players: Never permitted (Ölüm Sükutu).
 *  - TRIAL_DEFENSE: Permitted ONLY for the accused player standing at the podium.
 *  - NIGHT_BUFFER: Permitted ONLY for living MAFIA or YAKUZA syndicate members.
 *  - DAY phases (DAY_CENTRAL_ASSEMBLY, DAY_REGIONAL_CAUCUS, DAY_VOTING): All living players can speak.
 *
 * @param phase Current game phase
 * @param myFaction Player faction or null
 * @param isAlive Player alive status
 * @param isAccused Whether player is currently the accused defendant on the podium
 * @returns Boolean indicating whether mic broadcast is allowed
 */
export function isMicAllowedByPhase(
  phase: GamePhase,
  myFaction: string | null,
  isAlive: boolean,
  isAccused: boolean = false
): boolean {
  if (phase === 'LOBBY' || phase === 'ENDED') return false;
  if (!isAlive) return false;
  if (phase === 'TRIAL_DEFENSE') return isAccused;
  if (phase === 'NIGHT_BUFFER') return myFaction === 'MAFIA' || myFaction === 'YAKUZA';
  return true;
}

/**
 * Computes root-mean-square (RMS) amplitude from 8-bit time-domain audio data (0-255).
 * Centered around silence baseline (128).
 */
export function computeRMS(data: Uint8Array<ArrayBuffer> | Uint8Array): number {
  if (!data || data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const centered = data[i] - 128;
    sum += centered * centered;
  }
  return Math.sqrt(sum / data.length);
}
