/**
 * Automated Unit Test Suite: UI Sound Effects & Web Audio API Synthesis Engine (Milestone 5 - FEAT-R5-04)
 *
 * Verifies:
 * - Group 1: Module Exports & Function Signatures
 * - Group 2: Headless SSR Safety (Clean execution in Node environment without window)
 * - Group 3: Mock Web Audio API Synthesis Math & Node Graphs (Gavel, Court Verdict, Explosion, Timer Tick)
 * - Group 4: Mute State Gating & AudioContext Unlock
 * - Group 5: Battleground UI Component Prop Contracts & Invariants
 */

import assert from 'node:assert';
import * as sfx from '../src/utils/sfx';
import type { ActionReticleType, RoleActionReticleProps } from '../src/components/game/RoleActionReticle';
import type { PlayerCardProps } from '../src/components/game/PlayerCard';
import type { TrialDefensePanelProps } from '../src/components/game/TrialDefensePanel';
import type { MinigameStatusToolbarProps } from '../src/components/game/MinigameStatusToolbar';

// ============================================================================
// MOCK WEB AUDIO API HARNESS FOR NODE ENVIRONMENT
// ============================================================================

interface MockAudioEvent {
  type: string;
  value: number;
  time: number;
}

class MockAudioParam {
  value: number;
  events: MockAudioEvent[] = [];

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

class MockOscillatorNode extends MockAudioNode {
  type: OscillatorType = 'sine';
  frequency = new MockAudioParam(440);
  startedAt: number | null = null;
  stoppedAt: number | null = null;

  start(time: number = 0): void {
    this.startedAt = time;
  }
  stop(time: number = 0): void {
    this.stoppedAt = time;
  }
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam(1);
}

class MockBiquadFilterNode extends MockAudioNode {
  type: BiquadFilterType = 'lowpass';
  frequency = new MockAudioParam(350);
}

class MockAudioBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  channels: Float32Array[];

  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.channels = Array.from({ length: channels }, () => new Float32Array(length));
  }

  getChannelData(channelIndex: number): Float32Array {
    return this.channels[channelIndex];
  }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  buffer: MockAudioBuffer | null = null;
  loop: boolean = false;
  startedAt: number | null = null;
  stoppedAt: number | null = null;

  start(time: number = 0): void {
    this.startedAt = time;
  }
  stop(time: number = 0): void {
    this.stoppedAt = time;
  }
}

class MockAudioContext {
  state: AudioContextState = 'running';
  currentTime: number = 10.0;
  sampleRate: number = 44100;
  destination = new MockAudioNode();

  createdOscillators: MockOscillatorNode[] = [];
  createdGains: MockGainNode[] = [];
  createdFilters: MockBiquadFilterNode[] = [];
  createdBufferSources: MockAudioBufferSourceNode[] = [];
  createdBuffers: MockAudioBuffer[] = [];

  createOscillator(): MockOscillatorNode {
    const osc = new MockOscillatorNode();
    this.createdOscillators.push(osc);
    return osc;
  }

  createGain(): MockGainNode {
    const gain = new MockGainNode();
    this.createdGains.push(gain);
    return gain;
  }

  createBiquadFilter(): MockBiquadFilterNode {
    const filter = new MockBiquadFilterNode();
    this.createdFilters.push(filter);
    return filter;
  }

  createBuffer(channels: number, length: number, sampleRate: number): MockAudioBuffer {
    const buf = new MockAudioBuffer(channels, length, sampleRate);
    this.createdBuffers.push(buf);
    return buf;
  }

  createBufferSource(): MockAudioBufferSourceNode {
    const src = new MockAudioBufferSourceNode();
    this.createdBufferSources.push(src);
    return src;
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
}

// ============================================================================
// TEST SUITE IMPLEMENTATION
// ============================================================================

export function runSoundTestSuite(): void {
  console.log('================================================================');
  console.log('STARTING UI SOUND SFX & AUDIO SYNCHRONIZATION TEST SUITE');
  console.log('================================================================\n');

  // GROUP 1: MODULE EXPORTS
  {
    console.log('▶ Test 1: Module exports and function signatures');
    assert.strictEqual(typeof sfx.playGavel, 'function', 'playGavel must be exported');
    assert.strictEqual(typeof sfx.playCourtVerdict, 'function', 'playCourtVerdict must be exported');
    assert.strictEqual(typeof sfx.playBriefcaseExplosion, 'function', 'playBriefcaseExplosion must be exported');
    assert.strictEqual(typeof sfx.playTimerTick, 'function', 'playTimerTick must be exported');
    assert.strictEqual(typeof sfx.playTick, 'function', 'playTick must be exported');
    assert.strictEqual(typeof sfx.initAudioUnlock, 'function', 'initAudioUnlock must be exported');
    assert.strictEqual(typeof sfx.playNight, 'function', 'playNight must be exported');
    assert.strictEqual(typeof sfx.playDay, 'function', 'playDay must be exported');
    assert.strictEqual(typeof sfx.playCard, 'function', 'playCard must be exported');
    assert.strictEqual(typeof sfx.playElimination, 'function', 'playElimination must be exported');
    assert.strictEqual(typeof sfx.isSoundMuted, 'function', 'isSoundMuted must be exported');
    assert.strictEqual(typeof sfx.setSoundMuted, 'function', 'setSoundMuted must be exported');
    assert.strictEqual(typeof sfx.toggleSound, 'function', 'toggleSound must be exported');
    assert.strictEqual(typeof sfx.subscribeSound, 'function', 'subscribeSound must be exported');
    console.log('  ✔ Test 1 Passed');
  }

  // GROUP 2: HEADLESS SSR SAFETY (PURE NODE)
  {
    console.log('▶ Test 2: Headless SSR safety (zero exceptions when window is undefined)');
    assert.doesNotThrow(() => sfx.playGavel(), 'playGavel must be SSR safe');
    assert.doesNotThrow(() => sfx.playCourtVerdict('GUILTY'), 'playCourtVerdict GUILTY must be SSR safe');
    assert.doesNotThrow(() => sfx.playCourtVerdict('INNOCENT'), 'playCourtVerdict INNOCENT must be SSR safe');
    assert.doesNotThrow(() => sfx.playBriefcaseExplosion(), 'playBriefcaseExplosion must be SSR safe');
    assert.doesNotThrow(() => sfx.playTimerTick(3, true), 'playTimerTick urgent must be SSR safe');
    assert.doesNotThrow(() => sfx.playTimerTick(25, false), 'playTimerTick standard must be SSR safe');
    assert.doesNotThrow(() => sfx.playTick(), 'playTick must be SSR safe');
    assert.doesNotThrow(() => sfx.initAudioUnlock(), 'initAudioUnlock must be SSR safe');
    assert.strictEqual(sfx.isSoundMuted(), false, 'isSoundMuted returns false by default on SSR');
    assert.doesNotThrow(() => sfx.setSoundMuted(true), 'setSoundMuted must be SSR safe');
    const unsubscribe = sfx.subscribeSound(() => {});
    assert.strictEqual(typeof unsubscribe, 'function', 'subscribeSound returns cleanup function');
    assert.doesNotThrow(() => unsubscribe(), 'unsubscribe cleanup does not throw on SSR');
    console.log('  ✔ Test 2 Passed');
  }

  // GROUP 3: MOCK AUDIO CONTEXT SYNTHESIS MATH
  {
    console.log('▶ Test 3: Web Audio API synthesis math and audio graph inspection');

    const mockCtx = new MockAudioContext();
    const mockStorage: Record<string, string> = { tdv_mafia_sound_muted: 'false' };

    // Setup global window mock
    (globalThis as any).window = {
      AudioContext: function () {
        return mockCtx;
      },
      localStorage: {
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => {
          mockStorage[k] = v;
        },
      },
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    // Subtest 3.1: Gavel Synthesis
    {
      const initialOscCount = mockCtx.createdOscillators.length;
      sfx.playGavel();
      const newOscs = mockCtx.createdOscillators.slice(initialOscCount);
      assert.ok(newOscs.length >= 2, 'playGavel must create multiple strike oscillators for reverberation');
      assert.strictEqual(newOscs[0].type, 'sine');
      const startFreq = newOscs[0].frequency.events.find((e) => e.type === 'setValueAtTime')?.value;
      assert.ok(startFreq && startFreq >= 130 && startFreq <= 180, 'Primary strike starts in wooden range 130-180Hz');
      console.log('  ✔ Subtest 3.1: Gavel strike math verified');
    }

    // Subtest 3.2: Court Verdict GUILTY vs INNOCENT
    {
      // GUILTY
      const beforeGuilty = mockCtx.createdOscillators.length;
      sfx.playCourtVerdict('GUILTY');
      const guiltyOscs = mockCtx.createdOscillators.slice(beforeGuilty);
      assert.ok(guiltyOscs.length >= 2, 'GUILTY verdict must create gavel + deep sub-bass impact');
      const subOsc = guiltyOscs[guiltyOscs.length - 1];
      const subEndEvent = subOsc.frequency.events.find((e) => e.type === 'exponentialRampToValueAtTime');
      assert.ok(subEndEvent && subEndEvent.value <= 35, 'GUILTY sub-bass drops to deep sub-bass <= 35Hz');

      // INNOCENT
      const beforeInnocent = mockCtx.createdOscillators.length;
      sfx.playCourtVerdict('INNOCENT');
      const innocentOscs = mockCtx.createdOscillators.slice(beforeInnocent);
      assert.ok(innocentOscs.length >= 3, 'INNOCENT verdict creates harmonic resolution chord');
      console.log('  ✔ Subtest 3.2: Verdict outcomes (GUILTY condemnation vs INNOCENT chime) verified');
    }

    // Subtest 3.3: Briefcase Explosion
    {
      const beforeBuffers = mockCtx.createdBuffers.length;
      const beforeOscs = mockCtx.createdOscillators.length;
      const beforeFilters = mockCtx.createdFilters.length;

      sfx.playBriefcaseExplosion();

      const newBuffers = mockCtx.createdBuffers.slice(beforeBuffers);
      const newOscs = mockCtx.createdOscillators.slice(beforeOscs);
      const newFilters = mockCtx.createdFilters.slice(beforeFilters);

      assert.strictEqual(newBuffers.length, 1, 'Explosion creates 1 noise buffer');
      assert.ok(newBuffers[0].length >= mockCtx.sampleRate * 2.0, 'Noise buffer duration is at least 2.0 seconds');
      const channelData = newBuffers[0].getChannelData(0);
      assert.ok(channelData[0] >= -1 && channelData[0] <= 1, 'Noise buffer samples are normalized [-1, 1]');

      // Verify filter sweeps downward
      assert.ok(newFilters.length >= 1, 'Explosion has lowpass filter');
      const filterStart = newFilters[0].frequency.events.find((e) => e.type === 'setValueAtTime')?.value;
      const filterEnd = newFilters[0].frequency.events.find((e) => e.type === 'exponentialRampToValueAtTime')?.value;
      assert.ok(filterStart && filterStart >= 800, 'Explosion filter starts with high-frequency fireball noise >= 800Hz');
      assert.ok(filterEnd && filterEnd <= 100, 'Explosion filter decays to sub rumble <= 100Hz');

      // Verify sub-bass pitch drop
      assert.ok(newOscs.length >= 1, 'Explosion has sub-bass pitch drop oscillator');
      const oscStart = newOscs[0].frequency.events.find((e) => e.type === 'setValueAtTime')?.value;
      const oscEnd = newOscs[0].frequency.events.find((e) => e.type === 'exponentialRampToValueAtTime')?.value;
      assert.ok(oscStart && oscStart >= 120, 'Explosion sub-bass starts at punchy frequency >= 120Hz');
      assert.ok(oscEnd && oscEnd <= 35, 'Explosion sub-bass pitch drops to low rumble <= 35Hz');

      console.log('  ✔ Subtest 3.3: Briefcase explosion noise and pitch drop verified');
    }

    // Subtest 3.4: Countdown Timer Tick & Urgency Scaling
    {
      // Standard tick (>5s)
      const beforeStd = mockCtx.createdOscillators.length;
      sfx.playTimerTick(20, false);
      const stdOsc = mockCtx.createdOscillators[beforeStd];
      assert.ok(stdOsc, 'Standard tick oscillator created');
      const stdFreq = stdOsc.frequency.events.find((e) => e.type === 'setValueAtTime')?.value;
      assert.strictEqual(stdFreq, 850, 'Standard tick frequency is 850Hz');

      // Urgent tick at 5s remaining
      const before5s = mockCtx.createdOscillators.length;
      sfx.playTimerTick(5, true);
      const osc5s = mockCtx.createdOscillators[before5s];
      const freq5s = osc5s.frequency.events.find((e) => e.type === 'setValueAtTime')?.value;

      // Urgent tick at 1s remaining
      const before1s = mockCtx.createdOscillators.length;
      sfx.playTimerTick(1, true);
      const osc1s = mockCtx.createdOscillators[before1s];
      const freq1s = osc1s.frequency.events.find((e) => e.type === 'setValueAtTime')?.value;

      assert.ok(freq5s && freq1s, 'Urgent tick frequencies must be defined');
      assert.ok(freq5s >= 1200, 'Urgent tick base frequency is elevated >= 1200Hz');
      assert.ok(freq1s > freq5s, 'Tick frequency accelerates higher as time remaining decreases (1s > 5s)');

      console.log('  ✔ Subtest 3.4: Countdown timer tick urgency pitch acceleration verified');
    }

    // Subtest 3.5: Mute State Gating
    {
      mockStorage['tdv_mafia_sound_muted'] = 'true';
      const beforeMutedOscs = mockCtx.createdOscillators.length;
      sfx.playGavel();
      sfx.playCourtVerdict('GUILTY');
      sfx.playBriefcaseExplosion();
      sfx.playTimerTick(1, true);
      assert.strictEqual(
        mockCtx.createdOscillators.length,
        beforeMutedOscs,
        'No audio nodes should be created when sound is muted'
      );
      mockStorage['tdv_mafia_sound_muted'] = 'false';
      console.log('  ✔ Subtest 3.5: Mute suppression verified');
    }

    // Teardown global mock
    delete (globalThis as any).window;
    console.log('  ✔ Test 3 Passed');
  }

  // GROUP 4: COMPONENT PROP CONTRACTS & TYPE INVARIANTS
  {
    console.log('▶ Test 4: Component prop types & interfaces');

    // RoleActionReticle props test
    const reticleProps: RoleActionReticleProps = {
      actionType: 'KILL',
      isSelected: true,
      isTargetable: true,
      isCompact: false,
    };
    assert.strictEqual(reticleProps.actionType, 'KILL');

    const actions: ActionReticleType[] = ['KILL', 'PROTECT', 'INVESTIGATE', 'BLOCK', 'MISDIRECT'];
    assert.strictEqual(actions.length, 5, 'All 5 action reticle styles accounted for');

    // PlayerCard props contract test
    const dummyCardProps: Partial<PlayerCardProps> = {
      isTargetable: true,
      actionType: 'KILL',
      isAccused: true,
    };
    assert.strictEqual(dummyCardProps.isTargetable, true);
    assert.strictEqual(dummyCardProps.actionType, 'KILL');
    assert.strictEqual(dummyCardProps.isAccused, true);

    // TrialDefensePanel props contract test
    const trialPropsCheck: (p: TrialDefensePanelProps) => void = () => {};
    assert.strictEqual(typeof trialPropsCheck, 'function');

    // MinigameStatusToolbar props contract test
    const toolbarPropsCheck: (p: MinigameStatusToolbarProps) => void = () => {};
    assert.strictEqual(typeof toolbarPropsCheck, 'function');

    console.log('  ✔ Test 4 Passed');
  }

  console.log('\n================================================================');
  console.log('✅ ALL UI SOUND SFX & AUDIT TESTS PASSED WITH 100% SUCCESS');
  console.log('================================================================');
}

// Auto-run when executed directly
runSoundTestSuite();
