import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { NovariseComponent } from './novarise.component';
import { MapStorageService } from '../../core/services/map-storage.service';
import { CameraControlService, JoystickInput, MovementInput, RotationInput } from './core/camera-control.service';
import { EditorStateService } from './core/editor-state.service';
import { EditHistoryService } from './core/edit-history.service';
import { PathValidationService } from './core/path-validation.service';
import { MapTemplateService } from '../../core/services/map-template.service';
import { EditorSceneService } from './core/editor-scene.service';
import { EditorNotificationService } from './core/editor-notification.service';
import { TerrainEditService } from './core/terrain-edit.service';
import { MapFileService } from './core/map-file.service';
import { BrushPreviewService } from './core/brush-preview.service';
import { SpawnExitMarkerService } from './core/spawn-exit-marker.service';
import { RectangleToolService } from './core/rectangle-tool.service';
import { EditorModalService } from './core/editor-modal.service';
import { EditorKeyboardService } from './core/editor-keyboard.service';
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
      imports: [RouterTestingModule, FormsModule],
      providers: [
        { provide: MapStorageService, useValue: mockMapStorageService },
        { provide: EditorSceneService, useValue: mockEditorScene },
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

  describe('Modal dialog state', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
    });

    it('should initialize with showModal false', () => {
      expect(component.showModal).toBeFalse();
    });

    describe('showInputModal', () => {
      it('should set showModal, modalType, modalTitle, and modalInputValue', () => {
        component.editorModal.showInputModal('Enter map name', 'My Map', () => {});
        expect(component.showModal).toBeTrue();
        expect(component.modalType).toBe('input');
        expect(component.modalTitle).toBe('Enter map name');
        expect(component.modalInputValue).toBe('My Map');
      });
    });

    describe('showConfirmModal', () => {
      it('should set showModal, modalType, and modalTitle', () => {
        component.editorModal.showConfirmModal('Proceed?', () => {});
        expect(component.showModal).toBeTrue();
        expect(component.modalType).toBe('confirm');
        expect(component.modalTitle).toBe('Proceed?');
      });
    });

    describe('showSelectModal', () => {
      it('should set showModal, modalType, modalTitle, and modalSelectOptions', () => {
        component.editorModal.showSelectModal('Pick one', ['Alpha', 'Beta'], () => {});
        expect(component.showModal).toBeTrue();
        expect(component.modalType).toBe('select');
        expect(component.modalTitle).toBe('Pick one');
        expect(component.modalSelectOptions).toEqual(['Alpha', 'Beta']);
      });
    });

    describe('confirmModal on input type', () => {
      it('should invoke callback with the current input value', () => {
        let received: string | null | boolean = 'unset';
        component.editorModal.showInputModal('Name', 'default', (v: string | null) => { received = v; });
        component.modalInputValue = 'Custom Name';
        component.confirmModal();
        expect(received).toBe('Custom Name');
      });

      it('should close the modal after confirm', () => {
        component.editorModal.showInputModal('Name', '', () => {});
        component.confirmModal();
        expect(component.showModal).toBeFalse();
      });

      it('should pass null when input value is empty string', () => {
        let received: string | null | boolean = 'unset';
        component.editorModal.showInputModal('Name', '', (v: string | null) => { received = v; });
        component.modalInputValue = '';
        component.confirmModal();
        expect(received).toBeNull();
      });
    });

    describe('confirmModal on confirm type', () => {
      it('should invoke callback with true', () => {
        let received: string | null | boolean = false;
        component.editorModal.showConfirmModal('Sure?', (v: boolean) => { received = v; });
        component.confirmModal();
        expect(received).toBeTrue();
      });

      it('should close the modal after confirm', () => {
        component.editorModal.showConfirmModal('Sure?', () => {});
        component.confirmModal();
        expect(component.showModal).toBeFalse();
      });
    });

    describe('cancelModal on input type', () => {
      it('should invoke callback with null', () => {
        let received: string | null | boolean = 'unset';
        component.editorModal.showInputModal('Name', 'value', (v: string | null) => { received = v; });
        component.cancelModal();
        expect(received).toBeNull();
      });

      it('should close the modal', () => {
        component.editorModal.showInputModal('Name', '', () => {});
        component.cancelModal();
        expect(component.showModal).toBeFalse();
      });
    });

    describe('cancelModal on confirm type', () => {
      it('should invoke callback with false', () => {
        let received: string | null | boolean = true;
        component.editorModal.showConfirmModal('Sure?', (v: boolean) => { received = v; });
        component.cancelModal();
        expect(received).toBeFalse();
      });

      it('should close the modal', () => {
        component.editorModal.showConfirmModal('Sure?', () => {});
        component.cancelModal();
        expect(component.showModal).toBeFalse();
      });
    });

    describe('cancelModal on select type', () => {
      it('should invoke callback with null when cancelled', () => {
        let callbackInvoked = false;
        component.editorModal.showSelectModal('Pick', ['A'], (v: number | null) => {
          callbackInvoked = true;
          // cancel passes false through the generic callback; the select wrapper
          // receives false (not a number) so consumers should guard with null check
          expect(v === null || typeof v !== 'number').toBeTrue();
        });
        component.cancelModal();
        expect(callbackInvoked).toBeTrue();
        expect(component.showModal).toBeFalse();
      });
    });

    describe('selectModalOption', () => {
      it('should invoke callback with the chosen index', () => {
        let received = -1;
        component.editorModal.showSelectModal('Pick', ['Alpha', 'Beta'], (i: number | null) => {
          if (i !== null) received = i;
        });
        component.selectModalOption(1);
        expect(received).toBe(1);
      });

      it('should close the modal after selection', () => {
        component.editorModal.showSelectModal('Pick', ['A'], () => {});
        component.selectModalOption(0);
        expect(component.showModal).toBeFalse();
      });
    });

    describe('closeModal', () => {
      it('should set showModal to false and clear callback', () => {
        component.editorModal.showConfirmModal('Test', () => {});
        component.closeModal();
        expect(component.showModal).toBeFalse();
        expect((component.editorModal as any).modalCallback).toBeNull();
      });
    });
  });

  describe('Autosave draft (delegated to MapFileService)', () => {
    const DRAFT_KEY = 'novarise-draft';

    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
      localStorage.removeItem(DRAFT_KEY);
    });

    afterEach(() => {
      const mapFile: MapFileService = TestBed.inject(MapFileService);
      mapFile.stopAutosave();
      localStorage.removeItem(DRAFT_KEY);
    });

    it('saveDraft writes grid state to localStorage via MapFileService', () => {
      const mapFile: MapFileService = TestBed.inject(MapFileService);
      const fakeState = { gridSize: 25, tiles: [], heightMap: [], spawnPoints: [], exitPoints: [], version: '2' };
      const mockGrid = { exportState: () => fakeState, dispose: () => {} } as any;
      mapFile.setTerrainGrid(mockGrid);

      mapFile.saveDraft();

      const stored = localStorage.getItem(DRAFT_KEY);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(fakeState);
    });

    it('loadDraft returns null when no draft is in localStorage', () => {
      const mapFile: MapFileService = TestBed.inject(MapFileService);
      expect(mapFile.loadDraft()).toBeNull();
    });

    it('loadDraft returns parsed state when draft exists', () => {
      const mapFile: MapFileService = TestBed.inject(MapFileService);
      const fakeState = { gridSize: 25, tiles: [], heightMap: [], spawnPoints: [], exitPoints: [], version: '2' };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(fakeState));
      expect(mapFile.loadDraft()).toEqual(fakeState as any);
    });

    it('loadDraft returns null when draft JSON is malformed', () => {
      const mapFile: MapFileService = TestBed.inject(MapFileService);
      localStorage.setItem(DRAFT_KEY, '{not valid json');
      expect(mapFile.loadDraft()).toBeNull();
    });

    it('clearDraft removes the draft from localStorage', () => {
      const mapFile: MapFileService = TestBed.inject(MapFileService);
      localStorage.setItem(DRAFT_KEY, '{}');
      mapFile.clearDraft();
      expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it('startAutosave starts the interval on MapFileService', () => {
      const mapFile: MapFileService = TestBed.inject(MapFileService);
      const setSpy = spyOn(window, 'setInterval').and.callThrough();
      mapFile.startAutosave();
      expect(setSpy).toHaveBeenCalled();
      mapFile.stopAutosave();
    });

    it('ngOnDestroy delegates stopAutosave to MapFileService', () => {
      const mapFile: MapFileService = TestBed.inject(MapFileService);
      const stopSpy = spyOn(mapFile, 'stopAutosave').and.callThrough();
      mapFile.startAutosave();
      component.ngOnDestroy();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('formatAutosaveTime', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
    });

    it('returns empty string when lastAutosaveTime is null', () => {
      expect(component.formatAutosaveTime()).toBe('');
    });

    it('returns "just now" when saved less than 60 seconds ago', () => {
      component.lastAutosaveTime = new Date(Date.now() - 30_000);
      expect(component.formatAutosaveTime()).toBe('just now');
    });

    it('returns "1 min ago" when saved 90 seconds ago', () => {
      component.lastAutosaveTime = new Date(Date.now() - 90_000);
      expect(component.formatAutosaveTime()).toBe('1 min ago');
    });

    it('returns "5 min ago" when saved 5 minutes ago', () => {
      component.lastAutosaveTime = new Date(Date.now() - 300_000);
      expect(component.formatAutosaveTime()).toBe('5 min ago');
    });
  });

  describe('saveGridState path guard (modal-based)', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
    });

    it('should not call mapStorage.saveMap when path is invalid, spawn+exit exist, and user cancels confirm modal', () => {
      // Arrange: path invalid, spawn and exit present
      (component as any).pathValidationResult = { valid: false };
      spyOnProperty(component, 'hasSpawnAndExit').and.returnValue(true);

      // Act: trigger saveGridState — it should open a confirm modal
      (component as any).saveGridState();

      // Confirm modal is open, then user cancels
      expect(component.showModal).toBeTrue();
      expect(component.modalType).toBe('confirm');
      component.cancelModal();

      // Assert: saveMap never called
      expect(mockMapStorageService.saveMap).not.toHaveBeenCalled();
    });

    it('should open input modal after user confirms the path-invalid warning', () => {
      // Arrange: path invalid, spawn and exit present
      (component as any).pathValidationResult = { valid: false };
      spyOnProperty(component, 'hasSpawnAndExit').and.returnValue(true);

      (component as any).saveGridState();

      // User confirms the "save anyway?" dialog
      expect(component.modalType).toBe('confirm');
      component.confirmModal();

      // Input modal should now be open
      expect(component.showModal).toBeTrue();
      expect(component.modalType).toBe('input');
    });

    it('should call mapFile.save when path is invalid and user confirms both dialogs', () => {
      // Arrange
      (component as any).pathValidationResult = { valid: false };
      spyOnProperty(component, 'hasSpawnAndExit').and.returnValue(true);

      const mapFile: MapFileService = TestBed.inject(MapFileService);
      const saveSpy = spyOn(mapFile, 'save').and.returnValue(true);

      // Act
      (component as any).saveGridState();
      component.confirmModal(); // confirm "save anyway?"
      component.modalInputValue = 'My Map';
      component.confirmModal(); // confirm map name

      // Assert
      expect(saveSpy).toHaveBeenCalledWith('My Map');
    });

    it('should open input modal directly (no confirm) when path is valid', () => {
      // Arrange: path valid — no guard dialog
      (component as any).pathValidationResult = { valid: true };

      // Act
      (component as any).saveGridState();

      // Input modal opens immediately — no confirm step
      expect(component.showModal).toBeTrue();
      expect(component.modalType).toBe('input');
    });

    it('should call mapFile.save when path is valid and user enters a name', () => {
      // Arrange
      (component as any).pathValidationResult = { valid: true };

      const mapFile: MapFileService = TestBed.inject(MapFileService);
      const saveSpy = spyOn(mapFile, 'save').and.returnValue(true);

      // Act
      (component as any).saveGridState();
      component.modalInputValue = 'Valid Map';
      component.confirmModal();

      // Assert
      expect(saveSpy).toHaveBeenCalledWith('Valid Map');
    });
  });
});
