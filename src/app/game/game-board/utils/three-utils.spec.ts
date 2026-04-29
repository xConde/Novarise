import * as THREE from 'three';
import {
  applyRendererPolicy,
  clampPixelRatio,
  disposeMaterial,
  disposeMesh,
  disposeGroup,
  getMaterials,
  RendererPolicy
} from './three-utils';

describe('applyRendererPolicy', () => {
  let renderer: jasmine.SpyObj<THREE.WebGLRenderer> & {
    shadowMap: { enabled: boolean; type: THREE.ShadowMapType };
    localClippingEnabled: boolean;
    toneMapping: THREE.ToneMapping;
    toneMappingExposure: number;
    outputColorSpace: THREE.ColorSpace;
  };
  const policy: RendererPolicy = {
    maxPixelRatio: 2,
    toneMappingExposure: 1.4,
    shadowMapType: THREE.PCFSoftShadowMap,
    toneMapping: THREE.ACESFilmicToneMapping,
    outputColorSpace: THREE.SRGBColorSpace,
    localClippingEnabled: true
  };

  beforeEach(() => {
    renderer = {
      setPixelRatio: jasmine.createSpy('setPixelRatio'),
      setSize: jasmine.createSpy('setSize'),
      shadowMap: { enabled: false, type: THREE.BasicShadowMap },
      localClippingEnabled: false,
      toneMapping: THREE.NoToneMapping,
      toneMappingExposure: 1,
      outputColorSpace: THREE.LinearSRGBColorSpace
    } as unknown as typeof renderer;
  });

  it('caps pixel ratio at policy.maxPixelRatio when devicePixelRatio exceeds it', () => {
    applyRendererPolicy(renderer, 800, 600, 3, policy);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
  });

  it('passes devicePixelRatio when below the cap', () => {
    applyRendererPolicy(renderer, 800, 600, 1, policy);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1);
  });

  it('sets renderer size to width/height', () => {
    applyRendererPolicy(renderer, 1920, 1080, 1, policy);
    expect(renderer.setSize).toHaveBeenCalledWith(1920, 1080);
  });

  it('enables shadow map and applies policy.shadowMapType', () => {
    applyRendererPolicy(renderer, 800, 600, 1, policy);
    expect(renderer.shadowMap.enabled).toBeTrue();
    expect(renderer.shadowMap.type).toBe(THREE.PCFSoftShadowMap);
  });

  it('applies tone mapping + exposure', () => {
    applyRendererPolicy(renderer, 800, 600, 1, policy);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBe(1.4);
  });

  it('sets outputColorSpace to SRGBColorSpace (was unset on game renderer pre-Phase-A)', () => {
    applyRendererPolicy(renderer, 800, 600, 1, policy);
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('enables localClippingEnabled when policy requests it', () => {
    applyRendererPolicy(renderer, 800, 600, 1, policy);
    expect(renderer.localClippingEnabled).toBeTrue();
  });
});

describe('clampPixelRatio', () => {
  it('returns the cap when devicePixelRatio exceeds it', () => {
    expect(clampPixelRatio(3, 2)).toBe(2);
  });

  it('returns devicePixelRatio when below the cap', () => {
    expect(clampPixelRatio(1, 2)).toBe(1);
  });

  it('returns devicePixelRatio when exactly equal to the cap', () => {
    expect(clampPixelRatio(2, 2)).toBe(2);
  });

  it('handles fractional ratios above the cap', () => {
    expect(clampPixelRatio(2.625, 2)).toBe(2);
  });

  it('handles fractional ratios below the cap', () => {
    expect(clampPixelRatio(1.5, 2)).toBe(1.5);
  });
});

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

describe('getMaterials', () => {
  let geometry: THREE.BoxGeometry;

  beforeEach(() => {
    geometry = new THREE.BoxGeometry(1, 1, 1);
  });

  afterEach(() => {
    try { geometry.dispose(); } catch { /* already disposed */ }
  });

  it('wraps a single Material in an array', () => {
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geometry, mat);
    const result = getMaterials(mesh);
    expect(result).toEqual([mat]);
    mat.dispose();
  });

  it('returns the array itself when mesh.material is Material[]', () => {
    const m1 = new THREE.MeshBasicMaterial();
    const m2 = new THREE.MeshBasicMaterial();
    const arr = [m1, m2];
    const mesh = new THREE.Mesh(geometry, arr);
    const result = getMaterials(mesh);
    expect(result).toBe(arr);
    m1.dispose();
    m2.dispose();
  });
});

describe('disposeGroup', () => {
  let geo1: THREE.BoxGeometry;
  let mat1: THREE.MeshBasicMaterial;
  let mesh1: THREE.Mesh;
  let group: THREE.Group;

  beforeEach(() => {
    geo1 = new THREE.BoxGeometry(1, 1, 1);
    mat1 = new THREE.MeshBasicMaterial();
    mesh1 = new THREE.Mesh(geo1, mat1);
    group = new THREE.Group();
    group.add(mesh1);
  });

  afterEach(() => {
    // Geometry/material may already be disposed by the function under test.
    try { geo1.dispose(); } catch { /* already disposed */ }
    try { mat1.dispose(); } catch { /* already disposed */ }
  });

  it('calls scene.remove(group) when a scene is provided', () => {
    const scene = new THREE.Scene();
    scene.add(group);
    spyOn(scene, 'remove').and.callThrough();
    disposeGroup(group, scene);
    expect(scene.remove).toHaveBeenCalledWith(group);
  });

  it('does NOT call scene.remove when scene is undefined', () => {
    const scene = new THREE.Scene();
    scene.add(group);
    spyOn(scene, 'remove');
    disposeGroup(group);
    expect(scene.remove).not.toHaveBeenCalled();
  });

  it('disposes geometry of every Mesh descendant', () => {
    spyOn(geo1, 'dispose');
    disposeGroup(group);
    expect(geo1.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes the single material of a Mesh descendant', () => {
    spyOn(mat1, 'dispose');
    disposeGroup(group);
    expect(mat1.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes each material when a Mesh has a Material[]', () => {
    const m1 = new THREE.MeshBasicMaterial();
    const m2 = new THREE.MeshBasicMaterial();
    spyOn(m1, 'dispose');
    spyOn(m2, 'dispose');
    mesh1.material = [m1, m2];
    disposeGroup(group);
    expect(m1.dispose).toHaveBeenCalledTimes(1);
    expect(m2.dispose).toHaveBeenCalledTimes(1);
    m1.dispose();
    m2.dispose();
  });

  it('handles deeply nested Groups (Group > Group > Mesh)', () => {
    const innerGeo = new THREE.BoxGeometry(1, 1, 1);
    const innerMat = new THREE.MeshBasicMaterial();
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    const innerGroup = new THREE.Group();
    innerGroup.add(innerMesh);
    const outerGroup = new THREE.Group();
    outerGroup.add(innerGroup);

    spyOn(innerGeo, 'dispose');
    spyOn(innerMat, 'dispose');
    disposeGroup(outerGroup);
    expect(innerGeo.dispose).toHaveBeenCalledTimes(1);
    expect(innerMat.dispose).toHaveBeenCalledTimes(1);

    try { innerGeo.dispose(); } catch { /* already disposed */ }
    try { innerMat.dispose(); } catch { /* already disposed */ }
  });

  it('disposes Line descendants (geometry + material)', () => {
    const lineGeo = new THREE.BufferGeometry();
    const lineMat = new THREE.LineBasicMaterial();
    const line = new THREE.Line(lineGeo, lineMat);
    const lineGroup = new THREE.Group();
    lineGroup.add(line);

    spyOn(lineGeo, 'dispose');
    spyOn(lineMat, 'dispose');
    disposeGroup(lineGroup);
    expect(lineGeo.dispose).toHaveBeenCalledTimes(1);
    expect(lineMat.dispose).toHaveBeenCalledTimes(1);

    try { lineGeo.dispose(); } catch { /* already disposed */ }
    try { lineMat.dispose(); } catch { /* already disposed */ }
  });

  it('disposes mixed Mesh and Line descendants in a single traversal', () => {
    const lineGeo = new THREE.BufferGeometry();
    const lineMat = new THREE.LineBasicMaterial();
    const line = new THREE.Line(lineGeo, lineMat);
    group.add(line); // group already contains mesh1 from beforeEach

    spyOn(geo1, 'dispose');
    spyOn(mat1, 'dispose');
    spyOn(lineGeo, 'dispose');
    spyOn(lineMat, 'dispose');
    disposeGroup(group);
    expect(geo1.dispose).toHaveBeenCalledTimes(1);
    expect(mat1.dispose).toHaveBeenCalledTimes(1);
    expect(lineGeo.dispose).toHaveBeenCalledTimes(1);
    expect(lineMat.dispose).toHaveBeenCalledTimes(1);

    try { lineGeo.dispose(); } catch { /* already disposed */ }
    try { lineMat.dispose(); } catch { /* already disposed */ }
  });
});
