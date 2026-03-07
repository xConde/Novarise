export const SCENE_CONFIG = {
  backgroundColor: 0x0a0a14,
  fogColor: 0x0a0a14,
  fogDensity: 0.008,
  toneMappingExposure: 1.8
};

export const POST_PROCESSING_CONFIG = {
  bloom: {
    strength: 0.7,
    radius: 0.8,
    threshold: 0.5
  },
  vignette: {
    offset: 1.1,
    darkness: 0.25
  }
};

export const SKYBOX_CONFIG = {
  radius: 500,
  widthSegments: 32,
  heightSegments: 32
};
