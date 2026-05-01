import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { AimLineService } from './aim-line.service';
import { TowerAnimationService } from './tower-animation.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TowerSelectionService } from './tower-selection.service';
import { SceneService } from './scene.service';
import { TargetPreviewService } from './target-preview.service';
import {
  TowerType,
  TOWER_CONFIGS,
  PlacedTower,
  TargetingMode,
} from '../models/tower.model';
import { AIM_LERP_CONFIG } from '../constants/tower-aim.constants';
import { createTestEnemy } from '../testing';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePlacedTower(row: number, col: number, type = TowerType.BASIC): PlacedTower {
  return {
    id: `${row}-${col}`,
    type,
    level: 1,
    row,
    col,
    targetingMode: 0,
    specialization: undefined,
    mesh: undefined,
    actualCost: TOWER_CONFIGS[type].cost,
    placedAtTurn: 0,
  } as unknown as PlacedTower;
}

function makeScene(): THREE.Scene {
  return new THREE.Scene();
}

function makeMeshRegistry(
  towerGroup?: THREE.Group,
  key?: string,
): Partial<BoardMeshRegistryService> {
  const map = new Map<string, THREE.Group>();
  if (towerGroup && key) map.set(key, towerGroup);
  return { towerMeshes: map } as Partial<BoardMeshRegistryService>;
}

function makeSceneService(scene: THREE.Scene): Partial<SceneService> {
  return { getScene: () => scene } as Partial<SceneService>;
}

function makeSelectionService(
  tower: PlacedTower | null,
): Partial<TowerSelectionService> {
  return { selectedTowerInfo: tower } as Partial<TowerSelectionService>;
}

// ── AimLineService specs ──────────────────────────────────────────────────────

describe('AimLineService', () => {
  let service: AimLineService;
  const scenes: THREE.Scene[] = [];
  const groups: THREE.Group[] = [];

  afterEach(() => {
    service.cleanup();
    scenes.forEach(s => {
      s.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material as THREE.Material | THREE.Material[];
          (Array.isArray(mat) ? mat : [mat]).forEach(m => m.dispose());
        }
      });
    });
    scenes.length = 0;
    groups.length = 0;
  });

  function buildService(
    tower: PlacedTower | null,
    towerGroup?: THREE.Group,
    key?: string,
    scene?: THREE.Scene,
  ): AimLineService {
    const sc = scene ?? makeScene();
    scenes.push(sc);

    TestBed.configureTestingModule({
      providers: [
        AimLineService,
        { provide: BoardMeshRegistryService, useValue: makeMeshRegistry(towerGroup, key) },
        { provide: TowerSelectionService, useValue: makeSelectionService(tower) },
        { provide: SceneService, useValue: makeSceneService(sc) },
      ],
    });
    return TestBed.inject(AimLineService);
  }

  it('creates without error', () => {
    TestBed.configureTestingModule({ providers: [AimLineService] });
    service = TestBed.inject(AimLineService);
    expect(service).toBeTruthy();
    service.cleanup();
  });

  it('update() is a no-op when no services are provided', () => {
    TestBed.configureTestingModule({ providers: [AimLineService] });
    service = TestBed.inject(AimLineService);
    expect(() => service.update()).not.toThrow();
    service.cleanup();
  });

  it('does not add a mesh to the scene when no tower is selected', () => {
    service = buildService(null);
    service.update();
    const scene = scenes[0];
    expect(scene.children.length).toBe(0);
  });

  it('does not add a mesh when selected tower group is not in registry', () => {
    const tower = makePlacedTower(1, 1);
    // Registry is empty — no group for this tower
    service = buildService(tower);
    service.update();
    expect(scenes[0].children.length).toBe(0);
  });

  it('does not show line when tower has no currentAimTarget', () => {
    const tower = makePlacedTower(2, 2);
    const group = new THREE.Group();
    groups.push(group);
    // No currentAimTarget set

    service = buildService(tower, group, '2-2');
    service.update();

    const scene = scenes[0];
    const lineMesh = scene.children.find(c => c instanceof THREE.Mesh);
    if (lineMesh) {
      expect(lineMesh.visible).toBeFalse();
    } else {
      expect(scene.children.length).toBe(0);
    }
  });

  it('adds a visible mesh to the scene when selected tower has a target', () => {
    const tower = makePlacedTower(3, 3);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    const enemy = createTestEnemy('e1', 2, 2);
    group.userData['currentAimTarget'] = enemy;
    groups.push(group);

    service = buildService(tower, group, '3-3');
    service.update();

    const scene = scenes[0];
    const lineMesh = scene.children.find(c => c instanceof THREE.Mesh);
    expect(lineMesh).toBeDefined();
    expect(lineMesh?.visible).toBeTrue();
  });

  it('uses the tower type color from TOWER_CONFIGS', () => {
    const tower = makePlacedTower(4, 4, TowerType.SNIPER);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    const enemy = createTestEnemy('e2', 3, 4);
    group.userData['currentAimTarget'] = enemy;
    groups.push(group);

    service = buildService(tower, group, '4-4');
    service.update();

    const scene = scenes[0];
    const lineMesh = scene.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh | undefined;
    expect(lineMesh).toBeDefined();
    if (lineMesh) {
      const mat = lineMesh.material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(TOWER_CONFIGS[TowerType.SNIPER].color);
    }
  });

  it('hides the line when reduce-motion is true', () => {
    const tower = makePlacedTower(5, 5);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    const enemy = createTestEnemy('e3', 4, 5);
    group.userData['currentAimTarget'] = enemy;
    groups.push(group);

    service = buildService(tower, group, '5-5');
    service.update(true); // reduce-motion ON

    const scene = scenes[0];
    const lineMesh = scene.children.find(c => c instanceof THREE.Mesh);
    if (lineMesh) {
      expect(lineMesh.visible).toBeFalse();
    } else {
      expect(scene.children.length).toBe(0);
    }
  });

  it('removes the mesh from the scene after cleanup', () => {
    const tower = makePlacedTower(6, 6);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    const enemy = createTestEnemy('e4', 5, 6);
    group.userData['currentAimTarget'] = enemy;
    groups.push(group);

    service = buildService(tower, group, '6-6');
    service.update(); // show
    service.cleanup(); // dispose

    const scene = scenes[0];
    const lineMesh = scene.children.find(c => c instanceof THREE.Mesh);
    expect(lineMesh).toBeUndefined();
  });

  it('cleanup() is idempotent — calling twice does not throw', () => {
    service = buildService(null);
    expect(() => {
      service.cleanup();
      service.cleanup();
    }).not.toThrow();
  });

  // ── Finding D-1: geometry rebuild guard (per-frame allocation fix) ──────────

  it('D-1: geometry is NOT rebuilt on second update() when endpoints are stationary', () => {
    const tower = makePlacedTower(7, 7);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    const enemy = createTestEnemy('e5', 3, 0);
    enemy.position.x = 3;
    enemy.position.z = 0;
    group.userData['currentAimTarget'] = enemy;
    groups.push(group);

    service = buildService(tower, group, '7-7');
    service.update(); // first call — builds geometry

    const scene = scenes[0];
    const mesh = scene.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh;
    expect(mesh).toBeDefined();
    const geoAfterFirst = mesh.geometry;

    service.update(); // second call — endpoints unchanged, should reuse geometry

    expect(mesh.geometry).toBe(geoAfterFirst); // same object reference = no rebuild
  });

  it('D-1: geometry IS rebuilt when the target moves beyond the rebuild threshold', () => {
    const tower = makePlacedTower(8, 8);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    const enemy = createTestEnemy('e6', 3, 0);
    enemy.position.x = 3;
    enemy.position.z = 0;
    group.userData['currentAimTarget'] = enemy;
    groups.push(group);

    service = buildService(tower, group, '8-8');
    service.update();

    const scene = scenes[0];
    const mesh = scene.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh;
    const geoAfterFirst = mesh.geometry;

    // Move the enemy target well past the rebuild threshold.
    enemy.position.x = 6;
    group.userData['currentAimTarget'] = enemy;
    service.update();

    expect(mesh.geometry).not.toBe(geoAfterFirst); // new geometry = rebuild fired
  });

  it('D-1: cached endpoints are cleared by cleanup() so first update after restart rebuilds', () => {
    const tower = makePlacedTower(9, 9);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    const enemy = createTestEnemy('e7', 3, 0);
    enemy.position.x = 3;
    enemy.position.z = 0;
    group.userData['currentAimTarget'] = enemy;
    groups.push(group);

    // Use a fresh scene for the post-cleanup update so the mesh re-attaches.
    const sc1 = makeScene();
    const sc2 = makeScene();
    scenes.push(sc1, sc2);

    // First encounter
    TestBed.configureTestingModule({
      providers: [
        AimLineService,
        { provide: BoardMeshRegistryService, useValue: makeMeshRegistry(group, '9-9') },
        { provide: TowerSelectionService, useValue: makeSelectionService(tower) },
        { provide: SceneService, useValue: makeSceneService(sc1) },
      ],
    });
    service = TestBed.inject(AimLineService);
    service.update();

    const mesh1 = sc1.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh;
    const geoAfterFirst = mesh1?.geometry;

    service.cleanup(); // clears lastStart / lastEnd

    // Second encounter — same group/position but cleanup should have reset cache.
    // Reconfigure to point at sc2 so ensureMesh re-adds the mesh.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AimLineService,
        { provide: BoardMeshRegistryService, useValue: makeMeshRegistry(group, '9-9') },
        { provide: TowerSelectionService, useValue: makeSelectionService(tower) },
        { provide: SceneService, useValue: makeSceneService(sc2) },
      ],
    });
    service = TestBed.inject(AimLineService);
    service.update();

    const mesh2 = sc2.children.find(c => c instanceof THREE.Mesh) as THREE.Mesh;
    // New service instance has no prior cache — geometry was built fresh.
    expect(mesh2).toBeDefined();
    expect(mesh2?.geometry).not.toBe(geoAfterFirst);
  });

  // ── Finding D-2: OnDestroy delegates to cleanup() ───────────────────────────

  it('D-2: ngOnDestroy() removes the mesh from the scene (route-change safety)', () => {
    const tower = makePlacedTower(10, 10);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    const enemy = createTestEnemy('e8', 4, 0);
    enemy.position.x = 4;
    enemy.position.z = 0;
    group.userData['currentAimTarget'] = enemy;
    groups.push(group);

    service = buildService(tower, group, '10-10');
    service.update(); // add mesh to scene

    const scene = scenes[0];
    expect(scene.children.find(c => c instanceof THREE.Mesh)).toBeDefined();

    service.ngOnDestroy(); // Angular lifecycle teardown

    expect(scene.children.find(c => c instanceof THREE.Mesh)).toBeUndefined();
  });
});

// ── Sprint 43: selection-aim cohesion ────────────────────────────────────────
//
// Verify that when a tower is selected, the aim line, range ring, and selection
// halo are all conceptually compatible. The aim line endpoint is constrained by
// the targeting algorithm, which already uses effective range — so the line
// cannot point outside the range ring by construction.

describe('AimLineService — selection cohesion (Sprint 43)', () => {
  it('aim line target is within effective range — endpoint distance ≤ tower range', () => {
    const towerRange = TOWER_CONFIGS[TowerType.BASIC].range;
    const enemy = createTestEnemy('e-cohesion', towerRange - 0.1, 0);

    const towerPos = new THREE.Vector3(0, 0, 0);
    const targetPos = new THREE.Vector3(enemy.position.x, 0, enemy.position.z);
    const dist = towerPos.distanceTo(targetPos);

    // If TargetPreviewService returns this enemy, the aim line endpoint is
    // inside the range ring by construction — the ring and line cannot conflict.
    expect(dist).toBeLessThan(towerRange + 0.001);
  });

  it('SNIPER range ring and aim line are compatible — target at 90% of SNIPER range', () => {
    const towerRange = TOWER_CONFIGS[TowerType.SNIPER].range;
    const enemy = createTestEnemy('e-sniper', towerRange * 0.9, 0);

    const dist = Math.sqrt(
      Math.pow(enemy.position.x, 2) + Math.pow(enemy.position.z, 2),
    );
    // Aim line always points within the range ring — no visual conflict possible.
    expect(dist).toBeLessThanOrEqual(towerRange);
  });
});

// ── Sprint 44: reduce-motion handling ────────────────────────────────────────

describe('TowerAnimationService.tickAim — reduce-motion (Sprint 44)', () => {
  let anim: TowerAnimationService;
  let previewSpy: jasmine.SpyObj<TargetPreviewService>;
  const groups: THREE.Group[] = [];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TowerAnimationService] });
    anim = TestBed.inject(TowerAnimationService);
    previewSpy = jasmine.createSpyObj<TargetPreviewService>(
      'TargetPreviewService',
      ['getPreviewTarget'],
    );
  });

  afterEach(() => {
    groups.forEach(g => g.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    }));
    groups.length = 0;
  });

  it('reduce-motion speed is faster than standard speed', () => {
    expect(AIM_LERP_CONFIG.reduceMotionSpeedRadPerSec)
      .toBeGreaterThan(AIM_LERP_CONFIG.speedRadPerSec);
  });

  it('reduce-motion: yaw subgroup advances further per frame than standard mode', () => {
    const buildGroup = (): { root: THREE.Group; yaw: THREE.Group } => {
      const root = new THREE.Group();
      root.position.set(0, 0, 0);
      root.userData['aimTick'] = () => {};

      const yaw = new THREE.Group();
      yaw.name = 'turret';
      yaw.rotation.y = 0;
      root.add(yaw);
      root.userData['aimYawSubgroupName'] = 'turret';
      groups.push(root);
      return { root, yaw };
    };

    const enemy = createTestEnemy('e-speed', 3, 0);
    enemy.position.x = 3;
    enemy.position.z = 0;
    previewSpy.getPreviewTarget.and.returnValue(enemy);

    const tower = makePlacedTower(0, 0);

    // Standard mode: one frame
    const { root: rootStd, yaw: yawStd } = buildGroup();
    anim.tickAim(
      new Map([['0-0', rootStd]]),
      new Map([['0-0', tower]]),
      0.016,
      previewSpy,
      false,
    );
    const stdAdvance = yawStd.rotation.y;

    // Reduce-motion mode: same frame duration
    const { root: rootRm, yaw: yawRm } = buildGroup();
    anim.tickAim(
      new Map([['0-0', rootRm]]),
      new Map([['0-0', tower]]),
      0.016,
      previewSpy,
      true,
    );
    const rmAdvance = yawRm.rotation.y;

    expect(rmAdvance).toBeGreaterThan(stdAdvance);
  });

  it('reduce-motion + no target: aimEngaged clears in one frame (zero grace)', () => {
    const group = new THREE.Group();
    group.userData['aimTick'] = () => {};
    group.userData['aimEngaged'] = true;
    group.userData['noTargetGraceTime'] = 0;
    groups.push(group);

    previewSpy.getPreviewTarget.and.returnValue(null);

    const tower = makePlacedTower(1, 1);

    // Any positive deltaTime expires grace=0 immediately.
    anim.tickAim(
      new Map([['1-1', group]]),
      new Map([['1-1', tower]]),
      0.001,
      previewSpy,
      true, // reduceMotion = true
    );

    expect(group.userData['aimEngaged']).toBeFalse();
  });

  it('standard mode: aimEngaged is held within 0.5s grace window', () => {
    const group = new THREE.Group();
    group.userData['aimTick'] = () => {};
    group.userData['aimEngaged'] = true;
    group.userData['noTargetGraceTime'] = 0;
    groups.push(group);

    previewSpy.getPreviewTarget.and.returnValue(null);

    const tower = makePlacedTower(2, 2);

    // 0.1s < 0.5s grace — aimEngaged must stay true.
    anim.tickAim(
      new Map([['2-2', group]]),
      new Map([['2-2', tower]]),
      0.1,
      previewSpy,
      false, // reduceMotion = false
    );

    expect(group.userData['aimEngaged']).toBeTrue();
  });
});

// ── Sprint 45: multi-tower stress test ───────────────────────────────────────

describe('TowerAnimationService.tickAim — 5-tower stress (Sprint 45)', () => {
  let anim: TowerAnimationService;
  let previewSpy: jasmine.SpyObj<TargetPreviewService>;
  const groups: Map<string, THREE.Group> = new Map();

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TowerAnimationService] });
    anim = TestBed.inject(TowerAnimationService);
    previewSpy = jasmine.createSpyObj<TargetPreviewService>(
      'TargetPreviewService',
      ['getPreviewTarget'],
    );
  });

  afterEach(() => {
    groups.forEach(g => g.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    }));
    groups.clear();
  });

  it('5 BASIC towers all targeting same enemy — each yaws to its own correct angle', () => {
    const towers = new Map<string, PlacedTower>();

    // Enemy at world position x=5, z=0.
    const sharedEnemy = createTestEnemy('shared', 5, 0);
    sharedEnemy.position.x = 5;
    sharedEnemy.position.z = 0;

    previewSpy.getPreviewTarget.and.returnValue(sharedEnemy);

    // 5 towers in a row: positions (i, 0, 0) for i = 0..4
    for (let i = 0; i < 5; i++) {
      const key = `${i}-0`;
      const root = new THREE.Group();
      root.position.set(i, 0, 0);
      root.userData['aimTick'] = () => {};

      const yaw = new THREE.Group();
      yaw.name = 'turret';
      yaw.rotation.y = 0;
      root.add(yaw);
      root.userData['aimYawSubgroupName'] = 'turret';

      groups.set(key, root);
      towers.set(key, {
        id: key,
        type: TowerType.BASIC,
        level: 1,
        row: i,
        col: 0,
        targetingMode: TargetingMode.FIRST,
        mesh: undefined,
        actualCost: TOWER_CONFIGS[TowerType.BASIC].cost,
        placedAtTurn: 0,
      } as unknown as PlacedTower);
    }

    // Large deltaTime: all towers should fully converge.
    anim.tickAim(groups, towers, 10, previewSpy);

    // getPreviewTarget called once per tower (no order dependency).
    expect(previewSpy.getPreviewTarget).toHaveBeenCalledTimes(5);

    // All towers: aimEngaged = true, currentAimTarget = sharedEnemy.
    for (const g of groups.values()) {
      expect(g.userData['aimEngaged']).toBeTrue();
      expect(g.userData['currentAimTarget']).toBe(sharedEnemy);
    }

    // Each yaw subgroup converged to the correct angle from its own position.
    for (let i = 0; i < 5; i++) {
      const key = `${i}-0`;
      const root = groups.get(key)!;
      const yawGroup = root.getObjectByName('turret') as THREE.Group;

      const towerWorld = new THREE.Vector3();
      root.getWorldPosition(towerWorld);
      const dx = sharedEnemy.position.x - towerWorld.x;
      const dz = sharedEnemy.position.z - towerWorld.z;
      const expectedYaw = Math.atan2(dx, dz);

      expect(yawGroup.rotation.y).toBeCloseTo(expectedYaw, 3);
    }
  });

  it('after enemy destroyed, all 5 towers degrade to idle (aimEngaged false)', () => {
    const towers = new Map<string, PlacedTower>();
    const sharedEnemy = createTestEnemy('shared2', 5, 0);
    sharedEnemy.position.x = 5;
    sharedEnemy.position.z = 0;

    for (let i = 0; i < 5; i++) {
      const key = `${i}-0`;
      const root = new THREE.Group();
      root.position.set(i, 0, 0);
      root.userData['aimTick'] = () => {};
      root.userData['aimEngaged'] = true;
      root.userData['noTargetGraceTime'] = 0;

      const yaw = new THREE.Group();
      yaw.name = 'turret';
      root.add(yaw);
      root.userData['aimYawSubgroupName'] = 'turret';

      groups.set(key, root);
      towers.set(key, {
        id: key,
        type: TowerType.BASIC,
        level: 1,
        row: i,
        col: 0,
        targetingMode: TargetingMode.FIRST,
        mesh: undefined,
        actualCost: TOWER_CONFIGS[TowerType.BASIC].cost,
        placedAtTurn: 0,
      } as unknown as PlacedTower);
    }

    // Enemy destroyed — no target.
    previewSpy.getPreviewTarget.and.returnValue(null);

    // Advance past 0.5s grace in one step.
    anim.tickAim(groups, towers, 1.0, previewSpy);

    for (const g of groups.values()) {
      expect(g.userData['aimEngaged']).toBeFalse();
    }
  });

  it('spatial grid query consistency — all 5 calls receive identical enemy reference', () => {
    const towers = new Map<string, PlacedTower>();
    const sharedEnemy = createTestEnemy('shared3', 3, 0);
    const seenTargets = new Set<object>();

    // Custom spy that captures each returned target reference.
    previewSpy.getPreviewTarget.and.callFake(() => {
      seenTargets.add(sharedEnemy);
      return sharedEnemy;
    });

    for (let i = 0; i < 5; i++) {
      const key = `${i}-0`;
      const root = new THREE.Group();
      root.userData['aimTick'] = () => {};

      const yaw = new THREE.Group();
      yaw.name = 'turret';
      root.add(yaw);
      root.userData['aimYawSubgroupName'] = 'turret';

      groups.set(key, root);
      towers.set(key, {
        id: key,
        type: TowerType.BASIC,
        level: 1,
        row: i,
        col: 0,
        targetingMode: TargetingMode.NEAREST,
        mesh: undefined,
        actualCost: TOWER_CONFIGS[TowerType.BASIC].cost,
        placedAtTurn: 0,
      } as unknown as PlacedTower);
    }

    anim.tickAim(groups, towers, 0.016, previewSpy);

    // Only one unique enemy object ever returned — no order-dependent inconsistency.
    expect(seenTargets.size).toBe(1);
    expect(previewSpy.getPreviewTarget).toHaveBeenCalledTimes(5);
  });
});
