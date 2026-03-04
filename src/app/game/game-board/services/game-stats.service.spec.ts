import { TestBed } from '@angular/core/testing';
import { GameStatsService } from './game-stats.service';
import { TowerType } from '../models/tower.model';

describe('GameStatsService', () => {
  let service: GameStatsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GameStatsService]
    });
    service = TestBed.inject(GameStatsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- Initial State ---

  describe('initial state', () => {
    it('should start with zero totalDamageDealt', () => {
      expect(service.getStats().totalDamageDealt).toBe(0);
    });

    it('should start with zero totalGoldEarned', () => {
      expect(service.getStats().totalGoldEarned).toBe(0);
    });

    it('should start with zero enemiesLeaked', () => {
      expect(service.getStats().enemiesLeaked).toBe(0);
    });

    it('should start with zero towersBuilt', () => {
      expect(service.getStats().towersBuilt).toBe(0);
    });

    it('should start with zero towersSold', () => {
      expect(service.getStats().towersSold).toBe(0);
    });

    it('should start with zero shotsFired', () => {
      expect(service.getStats().shotsFired).toBe(0);
    });

    it('should start with zero kills for all tower types', () => {
      const kills = service.getStats().killsByTowerType;
      expect(kills[TowerType.BASIC]).toBe(0);
      expect(kills[TowerType.SNIPER]).toBe(0);
      expect(kills[TowerType.SPLASH]).toBe(0);
      expect(kills[TowerType.SLOW]).toBe(0);
      expect(kills[TowerType.CHAIN]).toBe(0);
      expect(kills[TowerType.MORTAR]).toBe(0);
    });
  });

  // --- recordKill ---

  describe('recordKill', () => {
    it('should increment kills for the specified tower type', () => {
      service.recordKill(TowerType.BASIC);
      expect(service.getStats().killsByTowerType[TowerType.BASIC]).toBe(1);
    });

    it('should not affect kills for other tower types', () => {
      service.recordKill(TowerType.SNIPER);
      const kills = service.getStats().killsByTowerType;
      expect(kills[TowerType.BASIC]).toBe(0);
      expect(kills[TowerType.SPLASH]).toBe(0);
      expect(kills[TowerType.SLOW]).toBe(0);
      expect(kills[TowerType.CHAIN]).toBe(0);
      expect(kills[TowerType.MORTAR]).toBe(0);
    });

    it('should accumulate kills across multiple calls for the same tower type', () => {
      service.recordKill(TowerType.SPLASH);
      service.recordKill(TowerType.SPLASH);
      service.recordKill(TowerType.SPLASH);
      expect(service.getStats().killsByTowerType[TowerType.SPLASH]).toBe(3);
    });

    it('should track kills independently per tower type', () => {
      service.recordKill(TowerType.BASIC);
      service.recordKill(TowerType.BASIC);
      service.recordKill(TowerType.SNIPER);
      service.recordKill(TowerType.MORTAR);
      service.recordKill(TowerType.MORTAR);
      service.recordKill(TowerType.MORTAR);

      const kills = service.getStats().killsByTowerType;
      expect(kills[TowerType.BASIC]).toBe(2);
      expect(kills[TowerType.SNIPER]).toBe(1);
      expect(kills[TowerType.MORTAR]).toBe(3);
    });
  });

  // --- recordDamage ---

  describe('recordDamage', () => {
    it('should increment totalDamageDealt by the given amount', () => {
      service.recordDamage(50);
      expect(service.getStats().totalDamageDealt).toBe(50);
    });

    it('should accumulate damage across multiple calls', () => {
      service.recordDamage(25);
      service.recordDamage(75);
      expect(service.getStats().totalDamageDealt).toBe(100);
    });
  });

  // --- recordGoldEarned ---

  describe('recordGoldEarned', () => {
    it('should increment totalGoldEarned by the given amount', () => {
      service.recordGoldEarned(100);
      expect(service.getStats().totalGoldEarned).toBe(100);
    });

    it('should accumulate gold across multiple calls', () => {
      service.recordGoldEarned(30);
      service.recordGoldEarned(70);
      expect(service.getStats().totalGoldEarned).toBe(100);
    });
  });

  // --- recordEnemyLeaked ---

  describe('recordEnemyLeaked', () => {
    it('should increment enemiesLeaked by 1', () => {
      service.recordEnemyLeaked();
      expect(service.getStats().enemiesLeaked).toBe(1);
    });

    it('should accumulate across multiple calls', () => {
      service.recordEnemyLeaked();
      service.recordEnemyLeaked();
      service.recordEnemyLeaked();
      expect(service.getStats().enemiesLeaked).toBe(3);
    });
  });

  // --- recordTowerBuilt ---

  describe('recordTowerBuilt', () => {
    it('should increment towersBuilt by 1', () => {
      service.recordTowerBuilt();
      expect(service.getStats().towersBuilt).toBe(1);
    });

    it('should accumulate across multiple calls', () => {
      service.recordTowerBuilt();
      service.recordTowerBuilt();
      expect(service.getStats().towersBuilt).toBe(2);
    });
  });

  // --- recordTowerSold ---

  describe('recordTowerSold', () => {
    it('should increment towersSold by 1', () => {
      service.recordTowerSold();
      expect(service.getStats().towersSold).toBe(1);
    });

    it('should accumulate across multiple calls', () => {
      service.recordTowerSold();
      service.recordTowerSold();
      expect(service.getStats().towersSold).toBe(2);
    });
  });

  // --- recordShot ---

  describe('recordShot', () => {
    it('should increment shotsFired by 1', () => {
      service.recordShot();
      expect(service.getStats().shotsFired).toBe(1);
    });

    it('should accumulate across multiple calls', () => {
      service.recordShot();
      service.recordShot();
      service.recordShot();
      expect(service.getStats().shotsFired).toBe(3);
    });
  });

  // --- getStats snapshot isolation ---

  describe('getStats', () => {
    it('should return a snapshot that is not mutated by subsequent record calls', () => {
      const snapshot = service.getStats();
      service.recordDamage(999);
      expect(snapshot.totalDamageDealt).toBe(0);
    });

    it('should return a killsByTowerType object that is not mutated by subsequent recordKill calls', () => {
      const snapshot = service.getStats();
      service.recordKill(TowerType.CHAIN);
      expect(snapshot.killsByTowerType[TowerType.CHAIN]).toBe(0);
    });
  });

  // --- reset ---

  describe('reset', () => {
    it('should clear all counters to zero', () => {
      service.recordKill(TowerType.BASIC);
      service.recordDamage(200);
      service.recordGoldEarned(150);
      service.recordEnemyLeaked();
      service.recordTowerBuilt();
      service.recordTowerSold();
      service.recordShot();

      service.reset();

      const stats = service.getStats();
      expect(stats.totalDamageDealt).toBe(0);
      expect(stats.totalGoldEarned).toBe(0);
      expect(stats.enemiesLeaked).toBe(0);
      expect(stats.towersBuilt).toBe(0);
      expect(stats.towersSold).toBe(0);
      expect(stats.shotsFired).toBe(0);
    });

    it('should reset all killsByTowerType counters to zero', () => {
      service.recordKill(TowerType.BASIC);
      service.recordKill(TowerType.SNIPER);
      service.recordKill(TowerType.MORTAR);

      service.reset();

      const kills = service.getStats().killsByTowerType;
      expect(kills[TowerType.BASIC]).toBe(0);
      expect(kills[TowerType.SNIPER]).toBe(0);
      expect(kills[TowerType.SPLASH]).toBe(0);
      expect(kills[TowerType.SLOW]).toBe(0);
      expect(kills[TowerType.CHAIN]).toBe(0);
      expect(kills[TowerType.MORTAR]).toBe(0);
    });

    it('should allow recording new stats after a reset', () => {
      service.recordDamage(500);
      service.reset();
      service.recordDamage(10);
      expect(service.getStats().totalDamageDealt).toBe(10);
    });
  });
});
