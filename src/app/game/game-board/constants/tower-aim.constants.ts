/**
 * Constants for the tower aim subsystem.
 *
 * All rotation rates are in radians per second. All threshold values are in
 * radians. No magic numbers elsewhere — every numeric literal for aim belongs
 * here.
 */
import { TowerType } from '../models/tower.model';

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

/**
 * Per-tower yaw amplitude clamp (radians from the neutral forward direction).
 *
 * Directional towers (BASIC, SNIPER, MORTAR) rotate without restriction —
 * their visual fiction is a barrel or scope that points exactly at the target.
 *
 * Omnidirectional towers (SLOW dish, CHAIN sphere) use a reduced amplitude so
 * the aim gesture reads as "leaning toward" rather than "tracking precisely".
 * This preserves the field-weapon fiction while still giving the player a clear
 * indication of which target is selected.
 *
 * SPLASH drum spins on its forward axis (roll, not yaw) for the idle effect;
 * the splashYaw parent allows full yaw so the cluster faces the target — full
 * rotation is acceptable because the cluster head looks like a directional weapon.
 *
 * Set to Math.PI (180°) to allow unrestricted rotation. Clamp is applied to the
 * computed targetYaw before `lerpYaw` so the lerp still takes the shortest path
 * within the allowed arc.
 */
export const AIM_AMPLITUDE_CONFIG: Record<TowerType, number> = {
  [TowerType.BASIC]:  Math.PI,
  [TowerType.SNIPER]: Math.PI,
  [TowerType.SPLASH]: Math.PI,
  /**
   * SLOW emitter dish: ±90° arc centered on forward. The field-weapon read is
   * preserved — the dish "leans" toward the target rather than spinning freely.
   */
  [TowerType.SLOW]:   Math.PI / 2,
  /**
   * CHAIN sphere+electrodes: ±90° arc. The electrode cluster tilts toward the
   * target; the arc discharge VFX is still omnidirectional so the field-weapon
   * read is maintained.
   */
  [TowerType.CHAIN]:  Math.PI / 2,
  [TowerType.MORTAR]: Math.PI,
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
