import { TestBed } from '@angular/core/testing';
import { MapStorageService, MapMetadata, SavedMap } from './map-storage.service';

describe('MapStorageService', () => {
  let service: MapStorageService;
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
      providers: [MapStorageService]
    });

    service = TestBed.inject(MapStorageService);
  });

  afterEach(() => {
    localStorageMock = {};
  });

  describe('saveMap', () => {
    it('should save a new map with generated ID', () => {
      const mapData = { gridSize: 25, tiles: [], version: '1.0.0' };
      const mapId = service.saveMap('Test Map', mapData);

      expect(mapId).toBeTruthy();
      expect(mapId).toMatch(/^map_\d+_[a-z0-9]+$/);
    });

    it('should save map data to localStorage', () => {
      const mapData = { gridSize: 25, tiles: [], version: '1.0.0' };
      const mapId = service.saveMap('Test Map', mapData);

      const savedJson = localStorageMock['novarise_map_' + mapId];
      expect(savedJson).toBeTruthy();

      const savedMap: SavedMap = JSON.parse(savedJson);
      expect(savedMap.metadata.name).toBe('Test Map');
      expect(savedMap.data.gridSize).toBe(25);
    });

    it('should update metadata with correct timestamps', () => {
      const mapData = { gridSize: 25, tiles: [], version: '1.0.0' };
      const beforeSave = Date.now();
      const mapId = service.saveMap('Test Map', mapData);
      const afterSave = Date.now();

      const savedJson = localStorageMock['novarise_map_' + mapId];
      const savedMap: SavedMap = JSON.parse(savedJson);

      expect(savedMap.metadata.createdAt).toBeGreaterThanOrEqual(beforeSave);
      expect(savedMap.metadata.createdAt).toBeLessThanOrEqual(afterSave);
      expect(savedMap.metadata.updatedAt).toBeGreaterThanOrEqual(beforeSave);
      expect(savedMap.metadata.updatedAt).toBeLessThanOrEqual(afterSave);
    });

    it('should update existing map when ID is provided', () => {
      const mapData = { gridSize: 25, tiles: [], version: '1.0.0' };
      const mapId = service.saveMap('Original Name', mapData);

      const originalJson = localStorageMock['novarise_map_' + mapId];
      const originalMap: SavedMap = JSON.parse(originalJson);
      const originalCreatedAt = originalMap.metadata.createdAt;

      // Wait a bit to ensure different timestamp
      const updatedData = { gridSize: 25, tiles: [1, 2, 3], version: '1.0.0' };
      service.saveMap('Updated Name', updatedData, mapId);

      const updatedJson = localStorageMock['novarise_map_' + mapId];
      const updatedMap: SavedMap = JSON.parse(updatedJson);

      expect(updatedMap.metadata.name).toBe('Updated Name');
      expect(updatedMap.metadata.createdAt).toBe(originalCreatedAt);
      expect(updatedMap.data.tiles).toEqual([1, 2, 3]);
    });

    it('should set saved map as current map', () => {
      const mapData = { gridSize: 25, tiles: [], version: '1.0.0' };
      const mapId = service.saveMap('Test Map', mapData);

      expect(localStorageMock['novarise_current_map']).toBe(mapId);
    });

    it('should update metadata index when saving', () => {
      const mapData = { gridSize: 25, tiles: [], version: '1.0.0' };
      service.saveMap('Test Map', mapData);

      const metadataJson = localStorageMock['novarise_maps_metadata'];
      expect(metadataJson).toBeTruthy();

      const metadata: MapMetadata[] = JSON.parse(metadataJson);
      expect(metadata.length).toBe(1);
      expect(metadata[0].name).toBe('Test Map');
    });
  });

  describe('loadMap', () => {
    it('should return map data when map exists', () => {
      const mapData = { gridSize: 25, tiles: [[1, 2]], version: '1.0.0' };
      const mapId = service.saveMap('Test Map', mapData);

      const loadedData = service.loadMap(mapId);

      expect(loadedData).toBeTruthy();
      expect(loadedData.gridSize).toBe(25);
      expect(loadedData.tiles).toEqual([[1, 2]]);
    });

    it('should return null when map does not exist', () => {
      const loadedData = service.loadMap('nonexistent_id');

      expect(loadedData).toBeNull();
    });

    it('should set loaded map as current map', () => {
      const mapData = { gridSize: 25, tiles: [], version: '1.0.0' };
      const mapId = service.saveMap('Test Map', mapData);

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
      service.saveMap('Map 1', { gridSize: 25, version: '1.0.0' });
      service.saveMap('Map 2', { gridSize: 25, version: '1.0.0' });
      service.saveMap('Map 3', { gridSize: 25, version: '1.0.0' });

      const maps = service.getAllMaps();

      expect(maps.length).toBe(3);
    });

    it('should return maps sorted by updated date (most recent first)', () => {
      const mapId1 = service.saveMap('Map 1', { gridSize: 25, version: '1.0.0' });
      service.saveMap('Map 2', { gridSize: 25, version: '1.0.0' });

      // Update first map to make it most recent
      service.saveMap('Map 1 Updated', { gridSize: 25, version: '1.0.0' }, mapId1);

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
      const mapId = service.saveMap('Test Map', { gridSize: 25, version: '1.0.0' });

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
      const mapId = service.saveMap('Test Map', { gridSize: 25, version: '1.0.0' });

      const result = service.deleteMap(mapId);

      expect(result).toBe(true);
      expect(localStorageMock['novarise_map_' + mapId]).toBeUndefined();
    });

    it('should return false for non-existent map', () => {
      const result = service.deleteMap('nonexistent');

      expect(result).toBe(false);
    });

    it('should remove map from metadata index', () => {
      const mapId = service.saveMap('Test Map', { gridSize: 25, version: '1.0.0' });

      service.deleteMap(mapId);

      const maps = service.getAllMaps();
      expect(maps.find(m => m.id === mapId)).toBeUndefined();
    });

    it('should clear current map if deleted map was current', () => {
      const mapId = service.saveMap('Test Map', { gridSize: 25, version: '1.0.0' });
      expect(localStorageMock['novarise_current_map']).toBe(mapId);

      service.deleteMap(mapId);

      expect(localStorageMock['novarise_current_map']).toBeUndefined();
    });
  });

  describe('getCurrentMapId', () => {
    it('should return current map ID when set', () => {
      const mapId = service.saveMap('Test Map', { gridSize: 25, version: '1.0.0' });

      expect(service.getCurrentMapId()).toBe(mapId);
    });

    it('should return null when no current map', () => {
      expect(service.getCurrentMapId()).toBeNull();
    });
  });

  describe('loadCurrentMap', () => {
    it('should return current map data', () => {
      const mapData = { gridSize: 25, tiles: [[1]], version: '1.0.0' };
      service.saveMap('Test Map', mapData);

      const loadedData = service.loadCurrentMap();

      expect(loadedData).toBeTruthy();
      expect(loadedData.tiles).toEqual([[1]]);
    });

    it('should return null when no current map', () => {
      expect(service.loadCurrentMap()).toBeNull();
    });
  });

  describe('migrateOldFormat', () => {
    it('should migrate old format data to new format', () => {
      const oldData = { gridSize: 25, tiles: [], version: '1.0.0' };
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
      const mapData = { gridSize: 25, tiles: [[1, 2, 3]], version: '1.0.0' };
      const mapId = service.saveMap('Test Map', mapData);

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
        data: { gridSize: 25, tiles: [[1, 2]], version: '1.0.0' }
      };

      const mapId = service.importMapFromJson(JSON.stringify(savedMap));

      expect(mapId).toBeTruthy();
      expect(mapId).not.toBe('old_id'); // Should generate new ID

      const loadedData = service.loadMap(mapId!);
      expect(loadedData.tiles).toEqual([[1, 2]]);
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
        data: { gridSize: 25, tiles: [], version: '1.0.0' }
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
      service.saveMap('Map 1', { gridSize: 25, version: '1.0.0' });
      service.saveMap('Map 2', { gridSize: 25, version: '1.0.0' });

      service.clearAllMaps();

      expect(service.getAllMaps()).toEqual([]);
      expect(service.getCurrentMapId()).toBeNull();
    });
  });

  describe('generateMapId (private method behavior)', () => {
    it('should generate unique IDs for different maps', () => {
      const mapData = { gridSize: 25, version: '1.0.0' };

      const id1 = service.saveMap('Map 1', mapData);
      const id2 = service.saveMap('Map 2', mapData);
      const id3 = service.saveMap('Map 3', mapData);

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should generate IDs with expected format', () => {
      const mapData = { gridSize: 25, version: '1.0.0' };
      const mapId = service.saveMap('Test Map', mapData);

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
        data: { gridSize: 25, tiles: [[1, 2, 3]], version: '1.0.0' }
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
        data: { gridSize: 25, tiles: [] }
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
      const mapData = { gridSize: 25, tiles: [], version: '1.0.0' };
      const mapId = service.saveMap('My Test Map', mapData);

      const result = service.downloadMapAsFile(mapId);

      expect(result).toBe(true);
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(capturedLink.download).toBe('My_Test_Map.novarise.json');
    });

    it('should sanitize filename by removing invalid characters', () => {
      const mapData = { gridSize: 25, tiles: [], version: '1.0.0' };
      const mapId = service.saveMap('Test<>:"/\\|?*Map', mapData);

      service.downloadMapAsFile(mapId);

      expect(capturedLink.download).toBe('TestMap.novarise.json');
    });

    it('should sanitize filename by replacing spaces with underscores', () => {
      const mapData = { gridSize: 25, tiles: [], version: '1.0.0' };
      const mapId = service.saveMap('My  Map   Name', mapData);

      service.downloadMapAsFile(mapId);

      expect(capturedLink.download).toBe('My_Map_Name.novarise.json');
    });

    it('should truncate long filenames', () => {
      const mapData = { gridSize: 25, tiles: [], version: '1.0.0' };
      const longName = 'A'.repeat(100);
      const mapId = service.saveMap(longName, mapData);

      service.downloadMapAsFile(mapId);

      // Should be truncated to 50 chars + extension
      expect(capturedLink.download.length).toBeLessThanOrEqual(50 + '.novarise.json'.length);
    });

    it('should use default filename when map name is empty', () => {
      const mapData = { gridSize: 25, tiles: [], version: '1.0.0' };
      const mapId = service.saveMap('', mapData);

      service.downloadMapAsFile(mapId);

      expect(capturedLink.download).toBe('map.novarise.json');
    });

    it('should create blob URL and trigger download', () => {
      const mapData = { gridSize: 25, tiles: [], version: '1.0.0' };
      const mapId = service.saveMap('Test', mapData);

      service.downloadMapAsFile(mapId);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(capturedLink.href).toBe('blob:mock-url');
      expect(mockClick).toHaveBeenCalled();
    });

    it('should clean up blob URL after download', () => {
      const mapData = { gridSize: 25, tiles: [], version: '1.0.0' };
      const mapId = service.saveMap('Test', mapData);

      service.downloadMapAsFile(mapId);

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should append and remove link from document body', () => {
      const mapData = { gridSize: 25, tiles: [], version: '1.0.0' };
      const mapId = service.saveMap('Test', mapData);

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

    it('should resolve with null when user cancels', async () => {
      const promise = service.promptFileImport();

      // Trigger cancel
      if (mockInput.oncancel) {
        mockInput.oncancel(new Event('cancel'));
      }

      const result = await promise;
      expect(result).toBeNull();
    });

    it('should resolve with null when no file selected', async () => {
      const promise = service.promptFileImport();

      // Simulate change event with no files
      Object.defineProperty(mockInput, 'files', { value: [] });
      if (mockInput.onchange) {
        mockInput.onchange(new Event('change') as any);
      }

      const result = await promise;
      expect(result).toBeNull();
    });

    it('should resolve with map ID when valid file is selected', async () => {
      const validMap: SavedMap = {
        metadata: {
          id: 'old_id',
          name: 'Imported Map',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: '1.0.0',
          gridSize: 25
        },
        data: { gridSize: 25, tiles: [], version: '1.0.0' }
      };

      const mockFile = new File([JSON.stringify(validMap)], 'test.json', { type: 'application/json' });

      const promise = service.promptFileImport();

      // Simulate file selection
      Object.defineProperty(mockInput, 'files', { value: [mockFile] });
      if (mockInput.onchange) {
        await mockInput.onchange({ target: mockInput } as any);
      }

      const result = await promise;
      expect(result).toBeTruthy();
      expect(result).toMatch(/^map_\d+_[a-z0-9]+$/);
    });

    it('should resolve with null when file has invalid JSON', async () => {
      const mockFile = new File(['not valid json'], 'test.json', { type: 'application/json' });

      const promise = service.promptFileImport();

      Object.defineProperty(mockInput, 'files', { value: [mockFile] });
      if (mockInput.onchange) {
        await mockInput.onchange({ target: mockInput } as any);
      }

      const result = await promise;
      expect(result).toBeNull();
    });

    it('should resolve with null when file has invalid map structure', async () => {
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
      expect(result).toBeNull();
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
        data: { gridSize: 'invalid' as any, tiles: [], version: '1.0.0' }
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
        data: { gridSize: 25, tiles: [], version: '1.0.0' }
      };

      const mapId = service.importMapFromJson(JSON.stringify(savedMap));
      const metadata = service.getMapMetadata(mapId!);

      expect(metadata!.name).toBe('Original Name');
    });

    it('should use "Imported Map" when no metadata name exists', () => {
      const savedMap = {
        metadata: {},  // no name
        data: { gridSize: 25, tiles: [], version: '1.0.0' }
      };

      const mapId = service.importMapFromJson(JSON.stringify(savedMap));
      const metadata = service.getMapMetadata(mapId!);

      expect(metadata!.name).toBe('Imported Map');
    });
  });
});
