/**
 * Synthesized Cyberpunk Audio Engine (Web Audio API)
 * Requires no external assets.
 */

class CyberpunkAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  public init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
  }

  public toggleMute(muted: boolean) {
    this.isMuted = muted;
  }

  private playTone(freq: number, type: OscillatorType, duration: number, vol: number) {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      gainNode.gain.setValueAtTime(vol, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  // Soft digital click for hovering buttons
  public playHover() {
    this.playTone(800, 'sine', 0.05, 0.05);
  }

  // Sharp mechanical click for active button press
  public playClick() {
    this.playTone(1200, 'square', 0.1, 0.08);
  }

  // Deep bass drop for Night Phase
  public playNightTransition() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 1.5); // Deep bass dive
      
      gainNode.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.5);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 1.5);
    } catch (e) {}
  }

  // Bright chime for Day Phase
  public playDayTransition() {
    if (this.isMuted || !this.ctx) return;
    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, this.ctx.currentTime); // E5
      
      gainNode.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2.0);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(this.ctx.currentTime + 2.0);
      osc2.stop(this.ctx.currentTime + 2.0);
    } catch (e) {}
  }

  // Ominous notification sound (like voting)
  public playVoteAlert() {
    this.playTone(300, 'triangle', 0.3, 0.15);
    setTimeout(() => this.playTone(250, 'triangle', 0.4, 0.2), 100);
  }
}

export const audioEngine = new CyberpunkAudioEngine();
