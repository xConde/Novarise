import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { TargetPreviewService } from './target-preview.service';
import { TowerCombatService } from './tower-combat.service';
import { EnemyService } from './enemy.service';
import { TowerType, TOWER_CONFIGS, TowerSpecialization, getEffectiveStats, MAX_TOWER_LEVEL, TargetingMode, PlacedTower } from '../models/tower.model';
import { Enemy } from '../models/enemy.model';
import { createTestEnemy } from '../testing';

describe('TargetPreviewService', () => {
  let service: TargetPreviewService;
  let combatServiceSpy: jasmine.SpyObj<TowerCombatService>;

  function makeTower(
    row: number,
    col: number,
    type = TowerType.BASIC,
    mode = TargetingMode.NEAREST,
    level = 1,
    specialization?: TowerSpecialization,
  ): PlacedTower {
    return {
      id: `${row}-${col}`,
      type,
      level,
      row,
      col,
      targetingMode: mode,
      specialization,
      mesh: undefined,
      actualCost: TOWER_CONFIGS[type].cost,
      placedAtTurn: 0,
    } as unknown as PlacedTower;
  }

  beforeEach(() => {
    combatServiceSpy = jasmine.createSpyObj<TowerCombatService>(
      'TowerCombatService',
      ['findTarget', 'getPlacedTowers'],
    );

    TestBed.configureTestingModule({
      providers: [
        TargetPreviewService,
        { provide: TowerCombatService, useValue: combatServiceSpy },
      ],
    });

    service = TestBed.inject(TargetPreviewService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getPreviewTarget', () => {
    it('returns the same enemy findTarget would return', () => {
      const tower = makeTower(5, 5);
      const enemy: Enemy = createTestEnemy('e1', 1, 1);
      combatServiceSpy.findTarget.and.returnValue(enemy);

      const result = service.getPreviewTarget(tower);

      expect(result).toBe(enemy);
      expect(combatServiceSpy.findTarget).toHaveBeenCalledWith(
        tower,
        getEffectiveStats(TowerType.BASIC, 1, undefined),
      );
    });

    it('returns null when findTarget returns null (no enemies in range)', () => {
      const tower = makeTower(5, 5);
      combatServiceSpy.findTarget.and.returnValue(null);

      const result = service.getPreviewTarget(tower);

      expect(result).toBeNull();
    });

    it('passes L1 base stats for a L1 tower — matches TOWER_CONFIGS', () => {
      const tower = makeTower(3, 3, TowerType.SNIPER);
      combatServiceSpy.findTarget.and.returnValue(null);

      service.getPreviewTarget(tower);

      // L1 effective stats equal TOWER_CONFIGS baseline
      expect(combatServiceSpy.findTarget).toHaveBeenCalledWith(
        tower,
        getEffectiveStats(TowerType.SNIPER, 1, undefined),
      );
    });

    it('passes level-scaled stats for a L2 tower (Red-Team Finding A-1)', () => {
      // A L2 BASIC has +15% range — aim must respect that, otherwise the
      // tower visually ignores enemies inside its actual effective range.
      const tower = makeTower(5, 5, TowerType.BASIC, TargetingMode.NEAREST, 2);
      combatServiceSpy.findTarget.and.returnValue(null);

      service.getPreviewTarget(tower);

      const expectedStats = getEffectiveStats(TowerType.BASIC, 2, undefined);
      // Effective range at L2 must be larger than L1 base
      expect(expectedStats.range).toBeGreaterThan(TOWER_CONFIGS[TowerType.BASIC].range);
      expect(combatServiceSpy.findTarget).toHaveBeenCalledWith(tower, expectedStats);
    });

    it('passes specialization-boosted stats for a T3 specialized tower (Red-Team Finding A-1)', () => {
      // A T3 SNIPER with ALPHA specialization gets +20% range. Aim must use
      // the same range `fireTurn` would use, so the visual tracks enemies it
      // can actually hit and doesn't aim at enemies outside effective range.
      const spec = TowerSpecialization.ALPHA;
      const tower = makeTower(2, 2, TowerType.SNIPER, TargetingMode.NEAREST, MAX_TOWER_LEVEL, spec);
      combatServiceSpy.findTarget.and.returnValue(null);

      service.getPreviewTarget(tower);

      const expectedStats = getEffectiveStats(TowerType.SNIPER, 3, spec);
      expect(expectedStats.range).toBeGreaterThan(TOWER_CONFIGS[TowerType.SNIPER].range);
      expect(combatServiceSpy.findTarget).toHaveBeenCalledWith(tower, expectedStats);
    });

    it('respects targeting mode: returns null when no enemy is in range', () => {
      const tower = makeTower(5, 5, TowerType.BASIC, TargetingMode.FIRST);
      combatServiceSpy.findTarget.and.returnValue(null);

      expect(service.getPreviewTarget(tower)).toBeNull();
      expect(combatServiceSpy.findTarget).toHaveBeenCalled();
    });

    it('returns cached result on second call (no second findTarget invocation)', () => {
      const tower = makeTower(5, 5);
      const enemy = createTestEnemy('e1', 1, 1);
      combatServiceSpy.findTarget.and.returnValue(enemy);

      service.getPreviewTarget(tower);
      service.getPreviewTarget(tower);

      expect(combatServiceSpy.findTarget).toHaveBeenCalledTimes(1);
    });

    it('recomputes after invalidate(key) marks that tower dirty', () => {
      const tower = makeTower(5, 5);
      combatServiceSpy.findTarget.and.returnValue(null);
      service.getPreviewTarget(tower); // primes cache

      service.invalidate('5-5');
      service.getPreviewTarget(tower); // must recompute

      expect(combatServiceSpy.findTarget).toHaveBeenCalledTimes(2);
    });

    it('recomputes after invalidate() (no key) bulk-dirties all towers', () => {
      const tower = makeTower(5, 5);
      combatServiceSpy.findTarget.and.returnValue(null);
      service.getPreviewTarget(tower); // primes cache

      service.invalidate(); // bulk dirty
      service.getPreviewTarget(tower); // must recompute

      expect(combatServiceSpy.findTarget).toHaveBeenCalledTimes(2);
    });

    it('does NOT recompute for a clean tower when a different tower is dirtied', () => {
      const towerA = makeTower(1, 1);
      const towerB = makeTower(2, 2);
      combatServiceSpy.findTarget.and.returnValue(null);

      service.getPreviewTarget(towerA);
      service.getPreviewTarget(towerB);
      // Both cached now; only dirty A
      service.invalidate('1-1');

      // Only towerA triggers recompute; towerB is still clean
      service.getPreviewTarget(towerA);
      service.getPreviewTarget(towerB);

      expect(combatServiceSpy.findTarget).toHaveBeenCalledTimes(3); // 2 initial + 1 recompute for A
    });
  });

  describe('without TowerCombatService', () => {
    it('returns null when TowerCombatService is not provided', () => {
      const standalone = new TargetPreviewService(undefined, undefined);
      const tower = makeTower(1, 1);

      expect(standalone.getPreviewTarget(tower)).toBeNull();
    });
  });

  describe('dirty-set mechanics (Sprint 36)', () => {
    it('getDirtyCount() returns -1 after invalidate() (DIRTY_ALL)', () => {
      service.invalidate();
      expect(service.getDirtyCount()).toBe(-1);
    });

    it('getDirtyCount() returns 1 after invalidate(key)', () => {
      service.invalidate('3-3');
      expect(service.getDirtyCount()).toBe(1);
    });

    it('tickPreviewCache() clears the DIRTY_ALL sentinel', () => {
      service.invalidate();
      service.tickPreviewCache();
      expect(service.getDirtyCount()).toBe(0);
    });

    it('tickPreviewCache() does not remove specific-key dirty entries', () => {
      service.invalidate('5-5');
      service.tickPreviewCache(); // only removes DIRTY_ALL
      expect(service.getDirtyCount()).toBe(1);
    });
  });

  describe('enemy-event subscriptions (Sprint 36)', () => {
    let enemyChangedSubject: Subject<'spawn' | 'move' | 'remove'>;
    let enemyServiceStub: jasmine.SpyObj<EnemyService>;
    let serviceWithEnemy: TargetPreviewService;

    beforeEach(() => {
      enemyChangedSubject = new Subject<'spawn' | 'move' | 'remove'>();
      enemyServiceStub = jasmine.createSpyObj<EnemyService>(
        'EnemyService',
        ['getEnemiesChanged'],
      );
      enemyServiceStub.getEnemiesChanged.and.returnValue(enemyChangedSubject.asObservable());

      serviceWithEnemy = new TargetPreviewService(combatServiceSpy, enemyServiceStub);
    });

    afterEach(() => {
      serviceWithEnemy.ngOnDestroy();
    });

    it('enemy spawn fires bulk invalidation (getDirtyCount === -1)', () => {
      enemyChangedSubject.next('spawn');
      expect(serviceWithEnemy.getDirtyCount()).toBe(-1);
    });

    it('enemy move fires bulk invalidation', () => {
      enemyChangedSubject.next('move');
      expect(serviceWithEnemy.getDirtyCount()).toBe(-1);
    });

    it('enemy remove fires bulk invalidation', () => {
      enemyChangedSubject.next('remove');
      expect(serviceWithEnemy.getDirtyCount()).toBe(-1);
    });

    it('after enemy spawn, next getPreviewTarget recomputes (findTarget called)', () => {
      const tower = makeTower(5, 5);
      combatServiceSpy.findTarget.and.returnValue(null);
      serviceWithEnemy.getPreviewTarget(tower); // prime cache (1 call)

      enemyChangedSubject.next('spawn');
      serviceWithEnemy.getPreviewTarget(tower); // must recompute (2nd call)

      expect(combatServiceSpy.findTarget).toHaveBeenCalledTimes(2);
    });

    it('after enemy death (remove), next getPreviewTarget recomputes', () => {
      const tower = makeTower(5, 5);
      combatServiceSpy.findTarget.and.returnValue(null);
      serviceWithEnemy.getPreviewTarget(tower); // prime

      enemyChangedSubject.next('remove');
      serviceWithEnemy.getPreviewTarget(tower); // must recompute

      expect(combatServiceSpy.findTarget).toHaveBeenCalledTimes(2);
    });

    it('ngOnDestroy unsubscribes — no invalidation after destroy', () => {
      const tower = makeTower(5, 5);
      combatServiceSpy.findTarget.and.returnValue(null);
      serviceWithEnemy.getPreviewTarget(tower); // prime

      serviceWithEnemy.ngOnDestroy();
      enemyChangedSubject.next('spawn'); // should be ignored after unsubscribe
      serviceWithEnemy.getPreviewTarget(tower); // must use cache, not recompute

      expect(combatServiceSpy.findTarget).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidate', () => {
    it('does not throw when called with a key', () => {
      expect(() => service.invalidate('5-5')).not.toThrow();
    });

    it('does not throw when called without a key', () => {
      expect(() => service.invalidate()).not.toThrow();
    });
  });

  describe('tickPreviewCache', () => {
    it('does not throw', () => {
      expect(() => service.tickPreviewCache()).not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('clears cache and dirty set', () => {
      const tower = makeTower(5, 5);
      combatServiceSpy.findTarget.and.returnValue(null);
      service.getPreviewTarget(tower);
      service.invalidate('5-5');

      service.clearAll();

      // After clearAll, getPreviewTarget calls findTarget again (cache empty)
      service.getPreviewTarget(tower);
      expect(combatServiceSpy.findTarget).toHaveBeenCalledTimes(2);
    });
  });
});
