/**
 * Constants for the tower aim subsystem.
 *
 * All rotation rates are in radians per second. All threshold values are in
 * radians. No magic numbers elsewhere — every numeric literal for aim belongs
 * here.
 */

/** Lerp and snap parameters for turret yaw tracking. */
export const AIM_LERP_CONFIG = {
  /** Standard turret rotation speed — full 180° turn in ~0.4 s. */
  speedRadPerSec: 8.0,
  /**
   * Rotation speed when the user has enabled reduce-motion. Set to a large
   * value so the transition completes within a single frame at normal delta
   * times, effectively snapping without discrete snap logic.
   */
  reduceMotionSpeedRadPerSec: Math.PI * 4,
  /**
   * Angle delta beyond which the short-path wrap fires. At exactly π the two
   * paths have equal length; wrap at π ensures deterministic behavior at the
   * boundary by consistently taking the clockwise path.
   */
  snapThresholdRad: Math.PI,
} as const;

/** Grace-period and fallback parameters when a tower loses its target. */
export const AIM_FALLBACK_CONFIG = {
  /**
   * Seconds the tower holds its current yaw after the target leaves range or
   * dies before handing back control to the idle gesture. Prevents jarring
   * snap-to-idle when an enemy is killed.
   */
  noTargetGraceSec: 0.5,
} as const;
