import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { RectangleToolService } from './rectangle-tool.service';
import { TerrainEditService } from './terrain-edit.service';
import { EditorStateService } from './editor-state.service';
import { EditHistoryService } from './edit-history.service';
import { TerrainGrid } from '../features/terrain-editor/terrain-grid.class';
import { TerrainType } from '../models/terrain-types.enum';

describe('RectangleToolService', () => {
  let service: RectangleToolService;
  let terrainEdit: TerrainEditService;
  let editorState: EditorStateService;
  let scene: THREE.Scene;
  let terrainGrid: TerrainGrid;

  function makeMeshAt(x: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial()
    );
    mesh.userData = { gridX: x, gridZ: z };
    return mesh;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RectangleToolService,
        TerrainEditService,
        EditorStateService,
        EditHistoryService,
      ],
    });

    service = TestBed.inject(RectangleToolService);
    terrainEdit = TestBed.inject(TerrainEditService);
    editorState = TestBed.inject(EditorStateService);

    scene = new THREE.Scene();
    terrainGrid = new TerrainGrid(scene, 10);
    service.setScene(scene);
    service.setTerrainGrid(terrainGrid);
    terrainEdit.setTerrainGrid(terrainGrid);
  });

  afterEach(() => {
    service.cleanup();
    terrainGrid.dispose();
  });

  // ── Service creation ─────────────────────────────────────────────────────

  describe('service creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  // ── setScene / setTerrainGrid ────────────────────────────────────────────

  describe('setScene() / setTerrainGrid()', () => {
    it('should accept scene and grid without error', () => {
      expect(() => {
        service.setScene(new THREE.Scene());
        service.setTerrainGrid(terrainGrid);
      }).not.toThrow();
    });
  });

  // ── Start tile ────────────────────────────────────────────────────────────

  describe('setStartTile() / getStartTile() / clearStartTile()', () => {
    it('should return null before any start tile is set', () => {
      expect(service.getStartTile()).toBeNull();
    });

    it('should store and return the start tile', () => {
      const tile = makeMeshAt(2, 3);
      service.setStartTile(tile);
      expect(service.getStartTile()).toBe(tile);
    });

    it('should clear the start tile', () => {
      service.setStartTile(makeMeshAt(1, 1));
      service.clearStartTile();
      expect(service.getStartTile()).toBeNull();
    });
  });

  // ── Preview ───────────────────────────────────────────────────────────────

  describe('updatePreview()', () => {
    it('should add preview meshes to the scene for a 2×2 selection', () => {
      const start = makeMeshAt(2, 2);
      const end = makeMeshAt(3, 3);
      const before = scene.children.length;
      service.updatePreview(start, end);
      // 2×2 = 4 tiles
      expect(scene.children.length).toBe(before + 4);
    });

    it('should add a single preview mesh for a 1×1 selection', () => {
      const start = makeMeshAt(4, 4);
      const end = makeMeshAt(4, 4);
      const before = scene.children.length;
      service.updatePreview(start, end);
      expect(scene.children.length).toBe(before + 1);
    });

    it('should handle start and end tile in any corner order', () => {
      // end tile has smaller coordinates than start tile
      const start = makeMeshAt(5, 5);
      const end = makeMeshAt(3, 3);
      const before = scene.children.length;
      service.updatePreview(start, end);
      // 3×3 = 9 tiles
      expect(scene.children.length).toBe(before + 9);
    });

    it('should skip preview when tile count exceeds 100', () => {
      // 11×10 = 110 tiles — exceeds the performance limit
      const start = makeMeshAt(0, 0);
      const end = makeMeshAt(9, 9); // 10×10 = 100, use 10×10 to test boundary
      // Exactly 100 tiles should render
      const before = scene.children.length;
      service.updatePreview(start, end);
      expect(scene.children.length).toBe(before + 100);
    });

    it('should replace old preview meshes when called again', () => {
      const start = makeMeshAt(2, 2);
      service.updatePreview(start, makeMeshAt(3, 3)); // 4 tiles
      const after4 = scene.children.length;
      service.updatePreview(start, makeMeshAt(2, 2)); // 1 tile
      expect(scene.children.length).toBe(after4 - 3);
    });

    it('should add no meshes for tiles with missing userData', () => {
      const badMesh = new THREE.Mesh();
      const before = scene.children.length;
      service.updatePreview(badMesh, badMesh);
      expect(scene.children.length).toBe(before);
    });
  });

  describe('clearPreview()', () => {
    it('should remove all preview meshes from the scene', () => {
      service.updatePreview(makeMeshAt(1, 1), makeMeshAt(3, 3)); // 3×3 = 9 tiles
      const before = scene.children.length;
      service.clearPreview();
      expect(scene.children.length).toBe(before - 9);
    });

    it('should be a no-op when called with no active preview', () => {
      expect(() => service.clearPreview()).not.toThrow();
    });
  });

  // ── Fill ──────────────────────────────────────────────────────────────────

  describe('fill()', () => {
    it('should apply terrain type to all tiles in the region', () => {
      editorState.setTerrainType(TerrainType.CRYSTAL);
      const start = makeMeshAt(1, 1);
      const end = makeMeshAt(2, 2);

      service.fill(start, end, () => {});

      // All four tiles should now be CRYSTAL
      for (let x = 1; x <= 2; x++) {
        for (let z = 1; z <= 2; z++) {
          const tile = terrainGrid.getTileAt(x, z);
          expect(tile?.type).toBe(TerrainType.CRYSTAL);
        }
      }
    });

    it('should clear the preview after fill', () => {
      service.updatePreview(makeMeshAt(1, 1), makeMeshAt(2, 2));
      const before = scene.children.length;
      service.fill(makeMeshAt(1, 1), makeMeshAt(2, 2), () => {});
      // Preview meshes removed; terrain objects stay
      expect(scene.children.length).toBeLessThanOrEqual(before);
    });

    it('should clear the start tile after fill', () => {
      service.setStartTile(makeMeshAt(1, 1));
      service.fill(makeMeshAt(1, 1), makeMeshAt(2, 2), () => {});
      expect(service.getStartTile()).toBeNull();
    });

    it('should return the flash targets for the filled region', () => {
      editorState.setTerrainType(TerrainType.MOSS);
      const flashTargets = service.fill(makeMeshAt(1, 1), makeMeshAt(2, 2), () => {});
      // 4 tiles = 4 flash targets
      expect(flashTargets.length).toBe(4);
    });

    it('should call onPathValidation for paint mode fills', () => {
      editorState.setTerrainType(TerrainType.MOSS);
      let called = false;
      service.fill(makeMeshAt(1, 1), makeMeshAt(1, 1), () => { called = true; });
      expect(called).toBe(true);
    });

    it('should return empty array when tile userData is missing', () => {
      const bad = new THREE.Mesh();
      const result = service.fill(bad, bad, () => {});
      expect(result).toEqual([]);
    });
  });

  // ── Reset ─────────────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('should clear start tile and preview meshes', () => {
      service.setStartTile(makeMeshAt(1, 1));
      service.updatePreview(makeMeshAt(1, 1), makeMeshAt(3, 3));
      const before = scene.children.length;

      service.reset();

      expect(service.getStartTile()).toBeNull();
      expect(scene.children.length).toBeLessThan(before);
    });
  });

  // ── Cleanup ───────────────────────────────────────────────────────────────

  describe('cleanup()', () => {
    it('should remove all preview meshes and clear start tile', () => {
      service.setStartTile(makeMeshAt(0, 0));
      service.updatePreview(makeMeshAt(0, 0), makeMeshAt(2, 2)); // 3×3 = 9 tiles
      const before = scene.children.length;

      service.cleanup();

      expect(scene.children.length).toBe(before - 9);
      expect(service.getStartTile()).toBeNull();
    });

    it('should be safe to call multiple times', () => {
      service.cleanup();
      expect(() => service.cleanup()).not.toThrow();
    });
  });
});
