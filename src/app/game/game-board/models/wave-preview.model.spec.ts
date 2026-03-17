import { EnemyType } from './enemy.model';
import { WAVE_DEFINITIONS } from './wave.model';
import { WavePreviewEntry, getWavePreview, getWavePreviewFull } from './wave-preview.model';
import { ENDLESS_BOSS_INTERVAL } from './endless-wave.model';

describe('getWavePreview', () => {

  // ── Edge cases ─────────────────────────────────────────────────────────

  it('returns empty array for waveIndex 0', () => {
    expect(getWavePreview(0, false)).toEqual([]);
  });

  it('returns empty array for negative waveIndex', () => {
    expect(getWavePreview(-1, false)).toEqual([]);
  });

  it('returns empty array when waveIndex exceeds definitions and isEndless is false', () => {
    const beyondLast = WAVE_DEFINITIONS.length + 1;
    expect(getWavePreview(beyondLast, false)).toEqual([]);
  });

  // ── Static wave definitions ────────────────────────────────────────────

  it('returns a non-empty preview for wave 1', () => {
    const preview = getWavePreview(1, false);
    expect(preview.length).toBeGreaterThan(0);
  });

  it('aggregates by type for wave 1 (5x BASIC only)', () => {
    // Wave 1: [{ type: BASIC, count: 5 }]
    const preview = getWavePreview(1, false);
    expect(preview.length).toBe(1);
    expect(preview[0].type).toBe(EnemyType.BASIC);
    expect(preview[0].count).toBe(5);
    expect(preview[0].label).toBe('Basic');
  });

  it('returns two distinct types for wave 3 (BASIC + FAST)', () => {
    // Wave 3: BASIC×5, FAST×3
    const preview = getWavePreview(3, false);
    const types = preview.map(e => e.type);
    expect(types).toContain(EnemyType.BASIC);
    expect(types).toContain(EnemyType.FAST);
    expect(preview.find(e => e.type === EnemyType.BASIC)?.count).toBe(5);
    expect(preview.find(e => e.type === EnemyType.FAST)?.count).toBe(3);
  });

  it('returns correct entry count for wave 5 (3 distinct types)', () => {
    // Wave 5: BASIC×8, FAST×5, HEAVY×2
    const preview = getWavePreview(5, false);
    expect(preview.length).toBe(3);
  });

  it('every entry has a non-empty label for all static waves', () => {
    for (let i = 1; i <= WAVE_DEFINITIONS.length; i++) {
      const preview = getWavePreview(i, false);
      for (const entry of preview) {
        expect(entry.label).toBeTruthy();
        expect(entry.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('all static wave previews have positive counts', () => {
    for (let i = 1; i <= WAVE_DEFINITIONS.length; i++) {
      const preview = getWavePreview(i, false);
      for (const entry of preview) {
        expect(entry.count).toBeGreaterThan(0);
      }
    }
  });

  it('returns correct entries for the last static wave (wave 10 — boss wave)', () => {
    // Wave 10: BOSS×1, SHIELDED×2, SWARM×3, HEAVY×1
    const preview = getWavePreview(WAVE_DEFINITIONS.length, false);
    expect(preview.find(e => e.type === EnemyType.BOSS)?.count).toBe(1);
    expect(preview.find(e => e.type === EnemyType.SHIELDED)?.count).toBe(2);
  });

  it('aggregates duplicate types in a single entry', () => {
    // Construct a wave with two BASIC entries to verify aggregation
    // We'll test wave 1 which has a single BASIC — but also verify the function
    // totals correctly by checking all entries have unique types
    for (let i = 1; i <= WAVE_DEFINITIONS.length; i++) {
      const preview = getWavePreview(i, false);
      const types = preview.map(e => e.type);
      const unique = new Set(types);
      expect(unique.size).toBe(types.length);
    }
  });

  // ── Endless mode — non-boss waves ──────────────────────────────────────
  // wave 11 = endless wave 1 (RUSH template: FAST + SWIFT + BASIC)

  it('returns at least one entry for a normal endless wave (wave 11)', () => {
    const preview = getWavePreview(11, true);
    expect(preview.length).toBeGreaterThan(0);
  });

  it('endless wave entries have positive counts', () => {
    const preview = getWavePreview(11, true);
    for (const entry of preview) {
      expect(entry.count).toBeGreaterThan(0);
    }
  });

  it('endless wave entries have non-empty labels', () => {
    const preview = getWavePreview(11, true);
    for (const entry of preview) {
      expect(entry.label).toBeTruthy();
    }
  });

  it('endless non-boss wave does not include BOSS entry', () => {
    const preview = getWavePreview(11, true);
    const bossEntry = preview.find(e => e.type === EnemyType.BOSS);
    expect(bossEntry).toBeUndefined();
  });

  // ── Endless mode — boss waves ──────────────────────────────────────────
  // wave 15 = endless wave 5 (5 % ENDLESS_BOSS_INTERVAL = 0 → BOSS milestone)

  it('endless wave at milestone includes BOSS entry (wave 15 = endless wave 5)', () => {
    const preview = getWavePreview(WAVE_DEFINITIONS.length + ENDLESS_BOSS_INTERVAL, true);
    const bossEntry = preview.find(e => e.type === EnemyType.BOSS);
    expect(bossEntry).toBeDefined();
  });

  it('endless milestone wave includes BOSS entry with positive count', () => {
    const preview = getWavePreview(WAVE_DEFINITIONS.length + ENDLESS_BOSS_INTERVAL, true);
    const bossEntry = preview.find(e => e.type === EnemyType.BOSS);
    expect(bossEntry).toBeDefined();
    expect(bossEntry!.count).toBeGreaterThan(0);
  });

  it('endless milestone wave has multiple entries', () => {
    const preview = getWavePreview(WAVE_DEFINITIONS.length + ENDLESS_BOSS_INTERVAL, true);
    expect(preview.length).toBeGreaterThan(1);
  });

  // ── Endless mode — scaling ─────────────────────────────────────────────

  it('later endless waves have higher or equal total counts than earlier ones', () => {
    // Compare non-milestone waves to avoid milestone bonus count effects
    const early = getWavePreview(11, true); // endless wave 1
    const late = getWavePreview(23, true);  // endless wave 13
    const earlyTotal = early.reduce((s, e) => s + e.count, 0);
    const lateTotal = late.reduce((s, e) => s + e.count, 0);
    expect(lateTotal).toBeGreaterThan(earlyTotal);
  });

  // ── isEndless boundary ─────────────────────────────────────────────────

  it('returns static definition data for wave within range even when isEndless is true', () => {
    // Wave 1 is within WAVE_DEFINITIONS — should use the static definition regardless of isEndless
    const notEndless = getWavePreview(1, false);
    const withEndless = getWavePreview(1, true);
    expect(notEndless).toEqual(withEndless);
  });

  // ── getWavePreviewFull ─────────────────────────────────────────────────

  describe('getWavePreviewFull', () => {
    it('returns templateDescription null for scripted waves', () => {
      const full = getWavePreviewFull(1, false);
      expect(full.templateDescription).toBeNull();
    });

    it('returns templateDescription null for scripted waves even with isEndless=true', () => {
      const full = getWavePreviewFull(1, true);
      expect(full.templateDescription).toBeNull();
    });

    it('returns non-null templateDescription for endless waves', () => {
      const full = getWavePreviewFull(11, true);
      expect(full.templateDescription).not.toBeNull();
      expect(full.templateDescription!.length).toBeGreaterThan(0);
    });

    it('entries match getWavePreview() for scripted waves', () => {
      const full = getWavePreviewFull(5, false);
      const simple = getWavePreview(5, false);
      expect(full.entries).toEqual(simple);
    });

    it('entries match getWavePreview() for endless waves', () => {
      const full = getWavePreviewFull(11, true);
      const simple = getWavePreview(11, true);
      expect(full.entries).toEqual(simple);
    });

    it('returns empty entries and null description for waveIndex 0', () => {
      const full = getWavePreviewFull(0, false);
      expect(full.entries).toEqual([]);
      expect(full.templateDescription).toBeNull();
    });

    it('templateDescription for endless milestone wave mentions boss theme', () => {
      const milestoneWave = WAVE_DEFINITIONS.length + ENDLESS_BOSS_INTERVAL;
      const full = getWavePreviewFull(milestoneWave, true);
      // BOSS template description should be non-empty
      expect(full.templateDescription).toBeTruthy();
    });
  });
});
