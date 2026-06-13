import { Injectable } from '@angular/core';

import {
  RunState,
} from '../models/run-state.model';
import {
  ShopItem,
  ItemReward,
} from '../models/encounter.model';
import { ItemType } from '../models/item.model';
import { RelicId, RelicRarity, RelicDefinition } from '../models/relic.model';
import { AscensionEffectType, getAscensionEffects } from '../models/ascension.model';
import {
  ARCHETYPE_CARD_BIAS_CHANCE,
  REWARD_RARITY_WEIGHTS,
  CARD_PITY_THRESHOLD,
  SHOP_CONFIG,
  ITEM_CONFIG,
} from '../constants/run.constants';

import { RelicService } from './relic.service';
import { DeckService } from './deck.service';
import { SeenCardsService } from '../../core/services/seen-cards.service';
import { CARD_DEFINITIONS } from '../constants/card-definitions';
import { CardArchetype, CardDefinition, CardId, CardRarity } from '../models/card.model';

/**
 * Manages shop state and item generation for Ascent Mode runs.
 *
 * Holds the current list of shop items, generates them from a RunState
 * snapshot, and computes scaled costs. Does NOT inject RunService —
 * mutation methods (buy, remove, upgrade) live in RunService to avoid
 * a circular dependency.
 */
@Injectable({ providedIn: 'root' })
export class RunShopService {

  private shopItems: ShopItem[] = [];

  constructor(
    private relicService: RelicService,
    private deckService: DeckService,
    private seenCards: SeenCardsService,
  ) {}

  // ── Shop state ───────────────────────────────────────────

  getShopItems(): ShopItem[] {
    return this.shopItems;
  }

  setShopItems(items: ShopItem[]): void {
    this.shopItems = items;
  }

  clearShopItems(): void {
    this.shopItems = [];
  }

  // ── Cost computations ────────────────────────────────────

  /**
   * Live-scaled cost of the card-removal service. Applies the same
   * SHOP_PRICE_MULTIPLIER ascension scaling that other shop items use.
   * Returns base cost when runState is null.
   */
  getCardRemoveCost(runState: RunState | null): number {
    if (!runState) return SHOP_CONFIG.cardRemoveCost;
    const ascEffects = getAscensionEffects(runState.ascensionLevel);
    const priceMultiplier = ascEffects.get(AscensionEffectType.SHOP_PRICE_MULTIPLIER) ?? 1;
    return Math.round(SHOP_CONFIG.cardRemoveCost * priceMultiplier);
  }

  /**
   * Live-scaled cost of the card-upgrade service. Mirrors getCardRemoveCost
   * using SHOP_CONFIG.cardUpgradeCost as base. Returns base cost when runState
   * is null.
   */
  getCardUpgradeCost(runState: RunState | null): number {
    if (!runState) return SHOP_CONFIG.cardUpgradeCost;
    const ascEffects = getAscensionEffects(runState.ascensionLevel);
    const priceMultiplier = ascEffects.get(AscensionEffectType.SHOP_PRICE_MULTIPLIER) ?? 1;
    return Math.round(SHOP_CONFIG.cardUpgradeCost * priceMultiplier);
  }

  // ── Generation ───────────────────────────────────────────

  /**
   * Generate shop items from the provided run state and return a
   * {items, updatedPityCounter} result. Callers (RunService) are
   * responsible for persisting the updated pity counter onto runState.
   *
   * Also updates the internal shopItems state so getShopItems() reflects
   * the new inventory immediately.
   *
   * @param rng A seeded random function advanced by each pick call.
   * @returns Updated pity counter value after shop generation.
   */
  generateShopItems(runState: RunState, rng: () => number): number {
    const items: ShopItem[] = [];

    const ascEffects = getAscensionEffects(runState.ascensionLevel);
    const priceMultiplier = ascEffects.get(AscensionEffectType.SHOP_PRICE_MULTIPLIER) ?? 1;
    const shopSlotReduction = ascEffects.get(AscensionEffectType.SHOP_SLOT_REDUCTION) ?? 0;
    const relicsInShop = Math.max(0, SHOP_CONFIG.relicsInShop - shopSlotReduction);
    const cardsInShop = Math.max(0, SHOP_CONFIG.cardsInShop - shopSlotReduction);

    // Relic items — weighted by rarity
    const available = this.relicService.getAvailableRelics();
    const relicByRarity = this.buildRelicPool(available);
    const relicRarityWeights: Array<{ rarity: RelicRarity; weight: number }> = [
      { rarity: RelicRarity.COMMON, weight: REWARD_RARITY_WEIGHTS.common },
      { rarity: RelicRarity.UNCOMMON, weight: REWARD_RARITY_WEIGHTS.uncommon },
      { rarity: RelicRarity.RARE, weight: REWARD_RARITY_WEIGHTS.rare },
    ];
    const pickedRelicIds = new Set<RelicId>();
    for (let i = 0; i < relicsInShop; i++) {
      const remaining: Record<RelicRarity, RelicDefinition[]> = {
        [RelicRarity.COMMON]: relicByRarity[RelicRarity.COMMON].filter(r => !pickedRelicIds.has(r.id)),
        [RelicRarity.UNCOMMON]: relicByRarity[RelicRarity.UNCOMMON].filter(r => !pickedRelicIds.has(r.id)),
        [RelicRarity.RARE]: relicByRarity[RelicRarity.RARE].filter(r => !pickedRelicIds.has(r.id)),
      };
      const rarity = this.pickWeightedRarity(relicRarityWeights, remaining, rng);
      if (rarity === null) continue;
      const pool = remaining[rarity];
      if (pool.length === 0) continue;
      const relic = pool[Math.floor(rng() * pool.length)];
      pickedRelicIds.add(relic.id);
      const basePrice = SHOP_CONFIG.priceByRarity[relic.rarity];
      items.push({
        item: { type: 'relic', relicId: relic.id },
        cost: Math.round(basePrice * priceMultiplier),
      });
    }

    // Card items — weighted by rarity, with pity-timer protection.
    // Reuses cardPityCounter from run state.
    const cardByRarity = this.buildNonStarterCardPool();
    const cardRarityWeights: Array<{ rarity: CardRarity; weight: number }> = [
      { rarity: CardRarity.COMMON, weight: REWARD_RARITY_WEIGHTS.common },
      { rarity: CardRarity.UNCOMMON, weight: REWARD_RARITY_WEIGHTS.uncommon },
      { rarity: CardRarity.RARE, weight: REWARD_RARITY_WEIGHTS.rare },
    ];
    const pickedCardIds = new Set<CardId>();
    const dominant = this.deckService.getDominantArchetype();
    let shopPityCounter = runState.cardPityCounter ?? 0;
    let shopPityUpdated = false;
    for (let i = 0; i < cardsInShop; i++) {
      const remaining: Record<CardRarity, CardDefinition[]> = {
        [CardRarity.STARTER]: [],
        [CardRarity.COMMON]: cardByRarity[CardRarity.COMMON].filter(c => !pickedCardIds.has(c.id)),
        [CardRarity.UNCOMMON]: cardByRarity[CardRarity.UNCOMMON].filter(c => !pickedCardIds.has(c.id)),
        [CardRarity.RARE]: cardByRarity[CardRarity.RARE].filter(c => !pickedCardIds.has(c.id)),
      };
      const pityForceRare = shopPityCounter >= CARD_PITY_THRESHOLD && remaining[CardRarity.RARE].length > 0;
      const rarity = pityForceRare
        ? CardRarity.RARE
        : this.pickWeightedRarity(cardRarityWeights, remaining, rng);
      if (rarity === null) continue;
      const pool = remaining[rarity];
      if (pool.length === 0) continue;
      const card = this.pickArchetypeAwareCard(pool, dominant, rng);
      pickedCardIds.add(card.id);
      this.seenCards.markSeen(card.id);
      const rarityKey = card.rarity as keyof typeof SHOP_CONFIG.priceByRarity;
      const basePrice = SHOP_CONFIG.priceByRarity[rarityKey] ?? SHOP_CONFIG.priceByRarity.common;
      items.push({
        item: { type: 'card', cardId: card.id },
        cost: Math.round(basePrice * priceMultiplier),
      });
      if (rarity === CardRarity.RARE) {
        shopPityCounter = 0;
      } else {
        shopPityCounter++;
      }
      shopPityUpdated = true;
    }

    // Item (consumable) slots
    const allItemTypes = Object.values(ItemType);
    for (let i = 0; i < ITEM_CONFIG.shopSlotCount; i++) {
      if (allItemTypes.length === 0) break;
      const itemType = allItemTypes[Math.floor(rng() * allItemTypes.length)];
      const itemReward: ItemReward = { type: 'item', itemType };
      items.push({
        item: itemReward,
        cost: Math.round(ITEM_CONFIG.shopCost * priceMultiplier),
      });
    }

    this.shopItems = items;

    // Return the updated pity counter so RunService can persist it.
    return shopPityUpdated ? shopPityCounter : (runState.cardPityCounter ?? 0);
  }

  // ── Pool helpers (package-private via method access for testing) ──────────

  /**
   * Pick a single card from `pool` biased toward the dominant archetype when
   * one is set.
   *   - Dominant === 'neutral' → uniform pick across pool.
   *   - Otherwise: 60% chance pick from archetype-tagged subset, 40% neutral
   *     subset. Falls back to uniform when the chosen subset is empty.
   *
   * Re-used by generateShopItems so the shop and reward surfaces feel
   * coherent during a run.
   */
  pickArchetypeAwareCard<T extends { archetype?: CardArchetype }>(
    pool: T[],
    dominant: CardArchetype,
    rng: () => number,
  ): T {
    if (dominant === 'neutral' || pool.length === 0) {
      return pool[Math.floor(rng() * pool.length)];
    }

    const archetypeMatches = pool.filter(c => c.archetype === dominant);
    const neutralMatches = pool.filter(c => (c.archetype ?? 'neutral') === 'neutral');
    const wantArchetype = rng() < ARCHETYPE_CARD_BIAS_CHANCE;
    const preferred = wantArchetype ? archetypeMatches : neutralMatches;
    if (preferred.length > 0) {
      return preferred[Math.floor(rng() * preferred.length)];
    }
    const fallback = wantArchetype ? neutralMatches : archetypeMatches;
    if (fallback.length > 0) return fallback[Math.floor(rng() * fallback.length)];
    return pool[Math.floor(rng() * pool.length)];
  }

  /**
   * Select a rarity tier using weighted random selection.
   * Returns null when every tier in the pool is empty.
   */
  pickWeightedRarity<R extends string>(
    weights: Array<{ rarity: R; weight: number }>,
    pool: Record<R, unknown[]>,
    rng: () => number,
  ): R | null {
    const available = weights.filter(w => pool[w.rarity].length > 0);
    if (available.length === 0) return null;
    const total = available.reduce((sum, w) => sum + w.weight, 0);
    let roll = rng() * total;
    for (const entry of available) {
      roll -= entry.weight;
      if (roll < 0) return entry.rarity;
    }
    return available[available.length - 1].rarity;
  }

  /**
   * Build a pool of all non-starter cards grouped by rarity.
   * STARTER bucket is always empty — it exists only to satisfy the
   * Record<CardRarity, ...> shape.
   */
  buildNonStarterCardPool(): Record<CardRarity, CardDefinition[]> {
    const pool = Object.values(CARD_DEFINITIONS).filter(c => c.rarity !== CardRarity.STARTER);
    return {
      [CardRarity.STARTER]: [],
      [CardRarity.COMMON]: pool.filter(c => c.rarity === CardRarity.COMMON),
      [CardRarity.UNCOMMON]: pool.filter(c => c.rarity === CardRarity.UNCOMMON),
      [CardRarity.RARE]: pool.filter(c => c.rarity === CardRarity.RARE),
    };
  }

  /** Group relics by rarity. Public so RunService's reward path shares this single
   * implementation (see RunService.buildRelicPool). */
  buildRelicPool(source: RelicDefinition[]): Record<RelicRarity, RelicDefinition[]> {
    return {
      [RelicRarity.COMMON]: source.filter(r => r.rarity === RelicRarity.COMMON),
      [RelicRarity.UNCOMMON]: source.filter(r => r.rarity === RelicRarity.UNCOMMON),
      [RelicRarity.RARE]: source.filter(r => r.rarity === RelicRarity.RARE),
    };
  }
}
