import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CardLibraryComponent } from './card-library.component';
import { CARD_DEFINITIONS } from '../run/constants/card-definitions';
import { CardType } from '../run/models/card.model';

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

  it('sorts neutral-archetype cards before archetype-tagged cards', () => {
    const firstArchetyped = component.allCards.findIndex(
      c => c.archetype !== undefined && c.archetype !== 'neutral',
    );
    const lastNeutral = (() => {
      for (let i = component.allCards.length - 1; i >= 0; i--) {
        const a = component.allCards[i].archetype;
        if (a === undefined || a === 'neutral') return i;
      }
      return -1;
    })();
    expect(lastNeutral).toBeLessThan(firstArchetyped);
  });

  it('trackById returns the card id', () => {
    const card = component.allCards[0];
    expect(component.trackById(0, card)).toBe(card.id);
  });

  it('renders one tile per card', () => {
    const tiles = fixture.nativeElement.querySelectorAll('app-library-card-tile');
    expect(tiles.length).toBe(component.allCards.length);
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
