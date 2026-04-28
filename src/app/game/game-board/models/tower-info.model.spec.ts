import { TOWER_INFO } from './tower-info.model';
import { TowerType, TOWER_CONFIGS, TOWER_DESCRIPTIONS, TOWER_SPECIALIZATIONS, TowerSpecialization } from './tower.model';

describe('TOWER_INFO', () => {
  const ALL_TYPES = Object.values(TowerType) as TowerType[];

  it('should have an entry for every TowerType value', () => {
    ALL_TYPES.forEach(type => {
      expect(TOWER_INFO[type]).toBeDefined();
    });
  });

  it('should have exactly 6 entries matching the 6 TowerType values', () => {
    expect(Object.keys(TOWER_INFO).length).toBe(ALL_TYPES.length);
  });

  it('each entry type field matches the key', () => {
    ALL_TYPES.forEach(type => {
      expect(TOWER_INFO[type].type).toBe(type);
    });
  });

  it('each entry has a non-empty name', () => {
    ALL_TYPES.forEach(type => {
      expect(TOWER_INFO[type].name.length).toBeGreaterThan(0);
    });
  });

  it('each entry description matches TOWER_DESCRIPTIONS', () => {
    ALL_TYPES.forEach(type => {
      expect(TOWER_INFO[type].description).toBe(TOWER_DESCRIPTIONS[type]);
    });
  });

  it('each entry base stats match TOWER_CONFIGS', () => {
    ALL_TYPES.forEach(type => {
      const info = TOWER_INFO[type];
      const cfg = TOWER_CONFIGS[type];
      expect(info.damage).toBe(cfg.damage);
      expect(info.range).toBe(cfg.range);
      expect(info.cost).toBe(cfg.cost);
      expect(info.color).toBe(cfg.color);
    });
  });

  it('each entry alpha matches TOWER_SPECIALIZATIONS ALPHA', () => {
    ALL_TYPES.forEach(type => {
      const info = TOWER_INFO[type];
      const specAlpha = TOWER_SPECIALIZATIONS[type][TowerSpecialization.ALPHA];
      expect(info.alpha.label).toBe(specAlpha.label);
      expect(info.alpha.description).toBe(specAlpha.description);
    });
  });

  it('each entry beta matches TOWER_SPECIALIZATIONS BETA', () => {
    ALL_TYPES.forEach(type => {
      const info = TOWER_INFO[type];
      const specBeta = TOWER_SPECIALIZATIONS[type][TowerSpecialization.BETA];
      expect(info.beta.label).toBe(specBeta.label);
      expect(info.beta.description).toBe(specBeta.description);
    });
  });

  it('alpha and beta labels are different for each tower type', () => {
    ALL_TYPES.forEach(type => {
      expect(TOWER_INFO[type].alpha.label).not.toBe(TOWER_INFO[type].beta.label);
    });
  });

  it('alpha and beta descriptions are non-empty', () => {
    ALL_TYPES.forEach(type => {
      expect(TOWER_INFO[type].alpha.description.length).toBeGreaterThan(0);
      expect(TOWER_INFO[type].beta.description.length).toBeGreaterThan(0);
    });
  });

  describe('spot-check specific entries', () => {
    it('BASIC entry has correct name', () => {
      expect(TOWER_INFO[TowerType.BASIC].name).toBe('Basic');
    });

    it('SNIPER entry has correct name', () => {
      expect(TOWER_INFO[TowerType.SNIPER].name).toBe('Sniper');
    });

    it('MORTAR entry has correct name', () => {
      expect(TOWER_INFO[TowerType.MORTAR].name).toBe('Mortar');
    });

    it('BASIC alpha is Marksman', () => {
      expect(TOWER_INFO[TowerType.BASIC].alpha.label).toBe('Marksman');
    });

    it('BASIC beta is Rapid', () => {
      expect(TOWER_INFO[TowerType.BASIC].beta.label).toBe('Rapid');
    });

    it('SNIPER alpha is Assassin', () => {
      expect(TOWER_INFO[TowerType.SNIPER].alpha.label).toBe('Assassin');
    });

    it('CHAIN alpha is Tesla', () => {
      expect(TOWER_INFO[TowerType.CHAIN].alpha.label).toBe('Tesla');
    });

    it('MORTAR alpha is Siege', () => {
      expect(TOWER_INFO[TowerType.MORTAR].alpha.label).toBe('Siege');
    });
  });
});
