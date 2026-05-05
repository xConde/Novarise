/**
 * Constants for the projectile visual subsystem.
 *
 * Five idioms planned: HITSCAN (this sprint) / arc / chain / splash / status.
 * Each idiom adds its own config object here; shared infra lives in
 * ProjectileVisualService.
 */

/**
 * HITSCAN idiom — instantaneous line-flash from tower to target.
 * Used by SNIPER.  Other towers that also fire instantly (e.g. BASIC)
 * get a different idiom in a later sprint.
 */
export const PROJECTILE_HITSCAN_CONFIG = {
  /** Total lifetime in seconds. */
  lifetimeSec: 0.12,
  /** Opacity fade-in duration in seconds. */
  fadeInSec: 0.03,
  /** Opacity fade-out starts at lifetimeSec − fadeOutSec. */
  fadeOutSec: 0.05,
  /** World-unit Y offset above tower base for the line origin. */
  yOffsetTower: 0.6,
  /** World-unit Y offset above enemy base for the line endpoint. */
  yOffsetEnemy: 0.4,
  /**
   * Line linewidth — most browsers cap at 1.  Specified aspirationally so
   * environments that do honour the attribute (e.g. software renderers) look
   * correct without a code change.
   */
  linewidth: 2,
} as const;
