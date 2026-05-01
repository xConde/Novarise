import { Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { CardInstance } from '../../../../run/models/card.model';
import { getCardDefinition } from '../../../../run/constants/card-definitions';
import { ARCHETYPE_DISPLAY } from '../../../../run/constants/archetype.constants';

interface GroupedCard {
  cardId: string;
  name: string;
  count: number;
  upgraded: boolean;
  type: string;
  archetype: string;
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
export class PileInspectorComponent implements OnInit {
  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}
  @Input() pile: CardInstance[] = [];
  @Input() label = 'Pile';
  @Output() closed = new EventEmitter<void>();

  private previousFocus: HTMLElement | null = null;

  ngOnInit(): void {
    // Save trigger element so we can restore focus on close (a11y: WCAG 2.1 §3.2.5)
    this.previousFocus = document.activeElement as HTMLElement | null;
    // Focus the close button once the modal is in the DOM
    setTimeout(() => {
      const closeBtn = this.elementRef.nativeElement.querySelector<HTMLElement>('.pile-inspector__close');
      closeBtn?.focus();
    }, 0);
  }

  /** Groups identical cards (same cardId + upgraded flag) and sorts alphabetically. */
  get groupedCards(): GroupedCard[] {
    const groups = new Map<string, GroupedCard>();
    for (const inst of this.pile) {
      const def = getCardDefinition(inst.cardId);
      if (!def) continue; // skip stale/unknown cardIds
      const key = `${inst.cardId}|${inst.upgraded ? 'up' : 'base'}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count++;
      } else {
        groups.set(key, {
          cardId: inst.cardId,
          name: def.name + (inst.upgraded ? '+' : ''),
          count: 1,
          upgraded: inst.upgraded,
          type: def.type,
          archetype: def.archetype ?? 'neutral',
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * CSS var() reference for the archetype trim color bound to the row's
   * left-edge border. Falls back to neutral for unmapped archetypes.
   */
  getArchetypeTrimVar(card: GroupedCard): string {
    const archetype = (card.archetype ?? 'neutral') as keyof typeof ARCHETYPE_DISPLAY;
    const trimVar = ARCHETYPE_DISPLAY[archetype]?.trimVar ?? '--card-trim-neutral';
    return `var(${trimVar})`;
  }

  close(): void {
    this.closed.emit();
    this.previousFocus?.focus();
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
