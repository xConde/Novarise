# Phase E Sprint 32 — Frost-Mist Particles (Deferred to Phase H)

## Why deferred

Neither `ParticleService` nor `VfxPoolService` expose an ambient emitter API:

- `ParticleService` is a burst-only system (`spawnDeathBurst`). It has no
  concept of a per-tower, continuous low-rate emitter.
- `VfxPoolService` pools chain-arc lines and mortar-zone meshes — no particle
  emitter surface.

Adding frost-mist via a `userData['ambientFrostTick']` hook in `idleTick`
would require:
1. A new `spawnFrostParticle(worldPosition)` method on `ParticleService` that
   acquires a pooled material and spawns one small downward-drifting particle.
2. A per-tower accumulator in `idleTick` that tracks elapsed time and fires
   the spawn at `SLOW_FROST_CONFIG.spawnIntervalSec` intervals.
3. Ensuring the spawned particles are registered with the existing
   `addPendingToScene` / `update` / `cleanup` lifecycle in `GameRenderService`.

That integration is ~100-150 lines (new method + accumulator + wiring) — above
the ~80-line threshold set in the Phase E brief. Deferring keeps Sprint 32's
scope clean and leaves the pattern for Phase H.

## What to implement in Phase H

- Add `spawnFrostParticle(pos, scene)` to `ParticleService` that spawns one
  small (`radius 0.025`) semi-transparent sphere with a frost-blue tint,
  slight downward drift (`SLOW_FROST_CONFIG.fallSpeed`), short lifetime (~0.8s).
- In the SLOW `idleTick`, accumulate delta-time via `userData['frostAccum']`
  and call `spawnFrostParticle` when accumulator exceeds
  `SLOW_FROST_CONFIG.spawnIntervalSec`.
- Use `SLOW_FROST_CONFIG` constants already exported from `tower-anim.constants.ts`.
- Wire the scene reference via a new `GameRenderService.getScene()` accessor or
  pass the scene through the tick call signature (evaluate both for injection
  cleanliness before implementing).
