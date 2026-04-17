import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy, EnemyType } from '../models/enemy.model';
import { HEALTH_BAR_CONFIG, SHIELD_BAR_CONFIG, SHIELD_VISUAL_CONFIG } from '../constants/ui.constants';
import { DEATH_ANIM_CONFIG, HIT_FLASH_CONFIG, SHIELD_BREAK_CONFIG } from '../constants/effects.constants';

/**
 * Owns all per-frame health-state visual updates for enemies.
 *
 * Extracted from EnemyService to keep that service focused on
 * spawn/movement/damage logic. This service manages:
 * - Health bar billboard rendering
 * - Hit flash (white emissive pulse on damage)
 * - Death shrink-fade animation
 * - Shield dome break animation
 *
 * Operates directly against the enemies Map owned by EnemyService.
 * Call sites pass the Map in on each tick rather than injecting EnemyService
 * to avoid a circular dependency.
 */
@Injectable()
export class EnemyHealthService {
  /** Scratch quaternion reused each frame to avoid per-enemy allocation in billboarding. */
  private billboardScratchQuat = new THREE.Quaternion();

  // -------------------------------------------------------------------------
  // Health bars
  // -------------------------------------------------------------------------

  /**
   * Sync every enemy's health-bar fill and color to its current health ratio.
   * @param enemies  Live enemy map owned by EnemyService.
   * @param cameraQuaternion When provided, billboards health-bar planes to face
   *   the camera, compensating for the parent enemy mesh's own rotation.
   *   Omit during unit tests or when billboarding is not needed.
   */
  updateHealthBars(enemies: Map<string, Enemy>, cameraQuaternion?: THREE.Quaternion): void {
    enemies.forEach(enemy => {
      if (!enemy.mesh) return;
      // Hide health bar while dying — avoids flickering during scale-down
      if (enemy.dying) return;
      // The health bar is stored in userData
      const healthBarBg = enemy.mesh.userData?.['healthBarBg'] as THREE.Mesh | undefined;
      const healthBarFg = enemy.mesh.userData?.['healthBarFg'] as THREE.Mesh | undefined;

      if (healthBarBg && healthBarFg) {
        const healthPct = Math.max(0, enemy.health / enemy.maxHealth);
        healthBarFg.scale.x = healthPct;
        healthBarFg.position.x = -(1 - healthPct) * (HEALTH_BAR_CONFIG.width / 2);

        // Color transitions: green -> yellow -> red
        const mat = healthBarFg.material as THREE.MeshBasicMaterial;
        if (healthPct > HEALTH_BAR_CONFIG.thresholdHigh) {
          mat.color.setHex(HEALTH_BAR_CONFIG.colorGreen);
        } else if (healthPct > HEALTH_BAR_CONFIG.thresholdLow) {
          mat.color.setHex(HEALTH_BAR_CONFIG.colorYellow);
        } else {
          mat.color.setHex(HEALTH_BAR_CONFIG.colorRed);
        }

        // Billboard: face camera (compensate for parent enemy rotation)
        if (cameraQuaternion) {
          enemy.mesh.getWorldQuaternion(this.billboardScratchQuat);
          this.billboardScratchQuat.invert().premultiply(cameraQuaternion);
          healthBarBg.quaternion.copy(this.billboardScratchQuat);
          healthBarFg.quaternion.copy(this.billboardScratchQuat);
        }
      }

      // Shield bar — SHIELDED enemies only, hidden once shield breaks.
      const shieldBarBg = enemy.mesh.userData?.['shieldBarBg'] as THREE.Mesh | undefined;
      const shieldBarFg = enemy.mesh.userData?.['shieldBarFg'] as THREE.Mesh | undefined;
      if (shieldBarBg && shieldBarFg) {
        const hasShield = enemy.shield !== undefined && enemy.maxShield !== undefined && enemy.shield > 0;
        shieldBarBg.visible = hasShield;
        shieldBarFg.visible = hasShield;

        if (hasShield) {
          const shieldPct = Math.max(0, enemy.shield! / enemy.maxShield!);
          shieldBarFg.scale.x = shieldPct;
          shieldBarFg.position.x = -(1 - shieldPct) * (SHIELD_BAR_CONFIG.width / 2);

          if (cameraQuaternion) {
            // Recompute billboard quaternion — don't depend on the health-bar
            // block having populated the scratch field, since an enemy could
            // theoretically have a shield bar without a health bar.
            enemy.mesh.getWorldQuaternion(this.billboardScratchQuat);
            this.billboardScratchQuat.invert().premultiply(cameraQuaternion);
            shieldBarBg.quaternion.copy(this.billboardScratchQuat);
            shieldBarFg.quaternion.copy(this.billboardScratchQuat);
          }
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // Hit flash
  // -------------------------------------------------------------------------

  /**
   * Trigger a brief white emissive flash on the hit enemy.
   * No-op if the enemy is dying, already flashing, or not found.
   * Saves the current emissive color/intensity so they can be restored
   * when the flash expires — compatible with status-effect tinting.
   */
  startHitFlash(enemies: Map<string, Enemy>, enemyId: string): void {
    const enemy = enemies.get(enemyId);
    if (!enemy || enemy.dying) return;
    // Throttle: skip if already mid-flash
    if (enemy.hitFlashTimer !== undefined && enemy.hitFlashTimer > 0) return;
    if (!enemy.mesh) return;

    enemy.hitFlashTimer = HIT_FLASH_CONFIG.duration;

    const mat = enemy.mesh.material;
    if (mat instanceof THREE.MeshStandardMaterial) {
      // Snapshot current emissive so we can restore it when the flash ends
      enemy.mesh.userData['preFlashEmissive'] = mat.emissive.getHex();
      enemy.mesh.userData['preFlashEmissiveIntensity'] = mat.emissiveIntensity;
      mat.emissive.setHex(HIT_FLASH_CONFIG.color);
      mat.emissiveIntensity = HIT_FLASH_CONFIG.emissiveIntensity;
    }
    // Apply the same flash to the boss crown if present
    const crown = enemy.mesh.userData['bossCrown'] as THREE.Mesh | undefined;
    if (crown && crown.material instanceof THREE.MeshStandardMaterial) {
      crown.userData['preFlashEmissive'] = crown.material.emissive.getHex();
      crown.userData['preFlashEmissiveIntensity'] = crown.material.emissiveIntensity;
      crown.material.emissive.setHex(HIT_FLASH_CONFIG.color);
      crown.material.emissiveIntensity = HIT_FLASH_CONFIG.emissiveIntensity;
    }
  }

  /**
   * Tick all active hit-flash timers and restore emissive when each expires.
   * Call once per render frame (not inside fixed-timestep physics) so the flash
   * duration is decoupled from game speed.
   */
  updateHitFlashes(enemies: Map<string, Enemy>, deltaTime: number): void {
    if (deltaTime <= 0) return;

    enemies.forEach(enemy => {
      if (enemy.hitFlashTimer === undefined || enemy.hitFlashTimer <= 0) return;

      // Cancel in-progress flash if enemy started dying — let death animation own visuals
      if (enemy.dying) {
        enemy.hitFlashTimer = 0;
        return;
      }

      enemy.hitFlashTimer -= deltaTime;

      if (enemy.hitFlashTimer <= 0) {
        enemy.hitFlashTimer = 0;
        if (!enemy.mesh) return;

        // Restore the snapshotted emissive (may be status-effect color)
        const savedColor = enemy.mesh.userData['preFlashEmissive'] as number | undefined;
        const savedIntensity = enemy.mesh.userData['preFlashEmissiveIntensity'] as number | undefined;
        const mat = enemy.mesh.material;
        if (mat instanceof THREE.MeshStandardMaterial) {
          if (savedColor !== undefined) mat.emissive.setHex(savedColor);
          if (savedIntensity !== undefined) mat.emissiveIntensity = savedIntensity;
        }
        // Restore boss crown
        const crown = enemy.mesh.userData['bossCrown'] as THREE.Mesh | undefined;
        if (crown && crown.material instanceof THREE.MeshStandardMaterial) {
          const crownColor = crown.userData['preFlashEmissive'] as number | undefined;
          const crownIntensity = crown.userData['preFlashEmissiveIntensity'] as number | undefined;
          if (crownColor !== undefined) crown.material.emissive.setHex(crownColor);
          if (crownIntensity !== undefined) crown.material.emissiveIntensity = crownIntensity;
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // Dying animation
  // -------------------------------------------------------------------------

  /**
   * Mark an enemy as dying and start the shrink-fade animation.
   * The enemy is immediately removed from the spatial-grid targeting pool (health is 0)
   * but remains in the enemies map until the animation completes.
   * BOSS enemies use a longer duration for added impact.
   */
  startDyingAnimation(enemies: Map<string, Enemy>, enemyId: string): void {
    const enemy = enemies.get(enemyId);
    if (!enemy || enemy.dying) return;

    const duration = enemy.type === EnemyType.BOSS
      ? DEATH_ANIM_CONFIG.durationBoss
      : DEATH_ANIM_CONFIG.duration;

    enemy.dying = true;
    enemy.dyingTimer = duration;

    // Make material transparent so we can animate opacity
    if (enemy.mesh) {
      this.setMeshTransparent(enemy.mesh, true);
    }
  }

  /**
   * Advance all active dying animations by `deltaTime` seconds.
   * Scales the mesh down and fades opacity toward 0.
   * When the timer expires, calls the supplied removeEnemy callback to dispose.
   *
   * This must be called from the render loop (not inside the fixed-timestep physics loop)
   * so the animation runs at real-time frame rate regardless of game speed.
   *
   * @param removeEnemy Callback supplied by EnemyService to dispose and deregister the enemy.
   */
  updateDyingAnimations(
    enemies: Map<string, Enemy>,
    deltaTime: number,
    scene: THREE.Scene,
    removeEnemy: (id: string, scene: THREE.Scene) => void,
  ): void {
    if (deltaTime <= 0) return;

    const toRemove: string[] = [];

    enemies.forEach((enemy, id) => {
      if (!enemy.dying || enemy.dyingTimer === undefined) return;

      enemy.dyingTimer -= deltaTime;

      if (enemy.dyingTimer <= 0) {
        toRemove.push(id);
        return;
      }

      if (!enemy.mesh) return;

      const duration = enemy.type === EnemyType.BOSS
        ? DEATH_ANIM_CONFIG.durationBoss
        : DEATH_ANIM_CONFIG.duration;

      // Progress 0 = animation start, 1 = animation end
      const progress = 1 - (enemy.dyingTimer / duration);

      // Scale: 1.0 → DEATH_ANIM_CONFIG.minScale
      const scale = 1 - progress * (1 - DEATH_ANIM_CONFIG.minScale);
      enemy.mesh.scale.setScalar(scale);

      // Opacity: 1.0 → 0
      const opacity = 1 - progress;
      this.setMeshOpacity(enemy.mesh, opacity);
    });

    for (const id of toRemove) {
      removeEnemy(id, scene);
    }
  }

  // -------------------------------------------------------------------------
  // Shield break animation
  // -------------------------------------------------------------------------

  /**
   * Tick all active shield break animations by `deltaTime` seconds.
   * Scales the dome up and fades opacity toward 0.
   * When the timer expires, disposes and removes the dome mesh.
   * Call once per render frame (not inside the fixed-timestep physics loop).
   */
  updateShieldBreakAnimations(enemies: Map<string, Enemy>, deltaTime: number): void {
    if (deltaTime <= 0) return;

    enemies.forEach(enemy => {
      if (!enemy.shieldBreaking || enemy.shieldBreakTimer === undefined) return;

      enemy.shieldBreakTimer -= deltaTime;

      const shieldMesh = enemy.mesh?.userData['shieldMesh'] as THREE.Mesh | undefined;
      if (!shieldMesh) return;

      if (enemy.shieldBreakTimer <= 0) {
        // Animation complete — dispose and remove the dome
        if (enemy.mesh) {
          enemy.mesh.remove(shieldMesh);
          delete enemy.mesh.userData['shieldMesh'];
        }
        shieldMesh.geometry.dispose();
        if (Array.isArray(shieldMesh.material)) {
          shieldMesh.material.forEach(mat => mat.dispose());
        } else {
          shieldMesh.material.dispose();
        }
        enemy.shieldBreaking = false;
        enemy.shieldBreakTimer = undefined;
        return;
      }

      // Progress 0 = animation start, 1 = animation end
      const progress = 1 - (enemy.shieldBreakTimer / SHIELD_BREAK_CONFIG.duration);

      // Scale: 1.0 → SHIELD_BREAK_CONFIG.breakScale
      const scale = 1 + progress * (SHIELD_BREAK_CONFIG.breakScale - 1);
      shieldMesh.scale.setScalar(scale);

      // Opacity: SHIELD_VISUAL_CONFIG.opacity → 0
      const opacity = SHIELD_VISUAL_CONFIG.opacity * (1 - progress);
      const mat = shieldMesh.material as THREE.MeshStandardMaterial;
      mat.opacity = opacity;
    });
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Enable or disable transparent rendering on a mesh and all its children
   * that use MeshStandardMaterial (skips health bar BasicMaterial children).
   */
  private setMeshTransparent(mesh: THREE.Mesh, transparent: boolean): void {
    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.transparent = transparent;
      mesh.material.needsUpdate = true;
    }
    const crown = mesh.userData['bossCrown'] as THREE.Mesh | undefined;
    if (crown && crown.material instanceof THREE.MeshStandardMaterial) {
      crown.material.transparent = transparent;
      crown.material.needsUpdate = true;
    }
  }

  /**
   * Set opacity on the main mesh material and its BOSS crown child.
   * Skips health-bar children (MeshBasicMaterial) since they are already hidden.
   */
  private setMeshOpacity(mesh: THREE.Mesh, opacity: number): void {
    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.opacity = opacity;
    }
    const crown = mesh.userData['bossCrown'] as THREE.Mesh | undefined;
    if (crown && crown.material instanceof THREE.MeshStandardMaterial) {
      crown.material.opacity = opacity;
    }
  }
}
