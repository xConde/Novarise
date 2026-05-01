# Sprint 62 — Hover Accent-Light Lift: Deferred

Deferred from Phase I (2026-04-30) to Phase J.

## Reason

`BoardPointerService` tracks hovered state by tile (row, col) coordinates, not
by tower mesh group. It only raycasts against `getTilePickables()` (the instanced
tile layer) — there is no per-tower mesh raycasting. Wiring hover lift requires
either:

A. Converting hoveredCoord (row, col) → tower key → towerMeshes.get(key) in the
   hover path and writing `group.userData['hoverLift']`, OR
B. Adding a second raycasting pass against tower children in BoardPointerService.

Option A is lower risk but requires the hover path in BoardPointerService to be
aware of tower placement state (calling towerCombatService.getTower(key) on every
mousemove). Option B adds raycasting cost.

Neither was implemented in Phase I to keep the scope contained.

## What was added (ready for Phase J)

- `HOVER_LIFT_CONFIG` constant in `tower-anim.constants.ts`
- `tickHoverLift(towerMeshes)` method in `TowerAnimationService`
  — reads `userData['hoverLift']` per group, lifts accent point-light intensity
    by HOVER_LIFT_CONFIG.intensityMultiplier, restores when flag is cleared.

## What Phase J needs to do

1. In `BoardPointerService.mousemoveHandler`, after resolving `hoveredCoord`,
   look up the tower at that coord via `towerCombatService.getTower(key)`.
2. If a tower is found and its mesh group exists, set `group.userData['hoverLift'] = true`.
3. Clear the flag on the previously-hovered tower when `hoveredCoord` changes.
4. Wire `tickHoverLift(meshRegistry.towerMeshes)` in `GameRenderService.animate()`
   alongside the other animation ticks.
