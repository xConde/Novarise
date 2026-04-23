import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { PlacedTower, TowerType } from '../models/tower.model';
import { BlockType } from '../models/game-board-tile';
import { ANIMATION_CONFIG } from '../constants/rendering.constants';
import { MUZZLE_FLASH_CONFIG, TOWER_ANIM_CONFIG, TILE_PULSE_CONFIG } from '../constants/effects.constants';
import { getMaterials } from '../utils/three-utils';

@Injectable()
export class TowerAnimationService {
  /** Animate tower idle effects (crystal bob, orb pulse, spark bob, spore bob, tip glow). */
  updateTowerAnimations(towerMeshes: Map<string, THREE.Group>, time: number): void {
    const t = time * ANIMATION_CONFIG.msToSeconds;
    for (const group of towerMeshes.values()) {
      const towerType = group.userData['towerType'] as TowerType | undefined;
      if (!towerType) continue;

      group.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        switch (child.name) {
          case 'crystal':
            if (towerType === TowerType.BASIC) {
              child.position.y = TOWER_ANIM_CONFIG.crystalBaseY
                + Math.sin(t * TOWER_ANIM_CONFIG.crystalBobSpeed) * TOWER_ANIM_CONFIG.crystalBobAmplitude;
              child.rotation.y = t * TOWER_ANIM_CONFIG.basicCrystalRotSpeed;
            } else if (towerType === TowerType.SLOW) {
              child.position.y = TOWER_ANIM_CONFIG.slowCrystalBaseY
                + Math.sin(t * TOWER_ANIM_CONFIG.crystalBobSpeed) * TOWER_ANIM_CONFIG.slowCrystalBobAmplitude;
              child.rotation.y = t * TOWER_ANIM_CONFIG.slowCrystalRotSpeed;
            }
            break;

          case 'orb': {
            const pulseScale = TOWER_ANIM_CONFIG.orbPulseMin
              + (Math.sin(t * TOWER_ANIM_CONFIG.orbPulseSpeed) * 0.5 + 0.5)
              * (TOWER_ANIM_CONFIG.orbPulseMax - TOWER_ANIM_CONFIG.orbPulseMin);
            child.scale.setScalar(pulseScale);
            break;
          }

          case 'spark': {
            if (child.userData['baseY'] === undefined) child.userData['baseY'] = child.position.y;
            child.position.y = child.userData['baseY']
              + Math.sin(t * TOWER_ANIM_CONFIG.sparkBobSpeed + child.position.x * TOWER_ANIM_CONFIG.sparkPhaseScale) * TOWER_ANIM_CONFIG.sparkBobAmplitude;
            break;
          }

          case 'spore': {
            if (child.userData['baseY'] === undefined) child.userData['baseY'] = child.position.y;
            child.position.y = child.userData['baseY']
              + Math.sin(t * TOWER_ANIM_CONFIG.sporeBobSpeed + child.position.x * TOWER_ANIM_CONFIG.sporePhaseScale) * TOWER_ANIM_CONFIG.sporeBobAmplitude;
            break;
          }

          case 'tip': {
            const mat = child.material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = TOWER_ANIM_CONFIG.tipGlowMin
              + (Math.sin(t * TOWER_ANIM_CONFIG.tipGlowSpeed) * 0.5 + 0.5)
              * (TOWER_ANIM_CONFIG.tipGlowMax - TOWER_ANIM_CONFIG.tipGlowMin);
            break;
          }
        }
      });
    }
  }

  /**
   * Spikes emissive intensity on all non-tip meshes in the tower's group when it fires.
   * Saves the current intensity per mesh so `updateMuzzleFlashes` can restore it exactly.
   * Calling again while a flash is already active resets the timer (re-trigger on rapid fire).
   */
  startMuzzleFlash(tower: PlacedTower): void {
    if (!tower.mesh) return;

    // Only save original values on FIRST flash — if a flash is already active,
    // reuse the existing saved values to prevent accumulation (each re-save
    // would capture the already-spiked intensity, ratcheting up forever).
    const isReflash = tower.muzzleFlashTimer !== undefined && tower.muzzleFlashTimer > 0;

    if (!isReflash) {
      const saved = new Map<string, number>();

      tower.mesh.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        if (child.name === 'tip') return;

        const materials = getMaterials(child) as THREE.MeshStandardMaterial[];

        for (const mat of materials) {
          if (mat.emissiveIntensity === undefined) continue;
          saved.set(child.uuid + '_' + mat.uuid, mat.emissiveIntensity);
        }
      });

      tower.originalEmissiveIntensity = saved;
    }

    // Apply the spike from the SAVED originals, not from current (possibly spiked) values
    const originals = tower.originalEmissiveIntensity;
    if (originals) {
      tower.mesh.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        if (child.name === 'tip') return;

        const materials = getMaterials(child) as THREE.MeshStandardMaterial[];

        for (const mat of materials) {
          const key = child.uuid + '_' + mat.uuid;
          const base = originals.get(key);
          if (base !== undefined) {
            mat.emissiveIntensity = base * MUZZLE_FLASH_CONFIG.intensityMultiplier;
          }
        }
      });
    }

    tower.muzzleFlashTimer = MUZZLE_FLASH_CONFIG.duration;
  }

  /**
   * Counts down active muzzle flash timers and restores original emissive intensity when done.
   * Call once per animation frame with the real-world deltaTime (seconds).
   */
  updateMuzzleFlashes(towers: Map<string, PlacedTower>, deltaTime: number): void {
    for (const tower of towers.values()) {
      if (tower.muzzleFlashTimer === undefined || !tower.mesh) continue;

      tower.muzzleFlashTimer -= deltaTime;

      if (tower.muzzleFlashTimer <= 0) {
        // Restore saved intensities
        const saved = tower.originalEmissiveIntensity;
        if (saved) {
          tower.mesh.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            if (child.name === 'tip') return;

            const materials = getMaterials(child) as THREE.MeshStandardMaterial[];

            for (const mat of materials) {
              const key = child.uuid + '_' + mat.uuid;
              const original = saved.get(key);
              if (original !== undefined) {
                mat.emissiveIntensity = original;
              }
            }
          });
        }

        tower.muzzleFlashTimer = undefined;
        tower.originalEmissiveIntensity = undefined;
      }
    }
  }

  /** Pulse spawner and exit tile emissive intensity. */
  updateTilePulse(tileMeshes: Map<string, THREE.Mesh>, time: number): void {
    const t = time * ANIMATION_CONFIG.msToSeconds;
    const intensity = TILE_PULSE_CONFIG.min
      + (Math.sin(t * TILE_PULSE_CONFIG.speed) * 0.5 + 0.5)
      * (TILE_PULSE_CONFIG.max - TILE_PULSE_CONFIG.min);

    for (const mesh of tileMeshes.values()) {
      const tileType = mesh.userData?.['tile']?.type;
      if (tileType === BlockType.SPAWNER || tileType === BlockType.EXIT) {
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
      }
    }
  }
}
