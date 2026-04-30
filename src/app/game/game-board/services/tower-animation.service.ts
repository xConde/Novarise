import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { PlacedTower, TowerType } from '../models/tower.model';
import { BlockType } from '../models/game-board-tile';
import { ANIMATION_CONFIG } from '../constants/rendering.constants';
import { MUZZLE_FLASH_CONFIG, TILE_PULSE_CONFIG } from '../constants/effects.constants';
import { getMaterials } from '../utils/three-utils';
import {
  BASIC_RECOIL_CONFIG,
  SPLASH_TUBE_EMIT_CONFIG,
  SLOW_EMITTER_PULSE_FIRE,
  TIER_UP_BOUNCE_CONFIG,
  SELL_ANIM_CONFIG,
  SELECTION_PULSE_CONFIG,
  HOVER_LIFT_CONFIG,
} from '../constants/tower-anim.constants';

@Injectable()
export class TowerAnimationService {
  /**
   * Animate tower idle and charge effects. For each group, the call order is:
   *
   *  1. `chargeTick(group, t)` — fires FIRST when registered. Handles charge-up
   *     emissive animations (e.g. CHAIN sphere intensity) that should update
   *     before the idle positional changes so any intensity written by chargeTick
   *     is not overwritten by idleTick in the same frame.
   *  2. `idleTick(group, t)` — fires SECOND when registered. All six redesigned
   *     tower types register an idleTick in TowerMeshFactoryService. Gives each
   *     tower full ownership of its idle animation (position, rotation, opacity).
   *
   * The legacy named-mesh traverse (cases 'crystal', 'spark', 'spore', 'tip')
   * was removed in Phase I once all six tower types shipped their own idleTick
   * hooks. The 'tip'/'orb' skip-sets in startMuzzleFlash and applyUpgradeVisuals
   * were cleaned up accordingly (see Phase I cleanup commits).
   */
  updateTowerAnimations(towerMeshes: Map<string, THREE.Group>, time: number): void {
    const t = time * ANIMATION_CONFIG.msToSeconds;
    for (const group of towerMeshes.values()) {
      const towerType = group.userData['towerType'] as TowerType | undefined;
      if (!towerType) continue;

      // Groups currently animating a sell shrink must not have their emissive
      // overwritten by chargeTick/idleTick — the sell fade owns those uniforms
      // for the duration of the animation. Skip them here; tickSellAnimations
      // drives all visual state until onExpire fires and disposes the group.
      if (group.userData['selling']) continue;

      // chargeTick runs BEFORE idleTick so charge-up emissive changes land first.
      const chargeTick = group.userData['chargeTick'] as ((g: THREE.Group, t: number) => void) | undefined;
      if (typeof chargeTick === 'function') {
        chargeTick(group, t);
      }

      // Per-tower idle hook — all six redesigned types register this. Groups that
      // lack an idleTick (e.g. a test fixture or a future unregistered tower type)
      // simply skip animation this frame rather than falling through to legacy code.
      const idleTick = group.userData['idleTick'] as ((g: THREE.Group, t: number) => void) | undefined;
      if (typeof idleTick === 'function') {
        idleTick(group, t);
      }
    }
  }

  /**
   * Trigger a firing animation for the given tower. Always calls `startMuzzleFlash`
   * to preserve the existing emissive-spike behaviour. If the tower's mesh group has
   * a `userData['fireTick']` function registered, calls it with the group and the
   * muzzle-flash duration so per-tower recoil / charge animations can play without
   * forking this service.
   *
   * Call sites in TowerCombatService should use `triggerFire` instead of calling
   * `startMuzzleFlash` directly so future firing-animation additions don't require
   * touching the combat service again.
   */
  triggerFire(tower: PlacedTower): void {
    // startMuzzleFlash runs unconditionally — its behaviour is well-tested and
    // must not be gated behind the fireTick try/catch block.
    this.startMuzzleFlash(tower);

    if (!tower.mesh) return;
    const fireTick = tower.mesh.userData['fireTick'] as
      ((group: THREE.Group, durationSeconds: number) => void) | undefined;
    if (typeof fireTick === 'function') {
      try {
        fireTick(tower.mesh, MUZZLE_FLASH_CONFIG.duration);
      } catch (err) {
        console.warn('triggerFire: fireTick threw', err);
      }
    }
  }

  /**
   * Spikes emissive intensity on all non-tip meshes in the tower's group when it fires.
   * Saves the canonical baseline per mesh so `updateMuzzleFlashes` can restore it exactly.
   * Calling again while a flash is already active resets the timer (re-trigger on rapid fire).
   *
   * Skip-set: `'tip'` (constant glow — must not be capped) and `'sphere'` (CHAIN tower
   * charge-up mesh — its emissiveIntensity is driven every frame by `chargeTick`.
   * Snapshotting the current animated value as the "original" would restore the sphere
   * to a random charge phase instead of a stable baseline, matching the Finding 12/14
   * class of save/restore cross-contamination).
   *
   * Shared-material ratchet prevention: the saved baseline is read from
   * `tower.emissiveBaselines` (recorded at mesh construction time) rather than from
   * `mat.emissiveIntensity` at fire time. Without this, two towers sharing a body
   * material that fire in the same turn would ratchet: Tower-B's save would capture
   * Tower-A's already-spiked value, and restore would elevate the shared baseline
   * permanently — compounding across every subsequent turn.
   */
  startMuzzleFlash(tower: PlacedTower): void {
    if (!tower.mesh) return;

    // Only save original values on FIRST flash — if a flash is already active,
    // reuse the existing saved values to prevent accumulation (each re-save
    // would capture the already-spiked intensity, ratcheting up forever).
    const isReflash = tower.muzzleFlashTimer !== undefined && tower.muzzleFlashTimer > 0;

    if (!isReflash) {
      const saved = new Map<string, number>();
      // Read baselines from the pre-recorded snapshot rather than from the current
      // material value. Shared materials may already be spiked by a sibling tower
      // that fired earlier in the same combat batch; using the current value would
      // save the elevated intensity and restore to it, permanently ratcheting.
      const baselines = tower.emissiveBaselines
        ?? (tower.mesh.userData['emissiveBaselines'] as Map<string, number> | undefined);

      tower.mesh.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        // 'tip' — constant glow; 'sphere' — CHAIN charge-up driven by chargeTick;
        // 'tubeN' — SPLASH per-tube emit driven by tickTubeEmits.
        // All must be excluded so snapshot → restore does not corrupt animated state.
        if (child.name === 'tip' || child.name === 'sphere') return;
        if (child.name.startsWith('tube')) return;

        const materials = getMaterials(child) as THREE.MeshStandardMaterial[];

        for (const mat of materials) {
          const key = child.uuid + '_' + mat.uuid;
          // Prefer the pre-recorded baseline; fall back to current value for
          // any mesh that was added after construction (e.g. dynamic debug overlays).
          const baselineValue = baselines?.get(key) ?? mat.emissiveIntensity;
          if (baselineValue === undefined) continue;
          saved.set(key, baselineValue);
        }
      });

      tower.originalEmissiveIntensity = saved;
    }

    // Apply the spike from the SAVED originals, not from current (possibly spiked) values
    const originals = tower.originalEmissiveIntensity;
    if (originals) {
      tower.mesh.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        if (child.name === 'tip' || child.name === 'sphere') return;

        const materials = getMaterials(child) as THREE.MeshStandardMaterial[];

        for (const mat of materials) {
          const key = child.uuid + '_' + mat.uuid;
          const base = originals.get(key);
          if (base !== undefined) {
            mat.emissiveIntensity = base * MUZZLE_FLASH_CONFIG.intensityMultiplier;
          }
        }
      });
    }

    tower.muzzleFlashTimer = MUZZLE_FLASH_CONFIG.duration;
  }

  /**
   * Counts down active muzzle flash timers and restores original emissive intensity when done.
   * Call once per animation frame with the real-world deltaTime (seconds).
   */
  updateMuzzleFlashes(towers: Map<string, PlacedTower>, deltaTime: number): void {
    for (const tower of towers.values()) {
      if (tower.muzzleFlashTimer === undefined || !tower.mesh) continue;

      tower.muzzleFlashTimer -= deltaTime;

      if (tower.muzzleFlashTimer <= 0) {
        // Restore saved intensities
        const saved = tower.originalEmissiveIntensity;
        if (saved) {
          tower.mesh.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            if (child.name === 'tip') return;

            const materials = getMaterials(child) as THREE.MeshStandardMaterial[];

            for (const mat of materials) {
              const key = child.uuid + '_' + mat.uuid;
              const original = saved.get(key);
              if (original !== undefined) {
                mat.emissiveIntensity = original;
              }
            }
          });
        }

        tower.muzzleFlashTimer = undefined;
        tower.originalEmissiveIntensity = undefined;
      }
    }
  }

  /**
   * Drive barrel-recoil animations for towers that registered a recoil timer
   * via `userData['recoilStart']` and `userData['recoilDuration']`.
   * Advances each active recoil, slides the barrel child(ren) back along their
   * local +Y axis by the configured distance (ease-out-cubic), then returns
   * them to 0 once the duration elapses.
   *
   * Standard towers (BASIC, SNIPER, CHAIN): the target is the single child
   * named `'barrel'`.
   *
   * MORTAR: fireTick writes `userData['mortarBarrelNames']` with the full set
   * of barrel names. This method applies the offset to every barrel in that
   * list that is currently visible — covering the T1→T2 swap and T3 dual-barrel
   * case without hard-coding MORTAR logic into the switch.
   *
   * Call once per animation frame with the current real-world time in seconds.
   */
  tickRecoilAnimations(towerMeshes: Map<string, THREE.Group>, nowSeconds: number): void {
    for (const group of towerMeshes.values()) {
      const recoilStart = group.userData['recoilStart'] as number | undefined;
      const recoilDuration = group.userData['recoilDuration'] as number | undefined;
      if (recoilStart === undefined || recoilDuration === undefined || recoilDuration <= 0) continue;

      // Per-tower recoil distance: read from userData if set (SNIPER registers
      // 0.08u; MORTAR registers 0.15u; BASIC does not set it, falling back to default).
      const distance = (group.userData['recoilDistance'] as number | undefined)
        ?? BASIC_RECOIL_CONFIG.distance;

      // Barrel name list: MORTAR registers multiple names; others use ['barrel'].
      const barrelNames = (group.userData['mortarBarrelNames'] as readonly string[] | undefined)
        ?? ['barrel'];

      const elapsed = nowSeconds - recoilStart;
      if (elapsed >= recoilDuration) {
        // Animation complete — snap back to neutral and clear state.
        // Use recoilBaseY (stored at factory construction time) so barrels
        // return to their original rest position, not absolute 0. (Finding G-2)
        for (const name of barrelNames) {
          const b = group.getObjectByName(name) as THREE.Mesh | undefined;
          if (b) b.position.y = (b.userData['recoilBaseY'] as number | undefined) ?? 0;
        }
        group.userData['recoilStart'] = undefined;
        group.userData['recoilDuration'] = undefined;
        continue;
      }

      // Normalised time [0..1]; easeOutCubic = 1 - (1 - t)^3
      const raw = elapsed / recoilDuration;
      const eased = 1 - Math.pow(1 - raw, 3);

      // Slide back relative to the barrel's rest position (recoilBaseY).
      // Peak recoil at elapsed=0: position = baseY - distance.
      // Returns to baseY as eased → 1. (Finding G-2: was absolute 0-based)
      const recoilOffset = -distance * (1 - eased);

      for (const name of barrelNames) {
        const b = group.getObjectByName(name) as THREE.Mesh | undefined;
        // Apply recoil only to visible barrels (invisible barrels are tier-gated
        // and should not accumulate a position offset that would appear on reveal).
        if (b?.visible) {
          const baseY = (b.userData['recoilBaseY'] as number | undefined) ?? 0;
          b.position.y = baseY + recoilOffset;
        }
      }
    }
  }

  /**
   * Advance per-frame tube-emit pulse animations on SPLASH towers.
   *
   * Called once per animation frame alongside `tickRecoilAnimations`. Each
   * SPLASH tower group tracks which tube is currently emitting via
   * `userData['emittingTubeIndex']`, `userData['tubeEmitStart']`, and
   * `userData['tubeEmitDuration']`. This method fades the emissive intensity
   * of the active tube from peak to zero over the emit duration, then clears
   * the state when done.
   *
   * The drum group (named 'drum') is walked to locate the tube mesh because
   * tubes are children of the drum and therefore rotate with it.
   */
  tickTubeEmits(towerMeshes: Map<string, THREE.Group>, nowSeconds: number): void {
    for (const group of towerMeshes.values()) {
      const tubeIdx = group.userData['emittingTubeIndex'] as number | undefined;
      const emitStart = group.userData['tubeEmitStart'] as number | undefined;
      const emitDur = group.userData['tubeEmitDuration'] as number | undefined;

      if (tubeIdx === undefined || emitStart === undefined || emitDur === undefined) continue;

      const elapsed = nowSeconds - emitStart;
      const drum = group.getObjectByName('drum');
      if (!drum) continue;

      const tubeName = `tube${tubeIdx + 1}`;
      const tubeMesh = drum.getObjectByName(tubeName) as THREE.Mesh | undefined;

      if (!tubeMesh || !(tubeMesh.material instanceof THREE.MeshStandardMaterial)) continue;

      if (elapsed < emitDur) {
        const alpha = 1 - elapsed / emitDur;
        tubeMesh.material.emissiveIntensity = alpha * SPLASH_TUBE_EMIT_CONFIG.emissiveMultiplier;
      } else {
        tubeMesh.material.emissiveIntensity = 0;
        group.userData['emittingTubeIndex'] = undefined;
        group.userData['tubeEmitStart'] = undefined;
        group.userData['tubeEmitDuration'] = undefined;
      }
    }
  }

  /**
   * Drive emitter-scale pulse animations on SLOW towers.
   *
   * Called once per animation frame alongside `tickRecoilAnimations` and
   * `tickTubeEmits`. Each SLOW tower stores `userData['emitterPulseStart']`
   * and `userData['emitterPulseStart']` when `fireTick` is called. This
   * method scales the 'emitter' dish from 1.0 → SLOW_EMITTER_PULSE_FIRE.scaleMax
   * (quick ease-out) → back to 1.0 over the pulse duration, then clears state.
   */
  tickEmitterPulses(towerMeshes: Map<string, THREE.Group>, nowSeconds: number): void {
    for (const group of towerMeshes.values()) {
      const pulseStart = group.userData['emitterPulseStart'] as number | undefined;
      if (pulseStart === undefined) continue;

      const elapsed = nowSeconds - pulseStart;
      const emitter = group.getObjectByName('emitter') as THREE.Mesh | undefined;

      if (elapsed >= SLOW_EMITTER_PULSE_FIRE.durationSec) {
        // Pulse complete — restore neutral scale and clear state
        if (emitter) emitter.scale.setScalar(1.0);
        group.userData['emitterPulseStart'] = undefined;
        continue;
      }

      if (!emitter) continue;

      // Normalised time [0..1] over the fixed pulse duration constant; easeOutCubic
      const raw = elapsed / SLOW_EMITTER_PULSE_FIRE.durationSec;
      const eased = 1 - Math.pow(1 - raw, 3);

      // Scale expands quickly to peak then eases back toward 1.0
      const scale = SLOW_EMITTER_PULSE_FIRE.scaleMax
        - (SLOW_EMITTER_PULSE_FIRE.scaleMax - 1.0) * eased;
      emitter.scale.setScalar(scale);
    }
  }

  /**
   * Drive tier-up scale bounce animations.
   *
   * When `applyUpgradeVisuals` is called, it writes `userData['scaleAnimStart']`
   * on the tower group with the current wall-clock time in seconds. This method
   * reads that timestamp on each frame, computes elapsed time, and eases the
   * group scale from TIER_UP_BOUNCE_CONFIG.peakScale → the pre-animation scale
   * over TIER_UP_BOUNCE_CONFIG.durationSec. After the animation completes, the
   * timestamp is cleared so future frames skip this group.
   *
   * The pre-animation scale is captured in `userData['scaleAnimBaseScale']` by
   * applyUpgradeVisuals before writing the start timestamp, so the bounce always
   * returns to whatever applyUpgradeVisuals set — not an assumed constant.
   *
   * Call once per animation frame with the current real-world time in seconds.
   */
  tickTierUpScale(towerMeshes: Map<string, THREE.Group>, nowSeconds: number): void {
    for (const group of towerMeshes.values()) {
      const animStart = group.userData['scaleAnimStart'] as number | undefined;
      if (animStart === undefined) continue;

      // If a sell animation has taken ownership of this group's transform, cede
      // control immediately rather than fighting tickSellAnimations for scale
      // ownership. tickSellAnimations will drive scale to 0 and dispose the group.
      if (group.userData['selling']) {
        group.userData['scaleAnimStart'] = undefined;
        group.userData['scaleAnimBaseScale'] = undefined;
        continue;
      }

      const elapsed = nowSeconds - animStart;
      const baseScale = (group.userData['scaleAnimBaseScale'] as number | undefined) ?? 1.0;

      if (elapsed >= TIER_UP_BOUNCE_CONFIG.durationSec) {
        // Animation complete — snap to base scale and clear state.
        group.scale.setScalar(baseScale);
        group.userData['scaleAnimStart'] = undefined;
        group.userData['scaleAnimBaseScale'] = undefined;
        continue;
      }

      // easeOutCubic: starts fast (peak scale) then decelerates toward base
      const raw = elapsed / TIER_UP_BOUNCE_CONFIG.durationSec;
      const eased = 1 - Math.pow(1 - raw, 3);
      const currentScale =
        TIER_UP_BOUNCE_CONFIG.peakScale - (TIER_UP_BOUNCE_CONFIG.peakScale - baseScale) * eased;
      group.scale.setScalar(currentScale);
    }
  }

  /**
   * Drive sell shrink-and-fade animations.
   *
   * When TowerMeshLifecycleService.removeMesh() is called with the animated flag,
   * it writes `userData['sellingStart']` on the group with the current wall-clock
   * time in seconds and sets `userData['selling'] = true`. This method reads those
   * fields per frame, scaling the group from 1.0→ 0.0 over SELL_ANIM_CONFIG.durationSec
   * while fading emissive intensity. When the animation completes, `onExpire` is
   * called with the registry key so the caller can trigger actual disposal.
   *
   * Disposal safety: if the encounter tears down mid-animation (encounter restart
   * or scene cleanup), `cleanupSellAnimations` can be called to immediate-dispose
   * all selling groups without waiting for onExpire.
   *
   * Call once per animation frame with the current real-world time in seconds.
   */
  tickSellAnimations(
    towerMeshes: Map<string, THREE.Group>,
    nowSeconds: number,
    onExpire: (key: string) => void,
  ): void {
    for (const [key, group] of towerMeshes.entries()) {
      if (!group.userData['selling']) continue;

      const sellStart = group.userData['sellingStart'] as number | undefined;
      if (sellStart === undefined) continue;

      // Snapshot original emissive intensities once on the first sell frame so
      // the fade uses absolute assignment rather than multiplicative decay.
      // Multiplicative decay is incorrect: each frame compounds the reduction,
      // and idleTick/chargeTick (now blocked by the 'selling' guard in
      // updateTowerAnimations) would previously re-inflate the value between frames,
      // producing a noisy flicker rather than a smooth fade.
      if (!group.userData['sellEmissiveOrigins']) {
        const origins = new Map<string, number>();
        group.traverse(child => {
          if (!(child instanceof THREE.Mesh)) return;
          const mats = getMaterials(child) as THREE.MeshStandardMaterial[];
          for (const mat of mats) {
            if (mat.emissiveIntensity !== undefined) {
              origins.set(child.uuid + '_' + mat.uuid, mat.emissiveIntensity);
            }
          }
        });
        group.userData['sellEmissiveOrigins'] = origins;
      }

      const elapsed = nowSeconds - sellStart;

      if (elapsed >= SELL_ANIM_CONFIG.durationSec) {
        // Animation complete — clear snapshot and signal caller to dispose the group.
        group.userData['selling'] = false;
        group.userData['sellingStart'] = undefined;
        group.userData['sellEmissiveOrigins'] = undefined;
        onExpire(key);
        continue;
      }

      // Normalized progress [0..1]; easeInCubic so the shrink accelerates
      const raw = elapsed / SELL_ANIM_CONFIG.durationSec;
      const eased = raw * raw * raw; // easeInCubic
      const scale = 1.0 - eased * (1.0 - SELL_ANIM_CONFIG.finalScale);
      group.scale.setScalar(scale);

      // Fade out emissive using absolute assignment from the snapshotted originals
      // so the value is deterministic regardless of frame rate.
      const emissiveFade = 1.0 - eased;
      const origins = group.userData['sellEmissiveOrigins'] as Map<string, number>;
      group.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const mats = getMaterials(child) as THREE.MeshStandardMaterial[];
        for (const mat of mats) {
          const key2 = child.uuid + '_' + mat.uuid;
          const base = origins.get(key2);
          if (base !== undefined) {
            mat.emissiveIntensity = base * emissiveFade;
          }
        }
      });
    }
  }

  /**
   * Drive selection-ring pulse animations.
   *
   * Iterates over the glowRings map (keyed by tower id). For each ring that
   * has `userData['selected'] = true`, pulses its material opacity between
   * SELECTION_PULSE_CONFIG.opacityMin and opacityMax on a sine wave with
   * period SELECTION_PULSE_CONFIG.periodSec. Rings without the flag stay at
   * their static opacity.
   *
   * Call once per animation frame with current wall-clock time in seconds.
   */
  tickSelectionPulse(glowRings: Map<string, THREE.Mesh>, nowSeconds: number): void {
    const omega = (Math.PI * 2) / SELECTION_PULSE_CONFIG.periodSec;
    const range = SELECTION_PULSE_CONFIG.opacityMax - SELECTION_PULSE_CONFIG.opacityMin;

    for (const ring of glowRings.values()) {
      if (!ring.userData['selected']) continue;
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity =
        SELECTION_PULSE_CONFIG.opacityMin + range * (0.5 + 0.5 * Math.sin(nowSeconds * omega));
    }
  }

  /**
   * Drive hover accent-light intensity lift.
   *
   * For each tower group that has `userData['hoverLift'] = true`, lifts its
   * accent PointLight intensity by HOVER_LIFT_CONFIG.intensityMultiplier relative
   * to the light's base intensity stored in `userData['accentLightBaseIntensity']`.
   * When the flag is cleared, the light intensity is restored to the base value.
   *
   * The base intensity is captured on first call when the light is first seen, so
   * this method is safe to call unconditionally every frame.
   *
   * Call once per animation frame.
   */
  tickHoverLift(towerMeshes: Map<string, THREE.Group>): void {
    for (const group of towerMeshes.values()) {
      const light = group.userData['accentLight'] as THREE.PointLight | undefined;
      if (!light) continue;

      // Capture base intensity once (written by attachAccentLight in the factory)
      if (group.userData['accentLightBaseIntensity'] === undefined) {
        group.userData['accentLightBaseIntensity'] = light.intensity;
      }
      const base = group.userData['accentLightBaseIntensity'] as number;
      const hovered = group.userData['hoverLift'] as boolean | undefined;

      light.intensity = hovered ? base * HOVER_LIFT_CONFIG.intensityMultiplier : base;
    }
  }

  /** Pulse spawner and exit tile emissive intensity. */
  updateTilePulse(tileMeshes: Map<string, THREE.Mesh>, time: number): void {
    const t = time * ANIMATION_CONFIG.msToSeconds;
    const intensity = TILE_PULSE_CONFIG.min
      + (Math.sin(t * TILE_PULSE_CONFIG.speed) * 0.5 + 0.5)
      * (TILE_PULSE_CONFIG.max - TILE_PULSE_CONFIG.min);

    for (const mesh of tileMeshes.values()) {
      const tileType = mesh.userData?.['tile']?.type;
      if (tileType === BlockType.SPAWNER || tileType === BlockType.EXIT) {
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
      }
    }
  }
}
