# Tower Visual Polish — Close-Out

**Branch:** feat/threejs-polish
**Closed:** 2026-04-30
**Commits since merge base:** 101 (after Phase J commit)
**Spec count:** 7165 passing / 0 failed / 1 skipped (was 6973 baseline at branch start)

---

## What shipped (phases A through J)

### Phase A — Foundation + shared infrastructure
- `GeometryRegistryService` — shared geometry buffer cache, dedup by float key
- `MaterialRegistryService` — shared material cache with protect predicate
- `TextSpritePoolService` — pooled text sprite allocator
- `VfxPoolService` — pooled VFX mesh allocator (chain arcs, mortar zones)
- Tile/tower material caching via registries; enemy materials per-instance

### Phase B — BASIC tower redesign
- Squat hex pad + swivel turret + segmented barrel (12/13/15 meshes T1/T2/T3)
- Idle: turret swivels ±5° on slow sine; Fire: barrel recoils 0.05u
- T2: barrel cap; T3: shoulder pauldrons ×2

### Phase C — SNIPER tower redesign
- Tripod + optical scope + long barrel + muzzle brake (11/12/12 meshes)
- Idle: scope lens emissive breathes; Fire: barrel recoils 0.08u (1.6× BASIC)
- T2: longer scope housing; T3: hover stabilizer replaces bipods

### Phase D — SPLASH tower redesign
- Armored square chassis + rotating drum + rocket tube cluster (17/19/23 meshes)
- Idle: drum rotates at 0.4 rad/s; Fire: drum spin boost + round-robin tube emit
- T2: 6-tube cluster; T3: 8-tube + heat-vent glow

### Phase E — SLOW tower redesign
- Crystalline octahedron base + pulse coil ring(s) + cryo emitter dish (8/10/11 meshes)
- Idle: emitter breathes 0.7→1.0 emissive, T3 crystal bobs ±0.04u
- T2: second coil ring; T3: floating crystal core

### Phase F — CHAIN tower redesign
- Tesla coil (3-torus taper) + floating sphere + arcing electrodes (13/14/15 meshes)
- Idle: sphere Y-bob + arc opacity flicker + electrode shimmer; Fire: emissive spike
- T2: second orbiting sphere; T3: third orbiting sphere

### Phase G — MORTAR tower redesign
- Wide armored chassis + tread strips + angled barrel (45°) (11/12/13 meshes)
- Idle: barrel elevation gesture (+5° every ~4s); Fire: recoils 0.15u (3× BASIC)
- T2: reinforced barrel; T3: dual-barrel side-by-side

### Phase H — Cohesion + integration
- `TowerDecalLibraryService`: CanvasTexture panel-line/rivet decal cache
- `TowerMeshFactoryService.attachAccentLight()`: per-tower PointLight, gated on
  `reduce-motion` / low-end (uniform intensity/distance via `TOWER_ACCENT_LIGHT_CONFIG`)
- `TowerMaterialFactory` extracted to `tower-material.factory.ts`
- Material audit complete: MORTAR per-instance body clone (Finding G-1), CHAIN arc
  intentionally raw (no registry), SPLASH tube clones, SLOW emitter clone
- Integration verified: range rings, placement ghost, selection halo, tier-up animation
  all work correctly with new geometries

### Phase I — Animation polish + feel
- Idle amplitude audit documented (`idle-amplitude-audit.md`) — amplitudes intentionally
  non-uniform per role
- Recoil hierarchy standardized: MORTAR 0.15u > SNIPER 0.08u > BASIC 0.05u > CHAIN 0.03u
- `TIER_UP_BOUNCE_CONFIG`: `tickTierUpScale` drives scale bounce on upgrade
- `SELL_ANIM_CONFIG`: `tickSellAnimations` drives shrink-and-fade on sell with
  `onExpire` callback for deferred disposal
- `HOVER_LIFT_CONFIG` + `tickHoverLift` added (wiring deferred — see deferred items)
- `SELECTION_PULSE_CONFIG` + `tickSelectionPulse` added (wiring deferred — see deferred items)
- Fixes: I-1 emissive fade absolute assignment, I-2 CHAIN silent no-op, I-3 CHAIN upgrade
  stomp, legacy named-mesh traverse removed

### Phase J — QA + red-team + close-out
- Performance audit documented (`perf-after.md`) — ~35–40 unique cached geometries,
  100 material instances worst-case with 30 towers
- Disposal audit documented (`disposal-audit.md`) — all paths verified clean
- Browser smoke checklist written (`browser-smoke-checklist.md`) — 30+ items
- Color-blind checklist written (`colorblind-checklist.md`)
- Brand red-team documented (`red-team-findings.md`) — SPLASH and MORTAR rated
  production-quality; top-3 punch list: frost particles, SNIPER tracking, MORTAR T2 barrel
- **I-5 fixed:** `tickTierUpScale` now yields scale ownership when `userData['selling']`
  is set — resolves tier-up/sell-shrink race condition. 1 new spec added.
- I-4 deferred (SNIPER whole-group yaw extraction)

---

## Per-tower change summary

| Tower  | Before (baseline)                             | After                                           | Key animation |
|--------|-----------------------------------------------|-------------------------------------------------|---------------|
| BASIC  | Stacked-cylinder obelisk + octahedron crystal | Hex pad + swivel turret + segmented barrel      | Turret swivel + barrel recoil |
| SNIPER | Crystalline spike (dodecahedron + cones)      | Tripod + long barrel + optical scope            | Lens pulse + barrel recoil |
| SPLASH | Organic mushroom + spore spheres             | Armored chassis + rotating drum + tube cluster  | Drum rotation + tube emit |
| SLOW   | Ice pad + pillar + double-ring + crystal      | Octahedron base + coil tori + cryo emitter dish | Emitter breathe + crystal bob |
| CHAIN  | Wide base + shaft + orb + spark spheres       | Tapering Tesla torus stack + floating sphere     | Sphere hover + arc flicker |
| MORTAR | Double-cylinder base + angled barrel          | Wide chassis + treads + angled barrel + cradle  | Barrel elevation gesture + heavy recoil |

---

## Performance impact

**Factory size:** 334 lines → 1 612 lines (pre-redesign baseline → Phase J).

**Geometry cache:** ~18–22 unique geometries pre-redesign → ~35–40 post. Registry
deduplication keeps GPU buffer count near the lower end; shared params collapse
multiple primitive calls to one allocation.

**Draw calls per board (30 towers, T1, mixed):** ~360 tower draw calls.
**Draw calls per board (30 towers, T3, mixed):** ~445 tower draw calls.
This is a known accepted cost vs tile InstancedMesh (4 draw calls for the entire board).
Tower meshes are non-instanced by design — individual per-tower transforms are required
for animation (turret swivel, barrel recoil, drum rotation).

**Point lights:** 1 per tower × 30 = 30 lights. No shadow casting. Short range (1.2u).
Low cost at game scale. Skipped on reduce-motion / low-end.

---

## Disposal contract

All tower Three.js resources verified clean — no GPU leak in any identified path.

**Shared (registry) resources:** protected from per-mesh `disposeGroup` pass, disposed
once in `geometryRegistry.dispose()` and `materialRegistry.dispose()` batch at
`cleanupScene()`.

**Per-instance clones:** SPLASH tube materials, SLOW emitter material, CHAIN sphere /
electrode / arc / orbit materials, MORTAR body material — all disposed via `disposeGroup`
recursive walk (clone not in registry, so protect predicate returns false).

**Decal textures:** `TowerDecalLibraryService.dispose()` called after tower mesh disposal
in `cleanupScene()`.

**Point lights:** No GPU resources; removed with group.

**Sell-animation teardown:** `cleanupScene()` disposes all groups including mid-sell
groups. No permanent resource retention.

Full details: `docs/towers/disposal-audit.md`.

---

## Red-team history

Phase I red team (2026-04-30): 5 findings across I-1 through I-5.

| Finding | Severity | Status |
|---------|----------|--------|
| I-1: `tickSellAnimations` multiplicative emissive fade | CRITICAL | Fixed Phase I |
| I-2: CHAIN `fireTick` recoil silent no-op | MEDIUM | Fixed Phase I |
| I-3: `applyUpgradeVisuals` skip-set missing 'sphere' | MEDIUM | Fixed Phase I |
| I-4: SNIPER whole-group yaw (no housing sub-group) | LOW | Deferred — see below |
| I-5: `tickTierUpScale` + sell-shrink race | LOW | **Fixed Phase J** |

Phase H red team (2026-04-30): MORTAR muzzle-flash cross-talk (Finding G-1) — fixed with
per-instance body material clone.

Prior phases (A–G) tracked in `STRATEGIC_AUDIT.md` under each phase's close section.

---

## Deferred items

### I-4 (LOW): SNIPER phantom yaw rotates whole tower group

**Description:** The SNIPER `idleTick` registers a yaw rotation on the root group, not on
a dedicated housing sub-group for the barrel and scope. Two SNIPER towers yaw in unison
because they share the same angular phase offset (not per-instance). Aesthetically minor —
the swivel is subtle. A geometry refactor extracting `scopeGroup` containing scope, barrel,
bipods, and muzzle into a child group of the root would fix it properly.

**Where to fix:** `tower-mesh-factory.service.ts`, SNIPER case (~line 301). Extract
scope/barrel geometry into a `scopeGroup` child, then change `idleTick` to rotate
`group.getObjectByName('scopeGroup')` instead of the root group.

**Prerequisite:** This is also required for SNIPER target-tracking (red-team P2) — do
both in the same PR.

---

### Hover-feedback animation (Sprint 62 deferred)

**Description:** `tickHoverLift` and `HOVER_LIFT_CONFIG` are implemented in
`TowerAnimationService` and `tower-anim.constants.ts`. The accent light brightness lift
is ready. Wiring requires `BoardPointerService.mousemoveHandler` to look up the tower
at `hoveredCoord` via `towerCombatService.getTower(key)` and write `userData['hoverLift']`
on the group.

**Where:** `board-pointer.service.ts` hover path + `game-render.service.ts` animation
tick wiring. Full details in `hover-lift-deferred.md`.

---

### Selection ring pulse (Sprint 63 deferred)

**Description:** `tickSelectionPulse` and `SELECTION_PULSE_CONFIG` are implemented.
`TowerUpgradeVisualService.addGlowRing` exists but is never called from the component.
Wiring requires calling `addGlowRing` / `removeGlowRing` from `selectPlacedTower()` /
`deselectTower()` and exposing `glowRings` as a public getter on `TowerUpgradeVisualService`.

**Where:** `game-board.component.ts` selection path + `tower-upgrade-visual.service.ts`.
Full details in `selection-pulse-deferred.md`.

---

### Frost-mist particles for SLOW (Sprint 32 deferred)

**Description:** SLOW's cryo identity at idle relies on color and geometry. Frost-mist
ambient particles would add role legibility for color-blind players and make SLOW the
most memorable idle effect in the lineup. `SLOW_FROST_CONFIG` constants already exported.

**Where:** `ParticleService` (new `spawnFrostParticle` method) + SLOW `idleTick` in
`tower-mesh-factory.service.ts`. Full implementation plan in `phaseE-frost-deferred.md`.

---

### Real RuntimeModeService low-end gate

**Description:** `attachAccentLight` gates point lights via `document.body.classList.contains
('reduce-motion')` — the accessibility class, not a performance flag. Should use
`RuntimeModeService.isLowEnd` when that service exposes a stable boolean.

**Where:** `tower-mesh-factory.service.ts:attachAccentLight()`. Full details in
`lighting-cohesion.md`.

---

### Per-tower card icons

**Description:** TOWER cards show a generic crosshair icon (`card-hand.component.html`)
regardless of tower type. Per-tower icons would require new SVGs in `icon-registry.ts`
and template updates. Low priority — the card name + accent color is sufficient
disambiguation today. Full details in `card-art-gap.md`.

---

### Phase 5 Siegeworks archetype

Out of scope for this PR per the project plan. Unscoped pending user direction.

---

## Do-not-regress list

Code reviewed and verified during this phase. Changes to any item below require a
corresponding update to this close-out doc and the affected audit doc.

| Item | Location | Why |
|------|----------|-----|
| Tower body colors (`TOWER_MATERIAL_CONFIGS`) | `tower-material.factory.ts` | Load-bearing palette; desaturation was a deliberate design decision |
| `geometryRegistry` / `materialRegistry` patterns | `geometry-registry.service.ts`, `material-registry.service.ts` | Disposal contract — breaking the protect predicate leaks GPU resources |
| `attachAccentLight` guard (`isLowEnd`) | `tower-mesh-factory.service.ts` | Low-end devices skip point lights; removing the guard tanks mobile perf |
| Animation tick methods (all five) | `game-render.service.ts:animate()` | `tickRecoilAnimations`, `tickTubeEmits`, `tickEmitterPulses`, `tickTierUpScale`, `tickSellAnimations` must all be wired together |
| Per-instance material clones: MORTAR body, CHAIN sphere/electrode/arc, SLOW emitter | `tower-mesh-factory.service.ts` | Prevents cross-tower muzzle-flash contamination; removing clone causes Finding G-1 regression |
| `userData['selling']` guard in `tickTierUpScale` | `tower-animation.service.ts` | I-5 fix — removes scale race; removing the guard re-introduces the bug |
| `animated` flag default in `removeMesh` | `tower-mesh-lifecycle.service.ts` | `animated = false` is the safe default for teardown paths; the sell path must explicitly opt in |
| `towerDecalLibrary?.dispose()` order in `cleanupScene` | `game-session.service.ts` | Must run AFTER tower mesh disposal; reversing order disposes textures before materials that reference them |
| `SNIPER_TRACK_CONFIG` in `tower-anim.constants.ts` | `tower-anim.constants.ts` | Scaffolding for future SNIPER target tracking — don't remove or rename |

---

## Browser smoke checklist

See `docs/towers/browser-smoke-checklist.md` for the full 30-item post-merge
verification checklist (placement, tier progression, firing, idle, sell, cohesion,
console hygiene).

---

## Future work (explicitly out of scope for this PR)

- Real `RuntimeModeService.isLowEnd` integration (accent light gate)
- Hover-feedback animation wiring (Sprint 62 infra ready)
- Selection ring pulse wiring (Sprint 63 infra ready)
- SNIPER barrel tracking toward nearest enemy (needs I-4 geometry refactor first)
- Frost-mist particles for SLOW (Sprint 32 deferred)
- MORTAR T2 barrel jacket (red-team P3 — minor punch-list)
- Enemy mesh polish — separate plan if the user wants it
- Phase 5 Siegeworks archetype (unscoped)
