import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy } from '../models/enemy.model';
import { PlacedTower, TowerType, TowerStats, TowerSpecialization, TOWER_CONFIGS, MAX_TOWER_LEVEL, getUpgradeCost, getEffectiveStats, TargetingMode, DEFAULT_TARGETING_MODE, TARGETING_MODES } from '../models/tower.model';
import { assertNever } from '../utils/assert-never';
import { KillInfo, CombatAudioEvent } from '../models/combat-frame.model';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { MORTAR_VISUAL_CONFIG } from '../constants/combat.constants';
import { StatusEffectType } from '../constants/status-effect.constants';
import { StatusEffectService } from './status-effect.service';
import { SpatialGrid } from '../utils/spatial-grid';
import { gridToWorld } from '../utils/coordinate-utils';
import { CombatVFXService } from './combat-vfx.service';
import { GameStateService } from './game-state.service';
import { TowerAnimationService } from './tower-animation.service';
import { ChainLightningService } from './chain-lightning.service';
import { ProjectileService, ProjectileHit } from './projectile.service';
import { RelicService } from '../../../ascent/services/relic.service';
import { CardEffectService } from '../../../ascent/services/card-effect.service';

/** A mortar blast zone that persists and deals DoT. Mesh ownership is in CombatVFXService. */
interface MortarZone {
  centerX: number;
  centerZ: number;
  blastRadius: number;
  dotDamage: number;
  expiresAt: number;       // gameTime when zone expires
  lastTickTime: number;    // gameTime of last DoT tick
  statusEffect?: StatusEffectType;
}

export { KillInfo, CombatAudioEvent } from '../models/combat-frame.model';

@Injectable()
export class TowerCombatService {
  private placedTowers: Map<string, PlacedTower> = new Map();
  /**
   * Scratch TowerStats object reused when the tower-damage modifier is active,
   * avoiding a per-tower-per-frame object spread allocation.
   */
  private scratchStats: TowerStats = {
    damage: 0, range: 0, fireRate: 0, cost: 0,
    projectileSpeed: 0, splashRadius: 0, color: 0,
  };
  private mortarZones: MortarZone[] = [];
  private gameTime = 0;
  private spatialGrid = new SpatialGrid();
  private pendingAudioEvents: CombatAudioEvent[] = [];

  /**
   * Drains and returns all audio events accumulated since the last call,
   * including events from ChainLightningService.
   * Call once per animation frame (not per physics step) so audio throttling stays meaningful.
   */
  drainAudioEvents(): CombatAudioEvent[] {
    const events = [
      ...this.pendingAudioEvents,
      ...this.chainLightningService.drainAudioEvents(),
    ];
    this.pendingAudioEvents = [];
    return events;
  }

  constructor(
    private enemyService: EnemyService,
    private gameBoardService: GameBoardService,
    private statusEffectService: StatusEffectService,
    private combatVFXService: CombatVFXService,
    private gameStateService: GameStateService,
    private towerAnimationService: TowerAnimationService,
    private chainLightningService: ChainLightningService,
    private projectileService: ProjectileService,
    private relicService: RelicService,
    private cardEffectService: CardEffectService,
  ) {}

  /** Registers a newly placed tower so it participates in targeting and firing. `actualCost` tracks the real gold paid (may differ from base cost due to modifiers). */
  registerTower(row: number, col: number, type: TowerType, mesh: THREE.Group, actualCost: number = TOWER_CONFIGS[type].cost): void {
    const key = `${row}-${col}`;
    this.placedTowers.set(key, {
      id: key,
      type,
      level: 1,
      row,
      col,
      lastFireTime: -Infinity,
      kills: 0,
      totalInvested: actualCost,
      targetingMode: DEFAULT_TARGETING_MODE,
      mesh
    });
  }

  /** Upgrades a tower from L1→L2. Returns false if at max level, already L2 (L2→L3 requires specialization), or not found. `actualCost` defaults to the configured upgrade cost. */
  upgradeTower(key: string, actualCost?: number): boolean {
    const tower = this.placedTowers.get(key);
    if (!tower || tower.level >= MAX_TOWER_LEVEL) return false;
    // L2->L3 requires specialization — use upgradeTowerWithSpec instead
    if (tower.level === MAX_TOWER_LEVEL - 1) return false;

    const cost = actualCost ?? getUpgradeCost(tower.type, tower.level);
    tower.level++;
    tower.totalInvested += cost;
    return true;
  }

  /** Upgrades a tower from L2→L3 with ALPHA or BETA specialization. Returns false if the tower is not exactly L2 or not found. */
  upgradeTowerWithSpec(key: string, spec: TowerSpecialization, actualCost?: number): boolean {
    const tower = this.placedTowers.get(key);
    if (!tower || tower.level !== MAX_TOWER_LEVEL - 1) return false;

    const cost = actualCost ?? getUpgradeCost(tower.type, tower.level);
    tower.level++;
    tower.specialization = spec;
    tower.totalInvested += cost;
    return true;
  }

  /** Removes a tower from combat tracking. Returns the removed PlacedTower (caller uses it to calculate sell refund), or undefined if not found. */
  unregisterTower(key: string): PlacedTower | undefined {
    const tower = this.placedTowers.get(key);
    if (!tower) return undefined;
    this.placedTowers.delete(key);
    return tower;
  }

  /**
   * Main per-physics-step combat tick. Rebuilds the spatial grid, runs DoT status effects, fires
   * towers (including chain/slow aura/mortar), moves projectiles, and expires visual effects.
   * @param deltaTime Elapsed time in seconds since last physics step.
   * @returns `killed` — enemies that died this step; `fired` — tower types that fired; `hitCount` — projectile impacts.
   */
  update(deltaTime: number, scene: THREE.Scene): { killed: KillInfo[]; fired: TowerType[]; hitCount: number } {
    this.gameTime += deltaTime;
    const killedEnemies: KillInfo[] = [];

    this.rebuildSpatialGrid();

    const dotKills = this.tickStatusEffects();
    killedEnemies.push(...dotKills);

    const firedTowerTypes = this.processTowerFiring(scene, killedEnemies);

    const hitCount = this.resolveProjectileHits(deltaTime, scene, killedEnemies);

    // Delegate visual expiry to CombatVFXService (arcs, flashes, zone meshes)
    this.combatVFXService.updateVisuals(this.gameTime, scene);

    this.tickMortarZones(scene, killedEnemies);

    return { killed: killedEnemies, fired: firedTowerTypes, hitCount };
  }

  /** Phase 1: Rebuild the spatial grid with all living, non-dying enemies. */
  private rebuildSpatialGrid(): void {
    // Dying enemies are excluded — they are already dead from the targeting perspective.
    this.spatialGrid.clear();
    this.enemyService.getEnemies().forEach(enemy => {
      if (enemy.health > 0 && !enemy.dying) {
        this.spatialGrid.insert(enemy);
      }
    });
  }

  /** Phase 2: Tick status effects (expire SLOW, deal DoT damage). Returns kills from DoT. */
  private tickStatusEffects(): KillInfo[] {
    return this.statusEffectService.update(this.gameTime);
  }

  /** Phase 3: Per-tower targeting and firing. Pushes kills into `outKilled`. Returns list of tower types that fired. */
  private processTowerFiring(scene: THREE.Scene, outKilled: KillInfo[]): TowerType[] {
    const firedTowerTypes: TowerType[] = [];
    const towerDamageMultiplier = this.gameStateService.getModifierEffects().towerDamageMultiplier ?? 1;
    const hasRelicModifiers = this.relicService.relicCount > 0;

    // Pre-read card modifier values once per frame (avoids per-tower repeat calls).
    const cardDamageBoost = this.cardEffectService.getModifierValue('damage');
    const cardRangeBoost = this.cardEffectService.getModifierValue('range');
    const cardFireRateBoost = this.cardEffectService.getModifierValue('fire_rate');
    const hasCardModifiers = cardDamageBoost !== 0 || cardRangeBoost !== 0 || cardFireRateBoost !== 0;

    this.placedTowers.forEach(tower => {
      const baseStats = getEffectiveStats(tower.type, tower.level, tower.specialization);
      let stats: TowerStats;
      if (towerDamageMultiplier !== 1 || hasRelicModifiers || hasCardModifiers) {
        const relicDamage = this.relicService.getDamageMultiplier(tower.type);
        const relicFireRate = this.relicService.getFireRateMultiplier();
        const relicRange = this.relicService.getRangeMultiplier(tower.type);
        this.scratchStats.damage = Math.round(baseStats.damage * towerDamageMultiplier * relicDamage * (1 + cardDamageBoost));
        this.scratchStats.range = baseStats.range * relicRange * (1 + cardRangeBoost);
        this.scratchStats.fireRate = baseStats.fireRate * relicFireRate * (1 - cardFireRateBoost);
        this.scratchStats.cost = baseStats.cost;
        this.scratchStats.projectileSpeed = baseStats.projectileSpeed;
        this.scratchStats.splashRadius = baseStats.splashRadius * this.relicService.getSplashRadiusMultiplier();
        this.scratchStats.color = baseStats.color;
        this.scratchStats.slowFactor = baseStats.slowFactor;
        this.scratchStats.slowDuration = baseStats.slowDuration != null ? baseStats.slowDuration * this.relicService.getSlowDurationMultiplier() : baseStats.slowDuration;
        this.scratchStats.chainCount = baseStats.chainCount != null ? baseStats.chainCount + this.relicService.getChainBounceBonus() : baseStats.chainCount;
        this.scratchStats.chainRange = baseStats.chainRange;
        this.scratchStats.blastRadius = baseStats.blastRadius;
        this.scratchStats.dotDuration = baseStats.dotDuration;
        this.scratchStats.dotDamage = baseStats.dotDamage != null ? baseStats.dotDamage * this.relicService.getDotDamageMultiplier() : baseStats.dotDamage;
        this.scratchStats.statusEffect = baseStats.statusEffect;
        stats = this.scratchStats;
      } else {
        stats = baseStats;
      }
      const timeSinceLastFire = this.gameTime - tower.lastFireTime;

      if (timeSinceLastFire < stats.fireRate) return;

      if (tower.type === TowerType.SLOW) {
        // Slow towers pulse an aura — no projectile, just apply slow to nearby enemies
        this.applySlowAura(tower, stats);
        tower.lastFireTime = this.gameTime;
        this.towerAnimationService.startMuzzleFlash(tower);
        firedTowerTypes.push(tower.type);
        return;
      }

      const target = this.findTarget(tower, stats);
      if (!target) return;

      tower.lastFireTime = this.gameTime;
      this.towerAnimationService.startMuzzleFlash(tower);

      if (tower.type === TowerType.CHAIN) {
        const { x: towerWorldX, z: towerWorldZ } = this.getTowerWorldPos(tower);
        const kills = this.chainLightningService.fire(
          tower, target, stats, scene,
          towerWorldX, towerWorldZ,
          this.spatialGrid, this.gameTime
        );
        outKilled.push(...kills);
        if (kills.length > 0) {
          const t = this.placedTowers.get(tower.id);
          if (t) t.kills += kills.length;
        }
      } else {
        const { x: towerWorldX, z: towerWorldZ } = this.getTowerWorldPos(tower);
        this.projectileService.fire(tower, target, stats, towerWorldX, towerWorldZ, scene);
      }

      firedTowerTypes.push(tower.type);
    });

    return firedTowerTypes;
  }

  /**
   * Phase 4: Advance projectiles via ProjectileService, then resolve each hit
   * into damage / kill tracking. Returns total hit count.
   */
  private resolveProjectileHits(deltaTime: number, scene: THREE.Scene, outKilled: KillInfo[]): number {
    const hits = this.projectileService.advance(
      deltaTime, scene, this.enemyService.getEnemies(), this.gameTime
    );

    for (const hit of hits) {
      const kills = this.applyHitDamage(hit, scene);
      outKilled.push(...kills);
    }

    return hits.length;
  }

  /** Phase 5: Tick mortar zones — deal DoT, expire data records (mesh expiry handled by VFX). Pushes kills into `outKilled`. */
  private tickMortarZones(scene: THREE.Scene, outKilled: KillInfo[]): void {
    const survivingZones: MortarZone[] = [];

    for (const zone of this.mortarZones) {
      if (this.gameTime >= zone.expiresAt) {
        // Mesh already removed by combatVFXService.updateVisuals above
        continue;
      }

      // Tick DoT every second
      if (this.gameTime - zone.lastTickTime >= MORTAR_VISUAL_CONFIG.tickInterval) {
        zone.lastTickTime = this.gameTime;
        const candidates = this.spatialGrid.queryRadius(zone.centerX, zone.centerZ, zone.blastRadius);
        for (const enemy of candidates) {
          if (enemy.health <= 0) continue;
          const dx = enemy.position.x - zone.centerX;
          const dz = enemy.position.z - zone.centerZ;
          // Narrow-phase range check
          if (Math.sqrt(dx * dx + dz * dz) <= zone.blastRadius) {
            const result = this.enemyService.damageEnemy(enemy.id, zone.dotDamage);
            if (result.killed) {
              outKilled.push({ id: enemy.id, damage: zone.dotDamage });
            } else {
              this.enemyService.startHitFlash(enemy.id);
              if (zone.statusEffect) {
                this.statusEffectService.apply(enemy.id, zone.statusEffect, this.gameTime);
              }
            }
            // Mini-swarm meshes from DoT kills are added to scene here
            result.spawnedEnemies.forEach(mini => {
              if (mini.mesh) scene.add(mini.mesh);
            });
          }
        }
      }

      survivingZones.push(zone);
    }
    this.mortarZones = survivingZones;
  }

  /** Delegate to shared coordinate utility with current board dimensions. */
  private getTowerWorldPos(tower: PlacedTower): { x: number; z: number } {
    return gridToWorld(
      tower.row, tower.col,
      this.gameBoardService.getBoardWidth(),
      this.gameBoardService.getBoardHeight(),
      this.gameBoardService.getTileSize()
    );
  }

  /** Sets a tower's targeting mode directly. Returns false if the tower doesn't exist. */
  setTargetingMode(towerId: string, mode: TargetingMode): boolean {
    const tower = this.placedTowers.get(towerId);
    if (!tower) return false;
    tower.targetingMode = mode;
    return true;
  }

  /** Advances the tower's targeting mode to the next in the cycle (nearest→first→strongest→nearest). Returns the new mode, or null if the tower doesn't exist. */
  cycleTargetingMode(towerId: string): TargetingMode | null {
    const tower = this.placedTowers.get(towerId);
    if (!tower) return null;
    const currentIndex = TARGETING_MODES.indexOf(tower.targetingMode);
    const nextIndex = (currentIndex + 1) % TARGETING_MODES.length;
    tower.targetingMode = TARGETING_MODES[nextIndex];
    return tower.targetingMode;
  }

  private findTarget(tower: PlacedTower, stats: TowerStats): Enemy | null {
    const { x: towerWorldX, z: towerWorldZ } = this.getTowerWorldPos(tower);

    let best: Enemy | null = null;
    let bestScore = -Infinity;

    const candidates = this.spatialGrid.queryRadius(towerWorldX, towerWorldZ, stats.range);
    for (const enemy of candidates) {
      if (enemy.health <= 0) continue;

      const dx = enemy.position.x - towerWorldX;
      const dz = enemy.position.z - towerWorldZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Narrow-phase range check in world units
      if (dist > stats.range) continue;

      let score: number;
      switch (tower.targetingMode) {
        case TargetingMode.FIRST:
          // Enemy furthest along path (highest distanceTraveled) is closest to exit
          score = enemy.distanceTraveled;
          break;
        case TargetingMode.STRONGEST:
          // Enemy with highest current health
          score = enemy.health;
          break;
        case TargetingMode.NEAREST:
          // Closest by distance (invert so closer = higher score)
          score = -dist;
          break;
        default:
          assertNever(tower.targetingMode);
      }

      if (score > bestScore) {
        best = enemy;
        bestScore = score;
      }
    }

    return best;
  }

  private applySlowAura(tower: PlacedTower, stats: TowerStats): void {
    const { x: towerWorldX, z: towerWorldZ } = this.getTowerWorldPos(tower);

    const candidates = this.spatialGrid.queryRadius(towerWorldX, towerWorldZ, stats.range);
    for (const enemy of candidates) {
      if (enemy.health <= 0) continue;

      const dx = enemy.position.x - towerWorldX;
      const dz = enemy.position.z - towerWorldZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Narrow-phase range check
      if (dist > stats.range) continue;

      // StatusEffectService handles immunity (flying), duration refresh, and speed mutation
      this.statusEffectService.apply(enemy.id, StatusEffectType.SLOW, this.gameTime, stats.slowFactor);
    }
  }

  /**
   * Resolves a projectile impact into damage dealt to enemy / enemies.
   * Returns KillInfo for each enemy that died.
   */
  private applyHitDamage(hit: ProjectileHit, scene: THREE.Scene): KillInfo[] {
    const kills: KillInfo[] = [];

    if (hit.towerType === TowerType.MORTAR) {
      // Look up the mortar tower's stats to create the zone
      const tower = this.placedTowers.get(hit.towerKey);
      const stats = tower ? getEffectiveStats(tower.type, tower.level, tower.specialization) : null;
      if (stats) {
        const dotMult = this.gameStateService.getModifierEffects().towerDamageMultiplier ?? 1;
        const modifiedStats = dotMult !== 1 && stats.dotDamage
          ? { ...stats, dotDamage: Math.round(stats.dotDamage * dotMult) }
          : stats;
        const initialKills = this.createMortarZone(hit.impactX, hit.impactZ, modifiedStats, scene);
        kills.push(...initialKills);
      }
      // Further DoT kills are tracked in tickMortarZones
    } else if (hit.splashRadius > 0) {
      // Splash damage — hit all enemies within radius of impact point
      const splashCandidates = this.spatialGrid.queryRadius(hit.impactX, hit.impactZ, hit.splashRadius);
      for (const enemy of splashCandidates) {
        const dx = enemy.position.x - hit.impactX;
        const dz = enemy.position.z - hit.impactZ;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Narrow-phase range check
        if (dist <= hit.splashRadius) {
          const result = this.enemyService.damageEnemy(enemy.id, hit.damage);
          if (result.killed) {
            kills.push({ id: enemy.id, damage: hit.damage });
          } else {
            this.enemyService.startHitFlash(enemy.id);
            if (hit.statusEffect) {
              this.statusEffectService.apply(enemy.id, hit.statusEffect, this.gameTime);
            }
          }
          result.spawnedEnemies.forEach(mini => {
            if (mini.mesh) scene.add(mini.mesh);
          });
        }
      }
    } else {
      // Single target damage
      const result = this.enemyService.damageEnemy(hit.targetId, hit.damage);
      if (result.killed) {
        kills.push({ id: hit.targetId, damage: hit.damage });
      } else {
        this.enemyService.startHitFlash(hit.targetId);
        if (hit.statusEffect) {
          this.statusEffectService.apply(hit.targetId, hit.statusEffect, this.gameTime);
        }
      }
      result.spawnedEnemies.forEach(mini => {
        if (mini.mesh) scene.add(mini.mesh);
      });
    }

    // Track kills on the tower
    if (kills.length > 0) {
      const tower = this.placedTowers.get(hit.towerKey);
      if (tower) {
        tower.kills += kills.length;
      }
    }

    return kills;
  }

  private createMortarZone(
    impactX: number,
    impactZ: number,
    stats: TowerStats,
    scene: THREE.Scene
  ): KillInfo[] {
    const blastRadius = stats.blastRadius ?? 1.5;
    const dotDuration = stats.dotDuration ?? 3;
    const dotDamage = stats.dotDamage ?? 3;

    // Delegate mesh creation to CombatVFXService
    this.combatVFXService.createMortarZoneMesh(impactX, impactZ, blastRadius, dotDuration, scene, this.gameTime);

    this.pendingAudioEvents.push({ type: 'sfx', sfxKey: 'mortarExplosion' });

    // Initial blast — deal immediate damage on impact and track kills
    const initialKills: KillInfo[] = [];
    const blastCandidates = this.spatialGrid.queryRadius(impactX, impactZ, blastRadius);
    for (const enemy of blastCandidates) {
      if (enemy.health <= 0) continue;
      const dx = enemy.position.x - impactX;
      const dz = enemy.position.z - impactZ;
      // Narrow-phase range check
      if (Math.sqrt(dx * dx + dz * dz) <= blastRadius) {
        const result = this.enemyService.damageEnemy(enemy.id, dotDamage);
        if (result.killed) {
          initialKills.push({ id: enemy.id, damage: dotDamage });
        } else {
          this.enemyService.startHitFlash(enemy.id);
          if (stats.statusEffect) {
            this.statusEffectService.apply(enemy.id, stats.statusEffect, this.gameTime);
          }
        }
        result.spawnedEnemies.forEach(mini => {
          if (mini.mesh) scene.add(mini.mesh);
        });
      }
    }

    this.mortarZones.push({
      centerX: impactX,
      centerZ: impactZ,
      blastRadius,
      dotDamage,
      expiresAt: this.gameTime + dotDuration,
      lastTickTime: this.gameTime,
      statusEffect: stats.statusEffect,
    });

    return initialKills;
  }

  getTower(key: string): PlacedTower | undefined {
    return this.placedTowers.get(key);
  }

  getPlacedTowers(): Map<string, PlacedTower> {
    return this.placedTowers;
  }

  /** Disposes all Three.js objects (projectiles, tower meshes), resets status effects, delegates VFX cleanup, and zeros out game time. Call from both `restartGame()` and `ngOnDestroy()`. */
  cleanup(scene: THREE.Scene): void {
    // Delegate projectile disposal and pool draining to ProjectileService
    this.projectileService.cleanup(scene);

    // Delegate all VFX cleanup to CombatVFXService
    this.combatVFXService.cleanup(scene);
    this.mortarZones = [];

    // Restore all status effects (slow speed, etc.)
    this.statusEffectService.cleanup();

    // Dispose and remove all tower meshes from scene
    this.placedTowers.forEach(tower => {
      if (tower.mesh) {
        scene.remove(tower.mesh);
        tower.mesh.traverse(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }
    });
    this.placedTowers.clear();
    this.gameTime = 0;
  }
}
