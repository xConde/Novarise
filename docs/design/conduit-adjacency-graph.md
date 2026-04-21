# Tower Adjacency Graph — Design Spike (Conduit Phase)

**Status:** Design only. No implementation in this sprint.
**Sprint:** 40.5 (Phase 4 prep, archetype-depth plan).
**Consumers:** Conduit card phase (sprints 41–56).
**Author:** 2026-04-18, feat/archetype-depth branch.
**Predecessors:**
- `path-mutation-service.md` (sprint 8.5, Phase 2 prep).
- `elevation-model.md` (sprint 24.5, Phase 3 prep).

Same format, same discipline. Nothing is authored in sprint 41 until the
questions here have explicit answers.

---

> **⚠️ PARTIALLY SUPERSEDED (2026-04-18, session 3).** The original spike
> specified a per-tower `linkSlots` counter on `PlacedTower` and a
> `DEFAULT_LINK_SLOTS` constant, with ARCHITECT incrementing the slot
> count. Session-3 workstream B replaced that approach with
> **cluster-propagation semantics**: ARCHITECT now substitutes
> `clusterSize − 1` for the literal 4-dir neighbor count via
> `getEffectiveNeighborCount()` in `tower-combat.service.ts`, and the
> `linkSlots` field + constants were deleted (commit `970020a`).
>
> References to `linkSlots` / `DEFAULT_LINK_SLOTS` in §3, §5, §8, §15, §17
> below describe a design that was not shipped. Treat them as historical.
> The shipped implementation matches the "cluster propagation" alternative
> briefly discussed in §5, not the slot-counter approach.
>
> Everything else in this spike (TowerGraphService API shape, virtual-edge
> lifecycle, disruption model, checkpoint schema) remains accurate.

---

## 1. Problem statement

The Conduit archetype (plan sprints 41–56) requires **per-tower adjacency
state and per-cluster buff propagation**. Cards create between-tower effects
(HANDSHAKE, FORMATION, LINKWORK, HARMONIC, GRID_SURGE, CONDUIT_BRIDGE,
ARCHITECT, HIVE_MIND); relics read cluster size (CONSTELLATION +25% gold on
kill for 5+ connected towers); enemies attack adjacency (DISRUPTOR breaks
buffs in 2-tile radius; ISOLATOR severs one tower; DIVIDER boss halves on
damage and disrupts 1-tile radius per half).

Today the codebase has:

- **No adjacency tracking anywhere.** `grep -ri "adjacency\|TowerGraph"`
  across `src/` returns zero production hits — all matches are comments or
  tests for unrelated spatial features.
- **`PlacedTower` holds no neighbor data.** `tower.model.ts:80` defines the
  interface with row/col/level/kills/targetingMode plus optional fields
  (`muzzleFlashTimer?`, `placedAtTurn?`, `cardStatOverrides?`). No `links`,
  `neighbors`, `adjacency`, or `cluster` field.
- **`TowerCombatService.placedTowers`** is a `Map<string, PlacedTower>`
  keyed by `` `${row}-${col}` ``. Registration (line 116) and unregistration
  (line 529) are the only mutation surfaces. Firing order is deterministic
  (row, then col) — O(N log N) sort per fire tick.
- **`GameBoardTile` carries no tower-relationship state.** The Phase 3 red-
  team gate (Finding 1) demonstrated that every field on this record is a
  latent composition bug between services that share write access
  (`setTileType`, `placeTower`, `removeTower`, `setTileElevation`). Today's
  tile has `type`, `isTraversable`, `isPurchasable`, `cost`, `towerType`,
  `mutationOp`, `priorType`, `elevation`. No more new fields should land on
  it unless there is no peer-service alternative.
- **Tower firing multiplier stack is 8 multiplicative stages inline in
  `TowerCombatService.fireTurn`** (lines 288-298). Each stage was added
  atomically and unit-tested in isolation. There is no named pipeline, no
  shared function, no doc-comment listing the order. Conduit will add at
  least 2 more (HANDSHAKE +15%, HIVE_MIND cluster share, GRID_SURGE 2×
  conditional, plus FORMATION range additive — see §13). Phase 3 devil's
  advocate critique #2 flagged this explicitly as the next-blow-up surface.

Adjacency is a **new orthogonal dimension** on tower state, not on tile
state. This spike specifies a peer service (`TowerGraphService`), a
`PlacedTower`-hosted link-slot contract, rebuild cadence, buff-propagation
semantics, and the mandatory `composeDamageStack()` refactor that must
land before any Conduit card code opens.

## 2. Non-goals

- **No extension of `TerrainGrid` or the editor.** Adjacency is
  gameplay-only — a Conduit buff does not reshape editor tile data.
- **No new `GameBoardTile` fields.** Phase 3 Finding 1 is the load-bearing
  postmortem here. See §4.
- **No extension of `PathMutationService` or `ElevationService` APIs.**
  Adjacency is orthogonal to terraform and elevation. Composition at the
  `PlacedTower` + `TowerGraphService` layer — never on the tile.
- **No replacement of `TowerCombatService.placedTowers` as the authoritative
  tower registry.** The graph service is a *derived* view keyed by position
  pairs; `placedTowers` remains the source of truth.
- **No rework of `SpatialGrid`.** Enemies still query towers by world
  distance. Adjacency is a tower↔tower concern, not a tower↔enemy concern.
- **No mid-fire graph queries.** `fireTurn` reads a **precomputed**
  per-tower adjacency snapshot (see §7). Graph mutation during a fire tick
  is forbidden — prevents order-dependent multiplier inconsistencies.
- **No 3-D link ribbons / beam meshes in sprint 42 MVP.** Thin `THREE.Line`
  geometry between adjacent towers, shared material. Polish deferred to
  sprint 55.

## 3. Scope

### In-scope data (Conduit)

| State | Shape | Owner | Serialized? |
|---|---|---|---|
| Tower position | `row`, `col` on `PlacedTower` | `TowerCombatService.placedTowers` | yes (v8+) |
| Link-slot count | `linkSlots?: number` on `PlacedTower` | `PlacedTower` (set at placement, mutated by ARCHITECT) | **see §9 — default NO** |
| Active neighbor set | `Map<towerId, Set<towerId>>` | `TowerGraphService` (derived) | **no** — rebuilt on mutation |
| Connected cluster | Disjoint-set over `placedTowers.keys()` | `TowerGraphService` (derived) | no — rebuilt on mutation |
| Buff propagation state | Per-tower aggregate (see §8) | `TowerGraphService` | no — recomputed per fire tick |

### In-scope ops (sprint 41)

| Op | Trigger | Effect |
|---|---|---|
| `registerTower(tower)` | Tower placement | Insert into graph; recompute affected neighbors. |
| `unregisterTower(key)` | Tower sell / destroy / ISOLATOR elite target | Remove from graph; recompute neighbors of former neighbors. |
| `getNeighbors(row, col)` | Per-tower in `composeDamageStack` | Return cached neighbor set (O(1) lookup). |
| `getClusterSize(row, col)` | Relic + card queries (CONSTELLATION, HIVE_MIND) | Return cached cluster size. |
| `getClusterTowers(row, col)` | HIVE_MIND share-pool read | Return tower IDs in the same cluster. |
| `rebuild()` | Internal — called on register / unregister only | Re-derive entire graph. |
| `reset()` | Encounter teardown | Clear. |
| `serialize()` / `restore()` | Checkpoint lifecycle | **No-op by default** — graph is derived from towers. See §9. |

### In-scope lifecycle responsibilities

- Tower registration hook — `TowerCombatService.registerTower` calls
  `towerGraphService.registerTower(tower)` after the `placedTowers.set`.
- Tower unregistration hook — `TowerCombatService.unregisterTower` calls
  `towerGraphService.unregisterTower(key)` after the `placedTowers.delete`.
- Graph-derived read in `composeDamageStack(tower, ctx)` — see §12.
- DISRUPTOR / ISOLATOR disruption hook — `TowerGraphService.disruptRadius`
  or `severTower` (sprint 53 / 54; API sketched §5).
- Link-mesh lifecycle — see §10; owned by a `LinkMeshService` (sprint 42).
- Restore — no adjacency restore step; the graph is re-derived as towers
  re-register in Step 4 of the `restoreFromCheckpoint` coordinator.

### Out-of-scope (tracked elsewhere)

- Aura-orb InstancedMesh pulse animation — sprint 55 polish.
- DIVIDER boss split-and-radius-disrupt (sprint 55) — uses
  `TowerGraphService.disruptRadius`; no new graph surface needed beyond
  what sprints 53/54 introduce.
- CONDUIT_BRIDGE (sprint 48) — virtual adjacency between two non-adjacent
  towers for 3 turns. Uses a **virtual edge overlay** (§5) — separate from
  the spatial-adjacency set.
- Balance numbers — sprint 79.

## 4. Why link state lives on `PlacedTower`, not `GameBoardTile`

Phase 3 Finding 1 demonstrated the cost of sharing a mutable record between
services that don't coordinate writes. Recap:

> `GameBoardService.setTileType` constructed replacement tiles via
> `createMutated(x, y, type, priorType, op)`, which did not accept elevation.
> Every path mutation (build/block/destroy/bridgehead) silently wiped
> elevation on an elevated tile. Every per-sprint unit spec passed. Only
> the sprint-40 integration spec composed the two services and caught it.

The next-iteration lesson is not "write more integration specs" — it's
**"stop putting orthogonal state on the same record."** Four write paths
today churn `GameBoardTile`:

1. `setTileType(row, col, type, op, priorType)` — path mutation.
2. `placeTower(row, col, type)` — tower placement.
3. `removeTower(row, col)` — tower removal.
4. `setTileElevation(row, col, elevation)` — elevation mutation.

Every one of those reconstructs a tile via a factory (`createBase`,
`createWall`, `createMutated`, clone-with-`withElevation`). Every reconstruction
is a line-of-code audit for "did you pass through every existing field?"
Adding `linkSlot` to `GameBoardTile` would require reviewing each of those
four writers AND every future writer to confirm `linkSlot` is preserved.
Sprint 41-56 ship 8 cards + 2 relics + 3 enemies + 1 boss. The cost of a
silent strip is buff-propagation inconsistency (cluster misreads its size by
one, CONSTELLATION gold misfires, HIVE_MIND shares to the wrong pool) with
no visual symptom — the hardest class of bug to triage.

### Decision (locked)

- **Link-slot capacity** (ARCHITECT rare grants +1 link slot per tower)
  lives on `PlacedTower` as `linkSlots?: number`. `undefined` means "no
  explicit cap, use default" (default 4 = one per 4-dir neighbor).
- **Active neighbor set** is NOT stored on `PlacedTower`. It is derived on
  every `registerTower` / `unregisterTower` by `TowerGraphService`. Storing
  it on `PlacedTower` would reintroduce the same write-contention problem
  — 3+ writers mutating an array member without coordinating.
- **Virtual links** (CONDUIT_BRIDGE) live in a separate
  `TowerGraphService.virtualEdges: Map<turnNumber_expiry, Edge[]>` overlay
  that `getNeighbors` unions in at read time. Not on the tower.
- **Disruption state** (DISRUPTOR 2-tile radius, ISOLATOR targeted sever,
  DIVIDER boss 1-tile per-half) lives on `TowerGraphService` as a
  per-tower `disruptedUntilTurn?: Map<towerId, turn>`. Not on the tower
  record — again, single-writer discipline.

`PlacedTower` adds **at most one optional field** (`linkSlots?: number`),
and only if ARCHITECT's capacity mechanic requires it beyond the static
default. If the default "4 slots, one per 4-dir neighbor" survives playtest,
the field isn't needed at all — `linkSlots === undefined` everywhere and
`TowerGraphService` applies the constant default.

This overrides any design voice that argues "adjacency is a board-level
concept, put it on the tile." It is not a board concept. It is a tower-
relationship concept. Board tiles are the substrate; towers are the nodes;
graph edges belong on neither.

## 5. Service surface

```ts
// src/app/game/game-board/services/tower-graph.service.ts
// Scope: component-scoped (provided on GameBoardComponent alongside
// BoardMeshRegistryService, PathfindingService, ElevationService).
// NOT providedIn: 'root' — state is per-encounter, must be discarded on
// /play navigation. Same discipline as ElevationService + PathMutationService.

export interface TowerGraphEdge {
  readonly a: string;                   // tower id (matches PlacedTower.id)
  readonly b: string;
  readonly kind: 'spatial' | 'virtual'; // spatial = grid-adjacent; virtual = CONDUIT_BRIDGE
  readonly expiresOnTurn?: number;      // virtual edges only; undefined = never
}

export interface TowerCluster {
  readonly id: number;                  // stable within a rebuild; do NOT persist
  readonly towerIds: readonly string[]; // sorted by row, then col (deterministic)
  readonly size: number;
}

@Injectable()
export class TowerGraphService {
  // --- Lifecycle hooks (called by TowerCombatService) ---
  registerTower(tower: PlacedTower): void;
  unregisterTower(key: string): void;     // key = `${row}-${col}`; reverse-lookup to id internally

  // --- Virtual overlay (CONDUIT_BRIDGE) ---
  addVirtualEdge(aRow: number, aCol: number, bRow: number, bCol: number, expiresOnTurn: number, sourceId: string): void;

  // --- Disruption (DISRUPTOR / ISOLATOR / DIVIDER) ---
  /**
   * Mark all towers within `radiusTiles` of (row, col) as disrupted until
   * turn `untilTurn`. A disrupted tower contributes 0 neighbors to
   * `getNeighbors` / `getClusterSize` / `getClusterTowers` until expiry.
   * Per-tower latest-wins; re-calls extend if greater.
   */
  disruptRadius(row: number, col: number, radiusTiles: number, untilTurn: number, sourceId: string): void;

  /** Severs a specific tower's neighbors until turn — ISOLATOR target behavior. */
  severTower(row: number, col: number, untilTurn: number, sourceId: string): void;

  // --- Query (read by composeDamageStack + card/relic handlers) ---
  getNeighbors(row: number, col: number): readonly string[];          // tower ids
  getClusterSize(row: number, col: number): number;                    // 1 = isolated (just self)
  getClusterTowers(row: number, col: number): readonly string[];       // tower ids including self
  isDisrupted(row: number, col: number, currentTurn: number): boolean;

  // --- Per-turn lifecycle ---
  tickTurn(currentTurn: number): void;    // expires virtual edges + disruption entries

  // --- Encounter lifecycle ---
  reset(): void;

  // --- Persistence (no-op by default — see §9) ---
  serialize(): SerializableTowerGraphState;
  restore(snapshot: SerializableTowerGraphState): void;
}
```

### Register / unregister flow

1. `TowerCombatService.registerTower(row, col, type, turnNumber)` creates
   the `PlacedTower`, stores in `placedTowers`.
2. After the `.set()`, calls `towerGraphService.registerTower(tower)`.
3. `TowerGraphService` computes the tower's 4-dir neighbors **by scanning
   `placedTowers` for occupied (row±1, col) and (row, col±1)**. O(1)
   lookups via the caller-supplied `placedTowers` getter.
4. Updates its own neighbor map (add edge a→b and b→a).
5. Recomputes the cluster containing the new tower (union-find merge — new
   tower brings its 4 existing-neighbor clusters together).
6. Returns — the graph is now consistent with `placedTowers`.

Unregister is the mirror: remove from neighbor sets, rebuild clusters
touching the removed tower's former neighbors. Union-find does not support
cheap splits — the simplest correct implementation is to re-run a BFS
restricted to the subgraph reachable from each former neighbor. For <50
towers the BFS cost is trivial (see §7 perf).

## 6. 4-direction vs 8-direction — decision

Plan doc §archetype-3: *"8-direction or 4-direction (design call in sprint
41; recommend 4-direction for clarity)."* **Locking 4-direction.**

Rationale:

1. **Visual legibility.** 4-dir adjacency = the tower's cardinal neighbors.
   A player instantly sees "this tower is linked to those three." With
   8-dir (diagonals), two towers in a corner-touch relationship read as
   unlinked to most players but the game treats them as linked. FORMATION
   (row of 3+) only reads naturally with orthogonal rows; diagonal "rows"
   of 3 feel arbitrary.
2. **DISRUPTOR / ISOLATOR radius consistency.** DISRUPTOR's 2-tile radius
   is a Chebyshev or Manhattan query. 4-dir graph + Manhattan (taxicab)
   radius is a clean pair. 8-dir + Chebyshev works too but couples two
   distance conventions in the same archetype.
3. **Perf.** 4 neighbor lookups per register vs 8. Negligible either way,
   but the code-path branching is shorter.
4. **Precedent.** Pathfinding is 4-dir (enemy movement). Same convention
   everywhere on the board. 8-dir would be a mental-model fork.

**Chebyshev vs Manhattan for disruption radius:** use **Manhattan**
(`|dr|+|dc| ≤ radius`). Matches 4-dir graph semantics. DISRUPTOR at
(5, 5) with radius 2 hits (3, 5), (4, 4), (4, 5), (4, 6), (5, 3), (5, 4),
(5, 5), (5, 6), (5, 7), (6, 4), (6, 5), (6, 6), (7, 5). Diamond, not
square. Document in DISRUPTOR card copy.

**Future-flag:** if playtest reveals 4-dir clusters are too hard to form
(Conduit decks can't reach 5+ cluster size for CONSTELLATION), the knob to
relax is CONSTELLATION's threshold (4+ instead of 5+), not the adjacency
definition. Do not retrofit diagonals.

## 7. Rebuild cadence + perf budget

### Cadence

Graph rebuilds happen on **two triggers and only two**:

1. `registerTower` — incremental: add the new tower, add edges to its ≤4
   occupied neighbors, union the new tower's cluster with each neighbor's.
2. `unregisterTower` — incremental: remove edges to the ≤4 former neighbors,
   re-BFS to rebuild cluster membership for each former-neighbor
   subgraph (handles graph splits).

**Not on:**
- Fire tick — `getNeighbors` reads the cached state; must never call
  `rebuild` on a fire-tick path.
- Turn tick — virtual edges and disruption expire in `tickTurn`, which
  runs two operations: drop expired `virtualEdges` entries; drop expired
  `disruptedUntil` entries. Cluster membership may change (a disruption
  ending re-exposes a tower to its cluster) — `tickTurn` rebuilds only
  the clusters containing the affected towers, not the whole graph.
- Path mutation — building a BASE over a WALL does not add a tower; the
  adjacency graph is unchanged.
- Elevation change — elevation does not affect adjacency.

### Virtual edge expiry

`CONDUIT_BRIDGE` creates a virtual edge with `expiresOnTurn = currentTurn + 3`.
`tickTurn(currentTurn)` iterates the `virtualEdges` map, drops entries
where `expiresOnTurn === currentTurn`, and for each dropped edge re-BFSs
the cluster of its endpoints (the edge may have been load-bearing for
cluster connectivity).

### Disruption expiry

Per-tower `disruptedUntil: Map<towerId, turn>`. `tickTurn` drops entries
where `value === currentTurn`. A disrupted tower reads as having zero
neighbors AND is excluded from its cluster during disruption. On expiry,
re-BFS the cluster containing the formerly-disrupted tower.

### Perf budget

- 20 towers on the board is the realistic upper bound for an encounter
  (map footprint ≤ 500 tiles, tower placement is gold-gated, most runs
  don't exceed 12-15).
- 4-dir neighbor scan: ≤ 4 `Map.get` lookups per register.
- Cluster BFS worst-case: 20 towers × 4 edges each = 80 edge traversals
  per split. Dominant factor is `Map.get` — O(80) per unregister.
- Graph read (fire tick): per-tower `getNeighbors` is a `Map.get` returning
  a `Set` → O(1).

Total `fireTurn` cost attributable to graph reads: 20 towers × 3 graph
queries per tower (neighbors, clusterSize, isDisrupted) = 60 O(1) Map
lookups per tick. **Target: graph contribution < 0.2ms/fire.** Sprint 41
perf spec asserts < 0.5ms wall-time for the three queries across a 20-tower
board. If the budget is blown, the reserve is a per-tower cache
(invalidated on register/unregister/tickTurn), not an algorithm change.

## 8. Buff propagation semantics — pick ONE

Three models exist for "tower A's Link buff affects A's neighbors." The
spike must pick ONE and stick with it — mixing models is how Conduit
becomes a bug swamp.

### Model A: Push-from-source (stored on source, read at target's fire time)

Each Link card writes its buff to the **source** tower's `activeBuffs`
list. When the target fires, `composeDamageStack` queries the graph for
the target's neighbors and aggregates each neighbor's source-side buffs
that target "all neighbors."

- ✅ Single source of truth (the originating tower's buff list).
- ✅ Natural fit for HANDSHAKE ("tower + 1 adjacent +15%") — the SOURCE
  tower gets +15% if it has ≥1 neighbor; the neighbor gets +15% if its
  neighbor set includes the source.
- ❌ Target-side reads are O(neighbors × source_buffs) per fire tick.
- ❌ "Cluster share" (HIVE_MIND: all in cluster share dmg/range/firerate)
  needs a per-cluster aggregate separate from per-neighbor — forces two
  paths.

### Model B: Pull-at-targets (stored on target's aggregate)

Each Link card pushes buffs onto the **target** tower's buff list at apply
time. When the target fires, `composeDamageStack` reads the target's own
buff list — no graph walk.

- ✅ Fastest fire-tick read (already-aggregated).
- ❌ Graph mutation (tower placed, tower sold, DISRUPTOR radius in/out)
  requires re-applying every active Link card to every affected target.
  Every card needs an "on graph change" reapply hook — 8 cards × N graph
  mutations per encounter × 20 towers = expensive bookkeeping path.
- ❌ Serialization: the aggregate is derived state but feels primary,
  inviting saves that drift from the card source-of-truth.

### Model C: Aggregate-per-tower (recomputed each fire tick) ← **chosen**

Each Link card writes its **intent** (buff spec + source + expiry) to
`CardEffectService.activeModifiers` as today. `TowerGraphService` exposes
`getLinkEligibleTowers(sourceId, card)` — given a source tower and a
card's adjacency predicate, return the set of towers that should receive
the buff. `composeDamageStack(tower, ctx)` walks `activeModifiers`, asks
each Conduit modifier "does this tower receive you?", and aggregates.

- ✅ Card source-of-truth is the modifier list (already serialized,
  already expires via `tickWave` / card-effect lifecycle).
- ✅ Graph mutation is transparent — next fire tick reads current graph
  state via `getLinkEligibleTowers`; no per-card reapply needed.
- ✅ HIVE_MIND "share in cluster" is a `getClusterTowers(tower)` call per
  fire tick — natural with Model C.
- ✅ DISRUPTOR / ISOLATOR transparent — disrupted tower's
  `getLinkEligibleTowers` membership drops to zero automatically.
- ❌ Fire-tick cost is O(active_conduit_modifiers) per tower. At realistic
  scale (≤ 5 active Conduit modifiers × 20 towers × graph check per pair
  = 100 O(1) lookups) = negligible. Budgeted in §7.

**Decision: Model C.** Each Conduit card registers a `ConduitModifier`
spec (see §12). The graph is consulted per-tower per-fire-tick.
Propagation is stateless.

### Rejected: Model D — "cluster-level aggregate cached per tick"

Cache a per-cluster aggregate in `TowerGraphService` state, recomputed at
top of `fireTurn`. Saves `O(active_conduit_modifiers)` lookups per tower
but doubles the state surface (now the graph holds per-cluster buff
bundles, which are derived from `CardEffectService`). Not worth the split
ownership for <1ms/tick savings.

## 9. Checkpoint decision — default NO v10 bump

`CHECKPOINT_VERSION = 9` today. The question: does Conduit need a bump to
10?

### Default answer: NO.

The graph is **entirely derivable from `PlacedTower` positions + active
`CardEffectService` modifiers + the `TowerGraphService`'s per-turn state
(virtual edges with `expiresOnTurn`, disruption `disruptedUntilTurn`).**

Restore flow after an encounter reload:

1. Step 4 of the 19-step `restoreFromCheckpoint` coordinator restores
   `placedTowers` via `TowerCombatService.restorePlacedTowers` (existing).
2. **New Step 4.5** — after tower restore, call
   `this.towerGraphService.rebuild()`. This is a single full-graph rebuild:
   iterate `placedTowers`, compute edges, compute clusters. Cost: ~80
   lookups, under 0.1ms.
3. Active `CardEffectService` modifiers are already restored (v7+ field).
   Conduit buffs re-read via Model C on the next fire tick.

This means **checkpoint v9 is sufficient for all of sprints 41-51**.

### Where a bump becomes necessary

A v10 bump is required if, and only if, Conduit introduces state on
`TowerGraphService` that is:

(a) NOT derivable from `placedTowers`, AND
(b) NOT derivable from `CardEffectService.activeModifiers`, AND
(c) Must survive a mid-wave save/restore cycle without loss.

Candidates that would force a bump:

- **Virtual edges with turns remaining.** CONDUIT_BRIDGE (sprint 48) adds
  an edge for 3 turns. If a player saves turn 2 after a sprint-48 play,
  and resumes, the virtual edge must survive or the buff inconsistency
  surfaces as "my CONDUIT_BRIDGE-enabled tower lost its buff mid-cycle
  with no card-tooltip cue."
- **Disruption entries with turns remaining.** DISRUPTOR's 2-tile radius
  disruption doesn't live on the DISRUPTOR enemy (enemy dies, disruption
  persists for its buff duration). Same survive-save argument.

**Decision: defer v10 to sprint 48.** Sprints 41-47 ship without
`TowerGraphService` persistence (graph is purely derived). Sprint 48
(CONDUIT_BRIDGE) bumps to v10 and adds `virtualEdges` + `disruptedUntil`
to `SerializableTowerGraphState`. Sprints 49-51 land on v10. Sprints
53-54 (DISRUPTOR, ISOLATOR) reuse the v10 `disruptedUntil` field — no
second bump.

### v9 → v10 migration sketch (sprint 48)

```ts
// v9 → v10: inject empty tower-graph state
{
  fromVersion: 9,
  migrate: (c: any) => ({
    ...c,
    towerGraph: { virtualEdges: [], disruptedUntil: [] },
  }),
},
```

Mirror the v8 → v9 migration pattern (elevation-model.md §9). No tower
field changes — `PlacedTower.linkSlots?` is optional, v9 saves without
it still round-trip through the existing `SerializablePlacedTower`
serializer which `...spreads` the tower (undefined fields vanish).

### What MUST NOT be persisted

- Active neighbor sets (derive from positions).
- Cluster membership (derive).
- Per-tower aggregated buffs (derive from modifiers + graph).

Storing any of these is strictly worse than deriving — it's another write-
contention source for no save-size benefit (the graph is small enough that
rebuild is faster than deserialization).

## 10. Link-mesh disposal contract

Phase 3 devil's advocate critique #3 predicts cliff-mesh-class leaks for
links:

> LinkMeshService (or wherever adjacency lines live) will create a
> THREE.Line per link, a shared material per link type, and an
> InstancedMesh for aura orbs. Three sources of disposal: (a) on tower
> unregister, (b) on GameSessionService.cleanupScene, (c) on encounter
> restart. Every cliff-mesh bug from Phase 3 will replay on links.

### The lifecycle contract

Link meshes have **exactly one owner**: `LinkMeshService` (new, sprint 42,
component-scoped on `GameBoardComponent.providers`). No other service
creates or disposes `THREE.Line` instances that represent tower links.

Four trigger paths, all funneled through `LinkMeshService`:

1. **Edge added** (`TowerGraphService.registerTower` surfaces new spatial
   edges; `addVirtualEdge` adds virtual edges). `TowerGraphService` emits
   an `edgesAdded$` observable (or accepts an injected callback — see
   below). `LinkMeshService` subscribes and creates `THREE.Line` meshes.
2. **Edge removed** (`unregisterTower`, `tickTurn` virtual-edge expiry,
   disruption start). `edgesRemoved$` observable. `LinkMeshService`
   disposes line geometries.
3. **Encounter teardown** (`GameSessionService.cleanupScene`).
   `LinkMeshService.dispose()` — iterate remaining lines, geometry.dispose(),
   remove from scene. Shared material disposed exactly once here.
4. **Encounter restart** (same trigger as teardown, followed by fresh
   component init).

### Pattern choice: dedicated owner over generic `MeshResourceTracker`

Phase 3 DA proposed a generic `Three.jsResourceTracker` base class for
every primitive to implement. **Rejected** for Phase 4. Rationale:

- `TerraformMaterialPoolService` and (pending) cliff-mesh service are
  dedicated owners — the pattern of "one service owns one mesh type's
  full lifecycle" is already load-bearing in Phase 2 and Phase 3.
- A generic tracker forces every service into a shared API surface
  (`track`, `untrack`, `disposeAll`) that adds no correctness the dedicated
  owners don't already have.
- Cliff meshes in Phase 3 were NOT leaked at QA time — the coupling across
  3 services was called out as a *fragility*, not a bug. The solution the
  Phase 3 close recommended was a dedicated `CliffMeshService`, not a
  generic tracker. Same solution applies to links.

**Locked: `LinkMeshService` is a dedicated owner**, same pattern as the
recommended (deferred) `CliffMeshService`. If sprint 77 polish consolidates
both under a shared base class, that's a refactor — not the sprint 42
primary design.

### Disposal-audit spec (sprint 56 QA)

Phase 3 DA also recommended a `renderer.info.memory.geometries` before/after
an encounter-cycle spec. Sprint 56 picks this up for both Phase 3 cliff
meshes AND Phase 4 link meshes. Single spec, two asserts:

```ts
// sprint-56 qa spec
it('no Three.js geometry/material leak across full encounter cycle', () => {
  const renderer = gameSessionService.getRenderer();
  const baselineGeos = renderer.info.memory.geometries;
  const baselineMats = renderer.info.memory.materials;
  // full lifecycle: place 5 towers, link them, DISRUPTOR proc, unlink,
  // sell all, reset encounter
  runEncounterLifecycle();
  expect(renderer.info.memory.geometries).toBe(baselineGeos);
  expect(renderer.info.memory.materials).toBe(baselineMats);
});
```

## 11. Cache-invalidation split rule — link graph changes NEVER invalidate
pathfinding

From `path-mutation-service.md` §11: *"every path mutation invalidates."*
From `elevation-model.md` §11: *"elevation changes do NOT invalidate the
pathfinding cache."*

**For adjacency: link graph changes do NOT invalidate the pathfinding
cache.** Rationale:

- `PathfindingService.findPath` reads `tile.isTraversable` and `tile.type`.
  Link edges are between towers, not tiles. Enemies path around towers
  (tower tiles are non-traversable); the link graph layered on top of
  towers does not change tile traversability.
- HANDSHAKE, FORMATION, LINKWORK, HARMONIC, GRID_SURGE, HIVE_MIND all
  leave tower positions unchanged. No enemy-repath trigger.
- CONDUIT_BRIDGE (virtual edges) mutates the graph only — no tile / tower
  position change.
- DISRUPTOR (sprint 53) 2-tile-radius disruption affects the graph; enemy
  movement is untouched. DISRUPTOR enemy pathing is standard — it's a
  moving enemy, its presence radius is a buff-disruption query.

**The ONE composite case:** a hypothetical card that places a tower AND
links it simultaneously. Place routes through
`TowerPlacementService.tryPlaceTower` (which invalidates the pathfinding
cache — existing behavior). Link is then `TowerGraphService.registerTower`
(which does NOT invalidate). Both calls are idempotent with respect to
cache state — the first invalidates, the second is a no-op on cache. No
coordination needed.

**Future-flag:** if a sprint ever introduces a card like `LINK_BARRIER`
that creates an invisible wall between two linked towers for enemies to
path around, that card must route through `PathMutationService` for the
traversability side. Link graph does its own thing.

## 12. Tower-combat integration — `composeDamageStack()` refactor

### The existing 8-stage stack (tower-combat.service.ts:288-298)

```ts
this.scratchStats.damage = Math.round(
  baseStats.damage
    * towerDamageMultiplier     // 1: game modifier (difficulty)
    * relicDamage               // 2: per-type relic bonus
    * (1 + cardDamageBoost)     // 3: MODIFIER_STAT.DAMAGE (wave-scoped)
    * sniperBoost               // 4: MODIFIER_STAT.SNIPER_DAMAGE (SNIPER-only)
    * cardDamageMult            // 5: cardStatOverrides.damageMultiplier (per-tower)
    * pathLengthMultiplier      // 6: LABYRINTH_MIND (path-length scaling)
    * vantagePointDmgMult       // 7: VANTAGE_POINT (elevation ≥ 1)
    * kothMult,                 // 8: KING_OF_THE_HILL (elevation === max)
);
```

Range stack (lines 299):
```ts
this.scratchStats.range = baseStats.range
  * relicRange
  * (1 + cardRangeBoost)
  * cardRangeMult
  * elevationRangeMult          // passive: 1 + elev × 0.25
  * highPerchMult;              // HIGH_PERCH conditional (elev ≥ 2)
```

### The refactor (ships BEFORE sprint 41 card code)

Extract both stacks into a single function with explicit named stages:

```ts
// src/app/game/game-board/services/tower-combat.service.ts
//
// composeDamageStack — single source of truth for the per-tower
// damage + range multiplier composition. Every new Phase 4+ Conduit
// multiplier adds ONE new stage here, commented, in a visible chain.
//
// Ordering rule: additive-to-base bonuses apply FIRST (inside the
// base × (1 + bonus) parentheses); multiplicative modifiers stack
// AFTER. See §13 for FORMATION specifically.
private composeDamageStack(
  tower: PlacedTower,
  baseStats: TowerStats,
  ctx: DamageStackContext,
): { damage: number; range: number } {
  // ── Per-tower reads (elevation, graph, card overrides) ──────────
  const towerElevation = ctx.hasElevation
    ? this.elevationService!.getElevation(tower.row, tower.col)
    : 0;
  // Stage 7 (damage) + stage 5 (range) — elevation
  // Stage N (damage) + stage N (range) — Conduit graph (sprint 41+)
  // ...

  // ── Range composition ─────────────────────────────────────────
  // (keep the existing 6 stages, add Conduit's FORMATION additive
  // INSIDE the (base + additive) parentheses; multiplier-kind stages
  // stay at the outer product.)
  const rangeAdditive = 0 /* + formationRangeAdditive (sprint 44) */;
  const rangeMultipliers = [
    ctx.relicRange(tower.type),
    1 + ctx.cardRangeBoost,
    tower.cardStatOverrides?.rangeMultiplier ?? 1,
    1 + towerElevation * ELEVATION_CONFIG.RANGE_BONUS_PER_ELEVATION,
    /* highPerchMult */ ...,
    /* conduit spatial multipliers */ ...,
  ];
  const range = (baseStats.range + rangeAdditive) *
    rangeMultipliers.reduce((a, b) => a * b, 1);

  // ── Damage composition ────────────────────────────────────────
  // 8 existing stages + Conduit:
  //   9: HANDSHAKE +15% if ≥1 neighbor and card active
  //   10: HARMONIC +X% if tower is in an active HARMONIC set
  //   11: GRID_SURGE ×2 if tower has ≥4 neighbors and surge active
  //   12: HIVE_MIND shared-pool multiplier from cluster aggregate
  const conduitDamageMults = this.towerGraphService != null
    ? ctx.conduitDamageMultipliers(tower)  // returns number[] — see ConduitModifier api
    : [];
  const damageMultipliers = [
    ctx.towerDamageMultiplier,
    ctx.relicDamage(tower.type),
    1 + ctx.cardDamageBoost,
    tower.type === TowerType.SNIPER && ctx.sniperDamageBoost !== 0
      ? 1 + ctx.sniperDamageBoost
      : 1,
    tower.cardStatOverrides?.damageMultiplier ?? 1,
    ctx.pathLengthMultiplier,
    /* vantagePointDmgMult */ ...,
    /* kothMult */ ...,
    ...conduitDamageMults,
  ];
  const damage = Math.round(baseStats.damage *
    damageMultipliers.reduce((a, b) => a * b, 1));

  return { damage, range };
}

// DamageStackContext: readonly bundle passed from fireTurn — avoids
// 12-argument constructor tax on composeDamageStack. All context values
// are computed once per fireTurn call; composeDamageStack is called
// per-tower.
export interface DamageStackContext {
  readonly towerDamageMultiplier: number;
  readonly relicDamage: (type: TowerType) => number;
  readonly relicRange: (type: TowerType) => number;
  readonly cardDamageBoost: number;
  readonly cardRangeBoost: number;
  readonly sniperDamageBoost: number;
  readonly pathLengthMultiplier: number;
  readonly hasElevation: boolean;
  readonly maxElevation: number;
  readonly highPerchBonus: number;
  readonly vantagePointBonus: number;
  readonly kothBonus: number;
  readonly kothActive: boolean;
  /** Returns 0..N Conduit damage multipliers for this tower, empty if no Conduit graph state. */
  readonly conduitDamageMultipliers: (tower: PlacedTower) => readonly number[];
}
```

### Why the refactor must land before sprint 41

- Sprint 41 is primitives-only (TowerGraphService + LinkMeshService; no
  cards). If the refactor waits until sprint 43 (HANDSHAKE), the refactor
  becomes "rewrite fireTurn AND add a card" — two concerns in one sprint
  against two weeks of regression surface.
- Phase 3 added two multipliers (VP, KOTH) inline. Phase 4 Conduit will
  add 2-4 more. Each atomic add grows the inline chain; no sprint
  prioritizes "just refactor the stack" unless it's scheduled explicitly.
- The refactor is not hypothetical: the named stages in the extracted
  function are the same expressions, with the same multiplicands, in the
  same order. Unit specs for `fireTurn` do not change. This is safe as a
  pre-sprint-41 commit.

### TITAN formula (sprint 38 carryover)

`TowerCombatService.applyTitanAdjustment` (existing — tower-combat.service.ts
~line 670-720) reads `towerVantagePointDmgMult` and `towerKothMult` as the
"elevation-origin" multiplier set. Phase 3 DA critique #2 noted this is
an inlined special case that will silently exclude future elevation
bonuses. `composeDamageStack` does not fix TITAN's formula — fix is
sprint 79. But the refactor makes the set visible: the extracted damage
multipliers array is the authoritative list; TITAN's formula becomes
"half-off the elevation-origin members of that list." The set is named,
callable, and testable.

## 13. FORMATION additive-vs-multiplicative ordering rule

Plan doc §archetype-44: `FORMATION (C, 1E) — towers in a row of 3+ gain
+1 range.`

### The ambiguity

A tower at elevation 2 (×1.5 range) + HIGH_PERCH active (×1.25 range).
Base range = 3 tiles. If FORMATION adds +1 tile:

- **Additive-before-multiplicative (additive-to-base):**
  `(3 + 1) × 1.5 × 1.25 = 7.5 tiles.`
- **Multiplicative-after-additive-at-outer:**
  `3 × 1.5 × 1.25 + 1 = 6.625 tiles.`

### Decision (locked)

**Additive-to-base.** FORMATION's +1 joins the base stat inside the
multiplier chain's inner parentheses. Formula:

```
range = (baseStats.range + Σ(additive bonuses)) × Π(multiplicative bonuses)
```

Rationale:

1. **Matches player mental model.** "Towers in a row gain +1 range" reads
   as "the tower's base range is now 4." A multiplier reads "1.5×". The
   tile is literal; the multiplier is proportional. Player narration
   compounds additives first.
2. **Matches existing precedent.** The damage stack already uses `1 + X`
   for additive-kind bonuses (`cardDamageBoost`, `sniperDamageBoost`).
   Adding an integer tile to range maps to the same convention: the
   additive is inside the parenthesis, multipliers chain outside.
3. **Avoids elevation-dependent-range-feeling-wrong.** Under
   multiplicative-at-outer, a flat-elevation tower gains +1 (to 4) but an
   elevated tower gains +1 at base and then loses the additive's value as
   it's outside the multiplier — the FORMATION card would feel weaker on
   elevated towers than flat, which is the opposite of Conduit-Highground
   synergy design intent.

### Regression spec (sprint 41 test fixture, runs before FORMATION lands
sprint 44)

```ts
describe('composeDamageStack — additive-before-multiplicative ordering', () => {
  it('applies additive range bonus inside the (base + additive) parenthesis', () => {
    // Tower: BASIC, range 3, elevation 2 (×1.5), HIGH_PERCH active (×1.25).
    // Synthetic rangeAdditive = 1 (mimics FORMATION).
    const result = service.composeDamageStack(tower, baseStats, {
      ...ctx,
      rangeAdditive: 1,  // injected for test — real FORMATION hooks in sprint 44
    });
    expect(result.range).toBeCloseTo((3 + 1) * 1.5 * 1.25, 5);
    expect(result.range).not.toBeCloseTo(3 * 1.5 * 1.25 + 1, 5);
  });
});
```

Spec lands with the refactor, not with sprint 44. Prevents
FORMATION-authors from picking the wrong convention when they ship the
card.

## 14. Failure modes

| Failure | Symptom | Mitigation |
|---|---|---|
| Tower placed but graph not updated (e.g., `registerTower` called on `placedTowers.set` but `towerGraphService.registerTower` forgotten). | HANDSHAKE never procs; CONSTELLATION gold never fires. Silent failure. | Unit spec: `registerTower` → graph contains tower. Integration spec: place two adjacent towers → both report each other as neighbors. |
| Tower sold but graph still references it — dangling edge. | Cluster reports size 3 but actually 2. CONSTELLATION fires incorrectly. | `unregisterTower` removes both sides of each edge. Spec: sell tower → former neighbors' neighbor sets no longer include removed id. |
| Virtual edge expired but cluster still merged. | CONDUIT_BRIDGE lingers past 3 turns. | `tickTurn(currentTurn)` iterates virtualEdges and re-BFSs affected clusters on drop. Spec: add virtual edge expiring turn 5, advance to turn 5 → cluster split. |
| Graph rebuild during fire tick (e.g., card plays mid-resolveTurn that places tower). | Damage multiplier read against a stale neighbor set OR a half-built one. | Cards cannot place towers during combat resolution — card plays open only in turn prelude. Document the invariant. Runtime assertion in `fireTurn`: `expect(!this.towerGraphService.rebuilding)`. |
| DISRUPTOR dies but disruption persists — player can't tell why their buff is absent. | Loss-of-buff feels like a bug. | DISRUPTOR's disruption duration is a public stat on the enemy type (ENEMY_STATS). Tooltip surfaces it. `tickTurn` expires entries visibly (log + aria-live announcement). |
| Player saves mid-turn with active CONDUIT_BRIDGE (v9); load restores without the virtual edge. | Buff ghost-extends into next turn without the supporting link. | Ship CONDUIT_BRIDGE in sprint 48 with v10 bump. Sprints 41-47 don't introduce persisted graph state. |
| Performance regression with 20 towers + 5 active Conduit modifiers on a 60fps budget. | Dropped frames during heavy Conduit plays. | §7 budget is < 0.5ms for graph queries. Sprint 41 perf spec. If regression, per-tower modifier cache invalidated on graph mutation. |
| HIVE_MIND cluster aggregate is computed differently for damage vs range vs firerate — one composes additively, another multiplicatively. | Balance feels erratic. | HIVE_MIND spec declares "shares the HIGHEST multiplier across the cluster for each of damage, range, firerate." Single rule; card copy says `SHARE BEST`. Spec asserts a 3-tower cluster where tower A has ×2 dmg and B has ×1.5 → all three fire at ×2. |
| Conduit + Highground + Cartographer stacking blows out FORMATION ordering assumption. | Edge-case damage calc wrong after multi-archetype play. | §13 regression spec asserts additive-before-multiplicative generically — not FORMATION-specific. Any new additive bonus slots into the same rule. |
| ARCHITECT rare grants `linkSlots += 1` but graph still uses default-4 logic. | Rare has no effect. | ARCHITECT writes `tower.linkSlots = current + 1` at apply time; `TowerGraphService.getNeighbors` caps at `tower.linkSlots ?? DEFAULT_LINK_SLOTS`. Default constant = 4. Spec: place 5 towers in a plus shape (center has 4 neighbors), ARCHITECT active, plays a 5th card that creates virtual edge → center accepts all 5. |

## 15. Service graph impact

```
TowerGraphService (new, component-scoped on GameBoardComponent.providers)
├─ reads: TowerCombatService.placedTowers (via callback/getter — see below)
├─ NOT injected: no hard DI dep on TowerCombatService (avoids circularity with fireTurn)
├─ writes: none on other services
├─ emits: edgesAdded$ / edgesRemoved$ observables for LinkMeshService
└─ called by: TowerCombatService.registerTower / unregisterTower (lifecycle hooks),
              CardEffectService (Conduit card spell effects),
              RelicService (CONSTELLATION, ARCHITECT reads),
              LinkMeshService (sprint 42, subscribes to edge observables)

LinkMeshService (new sprint 42, component-scoped)
├─ reads: TowerGraphService (edge observables)
├─ reads: BoardMeshRegistryService (tower mesh positions for line endpoints)
├─ writes: scene (add/remove THREE.Line instances)
└─ owns: shared Line material, (future) InstancedMesh for aura orbs

TowerCombatService (existing, modified pre-sprint 41 + sprint 41+)
├─ composeDamageStack() extraction (PRE-SPRINT 41)
├─ registerTower calls towerGraphService.registerTower (sprint 41)
├─ unregisterTower calls towerGraphService.unregisterTower (sprint 41)
├─ fireTurn reads towerGraphService.getNeighbors / getClusterSize / isDisrupted
│   via DamageStackContext (sprint 43+)
```

### Avoiding TowerCombatService ↔ TowerGraphService circular DI

`PathMutationService` uses a `setRepathHook` pattern because it can't
inject `EnemyService` without creating a cycle (via `CombatLoopService`).
Same pattern applies here: `TowerGraphService` must NOT inject
`TowerCombatService`. Instead, `TowerCombatService` injects
`TowerGraphService` and calls `registerTower`/`unregisterTower` directly.
`TowerGraphService` accepts a getter for `placedTowers` passed at init:

```ts
// game-board.component.ngOnInit:
this.towerGraphService.setPlacedTowersGetter(
  () => this.towerCombatService.getPlacedTowers(),  // existing method, line 722
);
```

Component-scoped wiring only; not a DI cycle. Same pattern as
`PathMutationService.setRepathHook`. Sprint 41 implementation sets this
in `ngOnInit` alongside the existing repath hook wire.

## 16. Testing strategy

### Unit (sprint 41)

- `registerTower(A)` on empty graph → A has 0 neighbors, cluster size 1.
- `registerTower(A) + registerTower(B)` where B is 4-dir-adjacent → both
  report 1 neighbor each; cluster size 2.
- Diagonal towers are NOT neighbors.
- `unregisterTower(A)` → B reports 0 neighbors; cluster size 1.
- 5-tower line (A-B-C-D-E all 4-dir-adjacent) → cluster size 5; removing
  C splits into {A,B} + {D,E}.
- `addVirtualEdge(A, D, expires=5)` → A's neighbors include D despite
  distance; cluster sizes merge.
- `tickTurn(5)` → virtual edge expires; clusters split back.
- `disruptRadius(center, radius=2, until=10)` at Manhattan-2 → correct
  towers flagged; `isDisrupted` returns true; `getNeighbors` returns
  empty for disrupted towers.
- `tickTurn(10)` → disruption expires.
- `reset()` → all state cleared.

### Integration (sprint 41)

- Place-sell cycle: place 3 adjacent towers, sell middle → neighbor sets
  updated on both remaining; no dangling edges.
- Graph rebuild on tower restore: save mid-encounter with 5 towers, reload
  → post-restore graph matches pre-save (run full graph equality check).
- `composeDamageStack` with zero Conduit modifiers → identical output to
  today's inline stack (bit-for-bit for a representative set of towers).
  Regression guard during refactor.

### Perf (sprint 41)

- 20 towers × 3 graph queries per tower × 100 ticks < 10ms total.
- Full graph rebuild on 20 towers < 0.5ms wall-time.

### Composition (sprint 41, forward-flagged)

- Tile-mutation × tower-placement × elevation × adjacency integration
  spec. **Do this now**, before Conduit cards land. Mirror Phase 3's
  sprint-40 integration spec. Every field on `PlacedTower` round-trips
  through save/restore with all other services active.

### Hierarchical-injector guardrail (sprint 56 QA, carryover from Phase 3
/run DI fix)

Add a spec that instantiates `GameBoardComponent` with ONLY the providers
declared on `GameModule` (not the component-level set) and asserts the
failure mode is clean (not silent). Prevents the next component-dep
service from landing in `GameModule.providers` undetected. One-line
guardrail; low cost.

### Visual (sprint 55 QA gate)

- Link line renders between adjacent towers at correct world coords.
- Virtual edge renders with a distinct material variant (dashed or
  different hue).
- Disrupted tower's links dim or hide while disrupted.
- Teardown leak check (§10).

## 17. Implementation checklist for sprint 41

When sprint 41 opens, work in this order:

1. **composeDamageStack() refactor lands FIRST** (separate commit, pre-
   sprint-41). Extracts the damage + range stacks into a named function
   with `DamageStackContext` bundle. No new multipliers. Regression spec:
   bit-for-bit equality with pre-refactor stack across a representative
   tower set.
2. Add `PlacedTower.linkSlots?: number` optional field. Default preserved
   as `undefined` → graph uses `DEFAULT_LINK_SLOTS = 4`. Serializer no-op
   (optional field spreads cleanly).
3. Add `TowerGraphService` skeleton: `registerTower`, `unregisterTower`,
   `getNeighbors`, `getClusterSize`, `getClusterTowers`, `reset`. Add
   spec.
4. Add `DEFAULT_LINK_SLOTS = 4` constant to a new
   `constants/conduit.constants.ts` file.
5. Wire `TowerCombatService.registerTower` / `unregisterTower` to call
   the graph. Update existing specs; new spec for the wire.
6. Wire `game-board.component.ngOnInit` to call
   `towerGraphService.setPlacedTowersGetter(...)`.
7. Wire `GameSessionService.teardownEncounter` to call
   `towerGraphService.reset()`.
8. Wire `GameBoardComponent.restoreFromCheckpoint` — new Step 4.5:
   `towerGraphService.rebuild()` after Step 4 (tower restore). Update the
   19-step coordinator to 20 steps.
9. Add virtual-edge + disruption API stubs (return no-op / empty). These
   land functional in sprint 48 (CONDUIT_BRIDGE) and sprint 53 (DISRUPTOR).
10. Perf stress spec (§16).
11. **Composition integration spec** (§16 + §14 row 1). Must compose
    path-mutation + elevation + adjacency on the same tiles and towers.
12. Sprint 42 LinkMeshService is a follow-up, not blocking sprint 41's
    non-visual primitives. Sprint 41's spec coverage is graph-correctness-
    only.

At the end of sprint 41, `TowerGraphService` is real but has no card
callers. Sprint 42 adds visualization. Sprint 43 (HANDSHAKE) is the first
card that reads the graph. Everything before sprint 43 is load-bearing
groundwork with zero player-visible surface — same discipline as sprint 9
before sprint 11, sprint 25 before sprint 27.

## 18. What would invalidate this design

- **If playtest reveals Conduit clusters rarely exceed 2 towers** (because
  gold budgets don't support dense placements) → relax CONSTELLATION /
  HIVE_MIND thresholds. Not an adjacency-graph change.
- **If `composeDamageStack` becomes a bottleneck** (> 1ms per fireTurn
  at 20 towers) → per-tower memoization keyed by `(tower, graph version,
  modifier version)`. The versions are cheap: increment on any graph /
  modifier mutation.
- **If a future card needs to change tower AND graph atomically** (e.g.,
  "place tower and auto-link all neighbors in one op") → caller orchestrates
  the two services, as it does for path mutation + elevation today. Do not
  introduce a cross-service coordinator.
- **If the "edge observable" pattern in `TowerGraphService ↔ LinkMeshService`
  proves heavy** → direct-call hook (LinkMeshService.onEdgeAdded / removed)
  replaces the observable. Same lifecycle semantics; lower allocation.
- **If ARCHITECT's "+1 link slot" needs to propagate to existing towers
  retroactively** — it does. Sprint 49 (ARCHITECT) writes
  `tower.linkSlots = (tower.linkSlots ?? DEFAULT_LINK_SLOTS) + 1` to every
  active tower at apply time, then triggers a graph rebuild. Handled
  within the card's spell effect; no service surface change.
- **If DISRUPTOR's 2-tile radius under Manhattan feels too strong or too
  weak** — adjust the radius constant, not the metric. Manhattan is
  locked for 4-dir consistency.
- **If `TowerGraphService` ends up needing to cache per-cluster aggregate
  buffs** (because Model C proves too slow) → add a cache invalidated on
  graph mutation + modifier mutation. Do not switch to Model B. The
  read-time-aggregation invariant is load-bearing for DISRUPTOR correctness.

---

**Sign-off gate before sprint 41 opens:**

- [x] Link state lives on `PlacedTower`, NOT `GameBoardTile` (§4). Locked.
- [x] 4-direction adjacency, Manhattan disruption radius (§6). Locked.
- [x] Rebuild cadence: on register/unregister/tickTurn only; never on fire
      tick (§7). Locked.
- [x] Buff propagation: Model C — stateless per-fire-tick aggregation (§8).
      Locked.
- [x] CHECKPOINT_VERSION v10 deferred to sprint 48 (CONDUIT_BRIDGE) — not
      sprint 41 (§9). Locked.
- [x] Link-mesh disposal: dedicated `LinkMeshService` owner (§10). Locked.
- [x] Cache-invalidation split: link graph changes never invalidate
      pathfinding cache (§11). Locked.
- [x] `composeDamageStack()` refactor ships as a pre-sprint-41 commit
      (§12). Mandatory.
- [x] FORMATION additive-before-multiplicative range ordering with
      regression spec in sprint 41 (§13). Locked.
- [x] Failure modes enumerated (§14). Mitigations assigned.
- [x] TowerCombat ↔ TowerGraph circular DI avoided via getter pattern
      (§15). Locked.
