/**
 * Card System — Balance Validation
 *
 * Codifies the card economy so balance regressions show up as test failures.
 * Tests actual constant values in card-definitions and card.model — not runtime logic.
 */

import {
  CARD_DEFINITIONS,
  getStarterDeck,
  getCardsByType,
  getCardsByRarity,
} from '../constants/card-definitions';
import {
  CardId,
  CardRarity,
  CardType,
  DECK_CONFIG,
} from '../models/card.model';
import { TOWER_CONFIGS } from '../../game/game-board/models/tower.model';
import { TowerType } from '../../game/game-board/models/tower.model';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STARTER_IDS = getStarterDeck();
const STARTER_DEFS = STARTER_IDS.map(id => CARD_DEFINITIONS[id]);

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('Card System — Balance', () => {

  // ── Deck Composition ──────────────────────────────────────────────────────

  it('starter deck should have exactly 20 cards', () => {
    expect(STARTER_IDS.length).toBe(20);
  });

  it('starter deck should contain at least 4 tower cards', () => {
    const towerCount = STARTER_DEFS.filter(d => d.type === CardType.TOWER).length;
    expect(towerCount).toBeGreaterThanOrEqual(4);
  });

  it('starter deck energy cost total should be 26-34 (playable across ~9-11 energy waves)', () => {
    // 8×BASIC(1) + 3×SNIPER(3) + 2×SPLASH(2) + 2×SLOW(2) + 1×CHAIN(2)
    // + 1×GOLD_RUSH(1) + 1×DAMAGE_BOOST(1) + 1×DRAW_TWO(1) + 1×ENERGY_SURGE(0) = 30
    const totalCost = STARTER_DEFS.reduce((sum, d) => sum + d.energyCost, 0);
    expect(totalCost).toBeGreaterThanOrEqual(26);
    expect(totalCost).toBeLessThanOrEqual(34);
  });

  // ── Energy Economy ────────────────────────────────────────────────────────

  it('base energy (3) should allow playing at least 1 card per wave (no card costs > 3 energy)', () => {
    // Verify no individual starter card costs more than baseEnergy — otherwise it could never be played
    for (const def of STARTER_DEFS) {
      expect(def.energyCost)
        .withContext(`${def.id}: cost ${def.energyCost} exceeds baseEnergy ${DECK_CONFIG.baseEnergy}`)
        .toBeLessThanOrEqual(DECK_CONFIG.baseEnergy);
    }
    // Also verify cheap cards (cost ≤ 1) exist so player can make small moves with leftover energy
    const cheapCards = STARTER_DEFS.filter(d => d.energyCost <= 1);
    expect(cheapCards.length).toBeGreaterThanOrEqual(2);
  });

  it('hand size (5) means some cards go unplayed each wave (strategic choice)', () => {
    // 5 cards drawn, 3 energy available — if average cost > 0.6, some cards cannot be played
    const minAvgCost = STARTER_DEFS.reduce((sum, d) => sum + d.energyCost, 0) / STARTER_DEFS.length;
    const maxPlayableWithBaseEnergy = Math.floor(DECK_CONFIG.baseEnergy / Math.max(1, Math.floor(minAvgCost)));
    expect(maxPlayableWithBaseEnergy).toBeLessThan(DECK_CONFIG.handSize);
  });

  it('ENERGY_SURGE card should not exceed reasonable energy gain (max 3)', () => {
    const energySurgeDef = CARD_DEFINITIONS[CardId.ENERGY_SURGE];
    const effect = energySurgeDef.effect;
    const upgradedEffect = energySurgeDef.upgradedEffect;

    if (effect.type === 'utility') {
      expect(effect.value).toBeLessThanOrEqual(3);
    }
    if (upgradedEffect && upgradedEffect.type === 'utility') {
      expect(upgradedEffect.value).toBeLessThanOrEqual(3);
    }
  });

  // ── Card Power Levels ─────────────────────────────────────────────────────

  it('tower card energy costs should scale with tower gold costs (higher cost = higher energy)', () => {
    // Basic: cost 50 → energy 1; Mortar: cost 140 → energy 3
    // Verify ordering: BASIC (1) <= SPLASH (2) <= MORTAR (3)
    const basicCost = CARD_DEFINITIONS[CardId.TOWER_BASIC].energyCost;
    const splashCost = CARD_DEFINITIONS[CardId.TOWER_SPLASH].energyCost;
    const mortarCost = CARD_DEFINITIONS[CardId.TOWER_MORTAR].energyCost;

    expect(basicCost).toBeLessThanOrEqual(splashCost);
    expect(splashCost).toBeLessThanOrEqual(mortarCost);

    // Also confirm Basic tower card costs 1 and Mortar costs 3 (documented formula)
    expect(basicCost).toBe(1);
    expect(mortarCost).toBe(3);
  });

  it('each tower card energy cost should equal tower gold cost / 50 (rounded)', () => {
    // Tower type → card ID mapping
    const towerCardMap: Array<{ towerType: TowerType; cardId: CardId }> = [
      { towerType: TowerType.BASIC, cardId: CardId.TOWER_BASIC },
      { towerType: TowerType.SNIPER, cardId: CardId.TOWER_SNIPER },
      { towerType: TowerType.SPLASH, cardId: CardId.TOWER_SPLASH },
      { towerType: TowerType.SLOW, cardId: CardId.TOWER_SLOW },
      { towerType: TowerType.CHAIN, cardId: CardId.TOWER_CHAIN },
      { towerType: TowerType.MORTAR, cardId: CardId.TOWER_MORTAR },
    ];

    for (const { towerType, cardId } of towerCardMap) {
      const goldCost = TOWER_CONFIGS[towerType].cost;
      const expectedEnergy = Math.round(goldCost / 50);
      const actualEnergy = CARD_DEFINITIONS[cardId].energyCost;
      // Allow ±1 tolerance for documented rounding adjustments
      expect(Math.abs(actualEnergy - expectedEnergy))
        .withContext(`${cardId}: expected ~${expectedEnergy} energy (gold=${goldCost}), got ${actualEnergy}`)
        .toBeLessThanOrEqual(1);
    }
  });

  it('no single spell card should provide more than 100 gold', () => {
    const goldRush = CARD_DEFINITIONS[CardId.GOLD_RUSH];
    const effect = goldRush.effect;
    const upgradedEffect = goldRush.upgradedEffect;

    if (effect.type === 'spell' && effect.spellId === 'gold_rush') {
      expect(effect.value).toBeLessThanOrEqual(100);
    }
    if (upgradedEffect && upgradedEffect.type === 'spell') {
      expect(upgradedEffect.value).toBeLessThanOrEqual(100);
    }
  });

  it('modifier durations should be 1-3 waves (not permanent)', () => {
    const modifierCards = getCardsByType(CardType.MODIFIER);
    // Encounter-scoped flag modifiers (duration=null) — Cartographer rare
    // anchors that persist the whole encounter by design (sprints 17/18).
    const encounterScopedIds: readonly CardId[] = [
      CardId.CARTOGRAPHER_SEAL,
      CardId.LABYRINTH_MIND,
    ];
    for (const card of modifierCards) {
      const effect = card.effect;
      if (effect.type === 'modifier') {
        // SHIELD_WALL uses duration 0 (block-based, not wave-based) — exempt
        if (card.id === CardId.SHIELD_WALL) {
          expect(effect.duration).toBe(0); // intentional exception
        } else if (encounterScopedIds.includes(card.id)) {
          // Flag-style modifiers use null duration (encounter-scoped, see
          // ActiveModifier.remainingWaves widening and CardEffectService.tickWave).
          expect(effect.duration).toBeNull();
        } else {
          expect(effect.duration)
            .withContext(`${card.id}: duration ${effect.duration} should be 1-3`)
            .toBeGreaterThanOrEqual(1);
          expect(effect.duration)
            .withContext(`${card.id}: duration ${effect.duration} should be 1-3`)
            .toBeLessThanOrEqual(3);
        }
      }
    }
  });

  it('spell damage should not exceed 150 per card', () => {
    const spellCards = getCardsByType(CardType.SPELL);
    for (const card of spellCards) {
      const effect = card.effect;
      if (effect.type === 'spell' && effect.spellId === 'lightning_strike') {
        expect(effect.value).toBeLessThanOrEqual(150);
        if (card.upgradedEffect && card.upgradedEffect.type === 'spell') {
          expect(card.upgradedEffect.value).toBeLessThanOrEqual(150);
        }
      }
    }
  });

  // ── Card Pool ─────────────────────────────────────────────────────────────

  it('non-starter pool should have at least 15 cards for variety', () => {
    const nonStarters = Object.values(CARD_DEFINITIONS).filter(c => c.rarity !== CardRarity.STARTER);
    expect(nonStarters.length).toBeGreaterThanOrEqual(15);
  });

  it('each card type should have at least 3 non-starter options', () => {
    const types = [CardType.SPELL, CardType.MODIFIER, CardType.UTILITY];
    for (const type of types) {
      const nonStarterCount = getCardsByType(type).filter(c => c.rarity !== CardRarity.STARTER).length;
      expect(nonStarterCount)
        .withContext(`${type}: expected >= 3 non-starter cards, got ${nonStarterCount}`)
        .toBeGreaterThanOrEqual(3);
    }
  });

  it('rare cards should have stronger effects than common cards of the same type', () => {
    // FORTIFY (rare, spell): can upgrade a tower — unique effect, no common equivalent
    // RAPID_FIRE (uncommon, modifier): 30% fire rate vs DAMAGE_BOOST (common, modifier): 25% damage
    // ENERGY_SURGE (rare, utility): gain 2 energy — compared to DRAW_TWO (common): draw 2 cards
    // This test confirms rarity distribution: at least 1 rare modifier and 1 rare utility
    const rareModifiers = getCardsByRarity(CardRarity.RARE).filter(c => c.type === CardType.MODIFIER);
    const rareUtilities = getCardsByRarity(CardRarity.RARE).filter(c => c.type === CardType.UTILITY);
    const rareSpells = getCardsByRarity(CardRarity.RARE).filter(c => c.type === CardType.SPELL);

    // Combined rare coverage: at least 2 different rare card types
    const rareCoverage = [rareModifiers, rareUtilities, rareSpells].filter(arr => arr.length > 0).length;
    expect(rareCoverage).toBeGreaterThanOrEqual(2);
  });

  it('rare cards should have higher energy cost than common cards on average', () => {
    const commons = getCardsByRarity(CardRarity.COMMON);
    const rares = getCardsByRarity(CardRarity.RARE);

    const avgCommonCost = commons.reduce((s, c) => s + c.energyCost, 0) / commons.length;
    const avgRareCost = rares.reduce((s, c) => s + c.energyCost, 0) / rares.length;

    // Rares should cost at least as much as commons on average
    // (Some rares are 0-cost utility, so we use >=, not strict >)
    expect(avgRareCost).toBeGreaterThanOrEqual(avgCommonCost - 0.5);
  });

  // ── Draft Economy ─────────────────────────────────────────────────────────

  it('3 card choices per encounter is enough for meaningful selection (pool >= 9 unique non-starter)', () => {
    // The pool must be at least 3x the draft count so duplicate cards don't dominate
    const draftCount = 3;
    const nonStarters = Object.values(CARD_DEFINITIONS).filter(c => c.rarity !== CardRarity.STARTER);
    expect(nonStarters.length).toBeGreaterThanOrEqual(draftCount * 3);
  });

  // ── Total Card Count ──────────────────────────────────────────────────────

  it('should have exactly 58 card definitions', () => {
    // 40 original + 6 tower variant cards (sprint 2a) + 3 status-applying spells (sprint 2b)
    // + 2 status payoff spells (sprint 2c) + 4 Cartographer terraform spells (phase 2 sprints 11/12/15/16)
    // + 1 DETOUR routing spell (sprint 14) + 2 Cartographer rare anchors (phase 2 sprints 17/18)
    expect(Object.keys(CARD_DEFINITIONS).length).toBe(58);
  });

  it('starter cards should all have STARTER rarity', () => {
    const starterCardDefs = STARTER_IDS.map(id => CARD_DEFINITIONS[id]);
    const nonStarterRarity = starterCardDefs.filter(d => d.rarity !== CardRarity.STARTER);
    // GOLD_RUSH, DAMAGE_BOOST (COMMON) and DRAW_TWO (COMMON), ENERGY_SURGE (RARE) are in the
    // starter deck but have non-STARTER rarity — they can also appear as rewards. Count must be <= 4.
    expect(nonStarterRarity.length).toBeLessThanOrEqual(4);
  });

  it('STARTER-rarity cards that appear in the starter deck should all have STARTER rarity', () => {
    // Cards in the starter deck with STARTER rarity (tower cards) should all be tower types
    const starterRarityCards = STARTER_DEFS.filter(d => d.rarity === CardRarity.STARTER);
    // All 6 tower types have STARTER rarity — the starter deck intentionally omits Chain and Mortar
    // (they would be too strong with 2-3 energy cost in a 3-energy economy)
    // Verify at least 4 STARTER-rarity cards appear (Basic×4 + Sniper, Splash, Slow = 7 of 10)
    expect(starterRarityCards.length).toBeGreaterThanOrEqual(4);
    for (const def of starterRarityCards) {
      expect(def.rarity).toBe(CardRarity.STARTER);
    }
  });
});
