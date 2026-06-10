import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { BossBannerService } from './boss-banner.service';
import { UI_CONFIG } from '../constants/ui.constants';

describe('BossBannerService', () => {
  let service: BossBannerService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [BossBannerService] });
    service = TestBed.inject(BossBannerService);
  });

  afterEach(() => {
    service.cleanup();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('showBanner is false by default', () => {
    expect(service.showBanner).toBeFalse();
  });

  it('text is empty by default', () => {
    expect(service.text).toBe('');
  });

  it('flash() makes showBanner true and sets text', fakeAsync(() => {
    service.flash('⚠ BOSS INCOMING');
    expect(service.showBanner).toBeTrue();
    expect(service.text).toBe('⚠ BOSS INCOMING');
    tick(UI_CONFIG.bossBannerVisibleMs);
  }));

  it('flash() auto-hides after bossBannerVisibleMs', fakeAsync(() => {
    service.flash('⚠ BOSS INCOMING');
    expect(service.showBanner).toBeTrue();
    tick(UI_CONFIG.bossBannerVisibleMs);
    expect(service.showBanner).toBeFalse();
  }));

  it('calling flash() again resets the timer and updates text', fakeAsync(() => {
    service.flash('⚠ BOSS INCOMING');
    tick(UI_CONFIG.bossBannerVisibleMs - 100);
    service.flash('⚠ THE SOVEREIGN MANIFESTS');
    expect(service.text).toBe('⚠ THE SOVEREIGN MANIFESTS');
    expect(service.showBanner).toBeTrue();
    // Original timer is cancelled; new full duration must pass before hide
    tick(UI_CONFIG.bossBannerVisibleMs - 1);
    expect(service.showBanner).toBeTrue();
    tick(1);
    expect(service.showBanner).toBeFalse();
  }));

  it('cleanup() clears the timer and hides the banner', fakeAsync(() => {
    service.flash('⚠ BOSS INCOMING');
    service.cleanup();
    expect(service.showBanner).toBeFalse();
    expect(service.text).toBe('');
    // No pending timer left — tick should not error
    tick(UI_CONFIG.bossBannerVisibleMs);
  }));

  it('cleanup() is idempotent when called with no active timer', () => {
    expect(() => service.cleanup()).not.toThrow();
    expect(() => service.cleanup()).not.toThrow();
  });
});
