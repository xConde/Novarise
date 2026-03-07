import { TestBed } from '@angular/core/testing';
import { TowerCombatService, KillInfo } from './tower-combat.service';
import { EnemyService, DamageResult } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { TowerType, TowerSpecialization, TOWER_CONFIGS, TOWER_SPECIALIZATIONS, MAX_TOWER_LEVEL, getUpgradeCost, getSellValue, getEffectiveStats, TowerStats, TargetingMode, DEFAULT_TARGETING_MODE, TARGETING_MODES } from '../models/tower.model';
import { Enemy, EnemyType } from '../models/enemy.model';
import { AudioService } from './audio.service';
import { StatusEffectService } from './status-effect.service';
import { CHAIN_LIGHTNING_CONFIG, IMPACT_FLASH_CONFIG } from '../constants/combat.constants';
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
      leakDamage: 1,
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
        StatusEffectService,
        { provide: EnemyService, useValue: enemyServiceSpy },
        { provide: GameBoardService, useValue: gameBoardServiceSpy },
        { provide: AudioService, useValue: audioServiceSpy }
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

  // --- Targeting Modes ---

  describe('targeting modes', () => {
    it('should default to nearest targeting mode', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const tower = service.getTower(`${TOWER_ROW}-${TOWER_COL}`)!;
      expect(tower.targetingMode).toBe(DEFAULT_TARGETING_MODE);
      expect(tower.targetingMode).toBe('nearest');
    });

    it('should set targeting mode via setTargetingMode', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;

      expect(service.setTargetingMode(key, 'first')).toBeTrue();
      expect(service.getTower(key)!.targetingMode).toBe('first');

      expect(service.setTargetingMode(key, 'strongest')).toBeTrue();
      expect(service.getTower(key)!.targetingMode).toBe('strongest');
    });

    it('should return false for setTargetingMode on non-existent tower', () => {
      expect(service.setTargetingMode('99-99', 'first')).toBeFalse();
    });

    it('should cycle targeting mode through all modes', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;

      // Default is 'nearest' (index 0) → cycles to 'first' (index 1)
      expect(service.cycleTargetingMode(key)).toBe('first');
      expect(service.cycleTargetingMode(key)).toBe('strongest');
      expect(service.cycleTargetingMode(key)).toBe('nearest'); // wraps around
    });

    it('should return null for cycleTargetingMode on non-existent tower', () => {
      expect(service.cycleTargetingMode('99-99')).toBeNull();
    });

    it('findTarget with nearest returns closest enemy', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      // Default mode is 'nearest' — no need to set

      // Close enemy
      const close = createEnemy('close', TOWER_WORLD_X + 0.5, TOWER_WORLD_Z, 50);
      close.distanceTraveled = 0;
      // Far enemy (but within range=3)
      const far = createEnemy('far', TOWER_WORLD_X + 2, TOWER_WORLD_Z, 200);
      far.distanceTraveled = 10;
      enemyMap.set('close', close);
      enemyMap.set('far', far);

      service.update(2.0, mockScene);

      // Nearest (close) should be targeted — takes damage first
      expect(close.health).toBeLessThan(50);
      expect(far.health).toBe(200);
    });

    it('findTarget with first returns enemy furthest along path', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.setTargetingMode(key, 'first');

      // Close enemy but early in path
      const close = createEnemy('close', TOWER_WORLD_X + 0.5, TOWER_WORLD_Z, 1000);
      close.distanceTraveled = 2;
      // Farther enemy but further along path
      const far = createEnemy('far', TOWER_WORLD_X + 2, TOWER_WORLD_Z, 1000);
      far.distanceTraveled = 10;
      enemyMap.set('close', close);
      enemyMap.set('far', far);

      service.update(2.0, mockScene);

      // 'first' mode targets the enemy closest to exit (highest distanceTraveled)
      // far enemy should be targeted — projectile at tower position travels toward far
      expect(far.health).toBeLessThan(1000);
      expect(close.health).toBe(1000);
    });

    it('findTarget with strongest returns enemy with highest health', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.setTargetingMode(key, 'strongest');

      // Weak enemy right at tower
      const weak = createEnemy('weak', TOWER_WORLD_X, TOWER_WORLD_Z, 50);
      weak.distanceTraveled = 5;
      // Strong enemy nearby (within range=3)
      const strong = createEnemy('strong', TOWER_WORLD_X + 1, TOWER_WORLD_Z, 500);
      strong.distanceTraveled = 1;
      enemyMap.set('weak', weak);
      enemyMap.set('strong', strong);

      service.update(2.0, mockScene);

      // 'strongest' mode targets the enemy with highest current health
      // strong (500hp) should be targeted, weak (50hp) should not
      expect(strong.health).toBeLessThan(500);
      expect(weak.health).toBe(50);
    });

    it('should preserve targeting mode across upgrade', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;

      service.setTargetingMode(key, 'strongest');
      expect(service.getTower(key)!.targetingMode).toBe('strongest');

      const upgraded = service.upgradeTower(key);
      expect(upgraded).toBeTrue();
      expect(service.getTower(key)!.targetingMode).toBe('strongest');
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
      expect(result.killed.map((k: KillInfo) => k.id)).toContain('e1');
    });

    it('should include the damage dealt in KillInfo', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy with exactly lethal health
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 25);
      enemyMap.set('e1', enemy);

      const result = service.update(0.016, mockScene);
      const kill = result.killed.find((k: KillInfo) => k.id === 'e1');
      expect(kill).toBeDefined();
      expect(kill!.damage).toBe(TOWER_CONFIGS[TowerType.BASIC].damage);
    });

    it('should not report kill for surviving enemy', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', enemy);

      const result = service.update(0.016, mockScene);
      expect(result.killed.map((k: KillInfo) => k.id)).not.toContain('e1');
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

    it('should initialize projectile with null trail and empty trailPositions', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy at distance so projectile stays in flight
      const enemy = createEnemy('e1', TOWER_WORLD_X + 2, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', enemy);

      service.update(0.016, mockScene);

      const projectiles = (service as any)['projectiles'] as { trail: THREE.Line | null; trailPositions: THREE.Vector3[] }[];
      expect(projectiles.length).toBeGreaterThan(0);
      // After first update, trail is still null (needs >=2 positions), trailPositions has 1 entry
      expect(projectiles[0].trail).toBeNull();
    });

    it('should create trail after projectile has moved at least 2 frames', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy within BASIC range (3) but far enough for multiple frames of travel
      const enemy = createEnemy('e1', TOWER_WORLD_X + 2, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', enemy);

      // Frame 1: fire + first move — 1 trail position, no trail line yet
      service.update(0.016, mockScene);
      // Frame 2: second move — 2 trail positions, trail created
      service.update(0.016, mockScene);

      const projectiles = (service as any)['projectiles'] as { trail: THREE.Line | null; trailPositions: THREE.Vector3[] }[];
      expect(projectiles.length).toBeGreaterThan(0);
      expect(projectiles[0].trail).not.toBeNull();
      expect(projectiles[0].trailPositions.length).toBeGreaterThanOrEqual(2);
    });

    it('should clean up trail when projectile is removed', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy within BASIC range (3) but far enough for multiple frames of travel
      const enemy = createEnemy('e1', TOWER_WORLD_X + 2, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', enemy);

      // Build up a trail
      service.update(0.016, mockScene);
      service.update(0.016, mockScene);

      const projectiles = (service as any)['projectiles'] as { trail: THREE.Line | null; trailPositions: THREE.Vector3[] }[];
      expect(projectiles.length).toBeGreaterThan(0);
      const trail = projectiles[0].trail;
      expect(trail).not.toBeNull();

      // Remove enemy — projectile should be cleaned up including trail
      enemyMap.delete('e1');
      service.update(0.016, mockScene);

      // Trail should have been removed from scene
      expect(trail).toBeTruthy();
      expect(mockScene.children).not.toContain(trail!);
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
      const e1Kills = result.killed.filter((k: KillInfo) => k.id === 'e1');
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

    it('should block upgradeTower at L2 (requires specialization)', () => {
      service.registerTower(5, 5, TowerType.BASIC, new THREE.Group());
      service.upgradeTower('5-5'); // 1 → 2

      const result = service.upgradeTower('5-5'); // 2 → blocked (needs spec)
      expect(result).toBeFalse();
      expect(service.getTower('5-5')!.level).toBe(2);
    });

    it('should cap at MAX_TOWER_LEVEL via spec upgrade', () => {
      service.registerTower(5, 5, TowerType.BASIC, new THREE.Group());
      service.upgradeTower('5-5'); // 1 → 2
      service.upgradeTowerWithSpec('5-5', TowerSpecialization.ALPHA); // 2 → 3

      const result = service.upgradeTowerWithSpec('5-5', TowerSpecialization.BETA); // 3 → blocked
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

  // --- Specialization Upgrades ---

  describe('upgradeTowerWithSpec', () => {
    it('should succeed from L2', () => {
      service.registerTower(5, 5, TowerType.BASIC, new THREE.Group());
      service.upgradeTower('5-5'); // 1 → 2
      const result = service.upgradeTowerWithSpec('5-5', TowerSpecialization.ALPHA);
      expect(result).toBeTrue();
      expect(service.getTower('5-5')!.level).toBe(3);
      expect(service.getTower('5-5')!.specialization).toBe(TowerSpecialization.ALPHA);
    });

    it('should fail from L1', () => {
      service.registerTower(5, 5, TowerType.BASIC, new THREE.Group());
      const result = service.upgradeTowerWithSpec('5-5', TowerSpecialization.ALPHA);
      expect(result).toBeFalse();
      expect(service.getTower('5-5')!.level).toBe(1);
    });

    it('should fail from L3', () => {
      service.registerTower(5, 5, TowerType.BASIC, new THREE.Group());
      service.upgradeTower('5-5'); // 1 → 2
      service.upgradeTowerWithSpec('5-5', TowerSpecialization.ALPHA); // 2 → 3
      const result = service.upgradeTowerWithSpec('5-5', TowerSpecialization.BETA);
      expect(result).toBeFalse();
    });

    it('should accumulate totalInvested on spec upgrade', () => {
      service.registerTower(5, 5, TowerType.BASIC, new THREE.Group());
      const baseCost = TOWER_CONFIGS[TowerType.BASIC].cost;
      const l1to2Cost = getUpgradeCost(TowerType.BASIC, 1);
      const l2to3Cost = getUpgradeCost(TowerType.BASIC, 2);

      service.upgradeTower('5-5');
      service.upgradeTowerWithSpec('5-5', TowerSpecialization.BETA);
      expect(service.getTower('5-5')!.totalInvested).toBe(baseCost + l1to2Cost + l2to3Cost);
    });

    it('should return false for non-existent tower', () => {
      expect(service.upgradeTowerWithSpec('99-99', TowerSpecialization.ALPHA)).toBeFalse();
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
      const killedIds = result.killed.map((k: KillInfo) => k.id);
      expect(killedIds).toContain('e1');
      expect(killedIds).toContain('e2');
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

  describe('full lifecycle: register → upgrade → specialize → sell', () => {
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

      // Upgrade 2→3 (requires specialization)
      expect(service.upgradeTower('5-5')).toBeFalse(); // blocked without spec
      expect(service.upgradeTowerWithSpec('5-5', TowerSpecialization.ALPHA)).toBeTrue();
      expect(service.getTower('5-5')!.level).toBe(3);
      expect(service.getTower('5-5')!.specialization).toBe(TowerSpecialization.ALPHA);
      expect(service.getTower('5-5')!.totalInvested).toBe(baseCost + upgrade1Cost + upgrade2Cost);

      // Max level — both upgrade methods fail
      expect(service.upgradeTower('5-5')).toBeFalse();
      expect(service.upgradeTowerWithSpec('5-5', TowerSpecialization.BETA)).toBeFalse();

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
      service.upgradeTowerWithSpec('5-5', TowerSpecialization.BETA);

      expect(service.getTower('5-5')!.mesh).toBe(mesh);
    });
  });

  // --- Chain Lightning Zigzag ---

  describe('chain lightning zigzag', () => {
    it('should create arc with zigzagSegments + 1 vertices', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      service.update(1.0, mockScene); // past CHAIN fireRate

      const chainArcs = (service as any)['chainArcs'] as { line: THREE.Line; expiresAt: number }[];
      expect(chainArcs.length).toBeGreaterThan(0);

      const expectedVertexCount = CHAIN_LIGHTNING_CONFIG.zigzagSegments + 1;
      const posAttr = chainArcs[0].line.geometry.getAttribute('position');
      expect(posAttr.count).toBe(expectedVertexCount);
    });

    it('should have endpoints that connect start and end positions without jitter', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());

      const targetX = TOWER_WORLD_X + 1;
      const targetZ = TOWER_WORLD_Z + 1;
      const e1 = createEnemy('e1', targetX, targetZ, 1000);
      enemyMap.set('e1', e1);

      service.update(1.0, mockScene);

      const chainArcs = (service as any)['chainArcs'] as { line: THREE.Line; expiresAt: number }[];
      expect(chainArcs.length).toBeGreaterThan(0);

      const posAttr = chainArcs[0].line.geometry.getAttribute('position');
      const segs = CHAIN_LIGHTNING_CONFIG.zigzagSegments;

      // First vertex should be at the tower world position (arc starts from tower)
      const firstX = posAttr.getX(0);
      const firstZ = posAttr.getZ(0);
      expect(firstX).toBeCloseTo(TOWER_WORLD_X, 2);
      expect(firstZ).toBeCloseTo(TOWER_WORLD_Z, 2);

      // Last vertex should be at the enemy position (arc ends at target)
      const lastX = posAttr.getX(segs);
      const lastZ = posAttr.getZ(segs);
      expect(lastX).toBeCloseTo(targetX, 2);
      expect(lastZ).toBeCloseTo(targetZ, 2);
    });
  });

  // --- Impact Flash ---

  describe('impact flash', () => {
    it('should spawn an impact flash when a projectile hits an enemy', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy at tower position — projectile hits instantly (dist=0)
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      service.update(2.0, mockScene);

      const impactFlashes = (service as any)['impactFlashes'] as { mesh: THREE.Mesh; expiresAt: number }[];
      expect(impactFlashes.length).toBeGreaterThan(0);
    });

    it('should create flash with SphereGeometry', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      service.update(2.0, mockScene);

      const impactFlashes = (service as any)['impactFlashes'] as { mesh: THREE.Mesh; expiresAt: number }[];
      expect(impactFlashes.length).toBeGreaterThan(0);
      expect(impactFlashes[0].mesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
    });

    it('should clean up flash after its lifetime expires', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      service.update(2.0, mockScene); // fire + hit → flash spawned

      const impactFlashes = (service as any)['impactFlashes'] as { mesh: THREE.Mesh; expiresAt: number }[];
      expect(impactFlashes.length).toBeGreaterThan(0);

      // Move enemy far away so no new flashes are spawned
      e1.position.x = TOWER_WORLD_X + 20;

      // Advance time past flash lifetime (IMPACT_FLASH_CONFIG.lifetime = 0.08s)
      service.update(IMPACT_FLASH_CONFIG.lifetime + 0.01, mockScene);

      const remainingFlashes = (service as any)['impactFlashes'] as { mesh: THREE.Mesh; expiresAt: number }[];
      expect(remainingFlashes.length).toBe(0);
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

  describe('TOWER_SPECIALIZATIONS', () => {
    it('should have both ALPHA and BETA entries for every TowerType', () => {
      for (const type of Object.values(TowerType)) {
        const specs = TOWER_SPECIALIZATIONS[type as TowerType];
        expect(specs).toBeDefined();
        expect(specs[TowerSpecialization.ALPHA]).toBeDefined();
        expect(specs[TowerSpecialization.BETA]).toBeDefined();
      }
    });

    it('should have label and description for every specialization', () => {
      for (const type of Object.values(TowerType)) {
        for (const spec of [TowerSpecialization.ALPHA, TowerSpecialization.BETA]) {
          const s = TOWER_SPECIALIZATIONS[type as TowerType][spec];
          expect(s.label.length).toBeGreaterThan(0);
          expect(s.description.length).toBeGreaterThan(0);
        }
      }
    });

    it('should have positive damage and range multipliers', () => {
      for (const type of Object.values(TowerType)) {
        for (const spec of [TowerSpecialization.ALPHA, TowerSpecialization.BETA]) {
          const s = TOWER_SPECIALIZATIONS[type as TowerType][spec];
          expect(s.damage).toBeGreaterThan(0);
          expect(s.range).toBeGreaterThan(0);
          expect(s.fireRate).toBeGreaterThan(0);
        }
      }
    });

    it('SPLASH ALPHA should have splashRadiusBonus', () => {
      expect(TOWER_SPECIALIZATIONS[TowerType.SPLASH][TowerSpecialization.ALPHA].splashRadiusBonus).toBeDefined();
      expect(TOWER_SPECIALIZATIONS[TowerType.SPLASH][TowerSpecialization.ALPHA].splashRadiusBonus!).toBeGreaterThan(0);
    });

    it('CHAIN ALPHA should have chainCountBonus', () => {
      expect(TOWER_SPECIALIZATIONS[TowerType.CHAIN][TowerSpecialization.ALPHA].chainCountBonus).toBeDefined();
      expect(TOWER_SPECIALIZATIONS[TowerType.CHAIN][TowerSpecialization.ALPHA].chainCountBonus!).toBeGreaterThan(0);
    });

    it('SLOW ALPHA should have slowFactorOverride', () => {
      expect(TOWER_SPECIALIZATIONS[TowerType.SLOW][TowerSpecialization.ALPHA].slowFactorOverride).toBeDefined();
    });

    it('MORTAR ALPHA should have dotDamageMultiplier', () => {
      expect(TOWER_SPECIALIZATIONS[TowerType.MORTAR][TowerSpecialization.ALPHA].dotDamageMultiplier).toBeDefined();
      expect(TOWER_SPECIALIZATIONS[TowerType.MORTAR][TowerSpecialization.ALPHA].dotDamageMultiplier!).toBeGreaterThan(0);
    });
  });

  describe('getEffectiveStats with specialization', () => {
    it('should use spec multipliers at MAX_TOWER_LEVEL with specialization', () => {
      const base = TOWER_CONFIGS[TowerType.BASIC];
      const spec = TOWER_SPECIALIZATIONS[TowerType.BASIC][TowerSpecialization.ALPHA];
      const stats = getEffectiveStats(TowerType.BASIC, MAX_TOWER_LEVEL, TowerSpecialization.ALPHA);
      expect(stats.damage).toBe(Math.round(base.damage * spec.damage));
      expect(stats.range).toBe(+(base.range * spec.range).toFixed(2));
      expect(stats.fireRate).toBe(+(base.fireRate * spec.fireRate).toFixed(2));
    });

    it('should use standard L3 multipliers when no specialization is provided', () => {
      const withoutSpec = getEffectiveStats(TowerType.BASIC, MAX_TOWER_LEVEL);
      const withSpec = getEffectiveStats(TowerType.BASIC, MAX_TOWER_LEVEL, TowerSpecialization.ALPHA);
      // They should differ because spec multipliers !== standard L3 multipliers
      expect(withoutSpec.damage).not.toBe(withSpec.damage);
    });

    it('should apply splashRadiusBonus for SPLASH ALPHA spec', () => {
      const base = TOWER_CONFIGS[TowerType.SPLASH];
      const spec = TOWER_SPECIALIZATIONS[TowerType.SPLASH][TowerSpecialization.ALPHA];
      const stats = getEffectiveStats(TowerType.SPLASH, MAX_TOWER_LEVEL, TowerSpecialization.ALPHA);
      expect(stats.splashRadius).toBe(base.splashRadius + spec.splashRadiusBonus!);
    });

    it('should apply chainCountBonus for CHAIN ALPHA spec', () => {
      const base = TOWER_CONFIGS[TowerType.CHAIN];
      const spec = TOWER_SPECIALIZATIONS[TowerType.CHAIN][TowerSpecialization.ALPHA];
      const stats = getEffectiveStats(TowerType.CHAIN, MAX_TOWER_LEVEL, TowerSpecialization.ALPHA);
      expect(stats.chainCount).toBe(base.chainCount! + spec.chainCountBonus!);
    });

    it('should apply slowFactorOverride for SLOW ALPHA spec', () => {
      const spec = TOWER_SPECIALIZATIONS[TowerType.SLOW][TowerSpecialization.ALPHA];
      const stats = getEffectiveStats(TowerType.SLOW, MAX_TOWER_LEVEL, TowerSpecialization.ALPHA);
      expect(stats.slowFactor).toBe(spec.slowFactorOverride);
    });

    it('should apply dotDamageMultiplier for MORTAR ALPHA spec', () => {
      const base = TOWER_CONFIGS[TowerType.MORTAR];
      const spec = TOWER_SPECIALIZATIONS[TowerType.MORTAR][TowerSpecialization.ALPHA];
      const stats = getEffectiveStats(TowerType.MORTAR, MAX_TOWER_LEVEL, TowerSpecialization.ALPHA);
      expect(stats.dotDamage).toBe(Math.round(base.dotDamage! * spec.dotDamageMultiplier!));
    });

    it('should not apply spec at L1 or L2 even if specialization is passed', () => {
      const l1 = getEffectiveStats(TowerType.BASIC, 1, TowerSpecialization.ALPHA);
      const l1NoSpec = getEffectiveStats(TowerType.BASIC, 1);
      expect(l1.damage).toBe(l1NoSpec.damage);

      const l2 = getEffectiveStats(TowerType.BASIC, 2, TowerSpecialization.ALPHA);
      const l2NoSpec = getEffectiveStats(TowerType.BASIC, 2);
      expect(l2.damage).toBe(l2NoSpec.damage);
    });

    it('BETA spec should produce different stats than ALPHA for same tower type', () => {
      const alpha = getEffectiveStats(TowerType.SNIPER, MAX_TOWER_LEVEL, TowerSpecialization.ALPHA);
      const beta = getEffectiveStats(TowerType.SNIPER, MAX_TOWER_LEVEL, TowerSpecialization.BETA);
      // At least one stat should differ
      const differs = alpha.damage !== beta.damage || alpha.range !== beta.range || alpha.fireRate !== beta.fireRate;
      expect(differs).toBeTrue();
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
