import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

/**
 * Pub-sub event bus for run-scoped events.
 *
 * Game services publish events (enemy killed, tower placed, wave started);
 * RelicService subscribes to trigger relic effects.
 *
 * Design note: when cards are added, card effects will subscribe to
 * the same bus — one seam, two consumers.
 */

export enum RunEventType {
  ENCOUNTER_START = 'encounter_start',
  ENCOUNTER_END = 'encounter_end',
  WAVE_START = 'wave_start',
  WAVE_COMPLETE = 'wave_complete',
  ENEMY_KILLED = 'enemy_killed',
  ENEMY_LEAKED = 'enemy_leaked',
  TOWER_PLACED = 'tower_placed',
  TOWER_SOLD = 'tower_sold',
  TOWER_UPGRADED = 'tower_upgraded',
  /**
   * Intentionally NOT emitted by production code. Per-shot volume (every
   * tower × every target × every turn) would flood subscribers. If a future
   * relic/card needs this, consider emitting only on specific trigger
   * conditions (e.g., first shot of wave, critical hit) rather than globally.
   */
  TOWER_FIRED = 'tower_fired',
  GOLD_EARNED = 'gold_earned',
  /**
   * Intentionally NOT emitted by production code. Same volume concern as
   * TOWER_FIRED — every hit on every enemy would fire this. ENEMY_KILLED
   * carries the final-blow signal; a push-model damage tracker should
   * batch by frame or subscribe to a lower-level hook instead.
   */
  DAMAGE_DEALT = 'damage_dealt',
}

export interface RunEvent {
  readonly type: RunEventType;
  readonly payload: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class RunEventBusService {
  private readonly eventSubject = new Subject<RunEvent>();

  /** Stream of all run events. Filter by type in subscribers. */
  readonly events$: Observable<RunEvent> = this.eventSubject.asObservable();

  /** Publish an event to all subscribers. */
  emit(type: RunEventType, payload: Record<string, unknown> = {}): void {
    this.eventSubject.next({ type, payload });
  }

  /** Convenience: filter events$ to a single type. */
  on(type: RunEventType): Observable<RunEvent> {
    return new Observable(subscriber => {
      const sub = this.events$.subscribe(event => {
        if (event.type === type) {
          subscriber.next(event);
        }
      });
      return () => sub.unsubscribe();
    });
  }
}
