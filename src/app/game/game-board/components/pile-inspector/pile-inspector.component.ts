import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CardInstance } from '../../../../run/models/card.model';
import { getCardDefinition } from '../../../../run/constants/card-definitions';

interface GroupedCard {
  cardId: string;
  name: string;
  count: number;
  upgraded: boolean;
}

/**
 * PileInspectorComponent — modal overlay showing a sorted, grouped list of cards
 * in the draw or discard pile. Triggered by clicking pile counter buttons in
 * CardHandComponent. Closes on Escape or backdrop click.
 */
@Component({
  selector: 'app-pile-inspector',
  templateUrl: './pile-inspector.component.html',
  styleUrls: ['./pile-inspector.component.scss'],
})
export class PileInspectorComponent {
  @Input() pile: CardInstance[] = [];
  @Input() label = 'Pile';
  @Output() closed = new EventEmitter<void>();

  /** Groups identical cards (same cardId + upgraded flag) and sorts alphabetically. */
  get groupedCards(): GroupedCard[] {
    const groups = new Map<string, GroupedCard>();
    for (const inst of this.pile) {
      const key = `${inst.cardId}|${inst.upgraded ? 'up' : 'base'}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count++;
      } else {
        const def = getCardDefinition(inst.cardId);
        groups.set(key, {
          cardId: inst.cardId,
          name: def.name + (inst.upgraded ? '+' : ''),
          count: 1,
          upgraded: inst.upgraded,
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  close(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }
}
