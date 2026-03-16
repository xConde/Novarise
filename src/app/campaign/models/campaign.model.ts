export enum CampaignTier {
  INTRO = 'intro',      // Maps 1-4
  EARLY = 'early',      // Maps 5-8
  MID = 'mid',          // Maps 9-12
  LATE = 'late',        // Maps 13-14
  ENDGAME = 'endgame'   // Maps 15-16
}

export interface CampaignLevel {
  id: string;             // 'campaign_01' through 'campaign_16'
  number: number;         // 1-16
  name: string;
  description: string;
  tier: CampaignTier;
  gridSize: number;       // map dimensions
  spawnerCount: number;   // how many spawners
  exitCount: number;      // how many exits
  waveCount: number;      // number of waves
  parScore: number;       // target score for reference
  unlockRequirement: UnlockRequirement;
}

export interface UnlockRequirement {
  type: 'none' | 'level_complete' | 'stars_total';
  levelId?: string;         // for level_complete
  starsRequired?: number;   // for stars_total
}

export interface CampaignLevelProgress {
  bestScore: number;
  bestStars: number;    // 0-3
  difficulty: string;   // DifficultyLevel value
  completedAt: number;  // timestamp
}

export interface CampaignProgress {
  completedLevels: Record<string, CampaignLevelProgress>;
}

/** Total number of campaign levels. */
export const CAMPAIGN_LEVEL_COUNT = 16;

/** Stars required to unlock the Mid tier (Maps 9-12). */
export const CAMPAIGN_MID_STARS_REQUIRED = 12;

/** Stars required to unlock the Late tier (Maps 13-14). */
export const CAMPAIGN_LATE_STARS_REQUIRED = 24;

/** Stars required to unlock the Endgame tier (Maps 15-16). */
export const CAMPAIGN_ENDGAME_STARS_REQUIRED = 30;

/** Level metadata for all 16 campaign levels. Map templates added in Sprints 3-6. */
export const CAMPAIGN_LEVELS: CampaignLevel[] = [
  // Tier: INTRO (Maps 1-4)
  {
    id: 'campaign_01',
    number: 1,
    name: 'First Light',
    description: 'A straight path. Learn to place towers and survive.',
    tier: CampaignTier.INTRO,
    gridSize: 10,
    spawnerCount: 1,
    exitCount: 1,
    waveCount: 6,
    parScore: 500,
    unlockRequirement: { type: 'none' },
  },
  {
    id: 'campaign_02',
    number: 2,
    name: 'The Bend',
    description: 'The path turns. Range and positioning matter.',
    tier: CampaignTier.INTRO,
    gridSize: 10,
    spawnerCount: 1,
    exitCount: 1,
    waveCount: 7,
    parScore: 750,
    unlockRequirement: { type: 'level_complete', levelId: 'campaign_01' },
  },
  {
    id: 'campaign_03',
    number: 3,
    name: 'Serpentine',
    description: 'A winding road gives you time — if you spend gold wisely.',
    tier: CampaignTier.INTRO,
    gridSize: 12,
    spawnerCount: 1,
    exitCount: 1,
    waveCount: 8,
    parScore: 1000,
    unlockRequirement: { type: 'level_complete', levelId: 'campaign_02' },
  },
  {
    id: 'campaign_04',
    number: 4,
    name: 'The Fork',
    description: 'Two paths diverge. Can you cover both?',
    tier: CampaignTier.INTRO,
    gridSize: 12,
    spawnerCount: 1,
    exitCount: 2,
    waveCount: 8,
    parScore: 1200,
    unlockRequirement: { type: 'level_complete', levelId: 'campaign_03' },
  },

  // Tier: EARLY (Maps 5-8)
  {
    id: 'campaign_05',
    number: 5,
    name: 'Twin Gates',
    description: 'Enemies pour in from two sides. Divide and conquer.',
    tier: CampaignTier.EARLY,
    gridSize: 12,
    spawnerCount: 2,
    exitCount: 1,
    waveCount: 8,
    parScore: 1500,
    unlockRequirement: { type: 'level_complete', levelId: 'campaign_04' },
  },
  {
    id: 'campaign_06',
    number: 6,
    name: 'Open Ground',
    description: 'No walls. Build your own maze.',
    tier: CampaignTier.EARLY,
    gridSize: 14,
    spawnerCount: 1,
    exitCount: 1,
    waveCount: 9,
    parScore: 1800,
    unlockRequirement: { type: 'level_complete', levelId: 'campaign_05' },
  },
  {
    id: 'campaign_07',
    number: 7,
    name: 'The Narrows',
    description: 'A tight chokepoint. Every shot counts.',
    tier: CampaignTier.EARLY,
    gridSize: 14,
    spawnerCount: 1,
    exitCount: 1,
    waveCount: 9,
    parScore: 2000,
    unlockRequirement: { type: 'level_complete', levelId: 'campaign_06' },
  },
  {
    id: 'campaign_08',
    number: 8,
    name: 'Crystal Maze',
    description: 'Navigate the labyrinth. Enemies always find the shortest path.',
    tier: CampaignTier.EARLY,
    gridSize: 14,
    spawnerCount: 1,
    exitCount: 1,
    waveCount: 10,
    parScore: 2500,
    unlockRequirement: { type: 'level_complete', levelId: 'campaign_07' },
  },

  // Tier: MID (Maps 9-12)
  {
    id: 'campaign_09',
    number: 9,
    name: 'Crossfire',
    description: 'Dual spawners, dual exits. Paths cross — chaos ensues.',
    tier: CampaignTier.MID,
    gridSize: 15,
    spawnerCount: 2,
    exitCount: 2,
    waveCount: 10,
    parScore: 3000,
    unlockRequirement: { type: 'stars_total', starsRequired: CAMPAIGN_MID_STARS_REQUIRED },
  },
  {
    id: 'campaign_10',
    number: 10,
    name: 'The Spiral',
    description: 'A long spiral path with limited build space.',
    tier: CampaignTier.MID,
    gridSize: 15,
    spawnerCount: 1,
    exitCount: 1,
    waveCount: 10,
    parScore: 3500,
    unlockRequirement: { type: 'level_complete', levelId: 'campaign_09' },
  },
  {
    id: 'campaign_11',
    number: 11,
    name: 'Siege',
    description: 'Three fronts converge on your base. Hold the line.',
    tier: CampaignTier.MID,
    gridSize: 16,
    spawnerCount: 3,
    exitCount: 1,
    waveCount: 10,
    parScore: 4000,
    unlockRequirement: { type: 'level_complete', levelId: 'campaign_10' },
  },
  {
    id: 'campaign_12',
    number: 12,
    name: 'Labyrinth',
    description: 'A complex maze with many routes. Tower placement redirects traffic.',
    tier: CampaignTier.MID,
    gridSize: 16,
    spawnerCount: 1,
    exitCount: 1,
    waveCount: 10,
    parScore: 4500,
    unlockRequirement: { type: 'level_complete', levelId: 'campaign_11' },
  },

  // Tier: LATE (Maps 13-14)
  {
    id: 'campaign_13',
    number: 13,
    name: 'Fortress',
    description: 'Defend your stronghold from all directions.',
    tier: CampaignTier.LATE,
    gridSize: 18,
    spawnerCount: 4,
    exitCount: 1,
    waveCount: 10,
    parScore: 5000,
    unlockRequirement: { type: 'stars_total', starsRequired: CAMPAIGN_LATE_STARS_REQUIRED },
  },
  {
    id: 'campaign_14',
    number: 14,
    name: 'The Gauntlet',
    description: 'A long, winding path with minimal build spots. Efficiency is survival.',
    tier: CampaignTier.LATE,
    gridSize: 18,
    spawnerCount: 1,
    exitCount: 1,
    waveCount: 10,
    parScore: 5500,
    unlockRequirement: { type: 'level_complete', levelId: 'campaign_13' },
  },

  // Tier: ENDGAME (Maps 15-16)
  {
    id: 'campaign_15',
    number: 15,
    name: 'Storm',
    description: 'Four spawners. Two exits. Relentless waves. Prepare for war.',
    tier: CampaignTier.ENDGAME,
    gridSize: 20,
    spawnerCount: 4,
    exitCount: 2,
    waveCount: 12,
    parScore: 7000,
    unlockRequirement: { type: 'stars_total', starsRequired: CAMPAIGN_ENDGAME_STARS_REQUIRED },
  },
  {
    id: 'campaign_16',
    number: 16,
    name: 'Novarise',
    description: 'The ultimate challenge. Everything you have learned — you will need it all.',
    tier: CampaignTier.ENDGAME,
    gridSize: 20,
    spawnerCount: 4,
    exitCount: 4,
    waveCount: 12,
    parScore: 10000,
    unlockRequirement: { type: 'level_complete', levelId: 'campaign_15' },
  },
];
