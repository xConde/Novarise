import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { DamageNumberService } from './damage-number.service';
import { DAMAGE_NUMBER_CONFIG } from '../constants/damage-number.constants';

describe('DamageNumberService', () => {
  let service: DamageNumberService;
  let scene: THREE.Scene;

  const pos = { x: 3, y: 0.5, z: 2 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DamageNumberService],
    });
    service = TestBed.inject(DamageNumberService);
    scene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup(scene);
    scene.clear();
  });

  // ─── Creation ────────────────────────────────────────────────────────────────

  describe('showDamage', () => {
    it('should add a sprite to the scene', () => {
      const before = scene.children.length;
      service.showDamage(pos, 25, 'normal', scene);
      expect(scene.children.length).toBe(before + 1);
      expect(service.activeCount).toBe(1);
    });

    it('should spawn sprite above the given position by spawnHeightOffset', () => {
      service.showDamage(pos, 25, 'normal', scene);
      const sprite = scene.children[scene.children.length - 1] as THREE.Sprite;
      expect(sprite.position.y).toBe(pos.y + DAMAGE_NUMBER_CONFIG.spawnHeightOffset);
      expect(sprite.position.z).toBe(pos.z);
    });

    it('should apply horizontal jitter so x is within range', () => {
      const halfJitter = DAMAGE_NUMBER_CONFIG.jitterRange / 2;
      for (let i = 0; i < 20; i++) {
        service.showDamage(pos, 10, 'normal', scene);
      }
      const sprites = scene.children.slice(-20) as THREE.Sprite[];
      for (const sprite of sprites) {
        expect(sprite.position.x).toBeGreaterThanOrEqual(pos.x - halfJitter);
        expect(sprite.position.x).toBeLessThanOrEqual(pos.x + halfJitter);
      }
    });

    it('should accept all four hit types without throwing', () => {
      expect(() => service.showDamage(pos, 10, 'normal', scene)).not.toThrow();
      expect(() => service.showDamage(pos, 10, 'splash', scene)).not.toThrow();
      expect(() => service.showDamage(pos, 10, 'chain', scene)).not.toThrow();
      expect(() => service.showDamage(pos, 10, 'critical', scene)).not.toThrow();
      expect(service.activeCount).toBe(4);
    });

    it('should track multiple active numbers', () => {
      service.showDamage(pos, 10, 'normal', scene);
      service.showDamage(pos, 20, 'splash', scene);
      service.showDamage(pos, 30, 'chain', scene);
      expect(service.activeCount).toBe(3);
    });
  });

  // ─── Pool limit ───────────────────────────────────────────────────────────────

  describe('pool limit', () => {
    it('should never exceed maxActive sprites', () => {
      const overLimit = DAMAGE_NUMBER_CONFIG.maxActive + 10;
      for (let i = 0; i < overLimit; i++) {
        service.showDamage(pos, i, 'normal', scene);
      }
      expect(service.activeCount).toBe(DAMAGE_NUMBER_CONFIG.maxActive);
    });

    it('should evict the oldest entry when the pool is full', () => {
      // Fill pool exactly
      for (let i = 0; i < DAMAGE_NUMBER_CONFIG.maxActive; i++) {
        service.showDamage(pos, 1, 'normal', scene);
      }
      const countBefore = scene.children.length;
      // One more — oldest should be evicted (scene child removed), net count stays same
      service.showDamage(pos, 99, 'normal', scene);
      expect(service.activeCount).toBe(DAMAGE_NUMBER_CONFIG.maxActive);
      // Scene: old sprite removed, new sprite added → net 0 change
      expect(scene.children.length).toBe(countBefore);
    });
  });

  // ─── Update / fade ────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should move sprites upward each frame', () => {
      service.showDamage(pos, 25, 'normal', scene);
      const sprite = scene.children[scene.children.length - 1] as THREE.Sprite;
      const startY = sprite.position.y;
      service.update(0.1);
      expect(sprite.position.y).toBeGreaterThan(startY);
    });

    it('should fade sprites over their lifetime', () => {
      service.showDamage(pos, 25, 'normal', scene);
      const sprite = scene.children[scene.children.length - 1] as THREE.Sprite;
      service.update(DAMAGE_NUMBER_CONFIG.lifetime / 2);
      const opacity = (sprite.material as THREE.SpriteMaterial).opacity;
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(1);
    });

    it('should remove sprites that have exceeded their lifetime', () => {
      service.showDamage(pos, 25, 'normal', scene);
      service.update(DAMAGE_NUMBER_CONFIG.lifetime + 0.01);
      expect(service.activeCount).toBe(0);
    });

    it('should do nothing when deltaTime is zero', () => {
      service.showDamage(pos, 25, 'normal', scene);
      const sprite = scene.children[scene.children.length - 1] as THREE.Sprite;
      const startY = sprite.position.y;
      service.update(0);
      expect(sprite.position.y).toBe(startY);
      expect(service.activeCount).toBe(1);
    });

    it('should do nothing when deltaTime is negative', () => {
      service.showDamage(pos, 25, 'normal', scene);
      const sprite = scene.children[scene.children.length - 1] as THREE.Sprite;
      const startY = sprite.position.y;
      service.update(-1);
      expect(sprite.position.y).toBe(startY);
      expect(service.activeCount).toBe(1);
    });
  });

  // ─── Cleanup / disposal ───────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('should remove all sprites from the scene', () => {
      service.showDamage(pos, 10, 'normal', scene);
      service.showDamage(pos, 20, 'splash', scene);
      const before = scene.children.length;
      service.cleanup(scene);
      expect(scene.children.length).toBe(before - 2);
      expect(service.activeCount).toBe(0);
    });

    it('should work without a scene argument', () => {
      service.showDamage(pos, 10, 'normal', scene);
      service.cleanup();
      expect(service.activeCount).toBe(0);
    });

    it('should be safe to call on an empty service', () => {
      expect(() => service.cleanup(scene)).not.toThrow();
    });
  });
});
