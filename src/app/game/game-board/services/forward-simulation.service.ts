import { Injectable } from '@angular/core';
import { Enemy, EnemyType, ENEMY_STATS, VEINSEEKER_BOOSTED_TILES_PER_TURN } from '../models/enemy.model';

/**
 * Pure projection of enemy movement N turns into the future.
 *
 * Mirrors the integer-tile movement math in `EnemyService.stepEnemiesOneTurn`
 * but in side-effect-free form. Used by UI surfaces that need "where will this
 * enemy be" / "when will it leak" answers without mutating live state.
 *
 * Limitations of v1:
 * - Assumes current SLOW / card-modifier / VEINSEEKER-boost state continues for
 *   the entire projection horizon. Status expiry mid-projection is not modelled.
 * - Does not account for tower kills (the player is asking "if I do nothing").
 * - Does not account for path mutations after the call site (the path snapshot
 *   on the enemy is the projected path).
 */
@Injectable()
export class ForwardSimulationService {
  /**
   * Turns until this enemy reaches the last node of its current path.
   * Returns 0 if the enemy is already at or past its exit.
   */
  projectTurnsToExit(
    enemy: Enemy,
    slowTileReduction = 0,
    enemySpeedSlow = 0,
    veinseekerBoosted = false,
  ): number {
    if (enemy.path.length === 0) return 0;
    const tilesRemaining = (enemy.path.length - 1) - enemy.pathIndex;
    if (tilesRemaining <= 0) return 0;

    const tilesToMove = this.tilesPerTurnFor(enemy, slowTileReduction, enemySpeedSlow, veinseekerBoosted);
    return Math.ceil(tilesRemaining / tilesToMove);
  }

  /**
   * Grid position this enemy will occupy after `turnsAhead` turns of movement,
   * clamped to the final path node.
   */
  projectGridPosition(
    enemy: Enemy,
    turnsAhead: number,
    slowTileReduction = 0,
    enemySpeedSlow = 0,
    veinseekerBoosted = false,
  ): { row: number; col: number } {
    if (enemy.path.length === 0) {
      return { row: enemy.gridPosition.row, col: enemy.gridPosition.col };
    }
    const tilesToMove = this.tilesPerTurnFor(enemy, slowTileReduction, enemySpeedSlow, veinseekerBoosted);
    const projectedIndex = Math.min(
      enemy.pathIndex + tilesToMove * turnsAhead,
      enemy.path.length - 1,
    );
    const node = enemy.path[projectedIndex];
    return { row: node.y, col: node.x };
  }

  /**
   * True if the enemy will reach its exit within `turnsAhead` turns at the
   * current movement rate. Drives the "WILL LEAK" threat indicator.
   */
  willLeakWithin(
    enemy: Enemy,
    turnsAhead: number,
    slowTileReduction = 0,
    enemySpeedSlow = 0,
    veinseekerBoosted = false,
  ): boolean {
    const ttx = this.projectTurnsToExit(enemy, slowTileReduction, enemySpeedSlow, veinseekerBoosted);
    return ttx > 0 && ttx <= turnsAhead;
  }

  // Mirrors stepEnemiesOneTurn:373-386 — the canonical movement math.
  // Floor at 1 tile/turn matches the live engine's anti-freeze guarantee.
  private tilesPerTurnFor(
    enemy: Enemy,
    slowTileReduction: number,
    enemySpeedSlow: number,
    veinseekerBoosted: boolean,
  ): number {
    let baseTiles = ENEMY_STATS[enemy.type].tilesPerTurn;
    if (enemy.type === EnemyType.VEINSEEKER && veinseekerBoosted) {
      baseTiles = VEINSEEKER_BOOSTED_TILES_PER_TURN;
    }
    const enemySpeedReduction = enemySpeedSlow > 0 ? Math.floor(baseTiles * enemySpeedSlow) : 0;
    return Math.max(1, baseTiles - slowTileReduction - enemySpeedReduction);
  }
}
