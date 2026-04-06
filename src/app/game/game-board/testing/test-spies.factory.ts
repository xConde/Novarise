import { EMPTY, of } from 'rxjs';

import { GameBoardService } from '../game-board.service';
import { EnemyService, DamageResult } from '../services/enemy.service';
import { GameStatsService, GameStats } from '../services/game-stats.service';
import { TutorialService, TutorialStep, TutorialTip } from '@core/services/tutorial.service';
import { CombatLoopService } from '../services/combat-loop.service';
import { MinimapService } from '../services/minimap.service';
import { SettingsService, GameSettings } from '@core/services/settings.service';
import { AudioService } from '../services/audio.service';
import { SceneService } from '../services/scene.service';
import { GameNotificationService, GameNotification } from '../services/game-notification.service';
import { TowerAnimationService } from '../services/tower-animation.service';
import { GameStateService } from '../services/game-state.service';
import { GameEndService } from '../services/game-end.service';
import { WaveService } from '../services/wave.service';
import { TowerCombatService } from '../services/tower-combat.service';
import { StatusEffectService } from '../services/status-effect.service';
import { ChallengeTrackingService } from '../services/challenge-tracking.service';
import { GamePauseService } from '../services/game-pause.service';
import { MapBridgeService } from '@core/services/map-bridge.service';
import { MapStorageService, MapMetadata } from '@core/services/map-storage.service';
import { PlayerProfileService } from '@core/services/player-profile.service';
import { CampaignService } from '@campaign/services/campaign.service';
import { Enemy } from '../models/enemy.model';
import { GameBoardTile } from '../models/game-board-tile';
import { TowerType } from '../models/tower.model';
import { DifficultyLevel, GamePhase, INITIAL_GAME_STATE, GameState } from '../models/game-state.model';
import { PlayerProfile } from '../models/achievement.model';

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
  width = 10,
  height = 10,
  tileSize = 1,
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
    'isTipsComplete',
    'getCurrentStep',
    'startTutorial',
    'startTips',
    'incrementGamesPlayed',
    'advanceStep',
    'skipTutorial',
    'resetCurrentStep',
    'resetTutorial',
    'getTip',
  ]);
  spy.isTutorialComplete.and.returnValue(true);
  spy.isTipsComplete.and.returnValue(true);
  spy.getCurrentStep.and.returnValue(of(null));
  spy.getTip.and.callFake((step: TutorialStep): TutorialTip => ({
    id: step,
    step,
    type: 'tutorial',
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
    showFps: false,
    reduceMotion: false,
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

/**
 * Create a pre-configured TowerAnimationService spy.
 *
 * All animation methods are stubbed as no-op voids:
 *   - startMuzzleFlash / updateMuzzleFlashes / updateTowerAnimations / updateTilePulse
 */
export function createTowerAnimationServiceSpy(): jasmine.SpyObj<TowerAnimationService> {
  return jasmine.createSpyObj<TowerAnimationService>('TowerAnimationService', [
    'startMuzzleFlash',
    'updateMuzzleFlashes',
    'updateTowerAnimations',
    'updateTilePulse',
  ]);
}

// ---------------------------------------------------------------------------
// Cross-module service spies (added in Hardening VIII Sprint 44)
// ---------------------------------------------------------------------------

/**
 * Create a pre-configured MapBridgeService spy.
 *
 * Default return values:
 *   - getMapId() — null (no saved map loaded)
 *   - getEditorMapState() — null
 *   - hasEditorMap() / hasValidSpawnAndExit() — false
 *   - convertToGameBoard() — empty board
 *   - All mutating methods — no-op void
 */
export function createMapBridgeServiceSpy(): jasmine.SpyObj<MapBridgeService> {
  const spy = jasmine.createSpyObj<MapBridgeService>('MapBridgeService', [
    'setEditorMapState',
    'getMapId',
    'getEditorMapState',
    'hasEditorMap',
    'clearEditorMap',
    'hasValidSpawnAndExit',
    'convertToGameBoard',
  ]);
  spy.getMapId.and.returnValue(null);
  spy.getEditorMapState.and.returnValue(null);
  spy.hasEditorMap.and.returnValue(false);
  spy.hasValidSpawnAndExit.and.returnValue(false);
  spy.convertToGameBoard.and.returnValue({ board: [], width: 0, height: 0 });
  return spy;
}

/**
 * Create a pre-configured MapStorageService spy.
 *
 * Default return values:
 *   - getAllMaps() — empty array
 *   - loadMap() / getMapMetadata() / getCurrentMapId() — null
 *   - loadCurrentMap() — null
 *   - saveMap() — 'test-map-id'
 *   - deleteMap() — true
 *   - exportMapToJson() — null
 *   - importMapFromJson() — null
 *   - All other methods — no-op void or false
 */
export function createMapStorageServiceSpy(): jasmine.SpyObj<MapStorageService> {
  const spy = jasmine.createSpyObj<MapStorageService>('MapStorageService', [
    'saveMap',
    'loadMap',
    'getAllMaps',
    'getMapMetadata',
    'deleteMap',
    'getCurrentMapId',
    'clearCurrentMapId',
    'loadCurrentMap',
    'migrateOldFormat',
    'exportMapToJson',
    'downloadMapAsFile',
    'importMapFromJson',
    'validateMapJson',
    'promptFileImport',
  ]);
  spy.getAllMaps.and.returnValue([] as MapMetadata[]);
  spy.loadMap.and.returnValue(null);
  spy.getMapMetadata.and.returnValue(null);
  spy.getCurrentMapId.and.returnValue(null);
  spy.loadCurrentMap.and.returnValue(null);
  spy.saveMap.and.returnValue('test-map-id');
  spy.deleteMap.and.returnValue(true);
  spy.exportMapToJson.and.returnValue(null);
  spy.importMapFromJson.and.returnValue(null);
  spy.migrateOldFormat.and.returnValue(false);
  spy.downloadMapAsFile.and.returnValue(false);
  spy.validateMapJson.and.returnValue({ valid: false });
  return spy;
}

/**
 * Create a pre-configured PlayerProfileService spy.
 *
 * Default return values:
 *   - getProfile() — minimal zeroed-out profile
 *   - recordGameEnd() — empty array (no newly unlocked achievements)
 *   - getMapScore() — null
 *   - getAllMapScores() — empty object
 *   - getAchievements() / getUnlockedAchievements() / getLockedAchievements() — empty arrays
 *   - All mutating methods — no-op void
 */
export function createPlayerProfileServiceSpy(): jasmine.SpyObj<PlayerProfileService> {
  const spy = jasmine.createSpyObj<PlayerProfileService>('PlayerProfileService', [
    'getProfile',
    'recordGameEnd',
    'recordMapScore',
    'recordChallengeCompleted',
    'getMapScore',
    'getAllMapScores',
    'getAchievements',
    'getAchievementsByCategory',
    'getUnlockedAchievements',
    'getLockedAchievements',
    'reset',
    'resetSession',
  ]);
  const emptyProfile: PlayerProfile = {
    totalGamesPlayed: 0,
    totalVictories: 0,
    totalDefeats: 0,
    totalEnemiesKilled: 0,
    totalGoldEarned: 0,
    highestWaveReached: 0,
    highestScore: 0,
    achievements: [],
    mapScores: {},
    towerKills: {},
    slowEffectsApplied: 0,
    hasUsedSpecialization: false,
    hasPlacedAllTowerTypes: false,
    maxModifiersUsedInVictory: 0,
    completedChallengeCount: 0,
  };
  spy.getProfile.and.returnValue(emptyProfile);
  spy.recordGameEnd.and.returnValue([]);
  spy.getMapScore.and.returnValue(null);
  spy.getAllMapScores.and.returnValue({});
  spy.getAchievements.and.returnValue([]);
  spy.getAchievementsByCategory.and.returnValue([]);
  spy.getUnlockedAchievements.and.returnValue([]);
  spy.getLockedAchievements.and.returnValue([]);
  return spy;
}

/**
 * Create a pre-configured CampaignService spy.
 *
 * Default return values:
 *   - getAllLevels() — empty array
 *   - getLevel() — undefined
 *   - isUnlocked() / isCompleted() — false
 *   - getLevelProgress() — null
 *   - getTotalStars() / getCompletedCount() / getCompletedChallengeCount() — 0
 *   - getNextLevel() — null
 *   - getChallengesForLevel() — empty array
 *   - isChallengeCompleted() — false
 *   - All mutating methods — no-op void
 */
export function createCampaignServiceSpy(): jasmine.SpyObj<CampaignService> {
  const spy = jasmine.createSpyObj<CampaignService>('CampaignService', [
    'getAllLevels',
    'getLevel',
    'isUnlocked',
    'isCompleted',
    'getLevelProgress',
    'getTotalStars',
    'getCompletedCount',
    'recordCompletion',
    'getNextLevel',
    'getChallengesForLevel',
    'isChallengeCompleted',
    'completeChallenge',
    'getCompletedChallengeCount',
    'resetProgress',
  ]);
  spy.getAllLevels.and.returnValue([]);
  spy.getLevel.and.returnValue(undefined);
  spy.isUnlocked.and.returnValue(false);
  spy.isCompleted.and.returnValue(false);
  spy.getLevelProgress.and.returnValue(null);
  spy.getTotalStars.and.returnValue(0);
  spy.getCompletedCount.and.returnValue(0);
  spy.getNextLevel.and.returnValue(null);
  spy.getChallengesForLevel.and.returnValue([]);
  spy.isChallengeCompleted.and.returnValue(false);
  spy.getCompletedChallengeCount.and.returnValue(0);
  return spy;
}

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
 */
export function createGameStateServiceSpy(): jasmine.SpyObj<GameStateService> {
  const spy = jasmine.createSpyObj<GameStateService>('GameStateService', [
    'getState',
    'getState$',
    'getPhaseChanges',
    'setPhase',
    'startWave',
    'completeWave',
    'setEndlessMode',
    'loseLife',
    'addStreakBonus',
    'getStreak',
    'addGold',
    'addGoldAndScore',
    'awardInterest',
    'spendGold',
    'canAfford',
    'addScore',
    'togglePause',
    'setSpeed',
    'setModifiers',
    'getModifierEffects',
    'getModifierScoreMultiplier',
    'setDifficulty',
    'addElapsedTime',
    'setMaxWaves',
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
 * Create a pre-configured WaveService spy.
 *
 * Default return values:
 *   - hasCustomWaves() / isEndlessMode() / isSpawning() / isNewType() — false
 *   - getWaveDefinitions() — empty array
 *   - getTotalEnemiesInWave() / getWaveReward() / getMaxWaves() / getRemainingToSpawn() — 0
 *   - getCurrentEndlessTemplate() / getCurrentEndlessResult() — null
 *   - All mutating methods — no-op void
 */
export function createWaveServiceSpy(): jasmine.SpyObj<WaveService> {
  const spy = jasmine.createSpyObj<WaveService>('WaveService', [
    'setCustomWaves',
    'clearCustomWaves',
    'hasCustomWaves',
    'getWaveDefinitions',
    'setEndlessMode',
    'isEndlessMode',
    'getCurrentEndlessTemplate',
    'getCurrentEndlessResult',
    'startWave',
    'update',
    'isSpawning',
    'getRemainingToSpawn',
    'getTotalEnemiesInWave',
    'getWaveReward',
    'getMaxWaves',
    'isNewType',
    'markSeen',
    'reset',
  ]);
  spy.hasCustomWaves.and.returnValue(false);
  spy.isEndlessMode.and.returnValue(false);
  spy.isSpawning.and.returnValue(false);
  spy.isNewType.and.returnValue(false);
  spy.getWaveDefinitions.and.returnValue([]);
  spy.getTotalEnemiesInWave.and.returnValue(0);
  spy.getWaveReward.and.returnValue(0);
  spy.getMaxWaves.and.returnValue(0);
  spy.getRemainingToSpawn.and.returnValue(0);
  spy.getCurrentEndlessTemplate.and.returnValue(null);
  spy.getCurrentEndlessResult.and.returnValue(null);
  return spy;
}

/**
 * Create a pre-configured TowerCombatService spy.
 *
 * Default return values:
 *   - update() — empty result (no kills, no shots)
 *   - upgradeTower() / upgradeTowerWithSpec() / setTargetingMode() / cycleTargetingMode() — false/null
 *   - drainAudioEvents() — empty array
 *   - unregisterTower() — undefined
 *   - All other mutating methods — no-op void
 */
export function createTowerCombatServiceSpy(): jasmine.SpyObj<TowerCombatService> {
  const spy = jasmine.createSpyObj<TowerCombatService>('TowerCombatService', [
    'drainAudioEvents',
    'registerTower',
    'upgradeTower',
    'upgradeTowerWithSpec',
    'unregisterTower',
    'update',
    'setTargetingMode',
    'cycleTargetingMode',
  ]);
  spy.update.and.returnValue({ killed: [], fired: [], hitCount: 0 });
  spy.upgradeTower.and.returnValue(false);
  spy.upgradeTowerWithSpec.and.returnValue(false);
  spy.setTargetingMode.and.returnValue(false);
  spy.cycleTargetingMode.and.returnValue(null);
  spy.unregisterTower.and.returnValue(undefined);
  spy.drainAudioEvents.and.returnValue([]);
  return spy;
}

/**
 * Create a pre-configured StatusEffectService spy.
 *
 * Default return values:
 *   - apply() — false (effect not applied)
 *   - update() — empty array (no kills from DoT)
 *   - hasEffect() — false
 *   - getEffects() / getAllActiveEffects() — empty
 *   - getSlowApplicationCount() — 0
 *   - All cleanup / removal methods — no-op void
 */
export function createStatusEffectServiceSpy(): jasmine.SpyObj<StatusEffectService> {
  const spy = jasmine.createSpyObj<StatusEffectService>('StatusEffectService', [
    'apply',
    'update',
    'hasEffect',
    'getEffects',
    'getAllActiveEffects',
    'removeAllEffects',
    'getSlowApplicationCount',
    'cleanup',
  ]);
  spy.apply.and.returnValue(false);
  spy.update.and.returnValue([]);
  spy.hasEffect.and.returnValue(false);
  spy.getEffects.and.returnValue([]);
  spy.getAllActiveEffects.and.returnValue(new Map());
  spy.getSlowApplicationCount.and.returnValue(0);
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

export function createGamePauseServiceSpy(): jasmine.SpyObj<GamePauseService> {
  const spy = jasmine.createSpyObj<GamePauseService>(
    'GamePauseService',
    ['togglePause', 'setupAutoPause', 'requestQuit', 'cancelQuit', 'confirmQuit', 'canLeaveGame', 'reset', 'cleanup', 'ngOnDestroy'],
    { showQuitConfirm: false, autoPaused: false, isPaused: false }
  );
  spy.togglePause.and.returnValue(false);
  spy.canLeaveGame.and.returnValue(true);
  spy.confirmQuit.and.returnValue('/');
  return spy;
}
