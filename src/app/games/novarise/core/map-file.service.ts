import { Injectable } from '@angular/core';
import { MapStorageService } from '../../../core/services/map-storage.service';
import { MapTemplateService } from '../../../core/services/map-template.service';
import { MapTemplate } from '../../../core/models/map-template.model';
import { EditorNotificationService } from './editor-notification.service';
import { EditorStateService } from './editor-state.service';
import { TerrainGrid } from '../features/terrain-editor/terrain-grid.class';
import { TerrainGridState } from '../features/terrain-editor/terrain-grid-state.interface';
import {
  EDITOR_AUTOSAVE_DRAFT_KEY,
  EDITOR_AUTOSAVE_INTERVAL_MS,
} from '../constants/editor-ui.constants';

/**
 * Handles all file I/O and autosave logic for the map editor:
 * save, load, template loading, export/import, and draft autosave.
 *
 * Does NOT handle:
 * - Modal UI (stays in component)
 * - Three.js scene / terrain rendering (stays in component / TerrainGrid)
 * - Navigation / router calls (stays in component)
 */
@Injectable()
export class MapFileService {
  private terrainGrid!: TerrainGrid;
  private autosaveInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private mapStorage: MapStorageService,
    private mapTemplateService: MapTemplateService,
    private editorNotification: EditorNotificationService,
    private editorState: EditorStateService,
  ) {}

  /** Call once after TerrainGrid is initialized (ngAfterViewInit). */
  setTerrainGrid(grid: TerrainGrid): void {
    this.terrainGrid = grid;
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  /**
   * Save the current grid state under the given name.
   * Updates currentMapName in EditorStateService on success.
   * Shows success / error notification.
   * Returns true on success.
   */
  save(name: string): boolean {
    const state = this.terrainGrid.exportState();
    const currentId = this.mapStorage.getCurrentMapId();
    const savedId = this.mapStorage.saveMap(name, state, currentId || undefined);

    if (!savedId) {
      this.editorNotification.show('Storage full — delete unused maps to free space.', 'error');
      return false;
    }

    this.editorState.setCurrentMapName(name);
    this.clearDraft();
    this.editorNotification.show(`Map "${name}" saved successfully!`, 'success');
    return true;
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  /**
   * Load a saved map by name.  The caller is responsible for updating
   * Three.js markers and running path validation after this returns true.
   * Returns the TerrainGridState so the component can call importState().
   * Returns null on failure (shows error notification).
   */
  load(mapName: string): TerrainGridState | null {
    const maps = this.mapStorage.getAllMaps();
    const found = maps.find(m => m.name === mapName);

    if (!found) {
      this.editorNotification.show('Map not found.', 'error');
      return null;
    }

    const state = this.mapStorage.loadMap(found.id);
    if (!state) {
      this.editorNotification.show('Failed to load map.', 'error');
      return null;
    }

    this.editorState.setCurrentMapName(found.name);
    this.clearDraft();
    this.editorNotification.show(`Map "${found.name}" loaded successfully!`, 'success');
    return state;
  }

  /**
   * Load a saved map by its storage ID directly.
   * Returns the state on success, null on failure.
   */
  loadById(mapId: string): TerrainGridState | null {
    const state = this.mapStorage.loadMap(mapId);
    if (!state) {
      this.editorNotification.show('Failed to load map.', 'error');
      return null;
    }

    const metadata = this.mapStorage.getMapMetadata(mapId);
    if (metadata) {
      this.editorState.setCurrentMapName(metadata.name);
    }
    this.clearDraft();
    this.editorNotification.show(`Map "${this.editorState.getCurrentMapName()}" loaded successfully!`, 'success');
    return state;
  }

  /**
   * Load the currently-active map from storage (the one whose ID is persisted).
   * Returns state on success, null if no current map is set.
   * Does NOT show a notification — silent load on init.
   */
  loadCurrent(): TerrainGridState | null {
    const state = this.mapStorage.loadCurrentMap();
    if (!state) return null;

    const currentId = this.mapStorage.getCurrentMapId();
    if (currentId) {
      const metadata = this.mapStorage.getMapMetadata(currentId);
      if (metadata) {
        this.editorState.setCurrentMapName(metadata.name);
      }
    }
    return state;
  }

  /**
   * Get all saved map metadata for display in load UI.
   */
  getAllMaps() {
    return this.mapStorage.getAllMaps();
  }

  // ── Template ───────────────────────────────────────────────────────────────

  /**
   * Load a map template by its ID.
   * Returns the state on success, null on failure.
   * Does NOT show a notification — caller decides messaging.
   */
  loadTemplate(template: MapTemplate): TerrainGridState | null {
    const state = this.mapTemplateService.loadTemplate(template.id);
    if (!state) return null;
    return state;
  }

  // ── Export / Import ────────────────────────────────────────────────────────

  /**
   * Trigger a JSON file download of the current saved map.
   * Requires a map to have been saved first.
   */
  exportAsJson(): void {
    const currentId = this.mapStorage.getCurrentMapId();
    if (!currentId) {
      this.editorNotification.show('No map to export. Save a map first (G key).', 'error');
      return;
    }

    const success = this.mapStorage.downloadMapAsFile(currentId);
    if (!success) {
      this.editorNotification.show('Failed to export map.', 'error');
    }
  }

  /**
   * Import a map from a File object selected by the user.
   * Returns the loaded state on success, null on failure.
   * Shows appropriate error notification on failure.
   * Caller is responsible for clearing edit history.
   */
  async importFromJson(file: File): Promise<TerrainGridState | null> {
    const { mapId, errorCode } = await this.mapStorage.promptFileImport();

    if (mapId) {
      const state = this.mapStorage.loadMap(mapId);
      if (state) {
        const metadata = this.mapStorage.getMapMetadata(mapId);
        if (metadata) {
          this.editorState.setCurrentMapName(metadata.name);
        }
        this.editorNotification.show(`Map "${this.editorState.getCurrentMapName()}" imported successfully!`, 'success');
        return state;
      }
    }

    if (errorCode) {
      const importErrorMessages: Record<string, string> = {
        file_too_large: 'Map file is too large (max 512KB). Try a smaller map.',
        invalid_json: 'Map file is corrupted or not a valid Novarise map.',
        invalid_schema: 'Map file format is not recognized. It may be from a different version.',
        general: 'Failed to import map. Please try a different file.',
      };
      this.editorNotification.show(
        importErrorMessages[errorCode] ?? importErrorMessages['general'],
        'error'
      );
    }

    return null;
  }

  // ── Autosave draft ─────────────────────────────────────────────────────────

  /**
   * Start the periodic autosave timer.
   * Safe to call multiple times — will not create duplicate timers.
   */
  startAutosave(): void {
    if (this.autosaveInterval !== null) return;
    this.autosaveInterval = setInterval(() => {
      this.saveDraft();
    }, EDITOR_AUTOSAVE_INTERVAL_MS);
  }

  /** Stop the periodic autosave timer. */
  stopAutosave(): void {
    if (this.autosaveInterval !== null) {
      clearInterval(this.autosaveInterval);
      this.autosaveInterval = null;
    }
  }

  /** Write the current grid state to the draft slot. Silently fails on quota. */
  saveDraft(): void {
    if (!this.terrainGrid) return;
    const state = this.terrainGrid.exportState();
    try {
      localStorage.setItem(EDITOR_AUTOSAVE_DRAFT_KEY, JSON.stringify(state));
    } catch {
      // Quota exceeded — editing must not be disrupted
    }
  }

  /** Remove the draft from localStorage. */
  clearDraft(): void {
    localStorage.removeItem(EDITOR_AUTOSAVE_DRAFT_KEY);
  }

  /** Read and parse the draft. Returns null if absent or malformed. */
  loadDraft(): TerrainGridState | null {
    const raw = localStorage.getItem(EDITOR_AUTOSAVE_DRAFT_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TerrainGridState;
    } catch {
      return null;
    }
  }
}
