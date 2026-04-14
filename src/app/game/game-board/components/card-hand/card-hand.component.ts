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
} from '../../../../run/models/card.model';
import { getCardDefinition } from '../../../../run/constants/card-definitions';
import { TOWER_CONFIGS } from '../../models/tower.model';

/** Pre-computed view model for a single card in hand. */
export interface HandCard {
  instance: CardInstance;
  definition: CardDefinition;
  canPlay: boolean;
  /** Gold cost shown on tower cards (from TOWER_CONFIGS). Null for non-tower cards. */
  goldCost: number | null;
}

/** Maximum energy pips shown in the pip row (matches max playable energy). */
const MAX_ENERGY_PIPS = 6;

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
  /**
   * instanceId of the tower card currently in placement mode.
   * When set, that card is highlighted and all others are dimmed.
   */
  @Input() pendingCardId: string | null = null;
  @Output() cardPlayed = new EventEmitter<CardInstance>();

  /** Pre-computed view models — avoids per-template-check allocation. */
  handCards: HandCard[] = [];

  /** Whether the hand should render with fan overlap (> 5 cards). */
  get isFan(): boolean {
    return this.handCards.length > 5;
  }

  /**
   * CSS negative margin for card overlap in fan mode.
   * Scales with hand size: -0.5rem at 6 cards, -1.5rem at 10+.
   * Returns '0' when not in fan mode.
   */
  get cardFanMargin(): string {
    if (!this.isFan) return '0';
    const extra = Math.max(0, this.handCards.length - 5);
    const overlap = Math.min(1.5, 0.5 + extra * 0.2);
    return `-${overlap}rem`;
  }

  /**
   * Deterministic hue (0-359) derived from the card instance id.
   * Used to tint the instance-identifier dot so duplicate cards in the
   * hand (e.g., 5× Basic Tower) are still visually distinguishable.
   */
  instanceHue(instanceId: string): number {
    let hash = 0;
    for (let i = 0; i < instanceId.length; i++) {
      hash = (hash * 31 + instanceId.charCodeAt(i)) >>> 0;
    }
    // Prime-mix to spread similar instance ids across the hue wheel
    return (hash * 137) % 360;
  }

  /**
   * Array used to render energy pips in the template.
   * Length = energy.max (capped at MAX_ENERGY_PIPS); filled vs empty
   * determined by index vs energy.current in the template.
   */
  energyPips: readonly number[] = [];

  // Expose enum to template
  readonly CardType = CardType;

  private readonly subscriptions = new Subscription();

  ngOnInit(): void {
    this.resolveHand();
    this.resolvePips();
  }

  ngOnChanges(): void {
    this.resolveHand();
    this.resolvePips();
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
      const effect = instance.upgraded && definition.upgradedEffect ? definition.upgradedEffect : definition.effect;
      const goldCost = effect.type === 'tower' ? (TOWER_CONFIGS[effect.towerType]?.cost ?? null) : null;
      return {
        instance,
        definition,
        canPlay: this.energy.current >= definition.energyCost,
        goldCost,
      };
    });
  }

  /** Rebuild the pips array when energy.max changes. */
  resolvePips(): void {
    if (!this.energy) {
      this.energyPips = [];
      return;
    }
    const count = Math.min(this.energy.max, MAX_ENERGY_PIPS);
    this.energyPips = Array.from({ length: count }, (_, i) => i);
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
