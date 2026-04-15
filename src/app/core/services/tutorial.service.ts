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
  // Strategy tips — shown on second game, after controls tutorial
  TIP_PLACEMENT = 'tip_placement',
  TIP_WAVE_PREVIEW = 'tip_wave_preview',
  TIP_UPGRADE = 'tip_upgrade',
}

export type TutorialStepType = 'tutorial' | 'tip';

export interface TutorialTip {
  id: string;
  step: TutorialStep;
  type: TutorialStepType;
  title: string;
  message: string;
  targetSelector?: string;
  position: 'top' | 'bottom' | 'center';
}

const TUTORIAL_STORAGE_KEY = 'novarise-tutorial';

/** All ordered steps for the controls tutorial (shown on first game). */
const TUTORIAL_STEPS_ORDERED: TutorialStep[] = [
  TutorialStep.WELCOME,
  TutorialStep.SELECT_TOWER,
  TutorialStep.PLACE_TOWER,
  TutorialStep.START_WAVE,
  TutorialStep.UPGRADE_TOWER,
  TutorialStep.COMPLETE,
];

/** Strategy tip steps shown after tutorial completes (on second game). */
const TIPS_STEPS_ORDERED: TutorialStep[] = [
  TutorialStep.TIP_PLACEMENT,
  TutorialStep.TIP_WAVE_PREVIEW,
  TutorialStep.TIP_UPGRADE,
];

const TUTORIAL_TIPS: Record<TutorialStep, TutorialTip> = {
  [TutorialStep.WELCOME]: {
    id: TutorialStep.WELCOME,
    step: TutorialStep.WELCOME,
    type: 'tutorial',
    title: 'Welcome to Novarise!',
    message: 'Defend your base by placing towers along the enemy path. Let\'s get started!',
    position: 'center',
  },
  [TutorialStep.SELECT_TOWER]: {
    id: TutorialStep.SELECT_TOWER,
    step: TutorialStep.SELECT_TOWER,
    type: 'tutorial',
    title: 'Select a Tower',
    message: 'Choose a tower from the bar below. Each type has different strengths. Try the Basic tower (press 1).',
    targetSelector: '.tower-selection',
    position: 'bottom',
  },
  [TutorialStep.PLACE_TOWER]: {
    id: TutorialStep.PLACE_TOWER,
    step: TutorialStep.PLACE_TOWER,
    type: 'tutorial',
    title: 'Place Your Tower',
    message: 'Click on a highlighted tile to place your tower. Towers attack enemies that come within range.',
    position: 'center',
  },
  [TutorialStep.START_WAVE]: {
    id: TutorialStep.START_WAVE,
    step: TutorialStep.START_WAVE,
    type: 'tutorial',
    title: 'Start the Wave',
    message: 'Press Space or click Start Wave to send enemies. Your towers will attack automatically.',
    targetSelector: '.setup-start-btn',
    position: 'top',
  },
  [TutorialStep.UPGRADE_TOWER]: {
    id: TutorialStep.UPGRADE_TOWER,
    step: TutorialStep.UPGRADE_TOWER,
    type: 'tutorial',
    title: 'Upgrade Your Tower',
    message: 'Click a placed tower to select it, then press U or click Upgrade to make it stronger.',
    targetSelector: '.tower-info-panel',
    position: 'top',
  },
  [TutorialStep.COMPLETE]: {
    id: TutorialStep.COMPLETE,
    step: TutorialStep.COMPLETE,
    type: 'tutorial',
    title: 'You\'re Ready!',
    message: 'You know the basics. Good luck defending Novarise! Press P anytime to pause and review keyboard shortcuts.',
    position: 'center',
  },
  [TutorialStep.TIP_PLACEMENT]: {
    id: TutorialStep.TIP_PLACEMENT,
    step: TutorialStep.TIP_PLACEMENT,
    type: 'tip',
    title: 'Place towers near path bends',
    message: 'Towers near bends and corners get more shots — enemies spend more time in range. Look for chokepoints!',
    position: 'center',
  },
  [TutorialStep.TIP_WAVE_PREVIEW]: {
    id: TutorialStep.TIP_WAVE_PREVIEW,
    step: TutorialStep.TIP_WAVE_PREVIEW,
    type: 'tip',
    title: 'Check wave preview',
    message: 'Before each wave, check the preview to see what\'s coming. Some enemies are immune to certain towers!',
    targetSelector: '.wave-preview',
    position: 'top',
  },
  [TutorialStep.TIP_UPGRADE]: {
    id: TutorialStep.TIP_UPGRADE,
    step: TutorialStep.TIP_UPGRADE,
    type: 'tip',
    title: 'Upgrade over expand',
    message: 'Upgrading existing towers is often better than buying new ones. Level 3 towers unlock powerful specializations!',
    position: 'center',
  },
};

interface TutorialStorageData {
  seenSteps: string[];
  gamesPlayed: number;
  tipsComplete: boolean;
}

@Injectable({ providedIn: 'root' })
export class TutorialService {
  private seenSteps: Set<string>;
  private tutorialComplete: boolean;
  private tipsComplete: boolean;
  private gamesPlayed: number;
  private readonly currentStep$: BehaviorSubject<TutorialStep | null>;

  constructor(private storageService: StorageService) {
    const saved = this.load();
    this.seenSteps = saved.seenSteps;
    this.tutorialComplete = this.seenSteps.has(TutorialStep.COMPLETE);
    this.tipsComplete = saved.tipsComplete;
    this.gamesPlayed = saved.gamesPlayed;
    this.currentStep$ = new BehaviorSubject<TutorialStep | null>(null);
  }

  /** Whether the controls tutorial has been completed or skipped. */
  isTutorialComplete(): boolean {
    return this.tutorialComplete;
  }

  /** Whether all strategy tips have been seen or skipped. */
  isTipsComplete(): boolean {
    return this.tipsComplete;
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

  /**
   * Start strategy tips. Only shows if:
   * - Controls tutorial is complete
   * - Tips not yet complete
   * - Player has played at least 2 games (not first game)
   */
  startTips(): void {
    if (!this.tutorialComplete) return;
    if (this.tipsComplete) return;
    if (this.gamesPlayed < 2) return;
    this.currentStep$.next(TutorialStep.TIP_PLACEMENT);
  }

  /**
   * Record that a new game session has started. Used to gate strategy tips
   * so they appear on the second game, not the first.
   */
  incrementGamesPlayed(): void {
    this.gamesPlayed += 1;
    this.save();
  }

  /** Advance to the next step. Marks current step as seen. */
  advanceStep(): void {
    const current = this.currentStep$.value;
    if (!current) return;
    this.seenSteps.add(current);

    // At the COMPLETE step, mark the controls tutorial done and stop.
    if (current === TutorialStep.COMPLETE) {
      this.markTutorialComplete();
      this.currentStep$.next(null);
      this.save();
      return;
    }

    const next = this.getNextStep(current);
    this.currentStep$.next(next);
    if (next === null) {
      // Reached end of tips
      this.markTipsComplete();
    }
    this.save();
  }

  /** Skip the entire active sequence immediately. */
  skipTutorial(): void {
    const current = this.currentStep$.value;
    if (current !== null && TIPS_STEPS_ORDERED.includes(current)) {
      // Skipping during tips — mark tips done
      this.markTipsComplete();
    } else {
      // Skipping during controls tutorial — mark both done
      this.markTutorialComplete();
    }
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
    this.tipsComplete = false;
    this.gamesPlayed = 0;
    this.currentStep$.next(null);
    this.storageService.remove(TUTORIAL_STORAGE_KEY);
  }

  /** Get the tip configuration for a given step. */
  getTip(step: TutorialStep): TutorialTip {
    return TUTORIAL_TIPS[step];
  }

  private getNextStep(current: TutorialStep): TutorialStep | null {
    // Check tips sequence first (tips come after the main tutorial)
    const tipsIdx = TIPS_STEPS_ORDERED.indexOf(current);
    if (tipsIdx >= 0) {
      if (tipsIdx >= TIPS_STEPS_ORDERED.length - 1) return null;
      return TIPS_STEPS_ORDERED[tipsIdx + 1];
    }
    const idx = TUTORIAL_STEPS_ORDERED.indexOf(current);
    if (idx < 0 || idx >= TUTORIAL_STEPS_ORDERED.length - 1) {
      return null;
    }
    return TUTORIAL_STEPS_ORDERED[idx + 1];
  }

  private markTutorialComplete(): void {
    this.tutorialComplete = true;
    this.seenSteps.add(TutorialStep.COMPLETE);
  }

  private markTipsComplete(): void {
    this.tipsComplete = true;
  }

  private load(): { seenSteps: Set<string>; tipsComplete: boolean; gamesPlayed: number } {
    const parsed = this.storageService.getJSON<TutorialStorageData | null>(
      TUTORIAL_STORAGE_KEY,
      null
    );
    if (!parsed || !Array.isArray(parsed.seenSteps)) {
      return { seenSteps: new Set<string>(), tipsComplete: false, gamesPlayed: 0 };
    }
    const seenSteps = new Set<string>(
      parsed.seenSteps.filter((s): s is string => typeof s === 'string')
    );
    const tipsComplete = parsed.tipsComplete === true;
    const gamesPlayed = typeof parsed.gamesPlayed === 'number' ? parsed.gamesPlayed : 0;
    return { seenSteps, tipsComplete, gamesPlayed };
  }

  private save(): void {
    const data: TutorialStorageData = {
      seenSteps: Array.from(this.seenSteps),
      tipsComplete: this.tipsComplete,
      gamesPlayed: this.gamesPlayed,
    };
    this.storageService.setJSON(TUTORIAL_STORAGE_KEY, data);
  }
}
