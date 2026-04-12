import { Injectable } from '@angular/core';
import { GameStateService } from './game-state.service';
import { GameStatsService } from './game-stats.service';
import { PlayerProfileService, GameEndStats, ACHIEVEMENTS, TOWER_COLLECTOR_TYPE_COUNT } from '@core/services/player-profile.service';
import { StatusEffectService } from './status-effect.service';
import { GameNotificationService, NotificationType } from './game-notification.service';
import { MapBridgeService } from '@core/services/map-bridge.service';
import { AudioService } from './audio.service';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { calculateScoreBreakdown, ScoreBreakdown } from '../models/score.model';
import { DIFFICULTY_PRESETS } from '../models/game-state.model';
import { ChallengeDefinition, evaluateChallenges, GameEndState } from '../../../run/data/challenges';

/** Data returned from recordEnd() for use by the component (display/UI updates). */
export interface GameEndResult {
  newlyUnlockedAchievements: string[];
  /**
   * Challenges the player satisfied on this encounter victory (computed by
   * `evaluateChallenges` against the end-of-encounter snapshot). Empty on
   * defeat, quit, non-campaign maps, or when no challenges were met.
   * Consumed by RunService.completeEncounter (Sprint R4) to award gold bonuses.
   */
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
   * Phase H7: scoreBreakdown is COMPUTED here from current GameState. All
   * legacy callers that passed a null/pre-computed scoreBreakdown are now
   * tolerated via a legacy second parameter that is IGNORED — the service
   * always computes. A pre-wave quit (wave=0, score=0) still produces a
   * valid (zeroed) scoreBreakdown that recordMapScore handles correctly.
   *
   * @param isVictory True for VICTORY, false for DEFEAT or quit.
   * @param _legacyScoreBreakdown Ignored — kept for call-site compatibility.
   */
  recordEnd(isVictory: boolean, _legacyScoreBreakdown?: ScoreBreakdown | null): GameEndResult {
    if (this.gameEndRecorded) {
      return { newlyUnlockedAchievements: [], completedChallenges: [] };
    }
    this.gameEndRecorded = true;

    // H7: compute scoreBreakdown from current state — never trust the caller.
    const state = this.gameStateService.getState();
    const scoreBreakdown: ScoreBreakdown = calculateScoreBreakdown(
      state.score,
      state.lives,
      DIFFICULTY_PRESETS[state.difficulty].lives,
      state.difficulty,
      state.wave,
      isVictory,
      this.gameStateService.getModifierScoreMultiplier(),
    );

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

    // Record map score. scoreBreakdown is always non-null after H7.
    // scoreBreakdown.stars is 0 on defeat (per the score model).
    const mapId = this.mapBridge.getMapId();
    if (mapId) {
      this.playerProfileService.recordMapScore(
        mapId,
        scoreBreakdown.finalScore,
        scoreBreakdown.stars,
        scoreBreakdown.difficulty,
      );
    }

    // Challenge evaluation — only on victory. Defeat and quit never complete challenges.
    // Campaign map check: getChallengesForLevel returns [] for non-campaign maps, so
    // evaluateChallenges() is safe to call unconditionally — it will just return [].
    let completedChallenges: ChallengeDefinition[] = [];
    if (isVictory && mapId) {
      const snapshot = this.challengeTrackingService.getSnapshot();
      const endState = this.gameStateService.getState();
      const gameEndState: GameEndState = {
        livesLost: gameEndStats.livesLost,
        elapsedTime: endState.elapsedTime ?? 0,   // unused by non-SPEED_RUN challenges
        totalGoldSpent: snapshot.totalGoldSpent,
        maxTowersPlaced: snapshot.maxTowersPlaced,
        towerTypesUsed: snapshot.towerTypesUsed,
      };

      completedChallenges = evaluateChallenges(mapId, gameEndState);

      // Side effects: sound + notification per completion. Reward translation
      // (challenge.scoreBonus → run-mode gold) happens later in
      // RunService.generateRewards; this service just emits the list and the
      // immediate player-facing feedback. Notification body uses the challenge
      // description rather than the raw scoreBonus to avoid lying about currency
      // units ("pts" vs. gold).
      for (const challenge of completedChallenges) {
        this.audioService.playChallengeSound();
        this.notificationService.show(
          NotificationType.CHALLENGE,
          `Challenge: ${challenge.name}`,
          challenge.description,
        );
      }
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
