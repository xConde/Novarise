import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TowerUpgradeVisualService } from './tower-upgrade-visual.service';
import { TOWER_UPGRADE_VISUAL_CONFIG } from '../constants/effects.constants';

describe('TowerUpgradeVisualService', () => {
  let service: TowerUpgradeVisualService;
  let scene: THREE.Scene;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TowerUpgradeVisualService],
    });
    service = TestBed.inject(TowerUpgradeVisualService);
    scene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup(scene);
    scene.clear();
  });

  const pos = { x: 5, y: 1, z: 5 };

  describe('applyLevelScale', () => {
    it('should set scale to 1.0 for level 1', () => {
      const group = new THREE.Group();
      service.applyLevelScale(group, 1);
      expect(group.scale.x).toBe(TOWER_UPGRADE_VISUAL_CONFIG.scalePerLevel[0]);
    });

    it('should set scale to 1.15 for level 2', () => {
      const group = new THREE.Group();
      service.applyLevelScale(group, 2);
      expect(group.scale.x).toBe(TOWER_UPGRADE_VISUAL_CONFIG.scalePerLevel[1]);
    });

    it('should set scale to 1.3 for level 3', () => {
      const group = new THREE.Group();
      service.applyLevelScale(group, 3);
      expect(group.scale.x).toBe(TOWER_UPGRADE_VISUAL_CONFIG.scalePerLevel[2]);
    });

    it('should clamp to max level scale for levels beyond 3', () => {
      const group = new THREE.Group();
      service.applyLevelScale(group, 5);
      expect(group.scale.x).toBe(TOWER_UPGRADE_VISUAL_CONFIG.scalePerLevel[2]);
    });
  });

  describe('spawnUpgradeFlash', () => {
    it('should add a sprite to the scene', () => {
      const before = scene.children.length;
      service.spawnUpgradeFlash(pos, scene);
      expect(scene.children.length).toBe(before + 1);
      expect(service.flashCount).toBe(1);
    });

    it('should position flash above tower', () => {
      service.spawnUpgradeFlash(pos, scene);
      const sprite = scene.children[0] as THREE.Sprite;
      expect(sprite.position.y).toBe(pos.y + 0.5);
    });
  });

  describe('update', () => {
    it('should fade flash over time', () => {
      service.spawnUpgradeFlash(pos, scene);
      service.update(TOWER_UPGRADE_VISUAL_CONFIG.flash.duration / 2, scene);
      expect(service.flashCount).toBe(1);
    });

    it('should remove expired flashes', () => {
      service.spawnUpgradeFlash(pos, scene);
      service.update(TOWER_UPGRADE_VISUAL_CONFIG.flash.duration + 0.01, scene);
      expect(service.flashCount).toBe(0);
    });

    it('should ignore non-positive deltaTime', () => {
      service.spawnUpgradeFlash(pos, scene);
      service.update(0, scene);
      service.update(-1, scene);
      expect(service.flashCount).toBe(1);
    });
  });

  describe('addGlowRing', () => {
    it('should add a ring mesh to the scene', () => {
      const before = scene.children.length;
      service.addGlowRing('tower-1', { x: 5, z: 5 }, scene);
      expect(scene.children.length).toBe(before + 1);
      expect(service.ringCount).toBe(1);
    });

    it('should replace existing ring for same tower', () => {
      service.addGlowRing('tower-1', { x: 5, z: 5 }, scene);
      service.addGlowRing('tower-1', { x: 6, z: 6 }, scene);
      expect(service.ringCount).toBe(1);
    });

    it('should track multiple rings for different towers', () => {
      service.addGlowRing('tower-1', { x: 5, z: 5 }, scene);
      service.addGlowRing('tower-2', { x: 6, z: 6 }, scene);
      expect(service.ringCount).toBe(2);
    });
  });

  describe('removeGlowRing', () => {
    it('should remove the ring from scene', () => {
      service.addGlowRing('tower-1', { x: 5, z: 5 }, scene);
      service.removeGlowRing('tower-1', scene);
      expect(service.ringCount).toBe(0);
    });

    it('should handle removing non-existent ring', () => {
      expect(() => service.removeGlowRing('nonexistent', scene)).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should remove all flashes and rings', () => {
      service.spawnUpgradeFlash(pos, scene);
      service.addGlowRing('tower-1', { x: 5, z: 5 }, scene);
      service.cleanup(scene);
      expect(service.flashCount).toBe(0);
      expect(service.ringCount).toBe(0);
    });

    it('should work without scene argument', () => {
      service.spawnUpgradeFlash(pos, scene);
      service.cleanup();
      expect(service.flashCount).toBe(0);
    });
  });
});
