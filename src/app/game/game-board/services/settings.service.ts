import { Injectable } from '@angular/core';
import { DifficultyLevel } from '../models/game-state.model';
import { StorageService } from './storage.service';

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

  constructor(private storageService: StorageService) {
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
    const parsed = this.storageService.getJSON<Partial<GameSettings>>(STORAGE_KEY, {});
    return { ...DEFAULT_SETTINGS, ...parsed };
  }

  private save(): void {
    this.storageService.setJSON(STORAGE_KEY, this.settings);
  }
}
