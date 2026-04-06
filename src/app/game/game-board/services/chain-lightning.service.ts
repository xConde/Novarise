import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy } from '../models/enemy.model';
import { PlacedTower, TowerStats } from '../models/tower.model';
import { KillInfo, CombatAudioEvent } from '../models/combat-frame.model';
import { CHAIN_LIGHTNING_CONFIG } from '../constants/combat.constants';
import { SpatialGrid } from '../utils/spatial-grid';
import { EnemyService } from './enemy.service';
import { StatusEffectService } from './status-effect.service';
import { CombatVFXService } from './combat-vfx.service';

/**
 * Handles chain lightning logic for the CHAIN tower type.
 *
 * Extracted from TowerCombatService to keep that service under 600 LOC.
 * Receives the spatial grid by reference each time fire() is called so
 * it always works with the grid that TowerCombatService rebuilt that step.
 */
@Injectable()
export class ChainLightningService {
  private pendingAudioEvents: CombatAudioEvent[] = [];

  constructor(
    private enemyService: EnemyService,
    private statusEffectService: StatusEffectService,
    private combatVFXService: CombatVFXService,
  ) {}

  /**
   * Drains and returns all audio events accumulated since the last call.
   * TowerCombatService merges these into its own audio event queue each frame.
   */
  drainAudioEvents(): CombatAudioEvent[] {
    const events = [...this.pendingAudioEvents];
    this.pendingAudioEvents = [];
    return events;
  }

  /**
   * Fires a chain lightning arc from `tower` to `primaryTarget`, then bounces
   * up to `stats.chainCount` more times to nearby enemies.
   *
   * @param towerWorldX  Pre-computed world X of the firing tower.
   * @param towerWorldZ  Pre-computed world Z of the firing tower.
   * @param spatialGrid  The spatial grid rebuilt this physics step by TowerCombatService.
   * @param gameTime     Current accumulated game time for VFX expiry timestamps.
   * @returns List of enemies killed by this chain.
   */
  fire(
    tower: PlacedTower,
    primaryTarget: Enemy,
    stats: TowerStats,
    scene: THREE.Scene,
    towerWorldX: number,
    towerWorldZ: number,
    spatialGrid: SpatialGrid,
    gameTime: number,
  ): KillInfo[] {
    const chainCount = stats.chainCount ?? 3;
    const chainRange = stats.chainRange ?? 2;
    const kills: KillInfo[] = [];
    const hitIds = new Set<string>();

    this.pendingAudioEvents.push({ type: 'sfx', sfxKey: 'chainZap' });

    let currentTarget: Enemy = primaryTarget;
    let currentDamage = stats.damage;

    // Track the position we draw each arc *from* — starts at the tower, then
    // advances to each hit target's position after processing that bounce.
    let previousX = towerWorldX;
    let previousZ = towerWorldZ;

    for (let bounce = 0; bounce <= chainCount; bounce++) {
      hitIds.add(currentTarget.id);

      // Delegate arc creation to CombatVFXService
      this.combatVFXService.createChainArc(
        previousX, previousZ,
        currentTarget.position.x, currentTarget.position.z,
        stats.color, scene, gameTime
      );

      // Deal damage
      const chainResult = this.enemyService.damageEnemy(currentTarget.id, currentDamage);
      if (chainResult.killed) {
        kills.push({ id: currentTarget.id, damage: currentDamage });
      } else {
        this.enemyService.startHitFlash(currentTarget.id);
        if (stats.statusEffect) {
          this.statusEffectService.apply(currentTarget.id, stats.statusEffect, gameTime);
        }
      }
      // Mini-swarm meshes from chain kills are added to scene here
      chainResult.spawnedEnemies.forEach(mini => {
        if (mini.mesh) scene.add(mini.mesh);
      });

      if (bounce === chainCount) break;

      // Find next target: nearest enemy within chainRange not yet hit
      const nextTarget = this.findChainTarget(currentTarget, chainRange, hitIds, spatialGrid);
      if (!nextTarget) break;

      // Advance "from" position to the current hit before moving to next target
      previousX = currentTarget.position.x;
      previousZ = currentTarget.position.z;

      currentDamage = Math.round(currentDamage * CHAIN_LIGHTNING_CONFIG.damageFalloff);
      if (currentDamage <= 0) break;
      currentTarget = nextTarget;
    }

    return kills;
  }

  /**
   * Finds the nearest living enemy within `chainRange` of `from` that is not
   * already in `excludeIds`.
   *
   * @param spatialGrid  The spatial grid rebuilt this physics step by TowerCombatService.
   */
  findChainTarget(
    from: Enemy,
    chainRange: number,
    excludeIds: Set<string>,
    spatialGrid: SpatialGrid,
  ): Enemy | null {
    let nearest: Enemy | null = null;
    let nearestDist = Infinity;

    const candidates = spatialGrid.queryRadius(from.position.x, from.position.z, chainRange);
    for (const enemy of candidates) {
      if (enemy.health <= 0 || excludeIds.has(enemy.id)) continue;

      const dx = enemy.position.x - from.position.x;
      const dz = enemy.position.z - from.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Narrow-phase range check
      if (dist <= chainRange && dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }

    return nearest;
  }
}
