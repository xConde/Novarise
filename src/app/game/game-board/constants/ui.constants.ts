import { TowerType } from '../models/tower.model';

/**
 * Per-tower-type ghost silhouette geometry args and vertical center offset
 * for the tower placement preview.
 *
 * `args` are passed directly to the corresponding Three.js geometry constructor.
 * `yCenter` is the world-space y position that centers the ghost on the tile.
 */
export const PREVIEW_GHOST_CONFIG: Record<string, { type: string; args: number[]; yCenter: number }> = {
  [TowerType.BASIC]:  { type: 'cone',     args: [0.35, 1.3, 6],                                  yCenter: 0.65 },
  [TowerType.SNIPER]: { type: 'cone',     args: [0.25, 1.8, 6],                                  yCenter: 0.9  },
  [TowerType.SPLASH]: { type: 'sphere',   args: [0.4, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2],    yCenter: 0.7  },
  [TowerType.SLOW]:   { type: 'cylinder', args: [0.4, 0.45, 0.6, 12],                            yCenter: 0.3  },
  [TowerType.CHAIN]:  { type: 'cylinder', args: [0.12, 0.2, 1.2, 6],                             yCenter: 0.6  },
  [TowerType.MORTAR]: { type: 'cylinder', args: [0.35, 0.45, 0.7, 8],                            yCenter: 0.35 },
};

export const PREVIEW_GHOST_DEFAULT = { type: 'box', args: [0.6, 1, 0.6], yCenter: 0.5 } as const;

export const HEALTH_BAR_CONFIG = {
  width: 0.5,
  height: 0.06,
  yOffset: 0.2,
  bgColor: 0x333333,
  colorGreen: 0x00ff00,
  colorYellow: 0xffff00,
  colorRed: 0xff0000,
  thresholdHigh: 0.6,
  thresholdLow: 0.3
};

export const PROJECTILE_CONFIG = {
  radius: 0.08,
  segments: 6,
  opacity: 0.9,
  spawnHeight: 0.8,
  mortarRadiusMultiplier: 1.5,
  trailLength: 5,
  trailOpacity: 0.6,
};

export const TOWER_VISUAL_CONFIG = {
  scaleBase: 1.4,
  scaleIncrement: 0.15,
  emissiveBase: 0.7,
  emissiveIncrement: 0.25
};

export const RANGE_PREVIEW_CONFIG = {
  opacity: 0.35,
  yPosition: 0.35,
  ringThickness: 0.05,
  segments: 64,
  allRangesColor: 0x00ff88,
  allRangesOpacityScale: 0.5,
};

/** Selection ring shown around the currently selected placed tower. */
export const SELECTION_RING_CONFIG = {
  radius: 0.55,
  thickness: 0.04,
  segments: 32,
  color: 0xffffff,
  opacity: 0.6,
  yOffset: 0.01,
} as const;

export const TILE_EMISSIVE = {
  base: 0.35,
  wall: 0.05,
  special: 0.4,
  hover: 0.5,
  selected: 0.8,
  /** Default emissive color for BASE tiles (used as fallback in highlight restoration). */
  defaultColor: 0x303848,
  /** Highlight intensity for tiles valid for tower placement (PLACE mode). */
  validPlacement: 0.35,
  /** Emissive color override for valid placement tiles (soft cyan glow). */
  validPlacementColor: 0x00ccaa,
  /** Dimming factor for unaffordable-but-valid tiles in PLACE mode (0-1, lower = dimmer). */
  unaffordableDimming: 0.35,
} as const;

/**
 * Gradient stops for smooth heatmap color interpolation.
 * Each stop is [strategicValue, R, G, B, intensity].
 * Colors are interpolated linearly between stops.
 */
export const HEATMAP_GRADIENT: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0.00, 0x22 / 255, 0xcc / 255, 0x66 / 255, 0.30],  // Green
  [0.15, 0x88 / 255, 0xcc / 255, 0x22 / 255, 0.35],  // Yellow-green
  [0.35, 0xcc / 255, 0xaa / 255, 0x00 / 255, 0.40],  // Gold
  [0.55, 0xdd / 255, 0x66 / 255, 0x00 / 255, 0.45],  // Orange
  [0.75, 0xdd / 255, 0x22 / 255, 0x00 / 255, 0.55],  // Red — cluster-capped max
] as const;

export const SHIELD_VISUAL_CONFIG = {
  color: 0x4488ff,       // Bright blue shield glow
  opacity: 0.35,
  radiusMultiplier: 1.6, // Shield sphere radius relative to enemy size
  segments: 12,
  emissiveIntensity: 0.5
};

export const ENEMY_VISUAL_CONFIG = {
  baseEmissive: 0.3,
  miniSwarmEmissive: 0.4,
  roughness: 0.6,
  metalness: 0.2,
  /** Fallback color used when an enemy type has no configured color. */
  fallbackColor: 0xff0000,
};

export const UI_CONFIG = {
  /** Duration in ms before the "path blocked" warning banner auto-dismisses. */
  pathBlockedDismissMs: 2000,
} as const;
