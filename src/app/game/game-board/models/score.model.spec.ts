import {
  calculateStars,
  calculateScoreBreakdown,
  STAR_THRESHOLDS,
  DIFFICULTY_SCORE_MULTIPLIER,
  MapScoreRecord,
} from './score.model';
import { DifficultyLevel } from './game-state.model';

describe('Score Model', () => {

  describe('STAR_THRESHOLDS', () => {
    it('should define three threshold levels', () => {
      expect(STAR_THRESHOLDS.oneStar).toBe(0);
      expect(STAR_THRESHOLDS.twoStar).toBe(0.5);
      expect(STAR_THRESHOLDS.threeStar).toBe(1.0);
    });
  });

  describe('DIFFICULTY_SCORE_MULTIPLIER', () => {
    it('should have a multiplier for every difficulty level', () => {
      for (const level of Object.values(DifficultyLevel)) {
        expect(DIFFICULTY_SCORE_MULTIPLIER[level]).toBeDefined();
        expect(DIFFICULTY_SCORE_MULTIPLIER[level]).toBeGreaterThan(0);
      }
    });

    it('should scale from easy (0.5) to nightmare (2.0)', () => {
      expect(DIFFICULTY_SCORE_MULTIPLIER[DifficultyLevel.EASY]).toBe(0.5);
      expect(DIFFICULTY_SCORE_MULTIPLIER[DifficultyLevel.NIGHTMARE]).toBe(2.0);
    });
  });

  describe('calculateStars', () => {
    it('should return 0 stars when no lives remaining', () => {
      expect(calculateStars(0, 20)).toBe(0);
    });

    it('should return 1 star when some lives remain but below 50%', () => {
      expect(calculateStars(5, 20)).toBe(1);  // 25%
      expect(calculateStars(1, 20)).toBe(1);  // 5%
    });

    it('should return 2 stars when 50% or more lives remain but not all', () => {
      expect(calculateStars(10, 20)).toBe(2); // 50%
      expect(calculateStars(15, 20)).toBe(2); // 75%
      expect(calculateStars(19, 20)).toBe(2); // 95%
    });

    it('should return 3 stars when all lives remain', () => {
      expect(calculateStars(20, 20)).toBe(3);
    });

    it('should handle 1 total life edge case', () => {
      expect(calculateStars(1, 1)).toBe(3);
      expect(calculateStars(0, 1)).toBe(0);
    });
  });

  describe('calculateScoreBreakdown', () => {
    it('should apply difficulty multiplier to base score', () => {
      const result = calculateScoreBreakdown(1000, 20, 20, DifficultyLevel.HARD, 10, true);
      expect(result.finalScore).toBe(1500); // 1000 * 1.5
    });

    it('should give 0 stars on defeat even with lives remaining', () => {
      const result = calculateScoreBreakdown(500, 10, 20, DifficultyLevel.NORMAL, 5, false);
      expect(result.stars).toBe(0);
      expect(result.isVictory).toBe(false);
    });

    it('should give 3 stars on victory with all lives', () => {
      const result = calculateScoreBreakdown(1000, 20, 20, DifficultyLevel.NORMAL, 10, true);
      expect(result.stars).toBe(3);
    });

    it('should give 2 stars on victory with 50% lives', () => {
      const result = calculateScoreBreakdown(1000, 10, 20, DifficultyLevel.NORMAL, 10, true);
      expect(result.stars).toBe(2);
    });

    it('should calculate livesPercent correctly', () => {
      const result = calculateScoreBreakdown(1000, 15, 20, DifficultyLevel.NORMAL, 10, true);
      expect(result.livesPercent).toBe(0.75);
    });

    it('should handle 0 total lives without division by zero', () => {
      const result = calculateScoreBreakdown(100, 0, 0, DifficultyLevel.NORMAL, 1, false);
      expect(result.livesPercent).toBe(0);
    });

    it('should round final score', () => {
      // 333 * 1.5 = 499.5 → rounds to 500
      const result = calculateScoreBreakdown(333, 20, 20, DifficultyLevel.HARD, 10, true);
      expect(result.finalScore).toBe(500);
    });

    it('should include wavesCompleted in breakdown', () => {
      const result = calculateScoreBreakdown(100, 5, 10, DifficultyLevel.EASY, 7, false);
      expect(result.wavesCompleted).toBe(7);
    });
  });

  describe('MapScoreRecord interface', () => {
    it('should allow constructing a valid record with all required fields', () => {
      const record: MapScoreRecord = {
        mapId: 'test-map-1',
        bestScore: 5000,
        bestStars: 3,
        difficulty: DifficultyLevel.NORMAL,
        completedAt: 1700000000000,
      };
      expect(record.mapId).toBe('test-map-1');
      expect(record.bestScore).toBe(5000);
      expect(record.bestStars).toBe(3);
      expect(record.difficulty).toBe(DifficultyLevel.NORMAL);
      expect(record.completedAt).toBe(1700000000000);
    });

    it('should allow all difficulty levels in a MapScoreRecord', () => {
      for (const level of Object.values(DifficultyLevel)) {
        const record: MapScoreRecord = {
          mapId: 'map',
          bestScore: 100,
          bestStars: 1,
          difficulty: level,
          completedAt: Date.now(),
        };
        expect(record.difficulty).toBe(level);
      }
    });
  });
});
