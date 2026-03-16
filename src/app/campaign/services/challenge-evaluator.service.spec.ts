import { TestBed } from '@angular/core/testing';
import { ChallengeEvaluatorService } from './challenge-evaluator.service';
import { ChallengeType, GameEndState } from '../models/challenge.model';
import { TowerType } from '../../game/game-board/models/tower.model';

describe('ChallengeEvaluatorService', () => {
  let service: ChallengeEvaluatorService;

  const baseState: GameEndState = {
    livesLost: 0,
    elapsedTime: 60,
    totalGoldSpent: 300,
    maxTowersPlaced: 3,
    towerTypesUsed: new Set<string>([TowerType.BASIC]),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChallengeEvaluatorService);
  });

  // ── evaluateChallenges: non-campaign map ───────────────────────────────────

  it('should return empty array for a non-campaign map level', () => {
    const result = service.evaluateChallenges('custom_map', baseState);
    expect(result).toEqual([]);
  });

  it('should return empty array for an empty level id', () => {
    const result = service.evaluateChallenges('', baseState);
    expect(result).toEqual([]);
  });

  // ── NO_SLOW ───────────────────────────────────────────────────────────────

  it('should complete NO_SLOW when no Slow tower was used', () => {
    // campaign_02 has a NO_SLOW challenge
    const state: GameEndState = {
      ...baseState,
      towerTypesUsed: new Set<string>([TowerType.BASIC, TowerType.SNIPER]),
    };
    const completed = service.evaluateChallenges('campaign_02', state);
    const noSlowChallenge = completed.find(c => c.type === ChallengeType.NO_SLOW);
    expect(noSlowChallenge).toBeDefined();
  });

  it('should fail NO_SLOW when Slow tower was used', () => {
    const state: GameEndState = {
      ...baseState,
      elapsedTime: 999, // also fail SPEED_RUN
      towerTypesUsed: new Set<string>([TowerType.BASIC, TowerType.SLOW]),
    };
    const completed = service.evaluateChallenges('campaign_02', state);
    const noSlowChallenge = completed.find(c => c.type === ChallengeType.NO_SLOW);
    expect(noSlowChallenge).toBeUndefined();
  });

  // ── SPEED_RUN ─────────────────────────────────────────────────────────────

  it('should complete SPEED_RUN when elapsed time is at the limit', () => {
    // campaign_02 has SPEED_RUN with timeLimit: 120
    const state: GameEndState = {
      ...baseState,
      elapsedTime: 120,
      towerTypesUsed: new Set<string>([TowerType.BASIC]), // no slow used = NO_SLOW passes too
    };
    const completed = service.evaluateChallenges('campaign_02', state);
    const speedRun = completed.find(c => c.type === ChallengeType.SPEED_RUN);
    expect(speedRun).toBeDefined();
  });

  it('should complete SPEED_RUN when elapsed time is under the limit', () => {
    const state: GameEndState = {
      ...baseState,
      elapsedTime: 90,
      towerTypesUsed: new Set<string>([TowerType.SLOW]), // makes NO_SLOW fail
    };
    const completed = service.evaluateChallenges('campaign_02', state);
    const speedRun = completed.find(c => c.type === ChallengeType.SPEED_RUN);
    expect(speedRun).toBeDefined();
  });

  it('should fail SPEED_RUN when elapsed time exceeds the limit', () => {
    const state: GameEndState = {
      ...baseState,
      elapsedTime: 121,
    };
    const completed = service.evaluateChallenges('campaign_02', state);
    const speedRun = completed.find(c => c.type === ChallengeType.SPEED_RUN);
    expect(speedRun).toBeUndefined();
  });

  // ── FRUGAL ────────────────────────────────────────────────────────────────

  it('should complete FRUGAL when gold spent is at the limit', () => {
    // campaign_03 has FRUGAL with goldLimit: 600
    const state: GameEndState = {
      ...baseState,
      totalGoldSpent: 600,
      towerTypesUsed: new Set<string>([TowerType.BASIC]),
    };
    const completed = service.evaluateChallenges('campaign_03', state);
    const frugal = completed.find(c => c.type === ChallengeType.FRUGAL);
    expect(frugal).toBeDefined();
  });

  it('should complete FRUGAL when gold spent is under the limit', () => {
    const state: GameEndState = {
      ...baseState,
      totalGoldSpent: 450,
    };
    const completed = service.evaluateChallenges('campaign_03', state);
    const frugal = completed.find(c => c.type === ChallengeType.FRUGAL);
    expect(frugal).toBeDefined();
  });

  it('should fail FRUGAL when gold spent exceeds the limit', () => {
    const state: GameEndState = {
      ...baseState,
      totalGoldSpent: 601,
    };
    const completed = service.evaluateChallenges('campaign_03', state);
    const frugal = completed.find(c => c.type === ChallengeType.FRUGAL);
    expect(frugal).toBeUndefined();
  });

  // ── UNTOUCHABLE ──────────────────────────────────────────────────────────

  it('should complete UNTOUCHABLE when no lives were lost', () => {
    // campaign_01 has UNTOUCHABLE
    const state: GameEndState = {
      ...baseState,
      livesLost: 0,
    };
    const completed = service.evaluateChallenges('campaign_01', state);
    const untouchable = completed.find(c => c.type === ChallengeType.UNTOUCHABLE);
    expect(untouchable).toBeDefined();
  });

  it('should fail UNTOUCHABLE when any life is lost', () => {
    const state: GameEndState = {
      ...baseState,
      livesLost: 1,
    };
    const completed = service.evaluateChallenges('campaign_01', state);
    const untouchable = completed.find(c => c.type === ChallengeType.UNTOUCHABLE);
    expect(untouchable).toBeUndefined();
  });

  it('should fail UNTOUCHABLE when multiple lives are lost', () => {
    const state: GameEndState = {
      ...baseState,
      livesLost: 5,
    };
    const completed = service.evaluateChallenges('campaign_01', state);
    const untouchable = completed.find(c => c.type === ChallengeType.UNTOUCHABLE);
    expect(untouchable).toBeUndefined();
  });

  // ── TOWER_LIMIT ───────────────────────────────────────────────────────────

  it('should complete TOWER_LIMIT when peak towers equals the limit', () => {
    // campaign_01 has TOWER_LIMIT with towerLimit: 4
    const state: GameEndState = {
      ...baseState,
      maxTowersPlaced: 4,
    };
    const completed = service.evaluateChallenges('campaign_01', state);
    const towerLimit = completed.find(c => c.type === ChallengeType.TOWER_LIMIT);
    expect(towerLimit).toBeDefined();
  });

  it('should complete TOWER_LIMIT when peak towers is under the limit', () => {
    const state: GameEndState = {
      ...baseState,
      maxTowersPlaced: 2,
    };
    const completed = service.evaluateChallenges('campaign_01', state);
    const towerLimit = completed.find(c => c.type === ChallengeType.TOWER_LIMIT);
    expect(towerLimit).toBeDefined();
  });

  it('should fail TOWER_LIMIT when peak towers exceeds the limit', () => {
    const state: GameEndState = {
      ...baseState,
      maxTowersPlaced: 5, // limit is 4 for campaign_01
    };
    const completed = service.evaluateChallenges('campaign_01', state);
    const towerLimit = completed.find(c => c.type === ChallengeType.TOWER_LIMIT);
    expect(towerLimit).toBeUndefined();
  });

  // ── SINGLE_TYPE ───────────────────────────────────────────────────────────

  it('should complete SINGLE_TYPE when exactly one tower type was used', () => {
    // campaign_07 has SINGLE_TYPE
    const state: GameEndState = {
      ...baseState,
      towerTypesUsed: new Set<string>([TowerType.BASIC]),
    };
    const completed = service.evaluateChallenges('campaign_07', state);
    const singleType = completed.find(c => c.type === ChallengeType.SINGLE_TYPE);
    expect(singleType).toBeDefined();
  });

  it('should fail SINGLE_TYPE when two tower types were used', () => {
    const state: GameEndState = {
      ...baseState,
      elapsedTime: 999, // fail SPEED_RUN too
      towerTypesUsed: new Set<string>([TowerType.BASIC, TowerType.SNIPER]),
    };
    const completed = service.evaluateChallenges('campaign_07', state);
    const singleType = completed.find(c => c.type === ChallengeType.SINGLE_TYPE);
    expect(singleType).toBeUndefined();
  });

  it('should fail SINGLE_TYPE when more than two tower types were used', () => {
    const state: GameEndState = {
      ...baseState,
      towerTypesUsed: new Set<string>([TowerType.BASIC, TowerType.SNIPER, TowerType.SPLASH]),
    };
    const completed = service.evaluateChallenges('campaign_07', state);
    const singleType = completed.find(c => c.type === ChallengeType.SINGLE_TYPE);
    expect(singleType).toBeUndefined();
  });

  // ── Multiple challenges in one call ───────────────────────────────────────

  it('should return only completed challenges (not all of them)', () => {
    // campaign_01: UNTOUCHABLE (livesLost=0 passes), TOWER_LIMIT towerLimit=4 (maxTowersPlaced=5 fails)
    const state: GameEndState = {
      ...baseState,
      livesLost: 0,
      maxTowersPlaced: 5,
    };
    const completed = service.evaluateChallenges('campaign_01', state);
    const types = completed.map(c => c.type);
    expect(types).toContain(ChallengeType.UNTOUCHABLE);
    expect(types).not.toContain(ChallengeType.TOWER_LIMIT);
  });

  it('should return all challenges when all conditions are met', () => {
    // campaign_01: UNTOUCHABLE + TOWER_LIMIT (4)
    const state: GameEndState = {
      ...baseState,
      livesLost: 0,
      maxTowersPlaced: 3,
    };
    const completed = service.evaluateChallenges('campaign_01', state);
    expect(completed.length).toBe(2);
  });

  it('should return empty array when no challenges pass', () => {
    // campaign_01: fail both UNTOUCHABLE and TOWER_LIMIT
    const state: GameEndState = {
      ...baseState,
      livesLost: 3,
      maxTowersPlaced: 10,
    };
    const completed = service.evaluateChallenges('campaign_01', state);
    expect(completed.length).toBe(0);
  });
});
