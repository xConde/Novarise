import { TestBed } from '@angular/core/testing';
import { EditorKeyboardService, EditorKeyboardCallbacks } from './editor-keyboard.service';
import { EditorStateService } from './editor-state.service';
import { TerrainType } from '../models/terrain-types.enum';
import { BrushTool, EditMode } from './editor-state.service';

/**
 * Builds a no-op callbacks object; individual properties can be overridden.
 */
function makeCallbacks(overrides: Partial<EditorKeyboardCallbacks> = {}): EditorKeyboardCallbacks {
  return {
    undo: () => {},
    redo: () => {},
    exportMap: () => {},
    importMap: () => {},
    saveGrid: () => {},
    loadGrid: () => {},
    cycleBrushSize: () => {},
    changeActiveTool: () => {},
    playMap: () => {},
    setEditMode: () => {},
    setTerrainType: () => {},
    ...overrides,
  };
}

/** Dispatch a keydown event on window with optional modifiers. */
function pressKey(key: string, opts: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, ...opts }));
}

/** Dispatch a keyup event on window. */
function releaseKey(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

describe('EditorKeyboardService', () => {
  let service: EditorKeyboardService;
  let editorStateSpy: jasmine.SpyObj<EditorStateService>;

  beforeEach(() => {
    editorStateSpy = jasmine.createSpyObj<EditorStateService>('EditorStateService', [
      'getEditMode', 'setEditMode', 'getTerrainType', 'setTerrainType',
      'getBrushSize', 'setBrushSize', 'cycleBrushSize',
      'getActiveTool', 'setActiveTool', 'getColorForMode', 'getCursorForMode',
      'getCurrentMapName', 'setCurrentMapName',
    ]);

    TestBed.configureTestingModule({
      providers: [
        EditorKeyboardService,
        { provide: EditorStateService, useValue: editorStateSpy },
      ],
    });

    service = TestBed.inject(EditorKeyboardService);
  });

  afterEach(() => {
    service.teardown();
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with empty keysPressed set', () => {
    expect(service.getKeysPressed().size).toBe(0);
  });

  // ── setup / teardown ──────────────────────────────────────────────────────

  it('should register listeners on setup and clear them on teardown', () => {
    const cbs = makeCallbacks({ saveGrid: jasmine.createSpy('saveGrid') });
    service.setup(cbs);
    pressKey('g');
    expect(cbs.saveGrid).toHaveBeenCalledTimes(1);

    service.teardown();
    pressKey('g');
    // No additional call after teardown
    expect(cbs.saveGrid).toHaveBeenCalledTimes(1);
  });

  it('should clear keysPressed on teardown', () => {
    service.setup(makeCallbacks());
    pressKey('w');
    expect(service.getKeysPressed().has('w')).toBe(true);
    service.teardown();
    expect(service.getKeysPressed().size).toBe(0);
  });

  // ── keysPressed tracking ──────────────────────────────────────────────────

  describe('keysPressed', () => {
    beforeEach(() => service.setup(makeCallbacks()));

    it('should add key on keydown when target is not a form element', () => {
      const div = document.createElement('div');
      const event = new KeyboardEvent('keydown', { key: 'w' });
      Object.defineProperty(event, 'target', { value: div });
      window.dispatchEvent(event);
      expect(service.getKeysPressed().has('w')).toBe(true);
    });

    it('should NOT add key when target is an input element', () => {
      const input = document.createElement('input');
      const event = new KeyboardEvent('keydown', { key: 'w' });
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);
      expect(service.getKeysPressed().has('w')).toBe(false);
    });

    it('should NOT add key when target is a textarea', () => {
      const ta = document.createElement('textarea');
      const event = new KeyboardEvent('keydown', { key: 'a' });
      Object.defineProperty(event, 'target', { value: ta });
      window.dispatchEvent(event);
      expect(service.getKeysPressed().has('a')).toBe(false);
    });

    it('should NOT add key when target is a select element', () => {
      const sel = document.createElement('select');
      const event = new KeyboardEvent('keydown', { key: 'g' });
      Object.defineProperty(event, 'target', { value: sel });
      window.dispatchEvent(event);
      expect(service.getKeysPressed().has('g')).toBe(false);
    });

    it('should remove key from keysPressed on keyup', () => {
      pressKey('w');
      expect(service.getKeysPressed().has('w')).toBe(true);
      releaseKey('w');
      expect(service.getKeysPressed().has('w')).toBe(false);
    });

    it('should normalize keys to lowercase', () => {
      pressKey('W'); // uppercase
      expect(service.getKeysPressed().has('w')).toBe(true);
    });
  });

  // ── Ctrl/Meta shortcuts ───────────────────────────────────────────────────

  describe('Ctrl/Meta hotkeys', () => {
    it('should call undo on Ctrl+Z', () => {
      const undo = jasmine.createSpy('undo');
      service.setup(makeCallbacks({ undo }));
      pressKey('z', { ctrlKey: true });
      expect(undo).toHaveBeenCalledTimes(1);
    });

    it('should call redo on Ctrl+Y', () => {
      const redo = jasmine.createSpy('redo');
      service.setup(makeCallbacks({ redo }));
      pressKey('y', { ctrlKey: true });
      expect(redo).toHaveBeenCalledTimes(1);
    });

    it('should call redo on Ctrl+Shift+Z', () => {
      const redo = jasmine.createSpy('redo');
      service.setup(makeCallbacks({ redo }));
      pressKey('z', { ctrlKey: true, shiftKey: true });
      expect(redo).toHaveBeenCalledTimes(1);
    });

    it('should call exportMap on Ctrl+E', () => {
      const exportMap = jasmine.createSpy('exportMap');
      service.setup(makeCallbacks({ exportMap }));
      pressKey('e', { ctrlKey: true });
      expect(exportMap).toHaveBeenCalledTimes(1);
    });

    it('should call importMap on Ctrl+O', () => {
      const importMap = jasmine.createSpy('importMap');
      service.setup(makeCallbacks({ importMap }));
      pressKey('o', { ctrlKey: true });
      expect(importMap).toHaveBeenCalledTimes(1);
    });

    it('should call undo on Meta+Z (Mac)', () => {
      const undo = jasmine.createSpy('undo');
      service.setup(makeCallbacks({ undo }));
      pressKey('z', { metaKey: true });
      expect(undo).toHaveBeenCalledTimes(1);
    });
  });

  // ── Tool / mode switch hotkeys ────────────────────────────────────────────

  describe('mode and tool hotkeys', () => {
    let cbs: { [K in keyof EditorKeyboardCallbacks]: jasmine.Spy };

    beforeEach(() => {
      cbs = {
        undo: jasmine.createSpy('undo'),
        redo: jasmine.createSpy('redo'),
        exportMap: jasmine.createSpy('exportMap'),
        importMap: jasmine.createSpy('importMap'),
        saveGrid: jasmine.createSpy('saveGrid'),
        loadGrid: jasmine.createSpy('loadGrid'),
        cycleBrushSize: jasmine.createSpy('cycleBrushSize'),
        changeActiveTool: jasmine.createSpy('changeActiveTool'),
        playMap: jasmine.createSpy('playMap'),
        setEditMode: jasmine.createSpy('setEditMode'),
        setTerrainType: jasmine.createSpy('setTerrainType'),
      };
      service.setup(cbs);
    });

    const editModeCases: Array<[string, EditMode]> = [
      ['t', 'paint'],
      ['h', 'height'],
      ['p', 'spawn'],
      ['x', 'exit'],
    ];

    editModeCases.forEach(([key, mode]) => {
      it(`should call setEditMode('${mode}') on key '${key}'`, () => {
        pressKey(key);
        expect(cbs.setEditMode).toHaveBeenCalledWith(mode);
      });
    });

    const terrainCases: Array<[string, TerrainType]> = [
      ['1', TerrainType.BEDROCK],
      ['2', TerrainType.CRYSTAL],
      ['3', TerrainType.MOSS],
      ['4', TerrainType.ABYSS],
    ];

    terrainCases.forEach(([key, type]) => {
      it(`should call setTerrainType(${type}) on key '${key}'`, () => {
        pressKey(key);
        expect(cbs.setTerrainType).toHaveBeenCalledWith(type);
      });
    });

    const toolCases: Array<[string, BrushTool]> = [
      ['f', 'fill'],
      ['r', 'rectangle'],
      ['b', 'brush'],
    ];

    toolCases.forEach(([key, tool]) => {
      it(`should call changeActiveTool('${tool}') on key '${key}'`, () => {
        pressKey(key);
        expect(cbs.changeActiveTool).toHaveBeenCalledWith(tool);
      });
    });

    it('should call saveGrid on g', () => {
      pressKey('g');
      expect(cbs.saveGrid).toHaveBeenCalledTimes(1);
    });

    it('should call loadGrid on l', () => {
      pressKey('l');
      expect(cbs.loadGrid).toHaveBeenCalledTimes(1);
    });

    it('should call playMap on Enter', () => {
      pressKey('Enter');
      expect(cbs.playMap).toHaveBeenCalledTimes(1);
    });

    it('should call cycleBrushSize(-1) on [', () => {
      pressKey('[');
      expect(cbs.cycleBrushSize).toHaveBeenCalledWith(-1);
    });

    it('should call cycleBrushSize(1) on ]', () => {
      pressKey(']');
      expect(cbs.cycleBrushSize).toHaveBeenCalledWith(1);
    });
  });

  // ── No callbacks before setup ─────────────────────────────────────────────

  it('should not throw when a key is pressed before setup is called', () => {
    expect(() => pressKey('g')).not.toThrow();
  });

  // ── ngOnDestroy ───────────────────────────────────────────────────────────

  it('should call teardown on ngOnDestroy', () => {
    service.setup(makeCallbacks());
    spyOn(service, 'teardown').and.callThrough();
    service.ngOnDestroy();
    expect(service.teardown).toHaveBeenCalled();
  });
});
