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
  mortarRadiusMultiplier: 1.5
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

export const HOVER_RANGE_PREVIEW_CONFIG = {
  /** Opacity of the hover range ring — more transparent than the placed-tower ring. */
  opacity: 0.15,
  yPosition: 0.02,
};

export const TILE_EMISSIVE = {
  base: 0.15,
  wall: 0.1,
  special: 0.4,
  hover: 0.5,
  selected: 0.8,
};

export const SHIELD_VISUAL_CONFIG = {
  color: 0x4488ff,       // Bright blue shield glow
  opacity: 0.35,
  radiusMultiplier: 1.6, // Shield sphere radius relative to enemy size
  segments: 12,
  emissiveIntensity: 0.5
};

export const ENEMY_VISUAL_CONFIG = {
  shieldedEmissive: 0.3,
  miniSwarmEmissive: 0.4,
  healerEmissive: 0.5,
};

export const HEALER_CROSS_CONFIG = {
  armLength: 0.4,
  armWidth: 0.12,
  armHeight: 0.12,
} as const;
