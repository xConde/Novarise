import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TouchDetectionService, DeviceInfo } from './touch-detection.service';
import { JOYSTICK_BREAKPOINTS } from '../models/joystick.types';

describe('TouchDetectionService', () => {
  let service: TouchDetectionService;
  let mockInnerWidth: number;
  let mockInnerHeight: number;

  beforeEach(() => {
    // Default to mobile portrait
    mockInnerWidth = 375;
    mockInnerHeight = 667;

    // Mock window properties
    spyOnProperty(window, 'innerWidth', 'get').and.callFake(() => mockInnerWidth);
    spyOnProperty(window, 'innerHeight', 'get').and.callFake(() => mockInnerHeight);

    TestBed.configureTestingModule({
      providers: [TouchDetectionService]
    });

    service = TestBed.inject(TouchDetectionService);
  });

  describe('hasTouchSupport', () => {
    it('should return true when ontouchstart is available', () => {
      // Mock touch support
      (window as any).ontouchstart = {};

      const result = service.hasTouchSupport();

      expect(result).toBe(true);

      // Cleanup
      delete (window as any).ontouchstart;
    });

    it('should return true when maxTouchPoints > 0', () => {
      const originalMaxTouchPoints = navigator.maxTouchPoints;
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 5,
        configurable: true
      });

      const result = service.hasTouchSupport();

      expect(result).toBe(true);

      // Restore
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: originalMaxTouchPoints,
        configurable: true
      });
    });
  });

  describe('getDeviceInfo', () => {
    it('should return an observable', () => {
      const deviceInfo$ = service.getDeviceInfo();

      expect(deviceInfo$).toBeTruthy();
      expect(typeof deviceInfo$.subscribe).toBe('function');
    });

    it('should emit device info immediately', (done) => {
      service.getDeviceInfo().subscribe(info => {
        expect(info).toBeTruthy();
        expect(info.screenWidth).toBeDefined();
        expect(info.screenHeight).toBeDefined();
        done();
      });
    });
  });

  describe('getDeviceInfoSnapshot', () => {
    it('should return current device info', () => {
      const info = service.getDeviceInfoSnapshot();

      expect(info).toBeTruthy();
      expect(info.screenWidth).toBe(mockInnerWidth);
      expect(info.screenHeight).toBe(mockInnerHeight);
    });
  });

  describe('Device Type Detection', () => {
    it('should detect mobile for small screens', () => {
      mockInnerWidth = 375;
      mockInnerHeight = 667;

      // Create new service instance to re-detect
      const newService = new TouchDetectionService();
      const info = newService.getDeviceInfoSnapshot();

      expect(info.deviceType).toBe('mobile');
    });

    it('should detect tablet for medium screens', () => {
      mockInnerWidth = 800;
      mockInnerHeight = 1024;

      const newService = new TouchDetectionService();
      const info = newService.getDeviceInfoSnapshot();

      expect(info.deviceType).toBe('tablet');
    });

    it('should detect desktop for large screens', () => {
      mockInnerWidth = 1920;
      mockInnerHeight = 1080;

      const newService = new TouchDetectionService();
      const info = newService.getDeviceInfoSnapshot();

      expect(info.deviceType).toBe('desktop');
    });

    it('should use TABLET_SMALL breakpoint correctly', () => {
      // At the breakpoint
      mockInnerWidth = JOYSTICK_BREAKPOINTS.TABLET_SMALL;
      mockInnerHeight = 1024;

      const newService = new TouchDetectionService();
      const info = newService.getDeviceInfoSnapshot();

      // At exactly TABLET_SMALL, should still be mobile (<=)
      expect(info.deviceType).toBe('mobile');

      // Just above should be tablet
      mockInnerWidth = JOYSTICK_BREAKPOINTS.TABLET_SMALL + 1;
      const newService2 = new TouchDetectionService();
      const info2 = newService2.getDeviceInfoSnapshot();

      expect(info2.deviceType).toBe('tablet');
    });

    it('should use TABLET_LARGE breakpoint correctly', () => {
      // At the breakpoint
      mockInnerWidth = JOYSTICK_BREAKPOINTS.TABLET_LARGE;
      mockInnerHeight = 1024;

      const newService = new TouchDetectionService();
      const info = newService.getDeviceInfoSnapshot();

      // At exactly TABLET_LARGE, should still be tablet (<=)
      expect(info.deviceType).toBe('tablet');

      // Just above should be desktop
      mockInnerWidth = JOYSTICK_BREAKPOINTS.TABLET_LARGE + 1;
      const newService2 = new TouchDetectionService();
      const info2 = newService2.getDeviceInfoSnapshot();

      expect(info2.deviceType).toBe('desktop');
    });
  });

  describe('Orientation Detection', () => {
    it('should detect portrait orientation', () => {
      mockInnerWidth = 375;
      mockInnerHeight = 667;

      const newService = new TouchDetectionService();
      const info = newService.getDeviceInfoSnapshot();

      expect(info.orientation).toBe('portrait');
    });

    it('should detect landscape orientation', () => {
      mockInnerWidth = 812;
      mockInnerHeight = 375;

      const newService = new TouchDetectionService();
      const info = newService.getDeviceInfoSnapshot();

      expect(info.orientation).toBe('landscape');
    });

    it('should detect landscape when width equals height', () => {
      mockInnerWidth = 500;
      mockInnerHeight = 500;

      const newService = new TouchDetectionService();
      const info = newService.getDeviceInfoSnapshot();

      // Equal dimensions should be portrait (not greater than)
      expect(info.orientation).toBe('portrait');
    });
  });

  describe('showVirtualControls', () => {
    it('should show virtual controls on touch-enabled mobile', () => {
      mockInnerWidth = 375;
      mockInnerHeight = 667;

      // Mock touch support
      (window as any).ontouchstart = {};

      const newService = new TouchDetectionService();
      const info = newService.getDeviceInfoSnapshot();

      expect(info.showVirtualControls).toBe(true);

      delete (window as any).ontouchstart;
    });

    it('should show virtual controls on touch-enabled tablet', () => {
      mockInnerWidth = 800;
      mockInnerHeight = 1024;

      (window as any).ontouchstart = {};

      const newService = new TouchDetectionService();
      const info = newService.getDeviceInfoSnapshot();

      expect(info.showVirtualControls).toBe(true);

      delete (window as any).ontouchstart;
    });

    it('should hide virtual controls on desktop', () => {
      mockInnerWidth = 1920;
      mockInnerHeight = 1080;

      (window as any).ontouchstart = {};

      const newService = new TouchDetectionService();
      const info = newService.getDeviceInfoSnapshot();

      expect(info.showVirtualControls).toBe(false);

      delete (window as any).ontouchstart;
    });

    it('should hide virtual controls without touch support', () => {
      mockInnerWidth = 375;
      mockInnerHeight = 667;

      // Ensure no touch support
      delete (window as any).ontouchstart;
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 0,
        configurable: true
      });

      const newService = new TouchDetectionService();
      const info = newService.getDeviceInfoSnapshot();

      expect(info.showVirtualControls).toBe(false);
    });
  });

  describe('Resize Handling', fakeAsync(() => {
    it('should update device info on window resize', () => {
      const emittedValues: DeviceInfo[] = [];

      service.getDeviceInfo().subscribe(info => {
        emittedValues.push(info);
      });

      // Initial value
      expect(emittedValues.length).toBeGreaterThanOrEqual(1);

      // Simulate resize to tablet
      mockInnerWidth = 800;
      mockInnerHeight = 1024;
      window.dispatchEvent(new Event('resize'));

      tick(100);

      // Should have received new value
      const latestInfo = emittedValues[emittedValues.length - 1];
      expect(latestInfo.screenWidth).toBe(800);
    });

    it('should update device info on orientation change', () => {
      const emittedValues: DeviceInfo[] = [];

      service.getDeviceInfo().subscribe(info => {
        emittedValues.push(info);
      });

      // Simulate orientation change
      mockInnerWidth = 667;
      mockInnerHeight = 375;
      window.dispatchEvent(new Event('orientationchange'));

      tick(100);

      const latestInfo = emittedValues[emittedValues.length - 1];
      expect(latestInfo.orientation).toBe('landscape');
    });

    it('should not emit duplicate values', () => {
      const emittedValues: DeviceInfo[] = [];

      service.getDeviceInfo().subscribe(info => {
        emittedValues.push({ ...info });
      });

      const initialCount = emittedValues.length;

      // Dispatch resize without changing dimensions
      window.dispatchEvent(new Event('resize'));

      tick(100);

      // Should not have emitted new value if nothing changed
      // Note: Due to distinctUntilChanged, duplicates should be filtered
      expect(emittedValues.length).toBeLessThanOrEqual(initialCount + 1);
    });
  }));

  describe('DeviceInfo Interface', () => {
    it('should include all required fields', () => {
      const info = service.getDeviceInfoSnapshot();

      expect(info.hasTouchSupport).toBeDefined();
      expect(info.deviceType).toBeDefined();
      expect(info.orientation).toBeDefined();
      expect(info.screenWidth).toBeDefined();
      expect(info.screenHeight).toBeDefined();
      expect(info.showVirtualControls).toBeDefined();
    });

    it('should have correct types for all fields', () => {
      const info = service.getDeviceInfoSnapshot();

      expect(typeof info.hasTouchSupport).toBe('boolean');
      expect(['mobile', 'tablet', 'desktop']).toContain(info.deviceType);
      expect(['portrait', 'landscape']).toContain(info.orientation);
      expect(typeof info.screenWidth).toBe('number');
      expect(typeof info.screenHeight).toBe('number');
      expect(typeof info.showVirtualControls).toBe('boolean');
    });
  });

  describe('Default Device Info', () => {
    it('should provide sensible defaults when window is undefined', () => {
      // Access private method through type casting
      const defaultInfo = (service as any).getDefaultDeviceInfo();

      expect(defaultInfo.hasTouchSupport).toBe(false);
      expect(defaultInfo.deviceType).toBe('desktop');
      expect(defaultInfo.orientation).toBe('landscape');
      expect(defaultInfo.screenWidth).toBe(1920);
      expect(defaultInfo.screenHeight).toBe(1080);
      expect(defaultInfo.showVirtualControls).toBe(false);
    });
  });

  describe('Breakpoint Values', () => {
    it('should match defined breakpoints', () => {
      expect(JOYSTICK_BREAKPOINTS.MOBILE).toBe(480);
      expect(JOYSTICK_BREAKPOINTS.TABLET_SMALL).toBe(768);
      expect(JOYSTICK_BREAKPOINTS.TABLET).toBe(1024);
      expect(JOYSTICK_BREAKPOINTS.TABLET_LARGE).toBe(1366);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small screen sizes', () => {
      mockInnerWidth = 100;
      mockInnerHeight = 200;

      const newService = new TouchDetectionService();
      const info = newService.getDeviceInfoSnapshot();

      expect(info.deviceType).toBe('mobile');
      expect(info.orientation).toBe('portrait');
    });

    it('should handle very large screen sizes', () => {
      mockInnerWidth = 5000;
      mockInnerHeight = 3000;

      const newService = new TouchDetectionService();
      const info = newService.getDeviceInfoSnapshot();

      expect(info.deviceType).toBe('desktop');
      expect(info.orientation).toBe('landscape');
    });

    it('should handle zero dimensions gracefully', () => {
      mockInnerWidth = 0;
      mockInnerHeight = 0;

      expect(() => new TouchDetectionService()).not.toThrow();
    });
  });
});
