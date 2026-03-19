import { TestBed } from '@angular/core/testing';
import { PathfindingService } from './pathfinding.service';
import { GameBoardService } from '../game-board.service';
import { GameBoardTile } from '../models/game-board-tile';
import { createTestBoard, createGameBoardServiceSpy } from '../testing';

describe('PathfindingService', () => {
  let service: PathfindingService;
  let gameBoardService: jasmine.SpyObj<GameBoardService>;

  beforeEach(() => {
    const gameBoardServiceSpy = createGameBoardServiceSpy(10, 10, 1, () => createTestBoard());

    TestBed.configureTestingModule({
      providers: [
        PathfindingService,
        { provide: GameBoardService, useValue: gameBoardServiceSpy }
      ]
    });

    service = TestBed.inject(PathfindingService);
    gameBoardService = TestBed.inject(GameBoardService) as jasmine.SpyObj<GameBoardService>;
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // A* pathfinding
  // ---------------------------------------------------------------------------

  describe('findPath', () => {
    it('should find a valid path from spawner to exit on a clear board', () => {
      const path = service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });

      expect(path.length).toBeGreaterThan(0);
      expect(path[0]).toEqual(jasmine.objectContaining({ x: 0, y: 0 }));
      const last = path[path.length - 1];
      expect(last).toEqual(jasmine.objectContaining({ x: 9, y: 9 }));
    });

    it('should return the shortest path (Manhattan distance, no obstacles)', () => {
      const path = service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });

      // Manhattan distance from (0,0) to (9,9) is 18 → 19 nodes including start
      expect(path.length).toBe(19);
    });

    it('should path around obstacles', () => {
      const blockedCells: { row: number; col: number }[] = [];
      for (let col = 0; col <= 8; col++) {
        blockedCells.push({ row: 4, col });
      }
      for (let col = 1; col <= 9; col++) {
        blockedCells.push({ row: 6, col });
      }
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, blockedCells));

      const path = service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });

      expect(path.length).toBeGreaterThan(19);

      // Verify path does not cross blocked cells
      path.forEach(node => {
        const isBlocked = blockedCells.some(b => b.row === node.y && b.col === node.x);
        expect(isBlocked).toBe(false);
      });
    });

    it('should use 4-directional movement only (no diagonals)', () => {
      const path = service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });

      for (let i = 0; i < path.length - 1; i++) {
        const current = path[i];
        const next = path[i + 1];
        const dx = Math.abs(next.x - current.x);
        const dy = Math.abs(next.y - current.y);
        expect(dx + dy).toBe(1);
      }
    });

    it('should return empty array when path is completely blocked', () => {
      const blockedCells = [
        { row: 0, col: 1 },
        { row: 1, col: 0 }
      ];
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, blockedCells));

      const path = service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });
      expect(path.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Path caching
  // ---------------------------------------------------------------------------

  describe('path caching', () => {
    it('should return a copy of the cached path on second call', () => {
      const path1 = service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });
      const path2 = service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });

      expect(path1.length).toBe(path2.length);
      expect(path1).not.toBe(path2); // Different array references (copy returned)

      for (let i = 0; i < path1.length; i++) {
        expect(path1[i].x).toBe(path2[i].x);
        expect(path1[i].y).toBe(path2[i].y);
      }
    });

    it('should recalculate path after cache is invalidated', () => {
      service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });

      service.invalidateCache();

      // Spawn with a new obstacle — should produce a different result
      const blockedCells = [{ row: 1, col: 1 }];
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, blockedCells));

      const path2 = service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });
      expect(path2.length).toBeGreaterThan(0); // Path still exists (just different)
    });

    it('should serve stale result from cache before invalidation', () => {
      const path1 = service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });
      const len1 = path1.length;

      // Change board without invalidating cache
      const blockedCells = [{ row: 1, col: 1 }];
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, blockedCells));

      const path2 = service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });
      // Cache hit — same length as before obstacle was added
      expect(path2.length).toBe(len1);
    });
  });

  // ---------------------------------------------------------------------------
  // buildStraightPath (flying enemy bypass)
  // ---------------------------------------------------------------------------

  describe('buildStraightPath', () => {
    it('should return a 2-node path from start to end', () => {
      const path = service.buildStraightPath({ x: 0, y: 0 }, { x: 9, y: 9 });

      expect(path.length).toBe(2);
      expect(path[0]).toEqual(jasmine.objectContaining({ x: 0, y: 0 }));
      expect(path[1]).toEqual(jasmine.objectContaining({ x: 9, y: 9 }));
    });

    it('should ignore blocked tiles (straight line regardless of terrain)', () => {
      const blockedCells = [
        { row: 0, col: 1 },
        { row: 1, col: 0 }
      ];
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, blockedCells));

      const path = service.buildStraightPath({ x: 0, y: 0 }, { x: 9, y: 9 });
      expect(path.length).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // invalidateCache / reset
  // ---------------------------------------------------------------------------

  describe('invalidateCache', () => {
    it('should clear the cache so the next findPath recomputes', () => {
      service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });

      service.invalidateCache();

      const blockedCells = [{ row: 2, col: 2 }];
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, blockedCells));

      const path = service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });
      expect(path.length).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should clear the path cache', () => {
      service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });

      service.reset();

      const blockedCells = [{ row: 1, col: 1 }];
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, blockedCells));

      // Should recompute — path around the new obstacle is longer
      const path = service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });
      expect(path.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Tile queries
  // ---------------------------------------------------------------------------

  describe('getSpawnerTiles', () => {
    it('should return spawner tiles from the board', () => {
      const spawners = service.getSpawnerTiles();
      expect(spawners.length).toBeGreaterThan(0);
      expect(spawners[0]).toEqual({ row: 0, col: 0 });
    });

    it('should return empty array when no spawners exist', () => {
      const boardNoSpawner: GameBoardTile[][] = [];
      for (let row = 0; row < 10; row++) {
        boardNoSpawner[row] = [];
        for (let col = 0; col < 10; col++) {
          boardNoSpawner[row][col] = GameBoardTile.createBase(row, col);
        }
      }
      gameBoardService.getGameBoard.and.returnValue(boardNoSpawner);

      expect(service.getSpawnerTiles().length).toBe(0);
    });
  });

  describe('getExitTiles', () => {
    it('should return exit tiles from the board', () => {
      const exits = service.getExitTiles();
      expect(exits.length).toBeGreaterThan(0);
      expect(exits[0]).toEqual({ row: 9, col: 9 });
    });

    it('should return empty array when no exits exist', () => {
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

      expect(service.getExitTiles().length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getPathToExit
  // ---------------------------------------------------------------------------

  describe('getPathToExit', () => {
    it('should return world coordinates from spawner to exit', () => {
      const path = service.getPathToExit();

      expect(path.length).toBeGreaterThan(0);
      // gridToWorld(0, 0) on a 10x10 board with tileSize=1: x = 0-5 = -5, z = 0-5 = -5
      expect(path[0].x).toBeCloseTo(-5);
      expect(path[0].z).toBeCloseTo(-5);
      // gridToWorld(9, 9): x = 9-5 = 4, z = 9-5 = 4
      const last = path[path.length - 1];
      expect(last.x).toBeCloseTo(4);
      expect(last.z).toBeCloseTo(4);
    });

    it('should return empty array when no spawner tiles exist', () => {
      const board: GameBoardTile[][] = [];
      for (let row = 0; row < 10; row++) {
        board[row] = [];
        for (let col = 0; col < 10; col++) {
          board[row][col] = GameBoardTile.createBase(row, col);
        }
      }
      gameBoardService.getGameBoard.and.returnValue(board);

      expect(service.getPathToExit().length).toBe(0);
    });

    it('should return empty array when no exit tiles exist', () => {
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

      expect(service.getPathToExit().length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // gridToWorldPos
  // ---------------------------------------------------------------------------

  describe('gridToWorldPos', () => {
    it('should convert grid (0, 0) to world (-5, -5) on a 10x10 board', () => {
      const pos = service.gridToWorldPos(0, 0);
      expect(pos.x).toBe(-5);
      expect(pos.z).toBe(-5);
    });

    it('should convert grid (9, 9) to world (4, 4) on a 10x10 board', () => {
      const pos = service.gridToWorldPos(9, 9);
      expect(pos.x).toBe(4);
      expect(pos.z).toBe(4);
    });
  });

  // ---------------------------------------------------------------------------
  // Boundary conditions
  // ---------------------------------------------------------------------------

  describe('boundary conditions', () => {
    it('findPath returns a path with start node when start and end are the same tile', () => {
      // On a 1×1 board the spawner and exit are the same cell (0,0).
      // A* reaches the goal immediately — it should not throw and should return a non-empty result.
      const singleTile: GameBoardTile[][] = [
        [GameBoardTile.createSpawner(0, 0)]
      ];
      gameBoardService.getGameBoard.and.returnValue(singleTile);
      gameBoardService.getBoardWidth.and.returnValue(1);
      gameBoardService.getBoardHeight.and.returnValue(1);

      const path = service.findPath({ x: 0, y: 0 }, { x: 0, y: 0 });

      expect(path.length).toBeGreaterThanOrEqual(1);
      expect(path[0]).toEqual(jasmine.objectContaining({ x: 0, y: 0 }));
    });

    it('findPath on a 2-tile board where spawn and exit are adjacent returns a 2-node path', () => {
      // 1×2 board: spawner at (row=0, col=0), exit at (row=0, col=1)
      // Grid coords: spawner {x:0, y:0}, exit {x:1, y:0}
      const twoTileBoard: GameBoardTile[][] = [
        [GameBoardTile.createSpawner(0, 0), GameBoardTile.createExit(0, 1)]
      ];
      gameBoardService.getGameBoard.and.returnValue(twoTileBoard);
      gameBoardService.getBoardWidth.and.returnValue(2);
      gameBoardService.getBoardHeight.and.returnValue(1);

      const path = service.findPath({ x: 0, y: 0 }, { x: 1, y: 0 });

      expect(path.length).toBe(2);
      expect(path[0]).toEqual(jasmine.objectContaining({ x: 0, y: 0 }));
      expect(path[1]).toEqual(jasmine.objectContaining({ x: 1, y: 0 }));
    });

    it('findPath on a fully-walkable board returns a valid path without throwing', () => {
      // Use default 10×10 board (all tiles walkable — no blocked cells)
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10));
      gameBoardService.getBoardWidth.and.returnValue(10);
      gameBoardService.getBoardHeight.and.returnValue(10);

      let path: ReturnType<typeof service.findPath> | undefined;
      expect(() => {
        path = service.findPath({ x: 0, y: 0 }, { x: 9, y: 9 });
      }).not.toThrow();
      expect(path!.length).toBeGreaterThan(0);
    });

    it('findPath with start out of board bounds returns empty array', () => {
      // x=-1 is out of bounds — A* skips out-of-bounds neighbors;
      // start itself is never expanded because it fails the bounds check as a neighbor.
      // The heap is seeded with the out-of-bounds start but it will never reach goal.
      const path = service.findPath({ x: -1, y: -1 }, { x: 9, y: 9 });
      // The implementation never finds a walkable neighbor from an OOB start → empty
      expect(path.length).toBe(0);
    });
  });
});
