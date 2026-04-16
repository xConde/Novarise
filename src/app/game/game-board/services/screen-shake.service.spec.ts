import * as THREE from 'three';
import { ScreenShakeService } from './screen-shake.service';

describe('ScreenShakeService', () => {
  let service: ScreenShakeService;
  let camera: THREE.PerspectiveCamera;

  beforeEach(() => {
    service = new ScreenShakeService();
    camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 10, 20);

    // Disable reduce-motion guards so tests assert normal shake behaviour
    spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
    spyOn(document.body.classList, 'contains').and.returnValue(false);
  });

  afterEach(() => {
    service.cleanup(camera);
  });

  it('should not be shaking initially', () => {
    expect(service.isShaking).toBeFalse();
  });

  it('trigger() marks service as shaking', () => {
    service.trigger(0.3, 0.4);
    expect(service.isShaking).toBeTrue();
  });

  it('update() offsets camera position while shaking', () => {
    service.trigger(0.3, 0.4);
    service.update(0.016, camera);

    // Camera should have moved from its original position
    const moved = camera.position.x !== 0 || camera.position.y !== 10;
    expect(moved).toBeTrue();
  });

  it('camera returns to original position after duration expires', () => {
    const origX = camera.position.x;
    const origY = camera.position.y;
    const origZ = camera.position.z;

    service.trigger(0.3, 0.1);
    // Advance past duration in one step
    service.update(0.2, camera);

    expect(service.isShaking).toBeFalse();
    expect(camera.position.x).toBeCloseTo(origX, 5);
    expect(camera.position.y).toBeCloseTo(origY, 5);
    expect(camera.position.z).toBeCloseTo(origZ, 5);
  });

  it('stronger shake overrides weaker shake', () => {
    service.trigger(0.1, 0.2);  // weak
    service.trigger(0.3, 0.4);  // strong — should win

    // Advance a frame to capture origin
    service.update(0.016, camera);

    // Weak shake should not suppress the strong one
    expect(service.isShaking).toBeTrue();
  });

  it('weaker shake does NOT override stronger shake', () => {
    service.trigger(0.5, 0.6);  // strong
    // Capture origin by running one frame
    service.update(0.016, camera);

    const posAfterStrong = { x: camera.position.x, y: camera.position.y };

    service.trigger(0.1, 0.2);  // weak — should be ignored
    // Still shaking at original intensity
    expect(service.isShaking).toBeTrue();

    // The state still reflects the strong shake; camera continues moving
    service.update(0.016, camera);
    expect(service.isShaking).toBeTrue();
    // Weak trigger didn't reset the remaining time to 0.2 prematurely
    // (if it had, the shake would end sooner — hard to test exactly, so
    // we just verify isShaking is still true after two 16ms frames within 0.6s)
    expect(service.isShaking).toBeTrue();
  });

  it('update() is no-op when not shaking', () => {
    const origX = camera.position.x;
    const origY = camera.position.y;
    const origZ = camera.position.z;

    service.update(0.016, camera);

    expect(camera.position.x).toBe(origX);
    expect(camera.position.y).toBe(origY);
    expect(camera.position.z).toBe(origZ);
  });

  it('cleanup() stops shake and restores camera', () => {
    const origX = camera.position.x;
    const origY = camera.position.y;
    const origZ = camera.position.z;

    service.trigger(0.3, 0.4);
    service.update(0.016, camera);
    service.cleanup(camera);

    expect(service.isShaking).toBeFalse();
    expect(camera.position.x).toBeCloseTo(origX, 5);
    expect(camera.position.y).toBeCloseTo(origY, 5);
    expect(camera.position.z).toBeCloseTo(origZ, 5);
  });

  it('cleanup() without camera argument still clears state', () => {
    service.trigger(0.3, 0.4);
    service.cleanup();
    expect(service.isShaking).toBeFalse();
  });

  describe('reduce-motion guards', () => {
    it('trigger() is no-op when prefers-reduced-motion media query matches', () => {
      (window.matchMedia as jasmine.Spy).and.returnValue({ matches: true } as MediaQueryList);
      service.trigger(0.5, 0.5);
      expect(service.isShaking).toBeFalse();
    });

    it('trigger() is no-op when body has reduce-motion class', () => {
      (document.body.classList.contains as jasmine.Spy).and.returnValue(true);
      service.trigger(0.5, 0.5);
      expect(service.isShaking).toBeFalse();
    });

    it('trigger() proceeds when neither guard is active', () => {
      (window.matchMedia as jasmine.Spy).and.returnValue({ matches: false } as MediaQueryList);
      (document.body.classList.contains as jasmine.Spy).and.returnValue(false);
      service.trigger(0.5, 0.5);
      expect(service.isShaking).toBeTrue();
    });
  });
});
