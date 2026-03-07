export interface LightConfig {
  color: number;
  intensity: number;
  position?: [number, number, number];
  range?: number;
  castShadow?: boolean;
  shadow?: { mapSize: number; bias: number; bounds: number };
}

export const AMBIENT_LIGHT: LightConfig = {
  color: 0x5a4a6a,
  intensity: 0.9
};

export const DIRECTIONAL_LIGHT: LightConfig & {
  castShadow: boolean;
  shadow: { mapSize: number; bias: number; bounds: number };
} = {
  color: 0xc0b0d0,
  intensity: 1.2,
  position: [10, 20, 10],
  castShadow: true,
  shadow: {
    mapSize: 2048,
    bias: -0.0001,
    bounds: 20
  }
};

export const UNDER_LIGHT: LightConfig = {
  color: 0x6a5a8a,
  intensity: 0.7,
  range: 80,
  position: [0, -5, 0]
};

export const POINT_LIGHTS: LightConfig[] = [
  {
    color: 0x8a6aaa,
    intensity: 0.6,
    range: 50,
    position: [-15, 5, -10]
  },
  {
    color: 0x6a8aaa,
    intensity: 0.6,
    range: 50,
    position: [15, 5, 10]
  }
];
