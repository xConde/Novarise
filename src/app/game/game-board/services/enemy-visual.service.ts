import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy, ENEMY_STATS } from '../models/enemy.model';
import { StatusEffectType } from '../constants/status-effect.constants';
import {
  STATUS_EFFECT_VISUALS,
  STATUS_EFFECT_VISUAL_CONFIG,
  STATUS_EFFECT_PRIORITY,
  ENEMY_ANIM_CONFIG,
} from '../constants/effects.constants';
import { ENEMY_VISUAL_CONFIG } from '../constants/ui.constants';

/**
 * Owns all per-frame visual and particle updates for enemies.
 *
 * Extracted from EnemyService to keep that service focused on
 * spawn/movement/damage logic. This service manages:
 * - Status-effect emissive tinting
 * - Status-effect particle meshes (BURN/POISON/SLOW)
 * - Boss crown idle animation
 *
 * Shared particle geometry and one MeshBasicMaterial per effect type are
 * created lazily and disposed in cleanup().
 */
@Injectable()
export class EnemyVisualService {
  /** Shared SphereGeometry reused for all status-effect particles. */
  private statusParticleGeometry: THREE.SphereGeometry | null = null;
  /** One shared MeshBasicMaterial per active effect type. */
  private statusParticleMaterials: Partial<Record<StatusEffectType, THREE.MeshBasicMaterial>> = {};

  // -------------------------------------------------------------------------
  // Public API — called once per render frame by EnemyService
  // -------------------------------------------------------------------------

  /**
   * Tint enemy mesh emissive color based on active status effects.
   * Highest-priority effect wins (BURN > POISON > SLOW).
   * Enemies with no active effects revert to their base emissive.
   */
  updateStatusVisuals(
    enemies: Map<string, Enemy>,
    activeEffects: Map<string, StatusEffectType[]>,
  ): void {
    enemies.forEach(enemy => {
      if (!enemy.mesh) return;
      if (enemy.dying) return;
      const mat = enemy.mesh.material as THREE.MeshStandardMaterial;
      if (!mat.emissive) return;

      const effects = activeEffects.get(enemy.id);
      if (effects && effects.length > 0) {
        // Pick highest-priority active effect for visual
        for (const priority of STATUS_EFFECT_PRIORITY) {
          if (effects.includes(priority)) {
            const visual = STATUS_EFFECT_VISUALS[priority];
            mat.emissive.setHex(visual.emissiveColor);
            mat.emissiveIntensity = visual.emissiveIntensity;
            this.tintChildMeshes(enemy.mesh, visual.emissiveColor, visual.emissiveIntensity);
            return;
          }
        }
      }

      // No effects — restore base emissive
      const stats = ENEMY_STATS[enemy.type];
      const baseIntensity = enemy.isMiniSwarm
        ? ENEMY_VISUAL_CONFIG.miniSwarmEmissive
        : ENEMY_VISUAL_CONFIG.baseEmissive;
      mat.emissive.setHex(stats.color);
      mat.emissiveIntensity = baseIntensity;
      this.tintChildMeshes(enemy.mesh, stats.color, baseIntensity);
    });
  }

  /**
   * Create/animate/remove small particle meshes for active status effects.
   * Particles are added directly to the scene (not as children of the enemy mesh) so
   * they trail slightly behind. Each enemy gets at most
   * STATUS_EFFECT_VISUAL_CONFIG.maxParticlesPerEnemy particles per active effect.
   *
   * Call once per render frame (NOT inside the fixed-timestep physics loop).
   */
  updateStatusEffectParticles(
    enemies: Map<string, Enemy>,
    deltaTime: number,
    scene: THREE.Scene,
    activeEffects: Map<string, StatusEffectType[]>,
  ): void {
    if (deltaTime <= 0) return;

    enemies.forEach(enemy => {
      // Skip dying enemies — remove any lingering particles
      if (enemy.dying) {
        this.removeStatusParticles(enemy, scene);
        return;
      }

      const effects = activeEffects.get(enemy.id);

      if (!effects || effects.length === 0) {
        // No active effects — remove any lingering particles
        this.removeStatusParticles(enemy, scene);
        return;
      }

      // Determine the highest-priority effect to display (same priority order as emissive tint)
      let activeEffect: StatusEffectType | null = null;
      for (const priority of STATUS_EFFECT_PRIORITY) {
        if (effects.includes(priority)) {
          activeEffect = priority;
          break;
        }
      }
      if (!activeEffect) {
        this.removeStatusParticles(enemy, scene);
        return;
      }

      // Create particles on first activation for this effect
      if (!enemy.statusParticles || enemy.statusParticles.length === 0) {
        enemy.statusParticles = this.createStatusParticles(activeEffect, scene, enemy);
      }

      // Animate existing particles
      const cfg = STATUS_EFFECT_VISUAL_CONFIG[
        activeEffect === StatusEffectType.BURN
          ? 'burn'
          : activeEffect === StatusEffectType.POISON
            ? 'poison'
            : 'slow'
      ];

      enemy.statusParticles.forEach((particle, i) => {
        let timer = (particle.userData['timer'] as number) ?? 0;
        timer += deltaTime;

        if (timer >= cfg.lifetime) {
          // Respawn at enemy base with a new random offset
          timer = 0;
          this.resetStatusParticlePosition(particle, enemy, activeEffect!, i);
        }

        // Animate position based on effect type
        const progress = timer / cfg.lifetime;
        if (activeEffect === StatusEffectType.BURN) {
          // Drift upward
          particle.position.y = enemy.position.y + progress * cfg.speed;
        } else if (activeEffect === StatusEffectType.POISON) {
          // Drift outward in XZ plane
          const angle = particle.userData['angle'] as number;
          const dist = progress * cfg.speed;
          particle.position.x = enemy.position.x + Math.cos(angle) * dist;
          particle.position.z = enemy.position.z + Math.sin(angle) * dist;
        } else {
          // SLOW: drift downward
          particle.position.y = enemy.position.y - progress * cfg.speed;
        }

        particle.userData['timer'] = timer;
      });
    });
  }

  /**
   * Spin boss crowns for visual flair. Called once per frame.
   */
  updateEnemyAnimations(enemies: Map<string, Enemy>, deltaTime: number): void {
    enemies.forEach(enemy => {
      if (!enemy.mesh || enemy.health <= 0) return;
      if (enemy.dying) return;
      const crown = enemy.mesh.userData['bossCrown'] as THREE.Mesh | undefined;
      if (crown) {
        crown.rotation.z += ENEMY_ANIM_CONFIG.bossCrownSpinSpeed * deltaTime;
      }
    });
  }

  /**
   * Dispose and remove all status particles from the scene for the given enemy.
   * Called from EnemyService.removeEnemy() and when effects expire.
   */
  removeStatusParticles(enemy: Enemy, scene: THREE.Scene): void {
    if (!enemy.statusParticles || enemy.statusParticles.length === 0) return;
    for (const particle of enemy.statusParticles) {
      scene.remove(particle);
      // Geometry and material are shared — do NOT dispose per-particle
    }
    enemy.statusParticles = [];
  }

  /**
   * Dispose the shared particle geometry and all shared materials.
   * Call on game reset or component teardown.
   */
  cleanup(): void {
    if (this.statusParticleGeometry) {
      this.statusParticleGeometry.dispose();
      this.statusParticleGeometry = null;
    }
    for (const mat of Object.values(this.statusParticleMaterials)) {
      mat?.dispose();
    }
    this.statusParticleMaterials = {};
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Create maxParticlesPerEnemy particles for the given effect and add them to the scene. */
  private createStatusParticles(
    effectType: StatusEffectType,
    scene: THREE.Scene,
    enemy: Enemy,
  ): THREE.Mesh[] {
    const geometry = this.getStatusParticleGeometry();
    const material = this.getStatusParticleMaterial(effectType);
    const count = STATUS_EFFECT_VISUAL_CONFIG.maxParticlesPerEnemy;
    const particles: THREE.Mesh[] = [];

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      // Stagger initial timers so particles don't all reset at once
      const cfgKey = effectType === StatusEffectType.BURN
        ? 'burn' : effectType === StatusEffectType.POISON ? 'poison' : 'slow';
      const cfg = STATUS_EFFECT_VISUAL_CONFIG[cfgKey];
      const initialTimer = (i / count) * cfg.lifetime;
      mesh.userData['timer'] = initialTimer;
      this.resetStatusParticlePosition(mesh, enemy, effectType, i);
      scene.add(mesh);
      particles.push(mesh);
    }

    return particles;
  }

  /** Set the initial/reset position for a status particle with a random spread offset. */
  private resetStatusParticlePosition(
    particle: THREE.Mesh,
    enemy: Enemy,
    effectType: StatusEffectType,
    index: number,
  ): void {
    const cfgKey = effectType === StatusEffectType.BURN
      ? 'burn' : effectType === StatusEffectType.POISON ? 'poison' : 'slow';
    const cfg = STATUS_EFFECT_VISUAL_CONFIG[cfgKey];

    const offsetX = (Math.random() - 0.5) * 2 * cfg.spread;
    const offsetZ = (Math.random() - 0.5) * 2 * cfg.spread;

    if (effectType === StatusEffectType.BURN) {
      particle.position.set(
        enemy.position.x + offsetX,
        enemy.position.y,
        enemy.position.z + offsetZ,
      );
    } else if (effectType === StatusEffectType.POISON) {
      // Store a fixed outward angle per particle so it orbits consistently
      const angle =
        (index / STATUS_EFFECT_VISUAL_CONFIG.maxParticlesPerEnemy) * Math.PI * 2
        + (Math.random() - 0.5) * 0.5;
      particle.userData['angle'] = angle;
      particle.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
    } else {
      // SLOW: start above enemy center, drift down
      particle.position.set(
        enemy.position.x + offsetX,
        enemy.position.y + cfg.speed,
        enemy.position.z + offsetZ,
      );
    }
  }

  /** Lazily create the shared particle geometry (reused for all effect types). */
  private getStatusParticleGeometry(): THREE.SphereGeometry {
    if (!this.statusParticleGeometry) {
      this.statusParticleGeometry = new THREE.SphereGeometry(
        STATUS_EFFECT_VISUAL_CONFIG.particleSize, 4, 4,
      );
    }
    return this.statusParticleGeometry;
  }

  /** Lazily create a shared MeshBasicMaterial for the given effect type. */
  private getStatusParticleMaterial(effectType: StatusEffectType): THREE.MeshBasicMaterial {
    let material = this.statusParticleMaterials[effectType];
    if (!material) {
      const cfgKey = effectType === StatusEffectType.BURN
        ? 'burn' : effectType === StatusEffectType.POISON ? 'poison' : 'slow';
      const cfg = STATUS_EFFECT_VISUAL_CONFIG[cfgKey];
      material = new THREE.MeshBasicMaterial({ color: cfg.color });
      this.statusParticleMaterials[effectType] = material;
    }
    return material;
  }

  /**
   * Apply emissive tint to child meshes that have MeshStandardMaterial (e.g., boss crown).
   * Skips health bar children (MeshBasicMaterial) and shield mesh.
   */
  private tintChildMeshes(mesh: THREE.Mesh, color: number, intensity: number): void {
    const crown = mesh.userData['bossCrown'] as THREE.Mesh | undefined;
    if (crown) {
      const crownMat = crown.material as THREE.MeshStandardMaterial;
      if (crownMat.emissive) {
        crownMat.emissive.setHex(color);
        crownMat.emissiveIntensity = intensity;
      }
    }
  }
}
