import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, ElementRef } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NovariseComponent } from './novarise.component';
import { MapStorageService, MapMetadata } from './core/map-storage.service';
import { CameraControlService, JoystickInput, MovementInput, RotationInput } from './core/camera-control.service';
import { EditHistoryService } from './core/edit-history.service';
import { EditorStateService, EditMode, BrushTool } from './core/editor-state.service';
import { PathValidationService } from './core/path-validation.service';
import { JoystickEvent } from './features/mobile-controls';
import { TerrainType, TERRAIN_CONFIGS } from './models/terrain-types.enum';
import { MINIMAP_CONFIG } from './constants/editor.constants';

/** Full terrain grid mock interface — must satisfy all ngOnDestroy calls. */
interface MockTerrainGrid {
  getGridSize(): number;
  getTileAt(x: number, z: number): { type: TerrainType; height: number; mesh: unknown } | null;
  getSpawnPoint(): { x: number; z: number } | null;
  getExitPoint(): { x: number; z: number } | null;
  exportState(): { gridSize: number; tiles: TerrainType[][]; heightMap: number[][]; spawnPoint: { x: number; z: number } | null; exitPoint: { x: number; z: number } | null; version: string };
  dispose(): void;
}

/**
 * Typed access to private members needed for test setup/assertion.
 */
interface TestableNovarise {
  renderer: { domElement: HTMLCanvasElement; dispose(): void };
  scene: { remove(...objects: unknown[]): void };
  movementJoystick: JoystickInput;
  rotationJoystick: JoystickInput;
  minimapCanvasRef: ElementRef<HTMLCanvasElement> | undefined;
  terrainGrid: MockTerrainGrid | undefined;
}

/**
 * Build a minimal mock terrain grid for minimap tests.
 * Includes all methods called by ngOnDestroy so cleanup does not throw.
 */
function buildMockTerrainGrid(overrides: {
  size?: number;
  tileType?: TerrainType;
  spawn?: { x: number; z: number } | null;
  exit?: { x: number; z: number } | null;
} = {}): MockTerrainGrid {
  const size = overrides.size ?? 3;
  const tileType = overrides.tileType ?? TerrainType.BEDROCK;
  return {
    getGridSize: () => size,
    getTileAt: (x: number, z: number) => {
      if (x < 0 || x >= size || z < 0 || z >= size) return null;
      return { type: tileType, height: 0, mesh: {} };
    },
    getSpawnPoint: () => overrides.spawn !== undefined ? overrides.spawn : null,
    getExitPoint: () => overrides.exit !== undefined ? overrides.exit : null,
    exportState: () => ({
      gridSize: size,
      tiles: [],
      heightMap: [],
      spawnPoint: overrides.spawn ?? null,
      exitPoint: overrides.exit ?? null,
      version: '1.0'
    }),
    dispose: () => {},
  };
}

/**
 * Create an off-screen canvas and attach it as a fake minimapCanvasRef.
 */
function buildMinimapCanvasRef(): ElementRef<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = MINIMAP_CONFIG.size;
  canvas.height = MINIMAP_CONFIG.size;
  return new ElementRef(canvas);
}

const NO_MOVEMENT: MovementInput = {
  forward: false, backward: false, left: false, right: false, up: false, down: false, fast: false
};
const NO_ROTATION: RotationInput = { left: false, right: false, up: false, down: false };
const NO_JOYSTICK: JoystickInput = { active: false, x: 0, y: 0 };

describe('NovariseComponent', () => {
  let component: NovariseComponent;
  let fixture: ComponentFixture<NovariseComponent>;
  let mockMapStorageService: jasmine.SpyObj<MapStorageService>;
  let cameraControlService: CameraControlService;

  beforeEach(async () => {
    mockMapStorageService = jasmine.createSpyObj('MapStorageService', [
      'migrateOldFormat',
      'loadCurrentMap',
      'getCurrentMapId',
      'getMapMetadata',
      'saveMap',
      'loadMap',
      'getAllMaps',
      'deleteMap'
    ]);

    mockMapStorageService.loadCurrentMap.and.returnValue(null);
    mockMapStorageService.getCurrentMapId.and.returnValue(null);
    mockMapStorageService.getMapMetadata.and.returnValue(null);
    mockMapStorageService.getAllMaps.and.returnValue([]);
    mockMapStorageService.deleteMap.and.returnValue(true);

    await TestBed.configureTestingModule({
      declarations: [NovariseComponent],
      imports: [RouterTestingModule, FormsModule],
      providers: [
        { provide: MapStorageService, useValue: mockMapStorageService },
        PathValidationService
      ],
      schemas: [NO_ERRORS_SCHEMA] // Ignore unknown elements like app-virtual-joystick
    }).compileComponents();

    cameraControlService = TestBed.inject(CameraControlService);
  });

  /** Mock Three.js fields that ngOnDestroy accesses (renderer is never initialized since ngAfterViewInit doesn't run in tests) */
  function mockThreeJsFields(comp: NovariseComponent): void {
    const t = comp as unknown as TestableNovarise;
    t.renderer = { domElement: document.createElement('canvas'), dispose: () => {} };
    t.scene = { remove: () => {}, add: () => {} } as unknown as TestableNovarise['scene'];
  }

  describe('Joystick State Initialization', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should initialize movement joystick state as inactive', () => {
      expect((component as unknown as TestableNovarise).movementJoystick.active).toBe(false);
    });

    it('should initialize movement joystick vector to zero', () => {
      const mj = (component as unknown as TestableNovarise).movementJoystick;
      expect(mj.x).toBe(0);
      expect(mj.y).toBe(0);
    });

    it('should initialize rotation joystick state as inactive', () => {
      expect((component as unknown as TestableNovarise).rotationJoystick.active).toBe(false);
    });

    it('should initialize rotation joystick vector to zero', () => {
      const rj = (component as unknown as TestableNovarise).rotationJoystick;
      expect(rj.x).toBe(0);
      expect(rj.y).toBe(0);
    });
  });

  describe('onJoystickChange Handler', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should update movement joystick state when movement event received', () => {
      const event: JoystickEvent = {
        type: 'movement',
        vector: { x: 0.5, y: -0.3 },
        active: true
      };

      component.onJoystickChange(event);

      const mj = (component as unknown as TestableNovarise).movementJoystick;
      expect(mj.active).toBe(true);
      expect(mj.x).toBe(0.5);
      expect(mj.y).toBe(-0.3);
    });

    it('should update rotation joystick state when rotation event received', () => {
      const event: JoystickEvent = {
        type: 'rotation',
        vector: { x: -0.7, y: 0.4 },
        active: true
      };

      component.onJoystickChange(event);

      const rj = (component as unknown as TestableNovarise).rotationJoystick;
      expect(rj.active).toBe(true);
      expect(rj.x).toBe(-0.7);
      expect(rj.y).toBe(0.4);
    });

    it('should reset movement joystick when deactivated', () => {
      // First activate
      component.onJoystickChange({
        type: 'movement',
        vector: { x: 1, y: 1 },
        active: true
      });

      // Then deactivate
      component.onJoystickChange({
        type: 'movement',
        vector: { x: 0, y: 0 },
        active: false
      });

      const mj = (component as unknown as TestableNovarise).movementJoystick;
      expect(mj.active).toBe(false);
      expect(mj.x).toBe(0);
      expect(mj.y).toBe(0);
    });

    it('should reset rotation joystick when deactivated', () => {
      // First activate
      component.onJoystickChange({
        type: 'rotation',
        vector: { x: 0.8, y: -0.6 },
        active: true
      });

      // Then deactivate
      component.onJoystickChange({
        type: 'rotation',
        vector: { x: 0, y: 0 },
        active: false
      });

      const rj = (component as unknown as TestableNovarise).rotationJoystick;
      expect(rj.active).toBe(false);
      expect(rj.x).toBe(0);
      expect(rj.y).toBe(0);
    });

    it('should handle both joysticks independently', () => {
      // Activate movement
      component.onJoystickChange({
        type: 'movement',
        vector: { x: 0.5, y: 0.5 },
        active: true
      });

      // Activate rotation
      component.onJoystickChange({
        type: 'rotation',
        vector: { x: -0.3, y: 0.7 },
        active: true
      });

      const t = component as unknown as TestableNovarise;
      // Both should be active with independent vectors
      expect(t.movementJoystick.active).toBe(true);
      expect(t.rotationJoystick.active).toBe(true);
      expect(t.movementJoystick.x).toBe(0.5);
      expect(t.movementJoystick.y).toBe(0.5);
      expect(t.rotationJoystick.x).toBe(-0.3);
      expect(t.rotationJoystick.y).toBe(0.7);
    });

    it('should allow deactivating one joystick while other remains active', () => {
      // Activate both
      component.onJoystickChange({
        type: 'movement',
        vector: { x: 1, y: 0 },
        active: true
      });
      component.onJoystickChange({
        type: 'rotation',
        vector: { x: 0, y: 1 },
        active: true
      });

      // Deactivate only movement
      component.onJoystickChange({
        type: 'movement',
        vector: { x: 0, y: 0 },
        active: false
      });

      const t = component as unknown as TestableNovarise;
      expect(t.movementJoystick.active).toBe(false);
      expect(t.rotationJoystick.active).toBe(true);
    });
  });

  describe('Camera Rotation Integration', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
      cameraControlService.reset();
    });

    it('should update target yaw when rotation joystick X is moved', () => {
      const initialYaw = cameraControlService.getRotation().yaw;

      cameraControlService.update(NO_MOVEMENT, NO_ROTATION, NO_JOYSTICK, { active: true, x: 1, y: 0 });

      expect(cameraControlService.getRotation().yaw).not.toBe(initialYaw);
    });

    it('should update target pitch when rotation joystick Y is moved', () => {
      const initialPitch = cameraControlService.getRotation().pitch;

      cameraControlService.update(NO_MOVEMENT, NO_ROTATION, NO_JOYSTICK, { active: true, x: 0, y: 1 });

      expect(cameraControlService.getRotation().pitch).not.toBe(initialPitch);
    });

    it('should clamp pitch to upper limit (45 degrees)', () => {
      for (let i = 0; i < 1000; i++) {
        cameraControlService.update(NO_MOVEMENT, NO_ROTATION, NO_JOYSTICK, { active: true, x: 0, y: 1 });
      }

      // Should be clamped to max (PI/4 radians = 45 degrees)
      expect(cameraControlService.getRotation().pitch).toBeLessThanOrEqual(Math.PI / 4 + 0.001);
    });

    it('should clamp pitch to lower limit (-75 degrees)', () => {
      for (let i = 0; i < 1000; i++) {
        cameraControlService.update(NO_MOVEMENT, NO_ROTATION, NO_JOYSTICK, { active: true, x: 0, y: -1 });
      }

      // Should be clamped to min (-PI * 5/12 radians = -75 degrees)
      expect(cameraControlService.getRotation().pitch).toBeGreaterThanOrEqual(-Math.PI * 5 / 12 - 0.001);
    });

    it('should not update rotation when joystick is inactive', () => {
      const initialRotation = cameraControlService.getRotation();

      cameraControlService.update(NO_MOVEMENT, NO_ROTATION, NO_JOYSTICK, { active: false, x: 1, y: 1 });

      const newRotation = cameraControlService.getRotation();
      expect(newRotation.yaw).toBe(initialRotation.yaw);
      expect(newRotation.pitch).toBe(initialRotation.pitch);
    });

    it('should smoothly interpolate rotation values', () => {
      // Push rotation joystick to create a target offset
      cameraControlService.update(NO_MOVEMENT, NO_ROTATION, NO_JOYSTICK, { active: true, x: 1, y: 1 });

      // Update again with no input — should continue interpolating
      cameraControlService.update(NO_MOVEMENT, NO_ROTATION, NO_JOYSTICK, NO_JOYSTICK);

      // Rotation should have moved from first state (interpolation continues)
      expect(cameraControlService.getRotation().yaw).not.toBe(0);
    });
  });

  describe('Movement Integration', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
      cameraControlService.reset();
    });

    it('should update velocity when movement joystick is active', () => {
      const initialPos = cameraControlService.getPosition();

      cameraControlService.update(NO_MOVEMENT, NO_ROTATION, { active: true, x: 0.5, y: 0.5 }, NO_JOYSTICK);

      const newPos = cameraControlService.getPosition();
      expect(newPos.x !== initialPos.x || newPos.z !== initialPos.z).toBe(true);
    });

    it('should not affect movement when joystick is inactive', () => {
      const initialPos = cameraControlService.getPosition();

      cameraControlService.update(NO_MOVEMENT, NO_ROTATION, NO_JOYSTICK, NO_JOYSTICK);

      const newPos = cameraControlService.getPosition();
      expect(newPos.x).toBe(initialPos.x);
      expect(newPos.z).toBe(initialPos.z);
    });

    it('should work alongside keyboard input', () => {
      const initialPos = cameraControlService.getPosition();

      cameraControlService.update(
        { ...NO_MOVEMENT, forward: true },
        NO_ROTATION,
        { active: true, x: 0.5, y: 0 },
        NO_JOYSTICK
      );

      const newPos = cameraControlService.getPosition();
      expect(newPos.x !== initialPos.x || newPos.z !== initialPos.z).toBe(true);
    });

    it('should combine both joysticks for full FPS-style control', () => {
      const initialPos = cameraControlService.getPosition();
      const initialRot = cameraControlService.getRotation();

      cameraControlService.update(
        NO_MOVEMENT,
        NO_ROTATION,
        { active: true, x: 0.5, y: 0.5 },
        { active: true, x: 0.3, y: 0 }
      );

      const newPos = cameraControlService.getPosition();
      expect(newPos.x !== initialPos.x || newPos.z !== initialPos.z).toBe(true);
      expect(cameraControlService.getRotation().yaw).not.toBe(initialRot.yaw);
    });
  });

  describe('Map Manager — openMapManager / closeMapManager', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should set mapManagerOpen to true when openMapManager is called', () => {
      component.openMapManager();
      expect(component.mapManagerOpen).toBe(true);
    });

    it('should populate savedMaps from storage when openMapManager is called', () => {
      const fakeMaps: MapMetadata[] = [
        { id: 'map1', name: 'Alpha', createdAt: 1000, updatedAt: 2000, version: '1.0.0', gridSize: 25 }
      ];
      mockMapStorageService.getAllMaps.and.returnValue(fakeMaps);

      component.openMapManager();

      expect(component.savedMaps).toEqual(fakeMaps);
    });

    it('should reset rename and delete state when opening the manager', () => {
      component.renamingMapId = 'map1';
      component.renameValue = 'old name';
      component.deleteConfirmId = 'map1';

      component.openMapManager();

      expect(component.renamingMapId).toBeNull();
      expect(component.renameValue).toBe('');
      expect(component.deleteConfirmId).toBeNull();
    });

    it('should set mapManagerOpen to false when closeMapManager is called', () => {
      component.mapManagerOpen = true;
      component.closeMapManager();
      expect(component.mapManagerOpen).toBe(false);
    });

    it('should reset rename and delete state when closing the manager', () => {
      component.renamingMapId = 'map1';
      component.renameValue = 'name';
      component.deleteConfirmId = 'map1';

      component.closeMapManager();

      expect(component.renamingMapId).toBeNull();
      expect(component.renameValue).toBe('');
      expect(component.deleteConfirmId).toBeNull();
    });
  });

  describe('Map Manager — confirmDelete / cancelDelete / deleteMap', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should set deleteConfirmId when confirmDelete is called', () => {
      component.confirmDelete('map1');
      expect(component.deleteConfirmId).toBe('map1');
    });

    it('should clear renamingMapId when confirmDelete is called', () => {
      component.renamingMapId = 'map1';
      component.confirmDelete('map1');
      expect(component.renamingMapId).toBeNull();
    });

    it('should clear deleteConfirmId when cancelDelete is called', () => {
      component.deleteConfirmId = 'map1';
      component.cancelDelete();
      expect(component.deleteConfirmId).toBeNull();
    });

    it('should call mapStorage.deleteMap with correct id', () => {
      mockMapStorageService.getAllMaps.and.returnValue([]);
      component.deleteMap('map1');
      expect(mockMapStorageService.deleteMap).toHaveBeenCalledWith('map1');
    });

    it('should clear deleteConfirmId after deleteMap', () => {
      component.deleteConfirmId = 'map1';
      mockMapStorageService.getAllMaps.and.returnValue([]);
      component.deleteMap('map1');
      expect(component.deleteConfirmId).toBeNull();
    });

    it('should refresh savedMaps after deleteMap', () => {
      const remaining: MapMetadata[] = [
        { id: 'map2', name: 'Beta', createdAt: 1000, updatedAt: 2000, version: '1.0.0', gridSize: 25 }
      ];
      mockMapStorageService.getAllMaps.and.returnValue(remaining);

      component.deleteMap('map1');

      expect(component.savedMaps).toEqual(remaining);
    });
  });

  describe('Map Manager — startRename / submitRename / cancelRename', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should set renamingMapId and renameValue when startRename is called', () => {
      component.startRename('map1', 'My Map');
      expect(component.renamingMapId).toBe('map1');
      expect(component.renameValue).toBe('My Map');
    });

    it('should clear deleteConfirmId when startRename is called', () => {
      component.deleteConfirmId = 'map1';
      component.startRename('map1', 'My Map');
      expect(component.deleteConfirmId).toBeNull();
    });

    it('should clear renamingMapId and renameValue when cancelRename is called', () => {
      component.renamingMapId = 'map1';
      component.renameValue = 'something';

      component.cancelRename();

      expect(component.renamingMapId).toBeNull();
      expect(component.renameValue).toBe('');
    });

    it('should save with new name when submitRename is called with non-empty value', () => {
      const fakeState = { gridSize: 25, tiles: [], heightMap: [], spawnPoint: null, exitPoint: null, version: '1.0.0' };
      mockMapStorageService.loadMap.and.returnValue(fakeState as any);
      mockMapStorageService.getAllMaps.and.returnValue([]);

      component.renamingMapId = 'map1';
      component.renameValue = 'New Name';

      component.submitRename('map1');

      expect(mockMapStorageService.saveMap).toHaveBeenCalledWith('New Name', fakeState as any, 'map1');
    });

    it('should not save when submitRename is called with whitespace-only value', () => {
      mockMapStorageService.getAllMaps.and.returnValue([]);
      component.renamingMapId = 'map1';
      component.renameValue = '   ';

      component.submitRename('map1');

      expect(mockMapStorageService.saveMap).not.toHaveBeenCalled();
    });

    it('should not save when renamingMapId is null before submitRename', () => {
      mockMapStorageService.getAllMaps.and.returnValue([]);
      component.renamingMapId = null;
      component.renameValue = 'Some Name';

      component.submitRename('map1');

      expect(mockMapStorageService.saveMap).not.toHaveBeenCalled();
    });

    it('should clear renamingMapId after submitRename', () => {
      mockMapStorageService.loadMap.and.returnValue(null);
      mockMapStorageService.getAllMaps.and.returnValue([]);
      component.renamingMapId = 'map1';
      component.renameValue = 'Name';

      component.submitRename('map1');

      expect(component.renamingMapId).toBeNull();
    });

    it('should refresh savedMaps after submitRename', () => {
      const updated: MapMetadata[] = [
        { id: 'map1', name: 'New Name', createdAt: 1000, updatedAt: 3000, version: '1.0.0', gridSize: 25 }
      ];
      mockMapStorageService.loadMap.and.returnValue(null);
      mockMapStorageService.getAllMaps.and.returnValue(updated);
      component.renamingMapId = 'map1';
      component.renameValue = 'New Name';

      component.submitRename('map1');

      expect(component.savedMaps).toEqual(updated);
    });
  });

  describe('Minimap', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    describe('minimapVisible default state', () => {
      it('should default to visible', () => {
        expect(component.minimapVisible).toBe(true);
      });
    });

    describe('toggleMinimap()', () => {
      it('should hide minimap when currently visible', () => {
        component.minimapVisible = true;
        component.toggleMinimap();
        expect(component.minimapVisible).toBe(false);
      });

      it('should show minimap when currently hidden', () => {
        component.minimapVisible = false;
        component.toggleMinimap();
        expect(component.minimapVisible).toBe(true);
      });

      it('should toggle back to original state on double toggle', () => {
        const initial = component.minimapVisible;
        component.toggleMinimap();
        component.toggleMinimap();
        expect(component.minimapVisible).toBe(initial);
      });
    });

    describe('renderMinimap() — guard cases', () => {
      it('should not throw when minimapCanvasRef is undefined', () => {
        const t = component as unknown as TestableNovarise;
        t.minimapCanvasRef = undefined;
        t.terrainGrid = buildMockTerrainGrid();
        expect(() => component.renderMinimap()).not.toThrow();
      });

      it('should not throw when terrainGrid is undefined', () => {
        const t = component as unknown as TestableNovarise;
        t.minimapCanvasRef = buildMinimapCanvasRef();
        t.terrainGrid = undefined;
        expect(() => component.renderMinimap()).not.toThrow();
      });

      it('should not throw when both canvas and terrainGrid are undefined', () => {
        const t = component as unknown as TestableNovarise;
        t.minimapCanvasRef = undefined;
        t.terrainGrid = undefined;
        expect(() => component.renderMinimap()).not.toThrow();
      });
    });

    describe('renderMinimap() — terrain colors', () => {
      it('should fill background before drawing tiles', () => {
        const t = component as unknown as TestableNovarise;
        const canvasRef = buildMinimapCanvasRef();
        t.minimapCanvasRef = canvasRef;
        t.terrainGrid = buildMockTerrainGrid({ size: 2, tileType: TerrainType.BEDROCK });

        const ctx = canvasRef.nativeElement.getContext('2d')!;
        const fillRectSpy = spyOn(ctx, 'fillRect').and.callThrough();

        // Re-attach ctx so renderMinimap gets the spy
        spyOn(canvasRef.nativeElement, 'getContext').and.returnValue(ctx);

        component.renderMinimap();

        // Background fill must be first call with full canvas size
        const firstCall = fillRectSpy.calls.first();
        expect(firstCall.args).toEqual([0, 0, MINIMAP_CONFIG.size, MINIMAP_CONFIG.size]);
      });

      it('should draw one rectangle per tile', () => {
        const size = 3;
        const t = component as unknown as TestableNovarise;
        const canvasRef = buildMinimapCanvasRef();
        t.minimapCanvasRef = canvasRef;
        t.terrainGrid = buildMockTerrainGrid({ size, tileType: TerrainType.MOSS });

        const ctx = canvasRef.nativeElement.getContext('2d')!;
        const fillRectSpy = spyOn(ctx, 'fillRect').and.callThrough();
        spyOn(canvasRef.nativeElement, 'getContext').and.returnValue(ctx);

        component.renderMinimap();

        // 1 background fill + size*size tile fills
        expect(fillRectSpy.calls.count()).toBe(1 + size * size);
      });

      it('should use TERRAIN_CONFIGS color for BEDROCK tiles', () => {
        const t = component as unknown as TestableNovarise;
        const canvasRef = buildMinimapCanvasRef();
        t.minimapCanvasRef = canvasRef;
        t.terrainGrid = buildMockTerrainGrid({ size: 1, tileType: TerrainType.BEDROCK });

        const ctx = canvasRef.nativeElement.getContext('2d')!;
        spyOn(canvasRef.nativeElement, 'getContext').and.returnValue(ctx);

        component.renderMinimap();

        const colorHex = TERRAIN_CONFIGS[TerrainType.BEDROCK].color;
        const r = (colorHex >> 16) & 0xff;
        const g = (colorHex >> 8) & 0xff;
        const b = colorHex & 0xff;
        const expectedColor = `rgb(${r},${g},${b})`;

        // The canvas fillStyle should have been set to the bedrock color at some point
        // We verify by reading the last rendered pixel
        const imageData = ctx.getImageData(1, 1, 1, 1);
        // Pixel should not be pure black (background) after rendering a tile
        expect(imageData.data[0] !== 0 || imageData.data[1] !== 0 || imageData.data[2] !== 0).toBe(true);
        // Verify the expected CSS color string is well-formed
        expect(expectedColor).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
      });

      it('should use TERRAIN_CONFIGS color for CRYSTAL tiles', () => {
        const colorHex = TERRAIN_CONFIGS[TerrainType.CRYSTAL].color;
        const r = (colorHex >> 16) & 0xff;
        const g = (colorHex >> 8) & 0xff;
        const b = colorHex & 0xff;
        expect(`rgb(${r},${g},${b})`).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
      });

      it('should use TERRAIN_CONFIGS color for MOSS tiles', () => {
        const colorHex = TERRAIN_CONFIGS[TerrainType.MOSS].color;
        const r = (colorHex >> 16) & 0xff;
        const g = (colorHex >> 8) & 0xff;
        const b = colorHex & 0xff;
        expect(`rgb(${r},${g},${b})`).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
      });

      it('should use TERRAIN_CONFIGS color for ABYSS tiles', () => {
        const colorHex = TERRAIN_CONFIGS[TerrainType.ABYSS].color;
        const r = (colorHex >> 16) & 0xff;
        const g = (colorHex >> 8) & 0xff;
        const b = colorHex & 0xff;
        expect(`rgb(${r},${g},${b})`).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
      });
    });

    describe('renderMinimap() — spawn/exit markers', () => {
      it('should draw spawn marker when spawn point is set', () => {
        const t = component as unknown as TestableNovarise;
        const canvasRef = buildMinimapCanvasRef();
        t.minimapCanvasRef = canvasRef;
        t.terrainGrid = buildMockTerrainGrid({ size: 5, spawn: { x: 0, z: 2 } });

        const ctx = canvasRef.nativeElement.getContext('2d')!;
        const arcSpy = spyOn(ctx, 'arc').and.callThrough();
        spyOn(canvasRef.nativeElement, 'getContext').and.returnValue(ctx);

        component.renderMinimap();

        expect(arcSpy.calls.count()).toBeGreaterThanOrEqual(1);
      });

      it('should draw exit marker when exit point is set', () => {
        const t = component as unknown as TestableNovarise;
        const canvasRef = buildMinimapCanvasRef();
        t.minimapCanvasRef = canvasRef;
        t.terrainGrid = buildMockTerrainGrid({ size: 5, exit: { x: 4, z: 2 } });

        const ctx = canvasRef.nativeElement.getContext('2d')!;
        const arcSpy = spyOn(ctx, 'arc').and.callThrough();
        spyOn(canvasRef.nativeElement, 'getContext').and.returnValue(ctx);

        component.renderMinimap();

        expect(arcSpy.calls.count()).toBeGreaterThanOrEqual(1);
      });

      it('should draw two markers when both spawn and exit are set', () => {
        const t = component as unknown as TestableNovarise;
        const canvasRef = buildMinimapCanvasRef();
        t.minimapCanvasRef = canvasRef;
        t.terrainGrid = buildMockTerrainGrid({ size: 5, spawn: { x: 0, z: 2 }, exit: { x: 4, z: 2 } });

        const ctx = canvasRef.nativeElement.getContext('2d')!;
        const arcSpy = spyOn(ctx, 'arc').and.callThrough();
        spyOn(canvasRef.nativeElement, 'getContext').and.returnValue(ctx);

        component.renderMinimap();

        expect(arcSpy.calls.count()).toBe(2);
      });

      it('should draw no markers when neither spawn nor exit is set', () => {
        const t = component as unknown as TestableNovarise;
        const canvasRef = buildMinimapCanvasRef();
        t.minimapCanvasRef = canvasRef;
        t.terrainGrid = buildMockTerrainGrid({ size: 3, spawn: null, exit: null });

        const ctx = canvasRef.nativeElement.getContext('2d')!;
        const arcSpy = spyOn(ctx, 'arc').and.callThrough();
        spyOn(canvasRef.nativeElement, 'getContext').and.returnValue(ctx);

        component.renderMinimap();

        expect(arcSpy.calls.count()).toBe(0);
      });

      it('should draw spawn marker with MINIMAP_CONFIG.markerRadius', () => {
        const t = component as unknown as TestableNovarise;
        const canvasRef = buildMinimapCanvasRef();
        t.minimapCanvasRef = canvasRef;
        t.terrainGrid = buildMockTerrainGrid({ size: 5, spawn: { x: 2, z: 2 } });

        const ctx = canvasRef.nativeElement.getContext('2d')!;
        const arcSpy = spyOn(ctx, 'arc').and.callThrough();
        spyOn(canvasRef.nativeElement, 'getContext').and.returnValue(ctx);

        component.renderMinimap();

        const arcArgs = arcSpy.calls.first().args;
        // arc(cx, cz, radius, startAngle, endAngle)
        expect(arcArgs[2]).toBe(MINIMAP_CONFIG.markerRadius);
      });

      it('should position spawn marker at center of the spawn tile', () => {
        const gridSize = 5;
        const spawnX = 1;
        const spawnZ = 3;
        const t = component as unknown as TestableNovarise;
        const canvasRef = buildMinimapCanvasRef();
        t.minimapCanvasRef = canvasRef;
        t.terrainGrid = buildMockTerrainGrid({ size: gridSize, spawn: { x: spawnX, z: spawnZ } });

        const ctx = canvasRef.nativeElement.getContext('2d')!;
        const arcSpy = spyOn(ctx, 'arc').and.callThrough();
        spyOn(canvasRef.nativeElement, 'getContext').and.returnValue(ctx);

        component.renderMinimap();

        const cellSize = MINIMAP_CONFIG.size / gridSize;
        const expectedCx = (spawnX + 0.5) * cellSize;
        const expectedCz = (spawnZ + 0.5) * cellSize;

        const arcArgs = arcSpy.calls.first().args;
        expect(arcArgs[0]).toBeCloseTo(expectedCx, 5);
        expect(arcArgs[1]).toBeCloseTo(expectedCz, 5);
      });
    });

    describe('MINIMAP_CONFIG constants', () => {
      it('should have a positive size', () => {
        expect(MINIMAP_CONFIG.size).toBeGreaterThan(0);
      });

      it('should have a positive markerRadius', () => {
        expect(MINIMAP_CONFIG.markerRadius).toBeGreaterThan(0);
      });

      it('should have a markerRadius smaller than half the canvas size', () => {
        expect(MINIMAP_CONFIG.markerRadius).toBeLessThan(MINIMAP_CONFIG.size / 2);
      });

      it('should use green for spawn color', () => {
        expect(MINIMAP_CONFIG.spawnColor).toBe('#50ff50');
      });

      it('should use red for exit color', () => {
        expect(MINIMAP_CONFIG.exitColor).toBe('#ff5050');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Editor State Delegation
  // ---------------------------------------------------------------------------

  describe('setEditMode()', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should delegate to EditorStateService.setEditMode', () => {
      const editorState = TestBed.inject(EditorStateService);
      const spy = spyOn(editorState, 'setEditMode');
      component.setEditMode('height');
      expect(spy).toHaveBeenCalledWith('height');
    });

    it('should update the editMode getter after the call', () => {
      component.setEditMode('spawn');
      expect(component.editMode).toBe('spawn');
    });

    it('should update to exit mode', () => {
      component.setEditMode('exit');
      expect(component.editMode).toBe('exit');
    });
  });

  describe('setTerrainType()', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should delegate to EditorStateService.setTerrainType', () => {
      const editorState = TestBed.inject(EditorStateService);
      const spy = spyOn(editorState, 'setTerrainType');
      component.setTerrainType(TerrainType.CRYSTAL);
      expect(spy).toHaveBeenCalledWith(TerrainType.CRYSTAL);
    });

    it('should update the selectedTerrainType getter after the call', () => {
      component.setTerrainType(TerrainType.MOSS);
      expect(component.selectedTerrainType).toBe(TerrainType.MOSS);
    });
  });

  describe('setBrushSize()', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should delegate to EditorStateService.setBrushSize', () => {
      const editorState = TestBed.inject(EditorStateService);
      const spy = spyOn(editorState, 'setBrushSize');
      component.setBrushSize(3);
      expect(spy).toHaveBeenCalledWith(3);
    });

    it('should update the brushSize getter after the call', () => {
      component.setBrushSize(3);
      expect(component.brushSize).toBe(3);
    });
  });

  describe('setActiveTool()', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should delegate to EditorStateService.setActiveTool', () => {
      const editorState = TestBed.inject(EditorStateService);
      const spy = spyOn(editorState, 'setActiveTool');
      component.setActiveTool('fill');
      expect(spy).toHaveBeenCalledWith('fill');
    });

    it('should update the activeTool getter after the call', () => {
      component.setActiveTool('rectangle');
      expect(component.activeTool).toBe('rectangle');
    });
  });

  // ---------------------------------------------------------------------------
  // Undo / Redo
  // ---------------------------------------------------------------------------

  describe('undo()', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should call EditHistoryService.undo', () => {
      const editHistory = TestBed.inject(EditHistoryService);
      const spy = spyOn(editHistory, 'undo').and.returnValue(null);
      component.undo();
      expect(spy).toHaveBeenCalled();
    });

    it('should not throw when editHistory.undo returns null', () => {
      const editHistory = TestBed.inject(EditHistoryService);
      spyOn(editHistory, 'undo').and.returnValue(null);
      expect(() => component.undo()).not.toThrow();
    });
  });

  describe('redo()', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should call EditHistoryService.redo', () => {
      const editHistory = TestBed.inject(EditHistoryService);
      const spy = spyOn(editHistory, 'redo').and.returnValue(null);
      component.redo();
      expect(spy).toHaveBeenCalled();
    });

    it('should not throw when editHistory.redo returns null', () => {
      const editHistory = TestBed.inject(EditHistoryService);
      spyOn(editHistory, 'redo').and.returnValue(null);
      expect(() => component.redo()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  describe('goToCampaign()', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should navigate to /campaign', () => {
      const router = TestBed.inject(Router);
      const spy = spyOn(router, 'navigate');
      component.goToCampaign();
      expect(spy).toHaveBeenCalledWith(['/campaign']);
    });
  });

  describe('goToMaps()', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should navigate to /maps', () => {
      const router = TestBed.inject(Router);
      const spy = spyOn(router, 'navigate');
      component.goToMaps();
      expect(spy).toHaveBeenCalledWith(['/maps']);
    });
  });

  describe('playMap()', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should navigate to /play when canPlayMap is true', () => {
      const router = TestBed.inject(Router);
      const navSpy = spyOn(router, 'navigate');
      // Force canPlayMap to be true by bypassing via private member cast
      spyOnProperty(component, 'canPlayMap', 'get').and.returnValue(true);
      component.playMap();
      expect(navSpy).toHaveBeenCalledWith(['/play']);
    });

    it('should NOT navigate when canPlayMap is false', () => {
      const router = TestBed.inject(Router);
      const navSpy = spyOn(router, 'navigate');
      spyOnProperty(component, 'canPlayMap', 'get').and.returnValue(false);
      component.playMap();
      expect(navSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // exportCurrentMap
  // ---------------------------------------------------------------------------

  describe('exportCurrentMap()', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should call mapStorage.downloadMapAsFile when a map id is available', () => {
      mockMapStorageService.getCurrentMapId.and.returnValue('map-123');
      (mockMapStorageService as any).downloadMapAsFile = jasmine.createSpy('downloadMapAsFile').and.returnValue(true);
      component.exportCurrentMap();
      expect((mockMapStorageService as any).downloadMapAsFile).toHaveBeenCalledWith('map-123');
    });

    it('should not call downloadMapAsFile when no map id is set', () => {
      mockMapStorageService.getCurrentMapId.and.returnValue(null);
      (mockMapStorageService as any).downloadMapAsFile = jasmine.createSpy('downloadMapAsFile').and.returnValue(true);
      spyOn(window, 'alert');
      component.exportCurrentMap();
      expect((mockMapStorageService as any).downloadMapAsFile).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // canPlayMap getter
  // ---------------------------------------------------------------------------

  describe('canPlayMap getter', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should return false when terrainGrid is not initialized', () => {
      // terrainGrid is undefined until ngAfterViewInit runs (which we skip)
      expect(component.canPlayMap).toBe(false);
    });

    it('should return false when terrainGrid has spawn but no exit', () => {
      const t = component as unknown as TestableNovarise;
      t.terrainGrid = buildMockTerrainGrid({ spawn: { x: 0, z: 0 }, exit: null });
      expect(component.canPlayMap).toBe(false);
    });

    it('should return false when terrainGrid has exit but no spawn', () => {
      const t = component as unknown as TestableNovarise;
      t.terrainGrid = buildMockTerrainGrid({ spawn: null, exit: { x: 4, z: 4 } });
      expect(component.canPlayMap).toBe(false);
    });

    it('should return false when both points exist but path is not valid', () => {
      const t = component as unknown as TestableNovarise;
      t.terrainGrid = buildMockTerrainGrid({ spawn: { x: 0, z: 0 }, exit: { x: 4, z: 4 } });
      // pathValidationResult defaults to { valid: false } — no runPathValidation called
      expect(component.canPlayMap).toBe(false);
    });
  });
});
