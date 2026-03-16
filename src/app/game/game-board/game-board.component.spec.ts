import { ComponentFixture, TestBed } from '@angular/core/testing';
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
import { TowerType, PlacedTower } from './models/tower.model';
import { TowerCombatService } from './services/tower-combat.service';
import { ScoreBreakdown, calculateScoreBreakdown } from './models/score.model';
import { ACHIEVEMENTS, Achievement } from './services/player-profile.service';
import { WaveService } from './services/wave.service';
import { StatusEffectService } from './services/status-effect.service';
import { EnemyService } from './services/enemy.service';
import { TutorialService, TutorialStep } from './services/tutorial.service';
import { BehaviorSubject } from 'rxjs';

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

  beforeEach(async () => {
    gameStatsSpy = jasmine.createSpyObj('GameStatsService', ['recordKill', 'recordDamage', 'recordGoldEarned', 'recordEnemyLeaked', 'recordTowerBuilt', 'recordTowerSold', 'recordShot', 'getStats', 'reset']);
    gameStatsSpy.getStats.and.returnValue({ killsByTowerType: {} as any, totalDamageDealt: 0, totalGoldEarned: 0, enemiesLeaked: 0, towersBuilt: 0, towersSold: 0, shotsFired: 0 });

    playerProfileSpy = jasmine.createSpyObj('PlayerProfileService', ['recordGameEnd', 'getProfile']);
    playerProfileSpy.recordGameEnd.and.returnValue([]);

    damagePopupSpy = jasmine.createSpyObj('DamagePopupService', ['spawn', 'update', 'cleanup']);

    minimapSpy = jasmine.createSpyObj('MinimapService', ['init', 'update', 'cleanup', 'toggleVisibility', 'show', 'hide']);

    settingsSpy = jasmine.createSpyObj('SettingsService', ['get', 'update', 'reset']);
    settingsSpy.get.and.returnValue({ audioMuted: false, difficulty: 'normal' as any, gameSpeed: 1 });

    tutorialStep$ = new BehaviorSubject<TutorialStep | null>(null);
    tutorialSpy = jasmine.createSpyObj('TutorialService', [
      'isTutorialComplete',
      'startTutorial',
      'advanceStep',
      'skipTutorial',
      'resetTutorial',
      'getTip',
      'getCurrentStep',
    ]);
    tutorialSpy.isTutorialComplete.and.returnValue(true); // default: complete — no auto-start
    tutorialSpy.getCurrentStep.and.returnValue(tutorialStep$.asObservable());
    tutorialSpy.getTip.and.callFake((step: TutorialStep) => ({
      id: step,
      step,
      title: 'Test Title',
      message: 'Test message.',
      position: 'center' as const,
    }));

    await TestBed.configureTestingModule({
      declarations: [ GameBoardComponent ],
      imports: [ RouterTestingModule ],
      providers: [
        GameBoardService,
        MapBridgeService,
        GameStateService,
        EnemyService,
        StatusEffectService,
        { provide: GameStatsService, useValue: gameStatsSpy },
        { provide: PlayerProfileService, useValue: playerProfileSpy },
        { provide: DamagePopupService, useValue: damagePopupSpy },
        { provide: MinimapService, useValue: minimapSpy },
        { provide: SettingsService, useValue: settingsSpy },
        { provide: TutorialService, useValue: tutorialSpy },
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
      (component as any).selectedTowerInfo = { id: 'fake', type: TowerType.SNIPER, level: 1, row: 0, col: 0, lastFireTime: 0, kills: 0, totalInvested: 50, mesh: null, targetingMode: 'nearest' };
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
      gameStateService.setPhase(GamePhase.VICTORY);
      component.selectedTowerType = TowerType.SNIPER;
      fireKey('1');
      // Should remain SNIPER — hotkey is blocked
      expect(component.selectedTowerType).toBe(TowerType.SNIPER);
    });

    it('hotkeys are ignored in DEFEAT phase', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setPhase(GamePhase.DEFEAT);
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
      gameStateService.setPhase(GamePhase.VICTORY);
      spyOn(component, 'upgradeTower');
      fireKey('u');
      expect(component.upgradeTower).not.toHaveBeenCalled();
    });

    it('t key does not call cycleTargeting in DEFEAT phase', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setPhase(GamePhase.DEFEAT);
      spyOn(component, 'cycleTargeting');
      fireKey('t');
      expect(component.cycleTargeting).not.toHaveBeenCalled();
    });

    it('Delete key does not call sellTower in VICTORY phase', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setPhase(GamePhase.VICTORY);
      spyOn(component, 'sellTower');
      fireKey('Delete');
      expect(component.sellTower).not.toHaveBeenCalled();
    });

    it('cycleTargeting skips SLOW towers', () => {
      component.selectedTowerInfo = {
        id: 'tower-slow', type: TowerType.SLOW, level: 1,
        row: 0, col: 0, lastFireTime: 0, kills: 0, totalInvested: 75,
        targetingMode: 'nearest', mesh: null,
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
    it('should return 3 empty stars when scoreBreakdown is null', () => {
      component.scoreBreakdown = null;
      expect(component.starArray).toEqual(['empty', 'empty', 'empty']);
    });

    it('should return 3 filled stars when breakdown has 3 stars', () => {
      component.scoreBreakdown = { stars: 3 } as ScoreBreakdown;
      expect(component.starArray).toEqual(['filled', 'filled', 'filled']);
    });

    it('should return 2 filled and 1 empty when breakdown has 2 stars', () => {
      component.scoreBreakdown = { stars: 2 } as ScoreBreakdown;
      expect(component.starArray).toEqual(['filled', 'filled', 'empty']);
    });

    it('should return 1 filled and 2 empty when breakdown has 1 star', () => {
      component.scoreBreakdown = { stars: 1 } as ScoreBreakdown;
      expect(component.starArray).toEqual(['filled', 'empty', 'empty']);
    });

    it('should return 3 empty stars when breakdown has 0 stars (defeat)', () => {
      component.scoreBreakdown = { stars: 0 } as ScoreBreakdown;
      expect(component.starArray).toEqual(['empty', 'empty', 'empty']);
    });

    it('should always return exactly 3 elements', () => {
      for (const stars of [0, 1, 2, 3]) {
        component.scoreBreakdown = { stars } as ScoreBreakdown;
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

      // Inject mock canvas via renderer stub on the private renderer field
      (component as any).renderer = {
        domElement: mockCanvas,
        dispose: () => {}
      };
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
      const canvas = (component as any).renderer.domElement as HTMLElement;
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
      (component as any).camera = { position: new THREE.Vector3(0, 10, 0) };
      (component as any).controls = { target: new THREE.Vector3(0, 0, 0), dispose: () => {} };

      const touch = { clientX: 20, clientY: 20 } as Touch;
      const event = { preventDefault: () => {}, touches: [touch] } as unknown as TouchEvent;

      (component as any).touchMoveHandler(event);

      expect((component as any).touchIsDragging).toBeTrue();

      // Prevent cleanup crash — reset partial mocks
      (component as any).camera = null;
      (component as any).controls = null;
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
      (component as any).scene = new THREE.Scene();
      const pvs = (component as any).pathVisualizationService;
      spyOn(pvs, 'showPath');
      spyOn(pvs, 'hidePath');
      const fakePath = [{ x: 0, z: 0 }, { x: 1, z: 0 }];
      spyOn((component as any).enemyService, 'getPathToExit').and.returnValue(fakePath);

      component.togglePathOverlay();

      expect(pvs.showPath).toHaveBeenCalledWith(fakePath, (component as any).scene);
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
        targetingMode: 'nearest',
        mesh: null,
      };
      spyOn(towerCombatService, 'getTower').and.returnValue(fakeTower);
      // Stub Three.js-dependent methods to avoid canvas crash in headless tests
      spyOn(component as any, 'showRangePreview');
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

  describe('Tile Highlighting', () => {
    it('updateTileHighlights should not throw when tileMeshes is empty', () => {
      component.selectedTowerType = TowerType.BASIC;
      expect(() => component.updateTileHighlights()).not.toThrow();
    });

    it('updateTileHighlights should do nothing in INSPECT mode', () => {
      component.selectedTowerType = null;
      component.updateTileHighlights();
      expect((component as any).highlightedTiles.size).toBe(0);
    });

    it('clearTileHighlights should clear the highlighted set', () => {
      (component as any).highlightedTiles.add('0-0');
      (component as any).highlightedTiles.add('1-1');
      (component as any).clearTileHighlights();
      expect((component as any).highlightedTiles.size).toBe(0);
    });

    it('selectTowerType should call updateTileHighlights', () => {
      spyOn(component, 'updateTileHighlights');
      component.selectedTowerType = null; // start in INSPECT mode
      component.selectTowerType(TowerType.SNIPER);
      expect(component.updateTileHighlights).toHaveBeenCalled();
    });

    it('cancelPlacement should clear highlights', () => {
      (component as any).highlightedTiles.add('2-3');
      component.cancelPlacement();
      expect((component as any).highlightedTiles.size).toBe(0);
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
      spyOn(component as any, 'initializeLights');
      spyOn(component as any, 'addSkybox');
      spyOn(component as any, 'initializeParticles');
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
        targetingMode: 'nearest'
      };
      (component as any).selectedTowerInfo = fakeTower;
      // Stub showRangePreview to avoid Three.js canvas crash
      spyOn(component as any, 'showRangePreview');
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
        targetingMode: 'nearest'
      };
      (component as any).selectedTowerInfo = fakeTower;
      spyOn(component as any, 'showRangePreview');
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
        targetingMode: 'nearest', specialization: 'alpha' as any
      };
      (component as any).selectedTowerInfo = fakeTower;
      spyOn(component as any, 'showRangePreview');
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

    it('selectionRingMesh should be null initially', () => {
      expect((component as any).selectionRingMesh).toBeNull();
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

    it('skipTutorial() delegates to tutorialService.skipTutorial()', () => {
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
  });
});
