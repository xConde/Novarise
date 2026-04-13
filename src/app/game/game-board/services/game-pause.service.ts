import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { take } from 'rxjs/operators';
import { GameStateService } from './game-state.service';
import { MinimapService } from './minimap.service';
import { GameEndService } from './game-end.service';
import { GamePhase } from '../models/game-state.model';
import { EncounterCheckpointService } from '../../../run/services/encounter-checkpoint.service';

/**
 * Manages pause/resume, auto-pause on visibility loss, and quit confirmation.
 * Extracted from GameBoardComponent (Hardening VIII S11).
 *
 * Focus trapping remains in the component (DOM concern — requires ViewChild).
 */
@Injectable()
export class GamePauseService implements OnDestroy {
  private visibilityChangeHandler: (() => void) | null = null;
  private windowBlurPauseHandler: (() => void) | null = null;

  /** Whether the quit-confirmation sub-panel is visible. */
  showQuitConfirm = false;

  /** Whether the current pause was triggered by auto-pause (tab switch / window blur). */
  autoPaused = false;

  /** Whether the pause was triggered by the navigation guard (external nav attempt). */
  showNavigationPrompt = false;

  /** Subject for guard navigation decisions. */
  private guardDecision$ = new Subject<boolean>();

  /** Set to true to allow the next navigation without guard prompt. */
  private pendingAllowNavigation = false;

  /** Callback invoked when auto-pause triggers — component uses this to activate focus trap. */
  onAutoPause: (() => void) | null = null;

  constructor(
    private gameStateService: GameStateService,
    private minimapService: MinimapService,
    private gameEndService: GameEndService,
    private encounterCheckpointService: EncounterCheckpointService,
  ) {}

  get isPaused(): boolean {
    return this.gameStateService.getState().isPaused;
  }

  /**
   * Toggle pause on/off. Returns true if the game is now paused (for focus trap activation).
   */
  togglePause(): boolean {
    this.showQuitConfirm = false;
    this.autoPaused = false;
    const willPause = !this.isPaused;
    this.gameStateService.togglePause();
    this.minimapService.setDimmed(willPause);
    return willPause;
  }

  /** Register visibility/focus-loss listeners for auto-pause. Call once after view init. */
  setupAutoPause(): void {
    this.visibilityChangeHandler = () => this.onVisibilityChange();
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);

    this.windowBlurPauseHandler = () => this.onWindowBlurPause();
    window.addEventListener('blur', this.windowBlurPauseHandler);
  }

  requestQuit(): void {
    this.showQuitConfirm = true;
  }

  cancelQuit(): void {
    this.showQuitConfirm = false;
  }

  /**
   * Confirm quit: record defeat and return the navigation target route.
   * Phase H12: post-pivot there is no campaign/standalone distinction —
   * all quits abandon the current run and return to the run hub.
   * @returns The route to navigate to (always '/run').
   */
  confirmQuit(): string {
    this.showQuitConfirm = false;
    this.encounterCheckpointService.clearCheckpoint();
    this.gameEndService.recordEnd(false, null);
    return '/run';
  }

  /** Allow the next navigation attempt to proceed without guard prompt. */
  allowNextNavigation(): void {
    this.pendingAllowNavigation = true;
  }

  /**
   * Called by the CanDeactivate guard when the player tries to navigate away
   * during COMBAT or INTERMISSION. Auto-pauses the game and shows the
   * navigation prompt in the pause menu.
   * Returns an Observable that resolves when the player chooses an action.
   */
  requestGuardDecision(): Observable<boolean> {
    // Check if navigation was pre-approved (e.g., Save & Exit from manual pause)
    if (this.pendingAllowNavigation) {
      this.pendingAllowNavigation = false;
      return new Observable(subscriber => {
        subscriber.next(true);
        subscriber.complete();
      });
    }

    const state = this.gameStateService.getState();

    // Terminal phases — allow navigation immediately
    if (
      state.phase === GamePhase.SETUP ||
      state.phase === GamePhase.VICTORY ||
      state.phase === GamePhase.DEFEAT
    ) {
      return new Observable(subscriber => {
        subscriber.next(true);
        subscriber.complete();
      });
    }

    // Auto-pause if not already paused
    if (!state.isPaused) {
      this.gameStateService.togglePause();
      this.minimapService.setDimmed(true);
    }

    this.showNavigationPrompt = true;
    this.showQuitConfirm = false;

    return this.guardDecision$.pipe(take(1));
  }

  /**
   * Resolve the pending guard decision. Called by pause menu actions.
   * @param allow - true to allow navigation, false to cancel
   */
  resolveGuardDecision(allow: boolean): void {
    this.showNavigationPrompt = false;
    this.guardDecision$.next(allow);
  }

  /** Reset pause-related state (called on game restart). */
  reset(): void {
    this.autoPaused = false;
    this.showQuitConfirm = false;
    this.showNavigationPrompt = false;
    this.pendingAllowNavigation = false;
  }

  /** Clean up global event listeners and clear the auto-pause callback. */
  cleanup(): void {
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
    if (this.windowBlurPauseHandler) {
      window.removeEventListener('blur', this.windowBlurPauseHandler);
      this.windowBlurPauseHandler = null;
    }
    this.onAutoPause = null;
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  // --- Private ---

  private onVisibilityChange(): void {
    if (document.hidden) {
      this.autoPauseIfActive();
    }
  }

  private onWindowBlurPause(): void {
    this.autoPauseIfActive();
  }

  /**
   * Auto-pause when tab/window loses focus during active gameplay.
   * Returns true if auto-pause was triggered (component should activate focus trap).
   */
  private autoPauseIfActive(): boolean {
    const state = this.gameStateService.getState();
    if ((state.phase === GamePhase.COMBAT || state.phase === GamePhase.INTERMISSION) && !state.isPaused) {
      this.gameStateService.togglePause();
      this.minimapService.setDimmed(true);
      this.autoPaused = true;
      this.onAutoPause?.();
      return true;
    }
    return false;
  }
}
