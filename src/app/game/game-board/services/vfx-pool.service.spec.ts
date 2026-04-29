import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { VfxPoolService } from './vfx-pool.service';
import { MaterialRegistryService } from './material-registry.service';
import { GeometryRegistryService } from './geometry-registry.service';

describe('VfxPoolService', () => {
  let pool: VfxPoolService;
  let materials: MaterialRegistryService;
  let geometries: GeometryRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VfxPoolService, MaterialRegistryService, GeometryRegistryService],
    });
    pool = TestBed.inject(VfxPoolService);
    materials = TestBed.inject(MaterialRegistryService);
    geometries = TestBed.inject(GeometryRegistryService);
  });

  afterEach(() => {
    pool.dispose();
    materials.dispose();
    geometries.dispose();
  });

  describe('chain arcs', () => {
    it('acquireArc returns a Line with a writable positions buffer', () => {
      const { line, positions, markPositionsDirty } = pool.acquireArc(8, 0xff0000, 0.6);
      expect(line).toBeInstanceOf(THREE.Line);
      expect(positions.length).toBe(8 * 3);
      // Position array writes through to the geometry attribute.
      positions[0] = 1;
      positions[1] = 2;
      positions[2] = 3;
      const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const versionBefore = attr.version;
      markPositionsDirty();
      expect(attr.array[0]).toBe(1);
      expect(attr.array[1]).toBe(2);
      expect(attr.array[2]).toBe(3);
      // needsUpdate is a setter that bumps `version`; assert the bump.
      expect(attr.version).toBeGreaterThan(versionBefore);
    });

    it('release puts the arc back; next acquire of same vertex count reuses it', () => {
      const a = pool.acquireArc(8, 0xff0000, 0.6);
      pool.releaseArc(a.line);
      expect(pool.arcFreeCount()).toBe(1);
      expect(pool.arcActiveCount()).toBe(0);

      const b = pool.acquireArc(8, 0x00ff00, 0.8);
      expect(b.line).toBe(a.line);
      expect(pool.arcFreeCount()).toBe(0);
      expect(pool.arcActiveCount()).toBe(1);
    });

    it('different vertex counts do NOT reuse — each gets its own pool slot', () => {
      const a = pool.acquireArc(8, 0xff0000, 0.6);
      pool.releaseArc(a.line);
      const b = pool.acquireArc(12, 0xff0000, 0.6);
      expect(b.line).not.toBe(a.line);
      // a's pooled entry stays in free until disposed.
      expect(pool.arcFreeCount()).toBe(1);
    });

    it('reused arc swaps material when color changes (registry shares per-color)', () => {
      const a = pool.acquireArc(8, 0xff0000, 0.6);
      const matA = a.line.material;
      pool.releaseArc(a.line);
      const b = pool.acquireArc(8, 0x00ff00, 0.6);
      const matB = b.line.material;
      expect(matB).not.toBe(matA);
      // Identical color request returns the cached material (registry).
      const c = pool.acquireArc(8, 0xff0000, 0.6);
      expect(c.line.material).toBe(matA);
    });

    it('release detaches arc from its parent', () => {
      const { line } = pool.acquireArc(8, 0xff0000, 0.6);
      const scene = new THREE.Scene();
      scene.add(line);
      pool.releaseArc(line);
      expect(line.parent).toBeNull();
    });
  });

  describe('mortar zones', () => {
    it('acquireZone returns a Mesh sharing geometry per radius', () => {
      const a = pool.acquireZone(2, 24, 0xff8800, 0.4);
      const b = pool.acquireZone(2, 24, 0xff8800, 0.4);
      expect(a.geometry).toBe(b.geometry); // GeometryRegistry-shared
      expect(a.material).toBe(b.material); // MaterialRegistry-shared
      expect(a).not.toBe(b);
    });

    it('release puts zone mesh back; next acquire recycles the Mesh + swaps geometry', () => {
      const a = pool.acquireZone(2, 24, 0xff8800, 0.4);
      const aOriginalGeom = a.geometry;
      pool.releaseZone(a);
      expect(pool.zoneFreeCount()).toBe(1);

      const b = pool.acquireZone(3, 24, 0xff8800, 0.4); // different radius
      expect(b).toBe(a); // same Mesh recycled
      // Geometry was swapped to a new (radius-3) registry-shared instance.
      expect(b.geometry).not.toBe(aOriginalGeom);
    });

    it('different colors hit different cached materials', () => {
      const a = pool.acquireZone(2, 24, 0xff8800, 0.4);
      const b = pool.acquireZone(2, 24, 0x0088ff, 0.4);
      expect(a.material).not.toBe(b.material);
    });
  });

  describe('dispose', () => {
    it('clears active + free pools', () => {
      const a = pool.acquireArc(8, 0xff0000, 0.6);
      const z = pool.acquireZone(2, 24, 0xff8800, 0.4);
      pool.releaseArc(a.line);
      // a in free, z in active
      pool.dispose();
      expect(pool.arcActiveCount()).toBe(0);
      expect(pool.arcFreeCount()).toBe(0);
      expect(pool.zoneActiveCount()).toBe(0);
      expect(pool.zoneFreeCount()).toBe(0);
    });

    it('detaches active arcs and zones from their parents', () => {
      const { line } = pool.acquireArc(8, 0xff0000, 0.6);
      const z = pool.acquireZone(2, 24, 0xff8800, 0.4);
      const scene = new THREE.Scene();
      scene.add(line);
      scene.add(z);
      pool.dispose();
      expect(line.parent).toBeNull();
      expect(z.parent).toBeNull();
    });

    it('disposes pooled arc BufferGeometries (active + free)', () => {
      const a = pool.acquireArc(8, 0xff0000, 0.6);
      const b = pool.acquireArc(12, 0xff0000, 0.6);
      pool.releaseArc(a.line);
      const aGeom = a.line.geometry;
      const bGeom = b.line.geometry;
      spyOn(aGeom, 'dispose');
      spyOn(bGeom, 'dispose');
      pool.dispose();
      expect(aGeom.dispose).toHaveBeenCalledTimes(1);
      expect(bGeom.dispose).toHaveBeenCalledTimes(1);
    });

    it('is idempotent', () => {
      pool.acquireArc(8, 0xff0000, 0.6);
      pool.dispose();
      expect(() => pool.dispose()).not.toThrow();
    });
  });
});
