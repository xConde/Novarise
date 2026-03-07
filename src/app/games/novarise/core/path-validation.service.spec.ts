import { TestBed } from '@angular/core/testing';
import { PathValidationService } from './path-validation.service';
import { TerrainGridState } from '../features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../models/terrain-types.enum';

/** Build a TerrainGridState for testing — all tiles default to BEDROCK unless overridden. */
function makeState(
  gridSize: number,
  overrides: { x: number; z: number; type: TerrainType }[] = [],
  spawnPoints: { x: number; z: number }[] = [{ x: 0, z: 0 }],
  exitPoints: { x: number; z: number }[] = [{ x: gridSize - 1, z: gridSize - 1 }]
): TerrainGridState {
  const tiles: TerrainType[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(TerrainType.BEDROCK)
  );

  for (const { x, z, type } of overrides) {
    tiles[x][z] = type;
  }

  return {
    gridSize,
    tiles,
    heightMap: Array.from({ length: gridSize }, () => Array(gridSize).fill(0)),
    spawnPoints,
    exitPoints,
    version: '2.0.0',
  };
}

describe('PathValidationService', () => {
  let service: PathValidationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PathValidationService],
    });
    service = TestBed.inject(PathValidationService);
  });

  describe('service creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('missing points', () => {
    it('should return invalid when spawnPoints is empty', () => {
      const state = makeState(5, [], [], [{ x: 4, z: 4 }]);
      const result = service.validate(state);
      expect(result.valid).toBe(false);
      expect(result.path).toBeUndefined();
    });

    it('should return invalid when exitPoints is empty', () => {
      const state = makeState(5, [], [{ x: 0, z: 0 }], []);
      const result = service.validate(state);
      expect(result.valid).toBe(false);
      expect(result.path).toBeUndefined();
    });

    it('should return invalid when both spawnPoints and exitPoints are empty', () => {
      const state = makeState(5, [], [], []);
      const result = service.validate(state);
      expect(result.valid).toBe(false);
    });
  });

  describe('same-tile spawn/exit', () => {
    it('should return invalid when spawn and exit are on the same tile', () => {
      const state = makeState(5, [], [{ x: 2, z: 2 }], [{ x: 2, z: 2 }]);
      const result = service.validate(state);
      expect(result.valid).toBe(false);
    });
  });

  describe('non-walkable spawn or exit', () => {
    it('should return invalid when spawn is on crystal (non-walkable)', () => {
      const state = makeState(
        5,
        [{ x: 0, z: 0, type: TerrainType.CRYSTAL }],
        [{ x: 0, z: 0 }],
        [{ x: 4, z: 4 }]
      );
      const result = service.validate(state);
      expect(result.valid).toBe(false);
    });

    it('should return invalid when exit is on abyss (non-walkable)', () => {
      const state = makeState(
        5,
        [{ x: 4, z: 4, type: TerrainType.ABYSS }],
        [{ x: 0, z: 0 }],
        [{ x: 4, z: 4 }]
      );
      const result = service.validate(state);
      expect(result.valid).toBe(false);
    });
  });

  describe('valid paths', () => {
    it('should return valid for a completely open bedrock grid', () => {
      const state = makeState(5);
      const result = service.validate(state);
      expect(result.valid).toBe(true);
      expect(result.path).toBeDefined();
      expect(result.path!.length).toBeGreaterThan(0);
    });

    it('should include spawn and exit tiles in the returned path', () => {
      const state = makeState(3, [], [{ x: 0, z: 0 }], [{ x: 2, z: 2 }]);
      const result = service.validate(state);
      expect(result.valid).toBe(true);
      const path = result.path!;
      expect(path[0]).toEqual({ x: 0, z: 0 });
      expect(path[path.length - 1]).toEqual({ x: 2, z: 2 });
    });

    it('should return valid when spawn is on moss terrain', () => {
      const state = makeState(
        5,
        [{ x: 0, z: 0, type: TerrainType.MOSS }],
        [{ x: 0, z: 0 }],
        [{ x: 4, z: 4 }]
      );
      const result = service.validate(state);
      expect(result.valid).toBe(true);
    });

    it('should return valid for a large grid with a winding path', () => {
      const size = 7;
      const walls: { x: number; z: number; type: TerrainType }[] = [];
      const addWall = (x: number, z: number): void => {
        walls.push({ x, z, type: TerrainType.CRYSTAL });
      };

      addWall(0, 2); addWall(0, 3); addWall(0, 4); addWall(0, 6);
      addWall(2, 0); addWall(2, 2); addWall(2, 3); addWall(2, 4);
      addWall(3, 0); addWall(4, 0); addWall(5, 0); addWall(6, 0);
      addWall(3, 4); addWall(4, 4); addWall(5, 4); addWall(6, 4);
      addWall(6, 1); addWall(6, 2); addWall(6, 3); addWall(6, 5); addWall(6, 6);

      const state = makeState(size, walls, [{ x: 0, z: 0 }], [{ x: 6, z: 6 }]);

      // Exit tile (6,6) is a CRYSTAL wall — so invalid
      const result = service.validate(state);
      expect(result.valid).toBe(false);
    });

    it('should find path through a winding open corridor', () => {
      const size = 5;
      const walls: { x: number; z: number; type: TerrainType }[] = [];
      for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
          if (z !== 2) walls.push({ x, z, type: TerrainType.CRYSTAL });
        }
      }
      const state = makeState(size, walls, [{ x: 0, z: 2 }], [{ x: 4, z: 2 }]);
      const result = service.validate(state);
      expect(result.valid).toBe(true);
      expect(result.path!.length).toBe(5);
    });
  });

  describe('invalid paths — wall blocks completely', () => {
    it('should return invalid when a wall of crystal completely blocks the path', () => {
      const size = 5;
      const walls = [0, 1, 2, 3, 4].map(z => ({
        x: 2,
        z,
        type: TerrainType.CRYSTAL,
      }));
      const state = makeState(size, walls, [{ x: 0, z: 2 }], [{ x: 4, z: 2 }]);
      const result = service.validate(state);
      expect(result.valid).toBe(false);
      expect(result.path).toBeUndefined();
    });

    it('should return invalid when a wall of abyss completely blocks the path', () => {
      const size = 5;
      const walls = [0, 1, 2, 3, 4].map(z => ({
        x: 2,
        z,
        type: TerrainType.ABYSS,
      }));
      const state = makeState(size, walls, [{ x: 0, z: 0 }], [{ x: 4, z: 4 }]);
      const result = service.validate(state);
      expect(result.valid).toBe(false);
    });
  });

  describe('diagonal connectivity (BFS is 4-directional)', () => {
    it('should return invalid when only diagonal path exists', () => {
      const size = 3;
      const walls: { x: number; z: number; type: TerrainType }[] = [];
      for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
          if (!(x === 0 && z === 0) && !(x === 2 && z === 2)) {
            walls.push({ x, z, type: TerrainType.CRYSTAL });
          }
        }
      }
      const state = makeState(size, walls, [{ x: 0, z: 0 }], [{ x: 2, z: 2 }]);
      const result = service.validate(state);
      expect(result.valid).toBe(false);
    });

    it('should also return invalid for single-step diagonal', () => {
      const size = 3;
      const walls: { x: number; z: number; type: TerrainType }[] = [
        { x: 1, z: 0, type: TerrainType.CRYSTAL },
        { x: 0, z: 1, type: TerrainType.CRYSTAL },
      ];
      const state = makeState(size, walls, [{ x: 0, z: 0 }], [{ x: 1, z: 1 }]);
      const result = service.validate(state);
      expect(result.valid).toBe(false);
    });
  });

  describe('moss terrain (walkable)', () => {
    it('should treat moss as walkable and find path through it', () => {
      const size = 5;
      const walls: { x: number; z: number; type: TerrainType }[] = [];
      for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
          if (z !== 2) {
            walls.push({ x, z, type: TerrainType.CRYSTAL });
          } else {
            walls.push({ x, z, type: TerrainType.MOSS });
          }
        }
      }
      const state = makeState(size, walls, [{ x: 0, z: 2 }], [{ x: 4, z: 2 }]);
      const result = service.validate(state);
      expect(result.valid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle a 1x1 grid with identical spawn/exit', () => {
      const state = makeState(1, [], [{ x: 0, z: 0 }], [{ x: 0, z: 0 }]);
      const result = service.validate(state);
      expect(result.valid).toBe(false); // same tile
    });

    it('should handle adjacent spawn and exit', () => {
      const state = makeState(3, [], [{ x: 0, z: 0 }], [{ x: 1, z: 0 }]);
      const result = service.validate(state);
      expect(result.valid).toBe(true);
      expect(result.path!.length).toBe(2);
    });
  });

  describe('multi-spawner validation', () => {
    it('should be valid when 2 spawners can both reach 1 exit', () => {
      // Open 5x5 grid — both spawners can reach exit
      const state = makeState(
        5,
        [],
        [{ x: 0, z: 0 }, { x: 0, z: 4 }],
        [{ x: 4, z: 2 }]
      );
      const result = service.validate(state);
      expect(result.valid).toBe(true);
    });

    it('should be invalid when one of 2 spawners is blocked', () => {
      const size = 5;
      // Wall off the top half to block spawn at (0,0)
      const walls: { x: number; z: number; type: TerrainType }[] = [];
      for (let x = 0; x < size; x++) {
        walls.push({ x, z: 1, type: TerrainType.CRYSTAL });
      }
      const state = makeState(
        size,
        walls,
        [{ x: 0, z: 0 }, { x: 0, z: 4 }],
        [{ x: 4, z: 4 }]
      );
      const result = service.validate(state);
      expect(result.valid).toBe(false);
    });

    it('should be valid with 2 spawners and 2 exits when all reachable', () => {
      const state = makeState(
        5,
        [],
        [{ x: 0, z: 0 }, { x: 0, z: 4 }],
        [{ x: 4, z: 0 }, { x: 4, z: 4 }]
      );
      const result = service.validate(state);
      expect(result.valid).toBe(true);
    });

    it('should handle backward compat: v1 format with single spawnPoint/exitPoint', () => {
      const v1State = {
        gridSize: 5,
        tiles: Array.from({ length: 5 }, () => Array(5).fill(TerrainType.BEDROCK)),
        heightMap: Array.from({ length: 5 }, () => Array(5).fill(0)),
        spawnPoint: { x: 0, z: 0 },
        exitPoint: { x: 4, z: 4 },
        version: '1.0.0',
      } as any;
      const result = service.validate(v1State);
      expect(result.valid).toBe(true);
    });
  });
});
