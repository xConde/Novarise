import {
  getRelicDefinition,
  getRelicsByRarity,
  RELIC_DEFINITIONS,
  RelicId,
  RelicRarity,
} from './relic.model';

describe('Relic Model', () => {
  describe('RELIC_DEFINITIONS', () => {
    it('should have exactly 24 relics', () => {
      // 22 original + SURVEYOR_ROD (sprint 36, uncommon) + OROGENY (sprint 36, rare)
      expect(Object.keys(RELIC_DEFINITIONS).length).toBe(24);
    });

    it('should have 10 common relics', () => {
      const commons = Object.values(RELIC_DEFINITIONS).filter(r => r.rarity === RelicRarity.COMMON);
      expect(commons.length).toBe(10);
    });

    it('should have 9 uncommon relics', () => {
      const uncommons = Object.values(RELIC_DEFINITIONS).filter(r => r.rarity === RelicRarity.UNCOMMON);
      expect(uncommons.length).toBe(9); // +1: SURVEYOR_COMPASS, +1: SURVEYOR_ROD (sprint 36)
    });

    it('should have 5 rare relics', () => {
      const rares = Object.values(RELIC_DEFINITIONS).filter(r => r.rarity === RelicRarity.RARE);
      expect(rares.length).toBe(5); // +1: WORLD_SPIRIT, +1: OROGENY (sprint 36)
    });

    it('every relic should have a non-empty name', () => {
      Object.values(RELIC_DEFINITIONS).forEach(relic => {
        expect(relic.name.length).toBeGreaterThan(0, `RelicId ${relic.id} has empty name`);
      });
    });

    it('every relic should have a non-empty description', () => {
      Object.values(RELIC_DEFINITIONS).forEach(relic => {
        expect(relic.description.length).toBeGreaterThan(0, `RelicId ${relic.id} has empty description`);
      });
    });

    it('every relic should have a non-empty flavorText', () => {
      Object.values(RELIC_DEFINITIONS).forEach(relic => {
        expect(relic.flavorText.length).toBeGreaterThan(0, `RelicId ${relic.id} has empty flavorText`);
      });
    });

    it('should have no duplicate RelicIds', () => {
      const ids = Object.values(RELIC_DEFINITIONS).map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('each definition key should match its id field', () => {
      (Object.keys(RELIC_DEFINITIONS) as RelicId[]).forEach(key => {
        expect(RELIC_DEFINITIONS[key].id).toBe(key);
      });
    });
  });

  describe('getRelicsByRarity()', () => {
    it('should return 10 common relics', () => {
      const result = getRelicsByRarity(RelicRarity.COMMON);
      expect(result.length).toBe(10);
    });

    it('should return 9 uncommon relics', () => {
      const result = getRelicsByRarity(RelicRarity.UNCOMMON);
      expect(result.length).toBe(9); // +1: SURVEYOR_COMPASS, +1: SURVEYOR_ROD (sprint 36)
    });

    it('should return 5 rare relics', () => {
      const result = getRelicsByRarity(RelicRarity.RARE);
      expect(result.length).toBe(5); // +1: WORLD_SPIRIT, +1: OROGENY (sprint 36)
    });

    it('should return only relics of the requested rarity', () => {
      const result = getRelicsByRarity(RelicRarity.UNCOMMON);
      result.forEach(r => expect(r.rarity).toBe(RelicRarity.UNCOMMON));
    });
  });

  describe('getRelicDefinition()', () => {
    it('should return the correct relic for IRON_HEART', () => {
      const relic = getRelicDefinition(RelicId.IRON_HEART);
      expect(relic.id).toBe(RelicId.IRON_HEART);
      expect(relic.rarity).toBe(RelicRarity.COMMON);
    });

    it('should return the correct relic for CHAIN_REACTION', () => {
      const relic = getRelicDefinition(RelicId.CHAIN_REACTION);
      expect(relic.id).toBe(RelicId.CHAIN_REACTION);
      expect(relic.rarity).toBe(RelicRarity.UNCOMMON);
    });

    it('should return the correct relic for COMMANDERS_BANNER', () => {
      const relic = getRelicDefinition(RelicId.COMMANDERS_BANNER);
      expect(relic.id).toBe(RelicId.COMMANDERS_BANNER);
      expect(relic.rarity).toBe(RelicRarity.RARE);
    });

    it('should return a defined result for every RelicId value', () => {
      Object.values(RelicId).forEach(id => {
        const relic = getRelicDefinition(id);
        expect(relic).toBeDefined(`missing definition for ${id}`);
      });
    });

    it('TEMPORAL_RIFT description matches actual implementation (1-turn delay, not spawn interval %)', () => {
      const relic = getRelicDefinition(RelicId.TEMPORAL_RIFT);
      expect(relic.description).toBe('First enemy of each wave spawns 1 turn later');
      // Guard: description must NOT claim a percentage interval change
      expect(relic.description).not.toContain('%');
    });
  });
});
