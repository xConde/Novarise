import { Injectable } from '@angular/core';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { DifficultyLevel } from '../game-board/models/game-state.model';

const CAMPAIGN_STORAGE_KEY = 'novarise-campaign';
const CAMPAIGN_VERSION = '1.0.0';
const CAMPAIGN_GRID_SIZE = 25;

export interface CampaignLevel {
  id: number;
  name: string;
  description: string;
  difficulty: DifficultyLevel;
  mapBuilder: () => TerrainGridState;
}

export interface CampaignProgress {
  unlockedLevel: number; // highest unlocked level (1-indexed)
  stars: Record<number, number>; // levelId -> star count (0-3)
  bestScores: Record<number, number>; // levelId -> best score
}

const DEFAULT_PROGRESS: CampaignProgress = {
  unlockedLevel: 1,
  stars: {},
  bestScores: {},
};

// ---------------------------------------------------------------------------
// Map-building helpers (mirrors map-template.service.ts patterns)
// ---------------------------------------------------------------------------

function createEmptyGrid(): TerrainGridState {
  const tiles: TerrainType[][] = [];
  const heightMap: number[][] = [];
  const size = CAMPAIGN_GRID_SIZE;

  for (let x = 0; x < size; x++) {
    tiles[x] = [];
    heightMap[x] = [];
    for (let z = 0; z < size; z++) {
      tiles[x][z] = TerrainType.ABYSS;
      heightMap[x][z] = 0;
    }
  }

  return {
    gridSize: size,
    tiles,
    heightMap,
    spawnPoint: null,
    exitPoint: null,
    version: CAMPAIGN_VERSION,
  };
}

function paintH(tiles: TerrainType[][], z: number, x0: number, x1: number): void {
  for (let x = x0; x <= x1; x++) {
    tiles[x][z] = TerrainType.BEDROCK;
  }
}

function paintV(tiles: TerrainType[][], x: number, z0: number, z1: number): void {
  const lo = Math.min(z0, z1);
  const hi = Math.max(z0, z1);
  for (let z = lo; z <= hi; z++) {
    tiles[x][z] = TerrainType.BEDROCK;
  }
}

// ---------------------------------------------------------------------------
// Level 1 — "The Gauntlet" (Easy)
// Straight horizontal path at z=12, spawn x=0, exit x=24.
// Wide open flanks for towers — forgiving for new players.
// ---------------------------------------------------------------------------
function buildGauntlet(): TerrainGridState {
  const state = createEmptyGrid();
  const midZ = Math.floor(CAMPAIGN_GRID_SIZE / 2); // 12

  paintH(state.tiles, midZ, 0, CAMPAIGN_GRID_SIZE - 1);

  state.spawnPoint = { x: 0, z: midZ };
  state.exitPoint = { x: CAMPAIGN_GRID_SIZE - 1, z: midZ };

  return state;
}

// ---------------------------------------------------------------------------
// Level 2 — "Serpent's Pass" (Easy)
// S-curve with 3 turns. Three horizontal legs connected vertically.
// Leg 1 z=4 x=0..16, turn at x=16 z=4..12, leg 2 z=12 x=8..16,
// turn at x=8 z=12..20, leg 3 z=20 x=8..24.
// ---------------------------------------------------------------------------
function buildSerpentsPass(): TerrainGridState {
  const state = createEmptyGrid();
  const { tiles } = state;

  paintH(tiles, 4, 0, 16);
  paintV(tiles, 16, 4, 12);
  paintH(tiles, 12, 8, 16);
  paintV(tiles, 8, 12, 20);
  paintH(tiles, 20, 8, CAMPAIGN_GRID_SIZE - 1);

  state.spawnPoint = { x: 0, z: 4 };
  state.exitPoint = { x: CAMPAIGN_GRID_SIZE - 1, z: 20 };

  return state;
}

// ---------------------------------------------------------------------------
// Level 3 — "Crossroads" (Normal)
// Two separate paths from spawn to exit — forces defenders to cover both.
// Top path: z=6 from x=0..24.
// Bottom path: z=18 from x=0..24.
// Both share a single spawn (x=0, z=12) via vertical connector and
// a single exit (x=24, z=12) via vertical connector.
// ---------------------------------------------------------------------------
function buildCrossroads(): TerrainGridState {
  const state = createEmptyGrid();
  const { tiles } = state;

  // Spawn connector — vertical x=0 z=6..18
  paintV(tiles, 0, 6, 18);
  // Top path
  paintH(tiles, 6, 0, CAMPAIGN_GRID_SIZE - 1);
  // Bottom path
  paintH(tiles, 18, 0, CAMPAIGN_GRID_SIZE - 1);
  // Exit connector — vertical x=24 z=6..18
  paintV(tiles, CAMPAIGN_GRID_SIZE - 1, 6, 18);

  state.spawnPoint = { x: 0, z: 12 };
  state.exitPoint = { x: CAMPAIGN_GRID_SIZE - 1, z: 12 };

  return state;
}

// ---------------------------------------------------------------------------
// Level 4 — "The Labyrinth" (Hard)
// Complex winding maze with many turns and tight chokepoints.
// ---------------------------------------------------------------------------
function buildLabyrinth(): TerrainGridState {
  const state = createEmptyGrid();
  const { tiles } = state;

  // Segment 1: horizontal top row x=0..20, z=2
  paintH(tiles, 2, 0, 20);
  // Turn down x=20, z=2..8
  paintV(tiles, 20, 2, 8);
  // Segment 2: horizontal x=8..20, z=8
  paintH(tiles, 8, 8, 20);
  // Turn down x=8, z=8..14
  paintV(tiles, 8, 8, 14);
  // Segment 3: horizontal x=8..22, z=14
  paintH(tiles, 14, 8, 22);
  // Turn down x=22, z=14..20
  paintV(tiles, 22, 14, 20);
  // Segment 4: horizontal x=4..22, z=20
  paintH(tiles, 20, 4, 22);
  // Turn up x=4, z=16..20
  paintV(tiles, 4, 16, 20);
  // Final leg x=4..24, z=16 — exit on right edge
  paintH(tiles, 16, 4, CAMPAIGN_GRID_SIZE - 1);

  state.spawnPoint = { x: 0, z: 2 };
  state.exitPoint = { x: CAMPAIGN_GRID_SIZE - 1, z: 16 };

  return state;
}

// ---------------------------------------------------------------------------
// Level 5 — "Fortress" (Nightmare)
// Open field — all BEDROCK, enemies can pick any route. No natural chokepoints.
// Players must create their own defensive structure.
// ---------------------------------------------------------------------------
function buildFortress(): TerrainGridState {
  const size = CAMPAIGN_GRID_SIZE;
  const tiles: TerrainType[][] = [];
  const heightMap: number[][] = [];

  for (let x = 0; x < size; x++) {
    tiles[x] = [];
    heightMap[x] = [];
    for (let z = 0; z < size; z++) {
      tiles[x][z] = TerrainType.BEDROCK;
      heightMap[x][z] = 0;
    }
  }

  const midZ = Math.floor(size / 2); // 12

  return {
    gridSize: size,
    tiles,
    heightMap,
    spawnPoint: { x: 0, z: midZ },
    exitPoint: { x: size - 1, z: midZ },
    version: CAMPAIGN_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class CampaignService {
  private levels: CampaignLevel[];
  private progress: CampaignProgress;

  constructor() {
    this.levels = this.buildLevels();
    this.progress = this.loadProgress();
  }

  getLevels(): CampaignLevel[] {
    return this.levels;
  }

  getProgress(): CampaignProgress {
    return {
      ...this.progress,
      stars: { ...this.progress.stars },
      bestScores: { ...this.progress.bestScores },
    };
  }

  isLevelUnlocked(levelId: number): boolean {
    return levelId <= this.progress.unlockedLevel;
  }

  completeLevel(levelId: number, stars: number, score: number): void {
    // Keep best stars — never downgrade
    this.progress.stars[levelId] = Math.max(
      this.progress.stars[levelId] ?? 0,
      stars
    );
    // Keep best score
    this.progress.bestScores[levelId] = Math.max(
      this.progress.bestScores[levelId] ?? 0,
      score
    );
    // Unlock next level (only advance forward, never regress)
    if (levelId >= this.progress.unlockedLevel && levelId < this.levels.length) {
      this.progress.unlockedLevel = levelId + 1;
    }
    this.saveProgress();
  }

  getMapForLevel(levelId: number): TerrainGridState | null {
    const level = this.levels.find(l => l.id === levelId);
    return level ? level.mapBuilder() : null;
  }

  resetProgress(): void {
    this.progress = { ...DEFAULT_PROGRESS, stars: {}, bestScores: {} };
    this.saveProgress();
  }

  private loadProgress(): CampaignProgress {
    try {
      const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PROGRESS, stars: {}, bestScores: {} };
      const parsed = JSON.parse(raw) as CampaignProgress;
      return {
        unlockedLevel: parsed.unlockedLevel ?? 1,
        stars: parsed.stars ?? {},
        bestScores: parsed.bestScores ?? {},
      };
    } catch {
      return { ...DEFAULT_PROGRESS, stars: {}, bestScores: {} };
    }
  }

  private saveProgress(): void {
    try {
      localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(this.progress));
    } catch {
      // localStorage unavailable (e.g. private browsing quota) — silently ignore
    }
  }

  private buildLevels(): CampaignLevel[] {
    return [
      {
        id: 1,
        name: 'The Gauntlet',
        description: 'A straight path from left to right. Learn the ropes before the real challenge begins.',
        difficulty: DifficultyLevel.EASY,
        mapBuilder: buildGauntlet,
      },
      {
        id: 2,
        name: "Serpent's Pass",
        description: 'An S-curve with three sharp turns. Smart tower placement rewards patience.',
        difficulty: DifficultyLevel.EASY,
        mapBuilder: buildSerpentsPass,
      },
      {
        id: 3,
        name: 'Crossroads',
        description: 'Enemies split across two parallel paths. You cannot cover both without sacrifices.',
        difficulty: DifficultyLevel.NORMAL,
        mapBuilder: buildCrossroads,
      },
      {
        id: 4,
        name: 'The Labyrinth',
        description: 'A winding maze full of tight chokepoints. Every tile of coverage matters.',
        difficulty: DifficultyLevel.HARD,
        mapBuilder: buildLabyrinth,
      },
      {
        id: 5,
        name: 'Fortress',
        description: 'Open terrain with no natural chokepoints. Survive the relentless assault.',
        difficulty: DifficultyLevel.NIGHTMARE,
        mapBuilder: buildFortress,
      },
    ];
  }
}
