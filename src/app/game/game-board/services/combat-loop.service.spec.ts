import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { CombatLoopService } from './combat-loop.service';
import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { TowerCombatService } from './tower-combat.service';
import { EnemyService } from './enemy.service';
import { GameStatsService } from './game-stats.service';
import { GameEndService } from './game-end.service';
import { RelicService } from '../../../ascent/services/relic.service';
import { createRelicServiceSpy } from '../testing';

import { GamePhase } from '../models/game-state.model';
import { TowerType } from '../models/tower.model';
import { EnemyType } from '../models/enemy.model';
import { PHYSICS_CONFIG } from '../constants/physics.constants';

/** Minimal Enemy stub sufficient for CombatLoopService tests. */
function makeEnemy(overrides: Partial<{
  id: string; type: EnemyType; value: number; leakDamage: number;
  position: { x: number; y: number; z: number };
}> = {}): any {
  return {
    id: overrides.id ?? 'e1',
    type: overrides.type ?? EnemyType.BASIC,
    value: overrides.value ?? 10,
    leakDamage: overrides.leakDamage ?? 1,
    position: overrides.position ?? { x: 0, y: 0, z: 0 },
  };
}

describe('CombatLoopService', () => {
  let service: CombatLoopService;
  let gameStateSpy: jasmine.SpyObj<GameStateService>;
  let waveSpy: jasmine.SpyObj<WaveService>;
  let combatSpy: jasmine.SpyObj<TowerCombatService>;
  let enemySpy: jasmine.SpyObj<EnemyService>;
  let gameStatsSpy: jasmine.SpyObj<GameStatsService>;
  let gameEndSpy: jasmine.SpyObj<GameEndService>;
  let scene: THREE.Scene;

  const FIXED_DT = PHYSICS_CONFIG.fixedTimestep;

  function setupState(phase: GamePhase = GamePhase.COMBAT): void {
    gameStateSpy.getState.and.returnValue({
      phase,
      wave: 1,
      lives: 10,
      gold: 100,
      score: 0,
      isPaused: false,
      isEndless: false,
      gameSpeed: 1,
      difficulty: 'normal',
      maxWaves: 10,
      elapsedTime: 0,
      consecutiveWavesWithoutLeak: 0,
      highestWave: 0,
      activeModifiers: new Set(),
    } as any);
  }

  beforeEach(() => {
    gameStateSpy = jasmine.createSpyObj('GameStateService', [
      'getState',
      'addElapsedTime',
      'addGoldAndScore',
      'loseLife',
      'addStreakBonus',
      'getStreak',
      'completeWave',
      'awardInterest',
    ]);
    setupState();

    waveSpy = jasmine.createSpyObj('WaveService', ['update', 'isSpawning', 'getWaveReward']);
    waveSpy.isSpawning.and.returnValue(true); // default: still spawning (wave not done)
    waveSpy.getWaveReward.and.returnValue(50);

    combatSpy = jasmine.createSpyObj('TowerCombatService', ['update', 'drainAudioEvents']);
    combatSpy.update.and.returnValue({ killed: [], fired: [], hitCount: 0 });
    combatSpy.drainAudioEvents.and.returnValue([]);

    enemySpy = jasmine.createSpyObj('EnemyService', [
      'getEnemies',
      'updateEnemies',
      'removeEnemy',
      'startDyingAnimation',
      'getLivingEnemyCount',
    ]);
    enemySpy.getEnemies.and.returnValue(new Map());
    enemySpy.updateEnemies.and.returnValue([]);
    // Default: no living enemies (wave appears done unless overridden per-test)
    enemySpy.getLivingEnemyCount.and.returnValue(0);

    gameStatsSpy = jasmine.createSpyObj('GameStatsService', [
      'recordGoldEarned',
      'recordEnemyLeaked',
    ]);

    gameEndSpy = jasmine.createSpyObj('GameEndService', ['isRecorded', 'recordEnd']);
    gameEndSpy.isRecorded.and.returnValue(false);
    gameEndSpy.recordEnd.and.returnValue({ newlyUnlockedAchievements: [], completedChallenges: [] });

    scene = new THREE.Scene();

    TestBed.configureTestingModule({
      providers: [
        CombatLoopService,
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: WaveService, useValue: waveSpy },
        { provide: TowerCombatService, useValue: combatSpy },
        { provide: EnemyService, useValue: enemySpy },
        { provide: GameStatsService, useValue: gameStatsSpy },
        { provide: GameEndService, useValue: gameEndSpy },
        { provide: RelicService, useValue: createRelicServiceSpy() },
      ],
    });

    service = TestBed.inject(CombatLoopService);
  });

  afterEach(() => {
    scene.clear();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('reset()', () => {
    it('should zero both accumulators', () => {
      // Prime accumulators with one tick
      service.tick(0.016, 1, scene, null);
      service.reset();

      // After reset, a tiny delta should not trigger any physics steps
      const result = service.tick(0.001, 1, scene, null);
      expect(combatSpy.update).not.toHaveBeenCalled(); // no step triggered
      expect(result.kills.length).toBe(0);
    });

    it('should clear kill and firedType buffers', () => {
      const enemy = makeEnemy({ id: 'e1', value: 5 });
      const enemies = new Map([['e1', enemy]]);
      enemySpy.getEnemies.and.returnValue(enemies);
      combatSpy.update.and.returnValue({
        killed: [{ id: 'e1', damage: 5 }],
        fired: [TowerType.BASIC],
        hitCount: 1,
      });

      service.tick(FIXED_DT, 1, scene, null);
      service.reset();

      // Tick with empty combat to get clean result
      combatSpy.update.and.returnValue({ killed: [], fired: [], hitCount: 0 });
      enemySpy.getEnemies.and.returnValue(new Map());
      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(result.kills.length).toBe(0);
      expect(result.firedTypes.size).toBe(0);
    });

    it('should clear leakedThisWave flag so streak can be awarded after reset', () => {
      // Cause a leak to set leakedThisWave = true
      const leakEnemy = makeEnemy({ id: 'leak1' });
      enemySpy.getEnemies.and.returnValue(new Map([['leak1', leakEnemy]]));
      enemySpy.updateEnemies.and.returnValue(['leak1']);
      service.tick(FIXED_DT, 1, scene, null);

      // reset() should clear leakedThisWave
      service.reset();

      // Now set up a clean wave-clear — streak bonus should fire
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getEnemies.and.returnValue(new Map());
      enemySpy.updateEnemies.and.returnValue([]);
      gameStateSpy.addStreakBonus.and.returnValue(50);
      gameStateSpy.getStreak.and.returnValue(1);
      gameStateSpy.awardInterest.and.returnValue(0);
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : GamePhase.INTERMISSION,
        wave: 1, lives: 10, gold: 100, score: 0, isPaused: false,
        isEndless: false, gameSpeed: 1, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      service.tick(FIXED_DT, 1, scene, null);

      expect(gameStateSpy.addStreakBonus).toHaveBeenCalled();
    });
  });

  describe('resetLeakState()', () => {
    it('should clear leakedThisWave so a clean wave can earn streak bonus', () => {
      // Leak an enemy to prime leakedThisWave
      const leakEnemy = makeEnemy({ id: 'leak1' });
      enemySpy.getEnemies.and.returnValue(new Map([['leak1', leakEnemy]]));
      enemySpy.updateEnemies.and.returnValue(['leak1']);
      service.tick(FIXED_DT, 1, scene, null);

      // Reset just the leak state (simulating startWave)
      service.resetLeakState();

      // Set up a wave-clear — streak bonus should fire since leak state was reset
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getEnemies.and.returnValue(new Map());
      enemySpy.updateEnemies.and.returnValue([]);
      gameStateSpy.addStreakBonus.and.returnValue(50);
      gameStateSpy.getStreak.and.returnValue(1);
      gameStateSpy.awardInterest.and.returnValue(0);
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : GamePhase.INTERMISSION,
        wave: 2, lives: 9, gold: 100, score: 0, isPaused: false,
        isEndless: false, gameSpeed: 1, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      service.tick(FIXED_DT, 1, scene, null);

      expect(gameStateSpy.addStreakBonus).toHaveBeenCalled();
    });

    it('should be callable without error when no leak has occurred', () => {
      expect(() => service.resetLeakState()).not.toThrow();
    });
  });

  describe('flushElapsedTime()', () => {
    it('should flush accumulated elapsed time and return the amount', () => {
      // Advance time in two ticks (each less than fixedTimestep to avoid physics)
      service.tick(0.3, 1, scene, null);
      service.tick(0.4, 1, scene, null);

      const flushed = service.flushElapsedTime();

      expect(flushed).toBeCloseTo(0.7, 5);
      expect(gameStateSpy.addElapsedTime).toHaveBeenCalled();
    });

    it('should return 0 and not call addElapsedTime if nothing accumulated', () => {
      const flushed = service.flushElapsedTime();

      expect(flushed).toBe(0);
      expect(gameStateSpy.addElapsedTime).not.toHaveBeenCalled();
    });

    it('should reset accumulator to 0 after flush', () => {
      service.tick(0.5, 1, scene, null);
      service.flushElapsedTime();
      // Call again — should return 0
      const second = service.flushElapsedTime();
      expect(second).toBe(0);
    });
  });

  describe('tick() — physics accumulator', () => {
    it('should not run any physics steps when deltaTime is below the fixed timestep', () => {
      service.tick(0.001, 1, scene, null);

      expect(combatSpy.update).not.toHaveBeenCalled();
      expect(waveSpy.update).not.toHaveBeenCalled();
    });

    it('should run exactly one physics step when deltaTime equals fixedTimestep', () => {
      service.tick(FIXED_DT, 1, scene, null);

      expect(combatSpy.update).toHaveBeenCalledTimes(1);
      expect(waveSpy.update).toHaveBeenCalledTimes(1);
    });

    it('should accumulate across multiple ticks before stepping', () => {
      // Each tick is half a step — need two to fire one step
      service.tick(FIXED_DT / 2, 1, scene, null);
      expect(combatSpy.update).not.toHaveBeenCalled();

      service.tick(FIXED_DT / 2, 1, scene, null);
      expect(combatSpy.update).toHaveBeenCalledTimes(1);
    });

    it('should cap steps at PHYSICS_CONFIG.maxStepsPerFrame', () => {
      // Pass a huge delta that would require many steps
      service.tick(10, 1, scene, null);

      expect(combatSpy.update).toHaveBeenCalledTimes(PHYSICS_CONFIG.maxStepsPerFrame);
    });

    it('should scale accumulation by gameSpeed', () => {
      // At speed 2, half the fixedTimestep triggers a full step
      service.tick(FIXED_DT / 2, 2, scene, null);

      expect(combatSpy.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('tick() — kill processing', () => {
    it('should award gold and record stat for each kill', () => {
      const enemy = makeEnemy({ id: 'e1', value: 25 });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      combatSpy.update.and.returnValue({ killed: [{ id: 'e1', damage: 10 }], fired: [], hitCount: 0 });

      service.tick(FIXED_DT, 1, scene, null);

      expect(gameStateSpy.addGoldAndScore).toHaveBeenCalledWith(25);
      expect(gameStatsSpy.recordGoldEarned).toHaveBeenCalledWith(25);
    });

    it('should snapshot kill position and damage in result.kills', () => {
      const enemy = makeEnemy({ id: 'e1', value: 10, position: { x: 1, y: 2, z: 3 } });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      combatSpy.update.and.returnValue({ killed: [{ id: 'e1', damage: 7 }], fired: [], hitCount: 0 });

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(result.kills.length).toBe(1);
      expect(result.kills[0].damage).toBe(7);
      expect(result.kills[0].value).toBe(10);
      expect(result.kills[0].position).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('should call startDyingAnimation for each kill instead of removeEnemy', () => {
      const enemy = makeEnemy({ id: 'e1' });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      combatSpy.update.and.returnValue({ killed: [{ id: 'e1', damage: 5 }], fired: [], hitCount: 0 });

      service.tick(FIXED_DT, 1, scene, null);

      expect(enemySpy.startDyingAnimation).toHaveBeenCalledWith('e1');
      expect(enemySpy.removeEnemy).not.toHaveBeenCalledWith('e1', scene);
    });

    it('should accumulate kills across physics steps in the same frame', () => {
      let callCount = 0;
      const enemies = new Map([
        ['e1', makeEnemy({ id: 'e1', value: 5 })],
        ['e2', makeEnemy({ id: 'e2', value: 5 })],
      ]);
      enemySpy.getEnemies.and.returnValue(enemies);
      combatSpy.update.and.callFake(() => {
        callCount++;
        const id = callCount === 1 ? 'e1' : 'e2';
        return { killed: [{ id, damage: 3 }], fired: [], hitCount: 0 };
      });

      // Two steps in one tick
      const result = service.tick(FIXED_DT * 2, 1, scene, null);

      expect(result.kills.length).toBe(2);
    });
  });

  describe('tick() — enemy leak handling', () => {
    it('should call loseLife and recordEnemyLeaked when an enemy reaches the exit', () => {
      const enemy = makeEnemy({ id: 'e1', leakDamage: 2 });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      enemySpy.updateEnemies.and.returnValue(['e1']);

      service.tick(FIXED_DT, 1, scene, null);

      expect(gameStateSpy.loseLife).toHaveBeenCalledWith(2);
      expect(gameStatsSpy.recordEnemyLeaked).toHaveBeenCalled();
    });

    it('should set result.leaked = true when any enemy exits', () => {
      enemySpy.updateEnemies.and.returnValue(['e1']);
      enemySpy.getEnemies.and.returnValue(new Map([['e1', makeEnemy({ id: 'e1' })]]));

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(result.leaked).toBeTrue();
    });

    it('should set result.exitCount to the number of enemies that exited', () => {
      const enemies = new Map([
        ['e1', makeEnemy({ id: 'e1' })],
        ['e2', makeEnemy({ id: 'e2' })],
      ]);
      enemySpy.getEnemies.and.returnValue(enemies);
      enemySpy.updateEnemies.and.returnValue(['e1', 'e2']);

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(result.exitCount).toBe(2);
    });

    it('should set result.leaked = false when no enemies exit', () => {
      enemySpy.updateEnemies.and.returnValue([]);

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(result.leaked).toBeFalse();
    });
  });

  describe('tick() — defeat handling', () => {
    it('should set defeatTriggered = true when phase becomes DEFEAT mid-frame', () => {
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => {
        callCount++;
        // First call (wave number capture), then return DEFEAT on the per-step re-read
        return {
          phase: callCount === 1 ? GamePhase.COMBAT : GamePhase.DEFEAT,
          wave: 1, lives: 0, gold: 0, score: 0, isPaused: false,
          isEndless: false, gameSpeed: 1, difficulty: 'normal',
          maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
          highestWave: 0, activeModifiers: new Set(),
        } as any;
      });
      enemySpy.updateEnemies.and.returnValue(['e1']);
      enemySpy.getEnemies.and.returnValue(new Map([['e1', makeEnemy({ id: 'e1' })]]));

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(result.defeatTriggered).toBeTrue();
    });

    it('should record game end on DEFEAT mid-frame', () => {
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ === 0 ? GamePhase.COMBAT : GamePhase.DEFEAT,
        wave: 1, lives: 0, gold: 0, score: 0, isPaused: false,
        isEndless: false, gameSpeed: 1, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));
      enemySpy.updateEnemies.and.returnValue(['e1']);
      enemySpy.getEnemies.and.returnValue(new Map([['e1', makeEnemy({ id: 'e1' })]]));

      service.tick(FIXED_DT, 1, scene, null);

      expect(gameEndSpy.recordEnd).toHaveBeenCalledWith(false, null);
    });

    it('should not call recordEnd if already recorded', () => {
      gameEndSpy.isRecorded.and.returnValue(true);
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ === 0 ? GamePhase.COMBAT : GamePhase.DEFEAT,
        wave: 1, lives: 0, gold: 0, score: 0, isPaused: false,
        isEndless: false, gameSpeed: 1, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));
      enemySpy.updateEnemies.and.returnValue(['e1']);
      enemySpy.getEnemies.and.returnValue(new Map([['e1', makeEnemy({ id: 'e1' })]]));

      service.tick(FIXED_DT, 1, scene, null);

      expect(gameEndSpy.recordEnd).not.toHaveBeenCalled();
    });
  });

  describe('tick() — wave completion', () => {
    function setupWaveClear(resultPhase: GamePhase): void {
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getEnemies.and.returnValue(new Map()); // no enemies left
      gameStateSpy.addStreakBonus.and.returnValue(0);
      gameStateSpy.getStreak.and.returnValue(0);
      gameStateSpy.awardInterest.and.returnValue(0);
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : resultPhase,
        wave: 1, lives: 10, gold: 100, score: 0, isPaused: false,
        isEndless: false, gameSpeed: 1, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));
    }

    it('should call completeWave with the wave reward', () => {
      waveSpy.getWaveReward.and.returnValue(75);
      setupWaveClear(GamePhase.INTERMISSION);

      service.tick(FIXED_DT, 1, scene, null);

      expect(gameStateSpy.completeWave).toHaveBeenCalledWith(75);
    });

    it('should emit waveCompletion with INTERMISSION resultPhase', () => {
      setupWaveClear(GamePhase.INTERMISSION);
      gameStateSpy.awardInterest.and.returnValue(10);

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(result.waveCompletion).not.toBeNull();
      expect(result.waveCompletion!.resultPhase).toBe(GamePhase.INTERMISSION);
      expect(result.waveCompletion!.interestEarned).toBe(10);
    });

    it('should emit waveCompletion with VICTORY resultPhase', () => {
      setupWaveClear(GamePhase.VICTORY);

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(result.waveCompletion).not.toBeNull();
      expect(result.waveCompletion!.resultPhase).toBe(GamePhase.VICTORY);
    });

    it('should award streak bonus when no enemy has leaked this wave', () => {
      setupWaveClear(GamePhase.INTERMISSION);
      gameStateSpy.addStreakBonus.and.returnValue(100);
      gameStateSpy.getStreak.and.returnValue(2);

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(gameStateSpy.addStreakBonus).toHaveBeenCalled();
      expect(result.waveCompletion!.streakBonus).toBe(100);
      expect(result.waveCompletion!.streakCount).toBe(2);
    });

    it('should NOT award streak bonus when an enemy leaked in a prior tick this wave', () => {
      // Simulate a leak happening in a prior tick by priming leakedThisWave
      // via a tick that causes an exit, then resetting wave spawning state for the clear tick
      const enemy = makeEnemy({ id: 'e_leak' });
      enemySpy.getEnemies.and.returnValue(new Map([['e_leak', enemy]]));
      enemySpy.updateEnemies.and.returnValue(['e_leak']); // enemy reaches exit
      // Leak tick — no wave clear yet (still spawning)
      waveSpy.isSpawning.and.returnValue(true);
      service.tick(FIXED_DT, 1, scene, null);

      // Now set up wave-clear conditions
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getEnemies.and.returnValue(new Map());
      enemySpy.updateEnemies.and.returnValue([]);
      gameStateSpy.addStreakBonus.and.returnValue(0);
      gameStateSpy.awardInterest.and.returnValue(0);
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : GamePhase.INTERMISSION,
        wave: 1, lives: 9, gold: 100, score: 0, isPaused: false,
        isEndless: false, gameSpeed: 1, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      service.tick(FIXED_DT, 1, scene, null);

      expect(gameStateSpy.addStreakBonus).not.toHaveBeenCalled();
    });

    it('should NOT award streak bonus when an enemy leaked this frame', () => {
      waveSpy.isSpawning.and.returnValue(false);
      gameStateSpy.addStreakBonus.and.returnValue(0);
      gameStateSpy.awardInterest.and.returnValue(0);
      let callCount = 0;
      // Phase: COMBAT on first read (wave capture), COMBAT on enemy re-read, INTERMISSION after completeWave
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 3 ? GamePhase.COMBAT : GamePhase.INTERMISSION,
        wave: 1, lives: 10, gold: 100, score: 0, isPaused: false,
        isEndless: false, gameSpeed: 1, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));
      const enemy = makeEnemy({ id: 'e1' });
      let callCountEnemy = 0;
      enemySpy.getEnemies.and.callFake(() => {
        // Return non-empty on first call (for leak handling), empty for wave-clear check
        return callCountEnemy++ === 0 ? new Map([['e1', enemy]]) : new Map();
      });
      enemySpy.updateEnemies.and.returnValue(['e1']); // enemy leaks

      service.tick(FIXED_DT, 1, scene, null);

      expect(gameStateSpy.addStreakBonus).not.toHaveBeenCalled();
    });

    it('should record game end on VICTORY', () => {
      setupWaveClear(GamePhase.VICTORY);
      gameEndSpy.recordEnd.and.returnValue({ newlyUnlockedAchievements: ['ach1'], completedChallenges: [] });

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(gameEndSpy.recordEnd).toHaveBeenCalledWith(true, null);
      expect(result.gameEnd).not.toBeNull();
      expect(result.gameEnd!.isVictory).toBeTrue();
      expect(result.gameEnd!.newlyUnlockedAchievements).toEqual(['ach1']);
    });

    it('should not emit waveCompletion when spawning is still active', () => {
      waveSpy.isSpawning.and.returnValue(true);

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(result.waveCompletion).toBeNull();
      expect(gameStateSpy.completeWave).not.toHaveBeenCalled();
    });

    it('should not emit waveCompletion when enemies are still alive', () => {
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getEnemies.and.returnValue(new Map([['e1', makeEnemy()]]));
      // Simulate living enemies — getLivingEnemyCount returns non-zero
      enemySpy.getLivingEnemyCount.and.returnValue(1);

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(result.waveCompletion).toBeNull();
    });
  });

  describe('tick() — fired types and hit count', () => {
    it('should accumulate firedTypes from TowerCombatService', () => {
      combatSpy.update.and.returnValue({ killed: [], fired: [TowerType.BASIC, TowerType.SNIPER], hitCount: 0 });

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(result.firedTypes.has(TowerType.BASIC)).toBeTrue();
      expect(result.firedTypes.has(TowerType.SNIPER)).toBeTrue();
    });

    it('should accumulate hitCount across physics steps', () => {
      let step = 0;
      combatSpy.update.and.callFake(() => ({
        killed: [], fired: [], hitCount: step++ === 0 ? 3 : 2,
      }));

      // Two steps in one tick
      const result = service.tick(FIXED_DT * 2, 1, scene, null);

      expect(result.hitCount).toBe(5);
    });
  });

  describe('tick() — combat audio events', () => {
    it('should include drained combat audio events in the result', () => {
      const events = [{ type: 'sfx' as const, sfxKey: 'chain' }];
      combatSpy.drainAudioEvents.and.returnValue(events);

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(result.combatAudioEvents).toEqual(events);
    });
  });

  describe('tick() — elapsed time flush', () => {
    it('should flush accumulated elapsed time when threshold exceeded', () => {
      // Exceed PHYSICS_CONFIG.elapsedTimeFlushIntervalS (1 second) in one tick
      service.tick(PHYSICS_CONFIG.elapsedTimeFlushIntervalS + 0.01, 1, scene, null);

      expect(gameStateSpy.addElapsedTime).toHaveBeenCalled();
    });

    it('should not flush if accumulated time is below threshold', () => {
      service.tick(0.5, 1, scene, null);

      // Internal periodic flush shouldn't fire for 0.5s
      expect(gameStateSpy.addElapsedTime).not.toHaveBeenCalled();
    });
  });

  // ─── pause handling ─────────────────────────────────────────────────────────
  // CombatLoopService.tick() has no internal isPaused guard — the component is
  // responsible for not calling tick() when paused. The contract here is that
  // a tick with deltaTime=0 (the effective no-op the component uses) performs
  // zero physics steps and does not advance the physics accumulator.

  describe('tick() — pause behavior (deltaTime=0 contract)', () => {
    it('should perform no physics steps when deltaTime is 0', () => {
      service.tick(0, 1, scene, null);

      expect(combatSpy.update).not.toHaveBeenCalled();
      expect(waveSpy.update).not.toHaveBeenCalled();
    });

    it('should return zero kills, zero hitCount, and no waveCompletion when deltaTime is 0', () => {
      const result = service.tick(0, 1, scene, null);

      expect(result.kills.length).toBe(0);
      expect(result.hitCount).toBe(0);
      expect(result.waveCompletion).toBeNull();
    });

    it('should not advance physics accumulator — subsequent tiny delta still triggers no steps', () => {
      // Simulate a series of zero-delta ticks (paused frames)
      service.tick(0, 1, scene, null);
      service.tick(0, 1, scene, null);
      service.tick(0, 1, scene, null);

      // Small non-zero delta still below fixedTimestep — should still be no steps
      service.tick(0.001, 1, scene, null);

      expect(combatSpy.update).not.toHaveBeenCalled();
    });

    it('should still accumulate elapsed time even at deltaTime=0', () => {
      // Advance elapsed time to near the flush threshold via a non-physics tick
      service.tick(PHYSICS_CONFIG.elapsedTimeFlushIntervalS - 0.001, 1, scene, null);
      expect(gameStateSpy.addElapsedTime).not.toHaveBeenCalled();

      // A zero-delta tick does not push elapsed time over the threshold
      service.tick(0, 1, scene, null);
      expect(gameStateSpy.addElapsedTime).not.toHaveBeenCalled();
    });

    it('should not advance accumulator across multiple zero-delta ticks followed by one FIXED_DT', () => {
      // After several zero-delta ticks the accumulator is 0;
      // exactly one fixedTimestep should trigger exactly one physics step
      service.tick(0, 1, scene, null);
      service.tick(0, 1, scene, null);
      combatSpy.update.calls.reset();
      waveSpy.update.calls.reset();

      service.tick(FIXED_DT, 1, scene, null);

      expect(combatSpy.update).toHaveBeenCalledTimes(1);
      expect(waveSpy.update).toHaveBeenCalledTimes(1);
    });
  });

  // ─── integration: full wave lifecycle ───────────────────────────────────────

  describe('integration: wave lifecycle', () => {
    it('full wave clear: spawn done, no enemies left → waveCompletion emitted', () => {
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getEnemies.and.returnValue(new Map());
      gameStateSpy.addStreakBonus.and.returnValue(0);
      gameStateSpy.getStreak.and.returnValue(0);
      gameStateSpy.awardInterest.and.returnValue(0);
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : GamePhase.INTERMISSION,
        wave: 1, lives: 10, gold: 100, score: 0, isPaused: false,
        isEndless: false, gameSpeed: 1, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(result.waveCompletion).not.toBeNull();
      expect(result.waveCompletion!.resultPhase).toBe(GamePhase.INTERMISSION);
      expect(gameStateSpy.completeWave).toHaveBeenCalled();
    });

    it('enemy leaks to exit → loseLife called, result.leaked = true', () => {
      const enemy = makeEnemy({ id: 'leaked1', leakDamage: 3 });
      enemySpy.getEnemies.and.returnValue(new Map([['leaked1', enemy]]));
      enemySpy.updateEnemies.and.returnValue(['leaked1']); // enemy reached exit

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(gameStateSpy.loseLife).toHaveBeenCalledWith(3);
      expect(result.leaked).toBeTrue();
    });

    it('wave completion with no leaks awards streak bonus', () => {
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getEnemies.and.returnValue(new Map());
      enemySpy.updateEnemies.and.returnValue([]);
      gameStateSpy.addStreakBonus.and.returnValue(50);
      gameStateSpy.getStreak.and.returnValue(3);
      gameStateSpy.awardInterest.and.returnValue(0);
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : GamePhase.INTERMISSION,
        wave: 3, lives: 10, gold: 100, score: 0, isPaused: false,
        isEndless: false, gameSpeed: 1, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 3,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(gameStateSpy.addStreakBonus).toHaveBeenCalled();
      expect(result.waveCompletion!.streakBonus).toBe(50);
      expect(result.waveCompletion!.streakCount).toBe(3);
    });

    it('wave reward is correctly passed to completeWave', () => {
      waveSpy.isSpawning.and.returnValue(false);
      waveSpy.getWaveReward.and.returnValue(120);
      enemySpy.getEnemies.and.returnValue(new Map());
      gameStateSpy.addStreakBonus.and.returnValue(0);
      gameStateSpy.getStreak.and.returnValue(0);
      gameStateSpy.awardInterest.and.returnValue(0);
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : GamePhase.INTERMISSION,
        wave: 1, lives: 10, gold: 100, score: 0, isPaused: false,
        isEndless: false, gameSpeed: 1, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      service.tick(FIXED_DT, 1, scene, null);

      expect(gameStateSpy.completeWave).toHaveBeenCalledWith(120);
    });

    it('DEFEAT mid-frame: defeatTriggered = true, recordEnd called', () => {
      const enemy = makeEnemy({ id: 'e1', leakDamage: 99 });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      enemySpy.updateEnemies.and.returnValue(['e1']);
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ === 0 ? GamePhase.COMBAT : GamePhase.DEFEAT,
        wave: 1, lives: 0, gold: 0, score: 0, isPaused: false,
        isEndless: false, gameSpeed: 1, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(result.defeatTriggered).toBeTrue();
      expect(gameEndSpy.recordEnd).toHaveBeenCalledWith(false, null);
    });

    it('VICTORY: waveCompletion resultPhase is VICTORY, recordEnd called with isVictory=true', () => {
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getEnemies.and.returnValue(new Map());
      gameStateSpy.addStreakBonus.and.returnValue(0);
      gameStateSpy.getStreak.and.returnValue(0);
      gameStateSpy.awardInterest.and.returnValue(0);
      gameEndSpy.recordEnd.and.returnValue({ newlyUnlockedAchievements: [], completedChallenges: [] });
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : GamePhase.VICTORY,
        wave: 10, lives: 10, gold: 100, score: 500, isPaused: false,
        isEndless: false, gameSpeed: 1, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 60, consecutiveWavesWithoutLeak: 5,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      const result = service.tick(FIXED_DT, 1, scene, null);

      expect(result.waveCompletion!.resultPhase).toBe(GamePhase.VICTORY);
      expect(gameEndSpy.recordEnd).toHaveBeenCalledWith(true, null);
      expect(result.gameEnd).not.toBeNull();
      expect(result.gameEnd!.isVictory).toBeTrue();
    });
  });

  // ─── defensive copies: kills and firedTypes ──────────────────────────────

  describe('tick() — defensive copy of kills and firedTypes', () => {
    it('mutating the returned kills array does not affect the next tick result', () => {
      const enemy = makeEnemy({ id: 'e1', value: 10 });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      combatSpy.update.and.returnValue({ killed: [{ id: 'e1', damage: 5 }], fired: [], hitCount: 0 });

      const result = service.tick(FIXED_DT, 1, scene, null);
      // Poison the returned array after consumption
      result.kills.push({ damage: 999, position: { x: 0, y: 0, z: 0 }, color: 0, value: 999 });

      // Next tick with no kills — the internal buffer should be unaffected
      combatSpy.update.and.returnValue({ killed: [], fired: [], hitCount: 0 });
      enemySpy.getEnemies.and.returnValue(new Map());
      const next = service.tick(FIXED_DT, 1, scene, null);

      expect(next.kills.length).toBe(0);
    });

    it('mutating the returned firedTypes set does not affect the next tick result', () => {
      combatSpy.update.and.returnValue({ killed: [], fired: [TowerType.BASIC], hitCount: 0 });

      const result = service.tick(FIXED_DT, 1, scene, null);
      expect(result.firedTypes.has(TowerType.BASIC)).toBeTrue();
      // Poison the returned set
      result.firedTypes.add(TowerType.SNIPER);

      // Next tick with no fired types — internal set should be unaffected
      combatSpy.update.and.returnValue({ killed: [], fired: [], hitCount: 0 });
      const next = service.tick(FIXED_DT, 1, scene, null);

      expect(next.firedTypes.has(TowerType.BASIC)).toBeFalse();
      expect(next.firedTypes.has(TowerType.SNIPER)).toBeFalse();
    });

    it('returned kills array is a snapshot — contains events from current tick only', () => {
      const enemy = makeEnemy({ id: 'e1', value: 5 });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      combatSpy.update.and.returnValue({ killed: [{ id: 'e1', damage: 3 }], fired: [], hitCount: 0 });

      const first = service.tick(FIXED_DT, 1, scene, null);

      // Second tick with no kills
      combatSpy.update.and.returnValue({ killed: [], fired: [], hitCount: 0 });
      enemySpy.getEnemies.and.returnValue(new Map());
      service.tick(FIXED_DT, 1, scene, null);

      // The first result should still hold the original kill (it's a copy, not a reference)
      expect(first.kills.length).toBe(1);
      expect(first.kills[0].damage).toBe(3);
    });
  });
});
