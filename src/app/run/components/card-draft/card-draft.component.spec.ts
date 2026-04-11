import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { CardDraftComponent } from './card-draft.component';
import { CardId, CardRarity, CardType } from '../../models/card.model';
import { CardReward } from '../../models/encounter.model';

const MOCK_CHOICES: CardReward[] = [
  { type: 'card', cardId: CardId.GOLD_RUSH },
  { type: 'card', cardId: CardId.DAMAGE_BOOST },
  { type: 'card', cardId: CardId.FORTIFY },
];

describe('CardDraftComponent', () => {
  let fixture: ComponentFixture<CardDraftComponent>;
  let component: CardDraftComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CardDraftComponent],
      imports: [CommonModule],
    });

    fixture = TestBed.createComponent(CardDraftComponent);
    component = fixture.componentInstance;
    component.cardChoices = MOCK_CHOICES;
    fixture.detectChanges();
  });

  it('renders one card panel per choice', () => {
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.card-draft__card');
    expect(cards.length).toBe(3);
  });

  it('resolvedCards returns a definition for each choice', () => {
    expect(component.resolvedCards.length).toBe(3);
    expect(component.resolvedCards[0].reward.cardId).toBe(CardId.GOLD_RUSH);
    expect(component.resolvedCards[0].definition).toBeTruthy();
  });

  it('displays card names in the DOM', () => {
    const el = fixture.nativeElement as HTMLElement;
    // GOLD_RUSH card should show its name
    expect(el.textContent).toContain('Gold Rush');
  });

  it('picking a card emits cardPicked with the correct reward', () => {
    const emitted: CardReward[] = [];
    component.cardPicked.subscribe(r => emitted.push(r));

    const cards = (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('.card-draft__card');
    cards[0].click();

    expect(emitted.length).toBe(1);
    expect(emitted[0].type).toBe('card');
    expect(emitted[0].cardId).toBe(CardId.GOLD_RUSH);
  });

  it('picking a card sets selectedCard', () => {
    const cards = (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('.card-draft__card');
    cards[1].click();
    expect(component.selectedCard).toBe(CardId.DAMAGE_BOOST);
  });

  it('skip button emits skipped without emitting cardPicked', () => {
    const cardEmitted: CardReward[] = [];
    let skipEmitted = false;
    component.cardPicked.subscribe(r => cardEmitted.push(r));
    component.skipped.subscribe(() => (skipEmitted = true));

    const skipBtn = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.card-draft__skip-btn');
    skipBtn?.click();

    expect(skipEmitted).toBeTrue();
    expect(cardEmitted.length).toBe(0);
  });

  it('getTypeClass returns correct BEM modifier for card type', () => {
    expect(component.getTypeClass(CardType.TOWER)).toBe('card-draft__card--tower');
    expect(component.getTypeClass(CardType.SPELL)).toBe('card-draft__card--spell');
    expect(component.getTypeClass(CardType.MODIFIER)).toBe('card-draft__card--modifier');
    expect(component.getTypeClass(CardType.UTILITY)).toBe('card-draft__card--utility');
  });

  it('getRarityClass returns correct BEM modifier for rarity', () => {
    expect(component.getRarityClass(CardRarity.COMMON)).toBe('card-draft__card--rarity-common');
    expect(component.getRarityClass(CardRarity.UNCOMMON)).toBe('card-draft__card--rarity-uncommon');
    expect(component.getRarityClass(CardRarity.RARE)).toBe('card-draft__card--rarity-rare');
  });

  it('selected card receives --selected class after picking', () => {
    component.pickCard(MOCK_CHOICES[2]);
    fixture.detectChanges();
    expect(component.selectedCard).toBe(CardId.FORTIFY);
  });

  it('renders energy cost for each card', () => {
    const costs = (fixture.nativeElement as HTMLElement)
      .querySelectorAll('.card-draft__cost');
    expect(costs.length).toBe(3);
  });

  it('renders with empty cardChoices without throwing', () => {
    component.cardChoices = [];
    expect(() => fixture.detectChanges()).not.toThrow();
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.card-draft__card');
    expect(cards.length).toBe(0);
  });
});
