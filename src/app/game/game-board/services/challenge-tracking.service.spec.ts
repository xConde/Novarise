import { TestBed } from '@angular/core/testing';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { TowerType } from '../models/tower.model';

describe('ChallengeTrackingService', () => {
  let service: ChallengeTrackingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChallengeTrackingService],
    });
    service = TestBed.inject(ChallengeTrackingService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('recordTowerPlaced', () => {
    it('should accumulate gold spent', () => {
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerPlaced(TowerType.SNIPER, 150);
      expect(service.getSnapshot().totalGoldSpent).toBe(250);
    });

    it('should add the tower type to the used set', () => {
      service.recordTowerPlaced(TowerType.SPLASH, 80);
      expect(service.getTowerTypesUsed().has(TowerType.SPLASH)).toBeTrue();
    });

    it('should not inflate towerTypesUsed for repeated placements of same type', () => {
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerPlaced(TowerType.BASIC, 100);
      expect(service.getTowerTypesUsed().size).toBe(1);
    });

    it('should track multiple distinct types', () => {
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerPlaced(TowerType.SNIPER, 150);
      service.recordTowerPlaced(TowerType.SLOW, 120);
      expect(service.getTowerTypesUsed().size).toBe(3);
    });

    it('should increment current tower count and update maxTowersPlaced', () => {
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerPlaced(TowerType.BASIC, 100);
      expect(service.getSnapshot().maxTowersPlaced).toBe(3);
    });
  });

  describe('recordTowerUpgraded', () => {
    it('should accumulate gold only — no effect on tower count or types', () => {
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerUpgraded(200);

      const snap = service.getSnapshot();
      expect(snap.totalGoldSpent).toBe(300);
      expect(snap.maxTowersPlaced).toBe(1);
      expect(snap.towerTypesUsed.size).toBe(1);
    });

    it('should accumulate multiple upgrade costs', () => {
      service.recordTowerUpgraded(200);
      service.recordTowerUpgraded(350);
      expect(service.getSnapshot().totalGoldSpent).toBe(550);
    });
  });

  describe('recordTowerSold', () => {
    it('should decrement current tower count', () => {
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerSold();

      // Current count is 1, but max was 2
      expect(service.getSnapshot().maxTowersPlaced).toBe(2);
    });

    it('should not reduce current count below zero', () => {
      service.recordTowerSold();
      service.recordTowerSold();
      // Placing after multiple sells should recover cleanly
      service.recordTowerPlaced(TowerType.BASIC, 100);
      expect(service.getSnapshot().maxTowersPlaced).toBe(1);
    });

    it('should preserve maxTowersPlaced as the peak — not the current count', () => {
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerSold();
      service.recordTowerSold();
      // Peak was 3, current is 1
      expect(service.getSnapshot().maxTowersPlaced).toBe(3);
    });
  });

  describe('maxTowersPlaced reflects peak, not current', () => {
    it('should record the highest simultaneous tower count across placements and sells', () => {
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerPlaced(TowerType.SNIPER, 150);
      service.recordTowerSold();
      service.recordTowerPlaced(TowerType.MORTAR, 200);
      // Peak was 2 (after 2nd place, before sell)
      expect(service.getSnapshot().maxTowersPlaced).toBe(2);
    });
  });

  describe('getSnapshot', () => {
    it('should return a copy — mutating it does not affect the service', () => {
      service.recordTowerPlaced(TowerType.BASIC, 100);
      const snap = service.getSnapshot();

      // Mutate the snapshot's Set
      snap.towerTypesUsed.add(TowerType.CHAIN as unknown as string);
      snap.towerTypesUsed.add(TowerType.MORTAR as unknown as string);

      // Service's internal state should be unchanged
      expect(service.getTowerTypesUsed().size).toBe(1);
    });

    it('should return correct values for all fields', () => {
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerPlaced(TowerType.SNIPER, 200);
      service.recordTowerUpgraded(300);
      service.recordTowerSold();

      const snap = service.getSnapshot();
      expect(snap.totalGoldSpent).toBe(600);
      expect(snap.maxTowersPlaced).toBe(2);
      expect(snap.towerTypesUsed.size).toBe(2);
    });
  });

  describe('getTowerTypesUsed', () => {
    it('should return a ReadonlySet reflecting current state', () => {
      service.recordTowerPlaced(TowerType.BASIC, 100);
      const types = service.getTowerTypesUsed();
      expect(types.has(TowerType.BASIC)).toBeTrue();
      expect(types.has(TowerType.SNIPER)).toBeFalse();
    });
  });

  describe('reset', () => {
    it('should clear all tracked state', () => {
      service.recordTowerPlaced(TowerType.BASIC, 500);
      service.recordTowerUpgraded(300);
      service.recordTowerPlaced(TowerType.SNIPER, 200);

      service.reset();

      const snap = service.getSnapshot();
      expect(snap.totalGoldSpent).toBe(0);
      expect(snap.maxTowersPlaced).toBe(0);
      expect(snap.towerTypesUsed.size).toBe(0);
    });

    it('should allow fresh accumulation after reset', () => {
      service.recordTowerPlaced(TowerType.BASIC, 500);
      service.reset();

      service.recordTowerPlaced(TowerType.MORTAR, 100);
      const snap = service.getSnapshot();
      expect(snap.totalGoldSpent).toBe(100);
      expect(snap.maxTowersPlaced).toBe(1);
      expect(snap.towerTypesUsed.has(TowerType.MORTAR)).toBeTrue();
    });
  });
});
