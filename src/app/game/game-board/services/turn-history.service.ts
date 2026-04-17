import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TowerType } from '../models/tower.model';

/** One entry in the per-(type, level) kill attribution list. */
export interface TurnKillAttribution {
  type: TowerType | 'dot';
  /** Tower level at time of kill. 0 for DoT / status-effect kills. */
  level: number;
  count: number;
}

export interface TurnEventRecord {
  turnNumber: number;
  cardsPlayed: number;
  kills: number;
  /** Total damage dealt to enemies this turn across all towers + status ticks. */
  damageDealt: number;
  /**
   * Kill attribution grouped by (tower type, tower level). Tier-1 entries
   * (level 1) render without a suffix in the UI; tier 2+ get a number.
   * Status-effect DoT kills land in `{ type: 'dot', level: 0 }`.
   * Sum of `count` equals `kills`.
   */
  killsByTower: TurnKillAttribution[];
  goldEarned: number;
  livesLost: number;
  timestamp: number;
}

const BUFFER_SIZE = 5;

/**
 * TurnHistoryService — rolling buffer of the last 5 completed turn records.
 *
 * Lifecycle:
 *   1. Call beginTurn(n) at the start of each player turn.
 *   2. Increment individual counters as events fire.
 *   3. Call endTurn() to finalize the record; it returns the completed record
 *      (used by GameBoardComponent to flash the last-turn-summary overlay).
 *
 * Component-scoped (provided in GameBoardComponent.providers) — discarded with the component.
 */
@Injectable()
export class TurnHistoryService {
  private readonly recordsSubject = new BehaviorSubject<TurnEventRecord[]>([]);
  private current: TurnEventRecord | null = null;

  readonly records$: Observable<TurnEventRecord[]> = this.recordsSubject.asObservable();

  /** Begin tracking the turn. Call at the start of each player turn. */
  beginTurn(turnNumber: number): void {
    this.current = {
      turnNumber,
      cardsPlayed: 0,
      kills: 0,
      damageDealt: 0,
      killsByTower: [],
      goldEarned: 0,
      livesLost: 0,
      timestamp: Date.now(),
    };
  }

  recordCardPlayed(): void {
    if (this.current) this.current.cardsPlayed++;
  }

  /**
   * Attribute a kill to a (tower type, level) pair. Tier-1 (level 1) kills
   * render without a suffix in the UI; tier 2+ get a number suffix. Status-
   * effect DoT kills pass `towerType: null` and land in the `dot` bucket
   * with level 0.
   *
   * Caller does not need to separately track totals — `kills` is derived in
   * endTurn() from the sum of killsByTower counts.
   */
  recordKillByTower(towerType: TowerType | null, towerLevel = 0): void {
    if (!this.current) return;
    const key: TowerType | 'dot' = towerType ?? 'dot';
    // Clamp DoT to level 0 — there's no "tier 2 DoT" concept.
    const level = towerType === null ? 0 : Math.max(1, towerLevel);
    const existing = this.current.killsByTower.find(e => e.type === key && e.level === level);
    if (existing) {
      existing.count++;
    } else {
      this.current.killsByTower.push({ type: key, level, count: 1 });
    }
  }

  /** Total damage dealt this turn. Sums every hit (lethal and non-lethal). */
  recordDamage(amount: number): void {
    if (this.current && amount > 0) this.current.damageDealt += amount;
  }

  recordGoldEarned(amount: number): void {
    if (this.current && amount > 0) this.current.goldEarned += amount;
  }

  recordLifeLost(count = 1): void {
    if (this.current && count > 0) this.current.livesLost += count;
  }

  /** Finalize the turn, push to the rolling buffer. Returns the completed record. */
  endTurn(): TurnEventRecord | null {
    if (!this.current) return null;
    const completed = this.current;
    // Derive kills from per-tower attributions — killsByTower is the single source of truth.
    completed.kills = completed.killsByTower.reduce((sum, e) => sum + e.count, 0);
    const updated = [...this.recordsSubject.value, completed].slice(-BUFFER_SIZE);
    this.recordsSubject.next(updated);
    this.current = null;
    return completed;
  }

  /** Most recent completed turn, or null if none. */
  getLastCompletedTurn(): TurnEventRecord | null {
    const all = this.recordsSubject.value;
    return all.length > 0 ? all[all.length - 1] : null;
  }

  getRecords(): readonly TurnEventRecord[] {
    return this.recordsSubject.value;
  }

  reset(): void {
    this.recordsSubject.next([]);
    this.current = null;
  }

  /** Serialize the rolling buffer for checkpoint persistence. Deep-clones
   * killsByTower arrays to decouple from the live service state. */
  serialize(): TurnEventRecord[] {
    return this.recordsSubject.value.map(r => ({
      ...r,
      killsByTower: r.killsByTower.map(e => ({ ...e })),
    }));
  }

  /** Restore the rolling buffer from checkpoint data. Clears any in-flight
   * current turn and expanded-row tracking is the component's concern. */
  restore(records: readonly TurnEventRecord[]): void {
    const copied = records.map(r => ({
      ...r,
      killsByTower: r.killsByTower.map(e => ({ ...e })),
    }));
    this.recordsSubject.next(copied);
    this.current = null;
  }
}
