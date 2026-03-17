import { MapScoreRecord } from './score.model';

// ── Interfaces ────────────────────────────────────────────────────────────────

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

// ── Achievement condition thresholds — existing ───────────────────────────────

export const VETERAN_GAMES_THRESHOLD = 10;
export const GOLD_HOARDER_THRESHOLD = 10_000;
export const EXTERMINATOR_KILLS_THRESHOLD = 1_000;
export const SURVIVOR_WAVE_THRESHOLD = 20;
export const HIGH_SCORER_THRESHOLD = 5_000;
export const DEDICATED_VICTORIES_THRESHOLD = 25;

// ── Achievement condition thresholds — campaign ───────────────────────────────

export const ACT_1_MAP_IDS = ['campaign_01', 'campaign_02', 'campaign_03', 'campaign_04'] as const;
export const ACT_2_MAP_IDS = ['campaign_05', 'campaign_06', 'campaign_07', 'campaign_08'] as const;
export const ACT_3_MAP_IDS = ['campaign_09', 'campaign_10', 'campaign_11', 'campaign_12'] as const;
export const ALL_CAMPAIGN_MAP_COUNT = 16;
export const STAR_COLLECTOR_THRESHOLD = 10;
export const THREE_STAR_MAPS_THRESHOLD = 5;
export const CAMPAIGN_CHAMPION_MAP_IDS: string[] = Array.from(
  { length: ALL_CAMPAIGN_MAP_COUNT },
  (_, i) => `campaign_${String(i + 1).padStart(2, '0')}`
);

// ── Achievement condition thresholds — combat ─────────────────────────────────

export const SNIPER_ELITE_KILLS_THRESHOLD = 500;
export const CHAIN_MASTER_KILLS_THRESHOLD = 300;
export const SLOW_STEADY_APPLICATIONS_THRESHOLD = 1_000;
export const TOWER_COLLECTOR_TYPE_COUNT = 6;

// ── Achievement condition thresholds — endless ────────────────────────────────

export const ENDLESS_ENDURANCE_WAVE = 30;
export const ENDLESS_MARATHON_WAVE = 50;
export const ENDLESS_IMMORTAL_WAVE = 100;

// ── Achievement condition thresholds — challenge ──────────────────────────────

export const CHALLENGER_COMPLETIONS_THRESHOLD = 5;
export const TOTAL_CAMPAIGN_CHALLENGES = 41;
export const MODIFIER_VICTORY_THRESHOLD = 3;

// ── Helper functions ──────────────────────────────────────────────────────────

export function mapCompleted(profile: PlayerProfile, mapId: string): boolean {
  const record = profile.mapScores[mapId];
  return record != null && record.bestStars > 0;
}

export function allMapsCompleted(profile: PlayerProfile, mapIds: readonly string[]): boolean {
  return mapIds.every((id) => mapCompleted(profile, id));
}

export function countThreeStarCampaignMaps(profile: PlayerProfile): number {
  return Object.values(profile.mapScores)
    .filter((r) => r.mapId.startsWith('campaign_') && r.bestStars >= 3).length;
}

export function totalCampaignStars(profile: PlayerProfile): number {
  return Object.values(profile.mapScores)
    .filter((r) => r.mapId.startsWith('campaign_'))
    .reduce((sum, r) => sum + r.bestStars, 0);
}

// ── ACHIEVEMENTS array (26 entries) ──────────────────────────────────────────

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
    condition: (p) => countThreeStarCampaignMaps(p) >= THREE_STAR_MAPS_THRESHOLD,
  },
  {
    id: 'three_star_all',
    name: 'Flawless',
    description: 'Earn 3 stars on all 16 campaign maps',
    category: 'campaign',
    condition: (p) =>
      allMapsCompleted(p, CAMPAIGN_CHAMPION_MAP_IDS) &&
      countThreeStarCampaignMaps(p) >= ALL_CAMPAIGN_MAP_COUNT,
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
    // All 41 challenges across 16 campaign levels
    condition: (p) => p.completedChallengeCount >= TOTAL_CAMPAIGN_CHALLENGES,
  },
  {
    id: 'modifier_victory',
    name: 'Modified',
    description: 'Win with at least 3 modifiers active',
    category: 'challenge',
    condition: (p) => p.maxModifiersUsedInVictory >= MODIFIER_VICTORY_THRESHOLD,
  },
];

