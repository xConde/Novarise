import {
  CAMPAIGN_CHALLENGES,
  ChallengeDefinition,
  ChallengeType,
  challengeHasRequiredParam,
  getChallengesForLevel,
} from './challenge.model';
import { CAMPAIGN_LEVELS } from './campaign.model';

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

  it('should require timeLimit for SPEED_RUN challenges', () => {
    for (const challenges of Object.values(CAMPAIGN_CHALLENGES)) {
      for (const c of challenges) {
        if (c.type === ChallengeType.SPEED_RUN) {
          expect(c.timeLimit).toBeDefined(`SPEED_RUN challenge ${c.id} missing timeLimit`);
          expect(c.timeLimit).toBeGreaterThan(0);
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

  it('should return false for SPEED_RUN missing timeLimit', () => {
    const c: ChallengeDefinition = {
      id: 'test',
      type: ChallengeType.SPEED_RUN,
      name: 'Speed',
      description: 'Fast',
      scoreBonus: 100,
    };
    expect(challengeHasRequiredParam(c)).toBeFalse();
  });

  it('should return true for SPEED_RUN with timeLimit', () => {
    const c: ChallengeDefinition = {
      id: 'test',
      type: ChallengeType.SPEED_RUN,
      name: 'Speed',
      description: 'Fast',
      scoreBonus: 100,
      timeLimit: 120,
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
