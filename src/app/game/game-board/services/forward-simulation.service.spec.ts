import { TestBed } from '@angular/core/testing';
import { ForwardSimulationService } from './forward-simulation.service';
import { Enemy, EnemyType, GridNode } from '../models/enemy.model';

function makePath(length: number): GridNode[] {
  const nodes: GridNode[] = [];
  for (let i = 0; i < length; i++) {
    nodes.push({ x: i, y: 0, f: 0, g: 0, h: 0 });
  }
  return nodes;
}

function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 'e1',
    type: EnemyType.BASIC,
    position: { x: 0, y: 0, z: 0 },
    gridPosition: { row: 0, col: 0 },
    health: 10,
    maxHealth: 10,
    speed: 1,
    value: 5,
    path: makePath(10),
    pathIndex: 0,
    distanceTraveled: 0,
    leakDamage: 1,
    ...overrides,
  };
}

describe('ForwardSimulationService', () => {
  let svc: ForwardSimulationService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ForwardSimulationService] });
    svc = TestBed.inject(ForwardSimulationService);
  });

  describe('projectTurnsToExit', () => {
    it('returns 0 when path is empty', () => {
      const enemy = makeEnemy({ path: [] });
      expect(svc.projectTurnsToExit(enemy)).toBe(0);
    });

    it('returns 0 when enemy already at last path node', () => {
      const path = makePath(5);
      const enemy = makeEnemy({ path, pathIndex: path.length - 1 });
      expect(svc.projectTurnsToExit(enemy)).toBe(0);
    });

    it('uses tilesPerTurn for a 1-tile-per-turn enemy across 9 remaining tiles', () => {
      // BASIC.tilesPerTurn = 1, path length 10, pathIndex 0 → 9 tiles to traverse
      const enemy = makeEnemy({ type: EnemyType.BASIC, path: makePath(10), pathIndex: 0 });
      expect(svc.projectTurnsToExit(enemy)).toBe(9);
    });

    it('uses tilesPerTurn for a 2-tile-per-turn enemy', () => {
      // FAST.tilesPerTurn = 2, path length 10, pathIndex 0 → 9 tiles → ceil(9/2) = 5
      const enemy = makeEnemy({ type: EnemyType.FAST, path: makePath(10), pathIndex: 0 });
      expect(svc.projectTurnsToExit(enemy)).toBe(5);
    });

    it('subtracts SLOW tile reduction floored at 1', () => {
      // FAST at 2 tiles/turn − 1 SLOW reduction = 1 tile/turn → 9 tiles → 9 turns
      const enemy = makeEnemy({ type: EnemyType.FAST, path: makePath(10), pathIndex: 0 });
      expect(svc.projectTurnsToExit(enemy, /*slow*/ 1)).toBe(9);
    });

    it('floors at 1 tile/turn even when reductions exceed base speed', () => {
      // BASIC at 1 base − 5 reduction = −4, but min-floor is 1 → 9 turns over 9 tiles
      const enemy = makeEnemy({ type: EnemyType.BASIC, path: makePath(10), pathIndex: 0 });
      expect(svc.projectTurnsToExit(enemy, /*slow*/ 5)).toBe(9);
    });

    it('applies VEINSEEKER boost when flagged', () => {
      // VEINSEEKER base 1 → boosted 2 → 9 tiles → ceil(9/2) = 5
      const enemy = makeEnemy({ type: EnemyType.VEINSEEKER, path: makePath(10), pathIndex: 0 });
      expect(svc.projectTurnsToExit(enemy, 0, 0, /*boost*/ true)).toBe(5);
    });

    it('ignores VEINSEEKER boost when flag is false', () => {
      const enemy = makeEnemy({ type: EnemyType.VEINSEEKER, path: makePath(10), pathIndex: 0 });
      expect(svc.projectTurnsToExit(enemy, 0, 0, /*boost*/ false)).toBe(9);
    });

    it('honors mid-path pathIndex', () => {
      // BASIC, path length 10, pathIndex 7 → 2 tiles remaining, 1 tile/turn → 2 turns
      const enemy = makeEnemy({ type: EnemyType.BASIC, path: makePath(10), pathIndex: 7 });
      expect(svc.projectTurnsToExit(enemy)).toBe(2);
    });
  });

  describe('projectGridPosition', () => {
    it('returns current gridPosition when path is empty', () => {
      const enemy = makeEnemy({ path: [], gridPosition: { row: 3, col: 4 } });
      const pos = svc.projectGridPosition(enemy, 5);
      expect(pos).toEqual({ row: 3, col: 4 });
    });

    it('clamps to last path node when projection exceeds path length', () => {
      const enemy = makeEnemy({ type: EnemyType.BASIC, path: makePath(5), pathIndex: 0 });
      const pos = svc.projectGridPosition(enemy, 100);
      // path[length-1] = { x: 4, y: 0 } → row=0, col=4
      expect(pos).toEqual({ row: 0, col: 4 });
    });

    it('advances baseTiles per turn for a 1-tile mover', () => {
      const enemy = makeEnemy({ type: EnemyType.BASIC, path: makePath(10), pathIndex: 2 });
      const pos = svc.projectGridPosition(enemy, 3);
      // pathIndex 2 + 1*3 = 5; path[5] = { x:5, y:0 } → row=0, col=5
      expect(pos).toEqual({ row: 0, col: 5 });
    });

    it('advances baseTiles per turn for a 2-tile mover', () => {
      const enemy = makeEnemy({ type: EnemyType.FAST, path: makePath(10), pathIndex: 0 });
      const pos = svc.projectGridPosition(enemy, 3);
      // pathIndex 0 + 2*3 = 6; path[6] → row=0, col=6
      expect(pos).toEqual({ row: 0, col: 6 });
    });
  });

  describe('willLeakWithin', () => {
    it('true when projected turns-to-exit is within horizon', () => {
      // FAST, 9 tiles, 2/turn → 5 turns to exit; horizon 5 → leaks
      const enemy = makeEnemy({ type: EnemyType.FAST, path: makePath(10), pathIndex: 0 });
      expect(svc.willLeakWithin(enemy, 5)).toBeTrue();
    });

    it('false when projected turns-to-exit exceeds horizon', () => {
      const enemy = makeEnemy({ type: EnemyType.BASIC, path: makePath(10), pathIndex: 0 });
      // 9 turns to exit, horizon 5 → does not leak in window
      expect(svc.willLeakWithin(enemy, 5)).toBeFalse();
    });

    it('false when enemy already at exit (no future leak)', () => {
      const path = makePath(5);
      const enemy = makeEnemy({ path, pathIndex: path.length - 1 });
      expect(svc.willLeakWithin(enemy, 10)).toBeFalse();
    });
  });
});
