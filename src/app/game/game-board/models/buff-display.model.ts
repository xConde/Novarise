import { ActiveModifier } from '../../../run/services/card-effect.service';
import { MODIFIER_STAT, ModifierStat } from '../../../run/constants/modifier-stat.constants';

/** A single rendered buff chip for the active-buffs HUD panel. */
export interface BuffChip {
  readonly stat: string;
  readonly label: string;
  readonly remaining: string;
}

/**
 * 'flag' format: an encounter-scoped on/off stat. The label is just the name;
 * remaining is always 'active'. No numeric value is displayed.
 */
type FormatKind = 'percent' | 'flat' | 'slow' | 'charges' | 'flag';

interface StatMeta {
  name: string;
  format: FormatKind;
}

/**
 * Maps the subset of ModifierStat values that are player-facing card buffs to
 * their display name and value format. Includes both numeric stats and
 * encounter-scoped archetype flag stats that the player should see persistently.
 */
const BUFF_META: Partial<Record<ModifierStat, StatMeta>> = {
  [MODIFIER_STAT.DAMAGE]:          { name: 'Damage',          format: 'percent'  },
  [MODIFIER_STAT.RANGE]:           { name: 'Range',           format: 'percent'  },
  [MODIFIER_STAT.SNIPER_DAMAGE]:   { name: 'Sniper Dmg',     format: 'percent'  },
  [MODIFIER_STAT.FIRE_RATE]:       { name: 'Fire Rate',       format: 'percent'  },
  [MODIFIER_STAT.CHAIN_BOUNCES]:   { name: 'Chain',           format: 'flat'     },
  [MODIFIER_STAT.ENEMY_SPEED]:     { name: 'Enemy Slow',      format: 'slow'     },
  [MODIFIER_STAT.GOLD_MULTIPLIER]: { name: 'Gold Interest',   format: 'percent'  },
  [MODIFIER_STAT.LEAK_BLOCK]:      { name: 'Leak Shield',     format: 'charges'  },

  // Encounter-scoped archetype flags — rendered as persistent 'active' chips so
  // the player can see which anchor cards are in effect for the whole encounter.
  [MODIFIER_STAT.TERRAFORM_ANCHOR]:           { name: 'Cartographer Seal', format: 'flag' },
  [MODIFIER_STAT.LABYRINTH_MIND]:             { name: 'Labyrinth Mind',    format: 'flag' },
  [MODIFIER_STAT.ARCHITECT_CLUSTER_PROPAGATION]: { name: 'Architect',      format: 'flag' },
  [MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX]:      { name: 'Hive Mind',         format: 'flag' },
};

function formatLabel(meta: StatMeta, value: number): string {
  switch (meta.format) {
    case 'percent':  return `${meta.name} +${Math.round(value * 100)}%`;
    case 'flat':     return `${meta.name} +${value}`;
    case 'slow':     return `${meta.name} ${Math.round(Math.abs(value) * 100)}%`;
    case 'charges':  return meta.name;
    case 'flag':     return meta.name;
  }
}

function formatRemaining(meta: StatMeta, m: ActiveModifier): string | null {
  if (meta.format === 'charges') {
    if (m.value <= 0) {
      return null;
    }
    return `${m.value} ${m.value === 1 ? 'block' : 'blocks'}`;
  }

  if (meta.format === 'flag') {
    return 'active';
  }

  if (m.remainingTurns !== undefined) {
    return `${m.remainingTurns} ${m.remainingTurns === 1 ? 'turn' : 'turns'}`;
  }

  if (m.remainingWaves !== null) {
    return `${m.remainingWaves} ${m.remainingWaves === 1 ? 'wave' : 'waves'}`;
  }

  return 'active';
}

/**
 * Converts an array of ActiveModifiers from CardEffectService into BuffChips
 * suitable for display in the active-buffs HUD panel. Unmapped stats and
 * zero-charge entries are silently dropped.
 */
export function toBuffChips(modifiers: ReadonlyArray<ActiveModifier>): BuffChip[] {
  const chips: BuffChip[] = [];

  for (const m of modifiers) {
    const meta = BUFF_META[m.stat];
    if (meta === undefined) {
      continue;
    }

    const remaining = formatRemaining(meta, m);
    if (remaining === null) {
      continue;
    }

    chips.push({
      stat: m.stat,
      label: formatLabel(meta, m.value),
      remaining,
    });
  }

  return chips;
}
