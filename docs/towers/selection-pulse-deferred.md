# Sprint 63 — Selection Pulse: Deferred

Deferred from Phase I (2026-04-30) to Phase J.

## Reason

`TowerUpgradeVisualService.addGlowRing` exists in the service but is never called
from `game-board.component.ts`. There is no active glow ring placed on selected
towers in production. The infrastructure to pulse a ring (tickSelectionPulse in
TowerAnimationService, SELECTION_PULSE_CONFIG constants) has been added in Phase I
so it is ready when the ring is wired.

## What was added (ready for Phase J)

- `SELECTION_PULSE_CONFIG` constant in `tower-anim.constants.ts`
- `tickSelectionPulse(glowRings, nowSeconds)` method in `TowerAnimationService`
  — drives opacity pulse on any ring with `userData['selected'] = true`

## What Phase J needs to do

1. Call `addGlowRing(towerId, position, scene)` from `selectPlacedTower()` in
   the component, setting `ring.userData['selected'] = true` on the returned ring.
2. Call `removeGlowRing(towerId, scene)` from `deselectTower()`.
3. Wire `tickSelectionPulse(towerUpgradeVisualService.glowRings, nowSeconds)` in
   `GameRenderService.animate()` alongside the other animation ticks.
4. Expose `glowRings` as a getter on `TowerUpgradeVisualService` (already has
   private `glowRings: Map<string, THREE.Mesh>`).
