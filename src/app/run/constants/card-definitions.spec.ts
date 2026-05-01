import {
  CARD_DEFINITIONS,
  getActiveTowerEffect,
  getCardDefinition,
  getCardsByRarity,
  getCardsByType,
  getEffectiveEnergyCost,
  getStarterDeck,
} from './card-definitions';
import { CardId, CardInstance, CardRarity, CardType, TowerCardEffect, ModifierCardEffect, ElevationTargetCardEffect } from '../models/card.model';
import { TowerType } from '../../game/game-board/models/tower.model';
import { MODIFIER_STAT } from './modifier-stat.constants';

describe('CARD_DEFINITIONS', () => {
  it('has exactly 74 cards', () => {
    // Phase 4 adds HANDSHAKE (43) + FORMATION (44) + LINKWORK (45) + HARMONIC (46) + GRID_SURGE (47) + CONDUIT_BRIDGE (48) + ARCHITECT (49) + HIVE_MIND (50).
    expect(Object.keys(CARD_DEFINITIONS).length).toBe(74);
  });

  it('contains all CardId enum values', () => {
    const allIds = Object.values(CardId);
    for (const id of allIds) {
      expect(CARD_DEFINITIONS[id]).toBeDefined(`missing definition for ${id}`);
    }
  });

  it('has no duplicate CardIds (definition id matches key)', () => {
    for (const [key, def] of Object.entries(CARD_DEFINITIONS)) {
      expect(def.id).toBe(key as CardId);
    }
  });

  it('every card has a non-empty name', () => {
    for (const def of Object.values(CARD_DEFINITIONS)) {
      expect(def.name.trim().length).toBeGreaterThan(0, `empty name on ${def.id}`);
    }
  });

  it('every card has a non-empty description', () => {
    for (const def of Object.values(CARD_DEFINITIONS)) {
      expect(def.description.trim().length).toBeGreaterThan(0, `empty description on ${def.id}`);
    }
  });

  it('every card has upgraded = false (base definition is never pre-upgraded)', () => {
    for (const def of Object.values(CARD_DEFINITIONS)) {
      expect(def.upgraded).toBe(false, `${def.id} has upgraded = true in base definition`);
    }
  });

  describe('type counts', () => {
    it('has 12 tower cards (6 base + 6 variants)', () => {
      expect(getCardsByType(CardType.TOWER).length).toBe(12);
    });

    it('has 30 spell cards (16 original + 3 status-applying + 2 status payoff + 4 Cartographer terraform + 1 DETOUR + 2 Highground elevation + CLIFFSIDE + AVALANCHE_ORDER)', () => {
      expect(getCardsByType(CardType.SPELL).length).toBe(30);
    });

    it('has 25 modifier cards', () => {
      expect(getCardsByType(CardType.MODIFIER).length).toBe(25);
    });

    it('has 7 utility cards', () => {
      expect(getCardsByType(CardType.UTILITY).length).toBe(7);
    });
  });

  describe('tower card energy costs', () => {
    it('TOWER_BASIC costs 1 energy', () => {
      expect(CARD_DEFINITIONS[CardId.TOWER_BASIC].energyCost).toBe(1);
    });

    it('all tower cards have energy cost in range 1-3', () => {
      for (const def of getCardsByType(CardType.TOWER)) {
        expect(def.energyCost).toBeGreaterThanOrEqual(1);
        expect(def.energyCost).toBeLessThanOrEqual(3);
      }
    });

    it('TOWER_MORTAR costs 3 energy (most expensive)', () => {
      expect(CARD_DEFINITIONS[CardId.TOWER_MORTAR].energyCost).toBe(3);
    });
  });

  describe('tower card rarity', () => {
    it('the 6 base tower cards have STARTER rarity', () => {
      const starterTowerIds = [
        CardId.TOWER_BASIC, CardId.TOWER_SNIPER, CardId.TOWER_SPLASH,
        CardId.TOWER_SLOW, CardId.TOWER_CHAIN,
      ];
      for (const id of starterTowerIds) {
        expect(CARD_DEFINITIONS[id].rarity).toBe(CardRarity.STARTER, `${id} is not STARTER`);
      }
    });

    it('TOWER_MORTAR has UNCOMMON rarity (powerful AoE — must be obtainable via reward pool)', () => {
      expect(CARD_DEFINITIONS[CardId.TOWER_MORTAR].rarity).toBe(CardRarity.UNCOMMON);
    });

    it('the 6 tower variant cards have COMMON rarity', () => {
      const variantTowerIds = [
        CardId.TOWER_BASIC_REINFORCED, CardId.TOWER_SNIPER_LIGHT,
        CardId.TOWER_SPLASH_CLUSTER, CardId.TOWER_SLOW_AURA,
        CardId.TOWER_CHAIN_TESLA, CardId.TOWER_MORTAR_BARRAGE,
      ];
      for (const id of variantTowerIds) {
        expect(CARD_DEFINITIONS[id].rarity).toBe(CardRarity.COMMON, `${id} is not COMMON`);
      }
    });
  });

  describe('TOWER_MORTAR reward-pool and starter-deck guardrails (S8)', () => {
    it('TOWER_MORTAR is not in the starter deck (excluded by explicit card list)', () => {
      const deck = getStarterDeck();
      expect(deck.includes(CardId.TOWER_MORTAR)).toBe(false);
    });

    it('TOWER_MORTAR is in the non-starter reward pool (rarity !== STARTER)', () => {
      const rewardPool = Object.values(CARD_DEFINITIONS).filter(c => c.rarity !== CardRarity.STARTER);
      const hasMortar = rewardPool.some(c => c.id === CardId.TOWER_MORTAR);
      expect(hasMortar).toBe(true);
    });
  });

  describe('getCardsByRarity', () => {
    it('returns only cards of the requested rarity', () => {
      const commons = getCardsByRarity(CardRarity.COMMON);
      expect(commons.every(c => c.rarity === CardRarity.COMMON)).toBe(true);
    });

    it('returns 5 starter cards when queried by STARTER', () => {
      const starters = getCardsByRarity(CardRarity.STARTER);
      expect(starters.length).toBe(5);
    });
  });

  describe('getCardDefinition', () => {
    it('returns the correct definition by id', () => {
      const def = getCardDefinition(CardId.GOLD_RUSH);
      expect(def.id).toBe(CardId.GOLD_RUSH);
      expect(def.type).toBe(CardType.SPELL);
    });
  });

  // ── Tower Card Variants ──────────────────────────────────────

  describe('TOWER_BASIC_REINFORCED', () => {
    const def = CARD_DEFINITIONS[CardId.TOWER_BASIC_REINFORCED];
    const upgradedDef = def.upgradedEffect as TowerCardEffect;

    it('exists in CARD_DEFINITIONS', () => {
      expect(def).toBeDefined();
    });
    it('has type TOWER', () => {
      expect(def.type).toBe(CardType.TOWER);
    });
    it('has rarity COMMON', () => {
      expect(def.rarity).toBe(CardRarity.COMMON);
    });
    it('has energyCost 2', () => {
      expect(def.energyCost).toBe(2);
    });
    it('effect.towerType is BASIC', () => {
      expect((def.effect as TowerCardEffect).towerType).toBe(TowerType.BASIC);
    });
    it('effect has startLevel 2', () => {
      expect((def.effect as TowerCardEffect).startLevel).toBe(2);
    });
    it('effect has no statOverrides', () => {
      expect((def.effect as TowerCardEffect).statOverrides).toBeUndefined();
    });
    it('upgradedEffect is defined', () => {
      expect(def.upgradedEffect).toBeDefined();
    });
    it('upgradedEffect.towerType is BASIC', () => {
      expect(upgradedDef.towerType).toBe(TowerType.BASIC);
    });
    it('upgradedEffect.statOverrides has damageMultiplier 1.2', () => {
      expect(upgradedDef.statOverrides).toEqual(jasmine.objectContaining({ damageMultiplier: 1.2 }));
    });
  });

  describe('TOWER_SNIPER_LIGHT', () => {
    const def = CARD_DEFINITIONS[CardId.TOWER_SNIPER_LIGHT];
    const baseEffect = def.effect as TowerCardEffect;
    const upgradedEffect = def.upgradedEffect as TowerCardEffect;

    it('exists in CARD_DEFINITIONS', () => {
      expect(def).toBeDefined();
    });
    it('has type TOWER', () => {
      expect(def.type).toBe(CardType.TOWER);
    });
    it('has rarity COMMON', () => {
      expect(def.rarity).toBe(CardRarity.COMMON);
    });
    it('has energyCost 2', () => {
      expect(def.energyCost).toBe(2);
    });
    it('effect.towerType is SNIPER', () => {
      expect(baseEffect.towerType).toBe(TowerType.SNIPER);
    });
    it('effect.statOverrides has damageMultiplier 0.7', () => {
      expect(baseEffect.statOverrides).toEqual(jasmine.objectContaining({ damageMultiplier: 0.7 }));
    });
    it('upgradedEffect is defined', () => {
      expect(def.upgradedEffect).toBeDefined();
    });
    it('upgradedEffect.towerType is SNIPER', () => {
      expect(upgradedEffect.towerType).toBe(TowerType.SNIPER);
    });
    it('upgradedEffect.statOverrides has damageMultiplier 1.0', () => {
      expect(upgradedEffect.statOverrides).toEqual(jasmine.objectContaining({ damageMultiplier: 1.0 }));
    });
  });

  describe('TOWER_SPLASH_CLUSTER', () => {
    const def = CARD_DEFINITIONS[CardId.TOWER_SPLASH_CLUSTER];
    const baseEffect = def.effect as TowerCardEffect;
    const upgradedEffect = def.upgradedEffect as TowerCardEffect;

    it('exists in CARD_DEFINITIONS', () => {
      expect(def).toBeDefined();
    });
    it('has type TOWER', () => {
      expect(def.type).toBe(CardType.TOWER);
    });
    it('has rarity COMMON', () => {
      expect(def.rarity).toBe(CardRarity.COMMON);
    });
    it('has energyCost 1', () => {
      expect(def.energyCost).toBe(1);
    });
    it('effect.towerType is SPLASH', () => {
      expect(baseEffect.towerType).toBe(TowerType.SPLASH);
    });
    it('effect.statOverrides has splashRadiusMultiplier 0.6', () => {
      expect(baseEffect.statOverrides).toEqual(jasmine.objectContaining({ splashRadiusMultiplier: 0.6 }));
    });
    it('upgradedEffect is defined', () => {
      expect(def.upgradedEffect).toBeDefined();
    });
    it('upgradedEffect.towerType is SPLASH', () => {
      expect(upgradedEffect.towerType).toBe(TowerType.SPLASH);
    });
    it('upgradedEffect.statOverrides has splashRadiusMultiplier 0.85', () => {
      expect(upgradedEffect.statOverrides).toEqual(jasmine.objectContaining({ splashRadiusMultiplier: 0.85 }));
    });
  });

  describe('TOWER_SLOW_AURA', () => {
    const def = CARD_DEFINITIONS[CardId.TOWER_SLOW_AURA];
    const baseEffect = def.effect as TowerCardEffect;
    const upgradedEffect = def.upgradedEffect as TowerCardEffect;

    it('exists in CARD_DEFINITIONS', () => {
      expect(def).toBeDefined();
    });
    it('has type TOWER', () => {
      expect(def.type).toBe(CardType.TOWER);
    });
    it('has rarity COMMON', () => {
      expect(def.rarity).toBe(CardRarity.COMMON);
    });
    it('has energyCost 2', () => {
      expect(def.energyCost).toBe(2);
    });
    it('effect.towerType is SLOW', () => {
      expect(baseEffect.towerType).toBe(TowerType.SLOW);
    });
    it('effect.statOverrides has rangeMultiplier 1.5', () => {
      expect(baseEffect.statOverrides).toEqual(jasmine.objectContaining({ rangeMultiplier: 1.5 }));
    });
    it('upgradedEffect is defined', () => {
      expect(def.upgradedEffect).toBeDefined();
    });
    it('upgradedEffect.towerType is SLOW', () => {
      expect(upgradedEffect.towerType).toBe(TowerType.SLOW);
    });
    it('upgradedEffect.statOverrides has rangeMultiplier 1.8', () => {
      expect(upgradedEffect.statOverrides).toEqual(jasmine.objectContaining({ rangeMultiplier: 1.8 }));
    });
  });

  describe('TOWER_CHAIN_TESLA', () => {
    const def = CARD_DEFINITIONS[CardId.TOWER_CHAIN_TESLA];
    const baseEffect = def.effect as TowerCardEffect;
    const upgradedEffect = def.upgradedEffect as TowerCardEffect;

    it('exists in CARD_DEFINITIONS', () => {
      expect(def).toBeDefined();
    });
    it('has type TOWER', () => {
      expect(def.type).toBe(CardType.TOWER);
    });
    it('has rarity COMMON', () => {
      expect(def.rarity).toBe(CardRarity.COMMON);
    });
    it('has energyCost 3', () => {
      expect(def.energyCost).toBe(3);
    });
    it('effect.towerType is CHAIN', () => {
      expect(baseEffect.towerType).toBe(TowerType.CHAIN);
    });
    it('effect.statOverrides has chainBounceBonus 1', () => {
      expect(baseEffect.statOverrides).toEqual(jasmine.objectContaining({ chainBounceBonus: 1 }));
    });
    it('upgradedEffect is defined', () => {
      expect(def.upgradedEffect).toBeDefined();
    });
    it('upgradedEffect.towerType is CHAIN', () => {
      expect(upgradedEffect.towerType).toBe(TowerType.CHAIN);
    });
    it('upgradedEffect.statOverrides has chainBounceBonus 2', () => {
      expect(upgradedEffect.statOverrides).toEqual(jasmine.objectContaining({ chainBounceBonus: 2 }));
    });
  });

  describe('TOWER_MORTAR_BARRAGE', () => {
    const def = CARD_DEFINITIONS[CardId.TOWER_MORTAR_BARRAGE];
    const baseEffect = def.effect as TowerCardEffect;
    const upgradedEffect = def.upgradedEffect as TowerCardEffect;

    it('exists in CARD_DEFINITIONS', () => {
      expect(def).toBeDefined();
    });
    it('has type TOWER', () => {
      expect(def.type).toBe(CardType.TOWER);
    });
    it('has rarity COMMON', () => {
      expect(def.rarity).toBe(CardRarity.COMMON);
    });
    it('has energyCost 2', () => {
      expect(def.energyCost).toBe(2);
    });
    it('effect.towerType is MORTAR', () => {
      expect(baseEffect.towerType).toBe(TowerType.MORTAR);
    });
    it('effect.statOverrides has splashRadiusMultiplier 0.7 and dotDamageMultiplier 0.8', () => {
      expect(baseEffect.statOverrides).toEqual(jasmine.objectContaining({
        splashRadiusMultiplier: 0.7,
        dotDamageMultiplier: 0.8,
      }));
    });
    it('upgradedEffect is defined', () => {
      expect(def.upgradedEffect).toBeDefined();
    });
    it('upgradedEffect.towerType is MORTAR', () => {
      expect(upgradedEffect.towerType).toBe(TowerType.MORTAR);
    });
    it('upgradedEffect.statOverrides has splashRadiusMultiplier 0.85 and dotDamageMultiplier 0.9', () => {
      expect(upgradedEffect.statOverrides).toEqual(jasmine.objectContaining({
        splashRadiusMultiplier: 0.85,
        dotDamageMultiplier: 0.9,
      }));
    });
  });

  describe('getStarterDeck', () => {
    // Starter deck was expanded from 10 → 20 cards in M4 S1.
    // Composition: 8×BASIC, 3×SNIPER, 2×SPLASH, 2×SLOW, 1×CHAIN,
    //              1×GOLD_RUSH, 1×DAMAGE_BOOST, 1×DRAW_TWO, 1×ENERGY_SURGE.

    it('returns exactly 20 cards', () => {
      expect(getStarterDeck().length).toBe(20);
    });

    it('contains 8 TOWER_BASIC cards', () => {
      const deck = getStarterDeck();
      const basicCount = deck.filter(id => id === CardId.TOWER_BASIC).length;
      expect(basicCount).toBe(8);
    });

    it('contains 3 TOWER_SNIPER cards', () => {
      const deck = getStarterDeck();
      const sniperCount = deck.filter(id => id === CardId.TOWER_SNIPER).length;
      expect(sniperCount).toBe(3);
    });

    it('contains 2 TOWER_SPLASH, 2 TOWER_SLOW, 1 TOWER_CHAIN, 1 GOLD_RUSH, 1 DAMAGE_BOOST, 1 DRAW_TWO, 1 ENERGY_SURGE', () => {
      const deck = getStarterDeck();
      expect(deck.filter(id => id === CardId.TOWER_SPLASH).length).toBe(2);
      expect(deck.filter(id => id === CardId.TOWER_SLOW).length).toBe(2);
      expect(deck.filter(id => id === CardId.TOWER_CHAIN).length).toBe(1);
      expect(deck.filter(id => id === CardId.GOLD_RUSH).length).toBe(1);
      expect(deck.filter(id => id === CardId.DAMAGE_BOOST).length).toBe(1);
      expect(deck.filter(id => id === CardId.DRAW_TWO).length).toBe(1);
      expect(deck.filter(id => id === CardId.ENERGY_SURGE).length).toBe(1);
    });

    it('all starter deck cards have definitions', () => {
      for (const id of getStarterDeck()) {
        expect(getCardDefinition(id)).toBeDefined();
      }
    });
  });

  // ── Status-applying Spell Cards (Sprint 2b) ──────────────────

  describe('INCINERATE', () => {
    const def = CARD_DEFINITIONS[CardId.INCINERATE];

    it('exists in CARD_DEFINITIONS', () => {
      expect(def).toBeDefined();
    });
    it('has type SPELL, rarity COMMON, energyCost 2', () => {
      expect(def.type).toBe(CardType.SPELL);
      expect(def.rarity).toBe(CardRarity.COMMON);
      expect(def.energyCost).toBe(2);
    });
    it('effect.spellId is "incinerate"', () => {
      expect((def.effect as { spellId: string }).spellId).toBe('incinerate');
    });
    it('upgradedEffect is defined with spellId "incinerate"', () => {
      expect(def.upgradedEffect).toBeDefined();
      expect((def.upgradedEffect as { spellId: string }).spellId).toBe('incinerate');
    });
  });

  describe('TOXIC_SPRAY', () => {
    const def = CARD_DEFINITIONS[CardId.TOXIC_SPRAY];

    it('exists in CARD_DEFINITIONS', () => {
      expect(def).toBeDefined();
    });
    it('has type SPELL, rarity UNCOMMON, energyCost 2', () => {
      expect(def.type).toBe(CardType.SPELL);
      expect(def.rarity).toBe(CardRarity.UNCOMMON);
      expect(def.energyCost).toBe(2);
    });
    it('effect.spellId is "toxic_spray"', () => {
      expect((def.effect as { spellId: string }).spellId).toBe('toxic_spray');
    });
    it('upgradedEffect is defined with spellId "toxic_spray"', () => {
      expect(def.upgradedEffect).toBeDefined();
      expect((def.upgradedEffect as { spellId: string }).spellId).toBe('toxic_spray');
    });
  });

  describe('CRYO_PULSE', () => {
    const def = CARD_DEFINITIONS[CardId.CRYO_PULSE];

    it('exists in CARD_DEFINITIONS', () => {
      expect(def).toBeDefined();
    });
    it('has type SPELL, rarity COMMON, energyCost 1', () => {
      expect(def.type).toBe(CardType.SPELL);
      expect(def.rarity).toBe(CardRarity.COMMON);
      expect(def.energyCost).toBe(1);
    });
    it('effect.spellId is "cryo_pulse" and value is 1 (draw count)', () => {
      expect((def.effect as { spellId: string; value: number }).spellId).toBe('cryo_pulse');
      expect((def.effect as { value: number }).value).toBe(1);
    });
    it('upgradedEffect draws 2 cards (value = 2)', () => {
      expect(def.upgradedEffect).toBeDefined();
      expect((def.upgradedEffect as { value: number }).value).toBe(2);
    });
  });

  // ── Status Payoff Spell Cards (Sprint 2c) ────────────────────

  describe('DETONATE', () => {
    const def = CARD_DEFINITIONS[CardId.DETONATE];

    it('exists in CARD_DEFINITIONS', () => {
      expect(def).toBeDefined();
    });
    it('has type SPELL, rarity COMMON, energyCost 1', () => {
      expect(def.type).toBe(CardType.SPELL);
      expect(def.rarity).toBe(CardRarity.COMMON);
      expect(def.energyCost).toBe(1);
    });
    it('effect.spellId is "detonate" with base damage 25', () => {
      const effect = def.effect as { spellId: string; value: number };
      expect(effect.spellId).toBe('detonate');
      expect(effect.value).toBe(25);
    });
    it('upgradedEffect has damage 35', () => {
      expect(def.upgradedEffect).toBeDefined();
      expect((def.upgradedEffect as { value: number }).value).toBe(35);
    });
  });

  describe('EPIDEMIC', () => {
    const def = CARD_DEFINITIONS[CardId.EPIDEMIC];

    it('exists in CARD_DEFINITIONS', () => {
      expect(def).toBeDefined();
    });
    it('has type SPELL, rarity COMMON, energyCost 2', () => {
      expect(def.type).toBe(CardType.SPELL);
      expect(def.rarity).toBe(CardRarity.COMMON);
      expect(def.energyCost).toBe(2);
    });
    it('effect.spellId is "epidemic" with criticalMass 2', () => {
      const effect = def.effect as { spellId: string; value: number };
      expect(effect.spellId).toBe('epidemic');
      expect(effect.value).toBe(2);
    });
    it('upgradedEffect has criticalMass 1 (lower threshold)', () => {
      expect(def.upgradedEffect).toBeDefined();
      expect((def.upgradedEffect as { value: number }).value).toBe(1);
    });
  });

  // ── getActiveTowerEffect ──────────────────────────────────────

  describe('getActiveTowerEffect', () => {
    function makeInstance(cardId: CardId, upgraded = false): CardInstance {
      return { cardId, upgraded, instanceId: 'test-instance' };
    }

    it('returns base effect for a non-upgraded tower card', () => {
      const instance = makeInstance(CardId.TOWER_BASIC, false);
      const result = getActiveTowerEffect(instance);
      expect(result).toBeDefined();
      expect(result!.type).toBe('tower');
      expect(result!.towerType).toBe(TowerType.BASIC);
    });

    it('returns upgradedEffect for an upgraded tower card that has upgradedEffect', () => {
      // TOWER_BASIC_REINFORCED upgradedEffect has damageMultiplier 1.2
      const instance = makeInstance(CardId.TOWER_BASIC_REINFORCED, true);
      const result = getActiveTowerEffect(instance);
      expect(result).toBeDefined();
      expect(result!.statOverrides?.damageMultiplier).toBe(1.2);
      // The upgraded path should NOT match the base effect (which has no statOverrides)
      expect(result!.statOverrides).toBeDefined();
    });

    it('falls back to base effect when upgraded=false (base path always taken)', () => {
      // upgraded=false → always returns base effect regardless of upgradedEffect presence.
      // The branch is: (card.upgraded && def.upgradedEffect) ? upgraded : base.
      const instance = makeInstance(CardId.TOWER_SNIPER_LIGHT, false);
      const result = getActiveTowerEffect(instance);
      expect(result).toBeDefined();
      // Base TOWER_SNIPER_LIGHT has damageMultiplier 0.7 (light sniper penalty)
      expect(result!.statOverrides?.damageMultiplier).toBeLessThan(1);
    });

    it('returns undefined for a non-tower card (GOLD_RUSH, not upgraded)', () => {
      const instance = makeInstance(CardId.GOLD_RUSH, false);
      const result = getActiveTowerEffect(instance);
      expect(result).toBeUndefined();
    });

    it('returns undefined for a non-tower card even when upgraded=true', () => {
      const instance = makeInstance(CardId.GOLD_RUSH, true);
      const result = getActiveTowerEffect(instance);
      expect(result).toBeUndefined();
    });
  });

  // ── Phase 2 Sprint 13 — Cartographer archetype tagging ─────────────────────
  describe('archetype tagging', () => {
    it('SCOUT_AHEAD is tagged as cartographer', () => {
      // Retagged in sprint 13 — SCOUT_AHEAD's intel-reveal mechanic aligns
      // with the Cartographer identity (reshape + reveal the battlefield).
      // This means cartographer-dominant decks get more scouts offered.
      expect(CARD_DEFINITIONS[CardId.SCOUT_AHEAD].archetype).toBe('cartographer');
    });

    it('SCOUT_AHEAD does NOT carry the terraform flag (reveals, does not mutate tiles)', () => {
      expect(CARD_DEFINITIONS[CardId.SCOUT_AHEAD].terraform).toBeFalsy();
    });

    it('SCOUT_ELITE stays neutral (uncommon+innate tier retains neutral identity)', () => {
      // SCOUT_ELITE is an innate keyword card, not a Cartographer-identity
      // card. Keep neutral so innate-deck builds don't auto-lean Cartographer.
      expect(CARD_DEFINITIONS[CardId.SCOUT_ELITE].archetype ?? 'neutral').toBe('neutral');
    });
  });

  // ── Phase 2 Sprints 11/12/16 — Cartographer terraform cards ────────────────
  describe('Cartographer terraform cards', () => {
    describe('LAY_TILE (sprint 11)', () => {
      const def = CARD_DEFINITIONS[CardId.LAY_TILE];

      it('exists', () => {
        expect(def).toBeDefined();
      });
      it('is tagged as cartographer', () => {
        expect(def.archetype).toBe('cartographer');
      });
      it('carries the terraform keyword', () => {
        expect(def.terraform).toBeTrue();
      });
      it('costs 1 energy (common)', () => {
        expect(def.energyCost).toBe(1);
        expect(def.rarity).toBe(CardRarity.COMMON);
      });
      it('has a terraform_target effect with op=build, duration=null (permanent)', () => {
        expect(def.effect.type).toBe('terraform_target');
        if (def.effect.type === 'terraform_target') {
          expect(def.effect.op).toBe('build');
          expect(def.effect.duration).toBeNull();
        }
      });

      it('upgraded effect carries drawOnSuccess = 1 (cycle-card behavior)', () => {
        expect(def.upgradedEffect?.type).toBe('terraform_target');
        if (def.upgradedEffect?.type === 'terraform_target') {
          expect(def.upgradedEffect.drawOnSuccess).toBe(1);
          expect(def.upgradedEffect.op).toBe('build');
          expect(def.upgradedEffect.duration).toBeNull();
        }
      });

      it('base effect does NOT carry drawOnSuccess (only upgraded cycles)', () => {
        if (def.effect.type === 'terraform_target') {
          expect(def.effect.drawOnSuccess).toBeUndefined();
        }
      });

      it('upgraded description mentions the draw', () => {
        expect(def.upgradedDescription).toMatch(/draw 1 card/i);
      });
    });

    describe('BLOCK_PASSAGE (sprint 12)', () => {
      const def = CARD_DEFINITIONS[CardId.BLOCK_PASSAGE];

      it('exists', () => {
        expect(def).toBeDefined();
      });
      it('is tagged as cartographer with terraform keyword', () => {
        expect(def.archetype).toBe('cartographer');
        expect(def.terraform).toBeTrue();
      });
      it('costs 1 energy (common)', () => {
        expect(def.energyCost).toBe(1);
        expect(def.rarity).toBe(CardRarity.COMMON);
      });
      it('has a terraform_target effect with op=block, duration=2', () => {
        expect(def.effect.type).toBe('terraform_target');
        if (def.effect.type === 'terraform_target') {
          expect(def.effect.op).toBe('block');
          expect(def.effect.duration).toBe(2);
        }
      });
      it('upgraded effect extends duration to 3', () => {
        expect(def.upgradedEffect?.type).toBe('terraform_target');
        if (def.upgradedEffect?.type === 'terraform_target') {
          expect(def.upgradedEffect.duration).toBe(3);
        }
      });
    });

    describe('BRIDGEHEAD (sprint 15)', () => {
      const def = CARD_DEFINITIONS[CardId.BRIDGEHEAD];

      it('exists', () => {
        expect(def).toBeDefined();
      });
      it('is tagged as cartographer with terraform keyword', () => {
        expect(def.archetype).toBe('cartographer');
        expect(def.terraform).toBeTrue();
      });
      it('costs 2 energy (uncommon)', () => {
        expect(def.energyCost).toBe(2);
        expect(def.rarity).toBe(CardRarity.UNCOMMON);
      });
      it('has a terraform_target effect with op=bridgehead, duration=3', () => {
        expect(def.effect.type).toBe('terraform_target');
        if (def.effect.type === 'terraform_target') {
          expect(def.effect.op).toBe('bridgehead');
          expect(def.effect.duration).toBe(3);
        }
      });
      it('upgraded effect extends duration to 4', () => {
        expect(def.upgradedEffect?.type).toBe('terraform_target');
        if (def.upgradedEffect?.type === 'terraform_target') {
          expect(def.upgradedEffect.duration).toBe(4);
        }
      });
    });

    describe('COLLAPSE (sprint 16)', () => {
      const def = CARD_DEFINITIONS[CardId.COLLAPSE];

      it('exists', () => {
        expect(def).toBeDefined();
      });
      it('is tagged as cartographer with terraform keyword', () => {
        expect(def.archetype).toBe('cartographer');
        expect(def.terraform).toBeTrue();
      });
      it('costs 2 energy (uncommon)', () => {
        expect(def.energyCost).toBe(2);
        expect(def.rarity).toBe(CardRarity.UNCOMMON);
      });
      it('has a terraform_target effect with op=destroy, permanent', () => {
        expect(def.effect.type).toBe('terraform_target');
        if (def.effect.type === 'terraform_target') {
          expect(def.effect.op).toBe('destroy');
          expect(def.effect.duration).toBeNull();
        }
      });
      it('deals 50% max-HP damage on hit (base)', () => {
        if (def.effect.type === 'terraform_target') {
          expect(def.effect.damageOnHit?.pctMaxHp).toBe(0.5);
        }
      });
      it('deals 75% max-HP damage when upgraded', () => {
        if (def.upgradedEffect?.type === 'terraform_target') {
          expect(def.upgradedEffect.damageOnHit?.pctMaxHp).toBe(0.75);
        }
      });
    });

    describe('DETOUR (Sprint 14)', () => {
      const def = CARD_DEFINITIONS[CardId.DETOUR];

      it('exists in CARD_DEFINITIONS', () => {
        expect(def).toBeDefined();
      });

      it('is tagged archetype: cartographer', () => {
        expect(def.archetype).toBe('cartographer');
      });

      it('terraform is explicitly false — DETOUR is NOT a tile-state card', () => {
        expect(def.terraform).toBe(false);
      });

      it('costs 2 energy and is UNCOMMON', () => {
        expect(def.energyCost).toBe(2);
        expect(def.rarity).toBe(CardRarity.UNCOMMON);
      });

      it('has type SPELL', () => {
        expect(def.type).toBe(CardType.SPELL);
      });

      it('effect is { type: spell, spellId: detour, value: 1 }', () => {
        expect(def.effect).toEqual({ type: 'spell', spellId: 'detour', value: 1 });
      });

      it('upgradedEffect uses value 2 (damage tier sentinel)', () => {
        expect(def.upgradedEffect).toEqual({ type: 'spell', spellId: 'detour', value: 2 });
      });

      it('upgradedDescription mentions the max-HP damage per extra step', () => {
        expect(def.upgradedDescription).toMatch(/8%.*max HP/i);
      });
    });

    // ── Phase 2 Sprints 17/18 — Cartographer rare anchors ──────────────────
    describe('CARTOGRAPHER_SEAL (Sprint 17)', () => {
      const def = CARD_DEFINITIONS[CardId.CARTOGRAPHER_SEAL];

      it('exists', () => {
        expect(def).toBeDefined();
      });
      it('is a rare cartographer MODIFIER card', () => {
        expect(def.type).toBe(CardType.MODIFIER);
        expect(def.rarity).toBe(CardRarity.RARE);
        expect(def.archetype).toBe('cartographer');
      });
      it('has NO terraform flag (the card changes rules for terraform cards; it does not terraform itself)', () => {
        expect(def.terraform).toBe(false);
      });
      it('costs 2 energy', () => {
        expect(def.energyCost).toBe(2);
      });
      it('uses stat TERRAFORM_ANCHOR with duration = null (encounter-scoped)', () => {
        if (def.effect.type === 'modifier') {
          expect(def.effect.stat).toBe('terraformAnchor');
          expect(def.effect.duration).toBeNull();
        } else {
          fail('effect is not a modifier');
        }
      });

      it('base value is 1 (anchor-only tier)', () => {
        if (def.effect.type === 'modifier') {
          expect(def.effect.value).toBe(1);
        } else {
          fail('effect is not a modifier');
        }
      });

      it('upgraded value is 2 (anchor + refund tier sentinel)', () => {
        if (def.upgradedEffect && def.upgradedEffect.type === 'modifier') {
          expect(def.upgradedEffect.value).toBe(2);
          expect(def.upgradedEffect.stat).toBe('terraformAnchor');
          expect(def.upgradedEffect.duration).toBeNull();
        } else {
          fail('upgradedEffect is not a modifier');
        }
      });

      it('upgraded description mentions the 1-energy refund each turn', () => {
        expect(def.upgradedDescription).toMatch(/refunds? 1 energy/i);
      });
    });

    describe('LABYRINTH_MIND (Sprint 18)', () => {
      const def = CARD_DEFINITIONS[CardId.LABYRINTH_MIND];

      it('exists', () => {
        expect(def).toBeDefined();
      });
      it('is a rare cartographer MODIFIER card', () => {
        expect(def.type).toBe(CardType.MODIFIER);
        expect(def.rarity).toBe(CardRarity.RARE);
        expect(def.archetype).toBe('cartographer');
      });
      it('costs 2 energy', () => {
        expect(def.energyCost).toBe(2);
      });
      it('uses stat LABYRINTH_MIND with duration = null (encounter-scoped)', () => {
        if (def.effect.type === 'modifier') {
          expect(def.effect.stat).toBe('labyrinthMind');
          expect(def.effect.duration).toBeNull();
        } else {
          fail('effect is not a modifier');
        }
      });
      it('base scaling is 2% per path tile', () => {
        if (def.effect.type === 'modifier') {
          expect(def.effect.value).toBeCloseTo(0.02, 5);
        }
      });
      it('upgraded scaling is 3% per path tile', () => {
        if (def.upgradedEffect?.type === 'modifier') {
          expect(def.upgradedEffect.value).toBeCloseTo(0.03, 5);
        }
      });
    });
  });

  // ── Phase 3 Sprints 30/31/32 — Highground uncommon cards ───────────────────
  describe('Highground uncommon cards (sprints 30/31/32)', () => {

    describe('CLIFFSIDE (Sprint 30)', () => {
      const def = CARD_DEFINITIONS[CardId.CLIFFSIDE];

      it('exists in CARD_DEFINITIONS', () => {
        expect(def).toBeDefined();
      });

      it('is an UNCOMMON highground SPELL card with terraform flag', () => {
        expect(def.type).toBe(CardType.SPELL);
        expect(def.rarity).toBe(CardRarity.UNCOMMON);
        expect(def.archetype).toBe('highground');
        expect(def.terraform).toBe(true);
      });

      it('costs 2 energy', () => {
        expect(def.energyCost).toBe(2);
      });

      it('has elevation_target op=raise effect', () => {
        expect(def.effect.type).toBe('elevation_target');
        const effect = def.effect as ElevationTargetCardEffect;
        expect(effect.op).toBe('raise');
        expect(effect.amount).toBe(1);
        expect(effect.duration).toBeNull();
      });

      it('base effect has horizontal line length 3', () => {
        const effect = def.effect as ElevationTargetCardEffect;
        expect(effect.line).toBeDefined();
        expect(effect.line!.direction).toBe('horizontal');
        expect(effect.line!.length).toBe(3);
      });

      it('upgraded effect has horizontal line length 5', () => {
        const upgraded = def.upgradedEffect as ElevationTargetCardEffect;
        expect(upgraded.line).toBeDefined();
        expect(upgraded.line!.direction).toBe('horizontal');
        expect(upgraded.line!.length).toBe(5);
      });

      it('has upgradedDescription defined', () => {
        expect(def.upgradedDescription?.trim().length).toBeGreaterThan(0);
      });
    });

    describe('VANTAGE_POINT (Sprint 31)', () => {
      const def = CARD_DEFINITIONS[CardId.VANTAGE_POINT];

      it('exists in CARD_DEFINITIONS', () => {
        expect(def).toBeDefined();
      });

      it('is an UNCOMMON highground MODIFIER card', () => {
        expect(def.type).toBe(CardType.MODIFIER);
        expect(def.rarity).toBe(CardRarity.UNCOMMON);
        expect(def.archetype).toBe('highground');
      });

      it('costs 2 energy', () => {
        expect(def.energyCost).toBe(2);
      });

      it('does NOT carry terraform flag (reads elevation, does not mutate tiles)', () => {
        expect(def.terraform).toBe(false);
      });

      it('has a modifier effect with stat = vantagePointDamageBonus', () => {
        expect(def.effect.type).toBe('modifier');
        const effect = def.effect as ModifierCardEffect;
        expect(effect.stat).toBe(MODIFIER_STAT.VANTAGE_POINT_DAMAGE_BONUS);
      });

      it('base value is 0.5 (+50% damage bonus)', () => {
        const effect = def.effect as ModifierCardEffect;
        expect(effect.value).toBeCloseTo(0.5, 5);
      });

      it('base duration is 1 wave (mirrors HIGH_PERCH pattern)', () => {
        const effect = def.effect as ModifierCardEffect;
        expect(effect.duration).toBe(1);
      });

      it('upgraded value is 0.75 (+75% damage bonus)', () => {
        const upgraded = def.upgradedEffect as ModifierCardEffect;
        expect(upgraded.value).toBeCloseTo(0.75, 5);
      });

      it('upgraded duration is still 1 wave', () => {
        const upgraded = def.upgradedEffect as ModifierCardEffect;
        expect(upgraded.duration).toBe(1);
      });

      it('has upgradedDescription defined', () => {
        expect(def.upgradedDescription?.trim().length).toBeGreaterThan(0);
      });
    });

    describe('AVALANCHE_ORDER (Sprint 32)', () => {
      const def = CARD_DEFINITIONS[CardId.AVALANCHE_ORDER];

      it('exists in CARD_DEFINITIONS', () => {
        expect(def).toBeDefined();
      });

      it('is an UNCOMMON highground SPELL card with terraform flag', () => {
        expect(def.type).toBe(CardType.SPELL);
        expect(def.rarity).toBe(CardRarity.UNCOMMON);
        expect(def.archetype).toBe('highground');
        expect(def.terraform).toBe(true);
      });

      it('costs 2 energy', () => {
        expect(def.energyCost).toBe(2);
      });

      it('has elevation_target op=collapse effect', () => {
        expect(def.effect.type).toBe('elevation_target');
        const effect = def.effect as ElevationTargetCardEffect;
        expect(effect.op).toBe('collapse');
        expect(effect.duration).toBeNull();
      });

      it('base damageOnHit.damagePerElevation is 10', () => {
        const effect = def.effect as ElevationTargetCardEffect;
        expect(effect.damageOnHit).toBeDefined();
        expect(effect.damageOnHit!.damagePerElevation).toBe(10);
      });

      it('upgraded damageOnHit.damagePerElevation is 15', () => {
        const upgraded = def.upgradedEffect as ElevationTargetCardEffect;
        expect(upgraded.damageOnHit).toBeDefined();
        expect(upgraded.damageOnHit!.damagePerElevation).toBe(15);
      });

      it('has upgradedDescription defined', () => {
        expect(def.upgradedDescription?.trim().length).toBeGreaterThan(0);
      });
    });
  });

  // ── Phase 3 Sprint 29 — Highground modifier cards ───────────────────────────
  describe('Highground modifier cards', () => {
    describe('HIGH_PERCH (Sprint 29)', () => {
      const def = CARD_DEFINITIONS[CardId.HIGH_PERCH];

      it('exists in CARD_DEFINITIONS', () => {
        expect(def).toBeDefined();
      });

      it('is a COMMON highground MODIFIER card', () => {
        expect(def.type).toBe(CardType.MODIFIER);
        expect(def.rarity).toBe(CardRarity.COMMON);
        expect(def.archetype).toBe('highground');
      });

      it('costs 1 energy (common modifier cost curve)', () => {
        expect(def.energyCost).toBe(1);
      });

      it('does NOT carry the terraform flag (reads elevation, does not mutate tiles)', () => {
        expect(def.terraform).toBe(false);
      });

      it('has a modifier effect with stat = highPerchRangeBonus', () => {
        expect(def.effect.type).toBe('modifier');
        const effect = def.effect as ModifierCardEffect;
        expect(effect.stat).toBe('highPerchRangeBonus');
      });

      it('base value is 0.25 (+25% range bonus)', () => {
        const effect = def.effect as ModifierCardEffect;
        expect(effect.value).toBeCloseTo(0.25, 5);
      });

      it('base duration is 1 wave', () => {
        const effect = def.effect as ModifierCardEffect;
        expect(effect.duration).toBe(1);
      });

      it('has an upgradedEffect defined', () => {
        expect(def.upgradedEffect).toBeDefined();
      });

      it('upgraded value is 0.4 (+40% range bonus)', () => {
        const upgraded = def.upgradedEffect as ModifierCardEffect;
        expect(upgraded.value).toBeCloseTo(0.4, 5);
      });

      it('upgraded duration is still 1 wave', () => {
        const upgraded = def.upgradedEffect as ModifierCardEffect;
        expect(upgraded.duration).toBe(1);
      });

      it('upgradedDescription is defined and non-empty', () => {
        expect(def.upgradedDescription).toBeDefined();
        expect(def.upgradedDescription!.trim().length).toBeGreaterThan(0);
      });
    });
  });

  // ── Phase 3 Sprints 33/34 — Highground rare cards ───────────────────────
  describe('Highground rare cards', () => {
    describe('KING_OF_THE_HILL (Sprint 33)', () => {
      const def = CARD_DEFINITIONS[CardId.KING_OF_THE_HILL];

      it('exists in CARD_DEFINITIONS', () => {
        expect(def).toBeDefined();
      });

      it('is a RARE highground MODIFIER card', () => {
        expect(def.type).toBe(CardType.MODIFIER);
        expect(def.rarity).toBe(CardRarity.RARE);
        expect(def.archetype).toBe('highground');
      });

      it('costs 3 energy (rare cost curve)', () => {
        expect(def.energyCost).toBe(3);
      });

      it('does NOT carry the terraform flag (reads elevation, does not mutate tiles)', () => {
        expect(def.terraform).toBe(false);
      });

      it('has a modifier effect with stat = kingOfTheHillDamageBonus', () => {
        expect(def.effect.type).toBe('modifier');
        const effect = def.effect as ModifierCardEffect;
        expect(effect.stat).toBe(MODIFIER_STAT.KING_OF_THE_HILL_DAMAGE_BONUS);
      });

      it('base value is 1.0 (+100% damage bonus)', () => {
        const effect = def.effect as ModifierCardEffect;
        expect(effect.value).toBeCloseTo(1.0, 5);
      });

      it('base duration is null (encounter-scoped)', () => {
        const effect = def.effect as ModifierCardEffect;
        expect(effect.duration).toBeNull();
      });

      it('upgraded value is 1.5 (+150% damage bonus)', () => {
        const upgraded = def.upgradedEffect as ModifierCardEffect;
        expect(upgraded.value).toBeCloseTo(1.5, 5);
      });

      it('upgraded duration is still null (encounter-scoped)', () => {
        const upgraded = def.upgradedEffect as ModifierCardEffect;
        expect(upgraded.duration).toBeNull();
      });

      it('has upgradedDescription defined and non-empty', () => {
        expect(def.upgradedDescription?.trim().length).toBeGreaterThan(0);
      });
    });

    describe('GRAVITY_WELL (Sprint 34)', () => {
      const def = CARD_DEFINITIONS[CardId.GRAVITY_WELL];

      it('exists in CARD_DEFINITIONS', () => {
        expect(def).toBeDefined();
      });

      it('is a RARE highground MODIFIER card', () => {
        expect(def.type).toBe(CardType.MODIFIER);
        expect(def.rarity).toBe(CardRarity.RARE);
        expect(def.archetype).toBe('highground');
      });

      it('costs 3 energy (rare cost curve)', () => {
        expect(def.energyCost).toBe(3);
      });

      it('does NOT carry the terraform flag (reads elevation, does not mutate tiles)', () => {
        expect(def.terraform).toBe(false);
      });

      it('has a modifier effect with stat = gravityWell', () => {
        expect(def.effect.type).toBe('modifier');
        const effect = def.effect as ModifierCardEffect;
        expect(effect.stat).toBe(MODIFIER_STAT.GRAVITY_WELL);
      });

      it('base value is 1 (gate-only tier)', () => {
        const effect = def.effect as ModifierCardEffect;
        expect(effect.value).toBe(1);
      });

      it('base duration is null (encounter-scoped)', () => {
        const effect = def.effect as ModifierCardEffect;
        expect(effect.duration).toBeNull();
      });

      it('upgraded value is 2 (gate + bleed tier)', () => {
        const upgraded = def.upgradedEffect as ModifierCardEffect;
        expect(upgraded.value).toBe(2);
      });

      it('upgraded duration is still null (encounter-scoped)', () => {
        const upgraded = def.upgradedEffect as ModifierCardEffect;
        expect(upgraded.duration).toBeNull();
      });

      it('upgraded description mentions the max-HP bleed', () => {
        expect(def.upgradedDescription).toMatch(/10%.*max HP/i);
      });

      it('has upgradedDescription defined and non-empty', () => {
        expect(def.upgradedDescription?.trim().length).toBeGreaterThan(0);
      });
    });
  });

  // ── Sprint 35 — Starter deck neutrality check ───────────────────────────
  describe('Sprint 35 — starter deck neutrality check', () => {
    it('getStarterDeck() does not contain KING_OF_THE_HILL or GRAVITY_WELL (starter is neutral)', () => {
      const starterIds = new Set(getStarterDeck());
      expect(starterIds.has(CardId.KING_OF_THE_HILL)).toBeFalse();
      expect(starterIds.has(CardId.GRAVITY_WELL)).toBeFalse();
    });
  });

  // ── getEffectiveEnergyCost — upgrade cost reduction ─────────────────────
  describe('getEffectiveEnergyCost', () => {
    it('returns base cost when the card instance is not upgraded', () => {
      const instance: CardInstance = { instanceId: 'c1', cardId: CardId.ARCHITECT, upgraded: false };
      expect(getEffectiveEnergyCost(instance)).toBe(3);
    });

    it('returns upgradedEnergyCost when the card instance IS upgraded and field is set (ARCHITECT)', () => {
      const instance: CardInstance = { instanceId: 'c1', cardId: CardId.ARCHITECT, upgraded: true };
      expect(getEffectiveEnergyCost(instance)).toBe(2);
    });

    it('falls back to base cost when upgraded but no upgradedEnergyCost field is set (LAY_TILE)', () => {
      const instance: CardInstance = { instanceId: 'c1', cardId: CardId.LAY_TILE, upgraded: true };
      // LAY_TILE upgrade uses drawOnSuccess, not cost reduction — upgradedEnergyCost undefined.
      expect(getEffectiveEnergyCost(instance)).toBe(1);
    });
  });

  // ── CONDUIT_BRIDGE (Sprint 48) — session-5 full revert ──────────────────
  describe('CONDUIT_BRIDGE (sprint 48)', () => {
    const def = CARD_DEFINITIONS[CardId.CONDUIT_BRIDGE];

    it('base duration is 3 turns (session-5 full revert from 5 → 3)', () => {
      if (def.effect.type === 'utility') {
        expect(def.effect.value).toBe(3);
      } else {
        fail('effect is not a utility');
      }
    });

    it('upgraded duration is 4 turns (session-5 full revert from 7 → 4)', () => {
      if (def.upgradedEffect?.type === 'utility') {
        expect(def.upgradedEffect.value).toBe(4);
      } else {
        fail('upgradedEffect is not a utility');
      }
    });

    it('description mentions 3 turns', () => {
      expect(def.description).toMatch(/3 turns/);
    });

    it('upgraded description mentions 4 turns', () => {
      expect(def.upgradedDescription).toMatch(/4 turns/);
    });
  });

  // ── HANDSHAKE (Sprint 43) — session-5 balance bump ──────────────────────
  describe('HANDSHAKE (sprint 43)', () => {
    const def = CARD_DEFINITIONS[CardId.HANDSHAKE];

    it('base damage bonus is 20% (session-5 bump from 15%)', () => {
      if (def.effect.type === 'modifier') {
        expect(def.effect.value).toBeCloseTo(0.20, 5);
      } else {
        fail('effect is not a modifier');
      }
    });

    it('upgraded damage bonus is 30% (session-5 bump from 25%)', () => {
      if (def.upgradedEffect?.type === 'modifier') {
        expect(def.upgradedEffect.value).toBeCloseTo(0.30, 5);
      } else {
        fail('upgradedEffect is not a modifier');
      }
    });

    it('description mentions +20% damage', () => {
      expect(def.description).toMatch(/\+20%/);
    });

    it('upgraded description mentions +30% damage', () => {
      expect(def.upgradedDescription).toMatch(/\+30%/);
    });
  });

  // ── FORMATION (Sprint 44) — session-5 balance bump ──────────────────────
  describe('FORMATION (sprint 44)', () => {
    const def = CARD_DEFINITIONS[CardId.FORMATION];

    it('base range additive is 2 (session-5 bump from 1)', () => {
      if (def.effect.type === 'modifier') {
        expect(def.effect.value).toBe(2);
      } else {
        fail('effect is not a modifier');
      }
    });

    it('upgraded range additive is 3 (session-5 bump from 2)', () => {
      if (def.upgradedEffect?.type === 'modifier') {
        expect(def.upgradedEffect.value).toBe(3);
      } else {
        fail('upgradedEffect is not a modifier');
      }
    });

    it('description mentions +2 range (base)', () => {
      expect(def.description).toMatch(/\+2 range/);
    });

    it('upgraded description mentions +3 range', () => {
      expect(def.upgradedDescription).toMatch(/\+3 range/);
    });
  });

  // ── HIVE_MIND (Sprint 50) — secondary-stat sharing upgrade ──────────────
  describe('HIVE_MIND (sprint 50)', () => {
    const def = CARD_DEFINITIONS[CardId.HIVE_MIND];

    it('exists as a rare conduit MODIFIER card', () => {
      expect(def).toBeDefined();
      expect(def.type).toBe(CardType.MODIFIER);
      expect(def.rarity).toBe(CardRarity.RARE);
      expect(def.archetype).toBe('conduit');
    });

    it('base effect value is 1 (tier sentinel: damage + range sharing)', () => {
      if (def.effect.type === 'modifier') {
        expect(def.effect.value).toBe(1);
        expect(def.effect.stat).toBe('hiveMindClusterMax');
      } else {
        fail('effect is not a modifier');
      }
    });

    it('upgraded effect value is 2 (tier sentinel: +secondary sharing)', () => {
      if (def.upgradedEffect?.type === 'modifier') {
        expect(def.upgradedEffect.value).toBe(2);
        expect(def.upgradedEffect.stat).toBe('hiveMindClusterMax');
      } else {
        fail('upgradedEffect is not a modifier');
      }
    });

    it('upgraded description mentions the secondary effect', () => {
      expect(def.upgradedDescription).toMatch(/secondary|splash|chain|status/i);
    });

    it('does NOT change cost on upgrade (stays at 3E — secondary sharing IS the upgrade identity)', () => {
      expect(def.energyCost).toBe(3);
      expect(def.upgradedEnergyCost).toBeUndefined();
    });
  });

  // ── ARCHITECT (Sprint 49) — cost-reduction upgrade ──────────────────────
  describe('ARCHITECT (sprint 49)', () => {
    const def = CARD_DEFINITIONS[CardId.ARCHITECT];

    it('exists as a rare conduit MODIFIER card', () => {
      expect(def).toBeDefined();
      expect(def.type).toBe(CardType.MODIFIER);
      expect(def.rarity).toBe(CardRarity.RARE);
      expect(def.archetype).toBe('conduit');
    });

    it('base costs 3 energy', () => {
      expect(def.energyCost).toBe(3);
    });

    it('upgrade reduces cost to 2 energy via upgradedEnergyCost', () => {
      expect(def.upgradedEnergyCost).toBe(2);
    });

    it('upgraded description mentions the 2-energy cost', () => {
      expect(def.upgradedDescription).toMatch(/2 energy/i);
    });

    it('upgraded effect is structurally identical to base (cost-only upgrade)', () => {
      if (def.effect.type === 'modifier' && def.upgradedEffect?.type === 'modifier') {
        expect(def.upgradedEffect.stat).toBe(def.effect.stat);
        expect(def.upgradedEffect.value).toBe(def.effect.value);
        expect(def.upgradedEffect.duration).toBe(def.effect.duration);
      } else {
        fail('ARCHITECT effect or upgradedEffect is not a modifier');
      }
    });
  });

  // ── flavorText — Phase G writing pass ───────────────────────────────────
  describe('flavorText', () => {
    it('is present on every card', () => {
      Object.entries(CARD_DEFINITIONS).forEach(([id, def]) => {
        expect(def.flavorText).withContext(id).toBeTruthy();
      });
    });

    it('is at most 80 chars', () => {
      Object.entries(CARD_DEFINITIONS).forEach(([id, def]) => {
        expect(def.flavorText!.length).withContext(id).toBeLessThanOrEqual(80);
      });
    });

    it('no flavorText is empty string (use undefined to omit, not empty)', () => {
      for (const def of Object.values(CARD_DEFINITIONS)) {
        if (def.flavorText !== undefined) {
          expect(def.flavorText.trim().length).toBeGreaterThan(
            0,
            `${def.id} has an empty flavorText — use undefined instead`,
          );
        }
      }
    });

    // Smoke: spot-check specific lines render exactly as written
    it('TOWER_BASIC flavor matches expected text', () => {
      expect(CARD_DEFINITIONS[CardId.TOWER_BASIC].flavorText)
        .toBe("Cheap. Reliable. Fires at whatever's closest.");
    });

    it('PHANTOM_GOLD flavor matches expected text', () => {
      expect(CARD_DEFINITIONS[CardId.PHANTOM_GOLD].flavorText)
        .toBe('Spend it before it forgets to exist.');
    });

    it('CARTOGRAPHER_SEAL flavor matches expected text', () => {
      expect(CARD_DEFINITIONS[CardId.CARTOGRAPHER_SEAL].flavorText)
        .toBe('Every mark on this map stays.');
    });

    it('HIVE_MIND flavor matches expected text', () => {
      expect(CARD_DEFINITIONS[CardId.HIVE_MIND].flavorText)
        .toBe('The strongest node defines what every node becomes.');
    });

    it('KING_OF_THE_HILL flavor matches expected text', () => {
      expect(CARD_DEFINITIONS[CardId.KING_OF_THE_HILL].flavorText)
        .toBe('The peak answers to one tower. Make it worth it.');
    });

    it('WAR_FUND flavor matches expected text', () => {
      expect(CARD_DEFINITIONS[CardId.WAR_FUND].flavorText)
        .toBe('Held coin gathers no rust.');
    });
  });
});
