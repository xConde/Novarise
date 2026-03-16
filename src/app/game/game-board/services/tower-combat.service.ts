import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy } from '../models/enemy.model';
import { PlacedTower, TowerType, TowerStats, TowerSpecialization, TOWER_CONFIGS, MAX_TOWER_LEVEL, getUpgradeCost, getEffectiveStats, TargetingMode, DEFAULT_TARGETING_MODE, TARGETING_MODES } from '../models/tower.model';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { AudioService } from './audio.service';
import { PROJECTILE_CONFIG } from '../constants/ui.constants';
import { CHAIN_LIGHTNING_CONFIG, MORTAR_VISUAL_CONFIG } from '../constants/combat.constants';
import { PROJECTILE_POOL_CONFIG } from '../constants/physics.constants';
import { StatusEffectType } from '../constants/status-effect.constants';
import { StatusEffectService } from './status-effect.service';
import { SpatialGrid } from '../utils/spatial-grid';
import { ObjectPool } from '../utils/object-pool';
import { gridToWorld } from '../utils/coordinate-utils';
import { CombatVFXService } from './combat-vfx.service';

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

/** Info about a tower kill — includes the damage of the final hit. */
export interface KillInfo {
  id: string;
  damage: number;
}

@Injectable()
export class TowerCombatService {
  private placedTowers: Map<string, PlacedTower> = new Map();
  private projectiles: Projectile[] = [];
  private mortarZones: MortarZone[] = [];
  private projectileCounter = 0;
  private gameTime = 0;
  private spatialGrid = new SpatialGrid();
  private towerDamageMultiplier = 1;
  private projectilePool: ObjectPool<THREE.Mesh>;

  /** Applies a flat multiplier to all tower damage output. Set by the JUGGERNAUT modifier. */
  setTowerDamageMultiplier(mult: number): void {
    this.towerDamageMultiplier = mult;
  }

  constructor(
    private enemyService: EnemyService,
    private gameBoardService: GameBoardService,
    private audioService: AudioService,
    private statusEffectService: StatusEffectService,
    private combatVFXService: CombatVFXService
  ) {
    this.projectilePool = new ObjectPool<THREE.Mesh>(
      () => this.createPooledProjectileMesh(),
      (mesh) => { mesh.visible = false; },
      PROJECTILE_POOL_CONFIG,
      (mesh) => {
        if (mesh.parent) mesh.parent.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    );
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
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: PROJECTILE_CONFIG.opacity
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    return mesh;
  }

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
    const firedTowerTypes: TowerType[] = [];

    // Rebuild spatial grid for this frame (broad-phase acceleration for range queries)
    this.spatialGrid.clear();
    this.enemyService.getEnemies().forEach(enemy => {
      if (enemy.health > 0) {
        this.spatialGrid.insert(enemy);
      }
    });

    // Tick status effects (expire SLOW, deal DoT damage) before tower processing
    const dotKills = this.statusEffectService.update(this.gameTime);
    killedEnemies.push(...dotKills);

    // Tower targeting and firing — resolve stats per-tower using level
    this.placedTowers.forEach(tower => {
      const baseStats = getEffectiveStats(tower.type, tower.level, tower.specialization);
      const stats = this.towerDamageMultiplier !== 1
        ? { ...baseStats, damage: Math.round(baseStats.damage * this.towerDamageMultiplier) }
        : baseStats;
      const timeSinceLastFire = this.gameTime - tower.lastFireTime;

      if (timeSinceLastFire < stats.fireRate) return;

      if (tower.type === TowerType.SLOW) {
        // Slow towers pulse an aura — no projectile, just apply slow to nearby enemies
        this.applySlowAura(tower, stats);
        tower.lastFireTime = this.gameTime;
        firedTowerTypes.push(tower.type);
        return;
      }

      const target = this.findTarget(tower, stats);
      if (!target) return;

      tower.lastFireTime = this.gameTime;

      if (tower.type === TowerType.CHAIN) {
        const kills = this.fireChainLightning(tower, target, stats, scene);
        killedEnemies.push(...kills);
        if (kills.length > 0) {
          const t = this.placedTowers.get(tower.id);
          if (t) t.kills += kills.length;
        }
      } else {
        this.fireProjectile(tower, target, stats, scene);
      }

      firedTowerTypes.push(tower.type);
    });

    // Update standard projectiles
    const survivingProjectiles: Projectile[] = [];
    let hitCount = 0;
    for (const proj of this.projectiles) {
      const enemy = this.enemyService.getEnemies().get(proj.targetId);

      // Target dead or removed — remove projectile
      if (!enemy) {
        this.removeProjectileMesh(proj, scene);
        continue;
      }

      // Move projectile toward enemy
      const dx = enemy.position.x - proj.mesh.position.x;
      const dz = enemy.position.z - proj.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const moveDistance = proj.speed * deltaTime;

      if (moveDistance >= dist) {
        // Hit — spawn impact flash at hit position
        this.combatVFXService.createImpactFlash(proj.mesh.position.x, proj.mesh.position.z, scene, this.gameTime);
        // Apply damage before disposing mesh (applyDamage reads proj.mesh.position)
        const kills = this.applyDamage(proj, scene);
        killedEnemies.push(...kills);
        hitCount++;
        this.removeProjectileMesh(proj, scene);
      } else {
        // Move toward target
        const nx = dx / dist;
        const nz = dz / dist;
        proj.mesh.position.x += nx * moveDistance;
        proj.mesh.position.z += nz * moveDistance;

        // Update trail
        proj.trailPositions.push(proj.mesh.position.clone());
        if (proj.trailPositions.length > PROJECTILE_CONFIG.trailLength) {
          proj.trailPositions.shift();
        }

        if (proj.trailPositions.length >= 2) {
          if (!proj.trail) {
            const projColor = (proj.mesh.material as THREE.MeshBasicMaterial).color;
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
            arr[i * 3] = proj.trailPositions[i].x;
            arr[i * 3 + 1] = proj.trailPositions[i].y;
            arr[i * 3 + 2] = proj.trailPositions[i].z;
          }
          posAttr.needsUpdate = true;
          proj.trail.geometry.setDrawRange(0, proj.trailPositions.length);
        }

        survivingProjectiles.push(proj);
      }
    }
    this.projectiles = survivingProjectiles;

    // Delegate visual expiry to CombatVFXService (arcs, flashes, zone meshes)
    this.combatVFXService.updateVisuals(this.gameTime, scene);

    // Update mortar zones: deal DoT and expire data records (mesh expiry handled by VFX)
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
              killedEnemies.push({ id: enemy.id, damage: zone.dotDamage });
            } else if (zone.statusEffect) {
              this.statusEffectService.apply(enemy.id, zone.statusEffect, this.gameTime);
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

    return { killed: killedEnemies, fired: firedTowerTypes, hitCount };
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
        case 'first':
          // Enemy furthest along path (highest distanceTraveled) is closest to exit
          score = enemy.distanceTraveled;
          break;
        case 'strongest':
          // Enemy with highest current health
          score = enemy.health;
          break;
        case 'nearest':
        default:
          // Closest by distance (invert so closer = higher score)
          score = -dist;
          break;
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

  private fireChainLightning(
    tower: PlacedTower,
    primaryTarget: Enemy,
    stats: TowerStats,
    scene: THREE.Scene
  ): KillInfo[] {
    const chainCount = stats.chainCount ?? 3;
    const chainRange = stats.chainRange ?? 2;
    const kills: KillInfo[] = [];
    const hitIds = new Set<string>();

    this.audioService.playSfx('chainZap');

    let currentTarget: Enemy = primaryTarget;
    let currentDamage = stats.damage;

    // Track the position we draw each arc *from* — starts at the tower, then
    // advances to each hit target's position after processing that bounce.
    const towerPos = this.getTowerWorldPos(tower);
    let previousX = towerPos.x;
    let previousZ = towerPos.z;

    for (let bounce = 0; bounce <= chainCount; bounce++) {
      hitIds.add(currentTarget.id);

      // Delegate arc creation to CombatVFXService
      this.combatVFXService.createChainArc(
        previousX, previousZ,
        currentTarget.position.x, currentTarget.position.z,
        stats.color, scene, this.gameTime
      );

      // Deal damage
      const chainResult = this.enemyService.damageEnemy(currentTarget.id, currentDamage);
      if (chainResult.killed) {
        kills.push({ id: currentTarget.id, damage: currentDamage });
      } else if (stats.statusEffect) {
        this.statusEffectService.apply(currentTarget.id, stats.statusEffect, this.gameTime);
      }
      // Mini-swarm meshes from chain kills need to be tracked — caller adds to scene
      // via killedEnemyIds which triggers removeEnemy; spawnedEnemies returned separately
      chainResult.spawnedEnemies.forEach(mini => {
        if (mini.mesh) scene.add(mini.mesh);
      });

      if (bounce === chainCount) break;

      // Find next target: nearest enemy within chainRange not yet hit
      const nextTarget = this.findChainTarget(currentTarget, chainRange, hitIds);
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

  private findChainTarget(
    from: Enemy,
    chainRange: number,
    excludeIds: Set<string>
  ): Enemy | null {
    let nearest: Enemy | null = null;
    let nearestDist = Infinity;

    const candidates = this.spatialGrid.queryRadius(from.position.x, from.position.z, chainRange);
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

  private fireProjectile(tower: PlacedTower, target: Enemy, stats: TowerStats, scene: THREE.Scene): void {
    const { x: towerWorldX, z: towerWorldZ } = this.getTowerWorldPos(tower);

    if (tower.type === TowerType.MORTAR) {
      // Mortar fires a slow arc projectile to the target's current position
      this.fireMortarProjectile(tower, target, stats, towerWorldX, towerWorldZ, scene);
      return;
    }

    const mesh = this.projectilePool.acquire();
    (mesh.material as THREE.MeshBasicMaterial).color.set(stats.color);
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
    const geometry = new THREE.SphereGeometry(PROJECTILE_CONFIG.radius * PROJECTILE_CONFIG.mortarRadiusMultiplier, PROJECTILE_CONFIG.segments, PROJECTILE_CONFIG.segments);
    const material = new THREE.MeshBasicMaterial({
      color: stats.color,
      transparent: true,
      opacity: PROJECTILE_CONFIG.opacity
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

    this.audioService.playSfx('mortarExplosion');

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
        } else if (stats.statusEffect) {
          this.statusEffectService.apply(enemy.id, stats.statusEffect, this.gameTime);
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

  private applyDamage(proj: Projectile, scene: THREE.Scene): KillInfo[] {
    const kills: KillInfo[] = [];

    if (proj.towerType === TowerType.MORTAR) {
      // Look up the mortar tower's stats to create the zone
      const tower = this.placedTowers.get(proj.towerKey);
      const stats = tower ? getEffectiveStats(tower.type, tower.level, tower.specialization) : null;
      if (stats) {
        const modifiedStats = this.towerDamageMultiplier !== 1 && stats.dotDamage
          ? { ...stats, dotDamage: Math.round(stats.dotDamage * this.towerDamageMultiplier) }
          : stats;
        const initialKills = this.createMortarZone(proj.mesh.position.x, proj.mesh.position.z, modifiedStats, scene);
        kills.push(...initialKills);
      }
      // Further DoT kills are tracked in the zone update loop
    } else if (proj.splashRadius > 0) {
      // Splash damage — hit all enemies within radius of impact point
      const impactX = proj.mesh.position.x;
      const impactZ = proj.mesh.position.z;

      const splashCandidates = this.spatialGrid.queryRadius(impactX, impactZ, proj.splashRadius);
      for (const enemy of splashCandidates) {
        const dx = enemy.position.x - impactX;
        const dz = enemy.position.z - impactZ;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Narrow-phase range check
        if (dist <= proj.splashRadius) {
          const result = this.enemyService.damageEnemy(enemy.id, proj.damage);
          if (result.killed) {
            kills.push({ id: enemy.id, damage: proj.damage });
          } else if (proj.statusEffect) {
            this.statusEffectService.apply(enemy.id, proj.statusEffect, this.gameTime);
          }
          result.spawnedEnemies.forEach(mini => {
            if (mini.mesh) scene.add(mini.mesh);
          });
        }
      }
    } else {
      // Single target damage
      const result = this.enemyService.damageEnemy(proj.targetId, proj.damage);
      if (result.killed) {
        kills.push({ id: proj.targetId, damage: proj.damage });
      } else if (proj.statusEffect) {
        this.statusEffectService.apply(proj.targetId, proj.statusEffect, this.gameTime);
      }
      result.spawnedEnemies.forEach(mini => {
        if (mini.mesh) scene.add(mini.mesh);
      });
    }

    // Track kills on the tower
    if (kills.length > 0) {
      const tower = this.placedTowers.get(proj.towerKey);
      if (tower) {
        tower.kills += kills.length;
      }
    }

    return kills;
  }

  private removeProjectileMesh(proj: Projectile, scene: THREE.Scene): void {
    // Clean up trail
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
      // Standard projectiles: hide and return to pool (keep in scene)
      this.projectilePool.release(proj.mesh);
    }
  }

  getTower(key: string): PlacedTower | undefined {
    return this.placedTowers.get(key);
  }

  getPlacedTowers(): Map<string, PlacedTower> {
    return this.placedTowers;
  }

  /** Disposes all Three.js objects (projectiles, tower meshes), drains the projectile pool, resets status effects, delegates VFX cleanup, and zeros out game time. Call from both `restartGame()` and `ngOnDestroy()`. */
  cleanup(scene: THREE.Scene): void {
    for (const proj of this.projectiles) {
      this.removeProjectileMesh(proj, scene);
    }
    this.projectiles = [];

    // Drain the projectile pool — dispose geometry and material for each pooled mesh
    this.projectilePool.drain((mesh) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    });

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
    this.projectileCounter = 0;
    this.gameTime = 0;
    this.towerDamageMultiplier = 1;
  }
}
