import { Injectable } from '@angular/core';
import * as THREE from 'three';

import { MutationOp } from './path-mutation.types';
import { ELEVATION_CONFIG } from '../constants/elevation.constants';

/**
 * Color definitions for each mutation operation.
 * All channels are in three.js hex format (0xRRGGBB).
 *
 * Design intent:
 *  - build      → teal-green: "player-built path"
 *  - block      → amber:      "temporary barrier"
 *  - destroy    → ember red:  "permanent rubble"
 *  - bridgehead → violet:     "tower-only platform"
 */
const TERRAFORM_COLORS: Readonly<
  Record<MutationOp, { color: number; emissive: number; emissiveIntensity: number }>
> = {
  build: {
    color: 0x3fd18a,
    emissive: 0x2a8a5a,
    emissiveIntensity: 0.35,
  },
  block: {
    color: 0xe8a033,
    emissive: 0x6a4810,
    emissiveIntensity: 0.30,
  },
  destroy: {
    color: 0x8a2f1f,
    emissive: 0x2a0a05,
    emissiveIntensity: 0.20,
  },
  bridgehead: {
    color: 0x7c4dff,
    emissive: 0x3a2470,
    emissiveIntensity: 0.30,
  },
};

/**
 * Shared material pool for terraformed tiles.
 *
 * Scoping: component-scoped (@Injectable() only, NOT providedIn: 'root').
 * Registered in GameModule providers alongside PathMutationService.
 *
 * Rationale: giving every mutated tile its own material would cause a memory
 * blowup and a disposal storm at encounter teardown. Instead, this service
 * maintains exactly 4 materials (one per MutationOp) that are lazily created
 * on first access and disposed as a single batch via dispose().
 *
 * Disposal contract:
 *   - Pool materials MUST NOT be disposed when individual meshes swap.
 *     PathMutationService.swapMesh() uses isPoolMaterial() to guard disposal.
 *   - Pool materials ARE disposed exactly once — by dispose() — which is called
 *     by GameSessionService.cleanupScene() at encounter teardown, AFTER
 *     pathMutationService.reset().
 */
@Injectable()
export class TerraformMaterialPoolService {
  private readonly pool = new Map<MutationOp, THREE.MeshStandardMaterial>();

  /**
   * Shared material for cliff column meshes placed under raised tiles (sprint 39).
   * Lazily created on first access; disposed by dispose() at encounter teardown.
   * The pool owns this material — cliff meshes must NOT dispose it individually.
   */
  private cliffMaterial: THREE.MeshStandardMaterial | null = null;

  /**
   * Return the shared material for the given mutation op.
   * Lazily creates the material on first access; subsequent calls return the
   * same instance (identity equality guaranteed).
   */
  getMaterial(op: MutationOp): THREE.MeshStandardMaterial {
    let mat = this.pool.get(op);
    if (!mat) {
      const cfg = TERRAFORM_COLORS[op];
      mat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        emissive: cfg.emissive,
        emissiveIntensity: cfg.emissiveIntensity,
        metalness: 0.2,
        roughness: 0.6,
      });
      this.pool.set(op, mat);
    }
    return mat;
  }

  /**
   * Return the shared cliff material (stone-gray, sprint 39).
   * Lazily created on first access. Cliff meshes share this material
   * and must NOT dispose it — pool owns the lifecycle via dispose().
   */
  getCliffMaterial(): THREE.MeshStandardMaterial {
    if (!this.cliffMaterial) {
      this.cliffMaterial = new THREE.MeshStandardMaterial({
        color: ELEVATION_CONFIG.CLIFF_MATERIAL_COLOR,
        metalness: 0.1,
        roughness: 0.85,
      });
    }
    return this.cliffMaterial;
  }

  /**
   * Returns true if `material` is one of the pooled instances.
   * Used by PathMutationService.swapMesh() and GameSessionService.cleanupScene()
   * to guard against disposing a shared material when replacing a single mesh.
   */
  isPoolMaterial(material: THREE.Material): boolean {
    if (material === this.cliffMaterial) return true;
    return Array.from(this.pool.values()).includes(
      material as THREE.MeshStandardMaterial,
    );
  }

  /**
   * Dispose all pooled materials and reset the cache.
   * Called once by GameSessionService.cleanupScene() at encounter teardown.
   * After this call, the next getMaterial() / getCliffMaterial() returns a fresh instance.
   */
  dispose(): void {
    this.pool.forEach(mat => mat.dispose());
    this.pool.clear();
    this.cliffMaterial?.dispose();
    this.cliffMaterial = null;
  }
}
