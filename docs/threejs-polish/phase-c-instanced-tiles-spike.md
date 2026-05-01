# Phase C — InstancedMesh tile migration spike

Architecture design for sprints 21–30. Locked 2026-04-29 before any sprint 21 code.

## Status quo (post Phase B)

- One `THREE.Mesh` per `(row, col)` slot. Stored in `BoardMeshRegistryService.tileMeshes: Map<string, Mesh>`.
- `BoxGeometry` shared across all tiles via `GeometryRegistry.getBox(footprint, height, footprint)`.
- `MeshStandardMaterial` cached per `BlockType` via `MaterialRegistry.getOrCreate('tile:<type>', factory)`.
- Each tile carries `userData = { row, col, tile }`.
- Highlights work by mutating `mesh.material.emissive` — **broken** under sprint 14's cached materials (highlight on tile A bleeds to all BASE tiles). Latent because typical hover only highlights one tile at a time, and the userData['origEmissive'] save-then-restore happens to mostly mask the leak.

## Latent aliasing bug

Sprint 14 made tile materials registry-shared. `TileHighlightService.updateHighlights` writes `mat.emissive.setHex(color)` directly. Every BASE tile shares the same material instance — so highlighting tile A turns ALL BASE tiles bright. The userData['origEmissive'] save-then-restore pattern doesn't help because the saved value is the already-mutated emissive by the time tile B is highlighted.

**Fix lives inside the migration:** BASE tiles move to InstancedMesh + per-instance color via `InstancedBufferAttribute`, which is per-instance by definition.

## Design

### Per-BlockType InstancedMesh

```
tileInstancedMeshes: Map<BlockType, InstancedMesh>
```

One `InstancedMesh` per BlockType that has tiles on the board. Each instance represents one (row, col) slot.

Phase C adoption order:
- Sprint 21: BASE tiles only
- Sprint 22: + WALL
- Sprint 23: + SPAWNER, EXIT, AMBUSH
- (Walls, spawners, exits don't get hover highlights — only BASE — so the instanceColor migration is meaningful only for BASE.)

### Coordinate lookup tables

Two new structures inside `BoardMeshRegistryService` (or a new sub-service if it gets crowded):

```typescript
// row,col → which instanced mesh and which instance index inside it
tileInstanceMap: Map<string, { mesh: InstancedMesh; index: number }>;

// Per InstancedMesh: instance index → row,col (raycasting hit resolution).
// Stored as a parallel array indexed by instance ID.
instanceIdToCoord: Map<InstancedMesh, Array<{ row: number; col: number }>>;
```

`tileMeshes: Map<string, Mesh>` stays for any tile types Phase C hasn't migrated yet (so BASE-only sprint 21 still has WALL/SPAWNER/EXIT as individual meshes). After sprint 23, `tileMeshes` is empty for tile rendering — only used for special cases if they emerge.

### Raycasting flow

`getTileMeshArray()` becomes `getTilePickables(): Array<Mesh | InstancedMesh>`:
- Includes both InstancedMesh objects AND any remaining individual tile meshes.

Hit resolution:
```typescript
const hit = intersects[0];
if (hit.object instanceof InstancedMesh) {
  const coord = registry.lookupInstanceCoord(hit.object, hit.instanceId!);
  // coord.row, coord.col
} else {
  const m = hit.object as Mesh;
  // m.userData.row, m.userData.col
}
```

Both call sites (`BoardPointerService.onMouseMove`, `BoardPointerService.onClick`, `TowerPlacementService.onDragMove`, `TowerPlacementService.onDragEnd`) get this branch.

### Highlights — instanceColor strategy

`InstancedMesh` supports `mesh.setColorAt(index, color)` + `instanceColor.needsUpdate = true`. The color multiplies with the material's base color in the fragment shader.

**Current emissive-bump highlight** can't be replicated cleanly via instanceColor alone (the multiplicative tint affects diffuse, not emissive). Two options:

**A. Switch to color-tint highlight (recommended).** Drop the emissive-bump pattern entirely for instanced tiles. Highlight = brighter `instanceColor` (e.g. `1.4× base color`). Cleanup = identity color (1, 1, 1). Visually different from current (slightly less glowy) but readable and has zero shader-injection complexity.

**B. Inject instanceColor into emissive via `material.onBeforeCompile`.** Add a uniform that multiplies the base emissive by `vColor` (the instanced color attribute). Preserves the current visual but adds shader maintenance burden.

Sprint 21 ships option A. Visual diff vs. main is small; if playtest hates it, option B is a follow-up sprint. Document the choice in the sprint commit.

### Static vs. dynamic instances

InstancedMesh has two cost knobs:
- `mesh.instanceMatrix.usage = THREE.StaticDrawUsage` — set once, never updated. Best for tiles whose position never changes (most BASE tiles).
- `mesh.instanceMatrix.usage = THREE.DynamicDrawUsage` — written per-frame. Required for elevation animation (sprint 25).

Default to `DynamicDrawUsage` for now (elevation ticks Y position via `translateTileMesh`). Sprint 25 confirms.

### Terraform mutation

When a tile mutates BASE → BUILD path or BASE → BLOCK:
- Currently: dispose old Mesh, create new Mesh with mutationOp's pool material, add to scene, replace registry entry.
- Post-Phase-C: tile is already in the InstancedMesh's slot at index N. Mutation needs to swap WHICH InstancedMesh owns this slot.

Design: each (row, col) is "claimed" by exactly one InstancedMesh at any time. To mutate:
1. Find current owner via `tileInstanceMap[key]`.
2. Move the owner instance's matrix off-screen (or reduce instance count if it's the last).
3. Append a new instance to the target type's InstancedMesh.
4. Update `tileInstanceMap[key]` and `instanceIdToCoord[newMesh]`.

That works but is fiddly because InstancedMesh doesn't support cheap deletion mid-array. Simpler approach: each InstancedMesh allocates `count = totalBoardSlots` and uses `mesh.count = N visible`. Move-off-screen is just `setMatrixAt(idx, hiddenMatrix)`.

Even simpler: since terraform mutation introduces NEW BlockTypes (BUILD / BLOCK / DESTROY / BRIDGEHEAD path materials), handle these via `TerraformMaterialPoolService` and **keep them as individual meshes** rather than instancing. They're rare (a few per encounter) and pre-existing TerraformMaterialPool design already handles the disposal contract. Only the static base/wall/spawner/exit grid uses InstancedMesh.

Decision for sprint 24: **mutation tiles stay individual meshes**. To mutate:
1. Find source slot in InstancedMesh, hide it (move matrix off-screen).
2. Create individual mutation Mesh as today (createTileMesh with mutationOp).
3. Place it at the (row, col) world coords.
4. Track in a separate `mutationTileMeshes: Map<string, Mesh>` so revert can restore.

Revert:
1. Dispose mutation Mesh (skip pool material).
2. Restore InstancedMesh slot's matrix to original.

This bypasses the instance-count fragility entirely and keeps the mutation visual contract intact.

### Cliff stacking (sprint 25)

Cliffs sit ON TOP of tiles. Each cliff is its own Mesh in `cliffMeshes` map. Tile InstancedMesh at the cliff base is translated up by elevation. Instance matrix Y change goes through a new `setInstanceMatrixY(mesh, index, y)` helper.

Cliff geometry is registry-shared per height; cliff material is pool-shared. Already in place from Phase B.

### Hover/select/range highlights (sprint 26)

`TileHighlightService` API stays the same, internals switch:
- `highlightedTiles: Set<string>` — same.
- For each highlighted tile, look up its (mesh, index) via `tileInstanceMap`.
- Set `mesh.setColorAt(index, highlightColor)`, mark `instanceColor.needsUpdate = true`.
- Save state in a parallel `Map<string, OriginalInstanceColor>` instead of mesh.userData.

Range visualization service is already independent of the tile mesh model (gridToWorld math + dedicated ring meshes). Zero change.

### Restore-from-checkpoint (no version bump needed)

Restore re-runs `renderGameBoard` to rebuild the InstancedMesh. Since instance state is fully derived from board state (BlockType + elevation + active mutations), no new on-the-wire data. CHECKPOINT_VERSION stays at 10.

`pathMutationService.swapMesh` and `elevationService.translateTileMesh` are the only mid-encounter callers that touch tile meshes. Both get rewritten (or routed through helpers) but the public contract is unchanged.

### Editor parity (sprint 29)

Editor uses `terrain-grid.class.ts`, NOT `BoardMeshRegistryService`. Same migration shape: per-BlockType InstancedMesh. Editor's paint mode mutates colors per-cell, so it needs the instanceColor migration in lockstep with the game.

Defer until sprints 21–28 are stable in the game. Editor migration is mechanical once the game pattern is locked.

### Disposal contract

InstancedMesh disposal is `mesh.dispose()` + `scene.remove(mesh)`. Geometry comes from GeometryRegistry (not disposed by the InstancedMesh — registry owns it). Material comes from MaterialRegistry (same).

`buildDisposeProtect` already protects registry resources. The only addition: a list of InstancedMesh objects to dispose in `cleanupScene`. Add a `clearTileInstancedMeshes(scene)` helper on the registry and call it from `GameSessionService.cleanupScene`.

## Plan execution order

| Sprint | Lands |
|---|---|
| 21 | BASE InstancedMesh + raycasting + instanceColor highlights for BASE only. WALL/SPAWNER/EXIT remain individual. Latent emissive aliasing bug fixed for BASE. |
| 22 | WALL InstancedMesh added. No highlights for WALL — straightforward. |
| 23 | SPAWNER, EXIT, AMBUSH InstancedMesh added. |
| 24 | Terraform mutation: hide source instance, allocate individual mutation Mesh; revert restores instance. |
| 25 | Cliff stacking on instanced base — translate instance Y on elevation change. |
| 26 | Range overlay + hover/select highlights — finalise instanceColor strategy across all tile types. |
| 27 | `castShadow = false` on instanced tiles (cuts shadow-map draws). |
| 28 | Grid lines collapse to single LineSegments. |
| 29 | Editor parity. |
| 30 | Red-team + draw-call benchmark. |

## Predicted blow-ups

1. **InstancedMesh + raycasting performance** — raycast cost is per-instance unless `mesh.computeBoundsTree()` (or three-mesh-bvh) is used. For 196 instances on a 14×14 board, brute-force per-instance ray test should be fine. Benchmark in sprint 30.
2. **Three.js version of instanceColor** — `setColorAt` needs Three.js r136+. We're on 0.170 — fine.
3. **`instanceColor` doesn't multiply emissive** — accepted in design. Option B is a follow-up if visual diff is too big.
4. **Hidden instances via "off-screen matrix"** — `mesh.setMatrixAt(idx, hiddenMatrix)` works but the instance still raycasts. Need to track which instance indices are "live" so raycast lookup ignores hidden ones, OR set `count` smaller and reorder indices. Sprint 24 decides.
5. **Test suite** — many tile-mesh-related specs assume `tileMeshes` is a `Map<string, Mesh>`. Add a compatibility shim during migration so existing specs pass; remove the shim after sprint 23.

## Test strategy

- Sprint 21 keeps existing tile specs passing (BASE migration only; tile spec coverage of WALL/SPAWNER/EXIT unaffected).
- Add `BoardMeshRegistry` specs for `tileInstanceMap` lookup, `instanceIdToCoord` resolution, replaceTileMesh delegation.
- Add `BoardPointerService` raycasting spec that covers both paths (instanceId branch + userData branch).
- Add `TileHighlightService` spec that asserts highlighting tile A does NOT alias tile B.

Aliasing-guard spec is the most important: it would have caught the latent Phase B bug had it existed.
