/**
 * Relic model for Ascent Mode.
 *
 * Relics are run-scoped passive modifiers — 20 starter relics across 3 rarities.
 * Behavior lives in RelicService (pull model); this file defines data only.
 *
 * Design note: when cards are added later, they will publish to the same
 * RunEventBus. Relics remain a separate reward type alongside cards.
 */

export enum RelicId {
  // Common (10)
  IRON_HEART = 'IRON_HEART',
  GOLD_MAGNET = 'GOLD_MAGNET',
  STURDY_BOOTS = 'STURDY_BOOTS',
  QUICK_DRAW = 'QUICK_DRAW',
  SALVAGE_KIT = 'SALVAGE_KIT',
  SCOUTING_LENS = 'SCOUTING_LENS',
  FIELD_RATIONS = 'FIELD_RATIONS',
  REINFORCED_WALLS = 'REINFORCED_WALLS',
  LUCKY_COIN = 'LUCKY_COIN',
  APPRENTICE_MANUAL = 'APPRENTICE_MANUAL',

  // Uncommon (7)
  CHAIN_REACTION = 'CHAIN_REACTION',
  FROST_NOVA = 'FROST_NOVA',
  MORTAR_SHELL = 'MORTAR_SHELL',
  SNIPER_SCOPE = 'SNIPER_SCOPE',
  BASIC_TRAINING = 'BASIC_TRAINING',
  SPLASH_ZONE = 'SPLASH_ZONE',
  BOUNTY_HUNTER = 'BOUNTY_HUNTER',

  // Rare (3)
  ARCHITECTS_BLUEPRINT = 'ARCHITECTS_BLUEPRINT',
  TEMPORAL_RIFT = 'TEMPORAL_RIFT',
  COMMANDERS_BANNER = 'COMMANDERS_BANNER',
}

export enum RelicRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
}

export interface RelicDefinition {
  readonly id: RelicId;
  readonly name: string;
  readonly description: string;
  readonly flavorText: string;
  readonly rarity: RelicRarity;
}

export const RELIC_DEFINITIONS: Record<RelicId, RelicDefinition> = {
  // ── Common (10) ─────────────────────────────────────────────
  [RelicId.IRON_HEART]: {
    id: RelicId.IRON_HEART,
    name: 'Iron Heart',
    description: '+3 max lives',
    flavorText: 'Forged from the core of a fallen sentinel.',
    rarity: RelicRarity.COMMON,
  },
  [RelicId.GOLD_MAGNET]: {
    id: RelicId.GOLD_MAGNET,
    name: 'Gold Magnet',
    description: '+15% gold from kills',
    flavorText: 'Wealth has a way of finding the prepared.',
    rarity: RelicRarity.COMMON,
  },
  [RelicId.STURDY_BOOTS]: {
    id: RelicId.STURDY_BOOTS,
    name: 'Sturdy Boots',
    description: 'Enemies move 8% slower',
    flavorText: 'The mud they trudge through seems thicker here.',
    rarity: RelicRarity.COMMON,
  },
  [RelicId.QUICK_DRAW]: {
    id: RelicId.QUICK_DRAW,
    name: 'Quick Draw',
    description: 'All towers fire 10% faster',
    flavorText: 'Anticipation makes the trigger light.',
    rarity: RelicRarity.COMMON,
  },
  [RelicId.SALVAGE_KIT]: {
    id: RelicId.SALVAGE_KIT,
    name: 'Salvage Kit',
    description: 'Sell towers for 75% instead of 50%',
    flavorText: 'Nothing wasted, everything repurposed.',
    rarity: RelicRarity.COMMON,
  },
  [RelicId.SCOUTING_LENS]: {
    id: RelicId.SCOUTING_LENS,
    name: 'Scouting Lens',
    description: 'See wave preview 2 waves ahead',
    flavorText: 'Knowledge is the first line of defense.',
    rarity: RelicRarity.COMMON,
  },
  [RelicId.FIELD_RATIONS]: {
    id: RelicId.FIELD_RATIONS,
    name: 'Field Rations',
    description: '+30 starting gold per encounter',
    flavorText: 'A full belly makes for bold decisions.',
    rarity: RelicRarity.COMMON,
  },
  [RelicId.REINFORCED_WALLS]: {
    id: RelicId.REINFORCED_WALLS,
    name: 'Reinforced Walls',
    description: 'First enemy leak each wave is blocked',
    flavorText: 'One mistake forgiven. Make it count.',
    rarity: RelicRarity.COMMON,
  },
  [RelicId.LUCKY_COIN]: {
    id: RelicId.LUCKY_COIN,
    name: 'Lucky Coin',
    description: '20% chance for +50% gold on kill',
    flavorText: 'Fortune favors the invested.',
    rarity: RelicRarity.COMMON,
  },
  [RelicId.APPRENTICE_MANUAL]: {
    id: RelicId.APPRENTICE_MANUAL,
    name: 'Apprentice Manual',
    description: 'Tower upgrades cost 15% less',
    flavorText: 'Shortcuts written by those who walked the long road.',
    rarity: RelicRarity.COMMON,
  },

  // ── Uncommon (7) ────────────────────────────────────────────
  [RelicId.CHAIN_REACTION]: {
    id: RelicId.CHAIN_REACTION,
    name: 'Chain Reaction',
    description: 'Chain towers get +1 bounce',
    flavorText: 'Lightning never strikes twice — unless you tell it to.',
    rarity: RelicRarity.UNCOMMON,
  },
  [RelicId.FROST_NOVA]: {
    id: RelicId.FROST_NOVA,
    name: 'Frost Nova',
    description: 'Slow effect duration +50%',
    flavorText: 'The cold lingers long after the wind dies.',
    rarity: RelicRarity.UNCOMMON,
  },
  [RelicId.MORTAR_SHELL]: {
    id: RelicId.MORTAR_SHELL,
    name: 'Mortar Shell',
    description: 'Mortar DoT damage doubled',
    flavorText: 'The ground remembers every impact.',
    rarity: RelicRarity.UNCOMMON,
  },
  [RelicId.SNIPER_SCOPE]: {
    id: RelicId.SNIPER_SCOPE,
    name: 'Sniper Scope',
    description: 'Sniper tower range +25%',
    flavorText: 'See the whites of their eyes? Too close.',
    rarity: RelicRarity.UNCOMMON,
  },
  [RelicId.BASIC_TRAINING]: {
    id: RelicId.BASIC_TRAINING,
    name: 'Basic Training',
    description: 'Basic tower damage +35%',
    flavorText: 'Fundamentals win wars.',
    rarity: RelicRarity.UNCOMMON,
  },
  [RelicId.SPLASH_ZONE]: {
    id: RelicId.SPLASH_ZONE,
    name: 'Splash Zone',
    description: 'Splash tower radius +30%',
    flavorText: 'Collateral damage, by design.',
    rarity: RelicRarity.UNCOMMON,
  },
  [RelicId.BOUNTY_HUNTER]: {
    id: RelicId.BOUNTY_HUNTER,
    name: 'Bounty Hunter',
    description: 'Double gold from elite and boss kills',
    flavorText: 'The bigger they are, the richer they fall.',
    rarity: RelicRarity.UNCOMMON,
  },

  // ── Rare (3) ────────────────────────────────────────────────
  [RelicId.ARCHITECTS_BLUEPRINT]: {
    id: RelicId.ARCHITECTS_BLUEPRINT,
    name: "Architect's Blueprint",
    description: 'First tower placed each encounter is free',
    flavorText: 'A gift from the builders who came before.',
    rarity: RelicRarity.RARE,
  },
  [RelicId.TEMPORAL_RIFT]: {
    id: RelicId.TEMPORAL_RIFT,
    name: 'Temporal Rift',
    description: 'First enemy of each wave spawns 1 turn later',
    flavorText: 'Time bends for those who know its seams.',
    rarity: RelicRarity.RARE,
  },
  [RelicId.COMMANDERS_BANNER]: {
    id: RelicId.COMMANDERS_BANNER,
    name: "Commander's Banner",
    description: 'All towers +15% damage and +15% range',
    flavorText: 'Under this banner, none falter.',
    rarity: RelicRarity.RARE,
  },
};

export function getRelicsByRarity(rarity: RelicRarity): RelicDefinition[] {
  return Object.values(RELIC_DEFINITIONS).filter(r => r.rarity === rarity);
}

export function getRelicDefinition(id: RelicId): RelicDefinition {
  return RELIC_DEFINITIONS[id];
}
