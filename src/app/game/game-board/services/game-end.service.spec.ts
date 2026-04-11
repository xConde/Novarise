import { TestBed } from '@angular/core/testing';
import { GameEndService, GameEndResult } from './game-end.service';
import { GameStateService } from './game-state.service';
import { GameStatsService } from './game-stats.service';
import { PlayerProfileService, ACHIEVEMENTS } from '@core/services/player-profile.service';
import { StatusEffectService } from './status-effect.service'; // used as spy type
import { GameNotificationService, NotificationType } from './game-notification.service';
import { MapBridgeService } from '@core/services/map-bridge.service';
import { AudioService } from './audio.service';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { TowerType } from '../models/tower.model';
import { DifficultyLevel } from '../models/game-state.model';
import { ScoreBreakdown } from '../models/score.model';

const FAKE_SCORE_BREAKDOWN: ScoreBreakdown = {
  baseScore: 1000,
  livesRemaining: 5,
  livesTotal: 7,
  livesPercent: 0.71,
  difficultyMultiplier: 1.0,
  modifierMultiplier: 1.0,
  finalScore: 1200,
  stars: 3,
  difficulty: DifficultyLevel.NORMAL,
  wavesCompleted: 10,
  isVictory: true,
};

const FAKE_DEFEAT_BREAKDOWN: ScoreBreakdown = {
  baseScore: 500,
  livesRemaining: 0,
  livesTotal: 7,
  livesPercent: 0,
  difficultyMultiplier: 1.0,
  modifierMultiplier: 1.0,
  finalScore: 500,
  stars: 0,
  difficulty: DifficultyLevel.NORMAL,
  wavesCompleted: 5,
  isVictory: false,
};

describe('GameEndService', () => {
  let service: GameEndService;
  let playerProfileSpy: jasmine.SpyObj<PlayerProfileService>;
  let notificationSpy: jasmine.SpyObj<GameNotificationService>;
  let audioSpy: jasmine.SpyObj<AudioService>;
  let mapBridgeSpy: jasmine.SpyObj<MapBridgeService>;
  let statusEffectSpy: jasmine.SpyObj<StatusEffectService>;
  let gameStateService: GameStateService;
  let gameStatsService: GameStatsService;
  let challengeTrackingService: ChallengeTrackingService;

  beforeEach(() => {
    statusEffectSpy = jasmine.createSpyObj('StatusEffectService', [
      'getSlowApplicationCount', 'apply', 'getActiveEffects', 'getAllActiveEffects', 'clear', 'tick', 'cleanup',
    ]);
    statusEffectSpy.getSlowApplicationCount.and.returnValue(0);

    playerProfileSpy = jasmine.createSpyObj('PlayerProfileService', [
      'recordGameEnd', 'recordMapScore', 'recordChallengeCompleted',
    ]);
    playerProfileSpy.recordGameEnd.and.returnValue([]);

    notificationSpy = jasmine.createSpyObj('GameNotificationService', ['show', 'dismiss', 'getNotifications', 'clear']);

    audioSpy = jasmine.createSpyObj('AudioService', [
      'playAchievementSound', 'playChallengeSound', 'playVictory', 'playDefeat',
      'playTowerFire', 'playEnemyHit', 'playGoldEarned', 'playEnemyDeath',
      'playTowerUpgrade', 'playTowerSell', 'playWaveStart', 'playWaveClear',
      'playStreakSound', 'toggleMute',
    ]);

    mapBridgeSpy = jasmine.createSpyObj('MapBridgeService', [
      'getMapId', 'hasEditorMap', 'getEditorMapState', 'setEditorMapState', 'convertToGameBoard',
    ]);
    mapBridgeSpy.getMapId.and.returnValue(null);

    TestBed.configureTestingModule({
      providers: [
        GameEndService,
        GameStateService,
        GameStatsService,
        ChallengeTrackingService,
        { provide: StatusEffectService, useValue: statusEffectSpy },
        { provide: PlayerProfileService, useValue: playerProfileSpy },
        { provide: GameNotificationService, useValue: notificationSpy },
        { provide: AudioService, useValue: audioSpy },
        { provide: MapBridgeService, useValue: mapBridgeSpy },
      ],
    });

    service = TestBed.inject(GameEndService);
    gameStateService = TestBed.inject(GameStateService);
    gameStatsService = TestBed.inject(GameStatsService);
    challengeTrackingService = TestBed.inject(ChallengeTrackingService);
  });

  afterEach(() => {
    service.reset();
  });

  // ---------------------------------------------------------------------------
  // Idempotency
  // ---------------------------------------------------------------------------

  describe('idempotency', () => {
    it('isRecorded() returns false before any recordEnd() call', () => {
      expect(service.isRecorded()).toBeFalse();
    });

    it('isRecorded() returns true after first recordEnd()', () => {
      service.recordEnd(false, null);
      expect(service.isRecorded()).toBeTrue();
    });

    it('second recordEnd() returns empty result without re-recording', () => {
      service.recordEnd(false, null);
      playerProfileSpy.recordGameEnd.calls.reset();

      const result = service.recordEnd(false, null);

      expect(playerProfileSpy.recordGameEnd).not.toHaveBeenCalled();
      expect(result.newlyUnlockedAchievements).toEqual([]);
    });

    it('reset() clears recorded state so next recordEnd() fires again', () => {
      service.recordEnd(false, null);
      playerProfileSpy.recordGameEnd.calls.reset();
      service.reset();

      service.recordEnd(false, null);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledTimes(1);
    });

    it('reset() also clears hasSpecializationBeenUsed', () => {
      service.recordSpecialization();
      service.reset();

      service.recordEnd(true, null);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ usedSpecialization: false })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // buildGameEndStats wiring
  // ---------------------------------------------------------------------------

  describe('buildGameEndStats wiring', () => {
    it('passes isVictory=true correctly', () => {
      service.recordEnd(true, null);
      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ isVictory: true })
      );
    });

    it('passes isVictory=false correctly', () => {
      service.recordEnd(false, null);
      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ isVictory: false })
      );
    });

    it('includes towerKills from GameStatsService', () => {
      gameStatsService.recordKill(TowerType.SNIPER);
      gameStatsService.recordKill(TowerType.SNIPER);

      service.recordEnd(true, null);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ towerKills: jasmine.objectContaining({ sniper: 2 }) })
      );
    });

    it('usedSpecialization is false before recordSpecialization()', () => {
      service.recordEnd(true, null);
      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ usedSpecialization: false })
      );
    });

    it('usedSpecialization is true after recordSpecialization()', () => {
      service.recordSpecialization();
      service.recordEnd(true, null);
      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ usedSpecialization: true })
      );
    });

    it('placedAllTowerTypes is false when fewer than 6 types used', () => {
      challengeTrackingService.recordTowerPlaced(TowerType.BASIC, 100);
      challengeTrackingService.recordTowerPlaced(TowerType.SNIPER, 150);

      service.recordEnd(true, null);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ placedAllTowerTypes: false })
      );
    });

    it('placedAllTowerTypes is true when all 6 types have been used', () => {
      challengeTrackingService.recordTowerPlaced(TowerType.BASIC, 100);
      challengeTrackingService.recordTowerPlaced(TowerType.SNIPER, 150);
      challengeTrackingService.recordTowerPlaced(TowerType.SPLASH, 200);
      challengeTrackingService.recordTowerPlaced(TowerType.SLOW, 125);
      challengeTrackingService.recordTowerPlaced(TowerType.CHAIN, 175);
      challengeTrackingService.recordTowerPlaced(TowerType.MORTAR, 225);

      service.recordEnd(true, null);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ placedAllTowerTypes: true })
      );
    });

    it('slowEffectsApplied comes from StatusEffectService.getSlowApplicationCount()', () => {
      statusEffectSpy.getSlowApplicationCount.and.returnValue(7);

      service.recordEnd(true, null);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ slowEffectsApplied: 7 })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Map score recording
  // ---------------------------------------------------------------------------

  describe('map score recording', () => {
    it('records map score when mapId is present (always computed from GameStateService)', () => {
      // H7: recordEnd always computes scoreBreakdown from GameStateService — the second
      // parameter is a legacy ignored arg. With a fresh GameStateService (score=0,
      // lives=20, difficulty=NORMAL, wave=0, victory=true) the computed breakdown is:
      // finalScore=0, stars=3 (full lives), difficulty=NORMAL.
      mapBridgeSpy.getMapId.and.returnValue('map_01');

      service.recordEnd(true, FAKE_SCORE_BREAKDOWN);

      expect(playerProfileSpy.recordMapScore).toHaveBeenCalledOnceWith(
        'map_01',
        0,           // computed baseScore=0 × 1.0 difficulty × 1.0 modifier = 0
        3,           // stars=3: lives fully intact on victory (20/20)
        DifficultyLevel.NORMAL
      );
    });

    it('quit path (recordEnd false, null) still records map score (H7: always computed)', () => {
      // H7 removed the skip-on-null shortcut: scoreBreakdown is always computed from
      // GameStateService, so recordMapScore is always called when mapId is present.
      // A pre-wave quit produces score=0, stars=0 (isVictory=false).
      mapBridgeSpy.getMapId.and.returnValue('map_01');

      service.recordEnd(false, null);

      expect(playerProfileSpy.recordMapScore).toHaveBeenCalledOnceWith(
        'map_01',
        0,           // score=0
        0,           // stars=0 on defeat/quit
        DifficultyLevel.NORMAL
      );
    });

    it('skips recordMapScore when mapId is null', () => {
      mapBridgeSpy.getMapId.and.returnValue(null);

      service.recordEnd(false, FAKE_DEFEAT_BREAKDOWN);

      expect(playerProfileSpy.recordMapScore).not.toHaveBeenCalled();
    });

    it('defeat records score with stars=0 (computed from GameStateService on defeat)', () => {
      // H7: scoreBreakdown is always computed — FAKE_DEFEAT_BREAKDOWN is ignored.
      // With fresh state (score=0, lives=20, difficulty=NORMAL, wave=0, isVictory=false):
      // finalScore=0, stars=0.
      mapBridgeSpy.getMapId.and.returnValue('map_01');

      service.recordEnd(false, FAKE_DEFEAT_BREAKDOWN);

      expect(playerProfileSpy.recordMapScore).toHaveBeenCalledOnceWith(
        'map_01',
        0,           // computed finalScore=0
        0,           // stars=0 on defeat
        DifficultyLevel.NORMAL
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Achievement toasts
  // ---------------------------------------------------------------------------

  describe('achievement toasts', () => {
    it('fires achievement toast for each newly unlocked achievement', () => {
      const achId = ACHIEVEMENTS[0]?.id ?? 'first_blood';
      playerProfileSpy.recordGameEnd.and.returnValue([achId]);

      service.recordEnd(true, null);

      expect(audioSpy.playAchievementSound).toHaveBeenCalled();
      expect(notificationSpy.show).toHaveBeenCalledWith(
        NotificationType.ACHIEVEMENT,
        'Achievement Unlocked!',
        jasmine.any(String)
      );
    });

    it('does not fire achievement toast when no achievements unlocked', () => {
      playerProfileSpy.recordGameEnd.and.returnValue([]);

      service.recordEnd(true, null);

      expect(audioSpy.playAchievementSound).not.toHaveBeenCalled();
      expect(notificationSpy.show).not.toHaveBeenCalled();
    });

    it('returns newly unlocked achievement IDs in result', () => {
      const achIds = ['first_blood', 'speed_run'];
      playerProfileSpy.recordGameEnd.and.returnValue(achIds);

      const result = service.recordEnd(true, null);

      expect(result.newlyUnlockedAchievements).toEqual(achIds);
    });
  });

});

