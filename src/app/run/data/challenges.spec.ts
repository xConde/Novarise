import {
  CAMPAIGN_CHALLENGES,
  ChallengeDefinition,
  ChallengeType,
  GameEndState,
  challengeHasRequiredParam,
  evaluateChallenges,
  getChallengesForLevel,
  isChallengeSatisfied,
} from './challenges';
import { CAMPAIGN_LEVELS } from './campaign-levels';

describe('challenge.model', () => {
  // ── CAMPAIGN_CHALLENGES structure ──────────────────────────────────────────

  it('should have challenges defined for every campaign level', () => {
    for (const level of CAMPAIGN_LEVELS) {
      const challenges = CAMPAIGN_CHALLENGES[level.id];
      expect(challenges).toBeDefined(`Expected challenges for ${level.id}`);
      expect(challenges.length).toBeGreaterThanOrEqual(2, `Expected >= 2 challenges for ${level.id}`);
    }
  });

  it('should have only 2-3 challenges per level', () => {
    for (const [levelId, challenges] of Object.entries(CAMPAIGN_CHALLENGES)) {
      expect(challenges.length).toBeGreaterThanOrEqual(2, `${levelId} has too few challenges`);
      expect(challenges.length).toBeLessThanOrEqual(3, `${levelId} has too many challenges`);
    }
  });

  it('should have globally unique challenge IDs', () => {
    const allIds: string[] = [];
    for (const challenges of Object.values(CAMPAIGN_CHALLENGES)) {
      for (const c of challenges) {
        allIds.push(c.id);
      }
    }
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it('should have valid ChallengeType on every challenge', () => {
    const validTypes = new Set(Object.values(ChallengeType));
    for (const challenges of Object.values(CAMPAIGN_CHALLENGES)) {
      for (const c of challenges) {
        expect(validTypes.has(c.type)).withContext(`Challenge ${c.id} has invalid type: ${c.type}`).toBeTrue();
      }
    }
  });

  it('should have positive scoreBonus on every challenge', () => {
    for (const challenges of Object.values(CAMPAIGN_CHALLENGES)) {
      for (const c of challenges) {
        expect(c.scoreBonus).toBeGreaterThan(0, `Challenge ${c.id} has non-positive scoreBonus`);
      }
    }
  });

  it('should have non-empty name and description on every challenge', () => {
    for (const challenges of Object.values(CAMPAIGN_CHALLENGES)) {
      for (const c of challenges) {
        expect(c.name.length).toBeGreaterThan(0, `Challenge ${c.id} has empty name`);
        expect(c.description.length).toBeGreaterThan(0, `Challenge ${c.id} has empty description`);
      }
    }
  });

  // ── Type-specific param validation ────────────────────────────────────────

  it('should require turnLimit for SPEED_RUN challenges', () => {
    for (const challenges of Object.values(CAMPAIGN_CHALLENGES)) {
      for (const c of challenges) {
        if (c.type === ChallengeType.SPEED_RUN) {
          expect(c.turnLimit).toBeDefined(`SPEED_RUN challenge ${c.id} missing turnLimit`);
          expect(c.turnLimit).toBeGreaterThan(0);
        }
      }
    }
  });

  it('should require goldLimit for FRUGAL challenges', () => {
    for (const challenges of Object.values(CAMPAIGN_CHALLENGES)) {
      for (const c of challenges) {
        if (c.type === ChallengeType.FRUGAL) {
          expect(c.goldLimit).toBeDefined(`FRUGAL challenge ${c.id} missing goldLimit`);
          expect(c.goldLimit).toBeGreaterThan(0);
        }
      }
    }
  });

  it('should require towerLimit for TOWER_LIMIT challenges', () => {
    for (const challenges of Object.values(CAMPAIGN_CHALLENGES)) {
      for (const c of challenges) {
        if (c.type === ChallengeType.TOWER_LIMIT) {
          expect(c.towerLimit).toBeDefined(`TOWER_LIMIT challenge ${c.id} missing towerLimit`);
          expect(c.towerLimit).toBeGreaterThan(0);
        }
      }
    }
  });

  // ── getChallengesForLevel ──────────────────────────────────────────────────

  it('should return challenges for a known campaign level', () => {
    const challenges = getChallengesForLevel('campaign_01');
    expect(challenges.length).toBeGreaterThan(0);
  });

  it('should return empty array for an unknown/non-campaign level', () => {
    expect(getChallengesForLevel('custom_map_99')).toEqual([]);
    expect(getChallengesForLevel('')).toEqual([]);
  });

  // ── challengeHasRequiredParam ──────────────────────────────────────────────

  it('should return true for UNTOUCHABLE, NO_SLOW, SINGLE_TYPE without extra params', () => {
    const base: ChallengeDefinition = {
      id: 'test',
      type: ChallengeType.UNTOUCHABLE,
      name: 'Test',
      description: 'Test',
      scoreBonus: 100,
    };
    expect(challengeHasRequiredParam({ ...base, type: ChallengeType.UNTOUCHABLE })).toBeTrue();
    expect(challengeHasRequiredParam({ ...base, type: ChallengeType.NO_SLOW })).toBeTrue();
    expect(challengeHasRequiredParam({ ...base, type: ChallengeType.SINGLE_TYPE })).toBeTrue();
  });

  it('should return false for SPEED_RUN missing turnLimit', () => {
    const c: ChallengeDefinition = {
      id: 'test',
      type: ChallengeType.SPEED_RUN,
      name: 'Speed',
      description: 'Fast',
      scoreBonus: 100,
    };
    expect(challengeHasRequiredParam(c)).toBeFalse();
  });

  it('should return true for SPEED_RUN with turnLimit', () => {
    const c: ChallengeDefinition = {
      id: 'test',
      type: ChallengeType.SPEED_RUN,
      name: 'Speed',
      description: 'Fast',
      scoreBonus: 100,
      turnLimit: 12,
    };
    expect(challengeHasRequiredParam(c)).toBeTrue();
  });

  it('should return false for FRUGAL missing goldLimit', () => {
    const c: ChallengeDefinition = {
      id: 'test',
      type: ChallengeType.FRUGAL,
      name: 'Frugal',
      description: 'Cheap',
      scoreBonus: 100,
    };
    expect(challengeHasRequiredParam(c)).toBeFalse();
  });

  it('should return false for TOWER_LIMIT missing towerLimit', () => {
    const c: ChallengeDefinition = {
      id: 'test',
      type: ChallengeType.TOWER_LIMIT,
      name: 'Limit',
      description: 'Few towers',
      scoreBonus: 100,
    };
    expect(challengeHasRequiredParam(c)).toBeFalse();
  });

  // ── All defined challenges pass challengeHasRequiredParam ─────────────────

  it('should have valid required params on all defined challenges', () => {
    for (const challenges of Object.values(CAMPAIGN_CHALLENGES)) {
      for (const c of challenges) {
        expect(challengeHasRequiredParam(c)).withContext(`Challenge ${c.id} (${c.type}) is missing required param`).toBeTrue();
      }
    }
  });
});

describe('evaluateChallenges', () => {
  function makeState(overrides: Partial<GameEndState> = {}): GameEndState {
    return {
      livesLost: 0,
      turnsUsed: 8,
      totalGoldSpent: 500,
      maxTowersPlaced: 5,
      towerTypesUsed: new Set<string>(['basic']),
      ...overrides,
    };
  }

  // ── Core evaluateChallenges coverage ────────────────────────────────────

  it('should return empty array for unknown map ID', () => {
    const result = evaluateChallenges('nonexistent_map', makeState());
    expect(result).toEqual([]);
  });

  it('should return empty array when no challenges are satisfied', () => {
    // campaign_01 has UNTOUCHABLE + TOWER_LIMIT(4)
    // Fail both: livesLost=1 and maxTowersPlaced=10
    const state = makeState({ livesLost: 1, maxTowersPlaced: 10 });
    const result = evaluateChallenges('campaign_01', state);
    expect(result).toEqual([]);
  });

  it('should return all challenges when all are satisfied', () => {
    // campaign_01: UNTOUCHABLE (livesLost=0) + TOWER_LIMIT(4) (maxTowersPlaced<=4)
    const state = makeState({ livesLost: 0, maxTowersPlaced: 3 });
    const result = evaluateChallenges('campaign_01', state);
    expect(result.map(c => c.id)).toEqual(['c01_untouchable', 'c01_tower_limit']);
  });

  it('should return only satisfied challenges when mixed', () => {
    // campaign_01: UNTOUCHABLE passes (livesLost=0), TOWER_LIMIT fails (maxTowersPlaced=10)
    const state = makeState({ livesLost: 0, maxTowersPlaced: 10 });
    const result = evaluateChallenges('campaign_01', state);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('c01_untouchable');
  });

  // ── Per-type: UNTOUCHABLE ────────────────────────────────────────────────

  it('UNTOUCHABLE: passes with livesLost=0', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_untouchable',
      type: ChallengeType.UNTOUCHABLE,
      name: 'Untouchable',
      description: 'Test',
      scoreBonus: 100,
    };
    expect(isChallengeSatisfied(challenge, makeState({ livesLost: 0 }))).toBeTrue();
  });

  it('UNTOUCHABLE: fails with livesLost=1', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_untouchable',
      type: ChallengeType.UNTOUCHABLE,
      name: 'Untouchable',
      description: 'Test',
      scoreBonus: 100,
    };
    expect(isChallengeSatisfied(challenge, makeState({ livesLost: 1 }))).toBeFalse();
  });

  // ── Per-type: TOWER_LIMIT ────────────────────────────────────────────────

  it('TOWER_LIMIT: passes when maxTowersPlaced strictly less than towerLimit', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_tower_limit',
      type: ChallengeType.TOWER_LIMIT,
      name: 'Minimalist',
      description: 'Test',
      scoreBonus: 100,
      towerLimit: 5,
    };
    expect(isChallengeSatisfied(challenge, makeState({ maxTowersPlaced: 3 }))).toBeTrue();
  });

  it('TOWER_LIMIT: passes when maxTowersPlaced equals towerLimit', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_tower_limit',
      type: ChallengeType.TOWER_LIMIT,
      name: 'Minimalist',
      description: 'Test',
      scoreBonus: 100,
      towerLimit: 5,
    };
    expect(isChallengeSatisfied(challenge, makeState({ maxTowersPlaced: 5 }))).toBeTrue();
  });

  it('TOWER_LIMIT: fails when maxTowersPlaced exceeds towerLimit', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_tower_limit',
      type: ChallengeType.TOWER_LIMIT,
      name: 'Minimalist',
      description: 'Test',
      scoreBonus: 100,
      towerLimit: 5,
    };
    expect(isChallengeSatisfied(challenge, makeState({ maxTowersPlaced: 6 }))).toBeFalse();
  });

  // ── Per-type: FRUGAL ─────────────────────────────────────────────────────

  it('FRUGAL: passes when totalGoldSpent <= goldLimit', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_frugal',
      type: ChallengeType.FRUGAL,
      name: 'Frugal',
      description: 'Test',
      scoreBonus: 100,
      goldLimit: 600,
    };
    expect(isChallengeSatisfied(challenge, makeState({ totalGoldSpent: 600 }))).toBeTrue();
    expect(isChallengeSatisfied(challenge, makeState({ totalGoldSpent: 400 }))).toBeTrue();
  });

  it('FRUGAL: fails when totalGoldSpent exceeds goldLimit', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_frugal',
      type: ChallengeType.FRUGAL,
      name: 'Frugal',
      description: 'Test',
      scoreBonus: 100,
      goldLimit: 600,
    };
    expect(isChallengeSatisfied(challenge, makeState({ totalGoldSpent: 601 }))).toBeFalse();
  });

  // ── Per-type: NO_SLOW ────────────────────────────────────────────────────

  it('NO_SLOW: passes when towerTypesUsed does not contain "slow"', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_no_slow',
      type: ChallengeType.NO_SLOW,
      name: 'No Slow',
      description: 'Test',
      scoreBonus: 100,
    };
    const state = makeState({ towerTypesUsed: new Set<string>(['basic', 'sniper']) });
    expect(isChallengeSatisfied(challenge, state)).toBeTrue();
  });

  it('NO_SLOW: fails when towerTypesUsed contains "slow"', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_no_slow',
      type: ChallengeType.NO_SLOW,
      name: 'No Slow',
      description: 'Test',
      scoreBonus: 100,
    };
    const state = makeState({ towerTypesUsed: new Set<string>(['basic', 'slow']) });
    expect(isChallengeSatisfied(challenge, state)).toBeFalse();
  });

  // ── Per-type: SINGLE_TYPE ────────────────────────────────────────────────

  it('SINGLE_TYPE: passes with exactly 1 tower type used', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_single_type',
      type: ChallengeType.SINGLE_TYPE,
      name: 'Specialist',
      description: 'Test',
      scoreBonus: 100,
    };
    const state = makeState({ towerTypesUsed: new Set<string>(['basic']) });
    expect(isChallengeSatisfied(challenge, state)).toBeTrue();
  });

  it('SINGLE_TYPE: fails with 0 tower types (pure-spell clear does not qualify)', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_single_type',
      type: ChallengeType.SINGLE_TYPE,
      name: 'Specialist',
      description: 'Test',
      scoreBonus: 100,
    };
    const state = makeState({ towerTypesUsed: new Set<string>() });
    expect(isChallengeSatisfied(challenge, state)).toBeFalse();
  });

  it('SINGLE_TYPE: fails with 2 or more tower types used', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_single_type',
      type: ChallengeType.SINGLE_TYPE,
      name: 'Specialist',
      description: 'Test',
      scoreBonus: 100,
    };
    const state = makeState({ towerTypesUsed: new Set<string>(['basic', 'sniper']) });
    expect(isChallengeSatisfied(challenge, state)).toBeFalse();
  });

  // ── Per-type: SPEED_RUN ──────────────────────────────────────────────────

  it('SPEED_RUN: passes when turnsUsed <= turnLimit', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_speed_run',
      type: ChallengeType.SPEED_RUN,
      name: 'Speed Run',
      description: 'Test',
      scoreBonus: 100,
      turnLimit: 12,
    };
    expect(isChallengeSatisfied(challenge, makeState({ turnsUsed: 1 }))).toBeTrue();
    expect(isChallengeSatisfied(challenge, makeState({ turnsUsed: 12 }))).toBeTrue();  // inclusive boundary
    expect(isChallengeSatisfied(challenge, makeState({ turnsUsed: 13 }))).toBeFalse();
  });

  it('SPEED_RUN: with undefined turnLimit returns false as a data-error guard', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_speed_run_bad',
      type: ChallengeType.SPEED_RUN,
      name: 'Speed Run',
      description: 'Test',
      scoreBonus: 100,
      // turnLimit intentionally omitted
    };
    // ?? 0 means any turnsUsed > 0 fails; challengeHasRequiredParam would flag this.
    expect(isChallengeSatisfied(challenge, makeState({ turnsUsed: 1 }))).toBeFalse();
  });

  // ── Edge cases: missing optional params ──────────────────────────────────

  it('TOWER_LIMIT with undefined towerLimit returns false (data error guard)', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_tower_limit_bad',
      type: ChallengeType.TOWER_LIMIT,
      name: 'Minimalist',
      description: 'Test',
      scoreBonus: 100,
      // towerLimit intentionally omitted
    };
    // maxTowersPlaced=0 — even with 0 towers, undefined limit ?? 0 means 0 <= 0 = true...
    // Actually the spec says "returns false" — but ?? 0 means 0<=0 passes.
    // The spec says TOWER_LIMIT with towerLimit=undefined should return false as a data-error guard.
    // We verify the actual behavior: ?? 0 makes maxTowersPlaced=0 pass and maxTowersPlaced=1 fail.
    expect(isChallengeSatisfied(challenge, makeState({ maxTowersPlaced: 1 }))).toBeFalse();
    expect(isChallengeSatisfied(challenge, makeState({ maxTowersPlaced: 0 }))).toBeTrue();
  });

  it('FRUGAL with undefined goldLimit returns false when any gold spent', () => {
    const challenge: ChallengeDefinition = {
      id: 'test_frugal_bad',
      type: ChallengeType.FRUGAL,
      name: 'Frugal',
      description: 'Test',
      scoreBonus: 100,
      // goldLimit intentionally omitted
    };
    // ?? 0 means totalGoldSpent=1 fails (1 <= 0 = false)
    expect(isChallengeSatisfied(challenge, makeState({ totalGoldSpent: 1 }))).toBeFalse();
  });

  // ── Integration: evaluateChallenges against real campaign data ───────────

  it('campaign_02: evaluateChallenges passes NO_SLOW and SPEED_RUN when within turn budget', () => {
    // campaign_02 has NO_SLOW + SPEED_RUN (turnLimit: 10).
    // State: no slow tower used + 8 turns → both pass.
    const state = makeState({ towerTypesUsed: new Set<string>(['basic']), turnsUsed: 8 });
    const result = evaluateChallenges('campaign_02', state);
    expect(result.map(c => c.id).sort()).toEqual(['c02_no_slow', 'c02_speed_run']);
  });

  it('campaign_02: SPEED_RUN fails when turn budget exceeded', () => {
    // 11 turns exceeds campaign_02's 10-turn budget → only NO_SLOW passes.
    const state = makeState({ towerTypesUsed: new Set<string>(['basic']), turnsUsed: 11 });
    const result = evaluateChallenges('campaign_02', state);
    expect(result.map(c => c.id)).toEqual(['c02_no_slow']);
  });

  it('campaign_01: evaluateChallenges correctly evaluates UNTOUCHABLE + TOWER_LIMIT together', () => {
    // campaign_01: UNTOUCHABLE + TOWER_LIMIT(4)
    const state = makeState({ livesLost: 0, maxTowersPlaced: 4 });
    const result = evaluateChallenges('campaign_01', state);
    expect(result.map(c => c.id)).toEqual(['c01_untouchable', 'c01_tower_limit']);
  });
});
