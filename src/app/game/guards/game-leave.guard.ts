import { CanDeactivateFn } from '@angular/router';
import { GameComponent } from '../game.component';

/**
 * Prevents accidental navigation away from an active game.
 * Delegates to GameComponent → GameBoardComponent.canLeaveGame(), which auto-pauses
 * the game, prompts the player, and records a defeat if they confirm leaving.
 */
export const gameLeaveGuard: CanDeactivateFn<GameComponent> = (
  component: GameComponent
): boolean => {
  return component.canLeaveGame();
};
