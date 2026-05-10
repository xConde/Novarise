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

  /** Sprite opacity when projection is high-confidence (default sprite alpha). */
  opacityConfident: 1.0,

  /**
   * Sprite opacity when the projection's reliability is low — currently
   * triggered when an enemy has a SLOW status that will expire BEFORE its
   * projected turns-to-exit. The projection assumes SLOW continues for the
   * full horizon, so an early SLOW expiry means the enemy will arrive sooner
   * than the marker shows. Faded marker tells the player "trust this less".
   */
  opacityUncertain: 0.5,

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
