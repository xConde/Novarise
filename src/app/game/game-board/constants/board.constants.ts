export interface BoardConfig {
  width: number;
  height: number;
  tileSize: number;
  tileHeight: number;
}

export const BOARD_CONFIG: BoardConfig = {
  width: 25,
  height: 20,
  tileSize: 1,
  tileHeight: 0.2
};

/** Material properties for the tile meshes rendered on the game board. */
export const TILE_RENDER_CONFIG = {
  /** Gap between adjacent tiles as a fraction of tileSize (< 1 leaves a thin seam). */
  tileGapRatio: 0.95,
  /** Material metalness per tile category. */
  metalness: {
    base: 0.1,
    wall: 0.4,
    special: 0.1,
  },
  /** Material roughness per tile category. */
  roughness: {
    base: 0.75,
    wall: 0.9,
    special: 0.7,
  },
  /** Environment-map reflection intensity. */
  envMapIntensity: 0.3,
  /** Emissive color for subdued tiles (base and wall). */
  subduedEmissive: 0x2a2548,
} as const;

/** Visual config for the grid lines drawn between board tiles. */
export const GRID_LINE_CONFIG = {
  color: 0x7a6a9a,
  opacity: 0.45,
  /** Y world-space height so lines render just above the tile surface. */
  yOffset: 0.01,
} as const;

/** Colors used for each tile type on the default (non-editor) board. */
export const TILE_COLORS = {
  base: 0x3a3a4a,
  spawner: 0x00ffff,
  exit: 0xff00ff,
  wall: 0x2a2540,
  grid: 0x444444,
} as const;
