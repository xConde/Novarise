import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { MapFileService } from './map-file.service';
import { MapStorageService } from '../../../core/services/map-storage.service';
import { MapTemplateService } from '../../../core/services/map-template.service';
import { EditorNotificationService } from './editor-notification.service';
import { EditorStateService } from './editor-state.service';
import { TerrainGrid } from '../features/terrain-editor/terrain-grid.class';
import { TerrainGridState } from '../features/terrain-editor/terrain-grid-state.interface';
import { EDITOR_AUTOSAVE_DRAFT_KEY } from '../constants/editor-ui.constants';
import { StorageService } from '../../../core/services/storage.service';

describe('MapFileService', () => {
  let service: MapFileService;
  let mapStorage: jasmine.SpyObj<MapStorageService>;
  let mapTemplateService: jasmine.SpyObj<MapTemplateService>;
  let editorNotification: jasmine.SpyObj<EditorNotificationService>;
  let editorState: jasmine.SpyObj<EditorStateService>;
  let scene: THREE.Scene;
  let terrainGrid: TerrainGrid;

  const fakeState: TerrainGridState = {
    version: '2',
    gridSize: 5,
    tiles: [],
    heightMap: [],
    spawnPoints: [{ x: 0, z: 0 }],
    exitPoints: [{ x: 4, z: 4 }],
  };

  beforeEach(() => {
    mapStorage = jasmine.createSpyObj('MapStorageService', [
      'saveMap', 'loadMap', 'getAllMaps', 'getMapMetadata',
      'getCurrentMapId', 'clearCurrentMapId', 'loadCurrentMap',
      'downloadMapAsFile', 'promptFileImport',
    ]);
    mapTemplateService = jasmine.createSpyObj('MapTemplateService', ['getTemplates', 'loadTemplate']);
    editorNotification = jasmine.createSpyObj('EditorNotificationService', ['show', 'clear', 'dismiss']);
    editorState = jasmine.createSpyObj('EditorStateService', [
      'getCurrentMapName', 'setCurrentMapName',
    ]);

    TestBed.configureTestingModule({
      providers: [
        MapFileService,
        StorageService,
        { provide: MapStorageService, useValue: mapStorage },
        { provide: MapTemplateService, useValue: mapTemplateService },
        { provide: EditorNotificationService, useValue: editorNotification },
        { provide: EditorStateService, useValue: editorState },
      ],
    });

    service = TestBed.inject(MapFileService);

    scene = new THREE.Scene();
    terrainGrid = new TerrainGrid(scene, 5);
    service.setTerrainGrid(terrainGrid);
  });

  afterEach(() => {
    service.stopAutosave();
    terrainGrid.dispose();
    localStorage.removeItem(EDITOR_AUTOSAVE_DRAFT_KEY);
  });

  // ── Creation ─────────────────────────────────────────────────────────────

  describe('service creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should accept a TerrainGrid without error', () => {
      expect(() => service.setTerrainGrid(terrainGrid)).not.toThrow();
    });
  });

  // ── save() ────────────────────────────────────────────────────────────────

  describe('save()', () => {
    it('returns true and shows success notification on successful save', () => {
      mapStorage.saveMap.and.returnValue('map-id-1');
      mapStorage.getCurrentMapId.and.returnValue(null);

      const result = service.save('My Map');

      expect(result).toBe(true);
      expect(mapStorage.saveMap).toHaveBeenCalled();
      expect(editorState.setCurrentMapName).toHaveBeenCalledWith('My Map');
      expect(editorNotification.show).toHaveBeenCalledWith('Map "My Map" saved successfully!', 'success');
    });

    it('returns false and shows error when storage is full', () => {
      mapStorage.saveMap.and.returnValue(null);
      mapStorage.getCurrentMapId.and.returnValue(null);

      const result = service.save('My Map');

      expect(result).toBe(false);
      expect(editorNotification.show).toHaveBeenCalledWith(
        jasmine.stringContaining('Storage full'),
        'error'
      );
    });

    it('passes existing map ID for updates', () => {
      mapStorage.saveMap.and.returnValue('existing-id');
      mapStorage.getCurrentMapId.and.returnValue('existing-id');

      service.save('Updated Map');

      expect(mapStorage.saveMap).toHaveBeenCalledWith('Updated Map', jasmine.anything(), 'existing-id');
    });

    it('clears draft after successful save', () => {
      mapStorage.saveMap.and.returnValue('map-id-1');
      mapStorage.getCurrentMapId.and.returnValue(null);
      localStorage.setItem(EDITOR_AUTOSAVE_DRAFT_KEY, '{}');

      service.save('My Map');

      expect(localStorage.getItem(EDITOR_AUTOSAVE_DRAFT_KEY)).toBeNull();
    });
  });

  // ── loadById() ────────────────────────────────────────────────────────────

  describe('loadById()', () => {
    it('returns state on success and updates map name', () => {
      mapStorage.loadMap.and.returnValue(fakeState);
      mapStorage.getMapMetadata.and.returnValue({ id: 'id1', name: 'Test', createdAt: 0, updatedAt: 0, version: '2', gridSize: 25 });
      editorState.getCurrentMapName.and.returnValue('Test');

      const result = service.loadById('id1');

      expect(result).toBe(fakeState);
      expect(editorState.setCurrentMapName).toHaveBeenCalledWith('Test');
    });

    it('returns null and shows error when map not found', () => {
      mapStorage.loadMap.and.returnValue(null);

      const result = service.loadById('bad-id');

      expect(result).toBeNull();
      expect(editorNotification.show).toHaveBeenCalledWith('Failed to load map.', 'error');
    });
  });

  // ── loadCurrent() ─────────────────────────────────────────────────────────

  describe('loadCurrent()', () => {
    it('returns state when a current map exists', () => {
      mapStorage.loadCurrentMap.and.returnValue(fakeState);
      mapStorage.getCurrentMapId.and.returnValue('id1');
      mapStorage.getMapMetadata.and.returnValue({ id: 'id1', name: 'Current', createdAt: 0, updatedAt: 0, version: '2', gridSize: 25 });

      const result = service.loadCurrent();

      expect(result).toBe(fakeState);
      expect(editorState.setCurrentMapName).toHaveBeenCalledWith('Current');
    });

    it('returns null when no current map', () => {
      mapStorage.loadCurrentMap.and.returnValue(null);

      const result = service.loadCurrent();

      expect(result).toBeNull();
    });

    it('does not show a notification (silent init load)', () => {
      mapStorage.loadCurrentMap.and.returnValue(fakeState);
      mapStorage.getCurrentMapId.and.returnValue(null);

      service.loadCurrent();

      expect(editorNotification.show).not.toHaveBeenCalled();
    });
  });

  // ── getAllMaps() ───────────────────────────────────────────────────────────

  describe('getAllMaps()', () => {
    it('delegates to mapStorage.getAllMaps()', () => {
      const mockMaps = [{ id: '1', name: 'A', createdAt: 0, updatedAt: 0, version: '2', gridSize: 25 }];
      mapStorage.getAllMaps.and.returnValue(mockMaps);

      expect(service.getAllMaps()).toBe(mockMaps as any);
    });
  });

  // ── loadTemplate() ────────────────────────────────────────────────────────

  describe('loadTemplate()', () => {
    it('returns state when template is found', () => {
      mapTemplateService.loadTemplate.and.returnValue(fakeState);
      const template = { id: 'classic', name: 'Classic' } as any;

      const result = service.loadTemplate(template);

      expect(result).toBe(fakeState);
      expect(mapTemplateService.loadTemplate).toHaveBeenCalledWith('classic');
    });

    it('returns null when template is not found', () => {
      mapTemplateService.loadTemplate.and.returnValue(null);
      const template = { id: 'missing', name: 'Missing' } as any;

      const result = service.loadTemplate(template);

      expect(result).toBeNull();
    });
  });

  // ── exportAsJson() ────────────────────────────────────────────────────────

  describe('exportAsJson()', () => {
    it('shows error when no current map ID', () => {
      mapStorage.getCurrentMapId.and.returnValue(null);

      service.exportAsJson();

      expect(editorNotification.show).toHaveBeenCalledWith(
        jasmine.stringContaining('No map to export'),
        'error'
      );
    });

    it('calls downloadMapAsFile when ID exists', () => {
      mapStorage.getCurrentMapId.and.returnValue('id1');
      mapStorage.downloadMapAsFile.and.returnValue(true);

      service.exportAsJson();

      expect(mapStorage.downloadMapAsFile).toHaveBeenCalledWith('id1');
    });

    it('shows error when download fails', () => {
      mapStorage.getCurrentMapId.and.returnValue('id1');
      mapStorage.downloadMapAsFile.and.returnValue(false);

      service.exportAsJson();

      expect(editorNotification.show).toHaveBeenCalledWith('Failed to export map.', 'error');
    });
  });

  // ── importFromJson() ──────────────────────────────────────────────────────

  describe('importFromJson()', () => {
    it('returns state and shows success on successful import', async () => {
      mapStorage.promptFileImport.and.returnValue(Promise.resolve({ mapId: 'imported-id', errorCode: null }));
      mapStorage.loadMap.and.returnValue(fakeState);
      mapStorage.getMapMetadata.and.returnValue({ id: 'imported-id', name: 'Imported', createdAt: 0, updatedAt: 0, version: '2', gridSize: 25 });
      editorState.getCurrentMapName.and.returnValue('Imported');

      const result = await service.importFromJson(new File([], 'test.json'));

      expect(result).toBe(fakeState);
      expect(editorNotification.show).toHaveBeenCalledWith(
        jasmine.stringContaining('imported successfully'),
        'success'
      );
    });

    it('returns null and shows file_too_large error', async () => {
      mapStorage.promptFileImport.and.returnValue(Promise.resolve({ mapId: null, errorCode: 'file_too_large' }));

      const result = await service.importFromJson(new File([], 'big.json'));

      expect(result).toBeNull();
      expect(editorNotification.show).toHaveBeenCalledWith(
        jasmine.stringContaining('too large'),
        'error'
      );
    });

    it('returns null and shows invalid_json error', async () => {
      mapStorage.promptFileImport.and.returnValue(Promise.resolve({ mapId: null, errorCode: 'invalid_json' }));

      const result = await service.importFromJson(new File([], 'bad.json'));

      expect(result).toBeNull();
      expect(editorNotification.show).toHaveBeenCalledWith(
        jasmine.stringContaining('corrupted'),
        'error'
      );
    });

    it('returns null and shows general error for unknown code', async () => {
      mapStorage.promptFileImport.and.returnValue(Promise.resolve({ mapId: null, errorCode: 'general' }));

      const result = await service.importFromJson(new File([], 'err.json'));

      expect(result).toBeNull();
      expect(editorNotification.show).toHaveBeenCalledWith(
        jasmine.stringContaining('Failed to import'),
        'error'
      );
    });

    it('returns null when no mapId and no errorCode', async () => {
      mapStorage.promptFileImport.and.returnValue(Promise.resolve({ mapId: null, errorCode: null }));

      const result = await service.importFromJson(new File([], 'empty.json'));

      expect(result).toBeNull();
      expect(editorNotification.show).not.toHaveBeenCalled();
    });
  });

  // ── draft (saveDraft / loadDraft / clearDraft) ────────────────────────────

  describe('draft management', () => {
    it('saveDraft() writes state to localStorage', () => {
      service.saveDraft();
      const raw = localStorage.getItem(EDITOR_AUTOSAVE_DRAFT_KEY);
      expect(raw).not.toBeNull();
    });

    it('loadDraft() returns parsed state after saveDraft()', () => {
      service.saveDraft();
      const draft = service.loadDraft();
      expect(draft).not.toBeNull();
    });

    it('loadDraft() returns null when no draft exists', () => {
      localStorage.removeItem(EDITOR_AUTOSAVE_DRAFT_KEY);
      expect(service.loadDraft()).toBeNull();
    });

    it('loadDraft() returns null for malformed JSON', () => {
      localStorage.setItem(EDITOR_AUTOSAVE_DRAFT_KEY, 'not-valid-json{{{');
      expect(service.loadDraft()).toBeNull();
    });

    it('clearDraft() removes draft from localStorage', () => {
      service.saveDraft();
      service.clearDraft();
      expect(localStorage.getItem(EDITOR_AUTOSAVE_DRAFT_KEY)).toBeNull();
    });

    it('saveDraft() does not throw on quota exceeded', () => {
      spyOn(localStorage, 'setItem').and.throwError('QuotaExceededError');
      expect(() => service.saveDraft()).not.toThrow();
    });
  });

  // ── autosave lifecycle ────────────────────────────────────────────────────

  describe('startAutosave() / stopAutosave()', () => {
    it('startAutosave() does not create duplicate timers on multiple calls', () => {
      const setSpy = spyOn(window, 'setInterval').and.callThrough();
      service.startAutosave();
      service.startAutosave(); // second call should be ignored
      expect(setSpy).toHaveBeenCalledTimes(1);
    });

    it('stopAutosave() clears the interval', () => {
      const clearSpy = spyOn(window, 'clearInterval').and.callThrough();
      service.startAutosave();
      service.stopAutosave();
      expect(clearSpy).toHaveBeenCalled();
    });

    it('stopAutosave() is safe to call when not started', () => {
      expect(() => service.stopAutosave()).not.toThrow();
    });
  });
});
