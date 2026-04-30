import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TowerMeshFactoryService } from './tower-mesh-factory.service';
import { TowerType } from '../models/tower.model';
import { BOARD_CONFIG } from '../constants/board.constants';
import { TOWER_ACCENT_LIGHT_CONFIG } from '../constants/lighting.constants';
import { disposeGroup } from '../utils/three-utils';
import {
  BASIC_IDLE_CONFIG,
  SNIPER_SCOPE_GLOW_CONFIG,
  SNIPER_RECOIL_CONFIG,
} from '../constants/tower-anim.constants';

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

  // --- BASIC tower redesign (Phase B) ---

  describe('BASIC tower Phase B redesign', () => {
    let basicGroup: THREE.Group;

    beforeEach(() => {
      basicGroup = service.createTowerMesh(5, 5, TowerType.BASIC, boardWidth, boardHeight);
      createdGroups.push(basicGroup);
    });

    it('has a child named "turret"', () => {
      const turret = basicGroup.getObjectByName('turret');
      expect(turret).toBeTruthy();
    });

    it('has a child named "barrel" (outermost barrel segment)', () => {
      const barrel = basicGroup.getObjectByName('barrel');
      expect(barrel).toBeTruthy();
    });

    it('has a child named "accent" (indicator sphere)', () => {
      const accent = basicGroup.getObjectByName('accent');
      expect(accent).toBeTruthy();
    });

    it('turret is a parent (or ancestor) of the barrel', () => {
      const turret = basicGroup.getObjectByName('turret');
      const barrel = basicGroup.getObjectByName('barrel');
      expect(turret).toBeTruthy();
      expect(barrel).toBeTruthy();
      // Barrel must be a descendant of turret
      let found = false;
      turret!.traverse(obj => { if (obj === barrel) found = true; });
      expect(found).toBeTrue();
    });

    it('registers an idleTick function on userData', () => {
      expect(typeof basicGroup.userData['idleTick']).toBe('function');
    });

    it('idleTick rotates the turret child', () => {
      const turret = basicGroup.getObjectByName('turret') as THREE.Object3D;
      expect(turret).toBeTruthy();

      const tick = basicGroup.userData['idleTick'] as (g: THREE.Group, t: number) => void;
      const t = 1.0;
      tick(basicGroup, t);

      const expected = Math.sin(t * BASIC_IDLE_CONFIG.swivelSpeed) * BASIC_IDLE_CONFIG.swivelAmplitudeRad;
      expect(turret.rotation.y).toBeCloseTo(expected, 5);
    });

    it('registers a fireTick function on userData', () => {
      expect(typeof basicGroup.userData['fireTick']).toBe('function');
    });

    it('fireTick stores recoilStart and recoilDuration on the group', () => {
      const fire = basicGroup.userData['fireTick'] as (g: THREE.Group, d: number) => void;
      fire(basicGroup, 0.1);

      expect(basicGroup.userData['recoilStart']).toBeDefined();
      expect(basicGroup.userData['recoilDuration']).toBeCloseTo(0.1, 5);
    });

    it('T2 barrelCap part is hidden at creation (minTier=2)', () => {
      const cap = basicGroup.getObjectByName('barrelCap') as THREE.Mesh | undefined;
      expect(cap).toBeTruthy();
      expect(cap!.visible).toBeFalse();
      expect(cap!.userData['minTier']).toBe(2);
    });

    it('T3 pauldron parts are hidden at creation (minTier=3)', () => {
      const pauldrons: THREE.Object3D[] = [];
      basicGroup.traverse(obj => { if (obj.name === 'pauldron') pauldrons.push(obj); });
      expect(pauldrons.length).toBeGreaterThanOrEqual(2);
      pauldrons.forEach(p => {
        expect(p.visible).toBeFalse();
        expect(p.userData['minTier']).toBe(3);
      });
    });

    it('no child is named "crystal" (old obelisk removed)', () => {
      const crystal = basicGroup.getObjectByName('crystal');
      // getObjectByName returns undefined when not found
      expect(crystal).toBeUndefined();
    });
  });

  // --- SNIPER tower redesign (Phase C) ---

  describe('SNIPER tower Phase C redesign', () => {
    let sniperGroup: THREE.Group;

    beforeEach(() => {
      sniperGroup = service.createTowerMesh(5, 5, TowerType.SNIPER, boardWidth, boardHeight);
      createdGroups.push(sniperGroup);
    });

    it('has no child named "tip" (old crystalline spike removed)', () => {
      const tip = sniperGroup.getObjectByName('tip');
      expect(tip).toBeUndefined();
    });

    it('has a child named "barrel" (long barrel cylinder)', () => {
      const barrel = sniperGroup.getObjectByName('barrel');
      expect(barrel).toBeTruthy();
    });

    it('has a child named "scope" (lens disk — the active optic)', () => {
      const scope = sniperGroup.getObjectByName('scope');
      expect(scope).toBeTruthy();
    });

    it('has a child named "muzzle" (muzzle brake)', () => {
      const muzzle = sniperGroup.getObjectByName('muzzle');
      expect(muzzle).toBeTruthy();
    });

    it('scope lens uses a separate material with higher initial emissiveIntensity', () => {
      const scope = sniperGroup.getObjectByName('scope') as THREE.Mesh | undefined;
      expect(scope).toBeTruthy();
      expect(scope!.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const mat = scope!.material as THREE.MeshStandardMaterial;
      expect(mat.emissiveIntensity).toBeCloseTo(SNIPER_SCOPE_GLOW_CONFIG.min, 4);
    });

    it('T1 scope has maxTier=1 (hidden at T2+)', () => {
      // Walk the group for a mesh with maxTier=1
      let found: THREE.Object3D | undefined;
      sniperGroup.traverse(obj => {
        if ((obj.userData as Record<string, unknown>)['maxTier'] === 1) { found = obj; }
      });
      expect(found).toBeTruthy();
      expect(found!.visible).toBeTrue();
    });

    it('T2 longer scope part is hidden at creation (minTier=2)', () => {
      const scopeLong = sniperGroup.getObjectByName('scopeLong') as THREE.Object3D | undefined;
      expect(scopeLong).toBeTruthy();
      expect(scopeLong!.visible).toBeFalse();
      expect((scopeLong!.userData as Record<string, unknown>)['minTier']).toBe(2);
    });

    it('bipod parts are visible at creation (no tier tag — present at T1/T2)', () => {
      const bipods: THREE.Object3D[] = [];
      sniperGroup.traverse(obj => { if (obj.name === 'bipod') bipods.push(obj); });
      expect(bipods.length).toBeGreaterThanOrEqual(2);
      bipods.forEach(b => {
        expect((b.userData as Record<string, unknown>)['maxTier']).toBe(2);
        expect(b.visible).toBeTrue();
      });
    });

    it('T3 stabilizer part is hidden at creation (minTier=3)', () => {
      const stab = sniperGroup.getObjectByName('stabilizer') as THREE.Object3D | undefined;
      expect(stab).toBeTruthy();
      expect(stab!.visible).toBeFalse();
      expect((stab!.userData as Record<string, unknown>)['minTier']).toBe(3);
    });

    it('registers an idleTick function on userData (scope lens pulse)', () => {
      expect(typeof sniperGroup.userData['idleTick']).toBe('function');
    });

    it('idleTick modulates scope lens emissiveIntensity within SNIPER_SCOPE_GLOW_CONFIG bounds', () => {
      const tick = sniperGroup.userData['idleTick'] as (g: THREE.Group, t: number) => void;
      const scope = sniperGroup.getObjectByName('scope') as THREE.Mesh;
      const mat = scope.material as THREE.MeshStandardMaterial;

      tick(sniperGroup, 0);
      const atZero = mat.emissiveIntensity;

      tick(sniperGroup, Math.PI / (2 * SNIPER_SCOPE_GLOW_CONFIG.speed));
      const atPeak = mat.emissiveIntensity;

      expect(atZero).toBeGreaterThanOrEqual(SNIPER_SCOPE_GLOW_CONFIG.min - 0.01);
      expect(atPeak).toBeLessThanOrEqual(SNIPER_SCOPE_GLOW_CONFIG.max + 0.01);
    });

    it('registers a chargeTick function on userData', () => {
      expect(typeof sniperGroup.userData['chargeTick']).toBe('function');
    });

    it('registers a fireTick function on userData', () => {
      expect(typeof sniperGroup.userData['fireTick']).toBe('function');
    });

    it('fireTick stores recoilStart, recoilDuration, and recoilDistance matching SNIPER_RECOIL_CONFIG', () => {
      const fire = sniperGroup.userData['fireTick'] as (g: THREE.Group, d: number) => void;
      fire(sniperGroup, 0.05);
      expect(sniperGroup.userData['recoilStart']).toBeDefined();
      expect(sniperGroup.userData['recoilDuration']).toBeCloseTo(0.05, 5);
      expect(sniperGroup.userData['recoilDistance']).toBeCloseTo(SNIPER_RECOIL_CONFIG.distance, 5);
    });

    it('recoilDistance is larger than BASIC (0.05) — sharper recoil', () => {
      const fire = sniperGroup.userData['fireTick'] as (g: THREE.Group, d: number) => void;
      fire(sniperGroup, 0.05);
      expect(sniperGroup.userData['recoilDistance']).toBeGreaterThan(0.05);
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
