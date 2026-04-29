import * as THREE from 'three';

/** Dispose a Three.js material, handling both single Material and Material[] forms. */
export function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach(m => m.dispose());
  } else {
    material.dispose();
  }
}

/** Dispose a Three.js Mesh's geometry and material in one call. */
export function disposeMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  disposeMaterial(mesh.material);
}

/**
 * Return the material(s) of a Mesh as a flat array.
 * Handles both the single-Material and Material[] forms.
 */
export function getMaterials(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/**
 * Clamp a device pixel ratio to a maximum cap.
 *
 * On 3× retina displays an uncapped ratio triples post-processing fill rate
 * with no perceptible quality gain past 2×. Centralised here so initRenderer
 * and resize handlers share one source of truth.
 */
export function clampPixelRatio(devicePixelRatio: number, max: number): number {
  return Math.min(devicePixelRatio, max);
}

export interface RendererPolicy {
  maxPixelRatio: number;
  toneMappingExposure: number;
  shadowMapType: THREE.ShadowMapType;
  toneMapping: THREE.ToneMapping;
  outputColorSpace: THREE.ColorSpace;
  localClippingEnabled: boolean;
}

/**
 * Apply the standard Novarise renderer policy to a WebGLRenderer.
 *
 * Extracted from initRenderer so the policy is verifiable without
 * instantiating a real WebGL context (headless Chrome has no WebGL).
 */
export function applyRendererPolicy(
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
  devicePixelRatio: number,
  policy: RendererPolicy
): void {
  renderer.setPixelRatio(clampPixelRatio(devicePixelRatio, policy.maxPixelRatio));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = policy.shadowMapType;
  renderer.localClippingEnabled = policy.localClippingEnabled;
  renderer.toneMapping = policy.toneMapping;
  renderer.toneMappingExposure = policy.toneMappingExposure;
  renderer.outputColorSpace = policy.outputColorSpace;
}

export interface DisposeProtect {
  /** Geometries owned by a registry — must NOT be disposed by traversal. */
  isGeometry?: (g: THREE.BufferGeometry) => boolean;
  /** Materials owned by a pool — must NOT be disposed by traversal. */
  isMaterial?: (m: THREE.Material) => boolean;
}

/**
 * Traverse a Group (or any Object3D), dispose every Mesh and Line descendant's
 * geometry and material(s), and optionally remove the root from the scene.
 *
 * Mesh and Line share the same `geometry` + `material: Material | Material[]`
 * shape, so disposal is identical. Including Line lets callers like the
 * grid-lines cleanup path drop their inline traversal.
 *
 * Tracks unique geometries and materials per call to prevent double-dispose
 * when a group contains children that share a resource (e.g. grid lines
 * sharing one LineBasicMaterial, or tower meshes sharing one
 * MeshStandardMaterial across 4-7 child Meshes). Three.js silently no-ops
 * repeat dispose() today, but it's UB and may break under stricter
 * refcounting in future versions.
 *
 * Optional `protect` predicate(s) skip resources owned by a registry/pool
 * so single-mesh disposal does not break a shared cache. Used by tile
 * disposal once GeometryRegistry + MaterialRegistry land.
 */
export function disposeGroup(
  group: THREE.Object3D,
  scene?: THREE.Scene,
  protect?: DisposeProtect,
): void {
  if (scene) {
    scene.remove(group);
  }
  const seenGeometries = new Set<THREE.BufferGeometry>();
  const seenMaterials = new Set<THREE.Material>();
  group.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      if (!seenGeometries.has(child.geometry)) {
        seenGeometries.add(child.geometry);
        if (!protect?.isGeometry?.(child.geometry)) {
          child.geometry.dispose();
        }
      }
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (!seenMaterials.has(m)) {
          seenMaterials.add(m);
          if (!protect?.isMaterial?.(m)) {
            m.dispose();
          }
        }
      }
    }
  });
}
