# Aim Subgroup Audit

Audit of the rotatable yaw subgroup for each tower type. Drives Phase B
per-tower aim wiring. For each tower: which named subgroup Phase B should
rotate for aim, and what work is required before that can happen.

---

## BASIC

**Existing rotatable subgroup:** `turretGroup` (THREE.Group, name `'turret'`).
Added in `TowerMeshFactoryService` at construction time. The barrel and all
turret-level parts (vents, accent sphere, pauldrons) are children of this
group. The idle ±5° swivel already rotates it via `group.rotation.y`.

**Phase B work:** Tag `turretGroup` via `userData['aimYawSubgroupName'] = 'turret'`.
No geometry changes. Register `aimTick` on the group. Suspend idle swivel
when `currentAimTarget` is non-null.

---

## SNIPER

**Existing rotatable subgroup:** None. The scope housing, scope lens (named
`'scope'`), longer T2 scope (`'scopeLong'`), barrel (`'barrel'`), bipods
(`'bipod'`), muzzle brake (`'muzzle'`), muzzle vents, and hover stabilizer
(`'stabilizer'`) are ALL direct children of `towerGroup`. The idle
phantom-target tracking mutates `group.rotation.y` directly, which yaws the
**entire tower** including the tripod base and struts — this is the I-4
finding (legs rotate with aim).

**Gap:** Needs a new `aimGroup` (THREE.Group) wrapping all the above
aim-relevant parts. The tripod base (post, 3 struts) stays as direct children
of `towerGroup` so they don't rotate. The `aimGroup` becomes the target for
both the existing phantom-yaw idle and the new aim tick.

**Phase B work:**
1. Create `aimGroup` at factory construction time, parented to `towerGroup`.
2. Re-parent: `scopeMesh`, `lensMesh`, `scopeLongMesh`, `barrelMesh`, both
   `bipod` meshes, `muzzleMesh`, both vent meshes, `stabMesh` → all move to
   `aimGroup.add(...)` instead of `towerGroup.add(...)`.
3. Fix idle tick: change `group.rotation.y` → `aimGroup.rotation.y` so struts
   no longer rotate. This closes the I-4 finding.
4. Fix recoil tick: `tickRecoilAnimations` targets the mesh named `'barrel'`
   which becomes a child of `aimGroup`. `getObjectByName('barrel')` still
   resolves through the group hierarchy — no recoil-tick change needed.
5. Fix `revealTierParts` (uses `traverse`) — already walks the full hierarchy,
   no change needed.
6. Tag `aimGroup` via `userData['aimYawSubgroupName'] = 'aimGroup'`.

**Predicted blow-ups:** Tier-visibility tags (`minTier`, `maxTier`) are on
individual meshes; `revealTierParts` uses `traverse` which recurses into
`aimGroup` — safe. The recoil barrel slide is in local Y of the barrel mesh
itself — unaffected by the parent's Y rotation.

---

## SPLASH

**Existing rotatable subgroup:** `drumGroup` (THREE.Group, name `'drum'`).
Rotates around its **forward axis** for the idle drum-spin (in-plane rotation,
not yaw). Tubes (`'tube1'`–`'tube8'`) are children of `drumGroup`. Heat vent
(`'heatVent'`) is a child of `drumGroup`.

**Gap:** The drum forward-spin is a roll, not a yaw. To aim the whole launcher
head at a target, a **parent yaw group** is needed above `drumGroup`. The
chassis base and side fins are static and must NOT rotate.

**Phase B work:**
1. Create `splashYaw` (THREE.Group) at factory construction time.
2. Move `drumGroup` from `towerGroup.add(drumGroup)` → `splashYaw.add(drumGroup)`.
3. Add `splashYaw` to `towerGroup` at the same Y position `drumGroup` was at.
4. Tag via `userData['aimYawSubgroupName'] = 'splashYaw'`.

**Notes:** The drum forward-spin (idle roll) composes correctly with the yaw
parent — the player will see the cluster spinning while tracking its target.
The belt detail and ammo rounds are direct children of `towerGroup`, so they
stay static (correct — ammo feed is chassis-level).

---

## SLOW

**Existing rotatable subgroup:** None. The emitter dish (`'emitter'`, a
concave SphereGeometry hemisphere) is a direct child of `towerGroup`, along
with the coil ring (`'coil'`), second coil (`'coil2'`), and crystal core
(`'crystalCore'`).

**Gap:** To aim only the emitter face (per design: coil ring + crystal core
stay static, only the emitter tracks), a yaw wrapper for just the emitter is
needed. Alternatively, all top-of-tower parts yaw together — but the design
intent is cleaner if just the emitter dish rotates (it's the "weapon" part).

**Phase B work:**
1. Create `slowYaw` (THREE.Group) wrapping only the `emitterMesh`.
2. Move `emitterMesh` from `towerGroup.add(emitterMesh)` → `slowYaw.add(emitterMesh)`.
3. Add `slowYaw` to `towerGroup`.
4. Tag via `userData['aimYawSubgroupName'] = 'slowYaw'`.

**Notes:** `tickEmitterPulses` uses `getObjectByName('emitter')` which resolves
through the hierarchy — no change needed. The `crystalCore`, `coil`, `coil2`
stay direct children of `towerGroup` (static).

---

## CHAIN

**Existing rotatable subgroup:** None. The floating sphere (`'sphere'`) and
the 4 radial electrode cones (`'electrode'`) are direct children of `towerGroup`,
along with the post, 3 coil tori, arc mesh (`'arc'`), and orbit spheres
(`'orbitSphere2'`, `'orbitSphere3'`).

**Gap:** For aim, the sphere + electrodes should yaw as a unit toward the
primary target. The Tesla coil post and coil tori (base structure) must stay
static. Orbit spheres are children of `towerGroup` — they should yaw with
the sphere for visual coherence (the orbit cluster "leans" toward the target).

**Phase B work:**
1. Create `chainYaw` (THREE.Group) at factory construction time.
2. Move `sphereMesh`, all 4 `electrode` meshes, `orbitMesh2`, `orbitMesh3`,
   and `arcMesh` into `chainYaw`.
3. Add `chainYaw` to `towerGroup` at Y=0 (the sphere Y is already encoded
   on `sphereMesh.position.y`).
4. Tag via `userData['aimYawSubgroupName'] = 'chainYaw'`.

**Notes:** `chargeTick` mutates the sphere's material `emissiveIntensity` via
`getObjectByName('sphere')` — resolves through hierarchy, no change. The
electrode shimmer phase is per-material-clone and is independent of yaw.

---

## MORTAR

**Existing rotatable subgroup:** `barrelPivot` (THREE.Group, name
`'barrelPivot'`). It rotates on X by `MORTAR_BARREL_ELEVATION_RAD` to
give the barrel its characteristic raised-angle silhouette. The barrels
(`'barrelT1'`, `'barrelT2'`, `'dualBarrel'`), cradle, and ammo crate are
all children of `barrelPivot`.

**Gap:** `barrelPivot` carries the fixed elevation rotation. If we yaw it
directly, the elevation tilts sideways instead of the barrel rotating in
the azimuth plane. A **parent yaw group** (`mortarYaw`) must sit above
`barrelPivot` so yaw (`rotation.y`) and elevation (`rotation.x`) are on
separate groups.

**Phase B work:**
1. Create `mortarYaw` (THREE.Group) at factory construction time.
2. Move `barrelPivot` from `towerGroup.add(barrelPivot)` → `mortarYaw.add(barrelPivot)`.
3. Add `mortarYaw` to `towerGroup` at Y=0 (position is on `barrelPivot` itself).
4. Tag via `userData['aimYawSubgroupName'] = 'mortarYaw'`.

**Notes:** The idle `barrelPivot` pitch oscillation (`MORTAR_IDLE_CONFIG`) uses
`getObjectByName('barrelPivot')` — resolves through `mortarYaw`, no change.
Recoil: `tickRecoilAnimations` reads `userData['mortarBarrelNames']` then calls
`getObjectByName(name)` — also resolves through the hierarchy. The barrel
`recoilBaseY` userData is on each barrel mesh and is in local Y (barrel-space),
unchanged by parent yaw.

---

## Summary table

| Tower  | Yaw subgroup   | Status at Phase A |
|--------|----------------|-------------------|
| BASIC  | `turret`       | Exists — tag only |
| SNIPER | `aimGroup`     | New group needed — re-parent scope+barrel+bipod+muzzle+stabilizer |
| SPLASH | `splashYaw`    | New group needed — wrap drumGroup |
| SLOW   | `slowYaw`      | New group needed — wrap emitter only |
| CHAIN  | `chainYaw`     | New group needed — wrap sphere+electrodes+orbits+arc |
| MORTAR | `mortarYaw`    | New group needed — wrap barrelPivot |

Phase B order (easiest first): BASIC → MORTAR → SNIPER → SPLASH → SLOW → CHAIN.
