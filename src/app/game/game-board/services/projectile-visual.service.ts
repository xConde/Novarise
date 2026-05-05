import { Injectable, OnDestroy } from '@angular/core';
import * as THREE from 'three';

import { PROJECTILE_HITSCAN_CONFIG, PROJECTILE_BOLT_CONFIG, PROJECTILE_ARC_CONFIG, PROJECTILE_SPLASH_CONFIG, PROJECTILE_AURA_CONFIG } from '../constants/projectile.constants';

/**
 * Manages all in-flight projectile visuals regardless of idiom.
 *
 * Sprint 1 ships the HITSCAN idiom (sniper rifle line-flash).
 * Sprint 2 ships the BOLT idiom (traveling sphere for BASIC tower).
 * Sprint 3 ships the ARC idiom (parabolic shell for MORTAR).
 * Future sprints add chain / splash / status by extending this service.
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
 * `prefers-reduced-motion: reduce` media query is active, no visual is
 * created.  The damage popup still fires via the existing damage path —
 * feedback is preserved.
 *
 * ## Single-array discriminated union
 * All in-flight entries (hitscan and bolt) live in one `entries` list.
 * Each entry carries a `kind` discriminator so `update()` can branch on
 * idiom-specific logic in a single iteration pass.  Two separate arrays
 * would force `update()` and `cleanup()` to loop twice and keep two
 * length fields in sync — not worth it for two idioms.
 *
 * ## Lifecycle
 * Component-scoped — provided in `GameBoardComponent.providers`.
 * `cleanup()` is called by `GameSessionService.cleanupScene()`.
 * `ngOnDestroy()` is a safety net for route-change teardown.
 */
@Injectable()
export class ProjectileVisualService implements OnDestroy {
  /** Managed list of all in-flight projectile entries (hitscan + bolt + arc + splash + aura). */
  private readonly entries: ProjectileEntry[] = [];

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

    this.entries.push({ kind: 'hitscan', line, geo, mat, age: 0, scene });
  }

  /**
   * Spawn a sphere that travels linearly from `fromWorld` to `toWorld` over
   * `PROJECTILE_BOLT_CONFIG.lifetimeSec` seconds.
   *
   * The visual is gated by the reduce-motion preference — see class doc.
   * On expiry the mesh, geometry, and material are disposed automatically.
   *
   * @param fromWorld  World-space origin (tower position, Y already includes yOffsetTower).
   * @param toWorld    World-space destination (enemy position, Y already includes yOffsetEnemy).
   * @param color      Hex colour applied to the MeshBasicMaterial.
   * @param scene      Active Three.js scene; the mesh is added immediately.
   */
  fireBolt(fromWorld: THREE.Vector3, toWorld: THREE.Vector3, color: number, scene: THREE.Scene): void {
    if (this.isReduceMotion()) return;

    const { radius, widthSegments, heightSegments, opacity } = PROJECTILE_BOLT_CONFIG;
    const geo = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
    const mat = new THREE.MeshBasicMaterial({ color, opacity, transparent: opacity < 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(fromWorld);
    mesh.renderOrder = 2;

    scene.add(mesh);

    this.entries.push({
      kind: 'bolt',
      mesh,
      geo,
      mat,
      from: fromWorld.clone(),
      to: toWorld.clone(),
      age: 0,
      scene,
    });
  }

  /**
   * Spawn a sphere that follows a parabolic arc from `fromWorld` to `toWorld`
   * over `PROJECTILE_ARC_CONFIG.lifetimeSec` seconds.
   *
   * Position interpolation:
   *   x = lerp(from.x, to.x, t)
   *   z = lerp(from.z, to.z, t)
   *   y = lerp(from.y, to.y, t) + arcApex * 4 * t * (1-t)
   *
   * The `4*t*(1-t)` factor is the standard parabola peak coefficient — it
   * equals 1.0 when t=0.5, so the shell rises exactly `arcApex` world units
   * above the linear lerp baseline at the midpoint.
   *
   * The visual is gated by the reduce-motion preference — see class doc.
   * On expiry the mesh, geometry, and material are disposed automatically.
   *
   * @param fromWorld  World-space origin (tower position, Y already includes yOffsetTower).
   * @param toWorld    World-space destination (enemy position, Y already includes yOffsetEnemy).
   * @param color      Hex colour applied to the MeshBasicMaterial (per-instance, not shared).
   * @param scene      Active Three.js scene; the mesh is added immediately.
   */
  fireArc(fromWorld: THREE.Vector3, toWorld: THREE.Vector3, color: number, scene: THREE.Scene): void {
    if (this.isReduceMotion()) return;

    const { radius, widthSegments, heightSegments, opacity } = PROJECTILE_ARC_CONFIG;
    const geo = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
    // Per-instance material so simultaneous in-flight arcs can carry distinct colors.
    const mat = new THREE.MeshBasicMaterial({ color, opacity, transparent: opacity < 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(fromWorld);
    mesh.renderOrder = 2;

    scene.add(mesh);

    this.entries.push({
      kind: 'arc',
      mesh,
      geo,
      mat,
      from: fromWorld.clone(),
      to: toWorld.clone(),
      age: 0,
      scene,
    });
  }

  /**
   * Spawn a two-phase SPLASH projectile:
   *
   * 1. **Travel phase** (0 → travelLifetimeSec): a small sphere lerps from
   *    `fromWorld` to `toWorld`, exactly like BOLT but in the SPLASH tower's
   *    color.
   * 2. **Impact phase** (travelLifetimeSec → travelLifetimeSec +
   *    impactLifetimeSec): the travel sphere is hidden; a flat ring at `toWorld`
   *    scales from 0 → `splashRadius` while opacity ramps 1 → 0, showing the
   *    AOE area that was already resolved by the sim.
   *
   * Both meshes are created at call time (ring starts `visible = false`).
   * No dynamic mesh allocation occurs during `update()` — only a visibility
   * swap on phase transition.
   *
   * The visual is gated by the reduce-motion preference — see class doc.
   * Damage is already applied by the time this method is called.
   *
   * @param fromWorld    World-space origin (tower top, Y includes yOffsetTower).
   * @param toWorld      World-space destination (primary target, Y includes yOffsetEnemy).
   * @param splashRadius World-unit AOE radius — the ring scales to this maximum.
   * @param color        Hex colour for both meshes; passed per-instance so
   *                     simultaneous in-flight splashes carry distinct colors.
   * @param scene        Active Three.js scene; both meshes are added immediately.
   */
  fireSplash(
    fromWorld: THREE.Vector3,
    toWorld: THREE.Vector3,
    splashRadius: number,
    color: number,
    scene: THREE.Scene,
  ): void {
    if (this.isReduceMotion()) return;

    const {
      travelRadius, travelSegments,
      ringInnerRatio, ringSegments,
      yOffsetImpact, travelOpacity,
    } = PROJECTILE_SPLASH_CONFIG;

    // Travel sphere — starts at fromWorld, lerps to toWorld during travel phase.
    const sphereGeo = new THREE.SphereGeometry(travelRadius, travelSegments, travelSegments);
    const sphereMat = new THREE.MeshBasicMaterial({
      color,
      opacity: travelOpacity,
      transparent: travelOpacity < 1,
    });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.position.copy(fromWorld);
    sphereMesh.renderOrder = 2;

    // Impact ring — created now, hidden until phase transition.
    // Outer radius starts at travelRadius (non-zero to avoid degenerate geometry);
    // it is rescaled during the impact phase, so initial size doesn't matter.
    const ringGeo = new THREE.RingGeometry(
      travelRadius * ringInnerRatio,
      travelRadius,
      ringSegments,
    );
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      opacity: 1,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    // Orient flat ring to lie on the XZ plane (ring geometry is in XY by default).
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(toWorld.x, yOffsetImpact, toWorld.z);
    ringMesh.renderOrder = 2;
    ringMesh.visible = false;

    scene.add(sphereMesh);
    scene.add(ringMesh);

    this.entries.push({
      kind: 'splash',
      sphereMesh,
      sphereGeo,
      sphereMat,
      ringMesh,
      ringGeo,
      ringMat,
      from: fromWorld.clone(),
      to: toWorld.clone(),
      splashRadius,
      age: 0,
      scene,
    });
  }

  /**
   * Spawn a radial pulse from the SLOW tower base to confirm the slow-aura
   * activated this turn.
   *
   * A flat ring at `centerWorld` expands from 0 to `auraRadius` world units
   * over `PROJECTILE_AURA_CONFIG.lifetimeSec` seconds while opacity ramps
   * from `opacityStart` to 0.  The ring lies on the XZ plane (rotated −90°
   * around X) at `yOffsetGround` above the ground.
   *
   * The visual is gated by the reduce-motion preference — see class doc.
   * Damage / status application is already handled by `applySlowAura` in the
   * sim path before this method is called.
   *
   * Per-instance material: simultaneous SLOW tower pulses carry distinct
   * colors (relevant when specialization recolors towers).
   *
   * @param centerWorld  World-space tower centre (X, Z used; Y replaced by yOffsetGround).
   * @param auraRadius   World-unit reach of the aura — the ring scales to this maximum.
   * @param color        Hex colour for the ring material (per-instance).
   * @param scene        Active Three.js scene; the mesh is added immediately.
   */
  fireAura(centerWorld: THREE.Vector3, auraRadius: number, color: number, scene: THREE.Scene): void {
    if (this.isReduceMotion()) return;

    const { innerRatio, ringSegments, yOffsetGround, opacityStart } = PROJECTILE_AURA_CONFIG;

    // Use auraRadius as the outer radius seed — at age 0 the ring is scaled
    // to 0 anyway, so the initial geometry size doesn't affect appearance.
    const outerSeed = auraRadius > 0 ? auraRadius : 1;
    const geo = new THREE.RingGeometry(outerSeed * innerRatio, outerSeed, ringSegments);
    const mat = new THREE.MeshBasicMaterial({
      color,
      opacity: opacityStart,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    // Orient flat ring to lie on the XZ plane (ring geometry is in XY by default).
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(centerWorld.x, yOffsetGround, centerWorld.z);
    // Start scaled to zero — update() scales up from here.
    mesh.scale.setScalar(0);
    mesh.renderOrder = 2;

    scene.add(mesh);

    this.entries.push({ kind: 'aura', mesh, geo, mat, age: 0, radius: auraRadius, scene });
  }

  /**
   * Advance all in-flight visuals by `deltaTime` seconds.
   * Expired entries are removed from the scene and their GPU resources
   * are disposed.  Call once per animation frame.
   */
  update(deltaTime: number): void {
    const {
      lifetimeSec: hitscanLifetime,
      fadeInSec,
      fadeOutSec,
    } = PROJECTILE_HITSCAN_CONFIG;
    const { lifetimeSec: boltLifetime } = PROJECTILE_BOLT_CONFIG;
    const { lifetimeSec: arcLifetime, arcApex } = PROJECTILE_ARC_CONFIG;
    const { travelLifetimeSec, impactLifetimeSec } = PROJECTILE_SPLASH_CONFIG;
    const splashTotalLifetime = travelLifetimeSec + impactLifetimeSec;
    const { lifetimeSec: auraLifetime, opacityStart } = PROJECTILE_AURA_CONFIG;

    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      entry.age += deltaTime;

      if (entry.kind === 'hitscan') {
        if (entry.age >= hitscanLifetime) {
          this.disposeHitscanEntry(entry);
          this.entries.splice(i, 1);
          continue;
        }

        // Opacity ramp: 0→1 during fadeInSec, hold, then 1→0 during fadeOutSec.
        const fadeOutStart = hitscanLifetime - fadeOutSec;
        let opacity: number;
        if (entry.age < fadeInSec) {
          opacity = entry.age / fadeInSec;
        } else if (entry.age >= fadeOutStart) {
          opacity = 1 - (entry.age - fadeOutStart) / fadeOutSec;
        } else {
          opacity = 1;
        }
        entry.mat.opacity = Math.max(0, Math.min(1, opacity));
      } else if (entry.kind === 'bolt') {
        if (entry.age >= boltLifetime) {
          this.disposeBoltEntry(entry);
          this.entries.splice(i, 1);
          continue;
        }

        // Linear interpolation: position = from + (to - from) * (age / lifetime).
        const t = entry.age / boltLifetime;
        entry.mesh.position.lerpVectors(entry.from, entry.to, t);
      } else if (entry.kind === 'arc') {
        if (entry.age >= arcLifetime) {
          this.disposeArcEntry(entry);
          this.entries.splice(i, 1);
          continue;
        }

        // Parabolic interpolation:
        //   x/z follow linear lerp.
        //   y = lerp(from.y, to.y, t) + arcApex * 4*t*(1-t)
        // The 4*t*(1-t) factor is the standard parabola peak coefficient —
        // equals 1.0 at t=0.5, giving a peak of exactly arcApex above the
        // linear baseline at the shell's midpoint.
        const t = entry.age / arcLifetime;
        entry.mesh.position.x = entry.from.x + (entry.to.x - entry.from.x) * t;
        entry.mesh.position.z = entry.from.z + (entry.to.z - entry.from.z) * t;
        const linearY = entry.from.y + (entry.to.y - entry.from.y) * t;
        entry.mesh.position.y = linearY + arcApex * 4 * t * (1 - t);
      } else if (entry.kind === 'splash') {
        if (entry.age >= splashTotalLifetime) {
          this.disposeSplashEntry(entry);
          this.entries.splice(i, 1);
          continue;
        }

        if (entry.age < travelLifetimeSec) {
          // Travel phase: sphere lerps from → to; ring stays hidden.
          const t = entry.age / travelLifetimeSec;
          entry.sphereMesh.position.lerpVectors(entry.from, entry.to, t);
        } else {
          // Impact phase: hide sphere, show + animate ring.
          entry.sphereMesh.visible = false;
          entry.ringMesh.visible = true;

          // Progress within the impact phase: 0 at phase start, 1 at phase end.
          const impactAge = entry.age - travelLifetimeSec;
          const p = impactAge / impactLifetimeSec;

          // Scale ring from 0 → splashRadius.
          const scale = entry.splashRadius * p;
          entry.ringMesh.scale.setScalar(scale);

          // Opacity ramps 1 → 0 as ring expands.
          entry.ringMat.opacity = Math.max(0, 1 - p);
        }
      } else {
        // kind === 'aura'
        if (entry.age >= auraLifetime) {
          this.disposeAuraEntry(entry);
          this.entries.splice(i, 1);
          continue;
        }

        // t = 0 at spawn, t = 1 at expiry.
        const t = entry.age / auraLifetime;

        // Scale ring from 0 → auraRadius.
        entry.mesh.scale.setScalar(t * entry.radius);

        // Opacity ramps opacityStart → 0 linearly.
        entry.mat.opacity = Math.max(0, opacityStart * (1 - t));
      }
    }
  }

  /**
   * Dispose all in-flight visuals and remove them from their scenes.
   * Idempotent — safe to call multiple times or before any visuals exist.
   * Also accepts an optional `scene` parameter (unused; kept for API
   * symmetry with other visual services that need an explicit scene ref).
   */
  cleanup(_scene?: THREE.Scene): void {
    for (const entry of this.entries) {
      if (entry.kind === 'hitscan') {
        this.disposeHitscanEntry(entry);
      } else if (entry.kind === 'bolt') {
        this.disposeBoltEntry(entry);
      } else if (entry.kind === 'arc') {
        this.disposeArcEntry(entry);
      } else if (entry.kind === 'splash') {
        this.disposeSplashEntry(entry);
      } else {
        this.disposeAuraEntry(entry);
      }
    }
    this.entries.length = 0;
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

  /** Remove the hitscan line from its scene and free all GPU resources. */
  private disposeHitscanEntry(entry: HitscanEntry): void {
    entry.scene.remove(entry.line);
    entry.geo.dispose();
    entry.mat.dispose();
  }

  /** Remove the bolt mesh from its scene and free all GPU resources. */
  private disposeBoltEntry(entry: BoltEntry): void {
    entry.scene.remove(entry.mesh);
    entry.geo.dispose();
    entry.mat.dispose();
  }

  /** Remove the arc mesh from its scene and free all GPU resources. */
  private disposeArcEntry(entry: ArcEntry): void {
    entry.scene.remove(entry.mesh);
    entry.geo.dispose();
    entry.mat.dispose();
  }

  /** Remove both splash meshes from the scene and free all GPU resources. */
  private disposeSplashEntry(entry: SplashEntry): void {
    entry.scene.remove(entry.sphereMesh);
    entry.scene.remove(entry.ringMesh);
    entry.sphereGeo.dispose();
    entry.sphereMat.dispose();
    entry.ringGeo.dispose();
    entry.ringMat.dispose();
  }

  /** Remove the aura ring mesh from its scene and free all GPU resources. */
  private disposeAuraEntry(entry: AuraEntry): void {
    entry.scene.remove(entry.mesh);
    entry.geo.dispose();
    entry.mat.dispose();
  }
}

// ── Internal types ────────────────────────────────────────────────────────

/** One in-flight hitscan visual. */
interface HitscanEntry {
  readonly kind: 'hitscan';
  readonly line: THREE.Line;
  readonly geo: THREE.BufferGeometry;
  readonly mat: THREE.LineBasicMaterial;
  /** Seconds elapsed since spawn. */
  age: number;
  /** Scene the line was added to — needed for safe removal. */
  readonly scene: THREE.Scene;
}

/** One in-flight bolt visual. */
interface BoltEntry {
  readonly kind: 'bolt';
  readonly mesh: THREE.Mesh;
  readonly geo: THREE.SphereGeometry;
  readonly mat: THREE.MeshBasicMaterial;
  /** Fixed world-space spawn position. */
  readonly from: THREE.Vector3;
  /** Fixed world-space destination position. */
  readonly to: THREE.Vector3;
  /** Seconds elapsed since spawn. */
  age: number;
  /** Scene the mesh was added to — needed for safe removal. */
  readonly scene: THREE.Scene;
}

/** One in-flight arc (parabolic shell) visual — used by MORTAR. */
interface ArcEntry {
  readonly kind: 'arc';
  readonly mesh: THREE.Mesh;
  readonly geo: THREE.SphereGeometry;
  readonly mat: THREE.MeshBasicMaterial;
  /** Fixed world-space spawn position. */
  readonly from: THREE.Vector3;
  /** Fixed world-space destination position. */
  readonly to: THREE.Vector3;
  /** Seconds elapsed since spawn. */
  age: number;
  /** Scene the mesh was added to — needed for safe removal. */
  readonly scene: THREE.Scene;
}

/**
 * One in-flight splash visual — used by the SPLASH tower.
 *
 * Contains two meshes (sphere + ring) created at fire-time.  The ring starts
 * invisible and becomes visible on phase transition (age >= travelLifetimeSec).
 * update() controls the visibility swap and ring scale/opacity; no dynamic
 * mesh allocation occurs mid-flight.
 */
interface SplashEntry {
  readonly kind: 'splash';
  /** Travel phase sphere. */
  readonly sphereMesh: THREE.Mesh;
  readonly sphereGeo: THREE.SphereGeometry;
  readonly sphereMat: THREE.MeshBasicMaterial;
  /** Impact phase ring. */
  readonly ringMesh: THREE.Mesh;
  readonly ringGeo: THREE.RingGeometry;
  readonly ringMat: THREE.MeshBasicMaterial;
  /** Fixed world-space spawn position (tower top). */
  readonly from: THREE.Vector3;
  /** Fixed world-space destination position (primary target). */
  readonly to: THREE.Vector3;
  /** AOE radius in world units — the ring scales to this maximum at end of impact phase. */
  readonly splashRadius: number;
  /** Seconds elapsed since spawn. */
  age: number;
  /** Scene both meshes were added to — needed for safe removal. */
  readonly scene: THREE.Scene;
}

/**
 * One in-flight aura pulse — used by the SLOW tower.
 *
 * A flat ring starts at scale 0 (invisible at spawn) and expands to
 * `radius` world units over `PROJECTILE_AURA_CONFIG.lifetimeSec` seconds
 * while opacity ramps from `opacityStart` to 0.  Single mesh, single phase.
 */
interface AuraEntry {
  readonly kind: 'aura';
  /** Ring mesh — scale and opacity animated by update(). */
  readonly mesh: THREE.Mesh;
  readonly geo: THREE.RingGeometry;
  readonly mat: THREE.MeshBasicMaterial;
  /** World-unit maximum radius the ring reaches at end of lifetime. */
  readonly radius: number;
  /** Seconds elapsed since spawn. */
  age: number;
  /** Scene the mesh was added to — needed for safe removal. */
  readonly scene: THREE.Scene;
}

/** Discriminated union of all in-flight projectile entry kinds. */
type ProjectileEntry = HitscanEntry | BoltEntry | ArcEntry | SplashEntry | AuraEntry;
