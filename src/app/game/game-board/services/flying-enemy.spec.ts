import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { EnemyService, DamageResult } from './enemy.service';
import { EnemyMeshFactoryService } from './enemy-mesh-factory.service';
import { PathfindingService } from './pathfinding.service';
import { GameStateService } from './game-state.service';
import { TowerCombatService } from './tower-combat.service';
import { CombatVFXService } from './combat-vfx.service';
import { StatusEffectService } from './status-effect.service';
import { GameBoardService } from '../game-board.service';
import { AudioService } from './audio.service';
import { EnemyType, ENEMY_STATS, FLYING_ENEMY_HEIGHT, Enemy } from '../models/enemy.model';
import { TowerType, TOWER_CONFIGS } from '../models/tower.model';
import { createTestBoard, createGameBoardServiceSpy, createEnemyServiceSpy, createTowerAnimationServiceSpy } from '../testing';
import { TowerAnimationService } from './tower-animation.service';

describe('Flying Enemy', () => {
  let enemyService: EnemyService;
  let gameBoardService: jasmine.SpyObj<GameBoardService>;
  let mockScene: THREE.Scene;

  beforeEach(() => {
    const spy = createGameBoardServiceSpy(10, 10, 1, () => createTestBoard());

    TestBed.configureTestingModule({
      providers: [
        PathfindingService,
        EnemyService,
        EnemyMeshFactoryService,
        GameStateService,
        { provide: GameBoardService, useValue: spy }
      ]
    });

    enemyService = TestBed.inject(EnemyService);
    gameBoardService = TestBed.inject(GameBoardService) as jasmine.SpyObj<GameBoardService>;
    mockScene = new THREE.Scene();
  });

  afterEach(() => {
    enemyService.getEnemies().forEach((_enemy, id) => {
      enemyService.removeEnemy(id, mockScene);
    });
    // Dispose any remaining scene children
    while (mockScene.children.length > 0) {
      const child = mockScene.children[0];
      mockScene.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  });

  // ---------------------------------------------------------------
  // Spawn & Path
  // ---------------------------------------------------------------
  describe('Spawn & Path', () => {
    it('should spawn with isFlying = true', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      expect(enemy).toBeTruthy();
      expect(enemy.isFlying).toBe(true);
    });

    it('should use a 2-node straight path (start -> end)', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      expect(enemy.path.length).toBe(2);

      // First node = spawner grid (col=0, row=0)
      expect(enemy.path[0]).toEqual(jasmine.objectContaining({ x: 0, y: 0 }));
      // Last node = exit grid (col=9, row=9)
      expect(enemy.path[1]).toEqual(jasmine.objectContaining({ x: 9, y: 9 }));
    });

    it('should NOT use A* pathfinding (path length is always 2 regardless of obstacles)', () => {
      // Block the entire row 4 — ground enemies would need to path around
      const wallCells: { row: number; col: number }[] = [];
      for (let col = 0; col <= 9; col++) {
        wallCells.push({ row: 4, col });
      }
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, wallCells));

      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      expect(enemy).toBeTruthy();
      expect(enemy.path.length).toBe(2);
    });

    it('should spawn at FLYING_ENEMY_HEIGHT (y-position), not at stats.size', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      expect(enemy.position.y).toBe(FLYING_ENEMY_HEIGHT);
      expect(enemy.position.y).not.toBe(ENEMY_STATS[EnemyType.FLYING].size);
    });

    it('should spawn even when ground path is fully blocked', () => {
      // Block both neighbours of spawner (0,0) so A* would fail
      const wallCells = [
        { row: 0, col: 1 },
        { row: 1, col: 0 }
      ];
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, wallCells));

      // Ground enemy should fail
      const ground = enemyService.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(ground).toBeNull();

      // Flying enemy should succeed
      const flyer = enemyService.spawnEnemy(EnemyType.FLYING, mockScene);
      expect(flyer).toBeTruthy();
      expect(flyer!.path.length).toBe(2);
    });
  });

  // ---------------------------------------------------------------
  // Movement
  // ---------------------------------------------------------------
  describe('Movement', () => {
    it('should move in a straight line from spawner to exit', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      const startX = enemy.position.x;
      const startZ = enemy.position.z;

      enemyService.updateEnemies(0.1);

      // Should have moved
      const hasMoved =
        enemy.position.x !== startX || enemy.position.z !== startZ;
      expect(hasMoved).toBe(true);
      expect(enemy.distanceTraveled).toBeGreaterThan(0);
    });

    it('should maintain FLYING_ENEMY_HEIGHT during movement', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;

      enemyService.updateEnemies(0.5);

      expect(enemy.position.y).toBe(FLYING_ENEMY_HEIGHT);
    });

    it('should NOT change altitude as it moves', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;

      for (let i = 0; i < 10; i++) {
        enemyService.updateEnemies(0.1);
        expect(enemy.position.y).toBe(FLYING_ENEMY_HEIGHT);
      }
    });

    it('should travel through/over non-traversable tiles (WALL)', () => {
      // Wall the entire center of the board
      const wallCells: { row: number; col: number }[] = [];
      for (let row = 3; row <= 6; row++) {
        for (let col = 3; col <= 6; col++) {
          wallCells.push({ row, col });
        }
      }
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, wallCells));

      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      expect(enemy).toBeTruthy();

      // Move it enough to cross the board
      for (let i = 0; i < 100; i++) {
        enemyService.updateEnemies(0.1);
      }

      expect(enemy.distanceTraveled).toBeGreaterThan(0);
    });

    it('should reach exit and trigger exit detection normally', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;

      // Force to last path node
      enemy.pathIndex = enemy.path.length - 1;

      const reachedExit = enemyService.updateEnemies(0.1);
      expect(reachedExit).toContain(enemy.id);
    });
  });

  // ---------------------------------------------------------------
  // Combat
  // ---------------------------------------------------------------
  describe('Combat', () => {
    it('should take damage normally from damageEnemy', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      const initialHealth = enemy.health;

      const result = enemyService.damageEnemy(enemy.id, 10);

      expect(result.killed).toBe(false);
      expect(enemy.health).toBe(initialHealth - 10);
    });

    it('should be killable (death handling)', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;

      const result = enemyService.damageEnemy(enemy.id, enemy.health);

      expect(result.killed).toBe(true);
      expect(enemy.health).toBe(0);
    });

    it('should return correct value when killed', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      expect(enemy.value).toBe(ENEMY_STATS[EnemyType.FLYING].value);
    });

    it('should not spawn mini-enemies on death (not a swarm)', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;

      const result = enemyService.damageEnemy(enemy.id, enemy.health);

      expect(result.killed).toBe(true);
      expect(result.spawnedEnemies.length).toBe(0);
    });

    // Slow immunity test requires TowerCombatService
    describe('Slow immunity (TowerCombatService integration)', () => {
      let combatService: TowerCombatService;
      let combatVFXService: CombatVFXService;
      let enemyServiceForCombat: EnemyService;
      let gameBoardServiceForCombat: jasmine.SpyObj<GameBoardService>;
      let audioServiceSpy: jasmine.SpyObj<AudioService>;
      let combatScene: THREE.Scene;
      let enemyMap: Map<string, Enemy>;

      // Tower at row=5, col=5 on a 10x10 board -> world position (0, 0)
      const TOWER_ROW = 5;
      const TOWER_COL = 5;

      beforeEach(() => {
        enemyMap = new Map();

        const enemySpy = createEnemyServiceSpy(enemyMap);
        gameBoardServiceForCombat = createGameBoardServiceSpy(10, 10, 1);

        audioServiceSpy = jasmine.createSpyObj('AudioService', ['playSfx']);

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
          providers: [
            TowerCombatService,
            CombatVFXService,
            StatusEffectService,
            GameStateService,
            { provide: EnemyService, useValue: enemySpy },
            { provide: GameBoardService, useValue: gameBoardServiceForCombat },
            { provide: AudioService, useValue: audioServiceSpy },
            { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
          ]
        });

        combatService = TestBed.inject(TowerCombatService);
        combatVFXService = TestBed.inject(CombatVFXService);
        enemyServiceForCombat = TestBed.inject(EnemyService) as unknown as EnemyService;
        combatScene = new THREE.Scene();
      });

      afterEach(() => {
        combatService.cleanup(combatScene);
        while (combatScene.children.length > 0) {
          const child = combatScene.children[0];
          combatScene.remove(child);
        }
      });

      it('should be immune to Slow tower effects', () => {
        // Register a slow tower at (5,5)
        combatService.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());

        // Place a flying enemy near the tower (within range)
        // World pos: (col - width/2) * tileSize = (5 - 5) * 1 = 0
        const flyingEnemy: Enemy = {
          id: 'fly-1',
          type: EnemyType.FLYING,
          position: { x: 0, y: FLYING_ENEMY_HEIGHT, z: 0 },
          gridPosition: { row: TOWER_ROW, col: TOWER_COL },
          health: ENEMY_STATS[EnemyType.FLYING].health,
          maxHealth: ENEMY_STATS[EnemyType.FLYING].health,
          speed: ENEMY_STATS[EnemyType.FLYING].speed,
          value: ENEMY_STATS[EnemyType.FLYING].value,
          leakDamage: ENEMY_STATS[EnemyType.FLYING].leakDamage,
          path: [],
          pathIndex: 0,
          distanceTraveled: 0,
          isFlying: true
        };
        enemyMap.set(flyingEnemy.id, flyingEnemy);

        const originalSpeed = flyingEnemy.speed;

        // Update past slow tower fire rate to trigger aura
        combatService.update(0.6, combatScene);

        // Speed should NOT change
        expect(flyingEnemy.speed).toBe(originalSpeed);
      });

      it('should still slow ground enemies while skipping flying ones', () => {
        combatService.registerTower(TOWER_ROW, TOWER_COL, TowerType.SLOW, new THREE.Group());

        const groundEnemy: Enemy = {
          id: 'ground-1',
          type: EnemyType.BASIC,
          position: { x: 0, y: 0.3, z: 0 },
          gridPosition: { row: TOWER_ROW, col: TOWER_COL },
          health: 100,
          maxHealth: 100,
          speed: 2,
          value: 10,
          leakDamage: 1,
          path: [],
          pathIndex: 0,
          distanceTraveled: 0
        };

        const flyingEnemy: Enemy = {
          id: 'fly-2',
          type: EnemyType.FLYING,
          position: { x: 0, y: FLYING_ENEMY_HEIGHT, z: 0 },
          gridPosition: { row: TOWER_ROW, col: TOWER_COL },
          health: ENEMY_STATS[EnemyType.FLYING].health,
          maxHealth: ENEMY_STATS[EnemyType.FLYING].health,
          speed: ENEMY_STATS[EnemyType.FLYING].speed,
          value: ENEMY_STATS[EnemyType.FLYING].value,
          leakDamage: ENEMY_STATS[EnemyType.FLYING].leakDamage,
          path: [],
          pathIndex: 0,
          distanceTraveled: 0,
          isFlying: true
        };

        enemyMap.set(groundEnemy.id, groundEnemy);
        enemyMap.set(flyingEnemy.id, flyingEnemy);

        const groundOriginal = groundEnemy.speed;
        const flyingOriginal = flyingEnemy.speed;

        combatService.update(0.6, combatScene);

        // Ground enemy should be slowed
        const slowFactor = TOWER_CONFIGS[TowerType.SLOW].slowFactor!;
        expect(groundEnemy.speed).toBeCloseTo(groundOriginal * slowFactor);

        // Flying enemy should NOT be slowed
        expect(flyingEnemy.speed).toBe(flyingOriginal);
      });

      it('flying enemies can still be targeted and damaged by non-slow towers', () => {
        combatService.registerTower(TOWER_ROW, TOWER_COL, TowerType.BASIC, new THREE.Group());

        const flyingEnemy: Enemy = {
          id: 'fly-3',
          type: EnemyType.FLYING,
          position: { x: 0, y: FLYING_ENEMY_HEIGHT, z: 0 },
          gridPosition: { row: TOWER_ROW, col: TOWER_COL },
          health: ENEMY_STATS[EnemyType.FLYING].health,
          maxHealth: ENEMY_STATS[EnemyType.FLYING].health,
          speed: ENEMY_STATS[EnemyType.FLYING].speed,
          value: ENEMY_STATS[EnemyType.FLYING].value,
          leakDamage: ENEMY_STATS[EnemyType.FLYING].leakDamage,
          path: [],
          pathIndex: 0,
          distanceTraveled: 0,
          isFlying: true
        };
        enemyMap.set(flyingEnemy.id, flyingEnemy);

        const initialHealth = flyingEnemy.health;

        // Update past basic tower fire rate
        combatService.update(1.1, combatScene);

        // Should have been damaged
        expect(flyingEnemy.health).toBeLessThan(initialHealth);
      });
    });
  });

  // ---------------------------------------------------------------
  // Mesh
  // ---------------------------------------------------------------
  describe('Mesh', () => {
    it('should use diamond/kite geometry (BufferGeometry with custom vertices)', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      const geometry = enemy.mesh!.geometry as THREE.BufferGeometry;

      // Should be raw BufferGeometry, NOT SphereGeometry
      expect(geometry.type).toBe('BufferGeometry');

      // Diamond has 4 vertices (12 float values for xyz)
      const positions = geometry.getAttribute('position');
      expect(positions.count).toBe(4);

      // And 2 triangles = 6 indices
      const index = geometry.getIndex();
      expect(index).toBeTruthy();
      expect(index!.count).toBe(6);
    });

    it('should use DoubleSide rendering', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      const material = enemy.mesh!.material as THREE.MeshStandardMaterial;

      expect(material.side).toBe(THREE.DoubleSide);
    });

    it('should use correct color from ENEMY_STATS', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      const material = enemy.mesh!.material as THREE.MeshStandardMaterial;

      expect(material.color.getHex()).toBe(ENEMY_STATS[EnemyType.FLYING].color);
    });

    it('should be properly disposed on removal', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      const geometry = enemy.mesh!.geometry;
      const material = enemy.mesh!.material as THREE.Material;

      spyOn(geometry, 'dispose');
      spyOn(material, 'dispose');

      enemyService.removeEnemy(enemy.id, mockScene);

      expect(geometry.dispose).toHaveBeenCalled();
      expect(material.dispose).toHaveBeenCalled();
    });

    it('should be properly disposed on cleanup', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      const geometry = enemy.mesh!.geometry;
      const material = enemy.mesh!.material as THREE.Material;

      spyOn(geometry, 'dispose');
      spyOn(material, 'dispose');

      enemyService.cleanup(mockScene);

      expect(geometry.dispose).toHaveBeenCalled();
      expect(material.dispose).toHaveBeenCalled();
    });

    it('non-flying enemies should use FrontSide rendering', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const material = enemy.mesh!.material as THREE.MeshStandardMaterial;

      expect(material.side).toBe(THREE.FrontSide);
    });
  });

  // ---------------------------------------------------------------
  // Edge Cases
  // ---------------------------------------------------------------
  describe('Edge Cases', () => {
    it('swarm mini-enemies should NOT become flying', () => {
      const swarm = enemyService.spawnEnemy(EnemyType.SWARM, mockScene)!;
      const result = enemyService.damageEnemy(swarm.id, swarm.health);

      expect(result.killed).toBe(true);
      result.spawnedEnemies.forEach(mini => {
        expect(mini.isFlying).toBeFalsy();
        expect(mini.type).toBe(EnemyType.SWARM);
      });
    });

    it('multiple flying enemies can coexist and move independently', () => {
      const flyer1 = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      const flyer2 = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;

      expect(flyer1.id).not.toBe(flyer2.id);
      expect(enemyService.getEnemies().size).toBeGreaterThanOrEqual(2);

      enemyService.updateEnemies(0.1);

      // Both should have moved
      expect(flyer1.distanceTraveled).toBeGreaterThan(0);
      expect(flyer2.distanceTraveled).toBeGreaterThan(0);
    });

    it('flying enemies work with all targeting modes (nearest, first, strongest)', () => {
      // This test ensures that flying enemies have the required properties
      // that the targeting algorithm uses — type, position, health, distanceTraveled
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;

      // All fields used by targeting must be defined
      expect(enemy.position).toBeDefined();
      expect(enemy.health).toBeGreaterThan(0);
      expect(enemy.maxHealth).toBeGreaterThan(0);
      expect(enemy.distanceTraveled).toBeDefined();
      expect(enemy.type).toBe(EnemyType.FLYING);
    });

    it('flying enemy stats match ENEMY_STATS config', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      const stats = ENEMY_STATS[EnemyType.FLYING];

      expect(enemy.health).toBe(stats.health);
      expect(enemy.maxHealth).toBe(stats.health);
      expect(enemy.speed).toBe(stats.speed);
      expect(enemy.value).toBe(stats.value);
    });

    it('dead flying enemies should not move', () => {
      const enemy = enemyService.spawnEnemy(EnemyType.FLYING, mockScene)!;
      const initialPos = { ...enemy.position };

      enemyService.damageEnemy(enemy.id, enemy.maxHealth);
      enemyService.updateEnemies(0.5);

      expect(enemy.position.x).toBe(initialPos.x);
      expect(enemy.position.z).toBe(initialPos.z);
    });
  });
});
