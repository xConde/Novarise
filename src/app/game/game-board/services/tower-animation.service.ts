import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { TowerType } from '../models/tower.model';
import { BlockType } from '../models/game-board-tile';
import { ANIMATION_CONFIG } from '../constants/rendering.constants';
import { TOWER_ANIM_CONFIG, TILE_PULSE_CONFIG } from '../constants/effects.constants';

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
