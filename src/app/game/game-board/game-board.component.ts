import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { GameBoardService } from './game-board.service';
import { EnemyService } from './services/enemy.service';
import { MapBridgeService } from './services/map-bridge.service';
import { GameStateService } from './services/game-state.service';
import { WaveService } from './services/wave.service';
import { TowerCombatService, KillInfo } from './services/tower-combat.service';
import { AudioService } from './services/audio.service';
import { ParticleService } from './services/particle.service';
import { ScreenShakeService } from './services/screen-shake.service';
import { GoldPopupService } from './services/gold-popup.service';
import { FpsCounterService } from './services/fps-counter.service';
import { GameStatsService } from './services/game-stats.service';
import { PlayerProfileService, GameEndStats, ACHIEVEMENTS, Achievement } from './services/player-profile.service';
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
import { SCENE_CONFIG, POST_PROCESSING_CONFIG, SKYBOX_CONFIG, ANIMATION_CONFIG } from './constants/rendering.constants';
import { KEY_LIGHT, FILL_LIGHT, RIM_LIGHT, UNDER_LIGHT, ACCENT_LIGHTS, HEMISPHERE_LIGHT } from './constants/lighting.constants';
import { CAMERA_CONFIG, CONTROLS_CONFIG } from './constants/camera.constants';
import { PARTICLE_CONFIG, PARTICLE_COLORS } from './constants/particle.constants';
import { TOWER_VISUAL_CONFIG, RANGE_PREVIEW_CONFIG, SELECTION_RING_CONFIG, TILE_EMISSIVE, HEATMAP_GRADIENT, ENEMY_VISUAL_CONFIG, UI_CONFIG } from './constants/ui.constants';
import { SCREEN_SHAKE_CONFIG, TOWER_ANIM_CONFIG, TILE_PULSE_CONFIG } from './constants/effects.constants';
import { TOUCH_CONFIG, DRAG_CONFIG } from './constants/touch.constants';
import { PHYSICS_CONFIG } from './constants/physics.constants';
import { EnemyType, ENEMY_STATS } from './models/enemy.model';
import { EnemyInfo, ENEMY_INFO } from './models/enemy-info.model';
import { WavePreviewEntry, getWavePreview, getWavePreviewFull } from './models/wave-preview.model';
import { PathVisualizationService } from './services/path-visualization.service';
import { StatusEffectService } from './services/status-effect.service';
import { StatusEffectType } from './constants/status-effect.constants';
import { TilePricingService, TilePriceInfo } from './services/tile-pricing.service';
import { PriceLabelService } from './services/price-label.service';
import { TutorialService, TutorialStep, TutorialTip } from './services/tutorial.service';
import { TerrainGridStateLegacy } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { CampaignService } from '../../campaign/services/campaign.service';
import { CampaignMapService } from '../../campaign/services/campaign-map.service';
import { ChallengeEvaluatorService } from '../../campaign/services/challenge-evaluator.service';
import { CAMPAIGN_WAVE_DEFINITIONS } from '../../campaign/waves/campaign-waves';
import { CampaignLevel } from '../../campaign/models/campaign.model';
import { ChallengeDefinition } from '../../campaign/models/challenge.model';

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
  providers: [EnemyService, GameStateService, WaveService, TowerCombatService, AudioService, ParticleService, ScreenShakeService, GoldPopupService, FpsCounterService, GameStatsService, DamagePopupService, MinimapService, TowerPreviewService, PathVisualizationService, StatusEffectService, TilePricingService, PriceLabelService]
})
export class GameBoardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;


  // Scene objects
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private particles: THREE.Points | null = null;
  private skybox?: THREE.Mesh;
  private hemisphereLight?: THREE.HemisphereLight;
  private keyLight?: THREE.DirectionalLight;
  private fillLight?: THREE.DirectionalLight;
  private rimLight?: THREE.DirectionalLight;
  private underLight?: THREE.PointLight;
  private accentLights: THREE.PointLight[] = [];
  private bloomPass?: UnrealBloomPass;
  private vignettePass?: ShaderPass;
  private renderPass?: RenderPass;
  private composer!: EffectComposer;

  // Interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private tileMeshes: Map<string, THREE.Mesh> = new Map();
  private hoveredTile: THREE.Mesh | null = null;
  private selectedTile: { row: number, col: number } | null = null;

  // Tower management
  private towerMeshes: Map<string, THREE.Group> = new Map();
  private gridLines: THREE.Group | null = null;
  private rangePreviewMesh: THREE.Mesh | null = null;
  private selectionRingMesh: THREE.Mesh | null = null;
  selectedTowerType: TowerType | null = TowerType.BASIC;
  private lastPreviewKey = ''; // "row-col-towerType-gold" — skip preview rebuild when unchanged
  /** Set of "row-col" keys for tiles currently highlighted as valid placements. */
  private highlightedTiles: Set<string> = new Set();
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

  // Achievements unlocked at game end
  newlyUnlockedAchievements: string[] = [];
  achievementDetails: Achievement[] = [];

  // Guard: prevents recordGameEnd from firing more than once per game
  private gameEndRecorded = false;

  // Challenge tracking — reset per game
  private challengeTotalGoldSpent = 0;
  private challengeMaxTowersPlaced = 0;
  private challengeTowerTypesUsed = new Set<TowerType>();
  /** Challenge completions awarded at end of this game session. */
  completedChallenges: ChallengeDefinition[] = [];

  // Wave preview — shown during SETUP and INTERMISSION
  wavePreview: WavePreviewEntry[] = [];
  /** Template description for the upcoming endless wave (null for scripted waves). */
  waveTemplateDescription: string | null = null;
  // Wave income feedback — shown during INTERMISSION
  lastWaveReward = 0;
  lastInterestEarned = 0;
  /** Tracks whether any enemy leaked during the current wave (for streak bonus). */
  private leakedThisWave = false;
  showAllRanges = false;
  showPathOverlay = false;
  sellConfirmPending = false;
  targetingModeLabels = TARGETING_MODE_LABELS;
  showHelpOverlay = false;
  showEncyclopedia = false;
  enemyInfoList: EnemyInfo[] = Object.values(ENEMY_INFO);
  seenEnemyTypes = new Set<EnemyType>();
  pathBlocked = false;
  private pathBlockedTimerId: ReturnType<typeof setTimeout> | null = null;
  private rangeRingMeshes: THREE.Mesh[] = [];

  // Animation
  private lastTime = 0;
  private elapsedTimeAccumulator = 0;
  private physicsAccumulator = 0;
  private defeatSoundPlayed = false;
  private victorySoundPlayed = false;
  private keyboardHandler: (event: KeyboardEvent) => void;
  private mousemoveHandler: (event: MouseEvent) => void = () => {};
  private clickHandler: (event: MouseEvent) => void = () => {};
  private contextmenuHandler: (event: MouseEvent) => void = () => {};
  private animationFrameId = 0;
  private resizeHandler: () => void = () => {};
  private stateSubscription: Subscription | null = null;

  // WebGL context loss recovery
  contextLost = false;
  private contextLostHandler: ((event: Event) => void) | null = null;
  private contextRestoredHandler: (() => void) | null = null;

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

  // Tutorial state
  currentTutorialStep: TutorialStep | null = null;
  private tutorialSub: Subscription | null = null;
  TutorialStep = TutorialStep;

  // Audio state exposed to template
  get audioMuted(): boolean { return this.audioService.isMuted; }

  /** Returns a 3-element array of 'filled' | 'empty' for the star rating display. */
  get starArray(): Array<'filled' | 'empty'> {
    const stars = this.scoreBreakdown?.stars ?? 0;
    return [0, 1, 2].map(i => (i < stars ? 'filled' : 'empty')) as Array<'filled' | 'empty'>;
  }

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
    private challengeEvaluatorService: ChallengeEvaluatorService
  ) {
    this.keyboardHandler = this.handleKeyboard.bind(this);
    this.gameState = this.gameStateService.getState();
  }

  ngOnInit(): void {
    // Subscribe to game state changes
    this.stateSubscription = this.gameStateService.getState$().subscribe(state => {
      const prevPhase = this.gameState.phase;
      const prevWave = this.gameState.wave;
      this.gameState = state;

      // Compute score breakdown the first time we enter a terminal phase
      if (
        (state.phase === GamePhase.VICTORY || state.phase === GamePhase.DEFEAT) &&
        prevPhase !== GamePhase.VICTORY &&
        prevPhase !== GamePhase.DEFEAT
      ) {
        // Flush any accumulated elapsed time before scoring so the final time is accurate
        if (this.elapsedTimeAccumulator > 0) {
          this.gameStateService.addElapsedTime(this.elapsedTimeAccumulator);
          this.elapsedTimeAccumulator = 0;
        }
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
    });

    // Import editor map if it has spawn and exit points; otherwise use default board
    if (this.mapBridge.hasEditorMap()) {
      const state = this.mapBridge.getEditorMapState()!;
      const legacy = state as unknown as TerrainGridStateLegacy;
      if ((state.spawnPoints?.length > 0 || legacy.spawnPoint) && (state.exitPoints?.length > 0 || legacy.exitPoint)) {
        const { board, width, height } = this.mapBridge.convertToGameBoard(state);
        this.gameBoardService.importBoard(board, width, height);
      } else {
        this.gameBoardService.resetBoard();
      }
    } else {
      this.gameBoardService.resetBoard();
    }

    // Apply per-campaign-level wave definitions if this is a campaign map
    this.applyCampaignWaves();

    this.initializeScene();
    this.initializeCamera();
    this.initializeLights();
    this.addSkybox();
    this.initializeParticles();
    this.renderGameBoard();
    this.addGridLines();

    // Show initial tile highlights if a tower type is pre-selected (SETUP phase)
    if (this.isPlaceMode) {
      this.updateTileHighlights();
    }

    // Load saved settings
    const savedSettings = this.settingsService.get();
    if (savedSettings.audioMuted) {
      this.audioService.toggleMute();
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
    this.tutorialSub = this.tutorialService.getCurrentStep().subscribe(step => {
      this.currentTutorialStep = step;
    });
  }

  ngAfterViewInit(): void {
    this.initializeRenderer();
    this.initializePostProcessing();
    this.initializeControls();
    this.setupMouseInteraction();
    this.setupTouchInteraction();
    this.setupKeyboardControls();
    this.minimapService.init(this.canvasContainer.nativeElement);
    this.animate();
  }

  // --- Public methods for template ---

  levelStars(count: number): number[] {
    return Array(Math.max(0, count)).fill(0);
  }

  toggleAudio(): void {
    this.audioService.toggleMute();
    this.settingsService.update({ audioMuted: this.audioService.isMuted });
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
    this.enemyService.setModifierEffects(
      this.gameStateService.getModifierEffects(),
      this.activeModifiers
    );
    this.towerCombatService.setTowerDamageMultiplier(this.gameStateService.getModifierEffects().towerDamageMultiplier ?? 1);
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

  /** Exit PLACE mode — clears tower type selection, hides ghost preview, removes tile highlights. */
  cancelPlacement(): void {
    this.selectedTowerType = null;
    this.lastPreviewKey = '';
    this.hoveredTileCost = 0;
    this.hoveredTilePercent = 0;
    this.clearTileHighlights();
    if (this.scene) {
      this.towerPreviewService.hidePreview(this.scene);
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
    if (!this.renderer) return;
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(Array.from(this.tileMeshes.values()));

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      const row = mesh.userData['row'];
      const col = mesh.userData['col'];
      const tileCost = this.getTileTowerCost(this.dragTowerType!, row, col).cost;
      const canPlace = this.gameBoardService.canPlaceTower(row, col)
        && this.gameStateService.canAfford(tileCost);
      this.towerPreviewService.showPreview(this.dragTowerType!, row, col, canPlace, this.scene);
    } else {
      this.towerPreviewService.hidePreview(this.scene);
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
    if (this.renderer) {
      const canvas = this.renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(Array.from(this.tileMeshes.values()));

      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const row = mesh.userData['row'];
        const col = mesh.userData['col'];
        this.tryPlaceTower(row, col);
      }
    }

    // Clean up drag state
    if (this.scene) {
      this.towerPreviewService.hidePreview(this.scene);
    }
    this.isDragging = false;
    this.dragTowerType = null;
    this.dragThresholdMet = false;
  }

  /** Cancel drag without placing — used when window loses focus or context is destroyed. */
  private cancelDrag(): void {
    this.removeDragListeners();
    if (this.scene) {
      this.towerPreviewService.hidePreview(this.scene);
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
    this.clearTileHighlights();

    if (!this.isPlaceMode) return;

    const board = this.gameBoardService.getGameBoard();

    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        const tile = board[row][col];
        if (tile.type !== BlockType.BASE || !tile.isPurchasable || tile.towerType !== null) continue;

        const key = `${row}-${col}`;
        const mesh = this.tileMeshes.get(key);
        if (!mesh) continue;

        // Skip selected tile — it has its own highlight
        if (this.selectedTile?.row === row && this.selectedTile?.col === col) continue;

        // Use tile-specific strategic pricing for affordability and heatmap color
        const priceInfo = this.getTileTowerCost(this.selectedTowerType!, row, col);
        if (this.gameStateService.canAfford(priceInfo.cost)) {
          const material = mesh.material as THREE.MeshStandardMaterial;
          // Snapshot from tile-type defaults, not live material
          mesh.userData['origEmissive'] = TILE_EMISSIVE.defaultColor;
          mesh.userData['origEmissiveIntensity'] = TILE_EMISSIVE.base;

          // Apply smoothly interpolated heatmap color based on strategic value
          const { color, intensity } = this.interpolateHeatmap(priceInfo.strategicMultiplier);
          material.emissive.setRGB(color.r, color.g, color.b);
          material.emissiveIntensity = intensity;
          // Store exact interpolated values for smooth hover restore
          mesh.userData['heatmapR'] = color.r;
          mesh.userData['heatmapG'] = color.g;
          mesh.userData['heatmapB'] = color.b;
          mesh.userData['heatmapIntensity'] = intensity;
          this.highlightedTiles.add(key);
        }
      }
    }

    // Second pass: dim heatmap for unaffordable-but-valid tiles
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        const tile = board[row][col];
        if (tile.type !== BlockType.BASE || !tile.isPurchasable || tile.towerType !== null) continue;

        const key = `${row}-${col}`;
        if (this.highlightedTiles.has(key)) continue; // already highlighted as affordable
        const mesh = this.tileMeshes.get(key);
        if (!mesh) continue;
        if (this.selectedTile?.row === row && this.selectedTile?.col === col) continue;

        const priceInfo = this.getTileTowerCost(this.selectedTowerType!, row, col);
        const material = mesh.material as THREE.MeshStandardMaterial;
        mesh.userData['origEmissive'] = TILE_EMISSIVE.defaultColor;
        mesh.userData['origEmissiveIntensity'] = TILE_EMISSIVE.base;

        // Apply dimmed heatmap — same color but at reduced intensity
        const { color, intensity } = this.interpolateHeatmap(priceInfo.strategicMultiplier);
        const dim = TILE_EMISSIVE.unaffordableDimming;
        material.emissive.setRGB(color.r * dim, color.g * dim, color.b * dim);
        material.emissiveIntensity = intensity * dim;
        mesh.userData['heatmapR'] = color.r * dim;
        mesh.userData['heatmapG'] = color.g * dim;
        mesh.userData['heatmapB'] = color.b * dim;
        mesh.userData['heatmapIntensity'] = intensity * dim;
        this.highlightedTiles.add(key);
      }
    }

    // Show floating % labels above highlighted tiles
    if (this.highlightedTiles.size > 0) {
      const costMult = this.gameStateService.getModifierEffects().towerCostMultiplier ?? 1;
      const priceMap = this.tilePricingService.getTilePriceMap(this.selectedTowerType!, costMult);
      this.priceLabelService.showLabels(
        priceMap,
        this.gameBoardService.getBoardWidth(),
        this.gameBoardService.getBoardHeight(),
        this.gameBoardService.getTileSize(),
        this.scene
      );
    }
  }

  /** Remove placement highlights from all tiles, restoring their original emissive. */
  private clearTileHighlights(): void {
    // Remove floating price labels
    if (this.scene) {
      this.priceLabelService.hideLabels(this.scene);
    }

    for (const key of this.highlightedTiles) {
      const mesh = this.tileMeshes.get(key);
      if (!mesh) continue;
      const material = mesh.material as THREE.MeshStandardMaterial;
      const origColor = mesh.userData['origEmissive'] ?? TILE_EMISSIVE.defaultColor;
      const origIntensity = mesh.userData['origEmissiveIntensity'] ?? TILE_EMISSIVE.base;
      material.emissive.setHex(origColor);
      material.emissiveIntensity = origIntensity;
      delete mesh.userData['origEmissive'];
      delete mesh.userData['origEmissiveIntensity'];
      delete mesh.userData['heatmapR'];
      delete mesh.userData['heatmapG'];
      delete mesh.userData['heatmapB'];
      delete mesh.userData['heatmapIntensity'];
    }
    this.highlightedTiles.clear();
  }

  /** Interpolate heatmap color from gradient stops based on strategic value. Clamped to gradient range. */
  private interpolateHeatmap(value: number): { color: { r: number; g: number; b: number }; intensity: number } {
    const stops = HEATMAP_GRADIENT;
    // Clamp to gradient range — values beyond the last stop render as the hottest color
    const clamped = Math.max(0, Math.min(stops[stops.length - 1][0], value));

    // Find the two surrounding stops
    let lower = stops[0];
    let upper = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (clamped >= stops[i][0] && clamped <= stops[i + 1][0]) {
        lower = stops[i];
        upper = stops[i + 1];
        break;
      }
    }

    // Lerp between the two stops
    const range = upper[0] - lower[0];
    const t = range > 0 ? (clamped - lower[0]) / range : 0;
    return {
      color: {
        r: lower[1] + (upper[1] - lower[1]) * t,
        g: lower[2] + (upper[2] - lower[2]) * t,
        b: lower[3] + (upper[3] - lower[3]) * t,
      },
      intensity: lower[4] + (upper[4] - lower[4]) * t,
    };
  }

  upgradeTower(spec?: TowerSpecialization): void {
    if (!this.selectedTowerInfo) return;
    const phase = this.gameStateService.getState().phase;
    if (phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT) return;
    if (this.selectedTowerInfo.level >= MAX_TOWER_LEVEL) return;

    const costMult = this.gameStateService.getModifierEffects().towerCostMultiplier ?? 1;
    const tileStrategic = this.tilePricingService.getStrategicValue(this.selectedTowerInfo.row, this.selectedTowerInfo.col);
    const cost = getUpgradeCost(this.selectedTowerInfo.type, this.selectedTowerInfo.level, costMult, tileStrategic);
    if (!this.gameStateService.canAfford(cost)) return;

    if (this.selectedTowerInfo.level === MAX_TOWER_LEVEL - 1) {
      // L2->L3: needs specialization choice
      if (!spec) {
        const specs = TOWER_SPECIALIZATIONS[this.selectedTowerInfo.type];
        const alphaStats = getEffectiveStats(this.selectedTowerInfo.type, MAX_TOWER_LEVEL, TowerSpecialization.ALPHA);
        const betaStats = getEffectiveStats(this.selectedTowerInfo.type, MAX_TOWER_LEVEL, TowerSpecialization.BETA);
        this.specOptions = [
          { spec: TowerSpecialization.ALPHA, ...specs[TowerSpecialization.ALPHA],
            damage: alphaStats.damage, range: alphaStats.range, fireRate: alphaStats.fireRate },
          { spec: TowerSpecialization.BETA, ...specs[TowerSpecialization.BETA],
            damage: betaStats.damage, range: betaStats.range, fireRate: betaStats.fireRate },
        ];
        this.showSpecializationChoice = true;
        return;
      }
      // Player chose — execute spec upgrade
      if (!this.towerCombatService.upgradeTowerWithSpec(this.selectedTowerInfo.id, spec, cost)) return;
      this.showSpecializationChoice = false;
      this.specOptions = [];
    } else {
      // L1->L2: standard upgrade
      if (!this.towerCombatService.upgradeTower(this.selectedTowerInfo.id, cost)) return;
    }

    this.gameStateService.spendGold(cost);
    this.challengeTotalGoldSpent += cost;
    this.audioService.playTowerUpgrade();

    // Scale tower mesh to reflect upgrade level
    const towerMesh = this.towerMeshes.get(this.selectedTowerInfo.id);
    if (towerMesh) {
      const newLevel = this.selectedTowerInfo.level;
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
    this.showRangePreview(this.selectedTowerInfo);
  }

  selectSpecialization(spec: TowerSpecialization): void {
    this.upgradeTower(spec);
  }

  sellTower(): void {
    if (!this.selectedTowerInfo) return;
    const phase = this.gameStateService.getState().phase;
    if (phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT) return;

    // First click sets confirm pending; second click within same selection executes sell
    if (!this.sellConfirmPending) {
      this.sellConfirmPending = true;
      return;
    }
    this.sellConfirmPending = false;

    // Confirm unregistration succeeds BEFORE refunding gold — prevents free gold on stale reference
    const soldTower = this.towerCombatService.unregisterTower(this.selectedTowerInfo.id);
    if (!soldTower) return;

    const refund = getSellValue(soldTower.totalInvested);
    this.gameStateService.addGold(refund);
    this.audioService.playTowerSell();
    this.gameStatsService.recordTowerSold();

    // Remove mesh from scene
    const towerMesh = this.towerMeshes.get(this.selectedTowerInfo.id);
    if (towerMesh) {
      this.scene.remove(towerMesh);
      towerMesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
      this.towerMeshes.delete(this.selectedTowerInfo.id);
    }

    // Restore tile to BASE
    this.gameBoardService.removeTower(this.selectedTowerInfo.row, this.selectedTowerInfo.col);

    // On sell, repath ALL ground enemies — any enemy could benefit from a shorter path
    // through the now-freed tile, not just enemies whose old path crossed it.
    this.enemyService.repathAffectedEnemies(-1, -1);
    this.tilePricingService.invalidateCache();
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
    this.removeRangePreview();
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
    this.showRangePreview(tower);
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

  private createRangeRing(radius: number, color: number, opacity: number, x: number, z: number): THREE.Mesh {
    const geometry = new THREE.RingGeometry(
      radius - RANGE_PREVIEW_CONFIG.ringThickness,
      radius,
      RANGE_PREVIEW_CONFIG.segments
    );
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, RANGE_PREVIEW_CONFIG.yPosition, z);
    return ring;
  }

  private showRangePreview(tower: PlacedTower): void {
    this.removeRangePreview();

    const stats = getEffectiveStats(tower.type, tower.level, tower.specialization);
    const boardWidth = this.gameBoardService.getBoardWidth();
    const boardHeight = this.gameBoardService.getBoardHeight();
    const tileSize = this.gameBoardService.getTileSize();
    const x = (tower.col - boardWidth / 2) * tileSize;
    const z = (tower.row - boardHeight / 2) * tileSize;

    // Range ring
    this.rangePreviewMesh = this.createRangeRing(stats.range, stats.color, RANGE_PREVIEW_CONFIG.opacity, x, z);
    this.scene.add(this.rangePreviewMesh);

    // Selection ring — tight ring around the tower base to indicate it's selected
    const selectionGeometry = new THREE.RingGeometry(
      SELECTION_RING_CONFIG.radius - SELECTION_RING_CONFIG.thickness,
      SELECTION_RING_CONFIG.radius,
      SELECTION_RING_CONFIG.segments
    );
    const selectionMaterial = new THREE.MeshBasicMaterial({
      color: SELECTION_RING_CONFIG.color,
      transparent: true,
      opacity: SELECTION_RING_CONFIG.opacity,
      side: THREE.DoubleSide,
    });
    this.selectionRingMesh = new THREE.Mesh(selectionGeometry, selectionMaterial);
    this.selectionRingMesh.rotation.x = -Math.PI / 2;
    this.selectionRingMesh.position.set(x, RANGE_PREVIEW_CONFIG.yPosition + SELECTION_RING_CONFIG.yOffset, z);
    this.scene.add(this.selectionRingMesh);
  }

  private removeRangePreview(): void {
    if (this.rangePreviewMesh) {
      this.scene.remove(this.rangePreviewMesh);
      this.rangePreviewMesh.geometry.dispose();
      disposeMaterial(this.rangePreviewMesh.material);
      this.rangePreviewMesh = null;
    }
    if (this.selectionRingMesh) {
      this.scene.remove(this.selectionRingMesh);
      this.selectionRingMesh.geometry.dispose();
      disposeMaterial(this.selectionRingMesh.material);
      this.selectionRingMesh = null;
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

  /** Returns the next campaign level after the current one, or null if none exists. */
  get nextCampaignLevel(): CampaignLevel | null {
    const mapId = this.mapBridge.getMapId();
    if (!mapId) return null;
    return this.campaignService.getNextLevel(mapId);
  }

  /** True when the next campaign level exists and is unlocked. */
  get isNextLevelUnlocked(): boolean {
    const next = this.nextCampaignLevel;
    return !!next && this.campaignService.isUnlocked(next.id);
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
    this.leakedThisWave = false;
    this.minimapService.show();

    // Ensure enemy service has current modifier effects before first wave
    if (state.wave === 0 && this.activeModifiers.size > 0) {
      this.enemyService.setModifierEffects(
        this.gameStateService.getModifierEffects(),
        this.activeModifiers
      );
    }

    this.gameStateService.startWave();
    const modEffects = this.gameStateService.getModifierEffects();
    const waveCountMult = modEffects.waveCountMultiplier ?? 1;
    this.towerCombatService.setTowerDamageMultiplier(modEffects.towerDamageMultiplier ?? 1);
    this.waveService.startWave(this.gameStateService.getState().wave, this.scene, waveCountMult);

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
      this.seenEnemyTypes.add(entry.type);
    }

    this.audioService.playWaveStart();
  }

  toggleEncyclopedia(): void {
    this.showEncyclopedia = !this.showEncyclopedia;
  }

  isNewEnemyType(type: EnemyType): boolean {
    return !this.seenEnemyTypes.has(type);
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

    // Reset services — enemyService.reset() clears counter + path cache
    this.enemyService.reset(this.scene);
    this.waveService.reset();
    this.gameStateService.reset();
    this.gameStatsService.reset();
    this.scoreBreakdown = null;
    this.newlyUnlockedAchievements = [];
    this.achievementDetails = [];
    this.gameEndRecorded = false;
    this.challengeTotalGoldSpent = 0;
    this.challengeMaxTowersPlaced = 0;
    this.challengeTowerTypesUsed = new Set<TowerType>();
    this.completedChallenges = [];
    this.lastWaveReward = 0;
    this.lastInterestEarned = 0;
    this.activeModifiers = new Set<GameModifier>();
    this.modifierScoreMultiplier = 1.0;
    this.wavePreview = [];
    this.defeatSoundPlayed = false;
    this.victorySoundPlayed = false;
    this.showHelpOverlay = false;
    this.showEncyclopedia = false;
    this.seenEnemyTypes = new Set<EnemyType>();
    this.showPathOverlay = false;
    this.leakedThisWave = false;
    this.pathBlocked = false;
    if (this.pathBlockedTimerId !== null) {
      clearTimeout(this.pathBlockedTimerId);
      this.pathBlockedTimerId = null;
    }

    if (this.mapBridge.hasEditorMap()) {
      const state = this.mapBridge.getEditorMapState()!;
      const legacy = state as unknown as TerrainGridStateLegacy;
      if ((state.spawnPoints?.length > 0 || legacy.spawnPoint) && (state.exitPoints?.length > 0 || legacy.exitPoint)) {
        const { board, width, height } = this.mapBridge.convertToGameBoard(state);
        this.gameBoardService.importBoard(board, width, height);
      } else {
        this.gameBoardService.resetBoard();
      }
    } else {
      this.gameBoardService.resetBoard();
    }

    // Re-apply campaign waves after waveService.reset() (which clears custom waves)
    this.applyCampaignWaves();

    this.renderGameBoard();
    this.addGridLines();
    this.initializeLights();
    this.addSkybox();
    this.initializeParticles();
    this.minimapService.init(this.canvasContainer.nativeElement);
    this.tilePricingService.invalidateCache();
    this.lastPreviewKey = '';
    this.lastTime = 0;
    this.elapsedTimeAccumulator = 0;
    this.physicsAccumulator = 0;
    this.updateTileHighlights();
  }


  /**
   * Checks if the current map is a campaign map and, if so, loads the per-level wave
   * definitions into WaveService and updates GameStateService.maxWaves accordingly.
   * No-op for non-campaign maps (standard 10-wave gameplay is unchanged).
   * Called from ngOnInit() and restartGame() (after waveService.reset()).
   */
  private applyCampaignWaves(): void {
    const mapId = this.mapBridge.getMapId();
    if (!mapId?.startsWith('campaign_')) return;

    const waves = CAMPAIGN_WAVE_DEFINITIONS[mapId];
    if (!waves) return;

    this.waveService.setCustomWaves(waves);
    this.gameStateService.setMaxWaves(waves.length);
  }

  /** Shared cleanup for game objects — used by both restartGame() and ngOnDestroy(). */
  private cleanupGameObjects(): void {
    // Clean up enemies — snapshot keys to avoid mutating Map during iteration
    for (const id of Array.from(this.enemyService.getEnemies().keys())) {
      this.enemyService.removeEnemy(id, this.scene);
    }

    // Clean up tower combat state (projectiles)
    this.towerCombatService.cleanup(this.scene);

    // Clean up tower placement preview
    this.towerPreviewService.cleanup(this.scene);

    // Clean up damage popups
    this.damagePopupService.cleanup(this.scene);

    // Clean up minimap
    this.minimapService.cleanup();

    // Clean up path overlay
    this.pathVisualizationService.hidePath(this.scene);
    this.pathVisualizationService.cleanup();
    this.showPathOverlay = false;

    // Clean up tile highlights
    this.clearTileHighlights();

    // Clean up range preview and range toggle rings
    this.removeRangePreview();
    for (const mesh of this.rangeRingMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      disposeMaterial(mesh.material);
    }
    this.rangeRingMeshes = [];
    this.showAllRanges = false;
    this.selectedTowerInfo = null;
    this.selectedTowerStats = null;
    this.upgradePreview = null;
    this.selectedTowerUpgradePercent = 0;
    this.showSpecializationChoice = false;
    this.specOptions = [];

    // Clean up tower meshes
    this.towerMeshes.forEach(group => {
      this.scene.remove(group);
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
    });
    this.towerMeshes.clear();

    // Clean up tile meshes
    this.tileMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      disposeMaterial(mesh.material);
    });
    this.tileMeshes.clear();

    // Clean up grid lines
    if (this.gridLines) {
      this.scene.remove(this.gridLines);
      this.gridLines.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
      this.gridLines = null;
    }

    // Clean up particles
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      disposeMaterial(this.particles.material);
      this.particles = null;
    }

    // Clean up skybox
    if (this.skybox) {
      this.scene.remove(this.skybox);
      this.skybox.geometry.dispose();
      disposeMaterial(this.skybox.material);
      this.skybox = undefined;
    }

    // Clean up lights
    if (this.hemisphereLight) {
      this.scene.remove(this.hemisphereLight);
      this.hemisphereLight = undefined;
    }
    if (this.keyLight) {
      this.keyLight.shadow.map?.dispose();
      this.scene.remove(this.keyLight);
      this.keyLight = undefined;
    }
    if (this.fillLight) {
      this.scene.remove(this.fillLight);
      this.fillLight = undefined;
    }
    if (this.rimLight) {
      this.scene.remove(this.rimLight);
      this.rimLight = undefined;
    }
    if (this.underLight) {
      this.scene.remove(this.underLight);
      this.underLight = undefined;
    }
    for (const light of this.accentLights) {
      this.scene.remove(light);
    }
    this.accentLights = [];
  }

  // --- Scene setup ---

  private initializeScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENE_CONFIG.backgroundColor);
    this.scene.fog = new THREE.FogExp2(SCENE_CONFIG.fogColor, SCENE_CONFIG.fogDensity);
  }

  private initializeCamera(): void {
    const aspectRatio = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.fov,
      aspectRatio,
      CAMERA_CONFIG.near,
      CAMERA_CONFIG.far
    );
    this.camera.position.set(0, CAMERA_CONFIG.distance, CAMERA_CONFIG.distance * CAMERA_CONFIG.zOffsetFactor);
    this.camera.lookAt(0, 0, 0);
  }

  private initializeRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = SCENE_CONFIG.toneMappingExposure;

    // WebGL context loss handling — must be registered before appending canvas
    const canvas = this.renderer.domElement;
    this.contextLostHandler = (event: Event) => {
      event.preventDefault();
      this.contextLost = true;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = 0;
      }
    };
    this.contextRestoredHandler = () => {
      this.contextLost = false;
      if (!this.animationFrameId) {
        this.animate();
      }
    };
    canvas.addEventListener('webglcontextlost', this.contextLostHandler as EventListener);
    canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler as EventListener);

    this.canvasContainer.nativeElement.appendChild(this.renderer.domElement);

    this.resizeHandler = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      if (this.composer) {
        this.composer.setSize(width, height);
      }
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  private initializePostProcessing(): void {
    this.composer = new EffectComposer(this.renderer);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      POST_PROCESSING_CONFIG.bloom.strength,
      POST_PROCESSING_CONFIG.bloom.radius,
      POST_PROCESSING_CONFIG.bloom.threshold
    );
    this.composer.addPass(this.bloomPass);

    const vignetteShader = {
      uniforms: {
        tDiffuse: { value: null },
        offset: { value: POST_PROCESSING_CONFIG.vignette.offset },
        darkness: { value: POST_PROCESSING_CONFIG.vignette.darkness }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        varying vec2 vUv;

        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
          float vignette = clamp(1.0 - dot(uv, uv), 0.0, 1.0);
          vignette = pow(vignette, darkness);
          texel.rgb *= vignette;
          gl_FragColor = texel;
        }
      `
    };

    this.vignettePass = new ShaderPass(vignetteShader);
    this.composer.addPass(this.vignettePass);
  }

  private initializeLights(): void {
    this.hemisphereLight = new THREE.HemisphereLight(
      HEMISPHERE_LIGHT.skyColor,
      HEMISPHERE_LIGHT.groundColor,
      HEMISPHERE_LIGHT.intensity
    );
    this.scene.add(this.hemisphereLight);

    // Ambient light removed — hemisphere light provides better ambient fill with sky/ground gradient

    const keyLight = new THREE.DirectionalLight(KEY_LIGHT.color, KEY_LIGHT.intensity);
    keyLight.position.set(...KEY_LIGHT.position!);
    keyLight.castShadow = KEY_LIGHT.castShadow;
    keyLight.shadow.camera.left = -KEY_LIGHT.shadow.bounds;
    keyLight.shadow.camera.right = KEY_LIGHT.shadow.bounds;
    keyLight.shadow.camera.top = KEY_LIGHT.shadow.bounds;
    keyLight.shadow.camera.bottom = -KEY_LIGHT.shadow.bounds;
    keyLight.shadow.mapSize.width = KEY_LIGHT.shadow.mapSize;
    keyLight.shadow.mapSize.height = KEY_LIGHT.shadow.mapSize;
    keyLight.shadow.bias = KEY_LIGHT.shadow.bias;
    this.keyLight = keyLight;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(FILL_LIGHT.color, FILL_LIGHT.intensity);
    this.fillLight.position.set(...FILL_LIGHT.position!);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(RIM_LIGHT.color, RIM_LIGHT.intensity);
    this.rimLight.position.set(...RIM_LIGHT.position!);
    this.scene.add(this.rimLight);

    this.underLight = new THREE.PointLight(UNDER_LIGHT.color, UNDER_LIGHT.intensity, UNDER_LIGHT.range);
    this.underLight.position.set(...UNDER_LIGHT.position!);
    this.scene.add(this.underLight);

    for (const cfg of ACCENT_LIGHTS) {
      const light = new THREE.PointLight(cfg.color, cfg.intensity, cfg.range);
      light.position.set(...cfg.position!);
      this.scene.add(light);
      this.accentLights.push(light);
    }
  }

  private renderGameBoard(): void {
    const boardTiles = this.gameBoardService.getGameBoard();

    boardTiles.forEach((row, rowIndex) => {
      row.forEach((tile, colIndex) => {
        const mesh = this.gameBoardService.createTileMesh(rowIndex, colIndex, tile.type);
        mesh.userData = { row: rowIndex, col: colIndex, tile: tile };
        this.tileMeshes.set(`${rowIndex}-${colIndex}`, mesh);
        this.scene.add(mesh);
      });
    });
  }

  private addGridLines(): void {
    if (this.gridLines) {
      this.scene.remove(this.gridLines);
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
    this.scene.add(this.gridLines);
  }

  private addSkybox(): void {
    const starfieldGeometry = new THREE.SphereGeometry(SKYBOX_CONFIG.radius, SKYBOX_CONFIG.widthSegments, SKYBOX_CONFIG.heightSegments);

    const starfieldMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        uniform float time;

        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        void main() {
          vec3 deepPurple = vec3(0.04, 0.02, 0.08);
          vec3 darkBlue = vec3(0.06, 0.04, 0.12);
          vec3 color = mix(deepPurple, darkBlue, vUv.y * 0.5);

          // Stars with twinkle
          vec2 starPos = vUv * 150.0;
          float star = random(floor(starPos));
          if (star > 0.992) {
            float baseBright = random(floor(starPos) + 1.0) * 0.5;
            float twinkle = 0.6 + 0.4 * sin(time * (1.0 + random(floor(starPos) + 2.0) * 3.0));
            float brightness = baseBright * twinkle;
            color += vec3(brightness * 0.4, brightness * 0.3, brightness * 0.5);
          }

          // Drifting nebula veins
          float drift = time * 0.02;
          float vein1 = random(floor(vUv * 40.0 + vec2(drift, vUv.x * 10.0 + drift * 0.5)));
          if (vein1 > 0.97) {
            color += vec3(0.25, 0.15, 0.3) * vein1;
          }

          // Slow-shifting bioluminescence
          float bio = random(floor(vUv * 25.0 + vec2(drift * 0.3))) * 0.12;
          color += vec3(bio * 0.3, bio * 0.5, bio * 0.7);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.skybox = new THREE.Mesh(starfieldGeometry, starfieldMaterial);
    this.scene.add(this.skybox);
  }

  private initializeParticles(): void {
    const particleCount = PARTICLE_CONFIG.count;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * PARTICLE_CONFIG.spread;
      positions[i * 3 + 1] = Math.random() * PARTICLE_CONFIG.heightRange + PARTICLE_CONFIG.heightMin;
      positions[i * 3 + 2] = (Math.random() - 0.5) * PARTICLE_CONFIG.spread;

      const colorChoice = Math.random();
      let colorEntry = PARTICLE_COLORS[PARTICLE_COLORS.length - 1];
      for (const entry of PARTICLE_COLORS) {
        if (colorChoice < entry.threshold) { colorEntry = entry; break; }
      }
      colors[i * 3] = colorEntry.r;
      colors[i * 3 + 1] = colorEntry.g;
      colors[i * 3 + 2] = colorEntry.b;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: PARTICLE_CONFIG.size,
      vertexColors: true,
      transparent: true,
      opacity: PARTICLE_CONFIG.opacity,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(this.particles);
  }

  private initializeControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = CONTROLS_CONFIG.dampingFactor;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = CAMERA_CONFIG.distance * CONTROLS_CONFIG.minDistanceFactor;
    this.controls.maxDistance = CAMERA_CONFIG.distance * CONTROLS_CONFIG.maxDistanceFactor;
    this.controls.minPolarAngle = CONTROLS_CONFIG.minPolarAngle;
    this.controls.maxPolarAngle = CONTROLS_CONFIG.maxPolarAngle;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  // --- Interaction ---

  private setupMouseInteraction(): void {
    const canvas = this.renderer.domElement;

    this.mousemoveHandler = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(Array.from(this.tileMeshes.values()));

      if (this.hoveredTile && this.hoveredTile !== this.getSelectedTileMesh()) {
        const material = this.hoveredTile.material as THREE.MeshStandardMaterial;
        const tileKey = `${this.hoveredTile.userData['row']}-${this.hoveredTile.userData['col']}`;
        if (this.highlightedTiles.has(tileKey)) {
          // Restore exact interpolated heatmap color (smooth, no tier quantization)
          const r = this.hoveredTile.userData['heatmapR'] ?? 0;
          const g = this.hoveredTile.userData['heatmapG'] ?? 0;
          const b = this.hoveredTile.userData['heatmapB'] ?? 0;
          const hmIntensity = this.hoveredTile.userData['heatmapIntensity'] ?? TILE_EMISSIVE.base;
          material.emissive.setRGB(r, g, b);
          material.emissiveIntensity = hmIntensity;
        } else {
          const tileType = this.hoveredTile.userData['tile'].type;
          material.emissiveIntensity = tileType === BlockType.BASE ? TILE_EMISSIVE.base : tileType === BlockType.WALL ? TILE_EMISSIVE.wall : TILE_EMISSIVE.special;
        }
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
            this.towerPreviewService.showPreview(this.selectedTowerType!, row, col, canPlace, this.scene);
          }
        } else {
          this.lastPreviewKey = '';
          this.hoveredTileCost = 0;
    this.hoveredTilePercent = 0;
          this.towerPreviewService.hidePreview(this.scene);
        }
      } else {
        this.hoveredTile = null;
        canvas.style.cursor = 'default';
        this.lastPreviewKey = '';
        this.hoveredTileCost = 0;
    this.hoveredTilePercent = 0;
        this.towerPreviewService.hidePreview(this.scene);
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
    const canvas = this.renderer.domElement;

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
      if (!this.camera || !this.controls) return;

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
          this.camera.position.x += panX;
          this.camera.position.z += panZ;
          this.controls.target.x += panX;
          this.controls.target.z += panZ;

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
            .subVectors(this.camera.position, this.controls.target)
            .normalize();
          const newPos = this.camera.position.clone().addScaledVector(dir, zoomDelta);
          const newDist = newPos.distanceTo(this.controls.target);

          if (newDist >= TOUCH_CONFIG.minZoom && newDist <= TOUCH_CONFIG.maxZoom) {
            this.camera.position.copy(newPos);
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
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check for tower mesh hits first (works in both PLACE and INSPECT modes)
    const towerGroups = Array.from(this.towerMeshes.values());
    const towerChildren: THREE.Object3D[] = [];
    towerGroups.forEach(g => g.traverse(child => { if (child instanceof THREE.Mesh) towerChildren.push(child); }));
    const towerHits = this.raycaster.intersectObjects(towerChildren);

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
    const intersects = this.raycaster.intersectObjects(Array.from(this.tileMeshes.values()));

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

    const phase = this.gameStateService.getState().phase;
    if (phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT) return;

    if (!this.gameBoardService.canPlaceTower(row, col)) {
      // Check specifically if this was a path-blocking rejection
      const tile = this.gameBoardService.getGameBoard()[row]?.[col];
      if (tile && tile.type === BlockType.BASE && tile.isPurchasable && tile.towerType === null) {
        // Tile is otherwise valid — blocked due to path check
        this.showPathBlockedWarning();
      }
      return;
    }

    // Use tile-specific strategic pricing
    const priceInfo = this.getTileTowerCost(this.selectedTowerType, row, col);
    const effectiveCost = priceInfo.cost;

    // Check if player can afford tower
    if (!this.gameStateService.canAfford(effectiveCost)) return;

    if (this.gameBoardService.placeTower(row, col, this.selectedTowerType)) {
      // Deduct gold
      this.gameStateService.spendGold(effectiveCost);

      // Track challenge stats — gold and tower type
      this.challengeTotalGoldSpent += effectiveCost;
      this.challengeTowerTypesUsed.add(this.selectedTowerType);

      // Create tower mesh
      const towerMesh = this.gameBoardService.createTowerMesh(row, col, this.selectedTowerType);
      const key = `${row}-${col}`;
      this.towerMeshes.set(key, towerMesh);
      this.scene.add(towerMesh);

      // Register tower with combat service, then update peak tower count
      this.towerCombatService.registerTower(row, col, this.selectedTowerType, towerMesh, effectiveCost);
      const peakCount = this.towerCombatService.getPlacedTowers().size;
      if (peakCount > this.challengeMaxTowersPlaced) {
        this.challengeMaxTowersPlaced = peakCount;
      }

      this.audioService.playTowerPlace();
      this.gameStatsService.recordTowerBuilt();

      // Hide preview and invalidate BFS cache — board layout changed
      this.lastPreviewKey = '';
      this.towerPreviewService.hidePreview(this.scene);

      // Repath only enemies whose path crosses the newly placed tower tile
      this.enemyService.repathAffectedEnemies(row, col);
      this.tilePricingService.invalidateCache();
      this.refreshPathOverlay();

      // Recompute valid tile highlights — board changed
      this.updateTileHighlights();
    }
  }

  private getSelectedTileMesh(): THREE.Mesh | null {
    if (!this.selectedTile) return null;
    return this.tileMeshes.get(`${this.selectedTile.row}-${this.selectedTile.col}`) || null;
  }

  togglePause(): void {
    this.gameStateService.togglePause();
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
    if (this.gameState.phase !== GamePhase.SETUP) return;
    const newValue = !this.gameState.isEndless;
    this.gameStateService.setEndlessMode(newValue);
    this.waveService.setEndlessMode(newValue);
  }

  // --- Tutorial ---

  getTutorialTip(): TutorialTip | null {
    return this.currentTutorialStep ? this.tutorialService.getTip(this.currentTutorialStep) : null;
  }

  getTutorialStepNumber(): number {
    const displaySteps = Object.values(TutorialStep).filter(s => s !== TutorialStep.COMPLETE);
    const idx = displaySteps.indexOf(this.currentTutorialStep as TutorialStep);
    return Math.max(1, idx + 1);
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
    this.showAllRanges = !this.showAllRanges;

    // Remove existing range rings
    for (const mesh of this.rangeRingMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      disposeMaterial(mesh.material);
    }
    this.rangeRingMeshes = [];

    if (this.showAllRanges) {
      const boardWidth = this.gameBoardService.getBoardWidth();
      const boardHeight = this.gameBoardService.getBoardHeight();
      const tileSize = this.gameBoardService.getTileSize();

      this.towerCombatService.getPlacedTowers().forEach(tower => {
        const stats = getEffectiveStats(tower.type, tower.level, tower.specialization);
        const worldX = (tower.col - boardWidth / 2) * tileSize;
        const worldZ = (tower.row - boardHeight / 2) * tileSize;
        const ring = this.createRangeRing(
          stats.range,
          RANGE_PREVIEW_CONFIG.allRangesColor,
          RANGE_PREVIEW_CONFIG.opacity * RANGE_PREVIEW_CONFIG.allRangesOpacityScale,
          worldX,
          worldZ
        );
        this.scene.add(ring);
        this.rangeRingMeshes.push(ring);
      });
    }
  }

  togglePathOverlay(): void {
    this.showPathOverlay = !this.showPathOverlay;

    if (this.showPathOverlay) {
      this.refreshPathOverlay();
    } else {
      this.pathVisualizationService.hidePath(this.scene);
    }
  }

  private refreshPathOverlay(): void {
    if (!this.showPathOverlay) return;
    const worldPath = this.enemyService.getPathToExit();
    if (worldPath.length > 0) {
      this.pathVisualizationService.showPath(worldPath, this.scene);
    } else {
      this.pathVisualizationService.hidePath(this.scene);
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
        // Escape: if in PLACE mode, cancel placement; otherwise deselect placed tower
        event.preventDefault();
        if (this.isPlaceMode) {
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
    if (this.panKeys.size === 0 || !this.camera || !this.controls) return;

    let dx = 0;
    let dz = 0;
    if (this.panKeys.has('w') || this.panKeys.has('arrowup')) dz -= CAMERA_CONFIG.panSpeed;
    if (this.panKeys.has('s') || this.panKeys.has('arrowdown')) dz += CAMERA_CONFIG.panSpeed;
    if (this.panKeys.has('a') || this.panKeys.has('arrowleft')) dx -= CAMERA_CONFIG.panSpeed;
    if (this.panKeys.has('d') || this.panKeys.has('arrowright')) dx += CAMERA_CONFIG.panSpeed;

    this.camera.position.x += dx;
    this.camera.position.z += dz;
    this.controls.target.x += dx;
    this.controls.target.z += dz;
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

    if (this.controls) {
      this.controls.update();
    }

    // Animate ambient particles
    if (this.particles) {
      const positionAttribute = this.particles.geometry.attributes['position'] as THREE.BufferAttribute;
      const positions = positionAttribute.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += Math.sin(time * PARTICLE_CONFIG.animSpeedTime + i) * PARTICLE_CONFIG.animSpeedWave;
      }
      positionAttribute.needsUpdate = true;
      this.particles.rotation.y += PARTICLE_CONFIG.rotationSpeed;
    }

    // Update skybox time uniform for star twinkle and nebula drift
    if (this.skybox) {
      (this.skybox.material as THREE.ShaderMaterial).uniforms['time'].value = time * ANIMATION_CONFIG.msToSeconds;
    }

    // Gameplay tick — fixed timestep accumulator
    if (deltaTime > 0) {
      const state = this.gameStateService.getState();

      if (state.phase === GamePhase.COMBAT && !state.isPaused) {
        this.physicsAccumulator += deltaTime * state.gameSpeed;
        let stepCount = 0;

        // Elapsed time tracking — accumulate real (unscaled) time, flush every ~1 second
        this.elapsedTimeAccumulator += deltaTime;
        if (this.elapsedTimeAccumulator >= PHYSICS_CONFIG.elapsedTimeFlushIntervalS) {
          this.gameStateService.addElapsedTime(this.elapsedTimeAccumulator);
          this.elapsedTimeAccumulator = 0;
        }

        // Accumulate visual events across all physics steps — process once per frame
        const frameKills: { damage: number; position: { x: number; y: number; z: number }; color: number; value: number }[] = [];
        const frameFiredTypes: Set<TowerType> = new Set();
        let frameHitCount = 0;
        let frameExitCount = 0;

        while (this.physicsAccumulator >= PHYSICS_CONFIG.fixedTimestep &&
               stepCount < PHYSICS_CONFIG.maxStepsPerFrame) {

          // Wave spawning
          this.waveService.update(PHYSICS_CONFIG.fixedTimestep, this.scene);

          // Tower combat — returns IDs of enemies killed, tower types that fired, and hit count
          const { killed: killedByTowers, fired: firedTowerTypes, hitCount } = this.towerCombatService.update(PHYSICS_CONFIG.fixedTimestep, this.scene);

          // Accumulate fired tower types and hit counts for audio (once per frame)
          for (const towerType of firedTowerTypes) {
            frameFiredTypes.add(towerType);
          }
          frameHitCount += hitCount;

          // Collect gold from tower kills and remove dead enemies
          for (const killInfo of killedByTowers) {
            const enemy = this.enemyService.getEnemies().get(killInfo.id);
            if (enemy) {
              this.gameStateService.addGold(enemy.value);
              this.gameStatsService.recordGoldEarned(enemy.value);

              // Snapshot visual data for deferred rendering (enemy removed below)
              frameKills.push({
                damage: killInfo.damage,
                position: { ...enemy.position },
                color: ENEMY_STATS[enemy.type]?.color ?? ENEMY_VISUAL_CONFIG.fallbackColor,
                value: enemy.value,
              });

              this.enemyService.removeEnemy(killInfo.id, this.scene);
            }
          }

          // Move enemies along paths
          const reachedExit = this.enemyService.updateEnemies(PHYSICS_CONFIG.fixedTimestep);

          // Enemies reaching the exit cost lives scaled by enemy type
          for (const enemyId of reachedExit) {
            const leakedEnemy = this.enemyService.getEnemies().get(enemyId);
            const leakCost = leakedEnemy?.leakDamage ?? 1;
            this.gameStateService.loseLife(leakCost);
            this.leakedThisWave = true;
            this.gameStatsService.recordEnemyLeaked();
            frameExitCount++;
            this.enemyService.removeEnemy(enemyId, this.scene);
          }

          // Check wave completion: no spawning and no enemies alive
          // Re-read phase — loseLife() above may have set DEFEAT mid-frame
          const currentPhase = this.gameStateService.getState().phase;
          if (currentPhase === GamePhase.DEFEAT && !this.defeatSoundPlayed) {
            this.defeatSoundPlayed = true;
            this.audioService.playDefeat();
          }
          if (currentPhase === GamePhase.COMBAT &&
              !this.waveService.isSpawning() &&
              this.enemyService.getEnemies().size === 0) {
            const reward = this.waveService.getWaveReward(state.wave);
            // Award streak bonus before completeWave transitions out of COMBAT
            if (!this.leakedThisWave) {
              this.gameStateService.addStreakBonus();
            }
            this.gameStateService.completeWave(reward);
            // Check if completeWave triggered VICTORY
            const postWavePhase = this.gameStateService.getState().phase;
            if (postWavePhase === GamePhase.VICTORY && !this.victorySoundPlayed) {
              this.victorySoundPlayed = true;
              this.audioService.playVictory();
            } else if (postWavePhase === GamePhase.INTERMISSION) {
              this.audioService.playWaveClear();
              this.lastWaveReward = reward;
              this.lastInterestEarned = this.gameStateService.awardInterest();
            }

            // Record game end stats for profile (VICTORY or DEFEAT, fires once per game)
            if ((postWavePhase === GamePhase.VICTORY || postWavePhase === GamePhase.DEFEAT) && !this.gameEndRecorded) {
              this.gameEndRecorded = true;
              const endState = this.gameStateService.getState();
              const stats = this.gameStatsService.getStats();
              const totalKills = Object.values(stats.killsByTowerType).reduce((a, b) => a + b, 0);
              const gameEndStats: GameEndStats = {
                isVictory: postWavePhase === GamePhase.VICTORY,
                score: endState.score,
                enemiesKilled: totalKills,
                goldEarned: stats.totalGoldEarned,
                wavesCompleted: endState.wave,
                livesLost: DIFFICULTY_PRESETS[endState.difficulty].lives - endState.lives,
              };
              this.newlyUnlockedAchievements = this.playerProfileService.recordGameEnd(gameEndStats);
              this.updateAchievementDetails();
              const mapId = this.mapBridge.getMapId();
              if (mapId && this.scoreBreakdown) {
                this.playerProfileService.recordMapScore(
                  mapId,
                  this.scoreBreakdown.finalScore,
                  this.scoreBreakdown.stars,
                  this.scoreBreakdown.difficulty
                );
                // Evaluate and record challenge completions on VICTORY for campaign levels
                if (postWavePhase === GamePhase.VICTORY && this.campaignService.getLevel(mapId)) {
                  this.campaignService.recordCompletion(
                    mapId,
                    this.scoreBreakdown.finalScore,
                    this.scoreBreakdown.stars,
                    endState.difficulty
                  );
                  const challengeEndState = {
                    livesLost: gameEndStats.livesLost,
                    elapsedTime: endState.elapsedTime,
                    totalGoldSpent: this.challengeTotalGoldSpent,
                    maxTowersPlaced: this.challengeMaxTowersPlaced,
                    towerTypesUsed: new Set<string>(this.challengeTowerTypesUsed),
                  };
                  const newlyChallenged = this.challengeEvaluatorService.evaluateChallenges(
                    mapId,
                    challengeEndState
                  );
                  this.completedChallenges = newlyChallenged;
                  for (const challenge of newlyChallenged) {
                    this.campaignService.completeChallenge(challenge.id);
                    this.gameStateService.addScore(challenge.scoreBonus);
                  }
                }
              }
            }
          }

          // DEFEAT mid-frame (from loseLife) — record game end if not yet done
          if (currentPhase === GamePhase.DEFEAT && !this.gameEndRecorded) {
            this.gameEndRecorded = true;
            const endState = this.gameStateService.getState();
            const stats = this.gameStatsService.getStats();
            const totalKills = Object.values(stats.killsByTowerType).reduce((a, b) => a + b, 0);
            const gameEndStats: GameEndStats = {
              isVictory: false,
              score: endState.score,
              enemiesKilled: totalKills,
              goldEarned: stats.totalGoldEarned,
              wavesCompleted: endState.wave,
              livesLost: DIFFICULTY_PRESETS[endState.difficulty].lives - endState.lives,
            };
            this.newlyUnlockedAchievements = this.playerProfileService.recordGameEnd(gameEndStats);
            this.updateAchievementDetails();
            const mapId = this.mapBridge.getMapId();
            if (mapId && this.scoreBreakdown) {
              this.playerProfileService.recordMapScore(
                mapId,
                this.scoreBreakdown.finalScore,
                this.scoreBreakdown.stars,
                this.scoreBreakdown.difficulty
              );
            }
          }

          this.physicsAccumulator -= PHYSICS_CONFIG.fixedTimestep;
          stepCount++;
        }

        // Process accumulated visual events once per frame (not per physics step)
        for (const towerType of frameFiredTypes) {
          this.audioService.playTowerFire(towerType);
        }
        if (frameHitCount > 0) {
          this.audioService.playEnemyHit();
        }
        for (const kill of frameKills) {
          this.audioService.playGoldEarned();
          this.audioService.playEnemyDeath();
          this.particleService.spawnDeathBurst(kill.position, kill.color);
          this.goldPopupService.spawn(kill.value, kill.position, this.scene);
          this.damagePopupService.spawn(kill.damage, kill.position, this.scene);
        }
        if (frameExitCount > 0) {
          this.screenShakeService.trigger(SCREEN_SHAKE_CONFIG.lifeLossIntensity, SCREEN_SHAKE_CONFIG.lifeLossDuration);
        }

        // Update health bars and status effect visuals once per frame
        this.enemyService.updateHealthBars(this.camera.quaternion);
        this.enemyService.updateStatusVisuals(this.statusEffectService.getAllActiveEffects());
        this.enemyService.updateEnemyAnimations(deltaTime);

        // Update minimap
        this.updateMinimap(time);
      }
    }

    // Animate tower idle effects and tile pulses
    this.updateTowerAnimations(time);
    this.updateTilePulse(time);

    // Update visual effects (run every frame regardless of pause)
    if (deltaTime > 0) {
      this.particleService.addPendingToScene(this.scene);
      this.particleService.update(deltaTime, this.scene);
      this.goldPopupService.update(deltaTime);
      this.damagePopupService.update(deltaTime);
      this.screenShakeService.update(deltaTime, this.camera);
    }

    // Render
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private updateMinimap(timeMs: number): void {
    const boardWidth = this.gameBoardService.getBoardWidth();
    const boardHeight = this.gameBoardService.getBoardHeight();

    // Build spawn/exit point lists from the service
    const spawnerTiles = this.gameBoardService.getSpawnerTiles();
    const exitTiles = this.gameBoardService.getExitTiles();

    const terrain: MinimapTerrainData = {
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
    const entities: MinimapEntityData[] = [];
    this.towerCombatService.getPlacedTowers().forEach((tower) => {
      entities.push({ x: tower.col, z: tower.row, type: 'tower' });
    });
    this.enemyService.getEnemies().forEach((enemy) => {
      entities.push({ x: enemy.gridPosition.col, z: enemy.gridPosition.row, type: 'enemy' });
    });
    this.minimapService.update(timeMs, terrain, entities);
  }

  private updateTowerAnimations(time: number): void {
    const t = time * ANIMATION_CONFIG.msToSeconds;
    for (const group of this.towerMeshes.values()) {
      const towerType = group.userData['towerType'] as TowerType | undefined;
      if (!towerType) continue;

      group.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        switch (child.name) {
          case 'crystal':
            if (towerType === TowerType.BASIC) {
              child.position.y = TOWER_ANIM_CONFIG.crystalBaseY
                + Math.sin(t * TOWER_ANIM_CONFIG.crystalBobSpeed) * TOWER_ANIM_CONFIG.crystalBobAmplitude;
              child.rotation.y = t * TOWER_ANIM_CONFIG.basicCrystalRotSpeed;
            } else if (towerType === TowerType.SLOW) {
              child.position.y = TOWER_ANIM_CONFIG.slowCrystalBaseY
                + Math.sin(t * TOWER_ANIM_CONFIG.crystalBobSpeed) * TOWER_ANIM_CONFIG.slowCrystalBobAmplitude;
              child.rotation.y = t * TOWER_ANIM_CONFIG.slowCrystalRotSpeed;
            }
            break;

          case 'orb': {
            const pulseScale = TOWER_ANIM_CONFIG.orbPulseMin
              + (Math.sin(t * TOWER_ANIM_CONFIG.orbPulseSpeed) * 0.5 + 0.5)
              * (TOWER_ANIM_CONFIG.orbPulseMax - TOWER_ANIM_CONFIG.orbPulseMin);
            child.scale.setScalar(pulseScale);
            break;
          }

          case 'spark': {
            if (child.userData['baseY'] === undefined) child.userData['baseY'] = child.position.y;
            child.position.y = child.userData['baseY']
              + Math.sin(t * TOWER_ANIM_CONFIG.sparkBobSpeed + child.position.x * TOWER_ANIM_CONFIG.sparkPhaseScale) * TOWER_ANIM_CONFIG.sparkBobAmplitude;
            break;
          }

          case 'spore': {
            if (child.userData['baseY'] === undefined) child.userData['baseY'] = child.position.y;
            child.position.y = child.userData['baseY']
              + Math.sin(t * TOWER_ANIM_CONFIG.sporeBobSpeed + child.position.x * TOWER_ANIM_CONFIG.sporePhaseScale) * TOWER_ANIM_CONFIG.sporeBobAmplitude;
            break;
          }

          case 'tip': {
            const mat = child.material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = TOWER_ANIM_CONFIG.tipGlowMin
              + (Math.sin(t * TOWER_ANIM_CONFIG.tipGlowSpeed) * 0.5 + 0.5)
              * (TOWER_ANIM_CONFIG.tipGlowMax - TOWER_ANIM_CONFIG.tipGlowMin);
            break;
          }
        }
      });
    }
  }

  private updateTilePulse(time: number): void {
    const t = time * ANIMATION_CONFIG.msToSeconds;
    const intensity = TILE_PULSE_CONFIG.min
      + (Math.sin(t * TILE_PULSE_CONFIG.speed) * 0.5 + 0.5)
      * (TILE_PULSE_CONFIG.max - TILE_PULSE_CONFIG.min);

    for (const mesh of this.tileMeshes.values()) {
      const tileType = mesh.userData?.['tile']?.type;
      if (tileType === BlockType.SPAWNER || tileType === BlockType.EXIT) {
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
      }
    }
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

    window.removeEventListener('keydown', this.keyboardHandler);
    window.removeEventListener('keydown', this.keydownPanHandler);
    window.removeEventListener('keyup', this.keyupPanHandler);
    window.removeEventListener('resize', this.resizeHandler);
    this.removeDragListeners();

    // Remove canvas event listeners (stored as named references)
    if (this.renderer) {
      const canvas = this.renderer.domElement;
      canvas.removeEventListener('mousemove', this.mousemoveHandler);
      canvas.removeEventListener('click', this.clickHandler);
      canvas.removeEventListener('contextmenu', this.contextmenuHandler);
      canvas.removeEventListener('touchstart', this.touchStartHandler);
      canvas.removeEventListener('touchmove', this.touchMoveHandler);
      canvas.removeEventListener('touchend', this.touchEndHandler);
    }

    if (this.controls) {
      this.controls.dispose();
    }

    if (this.scene) {
      this.cleanupGameObjects();
    }

    this.audioService.cleanup();
    this.particleService.cleanup(this.scene);
    this.goldPopupService.cleanup(this.scene);
    // priceLabelService already cleaned by cleanupGameObjects → clearTileHighlights
    this.screenShakeService.cleanup(this.camera);
    this.fpsCounterService.reset();

    if (this.vignettePass) {
      this.vignettePass.dispose();
    }

    if (this.bloomPass) {
      this.bloomPass.dispose();
    }

    if (this.renderPass) {
      this.renderPass.dispose();
    }

    if (this.composer) {
      this.composer.renderTarget1.dispose();
      this.composer.renderTarget2.dispose();
      this.composer.dispose();
    }

    if (this.contextLostHandler && this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLostHandler as EventListener);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.contextRestoredHandler as EventListener);
    }

    if (this.renderer) {
      if (this.renderer.domElement?.parentElement) {
        this.renderer.domElement.remove();
      }
      this.renderer.dispose();
    }
  }
}
