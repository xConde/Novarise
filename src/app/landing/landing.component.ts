import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RunPersistenceService } from '../run/services/run-persistence.service';
import { RunService } from '../run/services/run.service';
import { ASCENSION_LEVELS, AscensionLevel, MAX_ASCENSION_LEVEL } from '../run/models/ascension.model';

/**
 * Phase 9: Landing component repurposed as the Run Hub.
 *
 * Presents the player with "Start Run", "Continue Run" (if a saved run exists),
 * and a Map Editor entry. Replaces the pre-pivot landing page that surfaced
 * Campaign, Quick Play, Map Select, and Profile — all deleted in Phase 8.
 *
 * Profile is deferred to a hardening phase (needs a demoted side-screen
 * accessible via a Home button). Run stats fields were migrated from pre-pivot
 * ascent* names to run* names in M5 S10.
 *
 * Ascension selector (ascension-unlock cluster): shown only when maxAscension > 0.
 * Defaults to the highest unlocked level so returning players skip clicks.
 * Stepper clamps to [0, maxAscension].
 */
@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements OnInit {
  hasSavedRun = false;

  /** Highest ascension level the player has unlocked. */
  maxAscension = 0;

  /** Currently selected ascension for the next run. Defaults to maxAscension. */
  selectedAscension = 0;

  constructor(
    private router: Router,
    private runPersistence: RunPersistenceService,
    private runService: RunService,
  ) {}

  ngOnInit(): void {
    this.hasSavedRun = this.runPersistence.hasSavedRun();
    this.maxAscension = this.runPersistence.getMaxAscension();
    // Default to highest unlocked level so returning players don't have to step up.
    this.selectedAscension = this.maxAscension;
  }

  /** Step the ascension selector by delta, clamped to [0, maxAscension]. */
  stepAscension(delta: number): void {
    this.selectedAscension = Math.min(
      MAX_ASCENSION_LEVEL,
      Math.max(0, Math.min(this.maxAscension, this.selectedAscension + delta)),
    );
  }

  /**
   * The full A1 → A_selected modifier stack. Players picking A5 should see
   * that ALL of A1..A5 modifiers stack, not just the topmost level. Empty
   * when selectedAscension is 0.
   */
  getAscensionStack(): readonly AscensionLevel[] {
    if (this.selectedAscension <= 0) return [];
    return ASCENSION_LEVELS.slice(0, this.selectedAscension);
  }

  /** Whether the player has mastered ascension (beaten A20). */
  get isAscensionMastered(): boolean {
    return this.runPersistence.isAscensionMastered();
  }

  /**
   * Highest ascension level the player has beaten. maxAscension is the
   * highest-unlocked level (= beaten + 1), so this returns maxAscension - 1
   * floored at 0. Returns 0 when no ascension has been beaten yet.
   */
  get highestBeatenAscension(): number {
    return Math.max(0, this.maxAscension - 1);
  }

  /**
   * True when a "Best: A_N" badge should display on the selector — not
   * when the player has mastered (A20 ✓ pill takes precedence) and not
   * when they haven't beaten anything past A0 yet.
   */
  get showBeatenBadge(): boolean {
    return !this.isAscensionMastered && this.highestBeatenAscension >= 1;
  }

  /** Start a brand-new run. Clears any saved run first — confirmation UI
   *  lives in a hardening phase; for now the button label swaps to
   *  "Start New Run" when a saved run exists so the destructive action is
   *  explicit. */
  startNewRun(): void {
    this.runPersistence.clearSavedRun();
    this.runService.startNewRun(this.selectedAscension);
    this.router.navigate(['/run']);
  }

  /** Resume the existing saved run. No-op if nothing is saved. */
  continueRun(): void {
    if (!this.hasSavedRun) return;
    this.runService.resumeRun();
    this.router.navigate(['/run']);
  }

  /** Launch the dev map editor. */
  goToEditor(): void {
    this.router.navigate(['/edit']);
  }

  /** H4: demoted profile — reachable from Home, not the nav header. */
  goToProfile(): void {
    this.router.navigate(['/profile']);
  }
}
