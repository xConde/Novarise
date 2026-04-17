export const CHAIN_LIGHTNING_CONFIG = {
  damageFalloff: 0.7,
  arcLifetime: 0.15,
  arcHeightOffset: 0.5,
  /** Number of zigzag segments per arc */
  zigzagSegments: 6,
  /** Maximum perpendicular offset for zigzag jitter */
  zigzagJitter: 0.25,
  arcOpacity: 0.85,
  /** Chain does not bounce if the next hit's rounded damage would be below this threshold. */
  minDamageToBounce: 2,
} as const;

export const MORTAR_VISUAL_CONFIG = {
  zoneColor: 0xff4400,
  zoneOpacity: 0.4,
  zoneSegments: 32,
  tickInterval: 1.0,
} as const;

export const GROUND_EFFECT_Y = 0.05;

/**
 * Maximum number of times a scheduled enemy spawn slot will retry before being
 * silently dropped. Retries accumulate when spawnEnemy returns null (all
 * spawners occupied or path impossible). 3 retries = one extra wave turn before
 * the enemy is discarded, keeping wave density mostly intact while avoiding
 * infinite loops on permanently broken boards.
 */
export const MAX_SPAWN_RETRIES = 3;

/**
 * Wave-level leak damage rules.
 *
 * twinBossLeakDivisor: When a wave contains more than one BOSS entry (twin-boss
 * wave), per-BOSS leak damage is divided by this value. Math.ceil ensures the
 * damage is at least 1 and rounds up for odd base values (e.g. 3 → ceil(3/2) = 2).
 * Non-BOSS leaks and single-BOSS waves are unaffected.
 */
export const WAVE_CONFIG = {
  twinBossLeakDivisor: 2,
} as const;
