# Emissive Ratchet Fix

## What the bug looked like

Turn 17 of an encounter, a MORTAR tower appeared fully blown-out white.
The player reported: "the more they fire the more brighter they're getting."
The emissive intensity was compounding across fires rather than spiking and
returning to baseline.

The MORTAR itself was not necessarily the source — it clones its body
material per-instance so it is immune to the cross-talk mechanism. The more
likely culprit was a BASIC, SNIPER, or CHAIN tower on the same board, whose
shared registry material was ratcheting, and the user attributed the glow to
the most prominent tower in the frame.

## Root cause

`TowerAnimationService.startMuzzleFlash` saved `mat.emissiveIntensity` at
fire time. Towers of the same type share a single body material via the
`MaterialRegistryService` cache. When two same-type towers fire in the same
combat turn (inside the same `fireTurn()` call batch), the saves happen in
sequence:

1. Tower-A fires → reads `mat.emissiveIntensity = 0.4` (baseline), saves
   `0.4`, spikes shared material to `0.4 × 1.5 = 0.6`.
2. Tower-B fires → reads `mat.emissiveIntensity = 0.6` (already spiked!),
   saves `0.6`, spikes to `0.6 × 1.5 = 0.9`.
3. Tower-A flash expires → restores shared mat to `0.4`.
4. Tower-B flash expires → restores shared mat to `0.6` (the wrong saved
   value — permanently elevated).

On the next turn the new "baseline" is `0.6`. Both towers fire again, and
the pattern repeats: `0.6 → 0.9 → 1.35 → …`. After 30 turns of two
co-firing same-type towers the intensity reaches `0.4 × 1.5^30 ≈ 76 700×`
baseline.

Reproduction spec `tower-animation.service.spec.ts` ("body material returns
to baseline after 30 fire cycles with two shared-material towers") confirmed
the explosion: `Expected 76700 to be less than or equal 0.42`.

## The fix

**`TowerMeshFactoryService.snapshotEmissiveBaselines(group)`** — a new
static helper that walks the group immediately after construction and stores
every mesh's `emissiveIntensity` in `group.userData['emissiveBaselines']`
(keyed by `child.uuid + '_' + mat.uuid`). The skip-set ('tip', 'sphere')
matches `startMuzzleFlash` so animated meshes are not locked to a snapshot.

**`TowerAnimationService.startMuzzleFlash`** — on the first flash (when
`isReflash = false`), reads from `tower.emissiveBaselines ?? tower.mesh.userData['emissiveBaselines']`
instead of `mat.emissiveIntensity`. Tower-B now reads `0.4` from its
pre-recorded baseline regardless of whether Tower-A already spiked the
shared material in the same frame. Both saves are `0.4`. Both restores write
`0.4`. No accumulation.

All four `applyUpgradeVisuals` call sites now call
`TowerMeshFactoryService.snapshotEmissiveBaselines(mesh)` immediately after
the upgrade so the stored baselines stay in sync with the new post-upgrade
material intensities. They also clear `placedTower.emissiveBaselines` and
`originalEmissiveIntensity` so the next flash reads fresh values.

## New invariant

Between fires (after `updateMuzzleFlashes` expires the timer and before any
per-frame tick runs), each tower's body material `emissiveIntensity` equals
the value recorded in `userData['emissiveBaselines']` at construction time.
This invariant holds even with multiple same-type towers co-firing on the
same turn.

## Do not regress checklist (future per-frame writers)

1. Per-frame emissive writes must be **absolute** (`mat.emissiveIntensity = X`
   derived from static constants). Never `+=` or `*=`.
2. Any mesh whose emissive is driven per-frame **and** uses a shared registry
   material must be in the `startMuzzleFlash` skip-set. Current skip-set:
   `'tip'` and `'sphere'`.
3. New tower types that share a body material across instances must either:
   (a) clone the material per-instance at construction time (like MORTAR), or
   (b) ensure the type's body material is not written per-frame outside of
       `startMuzzleFlash`.
4. After any call to `applyUpgradeVisuals`, call
   `TowerMeshFactoryService.snapshotEmissiveBaselines(mesh)` to update the
   stored baselines. Also clear `placedTower.originalEmissiveIntensity` and
   `emissiveBaselines` so the next flash reads from the refreshed snapshot.
5. The `geoBox.dispose()` / `mat.dispose()` pattern in every new spec that
   creates Three.js objects is mandatory — leak the GPU resources in a test
   and the headless Chrome process accumulates them silently.
