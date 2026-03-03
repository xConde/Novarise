import { EnemyType } from './enemy.model';
import {
  ENDLESS_CONFIG,
  EndlessWaveConfig,
  WAVE_DEFINITIONS,
  WaveDefinition,
  WaveEntry
} from './wave.model';

describe('Wave Model', () => {
  describe('WAVE_DEFINITIONS', () => {
    it('should define exactly 10 waves', () => {
      expect(WAVE_DEFINITIONS.length).toBe(10);
    });

    it('every wave should have at least one entry', () => {
      WAVE_DEFINITIONS.forEach((wave, i) => {
        expect(wave.entries.length).toBeGreaterThan(0, `wave ${i + 1} has no entries`);
      });
    });

    it('every entry should reference a valid EnemyType', () => {
      const validTypes = Object.values(EnemyType) as string[];
      WAVE_DEFINITIONS.forEach((wave, waveIdx) => {
        wave.entries.forEach((entry, entryIdx) => {
          expect(validTypes).toContain(
            entry.type,
            `wave ${waveIdx + 1} entry ${entryIdx} has unknown type ${entry.type}`
          );
        });
      });
    });

    it('every entry should have a positive count', () => {
      WAVE_DEFINITIONS.forEach((wave, waveIdx) => {
        wave.entries.forEach((entry, entryIdx) => {
          expect(entry.count).toBeGreaterThan(
            0,
            `wave ${waveIdx + 1} entry ${entryIdx} has count <= 0`
          );
        });
      });
    });

    it('every entry should have a non-negative spawnInterval', () => {
      WAVE_DEFINITIONS.forEach((wave, waveIdx) => {
        wave.entries.forEach((entry, entryIdx) => {
          expect(entry.spawnInterval).toBeGreaterThanOrEqual(
            0,
            `wave ${waveIdx + 1} entry ${entryIdx} has negative spawnInterval`
          );
        });
      });
    });

    it('every wave should have a positive reward', () => {
      WAVE_DEFINITIONS.forEach((wave, i) => {
        expect(wave.reward).toBeGreaterThan(0, `wave ${i + 1} has reward <= 0`);
      });
    });

    it('final wave (wave 10) should include a BOSS', () => {
      const finalWave = WAVE_DEFINITIONS[WAVE_DEFINITIONS.length - 1];
      const hasBoss = finalWave.entries.some(e => e.type === EnemyType.BOSS);
      expect(hasBoss).toBeTrue();
    });
  });

  describe('ENDLESS_CONFIG', () => {
    it('should be defined', () => {
      expect(ENDLESS_CONFIG).toBeDefined();
    });

    it('should have baseHealthMultiplier of 1.0', () => {
      expect(ENDLESS_CONFIG.baseHealthMultiplier).toBe(1.0);
    });

    it('should have healthScalePerWave of 0.15', () => {
      expect(ENDLESS_CONFIG.healthScalePerWave).toBe(0.15);
    });

    it('should have baseSpeedMultiplier of 1.0', () => {
      expect(ENDLESS_CONFIG.baseSpeedMultiplier).toBe(1.0);
    });

    it('should have speedScalePerWave of 0.05', () => {
      expect(ENDLESS_CONFIG.speedScalePerWave).toBe(0.05);
    });

    it('should have baseCountMultiplier of 1.0', () => {
      expect(ENDLESS_CONFIG.baseCountMultiplier).toBe(1.0);
    });

    it('should have countScalePerWave of 0.1', () => {
      expect(ENDLESS_CONFIG.countScalePerWave).toBe(0.1);
    });

    it('should have bossInterval of 5', () => {
      expect(ENDLESS_CONFIG.bossInterval).toBe(5);
    });

    it('all numeric values should be positive', () => {
      const config: EndlessWaveConfig = ENDLESS_CONFIG;
      expect(config.baseHealthMultiplier).toBeGreaterThan(0);
      expect(config.healthScalePerWave).toBeGreaterThan(0);
      expect(config.baseSpeedMultiplier).toBeGreaterThan(0);
      expect(config.speedScalePerWave).toBeGreaterThan(0);
      expect(config.baseCountMultiplier).toBeGreaterThan(0);
      expect(config.countScalePerWave).toBeGreaterThan(0);
      expect(config.bossInterval).toBeGreaterThan(0);
    });

    it('bossInterval should be a positive integer', () => {
      expect(Number.isInteger(ENDLESS_CONFIG.bossInterval)).toBeTrue();
      expect(ENDLESS_CONFIG.bossInterval).toBeGreaterThan(0);
    });

    it('scaling values should produce meaningful progression (wave 20 multiplier > wave 1)', () => {
      const wave1HealthMult =
        ENDLESS_CONFIG.baseHealthMultiplier +
        ENDLESS_CONFIG.healthScalePerWave * 0; // wave 1: (waveNumber - 1) = 0
      const wave20HealthMult =
        ENDLESS_CONFIG.baseHealthMultiplier +
        ENDLESS_CONFIG.healthScalePerWave * 19; // wave 20: (20 - 1) = 19
      expect(wave20HealthMult).toBeGreaterThan(wave1HealthMult);
    });
  });

  describe('WaveEntry interface', () => {
    it('should accept a valid entry', () => {
      const entry: WaveEntry = {
        type: EnemyType.BASIC,
        count: 5,
        spawnInterval: 1.0
      };
      expect(entry.type).toBe(EnemyType.BASIC);
      expect(entry.count).toBe(5);
      expect(entry.spawnInterval).toBe(1.0);
    });
  });

  describe('WaveDefinition interface', () => {
    it('should accept a valid wave definition', () => {
      const wave: WaveDefinition = {
        entries: [
          { type: EnemyType.BASIC, count: 5, spawnInterval: 1.0 }
        ],
        reward: 50
      };
      expect(wave.entries.length).toBe(1);
      expect(wave.reward).toBe(50);
    });
  });
});
