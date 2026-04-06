import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { TowerType, TowerStats } from '../models/tower.model';
import { PlacedTower } from '../models/tower.model';
import { Enemy } from '../models/enemy.model';
import { StatusEffectType } from '../constants/status-effect.constants';
import { PROJECTILE_CONFIG } from '../constants/ui.constants';
import { PROJECTILE_VISUAL_CONFIG } from '../constants/effects.constants';
import { PROJECTILE_POOL_CONFIG } from '../constants/physics.constants';
import { ObjectPool } from '../utils/object-pool';
import { CombatVFXService } from './combat-vfx.service';

/** A live projectile flying toward its target. */
interface Projectile {
  id: string;
  mesh: THREE.Mesh;
  trail: THREE.Line | null;
  trailPositions: THREE.Vector3[];
  towerKey: string;
  targetId: string;
  speed: number;
  damage: number;
  splashRadius: number;
  towerType: TowerType;
  statusEffect?: StatusEffectType;
}

/** Max trail vertices — matches PROJECTILE_CONFIG.trailLength */
const TRAIL_MAX_VERTICES = PROJECTILE_CONFIG.trailLength;

/**
 * Describes a projectile impact that the caller must resolve into damage/kills.
 * Returned by `ProjectileService.advance()` for each hit that occurred this step.
 */
export interface ProjectileHit {
  towerKey: string;
  targetId: string;
  impactX: number;
  impactZ: number;
  damage: number;
  splashRadius: number;
  towerType: TowerType;
  statusEffect?: StatusEffectType;
}

/**
 * Owns the full lifecycle of non-chain projectiles: creation (pooled and
 * un-pooled mortar), per-frame movement, trail rendering, and disposal.
 *
 * Extracted from TowerCombatService to keep that service under 600 LOC.
 * Damage resolution (kill tracking, status effects, mortar zone creation) is
 * intentionally left in TowerCombatService which has access to the spatial
 * grid, placed-tower map, and game state.
 */
@Injectable()
export class ProjectileService {
  private projectiles: Projectile[] = [];
  private projectileCounter = 0;
  private projectilePool: ObjectPool<THREE.Mesh>;

  constructor(private combatVFXService: CombatVFXService) {
    this.projectilePool = new ObjectPool<THREE.Mesh>(
      () => this.createPooledProjectileMesh(),
      (mesh) => {
        mesh.visible = false;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.setHex(0xffffff);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        mesh.scale.set(1, 1, 1);
      },
      PROJECTILE_POOL_CONFIG,
      (mesh) => {
        if (mesh.parent) mesh.parent.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    );
  }

  /** Returns the number of live projectiles (used for diagnostics / tests). */
  getProjectileCount(): number {
    return this.projectiles.length;
  }

  /** Fires a standard (pooled) or mortar (un-pooled) projectile toward `target`. */
  fire(
    tower: PlacedTower,
    target: Enemy,
    stats: TowerStats,
    towerWorldX: number,
    towerWorldZ: number,
    scene: THREE.Scene
  ): void {
    if (tower.type === TowerType.MORTAR) {
      this.fireMortarProjectile(tower, target, stats, towerWorldX, towerWorldZ, scene);
    } else {
      this.fireStandardProjectile(tower, target, stats, towerWorldX, towerWorldZ, scene);
    }
  }

  /**
   * Advances all live projectiles by `deltaTime` seconds toward their targets.
   * Returns a list of impacts that occurred — the caller is responsible for
   * resolving each hit into damage and kill tracking.
   *
   * @param enemies  Current enemy map (used to look up target positions).
   * @param gameTime Accumulated game time (used for VFX timestamps).
   */
  advance(
    deltaTime: number,
    scene: THREE.Scene,
    enemies: Map<string, Enemy>,
    gameTime: number
  ): ProjectileHit[] {
    const hits: ProjectileHit[] = [];
    const surviving: Projectile[] = [];

    for (const proj of this.projectiles) {
      const enemy = enemies.get(proj.targetId);

      // Target dead or removed — discard projectile
      if (!enemy) {
        this.removeProjectileMesh(proj, scene);
        continue;
      }

      const dx = enemy.position.x - proj.mesh.position.x;
      const dz = enemy.position.z - proj.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const moveDistance = proj.speed * deltaTime;

      if (moveDistance >= dist) {
        // Hit — create impact flash, record impact for caller to resolve
        this.combatVFXService.createImpactFlash(proj.mesh.position.x, proj.mesh.position.z, scene, gameTime);
        hits.push({
          towerKey: proj.towerKey,
          targetId: proj.targetId,
          impactX: proj.mesh.position.x,
          impactZ: proj.mesh.position.z,
          damage: proj.damage,
          splashRadius: proj.splashRadius,
          towerType: proj.towerType,
          statusEffect: proj.statusEffect,
        });
        this.removeProjectileMesh(proj, scene);
      } else {
        // Move toward target
        const nx = dx / dist;
        const nz = dz / dist;
        proj.mesh.position.x += nx * moveDistance;
        proj.mesh.position.z += nz * moveDistance;

        // Rotate elongated projectiles (e.g. Sniper) to face travel direction
        const visualCfg = PROJECTILE_VISUAL_CONFIG[proj.towerType];
        if (visualCfg?.scaleZ !== undefined) {
          proj.mesh.rotation.y = Math.atan2(nx, nz);
        }

        this.updateTrail(proj, scene);
        surviving.push(proj);
      }
    }

    this.projectiles = surviving;
    return hits;
  }

  /** Dispose all live projectiles and drain the pool. Call during cleanup/restart. */
  cleanup(scene: THREE.Scene): void {
    for (const proj of this.projectiles) {
      this.removeProjectileMesh(proj, scene);
    }
    this.projectiles = [];

    this.projectilePool.drain((mesh) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    });

    this.projectileCounter = 0;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private fireStandardProjectile(
    tower: PlacedTower,
    target: Enemy,
    stats: TowerStats,
    towerWorldX: number,
    towerWorldZ: number,
    scene: THREE.Scene
  ): void {
    const mesh = this.projectilePool.acquire();
    const visualCfg = PROJECTILE_VISUAL_CONFIG[tower.type];
    const mat = mesh.material as THREE.MeshStandardMaterial;

    if (visualCfg) {
      mat.color.setHex(visualCfg.color);
      mat.emissive.setHex(visualCfg.emissive);
      mat.emissiveIntensity = visualCfg.emissiveIntensity;
      const s = visualCfg.scale;
      mesh.scale.set(s, s, visualCfg.scaleZ !== undefined ? s * visualCfg.scaleZ : s);
    } else {
      mat.color.setHex(stats.color);
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
      mesh.scale.set(1, 1, 1);
    }

    mesh.position.set(towerWorldX, PROJECTILE_CONFIG.spawnHeight, towerWorldZ);
    mesh.visible = true;
    if (!mesh.parent) {
      scene.add(mesh);
    }

    this.projectiles.push({
      id: `proj-${this.projectileCounter++}`,
      mesh,
      trail: null,
      trailPositions: [],
      towerKey: tower.id,
      targetId: target.id,
      speed: stats.projectileSpeed,
      damage: stats.damage,
      splashRadius: stats.splashRadius,
      towerType: tower.type,
      statusEffect: stats.statusEffect,
    });
  }

  private fireMortarProjectile(
    tower: PlacedTower,
    target: Enemy,
    stats: TowerStats,
    towerWorldX: number,
    towerWorldZ: number,
    scene: THREE.Scene
  ): void {
    const geometry = new THREE.SphereGeometry(
      PROJECTILE_CONFIG.radius * PROJECTILE_CONFIG.mortarRadiusMultiplier,
      PROJECTILE_CONFIG.segments,
      PROJECTILE_CONFIG.segments
    );
    const material = new THREE.MeshBasicMaterial({
      color: stats.color,
      transparent: true,
      opacity: PROJECTILE_CONFIG.opacity,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(towerWorldX, PROJECTILE_CONFIG.spawnHeight, towerWorldZ);
    scene.add(mesh);

    this.projectiles.push({
      id: `proj-${this.projectileCounter++}`,
      mesh,
      trail: null,
      trailPositions: [],
      towerKey: tower.id,
      targetId: target.id,
      speed: stats.projectileSpeed,
      damage: stats.damage,
      splashRadius: 0,
      towerType: TowerType.MORTAR,
      statusEffect: stats.statusEffect,
    });
  }

  /** Remove a projectile mesh from the scene, dispose or pool as appropriate. */
  private removeProjectileMesh(proj: Projectile, scene: THREE.Scene): void {
    if (proj.trail) {
      scene.remove(proj.trail);
      proj.trail.geometry.dispose();
      (proj.trail.material as THREE.Material).dispose();
      proj.trail = null;
    }
    proj.trailPositions = [];

    if (proj.towerType === TowerType.MORTAR) {
      // Mortar projectiles are not pooled — dispose normally
      scene.remove(proj.mesh);
      proj.mesh.geometry.dispose();
      if (Array.isArray(proj.mesh.material)) {
        proj.mesh.material.forEach(mat => mat.dispose());
      } else {
        proj.mesh.material.dispose();
      }
    } else {
      this.projectilePool.release(proj.mesh);
    }
  }

  /** Update (or lazily create) the projectile's trail line. */
  private updateTrail(proj: Projectile, scene: THREE.Scene): void {
    if (proj.trailPositions.length < TRAIL_MAX_VERTICES) {
      proj.trailPositions.push(proj.mesh.position.clone());
    } else {
      // Recycle the oldest Vector3 rather than allocating a new one
      const recycled = proj.trailPositions.shift()!;
      recycled.copy(proj.mesh.position);
      proj.trailPositions.push(recycled);
    }

    if (proj.trailPositions.length < 2) return;

    if (!proj.trail) {
      const projColor = (proj.mesh.material as THREE.MeshStandardMaterial).color;
      const trailMat = new THREE.LineBasicMaterial({
        color: projColor,
        transparent: true,
        opacity: PROJECTILE_CONFIG.trailOpacity,
      });
      proj.trail = new THREE.Line(this.createTrailGeometry(), trailMat);
      scene.add(proj.trail);
    }

    // Update positions in-place — no per-frame geometry allocation
    const posAttr = proj.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < proj.trailPositions.length; i++) {
      arr[i * 3]     = proj.trailPositions[i].x;
      arr[i * 3 + 1] = proj.trailPositions[i].y;
      arr[i * 3 + 2] = proj.trailPositions[i].z;
    }
    posAttr.needsUpdate = true;
    proj.trail.geometry.setDrawRange(0, proj.trailPositions.length);
  }

  /** Pre-allocate a trail BufferGeometry with fixed-size buffer for in-place updates. */
  private createTrailGeometry(): THREE.BufferGeometry {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(TRAIL_MAX_VERTICES * 3);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setDrawRange(0, 0);
    return geom;
  }

  private createPooledProjectileMesh(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(
      PROJECTILE_CONFIG.radius,
      PROJECTILE_CONFIG.segments,
      PROJECTILE_CONFIG.segments
    );
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x000000,
      emissiveIntensity: 0,
      transparent: true,
      opacity: PROJECTILE_CONFIG.opacity,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    return mesh;
  }
}
