/**
 * Color tier for heatmap rendering, ordered from cheapest to most expensive.
 */
export type StrategicTier = 'base' | 'low' | 'medium' | 'high' | 'critical';

export interface TilePriceInfo {
  /** The final cost to place this tower type on this tile. */
  cost: number;
  /** Raw strategic multiplier (0.0 = no premium, 1.0 = maximum premium). */
  strategicMultiplier: number;
  /** Percentage increase over base cost (0–100), for display labels. */
  percentIncrease: number;
  /** Color tier for heatmap rendering. */
  tier: StrategicTier;
  /** Whether this tile has any strategic premium. */
  isPremium: boolean;
}
