/**
 * Configuration for the EnemyIntentService turn-to-exit markers.
 *
 * Color tiers signal threat level to the player at a glance:
 *   - Red  (≤ LEAK_THRESHOLD_TURNS)  — leaks imminently, act now
 *   - Amber (≤ WARN_THRESHOLD_TURNS)  — moderate threat
 *   - Green (> WARN_THRESHOLD_TURNS)  — safe for several more turns
 */
export const ENEMY_INTENT_CONFIG = {
  /** Turns-to-exit at or below which the marker renders red (imminent leak). */
  leakThresholdTurns: 2,

  /** Turns-to-exit at or below which the marker renders amber (warning zone). */
  warnThresholdTurns: 5,

  /** Hex color used when turns-to-exit > warnThresholdTurns (safe). */
  colorSafe: 0x6ee7b7,

  /** Hex color used when turns-to-exit is in the warning range. */
  colorWarn: 0xfbbf24,

  /** Hex color used when turns-to-exit ≤ leakThresholdTurns (danger). */
  colorDanger: 0xe85d75,

  /** World-unit Y offset above the enemy's position for the sprite anchor. */
  spriteYOffset: 1.5,

  // --- TextSprite canvas / scale settings ---
  canvasWidth: 64,
  canvasHeight: 32,
  spriteScaleX: 0.6,
  spriteScaleY: 0.3,
  fontSize: 20,
  fontFamily: 'monospace',
  strokeColor: '#000000',
  strokeWidth: 2,
} as const;
