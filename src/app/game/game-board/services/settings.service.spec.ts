import { SettingsService, GameSettings } from './settings.service';
import { DifficultyLevel } from '../models/game-state.model';

const STORAGE_KEY = 'novarise-settings';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    service = new SettingsService();
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('should return default settings when no saved data exists', () => {
    const settings = service.get();
    expect(settings.audioMuted).toBe(false);
    expect(settings.difficulty).toBe(DifficultyLevel.NORMAL);
    expect(settings.gameSpeed).toBe(1);
  });

  it('should persist settings to localStorage on update', () => {
    service.update({ audioMuted: true });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as GameSettings;
    expect(parsed.audioMuted).toBe(true);
  });

  it('should update partial settings without losing others', () => {
    service.update({ difficulty: DifficultyLevel.HARD });
    service.update({ audioMuted: true });

    const settings = service.get();
    expect(settings.difficulty).toBe(DifficultyLevel.HARD);
    expect(settings.audioMuted).toBe(true);
    expect(settings.gameSpeed).toBe(1); // untouched
  });

  it('should load persisted settings on construction', () => {
    const saved: GameSettings = {
      audioMuted: true,
      difficulty: DifficultyLevel.NIGHTMARE,
      gameSpeed: 3,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const freshService = new SettingsService();
    const settings = freshService.get();
    expect(settings.audioMuted).toBe(true);
    expect(settings.difficulty).toBe(DifficultyLevel.NIGHTMARE);
    expect(settings.gameSpeed).toBe(3);
  });

  it('should return defaults when localStorage contains invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');

    const freshService = new SettingsService();
    const settings = freshService.get();
    expect(settings.audioMuted).toBe(false);
    expect(settings.difficulty).toBe(DifficultyLevel.NORMAL);
  });

  it('should merge partial saved data with defaults', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ audioMuted: true }));

    const freshService = new SettingsService();
    const settings = freshService.get();
    expect(settings.audioMuted).toBe(true);
    expect(settings.difficulty).toBe(DifficultyLevel.NORMAL); // default filled in
    expect(settings.gameSpeed).toBe(1); // default filled in
  });

  it('should reset to defaults', () => {
    service.update({ audioMuted: true, difficulty: DifficultyLevel.NIGHTMARE, gameSpeed: 3 });
    service.reset();

    const settings = service.get();
    expect(settings.audioMuted).toBe(false);
    expect(settings.difficulty).toBe(DifficultyLevel.NORMAL);
    expect(settings.gameSpeed).toBe(1);
  });

  it('should return a copy from get() — mutations do not affect stored state', () => {
    const settings = service.get();
    settings.audioMuted = true;

    const fresh = service.get();
    expect(fresh.audioMuted).toBe(false); // original unaffected
  });

  describe('save failure logging', () => {
    it('should log warning on QuotaExceededError', () => {
      spyOn(localStorage, 'setItem').and.callFake(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });
      spyOn(console, 'warn');

      service.update({ audioMuted: true });

      expect(console.warn).toHaveBeenCalledWith(
        jasmine.stringContaining('quota exceeded')
      );
    });

    it('should log warning on generic storage failure', () => {
      spyOn(localStorage, 'setItem').and.callFake(() => {
        throw new Error('SecurityError');
      });
      spyOn(console, 'warn');

      service.update({ audioMuted: true });

      expect(console.warn).toHaveBeenCalledWith(
        jasmine.stringContaining('Failed to save settings'),
        jasmine.anything()
      );
    });
  });
});
