import { Injectable } from '@angular/core';
import { DifficultyLevel } from '../../game/game-board/models/game-state.model';
import { StorageService } from './storage.service';
import { FontScale, GameSettings } from '../models/settings.model';
import { DEFAULT_MUSIC_VOLUME } from '../constants/music.constants';

export { FontScale, GameSettings } from '../models/settings.model';

const STORAGE_KEY = 'novarise-settings';

const DEFAULT_SETTINGS: GameSettings = {
  audioMuted: false,
  musicEnabled: true,
  musicVolume: DEFAULT_MUSIC_VOLUME,
  difficulty: DifficultyLevel.NORMAL,
  showFps: false,
  reduceMotion: false,
  colorblindAssist: false,
  fontScale: 1,
};

/** CSS classes applied to <html> for font scaling. */
const FONT_SCALE_CLASSES: Record<FontScale, string | null> = {
  1:    null,
  1.15: 'font-scale-large',
  1.3:  'font-scale-larger',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private settings: GameSettings;

  constructor(private storageService: StorageService) {
    this.settings = this.load();
    this.applyFontScale(this.settings.fontScale);
  }

  /**
   * Apply the font-scale class to <html> so all rem-based tokens scale.
   * Called on boot and whenever the user changes the setting.
   */
  applyFontScale(scale: FontScale): void {
    const html = document.documentElement;
    // Remove all scale classes before applying the new one
    Object.values(FONT_SCALE_CLASSES).forEach(cls => {
      if (cls) html.classList.remove(cls);
    });
    const cls = FONT_SCALE_CLASSES[scale];
    if (cls) html.classList.add(cls);
  }

  get(): GameSettings {
    return { ...this.settings };
  }

  update(partial: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.save();
  }

  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
  }

  private load(): GameSettings {
    const parsed = this.storageService.getJSON<Partial<GameSettings>>(STORAGE_KEY, {});
    return { ...DEFAULT_SETTINGS, ...parsed };
  }

  private save(): void {
    this.storageService.setJSON(STORAGE_KEY, this.settings);
  }
}
