import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { GameBoardComponent } from '../game-board/game-board.component';

/**
 * Prevents accidental navigation away from an active game.
 * Delegates entirely to GameBoardComponent.canLeaveGame(), which auto-pauses
 * the game, prompts the player, and records a defeat if they confirm leaving.
 */
@Injectable({ providedIn: 'root' })
export class GameLeaveGuard implements CanDeactivate<GameBoardComponent> {
  canDeactivate(component: GameBoardComponent): boolean {
    return component.canLeaveGame();
  }
}
