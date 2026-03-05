/** Time window in seconds within which consecutive kills count toward the combo. */
export const COMBO_WINDOW_SECONDS = 2;

/**
 * Combo tier thresholds and their bonus gold per kill.
 * Tiers are evaluated in descending order — highest matching tier wins.
 */
export const COMBO_TIERS: ReadonlyArray<{ minKills: number; bonusGoldPerKill: number; label: string }> = [
  { minKills: 10, bonusGoldPerKill: 20, label: 'ULTRA' },
  { minKills: 5,  bonusGoldPerKill: 10, label: 'MEGA' },
  { minKills: 3,  bonusGoldPerKill: 5,  label: 'COMBO' },
] as const;

/** Duration in milliseconds to display the combo banner after it fires. */
export const COMBO_BANNER_DISPLAY_MS = 1800;

/** CSS animation duration for the combo pulse (must match SCSS keyframe). */
export const COMBO_PULSE_DURATION_MS = 400;
