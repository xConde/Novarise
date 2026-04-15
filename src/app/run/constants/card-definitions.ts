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
  CardInstance,
  CardRarity,
  CardType,
  TowerCardEffect,
} from '../models/card.model';
import { MODIFIER_STAT } from './modifier-stat.constants';

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
  drawTwoUpgradedCount: 3,
  recycleDefaultValue: 1,
  recycleUpgradedValue: 2,
  energySurgeAmount: 2,
  energySurgeUpgradedAmount: 3,

  // Spell upgraded values
  goldRushUpgradedGold: 60,
  repairWallsUpgradedLives: 3,
  scoutAheadUpgradedWaves: 5,
  lightningStrikeUpgradedDamage: 150,
  frostWaveUpgradedDuration: 8,
  // salvage has no upgradedEffect; the base value of 1 is a boolean-style flag (full refund multiplier)
  fortifyDefaultEnergy: 1,
  fortifyUpgradedEnergy: 0,
  overclockFireRateBoost: 0.5,
  overclockUpgradedFireRateBoost: 0.75,

  // ── H3 keyword card values ────────────────────────────────

  // exhaust cards
  lastStandLives: 5,
  lastStandUpgradedLives: 8,
  overloadDamageBoost: 0.5,
  overloadUpgradedDamageBoost: 0.75,
  overloadDuration: 2,
  battleSurgeDraw: 3,
  battleSurgeUpgradedDraw: 4,
  ironWillRangeBoost: 0.4,
  ironWillUpgradedRangeBoost: 0.6,
  ironWillDuration: 3,

  // retain cards
  stockpileEnergy: 1,
  stockpileUpgradedEnergy: 2,
  warFundGold: 25,
  warFundUpgradedGold: 40,
  vanguardDamageBoost: 0.3,
  vanguardUpgradedDamageBoost: 0.45,
  vanguardDuration: 3,
  bulwarkRangeBoost: 0.25,
  bulwarkUpgradedRangeBoost: 0.4,
  bulwarkDuration: 3,

  // innate cards
  openingGambitDraw: 2,
  openingGambitUpgradedDraw: 3,
  scoutEliteWaves: 5,
  scoutEliteUpgradedWaves: 8,
  advanceGuardGold: 30,
  advanceGuardUpgradedGold: 50,
  firstBloodDamage: 60,
  firstBloodUpgradedDamage: 90,

  // ethereal cards
  desperateMeasuresLives: 3,
  desperateMeasuresUpgradedLives: 5,
  warpStrikeDamage: 80,
  warpStrikeUpgradedDamage: 120,
  phantomGoldAmount: 50,
  phantomGoldUpgradedAmount: 75,

  // Tower variant stat multipliers
  sniperLightDamageMult: 0.7,
  sniperLightUpgradedDamageMult: 1.0,
  splashClusterRadiusMult: 0.6,
  splashClusterUpgradedRadiusMult: 0.85,
  slowAuraRangeMult: 1.5,
  slowAuraUpgradedRangeMult: 1.8,
  chainTeslaBounceBonus: 1,
  chainTeslaUpgradedBounceBonus: 2,
  mortarBarrageRadiusMult: 0.7,
  mortarBarrageUpgradedRadiusMult: 0.85,
  mortarBarrageDotMult: 0.8,
  mortarBarrageUpgradedDotMult: 0.9,
  basicReinforcedUpgradedDamageMult: 1.2,
  // Tower variant energy costs
  energyBasicReinforced: 2,
  energySniperLight: 2,
  energySplashCluster: 1,
  energySlowAura: 2,
  energyChainTesla: 3,
  energyMortarBarrage: 2,

  // ── Status-applying spell costs (Sprint 2b) ───────────────
  // Duration is governed by STATUS_EFFECT_CONFIGS — these are energy costs only.
  incinerateCost: 2,   // COMMON — matches FROST_WAVE cost parity (archetype swap: burn vs slow)
  toxicSprayCost: 2,   // UNCOMMON — POISON stacks over more turns, higher long-run value
  cryoPulseCost: 1,    // COMMON — single-target but gains card draw for extra economy
  cryoPulseDrawCount: 1,

  // ── Status payoff spell values (Sprint 2c) ────────────────
  detonateDamagePerBurning: 25,
  detonateUpgradedDamagePerBurning: 35,
  detonateCost: 1,
  epidemicCost: 2,
  epidemicCriticalMass: 2,       // need 2+ poisoned enemies to trigger
  epidemicUpgradedCriticalMass: 1, // upgraded: only need 1
} as const;

// ── Card Definitions ──────────────────────────────────────────

export const CARD_DEFINITIONS: Record<CardId, CardDefinition> = {

  // ── Tower Cards (6) ─────────────────────────────────────────

  [CardId.TOWER_BASIC]: {
    id: CardId.TOWER_BASIC,
    name: 'Basic Tower',
    description: 'Deploy a Basic tower. Always in your opening hand.',
    upgradedDescription: 'Deploy a Basic tower at level 2. Always in your opening hand.',
    type: CardType.TOWER,
    rarity: CardRarity.STARTER,
    energyCost: CARD_VALUES.energyBasic,
    upgraded: false,
    effect: { type: 'tower', towerType: TowerType.BASIC },
    upgradedEffect: { type: 'tower', towerType: TowerType.BASIC, startLevel: 2 },
    // H3 red-team fix: guarantee at least one tower card is in the opening
    // hand so the player can always place something on turn 1. Without this,
    // a pure-spell opening hand leaves the board empty when enemies spawn.
    innate: true,
  },

  [CardId.TOWER_SNIPER]: {
    id: CardId.TOWER_SNIPER,
    name: 'Sniper Tower',
    description: 'Deploy a Sniper tower.',
    upgradedDescription: 'Deploy a Sniper tower at level 2.',
    type: CardType.TOWER,
    rarity: CardRarity.STARTER,
    energyCost: CARD_VALUES.energySniper,
    upgraded: false,
    effect: { type: 'tower', towerType: TowerType.SNIPER },
    upgradedEffect: { type: 'tower', towerType: TowerType.SNIPER, startLevel: 2 },
  },

  [CardId.TOWER_SPLASH]: {
    id: CardId.TOWER_SPLASH,
    name: 'Splash Tower',
    description: 'Deploy a Splash tower.',
    upgradedDescription: 'Deploy a Splash tower at level 2.',
    type: CardType.TOWER,
    rarity: CardRarity.STARTER,
    energyCost: CARD_VALUES.energySplash,
    upgraded: false,
    effect: { type: 'tower', towerType: TowerType.SPLASH },
    upgradedEffect: { type: 'tower', towerType: TowerType.SPLASH, startLevel: 2 },
  },

  [CardId.TOWER_SLOW]: {
    id: CardId.TOWER_SLOW,
    name: 'Slow Tower',
    description: 'Deploy a Slow tower.',
    upgradedDescription: 'Deploy a Slow tower at level 2.',
    type: CardType.TOWER,
    rarity: CardRarity.STARTER,
    energyCost: CARD_VALUES.energySlow,
    upgraded: false,
    effect: { type: 'tower', towerType: TowerType.SLOW },
    upgradedEffect: { type: 'tower', towerType: TowerType.SLOW, startLevel: 2 },
  },

  [CardId.TOWER_CHAIN]: {
    id: CardId.TOWER_CHAIN,
    name: 'Chain Tower',
    description: 'Deploy a Chain tower.',
    upgradedDescription: 'Deploy a Chain tower at level 2.',
    type: CardType.TOWER,
    rarity: CardRarity.STARTER,
    energyCost: CARD_VALUES.energyChain,
    upgraded: false,
    effect: { type: 'tower', towerType: TowerType.CHAIN },
    upgradedEffect: { type: 'tower', towerType: TowerType.CHAIN, startLevel: 2 },
  },

  [CardId.TOWER_MORTAR]: {
    id: CardId.TOWER_MORTAR,
    name: 'Mortar Tower',
    description: 'Deploy a Mortar tower.',
    upgradedDescription: 'Deploy a Mortar tower at level 2.',
    type: CardType.TOWER,
    rarity: CardRarity.STARTER,
    energyCost: CARD_VALUES.energyMortar,
    upgraded: false,
    effect: { type: 'tower', towerType: TowerType.MORTAR },
    upgradedEffect: { type: 'tower', towerType: TowerType.MORTAR, startLevel: 2 },
  },

  // ── Tower Card Variants (6 — one per tower type) ─────────────

  [CardId.TOWER_BASIC_REINFORCED]: {
    id: CardId.TOWER_BASIC_REINFORCED,
    name: 'Reinforced Basic',
    description: 'Deploy a Basic tower at level 2. Pre-paid upgrade.',
    upgradedDescription: 'Deploy a Basic tower at level 2 with +20% damage.',
    type: CardType.TOWER,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.energyBasicReinforced,
    upgraded: false,
    effect: { type: 'tower' as const, towerType: TowerType.BASIC, startLevel: 2 },
    upgradedEffect: { type: 'tower' as const, towerType: TowerType.BASIC, startLevel: 2, statOverrides: { damageMultiplier: CARD_VALUES.basicReinforcedUpgradedDamageMult } },
  },

  [CardId.TOWER_SNIPER_LIGHT]: {
    id: CardId.TOWER_SNIPER_LIGHT,
    name: 'Light Sniper',
    description: 'Deploy a Sniper tower with 30% less damage.',
    upgradedDescription: 'Deploy a Sniper tower at full damage.',
    type: CardType.TOWER,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.energySniperLight,
    upgraded: false,
    effect: { type: 'tower' as const, towerType: TowerType.SNIPER, statOverrides: { damageMultiplier: CARD_VALUES.sniperLightDamageMult } },
    upgradedEffect: { type: 'tower' as const, towerType: TowerType.SNIPER, statOverrides: { damageMultiplier: CARD_VALUES.sniperLightUpgradedDamageMult } },
  },

  [CardId.TOWER_SPLASH_CLUSTER]: {
    id: CardId.TOWER_SPLASH_CLUSTER,
    name: 'Cluster Splash',
    description: 'Deploy a Splash tower with 40% smaller radius.',
    upgradedDescription: 'Deploy a Splash tower with 15% smaller radius.',
    type: CardType.TOWER,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.energySplashCluster,
    upgraded: false,
    effect: { type: 'tower' as const, towerType: TowerType.SPLASH, statOverrides: { splashRadiusMultiplier: CARD_VALUES.splashClusterRadiusMult } },
    upgradedEffect: { type: 'tower' as const, towerType: TowerType.SPLASH, statOverrides: { splashRadiusMultiplier: CARD_VALUES.splashClusterUpgradedRadiusMult } },
  },

  [CardId.TOWER_SLOW_AURA]: {
    id: CardId.TOWER_SLOW_AURA,
    name: 'Aura Slow',
    description: 'Deploy a Slow tower with 50% larger aura range.',
    upgradedDescription: 'Deploy a Slow tower with 80% larger aura range.',
    type: CardType.TOWER,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.energySlowAura,
    upgraded: false,
    effect: { type: 'tower' as const, towerType: TowerType.SLOW, statOverrides: { rangeMultiplier: CARD_VALUES.slowAuraRangeMult } },
    upgradedEffect: { type: 'tower' as const, towerType: TowerType.SLOW, statOverrides: { rangeMultiplier: CARD_VALUES.slowAuraUpgradedRangeMult } },
  },

  [CardId.TOWER_CHAIN_TESLA]: {
    id: CardId.TOWER_CHAIN_TESLA,
    name: 'Tesla Chain',
    description: 'Deploy a Chain tower with +1 starting chain bounce.',
    upgradedDescription: 'Deploy a Chain tower with +2 starting chain bounces.',
    type: CardType.TOWER,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.energyChainTesla,
    upgraded: false,
    effect: { type: 'tower' as const, towerType: TowerType.CHAIN, statOverrides: { chainBounceBonus: CARD_VALUES.chainTeslaBounceBonus } },
    upgradedEffect: { type: 'tower' as const, towerType: TowerType.CHAIN, statOverrides: { chainBounceBonus: CARD_VALUES.chainTeslaUpgradedBounceBonus } },
  },

  [CardId.TOWER_MORTAR_BARRAGE]: {
    id: CardId.TOWER_MORTAR_BARRAGE,
    name: 'Barrage Mortar',
    description: 'Deploy a Mortar tower with 30% smaller radius and 20% less DoT damage.',
    upgradedDescription: 'Deploy a Mortar tower with 15% smaller radius and 10% less DoT damage.',
    type: CardType.TOWER,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.energyMortarBarrage,
    upgraded: false,
    effect: { type: 'tower' as const, towerType: TowerType.MORTAR, statOverrides: { splashRadiusMultiplier: CARD_VALUES.mortarBarrageRadiusMult, dotDamageMultiplier: CARD_VALUES.mortarBarrageDotMult } },
    upgradedEffect: { type: 'tower' as const, towerType: TowerType.MORTAR, statOverrides: { splashRadiusMultiplier: CARD_VALUES.mortarBarrageUpgradedRadiusMult, dotDamageMultiplier: CARD_VALUES.mortarBarrageUpgradedDotMult } },
  },

  // ── Spell Cards (8) ─────────────────────────────────────────

  [CardId.GOLD_RUSH]: {
    id: CardId.GOLD_RUSH,
    name: 'Gold Rush',
    description: 'Gain 40 gold.',
    upgradedDescription: 'Gain 60 gold.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: { type: 'spell', spellId: 'gold_rush', value: CARD_VALUES.goldRushGold },
    upgradedEffect: { type: 'spell', spellId: 'gold_rush', value: CARD_VALUES.goldRushUpgradedGold },
  },

  [CardId.REPAIR_WALLS]: {
    id: CardId.REPAIR_WALLS,
    name: 'Repair Walls',
    description: 'Restore 2 lives.',
    upgradedDescription: 'Restore 3 lives.',
    type: CardType.SPELL,
    rarity: CardRarity.UNCOMMON,
    energyCost: 1,
    upgraded: false,
    effect: { type: 'spell', spellId: 'repair_walls', value: CARD_VALUES.repairWallsLives },
    upgradedEffect: { type: 'spell', spellId: 'repair_walls', value: CARD_VALUES.repairWallsUpgradedLives },
  },

  [CardId.SCOUT_AHEAD]: {
    id: CardId.SCOUT_AHEAD,
    name: 'Scout Ahead',
    description: 'Reveal next 3 waves.',
    upgradedDescription: 'Reveal next 5 waves.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: 0,
    upgraded: false,
    effect: { type: 'spell', spellId: 'scout_ahead', value: CARD_VALUES.scoutAheadWaves },
    upgradedEffect: { type: 'spell', spellId: 'scout_ahead', value: CARD_VALUES.scoutAheadUpgradedWaves },
  },

  [CardId.LIGHTNING_STRIKE]: {
    id: CardId.LIGHTNING_STRIKE,
    name: 'Lightning Strike',
    description: 'Deal 100 damage to the strongest enemy.',
    upgradedDescription: 'Deal 150 damage to the strongest enemy.',
    type: CardType.SPELL,
    rarity: CardRarity.UNCOMMON,
    energyCost: 2,
    upgraded: false,
    effect: { type: 'spell', spellId: 'lightning_strike', value: CARD_VALUES.lightningStrikeDamage },
    upgradedEffect: { type: 'spell', spellId: 'lightning_strike', value: CARD_VALUES.lightningStrikeUpgradedDamage },
  },

  [CardId.FROST_WAVE]: {
    id: CardId.FROST_WAVE,
    name: 'Frost Wave',
    description: 'Slow all enemies by 50% for 5 seconds.',
    upgradedDescription: 'Slow all enemies by 50% for 8 seconds.',
    type: CardType.SPELL,
    rarity: CardRarity.UNCOMMON,
    energyCost: 2,
    upgraded: false,
    effect: { type: 'spell', spellId: 'frost_wave', value: CARD_VALUES.frostWaveDuration },
    upgradedEffect: { type: 'spell', spellId: 'frost_wave', value: CARD_VALUES.frostWaveUpgradedDuration },
  },

  [CardId.SALVAGE]: {
    id: CardId.SALVAGE,
    name: 'Salvage',
    description: 'Sell a tower for 100% refund.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    // salvage has no upgradedEffect; value: 1 is a boolean-style flag (full refund multiplier)
    effect: { type: 'spell', spellId: 'salvage', value: 1 },
  },

  [CardId.FORTIFY]: {
    id: CardId.FORTIFY,
    name: 'Fortify',
    description: 'Upgrade a random tower one level for free.',
    upgradedDescription: 'Upgrade a random tower one level for free. Costs 0 energy.',
    type: CardType.SPELL,
    rarity: CardRarity.RARE,
    energyCost: CARD_VALUES.fortifyDefaultEnergy,
    upgraded: false,
    effect: { type: 'spell', spellId: 'fortify', value: CARD_VALUES.fortifyDefaultEnergy },
    upgradedEffect: { type: 'spell', spellId: 'fortify', value: CARD_VALUES.fortifyUpgradedEnergy },  // 0 energy when upgraded
  },

  [CardId.OVERCLOCK]: {
    id: CardId.OVERCLOCK,
    name: 'Overclock',
    description: 'All towers fire 50% faster for the current wave.',
    upgradedDescription: 'All towers fire 75% faster for the current wave.',
    type: CardType.SPELL,
    rarity: CardRarity.RARE,
    energyCost: 2,
    upgraded: false,
    effect: { type: 'spell', spellId: 'overclock', value: CARD_VALUES.overclockFireRateBoost },
    upgradedEffect: { type: 'spell', spellId: 'overclock', value: CARD_VALUES.overclockUpgradedFireRateBoost },
  },

  // ── Status-applying Spell Cards (3) — Sprint 2b ─────────────

  [CardId.INCINERATE]: {
    id: CardId.INCINERATE,
    name: 'Incinerate',
    description: 'Apply Burn to all enemies.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.incinerateCost,
    upgraded: false,
    // value field unused for gameplay — duration is governed by STATUS_EFFECT_CONFIGS[BURN].
    // value > 0 in upgradedEffect is a balance flag reserved for a future content sprint
    // (e.g. extend duration). Handler ignores value in Sprint 2b.
    effect: { type: 'spell', spellId: 'incinerate', value: 0 },
    upgradedEffect: { type: 'spell', spellId: 'incinerate', value: 1 },
  },

  [CardId.TOXIC_SPRAY]: {
    id: CardId.TOXIC_SPRAY,
    name: 'Toxic Spray',
    description: 'Apply Poison to all enemies.',
    type: CardType.SPELL,
    rarity: CardRarity.UNCOMMON,
    energyCost: CARD_VALUES.toxicSprayCost,
    upgraded: false,
    // Same value-as-flag convention as INCINERATE. Handler ignores value in Sprint 2b.
    effect: { type: 'spell', spellId: 'toxic_spray', value: 0 },
    upgradedEffect: { type: 'spell', spellId: 'toxic_spray', value: 1 },
  },

  [CardId.CRYO_PULSE]: {
    id: CardId.CRYO_PULSE,
    name: 'Cryo Pulse',
    description: 'Apply Slow to the lead enemy. Draw 1 card.',
    upgradedDescription: 'Apply Slow to the lead enemy. Draw 2 cards.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.cryoPulseCost,
    upgraded: false,
    // effect.value = draw count. Upgraded draws 2 cards instead of 1.
    effect: { type: 'spell', spellId: 'cryo_pulse', value: CARD_VALUES.cryoPulseDrawCount },
    upgradedEffect: { type: 'spell', spellId: 'cryo_pulse', value: 2 },
  },

  // ── Status Payoff Spell Cards (2) — Sprint 2c ────────────────

  [CardId.DETONATE]: {
    id: CardId.DETONATE,
    name: 'Detonate',
    description: 'Deal 25 damage to each burning enemy. Consume Burn.',
    upgradedDescription: 'Deal 35 damage to each burning enemy. Consume Burn.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.detonateCost,
    upgraded: false,
    effect: { type: 'spell', spellId: 'detonate', value: CARD_VALUES.detonateDamagePerBurning },
    upgradedEffect: { type: 'spell', spellId: 'detonate', value: CARD_VALUES.detonateUpgradedDamagePerBurning },
  },

  [CardId.EPIDEMIC]: {
    id: CardId.EPIDEMIC,
    name: 'Epidemic',
    description: 'If 2 or more enemies are Poisoned, apply Poison to all other enemies.',
    upgradedDescription: 'If 1 or more enemies are Poisoned, apply Poison to all other enemies.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.epidemicCost,
    upgraded: false,
    effect: { type: 'spell', spellId: 'epidemic', value: CARD_VALUES.epidemicCriticalMass },
    upgradedEffect: { type: 'spell', spellId: 'epidemic', value: CARD_VALUES.epidemicUpgradedCriticalMass },
  },

  // ── Modifier Cards (8) ───────────────────────────────────────

  [CardId.DAMAGE_BOOST]: {
    id: CardId.DAMAGE_BOOST,
    name: 'Damage Boost',
    description: 'All towers +25% damage for 2 waves.',
    upgradedDescription: 'All towers +37.5% damage for 2 waves.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: MODIFIER_STAT.DAMAGE,
      value: CARD_VALUES.damageBoostPercent,
      duration: CARD_VALUES.damageBoostDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: MODIFIER_STAT.DAMAGE,
      value: CARD_VALUES.damageBoostUpgradedPercent,
      duration: CARD_VALUES.damageBoostDuration,
    },
  },

  [CardId.RANGE_EXTEND]: {
    id: CardId.RANGE_EXTEND,
    name: 'Range Extend',
    description: 'All towers +20% range for 2 waves.',
    upgradedDescription: 'All towers +30% range for 2 waves.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: MODIFIER_STAT.RANGE,
      value: CARD_VALUES.rangeExtendPercent,
      duration: CARD_VALUES.rangeExtendDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: MODIFIER_STAT.RANGE,
      value: CARD_VALUES.rangeExtendUpgradedPercent,
      duration: CARD_VALUES.rangeExtendDuration,
    },
  },

  [CardId.RAPID_FIRE]: {
    id: CardId.RAPID_FIRE,
    name: 'Rapid Fire',
    description: 'All towers fire 30% faster for 2 waves.',
    upgradedDescription: 'All towers fire 45% faster for 2 waves.',
    type: CardType.MODIFIER,
    rarity: CardRarity.UNCOMMON,
    energyCost: 2,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: MODIFIER_STAT.FIRE_RATE,
      value: CARD_VALUES.rapidFirePercent,
      duration: CARD_VALUES.rapidFireDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: MODIFIER_STAT.FIRE_RATE,
      value: CARD_VALUES.rapidFireUpgradedPercent,
      duration: CARD_VALUES.rapidFireDuration,
    },
  },

  [CardId.ENEMY_SLOW]: {
    id: CardId.ENEMY_SLOW,
    name: 'Enemy Slow',
    description: 'All enemies 15% slower for 3 waves.',
    upgradedDescription: 'All enemies 22.5% slower for 3 waves.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: MODIFIER_STAT.ENEMY_SPEED,
      value: CARD_VALUES.enemySlowPercent,
      duration: CARD_VALUES.enemySlowDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: MODIFIER_STAT.ENEMY_SPEED,
      value: CARD_VALUES.enemySlowUpgradedPercent,
      duration: CARD_VALUES.enemySlowDuration,
    },
  },

  [CardId.GOLD_INTEREST]: {
    id: CardId.GOLD_INTEREST,
    name: 'Gold Interest',
    description: '+50% gold from kills for 2 waves.',
    upgradedDescription: '+75% gold from kills for 2 waves.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: MODIFIER_STAT.GOLD_MULTIPLIER,
      value: CARD_VALUES.goldInterestPercent,
      duration: CARD_VALUES.goldInterestDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: MODIFIER_STAT.GOLD_MULTIPLIER,
      value: CARD_VALUES.goldInterestUpgradedPercent,
      duration: CARD_VALUES.goldInterestDuration,
    },
  },

  [CardId.SHIELD_WALL]: {
    id: CardId.SHIELD_WALL,
    name: 'Shield Wall',
    description: 'Block next 3 enemy leaks.',
    upgradedDescription: 'Block next 5 enemy leaks.',
    type: CardType.MODIFIER,
    rarity: CardRarity.UNCOMMON,
    energyCost: 2,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: MODIFIER_STAT.LEAK_BLOCK,
      value: CARD_VALUES.shieldWallBlocks,
      duration: 0,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: MODIFIER_STAT.LEAK_BLOCK,
      value: CARD_VALUES.shieldWallUpgradedBlocks,
      duration: 0,
    },
  },

  [CardId.CHAIN_LIGHTNING]: {
    id: CardId.CHAIN_LIGHTNING,
    name: 'Chain Lightning',
    description: 'Chain towers +2 bounces for 2 waves.',
    upgradedDescription: 'Chain towers +3 bounces for 2 waves.',
    type: CardType.MODIFIER,
    rarity: CardRarity.UNCOMMON,
    energyCost: 2,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: MODIFIER_STAT.CHAIN_BOUNCES,
      value: CARD_VALUES.chainLightningBounces,
      duration: CARD_VALUES.chainLightningDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: MODIFIER_STAT.CHAIN_BOUNCES,
      value: CARD_VALUES.chainLightningUpgradedBounces,
      duration: CARD_VALUES.chainLightningDuration,
    },
  },

  [CardId.PRECISION]: {
    id: CardId.PRECISION,
    name: 'Precision',
    description: 'Sniper towers +50% damage for 2 waves.',
    upgradedDescription: 'Sniper towers +75% damage for 2 waves.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: MODIFIER_STAT.SNIPER_DAMAGE,
      value: CARD_VALUES.precisionPercent,
      duration: CARD_VALUES.precisionDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: MODIFIER_STAT.SNIPER_DAMAGE,
      value: CARD_VALUES.precisionUpgradedPercent,
      duration: CARD_VALUES.precisionDuration,
    },
  },

  // ── Utility Cards (3) ────────────────────────────────────────

  [CardId.DRAW_TWO]: {
    id: CardId.DRAW_TWO,
    name: 'Draw Two',
    description: 'Draw 2 cards.',
    upgradedDescription: 'Draw 3 cards.',
    type: CardType.UTILITY,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    effect: { type: 'utility', utilityId: 'draw', value: CARD_VALUES.drawTwoCount },
    upgradedEffect: { type: 'utility', utilityId: 'draw', value: CARD_VALUES.drawTwoUpgradedCount },
  },

  [CardId.RECYCLE]: {
    id: CardId.RECYCLE,
    name: 'Recycle',
    description: 'Discard your hand, then draw that many cards plus one.',
    upgradedDescription: 'Discard your hand, then draw that many cards plus two.',
    type: CardType.UTILITY,
    rarity: CardRarity.UNCOMMON,
    energyCost: 0,
    upgraded: false,
    effect: { type: 'utility', utilityId: 'recycle', value: CARD_VALUES.recycleDefaultValue },
    upgradedEffect: { type: 'utility', utilityId: 'recycle', value: CARD_VALUES.recycleUpgradedValue },
  },

  [CardId.ENERGY_SURGE]: {
    id: CardId.ENERGY_SURGE,
    name: 'Energy Surge',
    description: 'Gain 2 energy this wave.',
    upgradedDescription: 'Gain 3 energy this wave.',
    type: CardType.UTILITY,
    rarity: CardRarity.RARE,
    energyCost: 0,
    upgraded: false,
    effect: { type: 'utility', utilityId: 'energy', value: CARD_VALUES.energySurgeAmount },
    upgradedEffect: { type: 'utility', utilityId: 'energy', value: CARD_VALUES.energySurgeUpgradedAmount },
  },

  // ── H3 Keyword Cards (15) ─────────────────────────────────────────────────

  // ── Exhaust (4) ───────────────────────────────────────────

  /**
   * LAST_STAND — Ethereal pressure relief. Restores lives instantly but is
   * removed from the encounter after use so it can't be hoarded.
   */
  [CardId.LAST_STAND]: {
    id: CardId.LAST_STAND,
    name: 'Last Stand',
    description: 'Restore 5 lives. Exhaust.',
    upgradedDescription: 'Restore 8 lives. Exhaust.',
    type: CardType.SPELL,
    rarity: CardRarity.RARE,
    energyCost: 1,
    upgraded: false,
    exhaust: true,
    effect: { type: 'spell', spellId: 'repair_walls', value: CARD_VALUES.lastStandLives },
    upgradedEffect: { type: 'spell', spellId: 'repair_walls', value: CARD_VALUES.lastStandUpgradedLives },
  },

  /**
   * OVERLOAD — Burst damage window at real cost. All towers hit harder for
   * the next 2 waves, but the card is gone from the encounter after.
   */
  [CardId.OVERLOAD]: {
    id: CardId.OVERLOAD,
    name: 'Overload',
    description: 'All towers deal +50% damage for 2 waves. Exhaust.',
    upgradedDescription: 'All towers deal +75% damage for 2 waves. Exhaust.',
    type: CardType.MODIFIER,
    rarity: CardRarity.RARE,
    energyCost: 2,
    upgraded: false,
    exhaust: true,
    effect: {
      type: 'modifier',
      stat: MODIFIER_STAT.DAMAGE,
      value: CARD_VALUES.overloadDamageBoost,
      duration: CARD_VALUES.overloadDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: MODIFIER_STAT.DAMAGE,
      value: CARD_VALUES.overloadUpgradedDamageBoost,
      duration: CARD_VALUES.overloadDuration,
    },
  },

  /**
   * BATTLE_SURGE — Burst draw for a critical turn. Exhaust ensures it's a
   * one-time desperation play, not a recurring engine piece.
   */
  [CardId.BATTLE_SURGE]: {
    id: CardId.BATTLE_SURGE,
    name: 'Battle Surge',
    description: 'Draw 3 cards. Exhaust.',
    upgradedDescription: 'Draw 4 cards. Exhaust.',
    type: CardType.UTILITY,
    rarity: CardRarity.UNCOMMON,
    energyCost: 1,
    upgraded: false,
    exhaust: true,
    effect: { type: 'utility', utilityId: 'draw', value: CARD_VALUES.battleSurgeDraw },
    upgradedEffect: { type: 'utility', utilityId: 'draw', value: CARD_VALUES.battleSurgeUpgradedDraw },
  },

  /**
   * IRON_WILL — Wide range bonus on a one-shot basis. Strong enough to
   * turn the tide of a hard wave without becoming a permanent fixture.
   */
  [CardId.IRON_WILL]: {
    id: CardId.IRON_WILL,
    name: 'Iron Will',
    description: 'All towers +40% range for 3 waves. Exhaust.',
    upgradedDescription: 'All towers +60% range for 3 waves. Exhaust.',
    type: CardType.MODIFIER,
    rarity: CardRarity.UNCOMMON,
    energyCost: 2,
    upgraded: false,
    exhaust: true,
    effect: {
      type: 'modifier',
      stat: MODIFIER_STAT.RANGE,
      value: CARD_VALUES.ironWillRangeBoost,
      duration: CARD_VALUES.ironWillDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: MODIFIER_STAT.RANGE,
      value: CARD_VALUES.ironWillUpgradedRangeBoost,
      duration: CARD_VALUES.ironWillDuration,
    },
  },

  // ── Retain (4) ───────────────────────────────────────────

  /**
   * STOCKPILE — Zero-cost retain card. Holding it generates energy, rewarding
   * patience and punishing players who dump their hand carelessly.
   */
  [CardId.STOCKPILE]: {
    id: CardId.STOCKPILE,
    name: 'Stockpile',
    description: 'Gain 1 energy. Retain.',
    upgradedDescription: 'Gain 2 energy. Retain.',
    type: CardType.UTILITY,
    rarity: CardRarity.UNCOMMON,
    energyCost: 0,
    upgraded: false,
    retain: true,
    effect: { type: 'utility', utilityId: 'energy', value: CARD_VALUES.stockpileEnergy },
    upgradedEffect: { type: 'utility', utilityId: 'energy', value: CARD_VALUES.stockpileUpgradedEnergy },
  },

  /**
   * WAR_FUND — Gold trickle that rewards sitting on it. Retain lets the player
   * choose the right moment to cash out.
   */
  [CardId.WAR_FUND]: {
    id: CardId.WAR_FUND,
    name: 'War Fund',
    description: 'Gain 25 gold. Retain.',
    upgradedDescription: 'Gain 40 gold. Retain.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: 0,
    upgraded: false,
    retain: true,
    effect: { type: 'spell', spellId: 'gold_rush', value: CARD_VALUES.warFundGold },
    upgradedEffect: { type: 'spell', spellId: 'gold_rush', value: CARD_VALUES.warFundUpgradedGold },
  },

  /**
   * VANGUARD — Persistent damage modifier that can be held until a wave
   * of heavy enemies arrives, then played for maximum impact.
   */
  [CardId.VANGUARD]: {
    id: CardId.VANGUARD,
    name: 'Vanguard',
    description: 'All towers +30% damage for 3 waves. Retain.',
    upgradedDescription: 'All towers +45% damage for 3 waves. Retain.',
    type: CardType.MODIFIER,
    rarity: CardRarity.UNCOMMON,
    energyCost: 2,
    upgraded: false,
    retain: true,
    effect: {
      type: 'modifier',
      stat: MODIFIER_STAT.DAMAGE,
      value: CARD_VALUES.vanguardDamageBoost,
      duration: CARD_VALUES.vanguardDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: MODIFIER_STAT.DAMAGE,
      value: CARD_VALUES.vanguardUpgradedDamageBoost,
      duration: CARD_VALUES.vanguardDuration,
    },
  },

  /**
   * BULWARK — Range extension held in hand for the perfect wave. Retain
   * gives the player agency to time the buff rather than playing it blind.
   */
  [CardId.BULWARK]: {
    id: CardId.BULWARK,
    name: 'Bulwark',
    description: 'All towers +25% range for 3 waves. Retain.',
    upgradedDescription: 'All towers +40% range for 3 waves. Retain.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    retain: true,
    effect: {
      type: 'modifier',
      stat: MODIFIER_STAT.RANGE,
      value: CARD_VALUES.bulwarkRangeBoost,
      duration: CARD_VALUES.bulwarkDuration,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: MODIFIER_STAT.RANGE,
      value: CARD_VALUES.bulwarkUpgradedRangeBoost,
      duration: CARD_VALUES.bulwarkDuration,
    },
  },

  // ── Innate (4) ───────────────────────────────────────────

  /**
   * OPENING_GAMBIT — Guarantees extra draw speed on turn 1. Innate
   * ensures the player has options at encounter start.
   */
  [CardId.OPENING_GAMBIT]: {
    id: CardId.OPENING_GAMBIT,
    name: 'Opening Gambit',
    description: 'Draw 2 cards. Innate.',
    upgradedDescription: 'Draw 3 cards. Innate.',
    type: CardType.UTILITY,
    rarity: CardRarity.UNCOMMON,
    energyCost: 0,
    upgraded: false,
    innate: true,
    effect: { type: 'utility', utilityId: 'draw', value: CARD_VALUES.openingGambitDraw },
    upgradedEffect: { type: 'utility', utilityId: 'draw', value: CARD_VALUES.openingGambitUpgradedDraw },
  },

  /**
   * SCOUT_ELITE — Always opens the encounter with full intel on upcoming
   * spawn schedules. Innate because intelligence is most valuable at the start.
   */
  [CardId.SCOUT_ELITE]: {
    id: CardId.SCOUT_ELITE,
    name: 'Scout Elite',
    description: 'Reveal the next 5 waves of spawns. Innate.',
    upgradedDescription: 'Reveal the next 8 waves of spawns. Innate.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: 1,
    upgraded: false,
    innate: true,
    effect: { type: 'spell', spellId: 'scout_ahead', value: CARD_VALUES.scoutEliteWaves },
    upgradedEffect: { type: 'spell', spellId: 'scout_ahead', value: CARD_VALUES.scoutEliteUpgradedWaves },
  },

  /**
   * ADVANCE_GUARD — Guaranteed opening-hand gold injection, letting the
   * player afford their first tower before combat begins.
   */
  [CardId.ADVANCE_GUARD]: {
    id: CardId.ADVANCE_GUARD,
    name: 'Advance Guard',
    description: 'Gain 30 gold. Innate.',
    upgradedDescription: 'Gain 50 gold. Innate.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: 0,
    upgraded: false,
    innate: true,
    effect: { type: 'spell', spellId: 'gold_rush', value: CARD_VALUES.advanceGuardGold },
    upgradedEffect: { type: 'spell', spellId: 'gold_rush', value: CARD_VALUES.advanceGuardUpgradedGold },
  },

  /**
   * FIRST_BLOOD — Opening-hand targeted strike to cull the strongest opener
   * before the first wave can do damage.
   */
  [CardId.FIRST_BLOOD]: {
    id: CardId.FIRST_BLOOD,
    name: 'First Blood',
    description: 'Deal 60 damage to the strongest enemy. Innate.',
    upgradedDescription: 'Deal 90 damage to the strongest enemy. Innate.',
    type: CardType.SPELL,
    rarity: CardRarity.UNCOMMON,
    energyCost: 1,
    upgraded: false,
    innate: true,
    effect: { type: 'spell', spellId: 'lightning_strike', value: CARD_VALUES.firstBloodDamage },
    upgradedEffect: { type: 'spell', spellId: 'lightning_strike', value: CARD_VALUES.firstBloodUpgradedDamage },
  },

  // ── Ethereal (3) ─────────────────────────────────────────

  /**
   * DESPERATE_MEASURES — Emergency life restore with a hard use-it-or-lose-it
   * constraint. Ethereal prevents hoarding a safety net between waves.
   */
  [CardId.DESPERATE_MEASURES]: {
    id: CardId.DESPERATE_MEASURES,
    name: 'Desperate Measures',
    description: 'Restore 3 lives. Ethereal.',
    upgradedDescription: 'Restore 5 lives. Ethereal.',
    type: CardType.SPELL,
    rarity: CardRarity.UNCOMMON,
    energyCost: 1,
    upgraded: false,
    ethereal: true,
    effect: { type: 'spell', spellId: 'repair_walls', value: CARD_VALUES.desperateMeasuresLives },
    upgradedEffect: { type: 'spell', spellId: 'repair_walls', value: CARD_VALUES.desperateMeasuresUpgradedLives },
  },

  /**
   * WARP_STRIKE — High damage that must be played NOW or wasted. Ethereal
   * creates spike tension: is this the right turn to burn it?
   */
  [CardId.WARP_STRIKE]: {
    id: CardId.WARP_STRIKE,
    name: 'Warp Strike',
    description: 'Deal 80 damage to the strongest enemy. Ethereal.',
    upgradedDescription: 'Deal 120 damage to the strongest enemy. Ethereal.',
    type: CardType.SPELL,
    rarity: CardRarity.RARE,
    energyCost: 2,
    upgraded: false,
    ethereal: true,
    effect: { type: 'spell', spellId: 'lightning_strike', value: CARD_VALUES.warpStrikeDamage },
    upgradedEffect: { type: 'spell', spellId: 'lightning_strike', value: CARD_VALUES.warpStrikeUpgradedDamage },
  },

  /**
   * PHANTOM_GOLD — Free gold that evaporates if not spent this turn.
   * Forces snap economic decisions and creates interesting resource tension.
   */
  [CardId.PHANTOM_GOLD]: {
    id: CardId.PHANTOM_GOLD,
    name: 'Phantom Gold',
    description: 'Gain 50 gold. Ethereal.',
    upgradedDescription: 'Gain 75 gold. Ethereal.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: 0,
    upgraded: false,
    ethereal: true,
    effect: { type: 'spell', spellId: 'gold_rush', value: CARD_VALUES.phantomGoldAmount },
    upgradedEffect: { type: 'spell', spellId: 'gold_rush', value: CARD_VALUES.phantomGoldUpgradedAmount },
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
 * M4 S1: starter deck expanded from 10 → 20 cards. StS standard starter is
 * 10 strikes + 5 defends + 1 special = ~16-17. Our equivalent leans heavier
 * on tower variety because tower placement is the primary action verb.
 *
 * Composition (20 cards):
 *   8x TOWER_BASIC   — innate, the always-available opener (red-team fix)
 *   3x TOWER_SNIPER  — long-range single-target
 *   2x TOWER_SPLASH  — early AoE
 *   2x TOWER_SLOW    — crowd control
 *   1x TOWER_CHAIN   — multi-target
 *   1x GOLD_RUSH     — economy spike
 *   1x DAMAGE_BOOST  — modifier
 *   1x DRAW_TWO      — utility
 *   1x ENERGY_SURGE  — utility
 */
/**
 * Resolve the active (upgraded or base) effect from a card instance.
 * Returns the `TowerCardEffect` if the card is a tower card, undefined otherwise.
 * Used by callers that need to read tower-card fields (startLevel, statOverrides)
 * at placement time.
 */
export function getActiveTowerEffect(card: CardInstance): TowerCardEffect | undefined {
  const def = getCardDefinition(card.cardId);
  const effect = (card.upgraded && def.upgradedEffect) ? def.upgradedEffect : def.effect;
  return effect.type === 'tower' ? effect : undefined;
}

export function getStarterDeck(): CardId[] {
  return [
    // Tower cards (16) — heavy basic mix
    CardId.TOWER_BASIC,
    CardId.TOWER_BASIC,
    CardId.TOWER_BASIC,
    CardId.TOWER_BASIC,
    CardId.TOWER_BASIC,
    CardId.TOWER_BASIC,
    CardId.TOWER_BASIC,
    CardId.TOWER_BASIC,
    CardId.TOWER_SNIPER,
    CardId.TOWER_SNIPER,
    CardId.TOWER_SNIPER,
    CardId.TOWER_SPLASH,
    CardId.TOWER_SPLASH,
    CardId.TOWER_SLOW,
    CardId.TOWER_SLOW,
    CardId.TOWER_CHAIN,
    // Spell + modifier + utility (4)
    CardId.GOLD_RUSH,
    CardId.DAMAGE_BOOST,
    CardId.DRAW_TWO,
    CardId.ENERGY_SURGE,
  ];
}
