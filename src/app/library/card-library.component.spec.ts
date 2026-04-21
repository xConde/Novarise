import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CardLibraryComponent } from './card-library.component';
import { CARD_DEFINITIONS } from '../run/constants/card-definitions';
import { CardId, CardRarity, CardType } from '../run/models/card.model';
import { DEFAULT_FILTERS } from './components/library-filters.component';
import { SeenCardsService } from '../core/services/seen-cards.service';

describe('CardLibraryComponent', () => {
  let fixture: ComponentFixture<CardLibraryComponent>;
  let component: CardLibraryComponent;
  let seenCards: SeenCardsService;

  beforeEach(async () => {
    // Clear localStorage between tests so view-mode specs start from a
    // known-empty seen set regardless of which other specs ran earlier.
    localStorage.removeItem('novarise_seen_cards');
    await TestBed.configureTestingModule({
      declarations: [CardLibraryComponent],
      imports: [RouterTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CardLibraryComponent);
    component = fixture.componentInstance;
    seenCards = TestBed.inject(SeenCardsService);
    seenCards.clear();
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem('novarise_seen_cards');
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

  it('countsByType tracks every card type', () => {
    expect(component.countsByType.get(CardType.TOWER) ?? 0).toBeGreaterThan(0);
    expect(component.countsByType.get(CardType.SPELL) ?? 0).toBeGreaterThan(0);
    expect(component.countsByType.get(CardType.MODIFIER) ?? 0).toBeGreaterThan(0);
    expect(component.countsByType.get(CardType.UTILITY) ?? 0).toBeGreaterThan(0);
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

  // ── Seen / Unseen (L5) ──────────────────────────────────────────────

  it('viewMode starts as "all" and filteredCards includes every card', () => {
    expect(component.viewMode).toBe('all');
    expect(component.filteredCards.length).toBe(component.allCards.length);
  });

  it('viewMode "seen" shows only cards already in the seen set', () => {
    const target = component.allCards[0];
    seenCards.markSeen(target.id);
    component.onViewModeChange('seen');
    expect(component.filteredCards.length).toBe(1);
    expect(component.filteredCards[0]).toBe(target);
  });

  it('viewMode "unseen" excludes cards in the seen set', () => {
    const target = component.allCards[0];
    seenCards.markSeen(target.id);
    component.onViewModeChange('unseen');
    expect(component.filteredCards.length).toBe(component.allCards.length - 1);
    expect(component.filteredCards.every(c => c.id !== target.id)).toBe(true);
  });

  it('seenCount + unseenCount equals totalCards', () => {
    expect(component.seenCount + component.unseenCount).toBe(component.totalCards);
  });

  it('isDesaturated returns true for unseen cards by default', () => {
    const unseen = component.allCards[0];
    expect(component.isDesaturated(unseen)).toBe(true);
  });

  it('isDesaturated returns false for seen cards', () => {
    const card = component.allCards[0];
    seenCards.markSeen(card.id);
    expect(component.isDesaturated(card)).toBe(false);
  });

  it('isDesaturated returns false for every card when forceFullColor is on', () => {
    component.forceFullColor = true;
    expect(component.isDesaturated(component.allCards[0])).toBe(false);
  });

  it('toggleShowUpgraded flips the showUpgraded flag', () => {
    expect(component.showUpgraded).toBe(false);
    component.toggleShowUpgraded();
    expect(component.showUpgraded).toBe(true);
    component.toggleShowUpgraded();
    expect(component.showUpgraded).toBe(false);
  });

  it('toggleForceFullColor flips the forceFullColor flag', () => {
    expect(component.forceFullColor).toBe(false);
    component.toggleForceFullColor();
    expect(component.forceFullColor).toBe(true);
  });

  it('clearSeenHistory empties the seen set via SeenCardsService', () => {
    seenCards.markSeen(CardId.TOWER_BASIC);
    component.clearSeenHistory();
    expect(seenCards.getAll().size).toBe(0);
  });

  it('seen observable updates filteredCards when viewMode is seen', () => {
    component.onViewModeChange('seen');
    expect(component.filteredCards.length).toBe(0);
    seenCards.markSeen(component.allCards[0].id);
    expect(component.filteredCards.length).toBe(1);
  });

  it('view-mode filter composes with other filter axes', () => {
    // Mark one Conduit card as seen, then combine viewMode=seen with archetype=conduit
    const conduitCard = component.allCards.find(c => c.archetype === 'conduit');
    if (!conduitCard) throw new Error('spec invariant — at least one conduit card must exist');
    seenCards.markSeen(conduitCard.id);
    component.onViewModeChange('seen');
    component.onFiltersChange({
      ...DEFAULT_FILTERS,
      archetypes: new Set(['conduit']),
    });
    expect(component.filteredCards.length).toBe(1);
    expect(component.filteredCards[0]).toBe(conduitCard);
  });

  it('empty state shows tab-specific hint on unseen tab', () => {
    seenCards.markSeenMany(component.allCards.map(c => c.id));
    component.onViewModeChange('unseen');
    fixture.detectChanges();
    const hint = fixture.nativeElement.querySelector('.library__empty-hint') as HTMLElement;
    expect(hint.textContent).toContain('run');
  });
});
