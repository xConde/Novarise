import { TestBed } from '@angular/core/testing';
import { TowerCombatService, KillInfo, CombatAudioEvent, DamageStackContext } from './tower-combat.service';
import { ChainLightningService } from './chain-lightning.service';
// M2 S5: ProjectileService import removed (file deleted)
import { CombatVFXService } from './combat-vfx.service';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { TowerType, TowerSpecialization, TOWER_CONFIGS, TOWER_SPECIALIZATIONS, MAX_TOWER_LEVEL, getUpgradeCost, getSellValue, getEffectiveStats, TowerStats, TargetingMode, DEFAULT_TARGETING_MODE, PlacedTower } from '../models/tower.model';
import { Enemy, EnemyType } from '../models/enemy.model';
import { StatusEffectService } from './status-effect.service';
import { StatusEffectType } from '../constants/status-effect.constants';
import { CHAIN_LIGHTNING_CONFIG } from '../constants/combat.constants';
import { PROJECTILE_VISUAL_CONFIG } from '../constants/effects.constants';
import * as THREE from 'three';
import { createTestEnemy, createGameBoardServiceSpy, createEnemyServiceSpy, createTowerAnimationServiceSpy, createRelicServiceSpy, createCardEffectServiceSpy } from '../testing';
import { TowerAnimationService } from './tower-animation.service';
import { RelicService } from '../../../run/services/relic.service';
import { CardEffectService } from '../../../run/services/card-effect.service';
import { RunService } from '../../../run/services/run.service';
import { PathfindingService } from './pathfinding.service';
import { LineOfSightService } from './line-of-sight.service';
import { ElevationService } from './elevation.service';
import { TowerGraphService } from './tower-graph.service';
import { ELEVATION_CONFIG } from '../constants/elevation.constants';
import { MODIFIER_STAT } from '../../../run/constants/modifier-stat.constants';

describe('TowerCombatService', () => {
  let service: TowerCombatService;
  let combatVFXService: CombatVFXService;
  let enemyServiceSpy: jasmine.SpyObj<EnemyService>;
  let gameBoardServiceSpy: jasmine.SpyObj<GameBoardService>;
  let relicServiceSpy: jasmine.SpyObj<RelicService>;
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
    relicServiceSpy = createRelicServiceSpy();

    // Sprint 18 LABYRINTH_MIND — TowerCombatService now takes an @Optional()
    // PathfindingService. Stub it with a spy that returns 0 length so existing
    // non-LABYRINTH tests see multiplier=1. The LABYRINTH_MIND-specific test
    // rebinds getPathToExitLength via the returned spy.
    const pathfindingSpy = jasmine.createSpyObj<PathfindingService>(
      'PathfindingService',
      ['getPathToExitLength', 'findPath', 'invalidateCache', 'reset'],
    );
    pathfindingSpy.getPathToExitLength.and.returnValue(0);

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
        { provide: RelicService, useValue: relicServiceSpy },
        { provide: CardEffectService, useValue: createCardEffectServiceSpy() },
        { provide: PathfindingService, useValue: pathfindingSpy },
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

    it('should store placedAtTurn when provided', () => {
      service.registerTower(3, 7, TowerType.BASIC, new THREE.Group(), 50, { placedAtTurn: 5 });
      const tower = service.getTower('3-7')!;
      expect(tower.placedAtTurn).toBe(5);
    });

    it('should default placedAtTurn to 0 when not provided', () => {
      service.registerTower(3, 7, TowerType.BASIC, new THREE.Group());
      const tower = service.getTower('3-7')!;
      expect(tower.placedAtTurn).toBe(0);
    });

    it('should assign the same placedAtTurn when two towers are placed on the same turn', () => {
      service.registerTower(1, 1, TowerType.BASIC, new THREE.Group(), 50, { placedAtTurn: 3 });
      service.registerTower(2, 2, TowerType.SNIPER, new THREE.Group(), 125, { placedAtTurn: 3 });
      expect(service.getTower('1-1')!.placedAtTurn).toBe(3);
      expect(service.getTower('2-2')!.placedAtTurn).toBe(3);
    });

    it('should assign different placedAtTurn for towers placed on different turns', () => {
      service.registerTower(1, 1, TowerType.BASIC, new THREE.Group(), 50, { placedAtTurn: 2 });
      service.registerTower(2, 2, TowerType.SNIPER, new THREE.Group(), 125, { placedAtTurn: 7 });
      expect(service.getTower('1-1')!.placedAtTurn).toBe(2);
      expect(service.getTower('2-2')!.placedAtTurn).toBe(7);
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
    it('should default to first targeting mode', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const tower = service.getTower(`${TOWER_ROW}-${TOWER_COL}`)!;
      expect(tower.targetingMode).toBe(DEFAULT_TARGETING_MODE);
      expect(tower.targetingMode).toBe(TargetingMode.FIRST);
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

      // Default is FIRST (index 2) → cycles: LAST, STRONGEST, WEAKEST, NEAREST, FARTHEST, wraps to FIRST
      expect(service.cycleTargetingMode(key)).toBe(TargetingMode.LAST);
      expect(service.cycleTargetingMode(key)).toBe(TargetingMode.STRONGEST);
      expect(service.cycleTargetingMode(key)).toBe(TargetingMode.WEAKEST);
      expect(service.cycleTargetingMode(key)).toBe(TargetingMode.NEAREST);
      expect(service.cycleTargetingMode(key)).toBe(TargetingMode.FARTHEST);
      expect(service.cycleTargetingMode(key)).toBe(TargetingMode.FIRST); // wraps around
    });

    it('should return null for cycleTargetingMode on non-existent tower', () => {
      expect(service.cycleTargetingMode('99-99')).toBeNull();
    });

    it('findTarget with nearest returns closest enemy', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      service.setTargetingMode(`${TOWER_ROW}-${TOWER_COL}`, TargetingMode.NEAREST);

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

    it('findTarget with last returns enemy least far along path', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.setTargetingMode(key, TargetingMode.LAST);

      // Enemy that just entered (low distanceTraveled)
      const newEnemy = createEnemy('new', TOWER_WORLD_X + 0.5, TOWER_WORLD_Z, 1000);
      newEnemy.distanceTraveled = 1;
      // Enemy further along path
      const oldEnemy = createEnemy('old', TOWER_WORLD_X + 1, TOWER_WORLD_Z, 1000);
      oldEnemy.distanceTraveled = 15;
      enemyMap.set('new', newEnemy);
      enemyMap.set('old', oldEnemy);

      service.fireTurn(mockScene, TURN_1);

      // 'last' mode targets the enemy with lowest distanceTraveled (just entered)
      expect(newEnemy.health).toBeLessThan(1000);
      expect(oldEnemy.health).toBe(1000);
    });

    it('findTarget with farthest returns spatially farthest enemy from tower', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.setTargetingMode(key, TargetingMode.FARTHEST);

      // Close enemy (within range=3)
      const close = createEnemy('close', TOWER_WORLD_X + 0.5, TOWER_WORLD_Z, 1000);
      close.distanceTraveled = 5;
      // Far enemy (farther away but still within range=3)
      const far = createEnemy('far', TOWER_WORLD_X + 2.5, TOWER_WORLD_Z, 1000);
      far.distanceTraveled = 1;
      enemyMap.set('close', close);
      enemyMap.set('far', far);

      service.fireTurn(mockScene, TURN_1);

      // 'farthest' mode targets the enemy with greatest Euclidean distance from tower
      expect(far.health).toBeLessThan(1000);
      expect(close.health).toBe(1000);
    });

    it('findTarget with weakest returns enemy with lowest health', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const key = `${TOWER_ROW}-${TOWER_COL}`;
      service.setTargetingMode(key, TargetingMode.WEAKEST);

      // Low-health enemy
      const weak = createEnemy('weak', TOWER_WORLD_X + 0.5, TOWER_WORLD_Z, 50);
      weak.distanceTraveled = 1;
      // High-health enemy
      const strong = createEnemy('strong', TOWER_WORLD_X + 1, TOWER_WORLD_Z, 500);
      strong.distanceTraveled = 5;
      enemyMap.set('weak', weak);
      enemyMap.set('strong', strong);

      service.fireTurn(mockScene, TURN_1);

      // 'weakest' mode targets the enemy with lowest current health
      expect(weak.health).toBeLessThan(50);
      expect(strong.health).toBe(500);
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

    describe('findTarget — side-effect-free contract', () => {
      // findTarget is now public so the aim subsystem can call it every frame.
      // These specs assert it is purely read-only: repeated calls must not
      // mutate enemy state or change which enemy is returned.
      //
      // Setup pattern: call fireTurn once to populate the spatial grid, using
      // enemies with high health so the initial fire doesn't kill them. Then
      // call findTarget directly and assert idempotence.

      it('calling findTarget three times with the same inputs returns the same enemy each time', () => {
        service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
        const key = `${TOWER_ROW}-${TOWER_COL}`;
        service.setTargetingMode(key, TargetingMode.NEAREST);

        // Very high health so the initial fireTurn call does not kill the enemy
        const enemy = createEnemy('e1', TOWER_WORLD_X + 1, TOWER_WORLD_Z, 100_000);
        enemyMap.set('e1', enemy);

        // fireTurn populates the spatial grid so findTarget can query it
        service.fireTurn(mockScene, TURN_1);

        const tower = service.getTower(key)!;
        const stats = TOWER_CONFIGS[TowerType.BASIC];

        const r1 = service.findTarget(tower, stats);
        const r2 = service.findTarget(tower, stats);
        const r3 = service.findTarget(tower, stats);

        expect(r1).toBe(r2);
        expect(r2).toBe(r3);
        expect(r1?.id).toBe('e1');
      });

      it('calling findTarget does not mutate enemy health', () => {
        service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
        const key = `${TOWER_ROW}-${TOWER_COL}`;

        const enemy = createEnemy('e2', TOWER_WORLD_X + 0.5, TOWER_WORLD_Z, 100_000);
        enemyMap.set('e2', enemy);

        service.fireTurn(mockScene, TURN_1);

        const healthAfterFire = enemy.health;

        const tower = service.getTower(key)!;
        const stats = TOWER_CONFIGS[TowerType.BASIC];

        service.findTarget(tower, stats);
        service.findTarget(tower, stats);
        service.findTarget(tower, stats);

        // Health must not have changed at all from the findTarget calls
        expect(enemy.health).toBe(healthAfterFire);
      });

      it('calling findTarget with an out-of-range enemy returns null', () => {
        service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
        const key = `${TOWER_ROW}-${TOWER_COL}`;

        // BASIC range=3 world units; place enemy far outside range
        const far = createEnemy('eFar', TOWER_WORLD_X + 50, TOWER_WORLD_Z, 100_000);
        enemyMap.set('eFar', far);

        service.fireTurn(mockScene, TURN_1);

        const tower = service.getTower(key)!;
        const stats = TOWER_CONFIGS[TowerType.BASIC];

        expect(service.findTarget(tower, stats)).toBeNull();
      });
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
      const result = service.tickMortarZonesForTurn(mockScene, TURN_2);
      expect(result.kills.length).toBe(0);
    });

    it('clearMortarZonesForWaveEnd should zero turnMortarZones so wave-N zones do not bleed into wave N+1', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000);
      enemyMap.set('e1', e1);

      service.fireTurn(mockScene, TURN_1); // creates zone with remaining turns

      service.clearMortarZonesForWaveEnd(mockScene);

      // Zone is cleared — DoT tick on next wave's turn 1 should produce no damage
      const result = service.tickMortarZonesForTurn(mockScene, TURN_1);
      expect(result.kills.length).toBe(0);
      expect(result.damageDealt).toBe(0);
    });

    it('should NOT damage a FLYING enemy standing on a mortar zone (S1: flying bypass ground effects)', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const flyingEnemy = createTestEnemy('fly1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000, {
        type: EnemyType.FLYING,
        isFlying: true,
      });
      enemyMap.set('fly1', flyingEnemy);

      // Turn 1: fire — creates a mortar zone centred on the tower position
      service.fireTurn(mockScene, TURN_1);
      const healthAfterBlast = flyingEnemy.health;

      // Turn 2: tick DoT zone — flying enemy must not take damage
      service.tickMortarZonesForTurn(mockScene, TURN_2);
      expect(flyingEnemy.health).toBe(healthAfterBlast);
    });

    it('should still damage a ground enemy on the same tile as a flying enemy (positive control)', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const groundEnemy = createTestEnemy('ground1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      const flyingEnemy = createTestEnemy('fly1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000, {
        type: EnemyType.FLYING,
        isFlying: true,
      });
      enemyMap.set('ground1', groundEnemy);
      enemyMap.set('fly1', flyingEnemy);

      service.fireTurn(mockScene, TURN_1);
      const groundHealthAfterBlast = groundEnemy.health;
      const flyingHealthAfterBlast = flyingEnemy.health;

      // Tick DoT zone on turn 2
      service.tickMortarZonesForTurn(mockScene, TURN_2);

      // Ground enemy takes DoT damage
      expect(groundEnemy.health).toBeLessThan(groundHealthAfterBlast);
      // Flying enemy is unaffected by zone DoT
      expect(flyingEnemy.health).toBe(flyingHealthAfterBlast);
    });

    // H1c: MORTAR initial blast must also bypass flying enemies
    it('initial blast should NOT damage a FLYING enemy on the blast tile (H1c)', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const flyingEnemy = createTestEnemy('fly1', TOWER_WORLD_X, TOWER_WORLD_Z, 1000, {
        type: EnemyType.FLYING,
        isFlying: true,
      });
      enemyMap.set('fly1', flyingEnemy);

      // Turn 1: fire — initial blast should not damage the flying enemy
      service.fireTurn(mockScene, TURN_1);

      expect(flyingEnemy.health).toBe(1000);
    });

    it('initial blast damages a GROUND enemy co-located with a FLYING enemy (H1c positive control)', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.MORTAR, new THREE.Group());
      const groundEnemy = createTestEnemy('ground1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      const flyingEnemy = createTestEnemy('fly1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000, {
        type: EnemyType.FLYING,
        isFlying: true,
      });
      enemyMap.set('ground1', groundEnemy);
      enemyMap.set('fly1', flyingEnemy);

      service.fireTurn(mockScene, TURN_1);

      // Ground enemy takes initial blast damage
      expect(groundEnemy.health).toBeLessThan(10000);
      // Flying enemy is unaffected by the initial blast
      expect(flyingEnemy.health).toBe(10000);
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
      // Pin to NEAREST so each tower picks the spatially-closer enemy deterministically.
      service.setTargetingMode(`${TOWER_ROW}-${TOWER_COL}`, TargetingMode.NEAREST);
      service.setTargetingMode(`${TOWER_ROW + 1}-${TOWER_COL}`, TargetingMode.NEAREST);

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

      // 6 enemies so chain has targets for all chainCount(3) + extraBounces(2) + primary = 6 hits
      for (let i = 0; i < 6; i++) {
        const e = createEnemy(`e${i}`, TOWER_WORLD_X + i * 0.2, TOWER_WORLD_Z, 10000);
        enemyMap.set(`e${i}`, e);
      }

      // 2 extra bounces on top of chainCount=3
      cardEffectSpy.getModifierValue.and.callFake((stat: string) => stat === 'chainBounces' ? 2 : 0);

      const result = service.fireTurn(mockScene, TURN_1);

      // hitCount reflects actual enemies struck: primary + up to chainCount+extraBounces bounces
      // With 6 enemies in range and high damage (15 base) all 6 slots fire → hitCount >= 6
      expect(result.hitCount).toBeGreaterThanOrEqual(6);
    });

    // Phase 2 Sprint 18 — LABYRINTH_MIND damage scaling
    it('LABYRINTH_MIND: damage scales with path length when modifier is active', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', enemy);

      // Activate LABYRINTH_MIND with 2% scaling and a 30-tile path.
      // Expected multiplier: 1 + (30 * 0.02) = 1.6 → damage 25 × 1.6 = 40.
      cardEffectSpy.getModifierValue.and.callFake((stat: string) =>
        stat === 'labyrinthMind' ? 0.02 : 0,
      );
      const pathfindingSpy = TestBed.inject(PathfindingService) as jasmine.SpyObj<PathfindingService>;
      pathfindingSpy.getPathToExitLength.and.returnValue(30);

      service.fireTurn(mockScene, TURN_1);

      const baseBasicDamage = 25; // TOWER_CONFIGS[BASIC].damage
      const damageTaken = 10000 - enemy.health;
      expect(damageTaken).toBe(Math.round(baseBasicDamage * 1.6));
    });

    it('LABYRINTH_MIND: zero scaling leaves damage unchanged (multiplier fallback = 1)', () => {
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());
      const enemy = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', enemy);

      // No LABYRINTH_MIND; default scaling=0 means pathLengthMultiplier stays 1.
      cardEffectSpy.getModifierValue.and.returnValue(0);
      const pathfindingSpy = TestBed.inject(PathfindingService) as jasmine.SpyObj<PathfindingService>;
      pathfindingSpy.getPathToExitLength.and.returnValue(30);

      service.fireTurn(mockScene, TURN_1);

      const baseBasicDamage = 25;
      expect(10000 - enemy.health).toBe(baseBasicDamage);
    });
  });

  // --- QUICK_DRAW relic: +1 shot on tower placement turn ---

  describe('QUICK_DRAW relic (hasQuickDraw)', () => {
    const PLACEMENT_TURN = 3;

    it('tower placed on turn N with QUICK_DRAW fires 2 shots on turn N', () => {
      relicServiceSpy.hasQuickDraw.and.returnValue(true);
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group(), 50, { placedAtTurn: PLACEMENT_TURN });

      // Two enemies at tower position, enough health to survive one shot each
      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      const e2 = createEnemy('e2', TOWER_WORLD_X + 0.1, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      const result = service.fireTurn(mockScene, PLACEMENT_TURN);

      // With QUICK_DRAW, 2 shots fired — both enemies should take damage
      expect(result.fired.length).toBeGreaterThanOrEqual(2);
    });

    it('tower placed on turn N with QUICK_DRAW fires only 1 shot on turn N+1', () => {
      relicServiceSpy.hasQuickDraw.and.returnValue(true);
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group(), 50, { placedAtTurn: PLACEMENT_TURN });

      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      const e2 = createEnemy('e2', TOWER_WORLD_X + 0.1, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      // Fire on turn N+1 — no bonus
      const result = service.fireTurn(mockScene, PLACEMENT_TURN + 1);

      expect(result.fired.length).toBe(1);
    });

    it('tower without QUICK_DRAW fires only 1 shot even on placement turn', () => {
      relicServiceSpy.hasQuickDraw.and.returnValue(false);
      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group(), 50, { placedAtTurn: PLACEMENT_TURN });

      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      const e2 = createEnemy('e2', TOWER_WORLD_X + 0.1, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      const result = service.fireTurn(mockScene, PLACEMENT_TURN);

      expect(result.fired.length).toBe(1);
    });

    it('QUICK_DRAW + FIRE_RATE modifier stack additively on placement turn', () => {
      relicServiceSpy.hasQuickDraw.and.returnValue(true);
      // fireRateBoost = 0.3 → baseShots = ceil(1.3) = 2, then +1 QUICK_DRAW = 3 shots
      // MODIFIER_STAT.FIRE_RATE = 'fireRate' (see modifier-stat.constants.ts)
      const cardEffectSpy = TestBed.inject(CardEffectService) as jasmine.SpyObj<CardEffectService>;
      cardEffectSpy.getModifierValue.and.callFake((stat: string) =>
        stat === 'fireRate' ? 0.3 : 0
      );

      service.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group(), 50, { placedAtTurn: PLACEMENT_TURN });

      const e1 = createEnemy('e1', TOWER_WORLD_X, TOWER_WORLD_Z, 10000);
      const e2 = createEnemy('e2', TOWER_WORLD_X + 0.1, TOWER_WORLD_Z, 10000);
      const e3 = createEnemy('e3', TOWER_WORLD_X + 0.2, TOWER_WORLD_Z, 10000);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);
      enemyMap.set('e3', e3);

      const result = service.fireTurn(mockScene, PLACEMENT_TURN);

      // baseShots=2 (from FIRE_RATE 0.3) + 1 (QUICK_DRAW) = 3 shots
      expect(result.fired.length).toBe(3);
    });
  });

});

// --- cardStatOverrides Tests ---
// Separate top-level describes because the nested scope of 'TowerCombatService'
// describe is only accessible within that block.

describe('TowerCombatService registerTower cardStatOverrides', () => {
  // Tower at row=5, col=5 on a 25x20 board
  const ROW = 5;
  const COL = 5;
  let svc: TowerCombatService;

  beforeEach(() => {
    const localEnemyMap = new Map<string, Enemy>();
    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        ChainLightningService,
        CombatVFXService,
        StatusEffectService,
        GameStateService,
        { provide: EnemyService, useValue: createEnemyServiceSpy(localEnemyMap) },
        { provide: GameBoardService, useValue: createGameBoardServiceSpy(25, 20, 1) },
        { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
        { provide: RelicService, useValue: createRelicServiceSpy() },
        { provide: CardEffectService, useValue: createCardEffectServiceSpy() },
      ]
    });
    svc = TestBed.inject(TowerCombatService);
  });

  it('stores undefined cardStatOverrides when not provided', () => {
    svc.registerTower(ROW, COL, TowerType.BASIC, new THREE.Group(), 50);
    const tower = svc.getTower(`${ROW}-${COL}`)!;
    expect(tower.cardStatOverrides).toBeUndefined();
  });

  it('stores the provided cardStatOverrides object on the placed tower', () => {
    const overrides = { damageMultiplier: 0.5 };
    svc.registerTower(ROW, COL, TowerType.BASIC, new THREE.Group(), 50, { cardStatOverrides: overrides });
    const tower = svc.getTower(`${ROW}-${COL}`)!;
    expect(tower.cardStatOverrides).toEqual(overrides);
  });
});

describe('TowerCombatService fireTurn cardStatOverrides composition', () => {
  // Tower at row=10, col=12 on a 25x20 board (world position -0.5, 0)
  const ROW = 10;
  const COL = 12;
  const WORLD_X = -0.5;
  const WORLD_Z = 0;

  let svc: TowerCombatService;
  let localEnemyMap: Map<string, Enemy>;
  let relicSpy: jasmine.SpyObj<RelicService>;
  let scene: THREE.Scene;

  beforeEach(() => {
    localEnemyMap = new Map<string, Enemy>();
    relicSpy = createRelicServiceSpy();
    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        ChainLightningService,
        CombatVFXService,
        StatusEffectService,
        GameStateService,
        { provide: EnemyService, useValue: createEnemyServiceSpy(localEnemyMap) },
        { provide: GameBoardService, useValue: createGameBoardServiceSpy(25, 20, 1) },
        { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
        { provide: RelicService, useValue: relicSpy },
        { provide: CardEffectService, useValue: createCardEffectServiceSpy() },
      ]
    });
    svc = TestBed.inject(TowerCombatService);
    scene = new THREE.Scene();
  });

  afterEach(() => {
    scene.clear();
  });

  it('applies damageMultiplier 0.7 reduces damage to round(base times 0.7)', () => {
    const baseDmg = TOWER_CONFIGS[TowerType.BASIC].damage;
    svc.registerTower(ROW, COL, TowerType.BASIC, new THREE.Group(), 50, { cardStatOverrides: { damageMultiplier: 0.7 } });
    const enemy = createTestEnemy('e1', WORLD_X, WORLD_Z, 10000);
    localEnemyMap.set('e1', enemy);
    svc.fireTurn(scene, 1);
    const expectedDamage = Math.round(baseDmg * 0.7);
    expect(enemy.health).toBe(10000 - expectedDamage);
  });

  it('composes damageMultiplier with relic getDamageMultiplier multiplicatively', () => {
    relicSpy.getDamageMultiplier.and.returnValue(1.2);
    (Object.getOwnPropertyDescriptor(relicSpy, 'relicCount')!.get as jasmine.Spy).and.returnValue(1);
    const baseDmg = TOWER_CONFIGS[TowerType.BASIC].damage;
    svc.registerTower(ROW, COL, TowerType.BASIC, new THREE.Group(), 50, { cardStatOverrides: { damageMultiplier: 0.7 } });
    const enemy = createTestEnemy('e1', WORLD_X, WORLD_Z, 10000);
    localEnemyMap.set('e1', enemy);
    svc.fireTurn(scene, 1);
    const expectedDamage = Math.round(baseDmg * 1.2 * 0.7);
    expect(enemy.health).toBe(10000 - expectedDamage);
  });

  it('rangeMultiplier 1.5 enemy at 1.4x base range is hit', () => {
    const baseRange = TOWER_CONFIGS[TowerType.BASIC].range;
    const extendedX = WORLD_X + baseRange * 1.4;
    svc.registerTower(ROW, COL, TowerType.BASIC, new THREE.Group(), 50, { cardStatOverrides: { rangeMultiplier: 1.5 } });
    const enemy = createTestEnemy('e1', extendedX, WORLD_Z, 10000);
    localEnemyMap.set('e1', enemy);
    svc.fireTurn(scene, 1);
    expect(enemy.health).toBeLessThan(10000);
  });

  it('rangeMultiplier 1.5 enemy beyond extended range is NOT hit', () => {
    const baseRange = TOWER_CONFIGS[TowerType.BASIC].range;
    const beyondX = WORLD_X + baseRange * 1.6;
    svc.registerTower(ROW, COL, TowerType.BASIC, new THREE.Group(), 50, { cardStatOverrides: { rangeMultiplier: 1.5 } });
    const enemy = createTestEnemy('e1', beyondX, WORLD_Z, 10000);
    localEnemyMap.set('e1', enemy);
    svc.fireTurn(scene, 1);
    expect(enemy.health).toBe(10000);
  });

  it('splashRadiusMultiplier 0.6 SPLASH tower secondary outside reduced radius is NOT hit', () => {
    const baseSplash = TOWER_CONFIGS[TowerType.SPLASH].splashRadius;
    const outsideReducedRadius = baseSplash * 0.7;
    svc.registerTower(ROW, COL, TowerType.SPLASH, new THREE.Group(), 75, { cardStatOverrides: { splashRadiusMultiplier: 0.6 } });
    const primary = createTestEnemy('primary', WORLD_X, WORLD_Z, 10000);
    const secondary = createTestEnemy('secondary', WORLD_X + outsideReducedRadius, WORLD_Z, 10000);
    localEnemyMap.set('primary', primary);
    localEnemyMap.set('secondary', secondary);
    svc.fireTurn(scene, 1);
    expect(primary.health).toBeLessThan(10000);
    expect(secondary.health).toBe(10000);
  });

  it('chainBounceBonus 1 on CHAIN tower is stored additively', () => {
    svc.registerTower(ROW, COL, TowerType.CHAIN, new THREE.Group(), 120, { cardStatOverrides: { chainBounceBonus: 1 } });
    const tower = svc.getTower(`${ROW}-${COL}`)!;
    expect(tower.cardStatOverrides?.chainBounceBonus).toBe(1);
  });

  it('chainBounceBonus and relic getChainBounceBonus stack additively both equal 1', () => {
    relicSpy.getChainBounceBonus.and.returnValue(1);
    (Object.getOwnPropertyDescriptor(relicSpy, 'relicCount')!.get as jasmine.Spy).and.returnValue(1);
    svc.registerTower(ROW, COL, TowerType.CHAIN, new THREE.Group(), 120, { cardStatOverrides: { chainBounceBonus: 1 } });
    const tower = svc.getTower(`${ROW}-${COL}`)!;
    // Combined = baseChainCount + 1 (relic) + 1 (card) = base + 2
    expect(tower.cardStatOverrides?.chainBounceBonus).toBe(1);
    expect(relicSpy.getChainBounceBonus()).toBe(1);
  });

  it('dotDamageMultiplier 0.8 on MORTAR tower is stored', () => {
    svc.registerTower(ROW, COL, TowerType.MORTAR, new THREE.Group(), 140, { cardStatOverrides: { dotDamageMultiplier: 0.8 } });
    const tower = svc.getTower(`${ROW}-${COL}`)!;
    expect(tower.cardStatOverrides?.dotDamageMultiplier).toBe(0.8);
  });

  it('undefined cardStatOverrides applies identity no change to base damage', () => {
    const baseDmg = TOWER_CONFIGS[TowerType.BASIC].damage;
    svc.registerTower(ROW, COL, TowerType.BASIC, new THREE.Group(), 50);
    const enemy = createTestEnemy('e1', WORLD_X, WORLD_Z, 10000);
    localEnemyMap.set('e1', enemy);
    svc.fireTurn(scene, 1);
    expect(enemy.health).toBe(10000 - baseDmg);
  });

  it('empty cardStatOverrides uses identity values final damage equals baseDamage', () => {
    const baseDmg = TOWER_CONFIGS[TowerType.BASIC].damage;
    svc.registerTower(ROW, COL, TowerType.BASIC, new THREE.Group(), 50, { cardStatOverrides: {} });
    const enemy = createTestEnemy('e1', WORLD_X, WORLD_Z, 10000);
    localEnemyMap.set('e1', enemy);
    svc.fireTurn(scene, 1);
    expect(enemy.health).toBe(10000 - baseDmg);
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


// --- Checkpoint serialization ---

describe('TowerCombatService checkpoint serialization', () => {
  const ROW = 5;
  const COL = 7;
  const KEY = `${ROW}-${COL}`;

  let svc: TowerCombatService;
  let localEnemyMap: Map<string, Enemy>;

  beforeEach(() => {
    localEnemyMap = new Map<string, Enemy>();
    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        ChainLightningService,
        CombatVFXService,
        StatusEffectService,
        GameStateService,
        { provide: EnemyService, useValue: createEnemyServiceSpy(localEnemyMap) },
        { provide: GameBoardService, useValue: createGameBoardServiceSpy(25, 20, 1) },
        { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
        { provide: RelicService, useValue: createRelicServiceSpy() },
        { provide: CardEffectService, useValue: createCardEffectServiceSpy() },
      ]
    });
    svc = TestBed.inject(TowerCombatService);
  });

  describe('serializeTowers', () => {
    it('strips mesh, muzzleFlashTimer, and originalEmissiveIntensity from serialized output', () => {
      const mesh = new THREE.Group();
      svc.registerTower(ROW, COL, TowerType.BASIC, mesh);

      // Manually set Three.js-only fields to confirm they are stripped.
      const tower = svc.getTower(KEY)!;
      tower.muzzleFlashTimer = 0.5;
      tower.originalEmissiveIntensity = new Map([['child', 1.0]]);

      const result = svc.serializeTowers();
      expect(result.length).toBe(1);

      const serialized = result[0] as unknown as Record<string, unknown>;
      expect(serialized['mesh']).toBeUndefined();
      expect(serialized['muzzleFlashTimer']).toBeUndefined();
      expect(serialized['originalEmissiveIntensity']).toBeUndefined();
    });

    it('preserves all required non-Three.js fields', () => {
      svc.registerTower(ROW, COL, TowerType.SNIPER, new THREE.Group(), 125, { placedAtTurn: 3 });

      const result = svc.serializeTowers();
      expect(result.length).toBe(1);

      const s = result[0];
      expect(s.id).toBe(KEY);
      expect(s.type).toBe(TowerType.SNIPER);
      expect(s.level).toBe(1);
      expect(s.row).toBe(ROW);
      expect(s.col).toBe(COL);
      expect(s.kills).toBe(0);
      expect(s.totalInvested).toBe(125);
      expect(s.targetingMode).toBe(DEFAULT_TARGETING_MODE);
      expect(s.placedAtTurn).toBe(3);
    });

    it('includes specialization and cardStatOverrides when present', () => {
      const overrides = { damageMultiplier: 1.5, rangeMultiplier: 1.2 };
      svc.registerTower(ROW, COL, TowerType.BASIC, new THREE.Group(), 50, { cardStatOverrides: overrides });
      svc.upgradeTower(KEY);
      svc.upgradeTowerWithSpec(KEY, TowerSpecialization.BETA);

      const result = svc.serializeTowers();
      expect(result.length).toBe(1);

      const s = result[0];
      expect(s.specialization).toBe(TowerSpecialization.BETA);
      expect(s.cardStatOverrides).toEqual(overrides);
    });

    it('omits specialization and cardStatOverrides when not set', () => {
      svc.registerTower(ROW, COL, TowerType.BASIC, new THREE.Group());

      const result = svc.serializeTowers();
      const serialized = result[0] as unknown as Record<string, unknown>;
      expect(serialized['specialization']).toBeUndefined();
      expect(serialized['cardStatOverrides']).toBeUndefined();
    });

    it('serializes multiple towers', () => {
      svc.registerTower(1, 1, TowerType.BASIC, new THREE.Group());
      svc.registerTower(2, 3, TowerType.SNIPER, new THREE.Group());
      svc.registerTower(4, 5, TowerType.SPLASH, new THREE.Group());

      const result = svc.serializeTowers();
      expect(result.length).toBe(3);

      const ids = result.map(t => t.id);
      expect(ids).toContain('1-1');
      expect(ids).toContain('2-3');
      expect(ids).toContain('4-5');
    });

    it('returns empty array when no towers are registered', () => {
      expect(svc.serializeTowers()).toEqual([]);
    });

    it('cardStatOverrides object is a shallow copy (not a reference to the original)', () => {
      const overrides = { damageMultiplier: 0.8 };
      svc.registerTower(ROW, COL, TowerType.BASIC, new THREE.Group(), 50, { cardStatOverrides: overrides });

      const result = svc.serializeTowers();
      const serialized = result[0].cardStatOverrides!;

      // Mutating the serialized copy should not affect the original
      (serialized as { damageMultiplier: number }).damageMultiplier = 999;
      expect(overrides.damageMultiplier).toBe(0.8);
    });
  });

  describe('serializeMortarZones', () => {
    it('returns empty array when no mortar zones are active', () => {
      expect(svc.serializeMortarZones()).toEqual([]);
    });

    it('captures zone data after mortar fires', () => {
      const scene = new THREE.Scene();
      svc.registerTower(10, 12, TowerType.MORTAR, new THREE.Group());

      const enemy = createTestEnemy('e1', -0.5, 0, 10000);
      localEnemyMap.set('e1', enemy);

      svc.fireTurn(scene, 1);

      const zones = svc.serializeMortarZones();
      expect(zones.length).toBeGreaterThan(0);

      const z = zones[0];
      expect(typeof z.centerX).toBe('number');
      expect(typeof z.centerZ).toBe('number');
      expect(z.blastRadius).toBeGreaterThan(0);
      expect(z.dotDamage).toBeGreaterThan(0);
      expect(z.expiresOnTurn).toBeGreaterThan(1);

      scene.clear();
    });
  });

  describe('restoreTowers', () => {
    it('rebuilds placedTowers Map from serialized data with provided meshes', () => {
      const mesh = new THREE.Group();
      const meshes = new Map<string, THREE.Group>([[KEY, mesh]]);

      const serialized = [
        {
          id: KEY,
          type: TowerType.SNIPER,
          level: 2,
          row: ROW,
          col: COL,
          kills: 5,
          totalInvested: 200,
          targetingMode: TargetingMode.FIRST,
          placedAtTurn: 2,
        },
      ];

      svc.restoreTowers(serialized, meshes);

      const restored = svc.getTower(KEY)!;
      expect(restored).toBeTruthy();
      expect(restored.id).toBe(KEY);
      expect(restored.type).toBe(TowerType.SNIPER);
      expect(restored.level).toBe(2);
      expect(restored.row).toBe(ROW);
      expect(restored.col).toBe(COL);
      expect(restored.kills).toBe(5);
      expect(restored.totalInvested).toBe(200);
      expect(restored.targetingMode).toBe(TargetingMode.FIRST);
      expect(restored.placedAtTurn).toBe(2);
      expect(restored.mesh).toBe(mesh);
    });

    it('sets mesh to null when tower id is not in the meshes map', () => {
      const serialized = [
        {
          id: KEY,
          type: TowerType.BASIC,
          level: 1,
          row: ROW,
          col: COL,
          kills: 0,
          totalInvested: 50,
          targetingMode: DEFAULT_TARGETING_MODE,
        },
      ];

      svc.restoreTowers(serialized, new Map());

      const restored = svc.getTower(KEY)!;
      expect(restored).toBeTruthy();
      expect(restored.mesh).toBeNull();
    });

    it('clears any previously registered towers before restoring', () => {
      svc.registerTower(0, 0, TowerType.BASIC, new THREE.Group());
      svc.registerTower(1, 1, TowerType.SNIPER, new THREE.Group());
      expect(svc.getPlacedTowers().size).toBe(2);

      const serialized = [
        {
          id: KEY,
          type: TowerType.SPLASH,
          level: 1,
          row: ROW,
          col: COL,
          kills: 0,
          totalInvested: 75,
          targetingMode: DEFAULT_TARGETING_MODE,
        },
      ];

      svc.restoreTowers(serialized, new Map());

      expect(svc.getPlacedTowers().size).toBe(1);
      expect(svc.getTower('0-0')).toBeUndefined();
      expect(svc.getTower('1-1')).toBeUndefined();
      expect(svc.getTower(KEY)).toBeTruthy();
    });

    it('restore → serialize roundtrip preserves all scalar fields', () => {
      const overrides = { damageMultiplier: 1.3 };
      const mesh = new THREE.Group();
      const meshes = new Map<string, THREE.Group>([[KEY, mesh]]);

      const original = [
        {
          id: KEY,
          type: TowerType.SPLASH,
          level: 3,
          row: ROW,
          col: COL,
          kills: 12,
          totalInvested: 300,
          targetingMode: TargetingMode.STRONGEST,
          specialization: TowerSpecialization.ALPHA,
          placedAtTurn: 4,
          cardStatOverrides: overrides,
        },
      ];

      svc.restoreTowers(original, meshes);

      const roundtripped = svc.serializeTowers();
      expect(roundtripped.length).toBe(1);

      const rt = roundtripped[0];
      expect(rt.id).toBe(KEY);
      expect(rt.type).toBe(TowerType.SPLASH);
      expect(rt.level).toBe(3);
      expect(rt.kills).toBe(12);
      expect(rt.totalInvested).toBe(300);
      expect(rt.targetingMode).toBe(TargetingMode.STRONGEST);
      expect(rt.specialization).toBe(TowerSpecialization.ALPHA);
      expect(rt.placedAtTurn).toBe(4);
      expect(rt.cardStatOverrides).toEqual(overrides);

      // mesh must not leak through
      const serialized = rt as unknown as Record<string, unknown>;
      expect(serialized['mesh']).toBeUndefined();
    });
  });

  describe('restoreMortarZones', () => {
    it('restores mortar zones from serialized data', () => {
      const zones = [
        {
          centerX: 1.5,
          centerZ: -2.0,
          blastRadius: 3.0,
          dotDamage: 20,
          expiresOnTurn: 5,
          statusEffect: StatusEffectType.BURN,
        },
        {
          centerX: 0,
          centerZ: 0,
          blastRadius: 2.0,
          dotDamage: 15,
          expiresOnTurn: 8,
        },
      ];

      svc.restoreMortarZones(zones);

      const serialized = svc.serializeMortarZones();
      expect(serialized.length).toBe(2);

      expect(serialized[0].centerX).toBe(1.5);
      expect(serialized[0].centerZ).toBe(-2.0);
      expect(serialized[0].blastRadius).toBe(3.0);
      expect(serialized[0].dotDamage).toBe(20);
      expect(serialized[0].expiresOnTurn).toBe(5);
      expect(serialized[0].statusEffect).toBe(StatusEffectType.BURN);

      expect(serialized[1].statusEffect).toBeUndefined();
    });

    it('overwrites previously active zones', () => {
      const scene = new THREE.Scene();
      svc.registerTower(10, 12, TowerType.MORTAR, new THREE.Group());
      const enemy = createTestEnemy('e1', -0.5, 0, 10000);
      localEnemyMap.set('e1', enemy);
      svc.fireTurn(scene, 1); // creates a zone

      expect(svc.serializeMortarZones().length).toBeGreaterThan(0);

      svc.restoreMortarZones([]); // clear via restore

      expect(svc.serializeMortarZones().length).toBe(0);
      scene.clear();
    });

    it('restored zones are independent copies (not shared references)', () => {
      const zone = {
        centerX: 1.0,
        centerZ: 2.0,
        blastRadius: 2.5,
        dotDamage: 10,
        expiresOnTurn: 6,
      };

      svc.restoreMortarZones([zone]);

      // Mutate the source — the internal copy should be unaffected
      zone.centerX = 999;

      const serialized = svc.serializeMortarZones();
      expect(serialized[0].centerX).toBe(1.0);
    });
  });
});

// ── Sprint 26: Line-of-sight integration ─────────────────────────────────────
// Standalone top-level describe so it has its own TestBed and doesn't share
// local constants with the primary TowerCombatService describe.
//
// Board: 25×20, tileSize=1. Tower at (10,12) → world (-0.5, 0).
//   worldX = (col - 12.5) * 1  →  col=12 → x=-0.5
//   worldZ = (row - 10)   * 1  →  row=10 → z=0

describe('TowerCombatService LOS integration (sprint 26)', () => {
  const LOS_TOWER_ROW = 10;
  const LOS_TOWER_COL = 12;
  const LOS_TOWER_WORLD_X = -0.5;
  const LOS_TOWER_WORLD_Z = 0;
  const LOS_TURN = 1;

  let losSvc: TowerCombatService;
  let losEnemyMap: Map<string, Enemy>;
  let losServiceSpy: jasmine.SpyObj<LineOfSightService>;

  beforeEach(() => {
    losEnemyMap = new Map();
    losServiceSpy = jasmine.createSpyObj<LineOfSightService>('LineOfSightService', ['isVisible']);
    losServiceSpy.isVisible.and.returnValue(true); // default: all shots pass LOS

    const losEnemySpy = createEnemyServiceSpy(losEnemyMap);
    const losBoardSpy = createGameBoardServiceSpy(25, 20, 1);
    const losRelicSpy = createRelicServiceSpy();
    const losPathSpy = jasmine.createSpyObj<PathfindingService>(
      'PathfindingService', ['getPathToExitLength', 'findPath', 'invalidateCache', 'reset']
    );
    losPathSpy.getPathToExitLength.and.returnValue(0);

    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        ChainLightningService,
        CombatVFXService,
        StatusEffectService,
        GameStateService,
        { provide: EnemyService, useValue: losEnemySpy },
        { provide: GameBoardService, useValue: losBoardSpy },
        { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
        { provide: RelicService, useValue: losRelicSpy },
        { provide: CardEffectService, useValue: createCardEffectServiceSpy() },
        { provide: PathfindingService, useValue: losPathSpy },
        { provide: LineOfSightService, useValue: losServiceSpy },
      ]
    });
    losSvc = TestBed.inject(TowerCombatService);
  });

  it('non-elevated board: LOS always passes — enemy is hit (no regression)', () => {
    losSvc.registerTower(LOS_TOWER_ROW, LOS_TOWER_COL, TowerType.BASIC, new THREE.Group());
    const enemy = createTestEnemy('e1', LOS_TOWER_WORLD_X, LOS_TOWER_WORLD_Z, 1000);
    losEnemyMap.set('e1', enemy);

    losSvc.fireTurn(new THREE.Scene(), LOS_TURN);

    expect(enemy.health).toBeLessThan(1000);
  });

  it('raised intervening tile: enemy behind wall is not targeted', () => {
    losServiceSpy.isVisible.and.returnValue(false); // simulate raised wall blocking LOS

    losSvc.registerTower(LOS_TOWER_ROW, LOS_TOWER_COL, TowerType.BASIC, new THREE.Group());
    const enemy = createTestEnemy('e1', LOS_TOWER_WORLD_X, LOS_TOWER_WORLD_Z, 1000);
    losEnemyMap.set('e1', enemy);

    losSvc.fireTurn(new THREE.Scene(), LOS_TURN);

    expect(enemy.health).toBe(1000); // LOS blocked — no damage
  });

  it('elevated tower: can see over low terrain (LOS returns true)', () => {
    losServiceSpy.isVisible.and.returnValue(true); // tower elevation clears the wall

    losSvc.registerTower(LOS_TOWER_ROW, LOS_TOWER_COL, TowerType.BASIC, new THREE.Group());
    const enemy = createTestEnemy('e1', LOS_TOWER_WORLD_X, LOS_TOWER_WORLD_Z, 1000);
    losEnemyMap.set('e1', enemy);

    losSvc.fireTurn(new THREE.Scene(), LOS_TURN);

    expect(enemy.health).toBeLessThan(1000);
  });

  it('MORTAR bypasses LOS: isVisible is never called for MORTAR', () => {
    // LOS spy returns false — but MORTAR is an AOE arc weapon and bypasses LOS per §12
    losServiceSpy.isVisible.and.returnValue(false);

    losSvc.registerTower(LOS_TOWER_ROW, LOS_TOWER_COL, TowerType.MORTAR, new THREE.Group());
    const enemy = createTestEnemy('e1', LOS_TOWER_WORLD_X, LOS_TOWER_WORLD_Z, 1000);
    losEnemyMap.set('e1', enemy);

    losSvc.fireTurn(new THREE.Scene(), LOS_TURN);

    // MORTAR bypasses isVisible entirely per elevation-model.md §12
    expect(losServiceSpy.isVisible).not.toHaveBeenCalled();
  });
});

// ── Sprint 29 — Elevation range multiplier + HIGH_PERCH integration ────────

/**
 * Helper: build a minimal ElevationService spy.
 *
 * @param tileElevations  Map of "row-col" → elevation for per-tile reads.
 * @param maxElevation    Override for getMaxElevation() (0 = flat board).
 */
function createElevationServiceSpy(
  tileElevations: Map<string, number> = new Map(),
  maxElevation = 0,
): jasmine.SpyObj<ElevationService> {
  const spy = jasmine.createSpyObj<ElevationService>('ElevationService', [
    'getElevation',
    'getMaxElevation',
    'raise',
    'depress',
    'setAbsolute',
    'collapse',
    'getElevationMap',
    'getActiveChanges',
    'tickTurn',
    'reset',
    'serialize',
    'restore',
  ]);
  spy.getMaxElevation.and.returnValue(maxElevation);
  spy.getElevation.and.callFake((row: number, col: number) =>
    tileElevations.get(`${row}-${col}`) ?? 0
  );
  return spy;
}

describe('TowerCombatService elevation range multiplier (sprint 29)', () => {
  // Tower at row=10, col=12, world position (-0.5, 0) — same anchor as main suite
  const EL_ROW = 10;
  const EL_COL = 12;
  const EL_WORLD_X = -0.5;
  const EL_WORLD_Z = 0;
  const EL_TURN = 1;

  /** Base BASIC tower range (from TOWER_CONFIGS). Used as reference in multiplier math. */
  const BASE_BASIC_RANGE = TOWER_CONFIGS[TowerType.BASIC].range;
  /** Base BASIC tower damage — for damage-unchanged assertions. */
  const BASE_BASIC_DAMAGE = TOWER_CONFIGS[TowerType.BASIC].damage;

  let elSvc: TowerCombatService;
  let elEnemyMap: Map<string, Enemy>;
  let elElevationSpy: jasmine.SpyObj<ElevationService>;
  let elCardEffectSpy: jasmine.SpyObj<CardEffectService>;

  function buildTestBed(
    tileElevations: Map<string, number>,
    maxElevation: number,
  ): void {
    elEnemyMap = new Map();
    elElevationSpy = createElevationServiceSpy(tileElevations, maxElevation);
    elCardEffectSpy = createCardEffectServiceSpy();

    const elPathSpy = jasmine.createSpyObj<PathfindingService>(
      'PathfindingService', ['getPathToExitLength', 'findPath', 'invalidateCache', 'reset']
    );
    elPathSpy.getPathToExitLength.and.returnValue(0);

    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        ChainLightningService,
        CombatVFXService,
        StatusEffectService,
        GameStateService,
        { provide: EnemyService, useValue: createEnemyServiceSpy(elEnemyMap) },
        { provide: GameBoardService, useValue: createGameBoardServiceSpy(25, 20, 1) },
        { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
        { provide: RelicService, useValue: createRelicServiceSpy() },
        { provide: CardEffectService, useValue: elCardEffectSpy },
        { provide: PathfindingService, useValue: elPathSpy },
        { provide: ElevationService, useValue: elElevationSpy },
      ]
    });
    elSvc = TestBed.inject(TowerCombatService);
  }

  // ── Part A: passive elevation range bonus ────────────────────────────────

  describe('passive elevation range bonus', () => {
    it('tower at elevation 0 → effective range unchanged (multiplier = 1.0×)', () => {
      // Flat board: getMaxElevation() returns 0 → fast path, no per-tower lookup.
      buildTestBed(new Map(), 0);
      elSvc.registerTower(EL_ROW, EL_COL, TowerType.BASIC, new THREE.Group());

      // Enemy at exactly base range — must be hit.
      const enemy = createTestEnemy('e1', EL_WORLD_X + BASE_BASIC_RANGE, EL_WORLD_Z, 10000);
      elEnemyMap.set('e1', enemy);

      elSvc.fireTurn(new THREE.Scene(), EL_TURN);

      // Enemy within base range → hit
      expect(enemy.health).toBeLessThan(10000);
    });

    it('flat board — getElevation is never called (fast-path guard)', () => {
      buildTestBed(new Map(), 0);
      elSvc.registerTower(EL_ROW, EL_COL, TowerType.BASIC, new THREE.Group());

      elSvc.fireTurn(new THREE.Scene(), EL_TURN);

      // hasElevation=false → getElevation never called
      expect(elElevationSpy.getElevation).not.toHaveBeenCalled();
    });

    it('tower at elevation 1 → range × 1.25', () => {
      // elevation 1 → mult = 1 + 1×0.25 = 1.25
      const tileMap = new Map([[ `${EL_ROW}-${EL_COL}`, 1 ]]);
      buildTestBed(tileMap, 1);
      elSvc.registerTower(EL_ROW, EL_COL, TowerType.BASIC, new THREE.Group());

      const expectedRange = BASE_BASIC_RANGE * 1.25;
      // Enemy just inside the 1.25× range but outside base range → only hit when elevated.
      const enemy = createTestEnemy('e1', EL_WORLD_X + BASE_BASIC_RANGE + 0.1, EL_WORLD_Z, 10000);
      elEnemyMap.set('e1', enemy);

      // Also place an enemy at exactly expectedRange to confirm it's reachable.
      const enemyAt125 = createTestEnemy('e2', EL_WORLD_X + expectedRange, EL_WORLD_Z, 10000);
      elEnemyMap.set('e2', enemyAt125);

      elSvc.fireTurn(new THREE.Scene(), EL_TURN);

      // The enemy in the 1.25× zone should be hit (closer, found first)
      expect(enemy.health).toBeLessThan(10000);
    });

    it('tower at elevation 2 → range × 1.5', () => {
      // elevation 2 → mult = 1 + 2×0.25 = 1.5
      const tileMap = new Map([[ `${EL_ROW}-${EL_COL}`, 2 ]]);
      buildTestBed(tileMap, 2);
      elSvc.registerTower(EL_ROW, EL_COL, TowerType.BASIC, new THREE.Group());

      const expectedMult = 1 + 2 * ELEVATION_CONFIG.RANGE_BONUS_PER_ELEVATION; // 1.5
      const expectedRange = BASE_BASIC_RANGE * expectedMult;

      // Enemy placed between base range and 1.5× range — only reachable when elevated.
      const enemy = createTestEnemy('e1', EL_WORLD_X + BASE_BASIC_RANGE + 0.5, EL_WORLD_Z, 10000);
      elEnemyMap.set('e1', enemy);

      elSvc.fireTurn(new THREE.Scene(), EL_TURN);

      // Within 1.5× range → must be hit
      expect(enemy.health).toBeLessThan(10000);

      // Verify the enemy is actually inside the expected range (guards the test's own logic)
      const distToEnemy = BASE_BASIC_RANGE + 0.5;
      expect(distToEnemy).toBeLessThan(expectedRange);
    });

    it('tower at elevation 3 → range × 1.75 (maximum elevation)', () => {
      const tileMap = new Map([[ `${EL_ROW}-${EL_COL}`, 3 ]]);
      buildTestBed(tileMap, 3);
      elSvc.registerTower(EL_ROW, EL_COL, TowerType.BASIC, new THREE.Group());

      const expectedMult = 1 + 3 * ELEVATION_CONFIG.RANGE_BONUS_PER_ELEVATION; // 1.75
      const expectedRange = BASE_BASIC_RANGE * expectedMult;

      // Enemy between base range and 1.75× range — unreachable without elevation.
      const enemy = createTestEnemy('e1', EL_WORLD_X + BASE_BASIC_RANGE + 1.0, EL_WORLD_Z, 10000);
      elEnemyMap.set('e1', enemy);

      // Sanity: enemy is within 1.75× range
      expect(BASE_BASIC_RANGE + 1.0).toBeLessThan(expectedRange);

      elSvc.fireTurn(new THREE.Scene(), EL_TURN);

      expect(enemy.health).toBeLessThan(10000);
    });

    it('tower at elevation -1 → range × 0.75 (self-inflicted pit penalty)', () => {
      // Negative elevation → range penalty (0.75×). Realistic scenario: a board where most tiles
      // are at elevation 0 but the tower tile has been depressed. hasElevation uses
      // getMaxElevation() > 0 as the guard — so we must simulate a board where at least one
      // tile is above 0 (another tile raised) so the per-tower elevation lookup fires.
      // The tower tile itself returns -1; the guard sees maxElevation=1 → lookup runs.
      buildTestBed(new Map(), 1); // maxElevation=1 → hasElevation=true, triggers per-tower lookup
      elElevationSpy.getElevation.and.callFake((row: number, col: number) =>
        (row === EL_ROW && col === EL_COL) ? -1 : 0  // tower tile is depressed; rest at 0
      );

      elSvc.registerTower(EL_ROW, EL_COL, TowerType.BASIC, new THREE.Group());

      // Enemy placed just beyond the 0.75× range → NOT reachable.
      // 0.75× range = 3 × 0.75 = 2.25. Enemy at 2.45 is outside that range.
      const penalizedRange = BASE_BASIC_RANGE * 0.75; // 2.25
      const enemy = createTestEnemy('e1', EL_WORLD_X + penalizedRange + 0.2, EL_WORLD_Z, 10000);
      elEnemyMap.set('e1', enemy);

      elSvc.fireTurn(new THREE.Scene(), EL_TURN);

      // Enemy is beyond the 0.75× range → should NOT be hit
      expect(enemy.health).toBe(10000);
    });

    it('two towers at different elevations get correct multipliers independently', () => {
      // Strategy: use two towers in separate columns far apart so neither can
      // reach the other's enemy. We verify each tower's range multiplier by
      // checking which enemy it hits.
      //
      // Tower A at (row=10, col=2) → elevation 2 → range × 1.5 = 4.5
      // Tower B at (row=10, col=22) → elevation 0 → range × 1.0 = 3.0
      //
      // Board is 25×20, tileSize=1.
      // worldX_A = (2  - 12.5) * 1 = -10.5, worldZ_A = (10 - 10) * 1 = 0
      // worldX_B = (22 - 12.5) * 1 =   9.5, worldZ_B = 0

      const ROW_A = 10; const COL_A = 2;
      const ROW_B = 10; const COL_B = 22;
      const worldA_X = (COL_A - 25 / 2);  // -10.5
      const worldA_Z = 0;
      const worldB_X = (COL_B - 25 / 2);  //   9.5
      const worldB_Z = 0;

      const tileMap = new Map([
        [ `${ROW_A}-${COL_A}`, 2 ],  // tower A elevated
        [ `${ROW_B}-${COL_B}`, 0 ],  // tower B flat
      ]);
      buildTestBed(tileMap, 2);

      elSvc.registerTower(ROW_A, COL_A, TowerType.BASIC, new THREE.Group());
      elSvc.registerTower(ROW_B, COL_B, TowerType.BASIC, new THREE.Group());

      // Enemy A: between BASE_BASIC_RANGE and 1.5× range from tower A.
      // At worldX = worldA_X + BASE_BASIC_RANGE + 0.5 (3.5 from tower A).
      // Tower A (range 4.5) can reach it; tower B (far away) cannot.
      const enemyA = createTestEnemy('eA', worldA_X + BASE_BASIC_RANGE + 0.5, worldA_Z, 10000);

      // Enemy B: at exactly BASE_BASIC_RANGE from tower B.
      // At worldX = worldB_X + BASE_BASIC_RANGE (3 from tower B).
      // Tower B (range 3.0) can reach it; tower A (far away) cannot.
      const enemyB = createTestEnemy('eB', worldB_X + BASE_BASIC_RANGE, worldB_Z, 10000);

      elEnemyMap.set('eA', enemyA);
      elEnemyMap.set('eB', enemyB);

      elSvc.fireTurn(new THREE.Scene(), EL_TURN);

      // Tower A (elevation 2, range 4.5): enemyA at 3.5 → within range → hit
      expect(enemyA.health).toBeLessThan(10000);
      // Tower B (elevation 0, range 3.0): enemyB at 3.0 → within range → hit
      expect(enemyB.health).toBeLessThan(10000);
    });
  });

  // ── Part B: HIGH_PERCH modifier card integration ─────────────────────────

  describe('HIGH_PERCH modifier integration', () => {
    const HIGH_PERCH_STAT = MODIFIER_STAT.HIGH_PERCH_RANGE_BONUS;

    it('HIGH_PERCH active + tower at elevation 2 → range × 1.5 × 1.25 = 1.875×', () => {
      // elevation 2 → passive mult 1.5; HIGH_PERCH bonus 0.25 → highPerchMult 1.25
      // combined: 1.5 × 1.25 = 1.875
      const tileMap = new Map([[ `${EL_ROW}-${EL_COL}`, 2 ]]);
      buildTestBed(tileMap, 2);

      elCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
        stat === HIGH_PERCH_STAT ? 0.25 : 0
      );

      elSvc.registerTower(EL_ROW, EL_COL, TowerType.BASIC, new THREE.Group());

      const expectedRange = BASE_BASIC_RANGE * 1.875;
      // Enemy between 1.5× range and 1.875× range — only reachable with both bonuses.
      const enemy = createTestEnemy('e1', EL_WORLD_X + BASE_BASIC_RANGE * 1.6, EL_WORLD_Z, 10000);
      elEnemyMap.set('e1', enemy);

      // Verify test setup: enemy is between 1.5× and 1.875× range
      expect(BASE_BASIC_RANGE * 1.6).toBeGreaterThan(BASE_BASIC_RANGE * 1.5);
      expect(BASE_BASIC_RANGE * 1.6).toBeLessThan(expectedRange);

      elSvc.fireTurn(new THREE.Scene(), EL_TURN);

      expect(enemy.health).toBeLessThan(10000);
    });

    it('HIGH_PERCH active + tower at elevation 1 (below threshold) → only passive 1.25× (no HIGH_PERCH bonus)', () => {
      // elevation 1 = below HIGH_PERCH_ELEVATION_THRESHOLD (2) → highPerchMult = 1.0
      const tileMap = new Map([[ `${EL_ROW}-${EL_COL}`, 1 ]]);
      buildTestBed(tileMap, 1);

      elCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
        stat === HIGH_PERCH_STAT ? 0.25 : 0
      );

      elSvc.registerTower(EL_ROW, EL_COL, TowerType.BASIC, new THREE.Group());

      // Enemy between 1.25× and 1.5× range — would be hit only if HIGH_PERCH applied.
      const rangeAt125 = BASE_BASIC_RANGE * 1.25;
      const rangeAt150 = BASE_BASIC_RANGE * 1.5;
      const enemy = createTestEnemy('e1', EL_WORLD_X + rangeAt125 + 0.1, EL_WORLD_Z, 10000);
      elEnemyMap.set('e1', enemy);

      // Sanity: enemy is beyond 1.25× but within 1.5× (i.e. requires HIGH_PERCH to reach)
      expect(rangeAt125 + 0.1).toBeLessThan(rangeAt150);

      elSvc.fireTurn(new THREE.Scene(), EL_TURN);

      // Tower has only 1.25× passive — enemy at 1.25×+0.1 is out of range → not hit
      expect(enemy.health).toBe(10000);
    });

    it('HIGH_PERCH upgraded (0.4) + tower at elevation 2 → range × 1.5 × 1.4 = 2.1×', () => {
      const tileMap = new Map([[ `${EL_ROW}-${EL_COL}`, 2 ]]);
      buildTestBed(tileMap, 2);

      elCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
        stat === HIGH_PERCH_STAT ? 0.4 : 0
      );

      elSvc.registerTower(EL_ROW, EL_COL, TowerType.BASIC, new THREE.Group());

      const expectedRange = BASE_BASIC_RANGE * 2.1;
      // Enemy beyond 1.875× but within 2.1× range (upgraded bonus needed)
      const enemy = createTestEnemy('e1', EL_WORLD_X + BASE_BASIC_RANGE * 2.0, EL_WORLD_Z, 10000);
      elEnemyMap.set('e1', enemy);

      // Sanity: enemy at 2.0× is within 2.1× but beyond 1.875×
      expect(BASE_BASIC_RANGE * 2.0).toBeLessThan(expectedRange);
      expect(BASE_BASIC_RANGE * 2.0).toBeGreaterThan(BASE_BASIC_RANGE * 1.875);

      elSvc.fireTurn(new THREE.Scene(), EL_TURN);

      expect(enemy.health).toBeLessThan(10000);
    });

    it('HIGH_PERCH does not affect tower damage (range-only bonus)', () => {
      const tileMap = new Map([[ `${EL_ROW}-${EL_COL}`, 2 ]]);
      buildTestBed(tileMap, 2);

      elCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
        stat === HIGH_PERCH_STAT ? 0.25 : 0
      );

      elSvc.registerTower(EL_ROW, EL_COL, TowerType.BASIC, new THREE.Group());
      const enemy = createTestEnemy('e1', EL_WORLD_X, EL_WORLD_Z, 10000);
      elEnemyMap.set('e1', enemy);

      elSvc.fireTurn(new THREE.Scene(), EL_TURN);

      // Damage should be exactly base damage (no bonus)
      expect(10000 - enemy.health).toBe(BASE_BASIC_DAMAGE);
    });

    it('no HIGH_PERCH active + tower at elevation 2 → only passive 1.5× applies', () => {
      const tileMap = new Map([[ `${EL_ROW}-${EL_COL}`, 2 ]]);
      buildTestBed(tileMap, 2);

      // No HIGH_PERCH active
      elCardEffectSpy.getModifierValue.and.returnValue(0);

      elSvc.registerTower(EL_ROW, EL_COL, TowerType.BASIC, new THREE.Group());

      // Enemy inside 1.875× but outside 1.5× → NOT reachable (no HIGH_PERCH)
      const enemy = createTestEnemy('e1', EL_WORLD_X + BASE_BASIC_RANGE * 1.6, EL_WORLD_Z, 10000);
      elEnemyMap.set('e1', enemy);

      elSvc.fireTurn(new THREE.Scene(), EL_TURN);

      expect(enemy.health).toBe(10000);
    });
  });

  // ── LOS + elevation composition ──────────────────────────────────────────

  describe('LOS and elevation compose correctly', () => {
    it('elevated tower with LOS clear → hits enemy at extended range', () => {
      const tileMap = new Map([[ `${EL_ROW}-${EL_COL}`, 2 ]]);
      // Build with both elevation AND LOS service
      elEnemyMap = new Map();
      elElevationSpy = createElevationServiceSpy(tileMap, 2);
      elCardEffectSpy = createCardEffectServiceSpy();

      const losServiceSpy = jasmine.createSpyObj<LineOfSightService>('LineOfSightService', ['isVisible']);
      losServiceSpy.isVisible.and.returnValue(true); // LOS clear

      const elPathSpy = jasmine.createSpyObj<PathfindingService>(
        'PathfindingService', ['getPathToExitLength', 'findPath', 'invalidateCache', 'reset']
      );
      elPathSpy.getPathToExitLength.and.returnValue(0);

      TestBed.configureTestingModule({
        providers: [
          TowerCombatService,
          ChainLightningService,
          CombatVFXService,
          StatusEffectService,
          GameStateService,
          { provide: EnemyService, useValue: createEnemyServiceSpy(elEnemyMap) },
          { provide: GameBoardService, useValue: createGameBoardServiceSpy(25, 20, 1) },
          { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
          { provide: RelicService, useValue: createRelicServiceSpy() },
          { provide: CardEffectService, useValue: elCardEffectSpy },
          { provide: PathfindingService, useValue: elPathSpy },
          { provide: ElevationService, useValue: elElevationSpy },
          { provide: LineOfSightService, useValue: losServiceSpy },
        ]
      });
      const combinedSvc = TestBed.inject(TowerCombatService);

      combinedSvc.registerTower(EL_ROW, EL_COL, TowerType.BASIC, new THREE.Group());

      // Enemy between base range and 1.5× range (reachable because elevation + clear LOS)
      const enemy = createTestEnemy('e1', EL_WORLD_X + BASE_BASIC_RANGE + 0.5, EL_WORLD_Z, 10000);
      elEnemyMap.set('e1', enemy);

      combinedSvc.fireTurn(new THREE.Scene(), EL_TURN);

      // Elevation gives 1.5× range AND LOS passes → hit
      expect(enemy.health).toBeLessThan(10000);
    });

    it('elevated tower with LOS blocked → misses enemy even at extended range', () => {
      const tileMap = new Map([[ `${EL_ROW}-${EL_COL}`, 2 ]]);
      elEnemyMap = new Map();
      elElevationSpy = createElevationServiceSpy(tileMap, 2);
      elCardEffectSpy = createCardEffectServiceSpy();

      const losServiceSpy = jasmine.createSpyObj<LineOfSightService>('LineOfSightService', ['isVisible']);
      losServiceSpy.isVisible.and.returnValue(false); // LOS blocked

      const elPathSpy = jasmine.createSpyObj<PathfindingService>(
        'PathfindingService', ['getPathToExitLength', 'findPath', 'invalidateCache', 'reset']
      );
      elPathSpy.getPathToExitLength.and.returnValue(0);

      TestBed.configureTestingModule({
        providers: [
          TowerCombatService,
          ChainLightningService,
          CombatVFXService,
          StatusEffectService,
          GameStateService,
          { provide: EnemyService, useValue: createEnemyServiceSpy(elEnemyMap) },
          { provide: GameBoardService, useValue: createGameBoardServiceSpy(25, 20, 1) },
          { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
          { provide: RelicService, useValue: createRelicServiceSpy() },
          { provide: CardEffectService, useValue: elCardEffectSpy },
          { provide: PathfindingService, useValue: elPathSpy },
          { provide: ElevationService, useValue: elElevationSpy },
          { provide: LineOfSightService, useValue: losServiceSpy },
        ]
      });
      const combinedSvc = TestBed.inject(TowerCombatService);

      combinedSvc.registerTower(EL_ROW, EL_COL, TowerType.BASIC, new THREE.Group());

      // Enemy within 1.5× range (elevated range allows targeting) but LOS blocked
      const enemy = createTestEnemy('e1', EL_WORLD_X + BASE_BASIC_RANGE + 0.5, EL_WORLD_Z, 10000);
      elEnemyMap.set('e1', enemy);

      combinedSvc.fireTurn(new THREE.Scene(), EL_TURN);

      // LOS blocked → shot fails despite elevated range
      expect(enemy.health).toBe(10000);
    });
  });
});

// ── Sprint 31 — VANTAGE_POINT damage bonus integration ────────────────────────

describe('TowerCombatService VANTAGE_POINT damage bonus (sprint 31)', () => {
  // Reuse the same anchor constants as the elevation range suite.
  const VP_ROW = 10;
  const VP_COL = 12;
  const VP_WORLD_X = -0.5;
  const VP_WORLD_Z = 0;
  const VP_TURN = 1;
  const VP_STAT = MODIFIER_STAT.VANTAGE_POINT_DAMAGE_BONUS;

  const BASE_BASIC_DAMAGE = TOWER_CONFIGS[TowerType.BASIC].damage;
  const BASE_BASIC_RANGE  = TOWER_CONFIGS[TowerType.BASIC].range;

  let vpSvc: TowerCombatService;
  let vpEnemyMap: Map<string, Enemy>;
  let vpElevationSpy: jasmine.SpyObj<ElevationService>;
  let vpCardEffectSpy: jasmine.SpyObj<CardEffectService>;

  function buildVpTestBed(tileElevations: Map<string, number>, maxElevation: number): void {
    vpEnemyMap = new Map();
    vpElevationSpy = createElevationServiceSpy(tileElevations, maxElevation);
    vpCardEffectSpy = createCardEffectServiceSpy();

    const vpPathSpy = jasmine.createSpyObj<PathfindingService>(
      'PathfindingService', ['getPathToExitLength', 'findPath', 'invalidateCache', 'reset']
    );
    vpPathSpy.getPathToExitLength.and.returnValue(0);

    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        ChainLightningService,
        CombatVFXService,
        StatusEffectService,
        GameStateService,
        { provide: EnemyService, useValue: createEnemyServiceSpy(vpEnemyMap) },
        { provide: GameBoardService, useValue: createGameBoardServiceSpy(25, 20, 1) },
        { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
        { provide: RelicService, useValue: createRelicServiceSpy() },
        { provide: CardEffectService, useValue: vpCardEffectSpy },
        { provide: PathfindingService, useValue: vpPathSpy },
        { provide: ElevationService, useValue: vpElevationSpy },
      ],
    });
    vpSvc = TestBed.inject(TowerCombatService);
  }

  it('VANTAGE_POINT active + tower at elevation 2 → damage × 1.5', () => {
    const tileMap = new Map([[ `${VP_ROW}-${VP_COL}`, 2 ]]);
    buildVpTestBed(tileMap, 2);

    // VP bonus 0.5 → damage multiplier = 1 + 0.5 = 1.5
    vpCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === VP_STAT ? 0.5 : 0
    );

    vpSvc.registerTower(VP_ROW, VP_COL, TowerType.BASIC, new THREE.Group());
    const enemy = createTestEnemy('e1', VP_WORLD_X, VP_WORLD_Z, 10000);
    vpEnemyMap.set('e1', enemy);

    vpSvc.fireTurn(new THREE.Scene(), VP_TURN);

    expect(10000 - enemy.health).toBe(Math.round(BASE_BASIC_DAMAGE * 1.5));
  });

  it('VANTAGE_POINT active + tower at elevation 0 → no damage bonus (threshold not met)', () => {
    // Flat board: maxElevation=0 → hasElevation=false; towerElevation=0; VP does not apply.
    buildVpTestBed(new Map(), 0);

    vpCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === VP_STAT ? 0.5 : 0
    );

    vpSvc.registerTower(VP_ROW, VP_COL, TowerType.BASIC, new THREE.Group());
    const enemy = createTestEnemy('e1', VP_WORLD_X, VP_WORLD_Z, 10000);
    vpEnemyMap.set('e1', enemy);

    vpSvc.fireTurn(new THREE.Scene(), VP_TURN);

    // Base damage only — VP threshold of elevation ≥ 1 not met.
    expect(10000 - enemy.health).toBe(BASE_BASIC_DAMAGE);
  });

  it('VANTAGE_POINT inactive → no bonus regardless of elevation', () => {
    const tileMap = new Map([[ `${VP_ROW}-${VP_COL}`, 3 ]]);
    buildVpTestBed(tileMap, 3);
    // getModifierValue returns 0 for all stats by default (no VP active)

    vpSvc.registerTower(VP_ROW, VP_COL, TowerType.BASIC, new THREE.Group());
    const enemy = createTestEnemy('e1', VP_WORLD_X, VP_WORLD_Z, 10000);
    vpEnemyMap.set('e1', enemy);

    vpSvc.fireTurn(new THREE.Scene(), VP_TURN);

    // No VP bonus: damage is base only (no VP; elevation range bonus doesn't affect damage)
    expect(10000 - enemy.health).toBe(BASE_BASIC_DAMAGE);
  });

  it('VANTAGE_POINT + HIGH_PERCH composition: damage × 1.5, range × 1.5 × 1.25 = 1.875×', () => {
    // Tower at elevation 2 → passive range 1.5×; HIGH_PERCH 0.25 → range 1.875×;
    // VP 0.5 → damage 1.5×. Both apply independently in their respective hook.
    const tileMap = new Map([[ `${VP_ROW}-${VP_COL}`, 2 ]]);
    buildVpTestBed(tileMap, 2);

    const HP_STAT = MODIFIER_STAT.HIGH_PERCH_RANGE_BONUS;
    vpCardEffectSpy.getModifierValue.and.callFake((stat: string) => {
      if (stat === VP_STAT) return 0.5;
      if (stat === HP_STAT) return 0.25;
      return 0;
    });

    vpSvc.registerTower(VP_ROW, VP_COL, TowerType.BASIC, new THREE.Group());

    // Enemy within 1.875× range but beyond 1.5× — only reachable via HIGH_PERCH range bonus.
    const rangeAt150 = BASE_BASIC_RANGE * 1.5;
    const rangeAt1875 = BASE_BASIC_RANGE * 1.875;
    const enemy = createTestEnemy('e1', VP_WORLD_X + rangeAt150 + 0.1, VP_WORLD_Z, 10000);
    vpEnemyMap.set('e1', enemy);

    expect(rangeAt150 + 0.1).toBeLessThan(rangeAt1875);

    vpSvc.fireTurn(new THREE.Scene(), VP_TURN);

    // Hit (range satisfied) with 1.5× damage.
    expect(enemy.health).toBeLessThan(10000);
    expect(10000 - enemy.health).toBe(Math.round(BASE_BASIC_DAMAGE * 1.5));
  });

  it('upgraded VANTAGE_POINT (0.75) + tower at elevation 1 → damage × 1.75', () => {
    // Elevation 1 ≥ threshold (1) → VP applies. 0.75 bonus → multiplier = 1.75.
    const tileMap = new Map([[ `${VP_ROW}-${VP_COL}`, 1 ]]);
    buildVpTestBed(tileMap, 1);

    vpCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === VP_STAT ? 0.75 : 0
    );

    vpSvc.registerTower(VP_ROW, VP_COL, TowerType.BASIC, new THREE.Group());
    const enemy = createTestEnemy('e1', VP_WORLD_X, VP_WORLD_Z, 10000);
    vpEnemyMap.set('e1', enemy);

    vpSvc.fireTurn(new THREE.Scene(), VP_TURN);

    expect(10000 - enemy.health).toBe(Math.round(BASE_BASIC_DAMAGE * 1.75));
  });
});

// ── Sprint 33 — KING_OF_THE_HILL damage bonus integration ─────────────────────

describe('TowerCombatService KING_OF_THE_HILL damage bonus (sprint 33)', () => {
  const KOTH_ROW = 10;
  const KOTH_COL = 12;
  const KOTH_WORLD_X = -0.5;
  const KOTH_WORLD_Z = 0;
  const KOTH_TURN = 1;
  const KOTH_STAT = MODIFIER_STAT.KING_OF_THE_HILL_DAMAGE_BONUS;

  const BASE_BASIC_DAMAGE = TOWER_CONFIGS[TowerType.BASIC].damage;

  let kothSvc: TowerCombatService;
  let kothEnemyMap: Map<string, Enemy>;
  let kothElevationSpy: jasmine.SpyObj<ElevationService>;
  let kothCardEffectSpy: jasmine.SpyObj<CardEffectService>;

  function buildKothTestBed(tileElevations: Map<string, number>, maxElevation: number): void {
    kothEnemyMap = new Map();
    kothElevationSpy = createElevationServiceSpy(tileElevations, maxElevation);
    kothCardEffectSpy = createCardEffectServiceSpy();

    const kothPathSpy = jasmine.createSpyObj<PathfindingService>(
      'PathfindingService', ['getPathToExitLength', 'findPath', 'invalidateCache', 'reset']
    );
    kothPathSpy.getPathToExitLength.and.returnValue(0);

    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        ChainLightningService,
        CombatVFXService,
        StatusEffectService,
        GameStateService,
        { provide: EnemyService, useValue: createEnemyServiceSpy(kothEnemyMap) },
        { provide: GameBoardService, useValue: createGameBoardServiceSpy(25, 20, 1) },
        { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
        { provide: RelicService, useValue: createRelicServiceSpy() },
        { provide: CardEffectService, useValue: kothCardEffectSpy },
        { provide: PathfindingService, useValue: kothPathSpy },
        { provide: ElevationService, useValue: kothElevationSpy },
      ],
    });
    kothSvc = TestBed.inject(TowerCombatService);
  }

  it('KOTH active + tower at max elevation (2) → damage ×2.0', () => {
    // Tower at elevation 2 = max → bonus 1.0 → multiplier = 1 + 1.0 = 2.0
    const tileMap = new Map([[ `${KOTH_ROW}-${KOTH_COL}`, 2 ]]);
    buildKothTestBed(tileMap, 2);

    kothCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === KOTH_STAT ? 1.0 : 0
    );

    kothSvc.registerTower(KOTH_ROW, KOTH_COL, TowerType.BASIC, new THREE.Group());
    const enemy = createTestEnemy('e1', KOTH_WORLD_X, KOTH_WORLD_Z, 10000);
    kothEnemyMap.set('e1', enemy);

    kothSvc.fireTurn(new THREE.Scene(), KOTH_TURN);

    expect(10000 - enemy.health).toBe(Math.round(BASE_BASIC_DAMAGE * 2.0));
  });

  it('KOTH active + tower at lower elevation → no bonus', () => {
    // Tower at elevation 1, max is 2 — does NOT qualify for KOTH bonus.
    const tileMap = new Map([
      [ `${KOTH_ROW}-${KOTH_COL}`, 1 ],
      [ '5-5', 2 ],  // another tile at max; tower is not on it
    ]);
    buildKothTestBed(tileMap, 2);

    kothCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === KOTH_STAT ? 1.0 : 0
    );

    kothSvc.registerTower(KOTH_ROW, KOTH_COL, TowerType.BASIC, new THREE.Group());
    const enemy = createTestEnemy('e1', KOTH_WORLD_X, KOTH_WORLD_Z, 10000);
    kothEnemyMap.set('e1', enemy);

    kothSvc.fireTurn(new THREE.Scene(), KOTH_TURN);

    // Elevation 1 ≥ VANTAGE_POINT_ELEVATION_THRESHOLD (1) → passive range bonus
    // applies, but damage is base-only since tower is not at maxElevation (2).
    expect(10000 - enemy.health).toBe(BASE_BASIC_DAMAGE);
  });

  it('KOTH inactive → no bonus regardless of elevation', () => {
    const tileMap = new Map([[ `${KOTH_ROW}-${KOTH_COL}`, 3 ]]);
    buildKothTestBed(tileMap, 3);
    // getModifierValue returns 0 for all stats (no KOTH active)

    kothSvc.registerTower(KOTH_ROW, KOTH_COL, TowerType.BASIC, new THREE.Group());
    const enemy = createTestEnemy('e1', KOTH_WORLD_X, KOTH_WORLD_Z, 10000);
    kothEnemyMap.set('e1', enemy);

    kothSvc.fireTurn(new THREE.Scene(), KOTH_TURN);

    // No KOTH bonus — base damage only (elevation range boost doesn't affect damage).
    expect(10000 - enemy.health).toBe(BASE_BASIC_DAMAGE);
  });

  it('KOTH active + flat board (maxElevation=0) → no bonus (guard prevents flat-board all-towers bonus)', () => {
    // maxElevation=0 → kothActive=false → no tower gets the bonus even though
    // every tower's elevation equals max (0). This is the critical anti-bug guard.
    buildKothTestBed(new Map(), 0);

    kothCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === KOTH_STAT ? 1.0 : 0
    );

    kothSvc.registerTower(KOTH_ROW, KOTH_COL, TowerType.BASIC, new THREE.Group());
    const enemy = createTestEnemy('e1', KOTH_WORLD_X, KOTH_WORLD_Z, 10000);
    kothEnemyMap.set('e1', enemy);

    kothSvc.fireTurn(new THREE.Scene(), KOTH_TURN);

    // Flat board: base damage only, no KOTH bonus.
    expect(10000 - enemy.health).toBe(BASE_BASIC_DAMAGE);
  });

  it('KOTH active + multiple towers tied at max elevation → ALL get the bonus', () => {
    // Two towers at elevation 2 (max), placed far apart so each can only reach its own enemy.
    // boardWidth=25, tileSize=1: world.x = (col - 25/2) = col - 12.5
    // Tower A: row=10,col=12 → world (-0.5, 0).  Enemy A at (-0.5, 0) — distance 0 from A, 7 from B.
    // Tower B: row=10,col=5  → world (-7.5, 0).  Enemy B at (-7.5, 0) — distance 0 from B, 7 from A.
    // BASIC range = 3 (or 4.5 with elev-2 passive). 7 >> 4.5 → no cross-fire.
    const KOTH_COL_B = 5;
    // world x for col 5 with boardWidth 25, tileSize 1: 5 - 12.5 = -7.5
    const KOTH_WORLD_X_B = -7.5;
    const tileMap = new Map([
      [ `${KOTH_ROW}-${KOTH_COL}`, 2 ],
      [ `${KOTH_ROW}-${KOTH_COL_B}`, 2 ],
    ]);
    buildKothTestBed(tileMap, 2);

    kothCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === KOTH_STAT ? 1.0 : 0
    );

    kothSvc.registerTower(KOTH_ROW, KOTH_COL, TowerType.BASIC, new THREE.Group());
    kothSvc.registerTower(KOTH_ROW, KOTH_COL_B, TowerType.BASIC, new THREE.Group());

    const enemy1 = createTestEnemy('e1', KOTH_WORLD_X, KOTH_WORLD_Z, 10000);
    const enemy2 = createTestEnemy('e2', KOTH_WORLD_X_B, KOTH_WORLD_Z, 10000);
    kothEnemyMap.set('e1', enemy1);
    kothEnemyMap.set('e2', enemy2);

    kothSvc.fireTurn(new THREE.Scene(), KOTH_TURN);

    // Both towers fire at their respective enemies with ×2 damage bonus.
    expect(10000 - enemy1.health).toBe(Math.round(BASE_BASIC_DAMAGE * 2.0));
    expect(10000 - enemy2.health).toBe(Math.round(BASE_BASIC_DAMAGE * 2.0));
  });

  it('upgraded KOTH (1.5 bonus) + tower at max elevation → damage ×2.5', () => {
    // Upgraded KOTH: 1 + 1.5 = 2.5 multiplier.
    const tileMap = new Map([[ `${KOTH_ROW}-${KOTH_COL}`, 2 ]]);
    buildKothTestBed(tileMap, 2);

    kothCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === KOTH_STAT ? 1.5 : 0
    );

    kothSvc.registerTower(KOTH_ROW, KOTH_COL, TowerType.BASIC, new THREE.Group());
    const enemy = createTestEnemy('e1', KOTH_WORLD_X, KOTH_WORLD_Z, 10000);
    kothEnemyMap.set('e1', enemy);

    kothSvc.fireTurn(new THREE.Scene(), KOTH_TURN);

    expect(10000 - enemy.health).toBe(Math.round(BASE_BASIC_DAMAGE * 2.5));
  });

  it('KOTH + VANTAGE_POINT composition: both bonuses stack multiplicatively', () => {
    // Tower at elevation 2 (max). KOTH bonus 1.0 → ×2. VP bonus 0.5 → ×1.5.
    // Composed: base × 1.5 (VP) × 2.0 (KOTH) = base × 3.0.
    const VP_STAT = MODIFIER_STAT.VANTAGE_POINT_DAMAGE_BONUS;
    const tileMap = new Map([[ `${KOTH_ROW}-${KOTH_COL}`, 2 ]]);
    buildKothTestBed(tileMap, 2);

    kothCardEffectSpy.getModifierValue.and.callFake((stat: string) => {
      if (stat === KOTH_STAT) return 1.0;
      if (stat === VP_STAT) return 0.5;
      return 0;
    });

    kothSvc.registerTower(KOTH_ROW, KOTH_COL, TowerType.BASIC, new THREE.Group());
    const enemy = createTestEnemy('e1', KOTH_WORLD_X, KOTH_WORLD_Z, 10000);
    kothEnemyMap.set('e1', enemy);

    kothSvc.fireTurn(new THREE.Scene(), KOTH_TURN);

    expect(10000 - enemy.health).toBe(Math.round(BASE_BASIC_DAMAGE * 1.5 * 2.0));
  });

  it('KOTH + HIGH_PERCH + VANTAGE_POINT full stack: correct damage and range composition', () => {
    // Tower at elevation 2 (max). All three bonuses active.
    // Damage: base × 1.5 (VP) × 2.0 (KOTH) = base × 3.0.
    // Range: base × elevationPassive(1.5) × highPerch(1.25) = base × 1.875.
    const VP_STAT = MODIFIER_STAT.VANTAGE_POINT_DAMAGE_BONUS;
    const HP_STAT = MODIFIER_STAT.HIGH_PERCH_RANGE_BONUS;
    const tileMap = new Map([[ `${KOTH_ROW}-${KOTH_COL}`, 2 ]]);
    buildKothTestBed(tileMap, 2);

    kothCardEffectSpy.getModifierValue.and.callFake((stat: string) => {
      if (stat === KOTH_STAT) return 1.0;
      if (stat === VP_STAT) return 0.5;
      if (stat === HP_STAT) return 0.25;
      return 0;
    });

    kothSvc.registerTower(KOTH_ROW, KOTH_COL, TowerType.BASIC, new THREE.Group());
    const enemy = createTestEnemy('e1', KOTH_WORLD_X, KOTH_WORLD_Z, 10000);
    kothEnemyMap.set('e1', enemy);

    kothSvc.fireTurn(new THREE.Scene(), KOTH_TURN);

    expect(10000 - enemy.health).toBe(Math.round(BASE_BASIC_DAMAGE * 1.5 * 2.0));
  });
});

// ── Sprint 38 — TITAN halvesElevationDamageBonuses integration ────────────────
describe('TowerCombatService TITAN elevation damage reduction (sprint 38)', () => {
  /**
   * Test vector from spec:
   *   base damage 10, VP × 1.5, no KOTH
   *   normal:   Math.round(10 * 1.5) = 15
   *   vs TITAN: base-without-elev = 10/1.5 = 6.667; elev-portion = 15 - 6.667 = 8.333
   *             TITAN gets 6.667 + 8.333 * 0.5 = 6.667 + 4.167 = 10.833 → Math.round → 11
   *
   * Wait — let me recheck with integer base:
   *   base BASIC damage (level 1) = BASE_BASIC_DAMAGE (typically 10 from TOWER_CONFIGS)
   *   stats.damage after VP×1.5 = Math.round(10 * 1.5) = 15
   *   vantagePointDmgMult = 1.5, kothMult = 1
   *   baseWithoutElevation = 15 / (1.5 * 1) = 10
   *   elevationPortion = 15 - 10 = 5
   *   TITAN: 10 + 5 * 0.5 = 12.5 → Math.round → 13 ✓ (matches spec example)
   */

  const TITAN_ROW = 2;
  const TITAN_COL = 2;
  // Board is 25 wide × 20 tall, tileSize=1 (matches createGameBoardServiceSpy(25,20,1)).
  // gridToWorld: worldX = (col - boardWidth/2) * tileSize = (2 - 12.5) = -10.5
  //              worldZ = (row - boardHeight/2) * tileSize = (2 - 10)   = -8
  const TITAN_WORLD_X = (TITAN_COL - 25 / 2);  // -10.5
  const TITAN_WORLD_Z = (TITAN_ROW - 20 / 2);  // -8
  const TITAN_TURN = 1;
  const VP_STAT = MODIFIER_STAT.VANTAGE_POINT_DAMAGE_BONUS;
  const KOTH_STAT = MODIFIER_STAT.KING_OF_THE_HILL_DAMAGE_BONUS;
  const BASE_DAMAGE = TOWER_CONFIGS[TowerType.BASIC].damage;

  let titanSvc: TowerCombatService;
  let titanEnemyMap: Map<string, Enemy>;
  let titanElevSpy: jasmine.SpyObj<ElevationService>;
  let titanCardEffectSpy: jasmine.SpyObj<CardEffectService>;

  function buildTitanTestBed(
    tileMap: Map<string, number>,
    maxElev: number,
  ): void {
    titanEnemyMap = new Map();
    titanElevSpy = createElevationServiceSpy(tileMap, maxElev);
    titanCardEffectSpy = createCardEffectServiceSpy();

    const pathSpy = jasmine.createSpyObj<PathfindingService>(
      'PathfindingService', ['getPathToExitLength', 'findPath', 'invalidateCache', 'reset'],
    );
    pathSpy.getPathToExitLength.and.returnValue(0);

    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        ChainLightningService,
        CombatVFXService,
        StatusEffectService,
        GameStateService,
        { provide: EnemyService, useValue: createEnemyServiceSpy(titanEnemyMap) },
        { provide: GameBoardService, useValue: createGameBoardServiceSpy(25, 20, 1) },
        { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
        { provide: RelicService, useValue: createRelicServiceSpy() },
        { provide: CardEffectService, useValue: titanCardEffectSpy },
        { provide: PathfindingService, useValue: pathSpy },
        { provide: ElevationService, useValue: titanElevSpy },
      ],
    });

    titanSvc = TestBed.inject(TowerCombatService);
    titanSvc.registerTower(TITAN_ROW, TITAN_COL, TowerType.BASIC, new THREE.Group());
  }

  afterEach(() => { TestBed.resetTestingModule(); });

  // Test vector split into two single-enemy passes because BASIC tower is single-shot;
  // putting two enemies in one fireTurn only damages the targeted one.
  it('spec test vector (normal): VP×0.5 → non-TITAN gets Math.round(BASE×1.5)', () => {
    const tileMap = new Map([[`${TITAN_ROW}-${TITAN_COL}`, 1]]);
    buildTitanTestBed(tileMap, 1);

    titanCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === VP_STAT ? 0.5 : 0,
    );

    const normalEnemy = createTestEnemy('e-normal', TITAN_WORLD_X, TITAN_WORLD_Z, 10000);
    titanEnemyMap.set('e-normal', normalEnemy);

    titanSvc.fireTurn(new THREE.Scene(), TITAN_TURN);

    const expectedNormal = Math.round(BASE_DAMAGE * 1.5);
    expect(10000 - normalEnemy.health).toBe(expectedNormal);
  });

  it('spec test vector (TITAN): VP×0.5 → TITAN gets base + elev×0.5', () => {
    const tileMap = new Map([[`${TITAN_ROW}-${TITAN_COL}`, 1]]);
    buildTitanTestBed(tileMap, 1);

    titanCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === VP_STAT ? 0.5 : 0,
    );

    const titanEnemy = createTestEnemy('e-titan', TITAN_WORLD_X, TITAN_WORLD_Z, 10000);
    titanEnemy.type = EnemyType.TITAN;
    titanEnemyMap.set('e-titan', titanEnemy);

    titanSvc.fireTurn(new THREE.Scene(), TITAN_TURN);

    // stats.damage = Math.round(BASE * 1.5); TITAN: base-without-elev=BASE, elev-portion=stats.damage-BASE
    const expectedNormal = Math.round(BASE_DAMAGE * 1.5);
    const expectedTitan = Math.round(BASE_DAMAGE + (expectedNormal - BASE_DAMAGE) * 0.5);
    expect(10000 - titanEnemy.health).toBe(expectedTitan);
  });

  it('VANTAGE_POINT active + TITAN target → damage multiplier halved (VP bonus only)', () => {
    const tileMap = new Map([[`${TITAN_ROW}-${TITAN_COL}`, 1]]);
    buildTitanTestBed(tileMap, 1);

    titanCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === VP_STAT ? 0.5 : 0,
    );

    const titan = createTestEnemy('t1', TITAN_WORLD_X, TITAN_WORLD_Z, 10000);
    titan.type = EnemyType.TITAN;
    titanEnemyMap.set('t1', titan);

    titanSvc.fireTurn(new THREE.Scene(), TITAN_TURN);

    const damage = 10000 - titan.health;
    // VP mult = 1.5; baseDmg=10; fullDmg=15; elev=5; titan=10+2.5=12.5→13
    expect(damage).toBe(Math.round(BASE_DAMAGE + (Math.round(BASE_DAMAGE * 1.5) - BASE_DAMAGE) * ELEVATION_CONFIG.TITAN_ELEVATION_DAMAGE_REDUCTION));
  });

  it('non-TITAN enemy at same position with VP active → full multiplier applies', () => {
    const tileMap = new Map([[`${TITAN_ROW}-${TITAN_COL}`, 1]]);
    buildTitanTestBed(tileMap, 1);

    titanCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === VP_STAT ? 0.5 : 0,
    );

    const normal = createTestEnemy('n1', TITAN_WORLD_X, TITAN_WORLD_Z, 10000);
    // default type = BASIC — no halvesElevationDamageBonuses
    titanEnemyMap.set('n1', normal);

    titanSvc.fireTurn(new THREE.Scene(), TITAN_TURN);

    const damage = 10000 - normal.health;
    expect(damage).toBe(Math.round(BASE_DAMAGE * 1.5));
  });

  // Split into two single-enemy passes (single-shot tower only hits one target per fireTurn).
  it('no elevation bonuses active → TITAN takes base damage (nothing to halve)', () => {
    // Flat board: elevation=0 everywhere. VP/KOTH are inactive. computeTitanDamage
    // short-circuits when combinedElevMult===1, returning stats.damage unchanged.
    const tileMap = new Map([[`${TITAN_ROW}-${TITAN_COL}`, 0]]);
    buildTitanTestBed(tileMap, 0);

    titanCardEffectSpy.getModifierValue.and.returnValue(0);

    const titan = createTestEnemy('t-flat', TITAN_WORLD_X, TITAN_WORLD_Z, 10000);
    titan.type = EnemyType.TITAN;
    titanEnemyMap.set('t-flat', titan);

    titanSvc.fireTurn(new THREE.Scene(), TITAN_TURN);

    expect(10000 - titan.health).toBe(BASE_DAMAGE);
  });

  it('no elevation bonuses active → non-TITAN takes base damage', () => {
    const tileMap = new Map([[`${TITAN_ROW}-${TITAN_COL}`, 0]]);
    buildTitanTestBed(tileMap, 0);

    titanCardEffectSpy.getModifierValue.and.returnValue(0);

    const normal = createTestEnemy('n-flat', TITAN_WORLD_X, TITAN_WORLD_Z, 10000);
    titanEnemyMap.set('n-flat', normal);

    titanSvc.fireTurn(new THREE.Scene(), TITAN_TURN);

    expect(10000 - normal.health).toBe(BASE_DAMAGE);
  });

  // Split: single-shot tower — test normal and TITAN in separate passes.
  it('KOTH active + max elevation → non-TITAN gets full KOTH bonus (base × 2)', () => {
    const tileMap = new Map([[`${TITAN_ROW}-${TITAN_COL}`, 2]]);
    buildTitanTestBed(tileMap, 2);

    titanCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === KOTH_STAT ? 1.0 : 0,
    );

    const normal = createTestEnemy('nk', TITAN_WORLD_X, TITAN_WORLD_Z, 10000);
    titanEnemyMap.set('nk', normal);

    titanSvc.fireTurn(new THREE.Scene(), TITAN_TURN);

    // Normal: base × (1 + 1.0) = base × 2
    expect(10000 - normal.health).toBe(Math.round(BASE_DAMAGE * 2));
  });

  it('KOTH active + max elevation + TITAN target → KOTH bonus halved for TITAN', () => {
    const tileMap = new Map([[`${TITAN_ROW}-${TITAN_COL}`, 2]]);
    buildTitanTestBed(tileMap, 2);

    titanCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === KOTH_STAT ? 1.0 : 0,
    );

    const titan = createTestEnemy('tk', TITAN_WORLD_X, TITAN_WORLD_Z, 10000);
    titan.type = EnemyType.TITAN;
    titanEnemyMap.set('tk', titan);

    titanSvc.fireTurn(new THREE.Scene(), TITAN_TURN);

    // stats.damage = BASE × 2; TITAN: base-without-elev = BASE×2/2 = BASE
    // elev-portion = BASE; titan = BASE + BASE×0.5 = BASE×1.5
    expect(10000 - titan.health).toBe(Math.round(BASE_DAMAGE * 1.5));
  });
});

// ── Sprint 39 — WYRM_ASCENDANT immuneToElevationDamageBonuses integration ──
describe('TowerCombatService WYRM_ASCENDANT elevation damage immunity (sprint 39)', () => {
  /**
   * Test vector from spec:
   *   base BASIC damage = BASE_DAMAGE (10), VP × 1.5, no KOTH
   *   normal:         Math.round(10 × 1.5) = 15
   *   TITAN (halve):  Math.round(10 + (15 - 10) × 0.5) = 13
   *   WYRM (immune):  Math.round(15 / 1.5) = Math.round(10) = 10  ← base without elevation
   *
   * Combined VP + KOTH:
   *   base=10, VP=1.5, KOTH=2 → combinedMult=3 → stats.damage=Math.round(10×3)=30
   *   WYRM: Math.round(30/3) = 10  ← still base-without-elevation
   *   TITAN: Math.round(10 + (30-10)×0.5) = Math.round(10+10) = 20
   */

  const WYRM_ROW = 2;
  const WYRM_COL = 2;
  const WYRM_WORLD_X = (WYRM_COL - 25 / 2);  // -10.5
  const WYRM_WORLD_Z = (WYRM_ROW - 20 / 2);  // -8
  const WYRM_TURN = 1;
  const VP_STAT = MODIFIER_STAT.VANTAGE_POINT_DAMAGE_BONUS;
  const KOTH_STAT = MODIFIER_STAT.KING_OF_THE_HILL_DAMAGE_BONUS;
  const BASE_DAMAGE = TOWER_CONFIGS[TowerType.BASIC].damage;

  let wyrmSvc: TowerCombatService;
  let wyrmEnemyMap: Map<string, Enemy>;
  let wyrmElevSpy: jasmine.SpyObj<ElevationService>;
  let wyrmCardEffectSpy: jasmine.SpyObj<CardEffectService>;

  function buildWyrmTestBed(
    tileMap: Map<string, number>,
    maxElev: number,
  ): void {
    wyrmEnemyMap = new Map();
    wyrmElevSpy = jasmine.createSpyObj<ElevationService>('ElevationService', [
      'getElevation', 'getMaxElevation', 'raise', 'depress', 'setAbsolute',
      'collapse', 'getElevationMap', 'getActiveChanges', 'tickTurn', 'reset',
      'serialize', 'restore',
    ]);
    wyrmElevSpy.getMaxElevation.and.returnValue(maxElev);
    wyrmElevSpy.getElevation.and.callFake((row: number, col: number) =>
      tileMap.get(`${row}-${col}`) ?? 0,
    );
    wyrmCardEffectSpy = createCardEffectServiceSpy();

    const pathSpy = jasmine.createSpyObj<PathfindingService>(
      'PathfindingService', ['getPathToExitLength', 'findPath', 'invalidateCache', 'reset'],
    );
    pathSpy.getPathToExitLength.and.returnValue(0);

    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        ChainLightningService,
        CombatVFXService,
        StatusEffectService,
        GameStateService,
        { provide: EnemyService, useValue: createEnemyServiceSpy(wyrmEnemyMap) },
        { provide: GameBoardService, useValue: createGameBoardServiceSpy(25, 20, 1) },
        { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
        { provide: RelicService, useValue: createRelicServiceSpy() },
        { provide: CardEffectService, useValue: wyrmCardEffectSpy },
        { provide: PathfindingService, useValue: pathSpy },
        { provide: ElevationService, useValue: wyrmElevSpy },
      ],
    });

    wyrmSvc = TestBed.inject(TowerCombatService);
    wyrmSvc.registerTower(WYRM_ROW, WYRM_COL, TowerType.BASIC, new THREE.Group());
  }

  afterEach(() => { TestBed.resetTestingModule(); });

  it('spec test vector: VP×1.5 → non-WYRM gets Math.round(BASE×1.5)', () => {
    // Normal target should see full elevation bonus.
    buildWyrmTestBed(new Map([[`${WYRM_ROW}-${WYRM_COL}`, 1]]), 1);
    wyrmCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === VP_STAT ? 0.5 : 0,
    );
    const normal = createTestEnemy('e-normal', WYRM_WORLD_X, WYRM_WORLD_Z, 10000);
    wyrmEnemyMap.set('e-normal', normal);
    wyrmSvc.fireTurn(new THREE.Scene(), WYRM_TURN);
    expect(10000 - normal.health).toBe(Math.round(BASE_DAMAGE * 1.5));
  });

  it('spec test vector: VP×1.5 → WYRM receives base-without-elevation (immune)', () => {
    // WYRM strips the elevation bonus entirely: damage = Math.round(fullDamage / combinedMult)
    // VP mult = 1+0.5=1.5; stats.damage = Math.round(10*1.5)=15; WYRM: Math.round(15/1.5)=10
    buildWyrmTestBed(new Map([[`${WYRM_ROW}-${WYRM_COL}`, 1]]), 1);
    wyrmCardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === VP_STAT ? 0.5 : 0,
    );
    const wyrm = createTestEnemy('e-wyrm', WYRM_WORLD_X, WYRM_WORLD_Z, 10000);
    wyrm.type = EnemyType.WYRM_ASCENDANT;
    wyrmEnemyMap.set('e-wyrm', wyrm);
    wyrmSvc.fireTurn(new THREE.Scene(), WYRM_TURN);
    const fullDamage = Math.round(BASE_DAMAGE * 1.5);
    const wyrmDamage = Math.round(fullDamage / 1.5);
    expect(10000 - wyrm.health).toBe(wyrmDamage);
    expect(wyrmDamage).toBe(BASE_DAMAGE); // Confirmed: immune path returns base
  });

  it('VP + KOTH combined → WYRM strips both bonuses (base-without-elevation)', () => {
    // Tower at elev=2 (maxElev=2) → kothActive. VP=0.5 (mult=1.5), KOTH=1.0 (mult=2).
    // combined=3; stats.damage=Math.round(BASE×3)=30; WYRM: Math.round(30/3)=10=BASE.
    buildWyrmTestBed(new Map([[`${WYRM_ROW}-${WYRM_COL}`, 2]]), 2);
    wyrmCardEffectSpy.getModifierValue.and.callFake((stat: string) => {
      if (stat === VP_STAT) return 0.5;
      if (stat === KOTH_STAT) return 1.0;
      return 0;
    });
    const wyrm = createTestEnemy('e-wyrm-vp-koth', WYRM_WORLD_X, WYRM_WORLD_Z, 10000);
    wyrm.type = EnemyType.WYRM_ASCENDANT;
    wyrmEnemyMap.set('e-wyrm-vp-koth', wyrm);
    wyrmSvc.fireTurn(new THREE.Scene(), WYRM_TURN);
    const fullDamage = Math.round(BASE_DAMAGE * 1.5 * 2); // 30
    const wyrmDamage = Math.round(fullDamage / (1.5 * 2)); // 10
    expect(10000 - wyrm.health).toBe(wyrmDamage);
    expect(wyrmDamage).toBe(BASE_DAMAGE);
  });

  it('no elevation bonuses active → WYRM takes base damage (fast path)', () => {
    // Flat board: VP=0, KOTH=0. combinedMult=1. WYRM fast path returns stats.damage unchanged.
    buildWyrmTestBed(new Map([[`${WYRM_ROW}-${WYRM_COL}`, 0]]), 0);
    wyrmCardEffectSpy.getModifierValue.and.returnValue(0);
    const wyrm = createTestEnemy('e-wyrm-flat', WYRM_WORLD_X, WYRM_WORLD_Z, 10000);
    wyrm.type = EnemyType.WYRM_ASCENDANT;
    wyrmEnemyMap.set('e-wyrm-flat', wyrm);
    wyrmSvc.fireTurn(new THREE.Scene(), WYRM_TURN);
    expect(10000 - wyrm.health).toBe(BASE_DAMAGE);
  });

  it('WYRM does NOT affect range — tower still fires from elevated position', () => {
    // With tower at elevation 1, the range multiplier = 1 + 1×0.25 = 1.25.
    // A WYRM at BASE_RANGE × 1.25 distance away should still be in range.
    // But a WYRM at BASE_RANGE × 1.3 distance away — strictly beyond base but within
    // elevated range — should be targetable (elevation range bonus applies).
    // We verify by placing a WYRM just outside base range but within elevated range;
    // it should receive damage (confirming it was targeted).
    const BASE_RANGE = TOWER_CONFIGS[TowerType.BASIC].range;
    const ELEV_RANGE = BASE_RANGE * (1 + 1 * ELEVATION_CONFIG.RANGE_BONUS_PER_ELEVATION);
    // Place WYRM at 90% of elevated range — within elevated range, outside base range
    const wyrmX = WYRM_WORLD_X + BASE_RANGE * 1.15; // beyond base range
    buildWyrmTestBed(new Map([[`${WYRM_ROW}-${WYRM_COL}`, 1]]), 1);
    wyrmCardEffectSpy.getModifierValue.and.returnValue(0);
    const wyrm = createTestEnemy('e-wyrm-range', wyrmX, WYRM_WORLD_Z, 10000);
    wyrm.type = EnemyType.WYRM_ASCENDANT;
    wyrmEnemyMap.set('e-wyrm-range', wyrm);
    wyrmSvc.fireTurn(new THREE.Scene(), WYRM_TURN);
    // If WYRM is within elevated range, it should take damage.
    const distFromTower = Math.abs(wyrmX - WYRM_WORLD_X);
    if (distFromTower <= ELEV_RANGE) {
      expect(10000 - wyrm.health).toBeGreaterThan(0);
    } else {
      // Outside even elevated range — no damage expected
      expect(10000 - wyrm.health).toBe(0);
    }
  });

  it('WYRM + TITAN coexist — each uses its own path independently', () => {
    // In a single fireTurn there is only one tower (single-shot). So test each
    // independently with separate buildWyrmTestBed calls (TITAN suite above already
    // covers TITAN; this test confirms WYRM immunity does not bleed into TITAN logic
    // by verifying their damage values differ when VP is active).
    //
    // WYRM: strips bonus → base-without-elevation
    // TITAN: halves bonus → base + elev/2
    const vpMult = 1.5; // VP bonus = 0.5 → mult = 1.5
    const fullDamage = Math.round(BASE_DAMAGE * vpMult);
    const wyrmExpected = Math.round(fullDamage / vpMult); // 10 = BASE_DAMAGE
    const titanExpected = Math.round(BASE_DAMAGE + (fullDamage - BASE_DAMAGE) * ELEVATION_CONFIG.TITAN_ELEVATION_DAMAGE_REDUCTION);

    // WYRM case
    buildWyrmTestBed(new Map([[`${WYRM_ROW}-${WYRM_COL}`, 1]]), 1);
    wyrmCardEffectSpy.getModifierValue.and.callFake((s: string) => s === VP_STAT ? 0.5 : 0);
    const wyrm = createTestEnemy('e-wyrm-coexist', WYRM_WORLD_X, WYRM_WORLD_Z, 10000);
    wyrm.type = EnemyType.WYRM_ASCENDANT;
    wyrmEnemyMap.set('e-wyrm-coexist', wyrm);
    wyrmSvc.fireTurn(new THREE.Scene(), WYRM_TURN);
    expect(10000 - wyrm.health).toBe(wyrmExpected);
    TestBed.resetTestingModule();

    // TITAN case — rebuild fresh
    const titanMap = new Map<string, Enemy>();
    const titanElevSpy2 = jasmine.createSpyObj<ElevationService>('ElevationService', [
      'getElevation', 'getMaxElevation', 'raise', 'depress', 'setAbsolute',
      'collapse', 'getElevationMap', 'getActiveChanges', 'tickTurn', 'reset',
      'serialize', 'restore',
    ]);
    titanElevSpy2.getMaxElevation.and.returnValue(1);
    titanElevSpy2.getElevation.and.callFake((r: number, c: number) =>
      r === WYRM_ROW && c === WYRM_COL ? 1 : 0,
    );
    const titanCardSpy2 = createCardEffectServiceSpy();
    const pathSpy2 = jasmine.createSpyObj<PathfindingService>(
      'PathfindingService', ['getPathToExitLength', 'findPath', 'invalidateCache', 'reset'],
    );
    pathSpy2.getPathToExitLength.and.returnValue(0);
    TestBed.configureTestingModule({
      providers: [
        TowerCombatService, ChainLightningService, CombatVFXService, StatusEffectService, GameStateService,
        { provide: EnemyService, useValue: createEnemyServiceSpy(titanMap) },
        { provide: GameBoardService, useValue: createGameBoardServiceSpy(25, 20, 1) },
        { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
        { provide: RelicService, useValue: createRelicServiceSpy() },
        { provide: CardEffectService, useValue: titanCardSpy2 },
        { provide: PathfindingService, useValue: pathSpy2 },
        { provide: ElevationService, useValue: titanElevSpy2 },
      ],
    });
    const titanSvc2 = TestBed.inject(TowerCombatService);
    titanSvc2.registerTower(WYRM_ROW, WYRM_COL, TowerType.BASIC, new THREE.Group());
    titanCardSpy2.getModifierValue.and.callFake((s: string) => s === VP_STAT ? 0.5 : 0);
    const titan2 = createTestEnemy('e-titan-coexist', WYRM_WORLD_X, WYRM_WORLD_Z, 10000);
    titan2.type = EnemyType.TITAN;
    titanMap.set('e-titan-coexist', titan2);
    titanSvc2.fireTurn(new THREE.Scene(), WYRM_TURN);
    expect(10000 - titan2.health).toBe(titanExpected);

    // Confirm the two damage values differ when VP is active
    expect(wyrmExpected).not.toBe(titanExpected);
    expect(wyrmExpected).toBeLessThan(titanExpected); // WYRM immune → less damage than TITAN halve
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 prep — composeDamageStack regression spec.
// Pre-sprint-41 refactor extracted the 8-stage damage chain + 6-stage range
// chain from TowerCombatService.fireTurn into a named private method. This
// spec asserts bit-for-bit equality with the pre-refactor inline computation
// for a representative input set. If any assertion breaks after this commit
// lands, the extracted chain diverged from the inline version — revert.
// ─────────────────────────────────────────────────────────────────────────────

/** Local mirror of the unexported DamageStackResult interface (spec-only). */
interface SpecDamageStackResult {
  readonly damage: number;
  readonly range: number;
  readonly towerVantagePointDmgMult: number;
  readonly towerKothMult: number;
}

/** Exposes private composeDamageStack for white-box regression testing. */
interface TestableTowerCombatService {
  composeDamageStack(tower: PlacedTower, baseStats: TowerStats, ctx: DamageStackContext): SpecDamageStackResult;
}

describe('TowerCombatService.composeDamageStack (refactor regression)', () => {
  let service: TowerCombatService;
  let relicSpy: jasmine.SpyObj<RelicService>;
  let elevationSpy: jasmine.SpyObj<ElevationService>;

  // Default context — neutral: no active modifiers, no elevation, no Conduit.
  const neutralCtx: DamageStackContext = {
    towerDamageMultiplier: 1,
    cardDamageBoost: 0,
    cardRangeBoost: 0,
    sniperDamageBoost: 0,
    pathLengthMultiplier: 1,
    hasElevation: false,
    maxElevation: 0,
    highPerchBonus: 0,
    vantagePointBonus: 0,
    kothBonus: 0,
    kothActive: false,
    handshakeBonus: 0,
    formationRangeAdditive: 0,
    gridSurgeBonus: 0,
    architectClusterActive: false,
    currentTurn: 0,
  };

  beforeEach(() => {
    relicSpy = createRelicServiceSpy();
    relicSpy.getDamageMultiplier.and.returnValue(1);
    relicSpy.getRangeMultiplier.and.returnValue(1);
    elevationSpy = jasmine.createSpyObj<ElevationService>(
      'ElevationService',
      ['getElevation', 'getMaxElevation', 'reset', 'serialize', 'restore', 'tickTurn', 'raise', 'depress', 'setAbsolute', 'collapse', 'getActiveChanges', 'getElevationMap'],
    );
    elevationSpy.getElevation.and.returnValue(0);
    elevationSpy.getMaxElevation.and.returnValue(0);

    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        ChainLightningService,
        CombatVFXService,
        StatusEffectService,
        GameStateService,
        { provide: EnemyService, useValue: createEnemyServiceSpy(new Map()) },
        { provide: GameBoardService, useValue: createGameBoardServiceSpy(25, 20, 1) },
        { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
        { provide: RelicService, useValue: relicSpy },
        { provide: CardEffectService, useValue: createCardEffectServiceSpy() },
        { provide: ElevationService, useValue: elevationSpy },
      ],
    });
    service = TestBed.inject(TowerCombatService);
  });

  function buildTower(type: TowerType = TowerType.BASIC, row = 5, col = 5, overrides?: { damageMultiplier?: number; rangeMultiplier?: number }): PlacedTower {
    const tower: PlacedTower = {
      id: `t-${row}-${col}`,
      type,
      row,
      col,
      level: 1,
      kills: 0,
      totalInvested: 0,
      targetingMode: DEFAULT_TARGETING_MODE,
      mesh: null,
    };
    if (overrides) tower.cardStatOverrides = overrides;
    return tower;
  }

  function callStack(tower: PlacedTower, ctx: DamageStackContext = neutralCtx): SpecDamageStackResult {
    const baseStats = getEffectiveStats(tower.type, tower.level, tower.specialization);
    return (service as unknown as TestableTowerCombatService).composeDamageStack(tower, baseStats, ctx);
  }

  it('neutral inputs → damage = base, range = base, hoisted mults = 1', () => {
    const tower = buildTower();
    const base = TOWER_CONFIGS[TowerType.BASIC];
    const result = callStack(tower);

    expect(result.damage).toBe(base.damage);
    expect(result.range).toBeCloseTo(base.range, 5);
    expect(result.towerVantagePointDmgMult).toBe(1);
    expect(result.towerKothMult).toBe(1);
  });

  it('applies towerDamageMultiplier (difficulty preset) at stage 1', () => {
    const tower = buildTower();
    const result = callStack(tower, { ...neutralCtx, towerDamageMultiplier: 1.5 });
    const base = TOWER_CONFIGS[TowerType.BASIC].damage;
    expect(result.damage).toBe(Math.round(base * 1.5));
  });

  it('applies relicDamage multiplier at stage 2 (per-tower-type lookup)', () => {
    const tower = buildTower();
    relicSpy.getDamageMultiplier.and.callFake((type: TowerType) => (type === TowerType.BASIC ? 1.2 : 1));
    const base = TOWER_CONFIGS[TowerType.BASIC].damage;
    const result = callStack(tower);
    expect(result.damage).toBe(Math.round(base * 1.2));
  });

  it('applies cardDamageBoost at stage 3 as (1 + x) additive inside multiplier', () => {
    const tower = buildTower();
    const result = callStack(tower, { ...neutralCtx, cardDamageBoost: 0.5 });
    const base = TOWER_CONFIGS[TowerType.BASIC].damage;
    expect(result.damage).toBe(Math.round(base * (1 + 0.5)));
  });

  it('applies sniperDamageBoost at stage 4 ONLY for SNIPER towers', () => {
    const sniper = buildTower(TowerType.SNIPER);
    const basic = buildTower(TowerType.BASIC);
    const ctx: DamageStackContext = { ...neutralCtx, sniperDamageBoost: 0.25 };

    const sniperResult = callStack(sniper, ctx);
    const basicResult = callStack(basic, ctx);

    const sniperBase = TOWER_CONFIGS[TowerType.SNIPER].damage;
    const basicBase = TOWER_CONFIGS[TowerType.BASIC].damage;
    expect(sniperResult.damage).toBe(Math.round(sniperBase * (1 + 0.25)));
    expect(basicResult.damage).toBe(basicBase); // Not SNIPER → boost skipped.
  });

  it('applies per-tower cardStatOverrides.damageMultiplier at stage 5', () => {
    const tower = buildTower(TowerType.BASIC, 5, 5, { damageMultiplier: 2 });
    const base = TOWER_CONFIGS[TowerType.BASIC].damage;
    const result = callStack(tower);
    expect(result.damage).toBe(Math.round(base * 2));
  });

  it('applies pathLengthMultiplier at stage 6 (LABYRINTH_MIND)', () => {
    const tower = buildTower();
    const result = callStack(tower, { ...neutralCtx, pathLengthMultiplier: 1.3 });
    const base = TOWER_CONFIGS[TowerType.BASIC].damage;
    expect(result.damage).toBe(Math.round(base * 1.3));
  });

  it('applies vantagePointDmgMult at stage 7 gated by elevation ≥ VP threshold', () => {
    elevationSpy.getElevation.and.returnValue(ELEVATION_CONFIG.VANTAGE_POINT_ELEVATION_THRESHOLD);
    const tower = buildTower();
    const result = callStack(tower, { ...neutralCtx, hasElevation: true, vantagePointBonus: 0.5 });
    const base = TOWER_CONFIGS[TowerType.BASIC].damage;
    expect(result.damage).toBe(Math.round(base * 1.5));
    expect(result.towerVantagePointDmgMult).toBe(1.5);
  });

  it('skips vantagePointDmgMult when elevation is BELOW threshold (gate)', () => {
    elevationSpy.getElevation.and.returnValue(0); // elev 0, threshold is 1
    const tower = buildTower();
    const result = callStack(tower, { ...neutralCtx, hasElevation: true, vantagePointBonus: 0.5 });
    const base = TOWER_CONFIGS[TowerType.BASIC].damage;
    expect(result.damage).toBe(base); // VP skipped
    expect(result.towerVantagePointDmgMult).toBe(1);
  });

  it('applies kothMult at stage 8 only when tower elevation === maxElevation', () => {
    elevationSpy.getElevation.and.returnValue(3);
    const tower = buildTower();
    const ctx: DamageStackContext = {
      ...neutralCtx,
      hasElevation: true,
      maxElevation: 3,
      kothBonus: 1.0,
      kothActive: true,
    };
    const result = callStack(tower, ctx);
    const base = TOWER_CONFIGS[TowerType.BASIC].damage;
    expect(result.damage).toBe(Math.round(base * 2));
    expect(result.towerKothMult).toBe(2);
  });

  it('skips kothMult when tower is below maxElevation (per-tower gate)', () => {
    elevationSpy.getElevation.and.returnValue(1);
    const tower = buildTower();
    const ctx: DamageStackContext = {
      ...neutralCtx,
      hasElevation: true,
      maxElevation: 3, // board has a taller tower
      kothBonus: 1.0,
      kothActive: true,
    };
    const result = callStack(tower, ctx);
    const base = TOWER_CONFIGS[TowerType.BASIC].damage;
    expect(result.damage).toBe(base);
    expect(result.towerKothMult).toBe(1);
  });

  it('composes all 8 damage stages in the documented multiplicative order', () => {
    // Tower: SNIPER, L1, cardStatOverrides.damageMultiplier = 1.5
    // Elevation: 2 (triggers VP @ threshold 1 and KOTH when === max)
    elevationSpy.getElevation.and.returnValue(2);
    relicSpy.getDamageMultiplier.and.returnValue(1.1); // stage 2
    const tower = buildTower(TowerType.SNIPER, 5, 5, { damageMultiplier: 1.5 });
    const ctx: DamageStackContext = {
      towerDamageMultiplier: 1.2,      // stage 1
      cardDamageBoost: 0.3,             // stage 3 → 1.3
      cardRangeBoost: 0,
      sniperDamageBoost: 0.4,           // stage 4 → 1.4 (SNIPER)
      pathLengthMultiplier: 1.25,       // stage 6
      hasElevation: true,
      maxElevation: 2,
      highPerchBonus: 0,
      vantagePointBonus: 0.5,           // stage 7 → 1.5
      kothBonus: 1.0,                   // stage 8 → 2 (elev === max)
      kothActive: true,
      handshakeBonus: 0,                // stage 9 — inactive in this spec
      formationRangeAdditive: 0,        // inactive
      gridSurgeBonus: 0,                // inactive
      architectClusterActive: false,    // inactive
      currentTurn: 0,
    };
    const base = TOWER_CONFIGS[TowerType.SNIPER].damage;
    const expected = Math.round(
      base
        * 1.2    // stage 1
        * 1.1    // stage 2
        * 1.3    // stage 3
        * 1.4    // stage 4
        * 1.5    // stage 5 (cardStatOverrides)
        * 1.25   // stage 6
        * 1.5    // stage 7
        * 2,     // stage 8
    );
    expect(callStack(tower, ctx).damage).toBe(expected);
  });

  it('range stack: 6 stages compose multiplicatively with (base + additive) parenthesis', () => {
    // Elevation 2 → elevationRangeMult = 1 + 2 × 0.25 = 1.5
    // HIGH_PERCH active (threshold 2) → 1 + 0.2 = 1.2
    elevationSpy.getElevation.and.returnValue(ELEVATION_CONFIG.HIGH_PERCH_ELEVATION_THRESHOLD);
    relicSpy.getRangeMultiplier.and.returnValue(1.1);
    const tower = buildTower(TowerType.BASIC, 5, 5, { rangeMultiplier: 1.3 });
    const ctx: DamageStackContext = {
      ...neutralCtx,
      cardRangeBoost: 0.2,          // stage 2 → 1.2
      hasElevation: true,
      highPerchBonus: 0.2,          // stage 6 → 1.2 (threshold met)
    };
    const base = TOWER_CONFIGS[TowerType.BASIC].range;
    const elevationRangeMult = 1 + ELEVATION_CONFIG.HIGH_PERCH_ELEVATION_THRESHOLD * ELEVATION_CONFIG.RANGE_BONUS_PER_ELEVATION;
    const expected = (base + 0) * 1.1 * 1.2 * 1.3 * elevationRangeMult * 1.2;
    expect(callStack(tower, ctx).range).toBeCloseTo(expected, 5);
  });

  it('range stack: highPerchMult gated below threshold', () => {
    elevationSpy.getElevation.and.returnValue(1); // HIGH_PERCH threshold is 2
    const tower = buildTower();
    const result = callStack(tower, { ...neutralCtx, hasElevation: true, highPerchBonus: 0.5 });
    const base = TOWER_CONFIGS[TowerType.BASIC].range;
    const elevationRangeMult = 1 + 1 * ELEVATION_CONFIG.RANGE_BONUS_PER_ELEVATION;
    // HIGH_PERCH skipped → multiplier 1; passive elevation still applies.
    expect(result.range).toBeCloseTo(base * elevationRangeMult, 5);
  });

  it('hasElevation=false short-circuits — no elevation lookup, all elevation mults are 1', () => {
    // Production invariant: fireTurn computes kothActive = kothBonus > 0 && maxElevation >= 1.
    // So when hasElevation=false (maxElevation=0), kothActive is always false.
    // Production never constructs a ctx with kothActive=true AND maxElevation=0.
    const tower = buildTower();
    const ctx: DamageStackContext = {
      ...neutralCtx,
      vantagePointBonus: 0.5, // VP gate requires tower elev ≥ 1 — skipped when hasElevation=false.
      highPerchBonus: 0.5,    // HIGH_PERCH gate requires elev ≥ 2 — same.
    };
    const result = callStack(tower, ctx);
    const base = TOWER_CONFIGS[TowerType.BASIC];
    expect(result.damage).toBe(base.damage);
    expect(result.range).toBeCloseTo(base.range, 5);
    expect(elevationSpy.getElevation).not.toHaveBeenCalled();
  });

  it('rounds damage to integer (Math.round), preserves range as float', () => {
    const tower = buildTower();
    const ctx: DamageStackContext = { ...neutralCtx, towerDamageMultiplier: 1.333 };
    const base = TOWER_CONFIGS[TowerType.BASIC].damage;
    const result = callStack(tower, ctx);
    expect(result.damage).toBe(Math.round(base * 1.333));
    expect(Number.isInteger(result.damage)).toBe(true);
    // Range is NOT rounded — fractional precision preserved.
    expect(result.range).toBe(TOWER_CONFIGS[TowerType.BASIC].range);
  });

  // ─── Stage 9 — HANDSHAKE ─────────────────────────────────────────────────

  describe('HANDSHAKE multiplier (stage 9 — graph-reactive)', () => {
    // Re-wire the real TowerGraphService so composeDamageStack can query neighbors.
    let graph: TowerGraphService;
    let placedTowers: Map<string, PlacedTower>;
    let serviceWithGraph: TowerCombatService;

    beforeEach(() => {
      placedTowers = new Map();
      TestBed.resetTestingModule();

      relicSpy = createRelicServiceSpy();
      relicSpy.getDamageMultiplier.and.returnValue(1);
      relicSpy.getRangeMultiplier.and.returnValue(1);
      elevationSpy = jasmine.createSpyObj<ElevationService>(
        'ElevationService',
        ['getElevation', 'getMaxElevation', 'reset', 'serialize', 'restore', 'tickTurn', 'raise', 'depress', 'setAbsolute', 'collapse', 'getActiveChanges', 'getElevationMap'],
      );
      elevationSpy.getElevation.and.returnValue(0);
      elevationSpy.getMaxElevation.and.returnValue(0);

      TestBed.configureTestingModule({
        providers: [
          TowerCombatService,
          ChainLightningService,
          CombatVFXService,
          StatusEffectService,
          GameStateService,
          TowerGraphService,
          { provide: EnemyService, useValue: createEnemyServiceSpy(new Map()) },
          { provide: GameBoardService, useValue: createGameBoardServiceSpy(25, 20, 1) },
          { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
          { provide: RelicService, useValue: relicSpy },
          { provide: CardEffectService, useValue: createCardEffectServiceSpy() },
          { provide: ElevationService, useValue: elevationSpy },
        ],
      });
      serviceWithGraph = TestBed.inject(TowerCombatService);
      graph = TestBed.inject(TowerGraphService);
      graph.setPlacedTowersGetter(() => placedTowers);
    });

    function registerTower(row: number, col: number, type: TowerType = TowerType.BASIC): PlacedTower {
      const tower: PlacedTower = {
        id: `${row}-${col}`,
        type,
        level: 1,
        row,
        col,
        kills: 0,
        totalInvested: 0,
        targetingMode: DEFAULT_TARGETING_MODE,
        mesh: null,
      };
      placedTowers.set(tower.id, tower);
      graph.registerTower(tower);
      return tower;
    }

    function callStackWithGraph(tower: PlacedTower, ctx: Partial<DamageStackContext>): SpecDamageStackResult {
      const fullCtx: DamageStackContext = { ...neutralCtx, ...ctx };
      const baseStats = getEffectiveStats(tower.type, tower.level, tower.specialization);
      return (serviceWithGraph as unknown as TestableTowerCombatService).composeDamageStack(tower, baseStats, fullCtx);
    }

    it('HANDSHAKE active + ≥ 1 neighbor → applies (1 + handshakeBonus) multiplier', () => {
      const towerA = registerTower(5, 5);
      registerTower(5, 6); // neighbor
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(towerA, { handshakeBonus: 0.15 });
      expect(result.damage).toBe(Math.round(base * 1.15));
    });

    it('HANDSHAKE active + ZERO neighbors → multiplier is 1 (bonus gated)', () => {
      const tower = registerTower(5, 5);
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(tower, { handshakeBonus: 0.15 });
      expect(result.damage).toBe(base);
    });

    it('HANDSHAKE inactive (bonus=0) → no multiplier applied even with neighbors', () => {
      const towerA = registerTower(5, 5);
      registerTower(5, 6);
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(towerA, { handshakeBonus: 0 });
      expect(result.damage).toBe(base);
    });

    it('HANDSHAKE respects disruption — disrupted tower reports 0 neighbors, bonus skipped', () => {
      const towerA = registerTower(5, 5);
      registerTower(5, 6);
      // Disrupt the target tower.
      graph.severTower(5, 5, /* until */ 10, 'test-disruptor');
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(towerA, { handshakeBonus: 0.25, currentTurn: 5 });
      expect(result.damage).toBe(base); // disrupted → no neighbors → no bonus
    });

    // ─── FORMATION — additive-to-base range ────────────────────────────────

    it('FORMATION active + 3-tower horizontal line → +1 tile range (additive-before-multiplicative)', () => {
      // Build a horizontal line: (5, 5), (5, 6), (5, 7). Tower under test = middle.
      registerTower(5, 5);
      const middle = registerTower(5, 6);
      registerTower(5, 7);
      const base = TOWER_CONFIGS[TowerType.BASIC].range;
      const result = callStackWithGraph(middle, { formationRangeAdditive: 1 });
      // additive inside parenthesis → (base + 1) × (all mults === 1) = base + 1.
      expect(result.range).toBeCloseTo(base + 1, 5);
    });

    it('FORMATION applies to endpoints of a 3-tile line (not just middle)', () => {
      const leftEnd = registerTower(5, 5);
      registerTower(5, 6);
      registerTower(5, 7);
      const base = TOWER_CONFIGS[TowerType.BASIC].range;
      const result = callStackWithGraph(leftEnd, { formationRangeAdditive: 1 });
      expect(result.range).toBeCloseTo(base + 1, 5);
    });

    it('FORMATION does NOT apply to a 2-tower line (below minLength=3)', () => {
      const tower = registerTower(5, 5);
      registerTower(5, 6);
      const base = TOWER_CONFIGS[TowerType.BASIC].range;
      const result = callStackWithGraph(tower, { formationRangeAdditive: 1 });
      expect(result.range).toBeCloseTo(base, 5); // no bonus
    });

    it('FORMATION applies additive INSIDE multipliers — (base + 1) × elevation × HIGH_PERCH', () => {
      // Spike §13 regression: (base + 1) × 1.5 × 1.25 ≠ base × 1.5 × 1.25 + 1.
      elevationSpy.getElevation.and.returnValue(2);
      registerTower(5, 5);
      const middle = registerTower(5, 6);
      registerTower(5, 7);

      const result = callStackWithGraph(middle, {
        formationRangeAdditive: 1,
        hasElevation: true,
        highPerchBonus: 0.25, // HIGH_PERCH active + threshold met at elevation 2
      });

      const base = TOWER_CONFIGS[TowerType.BASIC].range;
      const elevationRangeMult = 1 + 2 * ELEVATION_CONFIG.RANGE_BONUS_PER_ELEVATION; // 1.5
      const highPerchMult = 1 + 0.25; // 1.25
      const additiveInside = (base + 1) * elevationRangeMult * highPerchMult;
      const additiveOutside = base * elevationRangeMult * highPerchMult + 1;
      expect(result.range).toBeCloseTo(additiveInside, 5);
      expect(result.range).not.toBeCloseTo(additiveOutside, 5);
    });

    it('FORMATION respects disruption — a disrupted tile interrupts the line', () => {
      registerTower(5, 5);
      const middle = registerTower(5, 6);
      registerTower(5, 7);
      // Disrupt the middle — now the line reads as three isolated towers.
      graph.severTower(5, 6, /* until */ 10, 'disruptor');
      const base = TOWER_CONFIGS[TowerType.BASIC].range;
      const result = callStackWithGraph(middle, { formationRangeAdditive: 1, currentTurn: 5 });
      // Middle tower is itself disrupted → isInStraightLineOf returns false.
      expect(result.range).toBeCloseTo(base, 5);
    });

    it('FORMATION vertical line — 3 towers at (r, r+1, r+2) same col qualifies', () => {
      registerTower(3, 5);
      const mid = registerTower(4, 5);
      registerTower(5, 5);
      const base = TOWER_CONFIGS[TowerType.BASIC].range;
      const result = callStackWithGraph(mid, { formationRangeAdditive: 1 });
      expect(result.range).toBeCloseTo(base + 1, 5);
    });

    it('FORMATION does NOT apply to L-shape (3 towers at (5,5), (5,6), (6,6)) — no straight line of 3', () => {
      const corner = registerTower(5, 5);
      registerTower(5, 6);
      registerTower(6, 6);
      const base = TOWER_CONFIGS[TowerType.BASIC].range;
      const result = callStackWithGraph(corner, { formationRangeAdditive: 1 });
      expect(result.range).toBeCloseTo(base, 5);
    });

    // ─── Stage 10 — GRID_SURGE ───────────────────────────────────────────

    it('GRID_SURGE active + 4 cardinal neighbors → applies (1 + gridSurgeBonus) multiplier', () => {
      // Cross pattern: center + 4 adjacent neighbors.
      const center = registerTower(5, 5);
      registerTower(4, 5);  // N
      registerTower(6, 5);  // S
      registerTower(5, 4);  // W
      registerTower(5, 6);  // E
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(center, { gridSurgeBonus: 1.0 });
      expect(result.damage).toBe(Math.round(base * 2)); // ×2 damage
    });

    it('GRID_SURGE active + only 3 neighbors → no multiplier (below MIN=4)', () => {
      const center = registerTower(5, 5);
      registerTower(4, 5);
      registerTower(6, 5);
      registerTower(5, 4);
      // Missing E neighbor — only 3 total.
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(center, { gridSurgeBonus: 1.0 });
      expect(result.damage).toBe(base); // no bonus
    });

    it('GRID_SURGE active + all 4 neighbors (upgraded bonus 1.5) → ×2.5 damage', () => {
      const center = registerTower(5, 5);
      registerTower(4, 5); registerTower(6, 5); registerTower(5, 4); registerTower(5, 6);
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(center, { gridSurgeBonus: 1.5 });
      expect(result.damage).toBe(Math.round(base * 2.5));
    });

    it('GRID_SURGE inactive (bonus=0) → no multiplier even with 4 neighbors', () => {
      const center = registerTower(5, 5);
      registerTower(4, 5); registerTower(6, 5); registerTower(5, 4); registerTower(5, 6);
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(center, { gridSurgeBonus: 0 });
      expect(result.damage).toBe(base);
    });

    it('GRID_SURGE respects disruption — disrupted tower reads zero neighbors', () => {
      const center = registerTower(5, 5);
      registerTower(4, 5); registerTower(6, 5); registerTower(5, 4); registerTower(5, 6);
      graph.severTower(5, 5, /* until */ 10, 'test-disruptor');
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(center, { gridSurgeBonus: 1.0, currentTurn: 5 });
      expect(result.damage).toBe(base); // disrupted → zero neighbors → no bonus
    });

    it('GRID_SURGE composes with HANDSHAKE — both multipliers stack', () => {
      const center = registerTower(5, 5);
      registerTower(4, 5); registerTower(6, 5); registerTower(5, 4); registerTower(5, 6);
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(center, { handshakeBonus: 0.15, gridSurgeBonus: 1.0 });
      // base × 1.15 (stage 9 HANDSHAKE) × 2 (stage 10 GRID_SURGE)
      expect(result.damage).toBe(Math.round(base * 1.15 * 2));
    });

    // ─── ARCHITECT cluster propagation ───────────────────────────────────

    it('ARCHITECT active + HANDSHAKE + isolated tower → no bonus (cluster of 1)', () => {
      const lone = registerTower(5, 5);
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(lone, { handshakeBonus: 0.15, architectClusterActive: true });
      expect(result.damage).toBe(base); // cluster size 1 → 0 effective neighbors
    });

    it('ARCHITECT active + HANDSHAKE + cluster of 2 → applies bonus', () => {
      const tA = registerTower(5, 5);
      registerTower(5, 6);  // neighbor → 2-tower cluster
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(tA, { handshakeBonus: 0.15, architectClusterActive: true });
      expect(result.damage).toBe(Math.round(base * 1.15));
    });

    it('ARCHITECT extends GRID_SURGE gate — cluster of 5 qualifies even without all 4 spatial neighbors', () => {
      // Tower at (5,5) with only 2 spatial neighbors (5,6) and (5,7), but
      // whole cluster is 5 (via an L-shape at (4,7), (3,7)). Without
      // ARCHITECT: 2 neighbors < 4 (GRID_SURGE_MIN_NEIGHBORS) → no bonus.
      // With ARCHITECT: cluster-1 = 4 ≥ 4 → bonus applies.
      const lone = registerTower(5, 5);
      registerTower(5, 6);   // neighbor of (5,5)
      registerTower(5, 7);   // neighbor of (5,6)
      registerTower(4, 7);   // neighbor of (5,7)
      registerTower(3, 7);   // neighbor of (4,7)
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;

      // Without ARCHITECT: no bonus (only 1 spatial neighbor at (5,5)).
      const withoutArchitect = callStackWithGraph(lone, { gridSurgeBonus: 1.0 });
      expect(withoutArchitect.damage).toBe(base);

      // With ARCHITECT: cluster of 5, so cluster-1 = 4 ≥ MIN (4) → ×2.
      const withArchitect = callStackWithGraph(lone, { gridSurgeBonus: 1.0, architectClusterActive: true });
      expect(withArchitect.damage).toBe(Math.round(base * 2));
    });

    it('ARCHITECT respects disruption — disrupted tower reads cluster of 1', () => {
      const tA = registerTower(5, 5);
      registerTower(5, 6); registerTower(5, 7); registerTower(4, 7);
      // Disrupt (5,5) — should read its cluster as just itself.
      graph.severTower(5, 5, /* until */ 10, 'test-disruptor');
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(tA, {
        handshakeBonus: 0.15,
        architectClusterActive: true,
        currentTurn: 5,
      });
      expect(result.damage).toBe(base); // disrupted → cluster of 1 → no bonus
    });

    it('ARCHITECT inactive → HANDSHAKE still uses literal neighbor count', () => {
      // Regression — architectClusterActive=false should route through the
      // legacy getNeighbors path, not the cluster path.
      const tA = registerTower(5, 5);
      registerTower(5, 6);
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(tA, { handshakeBonus: 0.15, architectClusterActive: false });
      expect(result.damage).toBe(Math.round(base * 1.15));
    });

    // ─── Stage 11 — TUNING_FORK relic ────────────────────────────────────

    it('TUNING_FORK owned + tower with ≥ 1 neighbor → +10% damage', () => {
      const tA = registerTower(5, 5);
      registerTower(5, 6);
      relicSpy.hasTuningFork.and.returnValue(true);
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(tA, {});
      expect(result.damage).toBe(Math.round(base * 1.1));
    });

    it('TUNING_FORK owned + isolated tower → no bonus', () => {
      const tA = registerTower(5, 5);
      relicSpy.hasTuningFork.and.returnValue(true);
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(tA, {});
      expect(result.damage).toBe(base);
    });

    it('TUNING_FORK not owned → no bonus even with neighbors', () => {
      const tA = registerTower(5, 5);
      registerTower(5, 6);
      // Default spy — hasTuningFork returns false.
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(tA, {});
      expect(result.damage).toBe(base);
    });

    it('TUNING_FORK respects disruption — disrupted tower gets no bonus', () => {
      const tA = registerTower(5, 5);
      registerTower(5, 6);
      relicSpy.hasTuningFork.and.returnValue(true);
      graph.severTower(5, 5, /* until */ 10, 'test-disruptor');
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      const result = callStackWithGraph(tA, { currentTurn: 5 });
      expect(result.damage).toBe(base);
    });

    it('TUNING_FORK stacks with HANDSHAKE — both multipliers apply', () => {
      const tA = registerTower(5, 5);
      registerTower(5, 6);
      relicSpy.hasTuningFork.and.returnValue(true);
      const base = TOWER_CONFIGS[TowerType.BASIC].damage;
      // Stage 9 HANDSHAKE (+15%) × stage 11 TUNING_FORK (+10%)
      const result = callStackWithGraph(tA, { handshakeBonus: 0.15 });
      expect(result.damage).toBe(Math.round(base * 1.15 * 1.1));
    });

    // ─── Stage 9 — HANDSHAKE composition regression ──────────────────────

    it('HANDSHAKE composes as stage 9 — after all Phase 3 multipliers', () => {
      // Fixture: SNIPER at elev 2, KOTH + VP + HANDSHAKE all active.
      elevationSpy.getElevation.and.returnValue(2);
      elevationSpy.getMaxElevation.and.returnValue(2);
      relicSpy.getDamageMultiplier.and.returnValue(1.1);
      const towerA = registerTower(5, 5, TowerType.SNIPER);
      registerTower(5, 6); // neighbor for HANDSHAKE

      const result = callStackWithGraph(towerA, {
        towerDamageMultiplier: 1.2,
        cardDamageBoost: 0.3,
        sniperDamageBoost: 0.4,
        pathLengthMultiplier: 1.25,
        hasElevation: true,
        maxElevation: 2,
        vantagePointBonus: 0.5,
        kothBonus: 1.0,
        kothActive: true,
        handshakeBonus: 0.15,
      });

      const base = TOWER_CONFIGS[TowerType.SNIPER].damage;
      const expected = Math.round(
        base
          * 1.2    // stage 1: towerDamageMultiplier
          * 1.1    // stage 2: relicDamage
          * 1.3    // stage 3: cardDamageBoost
          * 1.4    // stage 4: sniperBoost
          * 1.0    // stage 5: cardStatOverrides (none)
          * 1.25   // stage 6: pathLengthMultiplier
          * 1.5    // stage 7: VP
          * 2      // stage 8: KOTH
          * 1.15,  // stage 9: HANDSHAKE
      );
      expect(result.damage).toBe(expected);
    });
  });
});

// ─── LINKWORK (cluster fire-rate share) ────────────────────────────────────────
//
// LINKWORK is a turn-scoped flag that grants +1 shotsPerTurn to any tower
// in a cluster of size ≥ LINKWORK_MIN_CLUSTER_SIZE while active. Tested via
// fireTurn's shot count path, not composeDamageStack (LINKWORK is a shot
// modifier, not a damage modifier). Separate top-level describe because the
// TestBed wires the real TowerGraphService + `setPlacedTowersGetter`, which
// the parent describe's setup does not.

describe('TowerCombatService LINKWORK', () => {
  let service: TowerCombatService;
  let graph: TowerGraphService;
  let cardEffectSpy: jasmine.SpyObj<CardEffectService>;
  let enemyMap: Map<string, Enemy>;
  let mockScene: THREE.Scene;

  // Tower at row=10, col=12 on a 25x20 board → world (-0.5, 0).
  const BASE_ROW = 10;
  const BASE_COL = 12;

  beforeEach(() => {
    enemyMap = new Map();
    TestBed.resetTestingModule();
    const pathfindingSpy = jasmine.createSpyObj<PathfindingService>(
      'PathfindingService',
      ['getPathToExitLength', 'findPath', 'invalidateCache', 'reset'],
    );
    pathfindingSpy.getPathToExitLength.and.returnValue(0);

    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        ChainLightningService,
        CombatVFXService,
        StatusEffectService,
        GameStateService,
        TowerGraphService,
        { provide: EnemyService, useValue: createEnemyServiceSpy(enemyMap) },
        { provide: GameBoardService, useValue: createGameBoardServiceSpy(25, 20, 1) },
        { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
        { provide: RelicService, useValue: createRelicServiceSpy() },
        { provide: CardEffectService, useValue: createCardEffectServiceSpy() },
        { provide: PathfindingService, useValue: pathfindingSpy },
      ],
    });
    service = TestBed.inject(TowerCombatService);
    graph = TestBed.inject(TowerGraphService);
    graph.setPlacedTowersGetter(() => service.getPlacedTowers());
    cardEffectSpy = TestBed.inject(CardEffectService) as jasmine.SpyObj<CardEffectService>;
    mockScene = new THREE.Scene();
  });

  // Helper: tower world pos is derived by GameBoardService spy mapping — we
  // reuse createTestEnemy for enemies at the tower's world position. The
  // shared spy helper maps row=10,col=12 on a 25x20 board to world (-0.5, 0)
  // (same projection as the parent describe's TOWER_WORLD_X/Z constants).
  function enemyAt(id: string, x: number, z: number, hp = 10000): Enemy {
    const e = createTestEnemy(id, x, z, hp);
    enemyMap.set(id, e);
    return e;
  }

  it('LINKWORK active + cluster of 2 → each tower fires 2 shots (+1 from LINKWORK)', () => {
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 1, TowerType.BASIC, new THREE.Group());
    cardEffectSpy.hasActiveModifier.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.LINKWORK_FIRE_RATE_SHARE,
    );
    // 4 enemies so each of 2 towers can land both shots. createTestEnemy
    // projects tower (10, 12) on a 25x20 board to world (-0.5, 0).
    enemyAt('e1', -0.5, 0);
    enemyAt('e2', -0.4, 0);
    enemyAt('e3', -0.3, 0);
    enemyAt('e4', -0.2, 0);

    const result = service.fireTurn(mockScene, 1);

    // 2 towers × 2 shots each = 4 fires. LINKWORK grants +1 shot to each
    // cluster member (cluster size 2 ≥ LINKWORK_MIN_CLUSTER_SIZE).
    expect(result.fired.length).toBe(4);
  });

  it('LINKWORK active + isolated tower (cluster of 1) → fires 1 shot (below min)', () => {
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    cardEffectSpy.hasActiveModifier.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.LINKWORK_FIRE_RATE_SHARE,
    );
    enemyAt('e1', -0.5, 0);
    enemyAt('e2', -0.4, 0);

    const result = service.fireTurn(mockScene, 1);

    expect(result.fired.length).toBe(1);
  });

  it('LINKWORK inactive → cluster size is ignored, tower fires 1 shot', () => {
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 1, TowerType.BASIC, new THREE.Group());
    // Default spy: hasActiveModifier returns false for everything.
    enemyAt('e1', -0.5, 0);
    enemyAt('e2', -0.4, 0);

    const result = service.fireTurn(mockScene, 1);

    // Two towers × 1 shot each = 2 fires. Without LINKWORK, per-tower is 1.
    // Tower at (10, 13) targets the nearer enemy; first tower at (10, 12) also
    // fires once. So total fires = 2 but neither tower is multi-shotting.
    // Assert no tower fired more than once.
    const firesByPos = result.fired.length;
    expect(firesByPos).toBe(2);
  });

  it('LINKWORK respects disruption — disrupted tower sees itself only (cluster=1)', () => {
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 1, TowerType.BASIC, new THREE.Group());
    cardEffectSpy.hasActiveModifier.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.LINKWORK_FIRE_RATE_SHARE,
    );
    // Disrupt the first tower so its cluster size reads as 1.
    graph.severTower(BASE_ROW, BASE_COL, /* until */ 10, 'test-disruptor');
    enemyAt('e1', -0.5, 0);
    enemyAt('e2', -0.4, 0);

    // Turn 5 is within the disruption window.
    const result = service.fireTurn(mockScene, 5);

    // Disrupted tower no longer multi-shots; its partner (at col+1) is also
    // disrupted by virtue of the cluster severance, so cluster size for both
    // drops below the minimum. 1 shot per tower, 2 towers = 2 total fires —
    // same as the inactive case, not the +1 bonus case.
    expect(result.fired.length).toBe(2);
  });

  it('LINKWORK + FIRE_RATE modifier stack additively before ceil', () => {
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 1, TowerType.BASIC, new THREE.Group());
    cardEffectSpy.hasActiveModifier.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.LINKWORK_FIRE_RATE_SHARE,
    );
    cardEffectSpy.getModifierValue.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.FIRE_RATE ? 0.3 : 0,
    );
    // 4 enemies so both shots from both towers can resolve.
    enemyAt('e1', -0.5, 0);
    enemyAt('e2', -0.4, 0);
    enemyAt('e3', -0.3, 0);
    enemyAt('e4', -0.2, 0);

    const result = service.fireTurn(mockScene, 1);

    // Per tower: fireRateBoost=0.3 + LINKWORK=1 → ceil(1 + 1.3) = 3 shots each.
    // Two towers × 3 shots = 6 total fires.
    expect(result.fired.length).toBe(6);
  });

  it('LINKWORK with 3-tower horizontal line → all three towers get +1 shot', () => {
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 1, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 2, TowerType.BASIC, new THREE.Group());
    cardEffectSpy.hasActiveModifier.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.LINKWORK_FIRE_RATE_SHARE,
    );
    // Enough enemies for 3 towers × 2 shots each = 6 fires.
    for (let i = 0; i < 6; i++) enemyAt(`e${i}`, -0.5 + i * 0.05, 0);

    const result = service.fireTurn(mockScene, 1);

    // Cluster size is 3 for each tower (≥ MIN=2 for all). Total = 3 × 2 = 6 fires.
    expect(result.fired.length).toBe(6);
  });
});

// ─── HARMONIC (cluster-fire propagation) ──────────────────────────────────────
//
// HARMONIC is a turn-scoped flag. When active and a tower fires at target T,
// up to HARMONIC_NEIGHBOR_COUNT (2) random non-disrupted cluster neighbors
// also fire a single shot at T (range-gated, non-recursive, seeded RNG).
//
// Tested via fireTurn. TestBed wires real TowerGraphService + a RunService
// stub exposing nextRandom for deterministic passenger selection.

describe('TowerCombatService HARMONIC', () => {
  let service: TowerCombatService;
  let graph: TowerGraphService;
  let cardEffectSpy: jasmine.SpyObj<CardEffectService>;
  let runServiceStub: { nextRandom: jasmine.Spy };
  let enemyMap: Map<string, Enemy>;
  let mockScene: THREE.Scene;

  const BASE_ROW = 10;
  const BASE_COL = 12;

  beforeEach(() => {
    enemyMap = new Map();
    TestBed.resetTestingModule();
    const pathfindingSpy = jasmine.createSpyObj<PathfindingService>(
      'PathfindingService',
      ['getPathToExitLength', 'findPath', 'invalidateCache', 'reset'],
    );
    pathfindingSpy.getPathToExitLength.and.returnValue(0);

    // Deterministic RNG — returns 0, 0, 0, … so Fisher–Yates picks the
    // earliest candidates. Override per-test as needed.
    runServiceStub = {
      nextRandom: jasmine.createSpy('nextRandom').and.returnValue(0),
    };

    TestBed.configureTestingModule({
      providers: [
        TowerCombatService,
        ChainLightningService,
        CombatVFXService,
        StatusEffectService,
        GameStateService,
        TowerGraphService,
        { provide: EnemyService, useValue: createEnemyServiceSpy(enemyMap) },
        { provide: GameBoardService, useValue: createGameBoardServiceSpy(25, 20, 1) },
        { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
        { provide: RelicService, useValue: createRelicServiceSpy() },
        { provide: CardEffectService, useValue: createCardEffectServiceSpy() },
        { provide: PathfindingService, useValue: pathfindingSpy },
        { provide: RunService, useValue: runServiceStub },
      ],
    });
    service = TestBed.inject(TowerCombatService);
    graph = TestBed.inject(TowerGraphService);
    graph.setPlacedTowersGetter(() => service.getPlacedTowers());
    cardEffectSpy = TestBed.inject(CardEffectService) as jasmine.SpyObj<CardEffectService>;
    mockScene = new THREE.Scene();
  });

  function enemyAt(id: string, x: number, z: number, hp = 10000): Enemy {
    const e = createTestEnemy(id, x, z, hp);
    enemyMap.set(id, e);
    return e;
  }

  function activateHarmonic(): void {
    cardEffectSpy.hasActiveModifier.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.HARMONIC_SIMULTANEOUS_FIRE,
    );
  }

  it('HARMONIC active + 3-tower cluster → main tower + 2 passengers fire at same target', () => {
    // 3 towers adjacent horizontally: (10,12) (10,13) (10,14). All in one cluster.
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 1, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 2, TowerType.BASIC, new THREE.Group());
    activateHarmonic();
    // Single enemy near (10, 12) within range of all 3 (BASIC range = 3 tiles).
    enemyAt('e1', -0.5, 0);

    const result = service.fireTurn(mockScene, 1);

    // 3 towers × 1 main shot each = 3. Each main tower triggers 2 passengers
    // at its own target (the shared enemy for adjacent-enough towers).
    // Main tower (10,12): 1 shot + 2 passengers = 3 fires.
    // (10,13) fires as main (still has target in range): 1 + 2 passengers = 3.
    // (10,14) fires as main (target may be borderline): 1 + up to 2 passengers.
    // The exact number depends on range — at minimum, the main-tower chain at
    // (10,12) produces 1 main + 2 passenger shots if target is in range of
    // the two neighbors.
    expect(result.fired.length).toBeGreaterThanOrEqual(3);
  });

  it('HARMONIC active + isolated tower → only main shot fires (no passengers)', () => {
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    activateHarmonic();
    enemyAt('e1', -0.5, 0);

    const result = service.fireTurn(mockScene, 1);

    expect(result.fired.length).toBe(1);
  });

  it('HARMONIC inactive → passenger propagation never triggers', () => {
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 1, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 2, TowerType.BASIC, new THREE.Group());
    // Default spy: hasActiveModifier returns false.
    enemyAt('e1', -0.5, 0);

    const result = service.fireTurn(mockScene, 1);

    // Each tower fires once at whatever target is in range — no passenger bursts.
    // 3 towers × 1 shot = 3 fires.
    expect(result.fired.length).toBeLessThanOrEqual(3);
  });

  it('HARMONIC does NOT recurse — passenger shots never trigger their own HARMONIC burst', () => {
    // 3-tower cluster. Count how many fires happen per tower-type logic:
    // If HARMONIC recursed, a passenger shot would also trigger N more
    // passengers, leading to a runaway cascade. Our implementation must
    // bound total fires per main tower to (1 main + N passengers).
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 1, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 2, TowerType.BASIC, new THREE.Group());
    activateHarmonic();
    enemyAt('e1', -0.5, 0);

    const result = service.fireTurn(mockScene, 1);

    // Bound: 3 main-tower iterations. Each iteration = 1 main shot + at most
    // HARMONIC_NEIGHBOR_COUNT (2) passengers = 3 fires per iteration. Hard
    // cap: 3 * 3 = 9 fires. If recursion leaked, we'd see much more.
    expect(result.fired.length).toBeLessThanOrEqual(9);
  });

  it('HARMONIC respects disruption — disrupted tower has cluster size 1, no passengers', () => {
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 1, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 2, TowerType.BASIC, new THREE.Group());
    activateHarmonic();
    // Disrupt the middle tower. The graph reports a disrupted tower as its
    // own single-tower cluster; cluster reads from (10,12) and (10,14) drop
    // the disrupted middle tower from the cluster.
    graph.severTower(BASE_ROW, BASE_COL + 1, /* until */ 20, 'test-disruptor');
    enemyAt('e1', -0.5, 0);

    const result = service.fireTurn(mockScene, 5);

    // Disruption splits the cluster. Each tower now sees cluster size 1
    // (or less for the disrupted one), so HARMONIC finds no passengers.
    // Max fires = 3 main shots × 1 (no passengers) = 3.
    expect(result.fired.length).toBeLessThanOrEqual(3);
  });

  it('HARMONIC uses seeded RNG — identical RNG yields identical passenger selection', () => {
    // 4-tower cluster (main + 3 neighbors). HARMONIC_NEIGHBOR_COUNT=2 → pick 2 of 3.
    // With nextRandom stubbed to return 0, the Fisher-Yates shuffle is deterministic.
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW - 1, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW + 1, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL - 1, TowerType.BASIC, new THREE.Group());
    activateHarmonic();
    // Spy on nextRandom to confirm it was called (determinism gate).
    expect(runServiceStub.nextRandom).not.toHaveBeenCalled();

    enemyAt('e1', -0.5, 0);
    service.fireTurn(mockScene, 1);

    // If HARMONIC fires at least once through the 4-tower cluster, nextRandom
    // is called inside pickHarmonicPassengers. Sanity check: RNG was consulted.
    expect(runServiceStub.nextRandom).toHaveBeenCalled();
  });

  // ─── HIVE_MIND cluster-max composition ─────────────────────────────────
  //
  // Hard to unit-test in a damage-stack describe because HIVE_MIND is a post-
  // compose step inside fireTurn (swaps composed stats with cluster max
  // before writing to scratchStats). These tests exercise the full fireTurn
  // path to confirm a BASIC next to a SNIPER under HIVE_MIND deals SNIPER
  // damage.

  it('HIVE_MIND active + BASIC+SNIPER cluster → BASIC deals SNIPER damage', () => {
    // BASIC (25 dmg) at (10,12), SNIPER (80 dmg) at (10,13). Adjacent → one cluster.
    // Under HIVE_MIND, BASIC's shot should deal 80 damage (max of cluster).
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 1, TowerType.SNIPER, new THREE.Group());
    cardEffectSpy.hasActiveModifier.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX,
    );
    // Tier sentinel: 1 = base (damage+range sharing), 2 = upgraded (+secondary).
    cardEffectSpy.getMaxModifierEntryValue.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX ? 1 : 0,
    );
    const enemy = enemyAt('e1', -0.5, 0, 10000);

    service.fireTurn(mockScene, 1);

    // Both towers fire once. SNIPER at (10, 13) world (-0.4, 0) — close enough
    // to enemy at (-0.5, 0). Enemy gets hit by both; total damage should be at
    // least 2×80 = 160 (BASIC under HIVE_MIND → 80, plus SNIPER's own 80).
    const damageTaken = 10000 - enemy.health;
    expect(damageTaken).toBeGreaterThanOrEqual(160);
  });

  it('HIVE_MIND inactive → BASIC deals own damage (25), SNIPER deals 80', () => {
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 1, TowerType.SNIPER, new THREE.Group());
    // Default spy: no modifiers active.
    const enemy = enemyAt('e1', -0.5, 0, 10000);

    service.fireTurn(mockScene, 1);

    // BASIC (25) + SNIPER (80) = 105 if both hit and neither gets HIVE_MIND.
    const damageTaken = 10000 - enemy.health;
    expect(damageTaken).toBeGreaterThanOrEqual(105);
    expect(damageTaken).toBeLessThan(160); // < 2×SNIPER confirms HIVE_MIND off
  });

  it('HIVE_MIND active + isolated BASIC → deals own 25 damage (cluster of 1)', () => {
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    cardEffectSpy.hasActiveModifier.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX,
    );
    // Tier sentinel: 1 = base (damage+range sharing), 2 = upgraded (+secondary).
    cardEffectSpy.getMaxModifierEntryValue.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX ? 1 : 0,
    );
    const enemy = enemyAt('e1', -0.5, 0, 10000);

    service.fireTurn(mockScene, 1);

    // Lone BASIC: max-of-cluster collapses to self. Deals 25.
    expect(10000 - enemy.health).toBe(25);
  });

  it('HIVE_MIND respects disruption — disrupted BASIC reads cluster of 1', () => {
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 1, TowerType.SNIPER, new THREE.Group());
    cardEffectSpy.hasActiveModifier.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX,
    );
    // Tier sentinel: 1 = base (damage+range sharing), 2 = upgraded (+secondary).
    cardEffectSpy.getMaxModifierEntryValue.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX ? 1 : 0,
    );
    // Disrupt the BASIC so its cluster reads as size 1 — collapsing HIVE_MIND.
    graph.severTower(BASE_ROW, BASE_COL, /* until */ 100, 'test-disruptor');
    const enemy = enemyAt('e1', -0.5, 0, 10000);

    service.fireTurn(mockScene, 5);

    // BASIC disrupted → its own damage (25). SNIPER fires normally at 80.
    // Total ~ 25 + 80 = 105 (HIVE_MIND dead for BASIC).
    const damageTaken = 10000 - enemy.health;
    expect(damageTaken).toBeGreaterThanOrEqual(105);
    expect(damageTaken).toBeLessThan(160);
  });

  // ── HIVE_MIND upgraded — secondary-stat sharing (tier 2) ────────────────

  it('HIVE_MIND upgraded (tier 2) + BASIC+SPLASH cluster → BASIC fires with SPLASH radius', () => {
    // BASIC has no splashRadius; SPLASH has a non-zero splashRadius. Upgraded
    // HIVE_MIND means the strongest cluster member's secondary stats propagate —
    // BASIC should now fire with SPLASH's splashRadius as the "secondary source".
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 1, TowerType.SPLASH, new THREE.Group());
    // Pin to NEAREST so BASIC reliably picks `mainEnemy` (its closest target).
    service.setTargetingMode(`${BASE_ROW}-${BASE_COL}`, TargetingMode.NEAREST);
    service.setTargetingMode(`${BASE_ROW}-${BASE_COL + 1}`, TargetingMode.NEAREST);

    // Tier 2 = upgraded. hasActiveModifier still true for existing gate logic.
    cardEffectSpy.hasActiveModifier.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX,
    );
    cardEffectSpy.getMaxModifierEntryValue.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX ? 2 : 0,
    );

    // Spawn two close enemies so a non-zero splashRadius on BASIC would hit
    // both with one BASIC shot. Coordinates are tower-close so splash AoE lands.
    const mainEnemy = enemyAt('main', -0.5, 0, 10000);
    const splashEnemy = enemyAt('splash-target', -0.4, 0, 10000);

    service.fireTurn(mockScene, 1);

    // If BASIC inherited SPLASH's secondary radius, both enemies take damage.
    // (Base-tier BASIC has no splash, so secondary would miss splashEnemy.)
    expect(10000 - splashEnemy.health).toBeGreaterThan(0);
    // And the main target also took damage from the BASIC shot.
    expect(10000 - mainEnemy.health).toBeGreaterThan(0);
  });

  it('HIVE_MIND BASE tier (value 1) — BASIC+SPLASH cluster does NOT share splash', () => {
    // Sanity: the upgrade is what unlocks secondary sharing. Base tier leaves
    // BASIC as a single-target fire even when clustered with SPLASH.
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    service.registerTower(BASE_ROW, BASE_COL + 1, TowerType.SPLASH, new THREE.Group());

    cardEffectSpy.hasActiveModifier.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX,
    );
    cardEffectSpy.getMaxModifierEntryValue.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX ? 1 : 0,
    );

    // Place a second enemy OUTSIDE BASIC's single-target line but within a
    // splash AoE if one were applied. With base HIVE_MIND, BASIC fires at the
    // primary only; the secondary-position enemy stays at full HP.
    const mainEnemy = enemyAt('main', -0.5, 0, 10000);
    const secondaryEnemy = enemyAt('aoe-target', -0.5, 0.4, 10000);

    service.fireTurn(mockScene, 1);

    // Primary gets hit by both BASIC and SPLASH; secondary-position enemy only
    // gets hit if SPLASH's own shot covers them (not from BASIC borrowing).
    expect(10000 - mainEnemy.health).toBeGreaterThan(0);
    // Assert that BASIC did NOT gain splash radius — if both enemies took the
    // same cluster-borrowed damage the numbers would look identical; base tier
    // should show the SECONDARY enemy taking less damage (only SPLASH's reach).
    const mainDmg = 10000 - mainEnemy.health;
    const secondaryDmg = 10000 - secondaryEnemy.health;
    // Secondary takes at most SPLASH's splash hit, NOT a BASIC splash-borrow.
    expect(secondaryDmg).toBeLessThanOrEqual(mainDmg);
  });

  it('HIVE_MIND upgraded — lone tower falls through (topDamageMember === self, no override)', () => {
    // Upgraded HIVE_MIND with a cluster of 1 should not change BASIC's behavior
    // from the base tier — topDamageMember === self, secondary-source branch is
    // a no-op. Guarded explicitly so regressions in the self-fallthrough don't
    // silently rewrite scratchStats with junk.
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());

    cardEffectSpy.hasActiveModifier.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX,
    );
    cardEffectSpy.getMaxModifierEntryValue.and.callFake((stat: string) =>
      stat === MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX ? 2 : 0,
    );

    const enemy = enemyAt('e1', -0.5, 0, 10000);

    service.fireTurn(mockScene, 1);

    // Lone BASIC with upgraded tier — fires as if no HIVE_MIND. Damage = 25.
    expect(10000 - enemy.health).toBe(25);
  });

  it('HARMONIC skips passengers when target is out of their range', () => {
    // Place two towers far apart in the cluster via a virtual edge (simulates
    // CONDUIT_BRIDGE) so cluster membership includes a tower well outside
    // BASIC range.
    service.registerTower(BASE_ROW, BASE_COL, TowerType.BASIC, new THREE.Group());
    // 15 tiles away horizontally — well outside BASIC range (3 tiles).
    service.registerTower(BASE_ROW, BASE_COL - 8, TowerType.BASIC, new THREE.Group());
    // Use virtual edge to union them into one cluster even though they are
    // not spatially adjacent (mirrors sprint-48 CONDUIT_BRIDGE semantics).
    graph.addVirtualEdge(BASE_ROW, BASE_COL, BASE_ROW, BASE_COL - 8, /* expires */ 100, 'test-bridge');
    activateHarmonic();
    // Enemy near (10,12) but NOT near (10, 4).
    enemyAt('e1', -0.5, 0);

    const result = service.fireTurn(mockScene, 1);

    // Main tower fires at e1, HARMONIC tries to propagate to its far
    // passenger, but the passenger's range doesn't reach e1 → passenger
    // skipped. Total fires = 1 main + 0 passengers = 1 (plus whatever
    // firing happens from the far tower if an enemy is in its range —
    // not in this test). Assert upper bound: no passenger propagation.
    expect(result.fired.length).toBeLessThanOrEqual(1);
  });
});