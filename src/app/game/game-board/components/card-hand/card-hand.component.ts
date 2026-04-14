import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
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
import { TOWER_CONFIGS, TowerType } from '../../models/tower.model';

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
  @Output() pileInspected = new EventEmitter<'draw' | 'discard'>();
  /** Emits true when the player has 0 energy and no playable cards; false when resolved. */
  @Output() handStuckChanged = new EventEmitter<boolean>();

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
   * Sprint 12 — Per-tower-type accent color.
   * Returns a CSS variable string referencing the tower-type accent color
   * (e.g., 'var(--tower-color-sniper)'). Bound to --card-tower-accent on the
   * card element so the art-zone gradient reads the correct per-type color.
   * Returns null for non-tower cards (they use their card-type color).
   */
  getTowerAccentColor(card: HandCard): string | null {
    if (!('towerType' in card.definition.effect)) return null;
    const towerType = (card.definition.effect as { type: 'tower'; towerType: TowerType }).towerType;
    switch (towerType) {
      case TowerType.BASIC:   return 'var(--tower-color-basic)';
      case TowerType.SNIPER:  return 'var(--tower-color-sniper)';
      case TowerType.SPLASH:  return 'var(--tower-color-splash)';
      case TowerType.SLOW:    return 'var(--tower-color-slow)';
      case TowerType.CHAIN:   return 'var(--tower-color-chain)';
      case TowerType.MORTAR:  return 'var(--tower-color-mortar)';
      default: return null;
    }
  }

  /**
   * Array used to render energy pips in the template.
   * Length = energy.max (capped at MAX_ENERGY_PIPS); filled vs empty
   * determined by index vs energy.current in the template.
   */
  energyPips: readonly number[] = [];

  // Expose enum to template
  readonly CardType = CardType;

  // Sprint 36 — card-play lift animation
  /** instanceId of the card currently animating out (lift + fade). Null when no animation is running. */
  playingCardId: string | null = null;

  // Sprint 37 — pile count pulse
  private prevDrawCount = 0;
  private prevDiscardCount = 0;
  drawPulse = false;
  discardPulse = false;

  // Sprint 39 — hand-stuck tracking
  private prevHandStuck = false;

  private readonly subscriptions = new Subscription();

  ngOnInit(): void {
    this.resolveHand();
    this.resolvePips();
  }

  ngOnChanges(_changes?: SimpleChanges): void {
    this.resolveHand();
    this.resolvePips();

    // Sprint 36: clear playing animation if the card has left the hand
    if (this.playingCardId && !this.handCards.some(c => c.instance.instanceId === this.playingCardId)) {
      this.playingCardId = null;
    }

    // Sprint 37: pulse pile counters when they change (skip the very first render)
    const drawLen = this.deckState?.drawPile.length ?? 0;
    const discardLen = this.deckState?.discardPile.length ?? 0;
    if (this.prevDrawCount !== 0 && drawLen !== this.prevDrawCount) {
      this.flashPileCount('draw');
    }
    if (this.prevDiscardCount !== 0 && discardLen !== this.prevDiscardCount) {
      this.flashPileCount('discard');
    }
    this.prevDrawCount = drawLen;
    this.prevDiscardCount = discardLen;

    // Sprint 39: emit hand-stuck state change
    const stuck = this.isHandStuck;
    if (stuck !== this.prevHandStuck) {
      this.handStuckChanged.emit(stuck);
      this.prevHandStuck = stuck;
    }
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

  inspectPile(pile: 'draw' | 'discard'): void {
    this.pileInspected.emit(pile);
  }

  playCard(card: HandCard): void {
    if (!card.canPlay) return;
    // When another card is pending (tower placement), only allow cancelling that card
    if (this.pendingCardId !== null && this.pendingCardId !== card.instance.instanceId) return;

    // Sprint 36: tower cards enter pending/placement mode instead of playing immediately.
    // Skip the lift animation for them — they don't leave the hand until placed.
    if (card.definition.type === CardType.TOWER) {
      this.cardPlayed.emit(card.instance);
      return;
    }

    // Non-tower cards: animate lift then emit so the parent dispatches the effect
    const id = card.instance.instanceId;
    this.playingCardId = id;
    setTimeout(() => {
      this.cardPlayed.emit(card.instance);
      // playingCardId is cleared in ngOnChanges when the card leaves handCards
    }, 80);
  }

  // Sprint 37
  private flashPileCount(pile: 'draw' | 'discard'): void {
    if (pile === 'draw') {
      this.drawPulse = true;
      setTimeout(() => (this.drawPulse = false), 350);
    } else {
      this.discardPulse = true;
      setTimeout(() => (this.discardPulse = false), 350);
    }
  }

  // Sprint 39 — true when the player has no energy and no playable cards
  get isHandStuck(): boolean {
    if (!this.energy || !this.handCards.length) return false;
    const anyPlayable = this.handCards.some(c => c.canPlay);
    return !anyPlayable && this.energy.current === 0;
  }

  /**
   * Sprint 31: Returns the 0-based index of the card in the current hand,
   * or null if not found. Used to show keyboard shortcut badges (1-9).
   */
  getCardIndex(card: HandCard): number | null {
    const idx = this.handCards.findIndex(c => c.instance.instanceId === card.instance.instanceId);
    return idx >= 0 ? idx : null;
  }

  getCardTypeClass(type: CardType): string {
    return `card--${type}`;
  }

  getRarityClass(rarity: CardRarity): string {
    return `card--${rarity}`;
  }
}
