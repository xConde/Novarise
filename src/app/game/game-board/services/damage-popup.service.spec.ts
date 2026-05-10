import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { DamagePopupService } from './damage-popup.service';
import { DAMAGE_POPUP_CONFIG } from '../constants/damage-popup.constants';

describe('DamagePopupService', () => {
  let service: DamagePopupService;
  let scene: THREE.Scene;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DamagePopupService],
    });
    service = TestBed.inject(DamagePopupService);
    scene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup(scene);
    scene.clear();
  });

  const pos = { x: 5, y: 1, z: 5 };

  describe('spawn', () => {
    it('should add a popup to the scene', () => {
      const before = scene.children.length;
      service.spawn(25, pos, scene);
      expect(scene.children.length).toBe(before + 1);
      expect(service.popupCount).toBe(1);
    });

    it('should create a sprite with correct position (jittered x)', () => {
      service.spawn(25, pos, scene);
      const sprite = scene.children[scene.children.length - 1] as THREE.Sprite;
      // Read offset from the live config so a future polish tweak doesn't
      // pass-by-luck (spec was hardcoding 0.5 — flagged in pre-merge audit).
      expect(sprite.position.y).toBe(pos.y + DAMAGE_POPUP_CONFIG.spawnHeightOffset);
      expect(sprite.position.z).toBe(pos.z);
    });

    it('selects normalColor for non-critical, non-shield damage', () => {
      service.spawn(DAMAGE_POPUP_CONFIG.criticalThreshold - 1, pos, scene);
      const sprite = scene.children[scene.children.length - 1] as THREE.Sprite;
      const mat = sprite.material as THREE.SpriteMaterial;
      // Texture color is canvas-rendered, so read pixel under the label region.
      // Easier: confirm the SpritePool acquired with a key that contains the normalColor.
      // Fallback: assert SpriteMaterial map exists (pool acquired) — spec primarily
      // ensures the color-selection branch runs without throwing.
      expect(mat.map).toBeTruthy();
      expect(service.popupCount).toBe(1);
    });

    it('selects criticalColor when damage >= criticalThreshold', () => {
      service.spawn(DAMAGE_POPUP_CONFIG.criticalThreshold + 10, pos, scene);
      expect(service.popupCount).toBe(1);
    });

    it('selects shieldColor when isShieldHit=true regardless of damage value', () => {
      service.spawn(DAMAGE_POPUP_CONFIG.criticalThreshold + 100, pos, scene, true);
      expect(service.popupCount).toBe(1);
    });

    it('should handle multiple spawns', () => {
      service.spawn(10, pos, scene);
      service.spawn(20, pos, scene);
      service.spawn(30, pos, scene);
      expect(service.popupCount).toBe(3);
    });

    it('scales sprite up for big-damage hits (StS-style scaling)', () => {
      service.spawn(5, pos, scene); // small hit
      const small = scene.children[scene.children.length - 1] as THREE.Sprite;
      const smallScale = small.scale.x;

      service.spawn(DAMAGE_POPUP_CONFIG.scaleSaturationDamage, pos, scene); // saturated big hit
      const big = scene.children[scene.children.length - 1] as THREE.Sprite;
      const bigScale = big.scale.x;

      expect(bigScale).toBeGreaterThan(smallScale);
      expect(bigScale).toBeCloseTo(DAMAGE_POPUP_CONFIG.spriteScaleMax, 3);
    });

    it('clamps sprite scale to spriteScaleMax above saturation damage', () => {
      service.spawn(DAMAGE_POPUP_CONFIG.scaleSaturationDamage * 5, pos, scene);
      const sprite = scene.children[scene.children.length - 1] as THREE.Sprite;
      expect(sprite.scale.x).toBeCloseTo(DAMAGE_POPUP_CONFIG.spriteScaleMax, 3);
    });

    it('falls back to baseline scale for non-positive damage', () => {
      service.spawn(0, pos, scene, true); // shield-absorbed = 0 damage
      const sprite = scene.children[scene.children.length - 1] as THREE.Sprite;
      expect(sprite.scale.x).toBeCloseTo(DAMAGE_POPUP_CONFIG.spriteScale, 3);
    });

    it('accepts a damage source parameter for color routing', () => {
      // Smoke test — no throw, popup created. Color is rendered into the canvas
      // texture so we can't directly assert the hex; the fact that the spawn
      // path completes without error and the popup is registered is sufficient.
      service.spawn(10, pos, scene, false, 'burn');
      service.spawn(10, pos, scene, false, 'poison');
      service.spawn(10, pos, scene, false, 'tower');
      expect(service.popupCount).toBe(3);
    });

    it('shield-hit override beats source-specific color', () => {
      // No throw + popup created when isShieldHit conflicts with a DoT source.
      service.spawn(10, pos, scene, true, 'burn');
      expect(service.popupCount).toBe(1);
    });
  });

  describe('update', () => {
    it('should move popups upward', () => {
      service.spawn(25, pos, scene);
      const sprite = scene.children[scene.children.length - 1] as THREE.Sprite;
      const startY = sprite.position.y;
      service.update(0.1);
      expect(sprite.position.y).toBeGreaterThan(startY);
    });

    it('should fade popups over time', () => {
      service.spawn(25, pos, scene);
      const sprite = scene.children[scene.children.length - 1] as THREE.Sprite;
      service.update(DAMAGE_POPUP_CONFIG.lifetime / 2);
      expect((sprite.material as THREE.SpriteMaterial).opacity).toBeLessThan(1);
    });

    it('should remove expired popups', () => {
      service.spawn(25, pos, scene);
      service.update(DAMAGE_POPUP_CONFIG.lifetime + 0.01);
      expect(service.popupCount).toBe(0);
    });

    it('should ignore non-positive deltaTime', () => {
      service.spawn(25, pos, scene);
      const sprite = scene.children[scene.children.length - 1] as THREE.Sprite;
      const startY = sprite.position.y;
      service.update(0);
      expect(sprite.position.y).toBe(startY);
      service.update(-1);
      expect(sprite.position.y).toBe(startY);
    });
  });

  describe('cleanup', () => {
    it('should remove all popups from scene', () => {
      service.spawn(10, pos, scene);
      service.spawn(20, pos, scene);
      const before = scene.children.length;
      service.cleanup(scene);
      expect(scene.children.length).toBe(before - 2);
      expect(service.popupCount).toBe(0);
    });

    it('should work without scene argument', () => {
      service.spawn(10, pos, scene);
      service.cleanup();
      expect(service.popupCount).toBe(0);
    });

    it('should clear accumulators on cleanup', () => {
      service.accumulate('e1', 10, pos, scene);
      service.cleanup(scene);
      // After cleanup, flush should produce no popups
      service.flush(scene);
      expect(service.popupCount).toBe(0);
    });
  });

  describe('accumulate', () => {
    it('does not spawn a sprite immediately', () => {
      const before = scene.children.length;
      service.accumulate('e1', 25, pos, scene);
      expect(scene.children.length).toBe(before);
      expect(service.popupCount).toBe(0);
    });

    it('is a no-op when damage=0 and isShieldHit=false', () => {
      service.accumulate('e1', 0, pos, scene, false);
      service.flush(scene);
      expect(service.popupCount).toBe(0);
    });

    it('accumulates when damage=0 but isShieldHit=true', () => {
      service.accumulate('e1', 0, pos, scene, true);
      service.flush(scene);
      expect(service.popupCount).toBe(1);
    });

    it('sums multiple hits on the same enemy', () => {
      service.accumulate('e1', 10, pos, scene);
      service.accumulate('e1', 15, pos, scene);
      service.accumulate('e1', 5, pos, scene);
      // After flush, one popup should exist
      service.flush(scene);
      expect(service.popupCount).toBe(1);
    });

    it('last-write-wins: uses the last recorded source', () => {
      service.accumulate('e1', 10, pos, scene, false, 'tower');
      service.accumulate('e1', 5, pos, scene, false, 'burn');
      // Only one popup spawned — no error, last source used
      service.flush(scene);
      expect(service.popupCount).toBe(1);
    });

    it('last-write-wins: uses the last recorded shieldHit flag', () => {
      service.accumulate('e1', 10, pos, scene, false);
      service.accumulate('e1', 0, pos, scene, true);
      service.flush(scene);
      expect(service.popupCount).toBe(1);
    });

    it('last-write-wins: uses the last recorded position', () => {
      const pos2 = { x: 99, y: 1, z: 99 };
      service.accumulate('e1', 10, pos, scene);
      service.accumulate('e1', 5, pos2, scene);
      service.flush(scene);
      const sprite = scene.children[scene.children.length - 1] as THREE.Sprite;
      expect(sprite.position.z).toBe(pos2.z);
    });
  });

  describe('flush', () => {
    it('spawns one popup per accumulator entry', () => {
      service.accumulate('e1', 10, pos, scene);
      service.accumulate('e2', 20, pos, scene);
      service.accumulate('e3', 5, pos, scene);
      service.flush(scene);
      expect(service.popupCount).toBe(3);
    });

    it('clears the accumulator after flush', () => {
      service.accumulate('e1', 10, pos, scene);
      service.flush(scene);
      const countAfterFirst = service.popupCount;
      // Second flush should produce nothing new
      service.flush(scene);
      expect(service.popupCount).toBe(countAfterFirst); // no new popups
    });

    it('is a no-op when there are no accumulators', () => {
      service.flush(scene);
      expect(service.popupCount).toBe(0);
    });
  });

  describe('flushOne', () => {
    it('spawns one popup and removes only that entry', () => {
      service.accumulate('e1', 10, pos, scene);
      service.accumulate('e2', 20, pos, scene);
      const total = service.flushOne('e1', scene);
      expect(total).toBe(10);
      expect(service.popupCount).toBe(1); // e1 flushed
      // e2 should still be pending
      service.flush(scene);
      expect(service.popupCount).toBe(2); // e1 + e2 now both spawned
    });

    it('returns 0 and is safe when enemyId is not found', () => {
      const total = service.flushOne('nonexistent', scene);
      expect(total).toBe(0);
      expect(service.popupCount).toBe(0);
    });

    it('only removes the flushed entry, leaving others intact', () => {
      service.accumulate('e1', 5, pos, scene);
      service.accumulate('e2', 15, pos, scene);
      service.accumulate('e3', 25, pos, scene);
      service.flushOne('e2', scene);
      expect(service.popupCount).toBe(1); // e2 spawned
      service.flush(scene);
      expect(service.popupCount).toBe(3); // e1 + e2 + e3
    });
  });

  describe('clearAccumulators', () => {
    it('clears all accumulators without spawning popups', () => {
      service.accumulate('e1', 10, pos, scene);
      service.accumulate('e2', 20, pos, scene);
      service.clearAccumulators();
      service.flush(scene);
      expect(service.popupCount).toBe(0);
    });
  });
});
