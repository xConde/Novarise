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

// ─── SPLASH tower constants ────────────────────────────────────────────────────

export const SPLASH_GEOM = {
  // Stubby armored chassis base (wide, flat, tank-read)
  baseW:   0.85,
  baseH:   0.18,
  baseD:   0.85,

  // Side fins (×4, thin boxes radiating from each face)
  finW:    0.06,
  finH:    0.16,
  finD:    0.22,
  /** Distance from chassis centre to the fin's outer face. */
  finOffset: 0.42,

  // Rotating drum housing (horizontal cylinder, faces +Z)
  drumRadius:   0.32,
  drumLength:   0.5,
  drumSegments: 12,

  // Radial port-detail boxes on the drum circumference (×4)
  portW:   0.06,
  portH:   0.06,
  portD:   0.12,
  portRadial: 0.3,  // radial distance from drum axis to port centre

  // Rocket tube cylinders (×4 base, ×6 at T2, ×8 at T3)
  tubeRadius:   0.07,
  tubeLength:   0.32,
  tubeSegments: 6,

  // T2/T3 extra tube geometry dimensions match the base tubes above.

  // Ammo-belt housing (left-side decorative box)
  beltW: 0.08,
  beltH: 0.12,
  beltD: 0.3,
  beltXOffset: -0.38,
  beltYOffset:  0.0,
  beltZOffset:  0.0,

  // Ammo-round spheres on the belt detail (×3)
  roundRadius:   0.04,
  roundSegments: 6,
  roundSpacing:  0.08,

  // T3 heat-vent disk at the rear of the drum
  heatVentRadius:   0.12,
  heatVentDepth:    0.03,
  heatVentSegments: 10,
} as const;

// Y world-positions relative to the tower group origin
export const SPLASH_Y = {
  /** Top face of the chassis base where the drum sits. */
  chassisTop:  SPLASH_GEOM.baseH,
  /** Centre of the drum housing (sits flush on the chassis top). */
  drumCentre:  SPLASH_GEOM.baseH + SPLASH_GEOM.drumRadius,
  /** Accent light height — just above the drum. */
  accentLight: SPLASH_GEOM.baseH + SPLASH_GEOM.drumRadius * 2 + 0.05,
} as const;

/** Z offset of the tube cluster front face from the drum centre (forward protrusion). */
export const SPLASH_TUBE_Z = SPLASH_GEOM.drumLength / 2 + SPLASH_GEOM.tubeLength / 2;

/** 2×2 grid offsets for the 4 base tubes (x, y relative to drum face centre). */
export const SPLASH_TUBE_GRID = [
  [-0.1,  0.1],
  [ 0.1,  0.1],
  [-0.1, -0.1],
  [ 0.1, -0.1],
] as const;

/** Extra 2 tube positions added at T2 (top and bottom centre). */
export const SPLASH_TUBE_T2_EXTRA = [
  [0.0,  0.22],
  [0.0, -0.22],
] as const;

/** Extra 2 tube positions added at T3 (left and right centre). */
export const SPLASH_TUBE_T3_EXTRA = [
  [-0.22, 0.0],
  [ 0.22, 0.0],
] as const;

// ─── SPLASH idle animation ─────────────────────────────────────────────────────

export const SPLASH_DRUM_CONFIG = {
  /** Drum rotation speed at idle (radians per second around drum's forward axis). */
  idleSpeedRadPerSec: 0.4,
  /** Drum rotation speed during a fire-boost window (radians per second). */
  fireSpeedRadPerSec: 4.5,
} as const;

// ─── SPLASH tube emit animation ────────────────────────────────────────────────

export const SPLASH_TUBE_EMIT_CONFIG = {
  /** How long the selected tube stays emissive-pulsed after a fire event (seconds). */
  duration: 0.25,
  /** Multiplier applied to the tube material's base emissiveIntensity during the pulse. */
  emissiveMultiplier: 3,
} as const;

// ─── SLOW tower constants ──────────────────────────────────────────────────────

export const SLOW_GEOM = {
  // Octahedron base (cut-gem look, flattened on Y)
  octRadius:  0.32,
  octDetail:  0,
  octScaleY:  0.5,    // flatten to read as a pad from above

  // Support struts (×3 at 120° offsets, small cylinders)
  strutRadius:   0.04,
  strutHeight:   0.12,
  strutSegments: 6,
  strutRadial:   0.26, // radial distance from axis to strut centre

  // Pulse coil ring — torus geometry lying horizontal (T1; T2 adds a second)
  coilRadius:     0.36, // distance from torus centre to tube centre
  coilTube:       0.04,
  coilRadSeg:     8,
  coilTubSeg:     24,

  // T2 second coil ring (slightly smaller for visual hierarchy)
  coil2Radius:    0.28,

  // Cryo emitter dish at top — concave half-sphere facing up
  // Parameterised as SphereGeometry with phiStart/phiLength/thetaStart/thetaLength
  emitterRadius:  0.22,
  emitterWidSeg:  12,
  emitterHeiSeg:  8,
  // phiStart = 0, phiLength = Math.PI*2 (full circle)
  // thetaStart = Math.PI/2 (equator), thetaLength = Math.PI/2 (upper bowl)
  emitterThetaStart:  Math.PI / 2,
  emitterThetaLen:    Math.PI / 2,

  // T3 floating crystal core — small octahedron above the emitter dish
  crystalRadius:  0.1,
  crystalDetail:  0,
  crystalBaseYOffset: 0.18, // distance above emitter centre when at rest
} as const;

// ─── SLOW Y positions relative to tower group origin ──────────────────────────

/** Y centre of the octahedron base (sits at ground level). */
export const SLOW_BASE_Y = SLOW_GEOM.octRadius * SLOW_GEOM.octScaleY * 0.5;

/** Y centre of the coil ring (sits above the struts). */
export const SLOW_COIL_Y = SLOW_GEOM.octRadius * SLOW_GEOM.octScaleY + 0.06;

/** Y centre of the T2 second coil (one tube-diameter above the first). */
export const SLOW_COIL2_Y = SLOW_COIL_Y + SLOW_GEOM.coilTube * 3;

/** Y of the emitter dish centre (above the coil). */
export const SLOW_EMITTER_Y = SLOW_COIL_Y + SLOW_GEOM.coilTube * 2 + SLOW_GEOM.emitterRadius * 0.7;

/** Y of the T3 crystal core at rest (above the emitter). */
export const SLOW_CRYSTAL_Y = SLOW_EMITTER_Y + SLOW_GEOM.crystalBaseYOffset;

/** Y for the accent point-light (at emitter height). */
export const SLOW_ACCENT_Y = SLOW_EMITTER_Y + 0.1;

// ─── SLOW idle animation (emitter pulse + coil spin) ──────────────────────────

export const SLOW_EMITTER_PULSE_CONFIG = {
  /** Minimum emissive intensity for the breathing emitter dish. */
  min:       0.7,
  /** Maximum emissive intensity for the breathing emitter dish. */
  max:       1.0,
  /** Period of one full breath cycle in seconds. */
  periodSec: 2.0,
  /** Coil ring idle rotation speed (radians per second around its local Y axis). */
  coilRotSpeed: 0.5,
  /** T3 crystal core vertical-bob frequency (radians per second). */
  crystalBobSpeed: 1.2,
  /** T3 crystal core vertical-bob amplitude (world units). */
  crystalBobAmplitude: 0.04,
} as const;

// ─── SLOW fire animation (emitter scale pulse) ─────────────────────────────────

export const SLOW_EMITTER_PULSE_FIRE = {
  /** Peak scale factor applied to the emitter dish on fire. */
  scaleMax:    1.15,
  /** Duration of the emitter scale pulse (seconds). */
  durationSec: 0.3,
} as const;

// ─── SLOW frost-mist config (ambient particles — deferred to Phase H) ─────────

export const SLOW_FROST_CONFIG = {
  /** Target interval between each frost particle spawn (seconds). */
  spawnIntervalSec: 0.4,
  /** How many particles to emit per interval. */
  particleCount: 1,
  /** Downward drift speed per frame. */
  fallSpeed: 0.02,
} as const;

// ─── CHAIN tower constants (Phase F) ──────────────────────────────────────────

export const CHAIN_GEOM = {
  // Central post cylinder (runs through all three coil tori)
  postRadius:   0.06,
  postHeight:   0.7,
  postSegments: 6,

  // Tesla coil tori (3 horizontal rings, largest at bottom, tapering up)
  coil1Radius: 0.32,
  coil1Tube:   0.05,
  coil2Radius: 0.26,
  coil2Tube:   0.045,
  coil3Radius: 0.20,
  coil3Tube:   0.04,
  coilRadSeg:  6,
  coilTubSeg:  16,

  // Floating sphere at the top (named 'sphere')
  sphereRadius:   0.18,
  sphereWidSeg:   12,
  sphereHeiSeg:   10,

  // Radial electrode cones around the sphere (×4, named 'electrode')
  electrodeRadius: 0.025,
  electrodeHeight: 0.12,
  electrodeSegs:   4,
  electrodeRadial: 0.19,  // radial distance from sphere centre to electrode midpoint

  // Idle arc — thin cylinder flicker between post top and sphere bottom
  arcRadius:   0.01,
  arcSegments: 4,

  // T2 second orbiting sphere
  orbitSphere2Radius:   0.1,
  orbitSphere2WidSeg:   8,
  orbitSphere2HeiSeg:   6,
  orbitSphere2Radial:   0.32, // orbit radius from group centre
  orbitSphere2InitPhase: 0.0,

  // T3 third orbiting sphere
  orbitSphere3Radius:   0.08,
  orbitSphere3WidSeg:   8,
  orbitSphere3HeiSeg:   6,
  orbitSphere3Radial:   0.38,
  orbitSphere3InitPhase: Math.PI, // opposite phase from T2
} as const;

// Y positions relative to the CHAIN group origin
export const CHAIN_Y = {
  /** Centre of the lowest (largest) coil ring. */
  coil1: 0.12,
  /** Centre of the second coil ring. */
  coil2: 0.32,
  /** Centre of the third (topmost) coil ring. */
  coil3: 0.52,
  /** Centre of the central post (midpoint of postHeight). */
  postCentre: 0.35,
  /** Centre of the floating sphere. */
  sphere: 0.86,
  /** Y for the 4 radial electrode cones. */
  electrodes: 0.86,
  /** Y for the idle arc flicker cylinder (midpoint between post top and sphere bottom). */
  arc: 0.74,
  /** Arc length (distance between post top and sphere bottom). */
  arcLength: 0.1,
  /** Accent point-light position. */
  accentLight: 0.9,
  /** Y of orbiting T2/T3 spheres (slightly above main sphere centre). */
  orbitSpheres: 0.9,
} as const;

// ─── CHAIN idle animation ──────────────────────────────────────────────────────

export const CHAIN_IDLE_ARC_CONFIG = {
  /** Arc flicker frequency in Hz — toggles visibility this many times per second. */
  flickerHz: 3.0,
  /** Minimum opacity of the arc cylinder material when visible. */
  opacityMin: 0.4,
  /** Maximum opacity of the arc cylinder material when fully visible. */
  opacityMax: 0.9,
} as const;

// ─── CHAIN sphere animation ────────────────────────────────────────────────────

export const CHAIN_SPHERE_BOB_CONFIG = {
  /** Peak Y displacement of the floating sphere from its rest position (world units). */
  amplitude: 0.04,
  /** Full period of one bob cycle in seconds. */
  periodSec: 1.6,
} as const;

// ─── CHAIN charge-up animation (sphere emissive) ──────────────────────────────

export const CHAIN_CHARGE_CONFIG = {
  /** Minimum sphere emissiveIntensity at rest. */
  emissiveMin: 0.4,
  /** Peak sphere emissiveIntensity when "fully charged". */
  emissiveMax: 1.4,
  /** Period of the charge-discharge sine in seconds. */
  periodSec: 2.4,
} as const;

// ─── CHAIN electrode idle config ───────────────────────────────────────────────

export const CHAIN_ELECTRODE_CONFIG = {
  /** Base emissiveIntensity of electrode cone tips at idle. */
  emissiveBase: 0.6,
  /** Peak emissiveIntensity shimmer on electrode tips. */
  emissivePeak: 1.2,
  /** Shimmer cycle period in seconds. */
  shimmerPeriod: 0.8,
  /**
   * Phase-offset scale applied to each electrode's X position so adjacent
   * electrodes shimmer with a slight time offset, giving a "live wire" look.
   * Units: radians per world-unit of X offset.
   */
  shimmerPhaseScale: 4.0,
} as const;

// ─── CHAIN T2/T3 orbit config ─────────────────────────────────────────────────

export const CHAIN_ORBIT_CONFIG = {
  /** Orbit angular speed for T2 sphere (radians per second). */
  t2SpeedRadPerSec: 1.2,
  /** Orbit angular speed for T3 sphere (radians per second). */
  t3SpeedRadPerSec: -0.8,
} as const;

// ─── MORTAR tower constants (Phase G) ─────────────────────────────────────────

export const MORTAR_GEOM = {
  // Wide armored chassis (rectangular footprint — long on X, narrow on Z)
  chassisW: 0.95,
  chassisH: 0.18,
  chassisD: 0.70,

  // Tread strips along ±X sides at chassis bottom
  treadW:    0.06,
  treadH:    0.08,
  treadD:    0.60,
  treadXOffset: 0.505, // centre of tread from group axis (chassisW/2 + treadW/2)

  // Vent slat boxes on top of chassis (×2)
  ventW:    0.22,
  ventH:    0.04,
  ventD:    0.08,
  ventXOffset: 0.2,   // ±X offset of each vent from centre

  // Swivel housing (sits on top of chassis, named 'mortarBase')
  housingRadiusTop:    0.18,
  housingRadiusBottom: 0.18,
  housingHeight:       0.12,
  housingSegments:     8,

  // T1 barrel — standard tube
  barrelT1RadiusTop:    0.085,
  barrelT1RadiusBottom: 0.10,
  barrelT1Length:       0.55,
  barrelT1Segments:     8,

  // T2 barrel — reinforced (wider)
  barrelT2RadiusTop:    0.10,
  barrelT2RadiusBottom: 0.12,
  barrelT2Length:       0.55,
  barrelT2Segments:     8,

  // Dual barrel offset — T3 second barrel sits to the side of the first (along X in
  // barrelPivot local space, so the two barrels appear side-by-side when viewed
  // from the front rather than stacking along Z which reads as depth, not width).
  dualBarrelXOffset: 0.14,

  // Recoil cradle (collar at barrel base)
  cradleW: 0.28,
  cradleH: 0.10,
  cradleD: 0.22,

  // Ammo crate on left side (+X face)
  crateW:    0.18,
  crateH:    0.14,
  crateD:    0.22,
  crateXOffset: 0.565,  // rests against chassis +X face (chassisW/2 + crateW/2)
  crateYOffset: 0.06,   // above chassis centre-plane

  // Ammo shells (×2 small spheres) sticking up from crate top
  shellRadius:   0.04,
  shellSegments: 6,
  shellYOffset:  0.11,  // distance above crate top face
  shellZSpacing: 0.09,  // ±Z between the two shells
} as const;

// ─── MORTAR Y positions relative to group origin ──────────────────────────────

/** Top face of the chassis (where the swivel housing sits). */
export const MORTAR_CHASSIS_TOP_Y = MORTAR_GEOM.chassisH;

/** Y centre of the swivel housing above the chassis top. */
export const MORTAR_HOUSING_Y = MORTAR_CHASSIS_TOP_Y + MORTAR_GEOM.housingHeight / 2;

/** Y of the barrel pivot group origin (at the housing top face). */
export const MORTAR_BARREL_PIVOT_Y = MORTAR_CHASSIS_TOP_Y + MORTAR_GEOM.housingHeight;

/** Barrel elevation angle in degrees (tilts upward-and-forward from the pivot). */
export const MORTAR_BARREL_ELEVATION_DEG = -45;

/** Barrel elevation in radians (used for the barrelPivot group rotation). */
export const MORTAR_BARREL_ELEVATION_RAD =
  MORTAR_BARREL_ELEVATION_DEG * (Math.PI / 180);

/** Y of the accent point-light (above barrel pivot). */
export const MORTAR_ACCENT_Y = MORTAR_BARREL_PIVOT_Y + 0.4;

// ─── MORTAR firing animation ──────────────────────────────────────────────────

export const MORTAR_RECOIL_CONFIG = {
  /**
   * Barrel recoil distance in local units — 3× BASIC's 0.05u for heavy-artillery feel.
   * The barrel slides along its local +Y axis (which is the bore axis after the pivot
   * rotation). A negative offset = backward (into the chassis). See tickMortarRecoil().
   */
  distance: 0.15,
  /** Easing profile identifier — "easeOutCubic" for natural deceleration. */
  easing: 'easeOutCubic' as const,
} as const;

/**
 * Names of the MORTAR barrel meshes at each tier.
 *
 * Recoil tick cannot use getObjectByName('barrel') because T1 and T2 barrels have
 * different geometry and must be swappable via revealTierParts(). Both meshes are
 * built at creation time; the recoil tick checks both names and targets whichever
 * is currently visible. At T3 both barrelT2 and dualBarrel are visible and both
 * recoil together (they fire as one unit visually).
 */
export const MORTAR_BARREL_NAMES = ['barrelT1', 'barrelT2', 'dualBarrel'] as const;

// ─── MORTAR idle animation (barrel elevate gesture) ───────────────────────────

export const MORTAR_IDLE_CONFIG = {
  /**
   * How often the barrel elevate gesture fires (seconds between each cycle start).
   * The barrel briefly raises +5° then returns to neutral, then waits for the
   * next cycle.
   */
  cycleIntervalSec: 4.0,
  /** Duration of the raise phase (seconds). */
  raiseDurationSec: 0.5,
  /** Duration of the return phase (seconds). */
  returnDurationSec: 0.7,
  /** Peak additional elevation in radians added on top of MORTAR_BARREL_ELEVATION_RAD. */
  peakExtraRadians: 5 * (Math.PI / 180),
} as const;

// ─── CHAIN recoil config ──────────────────────────────────────────────────────

export const CHAIN_RECOIL_CONFIG = {
  /**
   * Small barrel-equivalent recoil on discharge — reinforces the electric
   * spark-kick without the full BASIC ballistic read.
   */
  distance: 0.03,
  easing: 'easeOutCubic' as const,
} as const;

// ─── SNIPER signature gesture (tracking) ─────────────────────────────────────

export const SNIPER_TRACK_CONFIG = {
  /**
   * Additional barrel rotation applied as a slow 2° sine drift on top of the
   * scope lens pulse. Simulates the sniper tracking an off-axis phantom target.
   * Amplitude in radians (±2°).
   */
  amplitudeRad: 2 * (Math.PI / 180),
  /** Sine frequency in cycles per second — slow, deliberate tracking. */
  speedHz: 0.18,
} as const;

// ─── SPLASH charge-cycle gesture ─────────────────────────────────────────────

export const SPLASH_CHARGE_CONFIG = {
  /**
   * How often the brief drum-speed-burst gesture fires (seconds between peaks).
   * Every ~3 s the drum spins up for a fraction of a second as a charge-cycle hint.
   */
  cycleIntervalSec: 3.0,
  /** Duration of the burst window (seconds). */
  burstDurationSec: 0.4,
  /** Rotation speed multiplier during the burst (applied to idleSpeedRadPerSec). */
  burstSpeedMultiplier: 3.5,
} as const;

// ─── Tier-up bounce animation ─────────────────────────────────────────────────

export const TIER_UP_BOUNCE_CONFIG = {
  /**
   * Peak scale factor applied to the tower group at the start of the tier-up
   * bounce. The group then eases back to 1.0× over durationSec.
   */
  peakScale: 1.10,
  /** Total duration of the bounce animation in seconds. */
  durationSec: 0.3,
  easing: 'easeOutCubic' as const,
} as const;

// ─── Sell animation ───────────────────────────────────────────────────────────

export const SELL_ANIM_CONFIG = {
  /** Duration of the shrink-and-fade animation in seconds. */
  durationSec: 0.4,
  /** Target scale at the end of the animation (tower disappears at this scale). */
  finalScale: 0.0,
} as const;

// ─── Selection pulse ──────────────────────────────────────────────────────────

export const SELECTION_PULSE_CONFIG = {
  /** Minimum opacity of the glow ring while a tower is selected. */
  opacityMin: 0.5,
  /** Maximum opacity of the glow ring while a tower is selected. */
  opacityMax: 0.9,
  /** Period of one full pulse cycle in seconds. */
  periodSec: 1.4,
} as const;

// ─── Hover accent-light lift ──────────────────────────────────────────────────

export const HOVER_LIFT_CONFIG = {
  /**
   * Multiplier applied to the base accent point-light intensity when the
   * cursor is over a tower. Provides subtle feedback that the tower is
   * interactive without changing the material.
   */
  intensityMultiplier: 1.3,
} as const;
