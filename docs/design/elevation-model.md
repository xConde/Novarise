# Elevation Model — Design Spike (Highground Phase)

**Status:** Design only. No implementation in this sprint.
**Sprint:** 24.5 (Phase 3 prep, archetype-depth plan).
**Consumers:** Highground card phase (sprints 25–40).
**Author:** 2026-04-18, feat/archetype-depth branch.
**Predecessor:** `path-mutation-service.md` (sprint 8.5, Phase 2 prep) — same format, same discipline.

## 1. Problem statement

The Highground archetype (plan sprints 25–40) needs per-tile elevation on the combat board: raise tiles
for tower range/damage bonuses, depress tiles to expose enemies, and run line-of-sight through the
resulting terrain profile. Today the codebase has:

- **No per-tile height data.** `BOARD_CONFIG.tileHeight = 0.2` is a global vertical-thickness constant
  used in `GameBoardService.createTileMesh` and `TowerMeshFactoryService`. There is no `height` /
  `elevation` field on `GameBoardTile` (game-board-tile.ts fields: `x`, `y`, `type`, `isTraversable`,
  `isPurchasable`, `cost`, `towerType`, `mutationOp`, `priorType`).
- **No tower-mesh Y mutation API.** Towers are placed once in `GameBoardComponent.renderGameBoard` at
  `group.position.set(x, tileHeight, z)` (tower-mesh-factory.service.ts:285). No `repositionTower`
  exists anywhere in `src/` (grep confirmed).
- **No line-of-sight model.** `TowerCombatService.findTarget` (tower-combat.service.ts:496) runs an
  XZ-plane Euclidean distance check against `stats.range`. `SpatialGrid` keys on `"${cellX},${cellZ}"`
  with no Y dimension. There is no occlusion code anywhere.
- **No elevation-aware pathfinding.** `PathfindingService.findPath` (pathfinding.service.ts:20) reads
  only `tile.isTraversable` and `tile.type === EXIT`. Cache key is `"sx,sy-ex,ey"` — purely 2D.

The Phase 2 Cartographer work shipped `PathMutationService` as a *runtime-only* abstraction for tile
`BlockType` changes, journaled with duration-based expiry, serialized as an append-only journal
(`CHECKPOINT_VERSION = 8`). `mutationOp` on `GameBoardTile` is a 4-variant union
(`'build' | 'block' | 'destroy' | 'bridgehead'`). That machinery is **not the right abstraction for
elevation** — see §2 and §4 for why.

Elevation is a new *orthogonal* dimension alongside BlockType. This spike specifies a peer service,
a tile-field extension, Y-only mesh APIs, a line-of-sight subsystem contract, and a `CHECKPOINT_VERSION`
bump to 9 — all before any Highground card code opens in sprint 25.

## 2. Non-goals

- **No damage bonus engine rework.** Range/damage scaling plugs into the existing per-turn
  `getEffectiveStats` + `fireTurn` computation (tower-combat.service.ts:207–246). This spike specifies
  the hook, not a generalized buff pipeline.
- **No editor integration.** `TerrainGrid` owns edit-mode tile CRUD. The editor's `adjustHeight`
  already writes to `Tile.height` in editor coordinate space (column-major) — that data is discarded
  at `importBoard` time and never reaches runtime. Not in scope to bridge.
- **No per-vertex terrain deformation.** Tile meshes stay `BoxGeometry` boxes. Elevation translates
  the existing mesh's `position.y` — it does **not** rebuild geometry. Sprint 39's polish pass may add
  supporting "cliff" meshes under raised tiles; those are new objects, not geometry rewrites.
- **No `mutationOp` extension with `'elevate' | 'depress'`.** Elevation is not a `BlockType`
  transition. Forcing it through `PathMutationService` would require: (a) a `MutationOp` variant that
  changes an integer, not a `BlockType`; (b) cache-invalidation suppression for elevation-only ops;
  (c) `priorType: BlockType` journal field made nullable (or widened); (d) `swapMesh()` changed to
  skip geometry rebuild for elevation ops. Four subtle holes in a service whose contract currently
  fits Cartographer perfectly. Peer service instead (§4).
- **No cross-tile morph targets or InstancedMesh migration.** Stays with per-tile `THREE.Mesh`. Sprint
  39 may revisit; this spike's mesh APIs are compatible with a future InstancedMesh migration.

## 3. Scope

### In-scope ops (Highground)

| Op | Elevation delta | BlockType change? | Journal? | Duration |
|---|---|---|---|---|
| `raise(r, c, amount)` | `+amount` to `tile.elevation` | no | yes (for expiry) | optional |
| `depress(r, c, amount)` | `-amount` to `tile.elevation` | no | yes (for expiry) | optional |
| `setElevation(r, c, value)` | set absolute (relic preset) | no | no (permanent) | n/a |
| `collapse(r, c)` | set to 0 | no | no (fires once, damage is payload) | one-shot |

Elevation bounds: `[-MAX_DEPRESS, +MAX_ELEVATION]`. Initial constants: `MAX_ELEVATION = 3`,
`MAX_DEPRESS = 2`. Enforced in service-level validation. Rationale: gives meaningful granularity
(HIGH_PERCH requires +2; KING_OF_THE_HILL rewards highest) without unbounded growth from spammed
RAISE_PLATFORM. Tunable.

Spawner and exit tiles are **immutable for elevation** — the service rejects any elevation change on
`BlockType.SPAWNER | EXIT`. Rationale: enemy spawning animation positions from tile surface; elevating
a spawner out from under its spawner pedestal is a visual failure mode. Lock it.

### In-scope lifecycle responsibilities

- Tile data mutation: extend `GameBoardTile` with `readonly elevation?: number` (default `undefined`,
  treated as 0).
- Per-tile mesh Y translation via new `BoardMeshRegistryService.translateTileMesh(row, col, newY)`.
- Per-tower mesh Y translation via new `BoardMeshRegistryService.translateTowerMesh(row, col, newY)`.
- Elevation journal for auto-expire on turn-end (reusing `tickTurn` pattern from `PathMutationService`).
- Serialization via new `SerializableTileElevationState` on `EncounterCheckpoint`.
- Range/damage scaling lookup surface for `TowerCombatService` to read at fire-decision time.
- Line-of-sight query surface (`LineOfSightService`, sprint 26) that reads the elevation grid.

### Out-of-scope (tracked elsewhere)

- Visual "cliff" column under raised tiles (sprint 39 polish). The tile simply floats in MVP.
- Tower-buff surfaces (HIGH_PERCH range boost for the wave) — route through tower per-turn buffs
  (`fireTurn` multiplier stack), not through elevation. `HIGH_PERCH` reads current elevation and
  applies a buff to the tower; it does not mutate elevation.
- `VANTAGE_POINT` (+50% dmg this turn for elevated towers): same — per-turn buff stack reading
  elevation, no service write.
- `KING_OF_THE_HILL` (rare anchor): passive read of max-elevation tower; no service write.
- `WYRM_ASCENDANT` boss (sprint 39): enemy-side flag `immuneToElevationBonuses`; tower-fire code reads
  target's flag and skips the elevation damage multiplier. Range multiplier still applies.

## 4. Why a peer service, not a fourth `MutationOp`

Path-mutation-service.md §2 explicitly deferred this call: *"No elevation. Highground will extend this
service, not the GameBoardTile model. Specifically: a modifyElevation() method signs up to the same
invalidate/restore contract."* That deferral is **revisited and overturned here** after auditing the
runtime surface. Rationale:

1. **Journal shape mismatch.** `PathMutation` snapshots `priorType: BlockType` for revert. Elevation
   revert needs `priorElevation: number`. Widening `priorType: BlockType | number` lies to every
   consumer that reads the journal. Adding a parallel `priorElevation?: number` field makes the
   `PathMutation` discriminated union badly (two disjoint op families pretending to be one).
2. **Cache invalidation rule inversion.** `applyMutation` in `PathMutationService` *unconditionally*
   calls `pathfindingService.invalidateCache()` after every op (path-mutation.service.ts:387).
   Elevation changes MUST NOT invalidate the cache (elevation does not change `isTraversable`). An
   `elevate` op routed through the existing `applyMutation` would either (a) over-invalidate (cache
   thrash on HIGH_PERCH spam) or (b) require a per-op invalidation flag — breaking the current clean
   "every mutation invalidates" invariant.
3. **Mesh lifecycle mismatch.** `swapMesh` disposes old geometry + material and calls
   `createTileMesh` from scratch (path-mutation.service.ts:317). Elevation changes should translate
   the existing mesh object (`mesh.position.y = newY`) — no disposal, no rebuild. Two entirely
   different mesh flows under one `applyMutation` is a maintainability tax that grows with each op.
4. **Serialization shape mismatch.** Mutations are an append-only journal with expiry. Elevations are
   a per-tile current value (only one elevation per cell at any time — multiple RAISE cards stack
   into a single accumulated value, not into a journal of "+1" entries). Trying to encode elevation
   as a journal means either (a) collapsing duplicate entries at serialize time (lossy — losses
   per-card expiry) or (b) keeping separate entries per card (expiry gets ambiguous: when HIGH_PERCH
   expires, does it revert one +1 or all +1s on that tile?).

**Decision:** `ElevationService` is a **peer** to `PathMutationService`. Both are component-scoped in
`GameModule`. Both own their journal + serialization slice. Composition is via `GameBoardTile` (one
tile holds `mutationOp` *and* `elevation` simultaneously, read by whichever service queries) and via
the checkpoint (separate slices, orthogonal migrations).

This explicitly overturns the path-mutation-service.md §2 line *"Highground will extend this service."*
Log the decision and move on.

## 5. Service surface

```ts
// src/app/game/game-board/services/elevation.service.ts
// Scope: component-level (provided in GameModule alongside GameBoardService + PathMutationService).
// NOT providedIn: 'root' — state is per-encounter, must be discarded on /play navigation.

export type ElevationOp = 'raise' | 'depress' | 'set' | 'collapse';

export interface ElevationChange {
  readonly id: string;                    // stable ID for expiry
  readonly op: ElevationOp;
  readonly row: number;
  readonly col: number;
  readonly appliedOnTurn: number;
  readonly expiresOnTurn: number | null;  // null = permanent
  readonly priorElevation: number;        // snapshot for revert (integer)
  readonly deltaOrAbsolute: number;       // for raise/depress: delta; for set: new value
  readonly source: 'card' | 'relic';
  readonly sourceId: string;              // card def id, relic id, etc.
}

export interface ElevationResult {
  readonly ok: boolean;
  readonly reason?: ElevationRejectionReason;
  readonly change?: ElevationChange;
  readonly newElevation?: number;
}

export type ElevationRejectionReason =
  | 'out-of-bounds'
  | 'spawner-or-exit'
  | 'out-of-range'           // attempted to exceed MAX_ELEVATION / MAX_DEPRESS
  | 'already-changed-this-turn'
  | 'no-op';

@Injectable()
export class ElevationService {
  // --- Apply ---
  raise(row: number, col: number, amount: number, duration: number | null, sourceId: string): ElevationResult;
  depress(row: number, col: number, amount: number, duration: number | null, sourceId: string): ElevationResult;
  setAbsolute(row: number, col: number, value: number, sourceId: string): ElevationResult; // permanent only (relics)
  collapse(row: number, col: number, sourceId: string): ElevationResult; // returns priorElevation for damage math

  // --- Query ---
  getElevation(row: number, col: number): number;               // 0 if never changed
  getMaxElevation(): number;                                     // highest elevation on board (KING_OF_THE_HILL read)
  getElevationMap(): ReadonlyMap<string, number>;                // key "row-col", only non-zero cells
  getActiveChanges(): readonly ElevationChange[];

  // --- Lifecycle (driven by CombatLoopService) ---
  tickTurn(currentTurn: number): void;                           // expires duration-limited changes
  reset(): void;                                                  // full clear; called on encounter teardown

  // --- Persistence ---
  serialize(): SerializableTileElevationState;
  restore(snapshot: SerializableTileElevationState): void;
}
```

### Apply flow (canonical)

1. Validate: bounds, not spawner/exit, resulting elevation within `[-MAX_DEPRESS, MAX_ELEVATION]`,
   anti-spam rule (one change per `(row, col)` per turn).
2. Compute `priorElevation` from current tile elevation (or 0 if undefined).
3. Compute `newElevation` = prior + delta (raise/depress) or = value (setAbsolute) or = 0 (collapse).
4. Reject if `newElevation === priorElevation` → `no-op`.
5. Mutate `GameBoardService` tile in place via new method `setTileElevation(row, col, newElevation)`.
6. Translate tile mesh Y via `BoardMeshRegistryService.translateTileMesh(row, col, newTileY)`.
7. Translate tower mesh Y (if a tower sits on the tile) via `translateTowerMesh(row, col, newTowerY)`.
8. **Do NOT invalidate pathfinding cache.** Elevation does not affect `isTraversable`. See §11.
9. **Do NOT call `repathAffectedEnemies`.** Same reason. Enemy movement is 2D-grid-only.
10. Push `ElevationChange` into the journal with `id = nextId()`, `appliedOnTurn`, `expiresOnTurn`.
11. Return `{ ok: true, change, newElevation }`.

### Expire flow (per-turn)

`CombatLoopService.resolveTurn()` calls `elevationService.tickTurn(turnNumber)` at the same slot as
`pathMutationService.tickTurn(turnNumber, scene)` — **immediately after `this.turnNumber++`, before
step 1 (spawn)**. For each change whose `expiresOnTurn === turnNumber`:

1. Revert elevation to `priorElevation` via `GameBoardService.setTileElevation`.
2. Translate tile + tower meshes back to prior Y.
3. Drop from journal.

No cache invalidation on expire (same rationale).

**Ordering note:** `pathMutationService.tickTurn` and `elevationService.tickTurn` are independent —
either order works as long as both precede spawn. Recommendation: expire path mutations first (may
re-open a tile), then expire elevations (may un-raise a tile). Keeps the "structural → numeric"
mental model.

## 6. `GameBoardTile` changes

Today `GameBoardTile` uses `readonly` fields and the service replaces the slot (see `placeTower`).
Keep that discipline. Three concrete changes:

1. **New field** `readonly elevation?: number` on `GameBoardTile`. `undefined` on tiles that have
   never been elevated; treated as 0 by all query code. Non-zero integer otherwise. Never fractional.
2. **Update the `createMutated`, `createBase`, `createSpawner`, `createExit`, `createWall` factories
   to pass-through elevation.** New signature:
   `GameBoardTile.createBase(x, y, cost, elevation?: number)` — elevation defaults to previous value
   when called from a re-construction path, `undefined` otherwise. Or more conservatively: add a
   `withElevation(elevation: number): GameBoardTile` clone method so the existing factory shapes
   don't all grow an optional parameter.
3. **New service method** `GameBoardService.setTileElevation(row, col, newElevation: number): GameBoardTile | null`.
   Enforces `SPAWNER` / `EXIT` immutability. Preserves all other tile fields
   (`type`, `mutationOp`, `priorType`, etc.) — this is the orthogonal composition point. Returns the
   new tile (for mesh translation) or `null` if rejected.

**What does NOT change on `GameBoardTile`:**
- `type` enum. No `BlockType.ELEVATED`. Elevation is a number, not a type.
- `isTraversable`. An elevated tile is still walkable. GLIDER, TITAN, WYRM read elevation but don't
  gate traversal on it.

**Mutation + elevation composition:** a tile can be both `mutationOp === 'build'` AND `elevation === 2`
simultaneously. The shader variant in sprint 10 reads `mutationOp`; any elevation shader variant
(sprint 39) reads `elevation`. They do not collide.

## 7. Validation rules

| Rule | Check |
|---|---|
| Bounds | `row < 0 \|\| row ≥ boardHeight \|\| col < 0 \|\| col ≥ boardWidth` → reject `out-of-bounds`. |
| Spawner/exit immutability | `tile.type === SPAWNER \|\| EXIT` → reject `spawner-or-exit`. Applies to apply + expire + restore. |
| Range | `newElevation < -MAX_DEPRESS \|\| newElevation > MAX_ELEVATION` → reject `out-of-range`. Clamp at the caller, do not silently truncate. |
| Anti-spam | At most one elevation change per `(row, col)` per turn. Second change in the same turn on the same tile → reject `already-changed-this-turn`. Prevents raise→depress→raise chains; mirrors `PathMutationService` rule. |
| No-op | `newElevation === priorElevation` → reject `no-op`. |

**Important:** elevation changes are allowed on `WALL` tiles. Raising a wall is cosmetically strange
but mechanically harmless (walls are not targetable, path is unaffected). The rule is spawner/exit-only
because those tiles have geometry-dependent spawn/despawn animations.

**Elevation changes are allowed on TOWER tiles.** That's the entire point of RAISE_PLATFORM — raise
the tile, the tower rides up with it (via `translateTowerMesh`). No special case.

## 8. Mesh lifecycle — the new Y-only APIs

Tile meshes today live at `mesh.position.y = tileHeight / 2` (game-board.service.ts:138). Tower
meshes live at `group.position.y = tileHeight` (tower-mesh-factory.service.ts:285). All Y values are
derived from the global `BOARD_CONFIG.tileHeight = 0.2`.

### New `BoardMeshRegistryService` methods

```ts
// board-mesh-registry.service.ts

/**
 * Translate a tile mesh's Y position without disposing or rebuilding.
 * Used by ElevationService. The caller is responsible for computing `newY`
 * (typically `elevation + tileHeight / 2`).
 */
translateTileMesh(row: number, col: number, newY: number): void;

/**
 * Translate a tower group's Y position without disposing or rebuilding.
 * Used by ElevationService when elevation changes on a tile that holds a tower.
 * Caller computes `newY` (typically `elevation + tileHeight`).
 */
translateTowerMesh(row: number, col: number, newY: number): void;
```

Both are O(1) Map lookups + one `position.y` assignment. **No disposal. No geometry rebuild. No
scene add/remove.** This is the core optimization that makes elevation ops cheap enough to spam.

**Why this is safe:** Three.js scene-graph matrix updates are automatic on next render. Tower groups
have children positioned relative to the group origin (tower-mesh-factory.service.ts:51–277) — all
child positions are preserved unchanged when the group's Y moves. Tile meshes are single `BoxGeometry`
objects with no children.

### The "floating tile" trade-off (MVP)

A tile raised from Y=0.1 to Y=2.1 has open space beneath it. Visually the tile floats. Two options:

- **A. Float it (MVP).** Accept the visual oddity for sprints 25–38. The gameplay is correct;
  elevation numbers read correctly; LOS works. Users may be confused.
- **B. Add a supporting "cliff" column mesh.** New mesh per raised tile, positioned at the column
  between Y=0 and Y=elevation. Requires disposal on collapse/expire. Sprint 39 polish scope.

**Recommendation: A for sprints 25–38, B in sprint 39.** Documented here so sprint 39 knows it inherits
this debt. Sprint 29 (CLIFFSIDE) is authored as a cluster of RAISE_PLATFORM equivalents — the word
"cliff" in the card name hints at the visual debt that has to land by sprint 39.

## 9. Save/restore (CHECKPOINT_VERSION v8 → v9)

Elevations are persistent per-encounter state. A save mid-encounter with elevated tiles MUST restore
identically. This requires a `CHECKPOINT_VERSION` bump from 8 to 9.

### Schema change

```ts
// encounter-checkpoint.model.ts
export const CHECKPOINT_VERSION = 9;   // was 8

export interface SerializableTileElevationState {
  readonly elevations: readonly { row: number; col: number; value: number }[]; // sparse — only non-zero cells
  readonly changes: readonly ElevationChange[];                                  // journal (for expiry)
  readonly nextId: number;
}

export interface EncounterCheckpoint {
  // ...existing v8 fields...
  /**
   * Per-tile elevation state at save time.
   * Added in v9. v8 checkpoints are migrated with empty elevation state.
   */
  readonly tileElevations: SerializableTileElevationState;
}
```

**Why sparse?** Most boards have zero elevated tiles. Serializing a full 25×20 = 500-cell matrix of
zeros is wasteful. The sparse array encodes only cells where `elevation !== 0`. Empty array on a
board with no elevation — zero serialization cost.

### Migration (v8 → v9)

In `encounter-checkpoint.service.ts`, append to the `migrations` array:

```ts
// v8 → v9: inject empty tile-elevation state
{
  fromVersion: 8,
  migrate: (c: any) => ({
    ...c,
    tileElevations: { elevations: [], changes: [], nextId: 0 },
  }),
},
```

Mirror the exact pattern used in the v7 → v8 migration that backfills `pathMutations`
(encounter-checkpoint.service.ts:79–86).

### Restore ordering

In `GameBoardComponent.restoreFromCheckpoint()` (the 18-step coordinator), insert a **new Step 3.6**
between path mutation restore (Step 3.5, added in sprint 9) and tower restore (Step 4):

```
Step 3.6: Restore tile elevations
  - elevationService.restore(checkpoint.tileElevations)
  - for each (row, col, value) in elevations array:
      - gameBoardService.setTileElevation(row, col, value)
      - boardMeshRegistry.translateTileMesh(row, col, value + tileHeight / 2)
  - elevation restore MUST precede tower restore (Step 4):
      * towers will be placed via forceSetTower at the elevated Y implicitly
        (tower Y is computed from tile elevation at placement time in the
         updated createTowerMesh hook — §10)
```

Save hook: same place as path mutations — `WaveCombatFacadeService.endTurn()` adds
`tileElevations: elevationService.serialize()` to the checkpoint payload. No new save trigger.

### Reset on abandon / victory / defeat

`elevationService.reset()` is called by `GameSessionService.teardownEncounter()`. Same lifecycle slot
as `pathMutationService.reset()`. Add the explicit call — component scoping provides defense but
the reset makes the teardown contract visible.

## 10. Tower-combat integration — where elevation reads plug in

Range scaling formula (initial):

```
rangeMultiplier = 1 + (towerTileElevation * RANGE_BONUS_PER_ELEVATION)
```

Where `RANGE_BONUS_PER_ELEVATION = 0.25`. Tower at elevation 0 → 1.0×. Elevation 2 → 1.5×. Matches
HIGH_PERCH card copy ("tower on +2 elevation gains +25% range for wave" — close; +50% vs the card's
+25%, TBD at sprint 29, this is the hook not the number).

**Integration point:** `TowerCombatService.fireTurn()` (tower-combat.service.ts:207–246) computes
`stats` before calling `findTarget`. Insert the elevation multiplier between `getEffectiveStats` and
the range-consuming branch:

```ts
// tower-combat.service.ts (pseudo-patch for sprint 29)
const baseStats = this.getEffectiveStats(tower);
const towerElevation = this.elevationService.getElevation(tower.row, tower.col);
const elevationRangeMultiplier = 1 + towerElevation * RANGE_BONUS_PER_ELEVATION;
const effectiveStats = {
  ...baseStats,
  range: baseStats.range * elevationRangeMultiplier,
};
// ... existing findTarget(tower, effectiveStats) ...
```

Damage bonus (VANTAGE_POINT / KING_OF_THE_HILL): same pattern, different multiplier. Per-turn buffs
(VANTAGE_POINT, +50% dmg this turn for elevated towers) are a card-applied modifier that reads
`elevation > 0` as a predicate and pushes a damage multiplier onto the existing turn-buff stack —
**not an elevation service write**. Passive relic effects (KING_OF_THE_HILL: highest tower +100% dmg)
read `elevationService.getMaxElevation()` on each fire tick and apply a matching multiplier.

**WYRM_ASCENDANT boss counter (sprint 39):** `effectiveStats.damage *= wyrmImmune ? 1 : elevationDamageMult`.
Range multiplier still applies (boss is "immune to damage bonuses, not range bonuses"). Single
boolean flag on the enemy, checked inline at damage application.

### SpatialGrid implication (none, immediately)

`SpatialGrid.queryRadius` is the broad phase. Because the tower's effective range grows with
elevation, the broad-phase query must use the *effective* range, not the base range. That's already
how it works — `stats.range` is passed in fully-multiplied. No SpatialGrid change needed.

## 11. Cache-invalidation split rule — THE critical decision

From `path-mutation-service.md` §11: *"every mutation invalidates."* That rule is correct for
Cartographer and must stay.

For Highground: **elevation changes do NOT invalidate the pathfinding cache.** Justification:

- `PathfindingService.findPath` reads only `tile.isTraversable` and `tile.type === EXIT`
  (pathfinding.service.ts:90). Elevation is not consulted. The cached path is correct as long as no
  traversable/exit state changes.
- Spammed elevation ops (RAISE_PLATFORM in a deck-leaning Highground build) would thrash the cache
  if invalidated. A 20-turn wave with 3 RAISE_PLATFORM per turn = 60 unnecessary cache clears.
- No planned Highground card changes `isTraversable` as a side effect of elevation. AVALANCHE_ORDER
  (sprint 32) *drops* elevation to 0 as its mechanic; it does NOT change `BlockType`. The tile stays
  `BASE`. No invalidation needed.

**The only case where elevation and path invalidation meet:** if a future card sets
`BlockType.WALL AND elevation=N` on the same tile as a single action (e.g., "raise wall" combos),
that card must route through BOTH services. The `PathMutationService` leg invalidates (BlockType
change). The `ElevationService` leg does not. Call both, let the (idempotent) cache-clear happen
once. No coordination needed because `invalidateCache()` is a no-op on an already-clean cache.

**Future-flag:** if a later sprint adds a card like `PITFALL` that depresses a tile BELOW ground and
makes it non-traversable (e.g., enemies fall in and die), the composed op must invalidate. Route
through both services. Do not build a cross-service coordinator — keep each service atomic, let the
caller orchestrate.

## 12. Line-of-sight subsystem (sprint 26, separate full sprint)

This spike specifies the LOS *contract*, not the implementation. Sprint 26 is a dedicated full sprint
for the geometric raycast. It is **not** an elevation-service method.

### Service contract

```ts
// src/app/game/game-board/services/line-of-sight.service.ts
@Injectable()
export class LineOfSightService {
  /**
   * Returns true if tower at (towerRow, towerCol) has clear LOS to the given
   * enemy world position. Considers per-tile elevation along the XZ ray.
   *
   * @param towerRow  tower's tile row
   * @param towerCol  tower's tile col
   * @param enemyX    enemy world X
   * @param enemyZ    enemy world Z
   * @returns true if no intervening tile is tall enough to block the ray
   */
  isVisible(
    towerRow: number,
    towerCol: number,
    enemyX: number,
    enemyZ: number,
  ): boolean;
}
```

### Geometric model

For each LOS query:

1. Convert tower tile → world `(towerX, towerZ)` at height `towerElevation + tileHeight + towerBarrelY`.
   (Barrel height is an approximation of where the shot "starts from" — use tile-centroid top for MVP.)
2. Enemy height = enemy tile elevation + enemy.position.y (enemies already have y for flying).
3. Trace the XZ line from tower to enemy using DDA (or Bresenham on the integer grid). For each
   *interior* tile on the line (excluding the tower's own tile and the enemy's current tile):
   - Compute the ray's Y value at that tile's XZ center:
     `rayY = lerp(towerY, enemyY, distanceFraction)`.
   - Compute the tile's top Y: `tileTopY = tileElevation + tileHeight`.
   - If `tileTopY > rayY` → **occluded; return false.**
4. If no interior tile occludes → return true.

This is a straight-line rasterization. O(√(Δrow² + Δcol²)) per query — at max tower range ~6 tiles,
this is ~6 tile checks per query.

### Integration into `TowerCombatService`

`findTarget` currently selects by distance only (tower-combat.service.ts:496–530). Sprint 26 inserts
a narrow-phase LOS filter:

```ts
// after the distance check, before target selection
const visible = this.lineOfSightService.isVisible(tower.row, tower.col, enemy.position.x, enemy.position.z);
if (!visible) continue;
```

**Performance budget:** 20 towers × 10 enemies × 60 fps × 6 cell-checks = 72k cell-checks/sec. Each
check is two array lookups + a lerp + a compare. Well under 1ms/frame on any device. Sprint 26 adds
a perf spec asserting < 1ms for a 30-enemy × 20-tower scene.

### Elevation threshold & LOS heuristics

Initial rule (sprint 26):
- Tower barrel height above its tile top = 0 (treat tower as firing from tile-top centroid).
- Interior tile occludes iff its top strictly exceeds the ray at that tile's XZ center.
- Enemies have no LOS-relevant height on their own — ground enemies treated as at ground level of
  their tile. Flying enemies (if any in Phase 3: no — GLIDER ignores elevation, not flies) TBD.

**Future refinements (not sprint 26):** partial occlusion, muzzle-flash offset, arc-shot weapons
ignoring LOS (mortar path — MORTAR already uses AOE, does not need direct LOS; document that
MORTAR bypasses `isVisible`).

### What sprint 26 must explicitly NOT do

- **Do not** put the LOS check inside `SpatialGrid`. Broad phase is AABB-cheap; LOS is per-target
  narrow-phase. Mixing them complicates the query cache.
- **Do not** cache LOS results across turns. Tower positions are static per turn but enemies move
  continuously. A per-fire-tick cache is possible but premature.
- **Do not** scope LOS as "if intervening tile elevation > tower elevation, block." That's wrong —
  it ignores the target's position along the ray. Must be a true raycast.

## 13. Three.js disposal audit

Elevation changes translate existing meshes; they do NOT create new ones. So:

- No new geometries to dispose.
- No new materials to dispose.
- `translateTileMesh` / `translateTowerMesh` are disposal-neutral.

**Exception (sprint 39):** the cliff-column mesh optionality. When those arrive:
- Each cliff is a new mesh with new geometry + shared material (from `TerraformMaterialPoolService`
  pattern — extend pool with cliff material variant).
- Cliff is created when elevation > 0, destroyed when elevation returns to 0.
- Pool disposal handled by existing `TerraformMaterialPoolService` dispose path.
- `ElevationService.reset()` must call a cliff-cleanup hook (new — delegated to registry). Sprint 39
  scope, not sprint 25.

**Disposal of per-tile shader variants:** deferred to sprint 39. MVP does not differentiate raised
tiles visually (aside from their Y position). Optional sprint 30+ polish.

## 14. Failure modes

| Failure | Symptom | Mitigation |
|---|---|---|
| Elevation applied but tower mesh not translated (e.g., tile has a tower added after elevation but before mesh registration sync). | Tower visually sits at Y=0.2 on a Y=2.2 tile — floats inside the ground. | Tower placement path calls `boardMeshRegistry.translateTowerMesh(r, c, elevation + tileHeight)` on every place — wire this into the tower-placement flow alongside `replaceTileMesh`. Spec: place tower on elevated tile → assert group.position.y. |
| Elevation restore applied before path mutations during checkpoint resume. | A tile marked `destroyed` by a path mutation has elevation restored onto a now-invalid BlockType. | Restore ordering: path mutations FIRST (Step 3.5), elevations SECOND (Step 3.6). Spec: round-trip encounter with both mutated + elevated tile. |
| Tower on elevated tile, tile collapse (AVALANCHE_ORDER) drops elevation mid-wave. | Tower's `position.y` needs to translate back down. | AVALANCHE_ORDER calls `elevationService.collapse(r, c)` which triggers `translateTowerMesh` in the service's apply flow (§5). No card-side logic needed. |
| Elevation out-of-range from stacked raises. | RAISE_PLATFORM + SURVEYOR_ROD (+1 pre-placed) + LABYRINTH_MIND path growth could push a tile to elevation 4+. | Service enforces `MAX_ELEVATION` at apply; overflow raises reject with `out-of-range`. Card copy documents the cap. |
| Anti-spam rule blocks legitimate AVALANCHE_ORDER + RAISE_PLATFORM same-turn combo. | Player raises tile, then plays avalanche — same tile, same turn → rejected. | The anti-spam rule is per `(row, col)` per turn. Document this and flag to design: if the combo is intended, exempt AVALANCHE (a collapse is structurally different from further raises). Prefer keeping the rule strict in MVP; relax only after playtest. |
| Elevation change on a tile mid-mesh-swap (a path mutation and elevation hitting the same tile in the same tick). | Order-dependent race — if mutation swaps mesh, then elevation translates, we translate the NEW mesh. If elevation goes first and then mutation swaps, the new mesh is created at default Y (0.1). | `createTileMesh` needs elevation awareness: pass the current elevation into mesh creation so the new mesh is placed at the correct Y from the start. Update `GameBoardService.createTileMesh` signature: `createTileMesh(row, col, type, mutationOp, elevation)`. |
| Line-of-sight performance regression with 30+ towers. | >1ms/frame LOS query time. | Sprint 26 perf spec asserts the budget. If regression, pre-filter with bounding rectangles (check if tower+enemy bounding box contains any elevated cell before the raycast — skips 90%+ of queries on low-elevation boards). |
| Bug: `getMaxElevation` called on empty elevation map. | Returns `undefined` or `-Infinity`, poisoning damage calc. | Return 0 on empty map. Explicit default, documented in JSDoc, tested. |

## 15. Service graph impact

```
ElevationService (new, component-scoped in GameModule — peer to PathMutationService)
├─ reads: GameBoardService (tile data)
├─ writes: GameBoardService (setTileElevation, new method)
├─ writes: BoardMeshRegistryService (translateTileMesh, translateTowerMesh — new methods)
├─ does NOT write: PathfindingService (no cache invalidation)
├─ does NOT write: EnemyService (no repath trigger)
├─ reads: CombatLoopService (turnNumber for apply timestamp)
└─ called by: CardEffectService (Highground card spell effects), relic handlers (SURVEYOR_ROD, OROGENY)

LineOfSightService (new sprint 26, component-scoped)
├─ reads: GameBoardService (tile dimensions, bounds)
├─ reads: ElevationService (per-tile elevation)
└─ called by: TowerCombatService.findTarget (narrow-phase filter after distance check)

TowerCombatService (existing, modified sprint 29+)
├─ reads: ElevationService.getElevation (per-tower for range/damage scaling)
├─ reads: ElevationService.getMaxElevation (KING_OF_THE_HILL)
└─ reads: LineOfSightService.isVisible (sprint 26+)
```

Both new services are `@Injectable()` component-scoped (`providedIn` NOT `'root'`), matching
`GameBoardService` and `PathMutationService`. Phase 2 red-team Finding 3 confirmed component-scoped
services are the load-bearing pattern for cross-encounter isolation. Do not deviate.

## 16. Testing strategy

### Unit (sprint 25)

- `raise` / `depress` / `setAbsolute` / `collapse` each mutate elevation and grow the journal.
- Each validation rule rejects correctly (bounds, spawner/exit, out-of-range, anti-spam, no-op).
- `getElevation` returns 0 on unmutated tiles; correct value after raise.
- `getMaxElevation` returns 0 on empty; correct max after mixed raises.
- `tickTurn` expires duration-limited changes; permanent changes survive.
- `serialize`/`restore` round-trip preserves sparse elevation map, journal, and `nextId`.
- `reset` clears everything.

### Integration (sprint 25 + carried forward)

- Elevate a tile → `BoardMeshRegistryService.translateTileMesh` called with correct Y.
- Elevate a tile with a tower → `translateTowerMesh` called with correct Y.
- Elevate + save + reload → elevations and journal restored identically; mesh Y values restored.
- Elevate + path-mutate same tile → both services apply independently; tile has both `mutationOp` AND
  `elevation`.
- Sprint 26: LOS raycast — tower to enemy through a raised intervening tile → occluded.
- Sprint 29: HIGH_PERCH range multiplier — tower at elevation 2 fires at range × 1.5.
- Sprint 32: AVALANCHE_ORDER on elevation-3 tile → damage = 30 applied to enemies on tile; elevation
  returns to 0; tower (if any) translates down.
- Sprint 37: GLIDER + elevation — damage multipliers ignored, range multipliers applied normally.
- Sprint 38: TITAN + elevation — damage multipliers halved; range multipliers applied normally.
- Sprint 39: WYRM_ASCENDANT — damage multipliers skipped; range multipliers applied.

### Perf (sprint 25 + sprint 26)

- Sprint 25: 10 elevation changes + 10 reverts in a single turn on a 25×20 board with 30 enemies.
  Assert total wall time < 4ms. Fails loud if the journal grows faster than O(N).
- Sprint 26: 30 enemies × 20 towers LOS queries per frame. Assert total LOS time < 1ms.

### Visual (sprint 39 QA gate)

- Raised tile mesh appears at expected world Y.
- Tower mesh on raised tile appears on top of the tile, not clipped inside.
- Cliff column (if shipped sprint 39) renders between Y=0 and Y=elevation.
- Teardown leak check: apply 50 elevations + revert; `renderer.info.memory.geometries/materials`
  returns to baseline.

## 17. Implementation checklist for sprint 25

When sprint 25 opens, work in this order:

1. Extend `GameBoardTile` with `elevation?: number` field + factory updates + clone `withElevation()`.
   Add spec.
2. Add `GameBoardService.setTileElevation(row, col, newElevation): GameBoardTile | null` with
   spawner/exit rejection. Add spec.
3. Extend `GameBoardService.createTileMesh` signature to accept `elevation`. Default 0 preserves
   existing behavior. Update all call sites.
4. Add `BoardMeshRegistryService.translateTileMesh(row, col, newY)` and `translateTowerMesh(row, col, newY)`.
   Add spec with disposal-neutrality assertion (no geometry/material dispose between calls).
5. Add `ElevationService` (all 4 ops, validation, journal, tickTurn, serialize/restore, reset).
   Add spec — mirror `PathMutationService` test structure.
6. Add `SerializableTileElevationState` to `encounter-checkpoint.model.ts`. Bump `CHECKPOINT_VERSION`
   to 9.
7. Add v8 → v9 migrator in `encounter-checkpoint.service.ts`. Add spec.
8. Wire into `CombatLoopService.resolveTurn` — call `elevationService.tickTurn` right after
   `pathMutationService.tickTurn`.
9. Wire into `GameSessionService.teardownEncounter` — call `elevationService.reset()`.
10. Wire into `GameBoardComponent.restoreFromCheckpoint` — new Step 3.6 for elevations. Update the
    sprint-18-sprint-9 18-step coordinator to 19-step.
11. Add the save payload field in `WaveCombatFacadeService.endTurn` alongside `pathMutations`.
12. Perf stress spec.

At the end of sprint 25, the service is **real but has no card callers**. Sprint 26 is LOS (standalone
full sprint). Sprint 27 (RAISE_PLATFORM) is the first card that calls `elevationService.raise()`.
Everything before sprint 27 is load-bearing groundwork with zero player-visible surface — that's
fine, same discipline as sprint 9 before sprint 11.

## 18. What would invalidate this design

- **If playtest reveals LOS feels too punishing** (too many blocked shots) → raise the occlusion
  threshold (tile must be 2+ units above the ray to block, not strictly greater). Known tuning knob,
  document at sprint 26.
- **If the "floating tile" visual is blocking QA signoff** (users can't read the elevation change as
  intentional without the cliff mesh) → pull sprint 39's cliff mesh forward to sprint 30. Non-breaking
  for the ElevationService API.
- **If a future card needs to change BlockType AND elevation atomically** (e.g., "raise + wall" as
  one op) → the cross-service caller pattern in §11 applies. If the pattern proves painful at the
  call site, introduce a `BoardOps` facade that serializes the two calls — not a service merger.
- **If LOS perf regresses past 1ms/frame at realistic scale** → pre-filter with bounding-rect culling
  (skip LOS raycast on flat board regions). Documented in §14.
- **If elevation on a TOWER tile needs to re-compute tower radius display UI** (hover range ring) →
  the UI reads `effectiveStats.range` on demand; no elevation-event listener needed. Range ring
  component already reads per-tick. No change.

---

**Sign-off gate before sprint 25 opens:**
- [x] Peer-service model chosen over `mutationOp` extension (§4). Logged decision.
- [x] Tile-field path chosen over side-channel or journal-only (§5, §6).
- [x] `CHECKPOINT_VERSION` v9 migration sketch written (§9).
- [x] Mesh Y-only translate APIs specified (§8). Disposal-neutral.
- [x] LOS subsystem scoped as a full sprint 26 (§12), not an afternoon flag check.
- [x] Cache-invalidation split rule written (§11). Elevation never invalidates.
- [x] Tower-combat integration point identified (§10). No broad-phase changes.
- [x] Failure modes enumerated (§14). Mitigations assigned.
