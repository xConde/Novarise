# PR Draft — feat/threejs-polish

**Target branch:** main
**Commits:** 131 ahead of main
**Files changed:** 130 files, +19244/−1863 lines
**Test count:** 7374 passing / 0 failed / 1 skipped (was 6973 at branch start; +401 net)

---

## Summary

Two major efforts shipped on this branch, stacking on top of the UX polish sweep (UX-1 → UX-40) that was already in the branch history:

### Tower Visual Polish (70 sprints, Phases A–J)

All 6 tower types fully redesigned with Three.js geometry, per-tier progressive disclosure,
and idle/fire animations. Shared infrastructure added:

- `GeometryRegistryService` + `MaterialRegistryService` — shared buffer/material cache with protect-predicate disposal guard
- `TextSpritePoolService` + `VfxPoolService` — pooled allocators for chain arcs and mortar blast zones
- `TowerDecalLibraryService` — CanvasTexture panel-line/rivet decal cache
- `TowerMaterialFactory` — extracted material constants, per-tower body palette (desaturated to deep-space board)
- `TIER_UP_BOUNCE_CONFIG`, `SELL_ANIM_CONFIG`, `HOVER_LIFT_CONFIG`, `SELECTION_PULSE_CONFIG` in `tower-anim.constants.ts`

Per-tower changes:

| Tower  | Silhouette                              | Key idle animation                  |
|--------|-----------------------------------------|-------------------------------------|
| BASIC  | Hex pad + swivel turret + barrel        | Turret ±5° swivel + barrel recoil   |
| SNIPER | Tripod + long barrel + optical scope    | Scope lens emissive breathe + recoil |
| SPLASH | Armored chassis + rotating drum + tubes | Drum rotation + round-robin tube emit |
| SLOW   | Octahedron base + coil rings + emitter  | Emitter breathe + crystal bob (T3)  |
| CHAIN  | Tapering Tesla torus stack + sphere     | Sphere hover + arc flicker + electrode shimmer |
| MORTAR | Wide chassis + treads + angled barrel   | Barrel elevation gesture + heavy recoil |

Red-team history (5 findings across Phases I–J): emissive fade absolute assignment (CRITICAL fixed),
CHAIN silent recoil (MEDIUM fixed), CHAIN upgrade stomp (MEDIUM fixed), SNIPER phantom yaw
(LOW — fixed by aim Phase B), tier-up/sell race (LOW fixed).

### Tower Aim Toward Target + Emissive Ratchet Fix (50 sprints, Phases 0 + A–E)

**Phase 0 — Emissive ratchet root cause fixed:** `startMuzzleFlash` was snapshotting
`mat.emissiveIntensity` at fire time (the already-spiked value) rather than reading from a
pre-recorded baseline. After 30 turns of two same-type towers, baseline ratcheted to
`0.4 × 1.5^30 ≈ 76 700×`. Fix: `snapshotEmissiveBaselines` records baseline immediately at
mesh construction; `startMuzzleFlash` reads from the snapshot exclusively.

**Phases A–E — Aim system:**

- `TargetPreviewService` — dirty-set cache; `getPreviewTarget` keyed by tower position;
  `tickPreviewCache` clears DIRTY_ALL sentinel each frame; invalidation at all 4 sites
  (place, upgrade, FORTIFY, `cycleTargeting`)
- `aimTick` callback channel on `userData['aimTick']` — opt-in per tower
- `lerpYaw` utility — shortest-path angular lerp across ±π boundary
- `tickAim` wired into `GameRenderService.animate()` BEFORE `updateTowerAnimations`
- All 6 towers wired with per-type yaw subgroups (see subgroup table below)
- No-target grace timer (0.5s; 0s under reduce-motion) — tower holds last yaw during window
- `AimLineService` — thin cylinder from selected tower to its current aim target;
  geometry rebuilt only when endpoints move > `AIM_LINE_CONFIG.rebuildThreshold`;
  hidden under reduce-motion
- Reduce-motion: lerp speed effectively instantaneous (snap); grace period = 0; aim line hidden
- Amplitude clamp: SLOW and CHAIN capped to ±90° (`AIM_AMPLITUDE_CONFIG`); directional towers unrestricted

Yaw subgroup names (do not rename):

| Tower  | Subgroup     |
|--------|--------------|
| BASIC  | `turret`     |
| SNIPER | `aimGroup`   |
| SPLASH | `splashYaw`  |
| SLOW   | `slowYaw`    |
| CHAIN  | `chainYaw`   |
| MORTAR | `mortarYaw`  |

Red-team history (13 findings across Phases 0 + A–E): 1 HIGH fixed, 4 CRITICAL/HIGH fixed,
B-4 cosmetic deferred, C-3 one-turn-lag deferred.

---

## New services / files

- `src/app/game/game-board/services/geometry-registry.service.ts`
- `src/app/game/game-board/services/material-registry.service.ts`
- `src/app/game/game-board/services/text-sprite-pool.service.ts`
- `src/app/game/game-board/services/vfx-pool.service.ts`
- `src/app/game/game-board/services/tower-material.factory.ts`
- `src/app/game/game-board/services/tower-decal-library.service.ts`
- `src/app/game/game-board/services/target-preview.service.ts`
- `src/app/game/game-board/services/aim-line.service.ts`
- `src/app/game/game-board/constants/tower-anim.constants.ts`
- `src/app/game/game-board/constants/tower-aim.constants.ts`

---

## Test count delta

| Milestone                         | Passing |
|-----------------------------------|---------|
| Branch start (post Phase C close) | 6 973   |
| Tower visual polish close (Phase J) | 7 165 |
| Tower aim close (Phase E)         | 7 374   |
| Final pre-merge review            | 7 374   |

---

## Browser smoke checklists

Two checklists must be completed before merging:

1. **Tower visual polish:** `docs/towers/browser-smoke-checklist.md` — 30+ items covering
   placement, tier progression (T1→T2→T3), firing animations, idle animations, sell animation,
   color-blind check, palette cohesion, console hygiene.

2. **Tower aim:** `docs/towers/aim-browser-checklist.md` — 20+ items covering per-tower
   aim tracking, targeting mode cycling, upgrade transitions, sell mid-aim, aim line,
   reduce-motion, heavy load (30+ towers), encounter restart.

---

## Deferred items (explicitly out of scope for this PR)

- **SNIPER whole-group yaw** (I-4) — FIXED by aim Phase B (`aimGroup` wrapper). Fully closed.
- **Hover-feedback animation wiring** — `tickHoverLift` + `HOVER_LIFT_CONFIG` implemented;
  wiring deferred (`board-pointer.service.ts` + render loop). See `hover-lift-deferred.md`.
- **Selection ring pulse wiring** — `tickSelectionPulse` + `SELECTION_PULSE_CONFIG` implemented;
  wiring deferred. See `selection-pulse-deferred.md`.
- **Frost-mist particles for SLOW** — constants exported; `ParticleService.spawnFrostParticle`
  not yet written. See `phaseE-frost-deferred.md`.
- **MORTAR T2 barrel jacket** — red-team cosmetic punch list item.
- **CHAIN orbit sphere tilt** (B-4) — cosmetic; evaluate in browser smoke.
- **STRONGEST/WEAKEST aim lag on damage** (C-3) — one-turn visual mismatch; fire is correct.
- **`drumSpinBoostUntil` clock skew** (D-b) — cosmetic drum snap on tab-restore only.
- **`MotionPreferenceService`** — consolidate scattered `reduce-motion` DOM reads.
- **Real `RuntimeModeService.isLowEnd`** — accent light gate currently uses accessibility class.
- **Phase 5 Siegeworks archetype** — unscoped.

---

## Do-not-regress

- Tower body colors (`TOWER_MATERIAL_CONFIGS`) in `tower-material.factory.ts`
- `geometryRegistry` / `materialRegistry` protect predicate (disposal contract)
- `attachAccentLight` guard skips low-end/reduce-motion
- All 5 animation tick methods wired in `game-render.service.ts:animate()`: `tickRecoilAnimations`, `tickTubeEmits`, `tickEmitterPulses`, `tickTierUpScale`, `tickSellAnimations`
- Per-instance material clones: MORTAR body, CHAIN sphere/electrode/arc, SLOW emitter
- `userData['selling']` guard in `tickTierUpScale` (I-5 fix)
- `animated = false` default in `removeMesh`
- `towerDecalLibrary?.dispose()` order in `cleanupScene` (after tower mesh disposal)
- `SNIPER_TRACK_CONFIG` in `tower-anim.constants.ts` (scaffolding for future tracking)
- 6 yaw subgroup names (any rename breaks `tickAim` and `AimLineService`)
- Per-instance material clones for emissive-animated towers (prevents cross-tower contamination)
- `tickAim` runs BEFORE `updateTowerAnimations` in `GameRenderService.animate()`
- `chargeTick` and `idleTick` are SEPARATE functions on SNIPER (B-1 regression guard)
- `aimEngaged` userData rule: idle suppressed when `true`; cleared on grace expiry
- `noTargetGraceTime` cap: 0.5s standard, 0s under reduce-motion
- `EnemyService.enemiesChanged` emits ONCE per `cleanup()` call via `removeEnemySilent`
- `tickPreviewCache()` called every frame after `tickAim`
- `AIM_AMPLITUDE_CONFIG[SLOW]` = π/2, `AIM_AMPLITUDE_CONFIG[CHAIN]` = π/2
- `DEFAULT_TARGETING_MODE = TargetingMode.FIRST` (new towers default to FIRST, not NEAREST)

---

## On merge

Delete both plan docs per their cleanup-on-close instructions:
- `.claude/tasks/project_tower_polish_plan.md`
- `.claude/tasks/project_tower_aim_plan.md`
