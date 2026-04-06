import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NovariseComponent } from './novarise.component';
import { MapStorageService } from '../../core/services/map-storage.service';
import { PathValidationService } from './core/path-validation.service';
import { CameraControlService } from './core/camera-control.service';
import { EditorStateService } from './core/editor-state.service';
import { EditHistoryService } from './core/edit-history.service';
import { EditorSceneService } from './core/editor-scene.service';
import { EditorNotificationService } from './core/editor-notification.service';
import { TerrainEditService } from './core/terrain-edit.service';
import { MapFileService } from './core/map-file.service';
import { BrushPreviewService } from './core/brush-preview.service';
import { SpawnExitMarkerService } from './core/spawn-exit-marker.service';
import { RectangleToolService } from './core/rectangle-tool.service';
import { EditorModalService } from './core/editor-modal.service';
import { EditorKeyboardService } from './core/editor-keyboard.service';
import { TerrainGridState } from './features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from './models/terrain-types.enum';
import * as THREE from 'three';

/**
 * Typed access to private members needed for test setup/assertion.
 * Avoids `as any` casts while accessing private component internals.
 */
interface TestableNovarise {
  terrainGrid: {
    getSpawnPoint(): { x: number; z: number } | null;
    getExitPoint(): { x: number; z: number } | null;
    getSpawnPoints(): { x: number; z: number }[];
    getExitPoints(): { x: number; z: number }[];
    exportState(): TerrainGridState;
    dispose(): void;
  } | null;
  pathValidationResult: { valid: boolean };
  editorKeyboard: EditorKeyboardService;
}

function makeEditorSceneSpy(): jasmine.SpyObj<EditorSceneService> {
  const spy = jasmine.createSpyObj<EditorSceneService>('EditorSceneService', [
    'initScene', 'initCamera', 'initLights', 'initSkybox', 'initParticles',
    'initRenderer', 'initPostProcessing', 'initControls',
    'getScene', 'getCamera', 'getRenderer', 'getComposer',
    'getControls', 'getParticles', 'getSkybox',
    'render', 'resize', 'dispose', 'disposeParticles', 'disposeSkybox',
  ]);
  spy.getRenderer.and.returnValue({ domElement: document.createElement('canvas'), dispose: () => {} } as unknown as THREE.WebGLRenderer);
  spy.getScene.and.returnValue({ add: () => {}, remove: () => {} } as unknown as THREE.Scene);
  spy.getCamera.and.returnValue({} as unknown as THREE.PerspectiveCamera);
  spy.getControls.and.returnValue(undefined as unknown as ReturnType<EditorSceneService['getControls']>);
  spy.getParticles.and.returnValue(null);
  return spy;
}

/** Build a fully-walkable NxN tile grid (all BEDROCK). */
function buildBedrockTiles(gridSize: number): TerrainType[][] {
  return Array.from({ length: gridSize }, () =>
    Array(gridSize).fill(TerrainType.BEDROCK)
  );
}

/**
 * Minimal mock that satisfies ngOnDestroy's terrainGrid access.
 * Uses a small 6x6 all-BEDROCK grid so path validation succeeds
 * when both spawn and exit are set.
 */
function mockTerrainGrid(
  spawn: { x: number; z: number } | null,
  exit: { x: number; z: number } | null,
  gridSize = 6
): TestableNovarise['terrainGrid'] {
  const tiles = buildBedrockTiles(gridSize);
  const heightMap = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
  return {
    getSpawnPoint: () => spawn,
    getExitPoint: () => exit,
    getSpawnPoints: () => spawn ? [spawn] : [],
    getExitPoints: () => exit ? [exit] : [],
    exportState: () => ({
      gridSize,
      tiles,
      heightMap,
      spawnPoints: spawn ? [spawn] : [],
      exitPoints: exit ? [exit] : [],
      version: '2.0.0'
    } as TerrainGridState),
    dispose: () => {}
  };
}

/**
 * Isolated tests for navigation and keyboard guard logic.
 * Separated from novarise.component.spec.ts to avoid Three.js cleanup
 * errors in headless Chrome that cascade across test suites.
 */
describe('NovariseComponent Navigation', () => {
  let component: NovariseComponent;
  let testable: TestableNovarise;
  let router: Router;
  let mockMapStorageService: jasmine.SpyObj<MapStorageService>;

  beforeEach(async () => {
    mockMapStorageService = jasmine.createSpyObj('MapStorageService', [
      'migrateOldFormat',
      'loadCurrentMap',
      'getCurrentMapId',
      'getMapMetadata',
      'saveMap',
      'loadMap',
      'getAllMaps'
    ]);
    mockMapStorageService.loadCurrentMap.and.returnValue(null);
    mockMapStorageService.getCurrentMapId.and.returnValue(null);
    mockMapStorageService.getMapMetadata.and.returnValue(null);
    mockMapStorageService.getAllMaps.and.returnValue([]);

    await TestBed.configureTestingModule({
      declarations: [NovariseComponent],
      imports: [RouterTestingModule],
      providers: [
        { provide: MapStorageService, useValue: mockMapStorageService },
        { provide: EditorSceneService, useValue: makeEditorSceneSpy() },
        PathValidationService,
        CameraControlService,
        EditorStateService,
        EditHistoryService,
        EditorNotificationService,
        TerrainEditService,
        MapFileService,
        BrushPreviewService,
        SpawnExitMarkerService,
        RectangleToolService,
        EditorModalService,
        EditorKeyboardService,
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  beforeEach(() => {
    const fixture = TestBed.createComponent(NovariseComponent);
    component = fixture.componentInstance;
    testable = component as unknown as TestableNovarise;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
  });

  describe('canPlayMap', () => {
    it('should return false when terrainGrid is null', () => {
      testable.terrainGrid = null;
      expect(component.canPlayMap).toBe(false);
    });

    it('should return false when spawn point is missing', () => {
      testable.terrainGrid = mockTerrainGrid(null, { x: 5, z: 5 });
      expect(component.canPlayMap).toBe(false);
    });

    it('should return false when exit point is missing', () => {
      testable.terrainGrid = mockTerrainGrid({ x: 0, z: 0 }, null);
      expect(component.canPlayMap).toBe(false);
    });

    it('should return true when both spawn and exit are set and path is valid', () => {
      testable.terrainGrid = mockTerrainGrid({ x: 0, z: 0 }, { x: 5, z: 5 });
      // Simulate path validation having run and found a valid path
      testable.pathValidationResult = { valid: true };
      expect(component.canPlayMap).toBe(true);
    });

    it('should return false when both spawn and exit are set but path is invalid', () => {
      testable.terrainGrid = mockTerrainGrid({ x: 0, z: 0 }, { x: 5, z: 5 });
      testable.pathValidationResult = { valid: false };
      expect(component.canPlayMap).toBe(false);
    });
  });

  describe('playMap', () => {
    it('should navigate to /play when map has spawn, exit, and valid path', () => {
      testable.terrainGrid = mockTerrainGrid({ x: 0, z: 0 }, { x: 5, z: 5 });
      testable.pathValidationResult = { valid: true };
      component.playMap();
      expect(router.navigate).toHaveBeenCalledWith(['/play']);
    });

    it('should not navigate when spawn or exit is missing', () => {
      testable.terrainGrid = mockTerrainGrid(null, null);
      component.playMap();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should not navigate when path is invalid even with spawn and exit set', () => {
      testable.terrainGrid = mockTerrainGrid({ x: 0, z: 0 }, { x: 5, z: 5 });
      testable.pathValidationResult = { valid: false };
      component.playMap();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Guard', () => {
    let editorKeyboard: EditorKeyboardService;

    beforeEach(() => {
      editorKeyboard = testable.editorKeyboard;
      // Setup the keyboard service with no-op callbacks so hotkeys are processed
      editorKeyboard.setup({
        undo: () => {}, redo: () => {},
        exportMap: () => {}, importMap: () => {},
        saveGrid: () => {}, loadGrid: () => {},
        cycleBrushSize: () => {}, changeActiveTool: () => {},
        playMap: () => {}, setEditMode: () => {}, setTerrainType: () => {}
      });
    });

    afterEach(() => {
      editorKeyboard.teardown();
    });

    it('should not add key to keysPressed when target is an input element', () => {
      const input = document.createElement('input');
      const event = new KeyboardEvent('keydown', { key: 'w' });
      Object.defineProperty(event, 'target', { value: input });

      window.dispatchEvent(event);

      expect(editorKeyboard.getKeysPressed().has('w')).toBe(false);
    });

    it('should not add key to keysPressed when target is a textarea', () => {
      const textarea = document.createElement('textarea');
      const event = new KeyboardEvent('keydown', { key: 'a' });
      Object.defineProperty(event, 'target', { value: textarea });

      window.dispatchEvent(event);

      expect(editorKeyboard.getKeysPressed().has('a')).toBe(false);
    });

    it('should add key to keysPressed when target is a regular element', () => {
      const div = document.createElement('div');
      const event = new KeyboardEvent('keydown', { key: 'w' });
      Object.defineProperty(event, 'target', { value: div });

      window.dispatchEvent(event);

      expect(editorKeyboard.getKeysPressed().has('w')).toBe(true);
    });
  });
});
