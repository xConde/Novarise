import { Injectable } from '@angular/core';
import { TowerType } from '../models/tower.model';
import {
  AUDIO_CONFIG,
  SFX_CONFIGS,
  isSfxSequenceConfig,
  SFX_LIMITER_THRESHOLD_DB,
  SFX_LIMITER_KNEE_DB,
  SFX_LIMITER_RATIO,
  SFX_LIMITER_ATTACK_SECONDS,
  SFX_LIMITER_RELEASE_SECONDS,
  SFX_ATTACK_SECONDS,
  MASTER_GAIN_RAMP_SECONDS,
} from '../constants/audio.constants';
import { SettingsService } from '@core/services/settings.service';

@Injectable()
export class AudioService {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private _volume = AUDIO_CONFIG.masterVolume;
  private lastEnemyHitTime = -Infinity;
  private towerFiresThisFrame = 0;
  private deathSoundsThisFrame = 0;

  constructor(private settingsService: SettingsService) {}

  get isMuted(): boolean {
    return this.settingsService.get().audioMuted;
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
      this.masterGain.gain.value = this.isMuted ? 0 : this._volume;

      // Soft limiter on the SFX bus: masterGain → limiter → destination.
      // Keeps simultaneous combat voices from summing past 0 dBFS and clipping.
      this.limiter = this.audioContext.createDynamicsCompressor();
      this.limiter.threshold.value = SFX_LIMITER_THRESHOLD_DB;
      this.limiter.knee.value = SFX_LIMITER_KNEE_DB;
      this.limiter.ratio.value = SFX_LIMITER_RATIO;
      this.limiter.attack.value = SFX_LIMITER_ATTACK_SECONDS;
      this.limiter.release.value = SFX_LIMITER_RELEASE_SECONDS;

      this.masterGain.connect(this.limiter);
      this.limiter.connect(this.audioContext.destination);
    } catch {
      this.audioContext = null;
      this.masterGain = null;
      this.limiter = null;
    }

    return this.audioContext;
  }

  /** Reset per-frame SFX counters. Call at the top of each animation frame. */
  resetFrameCounters(): void {
    this.towerFiresThisFrame = 0;
    this.deathSoundsThisFrame = 0;
  }

  // --- Sound primitives ---

  private playTone(
    frequency: number,
    endFrequency: number,
    duration: number,
    oscillatorType: OscillatorType,
    gain: number,
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

      // Click-free envelope: a few-ms linear attack avoids the onset pop of an
      // instantaneous gain jump, then an exponential decay to near-silence.
      const startAt = ctx.currentTime + startDelay;
      const attack = Math.min(SFX_ATTACK_SECONDS, duration * 0.5);
      envGain.gain.setValueAtTime(0, startAt);
      envGain.gain.linearRampToValueAtTime(gain, startAt + attack);
      envGain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

      osc.connect(envGain);
      envGain.connect(this.masterGain);

      osc.start(ctx.currentTime + startDelay);
      osc.stop(ctx.currentTime + startDelay + duration + 0.01);

      // Disconnect nodes after playback so they can be garbage collected
      osc.onended = () => {
        osc.disconnect();
        envGain.disconnect();
      };
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
      const startAt = ctx.currentTime + startDelay;
      const attack = Math.min(SFX_ATTACK_SECONDS, duration * 0.5);
      envGain.gain.setValueAtTime(0, startAt);
      envGain.gain.linearRampToValueAtTime(gain, startAt + attack);
      envGain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

      source.connect(envGain);
      envGain.connect(this.masterGain);

      source.start(ctx.currentTime + startDelay);

      // Disconnect nodes after playback so they can be garbage collected
      source.onended = () => {
        source.disconnect();
        envGain.disconnect();
      };
    } catch {
      // Silently swallow
    }
  }

  private playArpeggio(
    notes: number[],
    noteDuration: number,
    noteGap: number,
    oscillatorType: OscillatorType,
    gain: number
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

    if (this.towerFiresThisFrame >= AUDIO_CONFIG.maxTowerFiresPerFrame) return;
    this.towerFiresThisFrame++;

    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, cfg.gain);
  }

  playEnemyHit(): void {
    const now = Date.now();
    if (now - this.lastEnemyHitTime < AUDIO_CONFIG.enemyHit.throttleMs) return;
    this.lastEnemyHitTime = now;

    const cfg = AUDIO_CONFIG.enemyHit;
    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, cfg.gain);
  }

  playEnemyDeath(): void {
    if (this.deathSoundsThisFrame >= AUDIO_CONFIG.maxDeathSoundsPerFrame) return;
    this.deathSoundsThisFrame++;

    const cfg = AUDIO_CONFIG.enemyDeath;
    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, cfg.gain);
    this.playNoise(cfg.noiseGain, cfg.noiseDuration);
  }

  playWaveStart(): void {
    const cfg = AUDIO_CONFIG.waveStart;
    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, cfg.gain);
  }

  playWaveClear(): void {
    const cfg = AUDIO_CONFIG.waveClear;
    this.playArpeggio(cfg.notes, cfg.noteDuration, cfg.noteGap, cfg.oscillatorType, cfg.gain);
  }

  playGoldEarned(): void {
    const cfg = AUDIO_CONFIG.goldEarned;
    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, cfg.gain);
  }

  playTowerPlace(): void {
    const cfg = AUDIO_CONFIG.towerPlace;
    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, cfg.gain);
  }

  playTowerUpgrade(): void {
    const cfg = AUDIO_CONFIG.towerUpgrade;
    this.playArpeggio(cfg.notes, cfg.noteDuration, cfg.noteGap, cfg.oscillatorType, cfg.gain);
  }

  playTowerSell(): void {
    const cfg = AUDIO_CONFIG.towerSell;
    this.playArpeggio(cfg.notes, cfg.noteDuration, cfg.noteGap, cfg.oscillatorType, cfg.gain);
  }

  playLifeLoss(): void {
    const cfg = AUDIO_CONFIG.lifeLoss;
    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, cfg.gain);
  }

  /**
   * Boss-intro roar: low descending sawtooth (80→30 Hz, 1.2s) layered with a
   * short noise burst. Played once when the boss-intro banner fires.
   */
  playBossRoar(): void {
    const cfg = AUDIO_CONFIG.bossRoar;
    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, cfg.gain);
    this.playNoise(cfg.noiseGain, cfg.noiseDuration);
  }

  playDefeat(): void {
    const cfg = AUDIO_CONFIG.defeat;
    this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.oscillatorType, cfg.gain);
  }

  playVictory(): void {
    const cfg = AUDIO_CONFIG.victory;
    this.playArpeggio(cfg.notes, cfg.noteDuration, cfg.noteGap, cfg.oscillatorType, cfg.gain);
  }

  /** 5-note ascending arpeggio (C5 E5 G5 B5 C6) for achievement unlocks. */
  playAchievementSound(): void {
    this.playSfx('achievement');
  }

  /** Quick ascending 2-note chime (E5 G5) for streak bonus. */
  playStreakSound(): void {
    this.playSfx('streak');
  }

  /** Rapid ascending coin cascade (C6 E6 G6) for challenge completion. */
  playChallengeSound(): void {
    this.playSfx('challenge');
  }

  /**
   * Play a named SFX from SFX_CONFIGS. Handles both single-tone and sequence configs.
   * No-op if the key is not found.
   */
  playSfx(key: string): void {
    const cfg = SFX_CONFIGS[key];
    if (!cfg) return;

    if (isSfxSequenceConfig(cfg)) {
      this.playSequence(cfg.notes, cfg.type, cfg.volume);
    } else {
      this.playTone(cfg.frequency, cfg.endFrequency, cfg.duration, cfg.type, cfg.volume);
    }
  }

  /**
   * Play a sequence of notes in order, each starting after the previous one ends.
   * Useful for multi-note fanfares (waveComplete, etc.).
   */
  playSequence(
    notes: { freq: number; duration: number }[],
    oscillatorType: OscillatorType = 'sine',
    gain = 0.3
  ): void {
    let elapsed = 0;
    for (const note of notes) {
      this.playTone(note.freq, note.freq, note.duration, oscillatorType, gain, elapsed);
      elapsed += note.duration;
    }
  }

  // --- Volume / mute ---

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    if (!this.isMuted) {
      this.rampMasterGain(this._volume);
    }
  }

  toggleMute(): void {
    const next = !this.isMuted;
    this.settingsService.update({ audioMuted: next });
    this.rampMasterGain(next ? 0 : this._volume);
  }

  /**
   * Ramp the master gain to `target` over a few ms instead of writing
   * `.gain.value` directly — a direct write steps the level in one sample and
   * clicks on any SFX voice that is mid-playback.
   */
  private rampMasterGain(target: number): void {
    if (!this.masterGain || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(target, now + MASTER_GAIN_RAMP_SECONDS);
  }

  // --- Lifecycle ---

  cleanup(): void {
    if (this.audioContext) {
      try { this.limiter?.disconnect(); } catch { /* already disconnected */ }
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
      this.masterGain = null;
      this.limiter = null;
    }
  }
}
