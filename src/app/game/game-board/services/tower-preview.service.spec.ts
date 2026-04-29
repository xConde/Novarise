import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TowerPreviewService } from './tower-preview.service';
import { TowerType, TOWER_CONFIGS } from '../models/tower.model';
import { PREVIEW_CONFIG } from '../constants/preview.constants';

/**
 * Sprint UX-1: range ring rendering moved to RangeVisualizationService.
 * This service now owns ONLY the ghost-tower mesh.
 */
describe('TowerPreviewService', () => {
  let service: TowerPreviewService;
  let scene: THREE.Scene;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TowerPreviewService],
    });
    service = TestBed.inject(TowerPreviewService);
    scene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('showPreview — ghost mesh only (UX-1)', () => {
    it('adds exactly one mesh (ghost) to the scene', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      expect(scene.children.length).toBe(1);
    });

    it('places ghost mesh at the correct world position (centered)', () => {
      service.setBoardSize(10, 10);
      service.showPreview(TowerType.BASIC, 3, 7, true, scene);
      const ghost = scene.children[0] as THREE.Mesh;
      // col=7, boardWidth=10 → worldX = (7 - 5) = 2
      // row=3, boardHeight=10 → worldZ = (3 - 5) = -2
      expect(ghost.position.x).toBe(2);
      expect(ghost.position.z).toBe(-2);
    });

    it('uses tower color when placement is valid', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      const ghost = scene.children[0] as THREE.Mesh;
      const material = ghost.material as THREE.MeshBasicMaterial;
      expect(material.color.getHex()).toBe(TOWER_CONFIGS[TowerType.BASIC].color);
    });

    it('uses red color when placement is invalid', () => {
      service.showPreview(TowerType.BASIC, 5, 5, false, scene);
      const ghost = scene.children[0] as THREE.Mesh;
      const material = ghost.material as THREE.MeshBasicMaterial;
      expect(material.color.getHex()).toBe(PREVIEW_CONFIG.invalidColor);
    });

    it('ghost material is transparent with correct opacity', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      const ghost = scene.children[0] as THREE.Mesh;
      const material = ghost.material as THREE.MeshBasicMaterial;
      expect(material.transparent).toBeTrue();
      expect(material.opacity).toBeCloseTo(PREVIEW_CONFIG.ghostOpacity);
    });
  });

  describe('moving preview', () => {
    it('updates ghost position without adding new meshes', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      service.showPreview(TowerType.BASIC, 8, 3, true, scene);
      expect(scene.children.length).toBe(1);
    });

    it('updates ghost mesh position to new tile (centered coords)', () => {
      service.setBoardSize(10, 10);
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      service.showPreview(TowerType.BASIC, 8, 3, true, scene);
      const ghost = scene.children[0] as THREE.Mesh;
      // col=3, boardWidth=10 → worldX = (3 - 5) = -2
      expect(ghost.position.x).toBe(-2);
      // row=8, boardHeight=10 → worldZ = (8 - 5) = 3
      expect(ghost.position.z).toBe(3);
    });

    it('validity color updates on subsequent call without tower type change', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      service.showPreview(TowerType.BASIC, 5, 5, false, scene);
      const ghost = scene.children[0] as THREE.Mesh;
      const material = ghost.material as THREE.MeshBasicMaterial;
      expect(material.color.getHex()).toBe(PREVIEW_CONFIG.invalidColor);
    });
  });

  describe('changing tower type', () => {
    it('still has exactly 1 scene child after type change', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      service.showPreview(TowerType.SNIPER, 5, 5, true, scene);
      expect(scene.children.length).toBe(1);
    });

    it('new ghost uses new tower color', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      service.showPreview(TowerType.SNIPER, 5, 5, true, scene);
      const ghost = scene.children[0] as THREE.Mesh;
      const material = ghost.material as THREE.MeshBasicMaterial;
      expect(material.color.getHex()).toBe(TOWER_CONFIGS[TowerType.SNIPER].color);
    });
  });

  describe('hidePreview', () => {
    it('removes meshes from scene', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      service.hidePreview(scene);
      expect(scene.children.length).toBe(0);
    });

    it('does not throw when called with no active preview', () => {
      expect(() => service.hidePreview(scene)).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('does not throw when called with no active preview', () => {
      expect(() => service.cleanup()).not.toThrow();
    });

    it('can be called multiple times without error', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      service.cleanup();
      expect(() => service.cleanup()).not.toThrow();
    });

    it('after cleanup, showPreview still works', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      service.hidePreview(scene);
      service.cleanup();
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      expect(scene.children.length).toBe(1);
    });
  });
});
