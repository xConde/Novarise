import * as THREE from 'three';
import { disposeMaterial } from './three-utils';

describe('disposeMaterial', () => {
  let materialsToCleanup: THREE.Material[];

  beforeEach(() => {
    materialsToCleanup = [];
  });

  afterEach(() => {
    materialsToCleanup.forEach(m => m.dispose());
    materialsToCleanup = [];
  });

  function track<T extends THREE.Material>(material: T): T {
    materialsToCleanup.push(material);
    return material;
  }

  // --- Single Material ---

  it('should dispose a single MeshBasicMaterial', () => {
    const material = track(new THREE.MeshBasicMaterial());
    spyOn(material, 'dispose').and.callThrough();

    disposeMaterial(material);

    expect(material.dispose).toHaveBeenCalledTimes(1);
  });

  it('should dispose a single MeshStandardMaterial', () => {
    const material = track(new THREE.MeshStandardMaterial());
    spyOn(material, 'dispose').and.callThrough();

    disposeMaterial(material);

    expect(material.dispose).toHaveBeenCalledTimes(1);
  });

  it('should dispose a single MeshPhongMaterial', () => {
    const material = track(new THREE.MeshPhongMaterial());
    spyOn(material, 'dispose').and.callThrough();

    disposeMaterial(material);

    expect(material.dispose).toHaveBeenCalledTimes(1);
  });

  it('should dispose a single LineBasicMaterial', () => {
    const material = track(new THREE.LineBasicMaterial());
    spyOn(material, 'dispose').and.callThrough();

    disposeMaterial(material);

    expect(material.dispose).toHaveBeenCalledTimes(1);
  });

  // --- Material[] array ---

  it('should dispose every material in a Material[] array', () => {
    const materials = [
      track(new THREE.MeshBasicMaterial()),
      track(new THREE.MeshStandardMaterial()),
      track(new THREE.MeshPhongMaterial())
    ];
    materials.forEach(m => spyOn(m, 'dispose').and.callThrough());

    disposeMaterial(materials);

    materials.forEach(m => {
      expect(m.dispose).toHaveBeenCalledTimes(1);
    });
  });

  it('should dispose a single-element array', () => {
    const material = track(new THREE.MeshBasicMaterial());
    spyOn(material, 'dispose').and.callThrough();

    disposeMaterial([material]);

    expect(material.dispose).toHaveBeenCalledTimes(1);
  });

  // --- Empty array ---

  it('should not throw when given an empty array', () => {
    expect(() => disposeMaterial([])).not.toThrow();
  });

  // --- Already-disposed material ---

  it('should not throw when disposing an already-disposed single material', () => {
    const material = track(new THREE.MeshBasicMaterial());
    material.dispose();

    expect(() => disposeMaterial(material)).not.toThrow();
  });

  it('should not throw when disposing an array containing already-disposed materials', () => {
    const m1 = track(new THREE.MeshBasicMaterial());
    const m2 = track(new THREE.MeshStandardMaterial());
    m1.dispose();

    expect(() => disposeMaterial([m1, m2])).not.toThrow();
  });

  // --- Correct branch selection ---

  it('should use Array.forEach path for arrays, not single dispose', () => {
    const materials = [
      track(new THREE.MeshBasicMaterial()),
      track(new THREE.MeshBasicMaterial())
    ];
    const spies = materials.map(m => spyOn(m, 'dispose').and.callThrough());

    disposeMaterial(materials);

    spies.forEach(s => expect(s).toHaveBeenCalledTimes(1));
  });

  it('should call dispose directly for a non-array material', () => {
    const material = track(new THREE.MeshBasicMaterial());
    const spy = spyOn(material, 'dispose').and.callThrough();

    disposeMaterial(material);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
