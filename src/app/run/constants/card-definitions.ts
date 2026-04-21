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
  ElevationTargetCardEffect,
} from '../models/card.model';
import { MODIFIER_STAT } from './modifier-stat.constants';

// ── Card Effect Value Constants ───────────────────────────────

const CARD_VALUES = {
  // Tower card energy costs (tower cost / 50, rounded)
  energyBasic: 1,    // Basic: 50 / 50 = 1
  energySniper: 2,   // Sniper: 125 / 50 = 2.5 → floor = 2
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
  // Phase 1 Sprint 5 — fortify value now means "number of towers to upgrade".
  // Energy cost stays at 1 (set on the card definition); upgrade doubles output.
  // The legacy fortifyDefaultEnergy / fortifyUpgradedEnergy fields are removed.
  fortifyUpgradeCount: 1,
  fortifyUpgradedUpgradeCount: 2,
  // Phase 1 Sprint 5 — INCINERATE / TOXIC_SPRAY now read effect.value as the
  // status duration in turns. Base values match prior STATUS_EFFECT_CONFIGS
  // defaults (BURN: 3, POISON: 4); upgrades extend duration.
  incinerateBurnDuration: 3,
  incinerateUpgradedBurnDuration: 5,
  toxicSprayPoisonDuration: 4,
  toxicSprayUpgradedPoisonDuration: 6,
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

  // ── Cartographer archetype — terraform-target cards (Phase 2) ────────────
  // LAY_TILE (sprint 11): 1E common, permanent path addition. Upgraded card
  // additionally draws 1 card on success (cycle-card behavior); encoded as
  // TerraformTargetCardEffect.drawOnSuccess on the upgraded effect object.
  layTileCost: 1,
  layTileUpgradedDrawCount: 1,
  // BLOCK_PASSAGE (sprint 12): 1E common, temporary wall
  blockPassageCost: 1,
  blockPassageDuration: 2,
  blockPassageUpgradedDuration: 3,
  // BRIDGEHEAD (sprint 15): 2E uncommon, tower-only platform 3 turns (4 upgraded)
  bridgeheadCost: 2,
  bridgeheadDuration: 3,
  bridgeheadUpgradedDuration: 4,
  // COLLAPSE (sprint 16): 2E uncommon, permanent destroy + %max-HP damage
  collapseCost: 2,
  collapseDamagePctMaxHp: 0.5,
  collapseUpgradedDamagePctMaxHp: 0.75,

  // DETOUR (sprint 14): 2E uncommon, force all enemies onto the longest valid
  // path for one step. Modifies enemy routing, NOT tile state — terraform: false.
  // SpellCardEffect VALUE is a tier sentinel: 1 = reroute-only (base card),
  // 2 = reroute + damage (upgraded card). CardEffectService.applyDetour
  // branches on value ≥ 2 to pass a non-zero damage fraction through to
  // EnemyService.applyDetour.
  detourCost: 2,
  detourBaseValue: 1,
  detourUpgradedValue: 2,
  detourDamageFractionPerExtraStep: 0.08,   // 8% max-HP per extra path tile added

  // CARTOGRAPHER_SEAL (sprint 17): 2E rare anchor. All terraform mutations this
  // encounter persist permanently (duration is forced to null at resolve time).
  // VALUE acts as a tier sentinel — 1 = anchor-only (base card), 2 = anchor +
  // first-terraform-per-turn refund (upgraded card). CardPlayService checks the
  // anchor presence (base behavior) and separately calls
  // CardEffectService.tryConsumeTerraformRefund to gate the 1E refund.
  cartographerSealCost: 2,
  cartographerSealBaseValue: 1,
  cartographerSealUpgradedValue: 2,
  cartographerSealRefundAmount: 1,        // energy refunded on first terraform each turn
  // LABYRINTH_MIND (sprint 18): 2E rare build-around. Tower damage scales with
  // current spawner→exit path length. Multiplier = 1 + (pathLength * k).
  // k=0.02 → 30-tile path = 60% bonus, 50-tile path = 100% bonus.
  labyrinthMindCost: 2,
  labyrinthMindPathScaling: 0.02,
  labyrinthMindUpgradedPathScaling: 0.03,

  // ── Highground archetype — elevation-target cards (Phase 3, Sprints 27/28) ──
  // RAISE_PLATFORM (sprint 27): 1E common, raise a tile by 1 elevation unit.
  // Towers on raised tiles gain range (handled by TowerCombatService sprint 29).
  raisePlatformCost: 1,
  raisePlatformAmount: 1,       // +1 elevation unit per play
  // DEPRESS_TILE (sprint 28): 1E common, lower a tile by 1 elevation unit.
  // Enemies on lowered (negative-elevation) tiles take +25% incoming damage.
  depressTileCost: 1,
  depressTileAmount: 1,         // -1 elevation unit per play
  // Damage bonus applied in EnemyService.damageEnemy when tile elevation < 0.
  // +25% bonus received on exposed tiles (negative elevation).
  exposedDamageBonus: 0.25,

  // ── Highground archetype — HIGH_PERCH modifier (Sprint 29) ───────────────
  // HIGH_PERCH (1E common): towers on elevation ≥ threshold gain +25% range
  // for one wave (stacks additively with the passive per-elevation multiplier).
  highPerchCost: 1,
  highPerchBonus: 0.25,          // +25% range for qualifying towers (base)
  highPerchUpgradedBonus: 0.4,   // +40% range when upgraded
  highPerchThreshold: 2,         // minimum elevation to qualify for the bonus
  highPerchDuration: 1,          // wave countdown duration (one wave)

  // ── Highground archetype — CLIFFSIDE (Sprint 30) ────────────────────────
  // CLIFFSIDE (2E uncommon): raise a horizontal 3-tile line by +1.
  // Upgrade: 5-tile line (center + 2 wings each side).
  cliffsideCost: 2,
  cliffsideLineLength: 3,               // base: center + 1 wing on each side
  cliffsideUpgradedLineLength: 5,       // upgraded: center + 2 wings on each side
  cliffsideRaiseAmount: 1,              // elevation delta per tile in the line

  // ── Highground — VANTAGE_POINT ─────────────────────────────────────────
  vantagePointCost: 2,
  vantagePointBonus: 0.5,               // +50% damage (base)
  vantagePointUpgradedBonus: 0.75,      // +75% damage (upgraded)
  vantagePointElevationThreshold: 1,    // tower must be on elevation ≥ 1
  vantagePointDuration: 1,              // wave countdown (one wave, mirrors highPerchDuration)

  // ── Highground archetype — AVALANCHE_ORDER (Sprint 32) ─────────────────
  // AVALANCHE_ORDER (2E uncommon): target an elevated tile (elevation ≥ 1).
  // Enemies on tile take (elevation × damagePerElevation) instant damage.
  // After damage, tile collapses to elevation 0.
  avalancheOrderCost: 2,
  avalancheDamagePerElevation: 10,      // base: 10 damage per elevation unit
  avalancheUpgradedDamagePerElevation: 15, // upgraded: 15 damage per elevation unit

  // ── Highground archetype — KING_OF_THE_HILL (Sprint 33) ────────────────
  // KING_OF_THE_HILL (3E rare): the tower(s) at the highest elevation on the
  // board deal +100% damage (base) or +150% (upgraded). Only activates when
  // maxElevation ≥ 1. Encounter-scoped (duration: null).
  kingOfTheHillCost: 3,
  kingOfTheHillBonus: 1.0,             // +100% damage (×2) at max elevation
  kingOfTheHillUpgradedBonus: 1.5,     // +150% damage (×2.5) when upgraded

  // ── Highground archetype — GRAVITY_WELL (Sprint 34) ────────────────────
  // GRAVITY_WELL (3E rare): enemies on tiles with elevation < 0 (depressed)
  // skip their movement for the turn. Encounter-scoped (duration: null).
  // Modifier-stat VALUE is a tier sentinel: 1 = gate-only (base), 2 = gate + bleed
  // (upgraded). EnemyService.stepEnemiesOneTurn branches on value ≥ 2 to apply
  // the per-turn max-HP bleed to every enemy it gates that step.
  gravityWellCost: 3,
  gravityWellBaseValue: 1,
  gravityWellUpgradedValue: 2,
  gravityWellBleedFraction: 0.10,   // 10% max-HP per turn on gated enemies (upgraded only)

  // ── Conduit — HANDSHAKE ─────────────────────────────────────────────────
  // Session-5 balance delta: +15%/+25% → +20%/+30%. Session-4 findings: as
  // a Conduit-gated uncommon with a ≥1-neighbor requirement, HANDSHAKE's
  // +15% base was strictly weaker than DAMAGE_BOOST's +25% unconditional
  // at the same 1E cost. Bumping to +20% base keeps DAMAGE_BOOST as the
  // ceiling for ungated bonus, while +30% upgraded rewards committing to
  // the Conduit positional read.
  handshakeCost: 1,
  handshakeBonus: 0.20,
  handshakeUpgradedBonus: 0.30,
  handshakeDuration: 1,

  // ── Conduit — FORMATION ─────────────────────────────────────────────────
  // Session-5 balance delta: +1/+2 → +2/+3. Session-4 findings flagged the
  // 3-in-a-row trigger as restrictive (rare on typical boards with bends)
  // and the +1 payoff as underwhelming relative to the positional commitment.
  // Doubling the additive makes FORMATION a "sniper-row" build-around rather
  // than a mild buff — consistent with Conduit's "positional commitment =
  // real payoff" identity.
  formationCost: 1,
  formationRangeAdditive: 2,
  formationUpgradedRangeAdditive: 3,
  formationDuration: 1,

  // ── Conduit — LINKWORK ──────────────────────────────────────────────────
  linkworkCost: 0,
  linkworkValue: 1,                   // sentinel — flag modifier
  linkworkDuration: 2,                // turns
  linkworkUpgradedDuration: 3,

  // ── Conduit — HARMONIC ──────────────────────────────────────────────────
  harmonicCost: 2,
  harmonicValue: 1,                   // sentinel — flag modifier
  harmonicDuration: 3,                // turns
  harmonicUpgradedDuration: 4,

  // ── Conduit — GRID_SURGE ────────────────────────────────────────────────
  gridSurgeCost: 2,
  gridSurgeBonus: 1.0,
  gridSurgeUpgradedBonus: 1.5,
  gridSurgeDuration: 1,               // turn

  // ── Conduit — CONDUIT_BRIDGE ────────────────────────────────────────────
  // Session-5 full revert: 5/7 → 3/4 (original session-3 values).
  //
  // Session 4 bumped 3/4 → 5/7 reasoning "3 turns is a blip in a 7-10 turn
  // wave." Reconsidered: CONDUIT_BRIDGE at 2E UNCOMMON sits in the genre's
  // "temporary N-turn buff" tier (3-4 turns per convention — StS Wraith Form
  // 3t, most temp effects 3-4t). "Permanent once cast" territory starts at
  // 3E RARE (StS Demon Form, Infinite Blades); this card doesn't pay that
  // cost, so it shouldn't have that duration.
  //
  // The card's real balance mechanism is the RANDOM 2-tower pick — player
  // doesn't target. Long duration doesn't fix bad connections; short
  // duration keeps good connections feeling tight and tactical. Pulling the
  // duration knob was wrong; the randomness is the balancer.
  conduitBridgeCost: 2,
  conduitBridgeDuration: 3,           // turns
  conduitBridgeUpgradedDuration: 4,

  // ── Conduit — ARCHITECT ─────────────────────────────────────────────────
  // Base: 3E rare flag (cluster super-node adjacency). Upgraded: cost drops
  // to 2E to enable same-turn combo plays with HANDSHAKE / GRID_SURGE —
  // intentionally a cost-only upgrade; the identity stays with "cluster
  // becomes one big adjacency group for neighbor-gated cards."
  architectCost: 3,
  architectUpgradedCost: 2,
  architectValue: 1,                  // sentinel — flag modifier

  // ── Conduit — HIVE_MIND ─────────────────────────────────────────────────
  // Tier sentinel on the modifier value: 1 = base (cluster fires with the
  // strongest member's damage + range). 2 = upgraded (additionally propagates
  // the strongest member's secondary stats — splash radius, chain bounces,
  // blast radius, dot damage/duration, and on-hit status effect — to every
  // cluster member's shots). TowerCombatService.fireTurn reads the numeric
  // value in its HIVE_MIND prepass and branches on ≥ 2.
  hiveMindCost: 3,
  hiveMindValue: 1,                   // base tier — damage + range sharing only
  hiveMindUpgradedValue: 2,           // upgraded tier — also secondary-stat sharing
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
    rarity: CardRarity.UNCOMMON,
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
    // Phase 2 Sprint 13 — Cartographer archetype. Scouting the battlefield
    // matches Cartographer's intel/reshape identity. No terraform flag —
    // the card reveals information, it doesn't modify tiles.
    archetype: 'cartographer',
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
    upgradedDescription: 'Upgrade two random towers one level for free.',
    type: CardType.SPELL,
    rarity: CardRarity.RARE,
    energyCost: 1,
    upgraded: false,
    // Phase 1 Sprint 5 — value is now "number of towers to upgrade" (1 base, 2 upgraded).
    // Energy cost stays at 1 for both; the upgrade benefit is doubled output, not free play.
    effect: { type: 'spell', spellId: 'fortify', value: CARD_VALUES.fortifyUpgradeCount },
    upgradedEffect: { type: 'spell', spellId: 'fortify', value: CARD_VALUES.fortifyUpgradedUpgradeCount },
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
    description: 'Apply Burn to all enemies for 3 turns.',
    upgradedDescription: 'Apply Burn to all enemies for 5 turns.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.incinerateCost,
    upgraded: false,
    // Phase 1 Sprint 5 — value is now BURN duration in turns; handler reads it.
    effect: { type: 'spell', spellId: 'incinerate', value: CARD_VALUES.incinerateBurnDuration },
    upgradedEffect: { type: 'spell', spellId: 'incinerate', value: CARD_VALUES.incinerateUpgradedBurnDuration },
  },

  [CardId.TOXIC_SPRAY]: {
    id: CardId.TOXIC_SPRAY,
    name: 'Toxic Spray',
    description: 'Apply Poison to all enemies for 4 turns.',
    upgradedDescription: 'Apply Poison to all enemies for 6 turns.',
    type: CardType.SPELL,
    rarity: CardRarity.UNCOMMON,
    energyCost: CARD_VALUES.toxicSprayCost,
    upgraded: false,
    // Phase 1 Sprint 5 — value is now POISON duration in turns; handler reads it.
    effect: { type: 'spell', spellId: 'toxic_spray', value: CARD_VALUES.toxicSprayPoisonDuration },
    upgradedEffect: { type: 'spell', spellId: 'toxic_spray', value: CARD_VALUES.toxicSprayUpgradedPoisonDuration },
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

  // ── Cartographer archetype — terraform-target cards (Phase 2) ────────────
  //
  // All three cards use `type: SPELL` because CardType is a runtime display
  // classifier (tower vs spell vs modifier vs utility) that affects UI
  // sorting and deck composition bookkeeping. The 'terraform_target' effect
  // variant is the actual runtime dispatch discriminant (CardPlayService
  // branches on `effect.type === 'terraform_target'`). Treating them as
  // SPELLs keeps the UI treatment consistent with other instant-effect
  // cards while the new effect type carries the terraform semantics.

  /**
   * LAY_TILE (Sprint 11) — add 1 path tile (WALL → BASE) at a chosen tile
   * adjacent to existing path. Permanent. Anchors Cartographer's core
   * "reshape the board" identity.
   */
  [CardId.LAY_TILE]: {
    id: CardId.LAY_TILE,
    name: 'Lay Tile',
    description: 'Convert a wall into a path tile.',
    upgradedDescription: 'Convert a wall into a path tile. Draw 1 card.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.layTileCost,
    upgraded: false,
    effect: { type: 'terraform_target', op: 'build', duration: null },
    upgradedEffect: {
      type: 'terraform_target',
      op: 'build',
      duration: null,
      drawOnSuccess: CARD_VALUES.layTileUpgradedDrawCount,
    },
    archetype: 'cartographer',
    terraform: true,
  },

  /**
   * BLOCK_PASSAGE (Sprint 12) — convert a path tile to wall for 2 turns.
   * Upgrade extends to 3 turns.
   */
  [CardId.BLOCK_PASSAGE]: {
    id: CardId.BLOCK_PASSAGE,
    name: 'Block Passage',
    description: 'Convert a path tile into a wall for 2 turns.',
    upgradedDescription: 'Convert a path tile into a wall for 3 turns.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.blockPassageCost,
    upgraded: false,
    effect: {
      type: 'terraform_target',
      op: 'block',
      duration: CARD_VALUES.blockPassageDuration,
    },
    upgradedEffect: {
      type: 'terraform_target',
      op: 'block',
      duration: CARD_VALUES.blockPassageUpgradedDuration,
    },
    archetype: 'cartographer',
    terraform: true,
  },

  /**
   * BRIDGEHEAD (Sprint 15) — create a tower-only platform on a WALL tile
   * for 3 turns (4 upgraded). The tile stays non-traversable (enemies
   * cannot walk on it), but a tower CAN be placed on it via the
   * `canPlaceTower` bridgehead side-channel in GameBoardService.
   *
   * Interaction: if the player places a tower on an active bridgehead
   * and the bridgehead later expires, the tower KEEPS the tile (the
   * revert is a no-op because the tile is now TOWER — see
   * PathMutationService.revertMutation). This is intentional: the card
   * buys permanent territory if the player acts on it in time.
   */
  [CardId.BRIDGEHEAD]: {
    id: CardId.BRIDGEHEAD,
    name: 'Bridgehead',
    description: 'Create a tower-only platform on a wall for 3 turns. Place a tower before it expires to keep the tile.',
    upgradedDescription: 'Create a tower-only platform on a wall for 4 turns. Place a tower before it expires to keep the tile.',
    type: CardType.SPELL,
    rarity: CardRarity.UNCOMMON,
    energyCost: CARD_VALUES.bridgeheadCost,
    upgraded: false,
    effect: {
      type: 'terraform_target',
      op: 'bridgehead',
      duration: CARD_VALUES.bridgeheadDuration,
    },
    upgradedEffect: {
      type: 'terraform_target',
      op: 'bridgehead',
      duration: CARD_VALUES.bridgeheadUpgradedDuration,
    },
    archetype: 'cartographer',
    terraform: true,
  },

  /**
   * COLLAPSE (Sprint 16) — permanently destroy a path tile and deal
   * 50% max-HP damage to any enemies standing on it. Upgrade bumps
   * damage to 75% max-HP. The damage side-effect is carried on the
   * TerraformTargetCardEffect.damageOnHit rider, applied AFTER mutation
   * success so rejected mutations cannot cause partial effects.
   */
  [CardId.COLLAPSE]: {
    id: CardId.COLLAPSE,
    name: 'Collapse',
    description: 'Destroy a path tile. Enemies on it take 50% of max HP as damage.',
    upgradedDescription: 'Destroy a path tile. Enemies on it take 75% of max HP as damage.',
    type: CardType.SPELL,
    rarity: CardRarity.UNCOMMON,
    energyCost: CARD_VALUES.collapseCost,
    upgraded: false,
    effect: {
      type: 'terraform_target',
      op: 'destroy',
      duration: null,
      damageOnHit: { pctMaxHp: CARD_VALUES.collapseDamagePctMaxHp },
    },
    upgradedEffect: {
      type: 'terraform_target',
      op: 'destroy',
      duration: null,
      damageOnHit: { pctMaxHp: CARD_VALUES.collapseUpgradedDamagePctMaxHp },
    },
    archetype: 'cartographer',
    terraform: true,
  },

  /**
   * DETOUR (Sprint 14) — force all enemies onto the longest valid path for
   * one step. Unlike the terraform-target cards, DETOUR modifies enemy routing
   * rather than tile state, so it uses `type: 'spell'` and `terraform: false`.
   *
   * Design note: the "one step" framing means enemies walk the long route for
   * one movement resolution and then fall back to normal shortest-path
   * re-planning at the next waypoint via the existing executeRepath flow.
   * This buys roughly 1–3 extra turns of travel time depending on the board.
   */
  [CardId.DETOUR]: {
    id: CardId.DETOUR,
    name: 'Detour',
    description: 'Force all enemies onto the longest valid path for one step.',
    upgradedDescription: 'Force all enemies onto the longest valid path for one step. Each detoured enemy also takes 8% max HP damage per extra tile of path walked.',
    type: CardType.SPELL,
    rarity: CardRarity.UNCOMMON,
    energyCost: CARD_VALUES.detourCost,
    upgraded: false,
    effect: { type: 'spell', spellId: 'detour', value: CARD_VALUES.detourBaseValue },
    upgradedEffect: { type: 'spell', spellId: 'detour', value: CARD_VALUES.detourUpgradedValue },
    archetype: 'cartographer',
    terraform: false,
  },

  /**
   * CARTOGRAPHER_SEAL (Sprint 17) — RARE anchor. While this modifier is
   * active, every terraform mutation resolved via CardPlayService is forced
   * to permanent (duration = null). Flag-style modifier on
   * MODIFIER_STAT.TERRAFORM_ANCHOR with encounter-scoped duration (null).
   *
   * Upgraded variant currently matches base — reserved for sprint 19 tuning
   * (could extend to grant `+1E refund on first terraform` or similar).
   */
  [CardId.CARTOGRAPHER_SEAL]: {
    id: CardId.CARTOGRAPHER_SEAL,
    name: 'Cartographer\'s Seal',
    description: 'All terraform you play this encounter is permanent.',
    upgradedDescription: 'All terraform you play this encounter is permanent. The first terraform each turn refunds 1 energy.',
    type: CardType.MODIFIER,
    rarity: CardRarity.RARE,
    energyCost: CARD_VALUES.cartographerSealCost,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: MODIFIER_STAT.TERRAFORM_ANCHOR,
      value: CARD_VALUES.cartographerSealBaseValue,
      duration: null,  // encounter-scoped — see tickWave
    },
    upgradedEffect: {
      type: 'modifier',
      stat: MODIFIER_STAT.TERRAFORM_ANCHOR,
      value: CARD_VALUES.cartographerSealUpgradedValue,
      duration: null,
    },
    archetype: 'cartographer',
    terraform: false,   // the card itself does NOT mutate tiles — it changes the rules for terraform cards
  },

  /**
   * LABYRINTH_MIND (Sprint 18) — RARE build-around. While this modifier is
   * active, every tower's damage is multiplied by
   * `1 + (spawner→exit path length × labyrinthMindPathScaling)` at fire time.
   *
   * Reward: lay_tile / build cards stretch the enemy path, which in turn
   * stretches tower damage. Pays off long-path Cartographer builds.
   * Read live by TowerCombatService at fireTurn (pathLength queried via
   * PathfindingService.getPathToExitLength()). Flag-style modifier on
   * MODIFIER_STAT.LABYRINTH_MIND, value = scaling coefficient.
   */
  [CardId.LABYRINTH_MIND]: {
    id: CardId.LABYRINTH_MIND,
    name: 'Labyrinth Mind',
    description: 'Tower damage scales with path length (+2% per tile) this encounter.',
    upgradedDescription: 'Tower damage scales with path length (+3% per tile) this encounter.',
    type: CardType.MODIFIER,
    rarity: CardRarity.RARE,
    energyCost: CARD_VALUES.labyrinthMindCost,
    upgraded: false,
    effect: {
      type: 'modifier',
      stat: MODIFIER_STAT.LABYRINTH_MIND,
      value: CARD_VALUES.labyrinthMindPathScaling,
      duration: null,
    },
    upgradedEffect: {
      type: 'modifier',
      stat: MODIFIER_STAT.LABYRINTH_MIND,
      value: CARD_VALUES.labyrinthMindUpgradedPathScaling,
      duration: null,
    },
    archetype: 'cartographer',
    terraform: false,
  },

  // ── Highground archetype — elevation-target cards (Phase 3) ─────────────────

  /**
   * RAISE_PLATFORM (Sprint 27) — raise a tile by 1 elevation unit permanently.
   * Towers on raised tiles gain range (TowerCombatService integration: sprint 29).
   * Uses the `terraform` keyword (shared Highground/Cartographer surface;
   * elevation-model.md §3 confirms Highground cards share this keyword).
   */
  [CardId.RAISE_PLATFORM]: {
    id: CardId.RAISE_PLATFORM,
    name: 'Raise Platform',
    description: 'Raise a tile by 1 unit. Towers on raised tiles gain range.',
    upgradedDescription: 'Raise a tile by 1 unit permanently. Towers on raised tiles gain range.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.raisePlatformCost,
    upgraded: false,
    effect: {
      type: 'elevation_target',
      op: 'raise',
      amount: CARD_VALUES.raisePlatformAmount,
      duration: null,
    } satisfies ElevationTargetCardEffect,
    upgradedEffect: {
      type: 'elevation_target',
      op: 'raise',
      amount: CARD_VALUES.raisePlatformAmount,
      duration: null,
    } satisfies ElevationTargetCardEffect,
    archetype: 'highground',
    terraform: true,
  },

  /**
   * DEPRESS_TILE (Sprint 28) — lower a tile by 1 elevation unit permanently.
   * Enemies on lowered (negative-elevation) tiles take +25% incoming damage
   * (EXPOSED_DAMAGE_BONUS applied in EnemyService.damageEnemy).
   */
  [CardId.DEPRESS_TILE]: {
    id: CardId.DEPRESS_TILE,
    name: 'Depress Tile',
    description: 'Lower a tile by 1 unit. Enemies on lowered tiles take +25% damage.',
    upgradedDescription: 'Lower a tile and one random adjacent tile by 1 unit. Enemies on lowered tiles take +25% damage.',
    type: CardType.SPELL,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.depressTileCost,
    upgraded: false,
    effect: {
      type: 'elevation_target',
      op: 'depress',
      amount: CARD_VALUES.depressTileAmount,
      duration: null,
      exposeEnemies: true,
    } satisfies ElevationTargetCardEffect,
    upgradedEffect: {
      type: 'elevation_target',
      op: 'depress',
      amount: CARD_VALUES.depressTileAmount,
      duration: null,
      exposeEnemies: true,
      spreadToAdjacent: true,
    } satisfies ElevationTargetCardEffect,
    archetype: 'highground',
    terraform: true,
  },

  /**
   * HIGH_PERCH — wave-scoped range bonus for towers on elevation ≥ 2.
   * Composes multiplicatively with the passive elevation range bonus.
   */
  [CardId.HIGH_PERCH]: {
    id: CardId.HIGH_PERCH,
    name: 'High Perch',
    description: 'Towers on elevation 2+ gain +25% range for this wave.',
    upgradedDescription: 'Towers on elevation 2+ gain +40% range for this wave.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.highPerchCost,
    upgraded: false,
    effect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.HIGH_PERCH_RANGE_BONUS,
      value: CARD_VALUES.highPerchBonus,
      duration: CARD_VALUES.highPerchDuration,
    },
    upgradedEffect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.HIGH_PERCH_RANGE_BONUS,
      value: CARD_VALUES.highPerchUpgradedBonus,
      duration: CARD_VALUES.highPerchDuration,
    },
    archetype: 'highground' as const,
    terraform: false,
  },

  // ── Highground archetype — uncommon cards (Sprints 30/31/32) ─────────────

  /**
   * CLIFFSIDE (Sprint 30) — raise a 3-tile horizontal line by +1 elevation.
   * Center tile must be valid; wings (east + west neighbors) that hit SPAWNER,
   * EXIT, or out-of-bounds are silently skipped (partial success).
   * Upgrade: 5-tile line (center + 2 wings on each side).
   *
   * Uses the `line` field on ElevationTargetCardEffect to signal multi-tile
   * expansion in resolveElevationTarget. Marked terraform: true (modifies tile
   * elevation state). elevation-model.md §3 confirms Highground shares this keyword.
   */
  [CardId.CLIFFSIDE]: {
    id: CardId.CLIFFSIDE,
    name: 'Cliffside',
    description: 'Raise a horizontal 3-tile line by +1. Wings that hit spawn/exit are skipped.',
    upgradedDescription: 'Raise a horizontal 5-tile line by +1. Wings that hit spawn/exit are skipped.',
    type: CardType.SPELL,
    rarity: CardRarity.UNCOMMON,
    energyCost: CARD_VALUES.cliffsideCost,
    upgraded: false,
    effect: {
      type: 'elevation_target',
      op: 'raise',
      amount: CARD_VALUES.cliffsideRaiseAmount,
      duration: null,
      line: {
        direction: 'horizontal',
        length: CARD_VALUES.cliffsideLineLength,
      },
    } satisfies ElevationTargetCardEffect,
    upgradedEffect: {
      type: 'elevation_target',
      op: 'raise',
      amount: CARD_VALUES.cliffsideRaiseAmount,
      duration: null,
      line: {
        direction: 'horizontal',
        length: CARD_VALUES.cliffsideUpgradedLineLength,
      },
    } satisfies ElevationTargetCardEffect,
    archetype: 'highground',
    terraform: true,
  },

  /**
   * VANTAGE_POINT — wave-scoped damage bonus for towers on elevation ≥ 1.
   */
  [CardId.VANTAGE_POINT]: {
    id: CardId.VANTAGE_POINT,
    name: 'Vantage Point',
    description: 'Elevated towers (elevation ≥ 1) gain +50% damage for this wave.',
    upgradedDescription: 'Elevated towers (elevation ≥ 1) gain +75% damage for this wave.',
    type: CardType.MODIFIER,
    rarity: CardRarity.UNCOMMON,
    energyCost: CARD_VALUES.vantagePointCost,
    upgraded: false,
    effect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.VANTAGE_POINT_DAMAGE_BONUS,
      value: CARD_VALUES.vantagePointBonus,
      duration: CARD_VALUES.vantagePointDuration,
    },
    upgradedEffect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.VANTAGE_POINT_DAMAGE_BONUS,
      value: CARD_VALUES.vantagePointUpgradedBonus,
      duration: CARD_VALUES.vantagePointDuration,
    },
    archetype: 'highground' as const,
    terraform: false,
  },

  /**
   * AVALANCHE_ORDER (Sprint 32) — target an elevated tile (elevation ≥ 1).
   * Enemies on the tile take (elevation × damagePerElevation) instant damage
   * BEFORE the collapse, so the prior elevation is intact at damage time. The
   * tile then collapses to elevation 0.
   *
   * Rejection: if target tile elevation is 0, card rejects with 'not-elevated'.
   * The `damageOnHit.damagePerElevation` rider signals to resolveElevationTarget
   * that damage should be applied prior to the collapse call (order matters).
   *
   * Timing note: damageEnemy is called BEFORE elevationService.collapse so the
   * "exposed" multiplier in EnemyService.damageEnemy does NOT double-fire —
   * the tile is still at positive elevation during the damage call, so the
   * exposed (negative elevation) check is false.
   */
  [CardId.AVALANCHE_ORDER]: {
    id: CardId.AVALANCHE_ORDER,
    name: 'Avalanche Order',
    description: 'Target an elevated tile. Enemies on it take (elevation × 10) damage, then the tile collapses.',
    upgradedDescription: 'Target an elevated tile. Enemies on it take (elevation × 15) damage, then the tile collapses.',
    type: CardType.SPELL,
    rarity: CardRarity.UNCOMMON,
    energyCost: CARD_VALUES.avalancheOrderCost,
    upgraded: false,
    effect: {
      type: 'elevation_target',
      op: 'collapse',
      amount: 0,  // collapse ignores amount — always sets to 0
      duration: null,
      damageOnHit: { damagePerElevation: CARD_VALUES.avalancheDamagePerElevation },
    } satisfies ElevationTargetCardEffect,
    upgradedEffect: {
      type: 'elevation_target',
      op: 'collapse',
      amount: 0,
      duration: null,
      damageOnHit: { damagePerElevation: CARD_VALUES.avalancheUpgradedDamagePerElevation },
    } satisfies ElevationTargetCardEffect,
    archetype: 'highground',
    terraform: true,
  },

  // ── Highground archetype — rare cards (Sprints 33/34) ────────────────────

  /**
   * KING_OF_THE_HILL — encounter-scoped. Tower(s) at the board-wide max
   * elevation gain damage bonus. Only activates when maxElevation ≥ 1
   * (flat boards confer no bonus). Ties: ALL towers at the max receive
   * the bonus (anti-flapping).
   */
  [CardId.KING_OF_THE_HILL]: {
    id: CardId.KING_OF_THE_HILL,
    name: 'King of the Hill',
    description: 'The tower(s) at the highest elevation deal +100% damage for this encounter.',
    upgradedDescription: 'The tower(s) at the highest elevation deal +150% damage for this encounter.',
    type: CardType.MODIFIER,
    rarity: CardRarity.RARE,
    energyCost: CARD_VALUES.kingOfTheHillCost,
    upgraded: false,
    effect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.KING_OF_THE_HILL_DAMAGE_BONUS,
      value: CARD_VALUES.kingOfTheHillBonus,
      duration: null,
    },
    upgradedEffect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.KING_OF_THE_HILL_DAMAGE_BONUS,
      value: CARD_VALUES.kingOfTheHillUpgradedBonus,
      duration: null,
    },
    archetype: 'highground' as const,
    terraform: false,
  },

  /**
   * GRAVITY_WELL — encounter-scoped. Enemies on tiles with elevation < 0
   * skip their movement for the turn. Checked per-enemy in
   * EnemyService.stepEnemiesOneTurn.
   */
  [CardId.GRAVITY_WELL]: {
    id: CardId.GRAVITY_WELL,
    name: 'Gravity Well',
    description: 'Enemies on depressed tiles (elevation < 0) cannot move this encounter.',
    upgradedDescription: 'Enemies on depressed tiles (elevation < 0) cannot move this encounter. Each turn, gated enemies also take 10% of their max HP as damage.',
    type: CardType.MODIFIER,
    rarity: CardRarity.RARE,
    energyCost: CARD_VALUES.gravityWellCost,
    upgraded: false,
    effect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.GRAVITY_WELL,
      value: CARD_VALUES.gravityWellBaseValue,
      duration: null,
    },
    upgradedEffect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.GRAVITY_WELL,
      value: CARD_VALUES.gravityWellUpgradedValue,
      duration: null,
    },
    archetype: 'highground' as const,
    terraform: false,
  },

  // ── Conduit archetype ────────────────────────────────────────────────────

  /**
   * HANDSHAKE — wave-scoped damage bonus for towers with ≥ 1 active 4-dir
   * neighbor (read via TowerGraphService.getNeighbors in composeDamageStack).
   */
  [CardId.HANDSHAKE]: {
    id: CardId.HANDSHAKE,
    name: 'Handshake',
    description: 'Towers with at least one adjacent tower gain +20% damage this wave.',
    upgradedDescription: 'Towers with at least one adjacent tower gain +30% damage this wave.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.handshakeCost,
    upgraded: false,
    effect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.HANDSHAKE_DAMAGE_BONUS,
      value: CARD_VALUES.handshakeBonus,
      duration: CARD_VALUES.handshakeDuration,
    },
    upgradedEffect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.HANDSHAKE_DAMAGE_BONUS,
      value: CARD_VALUES.handshakeUpgradedBonus,
      duration: CARD_VALUES.handshakeDuration,
    },
    archetype: 'conduit' as const,
    link: true,
    terraform: false,
  },

  /**
   * FORMATION — wave-scoped additive range for towers in a straight 4-dir
   * line of 3+. Folds INSIDE `(baseRange + additive) × multipliers` per
   * spike §13.
   */
  [CardId.FORMATION]: {
    id: CardId.FORMATION,
    name: 'Formation',
    description: 'Towers in a row of 3 or more gain +2 range this wave.',
    upgradedDescription: 'Towers in a row of 3 or more gain +3 range this wave.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.formationCost,
    upgraded: false,
    effect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.FORMATION_RANGE_ADDITIVE,
      value: CARD_VALUES.formationRangeAdditive,
      duration: CARD_VALUES.formationDuration,
    },
    upgradedEffect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.FORMATION_RANGE_ADDITIVE,
      value: CARD_VALUES.formationUpgradedRangeAdditive,
      duration: CARD_VALUES.formationDuration,
    },
    archetype: 'conduit' as const,
    link: true,
    terraform: false,
  },

  /**
   * LINKWORK — turn-scoped flag. Every tower in a qualifying cluster gains
   * LINKWORK_FIRE_RATE_BONUS shots/turn, folded into the fireRate ceil.
   * First card with `durationScope: 'turn'` — ticks via tickTurn, NOT tickWave.
   */
  [CardId.LINKWORK]: {
    id: CardId.LINKWORK,
    name: 'Linkwork',
    description: 'For 2 turns, linked towers share the highest fire rate in their cluster.',
    upgradedDescription: 'For 3 turns, linked towers share the highest fire rate in their cluster.',
    type: CardType.MODIFIER,
    rarity: CardRarity.COMMON,
    energyCost: CARD_VALUES.linkworkCost,
    upgraded: false,
    effect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.LINKWORK_FIRE_RATE_SHARE,
      value: CARD_VALUES.linkworkValue,
      duration: CARD_VALUES.linkworkDuration,
      durationScope: 'turn' as const,
    },
    upgradedEffect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.LINKWORK_FIRE_RATE_SHARE,
      value: CARD_VALUES.linkworkValue,
      duration: CARD_VALUES.linkworkUpgradedDuration,
      durationScope: 'turn' as const,
    },
    archetype: 'conduit' as const,
    link: true,
    terraform: false,
  },

  /**
   * HARMONIC — turn-scoped flag. When any tower fires, up to
   * HARMONIC_NEIGHBOR_COUNT non-disrupted cluster members fire at the same
   * target (range-gated). Non-recursive; seeded RNG for replay determinism.
   */
  [CardId.HARMONIC]: {
    id: CardId.HARMONIC,
    name: 'Harmonic',
    description: 'For 3 turns, when a tower fires, 2 random linked neighbors fire at the same target.',
    upgradedDescription: 'For 4 turns, when a tower fires, 2 random linked neighbors fire at the same target.',
    type: CardType.MODIFIER,
    rarity: CardRarity.UNCOMMON,
    energyCost: CARD_VALUES.harmonicCost,
    upgraded: false,
    effect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.HARMONIC_SIMULTANEOUS_FIRE,
      value: CARD_VALUES.harmonicValue,
      duration: CARD_VALUES.harmonicDuration,
      durationScope: 'turn' as const,
    },
    upgradedEffect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.HARMONIC_SIMULTANEOUS_FIRE,
      value: CARD_VALUES.harmonicValue,
      duration: CARD_VALUES.harmonicUpgradedDuration,
      durationScope: 'turn' as const,
    },
    archetype: 'conduit' as const,
    link: true,
    terraform: false,
  },

  /**
   * GRID_SURGE — turn-scoped damage multiplier for towers with all 4
   * cardinal neighbors filled (and non-disrupted). High-burst, 1-turn
   * window rewarding tight 4-neighbor clusters.
   */
  [CardId.GRID_SURGE]: {
    id: CardId.GRID_SURGE,
    name: 'Grid Surge',
    description: 'Towers with all 4 neighbors filled deal double damage this turn.',
    upgradedDescription: 'Towers with all 4 neighbors filled deal ×2.5 damage this turn.',
    type: CardType.MODIFIER,
    rarity: CardRarity.UNCOMMON,
    energyCost: CARD_VALUES.gridSurgeCost,
    upgraded: false,
    effect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.GRID_SURGE_DAMAGE_BONUS,
      value: CARD_VALUES.gridSurgeBonus,
      duration: CARD_VALUES.gridSurgeDuration,
      durationScope: 'turn' as const,
    },
    upgradedEffect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.GRID_SURGE_DAMAGE_BONUS,
      value: CARD_VALUES.gridSurgeUpgradedBonus,
      duration: CARD_VALUES.gridSurgeDuration,
      durationScope: 'turn' as const,
    },
    archetype: 'conduit' as const,
    link: true,
    terraform: false,
  },

  /**
   * CONDUIT_BRIDGE — utility card. Picks two random non-adjacent towers via
   * seeded RNG and installs a virtual adjacency edge for N turns.
   * `effect.value` is the duration (turns) passed to
   * TowerGraphService.addVirtualEdge.
   */
  [CardId.CONDUIT_BRIDGE]: {
    id: CardId.CONDUIT_BRIDGE,
    name: 'Conduit Bridge',
    description: 'Link two non-adjacent towers as neighbors for 3 turns.',
    upgradedDescription: 'Link two non-adjacent towers as neighbors for 4 turns.',
    type: CardType.UTILITY,
    rarity: CardRarity.UNCOMMON,
    energyCost: CARD_VALUES.conduitBridgeCost,
    upgraded: false,
    effect: {
      type: 'utility' as const,
      utilityId: 'bridge_towers',
      value: CARD_VALUES.conduitBridgeDuration,
    },
    upgradedEffect: {
      type: 'utility' as const,
      utilityId: 'bridge_towers',
      value: CARD_VALUES.conduitBridgeUpgradedDuration,
    },
    archetype: 'conduit' as const,
    link: true,
    terraform: false,
  },

  /**
   * ARCHITECT — encounter-scoped flag. Neighbor-gated Conduit cards
   * (HANDSHAKE, GRID_SURGE) substitute `clusterSize - 1` for their literal
   * 4-dir neighbor count. Transforms the cluster into a single adjacency
   * super-node.
   */
  [CardId.ARCHITECT]: {
    id: CardId.ARCHITECT,
    name: 'Architect',
    description: 'Every tower in a cluster counts as adjacent to every other tower in that cluster for the rest of this encounter.',
    upgradedDescription: 'Costs 2 energy. Every tower in a cluster counts as adjacent to every other tower in that cluster for the rest of this encounter.',
    type: CardType.MODIFIER,
    rarity: CardRarity.RARE,
    energyCost: CARD_VALUES.architectCost,
    upgradedEnergyCost: CARD_VALUES.architectUpgradedCost,
    upgraded: false,
    effect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.ARCHITECT_CLUSTER_PROPAGATION,
      value: CARD_VALUES.architectValue,
      duration: null,                 // encounter-scoped
    },
    upgradedEffect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.ARCHITECT_CLUSTER_PROPAGATION,
      value: CARD_VALUES.architectValue,
      duration: null,
    },
    archetype: 'conduit' as const,
    link: true,
    terraform: false,
  },

  /**
   * HIVE_MIND — encounter-scoped flag. Every tower in a cluster fires with
   * the MAX composed damage and range across cluster members. Fire-rate
   * sharing is covered by LINKWORK. Two-pass prepass in fireTurn.
   */
  [CardId.HIVE_MIND]: {
    id: CardId.HIVE_MIND,
    name: 'Hive Mind',
    description: 'For the rest of this encounter, every tower in a cluster fires with the strongest tower\u2019s damage and range.',
    upgradedDescription: 'For the rest of this encounter, every tower in a cluster fires with the strongest tower\u2019s damage, range, and secondary effect (splash, chain bounces, status, and DoT).',
    type: CardType.MODIFIER,
    rarity: CardRarity.RARE,
    energyCost: CARD_VALUES.hiveMindCost,
    upgraded: false,
    effect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX,
      value: CARD_VALUES.hiveMindValue,
      duration: null,
    },
    upgradedEffect: {
      type: 'modifier' as const,
      stat: MODIFIER_STAT.HIVE_MIND_CLUSTER_MAX,
      value: CARD_VALUES.hiveMindUpgradedValue,
      duration: null,
    },
    archetype: 'conduit' as const,
    link: true,
    terraform: false,
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

/**
 * Resolve the effective energy cost for a card instance, accounting for the
 * upgrade-cost reduction (e.g., ARCHITECT 3E → 2E on upgrade). Falls back to
 * the base `energyCost` when the card is not upgraded or no upgraded cost is
 * declared. Callers in play paths should route through this helper — reading
 * `def.energyCost` directly will miss cost-reduction upgrades.
 */
export function getEffectiveEnergyCost(card: CardInstance): number {
  const def = getCardDefinition(card.cardId);
  if (card.upgraded && def.upgradedEnergyCost !== undefined) {
    return def.upgradedEnergyCost;
  }
  return def.energyCost;
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
