import {
  DifficultyLevel,
  DIFFICULTY_PRESETS,
  getDifficultyHealthMultiplier,
  getDifficultySpeedMultiplier,
  getDifficultyGoldMultiplier,
  DEFAULT_DIFFICULTY
} from './difficulty.model';

describe('difficulty.model', () => {
  // --- Enum values ---
  describe('DifficultyLevel', () => {
    it('should have EASY, NORMAL, HARD, and NIGHTMARE values', () => {
      expect(DifficultyLevel.EASY).toBe('easy');
      expect(DifficultyLevel.NORMAL).toBe('normal');
      expect(DifficultyLevel.HARD).toBe('hard');
      expect(DifficultyLevel.NIGHTMARE).toBe('nightmare');
    });
  });

  // --- DEFAULT_DIFFICULTY ---
  describe('DEFAULT_DIFFICULTY', () => {
    it('should be NORMAL', () => {
      expect(DEFAULT_DIFFICULTY).toBe(DifficultyLevel.NORMAL);
    });
  });

  // --- DIFFICULTY_PRESETS structure ---
  describe('DIFFICULTY_PRESETS', () => {
    it('should have an entry for every DifficultyLevel', () => {
      const levels = Object.values(DifficultyLevel);
      levels.forEach(level => {
        expect(DIFFICULTY_PRESETS[level]).toBeDefined(`expected preset for ${level}`);
      });
    });

    it('each preset should have required fields', () => {
      Object.values(DifficultyLevel).forEach(level => {
        const preset = DIFFICULTY_PRESETS[level];
        expect(typeof preset.lives).toBe('number');
        expect(typeof preset.gold).toBe('number');
        expect(typeof preset.label).toBe('string');
        expect(typeof preset.description).toBe('string');
        expect(typeof preset.healthMultiplier).toBe('number');
        expect(typeof preset.speedMultiplier).toBe('number');
        expect(typeof preset.goldMultiplier).toBe('number');
      });
    });

    it('EASY should have more lives and gold than NORMAL', () => {
      expect(DIFFICULTY_PRESETS[DifficultyLevel.EASY].lives).toBeGreaterThan(
        DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].lives
      );
      expect(DIFFICULTY_PRESETS[DifficultyLevel.EASY].gold).toBeGreaterThan(
        DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold
      );
    });

    it('HARD should have fewer lives and gold than NORMAL', () => {
      expect(DIFFICULTY_PRESETS[DifficultyLevel.HARD].lives).toBeLessThan(
        DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].lives
      );
      expect(DIFFICULTY_PRESETS[DifficultyLevel.HARD].gold).toBeLessThan(
        DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold
      );
    });

    it('NIGHTMARE should have the fewest lives and gold', () => {
      const levels = [DifficultyLevel.EASY, DifficultyLevel.NORMAL, DifficultyLevel.HARD];
      levels.forEach(level => {
        expect(DIFFICULTY_PRESETS[DifficultyLevel.NIGHTMARE].lives).toBeLessThan(
          DIFFICULTY_PRESETS[level].lives
        );
        expect(DIFFICULTY_PRESETS[DifficultyLevel.NIGHTMARE].gold).toBeLessThan(
          DIFFICULTY_PRESETS[level].gold
        );
      });
    });
  });

  // --- Health multipliers ---
  describe('getDifficultyHealthMultiplier', () => {
    it('should return less than 1 for EASY (enemies weaker)', () => {
      expect(getDifficultyHealthMultiplier(DifficultyLevel.EASY)).toBeLessThan(1);
    });

    it('should return exactly 1 for NORMAL (no scaling)', () => {
      expect(getDifficultyHealthMultiplier(DifficultyLevel.NORMAL)).toBe(1.0);
    });

    it('should return greater than 1 for HARD (enemies stronger)', () => {
      expect(getDifficultyHealthMultiplier(DifficultyLevel.HARD)).toBeGreaterThan(1);
    });

    it('should return greater value for NIGHTMARE than HARD', () => {
      expect(getDifficultyHealthMultiplier(DifficultyLevel.NIGHTMARE)).toBeGreaterThan(
        getDifficultyHealthMultiplier(DifficultyLevel.HARD)
      );
    });

    it('should match the preset healthMultiplier field', () => {
      Object.values(DifficultyLevel).forEach(level => {
        expect(getDifficultyHealthMultiplier(level)).toBe(
          DIFFICULTY_PRESETS[level].healthMultiplier
        );
      });
    });
  });

  // --- Speed multipliers ---
  describe('getDifficultySpeedMultiplier', () => {
    it('should return less than 1 for EASY (enemies slower)', () => {
      expect(getDifficultySpeedMultiplier(DifficultyLevel.EASY)).toBeLessThan(1);
    });

    it('should return exactly 1 for NORMAL', () => {
      expect(getDifficultySpeedMultiplier(DifficultyLevel.NORMAL)).toBe(1.0);
    });

    it('should return greater than 1 for HARD (enemies faster)', () => {
      expect(getDifficultySpeedMultiplier(DifficultyLevel.HARD)).toBeGreaterThan(1);
    });

    it('should return greater value for NIGHTMARE than HARD', () => {
      expect(getDifficultySpeedMultiplier(DifficultyLevel.NIGHTMARE)).toBeGreaterThan(
        getDifficultySpeedMultiplier(DifficultyLevel.HARD)
      );
    });

    it('should match the preset speedMultiplier field', () => {
      Object.values(DifficultyLevel).forEach(level => {
        expect(getDifficultySpeedMultiplier(level)).toBe(
          DIFFICULTY_PRESETS[level].speedMultiplier
        );
      });
    });
  });

  // --- Gold multipliers ---
  describe('getDifficultyGoldMultiplier', () => {
    it('should return greater than 1 for EASY (more gold rewards)', () => {
      expect(getDifficultyGoldMultiplier(DifficultyLevel.EASY)).toBeGreaterThan(1);
    });

    it('should return exactly 1 for NORMAL', () => {
      expect(getDifficultyGoldMultiplier(DifficultyLevel.NORMAL)).toBe(1.0);
    });

    it('should return less than 1 for HARD (fewer gold rewards)', () => {
      expect(getDifficultyGoldMultiplier(DifficultyLevel.HARD)).toBeLessThan(1);
    });

    it('should return the smallest value for NIGHTMARE', () => {
      expect(getDifficultyGoldMultiplier(DifficultyLevel.NIGHTMARE)).toBeLessThan(
        getDifficultyGoldMultiplier(DifficultyLevel.HARD)
      );
    });

    it('should match the preset goldMultiplier field', () => {
      Object.values(DifficultyLevel).forEach(level => {
        expect(getDifficultyGoldMultiplier(level)).toBe(
          DIFFICULTY_PRESETS[level].goldMultiplier
        );
      });
    });
  });

  // --- Scaling invariants ---
  describe('multiplier ordering', () => {
    it('health multipliers should increase monotonically EASY < NORMAL < HARD < NIGHTMARE', () => {
      const levels: DifficultyLevel[] = [
        DifficultyLevel.EASY,
        DifficultyLevel.NORMAL,
        DifficultyLevel.HARD,
        DifficultyLevel.NIGHTMARE
      ];
      for (let i = 1; i < levels.length; i++) {
        expect(getDifficultyHealthMultiplier(levels[i])).toBeGreaterThan(
          getDifficultyHealthMultiplier(levels[i - 1])
        );
      }
    });

    it('speed multipliers should increase monotonically EASY < NORMAL < HARD < NIGHTMARE', () => {
      const levels: DifficultyLevel[] = [
        DifficultyLevel.EASY,
        DifficultyLevel.NORMAL,
        DifficultyLevel.HARD,
        DifficultyLevel.NIGHTMARE
      ];
      for (let i = 1; i < levels.length; i++) {
        expect(getDifficultySpeedMultiplier(levels[i])).toBeGreaterThan(
          getDifficultySpeedMultiplier(levels[i - 1])
        );
      }
    });

    it('gold multipliers should decrease monotonically EASY > NORMAL > HARD > NIGHTMARE', () => {
      const levels: DifficultyLevel[] = [
        DifficultyLevel.EASY,
        DifficultyLevel.NORMAL,
        DifficultyLevel.HARD,
        DifficultyLevel.NIGHTMARE
      ];
      for (let i = 1; i < levels.length; i++) {
        expect(getDifficultyGoldMultiplier(levels[i])).toBeLessThan(
          getDifficultyGoldMultiplier(levels[i - 1])
        );
      }
    });

    it('all multipliers should be positive', () => {
      Object.values(DifficultyLevel).forEach(level => {
        expect(getDifficultyHealthMultiplier(level)).toBeGreaterThan(0);
        expect(getDifficultySpeedMultiplier(level)).toBeGreaterThan(0);
        expect(getDifficultyGoldMultiplier(level)).toBeGreaterThan(0);
      });
    });
  });
});
