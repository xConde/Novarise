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
