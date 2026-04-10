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
  TOWER_FIRED = 'tower_fired',
  GOLD_EARNED = 'gold_earned',
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
