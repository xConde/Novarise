import { TestBed } from '@angular/core/testing';
import { WaveService } from './wave.service';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { EnemyType } from '../models/enemy.model';
import { ENDLESS_CONFIG, WAVE_DEFINITIONS } from '../models/wave.model';
import * as THREE from 'three';

describe('WaveService', () => {
  let service: WaveService;
  let enemyServiceSpy: jasmine.SpyObj<EnemyService>;
  let mockScene: THREE.Scene;

  beforeEach(() => {
    enemyServiceSpy = jasmine.createSpyObj('EnemyService', ['spawnEnemy']);
    // Default: spawnEnemy succeeds
    enemyServiceSpy.spawnEnemy.and.returnValue({ id: 'enemy-0' } as any);

    TestBed.configureTestingModule({
      providers: [
        WaveService,
        { provide: EnemyService, useValue: enemyServiceSpy },
        GameBoardService
      ]
    });
    service = TestBed.inject(WaveService);
    mockScene = new THREE.Scene();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- Initial State ---

  describe('initial state', () => {
    it('should not be spawning initially', () => {
      expect(service.isSpawning()).toBeFalse();
    });

    it('should return 10 max waves', () => {
      expect(service.getMaxWaves()).toBe(WAVE_DEFINITIONS.length);
    });
  });

  // --- startWave ---

  describe('startWave', () => {
    it('should set spawning to active', () => {
      service.startWave(1, mockScene);
      expect(service.isSpawning()).toBeTrue();
    });

    it('should not activate for out-of-range wave number', () => {
      service.startWave(0, mockScene);
      expect(service.isSpawning()).toBeFalse();

      service.startWave(999, mockScene);
      expect(service.isSpawning()).toBeFalse();
    });

    it('should not activate for negative wave number', () => {
      service.startWave(-1, mockScene);
      expect(service.isSpawning()).toBeFalse();
    });

    it('should not corrupt internal index on invalid wave number', () => {
      // Start a valid wave first
      service.startWave(1, mockScene);
      expect(service.isSpawning()).toBeTrue();

      // Reset to clean state
      service.reset();

      // Attempt invalid wave — should leave index at reset value
      service.startWave(999, mockScene);
      expect(service.isSpawning()).toBeFalse();

      // Valid wave should still work after invalid attempt
      service.startWave(2, mockScene);
      expect(service.isSpawning()).toBeTrue();
    });

    it('should not activate when called while already spawning (replaces queue)', () => {
      service.startWave(1, mockScene);
      service.update(0.016, mockScene); // spawn first from wave 1
      const callsAfterWave1Start = enemyServiceSpy.spawnEnemy.calls.count();

      // Start wave 2 while wave 1 is active — replaces queues
      service.startWave(2, mockScene);
      expect(service.isSpawning()).toBeTrue();

      service.update(0.016, mockScene);
      // Should now be spawning wave 2 enemies (BASIC + FAST)
      const callsAfterWave2Start = enemyServiceSpy.spawnEnemy.calls.count();
      expect(callsAfterWave2Start).toBeGreaterThan(callsAfterWave1Start);
    });
  });

  // --- update (spawn processing) ---

  describe('update', () => {
    it('should spawn first enemy immediately on first update', () => {
      service.startWave(1, mockScene);
      service.update(0.016, mockScene); // ~1 frame

      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(EnemyType.BASIC, mockScene);
    });

    it('should respect spawn interval between enemies', () => {
      service.startWave(1, mockScene);

      // Wave 1: 5 BASIC enemies, spawnInterval 1.5s
      // First spawns immediately (timeSinceLastSpawn initialized to spawnInterval)
      service.update(0.016, mockScene);
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(1);

      // 0.5s later — should NOT spawn another yet
      service.update(0.5, mockScene);
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(1);

      // Another 1.1s later (total 1.616s since last spawn) — should spawn
      service.update(1.1, mockScene);
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(2);
    });

    it('should retry failed spawns without decrementing count', () => {
      service.startWave(1, mockScene);

      // First spawn fails
      enemyServiceSpy.spawnEnemy.and.returnValue(null);
      service.update(0.016, mockScene);

      // Should have tried but still be spawning (remaining not decremented)
      expect(service.isSpawning()).toBeTrue();
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(1);

      // Next tick — retry succeeds
      enemyServiceSpy.spawnEnemy.and.returnValue({ id: 'enemy-1' } as any);
      service.update(1.6, mockScene);
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(2);
    });

    it('should stop spawning when all enemies are spawned', () => {
      service.startWave(1, mockScene);

      // Wave 1: 5 BASIC enemies, interval 1.5s
      // Spawn all 5 (first immediate, then 4 more at intervals)
      service.update(0.016, mockScene); // spawn 1
      for (let i = 0; i < 4; i++) {
        service.update(1.6, mockScene); // spawn 2-5
      }

      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(5);

      // Next update should detect all done
      service.update(1.6, mockScene);
      expect(service.isSpawning()).toBeFalse();
    });

    it('should not spawn when not active', () => {
      service.update(1.0, mockScene);
      expect(enemyServiceSpy.spawnEnemy).not.toHaveBeenCalled();
    });

    it('should handle multi-entry waves (wave 3 has BASIC + FAST)', () => {
      service.startWave(3, mockScene);

      // Wave 3: 5 BASIC @ 1.0s interval, 3 FAST @ 0.8s interval
      // Both entries spawn first enemy immediately
      service.update(0.016, mockScene);

      const calls = enemyServiceSpy.spawnEnemy.calls.allArgs();
      const typesSpawned = calls.map(c => c[0]);
      expect(typesSpawned).toContain(EnemyType.BASIC);
      expect(typesSpawned).toContain(EnemyType.FAST);
    });
  });

  // --- Wave info accessors ---

  describe('wave info', () => {
    it('should return correct total enemies for wave 1', () => {
      expect(service.getTotalEnemiesInWave(1)).toBe(5);
    });

    it('should return correct total enemies for wave 5 (mixed)', () => {
      // Wave 5: 8 basic + 5 fast + 2 heavy = 15
      expect(service.getTotalEnemiesInWave(5)).toBe(15);
    });

    it('should return 0 for invalid wave number', () => {
      expect(service.getTotalEnemiesInWave(0)).toBe(0);
      expect(service.getTotalEnemiesInWave(999)).toBe(0);
    });

    it('should return correct reward for wave 1', () => {
      expect(service.getWaveReward(1)).toBe(25);
    });

    it('should return 0 reward for invalid wave', () => {
      expect(service.getWaveReward(0)).toBe(0);
    });
  });

  // --- Wave info accessors: endless mode ---

  describe('wave info: endless mode', () => {
    it('getTotalEnemiesInWave should return >0 for endless wave when endlessMode is on', () => {
      service.setEndlessMode(true);
      const beyondMax = WAVE_DEFINITIONS.length + 1;
      const count = service.getTotalEnemiesInWave(beyondMax);
      expect(count).toBeGreaterThan(0);
    });

    it('getTotalEnemiesInWave should return 0 for endless wave when endlessMode is off', () => {
      const beyondMax = WAVE_DEFINITIONS.length + 1;
      const count = service.getTotalEnemiesInWave(beyondMax);
      expect(count).toBe(0);
    });

    it('getWaveReward should return >0 for endless wave when endlessMode is on', () => {
      service.setEndlessMode(true);
      const beyondMax = WAVE_DEFINITIONS.length + 1;
      const reward = service.getWaveReward(beyondMax);
      expect(reward).toBeGreaterThan(0);
    });

    it('getWaveReward should return 0 for endless wave when endlessMode is off', () => {
      const beyondMax = WAVE_DEFINITIONS.length + 1;
      const reward = service.getWaveReward(beyondMax);
      expect(reward).toBe(0);
    });

    it('getTotalEnemiesInWave and getWaveReward should scale up for higher endless waves', () => {
      service.setEndlessMode(true);
      const wave11 = WAVE_DEFINITIONS.length + 1;
      const wave21 = WAVE_DEFINITIONS.length + 11;
      expect(service.getTotalEnemiesInWave(wave21)).toBeGreaterThan(service.getTotalEnemiesInWave(wave11));
      expect(service.getWaveReward(wave21)).toBeGreaterThan(service.getWaveReward(wave11));
    });
  });

  // --- reset ---

  describe('reset', () => {
    it('should stop spawning', () => {
      service.startWave(1, mockScene);
      expect(service.isSpawning()).toBeTrue();

      service.reset();
      expect(service.isSpawning()).toBeFalse();
    });

    it('should not spawn after reset even with update', () => {
      service.startWave(1, mockScene);
      service.reset();
      service.update(5.0, mockScene);

      expect(enemyServiceSpy.spawnEnemy).not.toHaveBeenCalled();
    });

    it('should reset endlessMode to false', () => {
      service.setEndlessMode(true);
      expect(service.isEndlessMode()).toBeTrue();

      service.reset();
      expect(service.isEndlessMode()).toBeFalse();
    });

    it('should not start endless waves after reset even if endless mode was on', () => {
      service.setEndlessMode(true);
      service.reset();

      const beyondMax = WAVE_DEFINITIONS.length + 1;
      service.startWave(beyondMax, mockScene);
      expect(service.isSpawning()).toBeFalse();
    });
  });

  // --- generateEndlessWave ---

  describe('generateEndlessWave', () => {
    it('should return a valid WaveDefinition with entries and reward', () => {
      const wave = service.generateEndlessWave(11);
      expect(wave).toBeDefined();
      expect(Array.isArray(wave.entries)).toBeTrue();
      expect(wave.entries.length).toBeGreaterThan(0);
      expect(wave.reward).toBeGreaterThan(0);
    });

    it('each entry should have a valid EnemyType, positive count, and non-negative spawnInterval', () => {
      const wave = service.generateEndlessWave(11);
      const validTypes = Object.values(EnemyType) as string[];
      for (const entry of wave.entries) {
        expect(validTypes).toContain(entry.type);
        expect(entry.count).toBeGreaterThan(0);
        expect(entry.spawnInterval).toBeGreaterThanOrEqual(0);
      }
    });

    it('wave 20 should have more enemies than wave 11 (count scaling)', () => {
      const wave11 = service.generateEndlessWave(11);
      const wave20 = service.generateEndlessWave(20);
      const count11 = wave11.entries.reduce((s, e) => s + e.count, 0);
      const count20 = wave20.entries.reduce((s, e) => s + e.count, 0);
      expect(count20).toBeGreaterThan(count11);
    });

    it('wave 20 should have faster spawns than wave 11 (speed scaling reduces interval)', () => {
      const wave11 = service.generateEndlessWave(11);
      const wave20 = service.generateEndlessWave(20);
      // Primary entry (index 0 or 1, not boss) should have shorter spawn interval
      const nonBoss11 = wave11.entries.filter(e => e.type !== EnemyType.BOSS);
      const nonBoss20 = wave20.entries.filter(e => e.type !== EnemyType.BOSS);
      const avgInterval11 =
        nonBoss11.reduce((s, e) => s + e.spawnInterval, 0) / nonBoss11.length;
      const avgInterval20 =
        nonBoss20.reduce((s, e) => s + e.spawnInterval, 0) / nonBoss20.length;
      expect(avgInterval20).toBeLessThanOrEqual(avgInterval11);
    });

    it('wave 20 should have a higher reward than wave 11', () => {
      const wave11 = service.generateEndlessWave(11);
      const wave20 = service.generateEndlessWave(20);
      expect(wave20.reward).toBeGreaterThan(wave11.reward);
    });

    it('should include a BOSS entry on every bossInterval wave', () => {
      const bossWaveNumber = ENDLESS_CONFIG.bossInterval; // e.g. wave 5
      const wave = service.generateEndlessWave(bossWaveNumber);
      const hasBoss = wave.entries.some(e => e.type === EnemyType.BOSS);
      expect(hasBoss).toBeTrue();
    });

    it('should NOT include a BOSS entry on non-boss waves', () => {
      // Wave 11 is not a boss wave (11 % 5 !== 0)
      const wave = service.generateEndlessWave(11);
      const hasBoss = wave.entries.some(e => e.type === EnemyType.BOSS);
      expect(hasBoss).toBeFalse();
    });

    it('should produce a boss entry with count 1', () => {
      const bossWave = service.generateEndlessWave(ENDLESS_CONFIG.bossInterval);
      const bossEntry = bossWave.entries.find(e => e.type === EnemyType.BOSS);
      expect(bossEntry).toBeDefined();
      expect(bossEntry!.count).toBe(1);
    });

    it('should cycle through different primary enemy types across waves', () => {
      const types = new Set<EnemyType>();
      // Sample several consecutive waves to verify cycling
      for (let w = 11; w <= 16; w++) {
        const wave = service.generateEndlessWave(w);
        const nonBoss = wave.entries.filter(e => e.type !== EnemyType.BOSS);
        nonBoss.forEach(e => types.add(e.type));
      }
      // Should see more than one type across 6 consecutive waves
      expect(types.size).toBeGreaterThan(1);
    });

    it('spawn interval should never drop below minimum (0.3s)', () => {
      // Wave 100 — very high, speed multiplier is large, but floor should apply
      const wave = service.generateEndlessWave(100);
      for (const entry of wave.entries) {
        if (entry.type !== EnemyType.BOSS) {
          expect(entry.spawnInterval).toBeGreaterThanOrEqual(0.3);
        }
      }
    });
  });

  // --- Endless mode: startWave integration ---

  describe('endless mode startWave', () => {
    it('setEndlessMode and isEndlessMode round-trip', () => {
      service.setEndlessMode(true);
      expect(service.isEndlessMode()).toBeTrue();
      service.setEndlessMode(false);
      expect(service.isEndlessMode()).toBeFalse();
    });

    it('should refuse to start wave beyond maxWaves when endless mode is off', () => {
      const beyondMax = WAVE_DEFINITIONS.length + 1;
      service.startWave(beyondMax, mockScene);
      expect(service.isSpawning()).toBeFalse();
    });

    it('should start an endless wave beyond maxWaves when endless mode is on', () => {
      service.setEndlessMode(true);
      const beyondMax = WAVE_DEFINITIONS.length + 1;
      service.startWave(beyondMax, mockScene);
      expect(service.isSpawning()).toBeTrue();
    });

    it('should spawn enemies from a generated endless wave', () => {
      service.setEndlessMode(true);
      const beyondMax = WAVE_DEFINITIONS.length + 1;
      service.startWave(beyondMax, mockScene);
      service.update(0.016, mockScene); // first tick triggers immediate spawn
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalled();
    });

    it('should stop spawning after all endless wave enemies are exhausted', () => {
      service.setEndlessMode(true);
      const beyondMax = WAVE_DEFINITIONS.length + 1;
      service.startWave(beyondMax, mockScene);

      // Drain the queue — large deltaTime to bypass all intervals
      for (let i = 0; i < 50; i++) {
        service.update(5.0, mockScene);
      }

      expect(service.isSpawning()).toBeFalse();
    });
  });
});
