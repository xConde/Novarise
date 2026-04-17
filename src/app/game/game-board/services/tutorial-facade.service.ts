import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { TutorialService, TutorialStep, TutorialTip } from '../../../core/services/tutorial.service';

/**
 * Facade that owns the tutorial state, subscription, and display logic
 * extracted from GameBoardComponent.
 *
 * @Injectable() (not providedIn: 'root') — component-scoped.
 */
@Injectable()
export class TutorialFacadeService implements OnDestroy {
  /** The currently active tutorial step (null = tutorial not active). */
  currentTutorialStep: TutorialStep | null = null;

  private tutorialSub: Subscription | null = null;

  /** Controls tutorial steps shown to the user (excludes COMPLETE and tip steps). */
  private readonly tutorialDisplaySteps: TutorialStep[] = [
    TutorialStep.WELCOME,
    TutorialStep.SELECT_TOWER,
    TutorialStep.PLACE_TOWER,
    TutorialStep.START_WAVE,
    TutorialStep.UPGRADE_TOWER,
    TutorialStep.COMPLETE,
  ];

  /** Strategy tip steps (separate sequence). */
  private readonly tipsDisplaySteps: TutorialStep[] = [
    TutorialStep.TIP_PLACEMENT,
    TutorialStep.TIP_WAVE_PREVIEW,
    TutorialStep.TIP_UPGRADE,
  ];

  constructor(private tutorialService: TutorialService) {}

  /** Subscribe to the tutorial step stream. Call in ngOnInit. */
  init(): void {
    this.tutorialSub = this.tutorialService.getCurrentStep().subscribe({
      next: step => { this.currentTutorialStep = step; },
      error: (error: unknown) => console.error('Tutorial subscription error:', error),
    });
  }

  /** Unsubscribe. Call in ngOnDestroy. */
  cleanup(): void {
    if (this.tutorialSub) {
      this.tutorialSub.unsubscribe();
      this.tutorialSub = null;
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  getTutorialTip(): TutorialTip | null {
    return this.currentTutorialStep
      ? this.tutorialService.getTip(this.currentTutorialStep)
      : null;
  }

  getTutorialStepNumber(): number {
    const step = this.currentTutorialStep;
    if (!step) return 0;
    const tipIdx = this.tipsDisplaySteps.indexOf(step);
    if (tipIdx >= 0) return tipIdx + 1;
    const idx = this.tutorialDisplaySteps.indexOf(step);
    return Math.max(1, idx + 1);
  }

  getTutorialTotalSteps(): number {
    const step = this.currentTutorialStep;
    if (!step) return 0;
    if (this.tipsDisplaySteps.includes(step)) return this.tipsDisplaySteps.length;
    return this.tutorialDisplaySteps.length;
  }

  advanceTutorial(): void {
    this.tutorialService.advanceStep();
  }

  skipTutorial(): void {
    this.tutorialService.skipTutorial();
  }
}
