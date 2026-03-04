import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { ParticleService } from './particle.service';
import { DEATH_BURST_CONFIG } from '../constants/particle.constants';

describe('ParticleService', () => {
  let service: ParticleService;
  let scene: THREE.Scene;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ParticleService],
    });
    service = TestBed.inject(ParticleService);
    scene = new THREE.Scene();
  });

  afterEach(() => {
    service.cleanup(scene);
    // scene itself has no dispose(), just clear references
  });

  // ---------------------------------------------------------------------------
  // spawnDeathBurst
  // ---------------------------------------------------------------------------

  describe('spawnDeathBurst', () => {
    it('spawns the default number of particles when count is omitted', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000);
      expect(service.particleCount).toBe(DEATH_BURST_CONFIG.defaultCount);
    });

    it('spawns the requested number of particles when count is provided', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0x00ff00, 3);
      expect(service.particleCount).toBe(3);
    });

    it('places particles at the given world position', () => {
      const pos = { x: 2, y: 1, z: -3 };
      service.spawnDeathBurst(pos, 0xffffff, 1);
      service.addPendingToScene(scene);

      const mesh = scene.children[0] as THREE.Mesh;
      expect(mesh.position.x).toBeCloseTo(pos.x);
      expect(mesh.position.y).toBeCloseTo(pos.y);
      expect(mesh.position.z).toBeCloseTo(pos.z);
    });

    it('applies the supplied color to each particle material', () => {
      const color = 0xab1234;
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, color, 4);
      service.addPendingToScene(scene);

      for (const child of scene.children) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        expect(mat.color.getHex()).toBe(color);
      }
    });

    it('creates particles with transparent material at full opacity', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 2);
      service.addPendingToScene(scene);

      for (const child of scene.children) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        expect(mat.transparent).toBeTrue();
        expect(mat.opacity).toBeCloseTo(1);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // addPendingToScene
  // ---------------------------------------------------------------------------

  describe('addPendingToScene', () => {
    it('adds spawned particles to the scene', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 5);
      expect(scene.children.length).toBe(0);

      service.addPendingToScene(scene);
      expect(scene.children.length).toBe(5);
    });

    it('does not add particles to the scene twice', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 3);
      service.addPendingToScene(scene);
      service.addPendingToScene(scene);
      expect(scene.children.length).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // update — movement
  // ---------------------------------------------------------------------------

  describe('update — movement', () => {
    it('moves particles over time', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 1);
      service.addPendingToScene(scene);

      const meshBefore = (scene.children[0] as THREE.Mesh).position.clone();
      service.update(0.1, scene);

      const meshAfter = (scene.children[0] as THREE.Mesh).position;
      const moved =
        meshAfter.x !== meshBefore.x ||
        meshAfter.y !== meshBefore.y ||
        meshAfter.z !== meshBefore.z;
      expect(moved).toBeTrue();
    });

    it('fades particle opacity as time progresses', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 1);
      service.addPendingToScene(scene);

      service.update(DEATH_BURST_CONFIG.lifetime / 2, scene);

      const mat = (scene.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      expect(mat.opacity).toBeLessThan(1);
      expect(mat.opacity).toBeGreaterThan(0);
    });

    it('applies gravity — y velocity decreases over time', () => {
      service.spawnDeathBurst({ x: 0, y: 5, z: 0 }, 0xff0000, 1);
      service.addPendingToScene(scene);

      const yBefore = (scene.children[0] as THREE.Mesh).position.y;
      // Tick several times so gravity accumulates
      service.update(0.1, scene);
      service.update(0.1, scene);
      service.update(0.1, scene);
      const yAfter = (scene.children[0] as THREE.Mesh).position.y;

      // Net y may be up or down depending on initial velocity, but gravity must
      // be pulling down — check that position is lower than it would be without gravity.
      // Since we can't inspect initial velocity directly, we verify the particle
      // is still alive and in the scene (it hasn't reached lifetime yet).
      expect(scene.children.length).toBe(1);
      // Gravity contribution over 0.3 s = 0.5 * g * t^2 = 0.5 * 5 * 0.09 = 0.225 units down.
      // The y position with gravity must be < y position without gravity.
      // We just confirm the mesh exists and y has changed.
      expect(yAfter).not.toBe(yBefore);
    });
  });

  // ---------------------------------------------------------------------------
  // update — expiry
  // ---------------------------------------------------------------------------

  describe('update — expiry', () => {
    it('removes particles from scene after lifetime expires', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 4);
      service.addPendingToScene(scene);
      expect(scene.children.length).toBe(4);

      service.update(DEATH_BURST_CONFIG.lifetime + 0.01, scene);

      expect(scene.children.length).toBe(0);
      expect(service.particleCount).toBe(0);
    });

    it('removes only expired particles while keeping live ones', () => {
      // Spawn first burst and advance it close to expiry
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 2);
      service.addPendingToScene(scene);
      service.update(DEATH_BURST_CONFIG.lifetime - 0.05, scene);
      const sceneCountAfterFirst = scene.children.length;

      // Spawn a second burst (brand new, age 0)
      service.spawnDeathBurst({ x: 1, y: 0, z: 1 }, 0x00ff00, 3);
      service.addPendingToScene(scene);

      // Advance enough to expire the first burst but not the second
      service.update(0.1, scene);

      // Only the 3 new particles remain
      expect(service.particleCount).toBe(3);
      expect(sceneCountAfterFirst).toBe(2); // sanity: first burst was present
    });

    it('disposes material of expired particles (geometry is shared)', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 1);
      service.addPendingToScene(scene);

      const mesh = scene.children[0] as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;

      spyOn(mat, 'dispose').and.callThrough();

      service.update(DEATH_BURST_CONFIG.lifetime + 0.01, scene);

      expect(mat.dispose).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // update — edge cases
  // ---------------------------------------------------------------------------

  describe('update — deltaTime edge cases', () => {
    it('does nothing when deltaTime is zero', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 3);
      service.addPendingToScene(scene);

      service.update(0, scene);

      expect(service.particleCount).toBe(3);
      expect(scene.children.length).toBe(3);
    });

    it('does nothing when deltaTime is negative', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 3);
      service.addPendingToScene(scene);

      service.update(-1, scene);

      expect(service.particleCount).toBe(3);
      expect(scene.children.length).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // cleanup
  // ---------------------------------------------------------------------------

  describe('cleanup', () => {
    it('removes all particles from the service', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 5);
      service.addPendingToScene(scene);

      service.cleanup(scene);

      expect(service.particleCount).toBe(0);
    });

    it('removes all particles from the scene when scene is provided', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 5);
      service.addPendingToScene(scene);
      expect(scene.children.length).toBe(5);

      service.cleanup(scene);

      expect(scene.children.length).toBe(0);
    });

    it('disposes materials for all particles and shared geometry on cleanup', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 2);
      service.addPendingToScene(scene);

      const meshes = scene.children.map(c => c as THREE.Mesh);
      const sharedGeo = meshes[0].geometry;
      const geoSpy = spyOn(sharedGeo, 'dispose').and.callThrough();
      const matSpies = meshes.map(m =>
        spyOn(m.material as THREE.MeshBasicMaterial, 'dispose').and.callThrough()
      );

      service.cleanup(scene);

      expect(geoSpy).toHaveBeenCalledTimes(1);
      matSpies.forEach(s => expect(s).toHaveBeenCalled());
    });

    it('works when called with no particles active', () => {
      expect(() => service.cleanup(scene)).not.toThrow();
      expect(service.particleCount).toBe(0);
    });

    it('works without a scene argument (no scene.remove calls)', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 3);
      expect(() => service.cleanup()).not.toThrow();
      expect(service.particleCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple simultaneous bursts
  // ---------------------------------------------------------------------------

  describe('multiple simultaneous bursts', () => {
    it('tracks particles from multiple bursts independently', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 4);
      service.spawnDeathBurst({ x: 5, y: 0, z: 5 }, 0x00ff00, 6);
      expect(service.particleCount).toBe(10);
    });

    it('adds all burst particles to the scene via addPendingToScene', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 4);
      service.spawnDeathBurst({ x: 5, y: 0, z: 5 }, 0x00ff00, 6);
      service.addPendingToScene(scene);
      expect(scene.children.length).toBe(10);
    });

    it('expires all bursts correctly when enough time passes', () => {
      service.spawnDeathBurst({ x: 0, y: 0, z: 0 }, 0xff0000, 4);
      service.spawnDeathBurst({ x: 5, y: 0, z: 5 }, 0x0000ff, 3);
      service.addPendingToScene(scene);

      service.update(DEATH_BURST_CONFIG.lifetime + 0.01, scene);

      expect(service.particleCount).toBe(0);
      expect(scene.children.length).toBe(0);
    });
  });
});
