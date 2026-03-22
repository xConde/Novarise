import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { TutorialStep, TutorialTip } from '../../services/tutorial.service';

@Component({
  selector: 'app-tutorial-spotlight',
  templateUrl: './tutorial-spotlight.component.html',
  styleUrls: ['./tutorial-spotlight.component.scss'],
})
export class TutorialSpotlightComponent implements OnChanges, OnDestroy {
  @Input() step: TutorialStep | null = null;
  @Input() tip: TutorialTip | null = null;
  @Input() stepNumber = 0;
  @Input() totalSteps = 0;

  @Output() advance = new EventEmitter<void>();
  @Output() skip = new EventEmitter<void>();

  readonly TutorialStep = TutorialStep;

  /** True when this is the final step so the button reads "Done" instead of "Next". */
  get isLastStep(): boolean {
    return this.stepNumber === this.totalSteps;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tip']) {
      this.applyHighlight();
    }
  }

  ngOnDestroy(): void {
    this.removeHighlight();
  }

  private applyHighlight(): void {
    this.removeHighlight();
    if (this.tip?.targetSelector) {
      const target = document.querySelector(this.tip.targetSelector);
      if (target) {
        target.classList.add('tutorial-target-highlight');
      }
    }
  }

  private removeHighlight(): void {
    document.querySelectorAll('.tutorial-target-highlight').forEach(el =>
      el.classList.remove('tutorial-target-highlight')
    );
  }
}
