import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { EnemyType } from '../models/enemy.model';
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

    it('should spawn all enemy types with correct stats', () => {
      const types: EnemyType[] = [
        EnemyType.BASIC,
        EnemyType.FAST,
        EnemyType.HEAVY,
        EnemyType.FLYING,
        EnemyType.BOSS
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
      // Block the direct path
      const blockedCells = [
        { row: 1, col: 1 },
        { row: 2, col: 2 },
        { row: 3, col: 3 }
      ];
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
      const enemy1 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const enemy2 = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Simulate different frame rates
      // 60 FPS: 10 frames at 0.0167s each = 0.167s total
      for (let i = 0; i < 10; i++) {
        service.updateEnemies(1/60);
      }
      const distance1 = enemy1!.distanceTraveled;

      // 30 FPS: 5 frames at 0.033s each = 0.165s total
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

      // Large delta time (1 second)
      service.updateEnemies(1.0);

      // Should advance multiple nodes
      expect(enemy!.pathIndex).toBeGreaterThan(1);
    });

    it('should handle negative delta time gracefully', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const initialPathIndex = enemy!.pathIndex;

      // Negative delta shouldn't cause issues
      service.updateEnemies(-0.1);

      // Should not move backwards
      expect(enemy!.pathIndex).toBe(initialPathIndex);
    });

    it('should get all active enemies', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      service.spawnEnemy(EnemyType.FAST, mockScene);
      service.spawnEnemy(EnemyType.HEAVY, mockScene);

      const enemies = service.getEnemies();
      expect(enemies.size).toBe(3);
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
