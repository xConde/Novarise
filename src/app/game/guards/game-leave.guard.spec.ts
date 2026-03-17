import { gameLeaveGuard } from './game-leave.guard';
import { GameBoardComponent } from '../game-board/game-board.component';
import { GamePhase } from '../game-board/models/game-state.model';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

/** Minimal stub matching the surface the guard cares about. */
function makeComponent(phase: GamePhase, canLeaveResult: boolean): Partial<GameBoardComponent> {
  return {
    canLeaveGame: jasmine.createSpy('canLeaveGame').and.returnValue(canLeaveResult),
  };
}

describe('gameLeaveGuard', () => {
  const stubRoute = {} as ActivatedRouteSnapshot;
  const stubState = {} as RouterStateSnapshot;
  const stubCurrentState = {} as RouterStateSnapshot;

  it('delegates entirely to component.canLeaveGame() and returns its result (true)', () => {
    const component = makeComponent(GamePhase.SETUP, true);
    const result = gameLeaveGuard(
      component as GameBoardComponent,
      stubRoute,
      stubState,
      stubCurrentState
    );
    expect(component.canLeaveGame).toHaveBeenCalled();
    expect(result).toBeTrue();
  });

  it('delegates entirely to component.canLeaveGame() and returns its result (false)', () => {
    const component = makeComponent(GamePhase.COMBAT, false);
    const result = gameLeaveGuard(
      component as GameBoardComponent,
      stubRoute,
      stubState,
      stubCurrentState
    );
    expect(component.canLeaveGame).toHaveBeenCalled();
    expect(result).toBeFalse();
  });
});
