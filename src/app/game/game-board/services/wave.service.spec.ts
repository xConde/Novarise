import { TestBed } from '@angular/core/testing';
import { WaveService } from './wave.service';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { EnemyType } from '../models/enemy.model';
import { WAVE_DEFINITIONS } from '../models/wave.model';
import { generateEndlessWave, ENDLESS_BOSS_INTERVAL, ENDLESS_MIN_SPAWN_INTERVAL_S } from '../models/endless-wave.model';
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

    it('should apply waveCountMultiplier to enemy counts', () => {
      // Wave 1: 5 BASIC enemies normally
      service.startWave(1, mockScene, 2.0);

      // Should now have 10 remaining (5 * 2)
      expect(service.getRemainingToSpawn()).toBe(10);
    });

    it('should clamp waveCountMultiplier below 1 to 1', () => {
      service.startWave(1, mockScene, 0.5);

      // Should still have at least the base count (clamped to 1x)
      expect(service.getRemainingToSpawn()).toBe(5);
    });

    it('should default waveCountMultiplier to 1 when not provided', () => {
      service.startWave(1, mockScene);

      expect(service.getRemainingToSpawn()).toBe(5);
    });
  });

  // --- update (spawn processing) ---

  describe('update', () => {
    it('should spawn first enemy immediately on first update', () => {
      service.startWave(1, mockScene);
      service.update(0.016, mockScene); // ~1 frame

      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(EnemyType.BASIC, mockScene, 1, 1);
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

  // --- generateEndlessWave (model function) ---
  // Note: generateEndlessWave() moved to endless-wave.model.ts (full tests in endless-wave.model.spec.ts).
  // These tests verify integration properties visible to WaveService consumers.

  describe('generateEndlessWave (model integration)', () => {
    it('should return a valid result with entries and reward for endless wave 1', () => {
      const result = generateEndlessWave(1);
      expect(result).toBeDefined();
      expect(Array.isArray(result.entries)).toBeTrue();
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.reward).toBeGreaterThan(0);
    });

    it('each entry should have a valid EnemyType, positive count, and positive spawnInterval', () => {
      const result = generateEndlessWave(1);
      const validTypes = Object.values(EnemyType) as string[];
      for (const entry of result.entries) {
        expect(validTypes).toContain(entry.type);
        expect(entry.count).toBeGreaterThan(0);
        expect(entry.spawnInterval).toBeGreaterThan(0);
      }
    });

    it('endless wave 10 should have more enemies than endless wave 1 (count scaling)', () => {
      const w1 = generateEndlessWave(1);
      const w10 = generateEndlessWave(10);
      const count1 = w1.entries.reduce((s, e) => s + e.count, 0);
      const count10 = w10.entries.reduce((s, e) => s + e.count, 0);
      expect(count10).toBeGreaterThan(count1);
    });

    it('endless wave 10 should have a higher reward than endless wave 1', () => {
      const w1 = generateEndlessWave(1);
      const w10 = generateEndlessWave(10);
      expect(w10.reward).toBeGreaterThan(w1.reward);
    });

    it('should include a BOSS entry on every bossInterval endless wave', () => {
      const result = generateEndlessWave(ENDLESS_BOSS_INTERVAL);
      const hasBoss = result.entries.some(e => e.type === EnemyType.BOSS);
      expect(hasBoss).toBeTrue();
    });

    it('should NOT include a BOSS entry on non-milestone endless wave 1', () => {
      const result = generateEndlessWave(1);
      const hasBoss = result.entries.some(e => e.type === EnemyType.BOSS);
      expect(hasBoss).toBeFalse();
    });

    it('should cycle through different enemy types across consecutive non-milestone waves', () => {
      const types = new Set<EnemyType>();
      for (let w = 1; w <= 8; w++) {
        if (w % ENDLESS_BOSS_INTERVAL !== 0) {
          const result = generateEndlessWave(w);
          result.entries.forEach(e => types.add(e.type));
        }
      }
      expect(types.size).toBeGreaterThan(1);
    });

    it('spawn interval should never drop below ENDLESS_MIN_SPAWN_INTERVAL_S', () => {
      const result = generateEndlessWave(100);
      for (const entry of result.entries) {
        expect(entry.spawnInterval).toBeGreaterThanOrEqual(ENDLESS_MIN_SPAWN_INTERVAL_S);
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

  // --- getCurrentEndlessTemplate ---

  describe('getCurrentEndlessTemplate', () => {
    it('returns null before any wave starts', () => {
      expect(service.getCurrentEndlessTemplate()).toBeNull();
    });

    it('returns null during a scripted wave', () => {
      service.startWave(1, mockScene);
      expect(service.getCurrentEndlessTemplate()).toBeNull();
    });

    it('returns a non-null template during an endless wave', () => {
      service.setEndlessMode(true);
      const beyondMax = WAVE_DEFINITIONS.length + 1;
      service.startWave(beyondMax, mockScene);
      expect(service.getCurrentEndlessTemplate()).not.toBeNull();
    });

    it('returns null after reset()', () => {
      service.setEndlessMode(true);
      service.startWave(WAVE_DEFINITIONS.length + 1, mockScene);
      service.reset();
      expect(service.getCurrentEndlessTemplate()).toBeNull();
    });

    it('returns a non-null string that matches a known template name', () => {
      service.setEndlessMode(true);
      service.startWave(WAVE_DEFINITIONS.length + 1, mockScene);
      const template = service.getCurrentEndlessTemplate();
      expect(template).not.toBeNull();
      // Valid template strings are the EndlessWaveTemplate enum values
      const validTemplates = ['rush', 'siege', 'swarm', 'air_raid', 'mixed', 'boss', 'blitz'];
      expect(validTemplates).toContain(template as string);
    });
  });

  // --- getCurrentEndlessResult ---

  describe('getCurrentEndlessResult', () => {
    it('returns null before any wave starts', () => {
      expect(service.getCurrentEndlessResult()).toBeNull();
    });

    it('returns null during a scripted wave', () => {
      service.startWave(1, mockScene);
      expect(service.getCurrentEndlessResult()).toBeNull();
    });

    it('returns result with healthMultiplier > 1 during an endless wave', () => {
      service.setEndlessMode(true);
      service.startWave(WAVE_DEFINITIONS.length + 1, mockScene);
      const result = service.getCurrentEndlessResult();
      expect(result).not.toBeNull();
      expect(result!.healthMultiplier).toBeGreaterThan(1);
    });
  });

  // --- Endless wave multipliers wired to spawnEnemy ---

  describe('endless wave multipliers passed to spawnEnemy', () => {
    it('passes healthMultiplier > 1 to spawnEnemy during an endless wave', () => {
      service.setEndlessMode(true);
      const beyondMax = WAVE_DEFINITIONS.length + 10; // endless wave 10 has notable scaling
      service.startWave(beyondMax, mockScene);

      service.update(0.016, mockScene); // trigger first spawn

      const callArgs = enemyServiceSpy.spawnEnemy.calls.mostRecent().args as [EnemyType, THREE.Scene, number, number];
      const waveHealthMult = callArgs[2];
      expect(waveHealthMult).toBeGreaterThan(1);
    });

    it('passes speedMultiplier > 1 to spawnEnemy during an endless wave', () => {
      service.setEndlessMode(true);
      const beyondMax = WAVE_DEFINITIONS.length + 10;
      service.startWave(beyondMax, mockScene);

      service.update(0.016, mockScene);

      const callArgs = enemyServiceSpy.spawnEnemy.calls.mostRecent().args as [EnemyType, THREE.Scene, number, number];
      const waveSpeedMult = callArgs[3];
      expect(waveSpeedMult).toBeGreaterThan(1);
    });

    it('passes multipliers = 1 to spawnEnemy during a scripted wave', () => {
      service.startWave(1, mockScene);
      service.update(0.016, mockScene);

      const callArgs = enemyServiceSpy.spawnEnemy.calls.mostRecent().args as [EnemyType, THREE.Scene, number, number];
      expect(callArgs[2]).toBe(1);
      expect(callArgs[3]).toBe(1);
    });

    it('later endless waves pass higher healthMultiplier than earlier endless waves', () => {
      service.setEndlessMode(true);

      service.startWave(WAVE_DEFINITIONS.length + 1, mockScene);
      service.update(0.016, mockScene);
      const earlyMult = (enemyServiceSpy.spawnEnemy.calls.mostRecent().args as [EnemyType, THREE.Scene, number, number])[2];

      service.startWave(WAVE_DEFINITIONS.length + 20, mockScene);
      service.update(0.016, mockScene);
      const laterMult = (enemyServiceSpy.spawnEnemy.calls.mostRecent().args as [EnemyType, THREE.Scene, number, number])[2];

      expect(laterMult).toBeGreaterThan(earlyMult);
    });
  });

  // --- setCustomWaves / clearCustomWaves ---

  describe('setCustomWaves', () => {
    const CUSTOM_WAVES = [
      {
        entries: [
          { type: EnemyType.BASIC, count: 3, spawnInterval: 1.0 }
        ],
        reward: 15
      },
      {
        entries: [
          { type: EnemyType.FAST, count: 4, spawnInterval: 0.8 }
        ],
        reward: 20
      }
    ];

    it('hasCustomWaves() returns false by default', () => {
      expect(service.hasCustomWaves()).toBeFalse();
    });

    it('hasCustomWaves() returns true after setCustomWaves()', () => {
      service.setCustomWaves(CUSTOM_WAVES);
      expect(service.hasCustomWaves()).toBeTrue();
    });

    it('getMaxWaves() returns custom wave count after setCustomWaves()', () => {
      service.setCustomWaves(CUSTOM_WAVES);
      expect(service.getMaxWaves()).toBe(CUSTOM_WAVES.length);
    });

    it('startWave() uses custom definitions — only 3 enemies in wave 1', () => {
      service.setCustomWaves(CUSTOM_WAVES);
      service.startWave(1, mockScene);
      expect(service.getRemainingToSpawn()).toBe(3);
    });

    it('startWave() spawns FAST enemies in custom wave 2', () => {
      service.setCustomWaves(CUSTOM_WAVES);
      service.startWave(2, mockScene);
      service.update(0.016, mockScene);
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(EnemyType.FAST, mockScene, 1, 1);
    });

    it('startWave() rejects waves beyond custom count when endless mode is off', () => {
      service.setCustomWaves(CUSTOM_WAVES);
      service.startWave(CUSTOM_WAVES.length + 1, mockScene);
      expect(service.isSpawning()).toBeFalse();
    });

    it('getWaveDefinitions() returns the custom set', () => {
      service.setCustomWaves(CUSTOM_WAVES);
      expect(service.getWaveDefinitions()).toBe(CUSTOM_WAVES);
    });
  });

  describe('clearCustomWaves', () => {
    const CUSTOM_WAVES = [
      {
        entries: [{ type: EnemyType.BASIC, count: 2, spawnInterval: 1.0 }],
        reward: 10
      }
    ];

    it('clearCustomWaves() reverts getMaxWaves() to default WAVE_DEFINITIONS length', () => {
      service.setCustomWaves(CUSTOM_WAVES);
      service.clearCustomWaves();
      expect(service.getMaxWaves()).toBe(WAVE_DEFINITIONS.length);
    });

    it('hasCustomWaves() returns false after clearCustomWaves()', () => {
      service.setCustomWaves(CUSTOM_WAVES);
      service.clearCustomWaves();
      expect(service.hasCustomWaves()).toBeFalse();
    });

    it('after clearCustomWaves(), startWave() uses default WAVE_DEFINITIONS (wave 1 has 5 BASIC)', () => {
      service.setCustomWaves(CUSTOM_WAVES);
      service.clearCustomWaves();
      service.startWave(1, mockScene);
      expect(service.getRemainingToSpawn()).toBe(5);
    });

    it('reset() clears custom waves and reverts to defaults', () => {
      service.setCustomWaves(CUSTOM_WAVES);
      service.reset();
      expect(service.hasCustomWaves()).toBeFalse();
      expect(service.getMaxWaves()).toBe(WAVE_DEFINITIONS.length);
    });

    it('after reset(), startWave() using default definitions still works', () => {
      service.setCustomWaves(CUSTOM_WAVES);
      service.reset();
      service.startWave(1, mockScene);
      expect(service.isSpawning()).toBeTrue();
    });
  });
});
