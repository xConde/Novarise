import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import * as THREE from 'three';
import { GameBoardService } from './game-board.service';
import { SceneService } from './services/scene.service';
import { EnemyService } from './services/enemy.service';
import { MapBridgeService } from '../../core/services/map-bridge.service';
import { GameStateService } from './services/game-state.service';
import { WaveService } from './services/wave.service';
import { TowerCombatService } from './services/tower-combat.service';
import { AudioService } from './services/audio.service';
import { ParticleService } from './services/particle.service';
import { ScreenShakeService } from './services/screen-shake.service';
import { GoldPopupService } from './services/gold-popup.service';
import { FpsCounterService } from './services/fps-counter.service';
import { GameStatsService } from './services/game-stats.service';
import { PlayerProfileService, ACHIEVEMENTS, Achievement } from '../../core/services/player-profile.service';
import { DamagePopupService } from './services/damage-popup.service';
import { MinimapService } from './services/minimap.service';
import { SettingsService } from '../../core/services/settings.service';
import { TowerPreviewService } from './services/tower-preview.service';
import { disposeMaterial } from './utils/three-utils';
import { TowerType, TowerSpecialization, TOWER_CONFIGS, TOWER_DESCRIPTIONS, PlacedTower, MAX_TOWER_LEVEL, TARGETING_MODE_LABELS } from './models/tower.model';
import { DifficultyLevel, DIFFICULTY_PRESETS, GamePhase, GameState } from './models/game-state.model';
import { GameModifier, GAME_MODIFIER_CONFIGS, calculateModifierScoreMultiplier } from './models/game-modifier.model';
import { calculateScoreBreakdown, ScoreBreakdown } from './models/score.model';
import { UI_CONFIG } from './constants/ui.constants';
import { EnemyType, ENEMY_STATS } from './models/enemy.model';
import { ENEMY_INFO } from './models/enemy-info.model';
import { WavePreviewEntry, getWavePreviewFull } from './models/wave-preview.model';
import { PathVisualizationService } from './services/path-visualization.service';
import { StatusEffectService } from './services/status-effect.service';
import { StatusEffectType } from './constants/status-effect.constants';
import { TutorialService, TutorialStep } from '../../core/services/tutorial.service';
import { GameNotificationService, GameNotification } from './services/game-notification.service';
import { ChallengeTrackingService } from './services/challenge-tracking.service';
import { GameEndService } from './services/game-end.service';
import { TowerInteractionService } from './services/tower-interaction.service';
import { PathfindingService } from './services/pathfinding.service';
import { ChallengeIndicator } from './components/game-hud/game-hud.component';
import type { ChallengeDefinition } from '../../run/data/challenges';
import { GameSessionService } from './services/game-session.service';
import { BoardMeshRegistryService } from './services/board-mesh-registry.service';
import { CombatLoopService } from './services/combat-loop.service';
import { TileHighlightService } from './services/tile-highlight.service';
import { TowerAnimationService } from './services/tower-animation.service';
import { RangeVisualizationService } from './services/range-visualization.service';
import { TowerMeshFactoryService } from './services/tower-mesh-factory.service';
import { EnemyMeshFactoryService } from './services/enemy-mesh-factory.service';
import { GameInputService, TOWER_HOTKEYS, HotkeyActions } from './services/game-input.service';
import { TouchInteractionService } from './services/touch-interaction.service';
import { BoardPointerService } from './services/board-pointer.service';
import { EnemyVisualService } from './services/enemy-visual.service';
import { EnemyHealthService } from './services/enemy-health.service';
import { ChainLightningService } from './services/chain-lightning.service';
import { GameRenderService } from './services/game-render.service';
// M2 S5: ProjectileService import removed — file deleted in this phase.
import { GamePauseService } from './services/game-pause.service';
import { ChallengeDisplayService } from './services/challenge-display.service';
import { TowerUpgradeVisualService } from './services/tower-upgrade-visual.service';
import { TowerPlacementService } from './services/tower-placement.service';
import { TowerSelectionService } from './services/tower-selection.service';
import { CardPlayService } from './services/card-play.service';
import { TowerMeshLifecycleService } from './services/tower-mesh-lifecycle.service';
import { FocusTrap } from '../../shared/utils/focus-trap.util';
import { RunService } from '../../run/services/run.service';
import { RelicService } from '../../run/services/relic.service';
import { RELIC_DEFINITIONS } from '../../run/models/relic.model';
import { DeckService } from '../../run/services/deck.service';
import { CardEffectService } from '../../run/services/card-effect.service';
import { EncounterCheckpointService } from '../../run/services/encounter-checkpoint.service';
import { EncounterResult } from '../../run/models/run-state.model';
import { CardInstance, DeckState, EnergyState } from '../../run/models/card.model';
import { getActiveTowerEffect } from '../../run/constants/card-definitions';
import { WaveCombatFacadeService } from './services/wave-combat-facade.service';
import { TutorialFacadeService } from './services/tutorial-facade.service';
import { AscensionModifierService } from './services/ascension-modifier.service';
import { TurnHistoryService, TurnEventRecord } from './services/turn-history.service';
import { WavePreviewService, FutureWaveSummary } from './services/wave-preview.service';
import { HandCard } from './components/card-hand/card-hand.component';

/** A small tactical badge shown in the wave preview for each enemy type. */
export interface EnemyBadge {
  text: string;
  severity: 'info' | 'warning' | 'danger';
}

/** Phase 4: how many upcoming turns to show in the combat shell spawn preview. */
const SPAWN_PREVIEW_TURNS = 4;


const PAUSE_ENCOUNTER_LABELS: Record<string, string> = {
  combat: 'Combat',
  elite: 'Elite Combat',
  boss: 'Boss Fight',
};

/**
 * Builds a map of tactical badges for every EnemyType, computed once at module load.
 * Reads directly from ENEMY_STATS and ENEMY_INFO so values never diverge from game data.
 */
function buildEnemyBadgeMap(): ReadonlyMap<EnemyType, EnemyBadge[]> {
  const map = new Map<EnemyType, EnemyBadge[]>();

  for (const type of Object.values(EnemyType)) {
    const badges: EnemyBadge[] = [];
    const stats = ENEMY_STATS[type];
    const info = ENEMY_INFO[type];

    // Flying enemies hover above terrain — bypass ground pathing
    if (type === EnemyType.FLYING) {
      badges.push({ text: 'Flies', severity: 'info' });
    }

    // Immunities sourced from ENEMY_INFO (currently only Slow for Flying)
    for (const immunity of info.immunities) {
      badges.push({ text: `${immunity} immune`, severity: 'warning' });
    }

    // Shield HP — SHIELDED only
    if (stats.maxShield !== undefined) {
      badges.push({ text: `Shield: ${stats.maxShield}HP`, severity: 'info' });
    }

    // Swarm splits on death
    if (stats.spawnOnDeath !== undefined) {
      badges.push({ text: `Splits ×${stats.spawnOnDeath}`, severity: 'warning' });
    }

    // High leak damage — warn the player when one leak = multiple lives lost
    if (stats.leakDamage > 1) {
      badges.push({ text: `Leak: ${stats.leakDamage}`, severity: 'danger' });
    }

    map.set(type, badges);
  }

  return map;
}

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss'],
  providers: [BoardMeshRegistryService, SceneService, EnemyService, EnemyVisualService, EnemyHealthService, PathfindingService, GameStateService, WaveService, TowerCombatService, ChainLightningService, AudioService, ParticleService, ScreenShakeService, GoldPopupService, FpsCounterService, GameStatsService, DamagePopupService, MinimapService, TowerPreviewService, PathVisualizationService, StatusEffectService, GameNotificationService, ChallengeTrackingService, GameEndService, GameSessionService, TowerInteractionService, CombatLoopService, TileHighlightService, TowerAnimationService, RangeVisualizationService, TowerMeshFactoryService, EnemyMeshFactoryService, GameInputService, GamePauseService, ChallengeDisplayService, TowerUpgradeVisualService, TowerPlacementService, TowerSelectionService, GameRenderService, TouchInteractionService, BoardPointerService, CardPlayService, TowerMeshLifecycleService, WaveCombatFacadeService, TutorialFacadeService, AscensionModifierService, TurnHistoryService, WavePreviewService]
})
export class GameBoardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;
  @ViewChild('pauseOverlay') pauseOverlayRef?: ElementRef<HTMLElement>;

  private readonly pauseFocusTrap = new FocusTrap();

  // Scene — delegated to SceneService

  selectedTowerType: TowerType | null = TowerType.BASIC;

  // Tower info panel state — delegated to TowerSelectionService (get/set for template + test compat)
  get selectedTowerInfo(): PlacedTower | null { return this.towerSelectionService.selectedTowerInfo; }
  set selectedTowerInfo(v: PlacedTower | null) { this.towerSelectionService.selectedTowerInfo = v; }
  get selectedTowerStats(): { damage: number; range: number; statusEffect?: StatusEffectType } | null { return this.towerSelectionService.selectedTowerStats; }
  set selectedTowerStats(v: { damage: number; range: number; statusEffect?: StatusEffectType } | null) { this.towerSelectionService.selectedTowerStats = v; }
  get selectedTowerUpgradeCost(): number { return this.towerSelectionService.selectedTowerUpgradeCost; }
  /** Strategic tile premium % applied to the upgrade cost (0 = no premium). */
  get selectedTowerUpgradePercent(): number { return this.towerSelectionService.selectedTowerUpgradePercent; }
  get selectedTowerSellValue(): number { return this.towerSelectionService.selectedTowerSellValue; }
  /** Preview of stats after upgrading (null if at max level or below L2→L3 which needs spec). */
  get upgradePreview(): { damage: number; range: number } | null { return this.towerSelectionService.upgradePreview; }
  set upgradePreview(v: { damage: number; range: number } | null) { this.towerSelectionService.upgradePreview = v; }
  MAX_TOWER_LEVEL = MAX_TOWER_LEVEL;
  TowerSpecialization = TowerSpecialization;

  // Specialization choice state — delegated to TowerSelectionService
  get showSpecializationChoice(): boolean { return this.towerSelectionService.showSpecializationChoice; }
  set showSpecializationChoice(v: boolean) { this.towerSelectionService.showSpecializationChoice = v; }
  get specOptions(): { spec: TowerSpecialization; label: string; description: string; damage: number; range: number }[] { return this.towerSelectionService.specOptions; }
  set specOptions(v: { spec: TowerSpecialization; label: string; description: string; damage: number; range: number }[]) { this.towerSelectionService.specOptions = v; }

  // Game state exposed to template
  gameState: GameState;
  towerConfigs = TOWER_CONFIGS;
  towerDescriptions = TOWER_DESCRIPTIONS;
  TowerType = TowerType;
  GamePhase = GamePhase;
  DifficultyLevel = DifficultyLevel;
  difficultyPresets = DIFFICULTY_PRESETS;
  difficultyLevels = Object.values(DifficultyLevel);

  // Modifier state
  modifierConfigs = GAME_MODIFIER_CONFIGS;
  allModifiers = Object.values(GameModifier);
  activeModifiers = new Set<GameModifier>();
  modifierScoreMultiplier = 1.0;
  towerTypes: { type: TowerType; hotkey: string }[] = Object.entries(TOWER_HOTKEYS).map(
    ([key, type]) => ({ type, hotkey: key })
  );

  // Score breakdown — populated when game ends (VICTORY or DEFEAT)
  // Phase H11: scoreBreakdown + starArray fields deleted. gameEndService.recordEnd
  // computes the breakdown internally from GameState (H7). They were dead after
  // Phase 3 removed the state subscription's terminal-phase compute block; H11
  // finishes the cleanup.

  // Achievements unlocked at game end
  newlyUnlockedAchievements: string[] = [];
  achievementDetails: Achievement[] = [];

  /** Challenges completed this encounter — stashed by processCombatResult, consumed by the
   *  terminal-phase block in stateSubscription to populate EncounterResult. Cleared on restart. */
  private lastCompletedChallenges: readonly ChallengeDefinition[] = [];


  /** Live challenge progress badges shown in HUD during campaign games. Delegated to ChallengeDisplayService. */
  get challengeIndicators(): ChallengeIndicator[] { return this.challengeDisplayService.indicators; }

  // Wave preview — shown during SETUP and INTERMISSION
  wavePreview: WavePreviewEntry[] = [];
  /** Template description for the upcoming endless wave (null for scripted waves). */
  waveTemplateDescription: string | null = null;
  showAllRanges = false;
  showPathOverlay = false;
  get sellConfirmPending(): boolean { return this.towerSelectionService.sellConfirmPending; }
  set sellConfirmPending(v: boolean) { this.towerSelectionService.sellConfirmPending = v; }
  /** Tower type currently being previewed on touch devices (first tap). Null = no preview open. */
  previewTowerType: TowerType | null = null;
  targetingModeLabels = TARGETING_MODE_LABELS;
  /**
   * Pre-computed badge map — one array per EnemyType, built once at field initialisation.
   * Enemy stats and immunities are static, so there is no need to recompute per render cycle.
   */
  readonly enemyBadgeMap: ReadonlyMap<EnemyType, EnemyBadge[]> = buildEnemyBadgeMap();
  pathBlocked = false;
  private pathBlockedTimerId: ReturnType<typeof setTimeout> | null = null;

  // Animation
  private resizeHandler: () => void = () => {};
  private stateSubscription: Subscription | null = null;
  private hotkeySubscription: Subscription | null = null;

  // Ascent Mode — deck state exposed to CardHandComponent via template
  deckState: DeckState | null = null;
  energyState: EnergyState | null = null;
  private deckSub: Subscription | null = null;
  private energySub: Subscription | null = null;

  // WebGL context loss recovery (handlers live in SceneService; component owns the flag)
  contextLost = false;

  // Game initialization failure (WebGL not supported or canvas creation failed)
  initializationFailed = false;

  // Pile inspector — which pile is currently being inspected (null = closed)
  inspectedPile: 'draw' | 'discard' | null = null;

  /**
   * Card-detail modal — non-null when the player right-clicked or long-pressed
   * a card in hand. Populated by the cardInspected output from CardHandComponent.
   */
  inspectedCard: HandCard | null = null;

  // Turn-start banner — briefly shown after each endTurn()
  showTurnBanner = false;
  private turnBannerTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Persistent RECAP panel — last N completed turn records from
   * TurnHistoryService.records$. Bound directly by the template; live updates
   * via the subscription wired in ngOnInit. Replaces the earlier 2.5s flash
   * overlay (lastTurnSummary / showLastTurnSummary / lastTurnSummaryTimer).
   */
  recentTurnRecords: readonly TurnEventRecord[] = [];
  private turnRecordsSubscription: Subscription | null = null;

  /** Whether the End Turn button should pulse (hand stuck: 0 energy + no playable cards). */
  handStuck = false;

  // Drag-and-drop tower placement — delegated to TowerPlacementService
  get isDragging(): boolean { return this.towerPlacementService.isDragging; }

  // Auto-pause / quit state delegated to GamePauseService
  get autoPaused(): boolean { return this.gamePauseService.autoPaused; }
  get showQuitConfirm(): boolean { return this.gamePauseService.showQuitConfirm; }

  // Tutorial state
  TutorialStep = TutorialStep;

  // Toast notifications
  notifications: GameNotification[] = [];
  private notificationSub: Subscription | null = null;

  // Audio state exposed to template
  get audioMuted(): boolean { return this.audioService.isMuted; }

  /** Resolves newly unlocked achievement IDs to their name/description for display. */
  private updateAchievementDetails(): void {
    this.achievementDetails = this.newlyUnlockedAchievements
      .map(id => ACHIEVEMENTS.find(a => a.id === id))
      .filter((a): a is Achievement => a != null);
  }

  // Game stats exposed to score screen
  get gameStats() { return this.gameStatsService.getStats(); }

  /** Returns the template name of the currently active endless wave, or null. Exposed to template for HUD display. */
  get currentEndlessTemplate(): string | null {
    return this.waveService.getCurrentEndlessTemplate();
  }

  constructor(
    private router: Router,
    private sceneService: SceneService,
    private gameBoardService: GameBoardService,
    private enemyService: EnemyService,
    private mapBridge: MapBridgeService,
    private gameStateService: GameStateService,
    private waveService: WaveService,
    private towerCombatService: TowerCombatService,
    private audioService: AudioService,
    private particleService: ParticleService,
    private screenShakeService: ScreenShakeService,
    private goldPopupService: GoldPopupService,
    private fpsCounterService: FpsCounterService,
    private gameStatsService: GameStatsService,
    private playerProfileService: PlayerProfileService,
    private damagePopupService: DamagePopupService,
    private minimapService: MinimapService,
    private settingsService: SettingsService,
    private towerPreviewService: TowerPreviewService,
    private pathVisualizationService: PathVisualizationService,
    private statusEffectService: StatusEffectService,
    private tutorialService: TutorialService,
    private notificationService: GameNotificationService,
    private challengeTrackingService: ChallengeTrackingService,
    private gameEndService: GameEndService,
    private gameSessionService: GameSessionService,
    private towerInteractionService: TowerInteractionService,
    private combatLoopService: CombatLoopService,
    private tileHighlightService: TileHighlightService,
    private towerAnimationService: TowerAnimationService,
    private rangeVisualizationService: RangeVisualizationService,
    private gameInput: GameInputService,
    private gamePauseService: GamePauseService,
    private challengeDisplayService: ChallengeDisplayService,
    private towerUpgradeVisualService: TowerUpgradeVisualService,
    private towerPlacementService: TowerPlacementService,
    private towerSelectionService: TowerSelectionService,
    // Phase H5: campaignService + campaignMapService removed — game-board
    // no longer depends on campaign runtime. Getters below return safe defaults.
    private runService: RunService,
    private relicService: RelicService,
    private deckService: DeckService,
    private cardEffectService: CardEffectService,
    private gameRenderService: GameRenderService,
    private meshRegistry: BoardMeshRegistryService,
    private touchInteraction: TouchInteractionService,
    private boardPointer: BoardPointerService,
    private cardPlayService: CardPlayService,
    private towerMeshLifecycle: TowerMeshLifecycleService,
    public waveCombat: WaveCombatFacadeService,
    public tutorialFacade: TutorialFacadeService,
    private ascensionModifier: AscensionModifierService,
    private towerMeshFactory: TowerMeshFactoryService,
    private enemyMeshFactory: EnemyMeshFactoryService,
    private encounterCheckpointService: EncounterCheckpointService,
    private turnHistoryService: TurnHistoryService,
    private wavePreviewService: WavePreviewService,
  ) {
    this.gameState = this.gameStateService.getState();
  }

  ngOnInit(): void {
    // Feed the RECAP panel off the turn-history buffer so every endTurn()
    // resolves into a fresh row without any call-site flashing logic.
    this.turnRecordsSubscription = this.turnHistoryService.records$.subscribe({
      next: records => { this.recentTurnRecords = records; },
      error: (error: unknown) => console.error('Turn records subscription error:', error),
    });

    // Subscribe to game state changes
    this.stateSubscription = this.gameStateService.getState$().subscribe({
      error: (error: unknown) => console.error('Game state subscription error:', error),
      next: state => {
      const prevPhase = this.gameState.phase;
      const prevWave = this.gameState.wave;
      const prevLives = this.gameState.lives;
      this.gameState = state;
      // Keep component modifier copies in sync with the service — setModifiers has a phase
      // guard that silently no-ops outside SETUP/wave 0, so we read back the authoritative state
      // rather than trusting toggleModifier's local mutations.
      this.activeModifiers = state.activeModifiers;
      this.modifierScoreMultiplier = calculateModifierScoreMultiplier(state.activeModifiers);

      // Terminal phase: record encounter result and route back to the run hub.
      // There is no standalone scoring overlay — run summary is shown by the run module.
      if (
        (state.phase === GamePhase.VICTORY || state.phase === GamePhase.DEFEAT) &&
        prevPhase !== GamePhase.VICTORY &&
        prevPhase !== GamePhase.DEFEAT
      ) {
        const isVictory = state.phase === GamePhase.VICTORY;
        const killStats = this.gameStatsService.getStats();
        const totalKills = Object.values(killStats.killsByTowerType).reduce((a, b) => a + b, 0);
        const result: EncounterResult = {
          nodeId: this.runService.getCurrentEncounter()?.nodeId ?? '',
          nodeType: this.runService.getCurrentEncounter()?.nodeType ?? 'combat',
          victory: isVictory,
          livesLost: Math.max(0, state.initialLives - state.lives),
          goldEarned: Math.max(0, state.gold - state.initialGold),
          enemiesKilled: totalKills,
          wavesCompleted: state.wave,
          // Stashed by processCombatResult when gameEndService.recordEnd fires;
          // always [] on defeat (R3 guarantees challenge eval is skipped on defeat).
          completedChallenges: this.lastCompletedChallenges,
        };
        this.runService.recordEncounterResult(result);
        this.router.navigate(['/run']);
        return;
      }

      // Refresh wave preview when entering SETUP/INTERMISSION or when the wave number changes
      const isPreviewPhase =
        state.phase === GamePhase.SETUP || state.phase === GamePhase.INTERMISSION;
      const waveChanged = state.wave !== prevWave;
      const phaseChanged = state.phase !== prevPhase;
      if (isPreviewPhase && (waveChanged || phaseChanged)) {
        // Preview shows the NEXT wave that is about to start (wave + 1)
        const nextWave = state.wave + 1;
        const customDefs = this.waveService.hasCustomWaves()
          ? this.waveService.getWaveDefinitions()
          : undefined;
        const previewFull = getWavePreviewFull(nextWave, state.isEndless, customDefs);
        this.wavePreview = previewFull.entries;
        this.waveTemplateDescription = previewFull.templateDescription;
      }

      // Update UNTOUCHABLE indicator whenever lives decrease (enemy leak)
      if (state.lives !== prevLives && this.challengeIndicators.length > 0) {
        this.updateChallengeIndicators();
      }
      }
    });

    // Import editor map if it has spawn and exit points; otherwise use default board
    this.importBoard();

    // Combat requires an active run encounter. Guard against direct /play navigation
    // without a run — bail early and route back to the run hub.
    const encounter = this.runService.getCurrentEncounter();
    const runState = this.runService.runState;
    if (!runState || !encounter) {
      this.router.navigate(['/run']);
      return;
    }

    // Subscribe to deck/energy state for the card hand UI (both restore and fresh paths)
    this.deckSub = this.deckService.deckState$.subscribe(s => { this.deckState = s; });
    this.energySub = this.deckService.energy$.subscribe(e => { this.energyState = e; });

    this.sceneService.initScene();
    this.sceneService.initCamera();
    this.sceneService.initLights();
    this.sceneService.initSkybox();
    this.sceneService.initParticles();
    this.renderGameBoard();
    this.addGridLines();

    // Show initial tile highlights if a tower type is pre-selected (SETUP phase)
    if (this.isPlaceMode) {
      this.updateTileHighlights();
    }

    // Wire wave-combat facade callbacks before any wave interaction (both paths)
    this.waveCombat.init({
      onWaveComplete: (wave, perfect) => this.waveCombat.onWaveComplete(wave, perfect),
      onCombatResult: (output) => {
        if (output.newAchievements) {
          this.newlyUnlockedAchievements = output.newAchievements;
          this.lastCompletedChallenges = output.completedChallenges as readonly ChallengeDefinition[];
          this.updateAchievementDetails();
        }
        this.updateChallengeIndicators();
      },
      onRefreshUI: () => this.updateChallengeIndicators(),
      hasPendingCard: () => this.cardPlayService.hasPendingCard(),
      cancelPendingCard: () => this.cardPlayService.cancelPendingTowerCard(),
      cancelPlacement: () => this.cancelPlacement(),
      isRenderingUnavailable: () => this.initializationFailed || this.contextLost,
    });

    // Track games played, then start appropriate tutorial/tips sequence
    this.tutorialService.incrementGamesPlayed();
    if (!this.tutorialService.isTutorialComplete()) {
      this.tutorialService.startTutorial();
    } else {
      this.tutorialService.startTips();
    }
    this.tutorialFacade.init();

    // Subscribe to toast notifications
    this.notificationSub = this.notificationService.getNotifications().subscribe({
      next: notifs => { this.notifications = notifs; },
      error: (error: unknown) => console.error('Notification subscription error:', error)
    });

    if (this.runService.isRestoringCheckpoint) {
      // Restore path: run the 18-step restore coordinator
      this.restoreFromCheckpoint();
    } else {
      // Normal path: apply run encounter config then auto-start first wave
      this.initFreshEncounter();
    }
  }

  /**
   * Apply run encounter configuration and start the first wave.
   * Called on the normal (non-restore) path and as the fallback when checkpoint
   * loading fails or the checkpoint is missing.
   */
  private initFreshEncounter(): void {
    const encounter = this.runService.getCurrentEncounter();
    const runState = this.runService.runState;
    if (!encounter || !runState) return;

    this.gameStateService.setInitialLives(runState.lives, runState.maxLives + this.relicService.getMaxLivesBonus());
    this.gameStateService.addGold(this.relicService.getStartingGoldBonus());
    this.gameStateService.snapshotInitialGold();
    this.waveService.setCustomWaves(encounter.waves);
    this.gameStateService.setMaxWaves(encounter.waves.length);
    this.ascensionModifier.apply(runState.ascensionLevel, encounter.isElite, encounter.isBoss);
    this.updateChallengeIndicators();

    // Reset card modifier state from any previous encounter (root-scoped service
    // survives route transitions — must be explicitly cleared between encounters).
    this.cardEffectService.reset();

    // Reset turn counter + leak flag + frame buffers. Without this the
    // turnNumber persists from the prior encounter (the audit that caught
    // this noted: SPEED_RUN challenges would instantly fail from encounter 2
    // onward because turnsUsed was cumulative).
    this.combatLoopService.reset();

    // Reset one-shot scout bonuses so a previous encounter's SCOUT_AHEAD does
    // not leak preview depth into this one. (Permanent SCOUTING_LENS bonus
    // stays because it reads live from RelicService.)
    this.wavePreviewService.resetForEncounter();

    // Reset pause-state flags so a prior encounter's autoPaused /
    // showQuitConfirm doesn't bleed through into this encounter's pause UI.
    this.gamePauseService.reset();

    // Initialize deck for this encounter and draw the opening hand
    this.deckService.resetForEncounter();
    this.deckService.drawForWave();

    // Seed initial wave preview (after setCustomWaves applies waves)
    const state = this.gameStateService.getState();
    const customDefs = this.waveService.hasCustomWaves() ? this.waveService.getWaveDefinitions() : undefined;
    const preview = getWavePreviewFull(state.wave + 1, state.isEndless, customDefs);
    this.wavePreview = preview.entries;
    this.waveTemplateDescription = preview.templateDescription;

    if (this.runService.isInRun()) {
      this.startWave();
    }
  }

  ngAfterViewInit(): void {
    try {
      this.sceneService.initRenderer(
        this.canvasContainer.nativeElement,
        () => {
          this.contextLost = true;
          this.gameRenderService.stopLoop();
        },
        () => {
          this.contextLost = false;
          if (!this.gameRenderService.isLoopRunning) {
            this.gameRenderService.startLoop();
          }
        }
      );
    } catch {
      this.initializationFailed = true;
      return;
    }
    this.sceneService.initPostProcessing();
    this.sceneService.initControls();

    this.resizeHandler = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.sceneService.resize(width, height);
    };
    window.addEventListener('resize', this.resizeHandler);

    const canvas = this.sceneService.getRenderer().domElement;
    this.boardPointer.init(canvas, {
      onTowerClick: (key) => this.selectPlacedTower(key),
      onTilePlace: (row, col) => this.tryPlaceTower(row, col),
      onDeselect: () => this.deselectTower(),
      onCancelPlacement: () => this.cancelPlacement(),
      onContextMenu: () => {
        if (this.isDragging) {
          this.towerPlacementService.cancelDrag();
        } else if (this.isPlaceMode) {
          this.cancelPlacement();
        }
      },
      getPlacementState: () => ({
        isPlaceMode: this.isPlaceMode,
        towerType: this.selectedTowerType,
        gold: this.gameState.gold,
        selectedTowerInfo: this.selectedTowerInfo,
      }),
    });
    this.touchInteraction.init(canvas, (x, y) => this.boardPointer.handleInteraction(x, y));

    this.towerPlacementService.init(this.boardPointer.raycaster, this.boardPointer.mouse, () => this.meshRegistry.getTileMeshArray() as THREE.Mesh[], {
      onEnterPlaceMode: (type) => { this.selectedTowerType = type; this.updateTileHighlights(); },
      onPlaceAttempt: (row, col) => this.tryPlaceTower(row, col),
      onDeselectTower: () => this.deselectTower(),
    });

    this.gameInput.init();
    const hotkeyActions: HotkeyActions = {
      onSpace: () => {
        const phase = this.gameStateService.getState().phase;
        if (phase === GamePhase.COMBAT) { this.endTurn(); } else { this.startWave(); }
      },
      onPause: () => this.togglePause(),
      onEscape: () => {
        if (this.isPaused) { this.togglePause(); }
        else if (this.isPlaceMode) { this.cancelPlacement(); }
        else if (this.selectedTowerInfo) { this.deselectTower(); }
        else { this.togglePause(); }
      },
      onToggleRanges: () => this.toggleAllRanges(),
      onToggleMinimap: () => this.minimapService.toggleVisibility(),
      onTogglePath: () => this.togglePathOverlay(),
      onUpgrade: () => this.upgradeTower(),
      onCycleTargeting: () => this.cycleTargeting(),
      onSell: () => this.sellTower(),
      onTowerHotkey: (type) => this.selectTowerType(type),
      isInRun: () => this.runService.isInRun(),
      isPlaceMode: () => this.isPlaceMode,
      getSelectedTowerInfo: () => this.selectedTowerInfo,
    };
    this.hotkeySubscription = this.gameInput.hotkey$.subscribe(
      e => this.gameInput.dispatchHotkey(e, this.gameStateService.getState(), hotkeyActions)
    );

    this.cardPlayService.init({
      onEnterPlacementMode: (type, _card) => {
        this.selectedTowerType = type;
        this.updateTileHighlights();
      },
      onRefreshUI: () => {
        this.updateTileHighlights();
        this.updateChallengeIndicators();
      },
      onSalvageComplete: (salvageKey) => {
        this.boardPointer.clearSelectedTile();
        this.refreshPathOverlay();
        if (this.selectedTowerInfo?.id === salvageKey) {
          this.deselectTower();
        }
      },
    });

    this.minimapService.init(this.canvasContainer.nativeElement);
    this.gameRenderService.init();
    this.setupAutoPause();
    this.gameRenderService.startLoop();
  }

  // --- Public methods for template ---

  levelStars(count: number): number[] {
    return Array(Math.max(0, count)).fill(0);
  }

  toggleAudio(): void {
    this.audioService.toggleMute();
  }

  /** Reload the page — used by the WebGL context-lost refresh button. */
  reloadPage(): void {
    window.location.reload();
  }

  /** Navigate back to the run hub — used by the game initialization failure overlay. */
  goBackToRunHub(): void {
    this.router.navigate(['/run']);
  }

  dismissNotification(id: number): void {
    this.notificationService.dismiss(id);
  }

  selectDifficulty(difficulty: DifficultyLevel): void {
    this.gameStateService.setDifficulty(difficulty);
    this.settingsService.update({ difficulty });
  }

  toggleModifier(modifier: GameModifier): void {
    if (this.activeModifiers.has(modifier)) {
      this.activeModifiers.delete(modifier);
    } else {
      this.activeModifiers.add(modifier);
    }
    this.modifierScoreMultiplier = calculateModifierScoreMultiplier(this.activeModifiers);
    this.gameStateService.setModifiers(this.activeModifiers);
  }

  /** Base tower cost (shown in tower bar — no tile-specific pricing). */
  getEffectiveTowerCost(type: TowerType | null): number {
    if (!type) return 0;
    const costMult = this.gameStateService.getModifierEffects().towerCostMultiplier ?? 1;
    return Math.round(TOWER_CONFIGS[type].cost * costMult);
  }

  selectTowerType(type: TowerType): void {
    // Toggle: clicking the same type deselects (enters INSPECT mode)
    if (this.selectedTowerType === type) {
      this.cancelPlacement();
      return;
    }
    this.selectedTowerType = type;
    this.deselectTower();
    this.updateTileHighlights();
  }

  /**
   * Touch-device two-tap tower selection:
   *   - First tap: open stats preview (sets previewTowerType, does not select for placement).
   *   - Second tap on same tower: select for placement (clear preview, enter PLACE mode).
   *   - Tap on different tower while preview open: switch preview to new tower.
   *
   * On pointer (mouse) devices this delegates straight to selectTowerType so desktop
   * behaviour is completely unchanged.
   */
  handleTowerButtonTap(event: MouseEvent | TouchEvent, type: TowerType): void {
    // On both touch and mouse, select the tower directly.
    // The tooltip preview (.previewing class) shows stats on touch via CSS,
    // but the tower is selected immediately so the mode indicator updates.
    this.selectTowerType(type);
  }

  /** Dismiss the touch preview without selecting a tower. */
  clearTowerPreview(): void {
    this.previewTowerType = null;
  }

  /** Exit PLACE mode — clears tower type selection, hides ghost preview, removes tile highlights. */
  cancelPlacement(): void {
    this.cardPlayService.cancelPendingTowerCard();
    this.selectedTowerType = null;
    this.boardPointer.clearSelectedTile();
    this.clearTileHighlights();
    if (this.sceneService.getScene()) {
      this.towerPreviewService.hidePreview(this.sceneService.getScene());
    }
  }

  /** Whether a tower type is selected for placement (PLACE mode).
   *  Placement always requires a pending tower card — cards are the only path to tower placement. */
  get isPlaceMode(): boolean {
    return this.selectedTowerType !== null && this.cardPlayService.hasPendingCard();
  }

  // --- Card hand ---

  /** Expose pending tower card instanceId to template for CardHandComponent binding. */
  get pendingTowerCardId(): string | null {
    return this.cardPlayService.getPendingCardId();
  }

  /**
   * Handle a card played from CardHandComponent.
   * Delegates to CardPlayService which manages placement limbo and spell effects.
   */
  onCardPlayed(card: CardInstance): void {
    if (this.isPaused) return;
    // Any card play is "real progress" — dismiss any active tutorial tip so
    // it stops blocking the attention band the player has already moved on from.
    this.tutorialService.dismissOnPlayerAction();
    this.turnHistoryService.recordCardPlayed();
    this.cardPlayService.onCardPlayed(card);
  }

  // --- Drag-and-drop tower placement ---

  /** Called on mousedown/touchstart on a tower bar button — delegates to TowerPlacementService. */
  onTowerDragStart(event: MouseEvent | TouchEvent, type: TowerType): void {
    this.towerPlacementService.onTowerDragStart(event, type);
  }


  /**
   * Highlight all tiles where the currently selected tower type can be placed.
   * Called when entering PLACE mode or when the board changes during PLACE mode.
   */
  updateTileHighlights(): void {
    if (!this.isPlaceMode) {
      this.tileHighlightService.clearHighlights(this.meshRegistry.tileMeshes, this.sceneService.getScene());
      return;
    }
    const costMult = this.gameStateService.getModifierEffects().towerCostMultiplier ?? 1;
    this.tileHighlightService.updateHighlights(
      this.selectedTowerType!,
      this.meshRegistry.tileMeshes,
      this.boardPointer.getSelectedTile(),
      this.sceneService.getScene(),
      costMult
    );
  }

  /** Remove placement highlights from all tiles, restoring their original emissive. */
  private clearTileHighlights(): void {
    this.tileHighlightService.clearHighlights(this.meshRegistry.tileMeshes, this.sceneService.getScene());
  }

  upgradeTower(spec?: TowerSpecialization): void {
    if (!this.selectedTowerInfo) return;

    const result = this.towerInteractionService.upgradeTower(this.selectedTowerInfo.id, spec);

    if (result.needsSpecialization && result.specOptions) {
      // L2→L3: show spec chooser UI — service pre-computed the options
      this.specOptions = result.specOptions;
      this.showSpecializationChoice = true;
      return;
    }

    if (!result.success) return;

    // Successful upgrade is the canonical UPGRADE_TOWER / TIP_UPGRADE dismissal signal.
    this.tutorialService.dismissOnPlayerAction();

    this.showSpecializationChoice = false;
    this.specOptions = [];
    this.audioService.playTowerUpgrade();

    // Scale/emissive/specialization tint delegated to TowerUpgradeVisualService
    const towerMesh = this.meshRegistry.towerMeshes.get(this.selectedTowerInfo.id);
    if (towerMesh) {
      this.towerUpgradeVisualService.applyUpgradeVisuals(towerMesh, result.newLevel, result.specialization);
    }

    // Invalidate muzzle flash saved emissive — upgrade changed the baseline
    const placedTower = this.towerCombatService.getPlacedTowers().get(this.selectedTowerInfo.id);
    if (placedTower) {
      placedTower.originalEmissiveIntensity = undefined;
      placedTower.muzzleFlashTimer = undefined;
    }

    // Refresh info panel
    this.refreshTowerInfoPanel();
    this.rangeVisualizationService.showForTower(
      this.selectedTowerInfo,
      this.gameBoardService.getBoardWidth(),
      this.gameBoardService.getBoardHeight(),
      this.gameBoardService.getTileSize(),
      this.sceneService.getScene()
    );
    this.updateChallengeIndicators();
  }

  selectSpecialization(spec: TowerSpecialization): void {
    this.upgradeTower(spec);
  }

  /** @deprecated Use TowerUpgradeVisualService.applySpecializationVisual — kept for template compatibility. */
  applySpecializationVisual(towerMesh: THREE.Group, spec: TowerSpecialization): void {
    this.towerUpgradeVisualService.applySpecializationVisual(towerMesh, spec);
  }

  sellTower(): void {
    if (!this.selectedTowerInfo) return;

    // First click sets confirm pending; second click within same selection executes sell
    if (!this.sellConfirmPending) {
      this.sellConfirmPending = true;
      return;
    }
    this.sellConfirmPending = false;

    const result = this.towerInteractionService.sellTower(this.selectedTowerInfo.id);
    if (!result.success) return;

    this.audioService.playTowerSell();
    this.gameStatsService.recordTowerSold();

    // Remove mesh from scene via lifecycle service
    this.towerMeshLifecycle.removeMesh(this.selectedTowerInfo.id);

    this.boardPointer.clearSelectedTile();
    this.refreshPathOverlay();

    this.deselectTower();

    // Recompute valid tile highlights — board changed (tile freed)
    this.updateTileHighlights();
    this.updateChallengeIndicators();
  }

  cycleTargeting(): void {
    this.towerSelectionService.cycleTargeting();
  }

  deselectTower(): void {
    this.towerSelectionService.deselectTower();
  }

  private selectPlacedTower(key: string): void {
    this.towerSelectionService.selectPlacedTower(key, () => this.cancelPlacement());
  }

  private refreshTowerInfoPanel(): void {
    this.towerSelectionService.refreshTowerInfoPanel();
  }

  goToEditor(): void {
    if (this.gameState.phase === GamePhase.COMBAT) {
      const wasPaused = this.isPaused;
      if (!wasPaused) this.togglePause();
      if (!confirm('Leave the game? Progress will be lost.')) {
        if (!wasPaused) this.togglePause();
        return;
      }
    }
    this.router.navigate(['/edit']);
  }

  /** True when the game was launched from the editor (map state loaded but no saved mapId). */
  get isEditorOrigin(): boolean {
    return this.mapBridge.hasEditorMap() && this.mapBridge.getMapId() === null;
  }

  /**
   * Recomputes challenge progress badges for the HUD via ChallengeDisplayService.
   * Passes the current encounter's campaignMapId so ChallengeDisplayService can
   * look up and evaluate any challenges attached to that map.
   */
  updateChallengeIndicators(): void {
    const encounter = this.runService.getCurrentEncounter();
    this.challengeDisplayService.updateIndicators(encounter?.campaignMapId ?? null);
  }

  startWave(): void {
    if (this.isPaused) return;
    // Starting a wave counts as the START_WAVE tutorial step by definition.
    this.tutorialService.dismissOnPlayerAction();
    this.waveCombat.startWave();
  }

  /** Returns the pre-computed tactical badges for a given enemy type. Always returns an array (never null). */
  getEnemyBadges(type: EnemyType): EnemyBadge[] {
    return this.enemyBadgeMap.get(type) ?? [];
  }

  /** Returns the display name for a given enemy type, sourced from ENEMY_INFO. */
  getEnemyLabel(type: EnemyType): string {
    return ENEMY_INFO[type].name;
  }

  /** Returns a hover tooltip string for a spawn-preview enemy entry. */
  getEnemyTooltip(type: EnemyType): string {
    const info = ENEMY_INFO[type];
    if (!info) return type;
    const parts: string[] = [info.name, info.description];
    if (info.special) parts.push(info.special);
    if (info.immunities?.length) parts.push(`Immune: ${info.immunities.join(', ')}`);
    return parts.join(' — ');
  }

  /**
   * Returns all active relics from the run, mapped to { id, name, description }
   * for display in the pause menu and HUD relic peek.
   */
  get activeRelics(): { id: string; name: string; description: string }[] {
    const runState = this.runService.runState;
    if (!runState) return [];
    return runState.relicIds
      .map(id => {
        const def = (RELIC_DEFINITIONS as Record<string, { name: string; description: string } | undefined>)[id];
        return def ? { id, name: def.name, description: def.description } : null;
      })
      .filter((r): r is { id: string; name: string; description: string } => r !== null);
  }

  /**
   * Briefly shows the turn-start banner for 1.2 s after endTurn().
   * Only flashes when phase remains COMBAT (not VICTORY/DEFEAT/INTERMISSION).
   */
  private flashTurnBanner(): void {
    if (this.turnBannerTimer) {
      clearTimeout(this.turnBannerTimer);
    }
    this.showTurnBanner = true;
    this.turnBannerTimer = setTimeout(() => {
      this.showTurnBanner = false;
      this.turnBannerTimer = null;
    }, 1200);
  }


  endTurn(): void {
    if (this.isPaused) return;

    // Dismiss any active tutorial tip — advancing to a new turn is definitive
    // "player is driving" progress; the helper copy can step aside.
    this.tutorialService.dismissOnPlayerAction();

    // Capture kill count before the turn resolves so we can record it.
    const killsBefore = Object.values(this.gameStatsService.getStats().killsByTowerType)
      .reduce((a, b) => a + b, 0);
    const livesBefore = this.gameStateService.getState().lives;
    const goldBefore = this.gameStateService.getState().gold;

    // Begin tracking turn in history service BEFORE resolution
    this.turnHistoryService.beginTurn(this.currentTurnNumber);

    this.waveCombat.endTurn();

    // Record outcomes after resolution
    const postState = this.gameStateService.getState();
    const killsAfter = Object.values(this.gameStatsService.getStats().killsByTowerType)
      .reduce((a, b) => a + b, 0);
    this.turnHistoryService.recordKills(killsAfter - killsBefore);
    const livesLost = Math.max(0, livesBefore - postState.lives);
    if (livesLost > 0) this.turnHistoryService.recordLifeLost(livesLost);
    const goldEarned = Math.max(0, postState.gold - goldBefore);
    if (goldEarned > 0) this.turnHistoryService.recordGoldEarned(goldEarned);

    this.turnHistoryService.endTurn();

    // The persistent right-side RECAP panel is already bound to
    // turnHistoryService.records$; endTurn() pushed the new record and the
    // subscription will surface it automatically. No flash call needed.
    if (postState.phase === GamePhase.COMBAT) {
      this.flashTurnBanner();
    }
  }

  /**
   * 14-step encounter restore from checkpoint.
   * Called in ngOnInit when isRestoringCheckpoint is true, after scene + board are set up.
   * Order is critical — see restore plan for dependency rationale.
   */
  private restoreFromCheckpoint(): void {
    const checkpoint = this.encounterCheckpointService.loadCheckpoint();
    if (!checkpoint) {
      // Checkpoint not found — fall back to fresh encounter initialization
      this.runService.isRestoringCheckpoint = false;
      this.initFreshEncounter();
      return;
    }

    try {
      const scene = this.sceneService.getScene();
      const encounter = checkpoint.encounterConfig;

      // Step 1: Board tiles already rendered (importBoard + renderGameBoard ran before this call)

      // Step 2: Apply ascension modifiers
      const runState = this.runService.runState;
      if (runState) {
        this.ascensionModifier.apply(runState.ascensionLevel, encounter.isElite, encounter.isBoss);
      }

      // Step 3: Restore CombatLoopService turn number (before mortar zone expiry checks)
      this.combatLoopService.setTurnNumber(checkpoint.turnNumber);

      // Step 4: Restore towers — create meshes, register in TowerCombatService
      const towerMeshes = new Map<string, THREE.Group>();
      for (const tower of checkpoint.towers) {
        const mesh = this.towerMeshFactory.createTowerMesh(
          tower.row, tower.col, tower.type,
          this.gameBoardService.getBoardWidth(), this.gameBoardService.getBoardHeight()
        );
        scene.add(mesh);
        this.meshRegistry.towerMeshes.set(tower.id, mesh);
        towerMeshes.set(tower.id, mesh);
        // Mark board tile as occupied — use forceSetTower to bypass BFS validation.
        // Placing towers one-by-one from a checkpoint would cause wouldBlockPath() to
        // reject valid positions before the full saved layout is restored.
        this.gameBoardService.forceSetTower(tower.row, tower.col, tower.type);
      }
      this.towerCombatService.restoreTowers(checkpoint.towers, towerMeshes);
      this.meshRegistry.rebuildTowerChildrenArray();

      // Step 5: Restore mortar zones
      this.towerCombatService.restoreMortarZones(checkpoint.mortarZones);

      // Step 6: Restore enemies — create meshes, register in EnemyService
      const enemyMeshes = new Map<string, THREE.Mesh>();
      for (const enemy of checkpoint.enemies) {
        const tempEnemy = {
          ...enemy,
          path: enemy.path.map(n => ({ ...n, parent: undefined })),
          mesh: undefined,
          statusParticles: [],
          statusParticleEffectType: undefined,
        };
        const mesh = this.enemyMeshFactory.createEnemyMesh(tempEnemy as unknown as Parameters<typeof this.enemyMeshFactory.createEnemyMesh>[0]);
        scene.add(mesh);
        enemyMeshes.set(enemy.id, mesh);
      }
      this.enemyService.restoreEnemies(checkpoint.enemies, enemyMeshes, checkpoint.enemyCounter);

      // Step 7: Restore status effects
      this.statusEffectService.restoreEffects(checkpoint.statusEffects);

      // Step 8: Update health bars for restored enemies
      const camera = this.sceneService.getCamera();
      if (camera) {
        this.enemyService.updateHealthBars(camera.quaternion);
      }

      // Step 9: Restore deck state (piles, energy — NO reshuffle)
      this.deckService.restoreState(checkpoint.deckState);

      // Step 10: Restore card effect modifiers
      this.cardEffectService.restoreModifiers(checkpoint.cardModifiers);

      // Step 11: Restore game stats
      this.gameStatsService.restoreFromCheckpoint(checkpoint.gameStats);

      // Step 12: Restore challenge tracking
      this.challengeTrackingService.restoreFromCheckpoint(checkpoint.challengeState);

      // Step 13: Restore relic encounter flags
      this.relicService.restoreEncounterFlags(checkpoint.relicFlags);

      // Step 13a: Restore wave-preview one-shot bonus so mid-encounter scout
      // plays survive a save/resume. Pre-v2 checkpoints are migrated to a
      // zero-bonus default by EncounterCheckpointService before we get here.
      this.wavePreviewService.restore(checkpoint.wavePreview);

      // Step 14: Restore wave state (turnSchedule, index, seenTypes)
      this.waveService.restoreState(checkpoint.waveState);

      // Step 15: Restore combat loop leaked flag
      this.combatLoopService.setLeakedThisWave(checkpoint.leakedThisWave);

      // Step 16: Restore game state LAST (sets phase → triggers UI subscription updates)
      this.gameStateService.restoreFromCheckpoint(checkpoint.gameState);

      // Step 17: Set custom waves for wave preview
      this.waveService.setCustomWaves(encounter.waves);
      this.gameStateService.setMaxWaves(encounter.waves.length);

      // Step 18: Seed wave preview for the current restored state
      const state = this.gameStateService.getState();
      if (state.phase === GamePhase.INTERMISSION || state.phase === GamePhase.COMBAT) {
        const customDefs = this.waveService.hasCustomWaves()
          ? this.waveService.getWaveDefinitions()
          : undefined;
        const preview = getWavePreviewFull(state.wave + 1, state.isEndless, customDefs);
        this.wavePreview = preview.entries;
        this.waveTemplateDescription = preview.templateDescription;
      }

      // Clear restore flag and checkpoint storage
      this.runService.isRestoringCheckpoint = false;
      this.encounterCheckpointService.clearCheckpoint();
      this.updateChallengeIndicators();
    } catch (error) {
      console.error('Failed to restore checkpoint, falling back to fresh encounter:', error);
      this.runService.isRestoringCheckpoint = false;
      this.encounterCheckpointService.clearCheckpoint();
      // Clean up any partial restore state before starting fresh
      this.gameSessionService.resetAllServices(this.sceneService.getScene());
      this.initFreshEncounter();
    }
  }

  /**
   * Import the editor map into the game board service, or reset to default if no valid map.
   */
  private importBoard(): void {
    if (this.mapBridge.hasEditorMap() && this.mapBridge.hasValidSpawnAndExit()) {
      const state = this.mapBridge.getEditorMapState()!;
      const { board, width, height } = this.mapBridge.convertToGameBoard(state);
      this.gameBoardService.importBoard(board, width, height);
    } else {
      this.gameBoardService.resetBoard();
    }
    this.sceneService.setBoardSize(
      Math.max(this.gameBoardService.getBoardWidth(), this.gameBoardService.getBoardHeight())
    );
    this.towerPreviewService.setBoardSize(
      this.gameBoardService.getBoardWidth(),
      this.gameBoardService.getBoardHeight()
    );
  }

  /** Shared cleanup for game objects — called from ngOnDestroy(). */
  private cleanupGameObjects(): void {
    // Clean up enemies — snapshot keys to avoid mutating Map during iteration
    for (const id of Array.from(this.enemyService.getEnemies().keys())) {
      this.enemyService.removeEnemy(id, this.sceneService.getScene());
    }

    // Delegate Three.js disposal + service cleanup to GameSessionService
    this.gameSessionService.cleanupScene();
    // cleanupScene clears maps and gridLines in the registry; rebuild derives empty arrays
    this.meshRegistry.rebuildTileMeshArray();
    this.meshRegistry.rebuildTowerChildrenArray();

    // Reset component-owned UI state that references disposed objects
    this.showPathOverlay = false;
    this.showAllRanges = false;
    this.towerSelectionService.deselectTower();
  }

  private renderGameBoard(): void {
    const boardTiles = this.gameBoardService.getGameBoard();

    boardTiles.forEach((row, rowIndex) => {
      row.forEach((tile, colIndex) => {
        const mesh = this.gameBoardService.createTileMesh(rowIndex, colIndex, tile.type);
        mesh.userData = { row: rowIndex, col: colIndex, tile: tile };
        this.meshRegistry.tileMeshes.set(`${rowIndex}-${colIndex}`, mesh);
        this.sceneService.getScene().add(mesh);
      });
    });

    this.gameRenderService.rebuildMinimapTerrainCache();
    this.meshRegistry.rebuildTileMeshArray();
    this.meshRegistry.rebuildTowerChildrenArray();
  }

  private addGridLines(): void {
    if (this.meshRegistry.gridLines) {
      this.sceneService.getScene().remove(this.meshRegistry.gridLines);
      this.meshRegistry.gridLines.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    }
    this.meshRegistry.gridLines = this.gameBoardService.createGridLines();
    this.sceneService.getScene().add(this.meshRegistry.gridLines);
  }

  private showPathBlockedWarning(): void {
    this.pathBlocked = true;
    if (this.pathBlockedTimerId !== null) {
      clearTimeout(this.pathBlockedTimerId);
    }
    this.pathBlockedTimerId = setTimeout(() => {
      this.pathBlocked = false;
      this.pathBlockedTimerId = null;
    }, UI_CONFIG.pathBlockedDismissMs);
  }

  private tryPlaceTower(row: number, col: number): void {
    // Towers can ONLY be placed via tower cards. No card = no placement.
    if (!this.selectedTowerType || !this.cardPlayService.hasPendingCard()) return;

    if (!this.gameBoardService.canPlaceTower(row, col)) {
      // Check specifically if this was a path-blocking rejection
      if (this.towerInteractionService.wouldBlockPath(row, col)) {
        this.showPathBlockedWarning();
      }
      return;
    }

    const result = this.towerInteractionService.placeTower(row, col, this.selectedTowerType);
    if (!result.success) return;

    // Capture state BEFORE consuming — consumePendingTowerCard() nulls the card
    // and cancelPlacement() nulls selectedTowerType.
    const placedCard = this.cardPlayService.getPendingCard();
    const placedTowerType = this.selectedTowerType;

    // Consume the pending tower card and exit placement mode.
    // Each card = exactly one tower.
    this.cardPlayService.consumePendingTowerCard();
    this.cancelPlacement();

    // Create tower mesh, register it in the scene, and rebuild children array.
    const towerMesh = this.towerMeshLifecycle.placeMesh(row, col, placedTowerType);

    // Resolve the active card effect BEFORE registerTower so we have statOverrides available.
    const activeTowerEffect = placedCard ? getActiveTowerEffect(placedCard) : undefined;
    const cardStatOverrides = activeTowerEffect?.statOverrides;

    // Register tower with combat service (needs the mesh reference)
    this.towerCombatService.registerTower(row, col, placedTowerType, towerMesh, result.cost, {
      cardStatOverrides,
    });

    // Sub-task B: upgraded tower cards start at level 2 (player effectively
    // pre-paid the L1→L2 upgrade cost via the card upgrade).
    if (activeTowerEffect?.startLevel === 2) {
      // Upgrade to L2 at zero additional cost — the card's upgrade already
      // accounts for the value. actualCost: 0 keeps totalInvested accurate.
      this.towerCombatService.upgradeTower(`${row}-${col}`, 0);
    }

    this.audioService.playTowerPlace();
    this.gameStatsService.recordTowerBuilt();

    // Hide preview and invalidate preview cache — board layout changed
    this.boardPointer.clearSelectedTile();
    this.towerPreviewService.hidePreview(this.sceneService.getScene());

    this.refreshPathOverlay();

    // Recompute valid tile highlights — board changed
    this.updateTileHighlights();
    this.updateChallengeIndicators();
  }

  // --- Pause menu ---

  onPauseOverlayClick(_event: MouseEvent): void {
    // Clicking the dark backdrop resumes the game
    this.togglePause();
  }

  requestQuit(): void {
    this.gamePauseService.requestQuit();
  }

  cancelQuit(): void {
    this.gamePauseService.cancelQuit();
  }

  confirmQuit(): void {
    this.gamePauseService.confirmQuit();
    this.router.navigate(['/run']);
  }

  saveAndExit(): void {
    // Checkpoint already exists from the last auto-save after endTurn().
    this.router.navigate(['/run']);
  }

  /**
   * Called by the CanDeactivate guard when the player tries to navigate away mid-game.
   * Delegates to GamePauseService — returns Observable for async modal confirmation
   * or boolean for immediate allow (terminal phases).
   */
  requestGuardDecision(): Observable<boolean> | boolean {
    return this.gamePauseService.requestGuardDecision();
  }

  togglePause(): void {
    const willPause = this.gamePauseService.togglePause();
    const controls = this.sceneService.getControls();
    if (controls) { controls.enabled = !willPause; }
    if (!willPause) {
      this.pauseFocusTrap.deactivate();
    } else {
      this.activatePauseFocus();
    }
  }

  /** Register visibility/focus-loss listeners for auto-pause via GamePauseService.
   *  The service handles core pause logic; the component activates the focus trap after
   *  auto-pause triggers, since focus trap requires a ViewChild reference.
   */
  private setupAutoPause(): void {
    this.gamePauseService.onAutoPause = () => {
      const controls = this.sceneService.getControls();
      if (controls) { controls.enabled = false; }
      this.activatePauseFocus();
    };
    this.gamePauseService.setupAutoPause();
  }

  /** Activate focus trap and focus the Resume button inside the pause overlay. */
  private activatePauseFocus(): void {
    setTimeout(() => {
      if (this.pauseOverlayRef) {
        this.pauseFocusTrap.activate(this.pauseOverlayRef.nativeElement);
        const resumeBtn = this.pauseOverlayRef.nativeElement.querySelector('.pause-action--primary') as HTMLElement;
        resumeBtn?.focus();
      }
    }, 0);
  }

  get isPaused(): boolean {
    return this.gameState.isPaused;
  }

  get pauseEncounterLabel(): string {
    const encounter = this.runService.getCurrentEncounter();
    if (!encounter) return '';
    return PAUSE_ENCOUNTER_LABELS[encounter.nodeType] ?? '';
  }

  toggleEndless(): void {
    if (this.gameState.phase !== GamePhase.SETUP) return;
    const newValue = !this.gameState.isEndless;
    this.gameStateService.setEndlessMode(newValue);
    this.waveService.setEndlessMode(newValue);
  }

  // --- Tutorial --- (delegated to TutorialFacadeService)

  getTutorialTip() { return this.tutorialFacade.getTutorialTip(); }
  getTutorialStepNumber() { return this.tutorialFacade.getTutorialStepNumber(); }
  getTutorialTotalSteps() { return this.tutorialFacade.getTutorialTotalSteps(); }
  advanceTutorial() { this.tutorialFacade.advanceTutorial(); }
  skipTutorial() { this.tutorialFacade.skipTutorial(); }

  /** Formats the total COMBAT elapsed time as "MM:SS". */
  get formattedTime(): string {
    const totalSeconds = Math.floor(this.gameState.elapsedTime);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  get enemiesAlive(): number {
    return this.enemyService.getLivingEnemyCount();
  }

  get enemiesToSpawn(): number {
    return this.waveService.getRemainingToSpawn();
  }

  /**
   * Phase 4: at-a-glance spawn preview for the next few turns. Populated by
   * the combat shell during PLAYER_TURN so the player can plan ahead. Empty
   * array when not in COMBAT. User-requested feature.
   */
  get upcomingSpawns(): Array<{ turnOffset: number; spawns: { type: EnemyType; count: number }[] }> {
    if (this.gameState.phase !== GamePhase.COMBAT) return [];
    return this.waveService.getUpcomingSpawnsPreview(SPAWN_PREVIEW_TURNS);
  }

  /**
   * Future-wave composition summary for the HUD — populated only when the
   * player has a wave-preview bonus (SCOUTING_LENS relic or SCOUT_AHEAD /
   * SCOUT_ELITE scout spells). Empty array when no bonus is active, so the
   * UI section can `*ngIf` itself out of the render tree.
   */
  get futureWavesPreview(): FutureWaveSummary[] {
    if (this.gameState.phase !== GamePhase.COMBAT && this.gameState.phase !== GamePhase.INTERMISSION) return [];
    // `this.gameState.wave` is 1-indexed; convert to the 0-indexed wave array index.
    return this.wavePreviewService.getFutureWavesSummary(this.gameState.wave - 1);
  }

  /** Phase 4: current turn number (1-indexed for display). */
  get currentTurnNumber(): number {
    return this.combatLoopService.getTurnNumber() + 1;
  }

  toggleAllRanges(): void {
    this.showAllRanges = this.rangeVisualizationService.toggleAllRanges(
      this.showAllRanges,
      this.towerCombatService.getPlacedTowers(),
      this.gameBoardService.getBoardWidth(),
      this.gameBoardService.getBoardHeight(),
      this.gameBoardService.getTileSize(),
      this.sceneService.getScene()
    );
  }

  togglePathOverlay(): void {
    this.showPathOverlay = !this.showPathOverlay;

    if (this.showPathOverlay) {
      this.refreshPathOverlay();
    } else {
      this.pathVisualizationService.hidePath(this.sceneService.getScene());
    }
  }

  private refreshPathOverlay(): void {
    if (!this.showPathOverlay) return;
    const worldPath = this.enemyService.getPathToExit();
    if (worldPath.length > 0) {
      this.pathVisualizationService.showPath(worldPath, this.sceneService.getScene());
    } else {
      this.pathVisualizationService.hidePath(this.sceneService.getScene());
    }
  }

  // --- Cleanup ---

  ngOnDestroy(): void {
    this.pauseFocusTrap.deactivate();
    this.gameRenderService.stopLoop();

    if (this.pathBlockedTimerId !== null) {
      clearTimeout(this.pathBlockedTimerId);
      this.pathBlockedTimerId = null;
    }

    if (this.turnBannerTimer !== null) {
      clearTimeout(this.turnBannerTimer);
      this.turnBannerTimer = null;
    }

    this.waveCombat.cleanup();
    this.tutorialFacade.cleanup();
    this.cardPlayService.cleanup();

    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }

    if (this.turnRecordsSubscription) {
      this.turnRecordsSubscription.unsubscribe();
      this.turnRecordsSubscription = null;
    }

    if (this.notificationSub) {
      this.notificationSub.unsubscribe();
    }

    if (this.hotkeySubscription) {
      this.hotkeySubscription.unsubscribe();
    }

    if (this.deckSub) {
      this.deckSub.unsubscribe();
      this.deckSub = null;
    }

    if (this.energySub) {
      this.energySub.unsubscribe();
      this.energySub = null;
    }

    this.gameInput.cleanup();
    this.gamePauseService.cleanup();
    window.removeEventListener('resize', this.resizeHandler);
    this.towerPlacementService.cleanup();
    this.boardPointer.cleanup();
    this.touchInteraction.cleanup();

    if (this.sceneService.getControls()) {
      this.sceneService.getControls().dispose();
    }

    if (this.sceneService.getScene()) {
      this.cleanupGameObjects();
    }

    this.audioService.cleanup();
    this.particleService.cleanup(this.sceneService.getScene());
    this.goldPopupService.cleanup(this.sceneService.getScene());
    this.screenShakeService.cleanup(this.sceneService.getCamera());
    this.fpsCounterService.reset();

    // Delegate renderer, passes, controls, context-loss handlers to SceneService
    this.sceneService.dispose();
  }
}
