import { TowerType, TowerSpecialization, TOWER_DESCRIPTIONS, TOWER_SPECIALIZATIONS, TOWER_CONFIGS, getEffectiveStats, getUpgradeCost, UPGRADE_COST_CONFIG, MAX_TOWER_LEVEL } from './tower.model';
import { StatusEffectType } from '../constants/status-effect.constants';

describe('Tower Model', () => {
  describe('TOWER_DESCRIPTIONS', () => {
    it('should have an entry for every TowerType value', () => {
      const allTypes = Object.values(TowerType) as TowerType[];
      allTypes.forEach(type => {
        expect(TOWER_DESCRIPTIONS[type]).toBeDefined();
        expect(typeof TOWER_DESCRIPTIONS[type]).toBe('string');
        expect(TOWER_DESCRIPTIONS[type].length).toBeGreaterThan(0);
      });
    });

    it('should have the correct description for BASIC', () => {
      expect(TOWER_DESCRIPTIONS[TowerType.BASIC]).toBe('Balanced all-rounder');
    });

    it('should have the correct description for SNIPER', () => {
      expect(TOWER_DESCRIPTIONS[TowerType.SNIPER]).toBe('Long range, high damage, slow fire');
    });

    it('should have the correct description for SPLASH', () => {
      expect(TOWER_DESCRIPTIONS[TowerType.SPLASH]).toBe('Area damage in a radius');
    });

    it('should have the correct description for SLOW', () => {
      expect(TOWER_DESCRIPTIONS[TowerType.SLOW]).toBe('Slows enemies, no damage');
    });

    it('should have the correct description for CHAIN', () => {
      expect(TOWER_DESCRIPTIONS[TowerType.CHAIN]).toBe('Lightning bounces between enemies');
    });

    it('should have the correct description for MORTAR', () => {
      expect(TOWER_DESCRIPTIONS[TowerType.MORTAR]).toBe('Damage zones that burn enemies');
    });

    it('should have exactly 6 entries matching the 6 TowerType values', () => {
      const descriptionKeys = Object.keys(TOWER_DESCRIPTIONS);
      const towerTypeValues = Object.values(TowerType);
      expect(descriptionKeys.length).toBe(towerTypeValues.length);
    });
  });

  describe('TOWER_SPECIALIZATIONS', () => {
    it('should have entries for all tower types', () => {
      const allTypes = Object.values(TowerType) as TowerType[];
      allTypes.forEach(type => {
        expect(TOWER_SPECIALIZATIONS[type]).toBeDefined();
      });
    });

    it('should have both ALPHA and BETA for every tower type', () => {
      const allTypes = Object.values(TowerType) as TowerType[];
      allTypes.forEach(type => {
        expect(TOWER_SPECIALIZATIONS[type][TowerSpecialization.ALPHA]).toBeDefined();
        expect(TOWER_SPECIALIZATIONS[type][TowerSpecialization.BETA]).toBeDefined();
      });
    });

    it('should have non-empty label and description for all specs', () => {
      const allTypes = Object.values(TowerType) as TowerType[];
      allTypes.forEach(type => {
        [TowerSpecialization.ALPHA, TowerSpecialization.BETA].forEach(spec => {
          const s = TOWER_SPECIALIZATIONS[type][spec];
          expect(s.label.length).toBeGreaterThan(0);
          expect(s.description.length).toBeGreaterThan(0);
        });
      });
    });

    it('ALPHA and BETA should have different labels for each tower type', () => {
      const allTypes = Object.values(TowerType) as TowerType[];
      allTypes.forEach(type => {
        const alpha = TOWER_SPECIALIZATIONS[type][TowerSpecialization.ALPHA];
        const beta = TOWER_SPECIALIZATIONS[type][TowerSpecialization.BETA];
        expect(alpha.label).not.toBe(beta.label);
      });
    });
  });

  describe('statusEffect configs', () => {
    it('Mortar base config should have statusEffect BURN', () => {
      expect(TOWER_CONFIGS[TowerType.MORTAR].statusEffect).toBe(StatusEffectType.BURN);
    });

    it('Splash Bombardier spec should have statusEffect POISON', () => {
      expect(TOWER_SPECIALIZATIONS[TowerType.SPLASH][TowerSpecialization.ALPHA].statusEffect)
        .toBe(StatusEffectType.POISON);
    });

    it('getEffectiveStats for Splash Bombardier includes POISON statusEffect', () => {
      const stats = getEffectiveStats(TowerType.SPLASH, 3, TowerSpecialization.ALPHA);
      expect(stats.statusEffect).toBe(StatusEffectType.POISON);
    });

    it('getEffectiveStats for Mortar (no spec) preserves BURN statusEffect', () => {
      const stats = getEffectiveStats(TowerType.MORTAR, 1);
      expect(stats.statusEffect).toBe(StatusEffectType.BURN);
    });

    it('getEffectiveStats for Basic (no statusEffect) returns undefined statusEffect', () => {
      const stats = getEffectiveStats(TowerType.BASIC, 1);
      expect(stats.statusEffect).toBeUndefined();
    });

    it('Splash Bombardier description mentions poison', () => {
      const spec = TOWER_SPECIALIZATIONS[TowerType.SPLASH][TowerSpecialization.ALPHA];
      expect(spec.description.toLowerCase()).toContain('poison');
    });

    it('towers without statusEffect have undefined statusEffect in base config', () => {
      expect(TOWER_CONFIGS[TowerType.BASIC].statusEffect).toBeUndefined();
      expect(TOWER_CONFIGS[TowerType.SNIPER].statusEffect).toBeUndefined();
      expect(TOWER_CONFIGS[TowerType.CHAIN].statusEffect).toBeUndefined();
    });

    it('Chain Tesla spec has statusEffect BURN', () => {
      expect(TOWER_SPECIALIZATIONS[TowerType.CHAIN][TowerSpecialization.ALPHA].statusEffect)
        .toBe(StatusEffectType.BURN);
    });

    it('getEffectiveStats for Chain Tesla includes BURN statusEffect', () => {
      const stats = getEffectiveStats(TowerType.CHAIN, 3, TowerSpecialization.ALPHA);
      expect(stats.statusEffect).toBe(StatusEffectType.BURN);
    });

    it('Chain Tesla description mentions burns', () => {
      const spec = TOWER_SPECIALIZATIONS[TowerType.CHAIN][TowerSpecialization.ALPHA];
      expect(spec.description.toLowerCase()).toContain('burn');
    });
  });

  describe('getUpgradeCost', () => {
    it('returns base upgrade cost when tileStrategic is 0', () => {
      const cost = getUpgradeCost(TowerType.BASIC, 1);
      const expected = Math.round(TOWER_CONFIGS[TowerType.BASIC].cost * (UPGRADE_COST_CONFIG.baseMultiplier + 1 * UPGRADE_COST_CONFIG.levelScale));
      expect(cost).toBe(expected);
    });

    it('returns Infinity when at max level', () => {
      expect(getUpgradeCost(TowerType.BASIC, MAX_TOWER_LEVEL)).toBe(Infinity);
    });

    it('returns Infinity when level is 0', () => {
      expect(getUpgradeCost(TowerType.BASIC, 0)).toBe(Infinity);
    });

    it('scales cost by tileStrategic value', () => {
      const scaledCost = getUpgradeCost(TowerType.BASIC, 1, 1, 0.5);
      const expected = Math.round(TOWER_CONFIGS[TowerType.BASIC].cost * (UPGRADE_COST_CONFIG.baseMultiplier + 1 * UPGRADE_COST_CONFIG.levelScale) * 1 * 1.5);
      expect(scaledCost).toBe(expected);
    });

    it('tileStrategic=1 doubles the upgrade cost', () => {
      const maxCost = getUpgradeCost(TowerType.BASIC, 1, 1, 1.0);
      const expected = Math.round(TOWER_CONFIGS[TowerType.BASIC].cost * (UPGRADE_COST_CONFIG.baseMultiplier + 1 * UPGRADE_COST_CONFIG.levelScale) * 1 * 2.0);
      expect(maxCost).toBe(expected);
    });

    it('tileStrategic default parameter is backward compatible', () => {
      const withDefault = getUpgradeCost(TowerType.SNIPER, 2);
      const withExplicit = getUpgradeCost(TowerType.SNIPER, 2, 1, 0);
      expect(withDefault).toBe(withExplicit);
    });

    it('costMultiplier and tileStrategic combine multiplicatively', () => {
      const cost = getUpgradeCost(TowerType.BASIC, 1, 2.0, 0.5);
      const expected = Math.round(TOWER_CONFIGS[TowerType.BASIC].cost * (UPGRADE_COST_CONFIG.baseMultiplier + 1 * UPGRADE_COST_CONFIG.levelScale) * 2.0 * 1.5);
      expect(cost).toBe(expected);
    });

    it('L2 upgrade costs more than L1 upgrade', () => {
      const l1Cost = getUpgradeCost(TowerType.BASIC, 1);
      const l2Cost = getUpgradeCost(TowerType.BASIC, 2);
      expect(l2Cost).toBeGreaterThan(l1Cost);
    });

    it('all tower types return finite costs for valid levels', () => {
      const types = Object.values(TowerType) as TowerType[];
      types.forEach(type => {
        for (let level = 1; level < MAX_TOWER_LEVEL; level++) {
          expect(getUpgradeCost(type, level)).toBeLessThan(Infinity);
          expect(getUpgradeCost(type, level)).toBeGreaterThan(0);
        }
      });
    });

    it('negative tileStrategic reduces cost below base', () => {
      const baseCost = getUpgradeCost(TowerType.BASIC, 1, 1, 0);
      const reducedCost = getUpgradeCost(TowerType.BASIC, 1, 1, -0.2);
      expect(reducedCost).toBeLessThan(baseCost);
    });
  });
});
