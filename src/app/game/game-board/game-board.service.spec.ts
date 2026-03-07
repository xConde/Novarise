import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { GameBoardService } from './game-board.service';
import { BlockType, GameBoardTile } from './models/game-board-tile';
import { TowerType } from './models/tower.model';

describe('GameBoardService', () => {
  let service: GameBoardService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GameBoardService]
    });
    service = TestBed.inject(GameBoardService);
  });

  // --- Initial State (lazy constructor) ---

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with an empty board (no eager generation)', () => {
    expect(service.getGameBoard().length).toBe(0);
  });

  // --- resetBoard ---

  describe('resetBoard', () => {
    beforeEach(() => {
      service.resetBoard();
    });

    it('should create a 25x20 board', () => {
      expect(service.getBoardWidth()).toBe(25);
      expect(service.getBoardHeight()).toBe(20);
      expect(service.getGameBoard().length).toBe(20);
      service.getGameBoard().forEach(row => expect(row.length).toBe(25));
    });

    it('should populate all tiles with valid GameBoardTile objects', () => {
      const board = service.getGameBoard();
      for (let row = 0; row < 20; row++) {
        for (let col = 0; col < 25; col++) {
          const tile = board[row][col];
          expect(tile).toBeTruthy();
          expect(tile.x).toBeDefined();
          expect(tile.y).toBeDefined();
          expect(tile.type).toBeDefined();
        }
      }
    });

    it('should place exit tiles at center coordinates', () => {
      const board = service.getGameBoard();
      const exitCoords = [[9, 11], [9, 12], [10, 11], [10, 12]];
      exitCoords.forEach(([row, col]) => {
        expect(board[row][col].type).toBe(BlockType.EXIT);
        expect(board[row][col].isTraversable).toBeFalse();
      });
    });

    it('should place at least one spawner tile', () => {
      const board = service.getGameBoard();
      let spawnerCount = 0;
      for (let row = 0; row < 20; row++) {
        for (let col = 0; col < 25; col++) {
          if (board[row][col].type === BlockType.SPAWNER) {
            spawnerCount++;
          }
        }
      }
      expect(spawnerCount).toBeGreaterThan(0);
    });

    it('should make non-special tiles traversable and purchasable', () => {
      const board = service.getGameBoard();
      // Check a tile that's definitely not exit or spawner (center of board)
      const tile = board[10][5];
      if (tile.type === BlockType.BASE) {
        expect(tile.isTraversable).toBeTrue();
        expect(tile.isPurchasable).toBeTrue();
      }
    });

    it('should fully reset state when called multiple times', () => {
      // Import a custom board with a tower, then reset and verify clean state
      const board = createTestBoard(10, 10);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[9][9] = GameBoardTile.createExit(9, 9);
      service.importBoard(board, 10, 10);
      service.placeTower(5, 5, TowerType.BASIC);
      expect(service.getGameBoard()[5][5].type).toBe(BlockType.TOWER);

      // Reset restores default 25x20 board — all internal state is cleared
      service.resetBoard();
      const freshBoard = service.getGameBoard();
      expect(freshBoard.length).toBe(20);
      expect(freshBoard[0].length).toBe(25);
      // The imported tower is gone — tile (5,5) is BASE on the fresh board
      expect(freshBoard[5][5].type).toBe(BlockType.BASE);
    });
  });

  // --- importBoard ---

  describe('importBoard', () => {
    it('should replace the board with the provided data', () => {
      const board = createTestBoard(10, 10);
      service.importBoard(board, 10, 10);

      expect(service.getBoardWidth()).toBe(10);
      expect(service.getBoardHeight()).toBe(10);
      expect(service.getGameBoard()).toBe(board);
    });

    it('should scan for spawner tiles in imported board', () => {
      const board = createTestBoard(5, 5);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[0][1] = GameBoardTile.createSpawner(0, 1);

      service.importBoard(board, 5, 5);

      // Spawner tiles should be detected (verified indirectly via board state)
      expect(service.getGameBoard()[0][0].type).toBe(BlockType.SPAWNER);
      expect(service.getGameBoard()[0][1].type).toBe(BlockType.SPAWNER);
    });

    it('should scan for exit tiles in imported board', () => {
      const board = createTestBoard(5, 5);
      board[4][4] = GameBoardTile.createExit(4, 4);

      service.importBoard(board, 5, 5);

      expect(service.getGameBoard()[4][4].type).toBe(BlockType.EXIT);
    });

    it('should handle boards with WALL tiles', () => {
      const board = createTestBoard(5, 5);
      board[2][2] = GameBoardTile.createWall(2, 2);

      service.importBoard(board, 5, 5);

      expect(service.getGameBoard()[2][2].type).toBe(BlockType.WALL);
      expect(service.getGameBoard()[2][2].isTraversable).toBeFalse();
    });

    it('should accept non-square boards', () => {
      const board = createTestBoard(30, 15);
      service.importBoard(board, 30, 15);

      expect(service.getBoardWidth()).toBe(30);
      expect(service.getBoardHeight()).toBe(15);
      expect(service.getGameBoard().length).toBe(15);
      expect(service.getGameBoard()[0].length).toBe(30);
    });

    it('should clear previous state when importing', () => {
      // First, set up a board with a tower
      const prevBoard = createTestBoard(10, 10);
      prevBoard[0][0] = GameBoardTile.createSpawner(0, 0);
      prevBoard[9][9] = GameBoardTile.createExit(9, 9);
      service.importBoard(prevBoard, 10, 10);
      service.placeTower(5, 5, TowerType.BASIC);

      // Import a clean board
      const board = createTestBoard(8, 8);
      service.importBoard(board, 8, 8);

      expect(service.getBoardWidth()).toBe(8);
      expect(service.getBoardHeight()).toBe(8);
      // Old 25x20 board with tower is gone
      expect(service.getGameBoard().length).toBe(8);
    });
  });

  // --- canPlaceTower ---

  describe('canPlaceTower', () => {
    beforeEach(() => {
      // Use a deterministic board with known spawner/exit so path validation is predictable
      const board = createTestBoard(10, 10);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[9][9] = GameBoardTile.createExit(9, 9);
      service.importBoard(board, 10, 10);
    });

    it('should allow placement on BASE purchasable tiles', () => {
      // Tile (5, 5) is BASE and won't block the path on a 10x10 open board
      expect(service.canPlaceTower(5, 5)).toBeTrue();
    });

    it('should reject placement on EXIT tiles', () => {
      expect(service.canPlaceTower(9, 9)).toBeFalse();
    });

    it('should reject placement on SPAWNER tiles', () => {
      expect(service.canPlaceTower(0, 0)).toBeFalse();
    });

    it('should reject out-of-bounds positions', () => {
      expect(service.canPlaceTower(-1, 0)).toBeFalse();
      expect(service.canPlaceTower(0, -1)).toBeFalse();
      expect(service.canPlaceTower(10, 0)).toBeFalse();
      expect(service.canPlaceTower(0, 10)).toBeFalse();
    });

    it('should reject placement on already-occupied tiles', () => {
      service.placeTower(5, 5, TowerType.BASIC);
      expect(service.canPlaceTower(5, 5)).toBeFalse();
    });

    it('should reject placement on WALL tiles', () => {
      const board = createTestBoard(5, 5);
      board[2][2] = GameBoardTile.createWall(2, 2);
      service.importBoard(board, 5, 5);

      expect(service.canPlaceTower(2, 2)).toBeFalse();
    });

    it('should reject placement that would block the only path', () => {
      // 5-wide corridor: spawner at (0,0), exit at (0,4), path along row 0
      // Walls block rows 1-2 except the corridor at row 0
      const board = createTestBoard(5, 3);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[0][4] = GameBoardTile.createExit(0, 4);
      // Wall off row 1 and 2 entirely
      for (let col = 0; col < 5; col++) {
        board[1][col] = GameBoardTile.createWall(1, col);
        board[2][col] = GameBoardTile.createWall(2, col);
      }
      service.importBoard(board, 5, 3);

      // Blocking tile (0,2) would cut the only path
      expect(service.canPlaceTower(0, 2)).toBeFalse();
    });

    it('should allow placement when alternative paths exist', () => {
      // Open board with spawner and exit — placing one tower won't block
      const board = createTestBoard(5, 5);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[4][4] = GameBoardTile.createExit(4, 4);
      service.importBoard(board, 5, 5);

      // Placing at (2,2) should be fine — many paths around
      expect(service.canPlaceTower(2, 2)).toBeTrue();
    });
  });

  // --- wouldBlockPath ---

  describe('wouldBlockPath', () => {
    it('should return true when tile blocks the only path in a narrow corridor', () => {
      // Row 0: S . X . E  (X = tile under test)
      // Row 1: W W W W W
      const board = createTestBoard(5, 2);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[0][4] = GameBoardTile.createExit(0, 4);
      for (let col = 0; col < 5; col++) {
        board[1][col] = GameBoardTile.createWall(1, col);
      }
      service.importBoard(board, 5, 2);

      expect(service.wouldBlockPath(0, 2)).toBeTrue();
    });

    it('should return false when alternative paths exist', () => {
      const board = createTestBoard(5, 5);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[4][4] = GameBoardTile.createExit(4, 4);
      service.importBoard(board, 5, 5);

      // Center tile — plenty of paths around
      expect(service.wouldBlockPath(2, 2)).toBeFalse();
    });

    it('should return false when there are no spawners', () => {
      const board = createTestBoard(5, 5);
      board[4][4] = GameBoardTile.createExit(4, 4);
      service.importBoard(board, 5, 5);

      expect(service.wouldBlockPath(2, 2)).toBeFalse();
    });

    it('should return false when there are no exits', () => {
      const board = createTestBoard(5, 5);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      service.importBoard(board, 5, 5);

      expect(service.wouldBlockPath(2, 2)).toBeFalse();
    });

    it('should detect blocking next to spawner', () => {
      // S X E
      // W W W
      const board = createTestBoard(3, 2);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[0][2] = GameBoardTile.createExit(0, 2);
      board[1][0] = GameBoardTile.createWall(1, 0);
      board[1][1] = GameBoardTile.createWall(1, 1);
      board[1][2] = GameBoardTile.createWall(1, 2);
      service.importBoard(board, 3, 2);

      // Blocking (0,1) cuts spawner from exit
      expect(service.wouldBlockPath(0, 1)).toBeTrue();
    });

    it('should detect blocking next to exit', () => {
      // S . X E
      // W W W W
      const board = createTestBoard(4, 2);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[0][3] = GameBoardTile.createExit(0, 3);
      for (let col = 0; col < 4; col++) {
        board[1][col] = GameBoardTile.createWall(1, col);
      }
      service.importBoard(board, 4, 2);

      // Blocking (0,2) — right next to exit — cuts the path
      expect(service.wouldBlockPath(0, 2)).toBeTrue();
    });

    it('should restore tile state after check', () => {
      const board = createTestBoard(5, 5);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[4][4] = GameBoardTile.createExit(4, 4);
      service.importBoard(board, 5, 5);

      const tileBefore = service.getGameBoard()[2][2];
      service.wouldBlockPath(2, 2);
      const tileAfter = service.getGameBoard()[2][2];

      expect(tileAfter).toBe(tileBefore);
      expect(tileAfter.type).toBe(BlockType.BASE);
    });

    it('should handle multiple spawners — blocks if any spawner loses path', () => {
      // Two spawners on opposite sides, one narrow corridor
      // S1 . X . S2
      // W  W W W W
      // .  . . . .
      // .  . E . .
      const board = createTestBoard(5, 4);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[0][4] = GameBoardTile.createSpawner(0, 4);
      board[3][2] = GameBoardTile.createExit(3, 2);
      for (let col = 0; col < 5; col++) {
        board[1][col] = GameBoardTile.createWall(1, col);
      }
      service.importBoard(board, 5, 4);

      // Blocking (0,2) cuts the corridor for both top spawners
      expect(service.wouldBlockPath(0, 2)).toBeTrue();
    });

    it('should allow placement when only one of multiple paths is blocked', () => {
      // S . . .
      // . X . .
      // . . . .
      // . . . E
      const board = createTestBoard(4, 4);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[3][3] = GameBoardTile.createExit(3, 3);
      service.importBoard(board, 4, 4);

      // Wide open board, blocking (1,1) still leaves paths
      expect(service.wouldBlockPath(1, 1)).toBeFalse();
    });

    it('should handle 2x2 spawner at board corner (all neighbors OOB or spawner)', () => {
      // 20 rows x 10 cols board with 2x2 spawner at bottom-left corner
      // and exit at top-right. The corner tile [19,0] has all 4 neighbors
      // either OOB or SPAWNER — BFS must walk the spawner group to find
      // traversable neighbors from [18,1] or [19,1].
      const board = createTestBoard(10, 20);
      // 2x2 spawner block at bottom-left: rows 18-19, cols 0-1
      board[18][0] = GameBoardTile.createSpawner(18, 0);
      board[18][1] = GameBoardTile.createSpawner(18, 1);
      board[19][0] = GameBoardTile.createSpawner(19, 0);
      board[19][1] = GameBoardTile.createSpawner(19, 1);
      board[0][9] = GameBoardTile.createExit(0, 9);
      service.importBoard(board, 10, 20);

      // Should NOT block — middle of the board is wide open
      expect(service.wouldBlockPath(10, 5)).toBeFalse();
    });
  });

  // --- placeTower ---

  describe('placeTower', () => {
    beforeEach(() => {
      // Deterministic board with spawner/exit for path validation
      const board = createTestBoard(10, 10);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[9][9] = GameBoardTile.createExit(9, 9);
      service.importBoard(board, 10, 10);
    });

    it('should place a tower on a valid tile', () => {
      const result = service.placeTower(5, 5, TowerType.BASIC);
      expect(result).toBeTrue();
      expect(service.getGameBoard()[5][5].type).toBe(BlockType.TOWER);
    });

    it('should mark tower tile as non-traversable', () => {
      service.placeTower(5, 5, TowerType.BASIC);
      expect(service.getGameBoard()[5][5].isTraversable).toBeFalse();
    });

    it('should mark tower tile as non-purchasable', () => {
      service.placeTower(5, 5, TowerType.BASIC);
      expect(service.getGameBoard()[5][5].isPurchasable).toBeFalse();
    });

    it('should return false for invalid placement', () => {
      const result = service.placeTower(-1, -1, TowerType.BASIC);
      expect(result).toBeFalse();
    });

    it('should prevent double-placement on same tile', () => {
      service.placeTower(5, 5, TowerType.BASIC);
      const result = service.placeTower(5, 5, TowerType.SNIPER);
      expect(result).toBeFalse();
    });

    it('should preserve tile coordinates after placement', () => {
      service.placeTower(5, 5, TowerType.BASIC);
      const tile = service.getGameBoard()[5][5];
      expect(tile.x).toBe(5);
      expect(tile.y).toBe(5);
    });
  });

  // --- removeTower ---

  describe('removeTower', () => {
    beforeEach(() => {
      // Deterministic board with spawner/exit for path validation
      const board = createTestBoard(10, 10);
      board[0][0] = GameBoardTile.createSpawner(0, 0);
      board[9][9] = GameBoardTile.createExit(9, 9);
      service.importBoard(board, 10, 10);
    });

    it('should remove a tower and restore BASE tile', () => {
      service.placeTower(5, 5, TowerType.BASIC);
      const result = service.removeTower(5, 5);

      expect(result).toBeTrue();
      const tile = service.getGameBoard()[5][5];
      expect(tile.type).toBe(BlockType.BASE);
      expect(tile.isTraversable).toBeTrue();
      expect(tile.isPurchasable).toBeTrue();
    });

    it('should return false for non-tower tile', () => {
      expect(service.removeTower(5, 5)).toBeFalse(); // BASE tile, no tower
    });

    it('should return false for out-of-bounds', () => {
      expect(service.removeTower(-1, 0)).toBeFalse();
      expect(service.removeTower(0, -1)).toBeFalse();
      expect(service.removeTower(10, 0)).toBeFalse();
      expect(service.removeTower(0, 10)).toBeFalse();
    });

    it('should allow re-placement after removal', () => {
      service.placeTower(5, 5, TowerType.BASIC);
      service.removeTower(5, 5);

      const result = service.placeTower(5, 5, TowerType.SNIPER);
      expect(result).toBeTrue();
      expect(service.getGameBoard()[5][5].type).toBe(BlockType.TOWER);
    });
  });

  // --- createTowerMesh for new tower types ---

  describe('createTowerMesh — new tower types', () => {
    beforeEach(() => {
      service.resetBoard();
    });

    it('should create a mesh group for SLOW tower', () => {
      const group = service.createTowerMesh(5, 5, TowerType.SLOW);
      expect(group).toBeTruthy();
      expect(group instanceof THREE.Group).toBeTrue();
      expect(group.children.length).toBeGreaterThan(0);
      // Dispose after test
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            (child.material as THREE.Material).dispose();
          }
        }
      });
    });

    it('should create a mesh group for CHAIN tower', () => {
      const group = service.createTowerMesh(5, 5, TowerType.CHAIN);
      expect(group).toBeTruthy();
      expect(group instanceof THREE.Group).toBeTrue();
      expect(group.children.length).toBeGreaterThan(0);
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            (child.material as THREE.Material).dispose();
          }
        }
      });
    });

    it('should create a mesh group for MORTAR tower', () => {
      const group = service.createTowerMesh(5, 5, TowerType.MORTAR);
      expect(group).toBeTruthy();
      expect(group instanceof THREE.Group).toBeTrue();
      expect(group.children.length).toBeGreaterThan(0);
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            (child.material as THREE.Material).dispose();
          }
        }
      });
    });

    it('should position SLOW tower at the correct world coordinates', () => {
      const group = service.createTowerMesh(5, 5, TowerType.SLOW);
      // Board is 25x20; world x = (5 - 12.5) * 1 = -7.5; world z = (5 - 10) * 1 = -5
      expect(group.position.x).toBeCloseTo(-7.5);
      expect(group.position.z).toBeCloseTo(-5);
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            (child.material as THREE.Material).dispose();
          }
        }
      });
    });
  });

  // --- Accessors ---

  describe('accessors', () => {
    it('should return tileSize of 1', () => {
      expect(service.getTileSize()).toBe(1);
    });

    it('should return updated dimensions after importBoard', () => {
      service.importBoard(createTestBoard(12, 8), 12, 8);
      expect(service.getBoardWidth()).toBe(12);
      expect(service.getBoardHeight()).toBe(8);
    });

    it('should return default dimensions after resetBoard', () => {
      service.importBoard(createTestBoard(5, 5), 5, 5);
      service.resetBoard();
      expect(service.getBoardWidth()).toBe(25);
      expect(service.getBoardHeight()).toBe(20);
    });
  });
});

/**
 * Helper to create a test board of all BASE tiles.
 */
function createTestBoard(width: number, height: number): GameBoardTile[][] {
  const board: GameBoardTile[][] = [];
  for (let row = 0; row < height; row++) {
    board[row] = [];
    for (let col = 0; col < width; col++) {
      board[row][col] = GameBoardTile.createBase(row, col);
    }
  }
  return board;
}
