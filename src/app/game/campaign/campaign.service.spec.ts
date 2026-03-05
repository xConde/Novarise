import { TestBed } from '@angular/core/testing';
import { CampaignService, CampaignProgress } from './campaign.service';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { DifficultyLevel } from '../game-board/models/game-state.model';

const STORAGE_KEY = 'novarise-campaign';

describe('CampaignService', () => {
  let service: CampaignService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CampaignService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // Level catalogue
  // ---------------------------------------------------------------------------

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose exactly 5 levels', () => {
    expect(service.getLevels().length).toBe(5);
  });

  it('should have sequential ids 1–5', () => {
    const ids = service.getLevels().map(l => l.id);
    expect(ids).toEqual([1, 2, 3, 4, 5]);
  });

  it('should have non-empty name and description for every level', () => {
    for (const level of service.getLevels()) {
      expect(level.name.trim().length).toBeGreaterThan(0, `level ${level.id} name is empty`);
      expect(level.description.trim().length).toBeGreaterThan(0, `level ${level.id} description is empty`);
    }
  });

  it('should assign correct difficulties in order: easy, easy, normal, hard, nightmare', () => {
    const difficulties = service.getLevels().map(l => l.difficulty);
    expect(difficulties).toEqual([
      DifficultyLevel.EASY,
      DifficultyLevel.EASY,
      DifficultyLevel.NORMAL,
      DifficultyLevel.HARD,
      DifficultyLevel.NIGHTMARE,
    ]);
  });

  // ---------------------------------------------------------------------------
  // Initial progress
  // ---------------------------------------------------------------------------

  it('should unlock level 1 by default', () => {
    expect(service.isLevelUnlocked(1)).toBeTrue();
  });

  it('should lock levels 2–5 by default', () => {
    for (let id = 2; id <= 5; id++) {
      expect(service.isLevelUnlocked(id)).toBeFalse();
    }
  });

  it('should return unlockedLevel=1 in initial progress', () => {
    expect(service.getProgress().unlockedLevel).toBe(1);
  });

  it('should return empty stars and bestScores initially', () => {
    const p = service.getProgress();
    expect(Object.keys(p.stars).length).toBe(0);
    expect(Object.keys(p.bestScores).length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // completeLevel — basic unlocking
  // ---------------------------------------------------------------------------

  it('should unlock level 2 after completing level 1', () => {
    service.completeLevel(1, 3, 500);
    expect(service.isLevelUnlocked(2)).toBeTrue();
  });

  it('should store stars from completeLevel', () => {
    service.completeLevel(1, 2, 100);
    expect(service.getProgress().stars[1]).toBe(2);
  });

  it('should store best score from completeLevel', () => {
    service.completeLevel(1, 1, 300);
    expect(service.getProgress().bestScores[1]).toBe(300);
  });

  it('should not unlock beyond the last level', () => {
    // Unlock all up to 5
    service.completeLevel(1, 3, 100);
    service.completeLevel(2, 3, 100);
    service.completeLevel(3, 3, 100);
    service.completeLevel(4, 3, 100);
    service.completeLevel(5, 3, 100);
    expect(service.getProgress().unlockedLevel).toBe(5);
  });

  // ---------------------------------------------------------------------------
  // completeLevel — best-score semantics (no downgrade)
  // ---------------------------------------------------------------------------

  it('should keep higher star count, not overwrite with lower', () => {
    service.completeLevel(1, 3, 500);
    service.completeLevel(1, 1, 100);
    expect(service.getProgress().stars[1]).toBe(3);
  });

  it('should keep higher score, not overwrite with lower', () => {
    service.completeLevel(1, 2, 800);
    service.completeLevel(1, 2, 200);
    expect(service.getProgress().bestScores[1]).toBe(800);
  });

  it('should update score when higher score is submitted', () => {
    service.completeLevel(1, 1, 200);
    service.completeLevel(1, 2, 900);
    expect(service.getProgress().bestScores[1]).toBe(900);
  });

  // ---------------------------------------------------------------------------
  // Progress persistence
  // ---------------------------------------------------------------------------

  it('should persist progress to localStorage', () => {
    service.completeLevel(1, 3, 500);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as CampaignProgress;
    expect(parsed.unlockedLevel).toBe(2);
    expect(parsed.stars[1]).toBe(3);
    expect(parsed.bestScores[1]).toBe(500);
  });

  it('should load persisted progress on construction', () => {
    const saved: CampaignProgress = { unlockedLevel: 3, stars: { 1: 3, 2: 2 }, bestScores: { 1: 1000, 2: 800 } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const freshService = new CampaignService();
    expect(freshService.getProgress().unlockedLevel).toBe(3);
    expect(freshService.getProgress().stars[1]).toBe(3);
    expect(freshService.getProgress().bestScores[2]).toBe(800);
  });

  it('should fall back to default progress when localStorage has invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json');
    const freshService = new CampaignService();
    const progress = freshService.getProgress();
    expect(progress.unlockedLevel).toBe(1);
    expect(progress.stars).toEqual({});
  });

  // ---------------------------------------------------------------------------
  // resetProgress
  // ---------------------------------------------------------------------------

  it('should reset to default progress after resetProgress()', () => {
    service.completeLevel(1, 3, 500);
    service.completeLevel(2, 2, 300);
    service.resetProgress();

    const p = service.getProgress();
    expect(p.unlockedLevel).toBe(1);
    expect(Object.keys(p.stars).length).toBe(0);
    expect(Object.keys(p.bestScores).length).toBe(0);
  });

  it('should lock levels 2–5 after resetProgress()', () => {
    service.completeLevel(1, 3, 500);
    service.resetProgress();

    for (let id = 2; id <= 5; id++) {
      expect(service.isLevelUnlocked(id)).toBeFalse();
    }
  });

  it('should persist the reset to localStorage', () => {
    service.completeLevel(1, 3, 500);
    service.resetProgress();

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as CampaignProgress;
    expect(parsed.unlockedLevel).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // getMapForLevel — valid TerrainGridState for all 5 levels
  // ---------------------------------------------------------------------------

  it('should return null for unknown level id', () => {
    expect(service.getMapForLevel(99)).toBeNull();
  });

  for (let levelId = 1; levelId <= 5; levelId++) {
    it(`level ${levelId}: getMapForLevel returns a valid TerrainGridState`, () => {
      const map = service.getMapForLevel(levelId);

      expect(map).not.toBeNull();
      expect(map!.gridSize).toBe(25);
      expect(map!.version).toBe('1.0.0');
      expect(map!.tiles.length).toBe(25);
      expect(map!.tiles[0].length).toBe(25);
      expect(map!.heightMap.length).toBe(25);
      expect(map!.heightMap[0].length).toBe(25);
    });

    it(`level ${levelId}: map has a valid spawn point`, () => {
      const map = service.getMapForLevel(levelId)!;

      expect(map.spawnPoint).not.toBeNull();
      const sp = map.spawnPoint!;
      expect(sp.x).toBeGreaterThanOrEqual(0);
      expect(sp.x).toBeLessThan(25);
      expect(sp.z).toBeGreaterThanOrEqual(0);
      expect(sp.z).toBeLessThan(25);
    });

    it(`level ${levelId}: map has a valid exit point`, () => {
      const map = service.getMapForLevel(levelId)!;

      expect(map.exitPoint).not.toBeNull();
      const ep = map.exitPoint!;
      expect(ep.x).toBeGreaterThanOrEqual(0);
      expect(ep.x).toBeLessThan(25);
      expect(ep.z).toBeGreaterThanOrEqual(0);
      expect(ep.z).toBeLessThan(25);
    });

    it(`level ${levelId}: spawn and exit are distinct tiles`, () => {
      const map = service.getMapForLevel(levelId)!;
      const sp = map.spawnPoint!;
      const ep = map.exitPoint!;

      expect(sp.x === ep.x && sp.z === ep.z).toBeFalse();
    });

    it(`level ${levelId}: spawn tile is walkable (BEDROCK)`, () => {
      const map = service.getMapForLevel(levelId)!;
      const sp = map.spawnPoint!;

      expect(map.tiles[sp.x][sp.z]).toBe(TerrainType.BEDROCK);
    });

    it(`level ${levelId}: exit tile is walkable (BEDROCK)`, () => {
      const map = service.getMapForLevel(levelId)!;
      const ep = map.exitPoint!;

      expect(map.tiles[ep.x][ep.z]).toBe(TerrainType.BEDROCK);
    });

    it(`level ${levelId}: all tile values are valid TerrainType strings`, () => {
      const map = service.getMapForLevel(levelId)!;
      const valid = new Set(Object.values(TerrainType));

      for (let x = 0; x < 25; x++) {
        for (let z = 0; z < 25; z++) {
          expect(valid.has(map.tiles[x][z])).toBeTrue();
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // getProgress — returns a defensive copy
  // ---------------------------------------------------------------------------

  it('getProgress should return a copy, not the internal reference', () => {
    service.completeLevel(1, 3, 100);
    const p1 = service.getProgress();
    p1.unlockedLevel = 99;
    p1.stars[1] = 0;

    const p2 = service.getProgress();
    expect(p2.unlockedLevel).not.toBe(99);
    expect(p2.stars[1]).toBe(3);
  });
});
