import { Injectable } from '@angular/core';
import { TerrainType } from '../models/terrain-types.enum';

/**
 * Represents a single tile's state before/after an edit
 */
export interface TileState {
  x: number;
  z: number;
  type: TerrainType;
  height: number;
}

/**
 * Represents a point on the grid
 */
export interface GridPoint {
  x: number;
  z: number;
}

/**
 * Base interface for all edit commands
 */
export interface EditCommand {
  /** Unique identifier for the command type */
  type: string;
  /** Human-readable description for UI */
  description: string;
  /** Timestamp when command was created */
  timestamp: number;
  /** Undo this command - restore previous state */
  undo(): void;
  /** Redo this command - reapply the edit */
  redo(): void;
}

/**
 * Command for painting terrain tiles
 */
export class PaintCommand implements EditCommand {
  type = 'paint';
  description: string;
  timestamp = Date.now();

  constructor(
    private tiles: TileState[],
    private newType: TerrainType,
    private applyPaint: (x: number, z: number, type: TerrainType) => void
  ) {
    const count = tiles.length;
    this.description = count === 1
      ? `Paint tile to ${newType}`
      : `Paint ${count} tiles to ${newType}`;
  }

  undo(): void {
    // Restore each tile to its original type
    this.tiles.forEach(tile => {
      this.applyPaint(tile.x, tile.z, tile.type);
    });
  }

  redo(): void {
    // Reapply the new type to all tiles
    this.tiles.forEach(tile => {
      this.applyPaint(tile.x, tile.z, this.newType);
    });
  }
}

/**
 * Command for adjusting tile heights
 */
export class HeightCommand implements EditCommand {
  type = 'height';
  description: string;
  timestamp = Date.now();

  constructor(
    private tiles: TileState[],
    private newHeights: Map<string, number>,
    private applyHeight: (x: number, z: number, height: number) => void
  ) {
    const count = tiles.length;
    this.description = count === 1
      ? `Adjust tile height`
      : `Adjust ${count} tile heights`;
  }

  undo(): void {
    // Restore each tile to its original height
    this.tiles.forEach(tile => {
      this.applyHeight(tile.x, tile.z, tile.height);
    });
  }

  redo(): void {
    // Reapply the new heights
    this.newHeights.forEach((height, key) => {
      const [x, z] = key.split(',').map(Number);
      this.applyHeight(x, z, height);
    });
  }
}

/**
 * Command for setting spawn point
 */
export class SpawnPointCommand implements EditCommand {
  type = 'spawn';
  description = 'Set spawn point';
  timestamp = Date.now();

  constructor(
    private previousSpawn: GridPoint | null,
    private newSpawn: GridPoint,
    private applySpawn: (x: number, z: number) => void
  ) {}

  undo(): void {
    if (this.previousSpawn) {
      this.applySpawn(this.previousSpawn.x, this.previousSpawn.z);
    }
  }

  redo(): void {
    this.applySpawn(this.newSpawn.x, this.newSpawn.z);
  }
}

/**
 * Command for setting exit point
 */
export class ExitPointCommand implements EditCommand {
  type = 'exit';
  description = 'Set exit point';
  timestamp = Date.now();

  constructor(
    private previousExit: GridPoint | null,
    private newExit: GridPoint,
    private applyExit: (x: number, z: number) => void
  ) {}

  undo(): void {
    if (this.previousExit) {
      this.applyExit(this.previousExit.x, this.previousExit.z);
    }
  }

  redo(): void {
    this.applyExit(this.newExit.x, this.newExit.z);
  }
}

/**
 * Composite command for grouping multiple commands into one undoable action
 * Useful for rectangle fills, flood fills, etc.
 */
export class CompositeCommand implements EditCommand {
  type = 'composite';
  timestamp = Date.now();

  constructor(
    public description: string,
    private commands: EditCommand[]
  ) {}

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  redo(): void {
    // Redo in original order
    this.commands.forEach(cmd => cmd.redo());
  }
}

/**
 * Service to manage edit history with undo/redo functionality
 */
@Injectable({
  providedIn: 'root'
})
export class EditHistoryService {
  private undoStack: EditCommand[] = [];
  private redoStack: EditCommand[] = [];
  private maxHistorySize = 50;

  /** Whether there are commands to undo */
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Whether there are commands to redo */
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Number of commands in undo stack */
  get undoCount(): number {
    return this.undoStack.length;
  }

  /** Number of commands in redo stack */
  get redoCount(): number {
    return this.redoStack.length;
  }

  /** Get the description of the next undo action */
  get nextUndoDescription(): string | null {
    return this.undoStack.length > 0
      ? this.undoStack[this.undoStack.length - 1].description
      : null;
  }

  /** Get the description of the next redo action */
  get nextRedoDescription(): string | null {
    return this.redoStack.length > 0
      ? this.redoStack[this.redoStack.length - 1].description
      : null;
  }

  /**
   * Execute a command and add it to the undo stack
   */
  execute(command: EditCommand): void {
    // Execute the command (redo is the "do" action)
    command.redo();

    // Add to undo stack
    this.undoStack.push(command);

    // Clear redo stack (new action invalidates redo history)
    this.redoStack = [];

    // Trim history if exceeds max size
    while (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
  }

  /**
   * Record a command without executing it (command already executed)
   */
  record(command: EditCommand): void {
    this.undoStack.push(command);
    this.redoStack = [];

    while (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
  }

  /**
   * Undo the last command
   */
  undo(): EditCommand | null {
    if (!this.canUndo) return null;

    const command = this.undoStack.pop()!;
    command.undo();
    this.redoStack.push(command);

    return command;
  }

  /**
   * Redo the last undone command
   */
  redo(): EditCommand | null {
    if (!this.canRedo) return null;

    const command = this.redoStack.pop()!;
    command.redo();
    this.undoStack.push(command);

    return command;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Get a summary of the current history state
   */
  getHistorySummary(): { undoStack: string[]; redoStack: string[] } {
    return {
      undoStack: this.undoStack.map(cmd => cmd.description),
      redoStack: this.redoStack.map(cmd => cmd.description)
    };
  }
}
