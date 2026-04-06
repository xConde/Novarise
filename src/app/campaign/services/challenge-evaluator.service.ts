import { Injectable } from '@angular/core';
import {
  ChallengeDefinition,
  ChallengeType,
  GameEndState,
  getChallengesForLevel,
} from '../models/challenge.model';
import { TowerType } from '../../game/game-board/models/tower.model';
import { assertNever } from '../../game/game-board/utils/assert-never';

@Injectable({ providedIn: 'root' })
export class ChallengeEvaluatorService {
  /**
   * Evaluate which challenges were completed for this game session.
   * Returns only the challenges that passed — call this after a VICTORY.
   */
  evaluateChallenges(levelId: string, gameEndState: GameEndState): ChallengeDefinition[] {
    const challenges = getChallengesForLevel(levelId);
    const completed: ChallengeDefinition[] = [];

    for (const challenge of challenges) {
      if (this.isCompleted(challenge, gameEndState)) {
        completed.push(challenge);
      }
    }
    return completed;
  }

  private isCompleted(challenge: ChallengeDefinition, state: GameEndState): boolean {
    switch (challenge.type) {
      case ChallengeType.NO_SLOW:
        return !state.towerTypesUsed.has(TowerType.SLOW);
      case ChallengeType.SPEED_RUN:
        return state.elapsedTime <= (challenge.timeLimit ?? Infinity);
      case ChallengeType.FRUGAL:
        return state.totalGoldSpent <= (challenge.goldLimit ?? Infinity);
      case ChallengeType.UNTOUCHABLE:
        return state.livesLost === 0;
      case ChallengeType.TOWER_LIMIT:
        return state.maxTowersPlaced <= (challenge.towerLimit ?? Infinity);
      case ChallengeType.SINGLE_TYPE:
        return state.towerTypesUsed.size === 1;
      default:
        assertNever(challenge.type);
    }
  }
}
