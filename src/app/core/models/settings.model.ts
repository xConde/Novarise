import { DifficultyLevel } from '../../game/game-board/models/game-state.model';

export interface GameSettings {
  audioMuted: boolean;
  difficulty: DifficultyLevel;
  gameSpeed: number;
  showFps: boolean;
  reduceMotion: boolean;
}
