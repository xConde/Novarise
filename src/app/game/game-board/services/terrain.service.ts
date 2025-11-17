/**
 * Terrain Service
 *
 * Manages terrain generation, modification, and persistence.
 * Provides tools for creating organic cave environments with varied terrain types
 * and height levels.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  TerrainType,
  TerrainHeight,
  TerrainData,
  DEFAULT_TERRAIN,
  calculateMovementCost
} from '../models/terrain.model';

/**
 * Terrain layout for the entire game board.
 */
export interface TerrainLayout {
  /** 2D array of terrain data [row][col] */
  tiles: TerrainData[][];

  /** Name/identifier for this layout */
  name: string;

  /** Optional description */
  description?: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Last modified timestamp */
  modifiedAt: Date;
}

/**
 * Result of a terrain operation.
 */
export interface TerrainOperationResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Configuration for procedural terrain generation.
 */
export interface TerrainGenerationConfig {
  /** Width of the board */
  width: number;

  /** Height of the board */
  height: number;

  /** Probability of elevated terrain (0-1) */
  elevatedChance?: number;

  /** Probability of sunken terrain (0-1) */
  sunkenChance?: number;

  /** Probability of crystal formations (0-1) */
  crystalChance?: number;

  /** Probability of moss growth (0-1) */
  mossChance?: number;

  /** Probability of chasms (0-1) */
  abyssChance?: number;

  /** Seed for random generation (for reproducibility) */
  seed?: number;
}

/**
 * Service for managing terrain generation and modification.
 */
@Injectable({
  providedIn: 'root'
})
export class TerrainService {
  /** Current terrain layout */
  private currentLayoutSubject = new BehaviorSubject<TerrainLayout | null>(null);

  /** Observable for terrain changes */
  public currentLayout$: Observable<TerrainLayout | null> =
    this.currentLayoutSubject.asObservable();

  /** Storage key for saved layouts */
  private readonly STORAGE_KEY = 'novarise_terrain_layouts';

  /** Storage key for active layout */
  private readonly ACTIVE_LAYOUT_KEY = 'novarise_active_terrain';

  constructor() {
    this.loadActiveLayout();
  }

  /**
   * Generate a default flat terrain layout.
   *
   * @param width Board width
   * @param height Board height
   * @returns New terrain layout
   */
  generateDefaultTerrain(width: number, height: number): TerrainLayout {
    const tiles: TerrainData[][] = [];

    for (let row = 0; row < height; row++) {
      tiles[row] = [];
      for (let col = 0; col < width; col++) {
        tiles[row][col] = {
          ...DEFAULT_TERRAIN,
          row,
          col
        };
      }
    }

    const layout: TerrainLayout = {
      tiles,
      name: 'Default Terrain',
      description: 'Flat bedrock terrain',
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    this.currentLayoutSubject.next(layout);
    return layout;
  }

  /**
   * Generate procedural terrain with varied types and heights.
   *
   * @param config Generation configuration
   * @returns New terrain layout
   */
  generateProceduralTerrain(config: TerrainGenerationConfig): TerrainLayout {
    const {
      width,
      height,
      elevatedChance = 0.15,
      sunkenChance = 0.1,
      crystalChance = 0.12,
      mossChance = 0.15,
      abyssChance = 0.05,
      seed
    } = config;

    // Initialize random number generator with seed if provided
    let randomSeed = seed || Math.random() * 1000000;
    const seededRandom = () => {
      randomSeed = (randomSeed * 9301 + 49297) % 233280;
      return randomSeed / 233280;
    };

    const tiles: TerrainData[][] = [];

    for (let row = 0; row < height; row++) {
      tiles[row] = [];
      for (let col = 0; col < width; col++) {
        // Determine terrain type
        let terrainType = TerrainType.BEDROCK;
        const terrainRoll = seededRandom();

        if (terrainRoll < abyssChance) {
          terrainType = TerrainType.ABYSS;
        } else if (terrainRoll < abyssChance + crystalChance) {
          terrainType = TerrainType.MITHRIL_CRYSTAL;
        } else if (terrainRoll < abyssChance + crystalChance + mossChance) {
          terrainType = TerrainType.LUMINOUS_MOSS;
        }

        // Determine height (only for traversable terrain)
        let terrainHeight = TerrainHeight.BASE;
        if (terrainType !== TerrainType.ABYSS) {
          const heightRoll = seededRandom();
          if (heightRoll < elevatedChance) {
            terrainHeight = TerrainHeight.ELEVATED;
          } else if (heightRoll < elevatedChance + sunkenChance) {
            terrainHeight = TerrainHeight.SUNKEN;
          }
        }

        tiles[row][col] = {
          type: terrainType,
          height: terrainHeight,
          row,
          col
        };
      }
    }

    // Post-process: ensure clusters and smooth transitions
    this.smoothTerrainClusters(tiles, width, height);

    const layout: TerrainLayout = {
      tiles,
      name: 'Procedural Terrain',
      description: `Generated with seed: ${seed || 'random'}`,
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    this.currentLayoutSubject.next(layout);
    return layout;
  }

  /**
   * Smooth terrain to create more natural-looking clusters.
   * Reduces isolated single tiles by checking neighbors.
   */
  private smoothTerrainClusters(
    tiles: TerrainData[][],
    width: number,
    height: number
  ): void {
    // Make a copy for reference
    const original = tiles.map(row => [...row]);

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const neighbors = this.getNeighbors(original, row, col, width, height);

        // Count neighbor types
        const typeCounts = new Map<TerrainType, number>();
        neighbors.forEach(n => {
          typeCounts.set(n.type, (typeCounts.get(n.type) || 0) + 1);
        });

        // If this tile is isolated (no similar neighbors), consider changing it
        const currentType = original[row][col].type;
        const sameTypeCount = typeCounts.get(currentType) || 0;

        if (sameTypeCount === 0 && neighbors.length > 0) {
          // Find most common neighbor type
          let maxCount = 0;
          let mostCommonType = currentType;

          typeCounts.forEach((count, type) => {
            if (count > maxCount) {
              maxCount = count;
              mostCommonType = type;
            }
          });

          // 50% chance to blend with neighbors
          if (Math.random() < 0.5) {
            tiles[row][col].type = mostCommonType;
          }
        }
      }
    }
  }

  /**
   * Get neighboring tiles (4-directional).
   */
  private getNeighbors(
    tiles: TerrainData[][],
    row: number,
    col: number,
    width: number,
    height: number
  ): TerrainData[] {
    const neighbors: TerrainData[] = [];
    const directions = [
      [-1, 0], // up
      [1, 0],  // down
      [0, -1], // left
      [0, 1]   // right
    ];

    directions.forEach(([dr, dc]) => {
      const newRow = row + dr;
      const newCol = col + dc;

      if (newRow >= 0 && newRow < height && newCol >= 0 && newCol < width) {
        neighbors.push(tiles[newRow][newCol]);
      }
    });

    return neighbors;
  }

  /**
   * Set terrain type at a specific tile (painting tool).
   *
   * @param row Row position
   * @param col Column position
   * @param terrainType New terrain type
   * @returns Operation result
   */
  paintTerrain(row: number, col: number, terrainType: TerrainType): TerrainOperationResult {
    const layout = this.currentLayoutSubject.value;

    if (!layout) {
      return {
        success: false,
        error: 'No active terrain layout'
      };
    }

    if (row < 0 || row >= layout.tiles.length || col < 0 || col >= layout.tiles[0].length) {
      return {
        success: false,
        error: `Invalid coordinates: (${row}, ${col})`
      };
    }

    // Update terrain type
    layout.tiles[row][col].type = terrainType;
    layout.modifiedAt = new Date();

    // Notify observers
    this.currentLayoutSubject.next(layout);

    return {
      success: true,
      message: `Painted ${terrainType} at (${row}, ${col})`
    };
  }

  /**
   * Adjust terrain height at a specific tile.
   *
   * @param row Row position
   * @param col Column position
   * @param heightDelta Amount to raise (+1) or lower (-1)
   * @returns Operation result
   */
  adjustHeight(row: number, col: number, heightDelta: number): TerrainOperationResult {
    const layout = this.currentLayoutSubject.value;

    if (!layout) {
      return {
        success: false,
        error: 'No active terrain layout'
      };
    }

    if (row < 0 || row >= layout.tiles.length || col < 0 || col >= layout.tiles[0].length) {
      return {
        success: false,
        error: `Invalid coordinates: (${row}, ${col})`
      };
    }

    const tile = layout.tiles[row][col];
    const currentHeight = tile.height;

    // Calculate new height
    let newHeight = currentHeight + (heightDelta > 0 ? 0.5 : -0.5);

    // Clamp to valid range
    if (newHeight > TerrainHeight.ELEVATED) {
      newHeight = TerrainHeight.ELEVATED;
    } else if (newHeight < TerrainHeight.SUNKEN) {
      newHeight = TerrainHeight.SUNKEN;
    }

    // Check if height actually changed
    if (newHeight === currentHeight) {
      return {
        success: false,
        message: `Height at (${row}, ${col}) already at limit`
      };
    }

    // Update height
    tile.height = newHeight as TerrainHeight;
    layout.modifiedAt = new Date();

    // Notify observers
    this.currentLayoutSubject.next(layout);

    return {
      success: true,
      message: `Adjusted height to ${newHeight} at (${row}, ${col})`
    };
  }

  /**
   * Get terrain data at a specific position.
   */
  getTerrainAt(row: number, col: number): TerrainData | null {
    const layout = this.currentLayoutSubject.value;

    if (!layout) {
      return null;
    }

    if (row < 0 || row >= layout.tiles.length || col < 0 || col >= layout.tiles[0].length) {
      return null;
    }

    return layout.tiles[row][col];
  }

  /**
   * Get current terrain layout.
   */
  getCurrentLayout(): TerrainLayout | null {
    return this.currentLayoutSubject.value;
  }

  /**
   * Set a terrain layout as active.
   */
  setLayout(layout: TerrainLayout): void {
    this.currentLayoutSubject.next(layout);
    this.saveActiveLayout(layout);
  }

  /**
   * Calculate movement cost between two tiles.
   */
  getMovementCost(fromRow: number, fromCol: number, toRow: number, toCol: number): number {
    const fromTerrain = this.getTerrainAt(fromRow, fromCol);
    const toTerrain = this.getTerrainAt(toRow, toCol);

    if (!fromTerrain || !toTerrain) {
      return Infinity;
    }

    return calculateMovementCost(toTerrain.type, fromTerrain.height, toTerrain.height);
  }

  /**
   * Save current terrain layout.
   */
  saveLayout(name?: string): TerrainOperationResult {
    const layout = this.currentLayoutSubject.value;

    if (!layout) {
      return {
        success: false,
        error: 'No active terrain layout to save'
      };
    }

    if (name) {
      layout.name = name;
    }

    try {
      const savedLayouts = this.loadSavedLayouts();
      savedLayouts.set(layout.name, layout);

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(Array.from(savedLayouts.entries())));

      this.saveActiveLayout(layout);

      return {
        success: true,
        message: `Saved terrain layout: ${layout.name}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to save terrain: ${error}`
      };
    }
  }

  /**
   * Load a saved terrain layout by name.
   */
  loadLayout(name: string): TerrainOperationResult {
    try {
      const savedLayouts = this.loadSavedLayouts();
      const layout = savedLayouts.get(name);

      if (!layout) {
        return {
          success: false,
          error: `Layout not found: ${name}`
        };
      }

      // Reconstruct Date objects
      layout.createdAt = new Date(layout.createdAt);
      layout.modifiedAt = new Date(layout.modifiedAt);

      this.currentLayoutSubject.next(layout);
      this.saveActiveLayout(layout);

      return {
        success: true,
        message: `Loaded terrain layout: ${name}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to load terrain: ${error}`
      };
    }
  }

  /**
   * Get all saved terrain layouts.
   */
  getSavedLayouts(): Map<string, TerrainLayout> {
    return this.loadSavedLayouts();
  }

  /**
   * Delete a saved terrain layout.
   */
  deleteLayout(name: string): TerrainOperationResult {
    try {
      const savedLayouts = this.loadSavedLayouts();

      if (!savedLayouts.has(name)) {
        return {
          success: false,
          error: `Layout not found: ${name}`
        };
      }

      savedLayouts.delete(name);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(Array.from(savedLayouts.entries())));

      return {
        success: true,
        message: `Deleted terrain layout: ${name}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete terrain: ${error}`
      };
    }
  }

  /**
   * Load saved layouts from local storage.
   */
  private loadSavedLayouts(): Map<string, TerrainLayout> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const entries = JSON.parse(stored);
        return new Map(entries);
      }
    } catch (error) {
      console.warn('Failed to load saved terrain layouts:', error);
    }
    return new Map();
  }

  /**
   * Save the active layout to local storage.
   */
  private saveActiveLayout(layout: TerrainLayout): void {
    try {
      localStorage.setItem(this.ACTIVE_LAYOUT_KEY, JSON.stringify(layout));
    } catch (error) {
      console.warn('Failed to save active terrain layout:', error);
    }
  }

  /**
   * Load the active layout from local storage.
   */
  private loadActiveLayout(): void {
    try {
      const stored = localStorage.getItem(this.ACTIVE_LAYOUT_KEY);
      if (stored) {
        const layout = JSON.parse(stored);
        layout.createdAt = new Date(layout.createdAt);
        layout.modifiedAt = new Date(layout.modifiedAt);
        this.currentLayoutSubject.next(layout);
      }
    } catch (error) {
      console.warn('Failed to load active terrain layout:', error);
    }
  }

  /**
   * Export terrain layout as JSON.
   */
  exportLayout(name?: string): string | null {
    const layout = name
      ? this.loadSavedLayouts().get(name)
      : this.currentLayoutSubject.value;

    if (!layout) {
      return null;
    }

    return JSON.stringify(layout, null, 2);
  }

  /**
   * Import terrain layout from JSON.
   */
  importLayout(jsonString: string): TerrainOperationResult {
    try {
      const layout = JSON.parse(jsonString) as TerrainLayout;

      // Validate structure
      if (!layout.tiles || !Array.isArray(layout.tiles) || !layout.name) {
        return {
          success: false,
          error: 'Invalid terrain layout format'
        };
      }

      // Reconstruct Date objects
      layout.createdAt = new Date(layout.createdAt);
      layout.modifiedAt = new Date(layout.modifiedAt);

      // Save to storage
      const savedLayouts = this.loadSavedLayouts();
      savedLayouts.set(layout.name, layout);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(Array.from(savedLayouts.entries())));

      return {
        success: true,
        message: `Imported terrain layout: ${layout.name}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to import terrain: ${error}`
      };
    }
  }
}
