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
      // y offset by 0.5
      expect(sprite.position.y).toBe(pos.y + 0.5);
      expect(sprite.position.z).toBe(pos.z);
    });

    it('should handle multiple spawns', () => {
      service.spawn(10, pos, scene);
      service.spawn(20, pos, scene);
      service.spawn(30, pos, scene);
      expect(service.popupCount).toBe(3);
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
  });
});
