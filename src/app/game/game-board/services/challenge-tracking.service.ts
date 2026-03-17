import { Injectable } from '@angular/core';
import { TowerType } from '../models/tower.model';

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

  reset(): void {
    this.totalGoldSpent = 0;
    this.maxTowersPlaced = 0;
    this.currentTowerCount = 0;
    this.towerTypesUsed.clear();
  }
}
