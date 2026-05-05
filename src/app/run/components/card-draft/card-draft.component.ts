import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CardDefinition, CardId, CardRarity, CardType, EffectGlyphName } from '../../models/card.model';
import { CardReward } from '../../models/encounter.model';
import { getCardDefinition } from '../../constants/card-definitions';

interface DraftCard {
  reward: CardReward;
  definition: CardDefinition;
}

@Component({
  selector: 'app-card-draft',
  templateUrl: './card-draft.component.html',
  styleUrls: ['./card-draft.component.scss'],
})
export class CardDraftComponent implements OnDestroy {
  @Input() cardChoices: CardReward[] = [];
  /** Gold awarded on skip (0 = show plain "Skip Card"). */
  @Input() skipGoldAmount = 0;
  @Output() cardPicked = new EventEmitter<CardReward>();
  @Output() skipped = new EventEmitter<void>();

  readonly CardType = CardType;

  selectedCard: CardId | null = null;

  // ── Hover tooltip ────────────────────────────────────────────────────────────
  hoveredCard: DraftCard | null = null;
  hoveredCardRect: DOMRect | null = null;
  private hoverDelayTimer: ReturnType<typeof setTimeout> | null = null;

  private static readonly HOVER_DELAY_MS = 200;
  private static readonly LONG_PRESS_MS = 500;
  private static readonly LONG_PRESS_SLOP_PX = 8;

  // ── Long-press (touch/pen) ───────────────────────────────────────────────────
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressStartX = 0;
  private longPressStartY = 0;
  /**
   * Set true when the long-press timer fires (tooltip shown). Read by
   * pickCard() to suppress the click that synthesizes after a touch
   * pointerup. Without this guard, every long-press to peek at a card
   * would also commit the pick — a real touch-UX bug surfaced in QA.
   */
  private longPressFired = false;

  ngOnDestroy(): void {
    this.cancelHoverDelay();
    this.cancelLongPress();
    this.hoveredCard = null;
    this.hoveredCardRect = null;
  }

  get resolvedCards(): DraftCard[] {
    return this.cardChoices.map(reward => ({
      reward,
      definition: getCardDefinition(reward.cardId),
    }));
  }

  pickCard(reward: CardReward): void {
    // Long-press just fired (tooltip showing). Swallow the click so a
    // long-press peek doesn't also commit the pick. Reset the flag for
    // the next gesture. Mirrors card-hand's longPressFired pattern.
    if (this.longPressFired) {
      this.longPressFired = false;
      return;
    }
    this.hoveredCard = null;
    this.hoveredCardRect = null;
    this.cancelHoverDelay();
    this.selectedCard = reward.cardId;
    this.cardPicked.emit(reward);
  }

  skip(): void {
    this.skipped.emit();
  }

  getTypeClass(type: CardType): string {
    return `card-draft__card--${type}`;
  }

  getRarityClass(rarity: CardRarity): string {
    return `card-draft__card--rarity-${rarity}`;
  }

  getFrameClass(type: CardType): string {
    return `card-draft__card--frame-${type}`;
  }

  /** Primary effect glyph for non-tower cards in the draft. */
  getPrimaryGlyph(definition: CardDefinition): EffectGlyphName | null {
    const g = definition.effectGlyph;
    if (!g) return null;
    return Array.isArray(g) ? g[0] : g;
  }

  /** Secondary glyph for 2-tuple effectGlyph cards. */
  getSecondaryGlyph(definition: CardDefinition): EffectGlyphName | null {
    const g = definition.effectGlyph;
    return Array.isArray(g) ? g[1] : null;
  }

  // ── Hover tooltip handlers ───────────────────────────────────────────────────

  onCardPointerEnter(event: PointerEvent, card: DraftCard): void {
    if (event.pointerType !== 'mouse') return;
    this.cancelHoverDelay();
    const target = event.currentTarget as HTMLElement;
    this.hoverDelayTimer = setTimeout(() => {
      this.hoverDelayTimer = null;
      this.hoveredCard = card;
      this.hoveredCardRect = target.getBoundingClientRect();
    }, CardDraftComponent.HOVER_DELAY_MS);
  }

  onCardPointerLeave(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    this.cancelHoverDelay();
    this.hoveredCard = null;
    this.hoveredCardRect = null;
  }

  // Keyboard users need the same description payload mouse users get on hover.
  // Focus shows the tooltip immediately (no 200ms delay — tab navigation
  // expects responsive feedback). Blur clears.
  onCardFocus(event: FocusEvent, card: DraftCard): void {
    this.cancelHoverDelay();
    const target = event.currentTarget as HTMLElement;
    this.hoveredCard = card;
    this.hoveredCardRect = target.getBoundingClientRect();
  }

  onCardBlur(): void {
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

  // ── Long-press handlers (touch / pen) ────────────────────────────────────────

  onCardPointerDown(event: PointerEvent, card: DraftCard): void {
    if (event.pointerType === 'mouse') return;
    this.cancelLongPress();
    this.longPressFired = false;
    this.longPressStartX = event.clientX;
    this.longPressStartY = event.clientY;
    const target = event.currentTarget as HTMLElement;
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      this.longPressFired = true;
      this.hoveredCard = card;
      this.hoveredCardRect = target.getBoundingClientRect();
    }, CardDraftComponent.LONG_PRESS_MS);
  }

  onCardPointerMove(event: PointerEvent): void {
    if (this.longPressTimer === null) return;
    const dx = event.clientX - this.longPressStartX;
    const dy = event.clientY - this.longPressStartY;
    if (dx * dx + dy * dy > CardDraftComponent.LONG_PRESS_SLOP_PX ** 2) {
      this.cancelLongPress();
    }
  }

  onCardPointerUp(): void {
    this.cancelLongPress();
  }

  private cancelLongPress(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  // ── Tooltip positioning ──────────────────────────────────────────────────────

  get hoverTooltipId(): string {
    return this.hoveredCard ? `card-draft-tooltip-${this.hoveredCard.reward.cardId}` : '';
  }

  /**
   * Tooltip top (viewport px). Anchors above the card; falls back below if
   * the card is in the top quarter of the viewport.
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
   * Tooltip left (viewport px). Centers on the card; clamps to viewport edges.
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

  hoverTooltipDescription(card: DraftCard): string {
    return card.definition.description;
  }

  hoverTooltipKeywords(card: DraftCard): string[] {
    const out: string[] = [];
    if (card.definition.innate) out.push('Innate');
    if (card.definition.retain) out.push('Retain');
    if (card.definition.ethereal) out.push('Ethereal');
    if (card.definition.exhaust) out.push('Exhaust');
    if (card.definition.terraform) out.push('Terraform');
    if (card.definition.link) out.push('Link');
    return out;
  }
}
