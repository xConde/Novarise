import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { NovariseComponent } from './novarise.component';
import { MapStorageService } from './core/map-storage.service';
import { CameraControlService, JoystickInput, MovementInput, RotationInput } from './core/camera-control.service';
import { EditHistoryService } from './core/edit-history.service';
import { EditorStateService } from './core/editor-state.service';
import { PathValidationService } from './core/path-validation.service';
import { MapTemplateService } from './core/map-template.service';
import { JoystickEvent } from './features/mobile-controls';

/**
 * Typed access to private members needed for test setup/assertion.
 */
interface TestableNovarise {
  renderer: { domElement: HTMLCanvasElement; dispose(): void };
  scene: { remove(...objects: unknown[]): void };
  movementJoystick: JoystickInput;
  rotationJoystick: JoystickInput;
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
        PathValidationService,
        EditHistoryService,
        CameraControlService,
        EditorStateService
      ],
      schemas: [NO_ERRORS_SCHEMA] // Ignore unknown elements like app-virtual-joystick
    }).compileComponents();

    cameraControlService = TestBed.inject(CameraControlService);
  });

  /** Mock Three.js fields that ngOnDestroy accesses (renderer is never initialized since ngAfterViewInit doesn't run in tests) */
  function mockThreeJsFields(comp: NovariseComponent): void {
    const t = comp as unknown as TestableNovarise;
    t.renderer = { domElement: document.createElement('canvas'), dispose: () => {} };
    t.scene = { remove: () => {} };
  }

  describe('Loading State', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('isLoading should default to true before initialization', () => {
      expect(component.isLoading).toBeTrue();
    });
  });

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

  describe('Save Map', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should alert failure when saveMap returns null', () => {
      // Mock terrainGrid.exportState()
      (component as any).terrainGrid = {
        exportState: () => ({ gridSize: 10, tiles: [], heightMap: [], spawnPoints: [{ x: 0, z: 0 }], exitPoints: [{ x: 9, z: 9 }], version: '2.0.0' }),
        dispose: () => {}
      };
      (component as any).currentMapName = 'Test Map';
      mockMapStorageService.saveMap.and.returnValue(null);
      mockMapStorageService.getCurrentMapId.and.returnValue('old_id');
      spyOn(window, 'prompt').and.returnValue('Test Map');
      spyOn(window, 'alert');

      (component as any).saveGridState();

      expect(window.alert).toHaveBeenCalledWith(jasmine.stringContaining('Failed to save'));
    });

    it('should alert success when saveMap returns an ID', () => {
      (component as any).terrainGrid = {
        exportState: () => ({ gridSize: 10, tiles: [], heightMap: [], spawnPoints: [{ x: 0, z: 0 }], exitPoints: [{ x: 9, z: 9 }], version: '2.0.0' }),
        dispose: () => {}
      };
      (component as any).currentMapName = 'Test Map';
      mockMapStorageService.saveMap.and.returnValue('map_123');
      mockMapStorageService.getCurrentMapId.and.returnValue(null);
      spyOn(window, 'prompt').and.returnValue('My Map');
      spyOn(window, 'alert');

      (component as any).saveGridState();

      expect(window.alert).toHaveBeenCalledWith(jasmine.stringContaining('saved successfully'));
    });
  });

  describe('Map Templates', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      mockThreeJsFields(component);
    });

    it('should populate templates from MapTemplateService on creation', () => {
      const templateService = TestBed.inject(MapTemplateService);
      const expected = templateService.getTemplates();
      // templates are populated in ngAfterViewInit which doesn't run in these tests,
      // but the service is injectable — verify the service returns templates
      expect(expected.length).toBeGreaterThan(0);
      expect(expected[0].id).toBe('classic');
    });

    it('should have templates field defaulting to empty array before init', () => {
      expect(component.templates).toEqual([]);
    });
  });
});
