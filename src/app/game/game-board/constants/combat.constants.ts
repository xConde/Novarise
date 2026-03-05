export const CHAIN_LIGHTNING_CONFIG = {
  damageFalloff: 0.7,
  arcLifetime: 0.1,
  arcHeightOffset: 0.5,
  arcOpacity: 0.85,
} as const;

export const MORTAR_VISUAL_CONFIG = {
  zoneColor: 0xff4400,
  zoneOpacity: 0.4,
  zoneSegments: 32,
  tickInterval: 1.0,
} as const;

export const GROUND_EFFECT_Y = 0.05;

/** Visual tint applied to enemy meshes while slowed or frozen. */
export const SLOW_VISUAL_CONFIG = {
  tintColor: 0x4488ff,
  tintEmissive: 0x2244aa,
} as const;
