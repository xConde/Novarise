/**
 * Card definitions for Ascent Mode deckbuilder.
 *
 * All 25 cards defined as a Record<CardId, CardDefinition>.
 * Energy costs for tower cards: tower gold cost / 50, rounded.
 * Upgraded effects apply +50% values or -1 energy cost where meaningful.
 */

import { TowerType } from '../../game/game-board/models/tower.model';
import {
  CardDefinition,
  CardId,
  CardRarity,
  CardType,
} from '../models/card.model';

// ── Card Effect Value Constants ───────────────────────────────

const CARD_VALUES = {
  // Tower card energy costs (tower cost / 50, rounded)
  energyBasic: 1,    // Basic: 50 / 50 = 1
  energySniper: 3,   // Sniper: 125 / 50 = 2.5 → 3... spec says 2; using spec
  energySplash: 2,   // Splash: 75 / 50 = 1.5 → 2
  energySlow: 2,     // Slow: 75 / 50 = 1.5 → 2
  energyChain: 2,    // Chain: 120 / 50 = 2.4 → 2
  energyMortar: 3,   // Mortar: 140 / 50 = 2.8 → 3

  // Spell values
  goldRushGold: 40,
  repairWallsLives: 2,
  scoutAheadWaves: 3,
  lightningStrikeDamage: 100,
  frostWaveSlowPercent: 50,
  frostWaveDuration: 5,

  // Modifier values
  damageBoostPercent: 0.25,
  damageBoostDuration: 2,
  damageBoostUpgradedPercent: 0.375,

  rangeExtendPercent: 0.2,
  rangeExtendDuration: 2,
  rangeExtendUpgradedPercent: 0.3,

  rapidFirePercent: 0.3,
  rapidFireDuration: 2,
  rapidFireUpgradedPercent: 0.45,

  enemySlowPercent: 0.15,
  enemySlowDuration: 3,
  enemySlowUpgradedPercent: 0.225,

  goldInterestPercent: 0.5,
  goldInterestDuration: 2,
  goldInterestUpgradedPercent: 0.75,

  shieldWallBlocks: 3,
  shieldWallUpgradedBlocks: 5,

  chainLightningBounces: 2,
  chainLightningDuration: 2,
  chainLightningUpgradedBounces: 3,

  precisionPercent: 0.5,
  precisionDuration: 2,
  precisionUpgradedPercent: 0.75,

  // Utility values
  drawTwoCount: 2,
  energySurgeAmount: 2,
} as const;

// ── Card Definitions ──────────────────────────────────────────

export const CARD_DEFINITIONS: Record<CardId, CardDefinition> = {

  // ── Tower Cards (6) ─────────────────────────────────────────

  [CardId.TOWER_BASIC]: {
    id: CardId.TOWER_BASIC,
    name: 'Basic Tower',
    description: 'Deploy a Basic tower.',
    type: CardType.TOWER,
    rarity: CardRarity.STARTER,
    energyCost: CARD_VALUES.energyBasic,
    upgraded: false,
    effect: { type: 'tower', towerType: TowerType.BASIC },
  },

  [CardId.TOWER_SNIPER]: {
    id: CardId.TOWER_SNIPER,
    name: 'Sniper Tower',
    description: 'Deploy a Sniper tower.',
    type: CardType.TOWER,
    rarity: CardRarity.STARTER,
    energyCost: CARD_VALUES.energySniper,
    upgraded: false,
    effect: { type: 'tower', towerType: TowerType.SNIPER },
    upgradedEffect: { type: 'tower', towerType: TowerType.SNIPER },
  },

  [CardId.TOWER_SPLASH]: {
    id: CardId.TOWER_SPLASH,
    name: 'Splash Tower',
    description: 'Deploy a Splash tower.',
    type: CardType.TOWER,
    rarity: CardRarity.STARTER,
    energyCost: CARD_VALUES.energySplash,
    upgraded: false,
    effect: { type: 'tower', towerType: TowerType.SPLASH },
  },

  [CardId.TOWER_SLOW]: {
    id: CardId.TOWER_SLOW,
    name: 'Slow Tower',
    description: 'Deploy a Slow tower.',
    type: CardType.TOWER,
    rarity: CardRarity.STARTER,
    energyCost: CARD_VALUES.energySlow,
    upgraded: false,
    effect: { type: 'tower', towerType: TowerType.SLOW },
  },

  [CardId.TOWER_CHAIN]: {
    id: CardId.TOWER_CHAIN,
    name: 'Chain Tower',
    description: 'Deploy a Chain tower.',
    type: CardType.TOWER,
    rarity: CardRarity.STARTER,
    energyCost: CARD_VALUES.energyChain,
    upgraded: false,
    effect: { type: 'tower', towerType: TowerType.CHAIN },
  },

  [CardId.TOWER_MORTAR]: {
    id: CardId.TOWER_MORTAR,
    name: 'Mortar Tower',
    description: 'Deploy a Mortar tower.',
    type: CardType.TOWER,
    rarity: CardRarity.STARTER,
    energyCost: CARD_VALUES.energyMortar,
    upgraded: false,
    effect: { type: 'tower', towerType: TowerType.MORTAR },
    upgradedEffect: { type: 'tower', towerType: TowerType.MORTAR },
  },

  // ── Spell Cards (8) ─────────────────────────────────────────

  [CardId.GOLD_RUSH]: {
    id: CardId.GOLD_RUSH,
    name: 'Gold Rush',
    description: 'Gain 40 gold.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: { type: 'spell', spellId: 'gold_rush', value: CARD_VALUES.goldRushGold },
    upgradedEffect: { type: 'spell', spellId: 'gold_rush', value: 60 },
  },

  [CardId.REPAIR_WALLS]: {
    id: CardId.REPAIR_WALLS,
    name: 'Repair Walls',
    description: 'Restore 2 lives.',
    type: CardType.SPELL,
    rarity: CardRarity.UNCOMMON,
    energyCost: 1,
    upgraded: false,
    effect: { type: 'spell', spellId: 'repair_walls', value: CARD_VALUES.repairWallsLives },
    upgradedEffect: { type: 'spell', spellId: 'repair_walls', value: 3 },
  },

  [CardId.SCOUT_AHEAD]: {
    id: CardId.SCOUT_AHEAD,
    name: 'Scout Ahead',
    description: 'Reveal next 3 waves.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: 0,
    upgraded: false,
    effect: { type: 'spell', spellId: 'scout_ahead', value: CARD_VALUES.scoutAheadWaves },
    upgradedEffect: { type: 'spell', spellId: 'scout_ahead', value: 5 },
  },

  [CardId.LIGHTNING_STRIKE]: {
    id: CardId.LIGHTNING_STRIKE,
    name: 'Lightning Strike',
    description: 'Deal 100 damage to the strongest enemy.',
    type: CardType.SPELL,
    rarity: CardRarity.UNCOMMON,
    energyCost: 2,
    upgraded: false,
    effect: { type: 'spell', spellId: 'lightning_strike', value: CARD_VALUES.lightningStrikeDamage },
    upgradedEffect: { type: 'spell', spellId: 'lightning_strike', value: 150 },
  },

  [CardId.FROST_WAVE]: {
    id: CardId.FROST_WAVE,
    name: 'Frost Wave',
    description: 'Slow all enemies by 50% for 5 seconds.',
    type: CardType.SPELL,
    rarity: CardRarity.UNCOMMON,
    energyCost: 2,
    upgraded: false,
    effect: { type: 'spell', spellId: 'frost_wave', value: CARD_VALUES.frostWaveDuration },
    upgradedEffect: { type: 'spell', spellId: 'frost_wave', value: 8 },
  },

  [CardId.SALVAGE]: {
    id: CardId.SALVAGE,
    name: 'Salvage',
    description: 'Sell a tower for 100% refund.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: { type: 'spell', spellId: 'salvage', value: 1 },
  },

  [CardId.FORTIFY]: {
    id: CardId.FORTIFY,
    name: 'Fortify',
    description: 'Upgrade a random tower one level for free.',
    type: CardType.SPELL,
    rarity: CardRarity.RARE,
    energyCost: 1,
    upgraded: false,
    effect: { type: 'spell', spellId: 'fortify', value: 1 },
    upgradedEffect: { type: 'spell', spellId: 'fortify', value: 0 },  // 0 energy when upgraded
  },

  [CardId.OVERCLOCK]: {
    id: CardId.OVERCLOCK,
    name: 'Overclock',
    description: 'All towers fire 50% faster for the current wave.',
    type: CardType.SPELL,
    rarity: CardRarity.RARE,
    energyCost: 2,
    upgraded: false,
    effect: { type: 'spell', spellId: 'overclock', value: 0.5 },
    upgradedEffect: { type: 'spell', spellId: 'overclock', value: 0.75 },
  },

  // ── Modifier Cards (8) ───────────────────────────────────────

  [CardId.DAMAGE_BOOST]: {
    id: CardId.DAMAGE_BOOST,
    name: 'Damage Boost',
    description: 'All towers +25% damage for 2 waves.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: 'damage',
      value: CARD_VALUES.damageBoostPercent,
      duration: CARD_VALUES.damageBoostDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: 'damage',
      value: CARD_VALUES.damageBoostUpgradedPercent,
      duration: CARD_VALUES.damageBoostDuration,
    },
  },

  [CardId.RANGE_EXTEND]: {
    id: CardId.RANGE_EXTEND,
    name: 'Range Extend',
    description: 'All towers +20% range for 2 waves.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: 'range',
      value: CARD_VALUES.rangeExtendPercent,
      duration: CARD_VALUES.rangeExtendDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: 'range',
      value: CARD_VALUES.rangeExtendUpgradedPercent,
      duration: CARD_VALUES.rangeExtendDuration,
    },
  },

  [CardId.RAPID_FIRE]: {
    id: CardId.RAPID_FIRE,
    name: 'Rapid Fire',
    description: 'All towers fire 30% faster for 2 waves.',
    type: CardType.MODIFIER,
    rarity: CardRarity.UNCOMMON,
    energyCost: 2,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: 'fireRate',
      value: CARD_VALUES.rapidFirePercent,
      duration: CARD_VALUES.rapidFireDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: 'fireRate',
      value: CARD_VALUES.rapidFireUpgradedPercent,
      duration: CARD_VALUES.rapidFireDuration,
    },
  },

  [CardId.ENEMY_SLOW]: {
    id: CardId.ENEMY_SLOW,
    name: 'Enemy Slow',
    description: 'All enemies 15% slower for 3 waves.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: 'enemySpeed',
      value: CARD_VALUES.enemySlowPercent,
      duration: CARD_VALUES.enemySlowDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: 'enemySpeed',
      value: CARD_VALUES.enemySlowUpgradedPercent,
      duration: CARD_VALUES.enemySlowDuration,
    },
  },

  [CardId.GOLD_INTEREST]: {
    id: CardId.GOLD_INTEREST,
    name: 'Gold Interest',
    description: '+50% gold from kills for 2 waves.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: 'goldMultiplier',
      value: CARD_VALUES.goldInterestPercent,
      duration: CARD_VALUES.goldInterestDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: 'goldMultiplier',
      value: CARD_VALUES.goldInterestUpgradedPercent,
      duration: CARD_VALUES.goldInterestDuration,
    },
  },

  [CardId.SHIELD_WALL]: {
    id: CardId.SHIELD_WALL,
    name: 'Shield Wall',
    description: 'Block next 3 enemy leaks.',
    type: CardType.MODIFIER,
    rarity: CardRarity.UNCOMMON,
    energyCost: 2,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: 'leakBlock',
      value: CARD_VALUES.shieldWallBlocks,
      duration: 0,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: 'leakBlock',
      value: CARD_VALUES.shieldWallUpgradedBlocks,
      duration: 0,
    },
  },

  [CardId.CHAIN_LIGHTNING]: {
    id: CardId.CHAIN_LIGHTNING,
    name: 'Chain Lightning',
    description: 'Chain towers +2 bounces for 2 waves.',
    type: CardType.MODIFIER,
    rarity: CardRarity.UNCOMMON,
    energyCost: 2,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: 'chainBounces',
      value: CARD_VALUES.chainLightningBounces,
      duration: CARD_VALUES.chainLightningDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: 'chainBounces',
      value: CARD_VALUES.chainLightningUpgradedBounces,
      duration: CARD_VALUES.chainLightningDuration,
    },
  },

  [CardId.PRECISION]: {
    id: CardId.PRECISION,
    name: 'Precision',
    description: 'Sniper towers +50% damage for 2 waves.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: 'sniperDamage',
      value: CARD_VALUES.precisionPercent,
      duration: CARD_VALUES.precisionDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: 'sniperDamage',
      value: CARD_VALUES.precisionUpgradedPercent,
      duration: CARD_VALUES.precisionDuration,
    },
  },

  // ── Utility Cards (3) ────────────────────────────────────────

  [CardId.DRAW_TWO]: {
    id: CardId.DRAW_TWO,
    name: 'Draw Two',
    description: 'Draw 2 cards.',
    type: CardType.UTILITY,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: { type: 'utility', utilityId: 'draw', value: CARD_VALUES.drawTwoCount },
    upgradedEffect: { type: 'utility', utilityId: 'draw', value: 3 },
  },

  [CardId.RECYCLE]: {
    id: CardId.RECYCLE,
    name: 'Recycle',
    description: 'Discard your hand, then draw that many cards plus one.',
    type: CardType.UTILITY,
    rarity: CardRarity.UNCOMMON,
    energyCost: 0,
    upgraded: false,
    effect: { type: 'utility', utilityId: 'recycle', value: 1 },
    upgradedEffect: { type: 'utility', utilityId: 'recycle', value: 2 },
  },

  [CardId.ENERGY_SURGE]: {
    id: CardId.ENERGY_SURGE,
    name: 'Energy Surge',
    description: 'Gain 2 energy this wave.',
    type: CardType.UTILITY,
    rarity: CardRarity.RARE,
    energyCost: 0,
    upgraded: false,
    effect: { type: 'utility', utilityId: 'energy', value: CARD_VALUES.energySurgeAmount },
    upgradedEffect: { type: 'utility', utilityId: 'energy', value: 3 },
  },
};

// ── Helper Functions ──────────────────────────────────────────

export function getCardDefinition(id: CardId): CardDefinition {
  return CARD_DEFINITIONS[id];
}

export function getCardsByType(type: CardType): CardDefinition[] {
  return Object.values(CARD_DEFINITIONS).filter(c => c.type === type);
}

export function getCardsByRarity(rarity: CardRarity): CardDefinition[] {
  return Object.values(CARD_DEFINITIONS).filter(c => c.rarity === rarity);
}

/**
 * Returns the default starting deck card IDs:
 * 4x TOWER_BASIC, 2x TOWER_SNIPER, 1x TOWER_SPLASH, 1x TOWER_SLOW,
 * 1x GOLD_RUSH, 1x DAMAGE_BOOST = 10 cards
 */
export function getStarterDeck(): CardId[] {
  return [
    CardId.TOWER_BASIC,
    CardId.TOWER_BASIC,
    CardId.TOWER_BASIC,
    CardId.TOWER_BASIC,
    CardId.TOWER_SNIPER,
    CardId.TOWER_SNIPER,
    CardId.TOWER_SPLASH,
    CardId.TOWER_SLOW,
    CardId.GOLD_RUSH,
    CardId.DAMAGE_BOOST,
  ];
}
