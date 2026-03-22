import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TowerPreviewService } from './tower-preview.service';
import { TowerType, TOWER_CONFIGS, getEffectiveStats } from '../models/tower.model';
import { PREVIEW_CONFIG } from '../constants/preview.constants';

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

  // ---------------------------------------------------------------------------
  // showPreview — mesh creation
  // ---------------------------------------------------------------------------

  describe('showPreview', () => {
    it('adds two meshes to the scene', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      expect(scene.children.length).toBe(2);
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

    it('places range ring at ground offset y', () => {
      service.showPreview(TowerType.BASIC, 3, 7, true, scene);
      const ring = scene.children[1] as THREE.Mesh;
      expect(ring.position.y).toBeCloseTo(PREVIEW_CONFIG.groundOffset);
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

    it('range ring is transparent with correct opacity', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      const ring = scene.children[1] as THREE.Mesh;
      const material = ring.material as THREE.MeshBasicMaterial;
      expect(material.transparent).toBeTrue();
      expect(material.opacity).toBeCloseTo(PREVIEW_CONFIG.rangeRingOpacity);
    });

    it('range ring geometry outer radius matches tower level-1 range', () => {
      service.showPreview(TowerType.SNIPER, 5, 5, true, scene);
      const ring = scene.children[1] as THREE.Mesh;
      const geo = ring.geometry as THREE.RingGeometry;
      const expectedRange = getEffectiveStats(TowerType.SNIPER, 1).range;
      expect(geo.parameters.outerRadius).toBeCloseTo(expectedRange);
    });

    it('range ring inner radius is outerRadius minus rangeRingWidth', () => {
      service.showPreview(TowerType.SNIPER, 5, 5, true, scene);
      const ring = scene.children[1] as THREE.Mesh;
      const geo = ring.geometry as THREE.RingGeometry;
      expect(geo.parameters.innerRadius).toBeCloseTo(
        geo.parameters.outerRadius - PREVIEW_CONFIG.rangeRingWidth
      );
    });
  });

  // ---------------------------------------------------------------------------
  // showPreview — position update (reuse meshes)
  // ---------------------------------------------------------------------------

  describe('moving preview', () => {
    it('updates ghost position without adding new meshes', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      service.showPreview(TowerType.BASIC, 8, 3, true, scene);
      // Still only 2 children
      expect(scene.children.length).toBe(2);
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

    it('updates ring position to new tile (centered coords)', () => {
      service.setBoardSize(10, 10);
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      service.showPreview(TowerType.BASIC, 8, 3, true, scene);
      const ring = scene.children[1] as THREE.Mesh;
      expect(ring.position.x).toBe(-2);
      expect(ring.position.z).toBe(3);
    });

    it('validity color updates on subsequent call without tower type change', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      service.showPreview(TowerType.BASIC, 5, 5, false, scene);
      const ghost = scene.children[0] as THREE.Mesh;
      const material = ghost.material as THREE.MeshBasicMaterial;
      expect(material.color.getHex()).toBe(PREVIEW_CONFIG.invalidColor);
    });
  });

  // ---------------------------------------------------------------------------
  // Tower type change — recreate meshes
  // ---------------------------------------------------------------------------

  describe('changing tower type', () => {
    it('still has exactly 2 scene children after type change', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      service.showPreview(TowerType.SNIPER, 5, 5, true, scene);
      expect(scene.children.length).toBe(2);
    });

    it('new range ring reflects new tower range', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      service.showPreview(TowerType.SNIPER, 5, 5, true, scene);
      const ring = scene.children[1] as THREE.Mesh;
      const geo = ring.geometry as THREE.RingGeometry;
      const expectedRange = getEffectiveStats(TowerType.SNIPER, 1).range;
      expect(geo.parameters.outerRadius).toBeCloseTo(expectedRange);
    });

    it('new ghost uses new tower color', () => {
      service.showPreview(TowerType.BASIC, 5, 5, true, scene);
      service.showPreview(TowerType.SNIPER, 5, 5, true, scene);
      const ghost = scene.children[0] as THREE.Mesh;
      const material = ghost.material as THREE.MeshBasicMaterial;
      expect(material.color.getHex()).toBe(TOWER_CONFIGS[TowerType.SNIPER].color);
    });
  });

  // ---------------------------------------------------------------------------
  // hidePreview
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // cleanup — disposal
  // ---------------------------------------------------------------------------

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
      expect(scene.children.length).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Tower-specific range checks
  // ---------------------------------------------------------------------------

  describe('range ring matches tower range for each TowerType', () => {
    const towerTypes = [
      TowerType.BASIC,
      TowerType.SNIPER,
      TowerType.SPLASH,
      TowerType.SLOW,
      TowerType.CHAIN,
      TowerType.MORTAR,
    ];

    towerTypes.forEach((type) => {
      it(`range ring for ${type} uses level-1 range`, () => {
        service.showPreview(type, 5, 5, true, scene);
        const ring = scene.children[1] as THREE.Mesh;
        const geo = ring.geometry as THREE.RingGeometry;
        const expectedRange = getEffectiveStats(type, 1).range;
        expect(geo.parameters.outerRadius).toBeCloseTo(expectedRange);
        service.hidePreview(scene);
        service.cleanup();
        scene = new THREE.Scene();
      });
    });
  });
});
