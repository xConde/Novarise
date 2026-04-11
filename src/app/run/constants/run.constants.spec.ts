import {
  CAMPAIGN_MAP_TIERS,
  createSeededRng,
  ENCOUNTER_CONFIG,
  getMapTierForNode,
  NODE_MAP_CONFIG,
  REWARD_CONFIG,
  REST_CONFIG,
  SHOP_CONFIG,
} from './run.constants';

describe('Ascent Constants', () => {
  describe('createSeededRng()', () => {
    it('should produce identical sequences for the same seed', () => {
      const rng1 = createSeededRng(100);
      const rng2 = createSeededRng(100);
      for (let i = 0; i < 10; i++) {
        expect(rng1()).toBeCloseTo(rng2(), 10);
      }
    });

    it('should produce values in [0, 1)', () => {
      const rng = createSeededRng(42);
      for (let i = 0; i < 20; i++) {
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });

    it('should produce different sequences for different seeds', () => {
      const rng1 = createSeededRng(100);
      const rng2 = createSeededRng(200);
      // At least one of the first 5 values should differ
      let differs = false;
      for (let i = 0; i < 5; i++) {
        if (rng1() !== rng2()) { differs = true; break; }
      }
      expect(differs).toBeTrue();
    });

    it('should produce a non-uniform sequence (not all values identical)', () => {
      const rng = createSeededRng(1);
      const values = Array.from({ length: 10 }, () => rng());
      const allSame = values.every(v => v === values[0]);
      expect(allSame).toBeFalse();
    });

    it('should produce a known first value for seed 100', () => {
      const rng = createSeededRng(100);
      expect(rng()).toBeCloseTo(0.2043598669115454, 5);
    });
  });

  describe('getMapTierForNode()', () => {
    const totalRows = 11;

    it('should return act1_early for act 0, row 0', () => {
      expect(getMapTierForNode(0, 0, totalRows)).toBe('act1_early');
    });

    it('should return act1_mid for act 0, row 5', () => {
      // 5/11 ≈ 0.454 → mid
      expect(getMapTierForNode(0, 5, totalRows)).toBe('act1_mid');
    });

    it('should return act1_late for act 0, row 8', () => {
      // 8/11 ≈ 0.727 → late
      expect(getMapTierForNode(0, 8, totalRows)).toBe('act1_late');
    });

    it('should return act2_early for act 1, row 0', () => {
      expect(getMapTierForNode(1, 0, totalRows)).toBe('act2_early');
    });

    it('should return act2_mid for act 1, row 4', () => {
      // 4/11 ≈ 0.363 → mid
      expect(getMapTierForNode(1, 4, totalRows)).toBe('act2_mid');
    });

    it('should return act2_late for act 1, row 9', () => {
      // 9/11 ≈ 0.818 → late
      expect(getMapTierForNode(1, 9, totalRows)).toBe('act2_late');
    });
  });

  describe('NODE_MAP_CONFIG', () => {
    it('should have minNodesPerRow less than or equal to maxNodesPerRow', () => {
      expect(NODE_MAP_CONFIG.minNodesPerRow).toBeLessThanOrEqual(NODE_MAP_CONFIG.maxNodesPerRow);
    });

    it('should have minConnectionsPerNode less than or equal to maxConnectionsPerNode', () => {
      expect(NODE_MAP_CONFIG.minConnectionsPerNode).toBeLessThanOrEqual(NODE_MAP_CONFIG.maxConnectionsPerNode);
    });

    it('should have eliteMinRow less than eliteMaxRow', () => {
      expect(NODE_MAP_CONFIG.eliteMinRow).toBeLessThan(NODE_MAP_CONFIG.eliteMaxRow);
    });

    it('should have nodeTypeWeights that sum to approximately 1', () => {
      const weights = NODE_MAP_CONFIG.nodeTypeWeights;
      const sum = weights.combat + weights.elite + weights.rest + weights.shop + weights.event + weights.unknown;
      expect(sum).toBeCloseTo(1, 5);
    });

    it('should have guaranteedShop within content rows', () => {
      expect(NODE_MAP_CONFIG.guaranteedShop).toBeGreaterThan(0);
      expect(NODE_MAP_CONFIG.guaranteedShop).toBeLessThan(NODE_MAP_CONFIG.rowsPerAct);
    });

    it('should have guaranteedRest within content rows', () => {
      expect(NODE_MAP_CONFIG.guaranteedRest).toBeGreaterThan(0);
      expect(NODE_MAP_CONFIG.guaranteedRest).toBeLessThan(NODE_MAP_CONFIG.rowsPerAct);
    });
  });

  describe('ENCOUNTER_CONFIG', () => {
    it('should have wavesPerCombat of 4', () => {
      expect(ENCOUNTER_CONFIG.wavesPerCombat).toBe(4);
    });

    it('should have wavesPerElite of 5', () => {
      expect(ENCOUNTER_CONFIG.wavesPerElite).toBe(5);
    });

    it('should have wavesPerBoss of 6', () => {
      expect(ENCOUNTER_CONFIG.wavesPerBoss).toBe(6);
    });

    it('should have positive enemyCountBasePerWave', () => {
      expect(ENCOUNTER_CONFIG.enemyCountBasePerWave).toBeGreaterThan(0);
    });

    it('should have eliteHealthMultiplier greater than 1', () => {
      expect(ENCOUNTER_CONFIG.eliteHealthMultiplier).toBeGreaterThan(1);
    });

    it('should have bossHealthMultiplier greater than eliteHealthMultiplier', () => {
      expect(ENCOUNTER_CONFIG.bossHealthMultiplier).toBeGreaterThan(ENCOUNTER_CONFIG.eliteHealthMultiplier);
    });
  });

  describe('CAMPAIGN_MAP_TIERS', () => {
    it('should have entries for act1_early, act1_mid, act1_late', () => {
      expect(CAMPAIGN_MAP_TIERS['act1_early']).toBeDefined();
      expect(CAMPAIGN_MAP_TIERS['act1_mid']).toBeDefined();
      expect(CAMPAIGN_MAP_TIERS['act1_late']).toBeDefined();
    });

    it('should have entries for act2_early, act2_mid, act2_late', () => {
      expect(CAMPAIGN_MAP_TIERS['act2_early']).toBeDefined();
      expect(CAMPAIGN_MAP_TIERS['act2_mid']).toBeDefined();
      expect(CAMPAIGN_MAP_TIERS['act2_late']).toBeDefined();
    });

    it('each tier should have at least one campaign map', () => {
      Object.values(CAMPAIGN_MAP_TIERS).forEach(maps => {
        expect(maps.length).toBeGreaterThan(0);
      });
    });
  });
});
