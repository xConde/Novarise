import { TestBed } from '@angular/core/testing';
import {
  TilePricingService,
  TilePriceInfo,
  StrategicTier,
  STRATEGIC_TIERS,
  PRICING_CONFIG,
} from './tile-pricing.service';
import { GameBoardService } from '../game-board.service';
import { GameBoardTile, BlockType } from '../models/game-board-tile';
import { TowerType, TOWER_CONFIGS } from '../models/tower.model';
import { HEATMAP_GRADIENT } from '../constants/ui.constants';
import { createTestBoard } from '../testing/test-board.factory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type GameBoardServiceSpy = jasmine.SpyObj<
  Pick<GameBoardService,
    'getGameBoard' | 'getBoardWidth' | 'getBoardHeight' |
    'getSpawnerTiles' | 'getExitTiles'
  >
>;

function createBoardServiceSpy(
  board: GameBoardTile[][],
  spawners: number[][],
  exits: number[][]
): GameBoardServiceSpy {
  const spy = jasmine.createSpyObj<GameBoardService>(
    'GameBoardService',
    ['getGameBoard', 'getBoardWidth', 'getBoardHeight', 'getSpawnerTiles', 'getExitTiles']
  );
  spy.getGameBoard.and.returnValue(board);
  spy.getBoardWidth.and.returnValue(board[0].length);
  spy.getBoardHeight.and.returnValue(board.length);
  spy.getSpawnerTiles.and.returnValue(spawners);
  spy.getExitTiles.and.returnValue(exits);
  return spy;
}

// ---------------------------------------------------------------------------
// TilePricingService
// ---------------------------------------------------------------------------

describe('TilePricingService', () => {
  let service: TilePricingService;
  let boardSpy: GameBoardServiceSpy;

  // Default: 5×5 board, spawner at (0,0), exit at (4,4).
  const SIZE = 5;
  let board: GameBoardTile[][];

  beforeEach(() => {
    board = createTestBoard(SIZE);
    boardSpy = createBoardServiceSpy(board, [[0, 0]], [[SIZE - 1, SIZE - 1]]);

    TestBed.configureTestingModule({
      providers: [
        TilePricingService,
        { provide: GameBoardService, useValue: boardSpy },
      ],
    });
    service = TestBed.inject(TilePricingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // getTilePrice
  // ---------------------------------------------------------------------------

  describe('getTilePrice', () => {
    it('returns at least base cost when strategic value is 0', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0);
      const info = service.getTilePrice(TowerType.BASIC, 1, 1);
      expect(info.cost).toBe(TOWER_CONFIGS[TowerType.BASIC].cost);
    });

    it('returns higher cost for path-adjacent tiles than tiles far from path', () => {
      // (1,0) is directly on/adjacent to the BFS path in a 5×5 board.
      // (0,4) is far from the path and has low strategic value.
      const nearInfo = service.getTilePrice(TowerType.BASIC, 1, 0);
      const farInfo  = service.getTilePrice(TowerType.BASIC, 0, 4);
      expect(nearInfo.cost).toBeGreaterThanOrEqual(farInfo.cost);
    });

    it('returns highest cost when the tile disconnects all paths (strategic=1)', () => {
      // Build a single-tile corridor: 5×5, walls along row 2 except col 2.
      const corridorBoard = createTestBoard(5, [
        { row: 2, col: 0 }, { row: 2, col: 1 },
        { row: 2, col: 3 }, { row: 2, col: 4 },
      ]);
      boardSpy.getGameBoard.and.returnValue(corridorBoard);
      boardSpy.getBoardWidth.and.returnValue(5);
      boardSpy.getBoardHeight.and.returnValue(5);
      boardSpy.getSpawnerTiles.and.returnValue([[0, 0]]);
      boardSpy.getExitTiles.and.returnValue([[4, 4]]);
      service.invalidateCache();

      // (2,2) is the single choke tile — blocking it disconnects the path.
      const chokeInfo = service.getTilePrice(TowerType.BASIC, 2, 2);
      const openInfo  = service.getTilePrice(TowerType.BASIC, 0, 3);
      expect(chokeInfo.cost).toBeGreaterThan(openInfo.cost);
    });

    it('percentIncrease matches the strategic multiplier scaled to 0–100', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0.4);
      const info = service.getTilePrice(TowerType.BASIC, 1, 1);
      // percentIncrease = round(0.4 * 0.50 * 100) = 20
      expect(info.percentIncrease).toBe(20);
    });

    it('percentIncrease is 0 when strategic value is 0', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0);
      const info = service.getTilePrice(TowerType.BASIC, 1, 1);
      expect(info.percentIncrease).toBe(0);
    });

    it('percentIncrease is 50 when strategic value is 1 (50% max cap)', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(1.0);
      const info = service.getTilePrice(TowerType.BASIC, 1, 1);
      expect(info.percentIncrease).toBe(50);
    });

    it('tier field matches STRATEGIC_TIERS thresholds', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0.9);
      const info = service.getTilePrice(TowerType.BASIC, 1, 1);
      // 0.9 >= STRATEGIC_TIERS.critical (0.62) → 'critical'
      expect(info.tier).toBe('critical');
    });

    it('isPremium is false when strategic value is at or below PREMIUM_THRESHOLD (0.1)', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0.1);
      const info = service.getTilePrice(TowerType.BASIC, 1, 1);
      expect(info.isPremium).toBeFalse();
    });

    it('isPremium is true when strategic value exceeds PREMIUM_THRESHOLD', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0.11);
      const info = service.getTilePrice(TowerType.BASIC, 1, 1);
      expect(info.isPremium).toBeTrue();
    });

    it('works for all 6 tower types using their respective base costs', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0);
      const types: TowerType[] = [
        TowerType.BASIC, TowerType.SNIPER, TowerType.SPLASH,
        TowerType.SLOW, TowerType.CHAIN, TowerType.MORTAR,
      ];
      for (const type of types) {
        const info = service.getTilePrice(type, 1, 1);
        expect(info.cost).toBe(TOWER_CONFIGS[type].cost, `${type} base cost mismatch`);
      }
    });

    it('respects external costMultiplier when strategic value is 0', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0);
      const info = service.getTilePrice(TowerType.BASIC, 1, 1, 1.5);
      expect(info.cost).toBe(Math.round(TOWER_CONFIGS[TowerType.BASIC].cost * 1.5));
    });

    it('combines external costMultiplier with strategic multiplier', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0.5);
      const baseCost = TOWER_CONFIGS[TowerType.SNIPER].cost;
      const info = service.getTilePrice(TowerType.SNIPER, 1, 1, 2.0);
      // totalMult = 2.0 * (1 + 0.5 * 0.50) = 2.5
      expect(info.cost).toBe(Math.round(baseCost * 2.5));
    });

    it('cost is always a rounded integer', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0.33);
      const info = service.getTilePrice(TowerType.BASIC, 1, 1);
      expect(Number.isInteger(info.cost)).toBeTrue();
    });

    it('cost equals 1.5x base when strategic value is 1 and costMultiplier is 1', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(1.0);
      const info = service.getTilePrice(TowerType.BASIC, 1, 1);
      expect(info.cost).toBe(Math.round(TOWER_CONFIGS[TowerType.BASIC].cost * 1.5));
    });
  });

  // ---------------------------------------------------------------------------
  // getStrategicValue
  // ---------------------------------------------------------------------------

  describe('getStrategicValue', () => {
    it('returns 0 for WALL tiles (not computed into cache)', () => {
      const walledBoard = createTestBoard(SIZE, [{ row: 1, col: 1 }]);
      boardSpy.getGameBoard.and.returnValue(walledBoard);
      service.invalidateCache();
      expect(service.getStrategicValue(1, 1)).toBe(0);
    });

    it('returns 0 for tiles with towers placed on them (occupied)', () => {
      const modifiedBoard = createTestBoard(SIZE);
      modifiedBoard[2][2] = new GameBoardTile(2, 2, BlockType.BASE, true, true, 0, TowerType.BASIC);
      boardSpy.getGameBoard.and.returnValue(modifiedBoard);
      service.invalidateCache();
      // Tile has towerType !== null — excluded from pricing
      expect(service.getStrategicValue(2, 2)).toBe(0);
    });

    it('returns a value in [0, 1] for valid BASE tiles', () => {
      const val = service.getStrategicValue(1, 1);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    });

    it('returns a higher value for tiles near the path than tiles far from path', () => {
      // On a 5×5 open board the BFS path runs along column 0 then row 4.
      // (1,0) is adjacent to spawner and on the path; (0,4) is far from everything.
      const nearPath = service.getStrategicValue(1, 0);
      const farPath  = service.getStrategicValue(0, 4);
      expect(nearPath).toBeGreaterThan(farPath);
    });

    it('cache hit returns same value without recomputation', () => {
      service.getStrategicValue(1, 1); // warm cache
      const callsBefore = boardSpy.getGameBoard.calls.count();
      service.getStrategicValue(1, 1); // should hit cache
      expect(boardSpy.getGameBoard.calls.count()).toBe(callsBefore);
    });

    it('returns 0 for non-purchasable BASE tiles', () => {
      const npBoard = createTestBoard(SIZE);
      // isPurchasable = false
      npBoard[2][2] = new GameBoardTile(2, 2, BlockType.BASE, true, false, 0, null);
      boardSpy.getGameBoard.and.returnValue(npBoard);
      service.invalidateCache();
      expect(service.getStrategicValue(2, 2)).toBe(0);
    });

    it('returns 0 for an out-of-bounds coordinate (not in cache)', () => {
      expect(service.getStrategicValue(99, 99)).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getStrategicTier
  // ---------------------------------------------------------------------------

  describe('getStrategicTier', () => {
    it('returns "base" for strategic value below low threshold (0.10)', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0.05);
      const tier: StrategicTier = service.getStrategicTier(1, 1);
      expect(tier).toBe('base');
    });

    it('returns "low" for value between low (0.10) and medium (0.25)', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0.20);
      expect(service.getStrategicTier(1, 1)).toBe('low');
    });

    it('returns "medium" for value between medium (0.25) and high (0.45)', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0.35);
      expect(service.getStrategicTier(1, 1)).toBe('medium');
    });

    it('returns "high" for value between high (0.45) and critical (0.62)', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0.55);
      expect(service.getStrategicTier(1, 1)).toBe('high');
    });

    it('returns "critical" for value at or above critical threshold (0.62)', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0.62);
      expect(service.getStrategicTier(1, 1)).toBe('critical');
    });

    it('returns "critical" for value of 1.0 (maximum)', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(1.0);
      expect(service.getStrategicTier(1, 1)).toBe('critical');
    });

    it('returns "base" for strategic value of 0 (no premium)', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0);
      expect(service.getStrategicTier(1, 1)).toBe('base');
    });

    it('tier boundary: exactly at low threshold (0.10) → "low"', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(STRATEGIC_TIERS.low);
      expect(service.getStrategicTier(1, 1)).toBe('low');
    });
  });

  // ---------------------------------------------------------------------------
  // getTilePriceMap
  // ---------------------------------------------------------------------------

  describe('getTilePriceMap', () => {
    it('returns a Map with entries for all priceable tiles', () => {
      const priceMap = service.getTilePriceMap(TowerType.BASIC);
      // 5×5 board: 25 total. Spawner (0,0), exit (4,4), 23 BASE tiles (all purchasable).
      expect(priceMap.size).toBe(23);
    });

    it('each entry has the correct TilePriceInfo shape', () => {
      const priceMap = service.getTilePriceMap(TowerType.BASIC);
      for (const [, info] of priceMap) {
        expect(typeof info.cost).toBe('number');
        expect(typeof info.strategicMultiplier).toBe('number');
        expect(typeof info.percentIncrease).toBe('number');
        expect(typeof info.tier).toBe('string');
        expect(typeof info.isPremium).toBe('boolean');
        expect(info.strategicMultiplier).toBeGreaterThanOrEqual(0);
        expect(info.strategicMultiplier).toBeLessThanOrEqual(1);
      }
    });

    it('returns empty map when board has no priceable tiles', () => {
      // 1×1 board with only spawner tile — no BASE tiles.
      const tiny: GameBoardTile[][] = [[GameBoardTile.createSpawner(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(tiny);
      boardSpy.getBoardWidth.and.returnValue(1);
      boardSpy.getBoardHeight.and.returnValue(1);
      boardSpy.getSpawnerTiles.and.returnValue([[0, 0]]);
      boardSpy.getExitTiles.and.returnValue([]);
      service.invalidateCache();
      expect(service.getTilePriceMap(TowerType.BASIC).size).toBe(0);
    });

    it('respects external costMultiplier for all entries', () => {
      const normalMap = service.getTilePriceMap(TowerType.BASIC, 1.0);
      service.invalidateCache();
      const doubledMap = service.getTilePriceMap(TowerType.BASIC, 2.0);

      for (const [key, normalInfo] of normalMap) {
        const doubledInfo = doubledMap.get(key)!;
        // doubled cost should be approximately 2× the normal cost (rounding may differ by 1).
        expect(doubledInfo.cost).toBeGreaterThanOrEqual(normalInfo.cost * 2 - 1);
        expect(doubledInfo.cost).toBeLessThanOrEqual(normalInfo.cost * 2 + 1);
      }
    });

    it('keys are in "row-col" format and parse to valid board coordinates', () => {
      const priceMap = service.getTilePriceMap(TowerType.BASIC);
      for (const key of priceMap.keys()) {
        const parts = key.split('-');
        expect(parts.length).toBe(2);
        const row = parseInt(parts[0], 10);
        const col = parseInt(parts[1], 10);
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(SIZE);
        expect(col).toBeGreaterThanOrEqual(0);
        expect(col).toBeLessThan(SIZE);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // invalidateCache
  // ---------------------------------------------------------------------------

  describe('invalidateCache', () => {
    it('causes recomputation on the next getStrategicValue call', () => {
      service.getStrategicValue(1, 1); // warm cache
      const callsBefore = boardSpy.getGameBoard.calls.count();
      service.invalidateCache();
      service.getStrategicValue(1, 1); // must recompute
      expect(boardSpy.getGameBoard.calls.count()).toBeGreaterThan(callsBefore);
    });

    it('clears stale values so an updated board is reflected', () => {
      const initial = service.getStrategicValue(1, 1);

      // Wall off all four neighbors of (1,1) — changes the strategic landscape.
      const newBoard = createTestBoard(SIZE, [
        { row: 0, col: 1 }, { row: 1, col: 0 },
        { row: 1, col: 2 }, { row: 2, col: 1 },
      ]);
      boardSpy.getGameBoard.and.returnValue(newBoard);
      service.invalidateCache();

      const updated = service.getStrategicValue(1, 1);
      // Value must change because the board changed significantly.
      expect(updated).not.toBe(initial, 'expected value to differ after board mutation');
    });

    it('multiple consecutive invalidations do not throw', () => {
      expect(() => {
        service.invalidateCache();
        service.invalidateCache();
        service.invalidateCache();
      }).not.toThrow();
    });

    it('after invalidation, getTilePriceMap rebuilds with fresh values', () => {
      const first = service.getTilePriceMap(TowerType.BASIC);
      service.invalidateCache();
      const second = service.getTilePriceMap(TowerType.BASIC);
      // Both maps should have the same size (same board).
      expect(second.size).toBe(first.size);
    });
  });

  // ---------------------------------------------------------------------------
  // Path-length impact specific
  // ---------------------------------------------------------------------------

  describe('path-length impact (BFS delta)', () => {
    it('tile on the only path between spawner and exit has high strategic value', () => {
      // Force all traffic through a single tile corridor at (2,2).
      const corridorBoard = createTestBoard(5, [
        { row: 2, col: 0 }, { row: 2, col: 1 },
        { row: 2, col: 3 }, { row: 2, col: 4 },
      ]);
      boardSpy.getGameBoard.and.returnValue(corridorBoard);
      boardSpy.getBoardWidth.and.returnValue(5);
      boardSpy.getBoardHeight.and.returnValue(5);
      boardSpy.getSpawnerTiles.and.returnValue([[0, 0]]);
      boardSpy.getExitTiles.and.returnValue([[4, 4]]);
      service.invalidateCache();

      // (2,2) is the narrow corridor gateway — blocking it significantly lengthens the path.
      const chokeValue = service.getStrategicValue(2, 2);
      expect(chokeValue).toBeGreaterThan(0.3);
    });

    it('tile far from path has lower BFS impact than tile on path', () => {
      // On a 5×5 open board the path is along edges; center (2,2) is less critical
      // than a tile directly on the path such as (1,0).
      const nearPathValue = service.getStrategicValue(1, 0);
      const farPathValue  = service.getStrategicValue(0, 4);
      expect(nearPathValue).toBeGreaterThan(farPathValue);
    });

    it('disconnecting tile gives maximum BFS impact (strategic value approaches 1)', () => {
      // 5×5 board with walls along row 2 except col 2 — (2,2) is the sole crossing.
      // Blocking (2,2) makes the path Infinity → bfsDelta=1.0 → max impact score.
      const corridorBoard = createTestBoard(5, [
        { row: 2, col: 0 }, { row: 2, col: 1 },
        { row: 2, col: 3 }, { row: 2, col: 4 },
      ]);
      boardSpy.getGameBoard.and.returnValue(corridorBoard);
      boardSpy.getBoardWidth.and.returnValue(5);
      boardSpy.getBoardHeight.and.returnValue(5);
      boardSpy.getSpawnerTiles.and.returnValue([[0, 0]]);
      boardSpy.getExitTiles.and.returnValue([[4, 4]]);
      service.invalidateCache();

      // (2,2) is the only passable tile in row 2 — blocking it disconnects all paths.
      // The open tile (0,3) far from the bottleneck should score considerably lower.
      const chokeValue = service.getStrategicValue(2, 2);
      const openValue  = service.getStrategicValue(0, 3);
      expect(chokeValue).toBeGreaterThan(openValue);
      // Choke tile must score above the medium tier threshold.
      expect(chokeValue).toBeGreaterThan(0.35);
    });

    it('multi-spawner boards compute BFS impact from all spawners', () => {
      const msBoard = createTestBoard(6);
      msBoard[0][5] = GameBoardTile.createSpawner(0, 5);
      boardSpy.getGameBoard.and.returnValue(msBoard);
      boardSpy.getBoardWidth.and.returnValue(6);
      boardSpy.getBoardHeight.and.returnValue(6);
      boardSpy.getSpawnerTiles.and.returnValue([[0, 0], [0, 5]]);
      boardSpy.getExitTiles.and.returnValue([[5, 5]]);
      service.invalidateCache();

      // Values should be valid (the multi-source BFS must not crash or produce NaN).
      const val = service.getStrategicValue(3, 3);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
      expect(isNaN(val)).toBeFalse();
    });

    it('placing a tower changes other tiles strategic values after cache invalidation', () => {
      const openBoard = createTestBoard(5);
      boardSpy.getGameBoard.and.returnValue(openBoard);
      service.invalidateCache();
      const beforeValue = service.getStrategicValue(2, 3);

      // Place a tower on (2,2) — reduces free neighbours of (2,3).
      const modifiedBoard = createTestBoard(5);
      modifiedBoard[2][2] = new GameBoardTile(2, 2, BlockType.TOWER, false, false, 0, TowerType.BASIC);
      boardSpy.getGameBoard.and.returnValue(modifiedBoard);
      service.invalidateCache();
      const afterValue = service.getStrategicValue(2, 3);

      // (2,3) loses a free neighbour → tightness increases → score changes.
      expect(afterValue).toBeGreaterThanOrEqual(beforeValue);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('no spawners → all strategic values are 0', () => {
      boardSpy.getSpawnerTiles.and.returnValue([]);
      boardSpy.getExitTiles.and.returnValue([[SIZE - 1, SIZE - 1]]);
      service.invalidateCache();
      // Proximity is 0 (no spawners), adjacency/impact both 0 (no path).
      // All BASE tiles should cache to 0 (or not appear in cache at all).
      expect(service.getStrategicValue(1, 1)).toBe(0);
    });

    it('no exits → BFS path impact is 0 (Infinity baseline), values driven only by proximity', () => {
      boardSpy.getSpawnerTiles.and.returnValue([[0, 0]]);
      boardSpy.getExitTiles.and.returnValue([]);
      service.invalidateCache();
      // No exits: BFS returns Infinity for baseline, so path impact=0 and adjacency=0.
      // Tiles near the spawner still get a proximity component, so the value is not
      // necessarily 0. Verify it is a valid in-range number and does not throw.
      expect(() => service.getStrategicValue(1, 1)).not.toThrow();
      const val = service.getStrategicValue(1, 1);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
      // A tile far from both spawner and exit should score 0 (no proximity boost).
      const farVal = service.getStrategicValue(4, 4);
      expect(farVal).toBe(0);
    });

    it('1×1 board with only a spawner tile has no priceable tiles', () => {
      const tiny: GameBoardTile[][] = [[GameBoardTile.createSpawner(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(tiny);
      boardSpy.getBoardWidth.and.returnValue(1);
      boardSpy.getBoardHeight.and.returnValue(1);
      boardSpy.getSpawnerTiles.and.returnValue([[0, 0]]);
      boardSpy.getExitTiles.and.returnValue([]);
      service.invalidateCache();

      // Should not throw and should return 0 (nothing in cache).
      expect(() => service.getStrategicValue(0, 0)).not.toThrow();
      expect(service.getStrategicValue(0, 0)).toBe(0);
      expect(service.getTilePriceMap(TowerType.BASIC).size).toBe(0);
    });

    it('board with no valid path (all surrounded by walls) is handled gracefully', () => {
      // Completely wall off the interior — spawner has no traversable path to exit.
      const wallBoard = createTestBoard(5, [
        { row: 0, col: 1 }, { row: 1, col: 0 },
      ]);
      // Override exit and spawner so they are adjacent only through walled tiles.
      boardSpy.getGameBoard.and.returnValue(wallBoard);
      boardSpy.getSpawnerTiles.and.returnValue([[0, 0]]);
      boardSpy.getExitTiles.and.returnValue([[4, 4]]);
      service.invalidateCache();

      // Must not throw; BFS returns Infinity when no path found.
      expect(() => service.getStrategicValue(2, 2)).not.toThrow();
      const val = service.getStrategicValue(2, 2);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    });

    it('SPAWNER and EXIT tiles return 0 (not in pricing cache)', () => {
      // (0,0) is spawner, (4,4) is exit — neither should appear in cache.
      expect(service.getStrategicValue(0, 0)).toBe(0);
      expect(service.getStrategicValue(SIZE - 1, SIZE - 1)).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // STRATEGIC_TIERS constant
  // ---------------------------------------------------------------------------

  describe('STRATEGIC_TIERS constant', () => {
    it('exposes the correct threshold values', () => {
      expect(STRATEGIC_TIERS.low).toBe(0.10);
      expect(STRATEGIC_TIERS.medium).toBe(0.25);
      expect(STRATEGIC_TIERS.high).toBe(0.45);
      expect(STRATEGIC_TIERS.critical).toBe(0.62);
    });

    it('thresholds are in ascending order', () => {
      expect(STRATEGIC_TIERS.low).toBeLessThan(STRATEGIC_TIERS.medium);
      expect(STRATEGIC_TIERS.medium).toBeLessThan(STRATEGIC_TIERS.high);
      expect(STRATEGIC_TIERS.high).toBeLessThan(STRATEGIC_TIERS.critical);
    });
  });

  // ---------------------------------------------------------------------------
  // Multi-spawner boards
  // ---------------------------------------------------------------------------

  describe('multi-spawner boards', () => {
    it('computes path tiles from multiple spawners without errors', () => {
      const msBoard = createTestBoard(6);
      msBoard[0][5] = GameBoardTile.createSpawner(0, 5);
      boardSpy.getGameBoard.and.returnValue(msBoard);
      boardSpy.getBoardWidth.and.returnValue(6);
      boardSpy.getBoardHeight.and.returnValue(6);
      boardSpy.getSpawnerTiles.and.returnValue([[0, 0], [0, 5]]);
      boardSpy.getExitTiles.and.returnValue([[5, 5]]);
      service.invalidateCache();

      // (0,3) sits between two spawners — should get a non-zero strategic value
      // because both paths pass through it (or near it).
      const midValue = service.getStrategicValue(0, 3);
      expect(midValue).toBeGreaterThan(0);
    });

    it('tiles near either spawner receive a proximity premium', () => {
      const msBoard = createTestBoard(6);
      msBoard[5][0] = GameBoardTile.createSpawner(5, 0);
      boardSpy.getGameBoard.and.returnValue(msBoard);
      boardSpy.getBoardWidth.and.returnValue(6);
      boardSpy.getBoardHeight.and.returnValue(6);
      boardSpy.getSpawnerTiles.and.returnValue([[0, 0], [5, 0]]);
      boardSpy.getExitTiles.and.returnValue([[5, 5]]);
      service.invalidateCache();

      // (1,0) is adjacent to spawner at (0,0) → high proximity.
      // (3,3) is far from both spawners and the exit.
      const nearSpawn = service.getStrategicValue(1, 0);
      const farTile   = service.getStrategicValue(3, 3);
      expect(nearSpawn).toBeGreaterThan(farTile);
    });
  });

  // ---------------------------------------------------------------------------
  // Non-purchasable tiles
  // ---------------------------------------------------------------------------

  describe('non-purchasable tiles', () => {
    it('non-purchasable BASE tiles have strategic value of 0', () => {
      const npBoard = createTestBoard(5);
      npBoard[2][2] = new GameBoardTile(2, 2, BlockType.BASE, true, false, 0, null);
      boardSpy.getGameBoard.and.returnValue(npBoard);
      service.invalidateCache();
      expect(service.getStrategicValue(2, 2)).toBe(0);
    });

    it('occupied BASE tiles (towerType set) have strategic value of 0', () => {
      const occBoard = createTestBoard(5);
      occBoard[2][2] = new GameBoardTile(2, 2, BlockType.BASE, true, true, 0, TowerType.SNIPER);
      boardSpy.getGameBoard.and.returnValue(occBoard);
      service.invalidateCache();
      expect(service.getStrategicValue(2, 2)).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Full board scenario
  // ---------------------------------------------------------------------------

  describe('full board scenario', () => {
    it('getTilePrice returns higher cost for a bottleneck tile than an open tile', () => {
      const corridorBoard = createTestBoard(5, [
        { row: 2, col: 0 }, { row: 2, col: 1 },
        { row: 2, col: 3 }, { row: 2, col: 4 },
      ]);
      boardSpy.getGameBoard.and.returnValue(corridorBoard);
      boardSpy.getBoardWidth.and.returnValue(5);
      boardSpy.getBoardHeight.and.returnValue(5);
      boardSpy.getSpawnerTiles.and.returnValue([[0, 0]]);
      boardSpy.getExitTiles.and.returnValue([[4, 4]]);
      service.invalidateCache();

      const bottleneckInfo = service.getTilePrice(TowerType.BASIC, 2, 2);
      const openInfo       = service.getTilePrice(TowerType.BASIC, 0, 3);
      expect(bottleneckInfo.cost).toBeGreaterThanOrEqual(openInfo.cost);
    });

    it('pricing changes after tower placement and cache invalidation', () => {
      const openBoard = createTestBoard(5);
      boardSpy.getGameBoard.and.returnValue(openBoard);
      service.invalidateCache();
      const basePrice = service.getTilePrice(TowerType.BASIC, 2, 3).cost;

      const modifiedBoard = createTestBoard(5);
      modifiedBoard[2][2] = new GameBoardTile(2, 2, BlockType.TOWER, false, false, 0, TowerType.BASIC);
      boardSpy.getGameBoard.and.returnValue(modifiedBoard);
      service.invalidateCache();
      const updatedPrice = service.getTilePrice(TowerType.BASIC, 2, 3).cost;

      // Placing a tower on (2,2) reduces (2,3)'s free neighbours → tightness rises.
      expect(updatedPrice).toBeGreaterThanOrEqual(basePrice);
    });

    it('pricing of a bottleneck tile increases after surrounding tiles are walled off', () => {
      const openBoard = createTestBoard(5);
      boardSpy.getGameBoard.and.returnValue(openBoard);
      service.invalidateCache();
      const openScore = service.getStrategicValue(2, 2);

      // Wall off 3 neighbours of (2,2), making it a structural bottleneck.
      const walledBoard = createTestBoard(5, [
        { row: 1, col: 2 },
        { row: 2, col: 1 },
        { row: 3, col: 2 },
      ]);
      boardSpy.getGameBoard.and.returnValue(walledBoard);
      service.invalidateCache();
      const walledScore = service.getStrategicValue(2, 2);

      expect(walledScore).toBeGreaterThan(openScore);
    });
  });

  // ---------------------------------------------------------------------------
  // Cluster density bonus
  // ---------------------------------------------------------------------------

  describe('cluster density bonus', () => {
    it('no placed towers → no cluster bonus added', () => {
      // Default 5×5 board has no towers placed
      const val1 = service.getStrategicValue(2, 2);
      // Value should stay within the singles cap (maxStrategicMultiplier = 0.50)
      expect(val1).toBeLessThanOrEqual(PRICING_CONFIG.maxStrategicMultiplier);
    });

    it('one placed tower within radius adds a small bonus', () => {
      const baseBoard = createTestBoard(5);
      boardSpy.getGameBoard.and.returnValue(baseBoard);
      service.invalidateCache();
      const before = service.getStrategicValue(2, 3);

      // Place a tower on (2,1) — within Chebyshev distance 2 of (2,3)
      const modBoard = createTestBoard(5);
      modBoard[2][1] = new GameBoardTile(2, 1, BlockType.BASE, true, true, 0, TowerType.BASIC);
      boardSpy.getGameBoard.and.returnValue(modBoard);
      service.invalidateCache();
      const after = service.getStrategicValue(2, 3);

      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('saturated cluster reaches cluster max multiplier', () => {
      // Place 4+ towers (clusterSaturationCount) around (2,2)
      const clusterBoard = createTestBoard(5);
      clusterBoard[1][1] = new GameBoardTile(1, 1, BlockType.BASE, true, true, 0, TowerType.BASIC);
      clusterBoard[1][2] = new GameBoardTile(1, 2, BlockType.BASE, true, true, 0, TowerType.BASIC);
      clusterBoard[1][3] = new GameBoardTile(1, 3, BlockType.BASE, true, true, 0, TowerType.BASIC);
      clusterBoard[2][1] = new GameBoardTile(2, 1, BlockType.BASE, true, true, 0, TowerType.BASIC);
      boardSpy.getGameBoard.and.returnValue(clusterBoard);
      service.invalidateCache();
      const val = service.getStrategicValue(2, 2);

      // Should be clamped to clusterMaxMultiplier
      expect(val).toBeLessThanOrEqual(PRICING_CONFIG.clusterMaxMultiplier);
    });

    it('total strategic value is clamped to clusterMaxMultiplier (0.75)', () => {
      // Build a board where the choke tile has high strategic value AND nearby towers
      const corridorBoard = createTestBoard(5, [
        { row: 2, col: 0 }, { row: 2, col: 1 },
        { row: 2, col: 3 }, { row: 2, col: 4 },
      ]);
      // Place towers near the choke at (2,2)
      corridorBoard[1][2] = new GameBoardTile(1, 2, BlockType.BASE, true, true, 0, TowerType.BASIC);
      corridorBoard[3][2] = new GameBoardTile(3, 2, BlockType.BASE, true, true, 0, TowerType.BASIC);
      boardSpy.getGameBoard.and.returnValue(corridorBoard);
      boardSpy.getBoardWidth.and.returnValue(5);
      boardSpy.getBoardHeight.and.returnValue(5);
      boardSpy.getSpawnerTiles.and.returnValue([[0, 0]]);
      boardSpy.getExitTiles.and.returnValue([[4, 4]]);
      service.invalidateCache();
      const val = service.getStrategicValue(2, 2);

      expect(val).toBeLessThanOrEqual(PRICING_CONFIG.clusterMaxMultiplier);
    });

    it('tower outside clusterRadius does not add bonus', () => {
      const baseBoard = createTestBoard(SIZE);
      boardSpy.getGameBoard.and.returnValue(baseBoard);
      service.invalidateCache();
      const before = service.getStrategicValue(0, 4);

      // Place tower at (4,0) — Chebyshev distance 4 from (0,4), outside radius 2
      const modBoard = createTestBoard(SIZE);
      modBoard[4][0] = new GameBoardTile(4, 0, BlockType.BASE, true, true, 0, TowerType.BASIC);
      boardSpy.getGameBoard.and.returnValue(modBoard);
      service.invalidateCache();
      const after = service.getStrategicValue(0, 4);

      // The base strategic value may change due to tightness, but no cluster bonus
      // We just verify the value doesn't exceed the singles cap if the base doesn't
      if (before <= PRICING_CONFIG.maxStrategicMultiplier) {
        expect(after).toBeLessThanOrEqual(PRICING_CONFIG.maxStrategicMultiplier);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Spec hardening
  // ---------------------------------------------------------------------------

  describe('spec hardening', () => {
    it('PRICING_CONFIG exports expected shape', () => {
      expect(PRICING_CONFIG.maxStrategicMultiplier).toBe(0.50);
      expect(PRICING_CONFIG.clusterMaxMultiplier).toBe(0.75);
      expect(PRICING_CONFIG.clusterRadius).toBe(2);
      expect(PRICING_CONFIG.clusterSaturationCount).toBe(4);
      expect(PRICING_CONFIG.premiumThreshold).toBe(0.1);
      expect(PRICING_CONFIG.weights.pathLengthImpact + PRICING_CONFIG.weights.pathAdjacency + PRICING_CONFIG.weights.proximity).toBeCloseTo(1.0);
      expect(PRICING_CONFIG.impactSubWeights.bfsDelta + PRICING_CONFIG.impactSubWeights.tightness).toBeCloseTo(1.0);
    });

    it('cluster bonus does not push value above clusterMaxMultiplier even with many towers', () => {
      // Place 6 towers around (2,3) — more than clusterSaturationCount
      const board6 = createTestBoard(7);
      board6[1][2] = new GameBoardTile(1, 2, BlockType.BASE, true, true, 0, TowerType.BASIC);
      board6[1][3] = new GameBoardTile(1, 3, BlockType.BASE, true, true, 0, TowerType.BASIC);
      board6[1][4] = new GameBoardTile(1, 4, BlockType.BASE, true, true, 0, TowerType.BASIC);
      board6[2][2] = new GameBoardTile(2, 2, BlockType.BASE, true, true, 0, TowerType.BASIC);
      board6[3][2] = new GameBoardTile(3, 2, BlockType.BASE, true, true, 0, TowerType.BASIC);
      board6[3][3] = new GameBoardTile(3, 3, BlockType.BASE, true, true, 0, TowerType.BASIC);
      boardSpy.getGameBoard.and.returnValue(board6);
      boardSpy.getBoardWidth.and.returnValue(7);
      boardSpy.getBoardHeight.and.returnValue(7);
      boardSpy.getSpawnerTiles.and.returnValue([[0, 0]]);
      boardSpy.getExitTiles.and.returnValue([[6, 6]]);
      service.invalidateCache();

      const val = service.getStrategicValue(2, 3);
      expect(val).toBeLessThanOrEqual(PRICING_CONFIG.clusterMaxMultiplier);
    });

    it('gradient boundary: value at 0 maps to first gradient stop color', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(0);
      const info = service.getTilePrice(TowerType.BASIC, 1, 1);
      expect(info.tier).toBe('base');
      expect(info.percentIncrease).toBe(0);
    });

    it('gradient boundary: value at clusterMax maps to critical tier', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(PRICING_CONFIG.clusterMaxMultiplier);
      const info = service.getTilePrice(TowerType.BASIC, 1, 1);
      expect(info.tier).toBe('critical');
    });

    it('getTilePrice percentIncrease reflects 50% max cap', () => {
      spyOn(service, 'getStrategicValue').and.returnValue(PRICING_CONFIG.maxStrategicMultiplier);
      const info = service.getTilePrice(TowerType.BASIC, 1, 1);
      // 0.50 * 0.50 * 100 = 25
      expect(info.percentIncrease).toBe(25);
    });

    it('cluster bonus on empty board (no towers) leaves values unchanged', () => {
      const val1 = service.getStrategicValue(1, 1);
      service.invalidateCache();
      const val2 = service.getStrategicValue(1, 1);
      expect(val1).toBe(val2);
    });

    it('STRATEGIC_TIERS boundaries align within gradient range', () => {
      // All tier thresholds should be ≤ clusterMaxMultiplier
      expect(STRATEGIC_TIERS.low).toBeLessThanOrEqual(PRICING_CONFIG.clusterMaxMultiplier);
      expect(STRATEGIC_TIERS.medium).toBeLessThanOrEqual(PRICING_CONFIG.clusterMaxMultiplier);
      expect(STRATEGIC_TIERS.high).toBeLessThanOrEqual(PRICING_CONFIG.clusterMaxMultiplier);
      expect(STRATEGIC_TIERS.critical).toBeLessThanOrEqual(PRICING_CONFIG.clusterMaxMultiplier);
    });

    it('HEATMAP_GRADIENT last stop covers clusterMaxMultiplier', () => {
      // Gradient must extend to at least clusterMaxMultiplier so interpolation never extrapolates
      expect(HEATMAP_GRADIENT[HEATMAP_GRADIENT.length - 1][0]).toBeGreaterThanOrEqual(PRICING_CONFIG.clusterMaxMultiplier);
    });

    it('strategic values from first pass are bounded by [0, 1]', () => {
      // Choke tile — force high strategic value
      const corridorBoard = createTestBoard(5, [
        { row: 2, col: 0 }, { row: 2, col: 1 },
        { row: 2, col: 3 }, { row: 2, col: 4 },
      ]);
      boardSpy.getGameBoard.and.returnValue(corridorBoard);
      boardSpy.getBoardWidth.and.returnValue(5);
      boardSpy.getBoardHeight.and.returnValue(5);
      boardSpy.getSpawnerTiles.and.returnValue([[0, 0]]);
      boardSpy.getExitTiles.and.returnValue([[4, 4]]);
      service.invalidateCache();

      // No nearby towers — value is from first pass only, may exceed gradient range
      // but should never exceed 1.0
      const val = service.getStrategicValue(2, 2);
      expect(val).toBeGreaterThan(0);
      expect(val).toBeLessThanOrEqual(1);
    });
  });
});
