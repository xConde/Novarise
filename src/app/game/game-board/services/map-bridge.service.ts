import { Injectable } from '@angular/core';
import { BlockType, GameBoardTile } from '../models/game-board-tile';
import { TerrainGridState } from '../../../games/novarise/features/terrain-editor/terrain-grid-state.interface';

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
 * - spawnPoint → SPAWNER tile
 * - exitPoint → EXIT tile
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

    // Override spawn point tile
    if (state.spawnPoint) {
      const row = state.spawnPoint.z;
      const col = state.spawnPoint.x;
      if (this.isValidPosition(row, col, gridSize)) {
        board[row][col] = GameBoardTile.createSpawner(row, col);
      }
    }

    // Override exit point tile
    if (state.exitPoint) {
      const row = state.exitPoint.z;
      const col = state.exitPoint.x;
      if (this.isValidPosition(row, col, gridSize)) {
        board[row][col] = GameBoardTile.createExit(row, col);
      }
    }

    return { board, width: gridSize, height: gridSize };
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
