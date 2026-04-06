import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TerrainEditService } from './terrain-edit.service';
import { EditHistoryService } from './edit-history.service';
import { EditorStateService } from './editor-state.service';
import { TerrainGrid } from '../features/terrain-editor/terrain-grid.class';
import { TerrainType } from '../models/terrain-types.enum';

describe('TerrainEditService', () => {
  let service: TerrainEditService;
  let editHistory: EditHistoryService;
  let editorState: EditorStateService;
  let scene: THREE.Scene;
  let terrainGrid: TerrainGrid;

  function makeMeshAt(x: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh();
    mesh.userData = { gridX: x, gridZ: z };
    return mesh;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TerrainEditService, EditHistoryService, EditorStateService],
    });

    service = TestBed.inject(TerrainEditService);
    editHistory = TestBed.inject(EditHistoryService);
    editorState = TestBed.inject(EditorStateService);

    scene = new THREE.Scene();
    terrainGrid = new TerrainGrid(scene, 5);
    service.setTerrainGrid(terrainGrid);
  });

  afterEach(() => {
    terrainGrid.dispose();
  });

  describe('service creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('setTerrainGrid()', () => {
    it('should accept a TerrainGrid without error', () => {
      expect(() => service.setTerrainGrid(terrainGrid)).not.toThrow();
    });
  });

  describe('stroke tracking (startStroke / endStroke / isTracking)', () => {
    it('isTracking is false before startStroke', () => {
      expect(service.isTracking).toBe(false);
    });

    it('isTracking is true after startStroke', () => {
      service.startStroke();
      expect(service.isTracking).toBe(true);
    });

    it('isTracking is false after endStroke', () => {
      service.startStroke();
      service.endStroke(() => {});
      expect(service.isTracking).toBe(false);
    });

    it('endStroke records a PaintCommand when paint tiles were tracked', () => {
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.CRYSTAL);
      service.startStroke();
      service.trackTileForUndo(0, 0);
      // Simulate tile being painted
      terrainGrid.paintTile(0, 0, TerrainType.CRYSTAL);
      service.endStroke(() => {});
      expect(editHistory.canUndo).toBe(true);
    });

    it('endStroke does not record when no tiles tracked', () => {
      editorState.setEditMode('paint');
      service.startStroke();
      service.endStroke(() => {});
      expect(editHistory.canUndo).toBe(false);
    });

    it('endStroke calls onPathValidation for paint mode', () => {
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.CRYSTAL);
      service.startStroke();
      service.trackTileForUndo(0, 0);
      let called = false;
      service.endStroke(() => { called = true; });
      expect(called).toBe(true);
    });

    it('endStroke does not call onPathValidation for height mode', () => {
      editorState.setEditMode('height');
      service.startStroke();
      service.trackTileForUndo(0, 0);
      let called = false;
      service.endStroke(() => { called = true; });
      expect(called).toBe(false);
    });
  });

  describe('trackTileForUndo()', () => {
    it('tracks tile state on first call', () => {
      service.startStroke();
      service.trackTileForUndo(0, 0);
      // Paint then undo to verify snapshot was taken from BEDROCK
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.CRYSTAL);
      terrainGrid.paintTile(0, 0, TerrainType.CRYSTAL);
      service.endStroke(() => {});
      editHistory.undo();
      expect(terrainGrid.getTileAt(0, 0)!.type).toBe(TerrainType.BEDROCK);
    });

    it('does not overwrite tracked state on second call for same tile', () => {
      // Start with BEDROCK, paint once, track again (should still track BEDROCK)
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.CRYSTAL);
      service.startStroke();
      service.trackTileForUndo(0, 0); // captures BEDROCK
      terrainGrid.paintTile(0, 0, TerrainType.CRYSTAL);
      service.trackTileForUndo(0, 0); // should be ignored
      service.endStroke(() => {});
      editHistory.undo();
      expect(terrainGrid.getTileAt(0, 0)!.type).toBe(TerrainType.BEDROCK);
    });
  });

  describe('applyBrushEdit()', () => {
    it('paints affected tiles in paint mode', () => {
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.CRYSTAL);
      service.startStroke();
      const tile = terrainGrid.getTileAt(1, 1)!;
      tile.mesh.userData = { gridX: 1, gridZ: 1 };
      service.applyBrushEdit([tile.mesh], () => {});
      expect(terrainGrid.getTileAt(1, 1)!.type).toBe(TerrainType.CRYSTAL);
    });

    it('returns flash targets for painted tiles', () => {
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.CRYSTAL);
      service.startStroke();
      const tile = terrainGrid.getTileAt(1, 1)!;
      tile.mesh.userData = { gridX: 1, gridZ: 1 };
      const targets = service.applyBrushEdit([tile.mesh], () => {});
      expect(targets.length).toBe(1);
    });

    it('returns empty array for spawn mode (not handled here)', () => {
      editorState.setEditMode('spawn');
      service.startStroke();
      const tile = terrainGrid.getTileAt(1, 1)!;
      tile.mesh.userData = { gridX: 1, gridZ: 1 };
      const targets = service.applyBrushEdit([tile.mesh], () => {});
      expect(targets.length).toBe(0);
    });
  });

  describe('floodFill()', () => {
    it('returns empty array if mesh has no gridX userData', () => {
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.CRYSTAL);
      const mesh = new THREE.Mesh();
      const result = service.floodFill(mesh, () => {});
      expect(result).toEqual([]);
    });

    it('returns empty array in non-paint mode', () => {
      editorState.setEditMode('height');
      const tile = terrainGrid.getTileAt(0, 0)!;
      tile.mesh.userData = { gridX: 0, gridZ: 0 };
      const result = service.floodFill(tile.mesh, () => {});
      expect(result).toEqual([]);
    });

    it('returns empty array when target type equals replacement type', () => {
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.BEDROCK); // same as default
      const tile = terrainGrid.getTileAt(0, 0)!;
      tile.mesh.userData = { gridX: 0, gridZ: 0 };
      const result = service.floodFill(tile.mesh, () => {});
      expect(result).toEqual([]);
    });

    it('fills connected region with replacement type', () => {
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.CRYSTAL);
      const tile = terrainGrid.getTileAt(0, 0)!;
      tile.mesh.userData = { gridX: 0, gridZ: 0 };
      const result = service.floodFill(tile.mesh, () => {});
      // All 5x5 tiles start as BEDROCK — all should be filled
      expect(result.length).toBe(25);
      expect(terrainGrid.getTileAt(2, 2)!.type).toBe(TerrainType.CRYSTAL);
    });

    it('records a PaintCommand for undo', () => {
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.CRYSTAL);
      const tile = terrainGrid.getTileAt(0, 0)!;
      tile.mesh.userData = { gridX: 0, gridZ: 0 };
      service.floodFill(tile.mesh, () => {});
      expect(editHistory.canUndo).toBe(true);
    });

    it('calls onPathValidation after fill', () => {
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.CRYSTAL);
      const tile = terrainGrid.getTileAt(0, 0)!;
      tile.mesh.userData = { gridX: 0, gridZ: 0 };
      let called = false;
      service.floodFill(tile.mesh, () => { called = true; });
      expect(called).toBe(true);
    });

    it('does not fill disconnected region of different type', () => {
      // Paint tile (2,2) to MOSS before flood-filling BEDROCK from (0,0)
      terrainGrid.paintTile(2, 2, TerrainType.MOSS);
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.CRYSTAL);
      const tile = terrainGrid.getTileAt(0, 0)!;
      tile.mesh.userData = { gridX: 0, gridZ: 0 };
      // Since MOSS tile is in the BEDROCK region via connectivity,
      // verify flood fill doesn't turn MOSS into CRYSTAL (it stops at type mismatch)
      service.floodFill(tile.mesh, () => {});
      // Tile (2,2) was MOSS — it breaks the flood fill connectivity so stays MOSS
      expect(terrainGrid.getTileAt(2, 2)!.type).toBe(TerrainType.MOSS);
    });
  });

  describe('fillRectangle()', () => {
    it('returns empty array if startTile has no gridX userData', () => {
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.CRYSTAL);
      const start = new THREE.Mesh();
      const end = makeMeshAt(2, 2);
      const result = service.fillRectangle(start, end, () => {});
      expect(result).toEqual([]);
    });

    it('paints all tiles within bounding box', () => {
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.MOSS);
      const startTile = terrainGrid.getTileAt(0, 0)!;
      const endTile = terrainGrid.getTileAt(2, 2)!;
      startTile.mesh.userData = { gridX: 0, gridZ: 0 };
      endTile.mesh.userData = { gridX: 2, gridZ: 2 };
      service.fillRectangle(startTile.mesh, endTile.mesh, () => {});
      for (let x = 0; x <= 2; x++) {
        for (let z = 0; z <= 2; z++) {
          expect(terrainGrid.getTileAt(x, z)!.type).toBe(TerrainType.MOSS);
        }
      }
    });

    it('returns flash targets for all painted tiles', () => {
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.MOSS);
      const startTile = terrainGrid.getTileAt(0, 0)!;
      const endTile = terrainGrid.getTileAt(1, 1)!;
      startTile.mesh.userData = { gridX: 0, gridZ: 0 };
      endTile.mesh.userData = { gridX: 1, gridZ: 1 };
      const targets = service.fillRectangle(startTile.mesh, endTile.mesh, () => {});
      expect(targets.length).toBe(4); // 2x2
    });

    it('records a PaintCommand for undo in paint mode', () => {
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.MOSS);
      const startTile = terrainGrid.getTileAt(0, 0)!;
      const endTile = terrainGrid.getTileAt(1, 1)!;
      startTile.mesh.userData = { gridX: 0, gridZ: 0 };
      endTile.mesh.userData = { gridX: 1, gridZ: 1 };
      service.fillRectangle(startTile.mesh, endTile.mesh, () => {});
      expect(editHistory.canUndo).toBe(true);
    });

    it('calls onPathValidation after paint fill', () => {
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.MOSS);
      const startTile = terrainGrid.getTileAt(0, 0)!;
      const endTile = terrainGrid.getTileAt(1, 1)!;
      startTile.mesh.userData = { gridX: 0, gridZ: 0 };
      endTile.mesh.userData = { gridX: 1, gridZ: 1 };
      let called = false;
      service.fillRectangle(startTile.mesh, endTile.mesh, () => { called = true; });
      expect(called).toBe(true);
    });

    it('records a HeightCommand for undo in height mode', () => {
      editorState.setEditMode('height');
      const startTile = terrainGrid.getTileAt(0, 0)!;
      const endTile = terrainGrid.getTileAt(1, 1)!;
      startTile.mesh.userData = { gridX: 0, gridZ: 0 };
      endTile.mesh.userData = { gridX: 1, gridZ: 1 };
      service.fillRectangle(startTile.mesh, endTile.mesh, () => {});
      expect(editHistory.canUndo).toBe(true);
    });

    it('works with reversed tile order (end before start)', () => {
      editorState.setEditMode('paint');
      editorState.setTerrainType(TerrainType.CRYSTAL);
      const startTile = terrainGrid.getTileAt(2, 2)!;
      const endTile = terrainGrid.getTileAt(0, 0)!;
      startTile.mesh.userData = { gridX: 2, gridZ: 2 };
      endTile.mesh.userData = { gridX: 0, gridZ: 0 };
      const targets = service.fillRectangle(startTile.mesh, endTile.mesh, () => {});
      expect(targets.length).toBe(9); // 3x3
    });
  });
});
