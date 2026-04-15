import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { CombatLoopService } from './combat-loop.service';
import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { TowerCombatService } from './tower-combat.service';
import { EnemyService } from './enemy.service';
import { GameStatsService } from './game-stats.service';
import { GameEndService } from './game-end.service';
import { StatusEffectService } from './status-effect.service';
import { RelicService } from '../../../run/services/relic.service';
import { RunEventBusService, RunEventType } from '../../../run/services/run-event-bus.service';
import { CardEffectService } from '../../../run/services/card-effect.service';
import { createRelicServiceSpy, createCardEffectServiceSpy } from '../testing';

import { GamePhase } from '../models/game-state.model';
import { TowerType } from '../models/tower.model';
import { EnemyType } from '../models/enemy.model';

// Physics accumulator tests removed in turn-based pivot — no deltaTime semantics.

/** Minimal Enemy stub sufficient for CombatLoopService tests. */
function makeEnemy(overrides: Partial<{
  id: string; type: EnemyType; value: number; leakDamage: number; dying: boolean;
  position: { x: number; y: number; z: number };
}> = {}): any {
  return {
    id: overrides.id ?? 'e1',
    type: overrides.type ?? EnemyType.BASIC,
    value: overrides.value ?? 10,
    leakDamage: overrides.leakDamage ?? 1,
    dying: overrides.dying ?? false,
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
  let eventBusSpy: jasmine.SpyObj<RunEventBusService>;
  let scene: THREE.Scene;

  /**
   * Set up getState() to return a stable COMBAT state.
   * Callers can override individual calls using callFake if phase transitions
   * are needed within a single resolveTurn() execution.
   *
   * resolveTurn() calls getState() up to 3 times per turn:
   *   call 1: waveAtTurnStart (at top of method)
   *   call 2: currentPhase check (after leak loop)
   *   call 3: postWavePhase (after completeWave(), inside wave-completion block)
   */
  function setupState(phase: GamePhase = GamePhase.COMBAT, wave = 1): void {
    gameStateSpy.getState.and.returnValue({
      phase,
      wave,
      lives: 10,
      gold: 100,
      score: 0,
      isPaused: false,
      isEndless: false,
      
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

    waveSpy = jasmine.createSpyObj('WaveService', [
      'spawnForTurn',
      'isSpawning',
      'getWaveReward',
    ]);
    waveSpy.spawnForTurn.and.stub();
    waveSpy.isSpawning.and.returnValue(true); // default: still spawning (wave not done)
    waveSpy.getWaveReward.and.returnValue(50);

    combatSpy = jasmine.createSpyObj('TowerCombatService', [
      'fireTurn',
      'tickMortarZonesForTurn',
      'drainAudioEvents',
    ]);
    combatSpy.fireTurn.and.returnValue({ killed: [], fired: [], hitCount: 0 });
    combatSpy.tickMortarZonesForTurn.and.returnValue([]);
    combatSpy.drainAudioEvents.and.returnValue([]);

    enemySpy = jasmine.createSpyObj('EnemyService', [
      'getEnemies',
      'stepEnemiesOneTurn',
      'removeEnemy',
      'startDyingAnimation',
      'getLivingEnemyCount',
    ]);
    enemySpy.getEnemies.and.returnValue(new Map());
    enemySpy.stepEnemiesOneTurn.and.returnValue([]);
    // Default: no living enemies (wave appears done unless overridden per-test)
    enemySpy.getLivingEnemyCount.and.returnValue(0);

    gameStatsSpy = jasmine.createSpyObj('GameStatsService', [
      'recordGoldEarned',
      'recordEnemyLeaked',
    ]);

    gameEndSpy = jasmine.createSpyObj('GameEndService', ['isRecorded', 'recordEnd']);
    gameEndSpy.isRecorded.and.returnValue(false);
    gameEndSpy.recordEnd.and.returnValue({ newlyUnlockedAchievements: [], completedChallenges: [] });

    eventBusSpy = jasmine.createSpyObj<RunEventBusService>('RunEventBusService', ['emit']);

    scene = new THREE.Scene();

    const statusEffectSpy = jasmine.createSpyObj<StatusEffectService>('StatusEffectService', [
      'tickTurn',
      'getSlowTileReduction',
      'apply',
      'hasEffect',
      'getEffects',
      'getAllActiveEffects',
      'removeAllEffects',
      'cleanup',
    ]);
    statusEffectSpy.tickTurn.and.returnValue([]);
    statusEffectSpy.getSlowTileReduction.and.returnValue(0);
    statusEffectSpy.getAllActiveEffects.and.returnValue(new Map());
    statusEffectSpy.getEffects.and.returnValue([]);

    TestBed.configureTestingModule({
      providers: [
        CombatLoopService,
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: WaveService, useValue: waveSpy },
        { provide: TowerCombatService, useValue: combatSpy },
        { provide: EnemyService, useValue: enemySpy },
        { provide: GameStatsService, useValue: gameStatsSpy },
        { provide: GameEndService, useValue: gameEndSpy },
        { provide: StatusEffectService, useValue: statusEffectSpy },
        { provide: RelicService, useValue: createRelicServiceSpy() },
        { provide: RunEventBusService, useValue: eventBusSpy },
        { provide: CardEffectService, useValue: createCardEffectServiceSpy() },
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

  // ─── reset() ────────────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('should zero the turn counter', () => {
      service.resolveTurn(scene);
      service.resolveTurn(scene);
      expect(service.getTurnNumber()).toBe(2);

      service.reset();

      expect(service.getTurnNumber()).toBe(0);
    });

    it('should clear kill and firedType buffers so next turn returns empty result', () => {
      const enemy = makeEnemy({ id: 'e1', value: 5 });
      const enemies = new Map([['e1', enemy]]);
      enemySpy.getEnemies.and.returnValue(enemies);
      combatSpy.fireTurn.and.returnValue({
        killed: [{ id: 'e1', damage: 5 }],
        fired: [TowerType.BASIC],
        hitCount: 1,
      });

      service.resolveTurn(scene);
      service.reset();

      // Reset spies to empty state
      combatSpy.fireTurn.and.returnValue({ killed: [], fired: [], hitCount: 0 });
      enemySpy.getEnemies.and.returnValue(new Map());

      const result = service.resolveTurn(scene);

      expect(result.kills.length).toBe(0);
      expect(result.firedTypes.size).toBe(0);
    });

    it('should clear leakedThisWave flag so streak can be awarded after reset', () => {
      // Prime leakedThisWave by having an enemy leak
      const leakEnemy = makeEnemy({ id: 'leak1' });
      enemySpy.getEnemies.and.returnValue(new Map([['leak1', leakEnemy]]));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['leak1']);
      service.resolveTurn(scene);

      // reset() should clear leakedThisWave
      service.reset();
      enemySpy.stepEnemiesOneTurn.and.returnValue([]);

      // Now set up a clean wave-clear — streak bonus should fire
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getEnemies.and.returnValue(new Map());
      gameStatsSpy.recordEnemyLeaked.calls.reset();
      gameStatsSpy.recordGoldEarned.calls.reset();
      gameStateSpy.addStreakBonus.and.returnValue(50);
      gameStateSpy.getStreak.and.returnValue(1);
      gameStateSpy.awardInterest.and.returnValue(0);

      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : GamePhase.INTERMISSION,
        wave: 1, lives: 10, gold: 100, score: 0, isPaused: false,
        isEndless: false, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      service.resolveTurn(scene);

      expect(gameStateSpy.addStreakBonus).toHaveBeenCalled();
    });
  });

  // ─── resetLeakState() ───────────────────────────────────────────────────────

  describe('resetLeakState()', () => {
    it('should clear leakedThisWave so a clean wave can earn streak bonus', () => {
      // Leak an enemy to prime leakedThisWave
      const leakEnemy = makeEnemy({ id: 'leak1' });
      enemySpy.getEnemies.and.returnValue(new Map([['leak1', leakEnemy]]));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['leak1']);
      service.resolveTurn(scene);

      // Reset just the leak state (simulating startWave)
      service.resetLeakState();
      enemySpy.stepEnemiesOneTurn.and.returnValue([]);

      // Set up a wave-clear — streak bonus should fire since leak state was reset
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getEnemies.and.returnValue(new Map());
      gameStateSpy.addStreakBonus.and.returnValue(50);
      gameStateSpy.getStreak.and.returnValue(1);
      gameStateSpy.awardInterest.and.returnValue(0);

      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : GamePhase.INTERMISSION,
        wave: 2, lives: 9, gold: 100, score: 0, isPaused: false,
        isEndless: false, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      service.resolveTurn(scene);

      expect(gameStateSpy.addStreakBonus).toHaveBeenCalled();
    });

    it('should be callable without error when no leak has occurred', () => {
      expect(() => service.resetLeakState()).not.toThrow();
    });
  });

  // ─── getTurnNumber() ────────────────────────────────────────────────────────

  describe('getTurnNumber()', () => {
    it('should return 0 before any turns are resolved', () => {
      expect(service.getTurnNumber()).toBe(0);
    });

    it('should increment by 1 for each resolveTurn call', () => {
      service.resolveTurn(scene);
      expect(service.getTurnNumber()).toBe(1);

      service.resolveTurn(scene);
      expect(service.getTurnNumber()).toBe(2);

      service.resolveTurn(scene);
      expect(service.getTurnNumber()).toBe(3);
    });

    it('should reset to 0 after reset()', () => {
      service.resolveTurn(scene);
      service.resolveTurn(scene);
      service.reset();
      expect(service.getTurnNumber()).toBe(0);
    });
  });

  // ─── resolveTurn() — spawning delegation ────────────────────────────────────

  describe('resolveTurn() — spawning', () => {
    it('should call waveService.spawnForTurn(scene) each turn', () => {
      service.resolveTurn(scene);

      expect(waveSpy.spawnForTurn).toHaveBeenCalledWith(scene);
    });

    it('should call spawnForTurn once per resolveTurn call', () => {
      service.resolveTurn(scene);
      service.resolveTurn(scene);
      service.resolveTurn(scene);

      expect(waveSpy.spawnForTurn).toHaveBeenCalledTimes(3);
    });
  });

  // ─── resolveTurn() — kill processing ────────────────────────────────────────

  describe('resolveTurn() — kill processing', () => {
    it('should award gold and record stat for each kill', () => {
      const enemy = makeEnemy({ id: 'e1', value: 25 });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      combatSpy.fireTurn.and.returnValue({ killed: [{ id: 'e1', damage: 10 }], fired: [], hitCount: 0 });

      service.resolveTurn(scene);

      expect(gameStateSpy.addGoldAndScore).toHaveBeenCalledWith(25);
      expect(gameStatsSpy.recordGoldEarned).toHaveBeenCalledWith(25);
    });

    it('should snapshot kill position and damage in result.kills', () => {
      const enemy = makeEnemy({ id: 'e1', value: 10, position: { x: 1, y: 2, z: 3 } });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      combatSpy.fireTurn.and.returnValue({ killed: [{ id: 'e1', damage: 7 }], fired: [], hitCount: 0 });

      const result = service.resolveTurn(scene);

      expect(result.kills.length).toBe(1);
      expect(result.kills[0].damage).toBe(7);
      expect(result.kills[0].value).toBe(10);
      expect(result.kills[0].position).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('should call startDyingAnimation for each kill instead of removeEnemy', () => {
      const enemy = makeEnemy({ id: 'e1' });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      combatSpy.fireTurn.and.returnValue({ killed: [{ id: 'e1', damage: 5 }], fired: [], hitCount: 0 });

      service.resolveTurn(scene);

      expect(enemySpy.startDyingAnimation).toHaveBeenCalledWith('e1');
      expect(enemySpy.removeEnemy).not.toHaveBeenCalledWith('e1', scene);
    });

    it('should skip kill processing for enemies already marked dying', () => {
      const enemy = makeEnemy({ id: 'e1', dying: true, value: 20 });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      combatSpy.fireTurn.and.returnValue({ killed: [{ id: 'e1', damage: 5 }], fired: [], hitCount: 0 });

      const result = service.resolveTurn(scene);

      expect(result.kills.length).toBe(0);
      expect(gameStateSpy.addGoldAndScore).not.toHaveBeenCalled();
      expect(enemySpy.startDyingAnimation).not.toHaveBeenCalled();
    });

    it('should process mortar kills in addition to tower fire kills', () => {
      const e1 = makeEnemy({ id: 'e1', value: 10 });
      const e2 = makeEnemy({ id: 'e2', value: 15 });
      enemySpy.getEnemies.and.callFake((id?: string) => {
        const map = new Map([['e1', e1], ['e2', e2]]);
        return map;
      });
      combatSpy.fireTurn.and.returnValue({ killed: [{ id: 'e1', damage: 5 }], fired: [], hitCount: 1 });
      combatSpy.tickMortarZonesForTurn.and.returnValue([{ id: 'e2', damage: 8 }]);

      const result = service.resolveTurn(scene);

      expect(result.kills.length).toBe(2);
      expect(gameStatsSpy.recordGoldEarned).toHaveBeenCalledTimes(2);
    });

    it('should include hitCount from fireTurn in result', () => {
      combatSpy.fireTurn.and.returnValue({ killed: [], fired: [], hitCount: 4 });

      const result = service.resolveTurn(scene);

      expect(result.hitCount).toBe(4);
    });

    it('should accumulate firedTypes from TowerCombatService.fireTurn', () => {
      combatSpy.fireTurn.and.returnValue({ killed: [], fired: [TowerType.BASIC, TowerType.SNIPER], hitCount: 0 });

      const result = service.resolveTurn(scene);

      expect(result.firedTypes.has(TowerType.BASIC)).toBeTrue();
      expect(result.firedTypes.has(TowerType.SNIPER)).toBeTrue();
    });
  });

  // ─── resolveTurn() — enemy leak handling ────────────────────────────────────

  describe('resolveTurn() — enemy leak handling', () => {
    it('should call loseLife and recordEnemyLeaked when an enemy reaches the exit', () => {
      const enemy = makeEnemy({ id: 'e1', leakDamage: 2 });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['e1']);

      service.resolveTurn(scene);

      expect(gameStateSpy.loseLife).toHaveBeenCalledWith(2);
      expect(gameStatsSpy.recordEnemyLeaked).toHaveBeenCalled();
    });

    it('should set result.leaked = true when any enemy exits', () => {
      enemySpy.stepEnemiesOneTurn.and.returnValue(['e1']);
      enemySpy.getEnemies.and.returnValue(new Map([['e1', makeEnemy({ id: 'e1' })]]));

      const result = service.resolveTurn(scene);

      expect(result.leaked).toBeTrue();
    });

    it('should set result.exitCount to the number of enemies that exited', () => {
      const enemies = new Map([
        ['e1', makeEnemy({ id: 'e1' })],
        ['e2', makeEnemy({ id: 'e2' })],
      ]);
      enemySpy.getEnemies.and.returnValue(enemies);
      enemySpy.stepEnemiesOneTurn.and.returnValue(['e1', 'e2']);

      const result = service.resolveTurn(scene);

      expect(result.exitCount).toBe(2);
    });

    it('should set result.leaked = false when no enemies exit', () => {
      enemySpy.stepEnemiesOneTurn.and.returnValue([]);

      const result = service.resolveTurn(scene);

      expect(result.leaked).toBeFalse();
    });

    it('should call removeEnemy for each leaked enemy', () => {
      const enemy = makeEnemy({ id: 'e1' });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['e1']);

      service.resolveTurn(scene);

      expect(enemySpy.removeEnemy).toHaveBeenCalledWith('e1', scene);
    });
  });

  // ─── resolveTurn() — defeat handling ────────────────────────────────────────

  describe('resolveTurn() — defeat handling', () => {
    it('should set defeatTriggered = true when phase becomes DEFEAT after leak', () => {
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        // call 0: waveAtTurnStart → COMBAT
        // call 1: currentPhase after leaks → DEFEAT
        phase: callCount++ === 0 ? GamePhase.COMBAT : GamePhase.DEFEAT,
        wave: 1, lives: 0, gold: 0, score: 0, isPaused: false,
        isEndless: false, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['e1']);
      enemySpy.getEnemies.and.returnValue(new Map([['e1', makeEnemy({ id: 'e1' })]]));

      const result = service.resolveTurn(scene);

      expect(result.defeatTriggered).toBeTrue();
    });

    it('should record game end on DEFEAT', () => {
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ === 0 ? GamePhase.COMBAT : GamePhase.DEFEAT,
        wave: 1, lives: 0, gold: 0, score: 0, isPaused: false,
        isEndless: false, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['e1']);
      enemySpy.getEnemies.and.returnValue(new Map([['e1', makeEnemy({ id: 'e1' })]]));

      service.resolveTurn(scene);

      expect(gameEndSpy.recordEnd).toHaveBeenCalledWith(false, jasmine.any(Number));
    });

    it('should not call recordEnd if already recorded', () => {
      gameEndSpy.isRecorded.and.returnValue(true);
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ === 0 ? GamePhase.COMBAT : GamePhase.DEFEAT,
        wave: 1, lives: 0, gold: 0, score: 0, isPaused: false,
        isEndless: false, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['e1']);
      enemySpy.getEnemies.and.returnValue(new Map([['e1', makeEnemy({ id: 'e1' })]]));

      service.resolveTurn(scene);

      expect(gameEndSpy.recordEnd).not.toHaveBeenCalled();
    });

    it('should set result.gameEnd with isVictory=false on defeat', () => {
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ === 0 ? GamePhase.COMBAT : GamePhase.DEFEAT,
        wave: 1, lives: 0, gold: 0, score: 0, isPaused: false,
        isEndless: false, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['e1']);
      enemySpy.getEnemies.and.returnValue(new Map([['e1', makeEnemy({ id: 'e1' })]]));
      gameEndSpy.recordEnd.and.returnValue({
        newlyUnlockedAchievements: ['ach1'],
        completedChallenges: [],
      });

      const result = service.resolveTurn(scene);

      expect(result.gameEnd).not.toBeNull();
      expect(result.gameEnd!.isVictory).toBeFalse();
      expect(result.gameEnd!.newlyUnlockedAchievements).toEqual(['ach1']);
    });
  });

  // ─── resolveTurn() — wave completion ────────────────────────────────────────

  describe('resolveTurn() — wave completion', () => {
    /**
     * Helper: configure spies for a wave-clear scenario.
     * resolveTurn() calls getState() 3 times:
     *   call 0: waveAtTurnStart → COMBAT
     *   call 1: currentPhase (after leak loop) → COMBAT
     *   call 2: postWavePhase (after completeWave) → resultPhase
     */
    function setupWaveClear(resultPhase: GamePhase, wave = 1): void {
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getLivingEnemyCount.and.returnValue(0);
      enemySpy.getEnemies.and.returnValue(new Map());
      enemySpy.stepEnemiesOneTurn.and.returnValue([]);
      gameStateSpy.addStreakBonus.and.returnValue(0);
      gameStateSpy.getStreak.and.returnValue(0);
      gameStateSpy.awardInterest.and.returnValue(0);
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : resultPhase,
        wave,
        lives: 10, gold: 100, score: 0, isPaused: false,
        isEndless: false, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));
    }

    it('should call completeWave with the wave reward', () => {
      waveSpy.getWaveReward.and.returnValue(75);
      setupWaveClear(GamePhase.INTERMISSION);

      service.resolveTurn(scene);

      expect(gameStateSpy.completeWave).toHaveBeenCalledWith(75);
    });

    it('should emit waveCompletion with INTERMISSION resultPhase', () => {
      setupWaveClear(GamePhase.INTERMISSION);
      gameStateSpy.awardInterest.and.returnValue(10);

      const result = service.resolveTurn(scene);

      expect(result.waveCompletion).not.toBeNull();
      expect(result.waveCompletion!.resultPhase).toBe(GamePhase.INTERMISSION);
      expect(result.waveCompletion!.interestEarned).toBe(10);
    });

    it('should emit waveCompletion with VICTORY resultPhase', () => {
      setupWaveClear(GamePhase.VICTORY);

      const result = service.resolveTurn(scene);

      expect(result.waveCompletion).not.toBeNull();
      expect(result.waveCompletion!.resultPhase).toBe(GamePhase.VICTORY);
    });

    it('should award streak bonus when no enemy has leaked this wave', () => {
      setupWaveClear(GamePhase.INTERMISSION);
      gameStateSpy.addStreakBonus.and.returnValue(100);
      gameStateSpy.getStreak.and.returnValue(2);

      const result = service.resolveTurn(scene);

      expect(gameStateSpy.addStreakBonus).toHaveBeenCalled();
      expect(result.waveCompletion!.streakBonus).toBe(100);
      expect(result.waveCompletion!.streakCount).toBe(2);
    });

    // ── Phase 12: RunEventBus emits for wave completion sources ──────────

    it('emits GOLD_EARNED with source=wave when the wave reward is positive', () => {
      waveSpy.getWaveReward.and.returnValue(75);
      setupWaveClear(GamePhase.INTERMISSION);

      service.resolveTurn(scene);

      expect(eventBusSpy.emit).toHaveBeenCalledWith(
        RunEventType.GOLD_EARNED,
        jasmine.objectContaining({ amount: 75, source: 'wave' }),
      );
    });

    it('emits GOLD_EARNED with source=streak when a streak bonus lands', () => {
      waveSpy.getWaveReward.and.returnValue(0);
      setupWaveClear(GamePhase.INTERMISSION);
      gameStateSpy.addStreakBonus.and.returnValue(50);
      gameStateSpy.getStreak.and.returnValue(2);

      service.resolveTurn(scene);

      expect(eventBusSpy.emit).toHaveBeenCalledWith(
        RunEventType.GOLD_EARNED,
        jasmine.objectContaining({ amount: 50, source: 'streak' }),
      );
    });

    it('emits GOLD_EARNED with source=interest when interest is awarded', () => {
      waveSpy.getWaveReward.and.returnValue(0);
      setupWaveClear(GamePhase.INTERMISSION);
      gameStateSpy.awardInterest.and.returnValue(15);

      service.resolveTurn(scene);

      expect(eventBusSpy.emit).toHaveBeenCalledWith(
        RunEventType.GOLD_EARNED,
        jasmine.objectContaining({ amount: 15, source: 'interest' }),
      );
    });

    it('does NOT emit GOLD_EARNED when all sources are zero (leak-interrupted wave)', () => {
      waveSpy.getWaveReward.and.returnValue(0);
      setupWaveClear(GamePhase.INTERMISSION);
      gameStateSpy.awardInterest.and.returnValue(0);
      // addStreakBonus returns 0 too (the default) — no streak fires.

      service.resolveTurn(scene);

      const goldCalls = eventBusSpy.emit.calls.allArgs()
        .filter(args => args[0] === RunEventType.GOLD_EARNED);
      expect(goldCalls.length).toBe(0);
    });

    it('should NOT award streak bonus when an enemy leaked in a prior turn this wave', () => {
      // Turn 1: cause a leak to set leakedThisWave
      const enemy = makeEnemy({ id: 'e_leak' });
      enemySpy.getEnemies.and.returnValue(new Map([['e_leak', enemy]]));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['e_leak']);
      waveSpy.isSpawning.and.returnValue(true);
      service.resolveTurn(scene);

      // Turn 2: wave clears — streak bonus should NOT fire
      setupWaveClear(GamePhase.INTERMISSION);
      // addStreakBonus reset so we can assert it was NOT called
      gameStateSpy.addStreakBonus.calls.reset();

      service.resolveTurn(scene);

      expect(gameStateSpy.addStreakBonus).not.toHaveBeenCalled();
    });

    it('should NOT award streak bonus when an enemy leaked this same turn', () => {
      waveSpy.isSpawning.and.returnValue(false);
      gameStateSpy.addStreakBonus.and.returnValue(0);
      gameStateSpy.awardInterest.and.returnValue(0);

      // getState call sequence:
      //   call 0: waveAtTurnStart → COMBAT
      //   call 1: currentPhase after leaks → COMBAT (enemy leaked but lives != 0)
      //   call 2: postWavePhase after completeWave → INTERMISSION
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : GamePhase.INTERMISSION,
        wave: 1, lives: 9, gold: 100, score: 0, isPaused: false,
        isEndless: false, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      // Enemy leaks this turn AND wave clears (getLivingEnemyCount=0 after removing leaker)
      const enemy = makeEnemy({ id: 'e1' });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['e1']);
      enemySpy.getLivingEnemyCount.and.returnValue(0);

      service.resolveTurn(scene);

      expect(gameStateSpy.addStreakBonus).not.toHaveBeenCalled();
    });

    it('should record game end on VICTORY', () => {
      setupWaveClear(GamePhase.VICTORY);
      gameEndSpy.recordEnd.and.returnValue({ newlyUnlockedAchievements: ['ach1'], completedChallenges: [] });

      const result = service.resolveTurn(scene);

      expect(gameEndSpy.recordEnd).toHaveBeenCalledWith(true, jasmine.any(Number));
      expect(result.gameEnd).not.toBeNull();
      expect(result.gameEnd!.isVictory).toBeTrue();
      expect(result.gameEnd!.newlyUnlockedAchievements).toEqual(['ach1']);
    });

    it('should not emit waveCompletion when spawning is still active', () => {
      waveSpy.isSpawning.and.returnValue(true);

      const result = service.resolveTurn(scene);

      expect(result.waveCompletion).toBeNull();
      expect(gameStateSpy.completeWave).not.toHaveBeenCalled();
    });

    it('should not emit waveCompletion when enemies are still alive', () => {
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getLivingEnemyCount.and.returnValue(1);

      const result = service.resolveTurn(scene);

      expect(result.waveCompletion).toBeNull();
    });

    it('should not emit waveCompletion when phase is DEFEAT (not COMBAT)', () => {
      // Phase becomes DEFEAT after a catastrophic leak — wave completion should not fire
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ === 0 ? GamePhase.COMBAT : GamePhase.DEFEAT,
        wave: 1, lives: 0, gold: 0, score: 0, isPaused: false,
        isEndless: false, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getLivingEnemyCount.and.returnValue(0);
      const enemy = makeEnemy({ id: 'e1' });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['e1']);

      const result = service.resolveTurn(scene);

      expect(result.waveCompletion).toBeNull();
      expect(gameStateSpy.completeWave).not.toHaveBeenCalled();
    });

    it('should award interest on INTERMISSION transition', () => {
      setupWaveClear(GamePhase.INTERMISSION);
      gameStateSpy.awardInterest.and.returnValue(20);

      const result = service.resolveTurn(scene);

      expect(gameStateSpy.awardInterest).toHaveBeenCalled();
      expect(result.waveCompletion!.interestEarned).toBe(20);
    });

    it('should NOT award interest on VICTORY transition', () => {
      setupWaveClear(GamePhase.VICTORY);

      service.resolveTurn(scene);

      expect(gameStateSpy.awardInterest).not.toHaveBeenCalled();
    });

    it('wave reward is correctly passed to completeWave', () => {
      waveSpy.getWaveReward.and.returnValue(120);
      setupWaveClear(GamePhase.INTERMISSION);

      service.resolveTurn(scene);

      expect(gameStateSpy.completeWave).toHaveBeenCalledWith(120);
    });
  });

  // ─── resolveTurn() — combat audio events ────────────────────────────────────

  describe('resolveTurn() — combat audio events', () => {
    it('should include drained combat audio events in the result', () => {
      const events = [{ type: 'sfx' as const, sfxKey: 'chain' }];
      combatSpy.drainAudioEvents.and.returnValue(events);

      const result = service.resolveTurn(scene);

      expect(result.combatAudioEvents).toEqual(events);
    });

    it('should return empty combatAudioEvents when nothing fired', () => {
      combatSpy.drainAudioEvents.and.returnValue([]);

      const result = service.resolveTurn(scene);

      expect(result.combatAudioEvents).toEqual([]);
    });
  });

  // ─── resolveTurn() — defensive copies: kills and firedTypes ────────────────

  describe('resolveTurn() — defensive copy of kills and firedTypes', () => {
    it('mutating the returned kills array does not affect the next turn result', () => {
      const enemy = makeEnemy({ id: 'e1', value: 10 });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      combatSpy.fireTurn.and.returnValue({ killed: [{ id: 'e1', damage: 5 }], fired: [], hitCount: 0 });

      const result = service.resolveTurn(scene);
      // Poison the returned array after consumption
      result.kills.push({ damage: 999, position: { x: 0, y: 0, z: 0 }, color: 0, value: 999 });

      // Next turn with no kills — the internal buffer should be unaffected
      combatSpy.fireTurn.and.returnValue({ killed: [], fired: [], hitCount: 0 });
      enemySpy.getEnemies.and.returnValue(new Map());
      const next = service.resolveTurn(scene);

      expect(next.kills.length).toBe(0);
    });

    it('mutating the returned firedTypes set does not affect the next turn result', () => {
      combatSpy.fireTurn.and.returnValue({ killed: [], fired: [TowerType.BASIC], hitCount: 0 });

      const result = service.resolveTurn(scene);
      expect(result.firedTypes.has(TowerType.BASIC)).toBeTrue();
      // Poison the returned set
      result.firedTypes.add(TowerType.SNIPER);

      // Next turn with no fired types — internal set should be unaffected
      combatSpy.fireTurn.and.returnValue({ killed: [], fired: [], hitCount: 0 });
      const next = service.resolveTurn(scene);

      expect(next.firedTypes.has(TowerType.BASIC)).toBeFalse();
      expect(next.firedTypes.has(TowerType.SNIPER)).toBeFalse();
    });

    it('returned kills array is a snapshot — contains events from current turn only', () => {
      const enemy = makeEnemy({ id: 'e1', value: 5 });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      combatSpy.fireTurn.and.returnValue({ killed: [{ id: 'e1', damage: 3 }], fired: [], hitCount: 0 });

      const first = service.resolveTurn(scene);

      // Second turn with no kills
      combatSpy.fireTurn.and.returnValue({ killed: [], fired: [], hitCount: 0 });
      enemySpy.getEnemies.and.returnValue(new Map());
      service.resolveTurn(scene);

      // The first result should still hold the original kill (it's a copy, not a reference)
      expect(first.kills.length).toBe(1);
      expect(first.kills[0].damage).toBe(3);
    });
  });

  // ─── card modifier wiring ────────────────────────────────────────────────────

  describe('card modifier wiring', () => {
    let cardEffectSpy: jasmine.SpyObj<CardEffectService>;

    beforeEach(() => {
      cardEffectSpy = TestBed.inject(CardEffectService) as jasmine.SpyObj<CardEffectService>;
    });

    it('goldMultiplier: 0.5 modifier multiplies awarded gold by 1.5x', () => {
      cardEffectSpy.getModifierValue.and.callFake((stat: string) => stat === 'goldMultiplier' ? 0.5 : 0);

      const enemy = makeEnemy({ id: 'e1', value: 20 });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      combatSpy.fireTurn.and.returnValue({ killed: [{ id: 'e1', damage: 20 }], fired: [], hitCount: 0 });

      service.resolveTurn(scene);

      // relicSpy returns 1.0 gold mult by default, cardGoldMult=1.5 → 20 * 1 * 1.5 = 30
      expect(gameStateSpy.addGoldAndScore).toHaveBeenCalledWith(30);
    });

    it('leakBlock: first leak blocked (no life lost), second leak blocked, third leak costs life', () => {
      cardEffectSpy.getModifierValue.and.returnValue(0);
      // Register 2 charges of leakBlock in the real cardEffectService via spy on tryConsumeLeakBlock
      let leakBlockCharges = 2;
      cardEffectSpy.tryConsumeLeakBlock.and.callFake(() => {
        if (leakBlockCharges > 0) {
          leakBlockCharges--;
          return true;
        }
        return false;
      });

      const enemy1 = makeEnemy({ id: 'e1', leakDamage: 1 });
      const enemy2 = makeEnemy({ id: 'e2', leakDamage: 1 });
      const enemy3 = makeEnemy({ id: 'e3', leakDamage: 1 });

      // Turn 1: e1 leaks — should be blocked
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy1]]));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['e1']);
      service.resolveTurn(scene);
      expect(gameStateSpy.loseLife).not.toHaveBeenCalled();

      // Turn 2: e2 leaks — should be blocked
      enemySpy.getEnemies.and.returnValue(new Map([['e2', enemy2]]));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['e2']);
      service.resolveTurn(scene);
      expect(gameStateSpy.loseLife).not.toHaveBeenCalled();

      // Turn 3: e3 leaks — no charges left, life should be lost
      enemySpy.getEnemies.and.returnValue(new Map([['e3', enemy3]]));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['e3']);
      service.resolveTurn(scene);
      expect(gameStateSpy.loseLife).toHaveBeenCalledWith(1);
    });
  });

  // ─── integration: full wave lifecycle ───────────────────────────────────────

  describe('integration: wave lifecycle', () => {
    it('full wave clear: spawn done, no enemies left → waveCompletion emitted', () => {
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getLivingEnemyCount.and.returnValue(0);
      enemySpy.getEnemies.and.returnValue(new Map());
      enemySpy.stepEnemiesOneTurn.and.returnValue([]);
      gameStateSpy.addStreakBonus.and.returnValue(0);
      gameStateSpy.getStreak.and.returnValue(0);
      gameStateSpy.awardInterest.and.returnValue(0);
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : GamePhase.INTERMISSION,
        wave: 1, lives: 10, gold: 100, score: 0, isPaused: false,
        isEndless: false, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      const result = service.resolveTurn(scene);

      expect(result.waveCompletion).not.toBeNull();
      expect(result.waveCompletion!.resultPhase).toBe(GamePhase.INTERMISSION);
      expect(gameStateSpy.completeWave).toHaveBeenCalled();
    });

    it('enemy leaks to exit → loseLife called, result.leaked = true', () => {
      const enemy = makeEnemy({ id: 'leaked1', leakDamage: 3 });
      enemySpy.getEnemies.and.returnValue(new Map([['leaked1', enemy]]));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['leaked1']);

      const result = service.resolveTurn(scene);

      expect(gameStateSpy.loseLife).toHaveBeenCalledWith(3);
      expect(result.leaked).toBeTrue();
    });

    it('emits ENEMY_LEAKED with enemyType + leakCost for each leak', () => {
      const enemy = makeEnemy({ id: 'leaked1', leakDamage: 3 });
      enemySpy.getEnemies.and.returnValue(new Map([['leaked1', enemy]]));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['leaked1']);

      service.resolveTurn(scene);

      expect(eventBusSpy.emit).toHaveBeenCalledWith(
        RunEventType.ENEMY_LEAKED,
        jasmine.objectContaining({ leakCost: 3 }),
      );
    });

    it('wave completion with no leaks awards streak bonus', () => {
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getLivingEnemyCount.and.returnValue(0);
      enemySpy.getEnemies.and.returnValue(new Map());
      enemySpy.stepEnemiesOneTurn.and.returnValue([]);
      gameStateSpy.addStreakBonus.and.returnValue(50);
      gameStateSpy.getStreak.and.returnValue(3);
      gameStateSpy.awardInterest.and.returnValue(0);
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : GamePhase.INTERMISSION,
        wave: 3, lives: 10, gold: 100, score: 0, isPaused: false,
        isEndless: false, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 3, consecutiveWavesWithoutLeak: 3,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      const result = service.resolveTurn(scene);

      expect(gameStateSpy.addStreakBonus).toHaveBeenCalled();
      expect(result.waveCompletion!.streakBonus).toBe(50);
      expect(result.waveCompletion!.streakCount).toBe(3);
    });

    it('wave reward is correctly passed to completeWave', () => {
      waveSpy.isSpawning.and.returnValue(false);
      waveSpy.getWaveReward.and.returnValue(120);
      enemySpy.getLivingEnemyCount.and.returnValue(0);
      enemySpy.getEnemies.and.returnValue(new Map());
      enemySpy.stepEnemiesOneTurn.and.returnValue([]);
      gameStateSpy.addStreakBonus.and.returnValue(0);
      gameStateSpy.getStreak.and.returnValue(0);
      gameStateSpy.awardInterest.and.returnValue(0);
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : GamePhase.INTERMISSION,
        wave: 1, lives: 10, gold: 100, score: 0, isPaused: false,
        isEndless: false, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      service.resolveTurn(scene);

      expect(gameStateSpy.completeWave).toHaveBeenCalledWith(120);
    });

    it('DEFEAT mid-turn: defeatTriggered = true, recordEnd called', () => {
      const enemy = makeEnemy({ id: 'e1', leakDamage: 99 });
      enemySpy.getEnemies.and.returnValue(new Map([['e1', enemy]]));
      enemySpy.stepEnemiesOneTurn.and.returnValue(['e1']);
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ === 0 ? GamePhase.COMBAT : GamePhase.DEFEAT,
        wave: 1, lives: 0, gold: 0, score: 0, isPaused: false,
        isEndless: false, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 0, consecutiveWavesWithoutLeak: 0,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      const result = service.resolveTurn(scene);

      expect(result.defeatTriggered).toBeTrue();
      expect(gameEndSpy.recordEnd).toHaveBeenCalledWith(false, jasmine.any(Number));
    });

    it('VICTORY: waveCompletion resultPhase is VICTORY, recordEnd called with isVictory=true', () => {
      waveSpy.isSpawning.and.returnValue(false);
      enemySpy.getLivingEnemyCount.and.returnValue(0);
      enemySpy.getEnemies.and.returnValue(new Map());
      enemySpy.stepEnemiesOneTurn.and.returnValue([]);
      gameStateSpy.addStreakBonus.and.returnValue(0);
      gameStateSpy.getStreak.and.returnValue(0);
      gameStateSpy.awardInterest.and.returnValue(0);
      gameEndSpy.recordEnd.and.returnValue({ newlyUnlockedAchievements: [], completedChallenges: [] });
      let callCount = 0;
      gameStateSpy.getState.and.callFake(() => ({
        phase: callCount++ < 2 ? GamePhase.COMBAT : GamePhase.VICTORY,
        wave: 10, lives: 10, gold: 100, score: 500, isPaused: false,
        isEndless: false, difficulty: 'normal',
        maxWaves: 10, elapsedTime: 60, consecutiveWavesWithoutLeak: 5,
        highestWave: 0, activeModifiers: new Set(),
      } as any));

      const result = service.resolveTurn(scene);

      expect(result.waveCompletion!.resultPhase).toBe(GamePhase.VICTORY);
      expect(gameEndSpy.recordEnd).toHaveBeenCalledWith(true, jasmine.any(Number));
      expect(result.gameEnd).not.toBeNull();
      expect(result.gameEnd!.isVictory).toBeTrue();
    });

    it('multi-turn: three turns of combat → turn counter increments correctly', () => {
      service.resolveTurn(scene);
      service.resolveTurn(scene);
      service.resolveTurn(scene);

      expect(service.getTurnNumber()).toBe(3);
    });

    it('multi-turn: kills accumulate independently each turn (no cross-turn bleed)', () => {
      const e1 = makeEnemy({ id: 'e1', value: 5 });
      const e2 = makeEnemy({ id: 'e2', value: 5 });

      // Turn 1: kill e1
      enemySpy.getEnemies.and.returnValue(new Map([['e1', e1]]));
      combatSpy.fireTurn.and.returnValue({ killed: [{ id: 'e1', damage: 5 }], fired: [], hitCount: 0 });
      const result1 = service.resolveTurn(scene);

      // Turn 2: kill e2
      enemySpy.getEnemies.and.returnValue(new Map([['e2', e2]]));
      combatSpy.fireTurn.and.returnValue({ killed: [{ id: 'e2', damage: 5 }], fired: [], hitCount: 0 });
      const result2 = service.resolveTurn(scene);

      expect(result1.kills.length).toBe(1);
      expect(result1.kills[0].value).toBe(5);
      expect(result2.kills.length).toBe(1);
      expect(result2.kills[0].value).toBe(5);
    });
  });

  // ─── checkpoint state accessors ─────────────────────────────────────────────

  describe('checkpoint state accessors', () => {
    it('getTurnNumber()/setTurnNumber() roundtrip', () => {
      service.resolveTurn(scene);
      expect(service.getTurnNumber()).toBe(1);

      service.setTurnNumber(42);
      expect(service.getTurnNumber()).toBe(42);
    });

    it('getLeakedThisWave()/setLeakedThisWave() roundtrip', () => {
      expect(service.getLeakedThisWave()).toBe(false);

      service.setLeakedThisWave(true);
      expect(service.getLeakedThisWave()).toBe(true);

      service.setLeakedThisWave(false);
      expect(service.getLeakedThisWave()).toBe(false);
    });
  });
});
