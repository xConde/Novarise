# Tower Visual Polish — Disposal Audit (Sprint 66)

**Date:** 2026-04-30
**Branch:** feat/threejs-polish

All paths verified by code inspection against:
- `src/app/game/game-board/services/tower-mesh-factory.service.ts`
- `src/app/game/game-board/services/tower-mesh-lifecycle.service.ts`
- `src/app/game/game-board/services/game-session.service.ts`
- `src/app/game/game-board/services/tower-decal-library.service.ts`
- `src/app/game/game-board/utils/three-utils.ts` (`disposeGroup`, `buildDisposeProtect`)

---

## Disposal lifecycle summary

All tower groups are disposed via `GameSessionService.cleanupScene()`, which runs at
encounter teardown and encounter restart. The flow per tower group:

```
cleanupScene()
  → meshRegistry.towerMeshes.forEach(group => disposeGroup(group, scene, protect))
      → protect(geom) → geometryRegistry.has(geom) — if true, SKIP disposal
      → protect(mat)  → materialRegistry.has(mat)  — if true, SKIP disposal
      → traverse all meshes: dispose geometry and material unless protected
  → geometryRegistry.dispose()   — disposes all cached geometries
  → materialRegistry.dispose()   — disposes all cached materials
  → towerDecalLibrary.dispose()  — disposes all CanvasTexture decal entries
```

The registry protect predicate prevents double-disposal: shared geometries and materials
are protected from `disposeGroup`'s per-mesh pass, then disposed once in the batch pass.
Per-instance clones (not registered) are disposed by the per-mesh pass.

---

## Per-tower-type allocation and disposal path

### BASIC

| Resource | Type | Allocation | Disposal path |
|----------|------|-----------|---------------|
| Body geometry ×8 primitives | `BufferGeometry` (registry) | `geometryRegistry.getCylinder/getBox` | `geometryRegistry.dispose()` |
| Body material | `MeshStandardMaterial` (registry) | `materialRegistry.getOrCreate('tower:BASIC')` | `materialRegistry.dispose()` |
| Accent sphere material | `MeshStandardMaterial` (registry) | `materialRegistry.getOrCreate('basic:accentSphere')` | `materialRegistry.dispose()` |
| Accent PointLight | `THREE.PointLight` | `new THREE.PointLight(...)` in `attachAccentLight` | Removed from scene when group is removed; no GPU resource |

**Result:** No leak path. Registry-owned, disposed in batch.

---

### SNIPER

| Resource | Type | Allocation | Disposal path |
|----------|------|-----------|---------------|
| Body geometry ×9 primitives | `BufferGeometry` (registry) | `geometryRegistry.getCylinder/getOctahedron` | `geometryRegistry.dispose()` |
| Body material | `MeshStandardMaterial` (registry) | `materialRegistry.getOrCreate('tower:SNIPER')` | `materialRegistry.dispose()` |
| Lens material | `MeshStandardMaterial` (registry) | `materialRegistry.getOrCreate('sniper:scopeLens')` | `materialRegistry.dispose()` |
| Accent PointLight | `THREE.PointLight` | `new THREE.PointLight(...)` | No GPU resource; removed with group |

**Known aesthetic issue (not a leak):** The `sniper:scopeLens` material is registry-shared.
Two SNIPER towers on the same board mutate `emissiveIntensity` on the same material instance,
so their lenses pulse in sync. This is a visual artefact flagged in `docs/towers/material-audit.md`.
No disposal leak — shared material is disposed once in the registry batch pass.

**Result:** No leak path.

---

### SPLASH

| Resource | Type | Allocation | Disposal path |
|----------|------|-----------|---------------|
| Body geometry ×4 primitives | `BufferGeometry` (registry) | `geometryRegistry.getCylinder/getBox` | `geometryRegistry.dispose()` |
| Body material | `MeshStandardMaterial` (registry) | `materialRegistry.getOrCreate('tower:SPLASH')` | `materialRegistry.dispose()` |
| Tube materials (×4 T1, ×6 T2, ×8 T3) | `MeshStandardMaterial` (per-instance clone) | `mat.clone()` in factory | `disposeGroup` recursive walk — NOT registry-protected |
| Heat-vent material | `MeshStandardMaterial` (registry) | `materialRegistry.getOrCreate('splash:heatVent')` | `materialRegistry.dispose()` |
| Accent PointLight | `THREE.PointLight` | `new THREE.PointLight(...)` | No GPU resource |

**Tube clone disposal confirmed:** Each tube clone is created with `mat.clone()` — the
`materialRegistry.has()` guard returns `false` for clones (the registry holds the prototype,
not clones). `disposeGroup` disposes each clone individually. Verified by reading
`buildDisposeProtect` and `disposeGroup` in `three-utils.ts`.

**Result:** No leak path. Tube clones disposed via `disposeGroup`.

---

### SLOW

| Resource | Type | Allocation | Disposal path |
|----------|------|-----------|---------------|
| Body geometry ×3 primitives | `BufferGeometry` (registry) | `geometryRegistry.getOctahedron/getCylinder/getTorus` | `geometryRegistry.dispose()` |
| Body material | `MeshStandardMaterial` (registry) | `materialRegistry.getOrCreate('tower:SLOW')` | `materialRegistry.dispose()` |
| Emitter material (per-instance clone) | `MeshStandardMaterial` (clone) | `materialRegistry.getOrCreate('slow:emitter') + .clone()` | `disposeGroup` recursive walk |
| Accent PointLight | `THREE.PointLight` | `new THREE.PointLight(...)` | No GPU resource |

**Emitter clone disposal confirmed:** Same pattern as SLOW tubes. The `slow:emitter` registry
entry is the prototype; the `.clone()` result is not in the registry. `disposeGroup` disposes
the clone on the per-mesh pass.

**Result:** No leak path.

---

### CHAIN

| Resource | Type | Allocation | Disposal path |
|----------|------|-----------|---------------|
| Body geometry ×5 primitives | `BufferGeometry` (registry) | `geometryRegistry.getCylinder/getTorus/getSphere` | `geometryRegistry.dispose()` |
| Body material | `MeshStandardMaterial` (registry) | `materialRegistry.getOrCreate('tower:CHAIN')` | `materialRegistry.dispose()` |
| Sphere material (per-instance clone) | `MeshStandardMaterial` (clone) | `chain:sphere` proto + `.clone()` | `disposeGroup` recursive walk |
| Electrode materials ×4 (per-instance clones) | `MeshStandardMaterial` (clone) | `chain:electrode` proto + `.clone()` × 4 | `disposeGroup` recursive walk |
| Arc material | `MeshStandardMaterial` (raw `new`) | `new THREE.MeshStandardMaterial(...)` — intentionally NOT registered | `disposeGroup` recursive walk |
| Orbit sphere materials (T2/T3) | `MeshStandardMaterial` (clone) | `chain:orbitSphere` proto + `.clone()` | `disposeGroup` recursive walk |
| Accent PointLight | `THREE.PointLight` | `new THREE.PointLight(...)` | No GPU resource |

**Arc material disposal confirmed:** The arc `MeshStandardMaterial` is created with raw
`new` and intentionally excluded from the registry (it needs per-instance opacity animation
and there is no shared prototype for it). Because it is unregistered, `materialRegistry.has()`
returns `false`, and `disposeGroup`'s full-traverse path disposes it. Factory comment
documents this intentional pattern.

**Result:** No leak path.

---

### MORTAR

| Resource | Type | Allocation | Disposal path |
|----------|------|-----------|---------------|
| Body geometry ×4 primitives | `BufferGeometry` (registry) | `geometryRegistry.getCylinder/getBox` | `geometryRegistry.dispose()` |
| Body material (per-instance clone) | `MeshStandardMaterial` (clone) | `tower:MORTAR` proto + `.clone()` | `disposeGroup` recursive walk |
| Accent PointLight | `THREE.PointLight` | `new THREE.PointLight(...)` | No GPU resource |

**Per-instance body clone:** MORTAR clones the entire body material so `startMuzzleFlash`
can mutate emissive on one tower without affecting others (Finding G-1 fix). All body
meshes within a single MORTAR group share the one clone. Because the clone is not in the
registry, `disposeGroup` disposes it on the per-mesh pass.

**Result:** No leak path.

---

## Decal textures

`TowerDecalLibraryService` is a lazy-initialized `CanvasTexture` cache. It holds textures
that are applied as decal maps on tower body materials.

**Disposal path:** `GameSessionService.cleanupScene()` calls `this.towerDecalLibrary?.dispose()`
after all tower meshes have been disposed. `TowerDecalLibraryService.dispose()` iterates the
internal cache map and calls `.dispose()` on each `CanvasTexture`. Verified by reading
`game-session.service.ts` lines ~248–250.

**Result:** No leak path.

---

## Point lights

`THREE.PointLight` has no GPU-side resources to dispose (it is a uniform upload, not a
buffer). When a tower group is removed from the scene, the `PointLight` child is removed
with it. No explicit `.dispose()` call is required or needed.

---

## Sell animation path (animated = true)

`TowerMeshLifecycleService.removeMesh(key, animated=true)` sets `userData['selling'] = true`
and defers disposal. The group stays in the registry during the animation. When
`tickSellAnimations` calls `onExpire`, `removeMesh(key, false)` is called, which runs
the synchronous `disposeGroup` path. No resource is permanently retained.

**Edge case — encounter teardown mid-sell-animation:** `GameSessionService.cleanupScene()`
calls `disposeGroup` on every group in `towerMeshes`, including groups still animating a
sell. The `selling` guard in `removeMesh` is cleared first (`group.userData['selling'] =
false`), then `disposeGroup` runs. No leak.

---

## Conclusion

All disposal paths verified clean. No GPU resource leak in any identified path. The
registry protect predicate and `disposeGroup` full-traverse together cover 100% of
allocated resources.
