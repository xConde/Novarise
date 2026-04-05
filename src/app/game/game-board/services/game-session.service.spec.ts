import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { GameSessionService } from './game-session.service';
import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { EnemyService } from './enemy.service';
import { GameStatsService } from './game-stats.service';
import { GameNotificationService } from './game-notification.service';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { GameEndService } from './game-end.service';
import { MapBridgeService } from '../../../core/services/map-bridge.service';
import { StatusEffectService } from './status-effect.service';
import { TutorialService } from '../../../core/services/tutorial.service';
import { CAMPAIGN_WAVE_DEFINITIONS } from '../../../campaign/waves/campaign-waves';

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

  beforeEach(() => {
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
      ],
    });

    service = TestBed.inject(GameSessionService);
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
});
