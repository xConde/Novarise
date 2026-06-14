import { Injectable } from '@angular/core';
import { UI_CONFIG } from '../constants/ui.constants';

/** Options accepted by {@link BossBannerService.flash}. */
export interface BossBannerOptions {
  /**
   * Optional mechanic-hint line rendered beneath the headline.
   * Leave empty string or omit to show the headline only.
   */
  subtext?: string;
  /**
   * Override the auto-hide duration in ms.
   * Defaults to `UI_CONFIG.bossBannerVisibleMs` when omitted.
   * Use `UI_CONFIG.bossBannerExtendedMs` for named bosses with subtext.
   */
  durationMs?: number;
}

/**
 * BossBannerService — owns the boss-intro banner that fires when a boss-tier
 * wave begins.
 *
 * Follows the same pattern as TurnBannerService: single visible flag, single
 * clearTimeout timer, cleanup() called from ngOnDestroy.
 *
 * Component-scoped (provided in GameBoardComponent.providers).
 */
@Injectable()
export class BossBannerService {
  private visible = false;
  private bannerText = '';
  private bannerSubtext = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Read-only flag bound by the game-board template. */
  get showBanner(): boolean {
    return this.visible;
  }

  /** Headline copy line shown inside the banner. */
  get text(): string {
    return this.bannerText;
  }

  /**
   * Optional mechanic-hint line shown beneath the headline.
   * Empty string when the current banner has no subtext.
   */
  get subtext(): string {
    return this.bannerSubtext;
  }

  /**
   * Show the boss banner with the given headline and optional options.
   * Calling again while the banner is already visible resets the timer and
   * updates the copy (handles back-to-back waves in the same encounter).
   */
  flash(headline: string, options: BossBannerOptions = {}): void {
    this.bannerText = headline;
    this.bannerSubtext = options.subtext ?? '';
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.visible = true;
    const durationMs = options.durationMs ?? UI_CONFIG.bossBannerVisibleMs;
    this.timer = setTimeout(() => {
      this.visible = false;
      this.timer = null;
    }, durationMs);
  }

  /** Clears any pending hide timer and hides the banner. Idempotent. */
  cleanup(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.visible = false;
    this.bannerText = '';
    this.bannerSubtext = '';
  }
}
