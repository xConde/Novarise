import { ACT1_BOSS_PRESETS, ACT2_BOSS_PRESETS, BossPreset } from './boss-presets';
import { EnemyType } from '../../game/game-board/models/enemy.model';

describe('Boss Presets', () => {

  // ── Shared helpers ─────────────────────────────────────────────────

  function finalWaveHasBoss(preset: BossPreset): boolean {
    const finalWave = preset.waves[preset.waves.length - 1];
    return finalWave.entries!.some(e => e.type === EnemyType.BOSS && e.count >= 1);
  }

  function allWavesHavePositiveReward(preset: BossPreset): boolean {
    return preset.waves.every(w => w.reward > 0);
  }

  function allWavesHaveEntries(preset: BossPreset): boolean {
    return preset.waves.every(w => (w.entries?.length ?? 0) > 0);
  }

  function allEntriesHavePositiveCount(preset: BossPreset): boolean {
    return preset.waves.every(w => w.entries!.every(e => e.count > 0));
  }

  // ── ACT1 presets ───────────────────────────────────────────────────

  describe('ACT1_BOSS_PRESETS', () => {
    it('should define exactly 3 presets', () => {
      expect(ACT1_BOSS_PRESETS.length).toBe(3);
    });

    it('each preset should have 6 waves', () => {
      for (const preset of ACT1_BOSS_PRESETS) {
        expect(preset.waves.length).withContext(`preset "${preset.id}" wave count`).toBe(6);
      }
    });

    it('each preset final wave must include a BOSS entry', () => {
      for (const preset of ACT1_BOSS_PRESETS) {
        expect(finalWaveHasBoss(preset))
          .withContext(`preset "${preset.id}" final wave must have BOSS entry`)
          .toBeTrue();
      }
    });

    it('all waves must have positive gold rewards', () => {
      for (const preset of ACT1_BOSS_PRESETS) {
        expect(allWavesHavePositiveReward(preset))
          .withContext(`preset "${preset.id}" rewards`)
          .toBeTrue();
      }
    });

    it('all waves must have at least one entry', () => {
      for (const preset of ACT1_BOSS_PRESETS) {
        expect(allWavesHaveEntries(preset))
          .withContext(`preset "${preset.id}" entries`)
          .toBeTrue();
      }
    });

    it('all wave entries must have a positive count', () => {
      for (const preset of ACT1_BOSS_PRESETS) {
        expect(allEntriesHavePositiveCount(preset))
          .withContext(`preset "${preset.id}" entry counts`)
          .toBeTrue();
      }
    });

    it('each preset must have a unique id', () => {
      const ids = ACT1_BOSS_PRESETS.map(p => p.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('each preset must have a non-empty name and description', () => {
      for (const preset of ACT1_BOSS_PRESETS) {
        expect(preset.name.length).withContext(`preset "${preset.id}" name`).toBeGreaterThan(0);
        expect(preset.description.length).withContext(`preset "${preset.id}" description`).toBeGreaterThan(0);
      }
    });

    it('siege_commander preset should use HEAVY and SHIELDED enemies (non-final waves)', () => {
      const preset = ACT1_BOSS_PRESETS.find(p => p.id === 'siege_commander')!;
      const nonFinalWaves = preset.waves.slice(0, -1);
      const types = new Set(nonFinalWaves.flatMap(w => w.entries!.map(e => e.type)));
      expect(types.has(EnemyType.HEAVY)).toBeTrue();
      expect(types.has(EnemyType.SHIELDED)).toBeTrue();
    });

    it('swarm_queen preset should use SWARM enemies (non-final waves)', () => {
      const preset = ACT1_BOSS_PRESETS.find(p => p.id === 'swarm_queen')!;
      const nonFinalWaves = preset.waves.slice(0, -1);
      const types = new Set(nonFinalWaves.flatMap(w => w.entries!.map(e => e.type)));
      expect(types.has(EnemyType.SWARM)).toBeTrue();
    });

    it('sky_marshal preset should use FLYING enemies (non-final waves)', () => {
      const preset = ACT1_BOSS_PRESETS.find(p => p.id === 'sky_marshal')!;
      const nonFinalWaves = preset.waves.slice(0, -1);
      const types = new Set(nonFinalWaves.flatMap(w => w.entries!.map(e => e.type)));
      expect(types.has(EnemyType.FLYING)).toBeTrue();
    });

    it('act 1 final wave should have exactly 1 BOSS and spawnInterval 0', () => {
      for (const preset of ACT1_BOSS_PRESETS) {
        const finalWave = preset.waves[preset.waves.length - 1];
        const bossEntry = finalWave.entries!.find(e => e.type === EnemyType.BOSS);
        expect(bossEntry).withContext(`${preset.id} boss entry`).toBeDefined();
        expect(bossEntry!.spawnInterval).withContext(`${preset.id} boss spawnInterval`).toBe(0);
      }
    });
  });

  // ── ACT2 presets ───────────────────────────────────────────────────

  describe('ACT2_BOSS_PRESETS', () => {
    it('should define exactly 3 presets', () => {
      expect(ACT2_BOSS_PRESETS.length).toBe(3);
    });

    it('each preset should have 7 waves', () => {
      for (const preset of ACT2_BOSS_PRESETS) {
        expect(preset.waves.length).withContext(`preset "${preset.id}" wave count`).toBe(7);
      }
    });

    it('each preset final wave must include a BOSS entry', () => {
      for (const preset of ACT2_BOSS_PRESETS) {
        expect(finalWaveHasBoss(preset))
          .withContext(`preset "${preset.id}" final wave must have BOSS entry`)
          .toBeTrue();
      }
    });

    it('all waves must have positive gold rewards', () => {
      for (const preset of ACT2_BOSS_PRESETS) {
        expect(allWavesHavePositiveReward(preset))
          .withContext(`preset "${preset.id}" rewards`)
          .toBeTrue();
      }
    });

    it('all waves must have at least one entry', () => {
      for (const preset of ACT2_BOSS_PRESETS) {
        expect(allWavesHaveEntries(preset))
          .withContext(`preset "${preset.id}" entries`)
          .toBeTrue();
      }
    });

    it('each preset must have a unique id', () => {
      const ids = ACT2_BOSS_PRESETS.map(p => p.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('act 2 final wave must have at least 1 BOSS', () => {
      for (const preset of ACT2_BOSS_PRESETS) {
        const finalWave = preset.waves[preset.waves.length - 1];
        const bossCount = finalWave.entries!
          .filter(e => e.type === EnemyType.BOSS)
          .reduce((sum, e) => sum + e.count, 0);
        expect(bossCount).withContext(`${preset.id} boss count`).toBeGreaterThanOrEqual(1);
      }
    });

    it('act 2 presets should have higher total enemy counts than act 1 presets', () => {
      const countAllEnemies = (presets: BossPreset[]) =>
        presets.reduce((total, p) =>
          total + p.waves.slice(0, -1).reduce((wt, w) =>
            wt + w.entries!.reduce((et, e) => et + e.count, 0), 0), 0);

      const act1Total = countAllEnemies(ACT1_BOSS_PRESETS);
      const act2Total = countAllEnemies(ACT2_BOSS_PRESETS);
      expect(act2Total).toBeGreaterThan(act1Total);
    });

    it('dark_nexus preset should use all major enemy types across its waves', () => {
      const preset = ACT2_BOSS_PRESETS.find(p => p.id === 'dark_nexus')!;
      const allTypes = new Set(preset.waves.flatMap(w => w.entries!.map(e => e.type)));
      expect(allTypes.has(EnemyType.HEAVY)).toBeTrue();
      expect(allTypes.has(EnemyType.SHIELDED)).toBeTrue();
      expect(allTypes.has(EnemyType.FLYING)).toBeTrue();
      expect(allTypes.has(EnemyType.SWARM)).toBeTrue();
    });
  });

  // ── Cross-array uniqueness ─────────────────────────────────────────

  it('no id should be shared between act 1 and act 2 presets', () => {
    const act1Ids = new Set(ACT1_BOSS_PRESETS.map(p => p.id));
    const act2Ids = ACT2_BOSS_PRESETS.map(p => p.id);
    for (const id of act2Ids) {
      expect(act1Ids.has(id)).withContext(`duplicate id "${id}"`).toBeFalse();
    }
  });
});
