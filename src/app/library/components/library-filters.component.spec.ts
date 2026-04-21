import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardRarity, CardType } from '../../run/models/card.model';
import {
  DEFAULT_FILTERS,
  FilterState,
  LibraryFiltersComponent,
} from './library-filters.component';

describe('LibraryFiltersComponent', () => {
  let fixture: ComponentFixture<LibraryFiltersComponent>;
  let component: LibraryFiltersComponent;

  const refresh = () => {
    fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LibraryFiltersComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LibraryFiltersComponent);
    component = fixture.componentInstance;
    component.state = DEFAULT_FILTERS;
    component.totalMatches = 10;
    component.totalCards = 20;
    refresh();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('renders all type chips', () => {
    const typeChips = fixture.nativeElement.querySelectorAll('.chip--type');
    expect(typeChips.length).toBe(4);
  });

  it('renders all rarity chips', () => {
    const rarityChips = fixture.nativeElement.querySelectorAll('.chip--rarity');
    expect(rarityChips.length).toBe(4);
  });

  it('renders all archetype chips (5 incl. neutral)', () => {
    const archetypeChips = fixture.nativeElement.querySelectorAll('.chip--archetype');
    expect(archetypeChips.length).toBe(5);
  });

  it('renders all keyword chips', () => {
    const keywordChips = fixture.nativeElement.querySelectorAll('.chip--keyword');
    expect(keywordChips.length).toBe(6);
  });

  it('toggling type chip emits state with that type added', () => {
    let emitted: FilterState | null = null;
    component.stateChange.subscribe(s => (emitted = s));
    component.toggleType(CardType.TOWER);
    expect(emitted).not.toBeNull();
    expect(emitted!.types.has(CardType.TOWER)).toBe(true);
  });

  it('toggling the same type chip twice removes it', () => {
    const emissions: FilterState[] = [];
    component.stateChange.subscribe(s => emissions.push(s));
    component.toggleType(CardType.TOWER);
    component.state = emissions[0];
    component.toggleType(CardType.TOWER);
    expect(emissions[1].types.has(CardType.TOWER)).toBe(false);
  });

  it('toggling rarity chip emits state with that rarity added', () => {
    let emitted: FilterState | null = null;
    component.stateChange.subscribe(s => (emitted = s));
    component.toggleRarity(CardRarity.RARE);
    expect(emitted!.rarities.has(CardRarity.RARE)).toBe(true);
  });

  it('isTypeActive reflects current state', () => {
    component.state = {
      ...DEFAULT_FILTERS,
      types: new Set<CardType>([CardType.TOWER]),
    };
    expect(component.isTypeActive(CardType.TOWER)).toBe(true);
    expect(component.isTypeActive(CardType.SPELL)).toBe(false);
  });

  it('sort dropdown emits new sort mode', () => {
    let emitted: FilterState | null = null;
    component.stateChange.subscribe(s => (emitted = s));
    component.onSortChange('alpha');
    expect(emitted!.sort).toBe('alpha');
  });

  it('energy min change never exceeds energy max', () => {
    component.state = { ...DEFAULT_FILTERS, energyMin: 0, energyMax: 2 };
    let emitted: FilterState | null = null;
    component.stateChange.subscribe(s => (emitted = s));
    component.onEnergyMinChange(5);
    expect(emitted!.energyMin).toBe(5);
    expect(emitted!.energyMax).toBe(5); // clamped upward
  });

  it('energy max change never drops below energy min', () => {
    component.state = { ...DEFAULT_FILTERS, energyMin: 2, energyMax: 3 };
    let emitted: FilterState | null = null;
    component.stateChange.subscribe(s => (emitted = s));
    component.onEnergyMaxChange(0);
    expect(emitted!.energyMin).toBe(0); // clamped down
    expect(emitted!.energyMax).toBe(0);
  });

  it('energy input clamps negatives to 0', () => {
    let emitted: FilterState | null = null;
    component.stateChange.subscribe(s => (emitted = s));
    component.onEnergyMinChange(-3);
    expect(emitted!.energyMin).toBe(0);
  });

  it('energy input clamps > 10 to 10', () => {
    let emitted: FilterState | null = null;
    component.stateChange.subscribe(s => (emitted = s));
    component.onEnergyMaxChange(42);
    expect(emitted!.energyMax).toBe(10);
  });

  it('search input debounces and emits lowercase trimmed', (done) => {
    let emitted: FilterState | null = null;
    component.stateChange.subscribe(s => (emitted = s));
    component.onSearchInput('  CONDUIT  ');
    expect(emitted).toBeNull(); // not yet emitted
    setTimeout(() => {
      expect(emitted!.search).toBe('conduit');
      done();
    }, 180);
  });

  it('clearAll preserves sort mode but resets everything else', () => {
    component.state = {
      types: new Set<CardType>([CardType.TOWER]),
      rarities: new Set<CardRarity>([CardRarity.RARE]),
      archetypes: new Set(['conduit']),
      keywords: new Set(['link']),
      energyMin: 1,
      energyMax: 2,
      search: 'handshake',
      sort: 'energyDesc',
    };
    let emitted: FilterState | null = null;
    component.stateChange.subscribe(s => (emitted = s));
    component.clearAll();
    expect(emitted!.types.size).toBe(0);
    expect(emitted!.rarities.size).toBe(0);
    expect(emitted!.archetypes.size).toBe(0);
    expect(emitted!.keywords.size).toBe(0);
    expect(emitted!.energyMin).toBe(0);
    expect(emitted!.energyMax).toBe(3);
    expect(emitted!.search).toBe('');
    expect(emitted!.sort).toBe('energyDesc'); // preserved
  });

  it('hasActiveFilters returns false for default state', () => {
    component.state = DEFAULT_FILTERS;
    expect(component.hasActiveFilters).toBe(false);
  });

  it('hasActiveFilters returns true when a type chip is active', () => {
    component.state = { ...DEFAULT_FILTERS, types: new Set<CardType>([CardType.TOWER]) };
    expect(component.hasActiveFilters).toBe(true);
  });

  it('hasActiveFilters returns true when search text is set', () => {
    component.state = { ...DEFAULT_FILTERS, search: 'fire' };
    expect(component.hasActiveFilters).toBe(true);
  });

  it('hasActiveFilters returns true when energy range narrowed', () => {
    component.state = { ...DEFAULT_FILTERS, energyMin: 1, energyMax: 2 };
    expect(component.hasActiveFilters).toBe(true);
  });

  it('renders match tally', () => {
    const tally = fixture.nativeElement.querySelector('.filters__tally') as HTMLElement;
    expect(tally.textContent).toContain('10');
    expect(tally.textContent).toContain('20');
  });

  it('clear filters button is disabled at default state', () => {
    const btn = fixture.nativeElement.querySelector('.filters__clear') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
