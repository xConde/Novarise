import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import {
  RunState,
  RunStatus,
  RunConfig,
  DEFAULT_RUN_CONFIG,
  EncounterResult,
  createInitialRunState,
} from '../models/run-state.model';
import {
  NodeMap,
  MapNode,
  NodeType,
  getNodeById,
} from '../models/node-map.model';
import {
  CardReward,
  EncounterConfig,
  RewardItem,
  RewardScreenConfig,
  ShopItem,
  RunEvent,
} from '../models/encounter.model';
import { RelicId } from '../models/relic.model';
import { AscensionEffectType, getAscensionEffects } from '../models/ascension.model';
import {
  RELIC_EFFECT_CONFIG,
  REWARD_CONFIG,
  REST_CONFIG,
  RUN_CONFIG,
  SHOP_CONFIG,
  createSeededRng,
} from '../constants/run.constants';

import { NodeMapGeneratorService } from './node-map-generator.service';
import { EncounterService } from './encounter.service';
import { RelicService } from './relic.service';
import { DeckService } from './deck.service';
import { RunPersistenceService } from './run-persistence.service';
import { RunEventBusService, RunEventType } from './run-event-bus.service';
import { RUN_EVENTS } from '../constants/run-events';
import { PlayerProfileService } from '../../core/services/player-profile.service';
import { getStarterDeck, CARD_DEFINITIONS } from '../constants/card-definitions';
import { CardId, CardInstance, CardRarity } from '../models/card.model';

/**
 * Central orchestrator for Ascent Mode runs.
 *
 * Manages the full run lifecycle: start → encounter → reward → advance → end.
 * State is exposed via BehaviorSubjects for reactive binding.
 *
 * Root-scoped — must survive /run route transitions.
 */
@Injectable({ providedIn: 'root' })
export class RunService {

  private readonly runStateSubject = new BehaviorSubject<RunState | null>(null);
  private readonly nodeMapSubject = new BehaviorSubject<NodeMap | null>(null);

  readonly runState$: Observable<RunState | null> = this.runStateSubject.asObservable();
  readonly nodeMap$: Observable<NodeMap | null> = this.nodeMapSubject.asObservable();

  /** Stores the current encounter config while in /play. */
  private currentEncounter: EncounterConfig | null = null;

  /** Pending encounter result set by GameBoardComponent on return from /play. */
  private pendingResult: EncounterResult | null = null;

  /** Current shop items (generated on entering shop node). */
  private shopItems: ShopItem[] = [];

  /** Current event (generated on entering event node). */
  private currentEvent: RunEvent | null = null;

  /** RNG seeded per-run, advanced by each random action. */
  private runRng: (() => number) | null = null;

  constructor(
    private nodeMapGenerator: NodeMapGeneratorService,
    private encounterService: EncounterService,
    private relicService: RelicService,
    private deckService: DeckService,
    private persistence: RunPersistenceService,
    private eventBus: RunEventBusService,
    private playerProfile: PlayerProfileService,
  ) {}

  // ── Queries ─────────────────────────────────────────────

  get runState(): RunState | null { return this.runStateSubject.value; }
  get nodeMap(): NodeMap | null { return this.nodeMapSubject.value; }

  hasActiveRun(): boolean {
    return this.runState?.status === RunStatus.IN_PROGRESS;
  }

  isInRun(): boolean {
    return this.runState !== null && this.runState.status === RunStatus.IN_PROGRESS;
  }

  hasSavedRun(): boolean {
    return this.persistence.hasSavedRun();
  }

  hasPendingEncounterResult(): boolean {
    return this.pendingResult !== null;
  }

  getMaxAscension(): number {
    return this.persistence.getMaxAscension();
  }

  /** Load saved run state for preview (start screen resume info). */
  loadSavedRunPreview(): RunState | null {
    return this.persistence.loadSavedRunPreview();
  }

  isActComplete(): boolean {
    const state = this.runState;
    const map = this.nodeMap;
    if (!state || !map) return false;
    return state.completedNodeIds.includes(map.bossNodeId);
  }

  /**
   * Returns the boss preset name for the given act index and run seed.
   * Used by ActTransitionComponent to display the defeated boss name.
   */
  getBossName(actIndex: number, seed: number): string {
    return this.encounterService.getBossPresetName(actIndex, seed);
  }

  getCurrentEncounter(): EncounterConfig | null {
    return this.currentEncounter;
  }

  getShopItems(): ShopItem[] {
    return this.shopItems;
  }

  getCurrentEvent(): RunEvent | null {
    return this.currentEvent;
  }

  // ── Run Lifecycle ───────────────────────────────────────

  /** Start a new run with a fresh seed. */
  startNewRun(ascensionLevel = 0): void {
    this.persistence.clearSavedRun();
    this.relicService.clearRelics();

    // Ensure all transient run state is cleared before starting fresh
    // (guards against re-using stale state if a previous run ended mid-flight)
    this.currentEncounter = null;
    this.pendingResult = null;
    this.shopItems = [];
    this.currentEvent = null;
    this.runRng = null;

    const seed = Date.now();
    const config = this.applyAscensionToConfig(DEFAULT_RUN_CONFIG, ascensionLevel);
    const starterDeck = getStarterDeck();
    const state = createInitialRunState(seed, config, ascensionLevel);
    const stateWithDeck = { ...state, deckCardIds: starterDeck };

    this.runRng = createSeededRng(seed);
    this.updateState(stateWithDeck);

    // Initialize the deck service with the starter deck
    this.deckService.initializeDeck(starterDeck, seed);

    // Generate act 1 map
    const map = this.nodeMapGenerator.generateActMap(0, seed);
    this.nodeMapSubject.next(map);
    this.persist();
  }

  /** Resume a saved run from localStorage. */
  resumeRun(): void {
    const state = this.persistence.loadRunState();
    const map = this.persistence.loadNodeMap();
    if (!state || !map) return;

    this.runRng = createSeededRng(state.seed + state.encounterResults.length * RUN_CONFIG.resumeSeedPrime);
    this.updateState(state);
    this.nodeMapSubject.next(map);
    this.relicService.setActiveRelics(state.relicIds);

    // Reinitialize deck from persisted card IDs so DeckService state is
    // consistent with the saved run after a page reload.
    this.deckService.initializeDeck(state.deckCardIds, state.seed);
  }

  /** Abandon the current run. */
  abandonRun(): void {
    if (!this.runState) return;
    const abandonedState = { ...this.runState, status: RunStatus.ABANDONED };
    this.updateState(abandonedState);
    this.playerProfile.recordRun(abandonedState);
    this.cleanup();
  }

  // ── Node Selection ──────────────────────────────────────

  /** Select a node on the map as the next destination. */
  selectNode(nodeId: string): void {
    const state = this.runState;
    const map = this.nodeMap;
    if (!state || !map) return;

    const node = getNodeById(map, nodeId);
    if (!node) return;

    // Mark node as visited
    const updatedNodes = map.nodes.map(n =>
      n.id === nodeId ? { ...n, visited: true } : n,
    );
    this.nodeMapSubject.next({ ...map, nodes: updatedNodes });

    this.updateState({ ...state, currentNodeId: nodeId });
    this.persist();
  }

  // ── Encounter Flow ──────────────────────────────────────

  /** Prepare a combat encounter and load its map. */
  prepareEncounter(node: MapNode): void {
    const state = this.runState;
    if (!state) return;

    this.currentEncounter = this.encounterService.prepareEncounter(node, state);
    this.encounterService.loadEncounterMap(this.currentEncounter);

    this.relicService.setActiveRelics(state.relicIds);
    this.relicService.resetEncounterState();
    this.eventBus.emit(RunEventType.ENCOUNTER_START, { nodeId: node.id });
  }

  /**
   * Record encounter result from GameBoardComponent.
   * Called when the player finishes a combat encounter in /play.
   */
  recordEncounterResult(result: EncounterResult): void {
    this.pendingResult = result;
  }

  /** Consume the pending encounter result (called by RunComponent on return). */
  consumePendingEncounterResult(): EncounterResult | null {
    const result = this.pendingResult;
    this.pendingResult = null;

    if (!result || !this.runState) return null;

    // Double-call guard: only process results for in-progress runs
    if (this.runState.status !== RunStatus.IN_PROGRESS) return null;

    const state = this.runState;
    const newEncounterResults = [...state.encounterResults, result];

    if (result.victory) {
      const goldBonus = this.currentEncounter?.goldReward ?? 0;
      this.updateState({
        ...state,
        lives: state.lives - result.livesLost,
        gold: state.gold + result.goldEarned + goldBonus,
        score: state.score + result.goldEarned + result.enemiesKilled * RUN_CONFIG.scorePerKill,
        completedNodeIds: [...state.completedNodeIds, result.nodeId],
        encounterResults: newEncounterResults,
      });
    } else {
      // Defeat — run over
      const defeatState = {
        ...state,
        lives: 0,
        encounterResults: newEncounterResults,
        status: RunStatus.DEFEAT,
      };
      this.updateState(defeatState);
      this.playerProfile.recordRun(defeatState);
    }

    this.currentEncounter = null;
    this.eventBus.emit(RunEventType.ENCOUNTER_END, { victory: result.victory });
    this.persist();
    return result;
  }

  // ── Rewards ─────────────────────────────────────────────

  /** Generate reward choices after a victorious encounter. */
  generateRewards(): RewardScreenConfig {
    const encounter = this.currentEncounter;
    const rng = this.runRng ?? Math.random;

    const goldPickup = encounter?.goldReward ?? 0;

    // Determine relic choice count
    let choiceCount: number = REWARD_CONFIG.relicChoicesCombat;
    if (encounter?.isElite) choiceCount = REWARD_CONFIG.relicChoicesElite;
    if (encounter?.isBoss) choiceCount = REWARD_CONFIG.relicChoicesBoss;

    // Apply ascension relic reduction (FEWER_RELIC_CHOICES stacks additively; floor at 1)
    const state = this.runState;
    if (state) {
      const ascEffects = getAscensionEffects(state.ascensionLevel);
      const relicReduction = ascEffects.get(AscensionEffectType.FEWER_RELIC_CHOICES) ?? 0;
      choiceCount = Math.max(1, choiceCount - relicReduction);
    }

    // Pick relics from available pool
    const relicChoices = this.pickRelicRewards(choiceCount, rng);

    // Pick 3 cards not already in deck, weighted by rarity
    const cardChoices = this.pickCardRewards(3, rng);

    return {
      goldPickup,
      relicChoices,
      cardChoices,
      bonusRewards: [],
    };
  }

  private pickCardRewards(count: number, rng: () => number): CardReward[] {
    const state = this.runState;
    if (!state) return [];

    // Pool: all non-starter cards (duplicates allowed — StS allows multiple copies)
    const pool = Object.values(CARD_DEFINITIONS)
      .filter(c => c.rarity !== CardRarity.STARTER);

    // Weighted selection: sort randomly then pick first `count`
    const shuffled = [...pool].sort(() => rng() - 0.5);

    const picked: CardReward[] = [];
    for (const card of shuffled) {
      if (picked.length >= count) break;
      picked.push({ type: 'card', cardId: card.id });
    }

    return picked;
  }

  /** Collect a reward (relic or gold). */
  collectReward(reward: RewardItem): void {
    const state = this.runState;
    if (!state) return;

    switch (reward.type) {
      case 'relic':
        // Duplicate-relic guard: silently skip if already owned
        if (state.relicIds.includes(reward.relicId)) return;
        this.addRelic(reward.relicId);
        break;
      case 'gold':
        this.updateState({ ...state, gold: state.gold + reward.amount });
        break;
      case 'card':
        this.deckService.addCard(reward.cardId);
        this.updateState({ ...state, deckCardIds: [...state.deckCardIds, reward.cardId] });
        break;
    }
    this.persist();
  }

  // ── Non-Combat Nodes ────────────────────────────────────

  /** Returns all card instances across draw pile, hand, discard, and exhaust (for deck viewer / rest upgrade). */
  getDeckCards(): CardInstance[] {
    return this.deckService.getAllCards();
  }

  /** Upgrade a card by instance ID (rest site action). Marks the node completed and persists. */
  upgradeCard(instanceId: string): void {
    this.deckService.upgradeCard(instanceId);
    this.markCurrentNodeCompleted();
    this.persist();
  }

  /** Rest: heal lives. */
  restHeal(): void {
    const state = this.runState;
    if (!state) return;

    let healAmount = Math.floor(state.maxLives * REST_CONFIG.healPercentage);
    healAmount = Math.max(REST_CONFIG.minHeal, healAmount);

    // Apply ascension heal reduction
    const ascEffects = getAscensionEffects(state.ascensionLevel);
    const healReduction = ascEffects.get(AscensionEffectType.REST_HEAL_REDUCTION) ?? 1;
    healAmount = Math.max(1, Math.floor(healAmount * healReduction));

    const newLives = Math.min(state.maxLives, state.lives + healAmount);

    this.updateState({
      ...state,
      lives: newLives,
      completedNodeIds: [...state.completedNodeIds, state.currentNodeId!],
    });
    this.persist();
  }

  /** Shop: generate shop items for the current node. */
  generateShopItems(): void {
    const rng = this.runRng ?? Math.random;
    const state = this.runState;
    if (!state) return;

    const items: ShopItem[] = [];

    // Relic items
    const available = this.relicService.getAvailableRelics();
    const shuffled = [...available].sort(() => rng() - 0.5);
    const shopRelics = shuffled.slice(0, SHOP_CONFIG.relicsInShop);

    // Apply ascension price multiplier
    const ascEffects = getAscensionEffects(state.ascensionLevel);
    const priceMultiplier = ascEffects.get(AscensionEffectType.SHOP_PRICE_MULTIPLIER) ?? 1;

    for (const relic of shopRelics) {
      const basePrice = SHOP_CONFIG.priceByRarity[relic.rarity];
      items.push({
        item: { type: 'relic', relicId: relic.id },
        cost: Math.round(basePrice * priceMultiplier),
      });
    }

    // Card items — 3 random non-starter cards from the full card pool.
    const cardPool = Object.values(CARD_DEFINITIONS).filter(c => c.rarity !== CardRarity.STARTER);
    const shuffledCards = [...cardPool].sort(() => rng() - 0.5);
    const shopCards = shuffledCards.slice(0, SHOP_CONFIG.cardsInShop);

    for (const card of shopCards) {
      const rarityKey = card.rarity as keyof typeof SHOP_CONFIG.priceByRarity;
      const basePrice = SHOP_CONFIG.priceByRarity[rarityKey] ?? SHOP_CONFIG.priceByRarity.common;
      items.push({
        item: { type: 'card', cardId: card.id },
        cost: Math.round(basePrice * priceMultiplier),
      });
    }

    this.shopItems = items;
  }

  /** Buy item from shop by index. */
  buyShopItem(index: number): void {
    const state = this.runState;
    if (!state) return;
    if (index < 0 || index >= this.shopItems.length) return;

    const item = this.shopItems[index];
    if (state.gold < item.cost) return;

    this.updateState({ ...state, gold: state.gold - item.cost });
    this.collectReward(item.item);
    this.shopItems = this.shopItems.filter((_, i) => i !== index);
    this.persist();
  }

  /** Buy one life heal from the shop. */
  buyShopHeal(): void {
    const state = this.runState;
    if (!state) return;
    if (state.gold < SHOP_CONFIG.healCostPerLife) return;
    if (state.lives >= state.maxLives) return;

    this.updateState({
      ...state,
      gold: state.gold - SHOP_CONFIG.healCostPerLife,
      lives: Math.min(state.maxLives, state.lives + 1),
    });
    this.persist();
  }

  /** Leave shop (marks node as completed). */
  leaveShop(): void {
    this.markCurrentNodeCompleted();
  }

  /** Resolve an event choice by index. */
  resolveEvent(choiceIndex: number): void {
    const state = this.runState;
    const event = this.currentEvent;
    if (!state || !event) return;
    if (choiceIndex < 0 || choiceIndex >= event.choices.length) return;

    const outcome = event.choices[choiceIndex].outcome;

    let newLives = Math.min(state.maxLives, Math.max(0, state.lives + outcome.livesDelta));
    const newGold = Math.max(0, state.gold + outcome.goldDelta);
    const newRelicIds = [...state.relicIds];

    if (outcome.relicId) {
      newRelicIds.push(outcome.relicId);
    }
    if (outcome.removeRelicId) {
      const idx = newRelicIds.indexOf(outcome.removeRelicId);
      if (idx >= 0) newRelicIds.splice(idx, 1);
    }

    // Card removal: remove a random non-starter card from the deck.
    if (outcome.removeCard) {
      this.removeRandomNonStarterCard();
    }

    // Check for death by event
    const newStatus = newLives <= 0 ? RunStatus.DEFEAT : state.status;
    if (newLives <= 0) newLives = 0;

    this.updateState({
      ...state,
      lives: newLives,
      gold: newGold,
      relicIds: newRelicIds,
      status: newStatus,
      completedNodeIds: [...state.completedNodeIds, state.currentNodeId!],
    });

    this.relicService.setActiveRelics(newRelicIds);
    this.currentEvent = null;
    this.persist();
  }

  /**
   * Remove a random non-starter card from the deck.
   * If no non-starter cards exist, removes the last card in the deck as a fallback.
   */
  private removeRandomNonStarterCard(): void {
    const allCards = this.deckService.getAllCards();
    const nonStarters = allCards.filter(c => {
      const def = CARD_DEFINITIONS[c.cardId as CardId];
      return def && def.rarity !== CardRarity.STARTER;
    });

    const pool = nonStarters.length > 0 ? nonStarters : allCards;
    if (pool.length === 0) return;

    const rng = this.runRng ?? Math.random;
    const index = Math.floor(rng() * pool.length);
    this.deckService.removeCard(pool[index].instanceId);
  }

  /** Generate a random event for the current node. */
  generateEvent(): void {
    const rng = this.runRng ?? Math.random;
    const events = RUN_EVENTS;
    const index = Math.floor(rng() * events.length);
    this.currentEvent = events[index];
  }

  /** Reveal an unknown node type (used for UNKNOWN nodes). */
  revealUnknownNode(nodeId: string): NodeType {
    const map = this.nodeMap;
    if (!map) return NodeType.COMBAT;

    const rng = this.runRng ?? Math.random;
    const roll = rng();

    // Unknown nodes reveal as: combat (50%), event (25%), shop (15%), rest (10%)
    let revealedType: NodeType;
    if (roll < 0.5) revealedType = NodeType.COMBAT;
    else if (roll < 0.75) revealedType = NodeType.EVENT;
    else if (roll < 0.9) revealedType = NodeType.SHOP;
    else revealedType = NodeType.REST;

    // Update the node in the map
    const updatedNodes = map.nodes.map(n =>
      n.id === nodeId ? { ...n, type: revealedType } : n,
    );
    this.nodeMapSubject.next({ ...map, nodes: updatedNodes });

    return revealedType;
  }

  // ── Act Progression ─────────────────────────────────────

  /** Advance to the next act after boss defeat. */
  advanceAct(): void {
    const state = this.runState;
    if (!state) return;

    // Idempotency guard: only advance from an in-progress run
    if (state.status !== RunStatus.IN_PROGRESS) return;

    const nextAct = state.actIndex + 1;

    if (nextAct >= state.config.actsCount) {
      // Run complete — victory!
      const victoryState = { ...state, status: RunStatus.VICTORY };
      this.updateState(victoryState);
      this.persistence.setMaxAscension(state.ascensionLevel + 1);
      this.playerProfile.recordRun(victoryState);
      this.cleanup();
      return;
    }

    // Generate next act map
    const newMap = this.nodeMapGenerator.generateActMap(nextAct, state.seed + nextAct * RUN_CONFIG.actSeedPrime);
    this.nodeMapSubject.next(newMap);

    this.updateState({
      ...state,
      actIndex: nextAct,
      currentNodeId: null,
    });
    this.persist();
  }

  // ── Private Helpers ─────────────────────────────────────

  private addRelic(relicId: RelicId): void {
    const state = this.runState;
    if (!state) return;

    const newRelicIds = [...state.relicIds, relicId];
    const maxLivesBonus = relicId === RelicId.IRON_HEART ? RELIC_EFFECT_CONFIG.ironHeartMaxLivesBonus : 0;

    this.updateState({
      ...state,
      relicIds: newRelicIds,
      maxLives: state.maxLives + maxLivesBonus,
      lives: state.lives + maxLivesBonus,
    });
    this.relicService.setActiveRelics(newRelicIds);
  }

  private pickRelicRewards(count: number, rng: () => number): Array<{ type: 'relic'; relicId: RelicId }> {
    const available = this.relicService.getAvailableRelics();
    if (available.length === 0) return [];

    // Weight by rarity: common first, then uncommon, then rare
    const sorted = [...available].sort(() => rng() - 0.5);
    const picked = sorted.slice(0, Math.min(count, sorted.length));

    return picked.map(r => ({ type: 'relic' as const, relicId: r.id }));
  }

  private markCurrentNodeCompleted(): void {
    const state = this.runState;
    if (!state || !state.currentNodeId) return;

    if (!state.completedNodeIds.includes(state.currentNodeId)) {
      this.updateState({
        ...state,
        completedNodeIds: [...state.completedNodeIds, state.currentNodeId],
      });
      this.persist();
    }
  }

  private applyAscensionToConfig(config: RunConfig, level: number): RunConfig {
    if (level === 0) return config;

    const effects = getAscensionEffects(level);
    const goldReduction = effects.get(AscensionEffectType.STARTING_GOLD_REDUCTION) ?? 0;
    const livesReduction = effects.get(AscensionEffectType.STARTING_LIVES_REDUCTION) ?? 0;

    return {
      ...config,
      startingGold: Math.max(RUN_CONFIG.minStartingGold, config.startingGold - goldReduction),
      startingLives: Math.max(RUN_CONFIG.minStartingLives, config.startingLives - livesReduction),
    };
  }

  private updateState(state: RunState): void {
    this.runStateSubject.next(state);
  }

  private persist(): void {
    const state = this.runState;
    const map = this.nodeMap;
    if (state && map) {
      this.persistence.saveRunState(state, map);
    }
  }

  private cleanup(): void {
    this.persistence.clearSavedRun();
    this.currentEncounter = null;
    this.pendingResult = null;
    this.shopItems = [];
    this.currentEvent = null;
    this.runRng = null;
    this.relicService.clearRelics();
    this.deckService.clear();
  }
}
