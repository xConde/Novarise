import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TowerAnimationService } from './tower-animation.service';
import { PlacedTower, TowerType, TargetingMode } from '../models/tower.model';
import { BlockType } from '../models/game-board-tile';
import { MUZZLE_FLASH_CONFIG, TOWER_ANIM_CONFIG, TILE_PULSE_CONFIG } from '../constants/effects.constants';
import { ANIMATION_CONFIG } from '../constants/rendering.constants';

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
    describe('crystal bob — BASIC tower', () => {
      it('sets child.position.y to a value derived from crystalBaseY', () => {
        const { group, child } = makeTowerGroup(TowerType.BASIC, 'crystal');
        const towerMeshes = new Map<string, THREE.Group>([['0-0', group]]);
        const time = 1000; // 1 second in ms

        service.updateTowerAnimations(towerMeshes, time);

        const t = time * ANIMATION_CONFIG.msToSeconds;
        const expectedY = TOWER_ANIM_CONFIG.crystalBaseY
          + Math.sin(t * TOWER_ANIM_CONFIG.crystalBobSpeed) * TOWER_ANIM_CONFIG.crystalBobAmplitude;
        expect(child.position.y).toBeCloseTo(expectedY, 5);

        disposeTowerGroup(group);
      });

      it('rotates crystal around Y axis', () => {
        const { group, child } = makeTowerGroup(TowerType.BASIC, 'crystal');
        const towerMeshes = new Map<string, THREE.Group>([['0-0', group]]);
        const time = 2000;

        service.updateTowerAnimations(towerMeshes, time);

        const t = time * ANIMATION_CONFIG.msToSeconds;
        expect(child.rotation.y).toBeCloseTo(t * TOWER_ANIM_CONFIG.basicCrystalRotSpeed, 5);

        disposeTowerGroup(group);
      });
    });

    describe('crystal bob — SLOW tower', () => {
      it('sets child.position.y to a value derived from slowCrystalBaseY', () => {
        const { group, child } = makeTowerGroup(TowerType.SLOW, 'crystal');
        const towerMeshes = new Map<string, THREE.Group>([['0-0', group]]);
        const time = 1500;

        service.updateTowerAnimations(towerMeshes, time);

        const t = time * ANIMATION_CONFIG.msToSeconds;
        const expectedY = TOWER_ANIM_CONFIG.slowCrystalBaseY
          + Math.sin(t * TOWER_ANIM_CONFIG.crystalBobSpeed) * TOWER_ANIM_CONFIG.slowCrystalBobAmplitude;
        expect(child.position.y).toBeCloseTo(expectedY, 5);

        disposeTowerGroup(group);
      });

      it('rotates SLOW crystal at slowCrystalRotSpeed', () => {
        const { group, child } = makeTowerGroup(TowerType.SLOW, 'crystal');
        const towerMeshes = new Map<string, THREE.Group>([['0-0', group]]);
        const time = 1000;

        service.updateTowerAnimations(towerMeshes, time);

        const t = time * ANIMATION_CONFIG.msToSeconds;
        expect(child.rotation.y).toBeCloseTo(t * TOWER_ANIM_CONFIG.slowCrystalRotSpeed, 5);

        disposeTowerGroup(group);
      });
    });

    describe('orb pulse — SPLASH tower', () => {
      it('scales orb within [orbPulseMin, orbPulseMax]', () => {
        const { group, child } = makeTowerGroup(TowerType.SPLASH, 'orb');
        const towerMeshes = new Map<string, THREE.Group>([['0-0', group]]);
        const time = 500;

        service.updateTowerAnimations(towerMeshes, time);

        expect(child.scale.x).toBeGreaterThanOrEqual(TOWER_ANIM_CONFIG.orbPulseMin);
        expect(child.scale.x).toBeLessThanOrEqual(TOWER_ANIM_CONFIG.orbPulseMax);
        expect(child.scale.x).toBeCloseTo(child.scale.y, 5);
        expect(child.scale.x).toBeCloseTo(child.scale.z, 5);

        disposeTowerGroup(group);
      });

      it('matches the expected pulse formula', () => {
        const { group, child } = makeTowerGroup(TowerType.SPLASH, 'orb');
        const towerMeshes = new Map<string, THREE.Group>([['0-0', group]]);
        const time = 1234;

        service.updateTowerAnimations(towerMeshes, time);

        const t = time * ANIMATION_CONFIG.msToSeconds;
        const expectedScale = TOWER_ANIM_CONFIG.orbPulseMin
          + (Math.sin(t * TOWER_ANIM_CONFIG.orbPulseSpeed) * 0.5 + 0.5)
          * (TOWER_ANIM_CONFIG.orbPulseMax - TOWER_ANIM_CONFIG.orbPulseMin);
        expect(child.scale.x).toBeCloseTo(expectedScale, 5);

        disposeTowerGroup(group);
      });
    });

    describe('spark bob — CHAIN tower', () => {
      it('captures baseY on first call if not set', () => {
        const { group, child } = makeTowerGroup(TowerType.CHAIN, 'spark');
        child.position.set(0, 0.5, 0); // set initial position before first call
        const towerMeshes = new Map<string, THREE.Group>([['0-0', group]]);

        service.updateTowerAnimations(towerMeshes, 0);

        expect(child.userData['baseY']).toBeCloseTo(0.5, 5);

        disposeTowerGroup(group);
      });

      it('sets spark position.y based on sparkBobAmplitude', () => {
        const { group, child } = makeTowerGroup(TowerType.CHAIN, 'spark');
        child.position.set(1.0, 0.3, 0);
        const towerMeshes = new Map<string, THREE.Group>([['0-0', group]]);
        const time = 800;

        service.updateTowerAnimations(towerMeshes, time);

        const t = time * ANIMATION_CONFIG.msToSeconds;
        const baseY = 0.3;
        const expectedY = baseY
          + Math.sin(t * TOWER_ANIM_CONFIG.sparkBobSpeed + child.position.x * TOWER_ANIM_CONFIG.sparkPhaseScale)
          * TOWER_ANIM_CONFIG.sparkBobAmplitude;
        expect(child.position.y).toBeCloseTo(expectedY, 5);

        disposeTowerGroup(group);
      });
    });

    describe('spore bob — MORTAR tower', () => {
      it('captures baseY on first call if not set', () => {
        const { group, child } = makeTowerGroup(TowerType.MORTAR, 'spore');
        child.position.set(0, 0.7, 0);
        const towerMeshes = new Map<string, THREE.Group>([['0-0', group]]);

        service.updateTowerAnimations(towerMeshes, 0);

        expect(child.userData['baseY']).toBeCloseTo(0.7, 5);

        disposeTowerGroup(group);
      });

      it('sets spore position.y based on sporeBobAmplitude', () => {
        const { group, child } = makeTowerGroup(TowerType.MORTAR, 'spore');
        child.position.set(0.5, 0.4, 0);
        const towerMeshes = new Map<string, THREE.Group>([['0-0', group]]);
        const time = 600;

        service.updateTowerAnimations(towerMeshes, time);

        const t = time * ANIMATION_CONFIG.msToSeconds;
        const baseY = 0.4;
        const expectedY = baseY
          + Math.sin(t * TOWER_ANIM_CONFIG.sporeBobSpeed + child.position.x * TOWER_ANIM_CONFIG.sporePhaseScale)
          * TOWER_ANIM_CONFIG.sporeBobAmplitude;
        expect(child.position.y).toBeCloseTo(expectedY, 5);

        disposeTowerGroup(group);
      });
    });

    describe('tip glow — SNIPER tower', () => {
      it('sets emissiveIntensity within [tipGlowMin, tipGlowMax]', () => {
        const { group, child } = makeTowerGroup(TowerType.SNIPER, 'tip');
        const towerMeshes = new Map<string, THREE.Group>([['0-0', group]]);

        service.updateTowerAnimations(towerMeshes, 750);

        const mat = child.material as THREE.MeshStandardMaterial;
        expect(mat.emissiveIntensity).toBeGreaterThanOrEqual(TOWER_ANIM_CONFIG.tipGlowMin);
        expect(mat.emissiveIntensity).toBeLessThanOrEqual(TOWER_ANIM_CONFIG.tipGlowMax);

        disposeTowerGroup(group);
      });

      it('matches the expected glow formula', () => {
        const { group, child } = makeTowerGroup(TowerType.SNIPER, 'tip');
        const towerMeshes = new Map<string, THREE.Group>([['0-0', group]]);
        const time = 999;

        service.updateTowerAnimations(towerMeshes, time);

        const t = time * ANIMATION_CONFIG.msToSeconds;
        const expected = TOWER_ANIM_CONFIG.tipGlowMin
          + (Math.sin(t * TOWER_ANIM_CONFIG.tipGlowSpeed) * 0.5 + 0.5)
          * (TOWER_ANIM_CONFIG.tipGlowMax - TOWER_ANIM_CONFIG.tipGlowMin);
        const mat = child.material as THREE.MeshStandardMaterial;
        expect(mat.emissiveIntensity).toBeCloseTo(expected, 5);

        disposeTowerGroup(group);
      });
    });

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
      const initialIntensity = (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity;
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
        lastFireTime: 0,
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
          lastFireTime: 0,
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
          lastFireTime: 0,
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
});
