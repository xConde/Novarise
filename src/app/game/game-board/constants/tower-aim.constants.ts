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
  /**
   * Grace period when reduce-motion is active. Set to zero so idle gesture
   * resumes immediately rather than holding a static yaw — avoids any
   * lingering perception of motion for motion-sensitive users.
   */
  reduceMotionGraceSec: 0,
} as const;

/** Visual parameters for the selected-tower aim line indicator. */
export const AIM_LINE_CONFIG = {
  /** Radius of the cylinder used to draw the aim line. */
  radius: 0.02,
  /** Opacity of the aim-line material (0 = invisible, 1 = fully opaque). */
  opacity: 0.45,
  /** Radial segments for the cylinder geometry (low = flat-shaded, cheap). */
  segments: 4,
  /** Vertical offset above the tile surface so the line clears geometry. */
  yOffset: 0.6,
  /**
   * Minimum endpoint movement (world units) required to rebuild the cylinder
   * geometry. Below this threshold the existing geometry is reused; only the
   * mesh transform is updated. Prevents per-frame GPU allocations when tower
   * and target are stationary (the common case during planning).
   */
  rebuildThreshold: 0.01,
} as const;
