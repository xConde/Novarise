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
  /**
   * Fraction of a tile's footprint that the box geometry occupies, leaving a
   * thin grid gap. UX-12: tightened 0.95 → 0.97 for a more cohesive board
   * surface. Original 0.95 left a visible 5% gap that read as "gridded UI"
   * rather than "continuous terrain"; 0.97 keeps a 3% gap for grid-line
   * legibility without the gridded-UI feel.
   */
  geometryGapFactor: 0.97,
  base: {
    emissiveIntensity: 0.35,
    metalness: 0.1,
    roughness: 0.7,
  },
  wall: {
    /** UX-36: emissive 0x0a0810 → 0x18121e (slightly more depth, matches
     *  the cool palette). Walls were reading as visual voids on the new
     *  dark board; subtle emissive lift makes them feel like solid
     *  impassable structures, not holes. */
    emissive: 0x18121e,
    /** UX-36: intensity 0.05 → 0.10. Tiny bump — still reads as inert
     *  vs. BASE's 0.35 buildable glow. */
    emissiveIntensity: 0.10,
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
  // Small bump from 0x303848 to compensate for Phase A sRGB pipeline change.
  baseEmissive: 0x363f53,
  envMapIntensity: 0.3,
} as const;
