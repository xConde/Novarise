export const PARTICLE_CONFIG = {
  count: 400,
  spread: 50,
  heightMin: 2,
  heightRange: 30,
  size: 0.18,
  opacity: 0.6,
  animSpeedTime: 0.001,
  animSpeedWave: 0.002,
  rotationSpeed: 0.0002
};

export const DEATH_BURST_CONFIG = {
  defaultCount: 12,
  radius: 0.06,
  minSpeed: 2,
  maxSpeed: 5,
  lifetime: 0.6,
  gravity: -6,
  scaleEnd: 0.1,
  emissiveIntensity: 0.8,
  roughness: 0.4,
  metalness: 0.1,
  sizeVariation: 0.5,
} as const;

export const PARTICLE_COLORS: Array<{ threshold: number; r: number; g: number; b: number }> = [
  { threshold: 0.4, r: 0.4, g: 0.5, b: 0.7 },
  { threshold: 0.7, r: 0.5, g: 0.3, b: 0.6 },
  { threshold: 1.0, r: 0.3, g: 0.6, b: 0.5 }
];
