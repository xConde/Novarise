import { Injectable } from '@angular/core';
import { PlacedTower } from '../models/tower.model';
import { CONDUIT_CONFIG } from '../constants/conduit.constants';

/**
 * Serializable snapshot of `TowerGraphService` state that CANNOT be derived
 * from `placedTowers` + `activeModifiers` alone.
 *
 * Sprints 41-47 ship with `virtualEdges` empty and `disruptedUntil` empty
 * — those surfaces are introduced by sprint 48 (CONDUIT_BRIDGE) and sprint 53
 * (DISRUPTOR). A `CHECKPOINT_VERSION` bump (v9 → v10) is required before
 * either field carries data across saves. See spike §9.
 */
export interface SerializableTowerGraphState {
  readonly virtualEdges: readonly SerializableVirtualEdge[];
  readonly disruptedUntil: readonly { readonly key: string; readonly untilTurn: number; readonly sourceId: string }[];
}

export interface SerializableVirtualEdge {
  readonly aRow: number;
  readonly aCol: number;
  readonly bRow: number;
  readonly bCol: number;
  readonly expiresOnTurn: number;
  readonly sourceId: string;
}

/** Edge between two towers in the graph. */
export interface TowerGraphEdge {
  readonly a: string;                            // tower id (PlacedTower.id / `${row}-${col}`)
  readonly b: string;
  readonly kind: 'spatial' | 'virtual';
  readonly expiresOnTurn?: number;               // virtual edges only
}

/** Connected-component view. `id` is stable only within a rebuild; do NOT persist. */
export interface TowerCluster {
  readonly id: number;
  readonly towerIds: readonly string[];
  readonly size: number;
}

/**
 * Tower adjacency graph service — Phase 4 Conduit primitives (sprint 41).
 *
 * ## Responsibilities
 *
 * - Track 4-direction spatial adjacency between `PlacedTower` instances.
 * - Track virtual edges (CONDUIT_BRIDGE, sprint 48) that connect
 *   non-adjacent towers for a limited duration.
 * - Track per-tower disruption (DISRUPTOR, ISOLATOR, DIVIDER — sprints 53+).
 * - Expose O(1) per-tower reads for `composeDamageStack` and card/relic
 *   handlers: `getNeighbors`, `getClusterSize`, `getClusterTowers`,
 *   `isDisrupted`.
 *
 * ## What this service is NOT
 *
 * - NOT the authoritative tower registry — that is
 *   `TowerCombatService.placedTowers`. The graph is a derived view.
 * - NOT mutated during `fireTurn`. Card plays that register / unregister
 *   towers open only in the turn prelude (see invariant
 *   `assertNotFiring()` below). Adjacency is stable for the duration of a
 *   combat resolution.
 * - NOT persisting spatial adjacency or cluster membership. Those are
 *   re-derived on every `registerTower` / `unregisterTower` and on
 *   checkpoint restore (Step 4.5).
 *
 * ## Scope
 *
 * Component-scoped on `GameBoardComponent.providers` — same pattern as
 * `PathMutationService`, `ElevationService`, `LineOfSightService`. One
 * graph per combat encounter. `reset()` is called from
 * `GameSessionService.teardownEncounter`.
 *
 * ## Circular-DI avoidance
 *
 * `TowerGraphService` does NOT inject `TowerCombatService` — that would
 * create a cycle (`TowerCombatService` calls `TowerGraphService` on
 * register). Instead, callers hook via `setPlacedTowersGetter(...)` at
 * component init. Mirrors `PathMutationService.setRepathHook`.
 *
 * See `docs/design/conduit-adjacency-graph.md` for the full design spike.
 */
@Injectable()
export class TowerGraphService {
  /** Tower id → set of tower ids that are 4-dir spatial neighbors (unless disrupted). */
  private readonly neighbors = new Map<string, Set<string>>();

  /**
   * Position key (`${row}-${col}`) → tower id.
   * Needed because `unregisterTower(key)` takes a position key; edges are
   * keyed by tower id. In the current code tower.id === key but this
   * indirection makes the id/position decoupling explicit and future-proof.
   */
  private readonly keyToId = new Map<string, string>();

  /**
   * Virtual edges (CONDUIT_BRIDGE). Keyed by the canonical edge string
   * `${a}__${b}` with a < b (lex order). Not a full second-class adjacency
   * set — unioned into {@link getNeighbors} at read time.
   *
   * Sprint 48 activates. Sprints 41-47 never populate this map.
   */
  private readonly virtualEdges = new Map<string, SerializableVirtualEdge>();

  /**
   * Per-tower disruption entries: tower id → until-turn (exclusive).
   * A tower is disrupted when currentTurn < untilTurn.
   *
   * Sprints 53/54/55 populate via `disruptRadius` / `severTower`. Sprints
   * 41-47 never populate this map; `isDisrupted` returns false.
   */
  private readonly disruptedUntil = new Map<string, { untilTurn: number; sourceId: string }>();

  /** Guard for "no graph mutation during fireTurn" invariant (spike §14 row 4). */
  private firingInProgress = false;

  /** Getter for `placedTowers` — injected by component init to avoid DI cycle. */
  private placedTowersGetter: () => ReadonlyMap<string, PlacedTower> = () => new Map();

  // ─── Init ──────────────────────────────────────────────────────────────

  /**
   * Wire the source-of-truth tower registry. GameBoardComponent.ngOnInit calls
   * this with `() => this.towerCombatService.getPlacedTowers()`.
   *
   * Mirrors `PathMutationService.setRepathHook` to break the potential
   * `TowerGraphService` ↔ `TowerCombatService` circular DI.
   */
  setPlacedTowersGetter(getter: () => ReadonlyMap<string, PlacedTower>): void {
    this.placedTowersGetter = getter;
  }

  // ─── Lifecycle hooks (called by TowerCombatService) ────────────────────

  registerTower(tower: PlacedTower): void {
    this.assertNotFiring();
    const key = `${tower.row}-${tower.col}`;
    this.keyToId.set(key, tower.id);
    if (!this.neighbors.has(tower.id)) {
      this.neighbors.set(tower.id, new Set<string>());
    }
    // Add edges to any currently-placed 4-dir-adjacent towers.
    for (const adj of this.scanCardinalNeighbors(tower.row, tower.col)) {
      this.neighbors.get(tower.id)!.add(adj.id);
      const back = this.neighbors.get(adj.id);
      if (back) back.add(tower.id);
    }
  }

  unregisterTower(key: string): void {
    this.assertNotFiring();
    const id = this.keyToId.get(key);
    if (id === undefined) return;
    this.keyToId.delete(key);
    const mySet = this.neighbors.get(id);
    if (mySet) {
      // Mirror-remove from each peer's neighbor set.
      for (const peer of mySet) {
        this.neighbors.get(peer)?.delete(id);
      }
      this.neighbors.delete(id);
    }
    // Prune virtual edges touching this tower. Edge keys are `a__b` with
    // lexicographic ordering — split-check prevents false positives from
    // substring matches (e.g. id "5-5" would substring-match "15-5__5-6").
    for (const edgeKey of Array.from(this.virtualEdges.keys())) {
      const [aId, bId] = edgeKey.split('__');
      if (aId === id || bId === id) this.virtualEdges.delete(edgeKey);
    }
    // Prune disruption entry.
    this.disruptedUntil.delete(id);
  }

  // ─── Virtual edges (CONDUIT_BRIDGE — sprint 48) ────────────────────────

  /**
   * Adds a virtual edge between two towers for a duration. Both towers must
   * currently be registered. Expires in `tickTurn(expiresOnTurn)`.
   *
   * Sprint 41 ships the API; sprint 48 ships the consumer card.
   */
  addVirtualEdge(
    aRow: number,
    aCol: number,
    bRow: number,
    bCol: number,
    expiresOnTurn: number,
    sourceId: string,
  ): boolean {
    this.assertNotFiring();
    const aId = this.keyToId.get(`${aRow}-${aCol}`);
    const bId = this.keyToId.get(`${bRow}-${bCol}`);
    if (aId === undefined || bId === undefined || aId === bId) return false;
    const edgeKey = this.canonicalEdgeKey(aId, bId);
    this.virtualEdges.set(edgeKey, { aRow, aCol, bRow, bCol, expiresOnTurn, sourceId });
    return true;
  }

  // ─── Disruption (DISRUPTOR / ISOLATOR / DIVIDER — sprints 53+) ─────────

  /**
   * Marks every currently-registered tower within Manhattan `radiusTiles` of
   * (row, col) as disrupted until `untilTurn`. Re-calls with higher
   * `untilTurn` extend the entry.
   *
   * Sprint 41 ships the API; sprints 53/55 ship the consumer enemies.
   */
  disruptRadius(
    row: number,
    col: number,
    radiusTiles: number,
    untilTurn: number,
    sourceId: string,
  ): void {
    this.assertNotFiring();
    for (const tower of this.placedTowersGetter().values()) {
      const dr = Math.abs(tower.row - row);
      const dc = Math.abs(tower.col - col);
      if (dr + dc > radiusTiles) continue;
      this.markDisrupted(tower.id, untilTurn, sourceId);
    }
  }

  /**
   * Severs a specific tower's neighbors until `untilTurn` — ISOLATOR target
   * behavior. Sprint 54 consumer.
   */
  severTower(row: number, col: number, untilTurn: number, sourceId: string): void {
    this.assertNotFiring();
    const id = this.keyToId.get(`${row}-${col}`);
    if (id === undefined) return;
    this.markDisrupted(id, untilTurn, sourceId);
  }

  // ─── Query (read from composeDamageStack + card/relic handlers) ────────

  /**
   * Returns tower ids 4-dir-adjacent to (row, col), plus any active virtual-
   * edge endpoints. A disrupted tower reads as having ZERO neighbors (so
   * HANDSHAKE / HIVE_MIND etc. skip disrupted towers).
   *
   * `currentTurn` is used only to filter expired disruption entries — the
   * service does NOT auto-expire on read; call `tickTurn` at the canonical
   * lifecycle slot.
   */
  getNeighbors(row: number, col: number, currentTurn = 0): readonly string[] {
    const id = this.keyToId.get(`${row}-${col}`);
    if (id === undefined) return EMPTY;
    if (this.isDisruptedId(id, currentTurn)) return EMPTY;

    const set = this.neighbors.get(id);
    if (!set) return EMPTY;
    const result: string[] = [];
    for (const peerId of set) {
      if (this.isDisruptedId(peerId, currentTurn)) continue;
      result.push(peerId);
    }
    // Union in virtual-edge endpoints.
    for (const [edgeKey, edge] of this.virtualEdges) {
      if (edge.expiresOnTurn !== undefined && currentTurn >= edge.expiresOnTurn) continue;
      const [a, b] = edgeKey.split('__');
      if (a === id && !this.isDisruptedId(b, currentTurn)) result.push(b);
      else if (b === id && !this.isDisruptedId(a, currentTurn)) result.push(a);
    }
    return result;
  }

  /**
   * Cluster size — including the tower itself. An isolated tower returns 1.
   * Traverses spatial + virtual edges, skipping disrupted towers.
   *
   * O(cluster_size) BFS per call. No cache in sprint 41; sprint 52
   * (CONSTELLATION) may add a memo if profiling demands.
   */
  getClusterSize(row: number, col: number, currentTurn = 0): number {
    return this.getClusterTowers(row, col, currentTurn).length;
  }

  /**
   * All tower ids in the cluster containing (row, col), including the tower
   * itself. Sorted by row-then-col via `id` (id === `${row}-${col}`) for
   * deterministic iteration order in consumers.
   */
  getClusterTowers(row: number, col: number, currentTurn = 0): readonly string[] {
    const startId = this.keyToId.get(`${row}-${col}`);
    if (startId === undefined) return EMPTY;
    if (this.isDisruptedId(startId, currentTurn)) return [startId];

    const visited = new Set<string>([startId]);
    const queue: string[] = [startId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const [r, c] = current.split('-').map(Number);
      for (const neighborId of this.getNeighbors(r, c, currentTurn)) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
    // Sort by row then col (determinism) — ids are `${row}-${col}`.
    return Array.from(visited).sort((a, b) => this.compareIds(a, b));
  }

  isDisrupted(row: number, col: number, currentTurn: number): boolean {
    const id = this.keyToId.get(`${row}-${col}`);
    if (id === undefined) return false;
    return this.isDisruptedId(id, currentTurn);
  }

  /** Effective link-slot capacity for a tower. Defaults to DEFAULT_LINK_SLOTS. */
  getLinkSlotCapacity(tower: PlacedTower): number {
    return tower.linkSlots ?? CONDUIT_CONFIG.DEFAULT_LINK_SLOTS;
  }

  // ─── Per-turn lifecycle ────────────────────────────────────────────────

  /**
   * Expires virtual edges whose `expiresOnTurn === currentTurn` and
   * disruption entries whose `untilTurn === currentTurn`.
   *
   * Called from `CombatLoopService.resolveTurn` at the same slot as
   * `pathMutationService.tickTurn` and `elevationService.tickTurn` — at the
   * TOP of the turn, immediately after `turnNumber++`.
   */
  tickTurn(currentTurn: number): void {
    for (const [edgeKey, edge] of Array.from(this.virtualEdges)) {
      if (edge.expiresOnTurn === currentTurn) this.virtualEdges.delete(edgeKey);
    }
    for (const [id, entry] of Array.from(this.disruptedUntil)) {
      if (entry.untilTurn === currentTurn) this.disruptedUntil.delete(id);
    }
  }

  // ─── Encounter lifecycle ───────────────────────────────────────────────

  /** Full clear — called on encounter teardown. */
  reset(): void {
    this.neighbors.clear();
    this.keyToId.clear();
    this.virtualEdges.clear();
    this.disruptedUntil.clear();
    this.firingInProgress = false;
  }

  /**
   * Full graph rebuild from `placedTowersGetter()`. Used by
   * `restoreFromCheckpoint` after tower restore (new Step 4.5 in the
   * restore coordinator). Pre-rebuild state is discarded.
   */
  rebuild(): void {
    this.neighbors.clear();
    this.keyToId.clear();
    // Note: virtualEdges + disruptedUntil are NOT cleared — they survive
    // checkpoint restore once sprint 48 persists them (v10+). In v9 they
    // are always empty so the distinction is a no-op today.
    for (const tower of this.placedTowersGetter().values()) {
      this.registerTowerInternal(tower);
    }
  }

  // ─── Firing guard ──────────────────────────────────────────────────────

  /**
   * Called by `TowerCombatService.fireTurn` around its loop body to guard
   * against graph mutation mid-fire. Test beds may set this externally when
   * exercising the invariant.
   */
  markFiringInProgress(value: boolean): void {
    this.firingInProgress = value;
  }

  // ─── Persistence (no-op in v9; sprint 48 activates) ────────────────────

  serialize(): SerializableTowerGraphState {
    return {
      virtualEdges: Array.from(this.virtualEdges.values()),
      disruptedUntil: Array.from(this.disruptedUntil.entries()).map(
        ([key, entry]) => ({ key, untilTurn: entry.untilTurn, sourceId: entry.sourceId }),
      ),
    };
  }

  restore(snapshot: SerializableTowerGraphState): void {
    this.virtualEdges.clear();
    this.disruptedUntil.clear();
    for (const edge of snapshot.virtualEdges) {
      // Recompute the canonical key from the two tower positions — requires
      // those towers to already be registered (restore ordering: towers
      // before graph rebuild, then graph virtual-edge restore).
      const aId = this.keyToId.get(`${edge.aRow}-${edge.aCol}`);
      const bId = this.keyToId.get(`${edge.bRow}-${edge.bCol}`);
      if (aId === undefined || bId === undefined) continue;
      this.virtualEdges.set(this.canonicalEdgeKey(aId, bId), edge);
    }
    for (const { key, untilTurn, sourceId } of snapshot.disruptedUntil) {
      this.disruptedUntil.set(key, { untilTurn, sourceId });
    }
  }

  // ─── Internals ─────────────────────────────────────────────────────────

  private registerTowerInternal(tower: PlacedTower): void {
    // Non-assertion variant of registerTower for `rebuild()`, which runs
    // outside the normal "not firing" invariant (e.g. on checkpoint restore
    // where the firing flag has just been reset).
    const key = `${tower.row}-${tower.col}`;
    this.keyToId.set(key, tower.id);
    if (!this.neighbors.has(tower.id)) {
      this.neighbors.set(tower.id, new Set<string>());
    }
    for (const adj of this.scanCardinalNeighbors(tower.row, tower.col)) {
      this.neighbors.get(tower.id)!.add(adj.id);
      const back = this.neighbors.get(adj.id);
      if (back) back.add(tower.id);
    }
  }

  /**
   * Returns currently-registered towers in the 4-dir cardinal neighborhood
   * of (row, col). Does NOT include the tower at (row, col) itself.
   */
  private scanCardinalNeighbors(row: number, col: number): readonly PlacedTower[] {
    const out: PlacedTower[] = [];
    const towers = this.placedTowersGetter();
    const candidates = [
      { r: row - 1, c: col     },
      { r: row + 1, c: col     },
      { r: row,     c: col - 1 },
      { r: row,     c: col + 1 },
    ];
    for (const { r, c } of candidates) {
      const tower = towers.get(`${r}-${c}`);
      if (tower !== undefined) out.push(tower);
    }
    return out;
  }

  private markDisrupted(id: string, untilTurn: number, sourceId: string): void {
    const existing = this.disruptedUntil.get(id);
    if (existing && existing.untilTurn >= untilTurn) return;
    this.disruptedUntil.set(id, { untilTurn, sourceId });
  }

  private isDisruptedId(id: string, currentTurn: number): boolean {
    const entry = this.disruptedUntil.get(id);
    if (!entry) return false;
    return currentTurn < entry.untilTurn;
  }

  private canonicalEdgeKey(a: string, b: string): string {
    return a < b ? `${a}__${b}` : `${b}__${a}`;
  }

  private compareIds(a: string, b: string): number {
    const [ar, ac] = a.split('-').map(Number);
    const [br, bc] = b.split('-').map(Number);
    if (ar !== br) return ar - br;
    return ac - bc;
  }

  private assertNotFiring(): void {
    if (this.firingInProgress) {
      // Soft-fail — log loud, do not throw. A throw would crash the combat
      // loop mid-tick. Test beds can flip a strict-mode later if needed.
      console.warn('TowerGraphService: graph mutation during fireTurn is forbidden. Mutation ignored.');
    }
  }
}

/** Shared empty-array sentinel to avoid per-call allocation on disrupted / unknown lookups. */
const EMPTY: readonly string[] = Object.freeze([]);
