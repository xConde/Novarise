import { WAVE_DEFINITIONS } from './wave.model';
import { GameModifier } from './game-modifier.model';

export enum GamePhase {
  SETUP = 'setup',
  COMBAT = 'combat',
  INTERMISSION = 'intermission',
  VICTORY = 'victory',
  DEFEAT = 'defeat'
}

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
    gold: 50,
    label: 'Nightmare',
    description: 'Razor-thin margins, every decision matters'
  }
};

export const VALID_GAME_SPEEDS = [1, 2, 3] as const;
export type GameSpeed = typeof VALID_GAME_SPEEDS[number];

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
  gameSpeed: GameSpeed;
  elapsedTime: number; // total seconds spent in COMBAT phase
  activeModifiers: Set<GameModifier>;
}

/** Economy settings for the interest system */
export const INTEREST_CONFIG = {
  /** Percentage of unspent gold earned as bonus between waves */
  rate: 0.05,
  /** Maximum interest payout per wave */
  maxPayout: 50,
} as const;

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
  gameSpeed: 1,
  elapsedTime: 0,
  activeModifiers: new Set<GameModifier>()
};
