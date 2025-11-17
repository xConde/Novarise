/**
 * Theme System Models
 *
 * Manages visual themes and aesthetic loadouts for the game.
 * Supports switching between different environmental styles while
 * maintaining consistent gameplay mechanics.
 */

import { TerrainType, TerrainProperties } from './terrain.model';

/**
 * Available theme presets for the game environment.
 */
export enum ThemePreset {
  /** Organic space cave with bioluminescent elements (default) */
  MORIA_DEPTHS = 'moria_depths',

  /** Crystal caverns with emphasis on mineral formations */
  GLITTERING_CAVES = 'glittering_caves',

  /** Verdant underground ecosystem */
  FANGORN_UNDERGROUND = 'fangorn_underground',

  /** Dark, foreboding depths */
  SHELOBS_LAIR = 'shelobs_lair'
}

/**
 * Theme configuration defining all visual aspects of an environment.
 */
export interface ThemeConfig {
  /** Unique identifier for the theme */
  id: ThemePreset;

  /** Display name for the theme */
  name: string;

  /** Description of the theme's aesthetic */
  description: string;

  /** Background/sky color */
  backgroundColor: number;

  /** Fog color */
  fogColor: number;

  /** Fog density (0-1) */
  fogDensity: number;

  /** Ambient light color */
  ambientLightColor: number;

  /** Ambient light intensity (0-1) */
  ambientLightIntensity: number;

  /** Directional light color */
  directionalLightColor: number;

  /** Directional light intensity (0-1) */
  directionalLightIntensity: number;

  /** Grid line color */
  gridLineColor: number;

  /** Grid line opacity (0-1) */
  gridLineOpacity: number;

  /** Terrain type overrides for this theme */
  terrainOverrides?: Partial<Record<TerrainType, Partial<TerrainProperties>>>;

  /** Particle effects configuration */
  particles?: {
    color: number;
    count: number;
    size: number;
  };
}

/**
 * Result type for theme operations with error handling.
 */
export interface ThemeOperationResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** The theme that was loaded/applied (if successful) */
  theme?: ThemeConfig;

  /** Error message if operation failed */
  error?: string;

  /** Additional context about the error */
  errorDetails?: unknown;
}

/**
 * Validation result for theme configurations.
 */
export interface ThemeValidationResult {
  /** Whether the theme is valid */
  isValid: boolean;

  /** List of validation errors */
  errors: string[];

  /** List of validation warnings (non-critical issues) */
  warnings: string[];
}

/**
 * Default theme configurations for each preset.
 */
export const THEME_PRESETS: Record<ThemePreset, ThemeConfig> = {
  [ThemePreset.MORIA_DEPTHS]: {
    id: ThemePreset.MORIA_DEPTHS,
    name: 'Moria Depths',
    description: 'Organic space cave with purple bioluminescence and ancient stone',
    backgroundColor: 0x000000,
    fogColor: 0x1a0a2a,
    fogDensity: 0.015,
    ambientLightColor: 0x3a2a4a,
    ambientLightIntensity: 0.3,
    directionalLightColor: 0x9a8ab0,
    directionalLightIntensity: 0.6,
    gridLineColor: 0x5a4a7a,
    gridLineOpacity: 0.25,
    particles: {
      color: 0x7a5ac4,
      count: 100,
      size: 0.15
    }
  },

  [ThemePreset.GLITTERING_CAVES]: {
    id: ThemePreset.GLITTERING_CAVES,
    name: 'Glittering Caves',
    description: 'Crystal-filled caverns with brilliant mineral formations',
    backgroundColor: 0x0a0a15,
    fogColor: 0x1a2a4a,
    fogDensity: 0.012,
    ambientLightColor: 0x2a3a5a,
    ambientLightIntensity: 0.4,
    directionalLightColor: 0x8ab0d0,
    directionalLightIntensity: 0.7,
    gridLineColor: 0x4a6a9a,
    gridLineOpacity: 0.3,
    particles: {
      color: 0x5ac4d4,
      count: 150,
      size: 0.12
    },
    terrainOverrides: {
      [TerrainType.MITHRIL_CRYSTAL]: {
        emissiveIntensity: 0.6,
        color: 0x7a8acd
      }
    }
  },

  [ThemePreset.FANGORN_UNDERGROUND]: {
    id: ThemePreset.FANGORN_UNDERGROUND,
    name: 'Fangorn Underground',
    description: 'Verdant underground ecosystem with thriving bioluminescent life',
    backgroundColor: 0x050a05,
    fogColor: 0x0a2a1a,
    fogDensity: 0.018,
    ambientLightColor: 0x2a4a3a,
    ambientLightIntensity: 0.35,
    directionalLightColor: 0x7ab08a,
    directionalLightIntensity: 0.65,
    gridLineColor: 0x4a7a5a,
    gridLineOpacity: 0.28,
    particles: {
      color: 0x4ac47a,
      count: 120,
      size: 0.18
    },
    terrainOverrides: {
      [TerrainType.LUMINOUS_MOSS]: {
        emissiveIntensity: 0.5,
        color: 0x3d6020
      }
    }
  },

  [ThemePreset.SHELOBS_LAIR]: {
    id: ThemePreset.SHELOBS_LAIR,
    name: "Shelob's Lair",
    description: 'Dark, foreboding depths with minimal light and oppressive atmosphere',
    backgroundColor: 0x000000,
    fogColor: 0x0a0a0a,
    fogDensity: 0.025,
    ambientLightColor: 0x1a1a1a,
    ambientLightIntensity: 0.2,
    directionalLightColor: 0x4a4a5a,
    directionalLightIntensity: 0.4,
    gridLineColor: 0x2a2a3a,
    gridLineOpacity: 0.15,
    particles: {
      color: 0x3a3a4a,
      count: 50,
      size: 0.1
    },
    terrainOverrides: {
      [TerrainType.ABYSS]: {
        emissiveIntensity: 0.02,
        color: 0x050505
      }
    }
  }
};

/**
 * Validates a theme configuration for correctness and completeness.
 */
export function validateThemeConfig(theme: ThemeConfig): ThemeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!theme.id) {
    errors.push('Theme ID is required');
  }
  if (!theme.name) {
    errors.push('Theme name is required');
  }

  // Validate color values (should be valid hex numbers)
  const colorFields: (keyof ThemeConfig)[] = [
    'backgroundColor',
    'fogColor',
    'ambientLightColor',
    'directionalLightColor',
    'gridLineColor'
  ];

  colorFields.forEach(field => {
    const value = theme[field] as number;
    if (typeof value !== 'number' || value < 0 || value > 0xFFFFFF) {
      errors.push(`Invalid color value for ${field}: ${value}`);
    }
  });

  // Validate intensity/opacity values (should be 0-1)
  const intensityFields: (keyof ThemeConfig)[] = [
    'fogDensity',
    'ambientLightIntensity',
    'directionalLightIntensity',
    'gridLineOpacity'
  ];

  intensityFields.forEach(field => {
    const value = theme[field] as number;
    if (typeof value !== 'number' || value < 0 || value > 1) {
      errors.push(`Invalid intensity/opacity value for ${field}: ${value} (must be 0-1)`);
    }
  });

  // Validate particle configuration if present
  if (theme.particles) {
    if (theme.particles.count < 0) {
      errors.push(`Invalid particle count: ${theme.particles.count} (must be >= 0)`);
    }
    if (theme.particles.size <= 0) {
      errors.push(`Invalid particle size: ${theme.particles.size} (must be > 0)`);
    }
    if (theme.particles.count > 500) {
      warnings.push(`High particle count (${theme.particles.count}) may impact performance`);
    }
  }

  // Validate terrain overrides if present
  if (theme.terrainOverrides) {
    Object.entries(theme.terrainOverrides).forEach(([terrainType, overrides]) => {
      if (overrides.emissiveIntensity !== undefined) {
        if (overrides.emissiveIntensity < 0 || overrides.emissiveIntensity > 1) {
          errors.push(
            `Invalid emissiveIntensity for ${terrainType}: ${overrides.emissiveIntensity}`
          );
        }
      }
      if (overrides.roughness !== undefined) {
        if (overrides.roughness < 0 || overrides.roughness > 1) {
          errors.push(`Invalid roughness for ${terrainType}: ${overrides.roughness}`);
        }
      }
      if (overrides.metalness !== undefined) {
        if (overrides.metalness < 0 || overrides.metalness > 1) {
          errors.push(`Invalid metalness for ${terrainType}: ${overrides.metalness}`);
        }
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Default theme used when no theme is explicitly selected.
 */
export const DEFAULT_THEME = THEME_PRESETS[ThemePreset.MORIA_DEPTHS];
