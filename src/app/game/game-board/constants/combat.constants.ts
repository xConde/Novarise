export const CHAIN_LIGHTNING_CONFIG = {
  damageFalloff: 0.7,
  arcLifetime: 0.15,
  arcHeightOffset: 0.5,
  /** Number of zigzag segments per arc */
  zigzagSegments: 6,
  /** Maximum perpendicular offset for zigzag jitter */
  zigzagJitter: 0.25,
  arcOpacity: 0.85,
} as const;

export const MORTAR_VISUAL_CONFIG = {
  zoneColor: 0xff4400,
  zoneOpacity: 0.4,
  zoneSegments: 32,
  tickInterval: 1.0,
} as const;

export const GROUND_EFFECT_Y = 0.05;
