import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { MaterialRegistryService } from './material-registry.service';

describe('MaterialRegistryService', () => {
  let registry: MaterialRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MaterialRegistryService] });
    registry = TestBed.inject(MaterialRegistryService);
  });

  afterEach(() => {
    registry.dispose();
  });

  describe('identity caching', () => {
    it('returns the same material instance for the same key', () => {
      const a = registry.getOrCreate('tile:BASE', () => new THREE.MeshStandardMaterial({ color: 0x404858 }));
      const b = registry.getOrCreate('tile:BASE', () => new THREE.MeshStandardMaterial({ color: 0xffffff }));
      expect(a).toBe(b);
    });

    it('factory runs exactly once per key', () => {
      const factory = jasmine.createSpy('factory').and.callFake(() => new THREE.MeshStandardMaterial());
      registry.getOrCreate('test:key', factory);
      registry.getOrCreate('test:key', factory);
      registry.getOrCreate('test:key', factory);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('different keys return different instances', () => {
      const a = registry.getOrCreate('tile:BASE', () => new THREE.MeshStandardMaterial());
      const b = registry.getOrCreate('tile:WALL', () => new THREE.MeshStandardMaterial());
      expect(a).not.toBe(b);
    });

    it('preserves the typed return type', () => {
      const a = registry.getOrCreate('test', () => new THREE.LineBasicMaterial({ color: 0xff0000 }));
      expect(a).toBeInstanceOf(THREE.LineBasicMaterial);
      expect(a.color.getHex()).toBe(0xff0000);
    });

    it('size() reflects unique cache entries', () => {
      expect(registry.size()).toBe(0);
      registry.getOrCreate('a', () => new THREE.MeshBasicMaterial());
      registry.getOrCreate('a', () => new THREE.MeshBasicMaterial()); // duplicate
      registry.getOrCreate('b', () => new THREE.MeshBasicMaterial());
      expect(registry.size()).toBe(2);
    });
  });

  describe('isRegisteredMaterial', () => {
    it('returns true for a material produced by the registry', () => {
      const m = registry.getOrCreate('test', () => new THREE.MeshBasicMaterial());
      expect(registry.isRegisteredMaterial(m)).toBeTrue();
    });

    it('returns false for a material created outside the registry', () => {
      const m = new THREE.MeshBasicMaterial();
      expect(registry.isRegisteredMaterial(m)).toBeFalse();
      m.dispose();
    });
  });

  describe('dispose', () => {
    it('disposes every cached material exactly once', () => {
      const a = registry.getOrCreate('a', () => new THREE.MeshStandardMaterial());
      const b = registry.getOrCreate('b', () => new THREE.MeshBasicMaterial());
      spyOn(a, 'dispose');
      spyOn(b, 'dispose');

      registry.dispose();

      expect(a.dispose).toHaveBeenCalledTimes(1);
      expect(b.dispose).toHaveBeenCalledTimes(1);
    });

    it('clears the cache so subsequent gets allocate fresh', () => {
      const a = registry.getOrCreate('test', () => new THREE.MeshStandardMaterial());
      registry.dispose();
      const b = registry.getOrCreate('test', () => new THREE.MeshStandardMaterial());
      expect(a).not.toBe(b);
    });

    it('size() returns 0 after dispose', () => {
      registry.getOrCreate('a', () => new THREE.MeshBasicMaterial());
      registry.getOrCreate('b', () => new THREE.MeshBasicMaterial());
      registry.dispose();
      expect(registry.size()).toBe(0);
    });

    it('is idempotent — second dispose() is a no-op', () => {
      registry.getOrCreate('a', () => new THREE.MeshBasicMaterial());
      registry.dispose();
      expect(() => registry.dispose()).not.toThrow();
    });
  });
});
