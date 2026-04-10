import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
  CardDefinition,
  CardInstance,
  CardRarity,
  CardType,
  DeckState,
  EnergyState,
} from '../../../../ascent/models/card.model';
import { getCardDefinition } from '../../../../ascent/constants/card-definitions';

/** Pre-computed view model for a single card in hand. */
export interface HandCard {
  instance: CardInstance;
  definition: CardDefinition;
  canPlay: boolean;
}

/**
 * CardHandComponent — displays the player's current hand during Ascent encounters.
 *
 * Rendered as a horizontal bar above the tower selection bar (which is hidden
 * when a run is active). Cards emit `cardPlayed` when clicked; GameBoardComponent
 * handles the effect dispatch.
 */
@Component({
  selector: 'app-card-hand',
  templateUrl: './card-hand.component.html',
  styleUrls: ['./card-hand.component.scss'],
})
export class CardHandComponent implements OnInit, OnChanges, OnDestroy {
  @Input() deckState!: DeckState;
  @Input() energy!: EnergyState;
  @Output() cardPlayed = new EventEmitter<CardInstance>();

  /** Pre-computed view models — avoids per-template-check allocation. */
  handCards: HandCard[] = [];

  // Expose enum to template
  readonly CardType = CardType;

  private readonly subscriptions = new Subscription();

  ngOnInit(): void {
    this.resolveHand();
  }

  ngOnChanges(): void {
    this.resolveHand();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  resolveHand(): void {
    if (!this.deckState || !this.energy) {
      this.handCards = [];
      return;
    }
    this.handCards = this.deckState.hand.map(instance => {
      const definition = getCardDefinition(instance.cardId);
      return {
        instance,
        definition,
        canPlay: this.energy.current >= definition.energyCost,
      };
    });
  }

  playCard(card: HandCard): void {
    if (!card.canPlay) return;
    this.cardPlayed.emit(card.instance);
  }

  getCardTypeClass(type: CardType): string {
    return `card--${type}`;
  }

  getRarityClass(rarity: CardRarity): string {
    return `card--${rarity}`;
  }
}
