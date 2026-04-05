import { Injectable } from '@angular/core';
import { GameStateService } from './game-state.service';
import { GameStatsService } from './game-stats.service';
import { PlayerProfileService, GameEndStats, ACHIEVEMENTS, TOWER_COLLECTOR_TYPE_COUNT } from '@core/services/player-profile.service';
import { StatusEffectService } from './status-effect.service';
import { GameNotificationService, NotificationType } from './game-notification.service';
import { MapBridgeService } from '@core/services/map-bridge.service';
import { AudioService } from './audio.service';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { CampaignService } from '@campaign/services/campaign.service';
import { ChallengeEvaluatorService } from '@campaign/services/challenge-evaluator.service';
import { ChallengeDefinition } from '@campaign/models/challenge.model';
import { ScoreBreakdown } from '../models/score.model';
import { DIFFICULTY_PRESETS } from '../models/game-state.model';

/** Data returned from recordEnd() for use by the component (display/UI updates). */
export interface GameEndResult {
  newlyUnlockedAchievements: string[];
  completedChallenges: ChallengeDefinition[];
}

/**
 * Centralises the three game-end recording paths (VICTORY, DEFEAT mid-frame, quit).
 *
 * Provided at component scope so it is tied to a single game session.
 * Call reset() in restartGame() to clear state for the next session.
 */
@Injectable()
export class GameEndService {
  private gameEndRecorded = false;
  private hasSpecializationBeenUsed = false;

  constructor(
    private gameStateService: GameStateService,
    private gameStatsService: GameStatsService,
    private playerProfileService: PlayerProfileService,
    private statusEffectService: StatusEffectService,
    private notificationService: GameNotificationService,
    private mapBridge: MapBridgeService,
    private audioService: AudioService,
    private challengeTrackingService: ChallengeTrackingService,
    private campaignService: CampaignService,
    private challengeEvaluatorService: ChallengeEvaluatorService,
  ) {}

  /** Call once when the player confirms a L3 specialization upgrade. */
  recordSpecialization(): void {
    this.hasSpecializationBeenUsed = true;
  }

  /** True once recordEnd() has successfully fired for this session. */
  isRecorded(): boolean {
    return this.gameEndRecorded;
  }

  /**
   * Record game end (victory, defeat, or quit).
   *
   * Idempotent — subsequent calls within the same session return an empty result without
   * re-recording anything.
   *
   * @param isVictory      True for VICTORY, false for DEFEAT or quit.
   * @param scoreBreakdown Score data computed at transition time. Null for quit before first wave.
   */
  recordEnd(isVictory: boolean, scoreBreakdown: ScoreBreakdown | null): GameEndResult {
    if (this.gameEndRecorded) {
      return { newlyUnlockedAchievements: [], completedChallenges: [] };
    }
    this.gameEndRecorded = true;

    // Build GameEndStats from current service state
    const challengeSnapshot = this.challengeTrackingService.getSnapshot();
    const gameEndStats = this.buildGameEndStats(isVictory, challengeSnapshot);

    // Record to player profile — returns IDs of newly unlocked achievements
    const newlyUnlocked = this.playerProfileService.recordGameEnd(gameEndStats);

    // Fire achievement toasts
    for (const achId of newlyUnlocked) {
      const ach = ACHIEVEMENTS.find(a => a.id === achId);
      if (ach) {
        this.audioService.playAchievementSound();
        this.notificationService.show(
          NotificationType.ACHIEVEMENT,
          'Achievement Unlocked!',
          ach.name,
        );
      }
    }

    // Record map score. scoreBreakdown.stars is already 0 when isVictory=false
    // (the score model computes 0 stars on defeat). For quit, scoreBreakdown is null
    // (only computed on entering VICTORY/DEFEAT), so this block is skipped entirely.
    const mapId = this.mapBridge.getMapId();
    if (mapId && scoreBreakdown) {
      this.playerProfileService.recordMapScore(
        mapId,
        scoreBreakdown.finalScore,
        scoreBreakdown.stars,
        scoreBreakdown.difficulty,
      );
    }

    // Campaign-specific: evaluate challenges and record completion (VICTORY on campaign levels only)
    let completedChallenges: ChallengeDefinition[] = [];
    if (isVictory && mapId && this.campaignService.getLevel(mapId)) {
      const endState = this.gameStateService.getState();
      const challengeInput = {
        livesLost: gameEndStats.livesLost,
        elapsedTime: endState.elapsedTime,
        totalGoldSpent: challengeSnapshot.totalGoldSpent,
        maxTowersPlaced: challengeSnapshot.maxTowersPlaced,
        towerTypesUsed: challengeSnapshot.towerTypesUsed,
      };

      const newlyChallenged = this.challengeEvaluatorService.evaluateChallenges(mapId, challengeInput);
      completedChallenges = newlyChallenged;

      let challengeBonus = 0;
      for (const challenge of newlyChallenged) {
        if (!this.campaignService.isChallengeCompleted(challenge.id)) {
          this.playerProfileService.recordChallengeCompleted();
        }
        this.campaignService.completeChallenge(challenge.id);
        challengeBonus += challenge.scoreBonus;
        this.audioService.playChallengeSound();
        this.notificationService.show(
          NotificationType.CHALLENGE,
          'Challenge Complete!',
          `${challenge.name} (+${challenge.scoreBonus} pts)`,
        );
      }

      if (challengeBonus > 0) {
        this.gameStateService.addScore(challengeBonus);
      }

      const updatedScore = (scoreBreakdown?.finalScore ?? 0) + challengeBonus;
      this.campaignService.recordCompletion(
        mapId,
        updatedScore,
        scoreBreakdown?.stars ?? 0,
        endState.difficulty,
      );
    }

    return { newlyUnlockedAchievements: newlyUnlocked, completedChallenges };
  }

  /**
   * Reset session state. Call at the start of restartGame() so the next session
   * can record its own game end.
   */
  reset(): void {
    this.gameEndRecorded = false;
    this.hasSpecializationBeenUsed = false;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildGameEndStats(
    isVictory: boolean,
    snapshot: { towerTypesUsed: Set<string> },
  ): GameEndStats {
    const endState = this.gameStateService.getState();
    const stats = this.gameStatsService.getStats();
    const totalKills = Object.values(stats.killsByTowerType).reduce((a, b) => a + b, 0);
    return {
      isVictory,
      score: endState.score,
      enemiesKilled: totalKills,
      goldEarned: stats.totalGoldEarned,
      wavesCompleted: endState.wave,
      livesLost: DIFFICULTY_PRESETS[endState.difficulty].lives - endState.lives,
      towerKills: stats.killsByTowerType,
      modifierCount: endState.activeModifiers.size,
      usedSpecialization: this.hasSpecializationBeenUsed,
      placedAllTowerTypes: snapshot.towerTypesUsed.size >= TOWER_COLLECTOR_TYPE_COUNT,
      slowEffectsApplied: this.statusEffectService.getSlowApplicationCount(),
    };
  }
}
