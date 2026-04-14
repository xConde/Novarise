import { Component, Input, OnChanges, OnDestroy, SimpleChanges, ViewEncapsulation } from '@angular/core';

export interface ChallengeIndicator {
  label: string;
  value: string;
  passing: boolean;
}

const PULSE_DURATION_MS = 300;

@Component({
  selector: 'app-game-hud',
  templateUrl: './game-hud.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class GameHudComponent implements OnChanges, OnDestroy {
  @Input() lives = 0;
  @Input() gold = 0;
  @Input() wave = 0;
  @Input() maxWaves = 0;
  @Input() score = 0;
  @Input() formattedTime = '00:00';
  @Input() isEndless = false;
  @Input() elapsedTime = 0;
  @Input() waveStartPulse = false;
  @Input() challengeIndicators: ChallengeIndicator[] = [];
  @Input() isCombat = false;
  @Input() enemiesRemaining = 0;
  @Input() currentEndlessTemplate: string | null = null;

  goldPulse = false;
  scorePulse = false;
  goldChange = 0;
  challengeStripExpanded = false;

  toggleChallengeStrip(): void {
    this.challengeStripExpanded = !this.challengeStripExpanded;
  }

  get passingCount(): number {
    return this.challengeIndicators.filter(c => c.passing).length;
  }

  get failingCount(): number {
    return this.challengeIndicators.filter(c => !c.passing).length;
  }

  private previousGold = 0;
  private previousScore = 0;
  private goldPulseTimer: ReturnType<typeof setTimeout> | null = null;
  private scorePulseTimer: ReturnType<typeof setTimeout> | null = null;
  private goldChangeTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['gold'] && !changes['gold'].firstChange) {
      const newGold = changes['gold'].currentValue as number;
      const delta = newGold - this.previousGold;
      if (delta !== 0) {
        this.triggerGoldPulse();
        if (delta > 0) {
          this.goldChange = delta;
          if (this.goldChangeTimer !== null) {
            clearTimeout(this.goldChangeTimer);
          }
          this.goldChangeTimer = setTimeout(() => {
            this.goldChange = 0;
            this.goldChangeTimer = null;
          }, PULSE_DURATION_MS);
        }
      }
      this.previousGold = newGold;
    }

    if (changes['score'] && !changes['score'].firstChange) {
      const newScore = changes['score'].currentValue as number;
      if (newScore !== this.previousScore) {
        this.triggerScorePulse();
      }
      this.previousScore = newScore;
    }
  }

  ngOnDestroy(): void {
    if (this.goldPulseTimer !== null) {
      clearTimeout(this.goldPulseTimer);
    }
    if (this.scorePulseTimer !== null) {
      clearTimeout(this.scorePulseTimer);
    }
    if (this.goldChangeTimer !== null) {
      clearTimeout(this.goldChangeTimer);
    }
  }

  private triggerGoldPulse(): void {
    this.goldPulse = true;
    if (this.goldPulseTimer !== null) {
      clearTimeout(this.goldPulseTimer);
    }
    this.goldPulseTimer = setTimeout(() => {
      this.goldPulse = false;
      this.goldPulseTimer = null;
    }, PULSE_DURATION_MS);
  }

  private triggerScorePulse(): void {
    this.scorePulse = true;
    if (this.scorePulseTimer !== null) {
      clearTimeout(this.scorePulseTimer);
    }
    this.scorePulseTimer = setTimeout(() => {
      this.scorePulse = false;
      this.scorePulseTimer = null;
    }, PULSE_DURATION_MS);
  }

}
