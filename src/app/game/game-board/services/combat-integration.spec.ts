/**
 * Combat integration tests: TowerCombatService working against a real EnemyService spy.
 * These tests cover end-to-end combat scenarios — tower fires, enemy takes damage,
 * kills are recorded, gold is awarded.
 */
import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { TowerCombatService, KillInfo } from './tower-combat.service';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { CombatVFXService } from './combat-vfx.service';
import { StatusEffectService } from './status-effect.service';

import { TowerType, TOWER_CONFIGS } from '../models/tower.model';
import { createTestEnemy, createGameBoardServiceSpy, createEnemyServiceSpy } from '../testing';
import { Enemy } from '../models/enemy.model';

describe('combat integration', () => {
  let service: TowerCombatService;
  let enemyMap: Map<string, Enemy>;
  let scene: THREE.Scene;

  // Tower placed at row=10, col=12 on the 25×20 board matches worldX=-0.5, worldZ=0
  const TOWER_ROW = 10;
  const TOWER_COL = 12;
  const TOWER_X = -0.5;
  const TOWER_Z = 0;

  beforeEach(() => {
    enemyMap = new Map();

    const enemyServiceSpy = createEnemyServiceSpy(enemyMap);
    const gameBoardServiceSpy = createGameBoardServiceSpy(25, 20, 1);

    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        CombatVFXService,
        StatusEffectService,
        GameStateService,
        { provide: EnemyService, useValue: enemyServiceSpy },
        { provide: GameBoardService, useValue: gameBoardServiceSpy },
      ],
    });

    service = TestBed.inject(TowerCombatService);
    scene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup(scene);
    scene.clear();
  });

  // ─── 1. Full combat tick: register tower, add enemy in range, call update() → kill ───

  describe('full combat tick: tower fires, enemy dies, kill returned', () => {
    it('should return a kill when enemy health equals tower damage (one-shot)', () => {
      const damage = TOWER_CONFIGS[TowerType.BASIC].damage; // 25
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy at tower world position — distance=0, so projectile hits immediately
      const enemy = createTestEnemy('e1', TOWER_X, TOWER_Z, damage);
      enemyMap.set('e1', enemy);

      const result = service.update(0.016, scene);

      expect(result.killed.length).toBe(1);
      expect(result.killed[0].id).toBe('e1');
    });

    it('should award correct damage in KillInfo', () => {
      const damage = TOWER_CONFIGS[TowerType.BASIC].damage;
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      const enemy = createTestEnemy('e1', TOWER_X, TOWER_Z, damage);
      enemyMap.set('e1', enemy);

      const result = service.update(0.016, scene);

      expect(result.killed[0].damage).toBe(damage);
    });

    it('should reduce enemy health on hit before kill', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy health far above damage — survives multiple hits
      const enemy = createTestEnemy('e1', TOWER_X, TOWER_Z, 10000);
      enemyMap.set('e1', enemy);

      service.update(0.016, scene);

      expect(enemy.health).toBeLessThan(10000);
    });
  });

  // ─── 2. Tower out of range → no fire, no kills ───

  describe('tower out of range of all enemies', () => {
    it('should not fire and return no kills when enemy is far out of range', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // BASIC range = 3 — place enemy far beyond range
      const enemy = createTestEnemy('e1', 20, 20, 100);
      enemyMap.set('e1', enemy);

      const result = service.update(2.0, scene);

      expect(result.killed.length).toBe(0);
      expect(enemy.health).toBe(100); // untouched
    });

    it('should not fire when enemy map is empty', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      // enemyMap is empty by default

      const result = service.update(2.0, scene);

      expect(result.killed.length).toBe(0);
      expect(result.fired.length).toBe(0);
    });

    it('should not fire when there are no registered towers', () => {
      // No registerTower call
      const enemy = createTestEnemy('e1', TOWER_X, TOWER_Z, 100);
      enemyMap.set('e1', enemy);

      const result = service.update(0.016, scene);

      expect(result.killed.length).toBe(0);
      expect(result.fired.length).toBe(0);
    });
  });

  // ─── 3. Multiple towers targeting same enemy — only one kill credit ───

  describe('multiple towers targeting same low-health enemy', () => {
    it('should only register one kill even when multiple towers target the same enemy', () => {
      // Two towers at same position — both will target the same nearby enemy
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      service.registerTower(TOWER_ROW, TOWER_COL + 1, TowerType.BASIC, new THREE.Group());

      // Enemy health exactly equals one shot — first tower kills it
      const damage = TOWER_CONFIGS[TowerType.BASIC].damage;
      const enemy = createTestEnemy('e1', TOWER_X, TOWER_Z, damage);
      enemyMap.set('e1', enemy);

      const result = service.update(0.016, scene);

      // Only one kill should be reported (the fatal hit)
      const killsForE1 = result.killed.filter((k: KillInfo) => k.id === 'e1');
      expect(killsForE1.length).toBe(1);
    });
  });

  // ─── 4. Splash tower hits multiple enemies ───

  describe('splash tower hits multiple enemies in blast radius', () => {
    it('should damage all enemies within splash radius', () => {
      // SPLASH tower: splashRadius = 1.5, damage = 15
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SPLASH, new THREE.Group());

      // Primary target at tower position — instant hit
      const primary = createTestEnemy('p', TOWER_X, TOWER_Z, 1000);
      // Secondary target within splash radius
      const secondary = createTestEnemy('s', TOWER_X + 0.8, TOWER_Z, 1000);
      enemyMap.set('p', primary);
      enemyMap.set('s', secondary);

      service.update(0.016, scene);

      expect(primary.health).toBeLessThan(1000);
      expect(secondary.health).toBeLessThan(1000);
    });

    it('should not damage enemies outside splash radius', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SPLASH, new THREE.Group());

      const primary = createTestEnemy('p', TOWER_X, TOWER_Z, 1000);
      // Beyond splashRadius=1.5
      const outside = createTestEnemy('out', TOWER_X + 3.0, TOWER_Z, 1000);
      enemyMap.set('p', primary);
      enemyMap.set('out', outside);

      service.update(0.016, scene);

      expect(primary.health).toBeLessThan(1000);
      expect(outside.health).toBe(1000);
    });
  });

  // ─── 5. Tower kill: kill info has correct id and damage ───

  describe('tower fires, enemy dies → kill recorded with id and damage', () => {
    it('should include enemy id and damage in KillInfo', () => {
      const damage = TOWER_CONFIGS[TowerType.BASIC].damage;
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      const enemy = createTestEnemy('e1', TOWER_X, TOWER_Z, damage);
      enemyMap.set('e1', enemy);

      const result = service.update(0.016, scene);

      expect(result.killed[0].id).toBe('e1');
      expect(result.killed[0].damage).toBe(damage);
    });

    it('should include tower type in fired list when tower fires', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SNIPER, new THREE.Group());

      const enemy = createTestEnemy('e1', TOWER_X, TOWER_Z, 10000);
      enemyMap.set('e1', enemy);

      const result = service.update(0.016, scene);

      expect(result.fired).toContain(TowerType.SNIPER);
    });
  });

  // ─── 6. No towers registered → update is a no-op ───

  describe('cleanup', () => {
    it('should report zero towers after cleanup', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      expect(service.getPlacedTowers().size).toBe(1);

      service.cleanup(scene);

      expect(service.getPlacedTowers().size).toBe(0);
    });
  });
});
