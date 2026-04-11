import { StatusEffectType, StatusEffectConfig, STATUS_EFFECT_CONFIGS } from './status-effect.constants';

describe('STATUS_EFFECT_CONFIGS', () => {
  const allTypes = Object.values(StatusEffectType);

  it('should have a config for every StatusEffectType', () => {
    for (const type of allTypes) {
      expect(STATUS_EFFECT_CONFIGS[type]).toBeDefined(`Missing config for ${type}`);
    }
  });

  it('should have matching type fields', () => {
    for (const type of allTypes) {
      expect(STATUS_EFFECT_CONFIGS[type].type).toBe(type);
    }
  });

  it('should have positive durations', () => {
    for (const type of allTypes) {
      expect(STATUS_EFFECT_CONFIGS[type].duration).toBeGreaterThan(0, `${type} duration must be positive`);
    }
  });

  describe('SLOW config', () => {
    const cfg = STATUS_EFFECT_CONFIGS[StatusEffectType.SLOW];

    it('should have speedMultiplier between 0 and 1 (exclusive)', () => {
      expect(cfg.speedMultiplier).toBeDefined();
      expect(cfg.speedMultiplier!).toBeGreaterThan(0);
      expect(cfg.speedMultiplier!).toBeLessThan(1);
    });

    it('should not stack', () => {
      expect(cfg.stacks).toBe(false);
    });
  });

  describe('BURN config', () => {
    const cfg = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN];

    it('should have positive damagePerTick', () => {
      expect(cfg.damagePerTick).toBeDefined();
      expect(cfg.damagePerTick!).toBeGreaterThan(0);
    });

    it('should not stack', () => {
      expect(cfg.stacks).toBe(false);
    });
  });

  describe('POISON config', () => {
    const cfg = STATUS_EFFECT_CONFIGS[StatusEffectType.POISON];

    it('should have positive damagePerTick', () => {
      expect(cfg.damagePerTick).toBeDefined();
      expect(cfg.damagePerTick!).toBeGreaterThan(0);
    });

    it('should not stack', () => {
      expect(cfg.stacks).toBe(false);
    });
  });
});
