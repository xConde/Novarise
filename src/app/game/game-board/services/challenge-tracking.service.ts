import { Injectable } from '@angular/core';
import { TowerType } from '../models/tower.model';
import { SerializableChallengeState } from '../models/encounter-checkpoint.model';

export interface ChallengeSnapshot {
  totalGoldSpent: number;
  maxTowersPlaced: number;
  towerTypesUsed: Set<string>;
}

@Injectable()  // Component-scoped
export class ChallengeTrackingService {
  private totalGoldSpent = 0;
  private maxTowersPlaced = 0;
  private currentTowerCount = 0;
  private towerTypesUsed = new Set<TowerType>();
  private livesLostThisGame = 0;

  recordTowerPlaced(type: TowerType, cost: number): void {
    this.totalGoldSpent += cost;
    this.towerTypesUsed.add(type);
    this.currentTowerCount++;
    this.maxTowersPlaced = Math.max(this.maxTowersPlaced, this.currentTowerCount);
  }

  recordTowerUpgraded(cost: number): void {
    this.totalGoldSpent += cost;
  }

  recordTowerSold(): void {
    this.currentTowerCount = Math.max(0, this.currentTowerCount - 1);
  }

  getSnapshot(): ChallengeSnapshot {
    return {
      totalGoldSpent: this.totalGoldSpent,
      maxTowersPlaced: this.maxTowersPlaced,
      towerTypesUsed: new Set(this.towerTypesUsed),
    };
  }

  getTowerTypesUsed(): ReadonlySet<TowerType> {
    return this.towerTypesUsed;
  }

  recordLifeLost(): void {
    this.livesLostThisGame++;
  }

  reset(): void {
    this.totalGoldSpent = 0;
    this.maxTowersPlaced = 0;
    this.currentTowerCount = 0;
    this.towerTypesUsed.clear();
    this.livesLostThisGame = 0;
  }

  /** Serialize challenge tracking state for checkpoint save. */
  serializeState(): SerializableChallengeState {
    return {
      totalGoldSpent: this.totalGoldSpent,
      maxTowersPlaced: this.maxTowersPlaced,
      towerTypesUsed: [...this.towerTypesUsed],
      currentTowerCount: this.currentTowerCount,
      livesLostThisGame: this.livesLostThisGame,
    };
  }

  /** Restore challenge tracking state from checkpoint. */
  restoreFromCheckpoint(snapshot: SerializableChallengeState): void {
    this.totalGoldSpent = snapshot.totalGoldSpent;
    this.maxTowersPlaced = snapshot.maxTowersPlaced;
    this.towerTypesUsed = new Set(snapshot.towerTypesUsed as TowerType[]);
    this.currentTowerCount = snapshot.currentTowerCount;
    this.livesLostThisGame = snapshot.livesLostThisGame;
  }
}
