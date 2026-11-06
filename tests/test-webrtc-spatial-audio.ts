/**
 * Automated Unit Test Suite: Milestone 8 — Real-Time WebRTC Audio Spatialization & Speaking Indicators
 *
 * Verifies:
 * - Suite 1: calculatePlayerPan Mathematical Invariants (TABLE & GRID modes, boundary clamping, -0 normalization)
 * - Suite 2: calculate3DPosition Cartesian Coordinates & Radius Mapping
 * - Suite 3: isMicAllowedByPhase Game Rules & Courtroom Podium Isolation
 * - Suite 4: computeRMS & 350ms Hangover VAD Simulation
 * - Suite 5: SFX Spatial Panning via StereoPannerNode (playCard, playElimination, playGavel)
 * - Suite 6: Audio Types & Interface Contracts
 */

import assert from 'node:assert';
import {
  calculatePlayerPan,
  calculate3DPosition,
  isMicAllowedByPhase,
  computeRMS,
  VAD_HANGOVER_MS,
  DEFAULT_SPEAKING_THRESHOLD,
} from '../src/utils/spatialAudio';
import * as sfx from '../src/utils/sfx';
import type { SpatialCoordinates, VoicePeerSpatialState } from '../src/types/audio';
import type { GamePhase } from '../src/types/game';

console.log('================================================================');
console.log('STARTING WEBRTC SPATIAL AUDIO & SPEAKING INDICATORS TEST SUITE');
console.log('================================================================\n');

// ============================================================================
// SUITE 1: calculatePlayerPan Invariants (TABLE & GRID)
// ============================================================================
console.log('▶ [Suite 1] calculatePlayerPan Mathematical Invariants');

// 1.1 Single player or 0 players -> always 0.0 (no panning needed)
assert.strictEqual(calculatePlayerPan(0, 1), 0.0, 'Single player table must return 0.0');
assert.strictEqual(calculatePlayerPan(0, 0), 0.0, 'Zero player table must return 0.0');
assert.strictEqual(calculatePlayerPan(0, 1, 0, 'GRID', 4), 0.0, 'Single player grid must return 0.0');

// 1.2 4-Player Table:
// Listener at index 0:
// - Index 0 (self) -> relative angle 0 -> pan = 0.0
// - Index 1 (90 deg right) -> relative angle pi/2 -> pan = 1.0
// - Index 2 (180 deg opposite) -> relative angle pi -> pan = 0.0
// - Index 3 (270 deg / 90 deg left) -> relative angle 3pi/2 -> pan = -1.0
assert.strictEqual(calculatePlayerPan(0, 4, 0, 'TABLE'), 0.0, 'Self player must be centered (0.0)');
assert.strictEqual(calculatePlayerPan(1, 4, 0, 'TABLE'), 1.0, 'Player 1 (90 deg right) must be hard right (+1.0)');
assert.strictEqual(calculatePlayerPan(2, 4, 0, 'TABLE'), 0.0, 'Player 2 (opposite) must be centered (0.0)');
assert.strictEqual(calculatePlayerPan(3, 4, 0, 'TABLE'), -1.0, 'Player 3 (90 deg left) must be hard left (-1.0)');
console.log('  ✔ 1.1: 4-Player cardinal table positions verified (0.0, +1.0, 0.0, -1.0)');

// 1.3 Offset listener index (myIndex = 2 in 4 players)
assert.strictEqual(calculatePlayerPan(2, 4, 2, 'TABLE'), 0.0, 'Self player at index 2 must be 0.0');
assert.strictEqual(calculatePlayerPan(3, 4, 2, 'TABLE'), 1.0, 'Player 3 relative to index 2 is 90 deg right (+1.0)');
assert.strictEqual(calculatePlayerPan(0, 4, 2, 'TABLE'), 0.0, 'Player 0 relative to index 2 is opposite (0.0)');
assert.strictEqual(calculatePlayerPan(1, 4, 2, 'TABLE'), -1.0, 'Player 1 relative to index 2 is 90 deg left (-1.0)');
console.log('  ✔ 1.2: Relative listener offset (myIndex != 0) verified');

// 1.4 Clamping and -0 normalization across 40-player All-In lobby
for (let myIdx = 0; myIdx < 40; myIdx += 7) {
  for (let pIdx = 0; pIdx < 40; pIdx++) {
    const pan = calculatePlayerPan(pIdx, 40, myIdx, 'TABLE');
    assert(pan >= -1.0 && pan <= 1.0, `Pan ${pan} must be clamped between -1.0 and 1.0`);
    assert(!Object.is(pan, -0), `Pan must not be negative zero (-0)`);
  }
}
console.log('  ✔ 1.3: 40-Player circular table sweep bounds & -0 normalization verified');

// 1.5 GRID Mode: 4 columns
assert.strictEqual(calculatePlayerPan(0, 16, 0, 'GRID', 4), -1.0, 'Col 0 must be hard left (-1.0)');
assert.strictEqual(calculatePlayerPan(1, 16, 0, 'GRID', 4), -0.33, 'Col 1 must be -0.33');
assert.strictEqual(calculatePlayerPan(2, 16, 0, 'GRID', 4), 0.33, 'Col 2 must be +0.33');
assert.strictEqual(calculatePlayerPan(3, 16, 0, 'GRID', 4), 1.0, 'Col 3 must be hard right (+1.0)');
assert.strictEqual(calculatePlayerPan(4, 16, 0, 'GRID', 4), -1.0, 'Col 4 (wrapped col 0) must be hard left (-1.0)');
assert.strictEqual(calculatePlayerPan(7, 16, 0, 'GRID', 4), 1.0, 'Col 7 (wrapped col 3) must be hard right (+1.0)');
console.log('  ✔ 1.4: GRID column mapping across 4 columns verified');

// ============================================================================
// SUITE 2: calculate3DPosition Cartesian Coordinates & Radius Mapping
// ============================================================================
console.log('\n▶ [Suite 2] calculate3DPosition Cartesian Coordinates');

const posSelf = calculate3DPosition(0, 4, 0, 2.5);
assert.strictEqual(posSelf.length, 3, 'Position must have [x, y, z]');
assert.strictEqual(posSelf[0], 0.0, 'Self X must be 0.0');
assert.strictEqual(posSelf[1], 0.0, 'Self Y (elevation) must be 0.0');
assert.strictEqual(posSelf[2], -2.5, 'Self Z must be -2.5m (directly in front of listener)');

const posRight = calculate3DPosition(1, 4, 0, 2.5);
assert.strictEqual(posRight[0], 2.5, '90 deg right X must be +2.5m');
assert.strictEqual(posRight[1], 0.0, '90 deg right Y must be 0.0');
assert.strictEqual(posRight[2], 0.0, '90 deg right Z must be 0.0');

const posOpposite = calculate3DPosition(2, 4, 0, 2.5);
assert.strictEqual(posOpposite[0], 0.0, 'Opposite X must be 0.0');
assert.strictEqual(posOpposite[2], 2.5, 'Opposite Z must be +2.5m (behind/across)');

const posLeft = calculate3DPosition(3, 4, 0, 2.5);
assert.strictEqual(posLeft[0], -2.5, '90 deg left X must be -2.5m');
assert.strictEqual(posLeft[2], 0.0, '90 deg left Z must be 0.0');
console.log('  ✔ 2.1: 3D spatial circular coordinates [X, Y, Z] verified with 2.5m radius');

// Custom radius
const customRadiusPos = calculate3DPosition(1, 4, 0, 10.0);
assert.strictEqual(customRadiusPos[0], 10.0, 'Custom radius 10m maps to X = 10.0');
console.log('  ✔ 2.2: Custom radius scaling verified');

// ============================================================================
// SUITE 3: isMicAllowedByPhase Rules & Courtroom Podium Isolation
// ============================================================================
console.log('\n▶ [Suite 3] isMicAllowedByPhase Rules & Courtroom Podium Isolation');

const allPhases: GamePhase[] = [
  'LOBBY',
  'DAY_CENTRAL_ASSEMBLY',
  'DAY_REGIONAL_CAUCUS',
  'DAY_VOTING',
  'TRIAL_DEFENSE',
  'NIGHT_BUFFER',
  'ENDED',
];

// 3.1 Dead players cannot speak in ANY phase
allPhases.forEach((p) => {
  assert.strictEqual(
    isMicAllowedByPhase(p, 'MAFIA', false, true),
    false,
    `Dead player must be muted in phase ${p}`
  );
  assert.strictEqual(
    isMicAllowedByPhase(p, 'TOWN', false, false),
    false,
    `Dead player must be muted in phase ${p}`
  );
});
console.log('  ✔ 3.1: Ölüm Sükutu (Dead players muted in all 7 phases) verified');

// 3.2 LOBBY & ENDED are always muted
assert.strictEqual(isMicAllowedByPhase('LOBBY', 'TOWN', true, false), false);
assert.strictEqual(isMicAllowedByPhase('LOBBY', 'MAFIA', true, false), false);
assert.strictEqual(isMicAllowedByPhase('ENDED', 'TOWN', true, false), false);
assert.strictEqual(isMicAllowedByPhase('ENDED', 'MAFIA', true, false), false);
console.log('  ✔ 3.2: LOBBY and ENDED microphone lockdown verified');

// 3.3 TRIAL_DEFENSE Courtroom Podium Isolation:
// ONLY the accused player is permitted to speak!
assert.strictEqual(
  isMicAllowedByPhase('TRIAL_DEFENSE', 'TOWN', true, true),
  true,
  'Living accused defendant must be allowed to speak on the podium'
);
assert.strictEqual(
  isMicAllowedByPhase('TRIAL_DEFENSE', 'MAFIA', true, true),
  true,
  'Living accused mafia defendant must be allowed to speak on the podium'
);
assert.strictEqual(
  isMicAllowedByPhase('TRIAL_DEFENSE', 'TOWN', true, false),
  false,
  'Living non-accused Town player must be SILENCED during trial defense'
);
assert.strictEqual(
  isMicAllowedByPhase('TRIAL_DEFENSE', 'MAFIA', true, false),
  false,
  'Living non-accused Mafia member must be SILENCED during trial defense'
);
console.log('  ✔ 3.3: TRIAL_DEFENSE Courtroom Podium Isolation (Accused only) verified');

// 3.4 NIGHT_BUFFER Syndicate Channel Gating:
assert.strictEqual(isMicAllowedByPhase('NIGHT_BUFFER', 'MAFIA', true, false), true, 'Mafia can speak at night');
assert.strictEqual(isMicAllowedByPhase('NIGHT_BUFFER', 'YAKUZA', true, false), true, 'Yakuza can speak at night');
assert.strictEqual(isMicAllowedByPhase('NIGHT_BUFFER', 'TOWN', true, false), false, 'Town silenced at night');
assert.strictEqual(isMicAllowedByPhase('NIGHT_BUFFER', null, true, false), false, 'Unknown faction silenced at night');
assert.strictEqual(isMicAllowedByPhase('NIGHT_BUFFER', 'NEUTRAL', true, false), false, 'Neutral silenced at night');
console.log('  ✔ 3.4: NIGHT_BUFFER syndicate voice channel gating verified');

// 3.5 DAY phases allow all living players
const dayPhases: GamePhase[] = ['DAY_CENTRAL_ASSEMBLY', 'DAY_REGIONAL_CAUCUS', 'DAY_VOTING'];
dayPhases.forEach((p) => {
  assert.strictEqual(isMicAllowedByPhase(p, 'TOWN', true, false), true);
  assert.strictEqual(isMicAllowedByPhase(p, 'MAFIA', true, false), true);
  assert.strictEqual(isMicAllowedByPhase(p, null, true, false), true);
});
console.log('  ✔ 3.5: DAY discussion and voting phases allow all living participants');

// ============================================================================
// SUITE 4: computeRMS & 350ms Hangover VAD Simulation
// ============================================================================
console.log('\n▶ [Suite 4] computeRMS & 350ms Hangover VAD Simulation');

// 4.1 RMS math
const silenceBuffer = new Uint8Array(256).fill(128);
assert.strictEqual(computeRMS(silenceBuffer), 0.0, 'RMS of baseline 128 is 0.0');

const waveBuffer = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  waveBuffer[i] = i % 2 === 0 ? 128 + 50 : 128 - 50;
}
assert.strictEqual(Math.round(computeRMS(waveBuffer)), 50, 'RMS of +/- 50 square wave is 50');
assert.strictEqual(computeRMS(new Uint8Array(0)), 0, 'RMS of empty buffer is 0');
console.log('  ✔ 4.1: computeRMS amplitude calculation verified');

// 4.2 350ms Hangover VAD Simulation
interface PeerVADSim {
  lastSpokeAt: number;
  isSpeaking: boolean;
}

function updatePeerVAD(peer: PeerVADSim, rms: number, currentTime: number): boolean {
  if (rms > DEFAULT_SPEAKING_THRESHOLD) {
    peer.lastSpokeAt = currentTime;
    peer.isSpeaking = true;
  } else if (currentTime - peer.lastSpokeAt < VAD_HANGOVER_MS) {
    peer.isSpeaking = true; // Hangover sustain
  } else {
    peer.isSpeaking = false;
  }
  return peer.isSpeaking;
}

const simPeer: PeerVADSim = { lastSpokeAt: -1000, isSpeaking: false };

// Timeline step 1: Silence at t=0ms
assert.strictEqual(updatePeerVAD(simPeer, 5, 0), false, 'Silence at t=0 must be not speaking');

// Timeline step 2: Speech burst at t=100ms
assert.strictEqual(updatePeerVAD(simPeer, 45, 100), true, 'Speech burst at t=100 must trigger speaking');
assert.strictEqual(simPeer.lastSpokeAt, 100);

// Timeline step 3: Speech pause at t=200ms (100ms elapsed since last spoke)
assert.strictEqual(updatePeerVAD(simPeer, 8, 200), true, 'Hangover at 100ms gap maintains speaking');

// Timeline step 4: Speech pause continues at t=350ms (250ms elapsed)
assert.strictEqual(updatePeerVAD(simPeer, 10, 350), true, 'Hangover at 250ms gap maintains speaking');

// Timeline step 5: Speech pause continues at t=449ms (349ms elapsed < 350ms)
assert.strictEqual(updatePeerVAD(simPeer, 5, 449), true, 'Hangover at 349ms gap still maintains speaking');

// Timeline step 6: Silence sustained at t=451ms (351ms elapsed > 350ms)
assert.strictEqual(updatePeerVAD(simPeer, 5, 451), false, 'Hangover expires at 351ms -> speaking turns off cleanly');

// Timeline step 7: New speech burst at t=600ms
assert.strictEqual(updatePeerVAD(simPeer, 35, 600), true, 'New speech at t=600 immediately re-engages');
console.log('  ✔ 4.2: 350ms Hangover VAD prevents flicker during inter-syllable gaps');

// ============================================================================
// SUITE 5: SFX Spatial Panning via StereoPannerNode
// ============================================================================
console.log('\n▶ [Suite 5] SFX Spatial Panning via StereoPannerNode in Web Audio');

class MockAudioParam {
  value: number;
  events: Array<{ type: string; value: number; time: number }> = [];

  constructor(initialValue: number = 0) {
    this.value = initialValue;
  }

  setValueAtTime(val: number, time: number): void {
    this.value = val;
    this.events.push({ type: 'setValueAtTime', value: val, time });
  }

  linearRampToValueAtTime(val: number, time: number): void {
    this.value = val;
    this.events.push({ type: 'linearRampToValueAtTime', value: val, time });
  }

  exponentialRampToValueAtTime(val: number, time: number): void {
    this.value = val;
    this.events.push({ type: 'exponentialRampToValueAtTime', value: val, time });
  }

  cancelScheduledValues(time: number): void {
    this.events.push({ type: 'cancelScheduledValues', value: 0, time });
  }
}

class MockAudioNode {
  connectedNodes: any[] = [];
  connect(dest: any): any {
    this.connectedNodes.push(dest);
    return dest;
  }
  disconnect(): void {
    this.connectedNodes = [];
  }
}

class MockStereoPannerNode extends MockAudioNode {
  pan = new MockAudioParam(0);
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam(1);
}

class MockOscillatorNode extends MockAudioNode {
  type: OscillatorType = 'sine';
  frequency = new MockAudioParam(440);
  start(_time: number = 0): void {}
  stop(_time: number = 0): void {}
}

class MockBiquadFilterNode extends MockAudioNode {
  type: BiquadFilterType = 'lowpass';
  frequency = new MockAudioParam(350);
}

let createdPannerNodes: MockStereoPannerNode[] = [];

class MockSpatialAudioContext {
  currentTime = 10.0;
  state: AudioContextState = 'running';
  destination = new MockAudioNode();

  createGain(): MockGainNode {
    return new MockGainNode();
  }

  createOscillator(): MockOscillatorNode {
    return new MockOscillatorNode();
  }

  createBiquadFilter(): MockBiquadFilterNode {
    return new MockBiquadFilterNode();
  }

  createStereoPanner(): MockStereoPannerNode {
    const panner = new MockStereoPannerNode();
    createdPannerNodes.push(panner);
    return panner;
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }
}

// Attach mock environment
const originalWindow = (globalThis as any).window;
const mockWindow: any = {
  AudioContext: MockSpatialAudioContext,
  localStorage: {
    getItem: () => 'false',
    setItem: () => {},
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
};

(globalThis as any).window = mockWindow;

// Test playCard with pan = 0.8 (right speaker)
createdPannerNodes = [];
sfx.playCard(0.8);
assert(createdPannerNodes.length >= 1, 'playCard(0.8) must instantiate a StereoPannerNode');
const lastPanner = createdPannerNodes[createdPannerNodes.length - 1];
assert.strictEqual(lastPanner.pan.value, 0.8, 'StereoPannerNode pan must be set to 0.8');
console.log('  ✔ 5.1: playCard(0.8) creates StereoPannerNode panned to +0.8');

// Test playElimination with pan = -0.75 (left speaker)
createdPannerNodes = [];
sfx.playElimination(-0.75);
assert(createdPannerNodes.length >= 1, 'playElimination(-0.75) must instantiate a StereoPannerNode');
assert.strictEqual(createdPannerNodes[0].pan.value, -0.75, 'StereoPannerNode pan must be set to -0.75');
console.log('  ✔ 5.2: playElimination(-0.75) creates StereoPannerNode panned to -0.75');

// Test playGavel with default pan = 0.0
createdPannerNodes = [];
sfx.playGavel(0.0);
assert(createdPannerNodes.length >= 1, 'playGavel(0.0) must instantiate a StereoPannerNode');
assert.strictEqual(createdPannerNodes[0].pan.value, 0.0, 'playGavel pan must be centered at 0.0');
console.log('  ✔ 5.3: playGavel(0.0) creates centered StereoPannerNode at 0.0');

// Restore original window
(globalThis as any).window = originalWindow;

// ============================================================================
// SUITE 6: Audio Types & Interface Contracts
// ============================================================================
console.log('\n▶ [Suite 6] Audio Types & Interface Contracts');

const testSpatialCoord: SpatialCoordinates = {
  pan: -0.5,
  position3D: [-1.25, 0, -2.16],
};
assert.strictEqual(testSpatialCoord.pan, -0.5);
assert.strictEqual(testSpatialCoord.position3D?.[0], -1.25);

const testPeerState: VoicePeerSpatialState = {
  peerId: 'usr-peer-1',
  isSpeaking: true,
  audioLevel: 85,
  pan: 0.65,
  isMutedByPhase: false,
  isPodiumSpotlight: true,
};
assert.strictEqual(testPeerState.peerId, 'usr-peer-1');
assert.strictEqual(testPeerState.isSpeaking, true);
assert.strictEqual(testPeerState.isPodiumSpotlight, true);
console.log('  ✔ 6.1: SpatialCoordinates and VoicePeerSpatialState interfaces fully compliant');

console.log('\n================================================================');
console.log('🎉 ALL WEBRTC SPATIAL AUDIO & INDICATOR TESTS PASSED (100% SUCCESS)');
console.log('================================================================');
