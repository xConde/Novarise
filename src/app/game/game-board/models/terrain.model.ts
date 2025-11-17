/**
 * Terrain System Models
 *
 * Defines terrain types, heights, and properties for the game board.
 * Inspired by Middle-earth aesthetics adapted for organic cave environments.
 */

/**
 * Terrain types representing different ground materials in the cavern.
 * Each type affects movement speed and visual appearance.
 */
export enum TerrainType {
  /** Standard bedrock - normal movement speed */
  BEDROCK = 'bedrock',

  /** Crystalline formations - slower movement due to difficult footing */
  MITHRIL_CRYSTAL = 'mithril_crystal',

  /** Bioluminescent moss - faster movement, smooth surface */
  LUMINOUS_MOSS = 'luminous_moss',

  /** Impassable chasm - enemies cannot traverse */
  ABYSS = 'abyss'
}

/**
 * Height levels for terrain elevation.
 * Creates visual depth and strategic positioning.
 */
export enum TerrainHeight {
  /** Sunken terrain - lower than base level */
  SUNKEN = -0.5,

  /** Standard ground level */
  BASE = 0,

  /** Elevated terrain - higher than base level */
  ELEVATED = 0.5
}

/**
 * Properties and characteristics for each terrain type.
 */
export interface TerrainProperties {
  /** Display name for the terrain type */
  name: string;

  /** Movement cost multiplier (1.0 = normal, >1.0 = slower, <1.0 = faster) */
  movementCost: number;

  /** Whether units can traverse this terrain */
  isTraversable: boolean;

  /** Base color for the terrain material */
  color: number;

  /** Emissive color for bioluminescent effect */
  emissiveColor: number;

  /** Emissive intensity (0-1) */
  emissiveIntensity: number;

  /** Roughness of the material surface (0-1) */
  roughness: number;

  /** Metalness of the material (0-1) */
  metalness: number;

  /** Description of the terrain for UI/tooltips */
  description: string;
}

/**
 * Complete terrain definition including type and height.
 */
export interface TerrainData {
  /** The type of terrain */
  type: TerrainType;

  /** The height level of this terrain */
  height: TerrainHeight;

  /** Grid position - row */
  row: number;

  /** Grid position - column */
  col: number;
}

/**
 * Configuration mapping for all terrain types.
 * Defines visual and gameplay properties for each terrain.
 */
export const TERRAIN_CONFIG: Record<TerrainType, TerrainProperties> = {
  [TerrainType.BEDROCK]: {
    name: 'Bedrock',
    movementCost: 1.0,
    isTraversable: true,
    color: 0x3a3a3a,           // Dark gray stone
    emissiveColor: 0x2a2a2a,
    emissiveIntensity: 0.1,
    roughness: 0.9,
    metalness: 0.1,
    description: 'Standard cavern floor - normal movement speed'
  },

  [TerrainType.MITHRIL_CRYSTAL]: {
    name: 'Mithril Crystal',
    movementCost: 1.5,         // 50% slower
    isTraversable: true,
    color: 0x6a5acd,           // Slate blue crystal
    emissiveColor: 0x8a7aed,   // Brighter blue-purple glow
    emissiveIntensity: 0.4,
    roughness: 0.2,
    metalness: 0.8,
    description: 'Crystalline formations - slows movement by 50%'
  },

  [TerrainType.LUMINOUS_MOSS]: {
    name: 'Luminous Moss',
    movementCost: 0.75,        // 25% faster
    isTraversable: true,
    color: 0x2d5016,           // Deep forest green
    emissiveColor: 0x7aff7a,   // Bright green bioluminescence
    emissiveIntensity: 0.35,
    roughness: 0.7,
    metalness: 0.0,
    description: 'Bioluminescent moss - increases movement speed by 25%'
  },

  [TerrainType.ABYSS]: {
    name: 'Abyss',
    movementCost: Infinity,    // Impassable
    isTraversable: false,
    color: 0x0a0a0a,           // Nearly black
    emissiveColor: 0x1a0a2a,   // Very dark purple
    emissiveIntensity: 0.05,
    roughness: 1.0,
    metalness: 0.0,
    description: 'Bottomless chasm - impassable to all units'
  }
};

/**
 * Helper function to get terrain properties by type.
 */
export function getTerrainProperties(type: TerrainType): TerrainProperties {
  return TERRAIN_CONFIG[type];
}

/**
 * Calculate the effective movement cost for a terrain tile.
 * Takes into account both terrain type and height differences.
 *
 * @param terrainType The type of terrain
 * @param fromHeight Starting height level
 * @param toHeight Destination height level
 * @returns The total movement cost multiplier
 */
export function calculateMovementCost(
  terrainType: TerrainType,
  fromHeight: TerrainHeight = TerrainHeight.BASE,
  toHeight: TerrainHeight = TerrainHeight.BASE
): number {
  const terrainCost = TERRAIN_CONFIG[terrainType].movementCost;

  // If terrain is impassable, return infinity
  if (!TERRAIN_CONFIG[terrainType].isTraversable) {
    return Infinity;
  }

  // Calculate height difference penalty
  const heightDifference = Math.abs(toHeight - fromHeight);
  const heightPenalty = heightDifference > 0 ? 1 + (heightDifference * 0.2) : 1;

  return terrainCost * heightPenalty;
}

/**
 * Default terrain for a standard tile.
 */
export const DEFAULT_TERRAIN: Omit<TerrainData, 'row' | 'col'> = {
  type: TerrainType.BEDROCK,
  height: TerrainHeight.BASE
};
