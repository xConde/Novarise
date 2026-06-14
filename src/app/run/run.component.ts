import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { RunService } from './services/run.service';
import { EncounterCheckpointService } from './services/encounter-checkpoint.service';
import { RunPersistenceService } from './services/run-persistence.service';
import { MusicService } from '../core/services/music.service';
import { RunState, RunStatus } from './models/run-state.model';
import { MapNode, NodeMap, NodeType, getSelectableNodes } from './models/node-map.model';
import { RelicDefinition, RELIC_DEFINITIONS, RelicId } from './models/relic.model';
import { RewardScreenConfig, RewardItem, ShopItem, RunEvent } from './models/encounter.model';
import { CardInstance } from './models/card.model';

/**
 * Run Hub root component (M1 S7 rebranded from "Ascent Mode").
 *
 * Manages three views inline (no child routes):
 * 1. Node map — path selection between encounters
 * 2. Reward screen — shown after combat victory
 * 3. Run summary — shown on run end (victory/defeat)
 *
 * Combat encounters delegate to GameBoardComponent via navigation to /play.
 */
@Component({
  selector: 'app-run',
  templateUrl: './run.component.html',
  styleUrls: ['./run.component.scss'],
})
export class RunComponent implements OnInit, OnDestroy {
  /** Current run state, updated reactively. */
  runState: RunState | null = null;

  /** Current act's node map. */
  nodeMap: NodeMap | null = null;

  /** Nodes available for selection (one step ahead). */
  availableNodes: MapNode[] = [];

  /** Active relics for display. */
  activeRelics: RelicDefinition[] = [];

  /** Current view mode. */
  viewMode: 'map' | 'reward' | 'shop' | 'rest' | 'event' | 'act-transition' | 'epilogue' | 'summary' = 'map';

  /**
   * The ascension level that was just unlocked by this run's victory.
   * Set when transitioning to 'epilogue'. 0 when no new level was unlocked
   * (the player's persisted max already exceeded this run's level + 1).
   */
  epilogueUnlockedAscension = 0;

  /**
   * The BossPreset id of the final-act boss defeated in this run.
   * Selects the matching epilogue copy variant. '' produces the neutral fallback.
   */
  get finalBossPresetId(): string {
    return this.runService.getFinalBossPresetId();
  }

  /** Ascension high-water mark captured at init, before any advanceAct(). */
  private priorMaxAscension = 0;

  /** Boss preset name for the act-transition screen. */
  actTransitionBossName = '';

  /** Reward screen config, set after combat victory. */
  rewardConfig: RewardScreenConfig | null = null;

  private subscriptions = new Subscription();

  readonly NodeType = NodeType;

  /** Live-scaled card-remove cost — recomputed via getter so ascension price multiplier flows through. */
  get cardRemoveCost(): number {
    return this.runService.getCardRemoveCost();
  }

  /** Live-scaled card-upgrade cost — recomputed via getter so ascension price multiplier flows through. */
  get cardUpgradeCost(): number {
    return this.runService.getCardUpgradeCost();
  }

  constructor(
    private runService: RunService,
    private router: Router,
    private encounterCheckpointService: EncounterCheckpointService,
    private musicService: MusicService,
    private runPersistence: RunPersistenceService,
  ) {}

  ngOnInit(): void {
    this.musicService.playTheme('hub');
    // Snapshot the pre-run ascension high-water mark so showEpilogue() can
    // tell whether THIS victory unlocked a new level. advanceAct() updates
    // the persisted max before showEpilogue() runs, so reading it later
    // would always equal the new value.
    this.priorMaxAscension = this.runPersistence.getMaxAscension();
    this.subscriptions.add(
      this.runService.runState$.subscribe(state => {
        this.runState = state;
        if (state) {
          this.updateRelicDisplay(state.relicIds);
          this.updateAvailableNodes();
        }
      }),
    );

    this.subscriptions.add(
      this.runService.nodeMap$.subscribe(map => {
        this.nodeMap = map;
        this.updateAvailableNodes();
      }),
    );

    // Check if returning from an encounter
    if (this.runService.hasPendingEncounterResult()) {
      this.handleEncounterReturn();
    } else if (this.runService.hasActiveRun()) {
      this.viewMode = 'map';
    } else {
      // No active run — redirect to main menu instead of showing start screen
      this.router.navigate(['/']);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /** Start a new run with default config. */
  startNewRun(ascensionLevel = 0): void {
    this.runService.startNewRun(ascensionLevel);
    this.viewMode = 'map';
  }

  /** Select a node on the map to visit next. */
  selectNode(node: MapNode): void {
    if (!this.isNodeSelectable(node)) return;

    this.runService.selectNode(node.id);

    switch (node.type) {
      case NodeType.COMBAT:
      case NodeType.ELITE:
      case NodeType.BOSS:
        this.startEncounter(node);
        break;
      case NodeType.REST:
        this.viewMode = 'rest';
        break;
      case NodeType.SHOP:
        this.runService.generateShopItems();
        this.refreshShopDeckSnapshot();
        this.viewMode = 'shop';
        break;
      case NodeType.EVENT:
        this.runService.generateEvent();
        this.eventRemovedCardName = null;
        this.viewMode = 'event';
        break;
      case NodeType.UNKNOWN:
        // Reveal the node type and handle accordingly
        this.handleUnknownNode(node);
        break;
    }
  }

  /** Navigate to /play to start (or restore) a combat encounter. */
  startEncounter(node: MapNode): void {
    const checkpointNodeId = this.encounterCheckpointService.getCheckpointNodeId();
    if (checkpointNodeId === node.id) {
      // Resume from checkpoint — loads encounter config and sets restore flag
      this.runService.restoreEncounter();
    } else {
      // Fresh encounter — clear any stale checkpoint and prepare normally
      this.runService.prepareEncounter(node);
    }
    this.router.navigate(['/play']);
  }

  /**
   * Launch an endless post-victory encounter.
   * Prepares an endless EncounterConfig (reusing the final boss map) and
   * navigates to /play. The run stays in-progress; the game-board uses its
   * normal single code path with endless mode enabled at bootstrap.
   * Defeat in endless returns to /run without corrupting run state because
   * RunService.recordEncounterResult() only records the result — the run
   * status is already VICTORY and consumePendingEncounterResult() guards
   * against double-processing a non-IN_PROGRESS run.
   */
  launchEndless(): void {
    this.runService.prepareEndlessEncounter();
    this.router.navigate(['/play']);
  }

  /** Handle return from /play after encounter completion. */
  handleEncounterReturn(): void {
    const result = this.runService.consumePendingEncounterResult();
    if (!result) {
      // No processable result — this happens when the run is already in a
      // terminal state (e.g. returning from an endless encounter after a
      // post-victory run). Show the summary rather than leaving viewMode
      // undefined or navigating away unexpectedly.
      if (this.runState) {
        this.viewMode = 'summary';
      } else {
        this.router.navigate(['/']);
      }
      return;
    }

    if (result.victory) {
      this.rewardConfig = this.runService.generateRewards();
      this.viewMode = 'reward';
    } else {
      this.viewMode = 'summary';
    }
  }

  /** Collect a reward from the reward screen. */
  collectReward(reward: RewardItem): void {
    this.runService.collectReward(reward);
  }

  /** Close reward screen and return to map (or show act-transition if act is complete). */
  closeRewardScreen(): void {
    this.rewardConfig = null;

    if (this.runService.isActComplete()) {
      const state = this.runState;
      if (state && state.actIndex + 1 < state.config.actsCount) {
        // More acts remain — show act-transition screen before advancing
        this.actTransitionBossName = this.runService.getBossName(state.actIndex, state.seed);
        this.viewMode = 'act-transition';
        return;
      }
      // No more acts — advance triggers VICTORY
      this.runService.advanceAct();
    }

    if (this.runState?.status === RunStatus.VICTORY) {
      this.showEpilogue();
    } else {
      this.viewMode = 'map';
    }
  }

  /** Continue after act-transition screen. */
  onActTransitionContinued(): void {
    this.runService.advanceAct();
    if (this.runState?.status === RunStatus.VICTORY) {
      this.showEpilogue();
    } else {
      this.viewMode = 'map';
    }
  }

  /** Transition to the victory epilogue screen. Stops music for dramatic silence. */
  showEpilogue(): void {
    // advanceAct() calls setMaxAscension(ascensionLevel + 1) — a high-water
    // mark. Only announce an unlock when this run actually raised it; a
    // victory at an ascension below the player's existing max unlocks nothing.
    const candidate = (this.runState?.ascensionLevel ?? 0) + 1;
    this.epilogueUnlockedAscension = candidate > this.priorMaxAscension ? candidate : 0;
    this.musicService.stopMusic(2.0);
    this.viewMode = 'epilogue';
  }

  /** Continue from epilogue to run summary. */
  onEpilogueContinued(): void {
    this.viewMode = 'summary';
  }

  /** Rest: heal lives. */
  restHeal(): void {
    this.runService.restHeal();
    this.viewMode = 'map';
  }

  /** Returns all card instances across the deck for rest-screen upgrade selection. */
  getDeckCards(): CardInstance[] {
    return this.runService.getDeckCards();
  }

  /**
   * Memoized snapshot of the current deck for the shop card-removal picker.
   * Refreshed only when entering the shop or after a successful removal — NOT
   * via a per-CD-tick method-call binding. A per-tick getter would allocate a
   * new array every change-detection cycle, firing ngOnChanges on ShopScreenComponent
   * and resetting its one-use card-remove slot.
   */
  shopDeckSnapshot: CardInstance[] = [];

  private refreshShopDeckSnapshot(): void {
    this.shopDeckSnapshot = this.runService.getDeckCards();
  }

  /** Handle card upgrade selection from rest screen — applies the upgrade but stays on rest screen to show confirmation. */
  onCardUpgraded(instanceId: string): void {
    this.runService.upgradeCard(instanceId);
  }

  /** Handle the player dismissing the upgrade confirmation — now transition to the map. */
  onUpgradeConfirmed(): void {
    this.viewMode = 'map';
  }

  /** Complete event choice. Routes to summary if the event drained the last life. */
  completeEvent(choiceIndex: number): void {
    this.eventRemovedCardName = this.runService.resolveEvent(choiceIndex);
    this.eventGambleResult = null;
    if (this.runState?.status === RunStatus.DEFEAT) {
      this.viewMode = 'summary';
    } else {
      this.viewMode = 'map';
    }
  }

  /** Buy item from shop. */
  buyShopItem(index: number): void {
    this.runService.buyShopItem(index);
  }

  /**
   * Unified shop buy handler for ShopScreenComponent.
   * index === -1 is the heal-purchase signal.
   */
  onShopBuy(index: number): void {
    if (index === -1) {
      this.runService.buyShopHeal();
    } else {
      this.runService.buyShopItem(index);
    }
  }

  /** Current shop items exposed for ShopScreenComponent binding. */
  get shopItems(): ShopItem[] {
    return this.runService.getShopItems();
  }

  /** Current event exposed for EventScreenComponent binding. */
  get currentEvent(): RunEvent | null {
    return this.runService.getCurrentEvent();
  }

  /** Seeded gamble preview result — set synchronously when the player picks a gamble choice. */
  eventGambleResult: { goldDelta: number; livesDelta: number } | null = null;

  /** Name of the card removed by the last event outcome; null when no card was removed. */
  eventRemovedCardName: string | null = null;

  /** Called by EventScreenComponent when the player picks a gamble choice. Rolls once via seeded RNG. */
  onPreviewGamble(index: number): void {
    this.eventGambleResult = this.runService.previewEventGamble(index);
  }

  /** Called by EventScreenComponent when the player picks a choice with a removeCard outcome. */
  onPreviewCardRemoval(index: number): void {
    this.eventRemovedCardName = this.runService.previewEventCardRemoval(index);
  }

  /** Leave shop, return to map. */
  leaveShop(): void {
    this.runService.leaveShop();
    this.viewMode = 'map';
  }

  /**
   * Handle the shop card-remove action. ShopScreenComponent is the source of truth
   * for one-use-per-visit enforcement; this delegates to the service and stays on
   * the shop screen.
   */
  onShopCardRemoved(instanceId: string): void {
    this.runService.removeCardFromShop(instanceId);
    // Refresh snapshot so subsequent UI surfaces (resume from shop later, etc.)
    // see the post-removal state. Does NOT trigger ShopScreen.ngOnChanges
    // shopItems reset path — only the deckCards reference changes.
    this.refreshShopDeckSnapshot();
  }

  /** Handle the shop card-upgrade action. ShopScreen enforces one-use-per-visit locally. */
  onShopCardUpgraded(instanceId: string): void {
    this.runService.upgradeCardFromShop(instanceId);
    // Refresh snapshot so the upgrade immediately reflects in the picker and
    // any subsequent UI surfaces without triggering the shopItems reset path.
    this.refreshShopDeckSnapshot();
  }

  /** Calculate heal amount for rest site — includes ascension REST_HEAL_REDUCTION. */
  getHealAmount(): number {
    if (!this.runState) return 0;
    return this.runService.computeHealAmount(this.runState);
  }

  /** Save run and return to landing. */
  exitRun(): void {
    this.router.navigate(['/']);
  }

  /** Return to landing after run ends. */
  returnToMenu(): void {
    this.router.navigate(['/']);
  }

  isNodeSelectable(node: MapNode): boolean {
    return this.availableNodes.some(n => n.id === node.id);
  }

  private updateRelicDisplay(relicIds: string[]): void {
    this.activeRelics = relicIds
      .map(id => RELIC_DEFINITIONS[id as RelicId])
      .filter((r): r is RelicDefinition => r !== undefined);
  }

  private updateAvailableNodes(): void {
    if (!this.nodeMap || !this.runState) {
      this.availableNodes = [];
      return;
    }

    this.availableNodes = getSelectableNodes(
      this.nodeMap,
      this.runState.currentNodeId,
      this.runState.completedNodeIds,
    );
  }

  getTotalKills(): number {
    if (!this.runState) return 0;
    return this.runState.encounterResults.reduce((sum, r) => sum + r.enemiesKilled, 0);
  }

  private handleUnknownNode(node: MapNode): void {
    const revealedType = this.runService.revealUnknownNode(node.id);
    switch (revealedType) {
      case NodeType.COMBAT:
      case NodeType.ELITE:
        this.startEncounter(node);
        break;
      case NodeType.REST:
        this.viewMode = 'rest';
        break;
      case NodeType.SHOP:
        this.runService.generateShopItems();
        this.refreshShopDeckSnapshot();
        this.viewMode = 'shop';
        break;
      case NodeType.EVENT:
        this.runService.generateEvent();
        this.eventRemovedCardName = null;
        this.viewMode = 'event';
        break;
      default:
        this.startEncounter(node);
        break;
    }
  }
}
