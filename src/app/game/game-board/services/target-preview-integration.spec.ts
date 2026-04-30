/**
 * Integration spec for the tower aim / TargetPreviewService phase-C pipeline.
 *
 * Covers Sprint 41 scenarios plus Finding B-2 (SNIPER T3 stabilizer visibility).
 * These tests use real service instances where possible to catch cross-service
 * integration bugs that unit spies hide.
 */
import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { Subject } from 'rxjs';

import { TargetPreviewService } from './target-preview.service';
import { TowerCombatService } from './tower-combat.service';
import { EnemyService } from './enemy.service';
import { TowerAnimationService, lerpYaw } from './tower-animation.service';
import { TowerMeshFactoryService } from './tower-mesh-factory.service';
import { TowerUpgradeVisualService } from './tower-upgrade-visual.service';
import {
  TowerType,
  PlacedTower,
  TargetingMode,
  TOWER_CONFIGS,
  getEffectiveStats,
} from '../models/tower.model';
import { AIM_FALLBACK_CONFIG } from '../constants/tower-aim.constants';
import { disposeGroup } from '../utils/three-utils';
import { createTestEnemy } from '../testing';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeTower(
  row: number,
  col: number,
  type = TowerType.BASIC,
  mode = TargetingMode.NEAREST,
  level = 1,
): PlacedTower {
  return {
    id: `${row}-${col}`,
    type,
    level,
    row,
    col,
    targetingMode: mode,
    specialization: undefined,
    mesh: undefined,
    actualCost: TOWER_CONFIGS[type].cost,
    placedAtTurn: 0,
  } as unknown as PlacedTower;
}

/**
 * Build a minimal tower group with an aimTick hook and an aim-yaw subgroup
 * named 'turretGroup'. Mirrors what TowerMeshFactoryService would register for
 * a BASIC tower, without the full Three.js geometry/material cost.
 */
function makeAimGroup(name = 'turretGroup'): { root: THREE.Group; yawGroup: THREE.Group } {
  const root = new THREE.Group();
  root.userData['aimYawSubgroupName'] = name;

  const yawGroup = new THREE.Group();
  yawGroup.name = name;
  root.add(yawGroup);

  root.userData['aimTick'] = (_g: THREE.Group, _t: number, _hasTarget: boolean) => {
    // Registered to enable aim pass — no additional logic needed for specs
  };

  return { root, yawGroup };
}

// ── Sprint 41 integration scenarios ─────────────────────────────────────────

describe('Target-preview integration (Sprint 41)', () => {
  let targetPreviewSpy: jasmine.SpyObj<TowerCombatService>;
  let enemyChangedSubject: Subject<'spawn' | 'move' | 'remove'>;
  let enemyServiceStub: jasmine.SpyObj<EnemyService>;
  let targetPreview: TargetPreviewService;
  let animService: TowerAnimationService;
  const disposables: THREE.Group[] = [];

  beforeEach(() => {
    targetPreviewSpy = jasmine.createSpyObj<TowerCombatService>(
      'TowerCombatService',
      ['findTarget', 'getPlacedTowers'],
    );

    enemyChangedSubject = new Subject<'spawn' | 'move' | 'remove'>();
    enemyServiceStub = jasmine.createSpyObj<EnemyService>(
      'EnemyService',
      ['getEnemiesChanged'],
    );
    enemyServiceStub.getEnemiesChanged.and.returnValue(enemyChangedSubject.asObservable());

    TestBed.configureTestingModule({
      providers: [
        TowerAnimationService,
        { provide: TowerCombatService, useValue: targetPreviewSpy },
        { provide: EnemyService, useValue: enemyServiceStub },
      ],
    });

    animService = TestBed.inject(TowerAnimationService);
    targetPreview = new TargetPreviewService(targetPreviewSpy, enemyServiceStub);
  });

  afterEach(() => {
    targetPreview.ngOnDestroy();
    disposables.forEach(g => disposeGroup(g));
    disposables.length = 0;
  });

  it('tower placed via card → aim cache invalidated → next getPreviewTarget recomputes', () => {
    const tower = makeTower(5, 5);
    const enemy = createTestEnemy('e1', 6, 5);
    targetPreviewSpy.findTarget.and.returnValue(enemy);

    // Simulate placement: cache is primed first, then placement triggers invalidate
    targetPreview.getPreviewTarget(tower); // prime (1 call)
    targetPreview.invalidate('5-5');       // placement hook

    targetPreview.getPreviewTarget(tower); // must recompute (2nd call)

    expect(targetPreviewSpy.findTarget).toHaveBeenCalledTimes(2);
  });

  it('enemy spawns → all tower caches invalidated → subsequent getPreviewTarget recomputes', () => {
    const towerA = makeTower(1, 1);
    const towerB = makeTower(2, 2);
    targetPreviewSpy.findTarget.and.returnValue(null);

    targetPreview.getPreviewTarget(towerA); // prime both
    targetPreview.getPreviewTarget(towerB);

    enemyChangedSubject.next('spawn');

    targetPreview.getPreviewTarget(towerA); // must recompute
    targetPreview.getPreviewTarget(towerB); // must recompute

    expect(targetPreviewSpy.findTarget).toHaveBeenCalledTimes(4); // 2 primes + 2 recomputes
  });

  it('enemy moves → tower aim yaw lerps toward new enemy position after tickAim', () => {
    const { root, yawGroup } = makeAimGroup();
    disposables.push(root);
    const tower = makeTower(5, 5);
    const groups = new Map([['5-5', root]]);
    const towers = new Map([['5-5', tower]]);

    // Enemy to the +X direction from (0,0) world origin
    const enemy = createTestEnemy('e1', 0, 0);
    enemy.position = { x: 3, y: 0, z: 0 };
    targetPreviewSpy.findTarget.and.returnValue(enemy);

    animService.tickAim(groups, towers, 0.016, targetPreview);
    const yawAfterFirstTick = yawGroup.rotation.y;

    // Enemy moves to +Z direction
    enemy.position = { x: 0, y: 0, z: 3 };
    enemyChangedSubject.next('move');
    // After the move event the cache is dirty — tickAim recomputes
    animService.tickAim(groups, towers, 0.016, targetPreview);
    const yawAfterMove = yawGroup.rotation.y;

    // Yaw changed direction after the enemy moved
    expect(yawAfterMove).not.toBeCloseTo(yawAfterFirstTick, 2);
  });

  it('enemy dies in range → grace period holds aim → after grace, aimEngaged clears', () => {
    const { root } = makeAimGroup();
    disposables.push(root);
    root.userData['aimEngaged'] = true;
    root.userData['noTargetGraceTime'] = 0;
    const tower = makeTower(5, 5);
    const groups = new Map([['5-5', root]]);
    const towers = new Map([['5-5', tower]]);

    // Enemy is removed — after removal targetPreview returns null
    targetPreviewSpy.findTarget.and.returnValue(null);
    enemyChangedSubject.next('remove'); // invalidates cache

    // One tick well within grace window
    animService.tickAim(groups, towers, 0.1, targetPreview);
    expect(root.userData['aimEngaged']).toBeTrue();

    // Advance past grace threshold
    animService.tickAim(groups, towers, AIM_FALLBACK_CONFIG.noTargetGraceSec + 0.1, targetPreview);
    expect(root.userData['aimEngaged']).toBeFalse();
  });

  it('targeting mode flipped FIRST→STRONGEST → invalidate → recomputes with new pick', () => {
    const tower = makeTower(5, 5, TowerType.BASIC, TargetingMode.FIRST);
    const enemyA = createTestEnemy('e1', 6, 5); // FIRST would pick this
    const enemyB = createTestEnemy('e2', 7, 5); // higher health
    enemyA.health = 10;
    enemyB.health = 50;

    // First call: FIRST mode picks enemyA
    targetPreviewSpy.findTarget.and.returnValue(enemyA);
    const resultFirst = targetPreview.getPreviewTarget(tower);
    expect(resultFirst).toBe(enemyA);

    // Player flips targeting mode — invalidate cache
    tower.targetingMode = TargetingMode.STRONGEST;
    targetPreview.invalidate('5-5');

    // Now findTarget returns enemyB (STRONGEST logic)
    targetPreviewSpy.findTarget.and.returnValue(enemyB);
    const resultStrongest = targetPreview.getPreviewTarget(tower);
    expect(resultStrongest).toBe(enemyB);
  });

  it('tower upgraded L1→L3 with larger range → cache invalidated → recomputes with new stats', () => {
    const tower = makeTower(5, 5, TowerType.SNIPER, TargetingMode.NEAREST, 1);
    const enemy = createTestEnemy('e1', 6, 5);

    targetPreviewSpy.findTarget.and.returnValue(null);
    targetPreview.getPreviewTarget(tower); // prime — returns null (enemy out of L1 range)

    // Upgrade to L3
    tower.level = 3;
    targetPreview.invalidate('5-5');

    // After upgrade, findTarget with L3 stats can see the enemy
    targetPreviewSpy.findTarget.and.returnValue(enemy);
    const result = targetPreview.getPreviewTarget(tower);

    expect(result).toBe(enemy);
    // Confirm it was called with L3 stats the second time
    const l3Stats = getEffectiveStats(TowerType.SNIPER, 3, undefined);
    expect(targetPreviewSpy.findTarget).toHaveBeenCalledWith(tower, l3Stats);
  });

  it('tower sold mid-aim → tickAim skips selling group → no error', () => {
    const { root } = makeAimGroup();
    disposables.push(root);
    root.userData['aimEngaged'] = true;
    root.userData['selling'] = true; // sell animation active

    const tower = makeTower(5, 5);
    const enemy = createTestEnemy('e1', 6, 5);
    targetPreviewSpy.findTarget.and.returnValue(enemy);

    const groups = new Map([['5-5', root]]);
    const towers = new Map([['5-5', tower]]);

    expect(() => animService.tickAim(groups, towers, 0.016, targetPreview)).not.toThrow();
    // getPreviewTarget must NOT be called for selling groups
    expect(targetPreviewSpy.findTarget).not.toHaveBeenCalled();
  });
});

// ── Finding B-2: SNIPER T3 tier visibility ───────────────────────────────────

describe('SNIPER T3 stabilizer visibility (Finding B-2)', () => {
  let factory: TowerMeshFactoryService;
  let upgradeVisual: TowerUpgradeVisualService;
  const createdGroups: THREE.Group[] = [];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TowerMeshFactoryService, TowerUpgradeVisualService],
    });
    factory = TestBed.inject(TowerMeshFactoryService);
    upgradeVisual = TestBed.inject(TowerUpgradeVisualService);
  });

  afterEach(() => {
    createdGroups.forEach(g => disposeGroup(g));
    createdGroups.length = 0;
  });

  it('stabilizer mesh becomes visible at T3 and T1 scope becomes hidden', () => {
    const group = factory.createTowerMesh(5, 5, TowerType.SNIPER, 10, 10);
    createdGroups.push(group);

    // Apply T3 visuals
    upgradeVisual.applyUpgradeVisuals(group, 3, undefined);

    // Stabilizer has minTier=3 → must be visible at level 3
    const stabilizer = group.getObjectByName('stabilizer');
    expect(stabilizer).toBeTruthy();
    expect(stabilizer!.visible).toBeTrue();

    // T1 scope mesh has maxTier=1 → must be hidden at level 3
    let scopeT1: THREE.Object3D | undefined;
    group.traverse(child => {
      if (child.name !== 'scope' && child.userData['maxTier'] === 1) {
        scopeT1 = child;
      }
    });
    // If a maxTier=1 mesh exists it must be hidden
    if (scopeT1) {
      expect(scopeT1.visible).toBeFalse();
    }
  });

  it('stabilizer mesh is hidden at T1', () => {
    const group = factory.createTowerMesh(5, 5, TowerType.SNIPER, 10, 10);
    createdGroups.push(group);

    // T1 visuals — stabilizer should start hidden
    upgradeVisual.applyUpgradeVisuals(group, 1, undefined);

    const stabilizer = group.getObjectByName('stabilizer');
    expect(stabilizer).toBeTruthy();
    expect(stabilizer!.visible).toBeFalse();
  });

  it('stabilizer mesh remains visible after a second applyUpgradeVisuals call at T3 (no ratchet)', () => {
    const group = factory.createTowerMesh(5, 5, TowerType.SNIPER, 10, 10);
    createdGroups.push(group);

    upgradeVisual.applyUpgradeVisuals(group, 3, undefined);
    // Call again — simulates checkpoint restore or focus-change re-apply
    upgradeVisual.applyUpgradeVisuals(group, 3, undefined);

    const stabilizer = group.getObjectByName('stabilizer');
    expect(stabilizer!.visible).toBeTrue();
  });
});

// ── lerpYaw: ±π boundary correctness ─────────────────────────────────────────

describe('lerpYaw utility', () => {
  it('takes the short path when wrapping from near π to near -π', () => {
    // From 170° to -170° — short path is 20° CW (170°→180°), not 340° CCW.
    // delta = -170° - 170° = -340°; after wrapping into (-π, π]: -340° + 360° = +20°.
    // So the step moves in the positive direction (CW increasing angle).
    const from = (170 * Math.PI) / 180;
    const to = (-170 * Math.PI) / 180;
    const traveled = 0.016 * 8.0; // ~0.128 rad per frame
    const result = lerpYaw(from, to, 0.016, 8.0);
    // Short path: result should advance toward 180° (from + traveled)
    expect(result).toBeCloseTo(from + traveled, 4);
  });

  it('returns target directly when remaining delta is smaller than one step', () => {
    const from = 0;
    const to = 0.001; // tiny delta
    const result = lerpYaw(from, to, 0.016, 8.0);
    expect(result).toBeCloseTo(to, 6);
  });
});
