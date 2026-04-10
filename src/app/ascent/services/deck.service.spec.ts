import { TestBed } from '@angular/core/testing';
import { DeckService } from './deck.service';
import { CardId, DECK_CONFIG } from '../models/card.model';
import { getStarterDeck } from '../constants/card-definitions';

describe('DeckService', () => {
  let service: DeckService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DeckService);
    service.clear();
  });

  afterEach(() => {
    service.clear();
  });

  // ── Initialization ───────────────────────────────────────

  it('initializeDeck creates correct draw pile size', () => {
    const deck = getStarterDeck();
    service.initializeDeck(deck, 42);
    expect(service.getDeckState().drawPile.length).toBe(deck.length);
  });

  it('initializeDeck starts with empty hand and discard', () => {
    service.initializeDeck(getStarterDeck(), 42);
    const state = service.getDeckState();
    expect(state.hand.length).toBe(0);
    expect(state.discardPile.length).toBe(0);
    expect(state.exhaustPile.length).toBe(0);
  });

  it('initializeDeck sets energy to 0 (not drawn yet)', () => {
    service.initializeDeck(getStarterDeck(), 42);
    expect(service.getEnergy().current).toBe(0);
    expect(service.getEnergy().max).toBe(DECK_CONFIG.baseEnergy);
  });

  it('initializeDeck assigns unique instanceIds to each card', () => {
    service.initializeDeck([CardId.TOWER_BASIC, CardId.TOWER_BASIC, CardId.TOWER_BASIC], 1);
    const ids = service.getDeckState().drawPile.map(c => c.instanceId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });

  // ── drawForWave ──────────────────────────────────────────

  it('drawForWave puts cards in hand up to handSize', () => {
    service.initializeDeck(getStarterDeck(), 42);
    service.drawForWave();
    expect(service.getDeckState().hand.length).toBe(DECK_CONFIG.handSize);
  });

  it('drawForWave sets energy to max', () => {
    service.initializeDeck(getStarterDeck(), 42);
    service.drawForWave();
    const energy = service.getEnergy();
    expect(energy.current).toBe(energy.max);
  });

  it('drawForWave reduces draw pile by handSize', () => {
    service.initializeDeck(getStarterDeck(), 42);
    service.drawForWave();
    expect(service.getDeckState().drawPile.length).toBe(getStarterDeck().length - DECK_CONFIG.handSize);
  });

  // ── playCard ─────────────────────────────────────────────

  it('playCard deducts energy and moves card to discard', () => {
    service.initializeDeck([CardId.TOWER_BASIC], 1);
    service.drawForWave();
    const hand = service.getDeckState().hand;
    expect(hand.length).toBe(1);

    const instanceId = hand[0].instanceId;
    const costBefore = service.getEnergy().current;
    const result = service.playCard(instanceId);

    expect(result).toBe(true);
    expect(service.getDeckState().hand.length).toBe(0);
    expect(service.getDeckState().discardPile.length).toBe(1);
    expect(service.getEnergy().current).toBe(costBefore - 1); // TOWER_BASIC costs 1
  });

  it('playCard returns false when card is not in hand', () => {
    service.initializeDeck(getStarterDeck(), 1);
    const result = service.playCard('nonexistent_id');
    expect(result).toBe(false);
  });

  it('playCard returns false when insufficient energy', () => {
    // TOWER_MORTAR costs 3; cap max energy at 2 before drawing so current=2 at wave start
    service.initializeDeck([CardId.TOWER_MORTAR], 1);
    service.setMaxEnergy(2);
    service.drawForWave(); // fills energy to max=2, mortar needs 3
    const hand = service.getDeckState().hand;
    const instanceId = hand[0].instanceId;
    const result = service.playCard(instanceId);
    expect(result).toBe(false);
    // Card should remain in hand
    expect(service.getDeckState().hand.length).toBe(1);
  });

  // ── drawOne ──────────────────────────────────────────────

  it('drawOne moves top of draw pile to hand', () => {
    service.initializeDeck([CardId.TOWER_BASIC, CardId.GOLD_RUSH], 1);
    const topCard = service.getDeckState().drawPile[0];
    service.drawOne();
    const handCard = service.getDeckState().hand[0];
    expect(handCard.instanceId).toBe(topCard.instanceId);
    expect(service.getDeckState().drawPile.length).toBe(1);
  });

  it('drawOne reshuffles discard into draw pile when draw pile is empty', () => {
    service.initializeDeck([CardId.TOWER_BASIC], 1);
    service.drawForWave();
    // discard the drawn card
    service.discardHand();
    // draw pile is now empty, discard has 1 card
    expect(service.getDeckState().drawPile.length).toBe(0);
    expect(service.getDeckState().discardPile.length).toBe(1);

    service.drawOne();

    expect(service.getDeckState().hand.length).toBe(1);
    expect(service.getDeckState().discardPile.length).toBe(0);
  });

  it('drawOne returns false when all piles are empty', () => {
    service.initializeDeck([], 1);
    expect(service.drawOne()).toBe(false);
  });

  // ── discardHand ──────────────────────────────────────────

  it('discardHand moves all hand cards to discard', () => {
    service.initializeDeck(getStarterDeck(), 1);
    service.drawForWave();
    const handSize = service.getDeckState().hand.length;
    service.discardHand();
    expect(service.getDeckState().hand.length).toBe(0);
    expect(service.getDeckState().discardPile.length).toBe(handSize);
  });

  // ── addCard ──────────────────────────────────────────────

  it('addCard adds to discard pile', () => {
    service.initializeDeck(getStarterDeck(), 1);
    const discardBefore = service.getDeckState().discardPile.length;
    service.addCard(CardId.ENERGY_SURGE);
    expect(service.getDeckState().discardPile.length).toBe(discardBefore + 1);
    const added = service.getDeckState().discardPile[service.getDeckState().discardPile.length - 1];
    expect(added.cardId).toBe(CardId.ENERGY_SURGE);
    expect(added.upgraded).toBe(false);
  });

  // ── removeCard ───────────────────────────────────────────

  it('removeCard removes from draw pile', () => {
    service.initializeDeck([CardId.TOWER_BASIC], 1);
    const instanceId = service.getDeckState().drawPile[0].instanceId;
    const result = service.removeCard(instanceId);
    expect(result).toBe(true);
    expect(service.getDeckState().drawPile.length).toBe(0);
  });

  it('removeCard removes from hand', () => {
    service.initializeDeck([CardId.TOWER_BASIC], 1);
    service.drawForWave();
    const instanceId = service.getDeckState().hand[0].instanceId;
    const result = service.removeCard(instanceId);
    expect(result).toBe(true);
    expect(service.getDeckState().hand.length).toBe(0);
  });

  it('removeCard removes from discard pile', () => {
    service.initializeDeck([CardId.TOWER_BASIC], 1);
    service.drawForWave();
    service.discardHand();
    const instanceId = service.getDeckState().discardPile[0].instanceId;
    const result = service.removeCard(instanceId);
    expect(result).toBe(true);
    expect(service.getDeckState().discardPile.length).toBe(0);
  });

  it('removeCard returns false for unknown instanceId', () => {
    service.initializeDeck(getStarterDeck(), 1);
    expect(service.removeCard('unknown_instance')).toBe(false);
  });

  // ── upgradeCard ──────────────────────────────────────────

  it('upgradeCard sets upgraded flag to true', () => {
    service.initializeDeck([CardId.DAMAGE_BOOST], 1);
    const instanceId = service.getDeckState().drawPile[0].instanceId;
    const result = service.upgradeCard(instanceId);
    expect(result).toBe(true);
    expect(service.getDeckState().drawPile[0].upgraded).toBe(true);
  });

  it('upgradeCard returns false when card is already upgraded', () => {
    service.initializeDeck([CardId.DAMAGE_BOOST], 1);
    const instanceId = service.getDeckState().drawPile[0].instanceId;
    service.upgradeCard(instanceId);
    const result = service.upgradeCard(instanceId);
    expect(result).toBe(false);
  });

  it('upgradeCard returns false for unknown instanceId', () => {
    service.initializeDeck(getStarterDeck(), 1);
    expect(service.upgradeCard('unknown_instance')).toBe(false);
  });

  // ── clear ────────────────────────────────────────────────

  it('clear resets all state to empty', () => {
    service.initializeDeck(getStarterDeck(), 42);
    service.drawForWave();
    service.clear();
    const state = service.getDeckState();
    expect(state.drawPile.length).toBe(0);
    expect(state.hand.length).toBe(0);
    expect(state.discardPile.length).toBe(0);
    expect(state.exhaustPile.length).toBe(0);
    expect(service.getEnergy().current).toBe(0);
    expect(service.getEnergy().max).toBe(DECK_CONFIG.baseEnergy);
  });

  // ── getAllCards ──────────────────────────────────────────

  it('getAllCards returns cards from all piles', () => {
    service.initializeDeck(getStarterDeck(), 1);
    service.drawForWave();
    // hand has 5, draw pile has remaining
    const all = service.getAllCards();
    expect(all.length).toBe(getStarterDeck().length);
  });

  // ── shuffle determinism ──────────────────────────────────

  it('shuffle is deterministic with the same seed', () => {
    const deck = getStarterDeck();
    service.initializeDeck(deck, 12345);
    const order1 = service.getDeckState().drawPile.map(c => c.cardId);

    service.initializeDeck(deck, 12345);
    const order2 = service.getDeckState().drawPile.map(c => c.cardId);

    expect(order1).toEqual(order2);
  });

  it('different seeds produce different shuffle orders (statistically)', () => {
    const deck = getStarterDeck();
    service.initializeDeck(deck, 1);
    const order1 = service.getDeckState().drawPile.map(c => c.cardId).join(',');

    service.initializeDeck(deck, 999999);
    const order2 = service.getDeckState().drawPile.map(c => c.cardId).join(',');

    // With 10 cards these seeds should produce different orderings
    expect(order1).not.toEqual(order2);
  });

  // ── Reactive observables ─────────────────────────────────

  it('deckState$ emits on card draw', done => {
    service.initializeDeck(getStarterDeck(), 1);
    service.deckState$.subscribe(state => {
      if (state.hand.length === DECK_CONFIG.handSize) {
        done();
      }
    });
    service.drawForWave();
  });

  it('energy$ emits on drawForWave', done => {
    service.initializeDeck(getStarterDeck(), 1);
    service.energy$.subscribe(energy => {
      if (energy.current === DECK_CONFIG.baseEnergy) {
        done();
      }
    });
    service.drawForWave();
  });

  // ── Energy helpers ───────────────────────────────────────

  it('addEnergy increases current energy', () => {
    service.initializeDeck(getStarterDeck(), 1);
    service.drawForWave();
    const before = service.getEnergy().current;
    service.addEnergy(2);
    expect(service.getEnergy().current).toBe(before + 2);
  });

  it('setMaxEnergy updates max without changing current', () => {
    service.initializeDeck(getStarterDeck(), 1);
    service.drawForWave();
    const currentBefore = service.getEnergy().current;
    service.setMaxEnergy(5);
    expect(service.getEnergy().max).toBe(5);
    expect(service.getEnergy().current).toBe(currentBefore);
  });
});
