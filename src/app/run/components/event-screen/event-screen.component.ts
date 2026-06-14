import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RunEvent, EventOutcome } from '../../models/encounter.model';
import { RELIC_DEFINITIONS } from '../../models/relic.model';
import { ITEM_DEFINITIONS } from '../../models/item.model';

@Component({
  selector: 'app-event-screen',
  templateUrl: './event-screen.component.html',
  styleUrls: ['./event-screen.component.scss'],
})
export class EventScreenComponent {
  @Input() event!: RunEvent;

  /**
   * Seeded gamble result supplied by the parent (RunComponent) after it calls
   * RunService.previewEventGamble(). Drives displayedGoldDelta and
   * displayedLivesDelta so the outcome panel matches what resolveEvent() applies.
   */
  @Input() resolvedGamble: { goldDelta: number; livesDelta: number } | null = null;

  /**
   * Display name of the card that will be removed when the outcome has removeCard.
   * Supplied by the parent (RunComponent) after it calls
   * RunService.previewEventCardRemoval(). Null when no card removal is pending.
   */
  @Input() removedCardName: string | null = null;

  /** Emitted when the player picks a choice that has a gamble field, before confirming. */
  @Output() previewGamble = new EventEmitter<number>();

  /** Emitted when the player picks a choice that has a removeCard outcome, before confirming. */
  @Output() previewCardRemoval = new EventEmitter<number>();

  @Output() choiceMade = new EventEmitter<number>();

  selectedChoice: number | null = null;
  showOutcome = false;

  get currentOutcome(): EventOutcome | null {
    if (this.selectedChoice === null) return null;
    return this.event.choices[this.selectedChoice]?.outcome ?? null;
  }

  /** Displayed gold delta — uses seeded gamble result when outcome is a gamble. */
  get displayedGoldDelta(): number {
    if (this.currentOutcome?.gamble) {
      return this.resolvedGamble?.goldDelta ?? 0;
    }
    return this.currentOutcome?.goldDelta ?? 0;
  }

  /** Displayed lives delta — base livesDelta plus seeded gamble lives delta when applicable. */
  get displayedLivesDelta(): number {
    const base = this.currentOutcome?.livesDelta ?? 0;
    if (this.currentOutcome?.gamble) {
      return base + (this.resolvedGamble?.livesDelta ?? 0);
    }
    return base;
  }

  makeChoice(index: number): void {
    if (this.showOutcome) return;
    this.selectedChoice = index;
    this.showOutcome = true;

    const outcome = this.event.choices[index]?.outcome;
    if (outcome?.gamble) {
      this.previewGamble.emit(index);
    }
    if (outcome?.removeCard) {
      this.previewCardRemoval.emit(index);
    }
  }

  confirmChoice(): void {
    if (this.selectedChoice !== null) {
      this.choiceMade.emit(this.selectedChoice);
    }
  }

  getOutcomeClass(outcome: EventOutcome): string {
    const effectiveGold = outcome.gamble ? (this.resolvedGamble?.goldDelta ?? 0) : outcome.goldDelta;
    const effectiveLives = outcome.livesDelta + (outcome.gamble ? (this.resolvedGamble?.livesDelta ?? 0) : 0);
    if (effectiveLives > 0 || effectiveGold > 0 || outcome.relicId || outcome.itemReward) {
      return 'positive';
    }
    if (effectiveLives < 0 || effectiveGold < 0 || outcome.removeRelicId || outcome.removeCard) {
      return 'negative';
    }
    return 'neutral';
  }

  formatDelta(value: number): string {
    return value >= 0 ? `+${value}` : `${value}`;
  }

  getRelicName(relicId: string): string {
    return RELIC_DEFINITIONS[relicId as keyof typeof RELIC_DEFINITIONS]?.name ?? relicId;
  }

  getItemName(itemType: string): string {
    return ITEM_DEFINITIONS[itemType as keyof typeof ITEM_DEFINITIONS]?.name ?? itemType;
  }
}
