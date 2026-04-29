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

/**
 * Visual configuration shared across tile mesh creation. Lives next to
 * BOARD_CONFIG because every value here is a render-side detail of how
 * a single tile is presented (geometry, materials, ambient). Values were
 * tuned by eye — group changes here, not in game-board.service.
 */
export const TILE_VISUAL_CONFIG = {
  /** Fraction of a tile's footprint that the box geometry occupies, leaving a thin grid gap. */
  geometryGapFactor: 0.95,
  base: {
    emissiveIntensity: 0.35,
    metalness: 0.1,
    roughness: 0.7,
  },
  wall: {
    // Bumped from 0x0a0810 to match Phase-A sRGB-correct pipeline (see
    // comment in game-board.service.ts colorBase/colorWall — same rationale).
    emissive: 0x14101e,
    emissiveIntensity: 0.05,
    metalness: 0.5,
    roughness: 0.95,
  },
  /** Spawner / Exit / unmarked tile material settings. */
  other: {
    emissiveIntensity: 0.45,
    metalness: 0.1,
    roughness: 0.7,
  },
  /** Emissive color for buildable BASE tiles (dim hint they accept towers). */
  // Bumped from 0x303848 — same Phase-A sRGB-correction rationale.
  baseEmissive: 0x4a5670,
  envMapIntensity: 0.3,
} as const;
