import { EnemyType } from './enemy.model';
import {
  EndlessWaveTemplate,
  ENDLESS_BOSS_INTERVAL,
  ENDLESS_MAX_SPEED_MULTIPLIER,
  ENDLESS_BASE_ENEMY_COUNT,
  ENDLESS_COUNT_SCALE_PER_WAVE,
  ENDLESS_MIN_ENEMIES_PER_ENTRY,
  ENDLESS_WAVE_TEMPLATES,
  NON_BOSS_TEMPLATES,
  generateEndlessWave,
  selectEndlessTemplate,
} from './endless-wave.model';

/** All valid EnemyType values — used to validate generated entries. */
const VALID_ENEMY_TYPES = new Set<string>(Object.values(EnemyType));

describe('endless-wave.model', () => {

  // ---------------------------------------------------------------------------
  // selectEndlessTemplate
  // ---------------------------------------------------------------------------

  describe('selectEndlessTemplate', () => {
    it('returns BOSS on every 5th endless wave', () => {
      for (let n = ENDLESS_BOSS_INTERVAL; n <= 30; n += ENDLESS_BOSS_INTERVAL) {
        expect(selectEndlessTemplate(n))
          .withContext(`wave ${n}`)
          .toBe(EndlessWaveTemplate.BOSS);
      }
    });

    it('never returns BOSS on non-milestone waves', () => {
      for (let n = 1; n <= 30; n++) {
        if (n % ENDLESS_BOSS_INTERVAL !== 0) {
          expect(selectEndlessTemplate(n))
            .withContext(`wave ${n}`)
            .not.toBe(EndlessWaveTemplate.BOSS);
        }
      }
    });

    it('is deterministic from wave number — uses (waveNumber - 1) % cycle', () => {
      // Verify the exact cycle mapping: index = (waveNumber - 1) % NON_BOSS_TEMPLATES.length
      for (let n = 1; n <= 20; n++) {
        if (n % ENDLESS_BOSS_INTERVAL !== 0) {
          const expectedIdx = (n - 1) % NON_BOSS_TEMPLATES.length;
          expect(selectEndlessTemplate(n))
            .withContext(`wave ${n}`)
            .toBe(NON_BOSS_TEMPLATES[expectedIdx]);
        }
      }
    });

    it('is purely deterministic — same input always yields same output', () => {
      for (let n = 1; n <= 50; n++) {
        expect(selectEndlessTemplate(n)).toBe(selectEndlessTemplate(n));
      }
    });
  });

  // ---------------------------------------------------------------------------
  // generateEndlessWave — basic structure
  // ---------------------------------------------------------------------------

  describe('generateEndlessWave', () => {
    it('returns a non-empty entries array for waves 1–100', () => {
      for (let n = 1; n <= 100; n++) {
        const result = generateEndlessWave(n);
        expect(result.entries.length)
          .withContext(`wave ${n} entries length`)
          .toBeGreaterThan(0);
      }
    });

    it('all enemy types in entries are valid EnemyType values', () => {
      for (let n = 1; n <= 100; n++) {
        const result = generateEndlessWave(n);
        for (const entry of result.entries) {
          expect(VALID_ENEMY_TYPES.has(entry.type))
            .withContext(`wave ${n} invalid type: ${entry.type}`)
            .toBeTrue();
        }
      }
    });

    it('all entry counts are at least ENDLESS_MIN_ENEMIES_PER_ENTRY', () => {
      for (let n = 1; n <= 100; n++) {
        const result = generateEndlessWave(n);
        for (const entry of result.entries) {
          expect(entry.count)
            .withContext(`wave ${n} entry count`)
            .toBeGreaterThanOrEqual(ENDLESS_MIN_ENEMIES_PER_ENTRY);
        }
      }
    });

    it('all spawn intervals are positive', () => {
      for (let n = 1; n <= 50; n++) {
        const result = generateEndlessWave(n);
        for (const entry of result.entries) {
          expect(entry.spawnInterval)
            .withContext(`wave ${n} spawnInterval`)
            .toBeGreaterThan(0);
        }
      }
    });

    it('reward increases with wave number', () => {
      const reward1 = generateEndlessWave(1).reward;
      const reward10 = generateEndlessWave(10).reward;
      const reward50 = generateEndlessWave(50).reward;
      expect(reward10).toBeGreaterThan(reward1);
      expect(reward50).toBeGreaterThan(reward10);
    });

    it('is purely deterministic — same input always yields same output', () => {
      for (const n of [1, 5, 10, 15, 25, 50, 100]) {
        const a = generateEndlessWave(n);
        const b = generateEndlessWave(n);
        expect(a.template).withContext(`wave ${n} template`).toBe(b.template);
        expect(a.healthMultiplier).withContext(`wave ${n} healthMult`).toBe(b.healthMultiplier);
        expect(a.entries.length).withContext(`wave ${n} entries length`).toBe(b.entries.length);
        for (let i = 0; i < a.entries.length; i++) {
          expect(a.entries[i].type).toBe(b.entries[i].type);
          expect(a.entries[i].count).toBe(b.entries[i].count);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // generateEndlessWave — BOSS / milestone waves
  // ---------------------------------------------------------------------------

  describe('milestone waves (every 5th)', () => {
    it('uses BOSS template on every 5th endless wave', () => {
      for (let n = ENDLESS_BOSS_INTERVAL; n <= 30; n += ENDLESS_BOSS_INTERVAL) {
        expect(generateEndlessWave(n).template)
          .withContext(`wave ${n}`)
          .toBe(EndlessWaveTemplate.BOSS);
      }
    });

    it('sets isMilestone true on every 5th endless wave', () => {
      for (let n = ENDLESS_BOSS_INTERVAL; n <= 30; n += ENDLESS_BOSS_INTERVAL) {
        expect(generateEndlessWave(n).isMilestone)
          .withContext(`wave ${n}`)
          .toBeTrue();
      }
    });

    it('sets isMilestone false on non-milestone waves', () => {
      for (let n = 1; n <= 20; n++) {
        if (n % ENDLESS_BOSS_INTERVAL !== 0) {
          expect(generateEndlessWave(n).isMilestone)
            .withContext(`wave ${n}`)
            .toBeFalse();
        }
      }
    });

    it('milestone reward is higher than non-milestone reward at the same wave range', () => {
      // Wave 5 (milestone) vs wave 4 (non-milestone, same tier)
      const milestone = generateEndlessWave(5);
      const nonMilestone = generateEndlessWave(4);
      expect(milestone.reward).toBeGreaterThan(nonMilestone.reward);
    });
  });

  // ---------------------------------------------------------------------------
  // generateEndlessWave — scaling properties
  // ---------------------------------------------------------------------------

  describe('health multiplier scaling', () => {
    it('starts at 1.2 for wave 1 (base + 1 * scale)', () => {
      // healthMultiplier = 1.0 + waveNumber * 0.2
      expect(generateEndlessWave(1).healthMultiplier).toBeCloseTo(1.2);
    });

    it('increases with wave number', () => {
      const h1 = generateEndlessWave(1).healthMultiplier;
      const h5 = generateEndlessWave(5).healthMultiplier;
      const h20 = generateEndlessWave(20).healthMultiplier;
      expect(h5).toBeGreaterThan(h1);
      expect(h20).toBeGreaterThan(h5);
    });
  });

  describe('speed multiplier scaling', () => {
    it('increases with wave number', () => {
      const s1 = generateEndlessWave(1).speedMultiplier;
      const s10 = generateEndlessWave(10).speedMultiplier;
      expect(s10).toBeGreaterThan(s1);
    });

    it('never exceeds ENDLESS_MAX_SPEED_MULTIPLIER', () => {
      for (const n of [1, 10, 25, 50, 100]) {
        expect(generateEndlessWave(n).speedMultiplier)
          .withContext(`wave ${n}`)
          .toBeLessThanOrEqual(ENDLESS_MAX_SPEED_MULTIPLIER);
      }
    });

    it('caps at ENDLESS_MAX_SPEED_MULTIPLIER at high wave numbers', () => {
      // At wave 100 the raw formula far exceeds the cap
      expect(generateEndlessWave(100).speedMultiplier).toBe(ENDLESS_MAX_SPEED_MULTIPLIER);
    });
  });

  describe('enemy count scaling', () => {
    it('total enemies increase with wave number', () => {
      const totalEnemies = (n: number) =>
        generateEndlessWave(n).entries.reduce((s, e) => s + e.count, 0);

      expect(totalEnemies(10)).toBeGreaterThan(totalEnemies(1));
      expect(totalEnemies(50)).toBeGreaterThan(totalEnemies(10));
    });

    it('total enemies at wave 1 equals expected baseline', () => {
      // totalEnemies = ENDLESS_BASE_ENEMY_COUNT + floor(1 * ENDLESS_COUNT_SCALE_PER_WAVE)
      const expectedMin =
        ENDLESS_BASE_ENEMY_COUNT +
        Math.floor(ENDLESS_COUNT_SCALE_PER_WAVE);
      // Each entry is at least ENDLESS_MIN_ENEMIES_PER_ENTRY, so total >= expected
      const result = generateEndlessWave(1);
      const total = result.entries.reduce((s, e) => s + e.count, 0);
      expect(total).toBeGreaterThanOrEqual(expectedMin);
    });

    it('enemy counts stay reasonable (< 500 per entry) even at wave 100', () => {
      const result = generateEndlessWave(100);
      for (const entry of result.entries) {
        expect(entry.count)
          .withContext(`wave 100 entry count for ${entry.type}`)
          .toBeLessThan(500);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // generateEndlessWave — template cycling
  // ---------------------------------------------------------------------------

  describe('template cycling', () => {
    it('returns multiple distinct templates across waves 1-12', () => {
      // Over 12 waves we should see more than one non-boss template
      const templates = new Set<EndlessWaveTemplate>();
      for (let n = 1; n <= 12; n++) {
        if (n % ENDLESS_BOSS_INTERVAL !== 0) {
          templates.add(generateEndlessWave(n).template);
        }
      }
      expect(templates.size).toBeGreaterThan(1);
    });

    it('wave N and wave N + NON_BOSS_TEMPLATES.length have the same template when no milestone falls between', () => {
      // Find a non-milestone wave whose counterpart (n + cycle length) is also non-milestone
      const cycle = NON_BOSS_TEMPLATES.length;
      let found = false;
      for (let n = 1; n <= 30; n++) {
        if (n % ENDLESS_BOSS_INTERVAL !== 0 && (n + cycle) % ENDLESS_BOSS_INTERVAL !== 0) {
          expect(generateEndlessWave(n).template)
            .withContext(`wave ${n} vs wave ${n + cycle}`)
            .toBe(generateEndlessWave(n + cycle).template);
          found = true;
          break;
        }
      }
      expect(found).toBeTrue();
    });

    it('template is deterministic for the same wave number', () => {
      for (const n of [1, 2, 3, 5, 10, 20]) {
        expect(generateEndlessWave(n).template).toBe(generateEndlessWave(n).template);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // ENDLESS_WAVE_TEMPLATES completeness
  // ---------------------------------------------------------------------------

  describe('ENDLESS_WAVE_TEMPLATES config', () => {
    it('has a config for every EndlessWaveTemplate value', () => {
      for (const template of Object.values(EndlessWaveTemplate)) {
        expect(ENDLESS_WAVE_TEMPLATES[template])
          .withContext(`missing config for ${template}`)
          .toBeTruthy();
      }
    });

    it('every config has at least one enemy entry', () => {
      for (const [name, config] of Object.entries(ENDLESS_WAVE_TEMPLATES)) {
        expect(config.entries.length)
          .withContext(`${name} entries`)
          .toBeGreaterThan(0);
      }
    });

    it('all enemy types in template configs are valid EnemyType values', () => {
      for (const [name, config] of Object.entries(ENDLESS_WAVE_TEMPLATES)) {
        for (const entry of config.entries) {
          expect(VALID_ENEMY_TYPES.has(entry.type))
            .withContext(`${name}: invalid type ${entry.type}`)
            .toBeTrue();
        }
      }
    });

    it('all weights are positive', () => {
      for (const [name, config] of Object.entries(ENDLESS_WAVE_TEMPLATES)) {
        for (const entry of config.entries) {
          expect(entry.weight)
            .withContext(`${name}: weight for ${entry.type}`)
            .toBeGreaterThan(0);
        }
      }
    });

    it('spawn interval multipliers are positive', () => {
      for (const [name, config] of Object.entries(ENDLESS_WAVE_TEMPLATES)) {
        expect(config.spawnIntervalMultiplier)
          .withContext(name)
          .toBeGreaterThan(0);
      }
    });

    it('bonus rewards are non-negative', () => {
      for (const [name, config] of Object.entries(ENDLESS_WAVE_TEMPLATES)) {
        expect(config.bonusReward)
          .withContext(name)
          .toBeGreaterThanOrEqual(0);
      }
    });

    it('descriptions are non-empty strings', () => {
      for (const [name, config] of Object.entries(ENDLESS_WAVE_TEMPLATES)) {
        expect(config.description.length)
          .withContext(`${name} description`)
          .toBeGreaterThan(0);
      }
    });
  });
});
