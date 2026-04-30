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
  SPLASH_DRUM_CONFIG,
  SPLASH_TUBE_EMIT_CONFIG,
  SLOW_EMITTER_PULSE_CONFIG,
  SLOW_EMITTER_PULSE_FIRE,
  SLOW_CRYSTAL_Y,
  CHAIN_CHARGE_CONFIG,
  CHAIN_SPHERE_BOB_CONFIG,
  CHAIN_Y,
  MORTAR_RECOIL_CONFIG,
  MORTAR_BARREL_NAMES,
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

    it('scope lens (name="scope") has maxTier=1 so it hides at T2+ with the housing', () => {
      // The lens disk must carry the same maxTier=1 tag as the scope housing cylinder.
      // Without it, revealTierParts hides the housing but the lens disk floats detached.
      const lens = sniperGroup.getObjectByName('scope') as THREE.Object3D | undefined;
      expect(lens).toBeTruthy();
      expect((lens!.userData as Record<string, unknown>)['maxTier']).toBe(1);
    });
  });

  // --- SPLASH tower redesign (Phase D) ---

  describe('SPLASH tower Phase D redesign', () => {
    let splashGroup: THREE.Group;

    beforeEach(() => {
      splashGroup = service.createTowerMesh(5, 5, TowerType.SPLASH, boardWidth, boardHeight);
      createdGroups.push(splashGroup);
    });

    it('has no child named "spore" (old mushroom removed)', () => {
      const spore = splashGroup.getObjectByName('spore');
      expect(spore).toBeUndefined();
    });

    it('has a child named "drum" (rotating drum housing)', () => {
      const drum = splashGroup.getObjectByName('drum');
      expect(drum).toBeTruthy();
    });

    it('drum is a THREE.Group (so its rotation drives child tubes)', () => {
      const drum = splashGroup.getObjectByName('drum');
      expect(drum instanceof THREE.Group).toBeTrue();
    });

    it('has 4 base tube children on the drum (T1)', () => {
      const drum = splashGroup.getObjectByName('drum')!;
      const tubes: THREE.Object3D[] = [];
      drum.traverse(obj => {
        if (obj.name.startsWith('tube') && (obj.userData['minTier'] === undefined)) {
          tubes.push(obj);
        }
      });
      // Tubes without a minTier tag are always visible (T1 base set)
      expect(tubes.length).toBe(4);
    });

    it('tubes 1-4 have tubeIndex in userData [0..3]', () => {
      const drum = splashGroup.getObjectByName('drum')!;
      for (let i = 0; i < 4; i++) {
        const tube = drum.getObjectByName(`tube${i + 1}`) as THREE.Object3D | undefined;
        expect(tube).withContext(`tube${i + 1} missing`).toBeTruthy();
        expect(tube!.userData['tubeIndex']).toBe(i);
      }
    });

    it('T2 tubes (tube5, tube6) are hidden at creation with minTier=2', () => {
      const drum = splashGroup.getObjectByName('drum')!;
      for (const name of ['tube5', 'tube6']) {
        const tube = drum.getObjectByName(name) as THREE.Object3D | undefined;
        expect(tube).withContext(`${name} missing`).toBeTruthy();
        expect(tube!.visible).withContext(`${name} should start hidden`).toBeFalse();
        expect(tube!.userData['minTier']).withContext(`${name} minTier`).toBe(2);
      }
    });

    it('T3 tubes (tube7, tube8) are hidden at creation with minTier=3', () => {
      const drum = splashGroup.getObjectByName('drum')!;
      for (const name of ['tube7', 'tube8']) {
        const tube = drum.getObjectByName(name) as THREE.Object3D | undefined;
        expect(tube).withContext(`${name} missing`).toBeTruthy();
        expect(tube!.visible).withContext(`${name} should start hidden`).toBeFalse();
        expect(tube!.userData['minTier']).withContext(`${name} minTier`).toBe(3);
      }
    });

    it('T3 heat-vent is hidden at creation with minTier=3', () => {
      const heatVent = splashGroup.getObjectByName('heatVent') as THREE.Object3D | undefined;
      expect(heatVent).toBeTruthy();
      expect(heatVent!.visible).toBeFalse();
      expect(heatVent!.userData['minTier']).toBe(3);
    });

    it('revealTierParts at level 1 shows 4 tubes only', () => {
      const drum = splashGroup.getObjectByName('drum')!;

      // Simulate T1: manually apply what revealTierParts does (minTier <= level)
      drum.traverse(obj => {
        const minTier = obj.userData['minTier'] as number | undefined;
        if (minTier !== undefined) { obj.visible = minTier <= 1; }
      });

      const visibleTubes: THREE.Object3D[] = [];
      drum.traverse(obj => {
        if (obj.name.startsWith('tube') && obj.visible) visibleTubes.push(obj);
      });
      expect(visibleTubes.length).toBe(4);
    });

    it('revealTierParts at level 2 shows 6 tubes', () => {
      const drum = splashGroup.getObjectByName('drum')!;
      drum.traverse(obj => {
        const minTier = obj.userData['minTier'] as number | undefined;
        if (minTier !== undefined) { obj.visible = minTier <= 2; }
      });

      const visibleTubes: THREE.Object3D[] = [];
      drum.traverse(obj => {
        if (obj.name.startsWith('tube') && obj.visible) visibleTubes.push(obj);
      });
      expect(visibleTubes.length).toBe(6);
    });

    it('revealTierParts at level 3 shows 8 tubes and the heat-vent', () => {
      const drum = splashGroup.getObjectByName('drum')!;
      drum.traverse(obj => {
        const minTier = obj.userData['minTier'] as number | undefined;
        if (minTier !== undefined) { obj.visible = minTier <= 3; }
      });

      const visibleTubes: THREE.Object3D[] = [];
      drum.traverse(obj => {
        if (obj.name.startsWith('tube') && obj.visible) visibleTubes.push(obj);
      });
      expect(visibleTubes.length).toBe(8);

      const heatVent = drum.getObjectByName('heatVent') as THREE.Object3D | undefined;
      expect(heatVent?.visible).toBeTrue();
    });

    it('registers an idleTick function on userData', () => {
      expect(typeof splashGroup.userData['idleTick']).toBe('function');
    });

    it('idleTick advances drum rotation angle on each call', () => {
      const drum = splashGroup.getObjectByName('drum') as THREE.Group;
      expect(drum).toBeTruthy();

      const tick = splashGroup.userData['idleTick'] as (g: THREE.Group, t: number) => void;

      // First call seeds prevT, deltaT=0 → angle stays 0
      tick(splashGroup, 1.0);
      expect(drum.rotation.z).toBeCloseTo(0, 4);

      // Second call at t=1.1 → deltaT=0.1, angle = 0.1 * idleSpeed
      tick(splashGroup, 1.1);
      const expected = 0.1 * SPLASH_DRUM_CONFIG.idleSpeedRadPerSec;
      expect(drum.rotation.z).toBeCloseTo(expected, 4);
    });

    it('idleTick uses fire speed when drumSpinBoostUntil is in the future', () => {
      const drum = splashGroup.getObjectByName('drum') as THREE.Group;
      const boostFuture = performance.now() / 1000 + 10;
      splashGroup.userData['drumSpinBoostUntil'] = boostFuture;

      const tick = splashGroup.userData['idleTick'] as (g: THREE.Group, t: number) => void;

      // Seed prevT
      tick(splashGroup, 1.0);
      // Second call with deltaT=0.1 and boost active
      tick(splashGroup, 1.1);

      const expected = 0.1 * SPLASH_DRUM_CONFIG.fireSpeedRadPerSec;
      expect(drum.rotation.z).toBeCloseTo(expected, 4);
    });

    it('registers a fireTick function on userData', () => {
      expect(typeof splashGroup.userData['fireTick']).toBe('function');
    });

    it('fireTick sets drumSpinBoostUntil to a future timestamp', () => {
      const fire = splashGroup.userData['fireTick'] as (g: THREE.Group, d: number) => void;
      const beforeFire = performance.now() / 1000;
      fire(splashGroup, 0.3);

      const boostUntil = splashGroup.userData['drumSpinBoostUntil'] as number;
      expect(boostUntil).toBeGreaterThan(beforeFire);
    });

    it('fireTick increments nextTubeIndex each call (round-robin, T1 visible tubes)', () => {
      const fire = splashGroup.userData['fireTick'] as (g: THREE.Group, d: number) => void;
      // At T1 all 4 base tubes are visible; first fire lands on tube1 (idx 0) → counter = 1
      fire(splashGroup, 0.1);
      expect(splashGroup.userData['nextTubeIndex']).toBe(1);
      // Second fire lands on tube2 (idx 1) → counter = 2
      fire(splashGroup, 0.1);
      expect(splashGroup.userData['nextTubeIndex']).toBe(2);
    });

    it('fireTick skips hidden tubes and always emits from a visible tube', () => {
      const fire = splashGroup.userData['fireTick'] as (g: THREE.Group, d: number) => void;
      const drum = splashGroup.getObjectByName('drum')!;

      // Force all tubes except tube3 and tube4 (idx 2 and 3) to be hidden,
      // then start the counter at idx 4 (first hidden T2 tube position).
      // The round-robin must skip hidden tubes 5-8 and wrap to find tube1.
      for (const name of ['tube1','tube2','tube5','tube6','tube7','tube8']) {
        const t = drum.getObjectByName(name) as THREE.Mesh | undefined;
        if (t) t.visible = false;
      }
      // tube3 (idx 2) and tube4 (idx 3) remain visible.
      // Start the counter right past the visible pair so the scan must skip hidden ones.
      splashGroup.userData['nextTubeIndex'] = 4; // points to tube5 (hidden T2)

      fire(splashGroup, 0.1);

      const emitting = splashGroup.userData['emittingTubeIndex'] as number | undefined;
      // Should have wrapped around and found tube3 (idx 2) or tube4 (idx 3)
      expect(emitting).toBeDefined();
      expect([2, 3]).toContain(emitting!);
      // Emit state must be set (no silent skip)
      expect(splashGroup.userData['tubeEmitStart']).toBeDefined();
    });

    it('fireTick sets emittingTubeIndex pointing to a visible tube', () => {
      const fire = splashGroup.userData['fireTick'] as (g: THREE.Group, d: number) => void;
      fire(splashGroup, 0.1);

      const emitting = splashGroup.userData['emittingTubeIndex'] as number | undefined;
      // At T1 only tubes 0-3 are visible, so index must be in that range
      expect(emitting).toBeDefined();
      expect(emitting!).toBeGreaterThanOrEqual(0);
      expect(emitting!).toBeLessThanOrEqual(3);
    });

    it('fireTick stores tubeEmitStart and tubeEmitDuration', () => {
      const fire = splashGroup.userData['fireTick'] as (g: THREE.Group, d: number) => void;
      fire(splashGroup, 0.2);

      expect(splashGroup.userData['tubeEmitStart']).toBeDefined();
      expect(splashGroup.userData['tubeEmitDuration']).toBeCloseTo(SPLASH_TUBE_EMIT_CONFIG.duration, 4);
    });

    it('each tube has its own material instance (emissive isolation)', () => {
      // Regression guard for shared-material bug: if all tubes shared one material,
      // mutating tube1.material.emissiveIntensity would affect all tubes.
      const drum = splashGroup.getObjectByName('drum')!;
      const tube1 = drum.getObjectByName('tube1') as THREE.Mesh | undefined;
      const tube2 = drum.getObjectByName('tube2') as THREE.Mesh | undefined;

      expect(tube1).toBeTruthy();
      expect(tube2).toBeTruthy();
      expect(tube1!.material).not.toBe(tube2!.material);
    });
  });

  // --- SLOW tower redesign (Phase E) ---

  describe('SLOW tower Phase E redesign', () => {
    let slowGroup: THREE.Group;

    beforeEach(() => {
      slowGroup = service.createTowerMesh(5, 5, TowerType.SLOW, boardWidth, boardHeight);
      createdGroups.push(slowGroup);
    });

    it('has no child named "crystal" (old ice-pad removed)', () => {
      const crystal = slowGroup.getObjectByName('crystal');
      expect(crystal).toBeUndefined();
    });

    it('has no child named "iceBase" (old pad removed)', () => {
      const iceBase = slowGroup.getObjectByName('iceBase');
      expect(iceBase).toBeUndefined();
    });

    it('has a child named "coil" (T1 pulse coil ring)', () => {
      const coil = slowGroup.getObjectByName('coil');
      expect(coil).toBeTruthy();
    });

    it('has a child named "emitter" (cryo emitter dish)', () => {
      const emitter = slowGroup.getObjectByName('emitter');
      expect(emitter).toBeTruthy();
    });

    it('emitter uses a separate material with emissiveIntensity at SLOW_EMITTER_PULSE_CONFIG.min', () => {
      const emitter = slowGroup.getObjectByName('emitter') as THREE.Mesh | undefined;
      expect(emitter).toBeTruthy();
      expect(emitter!.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const mat = emitter!.material as THREE.MeshStandardMaterial;
      expect(mat.emissiveIntensity).toBeCloseTo(SLOW_EMITTER_PULSE_CONFIG.min, 4);
    });

    it('each SLOW tower instance gets its own emitter material (no shared-material cross-contamination)', () => {
      // Two SLOW towers must not share their emitter material — muzzle-flash
      // save/restore uses (mesh.uuid + mat.uuid) as the key; a shared material
      // means tower B's save captures tower A's already-spiked emissiveIntensity.
      const slowGroup2 = service.createTowerMesh(6, 6, TowerType.SLOW, boardWidth, boardHeight);
      createdGroups.push(slowGroup2);

      const emitter1 = slowGroup.getObjectByName('emitter') as THREE.Mesh;
      const emitter2 = slowGroup2.getObjectByName('emitter') as THREE.Mesh;

      expect(emitter1).toBeTruthy();
      expect(emitter2).toBeTruthy();
      expect(emitter1.material).not.toBe(emitter2.material);
    });

    it('T2 coil2 part is hidden at creation with minTier=2', () => {
      const coil2 = slowGroup.getObjectByName('coil2') as THREE.Object3D | undefined;
      expect(coil2).toBeTruthy();
      expect(coil2!.visible).toBeFalse();
      expect(coil2!.userData['minTier']).toBe(2);
    });

    it('T3 crystalCore part is hidden at creation with minTier=3 and floatBob flag', () => {
      const crystal = slowGroup.getObjectByName('crystalCore') as THREE.Object3D | undefined;
      expect(crystal).toBeTruthy();
      expect(crystal!.visible).toBeFalse();
      expect(crystal!.userData['minTier']).toBe(3);
      expect(crystal!.userData['floatBob']).toBeTrue();
    });

    it('registers an idleTick function on userData', () => {
      expect(typeof slowGroup.userData['idleTick']).toBe('function');
    });

    it('idleTick modulates emitter emissiveIntensity within SLOW_EMITTER_PULSE_CONFIG bounds', () => {
      const tick = slowGroup.userData['idleTick'] as (g: THREE.Group, t: number) => void;
      const emitter = slowGroup.getObjectByName('emitter') as THREE.Mesh;
      const mat = emitter.material as THREE.MeshStandardMaterial;

      tick(slowGroup, 0);
      const atZero = mat.emissiveIntensity;

      tick(slowGroup, SLOW_EMITTER_PULSE_CONFIG.periodSec / 4);
      const atQuarter = mat.emissiveIntensity;

      expect(atZero).toBeGreaterThanOrEqual(SLOW_EMITTER_PULSE_CONFIG.min - 0.01);
      expect(atQuarter).toBeLessThanOrEqual(SLOW_EMITTER_PULSE_CONFIG.max + 0.01);
    });

    it('idleTick rotates the coil ring around its Z axis', () => {
      const tick = slowGroup.userData['idleTick'] as (g: THREE.Group, t: number) => void;
      const coil = slowGroup.getObjectByName('coil') as THREE.Mesh;

      tick(slowGroup, 0);
      const atZero = coil.rotation.z;
      tick(slowGroup, 1.0);
      const atOne = coil.rotation.z;

      expect(atOne).toBeGreaterThan(atZero);
    });

    it('idleTick bobs the crystalCore when floatBob is set and T3 is visible', () => {
      const tick = slowGroup.userData['idleTick'] as (g: THREE.Group, t: number) => void;
      const crystal = slowGroup.getObjectByName('crystalCore') as THREE.Mesh;
      crystal.visible = true; // simulate T3 revealed

      tick(slowGroup, 0);
      const y0 = crystal.position.y;
      tick(slowGroup, Math.PI / (2 * SLOW_EMITTER_PULSE_CONFIG.crystalBobSpeed));
      const y1 = crystal.position.y;

      // Y must have changed from the base position
      expect(Math.abs(y1 - SLOW_CRYSTAL_Y)).toBeGreaterThan(0.01);
      // And the two values differ (it's animating)
      expect(y0).not.toBeCloseTo(y1, 3);
    });

    it('registers a fireTick function on userData', () => {
      expect(typeof slowGroup.userData['fireTick']).toBe('function');
    });

    it('fireTick stores emitterPulseStart on the group', () => {
      // emitterPulseDuration is no longer written by fireTick — tickEmitterPulses
      // compares against SLOW_EMITTER_PULSE_FIRE.durationSec directly (E-a fix).
      const fire = slowGroup.userData['fireTick'] as (g: THREE.Group, d: number) => void;
      fire(slowGroup, SLOW_EMITTER_PULSE_FIRE.durationSec);

      expect(slowGroup.userData['emitterPulseStart']).toBeDefined();
      expect(slowGroup.userData['emitterPulseDuration']).toBeUndefined();
    });
  });

  // --- CHAIN tower redesign (Phase F) ---

  describe('CHAIN tower Phase F redesign', () => {
    let chainGroup: THREE.Group;

    beforeEach(() => {
      chainGroup = service.createTowerMesh(5, 5, TowerType.CHAIN, boardWidth, boardHeight);
      createdGroups.push(chainGroup);
    });

    it('has no child named "orb" (legacy antenna orb removed)', () => {
      const orb = chainGroup.getObjectByName('orb');
      expect(orb).toBeUndefined();
    });

    it('has no child named "spark" (legacy spark spheres removed)', () => {
      const spark = chainGroup.getObjectByName('spark');
      expect(spark).toBeUndefined();
    });

    it('has a child named "sphere" (new Tesla coil top sphere)', () => {
      const sphere = chainGroup.getObjectByName('sphere');
      expect(sphere).toBeTruthy();
    });

    it('has at least 3 children named "electrode"', () => {
      const electrodes: THREE.Object3D[] = [];
      chainGroup.traverse(obj => { if (obj.name === 'electrode') electrodes.push(obj); });
      expect(electrodes.length).toBeGreaterThanOrEqual(3);
    });

    it('has a child named "arc" (idle arc cylinder)', () => {
      const arc = chainGroup.getObjectByName('arc');
      expect(arc).toBeTruthy();
    });

    it('sphere mesh uses a MeshStandardMaterial with emissiveIntensity set', () => {
      const sphere = chainGroup.getObjectByName('sphere') as THREE.Mesh | undefined;
      expect(sphere).toBeTruthy();
      expect(sphere!.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const mat = sphere!.material as THREE.MeshStandardMaterial;
      expect(mat.emissiveIntensity).toBeGreaterThan(0);
    });

    it('each CHAIN tower gets its own sphere material instance (no shared-material cross-contamination)', () => {
      const chainGroup2 = service.createTowerMesh(6, 6, TowerType.CHAIN, boardWidth, boardHeight);
      createdGroups.push(chainGroup2);

      const sphere1 = chainGroup.getObjectByName('sphere') as THREE.Mesh;
      const sphere2 = chainGroup2.getObjectByName('sphere') as THREE.Mesh;

      expect(sphere1).toBeTruthy();
      expect(sphere2).toBeTruthy();
      expect(sphere1.material).not.toBe(sphere2.material);
    });

    it('sphere emissiveIntensity starts at CHAIN_CHARGE_CONFIG.emissiveMin', () => {
      const sphere = chainGroup.getObjectByName('sphere') as THREE.Mesh | undefined;
      expect(sphere).toBeTruthy();
      const mat = sphere!.material as THREE.MeshStandardMaterial;
      expect(mat.emissiveIntensity).toBeCloseTo(CHAIN_CHARGE_CONFIG.emissiveMin, 4);
    });

    it('registers a chargeTick function on userData', () => {
      expect(typeof chainGroup.userData['chargeTick']).toBe('function');
    });

    it('chargeTick modulates sphere emissiveIntensity within CHAIN_CHARGE_CONFIG bounds', () => {
      const charge = chainGroup.userData['chargeTick'] as (g: THREE.Group, t: number) => void;
      const sphere = chainGroup.getObjectByName('sphere') as THREE.Mesh;
      const mat = sphere.material as THREE.MeshStandardMaterial;

      charge(chainGroup, 0);
      const atZero = mat.emissiveIntensity;

      charge(chainGroup, CHAIN_CHARGE_CONFIG.periodSec / 4);
      const atQuarter = mat.emissiveIntensity;

      expect(atZero).toBeGreaterThanOrEqual(CHAIN_CHARGE_CONFIG.emissiveMin - 0.01);
      expect(atQuarter).toBeLessThanOrEqual(CHAIN_CHARGE_CONFIG.emissiveMax + 0.01);
    });

    it('registers an idleTick function on userData', () => {
      expect(typeof chainGroup.userData['idleTick']).toBe('function');
    });

    it('idleTick bobs the sphere from CHAIN_Y.sphere by CHAIN_SPHERE_BOB_CONFIG.amplitude', () => {
      const tick = chainGroup.userData['idleTick'] as (g: THREE.Group, t: number) => void;
      const sphere = chainGroup.getObjectByName('sphere') as THREE.Mesh;

      tick(chainGroup, 0);
      const y0 = sphere.position.y;
      tick(chainGroup, CHAIN_SPHERE_BOB_CONFIG.periodSec / 4);
      const y1 = sphere.position.y;

      expect(Math.abs(y0 - CHAIN_Y.sphere)).toBeLessThanOrEqual(CHAIN_SPHERE_BOB_CONFIG.amplitude + 0.001);
      expect(y0).not.toBeCloseTo(y1, 3);
    });

    it('registers a fireTick function on userData', () => {
      expect(typeof chainGroup.userData['fireTick']).toBe('function');
    });

    it('fireTick stores recoilStart and recoilDuration', () => {
      const fire = chainGroup.userData['fireTick'] as (g: THREE.Group, d: number) => void;
      fire(chainGroup, 0.1);
      expect(chainGroup.userData['recoilStart']).toBeDefined();
      expect(chainGroup.userData['recoilDuration']).toBeCloseTo(0.1, 5);
    });

    it('T2 orbitSphere2 is hidden at creation with minTier=2', () => {
      const orbit2 = chainGroup.getObjectByName('orbitSphere2') as THREE.Object3D | undefined;
      expect(orbit2).toBeTruthy();
      expect(orbit2!.visible).toBeFalse();
      expect(orbit2!.userData['minTier']).toBe(2);
    });

    it('T3 orbitSphere3 is hidden at creation with minTier=3', () => {
      const orbit3 = chainGroup.getObjectByName('orbitSphere3') as THREE.Object3D | undefined;
      expect(orbit3).toBeTruthy();
      expect(orbit3!.visible).toBeFalse();
      expect(orbit3!.userData['minTier']).toBe(3);
    });

    it('arc mesh has transparent material with opacity within arc config bounds', () => {
      const arc = chainGroup.getObjectByName('arc') as THREE.Mesh | undefined;
      expect(arc).toBeTruthy();
      const mat = arc!.material as THREE.MeshStandardMaterial;
      expect(mat.transparent).toBeTrue();
      expect(mat.opacity).toBeGreaterThan(0);
      expect(mat.opacity).toBeLessThanOrEqual(1.0);
    });

    // Finding 15 — frame-rate-independent orbit (fix: use wall-clock t, not / 60)
    it('orbiting spheres produce frame-rate-independent positions (same angle from t=0 regardless of call count)', () => {
      const tick = chainGroup.userData['idleTick'] as (g: THREE.Group, t: number) => void;
      const orbit2 = chainGroup.getObjectByName('orbitSphere2') as THREE.Mesh;
      orbit2.visible = true; // make visible so idleTick processes it

      // Call once with t = 2.0 (simulates 2s elapsed, arrived in one big step)
      tick(chainGroup, 2.0);
      const pos1 = orbit2.position.clone();

      // Call 120 times with t stepping from 0 to 2 in 1/60 increments
      // (simulates 120 60fps frames accumulating to t=2)
      const chainGroup2 = service.createTowerMesh(7, 7, TowerType.CHAIN, boardWidth, boardHeight);
      createdGroups.push(chainGroup2);
      const tick2 = chainGroup2.userData['idleTick'] as (g: THREE.Group, t: number) => void;
      const orbit2b = chainGroup2.getObjectByName('orbitSphere2') as THREE.Mesh;
      orbit2b.visible = true;
      for (let i = 0; i <= 120; i++) {
        tick2(chainGroup2, i / 60);
      }
      const pos2 = orbit2b.position.clone();

      // Both should be at the same position (within floating-point tolerance)
      expect(pos1.x).toBeCloseTo(pos2.x, 4);
      expect(pos1.z).toBeCloseTo(pos2.z, 4);
    });
  });

  // --- MORTAR tower redesign (Phase G) ---

  describe('MORTAR tower Phase G redesign', () => {
    let mortarGroup: THREE.Group;

    beforeEach(() => {
      mortarGroup = service.createTowerMesh(5, 5, TowerType.MORTAR, boardWidth, boardHeight);
      createdGroups.push(mortarGroup);
    });

    it('has a child named "mortarBase" (swivel housing)', () => {
      const housing = mortarGroup.getObjectByName('mortarBase');
      expect(housing).toBeTruthy();
    });

    it('has a child named "barrelPivot" (barrel pivot group)', () => {
      const pivot = mortarGroup.getObjectByName('barrelPivot');
      expect(pivot).toBeTruthy();
    });

    it('barrelPivot is a THREE.Group', () => {
      const pivot = mortarGroup.getObjectByName('barrelPivot');
      expect(pivot instanceof THREE.Group).toBeTrue();
    });

    it('has a child named "barrelT1" (T1 barrel cylinder)', () => {
      const b = mortarGroup.getObjectByName('barrelT1');
      expect(b).toBeTruthy();
    });

    it('barrelT1 is visible at creation (maxTier=1 — T1 default)', () => {
      const b = mortarGroup.getObjectByName('barrelT1') as THREE.Mesh | undefined;
      expect(b).toBeTruthy();
      expect(b!.visible).toBeTrue();
      expect(b!.userData['maxTier']).toBe(1);
    });

    it('has a child named "barrelT2" (T2 reinforced barrel)', () => {
      const b = mortarGroup.getObjectByName('barrelT2');
      expect(b).toBeTruthy();
    });

    it('barrelT2 is hidden at creation (minTier=2)', () => {
      const b = mortarGroup.getObjectByName('barrelT2') as THREE.Mesh | undefined;
      expect(b).toBeTruthy();
      expect(b!.visible).toBeFalse();
      expect(b!.userData['minTier']).toBe(2);
    });

    it('has a child named "dualBarrel" (T3 second barrel)', () => {
      const b = mortarGroup.getObjectByName('dualBarrel');
      expect(b).toBeTruthy();
    });

    it('dualBarrel is hidden at creation (minTier=3)', () => {
      const b = mortarGroup.getObjectByName('dualBarrel') as THREE.Mesh | undefined;
      expect(b).toBeTruthy();
      expect(b!.visible).toBeFalse();
      expect(b!.userData['minTier']).toBe(3);
    });

    it('has a child named "cradle" (recoil cradle at barrel base)', () => {
      const cradle = mortarGroup.getObjectByName('cradle');
      expect(cradle).toBeTruthy();
    });

    it('barrelT1, barrelT2 and dualBarrel are children of barrelPivot', () => {
      const pivot = mortarGroup.getObjectByName('barrelPivot')!;
      for (const name of ['barrelT1', 'barrelT2', 'dualBarrel', 'cradle']) {
        const obj = pivot.getObjectByName(name);
        expect(obj).withContext(`${name} should be under barrelPivot`).toBeTruthy();
      }
    });

    it('barrelT1 stores recoilBaseY = barrelT1Length/2 (Finding G-2: delta-based recoil snap)', () => {
      const b = mortarGroup.getObjectByName('barrelT1') as THREE.Mesh | undefined;
      expect(b).toBeTruthy();
      expect(b!.userData['recoilBaseY']).toBeCloseTo(0.55 / 2, 5);
    });

    it('barrelT2 stores recoilBaseY = barrelT2Length/2', () => {
      const b = mortarGroup.getObjectByName('barrelT2') as THREE.Mesh | undefined;
      expect(b).toBeTruthy();
      expect(b!.userData['recoilBaseY']).toBeCloseTo(0.55 / 2, 5);
    });

    it('dualBarrel stores recoilBaseY = barrelT2Length/2 (X offset places barrel side-by-side)', () => {
      const b = mortarGroup.getObjectByName('dualBarrel') as THREE.Mesh | undefined;
      expect(b).toBeTruthy();
      expect(b!.userData['recoilBaseY']).toBeCloseTo(0.55 / 2, 5);
      // X offset (dualBarrelXOffset) places the second barrel beside the first so
      // both barrels read as side-by-side when viewed from the front. Z must be 0.
      expect(b!.position.x).toBeCloseTo(0.14, 4);
      expect(b!.position.z).toBeCloseTo(0.0, 4);
    });

    it('tier visibility — T1: barrelT1 visible, barrelT2 hidden, dualBarrel hidden', () => {
      // Simulate revealTierParts at level 1
      mortarGroup.traverse(obj => {
        const minTier = obj.userData['minTier'] as number | undefined;
        const maxTier = obj.userData['maxTier'] as number | undefined;
        if (minTier !== undefined && maxTier !== undefined) {
          obj.visible = minTier <= 1 && 1 <= maxTier;
        } else if (minTier !== undefined) {
          obj.visible = minTier <= 1;
        } else if (maxTier !== undefined) {
          obj.visible = 1 <= maxTier;
        }
      });

      const b1 = mortarGroup.getObjectByName('barrelT1') as THREE.Mesh;
      const b2 = mortarGroup.getObjectByName('barrelT2') as THREE.Mesh;
      const db = mortarGroup.getObjectByName('dualBarrel') as THREE.Mesh;
      expect(b1.visible).toBeTrue();
      expect(b2.visible).toBeFalse();
      expect(db.visible).toBeFalse();
    });

    it('tier visibility — T2: barrelT1 hidden, barrelT2 visible, dualBarrel hidden', () => {
      mortarGroup.traverse(obj => {
        const minTier = obj.userData['minTier'] as number | undefined;
        const maxTier = obj.userData['maxTier'] as number | undefined;
        if (minTier !== undefined && maxTier !== undefined) {
          obj.visible = minTier <= 2 && 2 <= maxTier;
        } else if (minTier !== undefined) {
          obj.visible = minTier <= 2;
        } else if (maxTier !== undefined) {
          obj.visible = 2 <= maxTier;
        }
      });

      const b1 = mortarGroup.getObjectByName('barrelT1') as THREE.Mesh;
      const b2 = mortarGroup.getObjectByName('barrelT2') as THREE.Mesh;
      const db = mortarGroup.getObjectByName('dualBarrel') as THREE.Mesh;
      expect(b1.visible).toBeFalse();
      expect(b2.visible).toBeTrue();
      expect(db.visible).toBeFalse();
    });

    it('tier visibility — T3: barrelT2 and dualBarrel both visible', () => {
      mortarGroup.traverse(obj => {
        const minTier = obj.userData['minTier'] as number | undefined;
        const maxTier = obj.userData['maxTier'] as number | undefined;
        if (minTier !== undefined && maxTier !== undefined) {
          obj.visible = minTier <= 3 && 3 <= maxTier;
        } else if (minTier !== undefined) {
          obj.visible = minTier <= 3;
        } else if (maxTier !== undefined) {
          obj.visible = 3 <= maxTier;
        }
      });

      const b1 = mortarGroup.getObjectByName('barrelT1') as THREE.Mesh;
      const b2 = mortarGroup.getObjectByName('barrelT2') as THREE.Mesh;
      const db = mortarGroup.getObjectByName('dualBarrel') as THREE.Mesh;
      expect(b1.visible).toBeFalse();
      expect(b2.visible).toBeTrue();
      expect(db.visible).toBeTrue();
    });

    it('registers a fireTick function on userData', () => {
      expect(typeof mortarGroup.userData['fireTick']).toBe('function');
    });

    it('fireTick stores recoilStart, recoilDuration, recoilDistance, and mortarBarrelNames', () => {
      const fire = mortarGroup.userData['fireTick'] as (g: THREE.Group, d: number) => void;
      fire(mortarGroup, 0.15);

      expect(mortarGroup.userData['recoilStart']).toBeDefined();
      expect(mortarGroup.userData['recoilDuration']).toBeCloseTo(0.15, 5);
      expect(mortarGroup.userData['recoilDistance']).toBeCloseTo(MORTAR_RECOIL_CONFIG.distance, 5);
      expect(mortarGroup.userData['mortarBarrelNames']).toEqual(MORTAR_BARREL_NAMES);
    });

    it('recoilDistance is 3× BASIC distance (heavy-artillery feel)', () => {
      const fire = mortarGroup.userData['fireTick'] as (g: THREE.Group, d: number) => void;
      fire(mortarGroup, 0.15);
      // BASIC = 0.05, MORTAR = 0.15 (3× heavier)
      expect(mortarGroup.userData['recoilDistance']).toBeCloseTo(0.15, 5);
      expect(mortarGroup.userData['recoilDistance']).toBeGreaterThan(0.05);
    });

    it('has no legacy MORTAR geometry (no child named "mortarBase" as cylinder + ring)', () => {
      // The redesign replaces legacy cyl-stack with BoxGeometry chassis.
      // Confirm there is no child with the old 4-geometry stack structure:
      // the only "mortarBase" is the swivel housing (a cylinder), which is fine.
      let legacyRingCount = 0;
      mortarGroup.traverse(obj => {
        if (obj.name === 'mortarRing') legacyRingCount++;
      });
      expect(legacyRingCount).toBe(0);
    });

    it('registers an idleTick for the barrel-elevate gesture', () => {
      // Sprint 64: MORTAR barrel slowly elevates at the start of each 4-second idle
      // cycle to suggest shell loading, then returns to base angle.
      expect(typeof mortarGroup.userData['idleTick']).toBe('function');
    });

    it('idleTick moves the barrelPivot rotation.x during the raise window', () => {
      const idleTick = mortarGroup.userData['idleTick'] as (g: THREE.Group, t: number) => void;
      const pivot = mortarGroup.getObjectByName('barrelPivot') as THREE.Group | undefined;
      if (!pivot) pending('barrelPivot not present in mesh — skip');

      // At t=0 the cycle position is 0 (start of raise window, eased value ~0)
      idleTick(mortarGroup, 0);
      const baseRotX = pivot!.rotation.x;

      // At t=0.25 (halfway through the 0.5s raise window) rotation should be > base
      idleTick(mortarGroup, 0.25);
      expect(pivot!.rotation.x).toBeGreaterThan(baseRotX);
    });

    it('body meshes use per-instance materials so muzzle-flash does not cross-contaminate', () => {
      // G-1 regression: body mat must be a per-instance clone, not the registry singleton.
      // If two MORTAR towers share the same material UUID, startMuzzleFlash's
      // save/restore keyed on (child.uuid + mat.uuid) would let MORTAR-A's flash
      // overwrite MORTAR-B's emissive state.
      const mortarGroup2 = service.createTowerMesh(3, 3, TowerType.MORTAR, boardWidth, boardHeight);
      createdGroups.push(mortarGroup2);

      const chassis1 = mortarGroup.children.find(
        c => c instanceof THREE.Mesh && !(c instanceof THREE.PointLight)
      ) as THREE.Mesh | undefined;
      const chassis2 = mortarGroup2.children.find(
        c => c instanceof THREE.Mesh && !(c instanceof THREE.PointLight)
      ) as THREE.Mesh | undefined;

      expect(chassis1).toBeTruthy();
      expect(chassis2).toBeTruthy();
      // Different instances must have different material UUIDs.
      expect((chassis1!.material as THREE.Material).uuid)
        .not.toBe((chassis2!.material as THREE.Material).uuid);
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
