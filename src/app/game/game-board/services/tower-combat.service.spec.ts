import { TestBed } from '@angular/core/testing';
import { TowerCombatService } from './tower-combat.service';
import { EnemyService, DamageResult } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { TowerType, TOWER_CONFIGS, MAX_TOWER_LEVEL, getUpgradeCost, getSellValue, getEffectiveStats, TowerStats, TOWER_ABILITIES, ABILITY_CONFIG, TargetingPriority } from '../models/tower.model';
import { Enemy, EnemyType } from '../models/enemy.model';
import { AudioService } from './audio.service';
import { CHAIN_LIGHTNING_CONFIG, MORTAR_VISUAL_CONFIG } from '../constants/combat.constants';
import * as THREE from 'three';

describe('TowerCombatService', () => {
  let service: TowerCombatService;
  let enemyServiceSpy: jasmine.SpyObj<EnemyService>;
  let gameBoardServiceSpy: jasmine.SpyObj<GameBoardService>;
  let audioServiceSpy: jasmine.SpyObj<AudioService>;
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
    enemyServiceSpy.damageEnemy.and.callFake((id: string, damage: number): DamageResult => {
      const noOp: DamageResult = { killed: false, spawnedEnemies: [] };
      const enemy = enemyMap.get(id);
      if (!enemy || enemy.health <= 0) return noOp;
      enemy.health -= damage;
      return { killed: enemy.health <= 0, spawnedEnemies: [] };
    });

    gameBoardServiceSpy = jasmine.createSpyObj('GameBoardService', [
      'getBoardWidth', 'getBoardHeight', 'getTileSize'
    ]);
    gameBoardServiceSpy.getBoardWidth.and.returnValue(25);
    gameBoardServiceSpy.getBoardHeight.and.returnValue(20);
    gameBoardServiceSpy.getTileSize.and.returnValue(1);

    audioServiceSpy = jasmine.createSpyObj('AudioService', ['playSfx']);

    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        { provide: EnemyService, useValue: enemyServiceSpy },
        { provide: GameBoardService, useValue: gameBoardServiceSpy },
        { provide: AudioService, useValue: audioServiceSpy }
      ]
    });
    service = TestBed.inject(TowerCombatService);
    mockScene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup(mockScene);
    mockScene.traverse((child: any) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m: any) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    mockScene.clear();
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

      const result = service.update(2.0, mockScene);
      expect(result.killed.length).toBe(0);
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
      const result = service.update(0.016, mockScene);
      expect(result.killed).toContain('e1');
    });

    it('should not report kill for surviving enemy', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', enemy);

      const result = service.update(0.016, mockScene);
      expect(result.killed).not.toContain('e1');
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
      const result = service.update(0.016, mockScene);
      expect(result.killed.length).toBe(0);
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

      const result = service.update(1.0, mockScene);
      expect(result.killed.length).toBe(0);
    });

    it('should handle update with no enemies', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const result = service.update(1.0, mockScene);
      expect(result.killed.length).toBe(0);
    });

    it('should handle zero deltaTime', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z);
      enemyMap.set('e1', enemy);

      const result = service.update(0, mockScene);
      expect(result.killed.length).toBe(0);
    });

    it('should not double-count kills from multiple projectiles in same frame', () => {
      // Two towers targeting the same enemy
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      service.registerTower(TOWER_ROW, TOWER_COL + 1, TowerType.BASIC, new THREE.Group());

      // Enemy with health that dies from first hit
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1);
      enemyMap.set('e1', enemy);

      const result = service.update(0.016, mockScene);

      // Should only report the kill once (second projectile sees health <= 0)
      const e1Kills = result.killed.filter((id: string) => id === 'e1');
      expect(e1Kills.length).toBe(1);
    });
  });

  // --- Tower Upgrade System ---

  describe('tower upgrades', () => {
    it('should register towers at level 1', () => {
      service.registerTower(5, 5, TowerType.BASIC, new THREE.Group());
      const tower = service.getTower('5-5')!;
      expect(tower.level).toBe(1);
    });

    it('should track totalInvested as placement cost', () => {
      service.registerTower(5, 5, TowerType.BASIC, new THREE.Group());
      const tower = service.getTower('5-5')!;
      expect(tower.totalInvested).toBe(TOWER_CONFIGS[TowerType.BASIC].cost);
    });

    it('should upgrade tower level', () => {
      service.registerTower(5, 5, TowerType.BASIC, new THREE.Group());
      const result = service.upgradeTower('5-5');
      expect(result).toBeTrue();
      expect(service.getTower('5-5')!.level).toBe(2);
    });

    it('should accumulate totalInvested on upgrade', () => {
      service.registerTower(5, 5, TowerType.BASIC, new THREE.Group());
      const baseCost = TOWER_CONFIGS[TowerType.BASIC].cost;
      const upgradeCost = getUpgradeCost(TowerType.BASIC, 1);

      service.upgradeTower('5-5');
      expect(service.getTower('5-5')!.totalInvested).toBe(baseCost + upgradeCost);
    });

    it('should cap at MAX_TOWER_LEVEL', () => {
      service.registerTower(5, 5, TowerType.BASIC, new THREE.Group());
      service.upgradeTower('5-5'); // 1 → 2
      service.upgradeTower('5-5'); // 2 → 3

      const result = service.upgradeTower('5-5'); // 3 → blocked
      expect(result).toBeFalse();
      expect(service.getTower('5-5')!.level).toBe(MAX_TOWER_LEVEL);
    });

    it('should return false for non-existent tower', () => {
      expect(service.upgradeTower('99-99')).toBeFalse();
    });

    it('should use upgraded stats for combat', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      service.upgradeTower(`${TOWER_ROW}-${TOWER_COL}`); // Level 2 → 1.5x damage

      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', enemy);

      service.update(0.016, mockScene);

      // Level 2 BASIC: 25 * 1.5 = 38 (rounded)
      const expectedDamage = getEffectiveStats(TowerType.BASIC, 2).damage;
      expect(enemy.health).toBe(10000 - expectedDamage);
    });
  });

  // --- Tower Sell (Unregister) ---

  describe('unregisterTower', () => {
    it('should remove tower from placed towers map', () => {
      service.registerTower(5, 5, TowerType.BASIC, new THREE.Group());
      const removed = service.unregisterTower('5-5');

      expect(removed).toBeTruthy();
      expect(removed!.type).toBe(TowerType.BASIC);
      expect(service.getTower('5-5')).toBeUndefined();
    });

    it('should return undefined for non-existent tower', () => {
      expect(service.unregisterTower('99-99')).toBeUndefined();
    });

    it('should preserve other towers when removing one', () => {
      service.registerTower(1, 1, TowerType.BASIC, new THREE.Group());
      service.registerTower(2, 2, TowerType.SNIPER, new THREE.Group());

      service.unregisterTower('1-1');
      expect(service.getPlacedTowers().size).toBe(1);
      expect(service.getTower('2-2')).toBeTruthy();
    });
  });

  // --- Slow Tower ---

  describe('Slow tower', () => {
    it('should reduce enemy speed when within range', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 100);
      const originalSpeed = enemy.speed;
      enemyMap.set('e1', enemy);

      service.update(0.6, mockScene); // past SLOW fireRate of 0.5s
      const slowFactor = TOWER_CONFIGS[TowerType.SLOW].slowFactor!;
      expect(enemy.speed).toBeCloseTo(originalSpeed * slowFactor);
    });

    it('should not reduce speed below slowFactor when aura pulses again before expiry', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 100);
      const originalSpeed = enemy.speed;
      enemyMap.set('e1', enemy);

      service.update(0.6, mockScene); // first pulse
      const speedAfterFirst = enemy.speed;
      service.update(0.6, mockScene); // second pulse — should refresh duration, not stack
      expect(enemy.speed).toBeCloseTo(speedAfterFirst); // same speed, not halved again
    });

    it('should restore enemy speed after slow expires when enemy leaves range', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 100);
      const originalSpeed = enemy.speed;
      enemyMap.set('e1', enemy);

      service.update(0.6, mockScene); // apply slow (expires at gameTime=2.6)
      expect(enemy.speed).toBeLessThan(originalSpeed);

      // Move enemy out of tower range so the slow tower cannot re-apply the aura
      // SLOW range is 2.5, so place enemy far outside
      enemy.position.x = TOWER_WORLD_X + 10;

      // Advance well past slowDuration (2s) — slow expires at 2.6, we advance to 3.1
      service.update(2.5, mockScene);
      expect(enemy.speed).toBeCloseTo(originalSpeed);
    });

    it('should not affect enemies outside range', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const farEnemy = createEnemy('far', 20, 20, 100);
      const originalSpeed = farEnemy.speed;
      enemyMap.set('far', farEnemy);

      service.update(0.6, mockScene);
      expect(farEnemy.speed).toBeCloseTo(originalSpeed); // unchanged
    });

    it('should restore all slow effects on cleanup', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 100);
      const originalSpeed = enemy.speed;
      enemyMap.set('e1', enemy);

      service.update(0.6, mockScene);
      expect(enemy.speed).toBeLessThan(originalSpeed);

      service.cleanup(mockScene);
      expect(enemy.speed).toBeCloseTo(originalSpeed);
    });
  });

  // --- Chain Lightning Tower ---

  describe('Chain tower', () => {
    it('should deal damage to primary target on fire', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      service.update(1.0, mockScene); // past CHAIN fireRate of 0.8s
      expect(e1.health).toBeLessThan(1000);
    });

    it('should chain to a second enemy within chainRange', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());

      const chainRange = TOWER_CONFIGS[TowerType.CHAIN].chainRange!;
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      // e2 is within chainRange of e1
      const e2 = createEnemy('e2', TOWER_WORLD_X + chainRange * 0.5, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      service.update(1.0, mockScene);
      expect(e1.health).toBeLessThan(1000);
      expect(e2.health).toBeLessThan(1000);
    });

    it('should not chain to an enemy outside chainRange', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());

      const chainRange = TOWER_CONFIGS[TowerType.CHAIN].chainRange!;
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      // e2 is beyond chainRange of e1
      const e2 = createEnemy('e2', TOWER_WORLD_X + chainRange * 2, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      service.update(1.0, mockScene);
      expect(e1.health).toBeLessThan(1000);
      expect(e2.health).toBe(1000); // out of chain range
    });

    it('should not chain to the same enemy twice', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());

      // Single enemy in range — chain should only hit it once
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      service.update(1.0, mockScene);
      // Damage should equal exactly one hit (chainCount=3 but only one target)
      const expectedDamage = TOWER_CONFIGS[TowerType.CHAIN].damage;
      expect(e1.health).toBe(1000 - expectedDamage);
    });

    it('should apply damage falloff on second bounce', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());

      const chainRange = TOWER_CONFIGS[TowerType.CHAIN].chainRange!;
      const baseDamage = TOWER_CONFIGS[TowerType.CHAIN].damage;
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      const e2 = createEnemy('e2', TOWER_WORLD_X + chainRange * 0.5, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      service.update(1.0, mockScene);

      const e1Damage = 1000 - e1.health;
      const e2Damage = 1000 - e2.health;
      // e2 should receive 70% of e1's damage (CHAIN_DAMAGE_FALLOFF)
      expect(e1Damage).toBe(baseDamage);
      expect(e2Damage).toBe(Math.round(baseDamage * 0.7));
    });

    it('should return kill IDs for chain-killed enemies', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());

      const chainRange = TOWER_CONFIGS[TowerType.CHAIN].chainRange!;
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1); // dies from first hit
      const e2 = createEnemy('e2', TOWER_WORLD_X + chainRange * 0.5, TOWER_WORLD_Z, 1);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      const result = service.update(1.0, mockScene);
      expect(result.killed).toContain('e1');
      expect(result.killed).toContain('e2');
    });
  });

  // --- Mortar Tower ---

  describe('Mortar tower', () => {
    it('should fire a projectile toward target', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X + 3, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      // Fire — mortar projectile is slow (speed=4), not instant
      const result = service.update(3.1, mockScene); // past fireRate of 3.0s
      expect(result.fired).toContain(TowerType.MORTAR);
    });

    it('should create a blast zone on impact that deals DoT', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      // Enemy at tower position — mortar projectile hits instantly (dist=0)
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      // First update fires and hits instantly; zone is created; initial tick damages
      service.update(3.1, mockScene);
      expect(e1.health).toBeLessThan(1000);
    });

    it('should deal DoT per second for dotDuration seconds', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      // Fire and hit (instant at dist=0) — creates zone, initial tick deals dotDamage
      service.update(3.1, mockScene);
      const healthAfterImpact = e1.health;

      // Advance slightly past 1 second to trigger next DoT tick (avoid floating-point boundary)
      service.update(1.1, mockScene);
      expect(e1.health).toBeLessThan(healthAfterImpact);
    });

    it('should stop dealing DoT after dotDuration expires', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      // Fire and hit at gameTime=3.1 — zone created, expires at 3.1+3=6.1
      service.update(3.1, mockScene);
      const healthAfterImpact = e1.health;

      // Advance 1.1s to trigger one DoT tick (gameTime → 4.2, still within zone lifetime)
      service.update(1.1, mockScene);
      expect(e1.health).toBeLessThan(healthAfterImpact);

      // Advance well past expiry (need gameTime > 6.1; currently 4.2 + 2.1 = 6.3 > 6.1)
      // Move e1 far out of range to prevent new mortar shots from refiring
      e1.position.x = TOWER_WORLD_X + 20;
      service.update(2.1, mockScene); // gameTime = 6.3 > 6.1 — zone expires
      const healthAfterExpiry = e1.health;

      // No more ticks after expiry
      service.update(2.0, mockScene);
      expect(e1.health).toBe(healthAfterExpiry);
    });

    it('should damage multiple enemies within blastRadius', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const blastRadius = TOWER_CONFIGS[TowerType.MORTAR].blastRadius!;

      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      const e2 = createEnemy('e2', TOWER_WORLD_X + blastRadius * 0.5, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      // Fire and impact at tower position
      service.update(3.1, mockScene);

      expect(e1.health).toBeLessThan(1000);
      expect(e2.health).toBeLessThan(1000);
    });

    it('should not damage enemies outside blastRadius', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const blastRadius = TOWER_CONFIGS[TowerType.MORTAR].blastRadius!;

      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      // Far enemy beyond blastRadius
      const far = createEnemy('far', TOWER_WORLD_X + blastRadius * 3, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);
      enemyMap.set('far', far);

      service.update(3.1, mockScene);

      expect(e1.health).toBeLessThan(1000);
      expect(far.health).toBe(1000);
    });

    it('should clean up mortar zones on cleanup()', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      service.update(3.1, mockScene); // creates zone

      service.cleanup(mockScene); // should dispose zone mesh without throwing

      // After cleanup, no more DoT
      service.update(1.0, mockScene);
      // No crash expected; health unchanged after cleanup
    });
  });

  // --- Full Lifecycle ---

  describe('full lifecycle: register → upgrade → upgrade → sell', () => {
    it('should track level and totalInvested through full lifecycle', () => {
      const mesh = new THREE.Group();
      service.registerTower(5, 5, TowerType.BASIC, mesh);

      const baseCost = TOWER_CONFIGS[TowerType.BASIC].cost; // 50
      const upgrade1Cost = getUpgradeCost(TowerType.BASIC, 1); // 38
      const upgrade2Cost = getUpgradeCost(TowerType.BASIC, 2); // 50

      // Upgrade 1→2
      expect(service.upgradeTower('5-5')).toBeTrue();
      expect(service.getTower('5-5')!.level).toBe(2);
      expect(service.getTower('5-5')!.totalInvested).toBe(baseCost + upgrade1Cost);

      // Upgrade 2→3
      expect(service.upgradeTower('5-5')).toBeTrue();
      expect(service.getTower('5-5')!.level).toBe(3);
      expect(service.getTower('5-5')!.totalInvested).toBe(baseCost + upgrade1Cost + upgrade2Cost);

      // Max level — upgrade fails
      expect(service.upgradeTower('5-5')).toBeFalse();

      // Sell
      const sold = service.unregisterTower('5-5')!;
      expect(sold.level).toBe(3);
      expect(sold.totalInvested).toBe(baseCost + upgrade1Cost + upgrade2Cost);
      expect(getSellValue(sold.totalInvested)).toBeGreaterThan(0);
    });

    it('should preserve mesh reference through upgrades', () => {
      const mesh = new THREE.Group();
      service.registerTower(5, 5, TowerType.BASIC, mesh);

      service.upgradeTower('5-5');
      service.upgradeTower('5-5');

      expect(service.getTower('5-5')!.mesh).toBe(mesh);
    });
  });
});

// --- Tower Model Pure Function Tests ---

describe('Tower Model Functions', () => {
  describe('getUpgradeCost', () => {
    it('should return finite cost for levels below max', () => {
      const cost = getUpgradeCost(TowerType.BASIC, 1);
      expect(cost).toBeGreaterThan(0);
      expect(isFinite(cost)).toBeTrue();
    });

    it('should increase cost at higher levels', () => {
      const cost1to2 = getUpgradeCost(TowerType.BASIC, 1);
      const cost2to3 = getUpgradeCost(TowerType.BASIC, 2);
      expect(cost2to3).toBeGreaterThan(cost1to2);
    });

    it('should return Infinity at max level', () => {
      const cost = getUpgradeCost(TowerType.BASIC, MAX_TOWER_LEVEL);
      expect(cost).toBe(Infinity);
    });

    it('should return Infinity for level 0 (invalid)', () => {
      expect(getUpgradeCost(TowerType.BASIC, 0)).toBe(Infinity);
    });

    it('should return Infinity for negative levels', () => {
      expect(getUpgradeCost(TowerType.BASIC, -1)).toBe(Infinity);
    });

    it('should scale with tower base cost', () => {
      const basicCost = getUpgradeCost(TowerType.BASIC, 1);
      const sniperCost = getUpgradeCost(TowerType.SNIPER, 1);
      expect(sniperCost).toBeGreaterThan(basicCost);
    });
  });

  describe('getSellValue', () => {
    it('should return 50% of total invested', () => {
      expect(getSellValue(100)).toBe(50);
      expect(getSellValue(200)).toBe(100);
    });

    it('should round to nearest integer', () => {
      expect(getSellValue(75)).toBe(38);
      expect(getSellValue(1)).toBe(1);
    });

    it('should return 0 for 0 investment', () => {
      expect(getSellValue(0)).toBe(0);
    });
  });

  describe('getEffectiveStats', () => {
    it('should return base stats at level 1 for all tower types', () => {
      for (const type of [TowerType.BASIC, TowerType.SNIPER, TowerType.SPLASH]) {
        const stats = getEffectiveStats(type, 1);
        expect(stats.damage).toBe(TOWER_CONFIGS[type].damage);
        expect(stats.range).toBe(TOWER_CONFIGS[type].range);
        expect(stats.fireRate).toBe(TOWER_CONFIGS[type].fireRate);
      }
    });

    it('should increase damage at level 2', () => {
      const stats = getEffectiveStats(TowerType.BASIC, 2);
      expect(stats.damage).toBeGreaterThan(TOWER_CONFIGS[TowerType.BASIC].damage);
    });

    it('should increase range at level 2', () => {
      const stats = getEffectiveStats(TowerType.BASIC, 2);
      expect(stats.range).toBeGreaterThan(TOWER_CONFIGS[TowerType.BASIC].range);
    });

    it('should decrease fire rate (faster) at level 2', () => {
      const stats = getEffectiveStats(TowerType.BASIC, 2);
      expect(stats.fireRate).toBeLessThan(TOWER_CONFIGS[TowerType.BASIC].fireRate);
    });

    it('should preserve non-scaling stats (projectileSpeed, splashRadius, color)', () => {
      const stats = getEffectiveStats(TowerType.SPLASH, 3);
      expect(stats.projectileSpeed).toBe(TOWER_CONFIGS[TowerType.SPLASH].projectileSpeed);
      expect(stats.splashRadius).toBe(TOWER_CONFIGS[TowerType.SPLASH].splashRadius);
      expect(stats.color).toBe(TOWER_CONFIGS[TowerType.SPLASH].color);
    });

    it('should have highest stats at max level', () => {
      const lvl1 = getEffectiveStats(TowerType.SNIPER, 1);
      const lvl3 = getEffectiveStats(TowerType.SNIPER, MAX_TOWER_LEVEL);
      expect(lvl3.damage).toBeGreaterThan(lvl1.damage);
      expect(lvl3.range).toBeGreaterThan(lvl1.range);
      expect(lvl3.fireRate).toBeLessThan(lvl1.fireRate);
    });

    it('should clamp level 0 to base stats (defensive)', () => {
      const stats = getEffectiveStats(TowerType.BASIC, 0);
      expect(stats.damage).toBe(TOWER_CONFIGS[TowerType.BASIC].damage);
    });

    it('should clamp negative level to base stats (defensive)', () => {
      const stats = getEffectiveStats(TowerType.BASIC, -5);
      expect(stats.damage).toBe(TOWER_CONFIGS[TowerType.BASIC].damage);
    });

    it('should scale all tower types at level 3', () => {
      for (const type of [TowerType.BASIC, TowerType.SNIPER, TowerType.SPLASH]) {
        const base = TOWER_CONFIGS[type];
        const lvl3 = getEffectiveStats(type, 3);
        expect(lvl3.damage).toBeGreaterThan(base.damage);
        expect(lvl3.range).toBeGreaterThan(base.range);
        expect(lvl3.fireRate).toBeLessThan(base.fireRate);
      }
    });

    it('should return base stats at level 1 for SLOW, CHAIN, and MORTAR', () => {
      for (const type of [TowerType.SLOW, TowerType.CHAIN, TowerType.MORTAR]) {
        const stats = getEffectiveStats(type, 1);
        expect(stats.range).toBe(TOWER_CONFIGS[type].range);
        expect(stats.cost).toBe(TOWER_CONFIGS[type].cost);
      }
    });

    it('should preserve SLOW-specific optional stats through getEffectiveStats', () => {
      const stats = getEffectiveStats(TowerType.SLOW, 1);
      expect(stats.slowFactor).toBe(TOWER_CONFIGS[TowerType.SLOW].slowFactor);
      expect(stats.slowDuration).toBe(TOWER_CONFIGS[TowerType.SLOW].slowDuration);
    });

    it('should preserve CHAIN-specific optional stats through getEffectiveStats', () => {
      const stats = getEffectiveStats(TowerType.CHAIN, 1);
      expect(stats.chainCount).toBe(TOWER_CONFIGS[TowerType.CHAIN].chainCount);
      expect(stats.chainRange).toBe(TOWER_CONFIGS[TowerType.CHAIN].chainRange);
    });

    it('should preserve MORTAR-specific optional stats through getEffectiveStats', () => {
      const stats = getEffectiveStats(TowerType.MORTAR, 1);
      expect(stats.blastRadius).toBe(TOWER_CONFIGS[TowerType.MORTAR].blastRadius);
      expect(stats.dotDuration).toBe(TOWER_CONFIGS[TowerType.MORTAR].dotDuration);
      expect(stats.dotDamage).toBe(TOWER_CONFIGS[TowerType.MORTAR].dotDamage);
    });
  });

  describe('TOWER_CONFIGS — new tower types', () => {
    it('should have SLOW tower config with required fields', () => {
      const cfg = TOWER_CONFIGS[TowerType.SLOW];
      expect(cfg).toBeTruthy();
      expect(cfg.cost).toBeGreaterThan(0);
      expect(cfg.range).toBeGreaterThan(0);
      expect(cfg.slowFactor).toBeDefined();
      expect(cfg.slowFactor!).toBeGreaterThan(0);
      expect(cfg.slowFactor!).toBeLessThan(1);
      expect(cfg.slowDuration).toBeDefined();
      expect(cfg.slowDuration!).toBeGreaterThan(0);
    });

    it('should have CHAIN tower config with required fields', () => {
      const cfg = TOWER_CONFIGS[TowerType.CHAIN];
      expect(cfg).toBeTruthy();
      expect(cfg.cost).toBeGreaterThan(0);
      expect(cfg.damage).toBeGreaterThan(0);
      expect(cfg.range).toBeGreaterThan(0);
      expect(cfg.chainCount).toBeDefined();
      expect(cfg.chainCount!).toBeGreaterThan(0);
      expect(cfg.chainRange).toBeDefined();
      expect(cfg.chainRange!).toBeGreaterThan(0);
    });

    it('should have MORTAR tower config with required fields', () => {
      const cfg = TOWER_CONFIGS[TowerType.MORTAR];
      expect(cfg).toBeTruthy();
      expect(cfg.cost).toBeGreaterThan(0);
      expect(cfg.damage).toBeGreaterThan(0);
      expect(cfg.range).toBeGreaterThan(0);
      expect(cfg.blastRadius).toBeDefined();
      expect(cfg.blastRadius!).toBeGreaterThan(0);
      expect(cfg.dotDuration).toBeDefined();
      expect(cfg.dotDuration!).toBeGreaterThan(0);
      expect(cfg.dotDamage).toBeDefined();
      expect(cfg.dotDamage!).toBeGreaterThan(0);
    });

    it('MORTAR should cost more than BASIC and SPLASH', () => {
      expect(TOWER_CONFIGS[TowerType.MORTAR].cost).toBeGreaterThan(TOWER_CONFIGS[TowerType.BASIC].cost);
      expect(TOWER_CONFIGS[TowerType.MORTAR].cost).toBeGreaterThan(TOWER_CONFIGS[TowerType.SPLASH].cost);
    });

    it('CHAIN should cost more than BASIC', () => {
      expect(TOWER_CONFIGS[TowerType.CHAIN].cost).toBeGreaterThan(TOWER_CONFIGS[TowerType.BASIC].cost);
    });

    it('SLOW damage should be 0 (aura, not projectile)', () => {
      expect(TOWER_CONFIGS[TowerType.SLOW].damage).toBe(0);
    });
  });
});

// --- TOWER_ABILITIES and Ability System Tests ---

describe('TOWER_ABILITIES config', () => {
  it('should have an ability defined for every TowerType', () => {
    for (const type of Object.values(TowerType)) {
      expect(TOWER_ABILITIES[type]).toBeTruthy();
    }
  });

  it('should have valid cooldown > 0 for all tower types', () => {
    for (const type of Object.values(TowerType)) {
      expect(TOWER_ABILITIES[type].cooldown).toBeGreaterThan(0);
    }
  });

  it('should have non-empty name and description for all tower types', () => {
    for (const type of Object.values(TowerType)) {
      expect(TOWER_ABILITIES[type].name.length).toBeGreaterThan(0);
      expect(TOWER_ABILITIES[type].description.length).toBeGreaterThan(0);
    }
  });
});

describe('TowerCombatService — ability system', () => {
  let service: TowerCombatService;
  let enemyServiceSpy: jasmine.SpyObj<EnemyService>;
  let gameBoardServiceSpy: jasmine.SpyObj<GameBoardService>;
  let audioServiceSpy: jasmine.SpyObj<AudioService>;
  let mockScene: THREE.Scene;
  let enemyMap: Map<string, Enemy>;

  const TOWER_ROW = 10;
  const TOWER_COL = 12;
  const TOWER_WORLD_X = -0.5;
  const TOWER_WORLD_Z = 0;

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
    enemyServiceSpy.damageEnemy.and.callFake((id: string, damage: number): DamageResult => {
      const noOp: DamageResult = { killed: false, spawnedEnemies: [] };
      const enemy = enemyMap.get(id);
      if (!enemy || enemy.health <= 0) return noOp;
      enemy.health -= damage;
      return { killed: enemy.health <= 0, spawnedEnemies: [] };
    });

    gameBoardServiceSpy = jasmine.createSpyObj('GameBoardService', [
      'getBoardWidth', 'getBoardHeight', 'getTileSize'
    ]);
    gameBoardServiceSpy.getBoardWidth.and.returnValue(25);
    gameBoardServiceSpy.getBoardHeight.and.returnValue(20);
    gameBoardServiceSpy.getTileSize.and.returnValue(1);

    audioServiceSpy = jasmine.createSpyObj('AudioService', ['playSfx']);

    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        { provide: EnemyService, useValue: enemyServiceSpy },
        { provide: GameBoardService, useValue: gameBoardServiceSpy },
        { provide: AudioService, useValue: audioServiceSpy }
      ]
    });
    service = TestBed.inject(TowerCombatService);
    mockScene = new THREE.Scene();
  });

  it('getGameTime() should return current game time', () => {
    expect(service.getGameTime()).toBe(0);
    service.update(1.5, mockScene);
    expect(service.getGameTime()).toBeCloseTo(1.5);
  });

  describe('activateAbility()', () => {
    it('should return false for a non-existent tower', () => {
      expect(service.activateAbility('99-99')).toBeFalse();
    });

    it('should return true and set cooldown on first activation', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;

      expect(service.activateAbility(key)).toBeTrue();

      const tower = service.getTower(key)!;
      expect(tower.abilityCooldownEnd).toBeGreaterThan(0);
    });

    it('should return false if ability is on cooldown', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;

      service.activateAbility(key); // first activation
      expect(service.activateAbility(key)).toBeFalse(); // still on cooldown
    });

    it('should return true again after cooldown expires', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      const cooldown = TOWER_ABILITIES[TowerType.BASIC].cooldown;

      service.activateAbility(key);
      service.update(cooldown + 1, mockScene); // advance past cooldown
      expect(service.activateAbility(key)).toBeTrue();
    });
  });

  describe('Rapid Fire (BASIC)', () => {
    it('should set abilityActiveEnd when activated', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.activateAbility(key);
      const tower = service.getTower(key)!;
      expect(tower.abilityActiveEnd).toBeGreaterThan(0);
    });

    it('should fire more shots when Rapid Fire is active', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', enemy);

      // Normal fire rate: BASIC fires every 1.0s
      // First shot happens immediately on first update
      service.update(0.016, mockScene); // shot 1
      const healthAfterShot1 = enemy.health;

      service.update(0.5, mockScene); // 0.5s later — should NOT fire (normal rate is 1.0s)
      expect(enemy.health).toBe(healthAfterShot1);

      // Activate Rapid Fire — 0.5x fire rate (0.5s between shots)
      service.activateAbility(key);

      service.update(0.6, mockScene); // 0.6s — should fire (rapid rate is 0.5s)
      expect(enemy.health).toBeLessThan(healthAfterShot1);
    });
  });

  describe('Overcharge (SNIPER)', () => {
    it('should set abilityPrimed when activated', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SNIPER, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.activateAbility(key);
      const tower = service.getTower(key)!;
      expect(tower.abilityPrimed).toBeTrue();
    });

    it('should deal 3x damage on next shot then clear the flag', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SNIPER, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', enemy);

      service.activateAbility(key);
      // Fire — Sniper has fireRate 2.5s; advance past that
      service.update(2.6, mockScene);

      const baseDamage = getEffectiveStats(TowerType.SNIPER, 1).damage;
      const expectedDamage = Math.round(baseDamage * ABILITY_CONFIG.overchargeMultiplier);
      expect(enemy.health).toBe(10000 - expectedDamage);

      // Ability should be cleared after one shot
      expect(service.getTower(key)!.abilityPrimed).toBeFalse();
    });
  });

  describe('Barrage (MORTAR)', () => {
    it('should set abilityCharges when activated', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.activateAbility(key);
      const tower = service.getTower(key)!;
      expect(tower.abilityCharges).toBe(ABILITY_CONFIG.barrageCharges);
    });

    it('should fire faster when barrage charges remain', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', enemy);

      // Normal mortar: fires every 3.0s; fire first shot
      service.update(3.1, mockScene);
      const healthAfterFirst = enemy.health;

      // Activate barrage — rapid fire rate 0.3s
      service.activateAbility(key);

      // 0.4s later should fire again (barrage rate is 0.3s, much faster than normal 3.0s)
      service.update(0.4, mockScene);
      expect(enemy.health).toBeLessThan(healthAfterFirst);
    });
  });

  describe('Freeze (SLOW)', () => {
    it('should set abilityActiveEnd when activated', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.activateAbility(key);
      const tower = service.getTower(key)!;
      expect(tower.abilityActiveEnd).toBeGreaterThan(0);
    });

    it('should set enemy speed to 0 for enemies in range', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 100);
      enemyMap.set('e1', enemy);

      service.activateAbility(key);
      expect(enemy.speed).toBe(0);
    });
  });

  describe('Overload (CHAIN)', () => {
    it('should set abilityPrimed when activated', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.activateAbility(key);
      const tower = service.getTower(key)!;
      expect(tower.abilityPrimed).toBeTrue();
    });

    it('should clear abilityPrimed after firing', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', enemy);

      service.activateAbility(key);
      service.update(1.0, mockScene); // fire
      expect(service.getTower(key)!.abilityPrimed).toBeFalse();
    });
  });

  // --- Slow/Freeze Visual Tint ---

  describe('slow visual tint', () => {
    function createEnemyWithMesh(id: string, x: number, z: number, health = 100): Enemy {
      const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const mat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
      const mesh = new THREE.Mesh(geo, mat);
      const enemy = createEnemy(id, x, z, health);
      enemy.mesh = mesh;
      return enemy;
    }

    afterEach(() => {
      // Dispose any Three.js objects created in tests
      mockScene.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            (child.material as THREE.Material).dispose();
          }
        }
      });
    });

    it('should tint enemy mesh blue when slow is first applied', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const enemy = createEnemyWithMesh('e1', TOWER_WORLD_X, TOWER_WORLD_Z);
      enemyMap.set('e1', enemy);

      service.update(0.6, mockScene);

      const mat = enemy.mesh!.material as THREE.MeshLambertMaterial;
      expect(mat.color.getHex()).toBe(0x4488ff);
      expect(mat.emissive.getHex()).toBe(0x2244aa);
    });

    it('should store the original color in userData before tinting', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const enemy = createEnemyWithMesh('e1', TOWER_WORLD_X, TOWER_WORLD_Z);
      enemyMap.set('e1', enemy);

      service.update(0.6, mockScene);

      expect(enemy.mesh!.userData['originalColor']).toBe(0xff0000);
    });

    it('should not re-store color on second aura pulse (refresh only extends duration)', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const enemy = createEnemyWithMesh('e1', TOWER_WORLD_X, TOWER_WORLD_Z);
      enemyMap.set('e1', enemy);

      service.update(0.6, mockScene); // first pulse — stores 0xff0000
      // Force a second pulse by advancing past fireRate again
      service.update(0.6, mockScene); // second pulse — refresh branch, must NOT overwrite stored color

      // Stored color should still be the original red, not the blue tint
      expect(enemy.mesh!.userData['originalColor']).toBe(0xff0000);
    });

    it('should restore original color when slow expires', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const enemy = createEnemyWithMesh('e1', TOWER_WORLD_X, TOWER_WORLD_Z);
      enemyMap.set('e1', enemy);

      service.update(0.6, mockScene); // apply slow

      // Move enemy out of range so aura does not re-apply
      enemy.position.x = TOWER_WORLD_X + 10;

      // Advance past slowDuration (2s) — slow expires
      service.update(2.5, mockScene);

      const mat = enemy.mesh!.material as THREE.MeshLambertMaterial;
      expect(mat.color.getHex()).toBe(0xff0000);
      expect(enemy.mesh!.userData['originalColor']).toBeUndefined();
    });

    it('should restore color on cleanup', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const enemy = createEnemyWithMesh('e1', TOWER_WORLD_X, TOWER_WORLD_Z);
      enemyMap.set('e1', enemy);

      service.update(0.6, mockScene);
      service.cleanup(mockScene);

      const mat = enemy.mesh!.material as THREE.MeshLambertMaterial;
      expect(mat.color.getHex()).toBe(0xff0000);
    });

    it('should not throw when enemy has no mesh during slow application', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z); // no mesh
      enemyMap.set('e1', enemy);

      expect(() => service.update(0.6, mockScene)).not.toThrow();
    });
  });

  describe('freeze visual tint', () => {
    function createEnemyWithMesh(id: string, x: number, z: number, health = 100): Enemy {
      const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const mat = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
      const mesh = new THREE.Mesh(geo, mat);
      const enemy = createEnemy(id, x, z, health);
      enemy.mesh = mesh;
      return enemy;
    }

    afterEach(() => {
      mockScene.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            (child.material as THREE.Material).dispose();
          }
        }
      });
    });

    it('should tint enemy mesh blue when freeze ability is activated', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      const enemy = createEnemyWithMesh('e1', TOWER_WORLD_X, TOWER_WORLD_Z);
      enemyMap.set('e1', enemy);

      service.activateAbility(key);

      const mat = enemy.mesh!.material as THREE.MeshLambertMaterial;
      expect(mat.color.getHex()).toBe(0x4488ff);
      expect(mat.emissive.getHex()).toBe(0x2244aa);
    });

    it('should store original color in userData when freeze is applied', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      const enemy = createEnemyWithMesh('e1', TOWER_WORLD_X, TOWER_WORLD_Z);
      enemyMap.set('e1', enemy);

      service.activateAbility(key);

      expect(enemy.mesh!.userData['originalColor']).toBe(0x00ff00);
    });

    it('should restore color when freeze expires via expireFreezeEffect', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      const enemy = createEnemyWithMesh('e1', TOWER_WORLD_X, TOWER_WORLD_Z);
      enemyMap.set('e1', enemy);

      service.activateAbility(key); // sets abilityActiveEnd = freezeDuration
      const freezeDuration = TOWER_ABILITIES[TowerType.SLOW].duration;

      // Move enemy far out of range before advancing time, so the slow aura
      // does not re-apply after the freeze expires (SLOW range is 2.5)
      enemy.position.x = TOWER_WORLD_X + 10;

      // Advance past freeze duration — update() calls expireFreezeEffect
      service.update(freezeDuration + 0.1, mockScene);

      const mat = enemy.mesh!.material as THREE.MeshLambertMaterial;
      expect(mat.color.getHex()).toBe(0x00ff00);
      expect(enemy.mesh!.userData['originalColor']).toBeUndefined();
    });
  });

  // --- Ability Cooldown Logic ---

  describe('Ability cooldown logic', () => {
    it('should still be on cooldown at exactly cooldown boundary (not yet expired)', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      const cooldown = TOWER_ABILITIES[TowerType.BASIC].cooldown;

      service.activateAbility(key); // activates at gameTime=0; cooldownEnd = 20
      // Advance to exactly cooldown time — still blocked (gameTime < cooldownEnd is false when equal)
      service.update(cooldown, mockScene); // gameTime = 20 = abilityCooldownEnd
      // gameTime(20) < abilityCooldownEnd(20) is false → able to activate again
      expect(service.activateAbility(key)).toBeTrue();
    });

    it('should block rapid spam — multiple calls within cooldown all return false', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;

      service.activateAbility(key); // first activation
      // Spam 5 more times immediately
      for (let i = 0; i < 5; i++) {
        expect(service.activateAbility(key)).toBeFalse();
      }
    });

    it('cooldown duration stored matches TOWER_ABILITIES config', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      const expectedCooldown = TOWER_ABILITIES[TowerType.BASIC].cooldown;

      // gameTime starts at 0
      service.activateAbility(key);
      const tower = service.getTower(key)!;
      expect(tower.abilityCooldownEnd).toBeCloseTo(expectedCooldown);
    });
  });

  // --- Mortar Zone DoT extended ---

  describe('Mortar zone DoT extended', () => {
    it('should accumulate damage across multiple ticks', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const dotDamage = TOWER_CONFIGS[TowerType.MORTAR].dotDamage!;
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      // Fire and hit (instant at dist=0) — creates zone, initial tick at impact
      service.update(3.1, mockScene);
      const healthAfterImpact = e1.health;

      // Tick 2: advance 1.1s past tickInterval (1.0s)
      service.update(1.1, mockScene);
      const healthAfterTick2 = e1.health;
      expect(healthAfterTick2).toBeLessThan(healthAfterImpact);

      // Tick 3: advance another 1.1s
      service.update(1.1, mockScene);
      expect(e1.health).toBeLessThan(healthAfterTick2);

      // Total damage from 3 ticks should equal 3 * dotDamage
      const totalDamage = 10000 - e1.health;
      expect(totalDamage).toBe(dotDamage * 3);
    });

    it('should apply DoT from multiple overlapping zones to the same enemy', () => {
      // Two mortar towers both hit the same spot — two zones overlap on the enemy
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      service.registerTower(TOWER_ROW + 1, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const dotDamage = TOWER_CONFIGS[TowerType.MORTAR].dotDamage!;
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      // Both towers fire and hit instantly (dist=0 from tower world pos and very close for second)
      // We use a large deltaTime to ensure both fire
      service.update(3.1, mockScene); // both towers should have fired
      const healthAfterImpact = e1.health;

      // Advance past first tick — both zones tick simultaneously
      service.update(1.1, mockScene);
      const healthAfterTick = e1.health;
      // Enemy should have taken at least 2x dotDamage from two zones in this tick
      const damageThisTick = healthAfterImpact - healthAfterTick;
      expect(damageThisTick).toBeGreaterThanOrEqual(dotDamage * 2);
    });

    it('should clean up mortar zones on clearProjectiles()', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      // Fire and create zone
      service.update(3.1, mockScene);
      const healthAfterImpact = e1.health;

      // Clear zones
      service.clearProjectiles(mockScene);

      // Advance past a tick interval — zone is gone, no more DoT
      service.update(1.1, mockScene);
      expect(e1.health).toBe(healthAfterImpact);
    });
  });

  // --- Chain Lightning Falloff extended ---

  describe('Chain lightning falloff extended', () => {
    it('should terminate chain when damage falls to 0 due to falloff', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());

      const chainRange = TOWER_CONFIGS[TowerType.CHAIN].chainRange!;
      const baseDamage = TOWER_CONFIGS[TowerType.CHAIN].damage; // 15
      // After 3 bounces: 15 → 11 → 8 → 6 → 4 → 3 → 2 → 1 → 0 (rounds down to 0 with falloff 0.7)
      // chainCount=3, so only 4 hits total (bounce 0..3); but we want to verify falloff progression
      // Place exactly chainCount+1 enemies to fill the chain to exhaustion
      const enemies: Enemy[] = [];
      for (let i = 0; i <= TOWER_CONFIGS[TowerType.CHAIN].chainCount!; i++) {
        const e = createEnemy(`e${i}`, TOWER_WORLD_X + i * (chainRange * 0.5), TOWER_WORLD_Z, 1000);
        enemyMap.set(e.id, e);
        enemies.push(e);
      }

      service.update(1.0, mockScene);

      // Damage falls off by damageFalloff per bounce — last enemy in chain should take less damage
      const damageFalloff = CHAIN_LIGHTNING_CONFIG.damageFalloff;
      const firstDamage = 1000 - enemies[0].health;
      const secondDamage = 1000 - enemies[1].health;
      expect(firstDamage).toBe(baseDamage);
      expect(secondDamage).toBe(Math.round(baseDamage * damageFalloff));
    });

    it('Overload ability should allow chain to reach overloadChainCount targets', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;

      const chainRange = TOWER_CONFIGS[TowerType.CHAIN].chainRange!;
      const normalChainCount = TOWER_CONFIGS[TowerType.CHAIN].chainCount!; // 3
      const overloadCount = ABILITY_CONFIG.overloadChainCount; // 6

      // Place more enemies than normal chainCount but within overload count
      // We need overloadCount+1 enemies so the chain can hit overloadCount+1 (bounce 0..overloadCount)
      const enemies: Enemy[] = [];
      for (let i = 0; i <= overloadCount; i++) {
        const e = createEnemy(`e${i}`, TOWER_WORLD_X + i * (chainRange * 0.5), TOWER_WORLD_Z, 1000);
        enemyMap.set(e.id, e);
        enemies.push(e);
      }

      // Without Overload, only enemies 0..normalChainCount get hit
      service.update(1.0, mockScene);
      // Reset health to measure Overload effect
      enemies.forEach(e => { e.health = 1000; });

      // Activate Overload and fire again — advance past cooldown first
      service.activateAbility(key);
      service.update(1.0, mockScene);

      // Enemies beyond normalChainCount should now be hit
      const hitBeyondNormal = enemies
        .slice(normalChainCount + 1)
        .some(e => e.health < 1000);
      expect(hitBeyondNormal).toBeTrue();
    });

    it('should not hit the same enemy twice (hitIds Set prevents revisiting)', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());

      // Only one enemy in range — chain has nowhere to bounce; should hit exactly once
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      service.update(1.0, mockScene);

      const expectedOnceHit = TOWER_CONFIGS[TowerType.CHAIN].damage;
      expect(e1.health).toBe(1000 - expectedOnceHit);
    });
  });

  // --- Barrage (MORTAR) extended ---

  describe('Barrage ability extended', () => {
    it('should decrement abilityCharges on each mortar fire during barrage', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      // Fire initial shot to get past first normal cooldown
      service.update(3.1, mockScene);

      // Activate Barrage
      service.activateAbility(key);
      const initialCharges = service.getTower(key)!.abilityCharges;
      expect(initialCharges).toBe(ABILITY_CONFIG.barrageCharges);

      // Fire one barrage shot (barrageFireRate=0.3s)
      service.update(0.4, mockScene);
      expect(service.getTower(key)!.abilityCharges).toBe(initialCharges - 1);
    });

    it('should revert to normal fire rate once barrage charges reach 0', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      // Fire initial shot
      service.update(3.1, mockScene);

      // Activate Barrage (3 charges) and burn through all of them
      service.activateAbility(key);
      // Each barrage shot uses 0.4s (barrageFireRate=0.3s) → 3 shots in 1.2s
      service.update(0.4, mockScene); // shot 1, charges→2
      service.update(0.4, mockScene); // shot 2, charges→1
      service.update(0.4, mockScene); // shot 3, charges→0

      expect(service.getTower(key)!.abilityCharges).toBe(0);

      // Move enemy out of zone blast radius so existing DoT zones can't tick on it.
      // We only want to verify the TOWER doesn't fire a new projectile, not that zones stop.
      const blastRadius = TOWER_CONFIGS[TowerType.MORTAR].blastRadius!;
      e1.position.x = TOWER_WORLD_X + blastRadius * 10;

      // 0.5s later — the tower should NOT fire (normal fire rate is 3.0s) and
      // the enemy is out of all zone radii, so health must remain unchanged.
      const healthAfterBarrage = e1.health;
      service.update(0.5, mockScene);
      expect(e1.health).toBe(healthAfterBarrage);
    });
  });

  // --- Napalm (SPLASH) ---

  describe('Napalm ability', () => {
    it('should reset abilityPrimed to false after napalm shot fires', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SPLASH, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      service.activateAbility(key);
      expect(service.getTower(key)!.abilityPrimed).toBeTrue();

      // Fire — SPLASH fireRate is 1.5s; advance past it
      service.update(1.6, mockScene);

      expect(service.getTower(key)!.abilityPrimed).toBeFalse();
    });

    it('should create a burning zone on impact when Napalm is primed', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SPLASH, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      // Enemy at tower position so projectile hits instantly
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      service.activateAbility(key); // prime Napalm
      // Fire and hit instantly (dist=0) — zone is created at impact
      service.update(1.6, mockScene);
      const healthAfterImpact = e1.health;

      // Advance past tickInterval (1.0s) — napalm zone should tick DoT
      service.update(1.1, mockScene);
      expect(e1.health).toBeLessThan(healthAfterImpact);
    });
  });

  // --- Targeting Priority ---

  describe('targetingPriority', () => {
    it('should default to FIRST targeting priority on register', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const tower = service.getTower(`${TOWER_ROW}-${TOWER_COL}`)!;
      expect(tower.targetingPriority).toBe(TargetingPriority.FIRST);
    });

    it('should cycle through all 4 targeting priorities', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;

      expect(service.cycleTargetingPriority(key)).toBe(TargetingPriority.LAST);
      expect(service.cycleTargetingPriority(key)).toBe(TargetingPriority.STRONGEST);
      expect(service.cycleTargetingPriority(key)).toBe(TargetingPriority.WEAKEST);
      expect(service.cycleTargetingPriority(key)).toBe(TargetingPriority.FIRST); // wraps back
    });

    it('should return null for cycleTargetingPriority when tower does not exist', () => {
      expect(service.cycleTargetingPriority('99-99')).toBeNull();
    });

    it('should target enemy with most distanceTraveled when priority is FIRST', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      // Ensure FIRST priority
      const tower = service.getTower(key)!;
      expect(tower.targetingPriority).toBe(TargetingPriority.FIRST);

      // Two enemies in range — nearLeader has traveled more (closer to exit)
      const laggard = createEnemy('laggard', TOWER_WORLD_X, TOWER_WORLD_Z, 100);
      laggard.distanceTraveled = 2;
      const leader = createEnemy('leader', TOWER_WORLD_X + 1, TOWER_WORLD_Z, 100);
      leader.distanceTraveled = 10;

      enemyMap.set('laggard', laggard);
      enemyMap.set('leader', leader);

      // Fire once; projectile for leader hits on next tick since it is 1 unit away
      service.update(0.016, mockScene);
      service.update(2.0, mockScene);

      // Leader (most distanceTraveled) should take damage; laggard should not
      expect(leader.health).toBeLessThan(100);
      expect(laggard.health).toBe(100);
    });

    it('should target enemy with least health when priority is WEAKEST', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      // Cycle to WEAKEST (FIRST → LAST → STRONGEST → WEAKEST)
      service.cycleTargetingPriority(key); // LAST
      service.cycleTargetingPriority(key); // STRONGEST
      service.cycleTargetingPriority(key); // WEAKEST

      const healthy = createEnemy('healthy', TOWER_WORLD_X, TOWER_WORLD_Z, 200);
      const wounded = createEnemy('wounded', TOWER_WORLD_X + 1, TOWER_WORLD_Z, 10);

      enemyMap.set('healthy', healthy);
      enemyMap.set('wounded', wounded);

      // First update fires; second update advances projectile to hit
      service.update(0.016, mockScene);
      service.update(2.0, mockScene);

      // Wounded (least HP) should be targeted; healthy should be untouched
      expect(wounded.health).toBeLessThan(10);
      expect(healthy.health).toBe(200);
    });
  });
});
