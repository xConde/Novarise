import { CAMPAIGN_WAVE_DEFINITIONS } from './campaign-waves';
import { CAMPAIGN_LEVELS } from '../campaign-levels';
import { EnemyType } from '../../../game/game-board/models/enemy.model';
import { WaveDefinition, getWaveEnemyCount, getWaveEnemyTypes } from '../../../game/game-board/models/wave.model';

/** Enemy types considered "intro-safe": only Basic, Fast, Heavy. */
const INTRO_SAFE_TYPES = new Set<EnemyType>([
  EnemyType.BASIC,
  EnemyType.FAST,
  EnemyType.HEAVY,
]);

/** Enemy types that qualify as "advanced" for the endgame tier check. */
const ADVANCED_TYPES = new Set<EnemyType>([
  EnemyType.BOSS,
  EnemyType.SHIELDED,
  EnemyType.SWARM,
  EnemyType.FLYING,
]);

describe('CAMPAIGN_WAVE_DEFINITIONS', () => {

  // ─── Coverage: all 16 levels have an entry ────────────────────────────────

  describe('completeness', () => {
    it('should have an entry for every level in CAMPAIGN_LEVELS', () => {
      for (const level of CAMPAIGN_LEVELS) {
        expect(CAMPAIGN_WAVE_DEFINITIONS[level.id])
          .withContext(`Missing entry for ${level.id} (${level.name})`)
          .toBeDefined();
      }
    });

    it('should have exactly 16 entries', () => {
      expect(Object.keys(CAMPAIGN_WAVE_DEFINITIONS).length).toBe(16);
    });
  });

  // ─── Wave count: matches CAMPAIGN_LEVELS.waveCount ───────────────────────

  describe('wave count integrity', () => {
    for (const level of CAMPAIGN_LEVELS) {
      it(`${level.id} — wave count should match level.waveCount (${level.waveCount})`, () => {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[level.id];
        expect(waves.length)
          .withContext(`${level.id} has ${waves?.length} waves but waveCount is ${level.waveCount}`)
          .toBe(level.waveCount);
      });
    }
  });

  // ─── Per-wave structural invariants ──────────────────────────────────────

  describe('wave structure', () => {
    for (const level of CAMPAIGN_LEVELS) {
      describe(level.id, () => {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[level.id] ?? [];

        it('each wave should have at least 1 enemy (entries or spawnTurns)', () => {
          for (let i = 0; i < waves.length; i++) {
            expect(getWaveEnemyCount(waves[i]))
              .withContext(`${level.id} wave ${i + 1} has no enemies (neither entries nor spawnTurns)`)
              .toBeGreaterThan(0);
          }
        });

        it('each wave should have a positive reward', () => {
          for (let i = 0; i < waves.length; i++) {
            expect(waves[i].reward)
              .withContext(`${level.id} wave ${i + 1} reward must be > 0`)
              .toBeGreaterThan(0);
          }
        });

        it('every enemy type in a wave should be a valid EnemyType', () => {
          const validTypes = Object.values(EnemyType) as string[];
          for (let i = 0; i < waves.length; i++) {
            for (const type of getWaveEnemyTypes(waves[i])) {
              expect(validTypes)
                .withContext(`${level.id} wave ${i + 1} has unknown type "${type}"`)
                .toContain(type);
            }
          }
        });

        it('every WaveEntry (legacy format) should have a positive enemy count', () => {
          for (let i = 0; i < waves.length; i++) {
            if (!waves[i].entries) continue; // spawnTurns format: count checking done in total enemy count test
            for (const entry of waves[i].entries!) {
              expect(entry.count)
                .withContext(`${level.id} wave ${i + 1} entry ${entry.type} has non-positive count`)
                .toBeGreaterThan(0);
            }
          }
        });

        it('every WaveEntry (legacy format) should have a non-negative spawnInterval', () => {
          for (let i = 0; i < waves.length; i++) {
            if (!waves[i].entries) continue; // spawnTurns format: no spawnInterval concept
            for (const entry of waves[i].entries!) {
              expect(entry.spawnInterval)
                .withContext(`${level.id} wave ${i + 1} entry ${entry.type} has negative spawnInterval`)
                .toBeGreaterThanOrEqual(0);
            }
          }
        });
      });
    }
  });

  // ─── Tier-specific constraints ────────────────────────────────────────────

  describe('tier constraints', () => {
    it('Intro maps (1-4) should use only BASIC, FAST, and HEAVY enemies', () => {
      const introIds = ['campaign_01', 'campaign_02', 'campaign_03', 'campaign_04'];
      for (const id of introIds) {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[id];
        for (let i = 0; i < waves.length; i++) {
          for (const type of getWaveEnemyTypes(waves[i])) {
            expect(INTRO_SAFE_TYPES.has(type))
              .withContext(`Intro map ${id} wave ${i + 1} uses advanced enemy type "${type}"`)
              .toBeTrue();
          }
        }
      }
    });

    it('Endgame maps (15-16) should include BOSS enemies', () => {
      const endgameIds = ['campaign_15', 'campaign_16'];
      for (const id of endgameIds) {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[id];
        const hasBoss = waves.some(w => getWaveEnemyTypes(w).has(EnemyType.BOSS));
        expect(hasBoss)
          .withContext(`Endgame map ${id} must have at least one BOSS wave`)
          .toBeTrue();
      }
    });

    it('Map 16 (Novarise) should have BOSS in wave 6 and wave 12', () => {
      const waves = CAMPAIGN_WAVE_DEFINITIONS['campaign_16'];
      expect(getWaveEnemyTypes(waves[5]).has(EnemyType.BOSS))
        .withContext('campaign_16 wave 6 should have a BOSS')
        .toBeTrue();
      expect(getWaveEnemyTypes(waves[11]).has(EnemyType.BOSS))
        .withContext('campaign_16 wave 12 should have a BOSS')
        .toBeTrue();
    });

    it('Map 15 (Storm) should have BOSS in wave 8 and wave 12', () => {
      const waves = CAMPAIGN_WAVE_DEFINITIONS['campaign_15'];
      expect(getWaveEnemyTypes(waves[7]).has(EnemyType.BOSS))
        .withContext('campaign_15 wave 8 should have a BOSS')
        .toBeTrue();
      expect(getWaveEnemyTypes(waves[11]).has(EnemyType.BOSS))
        .withContext('campaign_15 wave 12 should have a BOSS')
        .toBeTrue();
    });

    it('Maps 9-16 should use advanced enemy types (not just intro roster)', () => {
      const midToEndgameIds = [
        'campaign_09', 'campaign_10', 'campaign_11', 'campaign_12',
        'campaign_13', 'campaign_14', 'campaign_15', 'campaign_16'
      ];
      for (const id of midToEndgameIds) {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[id];
        const usesAdvanced = waves.some(w =>
          [...getWaveEnemyTypes(w)].some(t => ADVANCED_TYPES.has(t))
        );
        expect(usesAdvanced)
          .withContext(`Mid/Late/Endgame map ${id} should use advanced enemy types`)
          .toBeTrue();
      }
    });
  });

  // ─── Difficulty ramp: later waves harder ─────────────────────────────────

  describe('difficulty ramp', () => {
    it('the final wave should have a higher reward than the first wave for every level', () => {
      for (const level of CAMPAIGN_LEVELS) {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[level.id];
        const firstReward = waves[0].reward;
        const lastReward = waves[waves.length - 1].reward;
        expect(lastReward)
          .withContext(`${level.id} final wave reward (${lastReward}) should exceed first wave reward (${firstReward})`)
          .toBeGreaterThan(firstReward);
      }
    });

    it('total enemy count in the final wave should meet or exceed the first wave for every level', () => {
      for (const level of CAMPAIGN_LEVELS) {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[level.id];
        const firstCount = getWaveEnemyCount(waves[0]);
        const lastCount = getWaveEnemyCount(waves[waves.length - 1]);
        expect(lastCount)
          .withContext(`${level.id} final wave count (${lastCount}) should be >= first wave count (${firstCount})`)
          .toBeGreaterThanOrEqual(firstCount);
      }
    });
  });

  // ─── spawnTurns migration: shape + count verification ─────────────────────

  describe('spawnTurns migrated maps', () => {

    /**
     * Expected total enemy counts per wave for each migrated map.
     * These guard against accidental difficulty changes during migration.
     */
    const CAMPAIGN_02_EXPECTED_COUNTS = [4, 6, 8, 8, 9, 8, 12];
    const CAMPAIGN_06_EXPECTED_COUNTS = [8, 10, 10, 10, 9, 10, 10, 15, 17];
    const CAMPAIGN_10_EXPECTED_COUNTS = [10, 10, 10, 13, 11, 17, 16, 17, 21, 21];
    const CAMPAIGN_15_EXPECTED_COUNTS = [14, 14, 18, 22, 21, 18, 32, 18, 32, 29, 39, 34];

    describe('campaign_02 (intro — The Bend)', () => {
      const waves = CAMPAIGN_WAVE_DEFINITIONS['campaign_02'];

      it('all waves use spawnTurns format', () => {
        for (let i = 0; i < waves.length; i++) {
          expect(waves[i].spawnTurns)
            .withContext(`campaign_02 wave ${i + 1} should use spawnTurns`)
            .toBeDefined();
        }
      });

      it('total enemy count per wave matches expected (no difficulty drift)', () => {
        for (let i = 0; i < waves.length; i++) {
          expect(getWaveEnemyCount(waves[i]))
            .withContext(`campaign_02 wave ${i + 1}: expected ${CAMPAIGN_02_EXPECTED_COUNTS[i]}`)
            .toBe(CAMPAIGN_02_EXPECTED_COUNTS[i]);
        }
      });

      it('has at least one empty prep turn (wave 6 pause before second burst)', () => {
        const hasEmptyTurn = waves.some(w => w.spawnTurns?.some(turn => turn.length === 0));
        expect(hasEmptyTurn).withContext('campaign_02 should have at least one empty prep turn').toBeTrue();
      });

      it('has at least one burst turn (3+ enemies in a single turn)', () => {
        const hasBurst = waves.some(w => w.spawnTurns?.some(turn => turn.length >= 3));
        expect(hasBurst).withContext('campaign_02 should have at least one burst turn (3+ enemies)').toBeTrue();
      });
    });

    describe('campaign_06 (early-mid — Open Ground)', () => {
      const waves = CAMPAIGN_WAVE_DEFINITIONS['campaign_06'];

      it('all waves use spawnTurns format', () => {
        for (let i = 0; i < waves.length; i++) {
          expect(waves[i].spawnTurns)
            .withContext(`campaign_06 wave ${i + 1} should use spawnTurns`)
            .toBeDefined();
        }
      });

      it('total enemy count per wave matches expected (no difficulty drift)', () => {
        for (let i = 0; i < waves.length; i++) {
          expect(getWaveEnemyCount(waves[i]))
            .withContext(`campaign_06 wave ${i + 1}: expected ${CAMPAIGN_06_EXPECTED_COUNTS[i]}`)
            .toBe(CAMPAIGN_06_EXPECTED_COUNTS[i]);
        }
      });

      it('has at least one empty prep turn (telegraphs Heavy tank arrivals)', () => {
        const hasEmptyTurn = waves.some(w => w.spawnTurns?.some(turn => turn.length === 0));
        expect(hasEmptyTurn).withContext('campaign_06 should have at least one empty prep turn').toBeTrue();
      });

      it('has at least one burst turn (3+ enemies: finale 8-enemy climax)', () => {
        const hasBurst = waves.some(w => w.spawnTurns?.some(turn => turn.length >= 3));
        expect(hasBurst).withContext('campaign_06 should have at least one burst turn').toBeTrue();
      });
    });

    describe('campaign_10 (mid — The Spiral)', () => {
      const waves = CAMPAIGN_WAVE_DEFINITIONS['campaign_10'];

      it('all waves use spawnTurns format', () => {
        for (let i = 0; i < waves.length; i++) {
          expect(waves[i].spawnTurns)
            .withContext(`campaign_10 wave ${i + 1} should use spawnTurns`)
            .toBeDefined();
        }
      });

      it('total enemy count per wave matches expected (no difficulty drift)', () => {
        for (let i = 0; i < waves.length; i++) {
          expect(getWaveEnemyCount(waves[i]))
            .withContext(`campaign_10 wave ${i + 1}: expected ${CAMPAIGN_10_EXPECTED_COUNTS[i]}`)
            .toBe(CAMPAIGN_10_EXPECTED_COUNTS[i]);
        }
      });

      it('wave 10 (boss finale) starts with an empty prep turn before BOSS spawns', () => {
        const wave10Turns = waves[9].spawnTurns!;
        expect(wave10Turns[0].length).withContext('campaign_10 wave 10 turn 0 should be an empty prep turn').toBe(0);
      });

      it('wave 10 BOSS spawns alone on turn 1 (telegraphed arrival)', () => {
        const wave10Turns = waves[9].spawnTurns!;
        expect(wave10Turns[1]).toEqual([EnemyType.BOSS]);
      });

      it('has at least one burst turn (3+ enemies: swarm bursts throughout)', () => {
        const hasBurst = waves.some(w => w.spawnTurns?.some(turn => turn.length >= 3));
        expect(hasBurst).withContext('campaign_10 should have at least one burst turn').toBeTrue();
      });
    });

    describe('campaign_15 (endgame — Storm)', () => {
      const waves = CAMPAIGN_WAVE_DEFINITIONS['campaign_15'];

      it('all waves use spawnTurns format', () => {
        for (let i = 0; i < waves.length; i++) {
          expect(waves[i].spawnTurns)
            .withContext(`campaign_15 wave ${i + 1} should use spawnTurns`)
            .toBeDefined();
        }
      });

      it('total enemy count per wave matches expected (no difficulty drift)', () => {
        for (let i = 0; i < waves.length; i++) {
          expect(getWaveEnemyCount(waves[i]))
            .withContext(`campaign_15 wave ${i + 1}: expected ${CAMPAIGN_15_EXPECTED_COUNTS[i]}`)
            .toBe(CAMPAIGN_15_EXPECTED_COUNTS[i]);
        }
      });

      it('wave 8 (first Boss) has two empty prep turns before BOSS spawns', () => {
        const wave8Turns = waves[7].spawnTurns!;
        expect(wave8Turns[0].length).withContext('campaign_15 wave 8 turn 0 should be empty prep').toBe(0);
        expect(wave8Turns[1].length).withContext('campaign_15 wave 8 turn 1 should be empty prep').toBe(0);
        expect(getWaveEnemyTypes(waves[7]).has(EnemyType.BOSS)).toBeTrue();
      });

      it('wave 12 (storm finale) has alternating Boss spawns with empty preps between them', () => {
        const wave12Turns = waves[11].spawnTurns!;
        expect(wave12Turns[0].length).withContext('campaign_15 wave 12 turn 0 should be empty prep').toBe(0);
        expect(getWaveEnemyTypes(waves[11]).has(EnemyType.BOSS)).toBeTrue();
        // Two bosses total
        const bossCount = wave12Turns.flat().filter(t => t === EnemyType.BOSS).length;
        expect(bossCount).withContext('campaign_15 wave 12 should have exactly 2 BOSSes').toBe(2);
      });

      it('has at least one burst turn (8+ enemies: pre-boss maximum chaos)', () => {
        const hasBurst = waves.some(w => w.spawnTurns?.some(turn => turn.length >= 8));
        expect(hasBurst).withContext('campaign_15 should have at least one 8+ enemy burst turn').toBeTrue();
      });
    });

    it('at least 2 of the 4 migrated maps have at least one empty prep turn', () => {
      const mapsWithPrepTurn = ['campaign_02', 'campaign_06', 'campaign_10', 'campaign_15'].filter(id => {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[id];
        return waves.some(w => w.spawnTurns?.some(turn => turn.length === 0));
      });
      expect(mapsWithPrepTurn.length)
        .withContext(`Only ${mapsWithPrepTurn.length} of 4 migrated maps have empty prep turns`)
        .toBeGreaterThanOrEqual(2);
    });

    it('at least 2 of the 4 migrated maps have at least one burst turn (3+ enemies)', () => {
      const mapsWithBurst = ['campaign_02', 'campaign_06', 'campaign_10', 'campaign_15'].filter(id => {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[id];
        return waves.some(w => w.spawnTurns?.some(turn => turn.length >= 3));
      });
      expect(mapsWithBurst.length)
        .withContext(`Only ${mapsWithBurst.length} of 4 migrated maps have burst turns`)
        .toBeGreaterThanOrEqual(2);
    });
  });

});
