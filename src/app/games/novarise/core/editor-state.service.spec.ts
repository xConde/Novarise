import { TestBed } from '@angular/core/testing';
import { EditorStateService, EditMode, BrushTool, EditorState } from './editor-state.service';
import { TerrainType } from '../models/terrain-types.enum';

describe('EditorStateService', () => {
  let service: EditorStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EditorStateService]
    });
    service = TestBed.inject(EditorStateService);
  });

  describe('initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have default edit mode as paint', () => {
      expect(service.getEditMode()).toBe('paint');
    });

    it('should have default terrain type as BEDROCK', () => {
      expect(service.getTerrainType()).toBe(TerrainType.BEDROCK);
    });

    it('should have default brush size of 1', () => {
      expect(service.getBrushSize()).toBe(1);
    });

    it('should have default active tool as brush', () => {
      expect(service.getActiveTool()).toBe('brush');
    });

    it('should have default map name as Untitled Map', () => {
      expect(service.getCurrentMapName()).toBe('Untitled Map');
    });

    it('should have brush sizes array', () => {
      expect(service.brushSizes).toEqual([1, 3, 5, 7]);
    });
  });

  describe('setEditMode', () => {
    it('should set edit mode to paint', () => {
      service.setEditMode('height');
      service.setEditMode('paint');

      expect(service.getEditMode()).toBe('paint');
    });

    it('should set edit mode to height', () => {
      service.setEditMode('height');

      expect(service.getEditMode()).toBe('height');
    });

    it('should set edit mode to spawn', () => {
      service.setEditMode('spawn');

      expect(service.getEditMode()).toBe('spawn');
    });

    it('should set edit mode to exit', () => {
      service.setEditMode('exit');

      expect(service.getEditMode()).toBe('exit');
    });
  });

  describe('setTerrainType', () => {
    it('should set terrain type', () => {
      service.setTerrainType(TerrainType.CRYSTAL);

      expect(service.getTerrainType()).toBe(TerrainType.CRYSTAL);
    });

    it('should auto-switch to paint mode when terrain is selected', () => {
      service.setEditMode('height');
      expect(service.getEditMode()).toBe('height');

      service.setTerrainType(TerrainType.MOSS);

      expect(service.getEditMode()).toBe('paint');
    });

    it('should not change mode if already in paint mode', () => {
      service.setEditMode('paint');
      service.setTerrainType(TerrainType.ABYSS);

      expect(service.getEditMode()).toBe('paint');
    });
  });

  describe('setBrushSize', () => {
    it('should set valid brush size', () => {
      service.setBrushSize(3);

      expect(service.getBrushSize()).toBe(3);
    });

    it('should not change for invalid brush size', () => {
      service.setBrushSize(3);
      service.setBrushSize(2); // Invalid - not in brushSizes array

      expect(service.getBrushSize()).toBe(3);
    });

    it('should accept all valid brush sizes', () => {
      service.brushSizes.forEach(size => {
        service.setBrushSize(size);
        expect(service.getBrushSize()).toBe(size);
      });
    });
  });

  describe('cycleBrushSize', () => {
    it('should cycle to next brush size', () => {
      expect(service.getBrushSize()).toBe(1); // Index 0

      service.cycleBrushSize(1);
      expect(service.getBrushSize()).toBe(3); // Index 1
    });

    it('should cycle to previous brush size', () => {
      service.setBrushSize(3); // Index 1

      service.cycleBrushSize(-1);
      expect(service.getBrushSize()).toBe(1); // Index 0
    });

    it('should wrap around at end', () => {
      service.setBrushSize(7); // Last index

      service.cycleBrushSize(1);
      expect(service.getBrushSize()).toBe(1); // Back to first
    });

    it('should wrap around at beginning', () => {
      service.setBrushSize(1); // First index

      service.cycleBrushSize(-1);
      expect(service.getBrushSize()).toBe(7); // Wrap to last
    });

    it('should handle multiple cycles', () => {
      // Cycle through all sizes
      expect(service.getBrushSize()).toBe(1);
      service.cycleBrushSize(1);
      expect(service.getBrushSize()).toBe(3);
      service.cycleBrushSize(1);
      expect(service.getBrushSize()).toBe(5);
      service.cycleBrushSize(1);
      expect(service.getBrushSize()).toBe(7);
      service.cycleBrushSize(1);
      expect(service.getBrushSize()).toBe(1);
    });
  });

  describe('setActiveTool', () => {
    it('should set active tool to brush', () => {
      service.setActiveTool('fill');
      service.setActiveTool('brush');

      expect(service.getActiveTool()).toBe('brush');
    });

    it('should set active tool to fill', () => {
      service.setActiveTool('fill');

      expect(service.getActiveTool()).toBe('fill');
    });

    it('should set active tool to rectangle', () => {
      service.setActiveTool('rectangle');

      expect(service.getActiveTool()).toBe('rectangle');
    });
  });

  describe('setCurrentMapName', () => {
    it('should set map name', () => {
      service.setCurrentMapName('My Cool Map');

      expect(service.getCurrentMapName()).toBe('My Cool Map');
    });

    it('should allow empty map name', () => {
      service.setCurrentMapName('');

      expect(service.getCurrentMapName()).toBe('');
    });
  });

  describe('getState$', () => {
    it('should return observable', () => {
      const state$ = service.getState$();

      expect(state$).toBeTruthy();
      expect(typeof state$.subscribe).toBe('function');
    });

    it('should emit current state immediately', (done) => {
      service.getState$().subscribe(state => {
        expect(state).toBeTruthy();
        expect(state.editMode).toBe('paint');
        done();
      });
    });

    it('should emit when state changes', (done) => {
      const emittedStates: EditorState[] = [];

      service.getState$().subscribe(state => {
        emittedStates.push({ ...state });

        if (emittedStates.length === 2) {
          expect(emittedStates[0].editMode).toBe('paint');
          expect(emittedStates[1].editMode).toBe('height');
          done();
        }
      });

      service.setEditMode('height');
    });
  });

  describe('getState', () => {
    it('should return state snapshot', () => {
      const state = service.getState();

      expect(state).toBeTruthy();
      expect(state.editMode).toBeDefined();
      expect(state.selectedTerrainType).toBeDefined();
      expect(state.brushSize).toBeDefined();
      expect(state.activeTool).toBeDefined();
      expect(state.currentMapName).toBeDefined();
    });

    it('should return copy of state', () => {
      const state1 = service.getState();
      const state2 = service.getState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });

    it('should reflect current values', () => {
      service.setEditMode('spawn');
      service.setTerrainType(TerrainType.CRYSTAL);
      service.setBrushSize(5);
      service.setActiveTool('rectangle');
      service.setCurrentMapName('Test Map');

      const state = service.getState();

      expect(state.editMode).toBe('paint'); // Changed by setTerrainType
      expect(state.selectedTerrainType).toBe(TerrainType.CRYSTAL);
      expect(state.brushSize).toBe(5);
      expect(state.activeTool).toBe('rectangle');
      expect(state.currentMapName).toBe('Test Map');
    });
  });

  describe('reset', () => {
    it('should reset all values to defaults', () => {
      // Change everything
      service.setEditMode('exit');
      service.setTerrainType(TerrainType.ABYSS);
      service.setBrushSize(7);
      service.setActiveTool('fill');
      service.setCurrentMapName('Changed Map');

      service.reset();

      expect(service.getEditMode()).toBe('paint');
      expect(service.getTerrainType()).toBe(TerrainType.BEDROCK);
      expect(service.getBrushSize()).toBe(1);
      expect(service.getActiveTool()).toBe('brush');
      expect(service.getCurrentMapName()).toBe('Untitled Map');
    });

    it('should emit reset state', (done) => {
      service.setEditMode('height');

      let callCount = 0;
      service.getState$().subscribe(state => {
        callCount++;
        if (callCount === 2) { // After reset
          expect(state.editMode).toBe('paint');
          done();
        }
      });

      service.reset();
    });
  });

  describe('getCursorForMode', () => {
    it('should return cell for paint mode', () => {
      service.setEditMode('paint');
      expect(service.getCursorForMode()).toBe('cell');
    });

    it('should return ns-resize for height mode', () => {
      service.setEditMode('height');
      expect(service.getCursorForMode()).toBe('ns-resize');
    });

    it('should return crosshair for spawn mode', () => {
      service.setEditMode('spawn');
      expect(service.getCursorForMode()).toBe('crosshair');
    });

    it('should return crosshair for exit mode', () => {
      service.setEditMode('exit');
      expect(service.getCursorForMode()).toBe('crosshair');
    });
  });

  describe('getColorForMode', () => {
    it('should return blue for paint mode', () => {
      service.setEditMode('paint');
      expect(service.getColorForMode()).toBe(0x6a9aff);
    });

    it('should return pink for height mode', () => {
      service.setEditMode('height');
      expect(service.getColorForMode()).toBe(0xff6a9a);
    });

    it('should return green for spawn mode', () => {
      service.setEditMode('spawn');
      expect(service.getColorForMode()).toBe(0x50ff50);
    });

    it('should return red for exit mode', () => {
      service.setEditMode('exit');
      expect(service.getColorForMode()).toBe(0xff5050);
    });
  });

  describe('state consistency', () => {
    it('should maintain state consistency across operations', () => {
      // Perform multiple operations
      service.setEditMode('height');
      service.cycleBrushSize(1);
      service.setActiveTool('fill');
      service.setCurrentMapName('Test');

      // All values should be consistent
      const state = service.getState();
      expect(state.editMode).toBe('height');
      expect(state.brushSize).toBe(3);
      expect(state.activeTool).toBe('fill');
      expect(state.currentMapName).toBe('Test');
    });

    it('should handle rapid state changes', () => {
      for (let i = 0; i < 100; i++) {
        service.cycleBrushSize(1);
      }

      // Should have cycled through 100 times, ending up back at start
      expect(service.getBrushSize()).toBe(1);
    });
  });

  describe('type safety', () => {
    it('should have correct types for EditorState', () => {
      const state = service.getState();

      // Type checks (these would fail compilation if wrong)
      const editMode: EditMode = state.editMode;
      const terrainType: TerrainType = state.selectedTerrainType;
      const brushSize: number = state.brushSize;
      const brushSizeIndex: number = state.brushSizeIndex;
      const activeTool: BrushTool = state.activeTool;
      const mapName: string = state.currentMapName;

      expect(editMode).toBeDefined();
      expect(terrainType).toBeDefined();
      expect(brushSize).toBeDefined();
      expect(brushSizeIndex).toBeDefined();
      expect(activeTool).toBeDefined();
      expect(mapName).toBeDefined();
    });
  });
});
