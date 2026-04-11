import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RunEvent, EventOutcome } from '../../models/encounter.model';

@Component({
  selector: 'app-event-screen',
  templateUrl: './event-screen.component.html',
  styleUrls: ['./event-screen.component.scss'],
})
export class EventScreenComponent {
  @Input() event!: RunEvent;
  @Output() choiceMade = new EventEmitter<number>();

  selectedChoice: number | null = null;
  showOutcome = false;

  get currentOutcome(): EventOutcome | null {
    if (this.selectedChoice === null) return null;
    return this.event.choices[this.selectedChoice]?.outcome ?? null;
  }

  makeChoice(index: number): void {
    if (this.showOutcome) return;
    this.selectedChoice = index;
    this.showOutcome = true;
  }

  confirmChoice(): void {
    if (this.selectedChoice !== null) {
      this.choiceMade.emit(this.selectedChoice);
    }
  }

  getOutcomeClass(outcome: EventOutcome): string {
    if (outcome.livesDelta > 0 || outcome.goldDelta > 0 || outcome.relicId) return 'positive';
    if (outcome.livesDelta < 0 || outcome.goldDelta < 0 || outcome.removeRelicId) return 'negative';
    return 'neutral';
  }

  formatDelta(value: number): string {
    return value >= 0 ? `+${value}` : `${value}`;
  }
}
