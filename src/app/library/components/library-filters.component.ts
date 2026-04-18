import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CardArchetype, CardRarity, CardType } from '../../run/models/card.model';

export type KeywordFilter = 'link' | 'terraform' | 'innate' | 'retain' | 'ethereal' | 'exhaust';
export type SortMode =
  | 'alpha'
  | 'rarityAsc'
  | 'rarityDesc'
  | 'energyAsc'
  | 'energyDesc'
  | 'archetype';
export type ArchetypeFilter = CardArchetype | 'neutral';

export interface FilterState {
  types: ReadonlySet<CardType>;
  rarities: ReadonlySet<CardRarity>;
  archetypes: ReadonlySet<ArchetypeFilter>;
  keywords: ReadonlySet<KeywordFilter>;
  energyMin: number;
  energyMax: number;
  search: string;
  sort: SortMode;
}

export const DEFAULT_FILTERS: FilterState = Object.freeze({
  types: new Set<CardType>(),
  rarities: new Set<CardRarity>(),
  archetypes: new Set<ArchetypeFilter>(),
  keywords: new Set<KeywordFilter>(),
  energyMin: 0,
  energyMax: 3,
  search: '',
  sort: 'archetype' as SortMode,
});

/**
 * Filter + sort + search bar for the library grid. Emits a new FilterState
 * object on every mutation (immutable pattern so OnPush can shallow-
 * compare). Input state is owned by CardLibraryComponent; this view is
 * a pure projection.
 *
 * Chip toggles behave like multi-select: clicking an active chip
 * removes it from the Set; clicking an inactive chip adds it. Empty
 * Set = "all" for that axis (no filter applied).
 */
@Component({
  selector: 'app-library-filters',
  templateUrl: './library-filters.component.html',
  styleUrls: ['./library-filters.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryFiltersComponent {
  @Input() state: FilterState = DEFAULT_FILTERS;
  @Input() totalMatches = 0;
  @Input() totalCards = 0;
  @Output() stateChange = new EventEmitter<FilterState>();

  private readonly searchDebounceMs = 150;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly CardType = CardType;
  readonly CardRarity = CardRarity;

  readonly typeOptions: readonly { value: CardType; label: string }[] = [
    { value: CardType.TOWER,    label: 'Tower' },
    { value: CardType.SPELL,    label: 'Spell' },
    { value: CardType.MODIFIER, label: 'Modifier' },
    { value: CardType.UTILITY,  label: 'Utility' },
  ];

  readonly rarityOptions: readonly { value: CardRarity; label: string }[] = [
    { value: CardRarity.STARTER,  label: 'Starter' },
    { value: CardRarity.COMMON,   label: 'Common' },
    { value: CardRarity.UNCOMMON, label: 'Uncommon' },
    { value: CardRarity.RARE,     label: 'Rare' },
  ];

  readonly archetypeOptions: readonly { value: ArchetypeFilter; label: string }[] = [
    { value: 'neutral',      label: 'Neutral' },
    { value: 'cartographer', label: 'Cartographer' },
    { value: 'highground',   label: 'Highground' },
    { value: 'conduit',      label: 'Conduit' },
    { value: 'siegeworks',   label: 'Siegeworks' },
  ];

  readonly keywordOptions: readonly { value: KeywordFilter; label: string }[] = [
    { value: 'link',      label: 'Link' },
    { value: 'terraform', label: 'Terraform' },
    { value: 'innate',    label: 'Innate' },
    { value: 'retain',    label: 'Retain' },
    { value: 'ethereal',  label: 'Ethereal' },
    { value: 'exhaust',   label: 'Exhaust' },
  ];

  readonly sortOptions: readonly { value: SortMode; label: string }[] = [
    { value: 'archetype',   label: 'Archetype' },
    { value: 'alpha',       label: 'A → Z' },
    { value: 'rarityAsc',   label: 'Rarity: low → high' },
    { value: 'rarityDesc',  label: 'Rarity: high → low' },
    { value: 'energyAsc',   label: 'Energy: low → high' },
    { value: 'energyDesc',  label: 'Energy: high → low' },
  ];

  get hasActiveFilters(): boolean {
    const s = this.state;
    return (
      s.types.size > 0 ||
      s.rarities.size > 0 ||
      s.archetypes.size > 0 ||
      s.keywords.size > 0 ||
      s.search.length > 0 ||
      s.energyMin !== DEFAULT_FILTERS.energyMin ||
      s.energyMax !== DEFAULT_FILTERS.energyMax
    );
  }

  toggleType(v: CardType): void {
    const next = new Set(this.state.types);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    this.emit({ ...this.state, types: next });
  }

  toggleRarity(v: CardRarity): void {
    const next = new Set(this.state.rarities);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    this.emit({ ...this.state, rarities: next });
  }

  toggleArchetype(v: ArchetypeFilter): void {
    const next = new Set(this.state.archetypes);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    this.emit({ ...this.state, archetypes: next });
  }

  toggleKeyword(v: KeywordFilter): void {
    const next = new Set(this.state.keywords);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    this.emit({ ...this.state, keywords: next });
  }

  isTypeActive(v: CardType): boolean       { return this.state.types.has(v); }
  isRarityActive(v: CardRarity): boolean    { return this.state.rarities.has(v); }
  isArchetypeActive(v: ArchetypeFilter): boolean { return this.state.archetypes.has(v); }
  isKeywordActive(v: KeywordFilter): boolean { return this.state.keywords.has(v); }

  onSortChange(value: SortMode): void {
    this.emit({ ...this.state, sort: value });
  }

  onEnergyMinChange(value: number): void {
    const min = clampEnergy(value);
    const max = Math.max(min, this.state.energyMax);
    this.emit({ ...this.state, energyMin: min, energyMax: max });
  }

  onEnergyMaxChange(value: number): void {
    const max = clampEnergy(value);
    const min = Math.min(max, this.state.energyMin);
    this.emit({ ...this.state, energyMin: min, energyMax: max });
  }

  onSearchInput(raw: string): void {
    if (this.searchDebounceTimer !== null) clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.emit({ ...this.state, search: raw.trim().toLowerCase() });
      this.searchDebounceTimer = null;
    }, this.searchDebounceMs);
  }

  clearAll(): void {
    this.emit({ ...DEFAULT_FILTERS, sort: this.state.sort });
  }

  private emit(next: FilterState): void {
    this.stateChange.emit(next);
  }
}

function clampEnergy(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 10) return 10;
  return Math.round(n);
}
