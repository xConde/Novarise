import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { GameInputService } from './game-input.service';

/** Minimal OrbitControls stub — only the fields updateCameraPan touches. */
class StubOrbitControls {
  target = new THREE.Vector3();
}

function makeCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  cam.position.set(0, 20, 20);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

describe('GameInputService', () => {
  let service: GameInputService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GameInputService],
    });
    service = TestBed.inject(GameInputService);
  });

  afterEach(() => {
    // Guard: complete hotkey$ if it hasn't been already (avoids open subscription warnings)
    try { service.cleanup(); } catch { /* already cleaned */ }
  });

  // -----------------------------------------------------------------------
  // init() — listener registration
  // -----------------------------------------------------------------------

  describe('init()', () => {
    it('registers a keydown listener on window', () => {
      spyOn(window, 'addEventListener').and.callThrough();
      service.init();

      const calls: readonly unknown[][] = (window.addEventListener as jasmine.Spy).calls.allArgs();
      expect(calls.some(args => args[0] === 'keydown')).toBeTrue();
      service.cleanup();
    });

    it('registers a keyup listener on window', () => {
      spyOn(window, 'addEventListener').and.callThrough();
      service.init();

      const calls: readonly unknown[][] = (window.addEventListener as jasmine.Spy).calls.allArgs();
      expect(calls.some(args => args[0] === 'keyup')).toBeTrue();
      service.cleanup();
    });
  });

  // -----------------------------------------------------------------------
  // cleanup() — listener removal
  // -----------------------------------------------------------------------

  describe('cleanup()', () => {
    it('removes the keydown listener from window', () => {
      service.init();
      spyOn(window, 'removeEventListener').and.callThrough();
      service.cleanup();

      const calls: readonly unknown[][] = (window.removeEventListener as jasmine.Spy).calls.allArgs();
      expect(calls.some(args => args[0] === 'keydown')).toBeTrue();
    });

    it('removes the keyup listener from window', () => {
      service.init();
      spyOn(window, 'removeEventListener').and.callThrough();
      service.cleanup();

      const calls: readonly unknown[][] = (window.removeEventListener as jasmine.Spy).calls.allArgs();
      expect(calls.some(args => args[0] === 'keyup')).toBeTrue();
    });

    it('completes hotkey$', () => {
      service.init();
      let completed = false;
      service.hotkey$.subscribe({ complete: () => (completed = true) });
      service.cleanup();
      expect(completed).toBeTrue();
    });
  });

  // -----------------------------------------------------------------------
  // hotkey$ — event emission
  // -----------------------------------------------------------------------

  describe('hotkey$', () => {
    it('emits every keydown event including non-pan keys', () => {
      service.init();

      const received: KeyboardEvent[] = [];
      const sub = service.hotkey$.subscribe(e => received.push(e));

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));

      expect(received.length).toBe(2);
      expect(received[0].key).toBe('p');
      expect(received[1].key).toBe('1');

      sub.unsubscribe();
      service.cleanup();
    });

    it('does not emit after cleanup()', () => {
      service.init();

      const received: KeyboardEvent[] = [];
      service.hotkey$.subscribe({ next: e => received.push(e), complete: () => {} });

      service.cleanup();
      // Dispatch after cleanup — should NOT arrive (handlers removed and subject completed)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));

      expect(received.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // updateCameraPan() — camera movement
  // -----------------------------------------------------------------------

  describe('updateCameraPan()', () => {
    it('does nothing when no pan keys are held', () => {
      service.init();
      const camera = makeCamera();
      const controls = new StubOrbitControls();
      const beforeX = camera.position.x;
      const beforeZ = camera.position.z;

      service.updateCameraPan(camera, controls as unknown as import('three/examples/jsm/controls/OrbitControls').OrbitControls);

      expect(camera.position.x).toBe(beforeX);
      expect(camera.position.z).toBe(beforeZ);
      service.cleanup();
    });

    it('moves camera forward when W is held', () => {
      service.init();
      const camera = makeCamera();
      const controls = new StubOrbitControls();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));

      const beforeZ = camera.position.z;
      service.updateCameraPan(camera, controls as unknown as import('three/examples/jsm/controls/OrbitControls').OrbitControls);

      // Camera was looking toward negative Z; W = forward = z should decrease
      expect(camera.position.z).toBeLessThan(beforeZ);
      service.cleanup();
    });

    it('moves camera backward when S is held', () => {
      service.init();
      const camera = makeCamera();
      const controls = new StubOrbitControls();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));

      const beforeZ = camera.position.z;
      service.updateCameraPan(camera, controls as unknown as import('three/examples/jsm/controls/OrbitControls').OrbitControls);

      expect(camera.position.z).toBeGreaterThan(beforeZ);
      service.cleanup();
    });

    it('moves OrbitControls target by the same delta as the camera', () => {
      service.init();
      const camera = makeCamera();
      const controls = new StubOrbitControls();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));

      const camBeforeX = camera.position.x;
      const tgtBeforeX = controls.target.x;

      service.updateCameraPan(camera, controls as unknown as import('three/examples/jsm/controls/OrbitControls').OrbitControls);

      const camDelta = camera.position.x - camBeforeX;
      const tgtDelta = controls.target.x - tgtBeforeX;

      expect(camDelta).toBeCloseTo(tgtDelta, 5);
      service.cleanup();
    });

    it('stops moving after keyup clears the pan key', () => {
      service.init();
      const camera = makeCamera();
      const controls = new StubOrbitControls();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true }));

      const beforeZ = camera.position.z;
      service.updateCameraPan(camera, controls as unknown as import('three/examples/jsm/controls/OrbitControls').OrbitControls);

      expect(camera.position.z).toBe(beforeZ);
      service.cleanup();
    });

    it('supports ArrowUp as equivalent to W', () => {
      service.init();
      const camera = makeCamera();
      const controls = new StubOrbitControls();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

      const beforeZ = camera.position.z;
      service.updateCameraPan(camera, controls as unknown as import('three/examples/jsm/controls/OrbitControls').OrbitControls);

      expect(camera.position.z).toBeLessThan(beforeZ);
      service.cleanup();
    });
  });

  // -----------------------------------------------------------------------
  // ngOnDestroy — delegates to cleanup
  // -----------------------------------------------------------------------

  describe('ngOnDestroy()', () => {
    it('calls cleanup()', () => {
      spyOn(service, 'cleanup');
      service.ngOnDestroy();
      expect(service.cleanup).toHaveBeenCalled();
    });
  });
});
