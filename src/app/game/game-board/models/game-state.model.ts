import { WAVE_DEFINITIONS } from './wave.model';

export enum GamePhase {
  SETUP = 'setup',
  COMBAT = 'combat',
  INTERMISSION = 'intermission',
  VICTORY = 'victory',
  DEFEAT = 'defeat'
}

export interface GameState {
  phase: GamePhase;
  wave: number;
  maxWaves: number;
  lives: number;
  maxLives: number;
  gold: number;
  score: number;
}

export const INITIAL_GAME_STATE: GameState = {
  phase: GamePhase.SETUP,
  wave: 0,
  maxWaves: WAVE_DEFINITIONS.length,
  lives: 20,
  maxLives: 20,
  gold: 200,
  score: 0
};
