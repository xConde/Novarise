# Tower Silhouette — Post-Redesign State

Final geometry snapshot after Phases B–G. All 6 types redesigned.
Camera: isometric top-down game view (~55° elevation, slight off-axis).

---

## BASIC — Squat hex-base + swivel turret + segmented barrel

**Primitive count (T1 / T2 / T3):** 12 / 13 / 15 meshes
**Named meshes:** `turret` (Group), `barrelGroup` (Group), `barrel` (seg3),
`barrelCap` (T2, hidden at T1), `pauldron` ×2 (T3), `accent` (emissive sphere)

**From above:** Hexagonal pad dominant, circular turret housing visible, barrel
protrudes along +Z. Clear "rifle on a platform" read.

**From game camera:** Turret height breaks the silhouette clearly above the flat
hex pad; barrel extends forward at a noticeable angle of depression.

**Idle animation hook:** `idleTick` swivels turret ±5° on a slow sine.
**Fire animation hook:** `fireTick` sets `recoilStart`/`recoilDuration` for `barrel` slide.

**Silhouette overlap risk:** Shares a hexagonal base with MORTAR (which also uses
a rectangular chassis). From directly above the hex footprint could be confused, but
the turret + barrel axis distinguishes BASIC immediately. No conflict risk at game
camera.

---

## SNIPER — Tripod + long barrel + optical scope

**Primitive count (T1 / T2 / T3):** 11 / 12 / 12 meshes
**Named meshes:** `barrel`, `scope` (T1, maxTier=1), `scopeLong` (T2+), `bipod` ×2
(maxTier=2), `muzzle`, `stabilizer` (T3), `accent` (lens, per-type emissive)

**From above:** Three splayed tripod legs immediately unique — no other tower has
the radial strut silhouette. Long horizontal barrel axis (±Z) and scope housing visible.

**From game camera:** Tripod legs spread at the base give a low, wide read. Barrel
extends far forward — longest reach silhouette of all 6 towers.

**Idle animation hook:** `idleTick` pulses scope lens emissive (breathing).
**Fire animation hook:** `fireTick` recoils `barrel` 0.08u along bore axis.

**Silhouette overlap risk:** None. Tripod base + horizontal barrel is unique.

---

## SPLASH — Armored chassis + rotating drum + rocket tube cluster

**Primitive count (T1 / T2 / T3):** 17 / 19 / 23 meshes (tubes are per-clone)
**Named meshes:** `drum` (Group), `tube1`–`tube8` (per-instance clones),
`heatVent` (T3), ammo-belt detail (unnamed)

**From above:** Wide square chassis with four side fins; drum housing protrudes
above chassis centre. Tube cluster facing forward (+Z) visible as a dense ring
of circles.

**From game camera:** Fins on chassis sides distinguish from BASIC/MORTAR. Drum
rotation and tube cluster give a "revolving rocket launcher" read.

**Idle animation hook:** `idleTick` accumulates drum rotation angle using delta-time.
**Fire animation hook:** `fireTick` sets drum spin boost + round-robin tube emit index.

**Silhouette overlap risk:** Chassis width is similar to MORTAR from above, but the
drum housing + tube cluster protrusion forward is distinct. No confusion at game camera.

---

## SLOW — Crystalline cryo emitter on pulse-coil base

**Primitive count (T1 / T2 / T3):** 8 / 10 / 11 meshes
**Named meshes:** `coil` (T1 torus), `coil2` (T2+), `emitter` (per-instance clone,
cryo dish), `crystalCore` (T3, floating octahedron)

**From above:** Octahedron base is unique (8-faceted footprint vs cylinders/boxes
of other towers). Torus ring(s) visible concentrically around the base.

**From game camera:** Torus coil rings give an immediately distinct layered profile.
Cryo emitter dish at top is a concave bowl — no other tower has this concave
reading at its apex. T3 crystal floats above, closing a strong vertical hierarchy.

**Idle animation hook:** `idleTick` breathes emitter emissive + coil ring rotation +
T3 crystal Y-bob (via `getObjectByName('crystalCore')`).
**Fire animation hook:** `fireTick` sets `emitterPulseStart` for scale pulse.

**Silhouette overlap risk:** None. Octahedron base + coil tori + concave dish apex
is unique in the lineup.

---

## CHAIN — Tesla coil + floating sphere + arcing electrodes

**Primitive count (T1 / T2 / T3):** 13 / 14 / 15 meshes
**Named meshes:** `sphere` (per-instance), `electrode` ×4 (per-instance),
`arc` (per-instance, opacity-animated), `orbitSphere2` (T2), `orbitSphere3` (T3)

**From above:** Three horizontal torus rings tapering from bottom to top give a
unique stacked-ring column profile. Sphere visible at apex.

**From game camera:** The Tesla coil taper is instantly readable: three stacked
rings diminishing upward, then floating sphere clear above the top ring. Electrode
spikes radiate outward from the sphere equator. No other tower stacks three rings.

**Idle animation hook:** `idleTick` sphere Y-bob + arc flicker opacity +
electrode shimmer (phase-offset per electrode X position) + T2/T3 orbit paths.
**Fire animation hook:** `fireTick` sets `recoilStart`/`recoilDuration` (brief
spike marker for charge animation).

**Silhouette overlap risk:** None. Tapering torus stack is entirely unique.

---

## MORTAR — Heavy armored chassis + elevated angled barrel

**Primitive count (T1 / T2 / T3):** 11 / 12 / 13 meshes (per-instance material)
**Named meshes:** `mortarBase` (housing cylinder), `barrelPivot` (Group, 45° tilt),
`barrelT1` (maxTier=1), `barrelT2` (minTier=2), `dualBarrel` (T3, side-by-side),
`cradle`

**From above:** Wide rectangular chassis (broadest footprint in the lineup) with
tread strips on ±X sides. Barrel angled upward at 45° — tip visible above the
housing silhouette.

**From game camera:** Chassis wide and low. Barrel elevation angle (45°) is
immediately distinctive — the only tower with a clearly angled-up barrel. T3
dual barrel reads as two parallel tubes side-by-side (X offset).

**Idle animation hook:** None (static — no `idleTick` registered).
**Fire animation hook:** `fireTick` sets `recoilStart`/`recoilDuration`/`recoilDistance`
(0.15u, 3× BASIC) + `mortarBarrelNames` for all three barrel names.

**Silhouette overlap risk:** Chassis footprint is wider than SPLASH from above,
but the angled barrel elevation is unique. No confusion risk at game camera angle.

---

## Silhouette uniqueness verdict

| Tower  | Top-down read       | Game-camera read             | Unique? |
|--------|---------------------|------------------------------|---------|
| BASIC  | Hex pad + barrel    | Turret + forward barrel      | Yes     |
| SNIPER | Tripod legs splayed | Low tripod + long barrel     | Yes     |
| SPLASH | Square chassis + drum | Wide chassis + tube cluster | Yes     |
| SLOW   | Octahedron + tori   | Layered rings + concave dish | Yes     |
| CHAIN  | Stacked tori taper  | Tapering coils + sphere apex | Yes     |
| MORTAR | Wide rect + angled  | Low chassis + angled barrel  | Yes     |

All 6 are uniquely identifiable at-a-glance. No overlap risk at game camera.
