/**
 * Animation and geometry constants for tower mesh construction and animation.
 * Consumed by TowerMeshFactoryService and TowerAnimationService.
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

// ─── SNIPER tower constants ────────────────────────────────────────────────────

export const SNIPER_GEOM = {
  // Central post cylinder (where tripod legs meet)
  postRadiusTop:    0.18,
  postRadiusBottom: 0.22,
  postHeight:       0.18,
  postSegments:     8,

  // Tripod strut cylinders (×3, evenly distributed at 120°)
  strutRadiusTop:    0.06,
  strutRadiusBottom: 0.08,
  strutHeight:       0.5,
  strutSegments:     6,
  /** Outward tilt of each tripod strut in degrees. */
  strutTiltDeg:      25,

  // Horizontal scope housing cylinder (lies on its side along +Z)
  scopeRadiusTop:    0.14,
  scopeRadiusBottom: 0.14,
  scopeLength:       0.4,
  scopeSegments:     8,

  // T2 longer scope (built at creation, hidden until T2)
  scopeLongLength:   0.56,

  // Scope lens disk (front face of scope)
  lensRadius:        0.12,
  lensDepth:         0.02,
  lensSegments:      12,

  // Long barrel cylinder (named 'barrel')
  barrelRadius:      0.06,
  barrelLength:      0.7,
  barrelSegments:    8,

  // Bipod struts (×2 flanking mid-barrel, splayed forward)
  bipodRadius:       0.04,
  bipodLength:       0.18,
  bipodSegments:     6,
  /** Forward splay angle of each bipod strut in degrees. */
  bipodTiltDeg:      20,
  /** Lateral offset (±X) of each bipod strut. */
  bipodXOffset:      0.07,

  // Muzzle brake (slightly wider cap at barrel end)
  muzzleRadius:      0.08,
  muzzleLength:      0.12,
  muzzleSegments:    8,

  // Muzzle vent slits (×2 radial box geometries on the brake)
  muzzleVentW:       0.02,
  muzzleVentH:       0.08,
  muzzleVentD:       0.09,
  muzzleVentOffset:  0.06,

  // T3 hover stabilizer disk (replaces bipod at T3)
  stabilizerRadius:  0.16,
  stabilizerHeight:  0.03,
  stabilizerSegments: 16,
  stabilizerYOffset: -0.05,
} as const;

// Y positions relative to the SNIPER group origin

/** Top of the central post (where scope + barrel attach). */
export const SNIPER_POST_TOP_Y = SNIPER_GEOM.postHeight;

/** Y centre of the scope housing (sits immediately above the post). */
export const SNIPER_SCOPE_Y = SNIPER_POST_TOP_Y + SNIPER_GEOM.scopeRadiusTop;

/** Z offset of the lens disk from the scope centre (front face). */
export const SNIPER_LENS_Z = SNIPER_GEOM.scopeLength / 2 + SNIPER_GEOM.lensDepth / 2;

/** Y position of the barrel (same height as scope centre so it extends from beneath). */
export const SNIPER_BARREL_Y = SNIPER_SCOPE_Y;

/** Approximate Y of the barrel mid-point (used for bipod attachment). */
export const SNIPER_BARREL_MID_Y = SNIPER_BARREL_Y;

/** Z at the muzzle tip (barrel extends forward along +Z). */
export const SNIPER_MUZZLE_Z = SNIPER_GEOM.barrelLength / 2 + SNIPER_GEOM.muzzleLength / 2;

/** Y of the accent light (scope height). */
export const SNIPER_ACCENT_Y = SNIPER_SCOPE_Y;

// ─── SNIPER idle (scope lens pulse) ───────────────────────────────────────────

export const SNIPER_SCOPE_GLOW_CONFIG = {
  /** Minimum emissive intensity for the scope lens pulse. */
  min:   0.45,
  /** Maximum emissive intensity for the scope lens pulse. */
  max:   0.95,
  /** Speed of the sine wave driving the pulse (cycles per second). */
  speed: 1.4,
} as const;

// ─── SNIPER firing animation ───────────────────────────────────────────────────

export const SNIPER_RECOIL_CONFIG = {
  /** Barrel recoil distance in local units — sharper and slightly larger than BASIC. */
  distance: 0.08,
  /** Easing profile identifier. */
  easing: 'easeOutCubic' as const,
} as const;
