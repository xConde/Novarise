import { Injectable } from '@angular/core';
import { Enemy, EnemyType, ENEMY_STATS, VEINSEEKER_BOOSTED_TILES_PER_TURN, NOVA_SOVEREIGN_SLOW_RESISTANCE_FACTOR, SLOW_ACCUMULATOR_ACTIVATION_THRESHOLD } from '../models/enemy.model';
import { PlacedTower, getEffectiveStats } from '../models/tower.model';

/**
 * Lower bound for the projected tiles-per-turn rate used in turn-count estimates.
 * Prevents division by zero when combined SLOW reductions reduce the effective rate
 * to zero or below. Small enough not to disturb fractional-rate projections
 * (e.g. 0.85 or 0.5 from card-modifier slows) but large enough to keep
 * Math.ceil(distance / rate) finite and meaningful.
 */
const MIN_PROJECTION_TILES_PER_TURN = 0.01;

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
      // Floor to integer: fractional rates (from card-modifier SLOW) produce
      // non-integer index estimates. Floor gives the conservative "at least this
      // far" position, which matches how the accumulator rounds down in the live engine.
      Math.floor(enemy.pathIndex + tilesToMove * turnsAhead),
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

  /**
   * Projects the total damage this enemy will receive on the NEXT turn's
   * combat resolution, based solely on current tower targeting.
   *
   * Design calls (v1 — do not expand without revisiting the plan doc):
   * - Reads `getTowerTarget(tower)` — same closure that `AimLineService` and
   *   `TowerFireZonePreviewService` use (resolves `userData['currentAimTarget']`).
   * - Per-tower damage = `getEffectiveStats(type, level, spec).damage × 1`.
   *   FIRE_RATE, LINKWORK, QUICK_DRAW, and archetype modifiers are excluded.
   * - SPLASH, CHAIN, and MORTAR secondary/area hits are excluded. Only the
   *   primary-target damage is projected.
   *
   * Pure function: no Angular DI dependencies beyond what the caller passes in.
   *
   * @param enemy           The enemy whose incoming damage is being projected.
   * @param towers          All currently placed towers.
   * @param getTowerTarget  Closure: returns the aim target for a given tower,
   *                        or null if no target is currently resolved.
   */
  projectIncomingDamageNextTurn(
    enemy: Enemy,
    towers: Map<string, PlacedTower>,
    getTowerTarget: (tower: PlacedTower) => Enemy | null,
  ): number {
    let total = 0;
    for (const tower of towers.values()) {
      const target = getTowerTarget(tower);
      if (target !== null && target.id === enemy.id) {
        total += getEffectiveStats(tower.type, tower.level, tower.specialization).damage;
      }
    }
    return total;
  }

  // Mirrors stepEnemiesOneTurn — the canonical movement math.
  // Same precedence as the live engine: VEINSEEKER boost, then NOVA_SOVEREIGN
  // enrage override, then NOVA_SOVEREIGN halved slow reduction, then fractional
  // card-modifier speed reduction, then integer SLOW tile reduction floored at 1.
  //
  // For projection (stateless): returns the fractional effective rate directly.
  // projectTurnsToExit uses Math.ceil(tilesRemaining / rate), which handles
  // fractional rates correctly without simulating the per-enemy accumulator state.
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
    // NOVA_SOVEREIGN enrage: use the per-instance elevated tilesPerTurn.
    if (enemy.type === EnemyType.NOVA_SOVEREIGN && enemy.isEnraged && enemy.enragedTilesPerTurn !== undefined) {
      baseTiles = enemy.enragedTilesPerTurn;
    }
    // NOVA_SOVEREIGN slow resistance: halve the slow tile reduction (round
    // down) — identical math to the live engine so the intent UI does not
    // overpredict SLOW effectiveness against the final boss.
    let effectiveSlowReduction = slowTileReduction;
    if (enemy.type === EnemyType.NOVA_SOVEREIGN && effectiveSlowReduction > 0) {
      effectiveSlowReduction = Math.floor(effectiveSlowReduction * NOVA_SOVEREIGN_SLOW_RESISTANCE_FACTOR);
    }
    // Card-modifier fractional speed reduction — mirrors the accumulator path in
    // the live engine. Return the fractional rate so Math.ceil in projectTurnsToExit
    // produces accurate turn-count estimates (e.g. 85% of 1 tile/turn → ceil(9/0.85) = 11 turns).
    const speedModRate = enemySpeedSlow > 0 ? baseTiles * (1 - enemySpeedSlow) : baseTiles;
    // Apply integer SLOW tile reduction floored at 1 — same guarantee as the live engine.
    const grossRate = speedModRate - effectiveSlowReduction;
    if (grossRate < SLOW_ACCUMULATOR_ACTIVATION_THRESHOLD) {
      // Fractional zone: return the fractional rate directly so callers using
      // Math.ceil get a correct turn estimate without simulating accumulator state.
      // Clamp to MIN_PROJECTION_TILES_PER_TURN so projectTurnsToExit always returns
      // a finite number even when combined reductions exceed the enemy's base speed.
      return Math.max(MIN_PROJECTION_TILES_PER_TURN, grossRate);
    }
    return Math.max(1, grossRate);
  }
}
