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
   * Walls keep a hairline gap so the wall-scoped accent trim plane
   * shows through column seams as the tinted cell structure. Tight
   * enough that walls still read as a connected impassable surface,
   * not as a row of placeable blocks. Horizontal seams stay hidden
   * by wall front-face occlusion at the default camera angle —
   * that's expected; the visible vertical accent lines + emissive-
   * tinted top faces give walls the cell read without exposing the
   * full grid like buildable tiles do.
   */
  wallGapFactor: 0.985,
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
