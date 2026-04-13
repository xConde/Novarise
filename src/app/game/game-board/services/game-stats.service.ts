import { Injectable } from '@angular/core';
import { TowerType } from '../models/tower.model';
import { GameStats } from '../models/game-stats.model';
import { SerializableGameStats } from '../models/encounter-checkpoint.model';

export { GameStats } from '../models/game-stats.model';

function createEmptyKillsByTowerType(): Record<TowerType, number> {
  return {
    [TowerType.BASIC]: 0,
    [TowerType.SNIPER]: 0,
    [TowerType.SPLASH]: 0,
    [TowerType.SLOW]: 0,
    [TowerType.CHAIN]: 0,
    [TowerType.MORTAR]: 0,
  };
}

@Injectable()
export class GameStatsService {
  private killsByTowerType: Record<TowerType, number> = createEmptyKillsByTowerType();
  private totalDamageDealt = 0;
  private totalGoldEarned = 0;
  private enemiesLeaked = 0;
  private towersBuilt = 0;
  private towersSold = 0;
  private shotsFired = 0;

  recordKill(towerType: TowerType): void {
    this.killsByTowerType[towerType]++;
  }

  recordDamage(amount: number): void {
    this.totalDamageDealt += amount;
  }

  recordGoldEarned(amount: number): void {
    this.totalGoldEarned += amount;
  }

  recordEnemyLeaked(): void {
    this.enemiesLeaked++;
  }

  recordTowerBuilt(): void {
    this.towersBuilt++;
  }

  recordTowerSold(): void {
    this.towersSold++;
  }

  recordShot(): void {
    this.shotsFired++;
  }

  getStats(): GameStats {
    return {
      killsByTowerType: { ...this.killsByTowerType },
      totalDamageDealt: this.totalDamageDealt,
      totalGoldEarned: this.totalGoldEarned,
      enemiesLeaked: this.enemiesLeaked,
      towersBuilt: this.towersBuilt,
      towersSold: this.towersSold,
      shotsFired: this.shotsFired,
    };
  }

  /** Serialize game stats for checkpoint save. */
  serializeState(): SerializableGameStats {
    return {
      totalGoldEarned: this.totalGoldEarned,
      totalDamageDealt: this.totalDamageDealt,
      shotsFired: this.shotsFired,
      killsByTowerType: { ...this.killsByTowerType },
      enemiesLeaked: this.enemiesLeaked,
      towersPlaced: this.towersBuilt,
      towersSold: this.towersSold,
    };
  }

  /** Restore game stats from checkpoint. */
  restoreFromCheckpoint(snapshot: SerializableGameStats): void {
    this.totalGoldEarned = snapshot.totalGoldEarned;
    this.totalDamageDealt = snapshot.totalDamageDealt;
    this.shotsFired = snapshot.shotsFired;
    this.killsByTowerType = { ...snapshot.killsByTowerType } as Record<TowerType, number>;
    this.enemiesLeaked = snapshot.enemiesLeaked;
    this.towersBuilt = snapshot.towersPlaced;
    this.towersSold = snapshot.towersSold;
  }

  reset(): void {
    this.killsByTowerType = createEmptyKillsByTowerType();
    this.totalDamageDealt = 0;
    this.totalGoldEarned = 0;
    this.enemiesLeaked = 0;
    this.towersBuilt = 0;
    this.towersSold = 0;
    this.shotsFired = 0;
  }
}
