import * as THREE from 'three';
import { disposeMaterial, disposeMesh } from './three-utils';

describe('disposeMaterial', () => {
  it('calls dispose on a single Material', () => {
    const material = new THREE.MeshBasicMaterial();
    spyOn(material, 'dispose');
    disposeMaterial(material);
    expect(material.dispose).toHaveBeenCalledTimes(1);
  });

  it('calls dispose on each material in a Material array', () => {
    const m1 = new THREE.MeshBasicMaterial();
    const m2 = new THREE.MeshBasicMaterial();
    spyOn(m1, 'dispose');
    spyOn(m2, 'dispose');
    disposeMaterial([m1, m2]);
    expect(m1.dispose).toHaveBeenCalledTimes(1);
    expect(m2.dispose).toHaveBeenCalledTimes(1);
  });

  it('handles an empty Material array without throwing', () => {
    expect(() => disposeMaterial([])).not.toThrow();
  });

  afterEach(() => {
    // No Three.js GPU objects to clean up — Materials created above are disposed by the calls under test
  });
});

describe('disposeMesh', () => {
  let geometry: THREE.BoxGeometry;
  let material: THREE.MeshBasicMaterial;
  let mesh: THREE.Mesh;

  beforeEach(() => {
    geometry = new THREE.BoxGeometry(1, 1, 1);
    material = new THREE.MeshBasicMaterial();
    mesh = new THREE.Mesh(geometry, material);
  });

  afterEach(() => {
    // Dispose if not already disposed by test
    try { geometry.dispose(); } catch { /* already disposed */ }
    try { material.dispose(); } catch { /* already disposed */ }
  });

  it('disposes the geometry', () => {
    spyOn(geometry, 'dispose');
    disposeMesh(mesh);
    expect(geometry.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes a single material', () => {
    spyOn(material, 'dispose');
    disposeMesh(mesh);
    expect(material.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes each material in a Material array', () => {
    const m1 = new THREE.MeshBasicMaterial();
    const m2 = new THREE.MeshBasicMaterial();
    spyOn(m1, 'dispose');
    spyOn(m2, 'dispose');
    mesh.material = [m1, m2];
    spyOn(geometry, 'dispose');
    disposeMesh(mesh);
    expect(geometry.dispose).toHaveBeenCalledTimes(1);
    expect(m1.dispose).toHaveBeenCalledTimes(1);
    expect(m2.dispose).toHaveBeenCalledTimes(1);
    m1.dispose();
    m2.dispose();
  });
});
