import { Injectable } from '@angular/core';
import {
  TowerType,
  TowerSpecialization,
  TOWER_SPECIALIZATIONS,
  MAX_TOWER_LEVEL,
  getUpgradeCost,
  getEffectiveStats,
} from '../models/tower.model';
import { BlockType } from '../models/game-board-tile';
import { GamePhase } from '../models/game-state.model';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { TowerCombatService } from './tower-combat.service';
import { TilePricingService, TilePriceInfo } from './tile-pricing.service';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { GameEndService } from './game-end.service';
import { EnemyService } from './enemy.service';
import { RelicService } from '../../../run/services/relic.service';

export interface PlaceTowerResult {
  success: boolean;
  cost: number;
  towerKey: string;
}

export interface SellTowerResult {
  success: boolean;
  refundAmount: number;
}

export interface UpgradeTowerResult {
  success: boolean;
  cost: number;
  newLevel: number;
  specialization?: TowerSpecialization;
  /** True when L2→L3 spec is required but was not provided — caller must show spec chooser. */
  needsSpecialization?: boolean;
  /** Pre-computed spec options for the chooser UI (only set when needsSpecialization=true). */
  specOptions?: { spec: TowerSpecialization; label: string; description: string; damage: number; range: number }[];
}

/**
 * Encapsulates the business logic for tower placement, selling, and upgrading.
 *
 * This service handles:
 * - Validation (bounds, tile type, path blocking, gold)
 * - State mutation (board tiles, gold, combat registration)
 * - Side effects (enemy repathing, cache invalidation, challenge tracking)
 *
 * It does NOT handle:
 * - Mesh creation/disposal (Three.js visual concern — stays in the component)
 * - Selection ring, range preview, tile highlights (UI state)
 * - showSpecializationChoice, specOptions (UI flow state)
 */
@Injectable()  // Component-scoped
export class TowerInteractionService {
  constructor(
    private gameStateService: GameStateService,
    private gameBoardService: GameBoardService,
    private towerCombatService: TowerCombatService,
    private tilePricingService: TilePricingService,
    private challengeTrackingService: ChallengeTrackingService,
    private gameEndService: GameEndService,
    private enemyService: EnemyService,
    private relicService: RelicService,
  ) {}

  // ---------------------------------------------------------------------------
  // Place
  // ---------------------------------------------------------------------------

  /**
   * Validate and execute tower placement.
   *
   * Checks: terminal phase, bounds, tile type, path blocking, gold.
   * On success: places tower on board, spends gold, registers with combat service,
   * repaths enemies, invalidates pricing cache.
   *
   * Does NOT create the mesh — returns result for the component to handle visuals.
   */
  placeTower(row: number, col: number, type: TowerType): PlaceTowerResult {
    const FAIL: PlaceTowerResult = { success: false, cost: 0, towerKey: '' };

    const phase = this.gameStateService.getState().phase;
    if (phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT) return FAIL;

    if (!this.gameBoardService.canPlaceTower(row, col)) return FAIL;

    const priceInfo = this.getTileCost(row, col, type);
    let effectiveCost = Math.round(priceInfo.cost * this.relicService.getTowerCostMultiplier());

    if (this.relicService.isNextTowerFree()) {
      this.relicService.consumeFreeTower();
      effectiveCost = 0;
    }

    if (!this.gameStateService.canAfford(effectiveCost)) return FAIL;

    if (!this.gameBoardService.placeTower(row, col, type)) return FAIL;

    // Confirm-before-spend: board placement succeeded, now deduct gold
    this.gameStateService.spendGold(effectiveCost);

    const towerKey = `${row}-${col}`;

    // Record challenge metrics BEFORE registering combat (so towerTypesUsed is up-to-date)
    this.challengeTrackingService.recordTowerPlaced(type, effectiveCost);

    // Repath enemies whose path crosses the newly placed tile
    this.enemyService.repathAffectedEnemies(row, col);
    this.tilePricingService.invalidateCache();

    return { success: true, cost: effectiveCost, towerKey };
  }

  /**
   * Whether placing at (row, col) would fail only due to path blocking.
   * Useful so the component can show the path-blocked warning.
   */
  wouldBlockPath(row: number, col: number): boolean {
    const board = this.gameBoardService.getGameBoard();
    const tile = board[row]?.[col];
    return (
      tile != null &&
      tile.type === BlockType.BASE &&
      tile.isPurchasable &&
      tile.towerType === null
    );
  }

  // ---------------------------------------------------------------------------
  // Sell
  // ---------------------------------------------------------------------------

  /**
   * Validate and execute tower sell.
   *
   * Calculates refund from totalInvested, unregisters from combat service, adds gold,
   * removes tile from board, repaths enemies, invalidates pricing cache.
   *
   * Does NOT dispose the mesh — returns result for the component to handle visuals.
   */
  sellTower(towerKey: string): SellTowerResult {
    const FAIL: SellTowerResult = { success: false, refundAmount: 0 };

    const phase = this.gameStateService.getState().phase;
    if (phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT) return FAIL;

    // Confirm-before-refund: unregistration must succeed before adding gold
    const soldTower = this.towerCombatService.unregisterTower(towerKey);
    if (!soldTower) return FAIL;

    const sellRate = this.relicService.getSellRefundRate();
    const refund = Math.round(soldTower.totalInvested * sellRate);
    this.gameStateService.addGold(refund);

    // Remove tile from board state
    this.gameBoardService.removeTower(soldTower.row, soldTower.col);

    this.challengeTrackingService.recordTowerSold();

    // Repath ALL ground enemies — freed tile may open shorter paths
    this.enemyService.repathAffectedEnemies(-1, -1);
    this.tilePricingService.invalidateCache();

    return { success: true, refundAmount: refund };
  }

  // ---------------------------------------------------------------------------
  // Upgrade
  // ---------------------------------------------------------------------------

  /**
   * Validate and execute tower upgrade.
   *
   * For L1→L2: upgrades immediately.
   * For L2→L3: if spec is not provided, returns needsSpecialization=true with specOptions;
   *   if spec is provided, executes the specialization upgrade.
   *
   * Does NOT update the mesh — returns result for the component to handle visuals.
   */
  upgradeTower(towerKey: string, specialization?: TowerSpecialization): UpgradeTowerResult {
    const FAIL: UpgradeTowerResult = { success: false, cost: 0, newLevel: 0 };

    const phase = this.gameStateService.getState().phase;
    if (phase === GamePhase.VICTORY || phase === GamePhase.DEFEAT) return FAIL;

    const tower = this.towerCombatService.getTower(towerKey);
    if (!tower) return FAIL;
    if (tower.level >= MAX_TOWER_LEVEL) return FAIL;

    const costMult = (this.gameStateService.getModifierEffects().towerCostMultiplier ?? 1) * this.relicService.getUpgradeCostMultiplier();
    const tileStrategic = this.tilePricingService.getStrategicValue(tower.row, tower.col);
    const cost = getUpgradeCost(tower.type, tower.level, costMult, tileStrategic);

    if (!this.gameStateService.canAfford(cost)) return FAIL;

    if (tower.level === MAX_TOWER_LEVEL - 1) {
      // L2→L3: requires specialization
      if (!specialization) {
        const specs = TOWER_SPECIALIZATIONS[tower.type];
        const alphaStats = getEffectiveStats(tower.type, MAX_TOWER_LEVEL, TowerSpecialization.ALPHA);
        const betaStats = getEffectiveStats(tower.type, MAX_TOWER_LEVEL, TowerSpecialization.BETA);
        return {
          success: false,
          cost,
          newLevel: tower.level,
          needsSpecialization: true,
          specOptions: [
            {
              spec: TowerSpecialization.ALPHA,
              ...specs[TowerSpecialization.ALPHA],
              damage: alphaStats.damage,
              range: alphaStats.range,
            },
            {
              spec: TowerSpecialization.BETA,
              ...specs[TowerSpecialization.BETA],
              damage: betaStats.damage,
              range: betaStats.range,
            },
          ],
        };
      }

      // Spec provided — execute upgrade
      if (!this.towerCombatService.upgradeTowerWithSpec(towerKey, specialization, cost)) return FAIL;
      this.gameStateService.spendGold(cost);
      this.challengeTrackingService.recordTowerUpgraded(cost);
      this.gameEndService.recordSpecialization();

      return { success: true, cost, newLevel: tower.level + 1, specialization };

    } else {
      // L1→L2: standard upgrade
      if (!this.towerCombatService.upgradeTower(towerKey, cost)) return FAIL;
      this.gameStateService.spendGold(cost);
      this.challengeTrackingService.recordTowerUpgraded(cost);

      return { success: true, cost, newLevel: tower.level + 1 };
    }
  }

  // ---------------------------------------------------------------------------
  // Tile cost
  // ---------------------------------------------------------------------------

  /**
   * Get the strategic cost for placing a tower on a specific tile.
   * Applies modifier cost multiplier and strategic tile premium.
   */
  getTileCost(row: number, col: number, baseType: TowerType): TilePriceInfo {
    const costMult = this.gameStateService.getModifierEffects().towerCostMultiplier ?? 1;
    return this.tilePricingService.getTilePrice(baseType, row, col, costMult);
  }
}
