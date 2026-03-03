import * as THREE from 'three';

/** Dispose a Three.js material, handling both single Material and Material[] forms. */
export function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach(m => m.dispose());
  } else {
    material.dispose();
  }
}
