import { Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { CardDefinition, CardType } from '../../../../run/models/card.model';
import { HandCard } from '../card-hand/card-hand.component';
import { ARCHETYPE_DISPLAY } from '../../../../run/constants/archetype.constants';
import { IconName } from '../../../../shared/components/icon/icon-registry';

/**
 * CardDetailComponent — modal overlay showing the full information for a
 * single card: name, type, rarity, cost, keywords, current + upgraded
 * descriptions. Triggered by right-click (desktop) or long-press (touch) on
 * a card in the hand, so the card face itself can stay terse for at-a-glance
 * play while the full rules text is one gesture away.
 *
 * Closes on ESC, close button, or backdrop click. Restores focus to the
 * triggering element on close (matches PileInspectorComponent a11y pattern).
 */
@Component({
  selector: 'app-card-detail',
  templateUrl: './card-detail.component.html',
  styleUrls: ['./card-detail.component.scss'],
})
export class CardDetailComponent implements OnInit {
  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  /** The hand-card view model being inspected (instance + definition + gold cost). */
  @Input() card!: HandCard;

  @Output() closed = new EventEmitter<void>();

  private previousFocus: HTMLElement | null = null;

  ngOnInit(): void {
    // Save trigger element so we can restore focus on close (WCAG 2.1 §3.2.5).
    this.previousFocus = document.activeElement as HTMLElement | null;
    // Focus the close button once the modal is in the DOM.
    setTimeout(() => {
      const closeBtn = this.elementRef.nativeElement.querySelector<HTMLElement>('.card-detail__close');
      closeBtn?.focus();
    }, 0);
  }

  /** Resolved definition for the current card instance. */
  get definition(): CardDefinition {
    return this.card.definition;
  }

  /** Display label for the card's type — title-cased for the header. */
  get typeLabel(): string {
    const t = this.definition.type;
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  /** Display label for the card's rarity — title-cased for the rarity chip. */
  get rarityLabel(): string {
    const r = this.definition.rarity;
    return r.charAt(0).toUpperCase() + r.slice(1);
  }

  /** Upgraded description, falling back to a "+" prefix on the base text. */
  get upgradedDescription(): string {
    const def = this.definition;
    return def.upgradedDescription ?? `+ ${def.description}`;
  }

  /** True when an upgrade path exists and we should show the upgrade preview row. */
  get hasUpgrade(): boolean {
    return this.definition.upgradedEffect !== undefined;
  }

  /** Title-case list of keywords set on this card, in a stable display order. */
  get activeKeywords(): Array<{ label: string; className: string }> {
    const def = this.definition;
    const out: Array<{ label: string; className: string }> = [];
    if (def.innate)    out.push({ label: 'Innate',    className: 'card-detail__keyword--innate' });
    if (def.retain)    out.push({ label: 'Retain',    className: 'card-detail__keyword--retain' });
    if (def.ethereal)  out.push({ label: 'Ethereal',  className: 'card-detail__keyword--ethereal' });
    if (def.exhaust)   out.push({ label: 'Exhaust',   className: 'card-detail__keyword--exhaust' });
    // Phase 1 Sprints 6/7 — archetype keyword primitives (no cards use these
    // yet; surfaced so the chip shows up the moment archetype content lands).
    if (def.terraform) out.push({ label: 'Terraform', className: 'card-detail__keyword--terraform' });
    if (def.link)      out.push({ label: 'Link',      className: 'card-detail__keyword--link' });
    return out;
  }

  /** Whether the card has any keyword chips to render. */
  get hasKeywords(): boolean {
    return this.activeKeywords.length > 0;
  }

  /** Accessible label for the keyword icon row — full keyword names joined. */
  get keywordsAriaLabel(): string {
    const labels = this.activeKeywords.map(k => k.label);
    return labels.length > 0 ? `Keywords: ${labels.join(', ')}` : '';
  }

  /** CSS class suffix for per-type tinting of the header band. */
  get typeClassSuffix(): string {
    switch (this.definition.type) {
      case CardType.TOWER: return 'tower';
      case CardType.SPELL: return 'spell';
      case CardType.MODIFIER: return 'modifier';
      case CardType.UTILITY: return 'utility';
      default: return 'tower';
    }
  }

  /** CSS var() for the archetype trim ring (inset box-shadow). */
  get archetypeTrimColor(): string {
    const trimVar = ARCHETYPE_DISPLAY[this.definition.archetype]?.trimVar ?? '--card-trim-neutral';
    return `var(${trimVar})`;
  }

  /** CSS var() for the archetype backdrop pattern applied to the art zone. */
  get archetypeBackdropVar(): string {
    switch (this.definition.archetype) {
      case 'cartographer': return 'var(--card-backdrop-cartographer)';
      case 'highground':   return 'var(--card-backdrop-highground)';
      case 'conduit':      return 'var(--card-backdrop-conduit)';
      case 'neutral':
      case 'siegeworks':
      default:             return 'var(--card-backdrop-neutral)';
    }
  }

  /** Icon name for the archetype sub-icon glyph. */
  get archetypeIconName(): IconName {
    switch (this.definition.archetype) {
      case 'cartographer': return 'arch-cartographer';
      case 'highground':   return 'arch-highground';
      case 'conduit':      return 'arch-conduit';
      case 'neutral':
      case 'siegeworks':
      default:             return 'arch-neutral';
    }
  }

  /** True when the card is a tower type, so the footprint glyph should render. */
  get isTowerCard(): boolean {
    return this.definition.type === CardType.TOWER;
  }

  // Expose CardType to template for keyword icon conditions
  readonly CardType = CardType;

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
