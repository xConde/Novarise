import { of } from 'rxjs';

import { SceneService } from '../../services/scene.service';
import { AudioService } from '../../services/audio.service';
import { SettingsService, GameSettings } from '@core/services/settings.service';
import { MinimapService } from '../../services/minimap.service';
import { GameNotificationService, GameNotification } from '../../services/game-notification.service';
import { TutorialService, TutorialStep, TutorialTip } from '@core/services/tutorial.service';
import { MapBridgeService } from '@core/services/map-bridge.service';
import { MapStorageService, MapMetadata } from '@core/services/map-storage.service';
import { PlayerProfileService } from '@core/services/player-profile.service';
import { DifficultyLevel } from '../../models/game-state.model';
import { PlayerProfile } from '../../models/achievement.model';

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
  spy.getControls.and.returnValue({ enabled: true } as any);
  spy.getParticles.and.returnValue(null);
  spy.getSkybox.and.returnValue(undefined);
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
    showFps: false,
    reduceMotion: false,
  };
  spy.get.and.returnValue(defaultSettings);
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
    'setDimmed',
    'isVisible',
    'cleanup',
    'buildTerrainCache',
    'updateWithEntities',
    'getCachedTerrain',
  ]);
  spy.isVisible.and.returnValue(false);
  spy.getCachedTerrain.and.returnValue(null);
  spy.buildTerrainCache.and.returnValue({
    gridWidth: 10,
    gridHeight: 10,
    isPath: () => false,
    spawnPoints: [],
    exitPoints: [],
  });
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
    'dismissOnPlayerAction',
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
    runsAttempted: 0,
    runsCompleted: 0,
    highestAscensionBeaten: 0,
    runTotalKills: 0,
    runBestScore: 0,
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
