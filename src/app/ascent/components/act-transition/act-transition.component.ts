import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-act-transition',
  templateUrl: './act-transition.component.html',
  styleUrls: ['./act-transition.component.scss'],
})
export class ActTransitionComponent {
  /** 0-based act index that was just completed. */
  @Input() completedAct!: number;

  /** Name of the boss that was defeated (empty string if not a boss encounter). */
  @Input() bossName: string = '';

  /** Number of relics collected during the completed act. */
  @Input() relicCount: number = 0;

  /** Number of encounters completed during the completed act. */
  @Input() encounterCount: number = 0;

  /** Emitted when the player clicks "Continue". */
  @Output() continued = new EventEmitter<void>();

  /** 1-based display label for the completed act. */
  get completedActLabel(): number {
    return this.completedAct + 1;
  }

  /** 1-based display label for the next act. */
  get nextActLabel(): number {
    return this.completedAct + 2;
  }

  continue(): void {
    this.continued.emit();
  }
}
