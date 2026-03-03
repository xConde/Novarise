import { EnemyType } from './enemy.model';
import { WAVE_DEFINITIONS } from './wave.model';
import { WavePreviewEntry, getWavePreview } from './wave-preview.model';

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
    // Wave 10: BOSS×1, SHIELDED×4, SWARM×4, HEAVY×2
    const preview = getWavePreview(WAVE_DEFINITIONS.length, false);
    expect(preview.find(e => e.type === EnemyType.BOSS)?.count).toBe(1);
    expect(preview.find(e => e.type === EnemyType.SHIELDED)?.count).toBe(4);
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

  it('returns two entries for a normal endless wave (wave 11)', () => {
    const preview = getWavePreview(11, true);
    expect(preview.length).toBe(2);
  });

  it('endless wave primary count is greater than secondary count', () => {
    const preview = getWavePreview(11, true);
    expect(preview[0].count).toBeGreaterThan(preview[1].count);
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

  // ── Endless mode — boss waves ──────────────────────────────────────────

  it('endless wave that is a multiple of bossInterval includes BOSS entry', () => {
    // ENDLESS_CONFIG.bossInterval = 5 → wave 15 is a boss wave
    const preview = getWavePreview(15, true);
    const bossEntry = preview.find(e => e.type === EnemyType.BOSS);
    expect(bossEntry).toBeDefined();
    expect(bossEntry?.count).toBe(1);
  });

  it('endless boss wave has BOSS as the first entry', () => {
    const preview = getWavePreview(15, true);
    expect(preview[0].type).toBe(EnemyType.BOSS);
  });

  it('endless boss wave has 3 entries (boss + primary + secondary)', () => {
    const preview = getWavePreview(15, true);
    expect(preview.length).toBe(3);
  });

  it('endless non-boss wave does not include BOSS entry', () => {
    const preview = getWavePreview(11, true);
    const bossEntry = preview.find(e => e.type === EnemyType.BOSS);
    expect(bossEntry).toBeUndefined();
  });

  // ── Endless mode — scaling ─────────────────────────────────────────────

  it('later endless waves have higher total counts than earlier ones', () => {
    const early = getWavePreview(11, true);
    const late = getWavePreview(21, true);
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
});
