import {
  GameModifier,
  GAME_MODIFIER_CONFIGS,
  GameModifierConfig,
  calculateModifierScoreMultiplier,
  mergeModifierEffects,
} from './game-modifier.model';

describe('GameModifier Model', () => {
  const allModifiers = Object.values(GameModifier);

  describe('GAME_MODIFIER_CONFIGS', () => {
    it('should have a config for every GameModifier value', () => {
      for (const mod of allModifiers) {
        expect(GAME_MODIFIER_CONFIGS[mod]).toBeDefined();
        expect(GAME_MODIFIER_CONFIGS[mod].id).toBe(mod);
      }
    });

    it('should have non-empty label for every config', () => {
      for (const mod of allModifiers) {
        expect(GAME_MODIFIER_CONFIGS[mod].label.length).toBeGreaterThan(0);
      }
    });

    it('should have non-empty description for every config', () => {
      for (const mod of allModifiers) {
        expect(GAME_MODIFIER_CONFIGS[mod].description.length).toBeGreaterThan(0);
      }
    });

    it('should have positive scoreBonus for all modifiers except WEALTHY_START', () => {
      for (const mod of allModifiers) {
        if (mod === GameModifier.WEALTHY_START) {
          expect(GAME_MODIFIER_CONFIGS[mod].scoreBonus).toBeLessThan(0);
        } else {
          expect(GAME_MODIFIER_CONFIGS[mod].scoreBonus).toBeGreaterThan(0);
        }
      }
    });

    it('should have at least one effect for every config', () => {
      for (const mod of allModifiers) {
        const effects = GAME_MODIFIER_CONFIGS[mod].effects;
        const effectKeys = Object.keys(effects).filter(
          k => (effects as Record<string, unknown>)[k] !== undefined
        );
        expect(effectKeys.length).toBeGreaterThan(0);
      }
    });
  });

  describe('calculateModifierScoreMultiplier', () => {
    it('should return 1.0 for empty modifier set', () => {
      expect(calculateModifierScoreMultiplier(new Set())).toBe(1.0);
    });

    it('should add scoreBonus for a single modifier', () => {
      const mods = new Set([GameModifier.ARMORED_ENEMIES]);
      const expected = 1.0 + GAME_MODIFIER_CONFIGS[GameModifier.ARMORED_ENEMIES].scoreBonus;
      expect(calculateModifierScoreMultiplier(mods)).toBeCloseTo(expected);
    });

    it('should sum scoreBonuses for multiple modifiers', () => {
      const mods = new Set([GameModifier.ARMORED_ENEMIES, GameModifier.FAST_ENEMIES]);
      const expected =
        1.0 +
        GAME_MODIFIER_CONFIGS[GameModifier.ARMORED_ENEMIES].scoreBonus +
        GAME_MODIFIER_CONFIGS[GameModifier.FAST_ENEMIES].scoreBonus;
      expect(calculateModifierScoreMultiplier(mods)).toBeCloseTo(expected);
    });

    it('should floor at 0.1 to prevent negative scores', () => {
      // WEALTHY_START has -0.2, so with enough negative-only modifiers
      // the multiplier should still be at least 0.1
      const mods = new Set([GameModifier.WEALTHY_START]);
      const result = calculateModifierScoreMultiplier(mods);
      expect(result).toBeGreaterThanOrEqual(0.1);
    });

    it('should handle all modifiers active at once', () => {
      const allMods = new Set(allModifiers);
      const result = calculateModifierScoreMultiplier(allMods);
      expect(result).toBeGreaterThanOrEqual(0.1);
      // Sum of all bonuses should be > 0 since most are positive
      let totalBonus = 0;
      for (const mod of allModifiers) {
        totalBonus += GAME_MODIFIER_CONFIGS[mod].scoreBonus;
      }
      expect(result).toBeCloseTo(1.0 + totalBonus);
    });
  });

  describe('mergeModifierEffects', () => {
    it('should return empty object for empty modifier set', () => {
      const result = mergeModifierEffects(new Set());
      expect(Object.keys(result).length).toBe(0);
    });

    it('should return single effect for single modifier', () => {
      const result = mergeModifierEffects(new Set([GameModifier.ARMORED_ENEMIES]));
      expect(result.enemyHealthMultiplier).toBe(2.0);
      expect(result.enemySpeedMultiplier).toBeUndefined();
    });

    it('should multiplicatively stack same-type multipliers', () => {
      // EXPENSIVE_TOWERS (1.5x cost) + GLASS_CANNON (2.0x cost) = 3.0x
      const result = mergeModifierEffects(
        new Set([GameModifier.EXPENSIVE_TOWERS, GameModifier.GLASS_CANNON])
      );
      expect(result.towerCostMultiplier).toBeCloseTo(3.0);
    });

    it('should multiplicatively stack speed multipliers', () => {
      // FAST_ENEMIES (1.5x) + SPEED_DEMONS (2.0x) = 3.0x
      const result = mergeModifierEffects(
        new Set([GameModifier.FAST_ENEMIES, GameModifier.SPEED_DEMONS])
      );
      expect(result.enemySpeedMultiplier).toBeCloseTo(3.0);
    });

    it('should set disableInterest flag when NO_INTEREST is active', () => {
      const result = mergeModifierEffects(new Set([GameModifier.NO_INTEREST]));
      expect(result.disableInterest).toBe(true);
    });

    it('should not set disableInterest when NO_INTEREST is not active', () => {
      const result = mergeModifierEffects(new Set([GameModifier.ARMORED_ENEMIES]));
      expect(result.disableInterest).toBeUndefined();
    });

    it('should merge GLASS_CANNON damage and cost multipliers together', () => {
      const result = mergeModifierEffects(new Set([GameModifier.GLASS_CANNON]));
      expect(result.towerDamageMultiplier).toBe(2.0);
      expect(result.towerCostMultiplier).toBe(2.0);
    });

    it('should set startingGoldMultiplier for WEALTHY_START', () => {
      const result = mergeModifierEffects(new Set([GameModifier.WEALTHY_START]));
      expect(result.startingGoldMultiplier).toBe(2.0);
    });

    it('should set waveCountMultiplier for DOUBLE_SPAWN', () => {
      const result = mergeModifierEffects(new Set([GameModifier.DOUBLE_SPAWN]));
      expect(result.waveCountMultiplier).toBe(2.0);
    });

    it('should handle all modifiers active at once without error', () => {
      const allMods = new Set(allModifiers);
      expect(() => mergeModifierEffects(allMods)).not.toThrow();
      const result = mergeModifierEffects(allMods);
      expect(result.enemyHealthMultiplier).toBeGreaterThan(1);
      expect(result.enemySpeedMultiplier).toBeGreaterThan(1);
      expect(result.towerCostMultiplier).toBeGreaterThan(1);
      expect(result.disableInterest).toBe(true);
    });
  });
});
