import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { GeometryRegistryService } from './geometry-registry.service';

describe('GeometryRegistryService', () => {
  let registry: GeometryRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [GeometryRegistryService] });
    registry = TestBed.inject(GeometryRegistryService);
  });

  afterEach(() => {
    registry.dispose();
  });

  describe('identity caching', () => {
    it('returns the same BoxGeometry instance for identical params', () => {
      const a = registry.getBox(1, 1, 1);
      const b = registry.getBox(1, 1, 1);
      expect(a).toBe(b);
    });

    it('returns different instances for different box params', () => {
      const a = registry.getBox(1, 1, 1);
      const b = registry.getBox(2, 1, 1);
      expect(a).not.toBe(b);
    });

    it('treats float params equal up to 4 decimal places as the same key', () => {
      const a = registry.getBox(1.5, 1, 1);
      const b = registry.getBox(1.5000001, 1, 1);
      expect(a).toBe(b);
    });

    it('caches sphere by radius + segments', () => {
      const a = registry.getSphere(0.5, 16, 16);
      const b = registry.getSphere(0.5, 16, 16);
      const c = registry.getSphere(0.5, 8, 8);
      expect(a).toBe(b);
      expect(a).not.toBe(c);
    });

    it('caches cylinder by all 4 params', () => {
      const a = registry.getCylinder(0.4, 0.4, 1, 12);
      const b = registry.getCylinder(0.4, 0.4, 1, 12);
      expect(a).toBe(b);
    });

    it('caches every primitive type independently (no cross-type collision)', () => {
      const box = registry.getBox(1, 1, 1);
      const sphere = registry.getSphere(1, 8, 8);
      const cyl = registry.getCylinder(1, 1, 1, 8);
      const cone = registry.getCone(1, 1, 8);
      const oct = registry.getOctahedron(1);
      const dod = registry.getDodecahedron(1);
      const ico = registry.getIcosahedron(1);
      const tet = registry.getTetrahedron(1);
      const torus = registry.getTorus(1, 0.4, 8, 16);
      const plane = registry.getPlane(1, 1);
      const circ = registry.getCircle(1, 16);

      const all = [box, sphere, cyl, cone, oct, dod, ico, tet, torus, plane, circ];
      const unique = new Set(all);
      expect(unique.size).toBe(all.length);
    });

    it('size() reflects unique cache entries', () => {
      expect(registry.size()).toBe(0);
      registry.getBox(1, 1, 1);
      registry.getBox(1, 1, 1); // duplicate, still 1
      registry.getBox(2, 1, 1); // distinct, 2
      registry.getSphere(0.5, 8, 8); // distinct, 3
      expect(registry.size()).toBe(3);
    });
  });

  describe('isRegisteredGeometry', () => {
    it('returns true for a geometry produced by the registry', () => {
      const g = registry.getBox(1, 1, 1);
      expect(registry.isRegisteredGeometry(g)).toBeTrue();
    });

    it('returns false for a geometry created outside the registry', () => {
      const g = new THREE.BoxGeometry(1, 1, 1);
      expect(registry.isRegisteredGeometry(g)).toBeFalse();
      g.dispose();
    });
  });

  describe('dispose', () => {
    it('disposes every cached geometry exactly once', () => {
      const g1 = registry.getBox(1, 1, 1);
      const g2 = registry.getSphere(0.5, 8, 8);
      spyOn(g1, 'dispose');
      spyOn(g2, 'dispose');

      registry.dispose();

      expect(g1.dispose).toHaveBeenCalledTimes(1);
      expect(g2.dispose).toHaveBeenCalledTimes(1);
    });

    it('clears the cache so subsequent gets allocate fresh', () => {
      const g1 = registry.getBox(1, 1, 1);
      registry.dispose();
      const g2 = registry.getBox(1, 1, 1);
      expect(g1).not.toBe(g2);
    });

    it('size() returns 0 after dispose', () => {
      registry.getBox(1, 1, 1);
      registry.getSphere(0.5, 8, 8);
      registry.dispose();
      expect(registry.size()).toBe(0);
    });

    it('is idempotent — second dispose() is a no-op', () => {
      registry.getBox(1, 1, 1);
      registry.dispose();
      expect(() => registry.dispose()).not.toThrow();
    });
  });
});
