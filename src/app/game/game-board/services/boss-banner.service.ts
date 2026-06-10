import { Injectable } from '@angular/core';
import { UI_CONFIG } from '../constants/ui.constants';

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
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Read-only flag bound by the game-board template. */
  get showBanner(): boolean {
    return this.visible;
  }

  /** Copy line shown inside the banner. */
  get text(): string {
    return this.bannerText;
  }

  /**
   * Show the boss banner with the given copy for BOSS_BANNER_VISIBLE_MS.
   * Calling again while the banner is already visible resets the timer and
   * updates the text (handles back-to-back waves in the same encounter).
   */
  flash(text: string): void {
    this.bannerText = text;
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.visible = true;
    this.timer = setTimeout(() => {
      this.visible = false;
      this.timer = null;
    }, UI_CONFIG.bossBannerVisibleMs);
  }

  /** Clears any pending hide timer and hides the banner. Idempotent. */
  cleanup(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.visible = false;
    this.bannerText = '';
  }
}
