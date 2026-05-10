import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Optional,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CardDefinition,
  CardRarity,
  CardType,
  EffectGlyphName,
} from '../../../run/models/card.model';
import { TOWER_CONFIGS, TowerType } from '../../../game/game-board/models/tower.model';
import { ARCHETYPE_DISPLAY } from '../../../run/constants/archetype.constants';
import { IconComponent } from '@shared/components/icon/icon.component';
import { TowerThumbnailService } from '@core/services/tower-thumbnail.service';

/**
 * Reusable static card visual matching the in-game card-hand appearance.
 *
 * Renders a `CardDefinition` with the full branding layer stack: frame
 * silhouette, archetype trim, type icon, tower thumbnail / effect glyph
 * hero art, card name, gold cost, and keyword icon badges.
 *
 * No gameplay state (no playable/pending/dimmed/playing classes). Intended
 * for picker surfaces: rest-screen upgrade, shop card-upgrade, shop
 * card-remove, card-draft previews, etc.
 *
 * Standalone — import directly without pulling in RunModule or LibraryModule.
 */
@Component({
  selector: 'app-game-card',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './game-card.component.html',
  styleUrls: ['./game-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameCardComponent {
  @Input() definition!: CardDefinition;
  /** When true, applies upgraded styling + badge and uses upgradedEnergyCost/upgradedDescription. */
  @Input() upgraded = false;
  @Output() selected = new EventEmitter<CardDefinition>();

  // Expose enums to template
  readonly CardType = CardType;
  readonly CardRarity = CardRarity;

  constructor(
    @Optional() private towerThumbnailService: TowerThumbnailService | null = null,
  ) {}

  onClick(): void {
    this.selected.emit(this.definition);
  }

  /** Energy cost — uses upgradedEnergyCost when upgraded and present. */
  get effectiveEnergyCost(): number {
    if (this.upgraded && this.definition.upgradedEnergyCost !== undefined) {
      return this.definition.upgradedEnergyCost;
    }
    return this.definition.energyCost;
  }

  /**
   * 3-D tower mesh thumbnail URL for tower cards.
   * Null when non-tower or service unavailable (no WebGL in test environments).
   */
  get towerThumbnailUrl(): string | null {
    if (!this.towerThumbnailService) return null;
    const effect = this.definition.effect;
    if (effect.type !== 'tower') return null;
    return this.towerThumbnailService.getThumbnail(effect.towerType);
  }

  /** Gold cost for tower cards (from TOWER_CONFIGS). Null for non-tower cards. */
  get goldCost(): number | null {
    const effect = this.definition.effect;
    if (effect.type !== 'tower') return null;
    return TOWER_CONFIGS[effect.towerType]?.cost ?? null;
  }

  /** Primary effect glyph for non-tower cards (hero art in the art zone). */
  get primaryGlyph(): EffectGlyphName | null {
    const g = this.definition.effectGlyph;
    if (!g) return null;
    return Array.isArray(g) ? g[0] : g;
  }

  /** Secondary glyph for 2-tuple effectGlyph cards (small bottom-right accent). */
  get secondaryGlyph(): EffectGlyphName | null {
    const g = this.definition.effectGlyph;
    return Array.isArray(g) ? g[1] : null;
  }

  /**
   * CSS var() reference for the archetype trim color (rest state).
   * Bound to --archetype-trim-color on the card element.
   */
  get archetypeTrimColor(): string {
    const archetype = this.definition.archetype ?? 'neutral';
    const trimVar = ARCHETYPE_DISPLAY[archetype]?.trimVar ?? '--card-trim-neutral';
    return `var(${trimVar})`;
  }

  /**
   * CSS var() reference for the archetype trim color (hover/selected state).
   * Bound to --archetype-trim-color-strong on the card element.
   */
  get archetypeTrimColorStrong(): string {
    const archetype = this.definition.archetype ?? 'neutral';
    const trimVarStrong = ARCHETYPE_DISPLAY[archetype]?.trimVarStrong ?? '--card-trim-neutral-strong';
    return `var(${trimVarStrong})`;
  }

  /**
   * Per-tower-type accent CSS variable for tower cards.
   * Returns null for non-tower cards (they use their card-type color).
   */
  get towerAccent(): string | null {
    const effect = this.definition.effect;
    if (effect.type !== 'tower') return null;
    switch (effect.towerType) {
      case TowerType.BASIC:  return 'var(--tower-color-basic)';
      case TowerType.SNIPER: return 'var(--tower-color-sniper)';
      case TowerType.SPLASH: return 'var(--tower-color-splash)';
      case TowerType.SLOW:   return 'var(--tower-color-slow)';
      case TowerType.CHAIN:  return 'var(--tower-color-chain)';
      case TowerType.MORTAR: return 'var(--tower-color-mortar)';
      default: return null;
    }
  }

  /**
   * Aria-label for the card button. Describes cost + upgrade state + description
   * so screen-reader users get full context without the tooltip.
   */
  get ariaLabel(): string {
    const cost = this.effectiveEnergyCost;
    const upgradedSuffix = this.upgraded ? ' (upgraded)' : '';
    const desc = (this.upgraded && this.definition.upgradedDescription)
      ? this.definition.upgradedDescription
      : this.definition.description;
    return `${this.definition.name} — Energy cost: ${cost}${upgradedSuffix}. ${desc}.`;
  }

  /**
   * Screen-reader label for the keyword icon row.
   */
  get keywordAriaLabel(): string {
    const words: string[] = [];
    if (this.definition.terraform) words.push('Terraform');
    if (this.definition.link) words.push('Link');
    if (this.definition.innate) words.push('Innate');
    if (this.definition.retain) words.push('Retain');
    if (this.definition.ethereal) words.push('Ethereal');
    if (this.definition.exhaust) words.push('Exhaust');
    return words.length > 0 ? `Keywords: ${words.join(', ')}` : '';
  }

  get hasKeywords(): boolean {
    const d = this.definition;
    return !!(d.terraform || d.link || d.innate || d.retain || d.ethereal || d.exhaust);
  }
}
