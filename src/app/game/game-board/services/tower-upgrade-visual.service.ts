import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { TOWER_UPGRADE_VISUAL_CONFIG, SPECIALIZATION_VISUAL_CONFIG } from '../constants/effects.constants';
import { TowerSpecialization } from '../models/tower.model';
import { TOWER_VISUAL_CONFIG } from '../constants/ui.constants';

interface FlashEffect {
  sprite: THREE.Sprite;
  age: number;
}

@Injectable()
export class TowerUpgradeVisualService {
  private flashes: FlashEffect[] = [];
  private glowRings: Map<string, THREE.Mesh> = new Map();

  /**
   * Apply level-based scale to a tower mesh group.
   * Level is 1-indexed (1, 2, 3).
   */
  applyLevelScale(towerGroup: THREE.Group, level: number): void {
    const scaleIndex = Math.min(level - 1, TOWER_UPGRADE_VISUAL_CONFIG.scalePerLevel.length - 1);
    const scale = TOWER_UPGRADE_VISUAL_CONFIG.scalePerLevel[Math.max(0, scaleIndex)];
    towerGroup.scale.set(scale, scale, scale);
  }

  /**
   * Spawn a brief white flash sprite at the tower's position.
   */
  spawnUpgradeFlash(position: { x: number; y: number; z: number }, scene: THREE.Scene): void {
    const config = TOWER_UPGRADE_VISUAL_CONFIG.flash;
    const material = new THREE.SpriteMaterial({
      color: config.color,
      transparent: true,
      opacity: config.opacity,
      depthTest: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(config.size, config.size, 1);
    sprite.position.set(position.x, position.y + 0.5, position.z);

    scene.add(sprite);
    this.flashes.push({ sprite, age: 0 });
  }

  /**
   * Add a glow ring at the base of an upgraded tower.
   * towerId is used to track and replace existing rings.
   */
  addGlowRing(towerId: string, position: { x: number; z: number }, scene: THREE.Scene): void {
    // Remove existing ring for this tower if any
    this.removeGlowRing(towerId, scene);

    const config = TOWER_UPGRADE_VISUAL_CONFIG.glowRing;
    const geometry = new THREE.RingGeometry(config.innerRadius, config.outerRadius, config.segments);
    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: config.opacity,
      side: THREE.DoubleSide,
    });

    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2; // Lay flat on ground
    ring.position.set(position.x, 0.02, position.z);

    scene.add(ring);
    this.glowRings.set(towerId, ring);
  }

  /**
   * Remove a specific tower's glow ring.
   */
  removeGlowRing(towerId: string, scene: THREE.Scene): void {
    const ring = this.glowRings.get(towerId);
    if (ring) {
      scene.remove(ring);
      ring.geometry.dispose();
      (ring.material as THREE.MeshBasicMaterial).dispose();
      this.glowRings.delete(towerId);
    }
  }

  /**
   * Update flash effects — fade and remove expired ones.
   */
  update(deltaTime: number, scene: THREE.Scene): void {
    if (deltaTime <= 0) {
      return;
    }

    const config = TOWER_UPGRADE_VISUAL_CONFIG.flash;
    const alive: FlashEffect[] = [];

    for (const flash of this.flashes) {
      flash.age += deltaTime;

      if (flash.age >= config.duration) {
        scene.remove(flash.sprite);
        flash.sprite.material.dispose();
      } else {
        const remaining = 1 - flash.age / config.duration;
        (flash.sprite.material as THREE.SpriteMaterial).opacity = config.opacity * remaining;
        // Scale up as it fades
        const expandedSize = config.size * (1 + flash.age / config.duration);
        flash.sprite.scale.set(expandedSize, expandedSize, 1);
        alive.push(flash);
      }
    }

    this.flashes = alive;
  }

  /**
   * Dispose all tracked resources.
   */
  cleanup(scene?: THREE.Scene): void {
    for (const flash of this.flashes) {
      if (scene) {
        scene.remove(flash.sprite);
      }
      flash.sprite.material.dispose();
    }
    this.flashes = [];

    for (const [_id, ring] of this.glowRings) {
      if (scene) {
        scene.remove(ring);
      }
      ring.geometry.dispose();
      (ring.material as THREE.MeshBasicMaterial).dispose();
    }
    this.glowRings.clear();
  }

  get flashCount(): number {
    return this.flashes.length;
  }

  get ringCount(): number {
    return this.glowRings.size;
  }

  /**
   * Apply level-based scale AND emissive boost to a tower mesh group.
   * Skips 'tip' and 'orb' children whose emissive is driven per-frame by TowerAnimationService.
   * Call this after a successful upgrade (L1→L2 or L2→L3).
   */
  applyUpgradeVisuals(towerGroup: THREE.Group, newLevel: number, specialization?: TowerSpecialization): void {
    const scale = TOWER_VISUAL_CONFIG.scaleBase + (newLevel - 1) * TOWER_VISUAL_CONFIG.scaleIncrement;
    towerGroup.scale.set(scale, scale, scale);

    const animatedNames = new Set(['tip', 'orb']);
    towerGroup.traverse(child => {
      if (
        child instanceof THREE.Mesh &&
        child.material instanceof THREE.MeshStandardMaterial &&
        !animatedNames.has(child.name)
      ) {
        child.material.emissiveIntensity =
          TOWER_VISUAL_CONFIG.emissiveBase + (newLevel - 1) * TOWER_VISUAL_CONFIG.emissiveIncrement;
      }
    });

    if (specialization) {
      this.applySpecializationVisual(towerGroup, specialization);
    }
  }

  /**
   * Apply ALPHA (warm orange) or BETA (cool blue) emissive tint to all MeshStandardMaterial
   * children in the tower group. Skips 'tip' and 'orb' mesh names whose emissive is
   * driven per-frame by TowerAnimationService.
   */
  applySpecializationVisual(towerGroup: THREE.Group, spec: TowerSpecialization): void {
    const config = spec === TowerSpecialization.ALPHA
      ? SPECIALIZATION_VISUAL_CONFIG.alpha
      : SPECIALIZATION_VISUAL_CONFIG.beta;
    const animatedNames = new Set(['tip', 'orb']);
    towerGroup.traverse(child => {
      if (child instanceof THREE.Mesh && !animatedNames.has(child.name)) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of materials) {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.emissive.set(config.emissiveTint);
            mat.emissiveIntensity = config.emissiveIntensity;
          }
        }
      }
    });
  }
}
