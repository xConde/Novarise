import { DifficultyLevel } from '../../game/game-board/models/game-state.model';

/** Valid font scale multipliers. 1 = default 16px root; 1.15 = Large; 1.3 = Larger. */
export type FontScale = 1 | 1.15 | 1.3;

export interface GameSettings {
  audioMuted: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  difficulty: DifficultyLevel;
  showFps: boolean;
  reduceMotion: boolean;
  /** Substitute a deuteranopia/protanopia-safe colour palette for enemy meshes and status-effect particles. Takes effect on the next encounter. */
  colorblindAssist: boolean;
  /** Root font-size multiplier applied to all rem-based UI text. Takes effect immediately. */
  fontScale: FontScale;
}
