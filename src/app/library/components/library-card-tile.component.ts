import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import {
  CardDefinition,
  CardType,
} from '../../run/models/card.model';
import { TOWER_CONFIGS, TowerType } from '../../game/game-board/models/tower.model';

/**
 * Presentational card tile for the Codex grid. Static view of a
 * CardDefinition — no energy / pending / playable state. Click emits
 * `selected` and the parent opens the detail modal. When `desaturated`
 * is true the tile renders as a card-back silhouette (undiscovered).
 */
@Component({
  selector: 'app-library-card-tile',
  templateUrl: './library-card-tile.component.html',
  styleUrls: ['./library-card-tile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryCardTileComponent {
  @Input() definition!: CardDefinition;
  /** When true, the tile renders the upgraded effect + description. */
  @Input() showUpgraded = false;
  /** When true, the tile renders as a card-back silhouette (undiscovered). */
  @Input() desaturated = false;
  @Output() selected = new EventEmitter<CardDefinition>();

  readonly CardType = CardType;

  onClick(): void {
    this.selected.emit(this.definition);
  }

  /**
   * Tower accent CSS variable (basic/sniper/splash/…) for tower cards.
   * Returns null for non-tower cards — they use their card-type color.
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

  /** Gold cost for tower cards (from TOWER_CONFIGS). Null for non-tower. */
  get goldCost(): number | null {
    const effect = this.definition.effect;
    if (effect.type !== 'tower') return null;
    return TOWER_CONFIGS[effect.towerType]?.cost ?? null;
  }

  /** Keyword chips: Innate / Retain / Ethereal / Exhaust / Terraform / Link. */
  get keywordChips(): string[] {
    const d = this.definition;
    const chips: string[] = [];
    if (d.innate)    chips.push('Innate');
    if (d.retain)    chips.push('Retain');
    if (d.ethereal)  chips.push('Ethereal');
    if (d.exhaust)   chips.push('Exhaust');
    if (d.terraform) chips.push('Terraform');
    if (d.link)      chips.push('Link');
    return chips;
  }

  /** Description shown on the tile — upgraded if toggled, else base. */
  get effectiveDescription(): string {
    if (this.showUpgraded && this.definition.upgradedDescription) {
      return this.definition.upgradedDescription;
    }
    return this.definition.description;
  }

  /**
   * True when the upgrade has a distinct player-visible effect. Cards that
   * ship an `upgradedEffect` identical to the base (placeholder slots for
   * future tuning) should not render the upgrade glow / badge — it reads as
   * a meaningless stylistic flourish.
   */
  get hasMeaningfulUpgrade(): boolean {
    const up = this.definition.upgradedDescription;
    return up !== undefined && up !== this.definition.description;
  }

  /**
   * Energy cost shown in the tile's cost pill — reflects the upgraded cost
   * when the preview toggle is on AND the card has a cost-reducing upgrade
   * (e.g., ARCHITECT 3E → 2E). Without this, the tile showed the base cost
   * while the description text claimed 2E — visually inconsistent.
   */
  get displayEnergyCost(): number {
    if (this.showUpgraded && this.definition.upgradedEnergyCost !== undefined) {
      return this.definition.upgradedEnergyCost;
    }
    return this.definition.energyCost;
  }
}
