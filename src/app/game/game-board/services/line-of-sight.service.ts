import { Injectable } from '@angular/core';

import { GameBoardService } from '../game-board.service';
import { ElevationService } from './elevation.service';
import { BOARD_CONFIG } from '../constants/board.constants';
import { gridToWorld, worldToGrid, isInBounds } from '../utils/coordinate-utils';

/**
 * Geometric line-of-sight service for the Highground archetype.
 *
 * Implements a DDA raycast through the 2D elevation grid to determine whether a
 * tower can see an enemy without an intervening tile blocking the ray.
 *
 * ## Design contract (elevation-model.md §12)
 * - Component-scoped (NOT providedIn: 'root') — registered in GameModule.
 * - No caching. Tower positions are static per turn but enemies move continuously.
 *   A per-fire-tick cache is possible but premature.
 * - MORTAR bypasses isVisible — AOE arc weapon does not need direct LOS.
 * - No SpatialGrid changes. LOS is narrow-phase, separate from the broad-phase grid.
 * - No Math.random. Pure deterministic geometry.
 * - No Three.js resources — no ngOnDestroy needed.
 *
 * ## Algorithm
 * DDA integer grid walk from tower tile to enemy tile.
 * For each interior tile (excluding both endpoints):
 *   rayY = lerp(towerY, enemyY, t)  — linear interpolation at that tile's center
 *   tileTopY = tileElevation + tileHeight
 *   if tileTopY > rayY → occluded
 * O(√(Δrow² + Δcol²)) per query. At max tower range ~6 tiles: ~6 checks per call.
 * Performance budget: 30 enemies × 20 towers = 600 queries/frame → well under 1 ms.
 */
@Injectable()
export class LineOfSightService {
  constructor(
    private readonly gameBoardService: GameBoardService,
    private readonly elevationService: ElevationService,
  ) {}

  /**
   * Returns true if the tower at (towerRow, towerCol) has clear LOS to the enemy
   * at world position (enemyX, enemyZ).
   *
   * Uses DDA to rasterize the XZ line between tower tile and enemy tile, checking
   * whether any interior tile's top surface exceeds the ray's height at that point.
   *
   * Edge cases (all defensive — do not block fire on invalid state):
   *   - Same tile: true (no interior cells)
   *   - Adjacent tiles: true (no interior cells)
   *   - Enemy resolves outside board bounds: true (let distance check handle it)
   *   - All tiles at elevation 0: always true (tileTopY = tileHeight ≈ 0.2, ray
   *     passes above at equal height at endpoints; tileTopY is never > towerY)
   */
  isVisible(
    towerRow: number,
    towerCol: number,
    enemyX: number,
    enemyZ: number,
  ): boolean {
    const boardWidth = this.gameBoardService.getBoardWidth();
    const boardHeight = this.gameBoardService.getBoardHeight();
    const tileSize = this.gameBoardService.getTileSize();
    const tileHeight = BOARD_CONFIG.tileHeight;

    // ── Tower world position and height ──────────────────────────────────────
    const { x: towerWorldX, z: towerWorldZ } = gridToWorld(towerRow, towerCol, boardWidth, boardHeight, tileSize);
    const towerElevation = this.elevationService.getElevation(towerRow, towerCol);
    // Shot-height: fire from the top surface of the tower's tile (barrel offset = 0 for MVP)
    const towerY = towerElevation + tileHeight;

    // ── Enemy tile and height ─────────────────────────────────────────────────
    const enemyGrid = worldToGrid(enemyX, enemyZ, boardWidth, boardHeight, tileSize);
    const enemyRow = Math.max(0, Math.min(boardHeight - 1, enemyGrid.row));
    const enemyCol = Math.max(0, Math.min(boardWidth - 1, enemyGrid.col));

    // Defensive: if enemy resolves exactly outside bounds (before clamping mattered),
    // the original coordinates were invalid — return true and let range check handle it.
    if (!isInBounds(enemyGrid.row, enemyGrid.col, boardHeight, boardWidth)) {
      return true;
    }

    // Ground enemy is treated as standing on the ground surface of their tile.
    const enemyElevation = this.elevationService.getElevation(enemyRow, enemyCol);
    const enemyY = enemyElevation + tileHeight;

    // ── Same or adjacent tile — no interior cells ─────────────────────────────
    const dRow = enemyRow - towerRow;
    const dCol = enemyCol - towerCol;
    const totalSteps = Math.max(Math.abs(dRow), Math.abs(dCol));
    if (totalSteps <= 1) {
      return true;
    }

    // ── DDA walk — check interior tiles only ─────────────────────────────────
    // Walk step-by-step from tower to enemy on the integer grid.
    // For each interior cell, interpolate the ray Y and compare against tile top.
    //
    // t ∈ (0, 1) is the fractional distance from tower to enemy along the ray.
    // We step in Chebyshev increments, visiting each tile at most once.
    // The tile center world position gives us the t parameter via inverse lerp.
    const towerCenterX = towerWorldX;
    const towerCenterZ = towerWorldZ;
    const { x: enemyWorldX, z: enemyWorldZ } = gridToWorld(enemyRow, enemyCol, boardWidth, boardHeight, tileSize);
    const rayDX = enemyWorldX - towerCenterX;
    const rayDZ = enemyWorldZ - towerCenterZ;
    const rayLenSq = rayDX * rayDX + rayDZ * rayDZ;

    // Walk integer grid using DDA:
    // Parameterize by Chebyshev distance step. For each step i ∈ [1, totalSteps-1],
    // compute the interpolated grid position, snap to integer tile, and check.
    // Using normalized t = i / totalSteps gives the fractional distance.
    for (let step = 1; step < totalSteps; step++) {
      const t = step / totalSteps;
      const curRow = Math.round(towerRow + t * dRow);
      const curCol = Math.round(towerCol + t * dCol);

      // Skip endpoints (defensive; rounding should not land on endpoints for interior steps)
      if ((curRow === towerRow && curCol === towerCol) ||
          (curRow === enemyRow && curCol === enemyCol)) {
        continue;
      }

      // Skip out-of-bounds tiles (defensive)
      if (curRow < 0 || curRow >= boardHeight || curCol < 0 || curCol >= boardWidth) {
        continue;
      }

      // Compute t at this tile's XZ center via dot product with ray direction.
      // For a uniform Chebyshev walk this equals step/totalSteps exactly when
      // the diagonal is axis-aligned, and is a good approximation otherwise.
      // Use the more accurate projection for non-degenerate rays.
      let tAtTile: number;
      if (rayLenSq > 0) {
        const { x: tileCenterX, z: tileCenterZ } = gridToWorld(curRow, curCol, boardWidth, boardHeight, tileSize);
        const toCenterX = tileCenterX - towerCenterX;
        const toCenterZ = tileCenterZ - towerCenterZ;
        // t = dot(toCenter, ray) / |ray|²
        tAtTile = (toCenterX * rayDX + toCenterZ * rayDZ) / rayLenSq;
        // Clamp to (0, 1) — interior only
        tAtTile = Math.max(0, Math.min(1, tAtTile));
      } else {
        // Tower and enemy on same world point — no ray to cast
        tAtTile = t;
      }

      // Ray height at this tile center (linear interpolation)
      const rayY = towerY + (enemyY - towerY) * tAtTile;

      // Tile top surface
      const tileElev = this.elevationService.getElevation(curRow, curCol) ?? 0;
      const tileTopY = tileElev + tileHeight;

      // Strict > comparison: tile must strictly exceed ray to block
      // (tiles at the same level as the ray pass — "edge-on" is not blocked)
      if (tileTopY > rayY) {
        return false;
      }
    }

    return true;
  }
}
