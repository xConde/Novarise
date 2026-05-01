import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Optional,
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
import { getCardDefinition, getEffectiveEnergyCost } from '../../../../run/constants/card-definitions';
import { TOWER_CONFIGS, TowerType } from '../../models/tower.model';
import { RelicService } from '../../../../run/services/relic.service';
import { ARCHETYPE_DISPLAY } from '../../../../run/constants/archetype.constants';
import { IconName } from '../../../../shared/components/icon/icon-registry';

/** Pre-computed view model for a single card in hand. */
export interface HandCard {
  instance: CardInstance;
  definition: CardDefinition;
  canPlay: boolean;
  /**
   * Energy cost after applying relic discounts (e.g. WORLD_SPIRIT).
   * Equals definition.energyCost when no discount is active.
   */
  effectiveEnergyCost: number;
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
  constructor(@Optional() private relicService: RelicService | null = null) {}

  @Input() deckState!: DeckState;
  @Input() energy!: EnergyState;
  /**
   * instanceId of the tower card currently in placement mode.
   * When set, that card is highlighted and all others are dimmed.
   */
  @Input() pendingCardId: string | null = null;
  @Output() cardPlayed = new EventEmitter<CardInstance>();
  @Output() pileInspected = new EventEmitter<'draw' | 'discard' | 'exhaust'>();
  /** Emits true when the player has 0 energy and no playable cards; false when resolved. */
  @Output() handStuckChanged = new EventEmitter<boolean>();
  /** Emits the HandCard when the player right-clicks or long-presses a card in hand. */
  @Output() cardInspected = new EventEmitter<HandCard>();

  /** Long-press detection for touch — cancelled on pointerup/move. Component-scoped. */
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressFired = false;
  /** Touch slop threshold (px). Past this move distance the press is treated as a scroll, not a long-press. */
  private static readonly LONG_PRESS_MOVE_SLOP = 8;
  private static readonly LONG_PRESS_DURATION_MS = 500;
  private longPressStartX = 0;
  private longPressStartY = 0;

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
   * CSS var() reference for the archetype trim color (rest state).
   * Resolved by the browser from :root tokens set in _card-tokens.scss.
   * Bound to --archetype-trim-color on each card element.
   */
  getArchetypeTrimColor(card: HandCard): string {
    const archetype = card.definition.archetype;
    const trimVar = ARCHETYPE_DISPLAY[archetype]?.trimVar ?? '--card-trim-neutral';
    return `var(${trimVar})`;
  }

  /**
   * CSS var() reference for the archetype backdrop pattern.
   * Bound to --card-backdrop-image on each card element; consumed by the
   * per-type ::before background-image layers.
   * Siegeworks falls back to neutral (Phase 5 unscoped).
   */
  getArchetypeBackdropVar(card: HandCard): string {
    switch (card.definition.archetype) {
      case 'cartographer': return 'var(--card-backdrop-cartographer)';
      case 'highground':   return 'var(--card-backdrop-highground)';
      case 'conduit':      return 'var(--card-backdrop-conduit)';
      case 'neutral':
      case 'siegeworks':
      default:             return 'var(--card-backdrop-neutral)';
    }
  }

  /**
   * CSS var() reference for the archetype trim color (hover/selected state).
   * Bound to --archetype-trim-color-strong on each card element.
   */
  getArchetypeTrimColorStrong(card: HandCard): string {
    const archetype = card.definition.archetype;
    const trimVarStrong = ARCHETYPE_DISPLAY[archetype]?.trimVarStrong ?? '--card-trim-neutral-strong';
    return `var(${trimVarStrong})`;
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
  private prevExhaustCount = 0;
  drawPulse = false;
  discardPulse = false;
  exhaustPulse = false;

  // Sprint 39 — hand-stuck tracking
  private prevHandStuck = false;

  /** Hover tooltip — desktop only. Null when no card hovered. */
  hoveredCard: HandCard | null = null;
  /** Viewport-coords rect of the hovered card, used to anchor the fixed-position tooltip. */
  hoveredCardRect: DOMRect | null = null;
  private hoverDelayTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly HOVER_DELAY_MS = 200;

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
    const exhaustLen = this.deckState?.exhaustPile.length ?? 0;
    if (this.prevDrawCount !== 0 && drawLen !== this.prevDrawCount) {
      this.flashPileCount('draw');
    }
    if (this.prevDiscardCount !== 0 && discardLen !== this.prevDiscardCount) {
      this.flashPileCount('discard');
    }
    if (this.prevExhaustCount !== 0 && exhaustLen !== this.prevExhaustCount) {
      this.flashPileCount('exhaust');
    }
    this.prevDrawCount = drawLen;
    this.prevDiscardCount = discardLen;
    this.prevExhaustCount = exhaustLen;

    // Sprint 39: emit hand-stuck state change
    const stuck = this.isHandStuck;
    if (stuck !== this.prevHandStuck) {
      this.handStuckChanged.emit(stuck);
      this.prevHandStuck = stuck;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.cancelLongPress();
    this.cancelHoverDelay();
    this.hoveredCard = null;
    this.hoveredCardRect = null;
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
      const costModifier = this.relicService ? this.relicService.getCardEnergyCostModifier(definition) : 0;
      const baseCost = getEffectiveEnergyCost(instance);
      const effectiveEnergyCost = Math.max(0, baseCost + costModifier);
      return {
        instance,
        definition,
        canPlay: this.energy.current >= effectiveEnergyCost,
        effectiveEnergyCost,
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

  inspectPile(pile: 'draw' | 'discard' | 'exhaust'): void {
    this.pileInspected.emit(pile);
  }

  /**
   * Right-click on a card. Prevents the browser context menu and emits the
   * card up to the parent so it can open the card-detail modal. The normal
   * click-to-play path still fires on left-click; these are separate events.
   */
  onCardContextMenu(event: MouseEvent, card: HandCard): void {
    event.preventDefault();
    this.cardInspected.emit(card);
  }

  /**
   * Pointer-down on a card. Starts a 500ms timer; if the timer fires before
   * a pointerup/cancel/move-past-threshold, we treat it as a long-press and
   * emit cardInspected. `longPressFired` is used by onCardClick to suppress
   * the click-to-play that pointerup would otherwise produce.
   */
  onCardPointerDown(event: PointerEvent, card: HandCard): void {
    // Only handle touch / pen. Mouse uses contextmenu for the inspect path.
    if (event.pointerType === 'mouse') return;
    this.cancelLongPress();
    this.longPressFired = false;
    this.longPressStartX = event.clientX;
    this.longPressStartY = event.clientY;
    this.longPressTimer = setTimeout(() => {
      this.longPressFired = true;
      this.longPressTimer = null;
      this.cardInspected.emit(card);
    }, CardHandComponent.LONG_PRESS_DURATION_MS);
  }

  /** Cancel a pending long-press if the finger moves beyond the slop threshold. */
  onCardPointerMove(event: PointerEvent): void {
    if (this.longPressTimer === null) return;
    const dx = event.clientX - this.longPressStartX;
    const dy = event.clientY - this.longPressStartY;
    if (dx * dx + dy * dy > CardHandComponent.LONG_PRESS_MOVE_SLOP ** 2) {
      this.cancelLongPress();
    }
  }

  /** Cancel any pending long-press (pointer released, cancelled, or left the card). */
  onCardPointerUp(): void {
    this.cancelLongPress();
  }

  /**
   * Card click handler. If a long-press just fired, we swallow the click so
   * the same gesture doesn't ALSO play the card. Otherwise delegates to the
   * existing playCard path.
   */
  onCardClick(card: HandCard): void {
    if (this.longPressFired) {
      this.longPressFired = false;
      return;
    }
    this.playCard(card);
  }

  private cancelLongPress(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  /**
   * Mouse entered a card — desktop only. Schedules a delayed tooltip show so
   * brief mouse passes don't flicker the tooltip. Touch devices skip this
   * path; long-press still opens the full detail modal.
   */
  onCardPointerEnter(event: PointerEvent, card: HandCard): void {
    if (event.pointerType !== 'mouse') return;
    if (this.pendingCardId !== null) return; // suppress during placement mode
    this.cancelHoverDelay();
    const target = event.currentTarget as HTMLElement;
    this.hoverDelayTimer = setTimeout(() => {
      this.hoverDelayTimer = null;
      this.hoveredCard = card;
      this.hoveredCardRect = target.getBoundingClientRect();
    }, CardHandComponent.HOVER_DELAY_MS);
  }

  /** Mouse left a card — clears tooltip and any pending delay. */
  onCardPointerLeave(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    this.cancelHoverDelay();
    this.hoveredCard = null;
    this.hoveredCardRect = null;
  }

  private cancelHoverDelay(): void {
    if (this.hoverDelayTimer !== null) {
      clearTimeout(this.hoverDelayTimer);
      this.hoverDelayTimer = null;
    }
  }

  /** Stable id used to wire aria-describedby on the hovered card to the tooltip element. */
  get hoverTooltipId(): string {
    return this.hoveredCard ? `card-tooltip-${this.hoveredCard.instance.instanceId}` : '';
  }

  /**
   * Tooltip top position (viewport px). Anchors above the card by default;
   * falls back below if the card sits in the top quarter of the viewport.
   */
  get hoverTooltipTop(): number {
    if (!this.hoveredCardRect) return 0;
    const TOOLTIP_HEIGHT_ESTIMATE = 180;
    const GAP = 8;
    const aboveTop = this.hoveredCardRect.top - TOOLTIP_HEIGHT_ESTIMATE - GAP;
    if (aboveTop > GAP) return aboveTop;
    return this.hoveredCardRect.bottom + GAP;
  }

  /**
   * Tooltip left position (viewport px). Centers on the card; clamps so it
   * doesn't overflow the viewport horizontally.
   */
  get hoverTooltipLeft(): number {
    if (!this.hoveredCardRect) return 0;
    const TOOLTIP_WIDTH_ESTIMATE = 240;
    const GAP = 8;
    const cardCenter = this.hoveredCardRect.left + this.hoveredCardRect.width / 2;
    const idealLeft = cardCenter - TOOLTIP_WIDTH_ESTIMATE / 2;
    const maxLeft = window.innerWidth - TOOLTIP_WIDTH_ESTIMATE - GAP;
    return Math.max(GAP, Math.min(idealLeft, maxLeft));
  }

  /**
   * Effective description shown in the tooltip — uses upgradedDescription
   * when the card instance is upgraded, otherwise the base description.
   */
  hoverTooltipDescription(card: HandCard): string {
    if (card.instance.upgraded && card.definition.upgradedDescription) {
      return card.definition.upgradedDescription;
    }
    return card.definition.description;
  }

  /** Full keyword names for the tooltip (Innate, Retain, Ethereal, Exhaust, Terraform, Link). */
  hoverTooltipKeywords(card: HandCard): string[] {
    const out: string[] = [];
    if (card.definition.innate) out.push('Innate');
    if (card.definition.retain) out.push('Retain');
    if (card.definition.ethereal) out.push('Ethereal');
    if (card.definition.exhaust) out.push('Exhaust');
    if (card.definition.terraform) out.push('Terraform');
    if (card.definition.link) out.push('Link');
    return out;
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
  private flashPileCount(pile: 'draw' | 'discard' | 'exhaust'): void {
    if (pile === 'draw') {
      this.drawPulse = true;
      setTimeout(() => (this.drawPulse = false), 350);
    } else if (pile === 'discard') {
      this.discardPulse = true;
      setTimeout(() => (this.discardPulse = false), 350);
    } else {
      this.exhaustPulse = true;
      setTimeout(() => (this.exhaustPulse = false), 350);
    }
  }

  // Sprint 39 — true when the player has no energy and no playable cards
  get isHandStuck(): boolean {
    if (!this.energy || !this.handCards.length) return false;
    const anyPlayable = this.handCards.some(c => c.canPlay);
    return !anyPlayable && this.energy.current === 0;
  }

  /**
   * Screen-reader label for the keyword-badge row. Announces all active
   * keywords as full words so assistive tech reads e.g. "Keywords: Innate, Exhaust"
   * rather than icon descriptions. Badge icons are decorative; the wrapping
   * span carries the semantics via aria-label.
   */
  keywordAriaLabel(card: HandCard): string {
    const words: string[] = [];
    if (card.definition.terraform) words.push('Terraform');
    if (card.definition.link) words.push('Link');
    if (card.definition.innate) words.push('Innate');
    if (card.definition.retain) words.push('Retain');
    if (card.definition.ethereal) words.push('Ethereal');
    if (card.definition.exhaust) words.push('Exhaust');
    return words.length > 0 ? `Keywords: ${words.join(', ')}` : '';
  }

  /**
   * Returns the icon name for the per-archetype sub-icon glyph shown in the
   * top-left of the card art zone. Neutral cards receive their own glyph
   * (crosshatch) rather than no glyph — absence of decoration would be
   * invisible against the dark backdrop.
   */
  getArchetypeIconName(card: HandCard): IconName {
    switch (card.definition.archetype) {
      case 'cartographer': return 'arch-cartographer';
      case 'highground':   return 'arch-highground';
      case 'conduit':      return 'arch-conduit';
      case 'neutral':
      case 'siegeworks':
      default:             return 'arch-neutral';
    }
  }

  getCardTypeClass(type: CardType): string {
    return `card--${type}`;
  }

  getRarityClass(rarity: CardRarity): string {
    return `card--${rarity}`;
  }
}
