import { WAVE_DEFINITIONS } from './wave.model';
import { GameModifier } from './game-modifier.model';

export enum GamePhase {
  SETUP = 'setup',
  COMBAT = 'combat',
  INTERMISSION = 'intermission',
  VICTORY = 'victory',
  DEFEAT = 'defeat'
}

/** Legal phase transitions. Key = from, value = set of allowed targets. */
export const VALID_TRANSITIONS: Record<GamePhase, ReadonlySet<GamePhase>> = {
  [GamePhase.SETUP]: new Set([GamePhase.COMBAT]),
  [GamePhase.COMBAT]: new Set([GamePhase.INTERMISSION, GamePhase.VICTORY, GamePhase.DEFEAT]),
  [GamePhase.INTERMISSION]: new Set([GamePhase.COMBAT]),
  [GamePhase.VICTORY]: new Set([GamePhase.SETUP]),   // reset/restart
  [GamePhase.DEFEAT]: new Set([GamePhase.SETUP]),    // reset/restart
};

export enum DifficultyLevel {
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard',
  NIGHTMARE = 'nightmare'
}

export interface DifficultyPreset {
  lives: number;
  gold: number;
  label: string;
  description: string;
}

export const DIFFICULTY_PRESETS: Record<DifficultyLevel, DifficultyPreset> = {
  [DifficultyLevel.EASY]: {
    lives: 30,
    gold: 300,
    label: 'Easy',
    description: 'More lives and gold to learn the ropes'
  },
  [DifficultyLevel.NORMAL]: {
    lives: 20,
    gold: 200,
    label: 'Normal',
    description: 'The intended experience'
  },
  [DifficultyLevel.HARD]: {
    lives: 10,
    gold: 100,
    label: 'Hard',
    description: 'Tight resources, every tower counts'
  },
  [DifficultyLevel.NIGHTMARE]: {
    lives: 7,
    gold: 75,
    label: 'Nightmare',
    description: 'Razor-thin margins, every decision matters'
  }
};

export interface GameState {
  phase: GamePhase;
  wave: number;
  maxWaves: number;
  lives: number;
  gold: number;
  score: number;
  difficulty: DifficultyLevel;
  isEndless: boolean;
  highestWave: number; // tracks best wave reached in endless mode
  isPaused: boolean;
  elapsedTime: number; // total seconds spent in COMBAT phase
  activeModifiers: Set<GameModifier>;
  /** Number of consecutive waves completed without any enemy leaks. Resets to 0 on any leak. */
  consecutiveWavesWithoutLeak: number;
}

/** Economy settings for the interest system */
export const INTEREST_CONFIG = {
  /** Percentage of unspent gold earned as bonus between waves */
  rate: 0.05,
  /** Maximum interest payout per wave */
  maxPayout: 50,
} as const;

/** Gold bonus per consecutive leak-free wave (e.g., 3rd streak = 3 * 25 = 75g). */
export const STREAK_BONUS_PER_WAVE = 25;

export const INITIAL_GAME_STATE: GameState = {
  phase: GamePhase.SETUP,
  wave: 0,
  maxWaves: WAVE_DEFINITIONS.length,
  lives: DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].lives,
  gold: DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold,
  score: 0,
  difficulty: DifficultyLevel.NORMAL,
  isEndless: false,
  highestWave: 0,
  isPaused: false,
  elapsedTime: 0,
  activeModifiers: new Set<GameModifier>(),
  consecutiveWavesWithoutLeak: 0,
};
