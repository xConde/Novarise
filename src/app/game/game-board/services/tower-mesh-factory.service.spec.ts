import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TowerMeshFactoryService } from './tower-mesh-factory.service';
import { TowerType } from '../models/tower.model';
import { BOARD_CONFIG } from '../constants/board.constants';
import { TOWER_ACCENT_LIGHT_CONFIG } from '../constants/lighting.constants';
import { disposeGroup } from '../utils/three-utils';

function disposeGroupHelper(group: THREE.Group): void {
  disposeGroup(group);
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
    createdGroups.forEach(g => disposeGroupHelper(g));
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

  // --- attachAccentLight ---

  describe('attachAccentLight', () => {
    it('adds a PointLight to the group when isLowEnd is false', () => {
      const group = new THREE.Group();
      createdGroups.push(group);

      service.attachAccentLight(group, TowerType.BASIC, false);

      const light = group.userData['accentLight'];
      expect(light).toBeInstanceOf(THREE.PointLight);
      expect(group.children).toContain(light as THREE.Object3D);
    });

    it('stores the light reference in userData[accentLight]', () => {
      const group = new THREE.Group();
      createdGroups.push(group);

      service.attachAccentLight(group, TowerType.CHAIN, false);

      expect(group.userData['accentLight']).toBeInstanceOf(THREE.PointLight);
    });

    it('uses TOWER_ACCENT_LIGHT_CONFIG values for intensity and distance', () => {
      const group = new THREE.Group();
      createdGroups.push(group);

      service.attachAccentLight(group, TowerType.SNIPER, false);

      const light = group.userData['accentLight'] as THREE.PointLight;
      expect(light.intensity).toBeCloseTo(TOWER_ACCENT_LIGHT_CONFIG.intensity);
      expect(light.distance).toBeCloseTo(TOWER_ACCENT_LIGHT_CONFIG.distance);
    });

    it('does NOT add a PointLight when isLowEnd is true', () => {
      const group = new THREE.Group();
      createdGroups.push(group);

      service.attachAccentLight(group, TowerType.BASIC, true);

      expect(group.userData['accentLight']).toBeUndefined();
      expect(group.children.length).toBe(0);
    });

    it('disposeGroup runs without error on a group containing an accent light', () => {
      // THREE.PointLight holds no GPU resources — disposeGroup should not error.
      const group = service.createTowerMesh(5, 5, TowerType.BASIC, boardWidth, boardHeight);
      service.attachAccentLight(group, TowerType.BASIC, false);

      expect(() => disposeGroup(group)).not.toThrow();
    });
  });
});
