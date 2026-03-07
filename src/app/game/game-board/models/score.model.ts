import { DifficultyLevel } from './game-state.model';

/** Thresholds for star ratings. Lives remaining as percentage of starting lives. */
export const STAR_THRESHOLDS = {
  /** 1 star: just survived (any lives remaining). */
  oneStar: 0,
  /** 2 stars: lost fewer than half your lives. */
  twoStar: 0.5,
  /** 3 stars: lost no lives. */
  threeStar: 1.0,
} as const;

/** Difficulty multipliers for final score calculation. */
export const DIFFICULTY_SCORE_MULTIPLIER: Record<DifficultyLevel, number> = {
  [DifficultyLevel.EASY]: 0.5,
  [DifficultyLevel.NORMAL]: 1.0,
  [DifficultyLevel.HARD]: 1.5,
  [DifficultyLevel.NIGHTMARE]: 2.0,
};

export interface ScoreBreakdown {
  baseScore: number;
  livesRemaining: number;
  livesTotal: number;
  livesPercent: number;
  difficultyMultiplier: number;
  modifierMultiplier: number;
  difficulty: DifficultyLevel;
  finalScore: number;
  stars: number;
  wavesCompleted: number;
  isVictory: boolean;
}

/** Calculate star rating based on lives remaining as a fraction of starting lives. */
export function calculateStars(livesRemaining: number, livesTotal: number): number {
  if (livesRemaining <= 0) return 0;
  const fraction = livesRemaining / livesTotal;
  if (fraction >= STAR_THRESHOLDS.threeStar) return 3;
  if (fraction >= STAR_THRESHOLDS.twoStar) return 2;
  return 1;
}

/** Build a full score breakdown from game end state. */
export function calculateScoreBreakdown(
  baseScore: number,
  livesRemaining: number,
  livesTotal: number,
  difficulty: DifficultyLevel,
  wavesCompleted: number,
  isVictory: boolean,
  modifierMultiplier: number = 1.0
): ScoreBreakdown {
  const difficultyMultiplier = DIFFICULTY_SCORE_MULTIPLIER[difficulty];
  const finalScore = Math.round(baseScore * difficultyMultiplier * modifierMultiplier);
  const stars = isVictory ? calculateStars(livesRemaining, livesTotal) : 0;
  const livesPercent = livesTotal > 0 ? livesRemaining / livesTotal : 0;

  return {
    baseScore,
    livesRemaining,
    livesTotal,
    livesPercent,
    difficultyMultiplier,
    modifierMultiplier,
    difficulty,
    finalScore,
    stars,
    wavesCompleted,
    isVictory,
  };
}
