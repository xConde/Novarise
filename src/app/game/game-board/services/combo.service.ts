import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { COMBO_TIERS, COMBO_WINDOW_SECONDS } from '../constants/combo.constants';

export interface ComboState {
  /** Current consecutive kill count within the active combo window. */
  count: number;
  /** Total bonus gold earned in this combo burst (accumulated). */
  totalBonusGold: number;
  /** Tier label for the current combo count, or null when below minimum threshold. */
  tierLabel: string | null;
  /** Bonus gold awarded for the most recent kill (0 when not in a tier). */
  lastKillBonus: number;
}

const INITIAL_COMBO_STATE: ComboState = {
  count: 0,
  totalBonusGold: 0,
  tierLabel: null,
  lastKillBonus: 0,
};

@Injectable()
export class ComboService {
  private comboCount = 0;
  private lastKillTime = 0; // epoch ms

  private state$ = new BehaviorSubject<ComboState>({ ...INITIAL_COMBO_STATE });

  getState$(): Observable<ComboState> {
    return this.state$.asObservable();
  }

  getState(): ComboState {
    return this.state$.getValue();
  }

  /**
   * Register a kill and return the bonus gold to award.
   * Call this once per killed enemy. Caller is responsible for adding the
   * returned gold to GameStateService.
   *
   * @param nowMs Current time in milliseconds (Date.now() or performance.now()).
   */
  recordKill(nowMs: number): number {
    const elapsed = (nowMs - this.lastKillTime) / 1000;

    if (this.lastKillTime === 0 || elapsed > COMBO_WINDOW_SECONDS) {
      // Window expired or first kill — start a fresh combo
      this.comboCount = 1;
    } else {
      this.comboCount++;
    }

    this.lastKillTime = nowMs;

    const bonus = this.getBonusForCount(this.comboCount);
    const tier = this.getTierForCount(this.comboCount);

    const prev = this.state$.getValue();
    this.state$.next({
      count: this.comboCount,
      totalBonusGold: prev.totalBonusGold + bonus,
      tierLabel: tier?.label ?? null,
      lastKillBonus: bonus,
    });

    return bonus;
  }

  /**
   * Reset combo state — call at wave end or game restart.
   */
  reset(): void {
    this.comboCount = 0;
    this.lastKillTime = 0;
    this.state$.next({ ...INITIAL_COMBO_STATE });
  }

  /**
   * Expire the combo if the window has elapsed.
   * Call this each frame from the game loop so the counter clears visually.
   *
   * @param nowMs Current time in milliseconds.
   */
  tick(nowMs: number): void {
    if (this.comboCount === 0 || this.lastKillTime === 0) return;

    const elapsed = (nowMs - this.lastKillTime) / 1000;
    if (elapsed > COMBO_WINDOW_SECONDS) {
      this.comboCount = 0;
      this.lastKillTime = 0;
      this.state$.next({ ...INITIAL_COMBO_STATE });
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getBonusForCount(count: number): number {
    return this.getTierForCount(count)?.bonusGoldPerKill ?? 0;
  }

  private getTierForCount(count: number): typeof COMBO_TIERS[number] | undefined {
    // Tiers are defined highest-first, so the first match is the best tier
    return COMBO_TIERS.find(t => count >= t.minKills);
  }
}
