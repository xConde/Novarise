import { Injectable } from '@angular/core';
import { TerrainGridState } from '../features/terrain-editor/terrain-grid-state.interface';
import {
  CURRENT_SCHEMA_VERSION,
  migrateMap,
  validateMapData
} from './map-schema';
import { StorageService } from '../../../core/services/storage.service';
import { MapBridgeService } from '../../../core/services/map-bridge.service';

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

  constructor(
    private storageService: StorageService,
    private mapBridge: MapBridgeService
  ) {}

  /**
   * Save a map with metadata
   * @param name Map name
   * @param data Grid state data
   * @param id Optional ID (generates new if not provided)
   * @returns The saved map ID
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

    const dataWithVersion: TerrainGridState = {
      ...data,
      schemaVersion: CURRENT_SCHEMA_VERSION
    };

    const validation = validateMapData(dataWithVersion as unknown as Record<string, unknown>);
    if (!validation.valid) {
      console.error('Cannot save invalid map:', validation.errors.join('; '));
      return null;
    }

    const savedMap: SavedMap = {
      metadata: metadata,
      data: dataWithVersion
    };

    // Save the map data
    if (!this.storageService.setJSON(this.STORAGE_PREFIX + mapId, savedMap)) {
      console.error('Failed to save map — localStorage may be full or unavailable');
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
    const savedMap = this.storageService.getJSON<SavedMap | null>(key, null);

    if (!savedMap) {
      console.warn(`Map with ID "${id}" not found`);
      return null;
    }

    const rawData = savedMap.data as unknown as Record<string, unknown>;
    const migrated = migrateMap(rawData);

    if (!migrated) {
      console.error(`Failed to migrate map "${id}" — data may be corrupted or from a newer version`);
      return null;
    }

    const postMigrateValidation = validateMapData(migrated);
    if (!postMigrateValidation.valid) {
      console.error(`Migrated map "${id}" failed validation:`, postMigrateValidation.errors.join('; '));
      return null;
    }

    const migratedData = migrated as unknown as TerrainGridState;

    // Re-save to localStorage if the schema was upgraded so future loads are fast
    if ((rawData['schemaVersion'] as number | undefined) !== CURRENT_SCHEMA_VERSION) {
      const upgradedMap: SavedMap = { metadata: savedMap.metadata, data: migratedData };
      if (!this.storageService.setJSON(key, upgradedMap)) {
        console.warn('Failed to persist migrated map data');
      }
    }

    this.setCurrentMapId(id);
    return migratedData;
  }

  /**
   * Get all saved maps metadata
   * @returns Array of map metadata
   */
  public getAllMaps(): MapMetadata[] {
    return this.storageService.getJSON<MapMetadata[]>(this.METADATA_KEY, []);
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
    if (!this.storageService.remove(key)) {
      return false;
    }

    // Remove from metadata index
    const maps = this.getAllMaps();
    const filtered = maps.filter(m => m.id !== id);
    if (!this.storageService.setJSON(this.METADATA_KEY, filtered)) {
      console.error('Failed to update metadata index');
    }

    // Clear current map if it was this one
    if (this.getCurrentMapId() === id) {
      this.storageService.remove(this.CURRENT_MAP_KEY);
    }

    // Clear bridge state if the deleted map was loaded
    if (this.mapBridge.getMapId() === id) {
      this.mapBridge.clearEditorMap();
    }

    return true;
  }

  /**
   * Get the current map ID
   * @returns Current map ID or null
   */
  public getCurrentMapId(): string | null {
    return this.storageService.getString(this.CURRENT_MAP_KEY);
  }

  public clearCurrentMapId(): void {
    this.storageService.remove(this.CURRENT_MAP_KEY);
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
    const oldData = this.storageService.getJSON<TerrainGridState | null>(oldKey, null);

    if (!oldData) {
      return false;
    }

    // Save as "Imported Map" in new format
    this.saveMap('Imported Map', oldData);
    // Remove old key
    this.storageService.remove(oldKey);
    return true;
  }

  /**
   * Export map to JSON string
   * @param id Map ID
   * @returns JSON string or null
   */
  public exportMapToJson(id: string): string | null {
    return this.storageService.getString(this.STORAGE_PREFIX + id);
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

      const rawData = savedMap.data as unknown as Record<string, unknown>;

      // Migrate to current schema version first (handles v1 field renames)
      const migrated = migrateMap(rawData);
      if (!migrated) {
        console.error('Failed to migrate imported map data');
        return null;
      }

      // Validate the migrated structure
      const validation = validateMapData(migrated);
      if (!validation.valid) {
        console.error('Invalid map data structure:', validation.errors.join('; '));
        return null;
      }

      const mapName = name || savedMap.metadata?.name || 'Imported Map';
      return this.saveMap(mapName, migrated as unknown as TerrainGridState);
    } catch (e) {
      console.error('Failed to import map:', e);
      return null;
    }
  }

  /**
   * Validate JSON string is a valid Novarise map
   * @param json JSON string to validate
   * @returns Validation result with map name if valid
   */
  public validateMapJson(json: string): { valid: boolean; name?: string; error?: string } {
    try {
      const savedMap: SavedMap = JSON.parse(json);

      // Check for required top-level field
      if (!savedMap.data) {
        return { valid: false, error: 'Missing map data' };
      }

      const rawData = savedMap.data as unknown as Record<string, unknown>;

      // Legacy checks preserved for backward compat with existing error message contract
      if (typeof rawData['gridSize'] !== 'number') {
        return { valid: false, error: 'Invalid or missing grid size' };
      }

      if (!rawData['tiles'] || !Array.isArray(rawData['tiles'])) {
        return { valid: false, error: 'Invalid or missing tiles data' };
      }

      // Run full validation for richer checks
      const result = validateMapData(rawData);
      if (!result.valid) {
        return { valid: false, error: result.errors[0] };
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
   * Create a file input and handle file selection for import
   * @returns Promise that resolves with the imported map ID and an error code on failure
   */
  public promptFileImport(): Promise<{ mapId: string | null; errorCode: 'file_too_large' | 'invalid_json' | 'invalid_schema' | 'general' | null }> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.novarise.json';

      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve({ mapId: null, errorCode: null });
          return;
        }

        // Guard against oversized files — prevent OOM during JSON.parse
        const MAX_MAP_FILE_BYTES = 512 * 1024; // 512 KB
        if (file.size > MAX_MAP_FILE_BYTES) {
          console.error(`Map file too large: ${file.size} bytes (max ${MAX_MAP_FILE_BYTES})`);
          resolve({ mapId: null, errorCode: 'file_too_large' });
          return;
        }

        try {
          const json = await file.text();

          let parsedOk = true;
          try { JSON.parse(json); } catch { parsedOk = false; }
          if (!parsedOk) {
            console.error('Invalid map file: not valid JSON');
            resolve({ mapId: null, errorCode: 'invalid_json' });
            return;
          }

          const validation = this.validateMapJson(json);
          if (!validation.valid) {
            console.error('Invalid map file:', validation.error);
            resolve({ mapId: null, errorCode: 'invalid_schema' });
            return;
          }

          const mapId = this.importMapFromJson(json);
          resolve({ mapId, errorCode: null });
        } catch (e) {
          console.error('Failed to read file:', e);
          resolve({ mapId: null, errorCode: 'general' });
        }
      };

      input.oncancel = () => {
        resolve({ mapId: null, errorCode: null });
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
      this.storageService.remove(this.STORAGE_PREFIX + map.id);
    });
    this.storageService.remove(this.METADATA_KEY);
    this.storageService.remove(this.CURRENT_MAP_KEY);
  }

  // Private helper methods

  private generateMapId(): string {
    return 'map_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
  }

  private setCurrentMapId(id: string): void {
    if (!this.storageService.setString(this.CURRENT_MAP_KEY, id)) {
      console.error('Failed to set current map ID');
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

    if (!this.storageService.setJSON(this.METADATA_KEY, maps)) {
      console.error('Failed to update metadata index');
    }
  }
}
