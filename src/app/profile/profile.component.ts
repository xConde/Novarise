import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  PlayerProfileService,
  PlayerProfile,
  Achievement,
  AchievementCategory,
  ACHIEVEMENTS,
} from '../game/game-board/services/player-profile.service';

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

  constructor(
    private profileService: PlayerProfileService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.profile = this.profileService.getProfile();
    this.unlockedSet = new Set(this.profile.achievements);
    this.categoryGroups = this.buildCategoryGroups();
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

  get unlockedCount(): number {
    return this.profile.achievements.length;
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
