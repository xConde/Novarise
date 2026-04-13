import { TestBed } from '@angular/core/testing';
import { GamePauseService } from './game-pause.service';
import { GameStateService } from './game-state.service';
import { MinimapService } from './minimap.service';
import { GameEndService } from './game-end.service';
import { GamePhase, DifficultyLevel, INITIAL_GAME_STATE } from '../models/game-state.model';

describe('GamePauseService', () => {
  let service: GamePauseService;
  let gameStateSpy: jasmine.SpyObj<GameStateService>;
  let minimapSpy: jasmine.SpyObj<MinimapService>;
  let gameEndSpy: jasmine.SpyObj<GameEndService>;

  beforeEach(() => {
    gameStateSpy = jasmine.createSpyObj('GameStateService', ['getState', 'togglePause']);
    minimapSpy = jasmine.createSpyObj('MinimapService', ['setDimmed']);
    gameEndSpy = jasmine.createSpyObj('GameEndService', ['recordEnd']);

    gameStateSpy.getState.and.returnValue({ ...INITIAL_GAME_STATE });

    TestBed.configureTestingModule({
      providers: [
        GamePauseService,
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: MinimapService, useValue: minimapSpy },
        { provide: GameEndService, useValue: gameEndSpy },
      ],
    });

    service = TestBed.inject(GamePauseService);
  });

  afterEach(() => {
    service.cleanup();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('togglePause', () => {
    it('should return true when pausing (was not paused)', () => {
      const result = service.togglePause();
      expect(result).toBeTrue();
      expect(gameStateSpy.togglePause).toHaveBeenCalled();
      expect(minimapSpy.setDimmed).toHaveBeenCalledWith(true);
    });

    it('should return false when unpausing (was paused)', () => {
      gameStateSpy.getState.and.returnValue({
        ...INITIAL_GAME_STATE,
        phase: GamePhase.COMBAT,
        isPaused: true,
        wave: 1,
      });

      const result = service.togglePause();
      expect(result).toBeFalse();
      expect(gameStateSpy.togglePause).toHaveBeenCalled();
      expect(minimapSpy.setDimmed).toHaveBeenCalledWith(false);
    });

    it('should reset showQuitConfirm and autoPaused on toggle', () => {
      service.showQuitConfirm = true;
      service.togglePause();
      expect(service.showQuitConfirm).toBeFalse();
      expect(service.autoPaused).toBeFalse();
    });
  });

  describe('quit flow', () => {
    it('should set showQuitConfirm on requestQuit', () => {
      service.requestQuit();
      expect(service.showQuitConfirm).toBeTrue();
    });

    it('should clear showQuitConfirm on cancelQuit', () => {
      service.requestQuit();
      service.cancelQuit();
      expect(service.showQuitConfirm).toBeFalse();
    });

    it('should record defeat and return /run route (run hub)', () => {
      const route = service.confirmQuit();
      expect(route).toBe('/run');
      expect(gameEndSpy.recordEnd).toHaveBeenCalledWith(false, null);
      expect(service.showQuitConfirm).toBeFalse();
    });
  });

  describe('requestGuardDecision', () => {
    it('should emit true immediately during SETUP phase', (done) => {
      service.requestGuardDecision().subscribe(result => {
        expect(result).toBeTrue();
        done();
      });
    });

    it('should emit true immediately during VICTORY phase', (done) => {
      gameStateSpy.getState.and.returnValue({
        ...INITIAL_GAME_STATE,
        phase: GamePhase.VICTORY,
        wave: 10,
        score: 1000,
        elapsedTime: 120,
      });
      service.requestGuardDecision().subscribe(result => {
        expect(result).toBeTrue();
        done();
      });
    });

    it('should emit true immediately during DEFEAT phase', (done) => {
      gameStateSpy.getState.and.returnValue({
        ...INITIAL_GAME_STATE,
        phase: GamePhase.DEFEAT,
        wave: 5,
        lives: 0,
        score: 500,
        elapsedTime: 60,
      });
      service.requestGuardDecision().subscribe(result => {
        expect(result).toBeTrue();
        done();
      });
    });

    it('should pause the game and set showNavigationPrompt during COMBAT phase', () => {
      gameStateSpy.getState.and.returnValue({
        ...INITIAL_GAME_STATE,
        phase: GamePhase.COMBAT,
        wave: 1,
        isPaused: false,
      });
      service.requestGuardDecision();
      expect(gameStateSpy.togglePause).toHaveBeenCalled();
      expect(minimapSpy.setDimmed).toHaveBeenCalledWith(true);
      expect(service.showNavigationPrompt).toBeTrue();
      expect(service.showQuitConfirm).toBeFalse();
      // clean up the pending subject
      service.resolveGuardDecision(false);
    });

    it('should not double-pause if already paused during COMBAT phase', () => {
      gameStateSpy.getState.and.returnValue({
        ...INITIAL_GAME_STATE,
        phase: GamePhase.COMBAT,
        wave: 1,
        isPaused: true,
      });
      service.requestGuardDecision();
      expect(gameStateSpy.togglePause).not.toHaveBeenCalled();
      // clean up the pending subject
      service.resolveGuardDecision(false);
    });
  });

  describe('resolveGuardDecision', () => {
    it('should emit true and clear showNavigationPrompt when allowed', (done) => {
      gameStateSpy.getState.and.returnValue({
        ...INITIAL_GAME_STATE,
        phase: GamePhase.COMBAT,
        wave: 1,
        isPaused: true,
      });
      service.requestGuardDecision().subscribe(result => {
        expect(result).toBeTrue();
        expect(service.showNavigationPrompt).toBeFalse();
        done();
      });
      service.resolveGuardDecision(true);
    });

    it('should emit false and clear showNavigationPrompt when denied', (done) => {
      gameStateSpy.getState.and.returnValue({
        ...INITIAL_GAME_STATE,
        phase: GamePhase.COMBAT,
        wave: 1,
        isPaused: true,
      });
      service.requestGuardDecision().subscribe(result => {
        expect(result).toBeFalse();
        expect(service.showNavigationPrompt).toBeFalse();
        done();
      });
      service.resolveGuardDecision(false);
    });
  });

  describe('reset', () => {
    it('should clear autoPaused, showQuitConfirm, and showNavigationPrompt', () => {
      service.requestQuit();
      service.showNavigationPrompt = true;
      service.reset();
      expect(service.autoPaused).toBeFalse();
      expect(service.showQuitConfirm).toBeFalse();
      expect(service.showNavigationPrompt).toBeFalse();
    });
  });

  describe('isPaused', () => {
    it('should reflect game state', () => {
      expect(service.isPaused).toBeFalse();
    });

    it('should return true when game is paused', () => {
      gameStateSpy.getState.and.returnValue({
        ...INITIAL_GAME_STATE,
        phase: GamePhase.COMBAT,
        isPaused: true,
        wave: 1,
      });
      expect(service.isPaused).toBeTrue();
    });
  });

  describe('setupAutoPause + cleanup', () => {
    it('should register and remove event listeners', () => {
      spyOn(document, 'addEventListener').and.callThrough();
      spyOn(document, 'removeEventListener').and.callThrough();
      spyOn(window, 'addEventListener').and.callThrough();
      spyOn(window, 'removeEventListener').and.callThrough();

      service.setupAutoPause();
      expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', jasmine.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('blur', jasmine.any(Function));

      service.cleanup();
      expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', jasmine.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('blur', jasmine.any(Function));
    });

    it('should not throw on double cleanup', () => {
      service.setupAutoPause();
      service.cleanup();
      expect(() => service.cleanup()).not.toThrow();
    });
  });
});
