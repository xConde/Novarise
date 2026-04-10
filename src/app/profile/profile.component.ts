import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  PlayerProfileService,
  PlayerProfile,
  Achievement,
  AchievementCategory,
  ACHIEVEMENTS,
} from '../core/services/player-profile.service';
import { SettingsService } from '../core/services/settings.service';
import { DifficultyLevel, GameSpeed, VALID_GAME_SPEEDS } from '../game/game-board/models/game-state.model';

export interface AchievementCategoryGroup {
  category: AchievementCategory;
  label: string;
  achievements: Achievement[];
  unlockedCount: number;
}

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  campaign: 'Campaign',
  combat: 'Combat',
  endless: 'Endless',
  challenge: 'Challenge',
};

const CATEGORY_ORDER: AchievementCategory[] = ['campaign', 'combat', 'endless', 'challenge'];

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  profile!: PlayerProfile;
  allAchievements: Achievement[] = ACHIEVEMENTS;
  categoryGroups: AchievementCategoryGroup[] = [];
  private unlockedSet = new Set<string>();

  // Settings state
  audioMuted = false;
  currentDifficulty: DifficultyLevel = DifficultyLevel.NORMAL;
  currentSpeed: GameSpeed = 1;
  showFps = false;
  reduceMotion = false;

  readonly difficulties: DifficultyLevel[] = [
    DifficultyLevel.EASY,
    DifficultyLevel.NORMAL,
    DifficultyLevel.HARD,
    DifficultyLevel.NIGHTMARE,
  ];
  readonly speeds: readonly GameSpeed[] = VALID_GAME_SPEEDS;

  constructor(
    private profileService: PlayerProfileService,
    private settingsService: SettingsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.profile = this.profileService.getProfile();
    this.unlockedSet = new Set(this.profile.achievements);
    this.categoryGroups = this.buildCategoryGroups();
    this.loadSettings();
  }

  private loadSettings(): void {
    const s = this.settingsService.get();
    this.audioMuted = s.audioMuted;
    this.currentDifficulty = s.difficulty;
    this.currentSpeed = s.gameSpeed as GameSpeed;
    this.showFps = s.showFps;
    this.reduceMotion = s.reduceMotion;
    if (this.reduceMotion) {
      document.body.classList.add('reduce-motion');
    }
  }

  private buildCategoryGroups(): AchievementCategoryGroup[] {
    return CATEGORY_ORDER.map((category) => {
      const achievements = ACHIEVEMENTS.filter((a) => a.category === category);
      const unlockedCount = achievements.filter((a) => this.unlockedSet.has(a.id)).length;
      return {
        category,
        label: CATEGORY_LABELS[category],
        achievements,
        unlockedCount,
      };
    });
  }

  isUnlocked(achievementId: string): boolean {
    return this.unlockedSet.has(achievementId);
  }

  get winRate(): string {
    if (this.profile.totalGamesPlayed === 0) return '0';
    return ((this.profile.totalVictories / this.profile.totalGamesPlayed) * 100).toFixed(0);
  }

  get ascentWinRate(): string {
    if (this.profile.ascentRunsAttempted === 0) return '0';
    return ((this.profile.ascentRunsCompleted / this.profile.ascentRunsAttempted) * 100).toFixed(0);
  }

  get unlockedCount(): number {
    return this.profile.achievements.length;
  }

  toggleAudio(): void {
    this.audioMuted = !this.audioMuted;
    this.settingsService.update({ audioMuted: this.audioMuted });
  }

  setDifficulty(difficulty: DifficultyLevel): void {
    this.currentDifficulty = difficulty;
    this.settingsService.update({ difficulty });
  }

  setSpeed(speed: GameSpeed): void {
    this.currentSpeed = speed;
    this.settingsService.update({ gameSpeed: speed });
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

  goHome(): void {
    this.router.navigate(['/']);
  }
}
