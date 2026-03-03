import { WAVE_DEFINITIONS } from './wave.model';

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
    lives: 5,
    gold: 50,
    label: 'Nightmare',
    description: 'One mistake and it is over'
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
}

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
  gameSpeed: 1
};
