import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { CombatVFXService } from './combat-vfx.service';
import { CHAIN_LIGHTNING_CONFIG } from '../constants/combat.constants';

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
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene);
      expect(service.getChainArcCount()).toBe(1);
    });

    it('should add the arc line to the scene', () => {
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene);
      expect(mockScene.children.length).toBe(1);
      expect(mockScene.children[0]).toBeInstanceOf(THREE.Line);
    });

    it('should create zigzagSegments + 1 vertices', () => {
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene);
      const arcs = service.getChainArcs();
      const posAttr = arcs[0].line.geometry.getAttribute('position');
      expect(posAttr.count).toBe(CHAIN_LIGHTNING_CONFIG.zigzagSegments + 1);
    });

    it('should set first endpoint to (fromX, _, fromZ) without jitter', () => {
      service.createChainArc(2, 3, 5, 7, 0xffffff, mockScene);
      const arcs = service.getChainArcs();
      const posAttr = arcs[0].line.geometry.getAttribute('position');
      expect(posAttr.getX(0)).toBeCloseTo(2, 2);
      expect(posAttr.getZ(0)).toBeCloseTo(3, 2);
    });

    it('should set last endpoint to (toX, _, toZ) without jitter', () => {
      const segs = CHAIN_LIGHTNING_CONFIG.zigzagSegments;
      service.createChainArc(2, 3, 5, 7, 0xffffff, mockScene);
      const arcs = service.getChainArcs();
      const posAttr = arcs[0].line.geometry.getAttribute('position');
      expect(posAttr.getX(segs)).toBeCloseTo(5, 2);
      expect(posAttr.getZ(segs)).toBeCloseTo(7, 2);
    });

    it('should set expiresAt to performance.now() + arcLifetime * 1000', () => {
      const fakeNow = 10000;
      spyOn(performance, 'now').and.returnValue(fakeNow);
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene);
      const arcs = service.getChainArcs();
      expect(arcs[0].expiresAt).toBeCloseTo(fakeNow + CHAIN_LIGHTNING_CONFIG.arcLifetime * 1000, 0);
    });
  });

  // ---- createMortarZoneMesh ----

  describe('createMortarZoneMesh', () => {
    it('should return a Mesh', () => {
      const mesh = service.createMortarZoneMesh(0, 0, 1.5, 3, mockScene, 1);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
    });

    it('should add the mesh to the scene', () => {
      service.createMortarZoneMesh(0, 0, 1.5, 3, mockScene, 1);
      expect(mockScene.children.length).toBe(1);
    });

    it('should track the zone mesh internally', () => {
      service.createMortarZoneMesh(0, 0, 1.5, 3, mockScene, 1);
      expect(service.getMortarZoneMeshCount()).toBe(1);
    });

    it('should set expiresOnTurn to currentTurn + dotDuration', () => {
      // Zone created on turn 2 with dotDuration=5 → expiresOnTurn=7
      // Should still be alive at turn 6, gone at turn 7
      service.createMortarZoneMesh(0, 0, 1.5, 5, mockScene, 2);
      service.tickMortarZoneVisualsForTurn(6, mockScene);
      expect(service.getMortarZoneMeshCount()).toBe(1); // not yet expired
      service.tickMortarZoneVisualsForTurn(7, mockScene);
      expect(service.getMortarZoneMeshCount()).toBe(0); // expired
    });
  });

  // ---- updateVisuals (chain arcs only, real-time) ----

  describe('updateVisuals', () => {
    it('should remove expired chain arcs from scene and array', () => {
      const fakeNow = 5000;
      spyOn(performance, 'now').and.returnValue(fakeNow);
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene);
      expect(service.getChainArcCount()).toBe(1);

      // Advance time past arcLifetime (in ms)
      (performance.now as jasmine.Spy).and.returnValue(fakeNow + CHAIN_LIGHTNING_CONFIG.arcLifetime * 1000 + 10);
      service.updateVisuals(mockScene);

      expect(service.getChainArcCount()).toBe(0);
      expect(mockScene.children.length).toBe(0);
    });

    it('should keep non-expired chain arcs', () => {
      const fakeNow = 5000;
      spyOn(performance, 'now').and.returnValue(fakeNow);
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene);

      // Advance time to only half the lifetime
      (performance.now as jasmine.Spy).and.returnValue(fakeNow + CHAIN_LIGHTNING_CONFIG.arcLifetime * 500);
      service.updateVisuals(mockScene);

      expect(service.getChainArcCount()).toBe(1);
    });

    it('should not remove mortar zone meshes (those expire via tickMortarZoneVisualsForTurn)', () => {
      service.createMortarZoneMesh(0, 0, 1.5, 3, mockScene, 1);

      const fakeNow = 999999;
      spyOn(performance, 'now').and.returnValue(fakeNow);
      service.updateVisuals(mockScene);

      // Mortar zones should remain — updateVisuals only handles chain arcs
      expect(service.getMortarZoneMeshCount()).toBe(1);
    });
  });

  // ---- tickMortarZoneVisualsForTurn ----

  describe('tickMortarZoneVisualsForTurn', () => {
    it('should remove expired mortar zone meshes from scene and array', () => {
      service.createMortarZoneMesh(0, 0, 1.5, 3, mockScene, 0);
      expect(service.getMortarZoneMeshCount()).toBe(1);

      service.tickMortarZoneVisualsForTurn(3, mockScene);

      expect(service.getMortarZoneMeshCount()).toBe(0);
      expect(mockScene.children.length).toBe(0);
    });

    it('should keep non-expired mortar zones', () => {
      service.createMortarZoneMesh(0, 0, 1.5, 3, mockScene, 0);
      service.tickMortarZoneVisualsForTurn(2, mockScene);
      expect(service.getMortarZoneMeshCount()).toBe(1);
    });

    it('should handle multiple zones with different expiry turns', () => {
      service.createMortarZoneMesh(0, 0, 1.5, 2, mockScene, 0); // expires turn 2
      service.createMortarZoneMesh(1, 1, 1.5, 5, mockScene, 0); // expires turn 5
      expect(service.getMortarZoneMeshCount()).toBe(2);

      service.tickMortarZoneVisualsForTurn(2, mockScene);
      expect(service.getMortarZoneMeshCount()).toBe(1); // first expired, second still alive

      service.tickMortarZoneVisualsForTurn(5, mockScene);
      expect(service.getMortarZoneMeshCount()).toBe(0);
    });
  });

  // ---- cleanup ----

  describe('cleanup', () => {
    it('should remove all arcs and zone meshes from scene', () => {
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene);
      service.createMortarZoneMesh(3, 3, 1.5, 3, mockScene, 0);
      expect(mockScene.children.length).toBe(2);

      service.cleanup(mockScene);

      expect(mockScene.children.length).toBe(0);
    });

    it('should zero all internal arrays after cleanup', () => {
      service.createChainArc(0, 0, 1, 1, 0xffffff, mockScene);
      service.createMortarZoneMesh(0, 0, 1, 3, mockScene, 0);

      service.cleanup(mockScene);

      expect(service.getChainArcCount()).toBe(0);
      expect(service.getMortarZoneMeshCount()).toBe(0);
    });

    it('should be safe to call on empty service', () => {
      expect(() => service.cleanup(mockScene)).not.toThrow();
    });
  });
});
