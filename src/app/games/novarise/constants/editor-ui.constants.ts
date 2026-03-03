// Editor UI configuration constants
// Extracted from novarise.component.ts and terrain-grid.class.ts
// — do NOT duplicate or inline these values.

// ── Edit throttle ─────────────────────────────────────────────────────────────
/** Minimum milliseconds between paint/height edits during a drag stroke (≈20 fps). */
export const EDITOR_EDIT_THROTTLE_MS = 50;

// ── Brush indicator (main single-tile ring) ───────────────────────────────────
export const EDITOR_BRUSH_INDICATOR = {
  innerRadius: 0.4,
  outerRadius: 0.5,
  segments: 32,
  color: 0x6a9aff,
  opacity: 0.8,
  /** Y lift above the hovered tile surface. */
  yOffset: 0.15,
} as const;

// ── Multi-brush preview rings (secondary tiles in a larger brush) ─────────────
export const EDITOR_BRUSH_PREVIEW = {
  innerRadius: 0.35,
  outerRadius: 0.4,
  segments: 32,
  color: 0x9a8ab0,
  opacity: 0.5,
  /** Y lift above each secondary tile surface. */
  yOffset: 0.15,
} as const;

// ── Rectangle selection preview rings ─────────────────────────────────────────
export const EDITOR_RECTANGLE_PREVIEW = {
  innerRadius: 0.35,
  outerRadius: 0.4,
  segments: 32,
  color: 0xffaa00,
  opacity: 0.6,
  /** Y lift above each preview tile surface. */
  yOffset: 0.2,
} as const;

// ── Spawn / exit marker geometry ──────────────────────────────────────────────
export const EDITOR_SPAWN_MARKER = {
  radiusTop: 0.3,
  radiusBottom: 0.5,
  height: 0.8,
  radialSegments: 8,
  color: 0x50ff50,
  opacity: 0.8,
  /** Y lift above tile surface used for initial placement and bounce animation. */
  yBase: 0.8,
} as const;

export const EDITOR_EXIT_MARKER = {
  radiusTop: 0.5,
  radiusBottom: 0.3,
  height: 0.8,
  radialSegments: 8,
  color: 0xff5050,
  opacity: 0.8,
  /** Y lift above tile surface used for initial placement and bounce animation. */
  yBase: 0.8,
} as const;

// ── Marker / brush animation constants ───────────────────────────────────────
export const EDITOR_ANIMATION = {
  /** Frequency used for the brush-indicator pulse (Date.now() * pulseSpeed). */
  brushPulseSpeed: 0.005,
  /** Amplitude of the brush scale pulse (scale = 1 ± amplitude). */
  brushPulseAmplitude: 0.1,
  /** Frequency used for the spawn/exit marker vertical bounce. */
  markerBounceSpeed: 0.003,
  /** Maximum vertical bounce amplitude added on top of the base Y. */
  markerBounceAmplitude: 0.2,
  /** Per-frame Y-rotation increment for spawn marker (positive = CCW). */
  spawnRotationSpeed: 0.01,
  /** Per-frame Y-rotation increment for exit marker (negative = CW). */
  exitRotationSpeed: -0.01,
  /** Phase offset (radians) for exit marker bounce so it is out-of-phase with spawn. */
  exitBouncePhaseOffset: Math.PI,
} as const;

// ── Hover emissive intensities ────────────────────────────────────────────────
export const EDITOR_HOVER_EMISSIVE = {
  /** Emissive intensity set on a tile while the cursor hovers over it. */
  hover: 0.9,
  /** Peak emissive intensity at the start of the flash-on-edit animation. */
  flashPeak: 1.5,
  /** Intermediate emissive intensity during the fade-back phase of the flash. */
  flashMid: 0.9,
  /** Fallback emissive intensity used when no terrain config can be resolved. */
  defaultFallback: 0.2,
  /** Delay (ms) before the flash-on-edit starts fading to mid intensity. */
  flashFadeDelayMs: 50,
  /** Delay (ms) for the second fade-back from mid to original intensity. */
  flashFadeBackMs: 100,
} as const;

// ── Flood-fill iteration guard ────────────────────────────────────────────────
/** Maximum BFS iterations for flood-fill — equals 25×25 (full grid). */
export const EDITOR_FLOOD_FILL_MAX_ITERATIONS = 625;

// ── Grid lines (terrain-grid.class.ts) ───────────────────────────────────────
export const EDITOR_GRID_LINES = {
  color: 0x3a2a4a,
  opacity: 0.3,
  /** Y lift above tile surfaces so lines are not z-fighting. */
  yOffset: 0.01,
} as const;

// ── Path validation ───────────────────────────────────────────────────────────
/** Duration (ms) of the red flash shown when a spawn/exit placement is rejected. */
export const EDITOR_PATH_INVALID_FLASH_MS = 600;
/** Color used for the rejection flash on spawn/exit markers. */
export const EDITOR_PATH_INVALID_FLASH_COLOR = 0xff2222;

// ── Height limits (terrain-grid.class.ts) ────────────────────────────────────
export const EDITOR_HEIGHT = {
  min: 0,
  max: 5,
  /** Height difference between a tile and a neighbour that triggers smoothing. */
  smoothingThreshold: 0.5,
  /** Fraction of the height difference applied to the neighbour during smoothing. */
  smoothingBlendFactor: 0.3,
} as const;
