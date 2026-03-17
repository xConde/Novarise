import { CAMPAIGN_WAVE_DEFINITIONS } from './campaign-waves';
import { CAMPAIGN_LEVELS } from '../models/campaign.model';
import { EnemyType } from '../../game/game-board/models/enemy.model';

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

        it('each wave should have at least 1 entry', () => {
          for (let i = 0; i < waves.length; i++) {
            expect(waves[i].entries.length)
              .withContext(`${level.id} wave ${i + 1} has no entries`)
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

        it('every WaveEntry should have a valid EnemyType', () => {
          const validTypes = Object.values(EnemyType) as string[];
          for (let i = 0; i < waves.length; i++) {
            for (const entry of waves[i].entries) {
              expect(validTypes)
                .withContext(`${level.id} wave ${i + 1} has unknown type "${entry.type}"`)
                .toContain(entry.type);
            }
          }
        });

        it('every WaveEntry should have a positive enemy count', () => {
          for (let i = 0; i < waves.length; i++) {
            for (const entry of waves[i].entries) {
              expect(entry.count)
                .withContext(`${level.id} wave ${i + 1} entry ${entry.type} has non-positive count`)
                .toBeGreaterThan(0);
            }
          }
        });

        it('every WaveEntry should have a non-negative spawnInterval', () => {
          for (let i = 0; i < waves.length; i++) {
            for (const entry of waves[i].entries) {
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
          for (const entry of waves[i].entries) {
            expect(INTRO_SAFE_TYPES.has(entry.type))
              .withContext(`Intro map ${id} wave ${i + 1} uses advanced enemy type "${entry.type}"`)
              .toBeTrue();
          }
        }
      }
    });

    it('Endgame maps (15-16) should include BOSS enemies', () => {
      const endgameIds = ['campaign_15', 'campaign_16'];
      for (const id of endgameIds) {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[id];
        const hasBoss = waves.some(w => w.entries.some(e => e.type === EnemyType.BOSS));
        expect(hasBoss)
          .withContext(`Endgame map ${id} must have at least one BOSS wave`)
          .toBeTrue();
      }
    });

    it('Map 16 (Novarise) should have BOSS in wave 6 and wave 12', () => {
      const waves = CAMPAIGN_WAVE_DEFINITIONS['campaign_16'];
      expect(waves[5].entries.some(e => e.type === EnemyType.BOSS))
        .withContext('campaign_16 wave 6 should have a BOSS')
        .toBeTrue();
      expect(waves[11].entries.some(e => e.type === EnemyType.BOSS))
        .withContext('campaign_16 wave 12 should have a BOSS')
        .toBeTrue();
    });

    it('Map 15 (Storm) should have BOSS in wave 8 and wave 12', () => {
      const waves = CAMPAIGN_WAVE_DEFINITIONS['campaign_15'];
      expect(waves[7].entries.some(e => e.type === EnemyType.BOSS))
        .withContext('campaign_15 wave 8 should have a BOSS')
        .toBeTrue();
      expect(waves[11].entries.some(e => e.type === EnemyType.BOSS))
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
          w.entries.some(e => ADVANCED_TYPES.has(e.type))
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
        const firstCount = waves[0].entries.reduce((s, e) => s + e.count, 0);
        const lastCount = waves[waves.length - 1].entries.reduce((s, e) => s + e.count, 0);
        expect(lastCount)
          .withContext(`${level.id} final wave count (${lastCount}) should be >= first wave count (${firstCount})`)
          .toBeGreaterThanOrEqual(firstCount);
      }
    });
  });

});
