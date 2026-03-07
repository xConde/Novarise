export const CHAIN_LIGHTNING_CONFIG = {
  damageFalloff: 0.7,
  arcLifetime: 0.15,
  arcHeightOffset: 0.5,
  /** Number of zigzag segments per arc */
  zigzagSegments: 6,
  /** Maximum perpendicular offset for zigzag jitter */
  zigzagJitter: 0.25,
} as const;

export const IMPACT_FLASH_CONFIG = {
  radius: 0.15,
  segments: 8,
  color: 0xffffff,
  opacity: 0.9,
  lifetime: 0.08,
  spawnHeight: 0.5,
} as const;

export const MORTAR_VISUAL_CONFIG = {
  zoneColor: 0xff4400,
  zoneOpacity: 0.4,
  zoneSegments: 32,
  tickInterval: 1.0,
} as const;

export const GROUND_EFFECT_Y = 0.05;
