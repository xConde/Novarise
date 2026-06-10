import { TestBed } from '@angular/core/testing';
import { WaveGeneratorService } from './wave-generator.service';
import { EnemyType } from '../../game/game-board/models/enemy.model';
import { ENCOUNTER_CONFIG } from '../constants/run.constants';
import { ACT1_BOSS_PRESETS, ACT2_BOSS_PRESETS, ACT3_BOSS_PRESETS } from '../constants/boss-presets';

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
        expect(w.entries!.length).toBeGreaterThan(0, `wave ${i} has no entries`);
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
          w.entries!.forEach(e => {
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
        w.entries!.forEach(e => {
          expect(e.spawnInterval).toBeGreaterThanOrEqual(0.4);
          expect(e.spawnInterval).toBeLessThanOrEqual(1.0);
        });
      });
    });

    it('enemy counts should be positive', () => {
      const waves = service.generateCombatWaves(5, 0, 42);
      waves.forEach(w => {
        w.entries!.forEach(e => {
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
      const deepTotal = deepWaves.reduce((s, w) => s + w.entries!.reduce((es, e) => es + e.count, 0), 0);
      const shallowTotal = shallowWaves.reduce((s, w) => s + w.entries!.reduce((es, e) => es + e.count, 0), 0);
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
      const hasBossEntry = waves.some(w => w.entries!.some(e => e.type === EnemyType.BOSS));
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
        w.entries!.forEach(e => {
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
    it('act 1 (actIndex=0) should produce 6 waves from the act 1 preset pool', () => {
      // All act 1 presets have 6 waves
      const waves = service.generateBossWaves(0, 42);
      expect(ACT1_BOSS_PRESETS.some(p => p.waves.length === waves.length)).toBeTrue();
      expect(waves.length).toBe(6);
    });

    it('act 2 (actIndex=1) should produce 7 waves from the act 2 preset pool', () => {
      // All act 2 presets have 7 waves
      const waves = service.generateBossWaves(1, 42);
      expect(ACT2_BOSS_PRESETS.some(p => p.waves.length === waves.length)).toBeTrue();
      expect(waves.length).toBe(7);
    });

    it('act 1 final wave should contain a BOSS entry', () => {
      const waves = service.generateBossWaves(0, 42);
      const finalWave = waves[waves.length - 1];
      const hasBoss = finalWave.entries!.some(e => e.type === EnemyType.BOSS);
      expect(hasBoss).toBeTrue();
    });

    it('act 1 final wave solo BOSS should have spawnInterval of 0', () => {
      const waves = service.generateBossWaves(0, 42);
      const finalWave = waves[waves.length - 1];
      const bossEntry = finalWave.entries!.find(e => e.type === EnemyType.BOSS);
      expect(bossEntry?.spawnInterval).toBe(0);
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

    it('all waves should have positive gold reward', () => {
      const waves = service.generateBossWaves(0, 42);
      waves.forEach((w, i) => {
        expect(w.reward).toBeGreaterThan(0, `boss wave ${i} has non-positive reward`);
      });
    });

    it('act 2 boss should have more total waves than act 1 boss', () => {
      const act1Waves = service.generateBossWaves(0, 42);
      const act2Waves = service.generateBossWaves(1, 42);
      expect(act2Waves.length).toBeGreaterThan(act1Waves.length);
    });
  });

  // ── getBossPreset ──────────────────────────────────────────

  describe('getBossPreset()', () => {
    it('should return an act 1 preset for actIndex=0', () => {
      const preset = service.getBossPreset(0, 42);
      expect(ACT1_BOSS_PRESETS.some(p => p.id === preset.id)).toBeTrue();
    });

    it('should return an act 2 preset for actIndex=1', () => {
      const preset = service.getBossPreset(1, 42);
      expect(ACT2_BOSS_PRESETS.some(p => p.id === preset.id)).toBeTrue();
    });

    it('should be deterministic for the same seed', () => {
      const preset1 = service.getBossPreset(0, 99);
      const preset2 = service.getBossPreset(0, 99);
      expect(preset1.id).toBe(preset2.id);
    });

    it('should return a preset with a non-empty name', () => {
      const preset = service.getBossPreset(0, 42);
      expect(preset.name.length).toBeGreaterThan(0);
    });

    it('should return an act 3 preset for actIndex=2', () => {
      const preset = service.getBossPreset(2, 42);
      expect(ACT3_BOSS_PRESETS.some(p => p.id === preset.id)).toBeTrue();
    });

    it('act 3 preset id should be one of the three expected ids', () => {
      const validIds = new Set(['vanguard_convergence', 'celestial_deluge', 'ironclad_march']);
      const preset = service.getBossPreset(2, 42);
      expect(validIds.has(preset.id)).withContext(`unexpected id "${preset.id}"`).toBeTrue();
    });

    it('act 3 getBossPreset() is deterministic for the same seed', () => {
      const preset1 = service.getBossPreset(2, 77);
      const preset2 = service.getBossPreset(2, 77);
      expect(preset1.id).toBe(preset2.id);
    });
  });

  // ── Act 3 ──────────────────────────────────────────────────

  describe('Act 3', () => {
    it('each ACT3_BOSS_PRESETS entry has exactly 8 waves', () => {
      for (const preset of ACT3_BOSS_PRESETS) {
        expect(preset.waves.length)
          .withContext(`preset "${preset.id}" should have 8 waves`)
          .toBe(8);
      }
    });

    it('each ACT3_BOSS_PRESETS entry last wave has exactly 1 NOVA_SOVEREIGN entry', () => {
      for (const preset of ACT3_BOSS_PRESETS) {
        const finalWave = preset.waves[preset.waves.length - 1];
        const sovereignEntries = finalWave.entries!.filter(e => e.type === EnemyType.NOVA_SOVEREIGN);
        expect(sovereignEntries.length)
          .withContext(`preset "${preset.id}" final wave sovereign entry count`)
          .toBe(1);
        expect(sovereignEntries[0].count)
          .withContext(`preset "${preset.id}" NOVA_SOVEREIGN count`)
          .toBe(1);
      }
    });

    it('generateCombatWaves() for actIndex=2 produces strictly more enemies than actIndex=1 (same row and seed)', () => {
      const row = 4;
      const seed = 42;
      const act2Waves = service.generateCombatWaves(row, 1, seed);
      const act3Waves = service.generateCombatWaves(row, 2, seed);
      const act2Total = act2Waves.reduce((s, w) => s + w.entries!.reduce((es, e) => es + e.count, 0), 0);
      const act3Total = act3Waves.reduce((s, w) => s + w.entries!.reduce((es, e) => es + e.count, 0), 0);
      expect(act3Total).toBeGreaterThan(act2Total);
    });

    it('generateCombatWaves() for actIndex=2, row<5 does not include TITAN', () => {
      // ACT3_BASE_POOL has no TITAN; TITAN only appears at row >= ACT3_HEAVY_MIN_ROW (5)
      for (let seed = 0; seed < 5; seed++) {
        const waves = service.generateCombatWaves(4, 2, seed * 100 + 7);
        waves.forEach(w => {
          w.entries!.forEach(e => {
            expect(e.type)
              .withContext(`row 4 act 3 seed ${seed} should not contain TITAN`)
              .not.toBe(EnemyType.TITAN);
          });
        });
      }
    });

    it('generateCombatWaves() for actIndex=2, row>=5 may include TITAN', () => {
      // Run many seeds until at least one produces TITAN in the heavy pool
      let foundTitan = false;
      for (let seed = 0; seed < 200; seed++) {
        const waves = service.generateCombatWaves(5, 2, seed * 31 + 3);
        for (const w of waves) {
          if (w.entries!.some(e => e.type === EnemyType.TITAN)) {
            foundTitan = true;
            break;
          }
        }
        if (foundTitan) break;
      }
      expect(foundTitan).withContext('TITAN should appear in act 3 row 5+ within 200 seeds').toBeTrue();
    });

    it('generateBossWaves() for actIndex=2 returns 8 waves', () => {
      const waves = service.generateBossWaves(2, 42);
      expect(waves.length).toBe(8);
    });

    it('generateBossWaves() act 3 final wave contains NOVA_SOVEREIGN with spawnInterval 0', () => {
      const waves = service.generateBossWaves(2, 42);
      const finalWave = waves[waves.length - 1];
      const sovereignEntry = finalWave.entries!.find(e => e.type === EnemyType.NOVA_SOVEREIGN);
      expect(sovereignEntry).withContext('final wave must have NOVA_SOVEREIGN entry').toBeDefined();
      expect(sovereignEntry!.spawnInterval).toBe(0);
    });

    it('generateBossWaves() act 3 has more waves than act 2', () => {
      const act2Waves = service.generateBossWaves(1, 42);
      const act3Waves = service.generateBossWaves(2, 42);
      expect(act3Waves.length).toBeGreaterThan(act2Waves.length);
    });
  });
});
