import { Injectable } from '@angular/core';
import { DifficultyLevel } from '../models/game-state.model';

const STORAGE_KEY = 'novarise-settings';

export interface GameSettings {
  audioMuted: boolean;
  difficulty: DifficultyLevel;
  gameSpeed: number;
}

const DEFAULT_SETTINGS: GameSettings = {
  audioMuted: false,
  difficulty: DifficultyLevel.NORMAL,
  gameSpeed: 1,
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private settings: GameSettings;

  constructor() {
    this.settings = this.load();
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
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
        console.warn('localStorage quota exceeded — settings were not saved. Free space by deleting unused maps.');
      } else {
        console.warn('Failed to save settings — localStorage may be unavailable:', e);
      }
    }
  }
}
