# Tower Aim-Toward-Target — Close-Out

**Branch:** feat/threejs-polish  
**Closed:** 2026-04-30  
**Plan:** 50 sprints across Phases 0 + A-E  
**Spec count:** 7374 passing / 0 failed / 1 skipped  
  (was 7165 baseline before Phase 0)

---

## What shipped

### Phase 0 — Emissive ratchet bug fix (sprints 1-10)

- Root cause identified: `startMuzzleFlash` was snapshotting `mat.emissiveIntensity`
  at fire time rather than reading from a pre-recorded baseline. Shared body materials
  on towers that fired the same turn had their elevated value snapshotted and restored,
  ratcheting the baseline upward permanently.
- Fix: `emissiveBaselines` map recorded at mesh construction time; `startMuzzleFlash`
  reads from this snapshot exclusively.
- `'sphere'` (CHAIN) and `'tubeN'` (SPLASH) added to the muzzle-flash skip-set so
  per-frame emissive drivers (chargeTick, tickTubeEmits) are not corrupted.
- Close-out doc: `docs/towers/emissive-ratchet-fix.md`.

### Phase A — Aim foundation (sprints 11-17)

- `TowerCombatService.findTarget` promoted to `public`.
- `TargetPreviewService` (component-scoped): dirty-set cache, `getPreviewTarget`,
  `invalidate`, `tickPreviewCache`. Keyed by `"${row}-${col}"`.
- `aimTick` callback channel on `userData['aimTick']` — opt-in per tower.
- `lerpYaw` utility exported from `tower-animation.service.ts` — shortest-path
  angular lerp across the ±π boundary.
- `tickAim` wired into `GameRenderService.animate()` BEFORE `updateTowerAnimations`.
- `AIM_LERP_CONFIG`, `AIM_FALLBACK_CONFIG`, `AIM_LINE_CONFIG` in
  `tower-aim.constants.ts`.
- Red-team Fix A-1: `getPreviewTarget` uses `getEffectiveStats` (not L1 base
  stats) so T3 upgraded towers aim at the correct range band.

### Phase B — Per-tower aim wiring (sprints 18-35)

All 6 towers wired:

| Tower | Yaw subgroup | New group | Notes |
|---|---|---|---|
| BASIC | `turret` | No (pre-existing) | Tag only |
| SNIPER | `aimGroup` | Yes | Re-parents scope+barrel+bipod+muzzle+stabilizer; fixes I-4 (legs no longer rotate with aim) |
| SPLASH | `splashYaw` | Yes | Wraps drumGroup; drum forward-spin composes with yaw |
| SLOW | `slowYaw` | Yes | Wraps emitter dish only; coil ring + crystal stay static |
| CHAIN | `chainYaw` | Yes | Wraps sphere+electrodes+orbits+arc |
| MORTAR | `mortarYaw` | Yes | Wraps barrelPivot; separates yaw (parent) from elevation (child) |

- Red-team Fix B-1: SNIPER `chargeTick` split from `idleTick` — phantom drift was
  overwriting `tickAim`'s yaw every frame (CRITICAL, now fixed).

### Phase C — Planning-phase preview (sprints 36-41)

- `EnemyService.enemiesChanged` subject subscribed by `TargetPreviewService`;
  any spawn/move/remove event bulk-invalidates the cache.
- Per-tower invalidation hooked at: `tryPlaceTower`, `upgradeTower`, FORTIFY card,
  `cycleTargeting`.
- No-target grace timer: `AIM_FALLBACK_CONFIG.noTargetGraceSec` (0.5s). Tower holds
  last yaw during the window; `aimEngaged` userData flag gates idle suppression.
  Under reduce-motion the grace window is zero (instant idle resume).
- Red-team Fix C-1: `cleanup()` now emits ONE `'remove'` event for N enemies
  (not N events) via `removeEnemySilent` + single `enemiesChanged.next('remove')`.
- Red-team Fix C-2: `tickPreviewCache()` added to render loop to clear the
  DIRTY_ALL sentinel after each pass.
- Integration spec: `target-preview-integration.spec.ts`.

### Phase D — Cohesion + UX (sprints 42-46)

- `AimLineService`: thin cylinder from selected tower to its current aim target.
  Geometry rebuilt only when endpoints move by more than `AIM_LINE_CONFIG.rebuildThreshold`.
  Hidden under reduce-motion.
- Reduce-motion: lerp speed = `AIM_LERP_CONFIG.reduceMotionSpeedRadPerSec` (effectively
  instantaneous snap); grace period = 0; aim line hidden.
- Red-team Fix D-1: geometry no longer rebuilt every frame unconditionally.
- Red-team Fix D-2: `AimLineService` implements `OnDestroy` as safety net alongside
  explicit `cleanup()`.

### Phase E — QA + close-out (sprints 47-50)

- **D-3 fixed:** Merged two per-frame `reduce-motion` DOM reads in
  `game-render.service.ts` into one local variable `reduceMotion`, shared by
  `tickAim` and `aimLineService.update`.
- **Amplitude clamp shipped (Sprint 49):** SLOW and CHAIN towers clamped to ±90°
  (`AIM_AMPLITUDE_CONFIG[TowerType.SLOW/CHAIN] = Math.PI / 2`). Directional towers
  (BASIC, SNIPER, SPLASH, MORTAR) use `Math.PI` (unrestricted). This preserves the
  field-weapon visual fiction for SLOW/CHAIN while still indicating the target
  hemisphere. 5 new specs.
- **Disposal audit doc:** `docs/towers/aim-disposal-audit.md`. 7 new specs confirming
  yaw subgroup geometry is disposed by `disposeGroup`'s recursive traverse.
- **Perf audit doc:** `docs/towers/aim-perf.md`. Full round-trip worst-case estimate:
  ~0.09 ms per turn-step. Budget: 2 ms. No contingency needed.
- **Omnidirectional review doc:** `docs/towers/aim-omnidirectional-review.md`.
- **C-3 deferred:** STRONGEST/WEAKEST damage lag — one-turn visual mismatch;
  fix requires type-sig change + gated invalidation path (~50-70 lines). Deferred.

---

## Per-tower aim summary

| Tower | Aim subgroup name | Idle gesture (suspended when aimed) | Amplitude |
|---|---|---|---|
| BASIC | `turret` | ±5° swivel | Unrestricted |
| SNIPER | `aimGroup` | ±2° phantom drift on aimGroup only | Unrestricted |
| SPLASH | `splashYaw` | Drum forward-axis spin (composes with yaw) | Unrestricted |
| SLOW | `slowYaw` | Emitter pulse scale (composes) | ±90° |
| CHAIN | `chainYaw` | Sphere bob + electrode shimmer (compound) | ±90° |
| MORTAR | `mortarYaw` | Barrel elevation pitch (composes with yaw) | Unrestricted |

---

## Performance impact

See `docs/towers/aim-perf.md` for full methodology.

- Worst case (30 towers, all dirty after enemy move): ~0.09 ms per turn-step
- Steady state (cache hot, per-frame): ~0.03 ms
- 2 ms budget: met with >20× headroom
- Contingency (round-robin recompute): NOT implemented; NOT needed

---

## Disposal contract

See `docs/towers/aim-disposal-audit.md` for full audit.

- All 6 yaw wrapper groups are walked by `disposeGroup`'s `traverse` — confirmed
  by 7 new specs in `tower-mesh-factory.service.spec.ts`.
- `AimLineService`: `cleanup()` + `ngOnDestroy()` both dispose geo/mat and null refs.
- `TargetPreviewService`: subscription unsubscribed in `ngOnDestroy()`.
- `EnemyService.enemiesChanged` Subject: NOT completed in `cleanup()` by design
  (completing it would break encounter restarts).
- Aim `userData` fields: no GPU resources; GC'd with the group.

---

## Red-team history

Across Phases 0 + A-E: **13 findings** (1 Phase-0, 4 Phase-A, 4 Phase-B, 3 Phase-C,
4 Phase-D counting D-3 and D-4).

| Finding | Severity | Status |
|---|---|---|
| Phase-0 Finding 1: tube meshes not in emissive skip-set | HIGH | Fixed |
| A-1: `getPreviewTarget` using L1 base stats | HIGH | Fixed |
| A-2: `noTargetGraceTime` accumulated but never consumed | MEDIUM | Fixed (Phase C sprint 40) |
| A-3: Perf gate measures loop overhead only, not spatial grid | LOW | Documented; Phase E perf audit is the definitive measurement |
| B-1: SNIPER `chargeTick = idleTick` — overwrites tickAim yaw | CRITICAL | Fixed |
| B-2: SNIPER T3 stabilizer visibility not covered by integration spec | MEDIUM | Fixed (Phase C sprint 41) |
| B-3: `aimEngaged` not consumed — idle gesture never resumes | MEDIUM | Fixed (Phase C sprint 40, same fix as A-2) |
| B-4: CHAIN orbit spheres tilt with `chainYaw` | LOW | Documented, deferred |
| C-1: `cleanup()` emits N remove events for N enemies | HIGH | Fixed |
| C-2: `tickPreviewCache()` never called — DIRTY_ALL accumulates | MEDIUM | Fixed |
| C-3: STRONGEST/WEAKEST stale aim on mid-turn damage | LOW | Documented, deferred |
| D-1: `AimLineService` rebuilds geometry every frame | CRITICAL | Fixed |
| D-2: `AimLineService` missing `OnDestroy` safety net | MEDIUM | Fixed |
| D-3: `reduce-motion` read twice per frame | LOW | Fixed (Phase E sprint 47) |
| D-4: Stress spec shares enemy reference — per-tower yaw not fully validated | MEDIUM | Documented, acceptable |

---

## Deferred items

### B-4 (LOW): CHAIN orbit sphere tilt

CHAIN's T2/T3 orbit spheres (`orbitSphere2`, `orbitSphere3`) are children of
`chainYaw`. When the sphere cluster yaws, the orbital plane tilts with it. The orbit
ring is no longer a fixed world-horizontal ring. Cosmetically acceptable — the tilt
reads as "orbiting charges leaning toward the output arc". Defer to a future polish
sprint if it looks wrong in browser smoke.

### C-3 (LOW): STRONGEST/WEAKEST damage lag

`damageEnemy` does not emit an `enemiesChanged` signal. Towers in STRONGEST/WEAKEST
mode may aim at the now-second-strongest enemy for up to one turn after a damage
event reduces its health rank. The actual fire still hits the correct target. Fix
requires adding `'damage'` to the Subject type + gated invalidation path in
`TargetPreviewService` (~50-70 lines + specs). One-turn visual artifact; cost
exceeds benefit for Phase E.

---

## Do-not-regress list

- **6 yaw subgroup names**: `turret` (BASIC), `aimGroup` (SNIPER), `splashYaw` (SPLASH),
  `slowYaw` (SLOW), `chainYaw` (CHAIN), `mortarYaw` (MORTAR). Any rename breaks
  `tickAim` and `AimLineService`.
- **Per-instance material clones** for towers whose emissive is per-frame mutated
  (MORTAR body, CHAIN sphere, SLOW emitter) — shared materials would cross-contaminate
  emissive state across instances.
- **`tickAim` runs BEFORE `updateTowerAnimations`** in `GameRenderService.animate()` —
  aim writes `currentAimTarget` onto groups; `aimTick` callbacks read it. Swapping
  the order breaks aim for all towers.
- **`chargeTick` and `idleTick` are SEPARATE functions on SNIPER** — `chargeTick`
  pulses the scope lens only; `idleTick` does the phantom drift. Re-aliasing them
  would reintroduce Finding B-1 (aim clobbered every frame).
- **`aimEngaged` userData rule**: idle gesture suppressed when `aimEngaged === true`;
  resumes when false. `aimEngaged` is set true on target-found, held true during grace
  window (0.5s), cleared on grace expiry.
- **`noTargetGraceTime` cap**: 0.5s standard, 0s under reduce-motion. The cap
  prevents accumulation when no target is ever found.
- **`EnemyService.enemiesChanged` emits ONCE per `cleanup()` call** — not per-enemy.
  The `removeEnemySilent` helper is the mechanism; do not regress it to per-enemy
  emissions.
- **`tickPreviewCache()` called every frame** after `tickAim` in
  `GameRenderService.animate()` — without it DIRTY_ALL accumulates indefinitely.
- **`AIM_AMPLITUDE_CONFIG[SLOW]` = π/2, `AIM_AMPLITUDE_CONFIG[CHAIN]` = π/2** —
  these clamps preserve the field-weapon visual fiction. Do not widen to π without
  re-evaluating the omnidirectional review.

---

## Browser smoke checklist

See `docs/towers/aim-browser-checklist.md` for the full manual verification items.
Key items:

- Place each of the 6 tower types; verify the yaw subgroup visibly tracks the
  primary target.
- SLOW and CHAIN: verify the subgroup does not spin more than ~90° from forward.
- SNIPER: verify legs/tripod do NOT rotate with the aimGroup.
- MORTAR: verify barrel elevation (–45° tilt) is preserved after yaw changes.
- Sell a tower mid-aim: no console errors, no leaked aim-line cylinder.
- Reduce-motion on: aim snaps (no lerp arc), aim line hidden.

---

## Future work (out of scope for this PR)

- **B-4** — CHAIN orbit sphere tilt (cosmetic; evaluate in browser smoke)
- **C-3** — Damage-event invalidation for STRONGEST/WEAKEST targeting modes
- **Dedicated `MotionPreferenceService`** — consolidates the `body.reduce-motion`
  DOM reads scattered across `tower-mesh-factory.service.ts` (6 sites),
  `screen-shake.service.ts` (1 site), and `game-render.service.ts` (1 site post-D-3 fix)
- **Aim line for ALL towers** — not just selected. Would need clutter-mitigation
  design (opacity falloff by distance, limit to 5 closest towers, etc.)
- **Multi-target preview** — SPLASH AOE secondary hits, CHAIN chain bounces, MORTAR
  blast radius; requires a new "secondary target indicator" system
- **D-b**: `drumPrevT` / `drumSpinBoostUntil` clock mismatch (Phase H cleanup)
- **E-a**: `pulseDuration` dead variable in `tickEmitterPulses` (Phase H cleanup)
- **E-b**: Crystal-core traverse pattern (Phase H cleanup)
