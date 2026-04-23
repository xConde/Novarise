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
  ItemReward,
} from '../models/encounter.model';
import { ItemType } from '../models/item.model';
import { ChallengeDefinition, computeChallengeGoldBonus } from '../data/challenges';
import { RelicId, RelicRarity, RelicDefinition } from '../models/relic.model';
import { AscensionEffectType, getAscensionEffects } from '../models/ascension.model';
import {
  ARCHETYPE_CARD_BIAS_CHANCE,
  RELIC_EFFECT_CONFIG,
  REWARD_CONFIG,
  REWARD_RARITY_WEIGHTS,
  REST_CONFIG,
  RUN_CONFIG,
  SHOP_CONFIG,
  ITEM_CONFIG,
  UNKNOWN_NODE_REVEAL_THRESHOLDS,
  SeededRng,
  createSeededRng,
} from '../constants/run.constants';

import { NodeMapGeneratorService } from './node-map-generator.service';
import { EncounterService } from './encounter.service';
import { RelicService } from './relic.service';
import { DeckService } from './deck.service';
import { ItemService } from './item.service';
import { RunStateFlagService } from './run-state-flag.service';
import { RunPersistenceService } from './run-persistence.service';
import { RunEventBusService, RunEventType } from './run-event-bus.service';
import { RUN_EVENTS } from '../constants/run-events';
import { PlayerProfileService } from '../../core/services/player-profile.service';
import { SeenCardsService } from '../../core/services/seen-cards.service';
import { getStarterDeck, CARD_DEFINITIONS } from '../constants/card-definitions';
import { CardArchetype, CardDefinition, CardId, CardInstance, CardRarity } from '../models/card.model';
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

  /**
   * Last dominant archetype surfaced on a reward screen this run. Null before
   * the first reward screen or after run teardown. Drives the chip flip
   * animation: the next generateRewards() compares current vs this and passes
   * the delta through RewardScreenConfig.previousDominantArchetype.
   */
  private lastShownDominantArchetype: CardArchetype | null = null;

  constructor(
    private nodeMapGenerator: NodeMapGeneratorService,
    private encounterService: EncounterService,
    private relicService: RelicService,
    private deckService: DeckService,
    private itemService: ItemService,
    private runStateFlagService: RunStateFlagService,
    private persistence: RunPersistenceService,
    private eventBus: RunEventBusService,
    private playerProfile: PlayerProfileService,
    private encounterCheckpointService: EncounterCheckpointService,
    private seenCards: SeenCardsService,
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

  /**
   * Phase 1 closer (Finding 3) — public bridge to the seeded run RNG.
   * Returns a [0, 1) random number from the run PRNG when one is active,
   * else falls back to {@link Math.random}. Used by component-scoped services
   * (e.g. CardPlayService) that need deterministic randomness without exposing
   * the SeededRng instance itself. Calling this advances the run PRNG state.
   */
  nextRandom(): number {
    return this.runRng ? this.runRng.next() : Math.random();
  }

  private getRng(): () => number {
    return this.runRng ? () => this.runRng!.next() : Math.random;
  }

  // ── Run Lifecycle ───────────────────────────────────────

  /** Start a new run with a fresh seed. */
  startNewRun(ascensionLevel = 0): void {
    this.persistence.clearSavedRun();
    this.relicService.clearRelics();
    this.itemService.resetForRun();
    this.runStateFlagService.resetForRun();

    // Clear any checkpoint leftover from a previous run before starting fresh.
    this.encounterCheckpointService.clearCheckpoint();

    // Ensure all transient run state is cleared before starting fresh
    // (guards against re-using stale state if a previous run ended mid-flight)
    this.currentEncounter = null;
    this.pendingResult = null;
    this.shopItems = [];
    this.currentEvent = null;
    this.runRng = null;
    this.lastShownDominantArchetype = null;

    const seed = Date.now();
    const config = this.applyAscensionToConfig(DEFAULT_RUN_CONFIG, ascensionLevel);
    const starterDeck = getStarterDeck();
    const state = createInitialRunState(seed, config, ascensionLevel);
    const stateWithDeck = { ...state, deckCardIds: starterDeck };

    this.runRng = createSeededRng(seed);
    this.updateState(stateWithDeck);

    // Initialize the deck service with the starter deck
    this.deckService.initializeDeck(starterDeck, seed);

    // Grant a starting relic. At A18+ (STARTING_RELIC_DOWNGRADE > 0), restrict
    // the pick to COMMON relics only; otherwise pick from the full pool.
    this.grantStartingRelic(ascensionLevel);

    // Generate act 1 map (pass ascension level so map-gen effects apply)
    const map = this.nodeMapGenerator.generateActMap(0, seed, ascensionLevel);
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

    // Restore item inventory and run-state flags. Guard with presence check for
    // backward compat — saves made before H5 lack these fields.
    if (state.itemInventory) {
      this.itemService.restore(state.itemInventory);
    }
    if (state.runStateFlags) {
      this.runStateFlagService.restore(state.runStateFlags);
    }
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
    const rng = this.getRng();

    const baseGold = encounter?.goldReward ?? 0;

    // Read challenges from the most-recent encounter result (stashed by
    // consumePendingEncounterResult into runState.encounterResults — safe because
    // run.component.ts calls consume() before generateRewards() in handleEncounterReturn).
    const state = this.runState;
    const lastResult = state?.encounterResults[state.encounterResults.length - 1];
    const completedChallenges: readonly ChallengeDefinition[] = lastResult?.completedChallenges ?? [];
    const challengeGold = computeChallengeGoldBonus(completedChallenges);

    const goldPickup = baseGold + challengeGold;

    // Determine relic choice count based on encounter type.
    // Combat: no relic. Elite/Boss: exactly 1 relic.
    // FEWER_RELIC_CHOICES ascension only reduces when baseline >= 2 — with a
    // baseline of 1 the floor at 1 is a no-op (by design; elite/boss always
    // grant at least 1 relic regardless of ascension).
    let relicCount: number = REWARD_CONFIG.relicChoicesCombat;
    if (encounter?.isElite) relicCount = REWARD_CONFIG.relicChoicesElite;
    if (encounter?.isBoss) relicCount = REWARD_CONFIG.relicChoicesBoss;

    if (relicCount > 0 && state) {
      const ascEffects = getAscensionEffects(state.ascensionLevel);
      const relicReduction = ascEffects.get(AscensionEffectType.FEWER_RELIC_CHOICES) ?? 0;
      relicCount = Math.max(1, relicCount - relicReduction);
    }

    // Pick relics from available pool (skip call entirely when 0 relics due).
    const relicChoices = relicCount > 0 ? this.pickRelicRewards(relicCount, rng) : [];

    // Determine card choice count based on encounter type.
    // Boss: no card pick. Combat/Elite: use computeCardChoiceCount() which
    // respects the FEWER_CARD_CHOICES ascension effect.
    let cardCount: number = REWARD_CONFIG.cardChoicesCombat;
    if (encounter?.isElite) cardCount = REWARD_CONFIG.cardChoicesElite;
    if (encounter?.isBoss) cardCount = REWARD_CONFIG.cardChoicesBoss;

    // Pick cards weighted by rarity (skip call entirely when 0 cards due).
    const cardChoices = cardCount > 0 ? this.pickCardRewards(this.computeCardChoiceCount(cardCount), rng) : [];

    // Phase 2 Sprint 10.5 — snapshot the dominant archetype at reward-
    // generation time so the chip reflects the state that shaped the pool.
    // Reading from DeckService live at render time would desync after a
    // card pick (new card shifts the dominant archetype while the screen
    // is still showing the pre-pick rewards).
    const dominantArchetype = this.deckService.getDominantArchetype();
    // Phase 3 prep — pass the prior screen's archetype through so the chip
    // can fire a flip animation when the player transitions archetypes
    // between rewards. Null on the first reward screen of a run.
    const previousDominantArchetype = this.lastShownDominantArchetype;
    this.lastShownDominantArchetype = dominantArchetype;

    return {
      goldPickup,
      relicChoices,
      cardChoices,
      bonusRewards: [],
      completedChallenges,
      nodeType: encounter?.nodeType ?? NodeType.COMBAT,
      dominantArchetype,
      previousDominantArchetype,
    };
  }

  /**
   * Compute the number of card choices to offer.
   * Baseline defaults to REWARD_CONFIG.cardChoicesCombat (3).
   * Reduced by FEWER_CARD_CHOICES at A11+; floored at 1.
   */
  computeCardChoiceCount(baseline: number = REWARD_CONFIG.cardChoicesCombat): number {
    const state = this.runState;
    if (!state) return baseline;
    const ascEffects = getAscensionEffects(state.ascensionLevel);
    const cardReduction = ascEffects.get(AscensionEffectType.FEWER_CARD_CHOICES) ?? 0;
    return Math.max(1, baseline - cardReduction);
  }

  private pickCardRewards(count: number, rng: () => number): CardReward[] {
    if (!this.runState) return [];

    // Pool: all non-starter cards grouped by rarity
    const byRarity = this.buildNonStarterCardPool();

    const rarityWeights: Array<{ rarity: CardRarity; weight: number }> = [
      { rarity: CardRarity.COMMON, weight: REWARD_RARITY_WEIGHTS.common },
      { rarity: CardRarity.UNCOMMON, weight: REWARD_RARITY_WEIGHTS.uncommon },
      { rarity: CardRarity.RARE, weight: REWARD_RARITY_WEIGHTS.rare },
    ];

    // Phase 1 Sprint 8 — archetype-aware pool. When the deck has a dominant
    // spatial archetype, weight the candidate pool toward that archetype
    // (60% archetype-aligned / 40% neutral). Neutral dominant → no biasing.
    //
    // NOTE: pickCardRewards re-queries getDominantArchetype() so it stays
    // consistent with the rarely-used code paths that call it directly.
    // generateRewards() queries it once separately for the RewardScreenConfig
    // snapshot — both reads hit the same deck state so they agree.
    const dominant = this.deckService.getDominantArchetype();

    const picked: CardReward[] = [];
    for (let i = 0; i < count; i++) {
      const rarity = this.pickWeightedRarity(rarityWeights, byRarity, rng);
      if (rarity === null) continue;
      const pool = byRarity[rarity];
      if (pool.length === 0) continue;
      const card = this.pickArchetypeAwareCard(pool, dominant, rng);
      picked.push({ type: 'card', cardId: card.id });
    }

    // Every offered card counts as seen — QA user wants "what haven't I
    // encountered yet?" not "what did I keep".
    this.seenCards.markSeenMany(picked.map(r => r.cardId));

    return picked;
  }

  /**
   * Phase 1 Sprint 8 — pick a single card from `pool` biased toward the
   * dominant archetype when one is set. Implementation:
   *   - Dominant === 'neutral' → uniform pick across pool.
   *   - Otherwise: 60% chance pick from archetype-tagged subset, 40% neutral
   *     subset. Falls back to uniform when the chosen subset is empty
   *     (e.g. no rare archetype cards exist yet).
   *
   * Re-used from `pickCardRewards` and the card section of `generateShopItems`
   * so both reward surfaces feel coherent during a run.
   */
  private pickArchetypeAwareCard<T extends { archetype?: CardArchetype }>(
    pool: T[],
    dominant: CardArchetype,
    rng: () => number,
  ): T {
    if (dominant === 'neutral' || pool.length === 0) {
      return pool[Math.floor(rng() * pool.length)];
    }

    const archetypeMatches = pool.filter(c => c.archetype === dominant);
    const neutralMatches = pool.filter(c => (c.archetype ?? 'neutral') === 'neutral');
    const wantArchetype = rng() < ARCHETYPE_CARD_BIAS_CHANCE;
    const preferred = wantArchetype ? archetypeMatches : neutralMatches;
    if (preferred.length > 0) {
      return preferred[Math.floor(rng() * preferred.length)];
    }
    // Preferred subset empty → fall back to the other subset, or full pool.
    const fallback = wantArchetype ? neutralMatches : archetypeMatches;
    if (fallback.length > 0) return fallback[Math.floor(rng() * fallback.length)];
    return pool[Math.floor(rng() * pool.length)];
  }

  /** Collect a reward (relic, gold, card, or item). */
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
      case 'item':
        this.itemService.addItem(reward.itemType);
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
      completedNodeIds: this.computeNodeCompletedArray(state),
    });
    this.persist();
  }

  /** Shop: generate shop items for the current node. */
  generateShopItems(): void {
    const rng = this.getRng();
    const state = this.runState;
    if (!state) return;

    const items: ShopItem[] = [];

    // Apply ascension price multiplier and shop slot reduction
    const ascEffects = getAscensionEffects(state.ascensionLevel);
    const priceMultiplier = ascEffects.get(AscensionEffectType.SHOP_PRICE_MULTIPLIER) ?? 1;
    const shopSlotReduction = ascEffects.get(AscensionEffectType.SHOP_SLOT_REDUCTION) ?? 0;
    const relicsInShop = Math.max(0, SHOP_CONFIG.relicsInShop - shopSlotReduction);
    const cardsInShop = Math.max(0, SHOP_CONFIG.cardsInShop - shopSlotReduction);

    // Relic items — weighted by rarity
    const available = this.relicService.getAvailableRelics();
    const relicByRarity = this.buildRelicPool(available);
    const relicRarityWeights: Array<{ rarity: RelicRarity; weight: number }> = [
      { rarity: RelicRarity.COMMON, weight: REWARD_RARITY_WEIGHTS.common },
      { rarity: RelicRarity.UNCOMMON, weight: REWARD_RARITY_WEIGHTS.uncommon },
      { rarity: RelicRarity.RARE, weight: REWARD_RARITY_WEIGHTS.rare },
    ];
    const pickedRelicIds = new Set<RelicId>();
    for (let i = 0; i < relicsInShop; i++) {
      const remaining: Record<RelicRarity, RelicDefinition[]> = {
        [RelicRarity.COMMON]: relicByRarity[RelicRarity.COMMON].filter(r => !pickedRelicIds.has(r.id)),
        [RelicRarity.UNCOMMON]: relicByRarity[RelicRarity.UNCOMMON].filter(r => !pickedRelicIds.has(r.id)),
        [RelicRarity.RARE]: relicByRarity[RelicRarity.RARE].filter(r => !pickedRelicIds.has(r.id)),
      };
      const rarity = this.pickWeightedRarity(relicRarityWeights, remaining, rng);
      if (rarity === null) continue;
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
    const cardByRarity = this.buildNonStarterCardPool();
    const cardRarityWeights: Array<{ rarity: CardRarity; weight: number }> = [
      { rarity: CardRarity.COMMON, weight: REWARD_RARITY_WEIGHTS.common },
      { rarity: CardRarity.UNCOMMON, weight: REWARD_RARITY_WEIGHTS.uncommon },
      { rarity: CardRarity.RARE, weight: REWARD_RARITY_WEIGHTS.rare },
    ];
    const pickedCardIds = new Set<CardId>();
    // Phase 1 Sprint 8 — same archetype-aware selection used by combat rewards.
    const dominant = this.deckService.getDominantArchetype();
    for (let i = 0; i < cardsInShop; i++) {
      const remaining: Record<CardRarity, CardDefinition[]> = {
        [CardRarity.STARTER]: [],
        [CardRarity.COMMON]: cardByRarity[CardRarity.COMMON].filter(c => !pickedCardIds.has(c.id)),
        [CardRarity.UNCOMMON]: cardByRarity[CardRarity.UNCOMMON].filter(c => !pickedCardIds.has(c.id)),
        [CardRarity.RARE]: cardByRarity[CardRarity.RARE].filter(c => !pickedCardIds.has(c.id)),
      };
      const rarity = this.pickWeightedRarity(cardRarityWeights, remaining, rng);
      if (rarity === null) continue;
      const pool = remaining[rarity];
      if (pool.length === 0) continue;
      const card = this.pickArchetypeAwareCard(pool, dominant, rng);
      pickedCardIds.add(card.id);
      this.seenCards.markSeen(card.id);
      const rarityKey = card.rarity as keyof typeof SHOP_CONFIG.priceByRarity;
      const basePrice = SHOP_CONFIG.priceByRarity[rarityKey] ?? SHOP_CONFIG.priceByRarity.common;
      items.push({
        item: { type: 'card', cardId: card.id },
        cost: Math.round(basePrice * priceMultiplier),
      });
    }

    // Item (consumable) slots
    const allItemTypes = Object.values(ItemType);
    for (let i = 0; i < ITEM_CONFIG.shopSlotCount; i++) {
      if (allItemTypes.length === 0) break;
      const itemType = allItemTypes[Math.floor(rng() * allItemTypes.length)];
      const itemReward: ItemReward = { type: 'item', itemType };
      items.push({
        item: itemReward,
        cost: Math.round(ITEM_CONFIG.shopCost * priceMultiplier),
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

  /**
   * Phase 1 Sprint 4 — pay {@link SHOP_CONFIG.cardRemoveCost} gold to permanently
   * remove the named card instance from the deck. Returns true on success.
   *
   * Validation:
   *   - run state must exist
   *   - card must currently exist in any deck pile
   *   - card must NOT be a starter card (StS convention)
   *   - player must have enough gold
   *
   * The shop component enforces one-use-per-visit locally; this method does
   * not, so balance changes can cap usage elsewhere if ever needed.
   */
  removeCardFromShop(instanceId: string): boolean {
    const state = this.runState;
    if (!state) return false;
    if (state.gold < SHOP_CONFIG.cardRemoveCost) return false;

    const allCards = this.deckService.getAllCards();
    const target = allCards.find(c => c.instanceId === instanceId);
    if (!target) return false;

    const def = CARD_DEFINITIONS[target.cardId as CardId];
    if (!def || def.rarity === CardRarity.STARTER) return false;

    const removed = this.deckService.removeCard(instanceId);
    if (!removed) return false;

    // Phase 1 red-team Finding 1: derive deckCardIds from the live deck after
    // removal rather than splicing the persisted array by CardId. The previous
    // approach silently desynced when the player owned duplicates of the same
    // card (indexOf removed the first match, but deck.removeCard removed the
    // specific instance), so on save/restore the wrong copy was preserved and
    // the 75g purchase appeared to refund itself.
    const newDeckCardIds = this.deckService.getAllCards().map(c => c.cardId);

    this.updateState({
      ...state,
      gold: state.gold - SHOP_CONFIG.cardRemoveCost,
      deckCardIds: newDeckCardIds,
    });
    this.persist();
    return true;
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
      const rng = this.getRng();
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

    // Item reward: add to consumable inventory.
    if (outcome.itemReward) {
      this.itemService.addItem(outcome.itemReward);
    }

    // Run state flags: persist cross-event memory within the run.
    if (outcome.setsFlag) {
      this.runStateFlagService.setFlag(outcome.setsFlag);
    }
    if (outcome.incrementsFlag) {
      this.runStateFlagService.incrementFlag(outcome.incrementsFlag);
    }

    // Once-per-run events: mark consumed regardless of which outcome was picked.
    if (event.firesOncePerRun) {
      this.runStateFlagService.markEventConsumed(event.id);
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
      completedNodeIds: this.computeNodeCompletedArray(state),
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

    const rng = this.getRng();
    const index = Math.floor(rng() * pool.length);
    this.deckService.removeCard(pool[index].instanceId);
  }

  /** Generate a random event for the current node. */
  generateEvent(): void {
    const rng = this.getRng();

    // Filter eligible events by run-state flag requirements and once-per-run consumption.
    const eligibleEvents = RUN_EVENTS.filter(e => {
      if (e.requiresFlag !== undefined && !this.runStateFlagService.hasFlag(e.requiresFlag)) {
        return false;
      }
      if (e.requiresFlagAbsent !== undefined && this.runStateFlagService.hasFlag(e.requiresFlagAbsent)) {
        return false;
      }
      if (e.firesOncePerRun && this.runStateFlagService.isEventConsumed(e.id)) {
        return false;
      }
      return true;
    });

    // Fall back to all events if every event is gated (shouldn't happen with current data).
    const pool = eligibleEvents.length > 0 ? eligibleEvents : [...RUN_EVENTS];
    const index = Math.floor(rng() * pool.length);
    this.currentEvent = pool[index];
  }

  /** Reveal an unknown node type (used for UNKNOWN nodes). */
  revealUnknownNode(nodeId: string): NodeType {
    const map = this.nodeMap;
    if (!map) return NodeType.COMBAT;

    const rng = this.getRng();
    const roll = rng();

    // Unknown nodes reveal as: combat (50%), event (25%), shop (15%), rest (10%)
    let revealedType: NodeType;
    if (roll < UNKNOWN_NODE_REVEAL_THRESHOLDS.combat) revealedType = NodeType.COMBAT;
    else if (roll < UNKNOWN_NODE_REVEAL_THRESHOLDS.event) revealedType = NodeType.EVENT;
    else if (roll < UNKNOWN_NODE_REVEAL_THRESHOLDS.shop) revealedType = NodeType.SHOP;
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

    // Generate next act map (pass ascension level so map-gen effects apply)
    const newMap = this.nodeMapGenerator.generateActMap(nextAct, state.seed + nextAct * RUN_CONFIG.actSeedPrime, state.ascensionLevel);
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
    const byRarity = this.buildRelicPool(available);

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

      const rarity = this.pickWeightedRarity(rarityWeights, remaining, rng);
      if (rarity === null) continue;
      const pool = remaining[rarity];
      if (pool.length === 0) continue;
      const relic = pool[Math.floor(rng() * pool.length)];
      pickedIds.add(relic.id);
      result.push({ type: 'relic' as const, relicId: relic.id });
    }

    return result;
  }

  /**
   * Returns a new completedNodeIds array with the current node appended, or the
   * original array if the node is already present (idempotency guard). Safe to
   * embed directly inside an updateState() spread to avoid a second emission.
   */
  private computeNodeCompletedArray(state: RunState): string[] {
    const id = state.currentNodeId;
    if (!id || state.completedNodeIds.includes(id)) return state.completedNodeIds;
    return [...state.completedNodeIds, id];
  }

  private markCurrentNodeCompleted(): void {
    const state = this.runState;
    if (!state) return;
    const updated = this.computeNodeCompletedArray(state);
    if (updated === state.completedNodeIds) return; // already present — no-op
    this.updateState({ ...state, completedNodeIds: updated });
    this.persist();
  }

  /**
   * A18+ forces the player to accept a random COMMON-rarity starting relic as
   * a penalty (the "downgrade" — you lose the option of a clean empty slate).
   * Pre-A18 runs start with zero relics, preserving historical behavior.
   */
  private grantStartingRelic(ascensionLevel: number): void {
    const ascEffects = getAscensionEffects(ascensionLevel);
    const downgrade = ascEffects.get(AscensionEffectType.STARTING_RELIC_DOWNGRADE) ?? 0;
    if (downgrade <= 0) return;

    const rng = this.getRng();
    const pool = this.relicService.getAvailableRelics(RelicRarity.COMMON);
    if (pool.length === 0) return;

    const relic = pool[Math.floor(rng() * pool.length)];
    this.addRelic(relic.id);
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
    if (!state || !map) return;
    const stateToSave: RunState = {
      ...state,
      itemInventory: this.itemService.serialize(),
      runStateFlags: this.runStateFlagService.serialize(),
    };
    this.persistence.saveRunState(stateToSave, map);
  }

  /**
   * Select a rarity tier using weighted random selection.
   * Returns null when every tier in the pool is empty (all slots exhausted).
   * Callers must handle null — skip the slot rather than leaving it blank.
   */
  private pickWeightedRarity<R extends string>(
    weights: Array<{ rarity: R; weight: number }>,
    pool: Record<R, unknown[]>,
    rng: () => number,
  ): R | null {
    const available = weights.filter(w => pool[w.rarity].length > 0);
    if (available.length === 0) return null;
    const total = available.reduce((sum, w) => sum + w.weight, 0);
    let roll = rng() * total;
    for (const entry of available) {
      roll -= entry.weight;
      if (roll < 0) return entry.rarity;
    }
    return available[available.length - 1].rarity;
  }

  /**
   * Build a pool of all non-starter cards grouped by rarity.
   * STARTER bucket is always empty — it exists only to satisfy the
   * Record<CardRarity, …> shape so callers can index by any rarity key.
   */
  private buildNonStarterCardPool(): Record<CardRarity, CardDefinition[]> {
    const pool = Object.values(CARD_DEFINITIONS).filter(c => c.rarity !== CardRarity.STARTER);
    return {
      [CardRarity.STARTER]: [],
      [CardRarity.COMMON]: pool.filter(c => c.rarity === CardRarity.COMMON),
      [CardRarity.UNCOMMON]: pool.filter(c => c.rarity === CardRarity.UNCOMMON),
      [CardRarity.RARE]: pool.filter(c => c.rarity === CardRarity.RARE),
    };
  }

  /**
   * Build a pool of relics grouped by rarity from the provided source array.
   * Accepts a pre-filtered list (e.g. from RelicService.getAvailableRelics())
   * so callers control the source of truth.
   */
  private buildRelicPool(source: RelicDefinition[]): Record<RelicRarity, RelicDefinition[]> {
    return {
      [RelicRarity.COMMON]: source.filter(r => r.rarity === RelicRarity.COMMON),
      [RelicRarity.UNCOMMON]: source.filter(r => r.rarity === RelicRarity.UNCOMMON),
      [RelicRarity.RARE]: source.filter(r => r.rarity === RelicRarity.RARE),
    };
  }

  private cleanup(): void {
    this.persistence.clearSavedRun();
    this.currentEncounter = null;
    this.pendingResult = null;
    this.shopItems = [];
    this.currentEvent = null;
    this.runRng = null;
    this.lastShownDominantArchetype = null;
    this.relicService.clearRelics();
    this.deckService.clear();
    this.itemService.resetForRun();
    this.runStateFlagService.resetForRun();
  }
}
