/**
 * Animation constants for the BASIC tower idle and firing animations.
 * Consumed by TowerMeshFactoryService when building the BASIC mesh group.
 */

export const BASIC_IDLE_CONFIG = {
  /** Peak amplitude of the turret swivel in radians (±5 degrees). */
  swivelAmplitudeRad: 5 * (Math.PI / 180),
  /** Speed of the sine wave driving the swivel (cycles per second). */
  swivelSpeed: 0.6,
} as const;

export const BASIC_RECOIL_CONFIG = {
  /** How far (in local units) the barrel slides back on fire. */
  distance: 0.05,
  /** Easing profile identifier — "easeOutCubic" for natural deceleration. */
  easing: 'easeOutCubic' as const,
} as const;

// ── BASIC geometry dimensions ─────────────────────────────────────────────────

export const BASIC_GEOM = {
  // Hex pad base
  baseRadiusTop:    0.42,
  baseRadiusBottom: 0.5,
  baseHeight:       0.18,
  baseSegments:     6,

  // Bolt-head cylinders on top of the pad (×4 at cardinal offsets)
  boltRadius:    0.04,
  boltHeight:    0.06,
  boltSegments:  6,
  boltInset:     0.3,    // radial distance from centre to bolt
  boltSinkDepth: 0.01,   // how far the bolt head sinks below pad top

  // Turret housing
  turretRadius:   0.32,
  turretHeight:   0.22,
  turretSegments: 8,

  // Turret side vents (×4 boxes, radially placed)
  ventW: 0.06,
  ventH: 0.08,
  ventD: 0.04,
  ventRadial: 0.29,  // radial offset from turret axis

  // Barrel segment 1 (widest, closest to turret)
  barrel1Radius: 0.1,
  barrel1Length: 0.35,

  // Barrel segment 2
  barrel2Radius: 0.085,
  barrel2Length: 0.3,

  // Barrel segment 3 (narrowest, muzzle end)
  barrel3Radius: 0.07,
  barrel3Length: 0.22,

  // Cooling-fin disk (between segments 2 and 3)
  finRadiusInner: 0.08,
  finRadiusOuter: 0.15,
  finHeight:      0.04,
  finSegments:    12,

  // Accent indicator sphere (rear of turret)
  accentRadius:   0.04,
  accentSegments: 8,
  accentZOffset: -0.2,   // behind the turret centre along its local Z

  // T2 barrel cap (disc at muzzle tip)
  capRadius:   0.08,
  capHeight:   0.04,
  capSegments: 8,

  // T3 shoulder pauldrons (×2 box-geometries flanking turret)
  pauldronW: 0.12,
  pauldronH: 0.1,
  pauldronD: 0.16,
  pauldronX: 0.36,     // ±X offset from turret centre
} as const;

// Y positions of each barrel segment centre relative to the barrel sub-group
// origin, which is placed at the front face of the turret.  The sub-group
// is rotated 90° so +Y in the sub-group == +Z in turret space (forward).
export const BASIC_BARREL_Y = {
  seg1:  BASIC_GEOM.barrel1Length / 2,
  seg2:  BASIC_GEOM.barrel1Length + BASIC_GEOM.barrel2Length / 2,
  seg3:  BASIC_GEOM.barrel1Length + BASIC_GEOM.barrel2Length + BASIC_GEOM.barrel3Length / 2,
  fin:   BASIC_GEOM.barrel1Length + BASIC_GEOM.barrel2Length,
  cap:   BASIC_GEOM.barrel1Length + BASIC_GEOM.barrel2Length + BASIC_GEOM.barrel3Length,
} as const;

// Y world-position of the turret centre above the group origin
export const BASIC_TURRET_Y =
  BASIC_GEOM.baseHeight + BASIC_GEOM.turretHeight / 2;

// Y world-position of the accent sphere (rear of turret, same height as turret centre)
export const BASIC_ACCENT_Y = BASIC_TURRET_Y;

// Total barrel length used for accent light positioning
export const BASIC_BARREL_TOTAL_LENGTH =
  BASIC_GEOM.barrel1Length + BASIC_GEOM.barrel2Length + BASIC_GEOM.barrel3Length;
