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
});
