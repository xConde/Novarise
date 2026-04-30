import { Injectable } from '@angular/core';
import * as THREE from 'three';

/**
 * Shared material cache.
 *
 * Scoping: component-scoped (@Injectable() only, NOT providedIn: 'root').
 * Registered alongside GeometryRegistry + TerraformMaterialPoolService in
 * GameBoardComponent.providers.
 *
 * Rationale: tile, tower, and enemy meshes each allocated fresh
 * MeshStandardMaterial instances per consumer. A 24×19 board allocates
 * up to 456 identical tile materials; every enemy spawn allocates a
 * fresh enemy material; every tower placement allocates a fresh tower
 * material. This registry returns the SAME instance for a given key so
 * consumers share GPU shader programs and uniform state.
 *
 * Generic API: `getOrCreate(key, factory)` lets factory services keep
 * their material configuration inline (per-type colors, emissive,
 * roughness, etc.) and only swap allocation through the registry.
 *
 * Disposal contract:
 *   - Cached materials MUST NOT be disposed by consumers — disposeGroup
 *     and other paths that call .dispose() on a registry material will
 *     break the cache.
 *   - Cached materials are disposed exactly once via dispose(), called
 *     by GameSessionService.cleanupScene() at encounter teardown.
 *   - isRegisteredMaterial(mat) lets disposal paths skip registry
 *     instances (mirrors TerraformMaterialPoolService.isPoolMaterial).
 */
@Injectable()
export class MaterialRegistryService {
  private readonly cache = new Map<string, THREE.Material>();

  /**
   * Return the cached material for `key`, lazily invoking `factory` on
   * first access. Subsequent calls return the same instance (identity
   * equality guaranteed).
   *
   * Conventions for keys (no enforcement, just consistency):
   *   - `tile:<BlockType>` — per BlockType tile material
   *   - `tower:<TowerType>` — per TowerType tower material
   *   - `enemy:<EnemyType>` — per EnemyType enemy material
   *   - `enemy:<EnemyType>:hpBg|hpFg|shieldBg|shieldFg` — health-bar plane materials
   *   - `effect:<descriptive-name>` — one-offs
   */
  getOrCreate<T extends THREE.Material>(key: string, factory: () => T): T {
    let mat = this.cache.get(key);
    if (!mat) {
      mat = factory();
      this.cache.set(key, mat);
    }
    return mat as T;
  }

  /**
   * Returns true if `mat` is owned by this registry.
   * Disposal paths (disposeGroup, single-mesh removal) should skip these
   * to avoid breaking the cache.
   */
  isRegisteredMaterial(mat: THREE.Material): boolean {
    for (const cached of this.cache.values()) {
      if (cached === mat) return true;
    }
    return false;
  }

  /** Returns the number of cached entries (for instrumentation/tests). */
  size(): number {
    return this.cache.size;
  }

  /**
   * Dispose every cached material and clear the cache.
   * Called once by GameSessionService.cleanupScene() at encounter teardown.
   * Subsequent getOrCreate() calls allocate fresh instances.
   */
  dispose(): void {
    this.cache.forEach(m => m.dispose());
    this.cache.clear();
  }
}
