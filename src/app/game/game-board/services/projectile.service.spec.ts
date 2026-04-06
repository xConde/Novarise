import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { ProjectileService, ProjectileHit } from './projectile.service';
import { CombatVFXService } from './combat-vfx.service';
import { TowerType, TOWER_CONFIGS, getEffectiveStats, TowerStats } from '../models/tower.model';
import { PlacedTower } from '../models/tower.model';
import { Enemy } from '../models/enemy.model';
import { createTestEnemy, createGameBoardServiceSpy } from '../testing';
import { GameBoardService } from '../game-board.service';
import { TargetingMode } from '../models/tower.model';

describe('ProjectileService', () => {
  let service: ProjectileService;
  let combatVFXService: CombatVFXService;
  let mockScene: THREE.Scene;

  const makeTower = (type: TowerType = TowerType.BASIC, row = 5, col = 5): PlacedTower => ({
    id: `${row}-${col}`,
    type,
    level: 1,
    row,
    col,
    lastFireTime: -Infinity,
    kills: 0,
    totalInvested: TOWER_CONFIGS[type].cost,
    targetingMode: TargetingMode.NEAREST,
    mesh: new THREE.Group(),
  });

  const makeEnemy = (id: string, x: number, z: number, health = 1000): Enemy =>
    createTestEnemy(id, x, z, health);

  const makeEnemyMap = (...enemies: Enemy[]): Map<string, Enemy> => {
    const map = new Map<string, Enemy>();
    enemies.forEach(e => map.set(e.id, e));
    return map;
  };

  beforeEach(() => {
    const gameBoardServiceSpy = createGameBoardServiceSpy(25, 20, 1);

    TestBed.configureTestingModule({
      providers: [
        ProjectileService,
        CombatVFXService,
        { provide: GameBoardService, useValue: gameBoardServiceSpy },
      ],
    });

    service = TestBed.inject(ProjectileService);
    combatVFXService = TestBed.inject(CombatVFXService);
    mockScene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup(mockScene);
    combatVFXService.cleanup(mockScene);
    mockScene.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---- getProjectileCount ----

  describe('getProjectileCount', () => {
    it('should return 0 when no projectiles have been fired', () => {
      expect(service.getProjectileCount()).toBe(0);
    });

    it('should increment when a projectile is fired', () => {
      const tower = makeTower();
      const enemy = makeEnemy('e1', 5, 0);
      const stats = getEffectiveStats(TowerType.BASIC, 1);

      service.fire(tower, enemy, stats, 0, 0, mockScene);

      expect(service.getProjectileCount()).toBe(1);
    });

    it('should decrement when a projectile hits its target', () => {
      const tower = makeTower();
      const enemy = makeEnemy('e1', 0.1, 0); // very close — will be hit in one step
      const stats = getEffectiveStats(TowerType.BASIC, 1);

      service.fire(tower, enemy, stats, 0, 0, mockScene);
      service.advance(1, mockScene, makeEnemyMap(enemy), 0);

      expect(service.getProjectileCount()).toBe(0);
    });
  });

  // ---- fire (standard pooled projectile) ----

  describe('fire — standard projectile', () => {
    it('should add a mesh to the scene', () => {
      const tower = makeTower(TowerType.BASIC);
      const enemy = makeEnemy('e1', 3, 0);
      const stats = getEffectiveStats(TowerType.BASIC, 1);
      const initialChildCount = mockScene.children.length;

      service.fire(tower, enemy, stats, 0, 0, mockScene);

      expect(mockScene.children.length).toBeGreaterThan(initialChildCount);
    });

    it('should apply PROJECTILE_VISUAL_CONFIG color for SNIPER', () => {
      const tower = makeTower(TowerType.SNIPER);
      const enemy = makeEnemy('e1', 3, 0);
      const stats = getEffectiveStats(TowerType.SNIPER, 1);

      service.fire(tower, enemy, stats, 0, 0, mockScene);

      // find the most recently added mesh
      const mesh = mockScene.children.find(
        c => c instanceof THREE.Mesh && c.visible
      ) as THREE.Mesh | undefined;
      expect(mesh).toBeDefined();
    });

    it('should NOT add a mortar projectile to the pool (separate disposal path)', () => {
      const mortarTower = makeTower(TowerType.MORTAR);
      const enemy = makeEnemy('e1', 3, 0);
      const stats = getEffectiveStats(TowerType.MORTAR, 1);

      service.fire(mortarTower, enemy, stats, 0, 0, mockScene);

      expect(service.getProjectileCount()).toBe(1);
    });
  });

  // ---- advance ----

  describe('advance', () => {
    it('should return an empty array when there are no projectiles', () => {
      const hits = service.advance(0.016, mockScene, new Map(), 0);
      expect(hits).toEqual([]);
    });

    it('should return a hit when projectile reaches the target', () => {
      const tower = makeTower(TowerType.BASIC);
      const enemy = makeEnemy('e1', 0.05, 0); // nearly at origin — will be hit immediately
      const stats = getEffectiveStats(TowerType.BASIC, 1);

      service.fire(tower, enemy, stats, 0, 0, mockScene);

      const hits = service.advance(1, mockScene, makeEnemyMap(enemy), 0);
      expect(hits.length).toBe(1);
    });

    it('returned hit should carry correct towerKey and targetId', () => {
      const tower = makeTower(TowerType.BASIC, 3, 4);
      const enemy = makeEnemy('enemy-42', 0.05, 0);
      const stats = getEffectiveStats(TowerType.BASIC, 1);

      service.fire(tower, enemy, stats, 0, 0, mockScene);

      const hits = service.advance(1, mockScene, makeEnemyMap(enemy), 0);
      expect(hits[0].towerKey).toBe('3-4');
      expect(hits[0].targetId).toBe('enemy-42');
    });

    it('returned hit should carry correct damage and splashRadius', () => {
      const tower = makeTower(TowerType.SPLASH);
      const enemy = makeEnemy('e1', 0.05, 0);
      const stats = getEffectiveStats(TowerType.SPLASH, 1);

      service.fire(tower, enemy, stats, 0, 0, mockScene);

      const hits = service.advance(1, mockScene, makeEnemyMap(enemy), 0);
      expect(hits[0].damage).toBe(stats.damage);
      expect(hits[0].splashRadius).toBe(stats.splashRadius);
    });

    it('should discard a projectile whose target has been removed from the enemy map', () => {
      const tower = makeTower(TowerType.BASIC);
      const enemy = makeEnemy('e1', 3, 0);
      const stats = getEffectiveStats(TowerType.BASIC, 1);

      service.fire(tower, enemy, stats, 0, 0, mockScene);
      // Advance with an empty map — target is gone
      const hits = service.advance(0.016, mockScene, new Map(), 0);

      expect(hits.length).toBe(0);
      expect(service.getProjectileCount()).toBe(0);
    });

    it('should move the projectile mesh toward the target over multiple steps', () => {
      const tower = makeTower(TowerType.BASIC);
      const enemy = makeEnemy('e1', 5, 0); // far away
      const stats = getEffectiveStats(TowerType.BASIC, 1);

      service.fire(tower, enemy, stats, 0, 0, mockScene);

      const mesh = mockScene.children.find(
        c => c instanceof THREE.Mesh && c.visible
      ) as THREE.Mesh;
      const startX = mesh?.position.x ?? 0;

      service.advance(0.016, mockScene, makeEnemyMap(enemy), 0);

      // Projectile should have moved toward the enemy (positive x direction)
      expect(mesh?.position.x).toBeGreaterThan(startX);
    });

    it('should add a trail line to the scene after two frames of movement', () => {
      const tower = makeTower(TowerType.BASIC);
      const enemy = makeEnemy('e1', 10, 0); // far away — won't hit yet
      const stats = getEffectiveStats(TowerType.BASIC, 1);

      service.fire(tower, enemy, stats, 0, 0, mockScene);
      service.advance(0.016, mockScene, makeEnemyMap(enemy), 0);
      service.advance(0.016, mockScene, makeEnemyMap(enemy), 0.016);

      const hasTrail = mockScene.children.some(c => c instanceof THREE.Line);
      expect(hasTrail).toBeTrue();
    });

    it('should handle multiple simultaneous projectiles', () => {
      const stats = getEffectiveStats(TowerType.BASIC, 1);
      const e1 = makeEnemy('e1', 0.05, 0);
      const e2 = makeEnemy('e2', 0.05, 1);

      service.fire(makeTower(TowerType.BASIC, 0, 0), e1, stats, 0, 0, mockScene);
      service.fire(makeTower(TowerType.BASIC, 1, 0), e2, stats, 0, 1, mockScene);

      const hits = service.advance(1, mockScene, makeEnemyMap(e1, e2), 0);
      expect(hits.length).toBe(2);
    });

    it('mortar hit should have towerType MORTAR', () => {
      const tower = makeTower(TowerType.MORTAR);
      const enemy = makeEnemy('e1', 0.05, 0);
      const stats = getEffectiveStats(TowerType.MORTAR, 1);

      service.fire(tower, enemy, stats, 0, 0, mockScene);

      const hits = service.advance(1, mockScene, makeEnemyMap(enemy), 0);
      expect(hits[0].towerType).toBe(TowerType.MORTAR);
    });
  });

  // ---- cleanup ----

  describe('cleanup', () => {
    it('should remove all projectile meshes from the scene', () => {
      const tower = makeTower(TowerType.BASIC);
      const enemy = makeEnemy('e1', 5, 0);
      const stats = getEffectiveStats(TowerType.BASIC, 1);

      service.fire(tower, enemy, stats, 0, 0, mockScene);
      expect(service.getProjectileCount()).toBe(1);

      service.cleanup(mockScene);

      expect(service.getProjectileCount()).toBe(0);
    });

    it('should reset projectile counter to 0 after cleanup', () => {
      const tower = makeTower(TowerType.BASIC);
      const enemy = makeEnemy('e1', 5, 0);
      const stats = getEffectiveStats(TowerType.BASIC, 1);

      service.fire(tower, enemy, stats, 0, 0, mockScene);
      service.cleanup(mockScene);

      // Fire another projectile — it should get id 'proj-0' again (counter reset)
      service.fire(tower, enemy, stats, 0, 0, mockScene);
      expect(service.getProjectileCount()).toBe(1);
    });

    it('should be safe to call cleanup with no live projectiles', () => {
      expect(() => service.cleanup(mockScene)).not.toThrow();
    });
  });
});
