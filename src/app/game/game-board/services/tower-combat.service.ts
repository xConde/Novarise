import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy } from '../models/enemy.model';
import {
  PlacedTower,
  TowerType,
  TowerStats,
  TOWER_CONFIGS,
  MAX_TOWER_LEVEL,
  getUpgradeCost,
  getEffectiveStats,
  TOWER_ABILITIES,
  ABILITY_CONFIG,
  TargetingPriority,
  TARGETING_PRIORITIES,
} from '../models/tower.model';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { AudioService } from './audio.service';
import { PROJECTILE_CONFIG } from '../constants/ui.constants';
import { CHAIN_LIGHTNING_CONFIG, MORTAR_VISUAL_CONFIG, GROUND_EFFECT_Y, SLOW_VISUAL_CONFIG } from '../constants/combat.constants';
import { DamageNumberType } from '../constants/damage-number.constants';

/** A single projectile or effect hit that produced visible damage. */
export interface HitEvent {
  position: { x: number; y: number; z: number };
  damage: number;
  type: DamageNumberType;
}

interface Projectile {
  id: string;
  mesh: THREE.Mesh;
  towerKey: string;
  targetId: string;
  speed: number;
  damage: number;
  splashRadius: number;
  towerType: TowerType;
  napalmActive?: boolean;
}

/** A chain arc line that persists for a short visual duration before removal. */
interface ChainArc {
  line: THREE.Line;
  expiresAt: number;
}

/** A mortar blast zone that persists and deals DoT. */
interface MortarZone {
  mesh: THREE.Mesh;
  centerX: number;
  centerZ: number;
  blastRadius: number;
  dotDamage: number;
  expiresAt: number;
  lastTickTime: number;
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
      mesh,
      abilityCooldownEnd: 0,
      abilityActiveEnd: 0,
      abilityCharges: 0,
      abilityPrimed: false,
      targetingPriority: TargetingPriority.FIRST,
    });
  }

  /** Activate the tower's special ability. Returns false if not found or on cooldown. */
  activateAbility(key: string): boolean {
    const tower = this.placedTowers.get(key);
    if (!tower) return false;
    if (this.gameTime < tower.abilityCooldownEnd) return false;

    const ability = TOWER_ABILITIES[tower.type];
    tower.abilityCooldownEnd = this.gameTime + ability.cooldown;

    switch (tower.type) {
      case TowerType.BASIC:
        tower.abilityActiveEnd = this.gameTime + ability.duration;
        break;
      case TowerType.SLOW:
        tower.abilityActiveEnd = this.gameTime + ability.duration;
        this.applyFreezeAura(tower);
        break;
      case TowerType.MORTAR:
        tower.abilityCharges = ABILITY_CONFIG.barrageCharges;
        break;
      case TowerType.SNIPER:
      case TowerType.SPLASH:
      case TowerType.CHAIN:
        tower.abilityPrimed = true;
        break;
    }

    return true;
  }

  getGameTime(): number {
    return this.gameTime;
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

  update(deltaTime: number, scene: THREE.Scene): { killed: string[]; fired: TowerType[]; hitCount: number; hits: HitEvent[] } {
    this.gameTime += deltaTime;
    const killedEnemyIds: string[] = [];
    const firedTowerTypes: TowerType[] = [];
    const hitEvents: HitEvent[] = [];

    this.expireSlowEffects();

    this.placedTowers.forEach(tower => {
      const stats = getEffectiveStats(tower.type, tower.level);

      // Expire Freeze ability
      if (tower.type === TowerType.SLOW && tower.abilityActiveEnd > 0 && this.gameTime >= tower.abilityActiveEnd) {
        this.expireFreezeEffect(tower);
        tower.abilityActiveEnd = 0;
      }

      // Expire Rapid Fire visual state
      if (tower.type === TowerType.BASIC && tower.abilityActiveEnd > 0 && this.gameTime >= tower.abilityActiveEnd) {
        tower.abilityActiveEnd = 0;
      }

      // Determine effective fire rate accounting for abilities
      let effectiveFireRate = stats.fireRate;
      if (tower.type === TowerType.BASIC && tower.abilityActiveEnd > this.gameTime) {
        effectiveFireRate = stats.fireRate * ABILITY_CONFIG.rapidFireMultiplier;
      } else if (tower.type === TowerType.MORTAR && tower.abilityCharges > 0) {
        effectiveFireRate = ABILITY_CONFIG.barrageFireRate;
      }

      const timeSinceLastFire = this.gameTime - tower.lastFireTime;
      if (timeSinceLastFire < effectiveFireRate) return;

      if (tower.type === TowerType.SLOW) {
        this.applySlowAura(tower, stats);
        tower.lastFireTime = this.gameTime;
        firedTowerTypes.push(tower.type);
        return;
      }

      const target = this.findTarget(tower, stats);
      if (!target) return;

      tower.lastFireTime = this.gameTime;

      if (tower.type === TowerType.CHAIN) {
        const chainCountOverride = tower.abilityPrimed ? ABILITY_CONFIG.overloadChainCount : undefined;
        const { kills, hits } = this.fireChainLightning(tower, target, stats, scene, chainCountOverride);
        if (tower.abilityPrimed) tower.abilityPrimed = false;
        killedEnemyIds.push(...kills);
        hitEvents.push(...hits);
        if (kills.length > 0) {
          const t = this.placedTowers.get(tower.id);
          if (t) t.kills += kills.length;
        }
      } else {
        this.fireProjectile(tower, target, stats, scene);
        if (tower.type === TowerType.MORTAR && tower.abilityCharges > 0) {
          tower.abilityCharges--;
        }
      }

      firedTowerTypes.push(tower.type);
    });

    const survivingProjectiles: Projectile[] = [];
    let hitCount = 0;
    for (const proj of this.projectiles) {
      const enemy = this.enemyService.getEnemies().get(proj.targetId);

      if (!enemy) {
        this.removeProjectileMesh(proj, scene);
        continue;
      }

      const dx = enemy.position.x - proj.mesh.position.x;
      const dz = enemy.position.z - proj.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const moveDistance = proj.speed * deltaTime;

      if (moveDistance >= dist) {
        const { kills, hits } = this.applyDamage(proj, scene);
        killedEnemyIds.push(...kills);
        hitEvents.push(...hits);
        hitCount++;
        this.removeProjectileMesh(proj, scene);
      } else {
        const nx = dx / dist;
        const nz = dz / dist;
        proj.mesh.position.x += nx * moveDistance;
        proj.mesh.position.z += nz * moveDistance;
        survivingProjectiles.push(proj);
      }
    }
    this.projectiles = survivingProjectiles;

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

    const survivingZones: MortarZone[] = [];
    for (const zone of this.mortarZones) {
      if (this.gameTime >= zone.expiresAt) {
        scene.remove(zone.mesh);
        zone.mesh.geometry.dispose();
        (zone.mesh.material as THREE.Material).dispose();
        continue;
      }

      if (this.gameTime - zone.lastTickTime >= MORTAR_VISUAL_CONFIG.tickInterval) {
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
            result.spawnedEnemies.forEach(mini => {
              if (mini.mesh) scene.add(mini.mesh);
            });
          }
        });
      }

      survivingZones.push(zone);
    }
    this.mortarZones = survivingZones;

    return { killed: killedEnemyIds, fired: firedTowerTypes, hitCount, hits: hitEvents };
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

    let best: Enemy | null = null;
    let bestScore = -Infinity;

    this.enemyService.getEnemies().forEach(enemy => {
      if (enemy.health <= 0) return;

      const dx = enemy.position.x - towerWorldX;
      const dz = enemy.position.z - towerWorldZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > stats.range) return;

      let score: number;
      switch (tower.targetingPriority) {
        case TargetingPriority.FIRST:
          score = enemy.distanceTraveled; // Higher = closer to exit
          break;
        case TargetingPriority.LAST:
          score = -enemy.distanceTraveled; // Lower distance = farthest from exit
          break;
        case TargetingPriority.STRONGEST:
          score = enemy.health;
          break;
        case TargetingPriority.WEAKEST:
          score = -enemy.health; // Negate so lowest HP wins
          break;
        default:
          score = enemy.distanceTraveled;
      }

      if (score > bestScore) {
        best = enemy;
        bestScore = score;
      }
    });

    return best;
  }

  /** Cycle a tower's targeting priority to the next value. Returns new priority or null if tower not found. */
  cycleTargetingPriority(key: string): TargetingPriority | null {
    const tower = this.placedTowers.get(key);
    if (!tower) return null;
    tower.targetingPriority = ((tower.targetingPriority + 1) % TARGETING_PRIORITIES.length) as TargetingPriority;
    return tower.targetingPriority;
  }

  private applySlowAura(tower: PlacedTower, stats: TowerStats): void {
    const { x: towerWorldX, z: towerWorldZ } = this.getTowerWorldPos(tower);
    const slowFactor = stats.slowFactor ?? TOWER_CONFIGS[TowerType.SLOW].slowFactor!;
    const slowDuration = stats.slowDuration ?? TOWER_CONFIGS[TowerType.SLOW].slowDuration!;

    this.enemyService.getEnemies().forEach(enemy => {
      if (enemy.health <= 0) return;

      const dx = enemy.position.x - towerWorldX;
      const dz = enemy.position.z - towerWorldZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > stats.range) return;

      const existing = this.slowEffects.get(enemy.id);
      if (existing) {
        existing.expiresAt = this.gameTime + slowDuration;
      } else {
        const originalSpeed = enemy.speed;
        enemy.speed = originalSpeed * slowFactor;
        this.slowEffects.set(enemy.id, {
          enemyId: enemy.id,
          originalSpeed,
          expiresAt: this.gameTime + slowDuration
        });
        // Visual: tint mesh blue to indicate slow
        if (enemy.mesh) {
          const mat = enemy.mesh.material as THREE.MeshLambertMaterial;
          enemy.mesh.userData['originalColor'] = mat.color.getHex();
          enemy.mesh.userData['originalEmissive'] = mat.emissive.getHex();
          mat.color.setHex(SLOW_VISUAL_CONFIG.tintColor);
          mat.emissive.setHex(SLOW_VISUAL_CONFIG.tintEmissive);
        }
      }
    });
  }

  /** Apply Freeze ability: set all enemies in range to speed 0. */
  private applyFreezeAura(tower: PlacedTower): void {
    const stats = getEffectiveStats(tower.type, tower.level);
    const { x: towerWorldX, z: towerWorldZ } = this.getTowerWorldPos(tower);
    const freezeDuration = TOWER_ABILITIES[tower.type].duration;

    this.enemyService.getEnemies().forEach(enemy => {
      if (enemy.health <= 0) return;

      const dx = enemy.position.x - towerWorldX;
      const dz = enemy.position.z - towerWorldZ;
      if (Math.sqrt(dx * dx + dz * dz) > stats.range) return;

      const existing = this.slowEffects.get(enemy.id);
      if (existing) {
        // Update expiresAt but do NOT overwrite originalSpeed — it must retain
        // the base (pre-slow) speed so that when the freeze expires the enemy
        // restores to its true unmodified speed, not the already-slowed speed.
        existing.expiresAt = this.gameTime + freezeDuration;
        enemy.speed = ABILITY_CONFIG.freezeSpeedFactor;
      } else {
        const originalSpeed = enemy.speed;
        enemy.speed = ABILITY_CONFIG.freezeSpeedFactor;
        this.slowEffects.set(enemy.id, {
          enemyId: enemy.id,
          originalSpeed,
          expiresAt: this.gameTime + freezeDuration,
        });
        // Visual: tint mesh blue to indicate freeze
        if (enemy.mesh) {
          const mat = enemy.mesh.material as THREE.MeshLambertMaterial;
          enemy.mesh.userData['originalColor'] = mat.color.getHex();
          enemy.mesh.userData['originalEmissive'] = mat.emissive.getHex();
          mat.color.setHex(SLOW_VISUAL_CONFIG.tintColor);
          mat.emissive.setHex(SLOW_VISUAL_CONFIG.tintEmissive);
        }
      }
    });
  }

  /** Restore freeze-affected enemies to their original speed. */
  private expireFreezeEffect(_tower: PlacedTower): void {
    // Iterate all tracked slow/freeze effects whose expiresAt has passed.
    // Do NOT filter by range — enemies that moved out of range while frozen
    // must still be unfrozen when the effect expires.
    for (const [enemyId, effect] of this.slowEffects) {
      if (this.gameTime < effect.expiresAt) continue;

      const enemy = this.enemyService.getEnemies().get(enemyId);
      if (enemy && enemy.health > 0 && enemy.speed === ABILITY_CONFIG.freezeSpeedFactor) {
        enemy.speed = effect.originalSpeed;
        // Visual: restore original mesh color
        if (enemy.mesh) {
          const mat = enemy.mesh.material as THREE.MeshLambertMaterial;
          const origColor = enemy.mesh.userData['originalColor'];
          const origEmissive = enemy.mesh.userData['originalEmissive'];
          if (origColor !== undefined) mat.color.setHex(origColor);
          if (origEmissive !== undefined) mat.emissive.setHex(origEmissive);
          delete enemy.mesh.userData['originalColor'];
          delete enemy.mesh.userData['originalEmissive'];
        }
        this.slowEffects.delete(enemyId);
      }
    }
  }

  private expireSlowEffects(): void {
    for (const [enemyId, effect] of this.slowEffects) {
      if (this.gameTime >= effect.expiresAt) {
        const enemy = this.enemyService.getEnemies().get(enemyId);
        if (enemy && enemy.health > 0) {
          enemy.speed = effect.originalSpeed;
          // Visual: restore original mesh color
          if (enemy.mesh) {
            const mat = enemy.mesh.material as THREE.MeshLambertMaterial;
            const origColor = enemy.mesh.userData['originalColor'];
            const origEmissive = enemy.mesh.userData['originalEmissive'];
            if (origColor !== undefined) mat.color.setHex(origColor);
            if (origEmissive !== undefined) mat.emissive.setHex(origEmissive);
            delete enemy.mesh.userData['originalColor'];
            delete enemy.mesh.userData['originalEmissive'];
          }
        }
        this.slowEffects.delete(enemyId);
      }
    }
  }

  private fireChainLightning(
    tower: PlacedTower,
    primaryTarget: Enemy,
    stats: TowerStats,
    scene: THREE.Scene,
    chainCountOverride?: number
  ): { kills: string[]; hits: HitEvent[] } {
    const chainCount = chainCountOverride ?? (stats.chainCount ?? TOWER_CONFIGS[TowerType.CHAIN].chainCount!);
    const chainRange = stats.chainRange ?? TOWER_CONFIGS[TowerType.CHAIN].chainRange!;
    const kills: string[] = [];
    const hits: HitEvent[] = [];
    const hitIds = new Set<string>();

    this.audioService.playSfx('chainZap');

    let currentTarget: Enemy = primaryTarget;
    let currentDamage = stats.damage;

    const towerPos = this.getTowerWorldPos(tower);
    let previousX = towerPos.x;
    let previousZ = towerPos.z;

    for (let bounce = 0; bounce <= chainCount; bounce++) {
      hitIds.add(currentTarget.id);

      const fromX = previousX;
      const fromZ = previousZ;
      const toX = currentTarget.position.x;
      const toZ = currentTarget.position.z;

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
          opacity: CHAIN_LIGHTNING_CONFIG.arcOpacity
        });
        const arc = new THREE.Line(arcGeom, arcMat);
        scene.add(arc);
        this.chainArcs.push({ line: arc, expiresAt: this.gameTime + CHAIN_LIGHTNING_CONFIG.arcLifetime });
      }

      const chainResult = this.enemyService.damageEnemy(currentTarget.id, currentDamage);
      if (chainResult.killed) {
        kills.push(currentTarget.id);
      }
      hits.push({
        position: { x: currentTarget.position.x, y: currentTarget.position.y, z: currentTarget.position.z },
        damage: currentDamage,
        type: 'chain',
      });
      chainResult.spawnedEnemies.forEach(mini => {
        if (mini.mesh) scene.add(mini.mesh);
      });

      if (bounce === chainCount) break;

      const nextTarget = this.findChainTarget(currentTarget, chainRange, hitIds);
      if (!nextTarget) break;

      previousX = currentTarget.position.x;
      previousZ = currentTarget.position.z;

      currentDamage = Math.round(currentDamage * CHAIN_LIGHTNING_CONFIG.damageFalloff);
      if (currentDamage < 1) break;
      currentTarget = nextTarget;
    }

    return { kills, hits };
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
      const napalmActive = tower.abilityPrimed;
      if (napalmActive) tower.abilityPrimed = false;
      this.fireMortarProjectile(tower, target, stats, towerWorldX, towerWorldZ, scene, napalmActive);
      return;
    }

    // Overcharge: triple damage on next Sniper shot
    let effectiveDamage = stats.damage;
    if (tower.type === TowerType.SNIPER && tower.abilityPrimed) {
      effectiveDamage = Math.round(stats.damage * ABILITY_CONFIG.overchargeMultiplier);
      tower.abilityPrimed = false;
    }

    // Napalm: next Splash shot creates a burning zone on impact
    const napalmActive = tower.type === TowerType.SPLASH && tower.abilityPrimed;
    if (napalmActive) tower.abilityPrimed = false;

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
      damage: effectiveDamage,
      splashRadius: stats.splashRadius,
      towerType: tower.type,
      napalmActive,
    });
  }

  private fireMortarProjectile(
    tower: PlacedTower,
    target: Enemy,
    stats: TowerStats,
    towerWorldX: number,
    towerWorldZ: number,
    scene: THREE.Scene,
    napalmActive = false
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
      towerKey: tower.id,
      targetId: target.id,
      speed: stats.projectileSpeed,
      damage: stats.damage,
      splashRadius: 0,
      towerType: TowerType.MORTAR,
      napalmActive,
    });
  }

  private createMortarZone(
    impactX: number,
    impactZ: number,
    stats: TowerStats,
    scene: THREE.Scene,
    dotDurationOverride?: number
  ): string[] {
    const blastRadius = stats.blastRadius ?? TOWER_CONFIGS[TowerType.MORTAR].blastRadius!;
    const dotDuration = dotDurationOverride ?? (stats.dotDuration ?? TOWER_CONFIGS[TowerType.MORTAR].dotDuration!);
    const dotDamage = stats.dotDamage ?? TOWER_CONFIGS[TowerType.MORTAR].dotDamage!;

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

  private applyDamage(proj: Projectile, scene: THREE.Scene): { kills: string[]; hits: HitEvent[] } {
    const kills: string[] = [];
    const hits: HitEvent[] = [];

    if (proj.towerType === TowerType.MORTAR) {
      const tower = this.placedTowers.get(proj.towerKey);
      const stats = tower ? getEffectiveStats(tower.type, tower.level) : null;
      if (stats) {
        const dotDurationOverride = proj.napalmActive ? ABILITY_CONFIG.napalmDotDuration : undefined;
        const initialKills = this.createMortarZone(proj.mesh.position.x, proj.mesh.position.z, stats, scene, dotDurationOverride);
        kills.push(...initialKills);
      }
      // Emit a single hit at the impact point for the mortar visual — DoT ticks are silent
      hits.push({
        position: { x: proj.mesh.position.x, y: GROUND_EFFECT_Y, z: proj.mesh.position.z },
        damage: proj.damage,
        type: 'splash',
      });
    } else if (proj.napalmActive) {
      // Napalm: Splash projectile that also creates a burning zone on impact
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
          hits.push({
            position: { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z },
            damage: proj.damage,
            type: 'splash',
          });
          result.spawnedEnemies.forEach(mini => {
            if (mini.mesh) scene.add(mini.mesh);
          });
        }
      });

      // Create burning zone at impact
      const napalmGeom = new THREE.CircleGeometry(proj.splashRadius, MORTAR_VISUAL_CONFIG.zoneSegments);
      const napalmMat = new THREE.MeshBasicMaterial({
        color: MORTAR_VISUAL_CONFIG.zoneColor,
        transparent: true,
        opacity: MORTAR_VISUAL_CONFIG.zoneOpacity,
        side: THREE.DoubleSide
      });
      const napalmMesh = new THREE.Mesh(napalmGeom, napalmMat);
      napalmMesh.rotation.x = -Math.PI / 2;
      napalmMesh.position.set(impactX, GROUND_EFFECT_Y, impactZ);
      scene.add(napalmMesh);

      const dotDamage = Math.max(1, Math.round(proj.damage * ABILITY_CONFIG.napalmDotDamageFraction));
      this.mortarZones.push({
        mesh: napalmMesh,
        centerX: impactX,
        centerZ: impactZ,
        blastRadius: proj.splashRadius,
        dotDamage,
        expiresAt: this.gameTime + ABILITY_CONFIG.napalmDotDuration,
        lastTickTime: this.gameTime,
      });
    } else if (proj.splashRadius > 0) {
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
          hits.push({
            position: { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z },
            damage: proj.damage,
            type: 'splash',
          });
          result.spawnedEnemies.forEach(mini => {
            if (mini.mesh) scene.add(mini.mesh);
          });
        }
      });
    } else {
      const target = this.enemyService.getEnemies().get(proj.targetId);
      const result = this.enemyService.damageEnemy(proj.targetId, proj.damage);
      if (result.killed) {
        kills.push(proj.targetId);
      }
      if (target !== undefined) {
        hits.push({
          position: { x: target.position.x, y: target.position.y, z: target.position.z },
          damage: proj.damage,
          type: 'normal',
        });
      }
      result.spawnedEnemies.forEach(mini => {
        if (mini.mesh) scene.add(mini.mesh);
      });
    }

    if (kills.length > 0) {
      const tower = this.placedTowers.get(proj.towerKey);
      if (tower) {
        tower.kills += kills.length;
      }
    }

    return { kills, hits };
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

  /** Clear in-flight combat effects without removing towers. Used by wave restart. */
  clearProjectiles(scene: THREE.Scene): void {
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

    for (const effect of this.slowEffects.values()) {
      const enemy = this.enemyService.getEnemies().get(effect.enemyId);
      if (enemy && enemy.health > 0) {
        enemy.speed = effect.originalSpeed;
        if (enemy.mesh) {
          const mat = enemy.mesh.material as THREE.MeshLambertMaterial;
          const origColor = enemy.mesh.userData['originalColor'];
          const origEmissive = enemy.mesh.userData['originalEmissive'];
          if (origColor !== undefined) mat.color.setHex(origColor);
          if (origEmissive !== undefined) mat.emissive.setHex(origEmissive);
          delete enemy.mesh.userData['originalColor'];
          delete enemy.mesh.userData['originalEmissive'];
        }
      }
    }
    this.slowEffects.clear();
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

    for (const effect of this.slowEffects.values()) {
      const enemy = this.enemyService.getEnemies().get(effect.enemyId);
      if (enemy && enemy.health > 0) {
        enemy.speed = effect.originalSpeed;
        if (enemy.mesh) {
          const mat = enemy.mesh.material as THREE.MeshLambertMaterial;
          const origColor = enemy.mesh.userData['originalColor'];
          const origEmissive = enemy.mesh.userData['originalEmissive'];
          if (origColor !== undefined) mat.color.setHex(origColor);
          if (origEmissive !== undefined) mat.emissive.setHex(origEmissive);
          delete enemy.mesh.userData['originalColor'];
          delete enemy.mesh.userData['originalEmissive'];
        }
      }
    }
    this.slowEffects.clear();

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
