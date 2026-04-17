import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';
import { GameComponent } from '../game.component';

/**
 * Prevents accidental navigation away from an active game.
 * Returns Observable<boolean> for async pause-menu confirmation,
 * or boolean for immediate allow (terminal phases).
 */
export const gameLeaveGuard: CanDeactivateFn<GameComponent> = (
  component: GameComponent
): Observable<boolean> | boolean => {
  return component.requestGuardDecision();
};
