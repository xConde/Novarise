import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import {
  CardArchetype,
  CardDefinition,
  CardRarity,
  CardType,
} from '../run/models/card.model';
import { CARD_DEFINITIONS } from '../run/constants/card-definitions';
import {
  DEFAULT_FILTERS,
  FilterState,
  KeywordFilter,
  SortMode,
} from './components/library-filters.component';

/**
 * Dev-only /library route. Full read-only inventory of every card in
 * CARD_DEFINITIONS so we can QA balance + visuals + archetype coverage
 * without grinding the reward pool. Gated by the enableDevTools env flag
 * at the route level (see devLibraryGuard).
 */
@Component({
  selector: 'app-card-library',
  templateUrl: './card-library.component.html',
  styleUrls: ['./card-library.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardLibraryComponent {
  constructor(private cdr: ChangeDetectorRef) {
    this.recomputeFiltered();
  }

  /** Raw source — unordered, unfiltered. */
  readonly allCards: readonly CardDefinition[] = Object.values(CARD_DEFINITIONS);

  readonly totalCards = this.allCards.length;

  filterState: FilterState = DEFAULT_FILTERS;

  /** Derived view after filter + sort + search. Recomputed on state change. */
  filteredCards: readonly CardDefinition[] = [];

  /** Currently open detail modal target, or null when closed. */
  selectedCard: CardDefinition | null = null;

  get countsByType(): ReadonlyMap<CardType, number> {
    const map = new Map<CardType, number>();
    for (const card of this.allCards) {
      map.set(card.type, (map.get(card.type) ?? 0) + 1);
    }
    return map;
  }

  readonly CardType = CardType;

  onFiltersChange(next: FilterState): void {
    this.filterState = next;
    this.recomputeFiltered();
    this.cdr.markForCheck();
  }

  onCardSelected(card: CardDefinition): void {
    this.selectedCard = card;
    this.cdr.markForCheck();
  }

  onModalClosed(): void {
    this.selectedCard = null;
    this.cdr.markForCheck();
  }

  trackById(_index: number, card: CardDefinition): string {
    return card.id;
  }

  private recomputeFiltered(): void {
    const s = this.filterState;
    let list = this.allCards.filter(card => matchesFilters(card, s));
    list = [...list].sort(makeComparator(s.sort));
    this.filteredCards = list;
  }
}

function matchesFilters(card: CardDefinition, s: FilterState): boolean {
  if (s.types.size > 0 && !s.types.has(card.type)) return false;
  if (s.rarities.size > 0 && !s.rarities.has(card.rarity)) return false;
  if (s.archetypes.size > 0) {
    const archetype: CardArchetype = card.archetype ?? 'neutral';
    if (!s.archetypes.has(archetype)) return false;
  }
  if (s.keywords.size > 0 && !matchesAnyKeyword(card, s.keywords)) return false;
  if (card.energyCost < s.energyMin || card.energyCost > s.energyMax) return false;
  if (s.search.length > 0 && !matchesSearch(card, s.search)) return false;
  return true;
}

function matchesAnyKeyword(card: CardDefinition, active: ReadonlySet<KeywordFilter>): boolean {
  for (const kw of active) {
    if (kw === 'link'      && card.link)      return true;
    if (kw === 'terraform' && card.terraform) return true;
    if (kw === 'innate'    && card.innate)    return true;
    if (kw === 'retain'    && card.retain)    return true;
    if (kw === 'ethereal'  && card.ethereal)  return true;
    if (kw === 'exhaust'   && card.exhaust)   return true;
  }
  return false;
}

function matchesSearch(card: CardDefinition, query: string): boolean {
  // Lowercased query normalization lives in LibraryFiltersComponent.onSearchInput.
  const haystack = (card.name + ' ' + card.description + ' ' + (card.upgradedDescription ?? '')).toLowerCase();
  return haystack.includes(query);
}

function makeComparator(sort: SortMode): (a: CardDefinition, b: CardDefinition) => number {
  const rarityRank = (r: CardRarity): number => {
    switch (r) {
      case CardRarity.STARTER:  return 0;
      case CardRarity.COMMON:   return 1;
      case CardRarity.UNCOMMON: return 2;
      case CardRarity.RARE:     return 3;
    }
  };
  const archetypeRank = (d: CardDefinition): number => {
    switch (d.archetype) {
      case 'cartographer': return 1;
      case 'highground':   return 2;
      case 'conduit':      return 3;
      case 'siegeworks':   return 4;
      default:             return 0; // neutral / undefined first
    }
  };

  switch (sort) {
    case 'alpha':
      return (a, b) => a.name.localeCompare(b.name);
    case 'rarityAsc':
      return (a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || a.name.localeCompare(b.name);
    case 'rarityDesc':
      return (a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || a.name.localeCompare(b.name);
    case 'energyAsc':
      return (a, b) => a.energyCost - b.energyCost || a.name.localeCompare(b.name);
    case 'energyDesc':
      return (a, b) => b.energyCost - a.energyCost || a.name.localeCompare(b.name);
    case 'archetype':
    default:
      return (a, b) =>
        archetypeRank(a) - archetypeRank(b)
        || rarityRank(a.rarity) - rarityRank(b.rarity)
        || a.name.localeCompare(b.name);
  }
}
