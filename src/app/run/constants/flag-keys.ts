/**
 * String constants for RunStateFlagService flag keys.
 * Always reference these instead of raw string literals to prevent silent typo bugs.
 */
export const FLAG_KEYS = {
  MERCHANT_AIDED: 'merchant_aided',
  IDOL_BARGAIN_TAKEN: 'idol_bargain_taken',
  SCOUT_SAVED: 'scout_saved',
} as const;

export type FlagKey = typeof FLAG_KEYS[keyof typeof FLAG_KEYS];
