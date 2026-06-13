/**
 * Numeric effect values for card definitions.
 * Consumed exclusively by card-definitions.ts — not part of the public API.
 */
export const CARD_VALUES = {
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
  // value now means "number of towers to upgrade".
  // Energy cost stays at 1 (set on the card definition); upgrade doubles output.
  fortifyUpgradeCount: 1,
  fortifyUpgradedUpgradeCount: 2,
  // INCINERATE / TOXIC_SPRAY read effect.value as the status duration in turns.
  // Base values match STATUS_EFFECT_CONFIGS defaults (BURN: 3, POISON: 4); upgrades extend duration.
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

  // ── Status-applying spell costs ───────────────────────────────
  // Duration is governed by STATUS_EFFECT_CONFIGS — these are energy costs only.
  incinerateCost: 2,   // COMMON — matches FROST_WAVE cost parity (archetype swap: burn vs slow)
  toxicSprayCost: 2,   // UNCOMMON — POISON stacks over more turns, higher long-run value
  cryoPulseCost: 1,    // COMMON — single-target but gains card draw for extra economy
  cryoPulseDrawCount: 1,
  cryoPulseUpgradedDrawCount: 2,

  // ── Status payoff spell values ────────────────────────────────
  detonateDamagePerBurning: 25,
  detonateUpgradedDamagePerBurning: 35,
  detonateCost: 1,
  epidemicCost: 2,
  epidemicCriticalMass: 2,       // need 2+ poisoned enemies to trigger
  epidemicUpgradedCriticalMass: 1, // upgraded: only need 1

  // ── Cartographer archetype — terraform-target cards ────────────
  // LAY_TILE: 1E common, permanent path addition. Upgraded draws 1 card on success.
  layTileCost: 1,
  layTileUpgradedDrawCount: 1,
  // BLOCK_PASSAGE: 1E common, temporary wall
  blockPassageCost: 1,
  blockPassageDuration: 2,
  blockPassageUpgradedDuration: 3,
  // BRIDGEHEAD: 2E uncommon, tower-only platform 3 turns (4 upgraded)
  bridgeheadCost: 2,
  bridgeheadDuration: 3,
  bridgeheadUpgradedDuration: 4,
  // COLLAPSE: 2E uncommon, permanent destroy + %max-HP damage
  collapseCost: 2,
  collapseDamagePctMaxHp: 0.5,
  collapseUpgradedDamagePctMaxHp: 0.75,

  // DETOUR: 2E uncommon, force all enemies onto the longest valid path for one step.
  // SpellCardEffect VALUE is a tier sentinel: 1 = reroute-only (base card),
  // 2 = reroute + damage (upgraded card).
  detourCost: 2,
  detourBaseValue: 1,
  detourUpgradedValue: 2,
  detourDamageFractionPerExtraStep: 0.08,   // 8% max-HP per extra path tile added

  // CARTOGRAPHER_SEAL: 2E rare anchor.
  // VALUE tier sentinel — 1 = anchor-only (base), 2 = anchor + first-terraform-per-turn refund.
  cartographerSealCost: 2,
  cartographerSealBaseValue: 1,
  cartographerSealUpgradedValue: 2,
  cartographerSealRefundAmount: 1,        // energy refunded on first terraform each turn
  // LABYRINTH_MIND: 2E rare build-around. Tower damage scales with path length.
  // Multiplier = 1 + (pathLength * k). k=0.02 → 30-tile path = 60% bonus.
  labyrinthMindCost: 2,
  labyrinthMindPathScaling: 0.02,
  labyrinthMindUpgradedPathScaling: 0.03,

  // ── Highground archetype — elevation-target cards ──────────────
  // RAISE_PLATFORM: 1E common, raise a tile by 1 elevation unit.
  raisePlatformCost: 1,
  raisePlatformAmount: 1,       // +1 elevation unit per play
  raisePlatformUpgradedAmount: 2, // upgraded: +2 elevation units per play
  // DEPRESS_TILE: 1E common, lower a tile by 1 elevation unit.
  depressTileCost: 1,
  depressTileAmount: 1,         // -1 elevation unit per play
  // Damage bonus applied in EnemyService.damageEnemy when tile elevation < 0.
  exposedDamageBonus: 0.25,

  // ── Highground archetype — HIGH_PERCH modifier ────────────────
  // HIGH_PERCH (1E common): towers on elevation ≥ threshold gain +25% range for one wave.
  highPerchCost: 1,
  highPerchBonus: 0.25,          // +25% range for qualifying towers (base)
  highPerchUpgradedBonus: 0.4,   // +40% range when upgraded
  highPerchThreshold: 2,         // minimum elevation to qualify for the bonus
  highPerchDuration: 1,          // wave countdown duration (one wave)

  // ── Highground archetype — CLIFFSIDE ─────────────────────────
  // CLIFFSIDE (2E uncommon): raise a horizontal 3-tile line by +1.
  // Upgrade: 5-tile line (center + 2 wings each side).
  cliffsideCost: 2,
  cliffsideLineLength: 3,               // base: center + 1 wing on each side
  cliffsideUpgradedLineLength: 5,       // upgraded: center + 2 wings on each side
  cliffsideRaiseAmount: 1,              // elevation delta per tile in the line

  // ── Highground — VANTAGE_POINT ────────────────────────────────
  vantagePointCost: 2,
  vantagePointBonus: 0.5,               // +50% damage (base)
  vantagePointUpgradedBonus: 0.75,      // +75% damage (upgraded)
  vantagePointElevationThreshold: 1,    // tower must be on elevation ≥ 1
  vantagePointDuration: 1,              // wave countdown (one wave, mirrors highPerchDuration)

  // ── Highground archetype — AVALANCHE_ORDER ────────────────────
  // AVALANCHE_ORDER (2E uncommon): target an elevated tile (elevation ≥ 1).
  // Enemies on tile take (elevation × damagePerElevation) instant damage.
  // After damage, tile collapses to elevation 0.
  avalancheOrderCost: 2,
  avalancheDamagePerElevation: 10,      // base: 10 damage per elevation unit
  avalancheUpgradedDamagePerElevation: 15, // upgraded: 15 damage per elevation unit

  // ── Highground archetype — KING_OF_THE_HILL ──────────────────
  // KING_OF_THE_HILL (3E rare): the tower(s) at the highest elevation on the
  // board deal +100% damage (base) or +150% (upgraded). Encounter-scoped.
  kingOfTheHillCost: 3,
  kingOfTheHillBonus: 1.0,             // +100% damage (×2) at max elevation
  kingOfTheHillUpgradedBonus: 1.5,     // +150% damage (×2.5) when upgraded

  // ── Highground archetype — GRAVITY_WELL ──────────────────────
  // GRAVITY_WELL (3E rare): enemies on depressed tiles skip movement.
  // Modifier-stat VALUE is a tier sentinel: 1 = gate-only (base), 2 = gate + bleed (upgraded).
  gravityWellCost: 3,
  gravityWellBaseValue: 1,
  gravityWellUpgradedValue: 2,
  gravityWellBleedFraction: 0.10,   // 10% max-HP per turn on gated enemies (upgraded only)

  // ── Conduit — HANDSHAKE ───────────────────────────────────────
  handshakeCost: 1,
  handshakeBonus: 0.20,
  handshakeUpgradedBonus: 0.30,
  handshakeDuration: 1,

  // ── Conduit — FORMATION ───────────────────────────────────────
  formationCost: 1,
  formationRangeAdditive: 2,
  formationUpgradedRangeAdditive: 3,
  formationDuration: 1,

  // ── Conduit — LINKWORK ────────────────────────────────────────
  linkworkCost: 0,
  linkworkValue: 1,                   // sentinel — flag modifier
  linkworkDuration: 2,                // turns
  linkworkUpgradedDuration: 3,

  // ── Conduit — HARMONIC ────────────────────────────────────────
  harmonicCost: 2,
  harmonicValue: 1,                   // sentinel — flag modifier
  harmonicDuration: 3,                // turns
  harmonicUpgradedDuration: 4,

  // ── Conduit — GRID_SURGE ──────────────────────────────────────
  gridSurgeCost: 2,
  gridSurgeBonus: 1.0,
  gridSurgeUpgradedBonus: 1.5,
  gridSurgeDuration: 1,               // turn

  // ── Conduit — CONDUIT_BRIDGE ──────────────────────────────────
  // 2E UNCOMMON sits in the "temporary N-turn buff" tier (3-4 turns).
  // The random 2-tower pick is the real balance mechanism, not duration.
  conduitBridgeCost: 2,
  conduitBridgeDuration: 3,           // turns
  conduitBridgeUpgradedDuration: 4,

  // ── Conduit — ARCHITECT ───────────────────────────────────────
  // Base: 3E rare flag. Upgraded: cost drops to 2E to enable same-turn combos.
  architectCost: 3,
  architectUpgradedCost: 2,
  architectValue: 1,                  // sentinel — flag modifier

  // ── Conduit — HIVE_MIND ───────────────────────────────────────
  // Tier sentinel on modifier value: 1 = base (strongest member damage+range sharing).
  // 2 = upgraded (also propagates secondary stats to every cluster member).
  hiveMindCost: 3,
  hiveMindValue: 1,                   // base tier — damage + range sharing only
  hiveMindUpgradedValue: 2,           // upgraded tier — also secondary-stat sharing
} as const;
