import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import * as THREE from 'three';
import { GameBoardService } from './game-board.service';
import { SceneService } from './services/scene.service';
import { EnemyService } from './services/enemy.service';
import { MapBridgeService } from './services/map-bridge.service';
import { GameStateService } from './services/game-state.service';
import { WaveService } from './services/wave.service';
import { TowerCombatService } from './services/tower-combat.service';
import { AudioService } from './services/audio.service';
import { ParticleService } from './services/particle.service';
import { ScreenShakeService } from './services/screen-shake.service';
import { GoldPopupService } from './services/gold-popup.service';
import { FpsCounterService } from './services/fps-counter.service';
import { GameStatsService } from './services/game-stats.service';
import { PlayerProfileService, ACHIEVEMENTS, Achievement } from './services/player-profile.service';
import { DamagePopupService } from './services/damage-popup.service';
import { MinimapService, MinimapEntityData, MinimapTerrainData } from './services/minimap.service';
import { SettingsService } from './services/settings.service';
import { TowerPreviewService } from './services/tower-preview.service';
import { disposeMaterial } from './utils/three-utils';
import { TowerType, TowerSpecialization, TOWER_CONFIGS, TOWER_DESCRIPTIONS, TOWER_SPECIALIZATIONS, PlacedTower, MAX_TOWER_LEVEL, getUpgradeCost, getSellValue, getEffectiveStats, TARGETING_MODE_LABELS, TargetingMode, SpecializationStats } from './models/tower.model';
import { BlockType } from './models/game-board-tile';
import { DifficultyLevel, DIFFICULTY_PRESETS, GamePhase, GameSpeed, GameState, VALID_GAME_SPEEDS } from './models/game-state.model';
import { GameModifier, GAME_MODIFIER_CONFIGS, GameModifierConfig, calculateModifierScoreMultiplier } from './models/game-modifier.model';
import { calculateScoreBreakdown, ScoreBreakdown } from './models/score.model';
import { CAMERA_CONFIG } from './constants/camera.constants';
import { TOWER_VISUAL_CONFIG, TILE_EMISSIVE, UI_CONFIG } from './constants/ui.constants';
import { SCREEN_SHAKE_CONFIG } from './constants/effects.constants';
import { TOUCH_CONFIG, DRAG_CONFIG } from './constants/touch.constants';
import { PHYSICS_CONFIG } from './constants/physics.constants';
import { EnemyType } from './models/enemy.model';
import { EnemyInfo, ENEMY_INFO } from './models/enemy-info.model';
import { TowerInfo, TOWER_INFO } from './models/tower-info.model';
import { WavePreviewEntry, getWavePreview, getWavePreviewFull } from './models/wave-preview.model';
import { PathVisualizationService } from './services/path-visualization.service';
import { StatusEffectService } from './services/status-effect.service';
import { StatusEffectType } from './constants/status-effect.constants';
import { TilePricingService, TilePriceInfo } from './services/tile-pricing.service';
import { PriceLabelService } from './services/price-label.service';
import { TutorialService, TutorialStep, TutorialTip } from './services/tutorial.service';
import { GameNotificationService, GameNotification, NotificationType } from './services/game-notification.service';
import { ChallengeTrackingService } from './services/challenge-tracking.service';
import { GameEndService } from './services/game-end.service';
import { TowerInteractionService } from './services/tower-interaction.service';
import { PathfindingService } from './services/pathfinding.service';
import { CampaignService } from '../../campaign/services/campaign.service';
import { CampaignMapService } from '../../campaign/services/campaign-map.service';

import { CampaignLevel } from '../../campaign/models/campaign.model';
import { ChallengeDefinition, ChallengeType, getChallengesForLevel } from '../../campaign/models/challenge.model';
import { GameSessionService } from './services/game-session.service';
import { CombatLoopService } from './services/combat-loop.service';
import { CombatFrameResult } from './models/combat-frame.model';
import { TileHighlightService } from './services/tile-highlight.service';
import { TowerAnimationService } from './services/tower-animation.service';
import { RangeVisualizationService } from './services/range-visualization.service';
import { TowerMeshFactoryService } from './services/tower-mesh-factory.service';

const TOWER_HOTKEYS: Record<string, TowerType> = {
  '1': TowerType.BASIC,
  '2': TowerType.SNIPER,
  '3': TowerType.SPLASH,
  '4': TowerType.SLOW,
  '5': TowerType.CHAIN,
  '6': TowerType.MORTAR,
};

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss'],
  providers: [SceneService, EnemyService, PathfindingService, GameStateService, WaveService, TowerCombatService, AudioService, ParticleService, ScreenShakeService, GoldPopupService, FpsCounterService, GameStatsService, DamagePopupService, MinimapService, TowerPreviewService, PathVisualizationService, StatusEffectService, TilePricingService, PriceLabelService, GameNotificationService, ChallengeTrackingService, GameEndService, GameSessionService, TowerInteractionService, CombatLoopService, TileHighlightService, TowerAnimationService, RangeVisualizationService, TowerMeshFactoryService]
})
export class GameBoardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;


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

  // Tower info panel state (exposed to template)
  selectedTowerInfo: PlacedTower | null = null;
  selectedTowerStats: { damage: number; range: number; fireRate: number; statusEffect?: StatusEffectType } | null = null;
  selectedTowerUpgradeCost: number = 0;
  /** Strategic tile premium % applied to the upgrade cost (0 = no premium). */
  selectedTowerUpgradePercent: number = 0;
  selectedTowerSellValue: number = 0;
  /** Preview of stats after upgrading (null if at max level or below L2→L3 which needs spec). */
  upgradePreview: { damage: number; range: number; fireRate: number } | null = null;
  MAX_TOWER_LEVEL = MAX_TOWER_LEVEL;
  TowerSpecialization = TowerSpecialization;

  // Specialization choice state
  showSpecializationChoice = false;
  specOptions: { spec: TowerSpecialization; label: string; description: string; damage: number; range: number; fireRate: number }[] = [];

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

  // Wave preview — shown during SETUP and INTERMISSION
  wavePreview: WavePreviewEntry[] = [];
  /** Template description for the upcoming endless wave (null for scripted waves). */
  waveTemplateDescription: string | null = null;
  // Wave income feedback — shown during INTERMISSION
  lastWaveReward = 0;
  lastInterestEarned = 0;
  showAllRanges = false;
  showPathOverlay = false;
  sellConfirmPending = false;
  /** Tower type currently being previewed on touch devices (first tap). Null = no preview open. */
  previewTowerType: TowerType | null = null;
  targetingModeLabels = TARGETING_MODE_LABELS;
  showHelpOverlay = false;
  showEncyclopedia = false;
  encyclopediaTab: 'enemies' | 'towers' = 'enemies';
  enemyInfoList: EnemyInfo[] = Object.values(ENEMY_INFO);
  towerInfoList: TowerInfo[] = Object.values(TOWER_INFO);
  pathBlocked = false;
  private pathBlockedTimerId: ReturnType<typeof setTimeout> | null = null;

  // Animation
  private lastTime = 0;
  /** Cached minimap terrain data — static after board setup, rebuilt on board import. */
  private cachedMinimapTerrain: MinimapTerrainData | null = null;
  /** Reusable entity list for updateMinimap() — avoids per-frame array allocation. */
  private minimapEntities: MinimapEntityData[] = [];
  private defeatSoundPlayed = false;
  private victorySoundPlayed = false;
  private keyboardHandler: (event: KeyboardEvent) => void;
  private mousemoveHandler: (event: MouseEvent) => void = () => {};
  private clickHandler: (event: MouseEvent) => void = () => {};
  private contextmenuHandler: (event: MouseEvent) => void = () => {};
  private animationFrameId = 0;
  private resizeHandler: () => void = () => {};
  private stateSubscription: Subscription | null = null;

  // WebGL context loss recovery (handlers live in SceneService; component owns the flag)
  contextLost = false;

  // Touch interaction
  private touchStartHandler: (event: TouchEvent) => void = () => {};
  private touchMoveHandler: (event: TouchEvent) => void = () => {};
  private touchEndHandler: (event: TouchEvent) => void = () => {};
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private touchIsDragging = false;
  private pinchStartDistance = 0;

  // Drag-and-drop tower placement
  isDragging = false;
  private dragTowerType: TowerType | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragThresholdMet = false;
  private globalDragMoveHandler: EventListener = () => {};
  private globalDragEndHandler: EventListener = () => {};
  private blurDragHandler: () => void = () => {};
  private dragIsTouch = false;

  // Auto-pause on visibility/focus loss
  private visibilityChangeHandler: (() => void) | null = null;
  private windowBlurPauseHandler: (() => void) | null = null;
  autoPaused = false;

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

  // Camera pan state (tracks which keys are currently held)
  private panKeys = new Set<string>();
  private keydownPanHandler: (e: KeyboardEvent) => void = () => {};
  private keyupPanHandler: (e: KeyboardEvent) => void = () => {};

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
    private towerMeshFactory: TowerMeshFactoryService
  ) {
    this.keyboardHandler = this.handleKeyboard.bind(this);
    this.gameState = this.gameStateService.getState();
  }

  ngOnInit(): void {
    // Subscribe to game state changes
    this.stateSubscription = this.gameStateService.getState$().subscribe({
      error: (error: unknown) => console.error('Game state subscription error:', error),
      next: state => {
      const prevPhase = this.gameState.phase;
      const prevWave = this.gameState.wave;
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

    // Start tutorial for first-time players
    if (!this.tutorialService.isTutorialComplete()) {
      this.tutorialService.startTutorial();
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
    this.setupKeyboardControls();
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
    const isTouch = event instanceof TouchEvent || (event instanceof PointerEvent && event.pointerType === 'touch');
    if (!isTouch) {
      this.selectTowerType(type);
      return;
    }

    if (this.previewTowerType === type) {
      // Second tap on same tower — commit to placement
      this.previewTowerType = null;
      this.selectTowerType(type);
    } else {
      // First tap (or switching preview to a different tower)
      this.previewTowerType = type;
    }
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

  /** Called on mousedown/touchstart on a tower bar button. */
  onTowerDragStart(event: MouseEvent | TouchEvent, type: TowerType): void {
    // Only left mouse button for mouse events
    if (event instanceof MouseEvent && event.button !== 0) return;
    // Guard: a TouchEvent with no touches (e.g. touchend) has nothing to read
    if (event instanceof TouchEvent && event.touches.length === 0) return;

    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

    this.dragTowerType = type;
    this.dragStartX = clientX;
    this.dragStartY = clientY;
    this.dragThresholdMet = false;
    this.isDragging = false;

    // Listen on window for move/up so we catch events outside the button.
    // Track event type to register correct listeners (mouse vs touch).
    this.blurDragHandler = () => this.cancelDrag();
    window.addEventListener('blur', this.blurDragHandler);
    this.dragIsTouch = event instanceof TouchEvent;

    if (this.dragIsTouch) {
      this.globalDragMoveHandler = (e: Event) => {
        const te = e as TouchEvent;
        if (te.touches.length === 1) {
          this.onDragMove(te.touches[0].clientX, te.touches[0].clientY);
        } else if (te.touches.length > 1) {
          // Multi-finger during drag = abort (user switched to pinch/zoom)
          this.cancelDrag();
        }
      };
      this.globalDragEndHandler = (e: Event) => {
        const te = e as TouchEvent;
        // Always handle touchend — multi-finger release must cancel the drag,
        // not silently orphan listeners (changedTouches.length > 1 on multi-lift)
        if (te.changedTouches.length >= 1) {
          this.onDragEnd(te.changedTouches[0].clientX, te.changedTouches[0].clientY);
        }
      };
      window.addEventListener('touchmove', this.globalDragMoveHandler, { passive: false });
      window.addEventListener('touchend', this.globalDragEndHandler);
    } else {
      this.globalDragMoveHandler = (e: Event) => this.onDragMove((e as MouseEvent).clientX, (e as MouseEvent).clientY);
      this.globalDragEndHandler = (e: Event) => this.onDragEnd((e as MouseEvent).clientX, (e as MouseEvent).clientY);
      window.addEventListener('mousemove', this.globalDragMoveHandler);
      window.addEventListener('mouseup', this.globalDragEndHandler);
    }
  }

  /** Track mouse during potential drag. */
  private onDragMove(clientX: number, clientY: number): void {
    if (!this.dragTowerType) return;

    if (!this.dragThresholdMet) {
      const dx = clientX - this.dragStartX;
      const dy = clientY - this.dragStartY;
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_CONFIG.minDragDistance) return;
      this.dragThresholdMet = true;
      this.isDragging = true;

      // Enter PLACE mode with this tower type and show highlights
      this.selectedTowerType = this.dragTowerType;
      this.deselectTower();
      this.updateTileHighlights();
    }

    // Update ghost preview position by raycasting to tiles
    if (!this.sceneService.getRenderer()) return;
    const canvas = this.sceneService.getRenderer().domElement;
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.sceneService.getCamera());
    const intersects = this.raycaster.intersectObjects(this.tileMeshArray);

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      const row = mesh.userData['row'];
      const col = mesh.userData['col'];
      const tileCost = this.getTileTowerCost(this.dragTowerType!, row, col).cost;
      const canPlace = this.gameBoardService.canPlaceTower(row, col)
        && this.gameStateService.canAfford(tileCost);
      this.towerPreviewService.showPreview(this.dragTowerType!, row, col, canPlace, this.sceneService.getScene());
    } else {
      this.towerPreviewService.hidePreview(this.sceneService.getScene());
    }
  }

  /** End drag — place tower if over a valid tile. */
  private onDragEnd(clientX: number, clientY: number): void {
    this.removeDragListeners();

    if (!this.dragTowerType || !this.dragThresholdMet) {
      // Threshold not met — this was a click, not a drag. selectTowerType handles it.
      this.dragTowerType = null;
      this.isDragging = false;
      return;
    }

    // Raycast to find the tile under the cursor
    if (this.sceneService.getRenderer()) {
      const canvas = this.sceneService.getRenderer().domElement;
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.sceneService.getCamera());
      const intersects = this.raycaster.intersectObjects(this.tileMeshArray);

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const row = mesh.userData['row'];
        const col = mesh.userData['col'];
        this.tryPlaceTower(row, col);
      }
    }

    // Clean up drag state
    if (this.sceneService.getScene()) {
      this.towerPreviewService.hidePreview(this.sceneService.getScene());
    }
    this.isDragging = false;
    this.dragTowerType = null;
    this.dragThresholdMet = false;
  }

  /** Cancel drag without placing — used when window loses focus or context is destroyed. */
  private cancelDrag(): void {
    this.removeDragListeners();
    if (this.sceneService.getScene()) {
      this.towerPreviewService.hidePreview(this.sceneService.getScene());
    }
    this.isDragging = false;
    this.dragTowerType = null;
    this.dragThresholdMet = false;
  }

  /** Remove global drag event listeners (mouse or touch depending on how drag started). */
  private removeDragListeners(): void {
    if (this.dragIsTouch) {
      window.removeEventListener('touchmove', this.globalDragMoveHandler);
      window.removeEventListener('touchend', this.globalDragEndHandler);
    } else {
      window.removeEventListener('mousemove', this.globalDragMoveHandler);
      window.removeEventListener('mouseup', this.globalDragEndHandler);
    }
    window.removeEventListener('blur', this.blurDragHandler);
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

    // Scale tower mesh to reflect upgrade level (visual concern — stays here)
    const towerMesh = this.towerMeshes.get(this.selectedTowerInfo.id);
    if (towerMesh) {
      const newLevel = result.newLevel;
      const scale = TOWER_VISUAL_CONFIG.scaleBase + (newLevel - 1) * TOWER_VISUAL_CONFIG.scaleIncrement;
      towerMesh.scale.set(scale, scale, scale);

      // Boost emissive intensity on upgrade (skip animated children — their emissive is driven per-frame)
      const animatedNames = new Set(['tip', 'orb']);
      towerMesh.traverse(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial && !animatedNames.has(child.name)) {
          child.material.emissiveIntensity = TOWER_VISUAL_CONFIG.emissiveBase + (newLevel - 1) * TOWER_VISUAL_CONFIG.emissiveIncrement;
        }
      });
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
  }

  selectSpecialization(spec: TowerSpecialization): void {
    this.upgradeTower(spec);
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
  }

  cycleTargeting(): void {
    if (!this.selectedTowerInfo) return;
    // Slow towers don't support targeting mode cycling (utility-only, no projectiles)
    if (this.selectedTowerInfo.type === TowerType.SLOW) return;
    this.towerCombatService.cycleTargetingMode(this.selectedTowerInfo.id);
  }

  specLabel(tower: PlacedTower): string {
    if (!tower.specialization) return '';
    return TOWER_SPECIALIZATIONS[tower.type][tower.specialization].label;
  }

  deselectTower(): void {
    this.selectedTowerInfo = null;
    this.selectedTowerStats = null;
    this.upgradePreview = null;
    this.selectedTowerUpgradePercent = 0;
    this.sellConfirmPending = false;
    this.showSpecializationChoice = false;
    this.specOptions = [];
    this.rangeVisualizationService.removePreview(this.sceneService.getScene());
  }

  private selectPlacedTower(key: string): void {
    // Toggle: clicking the same tower deselects it
    if (this.selectedTowerInfo?.id === key) {
      this.deselectTower();
      return;
    }

    const tower = this.towerCombatService.getTower(key);
    if (!tower) return;

    // Exit PLACE mode when selecting a placed tower (enter INSPECT mode)
    this.cancelPlacement();

    this.selectedTowerInfo = tower;
    this.refreshTowerInfoPanel();
    this.rangeVisualizationService.showForTower(
      tower,
      this.gameBoardService.getBoardWidth(),
      this.gameBoardService.getBoardHeight(),
      this.gameBoardService.getTileSize(),
      this.sceneService.getScene()
    );
  }

  private refreshTowerInfoPanel(): void {
    if (!this.selectedTowerInfo) return;
    const tower = this.selectedTowerInfo;
    const stats = getEffectiveStats(tower.type, tower.level, tower.specialization);
    this.selectedTowerStats = { damage: stats.damage, range: stats.range, fireRate: stats.fireRate, statusEffect: stats.statusEffect };
    const costMult = this.gameStateService.getModifierEffects().towerCostMultiplier ?? 1;
    const tileStrategic = this.tilePricingService.getStrategicValue(tower.row, tower.col);
    this.selectedTowerUpgradeCost = getUpgradeCost(tower.type, tower.level, costMult, tileStrategic);
    this.selectedTowerUpgradePercent = Math.round(tileStrategic * 100);
    this.selectedTowerSellValue = getSellValue(tower.totalInvested);

    // Compute upgrade preview (L1→L2 only; L2→L3 requires spec choice so preview is per-spec)
    if (tower.level < MAX_TOWER_LEVEL - 1) {
      const nextStats = getEffectiveStats(tower.type, tower.level + 1);
      this.upgradePreview = { damage: nextStats.damage, range: nextStats.range, fireRate: nextStats.fireRate };
    } else {
      this.upgradePreview = null;
    }
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
  }

  toggleEncyclopedia(): void {
    this.showEncyclopedia = !this.showEncyclopedia;
  }

  isNewEnemyType(type: EnemyType): boolean {
    return this.waveService.isNewType(type);
  }

  restartGame(): void {
    // Reset interaction state — old references point to disposed meshes
    this.hoveredTile = null;
    this.selectedTile = null;
    this.selectedTowerType = TowerType.BASIC;
    // Cancel any active drag — remove global listeners before cleanup
    this.removeDragListeners();
    this.isDragging = false;
    this.dragTowerType = null;
    this.dragThresholdMet = false;

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
    this.autoPaused = false;
    this.showQuitConfirm = false;
    this.sellConfirmPending = false;
    this.contextLost = false;
    this.pathBlocked = false;
    if (this.pathBlockedTimerId !== null) {
      clearTimeout(this.pathBlockedTimerId);
      this.pathBlockedTimerId = null;
    }

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
  }

  /** Shared cleanup for game objects — used by both restartGame() and ngOnDestroy(). */
  private cleanupGameObjects(): void {
    // Clean up enemies — snapshot keys to avoid mutating Map during iteration
    for (const id of Array.from(this.enemyService.getEnemies().keys())) {
      this.enemyService.removeEnemy(id, this.sceneService.getScene());
    }

    // Clean up tower combat state (projectiles)
    this.towerCombatService.cleanup(this.sceneService.getScene());

    // Clean up tower placement preview
    this.towerPreviewService.cleanup(this.sceneService.getScene());

    // Clean up damage popups
    this.damagePopupService.cleanup(this.sceneService.getScene());

    // Clean up minimap
    this.minimapService.cleanup();

    // Clean up path overlay
    this.pathVisualizationService.hidePath(this.sceneService.getScene());
    this.pathVisualizationService.cleanup();
    this.showPathOverlay = false;

    // Clean up tile highlights
    this.clearTileHighlights();

    // Clean up range preview and range toggle rings
    this.rangeVisualizationService.cleanup(this.sceneService.getScene());
    this.showAllRanges = false;
    this.selectedTowerInfo = null;
    this.selectedTowerStats = null;
    this.upgradePreview = null;
    this.selectedTowerUpgradePercent = 0;
    this.showSpecializationChoice = false;
    this.specOptions = [];

    // Clean up tower meshes
    this.towerMeshes.forEach(group => {
      this.sceneService.getScene().remove(group);
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
    });
    this.towerMeshes.clear();
    this.towerChildrenArray = [];

    // Clean up tile meshes
    this.tileMeshes.forEach(mesh => {
      this.sceneService.getScene().remove(mesh);
      mesh.geometry.dispose();
      disposeMaterial(mesh.material);
    });
    this.tileMeshes.clear();
    this.tileMeshArray = [];

    // Clean up grid lines
    if (this.gridLines) {
      this.sceneService.getScene().remove(this.gridLines);
      this.gridLines.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
      this.gridLines = null;
    }

    // Delegate particles, skybox, and lights cleanup to SceneService
    this.sceneService.disposeParticles();
    this.sceneService.disposeSkybox();
    this.sceneService.disposeLights();
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
    const boardWidth = this.gameBoardService.getBoardWidth();
    const boardHeight = this.gameBoardService.getBoardHeight();
    const spawnerTiles = this.gameBoardService.getSpawnerTiles();
    const exitTiles = this.gameBoardService.getExitTiles();

    this.cachedMinimapTerrain = {
      gridWidth: boardWidth,
      gridHeight: boardHeight,
      isPath: (row: number, col: number) => {
        const board = this.gameBoardService.getGameBoard();
        const tile = board?.[row]?.[col];
        return tile !== undefined && tile.type !== BlockType.WALL;
      },
      spawnPoints: spawnerTiles.map(([row, col]) => ({ x: col, z: row })),
      exitPoints: exitTiles.map(([row, col]) => ({ x: col, z: row })),
    };
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
        this.cancelDrag();
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
          this.handleTapAsClick(this.touchStartX, this.touchStartY);
        }
      }

      this.touchIsDragging = false;
      this.pinchStartDistance = 0;
    };

    canvas.addEventListener('touchstart', this.touchStartHandler, { passive: false });
    canvas.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
    canvas.addEventListener('touchend', this.touchEndHandler, { passive: false });
  }

  /** Converts a canvas-relative touch position to NDC and runs the same interaction as a mouse click. */
  private handleTapAsClick(clientX: number, clientY: number): void {
    this.handleInteraction(clientX, clientY);
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
  }

  private getSelectedTileMesh(): THREE.Mesh | null {
    if (!this.selectedTile) return null;
    return this.tileMeshes.get(`${this.selectedTile.row}-${this.selectedTile.col}`) || null;
  }

  // --- Pause menu ---

  /** Named constant for speed buttons (HUD and pause menu) — avoids template literal arrays. */
  readonly validGameSpeeds: readonly GameSpeed[] = VALID_GAME_SPEEDS;

  /** Whether the quit-confirmation sub-panel is visible inside the pause menu. */
  showQuitConfirm = false;

  onPauseOverlayClick(_event: MouseEvent): void {
    // Clicking the dark backdrop resumes the game
    this.togglePause();
  }

  requestQuit(): void {
    this.showQuitConfirm = true;
  }

  cancelQuit(): void {
    this.showQuitConfirm = false;
  }

  confirmQuit(): void {
    this.showQuitConfirm = false;
    this.gameEndService.recordEnd(false, null);
    if (this.isCampaignGame) {
      this.router.navigate(['/campaign']);
    } else {
      this.router.navigate(['/']);
    }
  }

  /**
   * Called by the CanDeactivate guard when the player tries to navigate away mid-game.
   * Auto-pauses if in COMBAT, asks for confirmation, then records a defeat if confirmed.
   * Returns true to allow navigation, false to stay.
   */
  canLeaveGame(): boolean {
    const state = this.gameStateService.getState();

    // Allow free navigation when game is not actively in progress
    if (
      state.phase === GamePhase.SETUP ||
      state.phase === GamePhase.VICTORY ||
      state.phase === GamePhase.DEFEAT
    ) {
      return true;
    }

    // Game is in COMBAT or INTERMISSION — auto-pause first so the loop stops
    if (!state.isPaused) {
      this.gameStateService.togglePause();
    }

    const shouldLeave = confirm('Leave game? Progress will be lost.');
    if (!shouldLeave) {
      return false;
    }

    this.gameEndService.recordEnd(false, null);
    return true;
  }

  togglePause(): void {
    this.showQuitConfirm = false;
    this.autoPaused = false;
    this.gameStateService.togglePause();
  }

  /** Register visibility/focus-loss listeners for auto-pause. Called once in ngAfterViewInit. */
  private setupAutoPause(): void {
    this.visibilityChangeHandler = () => this.onVisibilityChange();
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);

    this.windowBlurPauseHandler = () => this.onWindowBlurPause();
    window.addEventListener('blur', this.windowBlurPauseHandler);
  }

  private onVisibilityChange(): void {
    if (document.hidden) {
      this.autoPauseIfActive();
    }
  }

  private onWindowBlurPause(): void {
    this.autoPauseIfActive();
  }

  private autoPauseIfActive(): void {
    const state = this.gameStateService.getState();
    if ((state.phase === GamePhase.COMBAT || state.phase === GamePhase.INTERMISSION) && !state.isPaused) {
      this.gameStateService.togglePause();
      this.autoPaused = true;
    }
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

  /** Pre-computed tutorial display steps (excludes COMPLETE) — avoids per-CD allocation. */
  private readonly tutorialDisplaySteps = Object.values(TutorialStep).filter(s => s !== TutorialStep.COMPLETE);

  getTutorialStepNumber(): number {
    if (this.currentTutorialStep === TutorialStep.COMPLETE) {
      return this.tutorialDisplaySteps.length;
    }
    const idx = this.tutorialDisplaySteps.indexOf(this.currentTutorialStep as TutorialStep);
    return Math.max(1, idx + 1);
  }

  getTutorialTotalSteps(): number {
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
    return this.enemyService.getEnemies().size;
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

    // Tower hotkeys: 1-6 select tower types
    if (TOWER_HOTKEYS[event.key]) {
      event.preventDefault();
      this.selectTowerType(TOWER_HOTKEYS[event.key]);
      return;
    }

    switch (event.key) {
      case ' ':
        // Spacebar starts the next wave
        event.preventDefault();
        this.startWave();
        break;
      case 'p':
      case 'P':
        // P key toggles pause
        event.preventDefault();
        this.togglePause();
        break;
      case 'Escape':
        event.preventDefault();
        if (this.isPaused) {
          // ESC while paused: resume game
          this.togglePause();
        } else if (this.isPlaceMode) {
          this.cancelPlacement();
        } else {
          this.deselectTower();
        }
        break;
      case 'r':
      case 'R':
        // R key toggles all tower range indicators
        event.preventDefault();
        this.toggleAllRanges();
        break;
      case 'h':
      case 'H':
        // H key toggles help overlay
        event.preventDefault();
        this.showHelpOverlay = !this.showHelpOverlay;
        break;
      case 'e':
      case 'E':
        // E key toggles enemy encyclopedia
        event.preventDefault();
        this.toggleEncyclopedia();
        break;
      case 'm':
      case 'M':
        // M key toggles minimap
        event.preventDefault();
        this.minimapService.toggleVisibility();
        break;
      case 'v':
      case 'V':
        // V key toggles path overlay
        event.preventDefault();
        this.togglePathOverlay();
        break;
      case 'u':
      case 'U':
        // U key upgrades the selected tower
        event.preventDefault();
        this.upgradeTower();
        break;
      case 't':
      case 'T':
        // T key cycles targeting mode on selected tower
        event.preventDefault();
        this.cycleTargeting();
        break;
      case 'Delete':
      case 'Backspace':
        // Delete/Backspace sells the selected tower
        event.preventDefault();
        this.sellTower();
        break;
    }
  }

  private setupKeyboardControls(): void {
    window.addEventListener('keydown', this.keyboardHandler);

    // Camera pan: WASD / arrow keys — track held keys
    this.keydownPanHandler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        this.panKeys.add(key);
      }
    };
    this.keyupPanHandler = (e: KeyboardEvent) => {
      this.panKeys.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', this.keydownPanHandler);
    window.addEventListener('keyup', this.keyupPanHandler);
  }

  private updateCameraPan(): void {
    if (this.panKeys.size === 0 || !this.sceneService.getCamera() || !this.sceneService.getControls()) return;

    let dx = 0;
    let dz = 0;
    if (this.panKeys.has('w') || this.panKeys.has('arrowup')) dz -= CAMERA_CONFIG.panSpeed;
    if (this.panKeys.has('s') || this.panKeys.has('arrowdown')) dz += CAMERA_CONFIG.panSpeed;
    if (this.panKeys.has('a') || this.panKeys.has('arrowleft')) dx -= CAMERA_CONFIG.panSpeed;
    if (this.panKeys.has('d') || this.panKeys.has('arrowright')) dx += CAMERA_CONFIG.panSpeed;

    this.sceneService.getCamera().position.x += dx;
    this.sceneService.getCamera().position.z += dz;
    this.sceneService.getControls().target.x += dx;
    this.sceneService.getControls().target.z += dz;
  }

  // --- Game loop ---

  private animate = (time: number = 0): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const rawDelta = this.lastTime === 0 ? 0 : (time - this.lastTime) / 1000;
    const deltaTime = Math.min(rawDelta, PHYSICS_CONFIG.maxDeltaTime);
    this.lastTime = time;

    // Reset per-frame SFX counters so throttle limits apply per animation frame
    this.audioService.resetFrameCounters();

    // FPS tracking
    this.fpsCounterService.tick(time);

    // Camera pan (WASD / arrows)
    this.updateCameraPan();

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
      }
    }

    // Animate tower idle effects and tile pulses
    this.towerAnimationService.updateTowerAnimations(this.towerMeshes, time);
    this.towerAnimationService.updateTilePulse(this.tileMeshes, time);

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
      } else if (wc.resultPhase === GamePhase.INTERMISSION) {
        this.audioService.playWaveClear();
        this.lastWaveReward = wc.reward;
        this.lastInterestEarned = wc.interestEarned;
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

    // Per-frame visual updates (health bars, status effects, animations, minimap)
    this.enemyService.updateDyingAnimations(deltaTime, this.sceneService.getScene());
    this.enemyService.updateHealthBars(this.sceneService.getCamera().quaternion);
    this.enemyService.updateStatusVisuals(this.statusEffectService.getAllActiveEffects());
    this.enemyService.updateEnemyAnimations(deltaTime);
    this.updateMinimap(time);
  }

  private updateMinimap(timeMs: number): void {
    // Use cached terrain (static after board setup); fall back to building if not yet cached
    if (!this.cachedMinimapTerrain) {
      this.buildMinimapTerrainCache();
    }
    const terrain = this.cachedMinimapTerrain!;

    this.minimapEntities.length = 0;
    this.towerCombatService.getPlacedTowers().forEach((tower) => {
      this.minimapEntities.push({ x: tower.col, z: tower.row, type: 'tower' });
    });
    this.enemyService.getEnemies().forEach((enemy) => {
      this.minimapEntities.push({ x: enemy.gridPosition.col, z: enemy.gridPosition.row, type: 'enemy' });
    });
    this.minimapService.update(timeMs, terrain, this.minimapEntities);
  }

  // --- Cleanup ---

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrameId);

    if (this.pathBlockedTimerId !== null) {
      clearTimeout(this.pathBlockedTimerId);
      this.pathBlockedTimerId = null;
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

    window.removeEventListener('keydown', this.keyboardHandler);
    window.removeEventListener('keydown', this.keydownPanHandler);
    window.removeEventListener('keyup', this.keyupPanHandler);
    window.removeEventListener('resize', this.resizeHandler);
    this.removeDragListeners();

    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
    if (this.windowBlurPauseHandler) {
      window.removeEventListener('blur', this.windowBlurPauseHandler);
      this.windowBlurPauseHandler = null;
    }

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
    // priceLabelService already cleaned by cleanupGameObjects → clearTileHighlights
    this.screenShakeService.cleanup(this.sceneService.getCamera());
    this.fpsCounterService.reset();

    // Delegate renderer, passes, controls, context-loss handlers to SceneService
    this.sceneService.dispose();
  }
}
