import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TowerDecalLibraryService, DecalKey } from './tower-decal-library.service';

const ALL_DECAL_KEYS: DecalKey[] = ['panelLines', 'rivets', 'ventSlats', 'warningChevron'];

describe('TowerDecalLibraryService', () => {
  let service: TowerDecalLibraryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TowerDecalLibraryService] });
    service = TestBed.inject(TowerDecalLibraryService);
  });

  afterEach(() => {
    service.dispose();
  });

  it('creates without error', () => {
    expect(service).toBeTruthy();
  });

  // ── getDecal — returns a valid CanvasTexture ──────────────────────────────

  ALL_DECAL_KEYS.forEach(key => {
    describe(`getDecal('${key}')`, () => {
      it('returns a THREE.CanvasTexture', () => {
        const texture = service.getDecal(key);
        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      });

      it('returns the same instance on repeated calls (cache hit)', () => {
        const first = service.getDecal(key);
        const second = service.getDecal(key);
        expect(second).toBe(first);
      });
    });
  });

  // ── dispose — clears cache and disposes textures ──────────────────────────

  describe('dispose()', () => {
    it('disposes all cached textures', () => {
      // Build all textures first, spy on each dispose
      const textures = ALL_DECAL_KEYS.map(k => service.getDecal(k));
      const disposeSpy = textures.map(t => spyOn(t, 'dispose').and.callThrough());

      service.dispose();

      disposeSpy.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
    });

    it('clears the cache so subsequent getDecal creates a fresh instance', () => {
      const first = service.getDecal('panelLines');
      service.dispose();
      const second = service.getDecal('panelLines');
      // After dispose the cache is empty, so a new texture is created
      expect(second).not.toBe(first);
      // Clean up the new texture
    });
  });

  // ── dispose called on empty service ──────────────────────────────────────

  it('dispose() on a fresh service does not throw', () => {
    const freshService = new TowerDecalLibraryService();
    expect(() => freshService.dispose()).not.toThrow();
  });
});
