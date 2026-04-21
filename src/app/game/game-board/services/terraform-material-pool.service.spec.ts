import * as THREE from 'three';
import { TerraformMaterialPoolService } from './terraform-material-pool.service';
import { MutationOp } from './path-mutation.types';

describe('TerraformMaterialPoolService', () => {
  let service: TerraformMaterialPoolService;

  beforeEach(() => {
    service = new TerraformMaterialPoolService();
  });

  afterEach(() => {
    // Always dispose to prevent material leaks across tests.
    service.dispose();
  });

  // ── Identity (shared reference) ───────────────────────────────────────────

  describe('getMaterial — shared identity', () => {
    it('returns the same instance on repeated calls for build', () => {
      const a = service.getMaterial('build');
      const b = service.getMaterial('build');
      expect(a).toBe(b);
    });

    it('returns the same instance on repeated calls for block', () => {
      const a = service.getMaterial('block');
      const b = service.getMaterial('block');
      expect(a).toBe(b);
    });

    it('returns the same instance on repeated calls for destroy', () => {
      const a = service.getMaterial('destroy');
      const b = service.getMaterial('destroy');
      expect(a).toBe(b);
    });

    it('returns the same instance on repeated calls for bridgehead', () => {
      const a = service.getMaterial('bridgehead');
      const b = service.getMaterial('bridgehead');
      expect(a).toBe(b);
    });
  });

  // ── Distinct materials per op ─────────────────────────────────────────────

  describe('getMaterial — distinct per op', () => {
    it('all 4 ops return distinct material instances', () => {
      const ops: MutationOp[] = ['build', 'block', 'destroy', 'bridgehead'];
      const materials = ops.map(op => service.getMaterial(op));
      const unique = new Set(materials);
      expect(unique.size).toBe(4);
    });
  });

  // ── isPoolMaterial ────────────────────────────────────────────────────────

  describe('isPoolMaterial', () => {
    it('returns true for a material obtained via getMaterial(build)', () => {
      const mat = service.getMaterial('build');
      expect(service.isPoolMaterial(mat)).toBeTrue();
    });

    it('returns true for a material obtained via getMaterial(block)', () => {
      const mat = service.getMaterial('block');
      expect(service.isPoolMaterial(mat)).toBeTrue();
    });

    it('returns true for a material obtained via getMaterial(destroy)', () => {
      const mat = service.getMaterial('destroy');
      expect(service.isPoolMaterial(mat)).toBeTrue();
    });

    it('returns true for a material obtained via getMaterial(bridgehead)', () => {
      const mat = service.getMaterial('bridgehead');
      expect(service.isPoolMaterial(mat)).toBeTrue();
    });

    it('returns false for an externally-created material', () => {
      const external = new THREE.MeshStandardMaterial();
      expect(service.isPoolMaterial(external)).toBeFalse();
      external.dispose();
    });

    it('returns false for a base THREE.Material', () => {
      const base = new THREE.MeshBasicMaterial();
      expect(service.isPoolMaterial(base)).toBeFalse();
      base.dispose();
    });
  });

  // ── dispose — disposes all cached materials ───────────────────────────────

  describe('dispose', () => {
    it('calls dispose() on every cached material', () => {
      const ops: MutationOp[] = ['build', 'block', 'destroy', 'bridgehead'];
      const mats = ops.map(op => service.getMaterial(op));
      const spies = mats.map(m => spyOn(m, 'dispose').and.callThrough());

      service.dispose();

      spies.forEach(spy => expect(spy).toHaveBeenCalled());
    });

    it('resets cache — getMaterial returns a NEW instance after dispose', () => {
      const beforeDispose = service.getMaterial('build');
      service.dispose();
      const afterDispose = service.getMaterial('build');
      // Must be a different object (cache was cleared)
      expect(afterDispose).not.toBe(beforeDispose);
      // The new material is itself a pool material
      expect(service.isPoolMaterial(afterDispose)).toBeTrue();
      service.dispose();
    });

    it('returns false for the disposed instance after dispose', () => {
      const mat = service.getMaterial('block');
      service.dispose();
      // The old instance is no longer in the (now-empty) pool
      expect(service.isPoolMaterial(mat)).toBeFalse();
    });

    it('does not throw on repeated dispose calls', () => {
      service.getMaterial('build');
      expect(() => {
        service.dispose();
        service.dispose(); // second call — pool is empty, should be safe
      }).not.toThrow();
    });

    it('only disposes lazily-created materials (does not throw when pool is empty)', () => {
      // No getMaterial calls yet — pool is empty
      expect(() => service.dispose()).not.toThrow();
    });
  });

  // ── Color verification (spot check) ──────────────────────────────────────

  describe('material color values', () => {
    it('build material has teal-green color', () => {
      const mat = service.getMaterial('build');
      // THREE.Color stores values as [0..1] floats; compare hex
      expect(mat.color.getHex()).toBe(0x3fd18a);
    });

    it('block material has amber color', () => {
      const mat = service.getMaterial('block');
      expect(mat.color.getHex()).toBe(0xe8a033);
    });

    it('destroy material has ember-red color', () => {
      const mat = service.getMaterial('destroy');
      expect(mat.color.getHex()).toBe(0x8a2f1f);
    });

    it('bridgehead material has violet color', () => {
      const mat = service.getMaterial('bridgehead');
      expect(mat.color.getHex()).toBe(0x7c4dff);
    });
  });
});
