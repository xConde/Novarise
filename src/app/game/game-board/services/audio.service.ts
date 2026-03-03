import { Injectable } from '@angular/core';
import { TowerType } from '../models/tower.model';
import { AUDIO_CONFIG } from '../constants/audio.constants';

@Injectable()
export class AudioService {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _muted = false;
  private _volume = AUDIO_CONFIG.masterVolume;
  private lastEnemyHitTime = -Infinity;

  get isMuted(): boolean {
    return this._muted;
  }

  get volume(): number {
    return this._volume;
  }

  // --- AudioContext lazy init ---

  private getContext(): AudioContext | null {
    if (this.audioContext) return this.audioContext;

    try {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this._muted ? 0 : this._volume;
      this.masterGain.connect(this.audioContext.destination);
    } catch {
      this.audioContext = null;
      this.masterGain = null;
    }

    return this.audioContext;
  }

  // --- Sound primitives ---

  private playTone(
    frequency: number,
    endFrequency: number,
    duration: number,
    oscillatorType: OscillatorType,
    gain = 0.3,
    startDelay = 0
  ): void {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();

      osc.type = oscillatorType;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime + startDelay);
      osc.frequency.exponentialRampToValueAtTime(endFrequency, ctx.currentTime + startDelay + duration);

      envGain.gain.setValueAtTime(gain, ctx.currentTime + startDelay);
      envGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration);

      osc.connect(envGain);
      envGain.connect(this.masterGain);

      osc.start(ctx.currentTime + startDelay);
      osc.stop(ctx.currentTime + startDelay + duration + 0.01);
    } catch {
      // Silently swallow — audio errors should never crash the game
    }
  }

  private playNoise(gain: number, duration: number, startDelay = 0): void {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const envGain = ctx.createGain();
      envGain.gain.setValueAtTime(gain, ctx.currentTime + startDelay);
      envGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration);

      source.connect(envGain);
      envGain.connect(this.masterGain);

      source.start(ctx.currentTime + startDelay);
    } catch {
      // Silently swallow
    }
  }

  private playArpeggio(
    notes: number[],
    noteDuration: number,
    noteGap: number,
    oscillatorType: OscillatorType,
    gain = 0.3
  ): void {
    notes.forEach((freq, i) => {
      const startDelay = i * (noteDuration + noteGap);
      this.playTone(freq, freq, noteDuration, oscillatorType, gain, startDelay);
    });
  }

  // --- Public sound API ---

  playTowerFire(towerType: TowerType): void {
    const cfg = AUDIO_CONFIG.towerFire[towerType];
    if (!cfg) return;
    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, 0.2);
  }

  playEnemyHit(): void {
    const now = Date.now();
    if (now - this.lastEnemyHitTime < AUDIO_CONFIG.enemyHit.throttleMs) return;
    this.lastEnemyHitTime = now;

    const cfg = AUDIO_CONFIG.enemyHit;
    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, 0.15);
  }

  playEnemyDeath(): void {
    const cfg = AUDIO_CONFIG.enemyDeath;
    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, 0.25);
    this.playNoise(cfg.noiseGain, cfg.noiseDuration);
  }

  playWaveStart(): void {
    const cfg = AUDIO_CONFIG.waveStart;
    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, 0.3);
  }

  playWaveClear(): void {
    const cfg = AUDIO_CONFIG.waveClear;
    this.playArpeggio(cfg.notes, cfg.noteDuration, cfg.noteGap, cfg.oscillatorType, 0.3);
  }

  playGoldEarned(): void {
    const cfg = AUDIO_CONFIG.goldEarned;
    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, 0.2);
  }

  playTowerPlace(): void {
    const cfg = AUDIO_CONFIG.towerPlace;
    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, cfg.gain);
  }

  playTowerUpgrade(): void {
    const cfg = AUDIO_CONFIG.towerUpgrade;
    this.playArpeggio(cfg.notes, cfg.noteDuration, cfg.noteGap, cfg.oscillatorType, 0.3);
  }

  playTowerSell(): void {
    const cfg = AUDIO_CONFIG.towerSell;
    this.playArpeggio(cfg.notes, cfg.noteDuration, cfg.noteGap, cfg.oscillatorType, 0.3);
  }

  playDefeat(): void {
    const cfg = AUDIO_CONFIG.defeat;
    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, cfg.gain);
  }

  playVictory(): void {
    const cfg = AUDIO_CONFIG.victory;
    this.playArpeggio(cfg.notes, cfg.noteDuration, cfg.noteGap, cfg.oscillatorType, 0.35);
  }

  // --- Volume / mute ---

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && !this._muted) {
      this.masterGain.gain.value = this._volume;
    }
  }

  toggleMute(): void {
    this._muted = !this._muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this._muted ? 0 : this._volume;
    }
  }

  // --- Lifecycle ---

  cleanup(): void {
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
      this.masterGain = null;
    }
  }
}
