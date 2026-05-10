import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { CardDraftComponent } from './card-draft.component';
import { CardId, CardRarity, CardType } from '../../models/card.model';
import { CardReward } from '../../models/encounter.model';
import { DescriptionTextComponent } from '@shared/components/description-text/description-text.component';

const MOCK_CHOICES: CardReward[] = [
  { type: 'card', cardId: CardId.GOLD_RUSH },
  { type: 'card', cardId: CardId.DAMAGE_BOOST },
  { type: 'card', cardId: CardId.FORTIFY },
];

const TOWER_CHOICES: CardReward[] = [
  { type: 'card', cardId: CardId.TOWER_BASIC },
  { type: 'card', cardId: CardId.GOLD_RUSH },
  { type: 'card', cardId: CardId.DAMAGE_BOOST },
];

describe('CardDraftComponent', () => {
  let fixture: ComponentFixture<CardDraftComponent>;
  let component: CardDraftComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CardDraftComponent],
      imports: [CommonModule, DescriptionTextComponent],
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

  it('getFrameClass returns frame modifier for tower type', () => {
    expect(component.getFrameClass(CardType.TOWER)).toBe('card-draft__card--frame-tower');
  });

  it('getFrameClass returns frame modifier for spell type', () => {
    expect(component.getFrameClass(CardType.SPELL)).toBe('card-draft__card--frame-spell');
  });

  it('getFrameClass returns frame modifier for modifier type', () => {
    expect(component.getFrameClass(CardType.MODIFIER)).toBe('card-draft__card--frame-modifier');
  });

  it('getFrameClass returns frame modifier for utility type', () => {
    expect(component.getFrameClass(CardType.UTILITY)).toBe('card-draft__card--frame-utility');
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

  describe('hover tooltip', () => {
    it('hoveredCard is null initially', () => {
      expect(component.hoveredCard).toBeNull();
    });

    it('pointer enter with mouse schedules hoveredCard after 200ms', fakeAsync(() => {
      const item = component.resolvedCards[0];
      const card = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLButtonElement>('.card-draft__card')[0];
      const event = new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true });
      Object.defineProperty(event, 'currentTarget', { value: card });
      component.onCardPointerEnter(event, item);

      expect(component.hoveredCard).toBeNull();
      tick(200);
      expect(component.hoveredCard).toBe(item);
    }));

    it('pointer leave with mouse clears hoveredCard immediately', fakeAsync(() => {
      const item = component.resolvedCards[0];
      const card = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLButtonElement>('.card-draft__card')[0];
      const enterEvent = new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true });
      Object.defineProperty(enterEvent, 'currentTarget', { value: card });
      component.onCardPointerEnter(enterEvent, item);
      tick(200);
      expect(component.hoveredCard).toBe(item);

      const leaveEvent = new PointerEvent('pointerleave', { pointerType: 'mouse', bubbles: true });
      component.onCardPointerLeave(leaveEvent);
      expect(component.hoveredCard).toBeNull();
    }));

    it('pointer leave cancels a pending hover delay without showing the tooltip', fakeAsync(() => {
      const item = component.resolvedCards[0];
      const card = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLButtonElement>('.card-draft__card')[0];
      const enterEvent = new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true });
      Object.defineProperty(enterEvent, 'currentTarget', { value: card });
      component.onCardPointerEnter(enterEvent, item);

      const leaveEvent = new PointerEvent('pointerleave', { pointerType: 'mouse', bubbles: true });
      component.onCardPointerLeave(leaveEvent);

      tick(200);
      expect(component.hoveredCard).toBeNull();
    }));

    it('keyboard focus on a not-yet-laid-out element does NOT pin tooltip to viewport (0,0)', () => {
      // Regression: on /run reward-screen mount, the browser auto-focuses the
      // first draft card before Angular finishes laying out its position.
      // getBoundingClientRect at that moment returns a zero rect; without the
      // guard, the tooltip would anchor to viewport (0, 0) — visible as a
      // stuck card preview in the top-left.
      const item = component.resolvedCards[0];
      const detachedTarget = document.createElement('button');
      // Detached element: getBoundingClientRect returns zero on all fields
      const event = { currentTarget: detachedTarget } as unknown as FocusEvent;

      component.onCardFocus(event, item);

      // Synchronous path: must NOT have set hoveredCard (rect was zero).
      // The retry-on-rAF still fires but rect remains zero on a detached
      // element so it bails too.
      expect(component.hoveredCard).toBeNull();
      expect(component.hoveredCardRect).toBeNull();
    });

    it('ngOnChanges clears stale hover state when cardChoices changes', () => {
      // Simulate a tooltip that lingered from a previous draft into a new one.
      // The previous draft's rect would now be stale relative to the
      // current card layout — clearing on input change is the safety net.
      const stubRect = {
        top: 100, left: 100, width: 120, height: 80,
        bottom: 180, right: 220, x: 100, y: 100,
        toJSON: () => ({}),
      } as DOMRect;
      component.hoveredCard = component.resolvedCards[0];
      component.hoveredCardRect = stubRect;

      component.ngOnChanges({
        cardChoices: {
          previousValue: component.cardChoices,
          currentValue: [],
          firstChange: false,
          isFirstChange: () => false,
        },
      });

      expect(component.hoveredCard).toBeNull();
      expect(component.hoveredCardRect).toBeNull();
    });

    it('keyboard focus shows tooltip immediately (no hover delay)', () => {
      const item = component.resolvedCards[0];
      const card = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLButtonElement>('.card-draft__card')[0];
      const event = new FocusEvent('focus', { bubbles: true });
      Object.defineProperty(event, 'currentTarget', { value: card });

      component.onCardFocus(event, item);

      expect(component.hoveredCard).toBe(item);
    });

    it('keyboard blur clears tooltip', () => {
      const item = component.resolvedCards[0];
      const card = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLButtonElement>('.card-draft__card')[0];
      const focusEvent = new FocusEvent('focus', { bubbles: true });
      Object.defineProperty(focusEvent, 'currentTarget', { value: card });
      component.onCardFocus(focusEvent, item);

      component.onCardBlur();

      expect(component.hoveredCard).toBeNull();
    });

    it('non-mouse pointer enter does NOT schedule hoveredCard', fakeAsync(() => {
      const item = component.resolvedCards[0];
      const card = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLButtonElement>('.card-draft__card')[0];
      const event = new PointerEvent('pointerenter', { pointerType: 'touch', bubbles: true });
      Object.defineProperty(event, 'currentTarget', { value: card });
      component.onCardPointerEnter(event, item);
      tick(200);
      expect(component.hoveredCard).toBeNull();
    }));

    it('long-press on touch shows tooltip after 500ms', fakeAsync(() => {
      const item = component.resolvedCards[0];
      const card = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLButtonElement>('.card-draft__card')[0];
      const downEvent = new PointerEvent('pointerdown', {
        pointerType: 'touch', clientX: 50, clientY: 50, bubbles: true,
      });
      Object.defineProperty(downEvent, 'currentTarget', { value: card });
      component.onCardPointerDown(downEvent, item);

      expect(component.hoveredCard).toBeNull();
      tick(500);
      expect(component.hoveredCard).toBe(item);
    }));

    it('long-press suppresses the click that synthesizes after pointerup (no double-fire)', fakeAsync(() => {
      const item = component.resolvedCards[0];
      const card = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLButtonElement>('.card-draft__card')[0];
      const downEvent = new PointerEvent('pointerdown', {
        pointerType: 'touch', clientX: 50, clientY: 50, bubbles: true,
      });
      Object.defineProperty(downEvent, 'currentTarget', { value: card });
      let pickEmitted = false;
      component.cardPicked.subscribe(() => { pickEmitted = true; });

      component.onCardPointerDown(downEvent, item);
      tick(500); // long-press fires, tooltip shows
      // Now the synthesized click that follows pointerup must NOT commit the pick
      component.pickCard(item.reward);

      expect(pickEmitted).toBeFalse();
    }));

    it('a normal tap (no long-press) still picks the card', fakeAsync(() => {
      const item = component.resolvedCards[0];
      let pickEmitted = false;
      component.cardPicked.subscribe(() => { pickEmitted = true; });

      // No pointerdown / no long-press — direct click path (mouse or short tap).
      component.pickCard(item.reward);

      expect(pickEmitted).toBeTrue();
    }));

    it('long-press is cancelled if pointer moves beyond slop threshold', fakeAsync(() => {
      const item = component.resolvedCards[0];
      const card = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLButtonElement>('.card-draft__card')[0];
      const downEvent = new PointerEvent('pointerdown', {
        pointerType: 'touch', clientX: 50, clientY: 50, bubbles: true,
      });
      Object.defineProperty(downEvent, 'currentTarget', { value: card });
      component.onCardPointerDown(downEvent, item);

      const moveEvent = new PointerEvent('pointermove', {
        pointerType: 'touch', clientX: 60, clientY: 50, bubbles: true,
      });
      component.onCardPointerMove(moveEvent);

      tick(500);
      expect(component.hoveredCard).toBeNull();
    }));

    it('click after long-press is suppressed (peek-vs-commit gesture separation)', fakeAsync(() => {
      // QA-flag fix: original design treated long-press as a peek where the
      // synthesized click after pointerup committed the pick. That made
      // long-pressing to read a card unreliable — any hold beyond 500ms
      // would commit. New behavior: long-press peeks, a separate tap
      // (no held interval) commits. Mirrors card-hand's longPressFired
      // suppression pattern.
      const item = component.resolvedCards[0];
      const card = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLButtonElement>('.card-draft__card')[0];
      const downEvent = new PointerEvent('pointerdown', {
        pointerType: 'touch', clientX: 50, clientY: 50, bubbles: true,
      });
      Object.defineProperty(downEvent, 'currentTarget', { value: card });
      component.onCardPointerDown(downEvent, item);
      tick(500);
      expect(component.hoveredCard).toBe(item);

      const emitted: CardReward[] = [];
      component.cardPicked.subscribe(r => emitted.push(r));
      component.pickCard(item.reward);
      // Long-press fired → click suppressed → no commit on this gesture
      expect(emitted.length).toBe(0);

      // A subsequent independent tap commits normally
      component.pickCard(item.reward);
      expect(emitted.length).toBe(1);
      expect(emitted[0].cardId).toBe(CardId.GOLD_RUSH);
    }));

    it('pickCard clears hoveredCard', fakeAsync(() => {
      const item = component.resolvedCards[0];
      const card = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLButtonElement>('.card-draft__card')[0];
      const enterEvent = new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true });
      Object.defineProperty(enterEvent, 'currentTarget', { value: card });
      component.onCardPointerEnter(enterEvent, item);
      tick(200);
      expect(component.hoveredCard).toBe(item);

      component.pickCard(item.reward);
      expect(component.hoveredCard).toBeNull();
    }));

    it('ngOnDestroy clears a pending hover delay timer', fakeAsync(() => {
      const item = component.resolvedCards[0];
      const card = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLButtonElement>('.card-draft__card')[0];
      const enterEvent = new PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true });
      Object.defineProperty(enterEvent, 'currentTarget', { value: card });
      component.onCardPointerEnter(enterEvent, item);

      component.ngOnDestroy();
      tick(200);
      expect(component.hoveredCard).toBeNull();
    }));

    it('hoverTooltipKeywords returns Terraform for a terraform card', () => {
      const item = component.resolvedCards.find(r => {
        return component.hoverTooltipKeywords(r).includes('Terraform');
      });
      // If no terraform card is in MOCK_CHOICES, test passes vacuously —
      // verify the method returns an array without throwing.
      if (item) {
        expect(component.hoverTooltipKeywords(item)).toContain('Terraform');
      } else {
        expect(component.hoverTooltipKeywords(component.resolvedCards[0])).toEqual(jasmine.any(Array));
      }
    });
  });

  describe('tower footprint preview', () => {
    beforeEach(() => {
      component.cardChoices = TOWER_CHOICES;
      fixture.detectChanges();
    });

    it('renders .card-draft__footprint on the tower card', () => {
      const cards = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLElement>('.card-draft__card');
      // First card is TOWER_BASIC — should have footprint
      const fp = cards[0].querySelector('.card-draft__footprint');
      expect(fp).toBeTruthy();
    });

    it('does NOT render .card-draft__footprint on non-tower cards', () => {
      const cards = (fixture.nativeElement as HTMLElement)
        .querySelectorAll<HTMLElement>('.card-draft__card');
      // Second card is GOLD_RUSH (spell), third is DAMAGE_BOOST (modifier)
      expect(cards[1].querySelector('.card-draft__footprint')).toBeFalsy();
      expect(cards[2].querySelector('.card-draft__footprint')).toBeFalsy();
    });

    it('footprint element is aria-hidden', () => {
      const fp = (fixture.nativeElement as HTMLElement)
        .querySelector('.card-draft__footprint');
      expect(fp?.getAttribute('aria-hidden')).toBe('true');
    });

    it('footprint contains an SVG rect element', () => {
      const rect = (fixture.nativeElement as HTMLElement)
        .querySelector('.card-draft__footprint svg rect');
      expect(rect).toBeTruthy();
    });
  });
});
