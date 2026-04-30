import { TestBed } from '@angular/core/testing';
import { TargetPreviewService } from './target-preview.service';
import { TowerCombatService } from './tower-combat.service';
import { TowerType, TOWER_CONFIGS, TargetingMode, PlacedTower } from '../models/tower.model';
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
  ): PlacedTower {
    return {
      id: `${row}-${col}`,
      type,
      level: 1,
      row,
      col,
      targetingMode: mode,
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
        TOWER_CONFIGS[TowerType.BASIC],
      );
    });

    it('returns null when findTarget returns null (no enemies in range)', () => {
      const tower = makeTower(5, 5);
      combatServiceSpy.findTarget.and.returnValue(null);

      const result = service.getPreviewTarget(tower);

      expect(result).toBeNull();
    });

    it('passes the correct tower stats for the tower type', () => {
      const tower = makeTower(3, 3, TowerType.SNIPER);
      combatServiceSpy.findTarget.and.returnValue(null);

      service.getPreviewTarget(tower);

      expect(combatServiceSpy.findTarget).toHaveBeenCalledWith(
        tower,
        TOWER_CONFIGS[TowerType.SNIPER],
      );
    });

    it('respects targeting mode: returns null when no enemy is in range', () => {
      const tower = makeTower(5, 5, TowerType.BASIC, TargetingMode.FIRST);
      combatServiceSpy.findTarget.and.returnValue(null);

      expect(service.getPreviewTarget(tower)).toBeNull();
      expect(combatServiceSpy.findTarget).toHaveBeenCalled();
    });
  });

  describe('without TowerCombatService', () => {
    it('returns null when TowerCombatService is not provided', () => {
      const standalone = new TargetPreviewService(undefined);
      const tower = makeTower(1, 1);

      expect(standalone.getPreviewTarget(tower)).toBeNull();
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
    it('does not throw after multiple getPreviewTarget calls', () => {
      const tower = makeTower(5, 5);
      combatServiceSpy.findTarget.and.returnValue(null);
      service.getPreviewTarget(tower);
      service.getPreviewTarget(tower);

      expect(() => service.clearAll()).not.toThrow();
    });
  });
});
