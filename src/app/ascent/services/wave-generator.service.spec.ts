import { TestBed } from '@angular/core/testing';
import { WaveGeneratorService } from './wave-generator.service';
import { EnemyType } from '../../game/game-board/models/enemy.model';
import { ENCOUNTER_CONFIG } from '../constants/ascent.constants';

describe('WaveGeneratorService', () => {
  let service: WaveGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WaveGeneratorService],
    });
    service = TestBed.inject(WaveGeneratorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── generateCombatWaves ────────────────────────────────────

  describe('generateCombatWaves()', () => {
    it('should produce wavesPerCombat (4) waves', () => {
      const waves = service.generateCombatWaves(0, 0, 42);
      expect(waves.length).toBe(ENCOUNTER_CONFIG.wavesPerCombat);
    });

    it('every wave should have at least one entry', () => {
      const waves = service.generateCombatWaves(3, 0, 42);
      waves.forEach((w, i) => {
        expect(w.entries.length).toBeGreaterThan(0, `wave ${i} has no entries`);
      });
    });

    it('every wave should have a positive gold reward', () => {
      const waves = service.generateCombatWaves(3, 0, 42);
      waves.forEach((w, i) => {
        expect(w.reward).toBeGreaterThan(0, `wave ${i} has non-positive reward`);
      });
    });

    it('should use only BASIC/FAST enemies in act 1 early rows (row <= 3)', () => {
      const allowedTypes = new Set<EnemyType>([EnemyType.BASIC, EnemyType.FAST]);
      for (let row = 0; row <= 3; row++) {
        const waves = service.generateCombatWaves(row, 0, 42 + row);
        waves.forEach(w => {
          w.entries.forEach(e => {
            expect(allowedTypes.has(e.type)).withContext(
              `row ${row} contains unexpected enemy type ${e.type}`,
            ).toBeTrue();
          });
        });
      }
    });

    it('spawn intervals should be within [0.4, 1.0]', () => {
      const waves = service.generateCombatWaves(5, 0, 42);
      waves.forEach(w => {
        w.entries.forEach(e => {
          expect(e.spawnInterval).toBeGreaterThanOrEqual(0.4);
          expect(e.spawnInterval).toBeLessThanOrEqual(1.0);
        });
      });
    });

    it('enemy counts should be positive', () => {
      const waves = service.generateCombatWaves(5, 0, 42);
      waves.forEach(w => {
        w.entries.forEach(e => {
          expect(e.count).toBeGreaterThan(0);
        });
      });
    });

    it('should be deterministic — same params produce same waves', () => {
      const waves1 = service.generateCombatWaves(4, 0, 99);
      const waves2 = service.generateCombatWaves(4, 0, 99);
      expect(JSON.stringify(waves1)).toBe(JSON.stringify(waves2));
    });

    it('enemy count should be higher at deeper rows (act 1, row 8 vs row 1)', () => {
      // Base count: floor(5 + row * 0.5); deep rows have higher base
      // Use enough samples to average out the ±1 variance
      const deepWaves = service.generateCombatWaves(8, 0, 42);
      const shallowWaves = service.generateCombatWaves(1, 0, 42);
      const deepTotal = deepWaves.reduce((s, w) => s + w.entries.reduce((es, e) => es + e.count, 0), 0);
      const shallowTotal = shallowWaves.reduce((s, w) => s + w.entries.reduce((es, e) => es + e.count, 0), 0);
      expect(deepTotal).toBeGreaterThan(shallowTotal);
    });
  });

  // ── generateEliteWaves ────────────────────────────────────

  describe('generateEliteWaves()', () => {
    it('should produce wavesPerElite (5) waves', () => {
      const waves = service.generateEliteWaves(4, 0, 42);
      expect(waves.length).toBe(ENCOUNTER_CONFIG.wavesPerElite);
    });

    it('should have at least one wave containing a BOSS-type entry', () => {
      const waves = service.generateEliteWaves(4, 0, 42);
      const hasBossEntry = waves.some(w => w.entries.some(e => e.type === EnemyType.BOSS));
      expect(hasBossEntry).toBeTrue();
    });

    it('every wave should have a positive gold reward', () => {
      const waves = service.generateEliteWaves(4, 0, 42);
      waves.forEach((w, i) => {
        expect(w.reward).toBeGreaterThan(0, `elite wave ${i} has non-positive reward`);
      });
    });

    it('should be deterministic — same params produce same waves', () => {
      const waves1 = service.generateEliteWaves(5, 0, 77);
      const waves2 = service.generateEliteWaves(5, 0, 77);
      expect(JSON.stringify(waves1)).toBe(JSON.stringify(waves2));
    });

    it('gold rewards should be higher than standard combat at the same row', () => {
      // eliteGoldMultiplier = 1.5
      const combatWaves = service.generateCombatWaves(5, 0, 42);
      const eliteWaves = service.generateEliteWaves(5, 0, 42);
      const combatGoldAvg = combatWaves.reduce((s, w) => s + w.reward, 0) / combatWaves.length;
      const eliteGoldAvg = eliteWaves.reduce((s, w) => s + w.reward, 0) / eliteWaves.length;
      expect(eliteGoldAvg).toBeGreaterThan(combatGoldAvg);
    });

    it('spawn intervals should be within [0.4, 1.0]', () => {
      const waves = service.generateEliteWaves(5, 0, 42);
      waves.forEach(w => {
        w.entries.forEach(e => {
          if (e.spawnInterval > 0) {
            // boss solo entry uses spawnInterval 0 — skip that
            expect(e.spawnInterval).toBeGreaterThanOrEqual(0.4);
            expect(e.spawnInterval).toBeLessThanOrEqual(1.0);
          }
        });
      });
    });
  });

  // ── generateBossWaves ─────────────────────────────────────

  describe('generateBossWaves()', () => {
    it('should produce wavesPerBoss (6) waves', () => {
      const waves = service.generateBossWaves(0, 42);
      expect(waves.length).toBe(ENCOUNTER_CONFIG.wavesPerBoss);
    });

    it('final wave should be a solo BOSS entry', () => {
      const waves = service.generateBossWaves(0, 42);
      const finalWave = waves[waves.length - 1];
      expect(finalWave.entries.length).toBe(1);
      expect(finalWave.entries[0].type).toBe(EnemyType.BOSS);
      expect(finalWave.entries[0].count).toBe(1);
    });

    it('final wave should have spawnInterval of 0', () => {
      const waves = service.generateBossWaves(0, 42);
      const finalWave = waves[waves.length - 1];
      expect(finalWave.entries[0].spawnInterval).toBe(0);
    });

    it('final wave should have a positive gold reward', () => {
      const waves = service.generateBossWaves(0, 42);
      const finalWave = waves[waves.length - 1];
      expect(finalWave.reward).toBeGreaterThan(0);
    });

    it('should be deterministic — same params produce same waves', () => {
      const waves1 = service.generateBossWaves(0, 55);
      const waves2 = service.generateBossWaves(0, 55);
      expect(JSON.stringify(waves1)).toBe(JSON.stringify(waves2));
    });

    it('all non-final waves should have positive gold reward', () => {
      const waves = service.generateBossWaves(0, 42);
      const nonFinalWaves = waves.slice(0, -1);
      nonFinalWaves.forEach((w, i) => {
        expect(w.reward).toBeGreaterThan(0, `boss wave ${i} has non-positive reward`);
      });
    });

    it('act 1 boss should produce higher enemy counts than act 0 boss', () => {
      // act multiplier = 1.4 applies for actIndex > 0
      const act0Waves = service.generateBossWaves(0, 42);
      const act1Waves = service.generateBossWaves(1, 42);
      // Compare total enemy count across all non-final waves
      const countWaves = (waves: typeof act0Waves) =>
        waves.slice(0, -1).reduce((s, w) => s + w.entries.reduce((es, e) => es + e.count, 0), 0);
      expect(countWaves(act1Waves)).toBeGreaterThan(countWaves(act0Waves));
    });
  });
});
