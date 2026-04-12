import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  CardId,
  CardInstance,
  DECK_CONFIG,
  DeckState,
  EnergyState,
} from '../models/card.model';
import { getCardDefinition } from '../constants/card-definitions';
import { createSeededRng } from '../constants/run.constants';

/**
 * DeckService — deck management for Ascent Mode encounters.
 *
 * Root-scoped so deck state persists across route transitions
 * (e.g. from node-map to encounter and back).
 *
 * Immutable update pattern: every mutation creates new objects so
 * BehaviorSubject comparisons and Angular CD work correctly.
 */
@Injectable({ providedIn: 'root' })
export class DeckService {
  // ── Internal state ────────────────────────────────────────

  private deckState: DeckState = { drawPile: [], hand: [], discardPile: [], exhaustPile: [] };
  private energyState: EnergyState = { current: 0, max: DECK_CONFIG.baseEnergy };
  private instanceCounter = 0;
  private rng: (() => number) | null = null;

  // ── Reactive observables ──────────────────────────────────

  private readonly deckStateSubject = new BehaviorSubject<DeckState>(this.deckState);
  private readonly energySubject = new BehaviorSubject<EnergyState>(this.energyState);

  readonly deckState$: Observable<DeckState> = this.deckStateSubject.asObservable();
  readonly energy$: Observable<EnergyState> = this.energySubject.asObservable();

  // ── Lifecycle ─────────────────────────────────────────────

  /** Initialize deck from card IDs (run start). */
  initializeDeck(cardIds: CardId[], seed: number): void {
    this.rng = createSeededRng(seed);
    this.instanceCounter = 0;
    const instances = cardIds.map(id => this.createInstance(id));
    this.deckState = {
      drawPile: this.shuffle(instances),
      hand: [],
      discardPile: [],
      exhaustPile: [],
    };
    this.energyState = { current: 0, max: DECK_CONFIG.baseEnergy };
    this.emit();
  }

  /**
   * Reset for new encounter (keeps deck composition, reshuffles).
   * Phase H8 bug fix: exhaustPile is now INCLUDED in the reshuffle so cards
   * exhausted during the previous encounter return to the draw pile. StS
   * convention: exhaust is "gone for the rest of combat," not "gone for the
   * rest of the run." The previous behavior permanently removed exhausted
   * cards from the run.
   */
  resetForEncounter(): void {
    const allCards = [
      ...this.deckState.drawPile,
      ...this.deckState.hand,
      ...this.deckState.discardPile,
      ...this.deckState.exhaustPile,
    ];
    this.deckState = {
      drawPile: this.shuffle(allCards),
      hand: [],
      discardPile: [],
      exhaustPile: [],
    };
    this.emit();
  }

  /**
   * Draw cards for a new wave/turn. Refills energy and draws up to handSize.
   * Phase 10: `innate` cards in the draw pile are prioritized first so they
   * always appear in the opening hand regardless of shuffle order. Retained
   * cards from the previous turn count toward the hand size cap — the new
   * draw tops up the existing hand rather than replacing it.
   */
  drawForWave(): void {
    this.energyState = { current: this.energyState.max, max: this.energyState.max };

    // Phase 10: innate cards jump the draw queue — only on the first draw of an
    // encounter (when discardPile is empty AND hand is empty AND exhaustPile empty).
    const isEncounterStart = this.deckState.discardPile.length === 0
      && this.deckState.hand.length === 0
      && this.deckState.exhaustPile.length === 0;

    if (isEncounterStart) {
      const innateIndices: number[] = [];
      this.deckState.drawPile.forEach((card, i) => {
        const def = getCardDefinition(card.cardId);
        if (def.innate) innateIndices.push(i);
      });
      // Reorder drawPile so innate cards are at the front (preserves relative order).
      if (innateIndices.length > 0) {
        const innate: CardInstance[] = [];
        const rest: CardInstance[] = [];
        const innateSet = new Set(innateIndices);
        this.deckState.drawPile.forEach((card, i) => {
          (innateSet.has(i) ? innate : rest).push(card);
        });
        this.deckState = { ...this.deckState, drawPile: [...innate, ...rest] };
      }
    }

    const toDraw = DECK_CONFIG.handSize - this.deckState.hand.length;
    for (let i = 0; i < toDraw && this.deckState.hand.length < DECK_CONFIG.maxHandSize; i++) {
      this.drawOne();
    }
    this.emit();
  }

  /**
   * Discard entire hand at end of wave/turn.
   *
   * Phase 10 keywords:
   *  - `retain` cards stay in hand for the next turn.
   *  - `ethereal` cards are exhausted (not discarded) at end of turn.
   *  - All other cards go to the discard pile as normal.
   */
  discardHand(): void {
    const retained: CardInstance[] = [];
    const discarded: CardInstance[] = [];
    const exhausted: CardInstance[] = [];
    for (const card of this.deckState.hand) {
      const def = getCardDefinition(card.cardId);
      if (def.retain) {
        retained.push(card);
      } else if (def.ethereal) {
        exhausted.push(card);
      } else {
        discarded.push(card);
      }
    }
    this.deckState = {
      ...this.deckState,
      hand: retained,
      discardPile: [...this.deckState.discardPile, ...discarded],
      exhaustPile: [...this.deckState.exhaustPile, ...exhausted],
    };
    this.emit();
  }

  // ── Card Actions ──────────────────────────────────────────

  /**
   * Play a card from hand. Deducts energy and moves card to discard (or
   * exhaust pile if the card has the `exhaust` keyword).
   * Returns true if successful; false if card not in hand or insufficient energy.
   */
  playCard(instanceId: string): boolean {
    const index = this.deckState.hand.findIndex(c => c.instanceId === instanceId);
    if (index === -1) return false;

    const card = this.deckState.hand[index];
    const def = getCardDefinition(card.cardId);
    const cost = def.energyCost;

    if (this.energyState.current < cost) return false;

    const newHand = [...this.deckState.hand];
    newHand.splice(index, 1);

    // Phase 10: exhaust keyword — card leaves the deck for the rest of the encounter.
    if (def.exhaust) {
      this.deckState = {
        ...this.deckState,
        hand: newHand,
        exhaustPile: [...this.deckState.exhaustPile, card],
      };
    } else {
      this.deckState = {
        ...this.deckState,
        hand: newHand,
        discardPile: [...this.deckState.discardPile, card],
      };
    }
    this.energyState = { ...this.energyState, current: this.energyState.current - cost };
    this.emit();
    return true;
  }

  /**
   * Draw one card from the draw pile into hand.
   * Reshuffles discard into draw pile if draw pile is empty.
   * Returns false if both piles are empty or hand is at max size.
   */
  drawOne(): boolean {
    if (this.deckState.drawPile.length === 0) {
      this.reshuffleDiscard();
    }
    if (this.deckState.drawPile.length === 0) return false;
    if (this.deckState.hand.length >= DECK_CONFIG.maxHandSize) return false;

    const drawn = this.deckState.drawPile[0];
    this.deckState = {
      ...this.deckState,
      drawPile: this.deckState.drawPile.slice(1),
      hand: [...this.deckState.hand, drawn],
    };
    return true;
  }

  /** Add a new card to the deck (reward). Card goes to discard pile. */
  addCard(cardId: CardId): void {
    const instance = this.createInstance(cardId);
    this.deckState = {
      ...this.deckState,
      discardPile: [...this.deckState.discardPile, instance],
    };
    this.emit();
  }

  /**
   * Remove a card from the deck permanently (event/shop).
   * Searches draw pile, hand, and discard pile in order.
   * Returns false if the instanceId is not found.
   */
  removeCard(instanceId: string): boolean {
    for (const pile of ['drawPile', 'hand', 'discardPile'] as const) {
      const index = this.deckState[pile].findIndex(c => c.instanceId === instanceId);
      if (index !== -1) {
        const newPile = [...this.deckState[pile]];
        newPile.splice(index, 1);
        this.deckState = { ...this.deckState, [pile]: newPile };
        this.emit();
        return true;
      }
    }
    return false;
  }

  /**
   * Upgrade a card (set upgraded = true).
   * Returns false if card is already upgraded or not found.
   */
  upgradeCard(instanceId: string): boolean {
    for (const pile of ['drawPile', 'hand', 'discardPile'] as const) {
      const index = this.deckState[pile].findIndex(c => c.instanceId === instanceId);
      if (index !== -1) {
        const card = this.deckState[pile][index];
        if (card.upgraded) return false;
        const newPile = [...this.deckState[pile]];
        newPile[index] = { ...card, upgraded: true };
        this.deckState = { ...this.deckState, [pile]: newPile };
        this.emit();
        return true;
      }
    }
    return false;
  }

  /** Get all cards across all piles (for deck viewer). */
  getAllCards(): CardInstance[] {
    return [
      ...this.deckState.drawPile,
      ...this.deckState.hand,
      ...this.deckState.discardPile,
      ...this.deckState.exhaustPile,
    ];
  }

  /** Get current energy state. */
  getEnergy(): EnergyState {
    return this.energyState;
  }

  /** Get current deck state snapshot. */
  getDeckState(): DeckState {
    return this.deckState;
  }

  /** Set max energy (relic bonus). */
  setMaxEnergy(max: number): void {
    this.energyState = { ...this.energyState, max };
    this.emit();
  }

  /**
   * Draw N cards from the draw pile into hand.
   * Thin wrapper over drawOne() — respects hand-size cap (DECK_CONFIG.maxHandSize)
   * and reshuffles discard into draw pile when the draw pile runs out. If the
   * combined draw + discard pile is exhausted before N draws, the remaining draws
   * are silently dropped (not an error). This matches the StS convention.
   *
   * Use case: CRYO_PULSE spell card draws 1 card as part of its effect.
   */
  drawCards(count: number): void {
    for (let i = 0; i < count; i++) {
      if (!this.drawOne()) break;
    }
    this.emit();
  }

  /** Add energy this wave (utility card effect). */
  addEnergy(amount: number): void {
    this.energyState = { ...this.energyState, current: this.energyState.current + amount };
    this.emit();
  }

  /** Clear all state (run end). */
  clear(): void {
    this.deckState = { drawPile: [], hand: [], discardPile: [], exhaustPile: [] };
    this.energyState = { current: 0, max: DECK_CONFIG.baseEnergy };
    this.instanceCounter = 0;
    this.rng = null;
    this.emit();
  }

  // ── Private ───────────────────────────────────────────────

  private createInstance(cardId: CardId): CardInstance {
    return { instanceId: `card_${this.instanceCounter++}`, cardId, upgraded: false };
  }

  private shuffle(cards: CardInstance[]): CardInstance[] {
    const rng = this.rng ?? Math.random;
    const arr = [...cards];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private reshuffleDiscard(): void {
    this.deckState = {
      ...this.deckState,
      drawPile: this.shuffle(this.deckState.discardPile),
      discardPile: [],
    };
  }

  private emit(): void {
    this.deckStateSubject.next(this.deckState);
    this.energySubject.next(this.energyState);
  }
}
