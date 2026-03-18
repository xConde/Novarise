import { TestBed } from '@angular/core/testing';
import { SceneService } from './scene.service';

describe('SceneService', () => {
  let service: SceneService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SceneService] });
    service = TestBed.inject(SceneService);
  });

  it('creates without error', () => {
    expect(service).toBeTruthy();
  });

  describe('before any init', () => {
    it('dispose() does not throw when called before init', () => {
      expect(() => service.dispose()).not.toThrow();
    });

    it('dispose() is idempotent — can be called twice', () => {
      expect(() => {
        service.dispose();
        service.dispose();
      }).not.toThrow();
    });
  });

  describe('initScene / initCamera', () => {
    beforeEach(() => {
      service.initScene();
      service.initCamera();
    });

    afterEach(() => {
      service.dispose();
    });

    it('getScene() returns a scene after initScene()', () => {
      expect(service.getScene()).toBeTruthy();
    });

    it('getCamera() returns a camera after initCamera()', () => {
      expect(service.getCamera()).toBeTruthy();
    });
  });

  describe('disposeLights / disposeParticles / disposeSkybox', () => {
    beforeEach(() => {
      service.initScene();
      service.initCamera();
    });

    afterEach(() => {
      service.dispose();
    });

    it('disposeLights() does not throw when no lights exist', () => {
      expect(() => service.disposeLights()).not.toThrow();
    });

    it('disposeParticles() does not throw when no particles exist', () => {
      expect(() => service.disposeParticles()).not.toThrow();
    });

    it('disposeSkybox() does not throw when no skybox exists', () => {
      expect(() => service.disposeSkybox()).not.toThrow();
    });
  });

  describe('resize', () => {
    it('resize() updates camera aspect after initCamera (no renderer)', () => {
      service.initScene();
      service.initCamera();
      const camera = service.getCamera();
      service.resize(800, 400);
      // 800/400 = 2.0
      expect(camera.aspect).toBeCloseTo(2.0);
    });
  });

  describe('tickAmbientVisuals', () => {
    beforeEach(() => {
      service.initScene();
      service.initCamera();
    });

    afterEach(() => {
      service.dispose();
    });

    it('does not throw when particles and skybox are null (before init)', () => {
      expect(() => service.tickAmbientVisuals(1000)).not.toThrow();
    });

    it('updates particle positions after initParticles()', () => {
      service.initParticles();
      const particles = service.getParticles()!;
      const posAttr = particles.geometry.attributes['position'] as import('three').BufferAttribute;
      // Capture a snapshot of current Y values
      const before = Float32Array.from(posAttr.array as Float32Array);

      service.tickAmbientVisuals(1000);

      const after = posAttr.array as Float32Array;
      // At least some Y positions should have changed (index 1 is Y for first particle)
      let anyChanged = false;
      for (let i = 1; i < after.length; i += 3) {
        if (Math.abs(after[i] - before[i]) > 1e-9) { anyChanged = true; break; }
      }
      expect(anyChanged).toBeTrue();
    });

    it('does not throw when ticking particles a second time (needsUpdate assignment is safe)', () => {
      service.initParticles();
      // Call twice to confirm no error on repeated updates
      expect(() => {
        service.tickAmbientVisuals(1000);
        service.tickAmbientVisuals(2000);
      }).not.toThrow();
    });

    it('rotates particles around Y on each tick', () => {
      service.initParticles();
      const particles = service.getParticles()!;
      const rotationBefore = particles.rotation.y;

      service.tickAmbientVisuals(1000);

      expect(particles.rotation.y).not.toBeCloseTo(rotationBefore - 1, 5); // just check it changed
      expect(particles.rotation.y).toBeGreaterThan(rotationBefore); // positive increment
    });

    it('updates skybox time uniform after initSkybox()', () => {
      service.initSkybox();
      const skybox = service.getSkybox()!;
      const mat = skybox.material as import('three').ShaderMaterial;
      mat.uniforms['time'].value = 0;

      service.tickAmbientVisuals(2000);

      // time uniform should be 2000 * 0.001 = 2.0
      expect(mat.uniforms['time'].value).toBeCloseTo(2.0, 5);
    });

    it('handles time=0 without throwing', () => {
      service.initParticles();
      service.initSkybox();
      expect(() => service.tickAmbientVisuals(0)).not.toThrow();
    });
  });
});
