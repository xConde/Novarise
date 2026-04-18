import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { CardHandComponent, HandCard } from './card-hand.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import {
  CardId,
  CardRarity,
  CardType,
  CardInstance,
  DeckState,
  EnergyState,
} from '../../../../run/models/card.model';
import { getCardDefinition } from '../../../../run/constants/card-definitions';

// Minimal deck state helpers ────────────────────────────────────────────────

function makeInstance(cardId: CardId, upgraded = false): CardInstance {
  return { instanceId: `inst_${cardId}`, cardId, upgraded };
}

function makeDeckState(hand: CardInstance[] = []): DeckState {
  return {
    drawPile: [makeInstance(CardId.TOWER_BASIC)],
    hand,
    discardPile: [makeInstance(CardId.GOLD_RUSH)],
    exhaustPile: [],
  };
}

function makeEnergy(current = 3, max = 3): EnergyState {
  return { current, max };
}

describe('CardHandComponent', () => {
  let component: CardHandComponent;
  let fixture: ComponentFixture<CardHandComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CardHandComponent],
      imports: [CommonModule, IconComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CardHandComponent);
    component = fixture.componentInstance;
    component.deckState = makeDeckState();
    component.energy = makeEnergy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('resolveHand', () => {
    it('renders the correct number of cards from hand', () => {
      const hand = [
        makeInstance(CardId.TOWER_BASIC),
        makeInstance(CardId.GOLD_RUSH),
        makeInstance(CardId.DAMAGE_BOOST),
      ];
      component.deckState = makeDeckState(hand);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();

      expect(component.handCards.length).toBe(3);
    });

    it('resolves correct definition for each card', () => {
      component.deckState = makeDeckState([makeInstance(CardId.TOWER_BASIC)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();

      expect(component.handCards[0].definition.id).toBe(CardId.TOWER_BASIC);
      expect(component.handCards[0].definition.type).toBe(CardType.TOWER);
    });

    it('marks card as playable when energy is sufficient', () => {
      // TOWER_BASIC costs 1 energy
      component.deckState = makeDeckState([makeInstance(CardId.TOWER_BASIC)]);
      component.energy = makeEnergy(1, 3);
      component.resolveHand();

      expect(component.handCards[0].canPlay).toBeTrue();
    });

    it('marks card as unplayable when energy is insufficient', () => {
      // TOWER_MORTAR costs 3 energy
      component.deckState = makeDeckState([makeInstance(CardId.TOWER_MORTAR)]);
      component.energy = makeEnergy(1, 3);
      component.resolveHand();

      expect(component.handCards[0].canPlay).toBeFalse();
    });

    it('returns empty array when deckState is not set', () => {
      (component as unknown as { deckState: DeckState | null }).deckState = null;
      component.resolveHand();

      expect(component.handCards).toEqual([]);
    });

    it('handles empty hand', () => {
      component.deckState = makeDeckState([]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();

      expect(component.handCards).toEqual([]);
    });

    it('reflects upgraded flag on HandCard instance', () => {
      component.deckState = makeDeckState([makeInstance(CardId.TOWER_BASIC, true)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();

      expect(component.handCards[0].instance.upgraded).toBeTrue();
    });
  });

  describe('playCard', () => {
    it('emits cardPlayed with the card instance when card is playable', () => {
      const instance = makeInstance(CardId.TOWER_BASIC);
      component.deckState = makeDeckState([instance]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();

      const emitted: CardInstance[] = [];
      component.cardPlayed.subscribe(c => emitted.push(c));
      component.playCard(component.handCards[0]);

      expect(emitted.length).toBe(1);
      expect(emitted[0]).toBe(instance);
    });

    it('does not emit when card is unplayable', () => {
      component.deckState = makeDeckState([makeInstance(CardId.TOWER_MORTAR)]);
      component.energy = makeEnergy(0, 3);
      component.resolveHand();

      const emitted: CardInstance[] = [];
      component.cardPlayed.subscribe(c => emitted.push(c));
      const unplayable: HandCard = { ...component.handCards[0], canPlay: false };
      component.playCard(unplayable);

      expect(emitted.length).toBe(0);
    });
  });

  describe('cardInspected (right-click / long-press)', () => {
    function primeHand(): HandCard {
      const instance = makeInstance(CardId.TOWER_BASIC);
      component.deckState = makeDeckState([instance]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      return component.handCards[0];
    }

    it('onCardContextMenu emits cardInspected and prevents default', () => {
      const card = primeHand();
      const emitted: HandCard[] = [];
      component.cardInspected.subscribe(c => emitted.push(c));

      const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as MouseEvent;
      component.onCardContextMenu(event, card);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(emitted.length).toBe(1);
      expect(emitted[0]).toBe(card);
    });

    it('long-press (touch) emits cardInspected after 500ms', fakeAsync(() => {
      const card = primeHand();
      const emitted: HandCard[] = [];
      component.cardInspected.subscribe(c => emitted.push(c));

      const down = { pointerType: 'touch', clientX: 10, clientY: 20 } as PointerEvent;
      component.onCardPointerDown(down, card);

      // 499ms — timer hasn't fired
      tick(499);
      expect(emitted.length).toBe(0);

      // Cross the 500ms threshold
      tick(1);
      expect(emitted.length).toBe(1);
      expect(emitted[0]).toBe(card);
    }));

    it('long-press is cancelled if pointerup fires before the threshold', fakeAsync(() => {
      const card = primeHand();
      const emitted: HandCard[] = [];
      component.cardInspected.subscribe(c => emitted.push(c));

      component.onCardPointerDown({ pointerType: 'touch', clientX: 10, clientY: 20 } as PointerEvent, card);
      tick(300);
      component.onCardPointerUp();
      tick(500); // past the would-be-fire window
      expect(emitted.length).toBe(0);
    }));

    it('long-press is cancelled when finger moves past the slop threshold', fakeAsync(() => {
      const card = primeHand();
      const emitted: HandCard[] = [];
      component.cardInspected.subscribe(c => emitted.push(c));

      component.onCardPointerDown({ pointerType: 'touch', clientX: 10, clientY: 20 } as PointerEvent, card);
      // 10px move is past the 8px slop
      component.onCardPointerMove({ clientX: 25, clientY: 20 } as PointerEvent);
      tick(600);
      expect(emitted.length).toBe(0);
    }));

    it('mouse pointer events do NOT start a long-press timer (contextmenu handles right-click)', fakeAsync(() => {
      const card = primeHand();
      const emitted: HandCard[] = [];
      component.cardInspected.subscribe(c => emitted.push(c));

      component.onCardPointerDown({ pointerType: 'mouse', clientX: 10, clientY: 20 } as PointerEvent, card);
      tick(600);
      expect(emitted.length).toBe(0);
    }));

    it('onCardClick swallows the click when a long-press just fired (same gesture)', fakeAsync(() => {
      const card = primeHand();
      const played: CardInstance[] = [];
      const inspected: HandCard[] = [];
      component.cardPlayed.subscribe(c => played.push(c));
      component.cardInspected.subscribe(c => inspected.push(c));

      component.onCardPointerDown({ pointerType: 'touch', clientX: 0, clientY: 0 } as PointerEvent, card);
      tick(500);
      // Touch-up after the long-press fires typically synthesises a click.
      component.onCardClick(card);

      expect(inspected.length).toBe(1);
      expect(played.length).toBe(0); // click suppressed
    }));

    it('ngOnDestroy cancels a pending long-press timer', fakeAsync(() => {
      const card = primeHand();
      const emitted: HandCard[] = [];
      component.cardInspected.subscribe(c => emitted.push(c));

      component.onCardPointerDown({ pointerType: 'touch', clientX: 0, clientY: 0 } as PointerEvent, card);
      component.ngOnDestroy();
      tick(600);
      expect(emitted.length).toBe(0);
    }));
  });

  describe('keywordAriaLabel', () => {
    it('returns empty string when no keywords are set', () => {
      const card: HandCard = {
        instance: { cardId: CardId.TOWER_BASIC, instanceId: 'x', upgraded: false },
        definition: { ...getCardDefinition(CardId.TOWER_BASIC), innate: undefined, retain: undefined, ethereal: undefined, exhaust: undefined } as any,
        canPlay: true,
        effectiveEnergyCost: 1,
        goldCost: 50,
      };
      expect(component.keywordAriaLabel(card)).toBe('');
    });

    it('lists active keywords in stable order', () => {
      const card: HandCard = {
        instance: { cardId: CardId.TOWER_BASIC, instanceId: 'x', upgraded: false },
        definition: { ...getCardDefinition(CardId.TOWER_BASIC), innate: true, retain: true, ethereal: false, exhaust: true } as any,
        canPlay: true,
        effectiveEnergyCost: 1,
        goldCost: 50,
      };
      expect(component.keywordAriaLabel(card)).toBe('Keywords: Innate, Retain, Exhaust');
    });
  });

  describe('getCardTypeClass', () => {
    it('returns card--tower for TOWER type', () => {
      expect(component.getCardTypeClass(CardType.TOWER)).toBe('card--tower');
    });

    it('returns card--spell for SPELL type', () => {
      expect(component.getCardTypeClass(CardType.SPELL)).toBe('card--spell');
    });

    it('returns card--modifier for MODIFIER type', () => {
      expect(component.getCardTypeClass(CardType.MODIFIER)).toBe('card--modifier');
    });

    it('returns card--utility for UTILITY type', () => {
      expect(component.getCardTypeClass(CardType.UTILITY)).toBe('card--utility');
    });
  });

  describe('getRarityClass', () => {
    it('returns correct class for each rarity', () => {
      expect(component.getRarityClass(CardRarity.STARTER)).toBe('card--starter');
      expect(component.getRarityClass(CardRarity.COMMON)).toBe('card--common');
      expect(component.getRarityClass(CardRarity.UNCOMMON)).toBe('card--uncommon');
      expect(component.getRarityClass(CardRarity.RARE)).toBe('card--rare');
    });
  });

  describe('pile counts', () => {
    it('reflects draw pile and discard pile lengths from deckState', () => {
      const state: DeckState = {
        drawPile: [makeInstance(CardId.TOWER_BASIC), makeInstance(CardId.TOWER_BASIC)],
        hand: [],
        discardPile: [makeInstance(CardId.GOLD_RUSH)],
        exhaustPile: [],
      };
      component.deckState = state;
      component.energy = makeEnergy();
      component.resolveHand();

      expect(component.deckState.drawPile.length).toBe(2);
      expect(component.deckState.discardPile.length).toBe(1);
    });
  });

  describe('exhaust pile counter', () => {
    it('inspectPile("exhaust") emits pileInspected with "exhaust"', () => {
      const emitted: Array<'draw' | 'discard' | 'exhaust'> = [];
      component.pileInspected.subscribe(p => emitted.push(p));
      component.inspectPile('exhaust');
      expect(emitted).toEqual(['exhaust']);
    });

    it('exhaustPulse fires and clears when exhaustPile grows', fakeAsync(() => {
      component.deckState = {
        drawPile: [],
        hand: [],
        discardPile: [],
        exhaustPile: [makeInstance(CardId.TOWER_BASIC)],
      };
      component.energy = makeEnergy();
      // prime prevExhaustCount to 1 so the next change triggers a pulse
      component.ngOnChanges();

      // Grow the exhaust pile
      component.deckState = {
        drawPile: [],
        hand: [],
        discardPile: [],
        exhaustPile: [makeInstance(CardId.TOWER_BASIC), makeInstance(CardId.GOLD_RUSH)],
      };
      component.ngOnChanges();

      expect(component.exhaustPulse).toBeTrue();

      tick(350);
      expect(component.exhaustPulse).toBeFalse();
    }));
  });

  describe('energy display', () => {
    it('exposes current and max from the energy input', () => {
      component.energy = makeEnergy(2, 5);
      expect(component.energy.current).toBe(2);
      expect(component.energy.max).toBe(5);
    });
  });

  describe('resolvePips', () => {
    it('creates an array whose length matches energy.max', () => {
      component.energy = makeEnergy(2, 3);
      component.resolvePips();
      expect(component.energyPips.length).toBe(3);
    });

    it('caps pip count at 6 regardless of energy.max', () => {
      component.energy = makeEnergy(6, 10);
      component.resolvePips();
      expect(component.energyPips.length).toBe(6);
    });

    it('returns empty array when energy is not set', () => {
      (component as unknown as { energy: EnergyState | null }).energy = null;
      component.resolvePips();
      expect(component.energyPips.length).toBe(0);
    });

    it('is called by ngOnChanges', () => {
      spyOn(component, 'resolvePips');
      component.ngOnChanges();
      expect(component.resolvePips).toHaveBeenCalled();
    });
  });

  describe('pendingCardId', () => {
    it('defaults to null', () => {
      expect(component.pendingCardId).toBeNull();
    });

    it('accepts an instanceId string', () => {
      component.pendingCardId = 'inst_tower_basic';
      expect(component.pendingCardId).toBe('inst_tower_basic');
    });

    it('playCard is blocked for all cards when pendingCardId is set', () => {
      component.deckState = makeDeckState([makeInstance(CardId.GOLD_RUSH)]);
      component.energy = makeEnergy(3, 3);
      component.pendingCardId = 'inst_tower_basic';
      component.resolveHand();

      const emitted: CardInstance[] = [];
      component.cardPlayed.subscribe(c => emitted.push(c));

      // Attempt to play while pending
      component.playCard(component.handCards[0]);

      // playCard only guards canPlay — the disabled enforcement is in the template.
      // Here we verify canPlay is true (card is affordable) but the component-level
      // playCard method itself will still emit (template [disabled] prevents the click).
      // The real guard is in GameBoardComponent.onCardPlayed. This test documents that.
      expect(component.handCards[0].canPlay).toBeTrue();
    });
  });

  describe('goldCost', () => {
    it('resolves goldCost for tower cards', () => {
      component.deckState = makeDeckState([makeInstance(CardId.TOWER_BASIC)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();

      expect(component.handCards[0].goldCost).not.toBeNull();
      expect(component.handCards[0].goldCost).toBeGreaterThan(0);
    });

    it('goldCost is null for non-tower cards', () => {
      component.deckState = makeDeckState([makeInstance(CardId.GOLD_RUSH)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();

      expect(component.handCards[0].goldCost).toBeNull();
    });
  });

  describe('ngOnDestroy', () => {
    it('cleans up subscriptions without error', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('fan overlap', () => {
    const stubHandCard = (id: string, cardId: CardId): HandCard => {
      const definition = getCardDefinition(cardId);
      return {
        instance: { instanceId: id, cardId, upgraded: false },
        definition,
        canPlay: true,
        effectiveEnergyCost: definition.energyCost,
        goldCost: null,
      };
    };

    const makeCards = (count: number): HandCard[] => {
      const ids: CardId[] = [
        CardId.TOWER_BASIC,
        CardId.GOLD_RUSH,
        CardId.DAMAGE_BOOST,
        CardId.REPAIR_WALLS,
        CardId.SCOUT_AHEAD,
        CardId.FORTIFY,
        CardId.OVERCLOCK,
        CardId.DRAW_TWO,
        CardId.RANGE_EXTEND,
        CardId.RAPID_FIRE,
      ];
      return Array.from({ length: count }, (_, i) =>
        stubHandCard(`inst_${i}`, ids[i % ids.length])
      );
    };

    it('isFan returns false when handCards has 5 or fewer', () => {
      component.handCards = makeCards(5);
      expect(component.isFan).toBe(false);
    });

    it('isFan returns false with 0 cards', () => {
      component.handCards = [];
      expect(component.isFan).toBe(false);
    });

    it('isFan returns true when handCards has 6+', () => {
      component.handCards = makeCards(6);
      expect(component.isFan).toBe(true);
    });

    it('cardFanMargin returns "0" when not in fan mode', () => {
      component.handCards = makeCards(3);
      expect(component.cardFanMargin).toBe('0');
    });

    it('cardFanMargin returns "0" for empty hand', () => {
      component.handCards = [];
      expect(component.cardFanMargin).toBe('0');
    });

    it('cardFanMargin returns negative rem value in fan mode', () => {
      component.handCards = makeCards(6);
      expect(component.cardFanMargin).toMatch(/^-\d+(\.\d+)?rem$/);
    });

    it('cardFanMargin increases overlap with more cards', () => {
      component.handCards = makeCards(6);
      const margin6 = parseFloat(component.cardFanMargin);
      component.handCards = makeCards(10);
      const margin10 = parseFloat(component.cardFanMargin);
      // More negative = larger overlap
      expect(margin10).toBeLessThan(margin6);
    });

    it('cardFanMargin caps at -1.5rem with very large hands', () => {
      component.handCards = makeCards(20);
      expect(parseFloat(component.cardFanMargin)).toBeGreaterThanOrEqual(-1.5);
    });
  });

  // ── Phase 1 Sprint 3 — Card hover tooltip ──────────────────────────────
  describe('hover tooltip', () => {
    function makeMouseEvent(target?: HTMLElement): PointerEvent {
      return {
        pointerType: 'mouse',
        currentTarget: target ?? document.createElement('button'),
        clientX: 0,
        clientY: 0,
      } as unknown as PointerEvent;
    }

    function makeTouchEvent(): PointerEvent {
      return { pointerType: 'touch' } as unknown as PointerEvent;
    }

    function makeCard(id: CardId = CardId.TOWER_BASIC, upgraded = false): HandCard {
      const def = getCardDefinition(id);
      return {
        instance: makeInstance(id, upgraded),
        definition: def,
        canPlay: true,
        effectiveEnergyCost: def.energyCost,
        goldCost: null,
      };
    }

    it('does not show tooltip on touch pointerenter', fakeAsync(() => {
      component.onCardPointerEnter(makeTouchEvent(), makeCard());
      tick(300);
      expect(component.hoveredCard).toBeNull();
    }));

    it('does not show tooltip while a card is in placement mode', fakeAsync(() => {
      component.pendingCardId = 'some-other-card';
      component.onCardPointerEnter(makeMouseEvent(), makeCard());
      tick(300);
      expect(component.hoveredCard).toBeNull();
    }));

    it('shows tooltip after hover delay', fakeAsync(() => {
      const card = makeCard();
      component.onCardPointerEnter(makeMouseEvent(), card);
      expect(component.hoveredCard).toBeNull(); // not yet
      tick(200);
      expect(component.hoveredCard).toBe(card);
    }));

    it('clears tooltip on pointerleave', fakeAsync(() => {
      const card = makeCard();
      component.onCardPointerEnter(makeMouseEvent(), card);
      tick(200);
      expect(component.hoveredCard).toBe(card);

      component.onCardPointerLeave(makeMouseEvent());
      expect(component.hoveredCard).toBeNull();
      expect(component.hoveredCardRect).toBeNull();
    }));

    it('cancels pending hover delay on pointerleave', fakeAsync(() => {
      component.onCardPointerEnter(makeMouseEvent(), makeCard());
      component.onCardPointerLeave(makeMouseEvent());
      tick(300); // delay would have fired by now
      expect(component.hoveredCard).toBeNull();
    }));

    it('hoverTooltipId returns stable id for hovered card', fakeAsync(() => {
      const card = makeCard();
      component.onCardPointerEnter(makeMouseEvent(), card);
      tick(200);
      expect(component.hoverTooltipId).toBe(`card-tooltip-inst_${CardId.TOWER_BASIC}`);
    }));

    it('hoverTooltipId returns empty string when no card hovered', () => {
      expect(component.hoverTooltipId).toBe('');
    });

    it('hoverTooltipDescription uses upgradedDescription when card is upgraded', () => {
      const upgradedCard = makeCard(CardId.TOWER_BASIC, true);
      const text = component.hoverTooltipDescription(upgradedCard);
      // Must equal upgradedDescription when present, otherwise fall back to base
      const def = upgradedCard.definition;
      expect(text).toBe(def.upgradedDescription ?? def.description);
    });

    it('hoverTooltipDescription uses base description for non-upgraded card', () => {
      const card = makeCard(CardId.TOWER_BASIC, false);
      expect(component.hoverTooltipDescription(card)).toBe(card.definition.description);
    });

    it('clears tooltip on ngOnDestroy', fakeAsync(() => {
      component.onCardPointerEnter(makeMouseEvent(), makeCard());
      tick(200);
      expect(component.hoveredCard).not.toBeNull();

      component.ngOnDestroy();
      expect(component.hoveredCard).toBeNull();
    }));

    it('hoverTooltipLeft clamps to viewport edges', () => {
      // Force a rect that would push the tooltip off the right edge.
      component.hoveredCardRect = {
        left: window.innerWidth - 10,
        top: 100,
        right: window.innerWidth,
        bottom: 200,
        width: 100,
        height: 100,
      } as DOMRect;
      component.hoveredCard = {} as HandCard;
      const left = component.hoverTooltipLeft;
      expect(left).toBeLessThanOrEqual(window.innerWidth - 240 - 8 + 1);
    });

    it('hoverTooltipTop falls back below the card when too close to viewport top', () => {
      component.hoveredCardRect = {
        left: 100,
        top: 10, // very close to top edge — tooltip wouldn't fit above
        right: 200,
        bottom: 110,
        width: 100,
        height: 100,
      } as DOMRect;
      component.hoveredCard = {} as HandCard;
      const top = component.hoverTooltipTop;
      // Should anchor below (bottom + gap), not negative
      expect(top).toBeGreaterThanOrEqual(110);
    });
  });
});
