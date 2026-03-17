/**
 * Shared coordinate conversion between grid (row/col) and world (x/z) space.
 *
 * Grid origin is top-left. World origin is board center.
 * Formula: worldX = (col - boardWidth/2) * tileSize
 *          worldZ = (row - boardHeight/2) * tileSize
 */

/** Convert grid row/col to world x/z coordinates, centered on the board. */
export function gridToWorld(
  row: number,
  col: number,
  boardWidth: number,
  boardHeight: number,
  tileSize: number
): { x: number; z: number } {
  return {
    x: (col - boardWidth / 2) * tileSize,
    z: (row - boardHeight / 2) * tileSize,
  };
}

/**
 * Like gridToWorld but writes into an existing object instead of allocating.
 * Use in hot paths (e.g., per-enemy per-frame movement) to avoid GC pressure.
 */
export function gridToWorldInto(
  row: number,
  col: number,
  boardWidth: number,
  boardHeight: number,
  tileSize: number,
  out: { x: number; z: number }
): void {
  out.x = (col - boardWidth / 2) * tileSize;
  out.z = (row - boardHeight / 2) * tileSize;
}

/** Convert world x/z back to grid row/col (rounded to nearest tile). */
export function worldToGrid(
  worldX: number,
  worldZ: number,
  boardWidth: number,
  boardHeight: number,
  tileSize: number
): { row: number; col: number } {
  return {
    col: Math.round(worldX / tileSize + boardWidth / 2),
    row: Math.round(worldZ / tileSize + boardHeight / 2),
  };
}
