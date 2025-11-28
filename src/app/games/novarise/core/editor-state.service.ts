import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TerrainType } from '../models/terrain-types.enum';

export type EditMode = 'paint' | 'height' | 'spawn' | 'exit';
export type BrushTool = 'brush' | 'fill' | 'rectangle';

export interface EditorState {
  editMode: EditMode;
  selectedTerrainType: TerrainType;
  brushSize: number;
  brushSizeIndex: number;
  activeTool: BrushTool;
  currentMapName: string;
}

@Injectable({
  providedIn: 'root'
})
export class EditorStateService {
  public readonly brushSizes = [1, 3, 5, 7];

  private readonly defaultState: EditorState = {
    editMode: 'paint',
    selectedTerrainType: TerrainType.BEDROCK,
    brushSize: 1,
    brushSizeIndex: 0,
    activeTool: 'brush',
    currentMapName: 'Untitled Map'
  };

  private stateSubject: BehaviorSubject<EditorState>;

  constructor() {
    this.stateSubject = new BehaviorSubject<EditorState>({ ...this.defaultState });
  }

  /**
   * Get observable of editor state
   */
  public getState$(): Observable<EditorState> {
    return this.stateSubject.asObservable();
  }

  /**
   * Get current state snapshot
   */
  public getState(): EditorState {
    return { ...this.stateSubject.value };
  }

  /**
   * Set edit mode
   */
  public setEditMode(mode: EditMode): void {
    this.updateState({ editMode: mode });
  }

  /**
   * Get current edit mode
   */
  public getEditMode(): EditMode {
    return this.stateSubject.value.editMode;
  }

  /**
   * Set selected terrain type
   */
  public setTerrainType(type: TerrainType): void {
    const updates: Partial<EditorState> = { selectedTerrainType: type };
    // Auto-switch to paint mode when selecting terrain
    if (this.stateSubject.value.editMode !== 'paint') {
      updates.editMode = 'paint';
    }
    this.updateState(updates);
  }

  /**
   * Get selected terrain type
   */
  public getTerrainType(): TerrainType {
    return this.stateSubject.value.selectedTerrainType;
  }

  /**
   * Set brush size
   */
  public setBrushSize(size: number): void {
    const index = this.brushSizes.indexOf(size);
    if (index !== -1) {
      this.updateState({
        brushSize: size,
        brushSizeIndex: index
      });
    }
  }

  /**
   * Get brush size
   */
  public getBrushSize(): number {
    return this.stateSubject.value.brushSize;
  }

  /**
   * Cycle brush size up or down
   */
  public cycleBrushSize(direction: number): void {
    const currentIndex = this.stateSubject.value.brushSizeIndex;
    const newIndex = (currentIndex + direction + this.brushSizes.length) % this.brushSizes.length;
    this.updateState({
      brushSizeIndex: newIndex,
      brushSize: this.brushSizes[newIndex]
    });
  }

  /**
   * Set active tool
   */
  public setActiveTool(tool: BrushTool): void {
    this.updateState({ activeTool: tool });
  }

  /**
   * Get active tool
   */
  public getActiveTool(): BrushTool {
    return this.stateSubject.value.activeTool;
  }

  /**
   * Set current map name
   */
  public setCurrentMapName(name: string): void {
    this.updateState({ currentMapName: name });
  }

  /**
   * Get current map name
   */
  public getCurrentMapName(): string {
    return this.stateSubject.value.currentMapName;
  }

  /**
   * Reset to default state
   */
  public reset(): void {
    this.stateSubject.next({ ...this.defaultState });
  }

  /**
   * Get mode-specific cursor style
   */
  public getCursorForMode(): string {
    const cursors: Record<EditMode, string> = {
      'paint': 'cell',
      'height': 'ns-resize',
      'spawn': 'crosshair',
      'exit': 'crosshair'
    };
    return cursors[this.stateSubject.value.editMode];
  }

  /**
   * Get mode-specific color (hex value)
   */
  public getColorForMode(): number {
    const colors: Record<EditMode, number> = {
      'paint': 0x6a9aff,
      'height': 0xff6a9a,
      'spawn': 0x50ff50,
      'exit': 0xff5050
    };
    return colors[this.stateSubject.value.editMode];
  }

  private updateState(updates: Partial<EditorState>): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      ...updates
    });
  }
}
