import { TestBed } from '@angular/core/testing';
import { RunEventBusService, RunEventType, RunEvent } from './run-event-bus.service';

describe('RunEventBusService', () => {
  let service: RunEventBusService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RunEventBusService],
    });
    service = TestBed.inject(RunEventBusService);
  });

  // ── emit / events$ ────────────────────────────────────────────

  it('events$ should receive an emitted event', () => {
    const received: RunEvent[] = [];
    const sub = service.events$.subscribe(e => received.push(e));

    service.emit(RunEventType.WAVE_START, { waveIndex: 1 });

    expect(received.length).toBe(1);
    expect(received[0].type).toBe(RunEventType.WAVE_START);
    expect(received[0].payload['waveIndex']).toBe(1);
    sub.unsubscribe();
  });

  it('emit() without payload defaults to empty object', () => {
    const received: RunEvent[] = [];
    const sub = service.events$.subscribe(e => received.push(e));

    service.emit(RunEventType.ENCOUNTER_START);

    expect(received.length).toBe(1);
    expect(received[0].payload).toEqual({});
    sub.unsubscribe();
  });

  it('multiple emissions are delivered in order', () => {
    const types: RunEventType[] = [];
    const sub = service.events$.subscribe(e => types.push(e.type));

    service.emit(RunEventType.ENCOUNTER_START);
    service.emit(RunEventType.WAVE_START);
    service.emit(RunEventType.ENEMY_KILLED);

    expect(types).toEqual([
      RunEventType.ENCOUNTER_START,
      RunEventType.WAVE_START,
      RunEventType.ENEMY_KILLED,
    ]);
    sub.unsubscribe();
  });

  it('events$ does not deliver events emitted before subscription', () => {
    service.emit(RunEventType.TOWER_PLACED);

    const received: RunEvent[] = [];
    const sub = service.events$.subscribe(e => received.push(e));

    expect(received.length).toBe(0);
    sub.unsubscribe();
  });

  // ── on(type) ─────────────────────────────────────────────────

  it('on(type) delivers only events of that type', () => {
    const waveEvents: RunEvent[] = [];
    const sub = service.on(RunEventType.WAVE_START).subscribe(e => waveEvents.push(e));

    service.emit(RunEventType.ENCOUNTER_START);
    service.emit(RunEventType.WAVE_START, { waveIndex: 0 });
    service.emit(RunEventType.ENEMY_KILLED, { enemyId: 'x' });
    service.emit(RunEventType.WAVE_START, { waveIndex: 1 });

    expect(waveEvents.length).toBe(2);
    expect(waveEvents[0].payload['waveIndex']).toBe(0);
    expect(waveEvents[1].payload['waveIndex']).toBe(1);
    sub.unsubscribe();
  });

  it('on(type) ignores all non-matching event types', () => {
    const goldEvents: RunEvent[] = [];
    const sub = service.on(RunEventType.GOLD_EARNED).subscribe(e => goldEvents.push(e));

    service.emit(RunEventType.ENEMY_KILLED);
    service.emit(RunEventType.TOWER_PLACED);
    service.emit(RunEventType.WAVE_COMPLETE);

    expect(goldEvents.length).toBe(0);
    sub.unsubscribe();
  });

  it('on(type) unsubscribes cleanly without emitting further events', () => {
    let count = 0;
    const sub = service.on(RunEventType.DAMAGE_DEALT).subscribe(() => count++);
    service.emit(RunEventType.DAMAGE_DEALT);
    sub.unsubscribe();
    service.emit(RunEventType.DAMAGE_DEALT);
    expect(count).toBe(1);
  });

  // ── Multiple subscribers ──────────────────────────────────────

  it('multiple subscribers each receive the same event', () => {
    const received1: RunEvent[] = [];
    const received2: RunEvent[] = [];

    const sub1 = service.events$.subscribe(e => received1.push(e));
    const sub2 = service.events$.subscribe(e => received2.push(e));

    service.emit(RunEventType.TOWER_SOLD, { towerId: 'abc' });

    expect(received1.length).toBe(1);
    expect(received2.length).toBe(1);
    expect(received1[0].type).toBe(RunEventType.TOWER_SOLD);
    expect(received2[0].type).toBe(RunEventType.TOWER_SOLD);

    sub1.unsubscribe();
    sub2.unsubscribe();
  });

  it('events$ and on() subscribers both receive the same event', () => {
    const allEvents: RunEvent[] = [];
    const waveEvents: RunEvent[] = [];

    const sub1 = service.events$.subscribe(e => allEvents.push(e));
    const sub2 = service.on(RunEventType.WAVE_COMPLETE).subscribe(e => waveEvents.push(e));

    service.emit(RunEventType.WAVE_COMPLETE, { waveIndex: 3 });

    expect(allEvents.length).toBe(1);
    expect(waveEvents.length).toBe(1);
    expect(allEvents[0].payload['waveIndex']).toBe(3);
    expect(waveEvents[0].payload['waveIndex']).toBe(3);

    sub1.unsubscribe();
    sub2.unsubscribe();
  });
});
