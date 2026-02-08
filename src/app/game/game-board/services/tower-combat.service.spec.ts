import { TestBed } from '@angular/core/testing';
import { TowerCombatService } from './tower-combat.service';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { TowerType, TOWER_CONFIGS } from '../models/tower.model';
import { Enemy, EnemyType } from '../models/enemy.model';
import * as THREE from 'three';

describe('TowerCombatService', () => {
  let service: TowerCombatService;
  let enemyServiceSpy: jasmine.SpyObj<EnemyService>;
  let gameBoardServiceSpy: jasmine.SpyObj<GameBoardService>;
  let mockScene: THREE.Scene;
  let enemyMap: Map<string, Enemy>;

  // Tower at row=10, col=12 on a 25x20 board → world position: (-0.5, 0)
  const TOWER_ROW = 10;
  const TOWER_COL = 12;
  const TOWER_WORLD_X = -0.5;
  const TOWER_WORLD_Z = 0;

  // Helper: create a mock enemy at a world position
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
    enemyMap = new Map();

    enemyServiceSpy = jasmine.createSpyObj('EnemyService', ['getEnemies', 'damageEnemy']);
    enemyServiceSpy.getEnemies.and.returnValue(enemyMap);
    enemyServiceSpy.damageEnemy.and.callFake((id: string, damage: number) => {
      const enemy = enemyMap.get(id);
      if (!enemy || enemy.health <= 0) return false;
      enemy.health -= damage;
      return enemy.health <= 0;
    });

    gameBoardServiceSpy = jasmine.createSpyObj('GameBoardService', [
      'getBoardWidth', 'getBoardHeight', 'getTileSize'
    ]);
    gameBoardServiceSpy.getBoardWidth.and.returnValue(25);
    gameBoardServiceSpy.getBoardHeight.and.returnValue(20);
    gameBoardServiceSpy.getTileSize.and.returnValue(1);

    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        { provide: EnemyService, useValue: enemyServiceSpy },
        { provide: GameBoardService, useValue: gameBoardServiceSpy }
      ]
    });
    service = TestBed.inject(TowerCombatService);
    mockScene = new THREE.Scene();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- Tower Registration ---

  describe('registerTower', () => {
    it('should register a tower', () => {
      service.registerTower(5, 5, TowerType.BASIC, new THREE.Group());
      expect(service.getTower('5-5')).toBeTruthy();
    });

    it('should store correct tower properties', () => {
      const mesh = new THREE.Group();
      service.registerTower(3, 7, TowerType.SNIPER, mesh);
      const tower = service.getTower('3-7')!;

      expect(tower.type).toBe(TowerType.SNIPER);
      expect(tower.row).toBe(3);
      expect(tower.col).toBe(7);
      expect(tower.kills).toBe(0);
      expect(tower.mesh).toBe(mesh);
    });

    it('should allow multiple towers', () => {
      service.registerTower(1, 1, TowerType.BASIC, new THREE.Group());
      service.registerTower(2, 2, TowerType.SNIPER, new THREE.Group());
      service.registerTower(3, 3, TowerType.SPLASH, new THREE.Group());

      expect(service.getPlacedTowers().size).toBe(3);
    });
  });

  // --- Targeting ---

  describe('targeting', () => {
    it('should not fire when no enemies are in range', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy far away — BASIC range is 3, place at distance ~20
      const enemy = createEnemy('e1', 20, 20);
      enemyMap.set('e1', enemy);

      const kills = service.update(2.0, mockScene);
      expect(kills.length).toBe(0);
      // Enemy health should be unchanged
      expect(enemy.health).toBe(100);
    });

    it('should fire at an enemy within range (verified by damage)', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy at tower position — projectile hits on same frame it's created
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', enemy);

      service.update(2.0, mockScene);
      // Projectile was created AND hit in same frame (dist=0)
      expect(enemy.health).toBeLessThan(1000);
    });

    it('should target nearest enemy when multiple are in range', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Near enemy at tower position — distance 0
      const nearEnemy = createEnemy('near', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('near', nearEnemy);

      // Far enemy at (2, 2) — distance ~2.9
      const farEnemy = createEnemy('far', 2, 2, 1000);
      enemyMap.set('far', farEnemy);

      // Fire — projectile targets nearest and hits immediately (dist=0)
      service.update(2.0, mockScene);

      // Near enemy should take damage, far enemy should not
      expect(nearEnemy.health).toBeLessThan(1000);
      expect(farEnemy.health).toBe(1000);
    });

    it('should skip dead enemies when targeting', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Dead enemy at tower position
      const dead = createEnemy('dead', TOWER_WORLD_X, TOWER_WORLD_Z, 100);
      dead.health = 0;
      enemyMap.set('dead', dead);

      // Living enemy in range
      const alive = createEnemy('alive', TOWER_WORLD_X + 1, TOWER_WORLD_Z, 1000);
      enemyMap.set('alive', alive);

      // Fire and advance enough for projectile to travel 1 tile
      service.update(0.016, mockScene);
      service.update(0.5, mockScene);

      // Dead enemy should still be at 0, alive should take damage
      expect(dead.health).toBe(0);
      expect(alive.health).toBeLessThan(1000);
    });
  });

  // --- Fire Rate ---

  describe('fire rate', () => {
    it('should respect fire rate cooldown (single damage application)', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      // Enemy at tower position — each shot hits instantly
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', enemy);

      // First shot — fires immediately, hits instantly (dmg 25)
      service.update(0.5, mockScene);
      expect(enemy.health).toBe(10000 - 25);

      // 0.4s later — BASIC fire rate is 1.0s, should NOT fire again
      service.update(0.4, mockScene);
      expect(enemy.health).toBe(10000 - 25); // No additional damage
    });

    it('should fire again after cooldown expires', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', enemy);

      // First shot — instant hit
      service.update(0.016, mockScene);
      expect(enemy.health).toBe(10000 - 25);

      // Advance past fire rate (1.0s) — second shot fires and hits
      service.update(1.1, mockScene);
      expect(enemy.health).toBe(10000 - 50); // Two hits of 25 damage
    });
  });

  // --- Damage ---

  describe('damage', () => {
    it('should apply damage when projectile hits', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy at tower position — instant hit
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', enemy);

      service.update(0.016, mockScene);
      expect(enemy.health).toBe(1000 - TOWER_CONFIGS[TowerType.BASIC].damage);
    });

    it('should return killed enemy IDs on the frame the kill happens', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy with exactly lethal health — dies from first hit
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 25);
      enemyMap.set('e1', enemy);

      // First update: tower fires AND projectile hits (dist=0) → kill
      const kills = service.update(0.016, mockScene);
      expect(kills).toContain('e1');
    });

    it('should not report kill for surviving enemy', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', enemy);

      const kills = service.update(0.016, mockScene);
      expect(kills).not.toContain('e1');
    });
  });

  // --- Splash Damage ---

  describe('splash damage', () => {
    it('should damage multiple enemies within splash radius', () => {
      // SPLASH tower: range=3.5, splashRadius=1.5, damage=15
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SPLASH, new THREE.Group());

      // Primary target at tower position — instant hit
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      // Secondary target within splash radius (0.5 units away)
      const e2 = createEnemy('e2', TOWER_WORLD_X + 0.5, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      service.update(0.016, mockScene);

      // Primary target should definitely be damaged
      expect(e1.health).toBeLessThan(1000);
      // Secondary within splashRadius=1.5 should also be damaged
      expect(e2.health).toBeLessThan(1000);
    });

    it('should not damage enemies outside splash radius', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SPLASH, new THREE.Group());

      // Primary target at tower position
      const near = createEnemy('near', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      // Far target outside splash radius (splashRadius=1.5)
      const far = createEnemy('far', TOWER_WORLD_X + 2.5, TOWER_WORLD_Z, 1000);
      enemyMap.set('near', near);
      enemyMap.set('far', far);

      service.update(0.016, mockScene);

      expect(near.health).toBeLessThan(1000);
      expect(far.health).toBe(1000); // Out of splash range
    });
  });

  // --- Projectile Lifecycle ---

  describe('projectile lifecycle', () => {
    it('should clean up projectile when target is removed from map', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy at distance — projectile needs time to travel
      const enemy = createEnemy('e1', TOWER_WORLD_X + 2, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', enemy);

      // Fire — projectile is in flight
      service.update(0.016, mockScene);
      // Enemy health unchanged (projectile still traveling)
      expect(enemy.health).toBe(1000);

      // Remove enemy from map before projectile arrives
      enemyMap.delete('e1');

      // Next update: projectile should detect missing target and self-destruct
      // No crash expected
      const kills = service.update(0.016, mockScene);
      expect(kills.length).toBe(0);
    });

    it('should not crash on rapid fire and miss cycle', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      const enemy = createEnemy('e1', TOWER_WORLD_X + 2, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', enemy);

      // Fire
      service.update(0.016, mockScene);

      // Remove and re-add enemy (simulating external kill + respawn)
      enemyMap.delete('e1');
      service.update(0.016, mockScene);

      const newEnemy = createEnemy('e2', TOWER_WORLD_X + 1, TOWER_WORLD_Z, 1000);
      enemyMap.set('e2', newEnemy);

      // Advance past fire rate — tower should target new enemy
      service.update(1.1, mockScene);
      service.update(0.5, mockScene);
      expect(newEnemy.health).toBeLessThan(1000);
    });
  });

  // --- Kill Tracking ---

  describe('kill tracking', () => {
    it('should increment tower kill count', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy that dies in one hit (at tower position for instant hit)
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1);
      enemyMap.set('e1', enemy);

      service.update(0.016, mockScene);

      const tower = service.getTower(`${TOWER_ROW}-${TOWER_COL}`)!;
      expect(tower.kills).toBe(1);
    });

    it('should track kills across multiple enemies', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // First enemy — dies in one hit
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1);
      enemyMap.set('e1', e1);
      service.update(0.016, mockScene);

      // Remove dead enemy, add new one
      enemyMap.delete('e1');
      const e2 = createEnemy('e2', TOWER_WORLD_X, TOWER_WORLD_Z, 1);
      enemyMap.set('e2', e2);

      // Advance past fire rate for second kill
      service.update(1.1, mockScene);

      const tower = service.getTower(`${TOWER_ROW}-${TOWER_COL}`)!;
      expect(tower.kills).toBe(2);
    });
  });

  // --- Cleanup ---

  describe('cleanup', () => {
    it('should clear all towers', () => {
      service.registerTower(1, 1, TowerType.BASIC, new THREE.Group());
      service.registerTower(2, 2, TowerType.SNIPER, new THREE.Group());

      service.cleanup(mockScene);
      expect(service.getPlacedTowers().size).toBe(0);
    });

    it('should reset game time so new towers fire immediately', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', enemy);

      // Advance game time significantly
      service.update(5.0, mockScene);
      service.cleanup(mockScene);

      // Register new tower after cleanup
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const freshEnemy = createEnemy('e2', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.clear();
      enemyMap.set('e2', freshEnemy);

      // New tower should fire immediately (gameTime reset)
      service.update(0.016, mockScene);
      expect(freshEnemy.health).toBeLessThan(10000);
    });

    it('should not throw when cleaning up with no projectiles', () => {
      expect(() => service.cleanup(mockScene)).not.toThrow();
    });
  });

  // --- Edge Cases ---

  describe('edge cases', () => {
    it('should handle update with no towers', () => {
      const enemy = createEnemy('e1', 0, 0);
      enemyMap.set('e1', enemy);

      const kills = service.update(1.0, mockScene);
      expect(kills.length).toBe(0);
    });

    it('should handle update with no enemies', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const kills = service.update(1.0, mockScene);
      expect(kills.length).toBe(0);
    });

    it('should handle zero deltaTime', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z);
      enemyMap.set('e1', enemy);

      const kills = service.update(0, mockScene);
      expect(kills.length).toBe(0);
    });

    it('should not double-count kills from multiple projectiles in same frame', () => {
      // Two towers targeting the same enemy
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      service.registerTower(TOWER_ROW, TOWER_COL + 1, TowerType.BASIC, new THREE.Group());

      // Enemy with health that dies from first hit
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1);
      enemyMap.set('e1', enemy);

      const kills = service.update(0.016, mockScene);

      // Should only report the kill once (second projectile sees health <= 0)
      const e1Kills = kills.filter(id => id === 'e1');
      expect(e1Kills.length).toBe(1);
    });
  });
});
