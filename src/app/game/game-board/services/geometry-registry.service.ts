import { Injectable } from '@angular/core';
import * as THREE from 'three';

/**
 * Shared geometry cache.
 *
 * Scoping: component-scoped (@Injectable() only, NOT providedIn: 'root').
 * Registered alongside TerraformMaterialPoolService in
 * GameBoardComponent.providers.
 *
 * Rationale: tile/tower/enemy meshes were each allocating their own
 * BufferGeometry instances. A 24×19 board produces ~456 identical
 * BoxGeometry allocations for tiles alone. This registry returns the
 * SAME instance for identical params, so consumers share GPU vertex
 * buffers.
 *
 * Disposal contract:
 *   - Cached geometries MUST NOT be disposed by consumers — disposeGroup
 *     and other paths that call .dispose() on a registry geometry will
 *     break the cache.
 *   - Cached geometries are disposed exactly once via dispose(), called
 *     by GameSessionService.cleanupScene() at encounter teardown.
 *   - isRegisteredGeometry(geom) lets disposal paths skip registry
 *     instances (mirrors TerraformMaterialPoolService.isPoolMaterial).
 *
 * Float-precision keys: numeric params are quantised via toFixed(4) so
 * (1.5, 1, 1) and (1.5000001, 1, 1) collapse to one cache entry.
 */
@Injectable()
export class GeometryRegistryService {
  private readonly cache = new Map<string, THREE.BufferGeometry>();

  getBox(width: number, height: number, depth: number): THREE.BoxGeometry {
    return this.getOrCreate(
      this.key('box', width, height, depth),
      () => new THREE.BoxGeometry(width, height, depth),
    ) as THREE.BoxGeometry;
  }

  getSphere(
    radius: number,
    widthSegments: number,
    heightSegments: number,
  ): THREE.SphereGeometry {
    return this.getOrCreate(
      this.key('sphere', radius, widthSegments, heightSegments),
      () => new THREE.SphereGeometry(radius, widthSegments, heightSegments),
    ) as THREE.SphereGeometry;
  }

  getCylinder(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    radialSegments: number,
  ): THREE.CylinderGeometry {
    return this.getOrCreate(
      this.key('cyl', radiusTop, radiusBottom, height, radialSegments),
      () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
    ) as THREE.CylinderGeometry;
  }

  getCone(radius: number, height: number, radialSegments: number): THREE.ConeGeometry {
    return this.getOrCreate(
      this.key('cone', radius, height, radialSegments),
      () => new THREE.ConeGeometry(radius, height, radialSegments),
    ) as THREE.ConeGeometry;
  }

  getOctahedron(radius: number, detail = 0): THREE.OctahedronGeometry {
    return this.getOrCreate(
      this.key('oct', radius, detail),
      () => new THREE.OctahedronGeometry(radius, detail),
    ) as THREE.OctahedronGeometry;
  }

  getDodecahedron(radius: number, detail = 0): THREE.DodecahedronGeometry {
    return this.getOrCreate(
      this.key('dod', radius, detail),
      () => new THREE.DodecahedronGeometry(radius, detail),
    ) as THREE.DodecahedronGeometry;
  }

  getIcosahedron(radius: number, detail = 0): THREE.IcosahedronGeometry {
    return this.getOrCreate(
      this.key('ico', radius, detail),
      () => new THREE.IcosahedronGeometry(radius, detail),
    ) as THREE.IcosahedronGeometry;
  }

  getTetrahedron(radius: number, detail = 0): THREE.TetrahedronGeometry {
    return this.getOrCreate(
      this.key('tet', radius, detail),
      () => new THREE.TetrahedronGeometry(radius, detail),
    ) as THREE.TetrahedronGeometry;
  }

  getTorus(
    radius: number,
    tube: number,
    radialSegments: number,
    tubularSegments: number,
  ): THREE.TorusGeometry {
    return this.getOrCreate(
      this.key('torus', radius, tube, radialSegments, tubularSegments),
      () => new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments),
    ) as THREE.TorusGeometry;
  }

  getPlane(width: number, height: number): THREE.PlaneGeometry {
    return this.getOrCreate(
      this.key('plane', width, height),
      () => new THREE.PlaneGeometry(width, height),
    ) as THREE.PlaneGeometry;
  }

  getCircle(radius: number, segments: number): THREE.CircleGeometry {
    return this.getOrCreate(
      this.key('circ', radius, segments),
      () => new THREE.CircleGeometry(radius, segments),
    ) as THREE.CircleGeometry;
  }

  /**
   * Returns true if `geom` is owned by this registry.
   * Disposal paths (disposeGroup, swapMesh) should skip these to avoid
   * breaking the cache.
   */
  isRegisteredGeometry(geom: THREE.BufferGeometry): boolean {
    for (const cached of this.cache.values()) {
      if (cached === geom) return true;
    }
    return false;
  }

  /** Returns the number of cached entries (for instrumentation/tests). */
  size(): number {
    return this.cache.size;
  }

  /**
   * Dispose every cached geometry and clear the cache.
   * Called once by GameSessionService.cleanupScene() at encounter teardown.
   * Subsequent get*() calls allocate fresh instances.
   */
  dispose(): void {
    this.cache.forEach(g => g.dispose());
    this.cache.clear();
  }

  private getOrCreate(
    key: string,
    factory: () => THREE.BufferGeometry,
  ): THREE.BufferGeometry {
    let geom = this.cache.get(key);
    if (!geom) {
      geom = factory();
      this.cache.set(key, geom);
    }
    return geom;
  }

  private key(tag: string, ...params: number[]): string {
    return `${tag}:${params.map(p => p.toFixed(4)).join(',')}`;
  }
}
