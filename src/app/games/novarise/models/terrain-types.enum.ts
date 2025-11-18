export enum TerrainType {
  BEDROCK = 'bedrock',
  CRYSTAL = 'crystal',
  MOSS = 'moss',
  ABYSS = 'abyss'
}

export interface TerrainTypeConfig {
  name: string;
  color: number;
  emissiveColor: number;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
  label: string;
}

export const TERRAIN_CONFIGS: Record<TerrainType, TerrainTypeConfig> = {
  [TerrainType.BEDROCK]: {
    name: 'Bedrock',
    color: 0x2a1a3a,
    emissiveColor: 0x1a0a2a,
    emissiveIntensity: 0.1,
    roughness: 0.9,
    metalness: 0.1,
    label: 'Bedrock'
  },
  [TerrainType.CRYSTAL]: {
    name: 'Crystal',
    color: 0x4a3a7a,
    emissiveColor: 0x6a4a9a,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.8,
    label: 'Crystal'
  },
  [TerrainType.MOSS]: {
    name: 'Moss',
    color: 0x2a4a3a,
    emissiveColor: 0x3a6a4a,
    emissiveIntensity: 0.3,
    roughness: 0.8,
    metalness: 0.1,
    label: 'Moss'
  },
  [TerrainType.ABYSS]: {
    name: 'Abyss',
    color: 0x0a0515,
    emissiveColor: 0x1a0a2a,
    emissiveIntensity: 0.05,
    roughness: 1.0,
    metalness: 0.0,
    label: 'Abyss'
  }
};
