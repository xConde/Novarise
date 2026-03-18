import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TowerMeshFactoryService } from './tower-mesh-factory.service';
import { TowerType } from '../models/tower.model';
import { BOARD_CONFIG } from '../constants/board.constants';

/** Dispose all geometry/material on a group to free WebGL resources. */
function disposeGroup(group: THREE.Group): void {
  group.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        (child.material as THREE.Material).dispose();
      }
    }
  });
}

describe('TowerMeshFactoryService', () => {
  let service: TowerMeshFactoryService;
  const createdGroups: THREE.Group[] = [];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TowerMeshFactoryService]
    });
    service = TestBed.inject(TowerMeshFactoryService);
  });

  afterEach(() => {
    // Dispose all Three.js objects created during the test
    createdGroups.forEach(disposeGroup);
    createdGroups.length = 0;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- Each tower type creates a valid group ---

  const boardWidth = BOARD_CONFIG.width;
  const boardHeight = BOARD_CONFIG.height;

  const towerTypes: TowerType[] = [
    TowerType.BASIC,
    TowerType.SNIPER,
    TowerType.SPLASH,
    TowerType.SLOW,
    TowerType.CHAIN,
    TowerType.MORTAR,
  ];

  towerTypes.forEach(towerType => {
    describe(`TowerType.${towerType}`, () => {
      let group: THREE.Group;

      beforeEach(() => {
        group = service.createTowerMesh(5, 5, towerType, boardWidth, boardHeight);
        createdGroups.push(group);
      });

      it('should return a THREE.Group', () => {
        expect(group instanceof THREE.Group).toBeTrue();
      });

      it('should have at least one child mesh', () => {
        expect(group.children.length).toBeGreaterThan(0);
      });

      it('should store towerType in userData', () => {
        expect(group.userData['towerType']).toBe(towerType);
      });

      it('should have castShadow enabled on the group', () => {
        expect(group.castShadow).toBeTrue();
      });

      it('should have castShadow enabled on all Mesh children', () => {
        group.traverse(child => {
          if (child instanceof THREE.Mesh) {
            expect(child.castShadow).withContext(`child at ${child.name}`).toBeTrue();
          }
        });
      });
    });
  });

  // --- Positioning ---

  describe('positioning', () => {
    it('should position at correct world x coordinate', () => {
      // row=5, col=5, boardWidth=25, boardHeight=20
      // x = (5 - 25/2) * 1 = (5 - 12.5) * 1 = -7.5
      const group = service.createTowerMesh(5, 5, TowerType.BASIC, boardWidth, boardHeight);
      createdGroups.push(group);
      expect(group.position.x).toBeCloseTo(-7.5);
    });

    it('should position at correct world z coordinate', () => {
      // z = (5 - 20/2) * 1 = (5 - 10) * 1 = -5
      const group = service.createTowerMesh(5, 5, TowerType.BASIC, boardWidth, boardHeight);
      createdGroups.push(group);
      expect(group.position.z).toBeCloseTo(-5);
    });

    it('should position at tileHeight on y axis', () => {
      const group = service.createTowerMesh(5, 5, TowerType.BASIC, boardWidth, boardHeight);
      createdGroups.push(group);
      expect(group.position.y).toBeCloseTo(BOARD_CONFIG.tileHeight);
    });

    it('should use boardWidth and boardHeight params for centering', () => {
      // Custom board size: 10x10 — col=0, row=0 → x = (0 - 5) * 1 = -5
      const group = service.createTowerMesh(0, 0, TowerType.BASIC, 10, 10);
      createdGroups.push(group);
      expect(group.position.x).toBeCloseTo(-5);
      expect(group.position.z).toBeCloseTo(-5);
    });

    it('should apply scale 1.4 on all axes', () => {
      const group = service.createTowerMesh(5, 5, TowerType.BASIC, boardWidth, boardHeight);
      createdGroups.push(group);
      expect(group.scale.x).toBeCloseTo(1.4);
      expect(group.scale.y).toBeCloseTo(1.4);
      expect(group.scale.z).toBeCloseTo(1.4);
    });
  });

  // --- Default/fallback case ---

  describe('default case', () => {
    it('should produce a group with at least one child for an unrecognized tower type', () => {
      // Cast to TowerType to simulate a value that slips past the switch
      const group = service.createTowerMesh(5, 5, 'UNKNOWN' as TowerType, boardWidth, boardHeight);
      createdGroups.push(group);
      expect(group.children.length).toBeGreaterThan(0);
    });
  });
});
