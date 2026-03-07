export interface LightConfig {
  color: number;
  intensity: number;
  position?: [number, number, number];
  range?: number;
  castShadow?: boolean;
  shadow?: { mapSize: number; bias: number; bounds: number };
}

export interface HemisphereLightConfig {
  skyColor: number;
  groundColor: number;
  intensity: number;
}

export const HEMISPHERE_LIGHT: HemisphereLightConfig = {
  skyColor: 0x6060a0,
  groundColor: 0x302848,
  intensity: 0.7
};

/** Kept for editor or fallback use; game scene relies on hemisphere light for ambient fill */
export const AMBIENT_LIGHT: LightConfig = {
  color: 0x8888aa,
  intensity: 0.3
};

export const KEY_LIGHT: LightConfig & {
  castShadow: boolean;
  shadow: { mapSize: number; bias: number; bounds: number };
} = {
  color: 0xeee8ff,
  intensity: 2.0,
  position: [15, 30, 12],
  castShadow: true,
  shadow: {
    mapSize: 2048,
    bias: -0.0001,
    bounds: 25
  }
};

export const FILL_LIGHT: LightConfig = {
  color: 0x8090c0,
  intensity: 0.8,
  position: [-12, 15, -8]
};

export const RIM_LIGHT: LightConfig = {
  color: 0xaa88ff,
  intensity: 0.7,
  position: [-5, 10, -20]
};

export const UNDER_LIGHT: LightConfig = {
  color: 0x6a5a9a,
  intensity: 0.3,
  range: 80,
  position: [0, -5, 0]
};

export const ACCENT_LIGHTS: LightConfig[] = [
  {
    color: 0x9a6abf,
    intensity: 0.6,
    range: 60,
    position: [-18, 8, -12]
  },
  {
    color: 0x6a8abf,
    intensity: 0.6,
    range: 60,
    position: [18, 8, 12]
  }
];
