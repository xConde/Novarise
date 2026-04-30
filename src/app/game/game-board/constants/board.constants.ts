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
 * a single tile is presented (geometry, materials, ambient).
 */
export const TILE_VISUAL_CONFIG = {
  /**
   * Fraction of a tile's footprint that the box geometry occupies. The
   * leftover slice is the dark void between tiles — that void is what
   * draws the visible grout line that separates adjacent tiles. Tuned
   * so the line reads cleanly at the default game camera angle without
   * looking like a gridded UI overlay.
   */
  geometryGapFactor: 0.93,
  /**
   * Walls render as a continuous solid surface; the slight overlap
   * eliminates per-cell seams that would otherwise read as "tiles
   * you can see between" rather than impassable structure. The
   * trim plane is constrained to the non-wall bounding box so this
   * overlap is also what guarantees no bright trim leaks through
   * any wall column gap. Visible cell structure on walls comes
   * from the front-face lighting shadow plus the wall emissive
   * accent, not from gap-based plane bleed.
   */
  wallGapFactor: 1.005,
  base: {
    emissiveIntensity: 0.35,
    /** Slight metalness pairs with the lower roughness to let the top
     *  edges catch a touch of rim/key specular without making the face
     *  read as metal. */
    metalness: 0.2,
    /** Low enough roughness that grazing key/rim light produces a
     *  visible highlight along tile edges; high enough that the face
     *  itself stays matte. */
    roughness: 0.55,
  },
  wall: {
    /** Cool-purple emissive bright enough that the shadowed wall
     *  front faces (the visible "horizontal lines" between wall rows
     *  at the default camera angle) read as tinted structure rather
     *  than pure black void. Without this lift the front-face strips
     *  drop to absolute black and the wall block looks featureless
     *  except for the column seams. */
    emissive: 0x2a2238,
    /** Inert next to BASE's 0.35, but high enough that the front-
     *  face shadows pick up a perceptible accent tint. */
    emissiveIntensity: 0.32,
    /** Paired with the lower roughness to amplify the top-edge
     *  specular into a soft border highlight. */
    metalness: 0.55,
    /** Lower than BASE — walls are intentionally more reflective at
     *  the edges so grazing light produces the dark-to-lighter
     *  border that separates adjacent walls visually. */
    roughness: 0.78,
  },
  /** Spawner / Exit / unmarked tile material settings. */
  other: {
    emissiveIntensity: 0.45,
    metalness: 0.1,
    roughness: 0.7,
  },
  /** Emissive color for buildable BASE tiles (dim hint they accept towers). */
  baseEmissive: 0x363f53,
  envMapIntensity: 0.3,
} as const;
