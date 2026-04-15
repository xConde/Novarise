import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TowerType } from '../models/tower.model';

export interface TurnEventRecord {
  turnNumber: number;
  cardsPlayed: number;
  kills: number;
  /** Total damage dealt to enemies this turn across all towers + status ticks. */
  damageDealt: number;
  /**
   * Kill attribution by tower type. Keys are the tower types that landed
   * killing blows; values are counts. `dot` is the bucket for non-tower kills
   * (status-effect DoT ticks that aren't owned by any single tower — e.g.
   * POISON stack applied by TOXIC_SPRAY spell). The sum of values equals
   * `kills` above.
   */
  killsByTower: Partial<Record<TowerType | 'dot', number>>;
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
      killsByTower: {},
      goldEarned: 0,
      livesLost: 0,
      timestamp: Date.now(),
    };
  }

  recordCardPlayed(): void {
    if (this.current) this.current.cardsPlayed++;
  }

  recordKills(count: number): void {
    if (this.current && count > 0) this.current.kills += count;
  }

  /**
   * Attribute a kill to the tower type that landed the killing blow, or to
   * the 'dot' bucket when it was a status-effect tick (no tower owner).
   * Does NOT increment `kills` — callers must still invoke recordKills to
   * keep the two fields in sync. Caller has both pieces of data at the same
   * time (combat-loop.processKill), so the split avoids double-mutation.
   */
  recordKillByTower(towerType: TowerType | null): void {
    if (!this.current) return;
    const key: TowerType | 'dot' = towerType ?? 'dot';
    this.current.killsByTower[key] = (this.current.killsByTower[key] ?? 0) + 1;
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
}
