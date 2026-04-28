import { fakeAsync, tick } from '@angular/core/testing';
import { PathBlockedWarningService } from './path-blocked-warning.service';
import { UI_CONFIG } from '../constants/ui.constants';

describe('PathBlockedWarningService', () => {
  let service: PathBlockedWarningService;

  beforeEach(() => {
    service = new PathBlockedWarningService();
  });

  afterEach(() => {
    service.cleanup();
  });

  it('starts inactive', () => {
    expect(service.blocked).toBe(false);
  });

  it('show() activates the warning', () => {
    service.show();
    expect(service.blocked).toBe(true);
  });

  it('auto-dismisses after pathBlockedDismissMs', fakeAsync(() => {
    service.show();
    tick(UI_CONFIG.pathBlockedDismissMs - 1);
    expect(service.blocked).toBe(true);
    tick(1);
    expect(service.blocked).toBe(false);
  }));

  it('show() called again resets the dismiss timer', fakeAsync(() => {
    service.show();
    tick(UI_CONFIG.pathBlockedDismissMs - 100);
    expect(service.blocked).toBe(true);

    service.show();
    tick(UI_CONFIG.pathBlockedDismissMs - 1);
    expect(service.blocked).toBe(true);
    tick(1);
    expect(service.blocked).toBe(false);
  }));

  it('cleanup() clears the timer and deactivates the warning', fakeAsync(() => {
    service.show();
    expect(service.blocked).toBe(true);
    service.cleanup();
    expect(service.blocked).toBe(false);
    tick(UI_CONFIG.pathBlockedDismissMs * 2);
    expect(service.blocked).toBe(false);
  }));

  it('cleanup() is idempotent', () => {
    expect(() => {
      service.cleanup();
      service.cleanup();
    }).not.toThrow();
  });
});
