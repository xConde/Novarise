import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TextSpritePoolService, TextSpriteOptions } from './text-sprite-pool.service';

const makeOpts = (overrides: Partial<TextSpriteOptions> = {}): TextSpriteOptions => ({
  text: '+50g',
  textColor: '#ffd700',
  strokeColor: '#000',
  strokeWidth: 2,
  font: 'bold 24px sans-serif',
  canvasWidth: 128,
  canvasHeight: 64,
  scaleX: 1,
  scaleY: 0.5,
  ...overrides,
});

describe('TextSpritePoolService', () => {
  let pool: TextSpritePoolService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TextSpritePoolService] });
    pool = TestBed.inject(TextSpritePoolService);
  });

  afterEach(() => {
    pool.dispose();
  });

  describe('texture cache', () => {
    it('caches texture by full options key — identical opts share one texture', () => {
      pool.acquire(makeOpts());
      pool.acquire(makeOpts());
      expect(pool.textureCacheSize()).toBe(1);
    });

    it('different text => different texture', () => {
      pool.acquire(makeOpts({ text: '+50g' }));
      pool.acquire(makeOpts({ text: '+100g' }));
      expect(pool.textureCacheSize()).toBe(2);
    });

    it('different color => different texture (color baked into canvas)', () => {
      pool.acquire(makeOpts({ textColor: '#ffd700' }));
      pool.acquire(makeOpts({ textColor: '#ffffff' }));
      expect(pool.textureCacheSize()).toBe(2);
    });
  });

  describe('sprite recycling', () => {
    it('release puts sprite back in the free pool; next acquire reuses it', () => {
      const a = pool.acquire(makeOpts());
      pool.release(a);
      expect(pool.freeCount()).toBe(1);
      expect(pool.activeCount()).toBe(0);

      const b = pool.acquire(makeOpts());
      expect(b).toBe(a);
      expect(pool.freeCount()).toBe(0);
      expect(pool.activeCount()).toBe(1);
    });

    it('reused sprite gets the new texture map even when text changes', () => {
      const a = pool.acquire(makeOpts({ text: '+50g' }));
      pool.release(a);
      const b = pool.acquire(makeOpts({ text: '+100g' }));
      const mat = b.material as THREE.SpriteMaterial;
      // The map texture should match the cached "+100g" texture.
      // We can't directly probe internal cache, but we know the texture
      // is now NOT the same as an immediate "+50g" acquire (different key).
      const c = pool.acquire(makeOpts({ text: '+50g' }));
      const cMat = c.material as THREE.SpriteMaterial;
      expect(mat.map).not.toBe(cMat.map);
    });

    it('release detaches the sprite from its parent if attached', () => {
      const sprite = pool.acquire(makeOpts());
      const scene = new THREE.Scene();
      scene.add(sprite);
      expect(sprite.parent).toBe(scene);
      pool.release(sprite);
      expect(sprite.parent).toBeNull();
    });

    it('release on an unknown sprite is a no-op', () => {
      const stranger = new THREE.Sprite(new THREE.SpriteMaterial());
      expect(() => pool.release(stranger)).not.toThrow();
      expect(pool.activeCount()).toBe(0);
      expect(pool.freeCount()).toBe(0);
      stranger.material.dispose();
    });

    it('opacity is reset to 1 on each acquire (popup fade does not bleed)', () => {
      const a = pool.acquire(makeOpts());
      (a.material as THREE.SpriteMaterial).opacity = 0.1;
      pool.release(a);
      const b = pool.acquire(makeOpts());
      expect((b.material as THREE.SpriteMaterial).opacity).toBe(1);
    });

    it('scale is applied on every acquire', () => {
      const a = pool.acquire(makeOpts({ scaleX: 2, scaleY: 1 }));
      expect(a.scale.x).toBe(2);
      expect(a.scale.y).toBe(1);
      pool.release(a);
      const b = pool.acquire(makeOpts({ scaleX: 5, scaleY: 3 }));
      expect(b).toBe(a);
      expect(b.scale.x).toBe(5);
      expect(b.scale.y).toBe(3);
    });
  });

  describe('dispose', () => {
    it('disposes every cached texture and pooled material', () => {
      const a = pool.acquire(makeOpts({ text: '+50g' }));
      const b = pool.acquire(makeOpts({ text: '+100g' }));
      pool.release(a);
      // a is in free, b is in active. 2 textures cached.

      const aMat = a.material as THREE.SpriteMaterial;
      const bMat = b.material as THREE.SpriteMaterial;
      const aTex = aMat.map!;
      const bTex = bMat.map!;
      spyOn(aMat, 'dispose');
      spyOn(bMat, 'dispose');
      spyOn(aTex, 'dispose');
      spyOn(bTex, 'dispose');

      pool.dispose();

      expect(aMat.dispose).toHaveBeenCalledTimes(1);
      expect(bMat.dispose).toHaveBeenCalledTimes(1);
      expect(aTex.dispose).toHaveBeenCalledTimes(1);
      expect(bTex.dispose).toHaveBeenCalledTimes(1);
      expect(pool.activeCount()).toBe(0);
      expect(pool.freeCount()).toBe(0);
      expect(pool.textureCacheSize()).toBe(0);
    });

    it('detaches active sprites from their parents on dispose', () => {
      const sprite = pool.acquire(makeOpts());
      const scene = new THREE.Scene();
      scene.add(sprite);
      pool.dispose();
      expect(sprite.parent).toBeNull();
    });

    it('is idempotent', () => {
      pool.acquire(makeOpts());
      pool.dispose();
      expect(() => pool.dispose()).not.toThrow();
    });
  });
});
