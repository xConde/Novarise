import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NovariseComponent } from './novarise.component';
import { MapStorageService } from './core/map-storage.service';
import { TerrainGridState } from './features/terrain-editor/terrain-grid-state.interface';

/**
 * Typed access to private members needed for test setup/assertion.
 * Avoids `as any` casts while accessing private component internals.
 */
interface TestableNovarise {
  terrainGrid: {
    getSpawnPoint(): { x: number; z: number } | null;
    getExitPoint(): { x: number; z: number } | null;
    exportState(): TerrainGridState;
    dispose(): void;
  } | null;
  renderer: { domElement: HTMLElement; dispose(): void };
  scene: { remove(): void };
  keysPressed: Set<string>;
  handleKeyDown(event: KeyboardEvent): void;
}

/**
 * Minimal mock that satisfies ngOnDestroy's terrainGrid access.
 */
function mockTerrainGrid(
  spawn: { x: number; z: number } | null,
  exit: { x: number; z: number } | null
): TestableNovarise['terrainGrid'] {
  return {
    getSpawnPoint: () => spawn,
    getExitPoint: () => exit,
    exportState: () => ({
      gridSize: 25,
      tiles: [],
      heightMap: [],
      spawnPoint: spawn,
      exitPoint: exit,
      version: '1.0.0'
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
        { provide: MapStorageService, useValue: mockMapStorageService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  beforeEach(() => {
    const fixture = TestBed.createComponent(NovariseComponent);
    component = fixture.componentInstance;
    testable = component as unknown as TestableNovarise;

    // Mock Three.js objects that ngOnDestroy accesses during cleanup.
    // These are normally created in ngAfterViewInit which never runs in headless tests.
    testable.renderer = { domElement: document.createElement('canvas'), dispose: () => {} };
    testable.scene = { remove: () => {} };

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

    it('should return true when both spawn and exit are set', () => {
      testable.terrainGrid = mockTerrainGrid({ x: 0, z: 0 }, { x: 5, z: 5 });
      expect(component.canPlayMap).toBe(true);
    });
  });

  describe('playMap', () => {
    it('should navigate to /play when map has spawn and exit', () => {
      testable.terrainGrid = mockTerrainGrid({ x: 0, z: 0 }, { x: 5, z: 5 });
      component.playMap();
      expect(router.navigate).toHaveBeenCalledWith(['/play']);
    });

    it('should not navigate when spawn or exit is missing', () => {
      testable.terrainGrid = mockTerrainGrid(null, null);
      component.playMap();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Guard', () => {
    beforeEach(() => {
      testable.keysPressed = new Set<string>();
    });

    it('should not add key to keysPressed when target is an input element', () => {
      const input = document.createElement('input');
      const event = new KeyboardEvent('keydown', { key: 'w' });
      Object.defineProperty(event, 'target', { value: input });

      testable.handleKeyDown(event);

      expect(testable.keysPressed.has('w')).toBe(false);
    });

    it('should not add key to keysPressed when target is a textarea', () => {
      const textarea = document.createElement('textarea');
      const event = new KeyboardEvent('keydown', { key: 'a' });
      Object.defineProperty(event, 'target', { value: textarea });

      testable.handleKeyDown(event);

      expect(testable.keysPressed.has('a')).toBe(false);
    });

    it('should add key to keysPressed when target is a regular element', () => {
      const div = document.createElement('div');
      const event = new KeyboardEvent('keydown', { key: 'w' });
      Object.defineProperty(event, 'target', { value: div });

      testable.handleKeyDown(event);

      expect(testable.keysPressed.has('w')).toBe(true);
    });
  });
});
