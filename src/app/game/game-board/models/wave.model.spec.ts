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

    // ── Sprint 35 — Phase 2 carryover: UNSHAKEABLE + VEINSEEKER placement ──

    it('UNSHAKEABLE appears in at least one wave definition (regression guard)', () => {
      // Sprint 35: UNSHAKEABLE placed in wave 9 as elite reinforcement.
      // If this test fails, an UNSHAKEABLE entry was accidentally removed during
      // a balance pass — restore it before merging.
      const appearsInAnyWave = WAVE_DEFINITIONS.some(wave =>
        wave.entries!.some(e => e.type === EnemyType.UNSHAKEABLE)
      );
      expect(appearsInAnyWave).toBeTrue();
    });

    it('VEINSEEKER appears in at least one wave definition (regression guard)', () => {
      // Sprint 35: VEINSEEKER placed in wave 10 (boss wave).
      // If this test fails, a VEINSEEKER entry was accidentally removed — restore it.
      const appearsInAnyWave = WAVE_DEFINITIONS.some(wave =>
        wave.entries!.some(e => e.type === EnemyType.VEINSEEKER)
      );
      expect(appearsInAnyWave).toBeTrue();
    });

    it('VEINSEEKER appears in a wave that also contains a BOSS (boss-wave placement guard)', () => {
      // VEINSEEKER is a boss-tier enemy — must live in a wave with at least one BOSS entry.
      const veinseekerWaves = WAVE_DEFINITIONS.filter(wave =>
        wave.entries!.some(e => e.type === EnemyType.VEINSEEKER)
      );
      expect(veinseekerWaves.length).toBeGreaterThan(0);
      const allInBossWaves = veinseekerWaves.every(wave =>
        wave.entries!.some(e => e.type === EnemyType.BOSS)
      );
      expect(allInBossWaves).toBeTrue();
    });

    // ── Sprint 37 — GLIDER wave placement regression guard ─────────────────
    it('GLIDER appears in at least one wave definition (sprint 37 regression guard)', () => {
      // Sprint 37: GLIDER placed in wave 6 as an elevation-immunity threat.
      // If this test fails, a GLIDER entry was accidentally removed — restore it.
      const hasGlider = WAVE_DEFINITIONS.some(wave =>
        wave.entries!.some(e => e.type === EnemyType.GLIDER)
      );
      expect(hasGlider).toBeTrue();
    });

    it('GLIDER is in a pre-boss wave (wave index < 9)', () => {
      // GLIDER is a non-elite threat — should appear before elite/boss waves.
      const gliderWaveIndex = WAVE_DEFINITIONS.findIndex(wave =>
        wave.entries!.some(e => e.type === EnemyType.GLIDER)
      );
      expect(gliderWaveIndex).toBeGreaterThanOrEqual(0);
      expect(gliderWaveIndex).toBeLessThan(8); // before wave 9 (elite) and wave 10 (boss)
    });

    // ── Sprint 38 — TITAN wave placement regression guard ──────────────────
    it('TITAN appears in at least one wave definition (sprint 38 regression guard)', () => {
      // Sprint 38: TITAN placed in wave 8 as an elite-tier threat countering elevation damage.
      // If this test fails, a TITAN entry was accidentally removed — restore it.
      const hasTitan = WAVE_DEFINITIONS.some(wave =>
        wave.entries!.some(e => e.type === EnemyType.TITAN)
      );
      expect(hasTitan).toBeTrue();
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
