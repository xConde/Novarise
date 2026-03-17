import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from './storage.service';

export enum TutorialStep {
  WELCOME = 'welcome',
  SELECT_TOWER = 'select_tower',
  PLACE_TOWER = 'place_tower',
  START_WAVE = 'start_wave',
  UPGRADE_TOWER = 'upgrade_tower',
  COMPLETE = 'complete',
}

export interface TutorialTip {
  id: string;
  step: TutorialStep;
  title: string;
  message: string;
  targetSelector?: string;
  position: 'top' | 'bottom' | 'center';
}

const TUTORIAL_STORAGE_KEY = 'novarise-tutorial';

const TUTORIAL_STEPS_ORDERED: TutorialStep[] = [
  TutorialStep.WELCOME,
  TutorialStep.SELECT_TOWER,
  TutorialStep.PLACE_TOWER,
  TutorialStep.START_WAVE,
  TutorialStep.UPGRADE_TOWER,
  TutorialStep.COMPLETE,
];

const TUTORIAL_TIPS: Record<TutorialStep, TutorialTip> = {
  [TutorialStep.WELCOME]: {
    id: TutorialStep.WELCOME,
    step: TutorialStep.WELCOME,
    title: 'Welcome to Novarise!',
    message: 'Defend your base by placing towers along the enemy path. Let\'s get started!',
    position: 'center',
  },
  [TutorialStep.SELECT_TOWER]: {
    id: TutorialStep.SELECT_TOWER,
    step: TutorialStep.SELECT_TOWER,
    title: 'Select a Tower',
    message: 'Choose a tower from the bar below. Each type has different strengths. Try the Basic tower (press 1).',
    targetSelector: '.tower-selection',
    position: 'bottom',
  },
  [TutorialStep.PLACE_TOWER]: {
    id: TutorialStep.PLACE_TOWER,
    step: TutorialStep.PLACE_TOWER,
    title: 'Place Your Tower',
    message: 'Click on a highlighted tile to place your tower. Towers attack enemies that come within range.',
    position: 'center',
  },
  [TutorialStep.START_WAVE]: {
    id: TutorialStep.START_WAVE,
    step: TutorialStep.START_WAVE,
    title: 'Start the Wave',
    message: 'Press Space or click Start Wave to send enemies. Your towers will attack automatically.',
    targetSelector: '.setup-start-btn',
    position: 'top',
  },
  [TutorialStep.UPGRADE_TOWER]: {
    id: TutorialStep.UPGRADE_TOWER,
    step: TutorialStep.UPGRADE_TOWER,
    title: 'Upgrade Your Tower',
    message: 'Click a placed tower to select it, then press U or click Upgrade to make it stronger.',
    targetSelector: '.tower-info-panel',
    position: 'top',
  },
  [TutorialStep.COMPLETE]: {
    id: TutorialStep.COMPLETE,
    step: TutorialStep.COMPLETE,
    title: 'You\'re Ready!',
    message: 'You know the basics. Good luck defending Novarise! Press H anytime for keyboard shortcuts.',
    position: 'center',
  },
};

interface TutorialStorageData {
  seenSteps: string[];
}

@Injectable({ providedIn: 'root' })
export class TutorialService {
  private seenSteps: Set<string>;
  private tutorialComplete: boolean;
  private readonly currentStep$: BehaviorSubject<TutorialStep | null>;

  constructor(private storageService: StorageService) {
    this.seenSteps = this.load();
    this.tutorialComplete = this.seenSteps.has(TutorialStep.COMPLETE);
    this.currentStep$ = new BehaviorSubject<TutorialStep | null>(null);
  }

  /** Whether the full tutorial has been completed or skipped. */
  isTutorialComplete(): boolean {
    return this.tutorialComplete;
  }

  /** Observable of the current tutorial step (null = no active tutorial). */
  getCurrentStep(): Observable<TutorialStep | null> {
    return this.currentStep$.asObservable();
  }

  /** Start the tutorial sequence from the beginning. No-op if already complete. */
  startTutorial(): void {
    if (this.tutorialComplete) return;
    this.currentStep$.next(TutorialStep.WELCOME);
  }

  /** Advance to the next step. Marks current step as seen. */
  advanceStep(): void {
    const current = this.currentStep$.value;
    if (!current) return;
    this.seenSteps.add(current);
    const next = this.getNextStep(current);
    this.currentStep$.next(next);
    if (next === null) {
      this.completeTutorial();
    }
    this.save();
  }

  /** Skip the entire tutorial immediately. */
  skipTutorial(): void {
    this.completeTutorial();
    this.currentStep$.next(null);
    this.save();
  }

  /**
   * Reset the active tutorial step without clearing completion state.
   * Call this at the start of each game session so the active overlay
   * doesn't carry over from a previous session.
   */
  resetCurrentStep(): void {
    this.currentStep$.next(null);
  }

  /** Reset tutorial progress (can be used from settings). */
  resetTutorial(): void {
    this.seenSteps.clear();
    this.tutorialComplete = false;
    this.currentStep$.next(null);
    this.storageService.remove(TUTORIAL_STORAGE_KEY);
  }

  /** Get the tip configuration for a given step. */
  getTip(step: TutorialStep): TutorialTip {
    return TUTORIAL_TIPS[step];
  }

  private getNextStep(current: TutorialStep): TutorialStep | null {
    const idx = TUTORIAL_STEPS_ORDERED.indexOf(current);
    if (idx < 0 || idx >= TUTORIAL_STEPS_ORDERED.length - 1) {
      return null;
    }
    return TUTORIAL_STEPS_ORDERED[idx + 1];
  }

  private completeTutorial(): void {
    this.tutorialComplete = true;
    this.seenSteps.add(TutorialStep.COMPLETE);
  }

  private load(): Set<string> {
    const parsed = this.storageService.getJSON<TutorialStorageData | null>(
      TUTORIAL_STORAGE_KEY,
      null
    );
    if (!parsed || !Array.isArray(parsed.seenSteps)) return new Set<string>();
    return new Set<string>(parsed.seenSteps.filter((s): s is string => typeof s === 'string'));
  }

  private save(): void {
    const data: TutorialStorageData = { seenSteps: Array.from(this.seenSteps) };
    this.storageService.setJSON(TUTORIAL_STORAGE_KEY, data);
  }
}
