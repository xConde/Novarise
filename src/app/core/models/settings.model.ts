import { DifficultyLevel } from '../../game/game-board/models/game-state.model';

export interface GameSettings {
  audioMuted: boolean;
  difficulty: DifficultyLevel;
  showFps: boolean;
  reduceMotion: boolean;
}
