import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { EditorSceneService } from './editor-scene.service';

describe('EditorSceneService', () => {
  let service: EditorSceneService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EditorSceneService] });
    service = TestBed.inject(EditorSceneService);
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

    it('disposeParticles() does not throw when no particles exist', () => {
      expect(() => service.disposeParticles()).not.toThrow();
    });

    it('disposeSkybox() does not throw when no skybox exists', () => {
      expect(() => service.disposeSkybox()).not.toThrow();
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

    it('getParticles() returns null before initParticles()', () => {
      expect(service.getParticles()).toBeNull();
    });

    it('getSkybox() returns undefined before initSkybox()', () => {
      expect(service.getSkybox()).toBeUndefined();
    });
  });

  describe('initScene / initCamera / initParticles / initSkybox / initLights', () => {
    beforeEach(() => {
      service.initScene();
      service.initCamera();
    });

    afterEach(() => {
      service.dispose();
    });

    it('initParticles() adds particles to scene', () => {
      service.initParticles();
      expect(service.getParticles()).toBeTruthy();
    });

    it('initSkybox() sets skybox mesh', () => {
      service.initSkybox();
      expect(service.getSkybox()).toBeTruthy();
    });

    it('initLights() does not throw', () => {
      expect(() => service.initLights()).not.toThrow();
    });

    it('disposeParticles() clears particles after initParticles()', () => {
      service.initParticles();
      service.disposeParticles();
      expect(service.getParticles()).toBeNull();
    });

    it('disposeSkybox() clears skybox after initSkybox()', () => {
      service.initSkybox();
      service.disposeSkybox();
      expect(service.getSkybox()).toBeUndefined();
    });
  });

  describe('resize', () => {
    afterEach(() => {
      service.dispose();
    });

    it('resize() updates camera aspect after initCamera', () => {
      service.initScene();
      service.initCamera();
      const camera = service.getCamera();
      service.resize(800, 400);
      expect(camera.aspect).toBeCloseTo(2.0);
    });

    it('resize() does not throw when called before any init', () => {
      expect(() => service.resize(800, 600)).not.toThrow();
    });
  });

  describe('render', () => {
    it('render() does not throw when called before init', () => {
      expect(() => service.render()).not.toThrow();
    });
  });

  describe('light disposal (Phase A regression)', () => {
    it('dispose() clears shadow light after initLights()', () => {
      service.initScene();
      service.initLights();
      const scene = service.getScene();
      const shadowLightsBefore = scene.children.filter(
        (c: THREE.Object3D) => c instanceof THREE.DirectionalLight && (c as THREE.DirectionalLight).castShadow
      );
      expect(shadowLightsBefore.length).toBe(1);

      service.dispose();

      const shadowLightsAfter = scene.children.filter(
        (c: THREE.Object3D) => c instanceof THREE.DirectionalLight && (c as THREE.DirectionalLight).castShadow
      );
      expect(shadowLightsAfter.length).toBe(0);
    });

    it('dispose() removes ALL lights from the scene, not just the shadow light', () => {
      service.initScene();
      service.initLights();
      const scene = service.getScene();
      const lightsBefore = scene.children.filter((c: THREE.Object3D) => c instanceof THREE.Light);
      // The editor light rig: 1 ambient + 4 directional + 1 bottom directional + 1 hemi + N point.
      // Whatever the exact count, it should be > 1 (i.e. more than just the shadow light).
      expect(lightsBefore.length).toBeGreaterThan(1);

      service.dispose();

      const lightsAfter = scene.children.filter((c: THREE.Object3D) => c instanceof THREE.Light);
      expect(lightsAfter.length).toBe(0);
    });

    it('disposeLights() is callable directly and is idempotent', () => {
      service.initScene();
      service.initLights();
      expect(() => {
        service.disposeLights();
        service.disposeLights();
      }).not.toThrow();
      const scene = service.getScene();
      const lights = scene.children.filter((c: THREE.Object3D) => c instanceof THREE.Light);
      expect(lights.length).toBe(0);
    });
  });
});
