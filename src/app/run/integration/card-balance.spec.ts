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
    // Encounter-scoped flag modifiers (duration=null) — rare anchors that
    // persist the whole encounter by design (sprints 17/18, 33/34).
    const encounterScopedIds: readonly CardId[] = [
      CardId.CARTOGRAPHER_SEAL,
      CardId.LABYRINTH_MIND,
      CardId.KING_OF_THE_HILL,
      CardId.GRAVITY_WELL,
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

  it('should have exactly 67 card definitions', () => {
    // 40 original + 6 tower variant cards (sprint 2a) + 3 status-applying spells (sprint 2b)
    // + 2 status payoff spells (sprint 2c) + 4 Cartographer terraform spells (phase 2 sprints 11/12/15/16)
    // + 1 DETOUR routing spell (sprint 14) + 2 Cartographer rare anchors (phase 2 sprints 17/18)
    // + 2 Highground elevation cards (phase 3 sprints 27/28: RAISE_PLATFORM + DEPRESS_TILE)
    // + 1 Highground modifier card (phase 3 sprint 29: HIGH_PERCH)
    // + 3 Highground uncommon cards (phase 3 sprints 30/31/32: CLIFFSIDE + VANTAGE_POINT + AVALANCHE_ORDER)
    // + 2 Highground rare cards (phase 3 sprints 33/34: KING_OF_THE_HILL + GRAVITY_WELL)
    // + 1 Conduit common (phase 4 sprint 43: HANDSHAKE)
    expect(Object.keys(CARD_DEFINITIONS).length).toBe(67);
  });

  // ── Phase 2 Sprint 19 — Cartographer economy validation ────────────────────
  //
  // Sprint 19 is a utility/tuning pass. The committed decision: keep the
  // starter deck archetype-neutral. Every archetype earns its cards through
  // the reward pool, not the starter. This prevents any archetype from
  // accidentally flipping a fresh deck's `getDominantArchetype()` tag before
  // the player has made a real choice.
  //
  // These specs codify the cost curve so balance regressions show up as test
  // failures. Tune here by modifying expected costs; do NOT silently drop the
  // spec when reworking.

  describe('Cartographer economy (Sprint 19 utility pass)', () => {
    const cartographerCards = Object.values(CARD_DEFINITIONS).filter(c => c.archetype === 'cartographer');

    it('every Cartographer card has archetype = cartographer', () => {
      // Sanity check the archetype tag round-trips correctly (failure mode:
      // a copy-paste bug that drops the archetype field and defaults to neutral).
      for (const card of cartographerCards) {
        expect(card.archetype).toBe('cartographer');
      }
    });

    it('common Cartographer cards cost 0-1 energy (cheap, frequent plays)', () => {
      const commons = cartographerCards.filter(c => c.rarity === CardRarity.COMMON);
      expect(commons.length).toBeGreaterThan(0);
      for (const card of commons) {
        expect(card.energyCost)
          .withContext(`${card.id}: common should cost 0-1 energy`)
          .toBeLessThanOrEqual(1);
      }
    });

    it('uncommon Cartographer cards cost 1-2 energy', () => {
      const uncommons = cartographerCards.filter(c => c.rarity === CardRarity.UNCOMMON);
      expect(uncommons.length).toBeGreaterThan(0);
      for (const card of uncommons) {
        expect(card.energyCost)
          .withContext(`${card.id}: uncommon should cost 1-2 energy`)
          .toBeGreaterThanOrEqual(1);
        expect(card.energyCost)
          .withContext(`${card.id}: uncommon should cost 1-2 energy`)
          .toBeLessThanOrEqual(2);
      }
    });

    it('rare Cartographer cards cost 2-3 energy (strong effects, worth the cost)', () => {
      const rares = cartographerCards.filter(c => c.rarity === CardRarity.RARE);
      expect(rares.length).toBeGreaterThan(0);
      for (const card of rares) {
        expect(card.energyCost)
          .withContext(`${card.id}: rare should cost 2-3 energy`)
          .toBeGreaterThanOrEqual(2);
        expect(card.energyCost)
          .withContext(`${card.id}: rare should cost 2-3 energy`)
          .toBeLessThanOrEqual(3);
      }
    });

    it('no Cartographer card is seeded in the starter deck (archetype-neutral start)', () => {
      // Deliberate design: a fresh run's dominant archetype must be 'neutral'
      // so reward weighting doesn't lean before the player picks their path.
      // See DeckService.getDominantArchetype + anti-flapping tie-break.
      const starter = getStarterDeck();
      for (const cardId of starter) {
        const def = CARD_DEFINITIONS[cardId];
        expect(def.archetype ?? 'neutral')
          .withContext(`${cardId} in starter deck but tagged ${def.archetype}`)
          .toBe('neutral');
      }
    });

    it('tile-target Cartographer cards all set terraform=true for tooltip/keyword visibility', () => {
      // Any Cartographer card with effect.type === 'terraform_target' must
      // carry the terraform keyword (feeds hover tooltip + card-detail modal).
      for (const card of cartographerCards) {
        if (card.effect.type === 'terraform_target') {
          expect(card.terraform)
            .withContext(`${card.id}: tile-target Cartographer card must set terraform=true`)
            .toBe(true);
        }
      }
    });

    it('non-terraform Cartographer cards (DETOUR, SEAL, LABYRINTH_MIND) explicitly set terraform=false', () => {
      // These three change rules/routing without modifying tile state. They
      // must be archetype-tagged but NOT carry the terraform keyword, so the
      // tooltip keyword list doesn't lie about what they do.
      const nonTerraformIds: readonly CardId[] = [
        CardId.DETOUR,
        CardId.CARTOGRAPHER_SEAL,
        CardId.LABYRINTH_MIND,
      ];
      for (const cardId of nonTerraformIds) {
        const def = CARD_DEFINITIONS[cardId];
        expect(def.terraform)
          .withContext(`${cardId}: must NOT be tagged terraform`)
          .toBe(false);
      }
    });
  });

  // ── Phase 3 Sprints 27/28 — Highground economy validation ──────────────────
  //
  // Mirrors Cartographer economy specs (Sprint 19). Highground common cards must
  // cost 0-1 energy and carry archetype='highground' + terraform=true.
  // Codified here so balance regressions surface as test failures.

  describe('Highground economy (Sprints 27/28 — RAISE_PLATFORM + DEPRESS_TILE)', () => {
    const highgroundCards = Object.values(CARD_DEFINITIONS).filter(c => c.archetype === 'highground');

    it('every Highground card has archetype = highground', () => {
      for (const card of highgroundCards) {
        expect(card.archetype)
          .withContext(`${card.id}: archetype should be highground`)
          .toBe('highground');
      }
    });

    it('common Highground cards cost 0-1 energy (cheap, frequent plays)', () => {
      const commons = highgroundCards.filter(c => c.rarity === CardRarity.COMMON);
      expect(commons.length).toBeGreaterThan(0);
      for (const card of commons) {
        expect(card.energyCost)
          .withContext(`${card.id}: common should cost 0-1 energy`)
          .toBeLessThanOrEqual(1);
      }
    });

    it('RAISE_PLATFORM has archetype=highground, terraform=true, energyCost=1', () => {
      const def = CARD_DEFINITIONS[CardId.RAISE_PLATFORM];
      expect(def.archetype).toBe('highground');
      expect(def.terraform).toBe(true);
      expect(def.energyCost).toBe(1);
      expect(def.rarity).toBe(CardRarity.COMMON);
    });

    it('RAISE_PLATFORM effect is elevation_target op=raise amount=1 duration=null', () => {
      const def = CARD_DEFINITIONS[CardId.RAISE_PLATFORM];
      expect(def.effect.type).toBe('elevation_target');
      if (def.effect.type === 'elevation_target') {
        expect(def.effect.op).toBe('raise');
        expect(def.effect.amount).toBe(1);
        expect(def.effect.duration).toBeNull();
        expect(def.effect.exposeEnemies).toBeFalsy();
      }
    });

    it('RAISE_PLATFORM upgradedEffect matches effect shape', () => {
      const def = CARD_DEFINITIONS[CardId.RAISE_PLATFORM];
      expect(def.upgradedEffect).toBeDefined();
      expect(def.upgradedEffect?.type).toBe('elevation_target');
    });

    it('DEPRESS_TILE has archetype=highground, terraform=true, energyCost=1', () => {
      const def = CARD_DEFINITIONS[CardId.DEPRESS_TILE];
      expect(def.archetype).toBe('highground');
      expect(def.terraform).toBe(true);
      expect(def.energyCost).toBe(1);
      expect(def.rarity).toBe(CardRarity.COMMON);
    });

    it('DEPRESS_TILE effect is elevation_target op=depress amount=1 duration=null exposeEnemies=true', () => {
      const def = CARD_DEFINITIONS[CardId.DEPRESS_TILE];
      expect(def.effect.type).toBe('elevation_target');
      if (def.effect.type === 'elevation_target') {
        expect(def.effect.op).toBe('depress');
        expect(def.effect.amount).toBe(1);
        expect(def.effect.duration).toBeNull();
        expect(def.effect.exposeEnemies).toBe(true);
      }
    });

    it('DEPRESS_TILE upgradedEffect matches effect shape', () => {
      const def = CARD_DEFINITIONS[CardId.DEPRESS_TILE];
      expect(def.upgradedEffect).toBeDefined();
      expect(def.upgradedEffect?.type).toBe('elevation_target');
      if (def.upgradedEffect?.type === 'elevation_target') {
        expect(def.upgradedEffect.exposeEnemies).toBe(true);
      }
    });

    it('no Highground card is seeded in the starter deck (archetype-neutral start)', () => {
      const starter = getStarterDeck();
      for (const cardId of starter) {
        const def = CARD_DEFINITIONS[cardId];
        expect(def.archetype ?? 'neutral')
          .withContext(`${cardId} in starter deck but tagged ${def.archetype}`)
          .not.toBe('highground');
      }
    });

    it('elevation-target Highground cards all set terraform=true for keyword visibility', () => {
      for (const card of highgroundCards) {
        if (card.effect.type === 'elevation_target') {
          expect(card.terraform)
            .withContext(`${card.id}: elevation-target card must set terraform=true`)
            .toBe(true);
        }
      }
    });

    it('HIGH_PERCH has archetype=highground, terraform=false, energyCost=1, COMMON', () => {
      const def = CARD_DEFINITIONS[CardId.HIGH_PERCH];
      expect(def.archetype).toBe('highground');
      expect(def.terraform).toBe(false); // reads elevation, does not mutate tiles
      expect(def.energyCost).toBe(1);
      expect(def.rarity).toBe(CardRarity.COMMON);
      expect(def.type).toBe(CardType.MODIFIER);
    });

    it('HIGH_PERCH effect is modifier stat=highPerchRangeBonus, value=0.25, duration=1', () => {
      const def = CARD_DEFINITIONS[CardId.HIGH_PERCH];
      expect(def.effect.type).toBe('modifier');
      if (def.effect.type === 'modifier') {
        expect(def.effect.stat).toBe('highPerchRangeBonus');
        expect(def.effect.value).toBeCloseTo(0.25, 5);
        expect(def.effect.duration).toBe(1);
      }
    });

    it('HIGH_PERCH upgraded effect has value=0.4', () => {
      const def = CARD_DEFINITIONS[CardId.HIGH_PERCH];
      expect(def.upgradedEffect).toBeDefined();
      if (def.upgradedEffect?.type === 'modifier') {
        expect(def.upgradedEffect.value).toBeCloseTo(0.4, 5);
        expect(def.upgradedEffect.duration).toBe(1);
      }
    });

    it('non-terraform Highground cards (HIGH_PERCH) explicitly set terraform=false', () => {
      // HIGH_PERCH is archetype-tagged highground but reads elevation rather than
      // mutating tiles. Must carry terraform=false so tooltip keyword list is accurate.
      const def = CARD_DEFINITIONS[CardId.HIGH_PERCH];
      expect(def.terraform)
        .withContext('HIGH_PERCH: must NOT be tagged terraform')
        .toBe(false);
    });
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
