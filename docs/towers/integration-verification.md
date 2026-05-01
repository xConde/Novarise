# Phase H Integration Verification — Sprints 54-57

## Sprint 54 — Range-ring color

**File:** `src/app/game/game-board/services/tower-preview.service.ts`

Range ring / placement ghost color derives from `TOWER_CONFIGS[towerType].color`
(line ~69). `TOWER_CONFIGS.color` was updated in the precursor palette-desaturation
commit to match each tower's new body hue. No changes needed.

All 6 placement previews read their color from the same source as projectiles and
the HUD panel label — the single-source-of-truth is intact.

## Sprint 55 — Placement-preview ghost traversal

**File:** `src/app/game/game-board/services/tower-preview.service.ts`

The ghost is built by calling `TowerMeshFactoryService.createTowerMesh()` and then:

```ts
ghostGroup.traverse((child) => {
  if (child instanceof THREE.Mesh) {
    child.material = new THREE.MeshBasicMaterial({ ... });
    ghostMaterials.push(mat);
  }
});
```

`THREE.Group.traverse` visits the ENTIRE subtree depth-first, including children of
nested groups. All redesigned towers use nested groups:

- BASIC: `turretGroup` > `barrelGroup` > barrel meshes
- SPLASH: `drumGroup` > tubes
- MORTAR: `barrelPivot` > barrel meshes

The traverse correctly reaches all descendant meshes. Per-instance materials
(SPLASH tube clones, SLOW emitter clone, CHAIN electrode/sphere clones, MORTAR
per-instance mat) are overwritten in-place with the ghost `MeshBasicMaterial` —
this is safe because the ghost factory creates a fresh group (not the live tower
group) and all clones within it are discarded when `disposeMeshes()` is called.

**Result:** Ghost works correctly for all 6 redesigned tower types. No fix needed.

## Sprint 56 — Selection halo / glow ring

**File:** `src/app/game/game-board/services/tower-upgrade-visual.service.ts`

`addGlowRing` places a `RingGeometry` flat on the ground at `y = 0.02 + elevation`.
This is a world-Y position — it sits just above the tile surface regardless of the
tower mesh height above it. The ring is a ground decal, not attached to the tower
mesh, so the wider MORTAR chassis (0.18u high) does not affect ring visibility.

MORTAR chassis height is 0.18u in world space (before the 1.4× group scale = ~0.25u).
The ring at y = 0.02 sits below the tile-top surface (y = 0.20 = tileHeight), which
means the ring is slightly buried — but this was the same for all towers before the
redesign. The ring uses `depthWrite: false` and a slight Y offset to avoid z-fighting
on the tile top. This is a pre-existing design choice and is not regressed by Phase G.

`spawnUpgradeFlash`: the sprite spawns at `position.y + 0.5`. For a tower at world
Y = tileHeight (0.2) this is y = 0.7, which clears all tower heights (tallest is
CHAIN at ~1.25u world height before scale). No clipping risk.

`applyUpgradeVisuals` scale ramp:
```ts
const scale = TOWER_VISUAL_CONFIG.scaleBase + (newLevel - 1) * TOWER_VISUAL_CONFIG.scaleIncrement;
towerGroup.scale.set(scale, scale, scale);
```
Applied uniformly to the whole group. Works for all new geometries since all
tier-specific geometry was baked into the group at creation time with `minTier`/
`maxTier` guards.

**Result:** No changes needed.

## Sprint 57 — Upgrade-tier-up animation

**File:** `src/app/game/game-board/services/tower-upgrade-visual.service.ts`

`revealTierParts` traverses the group and sets `.visible` based on `userData['minTier']`
and `userData['maxTier']`. All redesigned towers bake their tier parts at creation
time with correct tier tags:

| Tower  | T2 part            | T3 part(s)                      |
|--------|--------------------|---------------------------------|
| BASIC  | `barrelCap`        | `pauldron` ×2                   |
| SNIPER | `scopeLong`        | `stabilizer` (bipods hidden)    |
| SPLASH | `tube5`, `tube6`   | `tube7`, `tube8`, `heatVent`    |
| SLOW   | `coil2`            | `crystalCore`                   |
| CHAIN  | `orbitSphere2`     | `orbitSphere3`                  |
| MORTAR | `barrelT2`         | `dualBarrel` (barrelT1 hidden)  |

The flash sprite spawns at `position.y + 0.5` (world Y). The `upgrade flash` is
size-expanding and short-lived (~0.2s), so any tower height is fully covered.

**Result:** Tier-up animation verified correct for all 6 types. No changes needed.
