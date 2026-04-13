import { gameLeaveGuard } from './game-leave.guard';
import { GameComponent } from '../game.component';
import { GamePhase } from '../game-board/models/game-state.model';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

/** Minimal stub matching the surface the guard cares about. */
function makeComponent(canLeaveResult: boolean): Partial<GameComponent> {
  return {
    canLeaveGame: jasmine.createSpy('canLeaveGame').and.returnValue(canLeaveResult),
  };
}

describe('gameLeaveGuard', () => {
  const stubRoute = {} as ActivatedRouteSnapshot;
  const stubState = {} as RouterStateSnapshot;
  const stubCurrentState = {} as RouterStateSnapshot;

  it('delegates to component.canLeaveGame() and returns true', () => {
    const component = makeComponent(true);
    const result = gameLeaveGuard(
      component as GameComponent,
      stubRoute,
      stubState,
      stubCurrentState
    );
    expect(component.canLeaveGame).toHaveBeenCalled();
    expect(result).toBeTrue();
  });

  it('delegates to component.canLeaveGame() and returns false', () => {
    const component = makeComponent(false);
    const result = gameLeaveGuard(
      component as GameComponent,
      stubRoute,
      stubState,
      stubCurrentState
    );
    expect(component.canLeaveGame).toHaveBeenCalled();
    expect(result).toBeFalse();
  });
});
