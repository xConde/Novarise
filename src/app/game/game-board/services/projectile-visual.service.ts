import { Injectable, OnDestroy } from '@angular/core';
import * as THREE from 'three';

import { PROJECTILE_HITSCAN_CONFIG } from '../constants/projectile.constants';

/**
 * Manages all in-flight projectile visuals regardless of idiom.
 *
 * Sprint 1 ships the HITSCAN idiom (sniper rifle line-flash).
 * Future sprints add arc / chain / splash / status by extending this
 * service.
 *
 * ## Design contract
 * - Projectile visuals are COSMETIC — damage is applied synchronously by
 *   TowerCombatService before this service is called.
 * - The dispatcher never delays or gates the damage path.
 * - All Three.js resources created here are disposed when they expire or
 *   when cleanup() is called, whichever comes first.
 *
 * ## Reduce-motion
 * When `body.reduce-motion` is present **or** the OS-level
 * `prefers-reduced-motion: reduce` media query is active, no line is
 * created.  The damage popup still fires via the existing damage path —
 * feedback is preserved.
 *
 * ## Lifecycle
 * Component-scoped — provided in `GameBoardComponent.providers`.
 * `cleanup()` is called by `GameSessionService.cleanupScene()`.
 * `ngOnDestroy()` is a safety net for route-change teardown.
 */
@Injectable()
export class ProjectileVisualService implements OnDestroy {
  /** Managed list of in-flight hitscan entries. */
  private readonly hitscanEntries: HitscanEntry[] = [];

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Spawn a brief line-flash from `from` to `to` in the given scene.
   *
   * The visual is gated by the reduce-motion preference — see class doc.
   * Safe to call with any combination of positions; a degenerate line
   * (zero length) is silently skipped.
   *
   * @param from   World-space origin (tower top, already offset by caller).
   * @param to     World-space endpoint (enemy centre, already offset by caller).
   * @param color  Hex colour applied to the LineBasicMaterial.
   * @param scene  Active Three.js scene; the line is added immediately.
   */
  fireHitscan(from: THREE.Vector3, to: THREE.Vector3, color: number, scene: THREE.Scene): void {
    if (this.isReduceMotion()) return;

    // Guard degenerate geometry.
    if (from.distanceTo(to) < 0.001) return;

    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      linewidth: PROJECTILE_HITSCAN_CONFIG.linewidth,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 2;

    scene.add(line);

    this.hitscanEntries.push({ line, geo, mat, age: 0, scene });
  }

  /**
   * Advance all in-flight visuals by `deltaTime` seconds.
   * Expired entries are removed from the scene and their GPU resources
   * are disposed.  Call once per animation frame.
   */
  update(deltaTime: number): void {
    const { lifetimeSec, fadeInSec, fadeOutSec } = PROJECTILE_HITSCAN_CONFIG;

    for (let i = this.hitscanEntries.length - 1; i >= 0; i--) {
      const entry = this.hitscanEntries[i];
      entry.age += deltaTime;

      if (entry.age >= lifetimeSec) {
        this.disposeEntry(entry);
        this.hitscanEntries.splice(i, 1);
        continue;
      }

      // Opacity ramp: 0→1 during fadeInSec, hold, then 1→0 during fadeOutSec.
      const fadeOutStart = lifetimeSec - fadeOutSec;
      let opacity: number;
      if (entry.age < fadeInSec) {
        opacity = entry.age / fadeInSec;
      } else if (entry.age >= fadeOutStart) {
        opacity = 1 - (entry.age - fadeOutStart) / fadeOutSec;
      } else {
        opacity = 1;
      }
      entry.mat.opacity = Math.max(0, Math.min(1, opacity));
    }
  }

  /**
   * Dispose all in-flight visuals and remove them from their scenes.
   * Idempotent — safe to call multiple times or before any visuals exist.
   * Also accepts an optional `scene` parameter (unused; kept for API
   * symmetry with other visual services that need an explicit scene ref).
   */
  cleanup(_scene?: THREE.Scene): void {
    for (const entry of this.hitscanEntries) {
      this.disposeEntry(entry);
    }
    this.hitscanEntries.length = 0;
  }

  /** Angular lifecycle hook — delegates to cleanup() for route-change safety. */
  ngOnDestroy(): void {
    this.cleanup();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  /**
   * Returns true when any reduce-motion preference is active.
   * Checks both the CSS class applied by the settings toggle and the
   * OS-level media query so all code paths are covered.
   */
  private isReduceMotion(): boolean {
    if (typeof document === 'undefined') return false;
    if (document.body.classList.contains('reduce-motion')) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }

  /** Remove the line from its scene and free all GPU resources. */
  private disposeEntry(entry: HitscanEntry): void {
    entry.scene.remove(entry.line);
    entry.geo.dispose();
    entry.mat.dispose();
  }
}

// ── Internal types ────────────────────────────────────────────────────────

/** One in-flight hitscan visual. */
interface HitscanEntry {
  readonly line: THREE.Line;
  readonly geo: THREE.BufferGeometry;
  readonly mat: THREE.LineBasicMaterial;
  /** Seconds elapsed since spawn. */
  age: number;
  /** Scene the line was added to — needed for safe removal. */
  readonly scene: THREE.Scene;
}
