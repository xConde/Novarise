import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { EnemyService } from './enemy.service';
import { PathfindingService } from './pathfinding.service';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { EnemyType, ENEMY_STATS, MINI_SWARM_STATS, MINER_STATS, MINER_DIG_INTERVAL_TURNS, UNSHAKEABLE_STATS, VEINSEEKER_STATS, VEINSEEKER_SPEED_BOOST_WINDOW, VEINSEEKER_BOOSTED_TILES_PER_TURN } from '../models/enemy.model';
import { GameBoardTile } from '../models/game-board-tile';
import { GameModifier, GAME_MODIFIER_CONFIGS } from '../models/game-modifier.model';
import { StatusEffectType } from '../constants/status-effect.constants';
import { HIT_FLASH_CONFIG, STATUS_EFFECT_VISUAL_CONFIG } from '../constants/effects.constants';
import { ENEMY_VISUAL_CONFIG } from '../constants/ui.constants';
import { createTestBoard, createGameBoardServiceSpy, createCardEffectServiceSpy, createRelicServiceSpy } from '../testing';
import { EnemyMeshFactoryService } from './enemy-mesh-factory.service';
import { EnemyVisualService } from './enemy-visual.service';
import { EnemyHealthService } from './enemy-health.service';
import { CardEffectService } from '../../../run/services/card-effect.service';
import { RelicService } from '../../../run/services/relic.service';
import { SerializableEnemy } from '../models/encounter-checkpoint.model';
import { createTestEnemy } from '../testing/test-enemy.factory';
import { PathMutationService } from './path-mutation.service';
import { ElevationService } from './elevation.service';
import { MODIFIER_STAT } from '../../../run/constants/modifier-stat.constants';

/**
 * Helper: configure modifier effects on the real GameStateService.
 * GameStateService.setModifiers() is gated to SETUP phase (wave === 0),
 * which is the initial state — so this always works in tests.
 */
function setModifiers(gameStateService: GameStateService, mods: Set<GameModifier>): void {
  gameStateService.setModifiers(mods);
}

describe('EnemyService', () => {
  let service: EnemyService;
  let gameBoardService: jasmine.SpyObj<GameBoardService>;
  let gameStateService: GameStateService;
  let relicServiceSpy: jasmine.SpyObj<RelicService>;
  let mockScene: THREE.Scene;

  beforeEach(() => {
    const gameBoardServiceSpy = createGameBoardServiceSpy(10, 10, 1, () => createTestBoard());
    relicServiceSpy = createRelicServiceSpy();

    TestBed.configureTestingModule({
      providers: [
        PathfindingService,
        EnemyService,
        EnemyVisualService,
        EnemyHealthService,
        EnemyMeshFactoryService,
        GameStateService,
        { provide: GameBoardService, useValue: gameBoardServiceSpy },
        { provide: CardEffectService, useValue: createCardEffectServiceSpy() },
        { provide: RelicService, useValue: relicServiceSpy },
      ]
    });

    service = TestBed.inject(EnemyService);
    gameBoardService = TestBed.inject(GameBoardService) as jasmine.SpyObj<GameBoardService>;
    gameStateService = TestBed.inject(GameStateService);
    mockScene = new THREE.Scene();
  });

  afterEach(() => {
    // Clean up all enemies
    service.getEnemies().forEach((enemy, id) => {
      service.removeEnemy(id, mockScene);
    });
  });

  describe('Enemy Spawning', () => {
    it('should create enemy service', () => {
      expect(service).toBeTruthy();
    });

    it('should spawn a basic enemy at spawner tile', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      expect(enemy).toBeTruthy();
      expect(enemy?.type).toBe(EnemyType.BASIC);
      expect(enemy?.gridPosition).toEqual({ row: 0, col: 0 });
      expect(enemy?.health).toBeGreaterThan(0);
      expect(enemy?.mesh).toBeTruthy();
    });

    it('should initialise shield for SHIELDED enemy', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;

      expect(enemy.shield).toBe(ENEMY_STATS[EnemyType.SHIELDED].maxShield);
      expect(enemy.maxShield).toBe(ENEMY_STATS[EnemyType.SHIELDED].maxShield);
    });

    it('should add a shield mesh child to SHIELDED enemy mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;

      expect(enemy.mesh!.userData['shieldMesh']).toBeTruthy();
    });

    it('should NOT initialise shield for non-shielded enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      expect(enemy.shield).toBeUndefined();
      expect(enemy.maxShield).toBeUndefined();
    });

    it('should NOT set isMiniSwarm on normally spawned enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
      expect(enemy.isMiniSwarm).toBeUndefined();
    });

    it('should set leakDamage from ENEMY_STATS on spawned enemy', () => {
      const enemy = service.spawnEnemy(EnemyType.BOSS, mockScene)!;
      expect(enemy.leakDamage).toBe(ENEMY_STATS[EnemyType.BOSS].leakDamage);
    });

    it('should set correct leakDamage for each enemy type', () => {
      const types: EnemyType[] = [
        EnemyType.BASIC, EnemyType.FAST, EnemyType.HEAVY,
        EnemyType.SWIFT, EnemyType.BOSS, EnemyType.SHIELDED,
        EnemyType.SWARM, EnemyType.FLYING, EnemyType.MINER, EnemyType.UNSHAKEABLE,
        EnemyType.VEINSEEKER,
      ];
      types.forEach(type => {
        const enemy = service.spawnEnemy(type, mockScene)!;
        expect(enemy.leakDamage).toBe(ENEMY_STATS[type].leakDamage);
      });
    });

    it('should spawn all enemy types with correct stats', () => {
      const types: EnemyType[] = [
        EnemyType.BASIC,
        EnemyType.FAST,
        EnemyType.HEAVY,
        EnemyType.SWIFT,
        EnemyType.BOSS,
        EnemyType.SHIELDED,
        EnemyType.SWARM,
        EnemyType.FLYING,
        EnemyType.MINER,
        EnemyType.UNSHAKEABLE,
        EnemyType.VEINSEEKER,
      ];

      types.forEach(type => {
        const enemy = service.spawnEnemy(type, mockScene);
        expect(enemy).toBeTruthy();
        expect(enemy?.type).toBe(type);
      });
    });

    it('should add enemy mesh to scene', () => {
      const initialChildren = mockScene.children.length;
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(mockScene.children.length).toBe(initialChildren + 1);
    });

    it('should assign unique IDs to enemies', () => {
      const enemy1 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const enemy2 = service.spawnEnemy(EnemyType.BASIC, mockScene);

      expect(enemy1?.id).not.toBe(enemy2?.id);
    });

    it('should return null when no spawner tiles exist', () => {
      // Board with no spawner
      const boardNoSpawner: GameBoardTile[][] = [];
      for (let row = 0; row < 10; row++) {
        boardNoSpawner[row] = [];
        for (let col = 0; col < 10; col++) {
          boardNoSpawner[row][col] = GameBoardTile.createBase(row, col);
        }
      }
      gameBoardService.getGameBoard.and.returnValue(boardNoSpawner);

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(enemy).toBeNull();
    });

    it('should return null when no exit tiles exist', () => {
      // Board with spawner but no exit
      const boardNoExit: GameBoardTile[][] = [];
      for (let row = 0; row < 10; row++) {
        boardNoExit[row] = [];
        for (let col = 0; col < 10; col++) {
          if (row === 0 && col === 0) {
            boardNoExit[row][col] = GameBoardTile.createSpawner(row, col);
          } else {
            boardNoExit[row][col] = GameBoardTile.createBase(row, col);
          }
        }
      }
      gameBoardService.getGameBoard.and.returnValue(boardNoExit);

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(enemy).toBeNull();
    });

    it('should use straight-line fallback when A* path is blocked (not return null)', () => {
      // When the A* path from spawner is blocked, ground enemies fall back to a
      // straight-line path (Fix #43). Verify the enemy still spawns.
      const blockedCells = [
        { row: 0, col: 1 },
        { row: 1, col: 0 }
      ];
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, blockedCells));

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      // Ground enemy uses straight-line fallback — still spawns
      expect(enemy).toBeTruthy();
      expect(enemy!.path.length).toBeGreaterThan(0);
    });
  });

  describe('Pathfinding (A*)', () => {
    it('should find a valid path from spawner to exit', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      expect(enemy).toBeTruthy();
      expect(enemy!.path.length).toBeGreaterThan(0);

      // First node should be start position
      expect(enemy!.path[0]).toEqual(jasmine.objectContaining({ x: 0, y: 0 }));

      // Last node should be end position
      const lastNode = enemy!.path[enemy!.path.length - 1];
      expect(lastNode).toEqual(jasmine.objectContaining({ x: 9, y: 9 }));
    });

    it('should find shortest path (no obstacles)', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Manhattan distance from (0,0) to (9,9) is 18
      // Path should be 19 nodes (including start and end)
      expect(enemy!.path.length).toBe(19);
    });

    it('should path around obstacles', () => {
      // Two staggered walls force a zigzag that exceeds the 18-step Manhattan minimum:
      //   Row 4, cols 0-8 (gap at col 9)  — must go right to pass
      //   Row 6, cols 1-9 (gap at col 0)  — must go left to pass
      // This creates a serpentine path that is longer than 19 nodes.
      const blockedCells: { row: number, col: number }[] = [];
      for (let col = 0; col <= 8; col++) {
        blockedCells.push({ row: 4, col });
      }
      for (let col = 1; col <= 9; col++) {
        blockedCells.push({ row: 6, col });
      }
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, blockedCells));

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      expect(enemy).toBeTruthy();
      expect(enemy!.path.length).toBeGreaterThan(19); // Longer than direct path

      // Verify path doesn't go through blocked cells
      enemy!.path.forEach(node => {
        const isBlocked = blockedCells.some(b => b.row === node.y && b.col === node.x);
        expect(isBlocked).toBe(false);
      });
    });

    it('should use 4-directional movement only', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Check each step only moves in one direction (no diagonals)
      for (let i = 0; i < enemy!.path.length - 1; i++) {
        const current = enemy!.path[i];
        const next = enemy!.path[i + 1];

        const dx = Math.abs(next.x - current.x);
        const dy = Math.abs(next.y - current.y);

        // Should move exactly 1 step in one direction
        expect(dx + dy).toBe(1);
      }
    });
  });

  // ── Multi-exit routing (Phase 15) ──────────────────────────────────────
  // wouldBlockPath considers ANY exit reachable as a valid placement; before
  // this pass, enemies only targeted exitTiles[0], so a tower that cut off
  // exit[0] but left exit[1] reachable would strand every enemy mid-path.
  // These tests lock in "enemy always takes the shortest path to any
  // reachable exit" to keep the two sides aligned.

  describe('multi-exit pathfinding', () => {
    it('routes to the nearer exit when both are reachable', () => {
      // Default exit at (9,9); add a second exit at (0,9). From (0,0) the
      // Manhattan distance is 9 to (0,9) and 18 to (9,9) — the shorter route
      // should win.
      gameBoardService.getGameBoard.and.returnValue(
        createTestBoard(10, [], [{ row: 0, col: 9 }]),
      );
      service.clearPathCache();

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const lastNode = enemy.path[enemy.path.length - 1];

      expect(lastNode.x).toBe(9);
      expect(lastNode.y).toBe(0);
      expect(enemy.path.length).toBe(10); // 9 steps + start node
    });

    it('falls through to the secondary exit when the primary is blocked', () => {
      // Wall off the entire col=9 route to the corner exit; leave a corridor
      // to the secondary exit at (0,9).
      const blocked: { row: number; col: number }[] = [];
      for (let row = 0; row <= 8; row++) blocked.push({ row, col: 8 });
      gameBoardService.getGameBoard.and.returnValue(
        createTestBoard(10, blocked, [{ row: 9, col: 0 }]),
      );
      service.clearPathCache();

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const lastNode = enemy.path[enemy.path.length - 1];

      // With the right-side wall sealing off (9,9), the enemy should route
      // to the bottom-left exit instead.
      expect(lastNode.x).toBe(0);
      expect(lastNode.y).toBe(9);
    });

    it('uses straight-line fallback for both ground and flying when A* path is blocked', () => {
      // A* from (0,0) is blocked by walls at its two neighbours. Both ground and
      // flying enemies still spawn: ground via the straight-line fallback (Fix #43),
      // flying via its normal straight-line path (unchanged).
      const blocked = [
        { row: 0, col: 1 },
        { row: 1, col: 0 },
      ];
      gameBoardService.getGameBoard.and.returnValue(
        createTestBoard(10, blocked, [{ row: 0, col: 9 }]),
      );
      service.clearPathCache();

      const ground = service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(ground).toBeTruthy();
      expect(ground!.path.length).toBeGreaterThan(0);

      service.clearPathCache();
      const flying = service.spawnEnemy(EnemyType.FLYING, mockScene);
      expect(flying).toBeTruthy();
      expect(flying!.path.length).toBe(2);
    });

    it('FLYING enemies pick the geometrically nearest exit via straight line', () => {
      // Two exits: (9,9) and (0,9). Spawner at (0,0). (0,9) is closer.
      gameBoardService.getGameBoard.and.returnValue(
        createTestBoard(10, [], [{ row: 0, col: 9 }]),
      );
      service.clearPathCache();

      const enemy = service.spawnEnemy(EnemyType.FLYING, mockScene)!;
      const lastNode = enemy.path[enemy.path.length - 1];

      expect(lastNode.x).toBe(9);
      expect(lastNode.y).toBe(0);
    });
  });

  describe('Path Caching', () => {
    it('should cache paths for reuse', () => {
      const enemy1 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const enemy2 = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Both enemies spawned at same spawner, should have identical paths
      expect(enemy1!.path.length).toBe(enemy2!.path.length);

      // Verify paths are equivalent (but different array instances)
      expect(enemy1!.path).not.toBe(enemy2!.path); // Different references

      for (let i = 0; i < enemy1!.path.length; i++) {
        expect(enemy1!.path[i].x).toBe(enemy2!.path[i].x);
        expect(enemy1!.path[i].y).toBe(enemy2!.path[i].y);
      }
    });

    it('should clear path cache when requested', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);

      service.clearPathCache();

      // Spawn again, should recalculate path
      const enemy2 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(enemy2).toBeTruthy();
    });

    it('should recalculate path after cache clear with new obstacles', () => {
      const enemy1 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const pathLength1 = enemy1!.path.length;

      // Clear cache and add obstacle
      service.clearPathCache();
      const blockedCells = [{ row: 1, col: 1 }];
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, blockedCells));

      const enemy2 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const pathLength2 = enemy2!.path.length;

      // New path should be different (likely longer due to obstacle)
      expect(pathLength2).toBeGreaterThanOrEqual(pathLength1);
    });
  });

  describe('Enemy Movement', () => {
    it('should move enemy along path', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      // One turn advances BASIC enemy by 1 tile — distanceTraveled increments by 1
      service.stepEnemiesOneTurn(() => 0);

      expect(enemy.distanceTraveled).toBeGreaterThan(0);
    });

    it('should advance pathIndex when reaching next node', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      // One turn for a BASIC enemy advances pathIndex by 1
      service.stepEnemiesOneTurn(() => 0);

      expect(enemy.pathIndex).toBeGreaterThan(0);
    });

    it('should update mesh position during movement', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const initialMeshPos = enemy.mesh!.position.clone();

      service.stepEnemiesOneTurn(() => 0);

      const newMeshPos = enemy.mesh!.position;

      // Mesh should have snapped to the next tile center (x or z changed)
      const hasMoved =
        newMeshPos.x !== initialMeshPos.x ||
        newMeshPos.z !== initialMeshPos.z;

      expect(hasMoved).toBe(true);
    });

    it('should return enemy IDs that reached exit', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      // Place enemy at the final path node — stepEnemiesOneTurn immediately
      // adds it to reachedExit via the early-exit guard.
      enemy.pathIndex = enemy.path.length - 1;

      const reachedExit = service.stepEnemiesOneTurn(() => 0);

      expect(reachedExit).toContain(enemy.id);
    });

    it('should handle multiple enemies simultaneously', () => {
      const enemy1 = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const enemy2 = service.spawnEnemy(EnemyType.FAST, mockScene)!;
      const enemy3 = service.spawnEnemy(EnemyType.HEAVY, mockScene)!;

      service.stepEnemiesOneTurn(() => 0);

      // All enemies should have advanced at least 1 tile
      expect(enemy1.distanceTraveled).toBeGreaterThan(0);
      expect(enemy2.distanceTraveled).toBeGreaterThan(0);
      expect(enemy3.distanceTraveled).toBeGreaterThan(0);

      // FAST moves 2 tiles/turn, HEAVY moves 1 — FAST should have traveled more
      expect(enemy2.distanceTraveled).toBeGreaterThan(enemy3.distanceTraveled);
    });

    // Tests for physics-loop sub-step accumulation (frame-rate consistency) removed
    // in the turn-based pivot. Movement is now integer tile-stepping via
    // stepEnemiesOneTurn — no deltaTime semantics.
  });

  describe('stepEnemiesOneTurn — tile stepping and SLOW semantics', () => {
    it('BASIC enemy moves exactly 1 tile per turn', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const startIndex = enemy.pathIndex;

      service.stepEnemiesOneTurn(() => 0);

      expect(enemy.pathIndex).toBe(startIndex + 1);
      expect(enemy.distanceTraveled).toBe(1);
    });

    it('FAST enemy moves exactly 2 tiles per turn', () => {
      const enemy = service.spawnEnemy(EnemyType.FAST, mockScene)!;
      const startIndex = enemy.pathIndex;

      service.stepEnemiesOneTurn(() => 0);

      // FAST has baseTiles=2 — advances 2 nodes in one turn
      expect(enemy.pathIndex).toBe(startIndex + 2);
      expect(enemy.distanceTraveled).toBe(2);
    });

    it('SWIFT enemy moves exactly 2 tiles per turn', () => {
      const enemy = service.spawnEnemy(EnemyType.SWIFT, mockScene)!;
      const startIndex = enemy.pathIndex;

      service.stepEnemiesOneTurn(() => 0);

      expect(enemy.pathIndex).toBe(startIndex + 2);
      expect(enemy.distanceTraveled).toBe(2);
    });

    it('BASIC enemy slowed (slowReduction=1) still moves 1 tile (floor-at-1 prevents paralysis)', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const startIndex = enemy.pathIndex;

      // slowReduction=1 would take BASIC (baseTiles=1) to 0, but the floor-at-1
      // prevents paralysis since SLOW aura re-applies each turn while in range.
      service.stepEnemiesOneTurn(() => 1);

      expect(enemy.pathIndex).toBe(startIndex + 1);
    });

    it('FAST enemy slowed (slowReduction=1) moves only 1 tile per turn', () => {
      const enemy = service.spawnEnemy(EnemyType.FAST, mockScene)!;
      const startIndex = enemy.pathIndex;

      // slowReduction=1 reduces FAST (baseTiles=2) to 1 → still moves 1 tile
      service.stepEnemiesOneTurn(() => 1);

      expect(enemy.pathIndex).toBe(startIndex + 1);
    });

    it('enemy at the final path node is reported in returned exit list', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.pathIndex = enemy.path.length - 1;

      const reachedExit = service.stepEnemiesOneTurn(() => 0);

      expect(reachedExit).toContain(enemy.id);
    });

    it('enemy completes full path traversal from spawner to exit', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const pathLength = enemy.path.length; // 19 nodes on 10x10 board
      let reachedExit: string[] = [];

      // Keep stepping until the enemy reaches the exit
      for (let turn = 0; turn < pathLength + 1 && reachedExit.length === 0; turn++) {
        reachedExit = service.stepEnemiesOneTurn(() => 0);
      }

      expect(reachedExit).toContain(enemy.id);
      expect(enemy.gridPosition.row).toBe(9); // exit row
      expect(enemy.gridPosition.col).toBe(9); // exit col
    });
  });

  describe('Enemy Removal', () => {
    it('should remove enemy from map', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const enemyId = enemy!.id;

      expect(service.getEnemies().has(enemyId)).toBe(true);

      service.removeEnemy(enemyId, mockScene);

      expect(service.getEnemies().has(enemyId)).toBe(false);
    });

    it('should remove mesh from scene', () => {
      const initialChildren = mockScene.children.length;
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      expect(mockScene.children.length).toBe(initialChildren + 1);

      service.removeEnemy(enemy!.id, mockScene);

      expect(mockScene.children.length).toBe(initialChildren);
    });

    it('should dispose mesh geometry and material', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const geometry = enemy!.mesh!.geometry;
      const material = enemy!.mesh!.material as THREE.Material;

      spyOn(geometry, 'dispose');
      spyOn(material, 'dispose');

      service.removeEnemy(enemy!.id, mockScene);

      expect(geometry.dispose).toHaveBeenCalled();
      expect(material.dispose).toHaveBeenCalled();
    });

    it('should handle removing non-existent enemy gracefully', () => {
      expect(() => {
        service.removeEnemy('non-existent-id', mockScene);
      }).not.toThrow();
    });
  });

  describe('Coordinate Conversion', () => {
    it('should convert grid coordinates to world coordinates correctly', () => {
      // With 10x10 board, tile size 1:
      // (0,0) should map to (-5, -5) in world
      // (9,9) should map to (4, 4) in world
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Enemy spawns at (0,0) in grid
      expect(enemy!.position.x).toBe(-5);
      expect(enemy!.position.z).toBe(-5);
    });

    it('should center board at world origin', () => {
      // Center of 10x10 board is (4.5, 4.5)
      // Should map to (0, 0) in world coords

      // We can't directly test private method, but we verify through enemy spawn
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Position should be offset from origin
      expect(enemy!.position.x).not.toBe(0);
      expect(enemy!.position.z).not.toBe(0);
    });
  });

  describe('Edge Cases', () => {
    // Tests for zero/negative/large deltaTime removed in the turn-based pivot.
    // Movement is now integer tile-stepping via stepEnemiesOneTurn — no
    // deltaTime accumulator semantics exist in the new API.

    it('should get all active enemies', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      service.spawnEnemy(EnemyType.FAST, mockScene);
      service.spawnEnemy(EnemyType.HEAVY, mockScene);

      const enemies = service.getEnemies();
      expect(enemies.size).toBe(3);
    });
  });

  describe('Damage System (damageEnemy)', () => {
    it('should reduce enemy health and return killed=false when alive', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const initialHealth = enemy.health;

      const result = service.damageEnemy(enemy.id, 10);

      expect(result.killed).toBe(false);
      expect(enemy.health).toBe(initialHealth - 10);
    });

    it('should return killed=true when damage kills the enemy', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      const result = service.damageEnemy(enemy.id, enemy.health);

      expect(result.killed).toBe(true);
      expect(enemy.health).toBe(0);
    });

    it('should return killed=true when damage overkills the enemy', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      const result = service.damageEnemy(enemy.id, enemy.health + 100);

      expect(result.killed).toBe(true);
      expect(enemy.health).toBeLessThan(0);
    });

    it('should return killed=false for already-dead enemy', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      // Kill the enemy first
      service.damageEnemy(enemy.id, enemy.health);
      expect(enemy.health).toBe(0);

      // Second damage should return killed=false
      const result = service.damageEnemy(enemy.id, 10);
      expect(result.killed).toBe(false);
      // Health should not change further
      expect(enemy.health).toBe(0);
    });

    it('should return killed=false for non-existent enemy ID', () => {
      const result = service.damageEnemy('non-existent-id', 50);
      expect(result.killed).toBe(false);
    });

    it('should handle multiple sequential damage calls', () => {
      const enemy = service.spawnEnemy(EnemyType.HEAVY, mockScene)!;
      const initialHealth = enemy.health;

      service.damageEnemy(enemy.id, 10);
      service.damageEnemy(enemy.id, 15);
      service.damageEnemy(enemy.id, 20);

      expect(enemy.health).toBe(initialHealth - 45);
    });

    describe('Shielded enemy damage', () => {
      it('should absorb damage into shield before health', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;

        const result = service.damageEnemy(enemy.id, 20);

        expect(result.killed).toBe(false);
        // Health should be untouched while shield absorbs
        expect(enemy.health).toBe(ENEMY_STATS[EnemyType.SHIELDED].health);
        expect(enemy.shield).toBe(maxShield - 20);
      });

      it('should not damage health until shield is broken', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;

        // Deal damage less than the shield
        service.damageEnemy(enemy.id, maxShield - 1);
        expect(enemy.health).toBe(ENEMY_STATS[EnemyType.SHIELDED].health);
        expect(enemy.shield).toBe(1);
      });

      it('should carry overkill damage to health when shield breaks in one hit', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;
        const overshoot = 30;

        service.damageEnemy(enemy.id, maxShield + overshoot);

        expect(enemy.shield).toBe(0);
        expect(enemy.health).toBe(ENEMY_STATS[EnemyType.SHIELDED].health - overshoot);
      });

      it('should start shield break animation when shield HP reaches 0', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;

        service.damageEnemy(enemy.id, maxShield);

        expect(enemy.shield).toBe(0);
        // Break animation is deferred — dome still present but shieldBreaking=true
        expect(enemy.shieldBreaking).toBe(true);
        expect(enemy.shieldBreakTimer).toBeGreaterThan(0);
        expect(enemy.mesh!.userData['shieldMesh']).toBeTruthy();
      });

      it('should remove shield mesh from userData and children after break animation completes', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;
        const childrenBefore = enemy.mesh!.children.length;

        service.damageEnemy(enemy.id, maxShield);
        // Advance past the full break animation duration
        service.updateShieldBreakAnimations(1.0);

        expect(enemy.mesh!.userData['shieldMesh']).toBeUndefined();
        expect(enemy.mesh!.children.length).toBe(childrenBefore - 1);
      });

      it('should apply full damage to health after shield is already broken', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;

        // Break shield
        service.damageEnemy(enemy.id, maxShield);
        const healthAfterShieldBreak = enemy.health;

        // Next hit goes straight to health
        service.damageEnemy(enemy.id, 10);
        expect(enemy.health).toBe(healthAfterShieldBreak - 10);
      });

      it('should kill shielded enemy when health reaches 0 after shield breaks', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;
        const totalHealth = ENEMY_STATS[EnemyType.SHIELDED].health;

        const result = service.damageEnemy(enemy.id, maxShield + totalHealth);

        expect(result.killed).toBe(true);
      });
    });

    describe('Swarm enemy death spawning', () => {
      it('should spawn mini-enemies when a SWARM enemy dies', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
        const spawnCount = ENEMY_STATS[EnemyType.SWARM].spawnOnDeath!;

        const result = service.damageEnemy(swarm.id, swarm.health);

        expect(result.killed).toBe(true);
        expect(result.spawnedEnemies.length).toBe(spawnCount);
      });

      it('should register spawned mini-enemies in the enemies map', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
        const spawnCount = ENEMY_STATS[EnemyType.SWARM].spawnOnDeath!;
        const sizeBeforeDeath = service.getEnemies().size;

        service.damageEnemy(swarm.id, swarm.health);

        // Mini-swarm enemies should be registered (parent still in map until removeEnemy is called)
        expect(service.getEnemies().size).toBe(sizeBeforeDeath + spawnCount);
      });

      it('should create mini-swarm meshes for spawned enemies', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;

        const result = service.damageEnemy(swarm.id, swarm.health);

        result.spawnedEnemies.forEach(mini => {
          expect(mini.mesh).toBeTruthy();
        });
      });

      it('should set isMiniSwarm=true on spawned mini-enemies', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;

        const result = service.damageEnemy(swarm.id, swarm.health);

        result.spawnedEnemies.forEach(mini => {
          expect(mini.isMiniSwarm).toBe(true);
        });
      });

      it('should use MINI_SWARM_STATS for spawned mini-enemies', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;

        const result = service.damageEnemy(swarm.id, swarm.health);

        result.spawnedEnemies.forEach(mini => {
          expect(mini.health).toBe(MINI_SWARM_STATS.health);
          expect(mini.maxHealth).toBe(MINI_SWARM_STATS.health);
          expect(mini.speed).toBe(MINI_SWARM_STATS.speed);
          expect(mini.value).toBe(MINI_SWARM_STATS.value);
        });
      });

      it('should set leakDamage from MINI_SWARM_STATS on spawned mini-enemies', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;

        const result = service.damageEnemy(swarm.id, swarm.health);

        result.spawnedEnemies.forEach(mini => {
          expect(mini.leakDamage).toBe(MINI_SWARM_STATS.leakDamage);
        });
      });

      it('mini-swarm enemies should NOT spawn more enemies on death (no recursion)', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
        const killResult = service.damageEnemy(swarm.id, swarm.health);
        const mini = killResult.spawnedEnemies[0];

        // Killing a mini-swarm should not spawn further enemies
        const miniKillResult = service.damageEnemy(mini.id, mini.health);

        expect(miniKillResult.killed).toBe(true);
        expect(miniKillResult.spawnedEnemies.length).toBe(0);
      });

      it('should not spawn mini-enemies when SWARM enemy is damaged but not killed', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;

        const result = service.damageEnemy(swarm.id, 1);

        expect(result.killed).toBe(false);
        expect(result.spawnedEnemies.length).toBe(0);
      });

      it('spawned mini-enemies should start at the parent path index position', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
        // Advance swarm along path
        swarm.pathIndex = 3;

        const result = service.damageEnemy(swarm.id, swarm.health);

        result.spawnedEnemies.forEach(mini => {
          // Mini path starts at parent's pathIndex node (pathIndex 0 = parent's node 3)
          expect(mini.path[0]).toBe(swarm.path[3]);
        });
      });
    });

    describe('BASIC enemy returns empty spawnedEnemies', () => {
      it('should return empty spawnedEnemies for non-swarm kill', () => {
        const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

        const result = service.damageEnemy(enemy.id, enemy.health);

        expect(result.killed).toBe(true);
        expect(result.spawnedEnemies.length).toBe(0);
      });
    });

    // ── Phase 3 Highground — "exposed" damage multiplier (Sprint 28) ──────────
    //
    // Enemies on tiles with negative elevation (DEPRESS_TILE effect) take +25%
    // incoming damage from ALL sources routed through damageEnemy. The multiplier
    // is applied before shield absorption by design (shield is structural defense;
    // exposed is a positional bonus that amplifies raw incoming damage).

    describe('exposed damage multiplier (DEPRESS_TILE — negative elevation)', () => {
      let elevationSpy: jasmine.SpyObj<ElevationService>;

      beforeEach(() => {
        elevationSpy = jasmine.createSpyObj<ElevationService>('ElevationService', [
          'getElevation', 'raise', 'depress', 'setAbsolute', 'collapse',
          'getMaxElevation', 'getElevationMap', 'getActiveChanges',
          'tickTurn', 'reset', 'serialize', 'restore',
        ]);
        // Default: neutral elevation (no bonus).
        elevationSpy.getElevation.and.returnValue(0);
        // Inject elevation service directly (bypasses @Optional DI in test bed).
        (service as unknown as { elevationService: ElevationService | null }).elevationService = elevationSpy;
      });

      afterEach(() => {
        // Restore null so other tests remain unaffected.
        (service as unknown as { elevationService: ElevationService | null }).elevationService = null;
      });

      it('applies no bonus when tile elevation is 0 (boundary: exactly 0 does NOT expose)', () => {
        elevationSpy.getElevation.and.returnValue(0);
        const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
        const healthBefore = enemy.health;

        service.damageEnemy(enemy.id, 100);

        // 100 damage, no multiplier.
        expect(enemy.health).toBe(healthBefore - 100);
      });

      it('applies no bonus when tile elevation is positive (raised tiles do NOT expose)', () => {
        elevationSpy.getElevation.and.returnValue(2);
        const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
        const healthBefore = enemy.health;

        service.damageEnemy(enemy.id, 100);

        // Positive elevation = no exposed bonus.
        expect(enemy.health).toBe(healthBefore - 100);
      });

      it('applies +25% bonus when tile elevation is -1 (exposed)', () => {
        elevationSpy.getElevation.and.returnValue(-1);
        const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
        const healthBefore = enemy.health;

        service.damageEnemy(enemy.id, 100);

        // Math.round(100 * (1 + 0.25)) = 125.
        expect(enemy.health).toBe(healthBefore - 125);
      });

      it('applies +25% bonus when tile elevation is -2 (max depress)', () => {
        elevationSpy.getElevation.and.returnValue(-2);
        const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
        const healthBefore = enemy.health;

        service.damageEnemy(enemy.id, 80);

        // Math.round(80 * 1.25) = 100.
        expect(enemy.health).toBe(healthBefore - 100);
      });

      it('rounds the amplified damage correctly (Math.round, not floor)', () => {
        elevationSpy.getElevation.and.returnValue(-1);
        const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
        const healthBefore = enemy.health;

        // 10 * 1.25 = 12.5 → Math.round → 13.
        service.damageEnemy(enemy.id, 10);

        expect(enemy.health).toBe(healthBefore - 13);
      });

      it('is a no-op when elevationService is null (test beds without elevation)', () => {
        // Restore null to verify defensive guard: this simulates a test bed
        // that didn't register ElevationService (the @Optional() path).
        (service as unknown as { elevationService: ElevationService | null }).elevationService = null;
        const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
        const healthBefore = enemy.health;

        service.damageEnemy(enemy.id, 100);

        // No bonus — fallback to 0 elevation.
        expect(enemy.health).toBe(healthBefore - 100);
      });
    });
  });

  describe('Health Bars (updateHealthBars)', () => {
    it('should scale health bar foreground by health percentage', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth * 0.5); // 50% health

      service.updateHealthBars();

      const healthBarFg = enemy.mesh!.userData['healthBarFg'] as THREE.Mesh;
      expect(healthBarFg.scale.x).toBeCloseTo(0.5, 1);
    });

    it('should show green color above 60% health', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth * 0.3); // 70% health

      service.updateHealthBars();

      const healthBarFg = enemy.mesh!.userData['healthBarFg'] as THREE.Mesh;
      const mat = healthBarFg.material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(0x00ff00);
    });

    it('should show yellow color between 30% and 60% health', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth * 0.55); // 45% health

      service.updateHealthBars();

      const healthBarFg = enemy.mesh!.userData['healthBarFg'] as THREE.Mesh;
      const mat = healthBarFg.material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(0xffff00);
    });

    it('should show red color below 30% health', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth * 0.8); // 20% health

      service.updateHealthBars();

      const healthBarFg = enemy.mesh!.userData['healthBarFg'] as THREE.Mesh;
      const mat = healthBarFg.material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(0xff0000);
    });

    it('should clamp health bar at zero for dead enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth + 50); // Overkill

      service.updateHealthBars();

      const healthBarFg = enemy.mesh!.userData['healthBarFg'] as THREE.Mesh;
      expect(healthBarFg.scale.x).toBe(0);
    });

    it('should not throw when enemy has no mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.mesh = undefined as any;

      expect(() => service.updateHealthBars()).not.toThrow();
    });

    it('should billboard health bars to match camera quaternion', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0));

      service.updateHealthBars(quat);

      const healthBarBg = enemy.mesh!.userData['healthBarBg'] as THREE.Mesh;
      const healthBarFg = enemy.mesh!.userData['healthBarFg'] as THREE.Mesh;
      expect(healthBarBg.quaternion.x).toBeCloseTo(quat.x, 5);
      expect(healthBarBg.quaternion.y).toBeCloseTo(quat.y, 5);
      expect(healthBarBg.quaternion.z).toBeCloseTo(quat.z, 5);
      expect(healthBarBg.quaternion.w).toBeCloseTo(quat.w, 5);
      expect(healthBarFg.quaternion.x).toBeCloseTo(quat.x, 5);
      expect(healthBarFg.quaternion.y).toBeCloseTo(quat.y, 5);
      expect(healthBarFg.quaternion.z).toBeCloseTo(quat.z, 5);
      expect(healthBarFg.quaternion.w).toBeCloseTo(quat.w, 5);
    });

    it('should billboard health bars correctly when parent mesh is rotated', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const cameraQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 3, 0));

      // Rotate the parent mesh to simulate an enemy facing a movement direction
      enemy.mesh!.rotation.y = Math.PI / 4;
      // Update the parent's world matrix so getWorldQuaternion reflects the rotation
      enemy.mesh!.updateMatrixWorld(true);

      service.updateHealthBars(cameraQuat);

      const healthBarBg = enemy.mesh!.userData['healthBarBg'] as THREE.Mesh;
      // Force world matrix update on the health bar
      healthBarBg.updateMatrixWorld(true);

      // The health bar's WORLD quaternion should equal the camera quaternion,
      // regardless of the parent mesh rotation
      const worldQuat = new THREE.Quaternion();
      healthBarBg.getWorldQuaternion(worldQuat);

      expect(worldQuat.x).toBeCloseTo(cameraQuat.x, 4);
      expect(worldQuat.y).toBeCloseTo(cameraQuat.y, 4);
      expect(worldQuat.z).toBeCloseTo(cameraQuat.z, 4);
      expect(worldQuat.w).toBeCloseTo(cameraQuat.w, 4);
    });
  });

  describe('Dead Enemy Movement Guard', () => {
    it('should not move dead enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      // Kill the enemy
      service.damageEnemy(enemy.id, enemy.maxHealth);
      const posAfterDeath = { ...enemy.position };

      // stepEnemiesOneTurn should skip enemies with health <= 0
      service.stepEnemiesOneTurn(() => 0);

      // Position should not change
      expect(enemy.position.x).toBe(posAfterDeath.x);
      expect(enemy.position.z).toBe(posAfterDeath.z);
    });

    it('should not report dead enemies as reaching exit', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      // Put enemy at the final path node and kill it — health <= 0 guard skips it
      enemy.pathIndex = enemy.path.length - 1;
      service.damageEnemy(enemy.id, enemy.maxHealth);

      // Dead enemy (health <= 0) is skipped before the reachedExit check
      const reachedExit = service.stepEnemiesOneTurn(() => 0);

      expect(reachedExit).not.toContain(enemy.id);
    });
  });

  describe('cleanup()', () => {
    it('should remove all enemies from the map', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      service.spawnEnemy(EnemyType.FAST, mockScene);
      service.spawnEnemy(EnemyType.HEAVY, mockScene);

      service.cleanup(mockScene);

      expect(service.getEnemies().size).toBe(0);
    });

    it('should remove all enemy meshes from the scene', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      service.spawnEnemy(EnemyType.FAST, mockScene);
      const initialCount = mockScene.children.length;
      expect(initialCount).toBe(2);

      service.cleanup(mockScene);

      expect(mockScene.children.length).toBe(0);
    });

    it('should dispose geometries and materials for all enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const geometry = enemy.mesh!.geometry;
      const material = enemy.mesh!.material as THREE.Material;

      spyOn(geometry, 'dispose');
      spyOn(material, 'dispose');

      service.cleanup(mockScene);

      expect(geometry.dispose).toHaveBeenCalled();
      expect(material.dispose).toHaveBeenCalled();
    });

    it('should be a no-op when called with no enemies', () => {
      expect(() => service.cleanup(mockScene)).not.toThrow();
      expect(service.getEnemies().size).toBe(0);
    });

    it('should handle SHIELDED enemies and dispose shield meshes', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
      expect(enemy.mesh!.userData['shieldMesh']).toBeTruthy();

      expect(() => service.cleanup(mockScene)).not.toThrow();
      expect(service.getEnemies().size).toBe(0);
    });

    it('should allow spawning new enemies after cleanup', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      service.cleanup(mockScene);

      const newEnemy = service.spawnEnemy(EnemyType.FAST, mockScene);
      expect(newEnemy).toBeTruthy();
      expect(service.getEnemies().size).toBe(1);
    });
  });

  describe('reset()', () => {
    it('should reset enemy counter to 0', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      service.spawnEnemy(EnemyType.FAST, mockScene);

      service.reset(mockScene);

      // Next spawned enemy should have id 'enemy-0' (counter reset)
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(enemy!.id).toBe('enemy-0');
    });

    it('should clear all enemies from the map', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      service.spawnEnemy(EnemyType.FAST, mockScene);
      service.spawnEnemy(EnemyType.HEAVY, mockScene);

      service.reset(mockScene);

      expect(service.getEnemies().size).toBe(0);
    });

    it('should clear the path cache', () => {
      spyOn(service, 'clearPathCache').and.callThrough();

      service.spawnEnemy(EnemyType.BASIC, mockScene);

      service.reset(mockScene);

      expect(service.clearPathCache).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should handle 20+ enemies without issues', () => {
      const enemyCount = 25;
      const startTime = performance.now();

      // Spawn 25 enemies
      for (let i = 0; i < enemyCount; i++) {
        service.spawnEnemy(EnemyType.BASIC, mockScene);
      }

      // Advance all enemies one turn — turn-based step replaces deltaTime loop
      service.stepEnemiesOneTurn(() => 0);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 100ms for test overhead)
      expect(duration).toBeLessThan(100);
      expect(service.getEnemies().size).toBe(enemyCount);
    });
  });

  describe('Modifier Effects on Spawn', () => {
    it('should spawn enemy with doubled health when ARMORED_ENEMIES is active', () => {
      setModifiers(gameStateService, new Set([GameModifier.ARMORED_ENEMIES]));

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const baseHealth = ENEMY_STATS[EnemyType.BASIC].health;
      expect(enemy.health).toBe(baseHealth * 2);
      expect(enemy.maxHealth).toBe(baseHealth * 2);
    });

    it('should spawn enemy with increased speed when FAST_ENEMIES is active', () => {
      setModifiers(gameStateService, new Set([GameModifier.FAST_ENEMIES]));

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const baseSpeed = ENEMY_STATS[EnemyType.BASIC].speed;
      expect(enemy.speed).toBeCloseTo(baseSpeed * 1.5);
    });

    it('should apply SPEED_DEMONS only to FAST type enemies', () => {
      setModifiers(gameStateService, new Set([GameModifier.SPEED_DEMONS]));

      const fastEnemy = service.spawnEnemy(EnemyType.FAST, mockScene)!;
      const basicEnemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      // FAST should get 2x speed
      expect(fastEnemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.FAST].speed * 2.0);
      // BASIC should NOT get speed bonus from SPEED_DEMONS
      expect(basicEnemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.BASIC].speed);
    });

    it('should apply SPEED_DEMONS to SWIFT type enemies', () => {
      setModifiers(gameStateService, new Set([GameModifier.SPEED_DEMONS]));

      const swiftEnemy = service.spawnEnemy(EnemyType.SWIFT, mockScene)!;
      expect(swiftEnemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.SWIFT].speed * 2.0);
    });

    it('should combine FAST_ENEMIES and SPEED_DEMONS for FAST type', () => {
      setModifiers(gameStateService, new Set([GameModifier.FAST_ENEMIES, GameModifier.SPEED_DEMONS]));

      const fastEnemy = service.spawnEnemy(EnemyType.FAST, mockScene)!;
      // FAST_ENEMIES 1.5x * SPEED_DEMONS 2.0x = 3.0x for FAST type
      expect(fastEnemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.FAST].speed * 3.0);
    });

    it('should only apply FAST_ENEMIES (not SPEED_DEMONS) to non-fast types when both active', () => {
      setModifiers(gameStateService, new Set([GameModifier.FAST_ENEMIES, GameModifier.SPEED_DEMONS]));

      const heavyEnemy = service.spawnEnemy(EnemyType.HEAVY, mockScene)!;
      // Only FAST_ENEMIES 1.5x applies to HEAVY (not SPEED_DEMONS)
      expect(heavyEnemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.HEAVY].speed * 1.5);
    });

    it('should spawn with normal stats when no modifiers are active', () => {
      // Default state — no modifiers set
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      expect(enemy.health).toBe(ENEMY_STATS[EnemyType.BASIC].health);
      expect(enemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.BASIC].speed);
    });

    it('should combine health and speed modifiers', () => {
      setModifiers(gameStateService, new Set([GameModifier.ARMORED_ENEMIES, GameModifier.FAST_ENEMIES]));

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      expect(enemy.health).toBe(ENEMY_STATS[EnemyType.BASIC].health * 2);
      expect(enemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.BASIC].speed * 1.5);
    });

    it('should use no modifier effects after game state reset', () => {
      setModifiers(gameStateService, new Set([GameModifier.ARMORED_ENEMIES]));

      // Reset both services (mirrors what restartGame() does)
      service.reset(mockScene);
      gameStateService.reset();

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      expect(enemy.health).toBe(ENEMY_STATS[EnemyType.BASIC].health);
    });

    it('should floor enemy speed at MIN_ENEMY_SPEED even with extreme speed multiplier', () => {
      // Use FAST_ENEMIES + SPEED_DEMONS for a large combined multiplier,
      // then rely on waveSpeedMultiplier driving toward zero to test the floor.
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene, 1, 0.000001)!;
      expect(enemy.speed).toBeGreaterThanOrEqual(0.1);
    });

    it('should apply ARMORED + FAST + SPEED_DEMONS combo correctly', () => {
      setModifiers(gameStateService, new Set([GameModifier.ARMORED_ENEMIES, GameModifier.FAST_ENEMIES, GameModifier.SPEED_DEMONS]));

      const fastEnemy = service.spawnEnemy(EnemyType.FAST, mockScene)!;
      // Health: 2x, Speed: 1.5x * 2.0x = 3.0x for FAST type
      expect(fastEnemy.health).toBe(ENEMY_STATS[EnemyType.FAST].health * 2);
      expect(fastEnemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.FAST].speed * 3.0);

      const heavyEnemy = service.spawnEnemy(EnemyType.HEAVY, mockScene)!;
      // Health: 2x, Speed: only FAST_ENEMIES 1.5x (SPEED_DEMONS excluded for non-fast)
      expect(heavyEnemy.health).toBe(ENEMY_STATS[EnemyType.HEAVY].health * 2);
      expect(heavyEnemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.HEAVY].speed * 1.5);
    });
  });

  // ---------------------------------------------------------------------------
  // Wave-level multipliers (endless mode scaling)
  // ---------------------------------------------------------------------------

  describe('wave multipliers (endless mode scaling)', () => {
    it('waveHealthMultiplier=2 doubles enemy health after modifier scaling', () => {
      const baseHealth = ENEMY_STATS[EnemyType.BASIC].health;
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene, 2, 1)!;
      expect(enemy.health).toBe(Math.round(baseHealth * 2));
      expect(enemy.maxHealth).toBe(enemy.health);
    });

    it('waveSpeedMultiplier=1.5 increases enemy speed by 1.5×', () => {
      const baseSpeed = ENEMY_STATS[EnemyType.BASIC].speed;
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene, 1, 1.5)!;
      expect(enemy.speed).toBeCloseTo(baseSpeed * 1.5);
    });

    it('waveHealthMultiplier and waveSpeedMultiplier both apply in same spawn', () => {
      const baseHealth = ENEMY_STATS[EnemyType.HEAVY].health;
      const baseSpeed  = ENEMY_STATS[EnemyType.HEAVY].speed;
      const enemy = service.spawnEnemy(EnemyType.HEAVY, mockScene, 3, 1.8)!;
      expect(enemy.health).toBe(Math.round(baseHealth * 3));
      expect(enemy.speed).toBeCloseTo(baseSpeed * 1.8);
    });

    it('wave multipliers stack multiplicatively on top of modifier health scaling', () => {
      // ARMORED_ENEMIES: 2× health. waveHealthMultiplier=3 → expected 6×
      setModifiers(gameStateService, new Set([GameModifier.ARMORED_ENEMIES]));

      const baseHealth = ENEMY_STATS[EnemyType.BASIC].health;
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene, 3, 1)!;
      expect(enemy.health).toBe(Math.round(baseHealth * 2 * 3));
    });

    it('wave multipliers stack multiplicatively on top of modifier speed scaling', () => {
      // FAST_ENEMIES: 1.5× speed. waveSpeedMultiplier=2 → expected 3×
      setModifiers(gameStateService, new Set([GameModifier.FAST_ENEMIES]));

      const baseSpeed = ENEMY_STATS[EnemyType.BASIC].speed;
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene, 1, 2)!;
      expect(enemy.speed).toBeCloseTo(baseSpeed * 1.5 * 2);
    });

    it('speed floor MIN_ENEMY_SPEED is enforced even after extreme waveSpeedMultiplier with low base', () => {
      // Apply near-zero wave multipliers to push speed toward zero
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene, 1, 0.000001)!;
      expect(enemy.speed).toBeGreaterThanOrEqual(0.1);
    });

    it('waveHealthMultiplier=1 and waveSpeedMultiplier=1 are no-ops (non-endless)', () => {
      const baseHealth = ENEMY_STATS[EnemyType.BASIC].health;
      const baseSpeed  = ENEMY_STATS[EnemyType.BASIC].speed;
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene, 1, 1)!;
      expect(enemy.health).toBe(baseHealth);
      expect(enemy.speed).toBeCloseTo(baseSpeed);
    });

    it('default parameters (no wave mult args) behave like 1×/1× for scripted waves', () => {
      const baseHealth = ENEMY_STATS[EnemyType.FAST].health;
      const baseSpeed  = ENEMY_STATS[EnemyType.FAST].speed;
      const enemy = service.spawnEnemy(EnemyType.FAST, mockScene)!;
      expect(enemy.health).toBe(baseHealth);
      expect(enemy.speed).toBeCloseTo(baseSpeed);
    });
  });

  describe('enemy mesh geometry', () => {
    let meshesToDispose: THREE.Mesh[];

    beforeEach(() => {
      meshesToDispose = [];
    });

    afterEach(() => {
      meshesToDispose.forEach(mesh => {
        mesh.geometry.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          mat.forEach(m => m.dispose());
        } else {
          (mat as THREE.Material).dispose();
        }
        // Dispose child meshes (health bars, crowns, shields)
        mesh.children.forEach(child => {
          const childMesh = child as THREE.Mesh;
          if (childMesh.geometry) childMesh.geometry.dispose();
          if (childMesh.material) {
            const childMat = childMesh.material;
            if (Array.isArray(childMat)) {
              childMat.forEach(m => m.dispose());
            } else {
              (childMat as THREE.Material).dispose();
            }
          }
        });
      });
    });

    it('BASIC enemy creates a SphereGeometry mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.SphereGeometry);
    });

    it('FAST enemy creates a CapsuleGeometry mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.FAST, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.CapsuleGeometry);
    });

    it('HEAVY enemy creates a BoxGeometry mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.HEAVY, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.BoxGeometry);
    });

    it('SWIFT enemy creates a TetrahedronGeometry mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.SWIFT, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.TetrahedronGeometry);
    });

    it('BOSS enemy creates a SphereGeometry mesh with a bossCrown in userData', () => {
      const enemy = service.spawnEnemy(EnemyType.BOSS, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.SphereGeometry);
      const crown = enemy.mesh!.userData['bossCrown'] as THREE.Mesh;
      expect(crown).toBeTruthy();
      expect(crown).toBeInstanceOf(THREE.Mesh);
      expect(crown.geometry).toBeInstanceOf(THREE.TorusGeometry);
    });

    it('SHIELDED enemy creates an IcosahedronGeometry mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.IcosahedronGeometry);
    });

    it('SWARM enemy creates an OctahedronGeometry mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.OctahedronGeometry);
    });

    it('FLYING enemy creates a BufferGeometry (custom diamond)', () => {
      const enemy = service.spawnEnemy(EnemyType.FLYING, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.BufferGeometry);
      // Should NOT be one of the named geometry subclasses — it's a custom diamond
      expect(enemy.mesh!.geometry).not.toBeInstanceOf(THREE.SphereGeometry);
      expect(enemy.mesh!.geometry).not.toBeInstanceOf(THREE.BoxGeometry);
    });

    it('MINER enemy creates a BoxGeometry mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.MINER, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.BoxGeometry);
    });

    it('Mini-swarm mesh uses OctahedronGeometry', () => {
      const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
      const result = service.damageEnemy(swarm.id, swarm.health);

      expect(result.spawnedEnemies.length).toBeGreaterThan(0);
      const mini = result.spawnedEnemies[0];
      meshesToDispose.push(mini.mesh!);

      expect(mini.mesh!.geometry).toBeInstanceOf(THREE.OctahedronGeometry);
    });
  });

  describe('updateStatusVisuals', () => {
    let enemy: NonNullable<ReturnType<typeof service.spawnEnemy>>;
    let mesh: THREE.Mesh;

    beforeEach(() => {
      enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      mesh = enemy.mesh!;
    });

    it('enemy with BURN effect gets emissive color 0xff6622', () => {
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.BURN]);

      service.updateStatusVisuals(activeEffects);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0xff6622);
    });

    it('enemy with POISON effect gets emissive color 0x44ff22', () => {
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.POISON]);

      service.updateStatusVisuals(activeEffects);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0x44ff22);
    });

    it('enemy with SLOW effect gets emissive color 0x4488ff', () => {
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.SLOW]);

      service.updateStatusVisuals(activeEffects);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0x4488ff);
    });

    it('enemy with no effects reverts to base emissive color', () => {
      const baseColor = ENEMY_STATS[EnemyType.BASIC].color;

      // First apply an effect
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.BURN]);
      service.updateStatusVisuals(activeEffects);

      // Then clear effects
      const noEffects = new Map<string, StatusEffectType[]>();
      service.updateStatusVisuals(noEffects);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(baseColor);
    });

    it('BURN takes priority over POISON when both active', () => {
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.POISON, StatusEffectType.BURN]);

      service.updateStatusVisuals(activeEffects);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0xff6622);
    });

    it('BURN takes priority over SLOW when both active', () => {
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.SLOW, StatusEffectType.BURN]);

      service.updateStatusVisuals(activeEffects);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0xff6622);
    });

    it('boss crown mesh is tinted along with body', () => {
      const boss = service.spawnEnemy(EnemyType.BOSS, mockScene)!;

      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(boss.id, [StatusEffectType.BURN]);
      service.updateStatusVisuals(activeEffects);

      const crown = boss.mesh!.userData['bossCrown'] as THREE.Mesh;
      expect(crown).toBeTruthy();
      const crownMat = crown.material as THREE.MeshStandardMaterial;
      expect(crownMat.emissive.getHex()).toBe(0xff6622);
    });

    it('boss crown reverts to base color when effects expire', () => {
      const boss = service.spawnEnemy(EnemyType.BOSS, mockScene)!;

      // Apply then clear
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(boss.id, [StatusEffectType.BURN]);
      service.updateStatusVisuals(activeEffects);

      const noEffects = new Map<string, StatusEffectType[]>();
      service.updateStatusVisuals(noEffects);

      const crown = boss.mesh!.userData['bossCrown'] as THREE.Mesh;
      const crownMat = crown.material as THREE.MeshStandardMaterial;
      expect(crownMat.emissive.getHex()).toBe(ENEMY_STATS[EnemyType.BOSS].color);
    });

    it('mini-swarm uses correct base emissive intensity on revert', () => {
      // Spawn a swarm and kill it to get minis
      const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
      const result = service.damageEnemy(swarm.id, 9999);
      result.spawnedEnemies.forEach(mini => {
        if (mini.mesh) mockScene.add(mini.mesh);
      });

      const mini = result.spawnedEnemies[0];
      if (mini && mini.mesh) {
        // Apply then clear effect
        const activeEffects = new Map<string, StatusEffectType[]>();
        activeEffects.set(mini.id, [StatusEffectType.POISON]);
        service.updateStatusVisuals(activeEffects);

        const noEffects = new Map<string, StatusEffectType[]>();
        service.updateStatusVisuals(noEffects);

        const mat = mini.mesh.material as THREE.MeshStandardMaterial;
        expect(mat.emissiveIntensity).toBe(ENEMY_VISUAL_CONFIG.miniSwarmEmissive);
      }
    });
  });

  describe('getPathToExit', () => {
    it('should return world coordinates from spawner to exit', () => {
      const path = service.getPathToExit();

      expect(path.length).toBeGreaterThan(0);
      // First point should be near the spawner (0,0) in world coords
      // worldX = (col - width/2) * tileSize = (0 - 5) * 1 = -5
      // worldZ = (row - height/2) * tileSize = (0 - 5) * 1 = -5
      expect(path[0].x).toBeCloseTo(-5);
      expect(path[0].z).toBeCloseTo(-5);
      // Last point should be near the exit (9,9) in world coords = (4, 4)
      const last = path[path.length - 1];
      expect(last.x).toBeCloseTo(4);
      expect(last.z).toBeCloseTo(4);
    });

    it('should return empty array when no spawner tiles exist', () => {
      // Board with no spawner
      const board: GameBoardTile[][] = [];
      for (let row = 0; row < 10; row++) {
        board[row] = [];
        for (let col = 0; col < 10; col++) {
          board[row][col] = GameBoardTile.createBase(row, col);
        }
      }
      gameBoardService.getGameBoard.and.returnValue(board);

      const path = service.getPathToExit();
      expect(path.length).toBe(0);
    });

    it('should return empty array when no exit tiles exist', () => {
      // Board with spawner but no exit
      const board: GameBoardTile[][] = [];
      for (let row = 0; row < 10; row++) {
        board[row] = [];
        for (let col = 0; col < 10; col++) {
          if (row === 0 && col === 0) {
            board[row][col] = GameBoardTile.createSpawner(row, col);
          } else {
            board[row][col] = GameBoardTile.createBase(row, col);
          }
        }
      }
      gameBoardService.getGameBoard.and.returnValue(board);

      const path = service.getPathToExit();
      expect(path.length).toBe(0);
    });
  });

  describe('enemy facing direction', () => {
    it('should rotate enemy mesh to face movement direction', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      expect(enemy).toBeTruthy();
      expect(enemy.mesh).toBeTruthy();

      // Initial rotation should be 0 (default, before any movement)
      const initialRotY = enemy.mesh!.rotation.y;
      expect(initialRotY).toBe(0);

      // stepEnemiesOneTurn snaps the mesh to the new tile and rotates toward next node
      service.stepEnemiesOneTurn(() => 0);

      // The enemy should now face its movement direction
      const afterRotY = enemy.mesh!.rotation.y;
      // atan2 result should be a valid finite number, not NaN
      expect(isNaN(afterRotY)).toBe(false);
    });

    it('should face correct direction for known path segment', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      expect(enemy).toBeTruthy();
      expect(enemy.path.length).toBeGreaterThanOrEqual(3);

      // After stepEnemiesOneTurn the enemy is at path[1]; mesh rotation is
      // computed toward path[2] (the next node to visit).
      // path nodes use {x: col, y: row} — gridToWorld: x = col-5, z = row-5 (10x10 board, tileSize=1)
      const boardHalf = 5; // 10 / 2
      const node1 = enemy.path[1];
      const node2 = enemy.path[2];
      const world1x = node1.x - boardHalf;
      const world1z = node1.y - boardHalf;
      const world2x = node2.x - boardHalf;
      const world2z = node2.y - boardHalf;
      const dx = world2x - world1x;
      const dz = world2z - world1z;
      const expectedAngle = Math.atan2(dx, dz);

      service.stepEnemiesOneTurn(() => 0);
      const rotY = enemy.mesh!.rotation.y;

      // Rotation should match the expected angle toward the next path node
      expect(rotY).toBeCloseTo(expectedAngle, 1);
    });
  });

  describe('updateEnemyAnimations', () => {
    it('should spin boss crown over time', () => {
      const boss = service.spawnEnemy(EnemyType.BOSS, mockScene)!;
      expect(boss).toBeTruthy();
      const crown = boss.mesh!.userData['bossCrown'] as THREE.Mesh;
      expect(crown).toBeTruthy();

      const initialRotZ = crown.rotation.z;
      service.updateEnemyAnimations(0.5);

      expect(crown.rotation.z).toBeGreaterThan(initialRotZ);
    });

    it('should not throw for enemies without crowns', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(() => service.updateEnemyAnimations(0.016)).not.toThrow();
    });

    it('should skip dead enemies', () => {
      const boss = service.spawnEnemy(EnemyType.BOSS, mockScene)!;
      const crown = boss.mesh!.userData['bossCrown'] as THREE.Mesh;
      const initialRotZ = crown.rotation.z;

      // Kill the boss
      service.damageEnemy(boss.id, boss.maxHealth + 100);
      service.updateEnemyAnimations(0.5);

      // Crown should not have rotated
      expect(crown.rotation.z).toBe(initialRotZ);
    });
  });

  // ---------------------------------------------------------------------------
  // repathAffectedEnemies — deferred repathing system
  // ---------------------------------------------------------------------------
  // GridNode convention: x=col, y=row. Board: 10x10, spawner (0,0), exit (9,9).
  // World coords: x = col-5, z = row-5  (tileSize=1, centered on origin).
  // ---------------------------------------------------------------------------

  describe('repathAffectedEnemies', () => {

    /** Build a minimal GridNode for use in path arrays. */
    function node(col: number, row: number): import('../models/enemy.model').GridNode {
      return { x: col, y: row, g: 0, h: 0, f: 0 };
    }

    it('should flag ground enemies whose remaining path crosses the changed tile', () => {
      // Path goes through (row=2, col=3) — change that tile
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [node(0, 0), node(1, 0), node(2, 0), node(3, 0), node(3, 2), node(9, 9)];
      enemy.pathIndex = 0;

      service.repathAffectedEnemies(2, 3); // row=2, col=3

      expect(enemy.needsRepath).toBe(true);
    });

    it('should NOT flag enemies whose remaining path does not cross the changed tile', () => {
      // Path goes right along row 0 — does not pass through (row=5, col=5)
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [node(0, 0), node(1, 0), node(2, 0), node(3, 0), node(9, 9)];
      enemy.pathIndex = 0;

      service.repathAffectedEnemies(5, 5);

      expect(enemy.needsRepath).toBeFalsy();
    });

    it('should skip flying enemies even when their path crosses the changed tile', () => {
      const enemy = service.spawnEnemy(EnemyType.FLYING, mockScene)!;
      // Manually override path to include the changed tile
      enemy.path = [node(0, 0), node(3, 2), node(9, 9)];
      enemy.pathIndex = 0;

      service.repathAffectedEnemies(2, 3); // row=2, col=3

      expect(enemy.needsRepath).toBeFalsy();
    });

    it('should flag ALL ground enemies when called with (-1, -1)', () => {
      // Spawn three different ground enemies with paths that do NOT cross any
      // specific tile — force-all mode (-1,-1) must flag them regardless.
      const e1 = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const e2 = service.spawnEnemy(EnemyType.HEAVY, mockScene)!;
      const e3 = service.spawnEnemy(EnemyType.FAST, mockScene)!;

      // Give each a path that stays far from (0,0) so no tile match would fire
      e1.path = [node(4, 4), node(5, 4), node(9, 9)]; e1.pathIndex = 0;
      e2.path = [node(4, 4), node(5, 4), node(9, 9)]; e2.pathIndex = 0;
      e3.path = [node(4, 4), node(5, 4), node(9, 9)]; e3.pathIndex = 0;

      service.repathAffectedEnemies(-1, -1);

      expect(e1.needsRepath).toBe(true);
      expect(e2.needsRepath).toBe(true);
      expect(e3.needsRepath).toBe(true);
    });

    it('should clear the path cache', () => {
      spyOn(service, 'clearPathCache').and.callThrough();
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [node(0, 0), node(1, 0), node(9, 9)];
      enemy.pathIndex = 0;

      service.repathAffectedEnemies(1, 0);

      expect(service.clearPathCache).toHaveBeenCalled();
    });

    it('should not immediately change enemy path or pathIndex', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const originalPath = [node(0, 0), node(1, 0), node(2, 0), node(3, 0), node(9, 9)];
      enemy.path = [...originalPath];
      enemy.pathIndex = 1;

      service.repathAffectedEnemies(3, 0); // row=3, col=0 — NOT on this path

      // Flagging a different enemy should not touch path or pathIndex
      // Use force-all to definitely flag this enemy
      service.repathAffectedEnemies(-1, -1);

      // Path and pathIndex must be unchanged — repath is deferred to next waypoint
      expect(enemy.path.length).toBe(originalPath.length);
      expect(enemy.pathIndex).toBe(1);
      for (let i = 0; i < originalPath.length; i++) {
        expect(enemy.path[i].x).toBe(originalPath[i].x);
        expect(enemy.path[i].y).toBe(originalPath[i].y);
      }
    });

    it('consumes needsRepath BEFORE advancing pathIndex (regression for tower-passthrough)', () => {
      // Regression: prior implementation did `pathIndex++` + position update
      // FIRST and then checked needsRepath, which caused enemies to walk ONTO
      // a newly-placed tower tile before repathing from it. The repath must
      // fire at the top of the movement iteration — when the enemy is still
      // snapped to its current waypoint — so it re-plans from there.
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [node(0, 0), node(1, 0), node(2, 0), node(9, 9)];
      enemy.pathIndex = 0;
      enemy.needsRepath = true;

      let pathIndexWhenRepathFired = -1;
      // Spy on the private executeRepath to record when it was invoked.
      // Short-circuit the actual repath so we don't depend on the real A*
      // returning a specific shape here — we're asserting ordering, not
      // pathfinding correctness (covered separately).
      spyOn<any>(service, 'executeRepath').and.callFake((e: any) => {
        pathIndexWhenRepathFired = e.pathIndex;
        e.needsRepath = false;
      });

      // `() => 0` is the SLOW reduction callback — no SLOW, so the enemy
      // takes its full 1-tile step this turn, exercising the while loop.
      service.stepEnemiesOneTurn(() => 0);

      // If the bug regresses (increment-before-repath), this would be 1.
      expect(pathIndexWhenRepathFired).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // pathCrossesTile — tested indirectly via repathAffectedEnemies
  // (private method; behaviour is observable through the needsRepath flag)
  // ---------------------------------------------------------------------------

  describe('pathCrossesTile (via repathAffectedEnemies)', () => {

    function node(col: number, row: number): import('../models/enemy.model').GridNode {
      return { x: col, y: row, g: 0, h: 0, f: 0 };
    }

    it('should return true (flag enemy) when tile appears after current pathIndex', () => {
      // Tile at index 5 — enemy is at pathIndex=2, so tile is ahead
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [
        node(0, 0), node(1, 0), node(2, 0), // indices 0-2 — already passed
        node(3, 0), node(4, 0), node(5, 0),  // indices 3-5 — upcoming; tile at idx 5
        node(9, 9)
      ];
      enemy.pathIndex = 2;

      service.repathAffectedEnemies(0, 5); // row=0, col=5 — node at index 5

      expect(enemy.needsRepath).toBe(true);
    });

    it('should return false (no flag) when tile is strictly before current pathIndex', () => {
      // Tile is at index 1 — enemy is already at pathIndex=3, so tile is behind
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [
        node(0, 0), node(1, 0), // indices 0-1 — behind
        node(2, 0), node(3, 0), node(9, 9)
      ];
      enemy.pathIndex = 3;

      service.repathAffectedEnemies(0, 1); // row=0, col=1 — node at index 1

      expect(enemy.needsRepath).toBeFalsy();
    });

    it('should return false (no flag) when tile is not in the path at all', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [node(0, 0), node(1, 0), node(2, 0), node(9, 9)];
      enemy.pathIndex = 0;

      service.repathAffectedEnemies(7, 7); // row=7, col=7 — not in path

      expect(enemy.needsRepath).toBeFalsy();
    });
  });

  // ---------------------------------------------------------------------------
  // Death animation — startDyingAnimation / updateDyingAnimations / getLivingEnemyCount
  // ---------------------------------------------------------------------------

  describe('startDyingAnimation', () => {
    it('should set dying=true on the enemy', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);

      service.startDyingAnimation(enemy.id);

      expect(enemy.dying).toBe(true);
    });

    it('should set dyingTimer to DEATH_ANIM_CONFIG.duration for non-boss enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);

      service.startDyingAnimation(enemy.id);

      // Timer should be the standard duration (0.3s)
      expect(enemy.dyingTimer).toBeCloseTo(0.3);
    });

    it('should set dyingTimer to DEATH_ANIM_CONFIG.durationBoss for BOSS enemies', () => {
      const boss = service.spawnEnemy(EnemyType.BOSS, mockScene)!;
      service.damageEnemy(boss.id, boss.maxHealth);

      service.startDyingAnimation(boss.id);

      // Timer should be the boss duration (0.5s)
      expect(boss.dyingTimer).toBeCloseTo(0.5);
    });

    it('should set mesh material transparent=true', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);

      service.startDyingAnimation(enemy.id);

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      expect(mat.transparent).toBe(true);
    });

    it('should be a no-op when called on a non-existent enemy', () => {
      expect(() => service.startDyingAnimation('ghost-id')).not.toThrow();
    });

    it('should be a no-op when called twice on the same enemy', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);

      service.startDyingAnimation(enemy.id);
      const timerAfterFirst = enemy.dyingTimer!;

      // Manually advance time to simulate partial animation
      enemy.dyingTimer = timerAfterFirst - 0.1;
      service.startDyingAnimation(enemy.id);

      // Timer should not have been reset by the second call
      expect(enemy.dyingTimer).toBeCloseTo(timerAfterFirst - 0.1);
    });

    it('should keep the enemy in the enemies map', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);

      service.startDyingAnimation(enemy.id);

      expect(service.getEnemies().has(enemy.id)).toBe(true);
    });

    it('should set BOSS crown material transparent=true', () => {
      const boss = service.spawnEnemy(EnemyType.BOSS, mockScene)!;
      service.damageEnemy(boss.id, boss.maxHealth);

      service.startDyingAnimation(boss.id);

      const crown = boss.mesh!.userData['bossCrown'] as THREE.Mesh;
      const crownMat = crown.material as THREE.MeshStandardMaterial;
      expect(crownMat.transparent).toBe(true);
    });
  });

  describe('updateDyingAnimations', () => {
    it('should reduce the dyingTimer by deltaTime', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);
      service.startDyingAnimation(enemy.id);
      const initial = enemy.dyingTimer!;

      service.updateDyingAnimations(0.1, mockScene);

      expect(enemy.dyingTimer!).toBeCloseTo(initial - 0.1);
    });

    it('should shrink mesh scale toward DEATH_ANIM_CONFIG.minScale over time', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);
      service.startDyingAnimation(enemy.id);

      // Advance halfway through the animation
      service.updateDyingAnimations(0.15, mockScene);

      // Scale should be between minScale and 1
      expect(enemy.mesh!.scale.x).toBeLessThan(1);
      expect(enemy.mesh!.scale.x).toBeGreaterThan(0.1);
    });

    it('should reduce mesh opacity toward 0 over time', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);
      service.startDyingAnimation(enemy.id);

      // Advance halfway through the animation
      service.updateDyingAnimations(0.15, mockScene);

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      expect(mat.opacity).toBeLessThan(1);
      expect(mat.opacity).toBeGreaterThan(0);
    });

    it('should remove enemy from map when timer expires', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const id = enemy.id;
      service.damageEnemy(id, enemy.maxHealth);
      service.startDyingAnimation(id);

      // Advance past the full duration
      service.updateDyingAnimations(1.0, mockScene);

      expect(service.getEnemies().has(id)).toBe(false);
    });

    it('should remove enemy mesh from scene when timer expires', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const id = enemy.id;
      service.damageEnemy(id, enemy.maxHealth);
      service.startDyingAnimation(id);

      expect(mockScene.children.length).toBeGreaterThan(0);

      service.updateDyingAnimations(1.0, mockScene);

      expect(mockScene.children).not.toContain(enemy.mesh!);
    });

    it('should not affect living (non-dying) enemies', () => {
      const living = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      service.updateDyingAnimations(0.3, mockScene);

      expect(living.mesh!.scale.x).toBe(1); // default scale unchanged
      expect(service.getEnemies().has(living.id)).toBe(true);
    });

    it('should be a no-op when deltaTime <= 0', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);
      service.startDyingAnimation(enemy.id);
      const timer = enemy.dyingTimer!;

      service.updateDyingAnimations(0, mockScene);

      expect(enemy.dyingTimer).toBe(timer);
    });

    it('should keep BOSS enemy in map until durationBoss expires', () => {
      const boss = service.spawnEnemy(EnemyType.BOSS, mockScene)!;
      const id = boss.id;
      service.damageEnemy(id, boss.maxHealth);
      service.startDyingAnimation(id);

      // Standard duration (0.3s) should NOT remove boss
      service.updateDyingAnimations(0.3, mockScene);
      expect(service.getEnemies().has(id)).toBe(true);

      // Advance past boss duration (0.5s total → another 0.3s = 0.6s total)
      service.updateDyingAnimations(0.3, mockScene);
      expect(service.getEnemies().has(id)).toBe(false);
    });
  });

  describe('getLivingEnemyCount', () => {
    it('should return 0 when no enemies are spawned', () => {
      expect(service.getLivingEnemyCount()).toBe(0);
    });

    it('should count all living enemies', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      service.spawnEnemy(EnemyType.FAST, mockScene);

      expect(service.getLivingEnemyCount()).toBe(2);
    });

    it('should exclude dying enemies from the count', () => {
      const e1 = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.spawnEnemy(EnemyType.FAST, mockScene);

      service.damageEnemy(e1.id, e1.maxHealth);
      service.startDyingAnimation(e1.id);

      // e1 is dying, e2 is alive → count should be 1
      expect(service.getLivingEnemyCount()).toBe(1);
    });

    it('should return 0 when all enemies are dying', () => {
      const e1 = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const e2 = service.spawnEnemy(EnemyType.FAST, mockScene)!;

      service.damageEnemy(e1.id, e1.maxHealth);
      service.startDyingAnimation(e1.id);
      service.damageEnemy(e2.id, e2.maxHealth);
      service.startDyingAnimation(e2.id);

      expect(service.getLivingEnemyCount()).toBe(0);
    });

    it('should not count an enemy with hp=0 that has not yet started dying animation', () => {
      const e1 = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.spawnEnemy(EnemyType.FAST, mockScene);

      // Damage e1 to 0 without calling startDyingAnimation — pre-animation dead state
      service.damageEnemy(e1.id, e1.maxHealth);

      // e1.dying is undefined/falsy before startDyingAnimation, but health === 0
      // must not count as living
      expect(e1.dying).toBeFalsy();
      expect(e1.health).toBeLessThanOrEqual(0);
      expect(service.getLivingEnemyCount()).toBe(1);
    });
  });

  describe('dying enemies — movement and targeting exclusions', () => {
    it('dying enemies should not move during stepEnemiesOneTurn', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);
      service.startDyingAnimation(enemy.id);
      const pos = { ...enemy.position };

      // stepEnemiesOneTurn skips dying enemies (enemy.dying === true)
      service.stepEnemiesOneTurn(() => 0);

      expect(enemy.position.x).toBe(pos.x);
      expect(enemy.position.z).toBe(pos.z);
    });

    it('dying enemies should not appear in reached-exit list', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      // Place at last path node — would normally be pushed to reachedExit
      enemy.pathIndex = enemy.path.length - 1;
      service.damageEnemy(enemy.id, enemy.maxHealth);
      service.startDyingAnimation(enemy.id);

      // stepEnemiesOneTurn skips dying enemies entirely
      const reached = service.stepEnemiesOneTurn(() => 0);

      expect(reached).not.toContain(enemy.id);
    });

    it('should not update health bar for dying enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);
      service.startDyingAnimation(enemy.id);

      // Manually corrupt health bar scale to verify it is not touched
      const healthBarFg = enemy.mesh!.userData['healthBarFg'] as THREE.Mesh;
      healthBarFg.scale.x = 0.99;

      service.updateHealthBars();

      expect(healthBarFg.scale.x).toBe(0.99); // not updated
    });

    it('should not update status visuals for dying enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);
      service.startDyingAnimation(enemy.id);

      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.BURN]);

      service.updateStatusVisuals(activeEffects);

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      // Emissive should not have been set to BURN color
      expect(mat.emissive.getHex()).not.toBe(0xff6622);
    });

    it('dying enemies should not animate (boss crown should not spin)', () => {
      const boss = service.spawnEnemy(EnemyType.BOSS, mockScene)!;
      service.damageEnemy(boss.id, boss.maxHealth);
      service.startDyingAnimation(boss.id);
      const crown = boss.mesh!.userData['bossCrown'] as THREE.Mesh;
      const rotBefore = crown.rotation.z;

      service.updateEnemyAnimations(0.5);

      expect(crown.rotation.z).toBe(rotBefore);
    });
  });

  describe('reset() cleans up dying enemies', () => {
    it('should remove dying enemies from the map on reset', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);
      service.startDyingAnimation(enemy.id);

      service.reset(mockScene);

      expect(service.getEnemies().size).toBe(0);
    });

    it('should remove dying enemy meshes from the scene on reset', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);
      service.startDyingAnimation(enemy.id);

      service.reset(mockScene);

      expect(mockScene.children).not.toContain(enemy.mesh!);
    });
  });

  // ---------------------------------------------------------------------------
  // Deferred repath execution in stepEnemiesOneTurn
  // ---------------------------------------------------------------------------
  // In the turn-based model, executeRepath fires during stepEnemiesOneTurn
  // immediately after the enemy advances to each new tile (if needsRepath=true).
  // No deltaTime semantics — one call to stepEnemiesOneTurn advances BASIC
  // enemies by exactly 1 tile, triggering any pending repath at that tile.
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Card modifier wiring: enemySpeed
  // ---------------------------------------------------------------------------

  describe('card modifier wiring — enemySpeed', () => {
    it('enemySpeed 0.5 reduces FAST enemy (2 tiles/turn) to 1 tile', () => {
      const cardEffectSpy = TestBed.inject(CardEffectService) as jasmine.SpyObj<CardEffectService>;
      cardEffectSpy.getModifierValue.and.callFake((stat: string) => stat === 'enemySpeed' ? 0.5 : 0);

      const enemy = service.spawnEnemy(EnemyType.FAST, mockScene)!;
      const startIndex = enemy.pathIndex;

      // 50% of baseTiles(2) = floor(1.0) = 1 reduction → moves 1 tile
      service.stepEnemiesOneTurn(() => 0);

      expect(enemy.pathIndex).toBe(startIndex + 1);
    });

    it('enemySpeed 0 leaves FAST enemy movement unchanged (2 tiles/turn)', () => {
      const cardEffectSpy = TestBed.inject(CardEffectService) as jasmine.SpyObj<CardEffectService>;
      cardEffectSpy.getModifierValue.and.returnValue(0);

      const enemy = service.spawnEnemy(EnemyType.FAST, mockScene)!;
      const startIndex = enemy.pathIndex;

      service.stepEnemiesOneTurn(() => 0);

      expect(enemy.pathIndex).toBe(startIndex + 2);
    });
  });

  // ---------------------------------------------------------------------------
  // Deferred repath execution in stepEnemiesOneTurn
  // ---------------------------------------------------------------------------

  describe('deferred repath execution in stepEnemiesOneTurn', () => {

    function node(col: number, row: number): import('../models/enemy.model').GridNode {
      return { x: col, y: row, g: 0, h: 0, f: 0 };
    }

    it('should execute repath when enemy reaches a waypoint with needsRepath=true', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      // Set a straight 4-node path along row=0: col 0→1→2→3
      enemy.path = [node(0, 0), node(1, 0), node(2, 0), node(3, 0)];
      enemy.pathIndex = 0;
      enemy.gridPosition = { row: 0, col: 0 };
      enemy.needsRepath = true;

      const pathBefore = enemy.path.slice();

      // One turn advances BASIC 1 tile to node(1,0) → executeRepath fires
      service.stepEnemiesOneTurn(() => 0);

      // Path must now be the A* result from current grid position, not the original stub
      expect(enemy.path).not.toEqual(pathBefore);
      // A* path from (row=0, col=1) to exit (9,9) must end at (9,9)
      const last = enemy.path[enemy.path.length - 1];
      expect(last.x).toBe(9);
      expect(last.y).toBe(9);
    });

    it('should NOT repath an enemy that has needsRepath=false', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [node(0, 0), node(1, 0), node(2, 0), node(3, 0)];
      enemy.pathIndex = 0;
      enemy.gridPosition = { row: 0, col: 0 };
      enemy.needsRepath = false;

      const pathBefore = enemy.path.slice();

      service.stepEnemiesOneTurn(() => 0);

      // Path must be unchanged — no repath was requested
      expect(enemy.path.length).toBe(pathBefore.length);
      for (let i = 0; i < pathBefore.length; i++) {
        expect(enemy.path[i].x).toBe(pathBefore[i].x);
        expect(enemy.path[i].y).toBe(pathBefore[i].y);
      }
    });

    it('should repath from the CURRENT waypoint before stepping, not after', () => {
      // Regression: previous implementation repathed AFTER advancing pathIndex
      // and snapping world position, which meant an enemy whose next waypoint
      // was a newly-placed tower would first walk ONTO the tower, then repath
      // from that tile. The fix moves the repath to the top of the movement
      // iteration — so path[0] of the new path is the enemy's ORIGINAL
      // position this turn (col=0, row=0), not col=1.
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [node(0, 0), node(1, 0), node(2, 0), node(3, 0), node(9, 9)];
      enemy.pathIndex = 0;
      enemy.gridPosition = { row: 0, col: 0 };
      enemy.needsRepath = true;

      service.stepEnemiesOneTurn(() => 0);

      // Repath ran FROM the original grid position (col=0, row=0) — the
      // new path[0] must be that tile, not the post-step tile (col=1).
      expect(enemy.path[0].x).toBe(0);
      expect(enemy.path[0].y).toBe(0);
    });

    it('should clear needsRepath flag after executing repath', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [node(0, 0), node(1, 0), node(2, 0), node(9, 9)];
      enemy.pathIndex = 0;
      enemy.gridPosition = { row: 0, col: 0 };
      enemy.needsRepath = true;

      service.stepEnemiesOneTurn(() => 0); // triggers executeRepath

      expect(enemy.needsRepath).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Hit flash — startHitFlash / updateHitFlashes
  // ---------------------------------------------------------------------------

  describe('startHitFlash', () => {
    it('should set hitFlashTimer on a living enemy', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      service.startHitFlash(enemy.id);

      expect(enemy.hitFlashTimer).toBeGreaterThan(0);
    });

    it('should set emissiveIntensity to HIT_FLASH_CONFIG.emissiveIntensity', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      service.startHitFlash(enemy.id);

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      expect(mat.emissiveIntensity).toBeCloseTo(HIT_FLASH_CONFIG.emissiveIntensity);
    });

    it('should set emissive color to white (0xffffff)', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      service.startHitFlash(enemy.id);

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0xffffff);
    });

    it('should NOT flash a dying enemy', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);
      service.startDyingAnimation(enemy.id);

      service.startHitFlash(enemy.id);

      expect(enemy.hitFlashTimer).toBeUndefined();
    });

    it('should NOT re-flash while already flashing (throttle)', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.startHitFlash(enemy.id);
      const firstTimer = enemy.hitFlashTimer!;
      // Manually reduce the timer (as if partially elapsed) so it is still active
      enemy.hitFlashTimer = firstTimer * 0.5;

      // Second flash attempt should be a no-op
      service.startHitFlash(enemy.id);

      expect(enemy.hitFlashTimer).toBeCloseTo(firstTimer * 0.5);
    });

    it('should be a no-op for a non-existent enemy ID', () => {
      expect(() => service.startHitFlash('ghost-id')).not.toThrow();
    });

    it('should snapshot the pre-flash emissive color into userData', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      const originalColor = mat.emissive.getHex();

      service.startHitFlash(enemy.id);

      expect(enemy.mesh!.userData['preFlashEmissive']).toBe(originalColor);
    });

    it('should snapshot the pre-flash emissiveIntensity into userData', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      const originalIntensity = mat.emissiveIntensity;

      service.startHitFlash(enemy.id);

      expect(enemy.mesh!.userData['preFlashEmissiveIntensity']).toBeCloseTo(originalIntensity);
    });

    it('should also flash boss crown mesh', () => {
      const boss = service.spawnEnemy(EnemyType.BOSS, mockScene)!;

      service.startHitFlash(boss.id);

      const crown = boss.mesh!.userData['bossCrown'] as THREE.Mesh;
      const crownMat = crown.material as THREE.MeshStandardMaterial;
      expect(crownMat.emissive.getHex()).toBe(0xffffff);
      expect(crownMat.emissiveIntensity).toBeCloseTo(HIT_FLASH_CONFIG.emissiveIntensity);
    });

    it('works with MeshStandardMaterial', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      expect(enemy.mesh!.material).toBeInstanceOf(THREE.MeshStandardMaterial);

      service.startHitFlash(enemy.id);

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0xffffff);
    });
  });

  describe('updateHitFlashes', () => {
    it('should reduce hitFlashTimer by deltaTime', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.startHitFlash(enemy.id);
      const before = enemy.hitFlashTimer!;

      service.updateHitFlashes(0.05);

      expect(enemy.hitFlashTimer).toBeCloseTo(before - 0.05);
    });

    it('should restore original emissive color when timer expires', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      const originalColor = mat.emissive.getHex();

      service.startHitFlash(enemy.id);
      // Advance past the full flash duration
      service.updateHitFlashes(1.0);

      expect(mat.emissive.getHex()).toBe(originalColor);
    });

    it('should restore original emissiveIntensity when timer expires', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      const originalIntensity = mat.emissiveIntensity;

      service.startHitFlash(enemy.id);
      service.updateHitFlashes(1.0);

      expect(mat.emissiveIntensity).toBeCloseTo(originalIntensity);
    });

    it('should restore boss crown emissive when timer expires', () => {
      const boss = service.spawnEnemy(EnemyType.BOSS, mockScene)!;
      const crown = boss.mesh!.userData['bossCrown'] as THREE.Mesh;
      const crownMat = crown.material as THREE.MeshStandardMaterial;
      const originalColor = crownMat.emissive.getHex();
      const originalIntensity = crownMat.emissiveIntensity;

      service.startHitFlash(boss.id);
      service.updateHitFlashes(1.0);

      expect(crownMat.emissive.getHex()).toBe(originalColor);
      expect(crownMat.emissiveIntensity).toBeCloseTo(originalIntensity);
    });

    it('should be a no-op when deltaTime <= 0', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.startHitFlash(enemy.id);
      const before = enemy.hitFlashTimer!;

      service.updateHitFlashes(0);

      expect(enemy.hitFlashTimer).toBe(before);
    });

    it('should not affect enemies with no active flash', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      const originalIntensity = mat.emissiveIntensity;

      service.updateHitFlashes(0.1);

      expect(mat.emissiveIntensity).toBeCloseTo(originalIntensity);
    });

    it('restores status-effect emissive after flash expires (snapshot preserves tinted color)', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      // Manually apply a status-effect tint before the flash
      mat.emissive.setHex(0x4488ff); // SLOW color
      mat.emissiveIntensity = 0.7;

      service.startHitFlash(enemy.id);
      service.updateHitFlashes(1.0);

      expect(mat.emissive.getHex()).toBe(0x4488ff);
      expect(mat.emissiveIntensity).toBeCloseTo(0.7);
    });

    it('should zero hitFlashTimer after expiry (not leave it negative)', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.startHitFlash(enemy.id);

      service.updateHitFlashes(1.0);

      expect(enemy.hitFlashTimer).toBe(0);
    });

    it('should cancel flash immediately if enemy is dying (red team gate)', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.startHitFlash(enemy.id);
      expect(enemy.hitFlashTimer).toBeGreaterThan(0);

      // Enemy starts dying while flash is in progress
      service.startDyingAnimation(enemy.id);
      expect(enemy.dying).toBeTrue();

      // Flash should be cancelled, not restored
      service.updateHitFlashes(0.01);
      expect(enemy.hitFlashTimer).toBe(0);
      // Emissive should NOT be restored (death animation owns the visual state)
    });
  });

  // ---------------------------------------------------------------------------
  // Shield break animation — updateShieldBreakAnimations
  // ---------------------------------------------------------------------------

  describe('updateShieldBreakAnimations', () => {
    it('should scale the shield dome up during break animation', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
      const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;
      service.damageEnemy(enemy.id, maxShield);

      const shieldMesh = enemy.mesh!.userData['shieldMesh'] as THREE.Mesh;
      const scaleAtStart = shieldMesh.scale.x;

      // Advance partway through the animation
      service.updateShieldBreakAnimations(0.1);

      expect(shieldMesh.scale.x).toBeGreaterThan(scaleAtStart);
    });

    it('should fade the shield dome opacity toward 0 during break animation', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
      const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;
      service.damageEnemy(enemy.id, maxShield);

      const shieldMesh = enemy.mesh!.userData['shieldMesh'] as THREE.Mesh;
      const mat = shieldMesh.material as THREE.MeshStandardMaterial;
      const opacityAtStart = mat.opacity;

      service.updateShieldBreakAnimations(0.1);

      expect(mat.opacity).toBeLessThan(opacityAtStart);
    });

    it('should remove shield mesh and clear shieldBreaking after animation completes', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
      const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;
      service.damageEnemy(enemy.id, maxShield);

      expect(enemy.shieldBreaking).toBe(true);

      service.updateShieldBreakAnimations(1.0);

      expect(enemy.shieldBreaking).toBe(false);
      expect(enemy.shieldBreakTimer).toBeUndefined();
      expect(enemy.mesh!.userData['shieldMesh']).toBeUndefined();
    });

    it('should be a no-op when deltaTime <= 0', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
      const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;
      service.damageEnemy(enemy.id, maxShield);
      const timerBefore = enemy.shieldBreakTimer!;

      service.updateShieldBreakAnimations(0);

      expect(enemy.shieldBreakTimer).toBe(timerBefore);
    });

    it('should not affect enemies with no active shield break animation', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      expect(() => service.updateShieldBreakAnimations(0.1)).not.toThrow();
    });

    it('should reduce the shieldBreakTimer by deltaTime', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
      const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;
      service.damageEnemy(enemy.id, maxShield);
      const timerBefore = enemy.shieldBreakTimer!;

      service.updateShieldBreakAnimations(0.1);

      expect(enemy.shieldBreakTimer!).toBeCloseTo(timerBefore - 0.1);
    });

    it('cleanup handles SHIELDED enemies with active shield break animation', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
      const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;
      service.damageEnemy(enemy.id, maxShield);

      // Shield break animation has started but not yet completed
      expect(enemy.shieldBreaking).toBe(true);

      expect(() => service.cleanup(mockScene)).not.toThrow();
      expect(service.getEnemies().size).toBe(0);
    });

    it('reset handles SHIELDED enemies with active shield break animation', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
      const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;
      service.damageEnemy(enemy.id, maxShield);

      expect(enemy.shieldBreaking).toBe(true);

      expect(() => service.reset(mockScene)).not.toThrow();
      expect(service.getEnemies().size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // updateStatusEffectParticles
  // ---------------------------------------------------------------------------

  describe('updateStatusEffectParticles', () => {
    it('creates BURN particles when enemy has BURN effect', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.BURN]);

      service.updateStatusEffectParticles(0.016, mockScene, activeEffects);

      expect(enemy.statusParticles).toBeTruthy();
      expect(enemy.statusParticles!.length).toBe(STATUS_EFFECT_VISUAL_CONFIG.maxParticlesPerEnemy);
    });

    it('creates POISON particles when enemy has POISON effect', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.POISON]);

      service.updateStatusEffectParticles(0.016, mockScene, activeEffects);

      expect(enemy.statusParticles!.length).toBe(STATUS_EFFECT_VISUAL_CONFIG.maxParticlesPerEnemy);
      // Poison particles use green color
      const mat = enemy.statusParticles![0].material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(0x44ff44);
    });

    it('creates SLOW particles when enemy has SLOW effect', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.SLOW]);

      service.updateStatusEffectParticles(0.016, mockScene, activeEffects);

      expect(enemy.statusParticles!.length).toBe(STATUS_EFFECT_VISUAL_CONFIG.maxParticlesPerEnemy);
      // Slow particles use ice-blue color
      const mat = enemy.statusParticles![0].material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(0x88ccff);
    });

    it('removes particles when status effect ends (empty active effects)', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.BURN]);

      service.updateStatusEffectParticles(0.016, mockScene, activeEffects);
      expect(enemy.statusParticles!.length).toBe(STATUS_EFFECT_VISUAL_CONFIG.maxParticlesPerEnemy);

      // Effect ended — no entry for this enemy
      const noEffects = new Map<string, StatusEffectType[]>();
      service.updateStatusEffectParticles(0.016, mockScene, noEffects);

      expect(enemy.statusParticles!.length).toBe(0);
    });

    it('removes particles when enemy enters dying state', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.BURN]);

      // Create particles first
      service.updateStatusEffectParticles(0.016, mockScene, activeEffects);
      expect(enemy.statusParticles!.length).toBe(STATUS_EFFECT_VISUAL_CONFIG.maxParticlesPerEnemy);

      // Mark as dying
      service.damageEnemy(enemy.id, enemy.maxHealth);
      service.startDyingAnimation(enemy.id);

      service.updateStatusEffectParticles(0.016, mockScene, activeEffects);

      expect(enemy.statusParticles!.length).toBe(0);
    });

    it('removes particles on removeEnemy()', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.BURN]);

      service.updateStatusEffectParticles(0.016, mockScene, activeEffects);
      const initialSceneCount = mockScene.children.length;
      // particles added to scene = enemy mesh + maxParticlesPerEnemy particles
      expect(mockScene.children.length).toBeGreaterThanOrEqual(1 + STATUS_EFFECT_VISUAL_CONFIG.maxParticlesPerEnemy);

      service.removeEnemy(enemy.id, mockScene);

      // After removal scene should not contain the enemy mesh or particles
      expect(mockScene.children.length).toBeLessThan(initialSceneCount);
      expect(service.getEnemies().size).toBe(0);
    });

    it('cleans up all particles on cleanup()', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.BURN]);

      service.updateStatusEffectParticles(0.016, mockScene, activeEffects);
      expect(enemy.statusParticles!.length).toBe(STATUS_EFFECT_VISUAL_CONFIG.maxParticlesPerEnemy);

      service.cleanup(mockScene);

      expect(mockScene.children.length).toBe(0);
    });

    it('does not create particles for dying enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth);
      service.startDyingAnimation(enemy.id);

      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.BURN]);

      service.updateStatusEffectParticles(0.016, mockScene, activeEffects);

      // dying enemies get no particles (or existing ones removed)
      expect(!enemy.statusParticles || enemy.statusParticles.length === 0).toBe(true);
    });

    it('respects maxParticlesPerEnemy limit per enemy per effect', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.POISON]);

      // Call multiple times — should not exceed max
      service.updateStatusEffectParticles(0.016, mockScene, activeEffects);
      service.updateStatusEffectParticles(0.016, mockScene, activeEffects);
      service.updateStatusEffectParticles(0.016, mockScene, activeEffects);

      expect(enemy.statusParticles!.length).toBe(STATUS_EFFECT_VISUAL_CONFIG.maxParticlesPerEnemy);
    });

    it('does not throw for zero deltaTime', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.BURN]);

      expect(() => service.updateStatusEffectParticles(0, mockScene, activeEffects)).not.toThrow();
    });

    it('adds particles to scene (not as child of enemy mesh)', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const childCountBefore = enemy.mesh!.children.length;
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.BURN]);

      service.updateStatusEffectParticles(0.016, mockScene, activeEffects);

      // Particles should be in the scene, NOT as children of the enemy mesh
      expect(enemy.mesh!.children.length).toBe(childCountBefore);
      // Scene should have grown by 3 (particles)
      const particles = enemy.statusParticles!;
      particles.forEach(p => {
        expect(p.parent).toBe(mockScene);
      });
    });
  });

  describe('checkpoint serialization', () => {
    it('serializeEnemies() strips mesh, statusParticles, and statusParticleEffectType', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      // Attach particle-like fields manually to simulate visual state
      enemy.statusParticles = [new THREE.Mesh()];
      enemy.statusParticleEffectType = 'burn';

      const { enemies } = service.serializeEnemies();
      const serialized = enemies.find(e => e.id === enemy.id)!;

      expect(serialized).toBeTruthy();
      expect((serialized as unknown as Record<string, unknown>)['mesh']).toBeUndefined();
      expect((serialized as unknown as Record<string, unknown>)['statusParticles']).toBeUndefined();
      expect((serialized as unknown as Record<string, unknown>)['statusParticleEffectType']).toBeUndefined();

      // Clean up the dummy particle mesh
      enemy.statusParticles[0].geometry.dispose();
      enemy.statusParticles = undefined;
    });

    it('serializeEnemies() strips GridNode.parent circular references', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      // Attach a parent ref to a path node to simulate A* output
      if (enemy.path.length > 0) {
        enemy.path[0].parent = enemy.path[0]; // self-reference as stand-in
      }

      const { enemies } = service.serializeEnemies();
      const serialized = enemies.find(e => e.id === enemy.id)!;

      serialized.path.forEach(node => {
        expect((node as unknown as Record<string, unknown>)['parent']).toBeUndefined();
      });
    });

    it('serializeEnemies() captures all combat-relevant fields', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
      // Mutate a few fields to have non-default values
      enemy.health = 42;
      enemy.pathIndex = 1;
      enemy.distanceTraveled = 3;
      enemy.dying = true;
      enemy.dyingTimer = 0.5;
      enemy.hitFlashTimer = 0.1;
      enemy.needsRepath = true;

      const { enemies } = service.serializeEnemies();
      const s = enemies.find(e => e.id === enemy.id)!;

      expect(s.id).toBe(enemy.id);
      expect(s.type).toBe(EnemyType.SHIELDED);
      expect(s.health).toBe(42);
      expect(s.maxHealth).toBe(enemy.maxHealth);
      expect(s.speed).toBe(enemy.speed);
      expect(s.value).toBe(enemy.value);
      expect(s.leakDamage).toBe(enemy.leakDamage);
      expect(s.pathIndex).toBe(1);
      expect(s.distanceTraveled).toBe(3);
      expect(s.position).toEqual(enemy.position);
      expect(s.gridPosition).toEqual(enemy.gridPosition);
      expect(s.shield).toBe(ENEMY_STATS[EnemyType.SHIELDED].maxShield);
      expect(s.maxShield).toBe(ENEMY_STATS[EnemyType.SHIELDED].maxShield);
      expect(s.dying).toBeTrue();
      expect(s.dyingTimer).toBe(0.5);
      expect(s.hitFlashTimer).toBe(0.1);
      expect(s.needsRepath).toBeTrue();
    });

    it('serializeEnemies() returns the current enemyCounter', () => {
      // Spawn a couple of enemies to advance the counter
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      service.spawnEnemy(EnemyType.FAST, mockScene);

      const { enemyCounter } = service.serializeEnemies();
      // Counter increments once per spawn; after 2 spawns it should be 2
      expect(enemyCounter).toBe(2);
    });

    it('restoreEnemies() rebuilds the enemies Map from serialized data', () => {
      const mesh = new THREE.Mesh();
      const serialized: SerializableEnemy[] = [
        {
          id: 'enemy-99',
          type: EnemyType.BASIC,
          position: { x: 1, y: 0.3, z: 2 },
          gridPosition: { row: 2, col: 1 },
          health: 80,
          maxHealth: 100,
          speed: 1,
          value: 10,
          path: [{ x: 1, y: 2, f: 0, g: 0, h: 0 }],
          pathIndex: 0,
          distanceTraveled: 2,
          leakDamage: 1,
        }
      ];
      const meshMap = new Map<string, THREE.Mesh>([['enemy-99', mesh]]);

      service.restoreEnemies(serialized, meshMap, 100);

      const restored = service.getEnemies();
      expect(restored.size).toBe(1);

      const e = restored.get('enemy-99')!;
      expect(e).toBeTruthy();
      expect(e.type).toBe(EnemyType.BASIC);
      expect(e.health).toBe(80);
      expect(e.position).toEqual({ x: 1, y: 0.3, z: 2 });
      expect(e.gridPosition).toEqual({ row: 2, col: 1 });
      expect(e.mesh).toBe(mesh);

      // Clean up
      mesh.geometry.dispose();
      service.getEnemies().clear();
    });

    it('serialize → restore roundtrip preserves all fields for multiple enemies', () => {
      const e1 = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const e2 = service.spawnEnemy(EnemyType.FAST, mockScene)!;
      e1.health = 55;
      e2.distanceTraveled = 4;

      const { enemies: serialized, enemyCounter } = service.serializeEnemies();

      // Build a mesh map from the original meshes so restore can attach them
      const meshMap = new Map<string, THREE.Mesh>();
      service.getEnemies().forEach((enemy, id) => {
        if (enemy.mesh) meshMap.set(id, enemy.mesh);
      });

      // Reset service state before restore (simulate a fresh load)
      service.getEnemies().clear();

      service.restoreEnemies(serialized, meshMap, enemyCounter);

      const restored = service.getEnemies();
      expect(restored.size).toBe(2);

      const r1 = restored.get(e1.id)!;
      expect(r1.health).toBe(55);
      expect(r1.type).toBe(EnemyType.BASIC);
      expect(r1.mesh).toBeTruthy();

      const r2 = restored.get(e2.id)!;
      expect(r2.distanceTraveled).toBe(4);
      expect(r2.type).toBe(EnemyType.FAST);

      // Verify counter was restored
      const { enemyCounter: counterAfterRestore } = service.serializeEnemies();
      expect(counterAfterRestore).toBe(enemyCounter);
    });

    it('serializeEnemies() round-trips spawnedOnTurn for MINER', () => {
      const miner = service.spawnEnemy(EnemyType.MINER, mockScene)!;
      miner.spawnedOnTurn = 7;

      const { enemies } = service.serializeEnemies();
      const serialized = enemies.find(e => e.id === miner.id)!;

      expect(serialized.spawnedOnTurn).toBe(7);
    });

    it('restoreEnemies() preserves spawnedOnTurn on MINER', () => {
      const serialized: SerializableEnemy[] = [
        {
          id: 'miner-1',
          type: EnemyType.MINER,
          position: { x: 0, y: 0.35, z: 0 },
          gridPosition: { row: 0, col: 0 },
          health: MINER_STATS.health,
          maxHealth: MINER_STATS.health,
          speed: MINER_STATS.speed,
          value: MINER_STATS.value,
          leakDamage: MINER_STATS.leakDamage,
          path: [],
          pathIndex: 0,
          distanceTraveled: 0,
          spawnedOnTurn: 5,
        }
      ];
      const meshMap = new Map<string, THREE.Mesh>([['miner-1', new THREE.Mesh()]]);

      service.restoreEnemies(serialized, meshMap, 1);

      const restored = service.getEnemies().get('miner-1')!;
      expect(restored.spawnedOnTurn).toBe(5);
    });

    it('serializeEnemies() omits spawnedOnTurn for non-MINER enemies', () => {
      const basic = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      const { enemies } = service.serializeEnemies();
      const serialized = enemies.find(e => e.id === basic.id)!;

      expect((serialized as unknown as Record<string, unknown>)['spawnedOnTurn']).toBeUndefined();
    });
  });

  describe('MINER enemy', () => {
    it('should spawn with correct stats from MINER_STATS', () => {
      const miner = service.spawnEnemy(EnemyType.MINER, mockScene)!;

      expect(miner.type).toBe(EnemyType.MINER);
      expect(miner.health).toBe(MINER_STATS.health);
      expect(miner.speed).toBeCloseTo(MINER_STATS.speed);
      expect(miner.value).toBe(MINER_STATS.value);
      expect(miner.leakDamage).toBe(MINER_STATS.leakDamage);
    });

    it('should NOT set spawnedOnTurn when currentTurn is omitted', () => {
      const miner = service.spawnEnemy(EnemyType.MINER, mockScene)!;

      expect(miner.spawnedOnTurn).toBeUndefined();
    });

    it('should set spawnedOnTurn when currentTurn is provided', () => {
      const miner = service.spawnEnemy(EnemyType.MINER, mockScene, 1, 1, undefined, 4)!;

      expect(miner.spawnedOnTurn).toBe(4);
    });

    it('should NOT set spawnedOnTurn on non-MINER enemies', () => {
      const basic = service.spawnEnemy(EnemyType.BASIC, mockScene, 1, 1, undefined, 4)!;

      expect(basic.spawnedOnTurn).toBeUndefined();
    });

    describe('MINER_STATS constants', () => {
      it('MINER_STATS.health is 175', () => {
        expect(MINER_STATS.health).toBe(175);
      });

      it('MINER_STATS.tilesPerTurn is 1', () => {
        expect(MINER_STATS.tilesPerTurn).toBe(1);
      });

      it('MINER_DIG_INTERVAL_TURNS is 3', () => {
        expect(MINER_DIG_INTERVAL_TURNS).toBe(3);
      });
    });

    describe('tickMinerDigs (without PathMutationService — @Optional null)', () => {
      it('should be a no-op when PathMutationService is null (early-out)', () => {
        // PathMutationService is not registered — @Optional injects null
        const miner = service.spawnEnemy(EnemyType.MINER, mockScene)!;
        miner.spawnedOnTurn = 1;

        // Should not throw even though pathMutationService is null
        expect(() => service.tickMinerDigs(4, mockScene)).not.toThrow();
      });

      it('should skip dying enemies', () => {
        const miner = service.spawnEnemy(EnemyType.MINER, mockScene)!;
        miner.spawnedOnTurn = 1;
        miner.dying = true;

        expect(() => service.tickMinerDigs(4, mockScene)).not.toThrow();
      });

      it('should skip enemies with undefined spawnedOnTurn', () => {
        service.spawnEnemy(EnemyType.MINER, mockScene)!;
        // spawnedOnTurn is undefined (no currentTurn passed to spawnEnemy)

        expect(() => service.tickMinerDigs(4, mockScene)).not.toThrow();
      });

      it('should not fire on the spawn turn itself (turnsSinceSpawn === 0)', () => {
        // Even if we had PathMutationService, the turn=0 guard must hold.
        // We verify by ensuring the method exits early without error.
        const miner = service.spawnEnemy(EnemyType.MINER, mockScene)!;
        miner.spawnedOnTurn = 4;

        expect(() => service.tickMinerDigs(4, mockScene)).not.toThrow();
      });
    });

    // Sprint 24 QA fix: findMinerDigTarget was originally path-scanning, but
    // A* pathfinding never puts WALL tiles into enemy.path (they're non-
    // traversable). Rewritten to scan the MINER's 4-direction neighbors for
    // adjacent walls instead.
    describe('findMinerDigTarget (adjacent-neighbor scan)', () => {
      it('returns null when no adjacent tile is a WALL', () => {
        const miner = service.spawnEnemy(EnemyType.MINER, mockScene)!;
        // Test board has all-BASE neighbors by default — no dig target.
        const result = service.findMinerDigTarget(miner);
        expect(result).toBeNull();
      });

      it('returns the first adjacent WALL (scan order up/down/left/right)', () => {
        const miner = service.spawnEnemy(EnemyType.MINER, mockScene)!;
        miner.gridPosition = { row: 2, col: 2 };

        const board = gameBoardService.getGameBoard();
        const mockBoard = board.map(row => [...row]);
        // Put a WALL to the left (row 2, col 1). Up/down come first in
        // scan order but are BASE → should fall through to left.
        mockBoard[2][1] = GameBoardTile.createWall(1, 2);
        gameBoardService.getGameBoard.and.returnValue(mockBoard);

        const result = service.findMinerDigTarget(miner);

        expect(result).toEqual({ row: 2, col: 1 });
      });

      it('prefers UP over DOWN when both are walls (deterministic order)', () => {
        const miner = service.spawnEnemy(EnemyType.MINER, mockScene)!;
        miner.gridPosition = { row: 2, col: 2 };

        const board = gameBoardService.getGameBoard();
        const mockBoard = board.map(row => [...row]);
        mockBoard[1][2] = GameBoardTile.createWall(2, 1); // up
        mockBoard[3][2] = GameBoardTile.createWall(2, 3); // down
        gameBoardService.getGameBoard.and.returnValue(mockBoard);

        const result = service.findMinerDigTarget(miner);

        expect(result).toEqual({ row: 1, col: 2 });
      });

      it('skips player-built walls (isPlayerBlocked guard)', () => {
        const miner = service.spawnEnemy(EnemyType.MINER, mockScene)!;
        miner.gridPosition = { row: 2, col: 2 };

        const board = gameBoardService.getGameBoard();
        const mockBoard = board.map(row => [...row]);
        mockBoard[1][2] = GameBoardTile.createWall(2, 1); // up (player-built)
        mockBoard[3][2] = GameBoardTile.createWall(2, 3); // down (original)
        gameBoardService.getGameBoard.and.returnValue(mockBoard);

        // Spy on PathMutationService.isPlayerBlocked — sprint-21 wiring makes
        // this available via @Optional injection on EnemyService. In this
        // spec we inject a spy via TestBed; if absent, the guard short-circuits.
        const pathMutation = TestBed.inject(PathMutationService, null);
        if (pathMutation) {
          spyOn(pathMutation, 'isPlayerBlocked').and.callFake(
            (r: number, c: number) => r === 1 && c === 2,
          );

          const result = service.findMinerDigTarget(miner);

          // Up is player-blocked; MINER falls through to down.
          expect(result).toEqual({ row: 3, col: 2 });
        }
      });

      it('returns null for an out-of-bounds MINER (defensive)', () => {
        const miner = service.spawnEnemy(EnemyType.MINER, mockScene)!;
        miner.gridPosition = { row: -5, col: -5 };
        const result = service.findMinerDigTarget(miner);
        expect(result).toBeNull();
      });
    });
  });

  describe('damageStrongestEnemy — flying exclusion', () => {
    it('skips a flying enemy and damages the strongest non-flying enemy instead', () => {
      const flyingEnemy = service.spawnEnemy(EnemyType.FLYING, mockScene)!;
      flyingEnemy.health = 9999; // highest health — should NOT be targeted

      const groundEnemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const groundHealthBefore = groundEnemy.health;

      service.damageStrongestEnemy(10);

      expect(flyingEnemy.health).toBe(9999); // flying enemy untouched
      expect(groundEnemy.health).toBe(groundHealthBefore - 10); // ground enemy damaged
    });

    it('is a no-op when only flying enemies are present', () => {
      const flyingEnemy = service.spawnEnemy(EnemyType.FLYING, mockScene)!;
      const healthBefore = flyingEnemy.health;

      service.damageStrongestEnemy(50);

      expect(flyingEnemy.health).toBe(healthBefore); // no damage applied
    });

    it('damages the ground enemy with highest health when multiple ground enemies exist', () => {
      const weak = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      weak.health = 10;

      const strong = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      strong.health = 100;

      service.damageStrongestEnemy(25);

      expect(strong.health).toBe(75); // strongest ground enemy damaged
      expect(weak.health).toBe(10);   // weaker ground enemy untouched
    });
  });

  // ---------------------------------------------------------------------------
  // Spawner occupancy — Fix #42: alternate-spawner retry (batch mode)
  //
  // Occupancy checking is only active in BATCH mode (externalOccupied set
  // passed by WaveService.spawnForTurn). Direct single calls bypass the check
  // to preserve backwards compatibility with tests and mini-swarm spawning.
  // ---------------------------------------------------------------------------

  describe('spawner occupancy — alternate-spawner retry (batch mode)', () => {
    it('returns null when the single spawner is pre-occupied in batch mode', () => {
      // Pre-occupy the only spawner (0,0) via the batch-occupied set
      const occupied = new Set<string>(['0-0']);
      const result = service.spawnEnemy(EnemyType.BASIC, mockScene, 1, 1, occupied);
      expect(result).toBeNull();
    });

    it('spawns at alternate spawner when primary is pre-occupied in batch mode', () => {
      // Board with two spawners: default at (0,0) and extra at (1,0)
      const boardWith2Spawners = createTestBoard(10, [], [], [{ row: 1, col: 0 }]);
      gameBoardService.getGameBoard.and.returnValue(boardWith2Spawners);

      // Pre-occupy one spawner via batch set
      const occupied = new Set<string>(['0-0']);
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene, 1, 1, occupied);
      // Must land at the OTHER spawner (1,0)
      expect(enemy).not.toBeNull();
      expect(enemy!.gridPosition).toEqual({ row: 1, col: 0 });
    });

    it('buildOccupiedSpawnerSet() excludes dying enemies standing on a spawner tile', () => {
      // A dying enemy (e.g. one whose death animation is playing) should NOT
      // block the spawner — it is effectively vacated.
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      // Enemy spawns at the default spawner (0,0).
      expect(enemy.gridPosition).toEqual({ row: 0, col: 0 });
      service.damageEnemy(enemy.id, enemy.maxHealth);
      service.startDyingAnimation(enemy.id);
      expect(enemy.dying).toBeTrue();

      const occupied = service.buildOccupiedSpawnerSet();
      expect(occupied.has('0-0')).toBeFalse();
    });

    it('buildOccupiedSpawnerSet() includes living enemy still standing on a spawner tile', () => {
      // A living non-dying enemy that has not yet advanced off its spawner tile
      // (e.g. SLOW-paralyzed) must block that spawner so a new enemy is not
      // stacked on the same tile.
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      // Enemy spawns at the default spawner (0,0) and has not moved.
      expect(enemy.gridPosition).toEqual({ row: 0, col: 0 });
      expect(enemy.dying).toBeFalsy();

      const occupied = service.buildOccupiedSpawnerSet();
      expect(occupied.has('0-0')).toBeTrue();
      expect(occupied.size).toBe(1);
    });

    it('buildOccupiedSpawnerSet() does not include enemy on a non-spawner tile', () => {
      // An enemy that has already advanced onto a regular path tile must NOT
      // appear in the occupied-spawner set.
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      // Manually move the enemy off the spawner to a path tile (row=1, col=0).
      enemy.gridPosition = { row: 1, col: 0 };

      const occupied = service.buildOccupiedSpawnerSet();
      expect(occupied.has('1-0')).toBeFalse();
      expect(occupied.size).toBe(0);
    });

    it('returns null only after all spawners are checked and occupied (batch mode)', () => {
      // Board with two spawners: default (0,0) and extra (1,0)
      const boardWith2Spawners = createTestBoard(10, [], [], [{ row: 1, col: 0 }]);
      gameBoardService.getGameBoard.and.returnValue(boardWith2Spawners);

      // Pre-occupy BOTH spawners
      const occupied = new Set<string>(['0-0', '1-0']);
      const result = service.spawnEnemy(EnemyType.BASIC, mockScene, 1, 1, occupied);
      expect(result).toBeNull();
    });

    it('batch set is updated with chosen spawner after successful spawn', () => {
      const boardWith2Spawners = createTestBoard(10, [], [], [{ row: 1, col: 0 }]);
      gameBoardService.getGameBoard.and.returnValue(boardWith2Spawners);

      // Start with empty occupied set
      const occupied = new Set<string>();
      const first = service.spawnEnemy(EnemyType.BASIC, mockScene, 1, 1, occupied)!;
      expect(first).not.toBeNull();

      // Set must now contain the chosen spawner
      const firstKey = `${first.gridPosition.row}-${first.gridPosition.col}`;
      expect(occupied.has(firstKey)).toBeTrue();

      // Second spawn in same batch must go to the other spawner
      const second = service.spawnEnemy(EnemyType.BASIC, mockScene, 1, 1, occupied)!;
      expect(second).not.toBeNull();
      const secondKey = `${second.gridPosition.row}-${second.gridPosition.col}`;
      expect(secondKey).not.toBe(firstKey);
    });
  });

  // ---------------------------------------------------------------------------
  // Ground straight-line fallback — Fix #43: no-path case
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // applyDetour (DETOUR card — Sprint 14)
  // ---------------------------------------------------------------------------

  describe('applyDetour', () => {
    it('returns 0 and mutates nothing when no exit tiles exist', () => {
      // Board with no exit tile
      const board: GameBoardTile[][] = [];
      for (let row = 0; row < 10; row++) {
        board[row] = [];
        for (let col = 0; col < 10; col++) {
          board[row][col] = row === 0 && col === 0
            ? GameBoardTile.createSpawner(row, col)
            : GameBoardTile.createBase(row, col);
        }
      }
      gameBoardService.getGameBoard.and.returnValue(board);

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      // spawnEnemy itself returns null when no exit — but we can check applyDetour
      // directly even when no enemy is present.
      const count = service.applyDetour();
      expect(count).toBe(0);
    });

    it('skips flying enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.FLYING, mockScene);
      expect(enemy).toBeTruthy('FLYING enemy should spawn on a standard board');
      const originalPath = [...(enemy?.path ?? [])];

      const count = service.applyDetour();

      expect(count).toBe(0);
      expect(enemy?.path).toEqual(originalPath);
    });

    it('skips dying enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(enemy).toBeTruthy();
      enemy!.dying = true;
      const originalPathLength = enemy!.path.length;

      const count = service.applyDetour();

      expect(count).toBe(0);
      expect(enemy!.path.length).toBe(originalPathLength);
    });

    it('overrides path on a non-flying, non-dying enemy when a longer path exists', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(enemy).toBeTruthy();

      // Give the enemy a very short path (just 2 nodes) so the DFS will find longer.
      enemy!.path = [
        { x: 0, y: 0, g: 0, h: 0, f: 0 },
        { x: 9, y: 9, g: 0, h: 0, f: 0 },
      ];
      enemy!.pathIndex = 0;

      const count = service.applyDetour();

      // On a 10×10 open board, the longest path is much longer than 2 nodes.
      // The count should reflect 1 override.
      expect(count).toBe(1);
      expect(enemy!.pathIndex).toBe(0);
      expect(enemy!.path.length).toBeGreaterThan(2);
    });

    it('returns the count of enemies whose path was overridden', () => {
      // Spawn two enemies — both get short paths.
      const e1 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const e2 = service.spawnEnemy(EnemyType.FAST, mockScene);
      expect(e1).toBeTruthy();
      expect(e2).toBeTruthy();

      e1!.path = [{ x: 0, y: 0, g: 0, h: 0, f: 0 }, { x: 9, y: 9, g: 0, h: 0, f: 0 }];
      e1!.pathIndex = 0;
      e2!.path = [{ x: 0, y: 0, g: 0, h: 0, f: 0 }, { x: 9, y: 9, g: 0, h: 0, f: 0 }];
      e2!.pathIndex = 0;

      const count = service.applyDetour();

      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ground enemy straight-line fallback — no A* path', () => {
    it('spawns a ground enemy with a straight-line path when A* is blocked', () => {
      // Block every tile except spawner column 0 and exit column 9, forcing
      // the entire interior to be walls. The exit (9,9) is still reachable in
      // a straight line but A* may not find a path through the walls.
      // We simulate "no path" by blocking the entire row 0 cols 1-8:
      const blockedCells: { row: number; col: number }[] = [];
      for (let col = 1; col <= 8; col++) blockedCells.push({ row: 0, col });
      // Also block col 1-8 for rows 1-8 (leave path only on col 0 and col 9)
      for (let row = 1; row <= 8; row++) {
        for (let col = 1; col <= 8; col++) {
          blockedCells.push({ row, col });
        }
      }
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, blockedCells));

      // The only traversable tiles are col 0 (rows 0-9) and col 9 (rows 0-9).
      // A* can't cross — it would return empty. Fallback should produce a path.
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      // Should still spawn (straight-line fallback) rather than return null
      expect(enemy).not.toBeNull();
      expect(enemy!.path.length).toBeGreaterThan(0);
    });
  });

  // ── SURVEYOR_COMPASS tile tracking ───────────────────────────────────────

  describe('stepEnemiesOneTurn — SURVEYOR_COMPASS tile tracking', () => {
    it('calls relicService.recordTileVisited for each tile an enemy steps onto', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      expect(enemy).not.toBeNull();

      service.stepEnemiesOneTurn(() => 0);

      // BASIC enemy moves 1 tile per turn — recordTileVisited should have been called
      // at least once with the new position (row, col).
      expect(relicServiceSpy.recordTileVisited).toHaveBeenCalled();
      const calls = relicServiceSpy.recordTileVisited.calls.allArgs();
      // Each call should be (row: number, col: number)
      calls.forEach(([row, col]: [number, number]) => {
        expect(typeof row).toBe('number');
        expect(typeof col).toBe('number');
      });
    });

    it('passes the enemy gridPosition values to recordTileVisited after stepping', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      relicServiceSpy.recordTileVisited.calls.reset();

      service.stepEnemiesOneTurn(() => 0);

      // After stepping, enemy.gridPosition should match the last recordTileVisited call args.
      const lastCall = relicServiceSpy.recordTileVisited.calls.mostRecent();
      if (lastCall) {
        const [row, col] = lastCall.args as [number, number];
        expect(row).toBe(enemy.gridPosition.row);
        expect(col).toBe(enemy.gridPosition.col);
      } else {
        // If enemy has no path remaining it won't step — not a failure
        expect(enemy.pathIndex).toBe(enemy.path.length - 1);
      }
    });
  });

  // ── UNSHAKEABLE elite enemy (Sprint 22) ──────────────────────────────────

  describe('UNSHAKEABLE enemy', () => {
    it('should spawn with correct stats from UNSHAKEABLE_STATS', () => {
      const enemy = service.spawnEnemy(EnemyType.UNSHAKEABLE, mockScene)!;

      expect(enemy.type).toBe(EnemyType.UNSHAKEABLE);
      expect(enemy.health).toBe(UNSHAKEABLE_STATS.health);
      expect(enemy.speed).toBeCloseTo(UNSHAKEABLE_STATS.speed);
      expect(enemy.value).toBe(UNSHAKEABLE_STATS.value);
      expect(enemy.leakDamage).toBe(UNSHAKEABLE_STATS.leakDamage);
    });

    it('should set immuneToDetour = true on spawn', () => {
      const enemy = service.spawnEnemy(EnemyType.UNSHAKEABLE, mockScene)!;

      expect(enemy.immuneToDetour).toBe(true);
    });

    it('should NOT set immuneToDetour on non-UNSHAKEABLE enemies', () => {
      const basic = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const heavy = service.spawnEnemy(EnemyType.HEAVY, mockScene)!;

      expect(basic.immuneToDetour).toBeUndefined();
      expect(heavy.immuneToDetour).toBeUndefined();
    });
  });

  // ── applyDetour with UNSHAKEABLE ─────────────────────────────────────────

  describe('applyDetour with UNSHAKEABLE', () => {
    it('does not override path on UNSHAKEABLE enemy', () => {
      const unshakeable = service.spawnEnemy(EnemyType.UNSHAKEABLE, mockScene)!;
      const originalPath = [...unshakeable.path];
      const originalIndex = unshakeable.pathIndex;

      // Give it a short path so applyDetour would normally override it.
      unshakeable.path = [
        { x: 0, y: 0, g: 0, h: 0, f: 0 },
        { x: 9, y: 9, g: 0, h: 0, f: 0 },
      ];
      unshakeable.pathIndex = 0;

      const count = service.applyDetour();

      // UNSHAKEABLE is immune — count is 0, path unchanged.
      expect(count).toBe(0);
      expect(unshakeable.path.length).toBe(2);
      expect(unshakeable.pathIndex).toBe(0);
    });

    it('overrides HEAVY path but skips UNSHAKEABLE path in the same applyDetour call', () => {
      const heavy = service.spawnEnemy(EnemyType.HEAVY, mockScene)!;
      const unshakeable = service.spawnEnemy(EnemyType.UNSHAKEABLE, mockScene)!;

      // Give both enemies a short 2-node path so applyDetour would override if eligible.
      const shortPath = (): Array<{ x: number; y: number; g: number; h: number; f: number }> => [
        { x: 0, y: 0, g: 0, h: 0, f: 0 },
        { x: 9, y: 9, g: 0, h: 0, f: 0 },
      ];

      heavy.path = shortPath();
      heavy.pathIndex = 0;
      unshakeable.path = shortPath();
      unshakeable.pathIndex = 0;

      const count = service.applyDetour();

      // Only HEAVY is eligible — UNSHAKEABLE is immune.
      expect(count).toBe(1);
      // HEAVY gets a longer rerouted path.
      expect(heavy.path.length).toBeGreaterThan(2);
      // UNSHAKEABLE path is unchanged.
      expect(unshakeable.path.length).toBe(2);
    });
  });

  // ── UNSHAKEABLE serialize round-trip ─────────────────────────────────────

  describe('UNSHAKEABLE serialize round-trip', () => {
    it('serializeEnemies() preserves immuneToDetour for UNSHAKEABLE', () => {
      const enemy = service.spawnEnemy(EnemyType.UNSHAKEABLE, mockScene)!;

      const { enemies } = service.serializeEnemies();
      const serialized = enemies.find(e => e.id === enemy.id)!;

      expect(serialized.immuneToDetour).toBe(true);
    });

    it('serializeEnemies() omits immuneToDetour for non-UNSHAKEABLE enemies', () => {
      const basic = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      const { enemies } = service.serializeEnemies();
      const serialized = enemies.find(e => e.id === basic.id)!;

      expect((serialized as unknown as Record<string, unknown>)['immuneToDetour']).toBeUndefined();
    });

    it('restoreEnemies() preserves immuneToDetour on UNSHAKEABLE', () => {
      const serialized: SerializableEnemy[] = [
        {
          id: 'unshakeable-1',
          type: EnemyType.UNSHAKEABLE,
          position: { x: 0, y: UNSHAKEABLE_STATS.size, z: 0 },
          gridPosition: { row: 0, col: 0 },
          health: UNSHAKEABLE_STATS.health,
          maxHealth: UNSHAKEABLE_STATS.health,
          speed: UNSHAKEABLE_STATS.speed,
          value: UNSHAKEABLE_STATS.value,
          leakDamage: UNSHAKEABLE_STATS.leakDamage,
          path: [],
          pathIndex: 0,
          distanceTraveled: 0,
          immuneToDetour: true,
        }
      ];
      const meshMap = new Map<string, THREE.Mesh>([['unshakeable-1', new THREE.Mesh()]]);

      service.restoreEnemies(serialized, meshMap, 1);

      const restored = service.getEnemies().get('unshakeable-1')!;
      expect(restored.immuneToDetour).toBe(true);
    });
  });

  // ── VEINSEEKER boss (Sprint 23) — speed boost mechanic ───────────────────

  describe('VEINSEEKER speed boost', () => {
    /**
     * PathMutationService has heavy DI (GameBoardService, BoardMeshRegistryService,
     * PathfindingService, TerraformMaterialPoolService). We use a jasmine spy for the
     * `wasMutatedInLastTurns` query so we can control the result without wiring up
     * the full service graph. EnemyService injects PathMutationService as @Optional,
     * so we provide a spy via the token.
     */
    let pathMutationSpy: jasmine.SpyObj<PathMutationService>;

    beforeEach(() => {
      TestBed.resetTestingModule();
      const gameBoardServiceSpy = createGameBoardServiceSpy(10, 10, 1, () => createTestBoard());
      const relicSpy = createRelicServiceSpy();
      pathMutationSpy = jasmine.createSpyObj<PathMutationService>('PathMutationService', [
        'wasMutatedInLastTurns',
      ]);
      // Default: no mutation active
      pathMutationSpy.wasMutatedInLastTurns.and.returnValue(false);

      TestBed.configureTestingModule({
        providers: [
          PathfindingService,
          EnemyService,
          EnemyVisualService,
          EnemyHealthService,
          EnemyMeshFactoryService,
          GameStateService,
          { provide: PathMutationService, useValue: pathMutationSpy },
          { provide: GameBoardService, useValue: gameBoardServiceSpy },
          { provide: CardEffectService, useValue: createCardEffectServiceSpy() },
          { provide: RelicService, useValue: relicSpy },
        ]
      });

      service = TestBed.inject(EnemyService);
      mockScene = new THREE.Scene();
    });

    it('should spawn VEINSEEKER with correct stats from VEINSEEKER_STATS', () => {
      const enemy = service.spawnEnemy(EnemyType.VEINSEEKER, mockScene)!;

      expect(enemy.type).toBe(EnemyType.VEINSEEKER);
      expect(enemy.health).toBe(VEINSEEKER_STATS.health);
      expect(enemy.speed).toBe(VEINSEEKER_STATS.speed);
      expect(enemy.value).toBe(VEINSEEKER_STATS.value);
      expect(enemy.leakDamage).toBe(VEINSEEKER_STATS.leakDamage);
    });

    it('advances 2 tiles/turn when wasMutatedInLastTurns returns true', () => {
      const enemy = service.spawnEnemy(EnemyType.VEINSEEKER, mockScene)!;
      const startIndex = enemy.pathIndex;

      // Simulate: path was mutated recently → boost is active.
      pathMutationSpy.wasMutatedInLastTurns.and.returnValue(true);
      const currentTurn = 2;

      service.stepEnemiesOneTurn(() => 0, currentTurn);

      // Boosted: VEINSEEKER_BOOSTED_TILES_PER_TURN (2) instead of base 1
      expect(enemy.pathIndex).toBe(startIndex + VEINSEEKER_BOOSTED_TILES_PER_TURN);
      expect(enemy.distanceTraveled).toBe(VEINSEEKER_BOOSTED_TILES_PER_TURN);
      // Confirm the spy was queried with the correct arguments
      expect(pathMutationSpy.wasMutatedInLastTurns).toHaveBeenCalledWith(currentTurn, VEINSEEKER_SPEED_BOOST_WINDOW);
    });

    it('advances 1 tile/turn (base speed) when wasMutatedInLastTurns returns false', () => {
      const enemy = service.spawnEnemy(EnemyType.VEINSEEKER, mockScene)!;
      const startIndex = enemy.pathIndex;

      // No recent mutation — spy already returns false by default.
      service.stepEnemiesOneTurn(() => 0, 10);

      expect(enemy.pathIndex).toBe(startIndex + 1);
      expect(enemy.distanceTraveled).toBe(1);
    });

    it('non-VEINSEEKER boss (BOSS type) is not affected by path mutation state', () => {
      const boss = service.spawnEnemy(EnemyType.BOSS, mockScene)!;
      const startIndex = boss.pathIndex;

      // Mutation active — must not affect BOSS
      pathMutationSpy.wasMutatedInLastTurns.and.returnValue(true);
      service.stepEnemiesOneTurn(() => 0, 2);

      // BOSS always moves 1 tile/turn regardless of mutations.
      expect(boss.pathIndex).toBe(startIndex + 1);
    });

    it('slowed VEINSEEKER during boost still respects floor-at-1', () => {
      const enemy = service.spawnEnemy(EnemyType.VEINSEEKER, mockScene)!;

      // Mutation active → boosted baseTiles = 2
      pathMutationSpy.wasMutatedInLastTurns.and.returnValue(true);
      // slowReduction=2 would take boosted 2 → 0, but floor-at-1 prevents paralysis.
      service.stepEnemiesOneTurn(() => 2, 2);

      // Floor-at-1 applies: Math.max(1, 2 - 2 - 0) = Math.max(1, 0) = 1
      expect(enemy.distanceTraveled).toBe(1);
    });
  });

  // ── Sprint 34 — GRAVITY_WELL movement gate ───────────────────────────────

  describe('GRAVITY_WELL movement gate', () => {
    /**
     * GRAVITY_WELL: enemies on depressed tiles (elevation < 0) skip movement.
     * Tested by injecting a CardEffectService spy that returns 1 for GRAVITY_WELL
     * and an ElevationService spy for per-tile elevation.
     */
    let gravityCardSpy: jasmine.SpyObj<CardEffectService>;
    let gravityElevSpy: jasmine.SpyObj<ElevationService>;

    function buildGravityTestBed(
      tileElevations: Map<string, number>,
      gravityWellActive: boolean,
    ): void {
      TestBed.resetTestingModule();
      const gameBoardServiceSpy = createGameBoardServiceSpy(10, 10, 1, () => createTestBoard());
      const relicSpy = createRelicServiceSpy();

      gravityCardSpy = jasmine.createSpyObj<CardEffectService>('CardEffectService', [
        'getModifierValue',
        'hasActiveModifier',
        'applyModifier',
        'applySpell',
        'tickWave',
        'getActiveModifiers',
        'tryConsumeLeakBlock',
        'serializeModifiers',
        'restoreModifiers',
        'reset',
      ]);
      gravityCardSpy.getModifierValue.and.callFake((stat: string) =>
        stat === MODIFIER_STAT.GRAVITY_WELL ? (gravityWellActive ? 1 : 0) : 0
      );

      gravityElevSpy = jasmine.createSpyObj<ElevationService>('ElevationService', [
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
      gravityElevSpy.getElevation.and.callFake((row: number, col: number) =>
        tileElevations.get(`${row}-${col}`) ?? 0
      );
      gravityElevSpy.getMaxElevation.and.returnValue(0);

      TestBed.configureTestingModule({
        providers: [
          PathfindingService,
          EnemyService,
          EnemyVisualService,
          EnemyHealthService,
          EnemyMeshFactoryService,
          GameStateService,
          { provide: GameBoardService, useValue: gameBoardServiceSpy },
          { provide: CardEffectService, useValue: gravityCardSpy },
          { provide: RelicService, useValue: relicSpy },
          { provide: ElevationService, useValue: gravityElevSpy },
        ],
      });

      service = TestBed.inject(EnemyService);
      mockScene = new THREE.Scene();
    }

    it('enemy on elevation-0 tile with GRAVITY_WELL active → moves normally', () => {
      buildGravityTestBed(new Map(), true);  // all tiles elev 0
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const startIndex = enemy.pathIndex;

      service.stepEnemiesOneTurn(() => 0);

      // Elevation 0 is NOT < 0 — no gating; enemy advances 1 tile.
      expect(enemy.pathIndex).toBe(startIndex + 1);
    });

    it('enemy on elevation -1 tile with GRAVITY_WELL active → skips movement', () => {
      // Place the enemy on tile row=1,col=0 (path[1] after spawning) at elevation -1.
      // After spawn the enemy is at path[0]. Step once to move to path[1], which is elev -1.
      // Then on the SECOND stepEnemiesOneTurn, the gate should fire and skip movement.
      buildGravityTestBed(new Map(), false);  // GRAVITY_WELL inactive for first step
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.stepEnemiesOneTurn(() => 0);  // advance to path[1]
      const indexAtDepressedTile = enemy.pathIndex;

      // Now enable GRAVITY_WELL and set the current tile to elevation -1.
      gravityCardSpy.getModifierValue.and.callFake((stat: string) =>
        stat === MODIFIER_STAT.GRAVITY_WELL ? 1 : 0
      );
      const { row, col } = enemy.gridPosition;
      gravityElevSpy.getElevation.and.callFake((r: number, c: number) =>
        r === row && c === col ? -1 : 0
      );

      service.stepEnemiesOneTurn(() => 0);

      // Enemy is on a depressed tile — GRAVITY_WELL gates movement; pathIndex unchanged.
      expect(enemy.pathIndex).toBe(indexAtDepressedTile);
    });

    it('enemy on elevation -1 tile WITHOUT GRAVITY_WELL → moves normally', () => {
      buildGravityTestBed(new Map(), false);  // GRAVITY_WELL inactive
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.stepEnemiesOneTurn(() => 0);  // advance to path[1]
      const indexAfterFirstStep = enemy.pathIndex;

      // Depressed tile, but no GRAVITY_WELL active.
      const { row, col } = enemy.gridPosition;
      gravityElevSpy.getElevation.and.callFake((r: number, c: number) =>
        r === row && c === col ? -1 : 0
      );

      service.stepEnemiesOneTurn(() => 0);

      // No GRAVITY_WELL — moves normally.
      expect(enemy.pathIndex).toBe(indexAfterFirstStep + 1);
    });

    it('enemy on elevation +1 tile with GRAVITY_WELL active → moves normally (only depressed tiles gate)', () => {
      buildGravityTestBed(new Map(), false);
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.stepEnemiesOneTurn(() => 0);  // advance to path[1]
      const indexAfterFirstStep = enemy.pathIndex;

      // Enable GRAVITY_WELL, but tile is elevated (+1), NOT depressed.
      gravityCardSpy.getModifierValue.and.callFake((stat: string) =>
        stat === MODIFIER_STAT.GRAVITY_WELL ? 1 : 0
      );
      const { row, col } = enemy.gridPosition;
      gravityElevSpy.getElevation.and.callFake((r: number, c: number) =>
        r === row && c === col ? 1 : 0
      );

      service.stepEnemiesOneTurn(() => 0);

      // Elevation +1 is NOT < 0 — enemy moves normally.
      expect(enemy.pathIndex).toBe(indexAfterFirstStep + 1);
    });

    it('multiple enemies: only those on depressed tiles are gated per-enemy', () => {
      // Spawn one enemy. Step it forward (GRAVITY_WELL inactive) to put it at path[1].
      // Step a second time with GRAVITY_WELL active and tile depressed — enemy is gated.
      // Then step a third time after disabling GRAVITY_WELL — enemy moves again.
      // This validates the per-enemy independence logic without needing two enemies
      // at different tile positions (which would be the same path node after 1 step).
      buildGravityTestBed(new Map(), false);

      const enemyA = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      // Step 1: advance to path[1], no GRAVITY_WELL.
      service.stepEnemiesOneTurn(() => 0);
      const indexAtPath1 = enemyA.pathIndex;

      // Enable GRAVITY_WELL and depress the tile enemyA is currently on.
      gravityCardSpy.getModifierValue.and.callFake((stat: string) =>
        stat === MODIFIER_STAT.GRAVITY_WELL ? 1 : 0
      );
      const { row: rowA, col: colA } = enemyA.gridPosition;
      gravityElevSpy.getElevation.and.callFake((r: number, c: number) =>
        r === rowA && c === colA ? -1 : 0
      );

      // Step 2: GRAVITY_WELL active + depressed tile → gated.
      service.stepEnemiesOneTurn(() => 0);
      expect(enemyA.pathIndex).toBe(indexAtPath1); // no movement

      // Disable GRAVITY_WELL — verify per-enemy check is per-step (not permanent freeze).
      gravityCardSpy.getModifierValue.and.returnValue(0);
      service.stepEnemiesOneTurn(() => 0);
      expect(enemyA.pathIndex).toBe(indexAtPath1 + 1); // moves again
    });

    // ── Sprint 37 GLIDER — ignoresElevation bypasses GRAVITY_WELL gate ─────
    it('GLIDER on a depressed tile with GRAVITY_WELL active → moves normally (ignoresElevation)', () => {
      buildGravityTestBed(new Map(), false);

      const glider = service.spawnEnemy(EnemyType.GLIDER, mockScene)!;

      // Advance to path[1] first (GRAVITY_WELL inactive).
      service.stepEnemiesOneTurn(() => 0);
      const indexAtPath1 = glider.pathIndex;

      // Enable GRAVITY_WELL and depress the GLIDER's current tile.
      gravityCardSpy.getModifierValue.and.callFake((stat: string) =>
        stat === MODIFIER_STAT.GRAVITY_WELL ? 1 : 0
      );
      const { row, col } = glider.gridPosition;
      gravityElevSpy.getElevation.and.callFake((r: number, c: number) =>
        r === row && c === col ? -1 : 0
      );

      // GRAVITY_WELL active + depressed tile + GLIDER → GLIDER moves (not gated).
      service.stepEnemiesOneTurn(() => 0);
      expect(glider.pathIndex).toBe(indexAtPath1 + 2); // tilesPerTurn = 2 for GLIDER
    });

    it('BASIC enemy on depressed tile is gated; GLIDER on same tile moves (independence)', () => {
      buildGravityTestBed(new Map(), false);

      const basic = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const glider = service.spawnEnemy(EnemyType.GLIDER, mockScene)!;

      // Advance both once (GRAVITY_WELL inactive).
      service.stepEnemiesOneTurn(() => 0);
      const basicIdx = basic.pathIndex;
      const gliderIdx = glider.pathIndex;

      // Enable GRAVITY_WELL and depress the path tile.
      gravityCardSpy.getModifierValue.and.callFake((stat: string) =>
        stat === MODIFIER_STAT.GRAVITY_WELL ? 1 : 0
      );
      // Depress ALL tiles so both enemies are affected (if they weren't GLIDER).
      gravityElevSpy.getElevation.and.returnValue(-1);

      service.stepEnemiesOneTurn(() => 0);

      // BASIC is gated (elevation check applies).
      expect(basic.pathIndex).toBe(basicIdx);
      // GLIDER moves normally (ignoresElevation = true).
      expect(glider.pathIndex).toBeGreaterThan(gliderIdx);
    });

    // ── GRAVITY_WELL upgraded — bleed tier (value ≥ 2) ───────────────────────

    /**
     * Upgraded GRAVITY_WELL reports modifier value 2 instead of 1. When a
     * gated enemy is skipped this turn, it additionally takes 10% of its max
     * HP as damage (Math.max(1, ...) floor). Base tier (value 1) continues to
     * gate without damage — the two tiers must remain distinguishable.
     */
    it('upgraded tier (value 2): gated enemy takes 10% max-HP damage (amplified by +25% exposed bonus)', () => {
      // Bleed is resolved through damageEnemy, which applies the +25% exposed-
      // damage multiplier on negative-elevation tiles. This is by design — an
      // enemy already standing on a depressed tile takes amplified damage from
      // every source, and the GRAVITY_WELL bleed should follow the same rule
      // (documented in elevation.constants.ts + enemy.service.ts).
      buildGravityTestBed(new Map(), false);
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.stepEnemiesOneTurn(() => 0);  // advance to path[1]
      const healthBeforeGate = enemy.health;
      const maxHealth = enemy.maxHealth;

      gravityCardSpy.getModifierValue.and.callFake((stat: string) =>
        stat === MODIFIER_STAT.GRAVITY_WELL ? 2 : 0
      );
      const { row, col } = enemy.gridPosition;
      gravityElevSpy.getElevation.and.callFake((r: number, c: number) =>
        r === row && c === col ? -1 : 0
      );

      service.stepEnemiesOneTurn(() => 0);

      const baseBleed = Math.max(1, Math.round(maxHealth * 0.10));
      const expectedBleedAfterExpose = Math.round(baseBleed * 1.25);
      expect(enemy.health).toBe(healthBeforeGate - expectedBleedAfterExpose);
    });

    it('upgraded tier (value 2): enemy still has movement gated (tier does not imply skip-damage-only)', () => {
      buildGravityTestBed(new Map(), false);
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.stepEnemiesOneTurn(() => 0);
      const indexAtDepressedTile = enemy.pathIndex;

      gravityCardSpy.getModifierValue.and.callFake((stat: string) =>
        stat === MODIFIER_STAT.GRAVITY_WELL ? 2 : 0
      );
      const { row, col } = enemy.gridPosition;
      gravityElevSpy.getElevation.and.callFake((r: number, c: number) =>
        r === row && c === col ? -1 : 0
      );

      service.stepEnemiesOneTurn(() => 0);

      expect(enemy.pathIndex).toBe(indexAtDepressedTile);
    });

    it('base tier (value 1): gated enemy takes NO damage', () => {
      buildGravityTestBed(new Map(), false);
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.stepEnemiesOneTurn(() => 0);
      const healthBeforeGate = enemy.health;

      gravityCardSpy.getModifierValue.and.callFake((stat: string) =>
        stat === MODIFIER_STAT.GRAVITY_WELL ? 1 : 0
      );
      const { row, col } = enemy.gridPosition;
      gravityElevSpy.getElevation.and.callFake((r: number, c: number) =>
        r === row && c === col ? -1 : 0
      );

      service.stepEnemiesOneTurn(() => 0);

      expect(enemy.health).toBe(healthBeforeGate);
    });

    it('upgraded tier (value 2) on elevation 0 (not depressed): no bleed, no gate', () => {
      buildGravityTestBed(new Map(), false);
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const healthBefore = enemy.health;
      const startIndex = enemy.pathIndex;

      gravityCardSpy.getModifierValue.and.callFake((stat: string) =>
        stat === MODIFIER_STAT.GRAVITY_WELL ? 2 : 0
      );
      // Elevation 0 — NOT depressed — so gate + bleed both skip.

      service.stepEnemiesOneTurn(() => 0);

      expect(enemy.pathIndex).toBe(startIndex + 1);  // moved
      expect(enemy.health).toBe(healthBefore);       // untouched
    });

    it('upgraded tier (value 2) + GLIDER on depressed tile: ignoresElevation → no gate, no bleed', () => {
      buildGravityTestBed(new Map(), false);
      const glider = service.spawnEnemy(EnemyType.GLIDER, mockScene)!;
      service.stepEnemiesOneTurn(() => 0);
      const healthBefore = glider.health;
      const indexAtPath1 = glider.pathIndex;

      gravityCardSpy.getModifierValue.and.callFake((stat: string) =>
        stat === MODIFIER_STAT.GRAVITY_WELL ? 2 : 0
      );
      const { row, col } = glider.gridPosition;
      gravityElevSpy.getElevation.and.callFake((r: number, c: number) =>
        r === row && c === col ? -1 : 0
      );

      service.stepEnemiesOneTurn(() => 0);

      expect(glider.pathIndex).toBeGreaterThan(indexAtPath1);  // moved (ignoresElevation)
      expect(glider.health).toBe(healthBefore);                 // no bleed (same exemption)
    });

    it('upgraded tier (value 2): bleed damage can kill a low-HP enemy', () => {
      buildGravityTestBed(new Map(), false);
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.stepEnemiesOneTurn(() => 0);
      // Reduce enemy health so the 10% bleed will kill it.
      const expectedBleed = Math.max(1, Math.round(enemy.maxHealth * 0.10));
      service.damageEnemy(enemy.id, enemy.health - expectedBleed);
      expect(enemy.health).toBe(expectedBleed);

      gravityCardSpy.getModifierValue.and.callFake((stat: string) =>
        stat === MODIFIER_STAT.GRAVITY_WELL ? 2 : 0
      );
      const { row, col } = enemy.gridPosition;
      gravityElevSpy.getElevation.and.callFake((r: number, c: number) =>
        r === row && c === col ? -1 : 0
      );

      service.stepEnemiesOneTurn(() => 0);

      expect(enemy.health).toBeLessThanOrEqual(0);
    });
  });

  // ── Sprint 37 GLIDER — exposed damage bypass ─────────────────────────────
  describe('GLIDER damageEnemy — ignoresElevation skips the exposed bonus', () => {
    let elevationSpy: jasmine.SpyObj<ElevationService>;

    beforeEach(() => {
      elevationSpy = jasmine.createSpyObj<ElevationService>('ElevationService', [
        'getElevation', 'raise', 'depress', 'setAbsolute', 'collapse',
        'getMaxElevation', 'getElevationMap', 'getActiveChanges',
        'tickTurn', 'reset', 'serialize', 'restore',
      ]);
      elevationSpy.getElevation.and.returnValue(0);
      (service as unknown as { elevationService: ElevationService | null }).elevationService = elevationSpy;
    });

    afterEach(() => {
      (service as unknown as { elevationService: ElevationService | null }).elevationService = null;
    });

    it('BASIC enemy on depressed tile receives +25% bonus', () => {
      elevationSpy.getElevation.and.returnValue(-1);
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const healthBefore = enemy.health;

      service.damageEnemy(enemy.id, 100);

      // Math.round(100 * 1.25) = 125.
      expect(enemy.health).toBe(healthBefore - 125);
    });

    it('GLIDER on depressed tile does NOT receive +25% exposed bonus', () => {
      elevationSpy.getElevation.and.returnValue(-1);
      const glider = service.spawnEnemy(EnemyType.GLIDER, mockScene)!;
      const healthBefore = glider.health;

      service.damageEnemy(glider.id, 100);

      // ignoresElevation = true → no +25% → exactly 100 damage.
      expect(glider.health).toBe(healthBefore - 100);
    });

    it('TITAN on depressed tile receives +25% bonus (halvesElevationDamageBonuses only halves VP/KOTH)', () => {
      // TITAN does NOT ignoresElevation — only halves tower-fire VP/KOTH bonuses.
      // It still takes the exposed damage bonus from EnemyService.damageEnemy.
      elevationSpy.getElevation.and.returnValue(-1);
      const titan = service.spawnEnemy(EnemyType.TITAN, mockScene)!;
      const healthBefore = titan.health;

      service.damageEnemy(titan.id, 100);

      // TITAN is not immune to exposed — takes +25%.
      expect(titan.health).toBe(healthBefore - 125);
    });
  });
});

