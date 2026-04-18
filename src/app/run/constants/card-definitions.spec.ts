import {
  CARD_DEFINITIONS,
  getActiveTowerEffect,
  getCardDefinition,
  getCardsByRarity,
  getCardsByType,
  getStarterDeck,
} from './card-definitions';
import { CardId, CardInstance, CardRarity, CardType, TowerCardEffect } from '../models/card.model';
import { TowerType } from '../../game/game-board/models/tower.model';

describe('CARD_DEFINITIONS', () => {
  it('has exactly 56 cards', () => {
    expect(Object.keys(CARD_DEFINITIONS).length).toBe(56);
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

    it('has 26 spell cards (16 original + 3 status-applying + 2 status payoff + 4 Cartographer terraform + 1 DETOUR)', () => {
      expect(getCardsByType(CardType.SPELL).length).toBe(26);
    });

    it('has 12 modifier cards', () => {
      expect(getCardsByType(CardType.MODIFIER).length).toBe(12);
    });

    it('has 6 utility cards', () => {
      expect(getCardsByType(CardType.UTILITY).length).toBe(6);
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

      it('upgradedEffect matches base effect (no upgrade change for Sprint 14)', () => {
        expect(def.upgradedEffect).toEqual({ type: 'spell', spellId: 'detour', value: 1 });
      });
    });
  });
});
