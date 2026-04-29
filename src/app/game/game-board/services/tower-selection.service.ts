import { Injectable } from '@angular/core';
import {
  TowerType,
  TowerSpecialization,
  PlacedTower,
  MAX_TOWER_LEVEL,
  getUpgradeCost,
  getEffectiveStats,
} from '../models/tower.model';
import { StatusEffectType } from '../constants/status-effect.constants';
import { TowerCombatService } from './tower-combat.service';
import { GameStateService } from './game-state.service';
import { RangeVisualizationService } from './range-visualization.service';
import { TileHighlightService } from './tile-highlight.service';
import { GameBoardService } from '../game-board.service';
import { SceneService } from './scene.service';
import { RelicService } from '../../../run/services/relic.service';
import { Optional } from '@angular/core';

/**
 * Manages tower inspection / selection panel state.
 *
 * Responsible for:
 * - Tracking which placed tower is currently selected
 * - Computing the info panel fields (stats, upgrade cost, sell value, spec options)
 * - Showing / removing the range ring via RangeVisualizationService
 * - Cycling targeting mode
 *
 * All public fields are read directly by the component template.
 */
@Injectable()
export class TowerSelectionService {
  selectedTowerInfo: PlacedTower | null = null;
  selectedTowerStats: { damage: number; range: number; statusEffect?: StatusEffectType } | null = null;
  selectedTowerUpgradeCost = 0;
  /** Strategic tile premium % applied to the upgrade cost (0 = no premium). */
  selectedTowerUpgradePercent = 0;
  selectedTowerSellValue = 0;
  /** Preview of stats after upgrading (null if at max level or below L2→L3 which needs spec). */
  upgradePreview: { damage: number; range: number } | null = null;
  showSpecializationChoice = false;
  specOptions: { spec: TowerSpecialization; label: string; description: string; damage: number; range: number }[] = [];
  sellConfirmPending = false;

  constructor(
    private towerCombatService: TowerCombatService,
    private gameStateService: GameStateService,
    private rangeVisualizationService: RangeVisualizationService,
    private gameBoardService: GameBoardService,
    private sceneService: SceneService,
    private relicService: RelicService,
    /**
     * UX-6: optional so flat test beds without a registry/highlight wired
     * still construct. Production wires it via GameBoardComponent.providers.
     */
    @Optional() private tileHighlightService?: TileHighlightService,
  ) {}

  /**
   * Select (or toggle off) a placed tower by its combat-service key.
   * Exits PLACE mode by calling the provided `onCancelPlacement` callback.
   */
  selectPlacedTower(key: string, onCancelPlacement: () => void): void {
    // Toggle: clicking the same tower deselects it
    if (this.selectedTowerInfo?.id === key) {
      this.deselectTower();
      return;
    }

    const tower = this.towerCombatService.getTower(key);
    if (!tower) return;

    // Exit PLACE mode when selecting a placed tower (enter INSPECT mode)
    onCancelPlacement();

    this.selectedTowerInfo = tower;
    this.refreshTowerInfoPanel();
    this.rangeVisualizationService.showForTower(
      tower,
      this.gameBoardService.getBoardWidth(),
      this.gameBoardService.getBoardHeight(),
      this.gameBoardService.getTileSize(),
      this.sceneService.getScene()
    );
    // UX-6: highlight the tile under the selected tower so the click feels
    // confirmed beyond the white selection ring + range ring above it.
    this.tileHighlightService?.applySelectionByCoord(tower.row, tower.col);
  }

  /** Recompute and refresh all info-panel display fields from the currently selected tower. */
  refreshTowerInfoPanel(): void {
    if (!this.selectedTowerInfo) return;
    const tower = this.selectedTowerInfo;
    const stats = getEffectiveStats(tower.type, tower.level, tower.specialization);
    this.selectedTowerStats = { damage: stats.damage, range: stats.range, statusEffect: stats.statusEffect };
    const costMult = this.gameStateService.getModifierEffects().towerCostMultiplier ?? 1;
    this.selectedTowerUpgradeCost = getUpgradeCost(tower.type, tower.level, costMult);
    this.selectedTowerUpgradePercent = 0;
    // Use relic-aware rate so the preview matches what TowerInteractionService.sellTower() pays out.
    this.selectedTowerSellValue = Math.round(tower.totalInvested * this.relicService.getSellRefundRate());

    // Compute upgrade preview (L1→L2 only; L2→L3 requires spec choice so preview is per-spec)
    if (tower.level < MAX_TOWER_LEVEL - 1) {
      const nextStats = getEffectiveStats(tower.type, tower.level + 1);
      this.upgradePreview = { damage: nextStats.damage, range: nextStats.range };
    } else {
      this.upgradePreview = null;
    }
  }

  /** Clear all selection state and remove the range preview ring from the scene. */
  deselectTower(): void {
    const prev = this.selectedTowerInfo;
    this.selectedTowerInfo = null;
    this.selectedTowerStats = null;
    this.upgradePreview = null;
    this.selectedTowerUpgradePercent = 0;
    this.sellConfirmPending = false;
    this.showSpecializationChoice = false;
    this.specOptions = [];
    this.rangeVisualizationService.removePreview(this.sceneService.getScene());
    // UX-6: clear the tile selection tint that applySelectionByCoord set
    // on the previously-selected tower's tile.
    if (prev) {
      this.tileHighlightService?.restoreSelectionByCoord(prev.row, prev.col);
    }
  }

  /**
   * Cycle the targeting mode of the currently selected tower.
   * No-op when no tower is selected or the tower is type SLOW.
   */
  cycleTargeting(): void {
    if (!this.selectedTowerInfo) return;
    // Slow towers don't support targeting mode cycling (utility-only, no projectiles)
    if (this.selectedTowerInfo.type === TowerType.SLOW) return;
    this.towerCombatService.cycleTargetingMode(this.selectedTowerInfo.id);
  }
}
