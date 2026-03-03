import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy } from '../models/enemy.model';
import { PlacedTower, TowerType, TowerStats, TOWER_CONFIGS, MAX_TOWER_LEVEL, getUpgradeCost, getEffectiveStats } from '../models/tower.model';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { PROJECTILE_CONFIG } from '../constants/ui.constants';

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

@Injectable()
export class TowerCombatService {
  private placedTowers: Map<string, PlacedTower> = new Map();
  private projectiles: Projectile[] = [];
  private projectileCounter = 0;
  private gameTime = 0;

  constructor(
    private enemyService: EnemyService,
    private gameBoardService: GameBoardService
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

    // Tower targeting and firing — resolve stats per-tower using level
    this.placedTowers.forEach(tower => {
      const stats = getEffectiveStats(tower.type, tower.level);
      const timeSinceLastFire = this.gameTime - tower.lastFireTime;

      if (timeSinceLastFire < stats.fireRate) return;

      const target = this.findTarget(tower, stats);
      if (!target) return;

      tower.lastFireTime = this.gameTime;
      this.fireProjectile(tower, target, stats, scene);
      firedTowerTypes.push(tower.type);
    });

    // Update projectiles
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

    return { killed: killedEnemyIds, fired: firedTowerTypes, hitCount };
  }

  private findTarget(tower: PlacedTower, stats: TowerStats): Enemy | null {
    const boardWidth = this.gameBoardService.getBoardWidth();
    const boardHeight = this.gameBoardService.getBoardHeight();
    const tileSize = this.gameBoardService.getTileSize();
    const towerWorldX = (tower.col - boardWidth / 2) * tileSize;
    const towerWorldZ = (tower.row - boardHeight / 2) * tileSize;

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

  private fireProjectile(tower: PlacedTower, target: Enemy, stats: TowerStats, scene: THREE.Scene): void {
    const boardWidth = this.gameBoardService.getBoardWidth();
    const boardHeight = this.gameBoardService.getBoardHeight();
    const tileSize = this.gameBoardService.getTileSize();
    const towerWorldX = (tower.col - boardWidth / 2) * tileSize;
    const towerWorldZ = (tower.row - boardHeight / 2) * tileSize;

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

  private applyDamage(proj: Projectile, scene: THREE.Scene): string[] {
    const kills: string[] = [];

    if (proj.splashRadius > 0) {
      // Splash damage — hit all enemies within radius of impact point
      const impactX = proj.mesh.position.x;
      const impactZ = proj.mesh.position.z;

      this.enemyService.getEnemies().forEach(enemy => {
        const dx = enemy.position.x - impactX;
        const dz = enemy.position.z - impactZ;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= proj.splashRadius) {
          if (this.enemyService.damageEnemy(enemy.id, proj.damage)) {
            kills.push(enemy.id);
          }
        }
      });
    } else {
      // Single target damage
      if (this.enemyService.damageEnemy(proj.targetId, proj.damage)) {
        kills.push(proj.targetId);
      }
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
    this.placedTowers.clear();
    this.projectileCounter = 0;
    this.gameTime = 0;
  }
}
