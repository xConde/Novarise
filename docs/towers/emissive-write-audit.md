# Emissive Write Audit — Per-Frame Code Paths

Audited 2026-04-30. All per-frame functions that write `emissiveIntensity`
on tower materials are listed below with their write mode and risk profile.

---

## Write inventory

### 1. `TowerAnimationService.updateTowerAnimations` → SNIPER `idleTick` (and `chargeTick`)

| Field | Value |
|-------|-------|
| Function | SNIPER `idleTick` / `chargeTick` (same function, called twice per frame) |
| File | `tower-mesh-factory.service.ts` (registered at SNIPER case) |
| Target mesh | `'scope'` (lens disk, `sniper:scopeLens` material from registry — **SHARED**) |
| Write mode | **ABSOLUTE** (`= SNIPER_SCOPE_GLOW_CONFIG.min + range * (0.5 + 0.5 * sin(t))`) |
| Derives from | Static constants only |
| Ratchet risk | Low for single-tower. HIGH if `startMuzzleFlash` saves the scope while another SNIPER already spiked the shared material. Mitigated by the baseline-snapshot fix (Sprint 3). |

### 2. `TowerAnimationService.updateTowerAnimations` → SLOW `idleTick`

| Field | Value |
|-------|-------|
| Function | SLOW `idleTick` |
| File | `tower-mesh-factory.service.ts` (registered at SLOW case) |
| Target mesh | `'emitter'` (per-instance cloned material) |
| Write mode | **ABSOLUTE** (`= SLOW_EMITTER_PULSE_CONFIG.min + range * (0.5 + 0.5 * sin(t * omega))`) |
| Derives from | Static constants only |
| Ratchet risk | None — per-instance clone. But `startMuzzleFlash` includes 'emitter' in the save/restore. The emitter's value at save time is a sine value; restore resets to it; idleTick overwrites next frame. No compound accumulation. |

### 3. `TowerAnimationService.updateTowerAnimations` → CHAIN `chargeTick`

| Field | Value |
|-------|-------|
| Function | CHAIN `chargeTick` |
| File | `tower-mesh-factory.service.ts` (registered at CHAIN case) |
| Target mesh | `'sphere'` (per-instance cloned material) |
| Write mode | **ABSOLUTE** (`= CHAIN_CHARGE_CONFIG.emissiveMin + range * (0.5 + 0.5 * sin(t * omega))`) |
| Derives from | Static constants only |
| Ratchet risk | None — `startMuzzleFlash` skip-set excludes `'sphere'` explicitly. |

### 4. `TowerAnimationService.updateTowerAnimations` → CHAIN `idleTick` (electrode shimmer)

| Field | Value |
|-------|-------|
| Function | CHAIN `idleTick`, electrode traverse |
| File | `tower-mesh-factory.service.ts` (registered at CHAIN case) |
| Target mesh | `'electrode'` (uses shared CHAIN body material from registry) |
| Write mode | **ABSOLUTE** (`= CHAIN_ELECTRODE_CONFIG.emissiveBase + shimmerRange * (0.5 + 0.5 * sin(...))`) |
| Derives from | Static constants only |
| Ratchet risk | MEDIUM — electrodes use shared `mat`. If two CHAIN towers fire simultaneously, the muzzle flash save/restore on electrodes can ratchet. Fixed by baseline-snapshot (Sprint 3). |

### 5. `TowerAnimationService.tickTubeEmits`

| Field | Value |
|-------|-------|
| Function | `tickTubeEmits` |
| File | `tower-animation.service.ts` |
| Target mesh | `tube1`…`tube8` (per-instance cloned material via `mat.clone()` in factory) |
| Write mode | **ABSOLUTE** (`= alpha * SPLASH_TUBE_EMIT_CONFIG.emissiveMultiplier`) where alpha decays from 1→0 |
| Derives from | Static constant `emissiveMultiplier = 3` |
| Ratchet risk | None on its own — writes 0 at completion. But `startMuzzleFlash` may save a tube at peak emit (3.0) and restore it there, leaving the tube "stuck" at a bright value if timer expires while tube is mid-emit. Not a compound ratchet but a display artifact. Secondary issue, not the root cause. |

### 6. `TowerAnimationService.tickSellAnimations`

| Field | Value |
|-------|-------|
| Function | `tickSellAnimations` |
| File | `tower-animation.service.ts` |
| Target mesh | All meshes in a selling group |
| Write mode | **ABSOLUTE** (`= base * emissiveFade`), where base is snapshotted once on first sell frame and emissiveFade decreases 1→0 |
| Derives from | Snapshot taken at sell start |
| Ratchet risk | None — absolute writes decreasing toward 0. Groups in sell state are excluded from `chargeTick`/`idleTick` via `userData['selling']` guard. |

---

## Root cause identified

**`startMuzzleFlash` saves `mat.emissiveIntensity` at fire time rather than the
canonical baseline.** When two towers share a material and fire in the same
combat turn (same `fireTurn()` call batch), the order is:

1. Tower-A fires → saves `mat.emissiveIntensity = 0.4`, spikes shared mat to `0.6`
2. Tower-B fires → saves `mat.emissiveIntensity = 0.6` ← already spiked! Spikes to `0.9`
3. Tower-A flash expires → restores mat to `0.4`
4. Tower-B flash expires → restores mat to **`0.6`** ← wrong! baseline is now elevated

After 30 turns with two same-type towers: `0.4 × 1.5^30 ≈ 191 751`.

**Affected tower types:** BASIC, SNIPER, SPLASH, CHAIN, SLOW body meshes all use the
registry-shared `mat`. MORTAR is immune because it clones `mat` per instance — but if
placed alongside other shared-material towers in a high-density board, the other tower
types will ratchet visually.

The user screenshot shows "MORTAR fully blown out" — the MORTAR itself does not ratchet,
but the surrounding BASIC/SNIPER towers may have been ratcheted and the user may have
misidentified the brightest tower.

## Fix summary (Sprint 3)

See `docs/towers/emissive-ratchet-fix.md` for the full description. In brief:
- `TowerMeshFactoryService.createTowerMesh` snapshots `emissiveBaselines` into
  `group.userData['emissiveBaselines']` immediately after construction, before any
  external code can modify the materials.
- `TowerAnimationService.startMuzzleFlash` reads from `emissiveBaselines` instead
  of from `mat.emissiveIntensity` when building the save map.
- After upgrade (`applyUpgradeVisuals`), the card-play / checkpoint-restore paths
  call a new `refreshEmissiveBaselines(tower)` helper to keep the stored baselines
  in sync with the new post-upgrade material state.

## Do not regress checklist (future per-frame writers)

1. Per-frame writes MUST be **absolute** (derive from static constants), never
   `+=` or `*=`.
2. Any new mesh whose emissive is driven per-frame MUST be added to the
   `startMuzzleFlash` skip-set in `tower-animation.service.ts` if it uses a
   shared material.
3. If a new tower type shares its body material across instances, either clone it
   per-instance (like MORTAR) or ensure it appears in no per-frame emissive writer.
4. When `applyUpgradeVisuals` changes emissive intensity, call
   `refreshEmissiveBaselines` immediately after to keep the stored baseline current.
