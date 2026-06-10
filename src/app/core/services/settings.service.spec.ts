import { FontScale, SettingsService, GameSettings } from './settings.service';
import { DifficultyLevel } from '../../game/game-board/models/game-state.model';
import { StorageService } from './storage.service';

const STORAGE_KEY = 'novarise-settings';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    service = new SettingsService(new StorageService());
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('should return default settings when no saved data exists', () => {
    const settings = service.get();
    expect(settings.audioMuted).toBe(false);
    expect(settings.difficulty).toBe(DifficultyLevel.NORMAL);
    expect(settings.showFps).toBe(false);
    expect(settings.reduceMotion).toBe(false);
    expect(settings.colorblindAssist).toBe(false);
    expect(settings.fontScale).toBe(1 as FontScale);
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
  });

  it('should load persisted settings on construction', () => {
    const saved: GameSettings = {
      audioMuted: true,
      musicEnabled: false,
      musicVolume: 0.2,
      difficulty: DifficultyLevel.NIGHTMARE,
      showFps: true,
      reduceMotion: true,
      colorblindAssist: true,
      fontScale: 1.3 as FontScale,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const freshService = new SettingsService(new StorageService());
    const settings = freshService.get();
    expect(settings.audioMuted).toBe(true);
    expect(settings.difficulty).toBe(DifficultyLevel.NIGHTMARE);
    expect(settings.showFps).toBe(true);
    expect(settings.reduceMotion).toBe(true);
    expect(settings.colorblindAssist).toBe(true);
    expect(settings.fontScale).toBe(1.3 as FontScale);
  });

  it('should merge old saves missing colorblindAssist and fontScale with safe defaults', () => {
    // Simulate a pre-accessibility save (no new keys)
    const oldSave = { audioMuted: true, musicEnabled: false, musicVolume: 0.5,
      difficulty: DifficultyLevel.HARD, showFps: false, reduceMotion: false };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(oldSave));

    const freshService = new SettingsService(new StorageService());
    const settings = freshService.get();
    expect(settings.colorblindAssist).toBe(false); // default — do not force colorblind on
    expect(settings.fontScale).toBe(1 as FontScale); // default — do not resize text unexpectedly
    expect(settings.audioMuted).toBe(true);         // old save value preserved
  });

  it('should return defaults when localStorage contains invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');

    const freshService = new SettingsService(new StorageService());
    const settings = freshService.get();
    expect(settings.audioMuted).toBe(false);
    expect(settings.difficulty).toBe(DifficultyLevel.NORMAL);
  });

  it('should merge partial saved data with defaults', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ audioMuted: true }));

    const freshService = new SettingsService(new StorageService());
    const settings = freshService.get();
    expect(settings.audioMuted).toBe(true);
    expect(settings.difficulty).toBe(DifficultyLevel.NORMAL); // default filled in
  });

  it('should reset to defaults', () => {
    service.update({ audioMuted: true, difficulty: DifficultyLevel.NIGHTMARE, showFps: true,
      reduceMotion: true, colorblindAssist: true, fontScale: 1.3 as FontScale });
    service.reset();

    const settings = service.get();
    expect(settings.audioMuted).toBe(false);
    expect(settings.difficulty).toBe(DifficultyLevel.NORMAL);
    expect(settings.showFps).toBe(false);
    expect(settings.reduceMotion).toBe(false);
    expect(settings.colorblindAssist).toBe(false);
    expect(settings.fontScale).toBe(1 as FontScale);
  });

  it('should return a copy from get() — mutations do not affect stored state', () => {
    const settings = service.get();
    settings.audioMuted = true;

    const fresh = service.get();
    expect(fresh.audioMuted).toBe(false); // original unaffected
  });
});
