import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { BoardMeshRegistryService } from './board-mesh-registry.service';

describe('BoardMeshRegistryService', () => {
  let service: BoardMeshRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [BoardMeshRegistryService] });
    service = TestBed.inject(BoardMeshRegistryService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('tileMeshes starts empty', () => {
    expect(service.tileMeshes.size).toBe(0);
  });

  it('towerMeshes starts empty', () => {
    expect(service.towerMeshes.size).toBe(0);
  });

  it('gridLines starts null', () => {
    expect(service.gridLines).toBeNull();
  });

  it('getTileMeshArray returns empty array initially', () => {
    expect(service.getTileMeshArray().length).toBe(0);
  });

  it('getTowerChildrenArray returns empty array initially', () => {
    expect(service.getTowerChildrenArray().length).toBe(0);
  });

  describe('rebuildTileMeshArray', () => {
    it('produces a flat array matching all values in tileMeshes', () => {
      const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      service.tileMeshes.set('0-0', mesh1);
      service.tileMeshes.set('0-1', mesh2);

      service.rebuildTileMeshArray();

      expect(service.getTileMeshArray().length).toBe(2);
      expect(service.getTileMeshArray()).toContain(mesh1);
      expect(service.getTileMeshArray()).toContain(mesh2);

      mesh1.geometry.dispose(); (mesh1.material as THREE.Material).dispose();
      mesh2.geometry.dispose(); (mesh2.material as THREE.Material).dispose();
    });

    it('reflects empty map after tileMeshes is cleared', () => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      service.tileMeshes.set('0-0', mesh);
      service.rebuildTileMeshArray();
      expect(service.getTileMeshArray().length).toBe(1);

      service.tileMeshes.clear();
      service.rebuildTileMeshArray();
      expect(service.getTileMeshArray().length).toBe(0);

      mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
    });
  });

  describe('rebuildTowerChildrenArray', () => {
    it('collects direct children from all tower groups', () => {
      const group = new THREE.Group();
      const childMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      group.add(childMesh);
      service.towerMeshes.set('1-2', group);

      service.rebuildTowerChildrenArray();

      expect(service.getTowerChildrenArray().length).toBe(1);
      expect(service.getTowerChildrenArray()[0]).toBe(childMesh);

      childMesh.geometry.dispose(); (childMesh.material as THREE.Material).dispose();
    });

    it('collects children from multiple groups', () => {
      const group1 = new THREE.Group();
      const child1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      group1.add(child1);

      const group2 = new THREE.Group();
      const child2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      group2.add(child2);

      service.towerMeshes.set('0-0', group1);
      service.towerMeshes.set('1-1', group2);

      service.rebuildTowerChildrenArray();

      expect(service.getTowerChildrenArray().length).toBe(2);
      expect(service.getTowerChildrenArray()).toContain(child1);
      expect(service.getTowerChildrenArray()).toContain(child2);

      child1.geometry.dispose(); (child1.material as THREE.Material).dispose();
      child2.geometry.dispose(); (child2.material as THREE.Material).dispose();
    });

    it('returns empty array when towerMeshes is empty', () => {
      service.rebuildTowerChildrenArray();
      expect(service.getTowerChildrenArray().length).toBe(0);
    });
  });

  describe('clear', () => {
    it('empties tileMeshes, towerMeshes, and both arrays', () => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      const group = new THREE.Group();
      service.tileMeshes.set('0-0', mesh);
      service.towerMeshes.set('0-0', group);
      service.gridLines = new THREE.Group();
      service.rebuildTileMeshArray();

      service.clear();

      expect(service.tileMeshes.size).toBe(0);
      expect(service.towerMeshes.size).toBe(0);
      expect(service.gridLines).toBeNull();
      expect(service.getTileMeshArray().length).toBe(0);
      expect(service.getTowerChildrenArray().length).toBe(0);

      mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
    });
  });

  describe('replaceTileMesh', () => {
    it('updates the map entry to point to the new mesh', () => {
      const oldMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      const newMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());

      service.tileMeshes.set('3-7', oldMesh);
      service.rebuildTileMeshArray();

      service.replaceTileMesh(3, 7, newMesh);

      expect(service.tileMeshes.get('3-7')).toBe(newMesh);

      oldMesh.geometry.dispose(); (oldMesh.material as THREE.Material).dispose();
      newMesh.geometry.dispose(); (newMesh.material as THREE.Material).dispose();
    });

    it('old mesh reference is no longer in the flat array after replacement', () => {
      const oldMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      const newMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());

      service.tileMeshes.set('1-2', oldMesh);
      service.rebuildTileMeshArray();
      expect(service.getTileMeshArray()).toContain(oldMesh);

      service.replaceTileMesh(1, 2, newMesh);

      expect(service.getTileMeshArray()).not.toContain(oldMesh);
      expect(service.getTileMeshArray()).toContain(newMesh);

      oldMesh.geometry.dispose(); (oldMesh.material as THREE.Material).dispose();
      newMesh.geometry.dispose(); (newMesh.material as THREE.Material).dispose();
    });

    it('flat array is rebuilt (length stays 1 after replace)', () => {
      const oldMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      const newMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());

      service.tileMeshes.set('0-0', oldMesh);
      service.rebuildTileMeshArray();
      expect(service.getTileMeshArray().length).toBe(1);

      service.replaceTileMesh(0, 0, newMesh);

      expect(service.getTileMeshArray().length).toBe(1);

      oldMesh.geometry.dispose(); (oldMesh.material as THREE.Material).dispose();
      newMesh.geometry.dispose(); (newMesh.material as THREE.Material).dispose();
    });

    it('inserts a new entry if the key did not exist before', () => {
      const newMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      expect(service.tileMeshes.has('5-5')).toBeFalse();

      service.replaceTileMesh(5, 5, newMesh);

      expect(service.tileMeshes.get('5-5')).toBe(newMesh);
      expect(service.getTileMeshArray()).toContain(newMesh);

      newMesh.geometry.dispose(); (newMesh.material as THREE.Material).dispose();
    });
  });

  // ── translateTileMesh (sprint 25 — Highground archetype) ──

  describe('translateTileMesh', () => {
    let geo: THREE.BoxGeometry;
    let mat: THREE.MeshStandardMaterial;
    let mesh: THREE.Mesh;

    beforeEach(() => {
      geo = new THREE.BoxGeometry(1, 1, 1);
      mat = new THREE.MeshStandardMaterial();
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, 0.1, 0);
      service.tileMeshes.set('2-3', mesh);
    });

    afterEach(() => {
      geo.dispose();
      mat.dispose();
    });

    it('sets position.y to the provided newY value', () => {
      service.translateTileMesh(2, 3, 2.1);
      expect(mesh.position.y).toBeCloseTo(2.1);
    });

    it('is a no-op when the key does not exist (does not throw)', () => {
      expect(() => service.translateTileMesh(99, 99, 5)).not.toThrow();
    });

    it('does NOT dispose geometry (disposal-neutral)', () => {
      spyOn(geo, 'dispose');
      service.translateTileMesh(2, 3, 1.5);
      expect(geo.dispose).not.toHaveBeenCalled();
    });

    it('does NOT dispose material (disposal-neutral)', () => {
      spyOn(mat, 'dispose');
      service.translateTileMesh(2, 3, 1.5);
      expect(mat.dispose).not.toHaveBeenCalled();
    });

    it('mesh reference identity is stable pre- and post-translate', () => {
      const ref = service.tileMeshes.get('2-3');
      service.translateTileMesh(2, 3, 3.0);
      expect(service.tileMeshes.get('2-3')).toBe(ref);
    });
  });

  // ── translateTowerMesh (sprint 25 — Highground archetype) ──

  describe('translateTowerMesh', () => {
    let group: THREE.Group;
    let childGeo: THREE.BoxGeometry;
    let childMat: THREE.MeshStandardMaterial;
    let child: THREE.Mesh;

    beforeEach(() => {
      group = new THREE.Group();
      group.position.set(0, 0.2, 0);
      childGeo = new THREE.BoxGeometry(1, 1, 1);
      childMat = new THREE.MeshStandardMaterial();
      child = new THREE.Mesh(childGeo, childMat);
      group.add(child);
      service.towerMeshes.set('4-5', group);
    });

    afterEach(() => {
      childGeo.dispose();
      childMat.dispose();
    });

    it('sets group position.y to the provided newY value', () => {
      service.translateTowerMesh(4, 5, 2.2);
      expect(group.position.y).toBeCloseTo(2.2);
    });

    it('is a no-op when the key does not exist (does not throw)', () => {
      expect(() => service.translateTowerMesh(99, 99, 5)).not.toThrow();
    });

    it('does NOT dispose child geometry (disposal-neutral)', () => {
      spyOn(childGeo, 'dispose');
      service.translateTowerMesh(4, 5, 1.5);
      expect(childGeo.dispose).not.toHaveBeenCalled();
    });

    it('does NOT dispose child material (disposal-neutral)', () => {
      spyOn(childMat, 'dispose');
      service.translateTowerMesh(4, 5, 1.5);
      expect(childMat.dispose).not.toHaveBeenCalled();
    });

    it('tower group reference identity is stable pre- and post-translate', () => {
      const ref = service.towerMeshes.get('4-5');
      service.translateTowerMesh(4, 5, 3.0);
      expect(service.towerMeshes.get('4-5')).toBe(ref);
    });
  });
});
