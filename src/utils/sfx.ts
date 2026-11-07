/**
 * TDV BTL MAFIA - Cinematic & Realistic Audio SFX Engine
 * Soft, muted ("boğuq, tok"), non-fatiguing sound effects with 35% Master Volume.
 * Uses high-fidelity acoustic audio with resilient Web Audio API zero-latency fallback.
 */

const STORAGE_KEY = 'tdv_mafia_sound_muted';
const SOUND_EVENT_KEY = 'tdv_mafia_sound_change';

/** Standardized comfortable Master Volume (35%) */
export const MASTER_VOLUME = 0.35;

let audioCtx: AudioContext | null = null;
const audioCache: Record<string, HTMLAudioElement> = {};

/** Get or initialize AudioContext safely */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if ((window as any).__audioCtxInstance) {
      return (window as any).__audioCtxInstance;
    }
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioCtxClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** Reset cached AudioContext instance (for test suites) */
export function resetAudioContextForTesting(): void {
  audioCtx = null;
}

/** Check if global sound is currently muted */
export function isSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage?.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Set sound mute state */
export function setSoundMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(STORAGE_KEY, muted ? 'true' : 'false');
    window.dispatchEvent?.(new CustomEvent(SOUND_EVENT_KEY, { detail: { muted } }));
  } catch {
    // Ignore
  }
}

/** Toggle mute state and return the new muted status */
export function toggleSound(): boolean {
  const next = !isSoundMuted();
  setSoundMuted(next);
  return next;
}

/** Subscribe to sound mute changes */
export function subscribeSound(callback: (muted: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const custom = event as CustomEvent<{ muted: boolean }>;
    callback(custom.detail?.muted ?? isSoundMuted());
  };
  window.addEventListener(SOUND_EVENT_KEY, handler);
  return () => {
    window.removeEventListener(SOUND_EVENT_KEY, handler);
  };
}

/**
 * Safely plays a realistic audio sound from /sounds directory with Master Volume.
 * Returns true if played successfully, or false to trigger the Web Audio fallback.
 */
function playAudioFile(soundPath: string, volumeScale: number = 1.0): boolean {
  if (typeof window === 'undefined') return false;
  try {
    let audio = audioCache[soundPath];
    if (!audio) {
      audio = new Audio(soundPath);
      audio.preload = 'auto';
      audioCache[soundPath] = audio;
    }

    audio.volume = Math.max(0, Math.min(1, MASTER_VOLUME * volumeScale));
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback silently if autoplay policy blocked or not loaded yet
      });
    }
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GECƏ FAZASI (playNight)
// Dərin, alçaq tezlikli duman bası və uzaqdan gələn sirli qədim saat zəngi.
// ─────────────────────────────────────────────────────────────────────────────
export function playNight(): void {
  if (isSoundMuted()) return;

  try {
    const played = playAudioFile('/sounds/night.wav', 1.0);
    if (played) return;
  } catch {
    // Continue to resilient fallback
  }

  // Resilient Web Audio Fallback: Warm sub-bass fog drone (no buzz)
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(MASTER_VOLUME * 0.7, now);
    masterGain.connect(ctx.destination);

    // Deep sub sine (52Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    const subFilter = ctx.createBiquadFilter();

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(52, now);

    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(140, now);

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.4, now + 0.4);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(masterGain);

    subOsc.start(now);
    subOsc.stop(now + 2.6);

    // Distant warm clock chime (130.8Hz C3)
    const chimeOsc = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    const chimeFilter = ctx.createBiquadFilter();

    chimeOsc.type = 'triangle';
    chimeOsc.frequency.setValueAtTime(130.8, now + 0.2);

    chimeFilter.type = 'lowpass';
    chimeFilter.frequency.setValueAtTime(320, now);

    chimeGain.gain.setValueAtTime(0.001, now + 0.2);
    chimeGain.gain.linearRampToValueAtTime(0.25, now + 0.23);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

    chimeOsc.connect(chimeFilter);
    chimeFilter.connect(chimeGain);
    chimeGain.connect(masterGain);

    chimeOsc.start(now + 0.2);
    chimeOsc.stop(now + 2.3);
  } catch {
    // Never crash
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SƏHƏR FAZASI (playDay)
// Yumşaq səhər kilsə/şəhər zəngi zərbəsi və yüngül qəzet xışıltısı.
// ─────────────────────────────────────────────────────────────────────────────
export function playDay(): void {
  if (isSoundMuted()) return;

  try {
    const played = playAudioFile('/sounds/day.wav', 1.0);
    if (played) return;
  } catch {
    // Continue to resilient fallback
  }

  // Resilient Web Audio Fallback: Mellow warm bell chord
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(MASTER_VOLUME * 0.65, now);
    masterGain.connect(ctx.destination);

    const notes = [329.6, 440.0]; // Warm E4 & A4
    notes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, noteTime);

      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.2, noteTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 1.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      osc.start(noteTime);
      osc.stop(noteTime + 1.9);
    });
  } catch {
    // Never crash
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MƏHKƏMƏ HÖKMÜ VƏ ÇƏKİC (playGavel / playCourtVerdict)
// Dərin ikiqat taxta məhkəmə çəkici və hökm növünə uyğun rezonans.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enhanced Courtroom Gavel: Deep wooden thud with secondary reverberation / echo reflections.
 * Optional pan parameter (-1.0 to +1.0) spatializes the gavel sound.
 */
export function playGavel(pan: number = 0.0): void {
  if (isSoundMuted()) return;

  if (pan === 0.0) {
    try {
      const played = playAudioFile('/sounds/gavel.wav', 1.0);
      if (played) return;
    } catch {
      // Continue to resilient fallback
    }
  }

  // Resilient Web Audio Fallback: Dual wooden strikes with room reverberation
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(MASTER_VOLUME * 0.85, now);

    if (pan !== undefined && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1.0, Math.min(1.0, pan)), now);
      masterGain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      masterGain.connect(ctx.destination);
    }

    // Primary strike, secondary strike, and 2 room reverberation reflections
    const strikes: Array<{ delay: number; freq: number; gain: number; duration: number }> = [
      { delay: 0.01, freq: 160, gain: 0.60, duration: 0.08 },
      { delay: 0.13, freq: 140, gain: 0.75, duration: 0.10 },
      { delay: 0.25, freq: 110, gain: 0.20, duration: 0.14 }, // Reverb reflection 1
      { delay: 0.38, freq: 90,  gain: 0.08, duration: 0.18 }, // Reverb reflection 2
    ];

    strikes.forEach((st) => {
      const strikeTime = now + st.delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(st.freq, strikeTime);
      osc.frequency.exponentialRampToValueAtTime(45, strikeTime + st.duration * 0.8);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, strikeTime);

      gain.gain.setValueAtTime(st.gain, strikeTime);
      gain.gain.exponentialRampToValueAtTime(0.001, strikeTime + st.duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      osc.start(strikeTime);
      osc.stop(strikeTime + st.duration + 0.01);
    });
  } catch {
    // Never crash
  }
}

/**
 * Play courtroom verdict sound based on GUILTY (conviction) vs INNOCENT (acquittal).
 */
export function playCourtVerdict(verdict: 'GUILTY' | 'INNOCENT'): void {
  if (isSoundMuted()) return;

  if (verdict === 'GUILTY') {
    // GUILTY: Authoritative heavy gavel strikes + deep sub-bass condemnation drop (55Hz -> 28Hz)
    playGavel();

    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      const subFilter = ctx.createBiquadFilter();

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(55, now + 0.14);
      subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.9);

      subFilter.type = 'lowpass';
      subFilter.frequency.setValueAtTime(110, now);

      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.7, now + 0.18);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      subOsc.connect(subFilter);
      subFilter.connect(subGain);
      subGain.connect(ctx.destination);

      subOsc.start(now + 0.14);
      subOsc.stop(now + 1.3);
    } catch {
      // Never crash
    }
  } else {
    // INNOCENT: Single light gavel tap + warm exoneration resolution chime (C5, E5, G5)
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(MASTER_VOLUME * 0.65, now);
      masterGain.connect(ctx.destination);

      // Light gavel tap
      const tapOsc = ctx.createOscillator();
      const tapGain = ctx.createGain();
      tapOsc.type = 'sine';
      tapOsc.frequency.setValueAtTime(220, now);
      tapOsc.frequency.exponentialRampToValueAtTime(90, now + 0.06);
      tapGain.gain.setValueAtTime(0.4, now);
      tapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      tapOsc.connect(tapGain);
      tapGain.connect(masterGain);
      tapOsc.start(now);
      tapOsc.stop(now + 0.08);

      // Exoneration resolution chord (C5 523.25Hz, E5 659.25Hz, G5 783.99Hz)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const noteTime = now + 0.08 + idx * 0.04;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, noteTime);

        gain.gain.setValueAtTime(0.001, noteTime);
        gain.gain.linearRampToValueAtTime(0.2, noteTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 1.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc.start(noteTime);
        osc.stop(noteTime + 1.3);
      });
    } catch {
      // Never crash
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. KART VƏ YA DÜYMƏ KLİKLƏNMƏSİ (playCard)
// Rahatsız etməyən, çox zərif "mat klik" (soft tactile micro-click) toxunuşu.
// ─────────────────────────────────────────────────────────────────────────────
export function playCard(pan?: number): void {
  if (isSoundMuted()) return;

  if (pan === undefined) {
    try {
      const played = playAudioFile('/sounds/card.wav', 0.85);
      if (played) return;
    } catch {
      // Continue to resilient fallback
    }
  }

  // Resilient Web Audio Fallback: Ultra-soft tactile micro-click
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(MASTER_VOLUME * 0.45, now);

    if (pan !== undefined && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1.0, Math.min(1.0, pan)), now);
      masterGain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      masterGain.connect(ctx.destination);
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.025);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, now);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.035);
  } catch {
    // Never crash
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. EDAM / QƏTL (playElimination)
// Dərin, boğuq kinematoqrafik sub-thud zərbəsi.
// ─────────────────────────────────────────────────────────────────────────────
export function playElimination(pan?: number): void {
  if (isSoundMuted()) return;

  if (pan === undefined) {
    try {
      const played = playAudioFile('/sounds/elimination.wav', 1.0);
      if (played) return;
    } catch {
      // Continue to resilient fallback
    }
  }

  // Resilient Web Audio Fallback: Muted cinematic sub-impact
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(MASTER_VOLUME * 0.75, now);

    if (pan !== undefined && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1.0, Math.min(1.0, pan)), now);
      masterGain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      masterGain.connect(ctx.destination);
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(50, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.5);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, now);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 1.3);
  } catch {
    // Never crash
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. BRIEFCASE DETONATION / DOOMSDAY EXPLOSION (playBriefcaseExplosion)
// White/pink noise burst + dynamic lowpass filter sweep + sub-bass pitch drop.
// ─────────────────────────────────────────────────────────────────────────────

export function playBriefcaseExplosion(): void {
  if (isSoundMuted()) return;

  try {
    const played = playAudioFile('/sounds/explosion.wav', 1.0);
    if (played) return;
  } catch {
    // Continue to resilient fallback
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(MASTER_VOLUME * 0.9, now);
    masterGain.connect(ctx.destination);

    // 1. Noise burst (detonation transient and fireball rumble)
    const duration = 2.2;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(900, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(50, now + duration * 0.8);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    whiteNoise.start(now);
    whiteNoise.stop(now + duration + 0.05);

    // 2. Low-frequency pitch drop sub-bass rumble (140Hz -> 28Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    const subFilter = ctx.createBiquadFilter();

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 1.2);

    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(120, now);

    subGain.gain.setValueAtTime(0.75, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(masterGain);

    subOsc.start(now);
    subOsc.stop(now + 1.9);
  } catch {
    // Never crash
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. COUNTDOWN TIMER TICK (playTimerTick / playTick)
// Crisp click / high-frequency blip, with accelerating pitch rise during last 5s.
// ─────────────────────────────────────────────────────────────────────────────

export function playTimerTick(secondsRemaining?: number, isUrgent?: boolean): void {
  if (isSoundMuted()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const isUnder5 = secondsRemaining !== undefined && secondsRemaining <= 5 && secondsRemaining > 0;
    const urgent = isUrgent ?? isUnder5;

    if (urgent) {
      // Urgent tick: higher pitch scaling upwards as seconds deplete (1200Hz - 1800Hz)
      const pitchOffset = secondsRemaining !== undefined ? Math.max(0, 5 - secondsRemaining) * 150 : 300;
      const startFreq = 1200 + pitchOffset;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 0.5, now + 0.04);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now);

      gain.gain.setValueAtTime(MASTER_VOLUME * 0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } else {
      // Normal tick: subtle, tactile mechanical click (850Hz -> 350Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(850, now);
      osc.frequency.exponentialRampToValueAtTime(350, now + 0.03);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);

      gain.gain.setValueAtTime(MASTER_VOLUME * 0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    }
  } catch {
    // Never crash
  }
}

/**
 * Standard tick backwards compatibility wrapper.
 */
export function playTick(): void {
  playTimerTick();
}

/**
 * Initializes one-time gesture listeners to unlock AudioContext in strict browsers.
 */
export function initAudioUnlock(): void {
  if (typeof window === 'undefined') return;

  const unlock = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {}
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };

  window.addEventListener('click', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
}



// ─────────────────────────────────────────────────────────────────────────────
// CHAT MESSAGE PING
// ─────────────────────────────────────────────────────────────────────────────
export function playMessagePing(): void {
  if (isSoundMuted()) return;
  try {
    const played = playAudioFile('/sounds/chat_ping.wav', 0.5);
    if (played) return;
  } catch {}

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.start(now);
    osc.stop(now + 0.15);
  } catch {
    // Ignore
  }
}


// ─── AMBIENT AUDIO ENGINE ─────────────────────────────────────────────────────

let currentAmbientOsc: OscillatorNode | null = null;
let currentAmbientNoise: AudioBufferSourceNode | null = null;
let currentAmbientGain: GainNode | null = null;
let currentAmbientType: 'LOBBY' | 'DAY' | 'NIGHT' | 'ENDED' | null = null;

export function stopAmbient(): void {
  if (currentAmbientGain) {
    // Fade out over 2 seconds
    const ctx = getAudioContext();
    if (ctx) {
      currentAmbientGain.gain.cancelScheduledValues(ctx.currentTime);
      currentAmbientGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
      
      const oldGain = currentAmbientGain;
      const oldOsc = currentAmbientOsc;
      const oldNoise = currentAmbientNoise;
      
      setTimeout(() => {
        try { oldOsc?.stop(); } catch(e){}
        try { oldNoise?.stop(); } catch(e){}
        try { oldGain?.disconnect(); } catch(e){}
      }, 2100);
    }
  }
  currentAmbientOsc = null;
  currentAmbientNoise = null;
  currentAmbientGain = null;
  currentAmbientType = null;
}

export function startAmbient(type: 'LOBBY' | 'DAY' | 'NIGHT' | 'ENDED'): void {
  if (isSoundMuted()) {
    stopAmbient();
    return;
  }
  if (currentAmbientType === type) return; // Already playing this ambient
  
  stopAmbient(); // Stop previous
  currentAmbientType = type;

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const mainGain = ctx.createGain();
  mainGain.gain.setValueAtTime(0.001, now);
  mainGain.connect(ctx.destination);
  currentAmbientGain = mainGain;

  if (type === 'NIGHT') {
    // NIGHT AMBIENCE: Deep sub drone (ominous) + subtle wind
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(45, now); // Low rumble

    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(100, now);

    const subGain = ctx.createGain();
    subGain.gain.value = 0.6 * MASTER_VOLUME;

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(mainGain);
    subOsc.start(now);
    currentAmbientOsc = subOsc;

    // Wind (Noise)
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(400, now); // Muffled wind
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.05 * MASTER_VOLUME; // Very quiet
    
    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(mainGain);
    whiteNoise.start(now);
    currentAmbientNoise = whiteNoise;

    // Fade in over 3 seconds
    mainGain.gain.exponentialRampToValueAtTime(1.0, now + 3);

  } else if (type === 'DAY') {
    // DAY AMBIENCE: Warm, slightly detuned pads (anxious but light)
    const padOsc = ctx.createOscillator();
    padOsc.type = 'triangle';
    padOsc.frequency.setValueAtTime(130.81, now); // C3

    const padOsc2 = ctx.createOscillator();
    padOsc2.type = 'sine';
    padOsc2.frequency.setValueAtTime(132, now); // Slightly detuned

    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(300, now);

    const padGain = ctx.createGain();
    padGain.gain.value = 0.15 * MASTER_VOLUME;

    padOsc.connect(padFilter);
    padOsc2.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(mainGain);
    
    padOsc.start(now);
    padOsc2.start(now);
    currentAmbientOsc = padOsc;

    // Fade in over 3 seconds
    mainGain.gain.exponentialRampToValueAtTime(1.0, now + 3);
  } else if (type === 'LOBBY' || type === 'ENDED') {
    // Silence for now
    stopAmbient();
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// 14. UI/UX MICRO-INTERACTION SOUNDS & HAPTICS (M14)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 12ms acoustic micro-click bandpass filtered at 1200 Hz for button hover / focus.
 */
export function playMicroClick(): void {
  if (isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.setValueAtTime(3.0, now);

    gain.gain.setValueAtTime(0.08 * MASTER_VOLUME, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.015);
  } catch {
    // Silently ignore
  }
}

/**
 * Submarine Sonar Ping: 220 Hz pure sine wave with high Q factor and 3.2-second natural reverberation decay.
 */
export function playBermudaSonar(pan: number = 0.0): void {
  if (isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(220, now);
    filter.Q.setValueAtTime(8.0, now);

    gain.gain.setValueAtTime(0.5 * MASTER_VOLUME, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

    osc.connect(filter);
    filter.connect(gain);

    if (pan !== 0.0 && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1.0, Math.min(1.0, pan)), now);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      gain.connect(ctx.destination);
    }

    osc.start(now);
    osc.stop(now + 3.25);
  } catch {
    // Silently ignore
  }
}

/**
 * Cyberpunk Digital Chirp: High-frequency digital chirp and relay snap (1800 Hz -> 2400 Hz linear chirp over 80ms).
 */
export function playCyberChirp(): void {
  if (isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.linearRampToValueAtTime(2400, now + 0.08);

    gain.gain.setValueAtTime(0.25 * MASTER_VOLUME, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.085);
  } catch {
    // Silently ignore
  }
}

/**
 * Safe haptic vibration wrapper for mobile touch devices.
 */
export function triggerHaptic(type: 'click' | 'accused' | 'victory'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    if (type === 'click') {
      navigator.vibrate(15);
    } else if (type === 'accused') {
      navigator.vibrate([40, 60, 40]);
    } else if (type === 'victory') {
      navigator.vibrate([30, 50, 30, 50, 60]);
    }
  } catch {
    // Silently ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. PROCEDURAL TENSION HEARTBEAT PULSE (playHeartbeatTension)
// Sub-bass dual cardiac pulse ("lub-dub", 50Hz) with dynamic tempo scaling.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Procedural Tension Heartbeat Pulse (Web Audio API)
 * Generates an anatomical dual-pulse ("lub-dub") sub-bass thump (50Hz) simulating rising cardiac tension.
 * Pulse interval and tempo scale dynamically with bpm (clamped between 40 and 180).
 * Non-blocking: oscillators and gain nodes auto-terminate and disconnect cleanly within 0.35s.
 */
export function playHeartbeatTension(bpm: number = 75): void {
  if (typeof window === 'undefined' || isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const clampedBpm = Math.max(40, Math.min(180, bpm));
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(MASTER_VOLUME * 0.7, now);
    masterGain.connect(ctx.destination);

    // Pulse 1: "Lub" - Deeper, foundational sub-bass thump (52Hz -> 36Hz)
    const s1Osc = ctx.createOscillator();
    const s1Gain = ctx.createGain();
    const s1Filter = ctx.createBiquadFilter();

    s1Osc.type = 'sine';
    s1Osc.frequency.setValueAtTime(52, now);
    s1Osc.frequency.exponentialRampToValueAtTime(36, now + 0.11);

    s1Filter.type = 'lowpass';
    s1Filter.frequency.setValueAtTime(110, now);

    s1Gain.gain.setValueAtTime(0.001, now);
    s1Gain.gain.linearRampToValueAtTime(0.55, now + 0.015);
    s1Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    s1Osc.connect(s1Filter);
    s1Filter.connect(s1Gain);
    s1Gain.connect(masterGain);

    s1Osc.start(now);
    s1Osc.stop(now + 0.13);

    // Pulse 2: "Dub" - Slightly higher transient thump (64Hz -> 42Hz) spaced proportionally
    const s2Delay = Math.min(0.18, (60 / clampedBpm) * 0.35);
    const s2Time = now + s2Delay;

    const s2Osc = ctx.createOscillator();
    const s2Gain = ctx.createGain();
    const s2Filter = ctx.createBiquadFilter();

    s2Osc.type = 'sine';
    s2Osc.frequency.setValueAtTime(64, s2Time);
    s2Osc.frequency.exponentialRampToValueAtTime(42, s2Time + 0.09);

    s2Filter.type = 'lowpass';
    s2Filter.frequency.setValueAtTime(125, s2Time);

    s2Gain.gain.setValueAtTime(0.001, s2Time);
    s2Gain.gain.linearRampToValueAtTime(0.45, s2Time + 0.012);
    s2Gain.gain.exponentialRampToValueAtTime(0.001, s2Time + 0.10);

    s2Osc.connect(s2Filter);
    s2Filter.connect(s2Gain);
    s2Gain.connect(masterGain);

    s2Osc.start(s2Time);
    s2Osc.stop(s2Time + 0.11);
  } catch {
    // Non-fatal fallback
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 16. STOCHASTIC GEIGER COUNTER CLICK (playGeigerClick)
// Bandpass-filtered electrical micro-discharge click for Chernobyl radiation hazards.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stochastic Geiger Counter Discharge Click (Web Audio API)
 * Simulates ionizing radiation gas discharge in a Geiger-Müller tube with sharp bandpass filtering (1500Hz-3000Hz).
 * Jittered center frequency and amplitude variation provide realistic stochastic radiation hazard feedback.
 */
export function playGeigerClick(): void {
  if (typeof window === 'undefined' || isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Stochastic pitch jitter around 2200-2600Hz
    const centerFreq = 2200 + (Math.random() - 0.5) * 600;

    osc.type = 'square';
    osc.frequency.setValueAtTime(centerFreq, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerFreq, now);
    if ('Q' in filter && filter.Q && typeof filter.Q.setValueAtTime === 'function') {
      filter.Q.setValueAtTime(6.0, now);
    }

    const clickVolume = (0.14 + Math.random() * 0.06) * MASTER_VOLUME;
    gain.gain.setValueAtTime(clickVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.006);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.008);
  } catch {
    // Silently ignore
  }
}

let geigerTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Stochastic Geiger Loop Coordinator
 * Automatically adjusts click cadence based on radiation intensity.
 */
export function setGeigerIntensity(mSv: number): void {
  if (geigerTimer) {
    clearTimeout(geigerTimer);
    geigerTimer = null;
  }
  if (mSv < 30 || isSoundMuted() || typeof window === 'undefined') return;

  // Interval scales inversely with dosage:
  // 30-50 mSv: 300-800ms random intervals
  // 50-80 mSv: 80-250ms random intervals
  // >80 mSv: 20-70ms frantic chatter
  const minInterval = mSv >= 80 ? 20 : mSv >= 50 ? 80 : 300;
  const maxInterval = mSv >= 80 ? 70 : mSv >= 50 ? 250 : 800;

  const scheduleNext = () => {
    playGeigerClick();
    const delay = Math.random() * (maxInterval - minInterval) + minInterval;
    geigerTimer = setTimeout(scheduleNext, delay);
  };
  scheduleNext();
}

/**
 * Halts any active Geiger click scheduling loop.
 */
export function stopGeiger(): void {
  if (geigerTimer) {
    clearTimeout(geigerTimer);
    geigerTimer = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 17. MAYORAL ROYAL BRASS FANFARE (playMayoralFanfare)
// Royal herald trumpet progression (D4, F#4, A4, D5) for 3x Mayor Proclamation.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mayoral Royal Proclamation Brass Fanfare (Web Audio API)
 * Royal brass chord progression (D4, F#4, A4, D5) celebrating the Mayor's 3x voting weight reveal.
 * Emulates trumpet horn acoustics with lowpass brass filter sweep and authoritative decay.
 */
export function playMayoralFanfare(pan: number = 0.0): void {
  if (typeof window === 'undefined' || isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(MASTER_VOLUME * 0.85, now);

    if (pan !== 0.0 && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1.0, Math.min(1.0, pan)), now);
      masterGain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      masterGain.connect(ctx.destination);
    }

    // Herald Trumpet Fanfare Progression: D4 -> F#4 -> A4 -> Majestic D-Major Climax
    const notes: Array<{ delay: number; freq: number; gain: number; duration: number }> = [
      { delay: 0.00, freq: 293.66, gain: 0.40, duration: 0.14 }, // D4
      { delay: 0.12, freq: 369.99, gain: 0.45, duration: 0.14 }, // F#4
      { delay: 0.24, freq: 440.00, gain: 0.50, duration: 0.18 }, // A4
      // Final Royal Resolution Chord (D4, A4, D5)
      { delay: 0.40, freq: 293.66, gain: 0.35, duration: 1.40 }, // D4 body
      { delay: 0.40, freq: 440.00, gain: 0.40, duration: 1.40 }, // A4 fifth
      { delay: 0.40, freq: 587.33, gain: 0.50, duration: 1.60 }, // D5 crown
    ];

    notes.forEach((nt) => {
      const noteTime = now + nt.delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Sawtooth wave for brassy trumpet timbre
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(nt.freq, noteTime);

      // Brass acoustic envelope: bright initial flare sweeping to warm resonance
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, noteTime);
      filter.frequency.exponentialRampToValueAtTime(550, noteTime + nt.duration * 0.7);

      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(nt.gain, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + nt.duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      osc.start(noteTime);
      osc.stop(noteTime + nt.duration + 0.02);
    });
  } catch {
    // Non-fatal fallback
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 18. TRAGIC MOURNING CHURCH BELL (playMourningBell)
// Heavy bronze cathedral bell with sorrowful minor third (F3) for innocent lynches.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tragic Mourning Church Bell (Web Audio API)
 * Low tubular bronze church bell strike with sorrowful minor third (F3) and 3.8s harmonic reverberation decay.
 * Triggered upon the wrongful execution of an innocent townsperson ("Şəhər Səhv Etdi").
 */
export function playMourningBell(pan: number = 0.0): void {
  if (typeof window === 'undefined' || isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(MASTER_VOLUME * 0.80, now);

    if (pan !== 0.0 && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1.0, Math.min(1.0, pan)), now);
      masterGain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      masterGain.connect(ctx.destination);
    }

    // Heavy iron clapper strike transient (480Hz -> 120Hz over 35ms)
    const clapper = ctx.createOscillator();
    const clapperGain = ctx.createGain();
    clapper.type = 'triangle';
    clapper.frequency.setValueAtTime(480, now);
    clapper.frequency.exponentialRampToValueAtTime(120, now + 0.035);
    clapperGain.gain.setValueAtTime(0.35, now);
    clapperGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    clapper.connect(clapperGain);
    clapperGain.connect(masterGain);
    clapper.start(now);
    clapper.stop(now + 0.045);

    // Bronze Church Bell Partials (D-Minor sorrow chime: Hum, Prime, Minor 3rd, 5th, Octave)
    const partials = [
      { freq: 73.42,  gain: 0.45, decay: 3.8 }, // D2 Hum Tone (deep bronze vibration)
      { freq: 146.83, gain: 0.35, decay: 3.2 }, // D3 Prime (strike tone fundamental)
      { freq: 174.61, gain: 0.30, decay: 2.8 }, // F3 Tierce / Minor 3rd (tragic sorrow color)
      { freq: 220.00, gain: 0.20, decay: 2.4 }, // A3 Quint / Fifth
      { freq: 293.66, gain: 0.15, decay: 1.8 }, // D4 Nominal / Octave
    ];

    partials.forEach((p, idx) => {
      const strikeTime = now + idx * 0.008;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(p.freq, strikeTime);

      // Lowpass warmth filter preserving rich bronze resonance while rolling off harsh harmonics
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(380, strikeTime);

      gain.gain.setValueAtTime(p.gain, strikeTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, strikeTime + p.decay);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      osc.start(strikeTime);
      osc.stop(strikeTime + p.decay + 0.05);
    });
  } catch {
    // Non-fatal fallback
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 19. ARMOR SHATTER & COMBAT CLASH (playArmorShatter)
// High metallic impact ping + highpass noise burst for Iron Will & Bodyguard clashes.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metallic Armor Shatter Sound Effect (Web Audio API)
 * High metallic impact ping (1800Hz -> 320Hz) combined with high-pass filtered noise burst.
 * Triggered when a player's IRON_WILL charge shatters or during bodyguard combat clashes.
 */
export function playArmorShatter(): void {
  if (typeof window === 'undefined' || isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(MASTER_VOLUME * 0.75, now);
    masterGain.connect(ctx.destination);

    // 1. High metallic impact ping
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.25);
    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.32);

    // 2. High-pass noise burst (glass/crystal fracture)
    const bufSize = Math.floor(ctx.sampleRate * 0.35);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3200, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.45, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGain);

    noise.start(now);
    noise.stop(now + 0.38);
  } catch {
    // Non-fatal fallback
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 20. PROCEDURAL EMERALD GUARDIAN SHIELD (playGuardianShield)
// Luminous celestial harmonic chord (C5, G5, C6) for Doctor saves.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Procedural Emerald Guardian Shield Chime (Web Audio API)
 * Luminous celestial harmonic chord (C5 523Hz + G5 784Hz + C6 1046Hz) with smooth lowpass envelope.
 * Triggered when a Doctor successfully protects a target from assassination.
 */
export function playGuardianShield(): void {
  if (typeof window === 'undefined' || isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(MASTER_VOLUME * 0.75, now);
    master.connect(ctx.destination);

    [523.25, 783.99, 1046.50].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.03);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.frequency.exponentialRampToValueAtTime(600, now + 1.2);

      gain.gain.setValueAtTime(0.001, now + idx * 0.03);
      gain.gain.linearRampToValueAtTime(0.3 / (idx + 1), now + idx * 0.03 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      osc.start(now + idx * 0.03);
      osc.stop(now + 1.85);
    });
  } catch {
    // Silently ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 21. PROCEDURAL BLADE CLASH (playBladeClash)
// Sharp metallic blade ping + highpass friction noise for Bodyguard clashes.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Procedural Armed Duel / Blade Clash Transient (Web Audio API)
 * High-frequency metallic blade ping (2400Hz -> 550Hz) + highpass friction grind burst + resonant body thud.
 * Triggered during Bodyguard sacrifice or counter-attack duels.
 */
export function playBladeClash(): void {
  if (typeof window === 'undefined' || isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 1. Sharp Metallic Ping (High Q Bandpass Oscillator)
    const pingOsc = ctx.createOscillator();
    const pingGain = ctx.createGain();
    const pingFilter = ctx.createBiquadFilter();

    pingOsc.type = 'triangle';
    pingOsc.frequency.setValueAtTime(2400, now);
    pingOsc.frequency.exponentialRampToValueAtTime(550, now + 0.18);

    pingFilter.type = 'bandpass';
    pingFilter.frequency.setValueAtTime(2400, now);
    if ('Q' in pingFilter && pingFilter.Q && typeof pingFilter.Q.setValueAtTime === 'function') {
      pingFilter.Q.setValueAtTime(10.0, now);
    }

    pingGain.gain.setValueAtTime(MASTER_VOLUME * 0.85, now);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    pingOsc.connect(pingFilter);
    pingFilter.connect(pingGain);
    pingGain.connect(ctx.destination);
    pingOsc.start(now);
    pingOsc.stop(now + 0.38);

    // 2. High-Pass Steel Friction Noise Transient
    const bufSize = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(3500, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(MASTER_VOLUME * 0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.14);
  } catch {
    // Silently ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 22. PROCEDURAL CYBER NET-GLITCH (playCyberGlitch)
// Frequency-modulated sawtooth wave with 45Hz LFO flutter for Cyber-Overdrive.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Procedural Cyber Net-Glitch Interference Chirp (Web Audio API)
 * Frequency-modulated sawtooth wave (850Hz -> 180Hz) modulated with a 45Hz LFO flutter.
 * Triggered during Cyberpunk Neo-Baku Cyber-Overdrive or Net-Glitch events.
 */
export function playCyberGlitch(): void {
  if (typeof window === 'undefined' || isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const modOsc = ctx.createOscillator();
    const modGain = ctx.createGain();
    const mainGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(850, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.16);

    // High-speed frequency jitter modulation
    modOsc.type = 'square';
    modOsc.frequency.setValueAtTime(45, now);
    modGain.gain.setValueAtTime(140, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    if ('Q' in filter && filter.Q && typeof filter.Q.setValueAtTime === 'function') {
      filter.Q.setValueAtTime(4.0, now);
    }

    mainGain.gain.setValueAtTime(MASTER_VOLUME * 0.45, now);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    modOsc.connect(modGain);
    modGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(mainGain);
    mainGain.connect(ctx.destination);

    modOsc.start(now);
    osc.start(now);
    modOsc.stop(now + 0.19);
    osc.stop(now + 0.19);
  } catch {
    // Silently ignore
  }
}
