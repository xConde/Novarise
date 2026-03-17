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
});
