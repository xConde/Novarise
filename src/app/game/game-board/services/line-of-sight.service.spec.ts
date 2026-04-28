import { TestBed } from '@angular/core/testing';
import { LineOfSightService } from './line-of-sight.service';
import { GameBoardService } from '../game-board.service';
import { ElevationService } from './elevation.service';
import { BOARD_CONFIG } from '../constants/board.constants';

/**
 * LineOfSightService spec — sprint 26 (Highground phase).
 *
 * Test harness: 10×10 board, tileSize=1. Tower at (5,5), world center (0,0).
 *   worldX = (col - 5) * 1
 *   worldZ = (row - 5) * 1
 * Enemy world positions are placed so that they resolve to known grid cells.
 *
 * Elevation is controlled via the ElevationService spy.
 */
describe('LineOfSightService', () => {
  const BOARD_W = 10;
  const BOARD_H = 10;
  const TILE_SIZE = 1;
  const _TILE_HEIGHT = BOARD_CONFIG.tileHeight; // 0.2 — documented for test harness reference

  // Convert grid (row, col) to world (x, z) for this test harness
  function toWorld(row: number, col: number): { x: number; z: number } {
    return {
      x: (col - BOARD_W / 2) * TILE_SIZE,
      z: (row - BOARD_H / 2) * TILE_SIZE,
    };
  }

  let service: LineOfSightService;
  let elevationSpy: jasmine.SpyObj<ElevationService>;
  let gameBoardSpy: jasmine.SpyObj<GameBoardService>;

  /** Elevation map: row-col → elevation value */
  let elevationMap: Map<string, number>;

  beforeEach(() => {
    elevationMap = new Map();

    gameBoardSpy = jasmine.createSpyObj<GameBoardService>('GameBoardService', [
      'getBoardWidth', 'getBoardHeight', 'getTileSize', 'getGameBoard',
    ]);
    gameBoardSpy.getBoardWidth.and.returnValue(BOARD_W);
    gameBoardSpy.getBoardHeight.and.returnValue(BOARD_H);
    gameBoardSpy.getTileSize.and.returnValue(TILE_SIZE);

    elevationSpy = jasmine.createSpyObj<ElevationService>('ElevationService', [
      'getElevation',
    ]);
    elevationSpy.getElevation.and.callFake((row: number, col: number): number => {
      return elevationMap.get(`${row}-${col}`) ?? 0;
    });

    TestBed.configureTestingModule({
      providers: [
        LineOfSightService,
        { provide: GameBoardService, useValue: gameBoardSpy },
        { provide: ElevationService, useValue: elevationSpy },
      ],
    });

    service = TestBed.inject(LineOfSightService);
  });

  // ── 1. Flat board — always visible ──────────────────────────────────────────

  it('returns true on a fully flat board (elevation 0 everywhere)', () => {
    // tower (2,2) → enemy (7,7), no elevated tiles
    const enemy = toWorld(7, 7);
    expect(service.isVisible(2, 2, enemy.x, enemy.z)).toBeTrue();
  });

  it('returns true when tower and enemy are in same row on flat board', () => {
    const enemy = toWorld(5, 8);
    expect(service.isVisible(5, 2, enemy.x, enemy.z)).toBeTrue();
  });

  it('returns true on a diagonal ray with flat board', () => {
    const enemy = toWorld(8, 8);
    expect(service.isVisible(2, 2, enemy.x, enemy.z)).toBeTrue();
  });

  // ── 2. Raised intervening tile — occluded ───────────────────────────────────

  it('returns false when a raised tile sits between tower and enemy (horizontal ray)', () => {
    // Tower (5,2), enemy (5,8). Raise tile (5,5) to elevation 3.
    // towerY = 0 + 0.2 = 0.2.  enemyY = 0 + 0.2 = 0.2.
    // rayY at (5,5) is 0.2.  tileTopY at (5,5) = 3 + 0.2 = 3.2 > 0.2 → blocked.
    elevationMap.set('5-5', 3);
    const enemy = toWorld(5, 8);
    expect(service.isVisible(5, 2, enemy.x, enemy.z)).toBeFalse();
  });

  it('returns false when a raised tile occludes on a vertical ray', () => {
    // Tower (2,5), enemy (8,5). Raise tile (5,5) to elevation 3.
    elevationMap.set('5-5', 3);
    const enemy = toWorld(8, 5);
    expect(service.isVisible(2, 5, enemy.x, enemy.z)).toBeFalse();
  });

  it('returns false when raised tile is midway along a diagonal ray', () => {
    // Tower (2,2), enemy (8,8). Raise tile (5,5) to elevation 3.
    elevationMap.set('5-5', 3);
    const enemy = toWorld(8, 8);
    expect(service.isVisible(2, 2, enemy.x, enemy.z)).toBeFalse();
  });

  // ── 3. Elevated tower shoots over low intervening terrain ───────────────────

  it('returns true when elevated tower shoots over elevation-1 intervening tile', () => {
    // Tower (5,2) at elevation 3. towerY = 3 + 0.2 = 3.2.
    // Enemy (5,8) at elevation 0. enemyY = 0.2.
    // Intervening tile (5,5) at elevation 1: tileTopY = 1.2.
    // At t=0.5: rayY = lerp(3.2, 0.2, 0.5) = 1.7. tileTopY 1.2 ≤ 1.7 → not blocked.
    elevationMap.set('5-2', 3);
    elevationMap.set('5-5', 1);
    const enemy = toWorld(5, 8);
    expect(service.isVisible(5, 2, enemy.x, enemy.z)).toBeTrue();
  });

  it('returns false when elevated tower cannot shoot over an even taller wall', () => {
    // Tower (5,2) at elevation 2. Enemy (5,8). Wall (5,5) at elevation 4.
    // towerY = 2.2, enemyY = 0.2. rayY at midpoint ≈ 1.2. tileTopY = 4.2 > 1.2 → blocked.
    elevationMap.set('5-2', 2);
    elevationMap.set('5-5', 4);
    const enemy = toWorld(5, 8);
    expect(service.isVisible(5, 2, enemy.x, enemy.z)).toBeFalse();
  });

  // ── 4. Depressed tile doesn't block ─────────────────────────────────────────

  it('returns true when an intervening tile is depressed (elevation -1)', () => {
    // Depressed tile tileTopY = -1 + 0.2 = -0.8, well below any positive ray.
    elevationMap.set('5-5', -1);
    const enemy = toWorld(5, 8);
    expect(service.isVisible(5, 2, enemy.x, enemy.z)).toBeTrue();
  });

  // ── 5. Edge cases — same tile, adjacent tile ─────────────────────────────────

  it('returns true when tower and enemy are on the same tile', () => {
    const { x, z } = toWorld(5, 5);
    expect(service.isVisible(5, 5, x, z)).toBeTrue();
  });

  it('returns true for horizontally adjacent tiles', () => {
    const enemy = toWorld(5, 6);
    expect(service.isVisible(5, 5, enemy.x, enemy.z)).toBeTrue();
  });

  it('returns true for vertically adjacent tiles', () => {
    const enemy = toWorld(6, 5);
    expect(service.isVisible(5, 5, enemy.x, enemy.z)).toBeTrue();
  });

  it('returns true for diagonally adjacent tiles', () => {
    const enemy = toWorld(6, 6);
    expect(service.isVisible(5, 5, enemy.x, enemy.z)).toBeTrue();
  });

  // ── 6. Out-of-bounds enemy — defensive return true ──────────────────────────

  it('returns true when enemy world coordinates resolve outside board bounds', () => {
    // Far out of bounds — worldX = 9999
    expect(service.isVisible(5, 5, 9999, 9999)).toBeTrue();
  });

  it('returns true when enemy is just off the negative edge', () => {
    expect(service.isVisible(5, 5, -9999, -9999)).toBeTrue();
  });

  // ── 7. Multiple intervening tiles, only one elevated ────────────────────────

  it('returns false when only one of several intervening tiles is elevated', () => {
    // Tower (5,0), enemy (5,9). Tiles (5,1)..(5,8) are interior.
    // Only tile (5,4) is raised to elevation 2.
    elevationMap.set('5-4', 2);
    const enemy = toWorld(5, 9);
    expect(service.isVisible(5, 0, enemy.x, enemy.z)).toBeFalse();
  });

  it('returns true when all intervening tiles are at elevation 0 on a long ray', () => {
    // No elevated tiles — flat board, long horizontal ray
    const enemy = toWorld(5, 9);
    expect(service.isVisible(5, 0, enemy.x, enemy.z)).toBeTrue();
  });

  // ── 8. Ray just clears a tile edge-on (strict > comparison) ─────────────────

  it('returns true when tileTopY equals rayY exactly (strict >, not >=)', () => {
    // Tower (5,2) at elevation 0, enemy (5,8) at elevation 0.
    // towerY = enemyY = 0.2. Ray is flat at height 0.2.
    // Interior tile at elevation 0: tileTopY = 0.2. 0.2 > 0.2 is false → not blocked.
    const enemy = toWorld(5, 8);
    expect(service.isVisible(5, 2, enemy.x, enemy.z)).toBeTrue();
  });

  it('returns false when tileTopY is strictly greater than rayY by smallest amount', () => {
    // Tower (5,2) at elev 0 (towerY=0.2), enemy (5,8) at elev 0 (enemyY=0.2).
    // Interior tile (5,5) elevation 1: tileTopY = 1.2 > 0.2 → blocked.
    elevationMap.set('5-5', 1);
    const enemy = toWorld(5, 8);
    expect(service.isVisible(5, 2, enemy.x, enemy.z)).toBeFalse();
  });

  // ── 9. Performance stress test ────────────────────────────────────────────────

  it('handles 30 enemies × 20 towers worth of queries in reasonable time', () => {
    // Perf budget: 5ms in test harness (spike §12 says < 1ms in production;
    // Karma + spy overhead adds ~3-4ms overhead on spy-wrapped service calls).
    const towerPositions: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        towerPositions.push({ row: r + 1, col: c + 1 });
      }
    }

    const enemyPositions: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < 30; i++) {
      const row = 5 + (i % 4);
      const col = 3 + (i % 5);
      enemyPositions.push(toWorld(row, col));
    }

    const start = performance.now();
    for (const tower of towerPositions) {
      for (const enemy of enemyPositions) {
        service.isVisible(tower.row, tower.col, enemy.x, enemy.z);
      }
    }
    const elapsed = performance.now() - start;

    // 5ms budget accounts for Karma spy overhead. Production (no spy) is < 1ms.
    expect(elapsed).toBeLessThan(5);
  });
});
