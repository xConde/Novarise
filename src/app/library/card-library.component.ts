import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardDefinition, CardRarity, CardType } from '../run/models/card.model';
import { CARD_DEFINITIONS } from '../run/constants/card-definitions';

/**
 * Dev-only /library route. Full read-only inventory of every card in
 * CARD_DEFINITIONS so we can QA balance + visuals + archetype coverage
 * without grinding the reward pool. Gated by the enableDevTools env flag
 * at the route level (see devLibraryGuard).
 *
 * L1: route + all-cards grid.
 * L2: detail modal on tile click.
 * L3: filters + sort + search.
 * L4: SeenCardsService + hook points.
 * L5: Seen/Unseen tabs + desaturated unseen state.
 * L6: Add-to-test-deck dev action.
 */
@Component({
  selector: 'app-card-library',
  templateUrl: './card-library.component.html',
  styleUrls: ['./card-library.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardLibraryComponent {
  /** Ordered by archetype then rarity then name for a predictable grid. */
  readonly allCards: readonly CardDefinition[] = Object.values(CARD_DEFINITIONS).sort(compareCards);

  readonly totalCards = this.allCards.length;

  get countsByType(): ReadonlyMap<CardType, number> {
    const map = new Map<CardType, number>();
    for (const card of this.allCards) {
      map.set(card.type, (map.get(card.type) ?? 0) + 1);
    }
    return map;
  }

  readonly CardType = CardType;

  onCardSelected(card: CardDefinition): void {
    // L2: opens detail modal. No-op for L1.
    void card;
  }

  /** Stable trackBy for the card grid *ngFor. */
  trackById(_index: number, card: CardDefinition): string {
    return card.id;
  }
}

/**
 * Comparator: archetype bucket → rarity bucket → name. Keeps the default
 * grid predictable so newly-added cards from the same archetype stay
 * grouped together. Override via the sort dropdown in L3.
 */
function compareCards(a: CardDefinition, b: CardDefinition): number {
  const archetypeRank = (d: CardDefinition): number => {
    switch (d.archetype) {
      case 'cartographer': return 1;
      case 'highground':   return 2;
      case 'conduit':      return 3;
      case 'siegeworks':   return 4;
      default:             return 0; // neutral / undefined first
    }
  };
  const rarityRank = (r: CardRarity): number => {
    switch (r) {
      case CardRarity.STARTER:  return 0;
      case CardRarity.COMMON:   return 1;
      case CardRarity.UNCOMMON: return 2;
      case CardRarity.RARE:     return 3;
    }
  };
  const archDiff = archetypeRank(a) - archetypeRank(b);
  if (archDiff !== 0) return archDiff;
  const rarityDiff = rarityRank(a.rarity) - rarityRank(b.rarity);
  if (rarityDiff !== 0) return rarityDiff;
  return a.name.localeCompare(b.name);
}
