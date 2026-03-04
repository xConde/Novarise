import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy } from '../models/enemy.model';
import { PlacedTower, TowerType, TowerStats, TOWER_CONFIGS, MAX_TOWER_LEVEL, getUpgradeCost, getEffectiveStats } from '../models/tower.model';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { AudioService } from './audio.service';
import { PROJECTILE_CONFIG } from '../constants/ui.constants';
import { CHAIN_LIGHTNING_CONFIG, MORTAR_VISUAL_CONFIG, GROUND_EFFECT_Y } from '../constants/combat.constants';

interface Projectile {
  id: string;
  mesh: THREE.Mesh;
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

/** Slow effect tracked per enemy. */
interface SlowEffect {
  enemyId: string;
  originalSpeed: number;
  expiresAt: number;
}

@Injectable()
export class TowerCombatService {
  private placedTowers: Map<string, PlacedTower> = new Map();
  private projectiles: Projectile[] = [];
  private chainArcs: ChainArc[] = [];
  private mortarZones: MortarZone[] = [];
  private slowEffects: Map<string, SlowEffect> = new Map();
  private projectileCounter = 0;
  private gameTime = 0;

  constructor(
    private enemyService: EnemyService,
    private gameBoardService: GameBoardService,
    private audioService: AudioService
  ) {}

  registerTower(row: number, col: number, type: TowerType, mesh: THREE.Group): void {
    const key = `${row}-${col}`;
    this.placedTowers.set(key, {
      id: key,
      type,
      level: 1,
      row,
      col,
      lastFireTime: -Infinity,
      kills: 0,
      totalInvested: TOWER_CONFIGS[type].cost,
      mesh
    });
  }

  upgradeTower(key: string): boolean {
    const tower = this.placedTowers.get(key);
    if (!tower || tower.level >= MAX_TOWER_LEVEL) return false;

    const cost = getUpgradeCost(tower.type, tower.level);
    tower.level++;
    tower.totalInvested += cost;
    return true;
  }

  unregisterTower(key: string): PlacedTower | undefined {
    const tower = this.placedTowers.get(key);
    if (!tower) return undefined;
    this.placedTowers.delete(key);
    return tower;
  }

  update(deltaTime: number, scene: THREE.Scene): { killed: string[]; fired: TowerType[]; hitCount: number } {
    this.gameTime += deltaTime;
    const killedEnemyIds: string[] = [];
    const firedTowerTypes: TowerType[] = [];

    // Expire slow effects before tower processing so towers see accurate speeds
    this.expireSlowEffects();

    // Tower targeting and firing — resolve stats per-tower using level
    this.placedTowers.forEach(tower => {
      const stats = getEffectiveStats(tower.type, tower.level);
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
        killedEnemyIds.push(...kills);
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
        // Hit — apply damage before disposing mesh (applyDamage reads proj.mesh.position)
        const kills = this.applyDamage(proj, scene);
        killedEnemyIds.push(...kills);
        hitCount++;
        this.removeProjectileMesh(proj, scene);
      } else {
        // Move toward target
        const nx = dx / dist;
        const nz = dz / dist;
        proj.mesh.position.x += nx * moveDistance;
        proj.mesh.position.z += nz * moveDistance;
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
      if (this.gameTime - zone.lastTickTime >= 1.0) {
        zone.lastTickTime = this.gameTime;
        this.enemyService.getEnemies().forEach(enemy => {
          if (enemy.health <= 0) return;
          const dx = enemy.position.x - zone.centerX;
          const dz = enemy.position.z - zone.centerZ;
          if (Math.sqrt(dx * dx + dz * dz) <= zone.blastRadius) {
            const result = this.enemyService.damageEnemy(enemy.id, zone.dotDamage);
            if (result.killed) {
              killedEnemyIds.push(enemy.id);
            }
            // Mini-swarm meshes from DoT kills are added to scene here
            result.spawnedEnemies.forEach(mini => {
              if (mini.mesh) scene.add(mini.mesh);
            });
          }
        });
      }

      survivingZones.push(zone);
    }
    this.mortarZones = survivingZones;

    return { killed: killedEnemyIds, fired: firedTowerTypes, hitCount };
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

  private findTarget(tower: PlacedTower, stats: TowerStats): Enemy | null {
    const { x: towerWorldX, z: towerWorldZ } = this.getTowerWorldPos(tower);

    let nearest: Enemy | null = null;
    let nearestDist = Infinity;

    this.enemyService.getEnemies().forEach(enemy => {
      if (enemy.health <= 0) return;

      const dx = enemy.position.x - towerWorldX;
      const dz = enemy.position.z - towerWorldZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Range check in world units (tileSize = 1, so range in tiles = range in world units)
      if (dist <= stats.range && dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    });

    return nearest;
  }

  private applySlowAura(tower: PlacedTower, stats: TowerStats): void {
    const { x: towerWorldX, z: towerWorldZ } = this.getTowerWorldPos(tower);
    const slowFactor = stats.slowFactor ?? 0.5;
    const slowDuration = stats.slowDuration ?? 2;

    this.enemyService.getEnemies().forEach(enemy => {
      if (enemy.health <= 0) return;

      const dx = enemy.position.x - towerWorldX;
      const dz = enemy.position.z - towerWorldZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > stats.range) return;

      const existing = this.slowEffects.get(enemy.id);
      if (existing) {
        // Refresh duration — do not re-apply speed reduction (already slowed)
        existing.expiresAt = this.gameTime + slowDuration;
      } else {
        // First application — record original speed and reduce it
        const originalSpeed = enemy.speed;
        enemy.speed = originalSpeed * slowFactor;
        this.slowEffects.set(enemy.id, {
          enemyId: enemy.id,
          originalSpeed,
          expiresAt: this.gameTime + slowDuration
        });
      }
    });
  }

  private expireSlowEffects(): void {
    for (const [enemyId, effect] of this.slowEffects) {
      if (this.gameTime >= effect.expiresAt) {
        // Restore speed if enemy is still alive
        const enemy = this.enemyService.getEnemies().get(enemyId);
        if (enemy && enemy.health > 0) {
          enemy.speed = effect.originalSpeed;
        }
        this.slowEffects.delete(enemyId);
      }
    }
  }

  private fireChainLightning(
    tower: PlacedTower,
    primaryTarget: Enemy,
    stats: TowerStats,
    scene: THREE.Scene
  ): string[] {
    const chainCount = stats.chainCount ?? 3;
    const chainRange = stats.chainRange ?? 2;
    const kills: string[] = [];
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

      // Create visual arc line (tower → first target, then target → next target)
      {
        const arcGeom = new THREE.BufferGeometry();
        const vertices = new Float32Array([
          fromX, GROUND_EFFECT_Y + CHAIN_LIGHTNING_CONFIG.arcHeightOffset, fromZ,
          toX,   GROUND_EFFECT_Y + CHAIN_LIGHTNING_CONFIG.arcHeightOffset, toZ
        ]);
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
        kills.push(currentTarget.id);
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

    this.enemyService.getEnemies().forEach(enemy => {
      if (enemy.health <= 0 || excludeIds.has(enemy.id)) return;

      const dx = enemy.position.x - from.position.x;
      const dz = enemy.position.z - from.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= chainRange && dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    });

    return nearest;
  }

  private fireProjectile(tower: PlacedTower, target: Enemy, stats: TowerStats, scene: THREE.Scene): void {
    const { x: towerWorldX, z: towerWorldZ } = this.getTowerWorldPos(tower);

    if (tower.type === TowerType.MORTAR) {
      // Mortar fires a slow arc projectile to the target's current position
      this.fireMortarProjectile(tower, target, stats, towerWorldX, towerWorldZ, scene);
      return;
    }

    const geometry = new THREE.SphereGeometry(PROJECTILE_CONFIG.radius, PROJECTILE_CONFIG.segments, PROJECTILE_CONFIG.segments);
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
    const geometry = new THREE.SphereGeometry(PROJECTILE_CONFIG.radius * 1.5, PROJECTILE_CONFIG.segments, PROJECTILE_CONFIG.segments);
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
  ): string[] {
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
    const initialKills: string[] = [];
    this.enemyService.getEnemies().forEach(enemy => {
      if (enemy.health <= 0) return;
      const dx = enemy.position.x - impactX;
      const dz = enemy.position.z - impactZ;
      if (Math.sqrt(dx * dx + dz * dz) <= blastRadius) {
        const result = this.enemyService.damageEnemy(enemy.id, dotDamage);
        if (result.killed) {
          initialKills.push(enemy.id);
        }
        result.spawnedEnemies.forEach(mini => {
          if (mini.mesh) scene.add(mini.mesh);
        });
      }
    });

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

  private applyDamage(proj: Projectile, scene: THREE.Scene): string[] {
    const kills: string[] = [];

    if (proj.towerType === TowerType.MORTAR) {
      // Look up the mortar tower's stats to create the zone
      const tower = this.placedTowers.get(proj.towerKey);
      const stats = tower ? getEffectiveStats(tower.type, tower.level) : null;
      if (stats) {
        const initialKills = this.createMortarZone(proj.mesh.position.x, proj.mesh.position.z, stats, scene);
        kills.push(...initialKills);
      }
      // Further DoT kills are tracked in the zone update loop
    } else if (proj.splashRadius > 0) {
      // Splash damage — hit all enemies within radius of impact point
      const impactX = proj.mesh.position.x;
      const impactZ = proj.mesh.position.z;

      this.enemyService.getEnemies().forEach(enemy => {
        const dx = enemy.position.x - impactX;
        const dz = enemy.position.z - impactZ;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= proj.splashRadius) {
          const result = this.enemyService.damageEnemy(enemy.id, proj.damage);
          if (result.killed) {
            kills.push(enemy.id);
          }
          result.spawnedEnemies.forEach(mini => {
            if (mini.mesh) scene.add(mini.mesh);
          });
        }
      });
    } else {
      // Single target damage
      const result = this.enemyService.damageEnemy(proj.targetId, proj.damage);
      if (result.killed) {
        kills.push(proj.targetId);
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
    scene.remove(proj.mesh);
    proj.mesh.geometry.dispose();
    if (Array.isArray(proj.mesh.material)) {
      proj.mesh.material.forEach(mat => mat.dispose());
    } else {
      proj.mesh.material.dispose();
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

    for (const arc of this.chainArcs) {
      scene.remove(arc.line);
      arc.line.geometry.dispose();
      (arc.line.material as THREE.Material).dispose();
    }
    this.chainArcs = [];

    for (const zone of this.mortarZones) {
      scene.remove(zone.mesh);
      zone.mesh.geometry.dispose();
      (zone.mesh.material as THREE.Material).dispose();
    }
    this.mortarZones = [];

    // Restore all slowed enemies to original speed
    for (const effect of this.slowEffects.values()) {
      const enemy = this.enemyService.getEnemies().get(effect.enemyId);
      if (enemy && enemy.health > 0) {
        enemy.speed = effect.originalSpeed;
      }
    }
    this.slowEffects.clear();

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
  }
}
