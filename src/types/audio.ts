/**
 * WebRTC & Spatial Audio Types for TDV Mafia
 * Defines audio coordinate mapping, voice activity detection states, and peer spatial parameters.
 */

export interface SpatialCoordinates {
  readonly pan: number; // -1.0 (hard left) to +1.0 (hard right)
  readonly position3D?: readonly [x: number, y: number, z: number];
}

export interface VoicePeerSpatialState {
  readonly peerId: string;
  readonly isSpeaking: boolean;
  readonly audioLevel: number; // 0 to 100
  readonly pan: number;
  readonly isMutedByPhase: boolean;
  readonly isPodiumSpotlight: boolean;
}
