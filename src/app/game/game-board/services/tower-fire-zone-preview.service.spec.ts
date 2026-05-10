import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { TowerFireZonePreviewService, TOWER_FIRE_ZONE_PREVIEW_CONFIG } from './tower-fire-zone-preview.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TowerSelectionService } from './tower-selection.service';
import { SceneService } from './scene.service';
import { ForwardSimulationService } from './forward-simulation.service';
import { StatusEffectService } from './status-effect.service';
import { PathMutationService } from './path-mutation.service';
import { EnemyService } from './enemy.service';
import { PathfindingService } from './pathfinding.service';
import { CombatLoopService } from './combat-loop.service';
import {
  TowerType,
  TOWER_CONFIGS,
  PlacedTower,
  TargetingMode,
} from '../models/tower.model';
import { Enemy } from '../models/enemy.model';
import { createTestEnemy } from '../testing';

// ── Test helpers ─────────────────────────────────────────────────────────────

function makePlacedTower(row: number, col: number, type = TowerType.BASIC): PlacedTower {
  return {
    id: `${row}-${col}`,
    type,
    level: 1,
    row,
    col,
    targetingMode: TargetingMode.FIRST,
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

function makeSelectionService(tower: PlacedTower | null): Partial<TowerSelectionService> {
  return { selectedTowerInfo: tower } as Partial<TowerSelectionService>;
}

/** Build an EnemyService stub that returns a Map containing the given enemy. */
function makeEnemyService(enemy: Enemy | null): Partial<EnemyService> {
  const map = new Map<string, Enemy>();
  if (enemy) map.set(enemy.id, enemy);
  return { getEnemies: () => map } as Partial<EnemyService>;
}

/** Build a PathfindingService stub that converts grid coords to world coords. */
function makePathfindingService(): Partial<PathfindingService> {
  return {
    gridToWorldPosInto(row: number, col: number, out: { x: number; z: number }): void {
      out.x = col * 1.0;
      out.z = row * 1.0;
    },
  } as Partial<PathfindingService>;
}

function makeForwardSim(
  projectedRow = 0,
  projectedCol = 0,
): Partial<ForwardSimulationService> {
  return {
    projectGridPosition: () => ({ row: projectedRow, col: projectedCol }),
  } as Partial<ForwardSimulationService>;
}

function makeStatusEffectService(slowReduction = 0): Partial<StatusEffectService> {
  return { getSlowTileReduction: () => slowReduction } as Partial<StatusEffectService>;
}

function makePathMutationService(mutated = false): Partial<PathMutationService> {
  return { wasMutatedInLastTurns: () => mutated } as Partial<PathMutationService>;
}

function makeCombatLoopService(turn = 1): Partial<CombatLoopService> {
  return { getTurnNumber: () => turn } as Partial<CombatLoopService>;
}

// ── Build-service helpers ─────────────────────────────────────────────────────

interface BuildOptions {
  tower?: PlacedTower | null;
  towerGroup?: THREE.Group;
  towerKey?: string;
  scene?: THREE.Scene;
  enemy?: Enemy | null;
  projectedRow?: number;
  projectedCol?: number;
  slowReduction?: number;
  mutated?: boolean;
  turn?: number;
}

function buildService(options: BuildOptions = {}): {
  service: TowerFireZonePreviewService;
  scene: THREE.Scene;
} {
  const {
    tower = null,
    towerGroup,
    towerKey,
    enemy = null,
    projectedRow = 0,
    projectedCol = 0,
    slowReduction = 0,
    mutated = false,
    turn = 1,
  } = options;
  const scene = options.scene ?? makeScene();

  TestBed.configureTestingModule({
    providers: [
      TowerFireZonePreviewService,
      { provide: BoardMeshRegistryService, useValue: makeMeshRegistry(towerGroup, towerKey) },
      { provide: TowerSelectionService, useValue: makeSelectionService(tower) },
      { provide: SceneService, useValue: makeSceneService(scene) },
      { provide: ForwardSimulationService, useValue: makeForwardSim(projectedRow, projectedCol) },
      { provide: StatusEffectService, useValue: makeStatusEffectService(slowReduction) },
      { provide: PathMutationService, useValue: makePathMutationService(mutated) },
      { provide: EnemyService, useValue: makeEnemyService(enemy) },
      { provide: PathfindingService, useValue: makePathfindingService() },
      { provide: CombatLoopService, useValue: makeCombatLoopService(turn) },
    ],
  });

  return { service: TestBed.inject(TowerFireZonePreviewService), scene };
}

// ── Specs ─────────────────────────────────────────────────────────────────────

describe('TowerFireZonePreviewService', () => {
  afterEach(() => {
    // TestBed.resetTestingModule() is called implicitly after each spec.
  });

  // ── Construction ──────────────────────────────────────────────────────────

  it('creates without error', () => {
    TestBed.configureTestingModule({ providers: [TowerFireZonePreviewService] });
    const service = TestBed.inject(TowerFireZonePreviewService);
    expect(service).toBeTruthy();
    service.cleanup();
  });

  it('update() is a no-op when no services are injected', () => {
    TestBed.configureTestingModule({ providers: [TowerFireZonePreviewService] });
    const service = TestBed.inject(TowerFireZonePreviewService);
    expect(() => service.update()).not.toThrow();
    service.cleanup();
  });

  // ── Hidden when no selection ──────────────────────────────────────────────

  it('does not add a line to the scene when no tower is selected', () => {
    const { service, scene } = buildService({ tower: null });
    service.update();
    expect(scene.children.length).toBe(0);
    service.cleanup();
  });

  it('does not add a line when selected tower group is not in registry', () => {
    const tower = makePlacedTower(1, 1);
    // Registry is empty — no group for this tower key
    const { service, scene } = buildService({ tower });
    service.update();
    expect(scene.children.length).toBe(0);
    service.cleanup();
  });

  // ── Hidden when no currentAimTarget ──────────────────────────────────────

  it('does not show line when towerGroup has no currentAimTarget', () => {
    const tower = makePlacedTower(2, 2);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    // No currentAimTarget set on userData

    const { service, scene } = buildService({
      tower,
      towerGroup: group,
      towerKey: '2-2',
    });
    service.update();

    const line = scene.children.find(c => c instanceof THREE.Line);
    if (line) {
      expect(line.visible).toBeFalse();
    } else {
      expect(scene.children.length).toBe(0);
    }
    service.cleanup();
  });

  it('does not show line when currentAimTarget has no id property', () => {
    const tower = makePlacedTower(3, 3);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    group.userData['currentAimTarget'] = { position: { x: 1, y: 0, z: 1 } }; // no id

    const { service, scene } = buildService({
      tower,
      towerGroup: group,
      towerKey: '3-3',
    });
    service.update();

    const line = scene.children.find(c => c instanceof THREE.Line);
    if (line) {
      expect(line.visible).toBeFalse();
    } else {
      expect(scene.children.length).toBe(0);
    }
    service.cleanup();
  });

  it('does not show line when enemy is not found in EnemyService', () => {
    const tower = makePlacedTower(4, 4);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);
    group.userData['currentAimTarget'] = { id: 'missing-enemy', position: { x: 2, y: 0, z: 2 } };

    // EnemyService returns empty map (enemy = null)
    const { service, scene } = buildService({
      tower,
      towerGroup: group,
      towerKey: '4-4',
      enemy: null,
    });
    service.update();

    const line = scene.children.find(c => c instanceof THREE.Line);
    if (line) {
      expect(line.visible).toBeFalse();
    } else {
      expect(scene.children.length).toBe(0);
    }
    service.cleanup();
  });

  // ── Hidden when projected == current (stationary target) ─────────────────

  it('hides when projected position equals current position (target stationary)', () => {
    const tower = makePlacedTower(5, 5);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    const enemy = createTestEnemy('e-stationary', 3, 2);
    // gridPosition is row=2, col=3 → world x=3, z=2
    enemy.gridPosition = { row: 2, col: 3 };
    group.userData['currentAimTarget'] = enemy;

    // Projected also row=2, col=3 → identical world position
    const { service, scene } = buildService({
      tower,
      towerGroup: group,
      towerKey: '5-5',
      enemy,
      projectedRow: 2,
      projectedCol: 3,
    });
    service.update();

    const line = scene.children.find(c => c instanceof THREE.Line);
    if (line) {
      expect(line.visible).toBeFalse();
    } else {
      expect(scene.children.length).toBe(0);
    }
    service.cleanup();
  });

  // ── Shows when target will move ───────────────────────────────────────────

  it('adds a visible line to the scene when the target will move next turn', () => {
    const tower = makePlacedTower(6, 6);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    const enemy = createTestEnemy('e-moving', 2, 2);
    enemy.gridPosition = { row: 2, col: 2 };
    enemy.path = [
      { x: 2, y: 2, f: 0, g: 0, h: 0 },
      { x: 2, y: 3, f: 0, g: 1, h: 0 },
    ];
    enemy.pathIndex = 0;
    group.userData['currentAimTarget'] = enemy;

    // Projected position is one tile further: row=3, col=2
    const { service, scene } = buildService({
      tower,
      towerGroup: group,
      towerKey: '6-6',
      enemy,
      projectedRow: 3,
      projectedCol: 2,
    });
    service.update();

    const line = scene.children.find(c => c instanceof THREE.Line);
    expect(line).toBeDefined();
    expect(line?.visible).toBeTrue();
    service.cleanup();
  });

  it('uses LineDashedMaterial with correct opacity from config', () => {
    const tower = makePlacedTower(7, 7);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    const enemy = createTestEnemy('e-mat', 1, 1);
    enemy.gridPosition = { row: 1, col: 1 };
    group.userData['currentAimTarget'] = enemy;

    const { service, scene } = buildService({
      tower,
      towerGroup: group,
      towerKey: '7-7',
      enemy,
      projectedRow: 2,
      projectedCol: 1,
    });
    service.update();

    const line = scene.children.find(c => c instanceof THREE.Line) as THREE.Line | undefined;
    expect(line).toBeDefined();
    if (line) {
      const mat = line.material as THREE.LineDashedMaterial;
      expect(mat).toBeInstanceOf(THREE.LineDashedMaterial);
      expect(mat.opacity).toBeCloseTo(TOWER_FIRE_ZONE_PREVIEW_CONFIG.opacity);
      expect(mat.transparent).toBeTrue();
    }
    service.cleanup();
  });

  it('uses the tower type color from TOWER_CONFIGS', () => {
    const tower = makePlacedTower(8, 8, TowerType.SNIPER);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    const enemy = createTestEnemy('e-color', 1, 1);
    enemy.gridPosition = { row: 1, col: 1 };
    group.userData['currentAimTarget'] = enemy;

    const { service, scene } = buildService({
      tower,
      towerGroup: group,
      towerKey: '8-8',
      enemy,
      projectedRow: 2,
      projectedCol: 1,
    });
    service.update();

    const line = scene.children.find(c => c instanceof THREE.Line) as THREE.Line | undefined;
    expect(line).toBeDefined();
    if (line) {
      const mat = line.material as THREE.LineDashedMaterial;
      expect(mat.color.getHex()).toBe(TOWER_CONFIGS[TowerType.SNIPER].color);
    }
    service.cleanup();
  });

  // ── reduce-motion ─────────────────────────────────────────────────────────

  it('hides the line when reduceMotion is true', () => {
    const tower = makePlacedTower(9, 9);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    const enemy = createTestEnemy('e-rm', 1, 1);
    enemy.gridPosition = { row: 1, col: 1 };
    group.userData['currentAimTarget'] = enemy;

    const { service, scene } = buildService({
      tower,
      towerGroup: group,
      towerKey: '9-9',
      enemy,
      projectedRow: 2,
      projectedCol: 1,
    });
    service.update(true); // reduce-motion ON

    const line = scene.children.find(c => c instanceof THREE.Line);
    if (line) {
      expect(line.visible).toBeFalse();
    } else {
      expect(scene.children.length).toBe(0);
    }
    service.cleanup();
  });

  // ── Disposal ──────────────────────────────────────────────────────────────

  it('removes the line from the scene after cleanup()', () => {
    const tower = makePlacedTower(10, 10);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    const enemy = createTestEnemy('e-dispose', 1, 1);
    enemy.gridPosition = { row: 1, col: 1 };
    group.userData['currentAimTarget'] = enemy;

    const { service, scene } = buildService({
      tower,
      towerGroup: group,
      towerKey: '10-10',
      enemy,
      projectedRow: 2,
      projectedCol: 1,
    });
    service.update(); // adds line to scene
    service.cleanup(); // should remove it

    const line = scene.children.find(c => c instanceof THREE.Line);
    expect(line).toBeUndefined();
  });

  it('cleanup() is idempotent — calling twice does not throw', () => {
    const { service } = buildService({ tower: null });
    expect(() => {
      service.cleanup();
      service.cleanup();
    }).not.toThrow();
  });

  it('ngOnDestroy() removes the line from the scene (route-change safety)', () => {
    const tower = makePlacedTower(11, 11);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    const enemy = createTestEnemy('e-destroy', 1, 1);
    enemy.gridPosition = { row: 1, col: 1 };
    group.userData['currentAimTarget'] = enemy;

    const { service, scene } = buildService({
      tower,
      towerGroup: group,
      towerKey: '11-11',
      enemy,
      projectedRow: 2,
      projectedCol: 1,
    });
    service.update(); // adds line

    expect(scene.children.find(c => c instanceof THREE.Line)).toBeDefined();

    service.ngOnDestroy();

    expect(scene.children.find(c => c instanceof THREE.Line)).toBeUndefined();
  });

  // ── TOWER_FIRE_ZONE_PREVIEW_CONFIG constants ──────────────────────────────

  it('config exports expected keys with positive values', () => {
    expect(TOWER_FIRE_ZONE_PREVIEW_CONFIG.dashSize).toBeGreaterThan(0);
    expect(TOWER_FIRE_ZONE_PREVIEW_CONFIG.gapSize).toBeGreaterThan(0);
    expect(TOWER_FIRE_ZONE_PREVIEW_CONFIG.opacity).toBeGreaterThan(0);
    expect(TOWER_FIRE_ZONE_PREVIEW_CONFIG.opacity).toBeLessThanOrEqual(1);
    expect(TOWER_FIRE_ZONE_PREVIEW_CONFIG.yOffset).toBeGreaterThan(0);
    expect(TOWER_FIRE_ZONE_PREVIEW_CONFIG.minProjectionDistance).toBeGreaterThan(0);
  });

  // ── Slow-tile-reduction passed through ────────────────────────────────────

  it('passes slowTileReduction to forwardSim.projectGridPosition', () => {
    const tower = makePlacedTower(12, 12);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    const enemy = createTestEnemy('e-slow', 1, 1);
    enemy.gridPosition = { row: 1, col: 1 };
    group.userData['currentAimTarget'] = enemy;

    const projectSpy = jasmine.createSpy('projectGridPosition').and.returnValue({ row: 3, col: 1 });
    const forwardSimStub: Partial<ForwardSimulationService> = {
      projectGridPosition: projectSpy,
    };

    TestBed.configureTestingModule({
      providers: [
        TowerFireZonePreviewService,
        { provide: BoardMeshRegistryService, useValue: makeMeshRegistry(group, '12-12') },
        { provide: TowerSelectionService, useValue: makeSelectionService(tower) },
        { provide: SceneService, useValue: makeSceneService(makeScene()) },
        { provide: ForwardSimulationService, useValue: forwardSimStub },
        { provide: StatusEffectService, useValue: makeStatusEffectService(1) }, // slowReduction=1
        { provide: PathMutationService, useValue: makePathMutationService(false) },
        { provide: EnemyService, useValue: makeEnemyService(enemy) },
        { provide: PathfindingService, useValue: makePathfindingService() },
        { provide: CombatLoopService, useValue: makeCombatLoopService(5) },
      ],
    });
    const service = TestBed.inject(TowerFireZonePreviewService);
    service.update();

    expect(projectSpy).toHaveBeenCalledWith(enemy, 1, 1, 0, false);
    service.cleanup();
  });

  // ── VEINSEEKER boost detection ────────────────────────────────────────────

  it('passes veinseekerBoosted=true when path was mutated recently', () => {
    const tower = makePlacedTower(13, 13);
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    const enemy = createTestEnemy('e-vein', 1, 1);
    enemy.gridPosition = { row: 1, col: 1 };
    group.userData['currentAimTarget'] = enemy;

    const projectSpy = jasmine.createSpy('projectGridPosition').and.returnValue({ row: 3, col: 1 });
    const forwardSimStub: Partial<ForwardSimulationService> = {
      projectGridPosition: projectSpy,
    };

    TestBed.configureTestingModule({
      providers: [
        TowerFireZonePreviewService,
        { provide: BoardMeshRegistryService, useValue: makeMeshRegistry(group, '13-13') },
        { provide: TowerSelectionService, useValue: makeSelectionService(tower) },
        { provide: SceneService, useValue: makeSceneService(makeScene()) },
        { provide: ForwardSimulationService, useValue: forwardSimStub },
        { provide: StatusEffectService, useValue: makeStatusEffectService(0) },
        { provide: PathMutationService, useValue: makePathMutationService(true) }, // mutated
        { provide: EnemyService, useValue: makeEnemyService(enemy) },
        { provide: PathfindingService, useValue: makePathfindingService() },
        { provide: CombatLoopService, useValue: makeCombatLoopService(3) },
      ],
    });
    const service = TestBed.inject(TowerFireZonePreviewService);
    service.update();

    expect(projectSpy).toHaveBeenCalledWith(enemy, 1, 0, 0, true);
    service.cleanup();
  });
});
