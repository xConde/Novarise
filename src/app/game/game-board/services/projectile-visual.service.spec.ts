import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { ProjectileVisualService } from './projectile-visual.service';
import { PROJECTILE_HITSCAN_CONFIG, PROJECTILE_BOLT_CONFIG } from '../constants/projectile.constants';

describe('ProjectileVisualService', () => {
  let service: ProjectileVisualService;
  let scene: THREE.Scene;

  /** Cast to the private shape so tests can inspect internal state. */
  interface TestableService {
    /** Unified discriminated-union entry list (replaces hitscanEntries). */
    entries: Array<{
      kind: 'hitscan' | 'bolt';
      // hitscan fields
      line?: THREE.Line;
      // bolt fields
      mesh?: THREE.Mesh;
      geo: THREE.BufferGeometry | THREE.SphereGeometry;
      mat: THREE.LineBasicMaterial | THREE.MeshBasicMaterial;
      age: number;
      scene: THREE.Scene;
      from?: THREE.Vector3;
      to?: THREE.Vector3;
    }>;
    isReduceMotion(): boolean;
  }

  function asTestable(): TestableService {
    return service as unknown as TestableService;
  }

  const FROM = new THREE.Vector3(0, 1, 0);
  const TO = new THREE.Vector3(5, 1, 0);
  const COLOR = 0xff4444;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ProjectileVisualService] });
    service = TestBed.inject(ProjectileVisualService);
    scene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup(scene);
    scene.clear();
  });

  // ── Creation ─────────────────────────────────────────────────────────────

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('fireHitscan', () => {
    it('adds a Line to the scene', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);

      const lines: THREE.Line[] = [];
      scene.traverse(obj => { if (obj instanceof THREE.Line) lines.push(obj); });
      expect(lines.length).toBe(1);
    });

    it('tracks the entry internally', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      expect(asTestable().entries.length).toBe(1);
    });

    it('creates entry with age 0', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      expect(asTestable().entries[0].age).toBe(0);
    });

    it('creates entry with initial opacity 0 (before first update)', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      expect(asTestable().entries[0].mat.opacity).toBe(0);
    });

    it('does NOT add a Line when body.reduce-motion class is present', () => {
      document.body.classList.add('reduce-motion');
      try {
        service.fireHitscan(FROM, TO, COLOR, scene);
        const lines: THREE.Line[] = [];
        scene.traverse(obj => { if (obj instanceof THREE.Line) lines.push(obj); });
        expect(lines.length).toBe(0);
      } finally {
        document.body.classList.remove('reduce-motion');
      }
    });

    it('does NOT track an entry when reduce-motion is active', () => {
      document.body.classList.add('reduce-motion');
      try {
        service.fireHitscan(FROM, TO, COLOR, scene);
        expect(asTestable().entries.length).toBe(0);
      } finally {
        document.body.classList.remove('reduce-motion');
      }
    });

    it('skips degenerate (zero-length) lines', () => {
      service.fireHitscan(FROM, FROM.clone(), COLOR, scene);
      expect(asTestable().entries.length).toBe(0);
    });

    it('skips when matchMedia prefers-reduced-motion is reduce', () => {
      const originalMatchMedia = window.matchMedia;
      // Temporarily stub matchMedia without body class.
      window.matchMedia = (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as MediaQueryList);
      try {
        service.fireHitscan(FROM, TO, COLOR, scene);
        expect(asTestable().entries.length).toBe(0);
      } finally {
        window.matchMedia = originalMatchMedia;
      }
    });
  });

  // ── Update / opacity ramp ─────────────────────────────────────────────────

  describe('update', () => {
    it('advances the age of in-flight entries', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      service.update(0.01);
      expect(asTestable().entries[0].age).toBeCloseTo(0.01);
    });

    it('opacity is > 0 after advancing past fade-in window', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      service.update(PROJECTILE_HITSCAN_CONFIG.fadeInSec + 0.001);
      const opacity = asTestable().entries[0].mat.opacity;
      expect(opacity).toBeGreaterThan(0);
    });

    it('opacity reaches 1 during the hold window', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      // Advance to middle of hold window.
      const midHold = (PROJECTILE_HITSCAN_CONFIG.fadeInSec + (PROJECTILE_HITSCAN_CONFIG.lifetimeSec - PROJECTILE_HITSCAN_CONFIG.fadeOutSec)) / 2;
      service.update(midHold);
      expect(asTestable().entries[0].mat.opacity).toBeCloseTo(1, 1);
    });

    it('removes expired entries from the scene', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      service.update(PROJECTILE_HITSCAN_CONFIG.lifetimeSec + 0.001);

      const lines: THREE.Line[] = [];
      scene.traverse(obj => { if (obj instanceof THREE.Line) lines.push(obj); });
      expect(lines.length).toBe(0);
    });

    it('removes expired entries from internal list', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      service.update(PROJECTILE_HITSCAN_CONFIG.lifetimeSec + 0.001);
      expect(asTestable().entries.length).toBe(0);
    });

    it('disposes geometry and material on expiry', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      const entry = asTestable().entries[0];
      const geoDisposeSpy = spyOn(entry.geo, 'dispose').and.callThrough();
      const matDisposeSpy = spyOn(entry.mat, 'dispose').and.callThrough();

      service.update(PROJECTILE_HITSCAN_CONFIG.lifetimeSec + 0.001);

      expect(geoDisposeSpy).toHaveBeenCalledTimes(1);
      expect(matDisposeSpy).toHaveBeenCalledTimes(1);
    });

    it('only removes expired entries; live entries remain', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      service.fireHitscan(FROM, TO, COLOR, scene);

      // Advance less than lifetime — both survive.
      service.update(PROJECTILE_HITSCAN_CONFIG.lifetimeSec - 0.01);
      expect(asTestable().entries.length).toBe(2);

      // Advance past lifetime — both expire.
      service.update(0.02);
      expect(asTestable().entries.length).toBe(0);
    });
  });

  // ── Cleanup ───────────────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('removes all in-flight entries from the scene', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      service.fireHitscan(FROM, TO, COLOR, scene);

      service.cleanup(scene);

      const lines: THREE.Line[] = [];
      scene.traverse(obj => { if (obj instanceof THREE.Line) lines.push(obj); });
      expect(lines.length).toBe(0);
    });

    it('clears the internal entry list', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      service.cleanup(scene);
      expect(asTestable().entries.length).toBe(0);
    });

    it('disposes geometry and material on cleanup', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      const entry = asTestable().entries[0];
      const geoDisposeSpy = spyOn(entry.geo, 'dispose').and.callThrough();
      const matDisposeSpy = spyOn(entry.mat, 'dispose').and.callThrough();

      service.cleanup(scene);

      expect(geoDisposeSpy).toHaveBeenCalledTimes(1);
      expect(matDisposeSpy).toHaveBeenCalledTimes(1);
    });

    it('is idempotent — calling cleanup twice does not throw', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      expect(() => {
        service.cleanup(scene);
        service.cleanup(scene);
      }).not.toThrow();
    });
  });

  // ── ngOnDestroy ───────────────────────────────────────────────────────────

  describe('ngOnDestroy', () => {
    it('calls cleanup to dispose all entries', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      const cleanupSpy = spyOn(service, 'cleanup').and.callThrough();

      service.ngOnDestroy();

      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('entry list is empty after ngOnDestroy', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      service.ngOnDestroy();
      expect(asTestable().entries.length).toBe(0);
    });
  });

  // ── fireBolt ──────────────────────────────────────────────────────────────

  describe('fireBolt', () => {
    it('adds a Mesh to the scene', () => {
      service.fireBolt(FROM, TO, COLOR, scene);

      const meshes: THREE.Mesh[] = [];
      scene.traverse(obj => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
      expect(meshes.length).toBe(1);
    });

    it('is a no-op when body.reduce-motion class is set', () => {
      document.body.classList.add('reduce-motion');
      try {
        service.fireBolt(FROM, TO, COLOR, scene);
        expect(asTestable().entries.length).toBe(0);
        const meshes: THREE.Mesh[] = [];
        scene.traverse(obj => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
        expect(meshes.length).toBe(0);
      } finally {
        document.body.classList.remove('reduce-motion');
      }
    });

    it('update advances bolt position toward `to` (mid-flight sample is between from and to)', () => {
      service.fireBolt(FROM, TO, COLOR, scene);
      const boltEntry = asTestable().entries[0];

      // Advance to exactly half the lifetime.
      service.update(PROJECTILE_BOLT_CONFIG.lifetimeSec / 2);

      const mesh = boltEntry.mesh as THREE.Mesh;
      // X should be between FROM.x (0) and TO.x (5).
      expect(mesh.position.x).toBeGreaterThan(FROM.x);
      expect(mesh.position.x).toBeLessThan(TO.x);
    });

    it('expires and removes the bolt from the scene when age >= lifetimeSec', () => {
      service.fireBolt(FROM, TO, COLOR, scene);

      service.update(PROJECTILE_BOLT_CONFIG.lifetimeSec + 0.001);

      const meshes: THREE.Mesh[] = [];
      scene.traverse(obj => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
      expect(meshes.length).toBe(0);
      expect(asTestable().entries.length).toBe(0);
    });

    it('disposes geometry and material on expiry', () => {
      service.fireBolt(FROM, TO, COLOR, scene);
      const entry = asTestable().entries[0];
      const geoDisposeSpy = spyOn(entry.geo, 'dispose').and.callThrough();
      const matDisposeSpy = spyOn(entry.mat, 'dispose').and.callThrough();

      service.update(PROJECTILE_BOLT_CONFIG.lifetimeSec + 0.001);

      expect(geoDisposeSpy).toHaveBeenCalledTimes(1);
      expect(matDisposeSpy).toHaveBeenCalledTimes(1);
    });

    it('cleanup disposes all bolt entries (geometry and material disposed)', () => {
      service.fireBolt(FROM, TO, COLOR, scene);
      const entry = asTestable().entries[0];
      const geoDisposeSpy = spyOn(entry.geo, 'dispose').and.callThrough();
      const matDisposeSpy = spyOn(entry.mat, 'dispose').and.callThrough();

      service.cleanup(scene);

      expect(geoDisposeSpy).toHaveBeenCalledTimes(1);
      expect(matDisposeSpy).toHaveBeenCalledTimes(1);
      expect(asTestable().entries.length).toBe(0);
    });
  });

  // ── Mixed idiom coexistence ───────────────────────────────────────────────

  describe('mixed hitscan + bolt entries', () => {
    it('both kinds coexist and both expire correctly', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      service.fireBolt(FROM, TO, COLOR, scene);

      expect(asTestable().entries.length).toBe(2);
      expect(asTestable().entries[0].kind).toBe('hitscan');
      expect(asTestable().entries[1].kind).toBe('bolt');

      // Advance past the longer of the two lifetimes.
      const maxLifetime = Math.max(
        PROJECTILE_HITSCAN_CONFIG.lifetimeSec,
        PROJECTILE_BOLT_CONFIG.lifetimeSec,
      );
      service.update(maxLifetime + 0.001);

      expect(asTestable().entries.length).toBe(0);

      const lines: THREE.Line[] = [];
      const meshes: THREE.Mesh[] = [];
      scene.traverse(obj => {
        if (obj instanceof THREE.Line) lines.push(obj);
        if (obj instanceof THREE.Mesh) meshes.push(obj);
      });
      expect(lines.length).toBe(0);
      expect(meshes.length).toBe(0);
    });
  });
});
