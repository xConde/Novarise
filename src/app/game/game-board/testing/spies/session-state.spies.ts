import { EMPTY, of } from 'rxjs';

import { GameStateService } from '../../services/game-state.service';
import { GameEndService } from '../../services/game-end.service';
import { GameStatsService, GameStats } from '../../services/game-stats.service';
import { GameSessionService } from '../../services/game-session.service';
import { GamePauseService } from '../../services/game-pause.service';
import { ChallengeTrackingService } from '../../services/challenge-tracking.service';
import { ChallengeDisplayService } from '../../services/challenge-display.service';
import { ChallengeIndicator } from '../../components/game-hud/game-hud.component';
import { TowerType } from '../../models/tower.model';
import { DifficultyLevel, INITIAL_GAME_STATE, GameState } from '../../models/game-state.model';

/**
 * Create a pre-configured GameStateService spy.
 *
 * Default return values:
 *   - getState() — INITIAL_GAME_STATE snapshot
 *   - getState$() — Observable of INITIAL_GAME_STATE
 *   - getPhaseChanges() — Observable<never> (never emits)
 *   - canAfford() — false
 *   - spendGold() — false
 *   - addStreakBonus() / awardInterest() / getStreak() / getModifierScoreMultiplier() — 0
 *   - getModifierEffects() — empty object
 *   - All mutating methods — no-op void
 * Note: setPhase() and addScore() are deleted — not included in this spy.
 */
export function createGameStateServiceSpy(): jasmine.SpyObj<GameStateService> {
  const spy = jasmine.createSpyObj<GameStateService>('GameStateService', [
    'getState',
    'getState$',
    'getPhaseChanges',
    'startWave',
    'completeWave',
    'setEndlessMode',
    'loseLife',
    'addStreakBonus',
    'getStreak',
    'addGold',
    'addLives',
    'addGoldAndScore',
    'awardInterest',
    'spendGold',
    'canAfford',
    'togglePause',

    'setModifiers',
    'getModifierEffects',
    'getModifierScoreMultiplier',
    'setDifficulty',
    'addElapsedTime',
    'setMaxWaves',
    'setInitialLives',
    'reset',
  ]);
  const initialState: GameState = { ...INITIAL_GAME_STATE, activeModifiers: new Set() };
  spy.getState.and.returnValue(initialState);
  spy.getState$.and.returnValue(of(initialState));
  spy.getPhaseChanges.and.returnValue(EMPTY);
  spy.canAfford.and.returnValue(false);
  spy.spendGold.and.returnValue(false);
  spy.addStreakBonus.and.returnValue(0);
  spy.awardInterest.and.returnValue(0);
  spy.getStreak.and.returnValue(0);
  spy.getModifierEffects.and.returnValue({});
  spy.getModifierScoreMultiplier.and.returnValue(1);
  return spy;
}

/**
 * Create a pre-configured GameEndService spy.
 *
 * Default return values:
 *   - isRecorded() — false
 *   - recordEnd() — empty result (no unlocked achievements, no completed challenges)
 *   - recordSpecialization() / reset() — no-op void
 */
export function createGameEndServiceSpy(): jasmine.SpyObj<GameEndService> {
  const spy = jasmine.createSpyObj<GameEndService>('GameEndService', [
    'recordSpecialization',
    'isRecorded',
    'recordEnd',
    'reset',
  ]);
  spy.isRecorded.and.returnValue(false);
  spy.recordEnd.and.returnValue({ newlyUnlockedAchievements: [], completedChallenges: [] });
  return spy;
}

/**
 * Create a pre-configured GameStatsService spy.
 *
 * Default return values:
 *   - getStats() — zeroed-out stats object
 *   - All record* methods — no-op void
 *   - reset() — no-op void
 */
export function createGameStatsServiceSpy(): jasmine.SpyObj<GameStatsService> {
  const spy = jasmine.createSpyObj<GameStatsService>('GameStatsService', [
    'recordKill',
    'recordDamage',
    'recordGoldEarned',
    'recordEnemyLeaked',
    'recordTowerBuilt',
    'recordTowerSold',
    'recordShot',
    'getStats',
    'reset',
  ]);
  const emptyStats: GameStats = {
    killsByTowerType: {
      [TowerType.BASIC]: 0,
      [TowerType.SNIPER]: 0,
      [TowerType.SPLASH]: 0,
      [TowerType.SLOW]: 0,
      [TowerType.CHAIN]: 0,
      [TowerType.MORTAR]: 0,
    },
    totalDamageDealt: 0,
    totalGoldEarned: 0,
    enemiesLeaked: 0,
    towersBuilt: 0,
    towersSold: 0,
    shotsFired: 0,
  };
  spy.getStats.and.returnValue(emptyStats);
  return spy;
}

/**
 * Create a pre-configured GameSessionService spy.
 *
 * Default return values:
 *   - resetAllServices — no-op void
 *   - cleanupScene — returns null
 */
export function createGameSessionServiceSpy(): jasmine.SpyObj<GameSessionService> {
  const spy = jasmine.createSpyObj<GameSessionService>('GameSessionService', [
    'resetAllServices',
    'cleanupScene',
  ]);
  spy.cleanupScene.and.stub();
  return spy;
}

export function createGamePauseServiceSpy(): jasmine.SpyObj<GamePauseService> {
  const spy = jasmine.createSpyObj<GamePauseService>(
    'GamePauseService',
    ['togglePause', 'setupAutoPause', 'requestQuit', 'cancelQuit', 'confirmQuit', 'requestGuardDecision', 'reset', 'cleanup', 'ngOnDestroy']
  );
  // Writable public fields — allow tests to read/write them directly
  (spy as unknown as { showQuitConfirm: boolean }).showQuitConfirm = false;
  (spy as unknown as { autoPaused: boolean }).autoPaused = false;
  (spy as unknown as { isPaused: boolean }).isPaused = false;
  spy.togglePause.and.returnValue(false);
  spy.requestGuardDecision.and.returnValue(of(true));
  spy.confirmQuit.and.returnValue('/');
  // requestQuit / cancelQuit mutate showQuitConfirm to allow component getter tests to pass
  spy.requestQuit.and.callFake(() => {
    (spy as unknown as { showQuitConfirm: boolean }).showQuitConfirm = true;
  });
  spy.cancelQuit.and.callFake(() => {
    (spy as unknown as { showQuitConfirm: boolean }).showQuitConfirm = false;
  });
  return spy;
}

/**
 * Create a pre-configured ChallengeTrackingService spy.
 *
 * Default return values:
 *   - getSnapshot() — zeroed snapshot with empty towerTypesUsed Set
 *   - getTowerTypesUsed() — empty ReadonlySet
 *   - All record* / reset methods — no-op void
 */
export function createChallengeTrackingServiceSpy(): jasmine.SpyObj<ChallengeTrackingService> {
  const spy = jasmine.createSpyObj<ChallengeTrackingService>('ChallengeTrackingService', [
    'recordTowerPlaced',
    'recordTowerUpgraded',
    'recordTowerSold',
    'getSnapshot',
    'getTowerTypesUsed',
    'reset',
  ]);
  spy.getSnapshot.and.returnValue({ totalGoldSpent: 0, maxTowersPlaced: 0, towerTypesUsed: new Set() });
  spy.getTowerTypesUsed.and.returnValue(new Set<TowerType>());
  return spy;
}

/**
 * Create a pre-configured ChallengeDisplayService spy.
 *
 * Default return values:
 *   - updateIndicators() — empty array (no active challenges)
 *   - indicators — empty array
 */
export function createChallengeDisplayServiceSpy(): jasmine.SpyObj<ChallengeDisplayService> {
  const spy = jasmine.createSpyObj<ChallengeDisplayService>(
    'ChallengeDisplayService',
    ['updateIndicators'],
    { indicators: [] as ChallengeIndicator[] }
  );
  spy.updateIndicators.and.returnValue([]);
  return spy;
}
