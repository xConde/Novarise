import { SpatialGrid, SPATIAL_GRID_CONFIG } from './spatial-grid';
import { Enemy, EnemyType } from '../models/enemy.model';

describe('SpatialGrid', () => {
  let grid: SpatialGrid;

  function createEnemy(id: string, x: number, z: number, health = 100): Enemy {
    return {
      id,
      type: EnemyType.BASIC,
      position: { x, y: 0.3, z },
      gridPosition: { row: 0, col: 0 },
      health,
      maxHealth: health,
      speed: 2,
      value: 10,
      path: [],
      pathIndex: 0,
      distanceTraveled: 0
    };
  }

  beforeEach(() => {
    grid = new SpatialGrid();
  });

  // --- Config ---

  it('should have a default cell size from SPATIAL_GRID_CONFIG', () => {
    expect(SPATIAL_GRID_CONFIG.cellSize).toBe(3);
  });

  it('should accept a custom cell size', () => {
    const customGrid = new SpatialGrid(5);
    const enemy = createEnemy('e1', 0, 0);
    customGrid.insert(enemy);
    const results = customGrid.queryRadius(0, 0, 1);
    expect(results).toContain(enemy);
  });

  // --- Empty grid ---

  it('should return no results from an empty grid', () => {
    const results = grid.queryRadius(0, 0, 10);
    expect(results.length).toBe(0);
  });

  // --- Single enemy ---

  it('should find a single enemy within query range', () => {
    const enemy = createEnemy('e1', 1, 1);
    grid.insert(enemy);

    const results = grid.queryRadius(1, 1, 2);
    expect(results).toContain(enemy);
  });

  it('should return enemy when query center is in a different cell but within radius', () => {
    const enemy = createEnemy('e1', 2.9, 0);
    grid.insert(enemy);

    // Query from (0, 0) with radius 3 — enemy at 2.9 is within broad-phase range
    const results = grid.queryRadius(0, 0, 3);
    expect(results).toContain(enemy);
  });

  it('should NOT return enemy when query range does not cover the enemy cell', () => {
    const enemy = createEnemy('e1', 10, 10);
    grid.insert(enemy);

    // Query from origin with tiny radius — cell (3,3) not covered
    const results = grid.queryRadius(0, 0, 1);
    expect(results.length).toBe(0);
  });

  // --- Multiple enemies ---

  it('should find multiple enemies in the same cell', () => {
    const e1 = createEnemy('e1', 0.5, 0.5);
    const e2 = createEnemy('e2', 1.0, 1.0);
    grid.insert(e1);
    grid.insert(e2);

    const results = grid.queryRadius(0.5, 0.5, 1);
    expect(results).toContain(e1);
    expect(results).toContain(e2);
  });

  it('should find enemies across cell boundaries with large radius', () => {
    const e1 = createEnemy('e1', 0, 0);
    const e2 = createEnemy('e2', 5, 5);
    const e3 = createEnemy('e3', -4, -4);
    grid.insert(e1);
    grid.insert(e2);
    grid.insert(e3);

    const results = grid.queryRadius(0, 0, 8);
    expect(results).toContain(e1);
    expect(results).toContain(e2);
    expect(results).toContain(e3);
  });

  it('should return only enemies in nearby cells, not distant ones', () => {
    const nearby = createEnemy('nearby', 1, 1);
    const farAway = createEnemy('far', 20, 20);
    grid.insert(nearby);
    grid.insert(farAway);

    const results = grid.queryRadius(0, 0, 3);
    expect(results).toContain(nearby);
    expect(results).not.toContain(farAway);
  });

  // --- Cell boundaries ---

  it('should handle enemies exactly at cell boundary (x = cellSize)', () => {
    const enemy = createEnemy('e1', 3, 0); // Exactly at boundary of cell (0,0) and (1,0)
    grid.insert(enemy);

    // Query from (0, 0) with radius covering the boundary
    const results = grid.queryRadius(0, 0, 3);
    expect(results).toContain(enemy);
  });

  it('should handle enemies at negative coordinates', () => {
    const enemy = createEnemy('e1', -2, -2);
    grid.insert(enemy);

    const results = grid.queryRadius(-2, -2, 1);
    expect(results).toContain(enemy);
  });

  it('should handle queries spanning negative and positive cells', () => {
    const eNeg = createEnemy('neg', -1, -1);
    const ePos = createEnemy('pos', 1, 1);
    grid.insert(eNeg);
    grid.insert(ePos);

    const results = grid.queryRadius(0, 0, 2);
    expect(results).toContain(eNeg);
    expect(results).toContain(ePos);
  });

  // --- Clear ---

  it('should return no results after clear()', () => {
    const enemy = createEnemy('e1', 1, 1);
    grid.insert(enemy);
    expect(grid.queryRadius(1, 1, 2).length).toBe(1);

    grid.clear();
    expect(grid.queryRadius(1, 1, 2).length).toBe(0);
  });

  it('should allow re-insertion after clear()', () => {
    const e1 = createEnemy('e1', 1, 1);
    grid.insert(e1);
    grid.clear();

    const e2 = createEnemy('e2', 2, 2);
    grid.insert(e2);

    const results = grid.queryRadius(2, 2, 1);
    expect(results).toContain(e2);
    expect(results).not.toContain(e1);
  });

  // --- Edge cases ---

  it('should handle zero radius query (only the exact cell)', () => {
    const enemy = createEnemy('e1', 1, 1);
    grid.insert(enemy);

    const results = grid.queryRadius(1, 1, 0);
    // Zero radius means only the cell containing (1,1) is checked
    expect(results).toContain(enemy);
  });

  it('should return duplicates if same enemy inserted twice', () => {
    const enemy = createEnemy('e1', 1, 1);
    grid.insert(enemy);
    grid.insert(enemy);

    const results = grid.queryRadius(1, 1, 1);
    expect(results.length).toBe(2);
  });

  it('should handle very large radius without error', () => {
    const enemy = createEnemy('e1', 50, 50);
    grid.insert(enemy);

    const results = grid.queryRadius(0, 0, 100);
    expect(results).toContain(enemy);
  });
});
