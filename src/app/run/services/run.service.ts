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
import { ChallengeDefinition, computeChallengeGoldBonus } from '../data/challenges';
import { RelicId, RelicRarity, RelicDefinition } from '../models/relic.model';
import { AscensionEffectType, getAscensionEffects } from '../models/ascension.model';
import {
  RELIC_EFFECT_CONFIG,
  REWARD_CONFIG,
  REWARD_RARITY_WEIGHTS,
  REST_CONFIG,
  RUN_CONFIG,
  SHOP_CONFIG,
  SeededRng,
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
import { EncounterCheckpointService } from './encounter-checkpoint.service';

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

  /** Stash of the completed encounter, set in consumePendingEncounterResult() before
   *  nulling currentEncounter so generateRewards() can still read goldReward/isElite/isBoss. */
  private lastCompletedEncounter: EncounterConfig | null = null;

  /**
   * True while restoring a checkpointed encounter — read by GameBoardComponent.
   * Set by restoreEncounter(), cleared by GameBoardComponent after restore completes.
   */
  isRestoringCheckpoint = false;

  /** Pending encounter result set by GameBoardComponent on return from /play. */
  private pendingResult: EncounterResult | null = null;

  /** Current shop items (generated on entering shop node). */
  private shopItems: ShopItem[] = [];

  /** Current event (generated on entering event node). */
  private currentEvent: RunEvent | null = null;

  /** RNG seeded per-run, advanced by each random action. */
  private runRng: SeededRng | null = null;

  constructor(
    private nodeMapGenerator: NodeMapGeneratorService,
    private encounterService: EncounterService,
    private relicService: RelicService,
    private deckService: DeckService,
    private persistence: RunPersistenceService,
    private eventBus: RunEventBusService,
    private playerProfile: PlayerProfileService,
    private encounterCheckpointService: EncounterCheckpointService,
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

  /**
   * Pure heal computation — mirrors restHeal() arithmetic without mutating state.
   * Used by run.component.ts to display the accurate heal preview at rest sites.
   */
  computeHealAmount(state: RunState): number {
    let healAmount = Math.floor(state.maxLives * REST_CONFIG.healPercentage);
    healAmount = Math.max(REST_CONFIG.minHeal, healAmount);

    const ascEffects = getAscensionEffects(state.ascensionLevel);
    const healReduction = ascEffects.get(AscensionEffectType.REST_HEAL_REDUCTION) ?? 1;
    healAmount = Math.max(1, Math.floor(healAmount * healReduction));

    return healAmount;
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

  getRngState(): number | null {
    return this.runRng?.getState() ?? null;
  }

  /** Restore the run-level PRNG to a previously captured state. Creates a fresh RNG instance if null (page-reload scenario). */
  restoreRngState(state: number): void {
    if (this.runRng) {
      this.runRng.setState(state);
    } else {
      this.runRng = createSeededRng(state);
    }
  }

  // ── Run Lifecycle ───────────────────────────────────────

  /** Start a new run with a fresh seed. */
  startNewRun(ascensionLevel = 0): void {
    this.persistence.clearSavedRun();
    this.relicService.clearRelics();

    // Clear any checkpoint leftover from a previous run before starting fresh.
    this.encounterCheckpointService.clearCheckpoint();

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
    // Clear checkpoint so a re-start does not inherit a stale encounter.
    this.encounterCheckpointService.clearCheckpoint();
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

    // Clear any stale checkpoint from a previous encounter before starting fresh.
    this.encounterCheckpointService.clearCheckpoint();

    this.currentEncounter = this.encounterService.prepareEncounter(node, state);
    this.encounterService.loadEncounterMap(this.currentEncounter);

    this.relicService.setActiveRelics(state.relicIds);
    this.relicService.resetEncounterState();
    this.eventBus.emit(RunEventType.ENCOUNTER_START, { nodeId: node.id });
  }

  /**
   * Restore a checkpointed encounter instead of preparing from scratch.
   * Called by RunComponent when the selected node has a saved checkpoint.
   * Navigation to /play is handled by the caller (same as startEncounter).
   */
  restoreEncounter(): void {
    const checkpoint = this.encounterCheckpointService.loadCheckpoint();
    if (!checkpoint) {
      // Clear stale entry — loadCheckpoint() clears on parse/validation failure,
      // but the catch block returns null without clearing. This ensures any residual
      // key is removed so getCheckpointNodeId() stops matching on future hub visits.
      this.encounterCheckpointService.clearCheckpoint();
      return;
    }

    const state = this.runState;
    if (!state) return;

    // Validate: if the node was already completed this checkpoint is stale — clear it.
    if (state.completedNodeIds?.includes(checkpoint.nodeId)) {
      this.encounterCheckpointService.clearCheckpoint();
      return;
    }

    // Restore encounter config so GameBoardComponent can read it
    this.currentEncounter = checkpoint.encounterConfig;

    // Load the map into MapBridgeService (same as prepareEncounter)
    this.encounterService.loadEncounterMap(checkpoint.encounterConfig);

    // Restore RNG state
    if (this.runRng) {
      this.runRng.setState(checkpoint.rngState);
    }

    // Set relics for this encounter
    this.relicService.setActiveRelics(state.relicIds);

    this.isRestoringCheckpoint = true;
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

    this.lastCompletedEncounter = this.currentEncounter;
    this.currentEncounter = null;
    this.eventBus.emit(RunEventType.ENCOUNTER_END, { victory: result.victory });
    this.persist();
    return result;
  }

  // ── Rewards ─────────────────────────────────────────────

  /** Generate reward choices after a victorious encounter. */
  generateRewards(): RewardScreenConfig {
    // Use lastCompletedEncounter — consumePendingEncounterResult() nulls currentEncounter
    // before generateRewards() is called (per run.component.ts handleEncounterReturn ordering).
    const encounter = this.lastCompletedEncounter;
    const rng: () => number = this.runRng ? () => this.runRng!.next() : Math.random;

    const baseGold = encounter?.goldReward ?? 0;

    // Read challenges from the most-recent encounter result (stashed by
    // consumePendingEncounterResult into runState.encounterResults — safe because
    // run.component.ts calls consume() before generateRewards() in handleEncounterReturn).
    const state = this.runState;
    const lastResult = state?.encounterResults[state.encounterResults.length - 1];
    const completedChallenges: readonly ChallengeDefinition[] = lastResult?.completedChallenges ?? [];
    const challengeGold = computeChallengeGoldBonus(completedChallenges);

    const goldPickup = baseGold + challengeGold;

    // Determine relic choice count
    let choiceCount: number = REWARD_CONFIG.relicChoicesCombat;
    if (encounter?.isElite) choiceCount = REWARD_CONFIG.relicChoicesElite;
    if (encounter?.isBoss) choiceCount = REWARD_CONFIG.relicChoicesBoss;

    // Apply ascension relic reduction (FEWER_RELIC_CHOICES stacks additively; floor at 1)
    if (state) {
      const ascEffects = getAscensionEffects(state.ascensionLevel);
      const relicReduction = ascEffects.get(AscensionEffectType.FEWER_RELIC_CHOICES) ?? 0;
      choiceCount = Math.max(1, choiceCount - relicReduction);
    }

    // Pick relics from available pool
    const relicChoices = this.pickRelicRewards(choiceCount, rng);

    // Pick cards weighted by rarity; count respects FEWER_CARD_CHOICES ascension effect
    const cardChoices = this.pickCardRewards(this.computeCardChoiceCount(), rng);

    return {
      goldPickup,
      relicChoices,
      cardChoices,
      bonusRewards: [],
      completedChallenges,
    };
  }

  /**
   * Compute the number of card choices to offer.
   * Baseline 3; reduced by FEWER_CARD_CHOICES at A11+; floored at 1.
   */
  computeCardChoiceCount(): number {
    const state = this.runState;
    const baselineCardChoices = 3;
    if (!state) return baselineCardChoices;
    const ascEffects = getAscensionEffects(state.ascensionLevel);
    const cardReduction = ascEffects.get(AscensionEffectType.FEWER_CARD_CHOICES) ?? 0;
    return Math.max(1, baselineCardChoices - cardReduction);
  }

  private pickCardRewards(count: number, rng: () => number): CardReward[] {
    if (!this.runState) return [];

    // Pool: all non-starter cards grouped by rarity
    const allCards = Object.values(CARD_DEFINITIONS).filter(c => c.rarity !== CardRarity.STARTER);
    const byRarity: Record<CardRarity, typeof allCards> = {
      [CardRarity.STARTER]: [],
      [CardRarity.COMMON]: allCards.filter(c => c.rarity === CardRarity.COMMON),
      [CardRarity.UNCOMMON]: allCards.filter(c => c.rarity === CardRarity.UNCOMMON),
      [CardRarity.RARE]: allCards.filter(c => c.rarity === CardRarity.RARE),
    };

    const rarityWeights: Array<{ rarity: CardRarity; weight: number }> = [
      { rarity: CardRarity.COMMON, weight: REWARD_RARITY_WEIGHTS.common },
      { rarity: CardRarity.UNCOMMON, weight: REWARD_RARITY_WEIGHTS.uncommon },
      { rarity: CardRarity.RARE, weight: REWARD_RARITY_WEIGHTS.rare },
    ];

    const picked: CardReward[] = [];
    for (let i = 0; i < count; i++) {
      const rarity = this.pickWeightedRarity(rarityWeights, byRarity, rng);
      const pool = byRarity[rarity];
      if (pool.length === 0) continue;
      const card = pool[Math.floor(rng() * pool.length)];
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
    const rng: () => number = this.runRng ? () => this.runRng!.next() : Math.random;
    const state = this.runState;
    if (!state) return;

    const items: ShopItem[] = [];

    // Apply ascension price multiplier
    const ascEffects = getAscensionEffects(state.ascensionLevel);
    const priceMultiplier = ascEffects.get(AscensionEffectType.SHOP_PRICE_MULTIPLIER) ?? 1;

    // Relic items — weighted by rarity
    const available = this.relicService.getAvailableRelics();
    const relicByRarity: Record<RelicRarity, RelicDefinition[]> = {
      [RelicRarity.COMMON]: available.filter(r => r.rarity === RelicRarity.COMMON),
      [RelicRarity.UNCOMMON]: available.filter(r => r.rarity === RelicRarity.UNCOMMON),
      [RelicRarity.RARE]: available.filter(r => r.rarity === RelicRarity.RARE),
    };
    const relicRarityWeights: Array<{ rarity: RelicRarity; weight: number }> = [
      { rarity: RelicRarity.COMMON, weight: REWARD_RARITY_WEIGHTS.common },
      { rarity: RelicRarity.UNCOMMON, weight: REWARD_RARITY_WEIGHTS.uncommon },
      { rarity: RelicRarity.RARE, weight: REWARD_RARITY_WEIGHTS.rare },
    ];
    const pickedRelicIds = new Set<RelicId>();
    for (let i = 0; i < SHOP_CONFIG.relicsInShop; i++) {
      const remaining: Record<RelicRarity, RelicDefinition[]> = {
        [RelicRarity.COMMON]: relicByRarity[RelicRarity.COMMON].filter(r => !pickedRelicIds.has(r.id)),
        [RelicRarity.UNCOMMON]: relicByRarity[RelicRarity.UNCOMMON].filter(r => !pickedRelicIds.has(r.id)),
        [RelicRarity.RARE]: relicByRarity[RelicRarity.RARE].filter(r => !pickedRelicIds.has(r.id)),
      };
      const rarity = this.pickWeightedRelicRarity(relicRarityWeights, remaining, rng);
      const pool = remaining[rarity];
      if (pool.length === 0) continue;
      const relic = pool[Math.floor(rng() * pool.length)];
      pickedRelicIds.add(relic.id);
      const basePrice = SHOP_CONFIG.priceByRarity[relic.rarity];
      items.push({
        item: { type: 'relic', relicId: relic.id },
        cost: Math.round(basePrice * priceMultiplier),
      });
    }

    // Card items — weighted by rarity
    const allCards = Object.values(CARD_DEFINITIONS).filter(c => c.rarity !== CardRarity.STARTER);
    const cardByRarity: Record<CardRarity, typeof allCards> = {
      [CardRarity.STARTER]: [],
      [CardRarity.COMMON]: allCards.filter(c => c.rarity === CardRarity.COMMON),
      [CardRarity.UNCOMMON]: allCards.filter(c => c.rarity === CardRarity.UNCOMMON),
      [CardRarity.RARE]: allCards.filter(c => c.rarity === CardRarity.RARE),
    };
    const cardRarityWeights: Array<{ rarity: CardRarity; weight: number }> = [
      { rarity: CardRarity.COMMON, weight: REWARD_RARITY_WEIGHTS.common },
      { rarity: CardRarity.UNCOMMON, weight: REWARD_RARITY_WEIGHTS.uncommon },
      { rarity: CardRarity.RARE, weight: REWARD_RARITY_WEIGHTS.rare },
    ];
    const pickedCardIds = new Set<CardId>();
    for (let i = 0; i < SHOP_CONFIG.cardsInShop; i++) {
      const remaining: Record<CardRarity, typeof allCards> = {
        [CardRarity.STARTER]: [],
        [CardRarity.COMMON]: cardByRarity[CardRarity.COMMON].filter(c => !pickedCardIds.has(c.id)),
        [CardRarity.UNCOMMON]: cardByRarity[CardRarity.UNCOMMON].filter(c => !pickedCardIds.has(c.id)),
        [CardRarity.RARE]: cardByRarity[CardRarity.RARE].filter(c => !pickedCardIds.has(c.id)),
      };
      const rarity = this.pickWeightedRarity(cardRarityWeights, remaining, rng);
      const pool = remaining[rarity];
      if (pool.length === 0) continue;
      const card = pool[Math.floor(rng() * pool.length)];
      pickedCardIds.add(card.id);
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

    // Gamble: if the outcome has a gamble field, roll rng to determine gold delta.
    let resolvedGoldDelta: number;
    if (outcome.gamble) {
      const rng: () => number = this.runRng ? () => this.runRng!.next() : Math.random;
      const won = rng() < outcome.gamble.winChance;
      resolvedGoldDelta = won ? outcome.gamble.winGoldDelta : outcome.gamble.loseGoldDelta;
    } else {
      resolvedGoldDelta = outcome.goldDelta;
    }

    let newLives = Math.min(state.maxLives, Math.max(0, state.lives + outcome.livesDelta));
    const newGold = Math.max(0, state.gold + resolvedGoldDelta);
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

    const rng: () => number = this.runRng ? () => this.runRng!.next() : Math.random;
    const index = Math.floor(rng() * pool.length);
    this.deckService.removeCard(pool[index].instanceId);
  }

  /** Generate a random event for the current node. */
  generateEvent(): void {
    const rng: () => number = this.runRng ? () => this.runRng!.next() : Math.random;
    const events = RUN_EVENTS;
    const index = Math.floor(rng() * events.length);
    this.currentEvent = events[index];
  }

  /** Reveal an unknown node type (used for UNKNOWN nodes). */
  revealUnknownNode(nodeId: string): NodeType {
    const map = this.nodeMap;
    if (!map) return NodeType.COMBAT;

    const rng: () => number = this.runRng ? () => this.runRng!.next() : Math.random;
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

    // Group available relics by rarity
    const byRarity: Record<RelicRarity, RelicDefinition[]> = {
      [RelicRarity.COMMON]: available.filter(r => r.rarity === RelicRarity.COMMON),
      [RelicRarity.UNCOMMON]: available.filter(r => r.rarity === RelicRarity.UNCOMMON),
      [RelicRarity.RARE]: available.filter(r => r.rarity === RelicRarity.RARE),
    };

    const rarityWeights: Array<{ rarity: RelicRarity; weight: number }> = [
      { rarity: RelicRarity.COMMON, weight: REWARD_RARITY_WEIGHTS.common },
      { rarity: RelicRarity.UNCOMMON, weight: REWARD_RARITY_WEIGHTS.uncommon },
      { rarity: RelicRarity.RARE, weight: REWARD_RARITY_WEIGHTS.rare },
    ];

    // Track already-picked relic IDs for this draw to avoid duplicates
    const pickedIds = new Set<RelicId>();
    const result: Array<{ type: 'relic'; relicId: RelicId }> = [];

    for (let i = 0; i < count; i++) {
      // Rebuild byRarity without already-picked relics for this slot
      const remaining: Record<RelicRarity, RelicDefinition[]> = {
        [RelicRarity.COMMON]: byRarity[RelicRarity.COMMON].filter(r => !pickedIds.has(r.id)),
        [RelicRarity.UNCOMMON]: byRarity[RelicRarity.UNCOMMON].filter(r => !pickedIds.has(r.id)),
        [RelicRarity.RARE]: byRarity[RelicRarity.RARE].filter(r => !pickedIds.has(r.id)),
      };

      const rarity = this.pickWeightedRelicRarity(rarityWeights, remaining, rng);
      const pool = remaining[rarity];
      if (pool.length === 0) continue;
      const relic = pool[Math.floor(rng() * pool.length)];
      pickedIds.add(relic.id);
      result.push({ type: 'relic' as const, relicId: relic.id });
    }

    return result;
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

  /**
   * Select a rarity tier using weighted random selection (card pool).
   * Falls back to the next-lower rarity when the chosen tier is empty,
   * rather than leaving the slot blank.
   */
  private pickWeightedRarity(
    weights: Array<{ rarity: CardRarity; weight: number }>,
    pool: Record<CardRarity, Array<{ rarity: CardRarity }>>,
    rng: () => number,
  ): CardRarity {
    const available = weights.filter(w => pool[w.rarity].length > 0);
    if (available.length === 0) return CardRarity.COMMON; // safety valve
    const total = available.reduce((sum, w) => sum + w.weight, 0);
    let roll = rng() * total;
    for (const entry of available) {
      roll -= entry.weight;
      if (roll < 0) return entry.rarity;
    }
    return available[available.length - 1].rarity;
  }

  /**
   * Select a rarity tier using weighted random selection (relic pool).
   * Falls back to the next non-empty tier rather than leaving the slot blank.
   */
  private pickWeightedRelicRarity(
    weights: Array<{ rarity: RelicRarity; weight: number }>,
    pool: Record<RelicRarity, RelicDefinition[]>,
    rng: () => number,
  ): RelicRarity {
    const available = weights.filter(w => pool[w.rarity].length > 0);
    if (available.length === 0) return RelicRarity.COMMON; // safety valve
    const total = available.reduce((sum, w) => sum + w.weight, 0);
    let roll = rng() * total;
    for (const entry of available) {
      roll -= entry.weight;
      if (roll < 0) return entry.rarity;
    }
    return available[available.length - 1].rarity;
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
