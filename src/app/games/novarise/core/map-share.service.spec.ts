import { TestBed } from '@angular/core/testing';
import { MapShareService } from './map-share.service';
import { TerrainGridState } from '../features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../models/terrain-types.enum';

function minimalState(overrides: Partial<TerrainGridState> = {}): TerrainGridState {
  return {
    gridSize: 5,
    tiles: [
      [TerrainType.BEDROCK, TerrainType.ABYSS],
      [TerrainType.MOSS, TerrainType.CRYSTAL]
    ],
    heightMap: [[0, 0], [0, 0]],
    spawnPoint: { x: 0, z: 0 },
    exitPoint: { x: 4, z: 4 },
    version: '1.0.0',
    ...overrides
  };
}

describe('MapShareService', () => {
  let service: MapShareService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapShareService);
  });

  // ---------------------------------------------------------------------------
  // encode()
  // ---------------------------------------------------------------------------

  describe('encode', () => {
    it('should return a non-empty string', () => {
      const result = service.encode(minimalState());
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should produce valid base64 (no throw on atob)', () => {
      const result = service.encode(minimalState());
      expect(() => atob(result)).not.toThrow();
    });

    it('should produce different output for different states', () => {
      const a = service.encode(minimalState({ gridSize: 5 }));
      const b = service.encode(minimalState({ gridSize: 10 }));
      expect(a).not.toBe(b);
    });
  });

  // ---------------------------------------------------------------------------
  // decode()
  // ---------------------------------------------------------------------------

  describe('decode', () => {
    it('should return original state when decoding encoded data', () => {
      const original = minimalState();
      const encoded = service.encode(original);
      const decoded = service.decode(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded?.gridSize).toBe(original.gridSize);
      expect(decoded?.version).toBe(original.version);
      expect(decoded?.spawnPoint).toEqual(original.spawnPoint);
      expect(decoded?.exitPoint).toEqual(original.exitPoint);
      expect(decoded?.tiles).toEqual(original.tiles);
      expect(decoded?.heightMap).toEqual(original.heightMap);
    });

    it('should return null for invalid base64', () => {
      expect(service.decode('!!!not-base64!!!')).toBeNull();
    });

    it('should return null for valid base64 but invalid JSON', () => {
      const badJson = btoa('{ this is not valid json }');
      expect(service.decode(badJson)).toBeNull();
    });

    it('should return null when tiles field is missing', () => {
      const noTiles = btoa(JSON.stringify({ gridSize: 25, heightMap: [] }));
      expect(service.decode(noTiles)).toBeNull();
    });

    it('should return null when dimension fields are missing', () => {
      const noDim = btoa(JSON.stringify({ tiles: [], heightMap: [] }));
      expect(service.decode(noDim)).toBeNull();
    });

    it('should return null for an empty string', () => {
      expect(service.decode('')).toBeNull();
    });

    it('should return null when the decoded value is not an object', () => {
      const primitive = btoa(JSON.stringify(42));
      expect(service.decode(primitive)).toBeNull();
    });

    it('should return null for a JSON null value', () => {
      const nullEncoded = btoa(JSON.stringify(null));
      expect(service.decode(nullEncoded)).toBeNull();
    });

    it('should accept state with width and height instead of gridSize', () => {
      const altState = { width: 25, height: 25, tiles: [], heightMap: [] };
      const encoded = btoa(JSON.stringify(altState));
      const decoded = service.decode(encoded);
      expect(decoded).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // generateShareUrl()
  // ---------------------------------------------------------------------------

  describe('generateShareUrl', () => {
    it('should return a string containing the origin', () => {
      const url = service.generateShareUrl(minimalState());
      expect(url).toContain(window.location.origin);
    });

    it('should contain /edit path', () => {
      const url = service.generateShareUrl(minimalState());
      expect(url).toContain('/edit');
    });

    it('should include the map query parameter', () => {
      const url = service.generateShareUrl(minimalState());
      expect(url).toContain('?map=');
    });

    it('should include the URL-encoded map data in the URL', () => {
      const state = minimalState();
      const encoded = encodeURIComponent(service.encode(state));
      const url = service.generateShareUrl(state);
      expect(url).toContain(encoded);
    });

    it('should produce a decodable map param', () => {
      const state = minimalState();
      const url = service.generateShareUrl(state);
      const urlEncoded = url.split('?map=')[1];
      const decoded = service.decode(decodeURIComponent(urlEncoded));
      expect(decoded).not.toBeNull();
      expect(decoded?.gridSize).toBe(state.gridSize);
    });
  });
});
