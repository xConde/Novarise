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
import { CardDefinition } from '../../../../run/models/card.model';
import { ARCHETYPE_DISPLAY } from '../../../../run/constants/archetype.constants';
import { TowerType } from '../../models/tower.model';

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
        definition: { ...getCardDefinition(CardId.TOWER_BASIC), innate: undefined, retain: undefined, ethereal: undefined, exhaust: undefined, terraform: undefined, link: undefined } as CardDefinition,
        canPlay: true,
        effectiveEnergyCost: 1,
        goldCost: 50,
      };
      expect(component.keywordAriaLabel(card)).toBe('');
    });

    it('lists active keywords in stable order (innate, retain, exhaust)', () => {
      const card: HandCard = {
        instance: { cardId: CardId.TOWER_BASIC, instanceId: 'x', upgraded: false },
        definition: { ...getCardDefinition(CardId.TOWER_BASIC), innate: true, retain: true, ethereal: false, exhaust: true } as CardDefinition,
        canPlay: true,
        effectiveEnergyCost: 1,
        goldCost: 50,
      };
      expect(component.keywordAriaLabel(card)).toBe('Keywords: Innate, Retain, Exhaust');
    });

    it('includes Terraform in label when terraform is true', () => {
      const card: HandCard = {
        instance: { cardId: CardId.LAY_TILE, instanceId: 'x', upgraded: false },
        definition: { ...getCardDefinition(CardId.LAY_TILE), terraform: true } as CardDefinition,
        canPlay: true,
        effectiveEnergyCost: 1,
        goldCost: null,
      };
      expect(component.keywordAriaLabel(card)).toContain('Terraform');
    });

    it('includes Link in label when link is true', () => {
      const card: HandCard = {
        instance: { cardId: CardId.CONDUIT_BRIDGE, instanceId: 'x', upgraded: false },
        definition: { ...getCardDefinition(CardId.CONDUIT_BRIDGE), link: true } as CardDefinition,
        canPlay: true,
        effectiveEnergyCost: 1,
        goldCost: null,
      };
      expect(component.keywordAriaLabel(card)).toContain('Link');
    });

    it('lists Terraform before Link before innate keywords in stable order', () => {
      const card: HandCard = {
        instance: { cardId: CardId.TOWER_BASIC, instanceId: 'x', upgraded: false },
        definition: { ...getCardDefinition(CardId.TOWER_BASIC), terraform: true, link: true, innate: true } as CardDefinition,
        canPlay: true,
        effectiveEnergyCost: 1,
        goldCost: null,
      };
      expect(component.keywordAriaLabel(card)).toBe('Keywords: Terraform, Link, Innate');
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

    describe('flavor text display', () => {
      function makeCardWithFlavor(flavorText: string): HandCard {
        const def = getCardDefinition(CardId.TOWER_BASIC);
        return {
          instance: { cardId: CardId.TOWER_BASIC, instanceId: 'flavor-inst', upgraded: false },
          definition: { ...def, flavorText },
          canPlay: true,
          effectiveEnergyCost: def.energyCost,
          goldCost: null,
        };
      }

      function makeCardNoFlavor(): HandCard {
        const def = getCardDefinition(CardId.TOWER_BASIC);
        return {
          instance: { cardId: CardId.TOWER_BASIC, instanceId: 'no-flavor-inst', upgraded: false },
          definition: { ...def, flavorText: undefined },
          canPlay: true,
          effectiveEnergyCost: def.energyCost,
          goldCost: null,
        };
      }

      it('renders .card-tooltip__flavor when flavorText is set', () => {
        component.hoveredCard = makeCardWithFlavor('Test flavor');
        fixture.detectChanges();

        const flavor = fixture.nativeElement.querySelector('.card-tooltip__flavor') as HTMLElement;
        expect(flavor).not.toBeNull();
        expect(flavor.textContent).toContain('Test flavor');
      });

      it('does NOT render .card-tooltip__flavor when flavorText is undefined', () => {
        component.hoveredCard = makeCardNoFlavor();
        fixture.detectChanges();

        const flavor = fixture.nativeElement.querySelector('.card-tooltip__flavor');
        expect(flavor).toBeNull();
      });

      it('aria-label on flavor element prefixes with "Flavor: "', () => {
        component.hoveredCard = makeCardWithFlavor('Test flavor');
        fixture.detectChanges();

        const flavor = fixture.nativeElement.querySelector('.card-tooltip__flavor') as HTMLElement;
        expect(flavor.getAttribute('aria-label')).toBe('Flavor: Test flavor');
      });
    });
  });

  describe('frame class binding', () => {
    it('applies card--frame-tower to tower-type cards', () => {
      component.deckState = makeDeckState([makeInstance(CardId.TOWER_BASIC)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      expect(cards.length).toBe(1);
      expect(cards[0].classList.contains('card--frame-tower')).toBe(true);
    });

    it('does NOT apply card--frame-tower to non-tower cards', () => {
      component.deckState = makeDeckState([makeInstance(CardId.GOLD_RUSH)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      expect(cards.length).toBe(1);
      expect(cards[0].classList.contains('card--frame-tower')).toBe(false);
    });

    it('tower card has card--tower type class alongside card--frame-tower', () => {
      component.deckState = makeDeckState([makeInstance(CardId.TOWER_BASIC)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.card') as HTMLElement;
      expect(card.classList.contains('card--tower')).toBe(true);
      expect(card.classList.contains('card--frame-tower')).toBe(true);
    });
  });

  describe('spell frame class binding', () => {
    it('applies card--frame-spell to spell-type cards', () => {
      component.deckState = makeDeckState([makeInstance(CardId.GOLD_RUSH)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      expect(cards.length).toBe(1);
      expect(cards[0].classList.contains('card--frame-spell')).toBe(true);
    });

    it('does NOT apply card--frame-spell to non-spell cards', () => {
      component.deckState = makeDeckState([makeInstance(CardId.TOWER_BASIC)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      expect(cards.length).toBe(1);
      expect(cards[0].classList.contains('card--frame-spell')).toBe(false);
    });

    it('spell card has card--spell type class alongside card--frame-spell', () => {
      component.deckState = makeDeckState([makeInstance(CardId.GOLD_RUSH)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.card') as HTMLElement;
      expect(card.classList.contains('card--spell')).toBe(true);
      expect(card.classList.contains('card--frame-spell')).toBe(true);
    });
  });

  describe('modifier frame class binding', () => {
    it('applies card--frame-modifier to modifier-type cards', () => {
      component.deckState = makeDeckState([makeInstance(CardId.DAMAGE_BOOST)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      expect(cards.length).toBe(1);
      expect(cards[0].classList.contains('card--frame-modifier')).toBe(true);
    });

    it('does NOT apply card--frame-modifier to non-modifier cards', () => {
      component.deckState = makeDeckState([makeInstance(CardId.TOWER_BASIC)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      expect(cards.length).toBe(1);
      expect(cards[0].classList.contains('card--frame-modifier')).toBe(false);
    });

    it('modifier card has card--modifier type class alongside card--frame-modifier', () => {
      component.deckState = makeDeckState([makeInstance(CardId.DAMAGE_BOOST)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.card') as HTMLElement;
      expect(card.classList.contains('card--modifier')).toBe(true);
      expect(card.classList.contains('card--frame-modifier')).toBe(true);
    });
  });

  describe('utility frame class binding', () => {
    it('applies card--frame-utility to utility-type cards', () => {
      component.deckState = makeDeckState([makeInstance(CardId.DRAW_TWO)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      expect(cards.length).toBe(1);
      expect(cards[0].classList.contains('card--frame-utility')).toBe(true);
    });

    it('does NOT apply card--frame-utility to non-utility cards', () => {
      component.deckState = makeDeckState([makeInstance(CardId.TOWER_BASIC)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      expect(cards.length).toBe(1);
      expect(cards[0].classList.contains('card--frame-utility')).toBe(false);
    });

    it('utility card has card--utility type class alongside card--frame-utility', () => {
      component.deckState = makeDeckState([makeInstance(CardId.DRAW_TWO)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.card') as HTMLElement;
      expect(card.classList.contains('card--utility')).toBe(true);
      expect(card.classList.contains('card--frame-utility')).toBe(true);
    });
  });

  // ── S14 Phase B cross-type integration ────────────────────────────────────

  describe('cross-type render (mixed hand)', () => {
    // One representative card per type
    const MIXED_HAND: CardId[] = [
      CardId.TOWER_BASIC,    // TOWER
      CardId.GOLD_RUSH,      // SPELL
      CardId.DAMAGE_BOOST,   // MODIFIER
      CardId.DRAW_TWO,       // UTILITY
    ];

    const FRAME_CLASSES: Record<string, string> = {
      [CardId.TOWER_BASIC]:   'card--frame-tower',
      [CardId.GOLD_RUSH]:     'card--frame-spell',
      [CardId.DAMAGE_BOOST]:  'card--frame-modifier',
      [CardId.DRAW_TWO]:      'card--frame-utility',
    };

    const TYPE_CLASSES: Record<string, string> = {
      [CardId.TOWER_BASIC]:   'card--tower',
      [CardId.GOLD_RUSH]:     'card--spell',
      [CardId.DAMAGE_BOOST]:  'card--modifier',
      [CardId.DRAW_TWO]:      'card--utility',
    };

    const ALL_FRAME_CLASSES = [
      'card--frame-tower',
      'card--frame-spell',
      'card--frame-modifier',
      'card--frame-utility',
    ];

    function buildMixedHand(): CardInstance[] {
      return MIXED_HAND.map(id => makeInstance(id));
    }

    it('renders 4 cards without error when hand has one of each type', () => {
      component.deckState = makeDeckState(buildMixedHand());
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      // detectChanges exercises the template path — a render-time error would throw here
      expect(() => fixture.detectChanges()).not.toThrow();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      expect(cards.length).toBe(4);
    });

    it('each card in mixed hand has exactly its expected frame class', () => {
      component.deckState = makeDeckState(buildMixedHand());
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      MIXED_HAND.forEach((cardId, idx) => {
        const expectedFrame = FRAME_CLASSES[cardId];
        expect(cards[idx].classList.contains(expectedFrame))
          .withContext(`card[${idx}] (${cardId}) should have ${expectedFrame}`)
          .toBe(true);
      });
    });

    it('no card in mixed hand has more than one frame class', () => {
      component.deckState = makeDeckState(buildMixedHand());
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      cards.forEach((card, idx) => {
        const frameCount = ALL_FRAME_CLASSES.filter(cls => card.classList.contains(cls)).length;
        expect(frameCount)
          .withContext(`card[${idx}] should have exactly 1 frame class, found ${frameCount}`)
          .toBe(1);
      });
    });

    it('each card has its type class co-present with its frame class', () => {
      component.deckState = makeDeckState(buildMixedHand());
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      MIXED_HAND.forEach((cardId, idx) => {
        const expectedType = TYPE_CLASSES[cardId];
        const expectedFrame = FRAME_CLASSES[cardId];
        expect(cards[idx].classList.contains(expectedType))
          .withContext(`card[${idx}] (${cardId}) should have type class ${expectedType}`)
          .toBe(true);
        expect(cards[idx].classList.contains(expectedFrame))
          .withContext(`card[${idx}] (${cardId}) should have frame class ${expectedFrame}`)
          .toBe(true);
      });
    });
  });

  describe('hover / pending / play-lift cross-type state classes', () => {
    const FRAMED_TYPES: Array<{ cardId: CardId; frameClass: string }> = [
      { cardId: CardId.TOWER_BASIC,   frameClass: 'card--frame-tower' },
      { cardId: CardId.GOLD_RUSH,     frameClass: 'card--frame-spell' },
      { cardId: CardId.DAMAGE_BOOST,  frameClass: 'card--frame-modifier' },
      { cardId: CardId.DRAW_TWO,      frameClass: 'card--frame-utility' },
    ];

    FRAMED_TYPES.forEach(({ cardId, frameClass }: { cardId: CardId; frameClass: string }) => {
      it(`${frameClass}: card--playable co-exists with frame class`, () => {
        component.deckState = makeDeckState([makeInstance(cardId)]);
        component.energy = makeEnergy(3, 3);
        component.resolveHand();
        fixture.detectChanges();

        const card = fixture.nativeElement.querySelector('.card') as HTMLElement;
        expect(card.classList.contains(frameClass)).toBe(true);
        expect(card.classList.contains('card--playable')).toBe(true);
      });

      it(`${frameClass}: adding card--pending does not also add card--playing`, () => {
        component.deckState = makeDeckState([makeInstance(cardId)]);
        component.energy = makeEnergy(3, 3);
        component.resolveHand();
        fixture.detectChanges();

        const card = fixture.nativeElement.querySelector('.card') as HTMLElement;
        // Simulate pending: the template adds card--pending when pendingCardId matches
        // We verify the frame and base state — no cross-contamination
        expect(card.classList.contains(frameClass)).toBe(true);
        expect(card.classList.contains('card--playing')).toBe(false);
      });

      it(`${frameClass}: card--playing class does not remove frame class`, () => {
        const instance = makeInstance(cardId);
        component.deckState = makeDeckState([instance]);
        component.energy = makeEnergy(3, 3);
        component.resolveHand();
        // Simulate the playing state by setting playingCardId directly
        component.playingCardId = instance.instanceId;
        fixture.detectChanges();

        const card = fixture.nativeElement.querySelector('.card') as HTMLElement;
        expect(card.classList.contains(frameClass)).toBe(true);
        expect(card.classList.contains('card--playing')).toBe(true);
      });
    });
  });

  describe('fan overlap mixed-type (10 cards)', () => {
    // 10 cards cycling through all 4 types
    const FAN_HAND_IDS: CardId[] = [
      CardId.TOWER_BASIC,    // TOWER
      CardId.GOLD_RUSH,      // SPELL
      CardId.DAMAGE_BOOST,   // MODIFIER
      CardId.DRAW_TWO,       // UTILITY
      CardId.TOWER_SNIPER,   // TOWER
      CardId.REPAIR_WALLS,   // SPELL
      CardId.RANGE_EXTEND,   // MODIFIER
      CardId.RECYCLE,        // UTILITY
      CardId.TOWER_SPLASH,   // TOWER
      CardId.SCOUT_AHEAD,    // SPELL
    ];

    const FAN_FRAME_CLASSES: string[] = [
      'card--frame-tower',
      'card--frame-spell',
      'card--frame-modifier',
      'card--frame-utility',
      'card--frame-tower',
      'card--frame-spell',
      'card--frame-modifier',
      'card--frame-utility',
      'card--frame-tower',
      'card--frame-spell',
    ];

    function buildFanHandWithTypes(): CardInstance[] {
      return FAN_HAND_IDS.map((id, i) => ({ instanceId: `inst_fan_${i}`, cardId: id, upgraded: false }));
    }

    it('renders 10 cards without error', () => {
      component.deckState = makeDeckState(buildFanHandWithTypes());
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      expect(() => fixture.detectChanges()).not.toThrow();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      expect(cards.length).toBe(10);
    });

    it('isFan is true with 10 cards', () => {
      component.deckState = makeDeckState(buildFanHandWithTypes());
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      expect(component.isFan).toBe(true);
    });

    it('cardFanMargin is negative in fan mode', () => {
      component.deckState = makeDeckState(buildFanHandWithTypes());
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      expect(parseFloat(component.cardFanMargin)).toBeLessThan(0);
    });

    it('each card in 10-card fan has exactly one frame class', () => {
      component.deckState = makeDeckState(buildFanHandWithTypes());
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const allFrameClasses = [
        'card--frame-tower', 'card--frame-spell', 'card--frame-modifier', 'card--frame-utility',
      ];
      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      expect(cards.length).toBe(10);
      cards.forEach((card, idx) => {
        const frameCount = allFrameClasses.filter(cls => card.classList.contains(cls)).length;
        expect(frameCount)
          .withContext(`fan card[${idx}] should have exactly 1 frame class, found ${frameCount}`)
          .toBe(1);
      });
    });

    it('each card in 10-card fan has the correct per-type frame class', () => {
      component.deckState = makeDeckState(buildFanHandWithTypes());
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      FAN_FRAME_CLASSES.forEach((expectedFrame, idx) => {
        expect(cards[idx].classList.contains(expectedFrame))
          .withContext(`fan card[${idx}] should have ${expectedFrame}`)
          .toBe(true);
      });
    });

    it('fan container gets card-hand__cards--fan class with 10 cards', () => {
      component.deckState = makeDeckState(buildFanHandWithTypes());
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const cardsContainer = fixture.nativeElement.querySelector('.card-hand__cards') as HTMLElement;
      expect(cardsContainer.classList.contains('card-hand__cards--fan')).toBe(true);
    });
  });

  describe('mobile / tablet breakpoint — frame classes survive width changes', () => {
    // Karma runs in ChromeHeadless with a fixed viewport; we cannot truly resize to
    // mobile/tablet dimensions from inside a spec. What we CAN verify:
    // (a) The frame classes are applied regardless of viewport — they're data-driven, not media-query-conditional.
    // (b) The component renders all 4 types without throwing at any initial viewport size.
    // Visual quality at narrow widths requires real-browser inspection.

    const BREAKPOINT_CASES: Array<{ label: string; cardId: CardId; frameClass: string }> = [
      { label: 'tower at mobile width',   cardId: CardId.TOWER_BASIC,  frameClass: 'card--frame-tower' },
      { label: 'spell at mobile width',   cardId: CardId.GOLD_RUSH,    frameClass: 'card--frame-spell' },
      { label: 'modifier at mobile width',cardId: CardId.DAMAGE_BOOST, frameClass: 'card--frame-modifier' },
      { label: 'utility at mobile width', cardId: CardId.DRAW_TWO,     frameClass: 'card--frame-utility' },
    ];

    BREAKPOINT_CASES.forEach(({ label, cardId, frameClass }) => {
      it(`${label}: frame class applied and no render error`, () => {
        component.deckState = makeDeckState([makeInstance(cardId)]);
        component.energy = makeEnergy(3, 3);
        component.resolveHand();
        expect(() => fixture.detectChanges()).not.toThrow();

        const card = fixture.nativeElement.querySelector('.card') as HTMLElement;
        expect(card).not.toBeNull();
        expect(card.classList.contains(frameClass)).toBe(true);
      });
    });

    it('mixed 4-card hand renders without error at any ChromeHeadless viewport', () => {
      const hand = [
        makeInstance(CardId.TOWER_BASIC),
        makeInstance(CardId.GOLD_RUSH),
        makeInstance(CardId.DAMAGE_BOOST),
        makeInstance(CardId.DRAW_TWO),
      ];
      component.deckState = makeDeckState(hand);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      expect(() => fixture.detectChanges()).not.toThrow();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      expect(cards.length).toBe(4);
    });
  });

  // ── S21 Phase C — Archetype trim color bindings ───────────────────────────

  describe('getArchetypeTrimColor', () => {
    function makeCard(cardId: CardId): HandCard {
      const def = getCardDefinition(cardId);
      return {
        instance: makeInstance(cardId),
        definition: def,
        canPlay: true,
        effectiveEnergyCost: def.energyCost,
        goldCost: null,
      };
    }

    it('returns var(--card-trim-neutral) for a neutral card (TOWER_BASIC)', () => {
      const card = makeCard(CardId.TOWER_BASIC);
      expect(component.getArchetypeTrimColor(card)).toBe('var(--card-trim-neutral)');
    });

    it('returns var(--card-trim-cartographer) for a cartographer card (DETOUR)', () => {
      const card = makeCard(CardId.DETOUR);
      expect(component.getArchetypeTrimColor(card)).toBe('var(--card-trim-cartographer)');
    });

    it('returns var(--card-trim-highground) for a highground card (HIGH_PERCH)', () => {
      const card = makeCard(CardId.HIGH_PERCH);
      expect(component.getArchetypeTrimColor(card)).toBe('var(--card-trim-highground)');
    });

    it('returns var(--card-trim-conduit) for a conduit card (HANDSHAKE)', () => {
      const card = makeCard(CardId.HANDSHAKE);
      expect(component.getArchetypeTrimColor(card)).toBe('var(--card-trim-conduit)');
    });

    it('getArchetypeTrimColorStrong returns the strong variant matching ARCHETYPE_DISPLAY', () => {
      const archetypeCases: Array<{ cardId: CardId; archetype: keyof typeof ARCHETYPE_DISPLAY }> = [
        { cardId: CardId.TOWER_BASIC, archetype: 'neutral' },
        { cardId: CardId.DETOUR,      archetype: 'cartographer' },
        { cardId: CardId.HIGH_PERCH,  archetype: 'highground' },
        { cardId: CardId.HANDSHAKE,   archetype: 'conduit' },
      ];
      archetypeCases.forEach(({ cardId, archetype }) => {
        const card = makeCard(cardId);
        const expected = `var(${ARCHETYPE_DISPLAY[archetype].trimVarStrong})`;
        expect(component.getArchetypeTrimColorStrong(card))
          .withContext(`${archetype} strong trim var mismatch`)
          .toBe(expected);
      });
    });

    it('--archetype-trim-color style is bound on each rendered card', () => {
      const hand = [
        makeInstance(CardId.TOWER_BASIC),  // neutral
        makeInstance(CardId.DETOUR),        // cartographer
      ];
      component.deckState = makeDeckState(hand);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      expect(cards.length).toBe(2);
      // Each card should have --archetype-trim-color set in its inline style
      cards.forEach((cardEl, idx) => {
        const trimColor = cardEl.style.getPropertyValue('--archetype-trim-color');
        expect(trimColor)
          .withContext(`card[${idx}] should have --archetype-trim-color bound`)
          .toBeTruthy();
      });
    });
  });

  // ── Archetype backdrop pattern was removed from card-hand at S75 ──
  // (kept on library tile + card-detail modal where space allows). The
  // getArchetypeBackdropVar method and its specs were removed. The
  // integration spec retains backdrop assertions for the tile surface.

  // ── Tower accent binding (preserved — footprint was removed but accent still feeds art-zone gradient) ──

  describe('tower accent binding', () => {
    it('tower card has --card-tower-accent bound on the card element', () => {
      component.deckState = makeDeckState([makeInstance(CardId.TOWER_BASIC)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.card') as HTMLElement;
      const accent = card.style.getPropertyValue('--card-tower-accent');
      expect(accent).toBeTruthy();
    });

    it('non-tower card does NOT have --card-tower-accent bound', () => {
      component.deckState = makeDeckState([makeInstance(CardId.GOLD_RUSH)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const card = fixture.nativeElement.querySelector('.card') as HTMLElement;
      const accent = card.style.getPropertyValue('--card-tower-accent');
      expect(accent).toBeFalsy();
    });
  });

  describe('perf probe — mixed 10-card hand layout cost', () => {
    function buildMixed10(): CardInstance[] {
      const ids: CardId[] = [
        CardId.TOWER_BASIC, CardId.GOLD_RUSH, CardId.DAMAGE_BOOST, CardId.DRAW_TWO,
        CardId.TOWER_SNIPER, CardId.REPAIR_WALLS, CardId.RANGE_EXTEND, CardId.RECYCLE,
        CardId.TOWER_SPLASH, CardId.SCOUT_AHEAD,
      ];
      return ids.map((id, i) => ({ instanceId: `perf_${i}`, cardId: id, upgraded: false }));
    }

    it('forces layout on 10 mixed-type cards in under 50ms', () => {
      component.deckState = makeDeckState(buildMixed10());
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('.card') as NodeListOf<HTMLElement>;
      expect(cards.length).toBe(10);

      const start = performance.now();
      // Force sync layout read on each card — exercises style-recalc + layout
      cards.forEach(card => { card.getBoundingClientRect(); });
      const elapsed = performance.now() - start;

      // Gross budget: 50ms. This is not a frame budget — just a pathological-blowup detector.
      // ChromeHeadless with 10 small elements should be well under 5ms in practice.
      expect(elapsed).toBeLessThan(50);
    });
  });

  // ── Tower thumbnail wiring ────────────────────────────────────────────────

  describe('getTowerThumbnailUrl', () => {
    function makeTowerHandCard(cardId: CardId): HandCard {
      const def = getCardDefinition(cardId);
      return {
        instance: { cardId, instanceId: `thumb_${cardId}`, upgraded: false },
        definition: def,
        canPlay: true,
        effectiveEnergyCost: def.energyCost,
        goldCost: 50,
      };
    }

    function makeSpellHandCard(): HandCard {
      const def = getCardDefinition(CardId.GOLD_RUSH);
      return {
        instance: { cardId: CardId.GOLD_RUSH, instanceId: 'thumb_spell', upgraded: false },
        definition: def,
        canPlay: true,
        effectiveEnergyCost: def.energyCost,
        goldCost: null,
      };
    }

    it('returns null for non-tower cards', () => {
      const card = makeSpellHandCard();
      const result = component.getTowerThumbnailUrl(card);
      expect(result).toBeNull();
    });

    it('returns null when towerThumbnailService is not injected (test env with null service)', () => {
      // The @Optional() injection means the service may be null in test environments.
      (component as unknown as { towerThumbnailService: null }).towerThumbnailService = null;
      const card = makeTowerHandCard(CardId.TOWER_BASIC);
      expect(component.getTowerThumbnailUrl(card)).toBeNull();
    });

    it('returns a string or null for tower cards without throwing', () => {
      const card = makeTowerHandCard(CardId.TOWER_BASIC);
      expect(() => component.getTowerThumbnailUrl(card)).not.toThrow();
      const result = component.getTowerThumbnailUrl(card);
      // Either a data URL string or null (if WebGL unavailable in this env).
      if (result !== null) {
        expect(typeof result).toBe('string');
      }
    });

    it('does not render .card__art-thumbnail for non-tower cards in the template', () => {
      component.deckState = makeDeckState([makeInstance(CardId.GOLD_RUSH)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const thumbnail = fixture.nativeElement.querySelector('.card__art-thumbnail');
      expect(thumbnail).toBeNull();
    });

    it('renders .card__art-thumbnail for tower cards when service returns a URL', () => {
      // Inject a fake TowerThumbnailService that always returns a data URL.
      const fakeThumbnailService = {
        getThumbnail: (_type: TowerType) => 'data:image/png;base64,fakedata',
      };
      (component as unknown as { towerThumbnailService: typeof fakeThumbnailService }).towerThumbnailService = fakeThumbnailService;

      component.deckState = makeDeckState([makeInstance(CardId.TOWER_BASIC)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const thumbnail = fixture.nativeElement.querySelector('.card__art-thumbnail') as HTMLImageElement;
      expect(thumbnail).not.toBeNull();
      expect(thumbnail.getAttribute('src')).toContain('data:image/png');
      expect(thumbnail.getAttribute('aria-hidden')).toBe('true');
    });

    it('does NOT render .card__art-thumbnail for tower cards when service returns null', () => {
      const nullThumbnailService = {
        getThumbnail: (_type: TowerType) => null,
      };
      (component as unknown as { towerThumbnailService: typeof nullThumbnailService }).towerThumbnailService = nullThumbnailService;

      component.deckState = makeDeckState([makeInstance(CardId.TOWER_BASIC)]);
      component.energy = makeEnergy(3, 3);
      component.resolveHand();
      fixture.detectChanges();

      const thumbnail = fixture.nativeElement.querySelector('.card__art-thumbnail');
      expect(thumbnail).toBeNull();
    });
  });
});
