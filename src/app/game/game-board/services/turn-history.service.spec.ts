import { TestBed } from '@angular/core/testing';
import { TurnHistoryService, TurnEventRecord } from './turn-history.service';
import { TowerType } from '../models/tower.model';

describe('TurnHistoryService', () => {
  let service: TurnHistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TurnHistoryService] });
    service = TestBed.inject(TurnHistoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('beginTurn initialises a fresh current record', () => {
    service.beginTurn(1);
    service.recordCardPlayed();
    const result = service.endTurn();
    expect(result).not.toBeNull();
    expect(result!.turnNumber).toBe(1);
    expect(result!.cardsPlayed).toBe(1);
  });

  it('endTurn returns null when no turn has begun', () => {
    expect(service.endTurn()).toBeNull();
  });

  it('recordCardPlayed increments correctly', () => {
    service.beginTurn(1);
    service.recordCardPlayed();
    service.recordCardPlayed();
    const r = service.endTurn()!;
    expect(r.cardsPlayed).toBe(2);
  });

  it('recordKills ignores zero', () => {
    service.beginTurn(1);
    service.recordKills(0);
    const r = service.endTurn()!;
    expect(r.kills).toBe(0);
  });

  it('recordKills accumulates multiple calls', () => {
    service.beginTurn(1);
    service.recordKills(3);
    service.recordKills(2);
    const r = service.endTurn()!;
    expect(r.kills).toBe(5);
  });

  it('recordGoldEarned accumulates positive amounts', () => {
    service.beginTurn(1);
    service.recordGoldEarned(10);
    service.recordGoldEarned(20);
    const r = service.endTurn()!;
    expect(r.goldEarned).toBe(30);
  });

  it('recordLifeLost defaults count to 1', () => {
    service.beginTurn(1);
    service.recordLifeLost();
    const r = service.endTurn()!;
    expect(r.livesLost).toBe(1);
  });

  it('rolling buffer caps at 5 records', () => {
    for (let i = 1; i <= 6; i++) {
      service.beginTurn(i);
      service.endTurn();
    }
    expect(service.getRecords().length).toBe(5);
    // Oldest (turn 1) should be evicted; first remaining is turn 2
    expect(service.getRecords()[0].turnNumber).toBe(2);
  });

  it('getLastCompletedTurn returns the most recent record', () => {
    service.beginTurn(1);
    service.endTurn();
    service.beginTurn(2);
    service.endTurn();
    const last = service.getLastCompletedTurn();
    expect(last?.turnNumber).toBe(2);
  });

  it('getLastCompletedTurn returns null when no turns completed', () => {
    expect(service.getLastCompletedTurn()).toBeNull();
  });

  it('reset clears the buffer', () => {
    service.beginTurn(1);
    service.endTurn();
    service.reset();
    expect(service.getRecords().length).toBe(0);
    expect(service.getLastCompletedTurn()).toBeNull();
  });

  it('records$ emits updated array after endTurn', (done) => {
    service.records$.subscribe((records: TurnEventRecord[]) => {
      if (records.length === 1) {
        expect(records[0].turnNumber).toBe(3);
        done();
      }
    });
    service.beginTurn(3);
    service.endTurn();
  });

  it('does nothing when recording without an active turn', () => {
    service.recordCardPlayed();
    service.recordKills(5);
    service.recordGoldEarned(50);
    service.recordLifeLost(2);
    service.recordDamage(100);
    service.recordKillByTower(TowerType.BASIC);
    // No crash, records stay empty
    expect(service.getRecords().length).toBe(0);
  });

  // ── Phase 16: damage + per-tower kill attribution ──────────────────────

  describe('recordDamage', () => {
    it('accumulates positive amounts', () => {
      service.beginTurn(1);
      service.recordDamage(10);
      service.recordDamage(25);
      const r = service.endTurn()!;
      expect(r.damageDealt).toBe(35);
    });

    it('ignores zero and negative amounts', () => {
      service.beginTurn(1);
      service.recordDamage(0);
      service.recordDamage(-5);
      const r = service.endTurn()!;
      expect(r.damageDealt).toBe(0);
    });
  });

  describe('recordKillByTower', () => {
    it('counts per-(type, level) kills into killsByTower entries', () => {
      service.beginTurn(1);
      service.recordKillByTower(TowerType.BASIC, 1);
      service.recordKillByTower(TowerType.BASIC, 1);
      service.recordKillByTower(TowerType.SNIPER, 1);
      const r = service.endTurn()!;
      const basic = r.killsByTower.find(e => e.type === TowerType.BASIC && e.level === 1);
      const sniper = r.killsByTower.find(e => e.type === TowerType.SNIPER && e.level === 1);
      expect(basic?.count).toBe(2);
      expect(sniper?.count).toBe(1);
    });

    it('buckets the same tower type at different levels separately', () => {
      service.beginTurn(1);
      service.recordKillByTower(TowerType.BASIC, 1);
      service.recordKillByTower(TowerType.BASIC, 2);
      service.recordKillByTower(TowerType.BASIC, 2);
      const r = service.endTurn()!;
      expect(r.killsByTower.length).toBe(2);
      expect(r.killsByTower.find(e => e.level === 1)?.count).toBe(1);
      expect(r.killsByTower.find(e => e.level === 2)?.count).toBe(2);
    });

    it('clamps missing / zero level to 1 for tower kills (safe default)', () => {
      service.beginTurn(1);
      service.recordKillByTower(TowerType.BASIC, 0);
      service.recordKillByTower(TowerType.BASIC); // level defaults to 0, clamped to 1
      const r = service.endTurn()!;
      expect(r.killsByTower.length).toBe(1);
      expect(r.killsByTower[0].level).toBe(1);
      expect(r.killsByTower[0].count).toBe(2);
    });

    it('routes null towerType into the dot bucket at level 0', () => {
      service.beginTurn(1);
      service.recordKillByTower(null);
      service.recordKillByTower(null);
      const r = service.endTurn()!;
      const dot = r.killsByTower.find(e => e.type === 'dot');
      expect(dot?.count).toBe(2);
      expect(dot?.level).toBe(0);
    });

    it('ignores the towerLevel param when towerType is null (DoT has no tier)', () => {
      service.beginTurn(1);
      service.recordKillByTower(null, 3); // level 3 passed but null means DoT
      const r = service.endTurn()!;
      expect(r.killsByTower[0]).toEqual({ type: 'dot', level: 0, count: 1 });
    });

    it('starts a fresh killsByTower array on each beginTurn', () => {
      service.beginTurn(1);
      service.recordKillByTower(TowerType.BASIC);
      service.endTurn();

      service.beginTurn(2);
      const r = service.endTurn()!;
      expect(r.killsByTower).toEqual([]);
    });
  });
});
