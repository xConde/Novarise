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
