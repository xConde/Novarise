import {
  createInitialRunState,
  DEFAULT_RUN_CONFIG,
  RunConfig,
  RunStatus,
} from './run-state.model';

describe('RunState Model', () => {
  describe('createInitialRunState()', () => {
    it('should set lives from config.startingLives', () => {
      const state = createInitialRunState(42, DEFAULT_RUN_CONFIG, 0);
      expect(state.lives).toBe(DEFAULT_RUN_CONFIG.startingLives);
    });

    it('should set maxLives from config.startingLives', () => {
      const state = createInitialRunState(42, DEFAULT_RUN_CONFIG, 0);
      expect(state.maxLives).toBe(DEFAULT_RUN_CONFIG.startingLives);
    });

    it('should set gold from config.startingGold', () => {
      const state = createInitialRunState(42, DEFAULT_RUN_CONFIG, 0);
      expect(state.gold).toBe(DEFAULT_RUN_CONFIG.startingGold);
    });

    it('should preserve the provided seed', () => {
      const state = createInitialRunState(12345, DEFAULT_RUN_CONFIG, 0);
      expect(state.seed).toBe(12345);
    });

    it('should preserve the provided ascensionLevel', () => {
      const state = createInitialRunState(1, DEFAULT_RUN_CONFIG, 7);
      expect(state.ascensionLevel).toBe(7);
    });

    it('should set actIndex to 0', () => {
      const state = createInitialRunState(1, DEFAULT_RUN_CONFIG, 0);
      expect(state.actIndex).toBe(0);
    });

    it('should set currentNodeId to null', () => {
      const state = createInitialRunState(1, DEFAULT_RUN_CONFIG, 0);
      expect(state.currentNodeId).toBeNull();
    });

    it('should start with empty completedNodeIds', () => {
      const state = createInitialRunState(1, DEFAULT_RUN_CONFIG, 0);
      expect(state.completedNodeIds).toEqual([]);
    });

    it('should start with empty relicIds', () => {
      const state = createInitialRunState(1, DEFAULT_RUN_CONFIG, 0);
      expect(state.relicIds).toEqual([]);
    });

    it('should start with empty encounterResults', () => {
      const state = createInitialRunState(1, DEFAULT_RUN_CONFIG, 0);
      expect(state.encounterResults).toEqual([]);
    });

    it('should start with status IN_PROGRESS', () => {
      const state = createInitialRunState(1, DEFAULT_RUN_CONFIG, 0);
      expect(state.status).toBe(RunStatus.IN_PROGRESS);
    });

    it('should start with score 0', () => {
      const state = createInitialRunState(1, DEFAULT_RUN_CONFIG, 0);
      expect(state.score).toBe(0);
    });

    it('should respect custom config overrides', () => {
      const customConfig: RunConfig = {
        startingLives: 5,
        startingGold: 300,
        actsCount: 3,
        nodesPerAct: 15,
      };
      const state = createInitialRunState(99, customConfig, 10);
      expect(state.lives).toBe(5);
      expect(state.maxLives).toBe(5);
      expect(state.gold).toBe(300);
      expect(state.config.actsCount).toBe(3);
      expect(state.config.nodesPerAct).toBe(15);
    });

    it('should produce a unique id per call', () => {
      const state1 = createInitialRunState(1, DEFAULT_RUN_CONFIG, 0);
      const state2 = createInitialRunState(1, DEFAULT_RUN_CONFIG, 0);
      expect(state1.id).not.toBe(state2.id);
    });

    it('should produce ids that start with "run_"', () => {
      const state = createInitialRunState(1, DEFAULT_RUN_CONFIG, 0);
      expect(state.id.startsWith('run_')).toBeTrue();
    });
  });

  describe('DEFAULT_RUN_CONFIG', () => {
    it('should have startingLives of 20', () => {
      expect(DEFAULT_RUN_CONFIG.startingLives).toBe(20);
    });

    it('should have startingGold of 150', () => {
      expect(DEFAULT_RUN_CONFIG.startingGold).toBe(150);
    });

    it('should have actsCount of 2', () => {
      expect(DEFAULT_RUN_CONFIG.actsCount).toBe(2);
    });

    it('should have nodesPerAct of 12', () => {
      expect(DEFAULT_RUN_CONFIG.nodesPerAct).toBe(12);
    });
  });
});
