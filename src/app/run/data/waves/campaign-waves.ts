import { WaveDefinition } from '../../../game/game-board/models/wave.model';
import { EnemyType } from '../../../game/game-board/models/enemy.model';

// ── Common spawn intervals (seconds between enemy spawns) ──────────────────
const SPAWN_FAST     = 0.4; // rapid spawn for swarm pressure
const SPAWN_QUICK    = 0.6; // fast spawn for speed waves
const SPAWN_NORMAL   = 0.8; // standard spawn pacing
const SPAWN_MODERATE = 1.0; // moderate pacing
const SPAWN_SLOW     = 1.2; // slow spawn for heavy/boss enemies
const SPAWN_HEAVY    = 1.5; // very slow for tank enemies
const SPAWN_BOSS     = 2.0; // deliberate boss pacing

/** Spawn interval for single-enemy wave entries (e.g., solo Boss). Interval is irrelevant when count=1. */
const SOLO_SPAWN_INTERVAL = 0;

// ── Tier reward ranges ─────────────────────────────────────────────────────
// Intro maps (1-4):   gentle rewards — 15-40g per wave, total ~250-400g (Normal)
// Early maps (5-8):   moderate rewards — 25-65g per wave
// Mid maps (9-12):    substantial rewards — 40-120g per wave
// Late maps (13-14):  high rewards — 55-200g per wave
// Endgame maps (15-16): maximum rewards — 60-320g per wave

/**
 * Per-level wave definitions for campaign mode.
 * Wave count for each key must match its level's waveCount in CAMPAIGN_LEVELS.
 *
 * Design philosophy:
 * - Intro tier (1-4):   6-8 waves, only Basic/Fast/Heavy enemies, gentle ramp
 * - Early tier (5-8):   8-10 waves, introduce Swift/Shielded
 * - Mid tier (9-12):    10 waves, full enemy roster, themed compositions
 * - Late tier (13-14):  10 waves, brutal compositions, boss finales
 * - Endgame tier (15-16): 12 waves, everything at once, multiple bosses
 */
export const CAMPAIGN_WAVE_DEFINITIONS: Record<string, WaveDefinition[]> = {

  // ── INTRO TIER (Maps 1-4) ──────────────────────────────────────────────────
  // Design: 6-8 waves, Basic/Fast/Heavy only, gentle ramp
  // Rewards: 15-40g per wave, total income ~250-400g (Normal difficulty)

  // ─── Map 1: First Light — 6 waves ──────────────────────────────────────────
  // Straight path, teach survival. Only Basic enemies.
  campaign_01: [
    // Wave 1: 3 Basic — easiest possible opening
    { entries: [{ type: EnemyType.BASIC, count: 3, spawnInterval: SPAWN_BOSS }], reward: 15 },
    // Wave 2: 5 Basic — slightly more pressure
    { entries: [{ type: EnemyType.BASIC, count: 5, spawnInterval: 1.8 }], reward: 20 },
    // Wave 3: 6 Basic, tighter interval
    { entries: [{ type: EnemyType.BASIC, count: 6, spawnInterval: SPAWN_HEAVY }], reward: 25 },
    // Wave 4: 8 Basic — need more towers
    { entries: [{ type: EnemyType.BASIC, count: 8, spawnInterval: SPAWN_SLOW }], reward: 30 },
    // Wave 5: 10 Basic — real pressure now
    { entries: [{ type: EnemyType.BASIC, count: 10, spawnInterval: SPAWN_MODERATE }], reward: 35 },
    // Wave 6: 12 Basic — straight-line finale
    { entries: [{ type: EnemyType.BASIC, count: 12, spawnInterval: 0.9 }], reward: 50 },
  ],

  // ─── Map 2: The Bend — 7 waves ─────────────────────────────────────────────
  // Path turns. Introduce Fast on wave 4 to teach speed matters.
  campaign_02: [
    // Wave 1: Basic only
    { entries: [{ type: EnemyType.BASIC, count: 4, spawnInterval: 1.8 }], reward: 15 },
    // Wave 2: More Basic
    { entries: [{ type: EnemyType.BASIC, count: 6, spawnInterval: SPAWN_HEAVY }], reward: 20 },
    // Wave 3: Basic, tighter pack
    { entries: [{ type: EnemyType.BASIC, count: 8, spawnInterval: SPAWN_SLOW }], reward: 25 },
    // Wave 4: Fast introduced — surprise speed threat
    { entries: [
      { type: EnemyType.BASIC, count: 5, spawnInterval: SPAWN_SLOW },
      { type: EnemyType.FAST,  count: 3, spawnInterval: 0.9 },
    ], reward: 35 },
    // Wave 5: More Fast, fewer Basic
    { entries: [
      { type: EnemyType.BASIC, count: 4, spawnInterval: SPAWN_SLOW },
      { type: EnemyType.FAST,  count: 5, spawnInterval: SPAWN_NORMAL },
    ], reward: 40 },
    // Wave 6: Fast rush
    { entries: [
      { type: EnemyType.FAST,  count: 8, spawnInterval: 0.7 },
    ], reward: 45 },
    // Wave 7: Mixed finale
    { entries: [
      { type: EnemyType.BASIC, count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.FAST,  count: 6, spawnInterval: 0.7 },
    ], reward: 60 },
  ],

  // ─── Map 3: Serpentine — 8 waves ───────────────────────────────────────────
  // Winding road gives time. Introduce Heavy on wave 6 to teach DPS vs tank.
  campaign_03: [
    { entries: [{ type: EnemyType.BASIC, count: 5, spawnInterval: SPAWN_HEAVY }], reward: 20 },
    { entries: [{ type: EnemyType.BASIC, count: 7, spawnInterval: 1.3 }], reward: 25 },
    { entries: [
      { type: EnemyType.BASIC, count: 6, spawnInterval: SPAWN_SLOW },
      { type: EnemyType.FAST,  count: 3, spawnInterval: 0.9 },
    ], reward: 30 },
    { entries: [
      { type: EnemyType.BASIC, count: 5, spawnInterval: 1.1 },
      { type: EnemyType.FAST,  count: 5, spawnInterval: SPAWN_NORMAL },
    ], reward: 40 },
    // Wave 5: Fast push
    { entries: [
      { type: EnemyType.FAST,  count: 8, spawnInterval: 0.7 },
    ], reward: 45 },
    // Wave 6: Heavy introduced — tank threat
    { entries: [
      { type: EnemyType.BASIC,  count: 6, spawnInterval: SPAWN_SLOW },
      { type: EnemyType.HEAVY,  count: 2, spawnInterval: 2.5 },
    ], reward: 55 },
    // Wave 7: Fast + Heavy mix
    { entries: [
      { type: EnemyType.FAST,   count: 5, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.HEAVY,  count: 3, spawnInterval: SPAWN_BOSS },
    ], reward: 65 },
    // Wave 8: All three — serpentine finale
    { entries: [
      { type: EnemyType.BASIC,  count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.FAST,   count: 4, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.HEAVY,  count: 2, spawnInterval: SPAWN_BOSS },
    ], reward: 80 },
  ],

  // ─── Map 4: The Fork — 8 waves ─────────────────────────────────────────────
  // Two exits means enemies split. Mix of Basic/Fast/Heavy throughout.
  campaign_04: [
    { entries: [{ type: EnemyType.BASIC, count: 5, spawnInterval: SPAWN_HEAVY }], reward: 20 },
    { entries: [
      { type: EnemyType.BASIC, count: 6, spawnInterval: 1.3 },
      { type: EnemyType.FAST,  count: 2, spawnInterval: SPAWN_MODERATE },
    ], reward: 28 },
    { entries: [
      { type: EnemyType.BASIC, count: 5, spawnInterval: SPAWN_SLOW },
      { type: EnemyType.FAST,  count: 4, spawnInterval: 0.9 },
    ], reward: 35 },
    { entries: [
      { type: EnemyType.FAST,  count: 8, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.HEAVY, count: 1, spawnInterval: 2.5 },
    ], reward: 45 },
    { entries: [
      { type: EnemyType.BASIC, count: 6, spawnInterval: 1.1 },
      { type: EnemyType.HEAVY, count: 2, spawnInterval: 2.2 },
    ], reward: 50 },
    { entries: [
      { type: EnemyType.FAST,  count: 6, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.HEAVY, count: 3, spawnInterval: SPAWN_BOSS },
    ], reward: 60 },
    { entries: [
      { type: EnemyType.BASIC, count: 8, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.FAST,  count: 4, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.HEAVY, count: 2, spawnInterval: SPAWN_BOSS },
    ], reward: 75 },
    // Wave 8: Fork finale — heavy escort
    { entries: [
      { type: EnemyType.HEAVY, count: 4, spawnInterval: 1.8 },
      { type: EnemyType.BASIC, count: 8, spawnInterval: 0.9 },
      { type: EnemyType.FAST,  count: 5, spawnInterval: 0.7 },
    ], reward: 100 },
  ],

  // ── EARLY TIER (Maps 5-8) ──────────────────────────────────────────────────
  // Design: 8-10 waves, introduce Swift/Shielded
  // Rewards: 25-65g per wave, total income ~450-700g (Normal difficulty)

  // ─── Map 5: Twin Gates — 8 waves ───────────────────────────────────────────
  // Dual spawners. Introduce Swift wave 4. Split formations demand coverage.
  campaign_05: [
    { entries: [
      { type: EnemyType.BASIC, count: 5, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.FAST,  count: 2, spawnInterval: SPAWN_MODERATE },
    ], reward: 30 },
    { entries: [
      { type: EnemyType.BASIC, count: 6, spawnInterval: 1.3 },
      { type: EnemyType.FAST,  count: 4, spawnInterval: 0.9 },
    ], reward: 38 },
    { entries: [
      { type: EnemyType.FAST,  count: 6, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.HEAVY, count: 2, spawnInterval: SPAWN_BOSS },
    ], reward: 48 },
    // Wave 4: Swift introduced
    { entries: [
      { type: EnemyType.BASIC, count: 5, spawnInterval: SPAWN_SLOW },
      { type: EnemyType.SWIFT, count: 4, spawnInterval: SPAWN_MODERATE },
    ], reward: 55 },
    { entries: [
      { type: EnemyType.FAST,  count: 5, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.SWIFT, count: 4, spawnInterval: 0.9 },
    ], reward: 60 },
    { entries: [
      { type: EnemyType.SWIFT, count: 6, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.HEAVY, count: 3, spawnInterval: 1.8 },
    ], reward: 70 },
    { entries: [
      { type: EnemyType.BASIC, count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.FAST,  count: 4, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.SWIFT, count: 4, spawnInterval: 0.9 },
      { type: EnemyType.HEAVY, count: 2, spawnInterval: 1.8 },
    ], reward: 85 },
    // Wave 8: Dual-gate finale
    { entries: [
      { type: EnemyType.SWIFT, count: 6, spawnInterval: 0.7 },
      { type: EnemyType.HEAVY, count: 4, spawnInterval: 1.6 },
      { type: EnemyType.FAST,  count: 6, spawnInterval: 0.7 },
    ], reward: 110 },
  ],

  // ─── Map 6: Open Ground — 9 waves ──────────────────────────────────────────
  // No walls. Economy-intensive. Steady ramp without guaranteed chokepoints.
  campaign_06: [
    { entries: [
      { type: EnemyType.BASIC, count: 5, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.FAST,  count: 3, spawnInterval: SPAWN_MODERATE },
    ], reward: 30 },
    { entries: [
      { type: EnemyType.BASIC, count: 7, spawnInterval: 1.3 },
      { type: EnemyType.FAST,  count: 3, spawnInterval: 0.9 },
    ], reward: 38 },
    { entries: [
      { type: EnemyType.BASIC, count: 6, spawnInterval: SPAWN_SLOW },
      { type: EnemyType.SWIFT, count: 4, spawnInterval: SPAWN_MODERATE },
    ], reward: 45 },
    { entries: [
      { type: EnemyType.FAST,  count: 6, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.SWIFT, count: 4, spawnInterval: 0.9 },
    ], reward: 52 },
    { entries: [
      { type: EnemyType.BASIC, count: 6, spawnInterval: 1.1 },
      { type: EnemyType.HEAVY, count: 3, spawnInterval: SPAWN_BOSS },
    ], reward: 60 },
    { entries: [
      { type: EnemyType.FAST,  count: 7, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.HEAVY, count: 3, spawnInterval: 1.8 },
    ], reward: 70 },
    { entries: [
      { type: EnemyType.SWIFT, count: 6, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.HEAVY, count: 4, spawnInterval: 1.7 },
    ], reward: 80 },
    { entries: [
      { type: EnemyType.BASIC, count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.FAST,  count: 5, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.SWIFT, count: 4, spawnInterval: 0.9 },
    ], reward: 90 },
    // Wave 9: Open ground finale — heavy economy test
    { entries: [
      { type: EnemyType.HEAVY, count: 6, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.SWIFT, count: 6, spawnInterval: 0.7 },
      { type: EnemyType.FAST,  count: 5, spawnInterval: 0.7 },
    ], reward: 120 },
  ],

  // ─── Map 7: The Narrows — 9 waves ──────────────────────────────────────────
  // Tight chokepoints. Introduce Shielded wave 5. Every shot counts.
  campaign_07: [
    { entries: [
      { type: EnemyType.BASIC, count: 6, spawnInterval: 1.4 },
      { type: EnemyType.FAST,  count: 3, spawnInterval: SPAWN_MODERATE },
    ], reward: 32 },
    { entries: [
      { type: EnemyType.BASIC, count: 7, spawnInterval: SPAWN_SLOW },
      { type: EnemyType.HEAVY, count: 2, spawnInterval: SPAWN_BOSS },
    ], reward: 42 },
    { entries: [
      { type: EnemyType.FAST,  count: 7, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.HEAVY, count: 2, spawnInterval: 1.9 },
    ], reward: 50 },
    { entries: [
      { type: EnemyType.BASIC, count: 5, spawnInterval: 1.1 },
      { type: EnemyType.SWIFT, count: 5, spawnInterval: 0.9 },
      { type: EnemyType.HEAVY, count: 3, spawnInterval: 1.8 },
    ], reward: 60 },
    // Wave 5: Shielded introduced
    { entries: [
      { type: EnemyType.SHIELDED, count: 3, spawnInterval: 2.2 },
      { type: EnemyType.BASIC,    count: 6, spawnInterval: 1.1 },
    ], reward: 68 },
    { entries: [
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: SPAWN_BOSS },
      { type: EnemyType.HEAVY,    count: 3, spawnInterval: 1.8 },
    ], reward: 78 },
    { entries: [
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: 1.8 },
      { type: EnemyType.FAST,     count: 6, spawnInterval: SPAWN_NORMAL },
    ], reward: 85 },
    { entries: [
      { type: EnemyType.SHIELDED, count: 5, spawnInterval: 1.8 },
      { type: EnemyType.HEAVY,    count: 4, spawnInterval: 1.7 },
      { type: EnemyType.SWIFT,    count: 4, spawnInterval: 0.9 },
    ], reward: 100 },
    // Wave 9: Narrows siege finale
    { entries: [
      { type: EnemyType.HEAVY,    count: 5, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.SHIELDED, count: 5, spawnInterval: 1.6 },
      { type: EnemyType.FAST,     count: 6, spawnInterval: 0.7 },
    ], reward: 130 },
  ],

  // ─── Map 8: Crystal Maze — 10 waves ────────────────────────────────────────
  // Full basic roster. Wave 10: mini-boss (solo Heavy with max leakDamage).
  campaign_08: [
    { entries: [
      { type: EnemyType.BASIC, count: 5, spawnInterval: 1.4 },
      { type: EnemyType.FAST,  count: 3, spawnInterval: SPAWN_MODERATE },
    ], reward: 32 },
    { entries: [
      { type: EnemyType.BASIC, count: 7, spawnInterval: SPAWN_SLOW },
      { type: EnemyType.HEAVY, count: 2, spawnInterval: SPAWN_BOSS },
    ], reward: 40 },
    { entries: [
      { type: EnemyType.FAST,  count: 6, spawnInterval: 0.9 },
      { type: EnemyType.SWIFT, count: 4, spawnInterval: SPAWN_MODERATE },
    ], reward: 48 },
    { entries: [
      { type: EnemyType.SHIELDED, count: 3, spawnInterval: SPAWN_BOSS },
      { type: EnemyType.BASIC,    count: 6, spawnInterval: 1.1 },
    ], reward: 55 },
    { entries: [
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: 1.9 },
      { type: EnemyType.HEAVY,    count: 3, spawnInterval: 1.8 },
    ], reward: 65 },
    { entries: [
      { type: EnemyType.SWIFT,    count: 6, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: 1.8 },
    ], reward: 72 },
    { entries: [
      { type: EnemyType.BASIC, count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.FAST,  count: 5, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.HEAVY, count: 3, spawnInterval: 1.7 },
    ], reward: 82 },
    { entries: [
      { type: EnemyType.SHIELDED, count: 5, spawnInterval: 1.7 },
      { type: EnemyType.SWIFT,    count: 5, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.HEAVY,    count: 3, spawnInterval: 1.7 },
    ], reward: 92 },
    { entries: [
      { type: EnemyType.BASIC,    count: 7, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.FAST,     count: 6, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: 1.7 },
      { type: EnemyType.HEAVY,    count: 3, spawnInterval: 1.6 },
    ], reward: 110 },
    // Wave 10: Mini-boss — one massive Heavy with escort
    { entries: [
      { type: EnemyType.HEAVY,    count: 1, spawnInterval: SOLO_SPAWN_INTERVAL },
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.FAST,     count: 8, spawnInterval: 0.7 },
    ], reward: 160 },
  ],

  // ── MID TIER (Maps 9-12) ───────────────────────────────────────────────────
  // Design: 10 waves, full enemy roster, themed compositions
  // Rewards: 40-120g per wave, total income ~850-1200g (Normal difficulty)

  // ─── Map 9: Crossfire — 10 waves ───────────────────────────────────────────
  // Dual spawner chaos. Introduce Flying wave 5. Waves alternate between spawners.
  campaign_09: [
    { entries: [
      { type: EnemyType.BASIC, count: 6, spawnInterval: 1.3 },
      { type: EnemyType.FAST,  count: 4, spawnInterval: 0.9 },
    ], reward: 40 },
    { entries: [
      { type: EnemyType.BASIC,    count: 5, spawnInterval: SPAWN_SLOW },
      { type: EnemyType.SWIFT,    count: 5, spawnInterval: 0.9 },
      { type: EnemyType.SHIELDED, count: 2, spawnInterval: SPAWN_BOSS },
    ], reward: 50 },
    { entries: [
      { type: EnemyType.FAST,  count: 7, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.HEAVY, count: 3, spawnInterval: 1.8 },
    ], reward: 58 },
    { entries: [
      { type: EnemyType.SHIELDED, count: 5, spawnInterval: 1.8 },
      { type: EnemyType.SWIFT,    count: 5, spawnInterval: SPAWN_NORMAL },
    ], reward: 68 },
    // Wave 5: Flying introduced
    { entries: [
      { type: EnemyType.BASIC,  count: 5, spawnInterval: 1.1 },
      { type: EnemyType.FLYING, count: 4, spawnInterval: 1.3 },
    ], reward: 75 },
    { entries: [
      { type: EnemyType.FLYING,   count: 5, spawnInterval: SPAWN_SLOW },
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: 1.7 },
    ], reward: 85 },
    { entries: [
      { type: EnemyType.FAST,   count: 6, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.FLYING, count: 5, spawnInterval: 1.1 },
      { type: EnemyType.HEAVY,  count: 3, spawnInterval: 1.7 },
    ], reward: 95 },
    { entries: [
      { type: EnemyType.SWIFT,    count: 6, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.FLYING,   count: 5, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: 1.7 },
    ], reward: 108 },
    { entries: [
      { type: EnemyType.HEAVY,    count: 4, spawnInterval: 1.6 },
      { type: EnemyType.FLYING,   count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.FAST,     count: 6, spawnInterval: 0.7 },
      { type: EnemyType.SHIELDED, count: 3, spawnInterval: 1.7 },
    ], reward: 125 },
    // Wave 10: Crossfire finale — everything
    { entries: [
      { type: EnemyType.BOSS,     count: 1, spawnInterval: SOLO_SPAWN_INTERVAL },
      { type: EnemyType.FLYING,   count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.SWIFT,    count: 5, spawnInterval: SPAWN_NORMAL },
    ], reward: 200 },
  ],

  // ─── Map 10: The Spiral — 10 waves ─────────────────────────────────────────
  // Swarm-emphasis. Long spiral path stretches time between spawner and exit.
  campaign_10: [
    { entries: [
      { type: EnemyType.BASIC, count: 6, spawnInterval: 1.3 },
      { type: EnemyType.SWARM, count: 4, spawnInterval: SPAWN_NORMAL },
    ], reward: 40 },
    { entries: [
      { type: EnemyType.FAST,  count: 5, spawnInterval: 0.9 },
      { type: EnemyType.SWARM, count: 5, spawnInterval: 0.7 },
    ], reward: 48 },
    { entries: [
      { type: EnemyType.SWARM, count: 8, spawnInterval: SPAWN_QUICK },
      { type: EnemyType.HEAVY, count: 2, spawnInterval: SPAWN_BOSS },
    ], reward: 55 },
    { entries: [
      { type: EnemyType.SWIFT,    count: 5, spawnInterval: 0.9 },
      { type: EnemyType.SWARM,    count: 6, spawnInterval: SPAWN_QUICK },
      { type: EnemyType.SHIELDED, count: 2, spawnInterval: SPAWN_BOSS },
    ], reward: 65 },
    { entries: [
      { type: EnemyType.SWARM,  count: 8, spawnInterval: SPAWN_QUICK },
      { type: EnemyType.FLYING, count: 3, spawnInterval: SPAWN_SLOW },
    ], reward: 72 },
    { entries: [
      { type: EnemyType.FAST,   count: 6, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.SWARM,  count: 7, spawnInterval: SPAWN_QUICK },
      { type: EnemyType.FLYING, count: 4, spawnInterval: 1.1 },
    ], reward: 82 },
    { entries: [
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: 1.8 },
      { type: EnemyType.SWARM,    count: 8, spawnInterval: SPAWN_QUICK },
      { type: EnemyType.SWIFT,    count: 4, spawnInterval: 0.9 },
    ], reward: 92 },
    { entries: [
      { type: EnemyType.HEAVY,  count: 4, spawnInterval: 1.6 },
      { type: EnemyType.SWARM,  count: 8, spawnInterval: SPAWN_QUICK },
      { type: EnemyType.FLYING, count: 5, spawnInterval: 1.1 },
    ], reward: 105 },
    { entries: [
      { type: EnemyType.SHIELDED, count: 5, spawnInterval: 1.7 },
      { type: EnemyType.SWARM,    count: 9, spawnInterval: 0.5 },
      { type: EnemyType.HEAVY,    count: 3, spawnInterval: 1.7 },
      { type: EnemyType.FLYING,   count: 4, spawnInterval: 1.1 },
    ], reward: 125 },
    // Wave 10: Swarm spiral finale + Boss
    { entries: [
      { type: EnemyType.BOSS,   count: 1,  spawnInterval: SOLO_SPAWN_INTERVAL },
      { type: EnemyType.SWARM,  count: 10, spawnInterval: 0.5 },
      { type: EnemyType.FLYING, count: 5,  spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SWIFT,  count: 5,  spawnInterval: SPAWN_NORMAL },
    ], reward: 210 },
  ],

  // ─── Map 11: Siege — 10 waves ───────────────────────────────────────────────
  // 3 spawners. Heavy siege waves. Shielded vanguards throughout.
  campaign_11: [
    { entries: [
      { type: EnemyType.BASIC,    count: 6, spawnInterval: 1.3 },
      { type: EnemyType.SHIELDED, count: 3, spawnInterval: SPAWN_BOSS },
    ], reward: 42 },
    { entries: [
      { type: EnemyType.HEAVY,    count: 3, spawnInterval: 1.9 },
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: 1.8 },
    ], reward: 55 },
    { entries: [
      { type: EnemyType.HEAVY,    count: 4, spawnInterval: 1.8 },
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: 1.8 },
      { type: EnemyType.FAST,     count: 4, spawnInterval: 0.9 },
    ], reward: 65 },
    { entries: [
      { type: EnemyType.SHIELDED, count: 5, spawnInterval: 1.7 },
      { type: EnemyType.SWIFT,    count: 5, spawnInterval: 0.9 },
      { type: EnemyType.HEAVY,    count: 3, spawnInterval: 1.8 },
    ], reward: 75 },
    { entries: [
      { type: EnemyType.SWARM,    count: 6, spawnInterval: 0.7 },
      { type: EnemyType.SHIELDED, count: 5, spawnInterval: 1.7 },
      { type: EnemyType.HEAVY,    count: 4, spawnInterval: 1.7 },
    ], reward: 85 },
    { entries: [
      { type: EnemyType.FLYING,   count: 5, spawnInterval: 1.1 },
      { type: EnemyType.SHIELDED, count: 5, spawnInterval: 1.6 },
      { type: EnemyType.HEAVY,    count: 4, spawnInterval: 1.7 },
    ], reward: 95 },
    { entries: [
      { type: EnemyType.FAST,     count: 6, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.FLYING,   count: 5, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: 1.6 },
    ], reward: 108 },
    { entries: [
      { type: EnemyType.HEAVY,    count: 5, spawnInterval: 1.6 },
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.SWARM,    count: 7, spawnInterval: SPAWN_QUICK },
    ], reward: 122 },
    { entries: [
      { type: EnemyType.FLYING,   count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.HEAVY,    count: 5, spawnInterval: 1.6 },
      { type: EnemyType.SWIFT,    count: 5, spawnInterval: SPAWN_NORMAL },
    ], reward: 140 },
    // Wave 10: Three-front siege finale
    { entries: [
      { type: EnemyType.BOSS,     count: 1, spawnInterval: SOLO_SPAWN_INTERVAL },
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: 1.4 },
      { type: EnemyType.HEAVY,    count: 5, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.FLYING,   count: 5, spawnInterval: SPAWN_MODERATE },
    ], reward: 225 },
  ],

  // ─── Map 12: Labyrinth — 10 waves ──────────────────────────────────────────
  // Speed-focused. Tests whether maze redirects work. Fast/Swift/Flying emphasis.
  campaign_12: [
    { entries: [
      { type: EnemyType.FAST,  count: 6, spawnInterval: 0.9 },
      { type: EnemyType.SWIFT, count: 4, spawnInterval: SPAWN_MODERATE },
    ], reward: 42 },
    { entries: [
      { type: EnemyType.FAST,   count: 7, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.FLYING, count: 3, spawnInterval: SPAWN_SLOW },
    ], reward: 50 },
    { entries: [
      { type: EnemyType.SWIFT,  count: 6, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.FLYING, count: 4, spawnInterval: 1.1 },
    ], reward: 58 },
    { entries: [
      { type: EnemyType.FAST,   count: 7, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.SWIFT,  count: 5, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.FLYING, count: 4, spawnInterval: 1.1 },
    ], reward: 70 },
    { entries: [
      { type: EnemyType.SWARM,  count: 8, spawnInterval: SPAWN_QUICK },
      { type: EnemyType.SWIFT,  count: 6, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.FLYING, count: 4, spawnInterval: SPAWN_MODERATE },
    ], reward: 80 },
    { entries: [
      { type: EnemyType.FAST,   count: 8, spawnInterval: 0.7 },
      { type: EnemyType.FLYING, count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.HEAVY,  count: 3, spawnInterval: 1.8 },
    ], reward: 90 },
    { entries: [
      { type: EnemyType.SWIFT,    count: 7, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.FLYING,   count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: 1.7 },
    ], reward: 102 },
    { entries: [
      { type: EnemyType.FAST,   count: 8, spawnInterval: 0.7 },
      { type: EnemyType.SWIFT,  count: 7, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.FLYING, count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SWARM,  count: 5, spawnInterval: SPAWN_QUICK },
    ], reward: 118 },
    { entries: [
      { type: EnemyType.FLYING,   count: 8, spawnInterval: 0.9 },
      { type: EnemyType.SWIFT,    count: 7, spawnInterval: 0.7 },
      { type: EnemyType.SHIELDED, count: 5, spawnInterval: 1.6 },
      { type: EnemyType.HEAVY,    count: 4, spawnInterval: 1.7 },
    ], reward: 135 },
    // Wave 10: Speed labyrinth finale
    { entries: [
      { type: EnemyType.BOSS,   count: 1, spawnInterval: SOLO_SPAWN_INTERVAL },
      { type: EnemyType.FLYING, count: 8, spawnInterval: 0.9 },
      { type: EnemyType.SWIFT,  count: 8, spawnInterval: 0.7 },
      { type: EnemyType.FAST,   count: 6, spawnInterval: 0.7 },
    ], reward: 220 },
  ],

  // ── LATE TIER (Maps 13-14) ─────────────────────────────────────────────────
  // Design: 10 waves, brutal compositions, boss finales
  // Rewards: 55-200g per wave, total income ~1100-1600g (Normal difficulty)

  // ─── Map 13: Fortress — 10 waves ───────────────────────────────────────────
  // All enemy types. Wave 10: Boss with full escort. 4 spawners, 1 exit.
  campaign_13: [
    { entries: [
      { type: EnemyType.BASIC,    count: 6, spawnInterval: SPAWN_SLOW },
      { type: EnemyType.SHIELDED, count: 3, spawnInterval: SPAWN_BOSS },
      { type: EnemyType.FAST,     count: 4, spawnInterval: 0.9 },
    ], reward: 55 },
    { entries: [
      { type: EnemyType.HEAVY,    count: 4, spawnInterval: 1.8 },
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: 1.8 },
      { type: EnemyType.SWIFT,    count: 4, spawnInterval: 0.9 },
    ], reward: 68 },
    { entries: [
      { type: EnemyType.SWARM,    count: 8, spawnInterval: SPAWN_QUICK },
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: 1.7 },
      { type: EnemyType.FLYING,   count: 4, spawnInterval: 1.1 },
    ], reward: 80 },
    { entries: [
      { type: EnemyType.HEAVY,    count: 5, spawnInterval: 1.7 },
      { type: EnemyType.FLYING,   count: 5, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SWIFT,    count: 5, spawnInterval: SPAWN_NORMAL },
    ], reward: 92 },
    { entries: [
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: 1.6 },
      { type: EnemyType.SWARM,    count: 7, spawnInterval: SPAWN_QUICK },
      { type: EnemyType.FAST,     count: 6, spawnInterval: SPAWN_NORMAL },
    ], reward: 105 },
    { entries: [
      { type: EnemyType.HEAVY,    count: 5, spawnInterval: 1.6 },
      { type: EnemyType.FLYING,   count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SHIELDED, count: 5, spawnInterval: 1.6 },
      { type: EnemyType.SWIFT,    count: 5, spawnInterval: SPAWN_NORMAL },
    ], reward: 120 },
    { entries: [
      { type: EnemyType.SWARM,    count: 9, spawnInterval: 0.5 },
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.HEAVY,    count: 5, spawnInterval: 1.6 },
      { type: EnemyType.FLYING,   count: 5, spawnInterval: SPAWN_MODERATE },
    ], reward: 138 },
    { entries: [
      { type: EnemyType.FAST,     count: 8, spawnInterval: 0.7 },
      { type: EnemyType.SWIFT,    count: 7, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.FLYING,   count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: SPAWN_HEAVY },
    ], reward: 155 },
    { entries: [
      { type: EnemyType.HEAVY,    count: 6, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.SWARM,    count: 8, spawnInterval: 0.5 },
      { type: EnemyType.FLYING,   count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SWIFT,    count: 5, spawnInterval: SPAWN_NORMAL },
    ], reward: 178 },
    // Wave 10: Boss with full escort
    { entries: [
      { type: EnemyType.BOSS,     count: 1, spawnInterval: SOLO_SPAWN_INTERVAL },
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: 1.4 },
      { type: EnemyType.HEAVY,    count: 4, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.SWARM,    count: 8, spawnInterval: 0.5 },
      { type: EnemyType.FLYING,   count: 5, spawnInterval: SPAWN_MODERATE },
    ], reward: 260 },
  ],

  // ─── Map 14: The Gauntlet — 10 waves ───────────────────────────────────────
  // Long path, mostly speed enemies. Wave 10: Boss. Limited build spots.
  campaign_14: [
    { entries: [
      { type: EnemyType.FAST,  count: 6, spawnInterval: 0.9 },
      { type: EnemyType.SWIFT, count: 5, spawnInterval: 0.9 },
    ], reward: 52 },
    { entries: [
      { type: EnemyType.SWIFT,  count: 7, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.FLYING, count: 4, spawnInterval: 1.1 },
    ], reward: 62 },
    { entries: [
      { type: EnemyType.FAST,   count: 8, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.FLYING, count: 5, spawnInterval: SPAWN_MODERATE },
    ], reward: 72 },
    { entries: [
      { type: EnemyType.SWIFT,    count: 7, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.SHIELDED, count: 4, spawnInterval: 1.7 },
      { type: EnemyType.FLYING,   count: 4, spawnInterval: SPAWN_MODERATE },
    ], reward: 85 },
    { entries: [
      { type: EnemyType.SWARM,  count: 9, spawnInterval: SPAWN_QUICK },
      { type: EnemyType.FAST,   count: 7, spawnInterval: 0.7 },
      { type: EnemyType.FLYING, count: 5, spawnInterval: SPAWN_MODERATE },
    ], reward: 98 },
    { entries: [
      { type: EnemyType.SWIFT,    count: 8, spawnInterval: 0.7 },
      { type: EnemyType.FLYING,   count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SHIELDED, count: 5, spawnInterval: 1.6 },
    ], reward: 112 },
    { entries: [
      { type: EnemyType.FAST,   count: 9, spawnInterval: 0.7 },
      { type: EnemyType.SWIFT,  count: 8, spawnInterval: 0.7 },
      { type: EnemyType.FLYING, count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SWARM,  count: 6, spawnInterval: 0.5 },
    ], reward: 128 },
    { entries: [
      { type: EnemyType.FLYING,   count: 8, spawnInterval: 0.9 },
      { type: EnemyType.SWIFT,    count: 8, spawnInterval: 0.7 },
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.HEAVY,    count: 4, spawnInterval: 1.6 },
    ], reward: 148 },
    { entries: [
      { type: EnemyType.FAST,     count: 9, spawnInterval: 0.7 },
      { type: EnemyType.SWIFT,    count: 9, spawnInterval: 0.7 },
      { type: EnemyType.FLYING,   count: 7, spawnInterval: 0.9 },
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: 1.4 },
      { type: EnemyType.SWARM,    count: 7, spawnInterval: 0.5 },
    ], reward: 172 },
    // Wave 10: Gauntlet finale — Boss with speed escort
    { entries: [
      { type: EnemyType.BOSS,   count: 1, spawnInterval: SOLO_SPAWN_INTERVAL },
      { type: EnemyType.FLYING, count: 8, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.SWIFT,  count: 8, spawnInterval: 0.7 },
      { type: EnemyType.FAST,   count: 8, spawnInterval: 0.7 },
      { type: EnemyType.SWARM,  count: 6, spawnInterval: 0.5 },
    ], reward: 270 },
  ],

  // ── ENDGAME TIER (Maps 15-16) ──────────────────────────────────────────────
  // Design: 12 waves, everything at once, multiple bosses
  // Rewards: 60-320g per wave, total income ~2000-2800g (Normal difficulty)

  // ─── Map 15: Storm — 12 waves ──────────────────────────────────────────────
  // Escalating chaos. Multi-type from wave 1. Boss waves at 8 and 12.
  campaign_15: [
    { entries: [
      { type: EnemyType.BASIC,    count: 6, spawnInterval: SPAWN_SLOW },
      { type: EnemyType.FAST,     count: 5, spawnInterval: 0.9 },
      { type: EnemyType.SHIELDED, count: 3, spawnInterval: 1.9 },
    ], reward: 60 },
    { entries: [
      { type: EnemyType.SWIFT,    count: 6, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.HEAVY,    count: 4, spawnInterval: 1.7 },
      { type: EnemyType.FLYING,   count: 4, spawnInterval: 1.1 },
    ], reward: 72 },
    { entries: [
      { type: EnemyType.SWARM,    count: 8, spawnInterval: SPAWN_QUICK },
      { type: EnemyType.SHIELDED, count: 5, spawnInterval: 1.7 },
      { type: EnemyType.FLYING,   count: 5, spawnInterval: SPAWN_MODERATE },
    ], reward: 84 },
    { entries: [
      { type: EnemyType.FAST,     count: 8, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.SWIFT,    count: 6, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.HEAVY,    count: 4, spawnInterval: 1.7 },
      { type: EnemyType.FLYING,   count: 4, spawnInterval: SPAWN_MODERATE },
    ], reward: 98 },
    { entries: [
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: 1.6 },
      { type: EnemyType.SWARM,    count: 9, spawnInterval: 0.5 },
      { type: EnemyType.SWIFT,    count: 6, spawnInterval: SPAWN_NORMAL },
    ], reward: 112 },
    { entries: [
      { type: EnemyType.HEAVY,    count: 6, spawnInterval: 1.6 },
      { type: EnemyType.FLYING,   count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: SPAWN_HEAVY },
    ], reward: 128 },
    { entries: [
      { type: EnemyType.FAST,     count: 9, spawnInterval: 0.7 },
      { type: EnemyType.SWIFT,    count: 8, spawnInterval: 0.7 },
      { type: EnemyType.SWARM,    count: 9, spawnInterval: 0.5 },
      { type: EnemyType.FLYING,   count: 6, spawnInterval: SPAWN_MODERATE },
    ], reward: 145 },
    // Wave 8: First Boss wave
    { entries: [
      { type: EnemyType.BOSS,     count: 1, spawnInterval: SOLO_SPAWN_INTERVAL },
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: 1.4 },
      { type: EnemyType.HEAVY,    count: 5, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.FLYING,   count: 6, spawnInterval: SPAWN_MODERATE },
    ], reward: 220 },
    { entries: [
      { type: EnemyType.SWIFT,    count: 9, spawnInterval: 0.7 },
      { type: EnemyType.FLYING,   count: 7, spawnInterval: 0.9 },
      { type: EnemyType.SWARM,    count: 10, spawnInterval: 0.5 },
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: 1.4 },
    ], reward: 165 },
    { entries: [
      { type: EnemyType.HEAVY,    count: 7, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.SHIELDED, count: 7, spawnInterval: 1.4 },
      { type: EnemyType.FLYING,   count: 7, spawnInterval: 0.9 },
      { type: EnemyType.FAST,     count: 8, spawnInterval: 0.7 },
    ], reward: 182 },
    { entries: [
      { type: EnemyType.SWARM,    count: 10, spawnInterval: 0.5 },
      { type: EnemyType.SWIFT,    count: 9,  spawnInterval: 0.7 },
      { type: EnemyType.SHIELDED, count: 7,  spawnInterval: 1.4 },
      { type: EnemyType.HEAVY,    count: 6,  spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.FLYING,   count: 7,  spawnInterval: 0.9 },
    ], reward: 205 },
    // Wave 12: Storm finale — second Boss
    { entries: [
      { type: EnemyType.BOSS,     count: 2,  spawnInterval: 3.0 }, // two Bosses, deliberate gap
      { type: EnemyType.SHIELDED, count: 8,  spawnInterval: 1.3 },
      { type: EnemyType.HEAVY,    count: 6,  spawnInterval: 1.4 },
      { type: EnemyType.FLYING,   count: 8,  spawnInterval: 0.9 },
      { type: EnemyType.SWARM,    count: 10, spawnInterval: 0.5 },
    ], reward: 320 },
  ],

  // ─── Map 16: Novarise — 12 waves ───────────────────────────────────────────
  // Ultimate challenge. Every enemy type from wave 1. Boss at wave 6 and wave 12.
  campaign_16: [
    // Wave 1: All types from the start (reduced counts)
    { entries: [
      { type: EnemyType.BASIC,    count: 5, spawnInterval: SPAWN_SLOW },
      { type: EnemyType.FAST,     count: 4, spawnInterval: 0.9 },
      { type: EnemyType.HEAVY,    count: 2, spawnInterval: 1.9 },
      { type: EnemyType.SWIFT,    count: 3, spawnInterval: 0.9 },
      { type: EnemyType.SHIELDED, count: 2, spawnInterval: 1.9 },
      { type: EnemyType.FLYING,   count: 3, spawnInterval: 1.1 },
    ], reward: 75 },
    { entries: [
      { type: EnemyType.HEAVY,    count: 4, spawnInterval: 1.7 },
      { type: EnemyType.SHIELDED, count: 5, spawnInterval: 1.7 },
      { type: EnemyType.SWARM,    count: 6, spawnInterval: SPAWN_QUICK },
      { type: EnemyType.FLYING,   count: 4, spawnInterval: SPAWN_MODERATE },
    ], reward: 90 },
    { entries: [
      { type: EnemyType.SWIFT,    count: 7, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.FLYING,   count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SHIELDED, count: 5, spawnInterval: 1.6 },
      { type: EnemyType.SWARM,    count: 8, spawnInterval: SPAWN_QUICK },
    ], reward: 108 },
    { entries: [
      { type: EnemyType.HEAVY,    count: 5, spawnInterval: 1.6 },
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.FAST,     count: 8, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.FLYING,   count: 6, spawnInterval: SPAWN_MODERATE },
    ], reward: 125 },
    { entries: [
      { type: EnemyType.SWARM,    count: 10, spawnInterval: 0.5 },
      { type: EnemyType.SWIFT,    count: 8,  spawnInterval: 0.7 },
      { type: EnemyType.FLYING,   count: 7,  spawnInterval: 0.9 },
      { type: EnemyType.SHIELDED, count: 6,  spawnInterval: SPAWN_HEAVY },
    ], reward: 145 },
    // Wave 6: First Boss
    { entries: [
      { type: EnemyType.BOSS,     count: 1, spawnInterval: SOLO_SPAWN_INTERVAL },
      { type: EnemyType.SHIELDED, count: 6, spawnInterval: 1.4 },
      { type: EnemyType.HEAVY,    count: 5, spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.FLYING,   count: 6, spawnInterval: SPAWN_MODERATE },
      { type: EnemyType.SWARM,    count: 8, spawnInterval: 0.5 },
    ], reward: 240 },
    { entries: [
      { type: EnemyType.HEAVY,    count: 7,  spawnInterval: SPAWN_HEAVY },
      { type: EnemyType.SHIELDED, count: 7,  spawnInterval: 1.4 },
      { type: EnemyType.SWARM,    count: 10, spawnInterval: 0.5 },
      { type: EnemyType.FLYING,   count: 7,  spawnInterval: 0.9 },
      { type: EnemyType.SWIFT,    count: 7,  spawnInterval: 0.7 },
    ], reward: 165 },
    { entries: [
      { type: EnemyType.FAST,     count: 10, spawnInterval: 0.7 },
      { type: EnemyType.SWIFT,    count: 9,  spawnInterval: 0.7 },
      { type: EnemyType.FLYING,   count: 8,  spawnInterval: 0.9 },
      { type: EnemyType.SHIELDED, count: 7,  spawnInterval: 1.4 },
    ], reward: 185 },
    { entries: [
      { type: EnemyType.SWARM,    count: 12, spawnInterval: SPAWN_FAST },
      { type: EnemyType.FLYING,   count: 8,  spawnInterval: 0.9 },
      { type: EnemyType.HEAVY,    count: 7,  spawnInterval: 1.4 },
      { type: EnemyType.SHIELDED, count: 7,  spawnInterval: 1.3 },
    ], reward: 205 },
    { entries: [
      { type: EnemyType.SWIFT,    count: 10, spawnInterval: SPAWN_QUICK },
      { type: EnemyType.FLYING,   count: 9,  spawnInterval: 0.9 },
      { type: EnemyType.FAST,     count: 10, spawnInterval: 0.7 },
      { type: EnemyType.SHIELDED, count: 8,  spawnInterval: 1.3 },
      { type: EnemyType.SWARM,    count: 10, spawnInterval: SPAWN_FAST },
    ], reward: 228 },
    { entries: [
      { type: EnemyType.HEAVY,    count: 8,  spawnInterval: 1.4 },
      { type: EnemyType.SHIELDED, count: 8,  spawnInterval: 1.3 },
      { type: EnemyType.FLYING,   count: 9,  spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.SWARM,    count: 12, spawnInterval: SPAWN_FAST },
      { type: EnemyType.SWIFT,    count: 9,  spawnInterval: SPAWN_QUICK },
    ], reward: 255 },
    // Wave 12: Novarise finale — twin Bosses, everything unleashed
    { entries: [
      { type: EnemyType.BOSS,     count: 2,  spawnInterval: 4.0 }, // two Bosses, deliberate gap
      { type: EnemyType.SHIELDED, count: 10, spawnInterval: SPAWN_SLOW },
      { type: EnemyType.HEAVY,    count: 8,  spawnInterval: 1.3 },
      { type: EnemyType.FLYING,   count: 10, spawnInterval: SPAWN_NORMAL },
      { type: EnemyType.SWARM,    count: 12, spawnInterval: SPAWN_FAST },
      { type: EnemyType.SWIFT,    count: 8,  spawnInterval: SPAWN_QUICK },
    ], reward: 400 },
  ],

};
