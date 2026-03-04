import { TestBed } from '@angular/core/testing';
import { GameStateService } from './game-state.service';
import { DifficultyLevel, DIFFICULTY_PRESETS, GamePhase, INITIAL_GAME_STATE, INTEREST_CONFIG } from '../models/game-state.model';

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

    it('should not increment wave past maxWaves', () => {
      const maxWaves = service.getState().maxWaves;
      // Advance through all waves via startWave + completeWave cycle
      for (let i = 0; i < maxWaves; i++) {
        service.startWave();
      }
      expect(service.getState().wave).toBe(maxWaves);

      // Try to go past — should be a no-op
      service.startWave();
      expect(service.getState().wave).toBe(maxWaves);
    });

    it('should not change phase when called past maxWaves', () => {
      const maxWaves = service.getState().maxWaves;
      for (let i = 0; i < maxWaves; i++) {
        service.startWave();
      }
      // Complete the final wave → VICTORY
      service.completeWave(100);
      expect(service.getState().phase).toBe(GamePhase.VICTORY);

      // startWave should not override VICTORY
      service.startWave();
      expect(service.getState().phase).toBe(GamePhase.VICTORY);
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

    it('should be a no-op when called in SETUP phase', () => {
      service.reset(); // Back to SETUP
      const goldBefore = service.getState().gold;
      service.completeWave(999);
      expect(service.getState().gold).toBe(goldBefore);
      expect(service.getState().phase).toBe(GamePhase.SETUP);
    });

    it('should be a no-op when called in INTERMISSION phase', () => {
      service.completeWave(25); // wave 1 complete → INTERMISSION
      expect(service.getState().phase).toBe(GamePhase.INTERMISSION);
      const goldBefore = service.getState().gold;
      service.completeWave(999); // should be ignored
      expect(service.getState().gold).toBe(goldBefore);
      expect(service.getState().phase).toBe(GamePhase.INTERMISSION);
    });

    it('should be a no-op when called in VICTORY phase', () => {
      const maxWaves = service.getState().maxWaves;
      for (let i = 1; i < maxWaves; i++) {
        service.startWave();
      }
      service.completeWave(100); // final wave → VICTORY
      expect(service.getState().phase).toBe(GamePhase.VICTORY);
      const goldBefore = service.getState().gold;
      service.completeWave(999); // should be ignored
      expect(service.getState().gold).toBe(goldBefore);
    });

    it('should be a no-op when called in DEFEAT phase', () => {
      service.loseLife(INITIAL_GAME_STATE.lives); // → DEFEAT
      const goldBefore = service.getState().gold;
      service.completeWave(999);
      expect(service.getState().gold).toBe(goldBefore);
      expect(service.getState().phase).toBe(GamePhase.DEFEAT);
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

    it('should be a no-op when called during VICTORY', () => {
      const maxWaves = service.getState().maxWaves;
      for (let i = 0; i < maxWaves; i++) {
        service.startWave();
      }
      service.completeWave(100); // → VICTORY
      const livesBefore = service.getState().lives;
      service.loseLife(5);
      expect(service.getState().lives).toBe(livesBefore);
      expect(service.getState().phase).toBe(GamePhase.VICTORY);
    });

    it('should be a no-op when called during DEFEAT', () => {
      service.startWave(); // → COMBAT
      service.loseLife(INITIAL_GAME_STATE.lives); // → DEFEAT
      expect(service.getState().phase).toBe(GamePhase.DEFEAT);
      service.loseLife(1); // should be ignored
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

    it('spendGold should reject negative amounts', () => {
      const goldBefore = service.getState().gold;
      const result = service.spendGold(-100);
      expect(result).toBeFalse();
      expect(service.getState().gold).toBe(goldBefore);
    });

    it('spendGold should reject zero amount', () => {
      const goldBefore = service.getState().gold;
      const result = service.spendGold(0);
      expect(result).toBeFalse();
      expect(service.getState().gold).toBe(goldBefore);
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

  // --- setDifficulty ---

  describe('setDifficulty', () => {
    it('should update difficulty on state', () => {
      service.setDifficulty(DifficultyLevel.HARD);
      expect(service.getState().difficulty).toBe(DifficultyLevel.HARD);
    });

    it('should set lives from the preset when switching to Easy', () => {
      service.setDifficulty(DifficultyLevel.EASY);
      expect(service.getState().lives).toBe(DIFFICULTY_PRESETS[DifficultyLevel.EASY].lives);
    });

    it('should set gold from the preset when switching to Easy', () => {
      service.setDifficulty(DifficultyLevel.EASY);
      expect(service.getState().gold).toBe(DIFFICULTY_PRESETS[DifficultyLevel.EASY].gold);
    });

    it('should set lives from the preset when switching to Hard', () => {
      service.setDifficulty(DifficultyLevel.HARD);
      expect(service.getState().lives).toBe(DIFFICULTY_PRESETS[DifficultyLevel.HARD].lives);
    });

    it('should set gold from the preset when switching to Hard', () => {
      service.setDifficulty(DifficultyLevel.HARD);
      expect(service.getState().gold).toBe(DIFFICULTY_PRESETS[DifficultyLevel.HARD].gold);
    });

    it('should set lives from the preset when switching to Nightmare', () => {
      service.setDifficulty(DifficultyLevel.NIGHTMARE);
      expect(service.getState().lives).toBe(DIFFICULTY_PRESETS[DifficultyLevel.NIGHTMARE].lives);
    });

    it('should set gold from the preset when switching to Nightmare', () => {
      service.setDifficulty(DifficultyLevel.NIGHTMARE);
      expect(service.getState().gold).toBe(DIFFICULTY_PRESETS[DifficultyLevel.NIGHTMARE].gold);
    });

    it('should emit state change after difficulty update', (done) => {
      let emitCount = 0;
      service.getState$().subscribe(state => {
        emitCount++;
        if (emitCount === 2) {
          expect(state.difficulty).toBe(DifficultyLevel.EASY);
          expect(state.lives).toBe(DIFFICULTY_PRESETS[DifficultyLevel.EASY].lives);
          done();
        }
      });
      service.setDifficulty(DifficultyLevel.EASY);
    });

    it('should use NORMAL preset by default in initial state', () => {
      expect(service.getState().difficulty).toBe(DifficultyLevel.NORMAL);
      expect(service.getState().lives).toBe(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].lives);
      expect(service.getState().gold).toBe(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold);
    });

    it('should not affect wave or score', () => {
      service.startWave();
      service.addScore(500);
      service.setDifficulty(DifficultyLevel.NIGHTMARE);
      expect(service.getState().wave).toBe(1);
      expect(service.getState().score).toBe(500);
    });

    it('should restore Normal preset when switching back from Hard', () => {
      service.setDifficulty(DifficultyLevel.HARD);
      service.setDifficulty(DifficultyLevel.NORMAL);
      expect(service.getState().lives).toBe(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].lives);
      expect(service.getState().gold).toBe(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold);
    });

    it('should be a no-op during COMBAT phase (wave > 0)', () => {
      service.startWave(); // phase=COMBAT, wave=1
      const livesBefore = service.getState().lives;
      const goldBefore = service.getState().gold;

      service.setDifficulty(DifficultyLevel.EASY);

      expect(service.getState().lives).toBe(livesBefore);
      expect(service.getState().gold).toBe(goldBefore);
      expect(service.getState().difficulty).toBe(DifficultyLevel.NORMAL);
    });

    it('should be a no-op during INTERMISSION phase (wave > 0)', () => {
      service.startWave();
      service.completeWave(50); // → INTERMISSION, wave=1
      const livesBefore = service.getState().lives;

      service.setDifficulty(DifficultyLevel.HARD);

      expect(service.getState().lives).toBe(livesBefore);
      expect(service.getState().difficulty).toBe(DifficultyLevel.NORMAL);
    });

    it('should be a no-op during VICTORY phase', () => {
      const maxWaves = service.getState().maxWaves;
      for (let i = 0; i < maxWaves; i++) {
        service.startWave();
      }
      service.completeWave(100); // → VICTORY
      const livesBefore = service.getState().lives;

      service.setDifficulty(DifficultyLevel.NIGHTMARE);

      expect(service.getState().lives).toBe(livesBefore);
      expect(service.getState().difficulty).toBe(DifficultyLevel.NORMAL);
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

  // --- togglePause ---

  describe('togglePause', () => {
    it('should start unpaused', () => {
      expect(service.getState().isPaused).toBeFalse();
    });

    it('should pause during COMBAT phase', () => {
      service.startWave(); // → COMBAT
      service.togglePause();
      expect(service.getState().isPaused).toBeTrue();
    });

    it('should resume when called again during COMBAT', () => {
      service.startWave(); // → COMBAT
      service.togglePause();
      service.togglePause();
      expect(service.getState().isPaused).toBeFalse();
    });

    it('should be a no-op outside of COMBAT phase (SETUP)', () => {
      service.togglePause(); // phase is SETUP
      expect(service.getState().isPaused).toBeFalse();
    });

    it('should be a no-op in INTERMISSION phase', () => {
      service.startWave();
      service.completeWave(10); // → INTERMISSION
      service.togglePause();
      expect(service.getState().isPaused).toBeFalse();
    });

    it('should emit state change when toggling', (done) => {
      service.startWave();
      let emitCount = 0;
      service.getState$().subscribe(state => {
        emitCount++;
        if (emitCount === 2) {
          expect(state.isPaused).toBeTrue();
          done();
        }
      });
      service.togglePause();
    });

    it('reset should clear isPaused', () => {
      service.startWave();
      service.togglePause();
      service.reset();
      expect(service.getState().isPaused).toBeFalse();
    });
  });

  // --- setSpeed ---

  describe('setSpeed', () => {
    it('should start at speed 1', () => {
      expect(service.getState().gameSpeed).toBe(1);
    });

    it('should set speed to 2', () => {
      service.setSpeed(2);
      expect(service.getState().gameSpeed).toBe(2);
    });

    it('should set speed to 3', () => {
      service.setSpeed(3);
      expect(service.getState().gameSpeed).toBe(3);
    });

    it('should set speed back to 1', () => {
      service.setSpeed(3);
      service.setSpeed(1);
      expect(service.getState().gameSpeed).toBe(1);
    });

    it('should reject invalid speed values and keep current speed', () => {
      service.setSpeed(2);
      service.setSpeed(99 as 1);
      expect(service.getState().gameSpeed).toBe(2);
    });

    it('should work in any game phase', () => {
      service.setSpeed(3);
      expect(service.getState().gameSpeed).toBe(3);
      service.startWave();
      service.setSpeed(2);
      expect(service.getState().gameSpeed).toBe(2);
    });

    it('should emit state change when speed changes', (done) => {
      let emitCount = 0;
      service.getState$().subscribe(state => {
        emitCount++;
        if (emitCount === 2) {
          expect(state.gameSpeed).toBe(3);
          done();
        }
      });
      service.setSpeed(3);
    });

    it('reset should restore speed to 1', () => {
      service.setSpeed(3);
      service.reset();
      expect(service.getState().gameSpeed).toBe(1);
    });
  });

  // --- addElapsedTime ---

  describe('addElapsedTime', () => {
    it('should add time to elapsedTime when in COMBAT phase', () => {
      service.startWave(); // → COMBAT
      service.addElapsedTime(5);
      expect(service.getState().elapsedTime).toBe(5);
    });

    it('should accumulate multiple calls', () => {
      service.startWave(); // → COMBAT
      service.addElapsedTime(3);
      service.addElapsedTime(2.5);
      expect(service.getState().elapsedTime).toBeCloseTo(5.5);
    });

    it('should be a no-op when in SETUP phase', () => {
      service.addElapsedTime(10);
      expect(service.getState().elapsedTime).toBe(0);
    });

    it('should be a no-op when in INTERMISSION phase', () => {
      service.startWave();
      service.completeWave(10); // → INTERMISSION
      service.addElapsedTime(10);
      expect(service.getState().elapsedTime).toBe(0);
    });

    it('should be a no-op when in VICTORY phase', () => {
      const maxWaves = service.getState().maxWaves;
      for (let i = 0; i < maxWaves; i++) {
        service.startWave();
      }
      service.completeWave(100); // → VICTORY
      service.addElapsedTime(10);
      expect(service.getState().elapsedTime).toBe(0);
    });

    it('should be a no-op when in DEFEAT phase', () => {
      service.loseLife(INITIAL_GAME_STATE.lives); // → DEFEAT
      service.addElapsedTime(10);
      expect(service.getState().elapsedTime).toBe(0);
    });

    it('should emit state after adding time', (done) => {
      service.startWave();
      let emitCount = 0;
      service.getState$().subscribe(state => {
        emitCount++;
        if (emitCount === 2) {
          expect(state.elapsedTime).toBe(1);
          done();
        }
      });
      service.addElapsedTime(1);
    });

    it('reset should clear elapsedTime', () => {
      service.startWave();
      service.addElapsedTime(30);
      service.reset();
      expect(service.getState().elapsedTime).toBe(0);
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

  // --- Endless Mode ---

  describe('endless mode', () => {
    it('should start with isEndless false', () => {
      expect(service.getState().isEndless).toBeFalse();
    });

    it('should start with highestWave 0', () => {
      expect(service.getState().highestWave).toBe(0);
    });

    it('setEndlessMode(true) should set isEndless to true', () => {
      service.setEndlessMode(true);
      expect(service.getState().isEndless).toBeTrue();
    });

    it('setEndlessMode(false) should set isEndless to false', () => {
      service.setEndlessMode(true);
      service.setEndlessMode(false);
      expect(service.getState().isEndless).toBeFalse();
    });

    it('completeWave should go to INTERMISSION (not VICTORY) when endless mode is active at final wave', () => {
      service.setEndlessMode(true);
      const maxWaves = service.getState().maxWaves;
      for (let i = 0; i < maxWaves; i++) {
        service.startWave();
      }
      service.completeWave(250);
      expect(service.getState().phase).toBe(GamePhase.INTERMISSION);
    });

    it('completeWave should NOT set VICTORY on any wave in endless mode', () => {
      service.setEndlessMode(true);
      const maxWaves = service.getState().maxWaves;
      for (let i = 0; i < maxWaves + 5; i++) {
        service.startWave();
        service.completeWave(100);
        expect(service.getState().phase).toBe(GamePhase.INTERMISSION);
      }
    });

    it('completeWave should update highestWave when new wave is higher', () => {
      service.setEndlessMode(true);
      const maxWaves = service.getState().maxWaves;
      for (let i = 0; i < maxWaves; i++) {
        service.startWave();
      }
      service.completeWave(100);
      expect(service.getState().highestWave).toBe(maxWaves);
    });

    it('highestWave should not decrease on subsequent waves', () => {
      service.setEndlessMode(true);
      const maxWaves = service.getState().maxWaves;
      for (let i = 0; i < maxWaves; i++) {
        service.startWave();
      }
      service.completeWave(100);
      const firstHighest = service.getState().highestWave;

      service.startWave();
      service.completeWave(100);
      expect(service.getState().highestWave).toBeGreaterThanOrEqual(firstHighest);
    });

    it('startWave should allow advancing beyond maxWaves in endless mode', () => {
      service.setEndlessMode(true);
      const maxWaves = service.getState().maxWaves;
      for (let i = 0; i < maxWaves; i++) {
        service.startWave();
      }
      service.completeWave(100); // INTERMISSION
      service.startWave(); // wave maxWaves + 1
      expect(service.getState().wave).toBe(maxWaves + 1);
      expect(service.getState().phase).toBe(GamePhase.COMBAT);
    });

    it('startWave should NOT advance beyond maxWaves when endless mode is off', () => {
      const maxWaves = service.getState().maxWaves;
      for (let i = 0; i < maxWaves; i++) {
        service.startWave();
      }
      service.completeWave(250); // VICTORY
      service.startWave(); // should be no-op
      expect(service.getState().wave).toBe(maxWaves);
    });

    it('reset should clear endless mode and highestWave', () => {
      service.setEndlessMode(true);
      const maxWaves = service.getState().maxWaves;
      for (let i = 0; i < maxWaves; i++) {
        service.startWave();
      }
      service.completeWave(100);

      service.reset();
      expect(service.getState().isEndless).toBeFalse();
      expect(service.getState().highestWave).toBe(0);
    });
  });

  // --- Interest System ---
  describe('awardInterest', () => {
    function enterIntermission(): void {
      service.startWave();
      service.completeWave(0);
      expect(service.getState().phase).toBe(GamePhase.INTERMISSION);
    }

    it('should award interest based on current gold during INTERMISSION', () => {
      enterIntermission();
      const goldBefore = service.getState().gold;
      const expectedInterest = Math.min(
        Math.floor(goldBefore * INTEREST_CONFIG.rate),
        INTEREST_CONFIG.maxPayout
      );
      const result = service.awardInterest();
      expect(result).toBe(expectedInterest);
      expect(service.getState().gold).toBe(goldBefore + expectedInterest);
    });

    it('should add interest to score', () => {
      enterIntermission();
      const scoreBefore = service.getState().score;
      const interest = service.awardInterest();
      expect(service.getState().score).toBe(scoreBefore + interest);
    });

    it('should return 0 if not in INTERMISSION phase', () => {
      expect(service.getState().phase).toBe(GamePhase.SETUP);
      const result = service.awardInterest();
      expect(result).toBe(0);
    });

    it('should return 0 during COMBAT phase', () => {
      service.startWave();
      expect(service.getState().phase).toBe(GamePhase.COMBAT);
      const result = service.awardInterest();
      expect(result).toBe(0);
    });

    it('should cap interest at maxPayout', () => {
      enterIntermission();
      // Set gold high enough that rate * gold > maxPayout
      const highGold = Math.ceil(INTEREST_CONFIG.maxPayout / INTEREST_CONFIG.rate) + 1000;
      (service as any).state.gold = highGold;
      const result = service.awardInterest();
      expect(result).toBe(INTEREST_CONFIG.maxPayout);
    });

    it('should return 0 and not emit when gold is 0', () => {
      enterIntermission();
      (service as any).state.gold = 0;
      const emitSpy = spyOn(service as any, 'emit');
      const result = service.awardInterest();
      expect(result).toBe(0);
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });
});
