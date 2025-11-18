import { Injectable } from '@angular/core';

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
  data: any; // The actual grid state from TerrainGrid.exportState()
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
   * @returns The saved map ID
   */
  public saveMap(name: string, data: any, id?: string): string {
    const mapId = id || this.generateMapId();
    const now = Date.now();

    const metadata: MapMetadata = {
      id: mapId,
      name: name,
      createdAt: id ? this.getMapMetadata(id)?.createdAt || now : now,
      updatedAt: now,
      version: data.version || '1.0.0',
      gridSize: data.gridSize,
      description: data.description
    };

    const savedMap: SavedMap = {
      metadata: metadata,
      data: data
    };

    // Save the map data
    localStorage.setItem(this.STORAGE_PREFIX + mapId, JSON.stringify(savedMap));

    // Update metadata index
    this.updateMetadataIndex(metadata);

    // Set as current map
    this.setCurrentMapId(mapId);

    console.log(`Map "${name}" saved with ID: ${mapId}`);
    return mapId;
  }

  /**
   * Load a map by ID
   * @param id Map ID
   * @returns The map data or null if not found
   */
  public loadMap(id: string): any | null {
    const key = this.STORAGE_PREFIX + id;
    const json = localStorage.getItem(key);

    if (!json) {
      console.warn(`Map with ID "${id}" not found`);
      return null;
    }

    try {
      const savedMap: SavedMap = JSON.parse(json);
      this.setCurrentMapId(id);
      console.log(`Map "${savedMap.metadata.name}" loaded`);
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
      return JSON.parse(json);
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
    localStorage.setItem(this.METADATA_KEY, JSON.stringify(filtered));

    // Clear current map if it was this one
    if (this.getCurrentMapId() === id) {
      localStorage.removeItem(this.CURRENT_MAP_KEY);
    }

    console.log(`Map with ID "${id}" deleted`);
    return true;
  }

  /**
   * Get the current map ID
   * @returns Current map ID or null
   */
  public getCurrentMapId(): string | null {
    return localStorage.getItem(this.CURRENT_MAP_KEY);
  }

  /**
   * Load the current map
   * @returns Current map data or null
   */
  public loadCurrentMap(): any | null {
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
      this.saveMap('Imported Map', data);
      // Remove old key
      localStorage.removeItem(oldKey);
      console.log('Migrated old map format to new system');
      return true;
    } catch (e) {
      console.error('Failed to migrate old map:', e);
      return false;
    }
  }

  /**
   * Export map to JSON file (for future download feature)
   * @param id Map ID
   * @returns JSON string or null
   */
  public exportMapToJson(id: string): string | null {
    const key = this.STORAGE_PREFIX + id;
    const json = localStorage.getItem(key);
    return json;
  }

  /**
   * Import map from JSON string (for future upload feature)
   * @param json JSON string
   * @param name Optional name override
   * @returns Imported map ID or null
   */
  public importMapFromJson(json: string, name?: string): string | null {
    try {
      const savedMap: SavedMap = JSON.parse(json);
      const mapName = name || savedMap.metadata.name || 'Imported Map';
      return this.saveMap(mapName, savedMap.data);
    } catch (e) {
      console.error('Failed to import map:', e);
      return null;
    }
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
    console.log('All maps cleared');
  }

  // Private helper methods

  private generateMapId(): string {
    return 'map_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private setCurrentMapId(id: string): void {
    localStorage.setItem(this.CURRENT_MAP_KEY, id);
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

    localStorage.setItem(this.METADATA_KEY, JSON.stringify(maps));
  }
}
