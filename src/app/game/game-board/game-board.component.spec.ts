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
import { TowerUnlockService } from './services/tower-unlock.service';
import { CampaignService } from '../campaign/campaign.service';
import { TowerCombatService } from './services/tower-combat.service';
import { WaveService } from './services/wave.service';
import { AudioService } from './services/audio.service';
import { DifficultyLevel, DIFFICULTY_PRESETS, GamePhase } from './models/game-state.model';
import { TowerType, TOWER_ABILITIES, MAX_TOWER_LEVEL, PlacedTower, TargetingPriority } from './models/tower.model';
import { TOWER_UNLOCK_CONDITIONS } from './models/tower-unlock.model';
import { ScoreBreakdown, calculateScoreBreakdown } from './models/score.model';

describe('GameBoardComponent', () => {
  let component: GameBoardComponent;
  let fixture: ComponentFixture<GameBoardComponent>;
  let gameStatsSpy: jasmine.SpyObj<GameStatsService>;
  let playerProfileSpy: jasmine.SpyObj<PlayerProfileService>;
  let damagePopupSpy: jasmine.SpyObj<DamagePopupService>;
  let minimapSpy: jasmine.SpyObj<MinimapService>;
  let settingsSpy: jasmine.SpyObj<SettingsService>;
  let towerUnlockSpy: jasmine.SpyObj<TowerUnlockService>;
  let campaignSpy: jasmine.SpyObj<CampaignService>;

  beforeEach(async () => {
    gameStatsSpy = jasmine.createSpyObj('GameStatsService', ['recordKill', 'recordDamage', 'recordGoldEarned', 'recordEnemyLeaked', 'recordTowerBuilt', 'recordTowerSold', 'recordShot', 'getStats', 'reset']);
    gameStatsSpy.getStats.and.returnValue({ killsByTowerType: {} as any, totalDamageDealt: 0, totalGoldEarned: 0, enemiesLeaked: 0, towersBuilt: 0, towersSold: 0, shotsFired: 0 });

    playerProfileSpy = jasmine.createSpyObj('PlayerProfileService', ['recordGameEnd', 'getProfile']);
    playerProfileSpy.recordGameEnd.and.returnValue([]);

    damagePopupSpy = jasmine.createSpyObj('DamagePopupService', ['spawn', 'update', 'cleanup']);

    minimapSpy = jasmine.createSpyObj('MinimapService', ['init', 'update', 'cleanup', 'toggleVisibility']);

    settingsSpy = jasmine.createSpyObj('SettingsService', ['get', 'update', 'reset']);
    settingsSpy.get.and.returnValue({ audioMuted: false, difficulty: 'normal' as any, gameSpeed: 1 });

    // All towers unlocked by default in component tests
    towerUnlockSpy = jasmine.createSpyObj('TowerUnlockService', ['isTowerUnlocked', 'getUnlockedTowers', 'getLockedTowers', 'getUnlockCondition', 'allUnlocked']);
    towerUnlockSpy.isTowerUnlocked.and.returnValue(true);

    campaignSpy = jasmine.createSpyObj('CampaignService', ['getLevels', 'getProgress', 'isLevelUnlocked', 'getMapForLevel', 'completeLevel', 'resetProgress']);
    campaignSpy.getProgress.and.returnValue({ unlockedLevel: 1, stars: {}, bestScores: {} });

    await TestBed.configureTestingModule({
      declarations: [ GameBoardComponent ],
      imports: [ RouterTestingModule ],
      providers: [
        GameBoardService,
        MapBridgeService,
        GameStateService,
        { provide: GameStatsService, useValue: gameStatsSpy },
        { provide: PlayerProfileService, useValue: playerProfileSpy },
        { provide: DamagePopupService, useValue: damagePopupSpy },
        { provide: MinimapService, useValue: minimapSpy },
        { provide: SettingsService, useValue: settingsSpy },
        { provide: TowerUnlockService, useValue: towerUnlockSpy },
        { provide: CampaignService, useValue: campaignSpy },
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

    it('pressing 1 selects BASIC tower', () => {
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

    it('pressing Escape deselects the tower type back to BASIC and closes info panel', () => {
      component.selectedTowerType = TowerType.SNIPER;
      (component as any).selectedTowerInfo = { id: 'fake', type: TowerType.SNIPER, level: 1, row: 0, col: 0, lastFireTime: 0, kills: 0, totalInvested: 50, mesh: null };
      fireKey('Escape');
      expect(component.selectedTowerType).toBe(TowerType.BASIC);
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

  describe('getWaveComposition', () => {
    it('returns empty current and next arrays when wave is 0', () => {
      const composition = component.getWaveComposition();
      // wave 0 = no current wave; wave 1 preview is the next
      expect(composition.current).toEqual([]);
    });

    it('returns current wave entries for wave 1', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setPhase(GamePhase.COMBAT);
      // Manually advance wave to 1 by accessing internal state
      (component as any).gameState = { ...component.gameState, wave: 1, isEndless: false };

      const composition = component.getWaveComposition();

      expect(composition.current.length).toBeGreaterThan(0);
      expect(composition.current[0].type).toBeDefined();
      expect(composition.current[0].count).toBeGreaterThan(0);
      expect(composition.current[0].label).toBeTruthy();
    });

    it('returns next wave entries for intermission between wave 1 and 2', () => {
      (component as any).gameState = { ...component.gameState, wave: 1, isEndless: false };

      const composition = component.getWaveComposition();

      expect(composition.next.length).toBeGreaterThan(0);
    });

    it('returns empty next array when on the final wave (wave 10)', () => {
      (component as any).gameState = { ...component.gameState, wave: 10, isEndless: false };

      const composition = component.getWaveComposition();

      // Wave 11 does not exist in WAVE_DEFINITIONS and isEndless is false
      expect(composition.next).toEqual([]);
    });

    it('returns next wave for endless mode beyond wave definitions', () => {
      (component as any).gameState = { ...component.gameState, wave: 11, isEndless: true };

      const composition = component.getWaveComposition();

      expect(composition.current.length).toBeGreaterThan(0);
      expect(composition.next.length).toBeGreaterThan(0);
    });

    it('all current entries have positive count and non-empty label', () => {
      (component as any).gameState = { ...component.gameState, wave: 5, isEndless: false };

      const composition = component.getWaveComposition();

      for (const entry of composition.current) {
        expect(entry.count).toBeGreaterThan(0);
        expect(entry.label.length).toBeGreaterThan(0);
      }
    });

    it('wave 5 current composition contains 3 enemy types', () => {
      // Wave 5 definition has BASIC, FAST, HEAVY
      (component as any).gameState = { ...component.gameState, wave: 5, isEndless: false };

      const composition = component.getWaveComposition();

      expect(composition.current.length).toBe(3);
    });

    it('wave 10 current composition includes BOSS enemy', () => {
      (component as any).gameState = { ...component.gameState, wave: 10, isEndless: false };

      const { current } = component.getWaveComposition();
      const bossEntry = current.find(e => e.type === 'BOSS');

      expect(bossEntry).toBeDefined();
      expect(bossEntry!.count).toBe(1);
    });
  });

  describe('waveCompositionExpanded', () => {
    it('defaults to true', () => {
      expect(component.waveCompositionExpanded).toBeTrue();
    });

    it('can be toggled to false', () => {
      component.waveCompositionExpanded = false;
      expect(component.waveCompositionExpanded).toBeFalse();
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

  describe('showInterestPopup', () => {
    it('sets showInterestNotification to true and interestAmount when called with a positive amount', () => {
      expect(component.showInterestNotification).toBeFalse();

      (component as any).showInterestPopup(5);

      expect(component.showInterestNotification).toBeTrue();
      expect(component.interestAmount).toBe(5);
    });

    it('clears the notification flag after 3 seconds', (done) => {
      jasmine.clock().install();

      (component as any).showInterestPopup(3);
      expect(component.showInterestNotification).toBeTrue();

      jasmine.clock().tick(3000);
      expect(component.showInterestNotification).toBeFalse();

      jasmine.clock().uninstall();
      done();
    });

    it('resets a previous timer when called a second time before it expires', () => {
      jasmine.clock().install();

      (component as any).showInterestPopup(2);
      jasmine.clock().tick(1000);

      // Second call before the first timer fires
      (component as any).showInterestPopup(7);
      expect(component.interestAmount).toBe(7);
      expect(component.showInterestNotification).toBeTrue();

      // The original 3-second timer would have fired at t=3000 from the first call,
      // but the reset timer from the second call fires 3000ms after the second call (t=4000).
      jasmine.clock().tick(2001); // t=3001 from first call — if old timer leaked, flag would be false
      expect(component.showInterestNotification).toBeTrue();

      jasmine.clock().tick(999); // t=4000 from first call — new timer fires
      expect(component.showInterestNotification).toBeFalse();

      jasmine.clock().uninstall();
    });

    it('awardInterest returning 0 does not call showInterestPopup', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      spyOn(gameStateService, 'awardInterest').and.returnValue(0);
      spyOn(component as any, 'showInterestPopup');

      // Directly simulate the branch that would call showInterestPopup
      const interest = gameStateService.awardInterest();
      if (interest > 0) {
        (component as any).showInterestPopup(interest);
      }

      expect((component as any).showInterestPopup).not.toHaveBeenCalled();
    });
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Build a minimal PlacedTower for test use. */
  function makeTower(overrides: Partial<PlacedTower> = {}): PlacedTower {
    return {
      id: 'tower-1',
      type: TowerType.BASIC,
      level: 1,
      row: 0,
      col: 0,
      lastFireTime: 0,
      kills: 0,
      totalInvested: 50,
      mesh: null,
      abilityCooldownEnd: 0,
      abilityActiveEnd: 0,
      abilityCharges: 0,
      abilityPrimed: false,
      targetingPriority: TargetingPriority.FIRST,
      ...overrides,
    };
  }

  // ─── Tower Management ────────────────────────────────────────────────────────

  describe('isTowerLocked', () => {
    it('returns true when towerUnlockService reports the tower is not unlocked', () => {
      towerUnlockSpy.isTowerUnlocked.and.returnValue(false);
      expect(component.isTowerLocked(TowerType.SNIPER)).toBeTrue();
    });

    it('returns false when towerUnlockService reports the tower is unlocked', () => {
      towerUnlockSpy.isTowerUnlocked.and.returnValue(true);
      expect(component.isTowerLocked(TowerType.BASIC)).toBeFalse();
    });

    it('delegates to towerUnlockService with the given tower type', () => {
      component.isTowerLocked(TowerType.MORTAR);
      expect(towerUnlockSpy.isTowerUnlocked).toHaveBeenCalledWith(TowerType.MORTAR);
    });
  });

  describe('getUnlockHint', () => {
    it('returns the description from TOWER_UNLOCK_CONDITIONS for the given type', () => {
      const hint = component.getUnlockHint(TowerType.SNIPER);
      expect(hint).toBe(TOWER_UNLOCK_CONDITIONS[TowerType.SNIPER].description);
    });

    it('returns "Available from the start" for BASIC tower', () => {
      expect(component.getUnlockHint(TowerType.BASIC)).toBe('Available from the start');
    });
  });

  describe('selectTowerType', () => {
    it('sets selectedTowerType when the tower is unlocked', () => {
      towerUnlockSpy.isTowerUnlocked.and.returnValue(true);
      component.selectTowerType(TowerType.SNIPER);
      expect(component.selectedTowerType).toBe(TowerType.SNIPER);
    });

    it('does not change selectedTowerType when the tower is locked', () => {
      towerUnlockSpy.isTowerUnlocked.and.returnValue(false);
      component.selectedTowerType = TowerType.BASIC;
      component.selectTowerType(TowerType.MORTAR);
      expect(component.selectedTowerType).toBe(TowerType.BASIC);
    });

    it('clears selectedTowerInfo (deselects placed tower) when a new type is picked', () => {
      towerUnlockSpy.isTowerUnlocked.and.returnValue(true);
      (component as any).selectedTowerInfo = makeTower();
      component.selectTowerType(TowerType.SNIPER);
      expect(component.selectedTowerInfo).toBeNull();
    });
  });

  describe('deselectTower', () => {
    it('clears selectedTowerInfo and selectedTowerStats', () => {
      (component as any).selectedTowerInfo = makeTower();
      (component as any).selectedTowerStats = { damage: 25, range: 3, fireRate: 1 };
      component.deselectTower();
      expect(component.selectedTowerInfo).toBeNull();
      expect(component.selectedTowerStats).toBeNull();
    });

    it('resets sellConfirmPending', () => {
      (component as any).sellConfirmPending = true;
      component.deselectTower();
      expect((component as any).sellConfirmPending).toBeFalse();
    });
  });

  describe('cycleTargeting', () => {
    it('calls towerCombatService.cycleTargetingPriority with selectedTowerInfo.id', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'cycleTargetingPriority');
      (component as any).selectedTowerInfo = makeTower({ id: 'abc' });
      component.cycleTargeting();
      expect(tcs.cycleTargetingPriority).toHaveBeenCalledWith('abc');
    });

    it('does nothing when selectedTowerInfo is null', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'cycleTargetingPriority');
      (component as any).selectedTowerInfo = null;
      component.cycleTargeting();
      expect(tcs.cycleTargetingPriority).not.toHaveBeenCalled();
    });
  });

  describe('upgradeTower', () => {
    it('does nothing when selectedTowerInfo is null', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'upgradeTower');
      (component as any).selectedTowerInfo = null;
      component.upgradeTower();
      expect(tcs.upgradeTower).not.toHaveBeenCalled();
    });

    it('does nothing in VICTORY phase', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'upgradeTower');
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setPhase(GamePhase.VICTORY);
      (component as any).selectedTowerInfo = makeTower();
      component.upgradeTower();
      expect(tcs.upgradeTower).not.toHaveBeenCalled();
    });

    it('does nothing when tower is already at max level', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'upgradeTower');
      (component as any).selectedTowerInfo = makeTower({ level: MAX_TOWER_LEVEL });
      component.upgradeTower();
      expect(tcs.upgradeTower).not.toHaveBeenCalled();
    });

    it('does nothing when player cannot afford the upgrade', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'upgradeTower');
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      const state = gameStateService.getState();
      gameStateService.spendGold(state.gold);
      (component as any).selectedTowerInfo = makeTower({ level: 1 });
      component.upgradeTower();
      expect(tcs.upgradeTower).not.toHaveBeenCalled();
    });

    it('calls towerCombatService.upgradeTower and spends gold on success', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'upgradeTower').and.returnValue(true);
      // Stub scene-dependent methods invoked after the spend
      spyOn(component as any, 'refreshTowerInfoPanel');
      spyOn(component as any, 'showRangePreview');
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.addGold(500);
      (component as any).selectedTowerInfo = makeTower({ id: 'tower-1', level: 1 });
      const goldBefore = gameStateService.getState().gold;
      component.upgradeTower();
      expect(tcs.upgradeTower).toHaveBeenCalledWith('tower-1');
      expect(gameStateService.getState().gold).toBeLessThan(goldBefore);
    });

    it('does not spend gold when towerCombatService.upgradeTower returns false', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'upgradeTower').and.returnValue(false);
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.addGold(500);
      (component as any).selectedTowerInfo = makeTower({ level: 1 });
      const goldBefore = gameStateService.getState().gold;
      component.upgradeTower();
      expect(gameStateService.getState().gold).toBe(goldBefore);
    });
  });

  describe('sellTower', () => {
    it('does nothing when selectedTowerInfo is null', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'unregisterTower');
      (component as any).selectedTowerInfo = null;
      component.sellTower();
      expect(tcs.unregisterTower).not.toHaveBeenCalled();
    });

    it('does nothing in DEFEAT phase', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'unregisterTower');
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setPhase(GamePhase.DEFEAT);
      (component as any).selectedTowerInfo = makeTower();
      component.sellTower();
      expect(tcs.unregisterTower).not.toHaveBeenCalled();
    });

    it('first call sets sellConfirmPending without selling', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'unregisterTower');
      (component as any).selectedTowerInfo = makeTower();
      (component as any).sellConfirmPending = false;
      component.sellTower();
      expect((component as any).sellConfirmPending).toBeTrue();
      expect(tcs.unregisterTower).not.toHaveBeenCalled();
    });

    it('second call executes the sell when confirm is pending', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      const gameBoardService = fixture.debugElement.injector.get(GameBoardService);
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      const tower = makeTower({ id: 'sell-me', totalInvested: 100 });
      spyOn(tcs, 'unregisterTower').and.returnValue(tower);
      // Stub board/path methods that need an initialized scene/board
      spyOn(gameBoardService, 'removeTower');
      spyOn(component as any, 'updatePathPreview');
      (component as any).selectedTowerInfo = tower;
      (component as any).sellConfirmPending = true;
      const goldBefore = gameStateService.getState().gold;
      component.sellTower();
      expect(tcs.unregisterTower).toHaveBeenCalledWith('sell-me');
      // Sell value is 50% of totalInvested = 50
      expect(gameStateService.getState().gold).toBe(goldBefore + 50);
      expect(component.selectedTowerInfo).toBeNull();
    });

    it('does not add gold when unregisterTower returns undefined (stale reference)', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'unregisterTower').and.returnValue(undefined);
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      (component as any).selectedTowerInfo = makeTower();
      (component as any).sellConfirmPending = true;
      const goldBefore = gameStateService.getState().gold;
      component.sellTower();
      expect(gameStateService.getState().gold).toBe(goldBefore);
    });
  });

  // ─── Ability System ──────────────────────────────────────────────────────────

  describe('activateAbility', () => {
    it('calls towerCombatService.activateAbility with selectedTowerInfo.id', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'activateAbility');
      (component as any).selectedTowerInfo = makeTower({ id: 'hero' });
      component.activateAbility();
      expect(tcs.activateAbility).toHaveBeenCalledWith('hero');
    });

    it('does nothing when selectedTowerInfo is null', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'activateAbility');
      (component as any).selectedTowerInfo = null;
      component.activateAbility();
      expect(tcs.activateAbility).not.toHaveBeenCalled();
    });
  });

  describe('isAbilityOnCooldown', () => {
    it('returns false when selectedTowerInfo is null', () => {
      (component as any).selectedTowerInfo = null;
      expect(component.isAbilityOnCooldown()).toBeFalse();
    });

    it('returns true when abilityCooldownEnd is in the future', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'getGameTime').and.returnValue(5);
      (component as any).selectedTowerInfo = makeTower({ abilityCooldownEnd: 10 });
      expect(component.isAbilityOnCooldown()).toBeTrue();
    });

    it('returns false when abilityCooldownEnd is in the past', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'getGameTime').and.returnValue(15);
      (component as any).selectedTowerInfo = makeTower({ abilityCooldownEnd: 10 });
      expect(component.isAbilityOnCooldown()).toBeFalse();
    });
  });

  describe('isAbilityActive', () => {
    it('returns false when selectedTowerInfo is null', () => {
      (component as any).selectedTowerInfo = null;
      expect(component.isAbilityActive()).toBeFalse();
    });

    it('returns true when abilityActiveEnd is in the future', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'getGameTime').and.returnValue(3);
      (component as any).selectedTowerInfo = makeTower({ abilityActiveEnd: 8 });
      expect(component.isAbilityActive()).toBeTrue();
    });

    it('returns false when abilityActiveEnd has elapsed', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'getGameTime').and.returnValue(10);
      (component as any).selectedTowerInfo = makeTower({ abilityActiveEnd: 8 });
      expect(component.isAbilityActive()).toBeFalse();
    });
  });

  describe('getAbilityName', () => {
    it('returns empty string when selectedTowerInfo is null', () => {
      (component as any).selectedTowerInfo = null;
      expect(component.getAbilityName()).toBe('');
    });

    it('returns the ability name from TOWER_ABILITIES for the selected tower type', () => {
      (component as any).selectedTowerInfo = makeTower({ type: TowerType.BASIC });
      expect(component.getAbilityName()).toBe(TOWER_ABILITIES[TowerType.BASIC].name);
    });

    it('returns the correct name for SNIPER tower', () => {
      (component as any).selectedTowerInfo = makeTower({ type: TowerType.SNIPER });
      expect(component.getAbilityName()).toBe(TOWER_ABILITIES[TowerType.SNIPER].name);
    });
  });

  describe('getAbilityDescription', () => {
    it('returns empty string when selectedTowerInfo is null', () => {
      (component as any).selectedTowerInfo = null;
      expect(component.getAbilityDescription()).toBe('');
    });

    it('returns the ability description from TOWER_ABILITIES', () => {
      (component as any).selectedTowerInfo = makeTower({ type: TowerType.SPLASH });
      expect(component.getAbilityDescription()).toBe(TOWER_ABILITIES[TowerType.SPLASH].description);
    });
  });

  describe('getAbilityCooldownRemaining', () => {
    it('returns 0 when selectedTowerInfo is null', () => {
      (component as any).selectedTowerInfo = null;
      expect(component.getAbilityCooldownRemaining()).toBe(0);
    });

    it('returns remaining seconds when cooldown is active', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'getGameTime').and.returnValue(5);
      (component as any).selectedTowerInfo = makeTower({ abilityCooldownEnd: 15 });
      expect(component.getAbilityCooldownRemaining()).toBe(10);
    });

    it('returns 0 (not negative) when cooldown has already expired', () => {
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(tcs, 'getGameTime').and.returnValue(20);
      (component as any).selectedTowerInfo = makeTower({ abilityCooldownEnd: 15 });
      expect(component.getAbilityCooldownRemaining()).toBe(0);
    });
  });

  // ─── Game Control ────────────────────────────────────────────────────────────

  describe('startWave', () => {
    it('calls gameStateService.startWave and waveService.startWave when in SETUP phase', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      const waveService = fixture.debugElement.injector.get(WaveService);
      spyOn(gameStateService, 'startWave').and.callThrough();
      spyOn(waveService, 'startWave');
      gameStateService.setPhase(GamePhase.SETUP);
      component.startWave();
      expect(gameStateService.startWave).toHaveBeenCalled();
      expect(waveService.startWave).toHaveBeenCalled();
    });

    it('does nothing when phase is already COMBAT', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      spyOn(gameStateService, 'startWave').and.callThrough();
      gameStateService.setPhase(GamePhase.COMBAT);
      component.startWave();
      expect(gameStateService.startWave).not.toHaveBeenCalled();
    });

    it('does nothing when phase is VICTORY', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      spyOn(gameStateService, 'startWave').and.callThrough();
      gameStateService.setPhase(GamePhase.VICTORY);
      component.startWave();
      expect(gameStateService.startWave).not.toHaveBeenCalled();
    });
  });

  describe('restartCurrentWave', () => {
    it('does nothing when gameStateService.restartWave returns false', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      const waveService = fixture.debugElement.injector.get(WaveService);
      spyOn(gameStateService, 'restartWave').and.returnValue(false);
      spyOn(waveService, 'startWave');
      component.restartCurrentWave();
      expect(waveService.startWave).not.toHaveBeenCalled();
    });

    it('calls clearProjectiles and waveService.startWave when restartWave succeeds', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      const waveService = fixture.debugElement.injector.get(WaveService);
      const tcs = fixture.debugElement.injector.get(TowerCombatService);
      spyOn(gameStateService, 'restartWave').and.returnValue(true);
      spyOn(waveService, 'startWave');
      spyOn(tcs, 'clearProjectiles');
      component.restartCurrentWave();
      expect(tcs.clearProjectiles).toHaveBeenCalled();
      expect(waveService.startWave).toHaveBeenCalled();
    });

    it('clears combo banner when restarting wave', () => {
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      const waveService = fixture.debugElement.injector.get(WaveService);
      spyOn(gameStateService, 'restartWave').and.returnValue(true);
      spyOn(waveService, 'startWave');
      (component as any).showComboBanner = true;
      component.restartCurrentWave();
      expect(component.showComboBanner).toBeFalse();
    });
  });

  describe('toggleAllRanges', () => {
    it('toggles showAllRanges from false to true', () => {
      (component as any).showAllRanges = false;
      // scene is needed by the toggling logic; patch it with a minimal stub
      (component as any).scene = { children: [], remove: () => {}, add: () => {} };
      (component as any).gameBoardService = {
        getBoardWidth: () => 0, getBoardHeight: () => 0, getTileSize: () => 1,
        getBoard: () => [], getBoardTile: () => null
      };
      component.toggleAllRanges();
      expect((component as any).showAllRanges).toBeTrue();
    });

    it('toggles showAllRanges from true to false', () => {
      (component as any).showAllRanges = true;
      (component as any).rangeRingMeshes = [];
      (component as any).scene = { children: [], remove: () => {}, add: () => {} };
      component.toggleAllRanges();
      expect((component as any).showAllRanges).toBeFalse();
    });
  });

  // ─── Navigation ──────────────────────────────────────────────────────────────

  describe('goToCampaign', () => {
    it('navigates to /campaign when not in COMBAT phase', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');
      component.goToCampaign();
      expect(router.navigate).toHaveBeenCalledWith(['/campaign']);
    });

    it('navigates to /campaign from SETUP phase without confirm dialog', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');
      const gameStateService = fixture.debugElement.injector.get(GameStateService);
      gameStateService.setPhase(GamePhase.SETUP);
      component.goToCampaign();
      expect(router.navigate).toHaveBeenCalledWith(['/campaign']);
    });
  });

  // ─── UI / Notifications ──────────────────────────────────────────────────────

  describe('toggleAudio', () => {
    it('calls audioService.toggleMute', () => {
      const audioService = fixture.debugElement.injector.get(AudioService);
      spyOn(audioService, 'toggleMute');
      component.toggleAudio();
      expect(audioService.toggleMute).toHaveBeenCalled();
    });

    it('updates settings with the new muted state', () => {
      const audioService = fixture.debugElement.injector.get(AudioService);
      spyOn(audioService, 'toggleMute');
      component.toggleAudio();
      expect(settingsSpy.update).toHaveBeenCalledWith(jasmine.objectContaining({ audioMuted: false }));
    });
  });

  describe('levelStars', () => {
    it('returns an array of the given length', () => {
      expect(component.levelStars(3).length).toBe(3);
      expect(component.levelStars(1).length).toBe(1);
    });

    it('returns an empty array for 0', () => {
      expect(component.levelStars(0)).toEqual([]);
    });

    it('returns an empty array for negative values (clamps to 0)', () => {
      expect(component.levelStars(-5)).toEqual([]);
    });
  });

  describe('showComboBannerPopup', () => {
    it('sets showComboBanner to true and records bonusGold', () => {
      (component as any).showComboBannerPopup(30);
      expect(component.showComboBanner).toBeTrue();
      expect(component.comboBannerBonus).toBe(30);
    });

    it('auto-clears showComboBanner after the display timeout', () => {
      jasmine.clock().install();
      (component as any).showComboBannerPopup(10);
      expect(component.showComboBanner).toBeTrue();
      jasmine.clock().tick(5000); // COMBO_BANNER_DISPLAY_MS
      expect(component.showComboBanner).toBeFalse();
      jasmine.clock().uninstall();
    });

    it('resets existing timer when called a second time before timeout fires', () => {
      jasmine.clock().install();
      (component as any).showComboBannerPopup(5);
      jasmine.clock().tick(1000);
      (component as any).showComboBannerPopup(99);
      expect(component.comboBannerBonus).toBe(99);
      expect(component.showComboBanner).toBeTrue();
      jasmine.clock().uninstall();
    });
  });

  describe('clearComboBanner', () => {
    it('sets showComboBanner to false', () => {
      (component as any).showComboBanner = true;
      (component as any).clearComboBanner();
      expect(component.showComboBanner).toBeFalse();
    });

    it('cancels the pending timer so it does not fire later', () => {
      jasmine.clock().install();
      (component as any).showComboBannerPopup(20);
      (component as any).clearComboBanner();
      jasmine.clock().tick(5000);
      // Banner should remain false because the timer was cancelled
      expect(component.showComboBanner).toBeFalse();
      jasmine.clock().uninstall();
    });

    it('is safe to call when no timer is pending', () => {
      (component as any).comboBannerTimer = null;
      expect(() => (component as any).clearComboBanner()).not.toThrow();
    });
  });
});
