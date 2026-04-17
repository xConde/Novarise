import { TestBed } from '@angular/core/testing';
import { WaveService } from './wave.service';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { EnemyType } from '../models/enemy.model';
import { WAVE_DEFINITIONS } from '../models/wave.model';
import { generateEndlessWave, ENDLESS_BOSS_INTERVAL, ENDLESS_MIN_SPAWN_INTERVAL_S } from '../models/endless-wave.model';
import { createRelicServiceSpy } from '../testing';
import { RelicService } from '../../../run/services/relic.service';
import { RunEventBusService, RunEventType } from '../../../run/services/run-event-bus.service';
import * as THREE from 'three';

describe('WaveService', () => {
  let service: WaveService;
  let enemyServiceSpy: jasmine.SpyObj<EnemyService>;
  let relicServiceSpy: jasmine.SpyObj<RelicService>;
  let eventBusSpy: jasmine.SpyObj<RunEventBusService>;
  let mockScene: THREE.Scene;

  beforeEach(() => {
    enemyServiceSpy = jasmine.createSpyObj('EnemyService', ['spawnEnemy', 'buildOccupiedSpawnerSet']);
    // Default: spawnEnemy succeeds
    enemyServiceSpy.spawnEnemy.and.returnValue({ id: 'enemy-0' } as any);
    // Default: no pre-occupied spawners
    enemyServiceSpy.buildOccupiedSpawnerSet.and.returnValue(new Set<string>());

    relicServiceSpy = createRelicServiceSpy();
    // Default: no TEMPORAL_RIFT
    relicServiceSpy.getTurnDelayPerWave.and.returnValue(0);

    eventBusSpy = jasmine.createSpyObj<RunEventBusService>('RunEventBusService', ['emit']);

    TestBed.configureTestingModule({
      providers: [
        WaveService,
        { provide: EnemyService, useValue: enemyServiceSpy },
        { provide: RelicService, useValue: relicServiceSpy },
        { provide: RunEventBusService, useValue: eventBusSpy },
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

    it('emits WAVE_START with waveNumber + scheduled turn count', () => {
      service.startWave(1, mockScene);

      expect(eventBusSpy.emit).toHaveBeenCalledWith(
        RunEventType.WAVE_START,
        jasmine.objectContaining({ waveNumber: 1, scheduledTurnCount: jasmine.any(Number) }),
      );
    });

    it('does NOT emit WAVE_START for out-of-range wave numbers (no-op path)', () => {
      service.startWave(999, mockScene);

      const waveStartCalls = eventBusSpy.emit.calls.allArgs()
        .filter(args => args[0] === RunEventType.WAVE_START);
      expect(waveStartCalls.length).toBe(0);
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

    it('should replace the active wave queue when called while already spawning', () => {
      service.startWave(1, mockScene);
      service.spawnForTurn(mockScene); // spawn first from wave 1
      const callsAfterWave1Start = enemyServiceSpy.spawnEnemy.calls.count();

      // Start wave 2 while wave 1 is active — replaces queues
      service.startWave(2, mockScene);
      expect(service.isSpawning()).toBeTrue();

      service.spawnForTurn(mockScene);
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

  // --- spawnForTurn (turn-based spawn processing) ---
  // NOTE: deltaTime-based update() was deleted in M2 S3. All spawn processing
  // is now turn-based via spawnForTurn(scene).

  describe('spawnForTurn', () => {
    it('should spawn first enemy on first spawnForTurn call', () => {
      service.startWave(1, mockScene);
      service.spawnForTurn(mockScene); // turn 1

      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(EnemyType.BASIC, mockScene, 1, 1, jasmine.any(Set));
    });

    it('should spawn one enemy per turn (Wave 1: 5 BASIC across 5 turns)', () => {
      service.startWave(1, mockScene);

      // Wave 1: 5 BASIC — turnSchedule has 5 turns of 1 BASIC each
      service.spawnForTurn(mockScene); // turn 1
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(1);

      service.spawnForTurn(mockScene); // turn 2
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(2);

      service.spawnForTurn(mockScene); // turn 3
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(3);
    });

    it('should stop spawning when all enemies in the turn schedule are consumed', () => {
      service.startWave(1, mockScene);

      // Wave 1: 5 BASIC enemies across 5 turns
      for (let i = 0; i < 5; i++) {
        service.spawnForTurn(mockScene);
      }
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(5);

      // After schedule exhausted, isSpawning becomes false
      service.spawnForTurn(mockScene);
      expect(service.isSpawning()).toBeFalse();
    });

    it('should not spawn when not active', () => {
      service.spawnForTurn(mockScene);
      expect(enemyServiceSpy.spawnEnemy).not.toHaveBeenCalled();
    });

    it('should handle multi-entry waves (wave 3 has BASIC + FAST interleaved)', () => {
      service.startWave(3, mockScene);

      // Wave 3: 5 BASIC + 3 FAST — first turn has [BASIC, FAST]
      service.spawnForTurn(mockScene);

      const calls = enemyServiceSpy.spawnEnemy.calls.allArgs();
      const typesSpawned = calls.map(c => c[0]);
      expect(typesSpawned).toContain(EnemyType.BASIC);
      expect(typesSpawned).toContain(EnemyType.FAST);
    });

    it('should return spawn count from spawnForTurn', () => {
      service.startWave(1, mockScene);
      const count = service.spawnForTurn(mockScene);
      // Wave 1 turn 1 spawns 1 BASIC
      expect(count).toBe(1);
    });

    it('should return 0 from spawnForTurn when not active', () => {
      const count = service.spawnForTurn(mockScene);
      expect(count).toBe(0);
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

    it('should not spawn after reset even with spawnForTurn', () => {
      service.startWave(1, mockScene);
      service.reset();
      service.spawnForTurn(mockScene);

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
      service.spawnForTurn(mockScene); // first turn spawns immediately
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalled();
    });

    it('should stop spawning after all endless wave enemies are exhausted', () => {
      service.setEndlessMode(true);
      const beyondMax = WAVE_DEFINITIONS.length + 1;
      service.startWave(beyondMax, mockScene);

      // Drain the turn schedule — endless waves have bounded enemy counts
      for (let i = 0; i < 100; i++) {
        service.spawnForTurn(mockScene);
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

  // --- getTotalEnemiesInWave: cache reuse ---

  describe('getTotalEnemiesInWave — cache reuse for active endless wave', () => {
    it('returns the same count when called twice for the active endless wave (cache hit)', () => {
      service.setEndlessMode(true);
      const beyondMax = WAVE_DEFINITIONS.length + 1;
      service.startWave(beyondMax, mockScene);

      const first = service.getTotalEnemiesInWave(beyondMax);
      const second = service.getTotalEnemiesInWave(beyondMax);

      expect(first).toBe(second);
      expect(first).toBeGreaterThan(0);
    });

    it('result for a different endless wave index is generated fresh (cache miss)', () => {
      service.setEndlessMode(true);
      const wave11 = WAVE_DEFINITIONS.length + 1;
      const wave12 = WAVE_DEFINITIONS.length + 2;

      service.startWave(wave11, mockScene);
      const countFor11 = service.getTotalEnemiesInWave(wave11);
      // Requesting a different wave than the active one should not use the cache
      const countFor12 = service.getTotalEnemiesInWave(wave12);

      // Both should be positive; they may differ
      expect(countFor11).toBeGreaterThan(0);
      expect(countFor12).toBeGreaterThan(0);
    });

    it('returns 0 when endless mode is off regardless of what wave is active', () => {
      const beyondMax = WAVE_DEFINITIONS.length + 1;
      expect(service.getTotalEnemiesInWave(beyondMax)).toBe(0);
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

      service.spawnForTurn(mockScene); // trigger first spawn

      const callArgs = enemyServiceSpy.spawnEnemy.calls.mostRecent().args as [EnemyType, THREE.Scene, number, number];
      const waveHealthMult = callArgs[2];
      expect(waveHealthMult).toBeGreaterThan(1);
    });

    it('passes speedMultiplier > 1 to spawnEnemy during an endless wave', () => {
      service.setEndlessMode(true);
      const beyondMax = WAVE_DEFINITIONS.length + 10;
      service.startWave(beyondMax, mockScene);

      service.spawnForTurn(mockScene);

      const callArgs = enemyServiceSpy.spawnEnemy.calls.mostRecent().args as [EnemyType, THREE.Scene, number, number];
      const waveSpeedMult = callArgs[3];
      expect(waveSpeedMult).toBeGreaterThan(1);
    });

    it('passes multipliers = 1 to spawnEnemy during a scripted wave', () => {
      service.startWave(1, mockScene);
      service.spawnForTurn(mockScene);

      const callArgs = enemyServiceSpy.spawnEnemy.calls.mostRecent().args as [EnemyType, THREE.Scene, number, number];
      expect(callArgs[2]).toBe(1);
      expect(callArgs[3]).toBe(1);
    });

    it('later endless waves pass higher healthMultiplier than earlier endless waves', () => {
      service.setEndlessMode(true);

      service.startWave(WAVE_DEFINITIONS.length + 1, mockScene);
      service.spawnForTurn(mockScene);
      const earlyMult = (enemyServiceSpy.spawnEnemy.calls.mostRecent().args as [EnemyType, THREE.Scene, number, number])[2];

      service.startWave(WAVE_DEFINITIONS.length + 20, mockScene);
      service.spawnForTurn(mockScene);
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
      service.spawnForTurn(mockScene);
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(EnemyType.FAST, mockScene, 1, 1, jasmine.any(Set));
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

  // --- TEMPORAL_RIFT relic: +1 empty prep turn at wave start ---

  describe('TEMPORAL_RIFT relic (getTurnDelayPerWave)', () => {
    it('without TEMPORAL_RIFT: first spawnForTurn spawns immediately (no empty prep turn)', () => {
      relicServiceSpy.getTurnDelayPerWave.and.returnValue(0);
      service.startWave(1, mockScene);

      service.spawnForTurn(mockScene);

      // Wave 1 has 5 BASIC enemies; first turn should spawn at least one
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalled();
    });

    it('with TEMPORAL_RIFT: first spawnForTurn is an empty prep turn (no spawns)', () => {
      relicServiceSpy.getTurnDelayPerWave.and.returnValue(1);
      service.startWave(1, mockScene);

      // First turn should be the empty prep turn — no enemy spawns
      service.spawnForTurn(mockScene);

      expect(enemyServiceSpy.spawnEnemy).not.toHaveBeenCalled();
    });

    it('with TEMPORAL_RIFT: second spawnForTurn spawns enemies normally', () => {
      relicServiceSpy.getTurnDelayPerWave.and.returnValue(1);
      service.startWave(1, mockScene);

      service.spawnForTurn(mockScene); // empty prep turn
      service.spawnForTurn(mockScene); // first real spawn turn

      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalled();
    });

    it('with TEMPORAL_RIFT: total enemy count in the schedule is unchanged', () => {
      const wave1TotalEnemies = WAVE_DEFINITIONS[0].entries!.reduce((s, e) => s + e.count, 0);

      relicServiceSpy.getTurnDelayPerWave.and.returnValue(1);
      service.startWave(1, mockScene);

      // Drain all turns
      for (let i = 0; i < wave1TotalEnemies + 5; i++) {
        service.spawnForTurn(mockScene);
      }

      // All enemy types should have been spawned — total calls matches wave definition
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(wave1TotalEnemies);
    });

    it('without TEMPORAL_RIFT: total enemy count matches wave definition (regression)', () => {
      const wave1TotalEnemies = WAVE_DEFINITIONS[0].entries!.reduce((s, e) => s + e.count, 0);

      relicServiceSpy.getTurnDelayPerWave.and.returnValue(0);
      service.startWave(1, mockScene);

      for (let i = 0; i < wave1TotalEnemies + 5; i++) {
        service.spawnForTurn(mockScene);
      }

      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(wave1TotalEnemies);
    });
  });

  // --- authored spawnTurns[][] path ---

  describe('startWave with authored spawnTurns', () => {
    const AUTHORED_WAVE = {
      spawnTurns: [
        [EnemyType.BASIC, EnemyType.BASIC],
        [],
        [EnemyType.FAST],
      ],
      reward: 50,
    };

    it('should activate when given a spawnTurns wave', () => {
      service.setCustomWaves([AUTHORED_WAVE]);
      service.startWave(1, mockScene);
      expect(service.isSpawning()).toBeTrue();
    });

    it('turn 0 spawns 2 BASIC enemies', () => {
      service.setCustomWaves([AUTHORED_WAVE]);
      service.startWave(1, mockScene);
      const count = service.spawnForTurn(mockScene);
      expect(count).toBe(2);
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(2);
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(EnemyType.BASIC, mockScene, 1, 1, jasmine.any(Set));
    });

    it('turn 1 is an empty prep turn — 0 enemies spawned and schedule still active', () => {
      service.setCustomWaves([AUTHORED_WAVE]);
      service.startWave(1, mockScene);
      service.spawnForTurn(mockScene); // turn 0: 2 BASIC
      const count = service.spawnForTurn(mockScene); // turn 1: empty prep
      expect(count).toBe(0);
      expect(service.isSpawning()).toBeTrue(); // still active — turn 2 has FAST
    });

    it('turn 2 spawns 1 FAST enemy', () => {
      service.setCustomWaves([AUTHORED_WAVE]);
      service.startWave(1, mockScene);
      service.spawnForTurn(mockScene); // turn 0
      service.spawnForTurn(mockScene); // turn 1
      const count = service.spawnForTurn(mockScene); // turn 2
      expect(count).toBe(1);
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(EnemyType.FAST, mockScene, 1, 1, jasmine.any(Set));
    });

    it('becomes inactive after turn 2 (schedule exhausted)', () => {
      service.setCustomWaves([AUTHORED_WAVE]);
      service.startWave(1, mockScene);
      service.spawnForTurn(mockScene); // turn 0
      service.spawnForTurn(mockScene); // turn 1
      service.spawnForTurn(mockScene); // turn 2
      expect(service.isSpawning()).toBeFalse();
    });

    it('getRemainingToSpawn reflects aggregate counts from spawnTurns', () => {
      service.setCustomWaves([AUTHORED_WAVE]);
      service.startWave(1, mockScene);
      // 2 BASIC + 0 + 1 FAST = 3 total
      expect(service.getRemainingToSpawn()).toBe(3);
    });
  });

  describe('startWave: legacy entries[] path unchanged', () => {
    it('entries[] wave still spawns correctly after refactor', () => {
      // Wave 1 is an entries-format wave with 5 BASIC
      service.startWave(1, mockScene);
      expect(service.getRemainingToSpawn()).toBe(5);
      service.spawnForTurn(mockScene);
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(EnemyType.BASIC, mockScene, 1, 1, jasmine.any(Set));
    });
  });

  describe('startWave: spawnTurns takes precedence when both fields are set', () => {
    it('uses spawnTurns path and ignores entries when both are present', () => {
      const bothFieldsWave = {
        entries: [{ type: EnemyType.HEAVY, count: 10, spawnInterval: 1.0 }],
        spawnTurns: [[EnemyType.FAST]], // only 1 FAST
        reward: 20,
      };
      service.setCustomWaves([bothFieldsWave]);
      service.startWave(1, mockScene);
      service.spawnForTurn(mockScene);
      // Should spawn FAST (from spawnTurns), not HEAVY (from entries)
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(EnemyType.FAST, mockScene, 1, 1, jasmine.any(Set));
      expect(enemyServiceSpy.spawnEnemy).not.toHaveBeenCalledWith(EnemyType.HEAVY, mockScene, 1, 1, jasmine.any(Set));
    });
  });

  describe('startWave: neither entries nor spawnTurns throws', () => {
    it('throws a runtime error when wave has no format', () => {
      const emptyWave = { reward: 10 } as any; // intentionally malformed
      service.setCustomWaves([emptyWave]);
      expect(() => service.startWave(1, mockScene))
        .toThrowError(/neither entries\[\] nor spawnTurns\[\]\[\]/);
    });
  });

  describe('getRemainingToSpawn with authored spawnTurns', () => {
    it('correctly counts BASIC×3 + FAST×1 from [[BASIC, BASIC], [FAST], [BASIC]]', () => {
      const wave = {
        spawnTurns: [
          [EnemyType.BASIC, EnemyType.BASIC],
          [EnemyType.FAST],
          [EnemyType.BASIC],
        ],
        reward: 30,
      };
      service.setCustomWaves([wave]);
      service.startWave(1, mockScene);
      // getRemainingToSpawn delegates to getRemainingInTurnSchedule = 4 total
      expect(service.getRemainingToSpawn()).toBe(4);
    });
  });

  describe('TEMPORAL_RIFT with authored spawnTurns', () => {
    it('with TEMPORAL_RIFT: first spawnForTurn is empty (delay turn prepended)', () => {
      relicServiceSpy.getTurnDelayPerWave.and.returnValue(1);
      const wave = {
        spawnTurns: [[EnemyType.BASIC]],
        reward: 10,
      };
      service.setCustomWaves([wave]);
      service.startWave(1, mockScene);

      // First turn should be the TEMPORAL_RIFT empty delay — no spawns
      const count = service.spawnForTurn(mockScene);
      expect(count).toBe(0);
      expect(enemyServiceSpy.spawnEnemy).not.toHaveBeenCalled();
    });

    it('with TEMPORAL_RIFT: second spawnForTurn spawns the authored schedule', () => {
      relicServiceSpy.getTurnDelayPerWave.and.returnValue(1);
      const wave = {
        spawnTurns: [[EnemyType.BASIC]],
        reward: 10,
      };
      service.setCustomWaves([wave]);
      service.startWave(1, mockScene);

      service.spawnForTurn(mockScene); // delay turn
      service.spawnForTurn(mockScene); // authored turn 0: BASIC
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(EnemyType.BASIC, mockScene, 1, 1, jasmine.any(Set));
    });
  });

  describe('authored empty prep turn advances schedule index', () => {
    it('[[BASIC], [], [FAST]] — empty turn 1 is consumed, FAST spawns on turn 2', () => {
      relicServiceSpy.getTurnDelayPerWave.and.returnValue(0);
      const wave = {
        spawnTurns: [
          [EnemyType.BASIC],
          [], // intentional prep turn
          [EnemyType.FAST],
        ],
        reward: 15,
      };
      service.setCustomWaves([wave]);
      service.startWave(1, mockScene);

      service.spawnForTurn(mockScene); // turn 0: BASIC
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(1);

      service.spawnForTurn(mockScene); // turn 1: empty
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(1); // no new spawns
      expect(service.isSpawning()).toBeTrue(); // FAST still pending

      service.spawnForTurn(mockScene); // turn 2: FAST
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(2);
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(EnemyType.FAST, mockScene, 1, 1, jasmine.any(Set));

      expect(service.isSpawning()).toBeFalse();
    });
  });

  // --- checkpoint serialization ---

  describe('checkpoint serialization', () => {
    const CUSTOM_WAVES_FOR_CHECKPOINT = [
      {
        entries: [
          { type: EnemyType.BASIC, count: 5, spawnInterval: 1.0 },
        ],
        reward: 20,
      },
      {
        entries: [
          { type: EnemyType.FAST, count: 3, spawnInterval: 0.8 },
        ],
        reward: 30,
      },
    ];

    it('serializeState() captures mid-wave state', () => {
      service.setCustomWaves(CUSTOM_WAVES_FOR_CHECKPOINT);
      service.startWave(1, mockScene);
      // Advance two turns into the wave
      service.spawnForTurn(mockScene);
      service.spawnForTurn(mockScene);

      const snapshot = service.serializeState();

      expect(snapshot.currentWaveIndex).toBe(0); // wave 1 → index 0
      expect(snapshot.turnScheduleIndex).toBe(2);
      expect(snapshot.active).toBeTrue();
    });

    it('restoreState() sets all fields directly without startWave()', () => {
      const snapshot = {
        currentWaveIndex: 1,
        turnSchedule: [
          [EnemyType.BASIC],
          [EnemyType.BASIC],
          [EnemyType.FAST],
          [EnemyType.FAST],
          [EnemyType.HEAVY],
        ],
        turnScheduleIndex: 3,
        active: true,
        endlessMode: false,
        currentEndlessResult: null,
      };

      service.restoreState(snapshot);

      // The schedule and index must be preserved exactly
      expect(service.isSpawning()).toBeTrue();
      // Remaining = turns from index 3 onward: [FAST, FAST] + [HEAVY] = 2 enemies
      expect(service.getRemainingToSpawn()).toBe(2);
    });

    it('restoreState() does NOT rebuild turnSchedule from wave definitions', () => {
      // Provide a custom schedule that would never be generated by startWave()
      const customSchedule = [
        [EnemyType.BASIC],
        [EnemyType.FAST, EnemyType.FAST],
      ];
      const snapshot = {
        currentWaveIndex: 0,
        turnSchedule: customSchedule,
        turnScheduleIndex: 0,
        active: true,
        endlessMode: false,
        currentEndlessResult: null,
      };

      service.restoreState(snapshot);

      // First turn: 1 BASIC
      const count0 = service.spawnForTurn(mockScene);
      expect(count0).toBe(1);
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(EnemyType.BASIC, mockScene, 1, 1, jasmine.any(Set));

      // Second turn: 2 FAST
      enemyServiceSpy.spawnEnemy.calls.reset();
      const count1 = service.spawnForTurn(mockScene);
      expect(count1).toBe(2);
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(EnemyType.FAST, mockScene, 1, 1, jasmine.any(Set));
    });

    it('serialize → restore roundtrip preserves all state', () => {
      service.setCustomWaves(CUSTOM_WAVES_FOR_CHECKPOINT);
      service.setEndlessMode(true);
      service.startWave(2, mockScene);
      // Advance the schedule
      service.spawnForTurn(mockScene);

      const snapshot = service.serializeState();

      // Reset to clean state, then restore
      service.reset();
      service.restoreState(snapshot);

      const restored = service.serializeState();

      expect(restored.currentWaveIndex).toBe(snapshot.currentWaveIndex);
      expect(restored.turnScheduleIndex).toBe(snapshot.turnScheduleIndex);
      expect(restored.active).toBe(snapshot.active);
      expect(restored.endlessMode).toBe(snapshot.endlessMode);
      expect(restored.turnSchedule).toEqual(snapshot.turnSchedule);
    });

    it('serializeState() includes turnScheduleRetries', () => {
      service.startWave(1, mockScene);
      const snapshot = service.serializeState();
      expect(snapshot.turnScheduleRetries).toBeDefined();
      expect(Array.isArray(snapshot.turnScheduleRetries)).toBeTrue();
      expect(snapshot.turnScheduleRetries!.length).toBe(snapshot.turnSchedule.length);
    });

    it('restoreState() restores turnScheduleRetries from snapshot', () => {
      const snapshot = {
        currentWaveIndex: 0,
        turnSchedule: [[EnemyType.BASIC], [EnemyType.FAST]],
        turnScheduleIndex: 0,
        turnScheduleRetries: [2, 0],
        active: true,
        endlessMode: false,
        currentEndlessResult: null,
      };
      service.restoreState(snapshot);
      const reserialized = service.serializeState();
      expect(reserialized.turnScheduleRetries).toEqual([2, 0]);
    });

    it('restoreState() defaults turnScheduleRetries to zeros when absent (backwards compat)', () => {
      const snapshot = {
        currentWaveIndex: 0,
        turnSchedule: [[EnemyType.BASIC], [EnemyType.FAST]],
        turnScheduleIndex: 0,
        // No turnScheduleRetries field
        active: true,
        endlessMode: false,
        currentEndlessResult: null,
      };
      service.restoreState(snapshot);
      const reserialized = service.serializeState();
      expect(reserialized.turnScheduleRetries).toEqual([0, 0]);
    });
  });

  // ---------------------------------------------------------------------------
  // Spawn retry logic — Fix #43: null return handling
  // ---------------------------------------------------------------------------

  describe('spawnForTurn — null return retry logic', () => {
    it('does NOT advance turnScheduleIndex when spawnEnemy returns null', () => {
      enemyServiceSpy.spawnEnemy.and.returnValue(null);
      service.startWave(1, mockScene);

      const indexBefore = service.serializeState().turnScheduleIndex;
      service.spawnForTurn(mockScene); // null return — should not advance
      const indexAfter = service.serializeState().turnScheduleIndex;

      expect(indexAfter).toBe(indexBefore);
    });

    it('retries the same slot on subsequent spawnForTurn calls when null returned', () => {
      enemyServiceSpy.spawnEnemy.and.returnValue(null);
      service.startWave(1, mockScene);

      service.spawnForTurn(mockScene); // attempt 1 — null
      service.spawnForTurn(mockScene); // attempt 2 — null

      // spawnEnemy should have been called twice (both attempts used the same slot)
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledTimes(2);
      // Index still at 0 — retries pending
      expect(service.serializeState().turnScheduleIndex).toBe(0);
    });

    it('drops slot and advances after MAX_SPAWN_RETRIES consecutive failures', () => {
      // Wave 1: 5 turns of 1 BASIC each — use the first slot
      enemyServiceSpy.spawnEnemy.and.returnValue(null);
      service.startWave(1, mockScene);

      // The retry limit is 3 (MAX_SPAWN_RETRIES). After 3 failures the slot is dropped.
      service.spawnForTurn(mockScene); // fail 1
      service.spawnForTurn(mockScene); // fail 2
      service.spawnForTurn(mockScene); // fail 3 — slot dropped, index advances

      const indexAfter3 = service.serializeState().turnScheduleIndex;
      expect(indexAfter3).toBe(1); // advanced past the dropped slot
    });

    it('logs a console.warn when a slot is dropped after max retries', () => {
      const warnSpy = spyOn(console, 'warn');
      enemyServiceSpy.spawnEnemy.and.returnValue(null);
      service.startWave(1, mockScene);

      service.spawnForTurn(mockScene);
      service.spawnForTurn(mockScene);
      service.spawnForTurn(mockScene); // triggers drop

      expect(warnSpy).toHaveBeenCalled();
    });

    it('retries only failed types on partial success — does not drop, does not advance', () => {
      // Wave 3: turn 0 has [BASIC, FAST] — BASIC succeeds, FAST fails.
      // Correct behavior: return spawned count, rewrite slot to [FAST], keep index.
      let callCount = 0;
      enemyServiceSpy.spawnEnemy.and.callFake(() => {
        callCount++;
        return callCount % 2 === 1 ? ({ id: `enemy-${callCount}` } as any) : null;
      });
      service.startWave(3, mockScene);
      const indexBefore = service.serializeState().turnScheduleIndex;

      service.spawnForTurn(mockScene);

      expect(service.serializeState().turnScheduleIndex).toBe(indexBefore);
    });

    it('re-attempts only the failed types on the next spawnForTurn', () => {
      // Turn 1: two calls (BASIC succeeds, FAST fails). Turn 2: one call for FAST retry.
      let callCount = 0;
      enemyServiceSpy.spawnEnemy.and.callFake(() => {
        callCount++;
        if (callCount === 1) return { id: 'enemy-basic' } as any; // BASIC succeeds
        if (callCount === 2) return null;                         // FAST fails
        return { id: 'enemy-fast' } as any;                       // retry succeeds
      });
      service.startWave(3, mockScene);

      service.spawnForTurn(mockScene); // partial success, retry pending
      const callsAfterFirst = enemyServiceSpy.spawnEnemy.calls.count();

      service.spawnForTurn(mockScene); // should retry only the failed FAST

      const callsAfterSecond = enemyServiceSpy.spawnEnemy.calls.count();
      expect(callsAfterSecond - callsAfterFirst).toBe(1);
    });

    it('resets retry count after startWave() so previous retries do not carry over', () => {
      enemyServiceSpy.spawnEnemy.and.returnValue(null);
      service.startWave(1, mockScene);

      service.spawnForTurn(mockScene); // accumulate 1 retry
      service.spawnForTurn(mockScene); // accumulate 2 retries

      // Re-start the wave — retries should reset
      enemyServiceSpy.spawnEnemy.and.returnValue({ id: 'enemy-0' } as any);
      service.startWave(1, mockScene);

      const spawned = service.spawnForTurn(mockScene);
      expect(spawned).toBe(1); // fresh start, no leftover retry count
    });
  });

  // ---------------------------------------------------------------------------
  // CALTROPS wire-up — S10: consumeNextWaveEnemySpeedMultiplier called at wave-start
  // ---------------------------------------------------------------------------

  describe('CALTROPS — setNextWaveEnemySpeedMultiplier / consumeNextWaveEnemySpeedMultiplier', () => {
    it('enemies spawn at reduced speed when multiplier is set before startWave', () => {
      service.setNextWaveEnemySpeedMultiplier(0.5);
      service.startWave(1, mockScene);
      service.spawnForTurn(mockScene);

      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(
        EnemyType.BASIC,
        mockScene,
        1,       // health mult unchanged
        0.5,     // caltrops speed applied
        jasmine.any(Set),
      );
    });

    it('multiplier is consumed after startWave — next wave spawns at 1.0 speed', () => {
      service.setNextWaveEnemySpeedMultiplier(0.5);
      service.startWave(1, mockScene);
      service.spawnForTurn(mockScene);

      // Advance past wave 1 entirely then start wave 2
      while (service.isSpawning()) {
        service.spawnForTurn(mockScene);
      }

      enemyServiceSpy.spawnEnemy.calls.reset();
      service.startWave(2, mockScene);
      service.spawnForTurn(mockScene);

      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(
        jasmine.any(String),
        mockScene,
        1,   // health mult
        1,   // speed back to normal — multiplier was one-shot
        jasmine.any(Set),
      );
    });

    it('consumeNextWaveEnemySpeedMultiplier returns 1.0 when no multiplier is set', () => {
      expect(service.consumeNextWaveEnemySpeedMultiplier()).toBe(1);
    });

    it('consumeNextWaveEnemySpeedMultiplier returns set value and resets to 1', () => {
      service.setNextWaveEnemySpeedMultiplier(0.75);
      expect(service.consumeNextWaveEnemySpeedMultiplier()).toBe(0.75);
      expect(service.consumeNextWaveEnemySpeedMultiplier()).toBe(1);
    });

    it('reset() clears any pending caltrops multiplier', () => {
      service.setNextWaveEnemySpeedMultiplier(0.5);
      service.reset();
      service.startWave(1, mockScene);
      service.spawnForTurn(mockScene);

      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(
        jasmine.any(String),
        mockScene,
        1,
        1,   // reset cleared the pending multiplier
        jasmine.any(Set),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // H1a: CALTROPS multiplier serialization — serializeState / restoreState
  // ---------------------------------------------------------------------------

  describe('CALTROPS multiplier serialization (H1a)', () => {
    it('serializeState() captures nextWaveEnemySpeedMultiplier when set', () => {
      service.setNextWaveEnemySpeedMultiplier(0.5);
      const snapshot = service.serializeState();
      expect(snapshot.nextWaveEnemySpeedMultiplier).toBe(0.5);
    });

    it('restoreState() preserves nextWaveEnemySpeedMultiplier across reset', () => {
      service.setNextWaveEnemySpeedMultiplier(0.5);
      const snapshot = service.serializeState();

      service.reset();
      service.restoreState(snapshot);

      // After restore, startWave should consume the 0.5 multiplier
      service.startWave(1, mockScene);
      service.spawnForTurn(mockScene);

      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(
        jasmine.any(String),
        mockScene,
        1,
        0.5,  // restored CALTROPS multiplier was applied
        jasmine.any(Set),
      );
    });

    it('serializeState() captures activeWaveCaltropsMultiplier after startWave() consumes it', () => {
      service.setNextWaveEnemySpeedMultiplier(0.5);
      service.startWave(1, mockScene);

      // At this point activeWaveCaltropsMultiplier = 0.5, nextWaveEnemySpeedMultiplier reset to 1
      const snapshot = service.serializeState();

      expect(snapshot.activeWaveCaltropsMultiplier).toBe(0.5);
      expect(snapshot.nextWaveEnemySpeedMultiplier).toBe(1);
    });

    it('restoreState() preserves activeWaveCaltropsMultiplier so mid-wave spawns use the right speed', () => {
      service.setNextWaveEnemySpeedMultiplier(0.5);
      service.startWave(1, mockScene);
      const snapshot = service.serializeState();

      service.reset();
      service.restoreState(snapshot);

      // Spawning mid-wave after restore must still use 0.5×
      service.spawnForTurn(mockScene);
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(
        jasmine.any(String),
        mockScene,
        1,
        0.5,
        jasmine.any(Set),
      );
    });

    it('restoreState() defaults both multipliers to 1 when absent (backwards compat)', () => {
      const snapshot = {
        currentWaveIndex: 0,
        turnSchedule: [[EnemyType.BASIC]],
        turnScheduleIndex: 0,
        turnScheduleRetries: [0],
        active: true,
        endlessMode: false,
        currentEndlessResult: null,
        // nextWaveEnemySpeedMultiplier and activeWaveCaltropsMultiplier intentionally absent
      };
      service.restoreState(snapshot);

      service.spawnForTurn(mockScene);
      expect(enemyServiceSpy.spawnEnemy).toHaveBeenCalledWith(
        jasmine.any(String),
        mockScene,
        1,
        1,   // both multipliers defaulted to 1
        jasmine.any(Set),
      );
    });
  });
});
