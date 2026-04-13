import { gameLeaveGuard } from './game-leave.guard';
import { GameComponent } from '../game.component';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';

/** Minimal stub matching the surface the guard cares about. */
function makeComponent(result: Observable<boolean> | boolean): Partial<GameComponent> {
  return {
    requestGuardDecision: jasmine.createSpy('requestGuardDecision').and.returnValue(result),
  };
}

describe('gameLeaveGuard', () => {
  const stubRoute = {} as ActivatedRouteSnapshot;
  const stubState = {} as RouterStateSnapshot;
  const stubCurrentState = {} as RouterStateSnapshot;

  it('delegates to component.requestGuardDecision() and returns true (boolean)', () => {
    const component = makeComponent(true);
    const result = gameLeaveGuard(
      component as GameComponent,
      stubRoute,
      stubState,
      stubCurrentState
    );
    expect(component.requestGuardDecision).toHaveBeenCalled();
    expect(result).toBeTrue();
  });

  it('delegates to component.requestGuardDecision() and returns false (boolean)', () => {
    const component = makeComponent(false);
    const result = gameLeaveGuard(
      component as GameComponent,
      stubRoute,
      stubState,
      stubCurrentState
    );
    expect(component.requestGuardDecision).toHaveBeenCalled();
    expect(result).toBeFalse();
  });

  it('returns an Observable<boolean> for async confirmation', (done) => {
    const obs = of(true);
    const component = makeComponent(obs);
    const result = gameLeaveGuard(
      component as GameComponent,
      stubRoute,
      stubState,
      stubCurrentState
    );
    expect(component.requestGuardDecision).toHaveBeenCalled();
    (result as Observable<boolean>).subscribe(value => {
      expect(value).toBeTrue();
      done();
    });
  });
});
