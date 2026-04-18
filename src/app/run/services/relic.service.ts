import { Injectable } from '@angular/core';
import { RelicId, RELIC_DEFINITIONS, RelicRarity, getRelicsByRarity, RelicDefinition } from '../models/relic.model';
import { TowerType } from '../../game/game-board/models/tower.model';
import { RELIC_EFFECT_CONFIG } from '../constants/run.constants';
import { SerializableRelicFlags } from '../../game/game-board/models/encounter-checkpoint.model';
import { CardDefinition } from '../models/card.model';

/** Gold awarded per unique tile crossed when SURVEYOR_COMPASS is active. */
const SURVEYOR_TILE_GOLD = 5;

/**
 * Relic effect engine — pull model.
 *
 * Game services call RelicService.getXxxMultiplier() to query relic effects.
 * All relic logic lives here; game services don't know about individual relics.
 *
 * This is the primary integration point between the Run system and the
 * existing game engine. When cards are added, card effects will be a
 * second consumer alongside this service.
 */

/** Relic stat modifiers returned by the pull API. */
export interface RelicModifiers {
  damageMultiplier: number;
  rangeMultiplier: number;
  towerCostMultiplier: number;
  upgradeCostMultiplier: number;
  sellRefundRate: number;
  goldMultiplier: number;
  enemySpeedMultiplier: number;
  maxLivesBonus: number;
  startingGoldBonus: number;
  splashRadiusMultiplier: number;
  chainBounceBonus: number;
  dotDamageMultiplier: number;
  wavePreviewBonus: number;
}

const BASELINE_MODIFIERS: RelicModifiers = {
  damageMultiplier: 1,
  rangeMultiplier: 1,
  towerCostMultiplier: 1,
  upgradeCostMultiplier: 1,
  sellRefundRate: 0.5,
  goldMultiplier: 1,
  enemySpeedMultiplier: 1,
  maxLivesBonus: 0,
  startingGoldBonus: 0,
  splashRadiusMultiplier: 1,
  chainBounceBonus: 0,
  dotDamageMultiplier: 1,
  wavePreviewBonus: 0,
};

@Injectable({ providedIn: 'root' })
export class RelicService {
  private activeRelicIds: Set<RelicId> = new Set();
  private cachedModifiers: RelicModifiers = { ...BASELINE_MODIFIERS };
  private modifiersDirty = true;

  /** Per-encounter state: whether free tower has been used (ARCHITECTS_BLUEPRINT). */
  private freeTowerUsedThisEncounter = false;

  /** Per-wave state: whether first leak has been blocked (REINFORCED_WALLS). */
  private firstLeakBlockedThisWave = false;

  /**
   * Sprint 36 OROGENY — turn counter tracking elapsed turns since encounter start.
   * OROGENY triggers at every multiple of OROGENY_INTERVAL_TURNS (5).
   * Serialized into SerializableRelicFlags for save/restore.
   */
  private orogenyTurnCounter = 0;

  /**
   * Per-wave state: unique tile keys visited by enemies this wave (SURVEYOR_COMPASS).
   * Not serialized — half-wave gold loss on save is acceptable.
   */
  private surveyorVisitedTiles: Set<string> = new Set();

  // ── Lifecycle ───────────────────────────────────────────

  /** Set the active relic IDs (called when run state changes). */
  setActiveRelics(relicIds: string[]): void {
    this.activeRelicIds.clear();
    for (const id of relicIds) {
      if (id in RELIC_DEFINITIONS) {
        this.activeRelicIds.add(id as RelicId);
      }
    }
    this.modifiersDirty = true;
  }

  /** Clear all relics (run end). */
  clearRelics(): void {
    this.activeRelicIds.clear();
    this.modifiersDirty = true;
    this.cachedModifiers = { ...BASELINE_MODIFIERS };
    this.surveyorVisitedTiles.clear();
  }

  /** Reset per-encounter relic state. */
  resetEncounterState(): void {
    this.freeTowerUsedThisEncounter = false;
    this.orogenyTurnCounter = 0;
  }

  /**
   * Sprint 36 OROGENY — increment the per-encounter turn counter.
   * Returns the new counter value so the caller can check if OROGENY should fire.
   * Call once per turn from CombatLoopService.resolveTurn.
   */
  incrementOrogenyCounter(): number {
    this.orogenyTurnCounter++;
    return this.orogenyTurnCounter;
  }

  /** Returns the current OROGENY turn counter (read-only). */
  getOrogenyTurnCounter(): number {
    return this.orogenyTurnCounter;
  }

  /**
   * Sprint 36 OROGENY — true when OROGENY is active and the counter is a
   * multiple of OROGENY_INTERVAL_TURNS (5). Callers increment via
   * incrementOrogenyCounter() first, then call this to check for a trigger.
   */
  isOrogenyTrigger(counter: number, intervalTurns: number): boolean {
    return this.hasRelic(RelicId.OROGENY) && counter > 0 && counter % intervalTurns === 0;
  }

  /** Returns true when SURVEYOR_ROD is active. */
  hasSurveyorRod(): boolean {
    return this.hasRelic(RelicId.SURVEYOR_ROD);
  }

  /** Reset per-wave relic state. */
  resetWaveState(): void {
    this.firstLeakBlockedThisWave = false;
    this.surveyorVisitedTiles.clear();
  }

  /** Check if a specific relic is active. */
  hasRelic(id: RelicId): boolean {
    return this.activeRelicIds.has(id);
  }

  /** Check if in a run (any relics loaded or not — check run service directly). */
  get relicCount(): number {
    return this.activeRelicIds.size;
  }

  // ── Pull API: Aggregated Modifiers ──────────────────────

  /** Get all aggregated relic modifiers. Cached until relic set changes. */
  getModifiers(): RelicModifiers {
    if (this.modifiersDirty) {
      this.rebuildModifiers();
      this.modifiersDirty = false;
    }
    return this.cachedModifiers;
  }

  /** Get damage multiplier, optionally filtered by tower type. */
  getDamageMultiplier(towerType?: TowerType): number {
    const mods = this.getModifiers();
    let mult = mods.damageMultiplier;

    // Tower-specific relic bonuses
    if (towerType === TowerType.BASIC && this.hasRelic(RelicId.BASIC_TRAINING)) {
      mult *= RELIC_EFFECT_CONFIG.basicTrainingDamageMultiplier;
    }
    return mult;
  }

  /** Get range multiplier, optionally filtered by tower type. */
  getRangeMultiplier(towerType?: TowerType): number {
    const mods = this.getModifiers();
    let mult = mods.rangeMultiplier;

    if (towerType === TowerType.SNIPER && this.hasRelic(RelicId.SNIPER_SCOPE)) {
      mult *= RELIC_EFFECT_CONFIG.sniperScopeRangeMultiplier;
    }
    return mult;
  }

  /** Get tower cost multiplier. */
  getTowerCostMultiplier(): number {
    return this.getModifiers().towerCostMultiplier;
  }

  /** Get upgrade cost multiplier. */
  getUpgradeCostMultiplier(): number {
    return this.getModifiers().upgradeCostMultiplier;
  }

  /** Get sell refund rate (default 0.5 → 0.75 with SALVAGE_KIT). */
  getSellRefundRate(): number {
    return this.getModifiers().sellRefundRate;
  }

  /** Get gold multiplier for kill rewards. */
  getGoldMultiplier(isElite = false): number {
    let mult = this.getModifiers().goldMultiplier;
    if (isElite && this.hasRelic(RelicId.BOUNTY_HUNTER)) {
      mult *= RELIC_EFFECT_CONFIG.bountyHunterEliteGoldMultiplier;
    }
    return mult;
  }

  /** Get enemy speed multiplier (<1 = slower). */
  getEnemySpeedMultiplier(): number {
    return this.getModifiers().enemySpeedMultiplier;
  }

  /** Get max lives bonus. */
  getMaxLivesBonus(): number {
    return this.getModifiers().maxLivesBonus;
  }

  /** Get starting gold bonus per encounter. */
  getStartingGoldBonus(): number {
    return this.getModifiers().startingGoldBonus;
  }

  /** Get splash radius multiplier for splash towers. */
  getSplashRadiusMultiplier(): number {
    return this.getModifiers().splashRadiusMultiplier;
  }

  /** Get chain bounce bonus for chain towers. */
  getChainBounceBonus(): number {
    return this.getModifiers().chainBounceBonus;
  }

  /** Get DoT damage multiplier (mortar). */
  getDotDamageMultiplier(): number {
    return this.getModifiers().dotDamageMultiplier;
  }

  // ── Turn-based relic accessors ──────────────────────────

  /**
   * QUICK_DRAW: returns true when the relic is owned.
   * TowerCombatService uses this to grant +1 shot on the turn a tower is placed.
   */
  hasQuickDraw(): boolean {
    return this.hasRelic(RelicId.QUICK_DRAW);
  }

  /**
   * TUNING_FORK: returns true when the relic is owned. TowerCombatService
   * uses this inside composeDamageStack to conditionally multiply per-tower
   * damage by `tuningForkNeighborDamageMultiplier` when the tower has at
   * least one non-disrupted 4-dir neighbor. Sprint 52.
   */
  hasTuningFork(): boolean {
    return this.hasRelic(RelicId.TUNING_FORK);
  }

  /**
   * CONSTELLATION: returns true when the relic is owned. CombatLoopService
   * uses this in processKill to multiply gold reward by
   * `constellationClusterGoldMultiplier` when the killing tower is in a
   * cluster of ≥ `constellationMinClusterSize`. Sprint 52.
   */
  hasConstellation(): boolean {
    return this.hasRelic(RelicId.CONSTELLATION);
  }

  /**
   * FROST_NOVA: returns +1 when owned, 0 otherwise.
   * StatusEffectService adds this bonus turns to every SLOW application.
   */
  getSlowDurationBonus(): number {
    return this.hasRelic(RelicId.FROST_NOVA) ? 1 : 0;
  }

  /**
   * TEMPORAL_RIFT: returns 1 when owned, 0 otherwise.
   * WaveService prepends this many empty turns to each wave's turn schedule.
   */
  getTurnDelayPerWave(): number {
    return this.hasRelic(RelicId.TEMPORAL_RIFT) ? 1 : 0;
  }

  // ── Trigger-based Relics ────────────────────────────────

  /**
   * ARCHITECTS_BLUEPRINT: Is the next tower placement free?
   * Called by TowerInteractionService during placement.
   */
  isNextTowerFree(): boolean {
    if (!this.hasRelic(RelicId.ARCHITECTS_BLUEPRINT)) return false;
    return !this.freeTowerUsedThisEncounter;
  }

  /** Mark the free tower as consumed. */
  consumeFreeTower(): void {
    this.freeTowerUsedThisEncounter = true;
  }

  /**
   * REINFORCED_WALLS: Should this leak be blocked?
   * Called by EnemyService when an enemy reaches the exit.
   */
  shouldBlockLeak(): boolean {
    if (!this.hasRelic(RelicId.REINFORCED_WALLS)) return false;
    if (this.firstLeakBlockedThisWave) return false;
    this.firstLeakBlockedThisWave = true;
    return true;
  }

  /**
   * LUCKY_COIN: Roll for bonus gold on kill.
   * Returns the gold multiplier for this specific kill (1.0 or RELIC_EFFECT_CONFIG.luckyCoinGoldMultiplier).
   */
  rollLuckyCoin(): number {
    if (!this.hasRelic(RelicId.LUCKY_COIN)) return 1;
    return Math.random() < RELIC_EFFECT_CONFIG.luckyCoinTriggerChance
      ? RELIC_EFFECT_CONFIG.luckyCoinGoldMultiplier
      : 1;
  }

  // ── Cartographer Relic Methods ──────────────────────────

  /**
   * SURVEYOR_COMPASS: Record that an enemy stepped on a tile.
   * No-op when relic is not active — cheap bail-out for the hot path.
   */
  recordTileVisited(row: number, col: number): void {
    if (!this.hasRelic(RelicId.SURVEYOR_COMPASS)) return;
    this.surveyorVisitedTiles.add(`${row}-${col}`);
  }

  /**
   * SURVEYOR_COMPASS: Consume the visited-tile count and return gold earned.
   * Clears the set. Returns 0 when relic is not active.
   * Name is "consume" — callers must not call this more than once per wave.
   */
  consumeSurveyorGold(): number {
    if (!this.hasRelic(RelicId.SURVEYOR_COMPASS)) return 0;
    const gold = this.surveyorVisitedTiles.size * SURVEYOR_TILE_GOLD;
    this.surveyorVisitedTiles.clear();
    return gold;
  }

  /**
   * WORLD_SPIRIT: Returns -1 when relic is active and the card is
   * cartographer-archetype; 0 otherwise. Callers must apply Math.max(0, ...).
   */
  getCardEnergyCostModifier(def: CardDefinition): number {
    if (!this.hasRelic(RelicId.WORLD_SPIRIT)) return 0;
    return def.archetype === 'cartographer' ? -1 : 0;
  }

  // ── Checkpoint Serialization ────────────────────────────

  /** Serialize per-encounter relic flags for checkpoint save. */
  serializeEncounterFlags(): SerializableRelicFlags {
    return {
      firstLeakBlockedThisWave: this.firstLeakBlockedThisWave,
      freeTowerUsedThisEncounter: this.freeTowerUsedThisEncounter,
      orogenyTurnCounter: this.orogenyTurnCounter,
    };
  }

  /** Restore per-encounter relic flags from checkpoint. */
  restoreEncounterFlags(flags: SerializableRelicFlags): void {
    this.firstLeakBlockedThisWave = flags.firstLeakBlockedThisWave;
    this.freeTowerUsedThisEncounter = flags.freeTowerUsedThisEncounter;
    // Sprint 36 OROGENY — restore the turn counter so saves at turn 7 resume
    // with the counter at 7, firing the next OROGENY at turn 10.
    this.orogenyTurnCounter = flags.orogenyTurnCounter ?? 0;
  }

  // ── Relic Pool Management ───────────────────────────────

  /** Get relics not yet owned, filtered by rarity. For reward/shop generation. */
  getAvailableRelics(rarity?: RelicRarity): RelicDefinition[] {
    const pool = rarity ? getRelicsByRarity(rarity) : Object.values(RELIC_DEFINITIONS);
    return pool.filter(r => !this.activeRelicIds.has(r.id));
  }

  // ── Internal ────────────────────────────────────────────

  private rebuildModifiers(): void {
    const mods: RelicModifiers = { ...BASELINE_MODIFIERS };

    for (const id of this.activeRelicIds) {
      switch (id) {
        // Common
        case RelicId.IRON_HEART:
          mods.maxLivesBonus += RELIC_EFFECT_CONFIG.ironHeartMaxLivesBonus;
          break;
        case RelicId.GOLD_MAGNET:
          mods.goldMultiplier *= 1.15;
          break;
        case RelicId.STURDY_BOOTS:
          mods.enemySpeedMultiplier *= 0.92;
          break;
        case RelicId.QUICK_DRAW:
          // Handled by hasQuickDraw() — TowerCombatService grants +1 shot on the placement turn.
          break;
        case RelicId.SALVAGE_KIT:
          mods.sellRefundRate = 0.75;
          break;
        case RelicId.SCOUTING_LENS:
          mods.wavePreviewBonus += 2;
          break;
        case RelicId.FIELD_RATIONS:
          mods.startingGoldBonus += 30;
          break;
        // REINFORCED_WALLS — trigger-based, handled in shouldBlockLeak()
        // LUCKY_COIN — trigger-based, handled in rollLuckyCoin()
        case RelicId.APPRENTICE_MANUAL:
          mods.upgradeCostMultiplier *= 0.85;
          break;

        // Uncommon
        case RelicId.CHAIN_REACTION:
          mods.chainBounceBonus += 1;
          break;
        case RelicId.FROST_NOVA:
          // Handled by getSlowDurationBonus() — StatusEffectService adds +1 turn to SLOW duration.
          break;
        case RelicId.MORTAR_SHELL:
          mods.dotDamageMultiplier *= 2;
          break;
        // SNIPER_SCOPE — handled in getRangeMultiplier()
        // BASIC_TRAINING — handled in getDamageMultiplier()
        case RelicId.SPLASH_ZONE:
          mods.splashRadiusMultiplier *= 1.3;
          break;
        // BOUNTY_HUNTER — handled in getGoldMultiplier()

        // Uncommon (archetype)
        // SURVEYOR_COMPASS — trigger-based, handled by recordTileVisited() / consumeSurveyorGold()

        // Rare
        // ARCHITECTS_BLUEPRINT — trigger-based
        case RelicId.TEMPORAL_RIFT:
          // Handled by getTurnDelayPerWave() — WaveService prepends 1 empty turn to each wave schedule.
          break;
        case RelicId.COMMANDERS_BANNER:
          mods.damageMultiplier *= 1.15;
          mods.rangeMultiplier *= 1.15;
          break;
        // WORLD_SPIRIT — trigger-based, handled by getCardEnergyCostModifier()

        // Highground uncommon
        // SURVEYOR_ROD — encounter-start hook, handled in game-board.component.ts initFreshEncounter
        // Highground rare
        // OROGENY — per-turn hook, handled in CombatLoopService.resolveTurn
      }
    }

    this.cachedModifiers = mods;
  }
}
