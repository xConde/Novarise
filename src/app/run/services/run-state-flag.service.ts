import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface SerializedRunStateFlags {
  readonly entries: ReadonlyArray<readonly [string, number]>;
}

/**
 * Tracks named integer flags across a run to enable chained event sequences.
 *
 * Flags are string-keyed counters. Use FLAG_KEYS constants for all key references
 * to prevent silent typo bugs. Root-scoped so flags survive route transitions within
 * a run; call resetForRun() on run start/end to clear stale state.
 */
@Injectable({ providedIn: 'root' })
export class RunStateFlagService {
  private readonly flagMap = new Map<string, number>();
  private readonly flagsSubject = new BehaviorSubject<ReadonlyMap<string, number>>(
    new Map(this.flagMap),
  );

  /** Observable snapshot of all flags — emits on every mutation. */
  readonly flags$: Observable<ReadonlyMap<string, number>> = this.flagsSubject.asObservable();

  /** Returns the numeric value of a flag, or 0 if not set. */
  getFlag(key: string): number {
    return this.flagMap.get(key) ?? 0;
  }

  /** Returns true if the flag exists and its value is > 0. */
  hasFlag(key: string): boolean {
    const val = this.flagMap.get(key);
    return val !== undefined && val > 0;
  }

  /** Set a flag to an explicit value (default 1). Creates the flag if absent. */
  setFlag(key: string, value = 1): void {
    this.flagMap.set(key, value);
    this.emit();
  }

  /** Increment a flag by amount (default 1). Creates with value 0+amount if absent. */
  incrementFlag(key: string, amount = 1): void {
    const current = this.flagMap.get(key) ?? 0;
    this.flagMap.set(key, current + amount);
    this.emit();
  }

  /** Remove a flag entirely. No-op if flag does not exist. */
  clearFlag(key: string): void {
    this.flagMap.delete(key);
    this.emit();
  }

  /** Clear all flags. Call at run start and run end. */
  resetForRun(): void {
    this.flagMap.clear();
    this.emit();
  }

  /** Returns a read-only snapshot of all current flags. */
  getAllFlags(): ReadonlyMap<string, number> {
    return new Map(this.flagMap);
  }

  // ── Serialization ──────────────────────────────────────────────

  serialize(): SerializedRunStateFlags {
    return {
      entries: [...this.flagMap.entries()].map(([k, v]) => [k, v] as const),
    };
  }

  restore(s: SerializedRunStateFlags): void {
    this.flagMap.clear();
    for (const [k, v] of s.entries) {
      if (typeof k === 'string' && typeof v === 'number' && v > 0) {
        this.flagMap.set(k, v);
      }
    }
    this.emit();
  }

  private emit(): void {
    this.flagsSubject.next(new Map(this.flagMap));
  }
}
