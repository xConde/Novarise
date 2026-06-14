import { TestBed } from '@angular/core/testing';
import { ForwardSimulationService } from './forward-simulation.service';
import { Enemy, EnemyType, GridNode } from '../models/enemy.model';
import { PlacedTower, TowerType, TOWER_CONFIGS, TargetingMode } from '../models/tower.model';

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

function makeTower(overrides: Partial<PlacedTower> = {}): PlacedTower {
  return {
    id: 't1',
    type: TowerType.BASIC,
    level: 1,
    row: 0,
    col: 0,
    kills: 0,
    totalInvested: 0,
    targetingMode: TargetingMode.FIRST,
    mesh: null,
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

    it('returns a large but finite projection when reductions exceed base speed', () => {
      // BASIC at 1 base − 5 reduction = −4 net. Combined reductions exceed base speed,
      // so the effective rate is clamped to MIN_PROJECTION_TILES_PER_TURN (a small positive
      // value) to prevent division-by-zero. The result must be finite and much larger than
      // the unslowed projection (9 turns).
      const enemy = makeEnemy({ type: EnemyType.BASIC, path: makePath(10), pathIndex: 0 });
      const result = svc.projectTurnsToExit(enemy, /*slow*/ 5);
      expect(isFinite(result)).toBeTrue();
      expect(result).toBeGreaterThan(9);
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

  describe('NOVA_SOVEREIGN projection', () => {
    it('predicts base 1 tile/turn for a non-enraged sovereign', () => {
      // NOVA_SOVEREIGN base tilesPerTurn = 1 → 9 tiles → 9 turns
      const enemy = makeEnemy({ type: EnemyType.NOVA_SOVEREIGN, path: makePath(10), pathIndex: 0 });
      expect(svc.projectTurnsToExit(enemy)).toBe(9);
    });

    it('predicts 2 tiles/turn for an enraged sovereign', () => {
      // Enrage sets enragedTilesPerTurn = base(1) + bonus(1) = 2 → ceil(9/2) = 5 turns
      const enemy = makeEnemy({
        type: EnemyType.NOVA_SOVEREIGN,
        path: makePath(10),
        pathIndex: 0,
        isEnraged: true,
        enragedTilesPerTurn: 2,
      });
      expect(svc.projectTurnsToExit(enemy)).toBe(5);
    });

    it('projectGridPosition advances 2 tiles/turn for an enraged sovereign', () => {
      const enemy = makeEnemy({
        type: EnemyType.NOVA_SOVEREIGN,
        path: makePath(10),
        pathIndex: 0,
        isEnraged: true,
        enragedTilesPerTurn: 2,
      });
      // pathIndex 0 + 2*3 = 6; path[6] → row=0, col=6
      expect(svc.projectGridPosition(enemy, 3)).toEqual({ row: 0, col: 6 });
    });

    it('halves a SLOW tile reduction of 1 down to 0 against the sovereign', () => {
      // Enraged at 2 tiles/turn, slow=1: floor(1 * 0.5) = 0 reduction → still 2
      // tiles/turn → 5 turns. Without resistance this would be 2−1=1 → 9 turns.
      const enemy = makeEnemy({
        type: EnemyType.NOVA_SOVEREIGN,
        path: makePath(10),
        pathIndex: 0,
        isEnraged: true,
        enragedTilesPerTurn: 2,
      });
      expect(svc.projectTurnsToExit(enemy, /*slow*/ 1)).toBe(5);
    });

    it('does not halve SLOW reduction for non-sovereign enemies', () => {
      // FAST at 2 tiles/turn with slow=1 takes the full reduction → 1 tile/turn → 9 turns
      const enemy = makeEnemy({ type: EnemyType.FAST, path: makePath(10), pathIndex: 0 });
      expect(svc.projectTurnsToExit(enemy, /*slow*/ 1)).toBe(9);
    });

    it('ignores the enrage flag when enragedTilesPerTurn is undefined (defensive)', () => {
      const enemy = makeEnemy({
        type: EnemyType.NOVA_SOVEREIGN,
        path: makePath(10),
        pathIndex: 0,
        isEnraged: true,
      });
      expect(svc.projectTurnsToExit(enemy)).toBe(9);
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

  describe('projectIncomingDamageNextTurn', () => {
    it('returns 0 when there are no towers', () => {
      const enemy = makeEnemy({ id: 'e1' });
      const towers = new Map<string, PlacedTower>();
      const result = svc.projectIncomingDamageNextTurn(enemy, towers, () => null);
      expect(result).toBe(0);
    });

    it('returns 0 when no tower targets this enemy', () => {
      const enemy = makeEnemy({ id: 'e1' });
      const otherEnemy = makeEnemy({ id: 'e2' });
      const tower = makeTower({ id: 't1', row: 0, col: 0 });
      const towers = new Map([['0-0', tower]]);
      // getTowerTarget always returns a different enemy
      const result = svc.projectIncomingDamageNextTurn(enemy, towers, () => otherEnemy);
      expect(result).toBe(0);
    });

    it('returns damage from a single BASIC L1 tower targeting this enemy', () => {
      // BASIC L1 damage = TOWER_CONFIGS[BASIC].damage = 25
      const enemy = makeEnemy({ id: 'e1' });
      const tower = makeTower({ id: 't1', type: TowerType.BASIC, level: 1, row: 0, col: 0 });
      const towers = new Map([['0-0', tower]]);
      const result = svc.projectIncomingDamageNextTurn(enemy, towers, () => enemy);
      expect(result).toBe(TOWER_CONFIGS[TowerType.BASIC].damage);
    });

    it('sums damage from multiple towers all targeting the same enemy', () => {
      const enemy = makeEnemy({ id: 'e1' });
      const tower1 = makeTower({ id: 't1', type: TowerType.BASIC, level: 1, row: 0, col: 0 });
      const tower2 = makeTower({ id: 't2', type: TowerType.SNIPER, level: 1, row: 1, col: 1 });
      const towers = new Map([['0-0', tower1], ['1-1', tower2]]);
      const result = svc.projectIncomingDamageNextTurn(enemy, towers, () => enemy);
      const expected = TOWER_CONFIGS[TowerType.BASIC].damage + TOWER_CONFIGS[TowerType.SNIPER].damage;
      expect(result).toBe(expected);
    });

    it('skips towers targeting a different enemy', () => {
      const targetEnemy = makeEnemy({ id: 'e1' });
      const otherEnemy = makeEnemy({ id: 'e2' });
      const towerForTarget = makeTower({ id: 't1', type: TowerType.BASIC, level: 1, row: 0, col: 0 });
      const towerForOther = makeTower({ id: 't2', type: TowerType.SNIPER, level: 1, row: 1, col: 1 });
      const towers = new Map([['0-0', towerForTarget], ['1-1', towerForOther]]);
      const getTowerTarget = (tower: PlacedTower) =>
        tower.id === 't1' ? targetEnemy : otherEnemy;
      const result = svc.projectIncomingDamageNextTurn(targetEnemy, towers, getTowerTarget);
      // Only towerForTarget (BASIC L1 = 25) should contribute
      expect(result).toBe(TOWER_CONFIGS[TowerType.BASIC].damage);
    });

    it('returns 0 when getTowerTarget returns null for all towers', () => {
      const enemy = makeEnemy({ id: 'e1' });
      const tower = makeTower({ id: 't1', type: TowerType.BASIC, level: 1, row: 0, col: 0 });
      const towers = new Map([['0-0', tower]]);
      const result = svc.projectIncomingDamageNextTurn(enemy, towers, () => null);
      expect(result).toBe(0);
    });

    it('uses getEffectiveStats — L2 tower applies the L2 damage multiplier', () => {
      // getEffectiveStats returns level-scaled damage; L2 has a multiplier > 1
      const enemy = makeEnemy({ id: 'e1' });
      const tower = makeTower({ id: 't1', type: TowerType.BASIC, level: 2, row: 0, col: 0 });
      const towers = new Map([['0-0', tower]]);
      const result = svc.projectIncomingDamageNextTurn(enemy, towers, () => enemy);
      // L1 base = 25; L2 should be greater
      expect(result).toBeGreaterThan(TOWER_CONFIGS[TowerType.BASIC].damage);
    });
  });

  describe('fractional card-modifier speed slow projection', () => {
    it('projects more turns for a 1-tile enemy under 15% card speed slow', () => {
      // BASIC (1 tile/turn) with 15% card-modifier slow: effective rate = 0.85 tiles/turn
      // 9 tiles / 0.85 = 10.6 → Math.ceil = 11 turns (vs 9 unslowed)
      const enemy = makeEnemy({ type: EnemyType.BASIC, path: makePath(10), pathIndex: 0 });
      const slowed = svc.projectTurnsToExit(enemy, 0, 0.15);
      const unslowed = svc.projectTurnsToExit(enemy, 0, 0);
      expect(slowed).toBeGreaterThan(unslowed);
    });

    it('returns ceil(tilesRemaining / (baseTiles*(1-slowPct))) for 1-tile mover at 15% slow', () => {
      // BASIC: rate = 1*(1-0.15) = 0.85, 9 tiles → ceil(9/0.85) = 11
      const enemy = makeEnemy({ type: EnemyType.BASIC, path: makePath(10), pathIndex: 0 });
      expect(svc.projectTurnsToExit(enemy, 0, 0.15)).toBe(11);
    });

    it('projection with 50% card slow takes twice as many turns for a 1-tile mover', () => {
      // rate = 0.5, 9 tiles → ceil(9/0.5) = 18
      const enemy = makeEnemy({ type: EnemyType.BASIC, path: makePath(10), pathIndex: 0 });
      expect(svc.projectTurnsToExit(enemy, 0, 0.5)).toBe(18);
    });

    it('forward-sim and live accumulator agree: 15% slow skips a turn within 12 turns for BASIC', () => {
      // rate = 0.85 per turn. After 12 turns: 12 * 0.85 = 10.2 tiles → the enemy
      // crosses the exit (9 tiles away) between turn 10 and 11. projection returns 11.
      const enemy = makeEnemy({ type: EnemyType.BASIC, path: makePath(10), pathIndex: 0 });
      const turns = svc.projectTurnsToExit(enemy, 0, 0.15);
      // The enemy takes more than 9 turns (unslowed value)
      expect(turns).toBeGreaterThan(9);
      // But no more than 12 turns (sanity ceiling)
      expect(turns).toBeLessThanOrEqual(12);
    });
  });
});
