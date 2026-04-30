# Tower Material Audit — Phase H

Audits material allocation per tower type across all tiers. Registry = shared
`MaterialRegistryService` singleton. Per-instance = `.clone()` of the prototype.

---

## BASIC

| Mesh                 | Material source          | Why                                |
|----------------------|--------------------------|------------------------------------|
| pad, bolts, turret,  | Registry singleton       | No frame-by-frame mutation         |
| vents, barrel segs,  | (`tower:BASIC`)          |                                    |
| fin, cap, pauldrons  |                          |                                    |
| accent sphere        | Registry singleton       | `emissiveIntensity` not mutated    |
|                      | (`basic:accentSphere`)   | per-frame in animation loop        |

**T1 instances:** 1 registry mat + 1 accent mat = 2 material instances
**T2 instances:** same (barrelCap revealed)
**T3 instances:** same (pauldrons revealed)

**Consistency:** Correct. Accent sphere emissive is constant (1.2); not animated
per-frame so shared is safe.

---

## SNIPER

| Mesh                      | Material source             | Why                              |
|---------------------------|-----------------------------|----------------------------------|
| post, struts, barrel,     | Registry singleton          | No frame-by-frame mutation       |
| scope, bipods, muzzle,    | (`tower:SNIPER`)            |                                  |
| stabilizer, vents         |                             |                                  |
| scope lens                | Registry singleton          | `emissiveIntensity` pulsed via   |
|                           | (`sniper:scopeLens`)        | `idleTick` on THIS instance's    |
|                           |                             | material — NOT cloned            |

**T1/T2/T3 instances:** 1 registry mat + 1 lens mat = 2 material instances

**Issue flagged:** The scope lens `idleTick` mutates `emissiveIntensity` on the
registry-shared `sniper:scopeLens` material. If two SNIPER towers are placed, both
lenses share the same material instance and pulse together in sync. This is an
aesthetic artefact (two lenses pulsing in sync looks intentional), not a save/restore
corruption bug like SPLASH/SLOW/MORTAR (the lens is not in `startMuzzleFlash`'s
save set). Flagged for Phase I: clone the lens material per-instance for independent
pulsing. Not fixed here — no correctness impact.

---

## SPLASH

| Mesh                  | Material source              | Why                              |
|-----------------------|------------------------------|----------------------------------|
| chassis, fins, drum,  | Registry singleton           | No frame-by-frame mutation       |
| ports, ammo detail    | (`tower:SPLASH`)             |                                  |
| tube1–tube8           | Registry clone per tube      | `tickTubeEmits` mutates          |
|                       | (`mat.clone()` in factory)   | `emissiveIntensity` per tube     |
| heatVent              | Registry singleton           | Constant high emissive (0.9);    |
|                       | (`splash:heatVent`)          | not mutated per-frame            |

**T1 instances:** 1 body + 4 tube clones + 1 heatVent = 6 material instances
**T2 instances:** 1 + 6 clones + 1 = 8
**T3 instances:** 1 + 8 clones + 1 = 10

**Consistency:** Correct. Tube clones are necessary; heatVent shared is safe.

---

## SLOW

| Mesh                  | Material source              | Why                              |
|-----------------------|------------------------------|----------------------------------|
| base, struts, coils,  | Registry singleton           | No frame-by-frame mutation       |
| crystalCore           | (`tower:SLOW`)               |                                  |
| emitter dish          | Registry proto → `.clone()`  | `idleTick` breathes              |
|                       | (`slow:emitter` + clone)     | `emissiveIntensity` per-frame;   |
|                       |                              | `startMuzzleFlash` save/restore  |

**T1/T2 instances:** 1 body + 1 emitter clone = 2 material instances
**T3 instances:** same (crystalCore uses body mat)

**Consistency:** Correct. Per the CLAUDE.md Finding 12 fix, emitter must be
per-instance to avoid cross-tower flash contamination.

---

## CHAIN

| Mesh                    | Material source              | Why                              |
|-------------------------|------------------------------|----------------------------------|
| post, coils ×3          | Registry singleton           | No frame-by-frame mutation       |
|                         | (`tower:CHAIN`)              |                                  |
| sphere                  | Registry proto → `.clone()`  | `chargeTick` + `startMuzzleFlash`|
|                         | (`chain:sphere`)             | mutate per-frame                 |
| electrodes ×4           | Registry proto → `.clone()`  | `idleTick` shimmer per electrode |
|                         | (`chain:electrode`, ×4)      | requires independent state       |
| arc cylinder            | Raw `new MeshStandardMaterial`| Opacity animated per-frame;      |
|                         | (NOT registry — intentional) | must be per-instance; no registry|
|                         |                              | entry so `disposeGroup` traverses|
|                         |                              | and disposes it directly         |
| orbitSphere2/3          | Registry proto → `.clone()`  | Independent charge state T2/T3   |
|                         | (`chain:orbitSphere`)        |                                  |

**T1 instances:** 1 body + 1 sphere + 4 electrode + 1 arc = 7 material instances
**T2 instances:** 7 + 1 orbit2 = 8
**T3 instances:** 8 + 1 orbit3 = 9

**Consistency:** Correct. `arcMat` is intentionally unregistered — see factory
comment. No correctness bug; `disposeGroup` full-traverse disposes it.

---

## MORTAR

| Mesh                       | Material source              | Why                              |
|----------------------------|------------------------------|----------------------------------|
| chassis, treads, vents,    | Registry proto → `.clone()`  | `startMuzzleFlash` iterates ALL  |
| housing, barrelT1/T2,      | (`tower:MORTAR` + `.clone()`)| group meshes including body.     |
| dualBarrel, cradle,        |                              | Per-instance clone prevents      |
| ammoCrate, shells          |                              | cross-tower flash cross-talk     |
|                            |                              | (G-1 fix, Phase H)               |

**T1/T2/T3 instances:** 1 per-instance clone = 1 material instance (all meshes share
the one clone within the tower; isolation is per-tower, not per-mesh)

**Consistency:** Correct post G-1 fix. Before Phase H, MORTAR used the registry
singleton causing all MORTAR towers to share one GPU uniform for emissive, letting
one tower's muzzle flash spike the other's body.

---

## Summary

| Tower  | Body mat   | Per-instance clones             | Total at T1 |
|--------|------------|---------------------------------|-------------|
| BASIC  | Shared     | accent (1)                      | 2           |
| SNIPER | Shared     | lens (1) — see issue above      | 2           |
| SPLASH | Shared     | tubes ×4 (T1)                   | 6           |
| SLOW   | Shared     | emitter (1)                     | 2           |
| CHAIN  | Shared     | sphere (1), electrode ×4, arc   | 7           |
| MORTAR | Per-tower  | (all body meshes share 1 clone) | 1           |

**Deferred:** SNIPER lens material should be cloned per-instance for independent
pulse behavior. No correctness bug today (lens is excluded from `startMuzzleFlash`
and emissive save/restore). Track for Phase I.
