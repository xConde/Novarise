import { Injectable } from '@angular/core';
import { MapScoreRecord } from '../../game/game-board/models/score.model';
import { DifficultyLevel } from '../../game/game-board/models/game-state.model';
import {
  Achievement,
  AchievementCategory,
  PlayerProfile,
  GameEndStats,
  ACHIEVEMENTS,
} from '../../game/game-board/models/achievement.model';
import { StorageService } from './storage.service';
import { RunState, RunStatus } from '../../run/models/run-state.model';

// Re-export everything so existing callers importing from this file continue to work.
export {
  Achievement,
  AchievementCategory,
  PlayerProfile,
  GameEndStats,
  ACHIEVEMENTS,
  TOWER_COLLECTOR_TYPE_COUNT,
} from '../../game/game-board/models/achievement.model';

const PROFILE_STORAGE_KEY = 'novarise-profile';

const DEFAULT_PROFILE: PlayerProfile = {
  totalGamesPlayed: 0,
  totalVictories: 0,
  totalDefeats: 0,
  totalEnemiesKilled: 0,
  totalGoldEarned: 0,
  highestWaveReached: 0,
  highestScore: 0,
  achievements: [],
  mapScores: {},
  towerKills: {},
  slowEffectsApplied: 0,
  hasUsedSpecialization: false,
  hasPlacedAllTowerTypes: false,
  maxModifiersUsedInVictory: 0,
  completedChallengeCount: 0,
  runsAttempted: 0,
  runsCompleted: 0,
  highestAscensionBeaten: 0,
  runTotalKills: 0,
  runBestScore: 0,
};

@Injectable({ providedIn: 'root' })
export class PlayerProfileService {
  private profile: PlayerProfile;
  /**
   * Per-session guard: prevents double-recording if `recordGameEnd()` is called
   * more than once (e.g., component re-render, stale subscription). Reset via
   * `resetSession()` at the start of each new game.
   */
  private gameEndRecordedThisSession = false;

  constructor(private storageService: StorageService) {
    this.profile = this.load();
  }

  getProfile(): PlayerProfile {
    return {
      ...this.profile,
      achievements: [...this.profile.achievements],
      towerKills: { ...this.profile.towerKills },
      mapScores: { ...this.profile.mapScores },
    };
  }

  /**
   * Updates all stats based on game results, checks all achievement conditions,
   * and saves. Returns IDs of newly unlocked achievements.
   *
   * Idempotent within a session: subsequent calls before `resetSession()` are
   * no-ops and return an empty array.
   */
  recordGameEnd(stats: GameEndStats): string[] {
    if (this.gameEndRecordedThisSession) return [];
    this.gameEndRecordedThisSession = true;

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

    // Merge per-tower kill counts
    if (stats.towerKills) {
      for (const [towerType, kills] of Object.entries(stats.towerKills)) {
        this.profile.towerKills[towerType] =
          (this.profile.towerKills[towerType] ?? 0) + kills;
      }
    }

    // Accumulate slow-effect applications
    if (stats.slowEffectsApplied != null && stats.slowEffectsApplied > 0) {
      this.profile.slowEffectsApplied += stats.slowEffectsApplied;
    }

    // One-way flags
    if (stats.usedSpecialization) {
      this.profile.hasUsedSpecialization = true;
    }
    if (stats.placedAllTowerTypes) {
      this.profile.hasPlacedAllTowerTypes = true;
    }

    // Track max modifiers on a victory
    if (stats.isVictory && stats.modifierCount != null) {
      this.profile.maxModifiersUsedInVictory = Math.max(
        this.profile.maxModifiersUsedInVictory,
        stats.modifierCount
      );
    }

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

    this.save();
    return newlyUnlocked;
  }

  recordMapScore(mapId: string, score: number, stars: number, difficulty: DifficultyLevel): void {
    const existing = this.profile.mapScores[mapId];
    if (!existing) {
      this.profile.mapScores[mapId] = {
        mapId,
        bestScore: score,
        bestStars: stars,
        difficulty,
        completedAt: Date.now(),
      };
      this.save();
      return;
    }

    let changed = false;

    if (score > existing.bestScore) {
      existing.bestScore = score;
      existing.difficulty = difficulty;
      existing.completedAt = Date.now();
      changed = true;
    }

    if (stars > existing.bestStars) {
      existing.bestStars = stars;
      changed = true;
    }

    if (changed) {
      this.save();
    }
  }

  recordChallengeCompleted(): void {
    this.profile.completedChallengeCount += 1;
    this.save();
  }

  /**
   * Record the end of a run.
   * Safe to call on victory, defeat, or abandon.
   */
  recordRun(runState: RunState): void {
    this.profile.runsAttempted += 1;
    if (runState.status === RunStatus.VICTORY) {
      this.profile.runsCompleted += 1;
      if (runState.ascensionLevel > this.profile.highestAscensionBeaten) {
        this.profile.highestAscensionBeaten = runState.ascensionLevel;
      }
    }
    const totalKills = runState.encounterResults.reduce((s, r) => s + r.enemiesKilled, 0);
    this.profile.runTotalKills += totalKills;
    if (runState.score > this.profile.runBestScore) {
      this.profile.runBestScore = runState.score;
    }
    this.save();
  }

  getMapScore(mapId: string): MapScoreRecord | null {
    const record = this.profile.mapScores[mapId];
    return record ? { ...record } : null;
  }

  getAllMapScores(): Record<string, MapScoreRecord> {
    const copy: Record<string, MapScoreRecord> = {};
    for (const [key, record] of Object.entries(this.profile.mapScores)) {
      copy[key] = { ...record };
    }
    return copy;
  }

  getAchievements(): Achievement[] {
    return [...ACHIEVEMENTS];
  }

  getAchievementsByCategory(category: AchievementCategory): Achievement[] {
    return ACHIEVEMENTS.filter((a) => a.category === category);
  }

  getUnlockedAchievements(): Achievement[] {
    return ACHIEVEMENTS.filter((a) =>
      this.profile.achievements.includes(a.id)
    );
  }

  getLockedAchievements(): Achievement[] {
    return ACHIEVEMENTS.filter(
      (a) => !this.profile.achievements.includes(a.id)
    );
  }

  reset(): void {
    this.profile = {
      ...DEFAULT_PROFILE,
      achievements: [],
      mapScores: {},
      towerKills: {},
    };
    this.storageService.remove(PROFILE_STORAGE_KEY);
    this.gameEndRecordedThisSession = false;
  }

  /**
   * Clears the per-session idempotency guard so `recordGameEnd()` will accept
   * the next call. Call from `GameSessionService.resetAllServices()` at the
   * start of every new game.
   */
  resetSession(): void {
    this.gameEndRecordedThisSession = false;
  }

  private load(): PlayerProfile {
    const empty = { ...DEFAULT_PROFILE, achievements: [], mapScores: {}, towerKills: {} };
    const parsed = this.storageService.getJSON<Partial<PlayerProfile>>(PROFILE_STORAGE_KEY, empty);
    if (parsed === empty) return empty;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      achievements: Array.isArray(parsed.achievements)
        ? [...parsed.achievements].slice(0, ACHIEVEMENTS.length + 10)
        : [],
      mapScores: (parsed.mapScores && typeof parsed.mapScores === 'object' && !Array.isArray(parsed.mapScores))
        ? { ...parsed.mapScores as Record<string, MapScoreRecord> }
        : {},
      // Migration: new fields default if absent from old profiles
      towerKills: (parsed.towerKills && typeof parsed.towerKills === 'object' && !Array.isArray(parsed.towerKills))
        ? { ...parsed.towerKills as Record<string, number> }
        : {},
      slowEffectsApplied: typeof parsed.slowEffectsApplied === 'number' ? parsed.slowEffectsApplied : 0,
      hasUsedSpecialization: typeof parsed.hasUsedSpecialization === 'boolean' ? parsed.hasUsedSpecialization : false,
      hasPlacedAllTowerTypes: typeof parsed.hasPlacedAllTowerTypes === 'boolean' ? parsed.hasPlacedAllTowerTypes : false,
      maxModifiersUsedInVictory: typeof parsed.maxModifiersUsedInVictory === 'number' ? parsed.maxModifiersUsedInVictory : 0,
      completedChallengeCount: typeof parsed.completedChallengeCount === 'number' ? parsed.completedChallengeCount : 0,
      // Migration: run stats — prefer new field names, fall back to pre-pivot ascent* names
      runsAttempted: typeof parsed.runsAttempted === 'number' ? parsed.runsAttempted
        : typeof (parsed as Record<string, unknown>)['ascentRunsAttempted'] === 'number' ? (parsed as Record<string, unknown>)['ascentRunsAttempted'] as number : 0,
      runsCompleted: typeof parsed.runsCompleted === 'number' ? parsed.runsCompleted
        : typeof (parsed as Record<string, unknown>)['ascentRunsCompleted'] === 'number' ? (parsed as Record<string, unknown>)['ascentRunsCompleted'] as number : 0,
      highestAscensionBeaten: typeof parsed.highestAscensionBeaten === 'number' ? parsed.highestAscensionBeaten : 0,
      runTotalKills: typeof parsed.runTotalKills === 'number' ? parsed.runTotalKills
        : typeof (parsed as Record<string, unknown>)['ascentTotalKills'] === 'number' ? (parsed as Record<string, unknown>)['ascentTotalKills'] as number : 0,
      runBestScore: typeof parsed.runBestScore === 'number' ? parsed.runBestScore
        : typeof (parsed as Record<string, unknown>)['ascentBestScore'] === 'number' ? (parsed as Record<string, unknown>)['ascentBestScore'] as number : 0,
    };
  }

  private save(): void {
    this.storageService.setJSON(PROFILE_STORAGE_KEY, this.profile);
  }
}
