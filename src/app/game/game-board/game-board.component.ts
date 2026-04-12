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
// Phase H5: CampaignService + CampaignMapService constructor injections deleted.
// game-board no longer depends on the campaign runtime. CampaignLevel and
// ChallengeDefinition types are still imported ONLY for the game-setup-panel
// template binding contract — the values passed are always null/empty in the
// unified run-only architecture. These imports go away in H10/H14 when the
// setup panel is refactored for the run context.
import type { CampaignLevel } from '../../run/data/campaign-levels';
import type { ChallengeDefinition } from '../../run/data/challenges';
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
import { CombatVFXService } from './services/combat-vfx.service';
// M2 S5: ProjectileService import removed — file deleted in this phase.
import { GamePauseService } from './services/game-pause.service';
import { ChallengeDisplayService } from './services/challenge-display.service';
import { TowerUpgradeVisualService } from './services/tower-upgrade-visual.service';
import { TowerPlacementService } from './services/tower-placement.service';
import { TowerSelectionService } from './services/tower-selection.service';
import { FocusTrap } from '../../shared/utils/focus-trap.util';
import { RunService } from '../../run/services/run.service';
import { RelicService } from '../../run/services/relic.service';
import { DeckService } from '../../run/services/deck.service';
import { CardEffectService, SpellContext } from '../../run/services/card-effect.service';
import { EncounterResult } from '../../run/models/run-state.model';
import { AscensionEffectType, getAscensionEffects } from '../../run/models/ascension.model';
import { ModifierEffects } from './models/game-modifier.model';
import {
  CardInstance,
  DeckState,
  EnergyState,
  SpellCardEffect,
  ModifierCardEffect,
  UtilityCardEffect,
} from '../../run/models/card.model';
import { getCardDefinition, getActiveTowerEffect } from '../../run/constants/card-definitions';

/** A small tactical badge shown in the wave preview for each enemy type. */
export interface EnemyBadge {
  text: string;
  severity: 'info' | 'warning' | 'danger';
}

/** Phase 4: how many upcoming turns to show in the combat shell spawn preview. */
const SPAWN_PREVIEW_TURNS = 4;

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
  providers: [SceneService, EnemyService, EnemyVisualService, EnemyHealthService, PathfindingService, GameStateService, WaveService, TowerCombatService, ChainLightningService, AudioService, ParticleService, ScreenShakeService, GoldPopupService, FpsCounterService, GameStatsService, DamagePopupService, MinimapService, TowerPreviewService, PathVisualizationService, StatusEffectService, TilePricingService, PriceLabelService, GameNotificationService, ChallengeTrackingService, GameEndService, GameSessionService, TowerInteractionService, CombatLoopService, TileHighlightService, TowerAnimationService, RangeVisualizationService, TowerMeshFactoryService, EnemyMeshFactoryService, GameInputService, GamePauseService, ChallengeDisplayService, TowerUpgradeVisualService, TowerPlacementService, TowerSelectionService]
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

  // Ascent Mode — deck state exposed to CardHandComponent via template
  deckState: DeckState | null = null;
  energyState: EnergyState | null = null;
  private deckSub: Subscription | null = null;
  private energySub: Subscription | null = null;

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
    private towerSelectionService: TowerSelectionService,
    // Phase H5: campaignService + campaignMapService removed — game-board
    // no longer depends on campaign runtime. Getters below return safe defaults.
    private runService: RunService,
    private relicService: RelicService,
    private deckService: DeckService,
    private cardEffectService: CardEffectService,
    private combatVFXService: CombatVFXService,
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

      // Terminal phase: record encounter result and route back to the run hub.
      // There is no standalone scoring overlay — run summary is shown by the run module.
      if (
        (state.phase === GamePhase.VICTORY || state.phase === GamePhase.DEFEAT) &&
        prevPhase !== GamePhase.VICTORY &&
        prevPhase !== GamePhase.DEFEAT
      ) {
        const isVictory = state.phase === GamePhase.VICTORY;
        const livesAtStart = DIFFICULTY_PRESETS[state.difficulty].lives;
        const killStats = this.gameStatsService.getStats();
        const totalKills = Object.values(killStats.killsByTowerType).reduce((a, b) => a + b, 0);
        const result: EncounterResult = {
          nodeId: this.runService.getCurrentEncounter()?.nodeId ?? '',
          nodeType: this.runService.getCurrentEncounter()?.nodeType ?? 'combat',
          victory: isVictory,
          livesLost: livesAtStart - state.lives,
          goldEarned: state.gold,
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

    // Apply run encounter config: lives, gold, waves, ascension modifiers
    this.gameStateService.setInitialLives(runState.lives, runState.maxLives + this.relicService.getMaxLivesBonus());
    this.gameStateService.addGold(this.relicService.getStartingGoldBonus());
    this.waveService.setCustomWaves(encounter.waves);
    this.gameStateService.setMaxWaves(encounter.waves.length);
    this.applyAscensionModifiers(runState.ascensionLevel, encounter.isElite, encounter.isBoss);
    this.updateChallengeIndicators();

    // Subscribe to deck/energy state for the card hand UI
    this.deckSub = this.deckService.deckState$.subscribe(s => { this.deckState = s; });
    this.energySub = this.deckService.energy$.subscribe(e => { this.energyState = e; });

    // Initialize deck for this encounter and draw the opening hand
    this.deckService.resetForEncounter();
    this.deckService.drawForWave();

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

    // Seed initial wave preview for the first wave (after setCustomWaves(encounter.waves) applies hand-authored or procedural waves)
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
    this.cancelPendingTowerCard();
    this.selectedTowerType = null;
    this.lastPreviewKey = '';
    this.hoveredTileCost = 0;
    this.hoveredTilePercent = 0;
    this.clearTileHighlights();
    if (this.sceneService.getScene()) {
      this.towerPreviewService.hidePreview(this.sceneService.getScene());
    }
  }

  /** Whether a tower type is selected for placement (PLACE mode).
   *  Placement always requires a pending tower card — cards are the only path to tower placement. */
  get isPlaceMode(): boolean {
    return this.selectedTowerType !== null && this.pendingTowerCard !== null;
  }

  // --- Card hand ---

  /**
   * Tower card waiting to be consumed — held in limbo between card click
   * and actual tower placement. Energy is deducted only on successful
   * placement; cancel returns the card to hand.
   */
  private pendingTowerCard: CardInstance | null = null;

  /** Expose pending tower card instanceId to template for CardHandComponent binding. */
  get pendingTowerCardId(): string | null {
    return this.pendingTowerCard?.instanceId ?? null;
  }

  /**
   * Handle a card played from CardHandComponent.
   *
   * Tower cards: defer consumption — enter placement mode, consume on
   * actual tile click. Cancel returns card to hand.
   *
   * Spell/modifier/utility: consume immediately (instant effects).
   */
  onCardPlayed(card: CardInstance): void {
    // M3 S5: card play locked to COMBAT phase. INTERMISSION/SETUP/VICTORY/DEFEAT
    // do NOT accept card plays — prevents stale-hand exploits between waves and
    // matches the StS turn-discrete model.
    const phase = this.gameStateService.getState().phase;
    if (phase !== GamePhase.COMBAT) {
      return;
    }
    // Clicking the pending tower card again cancels placement
    if (this.pendingTowerCard && this.pendingTowerCard.instanceId === card.instanceId) {
      this.cancelPlacement();
      return;
    }
    // Block other card plays while a tower card is awaiting placement
    if (this.pendingTowerCard) return;

    const def = getCardDefinition(card.cardId);
    const effect = card.upgraded && def.upgradedEffect ? def.upgradedEffect : def.effect;

    if (effect.type === 'tower') {
      // Cancel any existing pending tower card first (defensive — pendingTowerCard is null here due to guard above)
      this.cancelPendingTowerCard();

      // Check energy affordability without consuming
      if (this.deckService.getEnergy().current < def.energyCost) return;

      // Hold the card in limbo — don't consume yet
      this.pendingTowerCard = card;
      this.selectedTowerType = effect.towerType;
      return;
    }

    // Non-tower cards: consume immediately
    if (!this.deckService.playCard(card.instanceId)) return;

    switch (effect.type) {
      case 'spell': {
        const spellEffect = effect as SpellCardEffect;
        if (spellEffect.spellId === 'fortify') {
          this.fortifyRandomTower();
        } else if (spellEffect.spellId === 'salvage') {
          this.salvageLastTower();
        } else {
          this.cardEffectService.applySpell(spellEffect, {
            gameState: this.gameStateService,
            enemyService: this.enemyService,
            statusEffectService: this.statusEffectService,
            currentTurn: this.combatLoopService.getTurnNumber(),
            deckService: this.deckService,
          } satisfies SpellContext);
        }
        break;
      }
      case 'modifier':
        this.cardEffectService.applyModifier(effect as ModifierCardEffect);
        break;
      case 'utility':
        this.executeUtilityCard(effect as UtilityCardEffect);
        break;
    }
  }

  /** Cancel the pending tower card — return it to hand without consuming energy. */
  private cancelPendingTowerCard(): void {
    this.pendingTowerCard = null;
  }

  /**
   * Consume the pending tower card after successful tower placement.
   * Called from tryPlaceTower() on successful placement.
   */
  private consumePendingTowerCard(): void {
    if (!this.pendingTowerCard) return;
    this.deckService.playCard(this.pendingTowerCard.instanceId);
    this.pendingTowerCard = null;
  }

  /**
   * Fortify spell — upgrade a random tower one level for free.
   * If no tower can be upgraded (all at max level), this is a no-op.
   * Only L1→L2 upgrades are applied; L2→L3 requires specialization choice
   * which cannot be automated, so those towers are excluded.
   */
  private fortifyRandomTower(): void {
    const towers = Array.from(this.towerCombatService.getPlacedTowers().values());
    // Exclude max-level towers and L2 towers (L2→L3 requires specialization)
    const upgradable = towers.filter(t => t.level < MAX_TOWER_LEVEL - 1);
    if (upgradable.length === 0) return;

    const target = upgradable[Math.floor(Math.random() * upgradable.length)];
    const key = `${target.row}-${target.col}`;

    // Bypass gold cost — free upgrade. Pass actualCost=0 so totalInvested stays clean.
    const upgraded = this.towerCombatService.upgradeTower(key, 0);
    if (!upgraded) return;

    this.audioService.playTowerUpgrade();

    const towerMesh = this.towerMeshes.get(key);
    if (towerMesh) {
      this.towerUpgradeVisualService.applyUpgradeVisuals(towerMesh, target.level + 1, undefined);
    }

    // Invalidate muzzle flash saved emissive — upgrade changed the baseline
    target.originalEmissiveIntensity = undefined;
    target.muzzleFlashTimer = undefined;

    this.updateChallengeIndicators();
  }

  /**
   * Salvage spell — sell the most recently placed tower for a 100% refund.
   * If no towers are placed, this is a no-op.
   */
  private salvageLastTower(): void {
    const towers = Array.from(this.towerCombatService.getPlacedTowers().values());
    if (towers.length === 0) return;

    // Most recently placed tower is last in insertion order (Map preserves order)
    const last = towers[towers.length - 1];
    const key = `${last.row}-${last.col}`;

    // Unregister from combat first (confirm-before-refund pattern)
    const soldTower = this.towerCombatService.unregisterTower(key);
    if (!soldTower) return;

    // 100% refund — salvage overrides the normal sell rate
    this.gameStateService.addGold(soldTower.totalInvested);
    this.gameBoardService.removeTower(soldTower.row, soldTower.col);

    this.audioService.playTowerSell();
    this.gameStatsService.recordTowerSold();

    // Dispose and remove mesh
    const towerMesh = this.towerMeshes.get(key);
    if (towerMesh) {
      this.sceneService.getScene().remove(towerMesh);
      towerMesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
      this.towerMeshes.delete(key);
      this.rebuildTowerChildrenArray();
    }

    // Repath ground enemies — freed tile may open shorter paths
    this.enemyService.repathAffectedEnemies(-1, -1);

    this.lastPreviewKey = '';
    this.refreshPathOverlay();

    // If this was the selected tower, deselect it
    if (this.selectedTowerInfo?.id === key) {
      this.deselectTower();
    }

    this.updateTileHighlights();
    this.updateChallengeIndicators();
  }

  /** @deprecated Delegated to CardEffectService.applySpell — kept only as a reference. */
  private executeSpellCard(_effect: SpellCardEffect): void { /* no-op */ }

  /** @deprecated Delegated to CardEffectService.applyModifier — kept only as a reference. */
  private executeModifierCard(_effect: ModifierCardEffect): void { /* no-op */ }

  private executeUtilityCard(effect: UtilityCardEffect): void {
    switch (effect.utilityId) {
      case 'draw':
        for (let i = 0; i < effect.value; i++) {
          this.deckService.drawOne();
        }
        break;
      case 'energy':
        this.deckService.addEnergy(effect.value);
        break;
      case 'recycle': {
        const handSize = this.deckState?.hand.length ?? 0;
        this.deckService.discardHand();
        for (let i = 0; i < handSize + effect.value; i++) {
          this.deckService.drawOne();
        }
        break;
      }
      default:
        break;
    }
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

  // ── Phase H5: campaign getters neutered ─────────────────────────────────
  // These getters are stubs returning safe defaults. They exist solely so the
  // game-setup-panel template binding contract remains satisfied. Every value
  // is effectively dead in the run-only architecture.

  /** @deprecated Phase H5 — always false in run-only architecture. */
  get isCampaignGame(): boolean { return false; }

  /** True when the game was launched from the editor (map state loaded but no saved mapId). */
  get isEditorOrigin(): boolean {
    return this.mapBridge.hasEditorMap() && this.mapBridge.getMapId() === null;
  }

  /** @deprecated Phase H5 — always null. */
  get currentCampaignLevel(): CampaignLevel | null { return null; }

  /** @deprecated Phase H5 — always null. */
  get nextCampaignLevel(): CampaignLevel | null { return null; }

  /** @deprecated Phase H5 — always 0. */
  get activeSpeedRunTimeLimit(): number { return 0; }

  /** @deprecated Phase H5 — always false. */
  get isNextLevelUnlocked(): boolean { return false; }

  /** @deprecated Phase H5 — always empty. */
  get campaignChallenges(): ChallengeDefinition[] { return []; }

  /** @deprecated Phase H5 — always false. */
  isChallengeAlreadyCompleted(_challengeId: string): boolean { return false; }

  /** @deprecated Phase H5 — always false. */
  isChallengeCompleted(_challenge: ChallengeDefinition): boolean { return false; }

  /**
   * Recomputes challenge progress badges for the HUD via ChallengeDisplayService.
   * Passes the current encounter's campaignMapId so ChallengeDisplayService can
   * look up and evaluate any challenges attached to that map.
   */
  updateChallengeIndicators(): void {
    const encounter = this.runService.getCurrentEncounter();
    this.challengeDisplayService.updateIndicators(encounter?.campaignMapId ?? null);
  }

  /** @deprecated Phase H5 — no-op. playNextLevel was the campaign auto-advance. */
  playNextLevel(): void { /* no-op */ }

  /** @deprecated Phase H5 — navigates to /run instead of /campaign. */
  backToCampaign(): void {
    this.router.navigate(['/run']);
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
    this.relicService.resetWaveState();
    this.minimapService.show();

    // Discard previous hand and draw new wave hand (skip on the very first wave —
    // ngOnInit already drew the opening hand during encounter setup).
    if (state.wave > 0) {
      this.deckService.discardHand();
      this.deckService.drawForWave();
    }

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

  /**
   * Phase 4: advance combat by one discrete turn.
   *
   * Runs the resolution sequence (spawns → tower fire → enemy move → status
   * tick → kills/leaks → wave completion) via CombatLoopService.resolveTurn(),
   * dispatches audio and visual events, then draws a new hand for the next
   * player turn if combat continues.
   *
   * Guards: only runs during COMBAT phase; aborts if a tower card is mid-placement
   * (pending card is first cancelled to refund energy, then endTurn is re-invoked
   * by the user). No-op during VICTORY/DEFEAT.
   */
  endTurn(): void {
    const state = this.gameStateService.getState();
    if (state.phase !== GamePhase.COMBAT) return;
    if (this.initializationFailed || this.contextLost) return;

    // If a tower card is waiting for tile placement, cancel it first so the
    // player doesn't accidentally lose the card by ending the turn.
    if (this.pendingTowerCard) {
      this.cancelPlacement();
      return;
    }

    const result = this.combatLoopService.resolveTurn(
      this.sceneService.getScene(),
    );

    // Expire mortar zone visuals whose turn count has elapsed.
    // Must run after resolveTurn so the turn counter has already advanced.
    this.combatVFXService.tickMortarZoneVisualsForTurn(
      this.combatLoopService.getTurnNumber(),
      this.sceneService.getScene(),
    );

    // Phase 5: resolution feedback — brief screen-shake punctuates the
    // discrete turn so the player feels *something* happened, even when no
    // enemies are damaged. Scales up if leaks or kills occurred.
    const shakeIntensity = result.exitCount > 0
      ? SCREEN_SHAKE_CONFIG.lifeLossIntensity
      : result.kills.length > 0 ? 0.08 : 0.04;
    const shakeDuration = result.exitCount > 0
      ? SCREEN_SHAKE_CONFIG.lifeLossDuration
      : 0.12;
    this.screenShakeService.trigger(shakeIntensity, shakeDuration);

    // Dispatch audio, kill particles, wave banner, achievement pop-ups.
    // deltaTime=0 because discrete turn resolution doesn't advance real time.
    this.processCombatResult(result, 0, performance.now());

    // Draw a new hand for the next player turn if combat continues.
    const postPhase = this.gameStateService.getState().phase;
    if (postPhase === GamePhase.COMBAT) {
      this.deckService.discardHand();
      this.deckService.drawForWave();
    }
  }

  /**
   * @deprecated Phase H13: `restartGame` has no live callers. The game-results-overlay
   * component was removed (dead UI — zero template renderers since the run-mode pivot).
   * Roguelites do not let players restart encounters — the outcome is committed
   * and the player either progresses (reward node) or abandons the run (quit).
   * The method body is kept intact because ~20 spec tests still exercise its
   * reset paths (valuable coverage for the cleanup sequence), but no
   * production code path calls it. H2 test rewrite can decide whether to
   * retarget those tests against ngOnDestroy → re-init instead of delete.
   */
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

    // Reset component-only UI state (scoreBreakdown + starArray fields removed in H11)
    this.newlyUnlockedAchievements = [];
    this.achievementDetails = [];
    this.lastCompletedChallenges = [];
    // Refresh challenge indicators for the current encounter on restart.
    // The encounter is still live (same node re-entered), so pass the mapId directly.
    this.updateChallengeIndicators();
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

    // Re-apply run encounter config on restart. If the run was cleared between
    // the original load and the restart click, route back to the run hub.
    const encounter = this.runService.getCurrentEncounter();
    const runState = this.runService.runState;
    if (!runState || !encounter) {
      this.router.navigate(['/run']);
      return;
    }
    this.gameStateService.setInitialLives(runState.lives, runState.maxLives + this.relicService.getMaxLivesBonus());
    this.gameStateService.addGold(this.relicService.getStartingGoldBonus());
    this.waveService.setCustomWaves(encounter.waves);
    this.gameStateService.setMaxWaves(encounter.waves.length);
    this.applyAscensionModifiers(runState.ascensionLevel, encounter.isElite, encounter.isBoss);

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
   * Translate run ascension effects into ModifierEffects and inject them
   * into GameStateService so EnemyService picks them up at spawn time.
   * Must be called during SETUP phase (wave 0) — before the first wave starts.
   */
  private applyAscensionModifiers(ascensionLevel: number, isElite: boolean, isBoss: boolean): void {
    if (ascensionLevel <= 0) return;
    const ascEffects = getAscensionEffects(ascensionLevel);
    const effects: ModifierEffects = {};
    const baseHealthMult = ascEffects.get(AscensionEffectType.ENEMY_HEALTH_MULTIPLIER) ?? 1;
    const eliteHealthMult = isElite ? (ascEffects.get(AscensionEffectType.ELITE_HEALTH_MULTIPLIER) ?? 1) : 1;
    const bossHealthMult  = isBoss  ? (ascEffects.get(AscensionEffectType.BOSS_HEALTH_MULTIPLIER) ?? 1)  : 1;
    const finalHealthMult = baseHealthMult * eliteHealthMult * bossHealthMult;
    // Only emit the multiplier if at least one health effect is active
    if (finalHealthMult !== 1) effects.enemyHealthMultiplier = finalHealthMult;
    const speedMult = ascEffects.get(AscensionEffectType.ENEMY_SPEED_MULTIPLIER);
    const costMult = ascEffects.get(AscensionEffectType.TOWER_COST_MULTIPLIER);
    if (speedMult !== undefined) effects.enemySpeedMultiplier = speedMult;
    if (costMult !== undefined) effects.towerCostMultiplier = costMult;
    this.gameStateService.setAscensionModifierEffects(effects);
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
    // Towers can ONLY be placed via tower cards. No card = no placement.
    if (!this.selectedTowerType || !this.pendingTowerCard) return;

    if (!this.gameBoardService.canPlaceTower(row, col)) {
      // Check specifically if this was a path-blocking rejection
      if (this.towerInteractionService.wouldBlockPath(row, col)) {
        this.showPathBlockedWarning();
      }
      return;
    }

    const result = this.towerInteractionService.placeTower(row, col, this.selectedTowerType);
    if (!result.success) return;

    // Capture the pending card BEFORE consuming — consumePendingTowerCard() nulls it.
    const placedCard = this.pendingTowerCard;

    // Consume the pending tower card and exit placement mode.
    // Each card = exactly one tower.
    this.consumePendingTowerCard();
    this.cancelPlacement();

    // Create tower mesh and add to scene (visual concern — stays here)
    const towerMesh = this.towerMeshFactory.createTowerMesh(row, col, this.selectedTowerType, this.gameBoardService.getBoardWidth(), this.gameBoardService.getBoardHeight());
    this.towerMeshes.set(result.towerKey, towerMesh);
    this.sceneService.getScene().add(towerMesh);
    this.rebuildTowerChildrenArray();

    // Resolve the active card effect BEFORE registerTower so we have statOverrides available.
    const activeTowerEffect = placedCard ? getActiveTowerEffect(placedCard) : undefined;
    const cardStatOverrides = activeTowerEffect?.statOverrides;

    // Register tower with combat service (needs the mesh reference)
    this.towerCombatService.registerTower(row, col, this.selectedTowerType, towerMesh, result.cost, {
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
    const route = this.gamePauseService.confirmQuit();
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

  /**
   * Phase 4: at-a-glance spawn preview for the next few turns. Populated by
   * the combat shell during PLAYER_TURN so the player can plan ahead. Empty
   * array when not in COMBAT. User-requested feature.
   */
  get upcomingSpawns(): Array<{ turnOffset: number; spawns: { type: EnemyType; count: number }[] }> {
    if (this.gameState.phase !== GamePhase.COMBAT) return [];
    return this.waveService.getUpcomingSpawnsPreview(SPAWN_PREVIEW_TURNS);
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

  private handleKeyboard(event: KeyboardEvent): void {
    const phase = this.gameStateService.getState().phase;
    if (phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT) return;

    if (TOWER_HOTKEYS[event.key]) { event.preventDefault(); this.selectTowerType(TOWER_HOTKEYS[event.key]); return; }

    switch (event.key) {
      case ' ':
        event.preventDefault();
        // Phase 4 context-aware Space: END TURN during combat, otherwise START WAVE.
        if (phase === GamePhase.COMBAT) {
          this.endTurn();
        } else {
          this.startWave();
        }
        break;
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

    // Phase 4: Turn-based combat — the physics loop is gone. The simulation only
    // advances when the player clicks "End Turn" (see endTurn() below). animate()
    // runs cosmetic visuals continuously so health bars, status particles, and
    // minimap stay responsive between turns.
    if (deltaTime > 0) {
      const state = this.gameStateService.getState();
      if (state.phase === GamePhase.COMBAT) {
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
    // Phase 4: runPausedVisuals runs on ALL COMBAT frames now (turn-based), so
    // skip COMBAT here to avoid double-tick.
    const combatHandledByCosmetic = deltaTime > 0
      && this.gameStateService.getState().phase === GamePhase.COMBAT;
    if (deltaTime > 0 && !combatHandledByCosmetic && this.enemyService.getEnemies().size > 0) {
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
      this.combatVFXService.updateVisuals(this.sceneService.getScene());
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
        // Tick card modifier wave-countdowns.
        this.cardEffectService.tickWave();
        // Hide minimap during intermission on mobile — frees space for Next Wave button
        if (window.innerWidth <= 480) {
          this.minimapService.hide();
        }
      }
    }

    // Game end (achievements, challenges)
    if (result.gameEnd) {
      this.newlyUnlockedAchievements = result.gameEnd.newlyUnlockedAchievements;
      this.lastCompletedChallenges = result.gameEnd.completedChallenges;
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
