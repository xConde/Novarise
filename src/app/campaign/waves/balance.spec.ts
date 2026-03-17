/**
 * Balance verification suite for all 16 campaign maps.
 *
 * Philosophy: these tests DOCUMENT the intended balance, not enforce arbitrary
 * thresholds. If a test fails, investigate whether the game data has drifted
 * from design intent before weakening the assertion. Only adjust constants when
 * the game itself has been intentionally rebalanced.
 *
 * Test categories:
 *  1. Economy Balance      — starting gold vs tower costs per difficulty
 *  2. Wave Rewards         — total income sufficiency per campaign level
 *  3. Tower Viability      — affordability, cost spread, DPS variance
 *  4. Difficulty Curve     — HP ramp within levels, tier-over-tier escalation
 *  5. Enemy Stats          — boss supremacy, speed ordering, value scaling
 *  6. Spawn Intervals      — no impossibly-fast spawners
 *  7. Endless Mode         — speed cap, enemy count bounds
 *  8. Upgrade Paths        — L2 improves all combat stats over L1
 */

import { CAMPAIGN_WAVE_DEFINITIONS } from './campaign-waves';
import { CAMPAIGN_LEVELS, CampaignTier } from '../models/campaign.model';
import { TOWER_CONFIGS, UPGRADE_MULTIPLIERS, TowerType } from '../../game/game-board/models/tower.model';
import { ENEMY_STATS, EnemyType } from '../../game/game-board/models/enemy.model';
import {
  DIFFICULTY_PRESETS,
  DifficultyLevel,
} from '../../game/game-board/models/game-state.model';
import {
  generateEndlessWave,
  ENDLESS_MAX_SPEED_MULTIPLIER,
  ENDLESS_BASE_ENEMY_COUNT,
  ENDLESS_COUNT_SCALE_PER_WAVE,
} from '../../game/game-board/models/endless-wave.model';

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
 * Maximum allowed ratio between the highest and second-highest DPS/cost
 * efficiency among damage-dealing towers.
 *
 * Mortar and Splash have intentionally low raw DPS because their value is
 * AoE/DoT/status — comparing max-to-min would always flag them. Comparing the
 * top two efficiencies catches a scenario where one direct-damage tower is
 * tuned to be absurdly dominant over the next best option.
 *
 * Current values (Basic 0.500, Sniper 0.256, Chain 0.156, Splash 0.133):
 * ratio = 0.500 / 0.256 ≈ 1.95×.  A limit of 4× gives a comfortable buffer.
 */
const MAX_DPS_COST_EFFICIENCY_RATIO = 4;

/**
 * Multiplier applied to gridSize to estimate the minimum number of towers
 * needed for a viable defense. Rough heuristic: one tower per 3 grid units.
 */
const INCOME_SUFFICIENCY_GRID_FACTOR = 3;

/**
 * Total income (starting gold + wave rewards + kill values on Normal) must
 * be at least this many times the cheapest tower cost, times the tower count
 * estimate for the level's grid size.
 *
 * Set to 3 so that the test fails if all wave rewards were zeroed out.
 * For level 1 (gridSize 10): required = 50 * ceil(10/3) * 3 = 600g.
 * Normal starting gold is 200g, so wave rewards + kills must cover ≥ 400g.
 */
const INCOME_SUFFICIENCY_MULTIPLIER = 3;

/**
 * Minimum spawn interval (seconds) allowed in any campaign wave entry.
 * Values below this are nearly impossible to react to on a real board.
 * The observed minimum in campaign data is 0.4s (campaign_16 SWARM entries).
 */
const MIN_ALLOWED_SPAWN_INTERVAL_S = 0.3;

/**
 * Upper bound on total enemy count for endless wave 100.
 * Ensures the game stays playable rather than degrading to an unwinnable wall.
 * Formula: BASE + floor(100 * COUNT_SCALE) = 8 + 80 = 88, plus MIN_ENEMIES_PER_ENTRY
 * padding across 3-5 entries. 120 gives comfortable headroom.
 */
const ENDLESS_WAVE_100_MAX_ENEMIES = 120;

/**
 * Minimum required HP increase from first to last wave (as a ratio).
 * Last wave total HP must be at least this many times the first wave.
 *
 * Set to 1.5 — a meaningful improvement over the previous check (ratio=1, i.e. just
 * "last > first"). campaign_08 (Crystal Maze) is the tightest case at ≈1.82×: its
 * wave 10 is a targeted mini-boss wave rather than a mass-quantity wave, giving lower
 * total HP than a pure-swarm finale would. 2.0 would fail that map; 1.5 passes it
 * while still catching any map that barely grows difficulty wave-over-wave.
 */
const HP_RAMP_MIN_LAST_TO_FIRST_RATIO = 1.5;

/**
 * Endgame tier (maps 15-16) total HP in the final wave must exceed
 * intro tier (maps 1-4) average final-wave HP by at least this factor.
 *
 * Measured from actual wave data: endgame avg ≈ 6480 HP, intro avg ≈ 1438 HP → ratio ≈ 4.5×.
 * Using 4 as the floor to give a stable lower-bound without being brittle to small adjustments.
 */
const ENDGAME_VS_INTRO_HP_RATIO = 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sum total raw HP for a single wave (excludes shield HP — tests raw health). */
function waveTotalHp(wave: { entries: { type: EnemyType; count: number }[] }): number {
  return wave.entries.reduce(
    (sum, entry) => sum + ENEMY_STATS[entry.type].health * entry.count,
    0,
  );
}

/** Sum total kill value for a single wave. */
function waveTotalKillValue(wave: { entries: { type: EnemyType; count: number }[] }): number {
  return wave.entries.reduce(
    (sum, entry) => sum + ENEMY_STATS[entry.type].value * entry.count,
    0,
  );
}

/** Total kill gold for all waves in a level. */
function levelTotalKillValue(levelId: string): number {
  const waves = CAMPAIGN_WAVE_DEFINITIONS[levelId] ?? [];
  return waves.reduce((sum, wave) => sum + waveTotalKillValue(wave), 0);
}

/** Total wave-completion rewards for a level. */
function levelTotalWaveRewards(levelId: string): number {
  const waves = CAMPAIGN_WAVE_DEFINITIONS[levelId] ?? [];
  return waves.reduce((sum, wave) => sum + wave.reward, 0);
}

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
// 2. Wave Rewards — total income sufficiency per campaign level
// ---------------------------------------------------------------------------

describe('Balance — Wave Rewards', () => {
  const normalGold = DIFFICULTY_PRESETS[DifficultyLevel.NORMAL].gold;
  const cheapestTower = TOWER_CONFIGS[TowerType.BASIC].cost;

  it('each campaign level provides sufficient total income on Normal', () => {
    for (const level of CAMPAIGN_LEVELS) {
      const waves = CAMPAIGN_WAVE_DEFINITIONS[level.id];
      if (!waves) {
        fail(`No wave definitions for ${level.id}`);
        continue;
      }

      const waveRewards = levelTotalWaveRewards(level.id);
      const killValue = levelTotalKillValue(level.id);
      const totalIncome = normalGold + waveRewards + killValue;

      // Rough estimate: need one tower per INCOME_SUFFICIENCY_GRID_FACTOR grid units.
      const estimatedTowersNeeded = Math.ceil(level.gridSize / INCOME_SUFFICIENCY_GRID_FACTOR);
      const minimumIncomeRequired = cheapestTower * estimatedTowersNeeded * INCOME_SUFFICIENCY_MULTIPLIER;

      expect(totalIncome)
        .withContext(
          `Level ${level.id} (${level.name}): total income ${totalIncome}g < required ${minimumIncomeRequired}g ` +
          `(grid=${level.gridSize}, est. towers=${estimatedTowersNeeded})`
        )
        .toBeGreaterThanOrEqual(minimumIncomeRequired);
    }
  });

  it('wave rewards increase from early to late campaign levels', () => {
    // Intro tier average final-wave reward should be lower than endgame tier average.
    const introIds = CAMPAIGN_LEVELS.filter(l => l.tier === CampaignTier.INTRO).map(l => l.id);
    const endgameIds = CAMPAIGN_LEVELS.filter(l => l.tier === CampaignTier.ENDGAME).map(l => l.id);

    const introAvgFinalReward =
      introIds.reduce((sum, id) => {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[id];
        return sum + waves[waves.length - 1].reward;
      }, 0) / introIds.length;

    const endgameAvgFinalReward =
      endgameIds.reduce((sum, id) => {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[id];
        return sum + waves[waves.length - 1].reward;
      }, 0) / endgameIds.length;

    expect(endgameAvgFinalReward)
      .withContext(
        `Endgame avg final reward (${endgameAvgFinalReward}) should exceed ` +
        `intro avg final reward (${introAvgFinalReward})`
      )
      .toBeGreaterThan(introAvgFinalReward);
  });

  it('each level wave rewards can fund at least 1 tower per 3 waves on average', () => {
    for (const level of CAMPAIGN_LEVELS) {
      const waves = CAMPAIGN_WAVE_DEFINITIONS[level.id];
      if (!waves) continue;

      const totalWaveRewards = levelTotalWaveRewards(level.id);
      const avgRewardPerWave = totalWaveRewards / waves.length;

      // A wave that rewards less than 1/3 of a Basic tower on average is too stingy
      // to fund meaningful tower expansion through wave completions alone.
      const minAvgRewardPerWave = cheapestTower / 3;

      expect(avgRewardPerWave)
        .withContext(
          `Level ${level.id} avg wave reward ${avgRewardPerWave.toFixed(0)}g is below ` +
          `minimum ${minAvgRewardPerWave.toFixed(0)}g per wave`
        )
        .toBeGreaterThanOrEqual(minAvgRewardPerWave);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Tower Viability
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

  it('DPS/cost efficiency varies across damage-dealing towers (no single dominant tower)', () => {
    // Compare top-2 DPS/cost efficiencies to catch a scenario where one direct-damage
    // tower is tuned absurdly better than all alternatives.
    //
    // Mortar and Splash have intentionally low raw DPS (their value is AoE/DoT/status),
    // so comparing max-to-min would trivially fail. Comparing top-two isolates the
    // "direct damage" towers where dominance would actually be a balance problem.
    //
    // Current top-2: Basic (0.500) / Sniper (0.256) ≈ 1.95×.
    // MAX_DPS_COST_EFFICIENCY_RATIO = 4 gives stable headroom.
    const damagingTowers = Object.values(TOWER_CONFIGS).filter(c => c.damage > 0);
    const efficiencies = damagingTowers
      .map(c => (c.damage / c.fireRate) / c.cost)
      .sort((a, b) => b - a); // descending

    expect(efficiencies.length)
      .withContext('Need at least 2 damage-dealing tower types to compare')
      .toBeGreaterThanOrEqual(2);

    const topEfficiency = efficiencies[0];
    const secondEfficiency = efficiencies[1];

    expect(topEfficiency)
      .withContext('DPS/cost standard deviation should be > 0 across damage-dealing towers')
      .toBeGreaterThan(secondEfficiency);

    expect(topEfficiency / secondEfficiency)
      .withContext(
        `Top DPS/cost efficiency (${topEfficiency.toFixed(4)}) is more than ` +
        `${MAX_DPS_COST_EFFICIENCY_RATIO}× the second-highest (${secondEfficiency.toFixed(4)}). ` +
        `A single tower is dominantly more efficient than all others.`
      )
      .toBeLessThanOrEqual(MAX_DPS_COST_EFFICIENCY_RATIO);
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

  it('Mortar has the slowest fire rate (longest interval = highest fireRate value)', () => {
    // fireRate = seconds between shots; higher = slower.
    // Mortar is an artillery piece — it should have the worst fire rate.
    const mortarRate = TOWER_CONFIGS[TowerType.MORTAR].fireRate;
    for (const [type, config] of Object.entries(TOWER_CONFIGS)) {
      if (type !== TowerType.MORTAR) {
        expect(mortarRate)
          .withContext(
            `Mortar fireRate (${mortarRate}s) should be >= ${type} fireRate (${config.fireRate}s)`
          )
          .toBeGreaterThanOrEqual(config.fireRate);
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
// 4. Difficulty Curve
// ---------------------------------------------------------------------------

describe('Balance — Difficulty Curve', () => {

  describe('within each campaign level, last wave is harder than first', () => {
    for (const level of CAMPAIGN_LEVELS) {
      it(`${level.id} (${level.name}) — last wave total HP exceeds first wave`, () => {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[level.id];
        if (!waves || waves.length < 2) return;

        const firstWaveHp = waveTotalHp(waves[0]);
        const lastWaveHp = waveTotalHp(waves[waves.length - 1]);

        expect(lastWaveHp)
          .withContext(
            `${level.id}: last wave HP (${lastWaveHp}) should exceed first wave HP (${firstWaveHp})`
          )
          .toBeGreaterThan(firstWaveHp * HP_RAMP_MIN_LAST_TO_FIRST_RATIO);
      });
    }
  });

  it('endgame final-wave HP is significantly higher than intro final-wave HP', () => {
    // Maps 15-16 are the "ultimate challenge" — their final waves should be
    // substantially more punishing than anything in the intro tier (maps 1-4).
    const introIds = CAMPAIGN_LEVELS.filter(l => l.tier === CampaignTier.INTRO).map(l => l.id);
    const endgameIds = CAMPAIGN_LEVELS.filter(l => l.tier === CampaignTier.ENDGAME).map(l => l.id);

    const introAvgFinalHp =
      introIds.reduce((sum, id) => {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[id];
        return sum + waveTotalHp(waves[waves.length - 1]);
      }, 0) / introIds.length;

    const endgameAvgFinalHp =
      endgameIds.reduce((sum, id) => {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[id];
        return sum + waveTotalHp(waves[waves.length - 1]);
      }, 0) / endgameIds.length;

    expect(endgameAvgFinalHp)
      .withContext(
        `Endgame avg final HP (${endgameAvgFinalHp.toFixed(0)}) should be at least ` +
        `${ENDGAME_VS_INTRO_HP_RATIO}× intro avg final HP (${introAvgFinalHp.toFixed(0)})`
      )
      .toBeGreaterThanOrEqual(introAvgFinalHp * ENDGAME_VS_INTRO_HP_RATIO);
  });

  it('tier total HP escalates: intro < early < mid < late < endgame', () => {
    function avgFinalWaveHpForTier(tier: CampaignTier): number {
      const levels = CAMPAIGN_LEVELS.filter(l => l.tier === tier);
      const total = levels.reduce((sum, level) => {
        const waves = CAMPAIGN_WAVE_DEFINITIONS[level.id];
        return sum + waveTotalHp(waves[waves.length - 1]);
      }, 0);
      return total / levels.length;
    }

    const introHp = avgFinalWaveHpForTier(CampaignTier.INTRO);
    const earlyHp = avgFinalWaveHpForTier(CampaignTier.EARLY);
    const midHp = avgFinalWaveHpForTier(CampaignTier.MID);
    const lateHp = avgFinalWaveHpForTier(CampaignTier.LATE);
    const endgameHp = avgFinalWaveHpForTier(CampaignTier.ENDGAME);

    expect(earlyHp).withContext('Early avg final HP should exceed Intro').toBeGreaterThan(introHp);
    expect(midHp).withContext('Mid avg final HP should exceed Early').toBeGreaterThan(earlyHp);
    expect(lateHp).withContext('Late avg final HP should exceed Mid').toBeGreaterThan(midHp);
    expect(endgameHp).withContext('Endgame avg final HP should exceed Late').toBeGreaterThan(lateHp);
  });

  it('no campaign level has identical first and last wave HP (flat difficulty curve)', () => {
    for (const level of CAMPAIGN_LEVELS) {
      const waves = CAMPAIGN_WAVE_DEFINITIONS[level.id];
      if (!waves || waves.length < 2) continue;
      expect(waveTotalHp(waves[0]))
        .withContext(`${level.id}: first and last wave HP must differ`)
        .not.toEqual(waveTotalHp(waves[waves.length - 1]));
    }
  });

  it('mid tier maps (9-12) all have a Boss in their final wave', () => {
    // Maps 9-12 reach a Boss finale on wave 10 — this is the mid-game climax
    // that demands the player has built up sustained DPS through the prior waves.
    // If Boss is removed from mid-tier finales, the difficulty curve collapses.
    const midIds = CAMPAIGN_LEVELS.filter(l => l.tier === CampaignTier.MID).map(l => l.id);
    for (const id of midIds) {
      const waves = CAMPAIGN_WAVE_DEFINITIONS[id];
      if (!waves) { fail(`No wave definitions for ${id}`); continue; }
      const finalWave = waves[waves.length - 1];
      const hasBoss = finalWave.entries.some(e => e.type === EnemyType.BOSS);
      expect(hasBoss)
        .withContext(`${id} final wave should contain a Boss — mid tier climax`)
        .toBeTrue();
    }
  });

  it('late tier maps (13-14) all have a Boss in their final wave', () => {
    // Maps 13-14 are the pre-endgame tier — their final waves must include a Boss
    // to maintain escalating pressure and prepare players for the endgame maps.
    const lateIds = CAMPAIGN_LEVELS.filter(l => l.tier === CampaignTier.LATE).map(l => l.id);
    for (const id of lateIds) {
      const waves = CAMPAIGN_WAVE_DEFINITIONS[id];
      if (!waves) { fail(`No wave definitions for ${id}`); continue; }
      const finalWave = waves[waves.length - 1];
      const hasBoss = finalWave.entries.some(e => e.type === EnemyType.BOSS);
      expect(hasBoss)
        .withContext(`${id} final wave should contain a Boss — late tier climax`)
        .toBeTrue();
    }
  });

  it('endgame tier maps (15-16) all have a Boss in their final wave', () => {
    // Maps 15-16 are the ultimate challenge — their final waves must include at
    // least one Boss. Endgame maps also have Boss appearances in earlier waves,
    // but the final wave Boss is the design-mandated climax.
    const endgameIds = CAMPAIGN_LEVELS.filter(l => l.tier === CampaignTier.ENDGAME).map(l => l.id);
    for (const id of endgameIds) {
      const waves = CAMPAIGN_WAVE_DEFINITIONS[id];
      if (!waves) { fail(`No wave definitions for ${id}`); continue; }
      const finalWave = waves[waves.length - 1];
      const hasBoss = finalWave.entries.some(e => e.type === EnemyType.BOSS);
      expect(hasBoss)
        .withContext(`${id} final wave should contain a Boss — endgame tier climax`)
        .toBeTrue();
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Enemy Stats
// ---------------------------------------------------------------------------

describe('Balance — Enemy Stats', () => {

  it('Boss has the highest health of all enemy types', () => {
    // Boss HP is 1000 — 10× a Basic (100 HP) and 3.3× a Heavy (300 HP).
    // This 10× ratio between Boss and Basic is a deliberate design decision
    // that makes Boss waves feel categorically different from standard waves.
    const bossHp = ENEMY_STATS[EnemyType.BOSS].health;
    for (const [type, stats] of Object.entries(ENEMY_STATS)) {
      if (type !== EnemyType.BOSS) {
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
    const bossSpeed = ENEMY_STATS[EnemyType.BOSS].speed;
    for (const [type, stats] of Object.entries(ENEMY_STATS)) {
      if (type !== EnemyType.BOSS) {
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
// 6. Spawn Intervals
// ---------------------------------------------------------------------------

describe('Balance — Spawn Intervals', () => {

  it('no campaign wave entry has a spawn interval below the minimum threshold', () => {
    // Spawn intervals below MIN_ALLOWED_SPAWN_INTERVAL_S are nearly impossible
    // for game logic to process cleanly and create an overwhelming visual and
    // mechanical wall. The only exception is 0.0 (used for solo Boss spawns).
    for (const level of CAMPAIGN_LEVELS) {
      const waves = CAMPAIGN_WAVE_DEFINITIONS[level.id] ?? [];
      for (let w = 0; w < waves.length; w++) {
        for (const entry of waves[w].entries) {
          const interval = entry.spawnInterval;
          // 0.0 is allowed — it means "spawn immediately" for single-enemy entries
          if (interval === 0) continue;
          expect(interval)
            .withContext(
              `${level.id} wave ${w + 1} type ${entry.type} has spawn interval ` +
              `${interval}s < minimum ${MIN_ALLOWED_SPAWN_INTERVAL_S}s`
            )
            .toBeGreaterThanOrEqual(MIN_ALLOWED_SPAWN_INTERVAL_S);
        }
      }
    }
  });

  it('zero spawn intervals are only used for single-enemy (solo) entries', () => {
    // A 0.0 spawn interval on a multi-enemy entry would dump all enemies
    // simultaneously, which is unintended behavior. Solo Boss spawns use 0.0
    // to mean "spawn the only enemy immediately, no delay needed."
    for (const level of CAMPAIGN_LEVELS) {
      const waves = CAMPAIGN_WAVE_DEFINITIONS[level.id] ?? [];
      for (let w = 0; w < waves.length; w++) {
        for (const entry of waves[w].entries) {
          if (entry.spawnInterval === 0) {
            expect(entry.count)
              .withContext(
                `${level.id} wave ${w + 1} type ${entry.type}: ` +
                `spawnInterval=0 should only be used for count=1 (got count=${entry.count})`
              )
              .toBe(1);
          }
        }
      }
    }
  });

  it('every wave has at least one entry with a non-zero spawn interval (wave is not instant)', () => {
    // A wave where ALL entries have interval=0 would spawn everything simultaneously.
    for (const level of CAMPAIGN_LEVELS) {
      const waves = CAMPAIGN_WAVE_DEFINITIONS[level.id] ?? [];
      for (let w = 0; w < waves.length; w++) {
        const wave = waves[w];
        // Only matters if there's more than one entry total across the wave.
        const totalEnemies = wave.entries.reduce((sum, e) => sum + e.count, 0);
        if (totalEnemies <= 1) continue;

        const hasNonZeroInterval = wave.entries.some(e => e.spawnInterval > 0 || e.count === 1);
        expect(hasNonZeroInterval)
          .withContext(`${level.id} wave ${w + 1} has ${totalEnemies} enemies but all intervals are 0`)
          .toBeTrue();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Endless Mode Balance
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
// 8. Upgrade Paths
// ---------------------------------------------------------------------------

describe('Balance — Tower Upgrades', () => {

  it('Level 2 increases damage over Level 1', () => {
    expect(UPGRADE_MULTIPLIERS[1].damage).toBeGreaterThan(UPGRADE_MULTIPLIERS[0].damage);
  });

  it('Level 2 increases range over Level 1', () => {
    expect(UPGRADE_MULTIPLIERS[1].range).toBeGreaterThan(UPGRADE_MULTIPLIERS[0].range);
  });

  it('Level 2 improves fire rate over Level 1 (lower interval = faster)', () => {
    expect(UPGRADE_MULTIPLIERS[1].fireRate).toBeLessThan(UPGRADE_MULTIPLIERS[0].fireRate);
  });

  it('Level 3 is strictly better than Level 2 on all multipliers', () => {
    expect(UPGRADE_MULTIPLIERS[2].damage).toBeGreaterThan(UPGRADE_MULTIPLIERS[1].damage);
    expect(UPGRADE_MULTIPLIERS[2].range).toBeGreaterThan(UPGRADE_MULTIPLIERS[1].range);
    expect(UPGRADE_MULTIPLIERS[2].fireRate).toBeLessThan(UPGRADE_MULTIPLIERS[1].fireRate);
  });

  it('Level 3 damage multiplier is at least 2× base (meaningful upgrade ceiling)', () => {
    // L3 at 2.2× base damage — ensures players see a dramatic improvement
    // rather than marginal gains, making the upgrade decision feel impactful.
    expect(UPGRADE_MULTIPLIERS[2].damage).toBeGreaterThanOrEqual(2.0);
  });

  it('upgrade multipliers are strictly monotone across all three levels', () => {
    // Damage and range go up. FireRate goes down (lower = faster = better).
    const [l1, l2, l3] = UPGRADE_MULTIPLIERS;
    expect(l1.damage).toBeLessThan(l2.damage);
    expect(l2.damage).toBeLessThan(l3.damage);
    expect(l1.range).toBeLessThan(l2.range);
    expect(l2.range).toBeLessThan(l3.range);
    expect(l1.fireRate).toBeGreaterThan(l2.fireRate);
    expect(l2.fireRate).toBeGreaterThan(l3.fireRate);
  });
});
