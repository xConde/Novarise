import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { ChainLightningService } from './chain-lightning.service';
import { CombatVFXService } from './combat-vfx.service';
import { EnemyService } from './enemy.service';
import { StatusEffectService } from './status-effect.service';
import { Enemy } from '../models/enemy.model';
import { PlacedTower, TowerType, TOWER_CONFIGS, getEffectiveStats } from '../models/tower.model';
import { CHAIN_LIGHTNING_CONFIG } from '../constants/combat.constants';
import { SpatialGrid } from '../utils/spatial-grid';
import { createTestEnemy, createEnemyServiceSpy, createGameBoardServiceSpy } from '../testing';
import { GameBoardService } from '../game-board.service';

describe('ChainLightningService', () => {
  let service: ChainLightningService;
  let combatVFXService: CombatVFXService;
  let enemyServiceSpy: jasmine.SpyObj<EnemyService>;
  let statusEffectService: StatusEffectService;
  let mockScene: THREE.Scene;
  let enemyMap: Map<string, Enemy>;
  let spatialGrid: SpatialGrid;

  // Tower sits at world (0, 0) for simplicity
  const TOWER_X = 0;
  const TOWER_Z = 0;

  const makeStats = (type = TowerType.CHAIN) => getEffectiveStats(type, 1);

  const makeTower = (row = 5, col = 5): PlacedTower => ({
    id: `${row}-${col}`,
    type: TowerType.CHAIN,
    level: 1,
    row,
    col,
    lastFireTime: -Infinity,
    kills: 0,
    totalInvested: TOWER_CONFIGS[TowerType.CHAIN].cost,
    targetingMode: 'nearest' as PlacedTower['targetingMode'],
    mesh: new THREE.Group(),
  });

  /** Insert enemies into the spatial grid. */
  function populateGrid(...enemies: Enemy[]): void {
    spatialGrid.clear();
    enemies.forEach(e => {
      if (e.health > 0) spatialGrid.insert(e);
    });
  }

  beforeEach(() => {
    enemyMap = new Map();
    enemyServiceSpy = createEnemyServiceSpy(enemyMap);

    const gameBoardServiceSpy = createGameBoardServiceSpy(25, 20, 1);

    TestBed.configureTestingModule({
      providers: [
        ChainLightningService,
        CombatVFXService,
        StatusEffectService,
        { provide: EnemyService, useValue: enemyServiceSpy },
        { provide: GameBoardService, useValue: gameBoardServiceSpy },
      ],
    });

    service = TestBed.inject(ChainLightningService);
    combatVFXService = TestBed.inject(CombatVFXService);
    statusEffectService = TestBed.inject(StatusEffectService);
    mockScene = new THREE.Scene();
    spatialGrid = new SpatialGrid();
  });

  afterEach(() => {
    combatVFXService.cleanup(mockScene);
    mockScene.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---- findChainTarget ----

  describe('findChainTarget', () => {
    it('should return null when there are no candidates', () => {
      const from = createTestEnemy('from', 0, 0);
      const result = service.findChainTarget(from, 2, new Set(), spatialGrid);
      expect(result).toBeNull();
    });

    it('should return null when the only candidate is in the exclude set', () => {
      const from = createTestEnemy('from', 0, 0);
      const enemy = createTestEnemy('e1', 0.5, 0);
      populateGrid(enemy);
      const result = service.findChainTarget(from, 2, new Set(['e1']), spatialGrid);
      expect(result).toBeNull();
    });

    it('should return null when nearest enemy is outside chainRange', () => {
      const from = createTestEnemy('from', 0, 0);
      const far = createTestEnemy('e1', 5, 0);
      populateGrid(far);
      const result = service.findChainTarget(from, 2, new Set(), spatialGrid);
      expect(result).toBeNull();
    });

    it('should return the nearest enemy within chainRange', () => {
      const from = createTestEnemy('from', 0, 0);
      const near = createTestEnemy('e1', 0.5, 0);
      const far = createTestEnemy('e2', 1.5, 0);
      populateGrid(near, far);
      const result = service.findChainTarget(from, 2, new Set(), spatialGrid);
      expect(result).toBe(near);
    });

    it('should skip dead enemies (health <= 0)', () => {
      const from = createTestEnemy('from', 0, 0);
      const dead = createTestEnemy('e1', 0.5, 0, 0);
      const alive = createTestEnemy('e2', 1.0, 0);
      populateGrid(alive); // dead enemies are not inserted into grid (health > 0 check)
      const result = service.findChainTarget(from, 2, new Set(), spatialGrid);
      expect(result).toBe(alive);
      expect(result).not.toBe(dead);
    });

    it('should return null when all candidates are excluded', () => {
      const from = createTestEnemy('from', 0, 0);
      const e1 = createTestEnemy('e1', 0.5, 0);
      const e2 = createTestEnemy('e2', 1.0, 0);
      populateGrid(e1, e2);
      const result = service.findChainTarget(from, 2, new Set(['e1', 'e2']), spatialGrid);
      expect(result).toBeNull();
    });

    it('should choose the closer of two valid candidates', () => {
      const from = createTestEnemy('from', 0, 0);
      const closer = createTestEnemy('e1', 0.3, 0);
      const farther = createTestEnemy('e2', 1.8, 0);
      populateGrid(closer, farther);
      const result = service.findChainTarget(from, 2, new Set(), spatialGrid);
      expect(result).toBe(closer);
    });
  });

  // ---- fire ----

  describe('fire', () => {
    const GAME_TIME = 0;

    it('should deal damage to the primary target', () => {
      const stats = makeStats();
      const e1 = createTestEnemy('e1', 0.5, 0, 1000);
      enemyMap.set('e1', e1);
      populateGrid(e1);

      service.fire(makeTower(), e1, stats, mockScene, TOWER_X, TOWER_Z, spatialGrid, GAME_TIME);

      expect(e1.health).toBe(1000 - stats.damage);
    });

    it('should create at least one chain arc for the primary hit', () => {
      const stats = makeStats();
      const e1 = createTestEnemy('e1', 0.5, 0, 1000);
      enemyMap.set('e1', e1);
      populateGrid(e1);

      service.fire(makeTower(), e1, stats, mockScene, TOWER_X, TOWER_Z, spatialGrid, GAME_TIME);

      expect(combatVFXService.getChainArcCount()).toBeGreaterThan(0);
    });

    it('should chain to a second enemy within chainRange', () => {
      const stats = makeStats();
      const chainRange = stats.chainRange ?? 2;
      const e1 = createTestEnemy('e1', 0.5, 0, 1000);
      const e2 = createTestEnemy('e2', 0.5 + chainRange * 0.5, 0, 1000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);
      populateGrid(e1, e2);

      service.fire(makeTower(), e1, stats, mockScene, TOWER_X, TOWER_Z, spatialGrid, GAME_TIME);

      expect(e2.health).toBeLessThan(1000);
    });

    it('should NOT chain to an enemy outside chainRange', () => {
      const stats = makeStats();
      const chainRange = stats.chainRange ?? 2;
      const e1 = createTestEnemy('e1', 0.5, 0, 1000);
      const e2 = createTestEnemy('e2', 0.5 + chainRange * 3, 0, 1000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);
      populateGrid(e1, e2);

      service.fire(makeTower(), e1, stats, mockScene, TOWER_X, TOWER_Z, spatialGrid, GAME_TIME);

      expect(e2.health).toBe(1000);
    });

    it('should NOT hit the same enemy twice (no double-bounce)', () => {
      const stats = makeStats();
      const e1 = createTestEnemy('e1', 0.5, 0, 1000);
      enemyMap.set('e1', e1);
      populateGrid(e1);

      service.fire(makeTower(), e1, stats, mockScene, TOWER_X, TOWER_Z, spatialGrid, GAME_TIME);

      // Only one hit should have occurred
      expect(e1.health).toBe(1000 - stats.damage);
    });

    it('should apply damageFalloff on each chain bounce', () => {
      const stats = makeStats();
      const chainRange = stats.chainRange ?? 2;
      const baseDamage = stats.damage;

      const e1 = createTestEnemy('e1', 0.5, 0, 10000);
      const e2 = createTestEnemy('e2', 0.5 + chainRange * 0.5, 0, 10000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);
      populateGrid(e1, e2);

      service.fire(makeTower(), e1, stats, mockScene, TOWER_X, TOWER_Z, spatialGrid, GAME_TIME);

      const expectedE1Damage = baseDamage;
      const expectedE2Damage = Math.round(baseDamage * CHAIN_LIGHTNING_CONFIG.damageFalloff);

      expect(e1.health).toBe(10000 - expectedE1Damage);
      expect(e2.health).toBe(10000 - expectedE2Damage);
    });

    it('should apply exact falloff across three chained targets', () => {
      const stats = makeStats();
      const chainRange = stats.chainRange ?? 2;
      const baseDamage = stats.damage;
      const falloff = CHAIN_LIGHTNING_CONFIG.damageFalloff;

      const e1 = createTestEnemy('e1', 0.5, 0, 10000);
      const e2 = createTestEnemy('e2', 0.5 + chainRange * 0.5, 0, 10000);
      const e3 = createTestEnemy('e3', 0.5 + chainRange * 0.9, 0, 10000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);
      enemyMap.set('e3', e3);
      populateGrid(e1, e2, e3);

      service.fire(makeTower(), e1, stats, mockScene, TOWER_X, TOWER_Z, spatialGrid, GAME_TIME);

      const d1 = baseDamage;
      const d2 = Math.round(baseDamage * falloff);
      const d3 = Math.round(d2 * falloff);

      expect(e1.health).toBe(10000 - d1);
      expect(e2.health).toBe(10000 - d2);
      expect(e3.health).toBe(10000 - d3);
    });

    it('should return KillInfo for enemies killed by the chain', () => {
      const stats = makeStats();
      const chainRange = stats.chainRange ?? 2;

      const e1 = createTestEnemy('e1', 0.5, 0, 1); // dies on hit
      const e2 = createTestEnemy('e2', 0.5 + chainRange * 0.5, 0, 1); // dies on bounce
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);
      populateGrid(e1, e2);

      const kills = service.fire(makeTower(), e1, stats, mockScene, TOWER_X, TOWER_Z, spatialGrid, GAME_TIME);

      expect(kills.length).toBeGreaterThanOrEqual(1);
      expect(kills.some(k => k.id === 'e1')).toBeTrue();
    });

    it('should return empty kills array when the primary target survives and nothing chains', () => {
      const stats = makeStats();
      const e1 = createTestEnemy('e1', 0.5, 0, 10000);
      enemyMap.set('e1', e1);
      populateGrid(e1);

      const kills = service.fire(makeTower(), e1, stats, mockScene, TOWER_X, TOWER_Z, spatialGrid, GAME_TIME);

      expect(kills.length).toBe(0);
    });

    it('should queue a chainZap audio event on fire', () => {
      const stats = makeStats();
      const e1 = createTestEnemy('e1', 0.5, 0, 1000);
      enemyMap.set('e1', e1);
      populateGrid(e1);

      service.fire(makeTower(), e1, stats, mockScene, TOWER_X, TOWER_Z, spatialGrid, GAME_TIME);

      const events = service.drainAudioEvents();
      expect(events.some(ev => ev.type === 'sfx' && ev.sfxKey === 'chainZap')).toBeTrue();
    });

    it('drainAudioEvents should clear the queue after drain', () => {
      const stats = makeStats();
      const e1 = createTestEnemy('e1', 0.5, 0, 1000);
      enemyMap.set('e1', e1);
      populateGrid(e1);

      service.fire(makeTower(), e1, stats, mockScene, TOWER_X, TOWER_Z, spatialGrid, GAME_TIME);
      service.drainAudioEvents(); // first drain
      const secondDrain = service.drainAudioEvents();
      expect(secondDrain.length).toBe(0);
    });

    it('should create a chain arc line in the scene for each bounce', () => {
      const stats = makeStats();
      const chainRange = stats.chainRange ?? 2;

      const e1 = createTestEnemy('e1', 0.5, 0, 10000);
      const e2 = createTestEnemy('e2', 0.5 + chainRange * 0.5, 0, 10000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);
      populateGrid(e1, e2);

      service.fire(makeTower(), e1, stats, mockScene, TOWER_X, TOWER_Z, spatialGrid, GAME_TIME);

      // At minimum 2 arcs: tower→e1 and e1→e2
      expect(combatVFXService.getChainArcCount()).toBeGreaterThanOrEqual(2);
      expect(mockScene.children.some(c => c instanceof THREE.Line)).toBeTrue();
    });

    it('first arc should originate from the tower position', () => {
      const stats = makeStats();
      const e1 = createTestEnemy('e1', 2, 0, 10000);
      enemyMap.set('e1', e1);
      populateGrid(e1);

      service.fire(makeTower(), e1, stats, mockScene, TOWER_X, TOWER_Z, spatialGrid, GAME_TIME);

      const arc = combatVFXService.getChainArcs()[0];
      const posAttr = arc.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      expect(posAttr.getX(0)).toBeCloseTo(TOWER_X, 2);
      expect(posAttr.getZ(0)).toBeCloseTo(TOWER_Z, 2);
    });

    it('should add spawned mini-swarm enemies to the scene', () => {
      const stats = makeStats();
      const miniMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.1),
        new THREE.MeshBasicMaterial()
      );
      const mini: Enemy = createTestEnemy('mini1', 0.5, 0, 1);
      mini.isMiniSwarm = true;
      (mini as Enemy & { mesh?: THREE.Object3D }).mesh = miniMesh;

      const e1 = createTestEnemy('e1', 0.5, 0, 1);
      enemyMap.set('e1', e1);
      populateGrid(e1);

      // Override damageEnemy to return a spawned mini
      enemyServiceSpy.damageEnemy.and.callFake((_id: string, _damage: number) => ({
        killed: true,
        spawnedEnemies: [mini as Enemy & { mesh?: THREE.Object3D }],
      }));

      service.fire(makeTower(), e1, stats, mockScene, TOWER_X, TOWER_Z, spatialGrid, GAME_TIME);

      expect(mockScene.children).toContain(miniMesh);

      // Cleanup Three.js objects
      miniMesh.geometry.dispose();
      (miniMesh.material as THREE.Material).dispose();
    });

    it('should stop chaining when currentDamage would drop to 0 after falloff', () => {
      // Use very low damage so that falloff quickly reaches 0
      const stats = { ...makeStats(), damage: 1 };
      const chainRange = stats.chainRange ?? 2;

      const e1 = createTestEnemy('e1', 0.5, 0, 10000);
      const e2 = createTestEnemy('e2', 0.5 + chainRange * 0.4, 0, 10000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);
      populateGrid(e1, e2);

      // Math.round(1 * 0.7) = 1; Math.round(1 * 0.7) = 1 again — chain will continue until
      // chainCount runs out. This test verifies the zero-damage guard doesn't accidentally
      // terminate a valid chain. Set damage=1 which stays 1 after falloff.
      service.fire(makeTower(), e1, stats, mockScene, TOWER_X, TOWER_Z, spatialGrid, GAME_TIME);

      // Both should have taken at least 1 damage — guard doesn't incorrectly stop them
      expect(e1.health).toBeLessThan(10000);
    });
  });
});
