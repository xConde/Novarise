/**
 * Difficulty model — canonical definitions for difficulty scaling.
 *
 * DifficultyLevel and DIFFICULTY_PRESETS live in game-state.model.ts because
 * GameState embeds DifficultyLevel. This module re-exports them under a single
 * "difficulty" import surface and adds convenience helpers so consumers don't
 * need to reach into game-state.model for difficulty-specific logic.
 */
export {
  DifficultyLevel,
  DifficultyPreset,
  DIFFICULTY_PRESETS
} from './game-state.model';

import { DifficultyLevel, DIFFICULTY_PRESETS } from './game-state.model';

/**
 * Returns the health multiplier for the given difficulty level.
 * Used by EnemyService to scale spawned enemy health.
 */
export function getDifficultyHealthMultiplier(difficulty: DifficultyLevel): number {
  return DIFFICULTY_PRESETS[difficulty].healthMultiplier;
}

/**
 * Returns the speed multiplier for the given difficulty level.
 * Used by EnemyService to scale spawned enemy movement speed.
 */
export function getDifficultySpeedMultiplier(difficulty: DifficultyLevel): number {
  return DIFFICULTY_PRESETS[difficulty].speedMultiplier;
}

/**
 * Returns the gold multiplier for the given difficulty level.
 * Used by WaveService/GameStateService to scale gold rewards.
 */
export function getDifficultyGoldMultiplier(difficulty: DifficultyLevel): number {
  return DIFFICULTY_PRESETS[difficulty].goldMultiplier;
}

/** Default difficulty used when no selection has been made. */
export const DEFAULT_DIFFICULTY = DifficultyLevel.NORMAL;
