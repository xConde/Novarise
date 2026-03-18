import { of } from 'rxjs';

import { GameBoardService } from '../game-board.service';
import { EnemyService, DamageResult } from '../services/enemy.service';
import { GameStatsService, GameStats } from '../services/game-stats.service';
import { TutorialService, TutorialStep, TutorialTip } from '../services/tutorial.service';
import { CombatLoopService } from '../services/combat-loop.service';
import { MinimapService } from '../services/minimap.service';
import { SettingsService, GameSettings } from '../services/settings.service';
import { AudioService } from '../services/audio.service';
import { SceneService } from '../services/scene.service';
import { GameNotificationService, GameNotification } from '../services/game-notification.service';
import { Enemy } from '../models/enemy.model';
import { GameBoardTile } from '../models/game-board-tile';
import { TowerType } from '../models/tower.model';
import { DifficultyLevel } from '../models/game-state.model';

/**
 * Create a pre-configured GameBoardService spy with standard return values.
 * Pass a board getter to also stub getGameBoard().
 *
 * Stubs all commonly-used public methods with safe defaults:
 *   - getBoardWidth / getBoardHeight / getTileSize — return the supplied dimensions
 *   - canPlaceTower / wouldBlockPath — return false (safe no-op)
 *   - placeTower / removeTower — return false (safe no-op)
 *   - importBoard — no-op void
 */
export function createGameBoardServiceSpy(
  width: number = 10,
  height: number = 10,
  tileSize: number = 1,
  boardFn?: () => GameBoardTile[][]
): jasmine.SpyObj<GameBoardService> {
  const methods: (keyof GameBoardService)[] = [
    'getGameBoard',
    'getBoardWidth',
    'getBoardHeight',
    'getTileSize',
    'canPlaceTower',
    'wouldBlockPath',
    'placeTower',
    'removeTower',
    'importBoard',
  ];
  const spy = jasmine.createSpyObj<GameBoardService>('GameBoardService', methods);
  spy.getBoardWidth.and.returnValue(width);
  spy.getBoardHeight.and.returnValue(height);
  spy.getTileSize.and.returnValue(tileSize);
  spy.canPlaceTower.and.returnValue(false);
  spy.wouldBlockPath.and.returnValue(false);
  spy.placeTower.and.returnValue(false);
  spy.removeTower.and.returnValue(false);
  if (boardFn) {
    spy.getGameBoard.and.callFake(boardFn);
  }
  return spy;
}

/**
 * Create a pre-configured EnemyService spy.
 * The damageEnemy callFake mutates enemy.health and returns killed status.
 */
export function createEnemyServiceSpy(
  enemyMap: Map<string, Enemy>
): jasmine.SpyObj<EnemyService> {
  const methods: (keyof EnemyService)[] = ['getEnemies', 'damageEnemy', 'spawnEnemy', 'removeEnemy', 'startHitFlash'];
  const spy = jasmine.createSpyObj<EnemyService>('EnemyService', methods);
  spy.getEnemies.and.returnValue(enemyMap);
  spy.damageEnemy.and.callFake((id: string, damage: number): DamageResult => {
    const enemy = enemyMap.get(id);
    if (!enemy || enemy.health <= 0) return { killed: false, spawnedEnemies: [] };
    enemy.health -= damage;
    return { killed: enemy.health <= 0, spawnedEnemies: [] };
  });
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
 * Create a pre-configured TutorialService spy.
 *
 * Default return values:
 *   - isTutorialComplete() — true (tutorial already done; prevents auto-start in tests)
 *   - getCurrentStep() — Observable<null>
 *   - getTip() — minimal TutorialTip with the provided step echoed back
 *   - All mutating methods — no-op void
 */
export function createTutorialServiceSpy(): jasmine.SpyObj<TutorialService> {
  const spy = jasmine.createSpyObj<TutorialService>('TutorialService', [
    'isTutorialComplete',
    'getCurrentStep',
    'startTutorial',
    'advanceStep',
    'skipTutorial',
    'resetCurrentStep',
    'resetTutorial',
    'getTip',
  ]);
  spy.isTutorialComplete.and.returnValue(true);
  spy.getCurrentStep.and.returnValue(of(null));
  spy.getTip.and.callFake((step: TutorialStep): TutorialTip => ({
    id: step,
    step,
    title: 'Test Title',
    message: 'Test message.',
    position: 'center',
  }));
  return spy;
}

/**
 * Create a pre-configured CombatLoopService spy.
 *
 * Default return values:
 *   - tick() — empty CombatFrameResult (no kills, no events)
 *   - flushElapsedTime() — 0
 *   - reset() / resetLeakState() — no-op void
 */
export function createCombatLoopServiceSpy(): jasmine.SpyObj<CombatLoopService> {
  const spy = jasmine.createSpyObj<CombatLoopService>('CombatLoopService', [
    'tick',
    'flushElapsedTime',
    'resetLeakState',
    'reset',
  ]);
  spy.tick.and.returnValue({
    kills: [],
    firedTypes: new Set(),
    hitCount: 0,
    exitCount: 0,
    leaked: false,
    defeatTriggered: false,
    waveCompletion: null,
    gameEnd: null,
    combatAudioEvents: [],
  });
  spy.flushElapsedTime.and.returnValue(0);
  return spy;
}

/**
 * Create a pre-configured MinimapService spy.
 *
 * Default return values:
 *   - isVisible() — false
 *   - All mutating / rendering methods — no-op void
 */
export function createMinimapServiceSpy(): jasmine.SpyObj<MinimapService> {
  const spy = jasmine.createSpyObj<MinimapService>('MinimapService', [
    'init',
    'update',
    'show',
    'hide',
    'toggleVisibility',
    'isVisible',
    'cleanup',
  ]);
  spy.isVisible.and.returnValue(false);
  return spy;
}

/**
 * Create a pre-configured SettingsService spy.
 *
 * Default return values:
 *   - get() — default GameSettings (unmuted, normal difficulty, speed 1)
 *   - update() / reset() — no-op void
 */
export function createSettingsServiceSpy(): jasmine.SpyObj<SettingsService> {
  const spy = jasmine.createSpyObj<SettingsService>('SettingsService', [
    'get',
    'update',
    'reset',
  ]);
  const defaultSettings: GameSettings = {
    audioMuted: false,
    difficulty: DifficultyLevel.NORMAL,
    gameSpeed: 1,
  };
  spy.get.and.returnValue(defaultSettings);
  return spy;
}

/**
 * Create a pre-configured AudioService spy.
 *
 * All play* methods, setVolume, toggleMute, resetFrameCounters, and cleanup
 * are stubbed as no-op voids. The isMuted and volume getters are not spied
 * (Jasmine cannot spy on getters via createSpyObj) — access them via the
 * underlying SettingsService spy if needed.
 */
export function createAudioServiceSpy(): jasmine.SpyObj<AudioService> {
  return jasmine.createSpyObj<AudioService>('AudioService', [
    'resetFrameCounters',
    'playTowerFire',
    'playEnemyHit',
    'playEnemyDeath',
    'playWaveStart',
    'playWaveClear',
    'playGoldEarned',
    'playTowerPlace',
    'playTowerUpgrade',
    'playTowerSell',
    'playDefeat',
    'playVictory',
    'playAchievementSound',
    'playStreakSound',
    'playChallengeSound',
    'playSfx',
    'playSequence',
    'setVolume',
    'toggleMute',
    'cleanup',
  ]);
}

/**
 * Create a pre-configured SceneService spy.
 *
 * Default return values:
 *   - getScene() — null cast (provide a real THREE.Scene if your test needs it)
 *   - getCamera() / getRenderer() / getComposer() / getControls() — null cast
 *   - getParticles() — null
 *   - getSkybox() — undefined
 *   - All init* / dispose* / tick* / render / resize methods — no-op void
 */
export function createSceneServiceSpy(): jasmine.SpyObj<SceneService> {
  const spy = jasmine.createSpyObj<SceneService>('SceneService', [
    'getScene',
    'getCamera',
    'getRenderer',
    'getComposer',
    'getControls',
    'getParticles',
    'getSkybox',
    'initScene',
    'initCamera',
    'initRenderer',
    'initPostProcessing',
    'initLights',
    'initControls',
    'initParticles',
    'initSkybox',
    'tickAmbientVisuals',
    'resize',
    'render',
    'disposeLights',
    'disposeParticles',
    'disposeSkybox',
    'dispose',
  ]);
  spy.getParticles.and.returnValue(null);
  spy.getSkybox.and.returnValue(undefined);
  return spy;
}

/**
 * Create a pre-configured GameNotificationService spy.
 *
 * Default return values:
 *   - getNotifications() — Observable<[]> (empty notification list)
 *   - show() / dismiss() / clear() — no-op void
 */
export function createGameNotificationServiceSpy(): jasmine.SpyObj<GameNotificationService> {
  const spy = jasmine.createSpyObj<GameNotificationService>('GameNotificationService', [
    'getNotifications',
    'show',
    'dismiss',
    'clear',
  ]);
  spy.getNotifications.and.returnValue(of([] as GameNotification[]));
  return spy;
}
