import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RunPersistenceService } from '../run/services/run-persistence.service';

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
 */
@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements OnInit {
  hasSavedRun = false;

  constructor(
    private router: Router,
    private runPersistence: RunPersistenceService,
  ) {}

  ngOnInit(): void {
    this.hasSavedRun = this.runPersistence.hasSavedRun();
  }

  /** Start a brand-new run. Clears any saved run first — confirmation UI
   *  lives in a hardening phase; for now the button label swaps to
   *  "Start New Run" when a saved run exists so the destructive action is
   *  explicit. */
  startNewRun(): void {
    this.runPersistence.clearSavedRun();
    this.router.navigate(['/run']);
  }

  /** Resume the existing saved run. No-op if nothing is saved. */
  continueRun(): void {
    if (!this.hasSavedRun) return;
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
