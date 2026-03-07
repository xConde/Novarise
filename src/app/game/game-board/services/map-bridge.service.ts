import { Injectable } from '@angular/core';
import { BlockType, GameBoardTile } from '../models/game-board-tile';
import { TerrainGridState, TerrainGridStateLegacy } from '../../../games/novarise/features/terrain-editor/terrain-grid-state.interface';

/** @deprecated Use TerrainGridState directly. Kept as alias for backward compatibility. */
export type EditorMapState = TerrainGridState;

export interface ConvertedBoard {
  board: GameBoardTile[][];
  width: number;
  height: number;
}

/**
 * Bridges the map editor's TerrainGrid state to the game's GameBoardTile[][] format.
 *
 * Coordinate systems:
 * - Editor: tiles[x][z] where x = column, z = row
 * - Game:   board[row][col]
 *
 * Terrain mapping:
 * - bedrock, moss → BASE (traversable, buildable)
 * - crystal, abyss → WALL (non-traversable, non-buildable)
 * - spawnPoints → SPAWNER tiles
 * - exitPoints → EXIT tiles
 */
@Injectable({
  providedIn: 'root'
})
export class MapBridgeService {
  private editorMapState: EditorMapState | null = null;

  /**
   * Store editor map state for cross-route transfer.
   * Called by NovariseComponent.ngOnDestroy() before terrain is disposed.
   */
  setEditorMapState(state: EditorMapState): void {
    this.editorMapState = state;
  }

  /**
   * Retrieve the stored editor map state.
   */
  getEditorMapState(): EditorMapState | null {
    return this.editorMapState;
  }

  /**
   * Check if an editor map is available for the game to load.
   */
  hasEditorMap(): boolean {
    return this.editorMapState !== null;
  }

  /**
   * Clear the stored editor map state.
   */
  clearEditorMap(): void {
    this.editorMapState = null;
  }

  /**
   * Convert an editor map state to the game's board format.
   *
   * The editor stores tiles as tiles[x][z] (column-major) while the game
   * uses board[row][col] (row-major). This method handles the coordinate
   * transpose and terrain type conversion.
   *
   * Handles both v2 (spawnPoints/exitPoints arrays) and v1 (single point) formats.
   */
  convertToGameBoard(state: EditorMapState): ConvertedBoard {
    const gridSize = state.gridSize;
    const board: GameBoardTile[][] = [];

    // Build base board: game[row][col] maps to editor tiles[col][row]
    for (let row = 0; row < gridSize; row++) {
      board[row] = [];
      for (let col = 0; col < gridSize; col++) {
        const terrainType = state.tiles[col]?.[row];
        board[row][col] = this.convertTile(row, col, terrainType);
      }
    }

    // Resolve spawn points — v2 arrays or v1 single point
    const spawnPoints = this.resolveSpawnPoints(state);
    for (const sp of spawnPoints) {
      const row = sp.z;
      const col = sp.x;
      if (this.isValidPosition(row, col, gridSize)) {
        board[row][col] = GameBoardTile.createSpawner(row, col);
      }
    }

    // Resolve exit points — v2 arrays or v1 single point
    const exitPoints = this.resolveExitPoints(state);
    for (const ep of exitPoints) {
      const row = ep.z;
      const col = ep.x;
      if (this.isValidPosition(row, col, gridSize)) {
        board[row][col] = GameBoardTile.createExit(row, col);
      }
    }

    return { board, width: gridSize, height: gridSize };
  }

  private resolveSpawnPoints(state: EditorMapState): { x: number; z: number }[] {
    if (state.spawnPoints && Array.isArray(state.spawnPoints) && state.spawnPoints.length > 0) {
      return state.spawnPoints;
    }
    const legacy = state as unknown as TerrainGridStateLegacy;
    if (legacy.spawnPoint) {
      return [legacy.spawnPoint];
    }
    return [];
  }

  private resolveExitPoints(state: EditorMapState): { x: number; z: number }[] {
    if (state.exitPoints && Array.isArray(state.exitPoints) && state.exitPoints.length > 0) {
      return state.exitPoints;
    }
    const legacy = state as unknown as TerrainGridStateLegacy;
    if (legacy.exitPoint) {
      return [legacy.exitPoint];
    }
    return [];
  }

  private convertTile(row: number, col: number, terrainType: string | undefined): GameBoardTile {
    switch (terrainType) {
      case 'bedrock':
      case 'moss':
        return GameBoardTile.createBase(row, col);
      case 'crystal':
      case 'abyss':
        return GameBoardTile.createWall(row, col);
      default:
        return GameBoardTile.createBase(row, col);
    }
  }

  private isValidPosition(row: number, col: number, gridSize: number): boolean {
    return row >= 0 && row < gridSize && col >= 0 && col < gridSize;
  }
}
