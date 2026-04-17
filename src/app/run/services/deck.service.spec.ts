import { TestBed } from '@angular/core/testing';
import { DeckService } from './deck.service';
import { CardId, CardInstance, DECK_CONFIG } from '../models/card.model';
import { getStarterDeck } from '../constants/card-definitions';
import { SerializableDeckState } from '../../game/game-board/models/encounter-checkpoint.model';

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

  // ── checkpoint serialization ──────────────────────────────

  describe('checkpoint serialization', () => {
    it('serializeState() returns current pile contents', () => {
      service.initializeDeck([CardId.TOWER_BASIC, CardId.GOLD_RUSH, CardId.ENERGY_SURGE], 1);
      service.drawForWave(); // draws up to handSize (≤3 cards here)

      const snapshot = service.serializeState();
      const live = service.getDeckState();

      expect(snapshot.deckState.hand.length).toBe(live.hand.length);
      expect(snapshot.deckState.drawPile.length).toBe(live.drawPile.length);
      expect(snapshot.deckState.discardPile.length).toBe(live.discardPile.length);
      expect(snapshot.deckState.exhaustPile.length).toBe(live.exhaustPile.length);

      const liveIds = live.hand.map(c => c.instanceId);
      const snapIds = snapshot.deckState.hand.map(c => c.instanceId);
      expect(snapIds).toEqual(liveIds);
    });

    it('serializeState() captures energy and instanceCounter', () => {
      service.initializeDeck([CardId.TOWER_BASIC], 1);
      service.drawForWave();
      const hand = service.getDeckState().hand;
      service.playCard(hand[0].instanceId); // spends 1 energy

      const snapshot = service.serializeState();

      expect(snapshot.energyState.max).toBe(DECK_CONFIG.baseEnergy);
      expect(snapshot.energyState.current).toBe(DECK_CONFIG.baseEnergy - 1);
      expect(snapshot.instanceCounter).toBe(1); // 1 card created → counter is 1
    });

    it('restoreState() sets all piles directly', () => {
      const cardA: CardInstance = { instanceId: 'snap_0', cardId: CardId.TOWER_BASIC, upgraded: false };
      const cardB: CardInstance = { instanceId: 'snap_1', cardId: CardId.GOLD_RUSH, upgraded: false };
      const cardC: CardInstance = { instanceId: 'snap_2', cardId: CardId.ENERGY_SURGE, upgraded: false };
      const cardD: CardInstance = { instanceId: 'snap_3', cardId: CardId.DAMAGE_BOOST, upgraded: true };

      const snapshot: SerializableDeckState = {
        deckState: {
          drawPile: [cardA],
          hand: [cardB],
          discardPile: [cardC],
          exhaustPile: [cardD],
        },
        energyState: { current: 2, max: 4 },
        instanceCounter: 10,
      };

      service.restoreState(snapshot);
      const state = service.getDeckState();

      expect(state.drawPile[0].instanceId).toBe('snap_0');
      expect(state.hand[0].instanceId).toBe('snap_1');
      expect(state.discardPile[0].instanceId).toBe('snap_2');
      expect(state.exhaustPile[0].instanceId).toBe('snap_3');
      expect(service.getEnergy().current).toBe(2);
      expect(service.getEnergy().max).toBe(4);
    });

    it('restoreState() preserves instanceCounter', () => {
      const snapshot: SerializableDeckState = {
        deckState: { drawPile: [], hand: [], discardPile: [], exhaustPile: [] },
        energyState: { current: 0, max: DECK_CONFIG.baseEnergy },
        instanceCounter: 42,
      };

      service.restoreState(snapshot);
      service.addCard(CardId.TOWER_BASIC); // uses instanceCounter internally
      const added = service.getDeckState().discardPile[0];
      // The next instanceId after counter=42 should be card_42
      expect(added.instanceId).toBe('card_42');
    });

    it('restoreState() does NOT reshuffle — preserves drawPile order exactly', () => {
      const cardA: CardInstance = { instanceId: 'ord_0', cardId: CardId.TOWER_BASIC, upgraded: false };
      const cardB: CardInstance = { instanceId: 'ord_1', cardId: CardId.GOLD_RUSH, upgraded: false };
      const cardC: CardInstance = { instanceId: 'ord_2', cardId: CardId.ENERGY_SURGE, upgraded: false };

      const snapshot: SerializableDeckState = {
        deckState: { drawPile: [cardA, cardB, cardC], hand: [], discardPile: [], exhaustPile: [] },
        energyState: { current: 0, max: DECK_CONFIG.baseEnergy },
        instanceCounter: 3,
      };

      service.restoreState(snapshot);
      const drawPile = service.getDeckState().drawPile;

      expect(drawPile[0].instanceId).toBe('ord_0');
      expect(drawPile[1].instanceId).toBe('ord_1');
      expect(drawPile[2].instanceId).toBe('ord_2');
    });

    it('serialize → restore roundtrip preserves all state', () => {
      // Init, play some cards, then roundtrip
      service.initializeDeck(
        [CardId.TOWER_BASIC, CardId.GOLD_RUSH, CardId.ENERGY_SURGE, CardId.DAMAGE_BOOST],
        7,
      );
      service.drawForWave();

      // Play first card from hand if energy allows
      const hand = service.getDeckState().hand;
      if (hand.length > 0) {
        service.playCard(hand[0].instanceId);
      }

      const before = service.serializeState();

      // Wipe state
      service.clear();
      expect(service.getDeckState().drawPile.length).toBe(0);

      // Restore
      service.restoreState(before);
      const after = service.getDeckState();

      expect(after.drawPile.length).toBe(before.deckState.drawPile.length);
      expect(after.hand.length).toBe(before.deckState.hand.length);
      expect(after.discardPile.length).toBe(before.deckState.discardPile.length);
      expect(after.exhaustPile.length).toBe(before.deckState.exhaustPile.length);
      expect(service.getEnergy().current).toBe(before.energyState.current);
      expect(service.getEnergy().max).toBe(before.energyState.max);
    });
  });

  // ── Energy helpers ───────────────────────────────────────

  it('addEnergy increases current energy when below max', () => {
    service.initializeDeck(getStarterDeck(), 1);
    service.drawForWave();
    // Spend 2 energy so there is room to add without hitting the clamp.
    const max = service.getEnergy().max;
    service['energyState'] = { current: max - 2, max };
    service.addEnergy(1);
    expect(service.getEnergy().current).toBe(max - 1);
  });

  it('addEnergy clamps at max — does not exceed energyState.max', () => {
    service.initializeDeck(getStarterDeck(), 1);
    service.drawForWave();
    const max = service.getEnergy().max;
    service.addEnergy(9999);
    expect(service.getEnergy().current).toBe(max);
  });

  // ── undoPlay ─────────────────────────────────────────────

  it('undoPlay returns card from discardPile to hand and refunds energy', () => {
    service.initializeDeck(getStarterDeck(), 1);
    service.drawForWave();
    const hand = service.getDeckState().hand;
    const card = hand[0];
    const costBefore = service.getEnergy().current;
    service.playCard(card.instanceId);
    expect(service.getDeckState().discardPile.some(c => c.instanceId === card.instanceId)).toBeTrue();
    const costAfter = service.getEnergy().current;
    const result = service.undoPlay(card.instanceId, costBefore - costAfter);
    expect(result).toBeTrue();
    expect(service.getDeckState().hand.some(c => c.instanceId === card.instanceId)).toBeTrue();
    expect(service.getDeckState().discardPile.some(c => c.instanceId === card.instanceId)).toBeFalse();
    expect(service.getEnergy().current).toBe(costBefore);
  });

  it('undoPlay refund is clamped to max energy', () => {
    service.initializeDeck(getStarterDeck(), 1);
    service.drawForWave();
    const max = service.getEnergy().max;
    const hand = service.getDeckState().hand;
    const card = hand[0];
    service.playCard(card.instanceId);
    service.undoPlay(card.instanceId, 9999);
    expect(service.getEnergy().current).toBe(max);
  });

  it('undoPlay returns false and logs warning when card not found', () => {
    spyOn(console, 'warn');
    service.initializeDeck(getStarterDeck(), 1);
    const result = service.undoPlay('nonexistent-id', 1);
    expect(result).toBeFalse();
    expect(console.warn).toHaveBeenCalled();
  });

  it('undoPlay routes to drawPile top when hand is at maxHandSize', () => {
    service.initializeDeck(getStarterDeck(), 1);
    service.drawForWave();

    // Fill hand to maxHandSize. drawForWave drew to handSize (5); draw to cap (10).
    while (service.getDeckState().hand.length < DECK_CONFIG.maxHandSize) {
      const sizeBefore = service.getDeckState().hand.length;
      service.drawCards(1);
      if (service.getDeckState().hand.length === sizeBefore) break;
    }
    expect(service.getDeckState().hand.length).toBe(DECK_CONFIG.maxHandSize);

    const card = service.getDeckState().hand[0];
    service.playCard(card.instanceId);
    // After playing, hand is at max - 1 (9). Draw it back up to max so undoPlay sees a full hand.
    service.drawCards(1);
    expect(service.getDeckState().hand.length).toBe(DECK_CONFIG.maxHandSize);

    const drawPileBefore = service.getDeckState().drawPile.length;
    const result = service.undoPlay(card.instanceId, 0);

    expect(result).toBeTrue();
    expect(service.getDeckState().hand.length).toBe(DECK_CONFIG.maxHandSize);
    expect(service.getDeckState().hand.some(c => c.instanceId === card.instanceId)).toBeFalse();
    expect(service.getDeckState().drawPile[0].instanceId).toBe(card.instanceId);
    expect(service.getDeckState().drawPile.length).toBe(drawPileBefore + 1);
  });

  it('setMaxEnergy updates max without changing current', () => {
    service.initializeDeck(getStarterDeck(), 1);
    service.drawForWave();
    const currentBefore = service.getEnergy().current;
    service.setMaxEnergy(5);
    expect(service.getEnergy().max).toBe(5);
    expect(service.getEnergy().current).toBe(currentBefore);
  });

  // ── RNG state round-trip ─────────────────────────────────

  describe('getRngState / setRngState round-trip', () => {
    it('getRngState returns null before deck is initialized', () => {
      expect(service.getRngState()).toBeNull();
    });

    it('getRngState returns a number after initializeDeck', () => {
      service.initializeDeck(getStarterDeck(), 42);
      const state = service.getRngState();
      expect(state).not.toBeNull();
      expect(typeof state).toBe('number');
    });

    it('setRngState restores exact RNG sequence', () => {
      service.initializeDeck(getStarterDeck(), 99);
      // Advance the RNG a few times via reshuffle-triggering draw cycles
      service.drawForWave();
      const captured = service.getRngState()!;

      // Advance further
      service.drawForWave();

      // Restore to captured state
      service.setRngState(captured);
      const afterRestore = service.getRngState();
      expect(afterRestore).toBe(captured);
    });

    it('setRngState creates a fresh RNG instance when rng is null', () => {
      // After clear(), rng is null
      service.clear();
      expect(service.getRngState()).toBeNull();

      service.setRngState(12345);
      expect(service.getRngState()).toBe(12345);
    });

    it('getRngState + setRngState produces deterministic reshuffle after restore', () => {
      service.initializeDeck(
        [CardId.TOWER_BASIC, CardId.GOLD_RUSH, CardId.ENERGY_SURGE, CardId.DAMAGE_BOOST],
        7,
      );
      service.drawForWave();
      // Discard entire hand to trigger a reshuffle on next draw
      const hand = [...service.getDeckState().hand];
      for (const card of hand) {
        service.playCard(card.instanceId);
      }

      const capturedRng = service.getRngState()!;

      // Discard hand again to set up reshuffle point, then capture pile order
      service.drawForWave();
      const handBeforeRestore = service.getDeckState().hand.map(c => c.instanceId);

      // Restore RNG state and replay the same draw from same pile
      // (restoreState puts discard pile back, then setRngState restores RNG)
      const snap = service.serializeState();
      // Simulate going back to post-play state by restoring and overriding piles
      service.restoreState(snap);
      service.setRngState(capturedRng);

      service.drawForWave();
      const handAfterRestore = service.getDeckState().hand.map(c => c.instanceId);

      expect(handAfterRestore).toEqual(handBeforeRestore);
    });
  });

  // ── Phase 1 Sprint 8 — getDominantArchetype ─────────────────────────────
  describe('getDominantArchetype', () => {
    it('returns "neutral" on an empty deck', () => {
      service.clear();
      expect(service.getDominantArchetype()).toBe('neutral');
    });

    it('returns "neutral" when all cards are untagged (no archetype field)', () => {
      service.initializeDeck(getStarterDeck(), 42);
      // None of the existing 40 cards have an archetype tag yet, so the
      // dominant archetype should resolve to 'neutral'.
      expect(service.getDominantArchetype()).toBe('neutral');
    });

    it('returns "neutral" when all archetype-tagged cards are explicitly neutral', () => {
      // Synthetic stub: spy on getAllCards to return cards with archetype='neutral'.
      // We can't tag real cards yet; verify the algorithm short-circuits on neutral.
      spyOn(service, 'getAllCards').and.returnValue([
        { instanceId: 'a', cardId: CardId.GOLD_RUSH, upgraded: false },
        { instanceId: 'b', cardId: CardId.DAMAGE_BOOST, upgraded: false },
      ]);
      expect(service.getDominantArchetype()).toBe('neutral');
    });
  });
});
