import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { PlacedTower, TowerType } from '../models/tower.model';
import { BlockType } from '../models/game-board-tile';
import { ANIMATION_CONFIG } from '../constants/rendering.constants';
import { MUZZLE_FLASH_CONFIG, TOWER_ANIM_CONFIG, TILE_PULSE_CONFIG } from '../constants/effects.constants';
import { getMaterials } from '../utils/three-utils';
import { BASIC_RECOIL_CONFIG, SPLASH_TUBE_EMIT_CONFIG, SLOW_EMITTER_PULSE_FIRE } from '../constants/tower-anim.constants';

@Injectable()
export class TowerAnimationService {
  /**
   * Animate tower idle and charge effects. For each group, the call order is:
   *
   *  1. `chargeTick(group, t)` — fires FIRST when registered. Handles charge-up
   *     emissive animations (e.g. CHAIN sphere intensity) that should update
   *     before the idle positional changes so any intensity written by chargeTick
   *     is not overwritten by idleTick in the same frame.
   *  2. `idleTick(group, t)` — fires SECOND when registered. Gives the redesigned
   *     tower full ownership of idle animation (position, rotation, opacity).
   *     When present, the legacy named-mesh traverse is skipped entirely so stale
   *     handlers (e.g. 'crystal' for old BASIC) do not interfere.
   *  3. Legacy named-mesh traverse — runs only when idleTick is absent, keeping
   *     old towers (MORTAR) animated until each type ships its own hook.
   */
  updateTowerAnimations(towerMeshes: Map<string, THREE.Group>, time: number): void {
    const t = time * ANIMATION_CONFIG.msToSeconds;
    for (const group of towerMeshes.values()) {
      const towerType = group.userData['towerType'] as TowerType | undefined;
      if (!towerType) continue;

      // chargeTick runs BEFORE idleTick so charge-up emissive changes land first.
      const chargeTick = group.userData['chargeTick'] as ((g: THREE.Group, t: number) => void) | undefined;
      if (typeof chargeTick === 'function') {
        chargeTick(group, t);
      }

      // Per-tower idle hook — when present, gives the redesigned tower full
      // ownership of its animation and skips the legacy traverse entirely.
      const idleTick = group.userData['idleTick'] as ((g: THREE.Group, t: number) => void) | undefined;
      if (typeof idleTick === 'function') {
        idleTick(group, t);
        continue;
      }

      group.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        switch (child.name) {
          case 'crystal':
            if (towerType === TowerType.BASIC) {
              child.position.y = TOWER_ANIM_CONFIG.crystalBaseY
                + Math.sin(t * TOWER_ANIM_CONFIG.crystalBobSpeed) * TOWER_ANIM_CONFIG.crystalBobAmplitude;
              child.rotation.y = t * TOWER_ANIM_CONFIG.basicCrystalRotSpeed;
            } else if (towerType === TowerType.SLOW) {
              child.position.y = TOWER_ANIM_CONFIG.slowCrystalBaseY
                + Math.sin(t * TOWER_ANIM_CONFIG.crystalBobSpeed) * TOWER_ANIM_CONFIG.slowCrystalBobAmplitude;
              child.rotation.y = t * TOWER_ANIM_CONFIG.slowCrystalRotSpeed;
            }
            break;

          case 'orb': {
            const pulseScale = TOWER_ANIM_CONFIG.orbPulseMin
              + (Math.sin(t * TOWER_ANIM_CONFIG.orbPulseSpeed) * 0.5 + 0.5)
              * (TOWER_ANIM_CONFIG.orbPulseMax - TOWER_ANIM_CONFIG.orbPulseMin);
            child.scale.setScalar(pulseScale);
            break;
          }

          case 'spark': {
            if (child.userData['baseY'] === undefined) child.userData['baseY'] = child.position.y;
            child.position.y = child.userData['baseY']
              + Math.sin(t * TOWER_ANIM_CONFIG.sparkBobSpeed + child.position.x * TOWER_ANIM_CONFIG.sparkPhaseScale) * TOWER_ANIM_CONFIG.sparkBobAmplitude;
            break;
          }

          case 'spore': {
            if (child.userData['baseY'] === undefined) child.userData['baseY'] = child.position.y;
            child.position.y = child.userData['baseY']
              + Math.sin(t * TOWER_ANIM_CONFIG.sporeBobSpeed + child.position.x * TOWER_ANIM_CONFIG.sporePhaseScale) * TOWER_ANIM_CONFIG.sporeBobAmplitude;
            break;
          }

          case 'tip': {
            const mat = child.material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = TOWER_ANIM_CONFIG.tipGlowMin
              + (Math.sin(t * TOWER_ANIM_CONFIG.tipGlowSpeed) * 0.5 + 0.5)
              * (TOWER_ANIM_CONFIG.tipGlowMax - TOWER_ANIM_CONFIG.tipGlowMin);
            break;
          }
        }
      });
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
   * Saves the current intensity per mesh so `updateMuzzleFlashes` can restore it exactly.
   * Calling again while a flash is already active resets the timer (re-trigger on rapid fire).
   *
   * Skip-set: `'tip'` (constant glow — must not be capped) and `'sphere'` (CHAIN tower
   * charge-up mesh — its emissiveIntensity is driven every frame by `chargeTick`.
   * Snapshotting the current animated value as the "original" would restore the sphere
   * to a random charge phase instead of a stable baseline, matching the Finding 12/14
   * class of save/restore cross-contamination).
   */
  startMuzzleFlash(tower: PlacedTower): void {
    if (!tower.mesh) return;

    // Only save original values on FIRST flash — if a flash is already active,
    // reuse the existing saved values to prevent accumulation (each re-save
    // would capture the already-spiked intensity, ratcheting up forever).
    const isReflash = tower.muzzleFlashTimer !== undefined && tower.muzzleFlashTimer > 0;

    if (!isReflash) {
      const saved = new Map<string, number>();

      tower.mesh.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        // 'tip' — constant glow; 'sphere' — CHAIN charge-up driven by chargeTick.
        // Both must be excluded so snapshot → restore does not corrupt animated state.
        if (child.name === 'tip' || child.name === 'sphere') return;

        const materials = getMaterials(child) as THREE.MeshStandardMaterial[];

        for (const mat of materials) {
          if (mat.emissiveIntensity === undefined) continue;
          saved.set(child.uuid + '_' + mat.uuid, mat.emissiveIntensity);
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
        // Animation complete — snap back to neutral and clear state
        for (const name of barrelNames) {
          const b = group.getObjectByName(name) as THREE.Mesh | undefined;
          if (b) b.position.y = 0;
        }
        group.userData['recoilStart'] = undefined;
        group.userData['recoilDuration'] = undefined;
        continue;
      }

      // Normalised time [0..1]; easeOutCubic = 1 - (1 - t)^3
      const raw = elapsed / recoilDuration;
      const eased = 1 - Math.pow(1 - raw, 3);

      // Slide back at the start, return toward neutral as eased approaches 1.
      // Peak recoil at t=0 (offset = -distance), returns to 0 at t=1.
      const offset = -distance * (1 - eased);

      for (const name of barrelNames) {
        const b = group.getObjectByName(name) as THREE.Mesh | undefined;
        // Apply recoil only to visible barrels (invisible barrels are tier-gated
        // and should not accumulate a position offset that would appear on reveal).
        if (b?.visible) b.position.y = offset;
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
   * and `userData['emitterPulseDuration']` when `fireTick` is called. This
   * method scales the 'emitter' dish from 1.0 → SLOW_EMITTER_PULSE_FIRE.scaleMax
   * (quick ease-out) → back to 1.0 over the pulse duration, then clears state.
   */
  tickEmitterPulses(towerMeshes: Map<string, THREE.Group>, nowSeconds: number): void {
    for (const group of towerMeshes.values()) {
      const pulseStart = group.userData['emitterPulseStart'] as number | undefined;
      const pulseDuration = group.userData['emitterPulseDuration'] as number | undefined;
      if (pulseStart === undefined || pulseDuration === undefined || pulseDuration <= 0) continue;

      const elapsed = nowSeconds - pulseStart;
      const emitter = group.getObjectByName('emitter') as THREE.Mesh | undefined;

      if (elapsed >= SLOW_EMITTER_PULSE_FIRE.durationSec) {
        // Pulse complete — restore neutral scale and clear state
        if (emitter) emitter.scale.setScalar(1.0);
        group.userData['emitterPulseStart'] = undefined;
        group.userData['emitterPulseDuration'] = undefined;
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
