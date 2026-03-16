import { TestBed } from '@angular/core/testing';
import { GameLeaveGuard } from './game-leave.guard';
import { GameBoardComponent } from '../game-board/game-board.component';
import { GamePhase } from '../game-board/models/game-state.model';

/** Minimal stub matching the surface the guard cares about. */
function makeComponent(phase: GamePhase, canLeaveResult: boolean): Partial<GameBoardComponent> {
  return {
    canLeaveGame: jasmine.createSpy('canLeaveGame').and.returnValue(canLeaveResult),
  };
}

describe('GameLeaveGuard', () => {
  let guard: GameLeaveGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GameLeaveGuard],
    });
    guard = TestBed.inject(GameLeaveGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('delegates entirely to component.canLeaveGame() and returns its result (true)', () => {
    const component = makeComponent(GamePhase.SETUP, true);
    const result = guard.canDeactivate(component as GameBoardComponent);
    expect(component.canLeaveGame).toHaveBeenCalled();
    expect(result).toBeTrue();
  });

  it('delegates entirely to component.canLeaveGame() and returns its result (false)', () => {
    const component = makeComponent(GamePhase.COMBAT, false);
    const result = guard.canDeactivate(component as GameBoardComponent);
    expect(component.canLeaveGame).toHaveBeenCalled();
    expect(result).toBeFalse();
  });
});
