/**
 * Card System — Integration Flow Tests
 *
 * End-to-end card lifecycle tests using REAL DeckService and CardEffectService.
 *
 * Real:   DeckService, CardEffectService
 * Mocked: GameStateService, EnemyService (spell target services)
 */

import { TestBed } from '@angular/core/testing';

import { DeckService } from '../services/deck.service';
import { CardEffectService } from '../services/card-effect.service';
import {
  CardId,
  CardInstance,
  CardType,
  DECK_CONFIG,
} from '../models/card.model';
import { getStarterDeck, CARD_DEFINITIONS } from '../constants/card-definitions';
import { GameStateService } from '../../game/game-board/services/game-state.service';
import { EnemyService } from '../../game/game-board/services/enemy.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_SEED = 12345;

function makeGameStateSpy(): jasmine.SpyObj<GameStateService> {
  return jasmine.createSpyObj('GameStateService', ['addGold', 'addLives']);
}

function makeEnemyServiceSpy(): jasmine.SpyObj<EnemyService> {
  return jasmine.createSpyObj('EnemyService', ['damageStrongestEnemy', 'slowAllEnemies']);
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('Card System — Integration Flow', () => {
  let deck: DeckService;
  let effects: CardEffectService;
  let gameState: jasmine.SpyObj<GameStateService>;
  let enemyService: jasmine.SpyObj<EnemyService>;

  beforeEach(() => {
    gameState = makeGameStateSpy();
    enemyService = makeEnemyServiceSpy();

    TestBed.configureTestingModule({
      providers: [
        DeckService,
        CardEffectService,
        { provide: GameStateService, useValue: gameState },
        { provide: EnemyService, useValue: enemyService },
      ],
    });

    deck = TestBed.inject(DeckService);
    effects = TestBed.inject(CardEffectService);
  });

  afterEach(() => {
    deck.clear();
    effects.reset();
  });

  // ── Deck Initialization ──────────────────────────────────────────────────

  it('should initialize deck with starter cards (20 cards)', () => {
    const starterIds = getStarterDeck();
    deck.initializeDeck(starterIds, TEST_SEED);

    const state = deck.getDeckState();
    const totalCards = state.drawPile.length + state.hand.length + state.discardPile.length + state.exhaustPile.length;
    expect(totalCards).toBe(20);
    expect(state.hand).toEqual([]);
    expect(state.discardPile).toEqual([]);
  });

  it('should draw 5 cards for first wave', () => {
    deck.initializeDeck(getStarterDeck(), TEST_SEED);
    deck.drawForWave();

    const state = deck.getDeckState();
    expect(state.hand.length).toBe(DECK_CONFIG.handSize);
    expect(state.drawPile.length).toBe(20 - DECK_CONFIG.handSize);
  });

  it('should deduct energy when playing a card', () => {
    deck.initializeDeck(getStarterDeck(), TEST_SEED);
    deck.drawForWave();

    const hand = deck.getDeckState().hand;
    const card = hand[0];
    const def = CARD_DEFINITIONS[card.cardId];
    const energyBefore = deck.getEnergy().current;

    deck.playCard(card.instanceId);

    expect(deck.getEnergy().current).toBe(energyBefore - def.energyCost);
  });

  it('should refuse to play card with insufficient energy', () => {
    deck.initializeDeck(getStarterDeck(), TEST_SEED);
    deck.drawForWave();
    // Zero out energy via max 0
    deck.setMaxEnergy(0);
    deck.drawForWave(); // re-draws and resets energy to max (0)

    const hand = deck.getDeckState().hand;
    const result = deck.playCard(hand[0].instanceId);

    expect(result).toBeFalse();
    expect(deck.getDeckState().hand.length).toBe(hand.length);
  });

  it('should move played card to discard pile', () => {
    deck.initializeDeck(getStarterDeck(), TEST_SEED);
    deck.drawForWave();

    const hand = deck.getDeckState().hand;
    const card = hand[0];
    const discardBefore = deck.getDeckState().discardPile.length;

    deck.playCard(card.instanceId);

    const state = deck.getDeckState();
    expect(state.hand.find(c => c.instanceId === card.instanceId)).toBeUndefined();
    expect(state.discardPile.length).toBe(discardBefore + 1);
    expect(state.discardPile.find(c => c.instanceId === card.instanceId)).toBeDefined();
  });

  it('should reshuffle discard into draw pile when draw pile empty', () => {
    // Start with small deck: 3 cards
    deck.initializeDeck([CardId.TOWER_BASIC, CardId.TOWER_BASIC, CardId.TOWER_BASIC], TEST_SEED);

    // Draw all 3 into hand
    deck.drawForWave(); // draws up to handSize but limited by pile
    // Manually play them all to move to discard
    const hand = [...deck.getDeckState().hand];
    for (const card of hand) {
      deck.playCard(card.instanceId);
    }

    // Now discard has 3 cards, draw has 0
    expect(deck.getDeckState().drawPile.length).toBe(0);
    expect(deck.getDeckState().discardPile.length).toBe(3);

    // Drawing should trigger reshuffle
    const drew = deck.drawOne();
    expect(drew).toBeTrue();
    // After reshuffle+draw: drawPile has 2 (reshuffle gives 3, then 1 drawn)
    expect(deck.getDeckState().drawPile.length).toBe(2);
    expect(deck.getDeckState().discardPile.length).toBe(0);
  });

  it('should discard hand at wave end', () => {
    deck.initializeDeck(getStarterDeck(), TEST_SEED);
    deck.drawForWave();

    const handSize = deck.getDeckState().hand.length;
    expect(handSize).toBeGreaterThan(0);

    deck.discardHand();

    expect(deck.getDeckState().hand.length).toBe(0);
    expect(deck.getDeckState().discardPile.length).toBe(handSize);
  });

  it('should draw new hand for next wave', () => {
    deck.initializeDeck(getStarterDeck(), TEST_SEED);
    deck.drawForWave();
    deck.discardHand();

    deck.drawForWave();

    expect(deck.getDeckState().hand.length).toBe(DECK_CONFIG.handSize);
  });

  it('should add a card to deck via reward', () => {
    deck.initializeDeck(getStarterDeck(), TEST_SEED);
    const totalBefore = deck.getAllCards().length;

    deck.addCard(CardId.LIGHTNING_STRIKE);

    expect(deck.getAllCards().length).toBe(totalBefore + 1);
    const added = deck.getDeckState().discardPile.find(c => c.cardId === CardId.LIGHTNING_STRIKE);
    expect(added).toBeDefined();
  });

  it('should remove a card from deck', () => {
    deck.initializeDeck(getStarterDeck(), TEST_SEED);
    const allCards = deck.getAllCards();
    const targetInstance = allCards[0];
    const totalBefore = allCards.length;

    const removed = deck.removeCard(targetInstance.instanceId);

    expect(removed).toBeTrue();
    expect(deck.getAllCards().length).toBe(totalBefore - 1);
    expect(deck.getAllCards().find(c => c.instanceId === targetInstance.instanceId)).toBeUndefined();
  });

  it('should upgrade a card (set upgraded flag)', () => {
    deck.initializeDeck(getStarterDeck(), TEST_SEED);
    const card = deck.getAllCards()[0];

    const upgraded = deck.upgradeCard(card.instanceId);

    expect(upgraded).toBeTrue();
    const updatedCard = deck.getAllCards().find(c => c.instanceId === card.instanceId);
    expect(updatedCard!.upgraded).toBeTrue();
  });

  it('should apply modifier card with wave countdown', () => {
    const modifierEffect = CARD_DEFINITIONS[CardId.DAMAGE_BOOST].effect;
    expect(modifierEffect.type).toBe('modifier');

    if (modifierEffect.type === 'modifier') {
      effects.applyModifier(modifierEffect);
      expect(effects.hasActiveModifier('damage')).toBeTrue();
      expect(effects.getModifierValue('damage')).toBeCloseTo(0.25, 3);
    }
  });

  it('should tick modifier countdown at wave end', () => {
    const modifierEffect = CARD_DEFINITIONS[CardId.DAMAGE_BOOST].effect;
    if (modifierEffect.type !== 'modifier') { fail('Expected modifier effect'); return; }

    effects.applyModifier(modifierEffect); // duration = 2

    effects.tickWave();

    const mods = effects.getActiveModifiers();
    expect(mods.length).toBe(1);
    expect(mods[0].remainingWaves).toBe(1);
  });

  it('should expire modifier after duration runs out', () => {
    const modifierEffect = CARD_DEFINITIONS[CardId.DAMAGE_BOOST].effect;
    if (modifierEffect.type !== 'modifier') { fail('Expected modifier effect'); return; }

    effects.applyModifier(modifierEffect); // duration = 2

    effects.tickWave(); // → 1
    effects.tickWave(); // → 0, removed

    expect(effects.hasActiveModifier('damage')).toBeFalse();
    expect(effects.getActiveModifiers().length).toBe(0);
  });

  it('should stack multiple modifiers of same stat', () => {
    const modifierEffect = CARD_DEFINITIONS[CardId.DAMAGE_BOOST].effect;
    if (modifierEffect.type !== 'modifier') { fail('Expected modifier effect'); return; }

    effects.applyModifier(modifierEffect); // +0.25
    effects.applyModifier(modifierEffect); // +0.25

    expect(effects.getModifierValue('damage')).toBeCloseTo(0.5, 3);
    expect(effects.getActiveModifiers().length).toBe(2);
  });

  it('should reset all modifiers on encounter end', () => {
    const modifierEffect = CARD_DEFINITIONS[CardId.DAMAGE_BOOST].effect;
    if (modifierEffect.type !== 'modifier') { fail('Expected modifier effect'); return; }

    effects.applyModifier(modifierEffect);
    expect(effects.hasActiveModifier('damage')).toBeTrue();

    effects.reset();

    expect(effects.hasActiveModifier('damage')).toBeFalse();
    expect(effects.getActiveModifiers().length).toBe(0);
  });

  it('should persist deckCardIds across encounters (resetForEncounter preserves composition)', () => {
    deck.initializeDeck(getStarterDeck(), TEST_SEED);
    deck.drawForWave();

    const totalBefore = deck.getAllCards().length;

    deck.resetForEncounter();
    deck.drawForWave();

    // Same number of cards — deck composition unchanged
    expect(deck.getAllCards().length).toBe(totalBefore);
    // Hand has been drawn
    expect(deck.getDeckState().hand.length).toBe(DECK_CONFIG.handSize);
  });

  it('should clear deck on run end', () => {
    deck.initializeDeck(getStarterDeck(), TEST_SEED);
    deck.drawForWave();

    deck.clear();

    const state = deck.getDeckState();
    expect(state.drawPile.length).toBe(0);
    expect(state.hand.length).toBe(0);
    expect(state.discardPile.length).toBe(0);
    expect(state.exhaustPile.length).toBe(0);
    expect(deck.getEnergy().current).toBe(0);
    expect(deck.getEnergy().max).toBe(DECK_CONFIG.baseEnergy);
  });

  // ── Spell Effects ────────────────────────────────────────────────────────

  it('should call addGold when gold_rush spell is played', () => {
    const goldRushDef = CARD_DEFINITIONS[CardId.GOLD_RUSH];
    const spellEffect = goldRushDef.effect;
    if (spellEffect.type !== 'spell') { fail('Expected spell effect'); return; }

    effects.applySpell(spellEffect, gameState, enemyService);

    expect(gameState.addGold).toHaveBeenCalledWith(40);
  });

  it('should call addLives when repair_walls spell is played', () => {
    const repairDef = CARD_DEFINITIONS[CardId.REPAIR_WALLS];
    const spellEffect = repairDef.effect;
    if (spellEffect.type !== 'spell') { fail('Expected spell effect'); return; }

    effects.applySpell(spellEffect, gameState, enemyService);

    expect(gameState.addLives).toHaveBeenCalledWith(2);
  });

  it('should call damageStrongestEnemy when lightning_strike spell is played', () => {
    const lightningDef = CARD_DEFINITIONS[CardId.LIGHTNING_STRIKE];
    const spellEffect = lightningDef.effect;
    if (spellEffect.type !== 'spell') { fail('Expected spell effect'); return; }

    effects.applySpell(spellEffect, gameState, enemyService);

    expect(enemyService.damageStrongestEnemy).toHaveBeenCalledWith(100);
  });

  it('should call slowAllEnemies when frost_wave spell is played', () => {
    const frostDef = CARD_DEFINITIONS[CardId.FROST_WAVE];
    const spellEffect = frostDef.effect;
    if (spellEffect.type !== 'spell') { fail('Expected spell effect'); return; }

    effects.applySpell(spellEffect, gameState, enemyService);

    expect(enemyService.slowAllEnemies).toHaveBeenCalledWith(5);
  });

  it('should add overclock as a fire_rate modifier (1-wave duration)', () => {
    const overclockDef = CARD_DEFINITIONS[CardId.OVERCLOCK];
    const spellEffect = overclockDef.effect;
    if (spellEffect.type !== 'spell') { fail('Expected spell effect'); return; }

    effects.applySpell(spellEffect, gameState, enemyService);

    expect(effects.hasActiveModifier('fire_rate')).toBeTrue();
    const mods = effects.getActiveModifiers();
    const fireMod = mods.find(m => m.stat === 'fire_rate');
    expect(fireMod!.remainingWaves).toBe(1);
  });

  // ── Edge Cases ───────────────────────────────────────────────────────────

  it('should handle playing all cards in hand (empty hand)', () => {
    deck.initializeDeck([CardId.TOWER_BASIC], TEST_SEED);
    deck.drawForWave();

    const hand = [...deck.getDeckState().hand];
    for (const card of hand) {
      deck.playCard(card.instanceId);
    }

    expect(deck.getDeckState().hand.length).toBe(0);
    // Further play attempts return false
    const fakePlay = deck.playCard('nonexistent_id');
    expect(fakePlay).toBeFalse();
  });

  it('should handle drawing when both draw and discard are empty', () => {
    // Start with empty deck — no initializeDeck call
    // DeckService starts with empty state by default
    const state = deck.getDeckState();
    expect(state.drawPile.length).toBe(0);
    expect(state.discardPile.length).toBe(0);

    const drew = deck.drawOne();
    expect(drew).toBeFalse();
    expect(deck.getDeckState().hand.length).toBe(0);
  });

  it('should handle upgrading an already-upgraded card (no-op)', () => {
    deck.initializeDeck(getStarterDeck(), TEST_SEED);
    const card = deck.getAllCards()[0];

    deck.upgradeCard(card.instanceId);
    const secondUpgrade = deck.upgradeCard(card.instanceId);

    expect(secondUpgrade).toBeFalse();
    const updatedCard = deck.getAllCards().find(c => c.instanceId === card.instanceId);
    expect(updatedCard!.upgraded).toBeTrue();
  });

  it('should handle removing a card that does not exist (no-op)', () => {
    deck.initializeDeck(getStarterDeck(), TEST_SEED);
    const totalBefore = deck.getAllCards().length;

    const result = deck.removeCard('nonexistent_instance_id_xyz');

    expect(result).toBeFalse();
    expect(deck.getAllCards().length).toBe(totalBefore);
  });
});

// ── Tower Card Deferred Placement ──────────────────────────────────────────────
//
// GameBoardComponent orchestrates deferred placement: tower cards are held in
// a `pendingTowerCard` field and NOT consumed (playCard) until actual placement.
// These tests exercise the DeckService contract that deferred placement depends
// on — ensuring the API behaves correctly when the component holds a card in limbo.

/**
 * Simulates the GameBoardComponent deferred placement state machine using
 * DeckService directly. GameBoardComponent calls:
 *   1. getEnergy() — affordability check on click (no playCard call yet)
 *   2. playCard(instanceId) — deferred to successful placement
 *   3. Nothing on cancel — card stays in hand
 */
class DeferredPlacementSimulator {
  private pendingCard: CardInstance | null = null;

  constructor(private readonly deckSvc: DeckService) {}

  /** Simulate clicking a tower card — deferred if it's a tower type. */
  onCardClicked(card: CardInstance): 'deferred' | 'consumed' | 'blocked' | 'no_energy' {
    if (this.pendingCard) return 'blocked';

    const def = CARD_DEFINITIONS[card.cardId];
    const effect = card.upgraded && def.upgradedEffect ? def.upgradedEffect : def.effect;

    if (effect.type === CardType.TOWER) {
      if (this.deckSvc.getEnergy().current < def.energyCost) return 'no_energy';
      this.pendingCard = card;
      return 'deferred';
    }

    // Non-tower: consume immediately
    const ok = this.deckSvc.playCard(card.instanceId);
    return ok ? 'consumed' : 'no_energy';
  }

  /** Simulate successful tower placement — consume the pending card. */
  onPlacementSuccess(): boolean {
    if (!this.pendingCard) return false;
    const ok = this.deckSvc.playCard(this.pendingCard.instanceId);
    this.pendingCard = null;
    return ok;
  }

  /** Cancel placement — return card to hand without consuming energy. */
  onPlacementCancel(): void {
    this.pendingCard = null;
  }

  hasPending(): boolean { return this.pendingCard !== null; }
  getPending(): CardInstance | null { return this.pendingCard; }
}

describe('Tower card deferred placement', () => {
  let deck: DeckService;
  let gameState: jasmine.SpyObj<GameStateService>;
  let enemyService: jasmine.SpyObj<EnemyService>;

  beforeEach(() => {
    gameState = jasmine.createSpyObj('GameStateService', ['addGold', 'addLives']);
    enemyService = jasmine.createSpyObj('EnemyService', ['damageStrongestEnemy', 'slowAllEnemies']);

    TestBed.configureTestingModule({
      providers: [
        DeckService,
        CardEffectService,
        { provide: GameStateService, useValue: gameState },
        { provide: EnemyService, useValue: enemyService },
      ],
    });

    deck = TestBed.inject(DeckService);
    deck.initializeDeck(getStarterDeck(), TEST_SEED);
    deck.drawForWave();
  });

  afterEach(() => {
    deck.clear();
  });

  it('clicking tower card should NOT consume energy immediately', () => {
    // Find a tower card in hand
    const towerCard = deck.getDeckState().hand.find(c => {
      const def = CARD_DEFINITIONS[c.cardId];
      const eff = c.upgraded && def.upgradedEffect ? def.upgradedEffect : def.effect;
      return eff.type === CardType.TOWER;
    });
    if (!towerCard) { pending('No tower card in hand for this seed'); return; }

    const energyBefore = deck.getEnergy().current;
    const handSizeBefore = deck.getDeckState().hand.length;

    const sim = new DeferredPlacementSimulator(deck);
    const result = sim.onCardClicked(towerCard);

    expect(result).toBe('deferred');
    // Energy unchanged — card not consumed yet
    expect(deck.getEnergy().current).toBe(energyBefore);
    // Card still in hand — not moved to discard
    expect(deck.getDeckState().hand.length).toBe(handSizeBefore);
    expect(deck.getDeckState().hand.find(c => c.instanceId === towerCard.instanceId)).toBeDefined();
  });

  it('placing tower should consume the pending card energy', () => {
    const towerCard = deck.getDeckState().hand.find(c => {
      const def = CARD_DEFINITIONS[c.cardId];
      const eff = c.upgraded && def.upgradedEffect ? def.upgradedEffect : def.effect;
      return eff.type === CardType.TOWER;
    });
    if (!towerCard) { pending('No tower card in hand for this seed'); return; }

    const def = CARD_DEFINITIONS[towerCard.cardId];
    const energyBefore = deck.getEnergy().current;

    const sim = new DeferredPlacementSimulator(deck);
    sim.onCardClicked(towerCard);

    // Energy still full before placement
    expect(deck.getEnergy().current).toBe(energyBefore);

    // Simulate successful tile click → consume the card
    const consumed = sim.onPlacementSuccess();

    expect(consumed).toBeTrue();
    // Energy deducted only NOW
    expect(deck.getEnergy().current).toBe(energyBefore - def.energyCost);
    // Card moved to discard
    expect(deck.getDeckState().hand.find(c => c.instanceId === towerCard.instanceId)).toBeUndefined();
    expect(deck.getDeckState().discardPile.find(c => c.instanceId === towerCard.instanceId)).toBeDefined();
  });

  it('cancelling placement should NOT consume energy', () => {
    const towerCard = deck.getDeckState().hand.find(c => {
      const def = CARD_DEFINITIONS[c.cardId];
      const eff = c.upgraded && def.upgradedEffect ? def.upgradedEffect : def.effect;
      return eff.type === CardType.TOWER;
    });
    if (!towerCard) { pending('No tower card in hand for this seed'); return; }

    const energyBefore = deck.getEnergy().current;
    const handSizeBefore = deck.getDeckState().hand.length;

    const sim = new DeferredPlacementSimulator(deck);
    sim.onCardClicked(towerCard);
    sim.onPlacementCancel();

    // Energy unchanged
    expect(deck.getEnergy().current).toBe(energyBefore);
    // Card still in hand
    expect(deck.getDeckState().hand.length).toBe(handSizeBefore);
    expect(deck.getDeckState().hand.find(c => c.instanceId === towerCard.instanceId)).toBeDefined();
    // No pending card
    expect(sim.hasPending()).toBeFalse();
  });

  it('only one tower card can be pending at a time', () => {
    const towerCards = deck.getDeckState().hand.filter(c => {
      const def = CARD_DEFINITIONS[c.cardId];
      const eff = c.upgraded && def.upgradedEffect ? def.upgradedEffect : def.effect;
      return eff.type === CardType.TOWER;
    });
    if (towerCards.length < 2) { pending('Need at least 2 tower cards in hand for this test'); return; }

    const [first, second] = towerCards;
    const sim = new DeferredPlacementSimulator(deck);

    // Activate first card
    const firstResult = sim.onCardClicked(first);
    expect(firstResult).toBe('deferred');
    expect(sim.getPending()?.instanceId).toBe(first.instanceId);

    // Attempt to activate second while first is pending — should be blocked
    const secondResult = sim.onCardClicked(second);
    expect(secondResult).toBe('blocked');

    // First card remains pending; second card unchanged
    expect(sim.getPending()?.instanceId).toBe(first.instanceId);
    expect(deck.getDeckState().hand.find(c => c.instanceId === second.instanceId)).toBeDefined();
  });

  it('non-tower cards should still consume energy immediately', () => {
    // GOLD_RUSH is a spell — it should consume immediately, not defer
    const spellCard = deck.getDeckState().hand.find(c => {
      const def = CARD_DEFINITIONS[c.cardId];
      return def.type === CardType.SPELL;
    });
    if (!spellCard) { pending('No spell card in hand for this seed'); return; }

    const def = CARD_DEFINITIONS[spellCard.cardId];
    const energyBefore = deck.getEnergy().current;
    const handSizeBefore = deck.getDeckState().hand.length;

    const sim = new DeferredPlacementSimulator(deck);
    const result = sim.onCardClicked(spellCard);

    expect(result).toBe('consumed');
    // Energy deducted immediately
    expect(deck.getEnergy().current).toBe(energyBefore - def.energyCost);
    // Card removed from hand immediately
    expect(deck.getDeckState().hand.length).toBe(handSizeBefore - 1);
    expect(deck.getDeckState().hand.find(c => c.instanceId === spellCard.instanceId)).toBeUndefined();
    expect(deck.getDeckState().discardPile.find(c => c.instanceId === spellCard.instanceId)).toBeDefined();
  });
});
