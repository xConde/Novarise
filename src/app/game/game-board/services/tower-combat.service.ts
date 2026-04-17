import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy } from '../models/enemy.model';
import { PlacedTower, TowerType, TowerStats, TowerSpecialization, TOWER_CONFIGS, MAX_TOWER_LEVEL, getUpgradeCost, getEffectiveStats, TargetingMode, DEFAULT_TARGETING_MODE, TARGETING_MODES } from '../models/tower.model';
import { assertNever } from '../utils/assert-never';
import { KillInfo, CombatAudioEvent } from '../models/combat-frame.model';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { StatusEffectType } from '../constants/status-effect.constants';
import { StatusEffectService } from './status-effect.service';
import { SpatialGrid } from '../utils/spatial-grid';
import { gridToWorld } from '../utils/coordinate-utils';
import { CombatVFXService } from './combat-vfx.service';
import { GameStateService } from './game-state.service';
import { TowerAnimationService } from './tower-animation.service';
import { ChainLightningService } from './chain-lightning.service';
// M2 S5: ProjectileService import removed — projectile.service.ts is dead and
// scheduled for file deletion in this same phase.
import { RelicService } from '../../../run/services/relic.service';
import { CardEffectService } from '../../../run/services/card-effect.service';
import { MODIFIER_STAT } from '../../../run/constants/modifier-stat.constants';
import { TowerStatOverrides } from '../../../run/models/card.model';
import { SerializablePlacedTower, SerializableMortarZone } from '../models/encounter-checkpoint.model';

/** M3 S4: turn-based mortar DoT zone. Replaces the legacy real-time path for fireTurn. */
interface TurnMortarZone {
  centerX: number;
  centerZ: number;
  blastRadius: number;
  dotDamage: number;
  /** Turn number AFTER which the zone expires (zone is active on turns < expiresOnTurn). */
  expiresOnTurn: number;
  statusEffect?: StatusEffectType;
  /**
   * Level of the mortar tower at the time of placement, frozen for the life
   * of this zone. Kill attribution reads this so upgrades to the placer
   * after placement don't retroactively change the recap's tier label.
   */
  placerLevel: number;
}

export { KillInfo, CombatAudioEvent } from '../models/combat-frame.model';

export interface RegisterTowerOptions {
  /** Turn the tower was placed on. Defaults to 0 (pre-combat SETUP phase). */
  placedAtTurn?: number;
  /** Per-card stat multipliers applied to this specific tower instance. */
  cardStatOverrides?: TowerStatOverrides;
}

@Injectable()
export class TowerCombatService {
  private placedTowers: Map<string, PlacedTower> = new Map();
  /**
   * Scratch TowerStats object reused when the tower-damage modifier is active,
   * avoiding a per-tower-per-frame object spread allocation.
   */
  private scratchStats: TowerStats = {
    damage: 0, range: 0, cost: 0,
    splashRadius: 0, color: 0,
  };
  /** M3 S4: turn-ticked mortar zones for the new turn-based engine. */
  private turnMortarZones: TurnMortarZone[] = [];
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
    // M2 S5: projectileService dependency removed — projectile.service.ts is dead.
    private relicService: RelicService,
    private cardEffectService: CardEffectService,
  ) {}

  /**
   * Registers a newly placed tower so it participates in targeting and firing.
   * `actualCost` tracks the real gold paid (may differ from base cost due to modifiers).
   * `opts.placedAtTurn` is the combat turn number when placed — used by QUICK_DRAW relic
   * (+1 shot on the placement turn). Defaults to 0 for setup-phase placements.
   */
  registerTower(
    row: number,
    col: number,
    type: TowerType,
    mesh: THREE.Group,
    actualCost: number = TOWER_CONFIGS[type].cost,
    opts: RegisterTowerOptions = {},
  ): void {
    const placedAtTurn = opts.placedAtTurn ?? 0;
    const cardStatOverrides = opts.cardStatOverrides;
    const key = `${row}-${col}`;
    this.placedTowers.set(key, {
      id: key,
      type,
      level: 1,
      row,
      col,
      kills: 0,
      totalInvested: actualCost,
      targetingMode: DEFAULT_TARGETING_MODE,
      mesh,
      placedAtTurn,
      cardStatOverrides,
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

  /**
   * Phase 4 turn-based firing. Each tower fires `shotsPerTurn` times (baseline
   * 1, scaffolded for future multi-shot). Targeting uses the existing
   * nearest/first/strongest logic. Projectile flight is bypassed — damage
   * applies instantly. Mortar creates turn-ticked DoT zones (TurnMortarZone)
   * that persist across turns and are processed by tickMortarZonesForTurn.
   *
   * Deterministic firing order: row then col, so a tower on (0,0) always fires
   * before (0,1), guaranteeing replay-stable resolution.
   *
   * @param scene       Active Three.js scene — needed for spawned mini-swarm meshes and chain VFX.
   * @param turnNumber  Current turn counter, used as the time clock for status
   *                    effect expiry (passed through to StatusEffectService.apply).
   */
  fireTurn(scene: THREE.Scene, turnNumber: number): { killed: KillInfo[]; fired: TowerType[]; hitCount: number; damageDealt: number } {
    const killed: KillInfo[] = [];
    const fired: TowerType[] = [];
    let hitCount = 0;
    let damageDealt = 0;

    this.rebuildSpatialGrid();

    const towerDamageMultiplier = this.gameStateService.getModifierEffects().towerDamageMultiplier ?? 1;
    const hasRelicModifiers = this.relicService.relicCount > 0;
    const cardDamageBoost = this.cardEffectService.getModifierValue(MODIFIER_STAT.DAMAGE);
    const cardRangeBoost = this.cardEffectService.getModifierValue(MODIFIER_STAT.RANGE);
    const sniperDamageBoost = this.cardEffectService.getModifierValue(MODIFIER_STAT.SNIPER_DAMAGE);
    const fireRateBoost = this.cardEffectService.getModifierValue(MODIFIER_STAT.FIRE_RATE);
    const chainBouncesBonus = this.cardEffectService.getModifierValue(MODIFIER_STAT.CHAIN_BOUNCES);
    const hasCardModifiers = cardDamageBoost !== 0 || cardRangeBoost !== 0 || sniperDamageBoost !== 0;

    // Deterministic firing order: row then col.
    const towerList = Array.from(this.placedTowers.values()).sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    for (const tower of towerList) {
      const baseStats = getEffectiveStats(tower.type, tower.level, tower.specialization);
      let stats: TowerStats;
      const hasCardStatOverrides = tower.cardStatOverrides !== undefined;
      if (towerDamageMultiplier !== 1 || hasRelicModifiers || hasCardModifiers || hasCardStatOverrides) {
        const relicDamage = this.relicService.getDamageMultiplier(tower.type);
        const relicRange = this.relicService.getRangeMultiplier(tower.type);
        const sniperBoost = (tower.type === TowerType.SNIPER && sniperDamageBoost !== 0) ? (1 + sniperDamageBoost) : 1;
        const cardDamageMult = tower.cardStatOverrides?.damageMultiplier ?? 1;
        this.scratchStats.damage = Math.round(baseStats.damage * towerDamageMultiplier * relicDamage * (1 + cardDamageBoost) * sniperBoost * cardDamageMult);
        const cardRangeMult = tower.cardStatOverrides?.rangeMultiplier ?? 1;
        this.scratchStats.range = baseStats.range * relicRange * (1 + cardRangeBoost) * cardRangeMult;
        this.scratchStats.cost = baseStats.cost;
        const cardSplashMult = tower.cardStatOverrides?.splashRadiusMultiplier ?? 1;
        this.scratchStats.splashRadius = (baseStats.splashRadius ?? 0) * this.relicService.getSplashRadiusMultiplier() * cardSplashMult;
        this.scratchStats.color = baseStats.color;
        this.scratchStats.slowFactor = baseStats.slowFactor;
        const cardChainBonus = tower.cardStatOverrides?.chainBounceBonus ?? 0;
        this.scratchStats.chainCount = baseStats.chainCount != null
          ? baseStats.chainCount + this.relicService.getChainBounceBonus() + cardChainBonus
          : baseStats.chainCount;
        this.scratchStats.chainRange = baseStats.chainRange;
        this.scratchStats.blastRadius = baseStats.blastRadius;
        this.scratchStats.dotDuration = baseStats.dotDuration;
        const cardDotMult = tower.cardStatOverrides?.dotDamageMultiplier ?? 1;
        this.scratchStats.dotDamage = baseStats.dotDamage != null
          ? baseStats.dotDamage * this.relicService.getDotDamageMultiplier() * cardDotMult
          : baseStats.dotDamage;
        this.scratchStats.statusEffect = baseStats.statusEffect;
        stats = this.scratchStats;
      } else {
        stats = baseStats;
      }

      // Phase 10 modifier: fireRate boost gives +1 shotsPerTurn at any positive value (ceil semantic).
      // 30% boost (RAPID_FIRE) → ceil(1.3) = 2. 50% (OVERCLOCK) → ceil(1.5) = 2. Stacked → ceil(1.8) = 2.
      const baseShots = Math.max(1, Math.ceil(1 + fireRateBoost));
      // QUICK_DRAW relic: +1 extra shot on the turn the tower was placed.
      const quickDrawBonus = this.relicService.hasQuickDraw() && (tower.placedAtTurn ?? 0) === turnNumber ? 1 : 0;
      const shotsPerTurn = baseShots + quickDrawBonus;

      for (let shot = 0; shot < shotsPerTurn; shot++) {
        if (tower.type === TowerType.SLOW) {
          this.applySlowAura(tower, stats, turnNumber);
          this.towerAnimationService.startMuzzleFlash(tower);
          fired.push(tower.type);
          break; // Aura fires once regardless of shotsPerTurn.
        }

        const target = this.findTarget(tower, stats);
        if (!target) break;

        this.towerAnimationService.startMuzzleFlash(tower);
        fired.push(tower.type);

        if (tower.type === TowerType.CHAIN) {
          const { x: towerWorldX, z: towerWorldZ } = this.getTowerWorldPos(tower);
          const chainResult = this.chainLightningService.fire(
            tower, target, stats, scene,
            towerWorldX, towerWorldZ,
            this.spatialGrid, turnNumber,
            chainBouncesBonus,
          );
          killed.push(...chainResult.kills);
          damageDealt += chainResult.damageDealt;
          hitCount += chainResult.hitCount;
          if (chainResult.kills.length > 0) tower.kills += chainResult.kills.length;
        } else if (tower.type === TowerType.MORTAR) {
          // M3 S4: mortar drops a turn-ticked DoT zone instead of one-shot.
          // Initial blast applies on placement turn; the zone then deals
          // dotDamage to enemies in radius for `dotDuration` turns.
          const blastRadius = stats.blastRadius ?? 1.5;
          const blastDamage = stats.dotDamage ?? stats.damage;
          const dotDuration = Math.max(1, Math.round(stats.dotDuration ?? 3));

          // Initial blast (same turn as placement)
          const candidates = this.spatialGrid.queryRadius(target.position.x, target.position.z, blastRadius);
          for (const enemy of candidates) {
            if (enemy.health <= 0) continue;
            // S1: flying enemies bypass ground effects — mortar initial blast is ground-level
            if (enemy.isFlying) continue;
            const dx = enemy.position.x - target.position.x;
            const dz = enemy.position.z - target.position.z;
            if (Math.sqrt(dx * dx + dz * dz) <= blastRadius) {
              const result = this.enemyService.damageEnemy(enemy.id, blastDamage);
              hitCount++;
              damageDealt += blastDamage;
              if (result.killed) {
                killed.push({ id: enemy.id, damage: blastDamage, towerType: tower.type, towerLevel: tower.level });
                tower.kills++;
              } else {
                this.enemyService.startHitFlash(enemy.id);
                if (stats.statusEffect) {
                  this.statusEffectService.apply(enemy.id, stats.statusEffect, turnNumber);
                }
              }
              result.spawnedEnemies.forEach(mini => {
                if (mini.mesh) scene.add(mini.mesh);
              });
            }
          }

          // Drop the persistent zone — ticks for `dotDuration` more turns.
          this.turnMortarZones.push({
            centerX: target.position.x,
            centerZ: target.position.z,
            blastRadius,
            dotDamage: blastDamage,
            expiresOnTurn: turnNumber + dotDuration,
            statusEffect: stats.statusEffect,
            placerLevel: tower.level,
          });

          // Visual zone — uses the existing VFX service. gameTime arg passed
          // through; for the new path we use turnNumber * approximation. The
          // VFX expiry is decoupled from logic and runs on RAF.
          this.combatVFXService.createMortarZoneMesh(
            target.position.x, target.position.z, blastRadius, dotDuration, scene, turnNumber,
          );
          this.pendingAudioEvents.push({ type: 'sfx', sfxKey: 'mortarExplosion' });
        } else {
          // Single-target or splash
          const splashRadius = stats.splashRadius ?? 0;
          if (splashRadius > 0) {
            const candidates = this.spatialGrid.queryRadius(target.position.x, target.position.z, splashRadius);
            for (const enemy of candidates) {
              if (enemy.health <= 0) continue;
              const dx = enemy.position.x - target.position.x;
              const dz = enemy.position.z - target.position.z;
              if (Math.sqrt(dx * dx + dz * dz) <= splashRadius) {
                const result = this.enemyService.damageEnemy(enemy.id, stats.damage);
                hitCount++;
                damageDealt += stats.damage;
                if (result.killed) {
                  killed.push({ id: enemy.id, damage: stats.damage, towerType: tower.type, towerLevel: tower.level });
                  tower.kills++;
                } else {
                  this.enemyService.startHitFlash(enemy.id);
                  if (stats.statusEffect) {
                    this.statusEffectService.apply(enemy.id, stats.statusEffect, turnNumber);
                  }
                }
                result.spawnedEnemies.forEach(mini => {
                  if (mini.mesh) scene.add(mini.mesh);
                });
              }
            }
          } else {
            const result = this.enemyService.damageEnemy(target.id, stats.damage);
            hitCount++;
            damageDealt += stats.damage;
            if (result.killed) {
              killed.push({ id: target.id, damage: stats.damage, towerType: tower.type, towerLevel: tower.level });
              tower.kills++;
            } else {
              this.enemyService.startHitFlash(target.id);
              if (stats.statusEffect) {
                this.statusEffectService.apply(target.id, stats.statusEffect, turnNumber);
              }
            }
            result.spawnedEnemies.forEach(mini => {
              if (mini.mesh) scene.add(mini.mesh);
            });
          }
        }
      }
    }

    return { killed, fired, hitCount, damageDealt };
  }

  /**
   * M3 S4: tick all active turn-mortar DoT zones for the current turn.
   * Called from CombatLoopService.resolveTurn AFTER fireTurn so zones placed
   * this turn don't double-tick. Damage applies to enemies in zone radius.
   * Zones expire when turnNumber >= expiresOnTurn.
   *
   * @returns Kills produced by zone DoT this turn.
   */
  tickMortarZonesForTurn(scene: THREE.Scene, turnNumber: number): { kills: KillInfo[]; damageDealt: number } {
    const kills: KillInfo[] = [];
    let damageDealt = 0;
    const surviving: TurnMortarZone[] = [];

    for (const zone of this.turnMortarZones) {
      if (turnNumber >= zone.expiresOnTurn) {
        continue; // Zone expired this turn — visual mesh expiry is RAF-driven in CombatVFX
      }

      const candidates = this.spatialGrid.queryRadius(zone.centerX, zone.centerZ, zone.blastRadius);
      for (const enemy of candidates) {
        if (enemy.health <= 0) continue;
        // S1: flying enemies bypass ground effects — mortar zones are ground-level
        if (enemy.isFlying) continue;
        const dx = enemy.position.x - zone.centerX;
        const dz = enemy.position.z - zone.centerZ;
        if (Math.sqrt(dx * dx + dz * dz) <= zone.blastRadius) {
          const result = this.enemyService.damageEnemy(enemy.id, zone.dotDamage);
          damageDealt += zone.dotDamage;
          if (result.killed) {
            kills.push({ id: enemy.id, damage: zone.dotDamage, towerType: TowerType.MORTAR, towerLevel: zone.placerLevel });
          } else {
            this.enemyService.startHitFlash(enemy.id);
            if (zone.statusEffect) {
              this.statusEffectService.apply(enemy.id, zone.statusEffect, turnNumber);
            }
          }
          result.spawnedEnemies.forEach(mini => {
            if (mini.mesh) scene.add(mini.mesh);
          });
        }
      }

      surviving.push(zone);
    }

    this.turnMortarZones = surviving;
    return { kills, damageDealt };
  }

  /**
   * Clears all active mortar DoT zones at wave end so they do not bleed into
   * the next wave. VFX meshes are cleaned up by CombatVFXService.
   * Call from WaveCombatFacadeService.onWaveComplete alongside relicService.resetWaveState().
   */
  clearMortarZonesForWaveEnd(scene: THREE.Scene): void {
    this.turnMortarZones = [];
    this.combatVFXService.clearMortarZoneMeshes(scene);
  }

  /** Removes a tower from combat tracking. Returns the removed PlacedTower (caller uses it to calculate sell refund), or undefined if not found. */
  unregisterTower(key: string): PlacedTower | undefined {
    const tower = this.placedTowers.get(key);
    if (!tower) return undefined;
    this.placedTowers.delete(key);
    return tower;
  }

  // M2 S4: Old physics-loop update() + 4 private helpers DELETED.
  // tickStatusEffects, processTowerFiring, resolveProjectileHits, tickMortarZones
  // were all part of the deltaTime-based loop. fireTurn() + tickMortarZonesForTurn()
  // are the turn-based replacements. ProjectileService dependency is now also dead
  // and the constructor injection is removed below.

  /** Rebuild the spatial grid with all living, non-dying enemies. Used by fireTurn. */
  private rebuildSpatialGrid(): void {
    this.spatialGrid.clear();
    this.enemyService.getEnemies().forEach(enemy => {
      if (enemy.health > 0 && !enemy.dying) {
        this.spatialGrid.insert(enemy);
      }
    });
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
        case TargetingMode.FARTHEST:
          // Farthest by Euclidean distance from tower
          score = dist;
          break;
        case TargetingMode.LAST:
          // Enemy least far along path (lowest distanceTraveled) — just entered
          score = -enemy.distanceTraveled;
          break;
        case TargetingMode.WEAKEST:
          // Enemy with lowest current health (invert so lower hp = higher score)
          score = -enemy.health;
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

  private applySlowAura(tower: PlacedTower, stats: TowerStats, turnNumber: number): void {
    const { x: towerWorldX, z: towerWorldZ } = this.getTowerWorldPos(tower);

    const candidates = this.spatialGrid.queryRadius(towerWorldX, towerWorldZ, stats.range);
    for (const enemy of candidates) {
      if (enemy.health <= 0) continue;

      const dx = enemy.position.x - towerWorldX;
      const dz = enemy.position.z - towerWorldZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Narrow-phase range check
      if (dist > stats.range) continue;

      // StatusEffectService handles immunity (flying), duration refresh, and speed mutation.
      // turnNumber is the StatusEffectService clock in turn-based mode.
      this.statusEffectService.apply(enemy.id, StatusEffectType.SLOW, turnNumber, stats.slowFactor);
    }
  }

  // M2 S5: applyHitDamage + createMortarZone DELETED. Both were part of the
  // dead projectile-flight path. fireTurn handles all hit resolution inline,
  // and turn-based mortar uses turnMortarZones via tickMortarZonesForTurn.

  getTower(key: string): PlacedTower | undefined {
    return this.placedTowers.get(key);
  }

  getPlacedTowers(): Map<string, PlacedTower> {
    return this.placedTowers;
  }

  /** Serialize placed towers for checkpoint save, stripping Three.js mesh data. */
  serializeTowers(): SerializablePlacedTower[] {
    return Array.from(this.placedTowers.values()).map(t => ({
      id: t.id,
      type: t.type,
      level: t.level,
      row: t.row,
      col: t.col,
      kills: t.kills,
      totalInvested: t.totalInvested,
      targetingMode: t.targetingMode,
      ...(t.specialization !== undefined && { specialization: t.specialization }),
      ...(t.placedAtTurn !== undefined && { placedAtTurn: t.placedAtTurn }),
      ...(t.cardStatOverrides !== undefined && { cardStatOverrides: { ...t.cardStatOverrides } }),
    }));
  }

  /** Serialize active mortar zones for checkpoint save. */
  serializeMortarZones(): SerializableMortarZone[] {
    return this.turnMortarZones.map(z => ({
      centerX: z.centerX,
      centerZ: z.centerZ,
      blastRadius: z.blastRadius,
      dotDamage: z.dotDamage,
      expiresOnTurn: z.expiresOnTurn,
      ...(z.statusEffect !== undefined && { statusEffect: z.statusEffect }),
    }));
  }

  /**
   * Restore towers from checkpoint. Meshes must be pre-built externally
   * and provided in the meshes map keyed by tower id (e.g., "2-3").
   */
  restoreTowers(towers: SerializablePlacedTower[], meshes: Map<string, THREE.Group>): void {
    this.placedTowers.clear();
    for (const t of towers) {
      this.placedTowers.set(t.id, {
        ...t,
        mesh: meshes.get(t.id) ?? null,
      });
    }
  }

  /** Restore mortar zones from checkpoint. */
  restoreMortarZones(zones: SerializableMortarZone[]): void {
    // `placerLevel` is optional on SerializableMortarZone — pre-v3 checkpoints
    // predate the field. Default to level 1 so restored zones get safe
    // tier-1 attribution labels instead of NaN-suffixed chips.
    this.turnMortarZones = zones.map(z => ({
      ...z,
      placerLevel: z.placerLevel ?? 1,
    }));
  }

  /** Disposes all Three.js objects (tower meshes), resets status effects, and delegates VFX cleanup. Call from both `restartGame()` and `ngOnDestroy()`. */
  cleanup(scene: THREE.Scene): void {
    // M2 S5: ProjectileService.cleanup call removed — service deleted.

    // Delegate all VFX cleanup to CombatVFXService
    this.combatVFXService.cleanup(scene);
    this.turnMortarZones = []; // M3 S4: clear turn-ticked mortar zones

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
  }
}
