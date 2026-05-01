import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TowerUpgradeVisualService } from './tower-upgrade-visual.service';
import { TOWER_UPGRADE_VISUAL_CONFIG, SPECIALIZATION_VISUAL_CONFIG } from '../constants/effects.constants';
import { TOWER_VISUAL_CONFIG } from '../constants/ui.constants';
import { TowerSpecialization } from '../models/tower.model';

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

  describe('applyUpgradeVisuals', () => {
    it('should set scale to peak bounce value for L2 (newLevel=2, scale × 1.1 at start)', () => {
      // applyUpgradeVisuals immediately sets the group to baseScale × 1.1 so
      // tickTierUpScale can ease it back to baseScale. Verify the initial peak.
      const group = new THREE.Group();
      service.applyUpgradeVisuals(group, 2);
      const baseScale = TOWER_VISUAL_CONFIG.scaleBase + (2 - 1) * TOWER_VISUAL_CONFIG.scaleIncrement;
      expect(group.scale.x).toBeCloseTo(baseScale * 1.1, 4);
    });

    it('should set scale to peak bounce value for L3 (newLevel=3, scale × 1.1 at start)', () => {
      const group = new THREE.Group();
      service.applyUpgradeVisuals(group, 3);
      const baseScale = TOWER_VISUAL_CONFIG.scaleBase + (3 - 1) * TOWER_VISUAL_CONFIG.scaleIncrement;
      expect(group.scale.x).toBeCloseTo(baseScale * 1.1, 4);
    });

    it('should store scaleAnimBaseScale and scaleAnimStart for tickTierUpScale', () => {
      const group = new THREE.Group();
      const before = performance.now() / 1000;
      service.applyUpgradeVisuals(group, 2);
      const after = performance.now() / 1000;
      const baseScale = TOWER_VISUAL_CONFIG.scaleBase + (2 - 1) * TOWER_VISUAL_CONFIG.scaleIncrement;
      expect(group.userData['scaleAnimBaseScale']).toBeCloseTo(baseScale, 4);
      expect(group.userData['scaleAnimStart']).toBeGreaterThanOrEqual(before);
      expect(group.userData['scaleAnimStart']).toBeLessThanOrEqual(after);
    });

    it('should boost emissive intensity on MeshStandardMaterial children', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial();
      mat.emissiveIntensity = 0;
      const mesh = new THREE.Mesh(geo, mat);
      const group = new THREE.Group();
      group.add(mesh);

      service.applyUpgradeVisuals(group, 2);

      const expected = TOWER_VISUAL_CONFIG.emissiveBase + (2 - 1) * TOWER_VISUAL_CONFIG.emissiveIncrement;
      expect(mat.emissiveIntensity).toBeCloseTo(expected);

      geo.dispose();
      mat.dispose();
    });

    it('should skip animated child named "tip" (per-frame emissive)', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial();
      mat.emissiveIntensity = 0;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'tip';
      const group = new THREE.Group();
      group.add(mesh);

      service.applyUpgradeVisuals(group, 2);

      expect(mat.emissiveIntensity).toBe(0);

      geo.dispose();
      mat.dispose();
    });

    it('should skip "heatVent" child (SPLASH T3 intentional emissive)', () => {
      const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const mat = new THREE.MeshStandardMaterial();
      mat.emissiveIntensity = 0.9; // intentional T3 heat-vent glow
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'heatVent';
      const group = new THREE.Group();
      group.add(mesh);

      service.applyUpgradeVisuals(group, 3);

      expect(mat.emissiveIntensity).toBeCloseTo(0.9, 4);

      geo.dispose();
      mat.dispose();
    });

    it('should skip "emitter" child (SLOW idle-driven emissive)', () => {
      const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const mat = new THREE.MeshStandardMaterial();
      mat.emissiveIntensity = 0.85; // mid-breath value set by idleTick
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'emitter';
      const group = new THREE.Group();
      group.add(mesh);

      service.applyUpgradeVisuals(group, 2);

      expect(mat.emissiveIntensity).toBeCloseTo(0.85, 4);

      geo.dispose();
      mat.dispose();
    });

    it('should apply specialization tint when specialization is provided', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(geo, mat);
      const group = new THREE.Group();
      group.add(mesh);

      service.applyUpgradeVisuals(group, 3, TowerSpecialization.ALPHA);

      expect(mat.emissiveIntensity).toBe(SPECIALIZATION_VISUAL_CONFIG.alpha.emissiveIntensity);

      geo.dispose();
      mat.dispose();
    });

    it('should not call applySpecializationVisual when no specialization provided', () => {
      const spy = spyOn(service, 'applySpecializationVisual').and.callThrough();
      const group = new THREE.Group();

      service.applyUpgradeVisuals(group, 2);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('revealTierParts', () => {
    function makeTierGroup(): { group: THREE.Group; t2mesh: THREE.Mesh; t3mesh: THREE.Mesh; always: THREE.Mesh } {
      const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const mat = new THREE.MeshStandardMaterial();

      const group = new THREE.Group();

      const always = new THREE.Mesh(geo, mat);
      always.name = 'base';
      group.add(always);

      const t2mesh = new THREE.Mesh(geo, mat);
      t2mesh.name = 'barrelCap';
      t2mesh.visible = false;
      t2mesh.userData['minTier'] = 2;
      group.add(t2mesh);

      const t3mesh = new THREE.Mesh(geo, mat);
      t3mesh.name = 'pauldron';
      t3mesh.visible = false;
      t3mesh.userData['minTier'] = 3;
      group.add(t3mesh);

      return { group, t2mesh, t3mesh, always };
    }

    it('keeps T2 and T3 parts hidden at level 1', () => {
      const { group, t2mesh, t3mesh } = makeTierGroup();
      service.revealTierParts(group, 1);
      expect(t2mesh.visible).toBeFalse();
      expect(t3mesh.visible).toBeFalse();
    });

    it('reveals T2 part at level 2, keeps T3 hidden', () => {
      const { group, t2mesh, t3mesh } = makeTierGroup();
      service.revealTierParts(group, 2);
      expect(t2mesh.visible).toBeTrue();
      expect(t3mesh.visible).toBeFalse();
    });

    it('reveals both T2 and T3 parts at level 3', () => {
      const { group, t2mesh, t3mesh } = makeTierGroup();
      service.revealTierParts(group, 3);
      expect(t2mesh.visible).toBeTrue();
      expect(t3mesh.visible).toBeTrue();
    });

    it('does not affect children with no minTier tag', () => {
      const { group, always } = makeTierGroup();
      always.visible = true;
      service.revealTierParts(group, 1);
      expect(always.visible).toBeTrue();
    });

    it('applyUpgradeVisuals calls revealTierParts (T2 part visible after L2 upgrade)', () => {
      const { group, t2mesh } = makeTierGroup();
      service.applyUpgradeVisuals(group, 2);
      expect(t2mesh.visible).toBeTrue();
    });

    it('applyUpgradeVisuals keeps T3 hidden at L2', () => {
      const { group, t3mesh } = makeTierGroup();
      service.applyUpgradeVisuals(group, 2);
      expect(t3mesh.visible).toBeFalse();
    });

    // --- maxTier support ---

    it('hides a maxTier=1 child when level advances to 2', () => {
      const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const mat = new THREE.MeshStandardMaterial();
      const group = new THREE.Group();
      const t1onlyMesh = new THREE.Mesh(geo, mat);
      t1onlyMesh.name = 'scopeT1';
      t1onlyMesh.visible = true;
      t1onlyMesh.userData['maxTier'] = 1;
      group.add(t1onlyMesh);

      service.revealTierParts(group, 2);

      expect(t1onlyMesh.visible).toBeFalse();
      geo.dispose();
      mat.dispose();
    });

    it('keeps a maxTier=1 child visible at level 1', () => {
      const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const mat = new THREE.MeshStandardMaterial();
      const group = new THREE.Group();
      const t1onlyMesh = new THREE.Mesh(geo, mat);
      t1onlyMesh.name = 'scopeT1';
      t1onlyMesh.visible = true;
      t1onlyMesh.userData['maxTier'] = 1;
      group.add(t1onlyMesh);

      service.revealTierParts(group, 1);

      expect(t1onlyMesh.visible).toBeTrue();
      geo.dispose();
      mat.dispose();
    });

    it('hides a part with both minTier=2 and maxTier=2 when level is 1 or 3', () => {
      const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const mat = new THREE.MeshStandardMaterial();
      const group = new THREE.Group();
      const t2onlyMesh = new THREE.Mesh(geo, mat);
      t2onlyMesh.name = 'scopeMid';
      t2onlyMesh.visible = false;
      t2onlyMesh.userData['minTier'] = 2;
      t2onlyMesh.userData['maxTier'] = 2;
      group.add(t2onlyMesh);

      service.revealTierParts(group, 1);
      expect(t2onlyMesh.visible).toBeFalse();

      service.revealTierParts(group, 2);
      expect(t2onlyMesh.visible).toBeTrue();

      service.revealTierParts(group, 3);
      expect(t2onlyMesh.visible).toBeFalse();

      geo.dispose();
      mat.dispose();
    });

    it('bipod parts with maxTier=2 are hidden at level 3', () => {
      const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const mat = new THREE.MeshStandardMaterial();
      const group = new THREE.Group();
      const bipod = new THREE.Mesh(geo, mat);
      bipod.name = 'bipod';
      bipod.visible = true;
      bipod.userData['maxTier'] = 2;
      group.add(bipod);

      service.revealTierParts(group, 3);

      expect(bipod.visible).toBeFalse();
      geo.dispose();
      mat.dispose();
    });
  });

  describe('applySpecializationVisual', () => {
    it('should apply ALPHA warm orange tint to MeshStandardMaterial children', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(geo, mat);
      const group = new THREE.Group();
      group.add(mesh);

      service.applySpecializationVisual(group, TowerSpecialization.ALPHA);

      expect(mat.emissiveIntensity).toBe(SPECIALIZATION_VISUAL_CONFIG.alpha.emissiveIntensity);

      geo.dispose();
      mat.dispose();
    });

    it('should apply BETA cool blue tint to MeshStandardMaterial children', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(geo, mat);
      const group = new THREE.Group();
      group.add(mesh);

      service.applySpecializationVisual(group, TowerSpecialization.BETA);

      expect(mat.emissiveIntensity).toBe(SPECIALIZATION_VISUAL_CONFIG.beta.emissiveIntensity);

      geo.dispose();
      mat.dispose();
    });

    it('should skip animated "tip" children (only "tip" is in the skip-set)', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial();
      mat.emissiveIntensity = 0;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'tip';
      const group = new THREE.Group();
      group.add(mesh);

      service.applySpecializationVisual(group, TowerSpecialization.ALPHA);

      expect(mat.emissiveIntensity).toBe(0);

      geo.dispose();
      mat.dispose();
    });

    it('should apply tint to non-animated children (e.g. body mesh)', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial();
      mat.emissiveIntensity = 0;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'body';
      const group = new THREE.Group();
      group.add(mesh);

      service.applySpecializationVisual(group, TowerSpecialization.ALPHA);

      expect(mat.emissiveIntensity).toBe(SPECIALIZATION_VISUAL_CONFIG.alpha.emissiveIntensity);

      geo.dispose();
      mat.dispose();
    });

    it('should handle material arrays on a child mesh', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat1 = new THREE.MeshStandardMaterial();
      const mat2 = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(geo, [mat1, mat2]);
      const group = new THREE.Group();
      group.add(mesh);

      service.applySpecializationVisual(group, TowerSpecialization.BETA);

      expect(mat1.emissiveIntensity).toBe(SPECIALIZATION_VISUAL_CONFIG.beta.emissiveIntensity);
      expect(mat2.emissiveIntensity).toBe(SPECIALIZATION_VISUAL_CONFIG.beta.emissiveIntensity);

      geo.dispose();
      mat1.dispose();
      mat2.dispose();
    });
  });
});
