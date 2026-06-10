/**
 * Colorblind-safe palettes for gameplay-critical color signals.
 *
 * Design axis: deuteranopia / protanopia (red-green colour vision deficiency,
 * ~8% of males). Under these conditions the safe discrimination axis is
 * blue ↔ yellow ↔ orange ↔ white ↔ dark, avoiding red-vs-green pairs.
 *
 * Palette construction rules applied:
 *  1. No two adjacent-tier enemies share the same hue family.
 *  2. Boss-tier enemies (BOSS, WYRM_ASCENDANT, NOVA_SOVEREIGN) use the most
 *     vivid / contrasting value in their hue family for dramatic read.
 *  3. Groups with similar shape (FLYING / GLIDER) get opposite brightness
 *     in the same hue family so shape + colour together disambiguate.
 *  4. POISON status changed to violet — the original lime-green is
 *     indistinguishable from yellow-orange under deuteranopia.
 *
 * Note: setting takes effect for newly created enemy meshes only (next
 * encounter). Live re-colouring of existing meshes in an active encounter
 * is out of scope — the settings hint communicates this.
 */

import { EnemyType } from '@core/models/enemy-type.model';
import { StatusEffectType } from './status-effect.constants';

// ---------------------------------------------------------------------------
// Enemy palette
// ---------------------------------------------------------------------------

/**
 * Deuteranopia/protanopia-safe enemy colours.
 * Hue families:
 *   Orange  — BASIC, MINER (earthy / grounded threat, safe from blue)
 *   Amber   — TITAN, SWARM, FAST (warm accent, distinct from orange by saturation)
 *   Yellow  — NOVA_SOVEREIGN (final-boss radiance, maximum brightness)
 *   Blue    — HEAVY (deep anchor, canonical "blue = bulk")
 *   Lt-Blue — SHIELDED, FLYING, GLIDER (shield / aerial; graduated lightness)
 *   Navy    — WYRM_ASCENDANT (dark-blue boss — ominous, max contrast vs yellow)
 *   Sky-blue— BOSS (bright sky, unambiguous boss read vs orange commons)
 *   White   — SWIFT (ghostly / fast, unique full-desaturated slot)
 *   Lt-grey — VEINSEEKER (darker near-white, distinct from SWIFT)
 *   Gray    — UNSHAKEABLE (stone; shape / size do most of the work)
 */
export const COLORBLIND_ENEMY_PALETTE: Record<EnemyType, number> = {
  [EnemyType.BASIC]:           0xdd6600, // Orange — standard threat
  [EnemyType.FAST]:            0xf5dd00, // Yellow — speed read
  [EnemyType.HEAVY]:           0x2244cc, // Deep blue — bulk anchor
  [EnemyType.SWIFT]:           0xf0f0f0, // Near-white — ghostly speed
  [EnemyType.BOSS]:            0x0099ee, // Sky-blue — boss dramatically distinct from orange commons
  [EnemyType.SHIELDED]:        0x6699ff, // Light blue — shield association, different brightness from HEAVY
  [EnemyType.SWARM]:           0xffcc00, // Amber-yellow — swarm/collective energy
  [EnemyType.FLYING]:          0xaaccff, // Pale sky-blue — aerial, lighter than SHIELDED
  [EnemyType.MINER]:           0xbb7722, // Warm tan-brown — earthy, orange family
  [EnemyType.UNSHAKEABLE]:     0x888888, // Mid-gray — stone-grey; shape/size carry the rest
  [EnemyType.VEINSEEKER]:      0xcc9966, // Pale warm tan — distinct from MINER by lightness
  [EnemyType.GLIDER]:          0xddeeff, // Very pale blue-white — floating; lightest blue tier
  [EnemyType.TITAN]:           0xff8822, // Warm amber-orange — elite/armoured, more vivid than BASIC
  [EnemyType.WYRM_ASCENDANT]:  0x1133aa, // Dark navy — deep dramatic boss
  [EnemyType.NOVA_SOVEREIGN]:  0xffee55, // Bright gold — final-boss radiance, maximum brightness
};

// ---------------------------------------------------------------------------
// Status-effect palette
// ---------------------------------------------------------------------------

/**
 * Particle and emissive colours for status effects under colorblind assist.
 *
 * Why changes are needed:
 *   POISON default (0x44ff44 / 0x44ff22) is lime-green — indistinguishable
 *   from yellow-orange under deuteranopia / protanopia. Changed to violet,
 *   which is orthogonal to both the orange (burn) and blue (slow) axes.
 *
 *   BURN and SLOW have no conflicts with each other or with the new poison:
 *   orange ↔ violet ↔ blue are all mutually discriminable.
 */
export const COLORBLIND_STATUS_PARTICLE_PALETTE: Record<StatusEffectType, {
  color: number;
  emissive: number;
}> = {
  [StatusEffectType.BURN]:   { color: 0xff6600, emissive: 0xff4400 }, // Orange — unchanged, safe
  [StatusEffectType.POISON]: { color: 0x9955ff, emissive: 0x7733dd }, // Violet — replaces lime-green
  [StatusEffectType.SLOW]:   { color: 0x88ccff, emissive: 0x4488cc }, // Blue — unchanged, safe
};

export const COLORBLIND_STATUS_EMISSIVE_PALETTE: Record<StatusEffectType, {
  emissiveColor: number;
  emissiveIntensity: number;
}> = {
  [StatusEffectType.BURN]:   { emissiveColor: 0xff6622, emissiveIntensity: 1.6 }, // unchanged
  [StatusEffectType.POISON]: { emissiveColor: 0x9944ee, emissiveIntensity: 1.6 }, // violet
  [StatusEffectType.SLOW]:   { emissiveColor: 0x4488ff, emissiveIntensity: 1.6 }, // unchanged
};

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

/**
 * Returns the correct enemy body colour for the given type.
 * When colorblindAssist is false the canonical ENEMY_STATS[type].color is
 * used (callers must pass it). When true, the safe palette is substituted.
 *
 * Keeping this as a pure function (not a service) ensures the factory and
 * visual services stay decoupled from SettingsService internals.
 */
export function resolveEnemyColor(
  type: EnemyType,
  defaultColor: number,
  colorblindAssist: boolean,
): number {
  return colorblindAssist ? COLORBLIND_ENEMY_PALETTE[type] : defaultColor;
}

/**
 * Returns the correct status-effect particle colours.
 * Consumers should destructure { color, emissive } from the result.
 */
export function resolveStatusParticleColors(
  effectType: StatusEffectType,
  defaultColor: number,
  defaultEmissive: number,
  colorblindAssist: boolean,
): { color: number; emissive: number } {
  if (!colorblindAssist) return { color: defaultColor, emissive: defaultEmissive };
  return COLORBLIND_STATUS_PARTICLE_PALETTE[effectType];
}

/**
 * Returns the correct status-effect emissive visual config for mesh tinting.
 */
export function resolveStatusEmissive(
  effectType: StatusEffectType,
  defaultEmissiveColor: number,
  defaultEmissiveIntensity: number,
  colorblindAssist: boolean,
): { emissiveColor: number; emissiveIntensity: number } {
  if (!colorblindAssist) return { emissiveColor: defaultEmissiveColor, emissiveIntensity: defaultEmissiveIntensity };
  return COLORBLIND_STATUS_EMISSIVE_PALETTE[effectType];
}
