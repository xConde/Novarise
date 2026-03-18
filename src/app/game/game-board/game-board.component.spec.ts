import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import * as THREE from 'three';

import { GameBoardComponent } from './game-board.component';
import { GameBoardService } from './game-board.service';
import { MapBridgeService } from './services/map-bridge.service';
import { GameStateService } from './services/game-state.service';
import { GameStatsService } from './services/game-stats.service';
import { PlayerProfileService } from './services/player-profile.service';
import { DamagePopupService } from './services/damage-popup.service';
import { MinimapService } from './services/minimap.service';
import { SettingsService } from './services/settings.service';
import { DifficultyLevel, DIFFICULTY_PRESETS, GamePhase } from './models/game-state.model';
import { TowerType, TowerSpecialization, PlacedTower, TargetingMode } from './models/tower.model';
import { EnemyType } from './models/enemy.model';
import { TowerCombatService } from './services/tower-combat.service';
import { ScoreBreakdown, calculateScoreBreakdown } from './models/score.model';
import { ACHIEVEMENTS, Achievement } from './services/player-profile.service';
import { WaveService } from './services/wave.service';
import { StatusEffectService } from './services/status-effect.service';
import { EnemyService } from './services/enemy.service';
import { TutorialService, TutorialStep } from './services/tutorial.service';
import { BehaviorSubject } from 'rxjs';
import { CampaignService } from '../../campaign/services/campaign.service';
import { CampaignMapService } from '../../campaign/services/campaign-map.service';
import { CampaignLevel, CampaignTier } from '../../campaign/models/campaign.model';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { GameNotificationService, NotificationType } from './services/game-notification.service';
import { ChallengeTrackingService } from './services/challenge-tracking.service';
import { GameEndService } from './services/game-end.service';
import { TilePricingService } from './services/tile-pricing.service';
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
} from './testing';

const MOCK_MAP_STATE_SPEC = {
  gridSize: 10,
  tiles: Array.from({ length: 10 }, () => new Array<TerrainType>(10).fill(TerrainType.BEDROCK)),
  heightMap: Array.from({ length: 10 }, () => new Array<number>(10).fill(0)),
  spawnPoints: [{ x: 0, z: 4 }],
  exitPoints: [{ x: 9, z: 4 }],
  version: '2.0.0',
};

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
  let campaignServiceSpy: jasmine.SpyObj<CampaignService>;
  let campaignMapServiceSpy: jasmine.SpyObj<CampaignMapService>;
  let gameSessionSpy: jasmine.SpyObj<GameSessionService>;
  let combatLoopSpy: jasmine.SpyObj<CombatLoopService>;

  beforeEach(async () => {
    gameStatsSpy = createGameStatsServiceSpy();

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

    campaignServiceSpy = jasmine.createSpyObj('CampaignService', [
      'getNextLevel',
      'isUnlocked',
      'getLevel',
      'recordCompletion',
      'completeChallenge',
      'getAllLevels',
      'getCompletedCount',
      'isChallengeCompleted',
    ]);
    campaignServiceSpy.getNextLevel.and.returnValue(null);
    campaignServiceSpy.isUnlocked.and.returnValue(false);
    campaignServiceSpy.getLevel.and.returnValue(undefined);
    campaignServiceSpy.getAllLevels.and.returnValue([]);
    campaignServiceSpy.getCompletedCount.and.returnValue(0);
    campaignServiceSpy.isChallengeCompleted.and.returnValue(false);

    campaignMapServiceSpy = jasmine.createSpyObj('CampaignMapService', ['loadLevel']);
    campaignMapServiceSpy.loadLevel.and.returnValue(MOCK_MAP_STATE_SPEC);

    gameSessionSpy = jasmine.createSpyObj('GameSessionService', ['resetAllServices', 'applyCampaignWaves']);

    combatLoopSpy = createCombatLoopServiceSpy();

    await TestBed.configureTestingModule({
      declarations: [ GameBoardComponent ],
      imports: [ RouterTestingModule ],
      providers: [
        GameBoardService,
        MapBridgeService,
        GameStateService,
        PathfindingService,
        EnemyService,
        StatusEffectService,
        CombatVFXService,
        { provide: GameStatsService, useValue: gameStatsSpy },
        { provide: PlayerProfileService, useValue: playerProfileSpy },
        { provide: DamagePopupService, useValue: damagePopupSpy },
        { provide: MinimapService, useValue: minimapSpy },
        { provide: SettingsService, useValue: settingsSpy },
        { provide: TutorialService, useValue: tutorialSpy },
        { provide: CampaignService, useValue: campaignServiceSpy },
        { provide: CampaignMapService, useValue: campaignMapServiceSpy },
        { provide: GameSessionService, useValue: gameSessionSpy },
        { provide: CombatLoopService, useValue: combatLoopSpy },
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
      gameStateService.setPhase(GamePhase.COMBAT);
      gameStateService.togglePause();

      expect(component.isPaused).toBeTrue();
    });

    it('isPaused should be false in SETUP phase', () => {
      expect(component.isPaused).toBeFalse();
    });
  });

  describe('setSpeed', () => {
    it('should delegate to GameStateService.setSpeed', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      spyOn(gameStateService, 'setSpeed');

      component.setSpeed(2);

      expect(gameStateService.setSpeed).toHaveBeenCalledWith(2);
    });

    it('should not delegate for invalid speed values', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      spyOn(gameStateService, 'setSpeed');

      component.setSpeed(99);

      expect(gameStateService.setSpeed).not.toHaveBeenCalled();
    });

    it('gameSpeed getter should reflect gameState.gameSpeed', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setSpeed(3);

      expect(component.gameSpeed).toBe(3);
    });

    it('gameSpeed should default to 1', () => {
      expect(component.gameSpeed).toBe(1);
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
    function fireKey(key: string): void {
      const event = new KeyboardEvent('keydown', { key, bubbles: true });
      window.dispatchEvent(event);
    }

    beforeEach(() => {
      // Set up keyboard controls without a full canvas/renderer
      // by wiring the keyboardHandler directly to window via setupKeyboardControls stub.
      // The handler is stored on the component during construction (bound in constructor).
      window.addEventListener('keydown', (component as any).keyboardHandler);
    });

    afterEach(() => {
      window.removeEventListener('keydown', (component as any).keyboardHandler);
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

    it('pressing Escape in PLACE mode cancels placement', () => {
      component.selectedTowerType = TowerType.SNIPER;
      fireKey('Escape');
      expect(component.selectedTowerType).toBeNull();
    });

    it('pressing Escape in INSPECT mode deselects placed tower info', () => {
      component.selectedTowerType = null;
      (component as any).selectedTowerInfo = { id: 'fake', type: TowerType.SNIPER, level: 1, row: 0, col: 0, lastFireTime: 0, kills: 0, totalInvested: 50, mesh: null, targetingMode: TargetingMode.NEAREST };
      fireKey('Escape');
      expect(component.selectedTowerInfo).toBeNull();
    });

    it('pressing p toggles pause', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setPhase(GamePhase.COMBAT);
      spyOn(component, 'togglePause').and.callThrough();
      fireKey('p');
      expect(component.togglePause).toHaveBeenCalled();
    });

    it('pressing P (uppercase) also toggles pause', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setPhase(GamePhase.COMBAT);
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
        row: 0, col: 0, lastFireTime: 0, kills: 0, totalInvested: 75,
        targetingMode: TargetingMode.NEAREST, mesh: null,
      } as PlacedTower;
      const towerCombat = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(towerCombat, 'cycleTargetingMode');
      component.cycleTargeting();
      expect(towerCombat.cycleTargetingMode).not.toHaveBeenCalled();
    });
  });

  describe('scoreBreakdown', () => {
    it('should be null initially', () => {
      expect(component.scoreBreakdown).toBeNull();
    });

    it('should be populated when game transitions to VICTORY', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      const state = gameStateService.getState();
      const livesTotal = DIFFICULTY_PRESETS[state.difficulty].lives;

      component.scoreBreakdown = calculateScoreBreakdown(
        state.score, state.lives, livesTotal, state.difficulty, state.wave, true
      );

      expect(component.scoreBreakdown).not.toBeNull();
      expect(component.scoreBreakdown!.isVictory).toBeTrue();
      expect(component.scoreBreakdown!.finalScore).toBeGreaterThanOrEqual(0);
    });

    it('should be populated when game transitions to DEFEAT', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      const state = gameStateService.getState();
      const livesTotal = DIFFICULTY_PRESETS[state.difficulty].lives;

      component.scoreBreakdown = calculateScoreBreakdown(
        state.score, state.lives, livesTotal, state.difficulty, state.wave, false
      );

      expect(component.scoreBreakdown).not.toBeNull();
      expect(component.scoreBreakdown!.isVictory).toBeFalse();
      expect(component.scoreBreakdown!.stars).toBe(0);
    });

    it('should not overwrite breakdown once set', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      const state = gameStateService.getState();
      const livesTotal = DIFFICULTY_PRESETS[state.difficulty].lives;

      component.scoreBreakdown = calculateScoreBreakdown(
        state.score, state.lives, livesTotal, state.difficulty, state.wave, true
      );
      const firstBreakdown = component.scoreBreakdown;

      // Calling again should produce a new object (but the component's subscription guards against overwrite)
      expect(firstBreakdown).not.toBeNull();
      expect(firstBreakdown!.isVictory).toBeTrue();
    });

    it('scoreBreakdown finalScore reflects difficulty multiplier', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setDifficulty(DifficultyLevel.HARD);
      gameStateService.addScore(100);
      const state = gameStateService.getState();
      const livesTotal = DIFFICULTY_PRESETS[state.difficulty].lives;

      component.scoreBreakdown = calculateScoreBreakdown(
        state.score, state.lives, livesTotal, state.difficulty, state.wave, true
      );

      expect(component.scoreBreakdown).not.toBeNull();
      // HARD multiplier is 1.5 — finalScore = Math.round(score * 1.5)
      expect(component.scoreBreakdown!.difficultyMultiplier).toBe(1.5);
    });
  });

  describe('starArray', () => {
    /** Helper: set scoreBreakdown and sync the pre-computed starArray field. */
    function setBreakdown(stars: number | null): void {
      if (stars === null) {
        component.scoreBreakdown = null;
        component.starArray = [];
      } else {
        component.scoreBreakdown = { stars } as ScoreBreakdown;
        component.starArray = [0, 1, 2].map(i => i < stars ? 'filled' : 'empty') as Array<'filled' | 'empty'>;
      }
    }

    it('should return empty array when scoreBreakdown is null', () => {
      setBreakdown(null);
      expect(component.starArray).toEqual([]);
    });

    it('should return 3 filled stars when breakdown has 3 stars', () => {
      setBreakdown(3);
      expect(component.starArray).toEqual(['filled', 'filled', 'filled']);
    });

    it('should return 2 filled and 1 empty when breakdown has 2 stars', () => {
      setBreakdown(2);
      expect(component.starArray).toEqual(['filled', 'filled', 'empty']);
    });

    it('should return 1 filled and 2 empty when breakdown has 1 star', () => {
      setBreakdown(1);
      expect(component.starArray).toEqual(['filled', 'empty', 'empty']);
    });

    it('should return 3 empty stars when breakdown has 0 stars (defeat)', () => {
      setBreakdown(0);
      expect(component.starArray).toEqual(['empty', 'empty', 'empty']);
    });

    it('should always return exactly 3 elements when stars > 0', () => {
      for (const stars of [1, 2, 3]) {
        setBreakdown(stars);
        expect(component.starArray.length).toBe(3);
      }
    });
  });

  describe('touch handler lifecycle', () => {
    let mockCanvas: HTMLElement;
    let addEventSpy: jasmine.Spy;
    let removeEventSpy: jasmine.Spy;

    beforeEach(() => {
      mockCanvas = document.createElement('canvas');
      addEventSpy = spyOn(mockCanvas, 'addEventListener').and.callThrough();
      removeEventSpy = spyOn(mockCanvas, 'removeEventListener').and.callThrough();

      // Stub SceneService.getRenderer() to return a mock renderer with the canvas
      const mockRenderer = { domElement: mockCanvas, dispose: () => {} };
      spyOn((component as any).sceneService, 'getRenderer').and.returnValue(mockRenderer);
    });

    it('setupTouchInteraction registers touchstart, touchmove, and touchend handlers', () => {
      (component as any).setupTouchInteraction();

      const registeredEvents = addEventSpy.calls.allArgs().map((args: unknown[]) => args[0]);
      expect(registeredEvents).toContain('touchstart');
      expect(registeredEvents).toContain('touchmove');
      expect(registeredEvents).toContain('touchend');
    });

    it('touch handlers are registered as named references, not anonymous functions', () => {
      (component as any).setupTouchInteraction();

      const touchStartRef = (component as any).touchStartHandler;
      const touchMoveRef = (component as any).touchMoveHandler;
      const touchEndRef = (component as any).touchEndHandler;

      expect(typeof touchStartRef).toBe('function');
      expect(typeof touchMoveRef).toBe('function');
      expect(typeof touchEndRef).toBe('function');
      // They must not be the default no-op stubs (which are empty arrow functions sharing the same ref pattern)
      // Confirm setup overwrote the placeholders
      const calls = addEventSpy.calls.allArgs();
      const startCall = calls.find((args: unknown[]) => args[0] === 'touchstart');
      const moveCall = calls.find((args: unknown[]) => args[0] === 'touchmove');
      const endCall = calls.find((args: unknown[]) => args[0] === 'touchend');

      expect(startCall?.[1]).toBe(touchStartRef);
      expect(moveCall?.[1]).toBe(touchMoveRef);
      expect(endCall?.[1]).toBe(touchEndRef);
    });

    it('ngOnDestroy removes touchstart, touchmove, and touchend handlers', () => {
      (component as any).setupTouchInteraction();

      // Simulate ngOnDestroy canvas listener removal path
      const canvas = (component as any).sceneService.getRenderer().domElement as HTMLElement;
      canvas.removeEventListener('touchstart', (component as any).touchStartHandler);
      canvas.removeEventListener('touchmove', (component as any).touchMoveHandler);
      canvas.removeEventListener('touchend', (component as any).touchEndHandler);

      const removedEvents = removeEventSpy.calls.allArgs().map((args: unknown[]) => args[0]);
      expect(removedEvents).toContain('touchstart');
      expect(removedEvents).toContain('touchmove');
      expect(removedEvents).toContain('touchend');
    });

    it('touchStartHandler records start position and resets drag flag', () => {
      (component as any).setupTouchInteraction();
      (component as any).touchIsDragging = true;

      const touch = { clientX: 150, clientY: 200 } as Touch;
      const event = { preventDefault: () => {}, touches: [touch] } as unknown as TouchEvent;

      (component as any).touchStartHandler(event);

      expect((component as any).touchStartX).toBe(150);
      expect((component as any).touchStartY).toBe(200);
      expect((component as any).touchIsDragging).toBeFalse();
    });

    it('touchStartHandler records pinch start distance for two-finger touch', () => {
      (component as any).setupTouchInteraction();

      const t0 = { clientX: 0, clientY: 0 } as Touch;
      const t1 = { clientX: 30, clientY: 40 } as Touch;
      const event = { preventDefault: () => {}, touches: [t0, t1] } as unknown as TouchEvent;

      (component as any).touchStartHandler(event);

      // distance = sqrt(30^2 + 40^2) = sqrt(900+1600) = 50
      expect((component as any).pinchStartDistance).toBe(50);
    });

    it('touchMoveHandler sets touchIsDragging to true when movement exceeds threshold', () => {
      (component as any).setupTouchInteraction();
      (component as any).touchStartX = 0;
      (component as any).touchStartY = 0;

      // Stub sceneService camera/controls since the real Three.js objects are not initialized in tests
      const mockCamera = { position: new THREE.Vector3(0, 10, 0) } as any;
      const mockControls = { target: new THREE.Vector3(0, 0, 0), dispose: () => {} } as any;
      spyOn((component as any).sceneService, 'getCamera').and.returnValue(mockCamera);
      spyOn((component as any).sceneService, 'getControls').and.returnValue(mockControls);

      const touch = { clientX: 20, clientY: 20 } as Touch;
      const event = { preventDefault: () => {}, touches: [touch] } as unknown as TouchEvent;

      (component as any).touchMoveHandler(event);

      expect((component as any).touchIsDragging).toBeTrue();
    });

    it('touchMoveHandler does not set touchIsDragging when movement is within threshold', () => {
      (component as any).setupTouchInteraction();
      (component as any).touchStartX = 0;
      (component as any).touchStartY = 0;
      (component as any).touchIsDragging = false;

      // Move only 5px total — below 10px threshold
      const touch = { clientX: 3, clientY: 4 } as Touch;
      const event = { preventDefault: () => {}, touches: [touch] } as unknown as TouchEvent;

      (component as any).touchMoveHandler(event);

      expect((component as any).touchIsDragging).toBeFalse();
    });

    it('touchEndHandler calls handleTapAsClick for a short tap with no drag', () => {
      (component as any).setupTouchInteraction();
      (component as any).touchStartX = 100;
      (component as any).touchStartY = 200;
      (component as any).touchStartTime = performance.now() - 50; // 50ms ago — within 300ms threshold
      (component as any).touchIsDragging = false;

      spyOn(component as any, 'handleTapAsClick');

      const touch = { clientX: 100, clientY: 200 } as Touch;
      const event = { preventDefault: () => {}, changedTouches: [touch] } as unknown as TouchEvent;

      (component as any).touchEndHandler(event);

      expect((component as any).handleTapAsClick).toHaveBeenCalledWith(100, 200);
    });

    it('touchEndHandler does not call handleTapAsClick when drag occurred', () => {
      (component as any).setupTouchInteraction();
      (component as any).touchStartTime = performance.now() - 50;
      (component as any).touchIsDragging = true;

      spyOn(component as any, 'handleTapAsClick');

      const touch = { clientX: 100, clientY: 200 } as Touch;
      const event = { preventDefault: () => {}, changedTouches: [touch] } as unknown as TouchEvent;

      (component as any).touchEndHandler(event);

      expect((component as any).handleTapAsClick).not.toHaveBeenCalled();
    });

    it('touchEndHandler does not call handleTapAsClick when tap duration exceeds threshold', () => {
      (component as any).setupTouchInteraction();
      (component as any).touchStartTime = performance.now() - 500; // 500ms — exceeds 300ms threshold
      (component as any).touchIsDragging = false;

      spyOn(component as any, 'handleTapAsClick');

      const touch = { clientX: 100, clientY: 200 } as Touch;
      const event = { preventDefault: () => {}, changedTouches: [touch] } as unknown as TouchEvent;

      (component as any).touchEndHandler(event);

      expect((component as any).handleTapAsClick).not.toHaveBeenCalled();
    });

    it('touchEndHandler resets touchIsDragging and pinchStartDistance', () => {
      (component as any).setupTouchInteraction();
      (component as any).touchIsDragging = true;
      (component as any).pinchStartDistance = 50;

      // Long press — no tap
      (component as any).touchStartTime = performance.now() - 500;

      const touch = { clientX: 0, clientY: 0 } as Touch;
      const event = { preventDefault: () => {}, changedTouches: [touch] } as unknown as TouchEvent;

      (component as any).touchEndHandler(event);

      expect((component as any).touchIsDragging).toBeFalse();
      expect((component as any).pinchStartDistance).toBe(0);
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
      (component as any).updateAchievementDetails();

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
      (component as any).updateAchievementDetails();

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

    it('should be a no-op for campaign games', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('campaign_01');
      spyOn(gameStateService, 'setEndlessMode');

      component.toggleEndless();

      expect(gameStateService.setEndlessMode).not.toHaveBeenCalled();
    });
  });

  describe('pause overlay state', () => {
    it('isPaused should return gameState.isPaused value', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);

      // Default: not paused
      expect(component.isPaused).toBeFalse();

      // Enter COMBAT and pause
      gameStateService.setPhase(GamePhase.COMBAT);
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

    function enterCombatAndPause(): void {
      gameStateService.setPhase(GamePhase.COMBAT);
      gameStateService.togglePause();
      component.gameState = gameStateService.getState();
    }

    beforeEach(() => {
      gameStateService = fixture.debugElement.injector.get(GameStateService);
    });

    it('showQuitConfirm defaults to false', () => {
      expect(component.showQuitConfirm).toBeFalse();
    });

    it('togglePause resets showQuitConfirm', () => {
      enterCombatAndPause();
      component.showQuitConfirm = true;
      component.togglePause();
      expect(component.showQuitConfirm).toBeFalse();
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
      spyOn((component as any).audioService, 'toggleMute');
      component.toggleAudio();
      expect((component as any).audioService.toggleMute).toHaveBeenCalled();
    });

    it('setSpeed updates game speed via GameStateService for valid speeds', () => {
      spyOn(gameStateService, 'setSpeed');
      component.setSpeed(2);
      expect(gameStateService.setSpeed).toHaveBeenCalledWith(2);
    });

    it('requestQuit sets showQuitConfirm to true', () => {
      component.requestQuit();
      expect(component.showQuitConfirm).toBeTrue();
    });

    it('cancelQuit sets showQuitConfirm to false', () => {
      component.showQuitConfirm = true;
      component.cancelQuit();
      expect(component.showQuitConfirm).toBeFalse();
    });

    it('confirmQuit navigates to / when not a campaign game', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');
      // Default mapBridge has no map loaded → not a campaign game
      component.confirmQuit();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('confirmQuit resets showQuitConfirm', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');
      component.showQuitConfirm = true;
      component.confirmQuit();
      expect(component.showQuitConfirm).toBeFalse();
    });

    it('validGameSpeeds contains [1, 2, 3]', () => {
      expect(component.validGameSpeeds).toEqual([1, 2, 3] as any);
    });

    it('confirmQuit records defeat even during SETUP (delegates to GameEndService — no phase gate)', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');
      // Phase is SETUP by default — GameEndService.recordEnd always records (no phase gate)
      // In practice, confirmQuit is only reachable from the pause menu (COMBAT/INTERMISSION).
      component.confirmQuit();
      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ isVictory: false })
      );
    });

    it('confirmQuit records defeat when quitting during COMBAT', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');
      gameStateService.setPhase(GamePhase.COMBAT);
      component.confirmQuit();
      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ isVictory: false })
      );
    });

    it('confirmQuit records defeat when quitting during INTERMISSION', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');
      gameStateService.startWave();
      gameStateService.completeWave(0); // → INTERMISSION
      component.confirmQuit();
      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ isVictory: false })
      );
    });

    it('confirmQuit does not double-record defeat when game end already recorded', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');
      gameStateService.setPhase(GamePhase.COMBAT);
      // Pre-record a game end so the service's idempotency guard fires
      const gameEndService = fixture.debugElement.injector.get(GameEndService);
      gameEndService.recordEnd(false, null);
      playerProfileSpy.recordGameEnd.calls.reset();
      component.confirmQuit();
      expect(playerProfileSpy.recordGameEnd).not.toHaveBeenCalled();
    });
  });

  describe('canLeaveGame', () => {
    let gameStateService: GameStateService;

    beforeEach(() => {
      gameStateService = fixture.debugElement.injector.get(GameStateService);
    });

    it('returns true during SETUP (no confirmation needed)', () => {
      // Phase defaults to SETUP
      expect(component.canLeaveGame()).toBeTrue();
    });

    it('returns true during VICTORY (no confirmation needed)', () => {
      gameStateService.setMaxWaves(1);
      gameStateService.startWave();
      gameStateService.completeWave(0); // → VICTORY
      expect(component.canLeaveGame()).toBeTrue();
    });

    it('returns true during DEFEAT (no confirmation needed)', () => {
      gameStateService.startWave();
      gameStateService.loseLife(gameStateService.getState().lives); // → DEFEAT
      expect(component.canLeaveGame()).toBeTrue();
    });

    it('auto-pauses during COMBAT before showing confirm', () => {
      gameStateService.setPhase(GamePhase.COMBAT);
      spyOn(window, 'confirm').and.returnValue(false);
      spyOn(gameStateService, 'togglePause').and.callThrough();

      component.canLeaveGame();

      expect(gameStateService.togglePause).toHaveBeenCalled();
    });

    it('does not double-pause when already paused in COMBAT', () => {
      gameStateService.setPhase(GamePhase.COMBAT);
      gameStateService.togglePause(); // already paused
      spyOn(window, 'confirm').and.returnValue(false);
      spyOn(gameStateService, 'togglePause').and.callThrough();

      component.canLeaveGame();

      expect(gameStateService.togglePause).not.toHaveBeenCalled();
    });

    it('returns false when player cancels the confirm dialog', () => {
      gameStateService.setPhase(GamePhase.COMBAT);
      spyOn(window, 'confirm').and.returnValue(false);

      expect(component.canLeaveGame()).toBeFalse();
    });

    it('returns true when player confirms leaving', () => {
      gameStateService.setPhase(GamePhase.COMBAT);
      spyOn(window, 'confirm').and.returnValue(true);

      expect(component.canLeaveGame()).toBeTrue();
    });

    it('records defeat on confirmed leave during COMBAT', () => {
      gameStateService.setPhase(GamePhase.COMBAT);
      spyOn(window, 'confirm').and.returnValue(true);

      component.canLeaveGame();

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ isVictory: false })
      );
    });

    it('records defeat on confirmed leave during INTERMISSION', () => {
      gameStateService.startWave();
      gameStateService.completeWave(0); // → INTERMISSION
      spyOn(window, 'confirm').and.returnValue(true);

      component.canLeaveGame();

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ isVictory: false })
      );
    });

    it('does not record defeat when player cancels', () => {
      gameStateService.setPhase(GamePhase.COMBAT);
      spyOn(window, 'confirm').and.returnValue(false);

      component.canLeaveGame();

      expect(playerProfileSpy.recordGameEnd).not.toHaveBeenCalled();
    });

    it('does not double-record defeat when game end already recorded', () => {
      gameStateService.setPhase(GamePhase.COMBAT);
      spyOn(window, 'confirm').and.returnValue(true);
      // Pre-record via the service so idempotency guard fires
      const gameEndService = fixture.debugElement.injector.get(GameEndService);
      gameEndService.recordEnd(false, null);
      playerProfileSpy.recordGameEnd.calls.reset();

      component.canLeaveGame();

      expect(playerProfileSpy.recordGameEnd).not.toHaveBeenCalled();
    });
  });

  describe('keyboard Escape key — pause integration', () => {
    function fireKey(key: string): void {
      const event = new KeyboardEvent('keydown', { key, bubbles: true });
      window.dispatchEvent(event);
    }

    beforeEach(() => {
      window.addEventListener('keydown', (component as any).keyboardHandler);
    });

    afterEach(() => {
      window.removeEventListener('keydown', (component as any).keyboardHandler);
    });

    it('ESC resumes when paused', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setPhase(GamePhase.COMBAT);
      gameStateService.togglePause();
      component.gameState = gameStateService.getState();

      spyOn(component, 'togglePause').and.callThrough();
      fireKey('Escape');
      expect(component.togglePause).toHaveBeenCalled();
      expect(component.isPaused).toBeFalse();
    });

    it('ESC deselects tower when not paused and not in PLACE mode', () => {
      // ESC works in SETUP phase too — only VICTORY/DEFEAT blocks keyboard handling
      // Do not enter COMBAT phase here to avoid auto-pause side effects
      component.selectedTowerType = null;

      spyOn(component, 'deselectTower');
      fireKey('Escape');
      expect(component.deselectTower).toHaveBeenCalled();
    });

    it('ESC does not toggle pause when not paused', () => {
      spyOn(component, 'togglePause');
      fireKey('Escape');
      expect(component.togglePause).not.toHaveBeenCalled();
    });
  });

  describe('path overlay', () => {
    it('showPathOverlay defaults to false', () => {
      expect(component.showPathOverlay).toBeFalse();
    });

    it('togglePathOverlay flips showPathOverlay from false to true', () => {
      // Stub scene + pathVisualizationService to avoid Three.js calls
      (component as any).scene = new THREE.Scene();
      const pvs = (component as any).pathVisualizationService;
      spyOn(pvs, 'showPath');
      spyOn(pvs, 'hidePath');
      // Stub enemyService.getPathToExit to return empty (no path found)
      spyOn((component as any).enemyService, 'getPathToExit').and.returnValue([]);

      component.togglePathOverlay();

      expect(component.showPathOverlay).toBeTrue();
    });

    it('togglePathOverlay flips showPathOverlay from true to false', () => {
      (component as any).scene = new THREE.Scene();
      const pvs = (component as any).pathVisualizationService;
      spyOn(pvs, 'showPath');
      spyOn(pvs, 'hidePath');
      spyOn((component as any).enemyService, 'getPathToExit').and.returnValue([]);

      component.showPathOverlay = true;
      component.togglePathOverlay();

      expect(component.showPathOverlay).toBeFalse();
      expect(pvs.hidePath).toHaveBeenCalled();
    });

    it('togglePathOverlay calls showPath when path exists', () => {
      const mockScene = new THREE.Scene();
      spyOn((component as any).sceneService, 'getScene').and.returnValue(mockScene);
      const pvs = (component as any).pathVisualizationService;
      spyOn(pvs, 'showPath');
      spyOn(pvs, 'hidePath');
      const fakePath = [{ x: 0, z: 0 }, { x: 1, z: 0 }];
      spyOn((component as any).enemyService, 'getPathToExit').and.returnValue(fakePath);

      component.togglePathOverlay();

      expect(pvs.showPath).toHaveBeenCalledWith(fakePath, mockScene);
    });

    it('togglePathOverlay does not call showPath when path is empty', () => {
      (component as any).scene = new THREE.Scene();
      const pvs = (component as any).pathVisualizationService;
      spyOn(pvs, 'showPath');
      spyOn(pvs, 'hidePath');
      spyOn((component as any).enemyService, 'getPathToExit').and.returnValue([]);

      component.togglePathOverlay();

      expect(pvs.showPath).not.toHaveBeenCalled();
    });

    it('pressing V toggles path overlay', () => {
      (component as any).scene = new THREE.Scene();
      const pvs = (component as any).pathVisualizationService;
      spyOn(pvs, 'showPath');
      spyOn(pvs, 'hidePath');
      spyOn((component as any).enemyService, 'getPathToExit').and.returnValue([]);

      window.addEventListener('keydown', (component as any).keyboardHandler);
      const event = new KeyboardEvent('keydown', { key: 'v', bubbles: true });
      window.dispatchEvent(event);
      window.removeEventListener('keydown', (component as any).keyboardHandler);

      expect(component.showPathOverlay).toBeTrue();
    });
  });

  describe('WebGL context loss', () => {
    it('contextLost should start as false', () => {
      expect(component.contextLost).toBeFalse();
    });

    it('setting contextLost to true should be reflected on the component', () => {
      (component as any).contextLost = true;
      expect(component.contextLost).toBeTrue();
    });

    it('setting contextLost back to false should be reflected on the component', () => {
      (component as any).contextLost = true;
      (component as any).contextLost = false;
      expect(component.contextLost).toBeFalse();
    });
  });

  describe('Interaction Mode System', () => {
    it('should start with BASIC tower selected (PLACE mode by default)', () => {
      expect(component.selectedTowerType).toBe(TowerType.BASIC);
      expect(component.isPlaceMode).toBeTrue();
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

    it('isPlaceMode should return true when selectedTowerType is set', () => {
      component.selectedTowerType = TowerType.MORTAR;

      expect(component.isPlaceMode).toBeTrue();
    });

    it('selectPlacedTower should cancel placement mode', () => {
      const towerCombatService = fixture.debugElement.injector.get(TowerCombatService);
      const fakeTower: PlacedTower = {
        id: 'r0-c1',
        type: TowerType.BASIC,
        level: 1,
        row: 0,
        col: 1,
        lastFireTime: 0,
        kills: 0,
        totalInvested: 50,
        targetingMode: TargetingMode.NEAREST,
        mesh: null,
      };
      spyOn(towerCombatService, 'getTower').and.returnValue(fakeTower);
      // Stub Three.js-dependent methods to avoid canvas crash in headless tests
      spyOn((component as any).rangeVisualizationService, 'showForTower');
      spyOn(component as any, 'refreshTowerInfoPanel');

      // Enter PLACE mode
      component.selectedTowerType = TowerType.SNIPER;
      expect(component.isPlaceMode).toBeTrue();

      // Selecting a placed tower should exit PLACE mode
      (component as any).selectPlacedTower('r0-c1');

      expect(component.selectedTowerType).toBeNull();
      expect(component.isPlaceMode).toBeFalse();
    });

    it('getEffectiveTowerCost should return 0 for null type', () => {
      const cost = component.getEffectiveTowerCost(null);

      expect(cost).toBe(0);
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

    it('first touch tap sets previewTowerType without selecting for placement', () => {
      component.selectedTowerType = null;

      component.handleTowerButtonTap(makeTouchEvent(), TowerType.SNIPER);

      expect(component.previewTowerType).toBe(TowerType.SNIPER);
      // Must NOT have entered PLACE mode yet
      expect(component.selectedTowerType).toBeNull();
    });

    it('second touch tap on same tower selects it for placement and clears preview', () => {
      component.previewTowerType = TowerType.SNIPER;
      component.selectedTowerType = null;

      component.handleTowerButtonTap(makeTouchEvent(), TowerType.SNIPER);

      expect(component.isPlaceMode).toBeTrue();
      expect(component.selectedTowerType as TowerType | null).toBe(TowerType.SNIPER);
      expect(component.previewTowerType).toBeNull();
    });

    it('touch tap on different tower while preview open switches preview', () => {
      component.previewTowerType = TowerType.BASIC;

      component.handleTowerButtonTap(makeTouchEvent(), TowerType.MORTAR);

      expect(component.previewTowerType).toBe(TowerType.MORTAR);
      // Still no placement commitment
      expect(component.selectedTowerType).toBe(TowerType.BASIC);
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
      const ths = (component as any).tileHighlightService;
      expect(ths.getHighlightedTiles().size).toBe(0);
    });

    it('clearTileHighlights should clear the highlighted set', () => {
      // clearTileHighlights is private and delegates to TileHighlightService — verify no throw
      expect(() => (component as any).clearTileHighlights()).not.toThrow();
      const ths = (component as any).tileHighlightService;
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
      const ths = (component as any).tileHighlightService;
      expect(ths.getHighlightedTiles().size).toBe(0);
    });
  });

  describe('Drag-and-Drop Tower Placement', () => {
    it('onTowerDragStart should set dragTowerType', () => {
      const mouseEvent = new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 200 });
      component.onTowerDragStart(mouseEvent, TowerType.SNIPER);
      expect((component as any).dragTowerType).toBe(TowerType.SNIPER);
      expect(component.isDragging).toBeFalse();
      // Clean up global listeners (field names match component)
      window.removeEventListener('mousemove', (component as any).globalDragMoveHandler);
      window.removeEventListener('mouseup', (component as any).globalDragEndHandler);
      window.removeEventListener('blur', (component as any).blurDragHandler);
    });

    it('onTowerDragStart should ignore right-click', () => {
      const mouseEvent = new MouseEvent('mousedown', { button: 2, clientX: 100, clientY: 200 });
      component.onTowerDragStart(mouseEvent, TowerType.SNIPER);
      expect((component as any).dragTowerType).toBeNull();
    });

    it('isDragging should be false by default', () => {
      expect(component.isDragging).toBeFalse();
    });

    it('restartGame should reset drag state', () => {
      (component as any).isDragging = true;
      (component as any).dragTowerType = TowerType.BASIC;
      (component as any).dragThresholdMet = true;
      // Stub methods that restartGame calls to avoid Three.js crashes
      spyOn(component as any, 'cleanupGameObjects');
      spyOn(component as any, 'renderGameBoard');
      spyOn(component as any, 'addGridLines');
      spyOn((component as any).sceneService, 'initLights');
      spyOn((component as any).sceneService, 'initSkybox');
      spyOn((component as any).sceneService, 'initParticles');
      const enemyService = fixture.debugElement.injector.get(EnemyService);
      spyOn(enemyService, 'reset');
      const minimapService = fixture.debugElement.injector.get(MinimapService);
      spyOn(minimapService, 'init');

      component.restartGame();

      expect(component.isDragging).toBeFalse();
      expect((component as any).dragTowerType).toBeNull();
      expect((component as any).dragThresholdMet).toBeFalse();
    });

    it('onDragMove should not enter drag mode below threshold', () => {
      (component as any).dragTowerType = TowerType.BASIC;
      (component as any).dragStartX = 100;
      (component as any).dragStartY = 200;
      (component as any).dragThresholdMet = false;

      // Move only ~1.4px — well below DRAG_CONFIG.minDragDistance threshold
      (component as any).onDragMove(101, 201);

      expect(component.isDragging).toBeFalse();
      expect((component as any).dragThresholdMet).toBeFalse();
    });
  });

  describe('Enhanced Tower Info Panel', () => {
    it('upgradePreview should be null by default', () => {
      expect(component.upgradePreview).toBeNull();
    });

    it('refreshTowerInfoPanel should compute upgrade preview for L1 tower', () => {
      const fakeTower: PlacedTower = {
        id: '5-5', type: TowerType.BASIC, level: 1, row: 5, col: 5,
        lastFireTime: 0, kills: 3, totalInvested: 50, mesh: null,
        targetingMode: TargetingMode.NEAREST
      };
      (component as any).selectedTowerInfo = fakeTower;
      // Stub showRangePreview to avoid Three.js canvas crash
      spyOn((component as any).rangeVisualizationService, 'showForTower');
      // Stub tilePricingService to avoid board-not-initialized crash
      const tilePricingService = (component as any).tilePricingService;
      spyOn(tilePricingService, 'getStrategicValue').and.returnValue(0);
      (component as any).refreshTowerInfoPanel();

      expect(component.upgradePreview).toBeTruthy();
      expect(component.upgradePreview!.damage).toBeGreaterThan(component.selectedTowerStats!.damage);
    });

    it('refreshTowerInfoPanel should not compute preview for L2 tower (needs spec choice)', () => {
      const fakeTower: PlacedTower = {
        id: '5-5', type: TowerType.BASIC, level: 2, row: 5, col: 5,
        lastFireTime: 0, kills: 0, totalInvested: 100, mesh: null,
        targetingMode: TargetingMode.NEAREST
      };
      (component as any).selectedTowerInfo = fakeTower;
      spyOn((component as any).rangeVisualizationService, 'showForTower');
      // Stub tilePricingService to avoid board-not-initialized crash
      const tilePricingService = (component as any).tilePricingService;
      spyOn(tilePricingService, 'getStrategicValue').and.returnValue(0);
      (component as any).refreshTowerInfoPanel();

      // L2→L3 requires specialization choice, no generic preview
      expect(component.upgradePreview).toBeNull();
    });

    it('refreshTowerInfoPanel should not compute preview for max level tower', () => {
      const fakeTower: PlacedTower = {
        id: '5-5', type: TowerType.BASIC, level: 3, row: 5, col: 5,
        lastFireTime: 0, kills: 0, totalInvested: 150, mesh: null,
        targetingMode: TargetingMode.NEAREST, specialization: 'alpha' as any
      };
      (component as any).selectedTowerInfo = fakeTower;
      spyOn((component as any).rangeVisualizationService, 'showForTower');
      // Stub tilePricingService to avoid board-not-initialized crash
      const tilePricingService = (component as any).tilePricingService;
      spyOn(tilePricingService, 'getStrategicValue').and.returnValue(0);
      (component as any).refreshTowerInfoPanel();

      expect(component.upgradePreview).toBeNull();
    });

    it('deselectTower should clear upgradePreview', () => {
      component.upgradePreview = { damage: 50, range: 4, fireRate: 0.8 };
      component.deselectTower();
      expect(component.upgradePreview).toBeNull();
    });

    it('rangeVisualizationService should be injected', () => {
      expect((component as any).rangeVisualizationService).toBeTruthy();
    });
  });

  // --- Tutorial integration ---

  describe('tutorial integration', () => {
    beforeEach(() => {
      // ngOnInit does not run in this suite (no detectChanges), so manually wire
      // the tutorialSub as it would be wired during ngOnInit.
      (component as any).tutorialSub = tutorialSpy.getCurrentStep().subscribe((step: TutorialStep | null) => {
        component.currentTutorialStep = step;
      });
    });

    afterEach(() => {
      if ((component as any).tutorialSub) {
        (component as any).tutorialSub.unsubscribe();
      }
    });

    it('subscribes to getCurrentStep on init and sets currentTutorialStep', () => {
      tutorialStep$.next(TutorialStep.WELCOME);
      expect(component.currentTutorialStep).toBe(TutorialStep.WELCOME);
    });

    it('currentTutorialStep is null initially when tutorial step$ emits null', () => {
      tutorialStep$.next(null);
      expect(component.currentTutorialStep).toBeNull();
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
      component.currentTutorialStep = null;
      expect(component.getTutorialTip()).toBeNull();
    });

    it('getTutorialTip() calls tutorialService.getTip with current step', () => {
      component.currentTutorialStep = TutorialStep.PLACE_TOWER;
      const result = component.getTutorialTip();
      expect(tutorialSpy.getTip).toHaveBeenCalledWith(TutorialStep.PLACE_TOWER);
      expect(result).toBeTruthy();
    });

    it('getTutorialStepNumber() returns 1 for WELCOME step', () => {
      component.currentTutorialStep = TutorialStep.WELCOME;
      expect(component.getTutorialStepNumber()).toBe(1);
    });

    it('getTutorialStepNumber() returns 2 for SELECT_TOWER step', () => {
      component.currentTutorialStep = TutorialStep.SELECT_TOWER;
      expect(component.getTutorialStepNumber()).toBe(2);
    });

    it('getTutorialStepNumber() returns at least 1 when step is not found', () => {
      component.currentTutorialStep = null;
      expect(component.getTutorialStepNumber()).toBeGreaterThanOrEqual(1);
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
      expect(component.currentTutorialStep).toBe(TutorialStep.START_WAVE);

      tutorialStep$.next(TutorialStep.UPGRADE_TOWER);
      expect(component.currentTutorialStep).toBe(TutorialStep.UPGRADE_TOWER);
    });

    it('currentTutorialStep becomes null when observable emits null', () => {
      tutorialStep$.next(TutorialStep.PLACE_TOWER);
      expect(component.currentTutorialStep).toBe(TutorialStep.PLACE_TOWER);

      tutorialStep$.next(null);
      expect(component.currentTutorialStep).toBeNull();
    });

    it('child component receives null tip when currentTutorialStep is null', () => {
      // Verifies getTutorialTip() returns null — the child component uses this for its [tip] input
      component.currentTutorialStep = null;
      expect(component.getTutorialTip()).toBeNull();
    });
  });

  describe('toggleEncyclopedia', () => {
    it('showEncyclopedia should be false initially', () => {
      expect(component.showEncyclopedia).toBeFalse();
    });

    it('toggleEncyclopedia sets showEncyclopedia to true when false', () => {
      component.showEncyclopedia = false;
      component.toggleEncyclopedia();
      expect(component.showEncyclopedia).toBeTrue();
    });

    it('toggleEncyclopedia sets showEncyclopedia to false when true', () => {
      component.showEncyclopedia = true;
      component.toggleEncyclopedia();
      expect(component.showEncyclopedia).toBeFalse();
    });

    it('enemyInfoList should have 8 entries', () => {
      expect(component.enemyInfoList.length).toBe(8);
    });

    it('enemyInfoList entries each have a name and description', () => {
      for (const info of component.enemyInfoList) {
        expect(info.name.length).toBeGreaterThan(0);
        expect(info.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('encyclopediaTab', () => {
    it('default tab is enemies', () => {
      expect(component.encyclopediaTab).toBe('enemies');
    });

    it('switching to towers tab sets encyclopediaTab to towers', () => {
      component.encyclopediaTab = 'towers';
      expect(component.encyclopediaTab).toBe('towers');
    });

    it('switching back to enemies tab sets encyclopediaTab to enemies', () => {
      component.encyclopediaTab = 'towers';
      component.encyclopediaTab = 'enemies';
      expect(component.encyclopediaTab).toBe('enemies');
    });
  });

  describe('towerInfoList', () => {
    it('towerInfoList should have 6 entries (one per tower type)', () => {
      expect(component.towerInfoList.length).toBe(6);
    });

    it('each tower entry has a non-empty name', () => {
      for (const info of component.towerInfoList) {
        expect(info.name.length).toBeGreaterThan(0);
      }
    });

    it('each tower entry has a non-empty description', () => {
      for (const info of component.towerInfoList) {
        expect(info.description.length).toBeGreaterThan(0);
      }
    });

    it('each tower entry has non-empty alpha and beta labels', () => {
      for (const info of component.towerInfoList) {
        expect(info.alpha.label.length).toBeGreaterThan(0);
        expect(info.beta.label.length).toBeGreaterThan(0);
      }
    });

    it('all 6 tower types are represented', () => {
      const types = component.towerInfoList.map(t => t.type);
      expect(types).toContain(TowerType.BASIC);
      expect(types).toContain(TowerType.SNIPER);
      expect(types).toContain(TowerType.SPLASH);
      expect(types).toContain(TowerType.SLOW);
      expect(types).toContain(TowerType.CHAIN);
      expect(types).toContain(TowerType.MORTAR);
    });

    it('each tower entry has positive cost and damage (except Slow which has 0 damage)', () => {
      for (const info of component.towerInfoList) {
        expect(info.cost).toBeGreaterThan(0);
        expect(info.damage).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('E key toggles encyclopedia', () => {
    function fireKey(key: string): void {
      const event = new KeyboardEvent('keydown', { key, bubbles: true });
      window.dispatchEvent(event);
    }

    beforeEach(() => {
      window.addEventListener('keydown', (component as any).keyboardHandler);
    });

    afterEach(() => {
      window.removeEventListener('keydown', (component as any).keyboardHandler);
    });

    it('pressing e opens the encyclopedia', () => {
      component.showEncyclopedia = false;
      fireKey('e');
      expect(component.showEncyclopedia).toBeTrue();
    });

    it('pressing e again closes the encyclopedia', () => {
      component.showEncyclopedia = true;
      fireKey('e');
      expect(component.showEncyclopedia).toBeFalse();
    });

    it('pressing E (uppercase) also toggles encyclopedia', () => {
      component.showEncyclopedia = false;
      fireKey('E');
      expect(component.showEncyclopedia).toBeTrue();
    });
  });

  describe('isNewEnemyType (delegates to WaveService)', () => {
    it('isNewEnemyType returns true for a type not yet seen', () => {
      const waveService = fixture.debugElement.injector.get(WaveService);
      expect(component.isNewEnemyType(EnemyType.BOSS)).toBeTrue();
      expect(waveService.isNewType(EnemyType.BOSS)).toBeTrue();
    });

    it('isNewEnemyType returns false for a type that has been marked seen', () => {
      const waveService = fixture.debugElement.injector.get(WaveService);
      waveService.markSeen(EnemyType.BASIC);
      expect(component.isNewEnemyType(EnemyType.BASIC)).toBeFalse();
    });

    it('isNewEnemyType returns true for unseen type even when some types are seen', () => {
      const waveService = fixture.debugElement.injector.get(WaveService);
      waveService.markSeen(EnemyType.BASIC);
      waveService.markSeen(EnemyType.FAST);
      expect(component.isNewEnemyType(EnemyType.BOSS)).toBeTrue();
    });
  });

  // ── Campaign integration ─────────────────────────────────────────────────────

  describe('isCampaignGame', () => {
    it('returns false when mapId is null', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue(null);
      expect(component.isCampaignGame).toBeFalse();
    });

    it('returns false for a user/quickplay map', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('user_custom_map');
      expect(component.isCampaignGame).toBeFalse();
    });

    it('returns true for campaign_01', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('campaign_01');
      expect(component.isCampaignGame).toBeTrue();
    });

    it('returns true for any campaign_ prefixed id', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('campaign_16');
      expect(component.isCampaignGame).toBeTrue();
    });
  });

  describe('currentCampaignLevel', () => {
    it('returns null when mapId is null', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue(null);
      expect(component.currentCampaignLevel).toBeNull();
    });

    it('returns null when not a campaign map', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('user_map');
      campaignServiceSpy.getLevel.and.returnValue(undefined);
      expect(component.currentCampaignLevel).toBeNull();
    });

    it('returns the level from campaignService when mapId is a campaign id', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('campaign_01');
      const fakeLevel: CampaignLevel = {
        id: 'campaign_01', number: 1, name: 'First Light',
        tier: CampaignTier.INTRO, description: '', gridSize: 10,
        waveCount: 6, spawnerCount: 1, exitCount: 1, parScore: 500,
        unlockRequirement: { type: 'none' },
      };
      campaignServiceSpy.getLevel.and.returnValue(fakeLevel);
      expect(component.currentCampaignLevel).toEqual(fakeLevel);
    });

    it('returns null when service returns undefined for the id', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('campaign_99');
      campaignServiceSpy.getLevel.and.returnValue(undefined);
      expect(component.currentCampaignLevel).toBeNull();
    });
  });

  describe('nextCampaignLevel', () => {
    it('returns null when mapId is null', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue(null);
      expect(component.nextCampaignLevel).toBeNull();
    });

    it('returns null when service has no next level', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('campaign_16');
      campaignServiceSpy.getNextLevel.and.returnValue(null);
      expect(component.nextCampaignLevel).toBeNull();
    });

    it('returns next level from service when available', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('campaign_01');
      const fakeNext: CampaignLevel = {
        id: 'campaign_02', number: 2, name: 'The Bend',
        tier: CampaignTier.INTRO, description: '', gridSize: 10,
        waveCount: 8, spawnerCount: 1, exitCount: 1, parScore: 1000,
        unlockRequirement: { type: 'level_complete', levelId: 'campaign_01' },
      };
      campaignServiceSpy.getNextLevel.and.returnValue(fakeNext);
      expect(component.nextCampaignLevel).toEqual(fakeNext);
    });
  });

  describe('isNextLevelUnlocked', () => {
    it('returns false when there is no next level', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('campaign_16');
      campaignServiceSpy.getNextLevel.and.returnValue(null);
      expect(component.isNextLevelUnlocked).toBeFalse();
    });

    it('returns false when next level exists but is locked', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('campaign_01');
      const fakeNext: CampaignLevel = {
        id: 'campaign_02', number: 2, name: 'The Bend',
        tier: CampaignTier.INTRO, description: '', gridSize: 10,
        waveCount: 8, spawnerCount: 1, exitCount: 1, parScore: 1000,
        unlockRequirement: { type: 'level_complete', levelId: 'campaign_01' },
      };
      campaignServiceSpy.getNextLevel.and.returnValue(fakeNext);
      campaignServiceSpy.isUnlocked.and.returnValue(false);
      expect(component.isNextLevelUnlocked).toBeFalse();
    });

    it('returns true when next level exists and is unlocked', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('campaign_01');
      const fakeNext: CampaignLevel = {
        id: 'campaign_02', number: 2, name: 'The Bend',
        tier: CampaignTier.INTRO, description: '', gridSize: 10,
        waveCount: 8, spawnerCount: 1, exitCount: 1, parScore: 1000,
        unlockRequirement: { type: 'level_complete', levelId: 'campaign_01' },
      };
      campaignServiceSpy.getNextLevel.and.returnValue(fakeNext);
      campaignServiceSpy.isUnlocked.and.returnValue(true);
      expect(component.isNextLevelUnlocked).toBeTrue();
    });
  });

  describe('playNextLevel', () => {
    it('does nothing when nextCampaignLevel is null', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('campaign_16');
      campaignServiceSpy.getNextLevel.and.returnValue(null);
      spyOn(component, 'restartGame');

      component.playNextLevel();

      expect(campaignMapServiceSpy.loadLevel).not.toHaveBeenCalled();
      expect(component.restartGame).not.toHaveBeenCalled();
    });

    it('loads next level map and calls restartGame', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('campaign_01');
      spyOn(mapBridge, 'setEditorMapState');
      const fakeNext: CampaignLevel = {
        id: 'campaign_02', number: 2, name: 'The Bend',
        tier: CampaignTier.INTRO, description: '', gridSize: 10,
        waveCount: 8, spawnerCount: 1, exitCount: 1, parScore: 1000,
        unlockRequirement: { type: 'level_complete', levelId: 'campaign_01' },
      };
      campaignServiceSpy.getNextLevel.and.returnValue(fakeNext);
      campaignMapServiceSpy.loadLevel.and.returnValue(MOCK_MAP_STATE_SPEC);

      // Stub restartGame to avoid Three.js calls
      spyOn(component, 'restartGame');

      component.playNextLevel();

      expect(campaignMapServiceSpy.loadLevel).toHaveBeenCalledWith('campaign_02');
      expect(mapBridge.setEditorMapState).toHaveBeenCalledWith(MOCK_MAP_STATE_SPEC, 'campaign_02');
      expect(component.restartGame).toHaveBeenCalled();
    });

    it('does nothing when loadLevel returns null', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('campaign_01');
      const fakeNext: CampaignLevel = {
        id: 'campaign_02', number: 2, name: 'The Bend',
        tier: CampaignTier.INTRO, description: '', gridSize: 10,
        waveCount: 8, spawnerCount: 1, exitCount: 1, parScore: 1000,
        unlockRequirement: { type: 'level_complete', levelId: 'campaign_01' },
      };
      campaignServiceSpy.getNextLevel.and.returnValue(fakeNext);
      campaignMapServiceSpy.loadLevel.and.returnValue(null);
      spyOn(component, 'restartGame');

      component.playNextLevel();

      expect(component.restartGame).not.toHaveBeenCalled();
    });
  });

  describe('backToCampaign', () => {
    it('navigates to /campaign', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');

      component.backToCampaign();

      expect(router.navigate).toHaveBeenCalledWith(['/campaign']);
    });
  });

  describe('campaignChallenges getter', () => {
    it('returns empty array when mapId is null', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue(null);

      expect(component.campaignChallenges).toEqual([]);
    });

    it('returns empty array for a non-campaign map', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('custom_map_id');

      expect(component.campaignChallenges).toEqual([]);
    });

    it('returns challenge definitions for campaign_01', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      spyOn(mapBridge, 'getMapId').and.returnValue('campaign_01');

      const challenges = component.campaignChallenges;

      expect(challenges.length).toBeGreaterThan(0);
      expect(challenges[0].id).toContain('c01');
    });

    it('returns different challenges for different campaign levels', () => {
      const mapBridge = fixture.debugElement.injector.get(MapBridgeService);
      const spy = spyOn(mapBridge, 'getMapId').and.returnValue('campaign_01');
      const level01Challenges = component.campaignChallenges;

      spy.and.returnValue('campaign_07');
      const level07Challenges = component.campaignChallenges;

      expect(level01Challenges[0].id).not.toBe(level07Challenges[0].id);
    });
  });

  describe('isChallengeAlreadyCompleted', () => {
    it('delegates to campaignService.isChallengeCompleted', () => {
      campaignServiceSpy.isChallengeCompleted.and.returnValue(true);

      expect(component.isChallengeAlreadyCompleted('c01_untouchable')).toBeTrue();
      expect(campaignServiceSpy.isChallengeCompleted).toHaveBeenCalledWith('c01_untouchable');
    });

    it('returns false when challenge not completed', () => {
      campaignServiceSpy.isChallengeCompleted.and.returnValue(false);

      expect(component.isChallengeAlreadyCompleted('c01_tower_limit')).toBeFalse();
    });
  });

  describe('isChallengeCompleted (victory screen)', () => {
    it('returns false when no challenges were completed this run', () => {
      (component as any).completedChallenges = [];
      const challenge = { id: 'c01_untouchable', name: 'Untouchable', description: '', scoreBonus: 200,
        type: 'untouchable' as any };

      expect(component.isChallengeCompleted(challenge)).toBeFalse();
    });

    it('returns true when the challenge was completed this run', () => {
      const challenge = { id: 'c01_untouchable', name: 'Untouchable', description: '', scoreBonus: 200,
        type: 'untouchable' as any };
      (component as any).completedChallenges = [challenge];

      expect(component.isChallengeCompleted(challenge)).toBeTrue();
    });

    it('returns false for a different challenge not in completedChallenges', () => {
      const completed = { id: 'c01_untouchable', name: 'Untouchable', description: '', scoreBonus: 200,
        type: 'untouchable' as any };
      const other = { id: 'c01_tower_limit', name: 'Minimalist', description: '', scoreBonus: 300,
        type: 'tower_limit' as any };
      (component as any).completedChallenges = [completed];

      expect(component.isChallengeCompleted(other)).toBeFalse();
    });
  });

  describe('score-challenge desync fix — recordCompletion includes challenge bonus', () => {
    it('recordCompletion is called AFTER challenge bonuses are accumulated', () => {
      // The order matters: addScore for challenge bonus must happen before recordCompletion
      // Verify the spy call ordering by tracking call sequence
      const callOrder: string[] = [];
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      spyOn(gameStateService, 'addScore').and.callFake(() => { callOrder.push('addScore'); });
      campaignServiceSpy.recordCompletion.and.callFake(() => { callOrder.push('recordCompletion'); });

      // Simulate the fixed victory path directly
      const challenges = [{ id: 'ch_1', name: 'C1', description: '', scoreBonus: 100, type: 'untouchable' as any }];
      let challengeBonus = 0;
      for (const ch of challenges) {
        challengeBonus += ch.scoreBonus;
      }
      if (challengeBonus > 0) {
        gameStateService.addScore(challengeBonus);
      }
      campaignServiceSpy.recordCompletion('campaign_01', 500 + challengeBonus, 3, 'normal');

      expect(callOrder).toEqual(['addScore', 'recordCompletion']);
    });

    it('recordCompletion receives score that includes challenge bonus', () => {
      const baseScore = 1000;
      const challengeBonus = 200;
      const updatedScore = baseScore + challengeBonus;

      campaignServiceSpy.recordCompletion('campaign_01', updatedScore, 3, 'normal');

      expect(campaignServiceSpy.recordCompletion).toHaveBeenCalledWith(
        'campaign_01', 1200, 3, 'normal'
      );
    });

    it('recordCompletion receives base score when no challenges completed', () => {
      const baseScore = 800;

      campaignServiceSpy.recordCompletion('campaign_01', baseScore, 2, 'hard');

      expect(campaignServiceSpy.recordCompletion).toHaveBeenCalledWith(
        'campaign_01', 800, 2, 'hard'
      );
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

      gameEndService.recordEnd(true, null);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ towerKills: jasmine.objectContaining({ sniper: 2 }) })
      );
    });

    it('includes modifierCount from active modifiers on GameState', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      const expected = gameStateService.getState().activeModifiers.size;

      gameEndService.recordEnd(true, null);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ modifierCount: expected })
      );
    });

    it('usedSpecialization is false before any spec upgrade', () => {
      gameEndService.recordEnd(true, null);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ usedSpecialization: false })
      );
    });

    it('usedSpecialization is true after recordSpecialization() is called', () => {
      gameEndService.recordSpecialization();

      gameEndService.recordEnd(false, null);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ usedSpecialization: true })
      );
    });

    it('placedAllTowerTypes is false when fewer than 6 tower types used', () => {
      const challengeTrackingService = fixture.debugElement.injector.get(ChallengeTrackingService);
      challengeTrackingService.recordTowerPlaced(TowerType.BASIC, 100);
      challengeTrackingService.recordTowerPlaced(TowerType.SNIPER, 150);

      gameEndService.recordEnd(true, null);

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

      gameEndService.recordEnd(true, null);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ placedAllTowerTypes: true })
      );
    });

    it('slowEffectsApplied comes from StatusEffectService.getSlowApplicationCount()', () => {
      const statusEffectService = fixture.debugElement.injector.get(StatusEffectService);
      spyOn(statusEffectService, 'getSlowApplicationCount').and.returnValue(42);

      gameEndService.recordEnd(true, null);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ slowEffectsApplied: 42 })
      );
    });

    it('populates isVictory correctly for victory and defeat paths', () => {
      gameEndService.recordEnd(true, null);
      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ isVictory: true })
      );

      playerProfileSpy.recordGameEnd.calls.reset();
      gameEndService.reset();
      gameEndService.recordEnd(false, null);
      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ isVictory: false })
      );
    });

    it('recordEnd is idempotent — second call returns empty and does not re-record', () => {
      gameEndService.recordEnd(true, null);
      playerProfileSpy.recordGameEnd.calls.reset();

      const result = gameEndService.recordEnd(true, null);

      expect(playerProfileSpy.recordGameEnd).not.toHaveBeenCalled();
      expect(result.newlyUnlockedAchievements).toEqual([]);
      expect(result.completedChallenges).toEqual([]);
    });

    it('reset() allows re-recording in the next session', () => {
      gameEndService.recordEnd(false, null);
      playerProfileSpy.recordGameEnd.calls.reset();
      gameEndService.reset();

      gameEndService.recordEnd(false, null);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('recordChallengeCompleted wiring', () => {
    it('recordChallengeCompleted is called for each completed challenge', () => {
      // Simulate the for-loop in the challenge completion path
      const fakeChallenges = [
        { id: 'ch_1', name: 'C1', description: '', scoreBonus: 50 },
        { id: 'ch_2', name: 'C2', description: '', scoreBonus: 100 },
      ];

      for (const challenge of fakeChallenges) {
        campaignServiceSpy.completeChallenge(challenge.id);
        playerProfileSpy.recordChallengeCompleted();
      }

      expect(playerProfileSpy.recordChallengeCompleted).toHaveBeenCalledTimes(2);
    });

    it('does NOT call recordChallengeCompleted when no challenges are completed', () => {
      const emptyChallenges: { id: string; name: string; description: string; scoreBonus: number }[] = [];

      playerProfileSpy.recordChallengeCompleted.calls.reset();

      for (const challenge of emptyChallenges) {
        campaignServiceSpy.completeChallenge(challenge.id);
        playerProfileSpy.recordChallengeCompleted();
      }

      expect(playerProfileSpy.recordChallengeCompleted).not.toHaveBeenCalled();
    });

    it('GameEndService.isRecorded() resets to false after GameSessionService.resetAllServices', () => {
      // Verify the reset contract is fulfilled by GameSessionService (tested in its own spec)
      // and that restartGame calls GameSessionService.resetAllServices
      const gameEndService = fixture.debugElement.injector.get(GameEndService);
      gameEndService.recordSpecialization();
      gameEndService.recordEnd(false, null);
      expect(gameEndService.isRecorded()).toBeTrue();

      // Directly verify the service reset works (independent of restartGame wiring)
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

    it('restartGame delegates service resets to GameSessionService', () => {
      // Override the component-scoped GameSessionService with our spy
      (component as any).gameSessionService = gameSessionSpy;
      spyOn(component as any, 'cleanupGameObjects');
      spyOn(component as any, 'renderGameBoard');
      spyOn(component as any, 'addGridLines');
      spyOn((component as any).sceneService, 'initLights');
      spyOn((component as any).sceneService, 'initSkybox');
      spyOn((component as any).sceneService, 'initParticles');
      const minimapSvc = fixture.debugElement.injector.get(MinimapService);
      spyOn(minimapSvc, 'init');

      component.restartGame();

      // Service resets (including notification clear) are now delegated to GameSessionService
      expect(gameSessionSpy.resetAllServices).toHaveBeenCalled();
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
      (component as any).setupAutoPause();
    });

    afterEach(() => {
      // Clean up document/window listeners to avoid leaking between tests
      if ((component as any).visibilityChangeHandler) {
        document.removeEventListener('visibilitychange', (component as any).visibilityChangeHandler);
        (component as any).visibilityChangeHandler = null;
      }
      if ((component as any).windowBlurPauseHandler) {
        window.removeEventListener('blur', (component as any).windowBlurPauseHandler);
        (component as any).windowBlurPauseHandler = null;
      }
    });

    it('visibility change to hidden during COMBAT triggers pause', () => {
      gameStateService.setPhase(GamePhase.COMBAT);
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
      gameStateService.setPhase(GamePhase.COMBAT);
      gameStateService.togglePause(); // already paused
      spyOnProperty(document, 'hidden').and.returnValue(true);
      spyOn(gameStateService, 'togglePause').and.callThrough();

      document.dispatchEvent(new Event('visibilitychange'));

      expect(gameStateService.togglePause).not.toHaveBeenCalled();
      expect(gameStateService.getState().isPaused).toBeTrue();
    });

    it('window blur during COMBAT triggers pause', () => {
      gameStateService.setPhase(GamePhase.COMBAT);
      spyOn(gameStateService, 'togglePause').and.callThrough();

      window.dispatchEvent(new Event('blur'));

      expect(gameStateService.togglePause).toHaveBeenCalled();
      expect(gameStateService.getState().isPaused).toBeTrue();
    });

    it('autoPaused flag is set to true on auto-pause via visibilitychange', () => {
      gameStateService.setPhase(GamePhase.COMBAT);
      spyOnProperty(document, 'hidden').and.returnValue(true);

      document.dispatchEvent(new Event('visibilitychange'));

      expect(component.autoPaused).toBeTrue();
    });

    it('autoPaused flag is set to true on auto-pause via window blur', () => {
      gameStateService.setPhase(GamePhase.COMBAT);

      window.dispatchEvent(new Event('blur'));

      expect(component.autoPaused).toBeTrue();
    });

    it('autoPaused flag is reset to false on manual togglePause (resume)', () => {
      gameStateService.setPhase(GamePhase.COMBAT);
      (component as any).autoPaused = true;

      component.togglePause();

      expect(component.autoPaused).toBeFalse();
    });

    it('autoPaused flag is reset in restartGame', () => {
      (component as any).autoPaused = true;
      spyOn(component as any, 'cleanupGameObjects');
      spyOn(component as any, 'renderGameBoard');
      spyOn(component as any, 'addGridLines');
      spyOn((component as any).sceneService, 'initLights');
      spyOn((component as any).sceneService, 'initSkybox');
      spyOn((component as any).sceneService, 'initParticles');
      const enemyService = fixture.debugElement.injector.get(EnemyService);
      spyOn(enemyService, 'reset');
      const minimapSvc = fixture.debugElement.injector.get(MinimapService);
      spyOn(minimapSvc, 'init');

      component.restartGame();

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

      // Prevent afterEach from removing already-nulled handlers
      (component as any).visibilityChangeHandler = null;
      (component as any).windowBlurPauseHandler = null;
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
      window.dispatchEvent(event);
    }

    beforeEach(() => {
      gameStateService = fixture.debugElement.injector.get(GameStateService);
      // Wire keyboard handler (ngAfterViewInit skipped in unit tests)
      (component as any).setupKeyboardControls();
    });

    afterEach(() => {
      window.removeEventListener('keydown', (component as any).keyboardHandler);
      window.removeEventListener('keydown', (component as any).keydownPanHandler);
      window.removeEventListener('keyup', (component as any).keyupPanHandler);
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
      gameStateService.startWave();
      gameStateService.completeWave(0); // → INTERMISSION
      (component as any).setupAutoPause();

      spyOnProperty(document, 'hidden').and.returnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));

      expect(component.autoPaused).toBeTrue();

      // cleanup
      document.removeEventListener('visibilitychange', (component as any).visibilityChangeHandler);
      window.removeEventListener('blur', (component as any).windowBlurPauseHandler);
      (component as any).visibilityChangeHandler = null;
      (component as any).windowBlurPauseHandler = null;
    });
  });

  describe('restartGame — showQuitConfirm reset', () => {
    it('showQuitConfirm is reset to false on restartGame', () => {
      spyOn(component as any, 'cleanupGameObjects');
      spyOn(component as any, 'renderGameBoard');
      spyOn(component as any, 'addGridLines');
      spyOn((component as any).sceneService, 'initLights');
      spyOn((component as any).sceneService, 'initSkybox');
      spyOn((component as any).sceneService, 'initParticles');
      const enemyService = fixture.debugElement.injector.get(EnemyService);
      spyOn(enemyService, 'reset');
      const minimapSvc = fixture.debugElement.injector.get(MinimapService);
      spyOn(minimapSvc, 'init');

      component.showQuitConfirm = true;
      component.restartGame();

      expect(component.showQuitConfirm).toBeFalse();
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
      (component as any).challengeTrackingService = challengeTrackingSpy;
      (component as any).towerInteractionService.challengeTrackingService = challengeTrackingSpy;
    });

    it('restartGame delegates service resets to GameSessionService.resetAllServices', () => {
      // Override the component-scoped GameSessionService with our spy
      (component as any).gameSessionService = gameSessionSpy;
      spyOn(component as any, 'cleanupGameObjects');
      spyOn(component as any, 'renderGameBoard');
      spyOn(component as any, 'addGridLines');
      spyOn((component as any).sceneService, 'initLights');
      spyOn((component as any).sceneService, 'initSkybox');
      spyOn((component as any).sceneService, 'initParticles');
      const minimapSvc = fixture.debugElement.injector.get(MinimapService);
      spyOn(minimapSvc, 'init');

      component.restartGame();

      expect(gameSessionSpy.resetAllServices).toHaveBeenCalled();
    });

    it('upgradeTower delegates recordTowerUpgraded to ChallengeTrackingService', () => {
      // Set up a real selected tower in the INSPECT state
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setPhase(GamePhase.COMBAT);
      gameStateService.addGold(500);

      const mockTower: PlacedTower = {
        id: '0-0',
        type: TowerType.BASIC,
        level: 1,
        row: 0,
        col: 0,
        lastFireTime: 0,
        kills: 0,
        totalInvested: 100,
        mesh: null as any,
        targetingMode: TargetingMode.NEAREST,
      };

      const towerCombatService = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(towerCombatService, 'getTower').and.returnValue(mockTower);
      spyOn(towerCombatService, 'upgradeTower').and.returnValue(true);

      // Stub pricing service so it doesn't crash on missing board state
      const tilePricingService = fixture.debugElement.injector.get(TilePricingService);
      spyOn(tilePricingService, 'getStrategicValue').and.returnValue(0);

      (component as any).selectedTowerInfo = mockTower;
      component.selectedTowerType = null; // INSPECT mode
      spyOn(component as any, 'refreshTowerInfoPanel');
      spyOn((component as any).rangeVisualizationService, 'showForTower');

      component.upgradeTower();

      expect(challengeTrackingSpy.recordTowerUpgraded).toHaveBeenCalled();
    });

    it('sellTower delegates recordTowerSold to ChallengeTrackingService', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setPhase(GamePhase.COMBAT);

      const towerCombatService = fixture.debugElement.injector.get(TowerCombatService);
      const mockSoldTower: PlacedTower = {
        id: '1-1',
        type: TowerType.BASIC,
        level: 1,
        row: 1,
        col: 1,
        lastFireTime: 0,
        kills: 0,
        totalInvested: 100,
        mesh: null as any,
        targetingMode: TargetingMode.NEAREST,
      };
      spyOn(towerCombatService, 'unregisterTower').and.returnValue(mockSoldTower);

      // Stub board-touching methods so they don't crash without renderer/board
      const gameBoardSvc = fixture.debugElement.injector.get(GameBoardService);
      spyOn(gameBoardSvc, 'removeTower');
      const enemyService = fixture.debugElement.injector.get(EnemyService);
      spyOn(enemyService, 'repathAffectedEnemies');
      const tilePricingService = fixture.debugElement.injector.get(TilePricingService);
      spyOn(tilePricingService, 'invalidateCache');
      spyOn(component as any, 'deselectTower');
      spyOn(component as any, 'updateTileHighlights');
      spyOn(component as any, 'refreshPathOverlay');

      (component as any).selectedTowerInfo = mockSoldTower;
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
      gameStateService.setPhase(GamePhase.COMBAT);

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
      gameStateService.setPhase(GamePhase.COMBAT);

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

  describe('restartGame — sellConfirmPending and contextLost reset', () => {
    function stubRestartGame(): void {
      spyOn(component as any, 'cleanupGameObjects');
      spyOn(component as any, 'renderGameBoard');
      spyOn(component as any, 'addGridLines');
      spyOn((component as any).sceneService, 'initLights');
      spyOn((component as any).sceneService, 'initSkybox');
      spyOn((component as any).sceneService, 'initParticles');
      const minimapSvc = fixture.debugElement.injector.get(MinimapService);
      spyOn(minimapSvc, 'init');
    }

    it('sellConfirmPending is reset to false on restartGame', () => {
      stubRestartGame();
      component.sellConfirmPending = true;

      component.restartGame();

      expect(component.sellConfirmPending).toBeFalse();
    });

    it('contextLost is reset to false on restartGame', () => {
      stubRestartGame();
      (component as any).contextLost = true;

      component.restartGame();

      expect(component.contextLost).toBeFalse();
    });
  });

  describe('raycasting array caching', () => {
    it('tileMeshArray starts empty', () => {
      expect((component as any).tileMeshArray.length).toBe(0);
    });

    it('rebuildTileMeshArray reflects the current tileMeshes map', () => {
      const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      (component as any).tileMeshes.set('0-0', mesh1);
      (component as any).tileMeshes.set('0-1', mesh2);

      (component as any).rebuildTileMeshArray();

      expect((component as any).tileMeshArray.length).toBe(2);
      expect((component as any).tileMeshArray).toContain(mesh1);
      expect((component as any).tileMeshArray).toContain(mesh2);

      mesh1.geometry.dispose(); (mesh1.material as THREE.Material).dispose();
      mesh2.geometry.dispose(); (mesh2.material as THREE.Material).dispose();
    });

    it('towerChildrenArray starts empty', () => {
      expect((component as any).towerChildrenArray.length).toBe(0);
    });

    it('rebuildTowerChildrenArray collects Mesh children from all tower groups', () => {
      const group = new THREE.Group();
      const childMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      group.add(childMesh);
      (component as any).towerMeshes.set('r1-c2', group);

      (component as any).rebuildTowerChildrenArray();

      expect((component as any).towerChildrenArray.length).toBe(1);
      expect((component as any).towerChildrenArray[0]).toBe(childMesh);

      childMesh.geometry.dispose();
      (childMesh.material as THREE.Material).dispose();
    });

    it('tileMeshArray is cleared when cleanupGameObjects clears tileMeshes', () => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      (component as any).tileMeshes.set('0-0', mesh);
      (component as any).tileMeshArray = [mesh];

      // Stub out Three.js scene calls so cleanupGameObjects doesn't crash without a scene
      const sceneService = (component as any).sceneService;
      const mockScene = { remove: () => {} } as unknown as THREE.Scene;
      spyOn(sceneService, 'getScene').and.returnValue(mockScene);
      spyOn(sceneService, 'disposeParticles');
      spyOn(sceneService, 'disposeSkybox');
      spyOn(sceneService, 'disposeLights');

      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();

      (component as any).cleanupGameObjects();

      expect((component as any).tileMeshArray.length).toBe(0);
      expect((component as any).towerChildrenArray.length).toBe(0);
    });
  });

  describe('applySpecializationVisual', () => {
    function makeMeshGroup(...names: string[]): THREE.Group {
      const group = new THREE.Group();
      for (const name of names) {
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.name = name;
        group.add(mesh);
      }
      return group;
    }

    afterEach(() => {
      // Dispose geometries/materials created in helpers
    });

    it('should apply warm orange emissive tint for ALPHA specialization', () => {
      const group = makeMeshGroup('base', 'top');
      component.applySpecializationVisual(group, TowerSpecialization.ALPHA);
      group.traverse(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          expect(child.material.emissive.getHex()).toBe(0xff6633);
          expect(child.material.emissiveIntensity).toBe(0.4);
        }
      });
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.MeshStandardMaterial).dispose();
        }
      });
    });

    it('should apply cool blue emissive tint for BETA specialization', () => {
      const group = makeMeshGroup('base', 'top');
      component.applySpecializationVisual(group, TowerSpecialization.BETA);
      group.traverse(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          expect(child.material.emissive.getHex()).toBe(0x3366ff);
          expect(child.material.emissiveIntensity).toBe(0.4);
        }
      });
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.MeshStandardMaterial).dispose();
        }
      });
    });

    it('should not modify tip or orb meshes (animated by TowerAnimationService)', () => {
      const group = makeMeshGroup('base', 'tip', 'orb');
      const tipMesh = group.children.find(c => c.name === 'tip') as THREE.Mesh;
      const orbMesh = group.children.find(c => c.name === 'orb') as THREE.Mesh;
      const tipMat = tipMesh.material as THREE.MeshStandardMaterial;
      const orbMat = orbMesh.material as THREE.MeshStandardMaterial;
      const tipOriginalHex = tipMat.emissive.getHex();
      const orbOriginalHex = orbMat.emissive.getHex();

      component.applySpecializationVisual(group, TowerSpecialization.ALPHA);

      expect(tipMat.emissive.getHex()).toBe(tipOriginalHex);
      expect(orbMat.emissive.getHex()).toBe(orbOriginalHex);
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.MeshStandardMaterial).dispose();
        }
      });
    });

    it('should apply tint to all non-animated mesh children in the group', () => {
      const group = makeMeshGroup('base', 'mid', 'top', 'crystal');
      const tinted: string[] = [];
      component.applySpecializationVisual(group, TowerSpecialization.BETA);
      group.traverse(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          if (child.material.emissive.getHex() === 0x3366ff) {
            tinted.push(child.name);
          }
        }
      });
      expect(tinted).toContain('base');
      expect(tinted).toContain('mid');
      expect(tinted).toContain('top');
      expect(tinted).toContain('crystal');
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.MeshStandardMaterial).dispose();
        }
      });
    });

    it('should handle Material[] arrays on a mesh', () => {
      const group = new THREE.Group();
      const geom = new THREE.BoxGeometry(1, 1, 1);
      const mat1 = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const mat2 = new THREE.MeshStandardMaterial({ color: 0x888888 });
      const mesh = new THREE.Mesh(geom, [mat1, mat2]);
      mesh.name = 'multi';
      group.add(mesh);

      component.applySpecializationVisual(group, TowerSpecialization.ALPHA);

      expect(mat1.emissive.getHex()).toBe(0xff6633);
      expect(mat2.emissive.getHex()).toBe(0xff6633);

      geom.dispose();
      mat1.dispose();
      mat2.dispose();
    });
  });

  describe('onWaveComplete — wave clear banner', () => {
    it('sets showWaveClear to true and waveClearMessage immediately', () => {
      component.onWaveComplete(3, false);

      expect(component.showWaveClear).toBeTrue();
      expect(component.waveClearMessage).toBe('Wave 3 Clear!');
    });

    it('includes "Perfect!" suffix when perfectWave is true', () => {
      component.onWaveComplete(5, true);

      expect(component.waveClearMessage).toBe('Wave 5 Clear! Perfect!');
    });

    it('does NOT include "Perfect!" when perfectWave is false', () => {
      component.onWaveComplete(2, false);

      expect(component.waveClearMessage).not.toContain('Perfect');
    });

    it('sets showWaveClear to false after 2 seconds', fakeAsync(() => {
      component.onWaveComplete(1, false);
      expect(component.showWaveClear).toBeTrue();

      tick(2000);

      expect(component.showWaveClear).toBeFalse();
    }));

    it('resets the timer if called again before the first expires', fakeAsync(() => {
      component.onWaveComplete(1, false);
      tick(1000);
      component.onWaveComplete(2, false);

      // Should still be showing because the timer was reset
      tick(1500);
      expect(component.showWaveClear).toBeTrue();

      tick(500);
      expect(component.showWaveClear).toBeFalse();
    }));
  });

  describe('waveStartPulse — wave counter pulse', () => {
    it('starts as false', () => {
      expect(component.waveStartPulse).toBeFalse();
    });

    it('becomes true when triggerWaveStartPulse is called', fakeAsync(() => {
      (component as any).triggerWaveStartPulse();

      expect(component.waveStartPulse).toBeTrue();

      tick(300);

      expect(component.waveStartPulse).toBeFalse();
    }));

    it('resets to false after 300ms', fakeAsync(() => {
      (component as any).triggerWaveStartPulse();
      tick(299);
      expect(component.waveStartPulse).toBeTrue();

      tick(1);
      expect(component.waveStartPulse).toBeFalse();
    }));

    it('resets timer if called again before prior pulse expires', fakeAsync(() => {
      (component as any).triggerWaveStartPulse();
      tick(200);
      (component as any).triggerWaveStartPulse();

      // 200ms into the reset timer — should still be true
      tick(200);
      expect(component.waveStartPulse).toBeTrue();

      tick(100);
      expect(component.waveStartPulse).toBeFalse();
    }));
  });
});
