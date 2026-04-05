import { TestBed } from '@angular/core/testing';
import { AudioService } from './audio.service';
import { SettingsService } from '../../../core/services/settings.service';
import { TowerType } from '../models/tower.model';
import { AUDIO_CONFIG, SFX_CONFIGS, isSfxSequenceConfig, SfxConfig } from '../constants/audio.constants';

describe('AudioService', () => {
  let service: AudioService;
  let settingsService: SettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AudioService, SettingsService]
    });
    service = TestBed.inject(AudioService);
    settingsService = TestBed.inject(SettingsService);
  });

  afterEach(() => {
    service.cleanup();
    settingsService.reset(); // prevent muted state from bleeding across tests via localStorage
  });

  // --- Instantiation ---

  it('should create successfully', () => {
    expect(service).toBeTruthy();
  });

  it('should start with default volume from AUDIO_CONFIG', () => {
    expect(service.volume).toBe(AUDIO_CONFIG.masterVolume);
  });

  it('should start unmuted', () => {
    expect(service.isMuted).toBeFalse();
  });

  it('isMuted should read from SettingsService', () => {
    settingsService.update({ audioMuted: true });
    expect(service.isMuted).toBeTrue();
    settingsService.update({ audioMuted: false });
    expect(service.isMuted).toBeFalse();
  });

  // --- setVolume ---

  it('setVolume() should clamp values above 1 to 1', () => {
    service.setVolume(2.5);
    expect(service.volume).toBe(1);
  });

  it('setVolume() should clamp values below 0 to 0', () => {
    service.setVolume(-0.5);
    expect(service.volume).toBe(0);
  });

  it('setVolume() should accept values within 0-1 range', () => {
    service.setVolume(0.7);
    expect(service.volume).toBeCloseTo(0.7);
  });

  it('setVolume() should accept boundary value 0', () => {
    service.setVolume(0);
    expect(service.volume).toBe(0);
  });

  it('setVolume() should accept boundary value 1', () => {
    service.setVolume(1);
    expect(service.volume).toBe(1);
  });

  // --- toggleMute ---

  it('toggleMute() should set isMuted to true on first call', () => {
    service.toggleMute();
    expect(service.isMuted).toBeTrue();
  });

  it('toggleMute() should toggle back to false on second call', () => {
    service.toggleMute();
    service.toggleMute();
    expect(service.isMuted).toBeFalse();
  });

  it('toggleMute() should alternate state on each call', () => {
    expect(service.isMuted).toBeFalse();
    service.toggleMute();
    expect(service.isMuted).toBeTrue();
    service.toggleMute();
    expect(service.isMuted).toBeFalse();
    service.toggleMute();
    expect(service.isMuted).toBeTrue();
  });

  it('toggleMute() should persist muted state to SettingsService', () => {
    service.toggleMute();
    expect(settingsService.get().audioMuted).toBeTrue();
    service.toggleMute();
    expect(settingsService.get().audioMuted).toBeFalse();
  });

  it('should have no internal _muted field — isMuted delegates to SettingsService', () => {
    // Verify there is no private _muted state by checking the service has no such property
    expect((service as unknown as Record<string, unknown>)['_muted']).toBeUndefined();
  });

  // --- cleanup ---

  it('cleanup() should not throw when AudioContext was never initialized', () => {
    expect(() => service.cleanup()).not.toThrow();
  });

  it('cleanup() should be idempotent — calling twice should not throw', () => {
    expect(() => {
      service.cleanup();
      service.cleanup();
    }).not.toThrow();
  });

  // --- Sound methods: lazy init guard (no AudioContext yet) ---

  it('playTowerFire() should not throw for BASIC tower without AudioContext', () => {
    expect(() => service.playTowerFire(TowerType.BASIC)).not.toThrow();
  });

  it('playTowerFire() should not throw for SNIPER tower without AudioContext', () => {
    expect(() => service.playTowerFire(TowerType.SNIPER)).not.toThrow();
  });

  it('playTowerFire() should not throw for SPLASH tower without AudioContext', () => {
    expect(() => service.playTowerFire(TowerType.SPLASH)).not.toThrow();
  });

  it('playEnemyHit() should not throw without AudioContext', () => {
    expect(() => service.playEnemyHit()).not.toThrow();
  });

  it('playEnemyDeath() should not throw without AudioContext', () => {
    expect(() => service.playEnemyDeath()).not.toThrow();
  });

  it('playWaveStart() should not throw without AudioContext', () => {
    expect(() => service.playWaveStart()).not.toThrow();
  });

  it('playWaveClear() should not throw without AudioContext', () => {
    expect(() => service.playWaveClear()).not.toThrow();
  });

  it('playGoldEarned() should not throw without AudioContext', () => {
    expect(() => service.playGoldEarned()).not.toThrow();
  });

  it('playTowerPlace() should not throw without AudioContext', () => {
    expect(() => service.playTowerPlace()).not.toThrow();
  });

  it('playTowerUpgrade() should not throw without AudioContext', () => {
    expect(() => service.playTowerUpgrade()).not.toThrow();
  });

  it('playTowerSell() should not throw without AudioContext', () => {
    expect(() => service.playTowerSell()).not.toThrow();
  });

  it('playDefeat() should not throw without AudioContext', () => {
    expect(() => service.playDefeat()).not.toThrow();
  });

  it('playVictory() should not throw without AudioContext', () => {
    expect(() => service.playVictory()).not.toThrow();
  });

  // --- Sound methods: muted state ---

  it('playTowerFire() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playTowerFire(TowerType.BASIC)).not.toThrow();
  });

  it('playEnemyHit() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playEnemyHit()).not.toThrow();
  });

  it('playEnemyDeath() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playEnemyDeath()).not.toThrow();
  });

  it('playWaveStart() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playWaveStart()).not.toThrow();
  });

  it('playWaveClear() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playWaveClear()).not.toThrow();
  });

  it('playGoldEarned() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playGoldEarned()).not.toThrow();
  });

  it('playTowerPlace() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playTowerPlace()).not.toThrow();
  });

  it('playTowerUpgrade() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playTowerUpgrade()).not.toThrow();
  });

  it('playTowerSell() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playTowerSell()).not.toThrow();
  });

  it('playVictory() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playVictory()).not.toThrow();
  });

  it('playDefeat() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playDefeat()).not.toThrow();
  });

  // --- EnemyHit throttle ---

  it('playEnemyHit() should throttle rapid calls without throwing', () => {
    // Fire 10 rapid hits — only the first should pass through the throttle
    expect(() => {
      for (let i = 0; i < 10; i++) {
        service.playEnemyHit();
      }
    }).not.toThrow();
  });

  // --- Frame counter reset ---

  it('resetFrameCounters() should not throw', () => {
    expect(() => service.resetFrameCounters()).not.toThrow();
  });

  it('resetFrameCounters() should allow tower fires again after limit was reached', () => {
    // Exhaust the per-frame limit
    for (let i = 0; i < AUDIO_CONFIG.maxTowerFiresPerFrame + 5; i++) {
      service.playTowerFire(TowerType.BASIC);
    }

    // Reset and verify we can fire again (no throw, no crash)
    service.resetFrameCounters();
    expect(() => service.playTowerFire(TowerType.BASIC)).not.toThrow();
  });

  it('resetFrameCounters() should allow enemy death sounds again after limit was reached', () => {
    // Exhaust the per-frame limit
    for (let i = 0; i < AUDIO_CONFIG.maxDeathSoundsPerFrame + 5; i++) {
      service.playEnemyDeath();
    }

    // Reset and verify we can play death sounds again
    service.resetFrameCounters();
    expect(() => service.playEnemyDeath()).not.toThrow();
  });

  // --- playSfx / playSequence ---

  it('playSfx() should not throw for an unknown key', () => {
    expect(() => service.playSfx('nonExistentKey')).not.toThrow();
  });

  it('playSfx() should not throw for chainZap', () => {
    expect(() => service.playSfx('chainZap')).not.toThrow();
  });

  it('playSfx() should not throw for mortarExplosion', () => {
    expect(() => service.playSfx('mortarExplosion')).not.toThrow();
  });

  it('playSfx() should not throw for slowAura', () => {
    expect(() => service.playSfx('slowAura')).not.toThrow();
  });

  it('playSfx() should not throw for waveComplete', () => {
    expect(() => service.playSfx('waveComplete')).not.toThrow();
  });

  it('playSfx() should not throw for gameOver', () => {
    expect(() => service.playSfx('gameOver')).not.toThrow();
  });

  it('playSfx() should not throw for towerUpgrade sfx key', () => {
    expect(() => service.playSfx('towerUpgrade')).not.toThrow();
  });

  it('playSequence() should not throw with an empty notes array', () => {
    expect(() => service.playSequence([])).not.toThrow();
  });

  it('playSequence() should not throw with multiple notes', () => {
    expect(() => service.playSequence([
      { freq: 440, duration: 0.1 },
      { freq: 554, duration: 0.1 },
      { freq: 880, duration: 0.2 },
    ])).not.toThrow();
  });
});

// --- SFX_CONFIGS shape validation ---

describe('SFX_CONFIGS', () => {
  const SINGLE_TONE_KEYS: string[] = ['chainZap', 'mortarExplosion', 'slowAura', 'gameOver', 'towerUpgrade'];
  const SEQUENCE_KEYS: string[] = ['waveComplete'];
  const ALL_KEYS = [...SINGLE_TONE_KEYS, ...SEQUENCE_KEYS];

  it('should contain all required keys', () => {
    for (const key of ALL_KEYS) {
      expect(SFX_CONFIGS[key]).toBeDefined(`SFX_CONFIGS missing key: ${key}`);
    }
  });

  SINGLE_TONE_KEYS.forEach(key => {
    describe(`${key}`, () => {
      it('should have required SfxConfig properties', () => {
        const cfg = SFX_CONFIGS[key];
        expect(cfg).toBeDefined();
        expect(isSfxSequenceConfig(cfg)).toBeFalse();
        const tone = cfg as SfxConfig;
        expect(typeof tone.type).toBe('string');
        expect(typeof tone.frequency).toBe('number');
        expect(typeof tone.endFrequency).toBe('number');
        expect(typeof tone.duration).toBe('number');
        expect(typeof tone.volume).toBe('number');
      });

      it('should have positive frequency', () => {
        const tone = SFX_CONFIGS[key] as SfxConfig;
        expect(tone.frequency).toBeGreaterThan(0);
      });

      it('should have positive duration', () => {
        const tone = SFX_CONFIGS[key] as SfxConfig;
        expect(tone.duration).toBeGreaterThan(0);
      });

      it('should have volume in (0, 1] range', () => {
        const tone = SFX_CONFIGS[key] as SfxConfig;
        expect(tone.volume).toBeGreaterThan(0);
        expect(tone.volume).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('chainZap', () => {
    it('should use square oscillator type', () => {
      const cfg = SFX_CONFIGS['chainZap'] as SfxConfig;
      expect(cfg.type).toBe('square');
    });

    it('should have high starting frequency (~880)', () => {
      const cfg = SFX_CONFIGS['chainZap'] as SfxConfig;
      expect(cfg.frequency).toBeGreaterThanOrEqual(800);
    });

    it('should have very short duration (~0.05s)', () => {
      const cfg = SFX_CONFIGS['chainZap'] as SfxConfig;
      expect(cfg.duration).toBeLessThanOrEqual(0.1);
    });
  });

  describe('mortarExplosion', () => {
    it('should use sine oscillator type', () => {
      const cfg = SFX_CONFIGS['mortarExplosion'] as SfxConfig;
      expect(cfg.type).toBe('sine');
    });

    it('should have low starting frequency (~80)', () => {
      const cfg = SFX_CONFIGS['mortarExplosion'] as SfxConfig;
      expect(cfg.frequency).toBeLessThanOrEqual(100);
    });

    it('should have medium duration (~0.3s)', () => {
      const cfg = SFX_CONFIGS['mortarExplosion'] as SfxConfig;
      expect(cfg.duration).toBeGreaterThanOrEqual(0.2);
      expect(cfg.duration).toBeLessThanOrEqual(0.5);
    });
  });

  describe('slowAura', () => {
    it('should use sine oscillator type', () => {
      const cfg = SFX_CONFIGS['slowAura'] as SfxConfig;
      expect(cfg.type).toBe('sine');
    });

    it('should have mid frequency (~220)', () => {
      const cfg = SFX_CONFIGS['slowAura'] as SfxConfig;
      expect(cfg.frequency).toBeGreaterThanOrEqual(180);
      expect(cfg.frequency).toBeLessThanOrEqual(280);
    });

    it('should have low volume', () => {
      const cfg = SFX_CONFIGS['slowAura'] as SfxConfig;
      expect(cfg.volume).toBeLessThanOrEqual(0.15);
    });
  });

  describe('waveComplete', () => {
    it('should be a sequence config', () => {
      const cfg = SFX_CONFIGS['waveComplete'];
      expect(isSfxSequenceConfig(cfg)).toBeTrue();
    });

    it('should have at least 3 notes', () => {
      const cfg = SFX_CONFIGS['waveComplete'];
      if (isSfxSequenceConfig(cfg)) {
        expect(cfg.notes.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('should have ascending note frequencies', () => {
      const cfg = SFX_CONFIGS['waveComplete'];
      if (isSfxSequenceConfig(cfg)) {
        const freqs = cfg.notes.map(n => n.freq);
        expect(freqs[freqs.length - 1]).toBeGreaterThan(freqs[0]);
      }
    });

    it('should have required properties: type, notes, volume', () => {
      const cfg = SFX_CONFIGS['waveComplete'];
      if (isSfxSequenceConfig(cfg)) {
        expect(typeof cfg.type).toBe('string');
        expect(Array.isArray(cfg.notes)).toBeTrue();
        expect(typeof cfg.volume).toBe('number');
      }
    });
  });

  describe('gameOver', () => {
    it('should use sine oscillator type', () => {
      const cfg = SFX_CONFIGS['gameOver'] as SfxConfig;
      expect(cfg.type).toBe('sine');
    });

    it('should start at 440Hz and descend', () => {
      const cfg = SFX_CONFIGS['gameOver'] as SfxConfig;
      expect(cfg.frequency).toBe(440);
      expect(cfg.endFrequency).toBeLessThan(cfg.frequency);
    });

    it('should have duration around 0.5s', () => {
      const cfg = SFX_CONFIGS['gameOver'] as SfxConfig;
      expect(cfg.duration).toBeGreaterThanOrEqual(0.3);
      expect(cfg.duration).toBeLessThanOrEqual(0.8);
    });
  });

  describe('towerUpgrade (sfx)', () => {
    it('should use square oscillator type', () => {
      const cfg = SFX_CONFIGS['towerUpgrade'] as SfxConfig;
      expect(cfg.type).toBe('square');
    });

    it('should ascend from ~300 to ~600Hz', () => {
      const cfg = SFX_CONFIGS['towerUpgrade'] as SfxConfig;
      expect(cfg.frequency).toBeGreaterThanOrEqual(250);
      expect(cfg.endFrequency).toBeGreaterThan(cfg.frequency);
    });

    it('should have short duration (~0.15s)', () => {
      const cfg = SFX_CONFIGS['towerUpgrade'] as SfxConfig;
      expect(cfg.duration).toBeLessThanOrEqual(0.25);
    });
  });
});
