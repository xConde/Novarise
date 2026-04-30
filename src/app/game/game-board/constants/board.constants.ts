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
  /**
   * UX-41: walls use a slight overlap (>1) instead of a gap so neighbouring
   * impassable tiles read as a continuous structure. The 0.5% overhang is
   * imperceptible at game-camera distance but eliminates the visible seam
   * lines between connected walls. Top faces share Y so there is no
   * z-fight; side faces only overlap where two walls touch — exactly the
   * faces that would be hidden anyway.
   */
  wallGapFactor: 1.005,
  base: {
    emissiveIntensity: 0.35,
    /** UX-41: 0.1 → 0.2 — pairs with reduced roughness so BASE tile edges
     *  pick up enough rim/key specular for the dark-to-lighter border
     *  treatment. Tile face brightness is unchanged (driven by emissive). */
    metalness: 0.2,
    /** UX-41: 0.7 → 0.55 — at 0.7 the BASE faces were too rough to catch
     *  any specular, so neighbouring tiles read as a continuous purple
     *  sheet. 0.55 keeps a matte feel on the face but lets the top edge
     *  catch the key light, drawing visible borders between tiles. */
    roughness: 0.55,
  },
  wall: {
    /** UX-36: emissive 0x0a0810 → 0x18121e (slightly more depth, matches
     *  the cool palette). Walls were reading as visual voids on the new
     *  dark board; subtle emissive lift makes them feel like solid
     *  impassable structures, not holes. */
    emissive: 0x18121e,
    /** UX-36: intensity 0.05 → 0.10. Tiny bump — still reads as inert
     *  vs. BASE's 0.35 buildable glow.
     *  UX-41: 0.10 → 0.13 — pairs with reduced roughness so wall faces
     *  catch a touch more rim/key light, giving connected walls the
     *  subtle dark-to-light border treatment without distracting glow. */
    emissiveIntensity: 0.13,
    /** UX-41: 0.5 → 0.55 — slight bump amplifies specular highlights along
     *  the top edge where the key light grazes, producing the darker-to-
     *  lighter border without requiring an emissive boost that would read
     *  as "wall is lit from within". */
    metalness: 0.55,
    /** UX-41: 0.95 → 0.78 — high roughness (0.95) killed all specular,
     *  leaving walls as flat dark prisms. 0.78 is still rough (no mirror
     *  highlights) but lets the edges pick up enough specular from the
     *  key/rim lights to create the subtle border lift the user asked for. */
    roughness: 0.78,
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
