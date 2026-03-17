import { StorageService } from './storage.service';

const TEST_KEY = '__storage_spec_test__';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    service = new StorageService();
    localStorage.removeItem(TEST_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(TEST_KEY);
  });

  // ── getJSON ──────────────────────────────────────────────────────────────

  describe('getJSON', () => {
    it('returns parsed data for a valid JSON entry', () => {
      localStorage.setItem(TEST_KEY, JSON.stringify({ score: 42 }));
      const result = service.getJSON<{ score: number }>(TEST_KEY, { score: 0 });
      expect(result.score).toBe(42);
    });

    it('returns defaultValue when key is missing', () => {
      const result = service.getJSON<number>('__nonexistent_key__', 99);
      expect(result).toBe(99);
    });

    it('returns defaultValue (and does not throw) for corrupted JSON', () => {
      localStorage.setItem(TEST_KEY, 'not-valid-json{{');
      expect(() => {
        const result = service.getJSON<string>(TEST_KEY, 'default');
        expect(result).toBe('default');
      }).not.toThrow();
    });

    it('returns complex defaultValue for corrupted JSON', () => {
      localStorage.setItem(TEST_KEY, '}{invalid');
      const result = service.getJSON<{ a: number }>(TEST_KEY, { a: 5 });
      expect(result).toEqual({ a: 5 });
    });

    it('logs an error for corrupted JSON', () => {
      spyOn(console, 'error');
      localStorage.setItem(TEST_KEY, 'bad json');
      service.getJSON(TEST_KEY, null);
      expect(console.error).toHaveBeenCalledWith(
        jasmine.stringContaining(`corrupted data for key "${TEST_KEY}"`)
      );
    });

    it('returns defaultValue for a null stored value (empty string stored as JSON null)', () => {
      const result = service.getJSON<string | null>(TEST_KEY, 'fallback');
      expect(result).toBe('fallback');
    });
  });

  // ── setJSON ──────────────────────────────────────────────────────────────

  describe('setJSON', () => {
    it('returns true on success', () => {
      const ok = service.setJSON(TEST_KEY, { x: 1 });
      expect(ok).toBeTrue();
    });

    it('persists data that can be read back', () => {
      service.setJSON(TEST_KEY, { value: 'hello' });
      const raw = localStorage.getItem(TEST_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!) as { value: string };
      expect(parsed.value).toBe('hello');
    });

    it('returns false when localStorage.setItem throws QuotaExceededError', () => {
      const err = new DOMException('quota exceeded', 'QuotaExceededError');
      spyOn(localStorage, 'setItem').and.throwError(err);
      const ok = service.setJSON(TEST_KEY, { big: 'data' });
      expect(ok).toBeFalse();
    });

    it('logs an error message when quota is exceeded', () => {
      spyOn(console, 'error');
      const err = new DOMException('quota exceeded', 'QuotaExceededError');
      spyOn(localStorage, 'setItem').and.throwError(err);
      service.setJSON(TEST_KEY, { data: 'value' });
      expect(console.error).toHaveBeenCalledWith(
        jasmine.stringContaining(`quota exceeded writing key "${TEST_KEY}"`)
      );
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('returns true when an existing key is removed', () => {
      localStorage.setItem(TEST_KEY, 'value');
      expect(service.remove(TEST_KEY)).toBeTrue();
      expect(localStorage.getItem(TEST_KEY)).toBeNull();
    });

    it('returns false when the key does not exist', () => {
      expect(service.remove('__definitely_not_here__')).toBeFalse();
    });
  });

  // ── getString / setString ─────────────────────────────────────────────────

  describe('getString', () => {
    it('returns the stored string', () => {
      localStorage.setItem(TEST_KEY, 'raw-value');
      expect(service.getString(TEST_KEY)).toBe('raw-value');
    });

    it('returns null when key is absent', () => {
      expect(service.getString('__absent__')).toBeNull();
    });
  });

  describe('setString', () => {
    it('returns true and persists the string', () => {
      const ok = service.setString(TEST_KEY, 'hello');
      expect(ok).toBeTrue();
      expect(localStorage.getItem(TEST_KEY)).toBe('hello');
    });
  });

  // ── getUsage ─────────────────────────────────────────────────────────────

  describe('getUsage', () => {
    it('returns used >= 0 and available = 5MB', () => {
      const usage = service.getUsage();
      expect(usage.used).toBeGreaterThanOrEqual(0);
      expect(usage.available).toBe(5 * 1024 * 1024);
    });

    it('percentUsed is between 0 and 100 under normal conditions', () => {
      const usage = service.getUsage();
      expect(usage.percentUsed).toBeGreaterThanOrEqual(0);
      expect(usage.percentUsed).toBeLessThanOrEqual(100);
    });

    it('increases used when data is written', () => {
      const before = service.getUsage().used;
      localStorage.setItem(TEST_KEY, 'x'.repeat(100));
      const after = service.getUsage().used;
      expect(after).toBeGreaterThan(before);
    });
  });

  // ── isAvailable ───────────────────────────────────────────────────────────

  describe('isAvailable', () => {
    it('returns true when localStorage works normally', () => {
      expect(service.isAvailable()).toBeTrue();
    });

    it('caches the result after first call', () => {
      const first = service.isAvailable();
      spyOn(localStorage, 'setItem').and.throwError(new Error('blocked'));
      // Should still return cached value
      const second = service.isAvailable();
      expect(second).toBe(first);
    });

    it('returns false when localStorage.setItem throws', () => {
      const freshService = new StorageService();
      spyOn(localStorage, 'setItem').and.throwError(new Error('blocked'));
      expect(freshService.isAvailable()).toBeFalse();
    });
  });
});
