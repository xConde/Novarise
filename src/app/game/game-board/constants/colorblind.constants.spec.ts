import { EnemyType } from '@core/models/enemy-type.model';
import { StatusEffectType } from './status-effect.constants';
import {
  COLORBLIND_ENEMY_PALETTE,
  COLORBLIND_STATUS_EMISSIVE_PALETTE,
  COLORBLIND_STATUS_PARTICLE_PALETTE,
  resolveEnemyColor,
  resolveStatusEmissive,
  resolveStatusParticleColors,
} from './colorblind.constants';

describe('colorblind.constants', () => {

  // ── Palette completeness ───────────────────────────────────────────────────

  describe('COLORBLIND_ENEMY_PALETTE completeness', () => {
    const allEnemyTypes = Object.values(EnemyType).filter(v => typeof v === 'number') as EnemyType[];

    it('should have an entry for every EnemyType', () => {
      for (const type of allEnemyTypes) {
        expect(COLORBLIND_ENEMY_PALETTE[type]).toBeDefined(
          `Missing colorblind palette entry for EnemyType.${EnemyType[type]}`
        );
      }
    });

    it('should have non-zero colour values for every EnemyType', () => {
      for (const type of allEnemyTypes) {
        expect(COLORBLIND_ENEMY_PALETTE[type]).toBeGreaterThan(0,
          `Zero colour for EnemyType.${EnemyType[type]}`
        );
      }
    });
  });

  describe('COLORBLIND_STATUS_PARTICLE_PALETTE completeness', () => {
    const allStatusTypes = [StatusEffectType.BURN, StatusEffectType.POISON, StatusEffectType.SLOW];

    it('should have color and emissive for every StatusEffectType', () => {
      for (const type of allStatusTypes) {
        const entry = COLORBLIND_STATUS_PARTICLE_PALETTE[type];
        expect(entry).toBeDefined();
        expect(typeof entry.color).toBe('number');
        expect(typeof entry.emissive).toBe('number');
      }
    });
  });

  describe('COLORBLIND_STATUS_EMISSIVE_PALETTE completeness', () => {
    const allStatusTypes = [StatusEffectType.BURN, StatusEffectType.POISON, StatusEffectType.SLOW];

    it('should have emissiveColor and emissiveIntensity for every StatusEffectType', () => {
      for (const type of allStatusTypes) {
        const entry = COLORBLIND_STATUS_EMISSIVE_PALETTE[type];
        expect(entry).toBeDefined();
        expect(typeof entry.emissiveColor).toBe('number');
        expect(entry.emissiveIntensity).toBeGreaterThan(0);
      }
    });
  });

  // ── resolveEnemyColor ──────────────────────────────────────────────────────

  describe('resolveEnemyColor', () => {
    const defaultBasicColor = 0xc83838;
    const defaultFastColor  = 0xd6c844;

    it('returns the default color when colorblindAssist is false', () => {
      expect(resolveEnemyColor(EnemyType.BASIC, defaultBasicColor, false)).toBe(defaultBasicColor);
      expect(resolveEnemyColor(EnemyType.FAST, defaultFastColor, false)).toBe(defaultFastColor);
    });

    it('returns the colorblind palette value when colorblindAssist is true', () => {
      expect(resolveEnemyColor(EnemyType.BASIC, defaultBasicColor, true))
        .toBe(COLORBLIND_ENEMY_PALETTE[EnemyType.BASIC]);
      expect(resolveEnemyColor(EnemyType.FAST, defaultFastColor, true))
        .toBe(COLORBLIND_ENEMY_PALETTE[EnemyType.FAST]);
    });

    it('returns different values for BASIC vs FAST under colorblind assist', () => {
      const basicColor = resolveEnemyColor(EnemyType.BASIC, defaultBasicColor, true);
      const fastColor  = resolveEnemyColor(EnemyType.FAST, defaultFastColor, true);
      expect(basicColor).not.toBe(fastColor);
    });

    it('returns different values for BOSS vs BASIC under colorblind assist (boss must stand out)', () => {
      const basicColor = resolveEnemyColor(EnemyType.BASIC, defaultBasicColor, true);
      const bossColor  = resolveEnemyColor(EnemyType.BOSS, 0xc848b8, true);
      expect(basicColor).not.toBe(bossColor);
    });

    it('covers all 15 EnemyType values without throwing', () => {
      const allTypes = Object.values(EnemyType).filter(v => typeof v === 'number') as EnemyType[];
      expect(() => {
        for (const type of allTypes) {
          resolveEnemyColor(type, 0xffffff, true);
        }
      }).not.toThrow();
    });
  });

  // ── resolveStatusParticleColors ────────────────────────────────────────────

  describe('resolveStatusParticleColors', () => {
    it('returns defaults when colorblindAssist is false', () => {
      const result = resolveStatusParticleColors(StatusEffectType.POISON, 0x44ff44, 0x22cc22, false);
      expect(result.color).toBe(0x44ff44);
      expect(result.emissive).toBe(0x22cc22);
    });

    it('returns the colorblind palette for POISON when assist is true', () => {
      const result = resolveStatusParticleColors(StatusEffectType.POISON, 0x44ff44, 0x22cc22, true);
      expect(result).toEqual(COLORBLIND_STATUS_PARTICLE_PALETTE[StatusEffectType.POISON]);
    });

    it('keeps BURN unchanged under colorblind assist (orange is deuteranopia-safe)', () => {
      const defaultResult  = resolveStatusParticleColors(StatusEffectType.BURN, 0xff6600, 0xff4400, false);
      const assistResult   = resolveStatusParticleColors(StatusEffectType.BURN, 0xff6600, 0xff4400, true);
      expect(defaultResult.color).toBe(assistResult.color);
    });
  });

  // ── resolveStatusEmissive ──────────────────────────────────────────────────

  describe('resolveStatusEmissive', () => {
    it('returns defaults when colorblindAssist is false', () => {
      const result = resolveStatusEmissive(StatusEffectType.POISON, 0x44ff22, 1.6, false);
      expect(result.emissiveColor).toBe(0x44ff22);
      expect(result.emissiveIntensity).toBe(1.6);
    });

    it('substitutes violet for POISON emissive when assist is true', () => {
      const result = resolveStatusEmissive(StatusEffectType.POISON, 0x44ff22, 1.6, true);
      expect(result).toEqual(COLORBLIND_STATUS_EMISSIVE_PALETTE[StatusEffectType.POISON]);
      // Violet — must not be the original green 0x44ff22
      expect(result.emissiveColor).not.toBe(0x44ff22);
    });

    it('keeps SLOW emissive unchanged under colorblind assist', () => {
      const defaultResult = resolveStatusEmissive(StatusEffectType.SLOW, 0x4488ff, 1.6, false);
      const assistResult  = resolveStatusEmissive(StatusEffectType.SLOW, 0x4488ff, 1.6, true);
      expect(defaultResult.emissiveColor).toBe(assistResult.emissiveColor);
    });
  });

});
