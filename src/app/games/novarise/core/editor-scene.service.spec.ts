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

  describe('shadow map disposal', () => {
    it('dispose() clears shadow light after initLights()', () => {
      service.initScene();
      service.initLights();
      // Shadow light should exist after init
      const scene = service.getScene();
      const lightsBeforeDispose = scene.children.filter(
        (c: THREE.Object3D) => c instanceof THREE.DirectionalLight && (c as THREE.DirectionalLight).castShadow
      );
      expect(lightsBeforeDispose.length).toBe(1);

      service.dispose();

      // Shadow light should be removed from scene
      const lightsAfterDispose = scene.children.filter(
        (c: THREE.Object3D) => c instanceof THREE.DirectionalLight && (c as THREE.DirectionalLight).castShadow
      );
      expect(lightsAfterDispose.length).toBe(0);
    });
  });
});
