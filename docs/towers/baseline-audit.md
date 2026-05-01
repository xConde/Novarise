# Tower Geometry Baseline Audit

Baseline snapshot of the 6 tower meshes as they existed before visual redesign.
Used as a reference by Phases B–G when replacing each tower's geometry.

---

## BASIC

**Primitives (5):** CylinderGeometry ×4 (obeliskBase, obeliskMid1, obeliskMid2, angled top),
ConeGeometry ×1 (obeliskTop), OctahedronGeometry ×1 (crystal)
— totalling 6 primitives.

**Silhouette:** Stacked-cylinder obelisk with alternating Y-rotations giving a faceted column
effect; culminates in a floating octahedron at the top.

**Named meshes and animation roles:**
- `crystal` (OctahedronGeometry, topmost) — vertical bob + Y-axis rotation driven by
  `TOWER_ANIM_CONFIG.crystalBobSpeed / crystalBobAmplitude / crystalBaseY / basicCrystalRotSpeed`.

**Redesign target:** hex base + swivel turret + segmented barrel (workhorse rifleman).

---

## SNIPER

**Primitives (5):** DodecahedronGeometry ×1 (spikeBase), CylinderGeometry ×2
(spikeShaft1, spikeShaft2), ConeGeometry ×2 (spikeTip, spikePoint).

**Silhouette:** Tall crystalline spike — dodecahedron base rising into a pair of cylinders
that narrow into two stacked cones; elegant and high-profile.

**Named meshes and animation roles:**
- `tip` (spikePoint ConeGeometry, topmost) — emissive intensity pulse (breathes between
  `TOWER_ANIM_CONFIG.tipGlowMin` and `tipGlowMax`) at `tipGlowSpeed`.

**Redesign target:** tripod + long-barrel rifle with optical scope (precision long-range read).

---

## SPLASH

**Primitives (7):** CylinderGeometry ×3 (stemBase, stemMid, capBase),
SphereGeometry ×4 (capTop half-sphere + spore1/2/3).

**Silhouette:** Organic mushroom — squat stem topped with a broad hemispherical cap and
three satellite spore spheres orbiting the cap rim.

**Named meshes and animation roles:**
- `spore` (×3, SphereGeometry, small) — independent Y-axis bob per spore, phase-offset
  by `child.position.x * TOWER_ANIM_CONFIG.sporePhaseScale`, amplitude
  `TOWER_ANIM_CONFIG.sporeBobAmplitude` at `sporeBobSpeed`.

**Redesign target:** multi-barrel rocket cluster on stubby armored base (AOE threat).

---

## SLOW

**Primitives (5):** CylinderGeometry ×4 (iceBase, icePillar, iceRingOuter, iceRingInner),
OctahedronGeometry ×1 (iceCrystal).

**Silhouette:** Wide flat ice pad — thick low base, central pillar rising through a concentric
double-ring collar, topped with a floating octahedral crystal.

**Named meshes and animation roles:**
- `crystal` (OctahedronGeometry, topmost) — vertical bob + Y-axis rotation using the SLOW
  variant constants: `slowCrystalBaseY / slowCrystalBobAmplitude / slowCrystalRotSpeed`.

**Redesign target:** crystalline cryo emitter on pulse-coil base (field-effect support).

---

## CHAIN

**Primitives (5):** CylinderGeometry ×2 (chainBase, chainShaft),
SphereGeometry ×3 (chainOrb, chainSpark1, chainSpark2).

**Silhouette:** Electric antenna — wide low base with a thin shaft rising to a large central
orb; two small satellite spark spheres flank the orb.

**Named meshes and animation roles:**
- `orb` (SphereGeometry, primary sphere) — uniform scale pulse between
  `TOWER_ANIM_CONFIG.orbPulseMin` and `orbPulseMax` at `orbPulseSpeed`.
- `spark` (×2, small SphereGeometry) — vertical bob per spark, phase-offset by
  `child.position.x * sparkPhaseScale`, amplitude `sparkBobAmplitude` at `sparkBobSpeed`.

**Redesign target:** Tesla coil + floating top sphere with arcing electrodes (spectacle tower).

---

## MORTAR

**Primitives (4):** CylinderGeometry ×4 (mortarBase, mortarRing, mortarBarrel, mortarMuzzle).

**Silhouette:** Dark cannon — wide squat double-cylinder base; short angled barrel (~40°
elevation) with a muzzle cap, tilted via `rotation.z = -Math.PI / 4.5`.

**Named meshes and animation roles:** None — no named children; muzzle flash is handled by
the generic `startMuzzleFlash` / `triggerFire` emissive spike.

**Redesign target:** heavy artillery cannon on armored chassis (slow-fire bruiser).
