export const SCENE_CONFIG = {
  backgroundColor: 0x080810,
  fogColor: 0x080810,
  fogDensity: 0.006,
  toneMappingExposure: 1.4,
  maxPixelRatio: 2
};

export const POST_PROCESSING_CONFIG = {
  bloom: {
    strength: 0.45,
    radius: 0.6,
    threshold: 0.82
  },
  vignette: {
    offset: 1.0,
    darkness: 0.35
  }
};

export const SKYBOX_CONFIG = {
  radius: 500,
  widthSegments: 32,
  heightSegments: 32
};

export const ANIMATION_CONFIG = {
  /** Converts requestAnimationFrame timestamps (milliseconds) to seconds. */
  msToSeconds: 0.001,
} as const;
