import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CardLibraryComponent } from './card-library.component';
import { CARD_DEFINITIONS } from '../run/constants/card-definitions';
import { CardRarity, CardType } from '../run/models/card.model';
import { DEFAULT_FILTERS } from './components/library-filters.component';

describe('CardLibraryComponent', () => {
  let fixture: ComponentFixture<CardLibraryComponent>;
  let component: CardLibraryComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CardLibraryComponent],
      imports: [RouterTestingModule],
      schemas: [NO_ERRORS_SCHEMA], // skip app-icon / app-library-card-tile deep render
    }).compileComponents();

    fixture = TestBed.createComponent(CardLibraryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('exposes every CardDefinition in allCards', () => {
    expect(component.allCards.length).toBe(Object.keys(CARD_DEFINITIONS).length);
  });

  it('totalCards matches allCards.length', () => {
    expect(component.totalCards).toBe(component.allCards.length);
  });

  it('countsByType tallies every card', () => {
    const tallySum = Array.from(component.countsByType.values()).reduce((a, b) => a + b, 0);
    expect(tallySum).toBe(component.allCards.length);
  });

  it('default filter shows every card', () => {
    expect(component.filteredCards.length).toBe(component.allCards.length);
  });

  it('archetype sort places neutral cards before archetype-tagged ones', () => {
    const firstArchetyped = component.filteredCards.findIndex(
      c => c.archetype !== undefined && c.archetype !== 'neutral',
    );
    const lastNeutral = (() => {
      for (let i = component.filteredCards.length - 1; i >= 0; i--) {
        const a = component.filteredCards[i].archetype;
        if (a === undefined || a === 'neutral') return i;
      }
      return -1;
    })();
    expect(lastNeutral).toBeLessThan(firstArchetyped);
  });

  it('type filter narrows filteredCards to matching type', () => {
    component.onFiltersChange({
      ...DEFAULT_FILTERS,
      types: new Set<CardType>([CardType.TOWER]),
    });
    expect(component.filteredCards.every(c => c.type === CardType.TOWER)).toBe(true);
    expect(component.filteredCards.length).toBeGreaterThan(0);
    expect(component.filteredCards.length).toBeLessThan(component.allCards.length);
  });

  it('rarity filter narrows filteredCards to matching rarities', () => {
    component.onFiltersChange({
      ...DEFAULT_FILTERS,
      rarities: new Set<CardRarity>([CardRarity.RARE]),
    });
    expect(component.filteredCards.every(c => c.rarity === CardRarity.RARE)).toBe(true);
  });

  it('archetype filter includes neutral-tagged cards when neutral is selected', () => {
    component.onFiltersChange({
      ...DEFAULT_FILTERS,
      archetypes: new Set(['neutral']),
    });
    expect(component.filteredCards.every(c =>
      c.archetype === undefined || c.archetype === 'neutral',
    )).toBe(true);
  });

  it('keyword filter narrows to cards carrying that keyword', () => {
    component.onFiltersChange({
      ...DEFAULT_FILTERS,
      keywords: new Set(['link']),
    });
    expect(component.filteredCards.length).toBeGreaterThan(0);
    expect(component.filteredCards.every(c => c.link === true)).toBe(true);
  });

  it('energy range excludes cards outside [min, max]', () => {
    component.onFiltersChange({
      ...DEFAULT_FILTERS,
      energyMin: 2,
      energyMax: 2,
    });
    expect(component.filteredCards.every(c => c.energyCost === 2)).toBe(true);
  });

  it('search matches against card name (case-insensitive)', () => {
    component.onFiltersChange({ ...DEFAULT_FILTERS, search: 'handshake' });
    const found = component.filteredCards.find(c => c.name.toLowerCase() === 'handshake');
    expect(found).toBeTruthy();
  });

  it('search matches against description', () => {
    component.onFiltersChange({ ...DEFAULT_FILTERS, search: 'gold' });
    expect(component.filteredCards.some(c => c.description.toLowerCase().includes('gold'))).toBe(true);
  });

  it('sort:alpha returns alphabetically ordered cards', () => {
    component.onFiltersChange({ ...DEFAULT_FILTERS, sort: 'alpha' });
    const names = component.filteredCards.map(c => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('sort:energyAsc returns cards ordered by energy cost ascending', () => {
    component.onFiltersChange({ ...DEFAULT_FILTERS, sort: 'energyAsc' });
    for (let i = 1; i < component.filteredCards.length; i++) {
      expect(component.filteredCards[i].energyCost).toBeGreaterThanOrEqual(
        component.filteredCards[i - 1].energyCost,
      );
    }
  });

  it('sort:energyDesc orders highest energy first', () => {
    component.onFiltersChange({ ...DEFAULT_FILTERS, sort: 'energyDesc' });
    for (let i = 1; i < component.filteredCards.length; i++) {
      expect(component.filteredCards[i].energyCost).toBeLessThanOrEqual(
        component.filteredCards[i - 1].energyCost,
      );
    }
  });

  it('empty-state renders when no cards match', () => {
    component.onFiltersChange({ ...DEFAULT_FILTERS, search: 'zzzzyxyyyy-no-match' });
    fixture.detectChanges();
    expect(component.filteredCards.length).toBe(0);
    expect(fixture.nativeElement.querySelector('.library__empty')).toBeTruthy();
  });

  it('trackById returns the card id', () => {
    const card = component.allCards[0];
    expect(component.trackById(0, card)).toBe(card.id);
  });

  it('renders one tile per filtered card', () => {
    const tiles = fixture.nativeElement.querySelectorAll('app-library-card-tile');
    expect(tiles.length).toBe(component.filteredCards.length);
  });

  it('renders the type-tally chips', () => {
    const towerTally = component.countsByType.get(CardType.TOWER) ?? 0;
    expect(towerTally).toBeGreaterThan(0);
    const tallyEls = fixture.nativeElement.querySelectorAll('.tally-chip');
    expect(tallyEls.length).toBe(4); // tower / spell / modifier / utility
  });

  it('selectedCard starts null', () => {
    expect(component.selectedCard).toBeNull();
  });

  it('onCardSelected stores the selected card', () => {
    const card = component.allCards[0];
    component.onCardSelected(card);
    expect(component.selectedCard).toBe(card);
  });

  it('onModalClosed clears the selected card', () => {
    component.onCardSelected(component.allCards[0]);
    component.onModalClosed();
    expect(component.selectedCard).toBeNull();
  });
});
