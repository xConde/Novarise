import {
  CURRENT_SCHEMA_VERSION,
  MIN_SUPPORTED_VERSION,
  detectSchemaVersion,
  migrateMap,
  validateMapData
} from './map-schema';

describe('map-schema', () => {
  // ---------------------------------------------------------------------------
  // detectSchemaVersion
  // ---------------------------------------------------------------------------
  describe('detectSchemaVersion', () => {
    it('should return explicit schemaVersion when present', () => {
      expect(detectSchemaVersion({ schemaVersion: 2 })).toBe(2);
    });

    it('should return 1 for v1 data with singular spawnPoint', () => {
      expect(detectSchemaVersion({ spawnPoint: { x: 0, z: 0 } })).toBe(1);
    });

    it('should return 2 for v2 data with spawnPoints array', () => {
      expect(detectSchemaVersion({ spawnPoints: [{ x: 0, z: 0 }] })).toBe(2);
    });

    it('should prefer explicit schemaVersion over field heuristics', () => {
      expect(detectSchemaVersion({ schemaVersion: 2, spawnPoint: { x: 0, z: 0 } })).toBe(2);
    });

    it('should return 1 for completely unversioned data', () => {
      expect(detectSchemaVersion({ gridSize: 10 })).toBe(1);
    });

    it('should return 1 when spawnPoints is present but not an array', () => {
      expect(detectSchemaVersion({ spawnPoints: null })).toBe(1);
    });

    it('should handle schemaVersion of 0 as numeric value', () => {
      expect(detectSchemaVersion({ schemaVersion: 0 })).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // migrateMap
  // ---------------------------------------------------------------------------
  describe('migrateMap', () => {
    it('should migrate v1 spawnPoint→spawnPoints and exitPoint→exitPoints', () => {
      const v1Data: Record<string, unknown> = {
        gridSize: 10,
        tiles: [[]],
        heightMap: [[]],
        spawnPoint: { x: 0, z: 0 },
        exitPoint: { x: 9, z: 9 },
        version: '1.0.0'
      };

      const result = migrateMap(v1Data);

      expect(result).not.toBeNull();
      expect(result!['spawnPoints']).toEqual([{ x: 0, z: 0 }]);
      expect(result!['exitPoints']).toEqual([{ x: 9, z: 9 }]);
      expect(result!['spawnPoint']).toBeUndefined();
      expect(result!['exitPoint']).toBeUndefined();
      expect(result!['version']).toBe('2.0.0');
    });

    it('should stamp schemaVersion on migrated data', () => {
      const v1Data: Record<string, unknown> = {
        gridSize: 10,
        tiles: [[]],
        heightMap: [[]],
        spawnPoint: { x: 0, z: 0 },
        exitPoint: { x: 9, z: 9 },
        version: '1.0.0'
      };

      const result = migrateMap(v1Data);

      expect(result!['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('should be a no-op for already-current data', () => {
      const v2Data: Record<string, unknown> = {
        gridSize: 10,
        tiles: [[]],
        heightMap: [[]],
        spawnPoints: [{ x: 0, z: 0 }],
        exitPoints: [{ x: 9, z: 9 }],
        version: '2.0.0',
        schemaVersion: CURRENT_SCHEMA_VERSION
      };

      const result = migrateMap(v2Data);

      expect(result).not.toBeNull();
      expect(result!['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION);
      expect(result!['spawnPoints']).toEqual([{ x: 0, z: 0 }]);
    });

    it('should reject data from a future schema version', () => {
      const warnSpy = spyOn(console, 'warn');
      const futureData: Record<string, unknown> = {
        gridSize: 10,
        tiles: [[]],
        heightMap: [[]],
        spawnPoints: [],
        exitPoints: [],
        version: '3.0.0',
        schemaVersion: CURRENT_SCHEMA_VERSION + 1
      };

      const result = migrateMap(futureData);

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should reject data below minimum supported version', () => {
      const warnSpy = spyOn(console, 'warn');
      const ancientData: Record<string, unknown> = {
        schemaVersion: MIN_SUPPORTED_VERSION - 1
      };

      const result = migrateMap(ancientData);

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should preserve existing spawnPoints when no singular spawnPoint exists', () => {
      const v1DataNoSpawn: Record<string, unknown> = {
        gridSize: 10,
        tiles: [[]],
        heightMap: [[]],
        spawnPoints: [{ x: 1, z: 1 }, { x: 2, z: 2 }],
        exitPoint: { x: 9, z: 9 },
        version: '2.0.0'
      };

      // This data has spawnPoints already but exitPoint singular — detected as v2
      // so no migration runs (already at current)
      const result = migrateMap(v1DataNoSpawn);

      expect(result).not.toBeNull();
      expect(result!['spawnPoints']).toEqual([{ x: 1, z: 1 }, { x: 2, z: 2 }]);
    });

    it('should not overwrite spawnPoints if both spawnPoint and spawnPoints exist in v1', () => {
      const mixedData: Record<string, unknown> = {
        gridSize: 10,
        spawnPoint: { x: 0, z: 0 },
        spawnPoints: [{ x: 5, z: 5 }],
        exitPoint: { x: 9, z: 9 },
        version: '1.0.0',
        schemaVersion: 1
      };

      const result = migrateMap(mixedData);

      // The v1→v2 migration only converts spawnPoint if spawnPoints is absent
      expect(result!['spawnPoints']).toEqual([{ x: 5, z: 5 }]);
    });
  });

  // ---------------------------------------------------------------------------
  // validateMapData
  // ---------------------------------------------------------------------------
  describe('validateMapData', () => {
    function validData(): Record<string, unknown> {
      return {
        gridSize: 10,
        tiles: [[]],
        heightMap: [[]],
        spawnPoints: [{ x: 0, z: 0 }],
        exitPoints: [{ x: 9, z: 9 }],
        version: '2.0.0'
      };
    }

    it('should pass valid map data', () => {
      const result = validateMapData(validData());

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject non-object input (null)', () => {
      const result = validateMapData(null);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toBe('Map data is not an object');
    });

    it('should reject non-object input (string)', () => {
      const result = validateMapData('not an object');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toBe('Map data is not an object');
    });

    it('should reject missing gridSize', () => {
      const data = validData();
      delete data['gridSize'];

      const result = validateMapData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('gridSize'))).toBe(true);
    });

    it('should reject gridSize below minimum (4)', () => {
      const data = { ...validData(), gridSize: 4 };

      const result = validateMapData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('gridSize'))).toBe(true);
    });

    it('should reject gridSize above maximum (51)', () => {
      const data = { ...validData(), gridSize: 51 };

      const result = validateMapData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('gridSize'))).toBe(true);
    });

    it('should accept boundary gridSize values (5 and 50)', () => {
      expect(validateMapData({ ...validData(), gridSize: 5, spawnPoints: [{ x: 0, z: 0 }], exitPoints: [{ x: 4, z: 4 }] }).valid).toBe(true);
      expect(validateMapData({ ...validData(), gridSize: 50, spawnPoints: [{ x: 0, z: 0 }], exitPoints: [{ x: 49, z: 49 }] }).valid).toBe(true);
    });

    it('should reject non-array tiles', () => {
      const data = { ...validData(), tiles: 'not-an-array' };

      const result = validateMapData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('tiles'))).toBe(true);
    });

    it('should reject 1D tiles (not a 2D array)', () => {
      const data = { ...validData(), tiles: [1, 2, 3] };

      const result = validateMapData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('2D'))).toBe(true);
    });

    it('should reject missing heightMap', () => {
      const data = validData();
      delete data['heightMap'];

      const result = validateMapData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('heightMap'))).toBe(true);
    });

    it('should reject missing spawnPoints', () => {
      const data = validData();
      delete data['spawnPoints'];

      const result = validateMapData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('spawn'))).toBe(true);
    });

    it('should reject empty spawnPoints array', () => {
      const data = { ...validData(), spawnPoints: [] };

      const result = validateMapData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('spawn'))).toBe(true);
    });

    it('should reject missing exitPoints', () => {
      const data = validData();
      delete data['exitPoints'];

      const result = validateMapData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exit'))).toBe(true);
    });

    it('should reject empty exitPoints array', () => {
      const data = { ...validData(), exitPoints: [] };

      const result = validateMapData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exit'))).toBe(true);
    });

    it('should warn when version string is missing', () => {
      const data = validData();
      delete data['version'];

      const result = validateMapData(data);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('version'))).toBe(true);
    });

    it('should accumulate multiple errors', () => {
      const data: Record<string, unknown> = {
        // missing gridSize, tiles, heightMap, spawnPoints, exitPoints
      };

      const result = validateMapData(data);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    // --- Spawn/exit point structure validation (red team finding #1) ---

    it('should reject spawnPoints with non-object entries', () => {
      const data = { ...validData(), spawnPoints: ['not-an-object'] };
      const result = validateMapData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('spawnPoints[0]') && e.includes('not an object'))).toBe(true);
    });

    it('should reject spawnPoints with missing x/z fields', () => {
      const data = { ...validData(), spawnPoints: [{}] };
      const result = validateMapData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('spawnPoints[0]') && e.includes('x/z'))).toBe(true);
    });

    it('should reject spawnPoints with non-numeric x/z', () => {
      const data = { ...validData(), spawnPoints: [{ x: 'a', z: 0 }] };
      const result = validateMapData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('x/z'))).toBe(true);
    });

    it('should reject spawnPoints with out-of-bounds coordinates', () => {
      const data = { ...validData(), spawnPoints: [{ x: 9999, z: -1 }] };
      const result = validateMapData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('out of bounds'))).toBe(true);
    });

    it('should reject spawnPoints at gridSize boundary (exclusive upper bound)', () => {
      const data = { ...validData(), gridSize: 10, spawnPoints: [{ x: 10, z: 0 }] };
      const result = validateMapData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('out of bounds'))).toBe(true);
    });

    it('should accept spawnPoints at max valid coordinate (gridSize - 1)', () => {
      const data = { ...validData(), gridSize: 10, spawnPoints: [{ x: 9, z: 9 }] };
      const result = validateMapData(data);
      expect(result.valid).toBe(true);
    });

    it('should reject non-integer spawn coordinates', () => {
      const data = { ...validData(), spawnPoints: [{ x: 1.5, z: 2.7 }] };
      const result = validateMapData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('integers'))).toBe(true);
    });

    it('should reject exitPoints with non-object entries', () => {
      const data = { ...validData(), exitPoints: [null] };
      const result = validateMapData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exitPoints[0]') && e.includes('not an object'))).toBe(true);
    });

    it('should reject exitPoints with out-of-bounds coordinates', () => {
      const data = { ...validData(), gridSize: 10, exitPoints: [{ x: 0, z: 10 }] };
      const result = validateMapData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('out of bounds'))).toBe(true);
    });

    it('should validate all points in array and report per-index errors', () => {
      const data = { ...validData(), spawnPoints: [{ x: 0, z: 0 }, { x: 'bad', z: 0 }, { x: 100, z: 100 }] };
      const result = validateMapData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('spawnPoints[1]'))).toBe(true);
      expect(result.errors.some(e => e.includes('spawnPoints[2]'))).toBe(true);
    });
  });
});
