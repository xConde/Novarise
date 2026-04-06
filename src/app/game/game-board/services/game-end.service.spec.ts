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
import { CampaignService } from '@campaign/services/campaign.service';
import { ChallengeEvaluatorService } from '@campaign/services/challenge-evaluator.service';
import { TowerType } from '../models/tower.model';
import { GamePhase, DifficultyLevel } from '../models/game-state.model';
import { ScoreBreakdown } from '../models/score.model';
import { ChallengeDefinition, ChallengeType } from '@campaign/models/challenge.model';

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
  let campaignSpy: jasmine.SpyObj<CampaignService>;
  let challengeEvaluatorSpy: jasmine.SpyObj<ChallengeEvaluatorService>;
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

    campaignSpy = jasmine.createSpyObj('CampaignService', [
      'getLevel', 'recordCompletion', 'completeChallenge', 'getNextLevel',
      'isUnlocked', 'getAllLevels', 'getCompletedCount', 'isChallengeCompleted',
    ]);
    campaignSpy.getLevel.and.returnValue(undefined);

    challengeEvaluatorSpy = jasmine.createSpyObj('ChallengeEvaluatorService', ['evaluateChallenges']);
    challengeEvaluatorSpy.evaluateChallenges.and.returnValue([]);

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
        { provide: CampaignService, useValue: campaignSpy },
        { provide: ChallengeEvaluatorService, useValue: challengeEvaluatorSpy },
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
      expect(result.completedChallenges).toEqual([]);
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
    it('records map score when mapId and scoreBreakdown are present', () => {
      mapBridgeSpy.getMapId.and.returnValue('map_01');

      service.recordEnd(true, FAKE_SCORE_BREAKDOWN);

      expect(playerProfileSpy.recordMapScore).toHaveBeenCalledOnceWith(
        'map_01',
        FAKE_SCORE_BREAKDOWN.finalScore,
        FAKE_SCORE_BREAKDOWN.stars,
        FAKE_SCORE_BREAKDOWN.difficulty
      );
    });

    it('skips recordMapScore when scoreBreakdown is null (quit path)', () => {
      mapBridgeSpy.getMapId.and.returnValue('map_01');

      service.recordEnd(false, null);

      expect(playerProfileSpy.recordMapScore).not.toHaveBeenCalled();
    });

    it('skips recordMapScore when mapId is null', () => {
      mapBridgeSpy.getMapId.and.returnValue(null);

      service.recordEnd(false, FAKE_DEFEAT_BREAKDOWN);

      expect(playerProfileSpy.recordMapScore).not.toHaveBeenCalled();
    });

    it('defeat records score with stars=0 (scoreBreakdown.stars already 0 on defeat)', () => {
      mapBridgeSpy.getMapId.and.returnValue('map_01');

      service.recordEnd(false, FAKE_DEFEAT_BREAKDOWN);

      expect(playerProfileSpy.recordMapScore).toHaveBeenCalledOnceWith(
        'map_01',
        FAKE_DEFEAT_BREAKDOWN.finalScore,
        0,
        FAKE_DEFEAT_BREAKDOWN.difficulty
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

  // ---------------------------------------------------------------------------
  // Defeat path — skips challenges
  // ---------------------------------------------------------------------------

  describe('defeat path', () => {
    it('does not evaluate challenges on defeat', () => {
      mapBridgeSpy.getMapId.and.returnValue('campaign_01');
      const fakeLevel = { id: 'campaign_01' } as any;
      campaignSpy.getLevel.and.returnValue(fakeLevel);

      service.recordEnd(false, FAKE_DEFEAT_BREAKDOWN);

      expect(challengeEvaluatorSpy.evaluateChallenges).not.toHaveBeenCalled();
    });

    it('returns empty completedChallenges on defeat', () => {
      const result = service.recordEnd(false, null);
      expect(result.completedChallenges).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Victory path — challenges and campaign completion
  // ---------------------------------------------------------------------------

  describe('victory path — campaign challenges', () => {
    const CAMPAIGN_MAP_ID = 'campaign_01';
    const FAKE_CHALLENGE: ChallengeDefinition = {
      id: 'ch_flawless',
      type: ChallengeType.UNTOUCHABLE,
      name: 'Flawless Victory',
      description: 'Win without losing a life.',
      scoreBonus: 500,
    };

    beforeEach(() => {
      mapBridgeSpy.getMapId.and.returnValue(CAMPAIGN_MAP_ID);
      campaignSpy.getLevel.and.returnValue({ id: CAMPAIGN_MAP_ID } as any);
      gameStateService.setPhase(GamePhase.VICTORY);
    });

    it('evaluates challenges on victory for campaign maps', () => {
      challengeEvaluatorSpy.evaluateChallenges.and.returnValue([]);

      service.recordEnd(true, FAKE_SCORE_BREAKDOWN);

      expect(challengeEvaluatorSpy.evaluateChallenges).toHaveBeenCalledWith(
        CAMPAIGN_MAP_ID,
        jasmine.objectContaining({ livesLost: jasmine.any(Number) })
      );
    });

    it('returns completed challenges in result', () => {
      challengeEvaluatorSpy.evaluateChallenges.and.returnValue([FAKE_CHALLENGE]);

      const result = service.recordEnd(true, FAKE_SCORE_BREAKDOWN);

      expect(result.completedChallenges).toEqual([FAKE_CHALLENGE]);
    });

    it('calls recordChallengeCompleted for each completed challenge', () => {
      const challenges: ChallengeDefinition[] = [FAKE_CHALLENGE, { id: 'ch_2', type: ChallengeType.FRUGAL, name: 'C2', description: '', scoreBonus: 100 }];
      challengeEvaluatorSpy.evaluateChallenges.and.returnValue(challenges);
      campaignSpy.isChallengeCompleted.and.returnValue(false);

      service.recordEnd(true, FAKE_SCORE_BREAKDOWN);

      expect(playerProfileSpy.recordChallengeCompleted).toHaveBeenCalledTimes(2);
    });

    it('does not call recordChallengeCompleted for already-completed challenges', () => {
      const ch2: ChallengeDefinition = { id: 'ch_2', type: ChallengeType.FRUGAL, name: 'C2', description: '', scoreBonus: 100 };
      challengeEvaluatorSpy.evaluateChallenges.and.returnValue([FAKE_CHALLENGE, ch2]);
      // FAKE_CHALLENGE already completed in a previous session, ch2 is new
      campaignSpy.isChallengeCompleted.and.callFake((id: string) => id === FAKE_CHALLENGE.id);

      service.recordEnd(true, FAKE_SCORE_BREAKDOWN);

      expect(playerProfileSpy.recordChallengeCompleted).toHaveBeenCalledTimes(1);
    });

    it('fires challenge toast for each completed challenge', () => {
      challengeEvaluatorSpy.evaluateChallenges.and.returnValue([FAKE_CHALLENGE]);

      service.recordEnd(true, FAKE_SCORE_BREAKDOWN);

      expect(audioSpy.playChallengeSound).toHaveBeenCalled();
      expect(notificationSpy.show).toHaveBeenCalledWith(
        NotificationType.CHALLENGE,
        'Challenge Complete!',
        jasmine.stringContaining(FAKE_CHALLENGE.name)
      );
    });

    it('adds challenge bonus to score', () => {
      challengeEvaluatorSpy.evaluateChallenges.and.returnValue([FAKE_CHALLENGE]);
      spyOn(gameStateService, 'addScore').and.callThrough();

      service.recordEnd(true, FAKE_SCORE_BREAKDOWN);

      expect(gameStateService.addScore).toHaveBeenCalledWith(FAKE_CHALLENGE.scoreBonus);
    });

    it('does not add score when no challenges completed', () => {
      challengeEvaluatorSpy.evaluateChallenges.and.returnValue([]);
      spyOn(gameStateService, 'addScore').and.callThrough();

      service.recordEnd(true, FAKE_SCORE_BREAKDOWN);

      expect(gameStateService.addScore).not.toHaveBeenCalled();
    });

    it('records campaign completion with updated score including challenge bonus', () => {
      challengeEvaluatorSpy.evaluateChallenges.and.returnValue([FAKE_CHALLENGE]);

      service.recordEnd(true, FAKE_SCORE_BREAKDOWN);

      const expectedScore = FAKE_SCORE_BREAKDOWN.finalScore + FAKE_CHALLENGE.scoreBonus;
      expect(campaignSpy.recordCompletion).toHaveBeenCalledWith(
        CAMPAIGN_MAP_ID,
        expectedScore,
        FAKE_SCORE_BREAKDOWN.stars,
        jasmine.any(String)
      );
    });

    it('does not evaluate challenges for non-campaign maps', () => {
      campaignSpy.getLevel.and.returnValue(undefined);

      service.recordEnd(true, FAKE_SCORE_BREAKDOWN);

      expect(challengeEvaluatorSpy.evaluateChallenges).not.toHaveBeenCalled();
    });

    it('does not record campaign completion when not a campaign map', () => {
      campaignSpy.getLevel.and.returnValue(undefined);

      service.recordEnd(true, FAKE_SCORE_BREAKDOWN);

      expect(campaignSpy.recordCompletion).not.toHaveBeenCalled();
    });
  });
});
