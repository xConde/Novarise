import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  PlayerProfileService,
  PlayerProfile,
  Achievement,
  AchievementCategory,
  ACHIEVEMENTS,
} from '../core/services/player-profile.service';
import { TowerType, TOWER_IDENTITIES } from '../game/game-board/models/tower.model';

export interface AchievementCategoryGroup {
  category: AchievementCategory;
  label: string;
  achievements: Achievement[];
  unlockedCount: number;
}

export interface TowerKillRow {
  type: TowerType;
  label: string;
  kills: number;
  pct: number;
}

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  campaign: 'Campaign',
  combat: 'Combat',
  // endless is dev/test-only infra — no endless mode exists in run mode; category excluded from display
  endless: 'Endless',
  challenge: 'Challenge',
};

// Endless mode does not exist in run mode — survivor/endless_30/endless_50/endless_100
// are dev/test-only and cannot be earned. Three-star scoring (three_star_5/three_star_all)
// requires a per-map star system that is also unreachable in run mode.
// These ids are retained in the achievement model for data-migration safety but are
// excluded from all display surfaces here.
const DEAD_ACHIEVEMENT_IDS = new Set<string>([
  'survivor',
  'endless_30',
  'endless_50',
  'endless_100',
  'three_star_5',
  'three_star_all',
]);

/** Achievements reachable in run mode — excludes endless and three-star campaign entries. */
export const DISPLAY_ACHIEVEMENTS: Achievement[] = ACHIEVEMENTS.filter(
  (a) => !DEAD_ACHIEVEMENT_IDS.has(a.id)
);

const CATEGORY_ORDER: AchievementCategory[] = ['campaign', 'combat', 'challenge'];

const ALL_TOWER_TYPES: TowerType[] = [
  TowerType.BASIC,
  TowerType.SNIPER,
  TowerType.SPLASH,
  TowerType.SLOW,
  TowerType.CHAIN,
  TowerType.MORTAR,
];

const TOTAL_ACHIEVEMENTS = 20;

const RANK_THRESHOLDS: { min: number; title: string }[] = [
  { min: 25, title: 'Novarise' },
  { min: 19, title: 'Champion' },
  { min: 13, title: 'Elite' },
  { min: 7,  title: 'Commander' },
  { min: 3,  title: 'Defender' },
  { min: 0,  title: 'Recruit' },
];

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  profile!: PlayerProfile;
  allAchievements: Achievement[] = DISPLAY_ACHIEVEMENTS;
  categoryGroups: AchievementCategoryGroup[] = [];
  towerKillRows: TowerKillRow[] = [];
  arsenalExpanded = false;
  private unlockedSet = new Set<string>();
  private expandedCategories = new Set<AchievementCategory>();

  readonly totalAchievements = TOTAL_ACHIEVEMENTS;

  constructor(
    private profileService: PlayerProfileService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.profile = this.profileService.getProfile();
    this.unlockedSet = new Set(this.profile.achievements);
    this.categoryGroups = this.buildCategoryGroups();
    this.towerKillRows = this.buildTowerKillRows();
  }

  private buildCategoryGroups(): AchievementCategoryGroup[] {
    return CATEGORY_ORDER.map((category) => {
      const achievements = DISPLAY_ACHIEVEMENTS.filter((a) => a.category === category);
      const unlockedCount = achievements.filter((a) => this.unlockedSet.has(a.id)).length;
      return {
        category,
        label: CATEGORY_LABELS[category],
        achievements,
        unlockedCount,
      };
    });
  }

  private buildTowerKillRows(): TowerKillRow[] {
    const kills = this.profile.towerKills;
    const counts = ALL_TOWER_TYPES.map((t) => kills[t] ?? 0);
    const maxKills = Math.max(...counts, 1);
    return ALL_TOWER_TYPES.map((type, i) => ({
      type,
      label: TOWER_IDENTITIES[type].displayName,
      kills: counts[i],
      pct: Math.round((counts[i] / maxKills) * 100),
    }));
  }

  isUnlocked(achievementId: string): boolean {
    return this.unlockedSet.has(achievementId);
  }

  toggleCategory(category: AchievementCategory): void {
    if (this.expandedCategories.has(category)) {
      this.expandedCategories.delete(category);
    } else {
      this.expandedCategories.add(category);
    }
  }

  isCategoryExpanded(category: AchievementCategory): boolean {
    return this.expandedCategories.has(category);
  }

  get winRate(): string {
    if (this.profile.totalGamesPlayed === 0) return '0';
    return ((this.profile.totalVictories / this.profile.totalGamesPlayed) * 100).toFixed(0);
  }

  get runWinRate(): string {
    if (this.profile.runsAttempted === 0) return '0';
    return ((this.profile.runsCompleted / this.profile.runsAttempted) * 100).toFixed(0);
  }

  get unlockedCount(): number {
    return this.profile.achievements.length;
  }

  get rankTitle(): string {
    const count = this.unlockedCount;
    for (const threshold of RANK_THRESHOLDS) {
      if (count >= threshold.min) {
        return threshold.title;
      }
    }
    return 'Recruit';
  }

  get achievementProgressPct(): number {
    return Math.round((this.unlockedCount / TOTAL_ACHIEVEMENTS) * 100);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
