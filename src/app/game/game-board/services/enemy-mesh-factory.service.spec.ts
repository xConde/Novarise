import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { EnemyMeshFactoryService } from './enemy-mesh-factory.service';
import { Enemy, EnemyType, ENEMY_STATS, MINI_SWARM_STATS } from '../models/enemy.model';
import { HEALTH_BAR_CONFIG, SHIELD_VISUAL_CONFIG } from '../constants/ui.constants';

/** Dispose geometry and material on a mesh and its children. */
function disposeMesh(mesh: THREE.Mesh): void {
  mesh.traverse(child => {
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

/** Build a minimal Enemy fixture for the given type. */
function makeEnemy(type: EnemyType, overrides: Partial<Enemy> = {}): Enemy {
  const stats = ENEMY_STATS[type];
  return {
    id: `test-${type}`,
    type,
    position: { x: 0, y: stats.size, z: 0 },
    gridPosition: { row: 0, col: 0 },
    health: stats.health,
    maxHealth: stats.health,
    speed: stats.speed,
    value: stats.value,
    leakDamage: stats.leakDamage,
    path: [],
    pathIndex: 0,
    distanceTraveled: 0,
    ...overrides,
  };
}

describe('EnemyMeshFactoryService', () => {
  let service: EnemyMeshFactoryService;
  const createdMeshes: THREE.Mesh[] = [];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EnemyMeshFactoryService]
    });
    service = TestBed.inject(EnemyMeshFactoryService);
  });

  afterEach(() => {
    createdMeshes.forEach(disposeMesh);
    createdMeshes.length = 0;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- createEnemyMesh ---

  describe('createEnemyMesh', () => {
    const types: EnemyType[] = [
      EnemyType.BASIC,
      EnemyType.FAST,
      EnemyType.HEAVY,
      EnemyType.SWIFT,
      EnemyType.BOSS,
      EnemyType.SHIELDED,
      EnemyType.SWARM,
      EnemyType.MINER,
    ];

    types.forEach(type => {
      describe(`EnemyType.${type}`, () => {
        let enemy: Enemy;
        let mesh: THREE.Mesh;

        beforeEach(() => {
          enemy = makeEnemy(type);
          if (type === EnemyType.SHIELDED) {
            const stats = ENEMY_STATS[type];
            enemy.shield = stats.maxShield;
            enemy.maxShield = stats.maxShield;
          }
          mesh = service.createEnemyMesh(enemy);
          createdMeshes.push(mesh);
        });

        it('should return a THREE.Mesh', () => {
          expect(mesh instanceof THREE.Mesh).toBeTrue();
        });

        it('should position mesh at enemy position', () => {
          expect(mesh.position.x).toBeCloseTo(enemy.position.x);
          expect(mesh.position.y).toBeCloseTo(enemy.position.y);
          expect(mesh.position.z).toBeCloseTo(enemy.position.z);
        });

        it('should have castShadow enabled', () => {
          expect(mesh.castShadow).toBeTrue();
        });

        it('should have health bar children in userData', () => {
          expect(mesh.userData['healthBarBg']).toBeTruthy();
          expect(mesh.userData['healthBarFg']).toBeTruthy();
        });

        it('should have at least 2 children (health bar bg + fg)', () => {
          expect(mesh.children.length).toBeGreaterThanOrEqual(2);
        });
      });
    });

    describe('FLYING enemy', () => {
      let mesh: THREE.Mesh;

      beforeEach(() => {
        const enemy = makeEnemy(EnemyType.FLYING, { isFlying: true });
        mesh = service.createEnemyMesh(enemy);
        createdMeshes.push(mesh);
      });

      it('should return a THREE.Mesh for flying enemy', () => {
        expect(mesh instanceof THREE.Mesh).toBeTrue();
      });

      it('should use DoubleSide material for flying enemy', () => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        expect(mat.side).toBe(THREE.DoubleSide);
      });

      it('should use BufferGeometry (diamond) for flying enemy', () => {
        expect(mesh.geometry instanceof THREE.BufferGeometry).toBeTrue();
        // Diamond has 4 vertices
        const positions = mesh.geometry.getAttribute('position');
        expect(positions.count).toBe(4);
      });
    });

    describe('SHIELDED enemy', () => {
      let mesh: THREE.Mesh;

      beforeEach(() => {
        const stats = ENEMY_STATS[EnemyType.SHIELDED];
        const enemy = makeEnemy(EnemyType.SHIELDED, {
          shield: stats.maxShield,
          maxShield: stats.maxShield,
        });
        mesh = service.createEnemyMesh(enemy);
        createdMeshes.push(mesh);
      });

      it('should add shield mesh to userData', () => {
        expect(mesh.userData['shieldMesh']).toBeTruthy();
      });

      it('should have 5 children (healthBarBg, healthBarFg, shield dome, shieldBarBg, shieldBarFg)', () => {
        expect(mesh.children.length).toBe(5);
      });

      it('should add shield bar meshes to userData', () => {
        expect(mesh.userData['shieldBarBg']).toBeTruthy();
        expect(mesh.userData['shieldBarFg']).toBeTruthy();
      });
    });

    describe('BOSS enemy', () => {
      let mesh: THREE.Mesh;

      beforeEach(() => {
        const enemy = makeEnemy(EnemyType.BOSS);
        mesh = service.createEnemyMesh(enemy);
        createdMeshes.push(mesh);
      });

      it('should add bossCrown to userData', () => {
        expect(mesh.userData['bossCrown']).toBeTruthy();
      });

      it('should have crown as a child mesh', () => {
        const crown = mesh.userData['bossCrown'] as THREE.Mesh;
        expect(mesh.children).toContain(crown);
      });
    });
  });

  // --- createEnemyGeometry ---

  describe('createEnemyGeometry', () => {
    const geometryTypes: EnemyType[] = [
      EnemyType.BASIC,
      EnemyType.FAST,
      EnemyType.HEAVY,
      EnemyType.SWIFT,
      EnemyType.BOSS,
      EnemyType.SHIELDED,
      EnemyType.SWARM,
      EnemyType.FLYING,
    ];

    geometryTypes.forEach(type => {
      it(`should return a BufferGeometry for EnemyType.${type}`, () => {
        const stats = ENEMY_STATS[type];
        const geom = service.createEnemyGeometry(type, stats.size);
        expect(geom instanceof THREE.BufferGeometry).toBeTrue();
        geom.dispose();
      });
    });

    it('should produce different geometry for HEAVY (box) vs BASIC (sphere)', () => {
      const basicGeom = service.createEnemyGeometry(EnemyType.BASIC, 0.4);
      const heavyGeom = service.createEnemyGeometry(EnemyType.HEAVY, 0.5);
      // BoxGeometry has 36 draw positions; SphereGeometry has far more — just check they differ
      expect(basicGeom.getAttribute('position').count).not.toEqual(
        heavyGeom.getAttribute('position').count
      );
      basicGeom.dispose();
      heavyGeom.dispose();
    });
  });

  // --- createBossCrown ---

  describe('createBossCrown', () => {
    it('should attach a crown child to the mesh', () => {
      const parentMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.5),
        new THREE.MeshStandardMaterial()
      );
      const size = ENEMY_STATS[EnemyType.BOSS].size;
      service.createBossCrown(parentMesh, size, ENEMY_STATS[EnemyType.BOSS].color);

      expect(parentMesh.userData['bossCrown']).toBeTruthy();
      expect(parentMesh.children.length).toBe(1);

      disposeMesh(parentMesh);
    });

    it('should set crown rotation.x to PI/2', () => {
      const parentMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.5),
        new THREE.MeshStandardMaterial()
      );
      service.createBossCrown(parentMesh, 0.6, 0xff0000);
      const crown = parentMesh.userData['bossCrown'] as THREE.Mesh;
      expect(crown.rotation.x).toBeCloseTo(Math.PI / 2);
      disposeMesh(parentMesh);
    });
  });

  // --- createShieldMesh ---

  describe('createShieldMesh', () => {
    it('should return a THREE.Mesh', () => {
      const mesh = service.createShieldMesh(0.5);
      expect(mesh instanceof THREE.Mesh).toBeTrue();
      disposeMesh(mesh);
    });

    it('should use a transparent DoubleSide material', () => {
      const mesh = service.createShieldMesh(0.5);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.transparent).toBeTrue();
      expect(mat.side).toBe(THREE.DoubleSide);
      expect(mat.opacity).toBeCloseTo(SHIELD_VISUAL_CONFIG.opacity);
      disposeMesh(mesh);
    });
  });

  // --- removeShieldMesh ---

  describe('removeShieldMesh', () => {
    it('should be a no-op when enemy has no mesh', () => {
      const enemy = makeEnemy(EnemyType.SHIELDED);
      expect(() => service.removeShieldMesh(enemy)).not.toThrow();
    });

    it('should be a no-op when mesh has no shieldMesh in userData', () => {
      const enemy = makeEnemy(EnemyType.SHIELDED);
      enemy.mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.3),
        new THREE.MeshStandardMaterial()
      );
      createdMeshes.push(enemy.mesh);
      expect(() => service.removeShieldMesh(enemy)).not.toThrow();
    });

    it('should set shieldBreaking=true and shieldBreakTimer when shield mesh exists', () => {
      const stats = ENEMY_STATS[EnemyType.SHIELDED];
      const enemy = makeEnemy(EnemyType.SHIELDED, {
        shield: stats.maxShield,
        maxShield: stats.maxShield,
      });
      enemy.mesh = service.createEnemyMesh(enemy);
      createdMeshes.push(enemy.mesh);

      service.removeShieldMesh(enemy);

      expect(enemy.shieldBreaking).toBeTrue();
      expect(enemy.shieldBreakTimer).toBeGreaterThan(0);
    });
  });

  // --- createMiniSwarmMesh ---

  describe('createMiniSwarmMesh', () => {
    let mesh: THREE.Mesh;
    let mini: Enemy;

    beforeEach(() => {
      mini = {
        id: 'mini-1',
        type: EnemyType.SWARM,
        position: { x: 1, y: MINI_SWARM_STATS.size, z: 2 },
        gridPosition: { row: 0, col: 0 },
        health: MINI_SWARM_STATS.health,
        maxHealth: MINI_SWARM_STATS.health,
        speed: MINI_SWARM_STATS.speed,
        value: MINI_SWARM_STATS.value,
        leakDamage: MINI_SWARM_STATS.leakDamage,
        path: [],
        pathIndex: 0,
        distanceTraveled: 0,
        isMiniSwarm: true,
      };
      mesh = service.createMiniSwarmMesh(mini);
      createdMeshes.push(mesh);
    });

    it('should return a THREE.Mesh', () => {
      expect(mesh instanceof THREE.Mesh).toBeTrue();
    });

    it('should position at mini enemy position', () => {
      expect(mesh.position.x).toBeCloseTo(mini.position.x);
      expect(mesh.position.y).toBeCloseTo(mini.position.y);
      expect(mesh.position.z).toBeCloseTo(mini.position.z);
    });

    it('should have health bar children in userData', () => {
      expect(mesh.userData['healthBarBg']).toBeTruthy();
      expect(mesh.userData['healthBarFg']).toBeTruthy();
    });

    it('should use a narrower health bar width than standard', () => {
      const fgGeom = (mesh.userData['healthBarFg'] as THREE.Mesh).geometry as THREE.PlaneGeometry;
      const standardFgGeom = new THREE.PlaneGeometry(HEALTH_BAR_CONFIG.width, HEALTH_BAR_CONFIG.height);
      expect(fgGeom.parameters.width).toBeLessThan(standardFgGeom.parameters.width);
      standardFgGeom.dispose();
    });

    it('should have castShadow enabled', () => {
      expect(mesh.castShadow).toBeTrue();
    });
  });

  // --- MINER geometry ---

  describe('MINER geometry (createEnemyGeometry)', () => {
    let geom: THREE.BufferGeometry;

    beforeEach(() => {
      geom = service.createEnemyGeometry(EnemyType.MINER, 0.35);
    });

    afterEach(() => {
      geom.dispose();
    });

    it('returns a BoxGeometry for MINER', () => {
      expect(geom).toBeInstanceOf(THREE.BoxGeometry);
    });

    it('MINER mesh from createEnemyMesh is a THREE.Mesh with BoxGeometry', () => {
      const enemy = makeEnemy(EnemyType.MINER);
      const mesh = service.createEnemyMesh(enemy);
      createdMeshes.push(mesh);

      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
    });
  });
});
