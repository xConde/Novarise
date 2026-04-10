import {
  CARD_DEFINITIONS,
  getCardDefinition,
  getCardsByRarity,
  getCardsByType,
  getStarterDeck,
} from './card-definitions';
import { CardId, CardRarity, CardType } from '../models/card.model';

describe('CARD_DEFINITIONS', () => {
  it('has exactly 25 cards', () => {
    expect(Object.keys(CARD_DEFINITIONS).length).toBe(25);
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
    it('has 6 tower cards', () => {
      expect(getCardsByType(CardType.TOWER).length).toBe(6);
    });

    it('has 8 spell cards', () => {
      expect(getCardsByType(CardType.SPELL).length).toBe(8);
    });

    it('has 8 modifier cards', () => {
      expect(getCardsByType(CardType.MODIFIER).length).toBe(8);
    });

    it('has 3 utility cards', () => {
      expect(getCardsByType(CardType.UTILITY).length).toBe(3);
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

  describe('tower cards are STARTER rarity', () => {
    it('all tower cards have STARTER rarity', () => {
      for (const def of getCardsByType(CardType.TOWER)) {
        expect(def.rarity).toBe(CardRarity.STARTER, `${def.id} is not STARTER`);
      }
    });
  });

  describe('getCardsByRarity', () => {
    it('returns only cards of the requested rarity', () => {
      const commons = getCardsByRarity(CardRarity.COMMON);
      expect(commons.every(c => c.rarity === CardRarity.COMMON)).toBe(true);
    });

    it('returns starter cards when queried by STARTER', () => {
      const starters = getCardsByRarity(CardRarity.STARTER);
      expect(starters.length).toBe(6);
    });
  });

  describe('getCardDefinition', () => {
    it('returns the correct definition by id', () => {
      const def = getCardDefinition(CardId.GOLD_RUSH);
      expect(def.id).toBe(CardId.GOLD_RUSH);
      expect(def.type).toBe(CardType.SPELL);
    });
  });

  describe('getStarterDeck', () => {
    it('returns exactly 10 cards', () => {
      expect(getStarterDeck().length).toBe(10);
    });

    it('contains 4 TOWER_BASIC cards', () => {
      const deck = getStarterDeck();
      const basicCount = deck.filter(id => id === CardId.TOWER_BASIC).length;
      expect(basicCount).toBe(4);
    });

    it('contains 2 TOWER_SNIPER cards', () => {
      const deck = getStarterDeck();
      const sniperCount = deck.filter(id => id === CardId.TOWER_SNIPER).length;
      expect(sniperCount).toBe(2);
    });

    it('contains 1 TOWER_SPLASH, 1 TOWER_SLOW, 1 GOLD_RUSH, 1 DAMAGE_BOOST', () => {
      const deck = getStarterDeck();
      expect(deck.filter(id => id === CardId.TOWER_SPLASH).length).toBe(1);
      expect(deck.filter(id => id === CardId.TOWER_SLOW).length).toBe(1);
      expect(deck.filter(id => id === CardId.GOLD_RUSH).length).toBe(1);
      expect(deck.filter(id => id === CardId.DAMAGE_BOOST).length).toBe(1);
    });

    it('all starter deck cards have definitions', () => {
      for (const id of getStarterDeck()) {
        expect(getCardDefinition(id)).toBeDefined();
      }
    });
  });
});
