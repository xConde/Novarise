export enum EnemyType {
  BASIC = 'BASIC',
  FAST = 'FAST',
  HEAVY = 'HEAVY',
  SWIFT = 'SWIFT',
  BOSS = 'BOSS',
  SHIELDED = 'SHIELDED',
  SWARM = 'SWARM',
  FLYING = 'FLYING',
  MINER = 'MINER',
  UNSHAKEABLE = 'UNSHAKEABLE',
  VEINSEEKER = 'VEINSEEKER',
  // Sprint 37 — Highground archetype: ground enemy that ignores elevation penalties
  GLIDER = 'GLIDER',
  // Sprint 38 — Highground archetype: elite that halves elevation damage bonuses against it
  TITAN = 'TITAN',
  // Sprint 39 — Highground archetype: boss counter that is fully immune to elevation damage bonuses
  WYRM_ASCENDANT = 'WYRM_ASCENDANT',
}
