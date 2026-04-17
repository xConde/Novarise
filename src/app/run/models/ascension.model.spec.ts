import {
  ASCENSION_LEVELS,
  AscensionEffectType,
  getAscensionEffects,
  MAX_ASCENSION_LEVEL,
  QUALITATIVE_ASCENSION_VALUES,
} from './ascension.model';

describe('Ascension Model', () => {
  describe('ASCENSION_LEVELS', () => {
    it('should have exactly 20 entries', () => {
      expect(ASCENSION_LEVELS.length).toBe(20);
    });

    it('should be numbered 1-20 in order', () => {
      ASCENSION_LEVELS.forEach((asc, i) => {
        expect(asc.level).toBe(i + 1);
      });
    });

    it('every level should have a non-empty label', () => {
      ASCENSION_LEVELS.forEach(asc => {
        expect(asc.label.length).toBeGreaterThan(0, `level ${asc.level} has empty label`);
      });
    });

    it('every level should have a non-empty description', () => {
      ASCENSION_LEVELS.forEach(asc => {
        expect(asc.description.length).toBeGreaterThan(0, `level ${asc.level} has empty description`);
      });
    });

    it('MAX_ASCENSION_LEVEL should equal 20', () => {
      expect(MAX_ASCENSION_LEVEL).toBe(20);
    });
  });

  describe('getAscensionEffects()', () => {
    it('should return empty map for level 0', () => {
      const effects = getAscensionEffects(0);
      expect(effects.size).toBe(0);
    });

    it('should return enemy_health_multiplier of 1.1 for level 1', () => {
      const effects = getAscensionEffects(1);
      expect(effects.get(AscensionEffectType.ENEMY_HEALTH_MULTIPLIER)).toBeCloseTo(1.1, 5);
    });

    it('should return only one effect for level 1', () => {
      const effects = getAscensionEffects(1);
      expect(effects.size).toBe(1);
    });

    it('should include enemy_speed_multiplier at level 2', () => {
      const effects = getAscensionEffects(2);
      expect(effects.get(AscensionEffectType.ENEMY_SPEED_MULTIPLIER)).toBeCloseTo(1.05, 5);
    });

    it('should stack health multipliers multiplicatively across levels 1, 7, 15', () => {
      const effects = getAscensionEffects(20);
      // Level 1: ×1.1, Level 7: ×1.2, Level 15: ×1.3 → 1.1 × 1.2 × 1.3
      const expected = 1.1 * 1.2 * 1.3;
      expect(effects.get(AscensionEffectType.ENEMY_HEALTH_MULTIPLIER)).toBeCloseTo(expected, 5);
    });

    it('should stack speed multipliers multiplicatively across levels 2, 12, 19', () => {
      const effects = getAscensionEffects(20);
      // Level 2: ×1.05, Level 12: ×1.1, Level 19: ×1.15
      const expected = 1.05 * 1.1 * 1.15;
      expect(effects.get(AscensionEffectType.ENEMY_SPEED_MULTIPLIER)).toBeCloseTo(expected, 5);
    });

    it('should have gold reduction only from level 3 (A13 no longer duplicates it)', () => {
      const effects = getAscensionEffects(20);
      // Level 3: 20 only — A13 now uses SHOP_SLOT_REDUCTION instead
      expect(effects.get(AscensionEffectType.STARTING_GOLD_REDUCTION)).toBe(20);
    });

    it('should have lives reduction only from level 4 (A14 no longer duplicates it)', () => {
      const effects = getAscensionEffects(20);
      // Level 4: 2 only — A14 now uses EVENT_NODE_REDUCTION instead
      expect(effects.get(AscensionEffectType.STARTING_LIVES_REDUCTION)).toBe(2);
    });

    it('should stack boss health multiplier at level 10 only (for getAscensionEffects(10))', () => {
      const effects = getAscensionEffects(10);
      expect(effects.get(AscensionEffectType.BOSS_HEALTH_MULTIPLIER)).toBeCloseTo(1.3, 5);
    });

    it('should stack boss health multiplier multiplicatively across levels 10 and 20', () => {
      const effects = getAscensionEffects(20);
      // Level 10: ×1.3, Level 20: ×1.6
      const expected = 1.3 * 1.6;
      expect(effects.get(AscensionEffectType.BOSS_HEALTH_MULTIPLIER)).toBeCloseTo(expected, 5);
    });

    it('should stack rest heal reduction multiplicatively across levels 8 and 17', () => {
      const effects = getAscensionEffects(20);
      // Level 8: ×0.75, Level 17: ×0.5
      const expected = 0.75 * 0.5;
      expect(effects.get(AscensionEffectType.REST_HEAL_REDUCTION)).toBeCloseTo(expected, 5);
    });

    it('should clamp negative level to 0 (returns empty map)', () => {
      const effects = getAscensionEffects(-1);
      expect(effects.size).toBe(0);
    });

    it('should clamp level above 20 to 20', () => {
      const effectsAt20 = getAscensionEffects(20);
      const effectsAt25 = getAscensionEffects(25);
      // Both should produce the same result
      expect(effectsAt25.size).toBe(effectsAt20.size);
      effectsAt20.forEach((value, key) => {
        expect(effectsAt25.get(key)).toBeCloseTo(value, 5);
      });
    });

    it('should have fewer_relic_choices of 1 at level 20 (only level 11 contributes)', () => {
      const effects = getAscensionEffects(20);
      expect(effects.get(AscensionEffectType.FEWER_RELIC_CHOICES)).toBe(1);
    });

    // ── S7 qualitative effect values ─────────────────────────────────────────

    it('A13 should have SHOP_SLOT_REDUCTION effect with value from QUALITATIVE_ASCENSION_VALUES', () => {
      const a13 = ASCENSION_LEVELS[12]; // 0-indexed
      expect(a13.level).toBe(13);
      expect(a13.effect.type).toBe(AscensionEffectType.SHOP_SLOT_REDUCTION);
      expect(a13.effect.value).toBe(QUALITATIVE_ASCENSION_VALUES.shopSlotReduction);
    });

    it('A14 should have EVENT_NODE_REDUCTION effect with value from QUALITATIVE_ASCENSION_VALUES', () => {
      const a14 = ASCENSION_LEVELS[13];
      expect(a14.level).toBe(14);
      expect(a14.effect.type).toBe(AscensionEffectType.EVENT_NODE_REDUCTION);
      expect(a14.effect.value).toBe(QUALITATIVE_ASCENSION_VALUES.eventNodeReduction);
    });

    it('A16 should have ELITE_SPAWN_RATE_BONUS effect with value from QUALITATIVE_ASCENSION_VALUES', () => {
      const a16 = ASCENSION_LEVELS[15];
      expect(a16.level).toBe(16);
      expect(a16.effect.type).toBe(AscensionEffectType.ELITE_SPAWN_RATE_BONUS);
      expect(a16.effect.value).toBe(QUALITATIVE_ASCENSION_VALUES.eliteSpawnBonus);
    });

    it('A18 should have STARTING_RELIC_DOWNGRADE effect with value from QUALITATIVE_ASCENSION_VALUES', () => {
      const a18 = ASCENSION_LEVELS[17];
      expect(a18.level).toBe(18);
      expect(a18.effect.type).toBe(AscensionEffectType.STARTING_RELIC_DOWNGRADE);
      expect(a18.effect.value).toBe(QUALITATIVE_ASCENSION_VALUES.startingRelicDowngrade);
    });

    it('getAscensionEffects(13) should include SHOP_SLOT_REDUCTION of 1', () => {
      const effects = getAscensionEffects(13);
      expect(effects.get(AscensionEffectType.SHOP_SLOT_REDUCTION)).toBe(QUALITATIVE_ASCENSION_VALUES.shopSlotReduction);
    });

    it('getAscensionEffects(14) should include EVENT_NODE_REDUCTION of 1', () => {
      const effects = getAscensionEffects(14);
      expect(effects.get(AscensionEffectType.EVENT_NODE_REDUCTION)).toBe(QUALITATIVE_ASCENSION_VALUES.eventNodeReduction);
    });

    it('getAscensionEffects(16) should include ELITE_SPAWN_RATE_BONUS of 15', () => {
      const effects = getAscensionEffects(16);
      expect(effects.get(AscensionEffectType.ELITE_SPAWN_RATE_BONUS)).toBe(QUALITATIVE_ASCENSION_VALUES.eliteSpawnBonus);
    });

    it('getAscensionEffects(18) should include STARTING_RELIC_DOWNGRADE of 1', () => {
      const effects = getAscensionEffects(18);
      expect(effects.get(AscensionEffectType.STARTING_RELIC_DOWNGRADE)).toBe(QUALITATIVE_ASCENSION_VALUES.startingRelicDowngrade);
    });

    it('getAscensionEffects(20) aggregates all qualitative effects correctly', () => {
      const effects = getAscensionEffects(20);
      expect(effects.get(AscensionEffectType.SHOP_SLOT_REDUCTION)).toBe(QUALITATIVE_ASCENSION_VALUES.shopSlotReduction);
      expect(effects.get(AscensionEffectType.EVENT_NODE_REDUCTION)).toBe(QUALITATIVE_ASCENSION_VALUES.eventNodeReduction);
      expect(effects.get(AscensionEffectType.ELITE_SPAWN_RATE_BONUS)).toBe(QUALITATIVE_ASCENSION_VALUES.eliteSpawnBonus);
      expect(effects.get(AscensionEffectType.STARTING_RELIC_DOWNGRADE)).toBe(QUALITATIVE_ASCENSION_VALUES.startingRelicDowngrade);
    });
  });
});
