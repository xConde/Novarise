/**
 * Cartographer archetype — game-side constants.
 *
 * Mirrors values that also live in card-definitions.ts CARD_VALUES. Game
 * services read from this file so they don't need a cross-boundary import
 * from `run/constants` into `game/constants`. Values must stay in sync —
 * if CARD_VALUES changes, mirror here.
 */
export const CARTOGRAPHER_CONFIG = {
  /**
   * DETOUR (Cartographer uncommon) — modifier-value tier sentinel. Base
   * SpellCardEffect.value = 1 (no damage); upgraded value = 2 (with damage).
   * CardEffectService.applyDetour reads the numeric value and passes a
   * non-zero damage fraction to EnemyService.applyDetour when value ≥ 2.
   * Mirror of CARD_VALUES.detourUpgradedValue — both must stay in sync.
   */
  DETOUR_UPGRADED_VALUE: 2,

  /**
   * Fraction of max HP dealt to every detoured enemy, multiplied by the
   * number of extra path tiles the detour added versus their remaining route.
   * Applied once at DETOUR cast time via EnemyService.damageEnemy, so the
   * bleed compounds with elevation-expose / shield / status interactions.
   * Floors at 1 HP even if the fraction × extraSteps rounds to 0.
   * Mirror of CARD_VALUES.detourDamageFractionPerExtraStep.
   */
  DETOUR_DAMAGE_FRACTION_PER_EXTRA_STEP: 0.08,
} as const;
