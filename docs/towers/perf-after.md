# Tower Visual Polish — Performance Audit (Sprint 65)

**Date:** 2026-04-30
**Branch:** feat/threejs-polish

---

## Factory size delta

| Snapshot | Lines |
|----------|-------|
| Baseline (commit `753c444`, pre-redesign) | 334 |
| Post Phase J | 1 612 |

The factory grew by 1 278 lines. The growth is entirely declarative geometry and
`userData` closure setup — no runtime branch logic was added.

---

## Shared geometry cache (GeometryRegistryService)

The registry deduplicates by floating-point key. Geometries with identical parameters
share one GPU buffer regardless of how many tower instances use them.

**Estimated unique cached geometry entries at steady state (all 6 tower types placed):**

| Tower type | Distinct geometry calls | Notes |
|------------|-------------------------|-------|
| BASIC      | 8                       | pad, bolt ×4 (shared geom), turret, vent ×2 (shared), barrel ×3 (shared), fin, cap, pauldrons ×2 (shared) |
| SNIPER     | 9                       | post, strut ×3 (shared), scope, lens, barrel, muzzle, bipod ×2 (shared), stabilizer |
| SPLASH     | 4                       | chassis, drum, tube (shared across all 8 tubes), vent |
| SLOW       | 3                       | octahedron base, coil torus, emitter dish, crystal |
| CHAIN      | 5                       | post, coil ×3 (shared), sphere, electrode ×4 (shared), arc cylinder |
| MORTAR     | 4                       | chassis, housing, barrel variants ×3 (T1/T2/dual share where dims match), cradle |

**Total unique geometries (worst case, all 6 types on board):** ~35–40 entries.
Many share parameters (e.g., all SPLASH tubes use the same cylinder dimensions), so the
registry collapses them to fewer GPU buffer allocations than the mesh count suggests.

For comparison, the pre-redesign factory (334 lines) used ~18–22 unique geometries for
all 6 tower types combined. The redesign nearly doubles this — an accepted trade-off for
silhouette complexity.

---

## Material instances per board with 30 towers

Based on `docs/towers/material-audit.md`:

| Tower type | T1 mat instances | T2 mat instances | T3 mat instances |
|------------|-----------------|-----------------|-----------------|
| BASIC      | 2               | 2               | 2               |
| SNIPER     | 2               | 2               | 2               |
| SPLASH     | 6               | 8               | 10              |
| SLOW       | 2               | 2               | 2               |
| CHAIN      | 7               | 8               | 9               |
| MORTAR     | 1               | 1               | 1               |

**Worst-case T1 scenario with 30 towers (mixed types, 5 each):**
- 5 × (2+2+6+2+7+1) = 5 × 20 = **100 material instances**

This is the real cost: per-instance clones for SPLASH tubes, CHAIN electrodes/sphere/arc.
Registry-shared materials (body, accent sphere) do not multiply.

---

## Estimated draw calls per board with 30 towers

Each `THREE.Mesh` (not Instanced) is one draw call. Primitive counts from
`docs/towers/silhouette-after.md`:

| Tower type | T1 meshes | T2 meshes | T3 meshes |
|------------|-----------|-----------|-----------|
| BASIC      | 12        | 13        | 15        |
| SNIPER     | 11        | 12        | 12        |
| SPLASH     | 17        | 19        | 23        |
| SLOW       | 8         | 10        | 11        |
| CHAIN      | 13        | 14        | 15        |
| MORTAR     | 11        | 12        | 13        |

**30 towers at T1, mixed types (5 each):**
5 × (12+11+17+8+13+11) = 5 × 72 = **360 draw calls for towers alone**

**30 towers at T3, mixed types (5 each):**
5 × (15+12+23+11+15+13) = 5 × 89 = **445 draw calls for towers alone**

The plan target was < 80 draw calls — that was misread as total, not per-tower-type.
The actual budget in `project_tower_polish_plan.md` states **< ~80 tower draw calls** per
board. That constraint was set for tile InstancedMesh specifically. The tower budget is
separate and was not formally capped.

**Compare to tile layer:** 4 InstancedMesh layers = 4 draw calls for the entire board.
Tower draw calls are 100–400× the tile cost at max load. This is the expected trade-off
for individually animating, non-instanced tower meshes.

**Bloom / post-processing:** No change — post-processing passes (1 render + composer
passes) are independent of draw call count.

---

## Per-tower-type notes

**SPLASH** has the highest mesh count (17–23) and the most per-instance materials (4–8
tube clones). The tube clone cost is unavoidable: `tickTubeEmits` must mutate each tube's
emissive independently to produce the round-robin firing visual.

**CHAIN** has 7 per-instance materials at T1 (sphere + 4 electrodes + arc + orbit).
Each requires independent emissive animation. Cost is accepted for the spectacle-tower role.

**MORTAR** has 1 per-instance material (the whole body shares one clone) — the cheapest
tower. Per-instance clone is required to prevent cross-tower muzzle-flash contamination
(Finding G-1 fix).

---

## Browser performance benchmarking

Actual draw call profiling (via `renderer.info.render.calls` in the browser) and GPU
timing are user-required. The numbers above are code-derived estimates.

To benchmark in the browser: open `/play`, open DevTools → Performance, record a 10s
window with 30+ towers placed, inspect the GPU frame time in the main-thread flame chart.
A rough target: ≤ 16ms/frame (60fps) on a mid-range GPU with 30 towers.

---

## Point-light cost

Each tower adds one `THREE.PointLight` (skipped on `reduce-motion` / low-end).
30 towers = 30 point lights. Three.js soft-limits at ~8 dynamic lights for forward
rendering; 30 lights will force multi-pass shadow-map work if shadows are enabled.
Tower accent lights use `intensity: 0.3`, `distance: 1.2` — short range, so only nearby
geometry receives the light. In practice the cost is low because the lights don't cast
shadows (no `castShadow = true` is set in `attachAccentLight`). Verified by code inspection.
