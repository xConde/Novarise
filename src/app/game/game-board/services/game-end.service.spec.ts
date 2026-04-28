import { TestBed } from '@angular/core/testing';
import { GameEndService } from './game-end.service';
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
import { ChallengeType } from '../../../run/data/challenges';

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
      service.recordEnd(false);
      expect(service.isRecorded()).toBeTrue();
    });

    it('second recordEnd() returns empty result without re-recording', () => {
      service.recordEnd(false);
      playerProfileSpy.recordGameEnd.calls.reset();

      const result = service.recordEnd(false);

      expect(playerProfileSpy.recordGameEnd).not.toHaveBeenCalled();
      expect(result.newlyUnlockedAchievements).toEqual([]);
    });

    it('reset() clears recorded state so next recordEnd() fires again', () => {
      service.recordEnd(false);
      playerProfileSpy.recordGameEnd.calls.reset();
      service.reset();

      service.recordEnd(false);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledTimes(1);
    });

    it('reset() also clears hasSpecializationBeenUsed', () => {
      service.recordSpecialization();
      service.reset();

      service.recordEnd(true);

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
      service.recordEnd(true);
      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ isVictory: true })
      );
    });

    it('passes isVictory=false correctly', () => {
      service.recordEnd(false);
      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ isVictory: false })
      );
    });

    it('includes towerKills from GameStatsService', () => {
      gameStatsService.recordKill(TowerType.SNIPER);
      gameStatsService.recordKill(TowerType.SNIPER);

      service.recordEnd(true);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ towerKills: jasmine.objectContaining({ sniper: 2 }) })
      );
    });

    it('usedSpecialization is false before recordSpecialization()', () => {
      service.recordEnd(true);
      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ usedSpecialization: false })
      );
    });

    it('usedSpecialization is true after recordSpecialization()', () => {
      service.recordSpecialization();
      service.recordEnd(true);
      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ usedSpecialization: true })
      );
    });

    it('placedAllTowerTypes is false when fewer than 6 types used', () => {
      challengeTrackingService.recordTowerPlaced(TowerType.BASIC, 100);
      challengeTrackingService.recordTowerPlaced(TowerType.SNIPER, 150);

      service.recordEnd(true);

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

      service.recordEnd(true);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ placedAllTowerTypes: true })
      );
    });

    it('slowEffectsApplied comes from StatusEffectService.getSlowApplicationCount()', () => {
      statusEffectSpy.getSlowApplicationCount.and.returnValue(7);

      service.recordEnd(true);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ slowEffectsApplied: 7 })
      );
    });

    it('livesLost derives from state.initialLives so relic-raised lives are honored', () => {
      // IRON_HEART relic raises initialLives to 25 above NORMAL's 20 default.
      // At 20 lives remaining, the player actually took 5 damage. Deriving from
      // DIFFICULTY_PRESETS would report livesLost = 0 (wrongly triggering "Flawless").
      gameStateService.setInitialLives(20, 25);
      // setInitialLives sets both current lives and initialLives; knock off 5.
      for (let i = 0; i < 5; i++) gameStateService.loseLife();

      service.recordEnd(false);

      expect(playerProfileSpy.recordGameEnd).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ livesLost: 5 })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Map score recording
  // ---------------------------------------------------------------------------

  describe('map score recording', () => {
    it('records map score when mapId is present (always computed from GameStateService)', () => {
      // H7: recordEnd always computes scoreBreakdown from GameStateService. With a fresh
      // GameStateService (score=0, lives=20, difficulty=NORMAL, wave=0, victory=true) the
      // computed breakdown is: finalScore=0, stars=3 (full lives), difficulty=NORMAL.
      mapBridgeSpy.getMapId.and.returnValue('map_01');

      service.recordEnd(true);

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

      service.recordEnd(false);

      expect(playerProfileSpy.recordMapScore).toHaveBeenCalledOnceWith(
        'map_01',
        0,           // score=0
        0,           // stars=0 on defeat/quit
        DifficultyLevel.NORMAL
      );
    });

    it('skips recordMapScore when mapId is null', () => {
      mapBridgeSpy.getMapId.and.returnValue(null);

      service.recordEnd(false);

      expect(playerProfileSpy.recordMapScore).not.toHaveBeenCalled();
    });

    it('defeat records score with stars=0 (computed from GameStateService on defeat)', () => {
      // H7: scoreBreakdown is always computed — FAKE_DEFEAT_BREAKDOWN is ignored.
      // With fresh state (score=0, lives=20, difficulty=NORMAL, wave=0, isVictory=false):
      // finalScore=0, stars=0.
      mapBridgeSpy.getMapId.and.returnValue('map_01');

      service.recordEnd(false);

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

      service.recordEnd(true);

      expect(audioSpy.playAchievementSound).toHaveBeenCalled();
      expect(notificationSpy.show).toHaveBeenCalledWith(
        NotificationType.ACHIEVEMENT,
        'Achievement Unlocked!',
        jasmine.any(String)
      );
    });

    it('does not fire achievement toast when no achievements unlocked', () => {
      playerProfileSpy.recordGameEnd.and.returnValue([]);

      service.recordEnd(true);

      expect(audioSpy.playAchievementSound).not.toHaveBeenCalled();
      expect(notificationSpy.show).not.toHaveBeenCalled();
    });

    it('returns newly unlocked achievement IDs in result', () => {
      const achIds = ['first_blood', 'speed_run'];
      playerProfileSpy.recordGameEnd.and.returnValue(achIds);

      const result = service.recordEnd(true);

      expect(result.newlyUnlockedAchievements).toEqual(achIds);
    });
  });

  // ---------------------------------------------------------------------------
  // Challenge evaluation
  // ---------------------------------------------------------------------------

  describe('challenge evaluation', () => {
    beforeEach(() => {
      // Default: campaign_01 map — has UNTOUCHABLE + TOWER_LIMIT(≤4)
      mapBridgeSpy.getMapId.and.returnValue('campaign_01');
    });

    it('victory on campaign map with all challenges satisfied returns completedChallenges', () => {
      // UNTOUCHABLE: lives intact (no lives lost on fresh state)
      // TOWER_LIMIT(≤4): place 2 towers
      challengeTrackingService.recordTowerPlaced(TowerType.BASIC, 100);
      challengeTrackingService.recordTowerPlaced(TowerType.BASIC, 100);

      const result = service.recordEnd(true);

      expect(result.completedChallenges.length).toBe(2);
      expect(audioSpy.playChallengeSound).toHaveBeenCalledTimes(2);
      expect(notificationSpy.show).toHaveBeenCalledTimes(2);
      notificationSpy.show.calls.all().forEach(call => {
        expect(call.args[0]).toBe(NotificationType.CHALLENGE);
        // Title is "Challenge: <name>"; body is the challenge description.
        // (Avoids the "+N pts" currency lie — the scoreBonus is pre-pivot score,
        // not run-mode gold. R4 translates scoreBonus → gold at reward time.)
        expect(call.args[1] as string).toMatch(/^Challenge: /);
      });
    });

    it('victory with no satisfiable challenges returns empty completedChallenges', () => {
      // Fail UNTOUCHABLE by losing a life, fail TOWER_LIMIT by placing 5 towers
      for (let i = 0; i < 5; i++) {
        challengeTrackingService.recordTowerPlaced(TowerType.BASIC, 100);
      }
      // Simulate a life lost by mutating game state directly via service
      gameStateService.loseLife();

      const result = service.recordEnd(true);

      expect(result.completedChallenges).toEqual([]);
      expect(audioSpy.playChallengeSound).not.toHaveBeenCalled();
      expect(notificationSpy.show).not.toHaveBeenCalled();
    });

    it('victory on non-campaign map returns empty completedChallenges with no side effects', () => {
      mapBridgeSpy.getMapId.and.returnValue('custom_user_map');

      const result = service.recordEnd(true);

      expect(result.completedChallenges).toEqual([]);
      expect(audioSpy.playChallengeSound).not.toHaveBeenCalled();
      expect(notificationSpy.show).not.toHaveBeenCalled();
    });

    it('victory with no mapId returns empty completedChallenges', () => {
      mapBridgeSpy.getMapId.and.returnValue(null);

      const result = service.recordEnd(true);

      expect(result.completedChallenges).toEqual([]);
      expect(audioSpy.playChallengeSound).not.toHaveBeenCalled();
    });

    it('defeat returns empty completedChallenges regardless of state', () => {
      // All challenges would pass on victory — but this is a defeat
      const result = service.recordEnd(false);

      expect(result.completedChallenges).toEqual([]);
      expect(audioSpy.playChallengeSound).not.toHaveBeenCalled();
      expect(notificationSpy.show).not.toHaveBeenCalled();
    });

    it('idempotency: second recordEnd() returns empty completedChallenges without firing side effects again', () => {
      // First call completes challenges
      const first = service.recordEnd(true);
      expect(first.completedChallenges.length).toBeGreaterThan(0);

      audioSpy.playChallengeSound.calls.reset();
      notificationSpy.show.calls.reset();

      const second = service.recordEnd(true);

      expect(second.completedChallenges).toEqual([]);
      expect(audioSpy.playChallengeSound).not.toHaveBeenCalled();
      expect(notificationSpy.show).not.toHaveBeenCalled();
    });

    it('mixed result: UNTOUCHABLE passes, TOWER_LIMIT fails when 10 towers placed', () => {
      for (let i = 0; i < 10; i++) {
        challengeTrackingService.recordTowerPlaced(TowerType.BASIC, 50);
      }
      // lives intact — UNTOUCHABLE should pass

      const result = service.recordEnd(true);

      expect(result.completedChallenges.length).toBe(1);
      expect(result.completedChallenges[0].type).toBe(ChallengeType.UNTOUCHABLE);
    });

    it('campaign_02: NO_SLOW and SPEED_RUN both complete when within turn budget', () => {
      // campaign_02 has NO_SLOW + SPEED_RUN (turnLimit: 10).
      mapBridgeSpy.getMapId.and.returnValue('campaign_02');
      // towerTypesUsed has no 'slow' — NO_SLOW should pass
      challengeTrackingService.recordTowerPlaced(TowerType.BASIC, 100);

      // Pass turnsUsed = 8 → SPEED_RUN passes too.
      const result = service.recordEnd(true, 8);

      expect(result.completedChallenges.length).toBe(2);
      const types = result.completedChallenges.map(c => c.type).sort();
      expect(types).toEqual([ChallengeType.NO_SLOW, ChallengeType.SPEED_RUN].sort());
    });

    it('campaign_02: SPEED_RUN fails when turn budget exceeded', () => {
      mapBridgeSpy.getMapId.and.returnValue('campaign_02');
      challengeTrackingService.recordTowerPlaced(TowerType.BASIC, 100);

      // 11 turns > campaign_02's turnLimit of 10 → only NO_SLOW passes.
      const result = service.recordEnd(true, 11);

      expect(result.completedChallenges.length).toBe(1);
      expect(result.completedChallenges[0].type).toBe(ChallengeType.NO_SLOW);
    });
  });

});

