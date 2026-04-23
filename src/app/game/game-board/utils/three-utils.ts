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
 * Traverse a Group (or any Object3D), dispose every Mesh descendant's
 * geometry and material(s), and optionally remove the root from the scene.
 *
 * Centralises the "traverse + disposeMesh" pattern used inline across
 * enemy.service, tower-combat.service, and enemy-health.service.
 */
export function disposeGroup(group: THREE.Object3D, scene?: THREE.Scene): void {
  if (scene) {
    scene.remove(group);
  }
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      disposeMesh(child);
    }
  });
}
