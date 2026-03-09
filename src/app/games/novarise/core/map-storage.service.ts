import { Injectable } from '@angular/core';
import { TerrainGridState, TerrainGridStateLegacy } from '../features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../models/terrain-types.enum';

const MIN_GRID_SIZE = 5;
const MAX_GRID_SIZE = 30;
const MAX_SPAWN_POINTS = 4;
const MAX_EXIT_POINTS = 4;

const VALID_TERRAIN_VALUES = new Set<string>(Object.values(TerrainType));

/** Maximum file size for map imports (10 MB). */
const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

export interface MapMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  version: string;
  gridSize: number;
  description?: string;
}

export interface SavedMap {
  metadata: MapMetadata;
  data: TerrainGridState;
}

@Injectable({
  providedIn: 'root'
})
export class MapStorageService {
  private readonly STORAGE_PREFIX = 'novarise_map_';
  private readonly METADATA_KEY = 'novarise_maps_metadata';
  private readonly CURRENT_MAP_KEY = 'novarise_current_map';

  constructor() {}

  /**
   * Save a map with metadata
   * @param name Map name
   * @param data Grid state data
   * @param id Optional ID (generates new if not provided)
   * @returns The saved map ID, or null if the save failed (e.g. quota exceeded)
   */
  public saveMap(name: string, data: TerrainGridState, id?: string): string | null {
    const mapId = id || this.generateMapId();
    const now = Date.now();

    const metadata: MapMetadata = {
      id: mapId,
      name: name,
      createdAt: id ? this.getMapMetadata(id)?.createdAt || now : now,
      updatedAt: now,
      version: data.version || '1.0.0',
      gridSize: data.gridSize
    };

    const savedMap: SavedMap = {
      metadata: metadata,
      data: data
    };

    // Save the map data
    try {
      localStorage.setItem(this.STORAGE_PREFIX + mapId, JSON.stringify(savedMap));
    } catch (e) {
      if (this.isQuotaError(e)) {
        console.warn('localStorage quota exceeded — cannot save map. Free space by deleting unused maps.');
      } else {
        console.error('Failed to save map — localStorage may be unavailable:', e);
      }
      return null;
    }

    // Update metadata index
    this.updateMetadataIndex(metadata);

    // Set as current map
    this.setCurrentMapId(mapId);

    return mapId;
  }

  /**
   * Load a map by ID
   * @param id Map ID
   * @returns The map data or null if not found
   */
  public loadMap(id: string): TerrainGridState | null {
    const key = this.STORAGE_PREFIX + id;
    const json = localStorage.getItem(key);

    if (!json) {
      console.warn(`Map with ID "${id}" not found`);
      return null;
    }

    try {
      const savedMap: SavedMap = JSON.parse(json);
      if (!savedMap.data) {
        console.warn(`Map "${id}" has no data field — treating as missing`);
        return null;
      }
      this.setCurrentMapId(id);
      return savedMap.data;
    } catch (e) {
      console.error('Failed to parse map data:', e);
      return null;
    }
  }

  /**
   * Get all saved maps metadata
   * @returns Array of map metadata
   */
  public getAllMaps(): MapMetadata[] {
    const json = localStorage.getItem(this.METADATA_KEY);
    if (!json) return [];

    try {
      const parsed: unknown = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        console.warn('Maps metadata is not an array — resetting to empty');
        return [];
      }
      return parsed as MapMetadata[];
    } catch (e) {
      console.error('Failed to parse maps metadata:', e);
      return [];
    }
  }

  /**
   * Get metadata for a specific map
   * @param id Map ID
   * @returns Map metadata or null if not found
   */
  public getMapMetadata(id: string): MapMetadata | null {
    const maps = this.getAllMaps();
    return maps.find(m => m.id === id) || null;
  }

  /**
   * Delete a map
   * @param id Map ID
   * @returns true if deleted, false if not found
   */
  public deleteMap(id: string): boolean {
    const key = this.STORAGE_PREFIX + id;
    const item = localStorage.getItem(key);

    if (!item) {
      return false;
    }

    // Remove from storage
    localStorage.removeItem(key);

    // Remove from metadata index
    const maps = this.getAllMaps();
    const filtered = maps.filter(m => m.id !== id);
    try {
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(filtered));
    } catch (e) {
      if (this.isQuotaError(e)) {
        console.warn('localStorage quota exceeded while updating metadata index after deletion.');
      } else {
        console.error('Failed to update metadata index:', e);
      }
    }

    // Clear current map if it was this one
    if (this.getCurrentMapId() === id) {
      localStorage.removeItem(this.CURRENT_MAP_KEY);
    }

    return true;
  }

  /**
   * Get the current map ID
   * @returns Current map ID or null
   */
  public getCurrentMapId(): string | null {
    return localStorage.getItem(this.CURRENT_MAP_KEY);
  }

  public clearCurrentMapId(): void {
    localStorage.removeItem(this.CURRENT_MAP_KEY);
  }

  /**
   * Load the current map
   * @returns Current map data or null
   */
  public loadCurrentMap(): TerrainGridState | null {
    const currentId = this.getCurrentMapId();
    if (!currentId) {
      return null;
    }
    return this.loadMap(currentId);
  }

  /**
   * Migrate old single-map format to new format
   * @returns true if migration occurred
   */
  public migrateOldFormat(): boolean {
    const oldKey = 'novarise_terrain';
    const oldData = localStorage.getItem(oldKey);

    if (!oldData) {
      return false;
    }

    try {
      const data = JSON.parse(oldData);
      // Save as "Imported Map" in new format
      const mapId = this.saveMap('Imported Map', data);
      if (!mapId) {
        return false;
      }
      // Remove old key only after successful save
      localStorage.removeItem(oldKey);
      return true;
    } catch (e) {
      console.error('Failed to migrate old map:', e);
      return false;
    }
  }

  /**
   * Export map to JSON string
   * @param id Map ID
   * @returns JSON string or null
   */
  public exportMapToJson(id: string): string | null {
    const key = this.STORAGE_PREFIX + id;
    const json = localStorage.getItem(key);
    return json;
  }

  /**
   * Download map as a .novarise.json file
   * @param id Map ID
   * @returns true if download started, false if map not found
   */
  public downloadMapAsFile(id: string): boolean {
    const json = this.exportMapToJson(id);
    if (!json) {
      return false;
    }

    const metadata = this.getMapMetadata(id);
    const filename = this.sanitizeFilename(metadata?.name || 'map') + '.novarise.json';

    // Create blob and download link
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);

    return true;
  }

  /**
   * Import map from JSON string
   * @param json JSON string
   * @param name Optional name override
   * @returns Imported map ID or null
   */
  public importMapFromJson(json: string, name?: string): string | null {
    try {
      const savedMap: SavedMap = JSON.parse(json);

      // Validate the imported data structure
      if (!savedMap.data || typeof savedMap.data.gridSize !== 'number') {
        console.error('Invalid map data structure');
        return null;
      }

      const mapName = name || savedMap.metadata?.name || 'Imported Map';
      const mapId = this.saveMap(mapName, savedMap.data);

      if (!mapId) {
        return null;
      }

      return mapId;
    } catch (e) {
      console.error('Failed to import map:', e);
      return null;
    }
  }

  /**
   * Validate JSON string is a valid Novarise map.
   * Performs structural validation: grid bounds, tile dimensions, terrain types,
   * spawn/exit point coordinates and counts.
   * @param json JSON string to validate
   * @returns Validation result with map name if valid
   */
  public validateMapJson(json: string): { valid: boolean; name?: string; error?: string } {
    try {
      const savedMap: SavedMap = JSON.parse(json);

      // Check for required fields
      if (!savedMap.data) {
        return { valid: false, error: 'Missing map data' };
      }

      if (typeof savedMap.data.gridSize !== 'number') {
        return { valid: false, error: 'Invalid or missing grid size' };
      }

      const gridSize = savedMap.data.gridSize;

      if (gridSize < MIN_GRID_SIZE || gridSize > MAX_GRID_SIZE) {
        return { valid: false, error: `Grid size must be between ${MIN_GRID_SIZE} and ${MAX_GRID_SIZE}, got ${gridSize}` };
      }

      if (!savedMap.data.tiles || !Array.isArray(savedMap.data.tiles)) {
        return { valid: false, error: 'Invalid or missing tiles data' };
      }

      // Validate tile array dimensions
      if (savedMap.data.tiles.length !== gridSize) {
        return { valid: false, error: `Tiles array length (${savedMap.data.tiles.length}) does not match gridSize (${gridSize})` };
      }

      for (let x = 0; x < gridSize; x++) {
        const column = savedMap.data.tiles[x];
        if (!Array.isArray(column)) {
          return { valid: false, error: `Tiles column ${x} is not an array` };
        }
        if (column.length !== gridSize) {
          return { valid: false, error: `Tiles column ${x} has length ${column.length}, expected ${gridSize}` };
        }
        for (let z = 0; z < gridSize; z++) {
          if (!VALID_TERRAIN_VALUES.has(column[z])) {
            return { valid: false, error: `Invalid terrain type "${column[z]}" at tile [${x}][${z}]` };
          }
        }
      }

      // Validate spawn/exit points (v2 format: arrays)
      const legacy = savedMap.data as unknown as TerrainGridStateLegacy;
      const hasV2Spawn = Array.isArray(savedMap.data.spawnPoints);
      const hasV2Exit = Array.isArray(savedMap.data.exitPoints);
      const hasV1Spawn = !hasV2Spawn && legacy.spawnPoint != null;
      const hasV1Exit = !hasV2Exit && legacy.exitPoint != null;

      // Validate spawn points
      if (hasV2Spawn) {
        if (savedMap.data.spawnPoints.length > MAX_SPAWN_POINTS) {
          return { valid: false, error: `Too many spawn points (${savedMap.data.spawnPoints.length}), maximum is ${MAX_SPAWN_POINTS}` };
        }
        for (const sp of savedMap.data.spawnPoints) {
          if (typeof sp.x !== 'number' || typeof sp.z !== 'number' ||
              sp.x < 0 || sp.x >= gridSize || sp.z < 0 || sp.z >= gridSize) {
            return { valid: false, error: `Spawn point (${sp.x}, ${sp.z}) is out of bounds [0, ${gridSize})` };
          }
        }
      } else if (hasV1Spawn) {
        const sp = legacy.spawnPoint!;
        if (typeof sp.x !== 'number' || typeof sp.z !== 'number' ||
            sp.x < 0 || sp.x >= gridSize || sp.z < 0 || sp.z >= gridSize) {
          return { valid: false, error: `Spawn point (${sp.x}, ${sp.z}) is out of bounds [0, ${gridSize})` };
        }
      }

      // Validate exit points
      if (hasV2Exit) {
        if (savedMap.data.exitPoints.length > MAX_EXIT_POINTS) {
          return { valid: false, error: `Too many exit points (${savedMap.data.exitPoints.length}), maximum is ${MAX_EXIT_POINTS}` };
        }
        for (const ep of savedMap.data.exitPoints) {
          if (typeof ep.x !== 'number' || typeof ep.z !== 'number' ||
              ep.x < 0 || ep.x >= gridSize || ep.z < 0 || ep.z >= gridSize) {
            return { valid: false, error: `Exit point (${ep.x}, ${ep.z}) is out of bounds [0, ${gridSize})` };
          }
        }
      } else if (hasV1Exit) {
        const ep = legacy.exitPoint!;
        if (typeof ep.x !== 'number' || typeof ep.z !== 'number' ||
            ep.x < 0 || ep.x >= gridSize || ep.z < 0 || ep.z >= gridSize) {
          return { valid: false, error: `Exit point (${ep.x}, ${ep.z}) is out of bounds [0, ${gridSize})` };
        }
      }

      return {
        valid: true,
        name: savedMap.metadata?.name || 'Unnamed Map'
      };
    } catch (e) {
      return { valid: false, error: 'Invalid JSON format' };
    }
  }

  /**
   * Validate that a map is ready for gameplay (not just structurally valid).
   * Checks for spawn/exit presence, coordinate validity, and tile dimensions.
   * @param state TerrainGridState to validate
   * @returns Playability result with error message if not playable
   */
  public validateMapPlayability(state: TerrainGridState): { playable: boolean; error?: string } {
    if (!state) {
      return { playable: false, error: 'Map data is missing' };
    }

    if (typeof state.gridSize !== 'number' || state.gridSize < MIN_GRID_SIZE || state.gridSize > MAX_GRID_SIZE) {
      return { playable: false, error: `Invalid grid size: ${state.gridSize}` };
    }

    if (!Array.isArray(state.tiles) || state.tiles.length !== state.gridSize) {
      return { playable: false, error: 'Tiles array is missing or incorrectly dimensioned' };
    }

    // Resolve spawn/exit with legacy fallback
    const legacy = state as unknown as TerrainGridStateLegacy;
    const spawnPoints = (Array.isArray(state.spawnPoints) && state.spawnPoints.length > 0)
      ? state.spawnPoints
      : (legacy.spawnPoint ? [legacy.spawnPoint] : []);
    const exitPoints = (Array.isArray(state.exitPoints) && state.exitPoints.length > 0)
      ? state.exitPoints
      : (legacy.exitPoint ? [legacy.exitPoint] : []);

    if (spawnPoints.length === 0) {
      return { playable: false, error: 'Map has no spawn points' };
    }

    if (exitPoints.length === 0) {
      return { playable: false, error: 'Map has no exit points' };
    }

    // Check spawn != exit (all combinations)
    for (const sp of spawnPoints) {
      for (const ep of exitPoints) {
        if (sp.x === ep.x && sp.z === ep.z) {
          return { playable: false, error: `Spawn and exit overlap at (${sp.x}, ${sp.z})` };
        }
      }
    }

    return { playable: true };
  }

  /**
   * Create a file input and handle file selection for import
   * @returns Promise that resolves with imported map ID or null
   */
  public promptFileImport(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.novarise.json';

      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        if (file.size > MAX_IMPORT_FILE_SIZE) {
          console.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_IMPORT_FILE_SIZE / 1024 / 1024} MB.`);
          resolve(null);
          return;
        }

        try {
          const json = await file.text();
          const validation = this.validateMapJson(json);

          if (!validation.valid) {
            console.error('Invalid map file:', validation.error);
            resolve(null);
            return;
          }

          const mapId = this.importMapFromJson(json);
          resolve(mapId);
        } catch (e) {
          console.error('Failed to read file:', e);
          resolve(null);
        }
      };

      input.oncancel = () => {
        resolve(null);
      };

      input.click();
    });
  }

  /**
   * Sanitize a string for use as a filename
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
      .replace(/\s+/g, '_')          // Replace spaces with underscores
      .substring(0, 50);             // Limit length
  }

  /**
   * Clear all maps (use with caution!)
   */
  public clearAllMaps(): void {
    const maps = this.getAllMaps();
    maps.forEach(map => {
      localStorage.removeItem(this.STORAGE_PREFIX + map.id);
    });
    localStorage.removeItem(this.METADATA_KEY);
    localStorage.removeItem(this.CURRENT_MAP_KEY);
  }

  // Private helper methods

  private generateMapId(): string {
    return 'map_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
  }

  private setCurrentMapId(id: string): void {
    try {
      localStorage.setItem(this.CURRENT_MAP_KEY, id);
    } catch (e) {
      if (this.isQuotaError(e)) {
        console.warn('localStorage quota exceeded while setting current map ID.');
      } else {
        console.error('Failed to set current map ID:', e);
      }
    }
  }

  private updateMetadataIndex(metadata: MapMetadata): void {
    const maps = this.getAllMaps();
    const existingIndex = maps.findIndex(m => m.id === metadata.id);

    if (existingIndex !== -1) {
      // Update existing
      maps[existingIndex] = metadata;
    } else {
      // Add new
      maps.push(metadata);
    }

    // Sort by updated date (most recent first)
    maps.sort((a, b) => b.updatedAt - a.updatedAt);

    try {
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(maps));
    } catch (e) {
      if (this.isQuotaError(e)) {
        console.warn('localStorage quota exceeded while updating metadata index.');
      } else {
        console.error('Failed to update metadata index:', e);
      }
    }
  }

  /**
   * Detect whether an error is a localStorage QuotaExceededError.
   * Checks both the standard name property and the legacy code property.
   */
  private isQuotaError(e: unknown): boolean {
    if (e instanceof DOMException) {
      return e.name === 'QuotaExceededError' || e.code === 22;
    }
    return false;
  }
}
