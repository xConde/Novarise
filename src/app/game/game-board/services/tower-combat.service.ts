import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';
import { Enemy, ENEMY_STATS } from '../models/enemy.model';
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
import { RunService } from '../../../run/services/run.service';
import { MODIFIER_STAT } from '../../../run/constants/modifier-stat.constants';
import { TowerStatOverrides } from '../../../run/models/card.model';
import { PathfindingService } from './pathfinding.service';
import { SerializablePlacedTower, SerializableMortarZone } from '../models/encounter-checkpoint.model';
import { LineOfSightService } from './line-of-sight.service';
import { ElevationService } from './elevation.service';
import { TowerGraphService } from './tower-graph.service';
import { ELEVATION_CONFIG } from '../constants/elevation.constants';
import { CONDUIT_CONFIG } from '../constants/conduit.constants';
import { RELIC_EFFECT_CONFIG } from '../../../run/constants/run.constants';

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

/**
 * Per-fireTurn context bundle for {@link TowerCombatService.composeDamageStack}.
 * Hoists constants computed ONCE per fireTurn and read per-tower. Bundled to
 * avoid a 12+-arg method signature.
 *
 * To add a new multiplier: extend this bundle AND composeDamageStack in the
 * same commit — splitting the change across files hides ordering bugs.
 */
export interface DamageStackContext {
  readonly towerDamageMultiplier: number;
  readonly cardDamageBoost: number;
  readonly cardRangeBoost: number;
  /** SNIPER_DAMAGE — applied only when tower.type === SNIPER. */
  readonly sniperDamageBoost: number;
  /** LABYRINTH_MIND path-length scaling. 1 when inactive. */
  readonly pathLengthMultiplier: number;
  /** Short-circuit flag: false on flat boards → skip elevation lookup. */
  readonly hasElevation: boolean;
  /** Board-wide max elevation, read once per fireTurn for KOTH check. */
  readonly maxElevation: number;
  readonly highPerchBonus: number;
  readonly vantagePointBonus: number;
  readonly kothBonus: number;
  /** Gate for KOTH: true when kothBonus > 0 AND maxElevation ≥ 1. */
  readonly kothActive: boolean;
  readonly handshakeBonus: number;
  /** Additive-to-base range for FORMATION — folds INSIDE (base + additive) per §13. */
  readonly formationRangeAdditive: number;
  readonly gridSurgeBonus: number;
  /**
   * ARCHITECT flag. When true, HANDSHAKE/GRID_SURGE substitute `clusterSize - 1`
   * for their literal 4-dir neighbor count. Encounter-scoped.
   */
  readonly architectClusterActive: boolean;
  /** Turn number — used only by graph reads that honor disruption / virtual-edge expiry. */
  readonly currentTurn: number;
}

/**
 * Output of {@link TowerCombatService.composeDamageStack}. `damage` and `range`
 * write into scratchStats. `towerVantagePointDmgMult` / `towerKothMult` are the
 * elevation-origin multipliers hoisted for TITAN/WYRM per-target adjustment —
 * any future elevation-origin multiplier MUST join this pair or TITAN's halve
 * formula will silently exclude it.
 */
interface DamageStackResult {
  readonly damage: number;
  readonly range: number;
  readonly towerVantagePointDmgMult: number;
  readonly towerKothMult: number;
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
    // @Optional() — not provided in every TowerCombatService test bed.
    // Sprint 18 LABYRINTH_MIND degrades gracefully to pathLengthMultiplier=1
    // when the pathfinding service is absent. Full GameModule always wires it.
    @Optional() private pathfindingService?: PathfindingService,
    // @Optional() — not provided in TowerCombatService test beds that predate
    // sprint 26. When absent, LOS check is skipped (all shots pass). Full
    // GameModule always wires it.
    @Optional() private lineOfSightService?: LineOfSightService,
    // @Optional() — not provided in TowerCombatService test beds that predate
    // sprint 29. When absent, all elevation reads return 0 (flat-board behavior,
    // no regression on non-Highground runs). Full GameModule always wires it.
    @Optional() private elevationService?: ElevationService,
    // @Optional() — absent in pre-Conduit test beds. Register/unregister
    // become no-ops w.r.t. graph state; Conduit card tests wire the service.
    @Optional() private towerGraphService?: TowerGraphService,
    // @Optional() — HARMONIC needs seeded RNG for passenger selection.
    // Absent → no passenger fires; test beds without a live run stay unchanged.
    @Optional() private runService?: RunService,
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
    const tower: PlacedTower = {
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
    };
    this.placedTowers.set(key, tower);
    // Mirror into adjacency graph AFTER placedTowers.set so the graph's
    // neighbor scan sees the tower in the source-of-truth map.
    this.towerGraphService?.registerTower(tower);
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

    // Sprint 18 LABYRINTH_MIND — when active, tower damage scales with the
    // live spawner→exit path length. `getModifierValue` sums any stacked
    // instances (though in practice a single card defines the scaling rate).
    // Path length is cached by PathfindingService so this is O(1) after the
    // first tower in the turn. Mutation of the board invalidates the cache
    // naturally, so LABYRINTH_MIND picks up player-built tiles immediately.
    const labyrinthScaling = this.cardEffectService.getModifierValue(MODIFIER_STAT.LABYRINTH_MIND);
    const pathLengthMultiplier = (labyrinthScaling > 0 && this.pathfindingService)
      ? 1 + (this.pathfindingService.getPathToExitLength() * labyrinthScaling)
      : 1;

    // Sprint 29 elevation range hook — passive per-tower elevation bonus.
    // hasElevation guards the per-tower elevation lookup so flat boards (no
    // Highground cards played yet) pay zero cost: getMaxElevation() is a single
    // board scan, O(rows×cols), done once per fireTurn call.
    const maxElevation = this.elevationService != null ? this.elevationService.getMaxElevation() : 0;
    const hasElevation = maxElevation !== 0;

    // Sprint 29 HIGH_PERCH — wave-scoped range bonus for elevated towers.
    // highPerchBonus is summed across all stacked copies via getModifierValue.
    const highPerchBonus = this.cardEffectService.getModifierValue(MODIFIER_STAT.HIGH_PERCH_RANGE_BONUS);

    // Sprint 31 VANTAGE_POINT — wave-scoped damage bonus for elevated towers
    // (elevation ≥ VANTAGE_POINT_ELEVATION_THRESHOLD = 1). Additive across
    // stacked copies via getModifierValue; applied multiplicatively per-tower.
    const vantagePointBonus = this.cardEffectService.getModifierValue(MODIFIER_STAT.VANTAGE_POINT_DAMAGE_BONUS);

    // Sprint 33 KING_OF_THE_HILL — encounter-scoped damage bonus for the
    // tower(s) at the HIGHEST elevation on the board. Only activates when
    // maxElevation ≥ 1 — flat boards (all towers at elevation 0) get no bonus.
    // Ties: ALL towers tied at max elevation receive the bonus (anti-flapping).
    const kothBonus = this.cardEffectService.getModifierValue(MODIFIER_STAT.KING_OF_THE_HILL_DAMAGE_BONUS);
    const kothActive = kothBonus > 0 && maxElevation >= 1;

    const handshakeBonus = this.cardEffectService.getModifierValue(MODIFIER_STAT.HANDSHAKE_DAMAGE_BONUS);
    const formationRangeAdditive = this.cardEffectService.getModifierValue(MODIFIER_STAT.FORMATION_RANGE_ADDITIVE);
    const gridSurgeBonus = this.cardEffectService.getModifierValue(MODIFIER_STAT.GRID_SURGE_DAMAGE_BONUS);
    // ARCHITECT swaps the neighbor-count source from `getNeighbors` to
    // `clusterSize - 1` for HANDSHAKE/GRID_SURGE (non-obvious semantic).
    const architectClusterActive = this.cardEffectService.hasActiveModifier(MODIFIER_STAT.ARCHITECT_CLUSTER_PROPAGATION);
    const linkworkActive = this.cardEffectService.hasActiveModifier(MODIFIER_STAT.LINKWORK_FIRE_RATE_SHARE);
    const harmonicActive = this.cardEffectService.hasActiveModifier(MODIFIER_STAT.HARMONIC_SIMULTANEOUS_FIRE);
    // HIVE_MIND requires a two-pass walk — see preComposedStats prepass below.
    const hiveMindActive = this.cardEffectService.hasActiveModifier(MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX);

    const hasCardModifiers =
      cardDamageBoost !== 0 || cardRangeBoost !== 0 || sniperDamageBoost !== 0
      || pathLengthMultiplier !== 1 || hasElevation || highPerchBonus !== 0
      || vantagePointBonus !== 0 || kothActive
      || handshakeBonus !== 0 || formationRangeAdditive !== 0
      || gridSurgeBonus !== 0 || architectClusterActive
      || hiveMindActive;

    // Damage + range multiplier composition bundle — built once per fireTurn,
    // consumed per-tower inside composeDamageStack. See conduit-adjacency-graph.md §12.
    const damageStackCtx: DamageStackContext = {
      towerDamageMultiplier,
      cardDamageBoost,
      cardRangeBoost,
      sniperDamageBoost,
      pathLengthMultiplier,
      hasElevation,
      maxElevation,
      highPerchBonus,
      vantagePointBonus,
      kothBonus,
      kothActive,
      handshakeBonus,
      formationRangeAdditive,
      gridSurgeBonus,
      architectClusterActive,
      currentTurn: turnNumber,
    };

    // Deterministic firing order: row then col.
    const towerList = Array.from(this.placedTowers.values()).sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    // HIVE_MIND prepass: compose the full damage stack for every tower up-front
    // so the per-tower fire loop can swap in the cluster-max damage/range.
    // Skipped when inactive so pre-Conduit runs pay zero extra compose cost.
    let preComposedStats: Map<string, DamageStackResult> | null = null;
    if (hiveMindActive && this.towerGraphService) {
      preComposedStats = new Map();
      for (const t of towerList) {
        const tBase = getEffectiveStats(t.type, t.level, t.specialization);
        preComposedStats.set(t.id, this.composeDamageStack(t, tBase, damageStackCtx));
      }
    }

    for (const tower of towerList) {
      const baseStats = getEffectiveStats(tower.type, tower.level, tower.specialization);
      let stats: TowerStats;
      const hasCardStatOverrides = tower.cardStatOverrides !== undefined;
      // Elevation multipliers (TITAN/WYRM) must be available at the shot-fire
      // site. Declared at tower-loop scope; default 1 = no bonus.
      let towerVantagePointDmgMult = 1;
      let towerKothMult = 1;
      if (towerDamageMultiplier !== 1 || hasRelicModifiers || hasCardModifiers || hasCardStatOverrides) {
        const stack = preComposedStats?.get(tower.id)
          ?? this.composeDamageStack(tower, baseStats, damageStackCtx);

        // HIVE_MIND cluster-max: a disrupted tower reads its cluster as
        // itself only, so max-of-cluster collapses to self.
        let effectiveDamage = stack.damage;
        let effectiveRange = stack.range;
        if (hiveMindActive && this.towerGraphService && preComposedStats !== null) {
          const clusterIds = this.towerGraphService.getClusterTowers(tower.row, tower.col, turnNumber);
          for (const id of clusterIds) {
            const cached = preComposedStats.get(id);
            if (!cached) continue;
            if (cached.damage > effectiveDamage) effectiveDamage = cached.damage;
            if (cached.range > effectiveRange) effectiveRange = cached.range;
          }
        }

        this.scratchStats.damage = effectiveDamage;
        this.scratchStats.range = effectiveRange;
        // Hoist elevation-origin multipliers for TITAN/WYRM per-target adjustment.
        towerVantagePointDmgMult = stack.towerVantagePointDmgMult;
        towerKothMult = stack.towerKothMult;
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

      // fireRate boost uses ceil semantic: any positive value adds +1 shot.
      // LINKWORK's bonus folds INTO the ceil so it stacks linearly with
      // FIRE_RATE card modifiers (boost additive, then ceil).
      let perTowerFireRateBoost = fireRateBoost;
      if (linkworkActive && this.towerGraphService) {
        const clusterSize = this.towerGraphService.getClusterSize(tower.row, tower.col, turnNumber);
        if (clusterSize >= CONDUIT_CONFIG.LINKWORK_MIN_CLUSTER_SIZE) {
          perTowerFireRateBoost += CONDUIT_CONFIG.LINKWORK_FIRE_RATE_BONUS;
        }
      }
      const baseShots = Math.max(1, Math.ceil(1 + perTowerFireRateBoost));
      // QUICK_DRAW relic: +1 extra shot on the turn the tower was placed.
      const quickDrawBonus = this.relicService.hasQuickDraw() && (tower.placedAtTurn ?? 0) === turnNumber ? 1 : 0;
      const shotsPerTurn = baseShots + quickDrawBonus;

      let lastTarget: Enemy | null = null;
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
        lastTarget = target;

        const shotResult = this.fireShotAtTarget(
          tower, target, stats, scene, turnNumber,
          chainBouncesBonus, towerVantagePointDmgMult, towerKothMult,
        );
        killed.push(...shotResult.killed);
        hitCount += shotResult.hitCount;
        damageDealt += shotResult.damageDealt;
      }

      // HARMONIC propagation — non-recursive: a passenger's shot never
      // triggers its own HARMONIC burst. SLOW towers are skipped as
      // passengers (no target-based firing semantic).
      if (harmonicActive && lastTarget !== null && this.towerGraphService && tower.type !== TowerType.SLOW) {
        const passengers = this.pickHarmonicPassengers(tower, turnNumber);
        for (const passenger of passengers) {
          if (passenger.type === TowerType.SLOW) continue;
          const passengerBaseStats = getEffectiveStats(passenger.type, passenger.level, passenger.specialization);
          const passengerStackResult = preComposedStats?.get(passenger.id)
            ?? this.composeDamageStack(passenger, passengerBaseStats, damageStackCtx);
          // HIVE_MIND cluster-max also applies to HARMONIC passenger shots.
          let passengerDamage = passengerStackResult.damage;
          let passengerRange = passengerStackResult.range;
          if (hiveMindActive && this.towerGraphService && preComposedStats !== null) {
            const passengerClusterIds = this.towerGraphService.getClusterTowers(passenger.row, passenger.col, turnNumber);
            for (const id of passengerClusterIds) {
              const cached = preComposedStats.get(id);
              if (!cached) continue;
              if (cached.damage > passengerDamage) passengerDamage = cached.damage;
              if (cached.range > passengerRange) passengerRange = cached.range;
            }
          }
          const passengerStats: TowerStats = {
            ...passengerBaseStats,
            damage: passengerDamage,
            range: passengerRange,
          };
          if (!this.isTargetInRange(passenger, lastTarget, passengerStats)) continue;
          if (lastTarget.health <= 0) continue;
          this.towerAnimationService.startMuzzleFlash(passenger);
          fired.push(passenger.type);
          const passengerResult = this.fireShotAtTarget(
            passenger, lastTarget, passengerStats, scene, turnNumber,
            chainBouncesBonus,
            passengerStackResult.towerVantagePointDmgMult,
            passengerStackResult.towerKothMult,
          );
          killed.push(...passengerResult.killed);
          hitCount += passengerResult.hitCount;
          damageDealt += passengerResult.damageDealt;
        }
      }
    }

    return { killed, fired, hitCount, damageDealt };
  }

  /**
   * Fire one shot from `tower` at `target` using the caller-supplied composed
   * `stats`. Handles CHAIN / MORTAR / single-target / splash branching. Does
   * NOT handle SLOW (aura, not target-based) or muzzle-flash / fired bookkeeping —
   * those are owned by the caller (the fireTurn loop). Extracted so HARMONIC
   * passengers reuse the full shot pipeline without duplicating branching.
   */
  private fireShotAtTarget(
    tower: PlacedTower,
    target: Enemy,
    stats: TowerStats,
    scene: THREE.Scene,
    turnNumber: number,
    chainBouncesBonus: number,
    towerVantagePointDmgMult: number,
    towerKothMult: number,
  ): { killed: KillInfo[]; hitCount: number; damageDealt: number } {
    const killed: KillInfo[] = [];
    let hitCount = 0;
    let damageDealt = 0;

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
            killed.push({ id: enemy.id, damage: blastDamage, towerType: tower.type, towerLevel: tower.level, towerRow: tower.row, towerCol: tower.col });
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
              killed.push({ id: enemy.id, damage: stats.damage, towerType: tower.type, towerLevel: tower.level, towerRow: tower.row, towerCol: tower.col });
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
        // Sprint 38/39 elevation-immunity per-target adjustment.
        // WYRM_ASCENDANT: strip all elevation bonus damage → base-without-elevation.
        // TITAN: halve the elevation bonus portion only.
        // Chain/status/mortar damage bypasses both checks (only single-target fire applies).
        const targetStats = ENEMY_STATS[target.type];
        const finalDamage = (targetStats?.immuneToElevationDamageBonuses)
          ? this.computeWyrmDamage(stats.damage, towerVantagePointDmgMult, towerKothMult)
          : (targetStats?.halvesElevationDamageBonuses)
          ? this.computeTitanDamage(stats.damage, towerVantagePointDmgMult, towerKothMult)
          : stats.damage;
        const result = this.enemyService.damageEnemy(target.id, finalDamage);
        hitCount++;
        damageDealt += finalDamage;
        if (result.killed) {
          killed.push({ id: target.id, damage: finalDamage, towerType: tower.type, towerLevel: tower.level, towerRow: tower.row, towerCol: tower.col });
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

    return { killed, hitCount, damageDealt };
  }

  /**
   * HARMONIC passenger selection — returns up to HARMONIC_NEIGHBOR_COUNT
   * non-disrupted cluster members of `tower` (excluding `tower` itself),
   * chosen via the seeded run-level RNG so replay determinism is preserved.
   *
   * When the cluster has fewer non-disrupted neighbors than the target
   * count, returns all eligible members. Disrupted towers are filtered via
   * `getClusterTowers(currentTurn)` which treats disrupted entries as
   * single-tower clusters. Propagation is non-recursive — the caller guards
   * against passenger-of-passenger recursion; this helper only selects.
   */
  private pickHarmonicPassengers(tower: PlacedTower, currentTurn: number): PlacedTower[] {
    if (!this.towerGraphService || !this.runService) return [];
    const clusterIds = this.towerGraphService.getClusterTowers(tower.row, tower.col, currentTurn);
    const candidateIds = clusterIds.filter(id => id !== tower.id);
    if (candidateIds.length === 0) return [];

    const n = CONDUIT_CONFIG.HARMONIC_NEIGHBOR_COUNT;
    const pickCount = Math.min(n, candidateIds.length);

    // Fisher–Yates partial shuffle using seeded RNG — pick first `pickCount`
    // after the shuffle. RunService.nextRandom keeps replay determinism.
    const shuffled = [...candidateIds];
    for (let i = 0; i < pickCount; i++) {
      const j = i + Math.floor(this.runService.nextRandom() * (shuffled.length - i));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selected = shuffled.slice(0, pickCount);

    const passengers: PlacedTower[] = [];
    for (const id of selected) {
      const t = this.placedTowers.get(id);
      if (t !== undefined) passengers.push(t);
    }
    return passengers;
  }

  /**
   * True iff `target` is within `tower`'s composed `stats.range` (world-space
   * Euclidean). Mirrors the distance test inside findTarget's candidate loop.
   * Used by HARMONIC propagation to range-gate passenger shots without
   * re-selecting a target.
   */
  private isTargetInRange(tower: PlacedTower, target: Enemy, stats: TowerStats): boolean {
    const { x: towerWorldX, z: towerWorldZ } = this.getTowerWorldPos(tower);
    const dx = target.position.x - towerWorldX;
    const dz = target.position.z - towerWorldZ;
    return (dx * dx + dz * dz) <= (stats.range * stats.range);
  }

  /**
   * Single source of truth for per-tower damage + range multiplier composition.
   *
   * Ordering rule (conduit-adjacency-graph.md §13): additive-to-base bonuses
   * (e.g. FORMATION +range) go INSIDE `(base + additive)`; multiplicative
   * bonuses chain outside. Never invert — player mental model is "my tower's
   * range is 4" for additive stacks.
   *
   * Returns `towerVantagePointDmgMult` and `towerKothMult` hoisted for the
   * shot-fire site (the current "elevation-origin" damage multipliers). Any
   * future elevation-origin multiplier must also be hoisted or TITAN's halve
   * formula will silently exclude it.
   *
   * Perf: called per-tower per-fireTurn. All internal reads are O(1) except
   * `relicService.get*Multiplier(type)` (Map lookup). Avoid new allocations
   * (arrays, spreads) without re-profiling.
   */
  /**
   * Effective neighbor count for HANDSHAKE / GRID_SURGE gates. Returns 0
   * when the gate is inactive or the graph service is absent — short-
   * circuits the graph query so pre-Conduit runs pay zero cost. When
   * ARCHITECT is active, reads `clusterSize - 1` so the gate is cluster-
   * wide; disruption shrinks the cluster transparently.
   */
  private getEffectiveNeighborCount(
    tower: PlacedTower,
    ctx: DamageStackContext,
    gateActive: boolean,
  ): number {
    if (!gateActive || this.towerGraphService === undefined) return 0;
    if (ctx.architectClusterActive) {
      return Math.max(0, this.towerGraphService.getClusterTowers(tower.row, tower.col, ctx.currentTurn).length - 1);
    }
    return this.towerGraphService.getNeighbors(tower.row, tower.col, ctx.currentTurn).length;
  }

  private composeDamageStack(
    tower: PlacedTower,
    baseStats: TowerStats,
    ctx: DamageStackContext,
  ): DamageStackResult {
    const relicDamage = this.relicService.getDamageMultiplier(tower.type);
    const relicRange = this.relicService.getRangeMultiplier(tower.type);
    const sniperBoost = (tower.type === TowerType.SNIPER && ctx.sniperDamageBoost !== 0)
      ? (1 + ctx.sniperDamageBoost)
      : 1;
    const cardDamageMult = tower.cardStatOverrides?.damageMultiplier ?? 1;
    const cardRangeMult = tower.cardStatOverrides?.rangeMultiplier ?? 1;

    // Passive elevation range bonus: elevation 0 → 1.0×; elevation 2 → 1.5×;
    // elevation -1 → 0.75× (penalty for placing on depressed tiles).
    const towerElevation = ctx.hasElevation
      ? this.elevationService!.getElevation(tower.row, tower.col)
      : 0;
    const elevationRangeMult = 1 + towerElevation * ELEVATION_CONFIG.RANGE_BONUS_PER_ELEVATION;

    // HIGH_PERCH: conditional range bonus on elevation ≥ threshold (2).
    const highPerchActive = ctx.highPerchBonus > 0
      && towerElevation >= ELEVATION_CONFIG.HIGH_PERCH_ELEVATION_THRESHOLD;
    const highPerchMult = highPerchActive ? (1 + ctx.highPerchBonus) : 1;

    // VANTAGE_POINT: conditional damage bonus on elevation ≥ threshold (1).
    const vantagePointActive = ctx.vantagePointBonus > 0
      && towerElevation >= ELEVATION_CONFIG.VANTAGE_POINT_ELEVATION_THRESHOLD;
    const vantagePointDmgMult = vantagePointActive ? (1 + ctx.vantagePointBonus) : 1;

    // KING_OF_THE_HILL: applies only to towers at the board-wide max elevation.
    const kothMult = (ctx.kothActive && towerElevation === ctx.maxElevation)
      ? (1 + ctx.kothBonus)
      : 1;

    // HANDSHAKE: ≥ 1 non-disrupted neighbor. ARCHITECT swaps the neighbor
    // read to cluster-wide (`clusterSize - 1`); disruption shrinks the cluster
    // so the swap stays transparent.
    const handshakeCount = this.getEffectiveNeighborCount(tower, ctx, ctx.handshakeBonus > 0);
    const handshakeMult = handshakeCount > 0 ? (1 + ctx.handshakeBonus) : 1;

    // FORMATION: additive-to-base range, folds INSIDE `(base + additive)` per §13.
    const formationActive = ctx.formationRangeAdditive > 0
      && this.towerGraphService !== undefined
      && this.towerGraphService.isInStraightLineOf(tower.row, tower.col, CONDUIT_CONFIG.FORMATION_MIN_LINE_LENGTH, ctx.currentTurn);
    const rangeAdditive = formationActive ? ctx.formationRangeAdditive : 0;

    // GRID_SURGE: ≥ 4 effective neighbors. ARCHITECT swap same as HANDSHAKE.
    const gridSurgeCount = this.getEffectiveNeighborCount(tower, ctx, ctx.gridSurgeBonus > 0);
    const gridSurgeMult = gridSurgeCount >= CONDUIT_CONFIG.GRID_SURGE_MIN_NEIGHBORS
      ? (1 + ctx.gridSurgeBonus)
      : 1;

    // TUNING_FORK relic: ≥ 1 non-disrupted neighbor. Applies every turn the
    // relic is owned; no duration countdown.
    const tuningForkActive = this.relicService.hasTuningFork()
      && this.towerGraphService !== undefined
      && this.towerGraphService.getNeighbors(tower.row, tower.col, ctx.currentTurn).length > 0;
    const tuningForkMult = tuningForkActive
      ? RELIC_EFFECT_CONFIG.tuningForkNeighborDamageMultiplier
      : 1;

    const damage = Math.round(
      baseStats.damage
        * ctx.towerDamageMultiplier
        * relicDamage
        * (1 + ctx.cardDamageBoost)
        * sniperBoost
        * cardDamageMult
        * ctx.pathLengthMultiplier
        * vantagePointDmgMult
        * kothMult
        * handshakeMult
        * gridSurgeMult
        * tuningForkMult,
    );

    const range = (baseStats.range + rangeAdditive)
      * relicRange
      * (1 + ctx.cardRangeBoost)
      * cardRangeMult
      * elevationRangeMult
      * highPerchMult;

    return {
      damage,
      range,
      towerVantagePointDmgMult: vantagePointDmgMult,
      towerKothMult: kothMult,
    };
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
    // Mirror into adjacency graph AFTER placedTowers.delete so neighbor-set
    // mutation reads the fresh state.
    this.towerGraphService?.unregisterTower(key);
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

    // Sprint 26: MORTAR bypasses LOS — it is an AOE arc weapon that lobs shells
    // over terrain. Per elevation-model.md §12: "MORTAR already uses AOE, does
    // not need direct LOS; document that MORTAR bypasses isVisible."
    // Note: @Optional() injects null (not undefined) when the service is absent.
    const useLos = this.lineOfSightService != null && tower.type !== TowerType.MORTAR;

    const candidates = this.spatialGrid.queryRadius(towerWorldX, towerWorldZ, stats.range);
    for (const enemy of candidates) {
      if (enemy.health <= 0) continue;

      const dx = enemy.position.x - towerWorldX;
      const dz = enemy.position.z - towerWorldZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Narrow-phase range check in world units
      if (dist > stats.range) continue;

      // Sprint 26: LOS narrow-phase filter.
      // Runs after the distance check, before target scoring, so only in-range
      // enemies pay the raycast cost. Skipped for MORTAR (AOE arc weapon).
      // useLos guards the null check — safe cast
      if (useLos && !this.lineOfSightService!.isVisible(tower.row, tower.col, enemy.position.x, enemy.position.z)) {
        continue;
      }

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

  /**
   * Sprint 38 TITAN — compute final damage against a TITAN target.
   *
   * stats.damage already includes VANTAGE_POINT and KOTH multipliers baked in.
   * To halve only the elevation-bonus portion:
   *   baseWithoutElevation = stats.damage / (vantagePointDmgMult × kothMult)
   *   elevationPortion = stats.damage - baseWithoutElevation
   *   finalDamage = baseWithoutElevation + elevationPortion × TITAN_ELEVATION_DAMAGE_REDUCTION
   *
   * When neither elevation multiplier is active (both default to 1), this
   * returns stats.damage unmodified — safe no-op for non-elevated towers.
   */
  private computeTitanDamage(
    baseDamage: number,
    vantagePointDmgMult: number,
    kothMult: number,
  ): number {
    const combinedElevMult = vantagePointDmgMult * kothMult;
    if (combinedElevMult === 1) return baseDamage; // fast path — no elevation bonus active
    const baseWithoutElevation = baseDamage / combinedElevMult;
    const elevationPortion = baseDamage - baseWithoutElevation;
    return Math.round(baseWithoutElevation + elevationPortion * ELEVATION_CONFIG.TITAN_ELEVATION_DAMAGE_REDUCTION);
  }

  /**
   * Sprint 39 WYRM_ASCENDANT — strip the elevation-bonus portion entirely.
   * Returns `baseDamage / combinedElevMult`, i.e. what the tower would deal on
   * a flat board with no elevation bonuses active. Range bonuses are NOT affected
   * (tower fires from its elevated position with full range; only damage is stripped).
   *
   * Fast path: when no elevation bonuses are active (combinedElevMult === 1),
   * the result is stats.damage unchanged — identical to a regular target.
   */
  private computeWyrmDamage(
    baseDamage: number,
    vantagePointDmgMult: number,
    kothMult: number,
  ): number {
    const combinedElevMult = vantagePointDmgMult * kothMult;
    if (combinedElevMult === 1) return baseDamage; // fast path — no elevation bonus active
    return Math.round(baseDamage / combinedElevMult);
  }

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
