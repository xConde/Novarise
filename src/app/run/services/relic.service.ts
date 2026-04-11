import { Injectable } from '@angular/core';
import { RelicId, RELIC_DEFINITIONS, RelicRarity, getRelicsByRarity, RelicDefinition } from '../models/relic.model';
import { TowerType } from '../../game/game-board/models/tower.model';
import { RELIC_EFFECT_CONFIG } from '../constants/run.constants';

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
  fireRateMultiplier: number;
  rangeMultiplier: number;
  towerCostMultiplier: number;
  upgradeCostMultiplier: number;
  sellRefundRate: number;
  goldMultiplier: number;
  enemySpeedMultiplier: number;
  spawnIntervalMultiplier: number;
  maxLivesBonus: number;
  startingGoldBonus: number;
  splashRadiusMultiplier: number;
  chainBounceBonus: number;
  slowDurationMultiplier: number;
  dotDamageMultiplier: number;
  wavePreviewBonus: number;
}

const BASELINE_MODIFIERS: RelicModifiers = {
  damageMultiplier: 1,
  fireRateMultiplier: 1,
  rangeMultiplier: 1,
  towerCostMultiplier: 1,
  upgradeCostMultiplier: 1,
  sellRefundRate: 0.5,
  goldMultiplier: 1,
  enemySpeedMultiplier: 1,
  spawnIntervalMultiplier: 1,
  maxLivesBonus: 0,
  startingGoldBonus: 0,
  splashRadiusMultiplier: 1,
  chainBounceBonus: 0,
  slowDurationMultiplier: 1,
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
  }

  /** Reset per-encounter relic state. */
  resetEncounterState(): void {
    this.freeTowerUsedThisEncounter = false;
  }

  /** Reset per-wave relic state. */
  resetWaveState(): void {
    this.firstLeakBlockedThisWave = false;
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

  /** Get fire rate multiplier (lower = faster). */
  getFireRateMultiplier(): number {
    return this.getModifiers().fireRateMultiplier;
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

  /** Get spawn interval multiplier (>1 = slower spawning). */
  getSpawnIntervalMultiplier(): number {
    return this.getModifiers().spawnIntervalMultiplier;
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

  /** Get slow duration multiplier. */
  getSlowDurationMultiplier(): number {
    return this.getModifiers().slowDurationMultiplier;
  }

  /** Get DoT damage multiplier (mortar). */
  getDotDamageMultiplier(): number {
    return this.getModifiers().dotDamageMultiplier;
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
          mods.fireRateMultiplier *= 0.9; // lower = faster
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
          mods.slowDurationMultiplier *= 1.5;
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

        // Rare
        // ARCHITECTS_BLUEPRINT — trigger-based
        case RelicId.TEMPORAL_RIFT:
          mods.spawnIntervalMultiplier *= 1.25;
          break;
        case RelicId.COMMANDERS_BANNER:
          mods.damageMultiplier *= 1.15;
          mods.rangeMultiplier *= 1.15;
          break;
      }
    }

    this.cachedModifiers = mods;
  }
}
