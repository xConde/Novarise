import {
  DifficultyLevel,
  DIFFICULTY_PRESETS,
  GamePhase,
  GameState,
  INITIAL_GAME_STATE
} from './game-state.model';

describe('game-state.model', () => {

  // --- DifficultyLevel enum ---

  describe('DifficultyLevel', () => {
    it('should define EASY', () => {
      expect(DifficultyLevel.EASY).toBe('easy');
    });

    it('should define NORMAL', () => {
      expect(DifficultyLevel.NORMAL).toBe('normal');
    });

    it('should define HARD', () => {
      expect(DifficultyLevel.HARD).toBe('hard');
    });

    it('should define NIGHTMARE', () => {
      expect(DifficultyLevel.NIGHTMARE).toBe('nightmare');
    });

    it('should have exactly 4 levels', () => {
      expect(Object.values(DifficultyLevel).length).toBe(4);
    });
  });

  // --- DIFFICULTY_PRESETS ---

  describe('DIFFICULTY_PRESETS', () => {
    it('should define a preset for every DifficultyLevel', () => {
      for (const level of Object.values(DifficultyLevel)) {
        expect(DIFFICULTY_PRESETS[level]).toBeDefined();
      }
    });

    describe('Easy preset', () => {
      it('should have 30 lives', () => {
        expect(DIFFICULTY_PRESETS[DifficultyLevel.EASY].lives).toBe(30);
      });

      it('should have 300 gold', () => {
        expect(DIFFICULTY_PRESETS[DifficultyLevel.EASY].gold).toBe(300);
      });

      it('should have a non-empty label', () => {
        expect(DIFFICULTY_PRESETS[DifficultyLevel.EASY].label.length).toBeGreaterThan(0);
      });

      it('should have a non-empty description', () => {
        expect(DIFFICULTY_PRESETS[DifficultyLevel.EASY].description.length).toBeGreaterThan(0);
      });
    });

    describe('Normal preset', () => {
      it('should have 20 lives', () => {
        expect(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].lives).toBe(20);
      });

      it('should have 200 gold', () => {
        expect(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold).toBe(200);
      });
    });

    describe('Hard preset', () => {
      it('should have 10 lives', () => {
        expect(DIFFICULTY_PRESETS[DifficultyLevel.HARD].lives).toBe(10);
      });

      it('should have 100 gold', () => {
        expect(DIFFICULTY_PRESETS[DifficultyLevel.HARD].gold).toBe(100);
      });
    });

    describe('Nightmare preset', () => {
      it('should have 7 lives', () => {
        expect(DIFFICULTY_PRESETS[DifficultyLevel.NIGHTMARE].lives).toBe(7);
      });

      it('should have 50 gold', () => {
        expect(DIFFICULTY_PRESETS[DifficultyLevel.NIGHTMARE].gold).toBe(50);
      });
    });

    it('should have strictly decreasing lives across difficulty levels', () => {
      expect(DIFFICULTY_PRESETS[DifficultyLevel.EASY].lives).toBeGreaterThan(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].lives);
      expect(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].lives).toBeGreaterThan(DIFFICULTY_PRESETS[DifficultyLevel.HARD].lives);
      expect(DIFFICULTY_PRESETS[DifficultyLevel.HARD].lives).toBeGreaterThan(DIFFICULTY_PRESETS[DifficultyLevel.NIGHTMARE].lives);
    });

    it('should have strictly decreasing gold across difficulty levels', () => {
      expect(DIFFICULTY_PRESETS[DifficultyLevel.EASY].gold).toBeGreaterThan(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold);
      expect(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold).toBeGreaterThan(DIFFICULTY_PRESETS[DifficultyLevel.HARD].gold);
      expect(DIFFICULTY_PRESETS[DifficultyLevel.HARD].gold).toBeGreaterThan(DIFFICULTY_PRESETS[DifficultyLevel.NIGHTMARE].gold);
    });
  });

  // --- INITIAL_GAME_STATE ---

  describe('INITIAL_GAME_STATE', () => {
    it('should start in SETUP phase', () => {
      expect(INITIAL_GAME_STATE.phase).toBe(GamePhase.SETUP);
    });

    it('should use NORMAL difficulty', () => {
      expect(INITIAL_GAME_STATE.difficulty).toBe(DifficultyLevel.NORMAL);
    });

    it('should start with NORMAL lives', () => {
      expect(INITIAL_GAME_STATE.lives).toBe(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].lives);
    });

    it('should start with NORMAL gold', () => {
      expect(INITIAL_GAME_STATE.gold).toBe(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold);
    });

    it('should start at wave 0', () => {
      expect(INITIAL_GAME_STATE.wave).toBe(0);
    });

    it('should start with 0 score', () => {
      expect(INITIAL_GAME_STATE.score).toBe(0);
    });

    it('should start with elapsedTime of 0', () => {
      expect(INITIAL_GAME_STATE.elapsedTime).toBe(0);
    });

    it('should be a plain object (shallow-copyable without shared references)', () => {
      const copy: GameState = { ...INITIAL_GAME_STATE };
      copy.lives = 0;
      expect(INITIAL_GAME_STATE.lives).toBe(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].lives);
    });
  });
});
