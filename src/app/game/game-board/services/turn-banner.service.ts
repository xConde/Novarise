import { Injectable } from '@angular/core';

const TURN_BANNER_VISIBLE_MS = 1200;

/**
 * TurnBannerService — owns the brief "Turn N" banner that flashes after
 * endTurn() while the encounter remains in COMBAT phase.
 *
 * Component-scoped (provided in GameBoardComponent.providers). Discarded
 * with the component; cleanup() must be called from ngOnDestroy.
 */
@Injectable()
export class TurnBannerService {
  private visible = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Read-only flag bound by the game-board template via a component getter. */
  get showBanner(): boolean {
    return this.visible;
  }

  /**
   * Show the banner for ~1.2s. Calling again resets the timer so the banner
   * stays visible across rapid back-to-back turn transitions.
   */
  flash(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.visible = true;
    this.timer = setTimeout(() => {
      this.visible = false;
      this.timer = null;
    }, TURN_BANNER_VISIBLE_MS);
  }

  /** Clears any pending hide timer. Idempotent. */
  cleanup(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.visible = false;
  }
}
