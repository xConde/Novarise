import {
  ASCENSION_LEVELS,
  AscensionEffectType,
  getAscensionEffects,
  MAX_ASCENSION_LEVEL,
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

    it('should sum gold reductions additively across levels 3 and 13', () => {
      const effects = getAscensionEffects(20);
      // Level 3: 20, Level 13: 30 → 50
      expect(effects.get(AscensionEffectType.STARTING_GOLD_REDUCTION)).toBe(50);
    });

    it('should sum lives reductions additively across levels 4 and 14', () => {
      const effects = getAscensionEffects(20);
      // Level 4: 2, Level 14: 3 → 5
      expect(effects.get(AscensionEffectType.STARTING_LIVES_REDUCTION)).toBe(5);
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
  });
});
