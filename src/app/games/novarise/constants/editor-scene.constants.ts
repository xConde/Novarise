// Editor scene configuration constants
// Extracted from novarise.component.ts — do NOT duplicate or inline these values.
//
// NOTE: GLSL shader constants (starfield noise math, e.g. vec2(12.9898, 78.233), 43758.5453123)
// are intentionally left inside the ShaderMaterial fragmentShader string. Those values are
// tightly coupled to the GLSL algorithm and extracting them into TS would add noise without
// benefit — they cannot be referenced outside the shader string.

export interface LightConfig {
  color: number;
  intensity: number;
  position?: [number, number, number];
}

export interface DirectionalLightConfig extends LightConfig {
  position: [number, number, number];
  castShadow?: boolean;
  shadowCameraExtent?: number;
  shadowMapSize?: number;
}

export interface PointLightConfig extends LightConfig {
  position: [number, number, number];
  distance: number;
}

// ── Scene background & fog ───────────────────────────────────────────────────
export const EDITOR_SCENE_CONFIG = {
  backgroundColor: 0x1a1a2e,
  fogColor: 0x1a1a2e,
  fogDensity: 0.005,
} as const;

// ── Renderer ─────────────────────────────────────────────────────────────────
export const EDITOR_RENDERER_CONFIG = {
  maxPixelRatio: 2,
  toneMappingExposure: 1.8,
} as const;

// ── Post-processing ───────────────────────────────────────────────────────────
export const EDITOR_POST_PROCESSING = {
  bloom: {
    strength: 0.3,
    radius: 0.4,
    threshold: 0.95,
  },
  vignette: {
    offset: 1.2,
    darkness: 0.8,
  },
} as const;

// ── Lights ────────────────────────────────────────────────────────────────────
export const EDITOR_LIGHTS = {
  ambient: {
    color: 0xffffff,
    intensity: 2.0,
  } as LightConfig,

  hemisphere: {
    skyColor: 0xffffff,
    groundColor: 0xaaaaaa,
    intensity: 1.5,
  },

  /** Four directional lights that provide even coverage from all horizontal sides. */
  directional: [
    {
      color: 0xffffff,
      intensity: 2.5,
      position: [10, 40, 10] as [number, number, number],
      castShadow: true,
      shadowCameraExtent: 30,
      shadowMapSize: 2048,
    },
    {
      color: 0xffffff,
      intensity: 2.0,
      position: [-10, 30, -10] as [number, number, number],
    },
    {
      color: 0xffffff,
      intensity: 1.5,
      position: [20, 25, 0] as [number, number, number],
    },
    {
      color: 0xffffff,
      intensity: 1.5,
      position: [-20, 25, 0] as [number, number, number],
    },
  ] as DirectionalLightConfig[],

  /** Upward-facing light from directly below for complete underside visibility. */
  bottomLight: {
    color: 0xffffff,
    intensity: 1.5,
    position: [0, -20, 0] as [number, number, number],
  } as DirectionalLightConfig,

  /** Five point lights spread around the grid for extra local brightness. */
  point: [
    { color: 0xffffff, intensity: 1.5, position: [0, 20, 0] as [number, number, number], distance: 50 },
    { color: 0xffffff, intensity: 1.2, position: [15, 15, 15] as [number, number, number], distance: 50 },
    { color: 0xffffff, intensity: 1.2, position: [-15, 15, -15] as [number, number, number], distance: 50 },
    { color: 0xffffff, intensity: 1.2, position: [15, 15, -15] as [number, number, number], distance: 50 },
    { color: 0xffffff, intensity: 1.2, position: [-15, 15, 15] as [number, number, number], distance: 50 },
  ] as PointLightConfig[],
} as const;

// ── Skybox ────────────────────────────────────────────────────────────────────
export const EDITOR_SKYBOX = {
  radius: 500,
  widthSegments: 32,
  heightSegments: 32,
} as const;

// ── Ambient particles ─────────────────────────────────────────────────────────
export const EDITOR_PARTICLES = {
  count: 400,
  /** Half-extent of the XZ spread range (positions span ±positionRange). */
  positionRange: 50,
  /** Minimum Y offset above ground. */
  positionYMin: 2,
  /** Maximum additional random Y height above positionYMin. */
  positionYRange: 30,
  /** Color thresholds — particles pick one of three colour palettes at random. */
  colorThresholds: {
    blue: 0.4,   // [0, 0.4)   → blue-purple
    purple: 0.7, // [0.4, 0.7) → violet
    // ≥ 0.7 → teal
  },
  /** RGB values for each colour palette [r, g, b]. */
  colors: {
    blue:   [0.4, 0.5, 0.7] as [number, number, number],
    purple: [0.5, 0.3, 0.6] as [number, number, number],
    teal:   [0.3, 0.6, 0.5] as [number, number, number],
  },
  size: 0.12,
  opacity: 0.4,
} as const;
