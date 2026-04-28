import { fakeAsync, tick } from '@angular/core/testing';
import { TurnBannerService } from './turn-banner.service';

describe('TurnBannerService', () => {
  let service: TurnBannerService;

  beforeEach(() => {
    service = new TurnBannerService();
  });

  afterEach(() => {
    service.cleanup();
  });

  it('starts hidden', () => {
    expect(service.showBanner).toBe(false);
  });

  it('shows the banner when flash() is called', () => {
    service.flash();
    expect(service.showBanner).toBe(true);
  });

  it('hides the banner after 1200ms', fakeAsync(() => {
    service.flash();
    tick(1199);
    expect(service.showBanner).toBe(true);
    tick(1);
    expect(service.showBanner).toBe(false);
  }));

  it('resets the timer when flash() is called twice in quick succession', fakeAsync(() => {
    service.flash();
    tick(800);
    expect(service.showBanner).toBe(true);

    // Second flash 800ms after the first should keep the banner up for
    // another full 1200ms (i.e. visible at t=800+1199=1999 from the first).
    service.flash();
    tick(1199);
    expect(service.showBanner).toBe(true);
    tick(1);
    expect(service.showBanner).toBe(false);
  }));

  it('cleanup() clears the timer and hides the banner', fakeAsync(() => {
    service.flash();
    expect(service.showBanner).toBe(true);
    service.cleanup();
    expect(service.showBanner).toBe(false);
    // Confirm no stale timer still firing — advancing time should not toggle anything.
    tick(2000);
    expect(service.showBanner).toBe(false);
  }));

  it('cleanup() is idempotent when called twice', () => {
    expect(() => {
      service.cleanup();
      service.cleanup();
    }).not.toThrow();
  });
});
