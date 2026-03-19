import { TestBed } from '@angular/core/testing';
import { MapStorageService, MapMetadata, SavedMap } from './map-storage.service';
import { TerrainGridState } from '../features/terrain-editor/terrain-grid-state.interface';
import { CURRENT_SCHEMA_VERSION } from './map-schema';
import { MapBridgeService } from '../../../game/game-board/services/map-bridge.service';

function testMapData(overrides?: Record<string, unknown>): TerrainGridState {
  return {
    gridSize: 10,
    tiles: [[]],
    heightMap: [[]],
    spawnPoints: [{ x: 0, z: 0 }],
    exitPoints: [{ x: 9, z: 9 }],
    version: '2.0.0',
    ...overrides
  } as TerrainGridState;
}

describe('MapStorageService', () => {
  let service: MapStorageService;
  let mapBridge: MapBridgeService;
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};

    spyOn(localStorage, 'getItem').and.callFake((key: string) => {
      return localStorageMock[key] || null;
    });

    spyOn(localStorage, 'setItem').and.callFake((key: string, value: string) => {
      localStorageMock[key] = value;
    });

    spyOn(localStorage, 'removeItem').and.callFake((key: string) => {
      delete localStorageMock[key];
    });

    TestBed.configureTestingModule({
      providers: [MapStorageService, MapBridgeService]
    });

    service = TestBed.inject(MapStorageService);
    mapBridge = TestBed.inject(MapBridgeService);
  });

  afterEach(() => {
    localStorageMock = {};
  });

  describe('saveMap', () => {
    it('should save a new map with generated ID', () => {
      const mapData = testMapData();
      const mapId = service.saveMap('Test Map', mapData)!;

      expect(mapId).toBeTruthy();
      expect(mapId).toMatch(/^map_\d+_[a-z0-9]+$/);
    });

    it('should save map data to localStorage', () => {
      const mapData = testMapData();
      const mapId = service.saveMap('Test Map', mapData)!;

      const savedJson = localStorageMock['novarise_map_' + mapId];
      expect(savedJson).toBeTruthy();

      const savedMap: SavedMap = JSON.parse(savedJson);
      expect(savedMap.metadata.name).toBe('Test Map');
      expect(savedMap.data.gridSize).toBe(10);
    });

    it('should update metadata with correct timestamps', () => {
      const mapData = testMapData();
      const beforeSave = Date.now();
      const mapId = service.saveMap('Test Map', mapData)!;
      const afterSave = Date.now();

      const savedJson = localStorageMock['novarise_map_' + mapId];
      const savedMap: SavedMap = JSON.parse(savedJson);

      expect(savedMap.metadata.createdAt).toBeGreaterThanOrEqual(beforeSave);
      expect(savedMap.metadata.createdAt).toBeLessThanOrEqual(afterSave);
      expect(savedMap.metadata.updatedAt).toBeGreaterThanOrEqual(beforeSave);
      expect(savedMap.metadata.updatedAt).toBeLessThanOrEqual(afterSave);
    });

    it('should update existing map when ID is provided', () => {
      const mapData = testMapData();
      const mapId = service.saveMap('Original Name', mapData)!;

      const originalJson = localStorageMock['novarise_map_' + mapId];
      const originalMap: SavedMap = JSON.parse(originalJson);
      const originalCreatedAt = originalMap.metadata.createdAt;

      // Wait a bit to ensure different timestamp
      const newTiles = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
      const updatedData = testMapData({ tiles: newTiles });
      service.saveMap('Updated Name', updatedData, mapId);

      const updatedJson = localStorageMock['novarise_map_' + mapId];
      const updatedMap: SavedMap = JSON.parse(updatedJson);

      expect(updatedMap.metadata.name).toBe('Updated Name');
      expect(updatedMap.metadata.createdAt).toBe(originalCreatedAt);
      expect(updatedMap.data.tiles as unknown).toEqual(newTiles as unknown);
    });

    it('should set saved map as current map', () => {
      const mapData = testMapData();
      const mapId = service.saveMap('Test Map', mapData)!;

      expect(localStorageMock['novarise_current_map']).toBe(mapId);
    });

    it('should update metadata index when saving', () => {
      const mapData = testMapData();
      service.saveMap('Test Map', mapData);

      const metadataJson = localStorageMock['novarise_maps_metadata'];
      expect(metadataJson).toBeTruthy();

      const metadata: MapMetadata[] = JSON.parse(metadataJson);
      expect(metadata.length).toBe(1);
      expect(metadata[0].name).toBe('Test Map');
    });

    it('should return null and not write to storage when map data is structurally invalid', () => {
      const consoleSpy = spyOn(console, 'error');
      const invalidData = testMapData({ spawnPoints: [] as unknown, gridSize: 3 });

      const result = service.saveMap('Invalid Map', invalidData);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        jasmine.stringContaining('Cannot save invalid map'),
        jasmine.any(String)
      );
      expect(service.getAllMaps().length).toBe(0);
    });
  });

  describe('loadMap', () => {
    it('should return map data when map exists', () => {
      const mapData = testMapData({ tiles: [[1, 2]] });
      const mapId = service.saveMap('Test Map', mapData)!;

      const loadedData = service.loadMap(mapId);

      expect(loadedData).toBeTruthy();
      expect(loadedData!.gridSize).toBe(10);
      expect(loadedData!.tiles as unknown).toEqual([[1, 2]]);
    });

    it('should return null when map does not exist', () => {
      const loadedData = service.loadMap('nonexistent_id');

      expect(loadedData).toBeNull();
    });

    it('should set loaded map as current map', () => {
      const mapData = testMapData();
      const mapId = service.saveMap('Test Map', mapData)!;

      // Clear current map
      localStorageMock['novarise_current_map'] = 'other_map';

      service.loadMap(mapId);

      expect(localStorageMock['novarise_current_map']).toBe(mapId);
    });

    it('should handle corrupted JSON gracefully', () => {
      localStorageMock['novarise_map_corrupted'] = 'not valid json{';

      const loadedData = service.loadMap('corrupted');

      expect(loadedData).toBeNull();
    });
  });

  describe('getAllMaps', () => {
    it('should return empty array when no maps exist', () => {
      const maps = service.getAllMaps();

      expect(maps).toEqual([]);
    });

    it('should return all saved maps metadata', () => {
      service.saveMap('Map 1', testMapData());
      service.saveMap('Map 2', testMapData());
      service.saveMap('Map 3', testMapData());

      const maps = service.getAllMaps();

      expect(maps.length).toBe(3);
    });

    it('should return maps sorted by updated date (most recent first)', () => {
      const mapId1 = service.saveMap('Map 1', testMapData())!;
      service.saveMap('Map 2', testMapData());

      // Update first map to make it most recent
      service.saveMap('Map 1 Updated', testMapData(), mapId1);

      const maps = service.getAllMaps();

      expect(maps[0].name).toBe('Map 1 Updated');
    });

    it('should handle corrupted metadata gracefully', () => {
      localStorageMock['novarise_maps_metadata'] = 'invalid json';

      const maps = service.getAllMaps();

      expect(maps).toEqual([]);
    });
  });

  describe('getMapMetadata', () => {
    it('should return metadata for existing map', () => {
      const mapId = service.saveMap('Test Map', testMapData())!;

      const metadata = service.getMapMetadata(mapId);

      expect(metadata).toBeTruthy();
      expect(metadata!.name).toBe('Test Map');
      expect(metadata!.id).toBe(mapId);
    });

    it('should return null for non-existent map', () => {
      const metadata = service.getMapMetadata('nonexistent');

      expect(metadata).toBeNull();
    });
  });

  describe('deleteMap', () => {
    it('should delete existing map and return true', () => {
      const mapId = service.saveMap('Test Map', testMapData())!;

      const result = service.deleteMap(mapId);

      expect(result).toBe(true);
      expect(localStorageMock['novarise_map_' + mapId]).toBeUndefined();
    });

    it('should return false for non-existent map', () => {
      const result = service.deleteMap('nonexistent');

      expect(result).toBe(false);
    });

    it('should remove map from metadata index', () => {
      const mapId = service.saveMap('Test Map', testMapData())!;

      service.deleteMap(mapId);

      const maps = service.getAllMaps();
      expect(maps.find(m => m.id === mapId)).toBeUndefined();
    });

    it('should clear current map if deleted map was current', () => {
      const mapId = service.saveMap('Test Map', testMapData())!;
      expect(localStorageMock['novarise_current_map']).toBe(mapId);

      service.deleteMap(mapId);

      expect(localStorageMock['novarise_current_map']).toBeUndefined();
    });

    it('should clear MapBridgeService when deleted map is currently loaded in bridge', () => {
      const mapId = service.saveMap('Bridge Map', testMapData())!;
      mapBridge.setEditorMapState(testMapData(), mapId);
      expect(mapBridge.getMapId()).toBe(mapId);

      service.deleteMap(mapId);

      expect(mapBridge.hasEditorMap()).toBeFalse();
      expect(mapBridge.getMapId()).toBeNull();
    });

    it('should not clear MapBridgeService when a different map is deleted', () => {
      const mapId1 = service.saveMap('Map 1', testMapData())!;
      const mapId2 = service.saveMap('Map 2', testMapData())!;
      mapBridge.setEditorMapState(testMapData(), mapId1);

      service.deleteMap(mapId2);

      expect(mapBridge.getMapId()).toBe(mapId1);
      expect(mapBridge.hasEditorMap()).toBeTrue();
    });
  });

  describe('getCurrentMapId', () => {
    it('should return current map ID when set', () => {
      const mapId = service.saveMap('Test Map', testMapData())!;

      expect(service.getCurrentMapId()).toBe(mapId);
    });

    it('should return null when no current map', () => {
      expect(service.getCurrentMapId()).toBeNull();
    });
  });

  describe('loadCurrentMap', () => {
    it('should return current map data', () => {
      const mapData = testMapData({ tiles: [[1]] });
      service.saveMap('Test Map', mapData);

      const loadedData = service.loadCurrentMap();

      expect(loadedData).toBeTruthy();
      expect(loadedData!.tiles as unknown).toEqual([[1]]);
    });

    it('should return null when no current map', () => {
      expect(service.loadCurrentMap()).toBeNull();
    });
  });

  describe('migrateOldFormat', () => {
    it('should migrate old format data to new format', () => {
      const oldData = testMapData();
      localStorageMock['novarise_terrain'] = JSON.stringify(oldData);

      const result = service.migrateOldFormat();

      expect(result).toBe(true);
      expect(localStorageMock['novarise_terrain']).toBeUndefined();

      const maps = service.getAllMaps();
      expect(maps.length).toBe(1);
      expect(maps[0].name).toBe('Imported Map');
    });

    it('should return false when no old data exists', () => {
      const result = service.migrateOldFormat();

      expect(result).toBe(false);
    });

    it('should handle corrupted old data gracefully', () => {
      localStorageMock['novarise_terrain'] = 'invalid json';

      const result = service.migrateOldFormat();

      expect(result).toBe(false);
    });
  });

  describe('exportMapToJson', () => {
    it('should return JSON string for existing map', () => {
      const mapData = testMapData({ tiles: [[1, 2, 3]] });
      const mapId = service.saveMap('Test Map', mapData)!;

      const json = service.exportMapToJson(mapId);

      expect(json).toBeTruthy();
      const parsed: SavedMap = JSON.parse(json!);
      expect(parsed.metadata.name).toBe('Test Map');
    });

    it('should return null for non-existent map', () => {
      const json = service.exportMapToJson('nonexistent');

      expect(json).toBeNull();
    });
  });

  describe('importMapFromJson', () => {
    it('should import map from valid JSON', () => {
      const savedMap: SavedMap = {
        metadata: {
          id: 'old_id',
          name: 'Imported',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '1.0.0',
          gridSize: 25
        },
        data: testMapData({ tiles: [[1, 2]] })
      };

      const mapId = service.importMapFromJson(JSON.stringify(savedMap));

      expect(mapId).toBeTruthy();
      expect(mapId).not.toBe('old_id'); // Should generate new ID

      const loadedData = service.loadMap(mapId!);
      expect(loadedData!.tiles as unknown).toEqual([[1, 2]]);
    });

    it('should allow name override on import', () => {
      const savedMap: SavedMap = {
        metadata: {
          id: 'old_id',
          name: 'Original Name',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '1.0.0',
          gridSize: 25
        },
        data: testMapData()
      };

      const mapId = service.importMapFromJson(JSON.stringify(savedMap), 'Custom Name');

      const metadata = service.getMapMetadata(mapId!);
      expect(metadata!.name).toBe('Custom Name');
    });

    it('should return null for invalid JSON', () => {
      const mapId = service.importMapFromJson('invalid json');

      expect(mapId).toBeNull();
    });
  });

  describe('clearAllMaps', () => {
    it('should remove all maps from storage', () => {
      service.saveMap('Map 1', testMapData());
      service.saveMap('Map 2', testMapData());

      service.clearAllMaps();

      expect(service.getAllMaps()).toEqual([]);
      expect(service.getCurrentMapId()).toBeNull();
    });
  });

  describe('generateMapId (private method behavior)', () => {
    it('should generate unique IDs for different maps', () => {
      const mapData = testMapData();

      const id1 = service.saveMap('Map 1', mapData)!;
      const id2 = service.saveMap('Map 2', mapData)!;
      const id3 = service.saveMap('Map 3', mapData)!;

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should generate IDs with expected format', () => {
      const mapData = testMapData();
      const mapId = service.saveMap('Test Map', mapData)!;

      // Format: map_{timestamp}_{random}
      expect(mapId).toMatch(/^map_\d{13,}_[a-z0-9]{8,9}$/);
    });
  });

  describe('validateMapJson', () => {
    it('should return valid for properly structured map JSON', () => {
      const savedMap: SavedMap = {
        metadata: {
          id: 'test_id',
          name: 'Test Map',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '1.0.0',
          gridSize: 25
        },
        data: testMapData({ tiles: [[1, 2, 3]] })
      };

      const result = service.validateMapJson(JSON.stringify(savedMap));

      expect(result.valid).toBe(true);
      expect(result.name).toBe('Test Map');
    });

    it('should return invalid for missing data', () => {
      const invalidMap = {
        metadata: {
          id: 'test_id',
          name: 'Test Map'
        }
        // missing data property
      };

      const result = service.validateMapJson(JSON.stringify(invalidMap));

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing map data');
    });

    it('should return invalid for missing gridSize', () => {
      const invalidMap = {
        metadata: { name: 'Test' },
        data: { tiles: [] }  // missing gridSize
      };

      const result = service.validateMapJson(JSON.stringify(invalidMap));

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid or missing grid size');
    });

    it('should return invalid for missing tiles array', () => {
      const invalidMap = {
        metadata: { name: 'Test' },
        data: { gridSize: 25 }  // missing tiles
      };

      const result = service.validateMapJson(JSON.stringify(invalidMap));

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid or missing tiles data');
    });

    it('should return invalid for non-array tiles', () => {
      const invalidMap = {
        metadata: { name: 'Test' },
        data: { gridSize: 25, tiles: 'not an array' }
      };

      const result = service.validateMapJson(JSON.stringify(invalidMap));

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid or missing tiles data');
    });

    it('should return invalid for malformed JSON', () => {
      const result = service.validateMapJson('not valid json {{{');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid JSON format');
    });

    it('should use "Unnamed Map" when metadata.name is missing', () => {
      const savedMap = {
        metadata: {},  // no name
        data: testMapData({ tiles: [[]] })
      };

      const result = service.validateMapJson(JSON.stringify(savedMap));

      expect(result.valid).toBe(true);
      expect(result.name).toBe('Unnamed Map');
    });
  });

  describe('downloadMapAsFile', () => {
    let mockCreateElement: jasmine.Spy;
    let mockAppendChild: jasmine.Spy;
    let mockRemoveChild: jasmine.Spy;
    let mockClick: jasmine.Spy;
    let mockCreateObjectURL: jasmine.Spy;
    let mockRevokeObjectURL: jasmine.Spy;
    let capturedLink: HTMLAnchorElement;

    beforeEach(() => {
      mockClick = jasmine.createSpy('click');
      capturedLink = {
        href: '',
        download: '',
        click: mockClick
      } as unknown as HTMLAnchorElement;

      mockCreateElement = spyOn(document, 'createElement').and.returnValue(capturedLink);
      mockAppendChild = spyOn(document.body, 'appendChild').and.returnValue(capturedLink);
      mockRemoveChild = spyOn(document.body, 'removeChild').and.returnValue(capturedLink);
      mockCreateObjectURL = spyOn(URL, 'createObjectURL').and.returnValue('blob:mock-url');
      mockRevokeObjectURL = spyOn(URL, 'revokeObjectURL');
    });

    it('should return false when map does not exist', () => {
      const result = service.downloadMapAsFile('nonexistent');

      expect(result).toBe(false);
      expect(mockCreateElement).not.toHaveBeenCalled();
    });

    it('should create download link with correct filename', () => {
      const mapData = testMapData();
      const mapId = service.saveMap('My Test Map', mapData)!;

      const result = service.downloadMapAsFile(mapId);

      expect(result).toBe(true);
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(capturedLink.download).toBe('My_Test_Map.novarise.json');
    });

    it('should sanitize filename by removing invalid characters', () => {
      const mapData = testMapData();
      const mapId = service.saveMap('Test<>:"/\\|?*Map', mapData)!;

      service.downloadMapAsFile(mapId);

      expect(capturedLink.download).toBe('TestMap.novarise.json');
    });

    it('should sanitize filename by replacing spaces with underscores', () => {
      const mapData = testMapData();
      const mapId = service.saveMap('My  Map   Name', mapData)!;

      service.downloadMapAsFile(mapId);

      expect(capturedLink.download).toBe('My_Map_Name.novarise.json');
    });

    it('should truncate long filenames', () => {
      const mapData = testMapData();
      const longName = 'A'.repeat(100);
      const mapId = service.saveMap(longName, mapData)!;

      service.downloadMapAsFile(mapId);

      // Should be truncated to 50 chars + extension
      expect(capturedLink.download.length).toBeLessThanOrEqual(50 + '.novarise.json'.length);
    });

    it('should use default filename when map name is empty', () => {
      const mapData = testMapData();
      const mapId = service.saveMap('', mapData)!;

      service.downloadMapAsFile(mapId);

      expect(capturedLink.download).toBe('map.novarise.json');
    });

    it('should create blob URL and trigger download', () => {
      const mapData = testMapData();
      const mapId = service.saveMap('Test', mapData)!;

      service.downloadMapAsFile(mapId);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(capturedLink.href).toBe('blob:mock-url');
      expect(mockClick).toHaveBeenCalled();
    });

    it('should clean up blob URL after download', () => {
      const mapData = testMapData();
      const mapId = service.saveMap('Test', mapData)!;

      service.downloadMapAsFile(mapId);

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should append and remove link from document body', () => {
      const mapData = testMapData();
      const mapId = service.saveMap('Test', mapData)!;

      service.downloadMapAsFile(mapId);

      expect(mockAppendChild).toHaveBeenCalledWith(capturedLink);
      expect(mockRemoveChild).toHaveBeenCalledWith(capturedLink);
    });
  });

  describe('promptFileImport', () => {
    let mockInput: HTMLInputElement;
    let mockClick: jasmine.Spy;

    beforeEach(() => {
      mockClick = jasmine.createSpy('click');
      mockInput = {
        type: '',
        accept: '',
        onchange: null as any,
        oncancel: null as any,
        click: mockClick
      } as unknown as HTMLInputElement;

      spyOn(document, 'createElement').and.returnValue(mockInput);
    });

    it('should create file input with correct attributes', async () => {
      const promise = service.promptFileImport();

      expect(document.createElement).toHaveBeenCalledWith('input');
      expect(mockInput.type).toBe('file');
      expect(mockInput.accept).toBe('.json,.novarise.json');

      // Trigger cancel to resolve promise
      if (mockInput.oncancel) {
        mockInput.oncancel(new Event('cancel'));
      }

      await promise;
    });

    it('should trigger click on input', async () => {
      const promise = service.promptFileImport();

      expect(mockClick).toHaveBeenCalled();

      // Trigger cancel to resolve promise
      if (mockInput.oncancel) {
        mockInput.oncancel(new Event('cancel'));
      }

      await promise;
    });

    it('should resolve with null mapId and null errorCode when user cancels', async () => {
      const promise = service.promptFileImport();

      // Trigger cancel
      if (mockInput.oncancel) {
        mockInput.oncancel(new Event('cancel'));
      }

      const result = await promise;
      expect(result.mapId).toBeNull();
      expect(result.errorCode).toBeNull();
    });

    it('should resolve with null mapId and null errorCode when no file selected', async () => {
      const promise = service.promptFileImport();

      // Simulate change event with no files, setting target to the mock input
      Object.defineProperty(mockInput, 'files', { value: [] });
      if (mockInput.onchange) {
        const event = new Event('change');
        Object.defineProperty(event, 'target', { value: mockInput });
        mockInput.onchange.call(mockInput, event);
      }

      const result = await promise;
      expect(result.mapId).toBeNull();
      expect(result.errorCode).toBeNull();
    });

    it('should resolve with map ID and null errorCode when valid file is selected', async () => {
      const validMap: SavedMap = {
        metadata: {
          id: 'old_id',
          name: 'Imported Map',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '1.0.0',
          gridSize: 25
        },
        data: testMapData()
      };

      const mockFile = new File([JSON.stringify(validMap)], 'test.json', { type: 'application/json' });

      const promise = service.promptFileImport();

      // Simulate file selection
      Object.defineProperty(mockInput, 'files', { value: [mockFile] });
      if (mockInput.onchange) {
        await mockInput.onchange({ target: mockInput } as any);
      }

      const result = await promise;
      expect(result.mapId).toBeTruthy();
      expect(result.mapId).toMatch(/^map_\d+_[a-z0-9]+$/);
      expect(result.errorCode).toBeNull();
    });

    it('should resolve with invalid_json errorCode when file has invalid JSON', async () => {
      const mockFile = new File(['not valid json'], 'test.json', { type: 'application/json' });

      const promise = service.promptFileImport();

      Object.defineProperty(mockInput, 'files', { value: [mockFile] });
      if (mockInput.onchange) {
        await mockInput.onchange({ target: mockInput } as any);
      }

      const result = await promise;
      expect(result.mapId).toBeNull();
      expect(result.errorCode).toBe('invalid_json');
    });

    it('should resolve with invalid_schema errorCode when file has invalid map structure', async () => {
      const invalidMap = {
        metadata: { name: 'Test' },
        data: { }  // missing required fields
      };

      const mockFile = new File([JSON.stringify(invalidMap)], 'test.json', { type: 'application/json' });

      const promise = service.promptFileImport();

      Object.defineProperty(mockInput, 'files', { value: [mockFile] });
      if (mockInput.onchange) {
        await mockInput.onchange({ target: mockInput } as any);
      }

      const result = await promise;
      expect(result.mapId).toBeNull();
      expect(result.errorCode).toBe('invalid_schema');
    });

    it('should resolve with file_too_large errorCode when file exceeds 512KB', async () => {
      // Create a mock file with size > 512KB by overriding the size property
      const mockFile = new File(['x'], 'big.json', { type: 'application/json' });
      Object.defineProperty(mockFile, 'size', { value: 513 * 1024 });

      const promise = service.promptFileImport();

      Object.defineProperty(mockInput, 'files', { value: [mockFile] });
      if (mockInput.onchange) {
        await mockInput.onchange({ target: mockInput } as any);
      }

      const result = await promise;
      expect(result.mapId).toBeNull();
      expect(result.errorCode).toBe('file_too_large');
    });
  });

  describe('schema versioning', () => {
    it('should stamp schemaVersion on saved maps', () => {
      const mapId = service.saveMap('Test Map', testMapData())!;
      const savedJson = localStorageMock['novarise_map_' + mapId];
      const savedMap: SavedMap = JSON.parse(savedJson);

      expect(savedMap.data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('should load v1 data (singular spawnPoint/exitPoint) via migration', () => {
      const v1Data = {
        gridSize: 10,
        tiles: [[]],
        heightMap: [[]],
        spawnPoint: { x: 0, z: 0 },
        exitPoint: { x: 9, z: 9 },
        version: '1.0.0'
      };
      const savedMap = {
        metadata: {
          id: 'v1_map',
          name: 'Legacy Map',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '1.0.0',
          gridSize: 10
        },
        data: v1Data
      };
      localStorageMock['novarise_map_v1_map'] = JSON.stringify(savedMap);

      const result = service.loadMap('v1_map');

      expect(result).not.toBeNull();
      expect(result!.spawnPoints).toEqual([{ x: 0, z: 0 }]);
      expect(result!.exitPoints).toEqual([{ x: 9, z: 9 }]);
      expect((result as unknown as Record<string, unknown>)['spawnPoint']).toBeUndefined();
    });

    it('should re-save migrated data to localStorage after migration', () => {
      const v1Data = {
        gridSize: 10,
        tiles: [[]],
        heightMap: [[]],
        spawnPoint: { x: 0, z: 0 },
        exitPoint: { x: 9, z: 9 },
        version: '1.0.0'
      };
      const savedMap = {
        metadata: {
          id: 'v1_resave',
          name: 'Legacy',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '1.0.0',
          gridSize: 10
        },
        data: v1Data
      };
      localStorageMock['novarise_map_v1_resave'] = JSON.stringify(savedMap);

      service.loadMap('v1_resave');

      const reSaved: SavedMap = JSON.parse(localStorageMock['novarise_map_v1_resave']);
      expect(reSaved.data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(reSaved.data.spawnPoints).toEqual([{ x: 0, z: 0 }]);
    });

    it('should return null when loading data from a future schema version', () => {
      const futureSavedMap = {
        metadata: {
          id: 'future_map',
          name: 'Future',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '99.0.0',
          gridSize: 10
        },
        data: {
          gridSize: 10,
          tiles: [[]],
          heightMap: [[]],
          spawnPoints: [],
          exitPoints: [],
          version: '99.0.0',
          schemaVersion: CURRENT_SCHEMA_VERSION + 1
        }
      };
      localStorageMock['novarise_map_future_map'] = JSON.stringify(futureSavedMap);

      const result = service.loadMap('future_map');

      expect(result).toBeNull();
    });

    it('should round-trip: save v2 data → load → data unchanged', () => {
      const original = testMapData({ tiles: [[1, 2]] });
      const mapId = service.saveMap('Round Trip', original)!;

      const loaded = service.loadMap(mapId);

      expect(loaded).not.toBeNull();
      expect(loaded!.gridSize).toBe(original.gridSize);
      expect(loaded!.tiles as unknown).toEqual([[1, 2]]);
      expect(loaded!.spawnPoints).toEqual(original.spawnPoints);
      expect(loaded!.exitPoints).toEqual(original.exitPoints);
      expect(loaded!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('should not re-save to localStorage when schemaVersion is already current', () => {
      const mapData = testMapData();
      const mapId = service.saveMap('No Re-save', mapData)!;

      // Record initial call count
      const setItemSpy = localStorage.setItem as jasmine.Spy;
      setItemSpy.calls.reset();

      service.loadMap(mapId);

      // setItem should only be called for current_map, not for the map data itself
      const dataKeyCalls = setItemSpy.calls.all().filter(
        (call: jasmine.CallInfo<jasmine.Func>) => (call.args[0] as string).startsWith('novarise_map_map_')
      );
      expect(dataKeyCalls.length).toBe(0);
    });

    it('should import v1 map from JSON and migrate automatically', () => {
      const v1Map = {
        metadata: {
          id: 'v1_import',
          name: 'V1 Import',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '1.0.0',
          gridSize: 10
        },
        data: {
          gridSize: 10,
          tiles: [[]],
          heightMap: [[]],
          spawnPoint: { x: 0, z: 0 },
          exitPoint: { x: 9, z: 9 },
          version: '1.0.0'
        }
      };

      const mapId = service.importMapFromJson(JSON.stringify(v1Map));

      expect(mapId).not.toBeNull();
      const loaded = service.loadMap(mapId!);
      expect(loaded!.spawnPoints).toEqual([{ x: 0, z: 0 }]);
      expect(loaded!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('should return null when migrated data fails post-migration validation', () => {
      const consoleSpy = spyOn(console, 'error');
      // Inject a stored map whose data is structurally invalid even after migration
      // (gridSize out of range, no spawnPoints, no exitPoints)
      const invalidStoredMap = {
        metadata: {
          id: 'bad-migrated',
          name: 'Bad Migrated',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '2.0.0',
          gridSize: 3
        },
        data: {
          gridSize: 3,         // below minimum of 5 — fails validation
          tiles: [[]],
          heightMap: [[]],
          spawnPoints: [],     // empty — fails validation
          exitPoints: [],      // empty — fails validation
          version: '2.0.0',
          schemaVersion: CURRENT_SCHEMA_VERSION
        }
      };
      localStorageMock['novarise_map_bad-migrated'] = JSON.stringify(invalidStoredMap);

      const result = service.loadMap('bad-migrated');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        jasmine.stringContaining('failed validation'),
        jasmine.any(String)
      );
    });
  });

  describe('importMapFromJson (edge cases)', () => {
    it('should return null when data has invalid gridSize type', () => {
      const invalidMap: SavedMap = {
        metadata: {
          id: 'test',
          name: 'Test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '1.0.0',
          gridSize: 25
        },
        data: testMapData({ gridSize: 'invalid' as unknown })
      };

      const result = service.importMapFromJson(JSON.stringify(invalidMap));

      expect(result).toBeNull();
    });

    it('should use metadata name when no name override provided', () => {
      const savedMap: SavedMap = {
        metadata: {
          id: 'old_id',
          name: 'Original Name',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '1.0.0',
          gridSize: 25
        },
        data: testMapData()
      };

      const mapId = service.importMapFromJson(JSON.stringify(savedMap));
      const metadata = service.getMapMetadata(mapId!);

      expect(metadata!.name).toBe('Original Name');
    });

    it('should use "Imported Map" when no metadata name exists', () => {
      const savedMap = {
        metadata: {},  // no name
        data: testMapData()
      };

      const mapId = service.importMapFromJson(JSON.stringify(savedMap));
      const metadata = service.getMapMetadata(mapId!);

      expect(metadata!.name).toBe('Imported Map');
    });
  });

  describe('error paths', () => {
    it('saveMap returns null when storageService.setJSON fails for map data', () => {
      const consoleSpy = spyOn(console, 'error');
      // Make setItem throw for map data keys to simulate quota exceeded
      const realSetItem = localStorageMock;
      (localStorage.setItem as jasmine.Spy).and.callFake((key: string, value: string) => {
        if (key.startsWith('novarise_map_map_')) {
          throw new DOMException('quota exceeded', 'QuotaExceededError');
        }
        realSetItem[key] = value;
      });

      const result = service.saveMap('Full Storage', testMapData());

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        jasmine.stringContaining('Failed to save map')
      );
    });

    it('saveMap does not update metadata index when write fails', () => {
      // Make setItem throw for map data keys
      const realSetItem = localStorageMock;
      (localStorage.setItem as jasmine.Spy).and.callFake((key: string, value: string) => {
        if (key.startsWith('novarise_map_map_')) {
          throw new DOMException('quota exceeded', 'QuotaExceededError');
        }
        realSetItem[key] = value;
      });

      service.saveMap('Failed Map', testMapData());

      const maps = service.getAllMaps();
      expect(maps.length).toBe(0);
      expect(localStorageMock['novarise_maps_metadata']).toBeUndefined();
    });

    it('importMapFromJson with JSON missing tiles returns null', () => {
      const invalidMap = {
        metadata: {
          id: 'no-tiles',
          name: 'No Tiles',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '2.0.0',
          gridSize: 10
        },
        data: {
          gridSize: 10,
          heightMap: [[]],
          spawnPoints: [{ x: 0, z: 0 }],
          exitPoints: [{ x: 9, z: 9 }],
          version: '2.0.0',
          schemaVersion: 2
          // tiles intentionally absent
        }
      };

      const result = service.importMapFromJson(JSON.stringify(invalidMap));
      expect(result).toBeNull();
    });

    it('importMapFromJson with gridSize below minimum (< 5) returns null', () => {
      const invalidMap = {
        metadata: {
          id: 'tiny',
          name: 'Tiny',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '2.0.0',
          gridSize: 3
        },
        data: {
          gridSize: 3, // below minimum of 5
          tiles: [[]],
          heightMap: [[]],
          spawnPoints: [{ x: 0, z: 0 }],
          exitPoints: [{ x: 2, z: 2 }],
          version: '2.0.0',
          schemaVersion: 2
        }
      };

      const result = service.importMapFromJson(JSON.stringify(invalidMap));
      expect(result).toBeNull();
    });

    it('importMapFromJson with gridSize above maximum (> 50) returns null', () => {
      const invalidMap = {
        metadata: {
          id: 'huge',
          name: 'Huge',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '2.0.0',
          gridSize: 99
        },
        data: {
          gridSize: 99, // above maximum of 50
          tiles: [[]],
          heightMap: [[]],
          spawnPoints: [{ x: 0, z: 0 }],
          exitPoints: [{ x: 98, z: 98 }],
          version: '2.0.0',
          schemaVersion: 2
        }
      };

      const result = service.importMapFromJson(JSON.stringify(invalidMap));
      expect(result).toBeNull();
    });

    it('exportMapToJson for non-existent map returns null', () => {
      const result = service.exportMapToJson('does-not-exist-xyz');
      expect(result).toBeNull();
    });

    it('deleteMap for non-existent map returns false', () => {
      const result = service.deleteMap('does-not-exist-xyz');
      expect(result).toBeFalse();
    });

    it('loadMap with map data at unsupported future schema version returns null', () => {
      // Inject a map with schemaVersion far beyond the current version.
      // migrateMap() rejects data from a future schema version, causing loadMap to return null.
      const futureSchemaMap = {
        metadata: {
          id: 'future-schema',
          name: 'Future Schema',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '99.0.0',
          gridSize: 10
        },
        data: {
          gridSize: 10,
          tiles: [[]],
          heightMap: [[]],
          spawnPoints: [{ x: 0, z: 0 }],
          exitPoints: [{ x: 9, z: 9 }],
          version: '99.0.0',
          schemaVersion: CURRENT_SCHEMA_VERSION + 1 // one version beyond current
        }
      };
      localStorageMock['novarise_map_future-schema'] = JSON.stringify(futureSchemaMap);

      const result = service.loadMap('future-schema');
      expect(result).toBeNull();
    });
  });
});
