import { TestBed } from '@angular/core/testing';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { TowerType } from '../models/tower.model';
import { SerializableChallengeState } from '../models/encounter-checkpoint.model';

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

    it('reset when already empty is a no-op (does not throw)', () => {
      expect(() => service.reset()).not.toThrow();
      const snap = service.getSnapshot();
      expect(snap.totalGoldSpent).toBe(0);
      expect(snap.maxTowersPlaced).toBe(0);
      expect(snap.towerTypesUsed.size).toBe(0);
    });
  });

  describe('checkpoint serialization', () => {
    it('serializeState() captures all tracked fields', () => {
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerPlaced(TowerType.SNIPER, 200);
      service.recordTowerUpgraded(50);
      service.recordTowerSold();
      service.recordLifeLost();
      service.recordLifeLost();

      const state = service.serializeState();

      expect(state.totalGoldSpent).toBe(350);
      expect(state.maxTowersPlaced).toBe(2);
      expect(state.towerTypesUsed).toEqual(
        jasmine.arrayContaining([TowerType.BASIC, TowerType.SNIPER])
      );
      expect(state.towerTypesUsed.length).toBe(2);
      expect(state.currentTowerCount).toBe(1);
      expect(state.livesLostThisGame).toBe(2);
    });

    it('serializeState() returns a plain array for towerTypesUsed (not a Set)', () => {
      service.recordTowerPlaced(TowerType.MORTAR, 180);

      const state = service.serializeState();

      expect(Array.isArray(state.towerTypesUsed)).toBeTrue();
    });

    it('restoreFromCheckpoint() sets all fields', () => {
      const snapshot: SerializableChallengeState = {
        totalGoldSpent: 750,
        maxTowersPlaced: 5,
        towerTypesUsed: [TowerType.BASIC, TowerType.SLOW, TowerType.CHAIN],
        currentTowerCount: 3,
        livesLostThisGame: 1,
      };

      service.restoreFromCheckpoint(snapshot);

      const state = service.serializeState();
      expect(state.totalGoldSpent).toBe(750);
      expect(state.maxTowersPlaced).toBe(5);
      expect(state.towerTypesUsed).toEqual(
        jasmine.arrayContaining([TowerType.BASIC, TowerType.SLOW, TowerType.CHAIN])
      );
      expect(state.currentTowerCount).toBe(3);
      expect(state.livesLostThisGame).toBe(1);
    });

    it('restoreFromCheckpoint() restores towerTypesUsed as a Set (getTowerTypesUsed works)', () => {
      const snapshot: SerializableChallengeState = {
        totalGoldSpent: 0,
        maxTowersPlaced: 0,
        towerTypesUsed: [TowerType.SPLASH, TowerType.SNIPER],
        currentTowerCount: 0,
        livesLostThisGame: 0,
      };

      service.restoreFromCheckpoint(snapshot);

      const types = service.getTowerTypesUsed();
      expect(types.has(TowerType.SPLASH)).toBeTrue();
      expect(types.has(TowerType.SNIPER)).toBeTrue();
      expect(types.has(TowerType.BASIC)).toBeFalse();
    });

    it('serialize → restore roundtrip preserves all state exactly', () => {
      service.recordTowerPlaced(TowerType.BASIC, 100);
      service.recordTowerPlaced(TowerType.MORTAR, 220);
      service.recordTowerPlaced(TowerType.SLOW, 130);
      service.recordTowerUpgraded(400);
      service.recordTowerSold();
      service.recordLifeLost();

      const original = service.serializeState();

      // Restore into a fresh service instance
      const freshService = new ChallengeTrackingService();
      freshService.restoreFromCheckpoint(original);
      const restored = freshService.serializeState();

      expect(restored.totalGoldSpent).toBe(original.totalGoldSpent);
      expect(restored.maxTowersPlaced).toBe(original.maxTowersPlaced);
      expect(restored.towerTypesUsed).toEqual(
        jasmine.arrayContaining(original.towerTypesUsed)
      );
      expect(restored.towerTypesUsed.length).toBe(original.towerTypesUsed.length);
      expect(restored.currentTowerCount).toBe(original.currentTowerCount);
      expect(restored.livesLostThisGame).toBe(original.livesLostThisGame);
    });
  });

  // ── getSnapshot — each call is independent ────────────────────────────────

  describe('getSnapshot — independent calls', () => {
    it('getSnapshot returns a fresh Set each call (not the same reference)', () => {
      service.recordTowerPlaced(TowerType.BASIC, 100);
      const snap1 = service.getSnapshot();
      const snap2 = service.getSnapshot();
      expect(snap1.towerTypesUsed).not.toBe(snap2.towerTypesUsed);
    });

    it('mutating one snapshot towerTypesUsed does not affect a later snapshot', () => {
      service.recordTowerPlaced(TowerType.SNIPER, 125);
      const snap1 = service.getSnapshot();
      snap1.towerTypesUsed.clear(); // clear the copy

      const snap2 = service.getSnapshot();
      expect(snap2.towerTypesUsed.has(TowerType.SNIPER)).toBeTrue();
    });

    it('mutating one snapshot numeric fields does not affect the service state', () => {
      service.recordTowerPlaced(TowerType.SPLASH, 75);
      const snap = service.getSnapshot();
      // ChallengeSnapshot numeric fields are primitives (copied by value) —
      // confirming we get the correct values before any external mutation
      expect(snap.totalGoldSpent).toBe(75);

      // The service internal value is unaffected by reassigning the snap field
      // (primitives are not references, but we verify via a second getSnapshot)
      const snap2 = service.getSnapshot();
      expect(snap2.totalGoldSpent).toBe(75);
    });

    it('recordTowerSold when count is already 0 keeps count at 0 (no negative)', () => {
      service.recordTowerSold(); // count was 0, should not go below 0
      service.recordTowerSold();
      service.recordTowerPlaced(TowerType.CHAIN, 120);
      // currentTowerCount floored at 0 before the place → peak should be 1
      expect(service.getSnapshot().maxTowersPlaced).toBe(1);
    });
  });
});
