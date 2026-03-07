import { TowerType, TowerSpecialization, TOWER_DESCRIPTIONS, TOWER_SPECIALIZATIONS } from './tower.model';

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
      expect(TOWER_DESCRIPTIONS[TowerType.MORTAR]).toBe('Creates damage zones on the ground');
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
});
