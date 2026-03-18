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

    it('returns true when write+read+delete succeed (health check passes)', () => {
      const freshService = new StorageService();
      expect(freshService.isAvailable()).toBeTrue();
    });

    it('returns false when localStorage throws on setItem (storage unavailable)', () => {
      const freshService = new StorageService();
      const domErr = new DOMException('storage unavailable', 'SecurityError');
      spyOn(localStorage, 'setItem').and.throwError(domErr);
      expect(freshService.isAvailable()).toBeFalse();
    });
  });

  // ── quota error detection ─────────────────────────────────────────────────

  describe('quota error detection', () => {
    it('returns false and logs error for Safari/WebKit quota error (code 22)', () => {
      spyOn(console, 'error');
      // DOMException with code 22 is the Safari/WebKit legacy QuotaExceededError
      const safariErr = new DOMException('QuotaExceededError', 'QuotaExceededError');
      Object.defineProperty(safariErr, 'code', { value: 22 });
      spyOn(localStorage, 'setItem').and.throwError(safariErr);
      const ok = service.setJSON(TEST_KEY, { data: 'value' });
      expect(ok).toBeFalse();
      expect(console.error).toHaveBeenCalledWith(
        jasmine.stringContaining(`quota exceeded writing key "${TEST_KEY}"`)
      );
    });

    it('returns false and logs error for modern QuotaExceededError name', () => {
      spyOn(console, 'error');
      const modernErr = new DOMException('quota exceeded', 'QuotaExceededError');
      spyOn(localStorage, 'setItem').and.throwError(modernErr);
      const ok = service.setJSON(TEST_KEY, { data: 'value' });
      expect(ok).toBeFalse();
      expect(console.error).toHaveBeenCalledWith(
        jasmine.stringContaining(`quota exceeded writing key "${TEST_KEY}"`)
      );
    });

    it('returns false and logs error for Firefox NS_ERROR_DOM_QUOTA_REACHED', () => {
      spyOn(console, 'error');
      const firefoxErr = new DOMException('quota exceeded', 'NS_ERROR_DOM_QUOTA_REACHED');
      spyOn(localStorage, 'setItem').and.throwError(firefoxErr);
      const ok = service.setJSON(TEST_KEY, { data: 'value' });
      expect(ok).toBeFalse();
      expect(console.error).toHaveBeenCalledWith(
        jasmine.stringContaining(`quota exceeded writing key "${TEST_KEY}"`)
      );
    });

    it('returns false but does NOT log for non-quota errors', () => {
      spyOn(console, 'error');
      const genericErr = new DOMException('unknown error', 'UnknownError');
      spyOn(localStorage, 'setItem').and.throwError(genericErr);
      const ok = service.setJSON(TEST_KEY, { data: 'value' });
      expect(ok).toBeFalse();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  // ── error paths ───────────────────────────────────────────────────────────

  describe('error paths', () => {
    it('getJSON returns defaultValue when stored value is an empty string (not valid JSON)', () => {
      // An empty string is not valid JSON — JSON.parse('') throws SyntaxError
      localStorage.setItem(TEST_KEY, '');
      const result = service.getJSON<string>(TEST_KEY, 'fallback');
      expect(result).toBe('fallback');
    });

    it('setJSON with a circular reference returns false', () => {
      const circular: Record<string, unknown> = {};
      circular['self'] = circular; // circular reference — JSON.stringify will throw
      const ok = service.setJSON(TEST_KEY, circular);
      expect(ok).toBeFalse();
    });

    it('setJSON with a circular reference does not write to localStorage', () => {
      const setItemSpy = spyOn(localStorage, 'setItem').and.callThrough();
      const circular: Record<string, unknown> = {};
      circular['self'] = circular;
      service.setJSON(TEST_KEY, circular);
      // setItem should not have been called because stringify fails first
      expect(setItemSpy).not.toHaveBeenCalled();
    });

    it('getUsage returns non-zero used bytes when localStorage has entries', () => {
      // Write several keys to ensure non-zero usage
      localStorage.setItem('__usage_test_a__', 'a'.repeat(200));
      localStorage.setItem('__usage_test_b__', 'b'.repeat(200));
      localStorage.setItem('__usage_test_c__', 'c'.repeat(200));

      const usage = service.getUsage();
      expect(usage.used).toBeGreaterThan(0);

      // Clean up
      localStorage.removeItem('__usage_test_a__');
      localStorage.removeItem('__usage_test_b__');
      localStorage.removeItem('__usage_test_c__');
    });

    it('getUsage used increases proportionally with data written', () => {
      const before = service.getUsage().used;
      localStorage.setItem(TEST_KEY, 'x'.repeat(1000));
      const after = service.getUsage().used;
      // 1000 chars × 2 bytes (UTF-16) = 2000 bytes increase for value alone
      expect(after - before).toBeGreaterThanOrEqual(2000);
    });
  });
});
