import { TestBed } from '@angular/core/testing';
import { MapBridgeService, EditorMapState } from './map-bridge.service';
import { BlockType } from '../models/game-board-tile';
import { TerrainType } from '../../../games/novarise/models/terrain-types.enum';

describe('MapBridgeService', () => {
  let service: MapBridgeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapBridgeService);
  });

  // --- State Management ---

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with no editor map', () => {
    expect(service.hasEditorMap()).toBeFalse();
    expect(service.getEditorMapState()).toBeNull();
  });

  it('should store editor map state', () => {
    const state = createMinimalState(3);
    service.setEditorMapState(state);
    expect(service.hasEditorMap()).toBeTrue();
    expect(service.getEditorMapState()).toBe(state);
  });

  it('should clear editor map state', () => {
    service.setEditorMapState(createMinimalState(3));
    service.clearEditorMap();
    expect(service.hasEditorMap()).toBeFalse();
    expect(service.getEditorMapState()).toBeNull();
  });

  it('should overwrite previous state when set again', () => {
    const state1 = createMinimalState(3);
    const state2 = createMinimalState(5);
    service.setEditorMapState(state1);
    service.setEditorMapState(state2);
    expect(service.getEditorMapState()).toBe(state2);
  });

  // --- mapId tracking ---

  it('getMapId should return null when no map has been set', () => {
    expect(service.getMapId()).toBeNull();
  });

  it('getMapId should return null after clearEditorMap', () => {
    service.setEditorMapState(createMinimalState(3), 'map_abc');
    service.clearEditorMap();
    expect(service.getMapId()).toBeNull();
  });

  it('setEditorMapState with mapId stores the id', () => {
    service.setEditorMapState(createMinimalState(3), 'map_xyz');
    expect(service.getMapId()).toBe('map_xyz');
  });

  it('setEditorMapState without mapId sets id to null', () => {
    service.setEditorMapState(createMinimalState(3), 'old_id');
    service.setEditorMapState(createMinimalState(5));
    expect(service.getMapId()).toBeNull();
  });

  it('clearEditorMap clears both state and mapId', () => {
    service.setEditorMapState(createMinimalState(4), 'my_map');
    service.clearEditorMap();
    expect(service.hasEditorMap()).toBeFalse();
    expect(service.getMapId()).toBeNull();
  });

  // --- Board Conversion: Dimensions ---

  it('should produce a square board matching the editor gridSize', () => {
    const state = createMinimalState(10);
    const { board, width, height } = service.convertToGameBoard(state);
    expect(width).toBe(10);
    expect(height).toBe(10);
    expect(board.length).toBe(10);
    board.forEach(row => expect(row.length).toBe(10));
  });

  it('should handle small grids (1x1)', () => {
    const state = createMinimalState(1);
    const { board, width, height } = service.convertToGameBoard(state);
    expect(width).toBe(1);
    expect(height).toBe(1);
    expect(board[0][0].type).toBe(BlockType.BASE);
  });

  // --- Board Conversion: Terrain Type Mapping ---

  it('should convert bedrock to BASE (traversable)', () => {
    const state = createMinimalState(3);
    state.tiles[1][1] = TerrainType.BEDROCK;
    const { board } = service.convertToGameBoard(state);
    expect(board[1][1].type).toBe(BlockType.BASE);
    expect(board[1][1].isTraversable).toBeTrue();
    expect(board[1][1].isPurchasable).toBeTrue();
  });

  it('should convert moss to BASE (traversable)', () => {
    const state = createMinimalState(3);
    state.tiles[0][0] = TerrainType.MOSS;
    const { board } = service.convertToGameBoard(state);
    expect(board[0][0].type).toBe(BlockType.BASE);
    expect(board[0][0].isTraversable).toBeTrue();
  });

  it('should convert crystal to WALL (non-traversable)', () => {
    const state = createMinimalState(3);
    state.tiles[2][1] = TerrainType.CRYSTAL;
    const { board } = service.convertToGameBoard(state);
    expect(board[1][2].type).toBe(BlockType.WALL);
    expect(board[1][2].isTraversable).toBeFalse();
    expect(board[1][2].isPurchasable).toBeFalse();
  });

  it('should convert abyss to WALL (non-traversable)', () => {
    const state = createMinimalState(3);
    state.tiles[0][2] = TerrainType.ABYSS;
    const { board } = service.convertToGameBoard(state);
    expect(board[2][0].type).toBe(BlockType.WALL);
    expect(board[2][0].isTraversable).toBeFalse();
  });

  it('should default unknown terrain types to BASE', () => {
    const state = createMinimalState(3);
    state.tiles[1][1] = 'unknown_type' as any;
    const { board } = service.convertToGameBoard(state);
    expect(board[1][1].type).toBe(BlockType.BASE);
  });

  // --- Board Conversion: Coordinate Transpose ---

  it('should correctly transpose editor [x][z] to game [row][col]', () => {
    const state = createMinimalState(4);
    state.tiles[0][3] = TerrainType.CRYSTAL;
    state.tiles[3][0] = TerrainType.ABYSS;

    const { board } = service.convertToGameBoard(state);
    expect(board[3][0].type).toBe(BlockType.WALL);
    expect(board[0][3].type).toBe(BlockType.WALL);
    expect(board[0][0].type).toBe(BlockType.BASE);
    expect(board[3][3].type).toBe(BlockType.BASE);
  });

  // --- Board Conversion: Spawn Points ---

  it('should place SPAWNER tile at spawn point position', () => {
    const state = createMinimalState(5);
    state.spawnPoints = [{ x: 0, z: 2 }]; // col=0, row=2

    const { board } = service.convertToGameBoard(state);
    expect(board[2][0].type).toBe(BlockType.SPAWNER);
    expect(board[2][0].isTraversable).toBeFalse();
  });

  it('should override terrain at spawn point location', () => {
    const state = createMinimalState(5);
    state.tiles[1][1] = TerrainType.CRYSTAL; // Would be WALL
    state.spawnPoints = [{ x: 1, z: 1 }]; // Same position — SPAWNER wins

    const { board } = service.convertToGameBoard(state);
    expect(board[1][1].type).toBe(BlockType.SPAWNER);
  });

  it('should handle empty spawn points gracefully', () => {
    const state = createMinimalState(3);
    state.spawnPoints = [];

    const { board } = service.convertToGameBoard(state);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        expect(board[row][col].type).not.toBe(BlockType.SPAWNER);
      }
    }
  });

  it('should place multiple SPAWNER tiles', () => {
    const state = createMinimalState(5);
    state.spawnPoints = [{ x: 0, z: 1 }, { x: 0, z: 3 }];

    const { board } = service.convertToGameBoard(state);
    expect(board[1][0].type).toBe(BlockType.SPAWNER);
    expect(board[3][0].type).toBe(BlockType.SPAWNER);
  });

  // --- Board Conversion: Exit Points ---

  it('should place EXIT tile at exit point position', () => {
    const state = createMinimalState(5);
    state.exitPoints = [{ x: 4, z: 4 }]; // col=4, row=4

    const { board } = service.convertToGameBoard(state);
    expect(board[4][4].type).toBe(BlockType.EXIT);
    expect(board[4][4].isTraversable).toBeFalse();
  });

  it('should override terrain at exit point location', () => {
    const state = createMinimalState(5);
    state.tiles[3][3] = TerrainType.ABYSS; // Would be WALL
    state.exitPoints = [{ x: 3, z: 3 }]; // Same position — EXIT wins

    const { board } = service.convertToGameBoard(state);
    expect(board[3][3].type).toBe(BlockType.EXIT);
  });

  it('should handle empty exit points gracefully', () => {
    const state = createMinimalState(3);
    state.exitPoints = [];

    const { board } = service.convertToGameBoard(state);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        expect(board[row][col].type).not.toBe(BlockType.EXIT);
      }
    }
  });

  it('should place multiple EXIT tiles', () => {
    const state = createMinimalState(5);
    state.exitPoints = [{ x: 4, z: 1 }, { x: 4, z: 3 }];

    const { board } = service.convertToGameBoard(state);
    expect(board[1][4].type).toBe(BlockType.EXIT);
    expect(board[3][4].type).toBe(BlockType.EXIT);
  });

  // --- Board Conversion: Combined Scenario ---

  it('should produce a playable board with spawn, exit, walls, and traversable tiles', () => {
    const state = createMinimalState(5);

    for (let x = 0; x < 5; x++) {
      state.tiles[x][0] = TerrainType.CRYSTAL;
      state.tiles[x][4] = TerrainType.CRYSTAL;
    }

    state.spawnPoints = [{ x: 0, z: 2 }];
    state.exitPoints = [{ x: 4, z: 2 }];

    const { board, width, height } = service.convertToGameBoard(state);

    expect(width).toBe(5);
    expect(height).toBe(5);

    expect(board[0][0].type).toBe(BlockType.WALL);
    expect(board[4][2].type).toBe(BlockType.WALL);

    expect(board[2][1].type).toBe(BlockType.BASE);
    expect(board[2][1].isTraversable).toBeTrue();

    expect(board[2][0].type).toBe(BlockType.SPAWNER);
    expect(board[2][4].type).toBe(BlockType.EXIT);
  });

  // --- Backward Compatibility (v1 format) ---

  it('should handle v1 format with single spawnPoint/exitPoint', () => {
    const v1State = {
      ...createMinimalState(5),
      spawnPoint: { x: 0, z: 2 },
      exitPoint: { x: 4, z: 2 },
      spawnPoints: [] as any[],
      exitPoints: [] as any[],
    } as any;
    // Clear arrays to simulate v1
    delete v1State.spawnPoints;
    delete v1State.exitPoints;

    const { board } = service.convertToGameBoard(v1State);
    expect(board[2][0].type).toBe(BlockType.SPAWNER);
    expect(board[2][4].type).toBe(BlockType.EXIT);
  });

  // --- Edge Cases ---

  it('should handle out-of-bounds spawn point without crashing', () => {
    const state = createMinimalState(3);
    state.spawnPoints = [{ x: 10, z: 10 }];

    const { board } = service.convertToGameBoard(state);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        expect(board[row][col].type).not.toBe(BlockType.SPAWNER);
      }
    }
  });

  it('should handle out-of-bounds exit point without crashing', () => {
    const state = createMinimalState(3);
    state.exitPoints = [{ x: -1, z: -1 }];

    const { board } = service.convertToGameBoard(state);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        expect(board[row][col].type).not.toBe(BlockType.EXIT);
      }
    }
  });

  it('should assign correct row/col coordinates to each GameBoardTile', () => {
    const state = createMinimalState(3);
    const { board } = service.convertToGameBoard(state);

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        expect(board[row][col].x).toBe(row);
        expect(board[row][col].y).toBe(col);
      }
    }
  });

  // --- hasValidSpawnAndExit ---

  describe('hasValidSpawnAndExit', () => {
    it('returns false when no map is stored', () => {
      expect(service.hasValidSpawnAndExit()).toBeFalse();
    });

    it('returns true when map has v2 spawnPoints and exitPoints', () => {
      const state = createMinimalState(5);
      state.spawnPoints = [{ x: 0, z: 2 }];
      state.exitPoints = [{ x: 4, z: 2 }];
      service.setEditorMapState(state);
      expect(service.hasValidSpawnAndExit()).toBeTrue();
    });

    it('returns false when spawnPoints is empty and no legacy spawnPoint', () => {
      const state = createMinimalState(5);
      state.spawnPoints = [];
      state.exitPoints = [{ x: 4, z: 2 }];
      service.setEditorMapState(state);
      expect(service.hasValidSpawnAndExit()).toBeFalse();
    });

    it('returns false when exitPoints is empty and no legacy exitPoint', () => {
      const state = createMinimalState(5);
      state.spawnPoints = [{ x: 0, z: 2 }];
      state.exitPoints = [];
      service.setEditorMapState(state);
      expect(service.hasValidSpawnAndExit()).toBeFalse();
    });

    it('returns true for v1 format with legacy spawnPoint and exitPoint', () => {
      const v1State = {
        ...createMinimalState(5),
        spawnPoint: { x: 0, z: 2 },
        exitPoint: { x: 4, z: 2 },
      } as any;
      delete v1State.spawnPoints;
      delete v1State.exitPoints;
      service.setEditorMapState(v1State);
      expect(service.hasValidSpawnAndExit()).toBeTrue();
    });

    it('returns false for v1 format missing exitPoint', () => {
      const v1State = {
        ...createMinimalState(5),
        spawnPoint: { x: 0, z: 2 },
      } as any;
      delete v1State.spawnPoints;
      delete v1State.exitPoints;
      service.setEditorMapState(v1State);
      expect(service.hasValidSpawnAndExit()).toBeFalse();
    });

    it('returns false after clearEditorMap', () => {
      const state = createMinimalState(5);
      state.spawnPoints = [{ x: 0, z: 2 }];
      state.exitPoints = [{ x: 4, z: 2 }];
      service.setEditorMapState(state);
      service.clearEditorMap();
      expect(service.hasValidSpawnAndExit()).toBeFalse();
    });
  });
});

/**
 * Helper to create a minimal valid editor state with all bedrock tiles.
 */
function createMinimalState(gridSize: number): EditorMapState {
  const tiles: TerrainType[][] = [];
  const heightMap: number[][] = [];

  for (let x = 0; x < gridSize; x++) {
    tiles[x] = [];
    heightMap[x] = [];
    for (let z = 0; z < gridSize; z++) {
      tiles[x][z] = TerrainType.BEDROCK;
      heightMap[x][z] = 0;
    }
  }

  return {
    gridSize,
    tiles,
    heightMap,
    spawnPoints: [],
    exitPoints: [],
    version: '2.0.0'
  };
}
