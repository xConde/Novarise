import { Component, Input, Output, EventEmitter, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CardDefinition, CardId, CardRarity, CardType, EffectGlyphName } from '../../models/card.model';
import { CardReward } from '../../models/encounter.model';
import { getCardDefinition } from '../../constants/card-definitions';
import { stripKeywordTokens } from '@shared/components/description-text/description-text.component';

interface DraftCard {
  reward: CardReward;
  definition: CardDefinition;
}

@Component({
  selector: 'app-card-draft',
  templateUrl: './card-draft.component.html',
  styleUrls: ['./card-draft.component.scss'],
})
export class CardDraftComponent implements OnDestroy, OnChanges {
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

  /**
   * Clear any stale hover state when a new draft loads. Without this, a
   * tooltip captured during the previous draft (e.g. autofocus on mount
   * before layout settles, leaving a zero-rect anchored at viewport 0,0)
   * persists across the screen transition.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cardChoices']) {
      this.cancelHoverDelay();
      this.cancelLongPress();
      this.hoveredCard = null;
      this.hoveredCardRect = null;
      this.selectedCard = null;
      this.longPressFired = false;
    }
  }

  /**
   * Validate a getBoundingClientRect result before binding it. A zero-sized
   * rect indicates the element is detached, display:none, or hasn't laid
   * out yet — using it as the tooltip anchor would pin the tooltip to
   * viewport (0, 0).
   */
  private isValidRect(rect: DOMRect): boolean {
    return rect.width > 0 && rect.height > 0;
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
      const rect = target.getBoundingClientRect();
      // Skip when the card hasn't laid out — pinning the tooltip to a
      // zero rect would anchor it at viewport (0, 0).
      if (!this.isValidRect(rect)) return;
      this.hoveredCard = card;
      this.hoveredCardRect = rect;
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
  //
  // Mount-time autofocus path: the browser may auto-focus the first focusable
  // element before Angular finishes laying out the card-draft. The rect at
  // that moment is zero. If we wrote it, the tooltip would anchor to viewport
  // (0, 0) — visible as a stuck card preview in the top-left until the user
  // moves focus or blurs. Defer to the next animation frame in that case so
  // the rect can settle. If the second read is still invalid, drop the focus
  // entirely — better no tooltip than a broken one.
  onCardFocus(event: FocusEvent, card: DraftCard): void {
    this.cancelHoverDelay();
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (this.isValidRect(rect)) {
      this.hoveredCard = card;
      this.hoveredCardRect = rect;
      return;
    }
    requestAnimationFrame(() => {
      const retry = target.getBoundingClientRect();
      if (!this.isValidRect(retry)) return;
      this.hoveredCard = card;
      this.hoveredCardRect = retry;
    });
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
      const rect = target.getBoundingClientRect();
      if (!this.isValidRect(rect)) return;
      this.longPressFired = true;
      this.hoveredCard = card;
      this.hoveredCardRect = rect;
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

  /** Accessible label for a draft card button. Keyword tokens are resolved to
   *  plain keyword names so screen readers announce "Ethereal" not "{kw-ethereal}". */
  cardAriaLabel(item: DraftCard, index: number): string {
    const desc = stripKeywordTokens(item.definition.description);
    return `Option ${index + 1}. ${item.definition.name}: ${desc}. Type: ${item.definition.type}. Cost: ${item.definition.energyCost} energy. Press ${index + 1} to pick.`;
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
