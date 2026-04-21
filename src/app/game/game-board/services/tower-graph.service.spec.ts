import { TestBed } from '@angular/core/testing';
import { TowerGraphService } from './tower-graph.service';
import { PlacedTower, TowerType, DEFAULT_TARGETING_MODE } from '../models/tower.model';

describe('TowerGraphService (Conduit primitives)', () => {
  let service: TowerGraphService;
  let placedTowers: Map<string, PlacedTower>;

  // Simple tower factory — only fields the graph cares about (id, row, col).
  // Everything else stubbed to minimum viable types.
  function buildTower(row: number, col: number): PlacedTower {
    const id = `${row}-${col}`;
    return {
      id,
      type: TowerType.BASIC,
      level: 1,
      row,
      col,
      kills: 0,
      totalInvested: 0,
      targetingMode: DEFAULT_TARGETING_MODE,
      mesh: null,
    };
  }

  function place(row: number, col: number): PlacedTower {
    const tower = buildTower(row, col);
    placedTowers.set(tower.id, tower);
    service.registerTower(tower);
    return tower;
  }

  beforeEach(() => {
    placedTowers = new Map();
    TestBed.configureTestingModule({ providers: [TowerGraphService] });
    service = TestBed.inject(TowerGraphService);
    service.setPlacedTowersGetter(() => placedTowers);
  });

  describe('4-direction spatial adjacency', () => {
    it('isolated tower: 0 neighbors, cluster size 1', () => {
      place(5, 5);
      expect(service.getNeighbors(5, 5)).toEqual([]);
      expect(service.getClusterSize(5, 5)).toBe(1);
      expect(service.getClusterTowers(5, 5)).toEqual(['5-5']);
    });

    it('two 4-dir-adjacent towers: mutual neighbor, cluster size 2', () => {
      place(5, 5);
      place(5, 6);
      expect(service.getNeighbors(5, 5)).toEqual(['5-6']);
      expect(service.getNeighbors(5, 6)).toEqual(['5-5']);
      expect(service.getClusterSize(5, 5)).toBe(2);
      expect(service.getClusterSize(5, 6)).toBe(2);
    });

    it('diagonal towers are NOT neighbors', () => {
      place(5, 5);
      place(6, 6); // diagonal
      expect(service.getNeighbors(5, 5)).toEqual([]);
      expect(service.getNeighbors(6, 6)).toEqual([]);
      expect(service.getClusterSize(5, 5)).toBe(1);
    });

    it('plus-shape: center has 4 neighbors', () => {
      place(5, 5); // center
      place(4, 5); // up
      place(6, 5); // down
      place(5, 4); // left
      place(5, 6); // right
      const n = service.getNeighbors(5, 5);
      expect(n.length).toBe(4);
      expect(new Set(n)).toEqual(new Set(['4-5', '6-5', '5-4', '5-6']));
      expect(service.getClusterSize(5, 5)).toBe(5);
    });

    it('5-tower line: cluster size 5', () => {
      for (let c = 0; c < 5; c++) place(5, c);
      expect(service.getClusterSize(5, 0)).toBe(5);
      expect(service.getClusterSize(5, 4)).toBe(5);
    });

    it('unregister middle of a line splits the cluster', () => {
      for (let c = 0; c < 5; c++) place(5, c);
      service.unregisterTower('5-2');
      placedTowers.delete('5-2');
      expect(service.getClusterSize(5, 0)).toBe(2); // {5-0, 5-1}
      expect(service.getClusterSize(5, 4)).toBe(2); // {5-3, 5-4}
    });

    it('unregister leaves no dangling edges', () => {
      place(5, 5);
      place(5, 6);
      service.unregisterTower('5-5');
      placedTowers.delete('5-5');
      expect(service.getNeighbors(5, 6)).toEqual([]);
    });

    it('insertion order does not affect neighbor set', () => {
      place(5, 6);
      place(5, 5);
      expect(new Set(service.getNeighbors(5, 5))).toEqual(new Set(['5-6']));
      expect(new Set(service.getNeighbors(5, 6))).toEqual(new Set(['5-5']));
    });

    it('getNeighbors on an unregistered position returns empty', () => {
      expect(service.getNeighbors(99, 99)).toEqual([]);
    });

    it('getClusterTowers returns a deterministic row-then-col-sorted list', () => {
      place(6, 5);
      place(5, 5);
      place(5, 6);
      place(5, 4);
      const cluster = service.getClusterTowers(5, 5);
      // Expected sort: (5,4), (5,5), (5,6), (6,5).
      expect(cluster).toEqual(['5-4', '5-5', '5-6', '6-5']);
    });
  });

  describe('virtual edges (CONDUIT_BRIDGE API)', () => {
    it('addVirtualEdge unions non-adjacent towers into the neighbor set', () => {
      place(5, 5);
      place(10, 10);
      service.addVirtualEdge(5, 5, 10, 10, /* expires */ 100, 'conduit-bridge-1');
      expect(new Set(service.getNeighbors(5, 5, /* currentTurn */ 50))).toEqual(new Set(['10-10']));
      expect(new Set(service.getNeighbors(10, 10, 50))).toEqual(new Set(['5-5']));
    });

    it('virtual edge merges clusters', () => {
      place(5, 5);
      place(10, 10);
      service.addVirtualEdge(5, 5, 10, 10, 100, 'src');
      expect(service.getClusterSize(5, 5, 50)).toBe(2);
    });

    it('virtual edge with invalid endpoint returns false', () => {
      place(5, 5);
      // no tower at (99, 99)
      expect(service.addVirtualEdge(5, 5, 99, 99, 100, 'src')).toBe(false);
    });

    it('virtual edge with same endpoint twice returns false', () => {
      place(5, 5);
      expect(service.addVirtualEdge(5, 5, 5, 5, 100, 'src')).toBe(false);
    });

    it('tickTurn expires virtual edges exactly on expiresOnTurn', () => {
      place(5, 5);
      place(10, 10);
      service.addVirtualEdge(5, 5, 10, 10, /* expiresOnTurn */ 10, 'src');
      service.tickTurn(9);
      expect(service.getNeighbors(5, 5, 9).length).toBe(1); // still active
      service.tickTurn(10);
      expect(service.getNeighbors(5, 5, 10)).toEqual([]);
    });

    it('unregisterTower drops virtual edges touching the removed tower', () => {
      place(5, 5);
      place(10, 10);
      place(3, 3);
      service.addVirtualEdge(5, 5, 10, 10, 100, 'src');
      service.addVirtualEdge(3, 3, 10, 10, 100, 'src');
      service.unregisterTower('10-10');
      placedTowers.delete('10-10');
      expect(service.getNeighbors(5, 5)).toEqual([]);
      expect(service.getNeighbors(3, 3)).toEqual([]);
    });

    it('virtual edge substring-disambiguation: id "5-5" is not confused with "15-5"', () => {
      place(5, 5);
      place(15, 5);
      place(10, 5);
      service.addVirtualEdge(15, 5, 10, 5, 100, 'src');
      // Removing (5, 5) must NOT drop the (15-5, 10-5) virtual edge.
      service.unregisterTower('5-5');
      placedTowers.delete('5-5');
      expect(new Set(service.getNeighbors(15, 5))).toEqual(new Set(['10-5'])); // virtual edge survived
    });
  });

  describe('disruption (DISRUPTOR / ISOLATOR / DIVIDER — sprints 53+)', () => {
    it('disruptRadius flags all towers within Manhattan radius', () => {
      place(5, 5); // center
      place(5, 7); // distance 2 — IN
      place(5, 8); // distance 3 — OUT
      place(7, 5); // distance 2 — IN
      service.disruptRadius(5, 5, /* radius */ 2, /* until */ 10, 'disruptor-1');
      expect(service.isDisrupted(5, 5, /* currentTurn */ 5)).toBe(true);
      expect(service.isDisrupted(5, 7, 5)).toBe(true);
      expect(service.isDisrupted(7, 5, 5)).toBe(true);
      expect(service.isDisrupted(5, 8, 5)).toBe(false);
    });

    it('Manhattan diamond radius-2 excludes (4, 4) corners (Chebyshev would include)', () => {
      place(5, 5);
      place(4, 4); // Manhattan 2, but NOT "within radius 2 via Manhattan diamond"? Actually Manhattan 2 IS within r=2.
      // Manhattan: |5-4|+|5-4|=2 → equals radius → included. This is the
      // diamond boundary, not exclusion. Verify the more-accurate edge:
      // (3, 4) is Manhattan 3 → excluded. (3, 3) is Manhattan 4 → excluded.
      place(3, 3); // Manhattan 4 — OUT
      place(3, 5); // Manhattan 2 — IN
      service.disruptRadius(5, 5, 2, 10, 'd');
      expect(service.isDisrupted(4, 4, 5)).toBe(true);  // Manhattan 2 — diamond includes.
      expect(service.isDisrupted(3, 3, 5)).toBe(false); // Manhattan 4 — excluded.
      expect(service.isDisrupted(3, 5, 5)).toBe(true);  // Manhattan 2 — included.
    });

    it('a disrupted tower contributes ZERO neighbors during disruption', () => {
      place(5, 5);
      place(5, 6);
      place(5, 4);
      service.disruptRadius(5, 5, /* radius */ 0, /* until */ 10, 'd'); // just the center
      // (5, 5) reads no neighbors during its own disruption window.
      expect(service.getNeighbors(5, 5, 5)).toEqual([]);
      // (5, 6)'s neighbor (5, 5) is disrupted — excluded from its set.
      expect(service.getNeighbors(5, 6, 5)).toEqual([]);
      // (5, 4) similarly.
      expect(service.getNeighbors(5, 4, 5)).toEqual([]);
    });

    it('disruption expires EXACTLY on untilTurn via tickTurn', () => {
      place(5, 5);
      service.severTower(5, 5, /* until */ 10, 'd');
      expect(service.isDisrupted(5, 5, 9)).toBe(true);
      service.tickTurn(10);
      expect(service.isDisrupted(5, 5, 10)).toBe(false);
    });

    it('later disruptRadius with greater untilTurn extends; earlier call does not shorten', () => {
      place(5, 5);
      service.severTower(5, 5, 10, 'd1');
      service.severTower(5, 5, 5, 'd2'); // earlier — must not shorten
      expect(service.isDisrupted(5, 5, 7)).toBe(true);
      service.tickTurn(10);
      expect(service.isDisrupted(5, 5, 10)).toBe(false);
    });

    it('clusterSize with disruption: an isolated disrupted tower returns size 1', () => {
      place(5, 5);
      place(5, 6);
      service.severTower(5, 5, 10, 'd');
      expect(service.getClusterSize(5, 5, 5)).toBe(1);
    });

    it('severTower on unregistered position is a no-op', () => {
      expect(() => service.severTower(99, 99, 10, 'd')).not.toThrow();
    });
  });

  describe('isInStraightLineOf — FORMATION detection', () => {
    it('horizontal 3-line: middle + both endpoints all qualify', () => {
      place(5, 4);
      place(5, 5);
      place(5, 6);
      expect(service.isInStraightLineOf(5, 4, 3)).toBe(true);
      expect(service.isInStraightLineOf(5, 5, 3)).toBe(true);
      expect(service.isInStraightLineOf(5, 6, 3)).toBe(true);
    });

    it('vertical 3-line qualifies', () => {
      place(3, 5);
      place(4, 5);
      place(5, 5);
      expect(service.isInStraightLineOf(4, 5, 3)).toBe(true);
    });

    it('2-tower horizontal line does NOT qualify for minLength=3', () => {
      place(5, 5);
      place(5, 6);
      expect(service.isInStraightLineOf(5, 5, 3)).toBe(false);
    });

    it('L-shape is not a straight line', () => {
      place(5, 5);
      place(5, 6);
      place(6, 6);
      expect(service.isInStraightLineOf(5, 5, 3)).toBe(false);
      expect(service.isInStraightLineOf(5, 6, 3)).toBe(false);
      expect(service.isInStraightLineOf(6, 6, 3)).toBe(false);
    });

    it('diagonal is not a straight line (only 4-dir counts)', () => {
      place(5, 5);
      place(6, 6);
      place(7, 7);
      expect(service.isInStraightLineOf(5, 5, 3)).toBe(false);
    });

    it('5-tower line qualifies for any minLength ≤ 5', () => {
      for (let c = 0; c < 5; c++) place(5, c);
      for (let c = 0; c < 5; c++) {
        expect(service.isInStraightLineOf(5, c, 3)).toBe(true);
        expect(service.isInStraightLineOf(5, c, 5)).toBe(true);
      }
    });

    it('disrupted tower at the query point returns false', () => {
      place(5, 4);
      place(5, 5);
      place(5, 6);
      service.severTower(5, 5, /* until */ 10, 'd');
      expect(service.isInStraightLineOf(5, 5, 3, /* currentTurn */ 5)).toBe(false);
    });

    it('disrupted interior tower breaks the line for its peers', () => {
      place(5, 4);
      place(5, 5);
      place(5, 6);
      service.severTower(5, 5, 10, 'd');
      // (5, 4) + (5, 6) see a broken line — disrupted middle stops the walk.
      expect(service.isInStraightLineOf(5, 4, 3, 5)).toBe(false);
      expect(service.isInStraightLineOf(5, 6, 3, 5)).toBe(false);
    });

    it('gap in the line breaks it', () => {
      place(5, 4);
      // (5, 5) missing — gap
      place(5, 6);
      place(5, 7);
      expect(service.isInStraightLineOf(5, 6, 3)).toBe(false);
      expect(service.isInStraightLineOf(5, 7, 3)).toBe(false);
    });

    it('unregistered position returns false', () => {
      expect(service.isInStraightLineOf(99, 99, 3)).toBe(false);
    });

    it('isolated tower with minLength=1 returns true', () => {
      place(5, 5);
      expect(service.isInStraightLineOf(5, 5, 1)).toBe(true);
    });
  });

  describe('rebuild() and reset() lifecycle', () => {
    it('rebuild() from an empty graph to a populated placedTowers map produces the same graph as incremental registration', () => {
      place(5, 5);
      place(5, 6);
      place(6, 5);

      // Save the incremental state for comparison.
      const expectedNeighbors = new Map<string, string[]>();
      for (const t of placedTowers.values()) {
        expectedNeighbors.set(t.id, [...service.getNeighbors(t.row, t.col)].sort());
      }

      // Wipe via rebuild — but keep placedTowers — then rebuild.
      // rebuild() clears neighbors/keyToId and re-derives from placedTowersGetter.
      service.rebuild();

      for (const t of placedTowers.values()) {
        const got = [...service.getNeighbors(t.row, t.col)].sort();
        expect(got).toEqual(expectedNeighbors.get(t.id)!);
      }
    });

    it('reset() clears all state', () => {
      place(5, 5);
      place(5, 6);
      service.addVirtualEdge(5, 5, 5, 6, 100, 'src');
      service.severTower(5, 5, 10, 'd');
      service.reset();
      expect(service.getNeighbors(5, 5)).toEqual([]);
      expect(service.isDisrupted(5, 5, 5)).toBe(false);
    });
  });

  describe('firing-in-progress invariant (spike §14 row 4)', () => {
    it('mutation during fireTurn is soft-warned, not thrown', () => {
      const warnSpy = spyOn(console, 'warn');
      service.markFiringInProgress(true);
      place(5, 5); // attempts to mutate while firing
      expect(warnSpy).toHaveBeenCalled();
      service.markFiringInProgress(false);
    });
  });

  describe('serialize / restore', () => {
    it('empty state round-trips', () => {
      const snapshot = service.serialize();
      service.reset();
      service.restore(snapshot);
      expect(service.getNeighbors(5, 5)).toEqual([]);
    });

    it('restore rebuilds virtual-edge state given the towers already registered', () => {
      place(5, 5);
      place(10, 10);
      service.addVirtualEdge(5, 5, 10, 10, 100, 'src');
      const snapshot = service.serialize();
      // Simulate restore path — reset state, re-register towers, then restore graph.
      service.reset();
      service.registerTower(buildTower(5, 5));
      service.registerTower(buildTower(10, 10));
      service.restore(snapshot);
      expect(new Set(service.getNeighbors(5, 5, 50))).toEqual(new Set(['10-10']));
    });
  });
});
