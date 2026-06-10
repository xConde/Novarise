import { Component, OnInit } from '@angular/core';
import { SettingsService } from '../core/services/settings.service';
import { MusicService } from '../core/services/music.service';
import { DifficultyLevel } from '../game/game-board/models/game-state.model';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  audioMuted = false;
  musicEnabled = true;
  musicVolume = 0.4;
  currentDifficulty: DifficultyLevel = DifficultyLevel.NORMAL;
  showFps = false;
  reduceMotion = false;

  readonly difficulties: DifficultyLevel[] = [
    DifficultyLevel.EASY,
    DifficultyLevel.NORMAL,
    DifficultyLevel.HARD,
    DifficultyLevel.NIGHTMARE,
  ];

  constructor(
    private settingsService: SettingsService,
    private musicService: MusicService,
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  private loadSettings(): void {
    const s = this.settingsService.get();
    this.audioMuted = s.audioMuted;
    this.musicEnabled = s.musicEnabled;
    this.musicVolume = s.musicVolume;
    this.currentDifficulty = s.difficulty;
    this.showFps = s.showFps;
    this.reduceMotion = s.reduceMotion;
    if (this.reduceMotion) {
      document.body.classList.add('reduce-motion');
    }
  }

  toggleAudio(): void {
    this.audioMuted = !this.audioMuted;
    this.settingsService.update({ audioMuted: this.audioMuted });
  }

  toggleMusic(): void {
    this.musicEnabled = !this.musicEnabled;
    this.settingsService.update({ musicEnabled: this.musicEnabled });
    this.musicService.setMusicEnabled(this.musicEnabled);
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = volume;
    this.settingsService.update({ musicVolume: volume });
    this.musicService.setMusicVolume(volume);
  }

  setDifficulty(difficulty: DifficultyLevel): void {
    this.currentDifficulty = difficulty;
    this.settingsService.update({ difficulty });
  }

  toggleFps(): void {
    this.showFps = !this.showFps;
    this.settingsService.update({ showFps: this.showFps });
  }

  toggleReduceMotion(): void {
    this.reduceMotion = !this.reduceMotion;
    this.settingsService.update({ reduceMotion: this.reduceMotion });
    if (this.reduceMotion) {
      document.body.classList.add('reduce-motion');
    } else {
      document.body.classList.remove('reduce-motion');
    }
  }

}
