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
 * Presentational card tile for the library grid. No energy / pending /
 * playable state — this is a static view of a CardDefinition.
 *
 * Click emits `selected`; the parent opens the detail modal. Kept
 * standalone from CardHandComponent because the hand component is
 * coupled to in-game concerns (energy gating, placement pending,
 * long-press detection) that don't belong in a browsable grid.
 */
@Component({
  selector: 'app-library-card-tile',
  templateUrl: './library-card-tile.component.html',
  styleUrls: ['./library-card-tile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryCardTileComponent {
  @Input() definition!: CardDefinition;
  /** When true, the tile renders the upgraded effect (L5: upgraded view toggle). */
  @Input() showUpgraded = false;
  /** When true, desaturate the tile (L5: unseen state). */
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
}
