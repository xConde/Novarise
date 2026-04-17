import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RunPersistenceService } from '../run/services/run-persistence.service';
import { RunService } from '../run/services/run.service';
import { ASCENSION_LEVELS, MAX_ASCENSION_LEVEL } from '../run/models/ascension.model';

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
   * Returns a one-line preview of the cumulative modifier for the selected
   * ascension level, or null at A0 (no modifiers active).
   */
  getAscensionPreview(): string | null {
    if (this.selectedAscension === 0) return null;
    const def = ASCENSION_LEVELS[this.selectedAscension - 1];
    return `A${this.selectedAscension}: ${def.description}`;
  }

  /** Whether the player has mastered ascension (beaten A20). */
  get isAscensionMastered(): boolean {
    return this.runPersistence.isAscensionMastered();
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
