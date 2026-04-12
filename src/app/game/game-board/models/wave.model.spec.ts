import { EnemyType } from './enemy.model';
import {
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
        expect(wave.entries!.length).toBeGreaterThan(0, `wave ${i + 1} has no entries`);
      });
    });

    it('every entry should reference a valid EnemyType', () => {
      const validTypes = Object.values(EnemyType) as string[];
      WAVE_DEFINITIONS.forEach((wave, waveIdx) => {
        wave.entries!.forEach((entry, entryIdx) => {
          expect(validTypes).toContain(
            entry.type,
            `wave ${waveIdx + 1} entry ${entryIdx} has unknown type ${entry.type}`
          );
        });
      });
    });

    it('every entry should have a positive count', () => {
      WAVE_DEFINITIONS.forEach((wave, waveIdx) => {
        wave.entries!.forEach((entry, entryIdx) => {
          expect(entry.count).toBeGreaterThan(
            0,
            `wave ${waveIdx + 1} entry ${entryIdx} has count <= 0`
          );
        });
      });
    });

    it('every entry should have a non-negative spawnInterval', () => {
      WAVE_DEFINITIONS.forEach((wave, waveIdx) => {
        wave.entries!.forEach((entry, entryIdx) => {
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
      const hasBoss = finalWave.entries!.some(e => e.type === EnemyType.BOSS);
      expect(hasBoss).toBeTrue();
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
      expect(wave.entries!.length).toBe(1);
      expect(wave.reward).toBe(50);
    });
  });
});
