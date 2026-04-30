# Tower Visual Polish — Browser Smoke Checklist (Sprint 67)

**Post-merge verification — requires user interaction**

Open `/play` on a test encounter (any map, any difficulty). Tick each item as
you verify it. Target: zero console errors, no visual regressions.

---

## Placement

- [ ] Place a BASIC tower — hex pad + turret + barrel visible, accent sphere glows
- [ ] Place a SNIPER tower — tripod legs visible from above, long barrel extends forward
- [ ] Place a SPLASH tower — square chassis + drum housing + tube cluster visible
- [ ] Place a SLOW tower — octahedron base + torus coil ring(s) + concave emitter dish visible
- [ ] Place a CHAIN tower — three tapering torus coil rings + floating sphere visible
- [ ] Place a MORTAR tower — wide rectangular chassis + angled barrel (45° up) visible
- [ ] Placement ghost reads correctly for each type (translucent, same silhouette as placed tower)
- [ ] Range ring color matches each tower's brand color (warm/cool/green/blue/gold/brown)

---

## Tier progression

- [ ] Upgrade BASIC to T2 — barrel cap appears; verify flash animation plays
- [ ] Upgrade BASIC to T3 — shoulder pauldrons (×2) appear; flash plays
- [ ] Upgrade SNIPER to T2 — longer scope housing replaces T1 scope; flash plays
- [ ] Upgrade SNIPER to T3 — bipods hidden, hover stabilizer appears; flash plays
- [ ] Upgrade SPLASH to T2 — two additional rocket tubes appear (6-tube cluster); flash plays
- [ ] Upgrade SPLASH to T3 — two more tubes + heat vent glow appear (8-tube cluster); flash plays
- [ ] Upgrade SLOW to T2 — second torus coil ring appears; flash plays
- [ ] Upgrade SLOW to T3 — floating crystal core appears above emitter; flash plays
- [ ] Upgrade CHAIN to T2 — second orbiting sphere appears; flash plays
- [ ] Upgrade CHAIN to T3 — third orbiting sphere appears; flash plays
- [ ] Upgrade MORTAR to T2 — T1 barrel hidden, reinforced barrel appears; flash plays
- [ ] Upgrade MORTAR to T3 — dual-barrel side-by-side visible; flash plays

---

## Firing animations

- [ ] BASIC fires — barrel slides back ~0.05u then returns; muzzle flash spike visible
- [ ] SNIPER fires — sharp barrel recoil (~0.08u); tracer visible
- [ ] SPLASH fires — drum rotates faster + selected tube emissive spike; splash AoE visual
- [ ] SLOW fires — emitter dish scale pulses outward then returns; slow-ring effect visible
- [ ] CHAIN fires — muzzle flash emissive spike on sphere; chain-lightning arc from sphere height
- [ ] MORTAR fires — barrel recoils heavily (~0.15u); arc projectile + impact circle
- [ ] No console errors during repeated rapid firing of any tower type

---

## Idle animations

- [ ] BASIC — turret rotates slowly ±5° back and forth
- [ ] SNIPER — scope lens emissive pulses (breathes between dim and bright)
- [ ] SPLASH — drum housing rotates slowly at idle speed
- [ ] SLOW — emitter dish emissive breathes 0.7 → 1.0 over ~2 s
- [ ] CHAIN — floating sphere bobs up and down gently
- [ ] MORTAR — barrel performs a slow elevation gesture every ~4 s (raises then settles)

---

## Sell animation

- [ ] Sell a BASIC tower — tower shrinks to 0 over ~0.3 s, removed from scene
- [ ] Sell each of the remaining 5 tower types — same shrink behavior
- [ ] No console errors after sell
- [ ] Sell immediately after upgrading (I-5 race) — shrink wins cleanly, no scale stutter

---

## Cohesion + edge cases

- [ ] Place 30+ towers of mixed types — no visual overlap confusion at game camera angle
- [ ] All 6 tower types readable by silhouette without reading the name label
- [ ] Tier-up bounce scale animation does not persist after animation completes (snaps to final scale)
- [ ] Restart encounter mid-play with towers on board — clean teardown, no console errors, no lingering meshes
- [ ] Reduce-motion body class active — accent point lights not added (no GL errors on low-end path)
- [ ] Open browser DevTools → Three.js inspector or `renderer.info.memory` — geometry and texture counts drop back to baseline after encounter teardown

---

## Console hygiene

- [ ] Zero `THREE.WebGLRenderer: Context Lost` errors
- [ ] Zero `Geometry is already disposed` errors
- [ ] Zero `Material is already disposed` errors
- [ ] Zero `Cannot set properties of null` (tower group after disposal)
- [ ] The two pre-existing `no-console` lint warnings in `card-play.service.ts:752,761` may still appear — these predate this branch and are not regressions
