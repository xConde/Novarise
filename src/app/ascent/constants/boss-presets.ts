/**
 * Boss encounter wave presets for Ascent Mode.
 *
 * Each act has 3 themed boss variants chosen deterministically by seed.
 * Act 1 bosses: 6 waves. Act 2 bosses: 7 waves (harder, larger rosters).
 * Every preset's final wave is a solo BOSS entry with spawnInterval 0.
 */

import { WaveDefinition } from '../../game/game-board/models/wave.model';
import { EnemyType } from '../../game/game-board/models/enemy.model';

export interface BossPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly waves: WaveDefinition[];
}

// ── Act 1 Boss Presets (6 waves each) ────────────────────────────

export const ACT1_BOSS_PRESETS: BossPreset[] = [
  {
    id: 'siege_commander',
    name: 'Siege Commander',
    description: 'A relentless assault of heavy and shielded units.',
    waves: [
      // Wave 1: Armored vanguard opens the march
      {
        entries: [{ type: EnemyType.HEAVY, count: 6, spawnInterval: 0.8 }],
        reward: 30,
      },
      // Wave 2: Shielded wall with basic screen
      {
        entries: [
          { type: EnemyType.SHIELDED, count: 4, spawnInterval: 0.9 },
          { type: EnemyType.BASIC, count: 8, spawnInterval: 0.7 },
        ],
        reward: 35,
      },
      // Wave 3: Double-heavy press
      {
        entries: [
          { type: EnemyType.HEAVY, count: 8, spawnInterval: 0.7 },
          { type: EnemyType.SHIELDED, count: 5, spawnInterval: 0.8 },
        ],
        reward: 40,
      },
      // Wave 4: Shield wall collapses — fast flankers pour through
      {
        entries: [
          { type: EnemyType.SHIELDED, count: 8, spawnInterval: 0.6 },
          { type: EnemyType.FAST, count: 10, spawnInterval: 0.5 },
        ],
        reward: 45,
      },
      // Wave 5: Maximum siege pressure
      {
        entries: [
          { type: EnemyType.HEAVY, count: 10, spawnInterval: 0.5 },
          { type: EnemyType.SHIELDED, count: 8, spawnInterval: 0.6 },
        ],
        reward: 50,
      },
      // Wave 6: The Commander arrives
      {
        entries: [{ type: EnemyType.BOSS, count: 1, spawnInterval: 0 }],
        reward: 100,
      },
    ],
  },

  {
    id: 'swarm_queen',
    name: 'Swarm Queen',
    description: 'Endless waves of fast, splitting enemies.',
    waves: [
      // Wave 1: Swift scouts test your defenses
      {
        entries: [
          { type: EnemyType.SWIFT, count: 6, spawnInterval: 0.7 },
          { type: EnemyType.FAST, count: 5, spawnInterval: 0.6 },
        ],
        reward: 30,
      },
      // Wave 2: Swarm eggs burst open
      {
        entries: [
          { type: EnemyType.SWARM, count: 8, spawnInterval: 0.5 },
          { type: EnemyType.FAST, count: 6, spawnInterval: 0.6 },
        ],
        reward: 35,
      },
      // Wave 3: Double swarm tide
      {
        entries: [
          { type: EnemyType.SWARM, count: 12, spawnInterval: 0.4 },
          { type: EnemyType.SWIFT, count: 5, spawnInterval: 0.6 },
        ],
        reward: 40,
      },
      // Wave 4: Speed surge — fast and swift flood the lanes
      {
        entries: [
          { type: EnemyType.FAST, count: 14, spawnInterval: 0.4 },
          { type: EnemyType.SWIFT, count: 8, spawnInterval: 0.5 },
        ],
        reward: 45,
      },
      // Wave 5: The hive erupts — massive swarm with swift escorts
      {
        entries: [
          { type: EnemyType.SWARM, count: 16, spawnInterval: 0.4 },
          { type: EnemyType.FAST, count: 10, spawnInterval: 0.4 },
          { type: EnemyType.SWIFT, count: 6, spawnInterval: 0.5 },
        ],
        reward: 50,
      },
      // Wave 6: The Queen emerges
      {
        entries: [{ type: EnemyType.BOSS, count: 1, spawnInterval: 0 }],
        reward: 100,
      },
    ],
  },

  {
    id: 'sky_marshal',
    name: 'Sky Marshal',
    description: 'Air superiority — flying units immune to ground slow.',
    waves: [
      // Wave 1: Aerial scouts supported by ground infantry
      {
        entries: [
          { type: EnemyType.FLYING, count: 5, spawnInterval: 0.9 },
          { type: EnemyType.BASIC, count: 6, spawnInterval: 0.8 },
        ],
        reward: 30,
      },
      // Wave 2: Fast ground units flank while flyers pin defenses
      {
        entries: [
          { type: EnemyType.FLYING, count: 7, spawnInterval: 0.7 },
          { type: EnemyType.FAST, count: 8, spawnInterval: 0.6 },
        ],
        reward: 35,
      },
      // Wave 3: Air superiority — pure flying strike
      {
        entries: [{ type: EnemyType.FLYING, count: 12, spawnInterval: 0.5 }],
        reward: 38,
      },
      // Wave 4: Combined arms — swift ground + heavy air
      {
        entries: [
          { type: EnemyType.FLYING, count: 8, spawnInterval: 0.5 },
          { type: EnemyType.SWIFT, count: 6, spawnInterval: 0.6 },
          { type: EnemyType.HEAVY, count: 4, spawnInterval: 0.9 },
        ],
        reward: 45,
      },
      // Wave 5: Maximum air pressure with ground distraction
      {
        entries: [
          { type: EnemyType.FLYING, count: 14, spawnInterval: 0.4 },
          { type: EnemyType.FAST, count: 10, spawnInterval: 0.5 },
        ],
        reward: 50,
      },
      // Wave 6: The Marshal takes the field
      {
        entries: [{ type: EnemyType.BOSS, count: 1, spawnInterval: 0 }],
        reward: 100,
      },
    ],
  },
];

// ── Act 2 Boss Presets (7 waves each) ────────────────────────────

export const ACT2_BOSS_PRESETS: BossPreset[] = [
  {
    id: 'dark_nexus',
    name: 'Dark Nexus',
    description: 'All enemy types converge in maximum force.',
    waves: [
      // Wave 1: Reconnaissance — one of every type
      {
        entries: [
          { type: EnemyType.BASIC, count: 6, spawnInterval: 0.8 },
          { type: EnemyType.FAST, count: 5, spawnInterval: 0.7 },
          { type: EnemyType.HEAVY, count: 3, spawnInterval: 1.0 },
        ],
        reward: 40,
      },
      // Wave 2: Armored advance with aerial scouts
      {
        entries: [
          { type: EnemyType.SHIELDED, count: 6, spawnInterval: 0.8 },
          { type: EnemyType.FLYING, count: 5, spawnInterval: 0.7 },
          { type: EnemyType.SWIFT, count: 4, spawnInterval: 0.6 },
        ],
        reward: 50,
      },
      // Wave 3: Swarm surge with heavy anchor
      {
        entries: [
          { type: EnemyType.SWARM, count: 12, spawnInterval: 0.4 },
          { type: EnemyType.HEAVY, count: 6, spawnInterval: 0.8 },
          { type: EnemyType.FAST, count: 8, spawnInterval: 0.5 },
        ],
        reward: 55,
      },
      // Wave 4: Full spectrum assault — every type
      {
        entries: [
          { type: EnemyType.BASIC, count: 8, spawnInterval: 0.7 },
          { type: EnemyType.FAST, count: 7, spawnInterval: 0.5 },
          { type: EnemyType.SHIELDED, count: 5, spawnInterval: 0.7 },
          { type: EnemyType.FLYING, count: 6, spawnInterval: 0.6 },
          { type: EnemyType.SWARM, count: 8, spawnInterval: 0.5 },
        ],
        reward: 65,
      },
      // Wave 5: Heavy armored tide with swarm support
      {
        entries: [
          { type: EnemyType.HEAVY, count: 10, spawnInterval: 0.5 },
          { type: EnemyType.SHIELDED, count: 8, spawnInterval: 0.6 },
          { type: EnemyType.SWIFT, count: 8, spawnInterval: 0.5 },
        ],
        reward: 70,
      },
      // Wave 6: The Nexus opens — all types maximum force
      {
        entries: [
          { type: EnemyType.FLYING, count: 10, spawnInterval: 0.4 },
          { type: EnemyType.SWARM, count: 14, spawnInterval: 0.4 },
          { type: EnemyType.SHIELDED, count: 8, spawnInterval: 0.5 },
          { type: EnemyType.HEAVY, count: 8, spawnInterval: 0.6 },
        ],
        reward: 80,
      },
      // Wave 7: Twin Bosses — the Nexus manifests
      {
        entries: [
          { type: EnemyType.BOSS, count: 2, spawnInterval: 3.0 },
        ],
        reward: 180,
      },
    ],
  },

  {
    id: 'iron_tide',
    name: 'Iron Tide',
    description: 'Armored columns that refuse to break.',
    waves: [
      // Wave 1: Heavy vanguard, relentless pace
      {
        entries: [
          { type: EnemyType.HEAVY, count: 8, spawnInterval: 0.8 },
          { type: EnemyType.BASIC, count: 10, spawnInterval: 0.7 },
        ],
        reward: 40,
      },
      // Wave 2: Shielded wall advances
      {
        entries: [
          { type: EnemyType.SHIELDED, count: 8, spawnInterval: 0.7 },
          { type: EnemyType.HEAVY, count: 6, spawnInterval: 0.8 },
        ],
        reward: 48,
      },
      // Wave 3: Swarm of armored bodies
      {
        entries: [
          { type: EnemyType.HEAVY, count: 12, spawnInterval: 0.5 },
          { type: EnemyType.SHIELDED, count: 8, spawnInterval: 0.6 },
        ],
        reward: 55,
      },
      // Wave 4: Flanking fast units exploit gaps
      {
        entries: [
          { type: EnemyType.FAST, count: 14, spawnInterval: 0.4 },
          { type: EnemyType.SWIFT, count: 8, spawnInterval: 0.5 },
          { type: EnemyType.HEAVY, count: 6, spawnInterval: 0.7 },
        ],
        reward: 60,
      },
      // Wave 5: Iron column pushes through
      {
        entries: [
          { type: EnemyType.SHIELDED, count: 14, spawnInterval: 0.5 },
          { type: EnemyType.HEAVY, count: 12, spawnInterval: 0.5 },
        ],
        reward: 70,
      },
      // Wave 6: Everything that remains is thrown at your gates
      {
        entries: [
          { type: EnemyType.HEAVY, count: 15, spawnInterval: 0.4 },
          { type: EnemyType.SHIELDED, count: 12, spawnInterval: 0.5 },
          { type: EnemyType.FAST, count: 10, spawnInterval: 0.4 },
        ],
        reward: 80,
      },
      // Wave 7: The Tide's apex arrives
      {
        entries: [{ type: EnemyType.BOSS, count: 1, spawnInterval: 0 }],
        reward: 160,
      },
    ],
  },

  {
    id: 'phantom_legion',
    name: 'Phantom Legion',
    description: 'Speed and evasion — a blitz of flying and swift enemies.',
    waves: [
      // Wave 1: Swift reconnaissance
      {
        entries: [
          { type: EnemyType.SWIFT, count: 8, spawnInterval: 0.6 },
          { type: EnemyType.FAST, count: 8, spawnInterval: 0.5 },
        ],
        reward: 40,
      },
      // Wave 2: Phantom wings descend
      {
        entries: [
          { type: EnemyType.FLYING, count: 10, spawnInterval: 0.5 },
          { type: EnemyType.SWIFT, count: 6, spawnInterval: 0.5 },
        ],
        reward: 48,
      },
      // Wave 3: Pure speed blitz — no way to slow them all
      {
        entries: [
          { type: EnemyType.FAST, count: 18, spawnInterval: 0.4 },
          { type: EnemyType.SWIFT, count: 10, spawnInterval: 0.4 },
        ],
        reward: 55,
      },
      // Wave 4: Air and ground simultaneous strike
      {
        entries: [
          { type: EnemyType.FLYING, count: 12, spawnInterval: 0.4 },
          { type: EnemyType.FAST, count: 12, spawnInterval: 0.4 },
          { type: EnemyType.SWARM, count: 8, spawnInterval: 0.5 },
        ],
        reward: 62,
      },
      // Wave 5: Ghost cavalry — the swiftest enemies ever seen
      {
        entries: [
          { type: EnemyType.SWIFT, count: 14, spawnInterval: 0.4 },
          { type: EnemyType.FLYING, count: 12, spawnInterval: 0.4 },
          { type: EnemyType.FAST, count: 10, spawnInterval: 0.4 },
        ],
        reward: 70,
      },
      // Wave 6: Full phantom assault — maximum speed, everywhere
      {
        entries: [
          { type: EnemyType.FLYING, count: 16, spawnInterval: 0.4 },
          { type: EnemyType.SWIFT, count: 12, spawnInterval: 0.4 },
          { type: EnemyType.SWARM, count: 12, spawnInterval: 0.4 },
          { type: EnemyType.FAST, count: 10, spawnInterval: 0.4 },
        ],
        reward: 80,
      },
      // Wave 7: The Phantom General materializes
      {
        entries: [{ type: EnemyType.BOSS, count: 1, spawnInterval: 0 }],
        reward: 160,
      },
    ],
  },
];
