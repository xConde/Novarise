import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { EnemyType, ENEMY_STATS, MINI_SWARM_STATS } from '../models/enemy.model';
import { BlockType, GameBoardTile } from '../models/game-board-tile';

describe('EnemyService', () => {
  let service: EnemyService;
  let gameBoardService: jasmine.SpyObj<GameBoardService>;
  let mockScene: THREE.Scene;

  // Mock board: 10x10 grid with spawner at (0,0), exit at (9,9)
  const createMockBoard = (blockedCells: { row: number, col: number }[] = []): GameBoardTile[][] => {
    const board: GameBoardTile[][] = [];
    for (let row = 0; row < 10; row++) {
      board[row] = [];
      for (let col = 0; col < 10; col++) {
        // Check if this cell is blocked
        const isBlocked = blockedCells.some(b => b.row === row && b.col === col);

        if (row === 0 && col === 0) {
          board[row][col] = GameBoardTile.createSpawner(row, col);
        } else if (row === 9 && col === 9) {
          board[row][col] = GameBoardTile.createExit(row, col);
        } else if (isBlocked) {
          // Create a non-traversable tile (like a tower)
          board[row][col] = new GameBoardTile(row, col, BlockType.BASE, false, false, null, null);
        } else {
          board[row][col] = GameBoardTile.createBase(row, col);
        }
      }
    }
    return board;
  };

  beforeEach(() => {
    const gameBoardServiceSpy = jasmine.createSpyObj('GameBoardService', [
      'getGameBoard',
      'getBoardWidth',
      'getBoardHeight',
      'getTileSize'
    ]);

    TestBed.configureTestingModule({
      providers: [
        EnemyService,
        { provide: GameBoardService, useValue: gameBoardServiceSpy }
      ]
    });

    service = TestBed.inject(EnemyService);
    gameBoardService = TestBed.inject(GameBoardService) as jasmine.SpyObj<GameBoardService>;
    mockScene = new THREE.Scene();

    // Default mock returns
    gameBoardService.getBoardWidth.and.returnValue(10);
    gameBoardService.getBoardHeight.and.returnValue(10);
    gameBoardService.getTileSize.and.returnValue(1);
    gameBoardService.getGameBoard.and.returnValue(createMockBoard());
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

    it('should spawn all enemy types with correct stats', () => {
      const types: EnemyType[] = [
        EnemyType.BASIC,
        EnemyType.FAST,
        EnemyType.HEAVY,
        EnemyType.SWIFT,
        EnemyType.BOSS,
        EnemyType.SHIELDED,
        EnemyType.SWARM,
        EnemyType.FLYING
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

    it('should return null when path is completely blocked', () => {
      // Create a board with blocked path
      const blockedCells = [
        { row: 0, col: 1 },
        { row: 1, col: 0 }
      ];
      gameBoardService.getGameBoard.and.returnValue(createMockBoard(blockedCells));

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(enemy).toBeNull();
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
      gameBoardService.getGameBoard.and.returnValue(createMockBoard(blockedCells));

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
      gameBoardService.getGameBoard.and.returnValue(createMockBoard(blockedCells));

      const enemy2 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const pathLength2 = enemy2!.path.length;

      // New path should be different (likely longer due to obstacle)
      expect(pathLength2).toBeGreaterThanOrEqual(pathLength1);
    });
  });

  describe('Enemy Movement', () => {
    it('should move enemy along path', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const initialPathIndex = enemy!.pathIndex;

      // Update with small delta time
      service.updateEnemies(0.1);

      // Enemy should have moved
      expect(enemy!.distanceTraveled).toBeGreaterThan(0);
    });

    it('should advance pathIndex when reaching next node', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Update with large delta time to ensure node advancement
      service.updateEnemies(2.0);

      // Should have advanced at least one node
      expect(enemy!.pathIndex).toBeGreaterThan(0);
    });

    it('should update mesh position during movement', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const initialMeshPos = enemy!.mesh!.position.clone();

      service.updateEnemies(0.5);

      const newMeshPos = enemy!.mesh!.position;

      // Mesh should have moved (x or z changed)
      const hasMoved =
        newMeshPos.x !== initialMeshPos.x ||
        newMeshPos.z !== initialMeshPos.z;

      expect(hasMoved).toBe(true);
    });

    it('should return enemy IDs that reached exit', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Force enemy to last node
      enemy!.pathIndex = enemy!.path.length - 1;

      const reachedExit = service.updateEnemies(0.1);

      expect(reachedExit).toContain(enemy!.id);
    });

    it('should handle multiple enemies simultaneously', () => {
      const enemy1 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const enemy2 = service.spawnEnemy(EnemyType.FAST, mockScene);
      const enemy3 = service.spawnEnemy(EnemyType.HEAVY, mockScene);

      service.updateEnemies(0.1);

      // All enemies should have moved
      expect(enemy1!.distanceTraveled).toBeGreaterThan(0);
      expect(enemy2!.distanceTraveled).toBeGreaterThan(0);
      expect(enemy3!.distanceTraveled).toBeGreaterThan(0);

      // Fast enemy should have moved more than heavy
      expect(enemy2!.distanceTraveled).toBeGreaterThan(enemy3!.distanceTraveled);
    });

    it('should maintain consistent speed regardless of frame rate', () => {
      // Test each frame rate in isolation to avoid cross-contamination

      // 60 FPS: 10 frames at 1/60s each = 0.1667s total
      const enemy1 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      for (let i = 0; i < 10; i++) {
        service.updateEnemies(1/60);
      }
      const distance1 = enemy1!.distanceTraveled;

      // Remove enemy1 before testing enemy2
      service.removeEnemy(enemy1!.id, mockScene);

      // 30 FPS: 5 frames at 1/30s each = 0.1667s total
      const enemy2 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      for (let i = 0; i < 5; i++) {
        service.updateEnemies(1/30);
      }
      const distance2 = enemy2!.distanceTraveled;

      // Should be approximately the same distance (within 5% tolerance)
      expect(Math.abs(distance1 - distance2) / distance1).toBeLessThan(0.05);
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
    it('should handle zero delta time', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const initialDistance = enemy!.distanceTraveled;

      service.updateEnemies(0);

      expect(enemy!.distanceTraveled).toBe(initialDistance);
    });

    it('should handle very large delta time', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Multiple updates with large delta time (1 second each)
      service.updateEnemies(1.0);
      service.updateEnemies(1.0);
      service.updateEnemies(1.0);

      // Should advance multiple nodes
      expect(enemy!.pathIndex).toBeGreaterThan(1);
    });

    it('should handle negative delta time gracefully', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const initialPathIndex = enemy!.pathIndex;
      const initialPos = { ...enemy!.position };

      // Negative delta should be rejected entirely
      const result = service.updateEnemies(-0.1);

      // Should not move at all (pathIndex and position unchanged)
      expect(enemy!.pathIndex).toBe(initialPathIndex);
      expect(enemy!.position.x).toBe(initialPos.x);
      expect(enemy!.position.z).toBe(initialPos.z);
      expect(result).toEqual([]);
    });

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

      it('should remove shield mesh from userData when shield breaks', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;

        // Shield mesh should exist before break
        expect(enemy.mesh!.userData['shieldMesh']).toBeTruthy();

        service.damageEnemy(enemy.id, maxShield);

        expect(enemy.shield).toBe(0);
        expect(enemy.mesh!.userData['shieldMesh']).toBeUndefined();
      });

      it('should remove shield mesh from enemy mesh children when shield breaks', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;
        const childrenBefore = enemy.mesh!.children.length;

        service.damageEnemy(enemy.id, maxShield);

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
  });

  describe('Dead Enemy Movement Guard', () => {
    it('should not move dead enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const initialPos = { ...enemy.position };

      // Kill the enemy
      service.damageEnemy(enemy.id, enemy.maxHealth);

      // Try to move
      service.updateEnemies(0.5);

      // Position should not change
      expect(enemy.position.x).toBe(initialPos.x);
      expect(enemy.position.z).toBe(initialPos.z);
    });

    it('should not report dead enemies as reaching exit', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      // Put enemy at exit and kill it
      enemy.pathIndex = enemy.path.length - 1;
      service.damageEnemy(enemy.id, enemy.maxHealth);

      const reachedExit = service.updateEnemies(0.1);

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

      // Update all enemies
      service.updateEnemies(0.016); // ~60 FPS

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 16ms for 60 FPS)
      expect(duration).toBeLessThan(100); // Allow 100ms for test overhead
      expect(service.getEnemies().size).toBe(enemyCount);
    });
  });
});
