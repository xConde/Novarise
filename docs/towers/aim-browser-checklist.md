# Tower Aim — Browser Smoke Checklist

Manual verification items for the aim subsystem. Complete after each deployment
of `feat/threejs-polish` and again after any merge that touches
`tower-animation.service.ts`, `aim-line.service.ts`, `target-preview.service.ts`,
or `tower-mesh-factory.service.ts`.

---

## Per-tower aim

- [ ] **BASIC** — place a BASIC tower adjacent to a path; spawn enemies; verify the turret group visually rotates toward the lead enemy within ~0.25 s.
- [ ] **SNIPER** — place a SNIPER tower; verify the aimGroup (scope + barrel + bipod) tracks the targeted enemy, not the whole tower body.
- [ ] **SPLASH** — place a SPLASH tower; verify the splashYaw group (drum + tubes) swings toward the target while the drum continues its forward-axis spin.
- [ ] **SLOW** — place a SLOW tower; verify the slowYaw group (emitter dish) tracks its primary target. The coil ring and crystal core on the body should not rotate.
- [ ] **CHAIN** — place a CHAIN tower; verify the chainYaw group (sphere + electrodes) points toward the target; electrode cluster should visually lead the direction.
- [ ] **MORTAR** — place a MORTAR tower; verify mortarYaw rotates toward the target; the barrel elevation offset (–45°) should be preserved and not flattened by the yaw change.

## Targeting mode cycling

- [ ] Select a placed tower; cycle through FIRST / NEAREST / STRONGEST / WEAKEST via the targeting mode button; verify aim updates within one frame after each cycle (the turret/aim group re-points noticeably).

## Upgrade tier transitions

- [ ] Upgrade a BASIC tower L1 → L2 → L3; verify aim continues working at each tier.
- [ ] Upgrade a SNIPER tower to L3 (hover stabilizer variant); verify the stabilizer appears AND aim still works; verify legs/tripod do **not** rotate with the aim group.
- [ ] Upgrade a MORTAR to L3 (dual-barrel); verify both barrels are visible and recoil is intact after the yaw group introduction.

## Sell mid-aim

- [ ] Place a tower with an active aim target; sell it; verify: no JS console errors, no leaked line mesh in scene, no stale aimTick callbacks.

## Aim line (selected-tower indicator)

- [ ] Select a placed tower that has a target; verify a faint colored cylinder appears from the tower toward the target.
- [ ] The line color should match the tower's accent color family (e.g. amber for CHAIN, green for SPLASH).
- [ ] Deselect the tower (click empty tile or press Escape); verify the line disappears.
- [ ] Select a tower with **no target in range**; verify no line is shown.
- [ ] With 20+ towers placed, verify only the selected tower shows a line — no lines on unselected towers.

## Reduce-motion

- [ ] Enable reduce-motion via Settings → Reduce Motion (or DevTools → `document.body.classList.add('reduce-motion')`).
- [ ] Verify aim still updates target selection, but the yaw transition is visually instantaneous (no lerp arc — the turret snaps).
- [ ] Verify the aim line is **hidden** under reduce-motion (the line implies directional motion).
- [ ] Verify idle gestures (turret swivel, sphere bob, drum spin) also respect reduce-motion independently.

## Heavy load

- [ ] Place 30+ towers of mixed types; spawn a full enemy wave; verify the board does not visually clutter with aim lines (only the selected tower shows a line).
- [ ] Verify no frame-rate cliff — aim pre-pass runs in under 5 ms per frame on mid-tier hardware (check browser DevTools Performance panel; look for `tickAim` in the flame graph).

## Encounter restart mid-aim

- [ ] While towers are actively tracking enemies, open the pause menu and choose Abandon Run or start a new encounter.
- [ ] Verify: no console errors on teardown, no residual aim-line cylinder in the next encounter's scene, no `aimEngaged` state carrying over to new towers.

---

*Each item should be manually verified by loading `/play` in the browser, not in unit tests.*
