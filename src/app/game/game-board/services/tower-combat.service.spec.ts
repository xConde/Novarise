import { TestBed } from '@angular/core/testing';
import { TowerCombatService, KillInfo, CombatAudioEvent } from './tower-combat.service';
import { ChainLightningService } from './chain-lightning.service';
// M2 S5: ProjectileService import removed (file deleted)
import { CombatVFXService } from './combat-vfx.service';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { TowerType, TowerSpecialization, TOWER_CONFIGS, TOWER_SPECIALIZATIONS, MAX_TOWER_LEVEL, getUpgradeCost, getSellValue, getEffectiveStats, TowerStats, TargetingMode, DEFAULT_TARGETING_MODE, TARGETING_MODES } from '../models/tower.model';
import { Enemy } from '../models/enemy.model';
import { StatusEffectService } from './status-effect.service';
import { StatusEffectType } from '../constants/status-effect.constants';
import { CHAIN_LIGHTNING_CONFIG } from '../constants/combat.constants';
import { PROJECTILE_VISUAL_CONFIG } from '../constants/effects.constants';
import * as THREE from 'three';
import { createTestEnemy, createGameBoardServiceSpy, createEnemyServiceSpy, createTowerAnimationServiceSpy, createRelicServiceSpy, createCardEffectServiceSpy } from '../testing';
import { TowerAnimationService } from './tower-animation.service';
import { RelicService } from '../../../run/services/relic.service';
import { CardEffectService } from '../../../run/services/card-effect.service';

describe('TowerCombatService', () => {
  let service: TowerCombatService;
  let combatVFXService: CombatVFXService;
  let enemyServiceSpy: jasmine.SpyObj<EnemyService>;
  let gameBoardServiceSpy: jasmine.SpyObj<GameBoardService>;
  let statusEffectService: StatusEffectService;
  let mockScene: THREE.Scene;
  let enemyMap: Map<string, Enemy>;

  // Tower at row=10, col=12 on a 25x20 board → world position: (-0.5, 0)
  const TOWER_ROW = 10;
  const TOWER_COL = 12;
  const TOWER_WORLD_X = -0.5;
  const TOWER_WORLD_Z = 0;

  // Turn numbers for sequential tests
  const TURN_1 = 1;
  const TURN_2 = 2;
  const TURN_3 = 3;

  // Helper: create a mock enemy at a world position
  const createEnemy = (id: string, x: number, z: number, health = 100): Enemy =>
    createTestEnemy(id, x, z, health);

  beforeEach(() => {
    enemyMap = new Map();

    enemyServiceSpy = createEnemyServiceSpy(enemyMap);
    gameBoardServiceSpy = createGameBoardServiceSpy(25, 20, 1);

    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        ChainLightningService,
        CombatVFXService,
        StatusEffectService,
        GameStateService,
        { provide: EnemyService, useValue: enemyServiceSpy },
        { provide: GameBoardService, useValue: gameBoardServiceSpy },
        { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
        { provide: RelicService, useValue: createRelicServiceSpy() },
        { provide: CardEffectService, useValue: createCardEffectServiceSpy() },
      ]
    });
    service = TestBed.inject(TowerCombatService);
    combatVFXService = TestBed.inject(CombatVFXService);
    statusEffectService = TestBed.inject(StatusEffectService);
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

      const result = service.fireTurn(mockScene, TURN_1);
      expect(result.killed.length).toBe(0);
      // Enemy health should be unchanged
      expect(enemy.health).toBe(100);
    });

    it('should fire at an enemy within range (verified by damage)', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy at tower position — instant damage
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', enemy);

      service.fireTurn(mockScene, TURN_1);
      expect(enemy.health).toBeLessThan(1000);
    });

    it('should target nearest enemy when multiple are in range', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Near enemy at tower position — distance 0
      const nearEnemy = createEnemy('near', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('near', nearEnemy);

      // Far enemy at (2, 2) — distance ~2.9, within BASIC range=3
      const farEnemy = createEnemy('far', TOWER_WORLD_X + 2, TOWER_WORLD_Z, 1000);
      enemyMap.set('far', farEnemy);

      // fireTurn fires once per turn (shotsPerTurn=1); nearest mode targets nearEnemy
      service.fireTurn(mockScene, TURN_1);

      // Near enemy should take damage, far enemy should not (only one shot per turn)
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

      service.fireTurn(mockScene, TURN_1);

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
      expect(tower.targetingMode).toBe(TargetingMode.NEAREST);
    });

    it('should set targeting mode via setTargetingMode', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;

      expect(service.setTargetingMode(key, TargetingMode.FIRST)).toBeTrue();
      expect(service.getTower(key)!.targetingMode).toBe(TargetingMode.FIRST);

      expect(service.setTargetingMode(key, TargetingMode.STRONGEST)).toBeTrue();
      expect(service.getTower(key)!.targetingMode).toBe(TargetingMode.STRONGEST);
    });

    it('should return false for setTargetingMode on non-existent tower', () => {
      expect(service.setTargetingMode('99-99', TargetingMode.FIRST)).toBeFalse();
    });

    it('should cycle targeting mode through all modes', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;

      // Default is NEAREST (index 0) → cycles to FIRST (index 1)
      expect(service.cycleTargetingMode(key)).toBe(TargetingMode.FIRST);
      expect(service.cycleTargetingMode(key)).toBe(TargetingMode.STRONGEST);
      expect(service.cycleTargetingMode(key)).toBe(TargetingMode.NEAREST); // wraps around
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

      service.fireTurn(mockScene, TURN_1);

      // Nearest (close) should be targeted — takes damage first
      expect(close.health).toBeLessThan(50);
      expect(far.health).toBe(200);
    });

    it('findTarget with first returns enemy furthest along path', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.setTargetingMode(key, TargetingMode.FIRST);

      // Close enemy but early in path
      const close = createEnemy('close', TOWER_WORLD_X + 0.5, TOWER_WORLD_Z, 1000);
      close.distanceTraveled = 2;
      // Farther enemy but further along path
      const far = createEnemy('far', TOWER_WORLD_X + 2, TOWER_WORLD_Z, 1000);
      far.distanceTraveled = 10;
      enemyMap.set('close', close);
      enemyMap.set('far', far);

      service.fireTurn(mockScene, TURN_1);

      // 'first' mode targets the enemy closest to exit (highest distanceTraveled)
      // far enemy should be targeted — damage applied instantly
      expect(far.health).toBeLessThan(1000);
      expect(close.health).toBe(1000);
    });

    it('findTarget with strongest returns enemy with highest health', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.setTargetingMode(key, TargetingMode.STRONGEST);

      // Weak enemy right at tower
      const weak = createEnemy('weak', TOWER_WORLD_X, TOWER_WORLD_Z, 50);
      weak.distanceTraveled = 5;
      // Strong enemy nearby (within range=3)
      const strong = createEnemy('strong', TOWER_WORLD_X + 1, TOWER_WORLD_Z, 500);
      strong.distanceTraveled = 1;
      enemyMap.set('weak', weak);
      enemyMap.set('strong', strong);

      service.fireTurn(mockScene, TURN_1);

      // 'strongest' mode targets the enemy with highest current health
      // strong (500hp) should be targeted, weak (50hp) should not
      expect(strong.health).toBeLessThan(500);
      expect(weak.health).toBe(50);
    });

    it('should preserve targeting mode across upgrade', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;

      service.setTargetingMode(key, TargetingMode.STRONGEST);
      expect(service.getTower(key)!.targetingMode).toBe(TargetingMode.STRONGEST);

      const upgraded = service.upgradeTower(key);
      expect(upgraded).toBeTrue();
      expect(service.getTower(key)!.targetingMode).toBe(TargetingMode.STRONGEST);
    });
  });

  // --- Fire Rate (turn-based: each fireTurn fires once per tower) ---
  // NOTE: Physics-cooldown semantics are GONE. In turn-based mode each tower fires
  // shotsPerTurn times (currently 1) on every fireTurn() call. Tests asserting
  // "fires every X seconds" or "fires N times in T seconds" are deleted because the
  // deltaTime loop no longer exists.

  describe('fire rate (turn-based)', () => {
    it('should apply damage on each fireTurn call (one shot per turn)', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', enemy);

      // Turn 1 — fires once → 1 × baseDamage taken
      service.fireTurn(mockScene, TURN_1);
      const healthAfterTurn1 = enemy.health;
      expect(healthAfterTurn1).toBe(10000 - TOWER_CONFIGS[TowerType.BASIC].damage);

      // Turn 2 — fires again → another baseDamage taken
      service.fireTurn(mockScene, TURN_2);
      expect(enemy.health).toBe(healthAfterTurn1 - TOWER_CONFIGS[TowerType.BASIC].damage);
    });

    it('should fire on turn 1 (no warm-up needed)', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', enemy);

      const result = service.fireTurn(mockScene, TURN_1);
      expect(result.fired).toContain(TowerType.BASIC);
      expect(enemy.health).toBeLessThan(10000);
    });
  });

  // --- Damage ---

  describe('damage', () => {
    it('should apply damage when tower fires', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', enemy);

      service.fireTurn(mockScene, TURN_1);
      expect(enemy.health).toBe(1000 - TOWER_CONFIGS[TowerType.BASIC].damage);
    });

    it('should return killed enemy IDs on the turn the kill happens', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy with exactly lethal health — dies from first hit
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 25);
      enemyMap.set('e1', enemy);

      const result = service.fireTurn(mockScene, TURN_1);
      expect(result.killed.map((k: KillInfo) => k.id)).toContain('e1');
    });

    it('should include the damage dealt in KillInfo', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy with exactly lethal health
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 25);
      enemyMap.set('e1', enemy);

      const result = service.fireTurn(mockScene, TURN_1);
      const kill = result.killed.find((k: KillInfo) => k.id === 'e1');
      expect(kill).toBeDefined();
      expect(kill!.damage).toBe(TOWER_CONFIGS[TowerType.BASIC].damage);
    });

    it('should not report kill for surviving enemy', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', enemy);

      const result = service.fireTurn(mockScene, TURN_1);
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

      service.fireTurn(mockScene, TURN_1);

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

      service.fireTurn(mockScene, TURN_1);

      expect(near.health).toBeLessThan(1000);
      expect(far.health).toBe(1000); // Out of splash range
    });
  });

  // --- Projectile Lifecycle ---
  // NOTE: The old deltaTime-based projectile flight system (ProjectileService) is
  // DELETED (M2 S5). Damage is now instantaneous in fireTurn(). All tests exercising
  // projectile-in-flight state, trail geometry, pool lifecycle, and visual config
  // of in-flight meshes have been removed because the underlying objects no longer
  // exist. Damage semantics are covered in the 'damage' and 'targeting' suites above.

  // --- Kill Tracking ---

  describe('kill tracking', () => {
    it('should increment tower kill count', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Enemy that dies in one hit
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1);
      enemyMap.set('e1', enemy);

      service.fireTurn(mockScene, TURN_1);

      const tower = service.getTower(`${TOWER_ROW}-${TOWER_COL}`)!;
      expect(tower.kills).toBe(1);
    });

    it('should track kills across multiple enemies over multiple turns', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // First enemy — dies in one hit (turn 1)
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1);
      enemyMap.set('e1', e1);
      service.fireTurn(mockScene, TURN_1);

      // Remove dead enemy, add new one for turn 2
      enemyMap.delete('e1');
      const e2 = createEnemy('e2', TOWER_WORLD_X, TOWER_WORLD_Z, 1);
      enemyMap.set('e2', e2);

      service.fireTurn(mockScene, TURN_2);

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

    it('should fire immediately after cleanup + re-register (no warm-up)', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      service.cleanup(mockScene);

      // Register new tower after cleanup
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const freshEnemy = createEnemy('e2', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e2', freshEnemy);

      // New tower should fire immediately on turn 1
      service.fireTurn(mockScene, TURN_1);
      expect(freshEnemy.health).toBeLessThan(10000);
    });

    it('should not throw when cleaning up with no towers', () => {
      expect(() => service.cleanup(mockScene)).not.toThrow();
    });
  });

  // --- Edge Cases ---

  describe('edge cases', () => {
    it('should handle fireTurn with no towers', () => {
      const enemy = createEnemy('e1', 0, 0);
      enemyMap.set('e1', enemy);

      const result = service.fireTurn(mockScene, TURN_1);
      expect(result.killed.length).toBe(0);
    });

    it('should handle fireTurn with no enemies', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const result = service.fireTurn(mockScene, TURN_1);
      expect(result.killed.length).toBe(0);
    });

    it('should not double-count kills when multiple towers target the same low-health enemy', () => {
      // Two towers targeting the same enemy
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      service.registerTower(TOWER_ROW, TOWER_COL + 1, TowerType.BASIC, new THREE.Group());

      // Enemy with health that dies from first hit
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1);
      enemyMap.set('e1', enemy);

      const result = service.fireTurn(mockScene, TURN_1);

      // Should only report the kill once (second tower sees health <= 0)
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

      service.fireTurn(mockScene, TURN_1);

      // Level 2 BASIC: 25 * 1.5 = 38 (rounded)
      const expectedDamage = getEffectiveStats(TowerType.BASIC, 2).damage;
      expect(enemy.health).toBe(10000 - expectedDamage);
    });
  });

  // --- Upgraded card semantic (startLevel: 2) ---

  describe('upgraded tower card placement (startLevel 2 semantic)', () => {
    it('registers at L1 then upgrades to L2 at zero additional cost (upgraded card semantic)', () => {
      service.registerTower(5, 5, TowerType.BASIC, new THREE.Group());
      const baseCost = TOWER_CONFIGS[TowerType.BASIC].cost;
      expect(service.getTower('5-5')!.level).toBe(1);

      // Simulate the upgraded-card logic in game-board.component.ts:
      // actualCost = 0 because the card upgrade "pays" for the level-2 placement.
      const result = service.upgradeTower('5-5', 0);

      expect(result).toBeTrue();
      const tower = service.getTower('5-5')!;
      expect(tower.level).toBe(2);
      // totalInvested = placement cost only (upgrade was "free" via card)
      expect(tower.totalInvested).toBe(baseCost);
    });

    it('level-2 tower from upgraded card has L2 effective stats', () => {
      service.registerTower(5, 5, TowerType.SNIPER, new THREE.Group());
      service.upgradeTower('5-5', 0);

      const l1Stats = getEffectiveStats(TowerType.SNIPER, 1);
      const l2Stats = getEffectiveStats(TowerType.SNIPER, 2);

      // L2 damage must be strictly greater than L1 damage
      expect(l2Stats.damage).toBeGreaterThan(l1Stats.damage);
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
  // NOTE: SLOW tower in turn-based mode applies via applySlowAura() inside fireTurn().
  // StatusEffectService.apply() receives turnNumber (not gameTime) as the clock — this
  // was a bug that was fixed earlier this session. Speed restoration after expiry
  // depends on StatusEffectService.tickTurn() being called externally by CombatLoopService,
  // so the old real-time "advance 2.5s and verify restored speed" tests are deleted here
  // (those semantics live in status-effect.service.spec.ts).

  describe('Slow tower', () => {
    it('should apply slow status effect to enemy within range', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 100);
      enemyMap.set('e1', enemy);

      const applySpy = spyOn(statusEffectService, 'apply').and.callThrough();

      service.fireTurn(mockScene, TURN_1);

      const slowCalls = applySpy.calls.all().filter(c => c.args[1] === StatusEffectType.SLOW);
      expect(slowCalls.length).toBeGreaterThan(0);
      expect(slowCalls[0].args[0]).toBe('e1');
    });

    it('should pass turnNumber as clock to StatusEffectService.apply for SLOW', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 100);
      enemyMap.set('e1', enemy);

      const applySpy = spyOn(statusEffectService, 'apply').and.callThrough();

      service.fireTurn(mockScene, TURN_1);

      const slowCall = applySpy.calls.all().find(c => c.args[1] === StatusEffectType.SLOW);
      expect(slowCall).toBeDefined();
      // Third arg is turnNumber (1), NOT gameTime (which would be 0 — the pre-fix bug)
      expect(slowCall!.args[2]).toBe(TURN_1);
    });

    it('should not affect enemies outside range', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const farEnemy = createEnemy('far', 20, 20, 100);
      enemyMap.set('far', farEnemy);

      const applySpy = spyOn(statusEffectService, 'apply').and.callThrough();

      service.fireTurn(mockScene, TURN_1);

      const slowCalls = applySpy.calls.all().filter(c => c.args[1] === StatusEffectType.SLOW);
      expect(slowCalls.length).toBe(0);
    });

    it('should include SLOW in fired array when slow tower pulses', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 100);
      enemyMap.set('e1', enemy);

      const result = service.fireTurn(mockScene, TURN_1);
      expect(result.fired).toContain(TowerType.SLOW);
    });

    it('should restore all slow effects on cleanup', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 100);
      const originalSpeed = enemy.speed;
      enemyMap.set('e1', enemy);

      service.fireTurn(mockScene, TURN_1);
      // Enemy speed may now be reduced by StatusEffectService

      service.cleanup(mockScene);
      // After cleanup, StatusEffectService.cleanup() restores speeds
      expect(enemy.speed).toBeCloseTo(originalSpeed);
    });
  });

  // --- Chain Lightning Tower ---

  describe('Chain tower', () => {
    it('should deal damage to primary target on fire', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      service.fireTurn(mockScene, TURN_1);
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

      service.fireTurn(mockScene, TURN_1);
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

      service.fireTurn(mockScene, TURN_1);
      expect(e1.health).toBeLessThan(1000);
      expect(e2.health).toBe(1000); // out of chain range
    });

    it('should not chain to the same enemy twice', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());

      // Single enemy in range — chain should only hit it once
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      service.fireTurn(mockScene, TURN_1);
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

      service.fireTurn(mockScene, TURN_1);

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

      const result = service.fireTurn(mockScene, TURN_1);
      const killedIds = result.killed.map((k: KillInfo) => k.id);
      expect(killedIds).toContain('e1');
      expect(killedIds).toContain('e2');
    });
  });

  // --- Mortar Tower ---

  describe('Mortar tower', () => {
    it('should fire and appear in fired list on turn 1', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X + 3, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      const result = service.fireTurn(mockScene, TURN_1);
      expect(result.fired).toContain(TowerType.MORTAR);
    });

    it('should deal initial blast damage on the turn it fires', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      // Enemy at tower position — within blast radius
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      service.fireTurn(mockScene, TURN_1);
      expect(e1.health).toBeLessThan(1000);
    });

    it('should deal DoT on subsequent turns via tickMortarZonesForTurn', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      // Turn 1: fires, drops zone, initial blast applies
      service.fireTurn(mockScene, TURN_1);
      const healthAfterBlast = e1.health;

      // Turn 2: tick mortar zones AFTER fireTurn so zone doesn't double-tick
      service.fireTurn(mockScene, TURN_2); // tower fires again (new blast)
      // Also tick the existing zone from turn 1
      service.tickMortarZonesForTurn(mockScene, TURN_2);

      // Health should have decreased further from the zone DoT tick
      expect(e1.health).toBeLessThan(healthAfterBlast);
    });

    it('should stop dealing DoT after dotDuration turns expire', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      // Turn 1: fire — zone created with expiresOnTurn = 1 + dotDuration (3) = 4
      service.fireTurn(mockScene, TURN_1);

      // Move enemy out of range so new mortar shots from tower don't refuel damage
      e1.position.x = TOWER_WORLD_X + 20;

      // Tick turns 2 and 3 — still within zone lifetime (< 4)
      service.tickMortarZonesForTurn(mockScene, TURN_2);
      service.tickMortarZonesForTurn(mockScene, TURN_3);
      const healthAfterActiveTurns = e1.health;

      // Turn 4 and 5 — zone expired (turnNumber >= expiresOnTurn=4)
      service.tickMortarZonesForTurn(mockScene, 4);
      service.tickMortarZonesForTurn(mockScene, 5);

      // Health should not decrease after zone expiry
      expect(e1.health).toBe(healthAfterActiveTurns);
    });

    it('should damage multiple enemies within blastRadius', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const blastRadius = TOWER_CONFIGS[TowerType.MORTAR].blastRadius!;

      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      const e2 = createEnemy('e2', TOWER_WORLD_X + blastRadius * 0.5, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      // Fire and impact at tower position
      service.fireTurn(mockScene, TURN_1);

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

      service.fireTurn(mockScene, TURN_1);

      expect(e1.health).toBeLessThan(1000);
      expect(far.health).toBe(1000);
    });

    it('should clean up mortar zones on cleanup()', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      service.fireTurn(mockScene, TURN_1); // creates zone

      service.cleanup(mockScene); // should dispose zone mesh without throwing

      // After cleanup, no more DoT on next tick
      const kills = service.tickMortarZonesForTurn(mockScene, TURN_2);
      expect(kills.length).toBe(0);
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

      service.fireTurn(mockScene, TURN_1);

      const chainArcs = combatVFXService.getChainArcs();
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

      service.fireTurn(mockScene, TURN_1);

      const chainArcs = combatVFXService.getChainArcs();
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
  // NOTE: Impact flash VFX (CombatVFXService.getImpactFlashCount) was driven by
  // projectile hits in the old deltaTime path. In the turn-based path (fireTurn),
  // startHitFlash() is called on EnemyService which handles the enemy's flash
  // state — no scene-level flash sphere is spawned by TowerCombatService.
  // These tests are removed; impact flash is now CombatVFXService internal state
  // untouched by fireTurn() directly.

  // --- Status Effect Wiring ---

  describe('status effect wiring', () => {
    it('Mortar blast should apply statusEffect to surviving enemies in blast radius', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      // Enemy at tower position — mortar hits instantly, has high health so it survives
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      const applySpy = spyOn(statusEffectService, 'apply').and.callThrough();

      service.fireTurn(mockScene, TURN_1); // fires and hits

      // MORTAR config has statusEffect = BURN
      const burnCalls = applySpy.calls.all().filter(c => c.args[1] === StatusEffectType.BURN);
      expect(burnCalls.length).toBeGreaterThan(0);
      expect(burnCalls[0].args[0]).toBe('e1');
    });

    it('Mortar blast should NOT apply statusEffect to enemies killed by the blast', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      // Enemy with exactly dotDamage health — killed by initial blast
      const dotDamage = TOWER_CONFIGS[TowerType.MORTAR].dotDamage!;
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, dotDamage);
      enemyMap.set('e1', e1);

      const applySpy = spyOn(statusEffectService, 'apply').and.callThrough();

      service.fireTurn(mockScene, TURN_1);

      // Enemy was killed — apply should not be called for it with BURN
      const burnCalls = applySpy.calls.all().filter(
        c => c.args[0] === 'e1' && c.args[1] === StatusEffectType.BURN
      );
      expect(burnCalls.length).toBe(0);
    });

    it('Mortar zone DoT ticks should apply statusEffect to surviving enemies in zone', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      // Fire and create zone
      service.fireTurn(mockScene, TURN_1);

      const applySpy = spyOn(statusEffectService, 'apply').and.callThrough();

      // Tick zone on turn 2 — enemy still in zone, status effect should fire
      service.tickMortarZonesForTurn(mockScene, TURN_2);

      const burnCalls = applySpy.calls.all().filter(c => c.args[1] === StatusEffectType.BURN);
      expect(burnCalls.length).toBeGreaterThan(0);
    });

    it('Splash Bombardier L3 should apply POISON to surviving enemies in splash radius', () => {
      // Set up L3 Bombardier (SPLASH ALPHA)
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SPLASH, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.upgradeTower(key);
      service.upgradeTowerWithSpec(key, TowerSpecialization.ALPHA);

      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      const applySpy = spyOn(statusEffectService, 'apply').and.callThrough();

      service.fireTurn(mockScene, TURN_1);

      const poisonCalls = applySpy.calls.all().filter(c => c.args[1] === StatusEffectType.POISON);
      expect(poisonCalls.length).toBeGreaterThan(0);
      expect(poisonCalls[0].args[0]).toBe('e1');
    });

    it('Splash Bombardier L3 should NOT apply POISON to enemies killed by splash', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SPLASH, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.upgradeTower(key);
      service.upgradeTowerWithSpec(key, TowerSpecialization.ALPHA);

      const splashDamage = Math.round(TOWER_CONFIGS[TowerType.SPLASH].damage * 2.8); // L3 Bombardier damage
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, splashDamage);
      enemyMap.set('e1', e1);

      const applySpy = spyOn(statusEffectService, 'apply').and.callThrough();

      service.fireTurn(mockScene, TURN_1);

      // Enemy killed — should not receive POISON
      const poisonCalls = applySpy.calls.all().filter(
        c => c.args[0] === 'e1' && c.args[1] === StatusEffectType.POISON
      );
      expect(poisonCalls.length).toBe(0);
    });

    it('Basic tower should NOT apply any status effect on hit', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      const applySpy = spyOn(statusEffectService, 'apply').and.callThrough();

      service.fireTurn(mockScene, TURN_1);

      // Basic tower has no statusEffect — only SLOW tower calls apply
      const nonSlowCalls = applySpy.calls.all().filter(
        c => c.args[1] !== StatusEffectType.SLOW
      );
      expect(nonSlowCalls.length).toBe(0);
    });

    it('Sniper tower should NOT apply any status effect on hit', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SNIPER, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      const applySpy = spyOn(statusEffectService, 'apply').and.callThrough();

      service.fireTurn(mockScene, TURN_1);

      const nonSlowCalls = applySpy.calls.all().filter(
        c => c.args[1] !== StatusEffectType.SLOW
      );
      expect(nonSlowCalls.length).toBe(0);
    });

    it('Chain Tesla L3 should apply BURN to surviving chained enemies', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.upgradeTower(key);
      service.upgradeTowerWithSpec(key, TowerSpecialization.ALPHA);

      const chainRange = TOWER_CONFIGS[TowerType.CHAIN].chainRange!;
      // Both enemies survive (high health) — primary and one chain bounce
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      const e2 = createEnemy('e2', TOWER_WORLD_X + chainRange * 0.5, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      const applySpy = spyOn(statusEffectService, 'apply').and.callThrough();

      service.fireTurn(mockScene, TURN_1);

      const burnCalls = applySpy.calls.all().filter(c => c.args[1] === StatusEffectType.BURN);
      expect(burnCalls.length).toBeGreaterThanOrEqual(2);
      const burnTargetIds = burnCalls.map(c => c.args[0] as string);
      expect(burnTargetIds).toContain('e1');
      expect(burnTargetIds).toContain('e2');
    });

    it('Chain Tesla L3 should NOT apply BURN to enemies killed by the chain', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.upgradeTower(key);
      service.upgradeTowerWithSpec(key, TowerSpecialization.ALPHA);

      // Enemy health == Chain Tesla L3 damage (30) so it dies on hit
      const teslaDamage = getEffectiveStats(TowerType.CHAIN, 3, TowerSpecialization.ALPHA).damage;
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, teslaDamage);
      enemyMap.set('e1', e1);

      const applySpy = spyOn(statusEffectService, 'apply').and.callThrough();

      service.fireTurn(mockScene, TURN_1);

      const burnCalls = applySpy.calls.all().filter(
        c => c.args[0] === 'e1' && c.args[1] === StatusEffectType.BURN
      );
      expect(burnCalls.length).toBe(0);
    });

    it('Chain Arc L3 (BETA) should NOT apply BURN — only Tesla does', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.upgradeTower(key);
      service.upgradeTowerWithSpec(key, TowerSpecialization.BETA); // Arc spec, no statusEffect

      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);

      const applySpy = spyOn(statusEffectService, 'apply').and.callThrough();

      service.fireTurn(mockScene, TURN_1);

      const burnCalls = applySpy.calls.all().filter(c => c.args[1] === StatusEffectType.BURN);
      expect(burnCalls.length).toBe(0);
    });
  });

  // --- MORTAR BURN DoT full-chain integration ---
  // NOTE: The old tests drove BURN ticks via StatusEffectService.update(deltaTime)
  // called inside the old physics loop. That loop is deleted. BURN ticks now run
  // via StatusEffectService.tickTurn() called from CombatLoopService.resolveTurn().
  // Those semantics are covered in status-effect.service.spec.ts and the
  // combat-integration.spec.ts mortar section. Deleted tests:
  //   - "BURN ticks from StatusEffectService should reduce enemy health after mortar blast"
  //   - "BURN deals cumulative damage across multiple ticks after mortar blast"
  //   - "BURN tick kills enemy when remaining health equals one tick damage"

  // --- Chain damage-per-hop: 3-enemy falloff chain ---

  describe('Chain tower damage per hop (3+ enemies)', () => {
    it('should apply exact falloff across three chained targets', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());

      const chainRange = TOWER_CONFIGS[TowerType.CHAIN].chainRange!;
      const baseDamage = TOWER_CONFIGS[TowerType.CHAIN].damage;

      // Three enemies in a line, each within chainRange of the previous
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      const e2 = createEnemy('e2', TOWER_WORLD_X + chainRange * 0.5, TOWER_WORLD_Z, 10000);
      const e3 = createEnemy('e3', TOWER_WORLD_X + chainRange * 0.9, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);
      enemyMap.set('e3', e3);

      service.fireTurn(mockScene, TURN_1);

      const e1Damage = 10000 - e1.health;
      const e2Damage = 10000 - e2.health;
      const e3Damage = 10000 - e3.health;

      // Primary target receives full base damage
      expect(e1Damage).toBe(baseDamage);

      // Second target receives baseDamage * falloff (0.7)
      const expectedSecond = Math.round(baseDamage * CHAIN_LIGHTNING_CONFIG.damageFalloff);
      expect(e2Damage).toBe(expectedSecond);

      // Third target receives second-hop damage * falloff (0.7 * 0.7)
      const expectedThird = Math.round(expectedSecond * CHAIN_LIGHTNING_CONFIG.damageFalloff);
      expect(e3Damage).toBe(expectedThird);
    });

    it('primary target always receives full unmodified damage regardless of chain length', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());

      const chainRange = TOWER_CONFIGS[TowerType.CHAIN].chainRange!;
      const baseDamage = TOWER_CONFIGS[TowerType.CHAIN].damage;

      // Stack four enemies — primary must still take exactly baseDamage
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      const e2 = createEnemy('e2', TOWER_WORLD_X + chainRange * 0.3, TOWER_WORLD_Z, 10000);
      const e3 = createEnemy('e3', TOWER_WORLD_X + chainRange * 0.6, TOWER_WORLD_Z, 10000);
      const e4 = createEnemy('e4', TOWER_WORLD_X + chainRange * 0.8, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);
      enemyMap.set('e3', e3);
      enemyMap.set('e4', e4);

      service.fireTurn(mockScene, TURN_1);

      expect(10000 - e1.health).toBe(baseDamage);
    });

    it('secondary targets receive strictly less damage than primary', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());

      const chainRange = TOWER_CONFIGS[TowerType.CHAIN].chainRange!;
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      const e2 = createEnemy('e2', TOWER_WORLD_X + chainRange * 0.5, TOWER_WORLD_Z, 10000);
      const e3 = createEnemy('e3', TOWER_WORLD_X + chainRange * 0.9, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);
      enemyMap.set('e3', e3);

      service.fireTurn(mockScene, TURN_1);

      const e1Damage = 10000 - e1.health;
      const e2Damage = 10000 - e2.health;
      const e3Damage = 10000 - e3.health;

      expect(e2Damage).toBeLessThan(e1Damage);
      expect(e3Damage).toBeLessThan(e2Damage);
    });

    it('each hop damage matches CHAIN_LIGHTNING_CONFIG.damageFalloff constant exactly', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());

      const chainRange = TOWER_CONFIGS[TowerType.CHAIN].chainRange!;
      const baseDamage = TOWER_CONFIGS[TowerType.CHAIN].damage;
      const falloff = CHAIN_LIGHTNING_CONFIG.damageFalloff;

      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      const e2 = createEnemy('e2', TOWER_WORLD_X + chainRange * 0.5, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      service.fireTurn(mockScene, TURN_1);

      const e1Damage = 10000 - e1.health;
      const e2Damage = 10000 - e2.health;

      expect(e1Damage).toBe(baseDamage);
      expect(e2Damage).toBe(Math.round(baseDamage * falloff));
    });
  });

  // --- SpatialGrid: rebuild timing and range query ---

  describe('SpatialGrid query correctness', () => {
    it('enemies within tower range are found and damaged after spatial grid rebuild', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Place enemy within BASIC range (3 world units)
      const inRange = createEnemy('in', TOWER_WORLD_X + 1, TOWER_WORLD_Z, 10000);
      enemyMap.set('in', inRange);

      service.fireTurn(mockScene, TURN_1);

      expect(inRange.health).toBeLessThan(10000);
    });

    it('enemies outside tower range are not found by spatial grid query', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // BASIC range = 3 — place enemy just outside
      const outOfRange = createEnemy('out', TOWER_WORLD_X + 5, TOWER_WORLD_Z, 10000);
      enemyMap.set('out', outOfRange);

      service.fireTurn(mockScene, TURN_1);

      expect(outOfRange.health).toBe(10000); // untouched
    });

    it('spatial grid rebuilds every turn — newly added enemies are found immediately', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      // Turn 1 with no enemies — no fire (spatial grid built but empty)
      service.fireTurn(mockScene, TURN_1);

      // Add enemy for turn 2 — grid rebuilds and finds it
      const lateEnemy = createEnemy('late', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('late', lateEnemy);

      service.fireTurn(mockScene, TURN_2);

      expect(lateEnemy.health).toBeLessThan(10000);
    });

    it('spatial grid rebuilds correctly after an enemy is removed between turns', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1);
      enemyMap.set('e1', e1);

      // Turn 1: tower fires and kills e1 (health=1)
      service.fireTurn(mockScene, TURN_1);
      // Remove killed enemy from map (simulate EnemyService removal)
      enemyMap.delete('e1');

      // Add a new enemy and verify grid picks it up
      const e2 = createEnemy('e2', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e2', e2);

      service.fireTurn(mockScene, TURN_2);

      expect(e2.health).toBeLessThan(10000);
    });

    it('Chain tower spatial grid correctly finds enemies for chain bouncing', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());

      const chainRange = TOWER_CONFIGS[TowerType.CHAIN].chainRange!;
      // Two enemies: one in CHAIN tower range, one just within chainRange of the first
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      const e2 = createEnemy('e2', TOWER_WORLD_X + chainRange * 0.4, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      service.fireTurn(mockScene, TURN_1);

      // Both enemies should have been found by the spatial grid
      expect(e1.health).toBeLessThan(10000);
      expect(e2.health).toBeLessThan(10000);
    });
  });

  // --- drainAudioEvents ---

  describe('drainAudioEvents', () => {
    it('should return an empty array when no events have been accumulated', () => {
      const events = service.drainAudioEvents();
      expect(events).toEqual([]);
    });

    it('should accumulate a chainZap sfx event when CHAIN tower fires', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      service.fireTurn(mockScene, TURN_1);
      const events = service.drainAudioEvents();
      const sfxEvents = events.filter((e: CombatAudioEvent) => e.type === 'sfx' && e.sfxKey === 'chainZap');
      expect(sfxEvents.length).toBeGreaterThan(0);
    });

    it('should clear events after draining', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      service.fireTurn(mockScene, TURN_1);
      service.drainAudioEvents(); // first drain

      // Second drain should be empty
      const empty = service.drainAudioEvents();
      expect(empty).toEqual([]);
    });

    it('should not accumulate audio events when no towers fire', () => {
      service.fireTurn(mockScene, TURN_1); // no towers registered
      const events = service.drainAudioEvents();
      expect(events).toEqual([]);
    });
  });

  // --- Projectile visual config applied on fire ---
  // NOTE: The old tests verified in-flight projectile mesh color/material state from
  // ProjectileService. That service is DELETED (M2 S5). fireTurn() applies damage
  // instantaneously — no in-flight mesh is created for BASIC/SNIPER/SPLASH/MORTAR
  // towers. These visual config tests are removed. The PROJECTILE_VISUAL_CONFIG
  // data structure itself is tested in the Tower Model Functions section below.

  // ── Boundary conditions ────────────────────────────────────────────────────

  describe('boundary conditions', () => {
    // Board is 25×20, tileSize=1. For row=0, col=0:
    //   worldX = (0 - 25/2) * 1 = -12.5
    //   worldZ = (0 - 20/2) * 1 = -10
    const EDGE_WORLD_X = -12.5;
    const EDGE_WORLD_Z = -10;

    it('should register a tower at the board edge (row 0, col 0) without error', () => {
      expect(() => service.registerTower(0, 0, TowerType.BASIC, new THREE.Group())).not.toThrow();
      expect(service.getTower('0-0')).toBeTruthy();
    });

    it('tower at board edge targets an enemy at the same position', () => {
      service.registerTower(0, 0, TowerType.BASIC, new THREE.Group());

      // Enemy at the exact edge tower world position — distance 0, within any range
      const enemy = createEnemy('edge-e', EDGE_WORLD_X, EDGE_WORLD_Z, 1000);
      enemyMap.set('edge-e', enemy);

      service.fireTurn(mockScene, TURN_1);

      expect(enemy.health).toBeLessThan(1000);
    });

    it('fireTurn with no enemies returns empty killed array and does not throw', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      // enemyMap is empty

      let result: { killed: { id: string; damage: number }[]; fired: TowerType[]; hitCount: number } | undefined;
      expect(() => { result = service.fireTurn(mockScene, TURN_1); }).not.toThrow();
      expect(result!.killed.length).toBe(0);
    });

    it('fireTurn with no towers and no enemies does not throw', () => {
      // No towers registered, no enemies
      expect(() => service.fireTurn(mockScene, TURN_1)).not.toThrow();
    });

    it('enemy at exact BASIC range boundary (distance === range) is targeted', () => {
      // BASIC range = 3. Tower at (TOWER_ROW, TOWER_COL) → world (-0.5, 0).
      // Enemy placed at distance exactly = range along x-axis.
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const exactRangeX = TOWER_WORLD_X + TOWER_CONFIGS[TowerType.BASIC].range;
      const enemy = createEnemy('boundary-e', exactRangeX, TOWER_WORLD_Z, 1000);
      enemyMap.set('boundary-e', enemy);

      service.fireTurn(mockScene, TURN_1);

      expect(enemy.health).toBeLessThan(1000);
    });

    it('enemy just outside range (distance > range) is not targeted', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      // BASIC range = 3; place enemy 3.1 units away (just outside range)
      const outsideRangeX = TOWER_WORLD_X + TOWER_CONFIGS[TowerType.BASIC].range + 0.1;
      const enemy = createEnemy('outside-e', outsideRangeX, TOWER_WORLD_Z, 1000);
      enemyMap.set('outside-e', enemy);

      service.fireTurn(mockScene, TURN_1);

      expect(enemy.health).toBe(1000);
    });
  });

  // --- Card Modifier Wiring Tests ---

  describe('card modifier wiring', () => {
    let cardEffectSpy: jasmine.SpyObj<CardEffectService>;

    beforeEach(() => {
      cardEffectSpy = TestBed.inject(CardEffectService) as jasmine.SpyObj<CardEffectService>;
    });

    it('fireRate: positive boost gives 2 shots per turn (ceil semantic)', () => {
      // BASIC tower at tower position, enemy at tower position — always in range
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', enemy);

      // 30% fireRate boost → ceil(1.3) = 2 shots per turn
      cardEffectSpy.getModifierValue.and.callFake((stat: string) => stat === 'fireRate' ? 0.3 : 0);

      const result = service.fireTurn(mockScene, TURN_1);

      // Two shots fired — both hit the same enemy (only one in range)
      expect(result.fired.length).toBe(2);
    });

    it('sniperDamage: boosts SNIPER damage but leaves BASIC tower unchanged', () => {
      // SNIPER tower and BASIC tower, each at different rows so firing order is deterministic
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.SNIPER, new THREE.Group());
      service.registerTower(TOWER_ROW + 1, TOWER_COL, TowerType.BASIC, new THREE.Group());

      const sniperEnemy = createEnemy('se', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      const basicEnemy = createEnemy('be', TOWER_WORLD_X, TOWER_WORLD_Z + 0.01, 10000);
      enemyMap.set('se', sniperEnemy);
      enemyMap.set('be', basicEnemy);

      const baseSniperDamage = 80; // TOWER_CONFIGS[SNIPER].damage
      const baseBasicDamage = 25;  // TOWER_CONFIGS[BASIC].damage

      // Apply 50% sniperDamage boost
      cardEffectSpy.getModifierValue.and.callFake((stat: string) => stat === 'sniperDamage' ? 0.5 : 0);

      service.fireTurn(mockScene, TURN_1);

      // SNIPER damage should be boosted by 50%
      const sniperDamageTaken = 10000 - sniperEnemy.health;
      expect(sniperDamageTaken).toBe(Math.round(baseSniperDamage * 1.5));

      // BASIC damage should be unchanged
      const basicDamageTaken = 10000 - basicEnemy.health;
      expect(basicDamageTaken).toBe(baseBasicDamage);
    });

    it('chainBounces: extra bounces increase hitCount beyond chainCount', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.CHAIN, new THREE.Group());

      // 5 enemies at tower position so chain has targets for extra bounces
      for (let i = 0; i < 5; i++) {
        const e = createEnemy(`e${i}`, TOWER_WORLD_X + i * 0.2, TOWER_WORLD_Z, 10000);
        enemyMap.set(`e${i}`, e);
      }

      // 2 extra bounces on top of chainCount=3
      cardEffectSpy.getModifierValue.and.callFake((stat: string) => stat === 'chainBounces' ? 2 : 0);

      const result = service.fireTurn(mockScene, TURN_1);

      // hitCount = 1 (primary) + chainCount(3) + extraBounces(2) = 6
      expect(result.hitCount).toBeGreaterThanOrEqual(1 + 3 + 2);
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

    it('should preserve non-scaling stats (splashRadius, color)', () => {
      const stats = getEffectiveStats(TowerType.SPLASH, 3);
      expect(stats.splashRadius).toBe(TOWER_CONFIGS[TowerType.SPLASH].splashRadius);
      expect(stats.color).toBe(TOWER_CONFIGS[TowerType.SPLASH].color);
    });

    it('should have highest stats at max level', () => {
      const lvl1 = getEffectiveStats(TowerType.SNIPER, 1);
      const lvl3 = getEffectiveStats(TowerType.SNIPER, MAX_TOWER_LEVEL);
      expect(lvl3.damage).toBeGreaterThan(lvl1.damage);
      expect(lvl3.range).toBeGreaterThan(lvl1.range);
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
      const differs = alpha.damage !== beta.damage || alpha.range !== beta.range;
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

  // --- Projectile Visual Config ---

  describe('PROJECTILE_VISUAL_CONFIG', () => {
    it('should define a config for BASIC', () => {
      expect(PROJECTILE_VISUAL_CONFIG[TowerType.BASIC]).toBeDefined();
    });

    it('should define a config for SNIPER', () => {
      expect(PROJECTILE_VISUAL_CONFIG[TowerType.SNIPER]).toBeDefined();
    });

    it('should define a config for SPLASH', () => {
      expect(PROJECTILE_VISUAL_CONFIG[TowerType.SPLASH]).toBeDefined();
    });

    it('should define a config for MORTAR', () => {
      expect(PROJECTILE_VISUAL_CONFIG[TowerType.MORTAR]).toBeDefined();
    });

    it('should NOT define a config for CHAIN (uses arc visuals)', () => {
      expect(PROJECTILE_VISUAL_CONFIG[TowerType.CHAIN]).toBeUndefined();
    });

    it('should NOT define a config for SLOW (no projectile)', () => {
      expect(PROJECTILE_VISUAL_CONFIG[TowerType.SLOW]).toBeUndefined();
    });

    it('SNIPER config should have scaleZ for elongated bullet look', () => {
      expect(PROJECTILE_VISUAL_CONFIG[TowerType.SNIPER]?.scaleZ).toBeDefined();
      expect(PROJECTILE_VISUAL_CONFIG[TowerType.SNIPER]!.scaleZ).toBeGreaterThan(1);
    });

    it('SNIPER config should have higher emissiveIntensity than BASIC', () => {
      expect(PROJECTILE_VISUAL_CONFIG[TowerType.SNIPER]!.emissiveIntensity).toBeGreaterThan(
        PROJECTILE_VISUAL_CONFIG[TowerType.BASIC]!.emissiveIntensity
      );
    });
  });
});
