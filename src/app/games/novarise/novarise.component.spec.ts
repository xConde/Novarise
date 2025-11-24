import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ElementRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { NovariseComponent } from './novarise.component';
import { MapStorageService } from './core/map-storage.service';

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
      schemas: [NO_ERRORS_SCHEMA] // Ignore unknown elements like app-edit-controls
    }).compileComponents();
  });

  function createMockJoystickElement(): HTMLElement {
    const element = document.createElement('div');
    element.style.width = '120px';
    element.style.height = '120px';
    spyOn(element, 'getBoundingClientRect').and.returnValue({
      left: 20,
      top: 500,
      width: 120,
      height: 120,
      right: 140,
      bottom: 620,
      x: 20,
      y: 500,
      toJSON: () => {}
    });
    return element;
  }

  function createMockStickElement(): HTMLElement {
    const element = document.createElement('div');
    element.style.transform = 'translate(-50%, -50%)';
    return element;
  }

  function createTouchEvent(type: string, clientX?: number, clientY?: number): TouchEvent {
    const touches = clientX !== undefined && clientY !== undefined
      ? [{ clientX, clientY, identifier: 0, target: document.createElement('div') } as unknown as Touch]
      : [];

    return new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: touches
    });
  }

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

  describe('Movement Joystick Touch Events', () => {
    let joystickElement: HTMLElement;
    let stickElement: HTMLElement;

    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;

      joystickElement = createMockJoystickElement();
      stickElement = createMockStickElement();

      (component as any).joystick = { nativeElement: joystickElement } as ElementRef;
      (component as any).joystickStick = { nativeElement: stickElement } as ElementRef;

      (component as any).setupJoystick();
    });

    it('should activate joystick on touchstart', () => {
      const touchEvent = createTouchEvent('touchstart', 80, 560);
      joystickElement.dispatchEvent(touchEvent);

      expect((component as any).joystickActive).toBe(true);
    });

    it('should update joystick vector on touchmove', () => {
      (component as any).joystickActive = true;

      const touchEvent = createTouchEvent('touchmove', 100, 540);
      joystickElement.dispatchEvent(touchEvent);

      // Vector should be normalized between -1 and 1
      expect((component as any).joystickVector.x).toBeGreaterThanOrEqual(-1);
      expect((component as any).joystickVector.x).toBeLessThanOrEqual(1);
      expect((component as any).joystickVector.y).toBeGreaterThanOrEqual(-1);
      expect((component as any).joystickVector.y).toBeLessThanOrEqual(1);
    });

    it('should deactivate joystick on touchend', () => {
      (component as any).joystickActive = true;
      (component as any).joystickVector = { x: 0.5, y: 0.5 };

      const touchEvent = createTouchEvent('touchend');
      joystickElement.dispatchEvent(touchEvent);

      expect((component as any).joystickActive).toBe(false);
      expect((component as any).joystickVector).toEqual({ x: 0, y: 0 });
    });

    it('should reset stick transform on touchend', () => {
      (component as any).joystickActive = true;

      const touchEvent = createTouchEvent('touchend');
      joystickElement.dispatchEvent(touchEvent);

      expect(stickElement.style.transform).toBe('translate(-50%, -50%)');
    });

    it('should handle touchcancel same as touchend', () => {
      (component as any).joystickActive = true;
      (component as any).joystickVector = { x: 0.8, y: 0.3 };

      const touchEvent = createTouchEvent('touchcancel');
      joystickElement.dispatchEvent(touchEvent);

      expect((component as any).joystickActive).toBe(false);
      expect((component as any).joystickVector).toEqual({ x: 0, y: 0 });
    });

    it('should clamp joystick movement to max distance', () => {
      (component as any).joystickActive = true;

      // Move way beyond the max distance (35px from center at 80, 560)
      const touchEvent = createTouchEvent('touchmove', 200, 400);
      joystickElement.dispatchEvent(touchEvent);

      // Even with extreme movement, vector magnitude should be <= sqrt(2) (diagonal max)
      const magnitude = Math.sqrt(
        (component as any).joystickVector.x ** 2 +
        (component as any).joystickVector.y ** 2
      );
      expect(magnitude).toBeLessThanOrEqual(Math.sqrt(2) + 0.01);
    });

    it('should not update vector when joystick is inactive', () => {
      (component as any).joystickActive = false;
      (component as any).joystickVector = { x: 0, y: 0 };

      const touchEvent = createTouchEvent('touchmove', 100, 540);
      joystickElement.dispatchEvent(touchEvent);

      expect((component as any).joystickVector).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Rotation Joystick Touch Events', () => {
    let rotationJoystickElement: HTMLElement;
    let rotationStickElement: HTMLElement;

    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;

      rotationJoystickElement = createMockJoystickElement();
      rotationStickElement = createMockStickElement();

      (component as any).rotationJoystick = { nativeElement: rotationJoystickElement } as ElementRef;
      (component as any).rotationJoystickStick = { nativeElement: rotationStickElement } as ElementRef;

      (component as any).setupRotationJoystick();
    });

    it('should activate rotation joystick on touchstart', () => {
      const touchEvent = createTouchEvent('touchstart', 300, 560);
      rotationJoystickElement.dispatchEvent(touchEvent);

      expect((component as any).rotationJoystickActive).toBe(true);
    });

    it('should update rotation joystick vector on touchmove', () => {
      (component as any).rotationJoystickActive = true;

      const touchEvent = createTouchEvent('touchmove', 100, 540);
      rotationJoystickElement.dispatchEvent(touchEvent);

      // Vector should be normalized between -1 and 1
      expect((component as any).rotationJoystickVector.x).toBeGreaterThanOrEqual(-1);
      expect((component as any).rotationJoystickVector.x).toBeLessThanOrEqual(1);
      expect((component as any).rotationJoystickVector.y).toBeGreaterThanOrEqual(-1);
      expect((component as any).rotationJoystickVector.y).toBeLessThanOrEqual(1);
    });

    it('should deactivate rotation joystick on touchend', () => {
      (component as any).rotationJoystickActive = true;
      (component as any).rotationJoystickVector = { x: 0.5, y: 0.5 };

      const touchEvent = createTouchEvent('touchend');
      rotationJoystickElement.dispatchEvent(touchEvent);

      expect((component as any).rotationJoystickActive).toBe(false);
      expect((component as any).rotationJoystickVector).toEqual({ x: 0, y: 0 });
    });

    it('should handle touchcancel for rotation joystick', () => {
      (component as any).rotationJoystickActive = true;
      (component as any).rotationJoystickVector = { x: -0.7, y: 0.4 };

      const touchEvent = createTouchEvent('touchcancel');
      rotationJoystickElement.dispatchEvent(touchEvent);

      expect((component as any).rotationJoystickActive).toBe(false);
      expect((component as any).rotationJoystickVector).toEqual({ x: 0, y: 0 });
    });
  });

  describe('Dual-Stick Simultaneous Usage', () => {
    let movementJoystick: HTMLElement;
    let movementStick: HTMLElement;
    let rotationJoystick: HTMLElement;
    let rotationStick: HTMLElement;

    beforeEach(() => {
      fixture = TestBed.createComponent(NovariseComponent);
      component = fixture.componentInstance;

      movementJoystick = createMockJoystickElement();
      movementStick = createMockStickElement();
      rotationJoystick = createMockJoystickElement();
      rotationStick = createMockStickElement();

      (component as any).joystick = { nativeElement: movementJoystick } as ElementRef;
      (component as any).joystickStick = { nativeElement: movementStick } as ElementRef;
      (component as any).rotationJoystick = { nativeElement: rotationJoystick } as ElementRef;
      (component as any).rotationJoystickStick = { nativeElement: rotationStick } as ElementRef;

      (component as any).setupJoystick();
      (component as any).setupRotationJoystick();
    });

    it('should allow both joysticks to be active simultaneously', () => {
      // Activate movement joystick
      movementJoystick.dispatchEvent(createTouchEvent('touchstart', 80, 560));

      // Activate rotation joystick
      rotationJoystick.dispatchEvent(createTouchEvent('touchstart', 300, 560));

      expect((component as any).joystickActive).toBe(true);
      expect((component as any).rotationJoystickActive).toBe(true);
    });

    it('should maintain independent vectors for each joystick', () => {
      (component as any).joystickActive = true;
      (component as any).rotationJoystickActive = true;

      // Update movement joystick (moving right and forward)
      movementJoystick.dispatchEvent(createTouchEvent('touchmove', 100, 520));
      const movementX = (component as any).joystickVector.x;
      const movementY = (component as any).joystickVector.y;

      // Update rotation joystick (different direction)
      rotationJoystick.dispatchEvent(createTouchEvent('touchmove', 60, 580));

      // Movement vector should remain unchanged
      expect((component as any).joystickVector.x).toBe(movementX);
      expect((component as any).joystickVector.y).toBe(movementY);

      // Rotation vector should have its own values
      expect((component as any).rotationJoystickVector.x).toBeDefined();
      expect((component as any).rotationJoystickVector.y).toBeDefined();
    });

    it('should allow releasing one joystick while keeping the other active', () => {
      (component as any).joystickActive = true;
      (component as any).rotationJoystickActive = true;

      // Release only movement joystick
      movementJoystick.dispatchEvent(createTouchEvent('touchend'));

      expect((component as any).joystickActive).toBe(false);
      expect((component as any).rotationJoystickActive).toBe(true);
    });

    it('should allow releasing rotation joystick while keeping movement active', () => {
      (component as any).joystickActive = true;
      (component as any).rotationJoystickActive = true;

      // Release only rotation joystick
      rotationJoystick.dispatchEvent(createTouchEvent('touchend'));

      expect((component as any).joystickActive).toBe(true);
      expect((component as any).rotationJoystickActive).toBe(false);
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
  });
});
