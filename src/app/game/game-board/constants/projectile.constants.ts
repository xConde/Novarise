/**
 * Constants for the projectile visual subsystem.
 *
 * Five idioms planned: HITSCAN / BOLT / arc / chain / splash / status.
 * Each idiom adds its own config object here; shared infra lives in
 * ProjectileVisualService.
 */

/**
 * SPLASH idiom — two-phase visual for the SPLASH tower.
 *
 * Phase 1 (travel): a small sphere lerps from tower to primary target over
 * `travelLifetimeSec` seconds, identical motion to BOLT but with SPLASH
 * tower color.
 *
 * Phase 2 (impact): the travel sphere is hidden; a flat ring appears at the
 * impact point and scales from 0 → splashRadius while opacity ramps 1 → 0
 * over `impactLifetimeSec` seconds. The ring visually telegraphs the AOE
 * radius that was already resolved by the sim.
 *
 * Total entry lifetime = travelLifetimeSec + impactLifetimeSec.
 * Both meshes are allocated at fire-time (ring starts invisible); no dynamic
 * mesh creation during update().
 */
export const PROJECTILE_SPLASH_CONFIG = {
  /** Travel phase duration in seconds (sphere flying from tower to impact). */
  travelLifetimeSec: 0.18,
  /** Impact phase duration in seconds (ring expanding + fading). */
  impactLifetimeSec: 0.25,
  /** Sphere radius for the travel phase (world units). */
  travelRadius: 0.14,
  /** Sphere segment count — kept low; small projectile. */
  travelSegments: 8,
  /** Ring inner-to-outer ratio. 0.55 = donut; 0 = solid disc. */
  ringInnerRatio: 0.55,
  /** Radial and theta segment count for the ring geometry. */
  ringSegments: 32,
  /** World-unit Y offset above tower base for travel sphere spawn. */
  yOffsetTower: 0.6,
  /** World-unit Y offset above enemy base for travel sphere destination. */
  yOffsetEnemy: 0.4,
  /** Y offset for the impact ring mesh (just above ground plane). */
  yOffsetImpact: 0.05,
  /** Travel sphere opacity — full opacity throughout travel phase. */
  travelOpacity: 1.0,
} as const;

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

/**
 * ARC idiom — larger sphere that follows a parabolic trajectory from tower to
 * target.  Used by MORTAR.  Slower than BOLT to telegraph the incoming shell
 * and give the arc shape time to read.
 */
export const PROJECTILE_ARC_CONFIG = {
  /** Total flight time in seconds — slower than BOLT to emphasize the arc. */
  lifetimeSec: 0.4,
  /** Sphere radius in world units — larger than BOLT (mortar shell). */
  radius: 0.18,
  widthSegments: 10,
  heightSegments: 8,
  /** World-unit Y offset above tower base for spawn position. */
  yOffsetTower: 0.6,
  /** World-unit Y offset above enemy base for impact position. */
  yOffsetEnemy: 0.4,
  /** Peak height of the parabolic arc above the linear lerp baseline (world units). */
  arcApex: 2.0,
  opacity: 1.0,
} as const;

/**
 * BOLT idiom — small sphere that physically travels from tower to target.
 * Used by BASIC (the most common fire path).
 */
export const PROJECTILE_BOLT_CONFIG = {
  /** Total flight time in seconds. */
  lifetimeSec: 0.15,
  /** Sphere radius in world units. */
  radius: 0.12,
  /** Vertex segments for the sphere — kept low; small projectile, GPU budget matters under heavy fire. */
  widthSegments: 8,
  heightSegments: 6,
  /** World-unit Y offset above tower base for spawn position. */
  yOffsetTower: 0.6,
  /** World-unit Y offset above enemy base for impact position. */
  yOffsetEnemy: 0.4,
  /** Material opacity. Bolt does not fade — short lifetime makes opacity ramping wasteful. */
  opacity: 1.0,
} as const;
