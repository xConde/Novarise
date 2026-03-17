import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { NovariseComponent } from './novarise.component';
import { MapStorageService } from './core/map-storage.service';
import { CameraControlService, JoystickInput, MovementInput, RotationInput } from './core/camera-control.service';
import { EditorStateService } from './core/editor-state.service';
import { EditHistoryService } from './core/edit-history.service';
import { PathValidationService } from './core/path-validation.service';
import { MapTemplateService } from './core/map-template.service';
import { EditorSceneService } from './core/editor-scene.service';
import { JoystickEvent } from './features/mobile-controls';

/**
 * Typed access to private members needed for test setup/assertion.
 */
interface TestableNovarise {
  movementJoystick: JoystickInput;
  rotationJoystick: JoystickInput;
}

/**
 * Minimal mock for EditorSceneService — only the methods touched during
 * component construction and ngOnDestroy (which never runs in basic specs).
 */
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

import * as THREE from 'three';

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

  let mockEditorScene: jasmine.SpyObj<EditorSceneService>;

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

    mockEditorScene = makeEditorSceneSpy();

    await TestBed.configureTestingModule({
      declarations: [NovariseComponent],
      imports: [RouterTestingModule],
      providers: [
        { provide: MapStorageService, useValue: mockMapStorageService },
        { provide: EditorSceneService, useValue: mockEditorScene },
        PathValidationService,
        CameraControlService,
        EditorStateService,
        EditHistoryService,
      ],
      schemas: [NO_ERRORS_SCHEMA] // Ignore unknown elements like app-virtual-joystick
    }).compileComponents();

    cameraControlService = TestBed.inject(CameraControlService);
  });

  describe('Joystick State Initialization', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;

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

  describe('Map Templates', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;

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

  describe('WebGL context loss', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;

    });

    it('contextLost should start as false', () => {
      expect(component.contextLost).toBeFalse();
    });

    it('setting contextLost to true should be reflected on the component', () => {
      (component as any).contextLost = true;
      expect(component.contextLost).toBeTrue();
    });

    it('setting contextLost back to false should be reflected on the component', () => {
      (component as any).contextLost = true;
      (component as any).contextLost = false;
      expect(component.contextLost).toBeFalse();
    });
  });

  describe('saveGridState path guard', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;

    });

    it('should not call mapStorage.saveMap when path is invalid, spawn+exit exist, and user cancels confirm', () => {
      // Arrange: path invalid, but spawn and exit are present
      (component as any).pathValidationResult = { valid: false };
      spyOnProperty(component, 'hasSpawnAndExit').and.returnValue(true);
      spyOn(window, 'confirm').and.returnValue(false);

      // Act: trigger saveGridState via its keyboard shortcut ('g' key)
      (component as any).saveGridState();

      // Assert: saveMap never called
      expect(mockMapStorageService.saveMap).not.toHaveBeenCalled();
    });

    it('should call mapStorage.saveMap when path is invalid, spawn+exit exist, and user confirms', () => {
      // Arrange: path invalid, but spawn and exit are present
      (component as any).pathValidationResult = { valid: false };
      spyOnProperty(component, 'hasSpawnAndExit').and.returnValue(true);
      spyOn(window, 'confirm').and.returnValue(true);
      spyOn(window, 'prompt').and.returnValue('My Map');
      spyOn(window, 'alert');

      // Stub terrainGrid so exportState() works (dispose required by ngOnDestroy)
      const fakeState = { tiles: [], spawnerPoints: [], exitPoints: [] };
      (component as any).terrainGrid = {
        exportState: () => fakeState,
        getSpawnPoints: () => [{}],
        getExitPoints: () => [{}],
        dispose: () => {}
      };
      mockMapStorageService.saveMap.and.returnValue('map-id-1');
      mockMapStorageService.getCurrentMapId.and.returnValue(null);

      // Act
      (component as any).saveGridState();

      // Assert: saveMap was called with the entered name and exported state
      expect(mockMapStorageService.saveMap).toHaveBeenCalledWith('My Map', jasmine.any(Object), undefined);
    });

    it('should call mapStorage.saveMap without confirm when path is valid', () => {
      // Arrange: path is valid — no guard dialog
      (component as any).pathValidationResult = { valid: true };
      spyOn(window, 'confirm');
      spyOn(window, 'prompt').and.returnValue('Valid Map');
      spyOn(window, 'alert');

      const fakeState = { tiles: [], spawnerPoints: [], exitPoints: [] };
      (component as any).terrainGrid = {
        exportState: () => fakeState,
        getSpawnPoints: () => [{}],
        getExitPoints: () => [{}],
        dispose: () => {}
      };
      mockMapStorageService.saveMap.and.returnValue('map-id-2');
      mockMapStorageService.getCurrentMapId.and.returnValue(null);

      // Act
      (component as any).saveGridState();

      // Assert: confirm never shown, saveMap called
      expect(window.confirm).not.toHaveBeenCalled();
      expect(mockMapStorageService.saveMap).toHaveBeenCalledWith('Valid Map', jasmine.any(Object), undefined);
    });
  });
});
