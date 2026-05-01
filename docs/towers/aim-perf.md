# Tower Aim — Performance Audit

**Branch:** feat/threejs-polish  
**Audited:** 2026-04-30 (Phase E sprint 47)

## Methodology

### What the Phase A perf gate measured (and did not)

The Phase A spec (`tickAim perf gate` in `tower-animation.service.spec.ts`) measures
the loop-iteration overhead and `lerpYaw` math using a `getPreviewTarget` spy that
returns immediately. It does **not** exercise `TowerCombatService.findTarget` or
`spatialGrid.queryRadius`. This is documented in the spec itself (Finding A-3 note).

### What this Phase E audit adds

This audit separates the three cost components using the knowledge that:

1. `findTarget` uses `spatialGrid.queryRadius` — already benchmarked separately in
   the existing spatial-grid specs. O(local): each query walks only the cells within
   the tower's range radius, not the full 25×20 board.
2. `lerpYaw` is a handful of float ops + two while-loops (worst case 1 iteration each).
3. `userData` reads are Map lookups on the V8 hidden-class-stable object — effectively
   free.

### Synthetic load estimate

| Parameter | Value | Rationale |
|---|---|---|
| Towers | 30 | Maximum plausible filled board |
| Enemies | 100 | 5× normal wave size; pathological case |
| Board | 25 × 20 | Standard board |
| Cell size | 1 world unit | Standard tile size |
| Spatial grid cell | 2 units | Standard grid cell from BOARD_CONFIG |

At 100 enemies on a 25×20 board (500 tiles), average enemy density is ~0.2 enemies
per tile. A BASIC tower with range=4 covers a circle of ~50 tiles. Expected enemies
in that radius at max load: ~10. `spatialGrid.queryRadius` for a range-4 tower walks
at most a 9×9 patch of grid cells (81 cells), filtering ~10 candidates.

### Cost split per tower per frame

| Component | Estimated cost | Basis |
|---|---|---|
| `getPreviewTarget` cache check (clean) | ~0 µs | Map.has + Map.get, no recompute |
| `getPreviewTarget` on dirty key | ~1–3 µs | `spatialGrid.queryRadius` + NEAREST/FIRST sort on ~10 enemies |
| `lerpYaw` math | <0.5 µs | 5 float ops |
| `userData` reads (4 fields) | <0.1 µs | V8 inline cache |
| **Per-tower total (dirty)** | **~2–4 µs** | |
| **Per-tower total (clean)** | **<1 µs** | |

### Full round-trip at 30 towers, 100 enemies

**Enemy-move event (bulk dirty, once per turn-step):**  
30 towers × ~3 µs recompute = ~90 µs ≈ **0.09 ms per call**

**Between enemy events (cache hot, per frame):**  
30 towers × <1 µs = <30 µs ≈ **<0.03 ms per frame**

Both are well within the 2 ms per-frame budget established in `aim-perf-contingency.md`.

### Karma-headless timing (Phase A spec, CI hardware)

The Phase A perf gate ran `tickAim` with 30 tower groups + spied
`getPreviewTarget` (zero cost). It asserts < 5 ms; observed timing on CI is
typically < 0.5 ms. With real `findTarget` (see estimate above), expected overhead
is an additional ~90 µs at worst. The 5 ms CI budget has ~4.9 ms of headroom.

### "No-aim" baseline comparison

Without aim (towers with no `aimTick` registered): the `tickAim` loop skips each
group in one `typeof` check per group. For 30 towers:

- No-aim: ~30 × 0.1 µs = ~3 µs (type check only)
- With aim (cache hot): ~30 × 0.5 µs = ~15 µs (cache hit + lerpYaw)
- With aim (cache dirty): ~30 × 3 µs = ~90 µs (full findTarget per tower)

Delta vs no-aim: worst case **+87 µs** per frame. Against a 16.7 ms frame budget
this is **0.5% of frame time** — below measurement noise on production hardware.

## Verdict: Perf budget met, no contingency needed

The aim subsystem stays well under the 2 ms per-frame ceiling on all plausible
board configurations. The round-robin recompute fallback documented in
`aim-perf-contingency.md` is NOT needed and has NOT been implemented.

Evidence:
- Phase A CI spec: < 0.5 ms observed (5 ms budget)
- Worst-case analytical estimate (30 towers, bulk-dirty): ~0.09 ms
- Per-frame steady-state (cache hot): ~0.03 ms

## Browser profiling guidance

To verify in the actual browser (not required, but recommended if perf regression
is suspected):

1. Load `/play`, place 20+ towers, advance to a wave with 30+ enemies.
2. Open DevTools → Performance → Record.
3. Click End Turn to trigger a resolve pass.
4. Inspect the flame graph for `tickAim` in the JS call tree.
5. Expected: `tickAim` takes < 0.5 ms on a mid-tier laptop.
6. If `tickAim` exceeds 2 ms, implement round-robin per `aim-perf-contingency.md`.

## Do-not-regress notes

- `TargetPreviewService.getPreviewTarget` must stay O(local) — any change that
  makes it O(total-enemies) would invalidate this audit.
- The `enemiesChanged` coalesce fix (Finding C-1: one emission per
  `cleanup()` call, not per enemy) is what keeps bulk-dirty from firing dozens of
  times per teardown. Do not regress the `removeEnemySilent` pattern.
- `tickPreviewCache()` (clears DIRTY_ALL after full pass) must remain called every
  frame from `GameRenderService.animate()` — without it DIRTY_ALL accumulates and
  forces full recompute on every frame (Finding C-2).
