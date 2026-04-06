import { Injectable, OnDestroy } from '@angular/core';
import { TerrainType } from '../models/terrain-types.enum';
import { EditorStateService, BrushTool, EditMode } from './editor-state.service';

export interface EditorKeyboardCallbacks {
  undo(): void;
  redo(): void;
  exportMap(): void;
  importMap(): void;
  saveGrid(): void;
  loadGrid(): void;
  cycleBrushSize(direction: number): void;
  changeActiveTool(tool: BrushTool): void;
  playMap(): void;
  setEditMode(mode: EditMode): void;
  setTerrainType(type: TerrainType): void;
}

/**
 * Manages keyboard event listeners for the editor.
 * Call `setup(callbacks)` in `ngAfterViewInit` and `teardown()` in `ngOnDestroy`.
 */
@Injectable()
export class EditorKeyboardService implements OnDestroy {
  private keysPressed = new Set<string>();

  private keyDownHandler!: (event: KeyboardEvent) => void;
  private keyUpHandler!: (event: KeyboardEvent) => void;

  private callbacks: EditorKeyboardCallbacks | null = null;

  constructor(private editorState: EditorStateService) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Register event listeners and store callback table. */
  setup(callbacks: EditorKeyboardCallbacks): void {
    this.callbacks = callbacks;
    this.keyDownHandler = this.handleKeyDown.bind(this);
    this.keyUpHandler = (event: KeyboardEvent) => {
      this.keysPressed.delete(event.key.toLowerCase());
    };
    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
  }

  /** Remove event listeners. */
  teardown(): void {
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
    this.keysPressed.clear();
    this.callbacks = null;
  }

  /** Returns the current set of held keys (for camera movement polling). */
  getKeysPressed(): Set<string> {
    return this.keysPressed;
  }

  ngOnDestroy(): void {
    this.teardown();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private handleKeyDown(event: KeyboardEvent): void {
    const cb = this.callbacks;
    if (!cb) return;

    const key = event.key.toLowerCase();

    // Ignore hotkeys when typing in a form field
    const tag = (event.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    this.keysPressed.add(key);

    // Ctrl/Meta shortcuts
    if (event.ctrlKey || event.metaKey) {
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        cb.undo();
        return;
      }
      if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        cb.redo();
        return;
      }
      if (key === 'e') {
        event.preventDefault();
        cb.exportMap();
        return;
      }
      if (key === 'o') {
        event.preventDefault();
        cb.importMap();
        return;
      }
    }

    switch (key) {
      case 't': cb.setEditMode('paint'); break;
      case 'h': cb.setEditMode('height'); break;
      case '1': cb.setTerrainType(TerrainType.BEDROCK); break;
      case '2': cb.setTerrainType(TerrainType.CRYSTAL); break;
      case '3': cb.setTerrainType(TerrainType.MOSS); break;
      case '4': cb.setTerrainType(TerrainType.ABYSS); break;
      case 'p': cb.setEditMode('spawn'); break;
      case 'x': cb.setEditMode('exit'); break;
      case 'g': cb.saveGrid(); break;
      case 'l': cb.loadGrid(); break;
      case '[': cb.cycleBrushSize(-1); break;
      case ']': cb.cycleBrushSize(1); break;
      case 'f': cb.changeActiveTool('fill'); break;
      case 'r': cb.changeActiveTool('rectangle'); break;
      case 'b': cb.changeActiveTool('brush'); break;
      case 'enter': cb.playMap(); break;
    }
  }
}
