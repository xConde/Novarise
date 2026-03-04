import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { PathVisualizationService } from './path-visualization.service';
import { PATH_LINE_CONFIG } from '../constants/path.constants';

const SAMPLE_PATH = [
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: 2, z: 0 },
  { x: 2, z: 1 },
];

describe('PathVisualizationService', () => {
  let service: PathVisualizationService;
  let scene: THREE.Scene;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PathVisualizationService],
    });
    service = TestBed.inject(PathVisualizationService);
    scene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup();
    scene.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // showPath — line creation
  // ---------------------------------------------------------------------------

  describe('showPath', () => {
    it('adds exactly one object to the scene', () => {
      service.showPath(SAMPLE_PATH, scene);
      expect(scene.children.length).toBe(1);
    });

    it('adds a THREE.Line instance to the scene', () => {
      service.showPath(SAMPLE_PATH, scene);
      expect(scene.children[0]).toBeInstanceOf(THREE.Line);
    });

    it('positions the line at the configured y offset', () => {
      service.showPath(SAMPLE_PATH, scene);
      const line = scene.children[0] as THREE.Line;
      const positions = (line.geometry as THREE.BufferGeometry).attributes[
        'position'
      ] as THREE.BufferAttribute;
      // Check each point's y value
      for (let i = 0; i < positions.count; i++) {
        expect(positions.getY(i)).toBeCloseTo(PATH_LINE_CONFIG.yOffset);
      }
    });

    it('uses LineDashedMaterial with the configured color', () => {
      service.showPath(SAMPLE_PATH, scene);
      const line = scene.children[0] as THREE.Line;
      const mat = line.material as THREE.LineDashedMaterial;
      expect(mat).toBeInstanceOf(THREE.LineDashedMaterial);
      expect(mat.color.getHex()).toBe(PATH_LINE_CONFIG.color);
    });

    it('uses the configured dash and gap sizes', () => {
      service.showPath(SAMPLE_PATH, scene);
      const line = scene.children[0] as THREE.Line;
      const mat = line.material as THREE.LineDashedMaterial;
      expect(mat.dashSize).toBeCloseTo(PATH_LINE_CONFIG.dashSize);
      expect(mat.gapSize).toBeCloseTo(PATH_LINE_CONFIG.gapSize);
    });

    it('sets material transparent with correct opacity', () => {
      service.showPath(SAMPLE_PATH, scene);
      const line = scene.children[0] as THREE.Line;
      const mat = line.material as THREE.LineDashedMaterial;
      expect(mat.transparent).toBeTrue();
      expect(mat.opacity).toBeCloseTo(PATH_LINE_CONFIG.opacity);
    });

    it('geometry contains the same number of points as the path', () => {
      service.showPath(SAMPLE_PATH, scene);
      const line = scene.children[0] as THREE.Line;
      const positions = (line.geometry as THREE.BufferGeometry).attributes[
        'position'
      ] as THREE.BufferAttribute;
      expect(positions.count).toBe(SAMPLE_PATH.length);
    });

    it('maps path x/z coordinates to geometry positions', () => {
      service.showPath(SAMPLE_PATH, scene);
      const line = scene.children[0] as THREE.Line;
      const positions = (line.geometry as THREE.BufferGeometry).attributes[
        'position'
      ] as THREE.BufferAttribute;
      SAMPLE_PATH.forEach((p, i) => {
        expect(positions.getX(i)).toBeCloseTo(p.x);
        expect(positions.getZ(i)).toBeCloseTo(p.z);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // showPath — replaces previous line
  // ---------------------------------------------------------------------------

  describe('showPath called twice', () => {
    it('replaces the previous line — scene still has exactly one child', () => {
      service.showPath(SAMPLE_PATH, scene);
      service.showPath([{ x: 0, z: 0 }, { x: 3, z: 3 }], scene);
      expect(scene.children.length).toBe(1);
    });

    it('the replacement line reflects the new path length', () => {
      service.showPath(SAMPLE_PATH, scene);
      const newPath = [{ x: 0, z: 0 }, { x: 5, z: 0 }];
      service.showPath(newPath, scene);
      const line = scene.children[0] as THREE.Line;
      const positions = (line.geometry as THREE.BufferGeometry).attributes[
        'position'
      ] as THREE.BufferAttribute;
      expect(positions.count).toBe(newPath.length);
    });
  });

  // ---------------------------------------------------------------------------
  // hidePath
  // ---------------------------------------------------------------------------

  describe('hidePath', () => {
    it('removes the line from the scene', () => {
      service.showPath(SAMPLE_PATH, scene);
      service.hidePath(scene);
      expect(scene.children.length).toBe(0);
    });

    it('does not throw when called before showPath', () => {
      expect(() => service.hidePath(scene)).not.toThrow();
    });

    it('does not throw when called multiple times', () => {
      service.showPath(SAMPLE_PATH, scene);
      service.hidePath(scene);
      expect(() => service.hidePath(scene)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // cleanup — disposal
  // ---------------------------------------------------------------------------

  describe('cleanup', () => {
    it('does not throw when no path has been shown', () => {
      expect(() => service.cleanup()).not.toThrow();
    });

    it('can be called multiple times without error', () => {
      service.showPath(SAMPLE_PATH, scene);
      service.cleanup();
      expect(() => service.cleanup()).not.toThrow();
    });

    it('after cleanup, showPath still works', () => {
      service.showPath(SAMPLE_PATH, scene);
      service.hidePath(scene);
      service.cleanup();
      service.showPath(SAMPLE_PATH, scene);
      expect(scene.children.length).toBe(1);
    });
  });
});
