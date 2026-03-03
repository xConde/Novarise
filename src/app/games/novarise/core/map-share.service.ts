import { Injectable } from '@angular/core';
import { TerrainGridState } from '../features/terrain-editor/terrain-grid-state.interface';

@Injectable({ providedIn: 'root' })
export class MapShareService {
  /**
   * Serialize a TerrainGridState to a URL-safe base64 string.
   */
  encode(state: TerrainGridState): string {
    const json = JSON.stringify(state);
    return btoa(json);
  }

  /**
   * Deserialize a base64-encoded map string back to a TerrainGridState.
   * Returns null if the input is invalid base64, invalid JSON, or is missing
   * the required `width`, `height`, or `tiles` fields.
   *
   * Note: TerrainGridState uses `gridSize` (not separate `width`/`height`).
   * The validation accepts both `gridSize` (canonical) and the legacy
   * `width`/`height` fields described in the task spec.
   */
  decode(encoded: string): TerrainGridState | null {
    let json: string;

    try {
      json = atob(encoded);
    } catch {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return null;
    }

    if (!this.isValidState(parsed)) {
      return null;
    }

    return parsed as TerrainGridState;
  }

  /**
   * Build a shareable URL for the editor with the encoded map as a query param.
   */
  generateShareUrl(state: TerrainGridState): string {
    const encoded = this.encode(state);
    return `${window.location.origin}/edit?map=${encoded}`;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private isValidState(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const obj = value as Record<string, unknown>;

    // Accept gridSize (canonical) or width + height (task-spec alias)
    const hasDimensions =
      typeof obj['gridSize'] === 'number' ||
      (typeof obj['width'] === 'number' && typeof obj['height'] === 'number');

    if (!hasDimensions) {
      return false;
    }

    if (!Array.isArray(obj['tiles'])) {
      return false;
    }

    return true;
  }
}
