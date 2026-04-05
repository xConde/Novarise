import { TestBed } from '@angular/core/testing';
import { MapTemplateService } from './map-template.service';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';

describe('MapTemplateService', () => {
  let service: MapTemplateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapTemplateService);
  });

  // ---------------------------------------------------------------------------
  // getTemplates()
  // ---------------------------------------------------------------------------

  describe('getTemplates', () => {
    it('should return a non-empty array of templates', () => {
      const templates = service.getTemplates();
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should include classic, maze, spiral, and open-field templates', () => {
      const ids = service.getTemplates().map(t => t.id);
      expect(ids).toContain('classic');
      expect(ids).toContain('maze');
      expect(ids).toContain('spiral');
      expect(ids).toContain('open-field');
    });

    it('should have unique template IDs', () => {
      const ids = service.getTemplates().map(t => t.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('should return templates with id, name, and description', () => {
      service.getTemplates().forEach(t => {
        expect(t.id).toBeTruthy();
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
      });
    });

    it('should return a copy each time (not the same array reference)', () => {
      const a = service.getTemplates();
      const b = service.getTemplates();
      expect(a).not.toBe(b);
    });
  });

  // ---------------------------------------------------------------------------
  // loadTemplate() — general contract
  // ---------------------------------------------------------------------------

  describe('loadTemplate', () => {
    it('should return null for an unknown id', () => {
      expect(service.loadTemplate('not-a-real-template')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(service.loadTemplate('')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Common validation helper
  // ---------------------------------------------------------------------------

  function validateGrid(state: TerrainGridState | null, label: string): void {
    expect(state).not.toBeNull();
    if (!state) { return; }

    it(`${label}: grid is 25x25`, () => {
      expect(state.gridSize).toBe(25);
      expect(state.tiles.length).toBe(25);
      state.tiles.forEach(col => expect(col.length).toBe(25));
      expect(state.heightMap.length).toBe(25);
      state.heightMap.forEach(col => expect(col.length).toBe(25));
    });

    it(`${label}: version is set`, () => {
      expect(state.version).toBeTruthy();
    });

    it(`${label}: has exactly one spawn point`, () => {
      expect(state.spawnPoints.length).toBeGreaterThan(0);
    });

    it(`${label}: has exactly one exit point`, () => {
      expect(state.exitPoints.length).toBeGreaterThan(0);
    });

    it(`${label}: spawn and exit are different coordinates`, () => {
      expect(state.spawnPoints[0]).toBeDefined();
      expect(state.exitPoints[0]).toBeDefined();
      expect(state.spawnPoints[0]).not.toEqual(state.exitPoints[0]);
    });
  }

  // ---------------------------------------------------------------------------
  // Classic
  // ---------------------------------------------------------------------------

  describe('classic template', () => {
    let state: TerrainGridState;

    beforeEach(() => {
      state = service.loadTemplate('classic') as TerrainGridState;
    });

    it('should return a non-null state', () => {
      expect(state).not.toBeNull();
    });

    it('should produce a 25x25 grid', () => {
      expect(state.gridSize).toBe(25);
      expect(state.tiles.length).toBe(25);
      state.tiles.forEach(col => expect(col.length).toBe(25));
    });

    it('should have a spawn point', () => {
      expect(state.spawnPoints.length).toBeGreaterThan(0);
    });

    it('should have an exit point', () => {
      expect(state.exitPoints.length).toBeGreaterThan(0);
    });

    it('should have spawn and exit at different positions', () => {
      expect(state.spawnPoints[0]).toBeDefined();
      expect(state.exitPoints[0]).toBeDefined();
      expect(state.spawnPoints[0]).not.toEqual(state.exitPoints[0]);
    });

    it('should have a version string', () => {
      expect(state.version).toBeTruthy();
    });

    it('should set spawn on the left edge (x=0)', () => {
      expect(state.spawnPoints[0]?.x).toBe(0);
    });

    it('should set exit on the right edge (x=24)', () => {
      expect(state.exitPoints[0]?.x).toBe(24);
    });

    it('should have spawn and exit at the same z row (straight path)', () => {
      expect(state.spawnPoints[0]?.z).toBe(state.exitPoints[0]?.z);
    });

    it('should contain path tiles along the horizontal corridor', () => {
      const midZ = 12;
      // Path tiles should be BEDROCK (traversable)
      expect(state.tiles[0][midZ]).toBe(TerrainType.BEDROCK);
      expect(state.tiles[12][midZ]).toBe(TerrainType.BEDROCK);
      expect(state.tiles[24][midZ]).toBe(TerrainType.BEDROCK);
    });

    it('should have ABYSS tiles off the path', () => {
      // Tiles far from the corridor should be ABYSS (non-traversable walls)
      expect(state.tiles[12][0]).toBe(TerrainType.ABYSS);
      expect(state.tiles[12][24]).toBe(TerrainType.ABYSS);
    });
  });

  // ---------------------------------------------------------------------------
  // Maze
  // ---------------------------------------------------------------------------

  describe('maze template', () => {
    let state: TerrainGridState;

    beforeEach(() => {
      state = service.loadTemplate('maze') as TerrainGridState;
    });

    it('should return a non-null state', () => {
      expect(state).not.toBeNull();
    });

    it('should produce a 25x25 grid', () => {
      expect(state.gridSize).toBe(25);
      expect(state.tiles.length).toBe(25);
    });

    it('should have a spawn point', () => {
      expect(state.spawnPoints.length).toBeGreaterThan(0);
    });

    it('should have an exit point', () => {
      expect(state.exitPoints.length).toBeGreaterThan(0);
    });

    it('should have spawn and exit at different positions', () => {
      expect(state.spawnPoints[0]).toBeDefined();
      expect(state.exitPoints[0]).toBeDefined();
      expect(state.spawnPoints[0]).not.toEqual(state.exitPoints[0]);
    });

    it('should have a version string', () => {
      expect(state.version).toBeTruthy();
    });

    it('should have spawn at the left edge', () => {
      expect(state.spawnPoints[0]?.x).toBe(0);
    });

    it('should have exit at the right edge', () => {
      expect(state.exitPoints[0]?.x).toBe(24);
    });

    it('should contain path tiles on at least two distinct z rows', () => {
      const pathRows = new Set<number>();
      for (let x = 0; x < 25; x++) {
        for (let z = 0; z < 25; z++) {
          if (state.tiles[x][z] === TerrainType.BEDROCK) {
            pathRows.add(z);
          }
        }
      }
      expect(pathRows.size).toBeGreaterThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Spiral
  // ---------------------------------------------------------------------------

  describe('spiral template', () => {
    let state: TerrainGridState;

    beforeEach(() => {
      state = service.loadTemplate('spiral') as TerrainGridState;
    });

    it('should return a non-null state', () => {
      expect(state).not.toBeNull();
    });

    it('should produce a 25x25 grid', () => {
      expect(state.gridSize).toBe(25);
      expect(state.tiles.length).toBe(25);
    });

    it('should have a spawn point', () => {
      expect(state.spawnPoints.length).toBeGreaterThan(0);
    });

    it('should have an exit point', () => {
      expect(state.exitPoints.length).toBeGreaterThan(0);
    });

    it('should have spawn and exit at different positions', () => {
      expect(state.spawnPoints[0]).toBeDefined();
      expect(state.exitPoints[0]).toBeDefined();
      expect(state.spawnPoints[0]).not.toEqual(state.exitPoints[0]);
    });

    it('should have a version string', () => {
      expect(state.version).toBeTruthy();
    });

    it('should contain path tiles along the outer top edge', () => {
      // z=0 should be path (BEDROCK = traversable) from x=0 to x=24
      expect(state.tiles[0][0]).toBe(TerrainType.BEDROCK);
      expect(state.tiles[12][0]).toBe(TerrainType.BEDROCK);
      expect(state.tiles[24][0]).toBe(TerrainType.BEDROCK);
    });

    it('should contain path tiles on the right edge', () => {
      // x=24 should be path (BEDROCK = traversable) from z=0 to z=24
      expect(state.tiles[24][12]).toBe(TerrainType.BEDROCK);
    });
  });

  // ---------------------------------------------------------------------------
  // Open Field
  // ---------------------------------------------------------------------------

  describe('open-field template', () => {
    let state: TerrainGridState;

    beforeEach(() => {
      state = service.loadTemplate('open-field') as TerrainGridState;
    });

    it('should return a non-null state', () => {
      expect(state).not.toBeNull();
    });

    it('should produce a 25x25 grid', () => {
      expect(state.gridSize).toBe(25);
      expect(state.tiles.length).toBe(25);
    });

    it('should have a spawn point', () => {
      expect(state.spawnPoints.length).toBeGreaterThan(0);
    });

    it('should have an exit point', () => {
      expect(state.exitPoints.length).toBeGreaterThan(0);
    });

    it('should have spawn and exit at different positions', () => {
      expect(state.spawnPoints[0]).toBeDefined();
      expect(state.exitPoints[0]).toBeDefined();
      expect(state.spawnPoints[0]).not.toEqual(state.exitPoints[0]);
    });

    it('should have a version string', () => {
      expect(state.version).toBeTruthy();
    });

    it('should have all tiles as BEDROCK (no pre-defined path)', () => {
      let nonBedrock = 0;
      for (let x = 0; x < 25; x++) {
        for (let z = 0; z < 25; z++) {
          if (state.tiles[x][z] !== TerrainType.BEDROCK) { nonBedrock++; }
        }
      }
      expect(nonBedrock).toBe(0);
    });

    it('should have spawn on the left edge (x=0)', () => {
      expect(state.spawnPoints[0]?.x).toBe(0);
    });

    it('should have exit on the right edge (x=24)', () => {
      expect(state.exitPoints[0]?.x).toBe(24);
    });
  });
});
