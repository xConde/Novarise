import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { RunService } from './services/run.service';
import { RunState, RunStatus } from './models/run-state.model';
import { MapNode, NodeMap, NodeType, getAvailableNodes } from './models/node-map.model';
import { RelicDefinition, RELIC_DEFINITIONS, RelicId } from './models/relic.model';
import { RewardScreenConfig, RewardItem, ShopItem, RunEvent } from './models/encounter.model';
import { AscensionLevel, ASCENSION_LEVELS } from './models/ascension.model';
import { REST_CONFIG } from './constants/ascent.constants';
import { CardInstance } from './models/card.model';

/**
 * Ascent Mode root component.
 *
 * Manages three views inline (no child routes):
 * 1. Node map — path selection between encounters
 * 2. Reward screen — shown after combat victory
 * 3. Run summary — shown on run end (victory/defeat)
 *
 * Combat encounters delegate to GameBoardComponent via navigation to /play.
 */
@Component({
  selector: 'app-ascent',
  templateUrl: './ascent.component.html',
  styleUrls: ['./ascent.component.scss'],
})
export class AscentComponent implements OnInit, OnDestroy {
  /** Current run state, updated reactively. */
  runState: RunState | null = null;

  /** Current act's node map. */
  nodeMap: NodeMap | null = null;

  /** Nodes available for selection (one step ahead). */
  availableNodes: MapNode[] = [];

  /** Active relics for display. */
  activeRelics: RelicDefinition[] = [];

  /** Current view mode. */
  viewMode: 'start' | 'map' | 'reward' | 'shop' | 'rest' | 'event' | 'act-transition' | 'summary' = 'start';

  /** Boss preset name for the act-transition screen. */
  actTransitionBossName = '';

  /** Currently selected ascension level in the start screen selector. */
  selectedAscension = 0;

  /** All ascension levels the player has unlocked (up to maxAscension). */
  get ascensionLevelOptions(): AscensionLevel[] {
    return ASCENSION_LEVELS.slice(0, this.maxAscension);
  }

  /** Reward screen config, set after combat victory. */
  rewardConfig: RewardScreenConfig | null = null;

  private subscriptions = new Subscription();

  readonly NodeType = NodeType;

  constructor(
    private runService: RunService,
    private router: Router,
  ) {}

  ngOnInit(): void {
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

  /** Resume an in-progress run from localStorage. */
  resumeRun(): void {
    this.runService.resumeRun();
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
        this.viewMode = 'shop';
        break;
      case NodeType.EVENT:
        this.runService.generateEvent();
        this.viewMode = 'event';
        break;
      case NodeType.UNKNOWN:
        // Reveal the node type and handle accordingly
        this.handleUnknownNode(node);
        break;
    }
  }

  /** Navigate to /play to start combat encounter. */
  startEncounter(node: MapNode): void {
    this.runService.prepareEncounter(node);
    this.router.navigate(['/play']);
  }

  /** Handle return from /play after encounter completion. */
  handleEncounterReturn(): void {
    const result = this.runService.consumePendingEncounterResult();
    if (!result) return;

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
      this.viewMode = 'summary';
    } else {
      this.viewMode = 'map';
    }
  }

  /** Continue after act-transition screen. */
  onActTransitionContinued(): void {
    this.runService.advanceAct();
    if (this.runState?.status === RunStatus.VICTORY) {
      this.viewMode = 'summary';
    } else {
      this.viewMode = 'map';
    }
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

  /** Handle card upgrade selection from rest screen. */
  onCardUpgraded(instanceId: string): void {
    this.runService.upgradeCard(instanceId);
    this.viewMode = 'map';
  }

  /** Complete event choice. */
  completeEvent(choiceIndex: number): void {
    this.runService.resolveEvent(choiceIndex);
    this.viewMode = 'map';
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

  /** Leave shop, return to map. */
  leaveShop(): void {
    this.runService.leaveShop();
    this.viewMode = 'map';
  }

  /** Calculate heal amount for rest site (REST_CONFIG.healPercentage of maxLives, minimum REST_CONFIG.minHeal). */
  getHealAmount(): number {
    if (!this.runState) return 0;
    const heal = Math.floor(this.runState.maxLives * REST_CONFIG.healPercentage);
    return Math.max(REST_CONFIG.minHeal, heal);
  }

  /** Abandon run and return to landing. */
  abandonRun(): void {
    this.runService.abandonRun();
    this.router.navigate(['/']);
  }

  /** Return to landing after run ends. */
  returnToMenu(): void {
    this.router.navigate(['/']);
  }

  isNodeSelectable(node: MapNode): boolean {
    return this.availableNodes.some(n => n.id === node.id);
  }

  /** Can we resume a saved run? */
  get canResume(): boolean {
    return this.runService.hasSavedRun();
  }

  /**
   * Returns a brief snapshot of the paused run for the start-screen resume button.
   * Returns null when no saved run exists.
   */
  get savedRunSummary(): { act: number; encounters: number; lives: number; relics: number } | null {
    if (!this.canResume) return null;
    const state = this.runService.loadSavedRunPreview();
    if (!state) return null;
    return {
      act: state.actIndex + 1,
      encounters: state.encounterResults.length,
      lives: state.lives,
      relics: state.relicIds.length,
    };
  }

  /** Highest ascension level unlocked. */
  get maxAscension(): number {
    return this.runService.getMaxAscension();
  }

  /** Returns all ascension levels from 1 up to and including the given level. */
  ascensionLevelsUpTo(level: number): AscensionLevel[] {
    return ASCENSION_LEVELS.slice(0, level);
  }

  /**
   * Returns a CSS class suffix for color-coding ascension difficulty.
   * Levels 1-5: easy (green), 6-10: medium (yellow), 11-15: hard (orange), 16-20: extreme (red).
   */
  getAscensionDifficultyClass(level: number): string {
    if (level <= 5) return 'easy';
    if (level <= 10) return 'medium';
    if (level <= 15) return 'hard';
    return 'extreme';
  }

  private updateRelicDisplay(relicIds: string[]): void {
    this.activeRelics = relicIds
      .map(id => RELIC_DEFINITIONS[id as RelicId])
      .filter((r): r is RelicDefinition => r !== undefined);
  }

  private updateAvailableNodes(): void {
    if (!this.nodeMap || !this.runState?.currentNodeId) {
      // If no current node, start nodes are available
      this.availableNodes = this.nodeMap
        ? this.nodeMap.startNodeIds
            .map(id => this.nodeMap!.nodes.find(n => n.id === id))
            .filter((n): n is MapNode => n !== undefined)
        : [];
      return;
    }
    this.availableNodes = getAvailableNodes(this.nodeMap, this.runState.currentNodeId);
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
        this.viewMode = 'shop';
        break;
      case NodeType.EVENT:
        this.runService.generateEvent();
        this.viewMode = 'event';
        break;
      default:
        this.startEncounter(node);
        break;
    }
  }
}
