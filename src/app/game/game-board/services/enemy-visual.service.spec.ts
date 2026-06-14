import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { EnemyVisualService } from './enemy-visual.service';
import { StatusEffectType } from '../constants/status-effect.constants';
import { ENEMY_VISUAL_CONFIG } from '../constants/ui.constants';
import { ENEMY_STATS, EnemyType, Enemy } from '../models/enemy.model';
import {
  STATUS_EFFECT_VISUAL_CONFIG,
  NOVA_SOVEREIGN_ORB_SPIN_SPEEDS,
  NOVA_SOVEREIGN_ENRAGE_VISUAL,
} from '../constants/effects.constants';

/** Create a minimal Enemy object suitable for visual tests. */
function makeEnemy(id: string, type: EnemyType = EnemyType.BASIC): Enemy {
  const stats = ENEMY_STATS[type];
  const geo = new THREE.SphereGeometry(stats.size);
  const mat = new THREE.MeshStandardMaterial({ color: stats.color, emissive: new THREE.Color(stats.color) });
  const mesh = new THREE.Mesh(geo, mat);

  return {
    id,
    type,
    position: { x: 0, y: stats.size, z: 0 },
    gridPosition: { row: 0, col: 0 },
    health: stats.health,
    maxHealth: stats.health,
    speed: stats.speed,
    value: stats.value,
    leakDamage: stats.leakDamage,
    path: [],
    pathIndex: 0,
    distanceTraveled: 0,
    mesh,
  };
}

describe('EnemyVisualService', () => {
  let service: EnemyVisualService;
  let mockScene: THREE.Scene;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EnemyVisualService] });
    service = TestBed.inject(EnemyVisualService);
    mockScene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup();
    // Dispose any remaining test meshes still attached to the scene
    mockScene.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          (child.material as THREE.Material).dispose();
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Creation
  // ---------------------------------------------------------------------------

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // updateStatusVisuals
  // ---------------------------------------------------------------------------

  describe('updateStatusVisuals', () => {
    it('applies BURN emissive color to enemy mesh', () => {
      const enemy = makeEnemy('e1');
      const enemies = new Map([['e1', enemy]]);
      const effects = new Map([['e1', [StatusEffectType.BURN]]]);

      service.updateStatusVisuals(enemies, effects);

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0xff6622);
    });

    it('applies POISON emissive color to enemy mesh', () => {
      const enemy = makeEnemy('e1');
      const enemies = new Map([['e1', enemy]]);
      const effects = new Map([['e1', [StatusEffectType.POISON]]]);

      service.updateStatusVisuals(enemies, effects);

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0x44ff22);
    });

    it('applies SLOW emissive color to enemy mesh', () => {
      const enemy = makeEnemy('e1');
      const enemies = new Map([['e1', enemy]]);
      const effects = new Map([['e1', [StatusEffectType.SLOW]]]);

      service.updateStatusVisuals(enemies, effects);

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0x4488ff);
    });

    it('reverts to base color when no active effects', () => {
      const enemy = makeEnemy('e1');
      const enemies = new Map([['e1', enemy]]);

      // Apply then clear
      service.updateStatusVisuals(enemies, new Map([['e1', [StatusEffectType.BURN]]]));
      service.updateStatusVisuals(enemies, new Map());

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(ENEMY_STATS[EnemyType.BASIC].color);
    });

    it('BURN takes priority over POISON', () => {
      const enemy = makeEnemy('e1');
      const enemies = new Map([['e1', enemy]]);
      const effects = new Map([['e1', [StatusEffectType.POISON, StatusEffectType.BURN]]]);

      service.updateStatusVisuals(enemies, effects);

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0xff6622);
    });

    it('skips dying enemies', () => {
      const enemy = makeEnemy('e1');
      enemy.dying = true;
      const enemies = new Map([['e1', enemy]]);
      const effects = new Map([['e1', [StatusEffectType.BURN]]]);
      const originalHex = (enemy.mesh!.material as THREE.MeshStandardMaterial).emissive.getHex();

      service.updateStatusVisuals(enemies, effects);

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(originalHex);
    });

    it('uses miniSwarm emissive intensity when reverting mini-swarm', () => {
      const enemy = makeEnemy('e1', EnemyType.SWARM);
      enemy.isMiniSwarm = true;
      const enemies = new Map([['e1', enemy]]);

      service.updateStatusVisuals(enemies, new Map([['e1', [StatusEffectType.SLOW]]]));
      service.updateStatusVisuals(enemies, new Map());

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      expect(mat.emissiveIntensity).toBe(ENEMY_VISUAL_CONFIG.miniSwarmEmissive);
    });
  });

  // ---------------------------------------------------------------------------
  // updateEnemyAnimations
  // ---------------------------------------------------------------------------

  describe('updateEnemyAnimations', () => {
    it('spins boss crown over time', () => {
      const boss = makeEnemy('e1', EnemyType.BOSS);
      // Add a fake crown to simulate the real mesh structure
      const crownGeo = new THREE.TorusGeometry(0.4, 0.1);
      const crownMat = new THREE.MeshStandardMaterial();
      const crown = new THREE.Mesh(crownGeo, crownMat);
      boss.mesh!.userData['bossCrown'] = crown;

      const enemies = new Map([['e1', boss]]);
      const initialZ = crown.rotation.z;

      service.updateEnemyAnimations(enemies, 0.5);

      expect(crown.rotation.z).toBeGreaterThan(initialZ);

      crownGeo.dispose();
      crownMat.dispose();
    });

    it('does not throw for enemies without crowns', () => {
      const enemy = makeEnemy('e1');
      const enemies = new Map([['e1', enemy]]);
      expect(() => service.updateEnemyAnimations(enemies, 0.016)).not.toThrow();
    });

    it('skips dying enemies', () => {
      const boss = makeEnemy('e1', EnemyType.BOSS);
      const crownGeo = new THREE.TorusGeometry(0.4, 0.1);
      const crownMat = new THREE.MeshStandardMaterial();
      const crown = new THREE.Mesh(crownGeo, crownMat);
      boss.mesh!.userData['bossCrown'] = crown;
      boss.dying = true;

      const enemies = new Map([['e1', boss]]);
      const initialZ = crown.rotation.z;

      service.updateEnemyAnimations(enemies, 0.5);

      expect(crown.rotation.z).toBe(initialZ);

      crownGeo.dispose();
      crownMat.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // updateStatusEffectParticles
  // ---------------------------------------------------------------------------

  describe('updateStatusEffectParticles', () => {
    it('creates BURN particles and adds them to the scene', () => {
      const enemy = makeEnemy('e1');
      mockScene.add(enemy.mesh!);
      const enemies = new Map([['e1', enemy]]);
      const effects = new Map([['e1', [StatusEffectType.BURN]]]);

      service.updateStatusEffectParticles(enemies, 0.016, mockScene, effects);

      expect(enemy.statusParticles).toBeTruthy();
      expect(enemy.statusParticles!.length).toBe(STATUS_EFFECT_VISUAL_CONFIG.maxParticlesPerEnemy);
      enemy.statusParticles!.forEach(p => expect(p.parent).toBe(mockScene));
    });

    it('creates POISON particles with correct color', () => {
      const enemy = makeEnemy('e1');
      mockScene.add(enemy.mesh!);
      const enemies = new Map([['e1', enemy]]);
      const effects = new Map([['e1', [StatusEffectType.POISON]]]);

      service.updateStatusEffectParticles(enemies, 0.016, mockScene, effects);

      const mat = enemy.statusParticles![0].material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(0x44ff44);
    });

    it('creates SLOW particles with correct color', () => {
      const enemy = makeEnemy('e1');
      mockScene.add(enemy.mesh!);
      const enemies = new Map([['e1', enemy]]);
      const effects = new Map([['e1', [StatusEffectType.SLOW]]]);

      service.updateStatusEffectParticles(enemies, 0.016, mockScene, effects);

      const mat = enemy.statusParticles![0].material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(0x88ccff);
    });

    it('removes particles when effects end', () => {
      const enemy = makeEnemy('e1');
      mockScene.add(enemy.mesh!);
      const enemies = new Map([['e1', enemy]]);

      service.updateStatusEffectParticles(enemies, 0.016, mockScene, new Map([['e1', [StatusEffectType.BURN]]]));
      expect(enemy.statusParticles!.length).toBe(STATUS_EFFECT_VISUAL_CONFIG.maxParticlesPerEnemy);

      service.updateStatusEffectParticles(enemies, 0.016, mockScene, new Map());
      expect(enemy.statusParticles!.length).toBe(0);
    });

    it('removes particles for dying enemies', () => {
      const enemy = makeEnemy('e1');
      mockScene.add(enemy.mesh!);
      const enemies = new Map([['e1', enemy]]);
      const effects = new Map([['e1', [StatusEffectType.BURN]]]);

      service.updateStatusEffectParticles(enemies, 0.016, mockScene, effects);
      expect(enemy.statusParticles!.length).toBe(STATUS_EFFECT_VISUAL_CONFIG.maxParticlesPerEnemy);

      enemy.dying = true;
      service.updateStatusEffectParticles(enemies, 0.016, mockScene, effects);
      expect(enemy.statusParticles!.length).toBe(0);
    });

    it('does not exceed maxParticlesPerEnemy on repeated calls', () => {
      const enemy = makeEnemy('e1');
      mockScene.add(enemy.mesh!);
      const enemies = new Map([['e1', enemy]]);
      const effects = new Map([['e1', [StatusEffectType.POISON]]]);

      service.updateStatusEffectParticles(enemies, 0.016, mockScene, effects);
      service.updateStatusEffectParticles(enemies, 0.016, mockScene, effects);
      service.updateStatusEffectParticles(enemies, 0.016, mockScene, effects);

      expect(enemy.statusParticles!.length).toBe(STATUS_EFFECT_VISUAL_CONFIG.maxParticlesPerEnemy);
    });

    it('does not throw for zero deltaTime', () => {
      const enemy = makeEnemy('e1');
      mockScene.add(enemy.mesh!);
      const enemies = new Map([['e1', enemy]]);
      const effects = new Map([['e1', [StatusEffectType.BURN]]]);

      expect(() => service.updateStatusEffectParticles(enemies, 0, mockScene, effects)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // removeStatusParticles
  // ---------------------------------------------------------------------------

  describe('removeStatusParticles', () => {
    it('removes particles from scene and clears array', () => {
      const enemy = makeEnemy('e1');
      mockScene.add(enemy.mesh!);
      const enemies = new Map([['e1', enemy]]);
      const effects = new Map([['e1', [StatusEffectType.BURN]]]);

      service.updateStatusEffectParticles(enemies, 0.016, mockScene, effects);
      expect(mockScene.children.length).toBeGreaterThanOrEqual(4); // mesh + 3 particles

      service.removeStatusParticles(enemy, mockScene);

      expect(enemy.statusParticles!.length).toBe(0);
    });

    it('no-ops when no particles exist', () => {
      const enemy = makeEnemy('e1');
      expect(() => service.removeStatusParticles(enemy, mockScene)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // effect transition
  // ---------------------------------------------------------------------------

  describe('effect transition', () => {
    it('recreates particles when highest-priority effect changes', () => {
      const enemy = makeEnemy('e1');
      mockScene.add(enemy.mesh!);
      const enemies = new Map([['e1', enemy]]);

      // Start with BURN particles
      const burnEffects = new Map([['e1', [StatusEffectType.BURN]]]);
      service.updateStatusEffectParticles(enemies, 0.016, mockScene, burnEffects);
      expect(enemy.statusParticles!.length).toBeGreaterThan(0);
      expect(enemy.statusParticleEffectType).toBe(StatusEffectType.BURN);

      const burnParticles = enemy.statusParticles!.slice();

      // Transition to POISON (BURN expired)
      const poisonEffects = new Map([['e1', [StatusEffectType.POISON]]]);
      service.updateStatusEffectParticles(enemies, 0.016, mockScene, poisonEffects);

      // Particles should be recreated (not the same references)
      expect(enemy.statusParticleEffectType).toBe(StatusEffectType.POISON);
      expect(enemy.statusParticles!.length).toBeGreaterThan(0);
      // Old particles should have been removed from scene
      burnParticles.forEach(p => {
        expect(mockScene.children).not.toContain(p);
      });
    });

    it('clears effect type tracking when particles are removed', () => {
      const enemy = makeEnemy('e1');
      mockScene.add(enemy.mesh!);
      const enemies = new Map([['e1', enemy]]);

      // Create BURN particles
      const effects = new Map([['e1', [StatusEffectType.BURN]]]);
      service.updateStatusEffectParticles(enemies, 0.016, mockScene, effects);
      expect(enemy.statusParticleEffectType).toBe(StatusEffectType.BURN);

      // Remove all effects
      service.updateStatusEffectParticles(enemies, 0.016, mockScene, new Map());
      expect(enemy.statusParticles!.length).toBe(0);
      expect(enemy.statusParticleEffectType).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // NOVA_SOVEREIGN orb-ring animation (Fix 1)
  // ---------------------------------------------------------------------------

  describe('updateEnemyAnimations — NOVA_SOVEREIGN orb rings', () => {
    function makeNovaSovereign(): Enemy {
      const enemy = makeEnemy('nova', EnemyType.NOVA_SOVEREIGN);
      // Attach three fake shard rings matching the userData keys set by EnemyMeshFactoryService.
      for (let i = 0; i < 3; i++) {
        const geo = new THREE.TorusGeometry(0.5, 0.05);
        const mat = new THREE.MeshStandardMaterial();
        const ring = new THREE.Mesh(geo, mat);
        ring.rotation.y = 0;
        enemy.mesh!.userData[`novaSovereignOrb${i}`] = ring;
      }
      return enemy;
    }

    afterEach(() => {
      // Dispose ring geometries/materials created in each test.
    });

    it('rotates all three shard rings on Y each frame', () => {
      const enemy = makeNovaSovereign();
      const enemies = new Map([['nova', enemy]]);

      service.updateEnemyAnimations(enemies, 0.5);

      for (let i = 0; i < 3; i++) {
        const ring = enemy.mesh!.userData[`novaSovereignOrb${i}`] as THREE.Mesh;
        const expectedY = NOVA_SOVEREIGN_ORB_SPIN_SPEEDS[i] * 0.5;
        expect(ring.rotation.y).toBeCloseTo(expectedY, 5);

        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      }
    });

    it('gives each ring a distinct rotation angle after multiple frames', () => {
      const enemy = makeNovaSovereign();
      const enemies = new Map([['nova', enemy]]);

      service.updateEnemyAnimations(enemies, 1.0);
      service.updateEnemyAnimations(enemies, 1.0);

      const angles = [0, 1, 2].map(
        i => (enemy.mesh!.userData[`novaSovereignOrb${i}`] as THREE.Mesh).rotation.y,
      );
      // Verify that ring angles differ (parallax — they should not all be equal)
      expect(angles[0]).not.toBeCloseTo(angles[1], 3);
      expect(angles[1]).not.toBeCloseTo(angles[2], 3);

      for (let i = 0; i < 3; i++) {
        const ring = enemy.mesh!.userData[`novaSovereignOrb${i}`] as THREE.Mesh;
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      }
    });

    it('does not rotate rings when deltaTime is zero', () => {
      const enemy = makeNovaSovereign();
      const enemies = new Map([['nova', enemy]]);

      service.updateEnemyAnimations(enemies, 0);

      for (let i = 0; i < 3; i++) {
        const ring = enemy.mesh!.userData[`novaSovereignOrb${i}`] as THREE.Mesh;
        expect(ring.rotation.y).toBe(0);
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      }
    });

    it('does not throw when a ring userData entry is missing', () => {
      const enemy = makeNovaSovereign();
      // Remove one ring to simulate a partially-built mesh.
      delete enemy.mesh!.userData['novaSovereignOrb1'];
      const enemies = new Map([['nova', enemy]]);

      expect(() => service.updateEnemyAnimations(enemies, 0.016)).not.toThrow();

      for (const i of [0, 2]) {
        const ring = enemy.mesh!.userData[`novaSovereignOrb${i}`] as THREE.Mesh;
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      }
    });

    it('skips orb animation for dying NOVA_SOVEREIGN', () => {
      const enemy = makeNovaSovereign();
      enemy.dying = true;
      const enemies = new Map([['nova', enemy]]);

      service.updateEnemyAnimations(enemies, 0.5);

      for (let i = 0; i < 3; i++) {
        const ring = enemy.mesh!.userData[`novaSovereignOrb${i}`] as THREE.Mesh;
        expect(ring.rotation.y).toBe(0);
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // NOVA_SOVEREIGN enrage visual (Fix 2)
  // ---------------------------------------------------------------------------

  describe('updateStatusVisuals — NOVA_SOVEREIGN enrage', () => {
    it('applies enrage emissive when isEnraged and no status effects', () => {
      const enemy = makeEnemy('nova', EnemyType.NOVA_SOVEREIGN);
      enemy.isEnraged = true;
      const enemies = new Map([['nova', enemy]]);

      service.updateStatusVisuals(enemies, new Map());

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(NOVA_SOVEREIGN_ENRAGE_VISUAL.emissiveColor);
      expect(mat.emissiveIntensity).toBe(NOVA_SOVEREIGN_ENRAGE_VISUAL.emissiveIntensity);
    });

    it('does not apply enrage emissive when isEnraged is false', () => {
      const enemy = makeEnemy('nova', EnemyType.NOVA_SOVEREIGN);
      enemy.isEnraged = false;
      const enemies = new Map([['nova', enemy]]);

      service.updateStatusVisuals(enemies, new Map());

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      // Should be base color, not the enrage color
      expect(mat.emissive.getHex()).not.toBe(NOVA_SOVEREIGN_ENRAGE_VISUAL.emissiveColor);
    });

    it('status tint takes priority over enrage emissive', () => {
      const enemy = makeEnemy('nova', EnemyType.NOVA_SOVEREIGN);
      enemy.isEnraged = true;
      const enemies = new Map([['nova', enemy]]);
      const effects = new Map([['nova', [StatusEffectType.BURN]]]);

      service.updateStatusVisuals(enemies, effects);

      const mat = enemy.mesh!.material as THREE.MeshStandardMaterial;
      // BURN emissive should win — the enrage path only fires when effects.length === 0
      expect(mat.emissive.getHex()).toBe(0xff6622);
      expect(mat.emissive.getHex()).not.toBe(NOVA_SOVEREIGN_ENRAGE_VISUAL.emissiveColor);
    });

    it('enrage also tints child meshes (boss crown if present)', () => {
      const enemy = makeEnemy('nova', EnemyType.NOVA_SOVEREIGN);
      enemy.isEnraged = true;
      // Attach a fake crown to verify tintChildMeshes is called with enrage values
      const crownGeo = new THREE.TorusGeometry(0.4, 0.05);
      const crownMat = new THREE.MeshStandardMaterial();
      const crown = new THREE.Mesh(crownGeo, crownMat);
      enemy.mesh!.userData['bossCrown'] = crown;
      const enemies = new Map([['nova', enemy]]);

      service.updateStatusVisuals(enemies, new Map());

      expect(crownMat.emissive.getHex()).toBe(NOVA_SOVEREIGN_ENRAGE_VISUAL.emissiveColor);
      expect(crownMat.emissiveIntensity).toBe(NOVA_SOVEREIGN_ENRAGE_VISUAL.emissiveIntensity);

      crownGeo.dispose();
      crownMat.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // WYRM_ASCENDANT wyrmEyeGlow tinting (Fix 3)
  // ---------------------------------------------------------------------------

  describe('tintChildMeshes — wyrmEyeGlow', () => {
    function makeWyrm(): Enemy {
      const enemy = makeEnemy('wyrm', EnemyType.WYRM_ASCENDANT);
      const eyeGeo = new THREE.TorusGeometry(0.3, 0.05);
      const eyeMat = new THREE.MeshStandardMaterial({ emissive: new THREE.Color(0xff2200) });
      const eyeGlow = new THREE.Mesh(eyeGeo, eyeMat);
      enemy.mesh!.userData['wyrmEyeGlow'] = eyeGlow;
      return enemy;
    }

    it('tints wyrmEyeGlow when BURN status is active', () => {
      const enemy = makeWyrm();
      const enemies = new Map([['wyrm', enemy]]);
      const effects = new Map([['wyrm', [StatusEffectType.BURN]]]);

      service.updateStatusVisuals(enemies, effects);

      const eyeGlow = enemy.mesh!.userData['wyrmEyeGlow'] as THREE.Mesh;
      const eyeMat = eyeGlow.material as THREE.MeshStandardMaterial;
      expect(eyeMat.emissive.getHex()).toBe(0xff6622);

      eyeGlow.geometry.dispose();
      eyeMat.dispose();
    });

    it('tints wyrmEyeGlow when SLOW status is active', () => {
      const enemy = makeWyrm();
      const enemies = new Map([['wyrm', enemy]]);
      const effects = new Map([['wyrm', [StatusEffectType.SLOW]]]);

      service.updateStatusVisuals(enemies, effects);

      const eyeGlow = enemy.mesh!.userData['wyrmEyeGlow'] as THREE.Mesh;
      const eyeMat = eyeGlow.material as THREE.MeshStandardMaterial;
      expect(eyeMat.emissive.getHex()).toBe(0x4488ff);

      eyeGlow.geometry.dispose();
      eyeMat.dispose();
    });

    it('restores wyrmEyeGlow emissive when effects clear', () => {
      const enemy = makeWyrm();
      const enemies = new Map([['wyrm', enemy]]);

      // Apply BURN
      service.updateStatusVisuals(enemies, new Map([['wyrm', [StatusEffectType.BURN]]]));
      // Clear effects
      service.updateStatusVisuals(enemies, new Map());

      const eyeGlow = enemy.mesh!.userData['wyrmEyeGlow'] as THREE.Mesh;
      const eyeMat = eyeGlow.material as THREE.MeshStandardMaterial;
      // Should be base color, not BURN
      expect(eyeMat.emissive.getHex()).not.toBe(0xff6622);

      eyeGlow.geometry.dispose();
      eyeMat.dispose();
    });

    it('does not throw when wyrmEyeGlow userData is absent', () => {
      const enemy = makeEnemy('basic', EnemyType.BASIC);
      const enemies = new Map([['basic', enemy]]);
      const effects = new Map([['basic', [StatusEffectType.POISON]]]);

      expect(() => service.updateStatusVisuals(enemies, effects)).not.toThrow();
    });
  });

  // cleanup
  // ---------------------------------------------------------------------------

  describe('cleanup', () => {
    it('disposes shared geometry and materials', () => {
      const enemy = makeEnemy('e1');
      mockScene.add(enemy.mesh!);
      const enemies = new Map([['e1', enemy]]);

      // Trigger lazy creation of shared geometry/material
      service.updateStatusEffectParticles(
        enemies, 0.016, mockScene, new Map([['e1', [StatusEffectType.BURN]]])
      );

      // Cleanup should not throw
      expect(() => service.cleanup()).not.toThrow();

      // After cleanup, calling cleanup again is safe (no double-dispose)
      expect(() => service.cleanup()).not.toThrow();
    });
  });
});
