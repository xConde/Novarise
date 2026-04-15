import { Injectable } from '@angular/core';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { GameStateService } from './game-state.service';
import { CombatLoopService } from './combat-loop.service';
import { DIFFICULTY_PRESETS } from '../models/game-state.model';
import { TowerType } from '../models/tower.model';
import { ChallengeDefinition, ChallengeType, getChallengesForLevel } from '../../../run/data/challenges';
import { ChallengeIndicator } from '../components/game-hud/game-hud.component';

/**
 * Builds and maintains the live challenge progress badges shown in the HUD
 * during campaign games. Extracted from GameBoardComponent (Hardening VIII S14).
 *
 * SPEED_RUN now shows a live turns-used/turn-limit badge (retargeted from
 * wall-clock to turn-based after the pivot).
 */
@Injectable()
export class ChallengeDisplayService {
  /** Live challenge progress badges. Bound directly in the template. */
  indicators: ChallengeIndicator[] = [];

  constructor(
    private challengeTrackingService: ChallengeTrackingService,
    private gameStateService: GameStateService,
    private combatLoopService: CombatLoopService,
  ) {}

  /**
   * Recompute challenge progress badges for a campaign level.
   * Clears the array for non-campaign contexts or levels with no eligible challenges.
   *
   * @param campaignLevelId The current campaign level ID, or null for non-campaign games.
   */
  updateIndicators(campaignLevelId: string | null): ChallengeIndicator[] {
    if (!campaignLevelId) {
      this.indicators = [];
      return this.indicators;
    }

    const challenges = getChallengesForLevel(campaignLevelId);
    if (challenges.length === 0) {
      this.indicators = [];
      return this.indicators;
    }

    const snapshot = this.challengeTrackingService.getSnapshot();
    const state = this.gameStateService.getState();
    const initialLives = DIFFICULTY_PRESETS[state.difficulty].lives;

    this.indicators = challenges.map(c => this.buildIndicator(c, snapshot, initialLives));
    return this.indicators;
  }

  // --- Private ---

  private buildIndicator(
    challenge: ChallengeDefinition,
    snapshot: { totalGoldSpent: number; maxTowersPlaced: number; towerTypesUsed: Set<string> },
    initialLives: number,
  ): ChallengeIndicator {
    const state = this.gameStateService.getState();

    switch (challenge.type) {
      case ChallengeType.UNTOUCHABLE: {
        const passing = state.lives >= initialLives;
        return { label: 'No Damage', value: passing ? '✓' : '✗', passing };
      }
      case ChallengeType.TOWER_LIMIT: {
        const limit = challenge.towerLimit ?? 0;
        const current = snapshot.maxTowersPlaced;
        const passing = current <= limit;
        return { label: 'Towers', value: `${current}/${limit}`, passing };
      }
      case ChallengeType.FRUGAL: {
        const limit = challenge.goldLimit ?? 0;
        const spent = snapshot.totalGoldSpent;
        const passing = spent <= limit;
        return { label: 'Spent', value: `${spent}g/${limit}g`, passing };
      }
      case ChallengeType.SINGLE_TYPE: {
        // Strict: exactly one tower type used. 0-tower states do not qualify
        // (consistent with evaluateChallenges in challenges.ts). The HUD badge
        // shows '✓' only when the specialist condition is actively met.
        const count = snapshot.towerTypesUsed.size;
        const passing = count === 1;
        return { label: 'Single Type', value: passing ? '✓' : `${count} types`, passing };
      }
      case ChallengeType.NO_SLOW: {
        const passing = !snapshot.towerTypesUsed.has(TowerType.SLOW);
        return { label: 'No Slow', value: passing ? '✓' : '✗', passing };
      }
      case ChallengeType.SPEED_RUN: {
        const limit = challenge.turnLimit ?? 0;
        const used = this.combatLoopService.getTurnNumber();
        // Still passing if the player is within budget — once used > limit the
        // badge flips to failed and will never recover.
        const passing = used <= limit;
        return { label: 'Turns', value: `${used}/${limit}`, passing };
      }
      default:
        return { label: 'Challenge', value: '?', passing: true };
    }
  }
}
