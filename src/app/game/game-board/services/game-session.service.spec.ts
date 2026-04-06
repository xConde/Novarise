import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { GameSessionService, CleanupSceneOpts } from './game-session.service';
import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { EnemyService } from './enemy.service';
import { GameStatsService } from './game-stats.service';
import { GameNotificationService } from './game-notification.service';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { GameEndService } from './game-end.service';
import { MapBridgeService } from '@core/services/map-bridge.service';
import { StatusEffectService } from './status-effect.service';
import { TutorialService } from '@core/services/tutorial.service';
import { CAMPAIGN_WAVE_DEFINITIONS } from '@campaign/waves/campaign-waves';
import { TowerCombatService } from './tower-combat.service';
import { TowerPreviewService } from './tower-preview.service';
import { DamagePopupService } from './damage-popup.service';
import { MinimapService } from './minimap.service';
import { PathVisualizationService } from './path-visualization.service';
import { TileHighlightService } from './tile-highlight.service';
import { RangeVisualizationService } from './range-visualization.service';
import { TowerUpgradeVisualService } from './tower-upgrade-visual.service';
import { SceneService } from './scene.service';
import { PlayerProfileService } from '@core/services/player-profile.service';

describe('GameSessionService', () => {
  let service: GameSessionService;
  let gameStateSpy: jasmine.SpyObj<GameStateService>;
  let waveSpy: jasmine.SpyObj<WaveService>;
  let enemySpy: jasmine.SpyObj<EnemyService>;
  let gameStatsSpy: jasmine.SpyObj<GameStatsService>;
  let notificationSpy: jasmine.SpyObj<GameNotificationService>;
  let challengeSpy: jasmine.SpyObj<ChallengeTrackingService>;
  let gameEndSpy: jasmine.SpyObj<GameEndService>;
  let mapBridgeSpy: jasmine.SpyObj<MapBridgeService>;
  let statusEffectSpy: jasmine.SpyObj<StatusEffectService>;
  let tutorialSpy: jasmine.SpyObj<TutorialService>;
  let towerCombatSpy: jasmine.SpyObj<TowerCombatService>;
  let towerPreviewSpy: jasmine.SpyObj<TowerPreviewService>;
  let damagePopupSpy: jasmine.SpyObj<DamagePopupService>;
  let minimapSpy: jasmine.SpyObj<MinimapService>;
  let pathVisSpy: jasmine.SpyObj<PathVisualizationService>;
  let tileHighlightSpy: jasmine.SpyObj<TileHighlightService>;
  let rangeVisSpy: jasmine.SpyObj<RangeVisualizationService>;
  let towerUpgradeVisualSpy: jasmine.SpyObj<TowerUpgradeVisualService>;
  let sceneSpy: jasmine.SpyObj<SceneService>;
  let playerProfileSpy: jasmine.SpyObj<PlayerProfileService>;
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();

    gameStateSpy = jasmine.createSpyObj('GameStateService', ['reset', 'setMaxWaves', 'getState$', 'getState']);
    gameStateSpy.getState.and.returnValue({
      wave: 0, lives: 7, gold: 150, score: 0, phase: 'SETUP',
      isPaused: false, isEndless: false, gameSpeed: 1,
      difficulty: 'normal', streak: 0, maxWaves: 10, elapsedTime: 0,
    } as any);

    waveSpy = jasmine.createSpyObj('WaveService', ['reset', 'setCustomWaves', 'hasCustomWaves', 'getWaveDefinitions', 'setEndlessMode']);
    waveSpy.hasCustomWaves.and.returnValue(false);
    waveSpy.getWaveDefinitions.and.returnValue([]);

    enemySpy = jasmine.createSpyObj('EnemyService', ['reset', 'getEnemies', 'removeEnemy', 'getPathToExit']);
    enemySpy.getEnemies.and.returnValue(new Map());
    enemySpy.getPathToExit.and.returnValue([]);

    gameStatsSpy = jasmine.createSpyObj('GameStatsService', ['reset', 'getStats']);
    gameStatsSpy.getStats.and.returnValue({} as any);

    notificationSpy = jasmine.createSpyObj('GameNotificationService', ['clear', 'getNotifications', 'show', 'dismiss']);
    notificationSpy.getNotifications.and.returnValue({ subscribe: () => ({ unsubscribe: () => {} }) } as any);

    challengeSpy = jasmine.createSpyObj('ChallengeTrackingService', [
      'reset', 'recordTowerPlaced', 'recordTowerUpgraded', 'recordTowerSold', 'getSnapshot',
    ]);
    challengeSpy.getSnapshot.and.returnValue({} as any);

    gameEndSpy = jasmine.createSpyObj('GameEndService', ['reset', 'recordEnd', 'recordSpecialization']);
    gameEndSpy.recordEnd.and.returnValue({ newlyUnlockedAchievements: [], completedChallenges: [] });

    mapBridgeSpy = jasmine.createSpyObj('MapBridgeService', [
      'getMapId', 'hasEditorMap', 'getEditorMapState', 'convertToGameBoard', 'setEditorMapState',
    ]);
    mapBridgeSpy.getMapId.and.returnValue(null);
    mapBridgeSpy.hasEditorMap.and.returnValue(false);

    statusEffectSpy = jasmine.createSpyObj('StatusEffectService', [
      'cleanup', 'getAllActiveEffects', 'applyEffect', 'clearEffectsForEnemy',
    ]);
    statusEffectSpy.getAllActiveEffects.and.returnValue(new Map());

    tutorialSpy = jasmine.createSpyObj('TutorialService', ['resetCurrentStep', 'isTutorialComplete', 'getCurrentStep']);
    tutorialSpy.isTutorialComplete.and.returnValue(false);
    tutorialSpy.getCurrentStep.and.returnValue({ subscribe: () => ({ unsubscribe: () => {} }) } as any);

    towerCombatSpy = jasmine.createSpyObj('TowerCombatService', ['cleanup', 'getPlacedTowers']);
    towerCombatSpy.getPlacedTowers.and.returnValue(new Map());

    towerPreviewSpy = jasmine.createSpyObj('TowerPreviewService', ['cleanup']);

    damagePopupSpy = jasmine.createSpyObj('DamagePopupService', ['cleanup']);

    minimapSpy = jasmine.createSpyObj('MinimapService', [
      'cleanup', 'update', 'show', 'hide', 'isVisible', 'init', 'buildTerrainCache', 'updateWithEntities', 'getCachedTerrain',
    ]);
    minimapSpy.isVisible.and.returnValue(false);
    minimapSpy.getCachedTerrain.and.returnValue(null);

    pathVisSpy = jasmine.createSpyObj('PathVisualizationService', ['hidePath', 'cleanup', 'showPath']);

    tileHighlightSpy = jasmine.createSpyObj('TileHighlightService', ['clearHighlights', 'updateHighlights', 'restoreAfterHover']);

    rangeVisSpy = jasmine.createSpyObj('RangeVisualizationService', ['cleanup', 'showForTower', 'removePreview', 'toggleAllRanges']);

    towerUpgradeVisualSpy = jasmine.createSpyObj('TowerUpgradeVisualService', [
      'cleanup', 'applyLevelScale', 'spawnUpgradeFlash', 'addGlowRing', 'removeGlowRing',
      'update', 'applyUpgradeVisuals', 'applySpecializationVisual',
    ]);

    sceneSpy = jasmine.createSpyObj('SceneService', [
      'getScene', 'disposeParticles', 'disposeSkybox', 'disposeLights',
      'getCamera', 'getRenderer', 'getComposer', 'getControls', 'getParticles',
      'initScene', 'initCamera', 'initRenderer', 'initLights', 'initControls', 'initSkybox',
      'render', 'resize', 'dispose', 'setBoardSize', 'initPostProcessing', 'initParticles',
      'tickAmbientVisuals', 'getSkybox',
    ]);
    sceneSpy.getScene.and.returnValue(scene);
    sceneSpy.getParticles.and.returnValue(null);
    sceneSpy.getSkybox.and.returnValue(undefined);

    playerProfileSpy = jasmine.createSpyObj('PlayerProfileService', ['resetSession']);

    TestBed.configureTestingModule({
      providers: [
        GameSessionService,
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: WaveService, useValue: waveSpy },
        { provide: EnemyService, useValue: enemySpy },
        { provide: GameStatsService, useValue: gameStatsSpy },
        { provide: GameNotificationService, useValue: notificationSpy },
        { provide: ChallengeTrackingService, useValue: challengeSpy },
        { provide: GameEndService, useValue: gameEndSpy },
        { provide: MapBridgeService, useValue: mapBridgeSpy },
        { provide: StatusEffectService, useValue: statusEffectSpy },
        { provide: TutorialService, useValue: tutorialSpy },
        { provide: TowerCombatService, useValue: towerCombatSpy },
        { provide: TowerPreviewService, useValue: towerPreviewSpy },
        { provide: DamagePopupService, useValue: damagePopupSpy },
        { provide: MinimapService, useValue: minimapSpy },
        { provide: PathVisualizationService, useValue: pathVisSpy },
        { provide: TileHighlightService, useValue: tileHighlightSpy },
        { provide: RangeVisualizationService, useValue: rangeVisSpy },
        { provide: TowerUpgradeVisualService, useValue: towerUpgradeVisualSpy },
        { provide: SceneService, useValue: sceneSpy },
        { provide: PlayerProfileService, useValue: playerProfileSpy },
      ],
    });

    service = TestBed.inject(GameSessionService);
  });

  afterEach(() => {
    scene.clear();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('resetAllServices', () => {
    it('should call reset on all services', () => {
      const scene = new THREE.Scene();

      service.resetAllServices(scene);

      expect(enemySpy.reset).toHaveBeenCalledWith(scene);
      expect(waveSpy.reset).toHaveBeenCalled();
      expect(gameStateSpy.reset).toHaveBeenCalled();
      expect(gameStatsSpy.reset).toHaveBeenCalled();
      expect(gameEndSpy.reset).toHaveBeenCalled();
      expect(notificationSpy.clear).toHaveBeenCalled();
      expect(challengeSpy.reset).toHaveBeenCalled();
      expect(statusEffectSpy.cleanup).toHaveBeenCalled();
      expect(tutorialSpy.resetCurrentStep).toHaveBeenCalled();

      scene.clear();
    });

    it('should pass the scene to enemyService.reset', () => {
      const scene = new THREE.Scene();

      service.resetAllServices(scene);

      expect(enemySpy.reset).toHaveBeenCalledWith(scene);

      scene.clear();
    });
  });

  describe('applyCampaignWaves', () => {
    it('should be a no-op for null mapId', () => {
      mapBridgeSpy.getMapId.and.returnValue(null);

      service.applyCampaignWaves();

      expect(waveSpy.setCustomWaves).not.toHaveBeenCalled();
      expect(gameStateSpy.setMaxWaves).not.toHaveBeenCalled();
    });

    it('should be a no-op for non-campaign map ids', () => {
      mapBridgeSpy.getMapId.and.returnValue('my-custom-map');

      service.applyCampaignWaves();

      expect(waveSpy.setCustomWaves).not.toHaveBeenCalled();
      expect(gameStateSpy.setMaxWaves).not.toHaveBeenCalled();
    });

    it('should be a no-op for unknown campaign map ids', () => {
      mapBridgeSpy.getMapId.and.returnValue('campaign_unknown_level_that_does_not_exist');

      service.applyCampaignWaves();

      expect(waveSpy.setCustomWaves).not.toHaveBeenCalled();
      expect(gameStateSpy.setMaxWaves).not.toHaveBeenCalled();
    });

    it('should load wave definitions for a known campaign map', () => {
      const knownId = Object.keys(CAMPAIGN_WAVE_DEFINITIONS)[0];
      if (!knownId) {
        pending('No campaign wave definitions available — skip test');
        return;
      }
      mapBridgeSpy.getMapId.and.returnValue(knownId);
      const expectedWaves = CAMPAIGN_WAVE_DEFINITIONS[knownId];

      service.applyCampaignWaves();

      expect(waveSpy.setCustomWaves).toHaveBeenCalledWith(expectedWaves);
      expect(gameStateSpy.setMaxWaves).toHaveBeenCalledWith(expectedWaves.length);
    });

    it('should be a no-op for an empty string mapId', () => {
      mapBridgeSpy.getMapId.and.returnValue('');

      service.applyCampaignWaves();

      expect(waveSpy.setCustomWaves).not.toHaveBeenCalled();
      expect(gameStateSpy.setMaxWaves).not.toHaveBeenCalled();
    });

    it('should be a no-op for a map id that starts with "campaign_" but has no definition', () => {
      mapBridgeSpy.getMapId.and.returnValue('campaign_99');

      service.applyCampaignWaves();

      expect(waveSpy.setCustomWaves).not.toHaveBeenCalled();
      expect(gameStateSpy.setMaxWaves).not.toHaveBeenCalled();
    });

    // --- All 16 campaign level IDs ---

    const ALL_CAMPAIGN_IDS = [
      'campaign_01', 'campaign_02', 'campaign_03', 'campaign_04',
      'campaign_05', 'campaign_06', 'campaign_07', 'campaign_08',
      'campaign_09', 'campaign_10', 'campaign_11', 'campaign_12',
      'campaign_13', 'campaign_14', 'campaign_15', 'campaign_16',
    ];

    ALL_CAMPAIGN_IDS.forEach(mapId => {
      it(`should load non-empty wave definitions for ${mapId}`, () => {
        mapBridgeSpy.getMapId.and.returnValue(mapId);

        service.applyCampaignWaves();

        const waves = CAMPAIGN_WAVE_DEFINITIONS[mapId];
        expect(waves).toBeTruthy();
        expect(waves.length).toBeGreaterThan(0);
        expect(waveSpy.setCustomWaves).toHaveBeenCalledWith(waves);
        expect(gameStateSpy.setMaxWaves).toHaveBeenCalledWith(waves.length);
      });
    });

    ALL_CAMPAIGN_IDS.forEach(mapId => {
      it(`should set maxWaves to match wave array length for ${mapId}`, () => {
        mapBridgeSpy.getMapId.and.returnValue(mapId);

        service.applyCampaignWaves();

        const expectedLength = CAMPAIGN_WAVE_DEFINITIONS[mapId].length;
        expect(gameStateSpy.setMaxWaves).toHaveBeenCalledWith(expectedLength);
      });
    });

    ALL_CAMPAIGN_IDS.forEach(mapId => {
      it(`each wave entry for ${mapId} should have at least one enemy entry`, () => {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[mapId];
        waves.forEach((wave, i) => {
          expect(wave.entries.length)
            .withContext(`${mapId} wave[${i}].entries must be non-empty`)
            .toBeGreaterThan(0);
        });
      });
    });

    ALL_CAMPAIGN_IDS.forEach(mapId => {
      it(`each wave entry for ${mapId} should have a positive reward`, () => {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[mapId];
        waves.forEach((wave, i) => {
          expect(wave.reward)
            .withContext(`${mapId} wave[${i}].reward must be > 0`)
            .toBeGreaterThan(0);
        });
      });
    });
  });

  describe('cleanupScene', () => {
    function makeOpts(): CleanupSceneOpts {
      return {
        tileMeshes: new Map(),
        towerMeshes: new Map(),
        gridLines: null,
      };
    }

    it('should return null (for gridLines reset)', () => {
      const opts = makeOpts();
      expect(service.cleanupScene(opts)).toBeNull();
    });

    it('should call towerCombatService.cleanup', () => {
      service.cleanupScene(makeOpts());
      expect(towerCombatSpy.cleanup).toHaveBeenCalledWith(scene);
    });

    it('should call towerPreviewService.cleanup', () => {
      service.cleanupScene(makeOpts());
      expect(towerPreviewSpy.cleanup).toHaveBeenCalledWith(scene);
    });

    it('should call damagePopupService.cleanup', () => {
      service.cleanupScene(makeOpts());
      expect(damagePopupSpy.cleanup).toHaveBeenCalledWith(scene);
    });

    it('should call minimapService.cleanup', () => {
      service.cleanupScene(makeOpts());
      expect(minimapSpy.cleanup).toHaveBeenCalled();
    });

    it('should call pathVisualizationService.hidePath and cleanup', () => {
      service.cleanupScene(makeOpts());
      expect(pathVisSpy.hidePath).toHaveBeenCalledWith(scene);
      expect(pathVisSpy.cleanup).toHaveBeenCalled();
    });

    it('should call tileHighlightService.clearHighlights with the tileMeshes map', () => {
      const opts = makeOpts();
      service.cleanupScene(opts);
      expect(tileHighlightSpy.clearHighlights).toHaveBeenCalledWith(opts.tileMeshes, scene);
    });

    it('should call rangeVisualizationService.cleanup', () => {
      service.cleanupScene(makeOpts());
      expect(rangeVisSpy.cleanup).toHaveBeenCalledWith(scene);
    });

    it('should call towerUpgradeVisualService.cleanup', () => {
      service.cleanupScene(makeOpts());
      expect(towerUpgradeVisualSpy.cleanup).toHaveBeenCalledWith(scene);
    });

    it('should clear towerMeshes and tileMeshes in-place', () => {
      const tileMeshes = new Map([['0-0', new THREE.Mesh()]]);
      const towerMeshes = new Map([['0-0', new THREE.Group()]]);
      const opts: CleanupSceneOpts = { tileMeshes, towerMeshes, gridLines: null };

      service.cleanupScene(opts);

      expect(tileMeshes.size).toBe(0);
      expect(towerMeshes.size).toBe(0);
    });

    it('should dispose tile mesh geometry and material', () => {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);

      const tileMeshes = new Map([['0-0', mesh]]);
      const opts: CleanupSceneOpts = { tileMeshes, towerMeshes: new Map(), gridLines: null };

      const geoSpy = spyOn(geo, 'dispose').and.callThrough();
      const matSpy = spyOn(mat, 'dispose').and.callThrough();

      service.cleanupScene(opts);

      expect(geoSpy).toHaveBeenCalled();
      expect(matSpy).toHaveBeenCalled();
    });

    it('should handle null gridLines without throwing', () => {
      const opts: CleanupSceneOpts = { tileMeshes: new Map(), towerMeshes: new Map(), gridLines: null };
      expect(() => service.cleanupScene(opts)).not.toThrow();
    });

    it('should dispose gridLines group geometry', () => {
      const gridLines = new THREE.Group();
      const lineGeo = new THREE.BufferGeometry();
      const lineMat = new THREE.LineBasicMaterial();
      const line = new THREE.Line(lineGeo, lineMat);
      gridLines.add(line);
      scene.add(gridLines);

      const geoSpy = spyOn(lineGeo, 'dispose').and.callThrough();

      const opts: CleanupSceneOpts = { tileMeshes: new Map(), towerMeshes: new Map(), gridLines };
      service.cleanupScene(opts);

      expect(geoSpy).toHaveBeenCalled();
    });

    it('should call sceneService.disposeParticles, disposeSkybox, disposeLights', () => {
      service.cleanupScene(makeOpts());
      expect(sceneSpy.disposeParticles).toHaveBeenCalled();
      expect(sceneSpy.disposeSkybox).toHaveBeenCalled();
      expect(sceneSpy.disposeLights).toHaveBeenCalled();
    });
  });
});
