import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy, EnemyType, ENEMY_STATS, ENEMY_MESH_SEGMENTS, MINI_SWARM_MESH_SEGMENTS, GridNode, MINI_SWARM_STATS, FLYING_ENEMY_HEIGHT, MIN_ENEMY_SPEED } from '../models/enemy.model';
import { GameBoardService } from '../game-board.service';
import { HEALTH_BAR_CONFIG, SHIELD_VISUAL_CONFIG, ENEMY_VISUAL_CONFIG } from '../constants/ui.constants';
import { GameModifier, ModifierEffects, GAME_MODIFIER_CONFIGS } from '../models/game-modifier.model';
import { StatusEffectType } from '../constants/status-effect.constants';
import { STATUS_EFFECT_VISUALS, STATUS_EFFECT_PRIORITY, ENEMY_ANIM_CONFIG, BOSS_CROWN_CONFIG, DEATH_ANIM_CONFIG, HIT_FLASH_CONFIG } from '../constants/effects.constants';
import { PathfindingService } from './pathfinding.service';
import { GameStateService } from './game-state.service';

/**
 * Result returned by {@link EnemyService.damageEnemy}.
 * `killed` is true when the hit reduces health to 0 or below.
 * `spawnedEnemies` is non-empty only when a SWARM parent dies; the caller
 * must add each entry's mesh to the Three.js scene.
 */
export interface DamageResult {
  killed: boolean;
  spawnedEnemies: Enemy[];
}

@Injectable()
export class EnemyService {
  private enemies: Map<string, Enemy> = new Map();
  private enemyCounter = 0;
  /** Scratch quaternion reused each frame to avoid per-enemy allocation in billboarding. */
  private billboardScratchQuat = new THREE.Quaternion();
  /** Scratch Vector3 reused each frame to avoid per-enemy allocation in movement. */
  private scratchDirection = new THREE.Vector3();
  /** Scratch world-position objects reused each frame to avoid per-enemy allocation. */
  private scratchCurrentWorld = { x: 0, z: 0 };
  private scratchNextWorld = { x: 0, z: 0 };

  constructor(
    private gameBoardService: GameBoardService,
    private pathfindingService: PathfindingService,
    private gameStateService: GameStateService,
  ) {}

  /**
   * Spawn a new enemy of the given type at a randomly chosen spawner tile.
   * Applies active modifier effects (health/speed multipliers) to the enemy's
   * base stats, creates a Three.js mesh, and adds it to `scene`.
   * FLYING enemies use a straight-line path that bypasses terrain.
   * Returns `null` if no spawner/exit tiles exist or no valid path is found.
   *
   * @param waveHealthMultiplier Additional health scaling from endless-wave progression (1.0 = no change).
   * @param waveSpeedMultiplier  Additional speed scaling from endless-wave progression (1.0 = no change).
   *   Applied multiplicatively on top of modifier-scaled stats; speed floor is enforced after.
   */
  spawnEnemy(
    type: EnemyType,
    scene: THREE.Scene,
    waveHealthMultiplier: number = 1,
    waveSpeedMultiplier: number = 1,
  ): Enemy | null {
    const spawnerTiles = this.pathfindingService.getSpawnerTiles();
    if (spawnerTiles.length === 0) {
      console.warn('No spawner tiles available');
      return null;
    }

    // Pick a random spawner tile
    const spawnerTile = spawnerTiles[Math.floor(Math.random() * spawnerTiles.length)];
    const { row, col } = spawnerTile;

    // Find path to exit
    const exitTiles = this.pathfindingService.getExitTiles();
    if (exitTiles.length === 0) {
      console.warn('No exit tiles available');
      return null;
    }

    // Use first exit tile as target (they're grouped in center)
    const exitTile = exitTiles[0];

    // FLYING enemies bypass terrain — use a 2-node straight-line path
    const isFlying = type === EnemyType.FLYING;
    const path = isFlying
      ? this.pathfindingService.buildStraightPath({ x: col, y: row }, { x: exitTile.col, y: exitTile.row })
      : this.pathfindingService.findPath({ x: col, y: row }, { x: exitTile.col, y: exitTile.row });

    if (path.length === 0) {
      console.warn('No valid path found from spawner to exit');
      return null;
    }

    // Create enemy
    const stats = ENEMY_STATS[type];
    const worldPos = this.pathfindingService.gridToWorldPos(row, col);

    // FLYING enemies hover above ground
    const yPos = isFlying ? FLYING_ENEMY_HEIGHT : stats.size;

    const enemy: Enemy = {
      id: `enemy-${this.enemyCounter++}`,
      type,
      position: { x: worldPos.x, y: yPos, z: worldPos.z },
      gridPosition: { row, col },
      health: stats.health,
      maxHealth: stats.health,
      speed: stats.speed,
      value: stats.value,
      leakDamage: stats.leakDamage,
      path,
      pathIndex: 0,
      distanceTraveled: 0
    };

    // Apply modifier effects to spawned enemy stats — read from GameStateService on demand.
    const modifierEffects = this.gameStateService.getModifierEffects();
    const activeModifiers = this.gameStateService.getState().activeModifiers;
    if (modifierEffects.enemyHealthMultiplier !== undefined) {
      enemy.health = Math.round(enemy.health * modifierEffects.enemyHealthMultiplier);
      enemy.maxHealth = enemy.health;
    }
    // Speed modifiers: SPEED_DEMONS only applies to FAST/SWIFT types.
    // If both FAST_ENEMIES and SPEED_DEMONS are active, compute the combined
    // multiplier manually to apply SPEED_DEMONS selectively.
    if (activeModifiers.has(GameModifier.SPEED_DEMONS)) {
      const isFastOrSwift = type === EnemyType.FAST || type === EnemyType.SWIFT;
      if (isFastOrSwift) {
        // Apply the full merged speed multiplier (includes both modifiers)
        if (modifierEffects.enemySpeedMultiplier !== undefined) {
          enemy.speed *= modifierEffects.enemySpeedMultiplier;
        }
      } else {
        // Only apply FAST_ENEMIES portion (exclude SPEED_DEMONS' 2.0x)
        const speedDemonsMultiplier = GAME_MODIFIER_CONFIGS[GameModifier.SPEED_DEMONS].effects.enemySpeedMultiplier ?? 1;
        const totalMultiplier = modifierEffects.enemySpeedMultiplier ?? 1;
        // Guard against divide-by-zero (speedDemonsMultiplier should never be 0, but be safe)
        const nonDemonMultiplier = speedDemonsMultiplier !== 0
          ? totalMultiplier / speedDemonsMultiplier
          : totalMultiplier;
        if (nonDemonMultiplier !== 1) {
          enemy.speed *= nonDemonMultiplier;
        }
      }
    } else if (modifierEffects.enemySpeedMultiplier !== undefined) {
      // No SPEED_DEMONS — apply speed multiplier to all types
      enemy.speed *= modifierEffects.enemySpeedMultiplier;
    }

    // Apply endless-wave scaling on top of modifier scaling (multiplicative stacking)
    if (waveHealthMultiplier !== 1) {
      enemy.health = Math.round(enemy.health * waveHealthMultiplier);
      enemy.maxHealth = enemy.health;
    }
    if (waveSpeedMultiplier !== 1) {
      enemy.speed *= waveSpeedMultiplier;
    }

    // Floor speed to prevent zero/negative from extreme modifier stacking
    enemy.speed = Math.max(MIN_ENEMY_SPEED, enemy.speed);

    if (isFlying) {
      enemy.isFlying = true;
    }

    if (stats.maxShield !== undefined) {
      enemy.shield = stats.maxShield;
      enemy.maxShield = stats.maxShield;
    }

    // Create mesh
    enemy.mesh = this.createEnemyMesh(enemy);
    scene.add(enemy.mesh);

    this.enemies.set(enemy.id, enemy);
    return enemy;
  }

  /**
   * Advance all living enemies along their paths by `deltaTime` seconds.
   * Enemies that reach the final path node are not moved further.
   * @returns IDs of enemies that reached the exit this tick (callers should
   *   apply leak damage and remove them via {@link removeEnemy}).
   */
  updateEnemies(deltaTime: number): string[] {
    if (deltaTime <= 0) return [];

    const reachedExit: string[] = [];

    this.enemies.forEach(enemy => {
      // Skip dead enemies awaiting removal — prevents double-penalty if ordering changes
      if (enemy.health <= 0) return;
      // Skip dying enemies — they are frozen in place while the animation plays
      if (enemy.dying) return;

      if (enemy.pathIndex >= enemy.path.length - 1) {
        // Enemy reached exit
        reachedExit.push(enemy.id);
        return;
      }

      // Get current and next path nodes
      const currentNode = enemy.path[enemy.pathIndex];
      const nextNode = enemy.path[enemy.pathIndex + 1];

      // Convert grid positions to world positions (reuse scratch objects — no allocation)
      this.pathfindingService.gridToWorldPosInto(currentNode.y, currentNode.x, this.scratchCurrentWorld);
      this.pathfindingService.gridToWorldPosInto(nextNode.y, nextNode.x, this.scratchNextWorld);
      const currentWorld = this.scratchCurrentWorld;
      const nextWorld = this.scratchNextWorld;

      // Calculate direction and distance (reuse scratch Vector3 — no allocation)
      const direction = this.scratchDirection.set(
        nextWorld.x - currentWorld.x,
        0,
        nextWorld.z - currentWorld.z
      ).normalize();

      const moveDistance = enemy.speed * deltaTime;

      // Calculate distance to next node
      const distanceToNext = Math.sqrt(
        Math.pow(nextWorld.x - enemy.position.x, 2) +
        Math.pow(nextWorld.z - enemy.position.z, 2)
      );

      if (moveDistance >= distanceToNext) {
        // Reached next node - snap to it
        enemy.position.x = nextWorld.x;
        enemy.position.z = nextWorld.z;
        enemy.gridPosition.row = nextNode.y;
        enemy.gridPosition.col = nextNode.x;
        enemy.pathIndex++;
        enemy.distanceTraveled += distanceToNext;

        // Execute deferred repath now that we're snapped to a grid node
        if (enemy.needsRepath) {
          this.executeRepath(enemy);
        }
      } else {
        // Move towards next node
        enemy.position.x += direction.x * moveDistance;
        enemy.position.z += direction.z * moveDistance;
        enemy.distanceTraveled += moveDistance;
      }

      // Update mesh position and face movement direction
      if (enemy.mesh) {
        enemy.mesh.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
        enemy.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      }
    });

    return reachedExit;
  }

  /**
   * Remove an enemy by ID: disposes all child geometries/materials (health bar,
   * shield, crown), removes the mesh from `scene`, and deletes the entry from
   * the internal enemies map. No-op if the ID is not found.
   */
  removeEnemy(enemyId: string, scene: THREE.Scene): void {
    const enemy = this.enemies.get(enemyId);
    if (enemy) {
      if (enemy.mesh) {
        // Dispose health bar and shield children before removing
        enemy.mesh.children.forEach(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        scene.remove(enemy.mesh);
        enemy.mesh.geometry.dispose();
        if (Array.isArray(enemy.mesh.material)) {
          enemy.mesh.material.forEach(mat => mat.dispose());
        } else {
          enemy.mesh.material.dispose();
        }
      }
      this.enemies.delete(enemyId);
    }
  }

  /**
   * Get all active enemies
   */
  getEnemies(): Map<string, Enemy> {
    return this.enemies;
  }

  /**
   * Deal damage to a specific enemy.
   *
   * For SHIELDED enemies, damage is absorbed by the shield first. Once the shield
   * is exhausted, remaining damage carries through to health. When the shield
   * breaks the shield visual is removed from the mesh.
   *
   * For SWARM enemies that die, mini-swarm enemies are spawned at the parent's
   * current path position. The spawned enemies are registered internally and
   * returned so the caller can add their meshes to the scene.
   *
   * Returns a DamageResult with `killed` (true when health reaches 0) and
   * `spawnedEnemies` (non-empty only when a SWARM enemy dies).
   */
  damageEnemy(enemyId: string, damage: number): DamageResult {
    const noOp: DamageResult = { killed: false, spawnedEnemies: [] };
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.health <= 0) return noOp;

    // --- Shield absorption (SHIELDED type) ---
    if (enemy.shield !== undefined && enemy.shield > 0) {
      if (damage <= enemy.shield) {
        // Shield fully absorbs the hit
        enemy.shield -= damage;
        if (enemy.shield === 0) {
          this.removeShieldMesh(enemy);
        }
        return noOp; // Health untouched
      } else {
        // Shield breaks; carry remainder to health
        const remainder = damage - enemy.shield;
        enemy.shield = 0;
        this.removeShieldMesh(enemy);
        damage = remainder;
      }
    }

    // --- Apply to health ---
    enemy.health -= damage;

    if (enemy.health > 0) {
      return { killed: false, spawnedEnemies: [] };
    }

    // --- Enemy died ---
    const spawnedEnemies: Enemy[] = [];

    // SWARM death: spawn mini-enemies (only if this is NOT already a mini-swarm)
    if (enemy.type === EnemyType.SWARM && !enemy.isMiniSwarm) {
      const parentStats = ENEMY_STATS[EnemyType.SWARM];
      const spawnCount = parentStats.spawnOnDeath ?? 0;
      for (let i = 0; i < spawnCount; i++) {
        const mini = this.spawnMiniSwarm(enemy);
        if (mini) {
          spawnedEnemies.push(mini);
        }
      }
    }

    return { killed: true, spawnedEnemies };
  }

  /**
   * Sync every enemy's health-bar fill and color to its current health ratio.
   * @param cameraQuaternion When provided, billboards health-bar planes to face
   *   the camera, compensating for the parent enemy mesh's own rotation.
   *   Omit during unit tests or when billboarding is not needed.
   */
  updateHealthBars(cameraQuaternion?: THREE.Quaternion): void {
    this.enemies.forEach(enemy => {
      if (!enemy.mesh) return;
      // Hide health bar while dying — avoids flickering during scale-down
      if (enemy.dying) return;
      // The health bar is stored in userData
      const healthBarBg = enemy.mesh.userData?.['healthBarBg'] as THREE.Mesh | undefined;
      const healthBarFg = enemy.mesh.userData?.['healthBarFg'] as THREE.Mesh | undefined;

      if (healthBarBg && healthBarFg) {
        const healthPct = Math.max(0, enemy.health / enemy.maxHealth);
        healthBarFg.scale.x = healthPct;
        healthBarFg.position.x = -(1 - healthPct) * 0.25;

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
    });
  }

  /**
   * Tint enemy mesh emissive color based on active status effects.
   * Highest-priority effect wins (BURN > POISON > SLOW).
   * Enemies with no active effects revert to their base emissive.
   */
  updateStatusVisuals(activeEffects: Map<string, StatusEffectType[]>): void {
    this.enemies.forEach(enemy => {
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
   * Spin boss crowns for visual flair. Called once per frame.
   */
  updateEnemyAnimations(deltaTime: number): void {
    this.enemies.forEach(enemy => {
      if (!enemy.mesh || enemy.health <= 0) return;
      if (enemy.dying) return;
      const crown = enemy.mesh.userData['bossCrown'] as THREE.Mesh | undefined;
      if (crown) {
        crown.rotation.z += ENEMY_ANIM_CONFIG.bossCrownSpinSpeed * deltaTime;
      }
    });
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

  /**
   * Create a 3D mesh for an enemy.
   * FLYING enemies use a flat diamond (kite) shape made of 2 triangles,
   * rotated to lie flat in the XZ plane.
   * All other enemies get a type-specific geometry for gameplay readability.
   */
  private createEnemyMesh(enemy: Enemy): THREE.Mesh {
    const stats = ENEMY_STATS[enemy.type];

    let geometry: THREE.BufferGeometry;
    let materialSide: THREE.Side = THREE.FrontSide;

    if (enemy.isFlying) {
      // Diamond: 4 vertices forming a rhombus in the XZ plane, 2 triangles
      const s = stats.size;
      const diamondGeom = new THREE.BufferGeometry();
      const vertices = new Float32Array([
         0,  0, -s * 2,  // front tip
         s,  0,  0,      // right
         0,  0,  s * 2,  // back tip
        -s,  0,  0       // left
      ]);
      const indices = new Uint16Array([0, 1, 3, 1, 2, 3]);
      diamondGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      diamondGeom.setIndex(new THREE.BufferAttribute(indices, 1));
      diamondGeom.computeVertexNormals();
      geometry = diamondGeom;
      materialSide = THREE.DoubleSide;
    } else {
      geometry = this.createEnemyGeometry(enemy.type, stats.size);
    }

    const material = new THREE.MeshStandardMaterial({
      color: stats.color,
      emissive: stats.color,
      emissiveIntensity: ENEMY_VISUAL_CONFIG.baseEmissive,
      roughness: ENEMY_VISUAL_CONFIG.roughness,
      metalness: ENEMY_VISUAL_CONFIG.metalness,
      side: materialSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Add health bar above enemy
    const barWidth = HEALTH_BAR_CONFIG.width;
    const barHeight = HEALTH_BAR_CONFIG.height;
    const barY = stats.size + HEALTH_BAR_CONFIG.yOffset;

    const bgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
    const bgMaterial = new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.bgColor, side: THREE.DoubleSide });
    const healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
    healthBarBg.position.set(0, barY, 0);

    const fgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
    const fgMaterial = new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.colorGreen, side: THREE.DoubleSide });
    const healthBarFg = new THREE.Mesh(fgGeometry, fgMaterial);
    healthBarFg.position.set(0, barY + 0.001, 0);

    mesh.add(healthBarBg);
    mesh.add(healthBarFg);
    mesh.userData = { healthBarBg, healthBarFg };

    // Add shield visual for SHIELDED enemies
    if (enemy.type === EnemyType.SHIELDED && enemy.shield !== undefined && enemy.shield > 0) {
      const shieldMesh = this.createShieldMesh(stats.size);
      mesh.add(shieldMesh);
      mesh.userData['shieldMesh'] = shieldMesh;
    }

    // Add crown ring for BOSS enemies
    if (enemy.type === EnemyType.BOSS) {
      this.createBossCrown(mesh, stats.size, stats.color);
    }

    return mesh;
  }

  /**
   * Create type-specific geometry for each enemy.
   * Each type gets a distinct silhouette for gameplay readability.
   */
  private createEnemyGeometry(type: EnemyType, size: number): THREE.BufferGeometry {
    switch (type) {
      case EnemyType.FAST:
        // Elongated capsule — streamlined for speed
        return new THREE.CapsuleGeometry(size * 0.6, size * 1.2, 4, ENEMY_MESH_SEGMENTS);

      case EnemyType.HEAVY:
        // Chunky cube — blocky and tanky
        return new THREE.BoxGeometry(size * 1.6, size * 1.6, size * 1.6);

      case EnemyType.SWIFT:
        // Tetrahedron — angular, darting
        return new THREE.TetrahedronGeometry(size * 1.2, 0);

      case EnemyType.BOSS: {
        // Large sphere merged with torus crown for imposing look
        // Use sphere as base — the crown ring is added as a child mesh in createBossCrown()
        return new THREE.SphereGeometry(size, ENEMY_MESH_SEGMENTS, ENEMY_MESH_SEGMENTS);
      }

      case EnemyType.SHIELDED:
        // Icosahedron — faceted, armored look
        return new THREE.IcosahedronGeometry(size, 0);

      case EnemyType.SWARM:
        // Octahedron — compact, gem-like
        return new THREE.OctahedronGeometry(size, 0);

      case EnemyType.FLYING:
        // Diamond geometry is built inline in createEnemyMesh for flying enemies;
        // this branch is a safety fallback and should never be reached at runtime.
        return new THREE.SphereGeometry(size, ENEMY_MESH_SEGMENTS, ENEMY_MESH_SEGMENTS);

      case EnemyType.BASIC:
      default:
        // Standard sphere
        return new THREE.SphereGeometry(size, ENEMY_MESH_SEGMENTS, ENEMY_MESH_SEGMENTS);
    }
  }

  /**
   * Create and attach a torus crown ring to the Boss enemy mesh.
   * Called after the mesh is created to add the distinctive crown.
   */
  private createBossCrown(mesh: THREE.Mesh, size: number, color: number): void {
    const crownGeometry = new THREE.TorusGeometry(
      size * BOSS_CROWN_CONFIG.radiusMultiplier,
      size * BOSS_CROWN_CONFIG.tubeMultiplier,
      BOSS_CROWN_CONFIG.radialSegments,
      BOSS_CROWN_CONFIG.tubularSegments
    );
    const crownMaterial = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: BOSS_CROWN_CONFIG.emissiveIntensity,
      roughness: BOSS_CROWN_CONFIG.roughness,
      metalness: BOSS_CROWN_CONFIG.metalness
    });
    const crown = new THREE.Mesh(crownGeometry, crownMaterial);
    crown.rotation.x = Math.PI / 2;
    crown.position.y = size * BOSS_CROWN_CONFIG.yOffsetMultiplier;
    crown.castShadow = true;
    mesh.add(crown);
    mesh.userData['bossCrown'] = crown;
  }

  /**
   * Create a semi-transparent sphere to represent the active shield.
   */
  private createShieldMesh(enemySize: number): THREE.Mesh {
    const shieldRadius = enemySize * SHIELD_VISUAL_CONFIG.radiusMultiplier;
    const shieldGeometry = new THREE.SphereGeometry(
      shieldRadius,
      SHIELD_VISUAL_CONFIG.segments,
      SHIELD_VISUAL_CONFIG.segments
    );
    const shieldMaterial = new THREE.MeshStandardMaterial({
      color: SHIELD_VISUAL_CONFIG.color,
      emissive: SHIELD_VISUAL_CONFIG.color,
      emissiveIntensity: SHIELD_VISUAL_CONFIG.emissiveIntensity,
      transparent: true,
      opacity: SHIELD_VISUAL_CONFIG.opacity,
      side: THREE.FrontSide
    });
    return new THREE.Mesh(shieldGeometry, shieldMaterial);
  }

  /**
   * Remove and dispose the shield visual when shield HP reaches 0.
   */
  private removeShieldMesh(enemy: Enemy): void {
    if (!enemy.mesh) return;
    const shieldMesh = enemy.mesh.userData['shieldMesh'] as THREE.Mesh | undefined;
    if (!shieldMesh) return;

    enemy.mesh.remove(shieldMesh);
    shieldMesh.geometry.dispose();
    if (Array.isArray(shieldMesh.material)) {
      shieldMesh.material.forEach(mat => mat.dispose());
    } else {
      shieldMesh.material.dispose();
    }
    delete enemy.mesh.userData['shieldMesh'];
  }

  /**
   * Spawn a mini-swarm enemy at the parent's current path position.
   * The mini-enemy continues along the parent's remaining path.
   * isMiniSwarm is set to true to prevent recursive spawning.
   */
  private spawnMiniSwarm(parent: Enemy): Enemy | null {
    // Remaining path from the parent's current node onwards
    const remainingPath = parent.path.slice(parent.pathIndex);
    if (remainingPath.length === 0) return null;

    const mini: Enemy = {
      id: `enemy-${this.enemyCounter++}`,
      type: EnemyType.SWARM,
      position: { x: parent.position.x, y: MINI_SWARM_STATS.size, z: parent.position.z },
      gridPosition: { ...parent.gridPosition },
      health: MINI_SWARM_STATS.health,
      maxHealth: MINI_SWARM_STATS.health,
      speed: MINI_SWARM_STATS.speed,
      value: MINI_SWARM_STATS.value,
      leakDamage: MINI_SWARM_STATS.leakDamage,
      path: remainingPath,
      pathIndex: 0,
      distanceTraveled: parent.distanceTraveled,
      isMiniSwarm: true
    };

    mini.mesh = this.createMiniSwarmMesh(mini);
    this.enemies.set(mini.id, mini);
    return mini;
  }

  /**
   * Create a scaled-down mesh for a mini-swarm enemy.
   * Uses MINI_SWARM_STATS directly rather than ENEMY_STATS to produce the smaller visual.
   */
  private createMiniSwarmMesh(mini: Enemy): THREE.Mesh {
    const geometry = new THREE.OctahedronGeometry(MINI_SWARM_STATS.size, 0);
    const material = new THREE.MeshStandardMaterial({
      color: MINI_SWARM_STATS.color,
      emissive: MINI_SWARM_STATS.color,
      emissiveIntensity: ENEMY_VISUAL_CONFIG.miniSwarmEmissive,
      roughness: ENEMY_VISUAL_CONFIG.roughness,
      metalness: ENEMY_VISUAL_CONFIG.metalness,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(mini.position.x, mini.position.y, mini.position.z);
    mesh.castShadow = true;

    // Small health bar
    const barWidth = HEALTH_BAR_CONFIG.width * 0.5;
    const barHeight = HEALTH_BAR_CONFIG.height;
    const barY = MINI_SWARM_STATS.size + HEALTH_BAR_CONFIG.yOffset;

    const bgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
    const bgMaterial = new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.bgColor, side: THREE.DoubleSide });
    const healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
    healthBarBg.position.set(0, barY, 0);

    const fgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
    const fgMaterial = new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.colorGreen, side: THREE.DoubleSide });
    const healthBarFg = new THREE.Mesh(fgGeometry, fgMaterial);
    healthBarFg.position.set(0, barY + 0.001, 0);

    mesh.add(healthBarBg);
    mesh.add(healthBarFg);
    mesh.userData = { healthBarBg, healthBarFg };

    return mesh;
  }

  /**
   * Mark an enemy as dying and start the shrink-fade animation.
   * The enemy is immediately removed from the spatial-grid targeting pool (health is 0)
   * but remains in the enemies map until the animation completes.
   * BOSS enemies use a longer duration for added impact.
   * SWARM mini-spawn happens in damageEnemy() before this is called — no special handling needed here.
   */
  startDyingAnimation(enemyId: string): void {
    const enemy = this.enemies.get(enemyId);
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
   * Trigger a brief white emissive flash on the hit enemy.
   * No-op if the enemy is dying, already flashing, or not found.
   * Saves the current emissive color/intensity so they can be restored
   * when the flash expires — compatible with status-effect tinting.
   */
  startHitFlash(enemyId: string): void {
    const enemy = this.enemies.get(enemyId);
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
  updateHitFlashes(deltaTime: number): void {
    if (deltaTime <= 0) return;

    this.enemies.forEach(enemy => {
      if (enemy.hitFlashTimer === undefined || enemy.hitFlashTimer <= 0) return;

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

  /**
   * Advance all active dying animations by `deltaTime` seconds.
   * Scales the mesh down and fades opacity toward 0.
   * When the timer expires, calls removeEnemy() to dispose the mesh.
   *
   * This must be called from the render loop (not inside the fixed-timestep physics loop)
   * so the animation runs at real-time frame rate regardless of game speed.
   */
  updateDyingAnimations(deltaTime: number, scene: THREE.Scene): void {
    if (deltaTime <= 0) return;

    const toRemove: string[] = [];

    this.enemies.forEach((enemy, id) => {
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
      this.removeEnemy(id, scene);
    }
  }

  /**
   * Returns the count of enemies that are alive and NOT in the dying animation.
   * Use this for wave-completion checks instead of enemies.size, because dying
   * enemies are still in the map during their animation but are already "dead"
   * from the game-logic perspective.
   */
  getLivingEnemyCount(): number {
    let count = 0;
    this.enemies.forEach(enemy => {
      if (!enemy.dying) count++;
    });
    return count;
  }

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

  /**
   * Returns the A* path from the first spawner to the first exit as world coordinates.
   * Delegates to PathfindingService. Used by path overlay visualization.
   */
  getPathToExit(): { x: number; z: number }[] {
    return this.pathfindingService.getPathToExit();
  }

  /**
   * Clear the path cache (call when board changes).
   * Delegates to PathfindingService.
   */
  clearPathCache(): void {
    this.pathfindingService.invalidateCache();
  }

  /**
   * Flag enemies for deferred repath on their next waypoint arrival.
   * Only flags enemies whose remaining path passes through the changed tile.
   * The actual repath happens in updateEnemies() when the enemy reaches its
   * next waypoint — this avoids direction-vector bugs from repathing mid-stride.
   *
   * @param changedRow Row of the placed/sold tower (or -1 to flag ALL ground enemies)
   * @param changedCol Column of the placed/sold tower (or -1 to flag ALL ground enemies)
   */
  repathAffectedEnemies(changedRow: number, changedCol: number): void {
    this.clearPathCache();

    const forceAll = changedRow < 0 || changedCol < 0;

    for (const enemy of this.enemies.values()) {
      if (enemy.isFlying) continue;

      if (forceAll || this.pathCrossesTile(enemy, changedRow, changedCol)) {
        enemy.needsRepath = true;
      }
    }
  }

  /** Check if an enemy's remaining path (from current index forward) crosses a specific tile. */
  private pathCrossesTile(enemy: Enemy, row: number, col: number): boolean {
    for (let i = enemy.pathIndex; i < enemy.path.length; i++) {
      const node = enemy.path[i];
      if (node.y === row && node.x === col) {
        return true;
      }
    }
    return false;
  }

  /** Execute deferred repath for an enemy that reached a waypoint. */
  private executeRepath(enemy: Enemy): void {
    enemy.needsRepath = false;

    const exitTiles = this.pathfindingService.getExitTiles();
    if (exitTiles.length === 0) return;
    const exitTile = exitTiles[0];

    // Repath from the node the enemy just arrived at (gridPosition is now current)
    const newPath = this.pathfindingService.findPath(
      { x: enemy.gridPosition.col, y: enemy.gridPosition.row },
      { x: exitTile.col, y: exitTile.row }
    );

    if (newPath.length > 0) {
      enemy.path = newPath;
      enemy.pathIndex = 0;
    }
    // If findPath returns empty (no route — should be unreachable via wouldBlockPath guard),
    // the enemy keeps its old path. This is a defensive no-op, not a silent failure,
    // because wouldBlockPath prevents placements that fully block spawner→exit routes.
  }

  /**
   * Full reset: remove all enemies from the scene, reset the ID counter,
   * and clear the path cache. Call on game restart to prevent stale state.
   */
  reset(scene: THREE.Scene): void {
    this.cleanup(scene);
    this.enemyCounter = 0;
    this.clearPathCache();
  }

  /**
   * Remove all enemies from the scene, dispose their geometries/materials,
   * and clear the internal enemies map. Call on game restart or route teardown.
   */
  cleanup(scene: THREE.Scene): void {
    this.enemies.forEach((enemy, id) => {
      this.removeEnemy(id, scene);
    });
    // removeEnemy deletes entries during forEach — ensure map is cleared in case
    // any entry was skipped (e.g. enemy with no mesh)
    this.enemies.clear();
  }
}
