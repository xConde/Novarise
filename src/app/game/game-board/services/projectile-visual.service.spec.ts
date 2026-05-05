import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { ProjectileVisualService } from './projectile-visual.service';
import { PROJECTILE_HITSCAN_CONFIG, PROJECTILE_ARC_CONFIG, PROJECTILE_BOLT_CONFIG, PROJECTILE_SPLASH_CONFIG, PROJECTILE_AURA_CONFIG } from '../constants/projectile.constants';

describe('ProjectileVisualService', () => {
  let service: ProjectileVisualService;
  let scene: THREE.Scene;

  /** Cast to the private shape so tests can inspect internal state. */
  interface TestableService {
    /** Unified discriminated-union entry list (hitscan + bolt + arc + splash + aura). */
    entries: Array<{
      kind: 'hitscan' | 'bolt' | 'arc' | 'splash' | 'aura';
      // hitscan fields
      line?: THREE.Line;
      // bolt / arc / aura / hitscan shared — present on all non-splash kinds
      mesh?: THREE.Mesh;
      // geo and mat use broad types: present on hitscan/bolt/arc/aura, undefined on splash.
      // Callers must narrow via kind before use; tests that access these fields
      // only do so after firing non-splash idioms.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      geo: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mat: any;
      age: number;
      scene: THREE.Scene;
      from?: THREE.Vector3;
      to?: THREE.Vector3;
      // aura-only fields
      radius?: number;
      // splash-only fields
      sphereMesh?: THREE.Mesh;
      sphereGeo?: THREE.SphereGeometry;
      sphereMat?: THREE.MeshBasicMaterial;
      ringMesh?: THREE.Mesh;
      ringGeo?: THREE.RingGeometry;
      ringMat?: THREE.MeshBasicMaterial;
      splashRadius?: number;
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

  // ── fireArc ───────────────────────────────────────────────────────────────

  describe('fireArc', () => {
    it('adds a Mesh to the scene', () => {
      service.fireArc(FROM, TO, COLOR, scene);

      const meshes: THREE.Mesh[] = [];
      scene.traverse(obj => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
      expect(meshes.length).toBe(1);
    });

    it('is a no-op when body.reduce-motion class is set', () => {
      document.body.classList.add('reduce-motion');
      try {
        service.fireArc(FROM, TO, COLOR, scene);
        expect(asTestable().entries.length).toBe(0);
        const meshes: THREE.Mesh[] = [];
        scene.traverse(obj => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
        expect(meshes.length).toBe(0);
      } finally {
        document.body.classList.remove('reduce-motion');
      }
    });

    it('mid-flight position has elevated Y compared to linear-only interpolation (parabola is real)', () => {
      // FROM.y = 1, TO.y = 1 — linear baseline at t=0.5 is also y=1.
      // With arcApex=2.0 and the 4*t*(1-t) coefficient = 1.0 at t=0.5,
      // the arc mesh should sit at y = 1 + 2.0 = 3.0 at the midpoint.
      service.fireArc(FROM, TO, COLOR, scene);
      const entry = asTestable().entries[0];

      service.update(PROJECTILE_ARC_CONFIG.lifetimeSec / 2);

      const mesh = entry.mesh as THREE.Mesh;
      const linearBaselineY = FROM.y + (TO.y - FROM.y) * 0.5;
      expect(mesh.position.y).toBeGreaterThan(linearBaselineY);
    });

    it('expires and removes the arc mesh from the scene when age >= lifetimeSec', () => {
      service.fireArc(FROM, TO, COLOR, scene);

      service.update(PROJECTILE_ARC_CONFIG.lifetimeSec + 0.001);

      const meshes: THREE.Mesh[] = [];
      scene.traverse(obj => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
      expect(meshes.length).toBe(0);
      expect(asTestable().entries.length).toBe(0);
    });

    it('cleanup disposes arc geometry and material', () => {
      service.fireArc(FROM, TO, COLOR, scene);
      const entry = asTestable().entries[0];
      const geoDisposeSpy = spyOn(entry.geo, 'dispose').and.callThrough();
      const matDisposeSpy = spyOn(entry.mat, 'dispose').and.callThrough();

      service.cleanup(scene);

      expect(geoDisposeSpy).toHaveBeenCalledTimes(1);
      expect(matDisposeSpy).toHaveBeenCalledTimes(1);
      expect(asTestable().entries.length).toBe(0);
    });
  });

  // ── fireSplash ────────────────────────────────────────────────────────────

  describe('fireSplash', () => {
    const SPLASH_RADIUS = 1.5;

    it('adds exactly two Meshes to the scene (sphere + ring)', () => {
      service.fireSplash(FROM, TO, SPLASH_RADIUS, COLOR, scene);

      const meshes: THREE.Mesh[] = [];
      scene.traverse(obj => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
      expect(meshes.length).toBe(2);
    });

    it('tracks one entry internally with kind = splash', () => {
      service.fireSplash(FROM, TO, SPLASH_RADIUS, COLOR, scene);

      expect(asTestable().entries.length).toBe(1);
      expect(asTestable().entries[0].kind).toBe('splash');
    });

    it('is a no-op when body.reduce-motion class is set', () => {
      document.body.classList.add('reduce-motion');
      try {
        service.fireSplash(FROM, TO, SPLASH_RADIUS, COLOR, scene);
        expect(asTestable().entries.length).toBe(0);
        const meshes: THREE.Mesh[] = [];
        scene.traverse(obj => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
        expect(meshes.length).toBe(0);
      } finally {
        document.body.classList.remove('reduce-motion');
      }
    });

    it('during travel phase: sphere is visible and ring is hidden', () => {
      service.fireSplash(FROM, TO, SPLASH_RADIUS, COLOR, scene);
      // Advance to middle of travel phase — still in phase 1.
      service.update(PROJECTILE_SPLASH_CONFIG.travelLifetimeSec / 2);

      const entry = asTestable().entries[0];
      expect(entry.sphereMesh!.visible).toBe(true);
      expect(entry.ringMesh!.visible).toBe(false);
    });

    it('after travel phase ends: sphere hidden, ring visible', () => {
      service.fireSplash(FROM, TO, SPLASH_RADIUS, COLOR, scene);
      // Step past travelLifetimeSec into impact phase.
      service.update(PROJECTILE_SPLASH_CONFIG.travelLifetimeSec + 0.01);

      const entry = asTestable().entries[0];
      expect(entry.sphereMesh!.visible).toBe(false);
      expect(entry.ringMesh!.visible).toBe(true);
    });

    it('ring scale grows toward splashRadius during impact phase', () => {
      service.fireSplash(FROM, TO, SPLASH_RADIUS, COLOR, scene);
      // Advance to midpoint of impact phase.
      const midImpact = PROJECTILE_SPLASH_CONFIG.travelLifetimeSec
        + PROJECTILE_SPLASH_CONFIG.impactLifetimeSec / 2;
      service.update(midImpact);

      const entry = asTestable().entries[0];
      const scale = entry.ringMesh!.scale.x;
      // At p=0.5, scale = splashRadius * 0.5.
      expect(scale).toBeGreaterThan(0);
      expect(scale).toBeLessThan(SPLASH_RADIUS);
    });

    it('expires and removes both meshes from the scene at total lifetime', () => {
      service.fireSplash(FROM, TO, SPLASH_RADIUS, COLOR, scene);
      const totalLifetime = PROJECTILE_SPLASH_CONFIG.travelLifetimeSec
        + PROJECTILE_SPLASH_CONFIG.impactLifetimeSec;
      service.update(totalLifetime + 0.001);

      const meshes: THREE.Mesh[] = [];
      scene.traverse(obj => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
      expect(meshes.length).toBe(0);
      expect(asTestable().entries.length).toBe(0);
    });

    it('disposes sphere geo+mat AND ring geo+mat on expiry', () => {
      service.fireSplash(FROM, TO, SPLASH_RADIUS, COLOR, scene);
      const entry = asTestable().entries[0];
      const sphereGeoSpy = spyOn(entry.sphereGeo!, 'dispose').and.callThrough();
      const sphereMatSpy = spyOn(entry.sphereMat!, 'dispose').and.callThrough();
      const ringGeoSpy   = spyOn(entry.ringGeo!,   'dispose').and.callThrough();
      const ringMatSpy   = spyOn(entry.ringMat!,   'dispose').and.callThrough();

      const totalLifetime = PROJECTILE_SPLASH_CONFIG.travelLifetimeSec
        + PROJECTILE_SPLASH_CONFIG.impactLifetimeSec;
      service.update(totalLifetime + 0.001);

      expect(sphereGeoSpy).toHaveBeenCalledTimes(1);
      expect(sphereMatSpy).toHaveBeenCalledTimes(1);
      expect(ringGeoSpy).toHaveBeenCalledTimes(1);
      expect(ringMatSpy).toHaveBeenCalledTimes(1);
    });

    it('cleanup disposes both sphere and ring meshes (all 4 resources freed)', () => {
      service.fireSplash(FROM, TO, SPLASH_RADIUS, COLOR, scene);
      const entry = asTestable().entries[0];
      const sphereGeoSpy = spyOn(entry.sphereGeo!, 'dispose').and.callThrough();
      const sphereMatSpy = spyOn(entry.sphereMat!, 'dispose').and.callThrough();
      const ringGeoSpy   = spyOn(entry.ringGeo!,   'dispose').and.callThrough();
      const ringMatSpy   = spyOn(entry.ringMat!,   'dispose').and.callThrough();

      service.cleanup(scene);

      expect(sphereGeoSpy).toHaveBeenCalledTimes(1);
      expect(sphereMatSpy).toHaveBeenCalledTimes(1);
      expect(ringGeoSpy).toHaveBeenCalledTimes(1);
      expect(ringMatSpy).toHaveBeenCalledTimes(1);
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

  describe('mixed hitscan + bolt + arc entries', () => {
    it('all three kinds coexist and all expire correctly', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      service.fireBolt(FROM, TO, COLOR, scene);
      service.fireArc(FROM, TO, COLOR, scene);

      expect(asTestable().entries.length).toBe(3);
      expect(asTestable().entries[0].kind).toBe('hitscan');
      expect(asTestable().entries[1].kind).toBe('bolt');
      expect(asTestable().entries[2].kind).toBe('arc');

      // Advance past the longest lifetime (arc at 0.4s).
      const maxLifetime = Math.max(
        PROJECTILE_HITSCAN_CONFIG.lifetimeSec,
        PROJECTILE_BOLT_CONFIG.lifetimeSec,
        PROJECTILE_ARC_CONFIG.lifetimeSec,
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

  describe('mixed hitscan + bolt + arc + splash entries', () => {
    it('all four kinds coexist and all expire correctly', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      service.fireBolt(FROM, TO, COLOR, scene);
      service.fireArc(FROM, TO, COLOR, scene);
      service.fireSplash(FROM, TO, 1.5, COLOR, scene);

      expect(asTestable().entries.length).toBe(4);
      expect(asTestable().entries[0].kind).toBe('hitscan');
      expect(asTestable().entries[1].kind).toBe('bolt');
      expect(asTestable().entries[2].kind).toBe('arc');
      expect(asTestable().entries[3].kind).toBe('splash');

      // Advance past the longest total lifetime (splash: 0.18 + 0.25 = 0.43s).
      const splashTotal = PROJECTILE_SPLASH_CONFIG.travelLifetimeSec
        + PROJECTILE_SPLASH_CONFIG.impactLifetimeSec;
      const maxLifetime = Math.max(
        PROJECTILE_HITSCAN_CONFIG.lifetimeSec,
        PROJECTILE_BOLT_CONFIG.lifetimeSec,
        PROJECTILE_ARC_CONFIG.lifetimeSec,
        splashTotal,
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

  // ── fireAura ──────────────────────────────────────────────────────────────

  describe('fireAura', () => {
    const AURA_RADIUS = 2.5;
    const CENTER = new THREE.Vector3(3, 0, 3);

    it('adds a Mesh to the scene', () => {
      service.fireAura(CENTER, AURA_RADIUS, COLOR, scene);

      const meshes: THREE.Mesh[] = [];
      scene.traverse(obj => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
      expect(meshes.length).toBe(1);
    });

    it('is a no-op when body.reduce-motion class is set', () => {
      document.body.classList.add('reduce-motion');
      try {
        service.fireAura(CENTER, AURA_RADIUS, COLOR, scene);
        expect(asTestable().entries.length).toBe(0);
        const meshes: THREE.Mesh[] = [];
        scene.traverse(obj => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
        expect(meshes.length).toBe(0);
      } finally {
        document.body.classList.remove('reduce-motion');
      }
    });

    it('mid-flight: ring scale grows toward auraRadius (sample at t=0.5)', () => {
      service.fireAura(CENTER, AURA_RADIUS, COLOR, scene);
      const entry = asTestable().entries[0];

      // Advance to exactly half the lifetime.
      service.update(PROJECTILE_AURA_CONFIG.lifetimeSec / 2);

      const mesh = entry.mesh as THREE.Mesh;
      // At t=0.5, scale = 0.5 * auraRadius.
      const expectedScale = AURA_RADIUS / 2;
      expect(mesh.scale.x).toBeCloseTo(expectedScale, 3);
    });

    it('mid-flight: opacity decays toward 0', () => {
      service.fireAura(CENTER, AURA_RADIUS, COLOR, scene);
      const entry = asTestable().entries[0];

      service.update(PROJECTILE_AURA_CONFIG.lifetimeSec / 2);

      // At t=0.5, opacity = opacityStart * 0.5 — less than initial opacityStart.
      const opacity = entry.mat.opacity as number;
      expect(opacity).toBeLessThan(PROJECTILE_AURA_CONFIG.opacityStart);
      expect(opacity).toBeGreaterThan(0);
    });

    it('expires and removes mesh from the scene at lifetimeSec', () => {
      service.fireAura(CENTER, AURA_RADIUS, COLOR, scene);

      service.update(PROJECTILE_AURA_CONFIG.lifetimeSec + 0.001);

      const meshes: THREE.Mesh[] = [];
      scene.traverse(obj => { if (obj instanceof THREE.Mesh) meshes.push(obj); });
      expect(meshes.length).toBe(0);
      expect(asTestable().entries.length).toBe(0);
    });

    it('disposes geo and mat on expiry', () => {
      service.fireAura(CENTER, AURA_RADIUS, COLOR, scene);
      const entry = asTestable().entries[0];
      const geoDisposeSpy = spyOn(entry.geo, 'dispose').and.callThrough();
      const matDisposeSpy = spyOn(entry.mat, 'dispose').and.callThrough();

      service.update(PROJECTILE_AURA_CONFIG.lifetimeSec + 0.001);

      expect(geoDisposeSpy).toHaveBeenCalledTimes(1);
      expect(matDisposeSpy).toHaveBeenCalledTimes(1);
    });

    it('cleanup disposes aura geo and mat', () => {
      service.fireAura(CENTER, AURA_RADIUS, COLOR, scene);
      const entry = asTestable().entries[0];
      const geoDisposeSpy = spyOn(entry.geo, 'dispose').and.callThrough();
      const matDisposeSpy = spyOn(entry.mat, 'dispose').and.callThrough();

      service.cleanup(scene);

      expect(geoDisposeSpy).toHaveBeenCalledTimes(1);
      expect(matDisposeSpy).toHaveBeenCalledTimes(1);
      expect(asTestable().entries.length).toBe(0);
    });
  });

  // ── Mixed 5-kind coexistence ──────────────────────────────────────────────

  describe('mixed hitscan + bolt + arc + splash + aura entries', () => {
    it('all five kinds coexist and all expire correctly', () => {
      service.fireHitscan(FROM, TO, COLOR, scene);
      service.fireBolt(FROM, TO, COLOR, scene);
      service.fireArc(FROM, TO, COLOR, scene);
      service.fireSplash(FROM, TO, 1.5, COLOR, scene);
      service.fireAura(new THREE.Vector3(3, 0, 3), 2.0, COLOR, scene);

      expect(asTestable().entries.length).toBe(5);
      expect(asTestable().entries[0].kind).toBe('hitscan');
      expect(asTestable().entries[1].kind).toBe('bolt');
      expect(asTestable().entries[2].kind).toBe('arc');
      expect(asTestable().entries[3].kind).toBe('splash');
      expect(asTestable().entries[4].kind).toBe('aura');

      // Advance past the longest total lifetime (aura at 0.45s > splash total 0.43s).
      const splashTotal = PROJECTILE_SPLASH_CONFIG.travelLifetimeSec
        + PROJECTILE_SPLASH_CONFIG.impactLifetimeSec;
      const maxLifetime = Math.max(
        PROJECTILE_HITSCAN_CONFIG.lifetimeSec,
        PROJECTILE_BOLT_CONFIG.lifetimeSec,
        PROJECTILE_ARC_CONFIG.lifetimeSec,
        splashTotal,
        PROJECTILE_AURA_CONFIG.lifetimeSec,
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
