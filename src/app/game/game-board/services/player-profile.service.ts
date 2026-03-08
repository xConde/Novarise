import { Injectable } from '@angular/core';

const PROFILE_STORAGE_KEY = 'novarise-profile';

// Achievement condition thresholds
const VETERAN_GAMES_THRESHOLD = 10;
const GOLD_HOARDER_THRESHOLD = 10_000;
const EXTERMINATOR_KILLS_THRESHOLD = 1_000;
const SURVIVOR_WAVE_THRESHOLD = 20;
const HIGH_SCORER_THRESHOLD = 5_000;
const DEDICATED_VICTORIES_THRESHOLD = 25;

export interface PlayerProfile {
  totalGamesPlayed: number;
  totalVictories: number;
  totalDefeats: number;
  totalEnemiesKilled: number;
  totalGoldEarned: number;
  highestWaveReached: number;
  highestScore: number;
  achievements: string[]; // IDs of unlocked achievements
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  condition: (profile: PlayerProfile) => boolean;
}

export interface GameEndStats {
  isVictory: boolean;
  score: number;
  enemiesKilled: number;
  goldEarned: number;
  wavesCompleted: number;
  livesLost: number;
}

const DEFAULT_PROFILE: PlayerProfile = {
  totalGamesPlayed: 0,
  totalVictories: 0,
  totalDefeats: 0,
  totalEnemiesKilled: 0,
  totalGoldEarned: 0,
  highestWaveReached: 0,
  highestScore: 0,
  achievements: [],
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_victory',
    name: 'First Victory',
    description: 'Win your first game',
    condition: (p) => p.totalVictories >= 1,
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Play 10 games',
    condition: (p) => p.totalGamesPlayed >= VETERAN_GAMES_THRESHOLD,
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Win without losing any lives',
    condition: (p) => p.achievements.includes('perfectionist'),
  },
  {
    id: 'gold_hoarder',
    name: 'Gold Hoarder',
    description: 'Earn 10,000 total gold',
    condition: (p) => p.totalGoldEarned >= GOLD_HOARDER_THRESHOLD,
  },
  {
    id: 'exterminator',
    name: 'Exterminator',
    description: 'Kill 1,000 enemies',
    condition: (p) => p.totalEnemiesKilled >= EXTERMINATOR_KILLS_THRESHOLD,
  },
  {
    id: 'survivor',
    name: 'Survivor',
    description: 'Reach wave 20 in endless mode',
    condition: (p) => p.highestWaveReached >= SURVIVOR_WAVE_THRESHOLD,
  },
  {
    id: 'high_scorer',
    name: 'High Scorer',
    description: 'Score over 5,000 points',
    condition: (p) => p.highestScore >= HIGH_SCORER_THRESHOLD,
  },
  {
    id: 'dedicated',
    name: 'Dedicated',
    description: 'Win 25 games',
    condition: (p) => p.totalVictories >= DEDICATED_VICTORIES_THRESHOLD,
  },
];

@Injectable({ providedIn: 'root' })
export class PlayerProfileService {
  private profile: PlayerProfile;
  private unlockedSet: ReadonlySet<string> = new Set<string>();

  constructor() {
    this.profile = this.load();
    this.rebuildUnlockedSet();
  }

  getProfile(): PlayerProfile {
    return { ...this.profile, achievements: [...this.profile.achievements] };
  }

  /**
   * O(1) check whether an achievement is unlocked.
   * Uses a pre-computed Set that is rebuilt whenever achievements change.
   */
  isUnlocked(achievementId: string): boolean {
    return this.unlockedSet.has(achievementId);
  }

  /**
   * Updates all stats based on game results, checks all achievement conditions,
   * and saves. Returns IDs of newly unlocked achievements.
   */
  recordGameEnd(stats: GameEndStats): string[] {
    const alreadyUnlocked = new Set(this.profile.achievements);

    this.profile.totalGamesPlayed += 1;
    if (stats.isVictory) {
      this.profile.totalVictories += 1;
    } else {
      this.profile.totalDefeats += 1;
    }
    this.profile.totalEnemiesKilled += stats.enemiesKilled;
    this.profile.totalGoldEarned += stats.goldEarned;
    this.profile.highestWaveReached = Math.max(
      this.profile.highestWaveReached,
      stats.wavesCompleted
    );
    this.profile.highestScore = Math.max(
      this.profile.highestScore,
      stats.score
    );

    // Perfectionist must be injected into achievements before condition is checked,
    // because its condition reads achievements (self-referential).
    if (stats.isVictory && stats.livesLost === 0) {
      if (!alreadyUnlocked.has('perfectionist')) {
        this.profile.achievements.push('perfectionist');
      }
    }

    const newlyUnlocked: string[] = [];
    for (const achievement of ACHIEVEMENTS) {
      if (alreadyUnlocked.has(achievement.id)) continue;
      if (achievement.condition(this.profile)) {
        if (!this.profile.achievements.includes(achievement.id)) {
          this.profile.achievements.push(achievement.id);
        }
        newlyUnlocked.push(achievement.id);
      }
    }

    this.rebuildUnlockedSet();
    this.save();
    return newlyUnlocked;
  }

  getAchievements(): Achievement[] {
    return [...ACHIEVEMENTS];
  }

  getUnlockedAchievements(): Achievement[] {
    return ACHIEVEMENTS.filter((a) => this.unlockedSet.has(a.id));
  }

  getLockedAchievements(): Achievement[] {
    return ACHIEVEMENTS.filter((a) => !this.unlockedSet.has(a.id));
  }

  reset(): void {
    this.profile = { ...DEFAULT_PROFILE, achievements: [] };
    this.rebuildUnlockedSet();
    try {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
    } catch {
      // localStorage unavailable — silently fail
    }
  }

  private load(): PlayerProfile {
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PROFILE, achievements: [] };
      const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
      return {
        ...DEFAULT_PROFILE,
        ...parsed,
        achievements: Array.isArray(parsed.achievements)
          ? [...parsed.achievements]
          : [],
      };
    } catch {
      return { ...DEFAULT_PROFILE, achievements: [] };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
        console.warn('localStorage quota exceeded — player profile was not saved.');
      } else {
        console.warn('Failed to save player profile — localStorage may be unavailable:', error);
      }
    }
  }

  private rebuildUnlockedSet(): void {
    this.unlockedSet = new Set(this.profile.achievements);
  }
}
