import { CanDeactivateFn } from '@angular/router';
import { GameBoardComponent } from '../game-board/game-board.component';

/**
 * Prevents accidental navigation away from an active game.
 * Delegates entirely to GameBoardComponent.canLeaveGame(), which auto-pauses
 * the game, prompts the player, and records a defeat if they confirm leaving.
 */
export const gameLeaveGuard: CanDeactivateFn<GameBoardComponent> = (
  component: GameBoardComponent
): boolean => {
  return component.canLeaveGame();
};
