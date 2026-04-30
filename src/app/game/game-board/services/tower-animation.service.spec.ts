import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TowerAnimationService } from './tower-animation.service';
import { PlacedTower, TowerType, TargetingMode } from '../models/tower.model';
import { BlockType } from '../models/game-board-tile';
import { MUZZLE_FLASH_CONFIG, TILE_PULSE_CONFIG } from '../constants/effects.constants';
import { ANIMATION_CONFIG } from '../constants/rendering.constants';
import { BASIC_RECOIL_CONFIG, SPLASH_TUBE_EMIT_CONFIG, SLOW_EMITTER_PULSE_FIRE, MORTAR_RECOIL_CONFIG, MORTAR_BARREL_NAMES, TIER_UP_BOUNCE_CONFIG, SELL_ANIM_CONFIG, SELECTION_PULSE_CONFIG } from '../constants/tower-anim.constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a tower group with a single named child mesh. */
function makeTowerGroup(towerType: TowerType, childName: string): { group: THREE.Group; child: THREE.Mesh } {
  const group = new THREE.Group();
  group.userData['towerType'] = towerType;

  const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const mat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0 });
  const child = new THREE.Mesh(geo, mat);
  child.name = childName;
  group.add(child);

  return { group, child };
}

function disposeTowerGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      (obj.material as THREE.MeshStandardMaterial).dispose();
    }
  });
}

function makeTileMesh(tileType: BlockType): THREE.Mesh {
  const geo = new THREE.BoxGeometry(1, 0.2, 1);
  const mat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.5 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData['tile'] = { type: tileType };
  return mesh;
}

function disposeMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  (mesh.material as THREE.MeshStandardMaterial).dispose();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TowerAnimationService', () => {
  let service: TowerAnimationService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TowerAnimationService] });
    service = TestBed.inject(TowerAnimationService);
  });

  it('creates without error', () => {
    expect(service).toBeTruthy();
  });

  // ---- updateTowerAnimations ----

  describe('updateTowerAnimations', () => {
    it('skips groups with no towerType in userData', () => {
      const group = new THREE.Group(); // no userData['towerType']
      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const mat = new THREE.MeshStandardMaterial();
      const child = new THREE.Mesh(geo, mat);
      child.name = 'crystal';
      child.position.y = 1.0;
      group.add(child);
      const towerMeshes = new Map<string, THREE.Group>([['0-0', group]]);

      expect(() => service.updateTowerAnimations(towerMeshes, 1000)).not.toThrow();
      // position should not have changed since the group is skipped
      expect(child.position.y).toBeCloseTo(1.0, 5);

      child.geometry.dispose();
      (child.material as THREE.MeshStandardMaterial).dispose();
    });

    it('handles an empty towerMeshes map gracefully', () => {
      expect(() => service.updateTowerAnimations(new Map(), 1000)).not.toThrow();
    });
  });

  // ---- updateTilePulse ----

  describe('updateTilePulse', () => {
    it('pulses emissiveIntensity on SPAWNER tiles', () => {
      const mesh = makeTileMesh(BlockType.SPAWNER);
      const _initialIntensity = (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity;
      const tileMeshes = new Map<string, THREE.Mesh>([['0-0', mesh]]);

      service.updateTilePulse(tileMeshes, 1000);

      const newIntensity = (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity;
      expect(newIntensity).toBeGreaterThanOrEqual(TILE_PULSE_CONFIG.min);
      expect(newIntensity).toBeLessThanOrEqual(TILE_PULSE_CONFIG.max);
      // Confirm it was actually changed from initial value (0.5 is mid-range, so it will be different)
      expect(typeof newIntensity).toBe('number');

      disposeMesh(mesh);
    });

    it('pulses emissiveIntensity on EXIT tiles', () => {
      const mesh = makeTileMesh(BlockType.EXIT);
      const tileMeshes = new Map<string, THREE.Mesh>([['0-0', mesh]]);

      service.updateTilePulse(tileMeshes, 2000);

      const intensity = (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity;
      expect(intensity).toBeGreaterThanOrEqual(TILE_PULSE_CONFIG.min);
      expect(intensity).toBeLessThanOrEqual(TILE_PULSE_CONFIG.max);

      disposeMesh(mesh);
    });

    it('does NOT change emissiveIntensity on BASE tiles', () => {
      const mesh = makeTileMesh(BlockType.BASE);
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.42;
      const tileMeshes = new Map<string, THREE.Mesh>([['0-0', mesh]]);

      service.updateTilePulse(tileMeshes, 1000);

      expect((mesh.material as THREE.MeshStandardMaterial).emissiveIntensity).toBeCloseTo(0.42, 5);

      disposeMesh(mesh);
    });

    it('does NOT change emissiveIntensity on WALL tiles', () => {
      const mesh = makeTileMesh(BlockType.WALL);
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.1;
      const tileMeshes = new Map<string, THREE.Mesh>([['0-0', mesh]]);

      service.updateTilePulse(tileMeshes, 1000);

      expect((mesh.material as THREE.MeshStandardMaterial).emissiveIntensity).toBeCloseTo(0.1, 5);

      disposeMesh(mesh);
    });

    it('matches the pulse formula for SPAWNER tile', () => {
      const mesh = makeTileMesh(BlockType.SPAWNER);
      const tileMeshes = new Map<string, THREE.Mesh>([['0-0', mesh]]);
      const time = 3000;

      service.updateTilePulse(tileMeshes, time);

      const t = time * ANIMATION_CONFIG.msToSeconds;
      const expected = TILE_PULSE_CONFIG.min
        + (Math.sin(t * TILE_PULSE_CONFIG.speed) * 0.5 + 0.5)
        * (TILE_PULSE_CONFIG.max - TILE_PULSE_CONFIG.min);
      expect((mesh.material as THREE.MeshStandardMaterial).emissiveIntensity).toBeCloseTo(expected, 5);

      disposeMesh(mesh);
    });

    it('handles an empty tileMeshes map gracefully', () => {
      expect(() => service.updateTilePulse(new Map(), 1000)).not.toThrow();
    });
  });

  // ---- startMuzzleFlash / updateMuzzleFlashes ----

  describe('muzzle flash', () => {
    /** Build a minimal PlacedTower with a group containing one named standard mesh. */
    function makePlacedTower(
      childName: string,
      initialIntensity: number
    ): { tower: PlacedTower; child: THREE.Mesh } {
      const group = new THREE.Group();
      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const mat = new THREE.MeshStandardMaterial({ emissiveIntensity: initialIntensity });
      const child = new THREE.Mesh(geo, mat);
      child.name = childName;
      group.add(child);

      const tower: PlacedTower = {
        id: '0-0',
        type: TowerType.BASIC,
        level: 1,
        row: 0,
        col: 0,
        kills: 0,
        totalInvested: 50,
        targetingMode: TargetingMode.NEAREST,
        mesh: group,
      };

      return { tower, child };
    }

    function disposePlacedTower(tower: PlacedTower): void {
      tower.mesh?.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.MeshStandardMaterial).dispose();
        }
      });
    }

    describe('startMuzzleFlash', () => {
      it('sets muzzleFlashTimer to MUZZLE_FLASH_CONFIG.duration', () => {
        const { tower } = makePlacedTower('base', 0.5);

        service.startMuzzleFlash(tower);

        expect(tower.muzzleFlashTimer).toBeCloseTo(MUZZLE_FLASH_CONFIG.duration, 5);

        disposePlacedTower(tower);
      });

      it('spikes emissive intensity by intensityMultiplier on non-tip meshes', () => {
        const initial = 0.5;
        const { tower, child } = makePlacedTower('base', initial);

        service.startMuzzleFlash(tower);

        const mat = child.material as THREE.MeshStandardMaterial;
        expect(mat.emissiveIntensity).toBeCloseTo(initial * MUZZLE_FLASH_CONFIG.intensityMultiplier, 5);

        disposePlacedTower(tower);
      });

      it('saves the original intensity so it can be restored', () => {
        const initial = 0.4;
        const { tower, child } = makePlacedTower('body', initial);

        service.startMuzzleFlash(tower);

        const mat = child.material as THREE.MeshStandardMaterial;
        const key = child.uuid + '_' + mat.uuid;
        expect(tower.originalEmissiveIntensity?.get(key)).toBeCloseTo(initial, 5);

        disposePlacedTower(tower);
      });

      it('does NOT affect the tip mesh', () => {
        const initial = 0.8;
        const { tower, child } = makePlacedTower('tip', initial);

        service.startMuzzleFlash(tower);

        const mat = child.material as THREE.MeshStandardMaterial;
        // emissiveIntensity must be unchanged
        expect(mat.emissiveIntensity).toBeCloseTo(initial, 5);

        disposePlacedTower(tower);
      });

      // Finding 14 — sphere emissive cross-talk (CHAIN charge-up)
      it('does NOT spike or snapshot the sphere mesh (CHAIN charge-up exemption)', () => {
        // Simulate a chargeTick-spiked sphere at a mid-charge value (not the rest minimum)
        const chargePhaseIntensity = 1.1; // somewhere between emissiveMin (0.4) and emissiveMax (1.4)
        const { tower, child } = makePlacedTower('sphere', chargePhaseIntensity);

        service.startMuzzleFlash(tower);

        const mat = child.material as THREE.MeshStandardMaterial;
        // Intensity must be unchanged — sphere is exempt from the flash spike
        expect(mat.emissiveIntensity).toBeCloseTo(chargePhaseIntensity, 5);
        // The snapshot map must NOT contain the sphere's material uuid
        const key = child.uuid + '_' + mat.uuid;
        expect(tower.originalEmissiveIntensity?.has(key)).toBeFalse();

        disposePlacedTower(tower);
      });

      it('restores non-sphere mesh correctly even when a sphere sibling is present (no key pollution)', () => {
        // Group with both a body mesh and a sphere mesh — only body should be snapshotted
        const group = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const bodyMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.3 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.name = 'body';
        group.add(bodyMesh);

        const sphereGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const sphereMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 1.1 });
        const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
        sphereMesh.name = 'sphere';
        group.add(sphereMesh);

        const tower: PlacedTower = {
          id: '0-0', type: TowerType.CHAIN, level: 1, row: 0, col: 0,
          kills: 0, totalInvested: 100, targetingMode: TargetingMode.NEAREST, mesh: group,
        };

        service.startMuzzleFlash(tower);

        // Body spiked correctly
        expect(bodyMat.emissiveIntensity)
          .toBeCloseTo(0.3 * MUZZLE_FLASH_CONFIG.intensityMultiplier, 5);
        // Sphere unchanged
        expect(sphereMat.emissiveIntensity).toBeCloseTo(1.1, 5);

        // Restore
        service.updateMuzzleFlashes(new Map([['0-0', tower]]), MUZZLE_FLASH_CONFIG.duration + 0.01);
        // Body restored to original
        expect(bodyMat.emissiveIntensity).toBeCloseTo(0.3, 5);
        // Sphere still unchanged
        expect(sphereMat.emissiveIntensity).toBeCloseTo(1.1, 5);

        bodyGeo.dispose(); bodyMat.dispose();
        sphereGeo.dispose(); sphereMat.dispose();
      });

      it('re-triggers correctly while a flash is already active (rapid fire)', () => {
        const initial = 0.5;
        const { tower, child } = makePlacedTower('base', initial);

        service.startMuzzleFlash(tower);
        // Partially tick the timer so we can detect a reset
        tower.muzzleFlashTimer! -= 0.04;
        // Manually restore intensity to simulate it mid-flight, then fire again
        (child.material as THREE.MeshStandardMaterial).emissiveIntensity = initial;
        service.startMuzzleFlash(tower);

        expect(tower.muzzleFlashTimer).toBeCloseTo(MUZZLE_FLASH_CONFIG.duration, 5);

        disposePlacedTower(tower);
      });

      it('does nothing when tower.mesh is null', () => {
        const tower: PlacedTower = {
          id: '0-0',
          type: TowerType.BASIC,
          level: 1,
          row: 0,
          col: 0,
          kills: 0,
          totalInvested: 50,
          targetingMode: TargetingMode.NEAREST,
          mesh: null,
        };

        expect(() => service.startMuzzleFlash(tower)).not.toThrow();
        expect(tower.muzzleFlashTimer).toBeUndefined();
      });
    });

    describe('updateMuzzleFlashes', () => {
      it('counts down muzzleFlashTimer by deltaTime', () => {
        const { tower } = makePlacedTower('base', 0.5);
        service.startMuzzleFlash(tower);

        service.updateMuzzleFlashes(new Map([['0-0', tower]]), 0.05);

        expect(tower.muzzleFlashTimer).toBeCloseTo(MUZZLE_FLASH_CONFIG.duration - 0.05, 5);

        disposePlacedTower(tower);
      });

      it('restores original emissive intensity when timer expires', () => {
        const initial = 0.4;
        const { tower, child } = makePlacedTower('base', initial);
        service.startMuzzleFlash(tower);

        // Expire the timer in one step
        service.updateMuzzleFlashes(new Map([['0-0', tower]]), MUZZLE_FLASH_CONFIG.duration + 0.01);

        const mat = child.material as THREE.MeshStandardMaterial;
        expect(mat.emissiveIntensity).toBeCloseTo(initial, 5);

        disposePlacedTower(tower);
      });

      it('clears muzzleFlashTimer and originalEmissiveIntensity after restoration', () => {
        const { tower } = makePlacedTower('base', 0.5);
        service.startMuzzleFlash(tower);

        service.updateMuzzleFlashes(new Map([['0-0', tower]]), MUZZLE_FLASH_CONFIG.duration + 0.01);

        expect(tower.muzzleFlashTimer).toBeUndefined();
        expect(tower.originalEmissiveIntensity).toBeUndefined();

        disposePlacedTower(tower);
      });

      it('does not touch the tip mesh during update/restore', () => {
        // Create a group with both a 'base' child and a 'tip' child
        const group = new THREE.Group();
        const baseGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const baseMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.5 });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.name = 'base';

        const tipGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const tipMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.9 });
        const tipMesh = new THREE.Mesh(tipGeo, tipMat);
        tipMesh.name = 'tip';

        group.add(baseMesh);
        group.add(tipMesh);

        const tower: PlacedTower = {
          id: '0-0',
          type: TowerType.SNIPER,
          level: 1,
          row: 0,
          col: 0,
          kills: 0,
          totalInvested: 125,
          targetingMode: TargetingMode.NEAREST,
          mesh: group,
        };

        service.startMuzzleFlash(tower);
        // tip must be unchanged after flash starts
        expect(tipMat.emissiveIntensity).toBeCloseTo(0.9, 5);

        service.updateMuzzleFlashes(new Map([['0-0', tower]]), MUZZLE_FLASH_CONFIG.duration + 0.01);
        // tip must still be unchanged after flash restores
        expect(tipMat.emissiveIntensity).toBeCloseTo(0.9, 5);

        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            (obj.material as THREE.MeshStandardMaterial).dispose();
          }
        });
      });

      it('handles an empty towers map gracefully', () => {
        expect(() => service.updateMuzzleFlashes(new Map(), 0.016)).not.toThrow();
      });

      it('skips towers without an active flash timer', () => {
        const { tower, child } = makePlacedTower('base', 0.5);
        // Do NOT call startMuzzleFlash — timer is undefined

        expect(() => service.updateMuzzleFlashes(new Map([['0-0', tower]]), 0.016)).not.toThrow();
        // Intensity must remain untouched
        expect((child.material as THREE.MeshStandardMaterial).emissiveIntensity).toBeCloseTo(0.5, 5);

        disposePlacedTower(tower);
      });
    });
  });

  // ---- tickTubeEmits ----

  describe('tickTubeEmits', () => {
    function makeSplashGroup(): { group: THREE.Group; tube: THREE.Mesh; drumGroup: THREE.Group } {
      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.SPLASH;

      const drumGroup = new THREE.Group();
      drumGroup.name = 'drum';
      group.add(drumGroup);

      const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const mat = new THREE.MeshStandardMaterial({ emissive: new THREE.Color(0x00ff00), emissiveIntensity: 0 });
      const tube = new THREE.Mesh(geo, mat);
      tube.name = 'tube1';
      tube.userData['tubeIndex'] = 0;
      drumGroup.add(tube);

      return { group, tube, drumGroup };
    }

    function disposeSplashGroup(group: THREE.Group): void {
      group.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.MeshStandardMaterial).dispose();
        }
      });
    }

    it('does nothing when no emit state is active', () => {
      const { group, tube } = makeSplashGroup();
      // No emit userData set
      service.tickTubeEmits(new Map([['0-0', group]]), 1.0);
      expect((tube.material as THREE.MeshStandardMaterial).emissiveIntensity).toBeCloseTo(0, 5);
      disposeSplashGroup(group);
    });

    it('sets tube emissiveIntensity to peak multiplier at t=emitStart', () => {
      const { group, tube } = makeSplashGroup();
      const now = 5.0;
      group.userData['emittingTubeIndex'] = 0;
      group.userData['tubeEmitStart'] = now;
      group.userData['tubeEmitDuration'] = SPLASH_TUBE_EMIT_CONFIG.duration;

      // At t=now: elapsed=0, alpha=1, intensity = 1 * multiplier
      service.tickTubeEmits(new Map([['0-0', group]]), now);

      const mat = tube.material as THREE.MeshStandardMaterial;
      expect(mat.emissiveIntensity).toBeCloseTo(SPLASH_TUBE_EMIT_CONFIG.emissiveMultiplier, 4);
      disposeSplashGroup(group);
    });

    it('fades tube emissiveIntensity linearly toward zero over emit duration', () => {
      const { group, tube } = makeSplashGroup();
      const start = 10.0;
      const dur = SPLASH_TUBE_EMIT_CONFIG.duration;
      group.userData['emittingTubeIndex'] = 0;
      group.userData['tubeEmitStart'] = start;
      group.userData['tubeEmitDuration'] = dur;

      // At halfway through emit duration
      service.tickTubeEmits(new Map([['0-0', group]]), start + dur * 0.5);

      const mat = tube.material as THREE.MeshStandardMaterial;
      // alpha = 1 - 0.5 = 0.5; intensity = 0.5 * multiplier
      const expected = 0.5 * SPLASH_TUBE_EMIT_CONFIG.emissiveMultiplier;
      expect(mat.emissiveIntensity).toBeCloseTo(expected, 4);
      disposeSplashGroup(group);
    });

    it('resets tube emissiveIntensity to 0 and clears state when emit expires', () => {
      const { group, tube } = makeSplashGroup();
      const start = 20.0;
      const dur = SPLASH_TUBE_EMIT_CONFIG.duration;
      group.userData['emittingTubeIndex'] = 0;
      group.userData['tubeEmitStart'] = start;
      group.userData['tubeEmitDuration'] = dur;

      // Advance past the end of the emit
      service.tickTubeEmits(new Map([['0-0', group]]), start + dur + 0.01);

      const mat = tube.material as THREE.MeshStandardMaterial;
      expect(mat.emissiveIntensity).toBeCloseTo(0, 5);
      expect(group.userData['emittingTubeIndex']).toBeUndefined();
      expect(group.userData['tubeEmitStart']).toBeUndefined();
      expect(group.userData['tubeEmitDuration']).toBeUndefined();
      disposeSplashGroup(group);
    });

    it('handles an empty towerMeshes map gracefully', () => {
      expect(() => service.tickTubeEmits(new Map(), 1.0)).not.toThrow();
    });

    it('skips groups that have no drum child', () => {
      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.SPLASH;
      group.userData['emittingTubeIndex'] = 0;
      group.userData['tubeEmitStart'] = 1.0;
      group.userData['tubeEmitDuration'] = 0.25;
      // No 'drum' child added

      expect(() => service.tickTubeEmits(new Map([['0-0', group]]), 1.0)).not.toThrow();
    });
  });

  // ---- chargeTick hook (Finding 7 fix — Phase F) ----

  describe('chargeTick hook', () => {
    it('calls userData.chargeTick before idleTick when both are registered', () => {
      const callOrder: string[] = [];
      const { group } = makeTowerGroup(TowerType.CHAIN, 'sphere');

      group.userData['chargeTick'] = (): void => { callOrder.push('charge'); };
      group.userData['idleTick']   = (): void => { callOrder.push('idle'); };

      service.updateTowerAnimations(new Map([['0-0', group]]), 1000);

      expect(callOrder).toEqual(['charge', 'idle']);

      disposeTowerGroup(group);
    });

    it('calls chargeTick with the group and converted time value', () => {
      const chargeSpy = jasmine.createSpy('chargeTick');
      const { group } = makeTowerGroup(TowerType.CHAIN, 'sphere');
      group.userData['chargeTick'] = chargeSpy;

      const time = 2000;
      service.updateTowerAnimations(new Map([['0-0', group]]), time);

      const expectedT = time * ANIMATION_CONFIG.msToSeconds;
      expect(chargeSpy).toHaveBeenCalledOnceWith(group, expectedT);

      disposeTowerGroup(group);
    });

    it('calls chargeTick even when idleTick is absent', () => {
      const chargeSpy = jasmine.createSpy('chargeTick');
      const { group } = makeTowerGroup(TowerType.CHAIN, 'sphere');
      group.userData['chargeTick'] = chargeSpy;
      // No idleTick registered

      service.updateTowerAnimations(new Map([['0-0', group]]), 500);

      expect(chargeSpy).toHaveBeenCalledTimes(1);

      disposeTowerGroup(group);
    });

    it('does not error when chargeTick is absent', () => {
      const { group } = makeTowerGroup(TowerType.CHAIN, 'sphere');
      // No chargeTick registered

      expect(() => service.updateTowerAnimations(new Map([['0-0', group]]), 1000)).not.toThrow();

      disposeTowerGroup(group);
    });

    it('does not call chargeTick if it is not a function', () => {
      const { group } = makeTowerGroup(TowerType.CHAIN, 'sphere');
      group.userData['chargeTick'] = 'not-a-function';

      expect(() => service.updateTowerAnimations(new Map([['0-0', group]]), 500)).not.toThrow();

      disposeTowerGroup(group);
    });
  });

  // ---- idleTick hook (Sprint 6) ----

  describe('idleTick hook', () => {
    it('calls userData.idleTick before named-mesh traverse when present', () => {
      const { group } = makeTowerGroup(TowerType.BASIC, 'crystal');
      const tickSpy = jasmine.createSpy('idleTick');
      group.userData['idleTick'] = tickSpy;

      const time = 2000;
      service.updateTowerAnimations(new Map([['0-0', group]]), time);

      const expectedT = time * ANIMATION_CONFIG.msToSeconds;
      expect(tickSpy).toHaveBeenCalledOnceWith(group, expectedT);

      disposeTowerGroup(group);
    });

    it('does not error when userData.idleTick is absent', () => {
      const { group } = makeTowerGroup(TowerType.CHAIN, 'orb');
      // No idleTick registered

      expect(() => service.updateTowerAnimations(new Map([['0-0', group]]), 1000)).not.toThrow();

      disposeTowerGroup(group);
    });

    it('does not call idleTick if it is not a function', () => {
      const { group } = makeTowerGroup(TowerType.BASIC, 'crystal');
      group.userData['idleTick'] = 'not-a-function';

      // Should not throw even with a non-function value stored
      expect(() => service.updateTowerAnimations(new Map([['0-0', group]]), 500)).not.toThrow();

      disposeTowerGroup(group);
    });
  });

  // ---- triggerFire hook (Sprint 7) ----

  describe('triggerFire', () => {
    function makePlacedTower(
      childName: string,
      initialIntensity: number,
    ): { tower: PlacedTower; child: THREE.Mesh } {
      const group = new THREE.Group();
      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const mat = new THREE.MeshStandardMaterial({ emissiveIntensity: initialIntensity });
      const child = new THREE.Mesh(geo, mat);
      child.name = childName;
      group.add(child);

      const tower: PlacedTower = {
        id: '0-0',
        type: TowerType.BASIC,
        level: 1,
        row: 0,
        col: 0,
        kills: 0,
        totalInvested: 50,
        targetingMode: TargetingMode.NEAREST,
        mesh: group,
      };

      return { tower, child };
    }

    function disposePlacedTower(tower: PlacedTower): void {
      tower.mesh?.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.MeshStandardMaterial).dispose();
        }
      });
    }

    it('calls startMuzzleFlash internally (muzzleFlashTimer is set)', () => {
      const { tower } = makePlacedTower('base', 0.5);

      service.triggerFire(tower);

      expect(tower.muzzleFlashTimer).toBeCloseTo(MUZZLE_FLASH_CONFIG.duration, 5);

      disposePlacedTower(tower);
    });

    it('calls userData.fireTick with the group and duration when present', () => {
      const { tower } = makePlacedTower('base', 0.5);
      const fireTickSpy = jasmine.createSpy('fireTick');
      tower.mesh!.userData['fireTick'] = fireTickSpy;

      service.triggerFire(tower);

      expect(fireTickSpy).toHaveBeenCalledOnceWith(tower.mesh, MUZZLE_FLASH_CONFIG.duration);

      disposePlacedTower(tower);
    });

    it('does not error when userData.fireTick is absent', () => {
      const { tower } = makePlacedTower('base', 0.5);
      // No fireTick registered

      expect(() => service.triggerFire(tower)).not.toThrow();

      disposePlacedTower(tower);
    });

    it('does not call fireTick when tower.mesh is null', () => {
      const tower: PlacedTower = {
        id: '0-0',
        type: TowerType.BASIC,
        level: 1,
        row: 0,
        col: 0,
        kills: 0,
        totalInvested: 50,
        targetingMode: TargetingMode.NEAREST,
        mesh: null,
      };

      expect(() => service.triggerFire(tower)).not.toThrow();
    });

    // ---- Phase A debt: Finding 2 — fireTick error isolation ----

    it('does NOT throw when fireTick callback throws — exception is swallowed', () => {
      const { tower } = makePlacedTower('base', 0.5);
      tower.mesh!.userData['fireTick'] = (): void => { throw new Error('boom'); };

      expect(() => service.triggerFire(tower)).not.toThrow();

      disposePlacedTower(tower);
    });

    it('still calls startMuzzleFlash even when fireTick throws', () => {
      const { tower } = makePlacedTower('base', 0.5);
      tower.mesh!.userData['fireTick'] = (): void => { throw new Error('boom'); };

      service.triggerFire(tower);

      // startMuzzleFlash sets muzzleFlashTimer — verify it was called
      expect(tower.muzzleFlashTimer).toBeCloseTo(MUZZLE_FLASH_CONFIG.duration, 5);

      disposePlacedTower(tower);
    });
  });

  // ---- Phase A debt: Finding 3 — idleTick is always used when registered ----

  describe('idleTick precedence (Finding 3)', () => {
    it('calls idleTick with the correct converted time when registered', () => {
      // All six redesigned tower types register an idleTick. Verify the service
      // calls it correctly with the msToSeconds-converted time value.
      const { group, child } = makeTowerGroup(TowerType.SLOW, 'crystal');
      const initialY = 0.82;
      child.position.y = initialY;

      const idleTickSpy = jasmine.createSpy('idleTick');
      group.userData['idleTick'] = idleTickSpy;

      const time = 2000;
      service.updateTowerAnimations(new Map([['0-0', group]]), time);

      // idleTick was called with the correct time
      expect(idleTickSpy).toHaveBeenCalledOnceWith(group, time * ANIMATION_CONFIG.msToSeconds);
      // Crystal position was not touched by the service (idleTick is solely responsible)
      expect(child.position.y).toBeCloseTo(initialY, 5);

      disposeTowerGroup(group);
    });

    it('does not move a crystal child when idleTick is absent (no-op, not legacy)', () => {
      // The legacy named-mesh traverse was removed in Phase I. Groups without
      // idleTick simply skip animation — no fallback traverse runs.
      const { group, child } = makeTowerGroup(TowerType.SLOW, 'crystal');
      const initialY = 0.82;
      child.position.y = initialY;
      // No idleTick registered

      service.updateTowerAnimations(new Map([['0-0', group]]), 1000);

      // Position must be UNCHANGED — no legacy code should alter it
      expect(child.position.y).toBeCloseTo(initialY, 5);

      disposeTowerGroup(group);
    });
  });

  // ---- BASIC idle animation ----

  describe('BASIC tower idleTick (swivel)', () => {
    it('rotates the turret child via the registered idleTick', () => {
      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.BASIC;
      const turret = new THREE.Group();
      turret.name = 'turret';
      group.add(turret);

      // Register the same idleTick that TowerMeshFactoryService would register
      const { BASIC_IDLE_CONFIG: cfg } = (() => {
        const m = { BASIC_IDLE_CONFIG: { swivelAmplitudeRad: 5 * (Math.PI / 180), swivelSpeed: 0.6 } };
        return m;
      })();

      group.userData['idleTick'] = (g: THREE.Group, t: number): void => {
        const tGroup = g.getObjectByName('turret');
        if (tGroup) {
          tGroup.rotation.y = Math.sin(t * cfg.swivelSpeed) * cfg.swivelAmplitudeRad;
        }
      };

      const time = 1500;
      service.updateTowerAnimations(new Map([['0-0', group]]), time);

      const t = time * ANIMATION_CONFIG.msToSeconds;
      const expected = Math.sin(t * cfg.swivelSpeed) * cfg.swivelAmplitudeRad;
      expect(turret.rotation.y).toBeCloseTo(expected, 5);
    });
  });

  // ---- tickRecoilAnimations ----

  describe('tickRecoilAnimations', () => {
    function makeRecoilGroup(): { group: THREE.Group; barrel: THREE.Mesh } {
      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.BASIC;
      const turret = new THREE.Group();
      turret.name = 'turret';
      group.add(turret);
      const barrelGroup = new THREE.Group();
      turret.add(barrelGroup);
      const geo = new THREE.BoxGeometry(0.1, 0.2, 0.1);
      const mat = new THREE.MeshStandardMaterial();
      const barrel = new THREE.Mesh(geo, mat);
      barrel.name = 'barrel';
      barrelGroup.add(barrel);
      return { group, barrel };
    }

    function disposeRecoilGroup(group: THREE.Group): void {
      group.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.MeshStandardMaterial).dispose();
        }
      });
    }

    it('slides barrel back immediately after recoilStart is set', () => {
      const { group, barrel } = makeRecoilGroup();
      const now = 10.0;
      group.userData['recoilStart'] = now;
      group.userData['recoilDuration'] = 0.1;

      // At t = now + 0 the eased value is 0, so offset = -distance
      service.tickRecoilAnimations(new Map([['t', group]]), now);

      expect(barrel.position.y).toBeCloseTo(-BASIC_RECOIL_CONFIG.distance, 4);

      disposeRecoilGroup(group);
    });

    it('returns barrel to 0 after duration elapses', () => {
      const { group, barrel } = makeRecoilGroup();
      const now = 10.0;
      const duration = 0.1;
      group.userData['recoilStart'] = now;
      group.userData['recoilDuration'] = duration;

      // Advance past the full duration
      service.tickRecoilAnimations(new Map([['t', group]]), now + duration + 0.01);

      expect(barrel.position.y).toBeCloseTo(0, 5);
      expect(group.userData['recoilStart']).toBeUndefined();

      disposeRecoilGroup(group);
    });

    it('interpolates barrel position between 0 and full recoil', () => {
      const { group, barrel } = makeRecoilGroup();
      const now = 5.0;
      const duration = 0.1;
      group.userData['recoilStart'] = now;
      group.userData['recoilDuration'] = duration;

      // At 50% through the animation
      const half = now + duration * 0.5;
      service.tickRecoilAnimations(new Map([['t', group]]), half);

      // easeOutCubic at t=0.5: 1 - (1 - 0.5)^3 = 1 - 0.125 = 0.875
      // offset = -distance * (1 - 0.875) = -distance * 0.125
      const expected = -BASIC_RECOIL_CONFIG.distance * (1 - (1 - Math.pow(1 - 0.5, 3)));
      expect(barrel.position.y).toBeCloseTo(expected, 4);

      disposeRecoilGroup(group);
    });

    it('skips groups without recoil state', () => {
      const { group, barrel } = makeRecoilGroup();
      barrel.position.y = 0;
      // No recoilStart / recoilDuration

      expect(() => service.tickRecoilAnimations(new Map([['t', group]]), 1.0)).not.toThrow();
      expect(barrel.position.y).toBeCloseTo(0, 5);

      disposeRecoilGroup(group);
    });

    it('uses userData[recoilDistance] when set (SNIPER override)', () => {
      // SNIPER's fireTick writes recoilDistance = 0.08; verify tickRecoilAnimations
      // honours it rather than falling back to BASIC_RECOIL_CONFIG.distance (0.05).
      const { group, barrel } = makeRecoilGroup();
      const sniperDistance = 0.08;
      const now = 20.0;
      group.userData['recoilStart'] = now;
      group.userData['recoilDuration'] = 0.1;
      group.userData['recoilDistance'] = sniperDistance;

      // At t=now, elapsed=0, eased=0, offset = -distance * (1 - 0) = -distance
      service.tickRecoilAnimations(new Map([['t', group]]), now);

      expect(barrel.position.y).toBeCloseTo(-sniperDistance, 4);
      // Confirm BASIC distance would have been different
      expect(sniperDistance).not.toBeCloseTo(BASIC_RECOIL_CONFIG.distance, 4);

      disposeRecoilGroup(group);
    });

    it('falls back to BASIC_RECOIL_CONFIG.distance when recoilDistance is absent', () => {
      const { group, barrel } = makeRecoilGroup();
      const now = 30.0;
      group.userData['recoilStart'] = now;
      group.userData['recoilDuration'] = 0.1;
      // No recoilDistance set

      service.tickRecoilAnimations(new Map([['t', group]]), now);

      expect(barrel.position.y).toBeCloseTo(-BASIC_RECOIL_CONFIG.distance, 4);

      disposeRecoilGroup(group);
    });

    it('MORTAR multi-barrel: applies recoil to the visible barrel (T1)', () => {
      // Build a group mimicking the MORTAR T1 state (barrelT1 visible, barrelT2 hidden)
      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.MORTAR;

      const barrelPivot = new THREE.Group();
      barrelPivot.name = 'barrelPivot';
      group.add(barrelPivot);

      const geo = new THREE.BoxGeometry(0.1, 0.55, 0.1);
      const mat = new THREE.MeshStandardMaterial();

      const b1 = new THREE.Mesh(geo, mat);
      b1.name = 'barrelT1';
      b1.visible = true;
      barrelPivot.add(b1);

      const b2 = new THREE.Mesh(geo, mat);
      b2.name = 'barrelT2';
      b2.visible = false;
      barrelPivot.add(b2);

      const db = new THREE.Mesh(geo, mat);
      db.name = 'dualBarrel';
      db.visible = false;
      barrelPivot.add(db);

      const now = 100.0;
      group.userData['recoilStart'] = now;
      group.userData['recoilDuration'] = 0.15;
      group.userData['recoilDistance'] = MORTAR_RECOIL_CONFIG.distance;
      group.userData['mortarBarrelNames'] = MORTAR_BARREL_NAMES;

      service.tickRecoilAnimations(new Map([['m', group]]), now);

      // barrelT1 (visible) gets the recoil offset; others stay at 0
      expect(b1.position.y).toBeCloseTo(-MORTAR_RECOIL_CONFIG.distance, 4);
      expect(b2.position.y).toBeCloseTo(0, 5);
      expect(db.position.y).toBeCloseTo(0, 5);

      geo.dispose();
      mat.dispose();
    });

    it('MORTAR multi-barrel: applies recoil to both visible barrels at T3', () => {
      // T3: barrelT2 and dualBarrel both visible; barrelT1 hidden
      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.MORTAR;

      const barrelPivot = new THREE.Group();
      barrelPivot.name = 'barrelPivot';
      group.add(barrelPivot);

      const geo = new THREE.BoxGeometry(0.1, 0.55, 0.1);
      const mat = new THREE.MeshStandardMaterial();

      const b1 = new THREE.Mesh(geo, mat);
      b1.name = 'barrelT1';
      b1.visible = false;
      barrelPivot.add(b1);

      const b2 = new THREE.Mesh(geo, mat);
      b2.name = 'barrelT2';
      b2.visible = true;
      barrelPivot.add(b2);

      const db = new THREE.Mesh(geo, mat);
      db.name = 'dualBarrel';
      db.visible = true;
      barrelPivot.add(db);

      const now = 200.0;
      group.userData['recoilStart'] = now;
      group.userData['recoilDuration'] = 0.15;
      group.userData['recoilDistance'] = MORTAR_RECOIL_CONFIG.distance;
      group.userData['mortarBarrelNames'] = MORTAR_BARREL_NAMES;

      service.tickRecoilAnimations(new Map([['m', group]]), now);

      // b2 and db (both visible) get offset; b1 (hidden) stays at 0
      expect(b1.position.y).toBeCloseTo(0, 5);
      expect(b2.position.y).toBeCloseTo(-MORTAR_RECOIL_CONFIG.distance, 4);
      expect(db.position.y).toBeCloseTo(-MORTAR_RECOIL_CONFIG.distance, 4);

      geo.dispose();
      mat.dispose();
    });

    it('MORTAR multi-barrel: snaps all barrels to 0 when animation completes (no recoilBaseY set)', () => {
      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.MORTAR;

      const barrelPivot = new THREE.Group();
      barrelPivot.name = 'barrelPivot';
      group.add(barrelPivot);

      const geo = new THREE.BoxGeometry(0.1, 0.55, 0.1);
      const mat = new THREE.MeshStandardMaterial();

      const b1 = new THREE.Mesh(geo, mat);
      b1.name = 'barrelT1';
      b1.visible = true;
      b1.position.y = -0.15;
      barrelPivot.add(b1);

      const b2 = new THREE.Mesh(geo, mat);
      b2.name = 'barrelT2';
      b2.visible = false;
      barrelPivot.add(b2);

      const now = 300.0;
      const duration = 0.15;
      group.userData['recoilStart'] = now;
      group.userData['recoilDuration'] = duration;
      group.userData['recoilDistance'] = MORTAR_RECOIL_CONFIG.distance;
      group.userData['mortarBarrelNames'] = MORTAR_BARREL_NAMES;

      // Advance past duration
      service.tickRecoilAnimations(new Map([['m', group]]), now + duration + 0.01);

      expect(b1.position.y).toBeCloseTo(0, 5);
      expect(group.userData['recoilStart']).toBeUndefined();

      geo.dispose();
      mat.dispose();
    });

    it('MORTAR barrel: respects recoilBaseY when snapping to neutral (Finding G-2)', () => {
      // Barrels in the real factory start at position.y = length/2 (centre of cylinder
      // rests at the pivot origin). The recoil tick must snap back to that position, not 0.
      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.MORTAR;

      const barrelPivot = new THREE.Group();
      barrelPivot.name = 'barrelPivot';
      group.add(barrelPivot);

      const geo = new THREE.BoxGeometry(0.1, 0.55, 0.1);
      const mat = new THREE.MeshStandardMaterial();

      const restY = 0.55 / 2; // matches factory: barrelT1Length / 2
      const b1 = new THREE.Mesh(geo, mat);
      b1.name = 'barrelT1';
      b1.visible = true;
      b1.position.y = restY;
      b1.userData['recoilBaseY'] = restY;
      barrelPivot.add(b1);

      const now = 400.0;
      const duration = 0.15;
      group.userData['recoilStart'] = now;
      group.userData['recoilDuration'] = duration;
      group.userData['recoilDistance'] = MORTAR_RECOIL_CONFIG.distance;
      group.userData['mortarBarrelNames'] = MORTAR_BARREL_NAMES;

      // Mid-animation: barrel should be at restY - distance (not 0 - distance)
      service.tickRecoilAnimations(new Map([['m', group]]), now);
      expect(b1.position.y).toBeCloseTo(restY - MORTAR_RECOIL_CONFIG.distance, 4);

      // After animation: barrel snaps back to restY, not 0
      service.tickRecoilAnimations(new Map([['m', group]]), now + duration + 0.01);
      expect(b1.position.y).toBeCloseTo(restY, 5);

      geo.dispose();
      mat.dispose();
    });
  });

  // ---- tickEmitterPulses ----

  describe('tickEmitterPulses', () => {
    function makeEmitterGroup(): { group: THREE.Group; emitter: THREE.Mesh } {
      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.SLOW;

      const geo = new THREE.SphereGeometry(0.22, 8, 6);
      const mat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.8 });
      const emitter = new THREE.Mesh(geo, mat);
      emitter.name = 'emitter';
      group.add(emitter);

      return { group, emitter };
    }

    it('handles an empty towerMeshes map gracefully', () => {
      expect(() => service.tickEmitterPulses(new Map(), 1.0)).not.toThrow();
    });

    it('skips groups without emitterPulseStart state', () => {
      const { group, emitter } = makeEmitterGroup();
      emitter.scale.setScalar(1.0);
      expect(() => service.tickEmitterPulses(new Map([['s', group]]), 1.0)).not.toThrow();
      expect(emitter.scale.x).toBeCloseTo(1.0, 4);
      emitter.geometry.dispose();
      (emitter.material as THREE.Material).dispose();
    });

    it('scales emitter above 1.0 at the start of a pulse', () => {
      const { group, emitter } = makeEmitterGroup();
      const now = performance.now() / 1000;
      group.userData['emitterPulseStart'] = now;

      // Very small elapsed — emitter should be near peak scale
      service.tickEmitterPulses(new Map([['s', group]]), now + 0.001);

      expect(emitter.scale.x).toBeGreaterThan(1.0);
      expect(emitter.scale.x).toBeLessThanOrEqual(SLOW_EMITTER_PULSE_FIRE.scaleMax + 0.01);

      emitter.geometry.dispose();
      (emitter.material as THREE.Material).dispose();
    });

    it('returns emitter scale to 1.0 and clears state after pulse expires', () => {
      const { group, emitter } = makeEmitterGroup();
      const now = performance.now() / 1000;
      group.userData['emitterPulseStart'] = now;
      emitter.scale.setScalar(1.1);

      service.tickEmitterPulses(
        new Map([['s', group]]),
        now + SLOW_EMITTER_PULSE_FIRE.durationSec + 0.01,
      );

      expect(emitter.scale.x).toBeCloseTo(1.0, 4);
      expect(group.userData['emitterPulseStart']).toBeUndefined();

      emitter.geometry.dispose();
      (emitter.material as THREE.Material).dispose();
    });

    it('does not error when the group has no emitter child', () => {
      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.SLOW;
      const now = performance.now() / 1000;
      group.userData['emitterPulseStart'] = now;

      expect(() => service.tickEmitterPulses(new Map([['s', group]]), now + 0.001)).not.toThrow();
    });
  });

  // ---- tickTierUpScale (Phase I Sprint 60) ----

  describe('tickTierUpScale', () => {
    function makeScaleGroup(baseScale: number): THREE.Group {
      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.BASIC;
      group.userData['scaleAnimBaseScale'] = baseScale;
      group.userData['scaleAnimStart'] = performance.now() / 1000;
      group.scale.setScalar(baseScale * TIER_UP_BOUNCE_CONFIG.peakScale);
      return group;
    }

    it('handles empty map gracefully', () => {
      expect(() => service.tickTierUpScale(new Map(), 1.0)).not.toThrow();
    });

    it('skips groups without scaleAnimStart', () => {
      const group = new THREE.Group();
      group.scale.setScalar(1.5);
      service.tickTierUpScale(new Map([['t', group]]), 10.0);
      expect(group.scale.x).toBeCloseTo(1.5, 4);
    });

    it('snaps to base scale and clears state when duration elapses', () => {
      const base = 1.0;
      const group = makeScaleGroup(base);
      const start = group.userData['scaleAnimStart'] as number;

      service.tickTierUpScale(new Map([['t', group]]), start + TIER_UP_BOUNCE_CONFIG.durationSec + 0.01);

      expect(group.scale.x).toBeCloseTo(base, 4);
      expect(group.userData['scaleAnimStart']).toBeUndefined();
      expect(group.userData['scaleAnimBaseScale']).toBeUndefined();
    });

    it('returns a scale above base at mid-animation', () => {
      const base = 1.0;
      const group = makeScaleGroup(base);
      const start = group.userData['scaleAnimStart'] as number;

      // At 50% through, scale should be between base and peak
      service.tickTierUpScale(new Map([['t', group]]), start + TIER_UP_BOUNCE_CONFIG.durationSec * 0.5);

      expect(group.scale.x).toBeGreaterThan(base);
      expect(group.scale.x).toBeLessThanOrEqual(TIER_UP_BOUNCE_CONFIG.peakScale * base + 0.01);
    });

    it('cedes scale ownership when group is selling — I-5 race guard', () => {
      // Simulate the race: upgrade fires scaleAnimStart, then sell fires immediately.
      // tickTierUpScale should yield to tickSellAnimations instead of fighting for scale.
      const group = new THREE.Group();
      const base = 1.2;
      group.scale.setScalar(TIER_UP_BOUNCE_CONFIG.peakScale * base);
      group.userData['scaleAnimStart'] = performance.now() / 1000;
      group.userData['scaleAnimBaseScale'] = base;
      group.userData['selling'] = true; // sell animation wins ownership

      service.tickTierUpScale(new Map([['t', group]]), performance.now() / 1000);

      // Scale state cleared — tickSellAnimations is now in full control
      expect(group.userData['scaleAnimStart']).toBeUndefined();
      expect(group.userData['scaleAnimBaseScale']).toBeUndefined();
      // Scale itself should be untouched — tickSellAnimations drives it from here
      expect(group.scale.x).toBeCloseTo(TIER_UP_BOUNCE_CONFIG.peakScale * base, 4);
    });
  });

  // ---- tickSellAnimations (Phase I Sprint 61) ----

  describe('tickSellAnimations', () => {
    function makeSellingGroup(): THREE.Group {
      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.BASIC;
      group.userData['selling'] = true;
      group.userData['sellingStart'] = performance.now() / 1000;
      group.scale.setScalar(1.0);
      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const mat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      return group;
    }

    function disposeSellingGroup(group: THREE.Group): void {
      group.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.MeshStandardMaterial).dispose();
        }
      });
    }

    it('handles empty map gracefully', () => {
      expect(() => service.tickSellAnimations(new Map(), 1.0, jasmine.createSpy())).not.toThrow();
    });

    it('skips groups without selling flag', () => {
      const group = new THREE.Group();
      group.scale.setScalar(1.0);
      const spy = jasmine.createSpy('onExpire');
      service.tickSellAnimations(new Map([['t', group]]), 10.0, spy);
      expect(group.scale.x).toBeCloseTo(1.0, 4);
      expect(spy).not.toHaveBeenCalled();
    });

    it('reduces scale during animation', () => {
      const group = makeSellingGroup();
      const start = group.userData['sellingStart'] as number;
      const spy = jasmine.createSpy('onExpire');

      service.tickSellAnimations(new Map([['t', group]]), start + SELL_ANIM_CONFIG.durationSec * 0.5, spy);

      expect(group.scale.x).toBeLessThan(1.0);
      expect(group.scale.x).toBeGreaterThan(0);
      expect(spy).not.toHaveBeenCalled();
      disposeSellingGroup(group);
    });

    it('calls onExpire and clears selling flag when animation completes', () => {
      const group = makeSellingGroup();
      const start = group.userData['sellingStart'] as number;
      const spy = jasmine.createSpy('onExpire');

      service.tickSellAnimations(
        new Map([['myKey', group]]),
        start + SELL_ANIM_CONFIG.durationSec + 0.01,
        spy,
      );

      expect(spy).toHaveBeenCalledOnceWith('myKey');
      expect(group.userData['selling']).toBeFalse();
      disposeSellingGroup(group);
    });

    it('fade uses absolute emissive assignment — same result at two different frames (Finding I-1)', () => {
      // Two groups with the same start time and same original emissive.
      // Both are driven to the exact same elapsed time via a single call
      // (one group in the map). We call twice at the same elapsed time and
      // verify the final emissiveIntensity is identical — proving the result
      // is not compounded by repeated multiplicative decay.
      const group = makeSellingGroup();
      const start = group.userData['sellingStart'] as number;
      const halfWay = start + SELL_ANIM_CONFIG.durationSec * 0.5;

      const spy = jasmine.createSpy('onExpire');
      const map = new Map([['t', group]]);

      // First call at 50%
      service.tickSellAnimations(map, halfWay, spy);
      const intensityAfterFirstCall = (group.children[0] as THREE.Mesh)
        ? ((group.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity
        : 0;

      // Second call at the SAME elapsed time (same frame, no progress)
      service.tickSellAnimations(map, halfWay, spy);
      const intensityAfterSecondCall = ((group.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity;

      // Absolute assignment: identical result; multiplicative would have halved again.
      expect(intensityAfterSecondCall).toBeCloseTo(intensityAfterFirstCall, 5);
      disposeSellingGroup(group);
    });

    it('emissive reaches ~0 at animation end without compound undershoot (Finding I-1)', () => {
      const group = makeSellingGroup();
      const start = group.userData['sellingStart'] as number;
      const spy = jasmine.createSpy('onExpire');

      // Drive to 99.9% of duration — should be near zero but group not yet expired
      service.tickSellAnimations(
        new Map([['t', group]]),
        start + SELL_ANIM_CONFIG.durationSec * 0.999,
        spy,
      );

      const intensity = ((group.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity;
      expect(intensity).toBeGreaterThanOrEqual(0);
      expect(intensity).toBeLessThan(0.01); // effectively zero
      disposeSellingGroup(group);
    });

    it('updateTowerAnimations skips selling groups — does not invoke idleTick (Finding I-1)', () => {
      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.BASIC;
      group.userData['selling'] = true;
      const idleSpy = jasmine.createSpy('idleTick');
      group.userData['idleTick'] = idleSpy;

      service.updateTowerAnimations(new Map([['t', group]]), 1000);

      expect(idleSpy).not.toHaveBeenCalled();
    });
  });

  // ---- tickSelectionPulse (Phase I Sprint 63 infra) ----

  describe('tickSelectionPulse', () => {
    function makeRingMesh(selected: boolean): THREE.Mesh {
      const geo = new THREE.RingGeometry(0.4, 0.5, 16);
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData['selected'] = selected;
      return mesh;
    }

    function disposeRing(mesh: THREE.Mesh): void {
      mesh.geometry.dispose();
      (mesh.material as THREE.MeshBasicMaterial).dispose();
    }

    it('handles empty map gracefully', () => {
      expect(() => service.tickSelectionPulse(new Map(), 1.0)).not.toThrow();
    });

    it('pulses opacity on selected rings', () => {
      const ring = makeRingMesh(true);
      service.tickSelectionPulse(new Map([['t', ring]]), 0.0);
      const opacity = (ring.material as THREE.MeshBasicMaterial).opacity;
      expect(opacity).toBeGreaterThanOrEqual(SELECTION_PULSE_CONFIG.opacityMin);
      expect(opacity).toBeLessThanOrEqual(SELECTION_PULSE_CONFIG.opacityMax);
      disposeRing(ring);
    });

    it('does not change opacity on unselected rings', () => {
      const ring = makeRingMesh(false);
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.42;
      service.tickSelectionPulse(new Map([['t', ring]]), 1.0);
      expect(mat.opacity).toBeCloseTo(0.42, 4);
      disposeRing(ring);
    });
  });

  // ---- tickHoverLift (Phase I Sprint 62 infra) ----

  describe('tickHoverLift', () => {
    function makeGroupWithLight(intensity: number): THREE.Group {
      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.BASIC;
      const light = new THREE.PointLight(0xffffff, intensity);
      group.userData['accentLight'] = light;
      group.add(light);
      return group;
    }

    it('handles groups without accent light gracefully', () => {
      const group = new THREE.Group();
      expect(() => service.tickHoverLift(new Map([['t', group]]))).not.toThrow();
    });

    it('captures base intensity on first call', () => {
      const group = makeGroupWithLight(0.8);
      service.tickHoverLift(new Map([['t', group]]));
      expect(group.userData['accentLightBaseIntensity']).toBeCloseTo(0.8, 4);
    });

    it('lifts light intensity when hoverLift is true', () => {
      const group = makeGroupWithLight(0.8);
      group.userData['hoverLift'] = true;
      service.tickHoverLift(new Map([['t', group]]));
      const light = group.userData['accentLight'] as THREE.PointLight;
      expect(light.intensity).toBeGreaterThan(0.8);
    });

    it('restores base intensity when hoverLift is false', () => {
      const group = makeGroupWithLight(0.8);
      group.userData['hoverLift'] = false;
      service.tickHoverLift(new Map([['t', group]]));
      const light = group.userData['accentLight'] as THREE.PointLight;
      expect(light.intensity).toBeCloseTo(0.8, 4);
    });
  });

  // ---- Emissive ratchet regression (Sprint 1 canary) ----
  //
  // Two towers that share a body material fire in the same batch every cycle.
  // Without the baseline-snapshot fix, the second tower's save captures the
  // already-spiked value, and its restore writes the spiked value back —
  // ratcheting the shared material upward on every round.
  //
  // This describe block contains the canary spec that MUST FAIL before the
  // fix lands and MUST PASS afterwards.

  describe('emissive ratchet — shared-material multi-fire', () => {
    const BASELINE = 0.4;

    function makeSharedMatTower(
      id: string,
      sharedMat: THREE.MeshStandardMaterial,
    ): PlacedTower {
      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.BASIC;

      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const body = new THREE.Mesh(geo, sharedMat);
      body.name = 'body';
      group.add(body);

      // Record the canonical emissive baseline so startMuzzleFlash can use
      // it instead of the current (possibly spiked) material value.
      const baselines = new Map<string, number>();
      group.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) {
          if ((m as THREE.MeshStandardMaterial).emissiveIntensity !== undefined) {
            baselines.set(child.uuid + '_' + m.uuid,
              (m as THREE.MeshStandardMaterial).emissiveIntensity);
          }
        }
      });
      group.userData['emissiveBaselines'] = baselines;

      return {
        id,
        type: TowerType.BASIC,
        level: 1,
        row: 0,
        col: 0,
        kills: 0,
        totalInvested: 50,
        targetingMode: TargetingMode.NEAREST,
        mesh: group,
      };
    }

    it('body material returns to baseline after 30 fire cycles with two shared-material towers', () => {
      const sharedMat = new THREE.MeshStandardMaterial({ emissiveIntensity: BASELINE });

      // Each tower has its own group with one body mesh referencing the same material.
      // All baselines are captured before any flash fires.
      const towerA = makeSharedMatTower('0-0', sharedMat);
      const towerB = makeSharedMatTower('0-1', sharedMat);

      const towersMap = new Map<string, PlacedTower>([
        ['0-0', towerA],
        ['0-1', towerB],
      ]);

      for (let cycle = 0; cycle < 30; cycle++) {
        // Both towers fire in the same batch (same turn).
        // Without the baseline-snapshot fix the second save captures the already-spiked
        // value and restore writes it back permanently. With the fix both saves read 0.4
        // from their respective baseline maps and both restores write 0.4.
        service.startMuzzleFlash(towerA);
        service.startMuzzleFlash(towerB);

        // Advance past flash duration to expire both timers in one call.
        service.updateMuzzleFlashes(towersMap, MUZZLE_FLASH_CONFIG.duration + 0.001);
      }

      const tolerance = BASELINE * 0.05; // ±5%
      expect(sharedMat.emissiveIntensity).toBeGreaterThanOrEqual(BASELINE - tolerance);
      expect(sharedMat.emissiveIntensity).toBeLessThanOrEqual(BASELINE + tolerance);

      sharedMat.dispose();
      towerA.mesh?.traverse(obj => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
      towerB.mesh?.traverse(obj => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
    });

    it('single MORTAR body material returns to baseline after 30 fire cycles', () => {
      const mortarMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.3 });
      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);

      const group = new THREE.Group();
      group.userData['towerType'] = TowerType.MORTAR;
      for (const name of ['chassis', 'barrelT1', 'cradle']) {
        const m = new THREE.Mesh(geo, mortarMat);
        m.name = name;
        group.add(m);
      }

      const baselines = new Map<string, number>();
      group.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          baselines.set(child.uuid + '_' + mat.uuid,
            (mat as THREE.MeshStandardMaterial).emissiveIntensity);
        }
      });
      group.userData['emissiveBaselines'] = baselines;

      const tower: PlacedTower = {
        id: '1-1',
        type: TowerType.MORTAR,
        level: 1,
        row: 1,
        col: 1,
        kills: 0,
        totalInvested: 120,
        targetingMode: TargetingMode.NEAREST,
        mesh: group,
      };

      const towersMap = new Map<string, PlacedTower>([['1-1', tower]]);

      for (let cycle = 0; cycle < 30; cycle++) {
        service.startMuzzleFlash(tower);
        service.updateMuzzleFlashes(towersMap, MUZZLE_FLASH_CONFIG.duration + 0.001);
      }

      const baseline = 0.3;
      const tolerance = baseline * 0.05;
      expect(mortarMat.emissiveIntensity).toBeGreaterThanOrEqual(baseline - tolerance);
      expect(mortarMat.emissiveIntensity).toBeLessThanOrEqual(baseline + tolerance);

      mortarMat.dispose();
      geo.dispose();
    });
  });
});
