import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { CombatVFXService } from './combat-vfx.service';
import { CHAIN_LIGHTNING_CONFIG, IMPACT_FLASH_CONFIG } from '../constants/combat.constants';

describe('CombatVFXService', () => {
  let service: CombatVFXService;
  let mockScene: THREE.Scene;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CombatVFXService]
    });
    service = TestBed.inject(CombatVFXService);
    mockScene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup(mockScene);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---- createChainArc ----

  describe('createChainArc', () => {
    it('should add an arc line to chainArcs', () => {
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene, 0);
      expect(service.getChainArcCount()).toBe(1);
    });

    it('should add the arc line to the scene', () => {
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene, 0);
      expect(mockScene.children.length).toBe(1);
      expect(mockScene.children[0]).toBeInstanceOf(THREE.Line);
    });

    it('should create zigzagSegments + 1 vertices', () => {
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene, 0);
      const arcs = service.getChainArcs();
      const posAttr = arcs[0].line.geometry.getAttribute('position');
      expect(posAttr.count).toBe(CHAIN_LIGHTNING_CONFIG.zigzagSegments + 1);
    });

    it('should set first endpoint to (fromX, _, fromZ) without jitter', () => {
      service.createChainArc(2, 3, 5, 7, 0xffffff, mockScene, 0);
      const arcs = service.getChainArcs();
      const posAttr = arcs[0].line.geometry.getAttribute('position');
      expect(posAttr.getX(0)).toBeCloseTo(2, 2);
      expect(posAttr.getZ(0)).toBeCloseTo(3, 2);
    });

    it('should set last endpoint to (toX, _, toZ) without jitter', () => {
      const segs = CHAIN_LIGHTNING_CONFIG.zigzagSegments;
      service.createChainArc(2, 3, 5, 7, 0xffffff, mockScene, 0);
      const arcs = service.getChainArcs();
      const posAttr = arcs[0].line.geometry.getAttribute('position');
      expect(posAttr.getX(segs)).toBeCloseTo(5, 2);
      expect(posAttr.getZ(segs)).toBeCloseTo(7, 2);
    });

    it('should set expiresAt to gameTime + arcLifetime', () => {
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene, 5);
      const arcs = service.getChainArcs();
      expect(arcs[0].expiresAt).toBeCloseTo(5 + CHAIN_LIGHTNING_CONFIG.arcLifetime, 5);
    });
  });

  // ---- createImpactFlash ----

  describe('createImpactFlash', () => {
    it('should add a flash to impactFlashes', () => {
      service.createImpactFlash(0, 0, mockScene, 0);
      expect(service.getImpactFlashCount()).toBe(1);
    });

    it('should add the flash mesh to the scene', () => {
      service.createImpactFlash(0, 0, mockScene, 0);
      expect(mockScene.children.length).toBe(1);
      expect(mockScene.children[0]).toBeInstanceOf(THREE.Mesh);
    });

    it('should create flash with SphereGeometry', () => {
      service.createImpactFlash(0, 0, mockScene, 0);
      const flashes = service.getImpactFlashes();
      expect(flashes[0].mesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
    });

    it('should share the same SphereGeometry instance across multiple flashes', () => {
      service.createImpactFlash(0, 0, mockScene, 0);
      service.createImpactFlash(1, 1, mockScene, 0);
      const flashes = service.getImpactFlashes();
      expect(flashes.length).toBe(2);
      expect(flashes[0].mesh.geometry).toBe(flashes[1].mesh.geometry);
    });

    it('should set expiresAt to gameTime + lifetime', () => {
      service.createImpactFlash(0, 0, mockScene, 10);
      const flashes = service.getImpactFlashes();
      expect(flashes[0].expiresAt).toBeCloseTo(10 + IMPACT_FLASH_CONFIG.lifetime, 5);
    });
  });

  // ---- createMortarZoneMesh ----

  describe('createMortarZoneMesh', () => {
    it('should return a Mesh', () => {
      const mesh = service.createMortarZoneMesh(0, 0, 1.5, 3, mockScene, 0);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
    });

    it('should add the mesh to the scene', () => {
      service.createMortarZoneMesh(0, 0, 1.5, 3, mockScene, 0);
      expect(mockScene.children.length).toBe(1);
    });

    it('should track the zone mesh internally', () => {
      service.createMortarZoneMesh(0, 0, 1.5, 3, mockScene, 0);
      expect(service.getMortarZoneMeshCount()).toBe(1);
    });

    it('should set expiresAt to gameTime + dotDuration', () => {
      service.createMortarZoneMesh(0, 0, 1.5, 5, mockScene, 2);
      // expiresAt = gameTime + dotDuration = 2 + 5 = 7
      // We can't access it directly, but we verify it's removed after that time
      service.updateVisuals(6.9, mockScene);
      expect(service.getMortarZoneMeshCount()).toBe(1); // not yet expired
      service.updateVisuals(7.1, mockScene);
      expect(service.getMortarZoneMeshCount()).toBe(0); // expired
    });
  });

  // ---- updateVisuals ----

  describe('updateVisuals', () => {
    it('should remove expired chain arcs from scene and array', () => {
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene, 0);
      expect(service.getChainArcCount()).toBe(1);

      // Advance time past arcLifetime
      service.updateVisuals(CHAIN_LIGHTNING_CONFIG.arcLifetime + 0.01, mockScene);

      expect(service.getChainArcCount()).toBe(0);
      expect(mockScene.children.length).toBe(0);
    });

    it('should keep non-expired chain arcs', () => {
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene, 0);
      service.updateVisuals(CHAIN_LIGHTNING_CONFIG.arcLifetime * 0.5, mockScene);
      expect(service.getChainArcCount()).toBe(1);
    });

    it('should remove expired impact flashes from scene and array', () => {
      service.createImpactFlash(0, 0, mockScene, 0);
      expect(service.getImpactFlashCount()).toBe(1);

      service.updateVisuals(IMPACT_FLASH_CONFIG.lifetime + 0.01, mockScene);

      expect(service.getImpactFlashCount()).toBe(0);
      expect(mockScene.children.length).toBe(0);
    });

    it('should fade impact flashes proportionally over lifetime', () => {
      service.createImpactFlash(0, 0, mockScene, 0);
      // Advance to 50% of lifetime
      service.updateVisuals(IMPACT_FLASH_CONFIG.lifetime * 0.5, mockScene);

      const flashes = service.getImpactFlashes();
      const mat = flashes[0].mesh.material as THREE.MeshBasicMaterial;
      // Opacity should be ~50% of max opacity
      expect(mat.opacity).toBeCloseTo(IMPACT_FLASH_CONFIG.opacity * 0.5, 1);
    });

    it('should remove expired mortar zone meshes from scene and array', () => {
      service.createMortarZoneMesh(0, 0, 1.5, 3, mockScene, 0);
      expect(service.getMortarZoneMeshCount()).toBe(1);

      service.updateVisuals(3.01, mockScene);

      expect(service.getMortarZoneMeshCount()).toBe(0);
      expect(mockScene.children.length).toBe(0);
    });
  });

  // ---- cleanup ----

  describe('cleanup', () => {
    it('should remove all arcs, flashes, and zone meshes from scene', () => {
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene, 0);
      service.createImpactFlash(2, 2, mockScene, 0);
      service.createMortarZoneMesh(3, 3, 1.5, 3, mockScene, 0);
      expect(mockScene.children.length).toBe(3);

      service.cleanup(mockScene);

      expect(mockScene.children.length).toBe(0);
    });

    it('should zero all internal arrays after cleanup', () => {
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene, 0);
      service.createImpactFlash(0, 0, mockScene, 0);
      service.createMortarZoneMesh(0, 0, 1, 3, mockScene, 0);

      service.cleanup(mockScene);

      expect(service.getChainArcCount()).toBe(0);
      expect(service.getImpactFlashCount()).toBe(0);
      expect(service.getMortarZoneMeshCount()).toBe(0);
    });

    it('should dispose the shared flash geometry', () => {
      service.createImpactFlash(0, 0, mockScene, 0);
      const geomBefore = service.getSharedFlashGeometry();
      expect(geomBefore).not.toBeNull();

      service.cleanup(mockScene);

      expect(service.getSharedFlashGeometry()).toBeNull();
    });

    it('should be safe to call on empty service', () => {
      expect(() => service.cleanup(mockScene)).not.toThrow();
    });

    it('should re-create shared geometry on next createImpactFlash after cleanup', () => {
      service.createImpactFlash(0, 0, mockScene, 0);
      const geomBefore = service.getSharedFlashGeometry();

      service.cleanup(mockScene);

      // Create a new scene since the old one is cleared
      const scene2 = new THREE.Scene();
      service.createImpactFlash(0, 0, scene2, 1);
      const geomAfter = service.getSharedFlashGeometry();

      expect(geomAfter).not.toBeNull();
      expect(geomAfter).not.toBe(geomBefore);
      expect(geomAfter).toBeInstanceOf(THREE.SphereGeometry);

      service.cleanup(scene2);
    });
  });
});
