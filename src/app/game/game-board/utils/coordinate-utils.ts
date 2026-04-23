/**
 * Shared coordinate conversion utilities for Novarise.
 *
 * Coordinate Systems:
 * - Editor: tiles[x][z] where x=column, z=row (column-major)
 * - Game:   board[row][col] (row-major)
 * - World:  {x, y, z} where y=height, x/z map to grid
 * - Conversion: board[row][col] = editor.tiles[col][row]
 *
 * Grid ↔ World:
 *   Grid origin is top-left. World origin is board center.
 *   worldX = (col - boardWidth/2)  * tileSize
 *   worldZ = (row - boardHeight/2) * tileSize
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

/**
 * Euclidean distance between two points on the XZ plane (ignores Y/height).
 * Matches the world-space coordinate convention used throughout the game.
 */
export function dist2d(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Returns true if (row, col) is inside the grid [0, height) × [0, width).
 * Use for all grid-bounds guards; consolidates an 8-site pattern.
 */
export function isInBounds(row: number, col: number, height: number, width: number): boolean {
  return row >= 0 && row < height && col >= 0 && col < width;
}

/**
 * In-place Fisher-Yates shuffle using the provided RNG (for determinism).
 * Mutates the array; does not return.
 */
export function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
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
