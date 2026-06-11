/**
 * Balance verification suite.
 *
 * Philosophy: these tests DOCUMENT the intended balance, not enforce arbitrary
 * thresholds. If a test fails, investigate whether the game data has drifted
 * from design intent before weakening the assertion. Only adjust constants when
 * the game itself has been intentionally rebalanced.
 *
 * Test categories:
 *  1. Economy Balance      — starting gold vs tower costs per difficulty
 *  2. Tower Viability      — affordability, cost spread, DPS variance
 *  3. Enemy Stats          — boss supremacy, speed ordering, value scaling
 *  4. Endless Mode         — speed cap, enemy count bounds
 *  5. Upgrade Paths        — L2 improves all combat stats over L1
 */

import { TOWER_CONFIGS, UPGRADE_MULTIPLIERS, TowerType } from '../../../game/game-board/models/tower.model';
import { ENEMY_STATS, EnemyType } from '../../../game/game-board/models/enemy.model';
import {
  DIFFICULTY_PRESETS,
  DifficultyLevel,
} from '../../../game/game-board/models/game-state.model';
import {
  generateEndlessWave,
  ENDLESS_MAX_SPEED_MULTIPLIER,
  ENDLESS_BASE_ENEMY_COUNT,
  ENDLESS_COUNT_SCALE_PER_WAVE,
} from '../../../game/game-board/models/endless-wave.model';

// ---------------------------------------------------------------------------
// Named constants for all test thresholds
// ---------------------------------------------------------------------------

/** Easy difficulty must afford at least this many Basic towers from starting gold. */
const EASY_MIN_BASIC_TOWERS = 6;

/** Normal difficulty must afford at least this many Basic towers from starting gold. */
const NORMAL_MIN_BASIC_TOWERS = 4;

/** Hard difficulty must afford at least this many Basic towers from starting gold. */
const HARD_MIN_BASIC_TOWERS = 2;

/** Nightmare difficulty must afford at least this many Basic towers from starting gold. */
const NIGHTMARE_MIN_BASIC_TOWERS = 1;

/**
 * Maximum allowed ratio between the most-expensive and cheapest tower.
 * Prevents any single tower from being so dominant in cost that it crowds
 * out all others from the budget conversation.
 */
const MAX_TOWER_COST_RATIO = 3;

/**
 * Upper bound on total enemy count for endless wave 100.
 * Ensures the game stays playable rather than degrading to an unwinnable wall.
 * Formula: BASE + floor(100 * COUNT_SCALE) = 8 + 80 = 88, plus MIN_ENEMIES_PER_ENTRY
 * padding across 3-5 entries. 120 gives comfortable headroom.
 */
const ENDLESS_WAVE_100_MAX_ENEMIES = 120;

// ---------------------------------------------------------------------------
// 1. Economy Balance
// ---------------------------------------------------------------------------

describe('Balance — Economy', () => {
  const basicCost = TOWER_CONFIGS[TowerType.BASIC].cost;

  it('Easy starting gold affords at least 6 Basic towers', () => {
    const gold = DIFFICULTY_PRESETS[DifficultyLevel.EASY].gold;
    expect(Math.floor(gold / basicCost)).toBeGreaterThanOrEqual(EASY_MIN_BASIC_TOWERS);
  });

  it('Normal starting gold affords at least 4 Basic towers', () => {
    const gold = DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold;
    expect(Math.floor(gold / basicCost)).toBeGreaterThanOrEqual(NORMAL_MIN_BASIC_TOWERS);
  });

  it('Hard starting gold affords at least 2 Basic towers', () => {
    const gold = DIFFICULTY_PRESETS[DifficultyLevel.HARD].gold;
    expect(Math.floor(gold / basicCost)).toBeGreaterThanOrEqual(HARD_MIN_BASIC_TOWERS);
  });

  it('Nightmare starting gold affords at least 1 Basic tower', () => {
    const gold = DIFFICULTY_PRESETS[DifficultyLevel.NIGHTMARE].gold;
    expect(Math.floor(gold / basicCost)).toBeGreaterThanOrEqual(NIGHTMARE_MIN_BASIC_TOWERS);
  });

  it('Easy difficulty gives more starting gold than Normal', () => {
    expect(DIFFICULTY_PRESETS[DifficultyLevel.EASY].gold)
      .toBeGreaterThan(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold);
  });

  it('Normal difficulty gives more starting gold than Hard', () => {
    expect(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold)
      .toBeGreaterThan(DIFFICULTY_PRESETS[DifficultyLevel.HARD].gold);
  });

  it('Hard difficulty gives more starting gold than Nightmare', () => {
    expect(DIFFICULTY_PRESETS[DifficultyLevel.HARD].gold)
      .toBeGreaterThan(DIFFICULTY_PRESETS[DifficultyLevel.NIGHTMARE].gold);
  });

  it('Easy difficulty gives more lives than Normal', () => {
    expect(DIFFICULTY_PRESETS[DifficultyLevel.EASY].lives)
      .toBeGreaterThan(DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].lives);
  });

  it('Nightmare has 7 lives — razor-thin margin as intended', () => {
    // Nightmare is designed with 7 lives so that a single escort-wave leak
    // from a Boss (leakDamage=3) still leaves the run alive but puts severe
    // pressure on the player. 7 prevents any comfortable cushion.
    expect(DIFFICULTY_PRESETS[DifficultyLevel.NIGHTMARE].lives).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// 2. Tower Viability
// ---------------------------------------------------------------------------

describe('Balance — Tower Viability', () => {
  const normalGold = DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold;
  const hardGold = DIFFICULTY_PRESETS[DifficultyLevel.HARD].gold;

  it('all tower types are affordable from Normal starting gold alone', () => {
    // If any tower costs more than starting Normal gold, it can never be
    // placed on wave 1 without kills — effectively making it inaccessible
    // during the critical opening setup window.
    for (const [type, config] of Object.entries(TOWER_CONFIGS)) {
      expect(config.cost)
        .withContext(
          `${type} tower (${config.cost}g) exceeds Normal starting gold (${normalGold}g)`
        )
        .toBeLessThanOrEqual(normalGold);
    }
  });

  it('most tower types are affordable from Hard starting gold', () => {
    // Hard starting gold is 100g. Basic (50g) and at least one other tower
    // must be purchasable to give Hard players meaningful choices.
    const affordableOnHard = Object.values(TOWER_CONFIGS).filter(c => c.cost <= hardGold);
    expect(affordableOnHard.length)
      .withContext(`On Hard (${hardGold}g starting gold), at least 2 tower types must be affordable`)
      .toBeGreaterThanOrEqual(2);
  });

  it('tower cost range is reasonable — most expensive is at most 3× the cheapest', () => {
    // Prevents a situation where one tower is so expensive it never sees play
    // and another so cheap it dominates by sheer quantity.
    const costs = Object.values(TOWER_CONFIGS).map(c => c.cost);
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);

    expect(maxCost)
      .withContext(
        `Max tower cost (${maxCost}g) is more than ${MAX_TOWER_COST_RATIO}× the min (${minCost}g)`
      )
      .toBeLessThanOrEqual(minCost * MAX_TOWER_COST_RATIO);
  });

  it('Slow tower has zero damage — it is a utility tower only', () => {
    expect(TOWER_CONFIGS[TowerType.SLOW].damage).toBe(0);
  });

  it('Sniper has the longest range of all towers', () => {
    const sniperRange = TOWER_CONFIGS[TowerType.SNIPER].range;
    for (const [type, config] of Object.entries(TOWER_CONFIGS)) {
      if (type !== TowerType.SNIPER) {
        expect(sniperRange)
          .withContext(`Sniper range (${sniperRange}) should exceed ${type} range (${config.range})`)
          .toBeGreaterThanOrEqual(config.range);
      }
    }
  });

  it('Basic tower is the cheapest — serves as the accessible entry point', () => {
    const basicCost = TOWER_CONFIGS[TowerType.BASIC].cost;
    for (const [type, config] of Object.entries(TOWER_CONFIGS)) {
      if (type !== TowerType.BASIC) {
        expect(basicCost)
          .withContext(`Basic (${basicCost}g) should be <= ${type} (${config.cost}g)`)
          .toBeLessThanOrEqual(config.cost);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Enemy Stats
// ---------------------------------------------------------------------------

describe('Balance — Enemy Stats', () => {

  it('Boss has the highest health among standard (non-boss-tier) enemy types', () => {
    // Boss HP is 1000 — 10× a Basic (100 HP) and 3.3× a Heavy (300 HP).
    // This 10× ratio between Boss and Basic is a deliberate design decision
    // that makes Boss waves feel categorically different from standard waves.
    // Boss-tier variants (VEINSEEKER, UNSHAKEABLE, WYRM_ASCENDANT, NOVA_SOVEREIGN)
    // are excluded: they are co-equal or apex boss-tier units intentionally
    // matching or exceeding BOSS stats.
    // WYRM_ASCENDANT (sprint 39): 1400 HP boss counter — exceeds BOSS baseline.
    // NOVA_SOVEREIGN (Act 3 final boss): 2800 HP — the apex unit by design.
    const BOSS_TIER_VARIANTS: string[] = [EnemyType.VEINSEEKER, EnemyType.UNSHAKEABLE, EnemyType.WYRM_ASCENDANT, EnemyType.NOVA_SOVEREIGN];
    const bossHp = ENEMY_STATS[EnemyType.BOSS].health;
    for (const [type, stats] of Object.entries(ENEMY_STATS)) {
      if (type !== EnemyType.BOSS && !BOSS_TIER_VARIANTS.includes(type as EnemyType)) {
        expect(bossHp)
          .withContext(`Boss HP (${bossHp}) should exceed ${type} HP (${stats.health})`)
          .toBeGreaterThan(stats.health);
      }
    }
  });

  it('Heavy has the highest health among non-boss ground enemies', () => {
    const heavyHp = ENEMY_STATS[EnemyType.HEAVY].health;
    const nonBossGroundTypes = [EnemyType.BASIC, EnemyType.FAST, EnemyType.SWIFT,
                                EnemyType.SHIELDED, EnemyType.SWARM, EnemyType.FLYING];
    for (const type of nonBossGroundTypes) {
      expect(heavyHp)
        .withContext(`Heavy HP (${heavyHp}) should exceed or equal ${type} HP (${ENEMY_STATS[type].health})`)
        .toBeGreaterThanOrEqual(ENEMY_STATS[type].health);
    }
  });

  it('Fast has the highest speed of all enemy types', () => {
    // Fast (4.0 t/s) is the pure speed threat. Its speed makes it dangerous
    // despite low HP, forcing players to have point-defense or slow towers.
    const fastSpeed = ENEMY_STATS[EnemyType.FAST].speed;
    for (const [type, stats] of Object.entries(ENEMY_STATS)) {
      if (type !== EnemyType.FAST) {
        expect(fastSpeed)
          .withContext(`Fast speed (${fastSpeed}) should be >= ${type} speed (${stats.speed})`)
          .toBeGreaterThanOrEqual(stats.speed);
      }
    }
  });

  it('Boss has the lowest speed — trading mobility for durability', () => {
    // Boss (0.5 t/s) moves slowly enough that a well-placed defense can
    // whittle it down over a long path, but its 1000 HP means you still
    // need sustained fire. The tradeoff makes Boss feel like an attrition fight.
    // NOVA_SOVEREIGN (0.4 t/s) is excluded — the apex boss is intentionally
    // even slower (cosmetic speed; movement is tilesPerTurn-driven).
    const bossSpeed = ENEMY_STATS[EnemyType.BOSS].speed;
    for (const [type, stats] of Object.entries(ENEMY_STATS)) {
      if (type !== EnemyType.BOSS && type !== EnemyType.NOVA_SOVEREIGN) {
        expect(bossSpeed)
          .withContext(`Boss speed (${bossSpeed}) should be <= ${type} speed (${stats.speed})`)
          .toBeLessThanOrEqual(stats.speed);
      }
    }
  });

  it('kill reward scales with threat: Boss > Heavy > Basic', () => {
    // Rewards acknowledge difficulty: a kill that required sustained fire
    // (Boss, Heavy) pays more than a trivial Basic.
    expect(ENEMY_STATS[EnemyType.BOSS].value)
      .toBeGreaterThan(ENEMY_STATS[EnemyType.HEAVY].value);
    expect(ENEMY_STATS[EnemyType.HEAVY].value)
      .toBeGreaterThan(ENEMY_STATS[EnemyType.BASIC].value);
  });

  it('kill reward scales with threat: Shielded > Basic', () => {
    expect(ENEMY_STATS[EnemyType.SHIELDED].value)
      .toBeGreaterThan(ENEMY_STATS[EnemyType.BASIC].value);
  });

  it('kill reward scales with threat: Swift and Flying earn more than Swarm', () => {
    // Swarm units are cannon fodder; their main threat is quantity and death-spawn.
    // Individual swarm kills should pay less than the more threatening Swift/Flying.
    expect(ENEMY_STATS[EnemyType.SWIFT].value)
      .toBeGreaterThan(ENEMY_STATS[EnemyType.SWARM].value);
    expect(ENEMY_STATS[EnemyType.FLYING].value)
      .toBeGreaterThan(ENEMY_STATS[EnemyType.SWARM].value);
  });

  it('leak damage scales with enemy threat tier', () => {
    // Boss leaks 3 lives — equal to Hard difficulty's most dangerous outcome.
    // Heavy and Shielded leak 2 lives. Standard enemies leak 1.
    expect(ENEMY_STATS[EnemyType.BOSS].leakDamage).toBe(3);
    expect(ENEMY_STATS[EnemyType.HEAVY].leakDamage).toBe(2);
    expect(ENEMY_STATS[EnemyType.SHIELDED].leakDamage).toBe(2);
    expect(ENEMY_STATS[EnemyType.BASIC].leakDamage).toBe(1);
    expect(ENEMY_STATS[EnemyType.FAST].leakDamage).toBe(1);
    expect(ENEMY_STATS[EnemyType.SWIFT].leakDamage).toBe(1);
    expect(ENEMY_STATS[EnemyType.SWARM].leakDamage).toBe(1);
    expect(ENEMY_STATS[EnemyType.FLYING].leakDamage).toBe(1);
  });

  it('Shielded type has a maxShield value — shield is its distinguishing trait', () => {
    expect(ENEMY_STATS[EnemyType.SHIELDED].maxShield).toBeDefined();
    expect(ENEMY_STATS[EnemyType.SHIELDED].maxShield!).toBeGreaterThan(0);
  });

  it('Swarm type has a spawnOnDeath value — death-burst is its distinguishing trait', () => {
    expect(ENEMY_STATS[EnemyType.SWARM].spawnOnDeath).toBeDefined();
    expect(ENEMY_STATS[EnemyType.SWARM].spawnOnDeath!).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Endless Mode Balance
// ---------------------------------------------------------------------------

describe('Balance — Endless Mode', () => {

  it('speed multiplier is capped at ENDLESS_MAX_SPEED_MULTIPLIER at wave 1000', () => {
    // Without a cap, enemies would move so fast at deep endless waves that
    // physics steps would skip them through tiles. The cap (1.8×) is the
    // maximum the game was designed and tested to handle.
    const result = generateEndlessWave(1000);
    expect(result.speedMultiplier).toBeLessThanOrEqual(ENDLESS_MAX_SPEED_MULTIPLIER);
  });

  it('speed multiplier cap is reached by wave 27 (0.8 bonus / 0.03 per wave)', () => {
    // ENDLESS_MAX_SPEED_MULTIPLIER = 1.8, so raw bonus = 0.8.
    // At 0.03/wave: ceil(0.8 / 0.03) = 27 waves to hit cap.
    const result = generateEndlessWave(27);
    expect(result.speedMultiplier).toBe(ENDLESS_MAX_SPEED_MULTIPLIER);
  });

  it('speed multiplier does not decrease between waves', () => {
    let prevSpeed = generateEndlessWave(1).speedMultiplier;
    for (let wave = 2; wave <= 30; wave++) {
      const speed = generateEndlessWave(wave).speedMultiplier;
      expect(speed)
        .withContext(`Wave ${wave} speed (${speed}) should be >= wave ${wave - 1} speed (${prevSpeed})`)
        .toBeGreaterThanOrEqual(prevSpeed);
      prevSpeed = speed;
    }
  });

  it('health multiplier grows linearly and never decreases', () => {
    let prevHp = generateEndlessWave(1).healthMultiplier;
    for (let wave = 2; wave <= 50; wave++) {
      const hp = generateEndlessWave(wave).healthMultiplier;
      expect(hp)
        .withContext(`Wave ${wave} health multiplier should be >= wave ${wave - 1}`)
        .toBeGreaterThanOrEqual(prevHp);
      prevHp = hp;
    }
  });

  it('total enemy count at wave 100 is within expected range', () => {
    const result = generateEndlessWave(100);
    const totalEnemies = result.entries.reduce((sum, e) => sum + e.count, 0);

    // Lower bound: BASE + floor(100 * SCALE) = 8 + 80 = 88 (before MIN_PER_ENTRY padding)
    const lowerBound = ENDLESS_BASE_ENEMY_COUNT + Math.floor(100 * ENDLESS_COUNT_SCALE_PER_WAVE);

    expect(totalEnemies)
      .withContext(`Wave 100 should have at least ${lowerBound} enemies`)
      .toBeGreaterThanOrEqual(lowerBound);

    expect(totalEnemies)
      .withContext(`Wave 100 should not exceed ${ENDLESS_WAVE_100_MAX_ENEMIES} enemies`)
      .toBeLessThanOrEqual(ENDLESS_WAVE_100_MAX_ENEMIES);
  });

  it('wave 5 is always a BOSS milestone', () => {
    const result = generateEndlessWave(5);
    expect(result.isMilestone).toBeTrue();
  });

  it('wave 10 is always a BOSS milestone', () => {
    const result = generateEndlessWave(10);
    expect(result.isMilestone).toBeTrue();
  });

  it('wave 1 is not a milestone', () => {
    expect(generateEndlessWave(1).isMilestone).toBeFalse();
  });

  it('wave 3 is not a milestone', () => {
    expect(generateEndlessWave(3).isMilestone).toBeFalse();
  });

  it('wave reward increases with wave number', () => {
    const reward1 = generateEndlessWave(1).reward;
    const reward10 = generateEndlessWave(10).reward;
    expect(reward10).toBeGreaterThan(reward1);
  });

  it('all generated entries have valid EnemyType values', () => {
    const validTypes = new Set(Object.values(EnemyType));
    for (const waveNum of [1, 5, 10, 25, 50, 100]) {
      const result = generateEndlessWave(waveNum);
      for (const entry of result.entries) {
        expect(validTypes.has(entry.type))
          .withContext(`Endless wave ${waveNum} entry has unknown type "${entry.type}"`)
          .toBeTrue();
        expect(entry.count)
          .withContext(`Endless wave ${waveNum} entry count must be > 0`)
          .toBeGreaterThan(0);
        expect(entry.spawnInterval)
          .withContext(`Endless wave ${waveNum} entry spawnInterval must be >= 0`)
          .toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Upgrade Paths
// ---------------------------------------------------------------------------

describe('Balance — Tower Upgrades', () => {

  it('Level 2 increases damage over Level 1', () => {
    expect(UPGRADE_MULTIPLIERS[1].damage).toBeGreaterThan(UPGRADE_MULTIPLIERS[0].damage);
  });

  it('Level 2 increases range over Level 1', () => {
    expect(UPGRADE_MULTIPLIERS[1].range).toBeGreaterThan(UPGRADE_MULTIPLIERS[0].range);
  });

  it('Level 3 is strictly better than Level 2 on all multipliers', () => {
    expect(UPGRADE_MULTIPLIERS[2].damage).toBeGreaterThan(UPGRADE_MULTIPLIERS[1].damage);
    expect(UPGRADE_MULTIPLIERS[2].range).toBeGreaterThan(UPGRADE_MULTIPLIERS[1].range);
  });

  it('Level 3 damage multiplier is at least 2× base (meaningful upgrade ceiling)', () => {
    // L3 at 2.2× base damage — ensures players see a dramatic improvement
    // rather than marginal gains, making the upgrade decision feel impactful.
    expect(UPGRADE_MULTIPLIERS[2].damage).toBeGreaterThanOrEqual(2.0);
  });

  it('upgrade multipliers are strictly monotone across all three levels', () => {
    // Damage and range go up monotonically.
    const [l1, l2, l3] = UPGRADE_MULTIPLIERS;
    expect(l1.damage).toBeLessThan(l2.damage);
    expect(l2.damage).toBeLessThan(l3.damage);
    expect(l1.range).toBeLessThan(l2.range);
    expect(l2.range).toBeLessThan(l3.range);
  });
});
