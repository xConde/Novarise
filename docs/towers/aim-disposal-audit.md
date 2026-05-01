# Tower Aim — Disposal Audit

**Branch:** feat/threejs-polish  
**Audited:** 2026-04-30 (Phase E sprint 48)

Confirms every resource introduced by the aim subsystem (Phases 0 + A-D) is
correctly disposed on encounter teardown and route change.

---

## 1. Yaw wrapper groups

Five new THREE.Group wrappers were added in Phase B to allow per-tower yaw
without disturbing elevation or counter-rotation on sibling parts. All five are
direct children of `towerGroup`, which is the root object passed to `disposeGroup`
during sell/teardown.

| Tower | Yaw group name | Parented to | Disposal path |
|---|---|---|---|
| BASIC | `turret` (pre-existing) | `towerGroup` | `disposeGroup` traverse |
| SNIPER | `aimGroup` | `towerGroup` | `disposeGroup` traverse |
| SPLASH | `splashYaw` | `towerGroup` | `disposeGroup` traverse |
| SLOW | `slowYaw` | `towerGroup` | `disposeGroup` traverse |
| CHAIN | `chainYaw` | `towerGroup` | `disposeGroup` traverse |
| MORTAR | `mortarYaw` | `towerGroup` | `disposeGroup` traverse |

`disposeGroup` (`three-utils.ts`) calls `group.traverse()` which does a
depth-first walk of the entire scene-graph subtree. Any mesh at any depth — including
meshes nested two or three levels deep (e.g. `mortarYaw → barrelPivot → barrelT1`)
— will have `geometry.dispose()` and `material.dispose()` called.

**Verified by spec:** `tower-mesh-factory.service.spec.ts` > "Phase E disposal
audit" > `${type}: disposeGroup calls geometry.dispose on a mesh inside ${subgroupName}`
for all 6 tower types.

---

## 2. AimLineService (aim-line cylinder)

`AimLineService` manages one THREE.Mesh (`lineMesh`) + one `CylinderGeometry`
(`lineGeo`) + one `MeshBasicMaterial` (`lineMat`). These are created lazily on
first aim-line display and reused each frame.

**Disposal paths (defense in depth):**

| Path | Trigger | Clears |
|---|---|---|
| `cleanup()` | `GameSessionService.cleanupScene()` | lineMesh removed from scene, geo+mat disposed, all refs set to null |
| `ngOnDestroy()` | Angular component teardown (route change) | delegates to `cleanup()` |

Both paths call `cleanup()` which:
1. Removes `lineMesh` from `attachedScene`
2. Calls `lineGeo.dispose()` and `lineMat.dispose()`
3. Sets all four refs (`lineMesh`, `lineGeo`, `lineMat`, `attachedScene`) to `null`

Re-entry safe: `cleanup()` guards on `lineMesh !== null` before disposal.

**Verified by spec:** `aim-line.service.spec.ts` > "ngOnDestroy delegates to
cleanup()" and "cleanup() removes lineMesh from scene and disposes geo + mat".

---

## 3. TargetPreviewService subscriptions

`TargetPreviewService` holds one `Subscription` (the `EnemyService.getEnemiesChanged`
subscription wired in `wireEnemySubscription`).

| Path | Trigger | Clears |
|---|---|---|
| `ngOnDestroy()` | Angular component teardown | `this.subscriptions.unsubscribe()` |

The service is component-scoped (`GameBoardComponent.providers`). Angular calls
`ngOnDestroy` on all component-scoped providers when the component is destroyed.

**No additional teardown needed.** The `cache` and `dirty` sets are plain
JavaScript objects with no GPU resources — they are GC'd with the service instance.

**Verified by spec:** `target-preview.service.spec.ts` > "ngOnDestroy unsubscribes
the EnemyService subscription".

---

## 4. EnemyService.enemiesChanged Subject

`EnemyService.enemiesChanged` is a `Subject<'spawn' | 'move' | 'remove'>` stored
as a private instance field. `Subject` does not need to be explicitly `complete()`d
to prevent subscriber memory leaks — subscribers are responsible for their own
unsubscription (handled by `TargetPreviewService.ngOnDestroy` above).

**Design note:** The Subject is NOT completed in `cleanup()` intentionally. A completed
Subject would reject future `next()` calls, which would cause errors if `cleanup()` is
called and then the encounter is restarted (new enemies spawned) before the Angular
component is fully torn down. Leaving the Subject open and relying on subscriber-side
unsubscription is the correct pattern for component-scoped services with restart
semantics.

**Verified:** `enemy.service.spec.ts` and the Finding C-1 fix confirm the Subject
emits exactly once from `cleanup()` (not per-enemy).

---

## 5. Aim userData fields (no GPU resources)

The following `userData` fields are written by the aim subsystem and cleared
naturally when the tower group is disposed:

| Field | Type | Written by | Cleared by |
|---|---|---|---|
| `aimTick` | function | Tower mesh factory | Group GC after `disposeGroup` |
| `aimYawSubgroupName` | string | Tower mesh factory | Group GC |
| `currentAimTarget` | Enemy ref / null | `tickAim` | Group GC |
| `noTargetGraceTime` | number | `tickAim` | Group GC |
| `aimEngaged` | boolean | `tickAim` | Group GC |

None of these hold GPU resources (no geometries, textures, or materials). They
are JavaScript values on the group's `userData` object, released by the garbage
collector when the group reference count drops to zero after `disposeGroup` removes
it from the scene.

No explicit clearance needed.

---

## 6. Verified disposal integration

`tower-mesh-factory.service.spec.ts` > "Phase E disposal audit" contains:

- **6 per-type specs** confirming `geometry.dispose` is called on a mesh nested
  inside each tower's aim-yaw subgroup when `disposeGroup(towerGroup)` is called.
- **1 all-types spec** confirming all 6 tower types dispose without throwing after
  aim-wiring subgroups are present.

Total new specs in this audit: **7** (added to Phase B aim wiring section of the
factory spec).

---

## Do-not-regress checklist

- `disposeGroup` must remain a full `traverse`-based walk — any optimization that
  skips sub-groups at depth > 1 would break aim-group disposal.
- `AimLineService.cleanup()` must be called from BOTH `GameSessionService.cleanupScene()`
  AND `ngOnDestroy()` — do not remove either path.
- `TargetPreviewService.ngOnDestroy()` must call `this.subscriptions.unsubscribe()` —
  without it the EnemyService subscription leaks across encounters if Angular's
  component teardown runs before the subscription is manually cleared.
- Do not `complete()` `EnemyService.enemiesChanged` in `cleanup()` — that would
  break encounter restarts.
