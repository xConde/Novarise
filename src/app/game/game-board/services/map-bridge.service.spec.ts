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
    // Editor tiles[col][row] → game board[row][col]
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
    // tiles[2][1] → board[1][2]
    expect(board[1][2].type).toBe(BlockType.WALL);
    expect(board[1][2].isTraversable).toBeFalse();
    expect(board[1][2].isPurchasable).toBeFalse();
  });

  it('should convert abyss to WALL (non-traversable)', () => {
    const state = createMinimalState(3);
    state.tiles[0][2] = TerrainType.ABYSS;
    const { board } = service.convertToGameBoard(state);
    // tiles[0][2] → board[2][0]
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
    // Create a 4x4 grid with a known pattern:
    // Editor tiles[col=0][row=3] = 'crystal' → game board[row=3][col=0] = WALL
    const state = createMinimalState(4);
    state.tiles[0][3] = TerrainType.CRYSTAL;
    state.tiles[3][0] = TerrainType.ABYSS;

    const { board } = service.convertToGameBoard(state);
    expect(board[3][0].type).toBe(BlockType.WALL); // tiles[0][3] → board[3][0]
    expect(board[0][3].type).toBe(BlockType.WALL); // tiles[3][0] → board[0][3]
    expect(board[0][0].type).toBe(BlockType.BASE); // untouched
    expect(board[3][3].type).toBe(BlockType.BASE); // untouched
  });

  // --- Board Conversion: Spawn Point ---

  it('should place SPAWNER tile at spawn point position', () => {
    const state = createMinimalState(5);
    state.spawnPoint = { x: 0, z: 2 }; // col=0, row=2

    const { board } = service.convertToGameBoard(state);
    expect(board[2][0].type).toBe(BlockType.SPAWNER);
    expect(board[2][0].isTraversable).toBeFalse();
  });

  it('should override terrain at spawn point location', () => {
    const state = createMinimalState(5);
    state.tiles[1][1] = TerrainType.CRYSTAL; // Would be WALL
    state.spawnPoint = { x: 1, z: 1 }; // Same position — SPAWNER wins

    const { board } = service.convertToGameBoard(state);
    expect(board[1][1].type).toBe(BlockType.SPAWNER);
  });

  it('should handle null spawn point gracefully', () => {
    const state = createMinimalState(3);
    state.spawnPoint = null;

    const { board } = service.convertToGameBoard(state);
    // No spawner tiles anywhere
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        expect(board[row][col].type).not.toBe(BlockType.SPAWNER);
      }
    }
  });

  // --- Board Conversion: Exit Point ---

  it('should place EXIT tile at exit point position', () => {
    const state = createMinimalState(5);
    state.exitPoint = { x: 4, z: 4 }; // col=4, row=4

    const { board } = service.convertToGameBoard(state);
    expect(board[4][4].type).toBe(BlockType.EXIT);
    expect(board[4][4].isTraversable).toBeFalse();
  });

  it('should override terrain at exit point location', () => {
    const state = createMinimalState(5);
    state.tiles[3][3] = TerrainType.ABYSS; // Would be WALL
    state.exitPoint = { x: 3, z: 3 }; // Same position — EXIT wins

    const { board } = service.convertToGameBoard(state);
    expect(board[3][3].type).toBe(BlockType.EXIT);
  });

  it('should handle null exit point gracefully', () => {
    const state = createMinimalState(3);
    state.exitPoint = null;

    const { board } = service.convertToGameBoard(state);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        expect(board[row][col].type).not.toBe(BlockType.EXIT);
      }
    }
  });

  // --- Board Conversion: Combined Scenario ---

  it('should produce a playable board with spawn, exit, walls, and traversable tiles', () => {
    const state = createMinimalState(5);

    // Create a corridor: walls on sides, open path in middle
    for (let x = 0; x < 5; x++) {
      state.tiles[x][0] = TerrainType.CRYSTAL; // Top wall row
      state.tiles[x][4] = TerrainType.CRYSTAL; // Bottom wall row
    }
    // Middle rows are bedrock (traversable) by default

    state.spawnPoint = { x: 0, z: 2 };
    state.exitPoint = { x: 4, z: 2 };

    const { board, width, height } = service.convertToGameBoard(state);

    expect(width).toBe(5);
    expect(height).toBe(5);

    // Top/bottom rows are walls
    expect(board[0][0].type).toBe(BlockType.WALL);
    expect(board[4][2].type).toBe(BlockType.WALL);

    // Middle rows are traversable
    expect(board[2][1].type).toBe(BlockType.BASE);
    expect(board[2][1].isTraversable).toBeTrue();

    // Spawn and exit are placed
    expect(board[2][0].type).toBe(BlockType.SPAWNER);
    expect(board[2][4].type).toBe(BlockType.EXIT);
  });

  // --- Edge Cases ---

  it('should handle out-of-bounds spawn point without crashing', () => {
    const state = createMinimalState(3);
    state.spawnPoint = { x: 10, z: 10 }; // Out of bounds

    const { board } = service.convertToGameBoard(state);
    // Should not crash; no spawner placed
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        expect(board[row][col].type).not.toBe(BlockType.SPAWNER);
      }
    }
  });

  it('should handle out-of-bounds exit point without crashing', () => {
    const state = createMinimalState(3);
    state.exitPoint = { x: -1, z: -1 }; // Out of bounds

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
    spawnPoint: null,
    exitPoint: null,
    version: '1.0.0'
  };
}
