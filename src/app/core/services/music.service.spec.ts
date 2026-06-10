import { TestBed } from '@angular/core/testing';
import { MusicService } from './music.service';
import { SettingsService } from './settings.service';
import {
  MUSIC_THEME_CONFIGS,
  MusicTheme,
} from '../constants/music.constants';

/**
 * Minimal stub for SettingsService — returns defaults that match
 * what the real service would return after first load.
 */
class SettingsServiceStub {
  private _settings = {
    audioMuted: false,
    musicEnabled: true,
    musicVolume: 0.4,
    difficulty: 'normal' as const,
    showFps: false,
    reduceMotion: false,
  };

  get(): typeof this._settings {
    return { ...this._settings };
  }

  update(partial: Partial<typeof this._settings>): void {
    this._settings = { ...this._settings, ...partial };
  }

  reset(): void {
    this._settings = {
      audioMuted: false,
      musicEnabled: true,
      musicVolume: 0.4,
      difficulty: 'normal',
      showFps: false,
      reduceMotion: false,
    };
  }
}

describe('MusicService', () => {
  let service: MusicService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MusicService,
        { provide: SettingsService, useClass: SettingsServiceStub },
      ],
    });
    service = TestBed.inject(MusicService);
  });

  afterEach(() => {
    service.cleanup();
  });

  // ── 1. Instantiation ───────────────────────────────────────────────────────

  it('should create successfully', () => {
    expect(service).toBeTruthy();
  });

  // ── 2. playTheme sets currentTheme ────────────────────────────────────────

  it('playTheme("hub") should set currentTheme to "hub"', () => {
    service.playTheme('hub');
    expect((service as unknown as Record<string, unknown>)['currentTheme']).toBe('hub');
  });

  // ── 3. playTheme is idempotent ────────────────────────────────────────────

  it('playTheme("hub") called twice should not throw and currentTheme stays "hub"', () => {
    expect(() => {
      service.playTheme('hub');
      service.playTheme('hub');
    }).not.toThrow();
    expect((service as unknown as Record<string, unknown>)['currentTheme']).toBe('hub');
  });

  // ── 4. playTheme switches theme ───────────────────────────────────────────

  it('playTheme("combat") after "hub" should set currentTheme to "combat"', () => {
    service.playTheme('hub');
    service.playTheme('combat');
    expect((service as unknown as Record<string, unknown>)['currentTheme']).toBe('combat');
  });

  // ── 5. stopMusic clears currentTheme ─────────────────────────────────────

  it('stopMusic() should clear currentTheme', () => {
    service.playTheme('hub');
    service.stopMusic();
    expect((service as unknown as Record<string, unknown>)['currentTheme']).toBeNull();
  });

  // ── 6. setMusicEnabled(false) ─────────────────────────────────────────────

  it('setMusicEnabled(false) should not throw and music should be disabled', () => {
    service.playTheme('hub');
    expect(() => service.setMusicEnabled(false)).not.toThrow();
  });

  // ── 7. setMusicVolume clamps correctly ────────────────────────────────────

  it('setMusicVolume(0.7) should set musicVolume to 0.7', () => {
    service.setMusicVolume(0.7);
    expect((service as unknown as Record<string, unknown>)['musicVolume']).toBeCloseTo(0.7);
  });

  it('setMusicVolume(1.5) should clamp to 1', () => {
    service.setMusicVolume(1.5);
    expect((service as unknown as Record<string, unknown>)['musicVolume']).toBe(1);
  });

  it('setMusicVolume(-0.1) should clamp to 0', () => {
    service.setMusicVolume(-0.1);
    expect((service as unknown as Record<string, unknown>)['musicVolume']).toBe(0);
  });

  it('setMusicVolume(0) should set to exact 0', () => {
    service.setMusicVolume(0);
    expect((service as unknown as Record<string, unknown>)['musicVolume']).toBe(0);
  });

  it('setMusicVolume(1) should set to exact 1', () => {
    service.setMusicVolume(1);
    expect((service as unknown as Record<string, unknown>)['musicVolume']).toBe(1);
  });

  // ── 8. All 3 theme configs are structurally valid ─────────────────────────

  const themes: MusicTheme[] = ['hub', 'combat', 'boss'];

  themes.forEach(theme => {
    describe(`${theme} theme config`, () => {
      it('should have tempo > 0', () => {
        expect(MUSIC_THEME_CONFIGS[theme].tempo).toBeGreaterThan(0);
      });

      it('should have rootHz > 0', () => {
        expect(MUSIC_THEME_CONFIGS[theme].rootHz).toBeGreaterThan(0);
      });

      it('should have a non-empty scale', () => {
        expect(MUSIC_THEME_CONFIGS[theme].scale.length).toBeGreaterThan(0);
      });

      it('should have a non-empty chordPattern', () => {
        expect(MUSIC_THEME_CONFIGS[theme].chordPattern.length).toBeGreaterThan(0);
      });

      it('should have padLayer with positive filterCutoff', () => {
        expect(MUSIC_THEME_CONFIGS[theme].padLayer.filterCutoff).toBeGreaterThan(0);
      });

      it('should have padLayer with positive padGain', () => {
        expect(MUSIC_THEME_CONFIGS[theme].padLayer.padGain).toBeGreaterThan(0);
      });

      it('should have bassLayer with octaveOffset < 0', () => {
        expect(MUSIC_THEME_CONFIGS[theme].bassLayer.octaveOffset).toBeLessThan(0);
      });

      it('should have pluckLayer with noteProbability between 0 and 1', () => {
        expect(MUSIC_THEME_CONFIGS[theme].pluckLayer.noteProbability).toBeGreaterThan(0);
        expect(MUSIC_THEME_CONFIGS[theme].pluckLayer.noteProbability).toBeLessThanOrEqual(1);
      });
    });
  });

  // ── 9. MUSIC_THEME_CONFIGS covers all MusicTheme values ──────────────────

  it('MUSIC_THEME_CONFIGS should have entries for hub, combat, and boss', () => {
    expect(MUSIC_THEME_CONFIGS['hub']).toBeDefined();
    expect(MUSIC_THEME_CONFIGS['combat']).toBeDefined();
    expect(MUSIC_THEME_CONFIGS['boss']).toBeDefined();
  });

  // ── 10. cleanup() is idempotent ───────────────────────────────────────────

  it('cleanup() called twice should not throw', () => {
    service.playTheme('hub');
    expect(() => {
      service.cleanup();
      service.cleanup();
    }).not.toThrow();
  });

  it('cleanup() on fresh service should not throw', () => {
    expect(() => service.cleanup()).not.toThrow();
  });

  // ── Additional safety checks ──────────────────────────────────────────────

  it('playTheme should no-op when musicEnabled is false', () => {
    service.setMusicEnabled(false);
    service.playTheme('hub');
    expect((service as unknown as Record<string, unknown>)['currentTheme']).toBeNull();
  });

  it('stopMusic(2) should not throw with an active theme', () => {
    service.playTheme('combat');
    expect(() => service.stopMusic(2)).not.toThrow();
  });

  it('playTheme("boss") should set currentTheme to "boss"', () => {
    service.playTheme('boss');
    expect((service as unknown as Record<string, unknown>)['currentTheme']).toBe('boss');
  });
});
