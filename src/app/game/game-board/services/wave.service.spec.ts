import { TestBed } from '@angular/core/testing';
import { WaveService } from './wave.service';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { EnemyType } from '../models/enemy.model';
import { WAVE_DEFINITIONS } from '../models/wave.model';
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
  });
});
