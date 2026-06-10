import { DifficultyLevel } from '../../game/game-board/models/game-state.model';

export interface GameSettings {
  audioMuted: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  difficulty: DifficultyLevel;
  showFps: boolean;
  reduceMotion: boolean;
}
