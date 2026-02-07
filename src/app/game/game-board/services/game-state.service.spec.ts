import { TestBed } from '@angular/core/testing';
import { GameStateService } from './game-state.service';
import { GamePhase, INITIAL_GAME_STATE } from '../models/game-state.model';

describe('GameStateService', () => {
  let service: GameStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GameStateService]
    });
    service = TestBed.inject(GameStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- Initial State ---

  describe('initial state', () => {
    it('should start in SETUP phase', () => {
      expect(service.getState().phase).toBe(GamePhase.SETUP);
    });

    it('should start at wave 0', () => {
      expect(service.getState().wave).toBe(0);
    });

    it('should start with 20 lives', () => {
      expect(service.getState().lives).toBe(INITIAL_GAME_STATE.lives);
    });

    it('should start with 200 gold', () => {
      expect(service.getState().gold).toBe(INITIAL_GAME_STATE.gold);
    });

    it('should start with 0 score', () => {
      expect(service.getState().score).toBe(0);
    });

    it('should emit initial state via observable', (done) => {
      service.getState$().subscribe(state => {
        expect(state.phase).toBe(GamePhase.SETUP);
        done();
      });
    });
  });

  // --- startWave ---

  describe('startWave', () => {
    it('should increment wave number', () => {
      service.startWave();
      expect(service.getState().wave).toBe(1);
    });

    it('should set phase to COMBAT', () => {
      service.startWave();
      expect(service.getState().phase).toBe(GamePhase.COMBAT);
    });

    it('should increment wave on each call', () => {
      service.startWave();
      service.startWave();
      service.startWave();
      expect(service.getState().wave).toBe(3);
    });

    it('should emit state change', (done) => {
      let emitCount = 0;
      service.getState$().subscribe(state => {
        emitCount++;
        if (emitCount === 2) { // Skip initial BehaviorSubject emission
          expect(state.phase).toBe(GamePhase.COMBAT);
          expect(state.wave).toBe(1);
          done();
        }
      });
      service.startWave();
    });
  });

  // --- completeWave ---

  describe('completeWave', () => {
    beforeEach(() => {
      service.startWave(); // wave 1, COMBAT
    });

    it('should add reward gold', () => {
      const goldBefore = service.getState().gold;
      service.completeWave(50);
      expect(service.getState().gold).toBe(goldBefore + 50);
    });

    it('should add reward to score', () => {
      const scoreBefore = service.getState().score;
      service.completeWave(50);
      expect(service.getState().score).toBe(scoreBefore + 50);
    });

    it('should transition to INTERMISSION when waves remain', () => {
      service.completeWave(25);
      expect(service.getState().phase).toBe(GamePhase.INTERMISSION);
    });

    it('should transition to VICTORY on final wave', () => {
      // Advance to max waves
      const maxWaves = service.getState().maxWaves;
      for (let i = 1; i < maxWaves; i++) {
        service.startWave();
      }
      expect(service.getState().wave).toBe(maxWaves);

      service.completeWave(250);
      expect(service.getState().phase).toBe(GamePhase.VICTORY);
    });

    it('should handle zero reward', () => {
      const goldBefore = service.getState().gold;
      service.completeWave(0);
      expect(service.getState().gold).toBe(goldBefore);
    });
  });

  // --- loseLife ---

  describe('loseLife', () => {
    it('should reduce lives by 1 by default', () => {
      const livesBefore = service.getState().lives;
      service.loseLife();
      expect(service.getState().lives).toBe(livesBefore - 1);
    });

    it('should reduce lives by specified amount', () => {
      const livesBefore = service.getState().lives;
      service.loseLife(5);
      expect(service.getState().lives).toBe(livesBefore - 5);
    });

    it('should clamp lives at 0', () => {
      service.loseLife(999);
      expect(service.getState().lives).toBe(0);
    });

    it('should set DEFEAT when lives reach 0', () => {
      service.loseLife(INITIAL_GAME_STATE.lives);
      expect(service.getState().phase).toBe(GamePhase.DEFEAT);
    });

    it('should not set DEFEAT if lives remain', () => {
      service.startWave(); // COMBAT
      service.loseLife(1);
      expect(service.getState().phase).toBe(GamePhase.COMBAT);
    });

    it('should set DEFEAT when lives go below 0 (overkill)', () => {
      service.loseLife(INITIAL_GAME_STATE.lives + 10);
      expect(service.getState().lives).toBe(0);
      expect(service.getState().phase).toBe(GamePhase.DEFEAT);
    });
  });

  // --- Gold Management ---

  describe('gold management', () => {
    it('addGold should increase gold and score', () => {
      const goldBefore = service.getState().gold;
      const scoreBefore = service.getState().score;
      service.addGold(30);
      expect(service.getState().gold).toBe(goldBefore + 30);
      expect(service.getState().score).toBe(scoreBefore + 30);
    });

    it('spendGold should deduct gold when affordable', () => {
      const goldBefore = service.getState().gold;
      const result = service.spendGold(50);
      expect(result).toBeTrue();
      expect(service.getState().gold).toBe(goldBefore - 50);
    });

    it('spendGold should NOT deduct when unaffordable', () => {
      const goldBefore = service.getState().gold;
      const result = service.spendGold(999);
      expect(result).toBeFalse();
      expect(service.getState().gold).toBe(goldBefore);
    });

    it('spendGold should not affect score', () => {
      const scoreBefore = service.getState().score;
      service.spendGold(50);
      expect(service.getState().score).toBe(scoreBefore);
    });

    it('canAfford should return true when gold is sufficient', () => {
      expect(service.canAfford(50)).toBeTrue();
    });

    it('canAfford should return false when gold is insufficient', () => {
      expect(service.canAfford(999)).toBeFalse();
    });

    it('canAfford should return true when gold equals cost exactly', () => {
      expect(service.canAfford(INITIAL_GAME_STATE.gold)).toBeTrue();
    });

    it('spendGold should allow spending exact balance', () => {
      const result = service.spendGold(INITIAL_GAME_STATE.gold);
      expect(result).toBeTrue();
      expect(service.getState().gold).toBe(0);
    });
  });

  // --- addScore ---

  describe('addScore', () => {
    it('should increase score without affecting gold', () => {
      const goldBefore = service.getState().gold;
      service.addScore(100);
      expect(service.getState().score).toBe(100);
      expect(service.getState().gold).toBe(goldBefore);
    });
  });

  // --- setPhase ---

  describe('setPhase', () => {
    it('should directly set the phase', () => {
      service.setPhase(GamePhase.VICTORY);
      expect(service.getState().phase).toBe(GamePhase.VICTORY);
    });
  });

  // --- reset ---

  describe('reset', () => {
    it('should restore initial state', () => {
      // Dirty the state
      service.startWave();
      service.addGold(500);
      service.loseLife(5);
      service.addScore(1000);

      service.reset();

      const state = service.getState();
      expect(state.phase).toBe(GamePhase.SETUP);
      expect(state.wave).toBe(0);
      expect(state.lives).toBe(INITIAL_GAME_STATE.lives);
      expect(state.gold).toBe(INITIAL_GAME_STATE.gold);
      expect(state.score).toBe(0);
    });

    it('should emit the reset state', (done) => {
      service.startWave(); // dirty
      let emitCount = 0;
      service.getState$().subscribe(state => {
        emitCount++;
        if (emitCount === 2) { // Skip current value emission
          expect(state.phase).toBe(GamePhase.SETUP);
          expect(state.wave).toBe(0);
          done();
        }
      });
      service.reset();
    });
  });

  // --- Observable contract ---

  describe('observable contract', () => {
    it('should emit a new object on each state change (immutable copies)', () => {
      const refs: any[] = [];
      const sub = service.getState$().subscribe(state => refs.push(state));

      service.startWave();
      service.addGold(10);

      expect(refs.length).toBe(3); // initial + startWave + addGold
      expect(refs[0]).not.toBe(refs[1]);
      expect(refs[1]).not.toBe(refs[2]);

      sub.unsubscribe();
    });

    it('getState() should return the live mutable state', () => {
      const state1 = service.getState();
      service.startWave();
      const state2 = service.getState();
      // Same reference (live object)
      expect(state1).toBe(state2);
      expect(state1.wave).toBe(1);
    });
  });
});
