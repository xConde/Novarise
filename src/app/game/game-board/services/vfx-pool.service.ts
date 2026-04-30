import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';
import { MaterialRegistryService } from './material-registry.service';
import { GeometryRegistryService } from './geometry-registry.service';

interface PooledArc {
  line: THREE.Line;
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  /** Vertex count baked into the BufferAttribute on construction. */
  vertexCount: number;
}

interface PooledZone {
  mesh: THREE.Mesh;
}

/**
 * Pool for combat-VFX visual primitives:
 *   - Chain lightning arcs (THREE.Line + BufferGeometry + Float32Array)
 *   - Mortar blast zone meshes (THREE.Mesh wrapping a registry-shared
 *     CircleGeometry + MaterialRegistry-shared MeshBasicMaterial)
 *
 * Scoping: component-scoped (@Injectable() only, NOT providedIn: 'root').
 * Registered alongside other registries in GameBoardComponent.providers.
 *
 * Why pool:
 *   - LineBasicMaterial / MeshBasicMaterial allocations carry a shader
 *     program — repeated allocation drops onto the GC and triggers
 *     shader compilation churn. Material registry caches one per color.
 *   - BufferGeometry + Float32Array allocations are cheap individually
 *     but pile up under heavy combat. Pool keeps a ring of Line objects
 *     ready to reuse; geometry positions overwrite in place.
 *   - Mortar zone meshes pool the THREE.Mesh wrapper; geometry comes
 *     from the GeometryRegistry per-radius cache.
 *
 * Disposal: dispose() releases all active visuals, disposes pooled
 * BufferGeometries (chain arc only — mortar geometries are owned by
 * GeometryRegistry). Materials are owned by MaterialRegistry. Called
 * by GameSessionService.cleanupScene() at encounter teardown.
 */
@Injectable()
export class VfxPoolService {
  private readonly freeArcs: PooledArc[] = [];
  private readonly activeArcs = new Set<PooledArc>();

  private readonly freeZones: PooledZone[] = [];
  private readonly activeZones = new Set<PooledZone>();

  constructor(
    @Optional() private readonly materialRegistry?: MaterialRegistryService,
    @Optional() private readonly geometryRegistry?: GeometryRegistryService,
  ) {}

  // ── Chain arcs ──────────────────────────────────────────────────────────

  /**
   * Acquire a Line ready to render a `vertexCount`-vertex chain arc with
   * the given material color. Caller writes positions into `positions` and
   * calls `markPositionsDirty()` after.
   */
  acquireArc(
    vertexCount: number,
    color: number,
    opacity: number,
  ): { line: THREE.Line; positions: Float32Array; markPositionsDirty: () => void } {
    let pooled = this.findFreeArc(vertexCount);
    if (!pooled) {
      const positions = new Float32Array(vertexCount * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = this.getOrCreateLineMaterial(color, opacity);
      const line = new THREE.Line(geometry, material);
      pooled = { line, geometry, positions, vertexCount };
    } else {
      // Recycled — swap material to the requested color/opacity.
      pooled.line.material = this.getOrCreateLineMaterial(color, opacity);
    }
    this.activeArcs.add(pooled);
    return {
      line: pooled.line,
      positions: pooled.positions,
      markPositionsDirty: () => {
        const attr = pooled!.geometry.getAttribute('position') as THREE.BufferAttribute;
        attr.needsUpdate = true;
      },
    };
  }

  releaseArc(line: THREE.Line): void {
    let target: PooledArc | undefined;
    for (const a of this.activeArcs) {
      if (a.line === line) {
        target = a;
        break;
      }
    }
    if (!target) return;
    if (line.parent) line.parent.remove(line);
    this.activeArcs.delete(target);
    this.freeArcs.push(target);
  }

  // ── Mortar zone meshes ──────────────────────────────────────────────────

  /**
   * Acquire a Mesh for a mortar blast zone with the given radius / segments.
   * Geometry is registry-shared (one per radius). Material is shared per
   * (color, opacity) pair via MaterialRegistry.
   */
  acquireZone(
    radius: number,
    segments: number,
    color: number,
    opacity: number,
  ): THREE.Mesh {
    const geometry = this.geometryRegistry?.getCircle(radius, segments)
      ?? new THREE.CircleGeometry(radius, segments);
    const material = this.getOrCreateZoneMaterial(color, opacity);

    let pooled = this.freeZones.pop();
    if (!pooled) {
      pooled = { mesh: new THREE.Mesh(geometry, material) };
    } else {
      pooled.mesh.geometry = geometry;
      pooled.mesh.material = material;
    }
    pooled.mesh.rotation.set(0, 0, 0);
    pooled.mesh.position.set(0, 0, 0);
    pooled.mesh.scale.set(1, 1, 1);
    this.activeZones.add(pooled);
    return pooled.mesh;
  }

  releaseZone(mesh: THREE.Mesh): void {
    let target: PooledZone | undefined;
    for (const z of this.activeZones) {
      if (z.mesh === mesh) {
        target = z;
        break;
      }
    }
    if (!target) return;
    if (mesh.parent) mesh.parent.remove(mesh);
    this.activeZones.delete(target);
    this.freeZones.push(target);
  }

  // ── Instrumentation ─────────────────────────────────────────────────────

  arcActiveCount(): number { return this.activeArcs.size; }
  arcFreeCount(): number { return this.freeArcs.length; }
  zoneActiveCount(): number { return this.activeZones.size; }
  zoneFreeCount(): number { return this.freeZones.length; }

  /**
   * Release every active visual, dispose every pooled BufferGeometry on
   * arcs (mortar geometries are registry-owned). Materials are
   * registry-owned and disposed by MaterialRegistry.dispose().
   */
  dispose(): void {
    for (const a of this.activeArcs) {
      if (a.line.parent) a.line.parent.remove(a.line);
      a.geometry.dispose();
    }
    this.activeArcs.clear();
    for (const a of this.freeArcs) {
      a.geometry.dispose();
    }
    this.freeArcs.length = 0;

    for (const z of this.activeZones) {
      if (z.mesh.parent) z.mesh.parent.remove(z.mesh);
    }
    this.activeZones.clear();
    this.freeZones.length = 0;
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private findFreeArc(vertexCount: number): PooledArc | undefined {
    // Free pool is rarely deep; linear scan is fine. Match by vertex count
    // to avoid resizing the BufferAttribute (Three.js doesn't support that
    // cleanly).
    for (let i = this.freeArcs.length - 1; i >= 0; i--) {
      if (this.freeArcs[i].vertexCount === vertexCount) {
        return this.freeArcs.splice(i, 1)[0];
      }
    }
    return undefined;
  }

  private getOrCreateLineMaterial(color: number, opacity: number): THREE.LineBasicMaterial {
    const key = `effect:line:${color.toString(16)}:${opacity.toFixed(2)}`;
    if (this.materialRegistry) {
      return this.materialRegistry.getOrCreate(key, () => new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
      }));
    }
    return new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  }

  private getOrCreateZoneMaterial(color: number, opacity: number): THREE.MeshBasicMaterial {
    const key = `effect:zone:${color.toString(16)}:${opacity.toFixed(2)}`;
    if (this.materialRegistry) {
      return this.materialRegistry.getOrCreate(key, () => new THREE.MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        side: THREE.DoubleSide,
      }));
    }
    return new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide,
    });
  }
}
