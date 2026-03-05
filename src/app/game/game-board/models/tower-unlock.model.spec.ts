import { TowerType } from './tower.model';
import { TOWER_UNLOCK_CONDITIONS, TowerUnlockCondition } from './tower-unlock.model';

describe('TOWER_UNLOCK_CONDITIONS', () => {
  it('should have an entry for every TowerType', () => {
    const towerTypes = Object.values(TowerType);
    for (const type of towerTypes) {
      expect(TOWER_UNLOCK_CONDITIONS[type]).toBeDefined(`Missing entry for TowerType.${type}`);
    }
  });

  it('should have exactly as many entries as TowerType values', () => {
    const conditionKeys = Object.keys(TOWER_UNLOCK_CONDITIONS);
    const towerTypeValues = Object.values(TowerType);
    expect(conditionKeys.length).toBe(towerTypeValues.length);
  });

  it('should mark BASIC as default type (always available)', () => {
    const condition = TOWER_UNLOCK_CONDITIONS[TowerType.BASIC];
    expect(condition.type).toBe('default');
  });

  it('should not require a campaignLevel for BASIC', () => {
    const condition = TOWER_UNLOCK_CONDITIONS[TowerType.BASIC];
    expect(condition.campaignLevel).toBeUndefined();
  });

  it('should mark SNIPER as campaign type', () => {
    expect(TOWER_UNLOCK_CONDITIONS[TowerType.SNIPER].type).toBe('campaign');
  });

  it('should mark SPLASH as campaign type', () => {
    expect(TOWER_UNLOCK_CONDITIONS[TowerType.SPLASH].type).toBe('campaign');
  });

  it('should mark SLOW as campaign type', () => {
    expect(TOWER_UNLOCK_CONDITIONS[TowerType.SLOW].type).toBe('campaign');
  });

  it('should mark CHAIN as campaign type', () => {
    expect(TOWER_UNLOCK_CONDITIONS[TowerType.CHAIN].type).toBe('campaign');
  });

  it('should mark MORTAR as campaign type', () => {
    expect(TOWER_UNLOCK_CONDITIONS[TowerType.MORTAR].type).toBe('campaign');
  });

  it('should specify campaignLevel for all non-BASIC towers', () => {
    const nonBasic = Object.values(TowerType).filter(t => t !== TowerType.BASIC);
    for (const type of nonBasic) {
      const condition: TowerUnlockCondition = TOWER_UNLOCK_CONDITIONS[type];
      expect(condition.campaignLevel).toBeDefined(`Expected campaignLevel for TowerType.${type}`);
      expect(typeof condition.campaignLevel).toBe('number');
    }
  });

  it('should assign unique campaign levels to non-BASIC towers', () => {
    const nonBasic = Object.values(TowerType).filter(t => t !== TowerType.BASIC);
    const levels = nonBasic.map(t => TOWER_UNLOCK_CONDITIONS[t].campaignLevel as number);
    const unique = new Set(levels);
    expect(unique.size).toBe(nonBasic.length);
  });

  it('should have campaign levels 1 through 5 for the non-BASIC towers', () => {
    const nonBasic = Object.values(TowerType).filter(t => t !== TowerType.BASIC);
    const levels = nonBasic
      .map(t => TOWER_UNLOCK_CONDITIONS[t].campaignLevel as number)
      .sort((a, b) => a - b);
    expect(levels).toEqual([1, 2, 3, 4, 5]);
  });

  it('should have a non-empty description for every tower', () => {
    for (const type of Object.values(TowerType)) {
      const { description } = TOWER_UNLOCK_CONDITIONS[type];
      expect(description).toBeTruthy(`Expected description for TowerType.${type}`);
      expect(description.length).toBeGreaterThan(0);
    }
  });
});
