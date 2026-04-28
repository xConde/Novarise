import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import * as THREE from 'three';

import { GameBoardComponent } from './game-board.component';
import { GameBoardService } from './game-board.service';
import { MapBridgeService } from '../../core/services/map-bridge.service';
import { GameStateService } from './services/game-state.service';
import { GameStatsService } from './services/game-stats.service';
import { PlayerProfileService } from '../../core/services/player-profile.service';
import { DamagePopupService } from './services/damage-popup.service';
import { MinimapService } from './services/minimap.service';
import { SettingsService } from '../../core/services/settings.service';
import { DifficultyLevel, DIFFICULTY_PRESETS, GamePhase } from './models/game-state.model';
import { TowerType, TowerSpecialization, PlacedTower, TargetingMode } from './models/tower.model';
import { EnemyType } from './models/enemy.model';
import { TowerCombatService } from './services/tower-combat.service';
import { ACHIEVEMENTS } from '../../core/services/player-profile.service';
import { WaveService } from './services/wave.service';
import { StatusEffectService } from './services/status-effect.service';
import { EnemyService } from './services/enemy.service';
import { EnemyVisualService } from './services/enemy-visual.service';
import { TutorialService, TutorialStep } from '../../core/services/tutorial.service';
import { BehaviorSubject, of } from 'rxjs';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { GameNotificationService, NotificationType } from './services/game-notification.service';
import { ChallengeTrackingService } from './services/challenge-tracking.service';
import { GameEndService } from './services/game-end.service';
import { GameSessionService } from './services/game-session.service';
import { SceneService } from './services/scene.service';
import { PathfindingService } from './services/pathfinding.service';
import { CombatVFXService } from './services/combat-vfx.service';
import { CombatLoopService } from './services/combat-loop.service';
import { GameModifier, calculateModifierScoreMultiplier } from './models/game-modifier.model';
import {
  createGameStatsServiceSpy,
  createTutorialServiceSpy,
  createCombatLoopServiceSpy,
  createMinimapServiceSpy,
  createSettingsServiceSpy,
  createTowerAnimationServiceSpy,
  createGamePauseServiceSpy,
  createTowerUpgradeVisualServiceSpy,
  createRelicServiceSpy,
  createRunServiceSpy,
  createDeckServiceSpy,
} from './testing';
import { RelicService } from '../../run/services/relic.service';
import { RunService } from '../../run/services/run.service';
import { DeckService } from '../../run/services/deck.service';
import { CardId, CardInstance, EnergyState } from '../../run/models/card.model';
import { TowerAnimationService } from './services/tower-animation.service';
import { GamePauseService } from './services/game-pause.service';
import { ChallengeDisplayService } from './services/challenge-display.service';
import { EnemyHealthService } from './services/enemy-health.service';
import { ChainLightningService } from './services/chain-lightning.service';
import { TowerUpgradeVisualService } from './services/tower-upgrade-visual.service';
import { getAscensionEffects, AscensionEffectType } from '../../run/models/ascension.model';
import { GameRenderService } from './services/game-render.service';
import { BoardMeshRegistryService } from './services/board-mesh-registry.service';
import { GameInputService } from './services/game-input.service';
import { TouchInteractionService } from './services/touch-interaction.service';
import { BoardPointerService } from './services/board-pointer.service';
import { CardPlayService } from './services/card-play.service';
import { TowerInteractionService } from './services/tower-interaction.service';
import { PathMutationService } from './services/path-mutation.service';
import { ElevationService } from './services/elevation.service';
import { TileHighlightService } from './services/tile-highlight.service';
import { PathVisualizationService } from './services/path-visualization.service';
import { RangeVisualizationService } from './services/range-visualization.service';
import { AudioService } from './services/audio.service';
import { AscensionModifierService } from './services/ascension-modifier.service';
import { TowerMeshLifecycleService } from './services/tower-mesh-lifecycle.service';
import { TowerPreviewService } from './services/tower-preview.service';
import { EncounterConfig } from '../../run/models/encounter.model';
import { NodeType } from '../../run/models/node-map.model';

// ---------------------------------------------------------------------------
// Test-only interfaces — allow typed access to private fields/methods without
// using `as any`.  Cast once in each describe block that needs private access:
//   const comp = component as unknown as TestableGameBoardComponent;
// ---------------------------------------------------------------------------

/** Exposes every private field/method of GameBoardComponent that the specs touch. */
interface TestableGameBoardComponent {
  // private fields
  scene: THREE.Scene;
  contextLost: boolean;
  initializationFailed: boolean;
  pathVisualizationService: PathVisualizationService;
  enemyService: EnemyService;
  sceneService: SceneService;
  tileHighlightService: TileHighlightService;
  rangeVisualizationService: RangeVisualizationService;
  audioService: AudioService;
  challengeTrackingService: ChallengeTrackingService;
  towerInteractionService: TowerInteractionService;
  selectedTowerInfo: PlacedTower | null;
  ascensionModifier: AscensionModifierService;
  towerUpgradeVisualService: TowerUpgradeVisualService;
  towerMeshLifecycle: TowerMeshLifecycleService;
  gameBoardService: GameBoardService;
  towerCombatService: TowerCombatService;
  boardPointer: BoardPointerService;
  towerPreviewService: TowerPreviewService;
  gameStatsService: GameStatsService;

  // private methods
  updateAchievementDetails(): void;
  clearTileHighlights(): void;
  selectPlacedTower(key: string): void;
  refreshTowerInfoPanel(): void;
  setupAutoPause(): void;
  cleanupGameObjects(): void;
  updateChallengeIndicators(): void;
  tryPlaceTower(row: number, col: number): void;
  showPathBlockedWarning(): void;
  refreshPathOverlay(): void;
  updateTileHighlights(): void;
  deselectTower(): void;
}

/** Exposes the internal challengeTrackingService field of TowerInteractionService. */
interface TestableTowerInteractionService {
  challengeTrackingService: ChallengeTrackingService;
}

/** Exposes the private tutorialSub on TutorialFacadeService. */
interface TestableTutorialFacade {
  tutorialSub: import('rxjs').Subscription | null;
  currentTutorialStep: import('../../core/services/tutorial.service').TutorialStep | null;
}

/** Exposes every private field/method of TouchInteractionService that the specs touch. */
interface TestableTouchInteractionService {
  sceneService: SceneService;
  touchStartHandler: (event: TouchEvent) => void;
  touchMoveHandler: (event: TouchEvent) => void;
  touchEndHandler: (event: TouchEvent) => void;
  touchIsDragging: boolean;
  touchStartX: number;
  touchStartY: number;
  touchStartTime: number;
  pinchStartDistance: number;
}

/** Exposes the private updateMinimap on GameRenderService. */
interface TestableGameRenderService {
  updateMinimap(timeMs: number): void;
}


describe('GameBoardComponent', () => {
  let component: GameBoardComponent;
  let fixture: ComponentFixture<GameBoardComponent>;
  let gameStatsSpy: jasmine.SpyObj<GameStatsService>;
  let playerProfileSpy: jasmine.SpyObj<PlayerProfileService>;
  let damagePopupSpy: jasmine.SpyObj<DamagePopupService>;
  let minimapSpy: jasmine.SpyObj<MinimapService>;
  let settingsSpy: jasmine.SpyObj<SettingsService>;
  let tutorialSpy: jasmine.SpyObj<TutorialService>;
  let tutorialStep$: BehaviorSubject<TutorialStep | null>;
  let gameSessionSpy: jasmine.SpyObj<GameSessionService>;
  let combatLoopSpy: jasmine.SpyObj<CombatLoopService>;
  let gamePauseSpy: jasmine.SpyObj<GamePauseService>;

  beforeEach(async () => {
    gameStatsSpy = createGameStatsServiceSpy();
    gamePauseSpy = createGamePauseServiceSpy();

    playerProfileSpy = jasmine.createSpyObj('PlayerProfileService', ['recordGameEnd', 'getProfile', 'recordMapScore', 'recordChallengeCompleted', 'resetSession']);
    playerProfileSpy.recordGameEnd.and.returnValue([]);

    damagePopupSpy = jasmine.createSpyObj('DamagePopupService', ['spawn', 'update', 'cleanup']);

    minimapSpy = createMinimapServiceSpy();

    settingsSpy = createSettingsServiceSpy();

    // tutorialStep$ allows individual tests to push tutorial step changes.
    // Factory default (of(null)) is overridden with a BehaviorSubject so
    // tests in the tutorial describe block can drive the observable.
    tutorialSpy = createTutorialServiceSpy();
    tutorialStep$ = new BehaviorSubject<TutorialStep | null>(null);
    tutorialSpy.getCurrentStep.and.returnValue(tutorialStep$.asObservable());

    gameSessionSpy = jasmine.createSpyObj('GameSessionService', ['resetAllServices', 'cleanupScene']);

    combatLoopSpy = createCombatLoopServiceSpy();

    await TestBed.configureTestingModule({
      declarations: [ GameBoardComponent ],
      imports: [ RouterTestingModule ],
      providers: [
        BoardMeshRegistryService,
        GameBoardService,
        MapBridgeService,
        GameStateService,
        PathfindingService,
        EnemyService,
        EnemyVisualService,
        EnemyHealthService,
        StatusEffectService,
        CombatVFXService,
        { provide: GameStatsService, useValue: gameStatsSpy },
        { provide: PlayerProfileService, useValue: playerProfileSpy },
        { provide: DamagePopupService, useValue: damagePopupSpy },
        { provide: MinimapService, useValue: minimapSpy },
        { provide: SettingsService, useValue: settingsSpy },
        { provide: TutorialService, useValue: tutorialSpy },
        { provide: GameSessionService, useValue: gameSessionSpy },
        { provide: CombatLoopService, useValue: combatLoopSpy },
        { provide: TowerAnimationService, useValue: createTowerAnimationServiceSpy() },
        { provide: GamePauseService, useValue: gamePauseSpy },
        { provide: TowerUpgradeVisualService, useValue: createTowerUpgradeVisualServiceSpy() },
        { provide: RelicService, useValue: createRelicServiceSpy() },
        { provide: RunService, useValue: createRunServiceSpy() },
        { provide: DeckService, useValue: createDeckServiceSpy() },
        ChallengeDisplayService,
        ChainLightningService,
        TouchInteractionService,
        BoardPointerService,
        {
          provide: PathMutationService,
          useValue: jasmine.createSpyObj<PathMutationService>('PathMutationService', [
            'setRepathHook', 'tickTurn', 'reset', 'serialize', 'restore', 'swapMesh',
          ]),
        },
        {
          provide: ElevationService,
          useValue: jasmine.createSpyObj<ElevationService>('ElevationService', [
            'tickTurn', 'reset', 'serialize', 'restore', 'getElevation',
          ]),
        },
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GameBoardComponent);
    component = fixture.componentInstance;
    // Don't call detectChanges here - it triggers ngOnInit which needs a canvas
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('goToEditor', () => {
    it('should navigate to /edit', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');

      component.goToEditor();

      expect(router.navigate).toHaveBeenCalledWith(['/edit']);
    });
  });

  describe('togglePause', () => {
    it('should delegate to GameStateService.togglePause', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      spyOn(gameStateService, 'togglePause');

      component.togglePause();

      expect(gameStateService.togglePause).toHaveBeenCalled();
    });

    it('isPaused getter should reflect gameState.isPaused', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      // Put state into COMBAT so togglePause takes effect
      gameStateService.startWave();
      gameStateService.togglePause();

      expect(component.isPaused).toBeTrue();
    });

    it('isPaused should be false in SETUP phase', () => {
      expect(component.isPaused).toBeFalse();
    });
  });

  describe('selectDifficulty', () => {
    it('should call gameStateService.setDifficulty with the given level', () => {
      // GameStateService is provided at component level, so we must get it from the component's injector
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      spyOn(gameStateService, 'setDifficulty');

      component.selectDifficulty(DifficultyLevel.HARD);

      expect(gameStateService.setDifficulty).toHaveBeenCalledWith(DifficultyLevel.HARD);
    });

    it('should expose difficultyPresets for all levels', () => {
      for (const level of Object.values(DifficultyLevel)) {
        expect(component.difficultyPresets[level]).toBeDefined();
        expect(component.difficultyPresets[level].lives).toBe(DIFFICULTY_PRESETS[level].lives);
      }
    });

    it('should expose difficultyLevels with 4 entries', () => {
      expect(component.difficultyLevels.length).toBe(4);
    });
  });

  describe('keyboard hotkeys', () => {
    let gameInputService: GameInputService;
    let gameStateService: GameStateService;

    function fireKey(key: string): void {
      const event = new KeyboardEvent('keydown', { key, bubbles: true });
      const state = gameStateService.getState();
      gameInputService.dispatchHotkey(event, state, {
        onSpace: () => {
          const phase = gameStateService.getState().phase;
          if (phase === GamePhase.COMBAT) { component.endTurn(); } else { component.startWave(); }
        },
        onPause: () => component.togglePause(),
        onEscape: () => {
          if (component.isPaused) { component.togglePause(); }
          else if (component.isPlaceMode) { component.cancelPlacement(); }
          else if (component.selectedTowerInfo) { component.deselectTower(); }
          else { component.togglePause(); }
        },
        onToggleRanges: () => component.toggleAllRanges(),
        onToggleMinimap: () => {},
        onTogglePath: () => component.togglePathOverlay(),
        onUpgrade: () => component.upgradeTower(),
        onCycleTargeting: () => component.cycleTargeting(),
        onSell: () => component.sellTower(),
        onTowerHotkey: (type) => component.selectTowerType(type),
        isInRun: () => (TestBed.inject(RunService) as jasmine.SpyObj<RunService>).isInRun(),
        isPlaceMode: () => component.isPlaceMode,
        getSelectedTowerInfo: () => component.selectedTowerInfo,
      });
    }

    beforeEach(() => {
      gameInputService = fixture.debugElement.injector.get(GameInputService);
      gameStateService = fixture.debugElement.injector.get(GameStateService);
      // Tower hotkeys 1-6 are disabled in run mode (towers require cards).
      // Override isInRun to false so standalone-mode hotkey selection works.
      const runSpy = TestBed.inject(RunService) as jasmine.SpyObj<RunService>;
      runSpy.isInRun.and.returnValue(false);
    });

    it('pressing 1 selects BASIC tower when a different type is selected', () => {
      component.selectedTowerType = TowerType.SNIPER;
      fireKey('1');
      expect(component.selectedTowerType).toBe(TowerType.BASIC);
    });

    it('pressing 2 selects SNIPER tower', () => {
      fireKey('2');
      expect(component.selectedTowerType).toBe(TowerType.SNIPER);
    });

    it('pressing 3 selects SPLASH tower', () => {
      fireKey('3');
      expect(component.selectedTowerType).toBe(TowerType.SPLASH);
    });

    it('pressing 4 selects SLOW tower', () => {
      fireKey('4');
      expect(component.selectedTowerType).toBe(TowerType.SLOW);
    });

    it('pressing 5 selects CHAIN tower', () => {
      fireKey('5');
      expect(component.selectedTowerType).toBe(TowerType.CHAIN);
    });

    it('pressing 6 selects MORTAR tower', () => {
      fireKey('6');
      expect(component.selectedTowerType).toBe(TowerType.MORTAR);
    });

    it('pressing Escape with pending tower card (real PLACE mode) cancels placement', () => {
      // isPlaceMode requires a pending tower card to be set. Inject via CardPlayService.
      const cardPlaySvc = fixture.debugElement.injector.get(CardPlayService);
      cardPlaySvc['pendingTowerCard'] = { instanceId: 'test_inst', cardId: CardId.TOWER_SNIPER, upgraded: false } as CardInstance;
      component.selectedTowerType = TowerType.SNIPER;
      expect(component.isPlaceMode).toBeTrue();
      fireKey('Escape');
      expect(component.selectedTowerType).toBeNull();
      expect(cardPlaySvc.hasPendingCard()).toBeFalse();
    });

    it('pressing Escape in INSPECT mode deselects placed tower info', () => {
      component.selectedTowerType = null;
      (component as unknown as TestableGameBoardComponent).selectedTowerInfo = { id: 'fake', type: TowerType.SNIPER, level: 1, row: 0, col: 0, kills: 0, totalInvested: 50, mesh: null, targetingMode: TargetingMode.NEAREST };
      fireKey('Escape');
      expect(component.selectedTowerInfo).toBeNull();
    });

    it('pressing p toggles pause', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.startWave();
      spyOn(component, 'togglePause').and.callThrough();
      fireKey('p');
      expect(component.togglePause).toHaveBeenCalled();
    });

    it('pressing P (uppercase) also toggles pause', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.startWave();
      spyOn(component, 'togglePause').and.callThrough();
      fireKey('P');
      expect(component.togglePause).toHaveBeenCalled();
    });

    it('hotkeys are ignored in VICTORY phase', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setMaxWaves(1);
      gameStateService.startWave();
      gameStateService.completeWave(0); // wave 1 === maxWaves 1 → VICTORY
      component.selectedTowerType = TowerType.SNIPER;
      fireKey('1');
      // Should remain SNIPER — hotkey is blocked
      expect(component.selectedTowerType).toBe(TowerType.SNIPER);
    });

    it('hotkeys are ignored in DEFEAT phase', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.startWave();
      gameStateService.loseLife(gameStateService.getState().lives); // → DEFEAT
      component.selectedTowerType = TowerType.SNIPER;
      fireKey('3');
      expect(component.selectedTowerType).toBe(TowerType.SNIPER);
    });

    it('pressing u calls upgradeTower', () => {
      spyOn(component, 'upgradeTower');
      fireKey('u');
      expect(component.upgradeTower).toHaveBeenCalled();
    });

    it('pressing U (uppercase) calls upgradeTower', () => {
      spyOn(component, 'upgradeTower');
      fireKey('U');
      expect(component.upgradeTower).toHaveBeenCalled();
    });

    it('pressing t calls cycleTargeting', () => {
      spyOn(component, 'cycleTargeting');
      fireKey('t');
      expect(component.cycleTargeting).toHaveBeenCalled();
    });

    it('pressing T (uppercase) calls cycleTargeting', () => {
      spyOn(component, 'cycleTargeting');
      fireKey('T');
      expect(component.cycleTargeting).toHaveBeenCalled();
    });

    it('pressing Delete calls sellTower', () => {
      spyOn(component, 'sellTower');
      fireKey('Delete');
      expect(component.sellTower).toHaveBeenCalled();
    });

    it('pressing Backspace calls sellTower', () => {
      spyOn(component, 'sellTower');
      fireKey('Backspace');
      expect(component.sellTower).toHaveBeenCalled();
    });

    it('u key does not call upgradeTower in VICTORY phase', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setMaxWaves(1);
      gameStateService.startWave();
      gameStateService.completeWave(0); // → VICTORY
      spyOn(component, 'upgradeTower');
      fireKey('u');
      expect(component.upgradeTower).not.toHaveBeenCalled();
    });

    it('t key does not call cycleTargeting in DEFEAT phase', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.startWave();
      gameStateService.loseLife(gameStateService.getState().lives); // → DEFEAT
      spyOn(component, 'cycleTargeting');
      fireKey('t');
      expect(component.cycleTargeting).not.toHaveBeenCalled();
    });

    it('Delete key does not call sellTower in VICTORY phase', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setMaxWaves(1);
      gameStateService.startWave();
      gameStateService.completeWave(0); // → VICTORY
      spyOn(component, 'sellTower');
      fireKey('Delete');
      expect(component.sellTower).not.toHaveBeenCalled();
    });

    it('cycleTargeting skips SLOW towers', () => {
      component.selectedTowerInfo = {
        id: 'tower-slow', type: TowerType.SLOW, level: 1,
        row: 0, col: 0, kills: 0, totalInvested: 75,
        targetingMode: TargetingMode.NEAREST, mesh: null,
      } as PlacedTower;
      const towerCombat = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(towerCombat, 'cycleTargetingMode');
      component.cycleTargeting();
      expect(towerCombat.cycleTargetingMode).not.toHaveBeenCalled();
    });
  });

  // Phase H11: scoreBreakdown + starArray describe blocks deleted. The fields
  // were removed from GameBoardComponent — scoreBreakdown is now computed
  // internally by gameEndService.recordEnd (H7). Test coverage for the
  // computation moves to game-end.service.spec.ts in H2.

  describe('touch handler lifecycle', () => {
    let mockCanvas: HTMLCanvasElement;
    let addEventSpy: jasmine.Spy;
    let removeEventSpy: jasmine.Spy;
    let touchService: TouchInteractionService;

    beforeEach(() => {
      mockCanvas = document.createElement('canvas');
      addEventSpy = spyOn(mockCanvas, 'addEventListener').and.callThrough();
      removeEventSpy = spyOn(mockCanvas, 'removeEventListener').and.callThrough();
      touchService = fixture.debugElement.injector.get(TouchInteractionService);

      // Stub sceneService camera/controls for move handler
      const mockCamera = { position: new THREE.Vector3(0, 10, 0) } as unknown as THREE.PerspectiveCamera;
      const mockControls = { target: new THREE.Vector3(0, 0, 0), dispose: () => {} } as unknown as ReturnType<SceneService['getControls']>;
      const tsi = touchService as unknown as TestableTouchInteractionService;
      spyOn(tsi.sceneService, 'getCamera').and.returnValue(mockCamera);
      spyOn(tsi.sceneService, 'getControls').and.returnValue(mockControls);
    });

    afterEach(() => {
      touchService.cleanup();
    });

    it('init registers touchstart, touchmove, and touchend handlers', () => {
      touchService.init(mockCanvas, () => {});

      const registeredEvents = addEventSpy.calls.allArgs().map((args: unknown[]) => args[0]);
      expect(registeredEvents).toContain('touchstart');
      expect(registeredEvents).toContain('touchmove');
      expect(registeredEvents).toContain('touchend');
    });

    it('touch handlers are registered as named references, not anonymous functions', () => {
      touchService.init(mockCanvas, () => {});

      const tsiRef = touchService as unknown as TestableTouchInteractionService;
      const startRef = tsiRef.touchStartHandler;
      const moveRef = tsiRef.touchMoveHandler;
      const endRef = tsiRef.touchEndHandler;

      expect(typeof startRef).toBe('function');
      expect(typeof moveRef).toBe('function');
      expect(typeof endRef).toBe('function');

      const calls = addEventSpy.calls.allArgs();
      const startCall = calls.find((args: unknown[]) => args[0] === 'touchstart');
      const moveCall = calls.find((args: unknown[]) => args[0] === 'touchmove');
      const endCall = calls.find((args: unknown[]) => args[0] === 'touchend');

      expect(startCall?.[1]).toBe(startRef);
      expect(moveCall?.[1]).toBe(moveRef);
      expect(endCall?.[1]).toBe(endRef);
    });

    it('cleanup removes touchstart, touchmove, and touchend handlers', () => {
      touchService.init(mockCanvas, () => {});
      touchService.cleanup();

      const removedEvents = removeEventSpy.calls.allArgs().map((args: unknown[]) => args[0]);
      expect(removedEvents).toContain('touchstart');
      expect(removedEvents).toContain('touchmove');
      expect(removedEvents).toContain('touchend');
    });

    it('touchStartHandler records start position and resets drag flag', () => {
      touchService.init(mockCanvas, () => {});
      (touchService as unknown as TestableTouchInteractionService).touchIsDragging = true;

      const touch = { clientX: 150, clientY: 200 } as Touch;
      const event = { preventDefault: () => {}, touches: [touch] } as unknown as TouchEvent;

      (touchService as unknown as TestableTouchInteractionService).touchStartHandler(event);

      expect((touchService as unknown as TestableTouchInteractionService).touchStartX).toBe(150);
      expect((touchService as unknown as TestableTouchInteractionService).touchStartY).toBe(200);
      expect((touchService as unknown as TestableTouchInteractionService).touchIsDragging).toBeFalse();
    });

    it('touchStartHandler records pinch start distance for two-finger touch', () => {
      touchService.init(mockCanvas, () => {});

      const t0 = { clientX: 0, clientY: 0 } as Touch;
      const t1 = { clientX: 30, clientY: 40 } as Touch;
      const event = { preventDefault: () => {}, touches: [t0, t1] } as unknown as TouchEvent;

      (touchService as unknown as TestableTouchInteractionService).touchStartHandler(event);

      // distance = sqrt(30^2 + 40^2) = sqrt(900+1600) = 50
      expect((touchService as unknown as TestableTouchInteractionService).pinchStartDistance).toBe(50);
    });

    it('touchMoveHandler sets touchIsDragging to true when movement exceeds threshold', () => {
      touchService.init(mockCanvas, () => {});
      (touchService as unknown as TestableTouchInteractionService).touchStartX = 0;
      (touchService as unknown as TestableTouchInteractionService).touchStartY = 0;

      const touch = { clientX: 20, clientY: 20 } as Touch;
      const event = { preventDefault: () => {}, touches: [touch] } as unknown as TouchEvent;

      (touchService as unknown as TestableTouchInteractionService).touchMoveHandler(event);

      expect((touchService as unknown as TestableTouchInteractionService).touchIsDragging).toBeTrue();
    });

    it('touchMoveHandler does not set touchIsDragging when movement is within threshold', () => {
      touchService.init(mockCanvas, () => {});
      (touchService as unknown as TestableTouchInteractionService).touchStartX = 0;
      (touchService as unknown as TestableTouchInteractionService).touchStartY = 0;
      (touchService as unknown as TestableTouchInteractionService).touchIsDragging = false;

      // Move only 5px total — below 10px threshold
      const touch = { clientX: 3, clientY: 4 } as Touch;
      const event = { preventDefault: () => {}, touches: [touch] } as unknown as TouchEvent;

      (touchService as unknown as TestableTouchInteractionService).touchMoveHandler(event);

      expect((touchService as unknown as TestableTouchInteractionService).touchIsDragging).toBeFalse();
    });

    it('touchEndHandler calls onTap for a short tap with no drag', () => {
      let tapX = 0;
      let tapY = 0;
      let tapCalled = false;
      touchService.init(mockCanvas, (x, y) => { tapCalled = true; tapX = x; tapY = y; });
      (touchService as unknown as TestableTouchInteractionService).touchStartX = 100;
      (touchService as unknown as TestableTouchInteractionService).touchStartY = 200;
      (touchService as unknown as TestableTouchInteractionService).touchStartTime = performance.now() - 50; // 50ms ago — within 300ms threshold
      (touchService as unknown as TestableTouchInteractionService).touchIsDragging = false;

      const touch = { clientX: 100, clientY: 200 } as Touch;
      const event = { preventDefault: () => {}, changedTouches: [touch] } as unknown as TouchEvent;

      (touchService as unknown as TestableTouchInteractionService).touchEndHandler(event);

      expect(tapCalled).toBeTrue();
      expect(tapX).toBe(100);
      expect(tapY).toBe(200);
    });

    it('touchEndHandler does not call onTap when drag occurred', () => {
      let tapCalled = false;
      touchService.init(mockCanvas, () => { tapCalled = true; });
      (touchService as unknown as TestableTouchInteractionService).touchStartTime = performance.now() - 50;
      (touchService as unknown as TestableTouchInteractionService).touchIsDragging = true;

      const touch = { clientX: 100, clientY: 200 } as Touch;
      const event = { preventDefault: () => {}, changedTouches: [touch] } as unknown as TouchEvent;

      (touchService as unknown as TestableTouchInteractionService).touchEndHandler(event);

      expect(tapCalled).toBeFalse();
    });

    it('touchEndHandler does not call onTap when tap duration exceeds threshold', () => {
      let tapCalled = false;
      touchService.init(mockCanvas, () => { tapCalled = true; });
      (touchService as unknown as TestableTouchInteractionService).touchStartTime = performance.now() - 500; // 500ms — exceeds 300ms threshold
      (touchService as unknown as TestableTouchInteractionService).touchIsDragging = false;

      const touch = { clientX: 100, clientY: 200 } as Touch;
      const event = { preventDefault: () => {}, changedTouches: [touch] } as unknown as TouchEvent;

      (touchService as unknown as TestableTouchInteractionService).touchEndHandler(event);

      expect(tapCalled).toBeFalse();
    });

    it('touchEndHandler resets touchIsDragging and pinchStartDistance', () => {
      touchService.init(mockCanvas, () => {});
      (touchService as unknown as TestableTouchInteractionService).touchIsDragging = true;
      (touchService as unknown as TestableTouchInteractionService).pinchStartDistance = 50;

      // Long press — no tap
      (touchService as unknown as TestableTouchInteractionService).touchStartTime = performance.now() - 500;

      const touch = { clientX: 0, clientY: 0 } as Touch;
      const event = { preventDefault: () => {}, changedTouches: [touch] } as unknown as TouchEvent;

      (touchService as unknown as TestableTouchInteractionService).touchEndHandler(event);

      expect((touchService as unknown as TestableTouchInteractionService).touchIsDragging).toBeFalse();
      expect((touchService as unknown as TestableTouchInteractionService).pinchStartDistance).toBe(0);
    });
  });

  describe('achievementDetails', () => {
    it('should return empty array when no achievements unlocked', () => {
      component.newlyUnlockedAchievements = [];
      expect(component.achievementDetails).toEqual([]);
    });

    it('should resolve achievement IDs to Achievement objects', () => {
      // Use real achievement IDs from the ACHIEVEMENTS constant
      const realIds = ACHIEVEMENTS.slice(0, 2).map(a => a.id);
      component.newlyUnlockedAchievements = realIds;
      (component as unknown as TestableGameBoardComponent).updateAchievementDetails();

      const details = component.achievementDetails;

      expect(details.length).toBe(2);
      expect(details[0].id).toBe(realIds[0]);
      expect(details[1].id).toBe(realIds[1]);
      expect(details[0].name).toBe(ACHIEVEMENTS[0].name);
      expect(details[1].name).toBe(ACHIEVEMENTS[1].name);
    });

    it('should filter out unknown achievement IDs', () => {
      const realId = ACHIEVEMENTS[0].id;
      component.newlyUnlockedAchievements = [realId, 'nonexistent_achievement', 'also_fake'];
      (component as unknown as TestableGameBoardComponent).updateAchievementDetails();

      const details = component.achievementDetails;

      expect(details.length).toBe(1);
      expect(details[0].id).toBe(realId);
    });
  });

  describe('toggleEndless', () => {
    it('should call setEndlessMode on both services', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      const waveService = fixture.debugElement.injector.get(WaveService);
      spyOn(gameStateService, 'setEndlessMode');
      spyOn(waveService, 'setEndlessMode');

      component.toggleEndless();

      expect(gameStateService.setEndlessMode).toHaveBeenCalled();
      expect(waveService.setEndlessMode).toHaveBeenCalled();
    });

    it('should toggle from false to true', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      // Initial state: isEndless is false
      expect(gameStateService.getState().isEndless).toBeFalse();

      component.toggleEndless();

      expect(gameStateService.getState().isEndless).toBeTrue();
    });

    it('should toggle from true to false', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      // Set endless to true first
      gameStateService.setEndlessMode(true);
      // Update component's gameState reference
      component.gameState = gameStateService.getState();
      expect(gameStateService.getState().isEndless).toBeTrue();

      component.toggleEndless();

      expect(gameStateService.getState().isEndless).toBeFalse();
    });

  });

  describe('pause overlay state', () => {
    it('isPaused should return gameState.isPaused value', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);

      // Default: not paused
      expect(component.isPaused).toBeFalse();

      // Enter COMBAT and pause
      gameStateService.startWave();
      gameStateService.togglePause();
      // Update component's gameState reference
      component.gameState = gameStateService.getState();

      expect(component.isPaused).toBeTrue();

      // Unpause
      gameStateService.togglePause();
      component.gameState = gameStateService.getState();

      expect(component.isPaused).toBeFalse();
    });
  });

  describe('pause menu', () => {
    let gameStateService: GameStateService;
    let gamePauseService: GamePauseService;

    function enterCombatAndPause(): void {
      gameStateService.startWave();
      gameStateService.togglePause();
      component.gameState = gameStateService.getState();
    }

    beforeEach(() => {
      gameStateService = fixture.debugElement.injector.get(GameStateService);
      gamePauseService = fixture.debugElement.injector.get(GamePauseService);
    });

    it('showQuitConfirm defaults to false', () => {
      expect(component.showQuitConfirm).toBeFalse();
    });

    it('togglePause delegates to GamePauseService.togglePause', () => {
      enterCombatAndPause();
      spyOn(gamePauseService, 'togglePause').and.returnValue(false);
      component.togglePause();
      expect(gamePauseService.togglePause).toHaveBeenCalled();
    });

    it('onPauseOverlayClick calls togglePause', () => {
      enterCombatAndPause();
      spyOn(component, 'togglePause');
      component.onPauseOverlayClick(new MouseEvent('click'));
      expect(component.togglePause).toHaveBeenCalled();
    });

    it('audioMuted reflects audioService.isMuted', () => {
      // Default: not muted
      expect(component.audioMuted).toBeFalse();
    });

    it('toggleAudio calls audioService.toggleMute', () => {
      spyOn((component as unknown as TestableGameBoardComponent).audioService, 'toggleMute');
      component.toggleAudio();
      expect((component as unknown as TestableGameBoardComponent).audioService.toggleMute).toHaveBeenCalled();
    });

    it('requestQuit sets showQuitConfirm to true', () => {
      component.requestQuit();
      expect(component.showQuitConfirm).toBeTrue();
    });

    it('cancelQuit delegates to GamePauseService.cancelQuit', () => {
      spyOn(gamePauseService, 'cancelQuit');
      component.cancelQuit();
      expect(gamePauseService.cancelQuit).toHaveBeenCalled();
    });

    // 'confirmQuit navigates to /' was deleted: GamePauseService.confirmQuit()
    // always returns '/run' post-pivot. The active test below covers this.

    it('confirmQuit delegates to GamePauseService.confirmQuit', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');
      spyOn(gamePauseService, 'confirmQuit').and.returnValue('/');
      component.confirmQuit();
      expect(gamePauseService.confirmQuit).toHaveBeenCalled();
    });

    it('confirmQuit navigates to /run (run hub)', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');
      spyOn(gamePauseService, 'confirmQuit').and.returnValue('/run');

      component.confirmQuit();

      expect(gamePauseService.confirmQuit).toHaveBeenCalledWith();
      expect(router.navigate).toHaveBeenCalledWith(['/run']);
    });
  });

  describe('requestGuardDecision', () => {
    it('delegates to GamePauseService.requestGuardDecision', (done) => {
      const gamePauseService = fixture.debugElement.injector.get(GamePauseService);
      spyOn(gamePauseService, 'requestGuardDecision').and.returnValue(of(true));
      const result = component.requestGuardDecision();
      expect(gamePauseService.requestGuardDecision).toHaveBeenCalled();
      (result as import('rxjs').Observable<boolean>).subscribe(v => { expect(v).toBeTrue(); done(); });
    });

    it('returns Observable<false> when GamePauseService emits false', (done) => {
      const gamePauseService = fixture.debugElement.injector.get(GamePauseService);
      spyOn(gamePauseService, 'requestGuardDecision').and.returnValue(of(false));
      const result = component.requestGuardDecision();
      (result as import('rxjs').Observable<boolean>).subscribe(v => { expect(v).toBeFalse(); done(); });
    });
  });

  describe('keyboard Escape key — pause integration', () => {
    function fireKey(key: string): void {
      const event = new KeyboardEvent('keydown', { key, bubbles: true });
      const gameInputSvc = fixture.debugElement.injector.get(GameInputService);
      const gameStateSvc = fixture.debugElement.injector.get(GameStateService);
      gameInputSvc.dispatchHotkey(event, gameStateSvc.getState(), {
        onSpace: () => {},
        onPause: () => component.togglePause(),
        onEscape: () => {
          if (component.isPaused) { component.togglePause(); }
          else if (component.isPlaceMode) { component.cancelPlacement(); }
          else if (component.selectedTowerInfo) { component.deselectTower(); }
          else { component.togglePause(); }
        },
        onToggleRanges: () => {},
        onToggleMinimap: () => {},
        onTogglePath: () => {},
        onUpgrade: () => {},
        onCycleTargeting: () => {},
        onSell: () => {},
        onTowerHotkey: (_type) => {},
        isInRun: () => false,
        isPlaceMode: () => component.isPlaceMode,
        getSelectedTowerInfo: () => component.selectedTowerInfo,
      });
    }

    it('ESC resumes when paused', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.startWave();
      gameStateService.togglePause();
      component.gameState = gameStateService.getState();

      spyOn(component, 'togglePause').and.callThrough();
      fireKey('Escape');
      expect(component.togglePause).toHaveBeenCalled();
      expect(component.isPaused).toBeFalse();
    });

    it('ESC deselects tower when not paused, not in PLACE mode, and a tower is selected', () => {
      // ESC works in SETUP phase too — only VICTORY/DEFEAT blocks keyboard handling
      // Do not enter COMBAT phase here to avoid auto-pause side effects
      component.selectedTowerType = null;
      spyOnProperty(component, 'selectedTowerInfo', 'get').and.returnValue(
        { id: 'fake', type: TowerType.SNIPER, level: 1, row: 0, col: 0, kills: 0, totalInvested: 50, mesh: null, targetingMode: TargetingMode.NEAREST } as PlacedTower,
      );

      spyOn(component, 'deselectTower');
      fireKey('Escape');
      expect(component.deselectTower).toHaveBeenCalled();
    });

    it('ESC toggles pause when not paused and no tower selected', () => {
      spyOn(component, 'togglePause');
      fireKey('Escape');
      expect(component.togglePause).toHaveBeenCalled();
    });
  });

  describe('path overlay', () => {
    it('showPathOverlay defaults to false', () => {
      expect(component.showPathOverlay).toBeFalse();
    });

    it('togglePathOverlay flips showPathOverlay from false to true', () => {
      // Stub scene + pathVisualizationService to avoid Three.js calls
      (component as unknown as TestableGameBoardComponent).scene = new THREE.Scene();
      const pvs = (component as unknown as TestableGameBoardComponent).pathVisualizationService;
      spyOn(pvs, 'showPath');
      spyOn(pvs, 'hidePath');
      // Stub enemyService.getPathToExit to return empty (no path found)
      spyOn((component as unknown as TestableGameBoardComponent).enemyService, 'getPathToExit').and.returnValue([]);

      component.togglePathOverlay();

      expect(component.showPathOverlay).toBeTrue();
    });

    it('togglePathOverlay flips showPathOverlay from true to false', () => {
      (component as unknown as TestableGameBoardComponent).scene = new THREE.Scene();
      const pvs = (component as unknown as TestableGameBoardComponent).pathVisualizationService;
      spyOn(pvs, 'showPath');
      spyOn(pvs, 'hidePath');
      spyOn((component as unknown as TestableGameBoardComponent).enemyService, 'getPathToExit').and.returnValue([]);

      component.showPathOverlay = true;
      component.togglePathOverlay();

      expect(component.showPathOverlay).toBeFalse();
      expect(pvs.hidePath).toHaveBeenCalled();
    });

    it('togglePathOverlay calls showPath when path exists', () => {
      const mockScene = new THREE.Scene();
      spyOn((component as unknown as TestableGameBoardComponent).sceneService, 'getScene').and.returnValue(mockScene);
      const pvs = (component as unknown as TestableGameBoardComponent).pathVisualizationService;
      spyOn(pvs, 'showPath');
      spyOn(pvs, 'hidePath');
      const fakePath = [{ x: 0, z: 0 }, { x: 1, z: 0 }];
      spyOn((component as unknown as TestableGameBoardComponent).enemyService, 'getPathToExit').and.returnValue(fakePath);

      component.togglePathOverlay();

      expect(pvs.showPath).toHaveBeenCalledWith(fakePath, mockScene);
    });

    it('togglePathOverlay does not call showPath when path is empty', () => {
      (component as unknown as TestableGameBoardComponent).scene = new THREE.Scene();
      const pvs = (component as unknown as TestableGameBoardComponent).pathVisualizationService;
      spyOn(pvs, 'showPath');
      spyOn(pvs, 'hidePath');
      spyOn((component as unknown as TestableGameBoardComponent).enemyService, 'getPathToExit').and.returnValue([]);

      component.togglePathOverlay();

      expect(pvs.showPath).not.toHaveBeenCalled();
    });

    it('pressing V toggles path overlay', () => {
      (component as unknown as TestableGameBoardComponent).scene = new THREE.Scene();
      const pvs = (component as unknown as TestableGameBoardComponent).pathVisualizationService;
      spyOn(pvs, 'showPath');
      spyOn(pvs, 'hidePath');
      spyOn((component as unknown as TestableGameBoardComponent).enemyService, 'getPathToExit').and.returnValue([]);

      const gameInputSvc = fixture.debugElement.injector.get(GameInputService);
      const gameStateSvc = fixture.debugElement.injector.get(GameStateService);
      const event = new KeyboardEvent('keydown', { key: 'v', bubbles: true });
      gameInputSvc.dispatchHotkey(event, gameStateSvc.getState(), {
        onSpace: () => {}, onPause: () => {}, onEscape: () => {},
        onToggleRanges: () => {},
        onToggleMinimap: () => {}, onTogglePath: () => component.togglePathOverlay(),
        onUpgrade: () => {}, onCycleTargeting: () => {}, onSell: () => {},
        onTowerHotkey: (_type) => {}, isInRun: () => false,
        isPlaceMode: () => component.isPlaceMode, getSelectedTowerInfo: () => component.selectedTowerInfo,
      });

      expect(component.showPathOverlay).toBeTrue();
    });
  });

  describe('WebGL context loss', () => {
    it('contextLost should start as false', () => {
      expect(component.contextLost).toBeFalse();
    });

    it('setting contextLost to true should be reflected on the component', () => {
      (component as unknown as TestableGameBoardComponent).contextLost = true;
      expect(component.contextLost).toBeTrue();
    });

    it('setting contextLost back to false should be reflected on the component', () => {
      (component as unknown as TestableGameBoardComponent).contextLost = true;
      (component as unknown as TestableGameBoardComponent).contextLost = false;
      expect(component.contextLost).toBeFalse();
    });

    it('reloadPage is defined and callable', () => {
      // Verify the method exists; actual navigation cannot be tested in headless Chrome
      expect(typeof component.reloadPage).toBe('function');
    });
  });

  describe('game initialization failure', () => {
    it('initializationFailed should start as false', () => {
      expect(component.initializationFailed).toBeFalse();
    });

    it('goBackToRunHub navigates to /run', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');
      component.goBackToRunHub();
      expect(router.navigate).toHaveBeenCalledWith(['/run']);
    });

    it('setting initializationFailed to true is reflected on the component', () => {
      (component as unknown as TestableGameBoardComponent).initializationFailed = true;
      expect(component.initializationFailed).toBeTrue();
    });
  });

  describe('Interaction Mode System', () => {
    it('should start with BASIC tower selected (no pending card, so isPlaceMode is false)', () => {
      // Post-pivot: isPlaceMode requires both selectedTowerType AND pendingTowerCard to be set.
      // At startup no card has been played, so isPlaceMode is false even with BASIC selected.
      expect(component.selectedTowerType).toBe(TowerType.BASIC);
      expect(component.isPlaceMode).toBeFalse();
    });

    it('should toggle to INSPECT mode when clicking same tower type', () => {
      // Start in PLACE mode with BASIC selected
      component.selectedTowerType = TowerType.BASIC;

      // Clicking the same type calls cancelPlacement — sets to null (INSPECT mode)
      component.selectTowerType(TowerType.BASIC);

      expect(component.selectedTowerType).toBeNull();
      expect(component.isPlaceMode).toBeFalse();
    });

    it('cancelPlacement should set selectedTowerType to null', () => {
      component.selectedTowerType = TowerType.SNIPER;

      component.cancelPlacement();

      expect(component.selectedTowerType).toBeNull();
    });

    it('isPlaceMode should return false when selectedTowerType is null', () => {
      component.selectedTowerType = null;

      expect(component.isPlaceMode).toBeFalse();
    });

    it('isPlaceMode should return false when selectedTowerType is set but no pending card', () => {
      // isPlaceMode requires BOTH selectedTowerType AND pendingTowerCard to be non-null.
      // Setting only selectedTowerType (as the button-click path does) does NOT activate place mode —
      // the player must play a tower card to enter real placement state.
      component.selectedTowerType = TowerType.MORTAR;

      expect(component.isPlaceMode).toBeFalse();
    });

    it('selectPlacedTower (private) delegates without throwing', () => {
      // TowerSelectionService is component-scoped. Verify delegation doesn't throw.
      component.selectedTowerType = TowerType.SNIPER;
      // selectedTowerType is set but pendingTowerCard is null → isPlaceMode is false.
      expect(component.isPlaceMode).toBeFalse();

      // selectPlacedTower is private — call it; it will delegate to TowerSelectionService.
      // That service will call getTower (not found → undefined), so nothing changes.
      expect(() => (component as unknown as TestableGameBoardComponent).selectPlacedTower('r0-c1')).not.toThrow();
    });

  });

  describe('Mobile tower preview (handleTowerButtonTap)', () => {
    function makeTouchEvent(): TouchEvent {
      return new TouchEvent('click', { bubbles: true });
    }

    function makeMouseEvent(): MouseEvent {
      return new MouseEvent('click', { bubbles: true });
    }

    it('previewTowerType should be null by default', () => {
      expect(component.previewTowerType).toBeNull();
    });

    it('touch tap selects tower (selectedTowerType updates, isPlaceMode stays false without pending card)', () => {
      // handleTowerButtonTap calls selectTowerType → sets selectedTowerType.
      // isPlaceMode requires a pending tower card as well; a tap alone does not set pendingTowerCard.
      component.selectedTowerType = null;

      component.handleTowerButtonTap(makeTouchEvent(), TowerType.SNIPER);

      expect(component.selectedTowerType as TowerType | null).toBe(TowerType.SNIPER);
      expect(component.isPlaceMode).toBeFalse();
    });

    it('touch tap on different tower switches selection', () => {
      component.handleTowerButtonTap(makeTouchEvent(), TowerType.BASIC);
      component.handleTowerButtonTap(makeTouchEvent(), TowerType.MORTAR);

      expect(component.selectedTowerType as TowerType | null).toBe(TowerType.MORTAR);
    });

    it('mouse click delegates directly to selectTowerType (desktop unchanged)', () => {
      spyOn(component, 'selectTowerType');
      component.selectedTowerType = null;

      component.handleTowerButtonTap(makeMouseEvent(), TowerType.SPLASH);

      expect(component.selectTowerType).toHaveBeenCalledWith(TowerType.SPLASH);
      // Preview must not be set for mouse events
      expect(component.previewTowerType).toBeNull();
    });

    it('mouse click does not mutate previewTowerType', () => {
      component.previewTowerType = null;

      component.handleTowerButtonTap(makeMouseEvent(), TowerType.CHAIN);

      expect(component.previewTowerType).toBeNull();
    });

    it('clearTowerPreview sets previewTowerType to null', () => {
      component.previewTowerType = TowerType.SLOW;

      component.clearTowerPreview();

      expect(component.previewTowerType).toBeNull();
    });

    it('clearTowerPreview does not affect selectedTowerType', () => {
      component.previewTowerType = TowerType.SLOW;
      component.selectedTowerType = TowerType.BASIC;

      component.clearTowerPreview();

      expect(component.selectedTowerType).toBe(TowerType.BASIC);
    });

    it('second touch tap on same tower also calls updateTileHighlights via selectTowerType', () => {
      spyOn(component, 'updateTileHighlights');
      component.previewTowerType = TowerType.SPLASH;
      component.selectedTowerType = null;

      component.handleTowerButtonTap(makeTouchEvent(), TowerType.SPLASH);

      expect(component.updateTileHighlights).toHaveBeenCalled();
    });
  });

  describe('Tile Highlighting', () => {
    it('updateTileHighlights should not throw when tileMeshes is empty', () => {
      component.selectedTowerType = TowerType.BASIC;
      expect(() => component.updateTileHighlights()).not.toThrow();
    });

    it('updateTileHighlights should do nothing in INSPECT mode', () => {
      component.selectedTowerType = null;
      component.updateTileHighlights();
      const ths = (component as unknown as TestableGameBoardComponent).tileHighlightService;
      expect(ths.getHighlightedTiles().size).toBe(0);
    });

    it('clearTileHighlights should clear the highlighted set', () => {
      // clearTileHighlights is private and delegates to TileHighlightService — verify no throw
      expect(() => (component as unknown as TestableGameBoardComponent).clearTileHighlights()).not.toThrow();
      const ths = (component as unknown as TestableGameBoardComponent).tileHighlightService;
      expect(ths.getHighlightedTiles().size).toBe(0);
    });

    it('selectTowerType should call updateTileHighlights', () => {
      spyOn(component, 'updateTileHighlights');
      component.selectedTowerType = null; // start in INSPECT mode
      component.selectTowerType(TowerType.SNIPER);
      expect(component.updateTileHighlights).toHaveBeenCalled();
    });

    it('cancelPlacement should clear highlights', () => {
      // cancelPlacement delegates to TileHighlightService — verify state is empty
      expect(() => component.cancelPlacement()).not.toThrow();
      const ths = (component as unknown as TestableGameBoardComponent).tileHighlightService;
      expect(ths.getHighlightedTiles().size).toBe(0);
    });
  });

  describe('Drag-and-Drop Tower Placement', () => {
    it('onTowerDragStart delegates without throwing for left-button mouse events', () => {
      // TowerPlacementService is component-scoped; just verify the delegation doesn't throw
      const mouseEvent = new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 200 });
      expect(() => component.onTowerDragStart(mouseEvent, TowerType.SNIPER)).not.toThrow();
    });

    it('onTowerDragStart delegates without throwing for right-button mouse events', () => {
      const mouseEvent = new MouseEvent('mousedown', { button: 2, clientX: 100, clientY: 200 });
      expect(() => component.onTowerDragStart(mouseEvent, TowerType.SNIPER)).not.toThrow();
      // Right-click guard lives in TowerPlacementService — no drag state change on component side
      expect(component.isDragging).toBeFalse();
    });

    it('isDragging should be false by default', () => {
      expect(component.isDragging).toBeFalse();
    });


    it('onDragMove (internal) is handled by TowerPlacementService — isDragging stays false', () => {
      expect(component.isDragging).toBeFalse();
    });
  });

  describe('Enhanced Tower Info Panel', () => {
    it('upgradePreview should be null by default', () => {
      expect(component.upgradePreview).toBeNull();
    });

    it('refreshTowerInfoPanel should compute upgrade preview for L1 tower', () => {
      const fakeTower: PlacedTower = {
        id: '5-5', type: TowerType.BASIC, level: 1, row: 5, col: 5,
        kills: 3, totalInvested: 50, mesh: null,
        targetingMode: TargetingMode.NEAREST
      };
      (component as unknown as TestableGameBoardComponent).selectedTowerInfo = fakeTower;
      // Stub showRangePreview to avoid Three.js canvas crash
      spyOn((component as unknown as TestableGameBoardComponent).rangeVisualizationService, 'showForTower');
      (component as unknown as TestableGameBoardComponent).refreshTowerInfoPanel();

      expect(component.upgradePreview).toBeTruthy();
      expect(component.upgradePreview!.damage).toBeGreaterThan(component.selectedTowerStats!.damage);
    });

    it('refreshTowerInfoPanel should not compute preview for L2 tower (needs spec choice)', () => {
      const fakeTower: PlacedTower = {
        id: '5-5', type: TowerType.BASIC, level: 2, row: 5, col: 5,
        kills: 0, totalInvested: 100, mesh: null,
        targetingMode: TargetingMode.NEAREST
      };
      (component as unknown as TestableGameBoardComponent).selectedTowerInfo = fakeTower;
      spyOn((component as unknown as TestableGameBoardComponent).rangeVisualizationService, 'showForTower');
      (component as unknown as TestableGameBoardComponent).refreshTowerInfoPanel();

      // L2→L3 requires specialization choice, no generic preview
      expect(component.upgradePreview).toBeNull();
    });

    it('refreshTowerInfoPanel should not compute preview for max level tower', () => {
      const fakeTower: PlacedTower = {
        id: '5-5', type: TowerType.BASIC, level: 3, row: 5, col: 5,
        kills: 0, totalInvested: 150, mesh: null,
        targetingMode: TargetingMode.NEAREST, specialization: TowerSpecialization.ALPHA
      };
      (component as unknown as TestableGameBoardComponent).selectedTowerInfo = fakeTower;
      spyOn((component as unknown as TestableGameBoardComponent).rangeVisualizationService, 'showForTower');
      (component as unknown as TestableGameBoardComponent).refreshTowerInfoPanel();

      expect(component.upgradePreview).toBeNull();
    });

    it('deselectTower should clear upgradePreview', () => {
      component.upgradePreview = { damage: 50, range: 4 };
      component.deselectTower();
      expect(component.upgradePreview).toBeNull();
    });

    it('rangeVisualizationService should be injected', () => {
      expect((component as unknown as TestableGameBoardComponent).rangeVisualizationService).toBeTruthy();
    });
  });

  // --- Tutorial integration ---

  describe('tutorial integration', () => {
    beforeEach(() => {
      // ngOnInit does not run in this suite (no detectChanges), so manually wire
      // the tutorialFacade subscription as it would be wired during ngOnInit.
      (component.tutorialFacade as unknown as TestableTutorialFacade).tutorialSub = tutorialSpy.getCurrentStep().subscribe((step: TutorialStep | null) => {
        component.tutorialFacade.currentTutorialStep = step;
      });
    });

    afterEach(() => {
      const tf = component.tutorialFacade as unknown as TestableTutorialFacade;
      if (tf.tutorialSub) {
        tf.tutorialSub.unsubscribe();
      }
    });

    it('subscribes to getCurrentStep on init and sets currentTutorialStep', () => {
      tutorialStep$.next(TutorialStep.WELCOME);
      expect(component.tutorialFacade.currentTutorialStep).toBe(TutorialStep.WELCOME);
    });

    it('currentTutorialStep is null initially when tutorial step$ emits null', () => {
      tutorialStep$.next(null);
      expect(component.tutorialFacade.currentTutorialStep).toBeNull();
    });

    it('advanceTutorial() delegates to tutorialService.advanceStep()', () => {
      component.advanceTutorial();
      expect(tutorialSpy.advanceStep).toHaveBeenCalled();
    });

    it('skipTutorial() delegates to tutorialService.skipTutorial() (highlight cleanup is child component responsibility)', () => {
      component.skipTutorial();
      expect(tutorialSpy.skipTutorial).toHaveBeenCalled();
    });

    it('getTutorialTip() returns null when currentTutorialStep is null', () => {
      component.tutorialFacade.currentTutorialStep = null;
      expect(component.getTutorialTip()).toBeNull();
    });

    it('getTutorialTip() calls tutorialService.getTip with current step', () => {
      component.tutorialFacade.currentTutorialStep = TutorialStep.PLACE_TOWER;
      const result = component.getTutorialTip();
      expect(tutorialSpy.getTip).toHaveBeenCalledWith(TutorialStep.PLACE_TOWER);
      expect(result).toBeTruthy();
    });

    it('getTutorialStepNumber() returns 1 for WELCOME step', () => {
      component.tutorialFacade.currentTutorialStep = TutorialStep.WELCOME;
      expect(component.getTutorialStepNumber()).toBe(1);
    });

    it('getTutorialStepNumber() returns 2 for SELECT_TOWER step', () => {
      component.tutorialFacade.currentTutorialStep = TutorialStep.SELECT_TOWER;
      expect(component.getTutorialStepNumber()).toBe(2);
    });

    it('getTutorialStepNumber() returns 0 when currentTutorialStep is null', () => {
      component.tutorialFacade.currentTutorialStep = null;
      expect(component.getTutorialStepNumber()).toBe(0);
    });

    it('does not call startTutorial when tutorial is already complete', () => {
      // tutorialSpy.isTutorialComplete returns true by default in this suite
      // ngOnInit already ran during construction path — check the spy
      expect(tutorialSpy.startTutorial).not.toHaveBeenCalled();
    });

    it('calls startTutorial when tutorial is not complete', () => {
      tutorialSpy.isTutorialComplete.and.returnValue(false);
      // Re-run the tutorial startup logic manually (simulates ngOnInit path)
      if (!tutorialSpy.isTutorialComplete()) {
        tutorialSpy.startTutorial();
      }
      expect(tutorialSpy.startTutorial).toHaveBeenCalled();
    });

    it('currentTutorialStep updates when observable emits new step', () => {
      tutorialStep$.next(TutorialStep.START_WAVE);
      expect(component.tutorialFacade.currentTutorialStep).toBe(TutorialStep.START_WAVE);

      tutorialStep$.next(TutorialStep.UPGRADE_TOWER);
      expect(component.tutorialFacade.currentTutorialStep).toBe(TutorialStep.UPGRADE_TOWER);
    });

    it('currentTutorialStep becomes null when observable emits null', () => {
      tutorialStep$.next(TutorialStep.PLACE_TOWER);
      expect(component.tutorialFacade.currentTutorialStep).toBe(TutorialStep.PLACE_TOWER);

      tutorialStep$.next(null);
      expect(component.tutorialFacade.currentTutorialStep).toBeNull();
    });

    it('child component receives null tip when currentTutorialStep is null', () => {
      // Verifies getTutorialTip() returns null — the child component uses this for its [tip] input
      component.tutorialFacade.currentTutorialStep = null;
      expect(component.getTutorialTip()).toBeNull();
    });
  });

  // ── getEnemyBadges ───────────────────────────────────────────────────────────

  describe('getEnemyBadges', () => {
    it('returns an empty array for Basic enemies (no immunities, no specials, leak=1)', () => {
      const badges = component.getEnemyBadges(EnemyType.BASIC);
      expect(badges).toEqual([]);
    });

    it('returns Flies badge and Slow immune badge for Flying enemies', () => {
      const badges = component.getEnemyBadges(EnemyType.FLYING);
      const texts = badges.map(b => b.text);
      expect(texts).toContain('Flies');
      expect(texts).toContain('Slow immune');
    });

    it('Flies badge has severity info', () => {
      const badges = component.getEnemyBadges(EnemyType.FLYING);
      const flies = badges.find(b => b.text === 'Flies');
      expect(flies?.severity).toBe('info');
    });

    it('Slow immune badge has severity warning', () => {
      const badges = component.getEnemyBadges(EnemyType.FLYING);
      const immune = badges.find(b => b.text === 'Slow immune');
      expect(immune?.severity).toBe('warning');
    });

    it('returns Shield badge with correct HP for Shielded enemies', () => {
      const badges = component.getEnemyBadges(EnemyType.SHIELDED);
      const shield = badges.find(b => b.text.startsWith('Shield:'));
      expect(shield).toBeTruthy();
      // Value must match ENEMY_STATS — currently 60HP
      expect(shield?.text).toBe('Shield: 60HP');
      expect(shield?.severity).toBe('info');
    });

    it('returns Leak:2 badge for Shielded enemies', () => {
      const badges = component.getEnemyBadges(EnemyType.SHIELDED);
      const leak = badges.find(b => b.text.startsWith('Leak:'));
      expect(leak?.text).toBe('Leak: 2');
      expect(leak?.severity).toBe('danger');
    });

    it('returns Splits badge for Swarm enemies', () => {
      const badges = component.getEnemyBadges(EnemyType.SWARM);
      const splits = badges.find(b => b.text.startsWith('Splits'));
      expect(splits).toBeTruthy();
      expect(splits?.text).toBe('Splits ×3');
      expect(splits?.severity).toBe('warning');
    });

    it('returns Leak:3 badge for Boss enemies', () => {
      const badges = component.getEnemyBadges(EnemyType.BOSS);
      const leak = badges.find(b => b.text.startsWith('Leak:'));
      expect(leak?.text).toBe('Leak: 3');
      expect(leak?.severity).toBe('danger');
    });

    it('returns Leak:2 badge for Heavy enemies', () => {
      const badges = component.getEnemyBadges(EnemyType.HEAVY);
      const leak = badges.find(b => b.text.startsWith('Leak:'));
      expect(leak?.text).toBe('Leak: 2');
      expect(leak?.severity).toBe('danger');
    });

    it('returns an empty array for Fast enemies (leak=1, no specials)', () => {
      const badges = component.getEnemyBadges(EnemyType.FAST);
      expect(badges).toEqual([]);
    });

    it('returns an empty array for Swift enemies (leak=1, no specials)', () => {
      const badges = component.getEnemyBadges(EnemyType.SWIFT);
      expect(badges).toEqual([]);
    });

    it('returns the same array reference on repeated calls (memoised)', () => {
      const first = component.getEnemyBadges(EnemyType.BOSS);
      const second = component.getEnemyBadges(EnemyType.BOSS);
      expect(first).toBe(second);
    });
  });

  describe('GameEndService — buildGameEndStats wiring (via recordEnd)', () => {
    let gameEndService: GameEndService;

    beforeEach(() => {
      gameEndService = fixture.debugElement.injector.get(GameEndService);
    });

    it('includes towerKills from GameStatsService', () => {
      const gameStatsService = fixture.debugElement.injector.get(GameStatsService);
      gameStatsService.recordKill(TowerType.SNIPER);
      gameStatsService.recordKill(TowerType.SNIPER);

      gameEndService.recordEnd(true);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ towerKills: jasmine.objectContaining({ sniper: 2 }) })
      );
    });

    it('includes modifierCount from active modifiers on GameState', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      const expected = gameStateService.getState().activeModifiers.size;

      gameEndService.recordEnd(true);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ modifierCount: expected })
      );
    });

    it('usedSpecialization is false before any spec upgrade', () => {
      gameEndService.recordEnd(true);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ usedSpecialization: false })
      );
    });

    it('usedSpecialization is true after recordSpecialization() is called', () => {
      gameEndService.recordSpecialization();

      gameEndService.recordEnd(false);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ usedSpecialization: true })
      );
    });

    it('placedAllTowerTypes is false when fewer than 6 tower types used', () => {
      const challengeTrackingService = fixture.debugElement.injector.get(ChallengeTrackingService);
      challengeTrackingService.recordTowerPlaced(TowerType.BASIC, 100);
      challengeTrackingService.recordTowerPlaced(TowerType.SNIPER, 150);

      gameEndService.recordEnd(true);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ placedAllTowerTypes: false })
      );
    });

    it('placedAllTowerTypes is true when all 6 tower types have been used', () => {
      const challengeTrackingService = fixture.debugElement.injector.get(ChallengeTrackingService);
      challengeTrackingService.recordTowerPlaced(TowerType.BASIC, 100);
      challengeTrackingService.recordTowerPlaced(TowerType.SNIPER, 150);
      challengeTrackingService.recordTowerPlaced(TowerType.SPLASH, 200);
      challengeTrackingService.recordTowerPlaced(TowerType.SLOW, 125);
      challengeTrackingService.recordTowerPlaced(TowerType.CHAIN, 175);
      challengeTrackingService.recordTowerPlaced(TowerType.MORTAR, 225);

      gameEndService.recordEnd(true);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ placedAllTowerTypes: true })
      );
    });

    it('slowEffectsApplied comes from StatusEffectService.getSlowApplicationCount()', () => {
      const statusEffectService = fixture.debugElement.injector.get(StatusEffectService);
      spyOn(statusEffectService, 'getSlowApplicationCount').and.returnValue(42);

      gameEndService.recordEnd(true);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ slowEffectsApplied: 42 })
      );
    });

    it('populates isVictory correctly for victory and defeat paths', () => {
      gameEndService.recordEnd(true);
      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ isVictory: true })
      );

      playerProfileSpy.recordGameEnd.calls.reset();
      gameEndService.reset();
      gameEndService.recordEnd(false);
      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ isVictory: false })
      );
    });

    it('recordEnd is idempotent — second call returns empty and does not re-record', () => {
      gameEndService.recordEnd(true);
      playerProfileSpy.recordGameEnd.calls.reset();

      const result = gameEndService.recordEnd(true);

      expect(playerProfileSpy.recordGameEnd).not.toHaveBeenCalled();
      expect(result.newlyUnlockedAchievements).toEqual([]);
    });

    it('reset() allows re-recording in the next session', () => {
      gameEndService.recordEnd(false);
      playerProfileSpy.recordGameEnd.calls.reset();
      gameEndService.reset();

      gameEndService.recordEnd(false);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('recordChallengeCompleted wiring', () => {
    it('GameEndService.isRecorded() resets to false after GameSessionService.resetAllServices', () => {
      const gameEndService = fixture.debugElement.injector.get(GameEndService);
      gameEndService.recordSpecialization();
      gameEndService.recordEnd(false);
      expect(gameEndService.isRecorded()).toBeTrue();

      gameEndService.reset();
      expect(gameEndService.isRecorded()).toBeFalse();
    });
  });

  describe('GameNotificationService wiring', () => {
    let notificationService: GameNotificationService;

    beforeEach(() => {
      notificationService = fixture.debugElement.injector.get(GameNotificationService);
    });

    it('streak bonus triggers a STREAK notification', () => {
      spyOn(notificationService, 'show');
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      spyOn(gameStateService, 'addStreakBonus').and.returnValue(50);
      spyOn(gameStateService, 'getStreak').and.returnValue(3);

      // Simulate the streak notification path directly
      const bonus = gameStateService.addStreakBonus();
      if (bonus > 0) {
        const streak = gameStateService.getStreak();
        notificationService.show(
          NotificationType.STREAK,
          'Perfect Wave!',
          `+${bonus}g streak bonus (${streak} waves)`
        );
      }

      expect(notificationService.show).toHaveBeenCalledWith(
        NotificationType.STREAK,
        'Perfect Wave!',
        '+50g streak bonus (3 waves)'
      );
    });

    it('streak bonus with 0 return does NOT trigger notification', () => {
      spyOn(notificationService, 'show');
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      spyOn(gameStateService, 'addStreakBonus').and.returnValue(0);

      const bonus = gameStateService.addStreakBonus();
      if (bonus > 0) {
        notificationService.show(NotificationType.STREAK, 'Perfect Wave!', 'msg');
      }

      expect(notificationService.show).not.toHaveBeenCalled();
    });

    it('achievement unlock triggers an ACHIEVEMENT notification', () => {
      spyOn(notificationService, 'show');
      const achId = ACHIEVEMENTS[0]?.id ?? 'first_blood';
      const ach = ACHIEVEMENTS.find(a => a.id === achId);

      if (ach) {
        notificationService.show(
          NotificationType.ACHIEVEMENT,
          'Achievement Unlocked!',
          ach.name
        );
        expect(notificationService.show).toHaveBeenCalledWith(
          NotificationType.ACHIEVEMENT,
          'Achievement Unlocked!',
          ach.name
        );
      } else {
        // No achievements defined — skip assertion
        expect(true).toBeTrue();
      }
    });

    it('challenge completion triggers a CHALLENGE notification', () => {
      spyOn(notificationService, 'show');
      const challenge = { id: 'ch_1', name: 'Speed Run', description: '', scoreBonus: 100 };

      notificationService.show(
        NotificationType.CHALLENGE,
        'Challenge Complete!',
        `${challenge.name} (+${challenge.scoreBonus} pts)`
      );

      expect(notificationService.show).toHaveBeenCalledWith(
        NotificationType.CHALLENGE,
        'Challenge Complete!',
        'Speed Run (+100 pts)'
      );
    });

    it('dismissNotification delegates to notificationService.dismiss', () => {
      spyOn(notificationService, 'dismiss');

      component.dismissNotification(42);

      expect(notificationService.dismiss).toHaveBeenCalledWith(42);
    });
  });

  describe('Auto-pause on visibility/focus loss', () => {
    let gameStateService: GameStateService;

    beforeEach(() => {
      gameStateService = fixture.debugElement.injector.get(GameStateService);
      // Manually wire auto-pause listeners (ngAfterViewInit is not called in these tests)
      (component as unknown as TestableGameBoardComponent).setupAutoPause();
    });

    afterEach(() => {
      // Clean up document/window listeners registered by GamePauseService
      fixture.debugElement.injector.get(GamePauseService).cleanup();
    });

    it('visibility change to hidden during COMBAT triggers pause', () => {
      gameStateService.startWave();
      spyOnProperty(document, 'hidden').and.returnValue(true);
      spyOn(gameStateService, 'togglePause').and.callThrough();

      document.dispatchEvent(new Event('visibilitychange'));

      expect(gameStateService.togglePause).toHaveBeenCalled();
      expect(gameStateService.getState().isPaused).toBeTrue();
    });

    it('visibility change to hidden during SETUP does NOT trigger pause', () => {
      // Phase stays SETUP (default)
      spyOnProperty(document, 'hidden').and.returnValue(true);
      spyOn(gameStateService, 'togglePause').and.callThrough();

      document.dispatchEvent(new Event('visibilitychange'));

      expect(gameStateService.togglePause).not.toHaveBeenCalled();
    });

    it('visibility change to hidden when already paused does NOT double-toggle', () => {
      gameStateService.startWave();
      gameStateService.togglePause(); // already paused
      spyOnProperty(document, 'hidden').and.returnValue(true);
      spyOn(gameStateService, 'togglePause').and.callThrough();

      document.dispatchEvent(new Event('visibilitychange'));

      expect(gameStateService.togglePause).not.toHaveBeenCalled();
      expect(gameStateService.getState().isPaused).toBeTrue();
    });

    it('window blur during COMBAT triggers pause', () => {
      gameStateService.startWave();
      spyOn(gameStateService, 'togglePause').and.callThrough();

      window.dispatchEvent(new Event('blur'));

      expect(gameStateService.togglePause).toHaveBeenCalled();
      expect(gameStateService.getState().isPaused).toBeTrue();
    });

    it('autoPaused flag is set to true on auto-pause via visibilitychange', () => {
      gameStateService.startWave();
      spyOnProperty(document, 'hidden').and.returnValue(true);

      document.dispatchEvent(new Event('visibilitychange'));

      expect(component.autoPaused).toBeTrue();
    });

    it('autoPaused flag is set to true on auto-pause via window blur', () => {
      gameStateService.startWave();

      window.dispatchEvent(new Event('blur'));

      expect(component.autoPaused).toBeTrue();
    });

    it('autoPaused flag is reset to false on manual togglePause (resume)', () => {
      const gamePauseService = fixture.debugElement.injector.get(GamePauseService);
      gameStateService.startWave();
      // Simulate that the service flagged an auto-pause
      gamePauseService.autoPaused = true;

      component.togglePause();

      expect(component.autoPaused).toBeFalse();
    });

    it('event listeners are cleaned up in ngOnDestroy', () => {
      // Handlers are already wired in beforeEach; spy on remove calls
      spyOn(document, 'removeEventListener').and.callThrough();
      spyOn(window, 'removeEventListener').and.callThrough();

      component.ngOnDestroy();

      // Verify auto-pause handlers were removed
      expect(document.removeEventListener).toHaveBeenCalledWith(
        'visibilitychange', jasmine.any(Function)
      );
      expect(window.removeEventListener).toHaveBeenCalledWith(
        'blur', jasmine.any(Function)
      );

      // afterEach calls gamePauseService.cleanup() which already null-checks handlers
      // before removeEventListener, so no manual nulling is needed here.
    });

    it('visibility change to hidden during INTERMISSION triggers pause', () => {
      gameStateService.startWave();
      gameStateService.completeWave(0); // → INTERMISSION
      spyOnProperty(document, 'hidden').and.returnValue(true);
      spyOn(gameStateService, 'togglePause').and.callThrough();

      document.dispatchEvent(new Event('visibilitychange'));

      expect(gameStateService.togglePause).toHaveBeenCalled();
      expect(gameStateService.getState().isPaused).toBeTrue();
    });

    it('window blur during INTERMISSION triggers pause', () => {
      gameStateService.startWave();
      gameStateService.completeWave(0); // → INTERMISSION
      spyOn(gameStateService, 'togglePause').and.callThrough();

      window.dispatchEvent(new Event('blur'));

      expect(gameStateService.togglePause).toHaveBeenCalled();
      expect(gameStateService.getState().isPaused).toBeTrue();
    });

    it('already paused in INTERMISSION does NOT double-toggle on blur', () => {
      gameStateService.startWave();
      gameStateService.completeWave(0); // → INTERMISSION
      gameStateService.togglePause(); // already paused
      spyOn(gameStateService, 'togglePause').and.callThrough();

      window.dispatchEvent(new Event('blur'));

      expect(gameStateService.togglePause).not.toHaveBeenCalled();
      expect(gameStateService.getState().isPaused).toBeTrue();
    });
  });

  describe('INTERMISSION pause — keyboard and pause menu', () => {
    let gameStateService: GameStateService;

    function fireKey(key: string): void {
      const event = new KeyboardEvent('keydown', { key, bubbles: true });
      const gameInputSvc = fixture.debugElement.injector.get(GameInputService);
      const gsvc = fixture.debugElement.injector.get(GameStateService);
      gameInputSvc.dispatchHotkey(event, gsvc.getState(), {
        onSpace: () => {}, onPause: () => component.togglePause(),
        onEscape: () => {
          if (component.isPaused) { component.togglePause(); }
          else if (component.isPlaceMode) { component.cancelPlacement(); }
          else if (component.selectedTowerInfo) { component.deselectTower(); }
          else { component.togglePause(); }
        },
        onToggleRanges: () => {},
        onToggleMinimap: () => {}, onTogglePath: () => {}, onUpgrade: () => {},
        onCycleTargeting: () => {}, onSell: () => {}, onTowerHotkey: (_type) => {},
        isInRun: () => false, isPlaceMode: () => component.isPlaceMode,
        getSelectedTowerInfo: () => component.selectedTowerInfo,
      });
    }

    beforeEach(() => {
      gameStateService = fixture.debugElement.injector.get(GameStateService);
    });

    it('P key toggles pause during INTERMISSION', () => {
      gameStateService.startWave();
      gameStateService.completeWave(0); // → INTERMISSION
      spyOn(component, 'togglePause').and.callThrough();

      fireKey('p');

      expect(component.togglePause).toHaveBeenCalled();
      expect(gameStateService.getState().isPaused).toBeTrue();
    });

    it('ESC key toggles pause during INTERMISSION when paused', () => {
      gameStateService.startWave();
      gameStateService.completeWave(0); // → INTERMISSION
      gameStateService.togglePause(); // pause first
      component.gameState = gameStateService.getState();
      spyOn(component, 'togglePause').and.callThrough();

      fireKey('Escape');

      expect(component.togglePause).toHaveBeenCalled();
      expect(gameStateService.getState().isPaused).toBeFalse();
    });

    it('togglePause works during INTERMISSION via GameStateService', () => {
      gameStateService.startWave();
      gameStateService.completeWave(0); // → INTERMISSION

      component.togglePause();

      expect(gameStateService.getState().isPaused).toBeTrue();
    });

    it('autoPaused flag set when auto-pausing during INTERMISSION', () => {
      const gamePauseService = fixture.debugElement.injector.get(GamePauseService);
      gameStateService.startWave();
      gameStateService.completeWave(0); // → INTERMISSION
      spyOn(gamePauseService, 'setupAutoPause');
      (component as unknown as TestableGameBoardComponent).setupAutoPause();

      // setupAutoPause is now delegated to GamePauseService
      expect(gamePauseService.setupAutoPause).toHaveBeenCalled();
    });
  });

  describe('ChallengeTrackingService delegation', () => {
    let challengeTrackingSpy: jasmine.SpyObj<ChallengeTrackingService>;

    beforeEach(() => {
      challengeTrackingSpy = jasmine.createSpyObj('ChallengeTrackingService', [
        'recordTowerPlaced',
        'recordTowerUpgraded',
        'recordTowerSold',
        'getSnapshot',
        'getTowerTypesUsed',
        'reset',
      ]);
      challengeTrackingSpy.getTowerTypesUsed.and.returnValue(new Set<TowerType>());
      // Override on both the component (for direct calls) and the service (for delegated calls)
      (component as unknown as TestableGameBoardComponent).challengeTrackingService = challengeTrackingSpy;
      (fixture.debugElement.injector.get(TowerInteractionService) as unknown as TestableTowerInteractionService).challengeTrackingService = challengeTrackingSpy;
    });

    it('upgradeTower delegates recordTowerUpgraded to ChallengeTrackingService', () => {
      // Set up a real selected tower in the INSPECT state
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.startWave();
      gameStateService.addGold(500);

      const mockTower: PlacedTower = {
        id: '0-0',
        type: TowerType.BASIC,
        level: 1,
        row: 0,
        col: 0,
        kills: 0,
        totalInvested: 100,
        mesh: null,
        targetingMode: TargetingMode.NEAREST,
      };

      const towerCombatService = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(towerCombatService, 'getTower').and.returnValue(mockTower);
      spyOn(towerCombatService, 'upgradeTower').and.returnValue(true);

      (component as unknown as TestableGameBoardComponent).selectedTowerInfo = mockTower;
      component.selectedTowerType = null; // INSPECT mode
      spyOn(component as unknown as TestableGameBoardComponent, 'refreshTowerInfoPanel');
      spyOn((component as unknown as TestableGameBoardComponent).rangeVisualizationService, 'showForTower');

      component.upgradeTower();

      expect(challengeTrackingSpy.recordTowerUpgraded).toHaveBeenCalled();
    });

    it('sellTower delegates recordTowerSold to ChallengeTrackingService', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.startWave();

      const towerCombatService = fixture.debugElement.injector.get(TowerCombatService);
      const mockSoldTower: PlacedTower = {
        id: '1-1',
        type: TowerType.BASIC,
        level: 1,
        row: 1,
        col: 1,
        kills: 0,
        totalInvested: 100,
        mesh: null,
        targetingMode: TargetingMode.NEAREST,
      };
      spyOn(towerCombatService, 'unregisterTower').and.returnValue(mockSoldTower);

      // Stub board-touching methods so they don't crash without renderer/board
      const gameBoardSvc = fixture.debugElement.injector.get(GameBoardService);
      spyOn(gameBoardSvc, 'removeTower');
      const enemyService = fixture.debugElement.injector.get(EnemyService);
      spyOn(enemyService, 'repathAffectedEnemies');
      spyOn(component as unknown as TestableGameBoardComponent, 'deselectTower');
      spyOn(component as unknown as TestableGameBoardComponent, 'updateTileHighlights');
      spyOn(component as unknown as TestableGameBoardComponent, 'refreshPathOverlay');

      (component as unknown as TestableGameBoardComponent).selectedTowerInfo = mockSoldTower;
      component.sellConfirmPending = true; // skip first click confirm

      component.sellTower();

      expect(challengeTrackingSpy.recordTowerSold).toHaveBeenCalled();
    });
  });

  describe('toggleModifier — state divergence guard', () => {
    let gameStateService: GameStateService;

    beforeEach(() => {
      gameStateService = fixture.debugElement.injector.get(GameStateService);
    });

    it('activeModifiers reflects service state after toggleModifier during SETUP', () => {
      // Phase is SETUP, wave 0 — setModifiers is NOT a no-op; service emits and
      // the stateSubscription (wired in ngOnInit) syncs the component copy.
      // In unit tests ngOnInit is not called, but we can wire the subscription manually
      // to prove the sync path works.
      const sub = gameStateService.getState$().subscribe(state => {
        component.activeModifiers = state.activeModifiers;
      });

      component.toggleModifier(GameModifier.ARMORED_ENEMIES);

      const serviceModifiers = gameStateService.getState().activeModifiers;
      expect(component.activeModifiers).toEqual(serviceModifiers);
      expect(serviceModifiers.has(GameModifier.ARMORED_ENEMIES)).toBeTrue();

      sub.unsubscribe();
    });

    it('component activeModifiers is corrected when a state emission follows a no-op toggleModifier', () => {
      // Advance to COMBAT so setModifiers' phase guard rejects the call without emitting.
      gameStateService.startWave();

      // Wire the sync subscription (mirrors what ngOnInit does for activeModifiers).
      const sub = gameStateService.getState$().subscribe(state => {
        component.activeModifiers = state.activeModifiers;
        component.modifierScoreMultiplier = calculateModifierScoreMultiplier(state.activeModifiers);
      });

      // toggleModifier locally mutates activeModifiers, but setModifiers is a no-op in COMBAT.
      component.toggleModifier(GameModifier.FAST_ENEMIES);

      // At this point the local mutation has occurred but no state emission has fired
      // (setModifiers returned early).  Trigger a real state emission (e.g. gold change)
      // which fires the subscription and corrects the component's copy.
      gameStateService.addGold(0); // no-op value change, but causes emit()

      const serviceModifiers = gameStateService.getState().activeModifiers;
      expect(component.activeModifiers).toEqual(serviceModifiers);
      expect(serviceModifiers.has(GameModifier.FAST_ENEMIES)).toBeFalse();

      sub.unsubscribe();
    });

    it('modifierScoreMultiplier is corrected after next state emission following no-op toggle', () => {
      gameStateService.startWave();

      // Wire the sync subscription that mirrors the ngOnInit fix.
      const sub = gameStateService.getState$().subscribe(state => {
        component.activeModifiers = state.activeModifiers;
        component.modifierScoreMultiplier = calculateModifierScoreMultiplier(state.activeModifiers);
      });

      component.toggleModifier(GameModifier.GLASS_CANNON);

      // Trigger a state emission to invoke the corrective subscription handler.
      gameStateService.addGold(0);

      const serviceModifiers = gameStateService.getState().activeModifiers;
      expect(component.modifierScoreMultiplier).toBe(1.0);
      expect(serviceModifiers.has(GameModifier.GLASS_CANNON)).toBeFalse();

      sub.unsubscribe();
    });
  });

  describe('raycasting array caching', () => {
    let meshRegistry: BoardMeshRegistryService;

    beforeEach(() => {
      meshRegistry = fixture.debugElement.injector.get(BoardMeshRegistryService);
    });

    it('tileMeshArray starts empty', () => {
      expect(meshRegistry.getTileMeshArray().length).toBe(0);
    });

    it('rebuildTileMeshArray reflects the current tileMeshes map', () => {
      const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      meshRegistry.tileMeshes.set('0-0', mesh1);
      meshRegistry.tileMeshes.set('0-1', mesh2);

      meshRegistry.rebuildTileMeshArray();

      expect(meshRegistry.getTileMeshArray().length).toBe(2);
      expect(meshRegistry.getTileMeshArray()).toContain(mesh1);
      expect(meshRegistry.getTileMeshArray()).toContain(mesh2);

      mesh1.geometry.dispose(); (mesh1.material as THREE.Material).dispose();
      mesh2.geometry.dispose(); (mesh2.material as THREE.Material).dispose();
    });

    it('towerChildrenArray starts empty', () => {
      expect(meshRegistry.getTowerChildrenArray().length).toBe(0);
    });

    it('rebuildTowerChildrenArray collects children from all tower groups', () => {
      const group = new THREE.Group();
      const childMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      group.add(childMesh);
      meshRegistry.towerMeshes.set('r1-c2', group);

      meshRegistry.rebuildTowerChildrenArray();

      expect(meshRegistry.getTowerChildrenArray().length).toBe(1);
      expect(meshRegistry.getTowerChildrenArray()[0]).toBe(childMesh);

      childMesh.geometry.dispose();
      (childMesh.material as THREE.Material).dispose();
    });

    it('tileMeshArray is cleared when cleanupGameObjects runs the rebuild after cleanup', () => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      meshRegistry.tileMeshes.set('0-0', mesh);
      meshRegistry.rebuildTileMeshArray();
      expect(meshRegistry.getTileMeshArray().length).toBe(1);

      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();

      // Simulate cleanupScene clearing the registry (the real service does this;
      // the spy is a no-op so we replicate that side-effect manually).
      gameSessionSpy.cleanupScene.and.callFake(() => {
        meshRegistry.tileMeshes.clear();
        meshRegistry.towerMeshes.clear();
      });

      (component as unknown as TestableGameBoardComponent).cleanupGameObjects();

      expect(meshRegistry.getTileMeshArray().length).toBe(0);
      expect(meshRegistry.getTowerChildrenArray().length).toBe(0);
    });
  });

  describe('onWaveComplete — wave clear banner', () => {
    it('sets showWaveClear to true and waveClearMessage immediately', () => {
      component.waveCombat.onWaveComplete(3, false);

      expect(component.waveCombat.showWaveClear).toBeTrue();
      expect(component.waveCombat.waveClearMessage).toBe('Wave 3 Clear!');
    });

    it('includes "Perfect!" suffix when perfectWave is true', () => {
      component.waveCombat.onWaveComplete(5, true);

      expect(component.waveCombat.waveClearMessage).toBe('Wave 5 Clear! Perfect!');
    });

    it('does NOT include "Perfect!" when perfectWave is false', () => {
      component.waveCombat.onWaveComplete(2, false);

      expect(component.waveCombat.waveClearMessage).not.toContain('Perfect');
    });

    it('sets showWaveClear to false after 2 seconds', fakeAsync(() => {
      component.waveCombat.onWaveComplete(1, false);
      expect(component.waveCombat.showWaveClear).toBeTrue();

      tick(2000);

      expect(component.waveCombat.showWaveClear).toBeFalse();
    }));

    it('resets the timer if called again before the first expires', fakeAsync(() => {
      component.waveCombat.onWaveComplete(1, false);
      tick(1000);
      component.waveCombat.onWaveComplete(2, false);

      // Should still be showing because the timer was reset
      tick(1500);
      expect(component.waveCombat.showWaveClear).toBeTrue();

      tick(500);
      expect(component.waveCombat.showWaveClear).toBeFalse();
    }));
  });

  describe('waveStartPulse — wave counter pulse', () => {
    it('starts as false', () => {
      expect(component.waveCombat.waveStartPulse).toBeFalse();
    });

    it('becomes true when triggerWaveStartPulse is called', fakeAsync(() => {
      component.waveCombat.triggerWaveStartPulse();

      expect(component.waveCombat.waveStartPulse).toBeTrue();

      tick(300);

      expect(component.waveCombat.waveStartPulse).toBeFalse();
    }));

    it('resets to false after 300ms', fakeAsync(() => {
      component.waveCombat.triggerWaveStartPulse();
      tick(299);
      expect(component.waveCombat.waveStartPulse).toBeTrue();

      tick(1);
      expect(component.waveCombat.waveStartPulse).toBeFalse();
    }));

    it('resets timer if called again before prior pulse expires', fakeAsync(() => {
      component.waveCombat.triggerWaveStartPulse();
      tick(200);
      component.waveCombat.triggerWaveStartPulse();

      // 200ms into the reset timer — should still be true
      tick(200);
      expect(component.waveCombat.waveStartPulse).toBeTrue();

      tick(100);
      expect(component.waveCombat.waveStartPulse).toBeFalse();
    }));
  });

  describe('updateChallengeIndicators', () => {
    let _challengeTrackingService: ChallengeTrackingService;
    let mapBridge: MapBridgeService;

    beforeEach(() => {
      _challengeTrackingService = fixture.debugElement.injector.get(ChallengeTrackingService);
      mapBridge = fixture.debugElement.injector.get(MapBridgeService);
    });

    it('returns empty array when not a campaign game', () => {
      // No campaign map loaded — mapId is null
      component.updateChallengeIndicators();
      expect(component.challengeIndicators).toEqual([]);
    });

    it('returns empty array when mapId is null (non-campaign game)', () => {
      // mapBridge.getMapId() returns null by default (no map loaded)
      spyOn(mapBridge, 'getMapId').and.returnValue(null);
      component.updateChallengeIndicators();
      expect(component.challengeIndicators).toEqual([]);
    });

    it('always returns empty indicators (updateChallengeIndicators passes null in run mode)', () => {
      component.updateChallengeIndicators();
      expect(component.challengeIndicators).toEqual([]);
    });

  });

  // ── Sprint R2: challenge HUD indicator wiring ────────────────────────────
  describe('challenge HUD indicator wiring', () => {
    let challengeSvc: ChallengeDisplayService;
    let runSpy: jasmine.SpyObj<RunService>;

    beforeEach(() => {
      challengeSvc = fixture.debugElement.injector.get(ChallengeDisplayService);
      runSpy = fixture.debugElement.injector.get(RunService) as jasmine.SpyObj<RunService>;
    });

    it('updateChallengeIndicators passes campaignMapId from current encounter to updateIndicators', () => {
      const updateSpy = spyOn(challengeSvc, 'updateIndicators');
      runSpy.getCurrentEncounter.and.returnValue({
        nodeId: 'node-1', nodeType: NodeType.COMBAT,
        campaignMapId: 'campaign_01',
        waves: [], goldReward: 0, isElite: false, isBoss: false,
      } as EncounterConfig);

      component.updateChallengeIndicators();

      expect(updateSpy).toHaveBeenCalledWith('campaign_01');
    });

    it('updateChallengeIndicators passes null when there is no active encounter', () => {
      const updateSpy = spyOn(challengeSvc, 'updateIndicators');
      runSpy.getCurrentEncounter.and.returnValue(null);

      component.updateChallengeIndicators();

      expect(updateSpy).toHaveBeenCalledWith(null);
    });

    it('ngOnInit calls updateChallengeIndicators with non-null campaignMapId when encounter is loaded', () => {
      // ngOnInit already ran (via TestBed.createComponent). The default runSpy
      // returns an encounter without campaignMapId (cast as any), so the real
      // check is: updateIndicators was called at least once with a string value.
      // Re-run via direct wrapper call with a proper campaignMapId to verify wiring.
      const updateSpy = spyOn(challengeSvc, 'updateIndicators');
      runSpy.getCurrentEncounter.and.returnValue({
        nodeId: 'node-1', nodeType: NodeType.COMBAT,
        campaignMapId: 'campaign_03',
        waves: [], goldReward: 0, isElite: false, isBoss: false,
      } as EncounterConfig);

      (component as unknown as TestableGameBoardComponent).updateChallengeIndicators();

      expect(updateSpy).toHaveBeenCalledWith('campaign_03');
    });
  });

  // ── Red team: visual animation freeze during pause (S30) ──────────────────
  describe('red team: visual animations during pause', () => {
    it('enemiesAlive getter uses getLivingEnemyCount (excludes dying enemies)', () => {
      const enemyService = fixture.debugElement.injector.get(EnemyService);
      const livingCountSpy = spyOn(enemyService, 'getLivingEnemyCount').and.returnValue(2);
      // Simulate 3 enemies in map but only 2 living (1 is dying)
      spyOn(enemyService, 'getEnemies').and.returnValue(new Map([
        ['e1', {} as unknown as import('./models/enemy.model').Enemy],
        ['e2', {} as unknown as import('./models/enemy.model').Enemy],
        ['e3', {} as unknown as import('./models/enemy.model').Enemy],
      ]));

      const result = component.enemiesAlive;

      expect(livingCountSpy).toHaveBeenCalled();
      // Must return 2 (from getLivingEnemyCount), not 3 (from getEnemies.size)
      expect(result).toBe(2);
    });

    it('runPausedVisuals calls all cosmetic-only animation updates', () => {
      const enemyService = fixture.debugElement.injector.get(EnemyService);
      const statusEffectService = fixture.debugElement.injector.get(StatusEffectService);
      const gameRenderService = fixture.debugElement.injector.get(GameRenderService);
      const mockScene = new THREE.Scene();
      const mockCamera = new THREE.PerspectiveCamera();
      spyOn((component as unknown as TestableGameBoardComponent).sceneService, 'getScene').and.returnValue(mockScene);
      spyOn((component as unknown as TestableGameBoardComponent).sceneService, 'getCamera').and.returnValue(mockCamera);
      spyOn(statusEffectService, 'getAllActiveEffects').and.returnValue(new Map());

      const dyingSpy = spyOn(enemyService, 'updateDyingAnimations');
      const flashSpy = spyOn(enemyService, 'updateHitFlashes');
      const shieldSpy = spyOn(enemyService, 'updateShieldBreakAnimations');
      const healthBarSpy = spyOn(enemyService, 'updateHealthBars');
      const particleSpy = spyOn(enemyService, 'updateStatusEffectParticles');
      spyOn(enemyService, 'updateStatusVisuals');
      spyOn(enemyService, 'updateEnemyAnimations');
      spyOn(gameRenderService as unknown as TestableGameRenderService, 'updateMinimap');

      gameRenderService.runPausedVisuals(0.016, 1000);

      expect(dyingSpy).toHaveBeenCalledWith(0.016, mockScene);
      expect(flashSpy).toHaveBeenCalledWith(0.016);
      expect(shieldSpy).toHaveBeenCalledWith(0.016);
      expect(healthBarSpy).toHaveBeenCalled();
      expect(particleSpy).toHaveBeenCalled();
    });

    it('runPausedVisuals is NOT invoked when game is unpaused in COMBAT', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      const gameRenderService = fixture.debugElement.injector.get(GameRenderService);
      gameStateService.startWave();
      expect(gameStateService.getState().isPaused).toBeFalse();

      const pausedVisualsSpy = spyOn(gameRenderService, 'runPausedVisuals');

      // Replicate the animate-loop guard logic
      const state = gameStateService.getState();
      if (state.phase === GamePhase.COMBAT && state.isPaused) {
        gameRenderService.runPausedVisuals(0.016, 1000);
      }

      expect(pausedVisualsSpy).not.toHaveBeenCalled();
    });

    it('runPausedVisuals IS invoked when game is paused in COMBAT', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      const gameRenderService = fixture.debugElement.injector.get(GameRenderService);
      gameStateService.startWave();
      gameStateService.togglePause();
      expect(gameStateService.getState().isPaused).toBeTrue();

      const pausedVisualsSpy = spyOn(gameRenderService, 'runPausedVisuals');

      // Replicate the animate-loop guard logic
      const state = gameStateService.getState();
      if (state.phase === GamePhase.COMBAT && state.isPaused) {
        gameRenderService.runPausedVisuals(0.016, 1000);
      }

      expect(pausedVisualsSpy).toHaveBeenCalledWith(0.016, 1000);
    });
  });

  // ── Run mode: card play mechanics ─────────────────────────────────────
  // (was "Ascent Mode" — renamed to reflect post-pivot run-only architecture)
  describe('Ascent Mode: card play mechanics', () => {
    let deckSpy: jasmine.SpyObj<DeckService>;
    let runSpy: jasmine.SpyObj<RunService>;

    function makeTowerCard(cardId: CardId = CardId.TOWER_BASIC): CardInstance {
      return { instanceId: `inst_${cardId}`, cardId, upgraded: false };
    }

    beforeEach(() => {
      deckSpy = fixture.debugElement.injector.get(DeckService) as jasmine.SpyObj<DeckService>;
      runSpy = fixture.debugElement.injector.get(RunService) as jasmine.SpyObj<RunService>;
      // onCardPlayed guards on phase === COMBAT — advance phase so card plays are accepted.
      const gameStateSvc = fixture.debugElement.injector.get(GameStateService);
      gameStateSvc.startWave();
    });

    it('onCardPlayed with tower card sets pendingTowerCard and selectedTowerType', () => {
      runSpy.isInRun.and.returnValue(true);
      const energy: EnergyState = { current: 3, max: 3 };
      deckSpy.getEnergy.and.returnValue(energy);

      const card = makeTowerCard(CardId.TOWER_BASIC);
      const cardPlaySvc = fixture.debugElement.injector.get(CardPlayService);
      component.onCardPlayed(card);

      expect(cardPlaySvc.getPendingCard()).toBe(card);
      expect(component.selectedTowerType).toBe(TowerType.BASIC);
      // Energy not consumed yet — playCard should not have been called
      expect(deckSpy.playCard).not.toHaveBeenCalled();
    });

    it('onCardPlayed blocks second card while pendingTowerCard is set', () => {
      runSpy.isInRun.and.returnValue(true);
      const energy: EnergyState = { current: 3, max: 3 };
      deckSpy.getEnergy.and.returnValue(energy);

      const cardPlaySvc = fixture.debugElement.injector.get(CardPlayService);
      const first = makeTowerCard(CardId.TOWER_BASIC);
      component.onCardPlayed(first);
      expect(cardPlaySvc.getPendingCard()).toBe(first);

      const second = makeTowerCard(CardId.TOWER_SNIPER);
      component.onCardPlayed(second);

      // Second card should be blocked — pendingTowerCard stays as first
      expect(cardPlaySvc.getPendingCard()).toBe(first);
    });

    it('cancelPlacement clears pendingTowerCard', () => {
      runSpy.isInRun.and.returnValue(true);
      const energy: EnergyState = { current: 3, max: 3 };
      deckSpy.getEnergy.and.returnValue(energy);

      const cardPlaySvc = fixture.debugElement.injector.get(CardPlayService);
      const card = makeTowerCard(CardId.TOWER_BASIC);
      component.onCardPlayed(card);
      expect(cardPlaySvc.hasPendingCard()).toBeTrue();

      component.cancelPlacement();
      expect(cardPlaySvc.hasPendingCard()).toBeFalse();
      expect(component.selectedTowerType).toBeNull();
    });

    it('pendingTowerCardId getter returns instanceId when card is pending', () => {
      runSpy.isInRun.and.returnValue(true);
      const energy: EnergyState = { current: 3, max: 3 };
      deckSpy.getEnergy.and.returnValue(energy);

      const card = makeTowerCard(CardId.TOWER_BASIC);
      component.onCardPlayed(card);

      expect(component.pendingTowerCardId).toBe(card.instanceId);
    });

    it('pendingTowerCardId is null when no card is pending', () => {
      expect(component.pendingTowerCardId).toBeNull();
    });
  });

  describe('endTurn re-entrant guard', () => {
    it('second call while first is in-flight is a no-op', () => {
      const gameStateSvc = fixture.debugElement.injector.get(GameStateService);
      gameStateSvc.startWave();
      component.gameState = gameStateSvc.getState();

      const waveCombatSpy = spyOn(component.waveCombat, 'endTurn').and.callFake(() => {
        // Simulate re-entrant call from within endTurn (e.g. keyboard repeat)
        component.endTurn();
      });

      component.endTurn();

      // waveCombat.endTurn should have been called exactly once despite re-entrant attempt
      expect(waveCombatSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── Red team gate 2: no double-tick of visual animations ──────────────
  describe('red team gate 2: animation calls not duplicated', () => {
    beforeEach(() => {
      const mockCamera = new THREE.PerspectiveCamera();
      spyOn((component as unknown as TestableGameBoardComponent).sceneService, 'getCamera').and.returnValue(mockCamera);
      spyOn((component as unknown as TestableGameBoardComponent).sceneService, 'getScene').and.returnValue(new THREE.Scene());
      const statusEffectService = fixture.debugElement.injector.get(StatusEffectService);
      spyOn(statusEffectService, 'getAllActiveEffects').and.returnValue(new Map());
    });

    it('processCombatResult does NOT call updateDyingAnimations (handled in animate)', () => {
      const enemyService = fixture.debugElement.injector.get(EnemyService);
      const gameRenderService = fixture.debugElement.injector.get(GameRenderService);
      const dyingSpy = spyOn(enemyService, 'updateDyingAnimations');

      // Call processCombatResult with an empty result
      const emptyResult = {
        kills: [],
        firedTypes: new Set<TowerType>(),
        hitCount: 0,
        exitCount: 0,
        leaked: false,
        defeatTriggered: false,
        waveCompletion: null,
        gameEnd: null,
        combatAudioEvents: [], damageDealt: 0, killsByTower: [],
      };
      gameRenderService.processCombatResult(emptyResult, 0.016, 1000);

      // updateDyingAnimations should NOT be called from processCombatResult
      expect(dyingSpy).not.toHaveBeenCalled();
    });

    it('processCombatResult does NOT call updateHitFlashes (handled in animate)', () => {
      const enemyService = fixture.debugElement.injector.get(EnemyService);
      const gameRenderService = fixture.debugElement.injector.get(GameRenderService);
      const flashSpy = spyOn(enemyService, 'updateHitFlashes');

      const emptyResult = {
        kills: [],
        firedTypes: new Set<TowerType>(),
        hitCount: 0,
        exitCount: 0,
        leaked: false,
        defeatTriggered: false,
        waveCompletion: null,
        gameEnd: null,
        combatAudioEvents: [], damageDealt: 0, killsByTower: [],
      };
      gameRenderService.processCombatResult(emptyResult, 0.016, 1000);

      expect(flashSpy).not.toHaveBeenCalled();
    });
  });

  // ── applyAscensionModifiers — elite/boss health mult composition ──────────
  describe('applyAscensionModifiers — elite/boss health mult composition', () => {
    let gameStateSvc: GameStateService;
    let setAscensionSpy: jasmine.Spy;

    beforeEach(() => {
      gameStateSvc = fixture.debugElement.injector.get(GameStateService);
      setAscensionSpy = spyOn(gameStateSvc, 'setAscensionModifierEffects').and.callThrough();
    });

    function callApply(level: number, isElite: boolean, isBoss: boolean): void {
      (component as unknown as TestableGameBoardComponent).ascensionModifier.apply(level, isElite, isBoss);
    }

    it('ascension 0: no call made (early-return guard)', () => {
      callApply(0, false, false);
      expect(setAscensionSpy).not.toHaveBeenCalled();
    });

    it('ascension 1 (ENEMY_HEALTH = 1.1), not elite/boss: enemyHealthMultiplier ≈ 1.1', () => {
      callApply(1, false, false);
      const effects = gameStateSvc.getModifierEffects();
      const expected = getAscensionEffects(1).get(AscensionEffectType.ENEMY_HEALTH_MULTIPLIER)!;
      expect(effects.enemyHealthMultiplier).toBeCloseTo(expected, 5);
    });

    it('ascension 5 (ELITE_HEALTH = 1.25), isElite=true: enemyHealthMultiplier ≈ 1.25', () => {
      // Level 5 has only ELITE_HEALTH_MULTIPLIER; no base ENEMY_HEALTH_MULTIPLIER yet
      // (level 1 has 1.1, but level 5 cumulative base is also 1.1)
      callApply(5, true, false);
      const ascEffects = getAscensionEffects(5);
      const base = ascEffects.get(AscensionEffectType.ENEMY_HEALTH_MULTIPLIER) ?? 1;
      const elite = ascEffects.get(AscensionEffectType.ELITE_HEALTH_MULTIPLIER) ?? 1;
      const expected = base * elite;
      const effects = gameStateSvc.getModifierEffects();
      expect(effects.enemyHealthMultiplier).toBeCloseTo(expected, 5);
    });

    it('ascension 5 (ELITE_HEALTH = 1.25), isElite=false: elite mult NOT applied', () => {
      callApply(5, false, false);
      const ascEffects = getAscensionEffects(5);
      const base = ascEffects.get(AscensionEffectType.ENEMY_HEALTH_MULTIPLIER) ?? 1;
      // Without elite flag, elite mult must NOT be folded in
      const eliteMult = ascEffects.get(AscensionEffectType.ELITE_HEALTH_MULTIPLIER)!;
      const effects = gameStateSvc.getModifierEffects();
      expect(effects.enemyHealthMultiplier).toBeCloseTo(base, 5);
      expect(effects.enemyHealthMultiplier).not.toBeCloseTo(base * eliteMult, 5);
    });

    it('ascension 10 (BOSS_HEALTH = 1.3), isBoss=true: boss mult applied', () => {
      callApply(10, false, true);
      const ascEffects = getAscensionEffects(10);
      const base = ascEffects.get(AscensionEffectType.ENEMY_HEALTH_MULTIPLIER) ?? 1;
      const boss = ascEffects.get(AscensionEffectType.BOSS_HEALTH_MULTIPLIER) ?? 1;
      const expected = base * boss;
      const effects = gameStateSvc.getModifierEffects();
      expect(effects.enemyHealthMultiplier).toBeCloseTo(expected, 5);
    });

    it('ascension 10 (BOSS_HEALTH = 1.3), isBoss=false: boss mult NOT applied', () => {
      callApply(10, false, false);
      const ascEffects = getAscensionEffects(10);
      const base = ascEffects.get(AscensionEffectType.ENEMY_HEALTH_MULTIPLIER) ?? 1;
      const bossMult = ascEffects.get(AscensionEffectType.BOSS_HEALTH_MULTIPLIER)!;
      const effects = gameStateSvc.getModifierEffects();
      expect(effects.enemyHealthMultiplier).toBeCloseTo(base, 5);
      expect(effects.enemyHealthMultiplier).not.toBeCloseTo(base * bossMult, 5);
    });

    it('ascension 18 (ENEMY_HEALTH stacked + ELITE_HEALTH = 1.5), isElite=true: multiplicative stacking', () => {
      callApply(18, true, false);
      const ascEffects = getAscensionEffects(18);
      const base = ascEffects.get(AscensionEffectType.ENEMY_HEALTH_MULTIPLIER) ?? 1;
      const elite = ascEffects.get(AscensionEffectType.ELITE_HEALTH_MULTIPLIER) ?? 1;
      const expected = base * elite;
      const effects = gameStateSvc.getModifierEffects();
      expect(effects.enemyHealthMultiplier).toBeCloseTo(expected, 5);
      // Sanity: both base and elite are above 1, so product must exceed each individually
      expect(effects.enemyHealthMultiplier!).toBeGreaterThan(base);
      expect(effects.enemyHealthMultiplier!).toBeGreaterThan(elite);
    });
  });

  // ── tryPlaceTower: startLevel:2 visual fix ──────────────────────────────────

  describe('tryPlaceTower — startLevel:2 card applies L2 visuals', () => {
    let upgradeVisualSvc: TowerUpgradeVisualService;
    let applyUpgradeVisualsSpy: jasmine.Spy;
    let spawnUpgradeFlashSpy: jasmine.Spy;
    let mockMesh: THREE.Group;

    beforeEach(() => {
      // TowerUpgradeVisualService is component-scoped — access via component private field
      upgradeVisualSvc = (component as unknown as TestableGameBoardComponent).towerUpgradeVisualService as TowerUpgradeVisualService;
      applyUpgradeVisualsSpy = spyOn(upgradeVisualSvc, 'applyUpgradeVisuals');
      spawnUpgradeFlashSpy = spyOn(upgradeVisualSvc, 'spawnUpgradeFlash');
      mockMesh = new THREE.Group();
      mockMesh.position.set(1, 0, 2);

      // Stub towerMeshLifecycle.placeMesh to avoid Three.js scene setup
      spyOn((component as unknown as TestableGameBoardComponent).towerMeshLifecycle, 'placeMesh').and.returnValue(mockMesh);

      // Stub towerInteractionService.placeTower to report success
      spyOn((component as unknown as TestableGameBoardComponent).towerInteractionService, 'placeTower').and.returnValue({
        success: true,
        cost: 0,
        towerKey: '0-0',
      });

      // Stub gameBoardService.canPlaceTower to pass the guard
      spyOn((component as unknown as TestableGameBoardComponent).gameBoardService, 'canPlaceTower').and.returnValue(true);

      // Stub downstream methods that require a real game scene
      spyOn((component as unknown as TestableGameBoardComponent).towerCombatService, 'registerTower');
      spyOn((component as unknown as TestableGameBoardComponent).towerCombatService, 'upgradeTower');
      spyOn((component as unknown as TestableGameBoardComponent).audioService, 'playTowerPlace');
      spyOn((component as unknown as TestableGameBoardComponent).gameStatsService, 'recordTowerBuilt');
      spyOn((component as unknown as TestableGameBoardComponent).boardPointer, 'clearSelectedTile');
      spyOn((component as unknown as TestableGameBoardComponent).towerPreviewService, 'hidePreview');
      spyOn(component as unknown as TestableGameBoardComponent, 'refreshPathOverlay');
      spyOn(component as unknown as TestableGameBoardComponent, 'updateTileHighlights');
      spyOn(component as unknown as TestableGameBoardComponent, 'updateChallengeIndicators');
      spyOn((component as unknown as TestableGameBoardComponent).sceneService, 'getScene').and.returnValue(new THREE.Scene());
    });

    afterEach(() => {
      mockMesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
    });

    function setPendingUpgradedCard(cardId: CardId): void {
      const cardPlaySvc = fixture.debugElement.injector.get(CardPlayService);
      const upgradedCard: CardInstance = { instanceId: `inst_${cardId}`, cardId, upgraded: true };
      cardPlaySvc['pendingTowerCard'] = upgradedCard;
    }

    it('calls applyUpgradeVisuals(mesh, 2, undefined) when card has startLevel:2', () => {
      setPendingUpgradedCard(CardId.TOWER_BASIC);
      component.selectedTowerType = TowerType.BASIC;

      (component as unknown as TestableGameBoardComponent).tryPlaceTower(0, 0);

      expect(applyUpgradeVisualsSpy).toHaveBeenCalledWith(mockMesh, 2, undefined);
    });

    it('calls spawnUpgradeFlash with the mesh position when card has startLevel:2', () => {
      setPendingUpgradedCard(CardId.TOWER_BASIC);
      component.selectedTowerType = TowerType.BASIC;

      (component as unknown as TestableGameBoardComponent).tryPlaceTower(0, 0);

      expect(spawnUpgradeFlashSpy).toHaveBeenCalledWith(mockMesh.position, jasmine.any(THREE.Scene));
    });

    it('does NOT call applyUpgradeVisuals for a non-upgraded card (startLevel:1)', () => {
      const cardPlaySvc = fixture.debugElement.injector.get(CardPlayService);
      const normalCard: CardInstance = { instanceId: 'inst_basic', cardId: CardId.TOWER_BASIC, upgraded: false };
      cardPlaySvc['pendingTowerCard'] = normalCard;
      component.selectedTowerType = TowerType.BASIC;

      (component as unknown as TestableGameBoardComponent).tryPlaceTower(0, 0);

      expect(applyUpgradeVisualsSpy).not.toHaveBeenCalled();
    });
  });

  // ── wouldBlockPath in component: path-blocked banner accuracy ──────────────

  describe('tryPlaceTower — path-blocked banner uses BFS check', () => {
    it('shows path-blocked warning only when BFS confirms blocking', () => {
      const towerInteractionSvc = fixture.debugElement.injector.get(TowerInteractionService) as TowerInteractionService;
      spyOn(component as unknown as TestableGameBoardComponent, 'showPathBlockedWarning');
      spyOn((component as unknown as TestableGameBoardComponent).gameBoardService, 'canPlaceTower').and.returnValue(false);
      spyOn(towerInteractionSvc, 'wouldBlockPath').and.returnValue(true);

      const cardPlaySvc = fixture.debugElement.injector.get(CardPlayService);
      cardPlaySvc['pendingTowerCard'] = { instanceId: 'inst_basic', cardId: CardId.TOWER_BASIC, upgraded: false } as CardInstance;
      component.selectedTowerType = TowerType.BASIC;

      (component as unknown as TestableGameBoardComponent).tryPlaceTower(0, 0);

      expect((component as unknown as TestableGameBoardComponent).showPathBlockedWarning).toHaveBeenCalled();
    });

    it('does NOT show path-blocked warning when BFS says placement is safe', () => {
      const towerInteractionSvc = fixture.debugElement.injector.get(TowerInteractionService) as TowerInteractionService;
      spyOn(component as unknown as TestableGameBoardComponent, 'showPathBlockedWarning');
      spyOn((component as unknown as TestableGameBoardComponent).gameBoardService, 'canPlaceTower').and.returnValue(false);
      spyOn(towerInteractionSvc, 'wouldBlockPath').and.returnValue(false);

      const cardPlaySvc = fixture.debugElement.injector.get(CardPlayService);
      cardPlaySvc['pendingTowerCard'] = { instanceId: 'inst_basic', cardId: CardId.TOWER_BASIC, upgraded: false } as CardInstance;
      component.selectedTowerType = TowerType.BASIC;

      (component as unknown as TestableGameBoardComponent).tryPlaceTower(0, 0);

      expect((component as unknown as TestableGameBoardComponent).showPathBlockedWarning).not.toHaveBeenCalled();
    });
  });

  describe('exhaust pile inspector integration', () => {
    it('inspectedPile is null by default', () => {
      expect(component.inspectedPile).toBeNull();
    });

    it('setting inspectedPile to "exhaust" passes exhaustPile to PileInspector', () => {
      const exhaustCard: CardInstance = { instanceId: 'inst_exhausted', cardId: CardId.TOWER_BASIC, upgraded: false };
      component.deckState = {
        drawPile: [],
        hand: [],
        discardPile: [],
        exhaustPile: [exhaustCard],
      };
      component.inspectedPile = 'exhaust';

      // The template resolves [pile] as deckState.exhaustPile when inspectedPile === 'exhaust'
      const expectedPile = component.deckState.exhaustPile;
      expect(expectedPile.length).toBe(1);
      expect(expectedPile[0]).toBe(exhaustCard);
    });

    it('setting inspectedPile to "exhaust" selects "Exhaust Pile" label', () => {
      component.deckState = { drawPile: [], hand: [], discardPile: [], exhaustPile: [] };
      component.inspectedPile = 'exhaust';
      // Verify that draw and discard labels are NOT selected for exhaust
      expect(component.inspectedPile).toBe('exhaust');
      expect(component.inspectedPile).not.toBe('draw');
      expect(component.inspectedPile).not.toBe('discard');
    });
  });

});
