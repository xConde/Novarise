import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
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
import { MinimapService, MinimapTerrainData, MinimapBoardSnapshot } from './services/minimap.service';
import { SettingsService } from '../../core/services/settings.service';
import { TowerPreviewService } from './services/tower-preview.service';
import { disposeMaterial } from './utils/three-utils';
import { TowerType, TowerSpecialization, TOWER_CONFIGS, TOWER_DESCRIPTIONS, PlacedTower, MAX_TOWER_LEVEL, TARGETING_MODE_LABELS } from './models/tower.model';
import { BlockType } from './models/game-board-tile';
import { DifficultyLevel, DIFFICULTY_PRESETS, GamePhase, GameSpeed, GameState, VALID_GAME_SPEEDS } from './models/game-state.model';
import { GameModifier, GAME_MODIFIER_CONFIGS, calculateModifierScoreMultiplier } from './models/game-modifier.model';
import { calculateScoreBreakdown, ScoreBreakdown } from './models/score.model';
import { TILE_EMISSIVE, UI_CONFIG } from './constants/ui.constants';
import { SCREEN_SHAKE_CONFIG } from './constants/effects.constants';
import { TOUCH_CONFIG } from './constants/touch.constants';
import { PHYSICS_CONFIG } from './constants/physics.constants';
import { EnemyType, ENEMY_STATS } from './models/enemy.model';
import { EnemyInfo, ENEMY_INFO } from './models/enemy-info.model';
import { TowerInfo, TOWER_INFO } from './models/tower-info.model';
import { WavePreviewEntry, getWavePreview, getWavePreviewFull } from './models/wave-preview.model';
import { PathVisualizationService } from './services/path-visualization.service';
import { StatusEffectService } from './services/status-effect.service';
import { StatusEffectType } from './constants/status-effect.constants';
import { TilePricingService, TilePriceInfo } from './services/tile-pricing.service';
import { PriceLabelService } from './services/price-label.service';
import { TutorialService, TutorialStep, TutorialTip } from '../../core/services/tutorial.service';
import { GameNotificationService, GameNotification, NotificationType } from './services/game-notification.service';
import { ChallengeTrackingService } from './services/challenge-tracking.service';
import { GameEndService } from './services/game-end.service';
import { TowerInteractionService } from './services/tower-interaction.service';
import { PathfindingService } from './services/pathfinding.service';
import { CampaignService } from '../../campaign/services/campaign.service';
import { CampaignMapService } from '../../campaign/services/campaign-map.service';

import { CampaignLevel } from '../../campaign/models/campaign.model';
import { ChallengeDefinition, ChallengeType, getChallengesForLevel } from '../../campaign/models/challenge.model';
import { ChallengeIndicator } from './components/game-hud/game-hud.component';
import { GameSessionService, CleanupSceneOpts } from './services/game-session.service';
import { CombatLoopService } from './services/combat-loop.service';
import { CombatFrameResult } from './models/combat-frame.model';
import { TileHighlightService } from './services/tile-highlight.service';
import { TowerAnimationService } from './services/tower-animation.service';
import { RangeVisualizationService } from './services/range-visualization.service';
import { TowerMeshFactoryService } from './services/tower-mesh-factory.service';
import { EnemyMeshFactoryService } from './services/enemy-mesh-factory.service';
import { GameInputService } from './services/game-input.service';
import { EnemyVisualService } from './services/enemy-visual.service';
import { EnemyHealthService } from './services/enemy-health.service';
import { ChainLightningService } from './services/chain-lightning.service';
import { ProjectileService } from './services/projectile.service';
import { GamePauseService } from './services/game-pause.service';
import { ChallengeDisplayService } from './services/challenge-display.service';
import { TowerUpgradeVisualService } from './services/tower-upgrade-visual.service';
import { TowerPlacementService } from './services/tower-placement.service';
import { TowerSelectionService } from './services/tower-selection.service';
import { FocusTrap } from '../../shared/utils/focus-trap.util';

/** A small tactical badge shown in the wave preview for each enemy type. */
export interface EnemyBadge {
  text: string;
  severity: 'info' | 'warning' | 'danger';
}

const TOWER_HOTKEYS: Record<string, TowerType> = {
  '1': TowerType.BASIC,
  '2': TowerType.SNIPER,
  '3': TowerType.SPLASH,
  '4': TowerType.SLOW,
  '5': TowerType.CHAIN,
  '6': TowerType.MORTAR,
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
  providers: [SceneService, EnemyService, EnemyVisualService, EnemyHealthService, PathfindingService, GameStateService, WaveService, TowerCombatService, ChainLightningService, ProjectileService, AudioService, ParticleService, ScreenShakeService, GoldPopupService, FpsCounterService, GameStatsService, DamagePopupService, MinimapService, TowerPreviewService, PathVisualizationService, StatusEffectService, TilePricingService, PriceLabelService, GameNotificationService, ChallengeTrackingService, GameEndService, GameSessionService, TowerInteractionService, CombatLoopService, TileHighlightService, TowerAnimationService, RangeVisualizationService, TowerMeshFactoryService, EnemyMeshFactoryService, GameInputService, GamePauseService, ChallengeDisplayService, TowerUpgradeVisualService, TowerPlacementService, TowerSelectionService]
})
export class GameBoardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;
  @ViewChild('pauseOverlay') pauseOverlayRef?: ElementRef<HTMLElement>;

  private readonly pauseFocusTrap = new FocusTrap();

  // Scene — delegated to SceneService

  // Interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private tileMeshes: Map<string, THREE.Mesh> = new Map();
  private hoveredTile: THREE.Mesh | null = null;
  private selectedTile: { row: number, col: number } | null = null;

  // Tower management
  private towerMeshes: Map<string, THREE.Group> = new Map();
  /** Cached flat array of tile meshes for raycasting — rebuilt on board changes. */
  private tileMeshArray: THREE.Mesh[] = [];
  /** Cached flat array of tower mesh children for raycasting — rebuilt on tower changes. */
  private towerChildrenArray: THREE.Object3D[] = [];
  private gridLines: THREE.Group | null = null;
  selectedTowerType: TowerType | null = TowerType.BASIC;
  private lastPreviewKey = ''; // "row-col-towerType-gold" — skip preview rebuild when unchanged
  /** Tile-specific cost shown in mode indicator during PLACE mode hover. 0 = not hovering a valid tile. */
  hoveredTileCost = 0;
  /** % increase over base cost for the hovered tile. */
  hoveredTilePercent = 0;

  // Tower info panel state — delegated to TowerSelectionService (get/set for template + test compat)
  get selectedTowerInfo(): PlacedTower | null { return this.towerSelectionService.selectedTowerInfo; }
  set selectedTowerInfo(v: PlacedTower | null) { this.towerSelectionService.selectedTowerInfo = v; }
  get selectedTowerStats(): { damage: number; range: number; fireRate: number; statusEffect?: StatusEffectType } | null { return this.towerSelectionService.selectedTowerStats; }
  set selectedTowerStats(v: { damage: number; range: number; fireRate: number; statusEffect?: StatusEffectType } | null) { this.towerSelectionService.selectedTowerStats = v; }
  get selectedTowerUpgradeCost(): number { return this.towerSelectionService.selectedTowerUpgradeCost; }
  /** Strategic tile premium % applied to the upgrade cost (0 = no premium). */
  get selectedTowerUpgradePercent(): number { return this.towerSelectionService.selectedTowerUpgradePercent; }
  get selectedTowerSellValue(): number { return this.towerSelectionService.selectedTowerSellValue; }
  /** Preview of stats after upgrading (null if at max level or below L2→L3 which needs spec). */
  get upgradePreview(): { damage: number; range: number; fireRate: number } | null { return this.towerSelectionService.upgradePreview; }
  set upgradePreview(v: { damage: number; range: number; fireRate: number } | null) { this.towerSelectionService.upgradePreview = v; }
  MAX_TOWER_LEVEL = MAX_TOWER_LEVEL;
  TowerSpecialization = TowerSpecialization;

  // Specialization choice state — delegated to TowerSelectionService
  get showSpecializationChoice(): boolean { return this.towerSelectionService.showSpecializationChoice; }
  set showSpecializationChoice(v: boolean) { this.towerSelectionService.showSpecializationChoice = v; }
  get specOptions(): { spec: TowerSpecialization; label: string; description: string; damage: number; range: number; fireRate: number }[] { return this.towerSelectionService.specOptions; }
  set specOptions(v: { spec: TowerSpecialization; label: string; description: string; damage: number; range: number; fireRate: number }[]) { this.towerSelectionService.specOptions = v; }

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
  scoreBreakdown: ScoreBreakdown | null = null;
  /** Pre-computed star array — set alongside scoreBreakdown to avoid per-CD allocation. */
  starArray: Array<'filled' | 'empty'> = [];

  // Achievements unlocked at game end
  newlyUnlockedAchievements: string[] = [];
  achievementDetails: Achievement[] = [];

  /** Challenge completions awarded at end of this game session. */
  completedChallenges: ChallengeDefinition[] = [];

  /** Live challenge progress badges shown in HUD during campaign games. Delegated to ChallengeDisplayService. */
  get challengeIndicators(): ChallengeIndicator[] { return this.challengeDisplayService.indicators; }

  // Wave preview — shown during SETUP and INTERMISSION
  wavePreview: WavePreviewEntry[] = [];
  /** Template description for the upcoming endless wave (null for scripted waves). */
  waveTemplateDescription: string | null = null;
  // Wave income feedback — shown during INTERMISSION
  lastWaveReward = 0;
  lastInterestEarned = 0;
  // Wave transition visual feedback
  waveClearMessage = '';
  showWaveClear = false;
  waveStartPulse = false;
  private waveClearTimerId: ReturnType<typeof setTimeout> | null = null;
  private waveStartPulseTimerId: ReturnType<typeof setTimeout> | null = null;
  showAllRanges = false;
  showPathOverlay = false;
  get sellConfirmPending(): boolean { return this.towerSelectionService.sellConfirmPending; }
  set sellConfirmPending(v: boolean) { this.towerSelectionService.sellConfirmPending = v; }
  /** Tower type currently being previewed on touch devices (first tap). Null = no preview open. */
  previewTowerType: TowerType | null = null;
  targetingModeLabels = TARGETING_MODE_LABELS;
  showHelpOverlay = false;
  showEncyclopedia = false;
  encyclopediaTab: 'enemies' | 'towers' = 'enemies';
  enemyInfoList: EnemyInfo[] = Object.values(ENEMY_INFO);
  towerInfoList: TowerInfo[] = Object.values(TOWER_INFO);
  /**
   * Pre-computed badge map — one array per EnemyType, built once at field initialisation.
   * Enemy stats and immunities are static, so there is no need to recompute per render cycle.
   */
  readonly enemyBadgeMap: ReadonlyMap<EnemyType, EnemyBadge[]> = buildEnemyBadgeMap();
  pathBlocked = false;
  private pathBlockedTimerId: ReturnType<typeof setTimeout> | null = null;

  // Animation
  private lastTime = 0;
  /** Cached minimap terrain data — static after board setup, rebuilt on board import. */
  private cachedMinimapTerrain: MinimapTerrainData | null = null;
  /** Reusable tower position list for updateMinimap() — avoids per-frame array allocation. */
  private readonly minimapTowerPositions: { row: number; col: number }[] = [];
  /** Reusable enemy position list for updateMinimap() — avoids per-frame array allocation. */
  private readonly minimapEnemyPositions: { row: number; col: number }[] = [];
  private defeatSoundPlayed = false;
  private victorySoundPlayed = false;
  private mousemoveHandler: (event: MouseEvent) => void = () => {};
  private clickHandler: (event: MouseEvent) => void = () => {};
  private contextmenuHandler: (event: MouseEvent) => void = () => {};
  private animationFrameId = 0;
  private resizeHandler: () => void = () => {};
  private stateSubscription: Subscription | null = null;
  private hotkeySubscription: Subscription | null = null;

  // WebGL context loss recovery (handlers live in SceneService; component owns the flag)
  contextLost = false;

  // Game initialization failure (WebGL not supported or canvas creation failed)
  initializationFailed = false;

  // FPS counter visibility from settings
  showFps = false;

  // Touch interaction
  private touchStartHandler: (event: TouchEvent) => void = () => {};
  private touchMoveHandler: (event: TouchEvent) => void = () => {};
  private touchEndHandler: (event: TouchEvent) => void = () => {};
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private touchIsDragging = false;
  private pinchStartDistance = 0;

  // Drag-and-drop tower placement — delegated to TowerPlacementService
  get isDragging(): boolean { return this.towerPlacementService.isDragging; }

  // Auto-pause / quit state delegated to GamePauseService
  get autoPaused(): boolean { return this.gamePauseService.autoPaused; }
  get showQuitConfirm(): boolean { return this.gamePauseService.showQuitConfirm; }

  // Tutorial state
  currentTutorialStep: TutorialStep | null = null;
  private tutorialSub: Subscription | null = null;
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

  // FPS exposed to template
  get fps(): number { return this.fpsCounterService.getFps(); }

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
    private tilePricingService: TilePricingService,
    private priceLabelService: PriceLabelService,
    private tutorialService: TutorialService,
    private campaignService: CampaignService,
    private campaignMapService: CampaignMapService,
    private notificationService: GameNotificationService,
    private challengeTrackingService: ChallengeTrackingService,
    private gameEndService: GameEndService,
    private gameSessionService: GameSessionService,
    private towerInteractionService: TowerInteractionService,
    private combatLoopService: CombatLoopService,
    private tileHighlightService: TileHighlightService,
    private towerAnimationService: TowerAnimationService,
    private rangeVisualizationService: RangeVisualizationService,
    private towerMeshFactory: TowerMeshFactoryService,
    private gameInput: GameInputService,
    private gamePauseService: GamePauseService,
    private challengeDisplayService: ChallengeDisplayService,
    private towerUpgradeVisualService: TowerUpgradeVisualService,
    private towerPlacementService: TowerPlacementService,
    private towerSelectionService: TowerSelectionService
  ) {
    this.gameState = this.gameStateService.getState();
  }

  ngOnInit(): void {
    this.showFps = this.settingsService.get().showFps;

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

      // Compute score breakdown the first time we enter a terminal phase
      if (
        (state.phase === GamePhase.VICTORY || state.phase === GamePhase.DEFEAT) &&
        prevPhase !== GamePhase.VICTORY &&
        prevPhase !== GamePhase.DEFEAT
      ) {
        // Flush any accumulated elapsed time before scoring so the final time is accurate
        this.combatLoopService.flushElapsedTime();
        const livesTotal = DIFFICULTY_PRESETS[state.difficulty].lives;
        this.scoreBreakdown = calculateScoreBreakdown(
          state.score,
          state.lives,
          livesTotal,
          state.difficulty,
          state.wave,
          state.phase === GamePhase.VICTORY,
          this.gameStateService.getModifierScoreMultiplier()
        );
        this.starArray = [0, 1, 2].map(i => i < this.scoreBreakdown!.stars ? 'filled' : 'empty') as Array<'filled' | 'empty'>;
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

    // Apply per-campaign-level wave definitions if this is a campaign map
    this.gameSessionService.applyCampaignWaves();

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

    // Seed initial wave preview for the first wave (after applyCampaignWaves sets custom defs)
    const initialState = this.gameStateService.getState();
    const initialCustomDefs = this.waveService.hasCustomWaves()
      ? this.waveService.getWaveDefinitions()
      : undefined;
    const initialPreview = getWavePreviewFull(initialState.wave + 1, initialState.isEndless, initialCustomDefs);
    this.wavePreview = initialPreview.entries;
    this.waveTemplateDescription = initialPreview.templateDescription;

    // Track games played, then start appropriate tutorial/tips sequence
    this.tutorialService.incrementGamesPlayed();
    if (!this.tutorialService.isTutorialComplete()) {
      this.tutorialService.startTutorial();
    } else {
      this.tutorialService.startTips();
    }
    this.tutorialSub = this.tutorialService.getCurrentStep().subscribe({
      next: step => { this.currentTutorialStep = step; },
      error: (error: unknown) => console.error('Tutorial subscription error:', error)
    });

    // Subscribe to toast notifications
    this.notificationSub = this.notificationService.getNotifications().subscribe({
      next: notifs => { this.notifications = notifs; },
      error: (error: unknown) => console.error('Notification subscription error:', error)
    });
  }

  ngAfterViewInit(): void {
    try {
      this.sceneService.initRenderer(
        this.canvasContainer.nativeElement,
        () => {
          this.contextLost = true;
          if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = 0;
          }
        },
        () => {
          this.contextLost = false;
          if (!this.animationFrameId) {
            this.animate();
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
    this.setupMouseInteraction();
    this.setupTouchInteraction();
    this.towerPlacementService.init(this.raycaster, this.mouse, () => this.tileMeshArray, {
      onEnterPlaceMode: (type) => { this.selectedTowerType = type; this.updateTileHighlights(); },
      onPlaceAttempt: (row, col) => this.tryPlaceTower(row, col),
      onDeselectTower: () => this.deselectTower(),
    });
    this.gameInput.init();
    this.hotkeySubscription = this.gameInput.hotkey$.subscribe(e => this.handleKeyboard(e));
    this.minimapService.init(this.canvasContainer.nativeElement);
    this.setupAutoPause();
    this.animate();
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

  /** Navigate back to map select — used by the game initialization failure overlay. */
  goBackToMaps(): void {
    this.router.navigate(['/maps']);
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

  /**
   * Tile-specific tower cost including strategic pricing.
   * Returns the actual cost to place the selected tower on this tile.
   */
  getTileTowerCost(type: TowerType, row: number, col: number): TilePriceInfo {
    const costMult = this.gameStateService.getModifierEffects().towerCostMultiplier ?? 1;
    return this.tilePricingService.getTilePrice(type, row, col, costMult);
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
    this.selectedTowerType = null;
    this.lastPreviewKey = '';
    this.hoveredTileCost = 0;
    this.hoveredTilePercent = 0;
    this.clearTileHighlights();
    if (this.sceneService.getScene()) {
      this.towerPreviewService.hidePreview(this.sceneService.getScene());
    }
  }

  /** Whether a tower type is selected for placement (PLACE mode). */
  get isPlaceMode(): boolean {
    return this.selectedTowerType !== null;
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
      this.tileHighlightService.clearHighlights(this.tileMeshes, this.sceneService.getScene());
      return;
    }
    const costMult = this.gameStateService.getModifierEffects().towerCostMultiplier ?? 1;
    this.tileHighlightService.updateHighlights(
      this.selectedTowerType!,
      this.tileMeshes,
      this.selectedTile,
      this.sceneService.getScene(),
      costMult
    );
  }

  /** Remove placement highlights from all tiles, restoring their original emissive. */
  private clearTileHighlights(): void {
    this.tileHighlightService.clearHighlights(this.tileMeshes, this.sceneService.getScene());
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

    this.showSpecializationChoice = false;
    this.specOptions = [];
    this.audioService.playTowerUpgrade();

    // Scale/emissive/specialization tint delegated to TowerUpgradeVisualService
    const towerMesh = this.towerMeshes.get(this.selectedTowerInfo.id);
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

    // Remove mesh from scene (visual concern — stays here)
    const towerMesh = this.towerMeshes.get(this.selectedTowerInfo.id);
    if (towerMesh) {
      this.sceneService.getScene().remove(towerMesh);
      towerMesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
      this.towerMeshes.delete(this.selectedTowerInfo.id);
      this.rebuildTowerChildrenArray();
    }

    this.lastPreviewKey = '';
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

  /** True when the current map is a campaign level (mapId starts with 'campaign_'). */
  get isCampaignGame(): boolean {
    const mapId = this.mapBridge.getMapId();
    return !!mapId && mapId.startsWith('campaign_');
  }

  /**
   * True when the game was launched from the editor (map state loaded but no saved mapId).
   * The editor calls setEditorMapState(state) without a mapId, while map-select and campaign
   * always pass one. Quickplay has no map state at all.
   */
  get isEditorOrigin(): boolean {
    return this.mapBridge.hasEditorMap() && this.mapBridge.getMapId() === null;
  }

  /** Returns the CampaignLevel for the current map, or null if not a campaign game. */
  get currentCampaignLevel(): CampaignLevel | null {
    const mapId = this.mapBridge.getMapId();
    if (!mapId) return null;
    return this.campaignService.getLevel(mapId) ?? null;
  }

  /** Returns the next campaign level after the current one, or null if none exists. */
  get nextCampaignLevel(): CampaignLevel | null {
    const mapId = this.mapBridge.getMapId();
    if (!mapId) return null;
    return this.campaignService.getNextLevel(mapId);
  }

  /** Returns the SPEED_RUN timeLimit for the current campaign level, or 0 if none. */
  get activeSpeedRunTimeLimit(): number {
    if (!this.isCampaignGame || !this.currentCampaignLevel) return 0;
    const challenges = getChallengesForLevel(this.currentCampaignLevel.id);
    const speedRun = challenges.find((c: ChallengeDefinition) => c.type === ChallengeType.SPEED_RUN);
    return speedRun?.timeLimit ?? 0;
  }

  /** True when the next campaign level exists and is unlocked. */
  get isNextLevelUnlocked(): boolean {
    const next = this.nextCampaignLevel;
    return !!next && this.campaignService.isUnlocked(next.id);
  }

  /** Returns all challenge definitions for the current campaign level. Empty for non-campaign maps. */
  get campaignChallenges(): ChallengeDefinition[] {
    const mapId = this.mapBridge.getMapId();
    if (!mapId) return [];
    return getChallengesForLevel(mapId);
  }

  /** True when the given challenge was already completed in a previous run. */
  isChallengeAlreadyCompleted(challengeId: string): boolean {
    return this.campaignService.isChallengeCompleted(challengeId);
  }

  /** True when the challenge was completed in the current run (victory screen). */
  isChallengeCompleted(challenge: ChallengeDefinition): boolean {
    return this.completedChallenges.some(c => c.id === challenge.id);
  }

  /**
   * Recomputes challenge progress badges for the HUD via ChallengeDisplayService.
   * Called after any tower event (place, sell, upgrade) and on restart.
   */
  updateChallengeIndicators(): void {
    const levelId = this.currentCampaignLevel?.id ?? null;
    this.challengeDisplayService.updateIndicators(levelId);
  }

  /** Loads the next campaign level and restarts the game. No-op if no next level. */
  playNextLevel(): void {
    const next = this.nextCampaignLevel;
    if (!next) return;
    const mapState = this.campaignMapService.loadLevel(next.id);
    if (!mapState) return;
    this.mapBridge.setEditorMapState(mapState, next.id);
    this.restartGame();
  }

  /** Navigate back to the campaign level select screen. */
  backToCampaign(): void {
    this.router.navigate(['/campaign']);
  }

  /** Show a centered "Wave X Clear!" banner for 2 seconds. Call when transitioning to INTERMISSION. */
  onWaveComplete(wave: number, perfectWave: boolean): void {
    this.waveClearMessage = perfectWave ? `Wave ${wave} Clear! Perfect!` : `Wave ${wave} Clear!`;
    this.showWaveClear = true;
    if (this.waveClearTimerId !== null) {
      clearTimeout(this.waveClearTimerId);
    }
    this.waveClearTimerId = setTimeout(() => {
      this.showWaveClear = false;
      this.waveClearTimerId = null;
    }, 2000);
  }

  /** Briefly pulse the wave counter in the HUD when a new wave begins. */
  private triggerWaveStartPulse(): void {
    this.waveStartPulse = true;
    if (this.waveStartPulseTimerId !== null) {
      clearTimeout(this.waveStartPulseTimerId);
    }
    this.waveStartPulseTimerId = setTimeout(() => {
      this.waveStartPulse = false;
      this.waveStartPulseTimerId = null;
    }, 300);
  }

  startWave(): void {
    const state = this.gameStateService.getState();
    if (state.phase === GamePhase.COMBAT) return;
    if (state.phase === GamePhase.VICTORY || state.phase === GamePhase.DEFEAT) return;

    this.lastWaveReward = 0;
    this.lastInterestEarned = 0;
    this.combatLoopService.resetLeakState();
    this.minimapService.show();

    this.gameStateService.startWave();
    const modEffects = this.gameStateService.getModifierEffects();
    const waveCountMult = modEffects.waveCountMultiplier ?? 1;
    this.waveService.startWave(this.gameStateService.getState().wave, this.sceneService.getScene(), waveCountMult);

    // Track which enemy types have been seen so the wave preview can show "NEW" badges
    const currentWave = this.gameStateService.getState().wave;
    const seenCustomDefs = this.waveService.hasCustomWaves()
      ? this.waveService.getWaveDefinitions()
      : undefined;
    const previewEntries = getWavePreview(
      currentWave,
      this.gameStateService.getState().isEndless,
      seenCustomDefs
    );
    for (const entry of previewEntries) {
      // Notify about new enemy types before marking them seen
      if (this.waveService.isNewType(entry.type)) {
        const info = ENEMY_INFO[entry.type];
        if (info) {
          this.notificationService.show(
            NotificationType.INFO,
            `New Enemy: ${info.name}`,
            info.special ?? info.description
          );
        }
      }
      this.waveService.markSeen(entry.type);
    }

    this.audioService.playWaveStart();
    this.triggerWaveStartPulse();
  }

  toggleEncyclopedia(): void {
    this.showEncyclopedia = !this.showEncyclopedia;
  }

  isNewEnemyType(type: EnemyType): boolean {
    return this.waveService.isNewType(type);
  }

  /** Returns the pre-computed tactical badges for a given enemy type. Always returns an array (never null). */
  getEnemyBadges(type: EnemyType): EnemyBadge[] {
    return this.enemyBadgeMap.get(type) ?? [];
  }

  restartGame(): void {
    // Reset interaction state — old references point to disposed meshes
    this.hoveredTile = null;
    this.selectedTile = null;
    this.selectedTowerType = TowerType.BASIC;
    // Cancel any active drag — remove global listeners before cleanup
    this.towerPlacementService.cancelDrag();

    this.cleanupGameObjects();

    // Reset all services (enemies, combat, status effects, audio, pricing, minimap, etc.)
    this.gameSessionService.resetAllServices(this.sceneService.getScene());
    this.combatLoopService.reset();

    // Reset component-only UI state
    this.scoreBreakdown = null;
    this.starArray = [];
    this.newlyUnlockedAchievements = [];
    this.achievementDetails = [];
    this.completedChallenges = [];
    this.challengeDisplayService.updateIndicators(null); // clear on restart; re-populated by updateChallengeIndicators()
    this.lastWaveReward = 0;
    this.lastInterestEarned = 0;
    this.activeModifiers = new Set<GameModifier>();
    this.modifierScoreMultiplier = 1.0;
    this.wavePreview = [];
    this.waveTemplateDescription = null;
    this.defeatSoundPlayed = false;
    this.victorySoundPlayed = false;
    this.showHelpOverlay = false;
    this.showEncyclopedia = false;
    this.showPathOverlay = false;
    this.gamePauseService.reset();
    this.sellConfirmPending = false;
    this.contextLost = false;
    this.pathBlocked = false;
    if (this.pathBlockedTimerId !== null) {
      clearTimeout(this.pathBlockedTimerId);
      this.pathBlockedTimerId = null;
    }
    if (this.waveClearTimerId !== null) {
      clearTimeout(this.waveClearTimerId);
      this.waveClearTimerId = null;
    }
    if (this.waveStartPulseTimerId !== null) {
      clearTimeout(this.waveStartPulseTimerId);
      this.waveStartPulseTimerId = null;
    }
    this.showWaveClear = false;
    this.waveClearMessage = '';
    this.waveStartPulse = false;
    this.previewTowerType = null;
    this.encyclopediaTab = 'enemies';

    this.importBoard();

    // Re-apply campaign waves after waveService.reset() (which clears custom waves)
    this.gameSessionService.applyCampaignWaves();

    this.renderGameBoard();
    this.addGridLines();
    this.sceneService.initLights();
    this.sceneService.initSkybox();
    this.sceneService.initParticles();
    this.minimapService.init(this.canvasContainer.nativeElement);
    this.tilePricingService.invalidateCache();
    this.cachedMinimapTerrain = null;
    this.lastPreviewKey = '';
    this.lastTime = 0;
    this.updateTileHighlights();
  }


  /**
   * Import the editor map into the game board service, or reset to default if no valid map.
   * Shared between ngOnInit() and restartGame().
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

  /** Shared cleanup for game objects — used by both restartGame() and ngOnDestroy(). */
  private cleanupGameObjects(): void {
    // Clean up enemies — snapshot keys to avoid mutating Map during iteration
    for (const id of Array.from(this.enemyService.getEnemies().keys())) {
      this.enemyService.removeEnemy(id, this.sceneService.getScene());
    }

    // Delegate Three.js disposal + service cleanup to GameSessionService
    const opts: CleanupSceneOpts = {
      tileMeshes: this.tileMeshes,
      towerMeshes: this.towerMeshes,
      gridLines: this.gridLines,
    };
    this.gridLines = this.gameSessionService.cleanupScene(opts);
    // Maps are cleared in-place by cleanupScene; reset the derived arrays
    this.towerChildrenArray = [];
    this.tileMeshArray = [];

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
        this.tileMeshes.set(`${rowIndex}-${colIndex}`, mesh);
        this.sceneService.getScene().add(mesh);
      });
    });

    this.buildMinimapTerrainCache();
    this.rebuildTileMeshArray();
    this.rebuildTowerChildrenArray();
  }

  /** Builds and caches the static minimap terrain data after board setup. */
  private buildMinimapTerrainCache(): void {
    const snapshot: MinimapBoardSnapshot = {
      boardWidth: this.gameBoardService.getBoardWidth(),
      boardHeight: this.gameBoardService.getBoardHeight(),
      spawnerTiles: this.gameBoardService.getSpawnerTiles(),
      exitTiles: this.gameBoardService.getExitTiles(),
      getTileType: (row: number, col: number) => {
        const board = this.gameBoardService.getGameBoard();
        return board?.[row]?.[col]?.type;
      },
    };
    this.cachedMinimapTerrain = this.minimapService.buildTerrainCache(snapshot);
  }

  private addGridLines(): void {
    if (this.gridLines) {
      this.sceneService.getScene().remove(this.gridLines);
      this.gridLines.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    }
    this.gridLines = this.gameBoardService.createGridLines();
    this.sceneService.getScene().add(this.gridLines);
  }

  /** Rebuild the cached tile mesh array. Call after any board mutation. */
  private rebuildTileMeshArray(): void {
    this.tileMeshArray = Array.from(this.tileMeshes.values());
  }

  /** Rebuild the cached tower children array. Call after tower placement or removal. */
  private rebuildTowerChildrenArray(): void {
    this.towerChildrenArray = [];
    for (const group of this.towerMeshes.values()) {
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          this.towerChildrenArray.push(child);
        }
      });
    }
  }

  // --- Interaction ---

  private setupMouseInteraction(): void {
    const canvas = this.sceneService.getRenderer().domElement;

    this.mousemoveHandler = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.sceneService.getCamera());
      const intersects = this.raycaster.intersectObjects(this.tileMeshArray);

      if (this.hoveredTile && this.hoveredTile !== this.getSelectedTileMesh()) {
        this.tileHighlightService.restoreAfterHover(this.hoveredTile);
      }

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        if (mesh !== this.getSelectedTileMesh()) {
          this.hoveredTile = mesh;
          const material = mesh.material as THREE.MeshStandardMaterial;
          material.emissiveIntensity = TILE_EMISSIVE.hover;
          canvas.style.cursor = 'pointer';
        }

        // Tower placement preview — only show ghost tower in PLACE mode
        const row = mesh.userData['row'];
        const col = mesh.userData['col'];
        const phase = this.gameStateService.getState().phase;
        const isTerminal = phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT;
        if (!isTerminal && !this.selectedTowerInfo && this.isPlaceMode) {
          const previewKey = `${row}-${col}-${this.selectedTowerType}-${this.gameState.gold}`;
          if (previewKey !== this.lastPreviewKey) {
            this.lastPreviewKey = previewKey;
            const tilePrice = this.getTileTowerCost(this.selectedTowerType!, row, col);
            this.hoveredTileCost = tilePrice.cost;
            this.hoveredTilePercent = tilePrice.percentIncrease;
            const tileCost = tilePrice.cost;
            const canPlace = this.gameBoardService.canPlaceTower(row, col)
              && this.gameStateService.canAfford(tileCost);
            this.towerPreviewService.showPreview(this.selectedTowerType!, row, col, canPlace, this.sceneService.getScene());
          }
        } else {
          this.lastPreviewKey = '';
          this.hoveredTileCost = 0;
    this.hoveredTilePercent = 0;
          this.towerPreviewService.hidePreview(this.sceneService.getScene());
        }
      } else {
        this.hoveredTile = null;
        canvas.style.cursor = 'default';
        this.lastPreviewKey = '';
        this.hoveredTileCost = 0;
    this.hoveredTilePercent = 0;
        this.towerPreviewService.hidePreview(this.sceneService.getScene());
      }
    };

    this.clickHandler = (event: MouseEvent) => {
      this.handleInteraction(event.clientX, event.clientY);
    };

    this.contextmenuHandler = (event: MouseEvent) => {
      event.preventDefault();
      if (this.isDragging) {
        this.towerPlacementService.cancelDrag();
      } else if (this.isPlaceMode) {
        this.cancelPlacement();
      }
    };

    canvas.addEventListener('mousemove', this.mousemoveHandler);
    canvas.addEventListener('click', this.clickHandler);
    canvas.addEventListener('contextmenu', this.contextmenuHandler);
  }

  private setupTouchInteraction(): void {
    const canvas = this.sceneService.getRenderer().domElement;

    this.touchStartHandler = (event: TouchEvent) => {
      event.preventDefault();

      if (event.touches.length === 1) {
        // Single-finger: record start position and time for tap/drag detection
        const touch = event.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartTime = performance.now();
        this.touchIsDragging = false;
      } else if (event.touches.length === 2) {
        // Two-finger: record initial pinch distance for zoom
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        this.pinchStartDistance = Math.sqrt(dx * dx + dy * dy);
      }
    };

    this.touchMoveHandler = (event: TouchEvent) => {
      event.preventDefault();
      if (!this.sceneService.getCamera() || !this.sceneService.getControls()) return;

      if (event.touches.length === 1) {
        const touch = event.touches[0];
        const dx = touch.clientX - this.touchStartX;
        const dy = touch.clientY - this.touchStartY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > TOUCH_CONFIG.tapThresholdPx) {
          this.touchIsDragging = true;
        }

        if (this.touchIsDragging) {
          // Pan camera: map drag delta to world-space pan
          const panX = -dx * TOUCH_CONFIG.dragSensitivity;
          const panZ = -dy * TOUCH_CONFIG.dragSensitivity;
          this.sceneService.getCamera().position.x += panX;
          this.sceneService.getCamera().position.z += panZ;
          this.sceneService.getControls().target.x += panX;
          this.sceneService.getControls().target.z += panZ;

          // Update start for incremental panning each move event
          this.touchStartX = touch.clientX;
          this.touchStartY = touch.clientY;
        }
      } else if (event.touches.length === 2) {
        // Pinch zoom: compare current distance to start distance
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);

        if (this.pinchStartDistance > 0) {
          const delta = this.pinchStartDistance - currentDistance;
          const zoomDelta = delta * TOUCH_CONFIG.pinchZoomSpeed;
          const dir = new THREE.Vector3()
            .subVectors(this.sceneService.getCamera().position, this.sceneService.getControls().target)
            .normalize();
          const newPos = this.sceneService.getCamera().position.clone().addScaledVector(dir, zoomDelta);
          const newDist = newPos.distanceTo(this.sceneService.getControls().target);

          if (newDist >= TOUCH_CONFIG.minZoom && newDist <= TOUCH_CONFIG.maxZoom) {
            this.sceneService.getCamera().position.copy(newPos);
          }
        }

        this.pinchStartDistance = currentDistance;
      }
    };

    this.touchEndHandler = (event: TouchEvent) => {
      event.preventDefault();

      if (event.changedTouches.length === 1 && !this.touchIsDragging) {
        const elapsed = performance.now() - this.touchStartTime;
        if (elapsed < TOUCH_CONFIG.tapThresholdMs) {
          // Short tap with no drag — treat as a click at the original touch position
          this.handleInteraction(this.touchStartX, this.touchStartY);
        }
      }

      this.touchIsDragging = false;
      this.pinchStartDistance = 0;
    };

    canvas.addEventListener('touchstart', this.touchStartHandler, { passive: false });
    canvas.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
    canvas.addEventListener('touchend', this.touchEndHandler, { passive: false });
  }

  /** Unified click/tap handler — raycasts to towers then tiles at (clientX, clientY). */
  private handleInteraction(clientX: number, clientY: number): void {
    const canvas = this.sceneService.getRenderer().domElement;
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.sceneService.getCamera());

    // Check for tower mesh hits first (works in both PLACE and INSPECT modes)
    const towerHits = this.raycaster.intersectObjects(this.towerChildrenArray);

    if (towerHits.length > 0) {
      let hitObj: THREE.Object3D | null = towerHits[0].object;
      let foundKey: string | null = null;
      while (hitObj) {
        for (const [key, group] of this.towerMeshes) {
          if (group === hitObj) { foundKey = key; break; }
        }
        if (foundKey) break;
        hitObj = hitObj.parent;
      }
      if (foundKey) {
        this.selectPlacedTower(foundKey);
        return;
      }
    }

    // Check tile hits — only place towers in PLACE mode
    const intersects = this.raycaster.intersectObjects(this.tileMeshArray);

    const prevSelected = this.getSelectedTileMesh();
    if (prevSelected) {
      const material = prevSelected.material as THREE.MeshStandardMaterial;
      const tileType = prevSelected.userData['tile'].type;
      material.emissiveIntensity = tileType === BlockType.BASE ? TILE_EMISSIVE.base : tileType === BlockType.WALL ? TILE_EMISSIVE.wall : TILE_EMISSIVE.special;
    }

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      const row = mesh.userData['row'];
      const col = mesh.userData['col'];

      this.selectedTile = { row, col };

      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = TILE_EMISSIVE.selected;

      this.deselectTower();

      if (this.isPlaceMode) {
        this.tryPlaceTower(row, col);
      }
    } else {
      this.selectedTile = null;
      this.deselectTower();
    }
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
    if (!this.selectedTowerType) return;

    if (!this.gameBoardService.canPlaceTower(row, col)) {
      // Check specifically if this was a path-blocking rejection
      if (this.towerInteractionService.wouldBlockPath(row, col)) {
        this.showPathBlockedWarning();
      }
      return;
    }

    const result = this.towerInteractionService.placeTower(row, col, this.selectedTowerType);
    if (!result.success) return;

    // Create tower mesh and add to scene (visual concern — stays here)
    const towerMesh = this.towerMeshFactory.createTowerMesh(row, col, this.selectedTowerType, this.gameBoardService.getBoardWidth(), this.gameBoardService.getBoardHeight());
    this.towerMeshes.set(result.towerKey, towerMesh);
    this.sceneService.getScene().add(towerMesh);
    this.rebuildTowerChildrenArray();

    // Register tower with combat service (needs the mesh reference)
    this.towerCombatService.registerTower(row, col, this.selectedTowerType, towerMesh, result.cost);

    this.audioService.playTowerPlace();
    this.gameStatsService.recordTowerBuilt();

    // Hide preview and invalidate preview cache — board layout changed
    this.lastPreviewKey = '';
    this.towerPreviewService.hidePreview(this.sceneService.getScene());

    this.refreshPathOverlay();

    // Recompute valid tile highlights — board changed
    this.updateTileHighlights();
    this.updateChallengeIndicators();
  }

  private getSelectedTileMesh(): THREE.Mesh | null {
    if (!this.selectedTile) return null;
    return this.tileMeshes.get(`${this.selectedTile.row}-${this.selectedTile.col}`) || null;
  }

  // --- Pause menu ---

  /** Named constant for speed buttons (HUD and pause menu) — avoids template literal arrays. */
  readonly validGameSpeeds: readonly GameSpeed[] = VALID_GAME_SPEEDS;

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
    const route = this.gamePauseService.confirmQuit(this.isCampaignGame);
    this.router.navigate([route]);
  }

  /**
   * Called by the CanDeactivate guard when the player tries to navigate away mid-game.
   * Delegates to GamePauseService.
   */
  canLeaveGame(): boolean {
    return this.gamePauseService.canLeaveGame();
  }

  togglePause(): void {
    const willPause = this.gamePauseService.togglePause();
    if (!willPause) {
      this.pauseFocusTrap.deactivate();
    } else {
      setTimeout(() => {
        if (this.pauseOverlayRef) {
          this.pauseFocusTrap.activate(this.pauseOverlayRef.nativeElement);
        }
      }, 0);
    }
  }

  /** Register visibility/focus-loss listeners for auto-pause via GamePauseService.
   *  The service handles core pause logic; the component activates the focus trap after
   *  auto-pause triggers, since focus trap requires a ViewChild reference.
   */
  private setupAutoPause(): void {
    this.gamePauseService.onAutoPause = () => {
      setTimeout(() => {
        if (this.pauseOverlayRef) {
          this.pauseFocusTrap.activate(this.pauseOverlayRef.nativeElement);
        }
      }, 0);
    };
    this.gamePauseService.setupAutoPause();
  }

  setSpeed(speed: number): void {
    if ((VALID_GAME_SPEEDS as readonly number[]).includes(speed)) {
      this.gameStateService.setSpeed(speed as GameSpeed);
      this.settingsService.update({ gameSpeed: speed });
    }
  }

  get isPaused(): boolean {
    return this.gameState.isPaused;
  }

  toggleEndless(): void {
    if (this.isCampaignGame) return;
    if (this.gameState.phase !== GamePhase.SETUP) return;
    const newValue = !this.gameState.isEndless;
    this.gameStateService.setEndlessMode(newValue);
    this.waveService.setEndlessMode(newValue);
  }

  // --- Tutorial ---

  getTutorialTip(): TutorialTip | null {
    return this.currentTutorialStep ? this.tutorialService.getTip(this.currentTutorialStep) : null;
  }

  /** Controls tutorial steps shown to the user (excludes COMPLETE and tip steps). */
  private readonly tutorialDisplaySteps: TutorialStep[] = [
    TutorialStep.WELCOME,
    TutorialStep.SELECT_TOWER,
    TutorialStep.PLACE_TOWER,
    TutorialStep.START_WAVE,
    TutorialStep.UPGRADE_TOWER,
    TutorialStep.COMPLETE,
  ];

  /** Strategy tip steps (separate sequence). */
  private readonly tipsDisplaySteps: TutorialStep[] = [
    TutorialStep.TIP_PLACEMENT,
    TutorialStep.TIP_WAVE_PREVIEW,
    TutorialStep.TIP_UPGRADE,
  ];

  getTutorialStepNumber(): number {
    const step = this.currentTutorialStep;
    if (!step) return 0;
    const tipIdx = this.tipsDisplaySteps.indexOf(step);
    if (tipIdx >= 0) return tipIdx + 1;
    const idx = this.tutorialDisplaySteps.indexOf(step);
    return Math.max(1, idx + 1);
  }

  getTutorialTotalSteps(): number {
    const step = this.currentTutorialStep;
    if (!step) return 0;
    if (this.tipsDisplaySteps.includes(step)) return this.tipsDisplaySteps.length;
    return this.tutorialDisplaySteps.length;
  }

  advanceTutorial(): void {
    this.tutorialService.advanceStep();
  }

  skipTutorial(): void {
    this.tutorialService.skipTutorial();
  }

  get gameSpeed(): number {
    return this.gameState.gameSpeed;
  }

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

  private handleKeyboard(event: KeyboardEvent): void {
    const phase = this.gameStateService.getState().phase;
    if (phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT) return;

    if (TOWER_HOTKEYS[event.key]) { event.preventDefault(); this.selectTowerType(TOWER_HOTKEYS[event.key]); return; }

    switch (event.key) {
      case ' ': event.preventDefault(); this.startWave(); break;
      case 'p': case 'P': event.preventDefault(); this.togglePause(); break;
      case 'Escape':
        event.preventDefault();
        if (this.isPaused) { this.togglePause(); }
        else if (this.isPlaceMode) { this.cancelPlacement(); }
        else { this.deselectTower(); }
        break;
      case 'r': case 'R': event.preventDefault(); this.toggleAllRanges(); break;
      case 'h': case 'H': event.preventDefault(); this.showHelpOverlay = !this.showHelpOverlay; break;
      case 'e': case 'E': event.preventDefault(); this.toggleEncyclopedia(); break;
      case 'm': case 'M': event.preventDefault(); this.minimapService.toggleVisibility(); break;
      case 'v': case 'V': event.preventDefault(); this.togglePathOverlay(); break;
      case 'u': case 'U': event.preventDefault(); this.upgradeTower(); break;
      case 't': case 'T': event.preventDefault(); this.cycleTargeting(); break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        this.sellTower();
        break;
    }
  }

  // --- Game loop ---

  private animate = (time = 0): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const rawDelta = this.lastTime === 0 ? 0 : (time - this.lastTime) / 1000;
    const deltaTime = Math.min(rawDelta, PHYSICS_CONFIG.maxDeltaTime);
    this.lastTime = time;

    // Reset per-frame SFX counters so throttle limits apply per animation frame
    this.audioService.resetFrameCounters();

    // FPS tracking
    this.fpsCounterService.tick(time);

    // Camera pan (WASD / arrows)
    const camera = this.sceneService.getCamera();
    const controls = this.sceneService.getControls();
    if (camera && controls) {
      this.gameInput.updateCameraPan(camera, controls);
    }

    if (this.sceneService.getControls()) {
      this.sceneService.getControls().update();
    }

    // Ambient visuals (particles, skybox)
    this.sceneService.tickAmbientVisuals(time);

    // Combat tick
    if (deltaTime > 0) {
      const state = this.gameStateService.getState();
      if (state.phase === GamePhase.COMBAT && !state.isPaused) {
        const result = this.combatLoopService.tick(
          deltaTime,
          state.gameSpeed,
          this.sceneService.getScene(),
          this.scoreBreakdown,
        );
        this.processCombatResult(result, deltaTime, time);
      } else if (state.phase === GamePhase.COMBAT && state.isPaused) {
        // Even while paused, run cosmetic-only animations so they don't freeze.
        // Physics, spawning, and movement are NOT ticked.
        this.runPausedVisuals(deltaTime, time);
      }
    }

    // Animate tower idle effects and tile pulses
    this.towerAnimationService.updateTowerAnimations(this.towerMeshes, time);
    this.towerAnimationService.updateTilePulse(this.tileMeshes, time);
    this.towerAnimationService.updateMuzzleFlashes(this.towerCombatService.getPlacedTowers(), deltaTime);

    // Dying/hit/shield animations must run in ALL phases (not just COMBAT)
    // so enemies that die at the end of a wave finish their death animation
    // during INTERMISSION instead of freezing on the board.
    // Skip when runPausedVisuals already handled it (COMBAT + paused) to avoid double-tick.
    const pauseHandled = deltaTime > 0
      && this.gameStateService.getState().phase === GamePhase.COMBAT
      && this.gameStateService.getState().isPaused;
    if (deltaTime > 0 && !pauseHandled && this.enemyService.getEnemies().size > 0) {
      this.enemyService.updateDyingAnimations(deltaTime, this.sceneService.getScene());
      this.enemyService.updateHitFlashes(deltaTime);
      this.enemyService.updateShieldBreakAnimations(deltaTime);
    }

    // Update visual effects (run every frame regardless of pause)
    if (deltaTime > 0) {
      this.particleService.addPendingToScene(this.sceneService.getScene());
      this.particleService.update(deltaTime, this.sceneService.getScene());
      this.goldPopupService.update(deltaTime);
      this.damagePopupService.update(deltaTime);
      this.screenShakeService.update(deltaTime, this.sceneService.getCamera());
    }

    // Render
    this.sceneService.render();
  }

  private processCombatResult(result: CombatFrameResult, deltaTime: number, time: number): void {
    // Defeat sound (play once per defeat)
    if (result.defeatTriggered && !this.defeatSoundPlayed) {
      this.defeatSoundPlayed = true;
      this.audioService.playDefeat();
      // Restore minimap if it was hidden during INTERMISSION on mobile
      if (window.innerWidth <= 480) {
        this.minimapService.show();
      }
    }

    // Wave completion events
    if (result.waveCompletion) {
      const wc = result.waveCompletion;
      if (wc.streakBonus > 0) {
        this.audioService.playStreakSound();
        this.notificationService.show(
          NotificationType.STREAK,
          'Perfect Wave!',
          `+${wc.streakBonus}g streak bonus (${wc.streakCount} waves)`
        );
      }
      if (wc.resultPhase === GamePhase.VICTORY && !this.victorySoundPlayed) {
        this.victorySoundPlayed = true;
        this.audioService.playVictory();
        // Restore minimap if it was hidden during INTERMISSION on mobile
        if (window.innerWidth <= 480) {
          this.minimapService.show();
        }
      } else if (wc.resultPhase === GamePhase.INTERMISSION) {
        this.audioService.playWaveClear();
        this.lastWaveReward = wc.reward;
        this.lastInterestEarned = wc.interestEarned;
        const completedWave = this.gameStateService.getState().wave;
        const perfectWave = wc.streakBonus > 0;
        this.onWaveComplete(completedWave, perfectWave);
        // Hide minimap during intermission on mobile — frees space for Next Wave button
        if (window.innerWidth <= 480) {
          this.minimapService.hide();
        }
      }
    }

    // Game end (achievements, challenges)
    if (result.gameEnd) {
      this.newlyUnlockedAchievements = result.gameEnd.newlyUnlockedAchievements;
      this.completedChallenges = result.gameEnd.completedChallenges;
      this.updateAchievementDetails();
    }

    // Post-physics audio dispatch (tower fire sounds, hit sounds, kill sounds)
    for (const towerType of result.firedTypes) {
      this.audioService.playTowerFire(towerType);
    }
    if (result.hitCount > 0) {
      this.audioService.playEnemyHit();
    }
    for (const kill of result.kills) {
      this.audioService.playGoldEarned();
      this.audioService.playEnemyDeath();
      this.particleService.spawnDeathBurst(kill.position, kill.color);
      this.goldPopupService.spawn(kill.value, kill.position, this.sceneService.getScene());
      this.damagePopupService.spawn(kill.damage, kill.position, this.sceneService.getScene());
    }

    // Drain deferred combat audio events (chain lightning, mortar, etc.)
    for (const event of result.combatAudioEvents) {
      switch (event.type) {
        case 'sfx': this.audioService.playSfx(event.sfxKey); break;
        case 'tower_fire': this.audioService.playTowerFire(event.towerType); break;
        case 'enemy_hit': this.audioService.playEnemyHit(); break;
        case 'enemy_death': this.audioService.playEnemyDeath(); break;
      }
    }

    // Screen shake on life loss
    if (result.exitCount > 0) {
      this.screenShakeService.trigger(SCREEN_SHAKE_CONFIG.lifeLossIntensity, SCREEN_SHAKE_CONFIG.lifeLossDuration);
    }

    // Per-frame visual updates (health bars, status effects, minimap)
    // NOTE: dying/hit/shield animations are NOT called here — they run in the
    // phase-independent block in animate() (line ~2178) to avoid double-ticking.
    this.enemyService.updateHealthBars(this.sceneService.getCamera().quaternion);
    const activeEffects = this.statusEffectService.getAllActiveEffects();
    this.enemyService.updateStatusVisuals(activeEffects);
    this.enemyService.updateStatusEffectParticles(deltaTime, this.sceneService.getScene(), activeEffects);
    this.enemyService.updateEnemyAnimations(deltaTime);
    this.updateMinimap(time);
  }

  /**
   * Run cosmetic-only visual updates during pause.
   * Physics, spawning, and movement are NOT ticked — only animations that
   * were already in-progress (death, hit flash, shield break) continue to play
   * so the scene doesn't look frozen.
   */
  private runPausedVisuals(deltaTime: number, time: number): void {
    this.enemyService.updateDyingAnimations(deltaTime, this.sceneService.getScene());
    this.enemyService.updateHitFlashes(deltaTime);
    this.enemyService.updateShieldBreakAnimations(deltaTime);
    this.enemyService.updateHealthBars(this.sceneService.getCamera().quaternion);
    const activeEffects = this.statusEffectService.getAllActiveEffects();
    this.enemyService.updateStatusVisuals(activeEffects);
    this.enemyService.updateStatusEffectParticles(deltaTime, this.sceneService.getScene(), activeEffects);
    this.enemyService.updateEnemyAnimations(deltaTime);
    this.updateMinimap(time);
  }

  private updateMinimap(timeMs: number): void {
    // Ensure terrain cache is ready (fall back to building if not yet cached)
    if (!this.cachedMinimapTerrain) {
      this.buildMinimapTerrainCache();
    }

    // Build reusable position arrays — no per-frame allocation
    this.minimapTowerPositions.length = 0;
    this.towerCombatService.getPlacedTowers().forEach(tower => {
      this.minimapTowerPositions.push({ row: tower.row, col: tower.col });
    });
    this.minimapEnemyPositions.length = 0;
    this.enemyService.getEnemies().forEach(enemy => {
      this.minimapEnemyPositions.push({ row: enemy.gridPosition.row, col: enemy.gridPosition.col });
    });

    this.minimapService.updateWithEntities(timeMs, this.minimapTowerPositions, this.minimapEnemyPositions);
  }

  // --- Cleanup ---

  ngOnDestroy(): void {
    this.pauseFocusTrap.deactivate();
    cancelAnimationFrame(this.animationFrameId);

    if (this.pathBlockedTimerId !== null) {
      clearTimeout(this.pathBlockedTimerId);
      this.pathBlockedTimerId = null;
    }

    if (this.waveClearTimerId !== null) {
      clearTimeout(this.waveClearTimerId);
      this.waveClearTimerId = null;
    }

    if (this.waveStartPulseTimerId !== null) {
      clearTimeout(this.waveStartPulseTimerId);
      this.waveStartPulseTimerId = null;
    }

    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }

    if (this.tutorialSub) {
      this.tutorialSub.unsubscribe();
    }

    if (this.notificationSub) {
      this.notificationSub.unsubscribe();
    }

    if (this.hotkeySubscription) {
      this.hotkeySubscription.unsubscribe();
    }

    this.gameInput.cleanup();
    this.gamePauseService.cleanup();
    window.removeEventListener('resize', this.resizeHandler);
    this.towerPlacementService.removeDragListeners();

    // Remove canvas event listeners (stored as named references)
    if (this.sceneService.getRenderer()) {
      const canvas = this.sceneService.getRenderer().domElement;
      canvas.removeEventListener('mousemove', this.mousemoveHandler);
      canvas.removeEventListener('click', this.clickHandler);
      canvas.removeEventListener('contextmenu', this.contextmenuHandler);
      canvas.removeEventListener('touchstart', this.touchStartHandler);
      canvas.removeEventListener('touchmove', this.touchMoveHandler);
      canvas.removeEventListener('touchend', this.touchEndHandler);
    }

    if (this.sceneService.getControls()) {
      this.sceneService.getControls().dispose();
    }

    if (this.sceneService.getScene()) {
      this.cleanupGameObjects();
    }

    this.audioService.cleanup();
    this.particleService.cleanup(this.sceneService.getScene());
    this.goldPopupService.cleanup(this.sceneService.getScene());
    // priceLabelService already cleaned by cleanupGameObjects → GameSessionService.cleanupScene → clearHighlights
    this.screenShakeService.cleanup(this.sceneService.getCamera());
    this.fpsCounterService.reset();

    // Delegate renderer, passes, controls, context-loss handlers to SceneService
    this.sceneService.dispose();
  }
}
