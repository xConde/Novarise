import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy } from '../models/enemy.model';
import { PlacedTower, TowerType, TowerStats, TowerSpecialization, TOWER_CONFIGS, MAX_TOWER_LEVEL, getUpgradeCost, getEffectiveStats, TargetingMode, DEFAULT_TARGETING_MODE, TARGETING_MODES } from '../models/tower.model';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { AudioService } from './audio.service';
import { PROJECTILE_CONFIG } from '../constants/ui.constants';
import { CHAIN_LIGHTNING_CONFIG, MORTAR_VISUAL_CONFIG, GROUND_EFFECT_Y, IMPACT_FLASH_CONFIG } from '../constants/combat.constants';
import { PROJECTILE_POOL_CONFIG } from '../constants/physics.constants';
import { StatusEffectType } from '../constants/status-effect.constants';
import { StatusEffectService } from './status-effect.service';
import { SpatialGrid } from '../utils/spatial-grid';
import { ObjectPool } from '../utils/object-pool';

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
}

/** A chain arc line that persists for a short visual duration before removal. */
interface ChainArc {
  line: THREE.Line;
  expiresAt: number; // gameTime when this arc should be removed
}

/** A brief impact flash sphere that fades and disappears. */
interface ImpactFlash {
  mesh: THREE.Mesh;
  expiresAt: number;
}

/** A mortar blast zone that persists and deals DoT. */
interface MortarZone {
  mesh: THREE.Mesh;
  centerX: number;
  centerZ: number;
  blastRadius: number;
  dotDamage: number;
  expiresAt: number;       // gameTime when zone expires
  lastTickTime: number;    // gameTime of last DoT tick
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
  private chainArcs: ChainArc[] = [];
  private mortarZones: MortarZone[] = [];
  private impactFlashes: ImpactFlash[] = [];
  private projectileCounter = 0;
  private gameTime = 0;
  private spatialGrid = new SpatialGrid();
  private towerDamageMultiplier = 1;
  private projectilePool: ObjectPool<THREE.Mesh>;

  setTowerDamageMultiplier(mult: number): void {
    this.towerDamageMultiplier = mult;
  }

  constructor(
    private enemyService: EnemyService,
    private gameBoardService: GameBoardService,
    private audioService: AudioService,
    private statusEffectService: StatusEffectService
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

  upgradeTowerWithSpec(key: string, spec: TowerSpecialization, actualCost?: number): boolean {
    const tower = this.placedTowers.get(key);
    if (!tower || tower.level !== MAX_TOWER_LEVEL - 1) return false;

    const cost = actualCost ?? getUpgradeCost(tower.type, tower.level);
    tower.level++;
    tower.specialization = spec;
    tower.totalInvested += cost;
    return true;
  }

  unregisterTower(key: string): PlacedTower | undefined {
    const tower = this.placedTowers.get(key);
    if (!tower) return undefined;
    this.placedTowers.delete(key);
    return tower;
  }

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
        this.spawnImpactFlash(proj.mesh.position.x, proj.mesh.position.z, scene);
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
          // Dispose old trail geometry
          if (proj.trail) {
            proj.trail.geometry.dispose();
          }

          const positions = new Float32Array(proj.trailPositions.length * 3);
          for (let i = 0; i < proj.trailPositions.length; i++) {
            positions[i * 3] = proj.trailPositions[i].x;
            positions[i * 3 + 1] = proj.trailPositions[i].y;
            positions[i * 3 + 2] = proj.trailPositions[i].z;
          }

          const trailGeom = new THREE.BufferGeometry();
          trailGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

          if (!proj.trail) {
            const projColor = (proj.mesh.material as THREE.MeshBasicMaterial).color;
            const trailMat = new THREE.LineBasicMaterial({
              color: projColor,
              transparent: true,
              opacity: PROJECTILE_CONFIG.trailOpacity,
            });
            proj.trail = new THREE.Line(trailGeom, trailMat);
            scene.add(proj.trail);
          } else {
            proj.trail.geometry = trailGeom;
          }
        }

        survivingProjectiles.push(proj);
      }
    }
    this.projectiles = survivingProjectiles;

    // Expire chain arc visuals
    const survivingArcs: ChainArc[] = [];
    for (const arc of this.chainArcs) {
      if (this.gameTime >= arc.expiresAt) {
        scene.remove(arc.line);
        arc.line.geometry.dispose();
        (arc.line.material as THREE.Material).dispose();
      } else {
        survivingArcs.push(arc);
      }
    }
    this.chainArcs = survivingArcs;

    // Expire impact flashes
    const survivingFlashes: ImpactFlash[] = [];
    for (const flash of this.impactFlashes) {
      if (this.gameTime >= flash.expiresAt) {
        scene.remove(flash.mesh);
        flash.mesh.geometry.dispose();
        (flash.mesh.material as THREE.Material).dispose();
      } else {
        // Fade out over lifetime
        const remaining = flash.expiresAt - this.gameTime;
        const pct = remaining / IMPACT_FLASH_CONFIG.lifetime;
        (flash.mesh.material as THREE.MeshBasicMaterial).opacity = IMPACT_FLASH_CONFIG.opacity * pct;
        survivingFlashes.push(flash);
      }
    }
    this.impactFlashes = survivingFlashes;

    // Update mortar zones: deal DoT and expire old zones
    const survivingZones: MortarZone[] = [];
    for (const zone of this.mortarZones) {
      if (this.gameTime >= zone.expiresAt) {
        scene.remove(zone.mesh);
        zone.mesh.geometry.dispose();
        (zone.mesh.material as THREE.Material).dispose();
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

  private getTowerWorldPos(tower: PlacedTower): { x: number; z: number } {
    const boardWidth = this.gameBoardService.getBoardWidth();
    const boardHeight = this.gameBoardService.getBoardHeight();
    const tileSize = this.gameBoardService.getTileSize();
    return {
      x: (tower.col - boardWidth / 2) * tileSize,
      z: (tower.row - boardHeight / 2) * tileSize
    };
  }

  setTargetingMode(towerId: string, mode: TargetingMode): boolean {
    const tower = this.placedTowers.get(towerId);
    if (!tower) return false;
    tower.targetingMode = mode;
    return true;
  }

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

      // Draw arc from previousPosition → currentTarget
      const fromX = previousX;
      const fromZ = previousZ;

      const toX = currentTarget.position.x;
      const toZ = currentTarget.position.z;

      // Create zigzag lightning arc (tower → target, or target → next target)
      {
        const segs = CHAIN_LIGHTNING_CONFIG.zigzagSegments;
        const jitter = CHAIN_LIGHTNING_CONFIG.zigzagJitter;
        const arcY = GROUND_EFFECT_Y + CHAIN_LIGHTNING_CONFIG.arcHeightOffset;
        const vertices = new Float32Array((segs + 1) * 3);

        // Direction vector and perpendicular
        const dirX = toX - fromX;
        const dirZ = toZ - fromZ;
        const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
        const perpX = -dirZ / len;
        const perpZ = dirX / len;

        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          const offset = (i === 0 || i === segs) ? 0 : (Math.random() - 0.5) * 2 * jitter;
          vertices[i * 3]     = fromX + dirX * t + perpX * offset;
          vertices[i * 3 + 1] = arcY;
          vertices[i * 3 + 2] = fromZ + dirZ * t + perpZ * offset;
        }

        const arcGeom = new THREE.BufferGeometry();
        arcGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        const arcMat = new THREE.LineBasicMaterial({
          color: stats.color,
          transparent: true,
          opacity: 0.85
        });
        const arc = new THREE.Line(arcGeom, arcMat);
        scene.add(arc);
        this.chainArcs.push({ line: arc, expiresAt: this.gameTime + CHAIN_LIGHTNING_CONFIG.arcLifetime });
      }

      // Deal damage
      const chainResult = this.enemyService.damageEnemy(currentTarget.id, currentDamage);
      if (chainResult.killed) {
        kills.push({ id: currentTarget.id, damage: currentDamage });
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
      towerType: tower.type
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
      towerType: TowerType.MORTAR
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

    const geometry = new THREE.CircleGeometry(blastRadius, MORTAR_VISUAL_CONFIG.zoneSegments);
    const material = new THREE.MeshBasicMaterial({
      color: MORTAR_VISUAL_CONFIG.zoneColor,
      transparent: true,
      opacity: MORTAR_VISUAL_CONFIG.zoneOpacity,
      side: THREE.DoubleSide
    });
    const zoneMesh = new THREE.Mesh(geometry, material);
    zoneMesh.rotation.x = -Math.PI / 2;
    zoneMesh.position.set(impactX, GROUND_EFFECT_Y, impactZ);
    scene.add(zoneMesh);

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
        }
        result.spawnedEnemies.forEach(mini => {
          if (mini.mesh) scene.add(mini.mesh);
        });
      }
    }

    this.mortarZones.push({
      mesh: zoneMesh,
      centerX: impactX,
      centerZ: impactZ,
      blastRadius,
      dotDamage,
      expiresAt: this.gameTime + dotDuration,
      lastTickTime: this.gameTime
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

  private spawnImpactFlash(x: number, z: number, scene: THREE.Scene): void {
    const geometry = new THREE.SphereGeometry(
      IMPACT_FLASH_CONFIG.radius,
      IMPACT_FLASH_CONFIG.segments,
      IMPACT_FLASH_CONFIG.segments
    );
    const material = new THREE.MeshBasicMaterial({
      color: IMPACT_FLASH_CONFIG.color,
      transparent: true,
      opacity: IMPACT_FLASH_CONFIG.opacity
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, IMPACT_FLASH_CONFIG.spawnHeight, z);
    scene.add(mesh);
    this.impactFlashes.push({ mesh, expiresAt: this.gameTime + IMPACT_FLASH_CONFIG.lifetime });
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

    for (const arc of this.chainArcs) {
      scene.remove(arc.line);
      arc.line.geometry.dispose();
      (arc.line.material as THREE.Material).dispose();
    }
    this.chainArcs = [];

    for (const flash of this.impactFlashes) {
      scene.remove(flash.mesh);
      flash.mesh.geometry.dispose();
      (flash.mesh.material as THREE.Material).dispose();
    }
    this.impactFlashes = [];

    for (const zone of this.mortarZones) {
      scene.remove(zone.mesh);
      zone.mesh.geometry.dispose();
      (zone.mesh.material as THREE.Material).dispose();
    }
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
