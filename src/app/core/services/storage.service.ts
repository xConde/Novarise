import { Injectable } from '@angular/core';

const STORAGE_AVAILABLE_TEST_KEY = '__novarise_storage_test__';
const ESTIMATED_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB standard limit

@Injectable({ providedIn: 'root' })
export class StorageService {
  private availabilityCache: boolean | null = null;

  /**
   * Read and parse JSON from localStorage. Returns defaultValue on any failure
   * (missing key, invalid JSON, storage unavailable).
   */
  getJSON<T>(key: string, defaultValue: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error(`Storage: corrupted data for key "${key}", returning default`);
      }
      // SecurityError (private browsing) and other errors silently return default
      return defaultValue;
    }
  }

  /**
   * Write JSON to localStorage. Returns true on success, false on failure
   * (quota exceeded, storage unavailable). Logs error with context.
   */
  setJSON(key: string, value: unknown): boolean {
    try {
      const serialized = JSON.stringify(value);
      const bytes = serialized.length * 2; // UTF-16
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      const isQuotaError = (error instanceof DOMException) && (
        error.code === 22 ||  // Safari/WebKit legacy code
        error.name === 'QuotaExceededError' ||  // Modern browsers
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED'  // Firefox
      );
      if (isQuotaError) {
        const serialized = (() => {
          try { return JSON.stringify(value); } catch { return ''; }
        })();
        const bytes = serialized.length * 2;
        console.error(`Storage: quota exceeded writing key "${key}" (${bytes} bytes)`);
      }
      return false;
    }
  }

  /**
   * Remove a key from localStorage. Returns true if removed, false if not found or unavailable.
   */
  remove(key: string): boolean {
    try {
      const exists = localStorage.getItem(key) !== null;
      if (!exists) return false;
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get a raw string from localStorage. Returns null if not found or unavailable.
   */
  getString(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  /**
   * Set a raw string in localStorage. Returns true on success.
   */
  setString(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Estimate total localStorage usage in bytes.
   * Returns { used: number, available: number, percentUsed: number }.
   */
  getUsage(): { used: number; available: number; percentUsed: number } {
    try {
      let used = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== null) {
          const value = localStorage.getItem(key) ?? '';
          used += (key.length + value.length) * 2; // UTF-16: 2 bytes per char
        }
      }
      const percentUsed = (used / ESTIMATED_TOTAL_BYTES) * 100;
      return { used, available: ESTIMATED_TOTAL_BYTES, percentUsed };
    } catch {
      return { used: 0, available: ESTIMATED_TOTAL_BYTES, percentUsed: 0 };
    }
  }

  /**
   * Check if localStorage is available (private browsing can disable it).
   * Result is cached after the first check.
   */
  isAvailable(): boolean {
    if (this.availabilityCache !== null) return this.availabilityCache;
    try {
      localStorage.setItem(STORAGE_AVAILABLE_TEST_KEY, '1');
      const read = localStorage.getItem(STORAGE_AVAILABLE_TEST_KEY);
      localStorage.removeItem(STORAGE_AVAILABLE_TEST_KEY);
      this.availabilityCache = read === '1';
    } catch {
      this.availabilityCache = false;
    }
    return this.availabilityCache;
  }
}
