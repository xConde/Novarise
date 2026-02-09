import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { VirtualJoystickComponent } from './virtual-joystick.component';
import { TouchDetectionService, DeviceInfo } from '../../services/touch-detection.service';
import { JoystickEvent, JOYSTICK_SIZES } from '../../models/joystick.types';

/**
 * Typed access to private members needed for test setup/assertion.
 */
interface TestableJoystick {
  activeTouchId: number | null;
  subscription: Subscription | undefined;
  setupTouchListeners(): void;
  updateStickPosition(touch: Touch): void;
  findTouch(touches: TouchList): Touch | null;
  emitChange(): void;
  isActive: boolean;
  vector: { x: number; y: number };
}

describe('VirtualJoystickComponent', () => {
  let component: VirtualJoystickComponent;
  let fixture: ComponentFixture<VirtualJoystickComponent>;
  let mockTouchDetectionService: jasmine.SpyObj<TouchDetectionService>;
  let deviceInfoSubject: BehaviorSubject<DeviceInfo>;

  const createMockDeviceInfo = (overrides: Partial<DeviceInfo> = {}): DeviceInfo => ({
    hasTouchSupport: true,
    deviceType: 'mobile',
    orientation: 'portrait',
    screenWidth: 375,
    screenHeight: 667,
    showVirtualControls: true,
    ...overrides
  });

  beforeEach(async () => {
    deviceInfoSubject = new BehaviorSubject<DeviceInfo>(createMockDeviceInfo());

    mockTouchDetectionService = jasmine.createSpyObj('TouchDetectionService', [
      'getDeviceInfo',
      'getDeviceInfoSnapshot',
      'hasTouchSupport'
    ]);

    mockTouchDetectionService.getDeviceInfo.and.returnValue(deviceInfoSubject.asObservable());
    mockTouchDetectionService.getDeviceInfoSnapshot.and.returnValue(createMockDeviceInfo());
    mockTouchDetectionService.hasTouchSupport.and.returnValue(true);

    await TestBed.configureTestingModule({
      declarations: [VirtualJoystickComponent],
      providers: [
        { provide: TouchDetectionService, useValue: mockTouchDetectionService },
        ChangeDetectorRef
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VirtualJoystickComponent);
    component = fixture.componentInstance;
  });

  describe('Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component.type).toBe('movement');
      expect(component.position).toBe('left');
      expect(component.sensitivity).toBe(1.0);
      expect(component.isActive).toBe(false);
      expect(component.vector).toEqual({ x: 0, y: 0 });
    });

    it('should initialize with mobile portrait sizes by default', () => {
      expect(component.baseSize).toBe(JOYSTICK_SIZES.MOBILE_PORTRAIT.base);
      expect(component.stickSize).toBe(JOYSTICK_SIZES.MOBILE_PORTRAIT.stick);
      expect(component.maxDistance).toBe(JOYSTICK_SIZES.MOBILE_PORTRAIT.maxDistance);
    });

    it('should subscribe to device info on init', () => {
      fixture.detectChanges();

      expect(mockTouchDetectionService.getDeviceInfo).toHaveBeenCalled();
    });
  });

  describe('Device Info Updates', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should show controls when device has touch support and is mobile', () => {
      deviceInfoSubject.next(createMockDeviceInfo({
        hasTouchSupport: true,
        deviceType: 'mobile',
        showVirtualControls: true
      }));

      expect(component.isVisible).toBe(true);
    });

    it('should hide controls on desktop', () => {
      deviceInfoSubject.next(createMockDeviceInfo({
        deviceType: 'desktop',
        showVirtualControls: false
      }));

      expect(component.isVisible).toBe(false);
    });

    it('should update sizes for tablet', () => {
      deviceInfoSubject.next(createMockDeviceInfo({
        deviceType: 'tablet',
        showVirtualControls: true
      }));

      expect(component.baseSize).toBe(JOYSTICK_SIZES.TABLET.base);
      expect(component.stickSize).toBe(JOYSTICK_SIZES.TABLET.stick);
      expect(component.maxDistance).toBe(JOYSTICK_SIZES.TABLET.maxDistance);
    });

    it('should update sizes for mobile landscape', () => {
      deviceInfoSubject.next(createMockDeviceInfo({
        deviceType: 'mobile',
        orientation: 'landscape',
        showVirtualControls: true
      }));

      expect(component.baseSize).toBe(JOYSTICK_SIZES.MOBILE_LANDSCAPE.base);
      expect(component.stickSize).toBe(JOYSTICK_SIZES.MOBILE_LANDSCAPE.stick);
      expect(component.maxDistance).toBe(JOYSTICK_SIZES.MOBILE_LANDSCAPE.maxDistance);
    });

    it('should use mobile portrait sizes for mobile portrait', () => {
      deviceInfoSubject.next(createMockDeviceInfo({
        deviceType: 'mobile',
        orientation: 'portrait',
        showVirtualControls: true
      }));

      expect(component.baseSize).toBe(JOYSTICK_SIZES.MOBILE_PORTRAIT.base);
      expect(component.stickSize).toBe(JOYSTICK_SIZES.MOBILE_PORTRAIT.stick);
      expect(component.maxDistance).toBe(JOYSTICK_SIZES.MOBILE_PORTRAIT.maxDistance);
    });
  });

  describe('Joystick Input Properties', () => {
    it('should accept movement type', () => {
      component.type = 'movement';
      expect(component.type).toBe('movement');
    });

    it('should accept rotation type', () => {
      component.type = 'rotation';
      expect(component.type).toBe('rotation');
    });

    it('should accept left position', () => {
      component.position = 'left';
      expect(component.position).toBe('left');
    });

    it('should accept right position', () => {
      component.position = 'right';
      expect(component.position).toBe('right');
    });

    it('should accept custom sensitivity', () => {
      component.sensitivity = 1.5;
      expect(component.sensitivity).toBe(1.5);
    });
  });

  describe('Joystick Events', () => {
    let emittedEvents: JoystickEvent[];

    beforeEach(() => {
      emittedEvents = [];
      component.joystickChange.subscribe(event => emittedEvents.push(event));
      fixture.detectChanges();
    });

    it('should emit event with correct type for movement joystick', () => {
      component.type = 'movement';

      // Manually trigger emit (simulating internal state change)
      component.isActive = true;
      component.vector = { x: 0.5, y: 0.5 };
      (component as unknown as TestableJoystick).emitChange();

      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].type).toBe('movement');
      expect(emittedEvents[0].active).toBe(true);
      expect(emittedEvents[0].vector).toEqual({ x: 0.5, y: 0.5 });
    });

    it('should emit event with correct type for rotation joystick', () => {
      component.type = 'rotation';

      component.isActive = true;
      component.vector = { x: -0.3, y: 0.7 };
      (component as unknown as TestableJoystick).emitChange();

      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].type).toBe('rotation');
    });

    it('should emit inactive event with zero vector on release', () => {
      component.type = 'movement';

      component.isActive = false;
      component.vector = { x: 0, y: 0 };
      (component as unknown as TestableJoystick).emitChange();

      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].active).toBe(false);
      expect(emittedEvents[0].vector).toEqual({ x: 0, y: 0 });
    });

    it('should create copy of vector in emitted event', () => {
      component.isActive = true;
      component.vector = { x: 0.5, y: 0.5 };
      (component as unknown as TestableJoystick).emitChange();

      // Modify internal vector
      component.vector.x = 1.0;

      // Emitted vector should not be affected
      expect(emittedEvents[0].vector.x).toBe(0.5);
    });
  });

  describe('Touch Handling', () => {
    let mockBaseElement: HTMLDivElement;

    beforeEach(() => {
      // Create mock base element
      mockBaseElement = document.createElement('div');
      mockBaseElement.style.width = '100px';
      mockBaseElement.style.height = '100px';

      // Mock getBoundingClientRect
      spyOn(mockBaseElement, 'getBoundingClientRect').and.returnValue({
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({})
      });

      fixture.detectChanges();

      // Set up ViewChild mock AFTER detectChanges to prevent Angular from overwriting it
      component.joystickBase = {
        nativeElement: mockBaseElement
      } as ElementRef<HTMLDivElement>;

      // Setup touch listeners manually
      (component as unknown as TestableJoystick).setupTouchListeners();
    });

    it('should activate on touch start', () => {
      const touchEvent = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({ identifier: 1, clientX: 50, clientY: 50, target: mockBaseElement })
        ]
      });

      mockBaseElement.dispatchEvent(touchEvent);

      expect(component.isActive).toBe(true);
    });

    it('should track touch identifier', () => {
      const touchEvent = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({ identifier: 42, clientX: 50, clientY: 50, target: mockBaseElement })
        ]
      });

      mockBaseElement.dispatchEvent(touchEvent);

      expect((component as unknown as TestableJoystick).activeTouchId).toBe(42);
    });

    it('should ignore additional touches when already active', () => {
      // First touch
      const touch1 = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({ identifier: 1, clientX: 50, clientY: 50, target: mockBaseElement })
        ]
      });
      mockBaseElement.dispatchEvent(touch1);

      expect((component as unknown as TestableJoystick).activeTouchId).toBe(1);

      // Second touch - should be ignored
      const touch2 = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({ identifier: 2, clientX: 60, clientY: 60, target: mockBaseElement })
        ]
      });
      mockBaseElement.dispatchEvent(touch2);

      expect((component as unknown as TestableJoystick).activeTouchId).toBe(1); // Should still be first touch
    });

    it('should deactivate on touch end', () => {
      // Start touch
      const startEvent = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({ identifier: 1, clientX: 50, clientY: 50, target: mockBaseElement })
        ]
      });
      mockBaseElement.dispatchEvent(startEvent);

      expect(component.isActive).toBe(true);

      // End touch
      const endEvent = new TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({ identifier: 1, clientX: 50, clientY: 50, target: mockBaseElement })
        ]
      });
      mockBaseElement.dispatchEvent(endEvent);

      expect(component.isActive).toBe(false);
      expect((component as unknown as TestableJoystick).activeTouchId).toBeNull();
    });

    it('should reset vector on touch end', () => {
      // Start touch
      const startEvent = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({ identifier: 1, clientX: 70, clientY: 30, target: mockBaseElement })
        ]
      });
      mockBaseElement.dispatchEvent(startEvent);

      // End touch
      const endEvent = new TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({ identifier: 1, clientX: 70, clientY: 30, target: mockBaseElement })
        ]
      });
      mockBaseElement.dispatchEvent(endEvent);

      expect(component.vector).toEqual({ x: 0, y: 0 });
    });

    it('should reset stick transform on touch end', () => {
      // Start touch
      const startEvent = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({ identifier: 1, clientX: 70, clientY: 30, target: mockBaseElement })
        ]
      });
      mockBaseElement.dispatchEvent(startEvent);

      // End touch
      const endEvent = new TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({ identifier: 1, clientX: 70, clientY: 30, target: mockBaseElement })
        ]
      });
      mockBaseElement.dispatchEvent(endEvent);

      expect(component.stickTransform).toBe('translate(-50%, -50%)');
    });

    it('should handle touch cancel like touch end', () => {
      // Start touch
      const startEvent = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({ identifier: 1, clientX: 50, clientY: 50, target: mockBaseElement })
        ]
      });
      mockBaseElement.dispatchEvent(startEvent);

      expect(component.isActive).toBe(true);

      // Cancel touch
      const cancelEvent = new TouchEvent('touchcancel', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({ identifier: 1, clientX: 50, clientY: 50, target: mockBaseElement })
        ]
      });
      mockBaseElement.dispatchEvent(cancelEvent);

      expect(component.isActive).toBe(false);
    });
  });

  describe('Vector Calculation', () => {
    let mockBaseElement: HTMLDivElement;

    beforeEach(() => {
      mockBaseElement = document.createElement('div');

      spyOn(mockBaseElement, 'getBoundingClientRect').and.returnValue({
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({})
      });

      component.maxDistance = 35;
      component.sensitivity = 1.0;

      fixture.detectChanges();

      // Set ViewChild mock AFTER detectChanges to prevent Angular from overwriting it
      component.joystickBase = {
        nativeElement: mockBaseElement
      } as ElementRef<HTMLDivElement>;
    });

    it('should calculate vector based on touch position relative to center', () => {
      const mockTouch = {
        clientX: 50 + 20, // 20px right of center
        clientY: 50 + 10  // 10px below center
      } as Touch;

      (component as unknown as TestableJoystick).updateStickPosition(mockTouch);

      // Vector should be normalized and clamped
      expect(component.vector.x).toBeCloseTo(20 / 35, 2);
      expect(component.vector.y).toBeCloseTo(-10 / 35, 2); // Y is inverted
    });

    it('should clamp vector to max distance', () => {
      const mockTouch = {
        clientX: 50 + 100, // Way beyond max distance
        clientY: 50
      } as Touch;

      (component as unknown as TestableJoystick).updateStickPosition(mockTouch);

      // Should be clamped to 1.0
      expect(component.vector.x).toBeCloseTo(1.0, 2);
    });

    it('should apply sensitivity multiplier', () => {
      component.sensitivity = 0.5;

      const mockTouch = {
        clientX: 50 + 35, // At max distance
        clientY: 50
      } as Touch;

      (component as unknown as TestableJoystick).updateStickPosition(mockTouch);

      // Should be sensitivity * 1.0 = 0.5
      expect(component.vector.x).toBeCloseTo(0.5, 2);
    });

    it('should invert Y axis', () => {
      const mockTouch = {
        clientX: 50,
        clientY: 50 - 20 // 20px above center (negative screen Y)
      } as Touch;

      (component as unknown as TestableJoystick).updateStickPosition(mockTouch);

      // Y should be positive (inverted from screen coordinates)
      expect(component.vector.y).toBeGreaterThan(0);
    });
  });

  describe('findTouch', () => {
    it('should find touch by identifier', () => {
      (component as unknown as TestableJoystick).activeTouchId = 5;

      const mockTouches = {
        length: 3,
        0: { identifier: 3 } as Touch,
        1: { identifier: 5 } as Touch,
        2: { identifier: 7 } as Touch,
        item: (i: number) => mockTouches[i as keyof typeof mockTouches] as Touch | null
      } as TouchList;

      const found = (component as unknown as TestableJoystick).findTouch(mockTouches);

      expect(found).toBeTruthy();
      expect(found!.identifier).toBe(5);
    });

    it('should return null when touch not found', () => {
      (component as unknown as TestableJoystick).activeTouchId = 99;

      const mockTouches = {
        length: 2,
        0: { identifier: 1 } as Touch,
        1: { identifier: 2 } as Touch,
        item: (i: number) => mockTouches[i as keyof typeof mockTouches] as Touch | null
      } as TouchList;

      const found = (component as unknown as TestableJoystick).findTouch(mockTouches);

      expect(found).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe on destroy', () => {
      fixture.detectChanges();

      const subscription = (component as unknown as TestableJoystick).subscription!;
      expect(subscription).toBeTruthy();

      const unsubscribeSpy = spyOn(subscription, 'unsubscribe');

      component.ngOnDestroy();

      expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it('should remove touch listeners on destroy', () => {
      const mockBaseElement = document.createElement('div');

      fixture.detectChanges();

      // Set ViewChild mock AFTER detectChanges to prevent Angular from overwriting it
      component.joystickBase = {
        nativeElement: mockBaseElement
      } as ElementRef<HTMLDivElement>;

      (component as unknown as TestableJoystick).setupTouchListeners();

      const removeEventListenerSpy = spyOn(mockBaseElement, 'removeEventListener');

      component.ngOnDestroy();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });
});
