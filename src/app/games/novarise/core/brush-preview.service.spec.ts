import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { BrushPreviewService } from './brush-preview.service';
import { EditorStateService } from './editor-state.service';
import { TerrainGrid } from '../features/terrain-editor/terrain-grid.class';

describe('BrushPreviewService', () => {
  let service: BrushPreviewService;
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
      providers: [BrushPreviewService, EditorStateService],
    });

    service = TestBed.inject(BrushPreviewService);
    editorState = TestBed.inject(EditorStateService);

    scene = new THREE.Scene();
    terrainGrid = new TerrainGrid(scene, 5);
    service.setScene(scene);
    service.setTerrainGrid(terrainGrid);
  });

  afterEach(() => {
    service.cleanup();
    terrainGrid.dispose();
  });

  describe('service creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('setScene() / setTerrainGrid()', () => {
    it('should accept scene and grid without error', () => {
      expect(() => {
        service.setScene(new THREE.Scene());
        service.setTerrainGrid(terrainGrid);
      }).not.toThrow();
    });
  });

  describe('createBrushIndicator()', () => {
    it('should add brush indicator to scene', () => {
      const before = scene.children.length;
      service.createBrushIndicator();
      expect(scene.children.length).toBe(before + 1);
    });

    it('should create indicator as hidden initially', () => {
      service.createBrushIndicator();
      expect(service.getBrushIndicator().visible).toBe(false);
    });
  });

  describe('positionBrushIndicator()', () => {
    it('should make brush indicator visible when positioned on a tile', () => {
      service.createBrushIndicator();
      const tile = makeMeshAt(0, 0);
      service.positionBrushIndicator(tile);
      expect(service.getBrushIndicator().visible).toBe(true);
    });
  });

  describe('hideBrushIndicator()', () => {
    it('should hide brush indicator', () => {
      service.createBrushIndicator();
      const tile = makeMeshAt(0, 0);
      service.positionBrushIndicator(tile);
      service.hideBrushIndicator();
      expect(service.getBrushIndicator().visible).toBe(false);
    });
  });

  describe('updateBrushPreview()', () => {
    it('should not add preview meshes when brush size is 1', () => {
      editorState.setBrushSize(1);
      const before = scene.children.length;
      service.updateBrushPreview();
      expect(scene.children.length).toBe(before);
    });

    it('should add preview meshes when brush size is 3', () => {
      editorState.setBrushSize(3);
      const before = scene.children.length;
      service.updateBrushPreview();
      // 3×3 grid minus center = 8 meshes
      expect(scene.children.length).toBe(before + 8);
    });

    it('should replace meshes when called again with smaller brush', () => {
      editorState.setBrushSize(3);
      service.updateBrushPreview();
      const after3x3 = scene.children.length;
      editorState.setBrushSize(1);
      service.updateBrushPreview();
      expect(scene.children.length).toBeLessThan(after3x3);
    });
  });

  describe('hideBrushPreview()', () => {
    it('should hide all preview meshes without removing from scene', () => {
      editorState.setBrushSize(3);
      service.updateBrushPreview();
      // Position first so they become visible
      const tile = makeMeshAt(2, 2);
      service.updateBrushPreviewPositions(tile);
      service.hideBrushPreview();

      // Check no preview mesh is visible (indicator excluded)
      const visiblePreview = scene.children.filter(c => {
        const mesh = c as THREE.Mesh;
        return mesh.visible && mesh.userData['offsetX'] !== undefined;
      });
      expect(visiblePreview.length).toBe(0);
    });
  });

  describe('getAffectedTiles()', () => {
    it('should return only center tile when brush size is 1', () => {
      editorState.setBrushSize(1);
      const center = makeMeshAt(2, 2);
      const tiles = service.getAffectedTiles(center);
      expect(tiles.length).toBe(1);
      expect(tiles[0]).toBe(center);
    });

    it('should return center + neighbors for brush size 3', () => {
      editorState.setBrushSize(3);
      const center = makeMeshAt(2, 2);
      const tiles = service.getAffectedTiles(center);
      // Center + up to 8 neighbors (inner 3×3 of a 5×5 grid = all 9, minus center skipped = 8 + center)
      expect(tiles.length).toBeGreaterThan(1);
      expect(tiles[0]).toBe(center);
    });

    it('should return only center when userData is missing', () => {
      editorState.setBrushSize(3);
      const mesh = new THREE.Mesh();
      // No userData.gridX / gridZ
      const tiles = service.getAffectedTiles(mesh);
      expect(tiles.length).toBe(1);
    });
  });

  describe('cleanup()', () => {
    it('should remove brush indicator from scene', () => {
      service.createBrushIndicator();
      const countWithIndicator = scene.children.length;
      service.cleanup();
      expect(scene.children.length).toBe(countWithIndicator - 1);
    });

    it('should remove all preview meshes from scene', () => {
      editorState.setBrushSize(3);
      service.updateBrushPreview();
      const countWithPreviews = scene.children.length;
      service.cleanup();
      // All 8 preview meshes removed
      expect(scene.children.length).toBe(countWithPreviews - 8);
    });
  });
});
