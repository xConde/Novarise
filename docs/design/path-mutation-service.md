# PathMutationService — Design Spike

**Status:** Design only. No implementation in this sprint.
**Sprint:** 8.5 (Phase 2 prep, archetype-depth plan)
**Consumers:** Cartographer card phase (sprints 11–19), Highground card phase (sprints 27–35).
**Author:** 2026-04-17, feat/archetype-depth branch.

## 1. Problem statement

The Cartographer archetype needs runtime tile mutation on the combat board: add path tiles, block/destroy path tiles, re-route enemies around a temporarily-closed corridor. Today the codebase has:

- A **runtime** tile model in `GameBoardService` (`src/app/game/game-board/game-board.service.ts`) that only mutates on `placeTower`/`removeTower` (BASE ↔ TOWER). No BASE ↔ WALL transition exists.
- An **editor** tile model in `TerrainGrid` (`src/app/games/novarise/features/terrain-editor/terrain-grid.class.ts`) with full tile CRUD (`paintTile`, `adjustHeight`, `setSpawnPoint`, ...) but a different data structure, a different coordinate system (column-major `tiles[x][z]` vs game row-major `board[row][col]`), and a different rendering lifecycle.
- A **pathfinding cache** in `PathfindingService` whose only mutation hook is `invalidateCache()`.

The two surfaces share **zero code**. The editor is allowed to dispose+recreate a tile mesh per edit (users accept a frame hitch); the runtime cannot during combat. Cards will mutate during a wave, in front of animated enemies, under the encounter checkpoint lifecycle.

This service is **NOT** a code re-share between editor and runtime. It is a runtime-only abstraction over the live game board, aware of pathfinding, enemies, mesh registry, and the checkpoint schema.

## 2. Non-goals

- No editor integration. `TerrainGrid` continues to own edit-mode tile CRUD. Shared code is out of scope — the editor's dispose-and-rebuild mesh strategy is wrong for the runtime and vice versa.
- No new tile `type` enum values. Use existing `BlockType.BASE`, `BlockType.WALL`, plus a new side-channel `mutationState` (see §5) so legacy board-type queries keep working.
- No elevation. Highground (phase 3) will extend this service, not the `GameBoardTile` model. Specifically: a `modifyElevation()` method signs up to the same invalidate/restore contract; `GameBoardTile` stays 2D.
- No multi-turn re-pathing rework. Enemies continue to use `needsRepath` deferred re-plan (enemy.service.ts:642). This service triggers the existing flag flow; it does not rewrite the movement loop.

## 3. Scope

### In-scope mutations (Cartographer)

| Op | Before state | After state | Duration |
|---|---|---|---|
| `buildPath(r,c)` | `WALL` or `BASE` | `BASE` (player-built) | permanent (or per-card duration) |
| `blockPath(r,c)` | `BASE` (path) | `WALL` | temporary (card specifies) |
| `destroyPath(r,c)` | `BASE` (path) | `WALL`, enemies on it take % max HP | permanent (card specifies) |
| `bridgehead(r,c)` | `WALL` | tower-only `BASE` | temporary (card specifies) |

Spawner and exit tiles are **immutable**. The service rejects any mutation whose `(r,c)` resolves to `BlockType.SPAWNER` or `BlockType.EXIT`. See §6.

### In-scope lifecycle responsibilities

- Tile data mutation in `GameBoardService` (extend with new methods; do not inline into the service).
- Mesh replacement in `BoardMeshRegistryService` (dispose old geometry + material; create replacement from `createTileMesh`; update the map + rebuild the flat array consumed by the raycaster).
- Path cache invalidation via `PathfindingService.invalidateCache()`.
- Enemy re-plan flag via `EnemyService.repathAffectedEnemies(r,c)`.
- Mutation journal for save/restore — the only new serialized state.
- Auto-expire on turn-end when the mutation has a duration (integrated into `CombatLoopService`).

### Out-of-scope (tracked elsewhere)

- Visual shader for "player-built tile" vs "original tile" — sprint 10, but the service must expose a classification (`isPlayerBuilt`, `isPlayerBlocked`, `isPlayerDestroyed`) that the shader queries.
- Boss counter `VEINSEEKER` (+30% speed if path modified in last 3 turns) — sprint 23. Service exposes `turnsSinceLastMutation()`; the boss reads it.
- `CARTOGRAPHER_SEAL` (rare anchor: all mutations this encounter persist). Handled by upgrading per-mutation `duration` before applying; no special path through this service.

## 4. Service surface

```ts
// src/app/game/game-board/services/path-mutation.service.ts
// Scope: component-level (provided in GameModule alongside GameBoardService).
// NOT providedIn: 'root' — state is per-encounter.

export type MutationOp = 'build' | 'block' | 'destroy' | 'bridgehead';

export interface PathMutation {
  readonly id: string;                    // stable ID for undo/expiry
  readonly op: MutationOp;
  readonly row: number;
  readonly col: number;
  readonly appliedOnTurn: number;
  readonly expiresOnTurn: number | null;  // null = permanent
  readonly priorType: BlockType;          // snapshot for revert (BASE | WALL)
  readonly source: 'card' | 'relic' | 'boss';
  readonly sourceId: string;              // card def id, relic id, etc.
}

export interface MutationResult {
  readonly ok: boolean;
  readonly reason?: MutationRejectionReason;
  readonly mutation?: PathMutation;
}

export type MutationRejectionReason =
  | 'out-of-bounds'
  | 'spawner-or-exit'
  | 'tower-occupied'
  | 'would-block-all-paths'
  | 'already-mutated-this-turn'   // anti-spam rule (see §6)
  | 'no-op';                      // op would not change state

@Injectable()
export class PathMutationService {
  // --- Apply ---
  build(row: number, col: number, duration: number | null, sourceId: string): MutationResult;
  block(row: number, col: number, duration: number, sourceId: string): MutationResult;
  destroy(row: number, col: number, sourceId: string): MutationResult;       // always permanent
  bridgehead(row: number, col: number, duration: number, sourceId: string): MutationResult;

  // --- Query ---
  getActive(): readonly PathMutation[];
  wasMutatedInLastTurns(turns: number): boolean;
  turnsSinceLastMutation(): number;          // Infinity if never mutated
  isPlayerBuilt(row: number, col: number): boolean;
  isPlayerBlocked(row: number, col: number): boolean;
  isPlayerDestroyed(row: number, col: number): boolean;

  // --- Lifecycle (driven by CombatLoopService / GameSessionService) ---
  tickTurn(currentTurn: number): void;       // expires mutations whose expiresOnTurn === currentTurn
  reset(): void;                             // full clear; called on encounter teardown

  // --- Persistence ---
  serialize(): SerializablePathMutationState;
  restore(snapshot: SerializablePathMutationState): void;
}
```

### Apply flow (canonical)

1. Validate: bounds, not spawner/exit, not tower-occupied (§6).
2. Validate connectivity: `wouldBlockAllPaths(r,c)` — reuse existing BFS in `GameBoardService` (`wouldBlockPath` at line 291, generalized to any mutation type). If any mutation leaves no spawner→exit path, reject.
3. Snapshot `priorType` from current tile.
4. Mutate `GameBoardService` tile in place (new method: `setTileType(row, col, BlockType, TowerOnly?)`).
5. Replace mesh in `BoardMeshRegistryService` (dispose old geo+material, create new via `createTileMesh`, update the map, rebuild flat array).
6. `pathfindingService.invalidateCache()`.
7. `enemyService.repathAffectedEnemies(row, col)`.
8. Push `PathMutation` into the journal with `id = nextId()`, `appliedOnTurn`, `expiresOnTurn`.
9. Return `{ ok: true, mutation }`.

### Expire flow (per-turn)

`CombatLoopService.resolveTurn()` calls `pathMutationService.tickTurn(turnNumber)` at the same point it ticks mortar zones and status effects. For each mutation whose `expiresOnTurn === turnNumber`:

1. Mutate tile back to `priorType`.
2. Replace mesh.
3. Invalidate path cache.
4. Repath affected enemies.
5. Drop from journal.

Ordering matters: expire **before** enemy movement resolves (same slot as status tick), so enemies plan against the restored board.

## 5. `GameBoardTile` changes

Today `GameBoardTile` has `readonly` fields and the service replaces the slot (see `placeTower`, line 405–414). Keep that discipline. Two concrete changes:

1. **New tile factory method** `GameBoardTile.createMutated(row, col, type, priorType, sourceOp)`. Adds two read-only fields: `mutationOp?: MutationOp` and `priorType?: BlockType`. `null` on unmutated tiles. The rendering path queries `mutationOp` for the shader variant in sprint 10; it has zero effect on pathfinding or tower placement.
2. **New service method** `GameBoardService.setTileType(row, col, type: BlockType, towerOnly?: boolean): GameBoardTile` — returns the new tile for mesh replacement. Enforces immutability (`SPAWNER` / `EXIT` cannot be set or overwritten). Returns `null` if rejected.

`placeTower` / `removeTower` / `forceSetTower` remain as-is — they handle TOWER state, which is a strictly separate concern (a tile under a tower is not a path mutation). A tower cannot be placed on a `WALL` either way, so Cartographer `block(r,c)` + `placeTower(r,c)` collisions are already rejected by `canPlaceTower`.

**What does NOT change on `GameBoardTile`:** the `type` enum. No new `BlockType.PLAYER_BUILT`. The shader branch reads `mutationOp`, not `type`.

## 6. Validation rules

| Rule | Check |
|---|---|
| Bounds | `row < 0 \|\| row ≥ boardHeight \|\| col < 0 \|\| col ≥ boardWidth` → reject `out-of-bounds`. |
| Spawner/exit immutability | `tile.type === SPAWNER \|\| EXIT` → reject `spawner-or-exit`. Applies to both apply + expire paths (an expire that would restore a spawner/exit is a bug — trap it). |
| Tower occupied | `tile.type === TOWER` → reject `tower-occupied`. Cartographer cannot overwrite a tower in-place; the player must sell first. |
| Connectivity | Run `wouldBlockAllPaths(row, col, proposedType)` BFS; reject `would-block-all-paths`. Same BFS as `wouldBlockPath` in game-board.service.ts:291 — generalize it to take a proposed (row,col,type) and reuse. |
| Anti-spam | At most one mutation per `(row, col)` per turn. Second mutation in the same turn on the same tile → reject `already-mutated-this-turn`. Prevents build→destroy→build chains being used to churn the path cache or repath storm enemies. |
| No-op | Op would not change state (e.g., `build` on an already-BASE tile) → reject `no-op`. |

**Boss enemies do not spawn-mutate.** MINER (sprint 21) is a special case: it has a `digThroughWall(row, col)` affordance that routes through `PathMutationService.destroy()` with `source: 'boss'`, but validation still applies (it cannot dig through a spawner). Its destroy is permanent and not journaled — see §9.

## 7. Mesh lifecycle

Tile meshes today are created once in `GameBoardComponent.renderGameBoard()` (line 1317) and live until encounter teardown. Each tile has its own `BoxGeometry` and its own `MeshStandardMaterial` (`GameBoardService.createTileMesh`, line 98). No instancing. No pooling.

### Mutation mesh swap

For every mutation, replace the mesh:

```
const oldMesh = registry.tileMeshes.get(`${row}-${col}`);
scene.remove(oldMesh);
oldMesh.geometry.dispose();
(oldMesh.material as THREE.Material).dispose();
const newMesh = gameBoardService.createTileMesh(row, col, newType);
newMesh.userData = { row, col, tile: gameBoardService.getGameBoard()[row][col] };
scene.add(newMesh);
registry.tileMeshes.set(`${row}-${col}`, newMesh);
registry.rebuildTileMeshArray();   // the raycaster uses the flat array
```

**Do not inline mesh ops into PathMutationService.** The service delegates to a new method on `BoardMeshRegistryService`:

```ts
// board-mesh-registry.service.ts
replaceTileMesh(row: number, col: number, newMesh: THREE.Mesh): void;
```

Keeps the disposal discipline in one place (the registry), aligns with the existing `towerMeshes` convention, and lets the spec suite assert "one old material disposed, one new mesh added" without mocking Three.js in the mutation spec.

### Future: `InstancedMesh`

Sprint 23's polish pass may migrate tile rendering to `InstancedMesh` — at that point the registry's `replaceTileMesh` becomes an instance-matrix + color-attribute update, and `PathMutationService` is unaffected. This is the reason for the delegation above.

### Disposal audit checklist (sprint 23)

- [ ] Every `createTileMesh` in the mutation path has a matching `dispose()` on replacement.
- [ ] `registry.tileMeshes.size` equals `board.length * board[0].length` at all times.
- [ ] `GameSessionService.teardownEncounter()` (line 147) continues to dispose all current tile meshes regardless of mutation state — no leaked material because a mutation was in flight at teardown.
- [ ] Spec: apply 50 mutations + revert; assert Three.js memory stats (`renderer.info.memory.geometries/textures`) return to baseline.

## 8. Save/restore

Path mutations are persistent player actions within an encounter. A save mid-encounter with active mutations MUST restore identically. This requires a `CHECKPOINT_VERSION` bump.

### Schema change

```ts
// encounter-checkpoint.model.ts
export const CHECKPOINT_VERSION = 8;   // was 7

export interface SerializablePathMutationState {
  readonly mutations: readonly PathMutation[];   // PathMutation is already JSON-safe
  readonly nextId: number;
}

export interface EncounterCheckpoint {
  // ...existing v7 fields...
  /**
   * Active path mutations (add/block/destroy/bridgehead) at save time.
   * Added in v8. v7 checkpoints are migrated with empty mutation state.
   */
  readonly pathMutations: SerializablePathMutationState;
}
```

### Migration

`EncounterCheckpointService` (the validator) adds a v7→v8 migrator that injects `pathMutations: { mutations: [], nextId: 0 }`. The service already has a migration framework (per `project_post_merge_handoff.md` and `encounter-checkpoint.service.ts`) — follow the existing pattern (v3→v4, v5→v6, v6→v7).

### Restore ordering

In `GameBoardComponent.restoreFromCheckpoint()` (line 1123), insert a **new Step 3.5** between the turn-number restore (Step 3) and the tower restore (Step 4):

```
Step 3.5: Restore path mutations
  - pathMutationService.restore(checkpoint.pathMutations)
  - for each mutation, replay the tile mesh swap against the freshly-imported board
  - mutations restore BEFORE towers (Step 4) because:
      a) towers can be placed on player-built tiles (legal)
      b) forceSetTower then stamps TOWER over the mutated BASE, preserving prior-type chain
  - mutations restore BEFORE enemies (Step 6) because:
      enemy paths serialized in checkpoint assume mutated board state
```

Save hook: `WaveCombatFacadeService.endTurn()` (already saves after every `resolveTurn()` per post-merge handoff). Add `pathMutations: pathMutationService.serialize()` to the checkpoint payload. No new save trigger.

### Reset on abandon / victory / defeat

`pathMutationService.reset()` is called by `GameSessionService.teardownEncounter()` and on run abandon. This matches how `CardEffectService` resets (per the post-merge handoff's list of root-scoped services that must reset between encounters). `PathMutationService` is **component-scoped**, not root, so reset is structurally enforced — but add the explicit `reset()` call for defense in depth.

## 9. MINER enemy integration (sprint 21 — flagging the contract here so sprint 9 doesn't paint over it)

MINER digs through walls every 3rd turn. Design contract for how it calls into this service:

- MINER is the **only** enemy type allowed to mutate the board.
- It calls `pathMutationService.destroy(row, col, 'miner')` with `source: 'boss'` and a synthetic sourceId `miner:<enemyId>`.
- The mutation IS journaled (otherwise it vanishes on save/restore after an enemy dies — leaves a zombie wall).
- MINER cannot dig through `SPAWNER`, `EXIT`, or a `BlockType.WALL` that is itself a player-built mutation (an `isPlayerBuilt` wall counts as player terraform, not as original terrain — arbitrary call, flag for playtest). Default: MINER cannot dig player-built walls; rationale below.

**Why MINER can't dig player builds:** if it could, the Cartographer counter-play becomes pointless (MINER trivially bypasses every wall). Keeping the asymmetry — MINER digs original walls only — preserves `BLOCK_PASSAGE` (sprint 12) as a real counter-counter card. This is a design call; do not change without re-opening the plan doc.

## 10. Failure modes

| Failure | Symptom | Mitigation |
|---|---|---|
| Mutation applied but `repathAffectedEnemies` misses an enemy | Enemy walks through a newly-mutated `WALL` for 1 segment before re-planning (existing behavior with tower placement, spec `enemy.service.spec.ts:1760`). | **Accept.** Matches existing tower-placement behavior; documenting as intentional. Cartographer cards that need instant reaction are wrong-design. |
| Mutation journal diverges from tile state on restore | Restored board has a `WALL` but journal says `BASE` (or vice versa). | Restore replays mutations over the freshly-imported board in order. `priorType` on each mutation = expected pre-mutation type. Assert on restore; if mismatch, log + drop that mutation, continue. Fail soft — an encounter with a dropped terraform is better than a crashed resume. |
| Checkpoint save during mid-turn expiry | Save fires between tick and next player input; in-flight expire may double-apply. | `tickTurn` is idempotent per-turn (mutations expired this turn are already removed from the journal before serialize is called). Save path calls serialize AFTER tickTurn completes. Verify in `WaveCombatFacadeService.endTurn()` ordering. |
| Connectivity false-positive on destroy | `destroy` leaves a disconnected island with an enemy standing on it. | Enemy `findShortestPathToAnyExit` returns `[]` → enemy is stuck. Existing behavior for blocked paths — enemy stands still until path returns. Document; may need a future "despawn stranded enemies" rule but not in scope for Cartographer. |
| Pathfinding recompute under load | Player chains 4 mutations/turn, pathfinding recomputes 4 times per apply. Board is 25×20 = 500 cells; A* is cheap (<1ms per enemy per path). 20 enemies × 4 invalidations = 80 recomputes/turn. | Untested — **add a perf test in sprint 9** (500 tile, 30 enemy, 10 mutation stress spec; assert total ms < 16). |
| `pathMutations` field absent on v7→v8 restored checkpoint and migration forgotten | Runtime crash reading `checkpoint.pathMutations.mutations`. | Follow the v5→v6 pattern: migration default + migration spec + corruption detection. Existing tests for the pattern live in `encounter-checkpoint.service.spec.ts`. |

## 11. Service graph impact

```
PathMutationService (new, component-scoped in GameModule)
├─ reads: GameBoardService (tile data)
├─ writes: GameBoardService (setTileType, new method)
├─ writes: BoardMeshRegistryService (replaceTileMesh, new method)
├─ writes: PathfindingService (invalidateCache)
├─ writes: EnemyService (repathAffectedEnemies)
├─ reads: CombatLoopService (turnNumber, for apply timestamp)
└─ called by: CardEffectService (card spell effects), MINER enemy action resolver
```

`GameBoardService` remains `@Injectable()` component-scoped (not `providedIn: 'root'`) per the CLAUDE.md service rule. `PathMutationService` matches.

## 12. Testing strategy

### Unit (service, sprint 9)

- Apply each op → tile type changes + journal grows.
- Each validation rule rejects correctly.
- Apply + expire → tile restored to priorType; journal shrinks.
- `turnsSinceLastMutation` returns `Infinity` on empty; correct deltas after apply/expire.
- `serialize`/`restore` round-trip preserves full state including `nextId`.
- Reset clears journal and resets id counter.

### Integration (sprint 9 + carried forward)

- `pathMutationService.build` → `pathfindingService.findPath` returns the new path crossing the built tile.
- `pathMutationService.block` mid-wave → enemy on that tile re-plans at next waypoint (existing `needsRepath` flow).
- Apply + save + reload → board and journal identical; no enemy desyncs.
- Sprint 21: MINER + destroy interaction; stranded-island enemy behavior.
- Sprint 23: VEINSEEKER boss reads `wasMutatedInLastTurns(3)` — spec the read path.

### Perf (sprint 9)

- Stress spec: 10 mutations in a single turn on a 25×20 board with 30 enemies. Assert total wall time < 16ms (one frame budget). Fails loud if pathfinding degrades.

### Visual (sprint 23 QA gate)

- Screenshot diff: baseline vs mutated tile state, mutation types render distinguishable.
- Teardown leak check: `renderer.info.memory.geometries` returns to baseline after apply+expire of 50 mutations.

## 13. Open questions — deferred for implementation sprint, not blocking

1. **Should `destroy` damage be applied by `PathMutationService` or by the calling card?** Recommendation: the calling card does the damage via `EnemyService` directly; the service is pure state. Rationale: keeps the service deterministic and side-effect-narrow; damage routing is a card concern. Revisit if 3+ cards duplicate damage logic.
2. **Does `CARTOGRAPHER_SEAL` (relic, permanent-all-mutations) upgrade existing mutations in flight, or only future mutations?** Recommendation: only future — the card applies `duration = null` at apply-time based on the active relic. Retroactive relic effects are a cross-cutting nightmare we don't need.
3. **Multiple spawners — does "connectivity" mean every spawner reaches every exit, or at least one?** Existing `wouldBlockPath` checks "any spawner → any exit" (BFS with multi-source start, multi-target end). Preserve that. The semantic is "no spawner becomes fully isolated from the exit set." Document explicitly on the `wouldBlockAllPaths` helper.
4. **Is there a cap on active mutations?** No cap in this spike. If a playtester chains 20 `BLOCK_PASSAGE` cards, the path becomes absurd. Ship without a cap, instrument in sprint 77 telemetry, introduce cap only if a single run exceeds e.g. 15 simultaneous mutations.

## 14. Implementation checklist for sprint 9

When sprint 9 opens, work in this order:

1. Extend `GameBoardTile` with `mutationOp?` / `priorType?` fields + `createMutated` factory + spec.
2. Add `GameBoardService.setTileType(row, col, type): GameBoardTile | null` with spawner/exit rejection + spec.
3. Add `BoardMeshRegistryService.replaceTileMesh(row, col, mesh)` + spec with disposal assertion.
4. Generalize `GameBoardService.wouldBlockPath` to `wouldBlockPathIfSet(row, col, type)`. Existing `wouldBlockPath` becomes a single-case wrapper.
5. Add `SerializablePathMutationState` to `encounter-checkpoint.model.ts`, bump `CHECKPOINT_VERSION` to 8, add migration in `EncounterCheckpointService` + spec.
6. Write `PathMutationService` with all 4 ops, validation, journal, tickTurn, serialize/restore + spec.
7. Wire into `CombatLoopService.resolveTurn()` (call `tickTurn` at the same slot as mortar ticks). Wire into `GameSessionService.teardownEncounter()` (call `reset`). Wire into `GameBoardComponent.restoreFromCheckpoint()` (new Step 3.5, before Step 4 towers).
8. Add the save payload field in `WaveCombatFacadeService.endTurn()`.
9. Perf stress spec.

At the end of sprint 9 the service is **real but has no callers**. Sprint 10 adds the shader + classifier reads. Sprint 11 is the first card that calls `build()`. Everything before sprint 11 is load-bearing groundwork with zero player-visible surface, and that's fine.

## 15. What would invalidate this design

- If playtest reveals pathfinding recompute is not <16ms at realistic mutation/enemy counts → cache keyed by (mutation-journal-version, start, end) instead of just (start, end), with eviction on any mutation. Known pattern, low risk.
- If Highground's elevation model requires `GameBoardTile` to grow a height field AND that field needs to be serialized per-tile, the mutation journal becomes the wrong abstraction — switch to a full per-tile override map. Bridge decision point: sprint 25 (Highground primitives).
- If `BoardMeshRegistryService` migrates to `InstancedMesh`, `replaceTileMesh` API survives but the internals switch to matrix+color updates. Non-breaking for `PathMutationService`.
