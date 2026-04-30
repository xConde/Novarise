# Aim Perf Contingency

Contingency design if `tickAim` + `getPreviewTarget` exceeds the 5ms per-call
budget under load (30 towers × 50 enemies).

## Current implementation (Phase A)

Every `tickAim` call iterates only towers that have `userData['aimTick']`
registered (Phase A: zero such towers — all are no-ops). `getPreviewTarget`
delegates to `TowerCombatService.findTarget` which calls
`spatialGrid.queryRadius` — O(local) due to the spatial grid's cell
partitioning. On a production board (30 towers, 50 enemies) this is expected
to stay well under 1ms.

## Trigger condition

If the Phase B or C perf gate spec (`tickAim` over 5ms with 30 tower groups
and 50 mock enemies) fails on CI, implement round-robin recompute as described
below.

## Round-robin recompute design

Instead of recomputing every tower every frame, assign each tower a slot index
and only recompute the Nth slot per frame. With N=4 slots, each tower's target
is recomputed once every 4 frames (~4 frames × 16ms = ~64ms lag at 60fps).
This is imperceptible to the player.

### Implementation sketch

1. `TargetPreviewService` gains a `slots: string[][]` array of 4 buckets.
   On `registerTower(key)`, assign the key to `slots[nextSlot % 4]`.
2. `tickPreviewCache(currentFrame: number)`: recomputes all towers in
   `slots[currentFrame % 4]` and stores results in `cache`.
3. `getPreviewTarget(tower)`: reads from `cache` instead of calling
   `findTarget` directly.
4. `GameRenderService.animate()` passes a frame counter to
   `tickPreviewCache` before `tickAim`.

### Trade-off

64ms target staleness per tower means a tower may aim at a killed enemy for
up to 4 frames. Acceptable visual artifact. The aim subsystem already has a
0.5s grace period (`AIM_FALLBACK_CONFIG.noTargetGraceSec`) for target loss,
so a 64ms stale-aim window is indistinguishable.

### Do not implement prematurely

The perf gate spec uses wall-clock timing on CI hardware which is much slower
than production. If the spec passes with headroom on CI, do not add round-robin
complexity. Profile in the browser first (see `docs/towers/aim-browser-checklist.md`).
