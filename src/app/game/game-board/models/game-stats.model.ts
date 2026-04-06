import { TowerType } from './tower.model';

export interface GameStats {
  killsByTowerType: Record<TowerType, number>;
  totalDamageDealt: number;
  totalGoldEarned: number;
  enemiesLeaked: number;
  towersBuilt: number;
  towersSold: number;
  shotsFired: number;
}
