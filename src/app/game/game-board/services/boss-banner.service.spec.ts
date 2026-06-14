import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BossBannerService } from './boss-banner.service';
import { UI_CONFIG, BOSS_BANNER_COPY } from '../constants/ui.constants';

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

  it('subtext is empty by default', () => {
    expect(service.subtext).toBe('');
  });

  it('flash() makes showBanner true and sets text', fakeAsync(() => {
    service.flash(BOSS_BANNER_COPY.generic.headline);
    expect(service.showBanner).toBeTrue();
    expect(service.text).toBe(BOSS_BANNER_COPY.generic.headline);
    tick(UI_CONFIG.bossBannerVisibleMs);
  }));

  it('flash() auto-hides after bossBannerVisibleMs when no duration override', fakeAsync(() => {
    service.flash(BOSS_BANNER_COPY.generic.headline);
    expect(service.showBanner).toBeTrue();
    tick(UI_CONFIG.bossBannerVisibleMs);
    expect(service.showBanner).toBeFalse();
  }));

  it('flash() with subtext option stores subtext', fakeAsync(() => {
    service.flash(BOSS_BANNER_COPY.novaSovereign.headline, {
      subtext: BOSS_BANNER_COPY.novaSovereign.subtext,
    });
    expect(service.text).toBe(BOSS_BANNER_COPY.novaSovereign.headline);
    expect(service.subtext).toBe(BOSS_BANNER_COPY.novaSovereign.subtext);
    tick(UI_CONFIG.bossBannerExtendedMs);
  }));

  it('flash() with durationMs override hides after the custom duration', fakeAsync(() => {
    service.flash(BOSS_BANNER_COPY.novaSovereign.headline, {
      durationMs: UI_CONFIG.bossBannerExtendedMs,
    });
    expect(service.showBanner).toBeTrue();
    // Still visible before extended duration
    tick(UI_CONFIG.bossBannerVisibleMs);
    expect(service.showBanner).toBeTrue();
    // Hidden after extended duration
    tick(UI_CONFIG.bossBannerExtendedMs - UI_CONFIG.bossBannerVisibleMs);
    expect(service.showBanner).toBeFalse();
  }));

  it('calling flash() again resets the timer and updates text and subtext', fakeAsync(() => {
    service.flash(BOSS_BANNER_COPY.generic.headline);
    tick(UI_CONFIG.bossBannerVisibleMs - 100);
    service.flash(BOSS_BANNER_COPY.novaSovereign.headline, {
      subtext: BOSS_BANNER_COPY.novaSovereign.subtext,
      durationMs: UI_CONFIG.bossBannerExtendedMs,
    });
    expect(service.text).toBe(BOSS_BANNER_COPY.novaSovereign.headline);
    expect(service.subtext).toBe(BOSS_BANNER_COPY.novaSovereign.subtext);
    expect(service.showBanner).toBeTrue();
    // Original timer is cancelled; new extended duration must pass before hide
    tick(UI_CONFIG.bossBannerExtendedMs - 1);
    expect(service.showBanner).toBeTrue();
    tick(1);
    expect(service.showBanner).toBeFalse();
  }));

  it('cleanup() clears the timer, hides the banner, and clears subtext', fakeAsync(() => {
    service.flash(BOSS_BANNER_COPY.wyrmAscendant.headline, {
      subtext: BOSS_BANNER_COPY.wyrmAscendant.subtext,
      durationMs: UI_CONFIG.bossBannerExtendedMs,
    });
    service.cleanup();
    expect(service.showBanner).toBeFalse();
    expect(service.text).toBe('');
    expect(service.subtext).toBe('');
    tick(UI_CONFIG.bossBannerExtendedMs);
  }));

  it('cleanup() is idempotent when called with no active timer', () => {
    expect(() => service.cleanup()).not.toThrow();
    expect(() => service.cleanup()).not.toThrow();
  });

  describe('BOSS_BANNER_COPY constants', () => {
    it('novaSovereign has a non-empty headline', () => {
      expect(BOSS_BANNER_COPY.novaSovereign.headline.length).toBeGreaterThan(0);
    });

    it('novaSovereign has a mechanic subtext line', () => {
      expect(BOSS_BANNER_COPY.novaSovereign.subtext.length).toBeGreaterThan(0);
    });

    it('wyrmAscendant has a non-empty headline', () => {
      expect(BOSS_BANNER_COPY.wyrmAscendant.headline.length).toBeGreaterThan(0);
    });

    it('wyrmAscendant has a mechanic subtext line', () => {
      expect(BOSS_BANNER_COPY.wyrmAscendant.subtext.length).toBeGreaterThan(0);
    });

    it('generic has an empty subtext (headline-only boss)', () => {
      expect(BOSS_BANNER_COPY.generic.subtext).toBe('');
    });

    it('bossBannerExtendedMs is greater than bossBannerVisibleMs', () => {
      expect(UI_CONFIG.bossBannerExtendedMs).toBeGreaterThan(UI_CONFIG.bossBannerVisibleMs);
    });
  });
});
