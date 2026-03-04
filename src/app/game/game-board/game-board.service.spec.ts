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
      // Place a tower to dirty the state
      service.placeTower(5, 5, TowerType.BASIC);
      expect(service.getGameBoard()[5][5].type).toBe(BlockType.TOWER);

      // Reset and verify tower is gone
      service.resetBoard();
      expect(service.getGameBoard()[5][5].type).toBe(BlockType.BASE);
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
      // First, set up default board with towers
      service.resetBoard();
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
      service.resetBoard();
    });

    it('should allow placement on BASE purchasable tiles', () => {
      // Find a base tile (avoid spawner/exit areas)
      expect(service.canPlaceTower(5, 5)).toBeTrue();
    });

    it('should reject placement on EXIT tiles', () => {
      // Exit tiles at [9,11], [9,12], [10,11], [10,12]
      expect(service.canPlaceTower(9, 11)).toBeFalse();
    });

    it('should reject placement on SPAWNER tiles', () => {
      const board = service.getGameBoard();
      // Find a spawner tile
      let spawnerRow = -1, spawnerCol = -1;
      for (let row = 0; row < 20 && spawnerRow === -1; row++) {
        for (let col = 0; col < 25; col++) {
          if (board[row][col].type === BlockType.SPAWNER) {
            spawnerRow = row;
            spawnerCol = col;
            break;
          }
        }
      }
      expect(spawnerRow).toBeGreaterThanOrEqual(0);
      expect(service.canPlaceTower(spawnerRow, spawnerCol)).toBeFalse();
    });

    it('should reject out-of-bounds positions', () => {
      expect(service.canPlaceTower(-1, 0)).toBeFalse();
      expect(service.canPlaceTower(0, -1)).toBeFalse();
      expect(service.canPlaceTower(20, 0)).toBeFalse();
      expect(service.canPlaceTower(0, 25)).toBeFalse();
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
  });

  // --- placeTower ---

  describe('placeTower', () => {
    beforeEach(() => {
      service.resetBoard();
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
      service.resetBoard();
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
      expect(service.removeTower(20, 0)).toBeFalse();
      expect(service.removeTower(0, 25)).toBeFalse();
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
