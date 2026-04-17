import { TestBed } from '@angular/core/testing';
import { RunStateFlagService, SerializedRunStateFlags } from './run-state-flag.service';
import { FLAG_KEYS } from '../constants/flag-keys';

describe('RunStateFlagService', () => {
  let service: RunStateFlagService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RunStateFlagService);
    service.resetForRun();
  });

  // ── getFlag / hasFlag ──────────────────────────────────────────���───────────

  describe('getFlag()', () => {
    it('returns 0 for an unknown flag', () => {
      expect(service.getFlag('nonexistent')).toBe(0);
    });

    it('returns the set value after setFlag()', () => {
      service.setFlag(FLAG_KEYS.MERCHANT_AIDED, 3);
      expect(service.getFlag(FLAG_KEYS.MERCHANT_AIDED)).toBe(3);
    });
  });

  describe('hasFlag()', () => {
    it('returns false for an unset flag', () => {
      expect(service.hasFlag(FLAG_KEYS.SCOUT_SAVED)).toBeFalse();
    });

    it('returns true after setFlag() with default value 1', () => {
      service.setFlag(FLAG_KEYS.SCOUT_SAVED);
      expect(service.hasFlag(FLAG_KEYS.SCOUT_SAVED)).toBeTrue();
    });

    it('returns false when flag value is 0 (explicit set)', () => {
      service.setFlag('some_flag', 0);
      expect(service.hasFlag('some_flag')).toBeFalse();
    });
  });

  // ── setFlag ────────────────────────────────────────────────────────────────

  describe('setFlag()', () => {
    it('sets flag to 1 by default', () => {
      service.setFlag(FLAG_KEYS.IDOL_BARGAIN_TAKEN);
      expect(service.getFlag(FLAG_KEYS.IDOL_BARGAIN_TAKEN)).toBe(1);
    });

    it('sets flag to provided value', () => {
      service.setFlag(FLAG_KEYS.IDOL_BARGAIN_TAKEN, 7);
      expect(service.getFlag(FLAG_KEYS.IDOL_BARGAIN_TAKEN)).toBe(7);
    });

    it('overwrites existing value', () => {
      service.setFlag('key', 5);
      service.setFlag('key', 2);
      expect(service.getFlag('key')).toBe(2);
    });
  });

  // ── incrementFlag ─────────────────────────────────────────────────────────

  describe('incrementFlag()', () => {
    it('starts from 0 and increments by default amount 1', () => {
      service.incrementFlag('counter');
      expect(service.getFlag('counter')).toBe(1);
    });

    it('increments an existing flag', () => {
      service.setFlag('counter', 3);
      service.incrementFlag('counter');
      expect(service.getFlag('counter')).toBe(4);
    });

    it('increments by a custom amount', () => {
      service.incrementFlag('counter', 5);
      expect(service.getFlag('counter')).toBe(5);
    });

    it('cumulative increments accumulate correctly', () => {
      service.incrementFlag('counter', 2);
      service.incrementFlag('counter', 3);
      expect(service.getFlag('counter')).toBe(5);
    });
  });

  // ── clearFlag ─────────────────────────────────────────────────────────────

  describe('clearFlag()', () => {
    it('removes a previously set flag', () => {
      service.setFlag(FLAG_KEYS.MERCHANT_AIDED);
      service.clearFlag(FLAG_KEYS.MERCHANT_AIDED);
      expect(service.hasFlag(FLAG_KEYS.MERCHANT_AIDED)).toBeFalse();
      expect(service.getFlag(FLAG_KEYS.MERCHANT_AIDED)).toBe(0);
    });

    it('is a no-op when flag does not exist', () => {
      expect(() => service.clearFlag('nope')).not.toThrow();
    });
  });

  // ── resetForRun ───────────────────────────────────────────────────────────

  describe('resetForRun()', () => {
    it('clears all flags', () => {
      service.setFlag(FLAG_KEYS.MERCHANT_AIDED);
      service.setFlag(FLAG_KEYS.IDOL_BARGAIN_TAKEN);
      service.resetForRun();
      expect(service.getAllFlags().size).toBe(0);
    });

    it('getFlag returns 0 after reset', () => {
      service.setFlag(FLAG_KEYS.SCOUT_SAVED);
      service.resetForRun();
      expect(service.getFlag(FLAG_KEYS.SCOUT_SAVED)).toBe(0);
    });
  });

  // ── getAllFlags ───────────────────────────────────────────────────────────

  describe('getAllFlags()', () => {
    it('returns an empty map when no flags are set', () => {
      expect(service.getAllFlags().size).toBe(0);
    });

    it('returns a snapshot with all current flags', () => {
      service.setFlag(FLAG_KEYS.MERCHANT_AIDED, 1);
      service.setFlag(FLAG_KEYS.SCOUT_SAVED, 2);
      const snapshot = service.getAllFlags();
      expect(snapshot.size).toBe(2);
      expect(snapshot.get(FLAG_KEYS.MERCHANT_AIDED)).toBe(1);
      expect(snapshot.get(FLAG_KEYS.SCOUT_SAVED)).toBe(2);
    });

    it('returned snapshot is independent (mutation does not affect internal state)', () => {
      service.setFlag(FLAG_KEYS.MERCHANT_AIDED);
      const snapshot = service.getAllFlags() as Map<string, number>;
      snapshot.set('injected_key', 999);
      expect(service.hasFlag('injected_key')).toBeFalse();
    });
  });

  // ── BehaviorSubject emissions ─────────────────────────────────────────────

  describe('flags$ observable', () => {
    it('emits on setFlag()', (done) => {
      const emissions: ReadonlyMap<string, number>[] = [];
      const sub = service.flags$.subscribe(m => emissions.push(m));

      service.setFlag('key');
      sub.unsubscribe();

      // Initial emission + the mutation emission
      expect(emissions.length).toBeGreaterThanOrEqual(2);
      const last = emissions[emissions.length - 1];
      expect(last.get('key')).toBe(1);
      done();
    });

    it('emits on incrementFlag()', () => {
      const vals: number[] = [];
      const sub = service.flags$.subscribe(m => vals.push(m.get('x') ?? 0));
      service.incrementFlag('x');
      service.incrementFlag('x');
      sub.unsubscribe();
      expect(vals[vals.length - 1]).toBe(2);
    });

    it('emits on clearFlag()', () => {
      service.setFlag('y');
      const hasFlagValues: boolean[] = [];
      const sub = service.flags$.subscribe(m => hasFlagValues.push(m.has('y')));
      service.clearFlag('y');
      sub.unsubscribe();
      expect(hasFlagValues[hasFlagValues.length - 1]).toBeFalse();
    });

    it('emits on resetForRun()', () => {
      service.setFlag('z', 5);
      const sizes: number[] = [];
      const sub = service.flags$.subscribe(m => sizes.push(m.size));
      service.resetForRun();
      sub.unsubscribe();
      expect(sizes[sizes.length - 1]).toBe(0);
    });
  });

  // ── serialize / restore ───────────────────────────────────────────────────

  describe('serialize()', () => {
    it('returns empty entries when no flags are set', () => {
      const result = service.serialize();
      expect(result.entries.length).toBe(0);
    });

    it('captures all set flags', () => {
      service.setFlag(FLAG_KEYS.MERCHANT_AIDED, 1);
      service.setFlag(FLAG_KEYS.IDOL_BARGAIN_TAKEN, 2);
      const result = service.serialize();
      expect(result.entries.length).toBe(2);
    });
  });

  describe('restore()', () => {
    it('restores flags from serialized state', () => {
      const serialized: SerializedRunStateFlags = {
        entries: [
          [FLAG_KEYS.MERCHANT_AIDED, 1],
          [FLAG_KEYS.SCOUT_SAVED, 3],
        ],
        consumedEventIds: [],
      };
      service.restore(serialized);
      expect(service.hasFlag(FLAG_KEYS.MERCHANT_AIDED)).toBeTrue();
      expect(service.getFlag(FLAG_KEYS.SCOUT_SAVED)).toBe(3);
    });

    it('clears existing flags before restoring', () => {
      service.setFlag('old_flag', 5);
      service.restore({ entries: [[FLAG_KEYS.MERCHANT_AIDED, 1]], consumedEventIds: [] });
      expect(service.hasFlag('old_flag')).toBeFalse();
    });

    it('skips entries with non-positive values', () => {
      service.restore({ entries: [['bad_flag', 0]], consumedEventIds: [] });
      expect(service.hasFlag('bad_flag')).toBeFalse();
    });

    it('skips entries with non-string keys or non-number values', () => {
      const badEntries = [[null, 1], ['ok', 'string']] as unknown as Array<[string, number]>;
      expect(() => service.restore({ entries: badEntries, consumedEventIds: [] })).not.toThrow();
    });

    it('emits via flags$ after restore', () => {
      const sizes: number[] = [];
      const sub = service.flags$.subscribe(m => sizes.push(m.size));
      service.restore({ entries: [[FLAG_KEYS.MERCHANT_AIDED, 1]], consumedEventIds: [] });
      sub.unsubscribe();
      expect(sizes[sizes.length - 1]).toBe(1);
    });
  });

  describe('serialize/restore round-trip', () => {
    it('round-trips populated flags', () => {
      service.setFlag(FLAG_KEYS.MERCHANT_AIDED, 1);
      service.incrementFlag('visit_count', 3);

      const serialized = service.serialize();
      const fresh = TestBed.inject(RunStateFlagService);
      // Use a second instance-like approach via resetForRun then restore
      const freshService = new RunStateFlagService();
      freshService.restore(serialized);

      expect(freshService.hasFlag(FLAG_KEYS.MERCHANT_AIDED)).toBeTrue();
      expect(freshService.getFlag('visit_count')).toBe(3);
    });
  });

  // ── consumedEventIds (H4 — firesOncePerRun) ───────────────────────────────

  describe('markEventConsumed() / isEventConsumed()', () => {
    it('returns false for an unknown event ID', () => {
      expect(service.isEventConsumed('unknown_event')).toBeFalse();
    });

    it('round-trips: markEventConsumed then isEventConsumed returns true', () => {
      service.markEventConsumed('wandering_merchant_return');
      expect(service.isEventConsumed('wandering_merchant_return')).toBeTrue();
    });

    it('is independent per event ID', () => {
      service.markEventConsumed('event_a');
      expect(service.isEventConsumed('event_a')).toBeTrue();
      expect(service.isEventConsumed('event_b')).toBeFalse();
    });
  });

  describe('resetForRun() clears consumed event IDs', () => {
    it('cleared set returns false after reset', () => {
      service.markEventConsumed('cursed_idol_reckoning');
      service.resetForRun();
      expect(service.isEventConsumed('cursed_idol_reckoning')).toBeFalse();
    });
  });

  describe('serialize/restore round-trips consumedEventIds', () => {
    it('includes consumed event IDs in serialized output', () => {
      service.markEventConsumed('scout_returns_grateful');
      const serialized = service.serialize();
      expect(serialized.consumedEventIds).toContain('scout_returns_grateful');
    });

    it('restores consumed event IDs from serialized state', () => {
      service.markEventConsumed('wandering_merchant_return');
      service.markEventConsumed('cursed_idol_reckoning');
      const serialized = service.serialize();

      const freshService = new RunStateFlagService();
      freshService.restore(serialized);

      expect(freshService.isEventConsumed('wandering_merchant_return')).toBeTrue();
      expect(freshService.isEventConsumed('cursed_idol_reckoning')).toBeTrue();
    });

    it('restore with no consumedEventIds field defaults to empty (legacy shape)', () => {
      const legacyShape = { entries: [] } as unknown as SerializedRunStateFlags;
      expect(() => service.restore(legacyShape)).not.toThrow();
      expect(service.isEventConsumed('any_event')).toBeFalse();
    });
  });
});
