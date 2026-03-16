import { Injectable } from '@angular/core';
import { MapScoreRecord } from '../models/score.model';
import { DifficultyLevel } from '../models/game-state.model';

const PROFILE_STORAGE_KEY = 'novarise-profile';

// Achievement condition thresholds — existing
const VETERAN_GAMES_THRESHOLD = 10;
const GOLD_HOARDER_THRESHOLD = 10_000;
const EXTERMINATOR_KILLS_THRESHOLD = 1_000;
const SURVIVOR_WAVE_THRESHOLD = 20;
const HIGH_SCORER_THRESHOLD = 5_000;
const DEDICATED_VICTORIES_THRESHOLD = 25;

// Achievement condition thresholds — campaign
const ACT_1_MAP_IDS = ['campaign_01', 'campaign_02', 'campaign_03', 'campaign_04'] as const;
const ACT_2_MAP_IDS = ['campaign_05', 'campaign_06', 'campaign_07', 'campaign_08'] as const;
const ACT_3_MAP_IDS = ['campaign_09', 'campaign_10', 'campaign_11', 'campaign_12'] as const;
const ALL_CAMPAIGN_MAP_COUNT = 16;
const STAR_COLLECTOR_THRESHOLD = 10;
const THREE_STAR_MAPS_THRESHOLD = 5;
const CAMPAIGN_CHAMPION_MAP_IDS: string[] = Array.from(
  { length: ALL_CAMPAIGN_MAP_COUNT },
  (_, i) => `campaign_${String(i + 1).padStart(2, '0')}`
);

// Achievement condition thresholds — combat
const SNIPER_ELITE_KILLS_THRESHOLD = 500;
const CHAIN_MASTER_KILLS_THRESHOLD = 300;
const SLOW_STEADY_APPLICATIONS_THRESHOLD = 1_000;
const TOWER_COLLECTOR_TYPE_COUNT = 6;

// Achievement condition thresholds — endless
const ENDLESS_ENDURANCE_WAVE = 30;
const ENDLESS_MARATHON_WAVE = 50;
const ENDLESS_IMMORTAL_WAVE = 100;

// Achievement condition thresholds — challenge
const CHALLENGER_COMPLETIONS_THRESHOLD = 5;
const MODIFIER_VICTORY_THRESHOLD = 3;

export type AchievementCategory = 'campaign' | 'combat' | 'endless' | 'challenge';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  condition: (profile: PlayerProfile) => boolean;
}

export interface PlayerProfile {
  totalGamesPlayed: number;
  totalVictories: number;
  totalDefeats: number;
  totalEnemiesKilled: number;
  totalGoldEarned: number;
  highestWaveReached: number;
  highestScore: number;
  achievements: string[]; // IDs of unlocked achievements
  mapScores: Record<string, MapScoreRecord>; // keyed by mapId
  // Combat tracking
  towerKills: Record<string, number>; // keyed by TowerType string value
  slowEffectsApplied: number;
  hasUsedSpecialization: boolean;
  hasPlacedAllTowerTypes: boolean;
  maxModifiersUsedInVictory: number;
  // Challenge tracking
  completedChallengeCount: number;
}

export interface GameEndStats {
  isVictory: boolean;
  score: number;
  enemiesKilled: number;
  goldEarned: number;
  wavesCompleted: number;
  livesLost: number;
  // New optional fields
  towerKills?: Record<string, number>;
  modifierCount?: number;
  usedSpecialization?: boolean;
  placedAllTowerTypes?: boolean;
  slowEffectsApplied?: number;
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
  mapScores: {},
  towerKills: {},
  slowEffectsApplied: 0,
  hasUsedSpecialization: false,
  hasPlacedAllTowerTypes: false,
  maxModifiersUsedInVictory: 0,
  completedChallengeCount: 0,
};

function mapCompleted(profile: PlayerProfile, mapId: string): boolean {
  const record = profile.mapScores[mapId];
  return record != null && record.bestStars > 0;
}

function allMapsCompleted(profile: PlayerProfile, mapIds: readonly string[]): boolean {
  return mapIds.every((id) => mapCompleted(profile, id));
}

function countThreeStarMaps(profile: PlayerProfile): number {
  return Object.values(profile.mapScores).filter((r) => r.bestStars >= 3).length;
}

function totalCampaignStars(profile: PlayerProfile): number {
  return Object.values(profile.mapScores)
    .filter((r) => r.mapId.startsWith('campaign_'))
    .reduce((sum, r) => sum + r.bestStars, 0);
}

export const ACHIEVEMENTS: Achievement[] = [
  // ── Combat (existing 8, category added) ───────────────────────────────────
  {
    id: 'first_victory',
    name: 'First Victory',
    description: 'Win your first game',
    category: 'combat',
    condition: (p) => p.totalVictories >= 1,
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Play 10 games',
    category: 'combat',
    condition: (p) => p.totalGamesPlayed >= VETERAN_GAMES_THRESHOLD,
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Win without losing any lives',
    category: 'combat',
    condition: (p) => p.achievements.includes('perfectionist'),
  },
  {
    id: 'gold_hoarder',
    name: 'Gold Hoarder',
    description: 'Earn 10,000 total gold',
    category: 'combat',
    condition: (p) => p.totalGoldEarned >= GOLD_HOARDER_THRESHOLD,
  },
  {
    id: 'exterminator',
    name: 'Exterminator',
    description: 'Kill 1,000 enemies',
    category: 'combat',
    condition: (p) => p.totalEnemiesKilled >= EXTERMINATOR_KILLS_THRESHOLD,
  },
  {
    id: 'survivor',
    name: 'Survivor',
    description: 'Reach wave 20 in endless mode',
    category: 'endless',
    condition: (p) => p.highestWaveReached >= SURVIVOR_WAVE_THRESHOLD,
  },
  {
    id: 'high_scorer',
    name: 'High Scorer',
    description: 'Score over 5,000 points',
    category: 'combat',
    condition: (p) => p.highestScore >= HIGH_SCORER_THRESHOLD,
  },
  {
    id: 'dedicated',
    name: 'Dedicated',
    description: 'Win 25 games',
    category: 'combat',
    condition: (p) => p.totalVictories >= DEDICATED_VICTORIES_THRESHOLD,
  },

  // ── Campaign achievements ──────────────────────────────────────────────────
  {
    id: 'act_1_complete',
    name: 'Act I',
    description: 'Complete campaign maps 1-4',
    category: 'campaign',
    condition: (p) => allMapsCompleted(p, ACT_1_MAP_IDS),
  },
  {
    id: 'act_2_complete',
    name: 'Act II',
    description: 'Complete campaign maps 5-8',
    category: 'campaign',
    condition: (p) => allMapsCompleted(p, ACT_2_MAP_IDS),
  },
  {
    id: 'act_3_complete',
    name: 'Act III',
    description: 'Complete campaign maps 9-12',
    category: 'campaign',
    condition: (p) => allMapsCompleted(p, ACT_3_MAP_IDS),
  },
  {
    id: 'campaign_champion',
    name: 'Novarise Champion',
    description: 'Complete all 16 campaign maps',
    category: 'campaign',
    condition: (p) => allMapsCompleted(p, CAMPAIGN_CHAMPION_MAP_IDS),
  },
  {
    id: 'star_collector',
    name: 'Star Collector',
    description: 'Earn 10 total stars across campaign',
    category: 'campaign',
    condition: (p) => totalCampaignStars(p) >= STAR_COLLECTOR_THRESHOLD,
  },
  {
    id: 'three_star_5',
    name: 'Perfectionist+',
    description: 'Earn 3 stars on 5 different maps',
    category: 'campaign',
    condition: (p) => countThreeStarMaps(p) >= THREE_STAR_MAPS_THRESHOLD,
  },
  {
    id: 'three_star_all',
    name: 'Flawless',
    description: 'Earn 3 stars on all 16 campaign maps',
    category: 'campaign',
    condition: (p) => allMapsCompleted(p, CAMPAIGN_CHAMPION_MAP_IDS) &&
      countThreeStarMaps(p) >= ALL_CAMPAIGN_MAP_COUNT,
  },

  // ── Combat achievements (new) ──────────────────────────────────────────────
  {
    id: 'sniper_elite',
    name: 'Sniper Elite',
    description: 'Kill 500 enemies with Sniper towers',
    category: 'combat',
    condition: (p) => (p.towerKills['sniper'] ?? 0) >= SNIPER_ELITE_KILLS_THRESHOLD,
  },
  {
    id: 'chain_master',
    name: 'Chain Master',
    description: 'Kill 300 enemies with Chain towers',
    category: 'combat',
    condition: (p) => (p.towerKills['chain'] ?? 0) >= CHAIN_MASTER_KILLS_THRESHOLD,
  },
  {
    id: 'slow_and_steady',
    name: 'Slow and Steady',
    description: 'Apply Slow effect 1,000 times',
    category: 'combat',
    condition: (p) => p.slowEffectsApplied >= SLOW_STEADY_APPLICATIONS_THRESHOLD,
  },
  {
    id: 'specialist',
    name: 'Specialist',
    description: 'Use a Level 3 specialization in combat',
    category: 'combat',
    condition: (p) => p.hasUsedSpecialization,
  },
  {
    id: 'tower_collector',
    name: 'Tower Collector',
    description: 'Place all 6 tower types in a single game',
    category: 'combat',
    condition: (p) => p.hasPlacedAllTowerTypes,
  },

  // ── Endless achievements ───────────────────────────────────────────────────
  {
    id: 'endless_30',
    name: 'Endurance',
    description: 'Reach wave 30 in endless mode',
    category: 'endless',
    condition: (p) => p.highestWaveReached >= ENDLESS_ENDURANCE_WAVE,
  },
  {
    id: 'endless_50',
    name: 'Marathon',
    description: 'Reach wave 50 in endless mode',
    category: 'endless',
    condition: (p) => p.highestWaveReached >= ENDLESS_MARATHON_WAVE,
  },
  {
    id: 'endless_100',
    name: 'Immortal',
    description: 'Reach wave 100 in endless mode',
    category: 'endless',
    condition: (p) => p.highestWaveReached >= ENDLESS_IMMORTAL_WAVE,
  },

  // ── Challenge achievements ─────────────────────────────────────────────────
  {
    id: 'challenger_5',
    name: 'Challenger',
    description: 'Complete 5 challenges',
    category: 'challenge',
    condition: (p) => p.completedChallengeCount >= CHALLENGER_COMPLETIONS_THRESHOLD,
  },
  {
    id: 'challenger_all',
    name: 'Challenge Master',
    description: 'Complete all challenges',
    category: 'challenge',
    // 16 campaign levels × challenges — condition driven by completedChallengeCount
    condition: (p) => p.completedChallengeCount >= ALL_CAMPAIGN_MAP_COUNT,
  },
  {
    id: 'modifier_victory',
    name: 'Modified',
    description: 'Win with at least 3 modifiers active',
    category: 'challenge',
    condition: (p) => p.maxModifiersUsedInVictory >= MODIFIER_VICTORY_THRESHOLD,
  },
];

@Injectable({ providedIn: 'root' })
export class PlayerProfileService {
  private profile: PlayerProfile;

  constructor() {
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
    if (!existing || score > existing.bestScore) {
      this.profile.mapScores[mapId] = {
        mapId,
        bestScore: score,
        bestStars: Math.max(stars, existing?.bestStars ?? 0),
        difficulty,
        completedAt: Date.now(),
      };
      this.save();
    }
  }

  recordChallengeCompleted(): void {
    this.profile.completedChallengeCount += 1;
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
    try {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
    } catch {
      // localStorage unavailable — silently fail
    }
  }

  private load(): PlayerProfile {
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PROFILE, achievements: [], mapScores: {}, towerKills: {} };
      const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
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
      };
    } catch {
      return { ...DEFAULT_PROFILE, achievements: [], mapScores: {}, towerKills: {} };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
    } catch {
      // localStorage full or unavailable — silently fail
    }
  }
}
