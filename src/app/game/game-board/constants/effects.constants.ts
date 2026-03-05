/** Duration in milliseconds to show the wave-end interest award notification. */
export const INTEREST_NOTIFICATION_MS = 3000;

/** Fallback color used when an enemy type has no color defined (should never occur in practice). */
export const ENEMY_FALLBACK_COLOR = 0xff0000;

export const SCREEN_SHAKE_CONFIG = {
  bossHitIntensity: 0.15,
  bossHitDuration: 0.2,
  lifeLossIntensity: 0.3,
  lifeLossDuration: 0.4,
} as const;

export const GOLD_POPUP_CONFIG = {
  riseSpeed: 2,      // units per second upward
  lifetime: 1.0,     // seconds before removal
  fontSize: 48,      // canvas text size
  fontFamily: 'monospace',
  textColor: '#FFD700',
  strokeColor: '#000000',
  strokeWidth: 3,
  canvasWidth: 128,
  canvasHeight: 64,
  spriteScale: 0.8,
} as const;

export const TOWER_UPGRADE_VISUAL_CONFIG = {
  /** Scale multiplier per tower level: level 1 = 1.0, level 2 = 1.15, level 3 = 1.3 */
  scalePerLevel: [1.0, 1.15, 1.3] as readonly number[],
  /** Flash sprite settings */
  flash: {
    color: 0xffffff,
    opacity: 0.8,
    size: 1.5,
    duration: 0.3,
  },
  /** Base glow ring settings */
  glowRing: {
    innerRadius: 0.3,
    outerRadius: 0.5,
    color: 0x8a5cf6,
    opacity: 0.4,
    segments: 32,
  },
} as const;
