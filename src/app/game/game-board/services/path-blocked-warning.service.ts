import { Injectable } from '@angular/core';
import { UI_CONFIG } from '../constants/ui.constants';

/**
 * PathBlockedWarningService — owns the transient "path blocked" warning that
 * surfaces when the player tries to place a tower on a tile that would seal
 * off all paths to an exit. Auto-dismisses after UI_CONFIG.pathBlockedDismissMs.
 *
 * Component-scoped (provided in GameBoardComponent.providers). Discarded with
 * the component; cleanup() must be called from ngOnDestroy.
 */
@Injectable()
export class PathBlockedWarningService {
  private active = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Read-only flag bound by the game-board template via a component getter. */
  get blocked(): boolean {
    return this.active;
  }

  /**
   * Show the warning banner. Calling again resets the dismiss timer so the
   * warning stays visible across rapid back-to-back invalid placements.
   */
  show(): void {
    this.active = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.active = false;
      this.timer = null;
    }, UI_CONFIG.pathBlockedDismissMs);
  }

  /** Clears any pending hide timer. Idempotent. */
  cleanup(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.active = false;
  }
}
