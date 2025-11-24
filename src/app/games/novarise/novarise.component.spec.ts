import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NovariseComponent } from './novarise.component';
import { MapStorageService } from './core/map-storage.service';
import { JoystickEvent } from './features/mobile-controls';

describe('NovariseComponent', () => {
  let component: NovariseComponent;
  let fixture: ComponentFixture<NovariseComponent>;
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
      providers: [
        { provide: MapStorageService, useValue: mockMapStorageService }
      ],
      schemas: [NO_ERRORS_SCHEMA] // Ignore unknown elements like app-virtual-joystick
    }).compileComponents();
  });

  describe('Joystick State Initialization', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;
    });

    it('should initialize movement joystick state as inactive', () => {
      expect((component as any).joystickActive).toBe(false);
    });

    it('should initialize movement joystick vector to zero', () => {
      expect((component as any).joystickVector).toEqual({ x: 0, y: 0 });
    });

    it('should initialize rotation joystick state as inactive', () => {
      expect((component as any).rotationJoystickActive).toBe(false);
    });

    it('should initialize rotation joystick vector to zero', () => {
      expect((component as any).rotationJoystickVector).toEqual({ x: 0, y: 0 });
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

      expect((component as any).joystickActive).toBe(true);
      expect((component as any).joystickVector).toEqual({ x: 0.5, y: -0.3 });
    });

    it('should update rotation joystick state when rotation event received', () => {
      const event: JoystickEvent = {
        type: 'rotation',
        vector: { x: -0.7, y: 0.4 },
        active: true
      };

      component.onJoystickChange(event);

      expect((component as any).rotationJoystickActive).toBe(true);
      expect((component as any).rotationJoystickVector).toEqual({ x: -0.7, y: 0.4 });
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

      expect((component as any).joystickActive).toBe(false);
      expect((component as any).joystickVector).toEqual({ x: 0, y: 0 });
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

      expect((component as any).rotationJoystickActive).toBe(false);
      expect((component as any).rotationJoystickVector).toEqual({ x: 0, y: 0 });
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

      // Both should be active with independent vectors
      expect((component as any).joystickActive).toBe(true);
      expect((component as any).rotationJoystickActive).toBe(true);
      expect((component as any).joystickVector).toEqual({ x: 0.5, y: 0.5 });
      expect((component as any).rotationJoystickVector).toEqual({ x: -0.3, y: 0.7 });
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

      expect((component as any).joystickActive).toBe(false);
      expect((component as any).rotationJoystickActive).toBe(true);
    });
  });

  describe('Camera Rotation Integration', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;

      // Initialize rotation values
      (component as any).targetRotation = { yaw: 0, pitch: 0 };
      (component as any).cameraRotation = { yaw: 0, pitch: 0 };
      (component as any).rotationSpeed = 0.005;
      (component as any).rotationAcceleration = 0.15;
    });

    it('should update target yaw when rotation joystick X is moved', () => {
      (component as any).rotationJoystickActive = true;
      (component as any).rotationJoystickVector = { x: 1, y: 0 }; // Push right

      const initialYaw = (component as any).targetRotation.yaw;
      (component as any).updateCameraMovement();

      expect((component as any).targetRotation.yaw).not.toBe(initialYaw);
    });

    it('should update target pitch when rotation joystick Y is moved', () => {
      (component as any).rotationJoystickActive = true;
      (component as any).rotationJoystickVector = { x: 0, y: 1 }; // Push up

      const initialPitch = (component as any).targetRotation.pitch;
      (component as any).updateCameraMovement();

      expect((component as any).targetRotation.pitch).not.toBe(initialPitch);
    });

    it('should clamp pitch to upper limit (45 degrees)', () => {
      (component as any).rotationJoystickActive = true;
      (component as any).rotationJoystickVector = { x: 0, y: 1 };

      // Apply many updates to reach limit
      for (let i = 0; i < 1000; i++) {
        (component as any).updateCameraMovement();
      }

      // Should be clamped to max (PI/4 radians = 45 degrees)
      expect((component as any).targetRotation.pitch).toBeLessThanOrEqual(Math.PI / 4 + 0.001);
    });

    it('should clamp pitch to lower limit (-75 degrees)', () => {
      (component as any).rotationJoystickActive = true;
      (component as any).rotationJoystickVector = { x: 0, y: -1 };

      // Apply many updates to reach limit
      for (let i = 0; i < 1000; i++) {
        (component as any).updateCameraMovement();
      }

      // Should be clamped to min (-PI * 5/12 radians = -75 degrees)
      expect((component as any).targetRotation.pitch).toBeGreaterThanOrEqual(-Math.PI * 5 / 12 - 0.001);
    });

    it('should not update rotation when joystick is inactive', () => {
      (component as any).rotationJoystickActive = false;
      (component as any).rotationJoystickVector = { x: 1, y: 1 };

      const initialYaw = (component as any).targetRotation.yaw;
      const initialPitch = (component as any).targetRotation.pitch;

      (component as any).updateCameraMovement();

      expect((component as any).targetRotation.yaw).toBe(initialYaw);
      expect((component as any).targetRotation.pitch).toBe(initialPitch);
    });

    it('should smoothly interpolate rotation values', () => {
      (component as any).targetRotation = { yaw: 1, pitch: 0.5 };
      (component as any).cameraRotation = { yaw: 0, pitch: 0 };

      (component as any).updateCameraMovement();

      // Camera rotation should move towards target
      expect((component as any).cameraRotation.yaw).toBeGreaterThan(0);
      expect((component as any).cameraRotation.yaw).toBeLessThan(1);
      expect((component as any).cameraRotation.pitch).toBeGreaterThan(0);
      expect((component as any).cameraRotation.pitch).toBeLessThan(0.5);
    });
  });

  describe('Movement Integration', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;

      // Initialize movement values
      (component as any).targetVelocity = { x: 0, y: 0, z: 0 };
      (component as any).cameraVelocity = { x: 0, y: 0, z: 0 };
      (component as any).cameraRotation = { yaw: 0, pitch: 0 };
      (component as any).targetRotation = { yaw: 0, pitch: 0 };
      (component as any).moveSpeed = 0.25;
      (component as any).acceleration = 0.15;
      (component as any).keysPressed = new Set();
    });

    it('should update velocity when movement joystick is active', () => {
      (component as any).joystickActive = true;
      (component as any).joystickVector = { x: 0.5, y: 0.5 };

      (component as any).updateCameraMovement();

      // Velocity should have changed from joystick input
      const velocityMagnitude = Math.sqrt(
        (component as any).cameraVelocity.x ** 2 +
        (component as any).cameraVelocity.z ** 2
      );
      expect(velocityMagnitude).toBeGreaterThan(0);
    });

    it('should not affect movement when joystick is inactive', () => {
      (component as any).joystickActive = false;
      (component as any).joystickVector = { x: 1, y: 1 };
      (component as any).cameraVelocity = { x: 0, y: 0, z: 0 };

      (component as any).updateCameraMovement();

      // With no active input, velocity should stay near zero
      expect(Math.abs((component as any).cameraVelocity.x)).toBeLessThan(0.01);
      expect(Math.abs((component as any).cameraVelocity.z)).toBeLessThan(0.01);
    });

    it('should work alongside keyboard input', () => {
      (component as any).joystickActive = true;
      (component as any).joystickVector = { x: 0.5, y: 0 }; // Strafe right
      (component as any).keysPressed = new Set(['w']); // Also moving forward

      (component as any).updateCameraMovement();

      // Both inputs should contribute to velocity
      const velocityMagnitude = Math.sqrt(
        (component as any).cameraVelocity.x ** 2 +
        (component as any).cameraVelocity.z ** 2
      );
      expect(velocityMagnitude).toBeGreaterThan(0);
    });

    it('should combine both joysticks for full FPS-style control', () => {
      // Activate both joysticks
      (component as any).joystickActive = true;
      (component as any).joystickVector = { x: 0.5, y: 0.5 }; // Move forward-right
      (component as any).rotationJoystickActive = true;
      (component as any).rotationJoystickVector = { x: 0.3, y: 0 }; // Look right

      const initialYaw = (component as any).targetRotation.yaw;
      (component as any).updateCameraMovement();

      // Both movement and rotation should be applied
      const velocityMagnitude = Math.sqrt(
        (component as any).cameraVelocity.x ** 2 +
        (component as any).cameraVelocity.z ** 2
      );
      expect(velocityMagnitude).toBeGreaterThan(0);
      expect((component as any).targetRotation.yaw).not.toBe(initialYaw);
    });
  });
});
