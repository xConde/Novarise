export interface LightConfig {
  color: number;
  intensity: number;
  position?: [number, number, number];
  range?: number;
  castShadow?: boolean;
  shadow?: { mapSize: number; bias: number; bounds: number };
}

export const AMBIENT_LIGHT: LightConfig = {
  color: 0x9090a0,
  intensity: 1.1
};

export const DIRECTIONAL_LIGHT: LightConfig & {
  castShadow: boolean;
  shadow: { mapSize: number; bias: number; bounds: number };
} = {
  color: 0xe0d8f0,
  intensity: 1.4,
  position: [10, 20, 10],
  castShadow: true,
  shadow: {
    mapSize: 2048,
    bias: -0.0001,
    bounds: 20
  }
};

export const UNDER_LIGHT: LightConfig = {
  color: 0x8a7aaa,
  intensity: 0.8,
  range: 80,
  position: [0, -5, 0]
};

export const POINT_LIGHTS: LightConfig[] = [
  {
    color: 0x9a7aba,
    intensity: 0.7,
    range: 50,
    position: [-15, 5, -10]
  },
  {
    color: 0x7a9aba,
    intensity: 0.7,
    range: 50,
    position: [15, 5, 10]
  }
];
