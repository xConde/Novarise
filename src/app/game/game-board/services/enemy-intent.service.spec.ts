import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { EnemyIntentService } from './enemy-intent.service';
import { EnemyService } from './enemy.service';
import { ForwardSimulationService } from './forward-simulation.service';
import { StatusEffectService } from './status-effect.service';
import { PathMutationService } from './path-mutation.service';
import { SceneService } from './scene.service';
import { TextSpritePoolService } from './text-sprite-pool.service';
import { CombatLoopService } from './combat-loop.service';
import { Enemy, EnemyType, GridNode } from '../models/enemy.model';
import { ENEMY_INTENT_CONFIG } from '../constants/enemy-intent.constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePath(length: number): GridNode[] {
  return Array.from({ length }, (_, i) => ({ x: i, y: 0, f: 0, g: 0, h: 0 }));
}

function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 'e1',
    type: EnemyType.BASIC,
    position: { x: 2, y: 0, z: 3 },
    gridPosition: { row: 0, col: 0 },
    health: 10,
    maxHealth: 10,
    speed: 1,
    value: 5,
    path: makePath(10),
    pathIndex: 0,
    distanceTraveled: 0,
    leakDamage: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Stub factories — avoid real Three.js Scene / WebGL in test bed
// ---------------------------------------------------------------------------

function makeSceneSpy(): jasmine.SpyObj<SceneService> {
  const scene = new THREE.Scene();
  const spy = jasmine.createSpyObj<SceneService>('SceneService', ['getScene']);
  spy.getScene.and.returnValue(scene);
  return spy;
}

function makePoolSpy(): jasmine.SpyObj<TextSpritePoolService> {
  let spriteCount = 0;
  const acquiredSprites: THREE.Sprite[] = [];

  const spy = jasmine.createSpyObj<TextSpritePoolService>(
    'TextSpritePoolService',
    ['acquire', 'release', 'dispose'],
  );

  spy.acquire.and.callFake(() => {
    const mat = new THREE.SpriteMaterial();
    const sprite = new THREE.Sprite(mat);
    sprite.name = `intent-sprite-${spriteCount++}`;
    acquiredSprites.push(sprite);
    return sprite;
  });

  spy.release.and.callFake((sprite: THREE.Sprite) => {
    if (sprite.parent) sprite.parent.remove(sprite);
  });

  spy.dispose.and.callFake(() => {
    for (const s of acquiredSprites) {
      if (s.parent) s.parent.remove(s);
      (s.material as THREE.SpriteMaterial).dispose();
    }
    acquiredSprites.length = 0;
  });

  return spy;
}

function makeEnemySpy(enemies: Map<string, Enemy>): jasmine.SpyObj<EnemyService> {
  const spy = jasmine.createSpyObj<EnemyService>('EnemyService', ['getEnemies']);
  spy.getEnemies.and.callFake(() => enemies);
  return spy;
}

function makeStatusSpy(): jasmine.SpyObj<StatusEffectService> {
  const spy = jasmine.createSpyObj<StatusEffectService>('StatusEffectService', ['getSlowTileReduction']);
  spy.getSlowTileReduction.and.returnValue(0);
  return spy;
}

function makeForwardSimSpy(result: number): jasmine.SpyObj<ForwardSimulationService> {
  const spy = jasmine.createSpyObj<ForwardSimulationService>('ForwardSimulationService', ['projectTurnsToExit']);
  spy.projectTurnsToExit.and.returnValue(result);
  return spy;
}

function makeCombatLoopSpy(): jasmine.SpyObj<CombatLoopService> {
  const spy = jasmine.createSpyObj<CombatLoopService>('CombatLoopService', ['getTurnNumber']);
  spy.getTurnNumber.and.returnValue(1);
  return spy;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EnemyIntentService', () => {
  let service: EnemyIntentService;
  let sceneSpy: jasmine.SpyObj<SceneService>;
  let poolSpy: jasmine.SpyObj<TextSpritePoolService>;
  let enemies: Map<string, Enemy>;
  let forwardSim: jasmine.SpyObj<ForwardSimulationService>;
  let statusSpy: jasmine.SpyObj<StatusEffectService>;

  function configure(turnResult = 6): void {
    sceneSpy = makeSceneSpy();
    poolSpy = makePoolSpy();
    enemies = new Map<string, Enemy>();
    forwardSim = makeForwardSimSpy(turnResult);
    statusSpy = makeStatusSpy();

    TestBed.configureTestingModule({
      providers: [
        EnemyIntentService,
        { provide: EnemyService, useValue: makeEnemySpy(enemies) },
        { provide: ForwardSimulationService, useValue: forwardSim },
        { provide: StatusEffectService, useValue: statusSpy },
        { provide: CombatLoopService, useValue: makeCombatLoopSpy() },
        { provide: PathMutationService, useValue: null },
        { provide: SceneService, useValue: sceneSpy },
        { provide: TextSpritePoolService, useValue: poolSpy },
      ],
    });

    service = TestBed.inject(EnemyIntentService);
  }

  afterEach(() => {
    service.ngOnDestroy();
    // Dispose all acquired sprite materials to prevent leaks across tests
    poolSpy.dispose();
    // Dispose the underlying Three.js scene if one was created
    const scene = sceneSpy?.getScene();
    scene?.clear();
  });

  // -------------------------------------------------------------------------
  // Empty roster
  // -------------------------------------------------------------------------

  describe('empty enemy set', () => {
    beforeEach(() => configure());

    it('creates no sprites when there are no enemies', () => {
      service.update(false);
      expect(poolSpy.acquire).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Single enemy — sprite creation + position
  // -------------------------------------------------------------------------

  describe('single enemy', () => {
    beforeEach(() => configure(6));

    it('creates a sprite and adds it to the scene', () => {
      const enemy = makeEnemy({ id: 'e1' });
      enemies.set('e1', enemy);

      service.update(false);

      expect(poolSpy.acquire).toHaveBeenCalledTimes(1);
      const scene = sceneSpy.getScene();
      expect(scene.children.length).toBe(1);
    });

    it('positions the sprite at enemy.position + Y offset', () => {
      const enemy = makeEnemy({ id: 'e1', position: { x: 3, y: 0, z: 5 } });
      enemies.set('e1', enemy);

      service.update(false);

      const scene = sceneSpy.getScene();
      const sprite = scene.children[0] as THREE.Sprite;
      expect(sprite.position.x).toBeCloseTo(3);
      expect(sprite.position.y).toBeCloseTo(ENEMY_INTENT_CONFIG.spriteYOffset);
      expect(sprite.position.z).toBeCloseTo(5);
    });

    it('does not re-acquire when same text/color on second call', () => {
      const enemy = makeEnemy({ id: 'e1' });
      enemies.set('e1', enemy);

      service.update(false);
      service.update(false);

      // Second update: same text (6t, green) — should NOT re-acquire
      expect(poolSpy.acquire).toHaveBeenCalledTimes(1);
    });

    it('re-acquires when turns-to-exit changes (text changes)', () => {
      const enemy = makeEnemy({ id: 'e1' });
      enemies.set('e1', enemy);

      service.update(false);
      // Now simulate different projection result
      forwardSim.projectTurnsToExit.and.returnValue(2);
      service.update(false);

      // Should have released the old sprite and acquired a new one
      expect(poolSpy.acquire).toHaveBeenCalledTimes(2);
      expect(poolSpy.release).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Color tier transitions
  // -------------------------------------------------------------------------

  describe('color tier selection', () => {
    it('acquires sprite with green color when turns > warnThresholdTurns', () => {
      configure(ENEMY_INTENT_CONFIG.warnThresholdTurns + 1);
      const enemy = makeEnemy({ id: 'e1' });
      enemies.set('e1', enemy);

      service.update(false);

      const call = poolSpy.acquire.calls.first();
      const expectedHex = `#${ENEMY_INTENT_CONFIG.colorSafe.toString(16).padStart(6, '0')}`;
      expect(call.args[0].textColor).toBe(expectedHex);
    });

    it('acquires sprite with amber color when turns in warn range', () => {
      configure(ENEMY_INTENT_CONFIG.warnThresholdTurns); // exactly at threshold → amber
      const enemy = makeEnemy({ id: 'e1' });
      enemies.set('e1', enemy);

      service.update(false);

      const call = poolSpy.acquire.calls.first();
      const expectedHex = `#${ENEMY_INTENT_CONFIG.colorWarn.toString(16).padStart(6, '0')}`;
      expect(call.args[0].textColor).toBe(expectedHex);
    });

    it('acquires sprite with red color when turns <= leakThresholdTurns', () => {
      configure(ENEMY_INTENT_CONFIG.leakThresholdTurns);
      const enemy = makeEnemy({ id: 'e1' });
      enemies.set('e1', enemy);

      service.update(false);

      const call = poolSpy.acquire.calls.first();
      const expectedHex = `#${ENEMY_INTENT_CONFIG.colorDanger.toString(16).padStart(6, '0')}`;
      expect(call.args[0].textColor).toBe(expectedHex);
    });
  });

  // -------------------------------------------------------------------------
  // Placement mode suppression
  // -------------------------------------------------------------------------

  describe('placement mode', () => {
    beforeEach(() => configure());

    it('hides sprites when placementActive is true', () => {
      const enemy = makeEnemy({ id: 'e1' });
      enemies.set('e1', enemy);

      service.update(true);

      const scene = sceneSpy.getScene();
      const sprite = scene.children[0] as THREE.Sprite;
      expect(sprite.visible).toBeFalse();
    });

    it('shows sprites when placementActive is false', () => {
      const enemy = makeEnemy({ id: 'e1' });
      enemies.set('e1', enemy);

      service.update(false);

      const scene = sceneSpy.getScene();
      const sprite = scene.children[0] as THREE.Sprite;
      expect(sprite.visible).toBeTrue();
    });
  });

  // -------------------------------------------------------------------------
  // Dying / dead enemy cleanup
  // -------------------------------------------------------------------------

  describe('dying and dead enemy cleanup', () => {
    beforeEach(() => configure());

    it('skips sprite creation for dying enemies', () => {
      const enemy = makeEnemy({ id: 'e1', dying: true });
      enemies.set('e1', enemy);

      service.update(false);

      expect(poolSpy.acquire).not.toHaveBeenCalled();
    });

    it('skips sprite creation for zero-health enemies', () => {
      const enemy = makeEnemy({ id: 'e1', health: 0 });
      enemies.set('e1', enemy);

      service.update(false);

      expect(poolSpy.acquire).not.toHaveBeenCalled();
    });

    it('releases sprite when enemy transitions to dying', () => {
      const enemy = makeEnemy({ id: 'e1' });
      enemies.set('e1', enemy);

      service.update(false); // Creates sprite

      enemy.dying = true;
      service.update(false); // Should tombstone and release

      expect(poolSpy.release).toHaveBeenCalledTimes(1);
    });

    it('releases sprite when enemy is removed from roster', () => {
      const enemy = makeEnemy({ id: 'e1' });
      enemies.set('e1', enemy);

      service.update(false); // Creates sprite

      enemies.clear();
      service.update(false); // Enemy gone — sprite should be released

      expect(poolSpy.release).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Disposal
  // -------------------------------------------------------------------------

  describe('disposal', () => {
    beforeEach(() => configure());

    it('releases all sprites on ngOnDestroy', () => {
      const e1 = makeEnemy({ id: 'e1' });
      const e2 = makeEnemy({ id: 'e2', position: { x: 5, y: 0, z: 5 } });
      enemies.set('e1', e1);
      enemies.set('e2', e2);

      service.update(false); // Creates 2 sprites

      expect(poolSpy.acquire).toHaveBeenCalledTimes(2);

      service.ngOnDestroy();

      expect(poolSpy.release).toHaveBeenCalledTimes(2);
    });

    it('disposeAll is idempotent — second call is a no-op', () => {
      const enemy = makeEnemy({ id: 'e1' });
      enemies.set('e1', enemy);

      service.update(false);
      service.disposeAll();
      service.disposeAll(); // Should not throw or re-release

      expect(poolSpy.release).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Text label format
  // -------------------------------------------------------------------------

  describe('text label', () => {
    it('formats the turns value as "<N>t"', () => {
      configure(7);
      const enemy = makeEnemy({ id: 'e1' });
      enemies.set('e1', enemy);

      service.update(false);

      const call = poolSpy.acquire.calls.first();
      expect(call.args[0].text).toBe('7t');
    });
  });
});
